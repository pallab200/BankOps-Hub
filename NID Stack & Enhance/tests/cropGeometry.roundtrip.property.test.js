import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { displayToOriginal, originalToDisplay } from "../src/core/cropGeometry.js";

// Feature: nid-stack-enhance-redesign, Property 6: Crop coordinate round trip
//
// display = original * scale and original = display / scale are exact inverses.
// For any point and any non-zero finite scale, converting in one direction and
// back recovers the original point (within a small epsilon to allow for
// floating-point rounding). Both directions round-trip.
//
// Validates: Requirements 3.5

// A finite coordinate point with a wide but bounded range.
const pointArb = fc.record({
  x: fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
  y: fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
});

// A non-zero finite scale factor (both small and large magnitudes).
const scaleArb = fc
  .double({ min: -1e4, max: 1e4, noNaN: true, noDefaultInfinity: true })
  .filter((s) => s !== 0 && Math.abs(s) > 1e-6);

// Relative + absolute tolerance comparison robust to magnitude.
function approxEqual(a, b) {
  const eps = 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= eps;
}

describe("Property 6: Crop coordinate round trip", () => {
  it("originalToDisplay(displayToOriginal(p)) recovers p", () => {
    fc.assert(
      fc.property(pointArb, scaleArb, (p, scale) => {
        const back = originalToDisplay(displayToOriginal(p, scale), scale);
        expect(approxEqual(back.x, p.x)).toBe(true);
        expect(approxEqual(back.y, p.y)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("displayToOriginal(originalToDisplay(p)) recovers p", () => {
    fc.assert(
      fc.property(pointArb, scaleArb, (p, scale) => {
        const back = displayToOriginal(originalToDisplay(p, scale), scale);
        expect(approxEqual(back.x, p.x)).toBe(true);
        expect(approxEqual(back.y, p.y)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });
});
