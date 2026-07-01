import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { applyFilter, FILTER_NAMES } from "../src/core/filters.js";

// Feature: nid-stack-enhance-redesign, Property 10: Filter base-application
//
// Filters always read from the unfiltered base buffer and return a NEW buffer,
// so switching filters applies to the base rather than compounding on an
// already-filtered result. Concretely, for any base RGBA buffer and any filter:
//   (1) applyFilter never mutates the input base buffer,
//   (2) applyFilter('none', ...) returns pixels identical to the base,
//   (3) applying a filter to the ORIGINAL base is deterministic and idempotent
//       with respect to re-running it on the base (filters apply to the base,
//       not compounding), and
//   (4) the alpha channel is preserved unchanged.
//
// Validates: Requirements 6.3, 6.5, 6.6

// Generate an RGBA base buffer together with consistent dimensions.
const imageArb = fc
  .tuple(fc.integer({ min: 1, max: 16 }), fc.integer({ min: 1, max: 16 }))
  .chain(([width, height]) =>
    fc
      .array(fc.integer({ min: 0, max: 255 }), {
        minLength: width * height * 4,
        maxLength: width * height * 4,
      })
      .map((bytes) => ({
        width,
        height,
        base: Uint8ClampedArray.from(bytes),
      }))
  );

const filterArb = fc.constantFrom(...FILTER_NAMES);

describe("Property 10: Filter base-application", () => {
  it("never mutates the input base buffer", () => {
    fc.assert(
      fc.property(imageArb, filterArb, ({ base, width, height }, name) => {
        const snapshot = Uint8ClampedArray.from(base);
        applyFilter(name, base, width, height);
        expect(Array.from(base)).toEqual(Array.from(snapshot));
      }),
      { numRuns: 200 }
    );
  });

  it("returns pixels identical to the base for the 'none' filter", () => {
    fc.assert(
      fc.property(imageArb, ({ base, width, height }) => {
        const out = applyFilter("none", base, width, height);
        expect(Array.from(out)).toEqual(Array.from(base));
      }),
      { numRuns: 200 }
    );
  });

  it("applies to the base (not compounding): re-running on the base gives the same result", () => {
    fc.assert(
      fc.property(imageArb, filterArb, ({ base, width, height }, name) => {
        const first = applyFilter(name, base, width, height);
        // Re-apply the SAME filter to the ORIGINAL base buffer. Because filters
        // read from the base rather than the previous output, the result must
        // match the first application exactly (no compounding).
        const second = applyFilter(name, base, width, height);
        expect(Array.from(second)).toEqual(Array.from(first));
      }),
      { numRuns: 200 }
    );
  });

  it("preserves the alpha channel for every filter", () => {
    fc.assert(
      fc.property(imageArb, filterArb, ({ base, width, height }, name) => {
        const out = applyFilter(name, base, width, height);
        for (let i = 3; i < base.length; i += 4) {
          expect(out[i]).toBe(base[i]);
        }
      }),
      { numRuns: 200 }
    );
  });
});
