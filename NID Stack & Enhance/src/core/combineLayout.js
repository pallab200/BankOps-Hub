/**
 * combineLayout.js — pure layout logic for the Combine_Engine.
 *
 * No DOM access. Takes plain data (source slots, spacing, background color)
 * and returns a plain Layout object describing how the cropped source images
 * are stacked vertically into the Combined_Image.
 *
 * Data shapes (see design.md "Data Models"):
 *   Rect       = { x: number, y: number, w: number, h: number }
 *   CropRegion = { x: int, y: int, w: int, h: int }   // original image px
 *   SourceSlot = { image, naturalWidth, naturalHeight, crop: CropRegion|null }
 *   Placement  = { src: SourceSlot, srcRect: Rect, dstRect: Rect }
 *   Layout     = { targetWidth, totalHeight, backgroundColor, placements }
 *
 * Validates: Requirements 4.4, 4.5
 */

const DEFAULT_BACKGROUND = '#ffffff';

/**
 * Resolve the dimensions of a source slot, tolerating partial data.
 * @param {object} slot
 * @returns {{ width: number, height: number }}
 */
function naturalSize(slot) {
  const img = slot && slot.image;
  const width =
    Number.isFinite(slot && slot.naturalWidth)
      ? slot.naturalWidth
      : img && Number.isFinite(img.naturalWidth)
        ? img.naturalWidth
        : 0;
  const height =
    Number.isFinite(slot && slot.naturalHeight)
      ? slot.naturalHeight
      : img && Number.isFinite(img.naturalHeight)
        ? img.naturalHeight
        : 0;
  return { width: Math.max(0, width), height: Math.max(0, height) };
}

/**
 * Compute the source rectangle for a slot by applying its stored Crop_Region.
 * When no crop is stored the full image bounds are used (Req 4.5).
 * @param {object} slot
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
function sourceRect(slot) {
  const { width, height } = naturalSize(slot);
  const crop = slot && slot.crop;
  if (crop && Number.isFinite(crop.w) && Number.isFinite(crop.h)) {
    return {
      x: Number.isFinite(crop.x) ? crop.x : 0,
      y: Number.isFinite(crop.y) ? crop.y : 0,
      w: Math.max(0, crop.w),
      h: Math.max(0, crop.h),
    };
  }
  return { x: 0, y: 0, w: width, h: height };
}

/**
 * Normalize the `sources` argument into an ordered array of loaded slots in
 * front-then-back order, dropping empty slots (Req 4.4).
 *
 * Accepts either:
 *   - an object `{ front, back }` (the appState shape), or
 *   - an array of slots already in front-then-back order.
 *
 * @param {object|Array} sources
 * @returns {object[]}
 */
function orderedSlots(sources) {
  if (!sources) return [];
  let ordered;
  if (Array.isArray(sources)) {
    ordered = sources;
  } else {
    ordered = [sources.front, sources.back];
  }
  return ordered.filter((slot) => slot != null);
}

/**
 * Compute the combine layout for the loaded sources.
 *
 * The target width is the maximum cropped width among the included sources.
 * Each source is scaled to that width (preserving its cropped aspect ratio),
 * placed top-to-bottom in front-then-back order with a vertical gap equal to
 * `spacing` between adjacent images. The total height is the sum of the
 * placement heights plus (n - 1) * spacing.
 *
 * This function is total: it never throws and clamps degenerate inputs.
 *
 * @param {object|Array} sources - `{ front, back }` or an ordered slot array.
 * @param {number} spacing - vertical gap in px between adjacent images.
 * @param {string} [bgColor] - background fill color; defaults to white.
 * @returns {{ targetWidth: number, totalHeight: number, backgroundColor: string, placements: Array }}
 */
export function computeLayout(sources, spacing, bgColor) {
  const slots = orderedSlots(sources);
  const gap = Number.isFinite(spacing) ? Math.max(0, spacing) : 0;
  const backgroundColor =
    typeof bgColor === 'string' && bgColor.length > 0
      ? bgColor
      : DEFAULT_BACKGROUND;

  if (slots.length === 0) {
    return { targetWidth: 0, totalHeight: 0, backgroundColor, placements: [] };
  }

  // Source rectangles (cropped) for each included slot, in order.
  const srcRects = slots.map(sourceRect);

  // Target width = max cropped width among included sources (Req 4.4/4.5).
  const targetWidth = srcRects.reduce((max, r) => Math.max(max, r.w), 0);

  // Build placements stacked top-to-bottom with `gap` between adjacent images.
  const placements = [];
  let offsetY = 0;
  for (let i = 0; i < slots.length; i += 1) {
    const srcRect = srcRects[i];
    // Scale to target width preserving cropped aspect ratio; guard /0.
    const scaledHeight =
      srcRect.w > 0 ? Math.round((srcRect.h * targetWidth) / srcRect.w) : 0;
    const dstRect = { x: 0, y: offsetY, w: targetWidth, h: scaledHeight };
    placements.push({ src: slots[i], srcRect, dstRect });
    offsetY += scaledHeight + gap;
  }

  // Total height = sum(placement heights) + (n - 1) * spacing.
  const sumHeights = placements.reduce((sum, p) => sum + p.dstRect.h, 0);
  const totalHeight = sumHeights + (placements.length - 1) * gap;

  return { targetWidth, totalHeight, backgroundColor, placements };
}

export default computeLayout;
