// public/game.js - VERSI FINAL (HYBRID + SCORE FIX)

const socket = io();

// Element DOM
const questionEl = document.getElementById("question-display");
const scoreEl = document.getElementById("score");
const opponentScoreEl = document.getElementById("opponent-score");
const statusEl = document.getElementById("status-display");
const inputEl = document.getElementById("answer-input");
const progressBar = document.getElementById("progress-bar");
const finalScoreEl = document.getElementById("final-score");
const gameOverScreen = document.getElementById("game-over-screen");

// Game State
let score = 0;
let gameActive = false;
let playerName = localStorage.getItem("playerName") || "Guest";
let selectedDifficulty = "mudah";

// Variabel Mode
let isPvP = false; // Penanda mode (false = sendiri, true = duel)
let currentQuestionIdx = 0; // Untuk PvP
let questionList = []; // Untuk PvP
let currentProblem = null; // Untuk Single Player
let myRoom = "";

// --- SETUP AWAL ---
document.addEventListener("DOMContentLoaded", () => {
  // Isi nama otomatis
  const usernameInput = document.getElementById("username");
  if (usernameInput) usernameInput.value = playerName;

  // Logika tombol kesulitan
  const buttons = document.querySelectorAll(".btn-difficulty");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      selectedDifficulty = button.dataset.level;
    });
  });
});

function startGame() {
  const roomCode = document.getElementById("room-code").value.trim();
  const btn = document.querySelector('button[onclick="startGame()"]');

  // 1. Pancing Audio
  if (typeof AudioManager !== "undefined") AudioManager.init();

  if (roomCode === "") {
    // --- MODE SINGLE PLAYER ---

    // Tampilan Loading
    btn.innerText = "⏳ Memuat Arena...";
    btn.disabled = true;

    // Request Soal
    isPvP = false;
    document.getElementById("q-total").innerText = "∞";
    socket.emit("mintaSoalAI", {
      kategori: "math",
      tingkat: selectedDifficulty,
    });

    // Safety Net
    setTimeout(() => {
      // Cek apakah masih di login screen
      if (
        !document.getElementById("login-screen").classList.contains("hidden")
      ) {
        btn.innerText = "⚠️ Gagal. Coba Lagi?";
        btn.disabled = false;
      }
    }, 10000);
  } else {
    // --- MODE PVP (Logika Lama Tetap Jalan) ---
    masukModePvP(roomCode);
  }
}

// Fungsi helper kecil untuk memisahkan logika PvP (Copy saja ini ke bawah startGame)
function masukModePvP(roomCode) {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("game-screen").classList.remove("hidden");

  score = 0;
  scoreEl.innerText = "0";
  opponentScoreEl.innerText = "0";
  gameActive = true;
  isPvP = true;
  myRoom = roomCode;

  statusEl.innerText = "⏳ Menunggu lawan...";
  statusEl.style.color = "#00f2ff";
  questionEl.innerText = "Waiting...";
  inputEl.disabled = true;

  socket.emit("joinMathDuel", {
    room: myRoom,
    nama: playerName,
    tingkat: selectedDifficulty,
  });
}

// ==========================================
// LOGIKA SINGLE PLAYER
// ==========================================
function requestSingleSoal() {
  questionEl.innerText = "...";
  socket.emit("mintaSoalAI", { kategori: "math", tingkat: selectedDifficulty });
}

// Terima soal single dari AI
socket.on("soalDariAI", (data) => {
  if (!isPvP && data.kategori === "math") {
    // 🔥 VAKSIN DATA
    let soalData = data.data;
    if (Array.isArray(soalData)) soalData = soalData[0]; // Ambil isi

    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("game-screen").classList.remove("hidden"); // Fix UI
    document.getElementById("game-screen").classList.add("block");

    const btn = document.querySelector('button[onclick="startGame()"]');
    if (btn) {
      btn.innerText = "MULAI PERTEMPURAN 🚀";
      btn.disabled = false;
    }

    gameActive = true;
    scoreEl.innerText = score;
    inputEl.disabled = false;
    inputEl.focus();

    currentProblem = {
      text: soalData.soal,
      jawaban: parseInt(soalData.jawaban),
    };
    questionEl.innerText = currentProblem.text;
    progressBar.style.width = "100%";
    statusEl.innerText = "🎯 MODE LATIHAN";
  }
});

// ==========================================
// LOGIKA PVP DUEL
// ==========================================

// 1. Menunggu Lawan
socket.on("waitingForOpponent", (msg) => {
  if (isPvP) {
    statusEl.innerText = msg;
    inputEl.disabled = true;
  }
});

// 2. Game Dimulai (Dapat Paket Soal)
socket.on("startDuel", (data) => {
  if (isPvP) {
    statusEl.innerText = "⚔️ DUEL DIMULAI!";
    statusEl.style.color = "#38ef7d";

    questionList = data.soal; // Simpan 10 soal
    currentQuestionIdx = 0;

    document.getElementById("q-total").innerText = questionList.length;
    inputEl.disabled = false;
    inputEl.focus();

    tampilkanSoalPvP();
  }
});

