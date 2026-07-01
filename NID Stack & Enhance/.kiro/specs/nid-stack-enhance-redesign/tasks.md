# Implementation Plan: NID Stack & Enhance Redesign

## Overview

This plan refactors the existing monolithic `script.js` into pure, testable core modules plus thin DOM controllers, rebuilds the markup and styling on a single externalized Design System, and corrects the seven known defects (D1–D7). Implementation uses vanilla JavaScript (ES modules, no bundler) per the design, tested with Vitest (jsdom) and fast-check.

The work proceeds bottom-up: test scaffolding first, then the pure core modules (each verified by its property test immediately), then the non-blocking message/progress infrastructure, then the controllers that wire DOM events to the core, and finally responsive/accessibility styling and full integration. Each step builds on prior steps and ends wired into the running page so no orphaned code remains.

## Tasks

- [x] 1. Set up project structure and test infrastructure
  - Create `src/core/` (pure modules) and `src/controllers/` (DOM glue) directories
  - Add `package.json` with Vitest (jsdom environment) and fast-check dev dependencies and a `test` script using `--run`
  - Add a Vitest config selecting the jsdom environment and a `tests/` directory
  - _Requirements: 12.6_

- [x] 2. Build the Design System and restructured markup
  - [x] 2.1 Define the Design System tokens and base component styles in `styles.css`
    - Define CSS custom properties for color, typography, spacing, radii, shadow, and a single `--focus-ring`
    - Style the five sections, upload cards, buttons, sliders, modal, and progress bar using only tokens
    - Add a global `:focus-visible` rule rendering a visible focus ring meeting 3:1 contrast
    - Choose text/background token pairings meeting 4.5:1 (normal) and 3:1 (large) contrast
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 1.7_

  - [x] 2.2 Restructure the HTML markup
    - Set both `<title>` and `<h1>` to the exact string `NID Stack & Enhance` (fixes D1)
    - Group controls into five labeled sections (Upload, Combine Settings, Actions, Preview, Adjustments) each with a visible heading
    - Add required/optional badges, crop buttons, the crop modal, the progress element, and an ARIA live message region
    - Add accessible names/labels to every control and text alternatives for icon-only controls; remove all inline `style` attributes and inline `<style>` blocks
    - _Requirements: 1.2, 1.3, 1.4, 2.9, 5.1, 6.1, 11.1, 11.9_

  - [ ]* 2.3 Write static/smoke checks for the Design System
    - Assert no inline `style` attributes or inline `<style>` blocks exist in markup
    - Assert color/font/spacing literals resolve to tokens; assert focus ring ≥ 3:1, normal text ≥ 4.5:1, large text ≥ 3:1 over the token palette
    - Assert title text equals header text equals `NID Stack & Enhance`, five labeled sections present, four filter options, required/optional labels
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.9, 6.1_

- [x] 3. Implement application state module
  - [x] 3.1 Implement `src/core/appState.js`
    - Define `AppState` shape (sources, settings, adjustments, filter, combined/adjusted buffers)
    - Implement `getState`, mutation helpers, and `reset()` returning the documented default state (spacing 10, background `#ffffff`, brightness/contrast/saturation 100, sharpness 0, filter `none`, no images/crops, exports hidden, progress hidden)
    - Implement an operation-wrapper helper that returns the prior state unchanged when an operation reports an error
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x]* 3.2 Write property test for reset to defaults
    - **Property 14: Reset to defaults**
    - **Validates: Requirements 8.1, 8.4**

  - [x]* 3.3 Write property test for state preservation on reported error
    - **Property 15: State preservation on reported error**
    - **Validates: Requirements 12.5**

- [x] 4. Implement validation module
  - [x] 4.1 Implement `src/core/validation.js`
    - Implement `validateFile(file)` returning `{ok}` or `{ok:false, reason:"type"|"size", message}` for the four supported types and the 10 MB limit
    - Implement `validateSpacing(value, previous)` accepting whole numbers 0–500 inclusive and returning the previous value on rejection plus a range message
    - Implement range clamping helpers for adjustment values
    - _Requirements: 2.6, 2.7, 4.1, 4.2_

  - [x]* 4.2 Write property test for file validation
    - **Property 2: File validation**
    - **Validates: Requirements 2.6, 2.7**

  - [x]* 4.3 Write property test for spacing validation
    - **Property 3: Spacing validation**
    - **Validates: Requirements 4.1, 4.2**

