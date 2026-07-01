/**
 * imageAdjust.js — pure brightness/contrast/saturation + sharpness logic for
 * the Adjustment_Engine.
 *
 * No DOM access. Provides:
 *   - buildFilterString(brightness, contrast, saturation): the CSS filter
 *     string used for the live canvas preview.
 *   - sharpenKernel(amount): a 3x3 convolution kernel (row-major number[9]) or
 *     null when amount is 0 (no sharpening to apply).
 *   - isIdentity(brightness, contrast, saturation, sharpness): true when all
 *     adjustments are at their defaults (100/100/100/0).
 *   - adjust(buffer, width, height, adjustments): apply the adjustments to a
 *     plain RGBA buffer, returning a new buffer.
 *
 * Identity guarantee (Req 5.7): when brightness, contrast and saturation are
 * each 100 percent and sharpness is 0, adjust() returns a buffer whose pixel
 * values are identical to the input.
 *
 * Feature: nid-stack-enhance-redesign
 * Validates: Requirements 5.1, 5.4, 5.7
 */

/** Default adjustment values (Req 5.1). */
export const ADJUSTMENT_DEFAULTS = Object.freeze({
  brightness: 100,
  contrast: 100,
  saturation: 100,
  sharpness: 0,
});

/**
 * Coerce a value to a finite number, falling back when it is not numeric.
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function toNumber(value, fallback) {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Build the CSS filter string applied to the preview canvas for live
 * brightness/contrast/saturation adjustment (Req 5.1, 5.2). Percentages are
 * expressed as unitless ratios (100% -> 1) which `<canvas>.filter` and CSS
 * both accept.
 *
 * @param {number} brightness Brightness percentage (0..200, default 100).
 * @param {number} contrast Contrast percentage (0..200, default 100).
 * @param {number} saturation Saturation percentage (0..200, default 100).
 * @returns {string} e.g. "brightness(1) contrast(1) saturate(1)"
 */
export function buildFilterString(brightness, contrast, saturation) {
  const b = toNumber(brightness, ADJUSTMENT_DEFAULTS.brightness) / 100;
  const c = toNumber(contrast, ADJUSTMENT_DEFAULTS.contrast) / 100;
  const s = toNumber(saturation, ADJUSTMENT_DEFAULTS.saturation) / 100;
  return `brightness(${b}) contrast(${c}) saturate(${s})`;
}

/**
 * Build a 3x3 sharpen convolution kernel (row-major number[9]) whose weights
 * sum to 1 so the operation preserves overall brightness. The strength scales
 * linearly with `amount` (0..100). At amount 0 there is no sharpening to do,
 * so this returns null (Req 5.4 — sharpness 0 contributes no change).
 *
 * Kernel layout (a = strength):
 *      0   -a    0
 *     -a  1+4a  -a
 *      0   -a    0
 *
 * @param {number} amount Sharpness amount in the range 0..100.
 * @returns {number[] | null} The 9-element kernel, or null when amount is 0.
 */
export function sharpenKernel(amount) {
  const n = toNumber(amount, 0);
  if (n <= 0) return null;
  // Map 0..100 onto a sensible strength range. amount 100 -> a = 1.
  const a = Math.min(100, n) / 100;
  return [0, -a, 0, -a, 1 + 4 * a, -a, 0, -a, 0];
}

/**
 * Determine whether the given adjustment values represent the identity
 * transform: brightness, contrast and saturation each at 100 percent and
 * sharpness at 0 (Req 5.7).
 *
 * @param {number} brightness
 * @param {number} contrast
 * @param {number} saturation
 * @param {number} sharpness
 * @returns {boolean}
 */
export function isIdentity(brightness, contrast, saturation, sharpness) {
  return (
    toNumber(brightness, ADJUSTMENT_DEFAULTS.brightness) === 100 &&
    toNumber(contrast, ADJUSTMENT_DEFAULTS.contrast) === 100 &&
    toNumber(saturation, ADJUSTMENT_DEFAULTS.saturation) === 100 &&
    toNumber(sharpness, ADJUSTMENT_DEFAULTS.sharpness) === 0
  );
}

/** Clamp a number into the 0..255 byte range and round to an integer. */
function clampByte(value) {
  if (value <= 0) return 0;
  if (value >= 255) return 255;
  return Math.round(value);
}

/**
 * Apply brightness, contrast and saturation to an RGBA buffer in place-like
 * fashion, writing results into `out`. Matches the semantics of the CSS
 * filter functions used for the live preview so the applied result and the
 * preview agree:
 *   - brightness(b): channel *= b
 *   - contrast(c):   channel = (channel - 127.5) * c + 127.5
 *   - saturate(s):   luminance-preserving saturation matrix
 * Alpha is never modified.
 *
 * @param {ArrayLike<number>} src
 * @param {Uint8ClampedArray} out
 * @param {number} b brightness ratio
 * @param {number} c contrast ratio
 * @param {number} s saturation ratio
 */
