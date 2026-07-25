/**
 * filterController.js — DOM glue for the Filter_Engine.
 *
 * Wires the filter controls (a <select> with None/Lighten/Document/Grayscale,
 * an Apply button, and a Reset button) to the pure `applyFilter` transform in
 * `../core/filters.js`, and renders the result onto the Adjusted Preview canvas.
 *
 * Core behavior (design.md "Filter Component", Req 6.2–6.6):
 *   - A persistent UNFILTERED adjusted base buffer (`appState.adjustedBase`) is
 *     the source for every filter application. Selecting a different filter
 *     always applies the new filter to that base rather than to the currently
 *     filtered preview, so filters NEVER compound (Req 6.3).
 *   - None and Reset both restore the Adjusted Preview to the unfiltered base
 *     exactly (Req 6.5, 6.6).
 *   - Filters update the preview within the time bounds (Req 6.2 ≤ 2 s) — the
 *     transform is synchronous, so the bound is met trivially.
 *   - When no Adjusted_Image exists, selecting/applying/resetting a filter shows
 *     a NON-BLOCKING guidance message visible for at least 3 s (no alert) and
 *     changes nothing (fixes D5; Req 6.4).
 *
 * All collaborators (appState store, message controller, DOM elements) are
 * injected through the factory so the controller is fully testable under jsdom.
 *
 * Requirements: 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { applyFilter, FILTER_NAMES } from '../core/filters.js';

/** Guidance shown when a filter is used with no Adjusted_Image (D5, Req 6.4). */
export const NO_ADJUSTED_IMAGE_GUIDANCE =
  'Apply adjustments to the combined image before using a filter.';

/** Minimum time (ms) the filter guidance must remain visible (Req 6.4). */
export const FILTER_GUIDANCE_MIN_VISIBLE_MS = 3000;

/** CSS class toggled to reveal the adjusted canvas (markup ships it hidden). */
const HIDDEN_CLASS = 'hidden';

/**
 * Normalize an arbitrary filter selection to one of the four supported names,
 * falling back to 'none' so the controller is total and never throws (Req 6.1).
 * @param {string} name
 * @returns {('none'|'lighten'|'document'|'grayscale')}
 */
function normalizeFilterName(name) {
  const n = typeof name === 'string' ? name.trim().toLowerCase() : '';
  return FILTER_NAMES.includes(n) ? n : 'none';
}

/**
 * Create a Filter_Engine controller bound to injected collaborators.
 *
 * @param {Object} options
 * @param {import('../core/appState.js').AppStateStore} options.appState - state store.
 * @param {{showGuidance: Function, showError: Function, clearMessage: Function}} options.messages -
 *   non-blocking message controller (messages.js).
 * @param {HTMLSelectElement|null} [options.filterSelect] - the filter <select>.
 * @param {HTMLElement|null} [options.applyButton] - the Apply button.
 * @param {HTMLElement|null} [options.resetButton] - the Reset button.
 * @param {HTMLCanvasElement|null} [options.adjustedCanvas] - the Adjusted Preview canvas.
 * @returns {{
 *   init: () => void,
 *   destroy: () => void,
 *   selectFilter: (name?: string) => {ok: boolean, filter?: string},
 *   applyCurrentFilter: () => {ok: boolean, filter?: string},
 *   reset: () => {ok: boolean, filter?: string},
 *   hasAdjustedImage: () => boolean
 * }}
 */
