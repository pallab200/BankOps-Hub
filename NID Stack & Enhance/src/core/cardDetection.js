// cardDetection.js — Automatic 4-corner document / card boundary detection.
//
// Detects the 4 corners of an ID card (like NID) in an image, similar to
// Microsoft Lens, CamScanner, and modern document scanner apps.
//
// Pipeline:
//  1. Downscale to a fast processing size (max dimension ~320px) for speed (<50ms).
//  2. Grayscale & 5-tap separable Gaussian blur to reduce text/noise.
//  3. Multi-strategy edge and foreground extraction:
//     - Strategy A: Sobel gradient + Non-Maximum Suppression (NMS) + hysteresis + dilation.
//     - Strategy B: Background border color distance & flood-fill foreground mask.
//  4. Moore-Neighbor contour tracing on binary candidate grids.
//  5. Closed-polygon Douglas-Peucker simplification across multiple epsilon scales.
//  6. Candidate scoring (area ratio, NID aspect ratio ~1.58, edge gradient alignment).
//  7. Fallback to 5% inset rectangle if image is textureless/blank (never fails/throws).
//  8. Re-scale corners back to original image coordinates in clockwise order [TL, TR, BR, BL].

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
 * Splits loop between two farthest points to prevent boundary seams.
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

  // Chain 1: idxA to idxB
  const chain1 = [];
  if (idxA < idxB) {
    for (let i = idxA; i <= idxB; i++) chain1.push(points[i]);
  } else {
    for (let i = idxA; i < n; i++) chain1.push(points[i]);
    for (let i = 0; i <= idxB; i++) chain1.push(points[i]);
  }

  // Chain 2: idxB to idxA
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
 * If a polygon has between 5 and 10 vertices (e.g. rounded card corners),
 * extracts the 4 vertices that maximize quadrilateral area and maintain convexity.
 */
function extractQuadFromPolygon(poly) {
  const n = poly.length;
  if (n < 4) return null;
  if (n === 4) return poly;

  let maxA = -1;
  let best = null;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        for (let l = k + 1; l < n; l++) {
          const q = [poly[i], poly[j], poly[k], poly[l]];
          const a = polygonArea(q);
          if (a > maxA && isConvex(q)) {
            maxA = a;
            best = q;
          }
        }
      }
    }
  }
  return best;
}

/**
 * Trace the external boundary of a connected component using Moore-Neighbor algorithm.
 */
function traceBoundary(grid, W, H, startX, startY, visited) {
  const dx = [-1, -1,  0,  1,  1,  1,  0, -1];
  const dy = [ 0, -1, -1, -1,  0,  1,  1,  1];

  const points = [{ x: startX, y: startY }];
  visited[startY * W + startX] = 1;

  let cx = startX;
  let cy = startY;
  let backtrackDir = 0;
  const maxSteps = 2500;

  for (let step = 0; step < maxSteps; step++) {
    let foundNext = false;
    for (let i = 0; i < 8; i++) {
      const dir = (backtrackDir + i) % 8;
      const nx = cx + dx[dir];
      const ny = cy + dy[dir];

      if (nx >= 0 && nx < W && ny >= 0 && ny < H && grid[ny * W + nx] === 1) {
        if (nx === startX && ny === startY && points.length > 3) {
          return points; // Closed loop completed
        }
        points.push({ x: nx, y: ny });
        visited[ny * W + nx] = 1;
        cx = nx;
        cy = ny;
        backtrackDir = (dir + 5) % 8;
        foundNext = true;
        break;
      }
    }
    if (!foundNext) break;
  }

  return points.length >= 10 ? points : null;
}

/**
 * Scan binary grid and extract candidate 4-corner quadrilaterals.
 */
