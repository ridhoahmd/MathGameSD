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
      // Socket connected with auth;
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
        // Action throttled;
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

// GameUtils loaded;

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

// Overlay dibuat hanya saat disconnect, bukan saat page load

// 4. DETEKSI PUTUS/NYAMBUNG
let isReconnecting = false;

if (window.socket) {
  window.socket.on("disconnect", (reason) => {
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
      // Socket reconnected;
      isReconnecting = false;
      const overlay = document.getElementById("connection-overlay");
      if (overlay) overlay.style.display = "none";
    }
  });
}

// Sistem Global Siap;

// --- 8. GLOBAL THEME MANAGER (NEW: Default Royal) ---
(function () {
  try {
    const DEFAULT_THEME = "royal"; // Royal Islamic - Premium
    let currentTheme = localStorage.getItem("selectedTheme");

    // If no theme set (First Visit), set default to Royal
    if (!currentTheme) {
      currentTheme = DEFAULT_THEME;
      localStorage.setItem("selectedTheme", DEFAULT_THEME);
    }

    // Apply Theme Class
    if (currentTheme && currentTheme !== "default") {
      document.body.classList.add("theme-" + currentTheme);
    }
  } catch (e) {
    console.error("Gagal load tema global:", e);
  }
})();

// ============================================
// 🚀 QUICK WIN: Mencegah Backspace Keluar Game
// ============================================
document.addEventListener("keydown", function (e) {
  if (e.key === "Backspace" || e.keyCode === 8) {
    // Biarkan backspace bekerja NORMAL jika sedang mengetik di input box
    const tag = e.target.tagName.toLowerCase();
    const isInput =
      tag === "input" || tag === "textarea" || e.target.isContentEditable;

    if (!isInput) {
      // Jika di luar input, cegah browser melakukan aksi "Kembali ke hal sebelum"
      e.preventDefault();
      // Backspace navigation blocked;
    }
  }
});

// ============================================
// 🚨 ADMIN & GURU REAL-TIME COMMANDS
// ============================================
if (window.socket) {
  // 1. KICK / BANNED USER LOGIC
  window.socket.on("kickUser", (bannedName) => {
    const myName = localStorage.getItem("playerName");
    if (myName === bannedName) {
      document.body.innerHTML = `
        <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:#1a1a1a;color:#ff4444;display:flex;flex-direction:column;justify-content:center;align-items:center;z-index:9999999;font-family:'Orbitron',sans-serif;">
          <h1 style="font-size:3rem;text-align:center;">🚫 AKSES DIBLOKIR 🚫</h1>
          <p style="font-size:1.2rem;color:white;text-align:center;margin-top:20px;">Akun Anda sementara telah ditangguhkan oleh Guru/Admin.</p>
          <button onclick="location.href='/'" style="margin-top:30px;padding:10px 20px;background:#ff4444;color:white;border:none;border-radius:5px;font-weight:bold;cursor:pointer;">KEMBALI KE BERANDA</button>
        </div>
      `;
      // Putuskan koneksi dari server secara paksa
      window.socket.disconnect();
      if (typeof auth !== "undefined") {
         auth.signOut();
      }
    }
  });

  // 2. SOAL BARU REAL TIME NOTIFIKASI
  window.socket.on("soalBaruTersedia", (data) => {
    if (typeof Swal !== "undefined") {
      const isDashboard = window.location.pathname === "/" || window.location.pathname.includes("index.html");
      const inTargetGame = window.location.pathname.includes(data.game);
      
      if (isDashboard || inTargetGame) {
        Swal.fire({
          title: "📚 Tantangan Baru Tersedia!",
          html: `Guru baru saja merilis/menyimpan soal khusus untuk game <strong style="color:#00f2ff">${data.game.toUpperCase()}</strong>! (Level: ${data.level})`,
          icon: "info",
          background: "#1e1e2e",
          color: "#fff",
          confirmButtonColor: "#00f2ff",
          confirmButtonText: inTargetGame ? "Refresh Soal!" : "Mengerti"
        }).then(() => {
          if (inTargetGame) {
            window.location.reload(); // Refresh halaman agar menyedot DB baru
          }
        });
      }
    }
  });
}

// ============================================
// CROSS-2: Global Toast Notifikasi Koneksi (Non-Blocking)
// ============================================
function showGlobalToast(msg, type) {
  const t = document.createElement("div");
  t.style.cssText = "position:fixed;bottom:24px;left:50%;" +
    "transform:translateX(-50%) translateY(80px);" +
    "padding:10px 22px;border-radius:8px;font-weight:bold;" +
    "font-family:Poppins,sans-serif;font-size:0.9rem;z-index:99999;" +
    "transition:transform 0.3s ease,opacity 0.3s ease;" +
    "opacity:0;white-space:nowrap;pointer-events:none;" +
    "box-shadow:0 4px 12px rgba(0,0,0,0.4);";
  t.style.background = type === "warning" ? "#e17055"
    : type === "success" ? "#00b894" : "#636e72";
  t.style.color = "white";
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => {
    t.style.transform = "translateX(-50%) translateY(0)";
    t.style.opacity = "1";
  });
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateX(-50%) translateY(80px)";
    setTimeout(() => t.remove(), 300);
  }, 3500);
}
window.showGlobalToast = showGlobalToast;

if (window.socket) {
  // Notifikasi koneksi error (non-blocking toast)
  window.socket.on("connect_error", () =>
    showGlobalToast("⚠️ Gagal terhubung ke server...", "warning"));

  // 🔧 FIX [8]: Reconnect handler - re-register sesi game jika terputus di tengah permainan
  window.socket.on("reconnect", () => {
    showGlobalToast("✅ Terhubung kembali!", "success");

    // Re-register sesi game yang sedang aktif agar server kembali menerima simpanSkor
    if (window._activeGameSlug) {
      window.socket.emit("mulaiGame", window._activeGameSlug);
    }
  });

  // 🔧 FIX [3]: Global handler untuk errorSkor - tampil sebagai toast agar user tau
  // Menangani penolakan skor oleh server (sesi tidak valid, speedhack, dll)
  window.socket.on("errorSkor", (msg) => {
    showGlobalToast("⚠️ " + (msg || "Skor tidak dapat disimpan."), "warning");
  });
}

// ============================================
// CROSS-4: Konfirmasi saat klik btn-back di tengah game
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".btn-back").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const isActive =
        (typeof gameActive !== "undefined" && gameActive) ||
        (typeof isAnswering !== "undefined" && isAnswering) ||
        (typeof questions !== "undefined" && questions.length > 0);

      if (isActive) {
        e.preventDefault();
        const target = btn.href || "/";
        if (confirm("⚠️ Keluar sekarang? Progress game akan hilang.")) {
          window.location.href = target;
        }
      }
    });
  });
});
