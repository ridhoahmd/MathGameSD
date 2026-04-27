const ui = {
  screenText: document.getElementById("screen-text"),
  storyText: document.getElementById("story-text"),
  displayTotal: document.getElementById("display-total"),
  displayPay: document.getElementById("display-pay"),
  inputAnswer: document.getElementById("input-answer"),
  feedback: document.getElementById("feedback-msg"),
  score: document.getElementById("score"),
  timer: document.getElementById("timer"),
  finalScore: document.getElementById("final-score"),
  startScreen: document.getElementById("start-screen"),
  gameScreen: document.getElementById("game-screen"),
  resultScreen: document.getElementById("result-screen"),
};

let currentLevel = "mudah";
let questions = []; // Sekarang Array, bukan single object
let currentIndex = 0;
let score = 0;
let timeLeft = 0;
let timerInterval;
let isProcessing = false; // FIX: Deklarasi di sini agar tidak ReferenceError di tampilkanSoal()
let playerName = localStorage.getItem("playerName") || "Guest";

// SOCKET RACE CONDITION FIX: guard agar listener tidak didaftarkan dua kali
let _socketWired = false;

// Setup Tombol Level - 🔧 FIX: Standardized to .btn-difficulty
document.querySelectorAll(".btn-diff").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".btn-diff")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentLevel = btn.dataset.level;
  });
});

function startGame() {
  if (window.socket) {
    window.socket.emit("mulaiGame", "kasir");
  }
  const btn = document.querySelector(".btn-start"); // Pastikan class di HTML benar

  // 1. Tampilan Loading
  btn.innerText = "⏳ Menyiapkan Toko...";
  btn.disabled = true;

  // 2. Pancing Audio
  if (typeof AudioManager !== "undefined") AudioManager.init();

  // 3. Reset Skor Internal
  score = 0;
  ui.score.innerText = "0";

  // 4. Request Server
  // Panggil fungsi request yang sudah ada, tapi kita modifikasi sedikit flow-nya
  if (window.socket) {
    window.socket.emit("mintaSoalAI", { kategori: "kasir", tingkat: currentLevel });
  }

  // 5. Safety Net
  setTimeout(() => {
    if (ui.startScreen.classList.contains("active")) {
      btn.innerText = "⚠️ Gagal Buka Toko. Ulangi?";
      btn.disabled = false;
    }
  }, 10000);
}

function mintaSoalKeServer() {
  ui.screenText.innerText = "RESTOCKING...";
  ui.storyText.innerText = "Mengambil data transaksi...";
  if (window.socket) {
    window.socket.emit("mintaSoalAI", { kategori: "kasir", tingkat: currentLevel });
  }
}

// 5. PENGATURAN KONEKSI SOCKET
function wireSocketEvents() {
  // RACE CONDITION FIX: Hanya daftarkan listener sekali
  if (_socketWired) return;

  if (window.socket) {
    _socketWired = true;

    // Memastikan tidak ada duplikasi listener
    window.socket.off("soalDariAI");
    window.socket.on("soalDariAI", (response) => {
      if (response.kategori === "kasir") {
        // Error handling jika tidak ada data
        if (!response.data) {
          console.error("Kasir game: No data received from server");
          alert("Gagal memuat soal. Silakan coba lagi.");
          const btn = document.querySelector(".btn-start");
          if (btn) {
            btn.innerText = "BUKA KASIR";
            btn.disabled = false;
          }
          ui.startScreen.classList.remove("hidden");
          ui.startScreen.classList.add("active");
          return;
        }

        // Jika server mengirim array, pakai langsung. Jika object, bungkus jadi array.
        const data = response.data;
        if (Array.isArray(data)) {
          questions = data;
        } else {
          questions = [data];
        }

        currentIndex = 0;

        ui.startScreen.classList.remove("active");
        ui.startScreen.classList.add("hidden");

        ui.gameScreen.classList.remove("hidden");
        ui.gameScreen.classList.add("active");

        // Kembalikan tombol start ke kondisi semula
        const btn = document.querySelector(".btn-start");
        if (btn) {
          btn.innerText = "BUKA KASIR";
          btn.disabled = false;
        }

        tampilkanSoal();
      }
    });
  } else {
    setTimeout(wireSocketEvents, 100);
  }
}


