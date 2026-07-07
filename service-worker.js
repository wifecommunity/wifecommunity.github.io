// W.I.F.E PWA Service Worker
const CACHE_NAME = 'wife-pwa-cache-v1';
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/maskable-icon-192.png',
  './icons/maskable-icon-512.png',
  './icons/apple-touch-icon.png'
];

// Install: pre-cache app shell
self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(APP_SHELL).catch(function(err) {
        // Jangan gagalkan instalasi jika salah satu file gagal di-cache
        console.warn('SW precache warning:', err);
      });
    })
  );
});

// Activate: bersihkan cache versi lama
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Fetch strategy:
// - Halaman HTML (navigasi): network-first supaya data selalu update, fallback ke cache saat offline
// - Aset lain (ikon dsb.): cache-first
// - Request ke Firebase/Cloudinary/API eksternal: langsung ke network, tidak di-cache
self.addEventListener('fetch', function(event) {
  var req = event.request;
  if(req.method !== 'GET') return;

  var url = new URL(req.url);
  var isSameOrigin = url.origin === self.location.origin;

  if(!isSameOrigin) {
    // Biarkan request eksternal (Firebase, Cloudinary, Google Fonts, dll) apa adanya
    return;
  }

  if(req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req).then(function(res) {
        var resClone = res.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(req, resClone); });
        return res;
      }).catch(function() {
        return caches.match(req).then(function(cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(function(cached) {
      return cached || fetch(req).then(function(res) {
        var resClone = res.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(req, resClone); });
        return res;
      }).catch(function() { return cached; });
    })
  );
});
