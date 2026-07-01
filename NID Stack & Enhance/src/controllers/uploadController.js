/**
 * uploadController.js — DOM glue for the Upload Component.
 *
 * Accepts NID front/back image files via click selection or drag-and-drop and
 * renders the upload state. The whole reason this controller exists as a single
 * module is defect D2: in the old code the drag-and-drop path updated only the
 * thumbnail while the click path also updated the in-card preview, so the two
 * paths produced different results. Here BOTH paths funnel through one shared
 * routine — `loadSourceImage(file, slot)` — so the resulting preview, thumbnail,
 * pixel content (same decoded data URL), dimensions, and slot assignment are
 * identical regardless of how the file arrived (Req 2.3, 12.2, 12.3).
 *
 * It also fixes defect D3: every successful load drives the Progress_Indicator
 * from begin() (0%) through complete() (100% then hidden), so the bar never
 * sticks at a partial value.
 *
 * Collaborators (appState store, message controller, progress controller, the
 * document, and the file-decode routine) are injected through the factory so
 * the controller is fully exercisable under jsdom without reaching for globals.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 9.1, 12.1, 12.2, 12.3
 */

import { validateFile } from '../core/validation.js';
import { renderFirstPage } from '../core/pdfRenderer.js';

/** CSS class applied to an upload card while a file is dragged over it (Req 2.4). */
export const DRAG_OVER_CLASS = 'is-dragover';

/** CSS class used throughout the markup to hide an element. */
const HIDDEN_CLASS = 'hidden';

/**
 * Per-slot element identifiers, matching the IDs in "NID Stack & Enhance.html".
 * `slot` is the appState source key; the rest are element ids looked up in the
 * supplied document. Keeping this as data (rather than hard-coded lookups)
 * makes the two slots share one implementation.
 */
export const SLOT_CONFIG = Object.freeze({
  front: Object.freeze({
    slot: 'front',
    fileInput: 'file1',
    dropzone: 'drop1',
    previewImg: 'preview1',
    previewContainer: 'preview1-container',
    thumb: 'thumb1',
    thumbPlaceholder: 'thumb1Placeholder',
    cropInfo: 'cropInfo1',
  }),
  back: Object.freeze({
    slot: 'back',
    fileInput: 'file2',
    dropzone: 'drop2',
    previewImg: 'preview2',
    previewContainer: 'preview2-container',
    thumb: 'thumb2',
    thumbPlaceholder: 'thumb2Placeholder',
    cropInfo: 'cropInfo2',
  }),
});

/** No-op stand-ins so an absent collaborator never throws out of a handler. */
const NOOP_PROGRESS = Object.freeze({
  begin() {},
  set() {},
  complete() {},
  fail() {},
  reset() {},
});
const NOOP_MESSAGES = Object.freeze({
  showError() {},
  showGuidance() {},
  clearMessage() {},
});

/**
 * Default file decoder: FileReader → data URL → Image. Resolves with the
 * decoded image, its source data URL (shared by preview and thumbnail so their
 * pixel content is identical), and its natural dimensions. Rejects on either a
 * read error or a decode error so the caller can report a single decode-failure
 * message (Req 2.8, 12.1).
 *
 * @param {File|Blob} file
 * @returns {Promise<{image: HTMLImageElement, src: string, naturalWidth: number, naturalHeight: number}>}
 */
