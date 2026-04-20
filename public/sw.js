const CACHE_NAME = "videa-class-master-v9";

const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
  "/logo-videa.png",
  "/explosion.mp3",

  // --- HTML Pages ---
  "/html/ayat.html",
  "/html/bintang.html",
  "/html/guru.html",
  "/html/kasir.html",
  "/html/labirin-phaser.html",
  "/html/leaderboard.html",
  "/html/math.html",
  "/html/memory.html",
  "/html/nabi.html",
  "/html/piano.html",
  "/html/tajwid.html",
  "/html/toko.html",
  "/html/zuma-phaser.html",

  // --- CSS Styles (Core & Features) ---
  "/css/style.css",
  "/css/design-tokens.css",
  "/css/base.css",
  "/css/variables.css",
  "/css/loading.css",
  "/css/micro-interactions.css",
  "/css/responsive.css",
  "/css/sidebar-fixes.css",
  "/css/visual-enhancements.css",
  "/css/visual-overhaul.css",
  "/css/chat-enhanced.css",
  "/css/decorative-objects.css",
  "/css/streak-effects.css",

  // --- CSS Styles (Games) ---
  "/css/ayat.css",
  "/css/ayat-versus.css",
  "/css/bintang.css",
  "/css/guru.css",
  "/css/kasir.css",
  "/css/labirin-phaser.css",
  "/css/leaderboard.css",
  "/css/math.css",
  "/css/memory.css",
  "/css/nabi.css",
  "/css/nabi-versus.css",
  "/css/piano.css",
  "/css/tajwid.css",
  "/css/tajwid-versus.css",
  "/css/toko.css",
  "/css/versus-enhancements.css",
  "/css/zuma-phaser.css",

  // --- JavaScript Logic (Core & Utils) ---
  "/js/config.js",
  "/js/global.js",
  "/js/audio.js",
  "/js/dashboard.js",
  "/js/utils/animations.js",
  "/js/utils/loading.js",
  "/js/utils/confetti.js",
  "/js/utils/ui.js",
  "/js/utils/comboManager.js",
  "/js/utils/hintSystem.js",
  "/js/utils/particleEffects.js",

  // --- JavaScript Logic (Gamification) ---
  "/js/gamification/achievements.js",
  "/js/gamification/streaks.js",
  "/js/gamification/leveling.js",

  // --- JavaScript Logic (Games) ---
  "/js/ayat.js",
  "/js/ayat-versus.js",
  "/js/bintang.js",
  "/js/game.js",
  "/js/kasir.js",
  "/js/labirin-phaser.js",
  "/js/memory.js",
  "/js/nabi.js",
  "/js/nabi-versus.js",
  "/js/piano.js",
  "/js/tajwid.js",
  "/js/tajwid-versus.js",
  "/js/toko.js",
  "/js/zuma-phaser.js",
];

// 1. INSTALL: Cache semua aset statis
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache satu per satu agar satu file gagal tidak blokir yang lain
      const results = await Promise.allSettled(
        urlsToCache.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`⚠️ SW: Gagal cache ${url}:`, err.message);
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        console.warn(`⚠️ SW: ${failed} file gagal dicache, tapi SW tetap aktif.`);
      } else {
        console.log("✅ SW v9: Semua file berhasil dicache.");
      }
    })
  );
});

// 2. ACTIVATE: Hapus cache lama
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              console.log("🗑️ SW: Menghapus cache lama:", key);
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// 3. FETCH: Strategi "Network First, Cache Fallback"
// - Prioritaskan jaringan agar konten selalu fresh
// - Fallback ke cache jika offline
self.addEventListener("fetch", (event) => {
  if (!event.request.url.startsWith("http")) {
    return;
  }

  // Jangan intercept socket.io, firebase, atau API calls
  if (
    event.request.url.includes("/api/") ||
    event.request.url.includes("socket.io") ||
    event.request.url.includes("firebase") ||
    event.request.url.includes("dicebear")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Update cache di background kalau dapat respon valid
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === "basic"
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Offline fallback: pakai cache
        return caches.match(event.request);
      })
  );
});
