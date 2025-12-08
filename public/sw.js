const CACHE_NAME = 'videa-class-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/kasir.css',
  '/css/labirin.css',
  '/css/nabi.css',
  '/css/ayat.css',
  '/js/audio.js'
];

// 1. INSTALL SERVICE WORKER
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Gunakan catch agar jika ada file hilang, SW tetap jalan
        return cache.addAll(urlsToCache).catch(err => console.error("Gagal cache file:", err));
      })
  );
});

// 2. AKTIVASI & BERSIHKAN CACHE LAMA
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 3. FETCH (BAGIAN PENTING UNTUK FIX ERROR)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // --- SOLUSI ERROR SOCKET.IO ---
  // Jika request mengarah ke socket.io, JANGAN di-intercept oleh Service Worker.
  // Biarkan browser menanganinya secara langsung (Network Only).
  if (url.pathname.startsWith('/socket.io/') || url.href.includes('transport=polling')) {
    return; 
  }

  // Untuk request lain (gambar, css, html), coba cari di cache dulu
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache Hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});