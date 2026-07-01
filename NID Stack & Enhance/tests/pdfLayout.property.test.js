import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  fitImageToPage,
  A4_PORTRAIT,
  DEFAULT_MARGIN_MM,
} from "../src/core/pdfLayout.js";

// Feature: nid-stack-enhance-redesign, Property 11: PDF fit and margins
//
// fitImageToPage scales an image to fit entirely within the printable area
// (page minus a uniform 12.7 mm margin on all four sides), preserving aspect
// ratio, and centers it within that printable area. For ANY positive image
// dimensions the result must:
//   (1) stay within the printable bounds (every side's margin >= the uniform
//       margin, within a small epsilon);
//   (2) preserve the aspect ratio within 1% (w/h ~= imgW/imgH);
//   (3) be centered: left margin == right margin and top margin == bottom
//       margin (within epsilon);
//   (4) fully use the printable area on the fitting axis: at least one axis has
//       a margin equal to the uniform margin (within epsilon).
//
// Validates: Requirements 7.3, 7.4

const EPSILON = 1e-6;

// Arbitrary positive image dimensions spanning extreme aspect ratios.
const dimArb = fc.double({
  min: 1e-3,
  max: 1e6,
  noNaN: true,
  noDefaultInfinity: true,
});

describe("Property 11: PDF fit and margins", () => {
  it("fits within printable bounds, preserves aspect ratio, and centers on an A4 page", () => {
    fc.assert(
      fc.property(dimArb, dimArb, (imgW, imgH) => {
        const { x, y, w, h } = fitImageToPage(imgW, imgH);

        const pageW = A4_PORTRAIT.widthMm;
        const pageH = A4_PORTRAIT.heightMm;

        const leftMargin = x;
        const rightMargin = pageW - (x + w);
        const topMargin = y;
        const bottomMargin = pageH - (y + h);

        // (1) Image stays within the printable area: every margin is at least
        // the uniform margin (within epsilon).
        expect(leftMargin).toBeGreaterThanOrEqual(DEFAULT_MARGIN_MM - EPSILON);
        expect(rightMargin).toBeGreaterThanOrEqual(DEFAULT_MARGIN_MM - EPSILON);
        expect(topMargin).toBeGreaterThanOrEqual(DEFAULT_MARGIN_MM - EPSILON);
        expect(bottomMargin).toBeGreaterThanOrEqual(DEFAULT_MARGIN_MM - EPSILON);

        // (2) Aspect ratio preserved within 1%.
        expect(w).toBeGreaterThan(0);
        expect(h).toBeGreaterThan(0);
        const expectedRatio = imgW / imgH;
        const actualRatio = w / h;
        expect(Math.abs(actualRatio - expectedRatio)).toBeLessThanOrEqual(
          Math.abs(expectedRatio) * 0.01
        );

        // (3) Centered within the printable area.
        expect(Math.abs(leftMargin - rightMargin)).toBeLessThanOrEqual(1e-4);
        expect(Math.abs(topMargin - bottomMargin)).toBeLessThanOrEqual(1e-4);

        // (4) The fitting axis touches the uniform margin exactly, so the image
        // fully uses the printable area along at least one axis.
        const touchesHorizontal =
          Math.abs(leftMargin - DEFAULT_MARGIN_MM) <= 1e-4;
        const touchesVertical =
          Math.abs(topMargin - DEFAULT_MARGIN_MM) <= 1e-4;
        expect(touchesHorizontal || touchesVertical).toBe(true);
      }),
      { numRuns: 200 }
    );
  });
});
