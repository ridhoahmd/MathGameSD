// PERBAIKAN: Jangan tangkap window.socket di sini — bisa null saat file diparse!
// Gunakan window.socket secara langsung di dalam fungsi.

const scoreEl     = document.getElementById("score");
const timerEl     = document.getElementById("timer");
const questionBox = document.getElementById("question");
const controlsArea = document.getElementById("start-controls");
const sequenceIndicatorEl = document.getElementById("sequence-indicator");
const melodyNameEl = document.getElementById("melody-name");

let score = 0;
let timeLeft = 60;
let gameActive = false;
let timerInterval;
let currentSequence = [];
let playerSequence = [];
let level = "mudah";
let playerName = localStorage.getItem("playerName") || "Guest";
let currentMelodyName = ""; // Nama melodi yang sedang dimainkan

// SPAM-CLICK FIX: Debounce untuk blokir spam tuts piano
let isPlayingNote = false;

// SOCKET RACE CONDITION FIX: guard agar listener tidak didaftarkan dua kali
let _socketWired = false;

// Setup Audio Context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const notes = {
  1: 261.63, // C4
  2: 293.66, // D4
  3: 329.63, // E4
  4: 349.23, // F4
  5: 392.0,  // G4
  6: 440.0,  // A4
  7: 493.88, // B4
  8: 523.25, // C5
  9: 587.33, // D5
  0: 220.0,  // A3 (Opsional)
};

// ==========================================================
// 🎵 LIBRARY MELODI TERSTRUKTUR
// Setiap melodi punya nama, array sequence nada (1-8),
// dan level kesulitan yang sesuai.
// Nada direpresentasikan sebagai angka 1-8 = C4-C5
// ==========================================================
const MELODY_LIBRARY = {
  mudah: [
    {
      name: "Twinkle Twinkle",
      sequence: [1, 1, 5, 5, 6, 6, 5],
    },
    {
      name: "Balonku",
      sequence: [1, 3, 5, 5, 5],
    },
    {
      name: "Naik-naik",
      sequence: [5, 5, 8, 8, 8],
    },
    {
      name: "Pelangi",
      sequence: [3, 5, 6, 5, 3],
    },
    {
      name: "Burung Kakak Tua",
      sequence: [5, 3, 1, 3, 5],
    },
    {
      name: "C Major Scale",
      sequence: [1, 2, 3, 4, 5],
    },
  ],
  sedang: [
    {
      name: "Twinkle (Lanjut)",
      sequence: [4, 4, 3, 3, 2, 2, 1, 5, 5],
    },
    {
      name: "Ode to Joy",
      sequence: [3, 3, 4, 5, 5, 4, 3, 2, 1],
    },
    {
      name: "Happy Birthday",
      sequence: [1, 1, 2, 1, 4, 3, 1, 1, 2],
    },
    {
      name: "Rasa Sayange",
      sequence: [5, 3, 2, 1, 2, 3, 5, 5, 3],
    },
    {
      name: "Ibu Kita Kartini",
      sequence: [1, 3, 5, 6, 5, 3, 1, 3, 2],
    },
    {
      name: "Pentatonic Run",
      sequence: [1, 3, 5, 8, 5, 3, 1, 3, 5],
    },
  ],
  sulit: [
    {
      name: "Untuk Ibu",
      sequence: [5, 3, 2, 1, 2, 3, 5, 3, 1, 2, 3, 4],
    },
    {
      name: "Twinkle Full",
      sequence: [1, 1, 5, 5, 6, 6, 5, 4, 4, 3, 3, 2],
    },
    {
      name: "Ode to Joy Full",
      sequence: [3, 3, 4, 5, 5, 4, 3, 2, 1, 1, 2, 3],
    },
    {
      name: "Chromatic Stairs",
      sequence: [1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4],
    },
    {
      name: "Lir-Ilir",
      sequence: [5, 4, 3, 2, 3, 4, 5, 6, 5, 4, 3, 2],
    },
    {
      name: "Garuda Pancasila Intro",
      sequence: [1, 3, 5, 8, 6, 5, 3, 1, 2, 3, 4, 5],
    },
  ],
};

/**
 * Pilih melodi dari library berdasarkan level.
 * Hindari melodi yang sama dengan yang baru saja dimainkan.
 * @returns {{ name: string, sequence: number[] }}
 */
let _lastMelodyIndex = -1;
function pickMelody(currentLevel) {
  const pool = MELODY_LIBRARY[currentLevel] || MELODY_LIBRARY.mudah;
  let idx;
  // Hindari mengulang melodi yang sama berturut-turut
  do {
    idx = Math.floor(Math.random() * pool.length);
  } while (pool.length > 1 && idx === _lastMelodyIndex);
  _lastMelodyIndex = idx;
  return pool[idx];
}

// ==========================================================
// 🔵 SEQUENCE INDICATOR — Dot tracker posisi nada
// ==========================================================

/**
 * Buat dot-tracker di bawah question-box.
 * Satu dot per nada dalam sequence.
 * @param {number[]} seq - Array nada
 */
