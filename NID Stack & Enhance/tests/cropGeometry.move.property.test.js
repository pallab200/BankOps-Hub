import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { constrainMove } from "../src/core/cropGeometry.js";

// Feature: nid-stack-enhance-redesign, Property 5: Crop region move preserves size
//
// For any Crop_Region and any move delta, moving the entire region produces a
// region with all four corners within the image bounds and with width and
// height identical to the original region's width and height.
//
// Validates: Requirements 3.4

// Generate image bounds (at least 1x1 so a region can fit inside).
const boundsArb = fc.record({
  width: fc.integer({ min: 1, max: 3000 }),
  height: fc.integer({ min: 1, max: 3000 }),
});

// Given bounds, generate a region that fits entirely within those bounds:
// 0 <= x, x + w <= width and 0 <= y, y + h <= height.
function regionWithinBounds(bounds) {
  return fc
    .record({
      w: fc.integer({ min: 0, max: bounds.width }),
      h: fc.integer({ min: 0, max: bounds.height }),
    })
    .chain(({ w, h }) =>
      fc.record({
        x: fc.integer({ min: 0, max: bounds.width - w }),
        y: fc.integer({ min: 0, max: bounds.height - h }),
        w: fc.constant(w),
        h: fc.constant(h),
      })
    );
}

// Arbitrary move delta, including values that would push the region off-image.
const deltaArb = fc.record({
  dx: fc.integer({ min: -5000, max: 5000 }),
  dy: fc.integer({ min: -5000, max: 5000 }),
});

describe("Property 5: Crop region move preserves size", () => {
  it("preserves width and height and keeps all corners within bounds for any delta", () => {
    fc.assert(
      fc.property(
        boundsArb.chain((bounds) =>
          fc.record({
            bounds: fc.constant(bounds),
            region: regionWithinBounds(bounds),
            delta: deltaArb,
          })
        ),
        ({ bounds, region, delta }) => {
          const moved = constrainMove(region, delta, bounds);

          // Size is preserved exactly.
          expect(moved.w).toBe(region.w);
          expect(moved.h).toBe(region.h);

          // All four corners lie within the image bounds.
          expect(moved.x).toBeGreaterThanOrEqual(0);
          expect(moved.y).toBeGreaterThanOrEqual(0);
          expect(moved.x + moved.w).toBeLessThanOrEqual(bounds.width);
          expect(moved.y + moved.h).toBeLessThanOrEqual(bounds.height);
        }
      ),
      { numRuns: 200 }
    );
  });
});
