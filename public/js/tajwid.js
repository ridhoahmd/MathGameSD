// 1. Setup Data
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
  // Tutor UI
  tutorOverlay: document.getElementById("tutor-overlay"),
  tutorText: document.getElementById("tutor-text"),
  vContainer: document.getElementById("versus-container"), // Versus Container
};

let queue = [];
let currentItem = null;
let score = 0;
let isAnswering = false;
let playerName = localStorage.getItem("playerName") || "Guest";
let currentGameMode = "solo"; // "solo" or "versus"

let namaKategoriKiri = "Kiri";
let namaKategoriKanan = "Kanan";

let selectedLevel = "mudah";
let tutorUsageCount = 0;
const MAX_TUTOR_USAGE = 3;

// ENDLESS MODE: Timer system
let timeLeft = 25;
let timerInterval;

// ENDLESS MODE: Auto-request system
let isRequestingQuestions = false;
let lastRequestTime = 0;
const REQUEST_COOLDOWN = 5000;

// FIX BUG-1 & BUG-5: Flag to distinguish initial game load vs endless refill
let isInitialLoad = false;

// SOCKET RACE CONDITION FIX: guard agar listener tidak didaftarkan dua kali
let _socketWired = false;

// 2. Pilihan Level
document.addEventListener("DOMContentLoaded", () => {
  const diffButtons = document.querySelectorAll(".btn-diff");
  diffButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      diffButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedLevel = btn.dataset.level;
    });
  });

  // Sambungin tombol start
  initStartButton();
});

function initStartButton() {
  const tombolMulai = document.querySelector(".btn-start");
  if (tombolMulai) {
    const tombolBaru = tombolMulai.cloneNode(true);
    tombolMulai.parentNode.replaceChild(tombolBaru, tombolMulai);
    tombolBaru.addEventListener("click", startGame);
  }
}

// Mode Selection
window.selectMode = function (mode) {
  currentGameMode = mode;
  document.querySelectorAll(".btn-mode").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.dataset.mode === mode) btn.classList.add("active");
  });
};

// 3. Mulai Game
function startGame() {
  const btnStart = document.querySelector(".btn-start");

  // A. Lapor server & set _activeGameSlug for reconnect handler (global.js)
  if (window.socket) {
    window.socket.emit("mulaiGame", "tajwid");
  }
  window._activeGameSlug = "tajwid"; // FIX BUG-4: needed by global.js reconnect handler

  // B. Loading text
  if (btnStart) {
    btnStart.innerText = "⏳ Menyusun Huruf...";
    btnStart.disabled = true;
  }

  // C. Siapin Audio
  if (typeof AudioManager !== "undefined") AudioManager.init();

  // D. Reset Hint System
  if (typeof HintSystem !== "undefined") {
    HintSystem.reset();
  }

  // E. Minta Soal — tandai ini sebagai initial load (bukan endless refill)
  isInitialLoad = true;
  if (window.socket) {
    window.socket.emit("mintaSoalAI", {
      kategori: "tajwid",
      tingkat: selectedLevel,
    });
  }
}

