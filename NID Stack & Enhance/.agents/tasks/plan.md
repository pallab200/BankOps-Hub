# Implementation Plan — Real AI Image-Editing for "✨ AI Enhance (OpenRouter)"

## Context (verified by exploration, do not re-investigate)

- Pure client-side vanilla-JS app. ES modules under `src/`, bundled by esbuild to `app.bundle.js`. The HTML (`NID Stack & Enhance.html`) loads the bundle, not raw modules.
- Build: `npm run build` (esbuild bundles `src/main.js` -> `app.bundle.js`, IIFE, target es2020). Test: `npm test` (vitest `--run`, jsdom). Baseline is GREEN: build succeeds, 54 tests pass across 16 files.
- Confirmed broken: the current feature never edits with AI. `detectCardBoundariesWithAI` (in `src/core/aiNidService.js`) calls OpenRouter chat/completions as a VISION model that only returns corner coordinates. All actual cropping/de-skew/whitening/sharpening is hand-written canvas math in `src/core/nidImageEnhancer.js` (`warpPerspectiveQuad`, `enhanceRealCardImage`, `trimCardBackgroundPerimeter`, `stackEnhancedCards`). That heuristic produces the bad crops (bedsheet at top, clipped right-side text, wrong front/back split).
- Entry: `aiNidController.js` `handleAiEnhance()` -> `enhanceRealNidImages()` in `aiNidService.js`. The controller converts slots to data URLs (`getSlotImageDataUrl`, caps 2400px), reads `settings.spacing`/`settings.backgroundColor`, drives `progress`, and consumes a result shape of `{ frontCanvas, backCanvas, frontDataUrl, backDataUrl, stackedCanvas }` (stacked drawn into `previewCanvas`).
- `stackEnhancedCards(frontCanvas, backCanvas, { cardWidth=680, spacing, bgColor, targetCanvas })` already lays out front+back on one page. We will reuse it unchanged.
- Existing guards to mirror: `typeof document`, `typeof window`, `typeof fetch`, `typeof AbortController`, `typeof Image`, and `process.env.VITEST` / `NODE_ENV==='test'`. `loadImage` already has a jsdom fast-path. 60s `AbortController` timeout pattern already used in `detectCardBoundariesWithAI`.
- Tests that MUST keep passing / exports that MUST stay live: `tests/aiNid.unit.test.js` imports `DEFAULT_MODEL`, `FALLBACK_MODELS`, `getStoredApiKey/setStoredApiKey`, `getStoredModel/setStoredModel`, `cropImageRegion`, `NID_DETECTION_PROMPT` from `aiNidService.js`, and the enhancer exports. It also exercises `handleAiEnhance` with a mocked `fetch` returning a chat/completions JSON body (choices[0].message.content). Our new editing path must not break that test — see Design Decision D4 for how the mock is handled.

## Design decisions (made here; one-line rationale each)

- **D1 — Dedicated Images endpoint, new function.** Add `editCardImageWithAI()` posting to `https://openrouter.ai/api/v1/images` with `input_references`. Rationale: the task's verified API contract; keeps editing isolated from the vision/coordinate code so existing exports stay intact.
- **D2 — Internal image-edit model list, separate from the vision dropdown.** New constants `DEFAULT_IMAGE_EDIT_MODEL` + `IMAGE_EDIT_FALLBACK_MODELS`; the `#aiModelSelect` dropdown keeps selecting the vision model only. Rationale: the vision models (gemini-2.5-flash text, qwen VL) cannot edit images; forcing users to pick an image model through a vision dropdown would mislead and break detection.
- **D3 — Two-image primary path, single-image fallback reuses existing split.** When front and back are separate uploads, edit each independently and stack. When one image holds both, send one whole-sheet edit instruction, then fall back to the EXISTING `enhanceRealNidImages` local split path if the single-edit result still contains both cards. Rationale: image-edit models reliably crop/clean a single card; the existing split logic is the proven fallback for combined sheets.
- **D4 — Route `handleAiEnhance` to a new high-level editor, keep `enhanceRealNidImages` as fallback.** Add `enhanceNidImagesWithAIEdit()` that performs edits then `stackEnhancedCards`, returning the SAME result shape. On any editing failure (refusal/4xx/5xx/no image after fallbacks), fall back to calling the existing `enhanceRealNidImages`. Rationale: preserves the controller contract and all current exports/tests while making the AI actually edit; guarantees a degraded-but-working result.
- **D5 — Imperative edit prompt constant.** `DEFAULT_CARD_EDIT_PROMPT` states the change first (crop to 4 edges, remove background, de-skew, whiten, sharpen) then the preservation clause (never alter/add/remove/translate/regenerate text, numbers, photo, signature, barcode, MRZ). Rationale: the Images model returns HTTP 400 if the prompt reads like a question or triggers a refusal; imperative phrasing + explicit preservation avoids both regeneration and refusals.
- **D6 — Downscale source before editing (~1600px cap).** Add a guarded `downscaleDataUrl(dataUrl, maxEdge=1600)` helper. Rationale: oversized images time out on the Images endpoint; the controller already caps at 2400 for detection, a tighter cap for editing avoids timeouts without harming legibility.

