// cardDetection.js — Automatic 4-corner document / card boundary detection.
//
// Detects the 4 corners of an ID card (like NID) or document in an image,
// using Microsoft Lens & OpenCV-grade computer vision techniques:
//  1. Fast downscaling to target max dimension (~320px) for real-time performance (<50ms).
//  2. Grayscale & 5-tap separable Gaussian blur to suppress fine noise/print textures.
//  3. Sobel gradient magnitude computation for edge-contrast validation.
//  4. Dual-mode document foreground segmentation:
//     - Adaptive Otsu luminance thresholding (both positive & inverse masks).
//     - Border background sampling & color distance masking.
//  5. Morphological Closing (7x7 kernel) to bridge gaps, seal fragmented card edges,
//     and fill interior text/photo voids into unified document blobs.
//  6. Connected Component Analysis to identify candidate document shapes.
//  7. Monotone Chain Convex Hull algorithm to wrap true document perimeters without interior noise.
//  8. Rotating Calipers (Minimum-Area Oriented Bounding Box) to accurately fit the true
//     outer edges even when cards have rounded corners.
//  9. Quad scoring based on card aspect ratio (NID standard ~1.58), rectangularity, and edge alignment.
// 10. Intelligent full-frame recognition: If the document occupies the full frame (e.g. flatbed scan
//     or tightly framed photo), returns full document corners [0,0] to [W,H], matching Microsoft Lens.
// 11. Total guarantee: never throws; provides safe fallback on blank or degenerate images.

/** Target maximum dimension in pixels for internal CV processing. */
export const TARGET_MAX_DIM = 320;

/**
 * Total helper: coerce value to finite number with fallback.
 */
function toFinite(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Order 4 arbitrary corner points into clockwise order starting from Top-Left:
 * [Top-Left (0), Top-Right (1), Bottom-Right (2), Bottom-Left (3)].
 *
 * Algorithm:
 *  - Top-Left minimizes (x + y)
 *  - Bottom-Right maximizes (x + y)
 *  - Top-Right maximizes (x - y)
 *  - Bottom-Left minimizes (x - y)
 *
 * @param {Array<{x:number,y:number}>} quad - 4 points
 * @returns {Array<{x:number,y:number}>} [TL, TR, BR, BL]
 */
export function orderCorners(quad) {
  if (!Array.isArray(quad) || quad.length < 4) {
    return [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
  }

  let tl = quad[0], tr = quad[0], br = quad[0], bl = quad[0];
  let minSum = Infinity, maxSum = -Infinity;
  let maxDiff = -Infinity, minDiff = Infinity;

  for (const p of quad) {
    const px = toFinite(p && p.x, 0);
    const py = toFinite(p && p.y, 0);
    const sum = px + py;
    const diff = px - py;

    if (sum < minSum) { minSum = sum; tl = { x: px, y: py }; }
    if (sum > maxSum) { maxSum = sum; br = { x: px, y: py }; }
    if (diff > maxDiff) { maxDiff = diff; tr = { x: px, y: py }; }
    if (diff < minDiff) { minDiff = diff; bl = { x: px, y: py }; }
  }

  return [tl, tr, br, bl];
}

/**
 * Calculate polygon area using the Shoelace formula.
 *
 * @param {Array<{x:number,y:number}>} poly
 * @returns {number} positive area
 */
export function polygonArea(poly) {
  if (!Array.isArray(poly) || poly.length < 3) return 0;
  let sum = 0;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = poly[i] || { x: 0, y: 0 };
    const pj = poly[j] || { x: 0, y: 0 };
    sum += (pj.x * pi.y) - (pi.x * pj.y);
  }
  return Math.abs(sum) / 2;
}

/**
 * Calculate polygon perimeter.
 *
 * @param {Array<{x:number,y:number}>} poly
 * @returns {number}
 */
export function polygonPerimeter(poly) {
  if (!Array.isArray(poly) || poly.length < 2) return 0;
  let p = 0;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = poly[i] || { x: 0, y: 0 };
    const pj = poly[j] || { x: 0, y: 0 };
    const dx = pi.x - pj.x;
    const dy = pi.y - pj.y;
    p += Math.sqrt(dx * dx + dy * dy);
  }
  return p;
}

/**
 * Check if a polygon is convex.
 *
 * @param {Array<{x:number,y:number}>} poly
 * @returns {boolean}
 */
