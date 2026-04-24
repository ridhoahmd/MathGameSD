// Dashboard Utama (Lengkap + Aman)

// Pake socket global biar ga dobel koneksi
const socket = window.socket || (typeof io !== "undefined" ? io() : null);

// Setup Firebase buat Login Google
const provider = new firebase.auth.GoogleAuthProvider();
let currentUser = null;

// --- LIST MEDALI (BADGE) ---
const BADGE_INFO = {
  badge_math: { name: "Ahli Matematika", emoji: "🎖️" },
  badge_quran: { name: "Penghafal Quran", emoji: "📚" },
  badge_speed: { name: "Si Kilat", emoji: "🚀" },
  badge_vip: { name: "Mahkota VIP", emoji: "👑" },
};

function getBadgeInfo(badgeId) {
  return BADGE_INFO[badgeId] || { name: badgeId, emoji: "🏆" };
}

// --- 1. LOGIKA GUEST & IDENTITAS ---
if (!localStorage.getItem("playerName")) {
  const randomGuest = "Guest_" + Math.floor(Math.random() * 10000);
  localStorage.setItem("playerName", randomGuest);
}
const localName = localStorage.getItem("playerName");

// Set tampilan awal
const nameDisplay = document.getElementById("display-name");
const avatarDisplay = document.getElementById("user-avatar");

