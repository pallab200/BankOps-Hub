// Content Script for e-GP Auto Fetcher Extension
// Injected into Credit Commitment and local web pages

(function () {
  'use strict';

  // Mark extension presence on the document element
  try {
    document.documentElement.setAttribute('data-egp-extension', 'active');
  } catch (_) {}

  // Broadcast readiness to page scripts
  function announceReady() {
    window.postMessage({ type: 'EGP_EXTENSION_CONNECTED', version: '1.0.0' }, '*');
  }

  announceReady();
  window.addEventListener('DOMContentLoaded', announceReady);
  window.addEventListener('load', announceReady);

  // Relay messages between web page and background service worker
  window.addEventListener('message', function (event) {
    if (event.source !== window || !event.data) return;

    if (event.data.type === 'EGP_PING_EXTENSION') {
      chrome.runtime.sendMessage({ action: 'PING' }, function (response) {
        window.postMessage({
          type: 'EGP_PONG_EXTENSION',
          reqId: event.data.reqId,
          active: true,
          version: (response && response.version) || '1.0.0'
        }, '*');
      });
      return;
    }

    if (event.data.type === 'EGP_FETCH_REQUEST') {
      const reqId = event.data.reqId;
      const tenderId = event.data.tenderId;

      try {
        chrome.runtime.sendMessage(
          { action: 'FETCH_EGP_TENDER', tenderId: tenderId },
          function (response) {
            const err = chrome.runtime.lastError;
            if (err) {
              window.postMessage({
                type: 'EGP_FETCH_RESPONSE',
                reqId: reqId,
                tenderId: tenderId,
                success: false,
                error: err.message || 'Extension connection error'
              }, '*');
              return;
            }

            window.postMessage({
              type: 'EGP_FETCH_RESPONSE',
              reqId: reqId,
              tenderId: tenderId,
              success: response && response.success,
              data: response && response.data,
              error: response && response.error
            }, '*');
          }
        );
      } catch (e) {
        window.postMessage({
          type: 'EGP_FETCH_RESPONSE',
          reqId: reqId,
          tenderId: tenderId,
          success: false,
          error: e.message
        }, '*');
      }
    }
  });
})();
