// Feature: nid-stack-enhance-redesign, Property 2: File validation
//
// For any file, validation accepts it if and only if its type is one of JPEG,
// PNG, WebP, or GIF AND its size is at most 10 MB; otherwise validation rejects
// it with reason `type` when the type is unsupported and reason `size` when a
// supported-type file exceeds 10 MB (type checked before size).
//
// Validates: Requirements 2.6, 2.7

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  validateFile,
  SUPPORTED_TYPES,
  MAX_FILE_BYTES,
} from "../src/core/validation.js";

// A pool of unsupported MIME types (and edge values) to exercise the type path.
const UNSUPPORTED_TYPES = [
  "image/bmp",
  "image/tiff",
  "image/svg+xml",
  "image/heic",
  "text/plain",
  "application/octet-stream",
  "",
  "image/jpg", // common-but-incorrect spelling, not in the supported set
  "video/mp4",
];

// Arbitrary for a file-like descriptor with a controllable type and size.
const typeArb = fc.oneof(
  fc.constantFrom(...SUPPORTED_TYPES),
  fc.constantFrom(...UNSUPPORTED_TYPES)
);

// Sizes spanning below, at, and above the 10 MB boundary.
const sizeArb = fc.oneof(
  fc.integer({ min: 0, max: MAX_FILE_BYTES }), // valid sizes incl. exact limit
  fc.integer({ min: MAX_FILE_BYTES + 1, max: MAX_FILE_BYTES * 4 }), // oversized
  fc.constantFrom(MAX_FILE_BYTES, MAX_FILE_BYTES + 1, 0) // boundary values
);

const fileArb = fc.record({
  type: typeArb,
  size: sizeArb,
  name: fc.string(),
});

describe("Property 2: File validation (validateFile)", () => {
  it("accepts iff supported type and size <= 10 MB; rejects type before size", () => {
    fc.assert(
      fc.property(fileArb, (file) => {
        const result = validateFile(file);
        const typeSupported = SUPPORTED_TYPES.includes(file.type);
        const sizeOk = file.size <= MAX_FILE_BYTES;

        if (typeSupported && sizeOk) {
          // Accepted exactly when both conditions hold.
          expect(result.ok).toBe(true);
        } else if (!typeSupported) {
          // Type is checked before size: unsupported type always reason "type",
          // regardless of size.
          expect(result.ok).toBe(false);
          expect(result.reason).toBe("type");
          expect(typeof result.message).toBe("string");
          expect(result.message.length).toBeGreaterThan(0);
        } else {
          // Supported type but oversized -> reason "size".
          expect(result.ok).toBe(false);
          expect(result.reason).toBe("size");
          expect(typeof result.message).toBe("string");
          expect(result.message.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 }
    );
  });

  it("accepts every supported type at exactly the 10 MB limit", () => {
    fc.assert(
      fc.property(fc.constantFrom(...SUPPORTED_TYPES), (type) => {
        const result = validateFile({ type, size: MAX_FILE_BYTES, name: "f" });
        expect(result.ok).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("rejects supported types one byte over the limit with reason 'size'", () => {
    fc.assert(
      fc.property(fc.constantFrom(...SUPPORTED_TYPES), (type) => {
        const result = validateFile({
          type,
          size: MAX_FILE_BYTES + 1,
          name: "f",
        });
        expect(result.ok).toBe(false);
        expect(result.reason).toBe("size");
      }),
      { numRuns: 100 }
    );
  });
});
