// 1. KONEKSI SOCKET UTAMA
try {
  window.socket = typeof io !== "undefined" ? io() : null;
} catch (e) {
  console.error("⚠️ Socket.io gagal dimuat. Server mungkin down.", e);
  window.socket = null;
}

// 2. NAMA PLAYER
window.playerName = localStorage.getItem("playerName") || "Guest";

// 3. TAMPILAN KALO OFFLINE
function createOfflineUI() {
  if (document.getElementById("connection-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "connection-overlay";
  overlay.style.display = "none"; // Default sembunyi
  overlay.innerHTML = `
        <div class="wifi-icon" style="font-size: 3rem; margin-bottom: 10px;">📡</div>
        <div class="conn-text" style="font-size: 1.5rem; font-weight: bold;">KONEKSI TERPUTUS</div>
        <div class="conn-sub">Sedang mencoba menghubungkan kembali...</div>
    `;

  // Style sederhana biar rapi
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.85)";
  overlay.style.color = "white";
  overlay.style.zIndex = "9999";
  overlay.style.flexDirection = "column";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";

  document.body.appendChild(overlay);
}

// Bikin UI offline pas diload
createOfflineUI();

// 4. DETEKSI PUTUS/NYAMBUNG
let isReconnecting = false;

window.socket.on("disconnect", (reason) => {
  console.log("⚠️ Putus koneksi:", reason);
  isReconnecting = true;
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

console.log("✅ Sistem Global Siap (Socket & Offline UI)");