function formatRupiah(angka) {
  return "Rp " + angka.toLocaleString("id-ID");
}

function formatRupiahInput(input) {
  let value = input.value.replace(/[^0-9]/g, "");
  if (value) {
    value = parseInt(value, 10).toLocaleString("id-ID");
  }
  input.value = value;
}

function tampilkanSoal() {
  // 🔧 FIX: Add exit option for endless mode
  // Cek apakah soal habis?
  if (currentIndex >= questions.length) {
    // Tampilkan opsi: lanjut atau selesai
    ui.storyText.innerText = "Transaksi selesai! Mau lanjut atau selesai?";
    ui.screenText.innerText = "PILIHAN";
    ui.displayTotal.innerText = "";
    ui.displayPay.innerText = "";
    ui.inputAnswer.style.display = "none";

    // Clear previous feedback
    ui.feedback.innerText = "";
    ui.feedback.className = "feedback";

    ui.feedback.innerHTML = `
      <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
          <button onclick="lanjutKasir()" class="btn-primary" style="padding: 10px 20px;">LANJUT TRANSAKSI</button>
          <button onclick="endGame()" class="btn-danger" style="background: #ff4757; color: white; padding: 10px 20px; border:none; border-radius:8px;">SELESAI</button>
      </div>
    `;
    return;
  }

  const q = questions[currentIndex];

  ui.storyText.innerText = q.cerita;
  ui.displayTotal.innerText = formatRupiah(q.total_belanja);
  ui.displayPay.innerText = formatRupiah(q.uang_bayar);
  ui.screenText.innerText = "INPUT KEMBALIAN";

  ui.inputAnswer.value = "";
  setTimeout(() => ui.inputAnswer.focus(), 100); // 🚀 Quick Win UX
  ui.feedback.innerText = "";
  ui.feedback.className = "feedback";

  isProcessing = false; // Reset flag proses
  startTimer(30); // 30 Detik per transaksi
}

function startTimer(seconds) {
  clearInterval(timerInterval);
  timeLeft = seconds;
  ui.timer.innerText = timeLeft;
  // ISU-4-B: Reset visual urgency saat timer baru dimulai
  ui.timer.style.color = "";
  ui.timer.style.animation = "";
  ui.timer.classList.remove("timer-danger");

  timerInterval = setInterval(() => {
    timeLeft--;
    ui.timer.innerText = timeLeft;

    // ISU-4-B FIX: Efek urgensi visual saat waktu hampir habis
    if (timeLeft <= 10) {
      ui.timer.classList.add("timer-danger");
    } else if (timeLeft <= 20) {
      ui.timer.style.color = "#e17055"; // Oranye awal sebagai peringatan dini
      ui.timer.classList.remove("timer-danger");
    }

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      checkAnswer(true); // Waktu Habis
    }
  }, 1000);
}

function handleEnter(e) {
  if (e.key === "Enter") checkAnswer();
}

// (isProcessing sudah dideklarasikan di atas bersama variabel global)

