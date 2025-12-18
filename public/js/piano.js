// public/piano.js - VERSI TIME ATTACK (60 DETIK)

const socket = io();
const scoreEl = document.getElementById("score");
const timerEl = document.getElementById("timer");
const questionBox = document.getElementById("question");
const controlsArea = document.getElementById("start-controls");

let score = 0;
let timeLeft = 60;
let gameActive = false;
let timerInterval;
let currentSequence = [];
let playerSequence = [];
let level = "mudah"; // Default
let playerName = localStorage.getItem("playerName") || "Guest";

// --- AUDIO ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const notes = {
  1: 261.63,
  2: 293.66,
  3: 329.63,
  4: 349.23,
  5: 392.0,
  6: 440.0,
  7: 493.88,
  8: 523.25,
  9: 587.33,
  0: 220.0,
};

function playTone(num) {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(notes[num], audioCtx.currentTime);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.3);
}

// --- PILIH LEVEL ---
document.querySelectorAll(".btn-level").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".btn-level")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    level = btn.dataset.level;
  });
});

// --- MULAI GAME (DARI TOMBOL) ---
function startGameSession() {
  controlsArea.style.display = "none"; // Sembunyikan tombol mulai
  score = 0;
  timeLeft = 60;
  scoreEl.innerText = score;
  timerEl.innerText = timeLeft;
  gameActive = true;

  // Mulai Timer
  timerInterval = setInterval(() => {
    timeLeft--;
    timerEl.innerText = timeLeft;
    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);

  requestNewSequence();
}

function requestNewSequence() {
  if (!gameActive) return;
  questionBox.innerText = "⏳ AI Membuat Nada...";
  disableInput(true);
  socket.emit("mintaSoalAI", { kategori: "piano", tingkat: level });
}

// --- TERIMA SOAL AI ---
socket.on("soalDariAI", async (data) => {
  if (data.kategori === "piano" && gameActive) {
    const info = data.data;
    currentSequence = info.sequence || [1, 2, 3];
    playerSequence = [];

    questionBox.innerText = "👁️ HAFALKAN!";
    await playSequence(currentSequence);

    if (gameActive) {
      questionBox.innerText = "🎹 ULANGI SEKARANG!";
      disableInput(false);
    }
  }
});

// --- MAINKAN NADA OTOMATIS ---
async function playSequence(seq) {
  for (let num of seq) {
    if (!gameActive) break;
    await highlightKey(num);
    await sleep(300); // Kecepatan urutan
  }
}

function highlightKey(num) {
  return new Promise((resolve) => {
    const keyElement = document.querySelector(`.key[data-val="${num}"]`);
    if (keyElement) {
      keyElement.classList.add("active");
      playTone(num);
    }
    setTimeout(() => {
      if (keyElement) keyElement.classList.remove("active");
      resolve();
    }, 400);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function disableInput(disabled) {
  const keys = document.querySelectorAll(".key");
  keys.forEach((k) => (k.style.pointerEvents = disabled ? "none" : "auto"));
}

// --- INPUT PEMAIN ---
function playNote(num) {
  if (!gameActive) return;

  playTone(num);
  const keyEl = document.querySelector(`.key[data-val="${num}"]`);
  keyEl.classList.add("active");
  setTimeout(() => keyEl.classList.remove("active"), 100);

  playerSequence.push(num);
  checkInput();
}

function checkInput() {
  const idx = playerSequence.length - 1;

  // 1. Cek per tombol
  if (playerSequence[idx] !== currentSequence[idx]) {
    // SALAH!
    flashScreen("#550000"); // Merah
    questionBox.innerText = "❌ SALAH! Ganti Soal...";
    setTimeout(requestNewSequence, 1000); // Langsung ganti soal, jangan game over
    return;
  }

  // 2. Cek selesai
  if (playerSequence.length === currentSequence.length) {
    // BENAR!
    score += 10;
    scoreEl.innerText = score;
    flashScreen("#003300"); // Hijau
    questionBox.innerText = "✅ BENAR! +10 Poin";
    setTimeout(requestNewSequence, 500);
  }
}

function flashScreen(color) {
  document.body.style.backgroundColor = color;
  setTimeout(() => {
    document.body.style.backgroundColor = "#1e1e2e";
  }, 200);
}

// --- GAME OVER (WAKTU HABIS) ---
function endGame() {
  gameActive = false;
  clearInterval(timerInterval);

  document.getElementById("final-score").innerText = score;
  document.getElementById("game-over-modal").style.display = "flex";

  // SIMPAN SKOR KE DATABASE
  console.log(`🎹 Waktu Habis! Mengirim skor: ${score}`);
  socket.emit("simpanSkor", {
    nama: playerName,
    skor: score,
    game: "piano",
  });
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

socket.on("soalDariAI", async (data) => {
  if (data.kategori === "piano" && gameActive) {
    // 🔥 VAKSIN DATA
    let info = data.data;
    if (Array.isArray(info)) info = info[0]; // Ambil isi

    currentSequence = info.sequence || [1, 2, 3];
    playerSequence = [];

    questionBox.innerText = "👁️ HAFALKAN!";
    await playSequence(currentSequence);

    if (gameActive) {
      questionBox.innerText = "🎹 ULANGI SEKARANG!";
      disableInput(false);
    }
  }
});
