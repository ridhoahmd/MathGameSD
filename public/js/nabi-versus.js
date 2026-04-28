/**
 * Logic Mode Versus (1v1 Split Screen) - Jejak Nabi
 * Isolated from nabi.js to ensure zero-risk to solo mode.
 */

const VersusNabi = (() => {
  // --- State ---
  let state = {
    isActive: false,
    questions: [],
    currentIndex: 0,
    p1: { score: 0, ready: false },
    p2: { score: 0, ready: false },
    isRotated: false,
    isTransitioning: false,
  };

  // BUG-04 FIX: Lazy-init UI — jangan query DOM saat module load, tapi saat game init()
  // Sebelumnya: eager query di sini → null jika DOM belum ready
  const ui = {
    container: null,
    resultScreen: null,
    p1: { score: null, question: null, options: null },
    p2: { score: null, question: null, options: null },
  };

  function initUI() {
    ui.container = document.getElementById("versus-container");
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
    if (!ui.container) initUI(); // Lazy-init UI saat pertama kali dibutuhkan
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

      state.isActive = true;
      state.questions = shuffleArray([...allQuestions]).slice(0, 10); // Ambil 10 soal acak
      state.currentIndex = 0;

      // Reset Scores
      state.p1.score = 0;
      state.p2.score = 0;
      updateScoreUI();

      // Show UI
      if (ui.container) ui.container.classList.remove("hidden");
      ui.resultScreen.classList.add("hidden");

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
    ui.container.classList.add("hidden");
    ui.resultScreen.classList.add("hidden");

    // Show Start Screen cleanly
    const startScreen = document.getElementById("start-screen");
    if (startScreen) {
        startScreen.classList.remove("hidden");
        startScreen.classList.add("active");
    }
  }

  function rematch() {
    // Request new questions logic similar to init
    // For now, reload to get fresh questions via socket if needed,
    // or just re-shuffle current ones?
    // Best approach: Re-init with same questions but re-shuffled
    init(state.questions);
  }

  // --- Private Game Logic ---

  function loadQuestion() {
    state.isTransitioning = false; // Reset transition lock
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
    playerUI.question.innerText = q.tanya;
    playerUI.options.innerHTML = "";

    q.opsi.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "btn-option";
      btn.innerText = opt;

      // Touchstart for faster reaction
      btn.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault(); // Prevent ghost clicks
          handleAnswer(playerId, opt, q.jawab, btn);
        },
        { passive: false },
      );

      // Click fallback for non-touch
      btn.addEventListener("click", () => {
        handleAnswer(playerId, opt, q.jawab, btn);
      });

      playerUI.options.appendChild(btn);
    });
  }

  function handleAnswer(playerId, selected, correct, btnElement) {
    if (!state.isActive || state.isTransitioning) return; // Prevent input if transitioning

    // Disable buttons for this player immediately
    const playerUI = ui[playerId];
    const buttons = playerUI.options.querySelectorAll(".btn-option");
    buttons.forEach((b) => (b.disabled = true));

    const clean = (str) => str.trim().toLowerCase();
    const isCorrect =
      clean(selected) === clean(correct) ||
      clean(selected).includes(clean(correct));

    if (isCorrect) {
      state.isTransitioning = true; // Lock further answers
      
      // Disable the OTHER player's buttons immediately
      const otherPlayerId = playerId === "p1" ? "p2" : "p1";
      const otherButtons = ui[otherPlayerId].options.querySelectorAll(".btn-option");
      otherButtons.forEach((b) => (b.disabled = true));

      btnElement.classList.add("correct");
      state[playerId].score += 10;
      try {
        AudioManager.playCorrect();
      } catch (e) {}

      // Show visual indicator to the other player that they lost this round
      ui[otherPlayerId].question.innerText = `⏳ Terlambat! ${playerId.toUpperCase()} Benar!`;
      ui[otherPlayerId].question.style.color = "#ffeb3b";

      // 💥 Particle Burst
      if (typeof ParticleManager !== "undefined") {
          const rect = btnElement.getBoundingClientRect();
          ParticleManager.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 40);
      }
    } else {
      btnElement.classList.add("wrong");
      try {
        AudioManager.playWrong();
      } catch (e) {}
      // Show correct answer
      buttons.forEach((b) => {
        if (clean(b.innerText).includes(clean(correct))) {
          b.classList.add("correct");
        }
      });
    }

    updateScoreUI();

    // VERSUS MODE LOGIC: "First Correct Advances All"
    if (isCorrect) {
      setTimeout(() => {
        ui.p1.question.style.color = ""; // Reset color
        ui.p2.question.style.color = "";
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
      if (state.isTransitioning) return;
      state.isTransitioning = true;
      setTimeout(() => {
        state.currentIndex++;
        loadQuestion();
        state.p1.ready = false;
        state.p2.ready = false;
      }, 1000);
    }
  }

  function updateScoreUI() {
    ui.p1.score.innerText = state.p1.score;
    ui.p2.score.innerText = state.p2.score;
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
        game: "nabi",
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

  // Expose global restart method for no-reload retry
  window.restartGame = function() {
      if(!state.questions || state.questions.length === 0) {
          exitVersus();
          return;
      }
      rematch();
  };

  return {
    init,
    toggleRotation,
    exitVersus,
    rematch,
  };
})();