// 4. PENGATURAN KONEKSI SOCKET
function wireSocketEvents() {
  // RACE CONDITION FIX: Hanya daftarkan listener sekali
  if (_socketWired) return;

  if (window.socket) {
    _socketWired = true;

    // Memastikan tidak ada duplikasi listener
    window.socket.off("soalDariAI");
    window.socket.on("soalDariAI", (response) => {
    const btnStart = document.querySelector(".btn-start");

    // Cek data valid ga
    if (!response || !response.data) {
      console.error("Tajwid game: Data server error");

      // FIX BUG-2: Reset flag agar request berikutnya bisa jalan
      isRequestingQuestions = false;

      // Hanya tampilkan alert jika ini adalah initial load (bukan endless refill)
      if (isInitialLoad) {
        alert("Gagal memuat soal. Silakan coba lagi.");
        if (btnStart) {
          btnStart.innerText = "MULAI MAIN";
          btnStart.disabled = false;
        }
        if (ui.start && ui.start.classList.contains("hidden")) {
          ui.start.classList.remove("hidden");
          ui.start.classList.add("active");
        }
      }
      return;
    }

    let incomingData = response.data;

    // --- CHECK VERSUS MODE ---
    // FIX BUG-5: Jangan re-init versus jika sudah aktif
    if (currentGameMode === "versus") {
      clearInterval(timerInterval);
      if (typeof VersusTajwid !== "undefined") {
        VersusTajwid.init(incomingData);
      } else {
        alert("Versus module not loaded!");
      }
      isInitialLoad = false;
      return;
    }

    // FIX BUG-1 & BUG-2: Jika game sudah berjalan (bukan initial load), ini adalah
    // endless refill — cukup tambahkan soal ke queue, JANGAN reset sesi.
    if (!isInitialLoad && ui.game && ui.game.classList.contains("active")) {
      // Mode endless: append soal baru ke queue yang sudah ada
      let newCards = [];
      if (incomingData.data && Array.isArray(incomingData.data)) {
        newCards = incomingData.data;
      } else if (Array.isArray(incomingData)) {
        newCards = incomingData;
      }
      queue = queue.concat(newCards);
      isRequestingQuestions = false; // FIX BUG-2: buka blokir untuk request berikutnya
      // Jika game sedang menunggu kartu, lanjutkan
      if (ui.text && ui.text.innerText.includes("⏳")) {
        nextCard();
      }
      return;
    }

    // Initial load: parse data dan mulai sesi baru
    isInitialLoad = false; // Reset flag setelah dipakai

    // Label kategori
    if (incomingData.kategori_kiri && incomingData.kategori_kanan) {
      namaKategoriKiri = incomingData.kategori_kiri;
      namaKategoriKanan = incomingData.kategori_kanan;

      if (ui.lblLeft) {
        ui.lblLeft.innerText = incomingData.kategori_kiri;
        if (ui.lblLeft.parentElement)
          ui.lblLeft.parentElement.style.border = "2px solid #00f2ff";
      }
      if (ui.lblRight) {
        ui.lblRight.innerText = incomingData.kategori_kanan;
        if (ui.lblRight.parentElement)
          ui.lblRight.parentElement.style.border = "2px solid #00f2ff";
      }

      queue = incomingData.data;
    } else if (Array.isArray(incomingData)) {
      queue = incomingData;
      if (ui.lblLeft) ui.lblLeft.innerText = "Kelompok Kiri";
      if (ui.lblRight) ui.lblRight.innerText = "Kelompok Kanan";
    } else {
      console.error("Format Data Salah:", incomingData);
      return;
    }

    if (!queue || queue.length === 0) return; // Cegah array kosong

    // Mulai sesi baru: reset score
    score = 0;
    cardCount = 0;
    if (ui.score) ui.score.innerText = "0";

    // Pindah Layar
    if (ui.start) {
      ui.start.classList.remove("active");
      ui.start.classList.add("hidden");
    }
    if (ui.game) {
      ui.game.classList.remove("hidden");
      ui.game.classList.add("active");
    }

    // Show save button & update difficulty display
    const btnSave = document.getElementById("btn-save-exit");
    if (btnSave) btnSave.classList.remove("hidden");
    const diffDisplay = document.getElementById("difficulty-display");
    if (diffDisplay) {
      const labels = { mudah: "Mudah", sedang: "Sedang", sulit: "Sulit" };
      diffDisplay.innerText = labels[selectedLevel] || selectedLevel;
    }

    nextCard();
  });

  // Listener Tutor
  window.socket.off("penjelasanTutor");
  window.socket.on("penjelasanTutor", (data) => {
    if (ui.tutorText) ui.tutorText.innerHTML = data.penjelasan || data.teks;
  });

  } else {
    setTimeout(wireSocketEvents, 100);
  }
}

