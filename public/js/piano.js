// public/js/piano.js - FIXED (NO DOUBLE LISTENER)

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
let level = "mudah";
let playerName = localStorage.getItem("playerName") || "Guest";

// --- AUDIO CONTEXT ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const notes = {
  1: 261.63, // C4
  2: 293.66, // D4
  3: 329.63, // E4
  4: 349.23, // F4
  5: 392.0, // G4
  6: 440.0, // A4
  7: 493.88, // B4
  8: 523.25, // C5
  9: 587.33, // D5
  0: 220.0, // A3 (Opsional)
};

function playTone(num) {
  if (audioCtx.state === "suspended") audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine"; // Gelombang halus (seperti piano elektronik simpel)
  // Pastikan num dikonversi ke integer agar kunci object terbaca
  const freq = notes[parseInt(num)];

  if (freq) {
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  }
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

// --- MULAI GAME ---
window.startGameSession = function () {
  // PENTING: Resume AudioContext saat user klik tombol mulai (Aturan Browser Modern)
  if (audioCtx.state === "suspended") audioCtx.resume();

  controlsArea.style.display = "none";
  score = 0;
  timeLeft = 60;
  scoreEl.innerText = score;
  timerEl.innerText = timeLeft;
  gameActive = true;

  // Reset Timer Lama jika ada
  if (timerInterval) clearInterval(timerInterval);

  // Mulai Timer Baru
  timerInterval = setInterval(() => {
    timeLeft--;
    timerEl.innerText = timeLeft;
    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);

  requestNewSequence();
};

function requestNewSequence() {
  if (!gameActive) return;
  questionBox.innerText = "⏳ AI Membuat Nada...";
  disableInput(true);

  // Minta soal ke server
  socket.emit("mintaSoalAI", { kategori: "piano", tingkat: level });
}

// --- TERIMA SOAL AI (HANYA SATU LISTENER - FIXED) ---
socket.on("soalDariAI", async (data) => {
  // Validasi: Pastikan data untuk piano dan game sedang aktif
  if (data && data.kategori === "piano" && gameActive) {
    // 🔥 VAKSIN DATA (Handling Array vs Object)
    let info = data.data;
    if (Array.isArray(info)) {
      info = info[0]; // Ambil elemen pertama jika server kirim array
    }

    // Pastikan sequence ada, jika tidak fallback ke [1,2,3]
    currentSequence = info.sequence || [1, 2, 3];
    playerSequence = []; // Reset jawaban pemain

    // Fase 1: Hafalkan
    questionBox.innerText = "👁️ DENGAR & HAFALKAN!";
    await playSequence(currentSequence);

    // Fase 2: Mainkan
    if (gameActive) {
      questionBox.innerText = "🎹 ULANGI SEKARANG!";
      disableInput(false);
    }
  }
});

// --- MAINKAN URUTAN NADA ---
async function playSequence(seq) {
  // Jeda sedikit sebelum mulai
  await sleep(500);

  for (let num of seq) {
    if (!gameActive) break;
    await highlightKey(num);
    await sleep(400); // Jeda antar nada
  }
}

function highlightKey(num) {
  return new Promise((resolve) => {
    // Cari elemen tombol piano berdasarkan data-val
    const keyElement = document.querySelector(`.key[data-val="${num}"]`);

    if (keyElement) {
      keyElement.classList.add("active"); // Efek visual tekan
      playTone(num); // Suara
    }

    // Lama tombol "ditekan" oleh AI
    setTimeout(() => {
      if (keyElement) keyElement.classList.remove("active");
      resolve();
    }, 300);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function disableInput(disabled) {
  const keys = document.querySelectorAll(".key");
  keys.forEach((k) => (k.style.pointerEvents = disabled ? "none" : "auto"));
}

// --- INPUT PEMAIN (Dipanggil dari HTML onclick/ontouch) ---
window.playNote = function (num) {
  if (!gameActive) return;

  // 1. Mainkan Suara & Efek Visual
  playTone(num);
  const keyEl = document.querySelector(`.key[data-val="${num}"]`);
  if (keyEl) {
    keyEl.classList.add("active");
    setTimeout(() => keyEl.classList.remove("active"), 150);
  }

  // 2. Simpan Jawaban
  // Pastikan tipe data sama (integer)
  playerSequence.push(parseInt(num));

  checkInput();
};

function checkInput() {
  const idx = playerSequence.length - 1;

  // 1. Cek Real-time (Salah satu nada salah = GAGAL LANGSUNG)
  if (playerSequence[idx] !== currentSequence[idx]) {
    flashScreen("#550000"); // Merah Gelap
    questionBox.innerText = "❌ SALAH! Ganti Soal...";

    // Penalti waktu (Opsional, hapus jika terlalu sadis)
    // timeLeft -= 2;

    // Minta soal baru setelah jeda
    setTimeout(requestNewSequence, 1000);
    return;
  }

  // 2. Cek Jika Urutan Selesai & Benar Semua
  if (playerSequence.length === currentSequence.length) {
    score += 10 * currentSequence.length; // Skor tergantung panjang nada
    scoreEl.innerText = score;

    flashScreen("#003300"); // Hijau Gelap
    questionBox.innerText = "✅ HEBAT! +Poin";

    try {
      AudioManager.playCorrect();
    } catch (e) {} // Jika ada sfx tambahan

    setTimeout(requestNewSequence, 800);
  }
}

function flashScreen(color) {
  document.body.style.backgroundColor = color;
  setTimeout(() => {
    document.body.style.backgroundColor = "#1e1e2e"; // Kembali ke warna asal
  }, 200);
}

// --- GAME OVER ---
function endGame() {
  gameActive = false;
  clearInterval(timerInterval);

  document.getElementById("final-score").innerText = score;

  const modal = document.getElementById("game-over-modal");
  if (modal) modal.style.display = "flex";

  console.log(`🎹 Waktu Habis! Skor: ${score}`);
  socket.emit("simpanSkor", {
    nama: playerName,
    skor: score,
    game: "piano",
  });
}

// --- FITUR AUTO-RECONNECT ---
function createOfflineUI() {
  if (document.getElementById("connection-overlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "connection-overlay";
  overlay.innerHTML = `<div class="wifi-icon">📡</div><div class="conn-text">KONEKSI TERPUTUS</div>`;
  document.body.appendChild(overlay);
}
createOfflineUI();

let isReconnecting = false;
socket.on("disconnect", () => {
  isReconnecting = true;
  const overlay = document.getElementById("connection-overlay");
  if (overlay) overlay.style.display = "flex";
  gameActive = false;
});

socket.on("connect", () => {
  if (isReconnecting) {
    isReconnecting = false;
    const overlay = document.getElementById("connection-overlay");
    if (overlay) overlay.style.display = "none";
  }
});