export function isConvex(poly) {
  if (!Array.isArray(poly) || poly.length < 4) return false;
  let sign = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % n];
    const p3 = poly[(i + 2) % n];
    const cross = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);
    if (Math.abs(cross) > 1e-4) {
      const currentSign = cross > 0 ? 1 : -1;
      if (sign === 0) {
        sign = currentSign;
      } else if (currentSign !== sign) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Monotone Chain Convex Hull algorithm - O(N log N).
 * Computes the 2D convex hull of a set of points.
 *
 * @param {Array<{x:number,y:number}>} points
 * @returns {Array<{x:number,y:number}>} convex hull vertices
 */
export function convexHull(points) {
  if (!Array.isArray(points) || points.length <= 3) return points ? points.slice() : [];
  const pts = points.slice().sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Minimum-Area Oriented Bounding Rectangle (Rotating Calipers).
 * Given a convex hull, computes the tightest oriented rectangle enclosing the hull.
 * This perfectly fits rectangular cards even when they have rounded corners.
 *
 * @param {Array<{x:number,y:number}>} hull
 * @returns {Array<{x:number,y:number}>|null} 4 corner vertices
 */
export function minAreaOrientedRect(hull) {
  if (!hull || hull.length < 3) return null;
  const n = hull.length;
  let minArea = Infinity;
  let bestCorners = null;

  for (let i = 0; i < n; i++) {
    const p1 = hull[i];
    const p2 = hull[(i + 1) % n];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;

    // Unit vector along edge
    const ux = dx / len;
    const uy = dy / len;
    // Perpendicular unit vector
    const vx = -uy;
    const vy = ux;

    let minU = Infinity, maxU = -Infinity;
    let minV = Infinity, maxV = -Infinity;

    for (const p of hull) {
      const u = p.x * ux + p.y * uy;
      const v = p.x * vx + p.y * vy;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }

    const area = (maxU - minU) * (maxV - minV);
    if (area < minArea) {
      minArea = area;
      bestCorners = [
        { x: minU * ux + minV * vx, y: minU * uy + minV * vy },
        { x: maxU * ux + minV * vx, y: maxU * uy + minV * vy },
        { x: maxU * ux + maxV * vx, y: maxU * uy + maxV * vy },
        { x: minU * ux + maxV * vx, y: minU * uy + maxV * vy },
      ];
    }
  }

  return bestCorners;
}

/**
 * Perpendicular distance from point p to line segment (a, b).
 */
function perpendicularDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const px = p.x - a.x;
    const py = p.y - a.y;
    return Math.sqrt(px * px + py * py);
  }
  const cross = Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx);
  return cross / Math.sqrt(lenSq);
}

/**
 * Douglas-Peucker simplification on an open polyline.
 */
function simplifyOpenChain(points, epsilon) {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let maxIdx = 0;
  const p0 = points[0];
  const pEnd = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], p0, pEnd);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyOpenChain(points.slice(0, maxIdx + 1), epsilon);
    const right = simplifyOpenChain(points.slice(maxIdx), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  }
  return [p0, pEnd];
}

/**
 * Douglas-Peucker simplification on a closed polygon loop.
 *
 * @param {Array<{x:number,y:number}>} points
 * @param {number} epsilon
 * @returns {Array<{x:number,y:number}>}
 */
export function simplifyClosedPolygon(points, epsilon) {
  if (!points || points.length <= 4) return points || [];

  const n = points.length;
  let maxD = 0;
  let idxA = 0;
  let idxB = Math.floor(n / 2);
  const step = Math.max(1, Math.floor(n / 60));

  for (let i = 0; i < n; i += step) {
    for (let j = i + step; j < n; j += step) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const d2 = dx * dx + dy * dy;
      if (d2 > maxD) {
        maxD = d2;
        idxA = i;
        idxB = j;
      }
    }
  }

  const chain1 = [];
  if (idxA < idxB) {
    for (let i = idxA; i <= idxB; i++) chain1.push(points[i]);
  } else {
    for (let i = idxA; i < n; i++) chain1.push(points[i]);
    for (let i = 0; i <= idxB; i++) chain1.push(points[i]);
  }

  const chain2 = [];
  if (idxB < idxA) {
    for (let i = idxB; i <= idxA; i++) chain2.push(points[i]);
  } else {
    for (let i = idxB; i < n; i++) chain2.push(points[i]);
    for (let i = 0; i <= idxA; i++) chain2.push(points[i]);
  }

  const s1 = simplifyOpenChain(chain1, epsilon);
  const s2 = simplifyOpenChain(chain2, epsilon);

  return s1.slice(0, s1.length - 1).concat(s2.slice(0, s2.length - 1));
}

