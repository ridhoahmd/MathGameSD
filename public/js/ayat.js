// --- 1. SETUP UI ---
const ui = {
  // Elemen Game
  start: document.getElementById("start-screen"),
  game: document.getElementById("game-screen"),
  result: document.getElementById("result-screen"),

  // Data Elemen
  questionText: document.getElementById("question-text"),
  optionsContainer: document.getElementById("options-container"),
  qCurrent: document.getElementById("q-current"),
  qTotal: document.getElementById("q-total"),
  score: document.getElementById("score"),
  finalScore: document.getElementById("final-score"),

  // UI Tutor (Pastikan ID ada)
  tutorOverlay: document.getElementById("tutor-overlay"),
  tutorText: document.getElementById("tutor-text"),

  // UI Latin
  latinText: document.getElementById("latin-text"),
};

// Variabel Global
let questions = [];
let currentIndex = 0;
let score = 0;
let isAnswering = false;
let tutorUsageCount = 0;
const MAX_TUTOR_USAGE = 3;
let currentLevel = "mudah";
let playerName = localStorage.getItem("playerName") || "Guest";
let currentGameMode = "solo"; // "solo" or "versus"

// ENDLESS MODE: Timer system
let timeLeft = 30;
let timerInterval;

// ENDLESS MODE: Auto-request system
let isRequestingQuestions = false;
let lastRequestTime = 0;
const REQUEST_COOLDOWN = 5000;

// SOCKET RACE CONDITION FIX: guard agar listener tidak didaftarkan dua kali
let _socketWired = false;

// --- 2. PILIH LEVEL ---
document.querySelectorAll(".btn-diff").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".btn-diff")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentLevel = btn.dataset.level;
  });
});

// --- 2.5 PILIH MODE ---
window.selectMode = function (mode) {
  currentGameMode = mode;
  // Update UI buttons
  document.querySelectorAll(".btn-mode").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.dataset.mode === mode) btn.classList.add("active");
  });
};

// --- 3. MULAI GAME ---
function startGame() {
  // alert("Debug: Mode is " + currentGameMode); // Uncomment for extreme debug

  const btnStart = document.querySelector(".btn-start");
  if (btnStart) {
    btnStart.innerText = "⏳ Membuka Mushaf...";
    btnStart.disabled = true;
  }

  if (window.socket) {
    window.socket.emit("mulaiGame", "ayat");
    window.socket.emit("mintaSoalAI", {
      kategori: "ayat",
      tingkat: currentLevel,
    });
  }

  // Jaga-jaga kalo loading kelamaan (Timeout)
  setTimeout(() => {
    if (ui.start && !ui.start.classList.contains("hidden")) {
      if (btnStart) {
        btnStart.innerText = "⚠️ Timeout. Coba Lagi";
        btnStart.disabled = false;
      }
    }
  }, 8000);
}

// --- 4. PENGATURAN KONEKSI SOCKET ---
function wireSocketEvents() {
  // RACE CONDITION FIX: Hanya daftarkan listener sekali
  if (_socketWired) return;

  if (window.socket) {
    _socketWired = true;

    // Memastikan tidak ada duplikasi listener
    window.socket.off("soalDariAI");
    window.socket.on("soalDariAI", (response) => {
      // Cek error dlu
      if (!response || !response.data || response.data.length === 0) {
        console.error("Game Ayat: Data server error");
        alert("Gagal memuat soal. Coba lagi ya.");

        const btnStart = document.querySelector(".btn-start");
        if (btnStart) {
          btnStart.innerText = "MULAI GAME";
          btnStart.disabled = false;
        }

        if (ui.start && ui.start.classList.contains("hidden")) {
          ui.start.classList.remove("hidden");
          ui.start.classList.add("active");
        }

        isRequestingQuestions = false; // Reset flag
        return;
      }

      // --- CHECK VERSUS MODE FIRST ---
      if (currentGameMode === "versus") {
        // FIX: Stop any running solo timer before entering versus
        clearInterval(timerInterval);
        if (typeof VersusAyat !== "undefined") {
          VersusAyat.init(response.data);
        } else {
          alert("Versus module not loaded!");
        }
        return; // Stop Solo logic completely
      }

      // ENDLESS MODE: Determine if initial load or append
      const isInitialLoad = questions.length === 0;

      if (isInitialLoad) {
        // Original behavior - first load
        questions = response.data;
        currentIndex = 0;
        score = 0;
        isAnswering = false;
        tutorUsageCount = 0;

        if (ui.qTotal) ui.qTotal.innerText = questions.length;
        if (ui.score) ui.score.innerText = "0";

        ui.start.classList.add("hidden");
        ui.game.classList.remove("hidden");
        ui.game.classList.add("active");

        // Show save button di stats-row
        const btnSave = document.getElementById("btn-save-exit");
        if (btnSave) btnSave.classList.remove("hidden");

        loadQuestion();
      } else {
        // ENDLESS MODE: Append new questions
        const prevLength = questions.length;
        questions.push(...response.data);
        isRequestingQuestions = false;

        // MEMORY OPTIMIZATION: Mencegah array bengkak di HP low-end
        if (questions.length > 30 && currentIndex > 10) {
          const hapusCount = 10;
          questions.splice(0, hapusCount);
          currentIndex -= hapusCount;
        }


        // Visual feedback
        showToast(`📥 +${response.data.length} ayat baru dimuat`);

        // If waiting for questions, continue
        if (currentIndex >= prevLength) {
          loadQuestion();
        }
      }
    });

    // Dapet Jawaban Tutor
    window.socket.off("penjelasanTutor");
    window.socket.on("penjelasanTutor", (data) => {
      if (ui.tutorText) {
        ui.tutorText.innerHTML = data.penjelasan || data.teks || "Maaf, koneksi putus.";
      }
    });

  } else {
    // Jika socket belum siap, tunggu 100ms dan coba lagi
    setTimeout(wireSocketEvents, 100);
  }
}