// 5. Gameplay
function nextCard() {
  isAnswering = false;
  // ENDLESS MODE: Check if need more cards
  if (queue.length <= 2) {
    requestMoreCards();
  }

  // If truly out of cards, show loading
  if (queue.length === 0) {
    showLoadingMessage();
    return;
  }

  // Auto-save check
  checkAutoSave();

  currentItem = queue.shift();

  if (ui.text) ui.text.innerText = currentItem.teks || "Error";

  // Reset Animasi Kartu
  if (ui.card) {
    ui.card.style.transform = "translateX(0) rotate(0deg)";
    ui.card.style.transition = "none";
  }

  // ENDLESS MODE: Start 25-second timer
  startCardTimer();
}

// Fungsi jawab + efek visual
function answer(side) {
  // 🚀 QUICK WIN: Graceful Degradation jika koneksi putus
  if (window.isReconnecting) {
    showToast("⚠️ Tunggu koneksi pulih sebelum menjawab.");
    return;
  }
  if (isAnswering) return;
  isAnswering = true;

  // ENDLESS MODE: Stop timer when answering
  clearInterval(timerInterval);

  // Validasi
  if (!currentItem) return;
  const isCorrect = side === currentItem.hukum;

  // Kartu kedip-kedip
  const cardElement = document.getElementById("card");

  if (isCorrect) {
    // JAWABAN BENAR

    // Logic Combo
    let multiplier = 1;
    if (typeof ComboManager !== "undefined")
      multiplier = ComboManager.addStreak();

    // REBALANCED: Increased from 10 to 12 (line 192)
    score += Math.round(12 * multiplier);
    if (ui.score) ui.score.innerText = score;

    try {
      AudioManager.playCorrect();
    } catch (e) {}

    // 1. Kedip Hijau
    if (cardElement) {
      cardElement.classList.add("correct-flash"); // Pastikan CSS .correct-flash ada
      setTimeout(() => cardElement.classList.remove("correct-flash"), 500);
    }

    // 2. Animasi Overlay
    showFeedback(true);

    // 3. Particle Effects
    if (typeof ParticleManager !== "undefined") {
      ParticleManager.triggerFromCard("burst");

      // Extra combo effect untuk streak tinggi
      if (multiplier > 1) {
        ParticleManager.triggerFromCard("combo", multiplier);
      }
    }

    // 4. Geser Kartu
    animateSwipe(side);

    // 5. Lanjut
    setTimeout(nextCard, 300);
  } else {
    // JAWABAN SALAH
    if (typeof ComboManager !== "undefined") ComboManager.reset();
    try {
      AudioManager.playWrong();
    } catch (e) {}

    // FUN FACTOR: Screen shake
    document.body.classList.add("shake-active");
    setTimeout(() => document.body.classList.remove("shake-active"), 400);

    // 1. Kedip Merah
    if (cardElement) {
      cardElement.classList.add("wrong-flash");
      setTimeout(() => cardElement.classList.remove("wrong-flash"), 500);
    }

    // 2. Animasi Overlay
    showFeedback(false);

    // 3. Panggil Guru
    setTimeout(() => {
      let teksJawabanUser =
        side === "kiri" ? namaKategoriKiri : namaKategoriKanan;
      let teksJawabanBenar =
        currentItem.hukum === "kiri" ? namaKategoriKiri : namaKategoriKanan;
      panggilTutor(currentItem.teks, teksJawabanUser, teksJawabanBenar);
    }, 600);
  }
}

function animateSwipe(side) {
  const moveX = side === "kanan" ? 500 : -500;
  if (ui.card) {
    ui.card.style.transition = "transform 0.3s ease";
    ui.card.style.transform = `translateX(${moveX}px) rotate(${moveX / 10}deg)`;
  }
}

function showFeedback(isWin) {
  if (!ui.overlay) return;
  ui.overlay.className = isWin ? "correct-anim" : "wrong-anim";
  setTimeout(() => {
    ui.overlay.className = "";
  }, 500);
}

