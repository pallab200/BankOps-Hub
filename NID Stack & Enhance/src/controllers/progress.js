/**
 * progress.js — thin controller wrapping the Progress_Indicator DOM element.
 *
 * The Progress_Indicator communicates the status of in-progress operations
 * (image load, combine). This controller is intentionally a thin layer of DOM
 * glue around a small, deterministic state model so it can be exercised under
 * jsdom: elements and timers are supplied through `createProgress(...)` rather
 * than reached for via globals, keeping the module testable in isolation.
 *
 * Lifecycle (design.md "Progress Indicator"):
 *   begin()        -> become visible, display 0%                       (Req 9.5)
 *   set(p)         -> non-decreasing within an operation, clamped 0-100 (Req 9.2)
 *   complete()     -> display 100%, then hide within 1 s               (Req 9.1, 9.3, 9.4)
 *   fail(message?) -> hide within 1 s and surface a "did not complete"
 *                     message                                          (Req 9.6)
 *   reset()        -> immediately hide and clear any partial value     (Req 8.3 support)
 *
 * Property 12 (progress monotonicity): within a single operation the displayed
 * value never decreases and always lies in [0, 100]. `set()` enforces this by
 * clamping to [0, 100] and taking the maximum of the requested value and the
 * current displayed value. `begin()` starts a new operation, resetting the
 * monotonic floor to 0.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */

/**
 * Maximum time (ms) the indicator may stay shown after an operation finishes.
 * Req 9.4 requires it not remain below 100% for longer than 1 s after the
 * operation ends; complete()/fail() must hide within 1 s. We default well
 * under the 1 s ceiling and clamp any caller-supplied value to <= 1000 ms.
 */
export const HIDE_CEILING_MS = 1000;
export const DEFAULT_HIDE_DELAY_MS = 600;

/** Default message surfaced when an operation fails mid-progress (Req 9.6). */
export const DEFAULT_FAIL_MESSAGE = 'The operation did not complete.';

/** Clamp a numeric value into [min, max], tolerating non-finite input. */
function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/**
 * Create a Progress_Indicator controller bound to the supplied DOM elements.
 *
 * All collaborators are injected so the controller is fully testable under
 * jsdom and so timing can be driven deterministically in tests.
 *
 * @param {Object} [options]
 * @param {Element|null} [options.container] - The progress wrapper element.
 *   Visibility is toggled on this element (or on `bar` if omitted).
 * @param {Element|null} [options.bar] - The fill element whose width reflects
 *   the current percentage. ARIA value attributes are mirrored here.
 * @param {Element|null} [options.label] - Optional element whose text content
 *   displays the current percentage (e.g. "42%").
 * @param {number} [options.hideDelayMs] - Delay before hiding after
 *   complete()/fail(). Clamped to (0, 1000] ms to honor Req 9.4.
 * @param {(message: string) => void} [options.showError] - Callback used by
 *   fail() to surface a non-blocking error message (wired to messages.js by
 *   the integration layer). Defaults to a no-op.
 * @param {(cb: Function, ms: number) => any} [options.setTimeoutFn] - Timer
 *   scheduler (defaults to global setTimeout). Injectable for tests.
 * @param {(handle: any) => void} [options.clearTimeoutFn] - Timer canceller
 *   (defaults to global clearTimeout). Injectable for tests.
 * @returns {{
 *   begin: () => void,
 *   set: (p: number) => number,
 *   complete: () => void,
 *   fail: (message?: string) => void,
 *   reset: () => void,
 *   getValue: () => number,
 *   isVisible: () => boolean
 * }}
 */
