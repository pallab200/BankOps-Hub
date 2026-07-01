/**
 * main.js — Application entry module for NID Stack & Enhance.
 *
 * This module replaces the old monolithic `script.js` by initializing the
 * application state, instantiating message/progress infrastructure, and wiring
 * all controllers (upload, crop, combine, adjustment, filter, export, reset)
 * to the DOM.
 *
 * All event handlers are wrapped in try/catch that route errors to
 * showError / progress.fail() so zero uncaught errors escape to the
 * browser console or runtime (Req 12.5, 12.6).
 *
 * Requirements: 12.5, 12.6
 */

// --- Core ---
import { createAppState } from './core/appState.js';

// --- Infrastructure controllers ---
import { createMessageController } from './controllers/messages.js';
import { createProgress } from './controllers/progress.js';

// --- Feature controllers ---
import { createUploadController } from './controllers/uploadController.js';
import { createCropController } from './controllers/cropController.js';
import { createCombineController } from './controllers/combineController.js';
import { initAdjustmentController } from './controllers/adjustmentController.js';
import { initFilterController } from './controllers/filterController.js';
import { createExportController } from './controllers/exportController.js';
import { createResetController } from './controllers/resetController.js';

/**
 * Boot the application. Called once on DOMContentLoaded.
 * All wiring is enclosed so any initialization error is caught and surfaced
 * rather than leaving the page in a broken state.
 */
function boot() {
  try {
    // 1. Initialize application state (single source of truth).
    const appState = createAppState();

    // 2. Instantiate the message controller against the ARIA live region.
    const messageRegionEl = document.getElementById('messageRegion');
    const messages = createMessageController(messageRegionEl);

    // 3. Instantiate the progress controller.
    const progressContainer = document.getElementById('progress');
    const progressBar = document.getElementById('progressBar');
    const progress = createProgress({
      container: progressContainer,
      bar: progressBar,
      showError: (text) => messages.showError(text),
    });

    // 4. Wire the Upload controller (click + drag-and-drop, fixes D2/D3).
    const uploadCtrl = createUploadController({
      appState,
      messages,
      progress,
      document,
    });
    uploadCtrl.init();

    // 5. Wire the Crop controller (pointer + touch + keyboard, fixes D7).
    const cropCtrl = createCropController({
      appState,
      document,
    });
    cropCtrl.init();

    // 6. Wire the Combine controller.
    const combineCtrl = createCombineController({
      appState,
      messages,
      progress,
      document,
    });
    combineCtrl.init();

    // 7. Wire the Adjustment controller (fixes D4 — non-blocking guidance).
    const adjustCtrl = initAdjustmentController(document, {
      appState,
      messages,
      progress,
    });

    // 8. Wire the Filter controller (fixes D5 — non-blocking guidance).
    const filterCtrl = initFilterController(document, {
      appState,
      messages,
    });

    // 9. Wire the Export controller (fixes D6 — correct margins).
    const exportCtrl = createExportController({
      appState,
      messages,
      document,
      window,
    });
    exportCtrl.init();

    // 10. Wire the Reset controller.
    const resetCtrl = createResetController({
      appState,
      progress,
      messages,
      document,
    });
    resetCtrl.init();

    // Store controller references on the window for debugging in dev
    // (not required by the spec, but helps during development).
    if (typeof window !== 'undefined') {
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
        resetCtrl,
      };
    }
  } catch (err) {
    // Catastrophic initialization failure — surface via the console only
    // because the message region may not be available yet.
    // eslint-disable-next-line no-console
    console.error('[NID Stack & Enhance] Initialization failed:', err);

    // Attempt to show a user-visible message if the message region exists.
    try {
      const region = document.getElementById('messageRegion');
      if (region) {
        region.textContent =
          'Application failed to initialize. Please refresh the page.';
        region.setAttribute('role', 'alert');
        region.hidden = false;
      }
    } catch (_ignored) {
      /* nothing more we can do */
    }
  }
}

// --- Entry point ---
// Wait for the DOM to be fully parsed before wiring controllers.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  // DOM already ready (e.g. script loaded with defer or at end of body).
  boot();
}
