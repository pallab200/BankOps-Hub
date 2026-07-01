// Feature: nid-stack-enhance-redesign, Property 9: Adjustment identity at defaults
//
// Property 9: Adjustment identity at defaults
//   For any RGBA pixel buffer and any image dimensions, calling adjust() with
//   brightness = 100, contrast = 100, saturation = 100 and sharpness = 0
//   returns a buffer whose pixel values are identical to the input.
//
// Validates: Requirements 5.7

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { adjust, isIdentity } from "../src/core/imageAdjust.js";

/**
 * Generate an RGBA buffer together with width/height whose product matches the
 * buffer length, plus the raw byte array for comparison. We pick a width and
 * height first, then fill width*height*4 random bytes. Dimensions are kept
 * small so the test stays fast across 100+ runs.
 */
const imageArb = fc
  .record({
    width: fc.integer({ min: 0, max: 16 }),
    height: fc.integer({ min: 0, max: 16 }),
  })
  .chain(({ width, height }) =>
    fc
      .array(fc.integer({ min: 0, max: 255 }), {
        minLength: width * height * 4,
        maxLength: width * height * 4,
      })
      .map((bytes) => ({ width, height, bytes }))
  );

describe("Property 9: Adjustment identity at defaults", () => {
  it("adjust() at default values returns a pixel-identical buffer", () => {
    fc.assert(
      fc.property(imageArb, ({ width, height, bytes }) => {
        const input = Uint8ClampedArray.from(bytes);
        const defaults = {
          brightness: 100,
          contrast: 100,
          saturation: 100,
          sharpness: 0,
        };

        // Sanity: these values are recognised as the identity transform.
        expect(
          isIdentity(
            defaults.brightness,
            defaults.contrast,
            defaults.saturation,
            defaults.sharpness
          )
        ).toBe(true);

        const result = adjust(input, width, height, defaults);

        // Same length and pixel-identical contents.
        expect(result.length).toBe(input.length);
        for (let i = 0; i < input.length; i += 1) {
          expect(result[i]).toBe(input[i]);
        }
      }),
      { numRuns: 200 }
    );
  });
});
