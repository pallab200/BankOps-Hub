/**
 * adjustmentController.js — DOM glue for the Adjustment_Engine (Req 5).
 *
 * Wires the brightness/contrast/saturation/sharpness sliders to the pure
 * `imageAdjust.js` core. Responsibilities:
 *   - Display each control's current value (Req 5.1).
 *   - Live preview of brightness/contrast/saturation within 500 ms via a
 *     debounced canvas redraw using `buildFilterString` (Req 5.2).
 *   - On Apply, produce the Adjusted_Image including the sharpness amount via
 *     `adjust(...)`, draw it to the adjusted canvas, store it on state, and
 *     enable the Adjusted PDF export (Req 5.4, 5.6).
 *   - CRITICAL (fixes D4 / Req 5.3, 5.5): when no Combined_Image exists, slider
 *     changes and Apply show NON-BLOCKING guidance (never an alert dialog) and
 *     change nothing — the Adjusted Preview and all state are left untouched.
 *
 * This module is a thin layer of glue: all pixel math lives in
 * `../core/imageAdjust.js`. Collaborators (elements, appState, messages,
 * progress, timers) are injected through the factory so the controller can be
 * exercised under jsdom without reaching for globals.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import {
  buildFilterString,
  adjust,
  sharpenKernel,
  isIdentity,
} from '../core/imageAdjust.js';

/** Default debounce window for the live preview (Req 5.2: within 500 ms). */
export const DEFAULT_DEBOUNCE_MS = 500;

/** Non-blocking guidance shown when an adjustment is attempted with no combined image. */
export const NO_COMBINED_GUIDANCE =
  'Combine your images first to enable adjustments.';

/** Message surfaced if drawing the adjusted image fails unexpectedly. */
export const APPLY_FAILED_MESSAGE = 'Could not apply adjustments. Please try again.';

/** CSS class used throughout the markup to hide an element. */
const HIDDEN_CLASS = 'hidden';

/**
 * Read an integer slider value, falling back to a default when unavailable.
 * @param {HTMLInputElement|null} el
 * @param {number} fallback
 * @returns {number}
 */
