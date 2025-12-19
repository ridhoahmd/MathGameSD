const socket = io();

// DOM Elements
const screens = {
  start: document.getElementById("start-screen"),
  game: document.getElementById("game-screen"),
  result: document.getElementById("result-screen"),
};

// Pastikan ID di HTML cocok dengan ini:
// <span id="q-current"></span> dan <span id="q-total"></span>
const ui = {
  questionText: document.getElementById("question-text"),
  latinText: document.getElementById("latin-text"), // <--- 🔥 TAMBAHKAN INI
  optionsContainer: document.getElementById("options-container"),
  qCurrent: document.getElementById("q-current"), // Pengganti questionNumber
  qTotal: document.getElementById("q-total"), // Pengganti questionNumber
  score: document.getElementById("score"),
  timer: document.getElementById("timer"),
  progressFill: document.getElementById("progress"),
  finalScore: document.getElementById("final-score"),
  resultMsg: document.getElementById("result-msg"),
};

let currentLevel = "mudah";
let questions = [];
let currentIndex = 0;
let score = 0;
let timeLeft = 0;
let timerInterval;
let playerName = localStorage.getItem("playerName") || "Guest";

// Variabel Tutor
let tutorUsageCount = 0;
const MAX_TUTOR_USAGE = 3;

// Setup Buttons Difficulty
document.querySelectorAll(".btn-diff").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".btn-diff")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentLevel = btn.dataset.level;
    const disp = document.getElementById("difficulty-display");
    if (disp) disp.innerText = btn.innerText;
  });
});

function startGame() {
  const btnStart = document.querySelector(".btn-start");

  // 1. Tampilan Loading
  btnStart.innerText = "⏳ Membuka Mushaf...";
  btnStart.disabled = true;

  // 2. Pancing Audio
  if (typeof AudioManager !== "undefined") {
    AudioManager.init();
  }

  // 3. Request ke Server
  socket.emit("mintaSoalAI", { kategori: "ayat", tingkat: currentLevel });

  // 4. Safety Net (10 Detik)
  setTimeout(() => {
    if (screens.start.classList.contains("active")) {
      btnStart.innerText = "⚠️ Gagal. Coba Lagi?";
      btnStart.disabled = false;
    }
  }, 10000);
}

socket.on("soalDariAI", (response) => {
  if (response.kategori === "ayat") {
    questions = response.data;
    currentIndex = 0;
    score = 0;
    ui.score.innerText = "0";

    // Update Total Soal di UI
    if (ui.qTotal) ui.qTotal.innerText = questions.length;

    // 2. PINDAH LAYAR (FIX LAYAR BLANK)
    screens.start.classList.remove("active");
    screens.start.classList.add("hidden"); // Sembunyikan layar start

    // 🔥 INI KUNCI PERBAIKANNYA:
    screens.game.classList.remove("hidden"); // Buang class hidden!
    screens.game.classList.add("active"); // Aktifkan layar game

    loadQuestion();
  }
});

// --- FUNGSI LOAD SOAL (UPDATED HYBRID LATIN) ---
function loadQuestion() {
  // Reset Timer & UI
  clearInterval(timerInterval);
  if (ui.progressFill) ui.progressFill.style.width = "100%";

  // Cek Game Over
  if (currentIndex >= questions.length) {
    endGame();
    return;
  }

  const q = questions[currentIndex];

  // 1. Tampilkan Soal Arab
  if (ui.questionText) ui.questionText.innerText = q.tanya;

  // 🔥 2. LOGIKA LATIN (Hanya Level Mudah) 🔥
  if (ui.latinText) {
    // Cek apakah level saat ini 'mudah' DAN data latin tersedia dari server
    if (currentLevel === "mudah" && q.latin) {
      ui.latinText.innerText = q.latin;
      ui.latinText.style.display = "block"; // Munculkan
    } else {
      ui.latinText.style.display = "none"; // Sembunyikan (untuk Sedang/Sulit)
    }
  }

  // Update Nomor Soal
  if (ui.qCurrent) ui.qCurrent.innerText = currentIndex + 1;
  if (ui.qTotal) ui.qTotal.innerText = questions.length;

  // Bersihkan container opsi lama
  ui.optionsContainer.innerHTML = "";

  // Render Opsi Jawaban
  if (q.opsi && Array.isArray(q.opsi)) {
    q.opsi.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "btn-option";
      btn.innerText = opt;
      btn.onclick = () => checkAnswer(opt, q.jawab, btn);
      ui.optionsContainer.appendChild(btn);
    });
  }

  startTimer(20);
}

function startTimer(seconds) {
  clearInterval(timerInterval);
  timeLeft = seconds;
  if (ui.timer) ui.timer.innerText = timeLeft;

  timerInterval = setInterval(() => {
    timeLeft--;
    if (ui.timer) ui.timer.innerText = timeLeft;

    // Update Progress Bar (Opsional)
    if (ui.progressFill) {
      const percent = (timeLeft / seconds) * 100;
      ui.progressFill.style.width = `${percent}%`;
    }

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      handleTimeOut();
    }
  }, 1000);
}

