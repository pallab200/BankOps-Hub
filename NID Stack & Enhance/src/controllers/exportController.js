/**
 * exportController.js — DOM glue for the PDF_Exporter (thin controller).
 *
 * Wires the PDF export buttons to the pure `fitImageToPage` core logic. It
 * contains no sizing math itself: it checks preconditions (source image exists,
 * jsPDF available), delegates layout to `pdfLayout.fitImageToPage`, builds
 * the single-page A4 portrait PDF, triggers the save dialog, and reports
 * failures without altering application state.
 *
 * Responsibilities (design.md "Export Component"):
 *   - Guard: if the requested source image (combined or adjusted) does not
 *     exist, show a named message identifying which image is needed and do
 *     not create a PDF.                                          (Req 7.6, 12.4)
 *   - Guard: if jsPDF is not available (window.jspdf), show "PDF export
 *     currently unavailable" and leave state unchanged.          (Req 7.7)
 *   - Build a single-page A4 portrait PDF (210 mm × 297 mm) using
 *     fitImageToPage for sizing with a uniform 12.7 mm margin.  (Req 7.1, 7.2, 7.3, 7.4)
 *   - Trigger the save dialog on success.                         (Req 7.5)
 *   - On generation failure, show "export failed" message and leave
 *     state unchanged.                                           (Req 7.8, 12.5)
 *   - All wrapped in try/catch routing to showError; never alter state on error.
 *
 * All collaborators (appState store, messages, DOM elements, and the pure
 * functions) are injected through the factory so the controller can be
 * exercised under jsdom without reaching for globals.
 *
 * Validates: Requirements 7.1, 7.2, 7.5, 7.6, 7.7, 7.8, 12.4, 12.5
 */

import { fitImageToPage, A4_PORTRAIT, DEFAULT_MARGIN_MM } from '../core/pdfLayout.js';
import { showError } from './messages.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Message shown when the combined image is not available for export (Req 7.6, 12.4). */
const NO_COMBINED_MESSAGE =
  'No combined image available to export. Please combine your images first.';

/** Message shown when the adjusted image is not available for export (Req 7.6, 12.4). */
const NO_ADJUSTED_MESSAGE =
  'No adjusted image available to export. Please apply adjustments first.';

/** Message shown when jsPDF library is unavailable (Req 7.7). */
const JSPDF_UNAVAILABLE_MESSAGE = 'PDF export currently unavailable.';

/** Message shown when PDF generation fails after library is loaded (Req 7.8). */
const EXPORT_FAILED_MESSAGE = 'PDF export failed. Please try again.';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
 * Get image data URL from a canvas element or an Image element.
 * Returns a base64 data URL string suitable for jsPDF addImage.
 *
 * @param {HTMLCanvasElement|HTMLImageElement|null} source
 * @returns {string|null}
 */
function getImageDataUrl(source) {
  if (!source) return null;

  // If it's a canvas, get the data URL directly.
  if (typeof source.toDataURL === 'function') {
    return source.toDataURL('image/png');
  }

  // If it's an Image or has a src, draw it to a temporary canvas.
  if (source.src || source.naturalWidth) {
    const canvas = document.createElement('canvas');
    const w = source.naturalWidth || source.width || 0;
    const h = source.naturalHeight || source.height || 0;
    if (w === 0 || h === 0) return null;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  }

  return null;
}

/**
 * Get the pixel dimensions (width, height) from a source image/canvas.
 *
 * @param {HTMLCanvasElement|HTMLImageElement|null} source
 * @returns {{ width: number, height: number } | null}
 */
function getImageDimensions(source) {
  if (!source) return null;
  const w = source.width || source.naturalWidth || 0;
  const h = source.height || source.naturalHeight || 0;
  if (w <= 0 || h <= 0) return null;
  return { width: w, height: h };
}

/**
 * Check whether the jsPDF constructor is available in the global scope.
 *
 * @param {Window|object} win - the window (or test stub) to check.
 * @returns {Function|null} The jsPDF constructor, or null if unavailable.
 */