/**
 * Perform morphological closing (dilation then erosion) with radius r.
 * Seals micro-gaps and fills internal holes in document masks.
 */
function morphClose(src, W, H, r = 3) {
  const total = W * H;
  const temp = new Uint8Array(total);
  const dst = new Uint8Array(total);

  // Dilate
  for (let y = 0; y < H; y++) {
    const yMin = Math.max(0, y - r);
    const yMax = Math.min(H - 1, y + r);
    for (let x = 0; x < W; x++) {
      const xMin = Math.max(0, x - r);
      const xMax = Math.min(W - 1, x + r);
      let found = 0;
      for (let ny = yMin; ny <= yMax && !found; ny++) {
        const row = ny * W;
        for (let nx = xMin; nx <= xMax; nx++) {
          if (src[row + nx] === 1) { found = 1; break; }
        }
      }
      temp[y * W + x] = found;
    }
  }

  // Erode
  for (let y = 0; y < H; y++) {
    const yMin = Math.max(0, y - r);
    const yMax = Math.min(H - 1, y + r);
    for (let x = 0; x < W; x++) {
      const xMin = Math.max(0, x - r);
      const xMax = Math.min(W - 1, x + r);
      let allOn = 1;
      for (let ny = yMin; ny <= yMax && allOn; ny++) {
        const row = ny * W;
        for (let nx = xMin; nx <= xMax; nx++) {
          if (temp[row + nx] === 0) { allOn = 0; break; }
        }
      }
      dst[y * W + x] = allOn;
    }
  }

  return dst;
}

/**
 * Extract connected component boundaries from binary grid.
 */
function extractComponentBoundaries(grid, W, H, minSize) {
  const total = W * H;
  const visited = new Uint8Array(total);
  const comps = [];

  for (let y = 1; y < H - 1; y++) {
    const row = y * W;
    for (let x = 1; x < W - 1; x++) {
      const idx = row + x;
      if (grid[idx] === 1 && !visited[idx]) {
        const queue = [idx];
        visited[idx] = 1;
        let qHead = 0;
        const boundaryPts = [];

        while (qHead < queue.length) {
          const curr = queue[qHead++];
          const cx = curr % W;
          const cy = (curr / W) | 0;

          let isEdge = false;
          const nbs = [curr - 1, curr + 1, curr - W, curr + W];
          for (let i = 0; i < 4; i++) {
            const nb = nbs[i];
            if (nb >= 0 && nb < total) {
              if (grid[nb] === 0) {
                isEdge = true;
              } else if (!visited[nb]) {
                visited[nb] = 1;
                queue.push(nb);
              }
            } else {
              isEdge = true;
            }
          }
          if (isEdge) {
            boundaryPts.push({ x: cx, y: cy });
          }
        }

        if (queue.length >= minSize) {
          comps.push({ size: queue.length, boundary: boundaryPts });
        }
      }
    }
  }

  return comps;
}

/**
 * Score a candidate quad based on size, aspect ratio (NID standard ~1.58),
 * right-angle rectangularity, and edge gradient transition.
 */
