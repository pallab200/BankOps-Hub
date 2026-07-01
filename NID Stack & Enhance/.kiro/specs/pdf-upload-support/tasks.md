# Implementation Plan: PDF Upload Support

## Overview

Extend the NID Stack & Enhance application to accept PDF files alongside existing image formats. The implementation adds a new `pdfRenderer.js` core module, extends the validation module to accept `application/pdf`, and modifies the upload controller to detect and process PDF files through the pdf.js library before feeding the result into the existing image pipeline.

## Tasks

- [x] 1. Extend validation module to accept PDF
  - [x] 1.1 Add application/pdf to SUPPORTED_TYPES and update rejection message
    - Add `"application/pdf"` to the `SUPPORTED_TYPES` array in `src/core/validation.js`
    - Update the rejection message in `validateFile` to list PDF among supported formats: "Supported formats are JPEG, PNG, WebP, GIF, and PDF."
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 1.2 Write property test for PDF file validation (Property 1)
    - **Property 1: PDF File Validation**
    - Test that `validateFile` accepts files with type `"application/pdf"` and size ≤ 10 MB, rejects unsupported types with reason `"type"`, and rejects oversized supported-type files with reason `"size"`
    - Use fast-check to generate random MIME types × random sizes with boundary-inclusive values
    - Create file: `tests/validation.pdfFile.property.test.js`
    - **Validates: Requirements 1.2, 1.3, 1.4**

