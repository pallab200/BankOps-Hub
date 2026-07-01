import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeLayout } from "../src/core/combineLayout.js";

// Feature: nid-stack-enhance-redesign, Property 8: Combine layout integrity
//
// For any set of loaded sources (front only, back only, or both), any stored
// crops, and any valid spacing, the computed layout (a) includes exactly the
// loaded sources in front-then-back order, (b) gives every placement a
// destination width equal to the target width, (c) inserts a vertical gap
// equal to the spacing between adjacent placements, and (d) has a total height
// equal to the sum of the placement heights plus (n - 1) * spacing.
//
// Validates: Requirements 4.4, 4.5

// A source slot with arbitrary natural dimensions and an optional stored crop.
const slotArb = fc.record({
  naturalWidth: fc.integer({ min: 0, max: 3000 }),
  naturalHeight: fc.integer({ min: 0, max: 3000 }),
  crop: fc.option(
    fc.record({
      x: fc.integer({ min: 0, max: 1000 }),
      y: fc.integer({ min: 0, max: 1000 }),
      w: fc.integer({ min: 0, max: 3000 }),
      h: fc.integer({ min: 0, max: 3000 }),
    }),
    { nil: null }
  ),
}).map((s) => ({ image: {}, ...s }));

// The cropped width the layout uses for a slot: crop width when a crop is
// stored, otherwise the (clamped) natural width.
function croppedWidth(slot) {
  const crop = slot.crop;
  if (crop && Number.isFinite(crop.w) && Number.isFinite(crop.h)) {
    return Math.max(0, crop.w);
  }
  return Math.max(0, slot.naturalWidth);
}

// 1 or 2 sources, modeled as the appState { front, back } shape with at least
// one non-null slot, so we also exercise front-then-back ordering/filtering.
const sourcesArb = fc
  .tuple(fc.option(slotArb, { nil: null }), fc.option(slotArb, { nil: null }))
  .filter(([front, back]) => front != null || back != null)
  .map(([front, back]) => ({ front, back }));

describe("Property 8: Combine layout integrity", () => {
  it("stacks loaded sources front-then-back with correct widths, spacing, and total height", () => {
    fc.assert(
      fc.property(sourcesArb, fc.integer({ min: 0, max: 500 }), (sources, spacing) => {
        const layout = computeLayout(sources, spacing);

        // Expected loaded slots in front-then-back order.
        const expectedSlots = [sources.front, sources.back].filter((s) => s != null);

        // (a) Includes exactly the loaded sources in front-then-back order.
        expect(layout.placements).toHaveLength(expectedSlots.length);
        layout.placements.forEach((p, i) => {
          expect(p.src).toBe(expectedSlots[i]);
        });

        // targetWidth is the max cropped width among included sources.
        const expectedTargetWidth = expectedSlots.reduce(
          (max, slot) => Math.max(max, croppedWidth(slot)),
          0
        );
        expect(layout.targetWidth).toBe(expectedTargetWidth);

        // (b) Every placement destination width equals the target width.
        layout.placements.forEach((p) => {
          expect(p.dstRect.w).toBe(layout.targetWidth);
        });

        // (c) Placements stack with no overlap: each y = previous y + previous
        // h + spacing, with the first placement at y = 0.
        layout.placements.forEach((p, i) => {
          if (i === 0) {
            expect(p.dstRect.y).toBe(0);
          } else {
            const prev = layout.placements[i - 1];
            expect(p.dstRect.y).toBe(prev.dstRect.y + prev.dstRect.h + spacing);
          }
        });

        // (d) Total height = sum(placement heights) + (n - 1) * spacing.
        const sumHeights = layout.placements.reduce((sum, p) => sum + p.dstRect.h, 0);
        const n = layout.placements.length;
        expect(layout.totalHeight).toBe(sumHeights + (n - 1) * spacing);
      }),
      { numRuns: 200 }
    );
  });
});
