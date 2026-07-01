/**
 * appState.js — single source of truth for NID Stack & Enhance.
 *
 * This is a PURE ES module: it never touches the DOM. It models the
 * application state (source images, crop regions, combine settings,
 * adjustment values, filter selection, derived buffers, and the UI flags
 * for export-control visibility and the progress indicator) and exposes
 * `getState`, mutation helpers, `reset()`, and an operation wrapper that
 * preserves the prior state unchanged whenever an operation reports an error.
 *
 * Design references:
 *   - Data Models / Default State (design.md)
 *   - Requirements 8.1–8.5 (reset/clear to documented defaults)
 *   - Requirement 12.5 (state preservation on reported error)
 */

// ---------------------------------------------------------------------------
// Documented default constants (Requirement 8.4)
// ---------------------------------------------------------------------------

export const DEFAULT_SPACING = 10;
export const DEFAULT_BACKGROUND_COLOR = '#ffffff';
export const DEFAULT_BRIGHTNESS = 100;
export const DEFAULT_CONTRAST = 100;
export const DEFAULT_SATURATION = 100;
export const DEFAULT_SHARPNESS = 0;
export const DEFAULT_FILTER = 'none';

/** Valid filter selections (Requirement 6.1). */
export const FILTER_NAMES = Object.freeze(['none', 'lighten', 'document', 'grayscale']);

/** Valid source-slot keys. */
export const SLOTS = Object.freeze(['front', 'back']);

// ---------------------------------------------------------------------------
// Factory helpers for the documented default shape
// ---------------------------------------------------------------------------

/**
 * Create an empty source slot.
 * @returns {{image: null, naturalWidth: number, naturalHeight: number, crop: null}}
 */
export function createSourceSlot() {
  return {
    image: null,
    naturalWidth: 0,
    naturalHeight: 0,
    crop: null,
  };
}

/**
 * Create the documented default application state.
 *
 * No sources, no crops, no combined/adjusted buffers; spacing 10,
 * background #ffffff, brightness/contrast/saturation 100, sharpness 0,
 * filter "none"; both PDF export controls hidden; progress hidden with
 * no partial value (Requirements 8.1–8.4).
 *
 * @returns {AppState}
 */
export function createDefaultState() {
  return {
    sources: {
      front: createSourceSlot(),
      back: createSourceSlot(),
    },
    settings: {
      spacing: DEFAULT_SPACING,
      backgroundColor: DEFAULT_BACKGROUND_COLOR,
    },
    adjustments: {
      brightness: DEFAULT_BRIGHTNESS,
      contrast: DEFAULT_CONTRAST,
      saturation: DEFAULT_SATURATION,
      sharpness: DEFAULT_SHARPNESS,
    },
    filter: DEFAULT_FILTER,
    combinedImage: null,
    adjustedBase: null,
    adjustedImage: null,
    ui: {
      exportCombinedVisible: false,
      exportAdjustedVisible: false,
      progressVisible: false,
      progressValue: null, // null => no partial value displayed
    },
  };
}

// ---------------------------------------------------------------------------
// Deep clone that preserves non-plain object references (e.g. images/canvases)
// ---------------------------------------------------------------------------

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Deep-clone the plain-data portions of a state object while passing through
 * references to non-plain objects (image elements, canvases, bitmaps). This
 * keeps state snapshots independent for plain values without attempting to
 * copy un-cloneable host objects.
 *
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function cloneState(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneState(item));
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = cloneState(value[key]);
    }
    return out;
  }
  // Primitives, null, and host objects (images/canvases) are passed through.
  return value;
}

// ---------------------------------------------------------------------------
// Operation wrapper (Requirement 12.5 / Property 15)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} OperationFailure
 * @property {false} ok
 * @property {string} [message]
 */

/**
 * @typedef {Object} OperationSuccess
 * @property {true} ok
 * @property {AppState} [state] Next state. When omitted the prior state is kept.
 */

