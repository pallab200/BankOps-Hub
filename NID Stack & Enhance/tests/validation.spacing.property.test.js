// Feature: nid-stack-enhance-redesign, Property 3: Spacing validation
//
// Property 3: For any candidate spacing value, spacing validation accepts it if
// and only if it is a whole number in the range 0 to 500 inclusive; for any
// rejected value the previously accepted Spacing_Value is returned unchanged.
//
// Validates: Requirements 4.1, 4.2

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  validateSpacing,
  SPACING_MIN,
  SPACING_MAX,
} from "../src/core/validation.js";

describe("validateSpacing (Property 3: Spacing validation)", () => {
  it("accepts whole numbers 0..500 inclusive, returning ok with the value", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: SPACING_MIN, max: SPACING_MAX }),
        // arbitrary previous value, including out-of-range, to confirm it is
        // not consulted when the candidate is valid
        fc.integer({ min: -1000, max: 1000 }),
        (value, previous) => {
          const result = validateSpacing(value, previous);
          expect(result.ok).toBe(true);
          expect(result.value).toBe(value);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("rejects any non-accepted input and preserves the previous value", () => {
    // Generator for inputs that must be rejected: non-integers, negatives,
    // values above 500, and non-finite numbers.
    const rejectedArb = fc.oneof(
      // out-of-range integers (negative or > 500)
      fc.oneof(
        fc.integer({ min: -100000, max: SPACING_MIN - 1 }),
        fc.integer({ min: SPACING_MAX + 1, max: 100000 })
      ),
      // non-integer finite numbers
      fc
        .double({ noNaN: true, noDefaultInfinity: true })
        .filter((n) => !Number.isInteger(n)),
      // non-finite values
      fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY)
    );

    fc.assert(
      fc.property(
        rejectedArb,
        fc.integer({ min: SPACING_MIN, max: SPACING_MAX }),
        (value, previous) => {
          const result = validateSpacing(value, previous);
          expect(result.ok).toBe(false);
          // The previously accepted value is preserved unchanged.
          expect(result.value).toBe(previous);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("accepts if and only if the value is a whole number in [0, 500]", () => {
    // Cross-check the acceptance condition over an arbitrary numeric domain
    // spanning the boundaries and beyond.
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -50, max: 550 }),
          fc.double({ noNaN: true, noDefaultInfinity: true, min: -50, max: 550 })
        ),
        fc.integer({ min: SPACING_MIN, max: SPACING_MAX }),
        (value, previous) => {
          const shouldAccept =
            Number.isInteger(value) &&
            value >= SPACING_MIN &&
            value <= SPACING_MAX;
          const result = validateSpacing(value, previous);
          expect(result.ok).toBe(shouldAccept);
          if (shouldAccept) {
            expect(result.value).toBe(value);
          } else {
            expect(result.value).toBe(previous);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
