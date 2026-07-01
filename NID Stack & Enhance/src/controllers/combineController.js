/**
 * combineController.js — DOM glue for the Combine_Engine (thin controller).
 *
 * Wires the Combine Settings + Actions UI to the pure `computeLayout` and
 * `validateSpacing` core logic. It contains no layout math itself: it reads
 * control values, delegates the geometry to `combineLayout.computeLayout`,
 * paints the resulting placements onto the preview canvas, drives the
 * Progress_Indicator, and toggles the Combined-PDF export control.
 *
 * Responsibilities (design.md "Combine Component"):
 *   - Read and validate the Spacing_Value; on rejection show a message and
 *     retain the previously accepted value.                      (Req 4.2)
 *   - Default the Background_Color to white when none is selected. (Req 4.3)
 *   - Require at least one loaded Source_Image; otherwise show
 *     non-blocking guidance and produce no Combined_Image.         (Req 4.6)
 *   - Draw each placement (front-then-back) onto the preview canvas,
 *     filling all uncovered areas with the Background_Color.       (Req 4.5)
 *   - Replace the empty-state placeholder with the Combined_Image. (Req 4.7)
 *   - Drive a non-decreasing progress value 0 -> 100.              (Req 9.2, 9.3)
 *   - Enable / reveal the Combined-PDF export control.             (Req 4.8)
 *
 * All collaborators (appState store, messages, progress, DOM elements, and the
 * pure functions) are injected through the factory so the controller can be
 * exercised under jsdom without reaching for globals.
 *
 * Validates: Requirements 4.2, 4.3, 4.6, 4.7, 4.8, 9.2, 9.3
 */

import { computeLayout as defaultComputeLayout } from '../core/combineLayout.js';
import { validateSpacing as defaultValidateSpacing } from '../core/validation.js';

/** Class used throughout the markup to hide an element. */
const HIDDEN_CLASS = 'hidden';

/** Default Background_Color when the user has selected none (Req 4.3). */
const DEFAULT_BACKGROUND_COLOR = '#ffffff';

/** Guidance shown when a combine is requested with no loaded source (Req 4.6). */
const NO_SOURCE_MESSAGE = 'At least one image is required to combine.';

/**
 * Resolve a DOM element from the supplied elements map, falling back to a
 * lookup by id against the provided document.
 *
 * @param {object} elements - explicit element overrides (for tests).
 * @param {string} key - property name in the elements map.
 * @param {Document|undefined} doc - document used for id lookup.
 * @param {string} id - element id in the markup.
 * @returns {Element|null}
 */
function resolveElement(elements, key, doc, id) {
  if (elements && elements[key]) return elements[key];
  if (doc && typeof doc.getElementById === 'function') {
    return doc.getElementById(id);
  }
  return null;
}

/**
 * Build the ordered list of loaded source slots (front then back). A slot is
 * "loaded" only when it carries an image; empty slots are dropped so the
 * ≥ 1-source guard (Req 4.6) and the layout reflect reality.
 *
 * @param {object} state - the current application state.
 * @returns {object[]} loaded slots in front-then-back order.
 */
function loadedSlots(state) {
  const sources = state && state.sources ? state.sources : {};
  return [sources.front, sources.back].filter(
    (slot) => slot && slot.image != null,
  );
}

/**
 * Create the combine controller.
 *
 * @param {object} deps
 * @param {object} deps.appState - the appState store (getState/setSpacing/...).
 * @param {object} deps.messages - message controller (showGuidance/showError/clearMessage).
 * @param {object} deps.progress - progress controller (begin/set/complete/fail).
 * @param {object} [deps.elements] - explicit DOM element overrides (for tests).
 * @param {Document} [deps.document] - document used for id lookups.
 * @param {Function} [deps.computeLayout] - override for the pure layout fn.
 * @param {Function} [deps.validateSpacing] - override for the pure spacing fn.
 * @returns {{
 *   init: () => void,
 *   destroy: () => void,
 *   handleCombine: () => boolean,
 *   handleSpacingChange: () => boolean,
 *   handleBackgroundChange: () => void
 * }}
 */