/**
 * Run an operation against a state snapshot, preserving the prior state
 * unchanged whenever the operation reports an error.
 *
 * The `operation` receives a clone of the current state and must return:
 *   - `{ ok: false, ... }` to report an error (prior state is kept), or
 *   - `{ ok: true, state }` to commit a new state, or
 *   - a bare next-state object (treated as success).
 *
 * If the operation throws, that is also treated as a reported error and the
 * prior state is returned unchanged.
 *
 * @param {AppState} state Current state.
 * @param {(draft: AppState) => OperationSuccess|OperationFailure|AppState} operation
 * @returns {{ok: boolean, state: AppState, error: (OperationFailure|null)}}
 */
export function runOperation(state, operation) {
  const prior = state;
  let result;
  try {
    result = operation(cloneState(prior));
  } catch (err) {
    // A thrown error is a reported error: keep prior state unchanged.
    return {
      ok: false,
      state: prior,
      error: { ok: false, message: err && err.message ? err.message : String(err) },
    };
  }

  if (result && result.ok === false) {
    // Explicit failure: prior state is retained unchanged (Req 12.5).
    return { ok: false, state: prior, error: result };
  }

  // Success: either { ok: true, state } or a bare next-state object.
  const next =
    result && typeof result === 'object' && 'state' in result && result.state
      ? result.state
      : result && result.ok === true
        ? prior // ok:true with no state => no change
        : result;

  return { ok: true, state: next || prior, error: null };
}

// ---------------------------------------------------------------------------
// Store: single source of truth with getState, mutation helpers, reset
// ---------------------------------------------------------------------------

function assertSlot(slot) {
  if (!SLOTS.includes(slot)) {
    throw new Error(`Unknown source slot: ${String(slot)}`);
  }
}

/**
 * Create an application-state store.
 *
 * @param {AppState} [initialState] Optional starting state (deep-cloned).
 * @returns {AppStateStore}
 */