---

## Plan

- [ ] 1. Add image-edit model constants and the edit prompt to `aiNidService.js`.
      Add exports `DEFAULT_IMAGE_EDIT_MODEL = 'google/gemini-2.5-flash-image'`, `IMAGE_EDIT_FALLBACK_MODELS = ['google/gemini-3.1-flash-image', 'google/gemini-3-pro-image', 'google/gemini-2.5-flash-image']` (newest first, then the known-referenceable slug as last resort), and `DEFAULT_CARD_EDIT_PROMPT` (imperative; change-first then preservation clause; tailored to Bangladeshi Smart/Paper NID; explicitly forbids regenerating/translating any text, numbers, photo, signature, barcode, MRZ). Keep the existing vision `DEFAULT_MODEL`/`FALLBACK_MODELS` untouched.
      Files: `src/core/aiNidService.js`
      Verify: `npm test` — existing `aiNid.unit.test.js` still passes (no export removed); build in step 9.

- [ ] 2. Add a guarded `downscaleDataUrl(dataUrl, maxEdge = 1600)` helper in `aiNidService.js`.
      Loads via existing `loadImage`, draws onto a canvas capped at `maxEdge` on the longest side, returns a JPEG/PNG data URL; when `document`/canvas is unavailable (jsdom) or the image is already small, returns the input unchanged. Mirror the guard style of `cropImageRegion`.
      Files: `src/core/aiNidService.js`
      Verify: `npm test` passes (helper is additive and no-ops under jsdom).

- [ ] 3. Implement `editCardImageWithAI({ apiKey, model, imageDataUrl, prompt, onProgress })` in `aiNidService.js`.
      Single `POST https://openrouter.ai/api/v1/images` with headers `Authorization: Bearer <apiKey>`, `Content-Type: application/json`, `HTTP-Referer`, `X-Title` (reuse the exact header pattern from `detectCardBoundariesWithAI`). Body `{ model, prompt, input_references: [{ type:'image_url', image_url:{ url: imageDataUrl } }] }`. Build an ordered try-list `[model || DEFAULT_IMAGE_EDIT_MODEL, ...IMAGE_EDIT_FALLBACK_MODELS]` de-duplicated; on `429/500/503` and (per task) `400` refusals ("could not generate"/"STOP"), advance to the next model; on the last failure throw a descriptive error (distinguish "model refused" vs "key lacks image-model access" using the error body message). Parse `data[0].b64_json` + optional `data[0].media_type` (default `image/png`) into `data:<media_type>;base64,<b64_json>`; surface `usage.cost` on the return object when present. Guard all `fetch`/`AbortController` usage (60s timeout) exactly like the detection function; under `VITEST`/no-`fetch`, do not throw spuriously.
      Files: `src/core/aiNidService.js`
      Verify: `npm test` passes; add the unit test in step 7 to cover parsing and fallback.

- [ ] 4. Implement the high-level `enhanceNidImagesWithAIEdit(params)` in `aiNidService.js` with the SAME signature and return shape as `enhanceRealNidImages`.
      For each present slot: `downscaleDataUrl` the source, call `editCardImageWithAI` with `DEFAULT_CARD_EDIT_PROMPT`, `loadImage` the returned data URL, draw it onto a canvas (front/back). Two-image path edits front and back independently. Single-image path sends one whole-sheet edit instruction (cropped/de-skewed/background-removed whole sheet) and, if a single edited sheet comes back (no separate back), reuses the EXISTING local front/back split from `enhanceRealNidImages` as fallback. Then call the existing `stackEnhancedCards(frontCanvas, backCanvas, { cardWidth: 680, spacing, bgColor, targetCanvas })`. Return `{ frontCanvas, backCanvas, stackedCanvas, frontDataUrl, backDataUrl, editCost }`. On any unrecoverable editing failure, `return await enhanceRealNidImages(params)` so the result is always usable. Drive `onProgress` with the same percentages/messages style the controller expects.
      Files: `src/core/aiNidService.js`
      Verify: `npm test` passes; integration behavior checked via step 8 controller test.

- [ ] 5. Route the controller to the new editing path while preserving the consumed result shape.
      In `aiNidController.js` `handleAiEnhance()`, import `enhanceNidImagesWithAIEdit` and call it instead of `enhanceRealNidImages` (keep `enhanceRealNidImages` imported as the service-level fallback already wired in step 4). Keep `getSlotImageDataUrl`, spacing/bgColor reads, `progress`, preview-canvas/thumbnail updates, `appState.setSource` sync, and PDF-enable logic exactly as-is since the return shape is unchanged. Keep the existing `notifyError`/`notifyGuidance`/`notifySuccess` pattern; when the error indicates refusal or no image-model access, surface a specific helpful message (e.g. "The image model refused or your key lacks image-model access").
      Files: `src/controllers/aiNidController.js`
      Verify: `npm test` — the existing `handleAiEnhance syncs appState sources` test still passes (see step 8 for keeping its mock valid).