function scoreQuad(quad, W, H, gradMap) {
  const area = polygonArea(quad);
  const totalArea = W * H;
  const areaRatio = area / totalArea;

  const ordered = orderCorners(quad);
  const topW = Math.hypot(ordered[1].x - ordered[0].x, ordered[1].y - ordered[0].y);
  const botW = Math.hypot(ordered[2].x - ordered[3].x, ordered[2].y - ordered[3].y);
  const leftH = Math.hypot(ordered[3].x - ordered[0].x, ordered[3].y - ordered[0].y);
  const rightH = Math.hypot(ordered[2].x - ordered[1].x, ordered[2].y - ordered[1].y);

  // Reject degenerate or excessively skewed quadrilaterals
  const widthSkew = Math.max(topW, botW) / (Math.min(topW, botW) || 1);
  const heightSkew = Math.max(leftH, rightH) / (Math.min(leftH, rightH) || 1);
  if (widthSkew > 2.3 || heightSkew > 2.3) {
    return -Infinity;
  }

  // 1. Area score
  let areaScore = 0;
  if (areaRatio >= 0.20 && areaRatio <= 0.85) {
    areaScore = 50;
  } else if (areaRatio >= 0.12 && areaRatio < 0.20) {
    areaScore = 30;
  } else if (areaRatio > 0.85 && areaRatio <= 0.92) {
    areaScore = 35;
  } else {
    areaScore = 10;
  }

  // 2. Aspect ratio score (standard ID-1 / CR80 card ratio is ~1.586, documents ~1.3-1.5)
  const avgW = (topW + botW) / 2;
  const avgH = (leftH + rightH) / 2;
  const ratio = Math.max(avgW, avgH) / (Math.min(avgW, avgH) || 1);

  let ratioScore = 0;
  if (ratio >= 1.25 && ratio <= 1.85) {
    ratioScore = 35;
  } else if (ratio >= 1.05 && ratio <= 2.2) {
    ratioScore = 15;
  }

  // 3. Rectangularity: check angles near 90 deg
  let angleScore = 0;
  for (let i = 0; i < 4; i++) {
    const p1 = ordered[i];
    const p2 = ordered[(i + 1) % 4];
    const p3 = ordered[(i + 2) % 4];
    const v1x = p1.x - p2.x, v1y = p1.y - p2.y;
    const v2x = p3.x - p2.x, v2y = p3.y - p2.y;
    const d1 = Math.hypot(v1x, v1y), d2 = Math.hypot(v2x, v2y);
    if (d1 > 0 && d2 > 0) {
      const cosA = Math.abs((v1x * v2x + v1y * v2y) / (d1 * d2));
      if (cosA < 0.26) angleScore += 10; // within ~15 deg of 90 degrees
    }
  }

  // 4. Edge gradient alignment
  let edgeGradSum = 0;
  let edgeSampleCount = 0;
  if (gradMap) {
    for (let i = 0; i < 4; i++) {
      const p1 = ordered[i];
      const p2 = ordered[(i + 1) % 4];
      const steps = 12;
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const sx = Math.round(p1.x + (p2.x - p1.x) * t);
        const sy = Math.round(p1.y + (p2.y - p1.y) * t);
        if (sx >= 0 && sx < W && sy >= 0 && sy < H) {
          edgeGradSum += gradMap[sy * W + sx] || 0;
          edgeSampleCount++;
        }
      }
    }
  }
  const avgEdgeGrad = edgeSampleCount > 0 ? edgeGradSum / edgeSampleCount : 0;
  const edgeScore = Math.min(30, avgEdgeGrad);

  return areaScore + ratioScore + angleScore + edgeScore;
}

/**
 * Pure image processing core: detects document / card 4-corners from raw RGBA pixel data.
 * Total: never throws; always returns 4 valid corners.
 *
 * @param {Uint8ClampedArray|Uint8Array|Array<number>} data - RGBA pixels
 * @param {number} W - processing width
 * @param {number} H - processing height
 * @param {number} origW - original image width
 * @param {number} origH - original image height
 * @returns {Array<{x:number,y:number}>} 4 corners in original coords [TL, TR, BR, BL]
 */