function buildSequenceIndicator(seq) {
  if (!sequenceIndicatorEl) return;
  sequenceIndicatorEl.innerHTML = "";

  seq.forEach((_, i) => {
    const dot = document.createElement("div");
    dot.className = "seq-dot";
    dot.id = `seq-dot-${i}`;
    sequenceIndicatorEl.appendChild(dot);
  });
}

/**
 * Sorot dot pada posisi `index` sebagai "sedang diputar" (highlight playback).
 * @param {number} index
 * @param {boolean} active
 */
function highlightDotPlayback(index, active) {
  const dot = document.getElementById(`seq-dot-${index}`);
  if (!dot) return;
  dot.classList.toggle("playing", active);
}

/**
 * Tandai dot pada posisi `index` sebagai benar atau salah (saat player input).
 * @param {number} index
 * @param {"correct"|"wrong"} state
 */
function markDotResult(index, state) {
  const dot = document.getElementById(`seq-dot-${index}`);
  if (!dot) return;
  dot.classList.remove("playing");
  dot.classList.add(state); // "correct" atau "wrong"
}

/** Reset semua dot ke state awal */
function resetDots() {
  if (!sequenceIndicatorEl) return;
  sequenceIndicatorEl.querySelectorAll(".seq-dot").forEach(d => {
    d.classList.remove("playing", "correct", "wrong");
  });
}

/** Sembunyikan indicator saat tidak dalam game */
function clearSequenceIndicator() {
  if (sequenceIndicatorEl) sequenceIndicatorEl.innerHTML = "";
  if (melodyNameEl) melodyNameEl.textContent = "";
}

// ==========================================================
// 🔊 AUDIO
// ==========================================================

function playTone(num) {
  if (audioCtx.state === "suspended") audioCtx.resume();

  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
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

// Pilih Level
document.querySelectorAll(".btn-diff").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".btn-diff").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    level = btn.dataset.level;
  });
});

// ==========================================================
// 🚀 GAME FLOW
// ==========================================================

window.startGameSession = function () {
  if (window.socket) {
    window.socket.emit("mulaiGame", "piano");
    window._activeGameSlug = "piano";
  }
  if (audioCtx.state === "suspended") audioCtx.resume();

  controlsArea.style.display = "none";
  score    = 0;
  timeLeft = 60;
  scoreEl.innerText = score;
  timerEl.innerText = timeLeft;
  gameActive = true;
  _lastMelodyIndex = -1;

  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    timeLeft--;
    timerEl.innerText = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);

  requestNewSequence();
};

function requestNewSequence() {
  if (!gameActive) return;
  questionBox.innerText = "⏳ Menyusun Melodi...";
  clearSequenceIndicator();
  disableInput(true);

  // MELODI TERSTRUKTUR: Pilih melodi dari library lokal berdasarkan level.
  // Ini memberikan pengalaman belajar yang lebih bermakna daripada urutan acak.
  // Server tetap bisa override jika ada data DB (lihat soalDariAI handler di bawah).
  const melody = pickMelody(level);
  currentMelodyName = melody.name;
  currentSequence   = melody.sequence;
  playerSequence    = [];

  // Mulai countdown lalu mainkan melodi
  _startPlayback();
}

// ISU-6-B: Countdown sebelum sequence dimainkan
async function countdownBeforePlay() {
  const msgs = ["SIAP?", "3...", "2...", "1...", "👁️ DENGAR!"];
  for (const msg of msgs) {
    if (!gameActive) return;
    questionBox.innerText = msg;
    await sleep(450);
  }
}

async function _startPlayback() {
  await countdownBeforePlay();
  if (!gameActive) return;

  // Tampilkan nama melodi
  if (melodyNameEl) {
    melodyNameEl.textContent = `🎵 ${currentMelodyName}`;
  }

  // Bangun dot indicator sesuai panjang sequence
  buildSequenceIndicator(currentSequence);

  questionBox.innerText = "👁️ DENGAR & HAFALKAN!";
  await playSequence(currentSequence);

  if (gameActive) {
    // Reset dot ke state netral, siap untuk input player
    resetDots();
    questionBox.innerText = `🎹 ULANGI! (0 / ${currentSequence.length})`;
    disableInput(false);
  }
}

// PENGATURAN KONEKSI SOCKET — dipindahkan ke dalam fungsi agar aman
function wireSocketEvents() {
  if (_socketWired) return;

  if (window.socket) {
    _socketWired = true;

    window.socket.off("soalDariAI");
    window.socket.on("soalDariAI", (data) => {
      // Piano sekarang menggunakan melodi lokal (requestNewSequence) sebagai primary.
      // Socket response hanya digunakan jika game masih menunggu data dari server
      // dan server memberikan sequence yang valid (tidak dipakai jika game sudah mulai playback lokal).
      if (data && data.kategori === "piano" && gameActive) {
        let info = data.data;
        if (Array.isArray(info)) info = info[0];

        // Hanya pakai data server jika sequence-nya valid dan punya nama
        if (info && info.sequence && info.sequence.length > 0) {
          // Override dengan data server jika ada (misal: guru set soal custom)
          // Tapi abaikan jika playback sudah mulai (indicator sudah terbangun)
          if (sequenceIndicatorEl && sequenceIndicatorEl.children.length === 0) {
            currentSequence   = info.sequence;
            currentMelodyName = info.name || currentMelodyName || "Server Melody";
            playerSequence    = [];
            _startPlayback();
          }
        }
        // Jika tidak ada data valid dari server, biarkan melodi lokal berjalan
      }
    });

  } else {
    setTimeout(wireSocketEvents, 100);
  }
}

