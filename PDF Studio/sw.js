// Service Worker for offline caching of the PDF Studio app.
const CACHE_NAME = 'pdf-studio-v4';
const PRECACHE_URLS = [
  './',
  './PDF Studio.html',
  './PDF Compressor.html',
  './index.html',
  './manifest.json',
  './assets/tailwind.min.css',
  './assets/pdf.min.js',
  './assets/pdf.worker.min.js',
  './assets/jspdf.umd.min.js',
  './assets/pdf-lib.min.js',
  './assets/jszip.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS.map(u => new Request(u, { cache: 'reload' }))).catch(err => {
        console.warn('Some assets failed to cache on install:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        return caches.open(CACHE_NAME).then((cache) => {
          try {
            cache.put(event.request, response.clone());
          } catch (e) {
            // Ignore opaque or cross-origin errors
          }
          return response;
        });
      }).catch(() => {
        return caches.match('./PDF Studio.html') || caches.match('./PDF Compressor.html');
      });
    })
  );
});