export function detectCardCornersFromPixels(data, W, H, origW, origH) {
  const oW = Math.max(1, toFinite(origW, 100));
  const oH = Math.max(1, toFinite(origH, 100));

  // Fallback corners: 5% inset rectangle for uniform/blank images
  const insetCorners = [
    { x: Math.round(oW * 0.05), y: Math.round(oH * 0.05) },
    { x: Math.round(oW * 0.95), y: Math.round(oH * 0.05) },
    { x: Math.round(oW * 0.95), y: Math.round(oH * 0.95) },
    { x: Math.round(oW * 0.05), y: Math.round(oH * 0.95) },
  ];

  // Full-image corners for pre-cropped documents / scans
  const fullCorners = [
    { x: 0, y: 0 },
    { x: oW, y: 0 },
    { x: oW, y: oH },
    { x: 0, y: oH },
  ];

  if (!data || W < 10 || H < 10) {
    return insetCorners;
  }

  const totalPixels = W * H;

  // 1. Grayscale conversion & dynamic range measurement
  const gray = new Float32Array(totalPixels);
  let minLum = 255, maxLum = 0;
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    gray[i] = lum;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }

  // If image is blank/uniform (dynamic range < 15), return inset fallback
  if ((maxLum - minLum) < 15) {
    return insetCorners;
  }

  // 2. Separable 5-tap Gaussian Blur [1, 4, 6, 4, 1] / 16
  const blurH = new Float32Array(totalPixels);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - 2);
      const x1 = Math.max(0, x - 1);
      const x2 = x;
      const x3 = Math.min(W - 1, x + 1);
      const x4 = Math.min(W - 1, x + 2);
      blurH[row + x] = (
        gray[row + x0] * 1 +
        gray[row + x1] * 4 +
        gray[row + x2] * 6 +
        gray[row + x3] * 4 +
        gray[row + x4] * 1
      ) / 16;
    }
  }

  const blurred = new Float32Array(totalPixels);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - 2) * W;
    const y1 = Math.max(0, y - 1) * W;
    const y2 = y * W;
    const y3 = Math.min(H - 1, y + 1) * W;
    const y4 = Math.min(H - 1, y + 2) * W;
    for (let x = 0; x < W; x++) {
      blurred[y2 + x] = (
        blurH[y0 + x] * 1 +
        blurH[y1 + x] * 4 +
        blurH[y2 + x] * 6 +
        blurH[y3 + x] * 4 +
        blurH[y4 + x] * 1
      ) / 16;
    }
  }

  // 3. Sobel Gradient Magnitude
  const grad = new Float32Array(totalPixels);
  for (let y = 1; y < H - 1; y++) {
    const ym1 = (y - 1) * W;
    const y0  = y * W;
    const yp1 = (y + 1) * W;
    for (let x = 1; x < W - 1; x++) {
      const gx =
        -blurred[ym1 + x - 1] + blurred[ym1 + x + 1] +
        -2 * blurred[y0 + x - 1] + 2 * blurred[y0 + x + 1] +
        -blurred[yp1 + x - 1] + blurred[yp1 + x + 1];

      const gy =
        -blurred[ym1 + x - 1] - 2 * blurred[ym1 + x] - blurred[ym1 + x + 1] +
        blurred[yp1 + x - 1] + 2 * blurred[yp1 + x] + blurred[yp1 + x + 1];

      grad[y0 + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  // 4. Background border statistics & color distance mask
  let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
  for (let x = 0; x < W; x++) {
    const idx0 = x * 4;
    const idx1 = ((H - 1) * W + x) * 4;
    bgR += data[idx0] + data[idx1];
    bgG += data[idx0 + 1] + data[idx1 + 1];
    bgB += data[idx0 + 2] + data[idx1 + 2];
    bgCount += 2;
  }
  for (let y = 1; y < H - 1; y++) {
    const idx0 = (y * W) * 4;
    const idx1 = (y * W + W - 1) * 4;
    bgR += data[idx0] + data[idx1];
    bgG += data[idx0 + 1] + data[idx1 + 1];
    bgB += data[idx0 + 2] + data[idx1 + 2];
    bgCount += 2;
  }
  bgR /= Math.max(1, bgCount);
  bgG /= Math.max(1, bgCount);
  bgB /= Math.max(1, bgCount);

  const colorDistMask = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const dist = (Math.abs(data[idx] - bgR) + Math.abs(data[idx + 1] - bgG) + Math.abs(data[idx + 2] - bgB)) / 3;
    if (dist > 22) {
      colorDistMask[i] = 1;
    }
  }

  // 5. Otsu thresholding on blurred luminance
  const hist = new Int32Array(256);
  for (let i = 0; i < totalPixels; i++) {
    hist[Math.min(255, Math.max(0, Math.round(blurred[i])))]++;
  }
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let sumB = 0, wB = 0, maxVar = 0, otsuThresh = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = totalPixels - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) { maxVar = between; otsuThresh = t; }
  }

  const otsuMaskPos = new Uint8Array(totalPixels);
  const otsuMaskInv = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    if (blurred[i] > otsuThresh) otsuMaskPos[i] = 1;
    else otsuMaskInv[i] = 1;
  }

  // 6. Morphological Closing (7x7 kernel) to bridge gaps and create solid blobs
  const closedColor = morphClose(colorDistMask, W, H, 3);
  const closedOtsuPos = morphClose(otsuMaskPos, W, H, 3);
  const closedOtsuInv = morphClose(otsuMaskInv, W, H, 3);

  // 7. Extract Connected Components
  const minCompSize = Math.round(totalPixels * 0.15);
  const allComps = [
    ...extractComponentBoundaries(closedColor, W, H, minCompSize),
    ...extractComponentBoundaries(closedOtsuPos, W, H, minCompSize),
    ...extractComponentBoundaries(closedOtsuInv, W, H, minCompSize),
  ];

  // 8. Generate and score candidate quads
  const candidates = [];
  for (const comp of allComps) {
    const areaRatio = comp.size / totalPixels;
    // A card on a background typically occupies between 15% and 88% of the frame
    if (areaRatio >= 0.15 && areaRatio <= 0.88) {
      const hull = convexHull(comp.boundary);
      if (hull.length >= 4) {
        // Strategy A: Minimum Area Oriented Bounding Rectangle (Rotating Calipers)
        const orientedRect = minAreaOrientedRect(hull);
        if (orientedRect && isConvex(orientedRect)) {
          candidates.push(orientedRect);
        }

        // Strategy B: 4 Extreme Projections on Convex Hull
        const extremeQuad = orderCorners(hull);
        if (extremeQuad && isConvex(extremeQuad)) {
          candidates.push(extremeQuad);
        }
      }
    }
  }

  // 9. Find the best scoring candidate
  let bestQuad = null;
  let bestScore = -Infinity;

  for (const quad of candidates) {
    if (!isConvex(quad)) continue;
    const score = scoreQuad(quad, W, H, grad);
    if (score > bestScore) {
      bestScore = score;
      bestQuad = quad;
    }
  }

  // 10. Lens Decision Logic:
  // If a strong candidate is found with confidence score >= 50:
  // Return the detected card corners scaled to original image dimensions!
  if (bestQuad && bestScore >= 50) {
    const ordered = orderCorners(bestQuad);
    const scaleX = oW / W;
    const scaleY = oH / H;
    return ordered.map(p => ({
      x: Math.round(Math.min(oW, Math.max(0, p.x * scaleX))),
      y: Math.round(Math.min(oH, Math.max(0, p.y * scaleY))),
    }));
  }

  // If no high-contrast card on a background is found, the document is either:
  // - A flatbed scan, pre-cropped image, or camera frame closely filled by the document:
  // Microsoft Lens selects the full document frame [0,0] to [oW, oH]!
  return fullCorners;
}

