const CACHE_NAME = 'videa-game-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css', // Jika ada file css terpisah
  '/logo-videa.png.png',
  '/math.html',
  '/zuma.html',
  '/memory.html'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Membuka cache...');
        return cache.addAll(urlsToCache);
      })
  );
});

// Aktivasi & Bersihkan Cache Lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Strategi: Network First, Fallback to Cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});