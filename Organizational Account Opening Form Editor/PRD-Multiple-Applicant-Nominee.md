# PRD — Multiple Account Holder & Multiple Nominee for Organizational Account Opening Form Editor

**Document status:** Draft v1
**Author:** Kiro
**Date:** 2026-08-21
**Target file:** `Organizational Account Opening Form Editor/Organizational Account Opening Form Editor.html`
**Reference implementation:** `Account Opening Form Editor/Account Opening Form Editor.html`

---

## 1. Overview / Objective

Organizational Account Opening Form Editor-এ বর্তমানে একটি মাত্র account holder ("Individual Information") ও একটি মাত্র nominee ("Nominee Information") support করা যায়। Personal `Account Opening Form Editor`-এ multiple account holder (1st/2nd/3rd applicant) ও multiple nominee (dynamic add/remove, share validation) support করে।

এই PRD-এর লক্ষ্য: Personal editor-এর ওই দুটি feature Organizational editor-এ port করা — একই UX, একই field naming convention, একই print behaviour — কিন্তু Organizational form-এর নিজস্ব field set, page numbering, ও persistence key structure অনুযায়ী মানিয়ে নিয়ে।

### Scope
- **In scope:** 2nd/3rd applicant information sections; dynamic multi-nominee add/remove; nominee share validation; applicant/nominee data mapping for print; additional-applicant & additional-nominee preview pages; FATCA account-holder dropdown population.
- **Out of scope:** Personal editor-এর guardian-for-minor-account-holder flow (organizational context-এ প্রযোজ্য নয়, তবে nominee guardian sub-section optional হিসেবে বিবেচ্য); form redesign; new page image sourcing (নতুন preview image পাওয়া গেলে তখন add হবে)।

---

## 2. Current State (Target — Organizational Editor)

### 2.1 Account holder
- Single **Individual Information** section (`#individual-info`) — unprefixed fields: `fullNameEn`, `fullNameBn`, `dob`, `mobile`, `accountGender`, `fatherName`, `motherName`, `spouseName`, `identityDocumentType`, `nid`, `etin`, `email`, `occupation`, `monthlyIncome`, `sourceOfFund` (labeled "Relation with Organization").
- Address set is **reduced**: present = `presentRoad / presentPO / presentThana / presentDistrict`; permanent = `permanentRoad / permanentPO / permanentThana / permanentDistrict`. **কোনো** House / PostCode / Country field নেই (Personal editor-এ আছে)।
- **Mode of Operation** dropdown `accountOwnership` already exists: `single | joint | anyone | others` (no `either`).
- `secondApplicantName` ও `thirdApplicantName` field **already exist** in `.owner-joint-only` divs (hidden), and `handleOwnershipChange()` already toggles them.
- **Missing:** `#second-applicant-info` / `#third-applicant-info` sections, `app2_`/`app3_` fields, `updateApplicantSections()`, applicant Bangla translation, additional-applicant preview page.

### 2.2 Nominee
- Single static **Nominee Information** section (`#nominee-info`): `nomineeName`, `nomineeDob`, `nomineeRelation`, `nomineeNid`, `nomineeMobile`, `nomineeEmail`, `nomineeShare` (default "100"), `#nomineeSameAddress`, `nomineeAddress` (a `<textarea>`).
- Nominee preview page = `data-page="41"` (`Images/Nominee/nominee.jpg`), overlay config key `41` with unprefixed `nominee*` fields. Blank separator page at `data-page="42"`.
- **Missing:** "Add Nominee" button, `#additionalNomineesContainer`, `nom{N}_` support, `validateNomineeShares`, share-total indicator, nominee-guardian sub-section.