// --- 5. TAMPILIN SOAL ---
function loadQuestion() {
  isAnswering = false;

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
  if (ui.questionText) ui.questionText.innerText = q.tanya || q.soal;
  if (ui.qCurrent) ui.qCurrent.innerText = currentIndex + 1;
  if (ui.optionsContainer) ui.optionsContainer.innerHTML = "";

  // Set teks latin (disembunyiin dulu)
  if (ui.latinText) {
    ui.latinText.innerText = q.latin || "";
    ui.latinText.style.display = "none";
  }

  // Opsi Jawaban
  const daftarOpsi = q.opsi || [];
  daftarOpsi.forEach((opt) => {
    const btn = document.createElement("button");
    btn.classList.add("btn-option");
    btn.innerText = opt;

    btn.onclick = () => {
      if (isAnswering) return;
      isAnswering = true;

      // ENDLESS MODE: Stop timer when answering
      clearInterval(timerInterval);

      const kunci = q.jawab || q.jawaban;
      const isCorrect = opt === kunci;

      if (isCorrect) {
        btn.classList.add("correct");

        // Itung Combo
        let multiplier = 1;
        if (typeof ComboManager !== "undefined") {
          multiplier = ComboManager.addStreak();
        }

        // REBALANCED: Reduced from 20 to 18 (line 151)
        const points = Math.round(18 * multiplier);
        score += points;
        if (ui.score) ui.score.innerText = score;

        // P1: Floating score (+N ×M) melayang dari score counter
        if (typeof ComboManager !== "undefined") {
          ComboManager.showFloatingScore(points, multiplier, ui.score);
        }
        try {
          AudioManager.playCorrect();
        } catch (e) {}

        setTimeout(() => {
          currentIndex++;
          loadQuestion();
        }, 2000);
      } else {
        if (typeof ComboManager !== "undefined") ComboManager.reset();
        btn.classList.add("wrong");
        try {
          AudioManager.playWrong();
        } catch (e) {}

        // Kasih tau yang bener
        const allBtns = document.querySelectorAll(".btn-option");
        allBtns.forEach((b) => {
          if (b.innerText === kunci) b.classList.add("correct");
        });

        // Panggil Tutor (Kalo masih ada kuota)
        if (tutorUsageCount < MAX_TUTOR_USAGE) {
          setTimeout(() => {
            panggilTutor(q.tanya || q.soal, opt, kunci);
          }, 1000);
        } else {
          setTimeout(() => {
            currentIndex++;
            loadQuestion();
          }, 2500);
        }
      }
    };
    ui.optionsContainer.appendChild(btn);
  });

  // ENDLESS MODE: Start 30-second timer
  startQuestionTimer();
}

// ENDLESS MODE: Timer functions
function startQuestionTimer() {
  clearInterval(timerInterval);
  timeLeft = 30; // 30 seconds for Sambung Ayat
  updateTimerUI();

  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerUI();

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      handleTimeout();
    }
  }, 1000);
}

function updateTimerUI() {
  const timerEl = document.getElementById("timer");
  if (timerEl) timerEl.textContent = timeLeft;
}

function handleTimeout() {
  if (isAnswering) return; // Already answered

  isAnswering = true;

  try {
    AudioManager.playWrong();
  } catch (e) {}

  // Disable all buttons
  const buttons = document.querySelectorAll(".btn-option");
  buttons.forEach((b) => (b.disabled = true));

  // Show correct answer
  const q = questions[currentIndex];
  const kunci = q.jawab || q.jawaban;
  buttons.forEach((b) => {
    if (b.innerText === kunci) b.classList.add("correct");
  });

  // Move to next question
  setTimeout(() => {
    currentIndex++;
    loadQuestion();
  }, 2000);
}

