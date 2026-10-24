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
    function resetEnhanceSlider(slot) {
      const slider = byId(slot === "front" ? "enhanceSlider1" : "enhanceSlider2");
      const badge = byId(slot === "front" ? "enhanceVal1" : "enhanceVal2");
      if (slider) slider.value = "0";
      if (badge) badge.textContent = "0%";
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
        resetEnhanceSlider(slot);
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
      resetEnhanceSlider(slot);
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

  // src/core/cardDetection.js
  var TARGET_MAX_DIM = 320;
  function toFinite2(val, fallback = 0) {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  }
  function orderCorners(quad) {
    if (!Array.isArray(quad) || quad.length < 4) {
      return [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 }
      ];
    }
    let tl = quad[0], tr = quad[0], br = quad[0], bl = quad[0];
    let minSum = Infinity, maxSum = -Infinity;
    let maxDiff = -Infinity, minDiff = Infinity;
    for (const p of quad) {
      const px = toFinite2(p && p.x, 0);
      const py = toFinite2(p && p.y, 0);
      const sum = px + py;
      const diff = px - py;
      if (sum < minSum) {
        minSum = sum;
        tl = { x: px, y: py };
      }
      if (sum > maxSum) {
        maxSum = sum;
        br = { x: px, y: py };
      }
      if (diff > maxDiff) {
        maxDiff = diff;
        tr = { x: px, y: py };
      }
      if (diff < minDiff) {
        minDiff = diff;
        bl = { x: px, y: py };
      }
    }
    return [tl, tr, br, bl];
  }
  function polygonArea(poly) {
    if (!Array.isArray(poly) || poly.length < 3) return 0;
    let sum = 0;
    const n = poly.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const pi = poly[i] || { x: 0, y: 0 };
      const pj = poly[j] || { x: 0, y: 0 };
      sum += pj.x * pi.y - pi.x * pj.y;
    }
    return Math.abs(sum) / 2;
  }
  function isConvex(poly) {
    if (!Array.isArray(poly) || poly.length < 4) return false;
    let sign = 0;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % n];
      const p3 = poly[(i + 2) % n];
      const cross = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);
      if (Math.abs(cross) > 1e-4) {
        const currentSign = cross > 0 ? 1 : -1;
        if (sign === 0) {
          sign = currentSign;
        } else if (currentSign !== sign) {
          return false;
        }
      }
    }
    return true;
  }
  function convexHull(points) {
    if (!Array.isArray(points) || points.length <= 3) return points ? points.slice() : [];
    const pts = points.slice().sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    }
    const upper = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper);
  }
  function minAreaOrientedRect(hull) {
    if (!hull || hull.length < 3) return null;
    const n = hull.length;
    let minArea = Infinity;
    let bestCorners = null;
    for (let i = 0; i < n; i++) {
      const p1 = hull[i];
      const p2 = hull[(i + 1) % n];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) continue;
      const ux = dx / len;
      const uy = dy / len;
      const vx = -uy;
      const vy = ux;
      let minU = Infinity, maxU = -Infinity;
      let minV = Infinity, maxV = -Infinity;
      for (const p of hull) {
        const u = p.x * ux + p.y * uy;
        const v = p.x * vx + p.y * vy;
        if (u < minU) minU = u;
        if (u > maxU) maxU = u;
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      }
      const area = (maxU - minU) * (maxV - minV);
      if (area < minArea) {
        minArea = area;
        bestCorners = [
          { x: minU * ux + minV * vx, y: minU * uy + minV * vy },
          { x: maxU * ux + minV * vx, y: maxU * uy + minV * vy },
          { x: maxU * ux + maxV * vx, y: maxU * uy + maxV * vy },
          { x: minU * ux + maxV * vx, y: minU * uy + maxV * vy }
        ];
      }
    }
    return bestCorners;
  }
  function morphClose(src, W, H, r = 3) {
    const total = W * H;
    const temp = new Uint8Array(total);
    const dst = new Uint8Array(total);
    for (let y = 0; y < H; y++) {
      const yMin = Math.max(0, y - r);
      const yMax = Math.min(H - 1, y + r);
      for (let x = 0; x < W; x++) {
        const xMin = Math.max(0, x - r);
        const xMax = Math.min(W - 1, x + r);
        let found = 0;
        for (let ny = yMin; ny <= yMax && !found; ny++) {
          const row = ny * W;
          for (let nx = xMin; nx <= xMax; nx++) {
            if (src[row + nx] === 1) {
              found = 1;
              break;
            }
          }
        }
        temp[y * W + x] = found;
      }
    }
    for (let y = 0; y < H; y++) {
      const yMin = Math.max(0, y - r);
      const yMax = Math.min(H - 1, y + r);
      for (let x = 0; x < W; x++) {
        const xMin = Math.max(0, x - r);
        const xMax = Math.min(W - 1, x + r);
        let allOn = 1;
        for (let ny = yMin; ny <= yMax && allOn; ny++) {
          const row = ny * W;
          for (let nx = xMin; nx <= xMax; nx++) {
            if (temp[row + nx] === 0) {
              allOn = 0;
              break;
            }
          }
        }
        dst[y * W + x] = allOn;
      }
    }
    return dst;
  }
  function extractComponentBoundaries(grid, W, H, minSize) {
    const total = W * H;
    const visited = new Uint8Array(total);
    const comps = [];
    for (let y = 1; y < H - 1; y++) {
      const row = y * W;
      for (let x = 1; x < W - 1; x++) {
        const idx = row + x;
        if (grid[idx] === 1 && !visited[idx]) {
          const queue = [idx];
          visited[idx] = 1;
          let qHead = 0;
          const boundaryPts = [];
          while (qHead < queue.length) {
            const curr = queue[qHead++];
            const cx = curr % W;
            const cy = curr / W | 0;
            let isEdge = false;
            const nbs = [curr - 1, curr + 1, curr - W, curr + W];
            for (let i = 0; i < 4; i++) {
              const nb = nbs[i];
              if (nb >= 0 && nb < total) {
                if (grid[nb] === 0) {
                  isEdge = true;
                } else if (!visited[nb]) {
                  visited[nb] = 1;
                  queue.push(nb);
                }
              } else {
                isEdge = true;
              }
            }
            if (isEdge) {
              boundaryPts.push({ x: cx, y: cy });
            }
          }
          if (queue.length >= minSize) {
            comps.push({ size: queue.length, boundary: boundaryPts });
          }
        }
      }
    }
    return comps;
  }
  function scoreQuad(quad, W, H, gradMap) {
    const area = polygonArea(quad);
    const totalArea = W * H;
    const areaRatio = area / totalArea;
    const ordered = orderCorners(quad);
    const topW = Math.hypot(ordered[1].x - ordered[0].x, ordered[1].y - ordered[0].y);
    const botW = Math.hypot(ordered[2].x - ordered[3].x, ordered[2].y - ordered[3].y);
    const leftH = Math.hypot(ordered[3].x - ordered[0].x, ordered[3].y - ordered[0].y);
    const rightH = Math.hypot(ordered[2].x - ordered[1].x, ordered[2].y - ordered[1].y);
    const widthSkew = Math.max(topW, botW) / (Math.min(topW, botW) || 1);
    const heightSkew = Math.max(leftH, rightH) / (Math.min(leftH, rightH) || 1);
    if (widthSkew > 2.3 || heightSkew > 2.3) {
      return -Infinity;
    }
    let areaScore = 0;
    if (areaRatio >= 0.2 && areaRatio <= 0.85) {
      areaScore = 50;
    } else if (areaRatio >= 0.12 && areaRatio < 0.2) {
      areaScore = 30;
    } else if (areaRatio > 0.85 && areaRatio <= 0.92) {
      areaScore = 35;
    } else {
      areaScore = 10;
    }
    const avgW = (topW + botW) / 2;
    const avgH = (leftH + rightH) / 2;
    const ratio = Math.max(avgW, avgH) / (Math.min(avgW, avgH) || 1);
    let ratioScore = 0;
    if (ratio >= 1.25 && ratio <= 1.85) {
      ratioScore = 35;
    } else if (ratio >= 1.05 && ratio <= 2.2) {
      ratioScore = 15;
    }
    let angleScore = 0;
    for (let i = 0; i < 4; i++) {
      const p1 = ordered[i];
      const p2 = ordered[(i + 1) % 4];
      const p3 = ordered[(i + 2) % 4];
      const v1x = p1.x - p2.x, v1y = p1.y - p2.y;
      const v2x = p3.x - p2.x, v2y = p3.y - p2.y;
      const d1 = Math.hypot(v1x, v1y), d2 = Math.hypot(v2x, v2y);
      if (d1 > 0 && d2 > 0) {
        const cosA = Math.abs((v1x * v2x + v1y * v2y) / (d1 * d2));
        if (cosA < 0.26) angleScore += 10;
      }
    }
    let edgeGradSum = 0;
    let edgeSampleCount = 0;
    if (gradMap) {
      for (let i = 0; i < 4; i++) {
        const p1 = ordered[i];
        const p2 = ordered[(i + 1) % 4];
        const steps = 12;
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          const sx = Math.round(p1.x + (p2.x - p1.x) * t);
          const sy = Math.round(p1.y + (p2.y - p1.y) * t);
          if (sx >= 0 && sx < W && sy >= 0 && sy < H) {
            edgeGradSum += gradMap[sy * W + sx] || 0;
            edgeSampleCount++;
          }
        }
      }
    }
    const avgEdgeGrad = edgeSampleCount > 0 ? edgeGradSum / edgeSampleCount : 0;
    const edgeScore = Math.min(30, avgEdgeGrad);
    return areaScore + ratioScore + angleScore + edgeScore;
  }
  function detectCardCornersFromPixels(data, W, H, origW, origH) {
    const oW = Math.max(1, toFinite2(origW, 100));
    const oH = Math.max(1, toFinite2(origH, 100));
    const insetCorners = [
      { x: Math.round(oW * 0.05), y: Math.round(oH * 0.05) },
      { x: Math.round(oW * 0.95), y: Math.round(oH * 0.05) },
      { x: Math.round(oW * 0.95), y: Math.round(oH * 0.95) },
      { x: Math.round(oW * 0.05), y: Math.round(oH * 0.95) }
    ];
    const fullCorners = [
      { x: 0, y: 0 },
      { x: oW, y: 0 },
      { x: oW, y: oH },
      { x: 0, y: oH }
    ];
    if (!data || W < 10 || H < 10) {
      return insetCorners;
    }
    const totalPixels = W * H;
    const gray = new Float32Array(totalPixels);
    let minLum = 255, maxLum = 0;
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      gray[i] = lum;
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
    }
    if (maxLum - minLum < 15) {
      return insetCorners;
    }
    const blurH = new Float32Array(totalPixels);
    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x - 2);
        const x1 = Math.max(0, x - 1);
        const x2 = x;
        const x3 = Math.min(W - 1, x + 1);
        const x4 = Math.min(W - 1, x + 2);
        blurH[row + x] = (gray[row + x0] * 1 + gray[row + x1] * 4 + gray[row + x2] * 6 + gray[row + x3] * 4 + gray[row + x4] * 1) / 16;
      }
    }
    const blurred = new Float32Array(totalPixels);
    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - 2) * W;
      const y1 = Math.max(0, y - 1) * W;
      const y2 = y * W;
      const y3 = Math.min(H - 1, y + 1) * W;
      const y4 = Math.min(H - 1, y + 2) * W;
      for (let x = 0; x < W; x++) {
        blurred[y2 + x] = (blurH[y0 + x] * 1 + blurH[y1 + x] * 4 + blurH[y2 + x] * 6 + blurH[y3 + x] * 4 + blurH[y4 + x] * 1) / 16;
      }
    }
    const grad = new Float32Array(totalPixels);
    for (let y = 1; y < H - 1; y++) {
      const ym1 = (y - 1) * W;
      const y0 = y * W;
      const yp1 = (y + 1) * W;
      for (let x = 1; x < W - 1; x++) {
        const gx = -blurred[ym1 + x - 1] + blurred[ym1 + x + 1] + -2 * blurred[y0 + x - 1] + 2 * blurred[y0 + x + 1] + -blurred[yp1 + x - 1] + blurred[yp1 + x + 1];
        const gy = -blurred[ym1 + x - 1] - 2 * blurred[ym1 + x] - blurred[ym1 + x + 1] + blurred[yp1 + x - 1] + 2 * blurred[yp1 + x] + blurred[yp1 + x + 1];
        grad[y0 + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
    for (let x = 0; x < W; x++) {
      const idx0 = x * 4;
      const idx1 = ((H - 1) * W + x) * 4;
      bgR += data[idx0] + data[idx1];
      bgG += data[idx0 + 1] + data[idx1 + 1];
      bgB += data[idx0 + 2] + data[idx1 + 2];
      bgCount += 2;
    }
    for (let y = 1; y < H - 1; y++) {
      const idx0 = y * W * 4;
      const idx1 = (y * W + W - 1) * 4;
      bgR += data[idx0] + data[idx1];
      bgG += data[idx0 + 1] + data[idx1 + 1];
      bgB += data[idx0 + 2] + data[idx1 + 2];
      bgCount += 2;
    }
    bgR /= Math.max(1, bgCount);
    bgG /= Math.max(1, bgCount);
    bgB /= Math.max(1, bgCount);
    const colorDistMask = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const dist = (Math.abs(data[idx] - bgR) + Math.abs(data[idx + 1] - bgG) + Math.abs(data[idx + 2] - bgB)) / 3;
      if (dist > 22) {
        colorDistMask[i] = 1;
      }
    }
    const hist = new Int32Array(256);
    for (let i = 0; i < totalPixels; i++) {
      hist[Math.min(255, Math.max(0, Math.round(blurred[i])))]++;
    }
    let sumAll = 0;
    for (let i = 0; i < 256; i++) sumAll += i * hist[i];
    let sumB = 0, wB = 0, maxVar = 0, otsuThresh = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      const wF = totalPixels - wB;
      if (wF === 0) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sumAll - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > maxVar) {
        maxVar = between;
        otsuThresh = t;
      }
    }
    const otsuMaskPos = new Uint8Array(totalPixels);
    const otsuMaskInv = new Uint8Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      if (blurred[i] > otsuThresh) otsuMaskPos[i] = 1;
      else otsuMaskInv[i] = 1;
    }
    const closedColor = morphClose(colorDistMask, W, H, 3);
    const closedOtsuPos = morphClose(otsuMaskPos, W, H, 3);
    const closedOtsuInv = morphClose(otsuMaskInv, W, H, 3);
    const minCompSize = Math.round(totalPixels * 0.15);
    const allComps = [
      ...extractComponentBoundaries(closedColor, W, H, minCompSize),
      ...extractComponentBoundaries(closedOtsuPos, W, H, minCompSize),
      ...extractComponentBoundaries(closedOtsuInv, W, H, minCompSize)
    ];
    const candidates = [];
    for (const comp of allComps) {
      const areaRatio = comp.size / totalPixels;
      if (areaRatio >= 0.15 && areaRatio <= 0.88) {
        const hull = convexHull(comp.boundary);
        if (hull.length >= 4) {
          const orientedRect = minAreaOrientedRect(hull);
          if (orientedRect && isConvex(orientedRect)) {
            candidates.push(orientedRect);
          }
          const extremeQuad = orderCorners(hull);
          if (extremeQuad && isConvex(extremeQuad)) {
            candidates.push(extremeQuad);
          }
        }
      }
    }
    let bestQuad = null;
    let bestScore = -Infinity;
    for (const quad of candidates) {
      if (!isConvex(quad)) continue;
      const score = scoreQuad(quad, W, H, grad);
      if (score > bestScore) {
        bestScore = score;
        bestQuad = quad;
      }
    }
    if (bestQuad && bestScore >= 50) {
      const ordered = orderCorners(bestQuad);
      const scaleX = oW / W;
      const scaleY = oH / H;
      return ordered.map((p) => ({
        x: Math.round(Math.min(oW, Math.max(0, p.x * scaleX))),
        y: Math.round(Math.min(oH, Math.max(0, p.y * scaleY)))
      }));
    }
    return fullCorners;
  }
  function detectCardCorners(imageSource, naturalWidth, naturalHeight, providedDoc) {
    try {
      if (!imageSource) {
        const w = toFinite2(naturalWidth, 100);
        const h = toFinite2(naturalHeight, 100);
        return [
          { x: 0, y: 0 },
          { x: w, y: 0 },
          { x: w, y: h },
          { x: 0, y: h }
        ];
      }
      if (imageSource.data && imageSource.width && imageSource.height) {
        const origW2 = naturalWidth || imageSource.width;
        const origH2 = naturalHeight || imageSource.height;
        return detectCardCornersFromPixels(imageSource.data, imageSource.width, imageSource.height, origW2, origH2);
      }
      const origW = naturalWidth || imageSource.naturalWidth || imageSource.width || 0;
      const origH = naturalHeight || imageSource.naturalHeight || imageSource.height || 0;
      if (origW <= 0 || origH <= 0) {
        return [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 }
        ];
      }
      const doc = providedDoc || (typeof document !== "undefined" ? document : null);
      if (!doc || typeof doc.createElement !== "function") {
        return [
          { x: 0, y: 0 },
          { x: origW, y: 0 },
          { x: origW, y: origH },
          { x: 0, y: origH }
        ];
      }
      const scale = Math.min(TARGET_MAX_DIM / origW, TARGET_MAX_DIM / origH, 1);
      const procW = Math.max(16, Math.round(origW * scale));
      const procH = Math.max(16, Math.round(origH * scale));
      const canvas = doc.createElement("canvas");
      canvas.width = procW;
      canvas.height = procH;
      let ctx = null;
      try {
        ctx = canvas.getContext("2d");
      } catch (_e) {
        ctx = null;
      }
      if (!ctx) {
        return [
          { x: 0, y: 0 },
          { x: origW, y: 0 },
          { x: origW, y: origH },
          { x: 0, y: origH }
        ];
      }
      ctx.drawImage(imageSource, 0, 0, procW, procH);
      const imgData = ctx.getImageData(0, 0, procW, procH);
      return detectCardCornersFromPixels(imgData.data, procW, procH, origW, origH);
    } catch (_err) {
      const w = toFinite2(naturalWidth, 100);
      const h = toFinite2(naturalHeight, 100);
      return [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h }
      ];
    }
  }

  // src/core/documentEnhance.js
  function clampByte(val) {
    if (val < 0) return 0;
    if (val > 255) return 255;
    return Math.round(val);
  }
  function enhanceDocumentBuffer(data, width, height, strength = 1) {
    const s = Number.isFinite(strength) ? Math.max(0, Math.min(1, strength)) : 1;
    const w = Math.max(1, Math.floor(Number(width) || 0));
    const h = Math.max(1, Math.floor(Number(height) || 0));
    const total = w * h;
    const out = new Uint8ClampedArray(total * 4);
    if (!data || data.length < total * 4) {
      if (data && data.length) {
        out.set(data.subarray ? data.subarray(0, out.length) : data.slice(0, out.length));
      }
      return out;
    }
    if (s <= 0) {
      out.set(data.subarray ? data.subarray(0, total * 4) : data.slice(0, total * 4));
      return out;
    }
    const luma = new Float32Array(total);
    const hist = new Int32Array(256);
    for (let i = 0; i < total; i++) {
      const idx = i * 4;
      const l = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
      luma[i] = l;
      hist[Math.min(255, Math.max(0, l))]++;
    }
    let count = 0;
    let blackPoint = 0;
    const p1 = total * 0.01;
    for (let i = 0; i < 256; i++) {
      count += hist[i];
      if (count >= p1) {
        blackPoint = i;
        break;
      }
    }
    count = 0;
    let whitePoint = 255;
    const p96 = total * 0.96;
    for (let i = 0; i < 256; i++) {
      count += hist[i];
      if (count >= p96) {
        whitePoint = i;
        break;
      }
    }
    if (whitePoint - blackPoint < 35) {
      blackPoint = Math.max(0, blackPoint - 20);
      whitePoint = Math.min(255, whitePoint + 20);
    }
    let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
    const threshBg = whitePoint * 0.9;
    for (let i = 0; i < total; i++) {
      if (luma[i] >= threshBg) {
        const idx = i * 4;
        bgR += data[idx];
        bgG += data[idx + 1];
        bgB += data[idx + 2];
        bgCount++;
      }
    }
    if (bgCount > 0) {
      bgR /= bgCount;
      bgG /= bgCount;
      bgB /= bgCount;
    } else {
      bgR = whitePoint;
      bgG = whitePoint;
      bgB = whitePoint;
    }
    const targetWhite = 252;
    const gainR = targetWhite / Math.max(110, bgR);
    const gainG = targetWhite / Math.max(110, bgG);
    const gainB = targetWhite / Math.max(110, bgB);
    const range = Math.max(1, whitePoint - blackPoint);
    const temp = new Uint8ClampedArray(total * 4);
    const darkFloor = 0.5 - 0.32 * s;
    const textThresh = 0.52;
    const bgThresh = 0.65;
    for (let i = 0; i < total; i++) {
      const idx = i * 4;
      const r = data[idx] * gainR;
      const g = data[idx + 1] * gainG;
      const b = data[idx + 2] * gainB;
      const a = data[idx + 3];
      const currentLuma = 0.299 * r + 0.587 * g + 0.114 * b;
      let norm = (currentLuma - blackPoint) / range;
      norm = Math.max(0, Math.min(1, norm));
      let factor;
      if (norm > bgThresh) {
        const t = (norm - bgThresh) / (1 - bgThresh);
        factor = 1 + t * (0.22 + 0.26 * s);
      } else if (norm < textThresh) {
        const t = norm / textThresh;
        factor = darkFloor + (1 - darkFloor) * Math.pow(t, 0.75);
      } else {
        factor = 1;
      }
      temp[idx] = clampByte(r * factor);
      temp[idx + 1] = clampByte(g * factor);
      temp[idx + 2] = clampByte(b * factor);
      temp[idx + 3] = a;
    }
    const amount = 0.22 + 0.28 * s;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      const ym1 = Math.max(0, y - 1) * w;
      const yp1 = Math.min(h - 1, y + 1) * w;
      for (let x = 0; x < w; x++) {
        const xm1 = Math.max(0, x - 1);
        const xp1 = Math.min(w - 1, x + 1);
        const idx = (row + x) * 4;
        const idxT = (ym1 + x) * 4;
        const idxB = (yp1 + x) * 4;
        const idxL = (row + xm1) * 4;
        const idxR = (row + xp1) * 4;
        for (let c = 0; c < 3; c++) {
          const center = temp[idx + c];
          const neighbors = (temp[idxT + c] + temp[idxB + c] + temp[idxL + c] + temp[idxR + c]) * 0.25;
          const diff = center - neighbors;
          out[idx + c] = clampByte(center + diff * amount);
        }
        out[idx + 3] = temp[idx + 3];
      }
    }
    if (s < 0.999) {
      for (let i = 0; i < total; i++) {
        const idx = i * 4;
        out[idx] = clampByte(data[idx] * (1 - s) + out[idx] * s);
        out[idx + 1] = clampByte(data[idx + 1] * (1 - s) + out[idx + 1] * s);
        out[idx + 2] = clampByte(data[idx + 2] * (1 - s) + out[idx + 2] * s);
      }
    }
    return out;
  }
  function enhanceImageSource(sourceImage, doc, strength = 1) {
    try {
      if (!sourceImage) return null;
      const currentDoc = doc || (typeof document !== "undefined" ? document : null);
      if (!currentDoc || typeof currentDoc.createElement !== "function") return null;
      const width = sourceImage.naturalWidth || sourceImage.width || 0;
      const height = sourceImage.naturalHeight || sourceImage.height || 0;
      if (width <= 0 || height <= 0) return null;
      const canvas = currentDoc.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(sourceImage, 0, 0, width, height);
      const imgData = ctx.getImageData(0, 0, width, height);
      const enhancedData = enhanceDocumentBuffer(imgData.data, width, height, strength);
      const outImgData = ctx.createImageData(width, height);
      outImgData.data.set(enhancedData);
      ctx.putImageData(outImgData, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      const outImg = new Image();
      outImg.src = dataUrl;
      return {
        image: outImg,
        dataUrl,
        width,
        height
      };
    } catch (_err) {
      return null;
    }
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
  var AUTO_CROP_BUTTONS = Object.freeze({
    front: "autoCrop1",
    back: "autoCrop2"
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
    let modalBaseImage = null;
    function byId(id) {
      return doc.getElementById(id);
    }
    function safeShowGuidance(text, options) {
      try {
        showGuidance(text, options);
      } catch (_e) {
      }
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
      let ctx = null;
      try {
        ctx = canvas.getContext("2d");
      } catch (_e) {
        ctx = null;
      }
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
      ctx.strokeStyle = "#00d2ff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(displayCorners[0].x, displayCorners[0].y);
      ctx.lineTo(displayCorners[1].x, displayCorners[1].y);
      ctx.lineTo(displayCorners[2].x, displayCorners[2].y);
      ctx.lineTo(displayCorners[3].x, displayCorners[3].y);
      ctx.closePath();
      ctx.stroke();
      displayCorners.forEach((corner, idx) => {
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, HANDLE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = idx === activeCornerIdx ? "rgba(0, 210, 255, 0.35)" : "rgba(255, 255, 255, 0.2)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, HANDLE_RADIUS / 2, 0, Math.PI * 2);
        ctx.fillStyle = idx === activeCornerIdx ? "#00bfff" : "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
      if (dragging && dragType === "corner" && dragCornerIdx >= 0) {
        drawLoupe(ctx, cw, ch, displayCorners[dragCornerIdx], quadCorners[dragCornerIdx]);
      }
    }
    function drawLoupe(ctx, cw, ch, displayCorner, origCorner) {
      if (!cropImage || !origCorner) return;
      const loupeRadius = 46;
      const zoom = 2.4;
      const onRight = displayCorner.x < cw / 2;
      const loupeX = onRight ? cw - loupeRadius - 16 : loupeRadius + 16;
      const loupeY = loupeRadius + 16;
      ctx.save();
      ctx.beginPath();
      ctx.arc(loupeX, loupeY, loupeRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#0f172a";
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(loupeX, loupeY, loupeRadius, 0, Math.PI * 2);
      ctx.clip();
      const srcW = loupeRadius * 2 / (scale * zoom);
      const srcH = loupeRadius * 2 / (scale * zoom);
      const srcX = origCorner.x - srcW / 2;
      const srcY = origCorner.y - srcH / 2;
      ctx.drawImage(
        cropImage,
        srcX,
        srcY,
        srcW,
        srcH,
        loupeX - loupeRadius,
        loupeY - loupeRadius,
        loupeRadius * 2,
        loupeRadius * 2
      );
      ctx.strokeStyle = "#00d2ff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(loupeX - 10, loupeY);
      ctx.lineTo(loupeX + 10, loupeY);
      ctx.moveTo(loupeX, loupeY - 10);
      ctx.lineTo(loupeX, loupeY + 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(loupeX, loupeY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(loupeX, loupeY, loupeRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#00d2ff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(loupeX, loupeY, loupeRadius + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
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
    function openCropModal(slot, options = {}) {
      try {
        const state = appState.getState();
        const source = state.sources[slot];
        if (!source || !source.image) {
          safeShowGuidance("No image is available to crop. Please upload an image first.");
          return;
        }
        activeSlot = slot;
        openerElement = byId(CROP_BUTTONS[slot]) || null;
        if (options.forceAutoDetect) {
          quadCorners = detectCardCorners(source.image, source.naturalWidth, source.naturalHeight, doc);
          currentRegion = quadBoundingBox(quadCorners);
          safeShowGuidance("4 corners auto-detected like Microsoft Lens. Drag handles to fine-tune.");
        } else if (source.crop && source.crop.corners) {
          quadCorners = source.crop.corners.map((c) => ({ ...c }));
          currentRegion = quadBoundingBox(quadCorners);
        } else if (source.crop) {
          currentRegion = { ...source.crop };
          quadCorners = regionToQuadCorners(currentRegion);
        } else {
          quadCorners = detectCardCorners(source.image, source.naturalWidth, source.naturalHeight, doc);
          currentRegion = quadBoundingBox(quadCorners);
          safeShowGuidance("4 corners auto-selected like Microsoft Lens. Drag handles to fine-tune.");
        }
        const viewportW = doc.defaultView && doc.defaultView.innerWidth || 800;
        const viewportH = doc.defaultView && doc.defaultView.innerHeight || 600;
        const reservedChromeH = 180;
        const availW = Math.max(160, Math.min(viewportW * 0.88, 780));
        const availH = Math.max(120, Math.min(viewportH - reservedChromeH, viewportH * 0.52));
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
        modalBaseImage = source.image && source.image.__baseImage || source.image;
        if (modalBaseImage) modalBaseImage.__baseImage = modalBaseImage;
        const currentSlotSlider = byId(slot === "front" ? "enhanceSlider1" : "enhanceSlider2");
        const modalSlider = byId("enhanceSliderModal");
        const modalVal = byId("enhanceValModal");
        const initialSliderVal = currentSlotSlider ? currentSlotSlider.value : "0";
        if (modalSlider) modalSlider.value = initialSliderVal;
        if (modalVal) modalVal.textContent = `${initialSliderVal}%`;
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
      modalBaseImage = null;
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
            img.__baseImage = img;
            appState.setSource(slot, {
              image: img,
              naturalWidth: outW,
              naturalHeight: outH
            });
            const slider = byId(slot === "front" ? "enhanceSlider1" : "enhanceSlider2");
            const badge = byId(slot === "front" ? "enhanceVal1" : "enhanceVal2");
            if (slider) slider.value = "0";
            if (badge) badge.textContent = "0%";
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
      let outCtx = null;
      try {
        outCtx = outCanvas.getContext("2d");
      } catch (_e) {
        outCtx = null;
      }
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
    function autoDetectCurrentModal() {
      try {
        if (!activeSlot || !cropImage) return;
        const bounds = getImageBounds();
        quadCorners = detectCardCorners(cropImage, bounds.width, bounds.height, doc);
        currentRegion = quadBoundingBox(quadCorners);
        drawCropOverlay();
        safeShowGuidance("4 corners auto-detected like Microsoft Lens.");
      } catch (_err) {
      }
    }
    function resetToFullImage() {
      try {
        if (!activeSlot) return;
        const bounds = getImageBounds();
        quadCorners = initialQuadCorners(bounds.width, bounds.height);
        currentRegion = quadBoundingBox(quadCorners);
        drawCropOverlay();
        safeShowGuidance("Corners reset to full image.");
      } catch (_err) {
      }
    }
    function quickAutoCrop(slot) {
      try {
        const state = appState.getState();
        const source = state.sources[slot];
        if (!source || !source.image) {
          safeShowGuidance("No image is available to auto crop. Please upload an image first.");
          return;
        }
        const bounds = { width: source.naturalWidth, height: source.naturalHeight };
        const corners = detectCardCorners(source.image, bounds.width, bounds.height, doc);
        const croppedResult = perspectiveCrop(source.image, corners);
        if (croppedResult) {
          const img = croppedResult.image;
          const dataUrl = croppedResult.dataUrl;
          const outW = croppedResult.width;
          const outH = croppedResult.height;
          const commitCrop = () => {
            img.__baseImage = img;
            appState.setSource(slot, {
              image: img,
              naturalWidth: outW,
              naturalHeight: outH
            });
            const slider = byId(slot === "front" ? "enhanceSlider1" : "enhanceSlider2");
            const badge = byId(slot === "front" ? "enhanceVal1" : "enhanceVal2");
            if (slider) slider.value = "0";
            if (badge) badge.textContent = "0%";
            updateSlotVisuals(slot, dataUrl);
            displayCropInfo(slot);
            safeShowGuidance(`Image ${slot === "front" ? "1 (Front)" : "2 (Back)"}: Auto crop applied successfully!`);
          };
          if (img.complete && img.naturalWidth > 0) {
            commitCrop();
          } else {
            img.onload = commitCrop;
            img.onerror = () => {
              const bbox = quadBoundingBox(corners);
              appState.setCrop(slot, {
                x: bbox.x,
                y: bbox.y,
                w: bbox.w,
                h: bbox.h,
                corners: corners.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y) }))
              });
              displayCropInfo(slot);
              safeShowGuidance(`Image ${slot === "front" ? "1 (Front)" : "2 (Back)"}: Corners detected.`);
            };
          }
        } else {
          const bbox = quadBoundingBox(corners);
          appState.setCrop(slot, {
            x: bbox.x,
            y: bbox.y,
            w: bbox.w,
            h: bbox.h,
            corners: corners.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y) }))
          });
          displayCropInfo(slot);
          safeShowGuidance(`Image ${slot === "front" ? "1 (Front)" : "2 (Back)"}: Corners detected.`);
        }
      } catch (_err) {
      }
    }
    function quickEnhance(slot, strength = 1) {
      try {
        const state = appState.getState();
        const source = state.sources[slot];
        if (!source || !source.image) {
          safeShowGuidance(`No image is available to enhance. Please upload Image ${slot === "front" ? "1 (Front)" : "2 (Back)"} first.`);
          return;
        }
        const s = Math.max(0, Math.min(1, typeof strength === "number" ? strength : 1));
        const pct = Math.round(s * 100);
        const slider = byId(slot === "front" ? "enhanceSlider1" : "enhanceSlider2");
        const badge = byId(slot === "front" ? "enhanceVal1" : "enhanceVal2");
        if (slider && Number(slider.value) !== pct) slider.value = String(pct);
        if (badge) badge.textContent = `${pct}%`;
        const base = source.image.__baseImage || source.image;
        base.__baseImage = base;
        if (s <= 0) {
          appState.setSource(slot, {
            image: base,
            naturalWidth: base.naturalWidth,
            naturalHeight: base.naturalHeight
          });
          updateSlotVisuals(slot, base.src);
          return;
        }
        const enhanced = enhanceImageSource(base, doc, s);
        if (!enhanced) {
          safeShowGuidance(`Could not enhance Image ${slot === "front" ? "1 (Front)" : "2 (Back)"}.`);
          return;
        }
        enhanced.image.__baseImage = base;
        const commitEnhance = () => {
          appState.setSource(slot, {
            image: enhanced.image,
            naturalWidth: enhanced.width,
            naturalHeight: enhanced.height
          });
          updateSlotVisuals(slot, enhanced.dataUrl);
          if (s >= 1) {
            safeShowGuidance(`Image ${slot === "front" ? "1 (Front)" : "2 (Back)"}: Enhanced with 1-click!`);
          }
        };
        if (enhanced.image.complete && enhanced.image.naturalWidth > 0) {
          commitEnhance();
        } else {
          enhanced.image.onload = commitEnhance;
          enhanced.image.onerror = () => {
            safeShowGuidance(`Could not display enhanced image.`);
          };
        }
      } catch (_err) {
      }
    }
    function enhanceCurrentModal(strength = 1) {
      try {
        if (!activeSlot || !cropImage) return;
        const s = Math.max(0, Math.min(1, typeof strength === "number" ? strength : 1));
        const pct = Math.round(s * 100);
        const modalSlider = byId("enhanceSliderModal");
        const modalVal = byId("enhanceValModal");
        if (modalSlider && Number(modalSlider.value) !== pct) modalSlider.value = String(pct);
        if (modalVal) modalVal.textContent = `${pct}%`;
        if (!modalBaseImage) {
          modalBaseImage = cropImage.__baseImage || cropImage;
          modalBaseImage.__baseImage = modalBaseImage;
        }
        if (s <= 0) {
          cropImage = modalBaseImage;
          drawCropOverlay();
          return;
        }
        const enhanced = enhanceImageSource(modalBaseImage, doc, s);
        if (!enhanced) return;
        enhanced.image.__baseImage = modalBaseImage;
        const commit = () => {
          cropImage = enhanced.image;
          drawCropOverlay();
          if (s >= 1) {
            safeShowGuidance("Image enhanced! Corners preserved.");
          }
        };
        if (enhanced.image.complete && enhanced.image.naturalWidth > 0) {
          commit();
        } else {
          enhanced.image.onload = commit;
        }
      } catch (_err) {
      }
    }
    function handleSliderInput(slot, value) {
      const num = Math.max(0, Math.min(100, Number(value) || 0));
      const badge = byId(slot === "front" ? "enhanceVal1" : "enhanceVal2");
      if (badge) badge.textContent = `${num}%`;
      quickEnhance(slot, num / 100);
    }
    function handleModalSliderInput(value) {
      const num = Math.max(0, Math.min(100, Number(value) || 0));
      const badge = byId("enhanceValModal");
      if (badge) badge.textContent = `${num}%`;
      enhanceCurrentModal(num / 100);
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
      const autoCrop1Btn = byId("autoCrop1");
      const autoCrop2Btn = byId("autoCrop2");
      if (autoCrop1Btn) on(autoCrop1Btn, "click", () => quickAutoCrop("front"));
      if (autoCrop2Btn) on(autoCrop2Btn, "click", () => quickAutoCrop("back"));
      const enhance1Btn = byId("enhance1");
      const enhance2Btn = byId("enhance2");
      if (enhance1Btn) on(enhance1Btn, "click", () => quickEnhance("front", 1));
      if (enhance2Btn) on(enhance2Btn, "click", () => quickEnhance("back", 1));
      const slider1 = byId("enhanceSlider1");
      const slider2 = byId("enhanceSlider2");
      if (slider1) on(slider1, "input", (e) => handleSliderInput("front", e.target.value));
      if (slider2) on(slider2, "input", (e) => handleSliderInput("back", e.target.value));
      const autoDetectBtn = byId("autoDetectCrop");
      const resetCornersBtn = byId("resetCropCorners");
      const modalEnhanceBtn = byId("enhanceCropModal");
      const sliderModal = byId("enhanceSliderModal");
      if (autoDetectBtn) on(autoDetectBtn, "click", autoDetectCurrentModal);
      if (resetCornersBtn) on(resetCornersBtn, "click", resetToFullImage);
      if (modalEnhanceBtn) on(modalEnhanceBtn, "click", () => enhanceCurrentModal(1));
      if (sliderModal) on(sliderModal, "input", (e) => handleModalSliderInput(e.target.value));
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
      modalBaseImage = null;
      openerElement = null;
    }
    return {
      init,
      destroy,
      openCropModal,
      quickAutoCrop,
      quickEnhance,
      handleSliderInput,
      autoDetectCurrentModal,
      resetToFullImage,
      enhanceCurrentModal,
      handleModalSliderInput,
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
  function clampByte2(value) {
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
      out[i] = clampByte2(rr);
      out[i + 1] = clampByte2(gg);
      out[i + 2] = clampByte2(bb);
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
        out[idx] = clampByte2(r);
        out[idx + 1] = clampByte2(g);
        out[idx + 2] = clampByte2(b);
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
  function clampByte3(v) {
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
        out[i] = clampByte3(Math.round(out[i] * 1.08 + 12));
        out[i + 1] = clampByte3(Math.round(out[i + 1] * 1.08 + 12));
        out[i + 2] = clampByte3(Math.round(out[i + 2] * 1.08 + 12));
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
      l = clampByte3(l);
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
  function fitImageToPage(imgW, imgH, page = A4_PORTRAIT, margin = DEFAULT_MARGIN_MM, maxFitWidthMm = null, verticalAlign = "center") {
    const { widthMm, heightMm } = resolvePage(page);
    const m = resolveMargin(margin, { widthMm, heightMm });
    let printableW = widthMm - 2 * m;
    const printableH = heightMm - 2 * m;
    if (Number.isFinite(maxFitWidthMm) && maxFitWidthMm > 0) {
      printableW = Math.min(printableW, maxFitWidthMm);
    }
    const w0 = Number.isFinite(imgW) && imgW > 0 ? imgW : printableW;
    const h0 = Number.isFinite(imgH) && imgH > 0 ? imgH : printableH;
    const scale = Math.min(printableW / w0, printableH / h0);
    const w = w0 * scale;
    const h = h0 * scale;
    const x = (widthMm - w) / 2;
    let y;
    if (verticalAlign === "top") {
      const topMargin = Math.max(m, 25.4);
      y = Math.min(topMargin, heightMm - m - h);
      if (y < m) y = m;
    } else {
      y = (heightMm - h) / 2;
    }
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
    const cardSizeSelect = resolveElement2(
      elements,
      "cardSizeSelect",
      doc,
      "cardSize"
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
      let maxCardWidth = 105;
      if (cardSizeSelect && cardSizeSelect.value) {
        if (cardSizeSelect.value === "fit") {
          maxCardWidth = null;
        } else {
          const parsed = parseFloat(cardSizeSelect.value);
          if (Number.isFinite(parsed) && parsed > 0) {
            maxCardWidth = parsed;
          }
        }
      }
      const fit = fitFn(dims.width, dims.height, A4_PORTRAIT, DEFAULT_MARGIN_MM, maxCardWidth, "top");
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
    const enhanceSlider1 = resolveElement3(elements, "enhanceSlider1", doc, "enhanceSlider1");
    const enhanceSlider2 = resolveElement3(elements, "enhanceSlider2", doc, "enhanceSlider2");
    const enhanceSliderModal = resolveElement3(elements, "enhanceSliderModal", doc, "enhanceSliderModal");
    const enhanceVal1 = resolveElement3(elements, "enhanceVal1", doc, "enhanceVal1");
    const enhanceVal2 = resolveElement3(elements, "enhanceVal2", doc, "enhanceVal2");
    const enhanceValModal = resolveElement3(elements, "enhanceValModal", doc, "enhanceValModal");
    const cardSizeSelect = resolveElement3(elements, "cardSizeSelect", doc, "cardSize");
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
        if (enhanceSlider1) enhanceSlider1.value = "0";
        if (enhanceSlider2) enhanceSlider2.value = "0";
        if (enhanceSliderModal) enhanceSliderModal.value = "0";
        if (enhanceVal1) enhanceVal1.textContent = "0%";
        if (enhanceVal2) enhanceVal2.textContent = "0%";
        if (enhanceValModal) enhanceValModal.textContent = "0%";
        if (cardSizeSelect) cardSizeSelect.value = "105";
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
      const downloadPdfBtn = document.getElementById("downloadPdf");
      if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener("click", (e) => {
          const state = appState.getState();
          if (!state.combinedImage) {
            const ok = combineCtrl.handleCombine();
            if (!ok) {
              e.stopImmediatePropagation();
            }
          }
        }, true);
      }
      const resetCtrl = createResetController({
        appState,
        progress,
        messages,
        document
      });
      resetCtrl.init();
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