// 3. Update Skor Lawan
socket.on("opponentScoreUpdate", (newScore) => {
  if (isPvP) {
    opponentScoreEl.innerText = newScore;
    opponentScoreEl.style.transform = "scale(1.5)";
    setTimeout(() => (opponentScoreEl.style.transform = "scale(1)"), 200);
  }
});

function tampilkanSoalPvP() {
  if (currentQuestionIdx >= questionList.length) {
    endGame();
    return;
  }
  const q = questionList[currentQuestionIdx];
  questionEl.innerText = q.q + " = ?";

  // Update Info Progress
  document.getElementById("q-current").innerText = currentQuestionIdx + 1;
  const percent = (currentQuestionIdx / questionList.length) * 100;
  progressBar.style.width = percent + "%";
}

// ==========================================
// CORE SYSTEM (JAWABAN & GAME OVER)
// ==========================================

function checkAnswer() {
  const userAnswer = parseInt(inputEl.value);
  let isCorrect = false;

  if (isPvP) {
    // Cek Jawaban Mode PvP
    const correctAnswer = parseInt(questionList[currentQuestionIdx].a);
    if (userAnswer === correctAnswer) {
      isCorrect = true;
      currentQuestionIdx++; // Pindah ke soal array berikutnya
    }
  } else {
    // Cek Jawaban Mode Single
    if (currentProblem && userAnswer === currentProblem.jawaban) {
      isCorrect = true;
    }
  }

  if (isCorrect) {
    // BENAR
    score += 10;
    scoreEl.innerText = score;

    AudioManager.playCorrect();

    // Efek visual
    questionEl.style.color = "#38ef7d"; // Hijau

    if (isPvP) {
      socket.emit("updateScoreDuel", { room: myRoom, score: score });
      setTimeout(() => {
        questionEl.style.color = "#fff";
        tampilkanSoalPvP();
      }, 200);
    } else {
      // Single Player: Minta soal baru
      setTimeout(() => {
        questionEl.style.color = "#fff";
        requestSingleSoal();
      }, 500);
    }
  } else {
    // SALAH
    questionEl.style.color = "#ff4757"; // Merah
    setTimeout(() => (questionEl.style.color = "#fff"), 500);
  }

  AudioManager.playWrong();

  inputEl.value = "";
  inputEl.focus();
}

// Event listener enter key
inputEl.addEventListener("keyup", function (event) {
  if (event.key === "Enter") checkAnswer();
});

// Tombol Selesai Manual (Dipanggil dari HTML)
function downloadSertifikat() {
  endGame();
}

// --- FUNGSI ENDGAME (YANG ANDA BINGUNGKAN TADI) ---
function endGame() {
  if (!gameActive) return; // Mencegah fungsi jalan 2x
  gameActive = false;

  AudioManager.playWin();

  inputEl.disabled = true; // Matikan input
  finalScoreEl.innerText = score;
  gameOverScreen.style.display = "block"; // Tampilkan layar game over

  console.log(`📡 Mengirim skor: ${score}`);

  // Simpan Skor ke Database
  socket.emit("simpanSkor", {
    nama: playerName,
    skor: score,
    game: "math",
  });

  // Disable tombol selesai agar tidak diklik lagi (Visual Feedback)
  const btnFinish = document.querySelector(".btn-finish");
  if (btnFinish) {
    btnFinish.disabled = true;
    btnFinish.innerText = "Data Terkirim ✅";
    btnFinish.style.background = "#555"; // Ubah warna jadi abu-abu
  }

  if (isPvP) {
    alert(`Duel Selesai!\nSkor Akhir: ${score}`);
    // Jika PvP, reload halaman agar bersih
    setTimeout(() => location.reload(), 1000);
  }
}

// --- FITUR AUTO-RECONNECT (PASTE DI PALING BAWAH) ---

// 1. Fungsi Membuat Tampilan Layar Gelap (Overlay)
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

// 2. Logika Saat Koneksi Putus & Nyambung Lagi
let isReconnecting = false;

socket.on("disconnect", (reason) => {
  console.log("⚠️ Koneksi putus:", reason);
  isReconnecting = true;

  const overlay = document.getElementById("connection-overlay");
  if (overlay) overlay.style.display = "flex";

  if (typeof gameActive !== "undefined") gameActive = false;
});

socket.on("connect", () => {
  if (isReconnecting) {
    console.log("✅ Terhubung kembali!");
    isReconnecting = false;

    const overlay = document.getElementById("connection-overlay");
    if (overlay) overlay.style.display = "none";

    // Resume Game Math
    if (typeof gameActive !== "undefined") {
      gameActive = true;
      // Math Battle tidak butuh requestAnimationFrame, cukup set gameActive true
    }

    // Khusus PvP: Mungkin perlu kirim ulang status 'ready' (opsional)
  }
});