export function createCombineController(deps = {}) {
  const {
    appState,
    messages,
    progress,
    elements = {},
    document: doc = typeof document !== 'undefined' ? document : undefined,
    computeLayout = defaultComputeLayout,
    validateSpacing = defaultValidateSpacing,
  } = deps;

  if (!appState) throw new Error('createCombineController requires an appState store');
  if (!messages) throw new Error('createCombineController requires a messages controller');
  if (!progress) throw new Error('createCombineController requires a progress controller');

  const combineButton = resolveElement(elements, 'combineButton', doc, 'combine');
  const spacingInput = resolveElement(elements, 'spacingInput', doc, 'spacing');
  const backgroundInput = resolveElement(elements, 'backgroundInput', doc, 'bgcolor');
  const previewCanvas = resolveElement(elements, 'previewCanvas', doc, 'previewCanvas');
  const previewPlaceholder = resolveElement(
    elements,
    'previewPlaceholder',
    doc,
    'previewCanvasPlaceholder',
  );
  const exportButton = resolveElement(elements, 'exportButton', doc, 'downloadPdf');

  // -------------------------------------------------------------------------
  // Spacing handling (Req 4.1, 4.2)
  // -------------------------------------------------------------------------

  /**
   * Read and validate the spacing input against the previously accepted value.
   * On acceptance the value is committed to state and any prior message is
   * cleared. On rejection a message is shown and the input is restored to the
   * previously accepted value (Req 4.2).
   *
   * @returns {boolean} true when the entered value was accepted.
   */
  function handleSpacingChange() {
    const previous = appState.getState().settings.spacing;
    const raw = spacingInput ? spacingInput.value : previous;
    const result = validateSpacing(raw, previous);

    if (!result.ok) {
      // Reject: retain the previously accepted value and surface the range message.
      if (spacingInput) spacingInput.value = String(result.value);
      messages.showError(result.message);
      return false;
    }

    appState.setSpacing(result.value);
    if (spacingInput) spacingInput.value = String(result.value);
    messages.clearMessage();
    return true;
  }

  /**
   * Resolve the spacing to use for a combine. Validates the current input;
   * when invalid, the previously accepted value is retained and used so a bad
   * keystroke never blocks combining with the last good value (Req 4.2).
   *
   * @returns {number} the spacing value to lay out with.
   */
  function resolveSpacing() {
    handleSpacingChange();
    return appState.getState().settings.spacing;
  }

  // -------------------------------------------------------------------------
  // Background handling (Req 4.3)
  // -------------------------------------------------------------------------

  /**
   * Read the background-color input, defaulting to white when none is set, and
   * commit it to state (Req 4.3).
   */
  function handleBackgroundChange() {
    const raw = backgroundInput ? backgroundInput.value : '';
    const color = typeof raw === 'string' && raw.length > 0 ? raw : DEFAULT_BACKGROUND_COLOR;
    appState.setBackgroundColor(color);
    return color;
  }

  function resolveBackgroundColor() {
    handleBackgroundChange();
    const stored = appState.getState().settings.backgroundColor;
    return typeof stored === 'string' && stored.length > 0
      ? stored
      : DEFAULT_BACKGROUND_COLOR;
  }

  // -------------------------------------------------------------------------
  // Canvas drawing (Req 4.5, 4.7)
  // -------------------------------------------------------------------------

  /**
   * Paint the computed layout onto the preview canvas: size the canvas, fill it
   * entirely with the background (so every uncovered area — including the gaps
   * between images — shows the Background_Color, Req 4.5), then draw each
   * placement's cropped source rectangle into its destination rectangle in
   * front-then-back order.
   *
   * @param {object} layout - the result of computeLayout.
   * @param {(progress: number) => void} [onProgress] - per-placement progress hook.
   */
  function drawLayout(layout, onProgress) {
    if (!previewCanvas) return;
    const width = Math.max(1, Math.round(layout.targetWidth));
    const height = Math.max(1, Math.round(layout.totalHeight));
    previewCanvas.width = width;
    previewCanvas.height = height;

    const ctx = previewCanvas.getContext && previewCanvas.getContext('2d');
    if (!ctx) return;

    // Fill the whole canvas with the background first so all areas not covered
    // by a source image (top/bottom edges and the inter-image gaps) are filled.
    ctx.fillStyle = layout.backgroundColor || DEFAULT_BACKGROUND_COLOR;
    ctx.fillRect(0, 0, width, height);

    const total = layout.placements.length || 1;
    layout.placements.forEach((placement, index) => {
      const img = placement.src && placement.src.image;
      const { srcRect, dstRect } = placement;
      if (img && srcRect.w > 0 && srcRect.h > 0 && dstRect.w > 0 && dstRect.h > 0) {
        ctx.drawImage(
          img,
          srcRect.x,
          srcRect.y,
          srcRect.w,
          srcRect.h,
          dstRect.x,
          dstRect.y,
          dstRect.w,
          dstRect.h,
        );
      }
      if (typeof onProgress === 'function') {
        // Map placement completion across the 40 -> 90 progress band.
        onProgress(40 + Math.round(((index + 1) / total) * 50));
      }
    });
  }

  /**
   * Reveal the combined image: unhide the canvas and hide the empty-state
   * placeholder (Req 4.7).
   */
  function revealCombinedPreview() {
    if (previewCanvas && previewCanvas.classList) {
      previewCanvas.classList.remove(HIDDEN_CLASS);
    }
    if (previewPlaceholder && previewPlaceholder.classList) {
      previewPlaceholder.classList.add(HIDDEN_CLASS);
    }
  }

  /**
   * Enable / reveal the Combined-PDF export control and record its visibility
   * in state (Req 4.8).
   */
  function enableExport() {
    if (exportButton) {
      if (exportButton.classList) exportButton.classList.remove(HIDDEN_CLASS);
      exportButton.disabled = false;
    }
    if (typeof appState.setExportCombinedVisible === 'function') {
      appState.setExportCombinedVisible(true);
    }
  }

  // -------------------------------------------------------------------------
  // Combine (Req 4.4–4.8, 9.2, 9.3)
  // -------------------------------------------------------------------------

  /**
   * Produce the Combined_Image from the currently loaded sources.
   *
   * @returns {boolean} true when a Combined_Image was produced.
   */
  function handleCombine() {
    const state = appState.getState();
    const slots = loadedSlots(state);

    // Req 4.6: require at least one loaded source; otherwise guide and stop.
    if (slots.length === 0) {
      messages.showGuidance(NO_SOURCE_MESSAGE);
      return false;
    }

    const spacing = resolveSpacing();
    const backgroundColor = resolveBackgroundColor();

    try {
      // Req 9.5/9.2: begin a fresh operation at 0% and advance monotonically.
      progress.begin();
      progress.set(15);

      const layout = computeLayout(slots, spacing, backgroundColor);
      progress.set(40);

      drawLayout(layout, (p) => progress.set(p));

      // Commit the combined buffer (the preview canvas backs it).
      if (typeof appState.setCombinedImage === 'function') {
        appState.setCombinedImage(previewCanvas || layout);
      }

      // Req 4.7: replace the placeholder with the rendered preview.
      revealCombinedPreview();
      // Req 4.8: enable the Combined-PDF export control.
      enableExport();
      messages.clearMessage();

      // Req 9.3: completion drives the indicator to 100% then hides it.
      progress.complete();
      return true;
    } catch (err) {
      // Req 9.6 / 12.5/12.6: surface a non-blocking failure, hide progress,
      // and leave existing state untouched rather than letting the error escape.
      progress.fail();
      messages.showError(
        err && err.message
          ? `Combine failed: ${err.message}`
          : 'Combine failed. Please try again.',
      );
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Wiring
  // -------------------------------------------------------------------------

  function onCombineClick() {
    handleCombine();
  }
  function onSpacingChange() {
    handleSpacingChange();
  }
  function onBackgroundChange() {
    handleBackgroundChange();
  }

  /** Attach DOM event listeners. */
  function init() {
    if (combineButton) combineButton.addEventListener('click', onCombineClick);
    if (spacingInput) spacingInput.addEventListener('change', onSpacingChange);
    if (backgroundInput) backgroundInput.addEventListener('change', onBackgroundChange);
  }

  /** Detach DOM event listeners. */
  function destroy() {
    if (combineButton) combineButton.removeEventListener('click', onCombineClick);
    if (spacingInput) spacingInput.removeEventListener('change', onSpacingChange);
    if (backgroundInput) backgroundInput.removeEventListener('change', onBackgroundChange);
  }

  return {
    init,
    destroy,
    handleCombine,
    handleSpacingChange,
    handleBackgroundChange,
  };
}

export default createCombineController;