- [x] 5. Implement crop geometry module
  - [x] 5.1 Implement `src/core/cropGeometry.js`
    - Implement `initialRegion(imgW, imgH)`, `constrainCorner`, `constrainMove`, `displayToOriginal`, `originalToDisplay`, and `sizeCropCanvas` as total functions that clamp rather than throw
    - Enforce in-bounds corners and a 10×10 px minimum in original pixel coordinates
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 10.6_

  - [x]* 5.2 Write property test for crop corner constraint
    - **Property 4: Crop corner constraint**
    - **Validates: Requirements 3.3**

  - [x]* 5.3 Write property test for crop region move
    - **Property 5: Crop region move preserves size**
    - **Validates: Requirements 3.4**

  - [x]* 5.4 Write property test for crop coordinate round trip
    - **Property 6: Crop coordinate round trip**
    - **Validates: Requirements 3.5**

  - [x]* 5.5 Write property test for crop initial region
    - **Property 7: Crop initial region equals full bounds**
    - **Validates: Requirements 3.1**

  - [x]* 5.6 Write property test for crop canvas sizing
    - **Property 13: Crop canvas sizing**
    - **Validates: Requirements 10.6**

- [x] 6. Implement combine layout module
  - [x] 6.1 Implement `src/core/combineLayout.js`
    - Implement `computeLayout(sources, spacing, bgColor)` returning target width, front-then-back placements with destination rectangles, and total height = sum(heights) + (n−1)×spacing
    - Apply stored crop regions to source rectangles
    - _Requirements: 4.4, 4.5_

  - [x]* 6.2 Write property test for combine layout integrity
    - **Property 8: Combine layout integrity**
    - **Validates: Requirements 4.4, 4.5**

- [x] 7. Implement image adjustment module
  - [x] 7.1 Implement `src/core/imageAdjust.js`
    - Implement `buildFilterString`, `sharpenKernel(amount)` (null at 0), `isIdentity`, and an `adjust(buffer, ...)` transform
    - Guarantee pixel-identical output at brightness/contrast/saturation 100 and sharpness 0
    - _Requirements: 5.1, 5.4, 5.7_

  - [x]* 7.2 Write property test for adjustment identity at defaults
    - **Property 9: Adjustment identity at defaults**
    - **Validates: Requirements 5.7**

- [x] 8. Implement filters module
  - [x] 8.1 Implement `src/core/filters.js`
    - Implement `applyFilter(name, baseRGBA, width, height)` for None, Lighten, Document, Grayscale, always reading from and never mutating the unfiltered base buffer
    - Make None and reset return pixels identical to the base
    - _Requirements: 6.1, 6.3, 6.5, 6.6_

  - [x]* 8.2 Write property test for filter base-application
    - **Property 10: Filter base-application**
    - **Validates: Requirements 6.3, 6.5, 6.6**

- [x] 9. Implement PDF layout module
  - [x] 9.1 Implement `src/core/pdfLayout.js`
    - Implement `fitImageToPage(imgW, imgH, page, margin)` for A4 portrait with a uniform 12.7 mm margin (fixes D6)
    - Preserve aspect ratio within 1%, keep equal left/right margins and all four margins > 0 and ≤ 25.4 mm
    - _Requirements: 7.3, 7.4_

  - [x]* 9.2 Write property test for PDF fit and margins
    - **Property 11: PDF fit and margins**
    - **Validates: Requirements 7.3, 7.4**

