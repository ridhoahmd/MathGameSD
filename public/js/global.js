// 1. KONEKSI SOCKET UTAMA
try {
  if (typeof io !== "undefined") {
    // Check for auth token (untuk GURU/ADMIN yang login)
    const authToken = localStorage.getItem("authToken");

    if (authToken) {
      // Authenticated connection dengan token
      window.socket = io({
        auth: { token: authToken },
      });
      console.log("✅ Socket connected dengan autentikasi");
    } else {
      // Guest connection (siswa biasa)
      window.socket = io();
    }
  } else {
    window.socket = null;
  }
} catch (e) {
  console.error("⚠️ Socket.io gagal dimuat. Server mungkin down.", e);
  window.socket = null;
}

// 2. NAMA PLAYER
window.playerName = localStorage.getItem("playerName") || "Guest";

// ============================================
// 🔧 GAME UTILS - ANTI-SPAM PROTECTION
// ============================================
window.GameUtils = {
  /**
   * Create click guard untuk prevent spam clicking
   * @param {Function} callback - Function yang akan dipanggil
   * @param {Number} cooldown - Cooldown time in ms (default 300ms)
   * @returns {Function} Protected function
   */
  createClickGuard: function (callback, cooldown = 300) {
    let isProcessing = false;
    let timeout = null;

    return function (...args) {
      if (isProcessing) {
        console.log("⏳ Action sedang diproses, harap tunggu...");
        return;
      }

      isProcessing = true;
      callback.apply(this, args);

      clearTimeout(timeout);
      timeout = setTimeout(() => {
        isProcessing = false;
      }, cooldown);
    };
  },
};

console.log("✅ GameUtils loaded (Anti-spam protection ready)");

// 3. TAMPILAN KALO OFFLINE
function createOfflineUI() {
  if (document.getElementById("connection-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "connection-overlay";
  overlay.style.display = "none"; // Default sembunyi
  overlay.innerHTML = `
    <div class="loading-spinner" style="width: 60px; height: 60px; border: 4px solid rgba(0, 242, 255, 0.2); border-top-color: #00f2ff; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
    <div class="wifi-icon" style="font-size: 3rem; margin-bottom: 10px;">📡</div>
    <div class="conn-text" style="font-size: 1.5rem; font-weight: bold; font-family: 'Orbitron', sans-serif; color: #00f2ff;">KONEKSI TERPUTUS</div>
    <div class="conn-sub" style="margin-top: 10px; color: #aaa;">Sedang mencoba menghubungkan kembali...</div>
    <button onclick="location.reload()" style="margin-top: 20px; padding: 12px 24px; background: #00f2ff; color: #000; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1rem;">🔄 REFRESH MANUAL</button>
  `;

  // Style sederhana biar rapi
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.9)";
  overlay.style.backdropFilter = "blur(10px)";
  overlay.style.color = "white";
  overlay.style.zIndex = "9999";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";

  // Add spin animation
  const style = document.createElement("style");
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(overlay);
}

// EMERGENCY FIX: DO NOT create overlay on page load!
// Only create when actually disconnected
// createOfflineUI(); // REMOVED - was causing production outage

// 4. DETEKSI PUTUS/NYAMBUNG
let isReconnecting = false;

if (window.socket) {
  window.socket.on("disconnect", (reason) => {
    console.log("⚠️ Putus koneksi:", reason);
    isReconnecting = true;

    // Create overlay if not exists
    if (!document.getElementById("connection-overlay")) {
      createOfflineUI();
    }

    const overlay = document.getElementById("connection-overlay");
    // Tampilkan overlay
    if (overlay) overlay.style.display = "flex";
  });

  window.socket.on("connect", () => {
    if (isReconnecting) {
      console.log("✅ Nyambung lagi!");
      isReconnecting = false;
      const overlay = document.getElementById("connection-overlay");
      if (overlay) overlay.style.display = "none";
    }
  });
}

console.log("✅ Sistem Global Siap (Socket & Offline UI & GameUtils)");