export function createProgress(options = {}) {
  const {
    container = null,
    bar = null,
    label = null,
    hideDelayMs = DEFAULT_HIDE_DELAY_MS,
    showError = () => {},
    setTimeoutFn,
    clearTimeoutFn,
  } = options;

  // Resolve timer collaborators. Fall back to globals when available.
  const schedule =
    typeof setTimeoutFn === 'function'
      ? setTimeoutFn
      : typeof setTimeout === 'function'
        ? setTimeout
        : null;
  const cancel =
    typeof clearTimeoutFn === 'function'
      ? clearTimeoutFn
      : typeof clearTimeout === 'function'
        ? clearTimeout
        : null;

  // The hide delay must be strictly positive and never exceed the 1 s ceiling.
  const resolvedHideDelay = clamp(hideDelayMs, 1, HIDE_CEILING_MS);

  // The element on which visibility is toggled.
  const visibilityEl = container || bar || null;

  // Internal state model.
  let value = 0; // current displayed percentage, the monotonic floor
  let visible = false;
  let hideTimer = null;

  function cancelPendingHide() {
    if (hideTimer !== null && cancel) {
      cancel(hideTimer);
    }
    hideTimer = null;
  }

  /** Reflect the current value onto the bar/label DOM. */
  function renderValue() {
    const pct = Math.round(value);
    if (bar) {
      bar.style.width = `${pct}%`;
      bar.setAttribute('aria-valuenow', String(pct));
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
    }
    if (visibilityEl && visibilityEl !== bar) {
      visibilityEl.setAttribute('aria-valuenow', String(pct));
    }
    if (label) {
      label.textContent = `${pct}%`;
    }
  }

  /** Reflect visibility onto the DOM (uses the `hidden` attribute + a class). */
  function renderVisibility() {
    if (!visibilityEl) return;
    if (visible) {
      visibilityEl.hidden = false;
      visibilityEl.removeAttribute('aria-hidden');
      visibilityEl.classList.add('is-visible');
    } else {
      visibilityEl.hidden = true;
      visibilityEl.setAttribute('aria-hidden', 'true');
      visibilityEl.classList.remove('is-visible');
    }
  }

  /**
   * Begin a new operation: cancel any pending hide, reset the monotonic floor
   * to 0, and become visible at 0%. (Req 9.5)
   */
  function begin() {
    cancelPendingHide();
    value = 0;
    visible = true;
    renderVisibility();
    renderValue();
  }

  /**
   * Set the progress value for the current operation. The result is clamped to
   * [0, 100] and never moves backward (non-decreasing within an operation).
   * (Req 9.2 / Property 12)
   *
   * @param {number} p - requested percentage.
   * @returns {number} the displayed value after clamping and the monotonic guard.
   */
  function set(p) {
    const requested = clamp(p, 0, 100);
    // Non-decreasing within an operation: never move backward.
    value = Math.max(value, requested);
    renderValue();
    return value;
  }

  /**
   * Complete the operation: jump to 100% and hide within 1 s. (Req 9.1, 9.3, 9.4)
   */
  function complete() {
    cancelPendingHide();
    value = 100;
    visible = true;
    renderVisibility();
    renderValue();
    scheduleHide();
  }

  /**
   * Fail the operation before reaching 100%: hide within 1 s and surface a
   * non-blocking "did not complete" message. (Req 9.6)
   *
   * @param {string} [message] - optional custom message.
   */
  function fail(message) {
    cancelPendingHide();
    const text =
      typeof message === 'string' && message.length > 0
        ? message
        : DEFAULT_FAIL_MESSAGE;
    try {
      showError(text);
    } catch (_err) {
      // A failure in the message channel must not throw out of fail().
    }
    scheduleHide();
  }

  /** Schedule the indicator to hide after the resolved delay (<= 1 s). */
  function scheduleHide() {
    if (!schedule) {
      // No timer available: hide immediately so we never linger below 100%.
      hide();
      return;
    }
    hideTimer = schedule(() => {
      hideTimer = null;
      hide();
    }, resolvedHideDelay);
  }

  /** Hide the indicator and clear any partial value. */
  function hide() {
    visible = false;
    value = 0;
    renderVisibility();
    renderValue();
  }

  /**
   * Immediately reset to the hidden, no-partial-value state. Used by the clear
   * control to return the indicator to its default state. (supports Req 8.3)
   */
  function reset() {
    cancelPendingHide();
    hide();
  }

  // Initialize DOM to the hidden default state.
  reset();

  return {
    begin,
    set,
    complete,
    fail,
    reset,
    getValue: () => value,
    isVisible: () => visible,
  };
}

export default createProgress;
