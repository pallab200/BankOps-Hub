# Requirements Document

## Introduction

This feature integrates the existing Secured Overdraft Application Form Editor into the Credit section of the BankOps Hub main navigation. The form editor already exists as a standalone HTML application in the "Secured Overdraft Application Form" folder, but it is not yet accessible from the BankOps Hub dashboard. This integration involves adding a new app card to the Credit section, updating the app count badge, registering the app in the search index, and adding it to the section visibility toggle options.

## Glossary

- **BankOps_Hub**: The main HTML dashboard application that provides unified access to all banking operations tools
- **Credit_Section**: The collapsible section in BankOps Hub that groups lending and credit analysis applications (ISS Analyzer, Credit Commitment Editor, CIB Inquiry)
- **App_Card**: A styled UI card element within a section grid that displays an app's icon, title, description, and an "Open App" button
- **App_Count_Badge**: A small badge displayed next to a section title indicating the number of apps in that section
- **Search_Index**: A JavaScript array of app metadata objects used to power the search/filter functionality in BankOps Hub
- **Section_Toggle**: A checkbox-based UI control in the settings panel that allows users to show/hide individual apps within a section
- **Form_Editor**: The Secured Overdraft Application Form Editor — a standalone HTML page that allows branch officers to fill in overdraft application data and preview print-ready forms

## Requirements

### Requirement 1: Add Secured Overdraft App Card to Credit Section

**User Story:** As a branch officer, I want to see the Secured Overdraft Application Form listed in the Credit section, so that I can quickly access it from the BankOps Hub dashboard.

#### Acceptance Criteria

1. WHEN the BankOps Hub page loads, THE Credit_Section SHALL display an App_Card with the id "app-secured-overdraft", a Font Awesome icon, the title "Secured Overdraft Application Form", a description summarizing the app's purpose in no more than 150 characters, and an "Open App" button
2. WHEN the user clicks the "Open App" button on the Secured Overdraft App_Card, THE BankOps_Hub SHALL open the file "Secured Overdraft Application Form/Retail Secured Overdraft Application Form.html" in a new browser tab using window.open with target "_blank"
3. THE App_Card SHALL follow the same HTML structure as existing App_Cards in the Credit_Section: an icon element with class "app-icon", a div with class "app-title", a div with class "app-description", and a button element with class "open-btn"
4. THE Secured Overdraft App_Card SHALL be placed as the last card in the Credit_Section app grid, after the CIB Inquiry App_Card

### Requirement 2: Update Credit Section App Count Badge

**User Story:** As a user, I want the Credit section badge to show the correct number of apps, so that I know how many tools are available in the section.

#### Acceptance Criteria

1. THE App_Count_Badge in the Credit_Section header SHALL display "4 apps" to reflect the total number of apps in the section including the newly added Secured Overdraft Application Form
2. WHEN one or more apps in the Credit_Section are hidden via the Section_Toggle, THE App_Count_Badge SHALL continue to display the total registered app count ("4 apps") regardless of current visibility state

### Requirement 3: Register App in Search Index

**User Story:** As a branch officer, I want to find the Secured Overdraft form by searching, so that I can access it quickly without scrolling through sections.

#### Acceptance Criteria

1. THE Search_Index SHALL include an entry for the Secured Overdraft Application Form with the id "app-secured-overdraft", title "Secured Overdraft Application Form", section "credit", keywords ["secured", "overdraft", "sod", "loan", "application", "form"], url "Secured Overdraft Application Form/Retail Secured Overdraft Application Form.html", and an icon class consistent with the App_Card icon used in the Credit_Section
2. WHEN the user types a query of at least 1 character in the search bar, THE BankOps_Hub SHALL perform a case-insensitive partial match against the entry's title, keywords, and section fields and display the Secured Overdraft App_Card in the filtered results if any field contains the query string
3. IF the user types a query that does not match any Search_Index entry's title, keywords, or section, THEN THE BankOps_Hub SHALL display a no-results indication and hide the section grid

### Requirement 4: Add App to Section Visibility Toggle

**User Story:** As a user, I want to be able to show or hide the Secured Overdraft app from the Credit section using the settings panel, so that I can customize my dashboard view.

#### Acceptance Criteria

1. THE Section_Toggle panel SHALL include a checkbox option for the Secured Overdraft Application Form within the Credit section sub-options, with the checkbox checked by default on first use
2. WHEN the user unchecks the Secured Overdraft toggle, THE BankOps_Hub SHALL immediately hide the Secured Overdraft App_Card from the Credit_Section grid and persist the preference to local storage
3. WHEN the user checks the Secured Overdraft toggle, THE BankOps_Hub SHALL immediately show the Secured Overdraft App_Card in the Credit_Section grid and persist the preference to local storage
4. WHEN the BankOps Hub page loads and a saved visibility preference exists for the Secured Overdraft app, THE BankOps_Hub SHALL apply the stored preference to restore the App_Card visibility state and checkbox state from the previous session

### Requirement 5: Register App in Section Toggle Array

**User Story:** As a developer, I want the Secured Overdraft app to be registered in the section names array, so that the expand/collapse and toggle-all functionality includes it correctly.

#### Acceptance Criteria

1. THE BankOps_Hub SHALL include a checkbox input element with the id "toggle-app-secured-overdraft", the class "app-toggle", and the data-section attribute set to "credit" within the Credit section's sub-options in the Section_Toggle panel
2. WHEN the user unchecks the "toggle-credit" section-level checkbox, THE BankOps_Hub SHALL set the display of the entire Credit_Section element (id "section-credit") to "none", hiding the Secured Overdraft App_Card along with all other credit apps
3. WHEN the page loads, THE BankOps_Hub SHALL restore the Secured Overdraft App_Card visibility state from the "bankops_app_visibility" localStorage entry, defaulting to visible if no saved preference exists
4. WHEN the user invokes the reset function, THE BankOps_Hub SHALL set the "toggle-app-secured-overdraft" checkbox to checked and display the Secured Overdraft App_Card
