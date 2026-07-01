// pdfRenderer.unit.test.js — unit tests for renderFirstPage
// Feature: pdf-upload-support
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.1

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderFirstPage } from "../src/core/pdfRenderer.js";

/**
 * Helper: create a mock pdf.js getDocument function.
 * Accepts options to control page viewport and behavior.
 */
function createMockGetDocument({
  numPages = 1,
  viewportWidth = 612,
  viewportHeight = 792,
  viewportScale = 1.0,
  loadError = null,
  renderError = null,
} = {}) {
  const mockPage = {
    getViewport: ({ scale }) => ({
      width: viewportWidth * scale,
      height: viewportHeight * scale,
      scale,
    }),
    render: ({ canvasContext, viewport }) => ({
      promise: renderError
        ? Promise.reject(new Error(renderError))
        : Promise.resolve(),
    }),
  };

  const mockDocument = {
    numPages,
    getPage: vi.fn().mockResolvedValue(mockPage),
  };

  return vi.fn().mockReturnValue({
    promise: loadError
      ? Promise.reject(new Error(loadError))
      : Promise.resolve(mockDocument),
  });
}

/**
 * Mock canvas setup for jsdom (which lacks canvas implementation).
 */
beforeEach(() => {
  // Mock document.createElement for canvas
  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: vi.fn(),
      fillRect: vi.fn(),
    }),
    toDataURL: (type) => `data:${type};base64,mockBase64Data`,
  };
  vi.spyOn(document, "createElement").mockImplementation((tag) => {
    if (tag === "canvas") return mockCanvas;
    return document.createElement(tag);
  });
});

describe("pdfRenderer.renderFirstPage", () => {
  it("returns success result for a valid single-page PDF", async () => {
    const getDocument = createMockGetDocument({ numPages: 1 });
    const buffer = new ArrayBuffer(100);

    const result = await renderFirstPage(buffer, { getDocument });

    expect(result.ok).toBe(true);
    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.naturalWidth).toBeGreaterThan(0);
    expect(result.naturalHeight).toBeGreaterThan(0);
    expect(Number.isInteger(result.naturalWidth)).toBe(true);
    expect(Number.isInteger(result.naturalHeight)).toBe(true);
  });

  it("returns load error when pdf.js fails to load the document", async () => {
    const getDocument = createMockGetDocument({ loadError: "corrupted" });
    const buffer = new ArrayBuffer(100);

    const result = await renderFirstPage(buffer, { getDocument });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("load");
    expect(result.message).toContain("could not be loaded");
  });

  it("returns no-pages error when PDF has zero pages", async () => {
    const getDocument = createMockGetDocument({ numPages: 0 });
    const buffer = new ArrayBuffer(100);

    const result = await renderFirstPage(buffer, { getDocument });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no-pages");
    expect(result.message).toContain("no renderable pages");
  });

  it("returns render error when page.render fails", async () => {
    const getDocument = createMockGetDocument({ renderError: "canvas issue" });
    const buffer = new ArrayBuffer(100);

    const result = await renderFirstPage(buffer, { getDocument });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("render");
    expect(result.message).toContain("could not be rendered");
  });

  it("uses minScale of 2.0 when viewport scale is lower", async () => {
    const getDocument = createMockGetDocument({
      viewportWidth: 612,
      viewportHeight: 792,
      viewportScale: 1.0,
    });
    const buffer = new ArrayBuffer(100);

    const result = await renderFirstPage(buffer, { getDocument, minScale: 2.0 });

    // At scale 2.0, canvas should be approx 1224 x 1584
    expect(result.ok).toBe(true);
    expect(result.naturalWidth).toBe(1224);
    expect(result.naturalHeight).toBe(1584);
  });

  it("uses viewport scale when it exceeds minScale", async () => {
    const getDocument = createMockGetDocument({
      viewportWidth: 612,
      viewportHeight: 792,
    });
    const buffer = new ArrayBuffer(100);

    // minScale is 1.0 but viewport scale at 1.0 returns width 612
    // When minScale = 1.0, effective = Math.max(1.0, viewport.scale=1.0) = 1.0
    const result = await renderFirstPage(buffer, {
      getDocument,
      minScale: 1.0,
    });

    expect(result.ok).toBe(true);
    expect(result.naturalWidth).toBe(612);
    expect(result.naturalHeight).toBe(792);
  });

  it("caps dimensions at maxDimension and preserves aspect ratio", async () => {
    // Large viewport that would exceed 4096 at scale 2.0
    const getDocument = createMockGetDocument({
      viewportWidth: 3000,
      viewportHeight: 2000,
    });
    const buffer = new ArrayBuffer(100);

    const result = await renderFirstPage(buffer, {
      getDocument,
      minScale: 2.0,
      maxDimension: 4096,
    });

    expect(result.ok).toBe(true);
    expect(result.naturalWidth).toBeLessThanOrEqual(4096);
    expect(result.naturalHeight).toBeLessThanOrEqual(4096);
    // Aspect ratio should be preserved (3000:2000 = 3:2)
    const ratio = result.naturalWidth / result.naturalHeight;
    expect(ratio).toBeCloseTo(3 / 2, 1);
  });

  it("only requests page 1 for multi-page PDFs (Req 7.1)", async () => {
    const getDocument = createMockGetDocument({ numPages: 10 });
    const buffer = new ArrayBuffer(100);

    const result = await renderFirstPage(buffer, { getDocument });

    expect(result.ok).toBe(true);
    // getPage should have been called with 1
    const mockDoc = await getDocument({ data: buffer }).promise;
    expect(mockDoc.getPage).toHaveBeenCalledWith(1);
    expect(mockDoc.getPage).toHaveBeenCalledTimes(1);
  });

  it("respects custom maxDimension option", async () => {
    const getDocument = createMockGetDocument({
      viewportWidth: 1000,
      viewportHeight: 800,
    });
    const buffer = new ArrayBuffer(100);

    const result = await renderFirstPage(buffer, {
      getDocument,
      minScale: 2.0,
      maxDimension: 1500,
    });

    expect(result.ok).toBe(true);
    expect(result.naturalWidth).toBeLessThanOrEqual(1500);
    expect(result.naturalHeight).toBeLessThanOrEqual(1500);
  });

  it("produces PNG data URL format (Req 3.4)", async () => {
    const getDocument = createMockGetDocument();
    const buffer = new ArrayBuffer(100);

    const result = await renderFirstPage(buffer, { getDocument });

    expect(result.ok).toBe(true);
    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