// --- 6. TUTOR AI ---
function panggilTutor(soal, jawabUser, jawabBenar) {
  tutorUsageCount++;

  // PENTING: pake flex center biar rapi
  if (ui.tutorOverlay) {
    ui.tutorOverlay.style.display = "flex";
    ui.tutorOverlay.classList.remove("hidden");
  }

  if (ui.tutorText)
    ui.tutorText.innerHTML = `
  <div class="tutor-loading-box">
    <div class="loader-spinner"></div>
    <span class="loading-text">GURU SEDANG MENGANALISIS AYAT...</span>
  </div>
`;

  if (window.socket) {
    window.socket.emit("mintaPenjelasan", {
      game: "ayat",
      soal: soal,
      jawabanUser: jawabUser,
      jawabanBenar: jawabBenar,
    });
  }
}

// (Logika listener penjabaran dipindahkan ke wireSocketEvents)
// ...

// Tutup Tutor
window.tutupTutor = function () {
  if (ui.tutorOverlay) {
    ui.tutorOverlay.style.display = "none";
  }
  // Lanjut main
  currentIndex++;
  loadQuestion();
};

// --- 7. TOGGLE TEKS LATIN ---
window.toggleLatin = function () {
  if (ui.latinText) {
    if (ui.latinText.style.display === "none") {
      ui.latinText.style.display = "block";
    } else {
      ui.latinText.style.display = "none";
    }
  }
};

// --- 8. GAME SELESAI ---
function endGame() {
  // Stop timer
  clearInterval(timerInterval);

  ui.game.classList.remove("active");
  ui.game.classList.add("hidden");
  ui.result.classList.remove("hidden");
  ui.result.classList.add("active");
  if (ui.finalScore) ui.finalScore.innerText = score;

  // Hide save button
  const btnSave = document.getElementById("btn-save-exit");
  if (btnSave) btnSave.classList.add("hidden");

  if (window.socket) {
    window.socket.emit("simpanSkor", {
      nama: playerName,
      skor: score,
      game: "ayat",
    });
  }
}

// --- 9. INISIALISASI ---
document.addEventListener("DOMContentLoaded", () => {
  const btnStart = document.querySelector(".btn-start");
  if (btnStart) {
    const newBtn = btnStart.cloneNode(true);
    btnStart.parentNode.replaceChild(newBtn, btnStart);
    newBtn.addEventListener("click", startGame);
  }
});

// ==========================================
// ENDLESS MODE FUNCTIONS
// ==========================================

// Auto-request more questions
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
      kategori: "ayat",
      tingkat: currentLevel,
      mode: "endless",
    });
  }
}

function showLoadingMessage() {
  if (ui.questionText) {
    ui.questionText.innerText = "⏳ Memuat ayat berikutnya...";
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
      game: "ayat",
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
    `�� Ayat terjawab: ${currentIndex}`;

  if (!confirm(confirmMsg)) return;

  // Stop timer
  clearInterval(timerInterval);

  // Save score
  if (window.socket) {
    window.socket.emit("simpanSkor", {
      nama: playerName,
      skor: score,
      game: "ayat",
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
        game: "ayat",
        skor: score,
        soalDijawab: currentIndex,
      });
      navigator.sendBeacon("/api/quick-save", data);
    }
  }
});

// --- RESTART TANPA RELOAD ---
window.restartGame = function () {
  // BUG-V2 FIX: Cek apakah layar hasil versus sedang tampil
  if (typeof VersusAyat !== "undefined" && VersusAyat.isActive()) {
    VersusAyat.restart();
    return;
  }

  // 1. Stop semua timer
  clearInterval(timerInterval);

  // 2. Reset semua state
  questions = [];
  currentIndex = 0;
  score = 0;
  isAnswering = false;
  tutorUsageCount = 0;
  timeLeft = 30;
  isRequestingQuestions = false;
  lastRequestTime = 0;

  // 3. Reset UI display
  if (ui.score) ui.score.innerText = "0";
  if (ui.finalScore) ui.finalScore.innerText = "0";
  if (ui.tutorOverlay) ui.tutorOverlay.style.display = "none";

  // 4. Sembunyikan result-screen & tampilkan start-screen
  if (ui.result) {
    ui.result.classList.remove("active");
    ui.result.classList.add("hidden");
  }
  if (ui.game) {
    ui.game.classList.remove("active");
    ui.game.classList.add("hidden");
  }
  if (ui.start) {
    ui.start.classList.remove("hidden");
    ui.start.classList.add("active");
  }

  // 5. Reset tombol start
  const btnStart = document.querySelector(".btn-start");
  if (btnStart) {
    btnStart.innerText = "MULAI TAHFIDZ";
    btnStart.disabled = false;
  }

  // 6. Simpan tombol save-exit
  const btnSave = document.getElementById("btn-save-exit");
  if (btnSave) btnSave.classList.add("hidden");

};


// Pastikan HTML siap baru kita jalankan listener
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireSocketEvents);
} else {
  wireSocketEvents();
}
