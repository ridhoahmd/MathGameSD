import { GameEngine } from "./classes/GameEngine.js";
import { UI } from "./utils/ui.js";

// Kalo ini khusus logika Matematika
class MathGame extends GameEngine {
  constructor() {
    super("math");
    this.questionList = [];
    this.currentIdx = 0;
    this.currentProblem = null;
    this.selectedDifficulty = "sedang";
  }

  init() {
    this.bindEvents();
  }

  bindEvents() {
    document.querySelectorAll(".btn-difficulty").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".btn-difficulty")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.selectedDifficulty = btn.dataset.level;
      });
    });

    const startBtn = document.querySelector(".btn-start");
    if (startBtn) {
      startBtn.addEventListener("click", () => this.requestGame());
    }

    const input = document.getElementById("answer-input");
    if (input) {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && this.gameActive) this.checkAnswer();
      });
    }
  }

  requestGame() {
    if (!this.socket) {
      alert("Socket belum terhubung!");
      return;
    }

    const startBtn = document.querySelector(".btn-start");
    if (startBtn) {
      startBtn.innerText = "⏳ Meminta Soal...";
      startBtn.disabled = true;
    }

    this.socket.emit("mulaiGame", "math");
    this.socket.emit("mintaSoalAI", {
      kategori: "math",
      tingkat: this.selectedDifficulty,
    });
  }

  // Dipanggil pas data socket masuk
  onDataReceived(data) {
    let rawData = data.data || data;
    if (Array.isArray(rawData)) this.questionList = rawData;
    else if (rawData.data) this.questionList = rawData.data;

    if (!this.questionList.length) {
      alert("Gagal memuat soal.");
      return;
    }

    // Umpetin login, tampilin game
    UI.showScreen("game-screen");
    this.startGame();
    this.currentIdx = 0;
    UI.updateText("q-total", this.questionList.length);
    this.showQuestion();
  }

  showQuestion() {
    if (this.currentIdx >= this.questionList.length) {
      this.endGame();
      return;
    }

    this.currentProblem = this.questionList[this.currentIdx];
    UI.updateText("q-current", this.currentIdx + 1);
    UI.updateProgressBar(
      "progress-bar",
      this.currentIdx,
      this.questionList.length,
    );

    let teks =
      this.currentProblem.soal || this.currentProblem.question || "Error";
    if (typeof this.currentProblem === "string") teks = this.currentProblem;

    UI.updateText("question-display", teks);

    const input = document.getElementById("answer-input");
    input.value = "";
    input.focus();
  }

  checkAnswer() {
    const input = document.getElementById("answer-input");
    const val = input.value.trim();
    const correct = String(
      this.currentProblem.jawaban || this.currentProblem.answer,
    );

    if (val.toLowerCase() === correct.toLowerCase()) {
      // Logika Combo biar seru
      let multiplier = 1;
      if (typeof ComboManager !== "undefined")
        multiplier = ComboManager.addStreak();

      this.addScore(Math.round(10 * multiplier));
      document.body.classList.add("correct-anim");
      setTimeout(() => document.body.classList.remove("correct-anim"), 500);
    } else {
      if (typeof ComboManager !== "undefined") ComboManager.reset();
      this.playSound("wrong");
      document.body.classList.add("wrong-anim");
      setTimeout(() => document.body.classList.remove("wrong-anim"), 500);

      // Kasih tau jawaban bener di placeholder
      input.value = "";
      input.placeholder = `Jawab: ${correct}`;
      setTimeout(() => (input.placeholder = "Ketik jawaban..."), 1500);
    }

    this.currentIdx++;
    setTimeout(() => this.showQuestion(), 300);
  }
}

// Bikin game nya
const game = new MathGame();
game.init();

// Sambungin socket (tunggu ready dulu)
function wireSocketEvents() {
  if (window.socket) {
    window.socket.on("soalDariAI", (data) => {
      if (data.kategori === "math") {
        game.onDataReceived(data);
      }
    });
    console.log("✅ Math game socket listener registered");
  } else {
    // Coba lagi bentar lagi
    console.log("⏳ Nunggu socket...");
    setTimeout(wireSocketEvents, 100);
  }
}

// Pastiin HTML udah siap
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireSocketEvents);
} else {
  wireSocketEvents();
}
