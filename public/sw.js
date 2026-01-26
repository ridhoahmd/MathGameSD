const CACHE_NAME = 'videa-class-master-v6'; 

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo-videa.png',
  '/explosion.mp3',

  // --- HTML Pages ---
  '/guru.html',
  '/kasir.html',
  '/labirin.html',
  '/leaderboard.html',
  '/math.html',
  '/memory.html',
  '/nabi.html',
  '/piano.html',
  '/tajwid.html',
  '/toko.html',
  '/zuma.html',

  // --- CSS Styles ---
  '/css/style.css',
  '/css/guru.css',
  '/css/kasir.css',
  '/css/labirin.css',
  '/css/leaderboard.css',
  '/css/math.css',
  '/css/memory.css',
  '/css/nabi.css',
  '/css/piano.css',
  '/css/tajwid.css',
  '/css/toko.css',
  '/css/zuma.css',

  // --- JavaScript Logic ---
  '/js/config.js',
  '/js/audio.js',
  '/js/dashboard.js',  
  '/js/game.js',       
  '/js/kasir.js',
  '/js/labirin.js',
  '/js/memory.js',
  '/js/nabi.js',
  '/js/piano.js',
  '/js/tajwid.js',
  '/js/zuma.js',
  
  
];

// 1. INSTALL: Cache semua aset statis
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('📦 SW: Caching semua file game...');
      try {
          return await cache.addAll(urlsToCache);
      } catch (err) {
          console.error("❌ Gagal Cache:", err);
      }
    })
  );
});

// 2. ACTIVATE: Hapus cache lama (v4, v3, dll)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) {
            console.log('🗑️ SW: Menghapus cache lama:', key);
            return caches.delete(key);
        }
      })
    )).then(() => self.clients.claim())
  );
});

// 3. FETCH: Strategi "Stale-While-Revalidate" (Pakai Cache dulu, lalu update di background)
self.addEventListener('fetch', event => {
    if (!event.request.url.startsWith('http')) {
        return;
    }

    if (event.request.url.includes('/api/') || 
        event.request.url.includes('socket.io') ||
        event.request.url.includes('firebase')) {
        return; 
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
            });

            return cachedResponse || fetchPromise; 
        })
    );
});