/**
 * High-level detection entry point. Accepts an HTMLImageElement, HTMLCanvasElement,
 * or an object with { data, width, height } and returns the 4 card corner coordinates
 * in original image pixels.
 *
 * @param {HTMLImageElement|HTMLCanvasElement|Object} imageSource
 * @param {number} [naturalWidth]
 * @param {number} [naturalHeight]
 * @param {Document} [providedDoc]
 * @returns {Array<{x:number,y:number}>} [TL, TR, BR, BL] in original pixels
 */
export function detectCardCorners(imageSource, naturalWidth, naturalHeight, providedDoc) {
  try {
    if (!imageSource) {
      const w = toFinite(naturalWidth, 100);
      const h = toFinite(naturalHeight, 100);
      return [
        { x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h },
      ];
    }

    // Direct pixel data object provided (e.g. tests or ImageData)
    if (imageSource.data && imageSource.width && imageSource.height) {
      const origW = naturalWidth || imageSource.width;
      const origH = naturalHeight || imageSource.height;
      return detectCardCornersFromPixels(imageSource.data, imageSource.width, imageSource.height, origW, origH);
    }

    const origW = naturalWidth || imageSource.naturalWidth || imageSource.width || 0;
    const origH = naturalHeight || imageSource.naturalHeight || imageSource.height || 0;

    if (origW <= 0 || origH <= 0) {
      return [
        { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 },
      ];
    }

    const doc = providedDoc || (typeof document !== 'undefined' ? document : null);
    if (!doc || typeof doc.createElement !== 'function') {
      return [
        { x: 0, y: 0 },
        { x: origW, y: 0 },
        { x: origW, y: origH },
        { x: 0, y: origH },
      ];
    }

    // Calculate downscaled processing dimensions
    const scale = Math.min(TARGET_MAX_DIM / origW, TARGET_MAX_DIM / origH, 1);
    const procW = Math.max(16, Math.round(origW * scale));
    const procH = Math.max(16, Math.round(origH * scale));

    const canvas = doc.createElement('canvas');
    canvas.width = procW;
    canvas.height = procH;
    let ctx = null;
    try {
      ctx = canvas.getContext('2d');
    } catch (_e) {
      ctx = null;
    }
    if (!ctx) {
      return [
        { x: 0, y: 0 },
        { x: origW, y: 0 },
        { x: origW, y: origH },
        { x: 0, y: origH },
      ];
    }

    ctx.drawImage(imageSource, 0, 0, procW, procH);
    const imgData = ctx.getImageData(0, 0, procW, procH);

    return detectCardCornersFromPixels(imgData.data, procW, procH, origW, origH);
  } catch (_err) {
    const w = toFinite(naturalWidth, 100);
    const h = toFinite(naturalHeight, 100);
    return [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ];
  }
}

export default detectCardCorners;
