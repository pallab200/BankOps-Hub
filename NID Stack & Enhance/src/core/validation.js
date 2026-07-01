// validation.js — pure file-type/size validation, spacing validation, and
// range clamping for adjustment values. No DOM access.
//
// Feature: nid-stack-enhance-redesign
// Implements: Requirements 2.6, 2.7, 4.1, 4.2

/**
 * Supported image MIME types (Req 2.1–2.3, 2.6).
 * @type {readonly string[]}
 */
export const SUPPORTED_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

/** Maximum allowed file size in bytes — 10 MB (Req 2.7). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Spacing bounds, inclusive, in pixels (Req 4.1). */
export const SPACING_MIN = 0;
export const SPACING_MAX = 500;

/** Adjustment ranges (Req 5.1), used by the clamping helpers. */
export const ADJUSTMENT_RANGES = Object.freeze({
  brightness: Object.freeze({ min: 0, max: 200, default: 100 }),
  contrast: Object.freeze({ min: 0, max: 200, default: 100 }),
  saturation: Object.freeze({ min: 0, max: 200, default: 100 }),
  sharpness: Object.freeze({ min: 0, max: 100, default: 0 }),
});

/**
 * @typedef {{ ok: true }} ValidationOk
 * @typedef {{ ok: false, reason: "type" | "size", message: string }} ValidationError
 * @typedef {ValidationOk | ValidationError} ValidationResult
 */

/**
 * Validate a selected/dropped file by type then size.
 *
 * Accepts the file if and only if its type is one of the supported image
 * formats AND its size is at most MAX_FILE_BYTES. Type is checked before size
 * so an unsupported type is reported as `type` regardless of size, and a
 * supported-type file that is too large is reported as `size` (Req 2.6, 2.7).
 *
 * @param {{ type?: string, size?: number, name?: string } | null | undefined} file
 * @returns {ValidationResult}
 */
export function validateFile(file) {
  const type = file && typeof file.type === "string" ? file.type : "";
  const size = file && typeof file.size === "number" ? file.size : 0;

  if (!SUPPORTED_TYPES.includes(type)) {
    return {
      ok: false,
      reason: "type",
      message:
        "File is not a supported format. Supported formats are JPEG, PNG, WebP, GIF, and PDF.",
    };
  }

  if (size > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: "size",
      message: "File exceeds the maximum allowed size of 10 MB.",
    };
  }

  return { ok: true };
}

/**
 * @typedef {{ ok: true, value: number }} SpacingOk
 * @typedef {{ ok: false, value: number, message: string }} SpacingError
 * @typedef {SpacingOk | SpacingError} SpacingResult
 */

/**
 * Validate a candidate Spacing_Value.
 *
 * Accepts the value if and only if it is a whole number in the range 0..500
 * inclusive. On rejection (non-integer, negative, out of range, or non-finite),
 * the previously accepted value is returned unchanged along with a range
 * message (Req 4.1, 4.2).
 *
 * @param {unknown} value Candidate spacing entered by the user.
 * @param {number} previous Previously accepted spacing value.
 * @returns {SpacingResult}
 */
export function validateSpacing(value, previous) {
  const num = typeof value === "number" ? value : Number(value);
  const rangeMessage = `Spacing must be a whole number between ${SPACING_MIN} and ${SPACING_MAX} pixels.`;

  if (
    !Number.isFinite(num) ||
    !Number.isInteger(num) ||
    num < SPACING_MIN ||
    num > SPACING_MAX
  ) {
    return { ok: false, value: previous, message: rangeMessage };
  }

  return { ok: true, value: num };
}

/**
 * Clamp a numeric value into the inclusive range [min, max].
 * Non-finite input falls back to the provided fallback (or min).
 *
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number} [fallback]
 * @returns {number}
 */
export function clampToRange(value, min, max, fallback = min) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

/**
 * Clamp a named adjustment value into its documented range (Req 5.1).
 * Unknown names return the value clamped to a safe non-negative number.
 *
 * @param {"brightness"|"contrast"|"saturation"|"sharpness"} name
 * @param {unknown} value
 * @returns {number}
 */
export function clampAdjustment(name, value) {
  const range = ADJUSTMENT_RANGES[name];
  if (!range) return clampToRange(value, 0, Number.MAX_SAFE_INTEGER, 0);
  return clampToRange(value, range.min, range.max, range.default);
}
