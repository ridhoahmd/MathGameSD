const screens = {
  start: document.getElementById("start-screen"),
  game: document.getElementById("game-screen"),
  result: document.getElementById("result-screen"),
};

const ui = {
  questionText: document.getElementById("question-text"),
  optionsContainer: document.getElementById("options-container"),
  qCurrent: document.getElementById("q-current"),
  qTotal: document.getElementById("q-total"),
  score: document.getElementById("score"),
  timer: document.getElementById("timer"),
  progressFill: document.getElementById("progress"),
  finalScore: document.getElementById("final-score"),
  resultMsg: document.getElementById("result-msg"),
  // UI Tutor
  tutorOverlay: document.getElementById("tutor-overlay"),
  tutorText: document.getElementById("tutor-text"),
};

let currentLevel = "mudah";
let currentGameMode = "solo"; // "solo" or "versus"
let questions = [];
let currentIndex = 0;
let score = 0;
let timeLeft = 0;
let timerInterval;
let playerName = localStorage.getItem("playerName") || "Guest";

// 0. Mode Selector
window.selectMode = function (mode) {
  currentGameMode = mode;
  document.querySelectorAll(".btn-mode").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.dataset.mode === mode) btn.classList.add("active");
  });
};

// Batas Tutor
let tutorUsageCount = 0;
const MAX_TUTOR_USAGE = 3;

// ENDLESS MODE: variabel diletakkan di sini agar tidak ReferenceError
let isRequestingQuestions = false;
let lastRequestTime = 0;
const REQUEST_COOLDOWN = 5000; // 5 seconds

// SOCKET RACE CONDITION FIX: guard agar listener tidak didaftarkan dua kali
let _socketWired = false;

// 1. Tombol Difficulty
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

// 2. Mulai Game
function startGame() {
  const btnStart = document.querySelector(".btn-start");
  if (btnStart) {
    btnStart.innerText = "⏳ Memuat...";
    btnStart.disabled = true;
  }
  if (typeof AudioManager !== "undefined") AudioManager.init();

  // Refresh Sesi
  if (window.socket) {
    window.socket.emit("mintaDataProfil", playerName);
    window.socket.emit("mulaiGame", "nabi");
    window.socket.emit("mintaSoalAI", {
      kategori: "nabi",
      tingkat: currentLevel,
    });
  }

  setTimeout(() => {
    if (screens.start.classList.contains("active")) {
      if (btnStart) {
        btnStart.innerText = "⚠️ Coba Lagi";
        btnStart.disabled = false;
      }
    }
  }, 8000);
}

// 3. PENGATURAN KONEKSI SOCKET
function wireSocketEvents() {
  // RACE CONDITION FIX: Hanya daftarkan listener sekali
  if (_socketWired) return;

  if (window.socket) {
    _socketWired = true;

    // Memastikan tidak ada duplikasi listener
    window.socket.off("soalDariAI");
    window.socket.on("soalDariAI", (response) => {
      if (response.kategori === "nabi") {
        // Cek error dulu
        if (!response.data || response.data.length === 0) {
          console.error("Nabi game: Error data");
          alert("Gagal memuat soal. Silakan coba lagi.");

          const btnStart = document.querySelector(".btn-start");
          if (btnStart) {
            btnStart.innerText = "MULAI GAME";
            btnStart.disabled = false;
          }

          if (screens.start) {
            screens.start.classList.remove("hidden");
            screens.start.classList.add("active");
          }

          isRequestingQuestions = false; // Reset flag
          return;
        }

        // ENDLESS MODE: Determine if initial load or append
        const isInitialLoad = questions.length === 0;

        if (isInitialLoad) {
          // Original behavior - first load
          questions = response.data;

          // CHECK MODE
          if (currentGameMode === "versus") {
            // FIX: Stop any running solo timer before entering versus
            clearInterval(timerInterval);
            if (typeof VersusNabi !== "undefined") {
              VersusNabi.init(questions);
            } else {
              alert("Versus module not loaded!");
            }
            return; // Stop Solo logic
          }

          currentIndex = 0;
          score = 0;
          if (ui.score) ui.score.innerText = "0";
          if (ui.qTotal) ui.qTotal.innerText = questions.length;

          screens.start.classList.remove("active");
          screens.start.classList.add("hidden");
          screens.game.classList.remove("hidden");
          screens.game.classList.add("active");

          loadQuestion();
        } else {
          // ENDLESS MODE: Append new questions
          const prevLength = questions.length;
          questions.push(...response.data);
          isRequestingQuestions = false;


          // Visual feedback
          showToast(`📥 +${response.data.length} soal baru dimuat`);

          // If waiting for questions, continue
          if (currentIndex >= prevLength) {
            loadQuestion();
          }
        }
      }
    });

    // Terima jawaban tutor
    window.socket.off("penjelasanTutor");
    window.socket.on("penjelasanTutor", (data) => {
      if (ui.tutorText) ui.tutorText.innerHTML = data.penjelasan || data.teks;
    });

  } else {
    // Jika socket belum siap, tunggu 100ms dan coba lagi
    setTimeout(wireSocketEvents, 100);
  }
}

