# PRD — FATCA-linked Nationality & Resident/Non-Resident Status for Organizational Account Opening Form Editor

**Document status:** Draft v1
**Author:** Kiro
**Date:** 2026-08-21
**Target file:** `Organizational Account Opening Form Editor/Organizational Account Opening Form Editor.html`
**Reference implementation:** `Account Opening Form Editor/Account Opening Form Editor.html`

---

## 1. Overview / Objective

Personal `Account Opening Form Editor`-এ FATCA, Resident/Non-Resident status, এবং Nationality একটি interconnected feature হিসেবে কাজ করে:
- **FATCA dropdown = Yes** করলে (a) FATCA Declaration section, (b) FATCA preview page, এবং (c) **সব applicant-এর Nationality field** দেখায়।
- **Resident Status** (Yes=Resident / No=Non-Resident) সবসময় দৃশ্যমান থাকে (FATCA দ্বারা নিয়ন্ত্রিত নয়) এবং print-এ `resident_yes`/`resident_no` tick হিসেবে render হয়।
- **Nationality** field-এর default "Bangladeshi", শুধু FATCA=Yes হলে দেখায়, এবং print-এ nationality overlay হিসেবে বসে।

এই PRD-এর লক্ষ্য: এই তিনটি সংযুক্ত আচরণ Organizational editor-এ port করা — একই field naming, একই toggle logic, একই print behaviour — কিন্তু Organizational form-এর নিজস্ব section structure, reduced address model, ও overlay config shape (`{id, field, top, left, label}`) অনুযায়ী।

### Scope
- **In scope:** Nationality field (1st applicant + 2nd/3rd applicant) FATCA-এর সাথে যুক্ত করে show/hide; Resident Status dropdown (1st + 2nd/3rd applicant); `handleFatcaToggle` আপডেট করে `.fatca-nationality-field` toggle; `resident_yes`/`resident_no` + `nationality` overlay + updateOverlays tick logic; multi-applicant print swap-এ nationality + residentStatus অন্তর্ভুক্তি।
- **Out of scope:** Guardian/Beneficial-Owner nationality (Personal-এ আছে; Organizational-এ guardian applicant-flow নেই — BO section থাকলে optional); form redesign; নতুন page image।

---

## 2. Current State (Target — Organizational Editor)

### 2.1 FATCA (already present)
- FATCA dropdown `name="fatca"` (No/Yes) Account Information-এ আছে।
- `#fatca-declaration-section` আছে; `fatca_accountHolder` এখন dropdown (1st/2nd/3rd) — earlier feature-এ যোগ করা।
- FATCA preview page `data-page="60"` (`Images/FATCA/FATCA_page-0001.jpg`) আছে।
- `handleFatcaToggle()` **আছে** (~line 8459) কিন্তু এটি শুধু section + `.fatca-page` toggle করে + `updateOverlays()` ডাকে। **`.fatca-nationality-field` toggle করে না** (কারণ এখনো কোনো nationality field নেই)।

### 2.2 Nationality — অনুপস্থিত
- Individual Information বা 2nd/3rd applicant section-এ কোনো `nationality` / `app2_nationality` / `app3_nationality` field নেই।

### 2.3 Resident Status — অনুপস্থিত
- কোনো `residentStatus` / `app2_residentStatus` / `app3_residentStatus` field নেই।
- Overlay config-এ কোনো `resident_yes` / `resident_no` entry নেই; updateOverlays-এ কোনো `resident_` branch নেই।

### 2.4 Infrastructure (relevant)
- Individual Information field set: reduced address (Road/PO/Thana/District only)।
- 2nd/3rd applicant sections `#second-applicant-info` / `#third-applicant-info` (`app2_`/`app3_`) **আছে** (আগের feature)। এদের মধ্যে বর্তমানে nationality/resident field নেই।
- `getApplicantDataMap(prefix)` **আছে** কিন্তু এতে `nationality`/`residentStatus` নেই।
- updateOverlays-এ ইতিমধ্যে `male`/`female`/`other` gender tick branch আছে; `fatca_q*_yes/no` tick logic আছে।
- Overlay entries shape: `{id, field, top, left, label}` (Personal-এ `id` নেই)।

---

## 3. Reference Behaviour (Source — Personal Editor)