if (nameDisplay) nameDisplay.innerText = localName;
if (avatarDisplay)
  avatarDisplay.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${localName}`;

// Ambil data user dari database pas pertama buka
requestSQLData(localName);

// --- 2. Fungsi minta data profil ---
function requestSQLData(username) {
  if (!username) return;

  // Cek apakah kita punya foto Google & UID login sekarang?
  let photoURL = null;
  let uid = null; // UID penting biar unik

  if (typeof auth !== "undefined" && auth.currentUser) {
    photoURL = auth.currentUser.photoURL;
    uid = auth.currentUser.uid; // Ambil UID dari user Google
  }


  // Kirim Paket Lengkap: Nama + Foto + UID
  socket.emit("mintaDataProfil", {
    nama: username,
    foto: photoURL,
    uid: uid, // Kirim UID biar server tau ini siapa
  });
}

// --- 3. Terima update profil dari server ---
socket.on("updateProfil", (data) => {
  // Update Nama
  if (nameDisplay) nameDisplay.innerText = data.nama;

  // Update Foto
  if (avatarDisplay) {
    if (data.foto) {
      avatarDisplay.src = data.foto;
      // Kalo foto google error, pake avatar default
      avatarDisplay.onerror = function () {
        this.onerror = null; // Biar ga loop
        this.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.nama}`;
      };
    } else {
      avatarDisplay.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.nama}`;
    }

    // --- UPDATE BINGKAI (FRAME) ---
    // 1. Reset class ke awal
    avatarDisplay.className = "logo-img";

    // 2. Tambah class frame kalo ada
    if (data.frame && data.frame !== "default") {
      let frameClass = data.frame;
      if (!frameClass.startsWith("frame-")) {
        frameClass = "frame-" + frameClass;
      }
      frameClass = frameClass.replace("_", "-");
      avatarDisplay.classList.add(frameClass);
    }
  }

  // UPDATE ROLE (ADMIN/GURU/SISWA)
  const roleEl = document.getElementById("role-display");
  if (roleEl) roleEl.innerText = (data.role || "GUEST").toUpperCase();

  // Atur Panel Guru/Admin
  const guruPanel = document.getElementById("guru-panel");
  const adminPanel = document.getElementById("admin-panel");

  if (guruPanel) guruPanel.classList.add("hidden");
  if (adminPanel) adminPanel.classList.add("hidden");

  if (data.role === "admin") {
    if (guruPanel) guruPanel.classList.remove("hidden");
    if (adminPanel) adminPanel.classList.remove("hidden");
  } else if (data.role === "guru") {
    if (guruPanel) guruPanel.classList.remove("hidden");
  }

  // UPDATE SKOR (Sinkron dengan Leaderboard)
  const xpDisplay = document.getElementById("total-score");
  if (xpDisplay) xpDisplay.innerText = data.skor || "0";

  // UPDATE LEVEL di stats box baru
  const statLevel = document.getElementById("stat-level");
  if (statLevel) statLevel.innerText = data.level !== undefined ? data.level : "-";

  // UPDATE XP BAR di stats box baru
  if (data.xp !== undefined) {
    const level = data.level || 0;
    const xpForLevel = (lvl) => lvl * lvl * 100;
    const currentLevelXP = xpForLevel(level);
    const nextLevelXP    = xpForLevel(level + 1);
    const xpInLevel      = data.xp - currentLevelXP;
    const xpNeeded       = nextLevelXP - currentLevelXP;
    const pct            = xpNeeded > 0 ? Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)) : 0;
    const xpLeft         = Math.max(0, nextLevelXP - data.xp);

    const fillEl   = document.getElementById("stat-xp-fill");
    const nextEl   = document.getElementById("stat-xp-next");
    const currEl   = document.getElementById("stat-xp-current");
    const pctEl    = document.getElementById("stat-xp-pct");

    if (fillEl)  fillEl.style.width   = pct + "%";
    if (nextEl)  nextEl.innerText     = xpLeft.toLocaleString("id-ID") + " XP lagi";
    if (currEl)  currEl.innerText     = data.xp.toLocaleString("id-ID") + " XP";
    if (pctEl)   pctEl.innerText      = pct + "%";
  }

  // UPDATE TEMA (kalo belum ada settingan manual di lokal)
  const savedTheme = localStorage.getItem("selectedTheme");

  // Kalo user blm pilih sendiri, pake tema dari server
  if (!savedTheme && data.theme && data.theme !== "default") {
    document.body.className = ""; // Reset classes
    document.body.classList.add("theme-" + data.theme);
  }
  // Kalo ada settingan lokal, pake yang lokal
  else if (savedTheme && savedTheme !== "default") {
    document.body.className = "";
    document.body.classList.add("theme-" + savedTheme);
  }

  // UPDATE MEDALI
  const badgeDisplay = document.getElementById("user-badge");
  if (badgeDisplay) {
    if (data.badge) {
      const badgeInfo = getBadgeInfo(data.badge);
      badgeDisplay.innerHTML = `
        <span class="badge-emoji">${badgeInfo.emoji}</span>
        <span class="badge-name">${badgeInfo.name}</span>
      `;
      badgeDisplay.classList.remove("hidden");
    } else {
      badgeDisplay.classList.add("hidden");
    }
  }

  // UPDATE LEVEL & XP (Gamification Client Side)
  // Tunggu bentar biar script lain siap
  setTimeout(() => {
    if (typeof PlayerLevel !== "undefined") {
      PlayerLevel.updateXPDisplay();
    }
    if (typeof DailyStreak !== "undefined") {
      DailyStreak.updateStreakDisplay();
    }
  }, 100);
});

// --- 4. FITUR CHAT ---
function toggleChat() {
  const chatBox = document.getElementById("chat-container");
  if (chatBox.classList.contains("minimized"))
    chatBox.classList.remove("minimized");
  chatBox.classList.toggle("open");
  document.getElementById("chat-notif").style.display = "none";
}
function minimizeChat() {
  const chatBox = document.getElementById("chat-container");
  if (!chatBox.classList.contains("open")) chatBox.classList.add("open");
  chatBox.classList.toggle("minimized");
}
function kirimPesan() {
  const input = document.getElementById("chat-input");
  const msg = input.value.trim();
  if (!msg) return;
  const namaPengirim = localStorage.getItem("playerName") || "Guest";
  socket.emit("chatMessage", { nama: namaPengirim, pesan: msg });
  input.value = "";
}
function handleEnter(e) {
  if (e.key === "Enter") kirimPesan();
}

socket.on("chatMessage", (data) => {
  const box = document.getElementById("chat-box");
  const myName = localStorage.getItem("playerName") || "Guest";
  const isMe = data.nama === myName;
  const div = document.createElement("div");
  div.className = isMe ? "msg-bubble msg-me" : "msg-bubble";

  if (!isMe) {
    const nameSpan = document.createElement("span");
    nameSpan.className = "msg-name";
    nameSpan.innerText = data.nama;
    div.appendChild(nameSpan);
  }
  const msgSpan = document.createElement("span");
  msgSpan.innerText = data.pesan;
  div.appendChild(msgSpan);

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  if (!document.getElementById("chat-container").classList.contains("open")) {
    const notif = document.getElementById("chat-notif");
    if (notif) notif.style.display = "inline";
  }
});

// --- 5. SYSTEM LOGIN ---
function toggleInputGuru() {
  const area = document.getElementById("guru-input-area");
  const text = document.getElementById("text-guru");
  if (area.classList.contains("hidden")) {
    area.classList.remove("hidden");
    area.classList.add("block");
    text.innerText = "Batal (Masuk sebagai Siswa)";
  } else {
    area.classList.remove("block");
    area.classList.add("hidden");
    text.innerText = "Apakah Anda Guru?";
    document.getElementById("input-kode-guru").value = "";
  }
}

function sanitizeName(name) {
  if (!name) return "Guest";
  return name.replace(/[.#$[\]]/g, "_");
}

async function loginGoogle() {
  const guruCodeInput = document.getElementById("input-kode-guru");
  const guruCode = guruCodeInput ? guruCodeInput.value.trim() : "";
  let adminToken = null;

  // 1. Cek kode guru kalo diisi
  if (guruCode) {
    try {
      const res = await fetch("/api/login-guru", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode: guruCode }),
      });
      const data = await res.json();

      if (data.success) {
        adminToken = data.token; // Simpan token
        // 🔧 FIX: Wajib pakai key "authToken" agar global.js bisa membacanya
        // Sebelumnya pakai "guruToken" → socket tidak pernah mengirim token ke server
        localStorage.setItem("authToken", adminToken);
      } else {
        alert("Kode Guru Salah! Ga jadi login.");
        return;
      }
    } catch (err) {
      console.error("Login Guru Error:", err);
      alert("Error verifikasi kode guru.");
      return;
    }
  }

  // 2. Lanjut Login Google via Popup
  auth
    .signInWithPopup(provider)
    .then((result) => {
      const originalName = result.user.displayName;
      const safeName = sanitizeName(originalName);

      localStorage.setItem("playerName", safeName);

      // Minta data profil
      requestSQLData(safeName);

      document.getElementById("btn-login").classList.add("hidden");
      document.getElementById("text-guru").classList.add("hidden");
      document.getElementById("guru-input-area").classList.add("hidden");
      document.getElementById("btn-logout").classList.remove("hidden");

      if (adminToken) {
        alert(`Selamat datang MASTER ${originalName}! (Mode Admin Aktif)`);
      } else {
        alert(`Selamat datang, ${originalName}!`);
      }
    })
    .catch((e) => alert("Login Gagal: " + e.message));
}

function logout() {
  auth.signOut().then(() => {
    localStorage.removeItem("playerName");
    localStorage.removeItem("authToken");  // 🔧 FIX: Hapus token guru
    localStorage.removeItem("guruToken");  // Hapus key lama juga (backward compat)
    location.reload();
  });
}

// Cek status login
if (typeof auth !== "undefined") {
  auth.onAuthStateChanged((user) => {
    if (user) {
      currentUser = user;
      const safeName = sanitizeName(user.displayName);

      // Update UI
      const btnLogin = document.getElementById("btn-login");
      if (btnLogin) btnLogin.classList.add("hidden");

      const btnLogout = document.getElementById("btn-logout");
      if (btnLogout) btnLogout.classList.remove("hidden");

      const guruArea = document.getElementById("guru-input-area");
      if (guruArea) guruArea.classList.add("hidden");

      requestSQLData(safeName);
    }
  });
}

function masukGame(url) {
  if (localStorage.getItem("playerName")) window.location.href = url;
  else alert("Refresh dlu bro buat dapet ID Guest.");
}

// --- 6. AUDIO & SW ---
document.addEventListener("DOMContentLoaded", () => {
  const allButtons = document.querySelectorAll("button, .game-card");
  allButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (typeof AudioManager !== "undefined") AudioManager.playClick();
    });
  });
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => {});
  });
}

// --- 7. GANTI TEMA ---

// Load tema tersimpan pas buka web
function loadSavedTheme() {
  const savedTheme = localStorage.getItem("selectedTheme");
  if (savedTheme && savedTheme !== "default") {
    document.body.classList.add("theme-" + savedTheme);
  }
}

// Jalanin
loadSavedTheme();

function cycleTheme() {
  const themes = [
    "default",
    "forest",
    "ocean",
    "hacker",
    "crimson",
    "royal",
    "obsidian",
  ];
  const body = document.body;

  let currentThemeIndex = 0;
  if (body.classList.contains("theme-forest")) currentThemeIndex = 1;
  else if (body.classList.contains("theme-ocean")) currentThemeIndex = 2;
  else if (body.classList.contains("theme-hacker")) currentThemeIndex = 3;
  else if (body.classList.contains("theme-crimson")) currentThemeIndex = 4;
  else if (body.classList.contains("theme-royal")) currentThemeIndex = 5;
  else if (body.classList.contains("theme-obsidian")) currentThemeIndex = 6;

  let nextIndex = (currentThemeIndex + 1) % themes.length;
  let nextTheme = themes[nextIndex];

  // Terapkan
  body.className = ""; // Reset
  if (nextTheme !== "default") {
    body.classList.add("theme-" + nextTheme);
  }

  // Simpen
  localStorage.setItem("selectedTheme", nextTheme);
}

// --- 8. RIWAYAT DUEL VERSUS ---
function showVersusHistory() {
  const modal = document.getElementById("versus-history-modal");
  if (!modal) return;

  // Buka modal dengan class (bukan inline style)
  modal.classList.add("is-open");
  const listContainer = document.getElementById("versus-history-list");

  // Tutup modal kalau klik di luar panel
  modal.addEventListener("click", function outsideClick(e) {
    if (e.target === modal) {
      modal.classList.remove("is-open");
      modal.removeEventListener("click", outsideClick);
    }
  }, { once: false });

  // Cek apakah user sudah login (bukan Guest)
  const playerName = localStorage.getItem("playerName") || "";
  const isGuest = playerName.startsWith("Guest_") || !playerName;

  if (isGuest) {
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 30px 20px;">
        <div style="font-size: 3rem; margin-bottom: 12px;">🔐</div>
        <p class="modal-duel-empty" style="color: #00f2ff; font-weight: bold; margin-bottom: 8px;">Login Google dulu yuk!</p>
        <p class="modal-duel-empty">Riwayat duelmu tersimpan setelah kamu masuk dengan akun Google.</p>
      </div>
    `;
    return;
  }

  // User sudah login, minta data ke server
  listContainer.innerHTML = '<p class="modal-duel-empty">⏳ Memuat data duel...</p>';
  socket.emit("mintaRiwayatVersus");
}

