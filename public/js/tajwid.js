const socket = io();

// UI Elements
const ui = {
  start: document.getElementById("start-screen"),
  game: document.getElementById("game-screen"),
  result: document.getElementById("result-screen"),
  card: document.getElementById("card"),
  text: document.getElementById("arabic-text"),
  score: document.getElementById("score"),
  finalScore: document.getElementById("final-score"),
  lblLeft: document.getElementById("label-left"),
  lblRight: document.getElementById("label-right"),
  overlay: document.getElementById("feedback-overlay"),
};

let gameData = null;
let queue = [];
let currentItem = null;
let score = 0;
let isProcessing = false;
let playerName = localStorage.getItem("playerName") || "Guest";
let selectedLevel = "mudah"; // Default Level

// --- 1. SETUP TOMBOL KESULITAN ---
document.addEventListener("DOMContentLoaded", () => {
  const diffButtons = document.querySelectorAll(".btn-diff");
  diffButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Hapus class active dari semua tombol
      diffButtons.forEach((b) => b.classList.remove("active"));
      // Tambah ke tombol yang diklik
      btn.classList.add("active");
      // Simpan level
      selectedLevel = btn.dataset.level;
    });
  });
});

// --- 2. MULAI GAME ---
function startGame() {
  const btnStart = document.querySelector(".btn-start");
  btnStart.innerText = "⏳ MENYIAPKAN KARTU...";
  btnStart.disabled = true;

  if (typeof AudioManager !== "undefined") AudioManager.init();

  // Minta soal ke AI dengan LEVEL yang dipilih
  socket.emit("mintaSoalAI", {
    kategori: "tajwid",
    tingkat: selectedLevel,
  });
}

// --- 3. TERIMA DATA DARI SERVER ---
socket.on("soalDariAI", (response) => {
  // Reset tombol jika data sudah masuk
  const btnStart = document.querySelector(".btn-start");
  btnStart.innerText = "MULAI MAIN";
  btnStart.disabled = false;

  if (response.kategori === "tajwid") {
    gameData = response.data; // { kategori_kiri, kategori_kanan, data: [] }

    // Validasi data
    if (!gameData || !gameData.data || gameData.data.length === 0) {
      alert("Gagal memuat soal. Silakan coba lagi.");
      return;
    }

    queue = gameData.data; // Array soal

    // Setup UI Label Keranjang
    ui.lblLeft.innerText = gameData.kategori_kiri;
    ui.lblRight.innerText = gameData.kategori_kanan;

    // Reset Score & UI
    score = 0;
    ui.score.innerText = "0";

    ui.start.style.display = "none";
    ui.start.classList.remove("active");

    ui.game.style.display = "flex";
    ui.game.classList.add("active");

    ui.result.classList.remove("active");

    nextCard();
  }
});

// --- 4. TAMPILKAN KARTU BERIKUTNYA ---
function nextCard() {
  if (queue.length === 0) {
    endGame();
    return;
  }

  // Reset posisi kartu (Hapus kelas animasi sebelumnya)
  ui.card.className = "flashcard";
  ui.card.style.transform = "translate(0, 0)";

  currentItem = queue.pop(); // Ambil 1 soal dari tumpukan
  ui.text.innerText = currentItem.teks;
  isProcessing = false;
}

// --- 5. LOGIKA INPUT (JAWAB) ---
function handleInput(direction) {
  if (isProcessing) return;

  // Cegah input jika game tidak aktif
  if (!ui.game.classList.contains("active")) return;

  isProcessing = true;

  const correctDir = currentItem.hukum; // 'kiri' atau 'kanan'
  const isCorrect = direction === correctDir;

  // Animasi Kartu Terbang
  if (direction === "kiri") {
    ui.card.classList.add("swipe-left");
  } else {
    ui.card.classList.add("swipe-right");
  }

  // Feedback & Score
  if (isCorrect) {
    score += 10;
    ui.score.innerText = score;
    showFeedback("correct");
    try {
      AudioManager.playCorrect();
    } catch (e) {}
  } else {
    showFeedback("wrong");
    try {
      AudioManager.playWrong();
    } catch (e) {}
  }

  // Munculkan kartu baru setelah animasi selesai (300ms)
  setTimeout(() => {
    nextCard();
  }, 300);
}

function showFeedback(type) {
  ui.overlay.className = type === "correct" ? "bg-correct" : "bg-wrong";
  setTimeout(() => (ui.overlay.className = ""), 300);
}

// --- 6. EVENT LISTENER (INPUT USER) ---

// A. Keyboard (Panah Kiri/Kanan)
document.addEventListener("keydown", (e) => {
  if (!ui.game.classList.contains("active")) return;
  if (e.key === "ArrowLeft") handleInput("kiri");
  if (e.key === "ArrowRight") handleInput("kanan");
});

// B. Klik Mouse / Touch Screen
document.addEventListener("click", (e) => {
  if (!ui.game.classList.contains("active")) return;

  // PENTING: Jangan trigger jika yang diklik adalah tombol/elemen UI lain
  if (
    e.target.closest(".btn-back") ||
    e.target.closest(".bucket") || // Bucket punya onclick sendiri di HTML (opsional)
    e.target.closest(".btn-retry") ||
    e.target.closest(".btn-home")
  ) {
    return;
  }

  // Logika Split Screen: Klik Kiri vs Klik Kanan
  const screenWidth = window.innerWidth;
  if (e.clientX < screenWidth / 2) {
    handleInput("kiri");
  } else {
    handleInput("kanan");
  }
});

// --- 7. GAME OVER ---
function endGame() {
  ui.game.style.display = "none";
  ui.game.classList.remove("active");
  ui.result.style.display = "flex";
  ui.result.classList.add("active");
  ui.finalScore.innerText = score;
  try {
    AudioManager.playWin();
  } catch (e) {}

  // Simpan ke Firebase
  socket.emit("simpanSkor", {
    nama: playerName,
    skor: score,
    game: "tajwid",
  });
}

// --- 8. FITUR AUTO-RECONNECT (Standard Portal Videa) ---
function createOfflineUI() {
  if (document.getElementById("connection-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "connection-overlay";
  overlay.innerHTML = `
        <div class="wifi-icon">📡</div>
        <div class="conn-text">KONEKSI TERPUTUS</div>
        <div class="conn-sub">Sedang mencoba menghubungkan kembali...</div>
    `;
  document.body.appendChild(overlay);
}

createOfflineUI();

let isReconnecting = false;

socket.on("disconnect", (reason) => {
  console.log("⚠️ Koneksi putus:", reason);
  isReconnecting = true;
  const overlay = document.getElementById("connection-overlay");
  if (overlay) overlay.style.display = "flex";
});

socket.on("connect", () => {
  if (isReconnecting) {
    console.log("✅ Terhubung kembali!");
    isReconnecting = false;
    const overlay = document.getElementById("connection-overlay");
    if (overlay) overlay.style.display = "none";
  }
});
