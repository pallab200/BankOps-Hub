/**
 * aiNidController.js — Controller for AI-powered real NID image enhancement & stacking.
 *
 * CRITICAL DIRECTIVE:
 * Does NOT generate synthetic cards or computer-typed text.
 * Operates purely on the USER'S REAL uploaded image(s):
 *   1. Vision AI detects the exact card boundaries and 4 corners for Front and Back.
 *   2. Extracts the real card images via perspective de-skewing.
 *   3. Removes phone camera shadows, cleans background to document white, sharpens real text.
 *   4. Stacks the authentic Front and Back card images onto a single page matching the reference layout.
 */

import {
  enhanceRealNidImages,
  enhanceNidImagesWithAIEdit,
  getStoredApiKey,
  setStoredApiKey,
  getStoredModel,
  setStoredModel,
  fileToDataUrl,
  loadImage,
  FALLBACK_MODELS
} from '../core/aiNidService.js';

const HIDDEN_CLASS = 'hidden';

export function createAiNidController(deps = {}) {
  const {
    appState,
    messages,
    progress,
    document: doc = typeof document !== 'undefined' ? document : undefined
  } = deps;

  if (!appState) throw new Error('createAiNidController requires appState');
  if (!messages) throw new Error('createAiNidController requires messages');
  if (!progress) throw new Error('createAiNidController requires progress');

  // DOM Elements
  const aiButton = doc && doc.getElementById('aiEnhanceBtn');
  const aiSettingsBtn = doc && doc.getElementById('aiSettingsBtn');
  const aiSettingsModal = doc && doc.getElementById('aiSettingsModal');
  const aiSettingsClose = doc && doc.getElementById('aiSettingsClose');
  const aiApiKeyInput = doc && doc.getElementById('aiApiKeyInput');
  const aiModelSelect = doc && doc.getElementById('aiModelSelect');
  const aiSaveSettingsBtn = doc && doc.getElementById('aiSaveSettingsBtn');
  const aiTestKeyBtn = doc && doc.getElementById('aiTestKeyBtn');

  const previewCanvas = doc && doc.getElementById('previewCanvas');
  const previewPlaceholder = doc && doc.getElementById('previewCanvasPlaceholder');
  const exportButton = doc && doc.getElementById('downloadPdf');

  function notifySuccess(text) {
    if (messages && typeof messages.showSuccess === 'function') {
      messages.showSuccess(text);
    } else if (messages && typeof messages.showGuidance === 'function') {
      messages.showGuidance(text);
    }
  }

  function notifyError(text) {
    if (messages && typeof messages.showError === 'function') {
      messages.showError(text);
    }
  }

  function notifyGuidance(text) {
    if (messages && typeof messages.showGuidance === 'function') {
      messages.showGuidance(text);
    }
  }

  /**
   * Initialize settings values in inputs.
   */
  function syncSettingsInputs() {
    if (aiApiKeyInput) {
      aiApiKeyInput.value = getStoredApiKey();
    }
    if (aiModelSelect) {
      aiModelSelect.value = getStoredModel();
    }
  }

  /**
   * Open Settings Modal.
   */
  function openSettings() {
    syncSettingsInputs();
    if (aiSettingsModal) {
      aiSettingsModal.classList.remove(HIDDEN_CLASS);
      aiSettingsModal.setAttribute('aria-hidden', 'false');
    }
  }

  /**
   * Close Settings Modal.
   */
  function closeSettings() {
    if (aiSettingsModal) {
      aiSettingsModal.classList.add(HIDDEN_CLASS);
      aiSettingsModal.setAttribute('aria-hidden', 'true');
    }
  }

  /**
   * Save Settings.
   */
  function handleSaveSettings() {
    const key = aiApiKeyInput ? aiApiKeyInput.value.trim() : '';
    const model = aiModelSelect ? aiModelSelect.value.trim() : '';
    setStoredApiKey(key);
    if (model) setStoredModel(model);
    notifySuccess('AI settings saved successfully.');
    closeSettings();
  }

  /**
   * Test OpenRouter connection.
   */
  async function handleTestKey() {
    const key = aiApiKeyInput ? aiApiKeyInput.value.trim() : getStoredApiKey();
    if (!key) {
      notifyError('Please enter an API Key to test.');
      return;
    }
    const btnText = aiTestKeyBtn ? aiTestKeyBtn.textContent : '';
    if (aiTestKeyBtn) {
      aiTestKeyBtn.disabled = true;
      aiTestKeyBtn.textContent = 'Testing...';
    }
    try {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${key}` }
      });
      const data = await res.json();
      if (res.ok && data?.data) {
        notifySuccess(`API Key valid! Usage: $${(data.data.usage || 0).toFixed(4)}.`);
      } else {
        notifyError(data?.error?.message || 'Invalid API Key.');
      }
    } catch (err) {
      notifyError('Connection failed: ' + err.message);
    } finally {
      if (aiTestKeyBtn) {
        aiTestKeyBtn.disabled = false;
        aiTestKeyBtn.textContent = btnText;
      }
    }
  }

  /**
   * Main AI Enhance trigger:
   * Edits & fixes the user's real NID images and stacks them onto a single page.
   */
  async function handleAiEnhance() {
    const state = appState.getState();
    const frontSlot = state.sources.front;
    const backSlot = state.sources.back;

    // Check if at least 1 image is loaded
    if (!frontSlot || !frontSlot.image) {
      notifyGuidance('Please upload an NID image in Image 1 (Front or Both sides) first.');
      const file1 = doc && doc.getElementById('file1');
      if (file1) file1.click();
      return;
    }

    // Check API Key
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      openSettings();
      notifyGuidance('Please configure your OpenRouter API Key to start AI Enhance.');
      return;
    }

    try {
      progress.begin();
      progress.set(10);

      const images = [];

      async function getSlotImageDataUrl(slot) {
        if (!slot || !slot.image) return null;
        if (slot.file && slot.file.type && slot.file.type.startsWith('image/')) {
          try {
            return await fileToDataUrl(slot.file);
          } catch (_e) {}
        }
        if (slot.image.src && typeof slot.image.src === 'string' && slot.image.src.startsWith('data:image/')) {
          return slot.image.src;
        }
        try {
          const w = slot.naturalWidth || slot.image.naturalWidth || slot.image.width || 1000;
          const h = slot.naturalHeight || slot.image.naturalHeight || slot.image.height || 1000;
          const cvs = doc ? doc.createElement('canvas') : document.createElement('canvas');
          cvs.width = Math.min(2400, w);
          cvs.height = Math.min(2400, Math.round((cvs.width * h) / w));
          const ctx = cvs.getContext('2d');
          ctx.drawImage(slot.image, 0, 0, cvs.width, cvs.height);
          return cvs.toDataURL('image/jpeg', 0.92);
        } catch (_e) {
          if (slot.image && slot.image.src && typeof slot.image.src === 'string') {
            return slot.image.src;
          }
          return null;
        }
      }

      // Convert image 1 to raster data url (safe for PDF renders and images)
      const d1 = await getSlotImageDataUrl(frontSlot);
      if (d1) images.push(d1);

      // Convert image 2 if loaded
      if (backSlot && backSlot.image) {
        const d2 = await getSlotImageDataUrl(backSlot);
        if (d2) images.push(d2);
      }

      const spacing = appState.getState().settings.spacing || 55;
      const bgColor = appState.getState().settings.backgroundColor || '#ffffff';

      // Run OpenRouter real image EDITING (crop/de-skew/whiten/sharpen the user's real card),
      // which internally falls back to the local coordinate-based enhancement if the image
      // model is unavailable.
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

      // Reveal preview canvas
      if (previewCanvas && previewCanvas.classList) previewCanvas.classList.remove(HIDDEN_CLASS);
      if (previewPlaceholder && previewPlaceholder.classList) previewPlaceholder.classList.add(HIDDEN_CLASS);

      // Commit combined buffer to appState
      if (typeof appState.setCombinedImage === 'function') {
        appState.setCombinedImage(previewCanvas);
      }

      // Synchronize appState sources with the enhanced cards so subsequent combine/exports retain both
      if (result.frontCanvas && typeof appState.setSource === 'function') {
        const frontImg = (typeof Image !== 'undefined') ? new Image() : result.frontCanvas;
        if (result.frontDataUrl) frontImg.src = result.frontDataUrl;
        appState.setSource('front', {
          image: frontImg,
          naturalWidth: result.frontCanvas.width,
          naturalHeight: result.frontCanvas.height
        });
      }

      if (result.backCanvas && typeof appState.setSource === 'function') {
        const backImg = (typeof Image !== 'undefined') ? new Image() : result.backCanvas;
        if (result.backDataUrl) backImg.src = result.backDataUrl;
        appState.setSource('back', {
          image: backImg,
          naturalWidth: result.backCanvas.width,
          naturalHeight: result.backCanvas.height
        });
      } else if (!result.backCanvas && typeof appState.setSource === 'function') {
        // Front-only enhance: clear any back source from a previous run.
        appState.setSource('back', null);
      }

      // Update thumbnails and source slots if extracted
      if (result.frontDataUrl) {
        const preview1 = doc && doc.getElementById('preview1');
        const thumb1 = doc && doc.getElementById('thumb1');
        const thumb1Ph = doc && doc.getElementById('thumb1Placeholder');
        if (preview1) preview1.src = result.frontDataUrl;
        if (thumb1 && thumb1.classList) {
          thumb1.src = result.frontDataUrl;
          thumb1.classList.remove(HIDDEN_CLASS);
        }
        if (thumb1Ph && thumb1Ph.classList) thumb1Ph.classList.add(HIDDEN_CLASS);
      }

      if (result.backDataUrl) {
        const preview2 = doc && doc.getElementById('preview2');
        const preview2Cont = doc && doc.getElementById('preview2-container');
        const thumb2 = doc && doc.getElementById('thumb2');
        const thumb2Ph = doc && doc.getElementById('thumb2Placeholder');
        if (preview2) preview2.src = result.backDataUrl;
        if (preview2Cont && preview2Cont.classList) preview2Cont.classList.remove(HIDDEN_CLASS);
        if (thumb2 && thumb2.classList) {
          thumb2.src = result.backDataUrl;
          thumb2.classList.remove(HIDDEN_CLASS);
        }
        if (thumb2Ph && thumb2Ph.classList) thumb2Ph.classList.add(HIDDEN_CLASS);
      } else {
        // Front-only result: clear any stale back thumbnail/preview from a previous run.
        const preview2 = doc && doc.getElementById('preview2');
        const preview2Cont = doc && doc.getElementById('preview2-container');
        const thumb2 = doc && doc.getElementById('thumb2');
        const thumb2Ph = doc && doc.getElementById('thumb2Placeholder');
        if (preview2) preview2.src = '';
        if (preview2Cont && preview2Cont.classList) preview2Cont.classList.add(HIDDEN_CLASS);
        if (thumb2 && thumb2.classList) {
          thumb2.src = '';
          thumb2.classList.add(HIDDEN_CLASS);
        }
        if (thumb2Ph && thumb2Ph.classList) thumb2Ph.classList.remove(HIDDEN_CLASS);
      }

      // Enable PDF download
      if (exportButton) {
        if (exportButton.classList) exportButton.classList.remove(HIDDEN_CLASS);
        exportButton.disabled = false;
      }
      if (typeof appState.setExportCombinedVisible === 'function') {
        appState.setExportCombinedVisible(true);
      }

      progress.set(100);
      progress.complete();
      notifySuccess('✨ Real NID images successfully enhanced & stacked without altering any information!');
    } catch (err) {
      progress.fail();
      const msg = (err && err.message) ? err.message : String(err);
      if (/lacks access to image-editing|image-model access/i.test(msg)) {
        notifyError('The image model refused or your OpenRouter key lacks image-model access. Add image-model access to your key, then try again. (' + msg + ')');
      } else {
        notifyError('AI Enhancement error: ' + msg);
      }
    }
  }

  function handleOverlayClick(e) {
    if (e.target === aiSettingsModal) closeSettings();
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      closeSettings();
    }
  }

  /**
   * Bind event listeners.
   */
  function init() {
    if (aiButton) {
      aiButton.addEventListener('click', handleAiEnhance);
    }
    if (aiSettingsBtn) {
      aiSettingsBtn.addEventListener('click', openSettings);
    }
    if (aiSettingsClose) {
      aiSettingsClose.addEventListener('click', closeSettings);
    }
    if (aiSaveSettingsBtn) {
      aiSaveSettingsBtn.addEventListener('click', handleSaveSettings);
    }
    if (aiTestKeyBtn) {
      aiTestKeyBtn.addEventListener('click', handleTestKey);
    }

    if (doc) {
      doc.addEventListener('keydown', handleKeyDown);
    }
    if (aiSettingsModal) {
      aiSettingsModal.addEventListener('click', handleOverlayClick);
    }
  }

  function destroy() {
    if (aiButton) aiButton.removeEventListener('click', handleAiEnhance);
    if (aiSettingsBtn) aiSettingsBtn.removeEventListener('click', openSettings);
    if (aiSettingsClose) aiSettingsClose.removeEventListener('click', closeSettings);
    if (aiSaveSettingsBtn) aiSaveSettingsBtn.removeEventListener('click', handleSaveSettings);
    if (aiTestKeyBtn) aiTestKeyBtn.removeEventListener('click', handleTestKey);
    if (doc) doc.removeEventListener('keydown', handleKeyDown);
    if (aiSettingsModal) aiSettingsModal.removeEventListener('click', handleOverlayClick);
  }

  return {
    init,
    destroy,
    handleAiEnhance,
    openSettings,
    closeSettings
  };
}
