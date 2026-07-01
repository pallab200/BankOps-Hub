// cropGeometry.js — pure geometry helpers for the Crop_Editor.
//
// This module is a pure ES module: it accepts plain data (numbers and plain
// geometry objects) and returns plain data. It never touches the DOM and never
// throws — every function is TOTAL and clamps out-of-range / malformed inputs
// to a valid result.
//
// Coordinate systems:
//  - "original" coordinates are the source image's pixel coordinates. The
//    Crop_Region is stored here as integer pixels: { x, y, w, h }.
//  - "display" coordinates are pixels on the crop canvas. They relate to
//    original coordinates by a single uniform `scale`:
//        display = original * scale,  original = display / scale.
//
// Shapes:
//  - Region   : { x:int, y:int, w:int, h:int }  (w >= 10, h >= 10 once constrained)
//  - imgBounds: { width:int, height:int }        (image size; origin at 0,0)
//  - Point    : { x:number, y:number }
//
// Corner indices (clockwise from top-left):
//   0 = top-left, 1 = top-right, 2 = bottom-right, 3 = bottom-left
//
// Validates: Requirements 3.1, 3.3, 3.4, 3.5, 10.6

/** Default minimum Crop_Region size in original image pixels (Req 3.3). */
export const DEFAULT_MIN_PX = 10;

// ---------------------------------------------------------------------------
// Internal total helpers (never throw)
// ---------------------------------------------------------------------------

/** Coerce any value to a finite number, falling back when NaN/Infinity/missing. */
function toFinite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Coerce any value to a finite integer (nearest), falling back when invalid. */
function toInt(value, fallback = 0) {
  return Math.round(toFinite(value, fallback));
}

/**
 * Clamp `value` into [lo, hi]. Total even when lo > hi: in that degenerate
 * case the lower bound wins, so the result is always defined.
 */
function clamp(value, lo, hi) {
  const v = toFinite(value, lo);
  if (hi < lo) return lo;
  return Math.min(Math.max(v, lo), hi);
}

/** Normalize an arbitrary region-like object to integer { x, y, w, h }. */
function normalizeRegion(region) {
  const r = region || {};
  return {
    x: toInt(r.x, 0),
    y: toInt(r.y, 0),
    w: Math.max(0, toInt(r.w, 0)),
    h: Math.max(0, toInt(r.h, 0)),
  };
}

