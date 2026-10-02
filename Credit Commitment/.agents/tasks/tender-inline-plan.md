# Implementation Plan — Inline the Tender & Payorder Ledger into Credit Commitment.html

## Context (verified during exploration)

- **Host file:** `Credit Commitment.html` (4124 lines). Four-tab app. Default landing page is `showPage('tender')` (line ~3204). `main`, `#editorPage`, `#customerPage` are inline pages; `#egpModal.egp-inline` is the EGP page; `#tenderPage` currently holds an iframe.
- **Source file:** `Tender Payorder Ledger.html` (1709 lines). Verified boundaries:
  - `<head>`: external links (`../css/unified-theme.css`, `../css/fontawesome.min.css`), `<script src="../lib/exceljs/exceljs.min.js">`, main `<style>` (lines ~10–296), `<style id="embeddedHideHeader">` (297–309, **DROP**), `.embedded`-class inline `<script>` (310–316, **DROP**).
  - `<body>`: `.app-header` (318–326, **DROP**), `.layout` (327 → before 456), `#bulkModal` (456–468), `#recipientModal` (470–484), main IIFE `<script>` (485–1706) = `(function(){ 'use strict'; ... init(); })();`.
- **exceljs path — VERIFIED:** The file lives at `c:\Users\Tanzil Ahmed\Downloads\BankOps Hub\lib\exceljs\exceljs.min.js`, i.e. one directory ABOVE the workspace root. The host already loads libs via `../lib/...` (`../lib/html2pdf/html2pdf.bundle.min.js`) and css via `../css/...`. **Correct relative path for the host is `../lib/exceljs/exceljs.min.js`** (identical to what the source used). The file exists at that resolved location — confirmed on disk.
- **Storage keys — VERIFIED identical** in source IIFE: `cc_tender_entries`, `cc_recipients`, `cc_customers`, `cc_tender_batches`, `cc_tender_working_batch`. Keep byte-for-byte. Do NOT touch.
- **`:root` tokens:** Source `:root` values are identical to the host's existing `:root`. The host already defines all `--primary`, `--radius-*`, `--shadow-*`, `--transition`, etc. **Drop the source `:root` block entirely** — do not re-declare it (global, would be redundant and risks drift).
- **IIFE isolation — VERIFIED:** source IIFE references elements only via its own `el(id)` = `document.getElementById`. It uses `document.body.appendChild` for a hidden print iframe (`#tpPrintFrame`, self-contained inline-CSS print — unaffected by inlining) and for download anchors. No `window.parent`, no `?embedded` check inside the IIFE, no `DOMContentLoaded` wrapper (runs synchronously; must sit AFTER the markup). Host has its own `el()` inside a separate IIFE — no collision (both function-scoped).
- **Host spacing baseline — VERIFIED:** `main` and `#egpModal.egp-inline` both use `padding: 12px 28px 20px; max-width: 1440px; margin: 0 auto;`. Current `#tenderPage` uses `padding: 4px 0 0;` (the cause of the mismatched top gap).
- **Collision selectors confirmed in source CSS (bare/generic):** `body`, `*`, `table`, `thead th`, `thead th:first-child/:last-child`, `tbody td`, `tbody tr:hover`, `tr.released`, `input`, `select`, `input:focus`, `input[readonly]`, `.card`, `.card h2/h3`, `.btn` + variants (`.secondary`, `.success`, `.danger`, `.ghost`, `.sm`), `.form-group`, `.modal`, `.modal-overlay`, `.modal-overlay.hidden`, `.modal-actions`, `.modal-head`, `.modal-x`, `.hidden`, `.hint`, `.pill`, `.num`, `.empty`, plus all tender-specific classes (`.layout`, `.selector-bar`, `.filters`, `.ledger-toolbar`, `.toggle-group`, `.batch-*`, `.recipient-*`, `.bulk-*`, `.badge`, `.group-header`, `.subtotal-row`, `.grandtotal-row`, `.entry-row`, `.row-actions`, `.icon-btn`, `.alt-cell`, `.rel-date`).