function getJsPDFConstructor(win) {
  if (win && win.jspdf && typeof win.jspdf.jsPDF === 'function') {
    return win.jspdf.jsPDF;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the export controller.
 *
 * @param {object} deps
 * @param {object} deps.appState - the appState store (getState).
 * @param {object} [deps.messages] - message controller; if omitted the module-level showError is used.
 * @param {object} [deps.elements] - explicit DOM element overrides (for tests).
 * @param {Document} [deps.document] - document used for id lookups.
 * @param {Window|object} [deps.window] - window for jsPDF lookup and save.
 * @param {Function} [deps.fitImageToPage] - override for the pure layout fn.
 * @returns {{
 *   init: () => void,
 *   destroy: () => void,
 *   exportCombined: () => boolean,
 *   exportAdjusted: () => boolean
 * }}
 */
export function createExportController(deps = {}) {
  const {
    appState,
    messages: messagesDep,
    elements = {},
    document: doc = typeof document !== 'undefined' ? document : undefined,
    window: win = typeof window !== 'undefined' ? window : undefined,
    fitImageToPage: fitFn = fitImageToPage,
  } = deps;

  if (!appState) throw new Error('createExportController requires an appState store');

  // Message helpers — use injected message controller if provided, otherwise module-level.
  const msgShowError = messagesDep && typeof messagesDep.showError === 'function'
    ? messagesDep.showError.bind(messagesDep)
    : showError;

  // Resolve DOM elements for the two export buttons.
  const combinedExportBtn = resolveElement(
    elements, 'combinedExportButton', doc, 'downloadPdf',
  );
  const adjustedExportBtn = resolveElement(
    elements, 'adjustedExportButton', doc, 'downloadAdjPdf',
  );

  // -------------------------------------------------------------------------
  // Core export logic
  // -------------------------------------------------------------------------

  /**
   * Build and save a single-page A4 portrait PDF containing the given image.
   *
   * @param {HTMLCanvasElement|HTMLImageElement} sourceImage - the image to embed.
   * @param {string} filename - the suggested filename for the save dialog.
   * @returns {boolean} true when the PDF was saved successfully.
   */
  function buildAndSavePdf(sourceImage, filename) {
    // Req 7.7: Guard — check jsPDF availability.
    const JsPDF = getJsPDFConstructor(win);
    if (!JsPDF) {
      msgShowError(JSPDF_UNAVAILABLE_MESSAGE);
      return false;
    }

    // Get image dimensions for layout computation.
    const dims = getImageDimensions(sourceImage);
    if (!dims) {
      msgShowError(EXPORT_FAILED_MESSAGE);
      return false;
    }

    // Get image data for embedding.
    const dataUrl = getImageDataUrl(sourceImage);
    if (!dataUrl) {
      msgShowError(EXPORT_FAILED_MESSAGE);
      return false;
    }

    // Req 7.1, 7.2: single-page A4 portrait PDF (210 × 297 mm).
    // Req 7.3, 7.4: use fitImageToPage for sizing with 12.7 mm margins.
    const fit = fitFn(dims.width, dims.height, A4_PORTRAIT, DEFAULT_MARGIN_MM);

    // Build the PDF using jsPDF.
    const pdf = new JsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Add the image at the computed placement.
    pdf.addImage(dataUrl, 'PNG', fit.x, fit.y, fit.w, fit.h);

    // Req 7.5: trigger the save dialog.
    pdf.save(filename);

    return true;
  }

  // -------------------------------------------------------------------------
  // Public export methods
  // -------------------------------------------------------------------------

  /**
   * Export the Combined_Image as a PDF.
   * Guards: image must exist (Req 7.6, 12.4), jsPDF must be available (Req 7.7).
   * On any failure, state is unchanged (Req 7.8, 12.5).
   *
   * @returns {boolean} true when the PDF was saved successfully.
   */
  function exportCombined() {
    try {
      const state = appState.getState();

      // Req 7.6, 12.4: Guard — combined image must exist.
      if (!state.combinedImage) {
        msgShowError(NO_COMBINED_MESSAGE);
        return false;
      }

      return buildAndSavePdf(state.combinedImage, 'nid-combined.pdf');
    } catch (err) {
      // Req 7.8, 12.5: generation failure — report without altering state.
      msgShowError(EXPORT_FAILED_MESSAGE);
      return false;
    }
  }

  /**
   * Export the Adjusted_Image as a PDF.
   * Guards: image must exist (Req 7.6, 12.4), jsPDF must be available (Req 7.7).
   * On any failure, state is unchanged (Req 7.8, 12.5).
   *
   * @returns {boolean} true when the PDF was saved successfully.
   */
  function exportAdjusted() {
    try {
      const state = appState.getState();

      // Req 7.6, 12.4: Guard — adjusted image must exist.
      if (!state.adjustedImage) {
        msgShowError(NO_ADJUSTED_MESSAGE);
        return false;
      }

      return buildAndSavePdf(state.adjustedImage, 'nid-adjusted.pdf');
    } catch (err) {
      // Req 7.8, 12.5: generation failure — report without altering state.
      msgShowError(EXPORT_FAILED_MESSAGE);
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Wiring
  // -------------------------------------------------------------------------

  function onCombinedExportClick() {
    exportCombined();
  }

  function onAdjustedExportClick() {
    exportAdjusted();
  }

  /** Attach DOM event listeners. */
  function init() {
    if (combinedExportBtn) {
      combinedExportBtn.addEventListener('click', onCombinedExportClick);
    }
    if (adjustedExportBtn) {
      adjustedExportBtn.addEventListener('click', onAdjustedExportClick);
    }
  }

  /** Detach DOM event listeners. */
  function destroy() {
    if (combinedExportBtn) {
      combinedExportBtn.removeEventListener('click', onCombinedExportClick);
    }
    if (adjustedExportBtn) {
      adjustedExportBtn.removeEventListener('click', onAdjustedExportClick);
    }
  }

  return {
    init,
    destroy,
    exportCombined,
    exportAdjusted,
  };
}

export default createExportController;
