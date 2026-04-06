// PERBAIKAN: Jangan tangkap window.socket di sini — bisa null saat file diparse!
// Gunakan window.socket secara langsung di dalam fungsi.

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

function playTone(num) {
  // Paksa audio nyala
  if (audioCtx.state === "suspended") audioCtx.resume();

  const osc = audioCtx.createOscillator();
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
    document
      .querySelectorAll(".btn-diff")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    level = btn.dataset.level;
  });
});

// Mulai Game
window.startGameSession = function () {
  if (window.socket) {
    console.log("⏱️ Start Piano");
    window.socket.emit("mulaiGame", "piano");
  }
  if (audioCtx.state === "suspended") audioCtx.resume();

  controlsArea.style.display = "none";
  score = 0;
  timeLeft = 60;
  scoreEl.innerText = score;
  timerEl.innerText = timeLeft;
  gameActive = true;

  // Reset Timer lama
  if (timerInterval) clearInterval(timerInterval);

  // Timer jalan
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

  if (window.socket) {
    window.socket.emit("mintaSoalAI", { kategori: "piano", tingkat: level });
  }
}

// ISU-6-B: Countdown sebelum sequence dimainkan
async function countdownBeforePlay() {
  const msgs = ["SIAP?", "3...", "2...", "1...", "👁️ DENGAR!"];
  for (const msg of msgs) {
    if (!gameActive) return; // Abort jika game sudah selesai
    questionBox.innerText = msg;
    await sleep(450);
  }
}

// PENGATURAN KONEKSI SOCKET — dipindahkan ke dalam fungsi agar aman
function wireSocketEvents() {
  // RACE CONDITION FIX: Hanya daftarkan listener sekali
  if (_socketWired) return;

  if (window.socket) {
    _socketWired = true;

    // Anti Memory Leak: off dulu sebelum on
    window.socket.off("soalDariAI");
    window.socket.on("soalDariAI", async (data) => {
      if (data && data.kategori === "piano" && gameActive) {
        let info = data.data;
        if (Array.isArray(info)) {
          info = info[0];
        }

        currentSequence = info.sequence || [1, 2, 3];
        playerSequence = [];

        // ISU-6-B: Countdown sebelum nada dimainkan
        await countdownBeforePlay();

        if (gameActive) {
          questionBox.innerText = "👁️ DENGAR & HAFALKAN!";
          await playSequence(currentSequence);
        }

        if (gameActive) {
          questionBox.innerText = "🎹 ULANGI SEKARANG!";
          disableInput(false);
        }
      }
    });

    console.log("✅ Piano game socket listener registered");
  } else {
    // Jika socket belum siap, tunggu 100ms dan coba lagi
    setTimeout(wireSocketEvents, 100);
  }
}

async function playSequence(seq) {
  await sleep(500);

  for (let num of seq) {
    if (!gameActive) break;
    await highlightKey(num);
    await sleep(400);
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

window.playNote = function (num) {
  if (!gameActive) return;

  // SPAM-CLICK FIX: Debounce 80ms — cegah multi-tap dalam satu jari
  if (isPlayingNote) return;
  isPlayingNote = true;
  setTimeout(() => {
    isPlayingNote = false;
  }, 80);

  playTone(num);
  const keyEl = document.querySelector(`.key[data-val="${num}"]`);
  if (keyEl) {
    keyEl.classList.add("active");
    setTimeout(() => keyEl.classList.remove("active"), 150);
  }

  playerSequence.push(parseInt(num));

  checkInput();
};

function checkInput() {
  const idx = playerSequence.length - 1;

  if (playerSequence[idx] !== currentSequence[idx]) {
    disableInput(true); // Kunci agar tuts tidak bisa ditekan lagi saat salah
    flashScreen("#550000"); // Merah Gelap
    questionBox.innerText = "❌ SALAH! Ganti Soal...";

    setTimeout(requestNewSequence, 1000);
    return;
  }

  if (playerSequence.length === currentSequence.length) {
    disableInput(true); // Kunci karena sedang memproses pindah soal
    // REBALANCED: Reduced from 10 to 8 (line 186)
    score += 8 * currentSequence.length;
    scoreEl.innerText = score;

    flashScreen("#003300");
    questionBox.innerText = "✅ HEBAT! +Poin";

    try {
      AudioManager.playCorrect();
    } catch (e) {}

    setTimeout(requestNewSequence, 800);
  }
}

function flashScreen(color) {
  document.body.style.backgroundColor = color;
  setTimeout(() => {
    document.body.style.backgroundColor = "#1e1e2e";
  }, 200);
}

// Game Over
function endGame() {
  gameActive = false;

  // Matiin timer
  clearInterval(timerInterval);

  document.getElementById("final-score").innerText = score;

  const modal = document.getElementById("game-over-modal");
  if (modal) modal.style.display = "flex";

  console.log(`🎹 Waktu Habis! Skor: ${score}`);

  if (window.socket) {
    window.socket.emit("simpanSkor", {
      nama: playerName,
      skor: score,
      game: "piano",
    });
  }
}

// --- RESTART TANPA RELOAD ---
window.restartGame = function () {
  // 1. Stop timer & reset state
  gameActive = false;
  clearInterval(timerInterval);

  // 2. Reset semua variabel game
  score = 0;
  timeLeft = 60;
  currentSequence = [];
  playerSequence = [];
  isPlayingNote = false;

  // 3. Reset UI
  if (scoreEl) scoreEl.innerText = "0";
  if (timerEl) timerEl.innerText = "60";
  if (questionBox) questionBox.innerText = "PILIH LEVEL & MULAI";

  // 4. Tampilkan kembali area kontrol (level + btn mulai)
  if (controlsArea) controlsArea.style.display = "";

  // 5. Sembunyikan modal Game Over
  const modal = document.getElementById("game-over-modal");
  if (modal) modal.style.display = "none";

  // 6. Re-enable semua tuts piano
  disableInput(false);

  // 7. Reset background ke warna normal
  document.body.style.backgroundColor = "#1e1e2e";

  console.log("🔄 Piano game restarted (no reload)");
};

// Pastikan HTML siap baru jalankan listener
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireSocketEvents);
} else {
  wireSocketEvents();
}