> **No build tooling exists** (no package.json / Makefile / test runner; plain static HTML opened in a browser). "Verify" steps are therefore: open `Credit Commitment.html` in a browser and exercise the UI, plus a few static file checks. There are no unit tests to run. This is noted as a project constraint, not a gap to fix.

---

# Implementation Plan

- [x] 1. **Add the exceljs script to the host `<head>`.**
      In `Credit Commitment.html`, add `<script src="../lib/exceljs/exceljs.min.js"></script>` into `<head>`, immediately after the existing `<script src="../lib/html2pdf/html2pdf.bundle.min.js"></script>` line (~line 9). Use that exact relative path (verified to resolve to `BankOps Hub/lib/exceljs/exceljs.min.js`).
      Files: `Credit Commitment.html`
      Verify: open the page in a browser, open devtools Network tab, reload, confirm `exceljs.min.js` loads with HTTP 200 (not 404) and the console shows no "exceljs" load error. Also confirm `typeof ExcelJS !== 'undefined'` in the console.

- [x] 2. **Replace the `#tenderPage` CSS block with scoped tender styles.**
      Locate the existing CSS near line ~1012–1021 (the comment "Tender & Payorder Ledger embedded as an inline page (via iframe)." plus the `#tenderPage { ... }` and `#tenderPage iframe { ... }` rules). Delete the `#tenderPage iframe { ... }` rule entirely (no iframe anymore). Rewrite `#tenderPage` to the host inline-page baseline and append the full scoped tender stylesheet. Scoping strategy (apply to the whole source `<style>` block, lines ~36–296, EXCLUDING `:root` and `embeddedHideHeader`):
      - **Body fold:** do NOT emit a global `body {}` or `* {}` rule. Fold only layout-relevant bits into `#tenderPage` itself: `color: var(--text); line-height: 1.6;`. Do NOT copy the source body `padding: 24px`, gradient background, `min-height: 100vh`, or `overflow-x` — the host page owns those. Set `#tenderPage { max-width: 1440px; margin: 0 auto; padding: 12px 28px 20px; }` (matches `main`/`.egp-inline` so all four tabs share the nav-to-content gap). Add `#tenderPage, #tenderPage *, #tenderPage *::before, #tenderPage *::after { box-sizing: border-box; }` to replace the dropped global reset without touching the host (host already box-sizes its own elements; scope defensively).
      - **Drop** the source `.app-header*` rules (header removed).
      - **Prefix every remaining rule with `#tenderPage `**, turning bare selectors into descendants: `.layout` → `#tenderPage .layout`; `.card` → `#tenderPage .card`; `table` → `#tenderPage table`; `thead th` → `#tenderPage thead th`; `tbody td` → `#tenderPage tbody td`; `tbody tr:hover` → `#tenderPage tbody tr:hover`; `input, select` → `#tenderPage input, #tenderPage select`; `input:focus, select:focus` → `#tenderPage input:focus, #tenderPage select:focus`; `input[readonly]` → `#tenderPage input[readonly]`; `.btn` and all variants → `#tenderPage .btn`, `#tenderPage .btn.secondary`, etc.; `.form-group` → `#tenderPage .form-group`; `.hint`, `.pill`, `.num`, `.empty`, `.badge`, `.group-header`, `.subtotal-row`, `.grandtotal-row`, `.entry-row`, `.row-actions`, `.icon-btn`, `.alt-cell`, `.rel-date`, `.selector-bar`, `.recipient-pick`, `.filters`, `.ledger-toolbar`, `.toggle-group`, `.batch-*`, `.recipient-*`, `.bulk-*` → each prefixed with `#tenderPage `.
      - **`@media` queries:** keep each `@media(...)` wrapper, and inside it prefix the selector (e.g. `@media (max-width: 760px) { #tenderPage .layout { grid-template-columns: 1fr; } }`).
      - **Modals (keep fixed overlay behavior):** `.modal-overlay` → `#tenderPage .modal-overlay { position: fixed; inset: 0; ... }` (KEEP `position:fixed; inset:0; z-index:50`); `.modal-overlay.hidden` → `#tenderPage .modal-overlay.hidden { display: none; }`; `.modal` → `#tenderPage .modal`; `.modal h3` → `#tenderPage .modal h3`; `.modal-actions` → `#tenderPage .modal-actions`; `.modal.bulk-modal`, `.modal-head`, `.modal-head h3`, `.modal-x`, `.modal-x:hover`, `.bulk-body`, `.bulk-*` → each prefixed. The modals live inside `#tenderPage` in the DOM, so the descendant scope holds while `position:fixed` still covers the viewport.
      Files: `Credit Commitment.html`
      Verify: after step 3 markup is in, open the page; the tender tab renders the two-column layout with styled cards/table/buttons, and switching to the Credit Commitment / EGP / Customer tabs shows NO visual regression (host buttons, tables, inputs, modals unchanged). Specifically open the host EGP modal and the Customer page to confirm `.form-group`, `.modal-actions`, `.hidden`, `.btn.secondary`, `.btn.danger`, `table`, `input`, `select` on those pages look exactly as before.

