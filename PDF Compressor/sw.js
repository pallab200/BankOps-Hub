// Service Worker for offline caching of the PDF Compressor app.
const CACHE_NAME = 'pdf-compressor-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './New Text Document.html',
  './manifest.json',
  './assets/tailwind.min.css',
  './assets/pdf.min.js',
  './assets/pdf.worker.min.js',
  './assets/jspdf.umd.min.js',
  './assets/fonts/Inter.woff2',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
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
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Put a copy in the cache for offline use
        return caches.open(CACHE_NAME).then((cache) => {
          try {
            // Clone before caching
            cache.put(event.request, response.clone());
          } catch (e) {
            // Some requests (opaque/cross-origin) may fail to be cached
          }
          return response;
        });
      }).catch(() => {
        // If fetch fails, optionally return an offline fallback (not provided)
        return caches.match('./New Text Document.html');
      });
    })
  );
});
