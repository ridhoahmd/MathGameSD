// public/js/dashboard.js - VERSI FINAL (FITUR LENGKAP + SQL SECURE)

const socket = io();

// --- SETUP FIREBASE AUTH (TETAP DIPAKAI UNTUK LOGIN GOOGLE) ---
const provider = new firebase.auth.GoogleAuthProvider();
let currentUser = null;

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

// MINTA DATA KE SERVER SQL SAAT PERTAMA BUKA
requestSQLData(localName);

// --- 2. FUNGSI UTAMA: MINTA DATA KE SQL (DIPERBAIKI) ---
function requestSQLData(username) {
  if (!username) return;

  // Cek apakah kita punya foto Google & UID di Auth saat ini?
  let photoURL = null;
  let uid = null; // [PENTING] Variable UID

  if (typeof auth !== "undefined" && auth.currentUser) {
    photoURL = auth.currentUser.photoURL;
    uid = auth.currentUser.uid; // [PENTING] Ambil UID dari Google
  }

  console.log("📡 Meminta profil SQL untuk:", username);

  // Kirim Paket Lengkap: Nama + Foto + UID
  socket.emit("mintaDataProfil", {
    nama: username,
    foto: photoURL,
    uid: uid, // [PENTING] Kirim UID agar server bisa mengenali user unik
  });
}

// --- 3. TERIMA DATA DARI SQL (SOCKET.IO) ---
socket.on("updateProfil", (data) => {
  //console.log("📦 Profil SQL Diterima:", data);

  // A. UPDATE NAMA & GAMBAR
  if (nameDisplay) nameDisplay.innerText = data.nama;

  // Cek foto
  if (avatarDisplay) {
    if (data.foto) {
      avatarDisplay.src = data.foto;
      // Jika foto Google gagal/429, ganti ke Dicebear otomatis
      avatarDisplay.onerror = function () {
        this.onerror = null; // Mencegah loop
        this.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.nama}`;
      };
    } else {
      avatarDisplay.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.nama}`;
    }

    // --- UPDATE BINGKAI (FRAME) ---
    // 1. Reset class ke default
    avatarDisplay.className = "logo-img";

    // 2. Tambah class frame jika ada
    if (data.frame && data.frame !== "default") {
      let frameClass = data.frame;
      if (!frameClass.startsWith("frame-")) {
        frameClass = "frame-" + frameClass;
      }
      frameClass = frameClass.replace("_", "-");
      avatarDisplay.classList.add(frameClass);
    }
  }

  // B. UPDATE ROLE (ADMIN/GURU/SISWA)
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

  // C. UPDATE XP (Untuk Progress Bar)
  const xpDisplay = document.getElementById("total-score");
  if (xpDisplay) xpDisplay.innerText = data.xp || "0";

  // D. TEMA (hanya apply jika user belum manual pilih tema)
  const savedTheme = localStorage.getItem("selectedTheme");

  // Jika user sudah pilih manual, skip server theme
  if (!savedTheme && data.theme && data.theme !== "default") {
    document.body.className = ""; // Reset classes
    document.body.classList.add("theme-" + data.theme);
  }
  // Jika ada saved theme, tetap gunakan itu (priority)
  else if (savedTheme && savedTheme !== "default") {
    document.body.className = "";
    document.body.classList.add("theme-" + savedTheme);
  }
});

// --- 4. CHAT LOGIC  ---
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

// --- 5. LOGIN GOOGLE (FITUR LAMA TETAP ADA) ---
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

  // 1. Jika ada kode guru, verifikasi dulu ke server sebelum login Google
  if (guruCode) {
    try {
      const res = await fetch("/api/login-guru", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: guruCode }),
      });
      const data = await res.json();

      if (data.success) {
        adminToken = data.token; // Simpan token sementara
        localStorage.setItem("guruToken", adminToken); // Persist
      } else {
        alert("Kode Guru Salah! Login dibatalkan.");
        return;
      }
    } catch (err) {
      console.error("Login Guru Error:", err);
      alert("Gagal verifikasi kode guru.");
      return;
    }
  }

  // 2. Lanjut Login Google
  auth
    .signInWithPopup(provider)
    .then((result) => {
      const originalName = result.user.displayName;
      const safeName = sanitizeName(originalName);

      localStorage.setItem("playerName", safeName);

      // Panggil requestData dengan token (jika ada)
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
    location.reload();
  });
}

// Listener Auth State
if (typeof auth !== "undefined") {
  auth.onAuthStateChanged((user) => {
    if (user) {
      currentUser = user;
      const safeName = sanitizeName(user.displayName);

      // Update UI Login
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
  else alert("Silakan refresh halaman untuk mendapatkan ID Guest.");
}

// --- 6. AUDIO & SERVICE WORKER (FITUR LAMA TETAP ADA) ---
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
      .catch((err) => console.log("SW Error:", err));
  });
}

// --- 7. TEMA CYCLING (DIPERBAIKI - DENGAN PERSISTENCE) ---

// Load saved theme on page load
function loadSavedTheme() {
  const savedTheme = localStorage.getItem("selectedTheme");
  if (savedTheme && savedTheme !== "default") {
    document.body.classList.add("theme-" + savedTheme);
    console.log("✅ Theme restored:", savedTheme);
  }
}

// Call on script load
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

  // Terapkan ke Layar
  body.className = ""; // Reset
  if (nextTheme !== "default") {
    body.classList.add("theme-" + nextTheme);
  }

  // SAVE TO LOCALSTORAGE untuk persistence
  localStorage.setItem("selectedTheme", nextTheme);
  console.log("💾 Theme saved:", nextTheme);
}