### 2.3 Infrastructure
- Persistence keys: `FORM_KEY='ucb_org_form_data_v1'`, `PRESETS_KEY`, `POSITIONS_KEY`, `BRANCH_KEY`.
- `saveFormData()` / `loadFormData()` serialize `form.elements` → `FORM_KEY`. **Dynamically-added fields persist only if present in DOM at save/load time** — key porting consideration.
- Overlay config object keyed by `data-page`; each entry `{ id, field, top, left, label }` (note: target uses an extra `id` key vs. source's `{ field, top, left, label }`).
- Form-type selector `#formTypeSelect`: `conventional | taqwa | others | nominee | physical-verification`.
- FATCA "Name of Account Holder" is a plain text input `fatca_accountHolder` (NOT a dropdown).

---

## 3. Reference Behaviour (Source — Personal Editor)

### 3.1 Multiple account holder
- `accountOwnership` dropdown + `.owner-joint-only` name fields (`secondApplicantName`, `thirdApplicantName`).
- `#second-applicant-info` (`app2_` prefix) and `#third-applicant-info` (`app3_` prefix) sections, hidden until the corresponding name is entered.
- `updateApplicantSections()`:
  - Shows/hides each applicant section by name presence.
  - Renames "Personal Information" → "1st Applicant Information" when multiple.
  - Syncs 1st name into readonly display; keeps `app2_fullNameEn`/`app3_fullNameEn` in sync with the name fields.
  - Repopulates FATCA account-holder dropdown with actual names (hides empty ones).
- `app2TranslateDebounced` / `app3TranslateDebounced` (700 ms) — English→Bangla name translation, "Mst/Most" → "মোছাঃ " prefix.
- Address-copy checkboxes: `#app2SameAsFirstAddress`, `#app2SameAsPresent`, `#app3SameAsFirstAddress`, `#app3SameAsPresent`.
- **Print:** `getApplicantDataMap(prefix)` maps `app2_`/`app3_` fields → unprefixed overlay fields; print routine temporarily swaps values into 1st-applicant fields (skipping `fullNameEn`/`fullNameBn` so combined-names overlay stays correct), clones the correct Additional Applicant page (pages 55–58 by form type), prints, then restores.
- Preview pages `55/56/57/58` (`.additional-applicant-page`).

### 3.2 Multiple nominee
- 1st nominee static; **"Add Nominee"** button (`#addNomineeBtn`) + `#additionalNomineesContainer`.
- Additional nominees use `nom{N}_` prefix (N ≥ 2), rendered from a template literal with a Remove button.
- Per-nominee: DOB triggers minor→guardian sub-section; "Same as Account Holder Present Address" checkboxes.
- `validateNomineeShares(triggerEl)` — sums all shares, caps at 100%, reverts excess, updates `.totalShareIndicator` (green=100 / red>100 / warning<100).
- **Print:** `generateNomineePagesMarkup()` clones the nominee page (60/61 by form type) per additional nominee, mapping `nom2_*` overlay fields → the actual `nom{N}_` field. Spliced into combined print output after page 2.
- Preview pages `60` (conventional/taqwa) and `61` (imperial); overlay config keyed `60`/`61` with `nom2_*` fields.

---

## 4. Requirements

### 4.1 Multiple Account Holder (Applicant)

| ID | Requirement | Priority |
|----|-------------|----------|
| AH-1 | `accountOwnership` = `joint`/`anyone`/`others` হলে `secondApplicantName` ও `thirdApplicantName` field দেখাবে (already works via `handleOwnershipChange`). Optionally add `either` option for parity. | Must |
| AH-2 | Add `#second-applicant-info` section with `app2_`-prefixed fields, hidden by default; visible when `secondApplicantName` has a value. | Must |
| AH-3 | Add `#third-applicant-info` section with `app3_`-prefixed fields, same behaviour with `thirdApplicantName`. | Must |
| AH-4 | Applicant field set **must mirror the Organizational Individual Information field set** (fullNameEn, fullNameBn, dob, gender, fatherName, motherName, spouseName, identityDocumentType, nid, etin, email, occupation, monthlyIncome, sourceOfFund, and the reduced address set: Road/PO/Thana/District for present & permanent) — NOT the Personal editor's fuller set. Add `app{N}_cif` and `app{N}_amlTrackingNumber` for print/overlay parity. | Must |
| AH-5 | `app{N}_fullNameEn` stays synced with `secondApplicantName`/`thirdApplicantName`; readonly display where applicable. | Must |
| AH-6 | Implement `updateApplicantSections()`: toggle sections, rename Individual Information → "1st Applicant Information" when multiple, keep names synced, repopulate FATCA dropdown. | Must |
| AH-7 | Add applicant Bangla name translation (`app2TranslateDebounced` / `app3TranslateDebounced`) reusing the existing `translateText()` + `debounce()` utilities in the Organizational file. | Should |
| AH-8 | Add "Same as 1st Applicant Address" and "Same as Present Address" copy checkboxes for each applicant, using the reduced address field set. | Should |
| AH-9 | Convert FATCA `fatca_accountHolder` from text input to a `<select id="fatcaAccountHolderSelect">` and populate options dynamically (1st/2nd/3rd names, hide empty). | Should |

### 4.2 Multiple Nominee

| ID | Requirement | Priority |
|----|-------------|----------|
| NM-1 | Add "Add Nominee" button + `#additionalNomineesContainer` inside `#nominee-info`. | Must |
| NM-2 | Dynamically render additional nominees with `nom{N}_` prefix (N ≥ 2): name, dob, relation, nid, mobile, email, share, address (+ optional guardian sub-section when minor). Include a Remove button. | Must |
| NM-3 | Implement `validateNomineeShares()` — total ≤ 100%, revert excess, update all `.totalShareIndicator` spans with colour states. Add a share-total indicator next to the 1st nominee share too. | Must |
| NM-4 | "Same as Account Holder Present Address" checkbox per additional nominee (uses the reduced present address set). | Should |
| NM-5 | Ensure dynamically-added nominee fields are captured by `saveFormData()` and restored by `loadFormData()` — see §5.3. | Must |

### 4.3 Print & Preview

| ID | Requirement | Priority |
|----|-------------|----------|
| PR-1 | Add Additional Applicant preview page(s) for the Organizational form. If a dedicated org additional-applicant image is unavailable, reuse the main org page-1/page-2 image as the applicant page background OR gate this behind image availability (flag to user). | Must |
| PR-2 | Add nominee overlay config for additional nominees (`nom2_*` fields) keyed to the nominee page (`data-page=41`, reuse), and support multiple nominee page clones during print. | Must |
| PR-3 | Implement `getApplicantDataMap(prefix)` for the Organizational field set and swap-print logic (append applicant pages after page 1/2). | Must |
| PR-4 | Implement `generateNomineePagesMarkup()` for the Organizational nominee page (`41`), one clone per additional nominee. | Must |
| PR-5 | Print output ordering: page 1 → additional applicant page(s) → page 2 → nominee page(s) → remaining pages → (Physical Verification / FATCA as already handled). | Must |
| PR-6 | All overlay entries must use the Organizational `{ id, field, top, left, label }` shape (with unique `id`), not the source's index-based shape. | Must |

---

## 5. Technical Design

### 5.1 HTML additions
- **After** `#individual-info` (and before `#nominee-info`), insert `#second-applicant-info` and `#third-applicant-info` sections — copy the Organizational Individual Information markup, prefix every `name=` with `app2_`/`app3_`, set `fullNameEn`→`app2_fullNameEn`, `accountGender`→`app2_gender`, keep reduced address set. Add `app{N}_cif`, `app{N}_amlTrackingNumber`. Wrap in `.form-section` with `style="display:none;"`.
- **Inside** `#nominee-info` `.form-fields`, append the "Add Nominee" button and `#additionalNomineesContainer` (mirroring source lines 3731–3734). Add `.totalShareIndicator` next to `nomineeShare`.
- Convert FATCA `fatca_accountHolder` input → `<select id="fatcaAccountHolderSelect" name="fatca_accountHolder">` with options `1st/2nd/3rd`.

### 5.2 JavaScript additions (inside the existing IIFE)
- `updateApplicantSections()` — adapted to Organizational section IDs and the "Individual Information" title.
- `app2TranslateDebounced` / `app3TranslateDebounced` — reuse existing `translateText`/`debounce`.
- Address-copy handlers for `app2`/`app3` (reduced field list `['Road','PO','Thana','District']`).
- Add-nominee handler, `validateNomineeShares()`, event delegation on `#additionalNomineesContainer`.
- `getApplicantDataMap(prefix)` — Organizational field map (unprefixed → `prefix_`).
- `generateNomineePagesMarkup()` — clone `data-page=41`, map `nom2_*` → `nom{N}_*`.
- Patch the print routine (`printCurrentPage` / `printFormTypePages`) to swap applicant data and splice applicant + nominee page clones into the print markup.
- Overlay config: add `nom2_*` entries under key `41` (or a dedicated additional-nominee page if a new image is added), and additional-applicant page entries if PR-1 page is added.

### 5.3 Persistence (critical)
`loadFormData()` iterates saved keys and writes to `form.elements[key]` — but dynamically-added nominees don't exist in the DOM at load time. **Design:** before applying saved values, detect `nom{N}_*` keys in the saved data, determine the max N, and programmatically re-create that many additional-nominee sections (invoke the add-nominee routine N-1 times), THEN apply values. Alternatively, persist a `nomineeCount` and rebuild on load. Applicant sections are static (always in DOM), so they need no rebuild — just value restore + `updateApplicantSections()` call after load.

### 5.4 Field naming convention (summary)
| Entity | Prefix | Example |
|--------|--------|---------|
| 1st applicant | *(none)* | `fullNameEn`, `dob`, `nid` |
| 2nd applicant | `app2_` | `app2_fullNameEn`, `app2_nid` |
| 3rd applicant | `app3_` | `app3_fullNameEn`, `app3_nid` |
| 1st nominee | *(none)* | `nomineeName`, `nomineeShare` |
| Nth nominee (N≥2) | `nom{N}_` | `nom2_name`, `nom3_share` |

---

## 6. Open Questions / Risks

1. **Additional Applicant preview image** — Organizational form-এ personal editor-এর মতো আলাদা "Additional Applicant" page image (55–58) নেই। কোনটা ব্যবহার হবে? (a) org page-1 image reuse, (b) নতুন image supply, নাকি (c) print-এ শুধু data swap করে existing page 1 reprint? → **User decision দরকার।**
2. **Nominee page capacity** — org nominee page (41) কি একাধিক nominee একই page-এ ধরে, নাকি প্রতি nominee-তে আলাদা page clone? Source একটি page/nominee করে। → default: per-nominee clone।
3. **`either` ownership option** — parity-র জন্য add করব কিনা। → default: skip unless requested।
4. **Nominee guardian sub-section** — organizational nominee-দের জন্য minor-guardian flow লাগবে কিনা। → default: include (harmless, hidden unless minor)।
5. **Overlay positions** — নতুন applicant/nominee overlay-গুলোর `top`/`left` org form image অনুযায়ী calibrate করতে হবে; initial values approximate হবে, edit-mode দিয়ে fine-tune করা যাবে।

---

## 7. Acceptance Criteria

- Mode of Operation = Jointly/Anyone/Others → 2nd/3rd applicant name fields দেখায়; name দিলে corresponding applicant information section খোলে।
- 2nd/3rd applicant-এর সব field আলাদাভাবে save/restore হয় (reload survives)।
- "Add Nominee" click করলে নতুন nominee block যোগ হয়; Remove করলে বাদ যায়; share total 100% cap ঠিকভাবে enforce হয়।
- একাধিক nominee সহ reload করলে সব nominee ফিরে আসে (persistence rebuild)।
- Print করলে: 1st applicant সহ full form + প্রতিটি filled applicant/nominee-এর জন্য যথাযথ page order-এ pages আসে; কোনো overlay data leak হয় না (print-এর পর original state restore হয়)।
- FATCA account-holder dropdown শুধু existing applicant-দের নাম দেখায়।
- বিদ্যমান single-applicant / single-nominee workflow অক্ষুণ্ণ থাকে (regression নেই)।

---

## 8. Suggested Implementation Phases

1. **Phase 1 — Applicant sections + logic:** HTML for `app2_`/`app3_` sections, `updateApplicantSections()`, translation, address-copy, FATCA dropdown. (No print yet.)
2. **Phase 2 — Nominee dynamic UI:** Add-nominee button, dynamic render/remove, `validateNomineeShares`, persistence rebuild.
3. **Phase 3 — Print integration:** `getApplicantDataMap`, `generateNomineePagesMarkup`, print-routine patch, overlay config, page ordering.
4. **Phase 4 — Calibration & QA:** overlay position tuning, regression pass against acceptance criteria.