function loadQuestion() {
  // ENDLESS MODE: Check if need more questions
  if (currentIndex >= questions.length - 2) {
    requestMoreQuestions();
  }

  // If truly out of questions, show loading
  if (currentIndex >= questions.length) {
    showLoadingMessage();
    return;
  }

  // Auto-save check
  checkAutoSave();
  const q = questions[currentIndex];
  if (ui.questionText) ui.questionText.innerText = q.tanya;
  if (ui.qCurrent) ui.qCurrent.innerText = currentIndex + 1;
  if (ui.progressFill) {
    const pct = (currentIndex / questions.length) * 100;
    ui.progressFill.style.width = `${pct}%`;
  }
  if (ui.optionsContainer) {
    ui.optionsContainer.innerHTML = "";
    q.opsi.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "btn-option";
      btn.innerText = opt;
      btn.onclick = () => checkAnswer(opt, q.jawab, btn);
      ui.optionsContainer.appendChild(btn);
    });
  }
  startTimer(25); // ENDLESS MODE: 25 seconds per question
}

function startTimer(seconds) {
  if (timerInterval) clearInterval(timerInterval);
  timeLeft = seconds;
  if (ui.timer) ui.timer.innerText = timeLeft;
  timerInterval = setInterval(() => {
    timeLeft--;
    if (ui.timer) ui.timer.innerText = timeLeft;
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

  // Reset combo ketika waktu habis
  if (typeof ComboManager !== "undefined") {
    ComboManager.reset();
  }

  // ISU-2-B FIX: Tampilkan jawaban benar agar siswa bisa belajar dari timeout
  const q = questions[currentIndex];
  const kunci = q ? q.jawab : null;
  const buttons = document.querySelectorAll(".btn-option");

  buttons.forEach((b) => {
    b.disabled = true;
    const bText = b.innerText.trim().toLowerCase();
    const kunciClean = kunci ? kunci.trim().toLowerCase() : null;
    if (kunciClean && bText === kunciClean) {
      // Highlight tombol yang benar dengan warna hijau
      b.style.background = "linear-gradient(135deg, #2ecc71, #27ae60)";
      b.style.color = "white";
      b.style.borderColor = "#2ecc71";
      b.style.boxShadow = "0 0 15px rgba(46, 204, 113, 0.5)";
    }
  });

  // Tampilkan toast "Waktu Habis"
  if (kunci) showToast("⏰ Waktu habis! Jawaban: " + kunci);

  // Beri siswa 2 detik untuk melihat jawaban sebelum pindah soal
  setTimeout(() => {
    currentIndex++;
    loadQuestion();
  }, 2000);
}

function checkAnswer(selectedRaw, correctRaw, btnElement) {
  clearInterval(timerInterval);
  const cleanStr = (str) => str.trim().toLowerCase().replace(/\s+/g, " ");
  const selected = cleanStr(selectedRaw);
  const correct = cleanStr(correctRaw);
  const allButtons = document.querySelectorAll(".btn-option");
  allButtons.forEach((b) => (b.disabled = true));

  // FIX: Menggunakan Exact Match (===) untuk Pilihan Ganda agar tidak bisa diakali
  const isCorrect = selected === correct;

  if (isCorrect) {
    btnElement.classList.add("correct");
    btnElement.style.background = "#2ecc71";
    try {
      AudioManager.playCorrect();
    } catch (e) {}

    // Hitung Combo
    let multiplier = 1;
    if (typeof ComboManager !== "undefined")
      multiplier = ComboManager.addStreak();

    let basePoints = 20 + Math.floor(timeLeft / 2);
    const points = Math.round(basePoints * multiplier);
    score += points;
    if (ui.score) {
      ui.score.innerText = score;
      // ISU-2-C: Trigger score bounce animation
      ui.score.classList.remove("score-bounce");
      void ui.score.offsetWidth; // Force reflow agar animasi bisa di-restart
      ui.score.classList.add("score-bounce");
      setTimeout(() => ui.score.classList.remove("score-bounce"), 500);
    }

    // P1: Floating score (+N ×M) melayang dari score counter
    if (typeof ComboManager !== "undefined") {
      ComboManager.showFloatingScore(points, multiplier, ui.score);
    }
    setTimeout(() => {
      currentIndex++;
      loadQuestion();
    }, 2000);
  } else {
    // SALAH
    if (typeof ComboManager !== "undefined") ComboManager.reset();
    btnElement.classList.add("wrong");
    btnElement.style.background = "#e74c3c";
    try {
      AudioManager.playWrong();
    } catch (e) {}

    // Kasih tau jawaban bener
    allButtons.forEach((b) => {
      if (cleanStr(b.innerText).includes(correct))
        b.style.background = "#2ecc71";
    });

    // Panggil AI klo salah
    panggilTutor(
      document.getElementById("question-text").innerText,
      selectedRaw,
      correctRaw,
    );
  }
}

// Logika Tutor
function panggilTutor(soal, jawabUser, jawabBenar) {
  if (tutorUsageCount >= MAX_TUTOR_USAGE) {
    setTimeout(() => {
      currentIndex++;
      loadQuestion();
    }, 2000);
    return;
  }
  tutorUsageCount++;

  // Stop timer pas tutor muncul
  clearInterval(timerInterval);

  if (ui.tutorOverlay) {
    ui.tutorOverlay.style.display = "flex";
    if (ui.tutorText) {
      ui.tutorText.innerHTML = `
    <div class="tutor-loading-box">
      <div class="loader-spinner"></div>
      <span class="loading-text">MEMBUKA GULUNGAN SEJARAH...</span>
    </div>
  `;
    }
  }

  if (window.socket) {
    window.socket.emit("mintaPenjelasan", {
      game: "nabi",
      soal: soal,
      jawabanUser: jawabUser,
      jawabanBenar: jawabBenar,
    });
  }
}

// (Logika listener penjabaran dipindahkan ke wireSocketEvents)
// ...

// Tutup tutor
window.tutupTutor = function () {
  if (ui.tutorOverlay) ui.tutorOverlay.style.display = "none";
  currentIndex++;
  loadQuestion();
};

function endGame() {
  // Bersihin timer
  clearInterval(timerInterval);

  screens.game.classList.remove("active");
  screens.game.classList.add("hidden");
  screens.result.classList.remove("hidden");
  screens.result.classList.add("active");
  if (ui.finalScore) ui.finalScore.innerText = score;
  try {
    AudioManager.playWin();
  } catch (e) {}
  if (window.socket) {
    window.socket.emit("mintaDataProfil", playerName);
    window.socket.emit("simpanSkor", {
      nama: playerName,
      skor: score,
      game: "nabi",
    });
  }
}

// ==========================================
// ENDLESS MODE FUNCTIONS
// ==========================================

// (isRequestingQuestions, lastRequestTime, REQUEST_COOLDOWN sudah dideklarasikan di atas)

function requestMoreQuestions() {
  // Rate limiting
  const now = Date.now();
  if (isRequestingQuestions || now - lastRequestTime < REQUEST_COOLDOWN) {
    return;
  }

  isRequestingQuestions = true;
  lastRequestTime = now;


  if (window.socket) {
    window.socket.emit("mintaSoalAI", {
      kategori: "nabi",
      tingkat: currentLevel,
      mode: "endless",
    });
  }
}

function showLoadingMessage() {
  if (ui.questionText) {
    ui.questionText.innerText = "⏳ Memuat soal berikutnya...";
  }
  // Retry after delay
  setTimeout(() => {
    if (currentIndex < questions.length) {
      loadQuestion();
    } else {
      requestMoreQuestions();
    }
  }, 2000);
}

// Auto-save system
function checkAutoSave() {
  if (currentIndex > 0 && currentIndex % 5 === 0) {
    autoSaveProgress();
  }
}

function autoSaveProgress() {
  if (window.socket) {
    window.socket.emit("simpanProgress", {
      nama: playerName,
      game: "nabi",
      skor: score,
      soalDijawab: currentIndex,
      timestamp: Date.now(),
    });

    // FIX: Tunggu ACK dari server sebelum tampilkan toast (bukan asumsi berhasil)
    window.socket.once("progressTersimpan", () => {
      showToast("💾 Progress tersimpan");
    });
  }
}

// Save and exit
window.saveAndExit = function () {
  // Confirmation
  const confirmMsg =
    `Yakin ingin menyimpan dan keluar?\n\n` +
    `✅ Skor: ${score}\n` +
    `📝 Soal terjawab: ${currentIndex}`;

  if (!confirm(confirmMsg)) return;

  // Stop timer
  clearInterval(timerInterval);

  // Save score
  if (window.socket) {
    window.socket.emit("simpanSkor", {
      nama: playerName,
      skor: score,
      game: "nabi",
      soalDijawab: currentIndex,
      mode: "endless",
    });
  }

  // Show result
  endGame();
};

// Toast notification
function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast-notification";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// Auto-save on page close (emergency backup)
window.addEventListener("beforeunload", (e) => {
  if (score > 0 && currentIndex > 0) {
    // Quick sync save attempt
    if (navigator.sendBeacon && window.socket) {
      const data = JSON.stringify({
        nama: playerName,
        game: "nabi",
        skor: score,
        soalDijawab: currentIndex,
      });
      const dataBlob = new Blob([data], { type: "application/json" });
      // Note: This endpoint needs to be implemented server-side
      navigator.sendBeacon("/api/quick-save", dataBlob);
    }
  }
});

// --- RESTART TANPA RELOAD ---
window.restartGame = function () {
  // BUG-V2 FIX: Cek apakah layar hasil versus sedang tampil
  if (typeof VersusNabi !== "undefined" && VersusNabi.isActive()) {
    VersusNabi.restart();
    return;
  }

  // 1. Stop semua timer
  clearInterval(timerInterval);

  // 2. Reset semua state
  questions = [];
  currentIndex = 0;
  score = 0;
  timeLeft = 0;
  tutorUsageCount = 0;
  isRequestingQuestions = false;
  lastRequestTime = 0;

  // 3. Reset UI display
  if (ui.score) ui.score.innerText = "0";
  if (ui.finalScore) ui.finalScore.innerText = "0";
  if (ui.timer) ui.timer.innerText = "00";
  if (ui.tutorOverlay) ui.tutorOverlay.style.display = "none";

  // 4. Sembunyikan screens → kembalikan ke start
  if (screens.result) {
    screens.result.classList.remove("active");
    screens.result.classList.add("hidden");
  }
  if (screens.game) {
    screens.game.classList.remove("active");
    screens.game.classList.add("hidden");
  }
  if (screens.start) {
    screens.start.classList.remove("hidden");
    screens.start.classList.add("active");
  }

  // 5. Reset tombol start
  const btnStart = document.querySelector(".btn-start");
  if (btnStart) {
    btnStart.innerText = "BUKA GULUNGAN SEJARAH";
    btnStart.disabled = false;
  }

  // 6. Sembunyikan btn-save-exit
  const btnSave = document.getElementById("btn-save-exit");
  if (btnSave) {
    btnSave.classList.add("hidden");
    btnSave.style.display = ""; // Bersihkan inline style jika ada
  }

};


// Pastikan HTML siap baru kita jalankan listener
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireSocketEvents);
} else {
  wireSocketEvents();
}