// 6. Logika AI Tutor
function panggilTutor(soal, jawabUser, jawabBenar) {
  if (tutorUsageCount >= MAX_TUTOR_USAGE) return;
  tutorUsageCount++;

  if (ui.tutorOverlay) {
    ui.tutorOverlay.style.display = "flex";
    ui.tutorOverlay.classList.remove("hidden");
  }
  if (ui.tutorText)
    ui.tutorText.innerHTML = `
  <div class="tutor-loading-box">
    <div class="loader-spinner"></div>
    <span class="loading-text">MENGANALISIS HUKUM BACAAN...</span>
  </div>
`;

  if (window.socket) {
    window.socket.emit("mintaPenjelasan", {
      game: "tajwid",
      soal: soal,
      jawabanUser: jawabUser,
      jawabanBenar: jawabBenar,
    });
  }
}

// (Listener tutor AI dipindahkan ke wireSocketEvents)

window.tutupTutor = function () {
  if (ui.tutorOverlay) {
    ui.tutorOverlay.style.display = "none";
    ui.tutorOverlay.classList.add("hidden");
  }
  nextCard(); // Lanjut main setelah tutup tutor
};

// 7. Selesai & Simpan
// FIX BUG-3: Terima parameter opsional untuk label layar hasil
function endGame(reason = "timeout") {
  clearInterval(timerInterval); // Pastikan timer berhenti

  if (ui.game) {
    ui.game.classList.remove("active");
    ui.game.classList.add("hidden");
  }
  if (ui.result) {
    ui.result.classList.remove("hidden");
    ui.result.classList.add("active");
  }
  if (ui.finalScore) ui.finalScore.innerText = score;

  // FIX BUG-3: Judul layar hasil dinamis sesuai kondisi
  const resultTitle = ui.result ? ui.result.querySelector(".result-title") : null;
  if (resultTitle) {
    if (reason === "saved") {
      resultTitle.innerText = "SKOR TERSIMPAN! 💾";
    } else {
      resultTitle.innerText = "WAKTU HABIS! ⏱️";
    }
  }

  // Hide save button
  const btnSave = document.getElementById("btn-save-exit");
  if (btnSave) btnSave.classList.add("hidden");

  try {
    AudioManager.playWin();
  } catch (e) {}

  if (window.socket) {
    window.socket.emit("simpanSkor", {
      nama: playerName,
      skor: score,
      game: "tajwid",
    });
  }
}

// Input Keyboard
document.addEventListener("keydown", (e) => {
  if (ui.game && ui.game.classList.contains("active")) {
    if (e.key === "ArrowLeft") answer("kiri");
    if (e.key === "ArrowRight") answer("kanan");
  }
});

// ==========================================
// Buat tombol HTML
// ==========================================
// Agar onclick="handleInput('kiri')" di HTML bisa jalan
window.handleInput = function (side) {
  answer(side);
};

// ==========================================
// Fitur Swipe di HP
// ==========================================
const cardElement = document.getElementById("card");
let startX = 0;
let isDragging = false;

