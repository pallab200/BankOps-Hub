/**
 * pdfLayout.js — pure PDF page-fitting logic for the PDF_Exporter.
 *
 * No DOM access. Takes plain numbers (image dimensions, page size, margin)
 * and returns a plain PdfFit object describing where to embed the image on
 * an A4 portrait page, in millimeters.
 *
 * Data shapes (see design.md "Data Models"):
 *   A4_PORTRAIT = { widthMm: 210, heightMm: 297 }
 *   PdfFit      = { x: number, y: number, w: number, h: number }   // mm
 *
 * Margin decision (design.md "Export Component"): a uniform 12.7 mm (0.5 in)
 * margin on all four sides. This satisfies Req 7.4 (all sides > 0 and
 * <= 25.4 mm; left == right) and yields a large printable area
 * (~184.6 mm x 271.6 mm) so the image renders at a sensible size — directly
 * replacing the oversized 56.2/87 mm margins of defect D6.
 *
 * Validates: Requirements 7.3, 7.4
 */

/** A4 portrait page dimensions in millimeters. */
export const A4_PORTRAIT = { widthMm: 210, heightMm: 297 };

/** Default uniform margin: 12.7 mm (0.5 inch). */
export const DEFAULT_MARGIN_MM = 12.7;

/** Maximum allowed visible margin per Req 7.4 (25.4 mm = 1 inch). */
export const MAX_MARGIN_MM = 25.4;

/**
 * Smallest positive margin we will use. Kept strictly above 0 so all four
 * visible margins are guaranteed > 0 mm (Req 7.4).
 */
const MIN_MARGIN_MM = 0.1;

/**
 * Resolve the page dimensions from a (possibly partial) page descriptor,
 * tolerating missing or invalid fields by falling back to A4 portrait.
 * @param {{ widthMm?: number, heightMm?: number }} page
 * @returns {{ widthMm: number, heightMm: number }}
 */
function resolvePage(page) {
  const widthMm =
    page && Number.isFinite(page.widthMm) && page.widthMm > 0
      ? page.widthMm
      : A4_PORTRAIT.widthMm;
  const heightMm =
    page && Number.isFinite(page.heightMm) && page.heightMm > 0
      ? page.heightMm
      : A4_PORTRAIT.heightMm;
  return { widthMm, heightMm };
}

/**
 * Clamp the requested margin into the valid range (0, 25.4] mm and ensure it
 * never consumes the whole page. This keeps the function total: any numeric
 * (or non-numeric) input yields a usable margin.
 * @param {number} margin
 * @param {{ widthMm: number, heightMm: number }} page
 * @returns {number}
 */
function resolveMargin(margin, page) {
  let m = Number.isFinite(margin) ? margin : DEFAULT_MARGIN_MM;
  // Enforce the design bounds: strictly > 0 and <= 25.4 mm.
  if (m < MIN_MARGIN_MM) m = MIN_MARGIN_MM;
  if (m > MAX_MARGIN_MM) m = MAX_MARGIN_MM;
  // Guard against a margin that would leave no printable area on small pages.
  const maxByWidth = page.widthMm / 2 - MIN_MARGIN_MM;
  const maxByHeight = page.heightMm / 2 - MIN_MARGIN_MM;
  const ceiling = Math.max(MIN_MARGIN_MM, Math.min(maxByWidth, maxByHeight));
  if (m > ceiling) m = ceiling;
  return m;
}

/**
 * Compute the placement of an image embedded on a PDF page.
 *
 * The image is scaled to fit entirely within the printable area (page minus a
 * uniform margin on all four sides), preserving its aspect ratio, and centered
 * within that printable area. Centering guarantees the left and right margins
 * are equal (Req 7.4), and fitting-to-printable guarantees the image stays
 * inside the printable bounds (Req 7.3).
 *
 * This function is total: it never throws. Non-finite or non-positive image
 * dimensions are treated as a degenerate square that fills the printable area,
 * so a valid PdfFit is always returned.
 *
 * @param {number} imgW - source image width (any unit; only the ratio matters).
 * @param {number} imgH - source image height.
 * @param {{ widthMm: number, heightMm: number }} [page=A4_PORTRAIT] - page size in mm.
 * @param {number} [margin=DEFAULT_MARGIN_MM] - uniform margin in mm.
 * @returns {{ x: number, y: number, w: number, h: number }} placement in mm.
 */
export function fitImageToPage(
  imgW,
  imgH,
  page = A4_PORTRAIT,
  margin = DEFAULT_MARGIN_MM,
) {
  const { widthMm, heightMm } = resolvePage(page);
  const m = resolveMargin(margin, { widthMm, heightMm });

  const printableW = widthMm - 2 * m;
  const printableH = heightMm - 2 * m;

  // Normalize degenerate image dimensions: fall back to the printable aspect
  // so the result still fits and preserves a sensible ratio.
  const w0 =
    Number.isFinite(imgW) && imgW > 0 ? imgW : printableW;
  const h0 =
    Number.isFinite(imgH) && imgH > 0 ? imgH : printableH;

  // Scale to fit within the printable area, preserving aspect ratio.
  const scale = Math.min(printableW / w0, printableH / h0);
  const w = w0 * scale;
  const h = h0 * scale;

  // Center within the printable area => equal left/right (and top/bottom)
  // margins, each >= m > 0 (Req 7.4).
  const x = (widthMm - w) / 2;
  const y = (heightMm - h) / 2;

  return { x, y, w, h };
}

export default fitImageToPage;