- [x] 3. **Replace the `#tenderPage` section body: remove the iframe, inline the real tender markup.**
      Locate the section at lines ~1602–1605:
      `<section id="tenderPage" style="display:none;"> <iframe id="tenderFrame" ...></iframe> </section>`.
      Replace its inner content with the source `<body>` content MINUS the `.app-header` div — i.e. paste the `.layout` block (source ~327–455), the `#bulkModal` overlay (~456–468), and the `#recipientModal` overlay (~470–484), verbatim, keeping every element `id` unchanged. Keep the `<section id="tenderPage" style="display:none;">` wrapper and its `style="display:none;"` (showPage toggles it). Do NOT paste the source `.app-header`, `embeddedHideHeader` style, or the `.embedded` inline script.
      Files: `Credit Commitment.html`
      Verify: open the page; with the tender tab active, the selector bar (Customer/Recipient/Last Date/Save Batch), the ledger table with its inline entry row, the Filters card, and the Saved Tender card all appear. No duplicate IDs — run in console: `['customerSelect','recipientSelect','ledgerBody','batchList','bulkModal','recipientModal','tenderId','poNumber','bulkBody'].filter(id=>document.querySelectorAll('#'+CSS.escape(id)).length!==1)` returns `[]`.

- [x] 4. **Paste the tender IIFE into the host, before the host's main `<script>`.**
      Immediately after the closing `</section>` of `#tenderPage` and immediately BEFORE the host's existing `<script>` (the one starting `// Credit Commitment Editor - app.js` at ~line 1611), insert a new `<script>...</script>` containing the source IIFE verbatim: `(function () { 'use strict'; ... init(); })();` (source ~486–1705). Do NOT merge it into the host IIFE; keep it self-contained. All referenced tender elements exist above it in the DOM, so synchronous `init()` succeeds.
      Files: `Credit Commitment.html`
      Verify: open the page; console has no ReferenceError/TypeError on load. Add a tender entry (fill Tender ID / Payorder / Amount / Doc Fees, click Add) and confirm it appears in the ledger; click Save Batch and confirm it appears under Saved Tender; reload and confirm persistence (reads `cc_tender_*` keys). Open the host Credit Commitment tab and confirm its own script still works (template selection, editor rendering) — i.e. the two IIFEs coexist.

- [x] 5. **Rewrite the `showPage` `p==='tender'` branch to drop iframe lazy-loading.**
      In `showPage(p)` (~line 3104), the `else if (p==='tender')` branch currently does: hide `main`, show `#tenderPage`, set nav active, then look up `#tenderFrame` and set its `src` from `data-src`. Remove the `const frame = document.getElementById('tenderFrame'); if (frame && ...) { frame.setAttribute('src', ...); }` lines. Keep: `if (mainEl) mainEl.style.display='none'; if (tender) tender.style.display='block'; if (navTenderLedger) navTenderLedger.classList.add('active'); animTarget = tender;`. Leave the shared hide-all-pages logic and the trailing `.page-anim` re-trigger block untouched so the switch animation stays identical to the other three tabs. Leave the default landing `showPage('tender')` (~line 3204) intact.
      Files: `Credit Commitment.html`
      Verify: open the page (lands on tender by default). Click each nav button in turn (Tender → EGP → Credit Commitment → Customer → back to Tender); each shows the correct page with the same fade-in animation and no leftover/duplicate content. Console shows no error referencing `tenderFrame`. Search the file for `tenderFrame` / `data-src` and confirm zero remaining references.

