// Feature: nid-stack-enhance-redesign, Property 14: Reset to defaults
//
// Property 14: Reset to defaults
//   For any prior application state, performing a clear/reset yields a state
//   with no source images, no stored crop regions, no combined image, and no
//   adjusted image, and with spacing = 10, background = white (#ffffff),
//   brightness = contrast = saturation = 100, sharpness = 0, and filter = None.
//
// Validates: Requirements 8.1, 8.4

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  createAppState,
  createDefaultState,
  FILTER_NAMES,
  SLOTS,
  DEFAULT_SPACING,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_BRIGHTNESS,
  DEFAULT_CONTRAST,
  DEFAULT_SATURATION,
  DEFAULT_SHARPNESS,
  DEFAULT_FILTER,
} from "../src/core/appState.js";

// The documented default shape (Requirement 8.4).
const EXPECTED_DEFAULT = createDefaultState();

/**
 * Arbitrary mutation operations applied to a store. Each entry returns a
 * function that mutates the given store. The generated sequence stands in for
 * ANY prior application state the user might have produced through normal use.
 */
const mutationArb = fc.oneof(
  // Load an image into a slot.
  fc
    .record({
      slot: fc.constantFrom(...SLOTS),
      naturalWidth: fc.integer({ min: 1, max: 8000 }),
      naturalHeight: fc.integer({ min: 1, max: 8000 }),
    })
    .map((d) => (store) =>
      store.setSource(d.slot, {
        image: { tag: "img", w: d.naturalWidth, h: d.naturalHeight },
        naturalWidth: d.naturalWidth,
        naturalHeight: d.naturalHeight,
      })
    ),
  // Store a crop region for a slot.
  fc
    .record({
      slot: fc.constantFrom(...SLOTS),
      x: fc.integer({ min: 0, max: 4000 }),
      y: fc.integer({ min: 0, max: 4000 }),
      w: fc.integer({ min: 10, max: 4000 }),
      h: fc.integer({ min: 10, max: 4000 }),
    })
    .map((c) => (store) => store.setCrop(c.slot, { x: c.x, y: c.y, w: c.w, h: c.h })),
  // Change spacing (any number, including out-of-range; reset must still win).
  fc.integer({ min: -1000, max: 1000 }).map((v) => (store) => store.setSpacing(v)),
  // Change background color.
  fc
    .hexaString({ minLength: 6, maxLength: 6 })
    .map((hex) => (store) => store.setBackgroundColor(`#${hex}`)),
  // Change adjustments.
  fc
    .record({
      key: fc.constantFrom("brightness", "contrast", "saturation", "sharpness"),
      value: fc.integer({ min: -50, max: 250 }),
    })
    .map((a) => (store) => store.setAdjustment(a.key, a.value)),
  // Change filter.
  fc.constantFrom(...FILTER_NAMES).map((name) => (store) => store.setFilter(name)),
  // Set derived buffers.
  fc.constant((store) => store.setCombinedImage({ tag: "combined" })),
  fc.constant((store) => store.setAdjustedBase({ tag: "adjustedBase" })),
  fc.constant((store) => store.setAdjustedImage({ tag: "adjustedImage" })),
  // Toggle UI flags.
  fc.boolean().map((v) => (store) => store.setExportCombinedVisible(v)),
  fc.boolean().map((v) => (store) => store.setExportAdjustedVisible(v)),
  fc
    .record({ visible: fc.boolean(), value: fc.integer({ min: 0, max: 100 }) })
    .map((p) => (store) => store.setProgress(p.visible, p.value)),
  // Clear a single source slot.
  fc.constantFrom(...SLOTS).map((slot) => (store) => store.clearSource(slot))
);

describe("Property 14: Reset to defaults", () => {
  it("reset() yields the documented default state after ANY mutation sequence", () => {
    fc.assert(
      fc.property(fc.array(mutationArb, { maxLength: 40 }), (mutations) => {
        const store = createAppState();

        // Apply an arbitrary sequence of mutations to reach an arbitrary
        // prior application state.
        for (const apply of mutations) {
          apply(store);
        }

        // Perform the clear/reset.
        const after = store.reset();

        // The resulting state must deep-equal the documented default shape.
        expect(after).toEqual(EXPECTED_DEFAULT);

        // Explicit checks on the documented defaults (Req 8.4).
        expect(after.settings.spacing).toBe(DEFAULT_SPACING);
        expect(after.settings.backgroundColor).toBe(DEFAULT_BACKGROUND_COLOR);
        expect(after.adjustments.brightness).toBe(DEFAULT_BRIGHTNESS);
        expect(after.adjustments.contrast).toBe(DEFAULT_CONTRAST);
        expect(after.adjustments.saturation).toBe(DEFAULT_SATURATION);
        expect(after.adjustments.sharpness).toBe(DEFAULT_SHARPNESS);
        expect(after.filter).toBe(DEFAULT_FILTER);

        // No source images and no stored crop regions (Req 8.1).
        for (const slot of SLOTS) {
          expect(after.sources[slot].image).toBeNull();
          expect(after.sources[slot].naturalWidth).toBe(0);
          expect(after.sources[slot].naturalHeight).toBe(0);
          expect(after.sources[slot].crop).toBeNull();
        }

        // No combined or adjusted buffers (Req 8.1).
        expect(after.combinedImage).toBeNull();
        expect(after.adjustedBase).toBeNull();
        expect(after.adjustedImage).toBeNull();

        // Export controls hidden and progress reset to hidden/no value (Req 8.3).
        expect(after.ui.exportCombinedVisible).toBe(false);
        expect(after.ui.exportAdjustedVisible).toBe(false);
        expect(after.ui.progressVisible).toBe(false);
        expect(after.ui.progressValue).toBeNull();
      }),
      { numRuns: 200 }
    );
  });
});
