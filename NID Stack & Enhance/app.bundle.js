(() => {
  // src/core/appState.js
  var DEFAULT_SPACING = 10;
  var DEFAULT_BACKGROUND_COLOR = "#ffffff";
  var DEFAULT_BRIGHTNESS = 100;
  var DEFAULT_CONTRAST = 100;
  var DEFAULT_SATURATION = 100;
  var DEFAULT_SHARPNESS = 0;
  var DEFAULT_FILTER = "none";
  var FILTER_NAMES = Object.freeze(["none", "lighten", "document", "grayscale"]);
  var SLOTS = Object.freeze(["front", "back"]);
  function createSourceSlot() {
    return {
      image: null,
      naturalWidth: 0,
      naturalHeight: 0,
      crop: null
    };
  }
  function createDefaultState() {
    return {
      sources: {
        front: createSourceSlot(),
        back: createSourceSlot()
      },
      settings: {
        spacing: DEFAULT_SPACING,
        backgroundColor: DEFAULT_BACKGROUND_COLOR
      },
      adjustments: {
        brightness: DEFAULT_BRIGHTNESS,
        contrast: DEFAULT_CONTRAST,
        saturation: DEFAULT_SATURATION,
        sharpness: DEFAULT_SHARPNESS
      },
      filter: DEFAULT_FILTER,
      combinedImage: null,
      adjustedBase: null,
      adjustedImage: null,
      ui: {
        exportCombinedVisible: false,
        exportAdjustedVisible: false,
        progressVisible: false,
        progressValue: null
        // null => no partial value displayed
      }
    };
  }
  function isPlainObject(value) {
    if (value === null || typeof value !== "object") return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }
  function cloneState(value) {
    if (Array.isArray(value)) {
      return value.map((item) => cloneState(item));
    }
    if (isPlainObject(value)) {
      const out = {};
      for (const key of Object.keys(value)) {
        out[key] = cloneState(value[key]);
      }
      return out;
    }
    return value;
  }
  function runOperation(state, operation) {
    const prior = state;
    let result;
    try {
      result = operation(cloneState(prior));
    } catch (err) {
      return {
        ok: false,
        state: prior,
        error: { ok: false, message: err && err.message ? err.message : String(err) }
      };
    }
    if (result && result.ok === false) {
      return { ok: false, state: prior, error: result };
    }
    const next = result && typeof result === "object" && "state" in result && result.state ? result.state : result && result.ok === true ? prior : result;
    return { ok: true, state: next || prior, error: null };
  }
  function assertSlot(slot) {
    if (!SLOTS.includes(slot)) {
      throw new Error(`Unknown source slot: ${String(slot)}`);
    }
  }
  function createAppState(initialState) {
    let state = initialState ? cloneState(initialState) : createDefaultState();
    const store = {
      /** @returns {AppState} the current state. */
      getState() {
        return state;
      },
      /**
       * Replace the entire state (deep-cloned).
       * @param {AppState} next
       * @returns {AppState}
       */
      setState(next) {
        state = cloneState(next);
        return state;
      },
      /**
       * Reset to the documented default state (Requirements 8.1–8.5).
       * Discards all sources, crops, combined/adjusted buffers; restores
       * default settings/adjustments/filter; hides export controls; resets
       * the progress indicator to hidden with no partial value.
       * @returns {AppState}
       */
      reset() {
        state = createDefaultState();
        return state;
      },
      // --- Source mutations -------------------------------------------------
      /**
       * Set a source slot's image and dimensions, clearing that slot's crop
       * (a freshly loaded image starts with no stored crop region).
       * @param {('front'|'back')} slot
       * @param {{image: any, naturalWidth: number, naturalHeight: number}} data
       * @returns {AppState}
       */
      setSource(slot, data) {
        assertSlot(slot);
        state.sources[slot] = {
          image: data ? data.image : null,
          naturalWidth: data ? data.naturalWidth || 0 : 0,
          naturalHeight: data ? data.naturalHeight || 0 : 0,
          crop: null
        };
        return state;
      },
      /**
       * Clear a single source slot back to empty.
       * @param {('front'|'back')} slot
       * @returns {AppState}
       */
      clearSource(slot) {
        assertSlot(slot);
        state.sources[slot] = createSourceSlot();
        return state;
      },
      /**
       * Store a crop region (original image pixel coordinates) for a slot.
       * @param {('front'|'back')} slot
       * @param {{x:number,y:number,w:number,h:number}|null} crop
       * @returns {AppState}
       */
      setCrop(slot, crop) {
        assertSlot(slot);
        state.sources[slot].crop = crop ? { ...crop } : null;
        return state;
      },
      // --- Combine settings -------------------------------------------------
      /**
       * Set the accepted spacing value (validation happens elsewhere).
       * @param {number} value
       * @returns {AppState}
       */
      setSpacing(value) {
        state.settings.spacing = value;
        return state;
      },
      /**
       * Set the background color.
       * @param {string} color
       * @returns {AppState}
       */
      setBackgroundColor(color) {
        state.settings.backgroundColor = color;
        return state;
      },
      // --- Adjustments ------------------------------------------------------
      /**
       * Set a single adjustment value (clamping happens elsewhere).
       * @param {('brightness'|'contrast'|'saturation'|'sharpness')} key
       * @param {number} value
       * @returns {AppState}
       */
      setAdjustment(key, value) {
        if (!(key in state.adjustments)) {
          throw new Error(`Unknown adjustment: ${String(key)}`);
        }
        state.adjustments[key] = value;
        return state;
      },
      // --- Filter -----------------------------------------------------------
      /**
       * Set the selected filter.
       * @param {('none'|'lighten'|'document'|'grayscale')} name
       * @returns {AppState}
       */
      setFilter(name) {
        if (!FILTER_NAMES.includes(name)) {
          throw new Error(`Unknown filter: ${String(name)}`);
        }
        state.filter = name;
        return state;
      },
      // --- Derived buffers --------------------------------------------------
      /**
       * Set the combined-image buffer (or null to clear).
       * @param {any} image
       * @returns {AppState}
       */
      setCombinedImage(image) {
        state.combinedImage = image || null;
        return state;
      },
      /**
       * Set the unfiltered adjusted-base buffer (or null to clear).
       * @param {any} image
       * @returns {AppState}
       */
      setAdjustedBase(image) {
        state.adjustedBase = image || null;
        return state;
      },
      /**
       * Set the adjusted (+ current filter) image buffer (or null to clear).
       * @param {any} image
       * @returns {AppState}
       */
      setAdjustedImage(image) {
        state.adjustedImage = image || null;
        return state;
      },
      // --- UI flags ---------------------------------------------------------
      /**
       * Set visibility of the Combined-image PDF export control.
       * @param {boolean} visible
       * @returns {AppState}
       */
      setExportCombinedVisible(visible) {
        state.ui.exportCombinedVisible = Boolean(visible);
        return state;
      },
      /**
       * Set visibility of the Adjusted-image PDF export control.
       * @param {boolean} visible
       * @returns {AppState}
       */
      setExportAdjustedVisible(visible) {
        state.ui.exportAdjustedVisible = Boolean(visible);
        return state;
      },
      /**
       * Set the progress-indicator visibility and value.
       * @param {boolean} visible
       * @param {(number|null)} [value] partial progress (null => no value)
       * @returns {AppState}
       */
      setProgress(visible, value = null) {
        state.ui.progressVisible = Boolean(visible);
        state.ui.progressValue = visible ? value : null;
        return state;
      },
      // --- Operation wrapper ------------------------------------------------
      /**
       * Run an operation against the current state, committing its result on
       * success and leaving the current state unchanged on a reported error
       * (Requirement 12.5).
       *
       * @param {(draft: AppState) => OperationSuccess|OperationFailure|AppState} operation
       * @returns {{ok: boolean, state: AppState, error: (OperationFailure|null)}}
       */
      runOperation(operation) {
        const result = runOperation(state, operation);
        state = result.state;
        return result;
      }
    };
    return store;
  }

  // src/controllers/messages.js
  var DEFAULT_MIN_VISIBLE_MS = 3e3;
  var VISIBLE_CLASS = "is-visible";
  function createMessageController(liveRegionEl) {
    if (!liveRegionEl) {
      throw new Error("createMessageController requires a live region element");
    }
    let clearTimerId = null;
    let minVisibleUntil = 0;
    function nowMs() {
      return Date.now();
    }
    function cancelPendingClear() {
      if (clearTimerId !== null) {
        clearTimeout(clearTimerId);
        clearTimerId = null;
      }
    }
    function render(text, role, ariaLive, type) {
      cancelPendingClear();
      liveRegionEl.textContent = text;
      liveRegionEl.setAttribute("role", role);
      liveRegionEl.setAttribute("aria-live", ariaLive);
      liveRegionEl.setAttribute("data-message-type", type);
      liveRegionEl.classList.add(VISIBLE_CLASS);
      liveRegionEl.hidden = false;
    }
    function doClear() {
      liveRegionEl.textContent = "";
      liveRegionEl.classList.remove(VISIBLE_CLASS);
      liveRegionEl.hidden = true;
      liveRegionEl.removeAttribute("data-message-type");
    }
    function showGuidance2(text, options = {}) {
      const requested = options && options.minVisibleMs;
      const minVisibleMs = typeof requested === "number" && Number.isFinite(requested) && requested >= 0 ? requested : DEFAULT_MIN_VISIBLE_MS;
      render(toText(text), "status", "polite", "guidance");
      minVisibleUntil = nowMs() + minVisibleMs;
    }
    function showSuccess(text, options = {}) {
      const requested = options && options.minVisibleMs;
      const minVisibleMs = typeof requested === "number" && Number.isFinite(requested) && requested >= 0 ? requested : DEFAULT_MIN_VISIBLE_MS;
      render(toText(text), "status", "polite", "success");
      minVisibleUntil = nowMs() + minVisibleMs;
    }
    function showError2(text) {
      minVisibleUntil = 0;
      render(toText(text), "alert", "assertive", "error");
    }
    function clearMessage() {
      const remaining = minVisibleUntil - nowMs();
      if (remaining > 0) {
        cancelPendingClear();
        clearTimerId = setTimeout(() => {
          clearTimerId = null;
          minVisibleUntil = 0;
          doClear();
        }, remaining);
        return;
      }
      cancelPendingClear();
      minVisibleUntil = 0;
      doClear();
    }
    return {
      showGuidance: showGuidance2,
      showSuccess,
      showError: showError2,
      clearMessage,
      get element() {
        return liveRegionEl;
      }
    };
  }
  function toText(value) {
    return value === null || value === void 0 ? "" : String(value);
  }
  var defaultController = null;
  function ensureController() {
    if (!defaultController) {
      throw new Error("Message controller not initialized; call initMessages(element) first");
    }
    return defaultController;
  }
  function showGuidance(text, options) {
    return ensureController().showGuidance(text, options);
  }
  function showError(text) {
    return ensureController().showError(text);
  }

  // src/controllers/progress.js
  var HIDE_CEILING_MS = 1e3;
  var DEFAULT_HIDE_DELAY_MS = 600;
  var DEFAULT_FAIL_MESSAGE = "The operation did not complete.";
  function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }
  function createProgress(options = {}) {
    const {
      container = null,
      bar = null,
      label = null,
      hideDelayMs = DEFAULT_HIDE_DELAY_MS,
      showError: showError2 = () => {
      },
      setTimeoutFn,
      clearTimeoutFn
    } = options;
    const schedule = typeof setTimeoutFn === "function" ? setTimeoutFn : typeof setTimeout === "function" ? setTimeout : null;
    const cancel = typeof clearTimeoutFn === "function" ? clearTimeoutFn : typeof clearTimeout === "function" ? clearTimeout : null;
    const resolvedHideDelay = clamp(hideDelayMs, 1, HIDE_CEILING_MS);
    const visibilityEl = container || bar || null;
    let value = 0;
    let visible = false;
    let hideTimer = null;
    function cancelPendingHide() {
      if (hideTimer !== null && cancel) {
        cancel(hideTimer);
      }
      hideTimer = null;
    }
    function renderValue() {
      const pct = Math.round(value);
      if (bar) {
        bar.style.width = `${pct}%`;
        bar.setAttribute("aria-valuenow", String(pct));
        bar.setAttribute("aria-valuemin", "0");
        bar.setAttribute("aria-valuemax", "100");
      }
      if (visibilityEl && visibilityEl !== bar) {
        visibilityEl.setAttribute("aria-valuenow", String(pct));
      }
      if (label) {
        label.textContent = `${pct}%`;
      }
    }
    function renderVisibility() {
      if (!visibilityEl) return;
      if (visible) {
        visibilityEl.hidden = false;
        visibilityEl.removeAttribute("aria-hidden");
        visibilityEl.classList.add("is-visible");
      } else {
        visibilityEl.hidden = true;
        visibilityEl.setAttribute("aria-hidden", "true");
        visibilityEl.classList.remove("is-visible");
      }
    }
    function begin() {
      cancelPendingHide();
      value = 0;
      visible = true;
      renderVisibility();
      renderValue();
    }
    function set(p) {
      const requested = clamp(p, 0, 100);
      value = Math.max(value, requested);
      renderValue();
      return value;
    }
    function complete() {
      cancelPendingHide();
      value = 100;
      visible = true;
      renderVisibility();
      renderValue();
      scheduleHide();
    }
    function fail(message) {
      cancelPendingHide();
      const text = typeof message === "string" && message.length > 0 ? message : DEFAULT_FAIL_MESSAGE;
      try {
        showError2(text);
      } catch (_err) {
      }
      scheduleHide();
    }
    function scheduleHide() {
      if (!schedule) {
        hide();
        return;
      }
      hideTimer = schedule(() => {
        hideTimer = null;
        hide();
      }, resolvedHideDelay);
    }
    function hide() {
      visible = false;
      value = 0;
      renderVisibility();
      renderValue();
    }
    function reset() {
      cancelPendingHide();
      hide();
    }
    reset();
    return {
      begin,
      set,
      complete,
      fail,
      reset,
      getValue: () => value,
      isVisible: () => visible
    };
  }

  // src/core/validation.js
  var SUPPORTED_TYPES = Object.freeze([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf"
  ]);
  var MAX_FILE_BYTES = 10 * 1024 * 1024;
  var SPACING_MIN = 0;
  var SPACING_MAX = 500;
  var ADJUSTMENT_RANGES = Object.freeze({
    brightness: Object.freeze({ min: 0, max: 200, default: 100 }),
    contrast: Object.freeze({ min: 0, max: 200, default: 100 }),
    saturation: Object.freeze({ min: 0, max: 200, default: 100 }),
    sharpness: Object.freeze({ min: 0, max: 100, default: 0 })
  });
  function validateFile(file) {
    const type = file && typeof file.type === "string" ? file.type : "";
    const size = file && typeof file.size === "number" ? file.size : 0;
    if (!SUPPORTED_TYPES.includes(type)) {
      return {
        ok: false,
        reason: "type",
        message: "File is not a supported format. Supported formats are JPEG, PNG, WebP, GIF, and PDF."
      };
    }
    if (size > MAX_FILE_BYTES) {
      return {
        ok: false,
        reason: "size",
        message: "File exceeds the maximum allowed size of 10 MB."
      };
    }
    return { ok: true };
  }
  function validateSpacing(value, previous) {
    const num = typeof value === "number" ? value : Number(value);
    const rangeMessage = `Spacing must be a whole number between ${SPACING_MIN} and ${SPACING_MAX} pixels.`;
    if (!Number.isFinite(num) || !Number.isInteger(num) || num < SPACING_MIN || num > SPACING_MAX) {
      return { ok: false, value: previous, message: rangeMessage };
    }
    return { ok: true, value: num };
  }

  // src/core/pdfRenderer.js
  async function renderFirstPage(arrayBuffer, options = {}) {
    const {
      minScale = 2,
      maxDimension = 4096,
      getDocument = window.pdfjsLib.getDocument
    } = options;
    if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
      if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "libs/pdf.worker.min.js";
      }
    }
    let pdfDocument;
    try {
      pdfDocument = await getDocument({ data: arrayBuffer }).promise;
    } catch (err) {
      return {
        ok: false,
        reason: "load",
        message: "The PDF could not be loaded. The file may be corrupted or encrypted."
      };
    }
    if (pdfDocument.numPages === 0) {
      return {
        ok: false,
        reason: "no-pages",
        message: "The PDF has no renderable pages."
      };
    }
    try {
      const page = await pdfDocument.getPage(1);
      const defaultViewport = page.getViewport({ scale: 1 });
      const effectiveScale = Math.max(minScale, defaultViewport.scale);
      const scaledViewport = page.getViewport({ scale: effectiveScale });
      let canvasWidth = scaledViewport.width;
      let canvasHeight = scaledViewport.height;
      if (canvasWidth > maxDimension || canvasHeight > maxDimension) {
        const downscaleFactor = maxDimension / Math.max(canvasWidth, canvasHeight);
        canvasWidth = canvasWidth * downscaleFactor;
        canvasHeight = canvasHeight * downscaleFactor;
      }
      canvasWidth = Math.max(1, Math.round(canvasWidth));
      canvasHeight = Math.max(1, Math.round(canvasHeight));
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const canvasContext = canvas.getContext("2d");
      const finalScale = effectiveScale * (canvasWidth / scaledViewport.width);
      const finalViewport = page.getViewport({ scale: finalScale });
      await page.render({ canvasContext, viewport: finalViewport }).promise;
      const dataUrl = canvas.toDataURL("image/png");
      return {
        ok: true,
        dataUrl,
        naturalWidth: canvasWidth,
        naturalHeight: canvasHeight
      };
    } catch (err) {
      return {
        ok: false,
        reason: "render",
        message: "The PDF page could not be rendered."
      };
    }
  }

  // src/controllers/uploadController.js
  var DRAG_OVER_CLASS = "is-dragover";
  var HIDDEN_CLASS = "hidden";
  var SLOT_CONFIG = Object.freeze({
    front: Object.freeze({
      slot: "front",
      fileInput: "file1",
      dropzone: "drop1",
      previewImg: "preview1",
      previewContainer: "preview1-container",
      thumb: "thumb1",
      thumbPlaceholder: "thumb1Placeholder",
      cropInfo: "cropInfo1"
    }),
    back: Object.freeze({
      slot: "back",
      fileInput: "file2",
      dropzone: "drop2",
      previewImg: "preview2",
      previewContainer: "preview2-container",
      thumb: "thumb2",
      thumbPlaceholder: "thumb2Placeholder",
      cropInfo: "cropInfo2"
    })
  });
  var NOOP_PROGRESS = Object.freeze({
    begin() {
    },
    set() {
    },
    complete() {
    },
    fail() {
    },
    reset() {
    }
  });
  var NOOP_MESSAGES = Object.freeze({
    showError() {
    },
    showGuidance() {
    },
    clearMessage() {
    }
  });
  function defaultDecodeFile(file) {
    return new Promise((resolve, reject) => {
      if (typeof FileReader === "undefined" || typeof Image === "undefined") {
        reject(new Error("No image decoding available in this environment"));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("read-failed"));
      reader.onload = (event) => {
        const src = event && event.target ? event.target.result : null;
        if (typeof src !== "string") {
          reject(new Error("read-empty"));
          return;
        }
        const img = new Image();
        img.onload = () => resolve({
          image: img,
          src,
          naturalWidth: img.naturalWidth || img.width || 0,
          naturalHeight: img.naturalHeight || img.height || 0
        });
        img.onerror = () => reject(new Error("decode-failed"));
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
  }
  function namedValidationMessage(reason, fileName) {
    if (reason === "size") {
      return `The file "${fileName}" exceeds the maximum allowed size of 10 MB.`;
    }
    return `The file "${fileName}" is not a supported image format. Supported formats are JPEG, PNG, WebP, GIF, and PDF.`;
  }
  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error("read-failed"));
      reader.readAsArrayBuffer(file);
    });
  }
  function createUploadController(deps = {}) {
    const {
      appState,
      messages = NOOP_MESSAGES,
      progress = NOOP_PROGRESS,
      document: providedDoc,
      decodeFile = defaultDecodeFile
    } = deps;
    if (!appState || typeof appState.setSource !== "function") {
      throw new Error("createUploadController requires an appState store");
    }
    const doc = providedDoc || (typeof document !== "undefined" ? document : void 0);
    if (!doc || typeof doc.getElementById !== "function") {
      throw new Error("createUploadController requires a document");
    }
    const teardown = [];
    function byId(id) {
      return doc.getElementById(id);
    }
    function on(el, type, handler, options) {
      if (!el || typeof el.addEventListener !== "function") return;
      el.addEventListener(type, handler, options);
      teardown.push(() => el.removeEventListener(type, handler, options));
    }
    function show(el) {
      if (el && el.classList) el.classList.remove(HIDDEN_CLASS);
    }
    function hide(el) {
      if (el && el.classList) el.classList.add(HIDDEN_CLASS);
    }
    function renderPreview(cfg, src) {
      const img = byId(cfg.previewImg);
      if (img) img.src = src;
      show(byId(cfg.previewContainer));
    }
    function renderThumbnail(cfg, src) {
      const thumb = byId(cfg.thumb);
      if (thumb) {
        thumb.src = src;
        show(thumb);
      }
      hide(byId(cfg.thumbPlaceholder));
    }
    function clearCropInfo(cfg) {
      const info = byId(cfg.cropInfo);
      if (info) info.textContent = "";
    }
    async function loadSourceImage(file, slot) {
      const cfg = SLOT_CONFIG[slot];
      if (!cfg) {
        throw new Error(`Unknown upload slot: ${String(slot)}`);
      }
      const fileName = file && typeof file.name === "string" && file.name ? file.name : "the selected file";
      const result = validateFile(file);
      if (!result.ok) {
        messages.showError(namedValidationMessage(result.reason, fileName));
        return { ok: false, slot, reason: result.reason };
      }
      const isPdf = file.type === "application/pdf";
      if (isPdf) {
        progress.begin();
        let arrayBuffer;
        try {
          arrayBuffer = await readFileAsArrayBuffer(file);
        } catch (_err) {
          progress.fail(`The PDF "${fileName}" could not be loaded.`);
          return { ok: false, slot, reason: "decode" };
        }
        progress.set(50);
        const renderResult = await renderFirstPage(arrayBuffer);
        if (!renderResult.ok) {
          let errorMsg;
          if (renderResult.reason === "load") {
            errorMsg = `The PDF "${fileName}" could not be loaded. The file may be corrupted or encrypted.`;
          } else if (renderResult.reason === "no-pages") {
            errorMsg = `The PDF "${fileName}" has no renderable pages.`;
          } else {
            errorMsg = `The PDF page in "${fileName}" could not be rendered.`;
          }
          progress.fail(errorMsg);
          return { ok: false, slot, reason: renderResult.reason };
        }
        let pdfImage;
        try {
          pdfImage = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("decode-failed"));
            img.src = renderResult.dataUrl;
          });
        } catch (_err) {
          progress.fail(`The PDF page in "${fileName}" could not be rendered.`);
          return { ok: false, slot, reason: "render" };
        }
        appState.setSource(slot, {
          image: pdfImage,
          naturalWidth: renderResult.naturalWidth,
          naturalHeight: renderResult.naturalHeight
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
          naturalHeight: renderResult.naturalHeight
        };
      }
      progress.begin();
      let decoded;
      try {
        decoded = await decodeFile(file);
      } catch (_err) {
        progress.fail(`The image "${fileName}" could not be loaded.`);
        return { ok: false, slot, reason: "decode" };
      }
      appState.setSource(slot, {
        image: decoded.image,
        naturalWidth: decoded.naturalWidth,
        naturalHeight: decoded.naturalHeight
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
        naturalHeight: decoded.naturalHeight
      };
    }
    function firstFile(fileList) {
      return fileList && fileList.length > 0 ? fileList[0] : null;
    }
    function safeLoad(file, slot) {
      if (!file) return;
      Promise.resolve().then(() => loadSourceImage(file, slot)).catch((err) => {
        try {
          messages.showError(
            `The image could not be loaded. ${err && err.message ? err.message : ""}`.trim()
          );
          progress.fail();
        } catch (_ignored) {
        }
      });
    }
    function wireSlot(cfg) {
      const input = byId(cfg.fileInput);
      const dropzone = byId(cfg.dropzone);
      if (input) {
        input.setAttribute("accept", "image/jpeg,image/png,image/webp,image/gif,application/pdf");
      }
      on(input, "change", (event) => {
        const target = event && event.target ? event.target : input;
        safeLoad(firstFile(target && target.files), cfg.slot);
      });
      on(dropzone, "dragenter", (event) => {
        event.preventDefault();
        if (dropzone && dropzone.classList) dropzone.classList.add(DRAG_OVER_CLASS);
      });
      on(dropzone, "dragover", (event) => {
        event.preventDefault();
        if (dropzone && dropzone.classList) dropzone.classList.add(DRAG_OVER_CLASS);
      });
      on(dropzone, "dragleave", () => {
        if (dropzone && dropzone.classList) dropzone.classList.remove(DRAG_OVER_CLASS);
      });
      on(dropzone, "drop", (event) => {
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
        }
      }
    }
    return {
      init,
      destroy,
      loadSourceImage,
      SLOT_CONFIG
    };
  }

  // src/core/cropGeometry.js
  function toFinite(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function toInt(value, fallback = 0) {
    return Math.round(toFinite(value, fallback));
  }
  function clamp2(value, lo, hi) {
    const v = toFinite(value, lo);
    if (hi < lo) return lo;
    return Math.min(Math.max(v, lo), hi);
  }
  function normalizeRegion(region) {
    const r = region || {};
    return {
      x: toInt(r.x, 0),
      y: toInt(r.y, 0),
      w: Math.max(0, toInt(r.w, 0)),
      h: Math.max(0, toInt(r.h, 0))
    };
  }
  function normalizeBounds(imgBounds) {
    const b = imgBounds || {};
    const width = b.width != null ? b.width : b.w;
    const height = b.height != null ? b.height : b.h;
    return {
      width: Math.max(0, toInt(width, 0)),
      height: Math.max(0, toInt(height, 0))
    };
  }
  function initialRegion(imgW, imgH) {
    return {
      x: 0,
      y: 0,
      w: Math.max(0, toInt(imgW, 0)),
      h: Math.max(0, toInt(imgH, 0))
    };
  }
  function initialQuadCorners(imgW, imgH) {
    const w = Math.max(0, toInt(imgW, 0));
    const h = Math.max(0, toInt(imgH, 0));
    return [
      { x: 0, y: 0 },
      // TL
      { x: w, y: 0 },
      // TR
      { x: w, y: h },
      // BR
      { x: 0, y: h }
      // BL
    ];
  }
  function regionToQuadCorners(region) {
    const r = normalizeRegion(region);
    return [
      { x: r.x, y: r.y },
      // TL
      { x: r.x + r.w, y: r.y },
      // TR
      { x: r.x + r.w, y: r.y + r.h },
      // BR
      { x: r.x, y: r.y + r.h }
      // BL
    ];
  }
  function moveQuadCorner(corners, cornerIndex, pointer, imgBounds) {
    const b = normalizeBounds(imgBounds);
    const idx = (Math.trunc(toFinite(cornerIndex, 0)) % 4 + 4) % 4;
    const px = clamp2(toFinite(pointer && pointer.x, 0), 0, b.width);
    const py = clamp2(toFinite(pointer && pointer.y, 0), 0, b.height);
    const result = (corners || initialQuadCorners(b.width, b.height)).map(
      (c, i) => i === idx ? { x: Math.round(px), y: Math.round(py) } : { ...c }
    );
    return result;
  }
  function moveQuad(corners, delta, imgBounds) {
    const b = normalizeBounds(imgBounds);
    const d = delta || {};
    const dx = toInt(d.dx != null ? d.dx : d.x, 0);
    const dy = toInt(d.dy != null ? d.dy : d.y, 0);
    const pts = corners || initialQuadCorners(b.width, b.height);
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxY = Math.max(...pts.map((p) => p.y));
    const clampedDx = clamp2(dx, -minX, b.width - maxX);
    const clampedDy = clamp2(dy, -minY, b.height - maxY);
    return pts.map((p) => ({
      x: Math.round(p.x + clampedDx),
      y: Math.round(p.y + clampedDy)
    }));
  }
  function quadBoundingBox(corners) {
    if (!corners || corners.length < 4) return { x: 0, y: 0, w: 0, h: 0 };
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      x: Math.round(minX),
      y: Math.round(minY),
      w: Math.round(maxX - minX),
      h: Math.round(maxY - minY)
    };
  }
  function displayToOriginal(point, scale) {
    const s = safeScale(scale);
    const p = point || {};
    return {
      x: toFinite(p.x, 0) / s,
      y: toFinite(p.y, 0) / s
    };
  }
  function safeScale(scale) {
    const s = toFinite(scale, 1);
    return s === 0 ? 1 : s;
  }
  function sizeCropCanvas(imgW, imgH, viewportW, viewportH) {
    const iw = toFinite(imgW, 0);
    const ih = toFinite(imgH, 0);
    const vw = toFinite(viewportW, 0);
    const vh = toFinite(viewportH, 0);
    if (iw <= 0 || ih <= 0 || vw <= 0 || vh <= 0) {
      return { canvasW: 0, canvasH: 0, scale: 0 };
    }
    const scale = Math.min(vw / iw, vh / ih);
    return {
      canvasW: iw * scale,
      canvasH: ih * scale,
      scale
    };
  }

  // src/controllers/cropController.js
  var HIDDEN_CLASS2 = "hidden";
  var HANDLE_RADIUS = 12;
  var NUDGE_PX = 1;
  var SHIFT_NUDGE_PX = 10;
  var CROP_BUTTONS = Object.freeze({
    front: "crop1",
    back: "crop2"
  });
  var CROP_INFO_IDS = Object.freeze({
    front: "cropInfo1",
    back: "cropInfo2"
  });
  function createCropController(deps = {}) {
    const { appState, document: providedDoc } = deps;
    if (!appState || typeof appState.getState !== "function") {
      throw new Error("createCropController requires an appState store");
    }
    const doc = providedDoc || (typeof document !== "undefined" ? document : void 0);
    if (!doc || typeof doc.getElementById !== "function") {
      throw new Error("createCropController requires a document");
    }
    const teardown = [];
    let activeSlot = null;
    let currentRegion = null;
    let quadCorners = null;
    let scale = 1;
    let cropImage = null;
    let openerElement = null;
    let activeCornerIdx = 0;
    let dragging = false;
    let dragType = null;
    let dragCornerIdx = -1;
    let dragStartOriginal = null;
    let dragStartCorners = null;
    function byId(id) {
      return doc.getElementById(id);
    }
    function on(el, type, handler, options) {
      if (!el || typeof el.addEventListener !== "function") return;
      el.addEventListener(type, handler, options);
      teardown.push(() => el.removeEventListener(type, handler, options));
    }
    function getModal() {
      return byId("cropModal");
    }
    function getCanvas() {
      return byId("cropCanvas");
    }
    function getModalContent() {
      const modal = getModal();
      return modal ? modal.querySelector('[role="dialog"]') : null;
    }
    function getFocusableElements() {
      const dialog = getModalContent();
      if (!dialog) return [];
      const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      return Array.from(dialog.querySelectorAll(selector)).filter(
        (el) => !el.disabled && el.offsetParent !== null
      );
    }
    function trapFocus(event) {
      try {
        const focusable = getFocusableElements();
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.key === "Tab") {
          if (event.shiftKey) {
            if (doc.activeElement === first) {
              event.preventDefault();
              last.focus();
            }
          } else {
            if (doc.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }
      } catch (_err) {
      }
    }
    function drawCropOverlay() {
      const canvas = getCanvas();
      if (!canvas || !cropImage || !quadCorners) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const cw = canvas.width;
      const ch = canvas.height;
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(cropImage, 0, 0, cw, ch);
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, cw, ch);
      const displayCorners = quadCorners.map((c) => ({
        x: c.x * scale,
        y: c.y * scale
      }));
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(displayCorners[0].x, displayCorners[0].y);
      ctx.lineTo(displayCorners[1].x, displayCorners[1].y);
      ctx.lineTo(displayCorners[2].x, displayCorners[2].y);
      ctx.lineTo(displayCorners[3].x, displayCorners[3].y);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(cropImage, 0, 0, cw, ch);
      ctx.restore();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(displayCorners[0].x, displayCorners[0].y);
      ctx.lineTo(displayCorners[1].x, displayCorners[1].y);
      ctx.lineTo(displayCorners[2].x, displayCorners[2].y);
      ctx.lineTo(displayCorners[3].x, displayCorners[3].y);
      ctx.closePath();
      ctx.stroke();
      displayCorners.forEach((corner, idx) => {
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, HANDLE_RADIUS / 2, 0, Math.PI * 2);
        ctx.fillStyle = idx === activeCornerIdx ? "#00bfff" : "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }
    function getCanvasPointer(event) {
      const canvas = getCanvas();
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    }
    function hitTestCorner(displayPoint) {
      if (!quadCorners) return -1;
      const displayCorners = quadCorners.map((c) => ({
        x: c.x * scale,
        y: c.y * scale
      }));
      for (let i = 0; i < displayCorners.length; i++) {
        const dx = displayPoint.x - displayCorners[i].x;
        const dy = displayPoint.y - displayCorners[i].y;
        if (Math.sqrt(dx * dx + dy * dy) <= HANDLE_RADIUS) {
          return i;
        }
      }
      return -1;
    }
    function isInsideRegion(displayPoint) {
      if (!quadCorners) return false;
      const displayCorners = quadCorners.map((c) => ({
        x: c.x * scale,
        y: c.y * scale
      }));
      const { x, y } = displayPoint;
      let inside = false;
      for (let i = 0, j = displayCorners.length - 1; i < displayCorners.length; j = i++) {
        const xi = displayCorners[i].x, yi = displayCorners[i].y;
        const xj = displayCorners[j].x, yj = displayCorners[j].y;
        if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    }
    function handlePointerDown(event) {
      try {
        const canvas = getCanvas();
        if (!canvas || !quadCorners) return;
        const displayPoint = getCanvasPointer(event);
        const cornerIdx = hitTestCorner(displayPoint);
        if (cornerIdx >= 0) {
          dragging = true;
          dragType = "corner";
          dragCornerIdx = cornerIdx;
          activeCornerIdx = cornerIdx;
          canvas.setPointerCapture(event.pointerId);
          event.preventDefault();
        } else if (isInsideRegion(displayPoint)) {
          dragging = true;
          dragType = "move";
          dragStartOriginal = displayToOriginal(displayPoint, scale);
          dragStartCorners = quadCorners.map((c) => ({ ...c }));
          canvas.setPointerCapture(event.pointerId);
          event.preventDefault();
        }
      } catch (_err) {
      }
    }
    function handlePointerMove(event) {
      try {
        if (!dragging || !quadCorners) return;
        const displayPoint = getCanvasPointer(event);
        const imgBounds = getImageBounds();
        if (dragType === "corner") {
          const originalPoint = displayToOriginal(displayPoint, scale);
          quadCorners = moveQuadCorner(
            quadCorners,
            dragCornerIdx,
            originalPoint,
            imgBounds
          );
        } else if (dragType === "move") {
          const originalPoint = displayToOriginal(displayPoint, scale);
          const dx = Math.round(originalPoint.x - dragStartOriginal.x);
          const dy = Math.round(originalPoint.y - dragStartOriginal.y);
          quadCorners = moveQuad(dragStartCorners, { dx, dy }, imgBounds);
        }
        currentRegion = quadBoundingBox(quadCorners);
        drawCropOverlay();
        event.preventDefault();
      } catch (_err) {
      }
    }
    function handlePointerUp(event) {
      try {
        if (!dragging) return;
        dragging = false;
        dragType = null;
        dragCornerIdx = -1;
        dragStartOriginal = null;
        dragStartCorners = null;
        const canvas = getCanvas();
        if (canvas) {
          try {
            canvas.releasePointerCapture(event.pointerId);
          } catch (_e) {
          }
        }
      } catch (_err) {
      }
    }
    function handleKeyDown(event) {
      try {
        const modal = getModal();
        if (!modal || modal.classList.contains(HIDDEN_CLASS2)) return;
        if (event.key === "Escape") {
          event.preventDefault();
          cancelCrop();
          return;
        }
        trapFocus(event);
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
          if (!quadCorners) return;
          event.preventDefault();
          const step = event.shiftKey ? SHIFT_NUDGE_PX : NUDGE_PX;
          const imgBounds = getImageBounds();
          const cornerPos = quadCorners[activeCornerIdx] || { x: 0, y: 0 };
          let targetX = cornerPos.x;
          let targetY = cornerPos.y;
          switch (event.key) {
            case "ArrowLeft":
              targetX -= step;
              break;
            case "ArrowRight":
              targetX += step;
              break;
            case "ArrowUp":
              targetY -= step;
              break;
            case "ArrowDown":
              targetY += step;
              break;
          }
          quadCorners = moveQuadCorner(
            quadCorners,
            activeCornerIdx,
            { x: targetX, y: targetY },
            imgBounds
          );
          currentRegion = quadBoundingBox(quadCorners);
          drawCropOverlay();
        }
      } catch (_err) {
      }
    }
    function getCornerPosition(cornerIdx) {
      if (!currentRegion) return { x: 0, y: 0 };
      const r = currentRegion;
      switch (cornerIdx) {
        case 0:
          return { x: r.x, y: r.y };
        // TL
        case 1:
          return { x: r.x + r.w, y: r.y };
        // TR
        case 2:
          return { x: r.x + r.w, y: r.y + r.h };
        // BR
        case 3:
          return { x: r.x, y: r.y + r.h };
        // BL
        default:
          return { x: r.x, y: r.y };
      }
    }
    function getImageBounds() {
      const state = appState.getState();
      if (!activeSlot || !state.sources[activeSlot]) {
        return { width: 0, height: 0 };
      }
      const src = state.sources[activeSlot];
      return { width: src.naturalWidth, height: src.naturalHeight };
    }
    function openCropModal(slot) {
      try {
        const state = appState.getState();
        const source = state.sources[slot];
        if (!source || !source.image) {
          showGuidance("No image is available to crop. Please upload an image first.");
          return;
        }
        activeSlot = slot;
        openerElement = byId(CROP_BUTTONS[slot]) || null;
        if (source.crop && source.crop.corners) {
          quadCorners = source.crop.corners.map((c) => ({ ...c }));
          currentRegion = quadBoundingBox(quadCorners);
        } else if (source.crop) {
          currentRegion = { ...source.crop };
          quadCorners = regionToQuadCorners(currentRegion);
        } else {
          currentRegion = initialRegion(source.naturalWidth, source.naturalHeight);
          quadCorners = initialQuadCorners(source.naturalWidth, source.naturalHeight);
        }
        const viewportW = doc.defaultView && doc.defaultView.innerWidth || 800;
        const viewportH = doc.defaultView && doc.defaultView.innerHeight || 600;
        const availW = Math.max(100, viewportW * 0.85);
        const availH = Math.max(100, viewportH * 0.7);
        const sizing = sizeCropCanvas(
          source.naturalWidth,
          source.naturalHeight,
          availW,
          availH
        );
        scale = sizing.scale || 1;
        const canvas = getCanvas();
        if (canvas) {
          canvas.width = Math.round(sizing.canvasW);
          canvas.height = Math.round(sizing.canvasH);
        }
        cropImage = source.image;
        const modal = getModal();
        if (modal) {
          modal.classList.remove(HIDDEN_CLASS2);
          modal.setAttribute("aria-hidden", "false");
        }
        activeCornerIdx = 0;
        drawCropOverlay();
        moveFocusIntoDialog();
      } catch (_err) {
      }
    }
    function moveFocusIntoDialog() {
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        const dialog = getModalContent();
        if (dialog) {
          dialog.setAttribute("tabindex", "-1");
          dialog.focus();
        }
      }
    }
    function closeModal() {
      const modal = getModal();
      if (modal) {
        modal.classList.add(HIDDEN_CLASS2);
        modal.setAttribute("aria-hidden", "true");
      }
      dragging = false;
      dragType = null;
      cropImage = null;
      quadCorners = null;
      returnFocus();
      activeSlot = null;
      currentRegion = null;
    }
    function returnFocus() {
      try {
        if (openerElement && doc.body.contains(openerElement) && typeof openerElement.focus === "function") {
          openerElement.focus();
          return;
        }
        if (openerElement) {
          let parent = openerElement.parentElement;
          while (parent && !doc.body.contains(parent)) {
            parent = parent.parentElement;
          }
          if (parent && typeof parent.focus === "function") {
            parent.setAttribute("tabindex", "-1");
            parent.focus();
            return;
          }
        }
        if (doc.body && typeof doc.body.focus === "function") {
          doc.body.focus();
        }
      } catch (_err) {
      }
    }
    function applyCrop() {
      try {
        if (!activeSlot || !quadCorners || !cropImage) {
          closeModal();
          return;
        }
        const croppedResult = perspectiveCrop(cropImage, quadCorners);
        if (croppedResult) {
          const img = croppedResult.image;
          const dataUrl = croppedResult.dataUrl;
          const outW = croppedResult.width;
          const outH = croppedResult.height;
          const slot = activeSlot;
          const commitCrop = () => {
            appState.setSource(slot, {
              image: img,
              naturalWidth: outW,
              naturalHeight: outH
            });
            updateSlotVisuals(slot, dataUrl);
            displayCropInfo(slot);
          };
          if (img.complete && img.naturalWidth > 0) {
            commitCrop();
          } else {
            img.onload = commitCrop;
            img.onerror = () => {
              const bbox = quadBoundingBox(quadCorners);
              appState.setCrop(slot, {
                x: bbox.x,
                y: bbox.y,
                w: bbox.w,
                h: bbox.h,
                corners: quadCorners.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y) }))
              });
              displayCropInfo(slot);
            };
          }
        } else {
          const bbox = quadBoundingBox(quadCorners);
          appState.setCrop(activeSlot, {
            x: bbox.x,
            y: bbox.y,
            w: bbox.w,
            h: bbox.h,
            corners: quadCorners.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y) }))
          });
          displayCropInfo(activeSlot);
        }
        closeModal();
      } catch (_err) {
      }
    }
    function perspectiveCrop(sourceImage, corners) {
      if (!sourceImage || !corners || corners.length < 4) return null;
      const imgBounds = getImageBounds();
      const isFullImage = Math.abs(corners[0].x) < 2 && Math.abs(corners[0].y) < 2 && Math.abs(corners[1].x - imgBounds.width) < 2 && Math.abs(corners[1].y) < 2 && Math.abs(corners[2].x - imgBounds.width) < 2 && Math.abs(corners[2].y - imgBounds.height) < 2 && Math.abs(corners[3].x) < 2 && Math.abs(corners[3].y - imgBounds.height) < 2;
      if (isFullImage) return null;
      const topWidth = Math.sqrt(
        Math.pow(corners[1].x - corners[0].x, 2) + Math.pow(corners[1].y - corners[0].y, 2)
      );
      const bottomWidth = Math.sqrt(
        Math.pow(corners[2].x - corners[3].x, 2) + Math.pow(corners[2].y - corners[3].y, 2)
      );
      const leftHeight = Math.sqrt(
        Math.pow(corners[3].x - corners[0].x, 2) + Math.pow(corners[3].y - corners[0].y, 2)
      );
      const rightHeight = Math.sqrt(
        Math.pow(corners[2].x - corners[1].x, 2) + Math.pow(corners[2].y - corners[1].y, 2)
      );
      const outW = Math.round(Math.max(topWidth, bottomWidth));
      const outH = Math.round(Math.max(leftHeight, rightHeight));
      if (outW <= 0 || outH <= 0) return null;
      const outCanvas = doc.createElement("canvas");
      outCanvas.width = outW;
      outCanvas.height = outH;
      const outCtx = outCanvas.getContext("2d");
      if (!outCtx) return null;
      const gridSize = 20;
      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          const u0 = col / gridSize;
          const u1 = (col + 1) / gridSize;
          const v0 = row / gridSize;
          const v1 = (row + 1) / gridSize;
          const srcTL = bilinearInterp(corners, u0, v0);
          const srcTR = bilinearInterp(corners, u1, v0);
          const srcBR = bilinearInterp(corners, u1, v1);
          const srcBL = bilinearInterp(corners, u0, v1);
          const dstX = u0 * outW;
          const dstY = v0 * outH;
          const dstW = (u1 - u0) * outW;
          const dstH = (v1 - v0) * outH;
          drawQuadCell(outCtx, sourceImage, srcTL, srcTR, srcBR, srcBL, dstX, dstY, dstW, dstH);
        }
      }
      const dataUrl = outCanvas.toDataURL("image/png");
      const img = new Image();
      img.src = dataUrl;
      return {
        image: img,
        width: outW,
        height: outH,
        dataUrl
      };
    }
    function bilinearInterp(corners, u, v) {
      const topX = corners[0].x + (corners[1].x - corners[0].x) * u;
      const topY = corners[0].y + (corners[1].y - corners[0].y) * u;
      const botX = corners[3].x + (corners[2].x - corners[3].x) * u;
      const botY = corners[3].y + (corners[2].y - corners[3].y) * u;
      return {
        x: topX + (botX - topX) * v,
        y: topY + (botY - topY) * v
      };
    }
    function drawQuadCell(ctx, img, srcTL, srcTR, srcBR, srcBL, dstX, dstY, dstW, dstH) {
      const srcX = Math.min(srcTL.x, srcTR.x, srcBR.x, srcBL.x);
      const srcY = Math.min(srcTL.y, srcTR.y, srcBR.y, srcBL.y);
      const srcW = Math.max(srcTL.x, srcTR.x, srcBR.x, srcBL.x) - srcX;
      const srcH = Math.max(srcTL.y, srcTR.y, srcBR.y, srcBL.y) - srcY;
      if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) return;
      ctx.drawImage(img, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
    }
    function updateSlotVisuals(slot, dataUrl) {
      const slotConfig = {
        front: { previewImg: "preview1", previewContainer: "preview1-container", thumb: "thumb1", thumbPlaceholder: "thumb1Placeholder" },
        back: { previewImg: "preview2", previewContainer: "preview2-container", thumb: "thumb2", thumbPlaceholder: "thumb2Placeholder" }
      };
      const cfg = slotConfig[slot];
      if (!cfg) return;
      const previewImg = byId(cfg.previewImg);
      if (previewImg) previewImg.src = dataUrl;
      const previewContainer = byId(cfg.previewContainer);
      if (previewContainer) previewContainer.classList.remove(HIDDEN_CLASS2);
      const thumb = byId(cfg.thumb);
      if (thumb) {
        thumb.src = dataUrl;
        thumb.classList.remove(HIDDEN_CLASS2);
      }
      const placeholder = byId(cfg.thumbPlaceholder);
      if (placeholder) placeholder.classList.add(HIDDEN_CLASS2);
    }
    function cancelCrop() {
      try {
        closeModal();
      } catch (_err) {
      }
    }
    function displayCropInfo(slot) {
      const infoEl = byId(CROP_INFO_IDS[slot]);
      if (!infoEl) return;
      const state = appState.getState();
      const source = state.sources[slot];
      if (!source) {
        infoEl.textContent = "";
        return;
      }
      if (source.crop) {
        const crop = source.crop;
        infoEl.textContent = `Crop: ${crop.w} \xD7 ${crop.h} px`;
      } else if (source.naturalWidth && source.naturalHeight) {
        infoEl.textContent = `Cropped: ${source.naturalWidth} \xD7 ${source.naturalHeight} px`;
      } else {
        infoEl.textContent = "";
      }
    }
    function init() {
      const crop1Btn = byId("crop1");
      const crop2Btn = byId("crop2");
      on(crop1Btn, "click", () => openCropModal("front"));
      on(crop2Btn, "click", () => openCropModal("back"));
      const applyBtn = byId("applyCrop");
      const cancelBtn = byId("cancelCrop");
      on(applyBtn, "click", () => applyCrop());
      on(cancelBtn, "click", () => cancelCrop());
      const canvas = getCanvas();
      on(canvas, "pointerdown", handlePointerDown);
      on(canvas, "pointermove", handlePointerMove);
      on(canvas, "pointerup", handlePointerUp);
      on(canvas, "touchstart", (e) => e.preventDefault(), { passive: false });
      on(doc, "keydown", handleKeyDown);
    }
    function destroy() {
      while (teardown.length > 0) {
        const off = teardown.pop();
        try {
          off();
        } catch (_err) {
        }
      }
      activeSlot = null;
      currentRegion = null;
      cropImage = null;
      openerElement = null;
    }
    return {
      init,
      destroy,
      openCropModal,
      applyCrop,
      cancelCrop
    };
  }

  // src/core/combineLayout.js
  var DEFAULT_BACKGROUND = "#ffffff";
  function naturalSize(slot) {
    const img = slot && slot.image;
    const width = Number.isFinite(slot && slot.naturalWidth) ? slot.naturalWidth : img && Number.isFinite(img.naturalWidth) ? img.naturalWidth : 0;
    const height = Number.isFinite(slot && slot.naturalHeight) ? slot.naturalHeight : img && Number.isFinite(img.naturalHeight) ? img.naturalHeight : 0;
    return { width: Math.max(0, width), height: Math.max(0, height) };
  }
  function sourceRect(slot) {
    const { width, height } = naturalSize(slot);
    const crop = slot && slot.crop;
    if (crop && Number.isFinite(crop.w) && Number.isFinite(crop.h)) {
      return {
        x: Number.isFinite(crop.x) ? crop.x : 0,
        y: Number.isFinite(crop.y) ? crop.y : 0,
        w: Math.max(0, crop.w),
        h: Math.max(0, crop.h)
      };
    }
    return { x: 0, y: 0, w: width, h: height };
  }
  function orderedSlots(sources) {
    if (!sources) return [];
    let ordered;
    if (Array.isArray(sources)) {
      ordered = sources;
    } else {
      ordered = [sources.front, sources.back];
    }
    return ordered.filter((slot) => slot != null);
  }
  function computeLayout(sources, spacing, bgColor) {
    const slots = orderedSlots(sources);
    const gap = Number.isFinite(spacing) ? Math.max(0, spacing) : 0;
    const backgroundColor = typeof bgColor === "string" && bgColor.length > 0 ? bgColor : DEFAULT_BACKGROUND;
    if (slots.length === 0) {
      return { targetWidth: 0, totalHeight: 0, backgroundColor, placements: [] };
    }
    const srcRects = slots.map(sourceRect);
    const targetWidth = srcRects.reduce((max, r) => Math.max(max, r.w), 0);
    const placements = [];
    let offsetY = 0;
    for (let i = 0; i < slots.length; i += 1) {
      const srcRect = srcRects[i];
      const scaledHeight = srcRect.w > 0 ? Math.round(srcRect.h * targetWidth / srcRect.w) : 0;
      const dstRect = { x: 0, y: offsetY, w: targetWidth, h: scaledHeight };
      placements.push({ src: slots[i], srcRect, dstRect });
      offsetY += scaledHeight + gap;
    }
    const sumHeights = placements.reduce((sum, p) => sum + p.dstRect.h, 0);
    const totalHeight = sumHeights + (placements.length - 1) * gap;
    return { targetWidth, totalHeight, backgroundColor, placements };
  }

  // src/controllers/combineController.js
  var HIDDEN_CLASS3 = "hidden";
  var DEFAULT_BACKGROUND_COLOR2 = "#ffffff";
  var NO_SOURCE_MESSAGE = "At least one image is required to combine.";
  function resolveElement(elements, key, doc, id) {
    if (elements && elements[key]) return elements[key];
    if (doc && typeof doc.getElementById === "function") {
      return doc.getElementById(id);
    }
    return null;
  }
  function loadedSlots(state) {
    const sources = state && state.sources ? state.sources : {};
    return [sources.front, sources.back].filter(
      (slot) => slot && slot.image != null
    );
  }
  function createCombineController(deps = {}) {
    const {
      appState,
      messages,
      progress,
      elements = {},
      document: doc = typeof document !== "undefined" ? document : void 0,
      computeLayout: computeLayout2 = computeLayout,
      validateSpacing: validateSpacing2 = validateSpacing
    } = deps;
    if (!appState) throw new Error("createCombineController requires an appState store");
    if (!messages) throw new Error("createCombineController requires a messages controller");
    if (!progress) throw new Error("createCombineController requires a progress controller");
    const combineButton = resolveElement(elements, "combineButton", doc, "combine");
    const spacingInput = resolveElement(elements, "spacingInput", doc, "spacing");
    const backgroundInput = resolveElement(elements, "backgroundInput", doc, "bgcolor");
    const previewCanvas = resolveElement(elements, "previewCanvas", doc, "previewCanvas");
    const previewPlaceholder = resolveElement(
      elements,
      "previewPlaceholder",
      doc,
      "previewCanvasPlaceholder"
    );
    const exportButton = resolveElement(elements, "exportButton", doc, "downloadPdf");
    function handleSpacingChange() {
      const previous = appState.getState().settings.spacing;
      const raw = spacingInput ? spacingInput.value : previous;
      const result = validateSpacing2(raw, previous);
      if (!result.ok) {
        if (spacingInput) spacingInput.value = String(result.value);
        messages.showError(result.message);
        return false;
      }
      appState.setSpacing(result.value);
      if (spacingInput) spacingInput.value = String(result.value);
      messages.clearMessage();
      return true;
    }
    function resolveSpacing() {
      handleSpacingChange();
      return appState.getState().settings.spacing;
    }
    function handleBackgroundChange() {
      const raw = backgroundInput ? backgroundInput.value : "";
      const color = typeof raw === "string" && raw.length > 0 ? raw : DEFAULT_BACKGROUND_COLOR2;
      appState.setBackgroundColor(color);
      return color;
    }
    function resolveBackgroundColor() {
      handleBackgroundChange();
      const stored = appState.getState().settings.backgroundColor;
      return typeof stored === "string" && stored.length > 0 ? stored : DEFAULT_BACKGROUND_COLOR2;
    }
    function drawLayout(layout, onProgress) {
      if (!previewCanvas) return;
      const width = Math.max(1, Math.round(layout.targetWidth));
      const height = Math.max(1, Math.round(layout.totalHeight));
      previewCanvas.width = width;
      previewCanvas.height = height;
      const ctx = previewCanvas.getContext && previewCanvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = layout.backgroundColor || DEFAULT_BACKGROUND_COLOR2;
      ctx.fillRect(0, 0, width, height);
      const total = layout.placements.length || 1;
      layout.placements.forEach((placement, index) => {
        const img = placement.src && placement.src.image;
        const { srcRect, dstRect } = placement;
        if (img && srcRect.w > 0 && srcRect.h > 0 && dstRect.w > 0 && dstRect.h > 0) {
          ctx.drawImage(
            img,
            srcRect.x,
            srcRect.y,
            srcRect.w,
            srcRect.h,
            dstRect.x,
            dstRect.y,
            dstRect.w,
            dstRect.h
          );
        }
        if (typeof onProgress === "function") {
          onProgress(40 + Math.round((index + 1) / total * 50));
        }
      });
    }
    function revealCombinedPreview() {
      if (previewCanvas && previewCanvas.classList) {
        previewCanvas.classList.remove(HIDDEN_CLASS3);
      }
      if (previewPlaceholder && previewPlaceholder.classList) {
        previewPlaceholder.classList.add(HIDDEN_CLASS3);
      }
    }
    function enableExport() {
      if (exportButton) {
        if (exportButton.classList) exportButton.classList.remove(HIDDEN_CLASS3);
        exportButton.disabled = false;
      }
      if (typeof appState.setExportCombinedVisible === "function") {
        appState.setExportCombinedVisible(true);
      }
    }
    function handleCombine() {
      const state = appState.getState();
      const slots = loadedSlots(state);
      if (slots.length === 0) {
        messages.showGuidance(NO_SOURCE_MESSAGE);
        return false;
      }
      const spacing = resolveSpacing();
      const backgroundColor = resolveBackgroundColor();
      try {
        progress.begin();
        progress.set(15);
        const layout = computeLayout2(slots, spacing, backgroundColor);
        progress.set(40);
        drawLayout(layout, (p) => progress.set(p));
        if (typeof appState.setCombinedImage === "function") {
          appState.setCombinedImage(previewCanvas || layout);
        }
        revealCombinedPreview();
        enableExport();
        messages.clearMessage();
        progress.complete();
        return true;
      } catch (err) {
        progress.fail();
        messages.showError(
          err && err.message ? `Combine failed: ${err.message}` : "Combine failed. Please try again."
        );
        return false;
      }
    }
    function onCombineClick() {
      handleCombine();
    }
    function onSpacingChange() {
      handleSpacingChange();
    }
    function onBackgroundChange() {
      handleBackgroundChange();
    }
    function init() {
      if (combineButton) combineButton.addEventListener("click", onCombineClick);
      if (spacingInput) spacingInput.addEventListener("change", onSpacingChange);
      if (backgroundInput) backgroundInput.addEventListener("change", onBackgroundChange);
    }
    function destroy() {
      if (combineButton) combineButton.removeEventListener("click", onCombineClick);
      if (spacingInput) spacingInput.removeEventListener("change", onSpacingChange);
      if (backgroundInput) backgroundInput.removeEventListener("change", onBackgroundChange);
    }
    return {
      init,
      destroy,
      handleCombine,
      handleSpacingChange,
      handleBackgroundChange
    };
  }

  // src/core/imageAdjust.js
  var ADJUSTMENT_DEFAULTS = Object.freeze({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    sharpness: 0
  });
  function toNumber(value, fallback) {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : fallback;
  }
  function buildFilterString(brightness, contrast, saturation) {
    const b = toNumber(brightness, ADJUSTMENT_DEFAULTS.brightness) / 100;
    const c = toNumber(contrast, ADJUSTMENT_DEFAULTS.contrast) / 100;
    const s = toNumber(saturation, ADJUSTMENT_DEFAULTS.saturation) / 100;
    return `brightness(${b}) contrast(${c}) saturate(${s})`;
  }
  function sharpenKernel(amount) {
    const n = toNumber(amount, 0);
    if (n <= 0) return null;
    const a = Math.min(100, n) / 100;
    return [0, -a, 0, -a, 1 + 4 * a, -a, 0, -a, 0];
  }
  function isIdentity(brightness, contrast, saturation, sharpness) {
    return toNumber(brightness, ADJUSTMENT_DEFAULTS.brightness) === 100 && toNumber(contrast, ADJUSTMENT_DEFAULTS.contrast) === 100 && toNumber(saturation, ADJUSTMENT_DEFAULTS.saturation) === 100 && toNumber(sharpness, ADJUSTMENT_DEFAULTS.sharpness) === 0;
  }
  function clampByte(value) {
    if (value <= 0) return 0;
    if (value >= 255) return 255;
    return Math.round(value);
  }
  function applyColor(src, out, b, c, s) {
    const sr = 0.213;
    const sg = 0.715;
    const sb = 0.072;
    for (let i = 0; i < src.length; i += 4) {
      let r = src[i];
      let g = src[i + 1];
      let bl = src[i + 2];
      r *= b;
      g *= b;
      bl *= b;
      r = (r - 127.5) * c + 127.5;
      g = (g - 127.5) * c + 127.5;
      bl = (bl - 127.5) * c + 127.5;
      const rr = (sr + (1 - sr) * s) * r + (sg - sg * s) * g + (sb - sb * s) * bl;
      const gg = (sr - sr * s) * r + (sg + (1 - sg) * s) * g + (sb - sb * s) * bl;
      const bb = (sr - sr * s) * r + (sg - sg * s) * g + (sb + (1 - sb) * s) * bl;
      out[i] = clampByte(rr);
      out[i + 1] = clampByte(gg);
      out[i + 2] = clampByte(bb);
      out[i + 3] = src[i + 3];
    }
  }
  function convolve(src, width, height, kernel) {
    const out = new Uint8ClampedArray(src.length);
    const clampX = (x) => x < 0 ? 0 : x >= width ? width - 1 : x;
    const clampY = (y) => y < 0 ? 0 : y >= height ? height - 1 : y;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = (y * width + x) * 4;
        let r = 0;
        let g = 0;
        let b = 0;
        let k = 0;
        for (let ky = -1; ky <= 1; ky += 1) {
          for (let kx = -1; kx <= 1; kx += 1) {
            const weight = kernel[k];
            k += 1;
            const sx = clampX(x + kx);
            const sy = clampY(y + ky);
            const sIdx = (sy * width + sx) * 4;
            r += src[sIdx] * weight;
            g += src[sIdx + 1] * weight;
            b += src[sIdx + 2] * weight;
          }
        }
        out[idx] = clampByte(r);
        out[idx + 1] = clampByte(g);
        out[idx + 2] = clampByte(b);
        out[idx + 3] = src[idx + 3];
      }
    }
    return out;
  }
  function adjust(buffer, width, height, adjustments = {}) {
    const brightness = toNumber(
      adjustments.brightness,
      ADJUSTMENT_DEFAULTS.brightness
    );
    const contrast = toNumber(adjustments.contrast, ADJUSTMENT_DEFAULTS.contrast);
    const saturation = toNumber(
      adjustments.saturation,
      ADJUSTMENT_DEFAULTS.saturation
    );
    const sharpness = toNumber(
      adjustments.sharpness,
      ADJUSTMENT_DEFAULTS.sharpness
    );
    if (isIdentity(brightness, contrast, saturation, sharpness)) {
      return Uint8ClampedArray.from(buffer);
    }
    const b = brightness / 100;
    const c = contrast / 100;
    const s = saturation / 100;
    const colored = new Uint8ClampedArray(buffer.length);
    applyColor(buffer, colored, b, c, s);
    const kernel = sharpenKernel(sharpness);
    const w = Number.isFinite(width) ? Math.max(0, Math.floor(width)) : 0;
    const h = Number.isFinite(height) ? Math.max(0, Math.floor(height)) : 0;
    if (kernel && w > 0 && h > 0 && w * h * 4 === colored.length) {
      return convolve(colored, w, h, kernel);
    }
    return colored;
  }

  // src/controllers/adjustmentController.js
  var DEFAULT_DEBOUNCE_MS = 500;
  var NO_COMBINED_GUIDANCE = "Combine your images first to enable adjustments.";
  var APPLY_FAILED_MESSAGE = "Could not apply adjustments. Please try again.";
  var HIDDEN_CLASS4 = "hidden";
  function readSliderValue(el, fallback) {
    if (!el) return fallback;
    const n = Number.parseInt(el.value, 10);
    return Number.isFinite(n) ? n : fallback;
  }
  function createAdjustmentController(options = {}) {
    const {
      elements = {},
      appState,
      messages,
      progress = null,
      debounceMs = DEFAULT_DEBOUNCE_MS,
      setTimeoutFn,
      clearTimeoutFn
    } = options;
    if (!appState) throw new Error("createAdjustmentController requires appState");
    if (!messages) throw new Error("createAdjustmentController requires messages");
    const {
      brightness: brightnessEl = null,
      contrast: contrastEl = null,
      saturation: saturationEl = null,
      sharpness: sharpnessEl = null,
      brightnessVal = null,
      contrastVal = null,
      saturationVal = null,
      sharpnessVal = null,
      applyBtn = null,
      adjustedCanvas = null,
      adjustedPlaceholder = null,
      downloadAdjBtn = null,
      sourceCanvas = null
    } = elements;
    const schedule = typeof setTimeoutFn === "function" ? setTimeoutFn : typeof setTimeout === "function" ? setTimeout : null;
    const cancel = typeof clearTimeoutFn === "function" ? clearTimeoutFn : typeof clearTimeout === "function" ? clearTimeout : null;
    const resolvedDebounce = Number.isFinite(debounceMs) && debounceMs >= 0 ? debounceMs : DEFAULT_DEBOUNCE_MS;
    let previewTimer = null;
    function combinedImageExists() {
      const state = appState.getState();
      return Boolean(state && state.combinedImage);
    }
    function readAdjustments() {
      return {
        brightness: readSliderValue(brightnessEl, 100),
        contrast: readSliderValue(contrastEl, 100),
        saturation: readSliderValue(saturationEl, 100),
        sharpness: readSliderValue(sharpnessEl, 0)
      };
    }
    function renderValues() {
      const { brightness, contrast, saturation, sharpness } = readAdjustments();
      if (brightnessVal) brightnessVal.textContent = `${brightness}%`;
      if (contrastVal) contrastVal.textContent = `${contrast}%`;
      if (saturationVal) saturationVal.textContent = `${saturation}%`;
      if (sharpnessVal) sharpnessVal.textContent = `${sharpness}`;
    }
    function showAdjustedCanvas() {
      if (adjustedCanvas) adjustedCanvas.classList.remove(HIDDEN_CLASS4);
      if (adjustedPlaceholder) adjustedPlaceholder.classList.add(HIDDEN_CLASS4);
    }
    function cancelPendingPreview() {
      if (previewTimer !== null && cancel) cancel(previewTimer);
      previewTimer = null;
    }
    function renderLivePreview() {
      if (!combinedImageExists() || !sourceCanvas || !adjustedCanvas) return;
      const ctx = adjustedCanvas.getContext && adjustedCanvas.getContext("2d");
      if (!ctx) return;
      const width = sourceCanvas.width;
      const height = sourceCanvas.height;
      if (!width || !height) return;
      const { brightness, contrast, saturation } = readAdjustments();
      try {
        adjustedCanvas.width = width;
        adjustedCanvas.height = height;
        ctx.clearRect(0, 0, width, height);
        ctx.filter = buildFilterString(brightness, contrast, saturation);
        ctx.drawImage(sourceCanvas, 0, 0);
        ctx.filter = "none";
        showAdjustedCanvas();
      } catch (_err) {
      }
    }
    function scheduleLivePreview() {
      cancelPendingPreview();
      if (!schedule) {
        renderLivePreview();
        return;
      }
      previewTimer = schedule(() => {
        previewTimer = null;
        renderLivePreview();
      }, resolvedDebounce);
    }
    function handleSliderInput(key) {
      renderValues();
      if (!combinedImageExists()) {
        cancelPendingPreview();
        messages.showGuidance(NO_COMBINED_GUIDANCE);
        return;
      }
      if (key === "sharpness") return;
      scheduleLivePreview();
    }
    function applyAdjustments() {
      if (!combinedImageExists()) {
        messages.showGuidance(NO_COMBINED_GUIDANCE);
        return false;
      }
      if (!sourceCanvas || !adjustedCanvas) {
        messages.showError(APPLY_FAILED_MESSAGE);
        return false;
      }
      const srcCtx = sourceCanvas.getContext && sourceCanvas.getContext("2d");
      const outCtx = adjustedCanvas.getContext && adjustedCanvas.getContext("2d");
      if (!srcCtx || !outCtx) {
        messages.showError(APPLY_FAILED_MESSAGE);
        return false;
      }
      cancelPendingPreview();
      if (progress && typeof progress.begin === "function") progress.begin();
      try {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        if (!width || !height) {
          if (progress && typeof progress.fail === "function") progress.fail();
          messages.showError(APPLY_FAILED_MESSAGE);
          return false;
        }
        const adjustments = readAdjustments();
        const srcData = srcCtx.getImageData(0, 0, width, height);
        const outBuffer = adjust(srcData.data, width, height, adjustments);
        adjustedCanvas.width = width;
        adjustedCanvas.height = height;
        const outImageData = outCtx.createImageData(width, height);
        outImageData.data.set(outBuffer);
        outCtx.putImageData(outImageData, 0, 0);
        showAdjustedCanvas();
        if (typeof appState.setAdjustedBase === "function") {
          appState.setAdjustedBase(adjustedCanvas);
        }
        if (typeof appState.setAdjustedImage === "function") {
          appState.setAdjustedImage(adjustedCanvas);
        }
        if (typeof appState.setExportAdjustedVisible === "function") {
          appState.setExportAdjustedVisible(true);
        }
        if (downloadAdjBtn) downloadAdjBtn.classList.remove(HIDDEN_CLASS4);
        if (progress && typeof progress.complete === "function") progress.complete();
        return true;
      } catch (_err) {
        if (progress && typeof progress.fail === "function") progress.fail();
        messages.showError(APPLY_FAILED_MESSAGE);
        return false;
      }
    }
    const listeners = [];
    function bind(el, type, handler) {
      if (!el || typeof el.addEventListener !== "function") return;
      el.addEventListener(type, handler);
      listeners.push({ el, type, handler });
    }
    const onBrightness = () => handleSliderInput("brightness");
    const onContrast = () => handleSliderInput("contrast");
    const onSaturation = () => handleSliderInput("saturation");
    const onSharpness = () => handleSliderInput("sharpness");
    const onApply = () => applyAdjustments();
    bind(brightnessEl, "input", onBrightness);
    bind(contrastEl, "input", onContrast);
    bind(saturationEl, "input", onSaturation);
    bind(sharpnessEl, "input", onSharpness);
    bind(applyBtn, "click", onApply);
    renderValues();
    function destroy() {
      cancelPendingPreview();
      for (const { el, type, handler } of listeners) {
        if (el && typeof el.removeEventListener === "function") {
          el.removeEventListener(type, handler);
        }
      }
      listeners.length = 0;
    }
    return {
      handleSliderInput,
      applyAdjustments,
      renderValues,
      destroy
    };
  }
  function initAdjustmentController(doc, deps = {}) {
    if (!doc || typeof doc.getElementById !== "function") {
      throw new Error("initAdjustmentController requires a document");
    }
    const elements = {
      brightness: doc.getElementById("adjBrightness"),
      contrast: doc.getElementById("adjContrast"),
      saturation: doc.getElementById("adjSaturation"),
      sharpness: doc.getElementById("adjSharp"),
      brightnessVal: doc.getElementById("adjBrightVal"),
      contrastVal: doc.getElementById("adjContrastVal"),
      saturationVal: doc.getElementById("adjSatVal"),
      sharpnessVal: doc.getElementById("adjSharpVal"),
      applyBtn: doc.getElementById("applyAdj"),
      adjustedCanvas: doc.getElementById("adjustedCanvas"),
      adjustedPlaceholder: doc.getElementById("adjustedCanvasPlaceholder"),
      downloadAdjBtn: doc.getElementById("downloadAdjPdf"),
      sourceCanvas: doc.getElementById("previewCanvas")
    };
    return createAdjustmentController({
      elements,
      appState: deps.appState,
      messages: deps.messages,
      progress: deps.progress,
      debounceMs: deps.debounceMs
    });
  }

  // src/core/filters.js
  var FILTER_NAMES2 = Object.freeze(["none", "lighten", "document", "grayscale"]);
  var DOC_CONTRAST_AMOUNT = 60;
  var DOC_CONTRAST_FACTOR = 259 * (DOC_CONTRAST_AMOUNT + 255) / (255 * (259 - DOC_CONTRAST_AMOUNT));
  var DOC_BRIGHTNESS_OFFSET = 8;
  var LUMA_R = 0.299;
  var LUMA_G = 0.587;
  var LUMA_B = 0.114;
  function clampByte2(v) {
    if (v < 0) return 0;
    if (v > 255) return 255;
    return v;
  }
  function normalizeName(name) {
    const n = typeof name === "string" ? name.trim().toLowerCase() : "";
    return FILTER_NAMES2.includes(n) ? n : "none";
  }
  function applyFilter(name, baseRGBA, width, height) {
    const filter = normalizeName(name);
    const dimsValid = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
    const sourceLen = baseRGBA && baseRGBA.length ? baseRGBA.length : 0;
    const length = dimsValid ? width * height * 4 : sourceLen;
    const out = new Uint8ClampedArray(length);
    for (let i = 0; i < length; i += 1) {
      out[i] = baseRGBA ? baseRGBA[i] : 0;
    }
    if (filter === "none") {
      return out;
    }
    if (filter === "lighten") {
      for (let i = 0; i + 3 < length; i += 4) {
        out[i] = clampByte2(Math.round(out[i] * 1.08 + 12));
        out[i + 1] = clampByte2(Math.round(out[i + 1] * 1.08 + 12));
        out[i + 2] = clampByte2(Math.round(out[i + 2] * 1.08 + 12));
      }
      return out;
    }
    if (filter === "grayscale") {
      for (let i = 0; i + 3 < length; i += 4) {
        const l = Math.round(LUMA_R * out[i] + LUMA_G * out[i + 1] + LUMA_B * out[i + 2]);
        out[i] = l;
        out[i + 1] = l;
        out[i + 2] = l;
      }
      return out;
    }
    for (let i = 0; i + 3 < length; i += 4) {
      let l = Math.round(LUMA_R * out[i] + LUMA_G * out[i + 1] + LUMA_B * out[i + 2]);
      l = Math.round(DOC_CONTRAST_FACTOR * (l - 128) + 128 + DOC_BRIGHTNESS_OFFSET);
      l = clampByte2(l);
      out[i] = l;
      out[i + 1] = l;
      out[i + 2] = l;
    }
    return out;
  }

  // src/controllers/filterController.js
  var NO_ADJUSTED_IMAGE_GUIDANCE = "Apply adjustments to the combined image before using a filter.";
  var FILTER_GUIDANCE_MIN_VISIBLE_MS = 3e3;
  var HIDDEN_CLASS5 = "hidden";
  function normalizeFilterName(name) {
    const n = typeof name === "string" ? name.trim().toLowerCase() : "";
    return FILTER_NAMES2.includes(n) ? n : "none";
  }
  function createFilterController(options = {}) {
    const {
      appState,
      messages,
      filterSelect = null,
      applyButton = null,
      resetButton = null,
      adjustedCanvas = null
    } = options;
    if (!appState || typeof appState.getState !== "function") {
      throw new Error("createFilterController requires an appState store");
    }
    if (!messages || typeof messages.showGuidance !== "function") {
      throw new Error("createFilterController requires a messages controller");
    }
    function readBasePixels() {
      const state = appState.getState();
      const base = state ? state.adjustedBase || state.combinedImage : null;
      if (!base) return null;
      if (base.data && Number.isFinite(base.width) && Number.isFinite(base.height) && base.width > 0 && base.height > 0) {
        return { data: base.data, width: base.width, height: base.height };
      }
      if (typeof base.getContext === "function") {
        const w = base.width;
        const h = base.height;
        if (!(w > 0 && h > 0)) return null;
        const ctx = base.getContext("2d");
        if (!ctx || typeof ctx.getImageData !== "function") return null;
        const imageData = ctx.getImageData(0, 0, w, h);
        return { data: imageData.data, width: w, height: h };
      }
      return null;
    }
    function hasAdjustedImage() {
      return readBasePixels() !== null;
    }
    function drawToCanvas(rgba, width, height) {
      if (!adjustedCanvas || typeof adjustedCanvas.getContext !== "function") return;
      const ctx = adjustedCanvas.getContext("2d");
      if (!ctx || typeof ctx.putImageData !== "function") return;
      adjustedCanvas.width = width;
      adjustedCanvas.height = height;
      let imageData = null;
      if (typeof ctx.createImageData === "function") {
        imageData = ctx.createImageData(width, height);
        imageData.data.set(rgba);
      } else if (typeof ImageData !== "undefined") {
        imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
      } else {
        return;
      }
      ctx.putImageData(imageData, 0, 0);
      if (adjustedCanvas.classList) {
        adjustedCanvas.classList.remove(HIDDEN_CLASS5);
      }
    }
    function applyNamedFilter(name) {
      const base = readBasePixels();
      if (!base) {
        messages.showGuidance(NO_ADJUSTED_IMAGE_GUIDANCE, {
          minVisibleMs: FILTER_GUIDANCE_MIN_VISIBLE_MS
        });
        return { ok: false };
      }
      const filterName = normalizeFilterName(name);
      const filtered = applyFilter(filterName, base.data, base.width, base.height);
      drawToCanvas(filtered, base.width, base.height);
      if (typeof appState.setFilter === "function") {
        appState.setFilter(filterName);
      }
      if (typeof appState.setAdjustedImage === "function") {
        appState.setAdjustedImage({
          data: filtered,
          width: base.width,
          height: base.height
        });
      }
      return { ok: true, filter: filterName };
    }
    function applyCurrentFilter() {
      const name = filterSelect ? filterSelect.value : appState.getState().filter;
      return applyNamedFilter(name);
    }
    function selectFilter(name) {
      const chosen = name !== void 0 ? name : filterSelect ? filterSelect.value : "none";
      return applyNamedFilter(chosen);
    }
    function reset() {
      const base = readBasePixels();
      if (!base) {
        messages.showGuidance(NO_ADJUSTED_IMAGE_GUIDANCE, {
          minVisibleMs: FILTER_GUIDANCE_MIN_VISIBLE_MS
        });
        return { ok: false };
      }
      if (filterSelect) {
        filterSelect.value = "none";
      }
      return applyNamedFilter("none");
    }
    function safe(fn) {
      return function handler(event) {
        try {
          return fn(event);
        } catch (err) {
          if (typeof messages.showError === "function") {
            messages.showError("Could not apply the filter. Please try again.");
          }
          return void 0;
        }
      };
    }
    const onSelectChange = safe(() => selectFilter());
    const onApplyClick = safe(() => applyCurrentFilter());
    const onResetClick = safe(() => reset());
    function init() {
      if (filterSelect && typeof filterSelect.addEventListener === "function") {
        filterSelect.addEventListener("change", onSelectChange);
      }
      if (applyButton && typeof applyButton.addEventListener === "function") {
        applyButton.addEventListener("click", onApplyClick);
      }
      if (resetButton && typeof resetButton.addEventListener === "function") {
        resetButton.addEventListener("click", onResetClick);
      }
    }
    function destroy() {
      if (filterSelect && typeof filterSelect.removeEventListener === "function") {
        filterSelect.removeEventListener("change", onSelectChange);
      }
      if (applyButton && typeof applyButton.removeEventListener === "function") {
        applyButton.removeEventListener("click", onApplyClick);
      }
      if (resetButton && typeof resetButton.removeEventListener === "function") {
        resetButton.removeEventListener("click", onResetClick);
      }
    }
    return {
      init,
      destroy,
      selectFilter,
      applyCurrentFilter,
      reset,
      hasAdjustedImage
    };
  }
  function initFilterController(doc, deps = {}) {
    if (!doc || typeof doc.getElementById !== "function") {
      throw new Error("initFilterController requires a document");
    }
    const controller = createFilterController({
      appState: deps.appState,
      messages: deps.messages,
      filterSelect: doc.getElementById("filterSelect"),
      applyButton: doc.getElementById("applyFilter"),
      resetButton: doc.getElementById("resetFilter"),
      adjustedCanvas: doc.getElementById("adjustedCanvas")
    });
    controller.init();
    return controller;
  }

  // src/core/pdfLayout.js
  var A4_PORTRAIT = { widthMm: 210, heightMm: 297 };
  var DEFAULT_MARGIN_MM = 12.7;
  var MAX_MARGIN_MM = 25.4;
  var MIN_MARGIN_MM = 0.1;
  function resolvePage(page) {
    const widthMm = page && Number.isFinite(page.widthMm) && page.widthMm > 0 ? page.widthMm : A4_PORTRAIT.widthMm;
    const heightMm = page && Number.isFinite(page.heightMm) && page.heightMm > 0 ? page.heightMm : A4_PORTRAIT.heightMm;
    return { widthMm, heightMm };
  }
  function resolveMargin(margin, page) {
    let m = Number.isFinite(margin) ? margin : DEFAULT_MARGIN_MM;
    if (m < MIN_MARGIN_MM) m = MIN_MARGIN_MM;
    if (m > MAX_MARGIN_MM) m = MAX_MARGIN_MM;
    const maxByWidth = page.widthMm / 2 - MIN_MARGIN_MM;
    const maxByHeight = page.heightMm / 2 - MIN_MARGIN_MM;
    const ceiling = Math.max(MIN_MARGIN_MM, Math.min(maxByWidth, maxByHeight));
    if (m > ceiling) m = ceiling;
    return m;
  }
  function fitImageToPage(imgW, imgH, page = A4_PORTRAIT, margin = DEFAULT_MARGIN_MM) {
    const { widthMm, heightMm } = resolvePage(page);
    const m = resolveMargin(margin, { widthMm, heightMm });
    const printableW = widthMm - 2 * m;
    const printableH = heightMm - 2 * m;
    const w0 = Number.isFinite(imgW) && imgW > 0 ? imgW : printableW;
    const h0 = Number.isFinite(imgH) && imgH > 0 ? imgH : printableH;
    const scale = Math.min(printableW / w0, printableH / h0);
    const w = w0 * scale;
    const h = h0 * scale;
    const x = (widthMm - w) / 2;
    const y = (heightMm - h) / 2;
    return { x, y, w, h };
  }

  // src/controllers/exportController.js
  var NO_COMBINED_MESSAGE = "No combined image available to export. Please combine your images first.";
  var NO_ADJUSTED_MESSAGE = "No adjusted image available to export. Please apply adjustments first.";
  var JSPDF_UNAVAILABLE_MESSAGE = "PDF export currently unavailable.";
  var EXPORT_FAILED_MESSAGE = "PDF export failed. Please try again.";
  function resolveElement2(elements, key, doc, id) {
    if (elements && elements[key]) return elements[key];
    if (doc && typeof doc.getElementById === "function") {
      return doc.getElementById(id);
    }
    return null;
  }
  function getImageDataUrl(source) {
    if (!source) return null;
    if (typeof source.toDataURL === "function") {
      return source.toDataURL("image/png");
    }
    if (source.src || source.naturalWidth) {
      const canvas = document.createElement("canvas");
      const w = source.naturalWidth || source.width || 0;
      const h = source.naturalHeight || source.height || 0;
      if (w === 0 || h === 0) return null;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(source, 0, 0, w, h);
      return canvas.toDataURL("image/png");
    }
    return null;
  }
  function getImageDimensions(source) {
    if (!source) return null;
    const w = source.width || source.naturalWidth || 0;
    const h = source.height || source.naturalHeight || 0;
    if (w <= 0 || h <= 0) return null;
    return { width: w, height: h };
  }
  function getJsPDFConstructor(win) {
    if (win && win.jspdf && typeof win.jspdf.jsPDF === "function") {
      return win.jspdf.jsPDF;
    }
    return null;
  }
  function createExportController(deps = {}) {
    const {
      appState,
      messages: messagesDep,
      elements = {},
      document: doc = typeof document !== "undefined" ? document : void 0,
      window: win = typeof window !== "undefined" ? window : void 0,
      fitImageToPage: fitFn = fitImageToPage
    } = deps;
    if (!appState) throw new Error("createExportController requires an appState store");
    const msgShowError = messagesDep && typeof messagesDep.showError === "function" ? messagesDep.showError.bind(messagesDep) : showError;
    const combinedExportBtn = resolveElement2(
      elements,
      "combinedExportButton",
      doc,
      "downloadPdf"
    );
    const adjustedExportBtn = resolveElement2(
      elements,
      "adjustedExportButton",
      doc,
      "downloadAdjPdf"
    );
    function buildAndSavePdf(sourceImage, filename) {
      const JsPDF = getJsPDFConstructor(win);
      if (!JsPDF) {
        msgShowError(JSPDF_UNAVAILABLE_MESSAGE);
        return false;
      }
      const dims = getImageDimensions(sourceImage);
      if (!dims) {
        msgShowError(EXPORT_FAILED_MESSAGE);
        return false;
      }
      const dataUrl = getImageDataUrl(sourceImage);
      if (!dataUrl) {
        msgShowError(EXPORT_FAILED_MESSAGE);
        return false;
      }
      const fit = fitFn(dims.width, dims.height, A4_PORTRAIT, DEFAULT_MARGIN_MM);
      const pdf = new JsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      pdf.addImage(dataUrl, "PNG", fit.x, fit.y, fit.w, fit.h);
      pdf.save(filename);
      return true;
    }
    function exportCombined() {
      try {
        const state = appState.getState();
        if (!state.combinedImage) {
          msgShowError(NO_COMBINED_MESSAGE);
          return false;
        }
        return buildAndSavePdf(state.combinedImage, "nid-combined.pdf");
      } catch (err) {
        msgShowError(EXPORT_FAILED_MESSAGE);
        return false;
      }
    }
    function exportAdjusted() {
      try {
        const state = appState.getState();
        if (!state.adjustedImage) {
          msgShowError(NO_ADJUSTED_MESSAGE);
          return false;
        }
        return buildAndSavePdf(state.adjustedImage, "nid-adjusted.pdf");
      } catch (err) {
        msgShowError(EXPORT_FAILED_MESSAGE);
        return false;
      }
    }
    function onCombinedExportClick() {
      exportCombined();
    }
    function onAdjustedExportClick() {
      exportAdjusted();
    }
    function init() {
      if (combinedExportBtn) {
        combinedExportBtn.addEventListener("click", onCombinedExportClick);
      }
      if (adjustedExportBtn) {
        adjustedExportBtn.addEventListener("click", onAdjustedExportClick);
      }
    }
    function destroy() {
      if (combinedExportBtn) {
        combinedExportBtn.removeEventListener("click", onCombinedExportClick);
      }
      if (adjustedExportBtn) {
        adjustedExportBtn.removeEventListener("click", onAdjustedExportClick);
      }
    }
    return {
      init,
      destroy,
      exportCombined,
      exportAdjusted
    };
  }

  // src/controllers/resetController.js
  var HIDDEN_CLASS6 = "hidden";
  function resolveElement3(elements, key, doc, id) {
    if (elements && elements[key]) return elements[key];
    if (doc && typeof doc.getElementById === "function") {
      return doc.getElementById(id);
    }
    return null;
  }
  function createResetController(deps = {}) {
    const {
      appState,
      progress,
      messages = {},
      elements = {},
      document: doc = typeof document !== "undefined" ? document : void 0
    } = deps;
    if (!appState || typeof appState.reset !== "function") {
      throw new Error("createResetController requires an appState store");
    }
    if (!progress || typeof progress.reset !== "function") {
      throw new Error("createResetController requires a progress controller");
    }
    const clearButton = resolveElement3(elements, "clearButton", doc, "clear");
    const preview1Container = resolveElement3(elements, "preview1Container", doc, "preview1-container");
    const preview1Img = resolveElement3(elements, "preview1Img", doc, "preview1");
    const preview2Container = resolveElement3(elements, "preview2Container", doc, "preview2-container");
    const preview2Img = resolveElement3(elements, "preview2Img", doc, "preview2");
    const thumb1 = resolveElement3(elements, "thumb1", doc, "thumb1");
    const thumb1Placeholder = resolveElement3(elements, "thumb1Placeholder", doc, "thumb1Placeholder");
    const thumb2 = resolveElement3(elements, "thumb2", doc, "thumb2");
    const thumb2Placeholder = resolveElement3(elements, "thumb2Placeholder", doc, "thumb2Placeholder");
    const cropInfo1 = resolveElement3(elements, "cropInfo1", doc, "cropInfo1");
    const cropInfo2 = resolveElement3(elements, "cropInfo2", doc, "cropInfo2");
    const previewCanvas = resolveElement3(elements, "previewCanvas", doc, "previewCanvas");
    const previewCanvasPlaceholder = resolveElement3(
      elements,
      "previewCanvasPlaceholder",
      doc,
      "previewCanvasPlaceholder"
    );
    const adjustedCanvas = resolveElement3(elements, "adjustedCanvas", doc, "adjustedCanvas");
    const adjustedCanvasPlaceholder = resolveElement3(
      elements,
      "adjustedCanvasPlaceholder",
      doc,
      "adjustedCanvasPlaceholder"
    );
    const exportCombinedBtn = resolveElement3(elements, "exportCombinedBtn", doc, "downloadPdf");
    const exportAdjustedBtn = resolveElement3(elements, "exportAdjustedBtn", doc, "downloadAdjPdf");
    const spacingInput = resolveElement3(elements, "spacingInput", doc, "spacing");
    const bgcolorInput = resolveElement3(elements, "bgcolorInput", doc, "bgcolor");
    const adjBrightness = resolveElement3(elements, "adjBrightness", doc, "adjBrightness");
    const adjContrast = resolveElement3(elements, "adjContrast", doc, "adjContrast");
    const adjSaturation = resolveElement3(elements, "adjSaturation", doc, "adjSaturation");
    const adjSharp = resolveElement3(elements, "adjSharp", doc, "adjSharp");
    const adjBrightVal = resolveElement3(elements, "adjBrightVal", doc, "adjBrightVal");
    const adjContrastVal = resolveElement3(elements, "adjContrastVal", doc, "adjContrastVal");
    const adjSatVal = resolveElement3(elements, "adjSatVal", doc, "adjSatVal");
    const adjSharpVal = resolveElement3(elements, "adjSharpVal", doc, "adjSharpVal");
    const filterSelect = resolveElement3(elements, "filterSelect", doc, "filterSelect");
    const fileInput1 = resolveElement3(elements, "fileInput1", doc, "file1");
    const fileInput2 = resolveElement3(elements, "fileInput2", doc, "file2");
    function hide(el) {
      if (el && el.classList) el.classList.add(HIDDEN_CLASS6);
    }
    function show(el) {
      if (el && el.classList) el.classList.remove(HIDDEN_CLASS6);
    }
    function handleReset() {
      try {
        appState.reset();
        if (preview1Img) preview1Img.removeAttribute("src");
        hide(preview1Container);
        if (preview2Img) preview2Img.removeAttribute("src");
        hide(preview2Container);
        if (thumb1) {
          thumb1.removeAttribute("src");
          hide(thumb1);
        }
        show(thumb1Placeholder);
        if (thumb2) {
          thumb2.removeAttribute("src");
          hide(thumb2);
        }
        show(thumb2Placeholder);
        if (cropInfo1) cropInfo1.textContent = "";
        if (cropInfo2) cropInfo2.textContent = "";
        hide(previewCanvas);
        if (previewCanvas && previewCanvas.getContext) {
          const ctx = previewCanvas.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        }
        show(previewCanvasPlaceholder);
        hide(adjustedCanvas);
        if (adjustedCanvas && adjustedCanvas.getContext) {
          const ctx = adjustedCanvas.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, adjustedCanvas.width, adjustedCanvas.height);
        }
        show(adjustedCanvasPlaceholder);
        hide(exportCombinedBtn);
        hide(exportAdjustedBtn);
        progress.reset();
        if (spacingInput) spacingInput.value = "10";
        if (bgcolorInput) bgcolorInput.value = "#ffffff";
        if (adjBrightness) adjBrightness.value = "100";
        if (adjContrast) adjContrast.value = "100";
        if (adjSaturation) adjSaturation.value = "100";
        if (adjSharp) adjSharp.value = "0";
        if (adjBrightVal) adjBrightVal.textContent = "100%";
        if (adjContrastVal) adjContrastVal.textContent = "100%";
        if (adjSatVal) adjSatVal.textContent = "100%";
        if (adjSharpVal) adjSharpVal.textContent = "0";
        if (filterSelect) filterSelect.value = "none";
        if (fileInput1) fileInput1.value = "";
        if (fileInput2) fileInput2.value = "";
        if (messages && typeof messages.clearMessage === "function") {
          messages.clearMessage();
        }
      } catch (_err) {
      }
    }
    function onClearClick() {
      handleReset();
    }
    function init() {
      if (clearButton) {
        clearButton.addEventListener("click", onClearClick);
      }
    }
    function destroy() {
      if (clearButton) {
        clearButton.removeEventListener("click", onClearClick);
      }
    }
    return {
      init,
      destroy,
      handleReset
    };
  }

  // src/core/nidImageEnhancer.js
  function clampByte3(val) {
    if (val < 0) return 0;
    if (val > 255) return 255;
    return Math.round(val);
  }
  function makePoint(x, y) {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const pt = [ry, rx];
    pt.x = rx;
    pt.y = ry;
    return pt;
  }
  function normalizeQuad(corners, naturalW = 1e3, naturalH = 1e3) {
    if (!corners) {
      return {
        top_left: makePoint(0, 0),
        top_right: makePoint(1e3, 0),
        bottom_right: makePoint(1e3, 1e3),
        bottom_left: makePoint(0, 1e3)
      };
    }
    if (corners.xmin !== void 0 && corners.ymin !== void 0 && corners.xmax !== void 0 && corners.ymax !== void 0) {
      const { xmin, ymin, xmax, ymax } = corners;
      return normalizeQuad({
        top_left: { x: xmin, y: ymin },
        top_right: { x: xmax, y: ymin },
        bottom_right: { x: xmax, y: ymax },
        bottom_left: { x: xmin, y: ymax }
      }, naturalW, naturalH);
    }
    if (Array.isArray(corners) && corners.length === 4) {
      const [c0, c1, c2, c3] = corners.map(Number);
      let xmin, ymin, xmax, ymax;
      const span02 = Math.abs(c2 - c0);
      const span13 = Math.abs(c3 - c1);
      if (span02 >= span13) {
        xmin = c0;
        ymin = c1;
        xmax = c2;
        ymax = c3;
      } else {
        ymin = c0;
        xmin = c1;
        ymax = c2;
        xmax = c3;
      }
      return normalizeQuad({
        top_left: { x: xmin, y: ymin },
        top_right: { x: xmax, y: ymin },
        bottom_right: { x: xmax, y: ymax },
        bottom_left: { x: xmin, y: ymax }
      }, naturalW, naturalH);
    }
    const { top_left, top_right, bottom_right, bottom_left } = corners;
    if (!top_left || !top_right || !bottom_right || !bottom_left) {
      return {
        top_left: makePoint(0, 0),
        top_right: makePoint(1e3, 0),
        bottom_right: makePoint(1e3, 1e3),
        bottom_left: makePoint(0, 1e3)
      };
    }
    let isX0 = true;
    if (Array.isArray(top_left) && Array.isArray(top_right)) {
      const d0 = Math.abs(Number(top_right[0]) - Number(top_left[0]));
      const d1 = Math.abs(Number(top_right[1]) - Number(top_left[1]));
      isX0 = d0 >= d1;
    }
    const parseRawPt = (p) => {
      if (typeof p === "object" && !Array.isArray(p)) {
        if (p.x !== void 0 && p.y !== void 0) {
          return { x: Number(p.x), y: Number(p.y) };
        }
      }
      if (Array.isArray(p)) {
        const v0 = Number(p[0]) || 0;
        const v1 = Number(p[1]) || 0;
        return isX0 ? { x: v0, y: v1 } : { x: v1, y: v0 };
      }
      return { x: 0, y: 0 };
    };
    const pTL = parseRawPt(top_left);
    const pTR = parseRawPt(top_right);
    const pBR = parseRawPt(bottom_right);
    const pBL = parseRawPt(bottom_left);
    const maxX = Math.max(pTL.x, pTR.x, pBR.x, pBL.x);
    const maxY = Math.max(pTL.y, pTR.y, pBR.y, pBL.y);
    const minX = Math.min(pTL.x, pTR.x, pBR.x, pBL.x);
    const minY = Math.min(pTL.y, pTR.y, pBR.y, pBL.y);
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    let isPixels = false;
    if (maxX > 1e3 || maxY > 1e3) {
      isPixels = true;
    } else if (Array.isArray(top_left) && (naturalW !== 1e3 || naturalH !== 1e3) && maxX <= naturalW * 1.05 && maxY <= naturalH * 1.05) {
      isPixels = true;
    }
    const toNormalizedPoint = (pt) => {
      let nx = isPixels ? pt.x / naturalW * 1e3 : pt.x;
      let ny = isPixels ? pt.y / naturalH * 1e3 : pt.y;
      if (maxX <= 1.05 && maxY <= 1.05) {
        nx = pt.x * 1e3;
        ny = pt.y * 1e3;
      }
      return makePoint(
        Math.max(0, Math.min(1e3, nx)),
        Math.max(0, Math.min(1e3, ny))
      );
    };
    return {
      top_left: toNormalizedPoint(pTL),
      top_right: toNormalizedPoint(pTR),
      bottom_right: toNormalizedPoint(pBR),
      bottom_left: toNormalizedPoint(pBL)
    };
  }
  function expandQuadSafetyMargin(corners, options = {}) {
    const {
      marginPct = 0.01,
      minPadUnits = 5,
      snapThreshold = 10,
      maxCoord = 1e3,
      maxPad = {}
      // { top, bottom, left, right } caps for multi-card separation
    } = options;
    const q = normalizeQuad(corners);
    const tl = q.top_left;
    const tr = q.top_right;
    const br = q.bottom_right;
    const bl = q.bottom_left;
    const minX = Math.min(tl.x, tr.x, bl.x, br.x);
    const maxX = Math.max(tl.x, tr.x, bl.x, br.x);
    const minY = Math.min(tl.y, tr.y, bl.y, br.y);
    const maxY = Math.max(tl.y, tr.y, bl.y, br.y);
    const w = maxX - minX;
    const h = maxY - minY;
    const rawPadX = Math.max(minPadUnits, Math.round(w * marginPct));
    const rawPadY = Math.max(minPadUnits, Math.round(h * marginPct));
    const padTop = maxPad.top !== void 0 ? Math.max(0, Math.min(rawPadY, maxPad.top)) : rawPadY;
    const padBottom = maxPad.bottom !== void 0 ? Math.max(0, Math.min(rawPadY, maxPad.bottom)) : rawPadY;
    const padLeft = maxPad.left !== void 0 ? Math.max(0, Math.min(rawPadX, maxPad.left)) : rawPadX;
    const padRight = maxPad.right !== void 0 ? Math.max(0, Math.min(rawPadX, maxPad.right)) : rawPadX;
    const snap = (val, min, max, allowSnap = true) => {
      if (allowSnap) {
        if (val <= snapThreshold) return min;
        if (val >= max - snapThreshold) return max;
      }
      return Math.max(min, Math.min(max, Math.round(val)));
    };
    return {
      top_left: makePoint(
        snap(tl.x - padLeft, 0, maxCoord, padLeft > 0),
        snap(tl.y - padTop, 0, maxCoord, padTop > 0)
      ),
      top_right: makePoint(
        snap(tr.x + padRight, 0, maxCoord, padRight > 0),
        snap(tr.y - padTop, 0, maxCoord, padTop > 0)
      ),
      bottom_right: makePoint(
        snap(br.x + padRight, 0, maxCoord, padRight > 0),
        snap(br.y + padBottom, 0, maxCoord, padBottom > 0)
      ),
      bottom_left: makePoint(
        snap(bl.x - padLeft, 0, maxCoord, padLeft > 0),
        snap(bl.y + padBottom, 0, maxCoord, padBottom > 0)
      )
    };
  }
  function separateAndExpandCards(frontInfo, backInfo, naturalW = 1e3, naturalH = 1e3) {
    const fRaw = frontInfo.corners || frontInfo.bounds || frontInfo.box_2d;
    const bRaw = backInfo.corners || backInfo.bounds || backInfo.box_2d;
    const fQuad = normalizeQuad(fRaw, naturalW, naturalH);
    const bQuad = normalizeQuad(bRaw, naturalW, naturalH);
    const getBounds = (q) => {
      const xs = [q.top_left.x, q.top_right.x, q.bottom_right.x, q.bottom_left.x];
      const ys = [q.top_left.y, q.top_right.y, q.bottom_right.y, q.bottom_left.y];
      return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        centerX: xs.reduce((a, b) => a + b, 0) / 4,
        centerY: ys.reduce((a, b) => a + b, 0) / 4
      };
    };
    const fBox = getBounds(fQuad);
    const bBox = getBounds(bQuad);
    const diffX = Math.abs(fBox.centerX - bBox.centerX);
    const diffY = Math.abs(fBox.centerY - bBox.centerY);
    const isHorizontal = diffX > diffY;
    if (isHorizontal) {
      const frontIsLeft = fBox.centerX < bBox.centerX;
      const leftBox = frontIsLeft ? fBox : bBox;
      const rightBox = frontIsLeft ? bBox : fBox;
      const gapX = rightBox.minX - leftBox.maxX;
      const maxPadX = gapX > 6 ? Math.floor(gapX / 2) - 2 : 0;
      const leftMaxPad = { right: maxPadX };
      const rightMaxPad = { left: maxPadX };
      const expFront = expandQuadSafetyMargin(fQuad, {
        marginPct: 0.01,
        minPadUnits: 5,
        snapThreshold: 10,
        maxPad: frontIsLeft ? leftMaxPad : rightMaxPad
      });
      const expBack = expandQuadSafetyMargin(bQuad, {
        marginPct: 0.01,
        minPadUnits: 5,
        snapThreshold: 10,
        maxPad: frontIsLeft ? rightMaxPad : leftMaxPad
      });
      if (frontIsLeft) {
        const midX = Math.round((Math.max(expFront.top_right.x, expFront.bottom_right.x) + Math.min(expBack.top_left.x, expBack.bottom_left.x)) / 2);
        if (expFront.top_right.x >= expBack.top_left.x) {
          expFront.top_right = makePoint(midX - 1, expFront.top_right.y);
          expFront.bottom_right = makePoint(midX - 1, expFront.bottom_right.y);
          expBack.top_left = makePoint(midX + 1, expBack.top_left.y);
          expBack.bottom_left = makePoint(midX + 1, expBack.bottom_left.y);
        }
      } else {
        const midX = Math.round((Math.max(expBack.top_right.x, expBack.bottom_right.x) + Math.min(expFront.top_left.x, expFront.bottom_left.x)) / 2);
        if (expBack.top_right.x >= expFront.top_left.x) {
          expBack.top_right = makePoint(midX - 1, expBack.top_right.y);
          expBack.bottom_right = makePoint(midX - 1, expBack.bottom_right.y);
          expFront.top_left = makePoint(midX + 1, expFront.top_left.y);
          expFront.bottom_left = makePoint(midX + 1, expFront.bottom_left.y);
        }
      }
      return { frontCorners: expFront, backCorners: expBack };
    } else {
      const frontIsTop = fBox.centerY < bBox.centerY;
      const topBox = frontIsTop ? fBox : bBox;
      const bottomBox = frontIsTop ? bBox : fBox;
      const gapY = bottomBox.minY - topBox.maxY;
      const maxPadY = gapY > 6 ? Math.floor(gapY / 2) - 2 : 0;
      const topMaxPad = { bottom: maxPadY };
      const bottomMaxPad = { top: maxPadY };
      const expFront = expandQuadSafetyMargin(fQuad, {
        marginPct: 0.01,
        minPadUnits: 5,
        snapThreshold: 10,
        maxPad: frontIsTop ? topMaxPad : bottomMaxPad
      });
      const expBack = expandQuadSafetyMargin(bQuad, {
        marginPct: 0.01,
        minPadUnits: 5,
        snapThreshold: 10,
        maxPad: frontIsTop ? bottomMaxPad : topMaxPad
      });
      if (frontIsTop) {
        const fBot = Math.max(expFront.bottom_left.y, expFront.bottom_right.y);
        const bTop = Math.min(expBack.top_left.y, expBack.top_right.y);
        if (fBot > bTop) {
          const midY = Math.round((fBot + bTop) / 2);
          expFront.bottom_left = makePoint(expFront.bottom_left.x, midY);
          expFront.bottom_right = makePoint(expFront.bottom_right.x, midY);
          expBack.top_left = makePoint(expBack.top_left.x, midY);
          expBack.top_right = makePoint(expBack.top_right.x, midY);
        }
      } else {
        const bBot = Math.max(expBack.bottom_left.y, expBack.bottom_right.y);
        const fTop = Math.min(expFront.top_left.y, expFront.top_right.y);
        if (bBot > fTop) {
          const midY = Math.round((bBot + fTop) / 2);
          expBack.bottom_left = makePoint(expBack.bottom_left.x, midY);
          expBack.bottom_right = makePoint(expBack.bottom_right.x, midY);
          expFront.top_left = makePoint(expFront.top_left.x, midY);
          expFront.top_right = makePoint(expFront.top_right.x, midY);
        }
      }
      return { frontCorners: expFront, backCorners: expBack };
    }
  }
  function calculateCardHeight(corners, naturalW, naturalH, targetW = 700) {
    if (!corners || !naturalW || !naturalH) return Math.round(targetW * 0.6306);
    const q = normalizeQuad(corners, naturalW, naturalH);
    const pTL = { x: q.top_left.x / 1e3 * naturalW, y: q.top_left.y / 1e3 * naturalH };
    const pTR = { x: q.top_right.x / 1e3 * naturalW, y: q.top_right.y / 1e3 * naturalH };
    const pBR = { x: q.bottom_right.x / 1e3 * naturalW, y: q.bottom_right.y / 1e3 * naturalH };
    const pBL = { x: q.bottom_left.x / 1e3 * naturalW, y: q.bottom_left.y / 1e3 * naturalH };
    const topW = Math.hypot(pTR.x - pTL.x, pTR.y - pTL.y);
    const botW = Math.hypot(pBR.x - pBL.x, pBR.y - pBL.y);
    const leftH = Math.hypot(pBL.x - pTL.x, pBL.y - pTL.y);
    const rightH = Math.hypot(pBR.x - pTR.x, pBR.y - pTR.y);
    const quadW = (topW + botW) / 2 || 1;
    const quadH = (leftH + rightH) / 2 || 1;
    const ratio = quadH / quadW;
    const clampedRatio = Math.max(0.58, Math.min(0.68, ratio));
    return Math.round(targetW * clampedRatio);
  }
  function warpPerspectiveQuad(sourceImg, corners, targetW, targetH, options = {}) {
    const naturalW = sourceImg.naturalWidth || sourceImg.width || 1;
    const naturalH = sourceImg.naturalHeight || sourceImg.height || 1;
    const finalH = targetH || calculateCardHeight(corners, naturalW, naturalH, targetW);
    let canvas;
    if (typeof document !== "undefined") {
      canvas = document.createElement("canvas");
    } else {
      return { width: targetW, height: finalH };
    }
    canvas.width = targetW;
    canvas.height = finalH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    const resolvedCorners = options.expandMargin !== false ? expandQuadSafetyMargin(corners) : normalizeQuad(corners, naturalW, naturalH);
    const pTL = { x: resolvedCorners.top_left.x / 1e3 * naturalW, y: resolvedCorners.top_left.y / 1e3 * naturalH };
    const pTR = { x: resolvedCorners.top_right.x / 1e3 * naturalW, y: resolvedCorners.top_right.y / 1e3 * naturalH };
    const pBR = { x: resolvedCorners.bottom_right.x / 1e3 * naturalW, y: resolvedCorners.bottom_right.y / 1e3 * naturalH };
    const pBL = { x: resolvedCorners.bottom_left.x / 1e3 * naturalW, y: resolvedCorners.bottom_left.y / 1e3 * naturalH };
    const isAxisAligned = Math.abs(pTL.y - pTR.y) < 8 && Math.abs(pBL.y - pBR.y) < 8 && Math.abs(pTL.x - pBL.x) < 8 && Math.abs(pTR.x - pBR.x) < 8;
    if (isAxisAligned) {
      const sx = Math.max(0, Math.round(pTL.x));
      const sy = Math.max(0, Math.round(pTL.y));
      const sw = Math.min(naturalW - sx, Math.round(pTR.x - pTL.x));
      const sh = Math.min(naturalH - sy, Math.round(pBL.y - pTL.y));
      if (sw > 0 && sh > 0) {
        ctx.drawImage(sourceImg, sx, sy, sw, sh, 0, 0, targetW, finalH);
        return canvas;
      }
    }
    let srcCanvas;
    if (typeof document !== "undefined") {
      srcCanvas = document.createElement("canvas");
    } else {
      return canvas;
    }
    srcCanvas.width = naturalW;
    srcCanvas.height = naturalH;
    const srcCtx = srcCanvas.getContext("2d");
    if (!srcCtx) return canvas;
    srcCtx.drawImage(sourceImg, 0, 0);
    let srcImgData;
    try {
      srcImgData = srcCtx.getImageData(0, 0, naturalW, naturalH);
    } catch (_e) {
      ctx.drawImage(sourceImg, 0, 0, targetW, finalH);
      return canvas;
    }
    const srcPixels = srcImgData.data;
    const dstImgData = ctx.createImageData(targetW, finalH);
    const dstPixels = dstImgData.data;
    for (let dy = 0; dy < finalH; dy++) {
      const ty = dy / finalH;
      for (let dx = 0; dx < targetW; dx++) {
        const tx = dx / targetW;
        const sx = (1 - tx) * (1 - ty) * pTL.x + tx * (1 - ty) * pTR.x + tx * ty * pBR.x + (1 - tx) * ty * pBL.x;
        const sy = (1 - tx) * (1 - ty) * pTL.y + tx * (1 - ty) * pTR.y + tx * ty * pBR.y + (1 - tx) * ty * pBL.y;
        const ix = Math.max(0, Math.min(naturalW - 1, Math.round(sx)));
        const iy = Math.max(0, Math.min(naturalH - 1, Math.round(sy)));
        const srcIdx = (iy * naturalW + ix) * 4;
        const dstIdx = (dy * targetW + dx) * 4;
        dstPixels[dstIdx] = srcPixels[srcIdx];
        dstPixels[dstIdx + 1] = srcPixels[srcIdx + 1];
        dstPixels[dstIdx + 2] = srcPixels[srcIdx + 2];
        dstPixels[dstIdx + 3] = srcPixels[srcIdx + 3];
      }
    }
    ctx.putImageData(dstImgData, 0, 0);
    return canvas;
  }
  function enhanceRealCardImage(cardCanvas, options = {}) {
    const {
      cleanBackground = true,
      contrastBoost = 1.15,
      brightnessBoost = 1.04,
      sharpenAmount = 25,
      addBorder = false
    } = options;
    const w = cardCanvas.width;
    const h = cardCanvas.height;
    const ctx = cardCanvas.getContext("2d");
    if (!ctx || w <= 0 || h <= 0) return cardCanvas;
    let imgData;
    try {
      imgData = ctx.getImageData(0, 0, w, h);
    } catch (_e) {
      return cardCanvas;
    }
    const d = imgData.data;
    if (cleanBackground) {
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const sat = Math.max(r, g, b) - Math.min(r, g, b);
        if (lum > 155 && sat < 45) {
          const factor = (lum - 155) / 100;
          d[i] = clampByte3(r + (255 - r) * factor * 0.95);
          d[i + 1] = clampByte3(g + (255 - g) * factor * 0.95);
          d[i + 2] = clampByte3(b + (255 - b) * factor * 0.95);
        } else if (lum < 110 && sat < 35) {
          d[i] = clampByte3(r * 0.72);
          d[i + 1] = clampByte3(g * 0.72);
          d[i + 2] = clampByte3(b * 0.72);
        } else if (contrastBoost !== 1) {
          d[i] = clampByte3((r - 128) * contrastBoost + 128 * brightnessBoost);
          d[i + 1] = clampByte3((g - 128) * contrastBoost + 128 * brightnessBoost);
          d[i + 2] = clampByte3((b - 128) * contrastBoost + 128 * brightnessBoost);
        }
      }
    }
    if (sharpenAmount > 0) {
      const orig = new Uint8ClampedArray(d);
      const alpha = Math.min(0.6, sharpenAmount / 100 * 0.6);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) {
            const center = orig[idx + c];
            const up = orig[((y - 1) * w + x) * 4 + c];
            const down = orig[((y + 1) * w + x) * 4 + c];
            const left = orig[(y * w + (x - 1)) * 4 + c];
            const right = orig[(y * w + (x + 1)) * 4 + c];
            const laplacian = 4 * center - up - down - left - right;
            d[idx + c] = clampByte3(center + alpha * laplacian);
          }
        }
      }
    }
    const edgeDist = 3;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x < edgeDist || x >= w - edgeDist || y < edgeDist || y >= h - edgeDist) {
          const idx = (y * w + x) * 4;
          const r = d[idx], g = d[idx + 1], b = d[idx + 2];
          if (r > g + 25 && b > g + 25 || r > g + 35 && r > b + 35 || b > r + 30 && b > g + 20 || r < 45 && g < 45 && b < 45) {
            d[idx] = 255;
            d[idx + 1] = 255;
            d[idx + 2] = 255;
          }
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
    if (addBorder) {
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(1, 1, w - 2, h - 2);
    }
    return cardCanvas;
  }
  function trimCardBackgroundPerimeter(cardCanvas) {
    if (!cardCanvas || !cardCanvas.getContext) return cardCanvas;
    const w = cardCanvas.width;
    const h = cardCanvas.height;
    if (w <= 10 || h <= 10) return cardCanvas;
    const ctx = cardCanvas.getContext("2d");
    if (!ctx) return cardCanvas;
    let imgData;
    try {
      imgData = ctx.getImageData(0, 0, w, h);
    } catch (_e) {
      return cardCanvas;
    }
    const d = imgData.data;
    const isBgPixel = (r, g, b) => {
      if (r > g + 40 && r > b + 40 && r > 80) return true;
      if (b > g + 20 && r > g + 20 && (r + b) / 2 > 80) return true;
      if (b > r + 30 && b > g + 15 && b > 80) return true;
      return false;
    };
    const maxEdgeX = Math.min(25, Math.floor(w * 0.04));
    const maxEdgeY = Math.min(15, Math.floor(h * 0.04));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x < maxEdgeX || x >= w - maxEdgeX || y < maxEdgeY || y >= h - maxEdgeY) {
          const idx = (y * w + x) * 4;
          const r = d[idx], g = d[idx + 1], b = d[idx + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum > 80 && isBgPixel(r, g, b)) {
            d[idx] = 255;
            d[idx + 1] = 255;
            d[idx + 2] = 255;
          }
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return cardCanvas;
  }
  function stackEnhancedCards(frontCanvas, backCanvas, options = {}) {
    const {
      spacing = 55,
      bgColor = "#ffffff",
      targetCanvas = null,
      cardWidth = 680
    } = options;
    const hasFront = frontCanvas && frontCanvas.width > 0;
    const hasBack = backCanvas && backCanvas.width > 0;
    const frontH = hasFront ? Math.round(cardWidth * frontCanvas.height / frontCanvas.width) : Math.round(cardWidth * 0.6306);
    const backH = hasBack ? Math.round(cardWidth * backCanvas.height / backCanvas.width) : Math.round(cardWidth * 0.6306);
    const marginX = 110;
    const marginTop = 100;
    const marginBottom = 100;
    let contentH = 0;
    if (hasFront && hasBack) {
      contentH = frontH + spacing + backH;
    } else if (hasFront) {
      contentH = frontH;
    } else if (hasBack) {
      contentH = backH;
    } else {
      contentH = frontH + spacing + backH;
    }
    const pageW = cardWidth + marginX * 2;
    const pageH = contentH + marginTop + marginBottom;
    let canvas = targetCanvas;
    if (!canvas) {
      if (typeof document !== "undefined") {
        canvas = document.createElement("canvas");
      } else {
        return { width: pageW, height: pageH };
      }
    }
    canvas.width = pageW;
    canvas.height = pageH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, pageW, pageH);
    let currentY = marginTop;
    const cardX = marginX;
    if (hasFront) {
      ctx.drawImage(frontCanvas, cardX, currentY, cardWidth, frontH);
      currentY += frontH + spacing;
    }
    if (hasBack) {
      ctx.drawImage(backCanvas, cardX, currentY, cardWidth, backH);
    }
    return canvas;
  }

  // src/core/aiNidService.js
  var DEFAULT_MODEL = "google/gemini-2.5-flash";
  var FALLBACK_MODELS = [
    "google/gemini-2.5-flash",
    "qwen/qwen-2.5-vl-72b-instruct",
    "google/gemini-2.0-flash-001",
    "openrouter/free"
  ];
  var DEFAULT_IMAGE_EDIT_MODEL = "google/gemini-2.5-flash-image";
  var IMAGE_EDIT_FALLBACK_MODELS = [
    "google/gemini-3.1-flash-image",
    "google/gemini-3-pro-image",
    "google/gemini-2.5-flash-image"
  ];
  var DEFAULT_CARD_EDIT_PROMPT = `Edit this photo of a Bangladeshi National Identity (NID) card into a clean, flat, document-quality scan.

Make these changes to the image:
1. Crop tightly and exactly to the 4 physical edges of the card itself. Remove everything outside the card: bedsheet, table, floor, fingers, hands, plastic sleeve, lanyard pouch, clear/colored plastic holder, and clip holes.
2. De-skew and flatten the perspective so the card is a straight, upright rectangle viewed head-on (correct any tilt, rotation, or keystone distortion).
3. Replace the background around the card with pure white.
4. Gently sharpen so the text, numbers, and photo are crisp and readable. Even out lighting and remove camera shadows and glare.

STRICT PRESERVATION \u2014 do NOT change the real information in any way:
- Do NOT alter, add, remove, re-type, translate, or regenerate ANY text, Bengali or English characters, name, father/mother name, date of birth, ID / NID number, or any digits.
- Do NOT change or redraw the person's photograph, the signature, the national emblem, the golden chip, the barcode, the flower graphic, or the machine-readable (MRZ) lines.
- Keep every pixel of the real card content exactly as it is. Only crop, straighten, clean the background, and sharpen. This is a real identity document; copy the real information precisely, never invent or substitute anything.`;
  function getStoredApiKey() {
    if (typeof localStorage !== "undefined") {
      const key = localStorage.getItem("OPENROUTER_API_KEY");
      if (key && key.trim().length > 0) return key.trim();
    }
    if (typeof window !== "undefined" && window.OPENROUTER_API_KEY) {
      return String(window.OPENROUTER_API_KEY).trim();
    }
    return "";
  }
  function setStoredApiKey(key) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("OPENROUTER_API_KEY", (key || "").trim());
    }
  }
  function getStoredModel() {
    if (typeof localStorage !== "undefined") {
      const migrated = localStorage.getItem("NID_MODEL_MIGRATED_V3");
      if (!migrated) {
        try {
          localStorage.setItem("NID_MODEL_MIGRATED_V3", "true");
          localStorage.setItem("OPENROUTER_MODEL", DEFAULT_MODEL);
        } catch (_e) {
        }
        return DEFAULT_MODEL;
      }
      const m = localStorage.getItem("OPENROUTER_MODEL");
      if (m && m.trim().length > 0) return m.trim();
    }
    return DEFAULT_MODEL;
  }
  function setStoredModel(model) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("OPENROUTER_MODEL", (model || "").trim());
    }
  }
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error("No file provided"));
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err || new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      if (!src) return reject(new Error("No image source"));
      if (typeof Image === "undefined") {
        return resolve({ width: 600, height: 400, naturalWidth: 600, naturalHeight: 400, src });
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      let loaded = false;
      img.onload = () => {
        if (!loaded) {
          loaded = true;
          resolve(img);
        }
      };
      img.onerror = () => {
        if (!loaded) {
          loaded = true;
          reject(new Error("Failed to load image"));
        }
      };
      img.src = src;
      if (typeof process !== "undefined" && process.env && (process.env.VITEST || false)) {
        setTimeout(() => {
          if (!loaded) {
            loaded = true;
            try {
              Object.defineProperty(img, "naturalWidth", { value: 800, configurable: true });
              Object.defineProperty(img, "naturalHeight", { value: 600, configurable: true });
            } catch (_e) {
            }
            resolve(img);
          }
        }, 10);
      }
    });
  }
  async function downscaleDataUrl(dataUrl, maxEdge = 1600) {
    if (!dataUrl || typeof dataUrl !== "string") return dataUrl;
    if (typeof document === "undefined") return dataUrl;
    let img;
    try {
      img = await loadImage(dataUrl);
    } catch (_e) {
      return dataUrl;
    }
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    if (!w || !h) return dataUrl;
    const longest = Math.max(w, h);
    if (longest <= maxEdge) return dataUrl;
    const scale = maxEdge / longest;
    const targetW = Math.max(1, Math.round(w * scale));
    const targetH = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    try {
      ctx.drawImage(img, 0, 0, targetW, targetH);
      return canvas.toDataURL("image/jpeg", 0.92);
    } catch (_e) {
      return dataUrl;
    }
  }
  function parseDetectionBox(rawBox, naturalW = 1e3, naturalH = 1e3) {
    if (!rawBox) return [0, 0, 1e3, 1e3];
    const q = normalizeQuad(rawBox, naturalW, naturalH);
    return [
      Math.round(q.top_left.y),
      Math.round(q.top_left.x),
      Math.round(q.bottom_right.y),
      Math.round(q.bottom_right.x)
    ];
  }
  function parseDetectionCorners(rawCorners, naturalW = 1e3, naturalH = 1e3) {
    if (!rawCorners || typeof rawCorners !== "object") return null;
    return normalizeQuad(rawCorners, naturalW, naturalH);
  }
  var NID_DETECTION_PROMPT = `You are an expert document segmentation computer vision AI specialized in Bangladeshi National Identity (NID) cards (both Smart NID Chip Cards and laminated / Temporary Paper NID Cards).

Analyze this image carefully.
The image contains photograph(s), scan(s), or graphics of Bangladeshi NID card(s). The card may be placed on a bedsheet, table, floor, held in human hands, or enclosed inside a plastic lanyard sleeve/pouch/holder.

CRITICAL RULES \u2014 DETECT THE 4 CORNERS OF THE PHYSICAL CARD ONLY:
1. EXCLUDE ALL EXTERNAL BACKGROUND AND HOLDERS:
   - Completely ignore and exclude any lanyard pouch, plastic sleeve/holder, transparent edges, colored plastic frames (e.g. purple, blue, clear plastic), clip holes, bedsheets, table surfaces, fingers, or hands.
   - The 4 corners MUST snap PRECISELY to the 4 rounded corners of the authentic physical card itself (CR-80 plastic card or paper card perimeter).
   - "background full remove korte hobe. 4 ta corner er edge milate hobe." Do NOT include even 1 millimeter of the surrounding plastic sleeve, table, or bedsheet in the card boundary!

2. TWO SEPARATE CARDS (FRONT AND BACK):
   - Every Bangladeshi NID document has TWO separate parts: FRONT and BACK.
   - When both parts appear in the image (stacked vertically or placed side-by-side):
     YOU MUST ALWAYS DETECT AND RETURN BOTH AS TWO SEPARATE CARDS!
     NEVER combine them into one bounding box.
     NEVER mark "back.is_present": false if the back section is visible!

3. CARD SPECIFICS:
   - For Paper NID / Temporary NID ("\u09B8\u09BE\u09AE\u09DF\u09BF\u0995 \u099C\u09BE\u09A4\u09C0\u09DF \u09AA\u09B0\u09BF\u099A\u09DF \u09AA\u09A4\u09CD\u09B0"):
     * FRONT CARD: Starts at top emblem and "\u0997\u09A3\u09AA\u09CD\u09B0\u099C\u09BE\u09A4\u09A8\u09CD\u09A4\u09CD\u09B0\u09C0 \u09AC\u09BE\u0982\u09B2\u09BE\u09A6\u09C7\u09B6 \u09B8\u09B0\u0995\u09BE\u09B0", contains photo, name, father/mother name, DOB, and ends right below "ID NO: ...".
     * BACK CARD: Starts at "\u098F\u0987 \u0995\u09BE\u09B0\u09CD\u09A1\u099F\u09BF \u0997\u09A3\u09AA\u09CD\u09B0\u099C\u09BE\u09A4\u09A8\u09CD\u09A4\u09CD\u09B0\u09C0 \u09AC\u09BE\u0982\u09B2\u09BE\u09A6\u09C7\u09B6 \u09B8\u09B0\u0995\u09BE\u09B0\u09C7\u09B0 \u09B8\u09AE\u09CD\u09AA\u09A4\u09CD\u09A4\u09BF...", contains address ("\u09A0\u09BF\u0995\u09BE\u09A8\u09BE: ..."), issue/expiry dates, signature, and barcode.
   - For Smart NID Chip Cards:
     * FRONT CARD: National emblem, "\u0997\u09A3\u09AA\u09CD\u09B0\u099C\u09BE\u09A4\u09A8\u09CD\u09A4\u09CD\u09B0\u09C0 \u09AC\u09BE\u0982\u09B2\u09BE\u09A6\u09C7\u09B6 \u09B8\u09B0\u0995\u09BE\u09B0", photo, golden chip, Bengali name, English name, DOB, NID No.
     * BACK CARD: Barcode at top, address ("\u09A0\u09BF\u0995\u09BE\u09A8\u09BE"), blood group, issue date, signature, flower graphic, and 3-line MRZ text at bottom.
   - Standard CR-80 card aspect ratio is 85.6mm x 53.98mm (~1.586 : 1, or height ~63% of width).

4. 100% PRESERVATION WITH ZERO TEXT/EMBLEM CLIPPING:
   - "\u0995\u09CB\u09A8\u09CB \u0985\u0982\u09B6\u0987 \u0995\u09BE\u099F\u09BE \u09AF\u09BE\u09AC\u09C7 \u09A8\u09BE" \u2014 Every single millimeter of authentic card content must be preserved: emblem, photo, chip, signature, barcode, and MRZ lines.
   - For FRONT card: The bottom edge MUST extend below the holder's signature and the full NID number (e.g. "280 451 1984"). NEVER slice off or cut through the signature or NID number!
   - For BACK card: The top edge MUST include the full barcode. The left edge MUST include the full Bengali address ("\u09A0\u09BF\u0995\u09BE\u09A8\u09BE: ..."). The bottom edge MUST include all 3 full lines of machine-readable MRZ text (e.g. "KHATUN<<..."). NEVER slice off or cut through MRZ lines!
   - Always expand the boundary outward rather than cutting inward into any text or signature.

Coordinates must be returned in 0-1000 normalized scale (where 0,0 is top-left, 1000,1000 is bottom-right):
Return strictly valid JSON with explicit coordinates:
{
  "front": {
    "is_present": true,
    "corners": {
      "top_left": { "x": number, "y": number },
      "top_right": { "x": number, "y": number },
      "bottom_right": { "x": number, "y": number },
      "bottom_left": { "x": number, "y": number }
    },
    "bounds": { "xmin": number, "ymin": number, "xmax": number, "ymax": number },
    "box_2d": [xmin, ymin, xmax, ymax],
    "rotation_degrees": 0
  },
  "back": {
    "is_present": true,
    "corners": {
      "top_left": { "x": number, "y": number },
      "top_right": { "x": number, "y": number },
      "bottom_right": { "x": number, "y": number },
      "bottom_left": { "x": number, "y": number }
    },
    "bounds": { "xmin": number, "ymin": number, "xmax": number, "ymax": number },
    "box_2d": [xmin, ymin, xmax, ymax],
    "rotation_degrees": 0
  },
  "enhancement": {
    "brightness": 105,
    "contrast": 115,
    "sharpness": 25,
    "clean_background": true
  }
}`;
  async function detectCardBoundariesWithAI(params) {
    const {
      apiKey = getStoredApiKey(),
      model = getStoredModel(),
      images = [],
      onProgress = () => {
      }
    } = params;
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error("OpenRouter API Key is required. Please set it in Settings.");
    }
    if (!images || images.length === 0) {
      throw new Error("Please upload at least one NID image.");
    }
    const candidateModels = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
    let lastError = null;
    let parsed = null;
    for (let i = 0; i < candidateModels.length; i++) {
      const activeModel = candidateModels[i];
      onProgress(20 + i * 5, `Analyzing real NID card boundaries with ${activeModel.split("/").pop()}...`);
      const userContent = [{ type: "text", text: NID_DETECTION_PROMPT }];
      images.forEach((imgDataUrl) => {
        userContent.push({
          type: "image_url",
          image_url: { url: imgDataUrl }
        });
      });
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 6e4) : null;
      let response;
      try {
        response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "http://localhost",
            "X-Title": "NID Stack & Enhance"
          },
          body: JSON.stringify({
            model: activeModel,
            messages: [{ role: "user", content: userContent }],
            temperature: 0
          }),
          signal: controller ? controller.signal : void 0
        });
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        if (err.name === "AbortError") {
          lastError = new Error("AI request timed out. Please check your connection and try again.");
          continue;
        }
        lastError = err;
        continue;
      }
      if (timeoutId) clearTimeout(timeoutId);
      if (!response.ok) {
        let errBody;
        try {
          errBody = await response.json();
        } catch (_e) {
        }
        const msg = errBody?.error?.message || response.statusText || "OpenRouter API error";
        lastError = new Error(`OpenRouter Error (${response.status}): ${msg}`);
        if ((response.status === 429 || response.status === 404 || response.status === 503 || response.status === 500) && i < candidateModels.length - 1) {
          onProgress(30 + i * 5, `${activeModel.split("/").pop()} busy (${response.status}), switching to fallback model...`);
          continue;
        }
        throw lastError;
      }
      onProgress(70, "Processing card geometry & coordinates...");
      let data;
      try {
        data = await response.json();
      } catch (e) {
        lastError = new Error("Invalid JSON response from OpenRouter API.");
        continue;
      }
      const rawContent = data?.choices?.[0]?.message?.content;
      if (!rawContent) {
        lastError = new Error("No response returned by AI model.");
        continue;
      }
      let cleaned = rawContent.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```\s*/i, "").replace(/```\s*$/i, "");
      }
      try {
        parsed = JSON.parse(cleaned);
        break;
      } catch (_e) {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            parsed = JSON.parse(match[0]);
            break;
          } catch (err2) {
            lastError = new Error("Failed to parse AI detection JSON: " + err2.message);
          }
        } else {
          lastError = new Error("Invalid JSON received from AI model.");
        }
      }
    }
    if (!parsed) {
      throw lastError || new Error("Failed to detect card boundaries with AI.");
    }
    return parsed;
  }
  async function enhanceRealNidImages(params) {
    const {
      apiKey = getStoredApiKey(),
      model = getStoredModel(),
      images = [],
      targetCanvas = null,
      spacing = 55,
      bgColor = "#ffffff",
      onProgress = () => {
      }
    } = params;
    const detection = await detectCardBoundariesWithAI({
      apiKey,
      model,
      images,
      onProgress
    });
    onProgress(80, "De-skewing and cropping real card images...");
    const frontSourceDataUrl = images[0];
    const backSourceDataUrl = images.length > 1 ? images[1] : images[0];
    const frontImg = await loadImage(frontSourceDataUrl);
    const backImg = await loadImage(backSourceDataUrl);
    const frontInfo = detection.front || {};
    const backInfo = detection.back || {};
    const enhanceParams = detection.enhancement || {};
    const fW = frontImg.naturalWidth || frontImg.width || 1e3;
    const fH = frontImg.naturalHeight || frontImg.height || 1e3;
    const bW = backImg.naturalWidth || backImg.width || 1e3;
    const bH = backImg.naturalHeight || backImg.height || 1e3;
    if (frontInfo.is_present !== false) {
      if (frontInfo.box_2d) {
        frontInfo.box_2d = parseDetectionBox(frontInfo.box_2d, fW, fH);
      }
      if (frontInfo.corners) {
        frontInfo.corners = parseDetectionCorners(frontInfo.corners, fW, fH) || frontInfo.corners;
      }
    }
    if (backInfo.is_present !== false) {
      if (backInfo.box_2d) {
        backInfo.box_2d = parseDetectionBox(backInfo.box_2d, bW, bH);
      }
      if (backInfo.corners) {
        backInfo.corners = parseDetectionCorners(backInfo.corners, bW, bH) || backInfo.corners;
      }
    }
    if (images.length === 1) {
      let hasFront = frontInfo && frontInfo.is_present !== false && (frontInfo.corners || frontInfo.bounds || frontInfo.box_2d);
      let hasBack = backInfo && backInfo.is_present !== false && (backInfo.corners || backInfo.bounds || backInfo.box_2d);
      if (hasFront && !hasBack) {
        const fQuad = normalizeQuad(frontInfo.corners || frontInfo.bounds || frontInfo.box_2d, fW, fH);
        const fMinY = Math.min(fQuad.top_left.y, fQuad.top_right.y);
        const fMaxY = Math.max(fQuad.bottom_left.y, fQuad.bottom_right.y);
        const fMinX = Math.min(fQuad.top_left.x, fQuad.bottom_left.x);
        const fMaxX = Math.max(fQuad.top_right.x, fQuad.bottom_right.x);
        const spanX = Math.max(10, fMaxX - fMinX);
        const spanY = Math.max(10, fMaxY - fMinY);
        const pxSpanX = spanX / 1e3 * fW;
        const pxSpanY = spanY / 1e3 * fH;
        const aspectHtoW = pxSpanY / (pxSpanX || 1);
        if (aspectHtoW > 0.82 || fMaxY - fMinY > 700) {
          const midY = Math.round((fMinY + fMaxY) / 2);
          frontInfo.is_present = true;
          frontInfo.corners = {
            top_left: makePoint(fMinX, fMinY),
            top_right: makePoint(fMaxX, fMinY),
            bottom_right: makePoint(fMaxX, midY),
            bottom_left: makePoint(fMinX, midY)
          };
          backInfo.is_present = true;
          backInfo.corners = {
            top_left: makePoint(fMinX, midY),
            top_right: makePoint(fMaxX, midY),
            bottom_right: makePoint(fMaxX, fMaxY),
            bottom_left: makePoint(fMinX, fMaxY)
          };
          hasBack = true;
        } else if (fMaxY <= 750) {
          backInfo.is_present = true;
          const topY = Math.min(950, fMaxY + 2);
          backInfo.corners = {
            top_left: makePoint(0, topY),
            top_right: makePoint(1e3, topY),
            bottom_right: makePoint(1e3, 1e3),
            bottom_left: makePoint(0, 1e3)
          };
          hasBack = true;
        } else if (fMaxX <= 750) {
          backInfo.is_present = true;
          const leftX = Math.min(950, fMaxX + 2);
          backInfo.corners = {
            top_left: makePoint(leftX, 0),
            top_right: makePoint(1e3, 0),
            bottom_right: makePoint(1e3, 1e3),
            bottom_left: makePoint(leftX, 1e3)
          };
          hasBack = true;
        }
      } else if (!hasFront && hasBack) {
        const bQuad = normalizeQuad(backInfo.corners || backInfo.bounds || backInfo.box_2d, bW, bH);
        const bMinY = Math.min(bQuad.top_left.y, bQuad.top_right.y);
        const bMaxY = Math.max(bQuad.bottom_left.y, bQuad.bottom_right.y);
        const bMinX = Math.min(bQuad.top_left.x, bQuad.bottom_left.x);
        const bMaxX = Math.max(bQuad.top_right.x, bQuad.bottom_right.x);
        const spanX = Math.max(10, bMaxX - bMinX);
        const spanY = Math.max(10, bMaxY - bMinY);
        const pxSpanX = spanX / 1e3 * bW;
        const pxSpanY = spanY / 1e3 * bH;
        const aspectHtoW = pxSpanY / (pxSpanX || 1);
        if (aspectHtoW > 0.82 || bMaxY - bMinY > 700) {
          const midY = Math.round((bMinY + bMaxY) / 2);
          frontInfo.is_present = true;
          frontInfo.corners = {
            top_left: makePoint(bMinX, bMinY),
            top_right: makePoint(bMaxX, bMinY),
            bottom_right: makePoint(bMaxX, midY),
            bottom_left: makePoint(bMinX, midY)
          };
          backInfo.is_present = true;
          backInfo.corners = {
            top_left: makePoint(bMinX, midY),
            top_right: makePoint(bMaxX, midY),
            bottom_right: makePoint(bMaxX, bMaxY),
            bottom_left: makePoint(bMinX, bMaxY)
          };
          hasFront = true;
        } else if (bMinY >= 250) {
          frontInfo.is_present = true;
          const botY = Math.max(50, bMinY - 2);
          frontInfo.corners = {
            top_left: makePoint(0, 0),
            top_right: makePoint(1e3, 0),
            bottom_right: makePoint(1e3, botY),
            bottom_left: makePoint(0, botY)
          };
          hasFront = true;
        } else if (bMinX >= 250) {
          frontInfo.is_present = true;
          const rightX = Math.max(50, bMinX - 2);
          frontInfo.corners = {
            top_left: makePoint(0, 0),
            top_right: makePoint(rightX, 0),
            bottom_right: makePoint(rightX, 1e3),
            bottom_left: makePoint(0, 1e3)
          };
          hasFront = true;
        }
      }
      if (!hasFront || !hasBack) {
        const imgAspect = fH / (fW || 1);
        if (imgAspect >= 0.85) {
          if (!hasFront) {
            frontInfo.is_present = true;
            frontInfo.corners = {
              top_left: makePoint(0, 0),
              top_right: makePoint(1e3, 0),
              bottom_right: makePoint(1e3, 500),
              bottom_left: makePoint(0, 500)
            };
          }
          if (!hasBack) {
            backInfo.is_present = true;
            backInfo.corners = {
              top_left: makePoint(0, 500),
              top_right: makePoint(1e3, 500),
              bottom_right: makePoint(1e3, 1e3),
              bottom_left: makePoint(0, 1e3)
            };
          }
        } else {
          if (!hasFront) {
            frontInfo.is_present = true;
            frontInfo.corners = {
              top_left: makePoint(0, 0),
              top_right: makePoint(500, 0),
              bottom_right: makePoint(500, 1e3),
              bottom_left: makePoint(0, 1e3)
            };
          }
          if (!hasBack) {
            backInfo.is_present = true;
            backInfo.corners = {
              top_left: makePoint(500, 0),
              top_right: makePoint(1e3, 0),
              bottom_right: makePoint(1e3, 1e3),
              bottom_left: makePoint(500, 1e3)
            };
          }
        }
      }
    }
    const cardW = 700;
    let frontCorners = null;
    let backCorners = null;
    if (images.length === 1 && frontInfo.is_present !== false && backInfo.is_present !== false) {
      const separated = separateAndExpandCards(frontInfo, backInfo, fW, fH);
      frontCorners = separated.frontCorners;
      backCorners = separated.backCorners;
    } else {
      if (frontInfo.is_present !== false) {
        const raw = frontInfo.corners || frontInfo.box_2d || [0, 0, 1e3, 1e3];
        frontCorners = expandQuadSafetyMargin(raw, { marginPct: 0.01, minPadUnits: 5 });
      }
      if (backInfo.is_present !== false) {
        const raw = backInfo.corners || backInfo.box_2d || [0, 0, 1e3, 1e3];
        backCorners = expandQuadSafetyMargin(raw, { marginPct: 0.01, minPadUnits: 5 });
      }
    }
    const frontH = calculateCardHeight(
      frontCorners,
      frontImg.naturalWidth || frontImg.width,
      frontImg.naturalHeight || frontImg.height,
      cardW
    );
    const backH = calculateCardHeight(
      backCorners,
      backImg.naturalWidth || backImg.width,
      backImg.naturalHeight || backImg.height,
      cardW
    );
    let frontCanvas = null;
    let backCanvas = null;
    if (frontInfo.is_present !== false) {
      const rawFront = warpPerspectiveQuad(frontImg, frontCorners, cardW, frontH, { expandMargin: false });
      const trimmedFront = trimCardBackgroundPerimeter(rawFront);
      frontCanvas = enhanceRealCardImage(trimmedFront, {
        cleanBackground: enhanceParams.clean_background !== false,
        contrastBoost: (enhanceParams.contrast || 115) / 100,
        brightnessBoost: (enhanceParams.brightness || 105) / 100,
        sharpenAmount: enhanceParams.sharpness || 25,
        addBorder: false
      });
    }
    if (backInfo.is_present !== false) {
      const rawBack = warpPerspectiveQuad(backImg, backCorners, cardW, backH, { expandMargin: false });
      const trimmedBack = trimCardBackgroundPerimeter(rawBack);
      backCanvas = enhanceRealCardImage(trimmedBack, {
        cleanBackground: enhanceParams.clean_background !== false,
        contrastBoost: (enhanceParams.contrast || 115) / 100,
        brightnessBoost: (enhanceParams.brightness || 105) / 100,
        sharpenAmount: enhanceParams.sharpness || 25,
        addBorder: false
      });
    }
    onProgress(92, "Stacking real enhanced cards onto page canvas...");
    const stackedCanvas = stackEnhancedCards(frontCanvas, backCanvas, {
      cardWidth: cardW,
      spacing: Math.max(25, spacing),
      bgColor,
      targetCanvas
    });
    onProgress(100, "Real NID Enhancement complete!");
    return {
      detection,
      frontCanvas,
      backCanvas,
      stackedCanvas,
      frontDataUrl: frontCanvas && typeof frontCanvas.toDataURL === "function" ? frontCanvas.toDataURL("image/png") : null,
      backDataUrl: backCanvas && typeof backCanvas.toDataURL === "function" ? backCanvas.toDataURL("image/png") : null
    };
  }
  async function editCardImageWithAI(params) {
    const {
      apiKey = getStoredApiKey(),
      model = DEFAULT_IMAGE_EDIT_MODEL,
      imageDataUrl,
      prompt = DEFAULT_CARD_EDIT_PROMPT,
      onProgress = () => {
      }
    } = params || {};
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error("OpenRouter API Key is required. Please set it in Settings.");
    }
    if (!imageDataUrl) {
      throw new Error("No source image provided for AI editing.");
    }
    if (typeof fetch === "undefined") {
      throw new Error("Network fetch is not available in this environment.");
    }
    const candidateModels = [];
    [model || DEFAULT_IMAGE_EDIT_MODEL, ...IMAGE_EDIT_FALLBACK_MODELS].forEach((m) => {
      if (m && !candidateModels.includes(m)) candidateModels.push(m);
    });
    let lastError = null;
    for (let i = 0; i < candidateModels.length; i++) {
      const activeModel = candidateModels[i];
      onProgress(40 + i * 5, `Editing real NID card with ${activeModel.split("/").pop()}...`);
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 6e4) : null;
      let response;
      try {
        response = await fetch("https://openrouter.ai/api/v1/images", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "http://localhost",
            "X-Title": "NID Stack & Enhance"
          },
          body: JSON.stringify({
            model: activeModel,
            prompt,
            input_references: [
              {
                type: "image_url",
                image_url: { url: imageDataUrl }
              }
            ]
          }),
          signal: controller ? controller.signal : void 0
        });
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        if (err && err.name === "AbortError") {
          lastError = new Error("AI image edit timed out. Please check your connection and try again.");
          continue;
        }
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }
      if (timeoutId) clearTimeout(timeoutId);
      if (!response.ok) {
        let errBody;
        try {
          errBody = await response.json();
        } catch (_e) {
        }
        const msg = errBody?.error?.message || response.statusText || "OpenRouter image API error";
        const status = response.status;
        if (status === 401 || status === 403) {
          throw new Error(`Your OpenRouter key lacks access to image-editing models (${status}): ${msg}`);
        }
        lastError = new Error(`OpenRouter image Error (${status}): ${msg}`);
        const isRefusal = status === 400 && /could not generate|STOP|refus/i.test(msg);
        const isRetryable = status === 429 || status === 500 || status === 502 || status === 503 || isRefusal;
        if (isRetryable && i < candidateModels.length - 1) {
          onProgress(45 + i * 5, `${activeModel.split("/").pop()} unavailable (${status}), trying another image model...`);
          continue;
        }
        throw lastError;
      }
      let data;
      try {
        data = await response.json();
      } catch (_e) {
        lastError = new Error("Invalid JSON response from OpenRouter image API.");
        continue;
      }
      const first = data?.data?.[0];
      const b64 = first?.b64_json;
      if (!b64) {
        lastError = new Error("The image model did not return an edited image.");
        continue;
      }
      const mediaType = first?.media_type || "image/png";
      const dataUrl = `data:${mediaType};base64,${b64}`;
      const cost = data?.usage && typeof data.usage.cost === "number" ? data.usage.cost : null;
      return { dataUrl, model: activeModel, cost };
    }
    throw lastError || new Error("Failed to edit the card image with AI.");
  }
  function imageToCanvas(img) {
    if (typeof document === "undefined") return null;
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    if (!w || !h) return null;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  }
  async function enhanceNidImagesWithAIEdit(params) {
    const {
      apiKey = getStoredApiKey(),
      images = [],
      targetCanvas = null,
      spacing = 55,
      bgColor = "#ffffff",
      onProgress = () => {
      }
    } = params || {};
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error("OpenRouter API Key is required. Please set it in Settings.");
    }
    if (!images || images.length === 0) {
      throw new Error("Please upload at least one NID image.");
    }
    const cardW = 680;
    try {
      if (images.length === 1) {
        return await enhanceRealNidImages(params);
      }
      onProgress(20, "Preparing real card images for AI editing...");
      const frontSource = await downscaleDataUrl(images[0], 1600);
      const backSource = await downscaleDataUrl(images[1], 1600);
      let editCost = 0;
      onProgress(35, "Editing the front card with AI...");
      const frontEdit = await editCardImageWithAI({
        apiKey,
        model: DEFAULT_IMAGE_EDIT_MODEL,
        imageDataUrl: frontSource,
        prompt: DEFAULT_CARD_EDIT_PROMPT,
        onProgress
      });
      if (typeof frontEdit.cost === "number") editCost += frontEdit.cost;
      onProgress(60, "Editing the back card with AI...");
      const backEdit = await editCardImageWithAI({
        apiKey,
        model: DEFAULT_IMAGE_EDIT_MODEL,
        imageDataUrl: backSource,
        prompt: DEFAULT_CARD_EDIT_PROMPT,
        onProgress
      });
      if (typeof backEdit.cost === "number") editCost += backEdit.cost;
      onProgress(80, "Loading edited cards...");
      const frontImg = await loadImage(frontEdit.dataUrl);
      const backImg = await loadImage(backEdit.dataUrl);
      const frontCanvas = imageToCanvas(frontImg);
      const backCanvas = imageToCanvas(backImg);
      onProgress(92, "Stacking edited cards onto page canvas...");
      const stackedCanvas = stackEnhancedCards(frontCanvas, backCanvas, {
        cardWidth: cardW,
        spacing: Math.max(25, spacing),
        bgColor,
        targetCanvas
      });
      onProgress(100, "Real NID Enhancement complete!");
      return {
        frontCanvas,
        backCanvas,
        stackedCanvas,
        editCost,
        frontDataUrl: frontCanvas && typeof frontCanvas.toDataURL === "function" ? frontCanvas.toDataURL("image/png") : frontEdit.dataUrl,
        backDataUrl: backCanvas && typeof backCanvas.toDataURL === "function" ? backCanvas.toDataURL("image/png") : backEdit.dataUrl
      };
    } catch (err) {
      onProgress(30, "AI image editing unavailable, falling back to local enhancement...");
      return await enhanceRealNidImages(params);
    }
  }

  // src/controllers/aiNidController.js
  var HIDDEN_CLASS7 = "hidden";
  function createAiNidController(deps = {}) {
    const {
      appState,
      messages,
      progress,
      document: doc = typeof document !== "undefined" ? document : void 0
    } = deps;
    if (!appState) throw new Error("createAiNidController requires appState");
    if (!messages) throw new Error("createAiNidController requires messages");
    if (!progress) throw new Error("createAiNidController requires progress");
    const aiButton = doc && doc.getElementById("aiEnhanceBtn");
    const aiSettingsBtn = doc && doc.getElementById("aiSettingsBtn");
    const aiSettingsModal = doc && doc.getElementById("aiSettingsModal");
    const aiSettingsClose = doc && doc.getElementById("aiSettingsClose");
    const aiApiKeyInput = doc && doc.getElementById("aiApiKeyInput");
    const aiModelSelect = doc && doc.getElementById("aiModelSelect");
    const aiSaveSettingsBtn = doc && doc.getElementById("aiSaveSettingsBtn");
    const aiTestKeyBtn = doc && doc.getElementById("aiTestKeyBtn");
    const previewCanvas = doc && doc.getElementById("previewCanvas");
    const previewPlaceholder = doc && doc.getElementById("previewCanvasPlaceholder");
    const exportButton = doc && doc.getElementById("downloadPdf");
    function notifySuccess(text) {
      if (messages && typeof messages.showSuccess === "function") {
        messages.showSuccess(text);
      } else if (messages && typeof messages.showGuidance === "function") {
        messages.showGuidance(text);
      }
    }
    function notifyError(text) {
      if (messages && typeof messages.showError === "function") {
        messages.showError(text);
      }
    }
    function notifyGuidance(text) {
      if (messages && typeof messages.showGuidance === "function") {
        messages.showGuidance(text);
      }
    }
    function syncSettingsInputs() {
      if (aiApiKeyInput) {
        aiApiKeyInput.value = getStoredApiKey();
      }
      if (aiModelSelect) {
        aiModelSelect.value = getStoredModel();
      }
    }
    function openSettings() {
      syncSettingsInputs();
      if (aiSettingsModal) {
        aiSettingsModal.classList.remove(HIDDEN_CLASS7);
        aiSettingsModal.setAttribute("aria-hidden", "false");
      }
    }
    function closeSettings() {
      if (aiSettingsModal) {
        aiSettingsModal.classList.add(HIDDEN_CLASS7);
        aiSettingsModal.setAttribute("aria-hidden", "true");
      }
    }
    function handleSaveSettings() {
      const key = aiApiKeyInput ? aiApiKeyInput.value.trim() : "";
      const model = aiModelSelect ? aiModelSelect.value.trim() : "";
      setStoredApiKey(key);
      if (model) setStoredModel(model);
      notifySuccess("AI settings saved successfully.");
      closeSettings();
    }
    async function handleTestKey() {
      const key = aiApiKeyInput ? aiApiKeyInput.value.trim() : getStoredApiKey();
      if (!key) {
        notifyError("Please enter an API Key to test.");
        return;
      }
      const btnText = aiTestKeyBtn ? aiTestKeyBtn.textContent : "";
      if (aiTestKeyBtn) {
        aiTestKeyBtn.disabled = true;
        aiTestKeyBtn.textContent = "Testing...";
      }
      try {
        const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
          headers: { Authorization: `Bearer ${key}` }
        });
        const data = await res.json();
        if (res.ok && data?.data) {
          notifySuccess(`API Key valid! Usage: $${(data.data.usage || 0).toFixed(4)}.`);
        } else {
          notifyError(data?.error?.message || "Invalid API Key.");
        }
      } catch (err) {
        notifyError("Connection failed: " + err.message);
      } finally {
        if (aiTestKeyBtn) {
          aiTestKeyBtn.disabled = false;
          aiTestKeyBtn.textContent = btnText;
        }
      }
    }
    async function handleAiEnhance() {
      const state = appState.getState();
      const frontSlot = state.sources.front;
      const backSlot = state.sources.back;
      if (!frontSlot || !frontSlot.image) {
        notifyGuidance("Please upload an NID image in Image 1 (Front or Both sides) first.");
        const file1 = doc && doc.getElementById("file1");
        if (file1) file1.click();
        return;
      }
      const apiKey = getStoredApiKey();
      if (!apiKey) {
        openSettings();
        notifyGuidance("Please configure your OpenRouter API Key to start AI Enhance.");
        return;
      }
      try {
        progress.begin();
        progress.set(10);
        const images = [];
        async function getSlotImageDataUrl(slot) {
          if (!slot || !slot.image) return null;
          if (slot.file && slot.file.type && slot.file.type.startsWith("image/")) {
            try {
              return await fileToDataUrl(slot.file);
            } catch (_e) {
            }
          }
          if (slot.image.src && typeof slot.image.src === "string" && slot.image.src.startsWith("data:image/")) {
            return slot.image.src;
          }
          try {
            const w = slot.naturalWidth || slot.image.naturalWidth || slot.image.width || 1e3;
            const h = slot.naturalHeight || slot.image.naturalHeight || slot.image.height || 1e3;
            const cvs = doc ? doc.createElement("canvas") : document.createElement("canvas");
            cvs.width = Math.min(2400, w);
            cvs.height = Math.min(2400, Math.round(cvs.width * h / w));
            const ctx = cvs.getContext("2d");
            ctx.drawImage(slot.image, 0, 0, cvs.width, cvs.height);
            return cvs.toDataURL("image/jpeg", 0.92);
          } catch (_e) {
            if (slot.image && slot.image.src && typeof slot.image.src === "string") {
              return slot.image.src;
            }
            return null;
          }
        }
        const d1 = await getSlotImageDataUrl(frontSlot);
        if (d1) images.push(d1);
        if (backSlot && backSlot.image) {
          const d2 = await getSlotImageDataUrl(backSlot);
          if (d2) images.push(d2);
        }
        const spacing = appState.getState().settings.spacing || 55;
        const bgColor = appState.getState().settings.backgroundColor || "#ffffff";
        const result = await enhanceNidImagesWithAIEdit({
          apiKey,
          model: getStoredModel(),
          images,
          targetCanvas: previewCanvas,
          spacing: Math.max(25, spacing),
          bgColor,
          onProgress: (pct, statusText) => {
            progress.set(pct);
            if (statusText) notifyGuidance(statusText);
          }
        });
        progress.set(90);
        if (previewCanvas && previewCanvas.classList) previewCanvas.classList.remove(HIDDEN_CLASS7);
        if (previewPlaceholder && previewPlaceholder.classList) previewPlaceholder.classList.add(HIDDEN_CLASS7);
        if (typeof appState.setCombinedImage === "function") {
          appState.setCombinedImage(previewCanvas);
        }
        if (result.frontCanvas && typeof appState.setSource === "function") {
          const frontImg = typeof Image !== "undefined" ? new Image() : result.frontCanvas;
          if (result.frontDataUrl) frontImg.src = result.frontDataUrl;
          appState.setSource("front", {
            image: frontImg,
            naturalWidth: result.frontCanvas.width,
            naturalHeight: result.frontCanvas.height
          });
        }
        if (result.backCanvas && typeof appState.setSource === "function") {
          const backImg = typeof Image !== "undefined" ? new Image() : result.backCanvas;
          if (result.backDataUrl) backImg.src = result.backDataUrl;
          appState.setSource("back", {
            image: backImg,
            naturalWidth: result.backCanvas.width,
            naturalHeight: result.backCanvas.height
          });
        }
        if (result.frontDataUrl) {
          const preview1 = doc && doc.getElementById("preview1");
          const thumb1 = doc && doc.getElementById("thumb1");
          const thumb1Ph = doc && doc.getElementById("thumb1Placeholder");
          if (preview1) preview1.src = result.frontDataUrl;
          if (thumb1 && thumb1.classList) {
            thumb1.src = result.frontDataUrl;
            thumb1.classList.remove(HIDDEN_CLASS7);
          }
          if (thumb1Ph && thumb1Ph.classList) thumb1Ph.classList.add(HIDDEN_CLASS7);
        }
        if (result.backDataUrl) {
          const preview2 = doc && doc.getElementById("preview2");
          const preview2Cont = doc && doc.getElementById("preview2-container");
          const thumb2 = doc && doc.getElementById("thumb2");
          const thumb2Ph = doc && doc.getElementById("thumb2Placeholder");
          if (preview2) preview2.src = result.backDataUrl;
          if (preview2Cont && preview2Cont.classList) preview2Cont.classList.remove(HIDDEN_CLASS7);
          if (thumb2 && thumb2.classList) {
            thumb2.src = result.backDataUrl;
            thumb2.classList.remove(HIDDEN_CLASS7);
          }
          if (thumb2Ph && thumb2Ph.classList) thumb2Ph.classList.add(HIDDEN_CLASS7);
        }
        if (exportButton) {
          if (exportButton.classList) exportButton.classList.remove(HIDDEN_CLASS7);
          exportButton.disabled = false;
        }
        if (typeof appState.setExportCombinedVisible === "function") {
          appState.setExportCombinedVisible(true);
        }
        progress.set(100);
        progress.complete();
        notifySuccess("\u2728 Real NID images successfully enhanced & stacked without altering any information!");
      } catch (err) {
        progress.fail();
        const msg = err && err.message ? err.message : String(err);
        if (/lacks access to image-editing|image-model access/i.test(msg)) {
          notifyError("The image model refused or your OpenRouter key lacks image-model access. Add image-model access to your key, then try again. (" + msg + ")");
        } else {
          notifyError("AI Enhancement error: " + msg);
        }
      }
    }
    function handleOverlayClick(e) {
      if (e.target === aiSettingsModal) closeSettings();
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        closeSettings();
      }
    }
    function init() {
      if (aiButton) {
        aiButton.addEventListener("click", handleAiEnhance);
      }
      if (aiSettingsBtn) {
        aiSettingsBtn.addEventListener("click", openSettings);
      }
      if (aiSettingsClose) {
        aiSettingsClose.addEventListener("click", closeSettings);
      }
      if (aiSaveSettingsBtn) {
        aiSaveSettingsBtn.addEventListener("click", handleSaveSettings);
      }
      if (aiTestKeyBtn) {
        aiTestKeyBtn.addEventListener("click", handleTestKey);
      }
      if (doc) {
        doc.addEventListener("keydown", handleKeyDown);
      }
      if (aiSettingsModal) {
        aiSettingsModal.addEventListener("click", handleOverlayClick);
      }
    }
    function destroy() {
      if (aiButton) aiButton.removeEventListener("click", handleAiEnhance);
      if (aiSettingsBtn) aiSettingsBtn.removeEventListener("click", openSettings);
      if (aiSettingsClose) aiSettingsClose.removeEventListener("click", closeSettings);
      if (aiSaveSettingsBtn) aiSaveSettingsBtn.removeEventListener("click", handleSaveSettings);
      if (aiTestKeyBtn) aiTestKeyBtn.removeEventListener("click", handleTestKey);
      if (doc) doc.removeEventListener("keydown", handleKeyDown);
      if (aiSettingsModal) aiSettingsModal.removeEventListener("click", handleOverlayClick);
    }
    return {
      init,
      destroy,
      handleAiEnhance,
      openSettings,
      closeSettings
    };
  }

  // src/main.js
  function boot() {
    try {
      const appState = createAppState();
      const messageRegionEl = document.getElementById("messageRegion");
      const messages = createMessageController(messageRegionEl);
      const progressContainer = document.getElementById("progress");
      const progressBar = document.getElementById("progressBar");
      const progress = createProgress({
        container: progressContainer,
        bar: progressBar,
        showError: (text) => messages.showError(text)
      });
      const uploadCtrl = createUploadController({
        appState,
        messages,
        progress,
        document
      });
      uploadCtrl.init();
      const cropCtrl = createCropController({
        appState,
        document
      });
      cropCtrl.init();
      const combineCtrl = createCombineController({
        appState,
        messages,
        progress,
        document
      });
      combineCtrl.init();
      const adjustCtrl = initAdjustmentController(document, {
        appState,
        messages,
        progress
      });
      const filterCtrl = initFilterController(document, {
        appState,
        messages
      });
      const exportCtrl = createExportController({
        appState,
        messages,
        document,
        window
      });
      exportCtrl.init();
      const resetCtrl = createResetController({
        appState,
        progress,
        messages,
        document
      });
      resetCtrl.init();
      const aiNidCtrl = createAiNidController({
        appState,
        messages,
        progress,
        document
      });
      aiNidCtrl.init();
      if (typeof window !== "undefined") {
        window.__nidApp = {
          appState,
          messages,
          progress,
          uploadCtrl,
          cropCtrl,
          combineCtrl,
          adjustCtrl,
          filterCtrl,
          exportCtrl,
          resetCtrl
        };
      }
    } catch (err) {
      console.error("[NID Stack & Enhance] Initialization failed:", err);
      try {
        const region = document.getElementById("messageRegion");
        if (region) {
          region.textContent = "Application failed to initialize. Please refresh the page.";
          region.setAttribute("role", "alert");
          region.hidden = false;
        }
      } catch (_ignored) {
      }
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
