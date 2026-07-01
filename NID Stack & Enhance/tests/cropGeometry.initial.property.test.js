import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { initialRegion } from "../src/core/cropGeometry.js";

// Feature: nid-stack-enhance-redesign, Property 7: Crop initial region equals full bounds
//
// For any non-negative image dimensions (imgW, imgH), initialRegion returns a
// Crop_Region anchored at the origin {x:0, y:0} whose width and height equal
// the image dimensions, so the region covers the full image bounds.
//
// Validates: Requirements 3.1

describe("Property 7: Crop initial region equals full bounds", () => {
  it("returns a region at the origin covering the full image bounds", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 0, max: 10000 }),
        (imgW, imgH) => {
          const region = initialRegion(imgW, imgH);

          // Anchored at the origin.
          expect(region.x).toBe(0);
          expect(region.y).toBe(0);

          // Covers the full image bounds.
          expect(region.w).toBe(imgW);
          expect(region.h).toBe(imgH);
        }
      ),
      { numRuns: 200 }
    );
  });
});
