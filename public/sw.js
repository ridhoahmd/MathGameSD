const CACHE_NAME = 'videa-class-final-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/kasir.css',
  '/css/labirin.css',
  '/css/nabi.css',
  '/css/ayat.css',
  '/js/audio.js',
  '/logo-videa.png'
];

// 1. INSTALL DETEKTIF: Cek file satu per satu
self.addEventListener('install', event => {
  self.skipWaiting(); // Paksa update segera

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('🔍 MEMERIKSA FILE SATU PER SATU...');
      
      for (const url of urlsToCache) {
        try {
          // Coba ambil file dari server
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`Status: ${response.status}`);
          }
          
          // Jika sukses, simpan ke cache
          await cache.put(url, response);
          console.log(`✅ SUKSES: ${url}`);
          
        } catch (error) {
          // INI DIA PELAKUNYA!
          console.error(`❌ GAGAL (FILE HILANG): ${url} ->`, error.message);
        }
      }
    })
  );
});

// 2. ACTIVATE (Standar)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    )).then(() => self.clients.claim())
  );
});

// 3. FETCH (Standar)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/socket.io/')) return;

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});