socket.on("riwayatVersusData", (data) => {
  const listContainer = document.getElementById("versus-history-list");
  if (!listContainer) return;

  if (!data || data.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 30px 20px;">
        <div style="font-size: 3rem; margin-bottom: 12px;">⚔️</div>
        <p class="modal-duel-empty" style="color: #ffeb3b; font-weight: bold;">Belum ada riwayat duel!</p>
        <p class="modal-duel-empty">Ayo tantang temanmu di mode Versus dan tulis sejarahmu! 🏆</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = "";
  data.forEach(match => {
    const item = document.createElement("div");

    // Tentukan status
    let statusClass = "duel-draw";
    let icon = "🤝";
    let label = "SERI";
    let labelColor = "#ffbe0b";

    if (match.status === "Win") {
      statusClass = "duel-win";  icon = "🏆"; label = "MENANG"; labelColor = "#38ef7d";
    } else if (match.status === "Lose") {
      statusClass = "duel-lose"; icon = "💀"; label = "KALAH";  labelColor = "#ff4757";
    }

    const date = new Date(match.playedAt);
    const dateStr = isNaN(date)
      ? "Waktu tidak valid"
      : date.toLocaleDateString("id-ID") + " " + date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

    item.className = `duel-item ${statusClass}`;
    item.innerHTML = `
      <div class="duel-info">
        <div class="duel-game-name">${match.game}</div>
        <div class="duel-date">${dateStr}</div>
      </div>
      <div class="duel-status">
        <div class="duel-icon">${icon}</div>
        <div class="duel-label" style="color: ${labelColor}">${label}</div>
      </div>
      <div class="duel-score-col">
        <div class="duel-vs-text">vs <span class="duel-vs-name">${match.p2Name}</span></div>
        <div class="duel-score-text">Skormu: <span class="duel-score-val">${match.score}</span></div>
      </div>
    `;
    listContainer.appendChild(item);
  });
});