export function createAppState(initialState) {
  let state = initialState ? cloneState(initialState) : createDefaultState();

  const store = {
    /** @returns {AppState} the current state. */
    getState() {
      return state;
    },

    /**
     * Replace the entire state (deep-cloned).
     * @param {AppState} next
     * @returns {AppState}
     */
    setState(next) {
      state = cloneState(next);
      return state;
    },

    /**
     * Reset to the documented default state (Requirements 8.1–8.5).
     * Discards all sources, crops, combined/adjusted buffers; restores
     * default settings/adjustments/filter; hides export controls; resets
     * the progress indicator to hidden with no partial value.
     * @returns {AppState}
     */
    reset() {
      state = createDefaultState();
      return state;
    },

    // --- Source mutations -------------------------------------------------

    /**
     * Set a source slot's image and dimensions, clearing that slot's crop
     * (a freshly loaded image starts with no stored crop region).
     * @param {('front'|'back')} slot
     * @param {{image: any, naturalWidth: number, naturalHeight: number}} data
     * @returns {AppState}
     */
    setSource(slot, data) {
      assertSlot(slot);
      state.sources[slot] = {
        image: data ? data.image : null,
        naturalWidth: data ? data.naturalWidth || 0 : 0,
        naturalHeight: data ? data.naturalHeight || 0 : 0,
        crop: null,
      };
      return state;
    },

    /**
     * Clear a single source slot back to empty.
     * @param {('front'|'back')} slot
     * @returns {AppState}
     */
    clearSource(slot) {
      assertSlot(slot);
      state.sources[slot] = createSourceSlot();
      return state;
    },

    /**
     * Store a crop region (original image pixel coordinates) for a slot.
     * @param {('front'|'back')} slot
     * @param {{x:number,y:number,w:number,h:number}|null} crop
     * @returns {AppState}
     */
    setCrop(slot, crop) {
      assertSlot(slot);
      state.sources[slot].crop = crop ? { ...crop } : null;
      return state;
    },

    // --- Combine settings -------------------------------------------------

    /**
     * Set the accepted spacing value (validation happens elsewhere).
     * @param {number} value
     * @returns {AppState}
     */
    setSpacing(value) {
      state.settings.spacing = value;
      return state;
    },

    /**
     * Set the background color.
     * @param {string} color
     * @returns {AppState}
     */
    setBackgroundColor(color) {
      state.settings.backgroundColor = color;
      return state;
    },

    // --- Adjustments ------------------------------------------------------

    /**
     * Set a single adjustment value (clamping happens elsewhere).
     * @param {('brightness'|'contrast'|'saturation'|'sharpness')} key
     * @param {number} value
     * @returns {AppState}
     */
    setAdjustment(key, value) {
      if (!(key in state.adjustments)) {
        throw new Error(`Unknown adjustment: ${String(key)}`);
      }
      state.adjustments[key] = value;
      return state;
    },

    // --- Filter -----------------------------------------------------------

    /**
     * Set the selected filter.
     * @param {('none'|'lighten'|'document'|'grayscale')} name
     * @returns {AppState}
     */
    setFilter(name) {
      if (!FILTER_NAMES.includes(name)) {
        throw new Error(`Unknown filter: ${String(name)}`);
      }
      state.filter = name;
      return state;
    },

    // --- Derived buffers --------------------------------------------------

    /**
     * Set the combined-image buffer (or null to clear).
     * @param {any} image
     * @returns {AppState}
     */
    setCombinedImage(image) {
      state.combinedImage = image || null;
      return state;
    },

    /**
     * Set the unfiltered adjusted-base buffer (or null to clear).
     * @param {any} image
     * @returns {AppState}
     */
    setAdjustedBase(image) {
      state.adjustedBase = image || null;
      return state;
    },

    /**
     * Set the adjusted (+ current filter) image buffer (or null to clear).
     * @param {any} image
     * @returns {AppState}
     */
    setAdjustedImage(image) {
      state.adjustedImage = image || null;
      return state;
    },

    // --- UI flags ---------------------------------------------------------

    /**
     * Set visibility of the Combined-image PDF export control.
     * @param {boolean} visible
     * @returns {AppState}
     */
    setExportCombinedVisible(visible) {
      state.ui.exportCombinedVisible = Boolean(visible);
      return state;
    },

    /**
     * Set visibility of the Adjusted-image PDF export control.
     * @param {boolean} visible
     * @returns {AppState}
     */
    setExportAdjustedVisible(visible) {
      state.ui.exportAdjustedVisible = Boolean(visible);
      return state;
    },

    /**
     * Set the progress-indicator visibility and value.
     * @param {boolean} visible
     * @param {(number|null)} [value] partial progress (null => no value)
     * @returns {AppState}
     */
    setProgress(visible, value = null) {
      state.ui.progressVisible = Boolean(visible);
      state.ui.progressValue = visible ? value : null;
      return state;
    },

    // --- Operation wrapper ------------------------------------------------

    /**
     * Run an operation against the current state, committing its result on
     * success and leaving the current state unchanged on a reported error
     * (Requirement 12.5).
     *
     * @param {(draft: AppState) => OperationSuccess|OperationFailure|AppState} operation
     * @returns {{ok: boolean, state: AppState, error: (OperationFailure|null)}}
     */
    runOperation(operation) {
      const result = runOperation(state, operation);
      state = result.state;
      return result;
    },
  };

  return store;
}

/**
 * @typedef {Object} AppState
 * @property {{front: any, back: any}} sources
 * @property {{spacing: number, backgroundColor: string}} settings
 * @property {{brightness: number, contrast: number, saturation: number, sharpness: number}} adjustments
 * @property {('none'|'lighten'|'document'|'grayscale')} filter
 * @property {any} combinedImage
 * @property {any} adjustedBase
 * @property {any} adjustedImage
 * @property {{exportCombinedVisible: boolean, exportAdjustedVisible: boolean, progressVisible: boolean, progressValue: (number|null)}} ui
 */

/**
 * @typedef {ReturnType<typeof createAppState>} AppStateStore
 */

export default createAppState;