if (cardElement) {
  // 1. Pas disentuh
  cardElement.addEventListener(
    "touchstart",
    (e) => {
      startX = e.touches[0].clientX;
      isDragging = true;
      cardElement.style.transition = "none";
    },
    { passive: true },
  );

  // 2. Pas digeser
  cardElement.addEventListener(
    "touchmove",
    (e) => {
      if (!isDragging) return;
      const currentX = e.touches[0].clientX;
      const diffX = currentX - startX;
      const rotate = diffX / 20; // Efek miring sedikit

      // Geser kartu mengikuti jari
      cardElement.style.transform = `translateX(${diffX}px) rotate(${rotate}deg)`;
    },
    { passive: true },
  );

  // 3. Pas dilepas
  cardElement.addEventListener("touchend", (e) => {
    if (!isDragging) return;
    isDragging = false;

    // INPUT LOCK FIX: Jika sedang menjawab (misal dari timeout), abaikan swipe
    if (isAnswering) {
      cardElement.style.transform = "translateX(0) rotate(0deg)";
      return;
    }

    const endX = e.changedTouches[0].clientX;
    const diffX = endX - startX;
    const threshold = 100;

    cardElement.style.transition = "transform 0.3s ease";

    if (diffX > threshold) {
      answer("kanan");
    } else if (diffX < -threshold) {
      answer("kiri");
    } else {
      cardElement.style.transform = "translateX(0) rotate(0deg)";
    }
  });

  // Mouse Events for PC Testing
  cardElement.addEventListener("mousedown", (e) => {
    startX = e.clientX;
    isDragging = true;
    cardElement.style.transition = "none";
  });

  const handleMouseUp = (e) => {
    if (!isDragging) return;
    isDragging = false;

    if (isAnswering) {
      cardElement.style.transform = "translateX(0) rotate(0deg)";
      return;
    }

    const endX = e.clientX;
    const diffX = endX - startX;
    const threshold = 100;

    cardElement.style.transition = "transform 0.3s ease";

    if (diffX > threshold) {
      answer("kanan");
    } else if (diffX < -threshold) {
      answer("kiri");
    } else {
      cardElement.style.transform = "translateX(0) rotate(0deg)";
    }
  };

  cardElement.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const currentX = e.clientX;
    const diffX = currentX - startX;
    const rotate = diffX / 20;
    cardElement.style.transform = `translateX(${diffX}px) rotate(${rotate}deg)`;
  });

  cardElement.addEventListener("mouseup", handleMouseUp);
  cardElement.addEventListener("mouseleave", handleMouseUp);
}

// ==========================================
// ENDLESS MODE FUNCTIONS
// ==========================================

// Timer functions
function startCardTimer() {
  clearInterval(timerInterval);
  timeLeft = 25; // 25 seconds for Tajwid
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
  if (isAnswering) return;
  if (!currentItem) return; // No card to skip
  isAnswering = true;

  try {
    AudioManager.playWrong();
  } catch (e) {}

  // Show which side was correct with quick flash
  const cardElement = document.getElementById("card");
  if (cardElement) {
    if (currentItem.hukum === "kiri") {
      cardElement.style.background = "rgba(231, 76, 60, 0.3)"; // Red flash
    } else {
      cardElement.style.background = "rgba(231, 76, 60, 0.3)";
    }

    setTimeout(() => {
      cardElement.style.background = "";
      nextCard();
    }, 1000);
  } else {
    nextCard();
  }
}

// Auto-request more cards
function requestMoreCards() {
  // Rate limiting
  const now = Date.now();
  if (isRequestingQuestions || now - lastRequestTime < REQUEST_COOLDOWN) {
    return;
  }

  isRequestingQuestions = true;
  lastRequestTime = now;
  isInitialLoad = false; // Pastikan flag menunjukkan ini adalah refill, bukan initial load

  if (window.socket) {
    window.socket.emit("mintaSoalAI", {
      kategori: "tajwid",
      tingkat: selectedLevel,
      mode: "endless",
    });
  }
}

function showLoadingMessage() {
  if (ui.text) {
    ui.text.innerText = "⏳ Memuat kartu berikutnya...";
  }
  // Retry after delay
  setTimeout(() => {
    if (queue.length > 0) {
      nextCard();
    } else {
      requestMoreCards();
    }
  }, 2000);
}

// Auto-save system
let cardCount = 0; // Track total cards answered
function checkAutoSave() {
  cardCount++;
  if (cardCount > 0 && cardCount % 5 === 0) {
    autoSaveProgress();
  }
}

