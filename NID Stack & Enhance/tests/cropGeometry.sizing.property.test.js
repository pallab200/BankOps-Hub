import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { sizeCropCanvas } from "../src/core/cropGeometry.js";

// Feature: nid-stack-enhance-redesign, Property 13: Crop canvas sizing
//
// sizeCropCanvas fits the crop canvas inside the viewport while preserving the
// source image aspect ratio. For any positive image and viewport dimensions:
//   - canvasW <= viewportW and canvasH <= viewportH (within rounding), and
//   - the aspect ratio is preserved: canvasW/canvasH ≈ imgW/imgH.
// For any non-positive input, the result is a zero-size canvas.
//
// Validates: Requirements 10.6

// Positive, finite dimensions spanning a wide range of magnitudes.
const positiveDimArb = fc.double({
  min: 1e-3,
  max: 1e6,
  noNaN: true,
  noDefaultInfinity: true,
});

// Relative + absolute tolerance robust to magnitude.
function approxLte(a, b) {
  const eps = 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  return a <= b + eps;
}

function approxEqual(a, b) {
  const eps = 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= eps;
}

describe("Property 13: Crop canvas sizing", () => {
  it("fits within the viewport and preserves aspect ratio for positive inputs", () => {
    fc.assert(
      fc.property(
        positiveDimArb,
        positiveDimArb,
        positiveDimArb,
        positiveDimArb,
        (imgW, imgH, viewportW, viewportH) => {
          const { canvasW, canvasH } = sizeCropCanvas(
            imgW,
            imgH,
            viewportW,
            viewportH
          );

          // Never exceeds the viewport (within rounding).
          expect(approxLte(canvasW, viewportW)).toBe(true);
          expect(approxLte(canvasH, viewportH)).toBe(true);

          // Aspect ratio preserved: canvasW/canvasH ≈ imgW/imgH.
          // Cross-multiply to avoid division blow-ups: canvasW*imgH ≈ canvasH*imgW.
          expect(approxEqual(canvasW * imgH, canvasH * imgW)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("returns a zero-size canvas for non-positive inputs", () => {
    const nonPositiveArb = fc.double({
      min: -1e6,
      max: 0,
      noNaN: true,
      noDefaultInfinity: true,
    });
    const anyDimArb = fc.double({
      min: -1e6,
      max: 1e6,
      noNaN: true,
      noDefaultInfinity: true,
    });

    fc.assert(
      fc.property(
        anyDimArb,
        anyDimArb,
        anyDimArb,
        anyDimArb,
        nonPositiveArb,
        fc.integer({ min: 0, max: 3 }),
        (imgW, imgH, viewportW, viewportH, badValue, slot) => {
          // Inject a non-positive value into one of the four arguments.
          const dims = [imgW, imgH, viewportW, viewportH];
          dims[slot] = badValue;
          const { canvasW, canvasH, scale } = sizeCropCanvas(
            dims[0],
            dims[1],
            dims[2],
            dims[3]
          );
          expect(canvasW).toBe(0);
          expect(canvasH).toBe(0);
          expect(scale).toBe(0);
        }
      ),
      { numRuns: 200 }
    );
  });
});
