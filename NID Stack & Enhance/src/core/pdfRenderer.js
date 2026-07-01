// pdfRenderer.js — renders the first page of a PDF to a PNG data URL.
// Pure-logic module with no DOM event listeners; only creates an offscreen canvas.
//
// Feature: pdf-upload-support
// Implements: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.1

/**
 * @typedef {Object} PdfRenderResult
 * @property {true} ok
 * @property {string} dataUrl - PNG data URL ("data:image/png;base64,...")
 * @property {number} naturalWidth - Positive integer pixel width
 * @property {number} naturalHeight - Positive integer pixel height
 */

/**
 * @typedef {Object} PdfRenderError
 * @property {false} ok
 * @property {'load'|'no-pages'|'render'} reason
 * @property {string} message - Human-readable error description
 */

/**
 * Render the first page of a PDF file as a PNG image.
 *
 * @param {ArrayBuffer} arrayBuffer - The PDF file content
 * @param {Object} [options]
 * @param {number} [options.minScale=2.0] - Minimum scale factor
 * @param {number} [options.maxDimension=4096] - Maximum pixel dimension
 * @param {Function} [options.getDocument] - pdf.js getDocument (for testing)
 * @returns {Promise<PdfRenderResult|PdfRenderError>}
 */
export async function renderFirstPage(arrayBuffer, options = {}) {
  const {
    minScale = 2.0,
    maxDimension = 4096,
    getDocument = window.pdfjsLib.getDocument,
  } = options;

  // Ensure pdf.js worker source is configured.
  // The worker file (pdf.worker.min.js) must be in the same directory as pdf.min.js.
  // On file:// protocol, the Worker constructor fails due to same-origin restrictions,
  // so pdf.js falls back to loading the worker as a <script> tag (fake worker mode).
  // We set workerSrc so the fallback loadScript() can find the worker file.
  if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';
    }
  }

  // Step 1: Load PDF document
  let pdfDocument;
  try {
    pdfDocument = await getDocument({ data: arrayBuffer }).promise;
  } catch (err) {
    return {
      ok: false,
      reason: "load",
      message:
        "The PDF could not be loaded. The file may be corrupted or encrypted.",
    };
  }

  // Step 3: Check page count
  if (pdfDocument.numPages === 0) {
    return {
      ok: false,
      reason: "no-pages",
      message: "The PDF has no renderable pages.",
    };
  }

  // Step 4–10: Render first page
  try {
    // Step 4: Get page 1 (always first page, never subsequent)
    const page = await pdfDocument.getPage(1);

    // Step 5: Compute effective scale
    const defaultViewport = page.getViewport({ scale: 1.0 });
    const effectiveScale = Math.max(minScale, defaultViewport.scale);

    // Step 6: Get scaled viewport and compute canvas dimensions
    const scaledViewport = page.getViewport({ scale: effectiveScale });
    let canvasWidth = scaledViewport.width;
    let canvasHeight = scaledViewport.height;

    // Step 7: Apply maxDimension cap — scale down proportionally if needed
    if (canvasWidth > maxDimension || canvasHeight > maxDimension) {
      const downscaleFactor = maxDimension / Math.max(canvasWidth, canvasHeight);
      canvasWidth = canvasWidth * downscaleFactor;
      canvasHeight = canvasHeight * downscaleFactor;
    }

    // Ensure positive integer dimensions
    canvasWidth = Math.max(1, Math.round(canvasWidth));
    canvasHeight = Math.max(1, Math.round(canvasHeight));

    // Step 8: Create offscreen canvas and render
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const canvasContext = canvas.getContext("2d");

    // Build the final viewport that matches actual canvas dimensions
    const finalScale =
      effectiveScale *
      (canvasWidth / scaledViewport.width);
    const finalViewport = page.getViewport({ scale: finalScale });

    await page.render({ canvasContext, viewport: finalViewport }).promise;

    // Step 10: Convert canvas to PNG data URL
    const dataUrl = canvas.toDataURL("image/png");

    // Step 11: Return success result
    return {
      ok: true,
      dataUrl,
      naturalWidth: canvasWidth,
      naturalHeight: canvasHeight,
    };
  } catch (err) {
    // Step 9: Render failure
    return {
      ok: false,
      reason: "render",
      message: "The PDF page could not be rendered.",
    };
  }
}