### 3.1 handleFatcaToggle (lines 8842–8859)
```js
function handleFatcaToggle() {
  const fatcaSection = document.getElementById('fatca-declaration-section');
  const fatcaVal = ... 'no';
  if (fatcaSection) fatcaSection.style.display = (fatcaVal === 'yes') ? '' : 'none';
  document.querySelectorAll('.fatca-page').forEach(pg => { ...toggle... });
  document.querySelectorAll('.fatca-nationality-field').forEach(el => {
    el.style.display = (fatcaVal === 'yes') ? '' : 'none';
  });
}
```
একই function তিনটি কাজ করে: FATCA section, FATCA page, ও **সব `.fatca-nationality-field`** দেখায়/লুকায়।

### 3.2 Nationality fields
প্রতিটি entity-তে একটি hidden nationality field, class `fatca-nationality-field`, `value="Bangladeshi"`:
- 1st: `name="nationality"`, 2nd: `app2_nationality`, 3rd: `app3_nationality` (guardian `gNationality`, BO `boNationality` — org-এ optional)।

### 3.3 Resident Status
- সবসময় দৃশ্যমান select (`Yes (Resident)` / `No (Non-Resident)`): `residentStatus`, `app2_residentStatus`, `app3_residentStatus`।
- **FATCA-এর সাথে যুক্ত নয়** — non-resident হলে nationality আপনাআপনি দেখায় না; nationality শুধু FATCA=Yes-এ দেখায়।

### 3.4 Print / overlay
- Overlay entries: `{ field:'nationality', top:'26%', left:'35%' }`, `{ field:'resident_yes', top:'90%', left:'50%' }`, `{ field:'resident_no', top:'90%', left:'56%' }` — page 1 ও প্রতিটি additional-applicant page-এ।
- updateOverlays tick logic (lines 6616–6625):
```js
else if (field.startsWith('resident_')) {
  const resVal = form.elements['residentStatus'] ? ...'yes';
  if (field === 'resident_yes') displayValue = (resVal === 'yes') ? '✔' : '';
  else if (field === 'resident_no') displayValue = (resVal === 'no') ? '✔' : '';
}
```
Base `residentStatus` পড়ে; multi-applicant print-এ value swap করে সঠিক applicant দেখায়।
- `getApplicantDataMap`-এ `'nationality': prefix+'_nationality'` ও `'residentStatus': prefix+'_residentStatus'` অন্তর্ভুক্ত (lines 10222, 10238)।
- কোনো `bangladeshiLabel` static overlay নেই — nationality সাধারণ data overlay হিসেবে render হয় (default "Bangladeshi")।

---

## 4. Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FN-1 | Individual Information section-এ একটি hidden Nationality field যোগ (`name="nationality"`, class `fatca-nationality-field`, default `Bangladeshi`)। | Must |
| FN-2 | 2nd ও 3rd applicant section-এ hidden Nationality field যোগ (`app2_nationality`, `app3_nationality`, class `fatca-nationality-field`, default `Bangladeshi`)। | Must |
| FN-3 | Individual Information + 2nd/3rd applicant section-এ **always-visible** Resident Status dropdown যোগ (`residentStatus`, `app2_residentStatus`, `app3_residentStatus`; options Yes=Resident / No=Non-Resident)। | Must |
| FN-4 | `handleFatcaToggle()` আপডেট করে `.fatca-nationality-field` show/hide অন্তর্ভুক্ত করা (FATCA=Yes → দেখাও)। | Must |
| FN-5 | Overlay config-এ `nationality`, `resident_yes`, `resident_no` entry যোগ — page 1/2 (মূল form) ও additional-applicant pages (55/57)। | Must |
| FN-6 | updateOverlays-এ `resident_` tick branch যোগ (base `residentStatus` পড়ে ✔ বসায়)। | Must |
| FN-7 | overlay init-এ `resident_yes`/`resident_no` কে tick-type হিসেবে treat করা (fixed-tick eligibility list-এ যোগ)। | Must |
| FN-8 | `getApplicantDataMap(prefix)`-এ `nationality` ও `residentStatus` যোগ (multi-applicant print-এ সঠিক applicant-এর মান দেখাতে)। | Must |
| FN-9 | FATCA=No হলে nationality field হাইড থাকবে; Resident Status সবসময় দৃশ্যমান (FATCA-নিরপেক্ষ)। | Must |
| FN-10 | (Optional) Beneficial Owner section থাকলে `boNationality` field একই class-এ যোগ। | Could |

---

## 5. Technical Design

