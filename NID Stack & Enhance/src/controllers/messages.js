// messages.js — non-blocking message region controller (glue, thin)
//
// A single ARIA live region replaces every alert()/confirm()/prompt() call in
// the application. Guidance uses role="status" (polite) so it is announced
// without stealing focus; errors use role="alert" (assertive). Guidance can be
// held visible for a minimum duration (filter guidance >= 3 s, Req 6.4) so it is
// not cleared out from under the user before it can be read.
//
// The controller is created via a factory that receives the live-region element,
// keeping it free of any global lookups so it can be exercised under jsdom.
//
// Requirements: 5.3, 5.5, 6.4, 9.6, 12.1, 12.4

/** Default minimum visible duration for guidance messages, in milliseconds. */
export const DEFAULT_MIN_VISIBLE_MS = 3000;

/** CSS class toggled to make the region visually visible. */
const VISIBLE_CLASS = 'is-visible';

/**
 * Create a message controller bound to a live-region DOM element.
 *
 * @param {HTMLElement} liveRegionEl - The element used as the ARIA live region.
 * @returns {{
 *   showGuidance: (text: string, options?: { minVisibleMs?: number }) => void,
 *   showError: (text: string) => void,
 *   clearMessage: () => void,
 *   readonly element: HTMLElement
 * }}
 */
export function createMessageController(liveRegionEl) {
  if (!liveRegionEl) {
    throw new Error('createMessageController requires a live region element');
  }

  // Pending deferred-clear timer id, or null when none is scheduled.
  let clearTimerId = null;
  // Timestamp (ms) before which the current message must remain visible.
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
    // Any new message supersedes a queued clear.
    cancelPendingClear();
    liveRegionEl.textContent = text;
    liveRegionEl.setAttribute('role', role);
    liveRegionEl.setAttribute('aria-live', ariaLive);
    liveRegionEl.setAttribute('data-message-type', type);
    liveRegionEl.classList.add(VISIBLE_CLASS);
    liveRegionEl.hidden = false;
  }

  function doClear() {
    liveRegionEl.textContent = '';
    liveRegionEl.classList.remove(VISIBLE_CLASS);
    liveRegionEl.hidden = true;
    liveRegionEl.removeAttribute('data-message-type');
  }

  /**
   * Show non-blocking guidance (role="status"). The message is held visible for
   * at least `minVisibleMs` so a later clearMessage() will defer until elapsed.
   */
  function showGuidance(text, options = {}) {
    const requested = options && options.minVisibleMs;
    const minVisibleMs =
      typeof requested === 'number' && Number.isFinite(requested) && requested >= 0
        ? requested
        : DEFAULT_MIN_VISIBLE_MS;
    render(toText(text), 'status', 'polite', 'guidance');
    minVisibleUntil = nowMs() + minVisibleMs;
  }

  /**
   * Show an error (role="alert"). Errors take priority: they display immediately
   * and are not held by any minimum-visible lock.
   */
  function showError(text) {
    minVisibleUntil = 0;
    render(toText(text), 'alert', 'assertive', 'error');
  }

  /**
   * Clear the current message. If a guidance minimum-visible window is still
   * active, the clear is deferred until that window elapses.
   */
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
    showGuidance,
    showError,
    clearMessage,
    get element() {
      return liveRegionEl;
    },
  };
}

function toText(value) {
  return value === null || value === undefined ? '' : String(value);
}

// --- Module-level singleton convenience API -------------------------------
// Mirrors the design's module-level surface (showGuidance/showError/clearMessage)
// while still routing through a controller bound to a real element via init.

let defaultController = null;

/**
 * Initialize the module-level message API against a live-region element.
 * @param {HTMLElement} liveRegionEl
 * @returns {ReturnType<typeof createMessageController>}
 */
export function initMessages(liveRegionEl) {
  defaultController = createMessageController(liveRegionEl);
  return defaultController;
}

function ensureController() {
  if (!defaultController) {
    throw new Error('Message controller not initialized; call initMessages(element) first');
  }
  return defaultController;
}

export function showGuidance(text, options) {
  return ensureController().showGuidance(text, options);
}

export function showError(text) {
  return ensureController().showError(text);
}

export function clearMessage() {
  return ensureController().clearMessage();
}
