import { UI } from "../utils/ui.js";

export class GameEngine {
  constructor(gameSlug) {
    this.gameSlug = gameSlug;
    this.score = 0;
    this.gameActive = false;
    this.playerName = localStorage.getItem("playerName") || "Guest";
    this.socket = window.socket; // Assuming global socket from socket-client init
  }

  startGame() {
    this.score = 0;
    this.gameActive = true;
    UI.updateText("score", this.score);

    // Show loading for game initialization
    if (typeof LoadingUI !== "undefined") {
      LoadingUI.show("Starting game...");
      setTimeout(() => LoadingUI.hide(), 500);
    }
  }

  addScore(points) {
    if (!this.gameActive) return;

    const oldScore = this.score;
    this.score += points;

    // Animated counter instead of instant update
    if (typeof AnimationUtils !== "undefined") {
      const scoreEl = document.getElementById("score");
      if (scoreEl) {
        AnimationUtils.animateCounter(scoreEl, oldScore, this.score, 500);
        AnimationUtils.addTempClass(scoreEl, "score-pop", 300);

        // Show +points increment
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
    // Basic wrapper, expects global AudioManager or we can import it
    if (window.AudioManager) {
      if (type === "correct") window.AudioManager.playCorrect();
      else if (type === "wrong") window.AudioManager.playWrong();
      else if (type === "win") window.AudioManager.playWin();
    }
  }

  endGame() {
    this.gameActive = false;
    this.playSound("win");

    // Show confetti!
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
      console.log(`💾 Saving Score: ${this.score} for ${this.gameSlug}`);
      this.socket.emit("simpanSkor", {
        nama: this.playerName,
        skor: this.score,
        game: this.gameSlug,
      });

      // TUNGGU konfirmasi dari server baru refresh
      this.socket.once("skorTersimpan", (data) => {
        // Check achievements
        if (typeof Achievements !== "undefined") {
          Achievements.checkGameAchievements(this.gameSlug, this.score);
          if (data.totalScore) {
            Achievements.checkTotalScoreAchievements(data.totalScore);
          }
        }

        // Add XP
        if (typeof PlayerLevel !== "undefined") {
          const xp = PlayerLevel.getXPFromScore(this.gameSlug, this.score);
          const result = PlayerLevel.addXP(xp);
          PlayerLevel.updateXPDisplay();

          if (!result.leveledUp) {
            // Show XP gained toast if no level up
            if (typeof AnimationUtils !== "undefined") {
              AnimationUtils.showTooltip(
                document.body,
                `+${xp} XP earned!`,
                2000,
              );
            }
          }
        }

        this.socket.emit("mintaDataProfil", this.playerName);
      });

      // Fallback jika server tidak merespon (timeout manual)
      let timeoutId = setTimeout(() => {
        this.socket.emit("mintaDataProfil", this.playerName);
      }, 2000);

      // Clear timeout if response received
      this.socket.once("skorTersimpan", () => clearTimeout(timeoutId));
    }
  }
}