- [x] 2. Implement PDF renderer module
  - [x] 2.1 Create src/core/pdfRenderer.js with renderFirstPage function
    - Create new module `src/core/pdfRenderer.js` exporting `renderFirstPage(arrayBuffer, options)`
    - Implement the algorithm: load PDF via `pdfjsLib.getDocument`, check page count, get page 1, compute effective scale (Math.max of minScale and viewport scale), apply maxDimension cap, render to offscreen canvas, convert to PNG data URL
    - Return `{ ok: true, dataUrl, naturalWidth, naturalHeight }` on success
    - Return `{ ok: false, reason: 'load'|'no-pages'|'render', message }` on failure
    - Accept injectable `getDocument` option for testability (defaults to `window.pdfjsLib.getDocument`)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.1_

  - [ ]* 2.2 Write property test for scale factor lower bound (Property 2)
    - **Property 2: Scale Factor Lower Bound**
    - Test that for any PDF page viewport with any default scale, the effective rendering scale is at least 2.0 and at least the page's own viewport scale
    - Use fast-check to generate random viewport scales (0.1–10.0)
    - Create file: `tests/pdfRenderer.scale.property.test.js`
    - **Validates: Requirements 3.3**

  - [ ]* 2.3 Write property test for output dimension bounds (Property 3)
    - **Property 3: Output Dimension Bounds and Aspect Ratio Preservation**
    - Test that for any viewport dimensions, rendered output has positive integer dimensions, neither exceeds 4096px, and aspect ratio is preserved within floating-point tolerance
    - Use fast-check to generate random viewport dimensions (1–20000 px)
    - Create file: `tests/pdfRenderer.dimensions.property.test.js`
    - **Validates: Requirements 3.5, 3.6**

  - [ ]* 2.4 Write property test for first-page-only equivalence (Property 7)
    - **Property 7: First-Page-Only Equivalence**
    - Test that for any PDF with N ≥ 1 pages, the rendered output is identical to a single-page PDF whose only page matches the original's first page; no page count metadata stored
    - Use fast-check with mock PDFs of varying page counts (1–50), verify only getPage(1) is called
    - Create file: `tests/pdfRenderer.firstPageOnly.property.test.js`
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Extend upload controller for PDF handling
  - [x] 4.1 Update file input accept attribute in wireSlot to include application/pdf
    - In the `wireSlot` function within `src/controllers/uploadController.js`, set each file input's `accept` attribute to `"image/jpeg,image/png,image/webp,image/gif,application/pdf"`
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 4.2 Add readFileAsArrayBuffer helper and PDF detection branch in loadSourceImage
    - Add internal helper `readFileAsArrayBuffer(file)` returning `Promise<ArrayBuffer>` using FileReader
    - In `loadSourceImage`, after validation passes, detect PDF type via `file.type === 'application/pdf'`
    - If PDF: read as ArrayBuffer, call `renderFirstPage`, on success create Image element from data URL, wait for onload, then commit to appState identically to image path
    - Update `namedValidationMessage` to include PDF in supported formats text
    - Import `renderFirstPage` from `../core/pdfRenderer.js`
    - _Requirements: 3.1, 3.4, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 4.3 Implement PDF-specific progress feedback in the PDF branch
    - Call `progress.begin()` immediately after validation for PDF files (0%)
    - Call `progress.set(50)` after PDF document loads successfully
    - Call `progress.complete()` after image is fully rendered and committed
    - Ensure progress is non-decreasing within a single operation
    - Set `aria-valuenow` on progress element to reflect current percentage
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [x] 4.4 Implement PDF-specific error handling in the PDF branch
    - On pdf.js load failure: show error "The PDF \"[filename]\" could not be loaded. The file may be corrupted or encrypted." via ARIA live region, hide progress within 1000ms
    - On zero pages: show error "The PDF \"[filename]\" has no renderable pages." via ARIA live region, hide progress within 1000ms
    - On render failure: show error "The PDF page in \"[filename]\" could not be rendered." via ARIA live region, hide progress within 1000ms
    - Ensure slot state (preview, thumbnail, appState) is unchanged on any error
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 4.5 Write property test for progress monotonicity (Property 4)
    - **Property 4: Progress Monotonicity**
    - Test that for any PDF upload operation, the sequence of progress values is non-decreasing within a single operation
    - Use fast-check to generate random PDF files triggering various progress paths (success, load error, render error)
    - Create file: `tests/uploadController.pdfProgress.property.test.js`
    - **Validates: Requirements 4.2**

  - [ ]* 4.6 Write property test for state preservation on error (Property 5)
    - **Property 5: State Preservation on Error**
    - Test that for any initial state and any PDF processing error, the application state after the error is identical to the state before the operation
    - Use fast-check to generate random initial states × error conditions (load, no-pages, render)
    - Create file: `tests/uploadController.pdfStatePreservation.property.test.js`
    - **Validates: Requirements 5.4**

  - [ ]* 4.7 Write property test for path equivalence (Property 6)
    - **Property 6: Path Equivalence and Consistent State Mutation**
    - Test that processing a PDF via click produces identical appState (source slot, naturalWidth, naturalHeight, crop: null) as via drag-and-drop
    - Use fast-check to generate random valid PDF files, verify both paths produce same state
    - Create file: `tests/uploadController.pdfPathEquivalence.property.test.js`
    - **Validates: Requirements 6.1, 6.4, 6.5**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Integration wiring and rebuild
  - [x] 6.1 Wire pdfRenderer import in uploadController and verify esbuild bundle
    - Ensure `src/controllers/uploadController.js` imports from `../core/pdfRenderer.js`
    - Run `npm run build` to verify esbuild bundles correctly with the new module
    - Verify `app.bundle.js` includes pdfRenderer code and no import errors
    - _Requirements: 3.1, 6.1_

  - [ ]* 6.2 Write integration tests for end-to-end PDF upload flow
    - Test full flow: file drop → validation → PDF render → state mutation → preview/thumbnail update
    - Test that PDF upload produces same downstream state shape as image upload
    - Verify accept attribute is set correctly after init()
    - Create file: `tests/uploadController.pdfIntegration.test.js`
    - _Requirements: 2.1, 6.1, 6.2, 6.3, 6.4, 6.5, 7.2_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The pdf.js library is already bundled at `libs/pdf.min.js` and exposes `pdfjsLib` on window — no installation needed
- Tests mock `pdfjsLib.getDocument` via the injectable `getDocument` option rather than loading the actual pdf.js library
- Canvas operations need mocking in jsdom test environment since jsdom doesn't implement canvas natively

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["4.1", "4.2"] },
    { "id": 3, "tasks": ["4.3", "4.4"] },
    { "id": 4, "tasks": ["4.5", "4.6", "4.7"] },
    { "id": 5, "tasks": ["6.1"] },
    { "id": 6, "tasks": ["6.2"] }
  ]
}
```