export function createFilterController(options = {}) {
  const {
    appState,
    messages,
    filterSelect = null,
    applyButton = null,
    resetButton = null,
    adjustedCanvas = null,
  } = options;

  if (!appState || typeof appState.getState !== 'function') {
    throw new Error('createFilterController requires an appState store');
  }
  if (!messages || typeof messages.showGuidance !== 'function') {
    throw new Error('createFilterController requires a messages controller');
  }

  /**
   * Read the UNFILTERED adjusted base as {data, width, height}, or null when no
   * Adjusted_Image exists. Accepts either an ImageData-like object or a
   * canvas-like element as the base buffer.
   * Falls back to combinedImage if adjustedBase is not available.
   * @returns {{data: ArrayLike<number>, width: number, height: number}|null}
   */
  function readBasePixels() {
    const state = appState.getState();
    const base = state ? (state.adjustedBase || state.combinedImage) : null;
    if (!base) return null;

    // ImageData-like: { data, width, height }.
    if (
      base.data &&
      Number.isFinite(base.width) &&
      Number.isFinite(base.height) &&
      base.width > 0 &&
      base.height > 0
    ) {
      return { data: base.data, width: base.width, height: base.height };
    }

    // Canvas-like: pull pixels out of the 2D context.
    if (typeof base.getContext === 'function') {
      const w = base.width;
      const h = base.height;
      if (!(w > 0 && h > 0)) return null;
      const ctx = base.getContext('2d');
      if (!ctx || typeof ctx.getImageData !== 'function') return null;
      const imageData = ctx.getImageData(0, 0, w, h);
      return { data: imageData.data, width: w, height: h };
    }

    return null;
  }

  /**
   * Whether an Adjusted_Image (unfiltered base) currently exists.
   * @returns {boolean}
   */
  function hasAdjustedImage() {
    return readBasePixels() !== null;
  }

  /**
   * Paint a filtered RGBA buffer onto the adjusted canvas and reveal it.
   * No-op when no usable canvas/context is available (e.g. jsdom without a
   * canvas backend) so the controller stays robust.
   * @param {ArrayLike<number>} rgba
   * @param {number} width
   * @param {number} height
   */
  function drawToCanvas(rgba, width, height) {
    if (!adjustedCanvas || typeof adjustedCanvas.getContext !== 'function') return;
    const ctx = adjustedCanvas.getContext('2d');
    if (!ctx || typeof ctx.putImageData !== 'function') return;

    adjustedCanvas.width = width;
    adjustedCanvas.height = height;

    let imageData = null;
    if (typeof ctx.createImageData === 'function') {
      imageData = ctx.createImageData(width, height);
      imageData.data.set(rgba);
    } else if (typeof ImageData !== 'undefined') {
      imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
    } else {
      return;
    }

    ctx.putImageData(imageData, 0, 0);
    if (adjustedCanvas.classList) {
      adjustedCanvas.classList.remove(HIDDEN_CLASS);
    }
  }

  /**
   * Apply a named filter to the unfiltered adjusted base and render the result.
   *
   * CRITICAL: the filter is ALWAYS applied to the unfiltered base buffer, never
   * to the currently displayed (already-filtered) preview, so repeated filter
   * switches never compound (Req 6.3). When no base exists, this shows
   * non-blocking guidance (≥ 3 s) and changes nothing (D5, Req 6.4).
   *
   * @param {string} name
   * @returns {{ok: boolean, filter?: string}}
   */
  function applyNamedFilter(name) {
    const base = readBasePixels();
    if (!base) {
      messages.showGuidance(NO_ADJUSTED_IMAGE_GUIDANCE, {
        minVisibleMs: FILTER_GUIDANCE_MIN_VISIBLE_MS,
      });
      return { ok: false };
    }

    const filterName = normalizeFilterName(name);
    // Always transform the UNFILTERED base; applyFilter never mutates it.
    const filtered = applyFilter(filterName, base.data, base.width, base.height);

    drawToCanvas(filtered, base.width, base.height);

    if (typeof appState.setFilter === 'function') {
      appState.setFilter(filterName);
    }
    if (typeof appState.setAdjustedImage === 'function') {
      // Store the filtered result (None yields pixels identical to the base).
      appState.setAdjustedImage({
        data: filtered,
        width: base.width,
        height: base.height,
      });
    }

    return { ok: true, filter: filterName };
  }

  /**
   * Apply the filter currently chosen in the <select> (Req 6.2).
   * @returns {{ok: boolean, filter?: string}}
   */
  function applyCurrentFilter() {
    const name = filterSelect ? filterSelect.value : appState.getState().filter;
    return applyNamedFilter(name);
  }

  /**
   * Handle a change in the filter <select>: apply the newly selected filter to
   * the unfiltered base (Req 6.2, 6.3).
   * @param {string} [name]
   * @returns {{ok: boolean, filter?: string}}
   */
  function selectFilter(name) {
    const chosen = name !== undefined ? name : filterSelect ? filterSelect.value : 'none';
    return applyNamedFilter(chosen);
  }

  /**
   * Reset the filter: restore the Adjusted Preview to the unfiltered base by
   * applying None, and return the <select> to None (Req 6.5, 6.6). When no base
   * exists, shows guidance and changes nothing.
   * @returns {{ok: boolean, filter?: string}}
   */
  function reset() {
    const base = readBasePixels();
    if (!base) {
      messages.showGuidance(NO_ADJUSTED_IMAGE_GUIDANCE, {
        minVisibleMs: FILTER_GUIDANCE_MIN_VISIBLE_MS,
      });
      return { ok: false };
    }
    if (filterSelect) {
      filterSelect.value = 'none';
    }
    return applyNamedFilter('none');
  }

  // --- Event wiring (wrapped so handler errors never escape) ---------------

  function safe(fn) {
    return function handler(event) {
      try {
        return fn(event);
      } catch (err) {
        if (typeof messages.showError === 'function') {
          messages.showError('Could not apply the filter. Please try again.');
        }
        return undefined;
      }
    };
  }

  const onSelectChange = safe(() => selectFilter());
  const onApplyClick = safe(() => applyCurrentFilter());
  const onResetClick = safe(() => reset());

  /** Attach DOM event listeners. */
  function init() {
    if (filterSelect && typeof filterSelect.addEventListener === 'function') {
      filterSelect.addEventListener('change', onSelectChange);
    }
    if (applyButton && typeof applyButton.addEventListener === 'function') {
      applyButton.addEventListener('click', onApplyClick);
    }
    if (resetButton && typeof resetButton.addEventListener === 'function') {
      resetButton.addEventListener('click', onResetClick);
    }
  }

  /** Detach DOM event listeners. */
  function destroy() {
    if (filterSelect && typeof filterSelect.removeEventListener === 'function') {
      filterSelect.removeEventListener('change', onSelectChange);
    }
    if (applyButton && typeof applyButton.removeEventListener === 'function') {
      applyButton.removeEventListener('click', onApplyClick);
    }
    if (resetButton && typeof resetButton.removeEventListener === 'function') {
      resetButton.removeEventListener('click', onResetClick);
    }
  }

  return {
    init,
    destroy,
    selectFilter,
    applyCurrentFilter,
    reset,
    hasAdjustedImage,
  };
}

/**
 * Initialize a filter controller by resolving DOM elements from a document by
 * id, mirroring the init-style surface of the other controllers.
 *
 * @param {Document} doc - the document to resolve element ids against.
 * @param {{appState: any, messages: any}} deps - injected collaborators.
 * @returns {ReturnType<typeof createFilterController>}
 */
export function initFilterController(doc, deps = {}) {
  if (!doc || typeof doc.getElementById !== 'function') {
    throw new Error('initFilterController requires a document');
  }
  const controller = createFilterController({
    appState: deps.appState,
    messages: deps.messages,
    filterSelect: doc.getElementById('filterSelect'),
    applyButton: doc.getElementById('applyFilter'),
    resetButton: doc.getElementById('resetFilter'),
    adjustedCanvas: doc.getElementById('adjustedCanvas'),
  });
  controller.init();
  return controller;
}

export default createFilterController;