- [ ] 6. Keep the HTML model picker as vision-only; do not add the image model to `#aiModelSelect`.
      Leave `#aiModelSelect` options and the "AI Vision Model" label unchanged. Optionally add one low-risk `field-hint` line noting that image editing uses an internal model automatically. No JS wiring change (the image model is internal via constants).
      Files: `NID Stack & Enhance.html` (optional hint only)
      Verify: build in step 9 succeeds; manual self-check that Settings save/test-key flow is untouched.

- [ ] 7. Add unit tests for the new service functions in `tests/aiNid.unit.test.js`.
      Cover: `editCardImageWithAI` parses `data[0].b64_json`+`media_type` into a correct `data:` URL (mock `global.fetch` returning an images-endpoint body); falls back to the next model on a 400 refusal then succeeds; throws a descriptive error when all models fail; `downscaleDataUrl` no-ops under jsdom. Assert new exports (`DEFAULT_IMAGE_EDIT_MODEL`, `IMAGE_EDIT_FALLBACK_MODELS`, `DEFAULT_CARD_EDIT_PROMPT` imperative/preservation keywords) exist. Mirror the existing canvas/`createElement` mock setup in this file.
      Files: `tests/aiNid.unit.test.js`
      Verify: `npm test` — new tests pass; all prior tests still pass.

- [ ] 8. Keep the existing `handleAiEnhance` controller test green under the new path.
      The existing test mocks `fetch` with a chat/completions body. Since `handleAiEnhance` now calls `enhanceNidImagesWithAIEdit`, ensure that function's failure path falls back to `enhanceRealNidImages` (which consumes exactly that chat/completions mock) OR extend the test's `fetch` mock to also answer the `/images` endpoint — choose the fallback-preserving approach (step 4) so the existing mock continues to drive a valid result and `setSource('front')`/`setSource('back')` are still called. Adjust the test only if strictly necessary to add an `/images` mock branch; do not weaken its assertions.
      Files: `tests/aiNid.unit.test.js`
      Verify: `npm test` — `aiNidController handleAiEnhance syncs appState sources` passes.

- [ ] 9. Rebuild the bundle and run the full verification suite.
      Run `npm run build` (regenerates `app.bundle.js`, which the HTML loads), then `npm test`.
      Files: `app.bundle.js` (generated)
      Verify: `npm run build` prints a bundle size with no errors; `npm test` reports all tests passing (>= the 54 baseline plus the new tests).

- [ ] 10. Self-check against the user report and constraints.
      Confirm: (a) `editCardImageWithAI` posts to `/api/v1/images` with `input_references` and parses `b64_json`; (b) the edit prompt is imperative and forbids altering real information; (c) `handleAiEnhance` return shape and `appState`/thumbnail/PDF wiring are unchanged; (d) no new runtime dependency and the bundle still builds; (e) all functions are jsdom-guarded; (f) existing vision exports (`enhanceRealNidImages`, `detectCardBoundariesWithAI`, `NID_DETECTION_PROMPT`, `DEFAULT_MODEL`, `FALLBACK_MODELS`) remain exported.
      Files: none (review step)
      Verify: `npm test` green and a manual re-read of the three touched source files confirms each self-check item.

## Verification results (this iteration)

- `npm run build`: succeeded, regenerated `app.bundle.js` (161.6kb), exit 0.
- `npm test` (vitest --run): 16 files, **61 tests passing** (was 54 baseline + 7 new image-edit tests). `aiNidController handleAiEnhance syncs appState sources` still green via the single-image fallback to `enhanceRealNidImages` (controller now calls `enhanceNidImagesWithAIEdit`).
- Temporary node self-check (fetch stubbed, deleted after run): confirmed `editCardImageWithAI` POSTs to `https://openrouter.ai/api/v1/images` with `input_references:[{type:'image_url',image_url:{url}}]`, model `google/gemini-2.5-flash-image`, and parses `data[0].b64_json`+`media_type` into `data:image/webp;base64,ABC123` with `usage.cost` surfaced. Result: SELFCHECK PASS.
- Controller wiring unchanged downstream of the result shape: preview canvas, thumb1/thumb2, `appState.setSource('front'|'back')`, `setCombinedImage`, and the PDF download enable all still run against `result.frontCanvas/backCanvas/frontDataUrl/backDataUrl/stackedCanvas`.

## Gaps / assumptions

- The exact image-edit model slugs available to a given key may vary; the ordered fallback list plus the "key lacks image-model access" message handles slugs the key can't use. Assumption: `google/gemini-2.5-flash-image` is the safe last-resort slug (already referenceable per the task).
- Single-image combined-sheet editing quality depends on the model; the plan keeps the proven local split as fallback rather than betting solely on the model.
- No live OpenRouter call is made in tests (all mocked), consistent with the existing suite; real end-to-end image quality can only be confirmed by the user running it against a live key.