- [x] 6. **Static cleanup sweep — confirm no iframe-era artifacts remain.**
      Grep the final `Credit Commitment.html` for leftover artifacts and remove any stragglers: `tenderFrame`, `#tenderPage iframe`, `data-src="Tender`, `embedded=1`, `embeddedHideHeader`, `html.embedded`, `.app-header` added from the source (host must not gain a tender back-button/title). The source file `Tender Payorder Ledger.html` must remain on disk, unmodified.
      Files: `Credit Commitment.html` (verify only; edits only if stragglers found)
      Verify: `Tender Payorder Ledger.html` still exists and is unchanged (unmodified timestamp/size). In `Credit Commitment.html`, searching for `tenderFrame`, `embedded=1`, `embeddedHideHeader`, `html.embedded` returns no matches; searching `id="tenderPage"` returns exactly one section with inline markup (no `<iframe>` descendant).

---

## Full static verification checklist (run after all steps)

Open `Credit Commitment.html` directly in a browser (file:// is fine; libs load via `../lib`, `../css`). Then:

1. **Load clean:** no console errors/warnings on first paint; default tab is Tender & Payorder Ledger and it is visually complete (two-column layout, cards, styled table).
2. **No iframe:** devtools Elements → `#tenderPage` contains the real markup, zero `<iframe>` children. No `#tenderFrame` anywhere.
3. **exceljs loaded:** Network shows `../lib/exceljs/exceljs.min.js` 200; `typeof ExcelJS === 'object'/'function'` in console. Select a saved tender → Bulk Payorder → Create Excel downloads a `.xlsx` (no "Excel library not loaded" alert).
4. **Gap parity:** the nav-to-first-card vertical gap on the Tender tab visually matches the EGP, Credit Commitment, and Customer tabs (all use `padding:12px 28px 20px`). Reference the user's screenshots — the previously-excessive top gap is gone.
5. **No border artifact:** no iframe border/box around the tender content; content sits flush like the other tabs.
6. **Animation parity:** switching between all four tabs produces the same `fadeIn 0.35s` animation each time (re-triggered on repeat switches).
7. **CSS isolation (host unaffected):** open EGP modal and Customer page; their `.form-group`, `.modal`, `.modal-overlay`, `.modal-actions`, `.hidden`, `.secondary`, `.danger`, `.btn`, `table`, `input`, `select` render exactly as before the change (no tender styles bleeding in). Confirm the host still has NO global `body`/`*` rule introduced by the tender CSS.
8. **Tender functionality:** add entry; edit entry; delete entry; Save Batch; expand a saved batch (accordion); toggle Release status; Clear Filters; Add Recipient (modal opens as fixed overlay covering viewport, Cancel/Save work); Print Selected (hidden `#tpPrintFrame` print path works); Import/Export Saved Tenders (JSON) works.
9. **Modals cover viewport:** `#bulkModal` and `#recipientModal` open as centered fixed overlays over the whole window (not clipped inside the card), and `.hidden` keeps them closed by default.
10. **Shared storage integrity:** add a customer/recipient on the host Customer & Recipient page and confirm it appears in the tender Customer/Recipient dropdowns (shared `cc_customers`/`cc_recipients`), and vice-versa — keys unchanged.
11. **Source untouched:** `Tender Payorder Ledger.html` still on disk, unmodified.

## Notes / assumptions

- No automated test suite or build step exists in this repo (static HTML). Verification is manual browser testing as above; this is a project constraint, not something to add unless the user asks.
- The `.kilo/worktrees/shadow-cent/...` copy of `Credit Commitment.html` is a stale worktree and is explicitly OUT OF SCOPE — only the workspace-root `Credit Commitment.html` is edited.
- Ordering rationale: CSS (step 2) and markup (step 3) can be authored together but are listed separately for clarity; the IIFE (step 4) must come after markup exists in the DOM; the `showPage` edit (step 5) is independent but logically last among code edits; step 6 is a final sweep. Each step leaves the file as valid, openable HTML.

---

## Static verification record (iteration 1 — commands run + results)

This is a static HTML app with no build/test tooling, so verification is static-only. Each item below was run against the final `Credit Commitment.html`; reviewers can read these results without re-running.

**exceljs path resolution.** `Test-Path "BankOps Hub/lib/exceljs/exceljs.min.js"` → `True`. Host lives at `BankOps Hub/Credit Commitment/Credit Commitment.html`, so the added tag `<script src="../lib/exceljs/exceljs.min.js"></script>` (head, line 10, right after html2pdf) resolves to the on-disk file. ✅

**No tender iframe remains.** Grep `tenderFrame|embedded=1|embeddedHideHeader|html.embedded|data-src="Tender` → **no matches**. Grep `iframe` → only legitimate hidden *print* iframes remain (`#tpPrintFrame` in the tender IIFE print path, the CC print path, and the EGP `__egp_print_iframe`). The tender embedding iframe is gone. ✅

**CSS fully scoped.** Tender CSS block spans host lines 1011–1256. Every rule-opening line contains `#tenderPage` (131 `#tenderPage` occurrences; 4 `@media` wrappers each with a `#tenderPage`-prefixed inner selector). Programmatic check for rule-opening lines lacking `#tenderPage` (excluding `@media`/comments) → **zero**. No new global `body`/`*`/`:root`/`.app-header` rule introduced in the block (counts all 0). No bare `table`/`.card`/`.btn`/`input`/`select` rule added outside `#tenderPage`. ✅

**Storage keys unchanged.** All five present verbatim in the tender IIFE (host lines 1998–2002): `cc_tender_entries`, `cc_recipients`, `cc_customers`, `cc_tender_batches`, `cc_tender_working_batch`. Host's own Customer/Recipient/EGP code references the same keys. ✅

**No duplicate element IDs.** Checked `customerSelect, recipientSelect, ledgerBody, batchList, bulkModal, recipientModal, tenderId, poNumber, bulkBody, ledgerTable, fltCustomer, entryRow, saveEntryBtn` → each appears exactly **1×** as an `id="..."` attribute. ✅

**showPage('tender') branch rewritten.** Branch now only hides `main`, shows `#tenderPage`, sets `navTenderLedger` active, and `animTarget = tender`; it then flows into the shared `.page-anim` remove/reflow/add block identical to the other three tabs. No `tenderFrame`/`data-src` lazy-load code remains. Default landing `showPage('tender')` (host line 4809) left intact. ✅

**Structure intact.** Exactly 1 `#tenderPage` section (wrapper keeps `style="display:none;"`), 1 `.selector-bar`, 1 `.filters` card, "Saved Tender" card present, both tender modals (`#bulkModal`, `#recipientModal` as `modal-overlay hidden`). The source `.app-header`, `embeddedHideHeader` style, and `.embedded` inline script were dropped (content starts at `.layout`). All `<script`/`</script>` tags balanced (6/6). ✅

**Spacing/gap parity.** `#tenderPage` now uses `padding: 12px 28px 20px; max-width: 1440px; margin: 0 auto;` — matching `main` and `#egpModal.egp-inline` — and no longer the old `padding: 4px 0 0;`. First card sits flush under the nav like the other tabs. ✅

**Source untouched.** `Tender Payorder Ledger.html` is untracked in git (`??`) and was not modified; only `Credit Commitment.html` was edited.

**Not statically verifiable (requires a browser — left for manual/runtime review):** runtime console cleanliness, actual `.xlsx` export via ExcelJS, live add/edit/delete/save-batch persistence, modal viewport coverage, and the visual fade-in animation. These are runtime behaviors; the inlined IIFE is byte-identical to the previously-working source so behavior is expected to carry over.