- [x] 10. Checkpoint - core modules
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement message and progress infrastructure
  - [x] 11.1 Implement `src/controllers/messages.js`
    - Implement `showGuidance(text, {minVisibleMs})` (`role="status"`), `showError(text)` (`role="alert"`), and `clearMessage()` against the live region, replacing all `alert()` usage
    - Support a minimum visible duration (≥ 3 s for filter guidance) and named error text
    - _Requirements: 5.3, 5.5, 6.4, 9.6, 12.1, 12.4_

  - [x] 11.2 Implement `src/controllers/progress.js`
    - Implement `begin()` (visible at 0%), `set(p)` (non-decreasing, clamped 0–100), `complete()` (100% then hide within 1 s), and `fail()` (hide within 1 s + message)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ]* 11.3 Write property test for progress monotonicity
    - **Property 12: Progress monotonicity**
    - **Validates: Requirements 9.2**

  - [ ]* 11.4 Write unit tests for message and progress lifecycle
    - Test guidance vs error roles, minimum visible duration, begin/complete/fail timing, and that `alert` is never called
    - _Requirements: 9.1, 9.3, 9.4, 9.5, 9.6, 5.3, 5.5, 6.4_

- [x] 12. Implement upload controller
  - [x] 12.1 Implement `src/controllers/uploadController.js`
    - Implement shared `loadSourceImage(file, slot)` used by both click and drop paths, producing identical preview, thumbnail, pixel content, dimensions, and slot assignment (fixes D2)
    - Wire validation errors (named, slot unchanged), decode-failure handling within 2 s, drag highlight add/remove, and progress begin→complete (fixes D3)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 9.1, 12.1, 12.2, 12.3_

  - [ ]* 12.2 Write property test for load-path equivalence
    - **Property 1: Load-path equivalence**
    - **Validates: Requirements 2.3, 12.2, 12.3**

  - [ ]* 12.3 Write unit tests for upload controller
    - Test validation/decode messages name the file, slot retained on error, required/optional badges, drag highlight toggle
    - _Requirements: 2.4, 2.6, 2.7, 2.8, 2.9, 12.1_

- [x] 13. Implement crop controller
  - [x] 13.1 Implement `src/controllers/cropController.js`
    - Open/close the modal, guard crop-on-empty with guidance, initialize region to full bounds, store region in original pixel coordinates, and display crop width/height
    - Wire Pointer Events for mouse and touch and keyboard arrow-key handles through the shared geometry constraints (fixes D7); implement focus trap, Escape-to-close discarding changes, and focus return to opener (or nearest parent)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 11.2, 11.5, 11.6, 11.7, 11.8_

  - [ ]* 13.2 Write unit tests for crop controller
    - Test cancel/Escape preserve the stored region, touch routing through shared constraints, focus enter/trap/return, crop-on-empty guidance
    - _Requirements: 3.2, 3.6, 3.7, 3.8, 11.5, 11.6, 11.7, 11.8_

- [x] 14. Implement combine controller
  - [x] 14.1 Implement `src/controllers/combineController.js`
    - Read and validate spacing, default background to white, require ≥ 1 source, draw placements onto the preview canvas filling uncovered areas with the background, replace the placeholder, drive non-decreasing progress, and enable the Combined PDF export
    - _Requirements: 4.2, 4.3, 4.6, 4.7, 4.8, 9.2, 9.3_

  - [ ]* 14.2 Write unit tests for combine controller
    - Test invalid-spacing message with prior value retained, combine-no-source guidance, placeholder replacement, export enablement
    - _Requirements: 4.2, 4.6, 4.7, 4.8_

- [x] 15. Implement adjustment controller
  - [x] 15.1 Implement `src/controllers/adjustmentController.js`
    - Wire debounced live preview (within 500 ms) for brightness/contrast/saturation, apply adjustments including sharpness, display current values, and enable the Adjusted PDF export on production
    - Show non-blocking guidance and change nothing when no combined image exists (fixes D4)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 15.2 Write unit tests for adjustment controller
    - Test non-blocking guidance with no combined image (no `alert`), live-preview update, export enablement, value display
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6_

