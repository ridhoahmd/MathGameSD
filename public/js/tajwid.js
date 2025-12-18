// ==========================================
// TAJWID.JS - FIXED UI & DATA VAKSIN + AI TUTOR
// ==========================================

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

// 🔥 [BARU] VARIABEL AI TUTOR
const tutorOverlay = document.getElementById("tutor-overlay");
const tutorText = document.getElementById("tutor-text");
let tutorUsageCount = 0;
const MAX_TUTOR_USAGE = 3;

let gameData = null;
let queue = [];
let currentItem = null;
let score = 0;
let isProcessing = false;
let playerName = localStorage.getItem("playerName") || "Guest";
let selectedLevel = "mudah";

// --- 1. SETUP TOMBOL KESULITAN ---
document.addEventListener("DOMContentLoaded", () => {
  const diffButtons = document.querySelectorAll(".btn-diff");
  diffButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      diffButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedLevel = btn.dataset.level;
    });
  });
});

// 🔥 [BARU] LISTENER PENJELASAN AI
socket.on("penjelasanTutor", (data) => {
  if (tutorText) {
    tutorText.innerHTML = "";
    let i = 0;
    const txt = data.penjelasan;
    function typeWriter() {
      if (i < txt.length) {
        tutorText.innerHTML += txt.charAt(i);
        i++;
        setTimeout(typeWriter, 15);
      }
    }
    typeWriter();
  }
});

// 🔥 [BARU] FUNGSI TUTUP TUTOR
window.tutupTutor = function () {
  if (tutorOverlay) tutorOverlay.style.display = "none";
  // Lanjut ke kartu berikutnya setelah penjelasan selesai
  nextCard();
};

// --- 2. MULAI GAME ---
function startGame() {
  const btnStart = document.querySelector(".btn-start");
  btnStart.innerText = "MEMUAT...";
  btnStart.disabled = true;

  // Reset kuota tutor
  tutorUsageCount = 0;

  socket.emit("mintaSoalAI", { kategori: "tajwid", tingkat: selectedLevel });
}

// --- 3. TERIMA SOAL DARI SERVER (FIXED) ---
socket.on("soalDariAI", (data) => {
  if (data.kategori === "tajwid") {
    const receivedData = data.data;

    // Cek Struktur Data (Array vs Object)
    if (Array.isArray(receivedData)) {
      // 1. Jika data langsung Array (Format Lama/Fallback)
      gameData = receivedData;

      // Default Label Manual
      if (selectedLevel === "mudah") {
        ui.lblLeft.innerText = "AL-QAMARIYAH";
        ui.lblRight.innerText = "AL-SYAMSIYAH";
      } else {
        ui.lblLeft.innerText = "IZHAR";
        ui.lblRight.innerText = "IKHFA";
      }
    } else if (receivedData && Array.isArray(receivedData.data)) {
      // 2. Jika data terbungkus Object (Format Baru Server)
      // Ini yang mengatasi error "not iterable"
      gameData = receivedData.data; // Ambil array di dalam properti .data

      // Update Label Keranjang secara Dinamis dari AI
      if (receivedData.kategori_kiri)
        ui.lblLeft.innerText = receivedData.kategori_kiri.toUpperCase();
      if (receivedData.kategori_kanan)
        ui.lblRight.innerText = receivedData.kategori_kanan.toUpperCase();
    } else {
      console.error("Format Data Salah:", receivedData);
      alert("Gagal memuat soal. Format data tidak dikenali.");
      return;
    }

    // Reset State
    queue = [...gameData]; // Sekarang aman karena gameData pasti Array
    score = 0;
    ui.score.innerText = score;
    tutorUsageCount = 0; // Reset kuota tutor

    // UI Update
    ui.start.classList.remove("active");
    ui.start.classList.add("hidden");
    ui.game.classList.remove("hidden");
    ui.game.classList.add("active");

    nextCard();
  }
});

// --- 4. GANTI KARTU (FIXED) ---
function nextCard() {
  if (queue.length === 0) {
    endGame();
    return;
  }

  currentItem = queue.shift();

  // LOG UNTUK DEBUGGING (Bisa dihapus nanti)
  console.log("DATA KARTU SAAT INI:", currentItem);

  // 🔥 UPDATE DISINI: Tambahkan 'currentItem.teks' di paling depan
  const teksSoal =
    currentItem.teks ||
    currentItem.lafadz ||
    currentItem.soal ||
    currentItem.ayat ||
    currentItem.text ||
    currentItem.question;

  if (teksSoal) {
    ui.text.innerText = teksSoal;
  } else {
    ui.text.innerText = "???"; // Placeholder jika gagal
    console.error(
      "Format Soal Salah. Keys tersedia:",
      Object.keys(currentItem)
    );
  }

  // Reset Animasi & State
  ui.card.className = "flashcard";
  ui.card.style.transform = "translateX(0) rotate(0)";
  isProcessing = false;
}