function findContours(grid, W, H, candidateList) {
  const visited = new Uint8Array(W * H);
  const minArea = W * H * 0.08;
  const maxArea = W * H * 0.97;

  for (let y = 2; y < H - 2; y++) {
    const row = y * W;
    for (let x = 2; x < W - 2; x++) {
      const idx = row + x;
      if (grid[idx] === 1 && !visited[idx]) {
        const contour = traceBoundary(grid, W, H, x, y, visited);
        if (contour && contour.length >= 16) {
          const area = polygonArea(contour);
          if (area >= minArea && area <= maxArea) {
            const peri = polygonPerimeter(contour);
            for (const epsRatio of [0.015, 0.02, 0.03, 0.04, 0.05, 0.07, 0.09]) {
              const simplified = simplifyClosedPolygon(contour, epsRatio * peri);
              if (simplified.length === 4) {
                candidateList.push(simplified);
              } else if (simplified.length >= 5 && simplified.length <= 10) {
                const quad = extractQuadFromPolygon(simplified);
                if (quad) candidateList.push(quad);
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Score a candidate quad based on size, aspect ratio (NID standard ~1.58), and edge contrast.
 */
function scoreQuad(quad, W, H, gradMap) {
  const area = polygonArea(quad);
  const totalArea = W * H;
  const areaRatio = area / totalArea;

  // 1. Area score: prefer 20% to 85% of total image
  let areaScore = 0;
  if (areaRatio >= 0.20 && areaRatio <= 0.85) {
    areaScore = 50;
  } else if (areaRatio > 0.85) {
    areaScore = 50 - (areaRatio - 0.85) * 100;
  } else {
    areaScore = areaRatio * 150;
  }

  // 2. Aspect ratio score (standard NID card ratio is ~1.58)
  const ordered = orderCorners(quad);
  const topW = Math.hypot(ordered[1].x - ordered[0].x, ordered[1].y - ordered[0].y);
  const botW = Math.hypot(ordered[2].x - ordered[3].x, ordered[2].y - ordered[3].y);
  const leftH = Math.hypot(ordered[3].x - ordered[0].x, ordered[3].y - ordered[0].y);
  const rightH = Math.hypot(ordered[2].x - ordered[1].x, ordered[2].y - ordered[1].y);

  const avgW = (topW + botW) / 2;
  const avgH = (leftH + rightH) / 2;
  const ratio = Math.max(avgW, avgH) / (Math.min(avgW, avgH) || 1);

  // Reject degenerate / extremely-skewed quads where opposite edges are wildly
  // unequal in length. A genuine (even perspective-tilted) card keeps opposite
  // edges roughly comparable; a garbage quad whose corner flew off into the
  // background has one pair of edges far longer than the other. This is the
  // symptom the user saw (top-right corner shooting into empty background).
  const widthSkew = Math.max(topW, botW) / (Math.min(topW, botW) || 1);
  const heightSkew = Math.max(leftH, rightH) / (Math.min(leftH, rightH) || 1);
  if (widthSkew > 2.4 || heightSkew > 2.4) {
    return -Infinity;
  }

  let ratioScore = 0;
  if (ratio >= 1.25 && ratio <= 1.80) {
    ratioScore = 35; // Ideal NID aspect ratio
  } else if (ratio >= 1.05 && ratio <= 2.2) {
    ratioScore = 15;
  }

  // 3. Edge gradient score (sample pixels along the 4 edges in gradMap)
  let edgeGradSum = 0;
  let edgeSampleCount = 0;
  if (gradMap) {
    for (let i = 0; i < 4; i++) {
      const p1 = ordered[i];
      const p2 = ordered[(i + 1) % 4];
      const steps = 15;
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
  const edgeScore = Math.min(40, avgEdgeGrad);

  return areaScore + ratioScore + edgeScore;
}

/**
 * Pure image processing core: detects card 4-corners from raw RGBA pixel data.
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

  // Fallback inset rectangle (5% margin from edges)
  const defaultCorners = [
    { x: Math.round(oW * 0.05), y: Math.round(oH * 0.05) },
    { x: Math.round(oW * 0.95), y: Math.round(oH * 0.05) },
    { x: Math.round(oW * 0.95), y: Math.round(oH * 0.95) },
    { x: Math.round(oW * 0.05), y: Math.round(oH * 0.95) },
  ];

  if (!data || W < 10 || H < 10) {
    return defaultCorners;
  }

  const totalPixels = W * H;

  // 1. Grayscale conversion
  const gray = new Float32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
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

  // 3. Sobel Gradient & Direction Quantization
  const grad = new Float32Array(totalPixels);
  const dir = new Uint8Array(totalPixels); // 0=0deg, 1=45deg, 2=90deg, 3=135deg
  let gradSum = 0;
  let nonZeroCount = 0;

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

      const mag = Math.sqrt(gx * gx + gy * gy);
      const idx = y0 + x;
      grad[idx] = mag;
      if (mag > 5) {
        gradSum += mag;
        nonZeroCount++;
      }

      let angle = (Math.atan2(gy, gx) * 180) / Math.PI;
      if (angle < 0) angle += 180;
      if (angle >= 22.5 && angle < 67.5) {
        dir[idx] = 1;
      } else if (angle >= 67.5 && angle < 112.5) {
        dir[idx] = 2;
      } else if (angle >= 112.5 && angle < 157.5) {
        dir[idx] = 3;
      } else {
        dir[idx] = 0;
      }
    }
  }

  // 4. Non-Maximum Suppression (NMS)
  const nms = new Float32Array(totalPixels);
  for (let y = 2; y < H - 2; y++) {
    const row = y * W;
    for (let x = 2; x < W - 2; x++) {
      const idx = row + x;
      const m = grad[idx];
      if (m < 5) continue;

      let n1 = 0, n2 = 0;
      switch (dir[idx]) {
        case 0:
          n1 = grad[idx - 1]; n2 = grad[idx + 1];
          break;
        case 1:
          n1 = grad[idx - W + 1]; n2 = grad[idx + W - 1];
          break;
        case 2:
          n1 = grad[idx - W]; n2 = grad[idx + W];
          break;
        case 3:
          n1 = grad[idx - W - 1]; n2 = grad[idx + W + 1];
          break;
      }

      if (m >= n1 && m >= n2) {
        nms[idx] = m;
      }
    }
  }

  // 5. Hysteresis Thresholding
  const avgGrad = nonZeroCount > 0 ? gradSum / nonZeroCount : 20;
  const highThresh = Math.max(15, avgGrad * 1.2);
  const lowThresh = highThresh * 0.4;

  const edges = new Uint8Array(totalPixels);
  const strongQueue = [];

  for (let y = 1; y < H - 1; y++) {
    const row = y * W;
    for (let x = 1; x < W - 1; x++) {
      const idx = row + x;
      if (nms[idx] >= highThresh) {
        edges[idx] = 2;
        strongQueue.push(idx);
      } else if (nms[idx] >= lowThresh) {
        edges[idx] = 1;
      }
    }
  }

  let qHead = 0;
  while (qHead < strongQueue.length) {
    const curr = strongQueue[qHead++];
    const cx = curr % W;
    const cy = (curr / W) | 0;

    for (let dy = -1; dy <= 1; dy++) {
      const ny = cy + dy;
      if (ny < 0 || ny >= H) continue;
      const nrow = ny * W;
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        if (nx < 0 || nx >= W) continue;
        const nidx = nrow + nx;
        if (edges[nidx] === 1) {
          edges[nidx] = 2;
          strongQueue.push(nidx);
        }
      }
    }
  }

  // 6. Binary Edge Map & Morphological Dilation (3x3)
  const binaryEdges = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    binaryEdges[i] = edges[i] === 2 ? 1 : 0;
  }

  const dilated = new Uint8Array(totalPixels);
  for (let y = 1; y < H - 1; y++) {
    const ym1 = (y - 1) * W;
    const y0  = y * W;
    const yp1 = (y + 1) * W;
    for (let x = 1; x < W - 1; x++) {
      if (
        binaryEdges[ym1 + x - 1] || binaryEdges[ym1 + x] || binaryEdges[ym1 + x + 1] ||
        binaryEdges[y0 + x - 1]  || binaryEdges[y0 + x]  || binaryEdges[y0 + x + 1]  ||
        binaryEdges[yp1 + x - 1] || binaryEdges[yp1 + x] || binaryEdges[yp1 + x + 1]
      ) {
        dilated[y0 + x] = 1;
      }
    }
  }

  // 7. Strategy B: Background border color distance mask
  let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
  function sample(px, py) {
    const idx = (py * W + px) * 4;
    bgR += data[idx];
    bgG += data[idx + 1];
    bgB += data[idx + 2];
    bgCount++;
  }
  for (let x = 0; x < W; x++) {
    sample(x, 0); sample(x, 1);
    sample(x, H - 1); sample(x, H - 2);
  }
  for (let y = 2; y < H - 2; y++) {
    sample(0, y); sample(1, y);
    sample(W - 1, y); sample(W - 2, y);
  }
  bgR /= Math.max(1, bgCount);
  bgG /= Math.max(1, bgCount);
  bgB /= Math.max(1, bgCount);

  const fgMask = new Uint8Array(totalPixels);
  const colorDiffThresh = 28;
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const idx = (row + x) * 4;
      const dr = Math.abs(data[idx] - bgR);
      const dg = Math.abs(data[idx + 1] - bgG);
      const db = Math.abs(data[idx + 2] - bgB);
      const dist = (dr + dg + db) / 3;
      if (dist > colorDiffThresh) {
        fgMask[row + x] = 1;
      }
    }
  }

  // 8. Find candidate quads from both edge contours and foreground mask
  const candidates = [];
  findContours(dilated, W, H, candidates);
  findContours(fgMask, W, H, candidates);

  // 9. Score candidate quads
  const minArea = totalPixels * 0.10;
  const maxArea = totalPixels * 0.96;

  let bestQuad = null;
  let bestScore = -Infinity;

  for (const quad of candidates) {
    const area = polygonArea(quad);
    if (area < minArea || area > maxArea) continue;
    if (!isConvex(quad)) continue;

    const score = scoreQuad(quad, W, H, grad);
    if (score > bestScore) {
      bestScore = score;
      bestQuad = quad;
    }
  }

  // If no good card candidate was found, use default inset rectangle
  if (!bestQuad || bestScore < 10) {
    return defaultCorners;
  }

  // Order corners [TL, TR, BR, BL] and scale back to original image dimensions
  const ordered = orderCorners(bestQuad);
  const scaleX = oW / W;
  const scaleY = oH / H;

  return ordered.map(p => ({
    x: Math.round(Math.min(Math.max(0, p.x * scaleX), oW)),
    y: Math.round(Math.min(Math.max(0, p.y * scaleY), oH)),
  }));
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
      // No DOM/canvas available: fallback to inset rectangle
      return [
        { x: Math.round(origW * 0.05), y: Math.round(origH * 0.05) },
        { x: Math.round(origW * 0.95), y: Math.round(origH * 0.05) },
        { x: Math.round(origW * 0.95), y: Math.round(origH * 0.95) },
        { x: Math.round(origW * 0.05), y: Math.round(origH * 0.95) },
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
        { x: Math.round(origW * 0.05), y: Math.round(origH * 0.05) },
        { x: Math.round(origW * 0.95), y: Math.round(origH * 0.05) },
        { x: Math.round(origW * 0.95), y: Math.round(origH * 0.95) },
        { x: Math.round(origW * 0.05), y: Math.round(origH * 0.95) },
      ];
    }

    ctx.drawImage(imageSource, 0, 0, procW, procH);
    const imgData = ctx.getImageData(0, 0, procW, procH);

    return detectCardCornersFromPixels(imgData.data, procW, procH, origW, origH);
  } catch (_err) {
    // Total: fallback on any unexpected error
    const w = toFinite(naturalWidth, 100);
    const h = toFinite(naturalHeight, 100);
    return [
      { x: Math.round(w * 0.05), y: Math.round(h * 0.05) },
      { x: Math.round(w * 0.95), y: Math.round(h * 0.05) },
      { x: Math.round(w * 0.95), y: Math.round(h * 0.95) },
      { x: Math.round(w * 0.05), y: Math.round(h * 0.95) },
    ];
  }
}

export default detectCardCorners;
