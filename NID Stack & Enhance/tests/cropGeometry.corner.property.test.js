// Feature: nid-stack-enhance-redesign, Property 4: Crop corner constraint
//
// Property 4: For any Crop_Region, any corner index, any pointer position, and
// any image bounds, moving that corner produces a region whose four corners all
// lie within the image bounds and whose width and height are each at least 10
// pixels (clamped to the image size) in original image coordinates.
//
// Validates: Requirements 3.3

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { constrainCorner, DEFAULT_MIN_PX } from "../src/core/cropGeometry.js";

// Arbitrary integer-valued region. Width/height may be anything (including
// degenerate/oversized) because constrainCorner is total and must repair it.
const regionArb = fc.record({
  x: fc.integer({ min: -50, max: 600 }),
  y: fc.integer({ min: -50, max: 600 }),
  w: fc.integer({ min: -50, max: 600 }),
  h: fc.integer({ min: -50, max: 600 }),
});

// Arbitrary image bounds. Include 0 and small sizes so the min-px clamp to the
// image size is exercised.
const boundsArb = fc.record({
  width: fc.integer({ min: 0, max: 800 }),
  height: fc.integer({ min: 0, max: 800 }),
});

// Pointer anywhere, including outside the image, to confirm clamping.
const pointerArb = fc.record({
  x: fc.integer({ min: -200, max: 1000 }),
  y: fc.integer({ min: -200, max: 1000 }),
});

// Corner index, including values outside 0..3 (wrapped mod 4 by the function).
const cornerArb = fc.integer({ min: -8, max: 12 });

describe("constrainCorner (Property 4: Crop corner constraint)", () => {
  it("keeps all four corners in bounds and enforces the clamped minimum size", () => {
    fc.assert(
      fc.property(
        regionArb,
        cornerArb,
        pointerArb,
        boundsArb,
        (region, cornerIndex, pointer, bounds) => {
          const result = constrainCorner(region, cornerIndex, pointer, bounds);

          // The minimum is 10 px, but cannot exceed what the image can hold.
          const minW = Math.min(DEFAULT_MIN_PX, bounds.width);
          const minH = Math.min(DEFAULT_MIN_PX, bounds.height);

          // (a) All four corners lie within [0,width] x [0,height].
          expect(result.x).toBeGreaterThanOrEqual(0);
          expect(result.y).toBeGreaterThanOrEqual(0);
          expect(result.x + result.w).toBeLessThanOrEqual(bounds.width);
          expect(result.y + result.h).toBeLessThanOrEqual(bounds.height);

          // (b) Width and height are each at least the clamped minimum.
          expect(result.w).toBeGreaterThanOrEqual(minW);
          expect(result.h).toBeGreaterThanOrEqual(minH);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("respects a custom minimum size clamped to the image bounds", () => {
    fc.assert(
      fc.property(
        regionArb,
        cornerArb,
        pointerArb,
        boundsArb,
        fc.integer({ min: 0, max: 100 }),
        (region, cornerIndex, pointer, bounds, minPx) => {
          const result = constrainCorner(
            region,
            cornerIndex,
            pointer,
            bounds,
            minPx
          );

          const minW = Math.min(minPx, bounds.width);
          const minH = Math.min(minPx, bounds.height);

          expect(result.x).toBeGreaterThanOrEqual(0);
          expect(result.y).toBeGreaterThanOrEqual(0);
          expect(result.x + result.w).toBeLessThanOrEqual(bounds.width);
          expect(result.y + result.h).toBeLessThanOrEqual(bounds.height);
          expect(result.w).toBeGreaterThanOrEqual(minW);
          expect(result.h).toBeGreaterThanOrEqual(minH);
        }
      ),
      { numRuns: 200 }
    );
  });
});