function applyColor(src, out, b, c, s) {
  // SVG/CSS saturation matrix coefficients.
  const sr = 0.213;
  const sg = 0.715;
  const sb = 0.072;

  for (let i = 0; i < src.length; i += 4) {
    let r = src[i];
    let g = src[i + 1];
    let bl = src[i + 2];

    // brightness
    r *= b;
    g *= b;
    bl *= b;

    // contrast
    r = (r - 127.5) * c + 127.5;
    g = (g - 127.5) * c + 127.5;
    bl = (bl - 127.5) * c + 127.5;

    // saturation (linear blend toward luminance via the SVG/CSS matrix)
    const rr = (sr + (1 - sr) * s) * r + (sg - sg * s) * g + (sb - sb * s) * bl;
    const gg = (sr - sr * s) * r + (sg + (1 - sg) * s) * g + (sb - sb * s) * bl;
    const bb = (sr - sr * s) * r + (sg - sg * s) * g + (sb + (1 - sb) * s) * bl;

    out[i] = clampByte(rr);
    out[i + 1] = clampByte(gg);
    out[i + 2] = clampByte(bb);
    out[i + 3] = src[i + 3]; // preserve alpha
  }
}

/**
 * Apply a 3x3 convolution kernel to the RGB channels of an RGBA buffer,
 * clamping sample coordinates at the edges (edge extension). Alpha is copied
 * through unchanged. Returns a new Uint8ClampedArray.
 *
 * @param {ArrayLike<number>} src
 * @param {number} width
 * @param {number} height
 * @param {number[]} kernel row-major number[9]
 * @returns {Uint8ClampedArray}
 */
function convolve(src, width, height, kernel) {
  const out = new Uint8ClampedArray(src.length);
  const clampX = (x) => (x < 0 ? 0 : x >= width ? width - 1 : x);
  const clampY = (y) => (y < 0 ? 0 : y >= height ? height - 1 : y);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      let r = 0;
      let g = 0;
      let b = 0;
      let k = 0;
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          const weight = kernel[k];
          k += 1;
          const sx = clampX(x + kx);
          const sy = clampY(y + ky);
          const sIdx = (sy * width + sx) * 4;
          r += src[sIdx] * weight;
          g += src[sIdx + 1] * weight;
          b += src[sIdx + 2] * weight;
        }
      }
      out[idx] = clampByte(r);
      out[idx + 1] = clampByte(g);
      out[idx + 2] = clampByte(b);
      out[idx + 3] = src[idx + 3]; // preserve alpha
    }
  }
  return out;
}

/**
 * Apply the adjustments to an RGBA pixel buffer and return a new buffer.
 *
 * IDENTITY GUARANTEE (Req 5.7): when brightness, contrast and saturation are
 * each 100 and sharpness is 0, the returned buffer's pixel values are
 * identical to the input (a faithful copy is returned).
 *
 * Otherwise the color adjustments (brightness -> contrast -> saturation) are
 * applied first, matching `buildFilterString` order, followed by the sharpen
 * convolution when a kernel is produced.
 *
 * This function is total: degenerate dimensions or missing adjustments fall
 * back to defaults and never throw.
 *
 * @param {ArrayLike<number>} buffer RGBA bytes (length === width*height*4).
 * @param {number} width Image width in pixels.
 * @param {number} height Image height in pixels.
 * @param {{brightness?:number, contrast?:number, saturation?:number, sharpness?:number}} [adjustments]
 * @returns {Uint8ClampedArray} A new RGBA buffer with the adjustments applied.
 */
export function adjust(buffer, width, height, adjustments = {}) {
  const brightness = toNumber(
    adjustments.brightness,
    ADJUSTMENT_DEFAULTS.brightness,
  );
  const contrast = toNumber(adjustments.contrast, ADJUSTMENT_DEFAULTS.contrast);
  const saturation = toNumber(
    adjustments.saturation,
    ADJUSTMENT_DEFAULTS.saturation,
  );
  const sharpness = toNumber(
    adjustments.sharpness,
    ADJUSTMENT_DEFAULTS.sharpness,
  );

  // Identity short-circuit: guarantees a pixel-identical copy (Req 5.7).
  if (isIdentity(brightness, contrast, saturation, sharpness)) {
    return Uint8ClampedArray.from(buffer);
  }

  const b = brightness / 100;
  const c = contrast / 100;
  const s = saturation / 100;

  // Apply color adjustments into a fresh buffer.
  const colored = new Uint8ClampedArray(buffer.length);
  applyColor(buffer, colored, b, c, s);

  // Apply sharpening when a kernel exists and dimensions are usable.
  const kernel = sharpenKernel(sharpness);
  const w = Number.isFinite(width) ? Math.max(0, Math.floor(width)) : 0;
  const h = Number.isFinite(height) ? Math.max(0, Math.floor(height)) : 0;
  if (kernel && w > 0 && h > 0 && w * h * 4 === colored.length) {
    return convolve(colored, w, h, kernel);
  }

  return colored;
}

export default adjust;
