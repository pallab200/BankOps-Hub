/**
 * resetController.js — DOM glue for the Clear/Reset control.
 *
 * Wires the "Clear All" button to appState.reset() and restores the DOM to the
 * pre-load empty-state appearance. This is a thin controller: all state logic
 * lives in appState.reset() and the progress controller's reset(). This module
 * only drives the DOM transitions that reflect the cleared state.
 *
 * Responsibilities (design.md "ResetController"):
 *   - Call appState.reset() to discard all sources, crops, combined/adjusted
 *     images, and restore default settings.                     (Req 8.1, 8.4)
 *   - Restore both upload cards, thumbnails, and preview areas to their
 *     pre-load empty-state placeholders.                        (Req 8.2)
 *   - Hide both the Combined PDF export control and the Adjusted PDF export
 *     control.                                                  (Req 8.3)
 *   - Reset the Progress_Indicator to its hidden state.         (Req 8.3)
 *   - Must work with zero uncaught errors when no source is loaded. (Req 8.5)
 *   - All wrapped in try/catch.                                 (Req 12.6)
 *
 * All collaborators are injected through the factory so the controller is
 * exercisable under jsdom without reaching for globals.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */

/** CSS class used throughout the markup to hide an element. */
const HIDDEN_CLASS = 'hidden';

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
 * Create the reset controller.
 *
 * @param {object} deps
 * @param {import('../core/appState.js').AppStateStore} deps.appState - State store.
 * @param {{reset: () => void}} deps.progress - Progress controller.
 * @param {{clearMessage?: () => void}} [deps.messages] - Message controller.
 * @param {object} [deps.elements] - Explicit DOM element overrides (for tests).
 * @param {Document} [deps.document] - Document used for id lookups.
 * @returns {{
 *   init: () => void,
 *   destroy: () => void,
 *   handleReset: () => void
 * }}
 */