function handleTimeOut() {
  try {
    AudioManager.playWrong();
  } catch (e) {}

  const buttons = document.querySelectorAll(".btn-option");
  buttons.forEach((btn) => (btn.disabled = true));

  // Highlight jawaban benar jika waktu habis (Opsional)
  const q = questions[currentIndex];
  // ... logika highlight ...

  setTimeout(() => {
    currentIndex++;
    loadQuestion();
  }, 2000);
}

// --- FUNGSI CHECK ANSWER (SUDAH AMAN) ---
function checkAnswer(selectedRaw, correctRaw, btnElement) {
  clearInterval(timerInterval);

  // Fungsi pembersih string yang aman
  const cleanStr = (str) => {
    if (str === null || str === undefined) return "";
    return String(str).trim().replace(/\s+/g, " ");
  };

  const selected = cleanStr(selectedRaw);
  const correct = cleanStr(correctRaw);

  const allButtons = document.querySelectorAll(".btn-option");
  allButtons.forEach((b) => (b.disabled = true));

  if (selected === correct) {
    // === BENAR ===
    if (btnElement) btnElement.classList.add("correct");
    try {
      AudioManager.playCorrect();
    } catch (e) {}

    score += 20;
    score += Math.floor(timeLeft / 2);
    ui.score.innerText = score;

    setTimeout(() => {
      currentIndex++;
      loadQuestion();
    }, 2000);
  } else {
    // === SALAH ===
    if (btnElement) btnElement.classList.add("wrong");
    try {
      AudioManager.playWrong();
    } catch (e) {}

    // Highlight Jawaban Benar
    allButtons.forEach((b) => {
      if (cleanStr(b.innerText) === correct) {
        b.classList.add("correct");
      }
    });

    // === LOGIKA AI TUTOR ===
    if (tutorUsageCount < MAX_TUTOR_USAGE) {
      tutorUsageCount++;

      const modal = document.getElementById("tutor-overlay");
      const textEl = document.getElementById("tutor-text");
      const titleEl = document.querySelector(".tutor-title");

      if (modal) modal.style.display = "flex";
      if (titleEl)
        titleEl.innerText = `GURU VIDEA (SISA: ${
          MAX_TUTOR_USAGE - tutorUsageCount
        })`;
      if (textEl)
        textEl.innerText = "Ustaz AI sedang mengecek tafsir ayat... 📖";

      const soalElem = document.getElementById("question-text");
      const soalTeks = soalElem ? soalElem.innerText : "Soal Ayat";

      socket.emit("mintaPenjelasan", {
        soal: soalTeks,
        jawabUser: selectedRaw,
        jawabBenar: correctRaw,
        kategori: "Sambung Ayat",
      });
    } else {
      console.log("Kuota Tutor Habis.");
      setTimeout(() => {
        currentIndex++;
        loadQuestion();
      }, 2500);
    }
  }
}

function endGame() {
  screens.game.classList.remove("active");
  screens.game.classList.add("hidden"); // Tambah hidden ke game

  screens.result.classList.remove("hidden"); // <--- WAJIB ADA INI
  screens.result.classList.add("active");


  ui.finalScore.innerText = score;

  if (score >= 80) ui.resultMsg.innerText = "Muntaz! Hafalanmu sangat kuat.";
  else if (score >= 50) ui.resultMsg.innerText = "Jayyid. Teruslah murojaah.";
  else ui.resultMsg.innerText = "Semangat! Ulangi lagi hafalannya.";

  try {
    AudioManager.playWin();
  } catch (e) {}

  socket.emit("simpanSkor", {
    nama: playerName,
    skor: score,
    game: "ayat",
  });
}

// PENERIMA PESAN TUTOR 
socket.on("penjelasanTutor", (data) => {
  const textEl = document.getElementById("tutor-text");
  if (!textEl) return;

  //1.ambil teks
  const content = data.penjelasan || data.teks;

  //2.render HTML 
  textEl.innerHTML = content;

  //3.animasi fade-in biar keren banget
  textEl.style.opacity = 0;
  textEl.style.transition = "opacity 0.5s ease-in";
  setTimeout(() => {
    textEl.style.opacity = 1;
  }, 50);
});

// Fungsi Tutup Modal Tutor
window.tutupTutor = function () {
  const modal = document.getElementById("tutor-overlay");
  if (modal) modal.style.display = "none";
  currentIndex++;
  loadQuestion();
};

// --- AUTO RECONNECT ---
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
});

socket.on("connect", () => {
  if (isReconnecting) {
    isReconnecting = false;
    const overlay = document.getElementById("connection-overlay");
    if (overlay) overlay.style.display = "none";
  }
});
