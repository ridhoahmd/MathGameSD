import { UI } from "../utils/ui.js";

export class GameEngine {
  constructor(gameSlug) {
    this.gameSlug = gameSlug;
    this.score = 0;
    this.gameActive = false;
    this.playerName = localStorage.getItem("playerName") || "Guest";
    // ISU-7-B FIX: Jangan tangkap socket di constructor — bisa null!
    // Gunakan getter agar selalu merujuk window.socket terbaru
  }

  get socket() {
    return window.socket || null;
  }

  startGame() {
    this.score = 0;
    this.gameActive = true;
    UI.updateText("score", this.score);

    // Simpan slug game aktif untuk keperluan reconnect (dipakai global.js)
    window._activeGameSlug = this.gameSlug;

    // Show loading for game initialization
    if (typeof LoadingUI !== "undefined") {
      LoadingUI.show("Mulai game...");
      setTimeout(() => LoadingUI.hide(), 500);
    }
  }

  addScore(points) {
    if (!this.gameActive) return;

    const oldScore = this.score;
    this.score += points;

    // Animasi skor
    if (typeof AnimationUtils !== "undefined") {
      const scoreEl = document.getElementById("score");
      if (scoreEl) {
        AnimationUtils.animateCounter(scoreEl, oldScore, this.score, 500);
        AnimationUtils.addTempClass(scoreEl, "score-pop", 300);

        // Tampil poin nambah
        const container = scoreEl.parentElement;
        if (container) {
          AnimationUtils.showScoreIncrement(container, points, {
            x: scoreEl.offsetLeft + scoreEl.offsetWidth / 2,
            y: scoreEl.offsetTop,
          });
        }
      }
    } else {
      UI.updateText("score", this.score);
    }

    this.playSound("correct");
  }

  playSound(type) {
    // Wrapper audio
    if (window.AudioManager) {
      if (type === "correct") window.AudioManager.playCorrect();
      else if (type === "wrong") window.AudioManager.playWrong();
      else if (type === "win") window.AudioManager.playWin();
    }
  }

  endGame() {
    this.gameActive = false;
    this.playSound("win");

    // Efek Konfeti
    if (typeof confetti !== "undefined") {
      if (this.score > 500) {
        confetti.victory(); // Epic celebration
      } else if (this.score > 100) {
        confetti.burst({ particleCount: 100, spread: 70 });
      } else {
        confetti.burst({ particleCount: 50, spread: 50 });
      }
    }

    UI.showGameOver(this.score);
    this.saveScore();
  }

  saveScore() {
    if (this.socket) {
      // Saving score to server
      this.socket.emit("simpanSkor", {
        nama: this.playerName,
        skor: this.score,
        game: this.gameSlug,
      });

      // Timeout fallback: refresh profil jika server tidak merespons
      let timeoutId = setTimeout(() => {
        this.socket.emit("mintaDataProfil", this.playerName);
      }, 2000);

      // Tunggu respon server
      this.socket.once("skorTersimpan", (data) => {
        // Clear timeout since we got response
        clearTimeout(timeoutId);

        // Check achievements
        if (typeof Achievements !== "undefined") {
          Achievements.checkGameAchievements(this.gameSlug, this.score);
          if (data.totalScore) {
            Achievements.checkTotalScoreAchievements(data.totalScore);
          }
        }

        // XP is now handled by server via skorTersimpan event
        // leveling.js listens to this event and auto-updates display
        // Just update XP display to be sure
        if (typeof PlayerLevel !== "undefined") {
          PlayerLevel.updateXPDisplay();
        }

        this.socket.emit("mintaDataProfil", this.playerName);
      });
    }
  }
}