// --- 5. INPUT PLAYER (FIXED LOGIC) ---
function handleInput(bucketType) {
  if (isProcessing) return;
  isProcessing = true;

  let isCorrect = false;

  // Ambil kunci jawaban dari server
  // Data server Anda: {hukum: 'kiri', teks: '...'}
  const jawabanBenar = currentItem.hukum
    ? currentItem.hukum.toLowerCase().trim()
    : "";

  // --- LOGIKA PENGECEKAN BARU ---

  // Skenario A: Jawaban Benar adalah Posisi ('kiri' atau 'kanan')
  if (jawabanBenar === "kiri" || jawabanBenar === "kanan") {
    if (jawabanBenar === bucketType) {
      isCorrect = true;
    }
  }
  // Skenario B: Jawaban Benar adalah Nama Hukum (misal: "izhar")
  else {
    // Ambil teks label keranjang yang dipilih user
    let jawabanUser = "";
    if (bucketType === "kiri") jawabanUser = ui.lblLeft.innerText.toLowerCase();
    else jawabanUser = ui.lblRight.innerText.toLowerCase();

    // Cek kecocokan teks
    if (
      jawabanBenar.includes(jawabanUser) ||
      jawabanUser.includes(jawabanBenar)
    ) {
      isCorrect = true;
    }
  }

  // ANIMASI KARTU
  ui.card.classList.add(bucketType === "kiri" ? "swipe-left" : "swipe-right");

  if (isCorrect) {
    // ... Logika Benar ...
    try {
      AudioManager.playCorrect();
    } catch (e) {}
    score += 10;
    ui.score.innerText = score;
    showFeedback(true);
    setTimeout(nextCard, 600);
  } else {
    // ... Logika Salah & Tutor ...
    try {
      AudioManager.playWrong();
    } catch (e) {}
    showFeedback(false);

    if (tutorUsageCount < MAX_TUTOR_USAGE) {
      tutorUsageCount++;
      if (tutorOverlay) tutorOverlay.style.display = "flex";

      // Kirim request penjelasan yang lebih detail
      socket.emit("mintaPenjelasan", {
        game: "tajwid",
        soal: ui.text.innerText,
        jawabanUser:
          bucketType === "kiri" ? ui.lblLeft.innerText : ui.lblRight.innerText,
        jawabanBenar: currentItem.hukum, // Kirim raw data (misal 'kiri') biar server yang mikir
      });
    } else {
      setTimeout(nextCard, 600);
    }
  }
}

// --- 6. FEEDBACK VISUAL ---
function showFeedback(isWin) {
  ui.overlay.className = isWin ? "correct-anim" : "wrong-anim";
  setTimeout(() => {
    ui.overlay.className = "";
  }, 500);
}

// --- 7. GAME OVER ---
function endGame() {
  ui.game.style.display = "none";
  ui.game.classList.remove("active");
  ui.game.classList.add("hidden");

  ui.result.style.display = "flex";
  ui.result.classList.remove("hidden");
  ui.result.classList.add("active");

  ui.finalScore.innerText = score;
  try {
    AudioManager.playWin();
  } catch (e) {}

  socket.emit("simpanSkor", {
    nama: playerName,
    skor: score,
    game: "tajwid",
  });
}

// --- 8. KEYBOARD CONTROL ---
document.addEventListener("keydown", (e) => {
  // Hanya aktif jika game aktif, tidak sedang proses, dan overlay tutor tertutup
  if (
    ui.game.classList.contains("active") &&
    !isProcessing &&
    (!tutorOverlay || tutorOverlay.style.display === "none")
  ) {
    if (e.key === "ArrowLeft") handleInput("kiri");
    if (e.key === "ArrowRight") handleInput("kanan");
  }
});

// --- 9. AUTO RECONNECT ---
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
    isReconnecting = false;
    const overlay = document.getElementById("connection-overlay");
    if (overlay) overlay.style.display = "none";
  }
});
