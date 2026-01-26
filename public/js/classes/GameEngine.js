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
        // UI.showScreen("game-screen"); (Opsional, tergantung implementasi HTML)
    }

    addScore(points) {
        if (!this.gameActive) return;
        this.score += points;
        UI.updateText("score", this.score);
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
            // Refresh profile data to get updated coins
            this.socket.emit("mintaDataProfil", this.playerName);
        }
    }
}
