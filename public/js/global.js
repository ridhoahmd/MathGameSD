// 1. INISIALISASI SOCKET GLOBAL
window.socket = io();

// 2. IDENTITAS PEMAIN GLOBAL
window.playerName = localStorage.getItem("playerName") || "Guest";

// 3. UI KONEKSI TERPUTUS (OFFLINE)
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

  // Style sederhana agar rapi (jika CSS belum memuat)
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

// Jalankan fungsi pembuatan UI saat file ini dimuat
createOfflineUI();

// 4. LOGIKA DETEKSI KONEKSI (Global)
let isReconnecting = false;

window.socket.on("disconnect", (reason) => {
  console.log("⚠️ Koneksi Global Putus:", reason);
  isReconnecting = true;
  const overlay = document.getElementById("connection-overlay");

  // Tampilkan overlay dengan display flex agar centered
  if (overlay) overlay.style.display = "flex";
});

window.socket.on("connect", () => {
  if (isReconnecting) {
    console.log("✅ Koneksi Global Tersambung Kembali!");
    isReconnecting = false;
    const overlay = document.getElementById("connection-overlay");
    if (overlay) overlay.style.display = "none";

    // Opsional: Reload halaman jika perlu data segar
    // location.reload();
  }
});

console.log("✅ Global System Loaded (Socket & Offline UI Ready)");
