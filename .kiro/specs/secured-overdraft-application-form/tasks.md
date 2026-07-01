# Implementation Plan: Secured Overdraft Application Form Integration

## Overview

This plan integrates the existing Secured Overdraft Application Form Editor into the BankOps Hub dashboard. All changes are confined to the single `BankOps Hub.html` file. The work involves adding an app card to the Credit section, updating the badge count, registering the app in the search index, and adding a visibility toggle in the settings panel.

## Tasks

- [x] 1. Add Secured Overdraft App Card to Credit Section
  - [x] 1.1 Insert the app card HTML element into the Credit section grid
    - Add a new `<div class="app-card" id="app-secured-overdraft">` as the last child of the `.app-grid` within `#body-credit`
    - Include the icon (`fa-file-signature`), title ("Secured Overdraft Application Form"), description, and "Open App" button
    - The button must use `window.open('Secured Overdraft Application Form/Retail Secured Overdraft Application Form.html', '_blank')`
    - Follow the exact HTML structure of existing app cards (icon with `app-icon` class, `app-title` div, `app-description` div, `open-btn` button)
    - Place after the CIB Inquiry card
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Update the Credit section app count badge from "3 apps" to "4 apps"
    - Locate the `<span class="app-count-badge">` inside the Credit section header
    - Change the text content from "3 apps" to "4 apps"
    - _Requirements: 2.1, 2.2_

- [x] 2. Register App in Search Index and Settings Panel
  - [x] 2.1 Add the Secured Overdraft entry to the `appData` JavaScript array
    - Insert a new object with: `id: 'app-secured-overdraft'`, `title: 'Secured Overdraft Application Form'`, `section: 'credit'`, `keywords: ['secured', 'overdraft', 'sod', 'loan', 'application', 'form']`, `url: 'Secured Overdraft Application Form/Retail Secured Overdraft Application Form.html'`, `icon: 'fa-file-signature'`
    - Place the entry after the existing CIB Inquiry entry in the array
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 2.2 Add the visibility toggle checkbox to the settings panel Credit sub-options
    - Insert a new `<label>` containing a checkbox input inside `#suboptions-credit`
    - The checkbox must have `id="toggle-app-secured-overdraft"`, `class="app-toggle"`, and `data-section="credit"`
    - Include the `onchange="updateAppVisibility()"` handler
    - Style consistently with existing toggle labels (inline styles matching other toggles)
    - Place after the CIB Inquiry toggle
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4_

- [x] 3. Checkpoint - Verify integration completeness
  - Ensure all tests pass, ask the user if questions arise.
  - Manually verify: app card renders in Credit section, "Open App" opens correct URL, badge shows "4 apps", search finds the app by keywords, toggle hides/shows the card, preference persists across page reload, reset restores visibility.

- [x] 4. Automated Testing
  - [x] 4.1 Write property test for search match correctness
    - **Property 1: Search match correctness**
    - **Validates: Requirements 3.2**
    - Set up a test harness (e.g., jsdom + fast-check) to verify that for any random substring of the entry's title, keywords, or section name "credit" (with random case transformations), the filter logic includes `app-secured-overdraft` in results
    - Minimum 100 iterations

  - [x] 4.2 Write unit tests for DOM structure and behavior
    - Verify `#app-secured-overdraft` exists with correct child structure (icon, title, description, button)
    - Verify it is the last child of the Credit `.app-grid`
    - Verify badge text is "4 apps"
    - Verify `appData` contains the correct entry
    - Verify toggle checkbox exists with correct id, class, and data-section
    - Verify unchecking toggle hides card and persists to localStorage
    - Verify checking toggle shows card and persists to localStorage
    - Verify load with saved preference `false` results in hidden card
    - Verify reset sets toggle to checked and card to visible
    - _Requirements: 1.1, 1.3, 1.4, 2.1, 3.1, 4.2, 4.3, 4.4, 5.1, 5.3, 5.4_

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All changes are confined to `BankOps Hub.html` — no new files are created
- The existing JavaScript functions (`updateAppVisibility`, `loadAppPreferences`, `resetSectionVisibility`, `applyAppVisibility`) already handle dynamic elements generically, so no JS logic changes are needed beyond adding the `appData` entry
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties from the design document
- The project has no existing test framework; automated tests (tasks 4.1, 4.2) require setting up jsdom + fast-check or a similar environment

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2"] },
    { "id": 2, "tasks": ["4.1", "4.2"] }
  ]
}
```