function readSliderValue(el, fallback) {
  if (!el) return fallback;
  const n = Number.parseInt(el.value, 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Create an Adjustment_Engine controller bound to the supplied collaborators.
 *
 * @param {Object} options
 * @param {Object} options.elements - Resolved DOM elements.
 * @param {HTMLInputElement} options.elements.brightness - Brightness slider (#adjBrightness).
 * @param {HTMLInputElement} options.elements.contrast - Contrast slider (#adjContrast).
 * @param {HTMLInputElement} options.elements.saturation - Saturation slider (#adjSaturation).
 * @param {HTMLInputElement} options.elements.sharpness - Sharpness slider (#adjSharp).
 * @param {HTMLElement} [options.elements.brightnessVal] - Brightness value display (#adjBrightVal).
 * @param {HTMLElement} [options.elements.contrastVal] - Contrast value display (#adjContrastVal).
 * @param {HTMLElement} [options.elements.saturationVal] - Saturation value display (#adjSatVal).
 * @param {HTMLElement} [options.elements.sharpnessVal] - Sharpness value display (#adjSharpVal).
 * @param {HTMLButtonElement} options.elements.applyBtn - Apply Adjustments button (#applyAdj).
 * @param {HTMLCanvasElement} options.elements.adjustedCanvas - Adjusted preview canvas (#adjustedCanvas).
 * @param {HTMLElement} [options.elements.adjustedPlaceholder] - Adjusted canvas placeholder (#adjustedCanvasPlaceholder).
 * @param {HTMLButtonElement} options.elements.downloadAdjBtn - Adjusted PDF export button (#downloadAdjPdf).
 * @param {HTMLCanvasElement} options.elements.sourceCanvas - Combined-image canvas providing source pixels (#previewCanvas).
 * @param {Object} options.appState - Application-state store (see appState.js).
 * @param {Object} options.messages - Message controller exposing showGuidance/showError.
 * @param {Object} [options.progress] - Optional progress controller (begin/complete/fail).
 * @param {number} [options.debounceMs] - Live-preview debounce window (defaults to 500).
 * @param {(cb: Function, ms: number) => any} [options.setTimeoutFn] - Injectable scheduler.
 * @param {(handle: any) => void} [options.clearTimeoutFn] - Injectable canceller.
 * @returns {{
 *   handleSliderInput: (key: string) => void,
 *   applyAdjustments: () => boolean,
 *   renderValues: () => void,
 *   destroy: () => void
 * }}
 */
export function createAdjustmentController(options = {}) {
  const {
    elements = {},
    appState,
    messages,
    progress = null,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    setTimeoutFn,
    clearTimeoutFn,
  } = options;

  if (!appState) throw new Error('createAdjustmentController requires appState');
  if (!messages) throw new Error('createAdjustmentController requires messages');

  const {
    brightness: brightnessEl = null,
    contrast: contrastEl = null,
    saturation: saturationEl = null,
    sharpness: sharpnessEl = null,
    brightnessVal = null,
    contrastVal = null,
    saturationVal = null,
    sharpnessVal = null,
    applyBtn = null,
    adjustedCanvas = null,
    adjustedPlaceholder = null,
    downloadAdjBtn = null,
    sourceCanvas = null,
  } = elements;

  // Resolve injectable timers, falling back to globals when present.
  const schedule =
    typeof setTimeoutFn === 'function'
      ? setTimeoutFn
      : typeof setTimeout === 'function'
        ? setTimeout
        : null;
  const cancel =
    typeof clearTimeoutFn === 'function'
      ? clearTimeoutFn
      : typeof clearTimeout === 'function'
        ? clearTimeout
        : null;

  const resolvedDebounce =
    Number.isFinite(debounceMs) && debounceMs >= 0 ? debounceMs : DEFAULT_DEBOUNCE_MS;

  let previewTimer = null;

  // --- helpers ------------------------------------------------------------

  function combinedImageExists() {
    const state = appState.getState();
    return Boolean(state && state.combinedImage);
  }

  function readAdjustments() {
    return {
      brightness: readSliderValue(brightnessEl, 100),
      contrast: readSliderValue(contrastEl, 100),
      saturation: readSliderValue(saturationEl, 100),
      sharpness: readSliderValue(sharpnessEl, 0),
    };
  }

  /** Reflect each control's current value into its display element (Req 5.1). */
  function renderValues() {
    const { brightness, contrast, saturation, sharpness } = readAdjustments();
    if (brightnessVal) brightnessVal.textContent = `${brightness}%`;
    if (contrastVal) contrastVal.textContent = `${contrast}%`;
    if (saturationVal) saturationVal.textContent = `${saturation}%`;
    if (sharpnessVal) sharpnessVal.textContent = `${sharpness}`;
  }

  function showAdjustedCanvas() {
    if (adjustedCanvas) adjustedCanvas.classList.remove(HIDDEN_CLASS);
    if (adjustedPlaceholder) adjustedPlaceholder.classList.add(HIDDEN_CLASS);
  }

  function cancelPendingPreview() {
    if (previewTimer !== null && cancel) cancel(previewTimer);
    previewTimer = null;
  }

  /**
   * Redraw the live preview using a CSS filter string for
   * brightness/contrast/saturation (Req 5.2). Sharpness is intentionally NOT
   * applied here — convolution runs only on Apply. Drawing failures are
   * swallowed so a missing 2D context never escapes as an uncaught error.
   */
  function renderLivePreview() {
    if (!combinedImageExists() || !sourceCanvas || !adjustedCanvas) return;
    const ctx = adjustedCanvas.getContext && adjustedCanvas.getContext('2d');
    if (!ctx) return;
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    if (!width || !height) return;

    const { brightness, contrast, saturation } = readAdjustments();
    try {
      adjustedCanvas.width = width;
      adjustedCanvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.filter = buildFilterString(brightness, contrast, saturation);
      ctx.drawImage(sourceCanvas, 0, 0);
      ctx.filter = 'none';
      showAdjustedCanvas();
    } catch (_err) {
      // Preview is best-effort; never throw out of an event handler.
    }
  }

  function scheduleLivePreview() {
    cancelPendingPreview();
    if (!schedule) {
      renderLivePreview();
      return;
    }
    previewTimer = schedule(() => {
      previewTimer = null;
      renderLivePreview();
    }, resolvedDebounce);
  }

  // --- public handlers ----------------------------------------------------

  /**
   * Handle a change to any adjustment slider.
   *
   * Always reflects the new value in the display (Req 5.1). When no
   * Combined_Image exists, shows non-blocking guidance and changes nothing —
   * the Adjusted Preview is left untouched (fixes D4; Req 5.3). Otherwise the
   * live preview is refreshed within the debounce window (Req 5.2).
   *
   * @param {('brightness'|'contrast'|'saturation'|'sharpness')} [key]
   */
  function handleSliderInput(key) {
    // Reflect the control's current value regardless of state (Req 5.1).
    renderValues();

    if (!combinedImageExists()) {
      // Non-blocking guidance; no preview/state change (Req 5.3).
      cancelPendingPreview();
      messages.showGuidance(NO_COMBINED_GUIDANCE);
      return;
    }

    // Sharpness is applied on Apply only; live preview covers B/C/S (Req 5.2).
    if (key === 'sharpness') return;
    scheduleLivePreview();
  }

  /**
   * Apply the adjustments to produce the Adjusted_Image including sharpness
   * (Req 5.4), draw it to the adjusted canvas, store it on state, and enable
   * the Adjusted PDF export (Req 5.6).
   *
   * When no Combined_Image exists, shows non-blocking guidance and changes
   * nothing (fixes D4; Req 5.5).
   *
   * @returns {boolean} true when an Adjusted_Image was produced.
   */
  function applyAdjustments() {
    if (!combinedImageExists()) {
      messages.showGuidance(NO_COMBINED_GUIDANCE);
      return false;
    }

    if (!sourceCanvas || !adjustedCanvas) {
      messages.showError(APPLY_FAILED_MESSAGE);
      return false;
    }

    const srcCtx = sourceCanvas.getContext && sourceCanvas.getContext('2d');
    const outCtx = adjustedCanvas.getContext && adjustedCanvas.getContext('2d');
    if (!srcCtx || !outCtx) {
      messages.showError(APPLY_FAILED_MESSAGE);
      return false;
    }

    cancelPendingPreview();
    if (progress && typeof progress.begin === 'function') progress.begin();

    try {
      const width = sourceCanvas.width;
      const height = sourceCanvas.height;
      if (!width || !height) {
        if (progress && typeof progress.fail === 'function') progress.fail();
        messages.showError(APPLY_FAILED_MESSAGE);
        return false;
      }

      const adjustments = readAdjustments();
      const srcData = srcCtx.getImageData(0, 0, width, height);

      // Pure pixel transform (includes the sharpness convolution; Req 5.4).
      const outBuffer = adjust(srcData.data, width, height, adjustments);

      adjustedCanvas.width = width;
      adjustedCanvas.height = height;
      const outImageData = outCtx.createImageData(width, height);
      outImageData.data.set(outBuffer);
      outCtx.putImageData(outImageData, 0, 0);
      showAdjustedCanvas();

      // Store the unfiltered adjusted result; FilterController applies filters
      // against this base. The adjusted canvas is a drawable source of truth.
      if (typeof appState.setAdjustedBase === 'function') {
        appState.setAdjustedBase(adjustedCanvas);
      }
      if (typeof appState.setAdjustedImage === 'function') {
        appState.setAdjustedImage(adjustedCanvas);
      }

      // Enable the Adjusted PDF export (Req 5.6).
      if (typeof appState.setExportAdjustedVisible === 'function') {
        appState.setExportAdjustedVisible(true);
      }
      if (downloadAdjBtn) downloadAdjBtn.classList.remove(HIDDEN_CLASS);

      if (progress && typeof progress.complete === 'function') progress.complete();
      return true;
    } catch (_err) {
      if (progress && typeof progress.fail === 'function') progress.fail();
      messages.showError(APPLY_FAILED_MESSAGE);
      return false;
    }
  }

  // --- event wiring -------------------------------------------------------

  const listeners = [];

  function bind(el, type, handler) {
    if (!el || typeof el.addEventListener !== 'function') return;
    el.addEventListener(type, handler);
    listeners.push({ el, type, handler });
  }

  const onBrightness = () => handleSliderInput('brightness');
  const onContrast = () => handleSliderInput('contrast');
  const onSaturation = () => handleSliderInput('saturation');
  const onSharpness = () => handleSliderInput('sharpness');
  const onApply = () => applyAdjustments();

  bind(brightnessEl, 'input', onBrightness);
  bind(contrastEl, 'input', onContrast);
  bind(saturationEl, 'input', onSaturation);
  bind(sharpnessEl, 'input', onSharpness);
  bind(applyBtn, 'click', onApply);

  // Reflect initial slider values on construction (Req 5.1).
  renderValues();

  /** Remove all bound listeners and cancel pending timers. */
  function destroy() {
    cancelPendingPreview();
    for (const { el, type, handler } of listeners) {
      if (el && typeof el.removeEventListener === 'function') {
        el.removeEventListener(type, handler);
      }
    }
    listeners.length = 0;
  }

  return {
    handleSliderInput,
    applyAdjustments,
    renderValues,
    destroy,
  };
}

/**
 * Resolve the adjustment elements from a document and create the controller.
 *
 * @param {Document} doc - The document to query (e.g. `document`).
 * @param {Object} deps
 * @param {Object} deps.appState - Application-state store.
 * @param {Object} deps.messages - Message controller.
 * @param {Object} [deps.progress] - Optional progress controller.
 * @param {number} [deps.debounceMs] - Optional debounce override.
 * @returns {ReturnType<typeof createAdjustmentController>}
 */
export function initAdjustmentController(doc, deps = {}) {
  if (!doc || typeof doc.getElementById !== 'function') {
    throw new Error('initAdjustmentController requires a document');
  }
  const elements = {
    brightness: doc.getElementById('adjBrightness'),
    contrast: doc.getElementById('adjContrast'),
    saturation: doc.getElementById('adjSaturation'),
    sharpness: doc.getElementById('adjSharp'),
    brightnessVal: doc.getElementById('adjBrightVal'),
    contrastVal: doc.getElementById('adjContrastVal'),
    saturationVal: doc.getElementById('adjSatVal'),
    sharpnessVal: doc.getElementById('adjSharpVal'),
    applyBtn: doc.getElementById('applyAdj'),
    adjustedCanvas: doc.getElementById('adjustedCanvas'),
    adjustedPlaceholder: doc.getElementById('adjustedCanvasPlaceholder'),
    downloadAdjBtn: doc.getElementById('downloadAdjPdf'),
    sourceCanvas: doc.getElementById('previewCanvas'),
  };
  return createAdjustmentController({
    elements,
    appState: deps.appState,
    messages: deps.messages,
    progress: deps.progress,
    debounceMs: deps.debounceMs,
  });
}

// Re-export the pure helpers the controller relies on, so consumers wiring the
// adjustment UI have a single import surface.
export { buildFilterString, adjust, sharpenKernel, isIdentity };

export default createAdjustmentController;