function checkAnswer(isTimeOut = false) {
  // Cegah eksekusi ganda jika sedang memproses jawaban sebelumnya
  if (isProcessing) return;

  clearInterval(timerInterval);
  isProcessing = true;

  // 1. Ambil nilai mentah dari input box, hapus titik pemisah ribuan
  let rawValue = ui.inputAnswer.value.replace(/\./g, "").replace(/[^0-9]/g, "");
  let userAnswer = Math.abs(Math.floor(parseFloat(rawValue))) || 0;

  const q = questions[currentIndex];

  const correctAnswer =
    q.kembalian !== undefined ? q.kembalian : q.uang_bayar - q.total_belanja;

  // --- LOGIKA PENILAIAN ---
  if (!isTimeOut && userAnswer === correctAnswer) {
    // JIKA BENAR
    ui.feedback.innerText = "LUNAS! TRANSAKSI BERHASIL.";
    ui.feedback.classList.remove("wrong");
    ui.feedback.classList.add("correct", "success-pulse", "bounce-on-hover");
    ui.screenText.innerText = "SUKSES";

    try {
      AudioManager.playCorrect();
    } catch (e) {}

    // Poin: 100 dasar + Bonus kecepatan
    let point = 100 + Math.floor(timeLeft * 5);
    score += point;
    ui.score.innerText = score;

    // Lanjut Soal Berikutnya setelah jeda 1.5 detik
    setTimeout(() => {
      currentIndex++;
      tampilkanSoal();
    }, 1500);
  } else {
    // JIKA SALAH / WAKTU HABIS
    // Tampilkan jawaban yang seharusnya
    ui.feedback.innerText = `SALAH! Harusnya: ${formatRupiah(correctAnswer)}`;
    ui.feedback.classList.remove("correct", "success-pulse", "bounce-on-hover");
    ui.feedback.classList.add("wrong", "shake");
    ui.screenText.innerText = "GAGAL";
    ui.inputAnswer.classList.add("shake");
    setTimeout(() => ui.inputAnswer.classList.remove("shake"), 500);

    try {
      AudioManager.playWrong();
    } catch (e) {}

    // Game Over setelah 2.5 detik
    setTimeout(endGame, 2500);
  }
}

function endGame() {
  // 🔧 FIX: Clear timer to prevent memory leak
  clearInterval(timerInterval);

  // 🔧 FIX: Reset processing flag so user can play again
  isProcessing = false;

  // PATCH: Menggunakan variabel 'ui' yang benar, bukan 'screens'
  if (ui.gameScreen) {
    ui.gameScreen.classList.remove("active");
    ui.gameScreen.classList.add("hidden");
  }

  if (ui.resultScreen) {
    ui.resultScreen.classList.remove("hidden");
    ui.resultScreen.classList.add("active");
  }

  if (ui.finalScore)
    ui.finalScore.innerText = "Rp " + score.toLocaleString("id-ID");

  try {
    AudioManager.playWin();
  } catch (e) {}

  if (window.socket) {
    window.socket.emit("simpanSkor", {
      nama: playerName,
      skor: score,
      game: "kasir",
    });
  }
}

// 🔧 FIX: Function untuk lanjut endless mode
window.lanjutKasir = function () {
  ui.inputAnswer.style.display = "block";
  mintaSoalKeServer();
};

// --- RESTART TANPA RELOAD ---
window.restartGame = function () {
  // 1. Stop semua timer
  clearInterval(timerInterval);
  isProcessing = false;

  // 2. Reset semua state
  questions = [];
  currentIndex = 0;
  score = 0;
  timeLeft = 0;

  // 3. Reset UI — hati-hati: jangan overwrite className penuh, bisa hapus class penting
  if (ui.score) ui.score.innerText = "0";
  if (ui.timer) ui.timer.innerText = "00";
  if (ui.screenText) ui.screenText.innerText = "KASIR READY...";
  if (ui.feedback) {
    ui.feedback.innerText = "";
    // Hapus HANYA class state, bukan seluruh className
    ui.feedback.classList.remove("correct", "wrong");
  }
  if (ui.inputAnswer) {
    ui.inputAnswer.value = "";
    ui.inputAnswer.style.display = ""; // Tampilkan kembali jika sempat disembunyikan
  }

  // 4. Kembalikan ke start-screen menggunakan class panel
  if (ui.resultScreen) {
    ui.resultScreen.classList.remove("active");
    ui.resultScreen.classList.add("hidden");
  }
  if (ui.gameScreen) {
    ui.gameScreen.classList.remove("active");
    ui.gameScreen.classList.add("hidden");
  }
  if (ui.startScreen) {
    ui.startScreen.classList.remove("hidden");
    ui.startScreen.classList.add("active");
  }

  // 5. Reset tombol start
  const btnStart = document.querySelector(".btn-start");
  if (btnStart) {
    btnStart.innerText = "BUKA KASIR";
    btnStart.disabled = false;
  }

};

// Pastikan HTML siap baru jalankan listener
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireSocketEvents);
} else {
  wireSocketEvents();
}