function autoSaveProgress() {
  if (window.socket) {
    window.socket.emit("simpanProgress", {
      nama: playerName,
      game: "tajwid",
      skor: score,
      soalDijawab: cardCount,
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
    `📝 Kartu terjawab: ${cardCount}`;

  if (!confirm(confirmMsg)) return;

  // Stop timer
  clearInterval(timerInterval);

  // Save score (endGame() juga emit simpanSkor, tapi dengan mode endless kita kirm data lengkap)
  if (window.socket) {
    window.socket.emit("simpanSkor", {
      nama: playerName,
      skor: score,
      game: "tajwid",
      soalDijawab: cardCount,
      mode: "endless",
    });
  }

  // FIX BUG-3: Teruskan reason "saved" agar judul layar benar
  endGame("saved");
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
  if (score > 0 && cardCount > 0) {
    // Quick sync save attempt
    if (navigator.sendBeacon && window.socket) {
      const data = JSON.stringify({
        nama: playerName,
        game: "tajwid",
        skor: score,
        soalDijawab: cardCount,
      });
      navigator.sendBeacon("/api/quick-save", data);
    }
  }
});

// --- RESTART TANPA RELOAD ---
window.restartGame = function () {
  // BUG-V1 FIX: Cek apakah layar hasil versus sedang tampil
  // (state bisa isActive=false saat di layar hasil, tapi versus-result belum hidden)
  if (typeof VersusTajwid !== "undefined" && VersusTajwid.isActive()) {
    VersusTajwid.restart();
    return;
  }

  // Jika mode versus tapi belum masuk game (mis. batalkan Swal), kembali ke solo start
  if (currentGameMode === "versus") {
    currentGameMode = "solo";
    document.querySelectorAll(".btn-mode").forEach((btn) => {
      btn.classList.remove("active");
      if (btn.dataset.mode === "solo") btn.classList.add("active");
    });
  }

  // 1. Stop semua timer
  clearInterval(timerInterval);

  // 2. Reset semua state
  queue = [];
  currentItem = null;
  score = 0;
  isAnswering = false;
  tutorUsageCount = 0;
  timeLeft = 25;
  isRequestingQuestions = false;
  isInitialLoad = false; // Reset flag
  lastRequestTime = 0;
  cardCount = 0;

  // 3. Reset UI display
  if (ui.score) ui.score.innerText = "0";
  const timerEl = document.getElementById("timer");
  if (timerEl) timerEl.innerText = "25";
  if (ui.overlay) {
    ui.overlay.className = "";
    ui.overlay.style.background = "";
  }
  if (ui.tutorOverlay) ui.tutorOverlay.style.display = "none";

  // 4. Kembalikan ke start-screen menggunakan class panel
  if (ui.result) {
    ui.result.classList.remove("active");
    ui.result.classList.add("hidden");
  }
  if (ui.game) {
    ui.game.classList.remove("active");
    // game-screen pakai display:none via CSS
  }
  if (ui.start) {
    ui.start.classList.remove("hidden");
    ui.start.classList.add("active");
  }

  // 5. Reset card ke keadaan awal
  if (ui.card) {
    ui.card.style.transform = "";
    ui.card.style.transition = "";
    ui.card.style.opacity = "";
    ui.card.className = "flashcard";
  }
  if (ui.text) ui.text.innerText = "...";

  // 6. Reset tombol start — JANGAN panggil initStartButton() lagi!
  // initStartButton() menggunakan cloneNode() yang akan menambah event listener GANDA
  // cukup reset properti tombol yang sudah ada
  const btnStart = document.querySelector(".btn-start");
  if (btnStart) {
    btnStart.innerText = "MULAI MAIN";
    btnStart.disabled = false;
  }

  // 7. Sembunyikan btn-save-exit
  const btnSave = document.getElementById("btn-save-exit");
  if (btnSave) btnSave.classList.add("hidden");

  // 8. Reset hint system jika ada
  if (typeof HintSystem !== "undefined") HintSystem.reset();
  const hintCount = document.getElementById("hint-count");
  if (hintCount) hintCount.innerText = "2/2";

};


// Pastikan HTML siap baru jalankan listener
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireSocketEvents);
} else {
  wireSocketEvents();
}
