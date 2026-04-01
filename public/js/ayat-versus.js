/**
 * Logic Mode Versus (1v1 Split Screen) - Sambung Ayat
 * Isolated from ayat.js to ensure zero-risk to solo mode.
 */

const VersusAyat = (() => {
  // --- State ---
  let state = {
    isActive: false,
    questions: [],
    currentIndex: 0,
    p1: { score: 0, ready: false },
    p2: { score: 0, ready: false },
    isRotated: false,
  };

  const ui = {
    container: null,
    resultScreen: null,
    p1: { score: null, question: null, options: null },
    p2: { score: null, question: null, options: null },
  };

  function initUI() {
    ui.container = document.getElementById("versus-mode-container");
    ui.resultScreen = document.getElementById("versus-result");
    ui.p1.score = document.getElementById("v-score-p1");
    ui.p1.question = document.getElementById("v-q-p1");
    ui.p1.options = document.getElementById("v-opts-p1");
    ui.p2.score = document.getElementById("v-score-p2");
    ui.p2.question = document.getElementById("v-q-p2");
    ui.p2.options = document.getElementById("v-opts-p2");
  }

  // --- Public Methods ---

  function init(allQuestions) {
    if (!ui.container) initUI();

    const startScreen = document.getElementById("start-screen");
    if (startScreen) {
      startScreen.classList.remove("active");
      startScreen.classList.add("hidden");
    }

    Swal.fire({
      title: "Masukkan Nama Lawan",
      input: "text",
      inputPlaceholder: "Nama Player 2 (Temanmu)",
      showCancelButton: true,
      confirmButtonText: "Mulai Duel",
      cancelButtonText: "Batal",
      allowOutsideClick: false,
      background: "#1e1e2e",
      color: "#fff"
    }).then((result) => {
      if (result.isDismissed) {
        if (startScreen) {
          startScreen.classList.remove("hidden");
          startScreen.classList.add("active");
        }
        exitVersus();
        return;
      }
      
      state.p2.name = (result.value || "Guest").trim();

      console.log(
        "VersusAyat.init called with",
        allQuestions.length,
        "questions",
      );
      state.isActive = true;
      // Shuffle and take 10 questions
      state.questions = shuffleArray([...allQuestions]).slice(0, 10);
      state.currentIndex = 0;

      console.log("⚔️ Questions ready:", state.questions);

      // Reset Scores
      state.p1.score = 0;
      state.p2.score = 0;
      updateScoreUI();

      // Hide Solo Game Container
      const soloGameContainer = document.querySelector(".game-container");
      if (soloGameContainer) soloGameContainer.style.display = "none";

      if (ui.container) {
        ui.container.classList.remove("hidden");
        ui.container.style.display = "flex"; // FORCE DISPLAY
      } else {
        console.error("Versus container not found during init");
      }

      if (ui.resultScreen) ui.resultScreen.classList.add("hidden");

      // Start Game
      loadQuestion();
    });
  }

  function toggleRotation() {
    state.isRotated = !state.isRotated;
    const p2Area = document.getElementById("p2-area");
    if (state.isRotated) {
      p2Area.classList.add("rotated");
    } else {
      p2Area.classList.remove("rotated");
    }
  }

  function exitVersus() {
    state.isActive = false;
    if (ui.container) ui.container.classList.add("hidden");
    if (ui.resultScreen) ui.resultScreen.classList.add("hidden");

    // Show Start Screen
    const startScreen = document.getElementById("start-screen");
    startScreen.classList.remove("hidden");
    startScreen.classList.add("active");

    // Go back to main menu or just show start screen?
    // Reload page to be safe and clean state for now, or just show start
    window.location.reload();
  }

  function rematch() {
    init(state.questions);
  }

  // --- Private Game Logic ---

  function loadQuestion() {
    if (state.currentIndex >= state.questions.length) {
      endGame();
      return;
    }

    const q = state.questions[state.currentIndex];

    // Render P1
    renderPlayerUI(ui.p1, q, "p1");

    // Render P2
    renderPlayerUI(ui.p2, q, "p2");
  }

  function renderPlayerUI(playerUI, q, playerId) {
    // Use 'tanya' or 'soal' depending on API structure (Ayat uses q.soal usually, checking ayat.js)
    playerUI.question.innerText = q.tanya || q.soal;
    playerUI.options.innerHTML = "";

    const options = q.opsi || [];

    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "btn-option"; // Uses shared class for styling
      btn.innerText = opt;

      // Touchstart for faster reaction
      btn.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault();
          handleAnswer(playerId, opt, q.jawab || q.jawaban, btn);
        },
        { passive: false },
      );

      // Click fallback
      btn.addEventListener("click", () => {
        handleAnswer(playerId, opt, q.jawab || q.jawaban, btn);
      });

      playerUI.options.appendChild(btn);
    });
  }

  function handleAnswer(playerId, selected, correct, btnElement) {
    if (!state.isActive) return;

    // Disable buttons for this player
    const playerUI = ui[playerId];
    const buttons = playerUI.options.querySelectorAll(".btn-option");
    buttons.forEach((b) => (b.disabled = true));

    const isCorrect = selected === correct;

    if (isCorrect) {
      btnElement.classList.add("correct");
      state[playerId].score += 10;
      try {
        AudioManager.playCorrect();
      } catch (e) {}
    } else {
      btnElement.classList.add("wrong");
      try {
        AudioManager.playWrong();
      } catch (e) {}
      // Show correct answer
      buttons.forEach((b) => {
        if (b.innerText === correct) {
          b.classList.add("correct");
        }
      });
    }

    updateScoreUI();

    // VERSUS LOGIC: First correct advances? Or both must answer?
    // Jejak Nabi uses: First correct advances. If wrong, wait.
    if (isCorrect) {
      setTimeout(() => {
        state.currentIndex++;
        loadQuestion();
        // Reset ready states for next round
        state.p1.ready = false;
        state.p2.ready = false;
      }, 1000);
    } else {
      state[playerId].ready = true;
      checkRoundComplete();
    }
  }

  function checkRoundComplete() {
    // If both answered wrong -> Next
    if (state.p1.ready && state.p2.ready) {
      setTimeout(() => {
        state.currentIndex++;
        loadQuestion();
        state.p1.ready = false;
        state.p2.ready = false;
      }, 1000);
    }
  }

  function updateScoreUI() {
    if (ui.p1.score) ui.p1.score.innerText = state.p1.score;
    if (ui.p2.score) ui.p2.score.innerText = state.p2.score;
  }

  function endGame() {
    ui.container.classList.add("hidden");
    ui.resultScreen.classList.remove("hidden");

    document.getElementById("end-score-p1").innerText = state.p1.score;
    document.getElementById("end-score-p2").innerText = state.p2.score;

    let winnerText = "SERI!";
    let finalStatus = "Draw";
    
    if (state.p1.score > state.p2.score) {
      winnerText = "PEMENANG: PLAYER 1! 🏆";
      finalStatus = "Win";
    }
    if (state.p2.score > state.p1.score) {
      winnerText = `🏆 PEMENANG: ${state.p2.name ? state.p2.name.toUpperCase() : 'PLAYER 2'}!`;
      finalStatus = "Lose";
    }

    document.getElementById("v-winner-text").innerText = winnerText;
    
    // Kirim skor ke server
    if (window.socket) {
      window.socket.emit("laporSkorVersusLokal", {
        game: "ayat",
        status: finalStatus,
        score: state.p1.score, 
        p2Name: state.p2.name || "Guest"
      });
    }

    try {
      AudioManager.playWin();
    } catch (e) {}
  }

  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  return {
    init,
    toggleRotation,
    exitVersus,
    rematch,
  };
})();
