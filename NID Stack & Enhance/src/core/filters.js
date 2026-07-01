/**
 * filters.js — pure pixel transforms for the Filter_Engine.
 *
 * No DOM access. Operates on plain RGBA buffers (an array-like of bytes in
 * R,G,B,A order, length === width * height * 4). Every transform reads from an
 * unfiltered base buffer and returns a NEW buffer; the base buffer is never
 * mutated, so switching filters always applies to the base rather than to an
 * already-filtered result (Req 6.3).
 *
 * Supported filters (Req 6.1): None, Lighten, Document, Grayscale.
 *   - None: pixels identical to the base (Req 6.5, 6.6).
 *   - Lighten: scale each channel up and add a small offset.
 *   - Grayscale: luminance (Rec. 601 weights) across RGB.
 *   - Document: luminance + a fixed contrast boost for a scanned look.
 *
 * Validates: Requirements 6.1, 6.3, 6.5, 6.6
 */

/** The four selectable filter names (Req 6.1), normalized to lower case. */
export const FILTER_NAMES = Object.freeze(['none', 'lighten', 'document', 'grayscale']);

// Document filter contrast amount (0-255) and derived contrast factor, matching
// the original implementation's scanned-document look.
const DOC_CONTRAST_AMOUNT = 60;
const DOC_CONTRAST_FACTOR =
  (259 * (DOC_CONTRAST_AMOUNT + 255)) / (255 * (259 - DOC_CONTRAST_AMOUNT));
const DOC_BRIGHTNESS_OFFSET = 8;

// Rec. 601 luminance weights.
const LUMA_R = 0.299;
const LUMA_G = 0.587;
const LUMA_B = 0.114;

/**
 * Clamp a value into the inclusive 0-255 byte range.
 * @param {number} v
 * @returns {number}
 */
function clampByte(v) {
  if (v < 0) return 0;
  if (v > 255) return 255;
  return v;
}

/**
 * Normalize a filter name to one of FILTER_NAMES; unknown names fall back to
 * 'none' so the function is total and never throws.
 * @param {string} name
 * @returns {string}
 */
function normalizeName(name) {
  const n = typeof name === 'string' ? name.trim().toLowerCase() : '';
  return FILTER_NAMES.includes(n) ? n : 'none';
}

/**
 * Apply a named filter to an unfiltered RGBA base buffer.
 *
 * The base buffer is treated as immutable: a fresh Uint8ClampedArray is always
 * returned and `baseRGBA` is never written to. The alpha channel is preserved
 * unchanged for every filter.
 *
 * @param {string} name - filter name (None|Lighten|Document|Grayscale),
 *   case-insensitive; unknown names behave as None.
 * @param {ArrayLike<number>} baseRGBA - unfiltered base pixels (R,G,B,A...).
 * @param {number} width - image width in pixels.
 * @param {number} height - image height in pixels.
 * @returns {Uint8ClampedArray} a new buffer holding the filtered pixels.
 */
export function applyFilter(name, baseRGBA, width, height) {
  const filter = normalizeName(name);

  // Determine the working length. Prefer width*height*4 when both dimensions
  // are valid; otherwise fall back to the source buffer length so the function
  // stays total for degenerate inputs.
  const dimsValid =
    Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
  const sourceLen = baseRGBA && baseRGBA.length ? baseRGBA.length : 0;
  const length = dimsValid ? width * height * 4 : sourceLen;

  // Always copy first so the base buffer is never mutated and unknown/None
  // returns pixels identical to the base (Req 6.5, 6.6).
  const out = new Uint8ClampedArray(length);
  for (let i = 0; i < length; i += 1) {
    out[i] = baseRGBA ? baseRGBA[i] : 0;
  }

  if (filter === 'none') {
    return out;
  }

  if (filter === 'lighten') {
    for (let i = 0; i + 3 < length; i += 4) {
      out[i] = clampByte(Math.round(out[i] * 1.08 + 12));
      out[i + 1] = clampByte(Math.round(out[i + 1] * 1.08 + 12));
      out[i + 2] = clampByte(Math.round(out[i + 2] * 1.08 + 12));
      // alpha (out[i + 3]) unchanged
    }
    return out;
  }

  if (filter === 'grayscale') {
    for (let i = 0; i + 3 < length; i += 4) {
      const l = Math.round(LUMA_R * out[i] + LUMA_G * out[i + 1] + LUMA_B * out[i + 2]);
      out[i] = l;
      out[i + 1] = l;
      out[i + 2] = l;
      // alpha (out[i + 3]) unchanged
    }
    return out;
  }

  // 'document': luminance with a fixed contrast boost and slight brightening.
  for (let i = 0; i + 3 < length; i += 4) {
    let l = Math.round(LUMA_R * out[i] + LUMA_G * out[i + 1] + LUMA_B * out[i + 2]);
    l = Math.round(DOC_CONTRAST_FACTOR * (l - 128) + 128 + DOC_BRIGHTNESS_OFFSET);
    l = clampByte(l);
    out[i] = l;
    out[i + 1] = l;
    out[i + 2] = l;
    // alpha (out[i + 3]) unchanged
  }
  return out;
}

export default applyFilter;