// ==========================================================
// 🎹 PLAYBACK & HIGHLIGHT
// ==========================================================

async function playSequence(seq) {
  await sleep(500);

  for (let i = 0; i < seq.length; i++) {
    if (!gameActive) break;

    // Update question box dengan posisi saat ini
    questionBox.innerText = `🔊 Nada ${i + 1} dari ${seq.length}`;

    // Nyalakan dot pada posisi ini
    highlightDotPlayback(i, true);

    await highlightKey(seq[i]);
    await sleep(350);

    // Matikan dot setelah nada selesai
    highlightDotPlayback(i, false);
  }

  // Kembali ke instruksi setelah selesai playback
  if (gameActive) {
    questionBox.innerText = "👁️ Sudah hafal?";
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

// ==========================================================
// 🖱️ PLAYER INPUT
// ==========================================================

window.playNote = function (num) {
  if (!gameActive) return;

  // SPAM-CLICK FIX: Debounce 80ms — cegah multi-tap dalam satu jari
  if (isPlayingNote) return;
  isPlayingNote = true;
  setTimeout(() => { isPlayingNote = false; }, 80);

  playTone(num);
  const keyEl = document.querySelector(`.key[data-val="${num}"]`);
  if (keyEl) {
    keyEl.classList.add("active");
    setTimeout(() => keyEl.classList.remove("active"), 150);
  }

  playerSequence.push(parseInt(num));

  // Update question box dengan progress player
  questionBox.innerText = `🎹 ULANGI! (${playerSequence.length} / ${currentSequence.length})`;

  checkInput();
};

function checkInput() {
  const idx = playerSequence.length - 1;

  if (playerSequence[idx] !== currentSequence[idx]) {
    // Tandai dot sebagai SALAH
    markDotResult(idx, "wrong");

    disableInput(true);
    flashScreen("#550000");
    questionBox.innerText = "❌ SALAH! Ganti Melodi...";

    setTimeout(requestNewSequence, 1100);
    return;
  }

  // Tandai dot sebagai BENAR
  markDotResult(idx, "correct");

  if (playerSequence.length === currentSequence.length) {
    disableInput(true);
    // REBALANCED: Reduced from 10 to 8 (line 186)
    score += 8 * currentSequence.length;
    scoreEl.innerText = score;

    flashScreen("#003300");
    questionBox.innerText = `✅ HEBAT! +${8 * currentSequence.length} Poin`;

    try { AudioManager.playCorrect(); } catch (e) {}

    setTimeout(requestNewSequence, 900);
  }
}

function flashScreen(color) {
  document.body.style.backgroundColor = color;
  setTimeout(() => {
    // ISU-4 FIX: Gunakan string kosong agar tema/CSS yang mengatur warna kembali
    document.body.style.backgroundColor = "";
  }, 200);
}

// ==========================================================
// 🏁 GAME OVER & RESTART
// ==========================================================

function endGame() {
  gameActive = false;
  clearInterval(timerInterval);
  clearSequenceIndicator();

  document.getElementById("final-score").innerText = score;

  const modal = document.getElementById("game-over-modal");
  if (modal) modal.style.display = "flex";

  if (window.socket) {
    window.socket.emit("simpanSkor", {
      nama: playerName,
      skor: score,
      game: "piano",
    });
  }
}

window.restartGame = function () {
  // ISU-8 FIX: Emit mulaiGame agar server mencatat sesi bermain baru
  if (window.socket) {
    window.socket.emit("mulaiGame", "piano");
    window._activeGameSlug = "piano";
  }

  gameActive = false;
  clearInterval(timerInterval);

  score           = 0;
  timeLeft        = 60;
  currentSequence = [];
  playerSequence  = [];
  isPlayingNote   = false;
  _lastMelodyIndex = -1;

  if (scoreEl) scoreEl.innerText = "0";
  if (timerEl) timerEl.innerText = "60";
  if (questionBox) questionBox.innerText = "PILIH LEVEL & MULAI";

  clearSequenceIndicator();

  if (controlsArea) controlsArea.style.display = "";

  const modal = document.getElementById("game-over-modal");
  if (modal) modal.style.display = "none";

  disableInput(false);
  document.body.style.backgroundColor = "";
};

// Pastikan HTML siap baru jalankan listener
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireSocketEvents);
} else {
  wireSocketEvents();
}
