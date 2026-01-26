export const UI = {
    showScreen(screenId) {
        document.querySelectorAll(".screen").forEach(el => el.classList.add("hidden"));
        const target = document.getElementById(screenId);
        if (target) target.classList.remove("hidden");
    },

    updateText(elementId, text) {
        const el = document.getElementById(elementId);
        if (el) el.innerText = text;
    },

    updateProgressBar(elementId, current, total) {
        const el = document.getElementById(elementId);
        if (el) {
            const percentage = (current / total) * 100;
            el.style.width = `${percentage}%`;
        }
    },

    showGameOver(score, isWin = true) {
        const goScreen = document.getElementById("game-over-screen");
        const scoreEl = document.getElementById("final-score");

        if (goScreen) {
            goScreen.classList.add("active"); // Gunakan class active untuk display flex
            UI.animateEntrance(goScreen.querySelector(".go-content"));
        }

        if (scoreEl) scoreEl.innerText = score;
    },

    animateEntrance(element) {
        if (element) {
            element.style.opacity = 0;
            element.style.transform = "scale(0.5)";
            setTimeout(() => {
                element.style.opacity = 1;
                element.style.transform = "scale(1)";
            }, 50);
        }
    }
};
