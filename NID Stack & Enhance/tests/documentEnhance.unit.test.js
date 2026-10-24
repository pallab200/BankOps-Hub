import { describe, it, expect } from "vitest";
import { enhanceDocumentBuffer, enhanceImageSource } from "../src/core/documentEnhance.js";

describe("documentEnhance module", () => {
  it("enhances grayish background to clean paper white and darkens text", () => {
    const w = 50;
    const h = 50;
    const data = new Uint8ClampedArray(w * h * 4);

    // Fill with yellowish-gray background (R: 190, G: 185, B: 170)
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = 190;
      data[i * 4 + 1] = 185;
      data[i * 4 + 2] = 170;
      data[i * 4 + 3] = 255;
    }

    // Add a dark text line across row 25
    for (let x = 10; x < 40; x++) {
      const idx = (25 * w + x) * 4;
      data[idx] = 70;
      data[idx + 1] = 70;
      data[idx + 2] = 70;
    }

    const enhanced = enhanceDocumentBuffer(data, w, h);
    expect(enhanced.length).toBe(w * h * 4);

    // Background pixel (e.g. at 5, 5) should be brightened near 255
    const bgIdx = (5 * w + 5) * 4;
    expect(enhanced[bgIdx]).toBeGreaterThanOrEqual(240);
    expect(enhanced[bgIdx + 1]).toBeGreaterThanOrEqual(240);
    expect(enhanced[bgIdx + 2]).toBeGreaterThanOrEqual(240);

    // Text pixel (at 25, 20) should be darkened for contrast
    const textIdx = (25 * w + 20) * 4;
    expect(enhanced[textIdx]).toBeLessThan(70);
  });

  it("preserves alpha channel unchanged", () => {
    const w = 10;
    const h = 10;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = 120;
      data[i * 4 + 1] = 130;
      data[i * 4 + 2] = 140;
      data[i * 4 + 3] = 200; // custom alpha
    }

    const enhanced = enhanceDocumentBuffer(data, w, h);
    for (let i = 0; i < w * h; i++) {
      expect(enhanced[i * 4 + 3]).toBe(200);
    }
  });

  it("is total and never throws on null, undefined, empty, or degenerate buffers", () => {
    expect(() => enhanceDocumentBuffer(null, 0, 0)).not.toThrow();
    expect(() => enhanceDocumentBuffer(new Uint8ClampedArray(0), 10, 10)).not.toThrow();
    expect(() => enhanceDocumentBuffer(new Uint8ClampedArray(16), -5, -5)).not.toThrow();
  });

  it("enhanceImageSource returns null safely when no canvas/DOM context is available", () => {
    expect(enhanceImageSource(null)).toBeNull();
    expect(enhanceImageSource({ naturalWidth: 0, naturalHeight: 0 })).toBeNull();
  });

  it("progressively darkens text as enhance strength increases from 0.0 to 1.0", () => {
    const w = 50;
    const h = 50;
    const data = new Uint8ClampedArray(w * h * 4);

    for (let i = 0; i < w * h; i++) {
      data[i * 4] = 190;
      data[i * 4 + 1] = 185;
      data[i * 4 + 2] = 170;
      data[i * 4 + 3] = 255;
    }

    // Add a text line
    for (let x = 10; x < 40; x++) {
      const idx = (25 * w + x) * 4;
      data[idx] = 70;
      data[idx + 1] = 70;
      data[idx + 2] = 70;
    }

    const textIdx = (25 * w + 20) * 4;
    const s0 = enhanceDocumentBuffer(data, w, h, 0.0);
    const s05 = enhanceDocumentBuffer(data, w, h, 0.5);
    const s10 = enhanceDocumentBuffer(data, w, h, 1.0);

    expect(s0[textIdx]).toBe(70);
    expect(s05[textIdx]).toBeLessThan(s0[textIdx]);
    expect(s10[textIdx]).toBeLessThan(s05[textIdx]);
  });
});