function defaultDecodeFile(file) {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined' || typeof Image === 'undefined') {
      reject(new Error('No image decoding available in this environment'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-failed'));
    reader.onload = (event) => {
      const src = event && event.target ? event.target.result : null;
      if (typeof src !== 'string') {
        reject(new Error('read-empty'));
        return;
      }
      const img = new Image();
      img.onload = () =>
        resolve({
          image: img,
          src,
          naturalWidth: img.naturalWidth || img.width || 0,
          naturalHeight: img.naturalHeight || img.height || 0,
        });
      img.onerror = () => reject(new Error('decode-failed'));
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

/** Build a human-readable, file-named message for a validation rejection. */
function namedValidationMessage(reason, fileName) {
  if (reason === 'size') {
    return `The file "${fileName}" exceeds the maximum allowed size of 10 MB.`;
  }
  // Default to the type case.
  return `The file "${fileName}" is not a supported image format. Supported formats are JPEG, PNG, WebP, GIF, and PDF.`;
}

/**
 * Read a file as an ArrayBuffer via FileReader. Mirrors the existing
 * defaultDecodeFile pattern but resolves with raw bytes for PDF processing.
 *
 * @param {File|Blob} file
 * @returns {Promise<ArrayBuffer>}
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('read-failed'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Create the upload controller.
 *
 * @param {Object} deps
 * @param {import('../core/appState.js').AppStateStore} deps.appState - State store.
 * @param {{showError:Function, showGuidance?:Function, clearMessage?:Function}} [deps.messages]
 * @param {{begin:Function, set:Function, complete:Function, fail:Function, reset:Function}} [deps.progress]
 * @param {Document} [deps.document] - Document used for element lookups (defaults to global).
 * @param {(file: File|Blob) => Promise<{image:any, src:string, naturalWidth:number, naturalHeight:number}>} [deps.decodeFile]
 *   Injectable decoder (defaults to FileReader + Image). Useful under jsdom.
 * @returns {{
 *   init: () => void,
 *   destroy: () => void,
 *   loadSourceImage: (file: File|Blob, slot: ('front'|'back')) => Promise<{ok:boolean, slot:string, reason?:string}>,
 *   SLOT_CONFIG: typeof SLOT_CONFIG
 * }}
 */
export function createUploadController(deps = {}) {
  const {
    appState,
    messages = NOOP_MESSAGES,
    progress = NOOP_PROGRESS,
    document: providedDoc,
    decodeFile = defaultDecodeFile,
  } = deps;

  if (!appState || typeof appState.setSource !== 'function') {
    throw new Error('createUploadController requires an appState store');
  }

  const doc =
    providedDoc || (typeof document !== 'undefined' ? document : undefined);
  if (!doc || typeof doc.getElementById !== 'function') {
    throw new Error('createUploadController requires a document');
  }

  // Track attached listeners so destroy() can detach them cleanly.
  const teardown = [];

  function byId(id) {
    return doc.getElementById(id);
  }

  function on(el, type, handler, options) {
    if (!el || typeof el.addEventListener !== 'function') return;
    el.addEventListener(type, handler, options);
    teardown.push(() => el.removeEventListener(type, handler, options));
  }

  function show(el) {
    if (el && el.classList) el.classList.remove(HIDDEN_CLASS);
  }

  function hide(el) {
    if (el && el.classList) el.classList.add(HIDDEN_CLASS);
  }

  /** Render the in-card preview image (same data URL as the thumbnail). */
  function renderPreview(cfg, src) {
    const img = byId(cfg.previewImg);
    if (img) img.src = src;
    show(byId(cfg.previewContainer));
  }

  /** Render the Input Images thumbnail and hide its empty-state placeholder. */
  function renderThumbnail(cfg, src) {
    const thumb = byId(cfg.thumb);
    if (thumb) {
      thumb.src = src;
      show(thumb);
    }
    hide(byId(cfg.thumbPlaceholder));
  }

  /** Clear the crop-dimensions readout for the slot (fresh image has no crop). */
  function clearCropInfo(cfg) {
    const info = byId(cfg.cropInfo);
    if (info) info.textContent = '';
  }

  /**
   * Shared load routine used by BOTH the click and drop paths (D2 fix).
   *
   * Order of operations follows the design:
   *  1. Validate type/size. On rejection show a file-named error and leave the
   *     slot completely unchanged — no preview, thumbnail, or state mutation,
   *     and the progress indicator is never shown (Req 2.6, 2.7, 12.1, 12.5).
   *  2. Begin progress at 0% (Req 9.5).
   *  3. Decode the file. On read/decode failure show a file-named "could not be
   *     loaded" error and hide progress within 1 s, leaving the slot's prior
   *     content, preview, and thumbnail unchanged (Req 2.8, 12.1).
   *  4. On success commit the source to state (which clears that slot's crop),
   *     render the identical preview + thumbnail, clear the crop readout, and
   *     drive progress to 100% then hidden (Req 2.1, 2.2, 2.3, 2.5, 9.1).
   *
   * @param {File|Blob} file
   * @param {('front'|'back')} slot
   * @returns {Promise<{ok:boolean, slot:string, reason?:string, naturalWidth?:number, naturalHeight?:number}>}
   */
  async function loadSourceImage(file, slot) {
    const cfg = SLOT_CONFIG[slot];
    if (!cfg) {
      throw new Error(`Unknown upload slot: ${String(slot)}`);
    }

    const fileName =
      file && typeof file.name === 'string' && file.name
        ? file.name
        : 'the selected file';

    // 1. Validate before touching progress so a rejection shows no progress bar.
    const result = validateFile(file);
    if (!result.ok) {
      messages.showError(namedValidationMessage(result.reason, fileName));
      return { ok: false, slot, reason: result.reason };
    }

    // Detect PDF type before choosing decode path.
    const isPdf = file.type === 'application/pdf';

    if (isPdf) {
      // PDF path: read as ArrayBuffer, render first page, then commit.
      // 2. Begin progress (Req 9.5).
      progress.begin();

      // 3a. Read file as ArrayBuffer.
      let arrayBuffer;
      try {
        arrayBuffer = await readFileAsArrayBuffer(file);
      } catch (_err) {
        progress.fail(`The PDF "${fileName}" could not be loaded.`);
        return { ok: false, slot, reason: 'decode' };
      }

      // Midpoint feedback: file read succeeded, PDF processing starts (Req 4.2).
      progress.set(50);

      // 3b. Render first page via pdfRenderer.
      const renderResult = await renderFirstPage(arrayBuffer);

      if (!renderResult.ok) {
        // Route specific error reason to messages via progress.fail(msg),
        // which internally calls showError(msg) → ARIA live region, then hides
        // the progress bar within 1000 ms (Req 5.1, 5.2, 5.3, 5.5).
        let errorMsg;
        if (renderResult.reason === 'load') {
          errorMsg = `The PDF "${fileName}" could not be loaded. The file may be corrupted or encrypted.`;
        } else if (renderResult.reason === 'no-pages') {
          errorMsg = `The PDF "${fileName}" has no renderable pages.`;
        } else {
          errorMsg = `The PDF page in "${fileName}" could not be rendered.`;
        }
        progress.fail(errorMsg);
        return { ok: false, slot, reason: renderResult.reason };
      }

      // 3c. Create Image element from data URL and wait for onload.
      let pdfImage;
      try {
        pdfImage = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('decode-failed'));
          img.src = renderResult.dataUrl;
        });
      } catch (_err) {
        progress.fail(`The PDF page in "${fileName}" could not be rendered.`);
        return { ok: false, slot, reason: 'render' };
      }

      // 4. Commit + render identically to the image path.
      appState.setSource(slot, {
        image: pdfImage,
        naturalWidth: renderResult.naturalWidth,
        naturalHeight: renderResult.naturalHeight,
      });
      renderPreview(cfg, renderResult.dataUrl);
      renderThumbnail(cfg, renderResult.dataUrl);
      clearCropInfo(cfg);
      messages.clearMessage();
      progress.complete();

      return {
        ok: true,
        slot,
        naturalWidth: renderResult.naturalWidth,
        naturalHeight: renderResult.naturalHeight,
      };
    }

    // Image path (unchanged): decode via FileReader → Image.
    // 2. Begin progress (Req 9.5).
    progress.begin();

    // 3. Decode.
    let decoded;
    try {
      decoded = await decodeFile(file);
    } catch (_err) {
      // Decode failure: named message + hide progress within 1 s; slot retained.
      progress.fail(`The image "${fileName}" could not be loaded.`);
      return { ok: false, slot, reason: 'decode' };
    }

    // 4. Commit + render identically for both entry paths.
    appState.setSource(slot, {
      image: decoded.image,
      naturalWidth: decoded.naturalWidth,
      naturalHeight: decoded.naturalHeight,
    });
    renderPreview(cfg, decoded.src);
    renderThumbnail(cfg, decoded.src);
    clearCropInfo(cfg);
    messages.clearMessage();
    progress.complete();

    return {
      ok: true,
      slot,
      naturalWidth: decoded.naturalWidth,
      naturalHeight: decoded.naturalHeight,
    };
  }

  /** Extract the first File from an input/drop, or null. */
  function firstFile(fileList) {
    return fileList && fileList.length > 0 ? fileList[0] : null;
  }

  /**
   * Run a load and route any unexpected exception to the message/progress
   * channels so the upload workflow completes with zero uncaught errors
   * (Req 12.6). loadSourceImage already handles validation/decode failures
   * internally; this guard only covers truly unexpected throws.
   */
  function safeLoad(file, slot) {
    if (!file) return;
    Promise.resolve()
      .then(() => loadSourceImage(file, slot))
      .catch((err) => {
        try {
          messages.showError(
            `The image could not be loaded. ${err && err.message ? err.message : ''}`.trim()
          );
          progress.fail();
        } catch (_ignored) {
          /* never let the failure handler throw */
        }
      });
  }

  function wireSlot(cfg) {
    const input = byId(cfg.fileInput);
    const dropzone = byId(cfg.dropzone);

    // Set accept attribute to include PDF alongside image types (Req 2.1, 2.2).
    if (input) {
      input.setAttribute('accept', 'image/jpeg,image/png,image/webp,image/gif,application/pdf');
    }

    // Click selection path.
    on(input, 'change', (event) => {
      const target = event && event.target ? event.target : input;
      safeLoad(firstFile(target && target.files), cfg.slot);
    });

    // Drag highlight: visually distinct while a file is over the card (Req 2.4).
    on(dropzone, 'dragenter', (event) => {
      event.preventDefault();
      if (dropzone && dropzone.classList) dropzone.classList.add(DRAG_OVER_CLASS);
    });
    on(dropzone, 'dragover', (event) => {
      // preventDefault is required for the drop event to fire.
      event.preventDefault();
      if (dropzone && dropzone.classList) dropzone.classList.add(DRAG_OVER_CLASS);
    });
    on(dropzone, 'dragleave', () => {
      if (dropzone && dropzone.classList) dropzone.classList.remove(DRAG_OVER_CLASS);
    });

    // Drop path — funnels through the SAME loadSourceImage as click (D2 fix).
    on(dropzone, 'drop', (event) => {
      event.preventDefault();
      if (dropzone && dropzone.classList) dropzone.classList.remove(DRAG_OVER_CLASS);
      const dt = event && event.dataTransfer;
      safeLoad(firstFile(dt && dt.files), cfg.slot);
    });
  }

  function init() {
    wireSlot(SLOT_CONFIG.front);
    wireSlot(SLOT_CONFIG.back);
  }

  function destroy() {
    while (teardown.length > 0) {
      const off = teardown.pop();
      try {
        off();
      } catch (_err) {
        /* ignore detach errors */
      }
    }
  }

  return {
    init,
    destroy,
    loadSourceImage,
    SLOT_CONFIG,
  };
}

export default createUploadController;