### 5.1 HTML additions
- **Individual Information** (`#individual-info`): E-TIN / Occupation-এর কাছাকাছি একটি hidden Nationality field + একটি Resident Status select যোগ।
- **2nd/3rd applicant** (`#second-applicant-info`, `#third-applicant-info`): source-এর প্যাটার্নে `app{N}_nationality` (hidden, class `fatca-nationality-field`) ও `app{N}_residentStatus` (visible select) যোগ। এগুলো applicant section-এর শেষে বা occupation-এর কাছে বসবে।

### 5.2 JavaScript
- **`handleFatcaToggle()`** আপডেট: বিদ্যমান function-এ `.fatca-nationality-field` toggle লাইন যোগ (source verbatim)।
- **updateOverlays**: `fatca_q*` branch-এর পাশে `resident_` branch যোগ:
```js
else if (field && field.startsWith('resident_')) {
  const resVal = form.elements['residentStatus'] ? String(form.elements['residentStatus'].value||'').toLowerCase() : 'yes';
  if (field === 'resident_yes') displayValue = (resVal === 'yes') ? '✔' : '';
  else if (field === 'resident_no') displayValue = (resVal === 'no') ? '✔' : '';
}
```
- **initializeOverlays** fixed-tick list-এ `field === 'resident_yes' || field === 'resident_no'` যোগ (যাতে সঠিক ছোট tick-overlay style পায়)।
- **getApplicantDataMap**: `'nationality': prefix + '_nationality'`, `'residentStatus': prefix + '_residentStatus'` যোগ। (print swap ইতিমধ্যে base field overwrite করে, তাই resident tick + nationality overlay স্বয়ংক্রিয়ভাবে সঠিক applicant দেখাবে।)

### 5.3 Overlay positions
- `nationality`, `resident_yes`, `resident_no` — Organizational page 1/2 ও 55/57-এ আনুমানিক position-এ বসবে (edit-mode + Save Positions দিয়ে fine-tune)। Source page-1 reference: nationality 26%/35%, resident_yes 90%/50%, resident_no 90%/56% — কিন্তু org form image ভিন্ন, তাই calibrate করতে হবে।

### 5.4 Persistence
- সব নতুন field static (section-এ থাকে), তাই বিদ্যমান `saveFormData`/`loadFormData` (FORM_KEY iterate) স্বয়ংক্রিয়ভাবে ধরে নেবে — আলাদা rebuild দরকার নেই।

---

## 6. Open Questions / Risks
1. **Resident Status কোন page-এ tick হবে?** Organizational main form image-এ resident/non-resident checkbox কোথায় আছে জানা দরকার — না থাকলে overlay শুধু additional-applicant page-এ থাকবে। → user/preview যাচাই।
2. **Nationality overlay কোথায়?** org form-এ nationality লেখার জায়গা কোথায় — position calibrate করতে হবে।
3. **Beneficial Owner nationality** যোগ করা হবে কিনা (org-এ BO section আছে)। → default: skip unless requested।
4. **Guardian** org-এ applicant হিসেবে নেই — guardian nationality/resident বাদ।

---

## 7. Acceptance Criteria
- FATCA=Yes করলে Individual + 2nd/3rd applicant section-এ Nationality field দেখায় (default Bangladeshi); FATCA=No করলে হাইড।
- Resident Status dropdown সবসময় দৃশ্যমান, FATCA বদলালেও থাকে।
- Print করলে resident_yes/resident_no tick সঠিক applicant-এর status অনুযায়ী বসে; nationality overlay সঠিক মান দেখায়।
- Multi-applicant print-এ ২য়/৩য় applicant page-এ তাদের নিজ nationality ও resident status আসে (1st-এর নয়)।
- বিদ্যমান FATCA/applicant/nominee workflow অক্ষুণ্ণ (regression নেই)।

---

## 8. Implementation Phases
1. **Phase 1 — Fields:** Nationality (hidden, `.fatca-nationality-field`) + Resident Status (visible) HTML — Individual + app2 + app3।
2. **Phase 2 — Toggle:** `handleFatcaToggle()`-এ `.fatca-nationality-field` toggle যোগ।
3. **Phase 3 — Overlay + print:** overlay config (nationality/resident_yes/resident_no) + updateOverlays resident branch + fixed-tick list + getApplicantDataMap-এ nationality/residentStatus।
4. **Phase 4 — Calibration & QA:** overlay position tuning; acceptance criteria যাচাই।