/** Normalize arbitrary bounds-like object to integer { width, height } >= 0. */
function normalizeBounds(imgBounds) {
  const b = imgBounds || {};
  // Accept {width,height} or {w,h} for convenience.
  const width = b.width != null ? b.width : b.w;
  const height = b.height != null ? b.height : b.h;
  return {
    width: Math.max(0, toInt(width, 0)),
    height: Math.max(0, toInt(height, 0)),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize a Crop_Region to the full image bounds (Req 3.1, Property 7).
 *
 * @param {number} imgW - image width in original pixels
 * @param {number} imgH - image height in original pixels
 * @returns {{x:number,y:number,w:number,h:number}} region covering full image
 */
export function initialRegion(imgW, imgH) {
  return {
    x: 0,
    y: 0,
    w: Math.max(0, toInt(imgW, 0)),
    h: Math.max(0, toInt(imgH, 0)),
  };
}

/**
 * Move a single corner of the Crop_Region toward `pointer`, keeping the
 * opposite corner fixed. The result always has all four corners within the
 * image bounds and a width and height of at least `minPx` in original pixels
 * (Req 3.3, Property 4). Total: clamps rather than throwing.
 *
 * @param {{x:number,y:number,w:number,h:number}} region - current region
 * @param {number} cornerIndex - 0=TL, 1=TR, 2=BR, 3=BL (wrapped mod 4)
 * @param {{x:number,y:number}} pointer - target position in original pixels
 * @param {{width:number,height:number}} imgBounds - image size (origin 0,0)
 * @param {number} [minPx=10] - minimum width/height in original pixels
 * @returns {{x:number,y:number,w:number,h:number}} constrained region
 */
export function constrainCorner(
  region,
  cornerIndex,
  pointer,
  imgBounds,
  minPx = DEFAULT_MIN_PX
) {
  const r = normalizeRegion(region);
  const b = normalizeBounds(imgBounds);

  // Requested minimum cannot exceed what the image can physically hold.
  const reqMin = Math.max(0, toInt(minPx, DEFAULT_MIN_PX));
  const minW = Math.min(reqMin, b.width);
  const minH = Math.min(reqMin, b.height);

  // Normalize corner index into 0..3.
  const idx = ((Math.trunc(toFinite(cornerIndex, 0)) % 4) + 4) % 4;

  // Current edges (integers).
  const left = r.x;
  const top = r.y;
  const right = r.x + r.w;
  const bottom = r.y + r.h;

  // Which edges does this corner control?
  //   left  edge: TL(0), BL(3)   |   right edge: TR(1), BR(2)
  //   top   edge: TL(0), TR(1)   |   bottom edge: BR(2), BL(3)
  const movesLeftEdge = idx === 0 || idx === 3;
  const movesTopEdge = idx === 0 || idx === 1;

  // Pointer snapped to integer original pixels and clamped into the image.
  const px = clamp(toInt(pointer && pointer.x, 0), 0, b.width);
  const py = clamp(toInt(pointer && pointer.y, 0), 0, b.height);

  // Resolve one axis: move the dragged edge toward `desired` while keeping the
  // opposite (fixed) edge in place, enforcing a span of at least `minSize`.
  //
  // The fixed edge is normally left untouched, but when it is pinned against
  // an image boundary there may be no room on the dragged side to honor the
  // minimum span. In that case we push the fixed edge inward (it has room) so
  // the resulting span still satisfies the minimum and both edges stay inside
  // [0, dim]. This keeps the function total and the result always valid.
  function resolveAxis(fixed, desired, movingIsLower, dim, minSize) {
    const m = Math.min(Math.max(0, minSize), dim);
    const fixedEdge = clamp(fixed, 0, dim);

    let lo;
    let hi;
    if (movingIsLower) {
      // Dragged edge is the lower bound; `fixedEdge` is the upper bound.
      hi = fixedEdge;
      // Not enough room below the fixed edge: push it inward (toward dim).
      if (hi < m) hi = m;
      if (hi > dim) hi = dim;
      lo = clamp(desired, 0, hi - m);
    } else {
      // Dragged edge is the upper bound; `fixedEdge` is the lower bound.
      lo = fixedEdge;
      // Not enough room above the fixed edge: push it inward (toward 0).
      if (lo > dim - m) lo = dim - m;
      if (lo < 0) lo = 0;
      hi = clamp(desired, lo + m, dim);
    }
    return { lo, hi };
  }

  // Horizontal axis: dragged edge follows px, the other edge is fixed.
  const hAxis = movesLeftEdge
    ? resolveAxis(right, px, true, b.width, minW) // left edge moves
    : resolveAxis(left, px, false, b.width, minW); // right edge moves

  // Vertical axis: dragged edge follows py, the other edge is fixed.
  const vAxis = movesTopEdge
    ? resolveAxis(bottom, py, true, b.height, minH) // top edge moves
    : resolveAxis(top, py, false, b.height, minH); // bottom edge moves

  return {
    x: hAxis.lo,
    y: vAxis.lo,
    w: hAxis.hi - hAxis.lo,
    h: vAxis.hi - vAxis.lo,
  };
}

// ---------------------------------------------------------------------------
// Perspective (free-corner) crop support
// ---------------------------------------------------------------------------

/**
 * A perspective crop stores 4 independent corner points (in original image
 * pixel coordinates). Each corner can be moved freely within the image bounds.
 *
 * Corner order: [TL, TR, BR, BL] (clockwise from top-left).
 *
 * @typedef {Array<{x:number,y:number}>} QuadCorners
 */

/**
 * Create initial quad corners covering the full image bounds.
 *
 * @param {number} imgW - image width in original pixels
 * @param {number} imgH - image height in original pixels
 * @returns {QuadCorners} 4 corners at image edges
 */
export function initialQuadCorners(imgW, imgH) {
  const w = Math.max(0, toInt(imgW, 0));
  const h = Math.max(0, toInt(imgH, 0));
  return [
    { x: 0, y: 0 },       // TL
    { x: w, y: 0 },       // TR
    { x: w, y: h },       // BR
    { x: 0, y: h },       // BL
  ];
}

/**
 * Convert an axis-aligned region { x, y, w, h } to quad corners.
 *
 * @param {{x:number,y:number,w:number,h:number}} region
 * @returns {QuadCorners}
 */
export function regionToQuadCorners(region) {
  const r = normalizeRegion(region);
  return [
    { x: r.x, y: r.y },                   // TL
    { x: r.x + r.w, y: r.y },             // TR
    { x: r.x + r.w, y: r.y + r.h },       // BR
    { x: r.x, y: r.y + r.h },             // BL
  ];
}

/**
 * Move a single corner of a quad freely to the pointer position, clamped
 * within the image bounds. Other corners remain unchanged.
 *
 * @param {QuadCorners} corners - current 4 corner positions
 * @param {number} cornerIndex - 0=TL, 1=TR, 2=BR, 3=BL
 * @param {{x:number,y:number}} pointer - target position in original pixels
 * @param {{width:number,height:number}} imgBounds - image size (origin 0,0)
 * @returns {QuadCorners} new corners array with the moved corner
 */
export function moveQuadCorner(corners, cornerIndex, pointer, imgBounds) {
  const b = normalizeBounds(imgBounds);
  const idx = ((Math.trunc(toFinite(cornerIndex, 0)) % 4) + 4) % 4;

  const px = clamp(toFinite(pointer && pointer.x, 0), 0, b.width);
  const py = clamp(toFinite(pointer && pointer.y, 0), 0, b.height);

  // Clone corners and update the dragged one.
  const result = (corners || initialQuadCorners(b.width, b.height)).map(
    (c, i) => (i === idx ? { x: Math.round(px), y: Math.round(py) } : { ...c })
  );
  return result;
}

/**
 * Move all 4 corners by a delta, keeping them within image bounds.
 *
 * @param {QuadCorners} corners - current 4 corner positions
 * @param {{dx:number,dy:number}} delta - movement offset
 * @param {{width:number,height:number}} imgBounds - image size (origin 0,0)
 * @returns {QuadCorners} moved corners
 */
export function moveQuad(corners, delta, imgBounds) {
  const b = normalizeBounds(imgBounds);
  const d = delta || {};
  const dx = toInt(d.dx != null ? d.dx : d.x, 0);
  const dy = toInt(d.dy != null ? d.dy : d.y, 0);

  const pts = corners || initialQuadCorners(b.width, b.height);

  // Compute how far we can actually move without pushing any corner outside.
  const minX = Math.min(...pts.map(p => p.x));
  const maxX = Math.max(...pts.map(p => p.x));
  const minY = Math.min(...pts.map(p => p.y));
  const maxY = Math.max(...pts.map(p => p.y));

  const clampedDx = clamp(dx, -minX, b.width - maxX);
  const clampedDy = clamp(dy, -minY, b.height - maxY);

  return pts.map(p => ({
    x: Math.round(p.x + clampedDx),
    y: Math.round(p.y + clampedDy),
  }));
}

/**
 * Compute the axis-aligned bounding box of a quad (for backward compat with
 * the combine pipeline when perspective transform is not applied).
 *
 * @param {QuadCorners} corners
 * @returns {{x:number,y:number,w:number,h:number}}
 */
export function quadBoundingBox(corners) {
  if (!corners || corners.length < 4) return { x: 0, y: 0, w: 0, h: 0 };
  const xs = corners.map(c => c.x);
  const ys = corners.map(c => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: Math.round(minX),
    y: Math.round(minY),
    w: Math.round(maxX - minX),
    h: Math.round(maxY - minY),
  };
}

/**
 * Move the entire Crop_Region by `delta`, preserving its width and height and
 * keeping all four corners within the image bounds (Req 3.4, Property 5).
 * Total: clamps rather than throwing.
 *
 * @param {{x:number,y:number,w:number,h:number}} region - current region
 * @param {{dx:number,dy:number}|{x:number,y:number}} delta - move offset
 * @param {{width:number,height:number}} imgBounds - image size (origin 0,0)
 * @returns {{x:number,y:number,w:number,h:number}} moved region (same w/h)
 */
export function constrainMove(region, delta, imgBounds) {
  const r = normalizeRegion(region);
  const b = normalizeBounds(imgBounds);

  const d = delta || {};
  // Accept {dx,dy} or {x,y}.
  const dx = toInt(d.dx != null ? d.dx : d.x, 0);
  const dy = toInt(d.dy != null ? d.dy : d.y, 0);

  // The region cannot be pushed past the image edge; size is never changed.
  const maxX = Math.max(0, b.width - r.w);
  const maxY = Math.max(0, b.height - r.h);

  return {
    x: clamp(r.x + dx, 0, maxX),
    y: clamp(r.y + dy, 0, maxY),
    w: r.w,
    h: r.h,
  };
}

/**
 * Convert a point from display (canvas) coordinates to original image
 * coordinates: original = display / scale (Req 3.5, Property 6). Exact inverse
 * of `originalToDisplay`. Total: a zero / non-finite scale is treated as 1.
 *
 * @param {{x:number,y:number}} point - point in display coordinates
 * @param {number} scale - display-per-original scale factor
 * @returns {{x:number,y:number}} point in original image coordinates
 */
export function displayToOriginal(point, scale) {
  const s = safeScale(scale);
  const p = point || {};
  return {
    x: toFinite(p.x, 0) / s,
    y: toFinite(p.y, 0) / s,
  };
}

/**
 * Convert a point from original image coordinates to display (canvas)
 * coordinates: display = original * scale (Req 3.5, Property 6). Exact inverse
 * of `displayToOriginal`. Total: a non-finite scale is treated as 1.
 *
 * @param {{x:number,y:number}} point - point in original image coordinates
 * @param {number} scale - display-per-original scale factor
 * @returns {{x:number,y:number}} point in display coordinates
 */
export function originalToDisplay(point, scale) {
  const s = safeScale(scale);
  const p = point || {};
  return {
    x: toFinite(p.x, 0) * s,
    y: toFinite(p.y, 0) * s,
  };
}

/** A scale of 0 or non-finite would break the round trip; treat it as 1. */
function safeScale(scale) {
  const s = toFinite(scale, 1);
  return s === 0 ? 1 : s;
}

/**
 * Size the crop canvas so that neither its width nor its height exceeds the
 * viewport, while preserving the source image aspect ratio (Req 10.6,
 * Property 13). Total: non-positive inputs yield a zero-size canvas.
 *
 * @param {number} imgW - source image width in original pixels
 * @param {number} imgH - source image height in original pixels
 * @param {number} viewportW - available viewport width
 * @param {number} viewportH - available viewport height
 * @returns {{canvasW:number,canvasH:number,scale:number}} sizing result
 */
export function sizeCropCanvas(imgW, imgH, viewportW, viewportH) {
  const iw = toFinite(imgW, 0);
  const ih = toFinite(imgH, 0);
  const vw = toFinite(viewportW, 0);
  const vh = toFinite(viewportH, 0);

  if (iw <= 0 || ih <= 0 || vw <= 0 || vh <= 0) {
    return { canvasW: 0, canvasH: 0, scale: 0 };
  }

  // Fit within both viewport dimensions, preserving aspect ratio exactly.
  const scale = Math.min(vw / iw, vh / ih);
  return {
    canvasW: iw * scale,
    canvasH: ih * scale,
    scale,
  };
}
