import { describe, it, expect } from "vitest";
import {
  detectCardCorners,
  detectCardCornersFromPixels,
  orderCorners,
  polygonArea,
  polygonPerimeter,
  isConvex,
  convexHull,
  minAreaOrientedRect,
  simplifyClosedPolygon,
} from "../src/core/cardDetection.js";

// Helper to generate a test image buffer with a quadrilateral card on a background
function createTestBuffer(w, h, cardQuad, bgColor, cardColor) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = bgColor[0];
    data[i * 4 + 1] = bgColor[1];
    data[i * 4 + 2] = bgColor[2];
    data[i * 4 + 3] = 255;
  }

  function isInside(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isInside(x, y, cardQuad)) {
        const idx = (y * w + x) * 4;
        data[idx] = cardColor[0];
        data[idx + 1] = cardColor[1];
        data[idx + 2] = cardColor[2];
        data[idx + 3] = 255;
      }
    }
  }

  return { data, width: w, height: h };
}

describe("cardDetection module", () => {
  describe("orderCorners()", () => {
    it("orders points in clockwise [TL, TR, BR, BL] order", () => {
      const unordered = [
        { x: 200, y: 150 }, // BR
        { x: 50, y: 50 },   // TL
        { x: 50, y: 150 },  // BL
        { x: 200, y: 50 },  // TR
      ];

      const ordered = orderCorners(unordered);
      expect(ordered[0]).toEqual({ x: 50, y: 50 });   // TL
      expect(ordered[1]).toEqual({ x: 200, y: 50 });  // TR
      expect(ordered[2]).toEqual({ x: 200, y: 150 }); // BR
      expect(ordered[3]).toEqual({ x: 50, y: 150 });  // BL
    });

    it("is total when given null, empty or invalid array", () => {
      expect(orderCorners(null).length).toBe(4);
      expect(orderCorners([]).length).toBe(4);
      expect(orderCorners([{ x: 1, y: 1 }]).length).toBe(4);
    });
  });

  describe("polygon helpers", () => {
    it("calculates polygon area correctly for a rectangle", () => {
      const rect = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 50 },
      ];
      expect(polygonArea(rect)).toBe(5000);
    });

    it("calculates perimeter correctly for a rectangle", () => {
      const rect = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 50 },
      ];
      expect(polygonPerimeter(rect)).toBe(300);
    });

    it("identifies convex vs non-convex polygons", () => {
      const convexQuad = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 60 },
        { x: 0, y: 60 },
      ];
      expect(isConvex(convexQuad)).toBe(true);

      const nonConvex = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 30 }, // Inward dent
        { x: 100, y: 60 },
        { x: 0, y: 60 },
      ];
      expect(isConvex(nonConvex)).toBe(false);
    });

    it("computes convex hull correctly using Monotone Chain algorithm", () => {
      const points = [
        { x: 10, y: 10 },
        { x: 90, y: 10 },
        { x: 90, y: 50 },
        { x: 10, y: 50 },
        { x: 50, y: 30 }, // Internal point
        { x: 30, y: 20 }, // Internal point
      ];
      const hull = convexHull(points);
      expect(hull.length).toBe(4);
      const ordered = orderCorners(hull);
      expect(ordered[0]).toEqual({ x: 10, y: 10 });
      expect(ordered[1]).toEqual({ x: 90, y: 10 });
      expect(ordered[2]).toEqual({ x: 90, y: 50 });
      expect(ordered[3]).toEqual({ x: 10, y: 50 });
    });

    it("computes minimum-area oriented bounding rectangle via Rotating Calipers", () => {
      const rectPoints = [
        { x: 20, y: 20 },
        { x: 120, y: 20 },
        { x: 120, y: 70 },
        { x: 20, y: 70 },
      ];
      const hull = convexHull(rectPoints);
      const obb = minAreaOrientedRect(hull);
      expect(obb).not.toBeNull();
      expect(obb.length).toBe(4);
      expect(polygonArea(obb)).toBeCloseTo(5000, 0);
    });
  });

  describe("detectCardCornersFromPixels()", () => {
    it("accurately detects a high-contrast card on a background", () => {
      const origW = 1000;
      const origH = 600;
      const testQuad = [
        { x: 40, y: 30 },
        { x: 260, y: 30 },
        { x: 260, y: 170 },
        { x: 40, y: 170 },
      ];

      const img = createTestBuffer(300, 200, testQuad, [30, 30, 30], [230, 230, 230]);
      const corners = detectCardCornersFromPixels(img.data, 300, 200, origW, origH);

      expect(corners.length).toBe(4);
      // Expected scaled corners
      const scaleX = origW / 300;
      const scaleY = origH / 200;

      // TL should be close to 40 * scaleX = 133, 30 * scaleY = 90
      expect(Math.abs(corners[0].x - 40 * scaleX)).toBeLessThan(30);
      expect(Math.abs(corners[0].y - 30 * scaleY)).toBeLessThan(30);

      // BR should be close to 260 * scaleX = 867, 170 * scaleY = 510
      expect(Math.abs(corners[2].x - 260 * scaleX)).toBeLessThan(30);
      expect(Math.abs(corners[2].y - 170 * scaleY)).toBeLessThan(30);
    });

    it("detects a card-aspect rectangle filling most of the frame without picking a skewed quad", () => {
      const origW = 800;
      const origH = 500;
      // Bright NID-aspect rectangle (~1.58) well inside a dark frame.
      const testQuad = [
        { x: 30, y: 25 },
        { x: 270, y: 25 },
        { x: 270, y: 175 },
        { x: 30, y: 175 },
      ];

      const img = createTestBuffer(300, 200, testQuad, [20, 20, 20], [235, 235, 235]);
      const corners = detectCardCornersFromPixels(img.data, 300, 200, origW, origH);

      expect(corners.length).toBe(4);
      const scaleX = origW / 300;
      const scaleY = origH / 200;

      // Each detected corner must be near the true rectangle corner (not flung
      // off into the background as in the skewed-quad bug).
      const expected = [
        { x: 30 * scaleX, y: 25 * scaleY },
        { x: 270 * scaleX, y: 25 * scaleY },
        { x: 270 * scaleX, y: 175 * scaleY },
        { x: 30 * scaleX, y: 175 * scaleY },
      ];
      for (let i = 0; i < 4; i++) {
        expect(Math.abs(corners[i].x - expected[i].x)).toBeLessThan(40);
        expect(Math.abs(corners[i].y - expected[i].y)).toBeLessThan(40);
      }
    });

    it("recognizes pre-cropped / full-frame scanned documents and selects full document corners", () => {
      // Simulate a document scan: light page with text lines filling across the page
      const origW = 1200;
      const origH = 800;
      const scanData = new Uint8ClampedArray(300 * 200 * 4);
      scanData.fill(240); // Paper background

      // Add text/table lines across the document
      for (let y = 10; y < 190; y += 15) {
        for (let x = 10; x < 290; x++) {
          const idx = (y * 300 + x) * 4;
          scanData[idx] = 30; // dark text line
          scanData[idx + 1] = 30;
          scanData[idx + 2] = 30;
        }
      }

      const corners = detectCardCornersFromPixels(scanData, 300, 200, origW, origH);
      expect(corners.length).toBe(4);
      // Microsoft Lens selects the full document bounds [0,0] to [origW, origH]
      expect(corners[0]).toEqual({ x: 0, y: 0 });
      expect(corners[1]).toEqual({ x: origW, y: 0 });
      expect(corners[2]).toEqual({ x: origW, y: origH });
      expect(corners[3]).toEqual({ x: 0, y: origH });
    });

    it("falls back gracefully to an inset rectangle on blank/uniform image", () => {
      const blankData = new Uint8ClampedArray(100 * 100 * 4);
      blankData.fill(128);

      const corners = detectCardCornersFromPixels(blankData, 100, 100, 1000, 1000);
      expect(corners.length).toBe(4);
      // 5% margin from edges
      expect(corners[0].x).toBe(50);
      expect(corners[0].y).toBe(50);
      expect(corners[2].x).toBe(950);
      expect(corners[2].y).toBe(950);
    });

    it("never throws when provided invalid, empty or null parameters", () => {
      expect(() => detectCardCornersFromPixels(null, 0, 0, 0, 0)).not.toThrow();
      const corners = detectCardCornersFromPixels(null, 0, 0, 800, 600);
      expect(corners.length).toBe(4);
    });
  });

  describe("detectCardCorners() entry point", () => {
    it("handles imageSource object with data, width, height", () => {
      const blankData = new Uint8ClampedArray(50 * 50 * 4);
      const corners = detectCardCorners({ data: blankData, width: 50, height: 50 }, 500, 500);
      expect(corners.length).toBe(4);
    });

    it("handles null imageSource safely", () => {
      const corners = detectCardCorners(null, 400, 300);
      expect(corners.length).toBe(4);
      expect(corners[0]).toEqual({ x: 0, y: 0 });
      expect(corners[2]).toEqual({ x: 400, y: 300 });
    });
  });
});