export function createResetController(deps = {}) {
  const {
    appState,
    progress,
    messages = {},
    elements = {},
    document: doc = typeof document !== 'undefined' ? document : undefined,
  } = deps;

  if (!appState || typeof appState.reset !== 'function') {
    throw new Error('createResetController requires an appState store');
  }
  if (!progress || typeof progress.reset !== 'function') {
    throw new Error('createResetController requires a progress controller');
  }

  // Resolve DOM elements
  const clearButton = resolveElement(elements, 'clearButton', doc, 'clear');

  // Upload card previews
  const preview1Container = resolveElement(elements, 'preview1Container', doc, 'preview1-container');
  const preview1Img = resolveElement(elements, 'preview1Img', doc, 'preview1');
  const preview2Container = resolveElement(elements, 'preview2Container', doc, 'preview2-container');
  const preview2Img = resolveElement(elements, 'preview2Img', doc, 'preview2');

  // Thumbnails and their placeholders
  const thumb1 = resolveElement(elements, 'thumb1', doc, 'thumb1');
  const thumb1Placeholder = resolveElement(elements, 'thumb1Placeholder', doc, 'thumb1Placeholder');
  const thumb2 = resolveElement(elements, 'thumb2', doc, 'thumb2');
  const thumb2Placeholder = resolveElement(elements, 'thumb2Placeholder', doc, 'thumb2Placeholder');

  // Crop info readouts
  const cropInfo1 = resolveElement(elements, 'cropInfo1', doc, 'cropInfo1');
  const cropInfo2 = resolveElement(elements, 'cropInfo2', doc, 'cropInfo2');

  // Combined preview
  const previewCanvas = resolveElement(elements, 'previewCanvas', doc, 'previewCanvas');
  const previewCanvasPlaceholder = resolveElement(
    elements,
    'previewCanvasPlaceholder',
    doc,
    'previewCanvasPlaceholder',
  );

  // Adjusted preview
  const adjustedCanvas = resolveElement(elements, 'adjustedCanvas', doc, 'adjustedCanvas');
  const adjustedCanvasPlaceholder = resolveElement(
    elements,
    'adjustedCanvasPlaceholder',
    doc,
    'adjustedCanvasPlaceholder',
  );

  // Export controls
  const exportCombinedBtn = resolveElement(elements, 'exportCombinedBtn', doc, 'downloadPdf');
  const exportAdjustedBtn = resolveElement(elements, 'exportAdjustedBtn', doc, 'downloadAdjPdf');

  // Combine settings controls
  const spacingInput = resolveElement(elements, 'spacingInput', doc, 'spacing');
  const bgcolorInput = resolveElement(elements, 'bgcolorInput', doc, 'bgcolor');

  // Adjustment sliders
  const adjBrightness = resolveElement(elements, 'adjBrightness', doc, 'adjBrightness');
  const adjContrast = resolveElement(elements, 'adjContrast', doc, 'adjContrast');
  const adjSaturation = resolveElement(elements, 'adjSaturation', doc, 'adjSaturation');
  const adjSharp = resolveElement(elements, 'adjSharp', doc, 'adjSharp');

  // Adjustment value labels
  const adjBrightVal = resolveElement(elements, 'adjBrightVal', doc, 'adjBrightVal');
  const adjContrastVal = resolveElement(elements, 'adjContrastVal', doc, 'adjContrastVal');
  const adjSatVal = resolveElement(elements, 'adjSatVal', doc, 'adjSatVal');
  const adjSharpVal = resolveElement(elements, 'adjSharpVal', doc, 'adjSharpVal');

  // Filter select
  const filterSelect = resolveElement(elements, 'filterSelect', doc, 'filterSelect');

  // File inputs (need to reset their value)
  const fileInput1 = resolveElement(elements, 'fileInput1', doc, 'file1');
  const fileInput2 = resolveElement(elements, 'fileInput2', doc, 'file2');

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function hide(el) {
    if (el && el.classList) el.classList.add(HIDDEN_CLASS);
  }

  function show(el) {
    if (el && el.classList) el.classList.remove(HIDDEN_CLASS);
  }

  // -------------------------------------------------------------------------
  // Reset handler (Req 8.1–8.5)
  // -------------------------------------------------------------------------

  /**
   * Perform a full application reset. All actions are wrapped in try/catch
   * to guarantee zero uncaught errors (Req 8.5, 12.6).
   */
  function handleReset() {
    try {
      // 1. Reset application state to documented defaults (Req 8.1, 8.4)
      appState.reset();

      // 2. Restore upload card previews to empty-state (Req 8.2)
      // Front card
      if (preview1Img) preview1Img.removeAttribute('src');
      hide(preview1Container);

      // Back card
      if (preview2Img) preview2Img.removeAttribute('src');
      hide(preview2Container);

      // 3. Restore thumbnails to empty-state placeholders (Req 8.2)
      if (thumb1) {
        thumb1.removeAttribute('src');
        hide(thumb1);
      }
      show(thumb1Placeholder);

      if (thumb2) {
        thumb2.removeAttribute('src');
        hide(thumb2);
      }
      show(thumb2Placeholder);

      // 4. Clear crop info readouts
      if (cropInfo1) cropInfo1.textContent = '';
      if (cropInfo2) cropInfo2.textContent = '';

      // 5. Restore combined preview to placeholder (Req 8.2)
      hide(previewCanvas);
      if (previewCanvas && previewCanvas.getContext) {
        const ctx = previewCanvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      }
      show(previewCanvasPlaceholder);

      // 6. Restore adjusted preview to placeholder (Req 8.2)
      hide(adjustedCanvas);
      if (adjustedCanvas && adjustedCanvas.getContext) {
        const ctx = adjustedCanvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, adjustedCanvas.width, adjustedCanvas.height);
      }
      show(adjustedCanvasPlaceholder);

      // 7. Hide both export controls (Req 8.3)
      hide(exportCombinedBtn);
      hide(exportAdjustedBtn);

      // 8. Reset the progress indicator (Req 8.3)
      progress.reset();

      // 9. Reset combine settings UI to defaults (Req 8.4)
      if (spacingInput) spacingInput.value = '10';
      if (bgcolorInput) bgcolorInput.value = '#ffffff';

      // 10. Reset adjustment sliders to defaults (Req 8.4)
      if (adjBrightness) adjBrightness.value = '100';
      if (adjContrast) adjContrast.value = '100';
      if (adjSaturation) adjSaturation.value = '100';
      if (adjSharp) adjSharp.value = '0';

      // 11. Reset adjustment value labels to defaults
      if (adjBrightVal) adjBrightVal.textContent = '100%';
      if (adjContrastVal) adjContrastVal.textContent = '100%';
      if (adjSatVal) adjSatVal.textContent = '100%';
      if (adjSharpVal) adjSharpVal.textContent = '0';

      // 12. Reset filter selection to None (Req 8.4)
      if (filterSelect) filterSelect.value = 'none';

      // 13. Reset file inputs so re-selecting the same file triggers change
      if (fileInput1) fileInput1.value = '';
      if (fileInput2) fileInput2.value = '';

      // 14. Clear any displayed messages
      if (messages && typeof messages.clearMessage === 'function') {
        messages.clearMessage();
      }
    } catch (_err) {
      // Req 8.5 / 12.6: swallow any error so no uncaught script error escapes.
      // In a production scenario we could log this, but the requirement is zero
      // uncaught errors — the UI may already be in a partially reset state, which
      // is acceptable as long as no error propagates.
    }
  }

  // -------------------------------------------------------------------------
  // Wiring
  // -------------------------------------------------------------------------

  function onClearClick() {
    handleReset();
  }

  /** Attach the clear button event listener. */
  function init() {
    if (clearButton) {
      clearButton.addEventListener('click', onClearClick);
    }
  }

  /** Detach the clear button event listener. */
  function destroy() {
    if (clearButton) {
      clearButton.removeEventListener('click', onClearClick);
    }
  }

  return {
    init,
    destroy,
    handleReset,
  };
}

export default createResetController;