- [x] 16. Implement filter controller
  - [x] 16.1 Implement `src/controllers/filterController.js`
    - Maintain the unfiltered adjusted base buffer, apply the selected filter to the base (never compounding), update the preview within the time bounds, and restore the base on None/reset
    - Show non-blocking guidance visible ≥ 3 s and change nothing when no adjusted image exists (fixes D5)
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 16.2 Write unit tests for filter controller
    - Test guidance with no adjusted image (≥ 3 s, no `alert`), filter switching applies to base, reset/None restore base
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 17. Implement export controller
  - [x] 17.1 Implement `src/controllers/exportController.js`
    - Check the requested source image exists (named message, no PDF), check jsPDF availability, build a single-page A4 portrait PDF using `pdfLayout`, trigger the save dialog, and report failures without altering state
    - _Requirements: 7.1, 7.2, 7.5, 7.6, 7.7, 7.8, 12.4, 12.5_

  - [ ]* 17.2 Write unit tests for export controller
    - Test missing-source named message and no PDF created, jsPDF-unavailable message, generation-failure message, save invocation, single A4 portrait page
    - _Requirements: 7.1, 7.2, 7.5, 7.6, 7.7, 7.8, 12.4_

- [x] 18. Implement reset controller
  - [x] 18.1 Implement `src/controllers/resetController.js`
    - Wire the clear control to `appState.reset()`, restore all upload cards/thumbnails/previews to empty-state placeholders, hide both export controls, and reset the progress indicator
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 18.2 Write unit tests for reset controller
    - Test full reset restores defaults and placeholders, hides exports, resets progress, and runs with zero errors when no source is loaded
    - _Requirements: 8.2, 8.3, 8.5_

- [x] 19. Checkpoint - controllers
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Implement responsive layout and accessibility styling
  - [x] 20.1 Add responsive and accessibility rules to `styles.css`
    - Add a 600 px breakpoint: single full-width column at ≤ 600 px, two-or-more columns above; no horizontal scroll at ≥ 320 px; 44×44 px touch targets at ≤ 600 px; reflow on resize/orientation via media queries; size the crop canvas within viewport bounds
    - Ensure focus order follows visual reading order and visible focus indicators apply to all focusable elements
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 11.3, 11.4_

  - [ ]* 20.2 Write example tests for responsive and focus behavior
    - Test single-column at ≤ 600 px, multi-column above, no horizontal scroll at 320 px, 44×44 targets, reflow on resize, visible focus and focus order
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 11.3, 11.4_

- [x] 21. Integrate and wire the application
  - [x] 21.1 Implement the application entry module wiring all controllers
    - Initialize `appState`, instantiate message/progress infrastructure, and wire upload, crop, combine, adjustment, filter, export, and reset controllers to the DOM; wrap all event handlers in try/catch routing to `showError`/`progress.fail()`
    - Replace the old `script.js` integration so no orphaned code remains
    - _Requirements: 12.5, 12.6_

  - [ ]* 21.2 Write end-to-end workflow smoke test
    - Run upload → crop → combine → adjust → filter → export asserting zero uncaught console/runtime errors
    - _Requirements: 8.5, 12.6_

- [x] 22. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for a faster MVP, but they validate the design's correctness properties and defect fixes.
- Each task references specific requirements (granular sub-requirements) for traceability.
- Property tests use fast-check with a minimum of 100 iterations and are tagged `// Feature: nid-stack-enhance-redesign, Property {number}: {property_text}`; each of Properties 1–15 maps to exactly one property test.
- Pure core modules are implemented and verified before the controllers that consume them, so defects D1–D7 are fixed within their respective controller/styling tasks.
- Checkpoints provide incremental validation at natural boundaries.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1", "5.1", "6.1", "7.1", "8.1", "9.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "3.3", "4.2", "4.3", "5.2", "5.3", "5.4", "5.5", "5.6", "6.2", "7.2", "8.2", "9.2", "11.1", "11.2", "20.1"] },
    { "id": 3, "tasks": ["2.3", "11.3", "11.4", "12.1", "13.1", "14.1", "15.1", "16.1", "17.1", "18.1", "20.2"] },
    { "id": 4, "tasks": ["12.2", "12.3", "13.2", "14.2", "15.2", "16.2", "17.2", "18.2", "21.1"] },
    { "id": 5, "tasks": ["21.2"] }
  ]
}
```
