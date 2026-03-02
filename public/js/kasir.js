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
let playerName = localStorage.getItem("playerName") || "Guest";

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
    console.log("⏱️ Start Kasir");
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
  socket.emit("mintaSoalAI", { kategori: "kasir", tingkat: currentLevel });

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
  socket.emit("mintaSoalAI", { kategori: "kasir", tingkat: currentLevel });
}

socket.on("soalDariAI", (response) => {
  if (response.kategori === "kasir") {
    // 🔧 FIX: Better error handling
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

    // 🔥 TAMBAHAN PENTING:
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

function formatRupiah(angka) {
  return "Rp " + angka.toLocaleString("id-ID");
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

  timerInterval = setInterval(() => {
    timeLeft--;
    ui.timer.innerText = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      checkAnswer(true); // Waktu Habis
    }
  }, 1000);
}

function handleEnter(e) {
  if (e.key === "Enter") checkAnswer();
}

// Flag Anti-Spam
let isProcessing = false;

function checkAnswer(isTimeOut = false) {
  // Cegah eksekusi ganda jika sedang memproses jawaban sebelumnya
  if (isProcessing) return;

  clearInterval(timerInterval);
  isProcessing = true;

  // 1. Ambil nilai mentah dari input box
  let rawValue = ui.inputAnswer.value;
  let userAnswer = Math.abs(Math.floor(parseFloat(rawValue))) || 0;

  const q = questions[currentIndex];

  const correctAnswer =
    q.kembalian !== undefined ? q.kembalian : q.uang_bayar - q.total_belanja;

  // --- LOGIKA PENILAIAN ---
  if (!isTimeOut && userAnswer === correctAnswer) {
    // JIKA BENAR
    ui.feedback.innerText = "LUNAS! TRANSAKSI BERHASIL.";
    ui.feedback.classList.remove("wrong");
    ui.feedback.classList.add("correct");
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
    ui.feedback.classList.remove("correct");
    ui.feedback.classList.add("wrong");
    ui.screenText.innerText = "GAGAL";

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
    socket.emit("simpanSkor", {
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
