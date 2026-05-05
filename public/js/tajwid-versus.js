const VersusTajwid = (function () {
  const state = {
    isActive: false,
    isTransitioning: false, // FIX #2: Race condition guard
    questionsP1: [],
    questionsP2: [],
    timerInterval: null,
    timeLeft: 60,
    p1: { score: 0, currentCard: null, index: 0 },
    p2: { score: 0, currentCard: null, index: 0 },
  };

  const ui = {
    container: null,
    resultScreen: null,
    timer: null,
    p1: { score: null, cardArea: null, buckets: null },
    p2: { score: null, cardArea: null, buckets: null },
  };

  const sounds = {
    correct:
      typeof AudioManager !== "undefined" ? () => AudioManager.playCorrect() : () => {},
    wrong:
      typeof AudioManager !== "undefined" ? () => AudioManager.playWrong() : () => {},
    win: typeof AudioManager !== "undefined" ? () => AudioManager.playWin() : () => {},
  };

  // Shuffle helper
  const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  function exitVersus() {
    state.isActive = false;
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    if (ui.container) ui.container.classList.add("hidden");
    if (ui.resultScreen) ui.resultScreen.classList.add("hidden");

    // FIX: Reset game mode to solo so main file doesn't route to versus on solo restart
    if (typeof window.selectMode === "function") {
      window.selectMode("solo");
    }

    const startScreen = document.getElementById("start-screen");
    if (startScreen) {
      startScreen.classList.remove("hidden");
      startScreen.classList.add("active");
    }

    const gameWrapper = document.querySelector(".game-wrapper");
    if (gameWrapper) gameWrapper.style.display = "";

    const topBar = document.querySelector(".top-bar");
    if (topBar) topBar.style.display = "";
  }

  function _initUIElements() {
    ui.container = document.getElementById("versus-container");
    ui.resultScreen = document.getElementById("versus-result");
    ui.timer = document.getElementById("v-timer");

    ui.p1.score = document.getElementById("v-p1-score");
    ui.p1.cardArea = document.getElementById("v-p1-card-area");
    ui.p1.buckets = {
      left: document.querySelector("#versus-container .p1-area .v-bucket.left"),
      right: document.querySelector("#versus-container .p1-area .v-bucket.right"),
    };

    ui.p2.score = document.getElementById("v-p2-score");
    ui.p2.cardArea = document.getElementById("v-p2-card-area");
    ui.p2.buckets = {
      left: document.querySelector("#versus-container .p2-area .v-bucket.left"),
      right: document.querySelector("#versus-container .p2-area .v-bucket.right"),
    };
  }

  function init(data) {
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
      color: "#fff",
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

      // Lazy init UI elements
      if (!ui.container) _initUIElements();

      // Normalize Data
      let queue = [];
      if (data.data && Array.isArray(data.data)) {
        queue = data.data;
        if (data.kategori_kiri && data.kategori_kanan) {
          if (ui.p1.buckets.left) ui.p1.buckets.left.innerText = data.kategori_kiri;
          if (ui.p1.buckets.right) ui.p1.buckets.right.innerText = data.kategori_kanan;
          if (ui.p2.buckets.left) ui.p2.buckets.left.innerText = data.kategori_kiri;
          if (ui.p2.buckets.right) ui.p2.buckets.right.innerText = data.kategori_kanan;
        }
      } else if (Array.isArray(data)) {
        queue = data;
      } else {
        console.error("VersusTajwid: Invalid data format", data);
        return;
      }

      _startRound(queue);
    });
  }

  // FIX #1 & #2: Dedicated internal start function, separate from prompt
  function _startRound(originalQueue) {
    // FIX #1: Always re-shuffle on every start/rematch
    state.questionsP1 = shuffleArray(originalQueue);
    state.questionsP2 = shuffleArray(originalQueue);

    const guestName = state.p2.name;
    state.isActive = true;
    state.isTransitioning = false;
    state.timeLeft = 60;
    state.p1 = { score: 0, index: 0, currentCard: null };
    state.p2 = { score: 0, index: 0, currentCard: null, name: guestName };

    updateScoreUI();
    updateTimerUI();

    // Hide Solo UI
    const startScreen = document.getElementById("start-screen");
    if (startScreen) {
      startScreen.classList.remove("active");
      startScreen.classList.add("hidden");
    }
    const gameWrapper = document.querySelector(".game-wrapper");
    if (gameWrapper) gameWrapper.style.display = "none";
    const topBar = document.querySelector(".top-bar");
    if (topBar) topBar.style.display = "none";

    // Show Versus UI
    if (ui.container) {
      ui.container.classList.remove("hidden");
      ui.container.style.display = "flex";
      ui.container.style.zIndex = "100000";
    }
    if (ui.resultScreen) ui.resultScreen.classList.add("hidden");

    startTimer();
    loadCard(1);
    loadCard(2);
  }

  function loadCard(playerId) {
    if (!state.isActive) return;

    const playerState = playerId === 1 ? state.p1 : state.p2;
    const uiArea = playerId === 1 ? ui.p1.cardArea : ui.p2.cardArea;
    const playerQuestions = playerId === 1 ? state.questionsP1 : state.questionsP2;

    if (!uiArea) return; // Null guard

    if (playerState.index >= playerQuestions.length) {
      playerState.index = 0; // Loop questions if exhausted
    }

    const cardData = playerQuestions[playerState.index];
    if (!cardData) return;
    playerState.currentCard = cardData;

    uiArea.innerHTML = "";
    const card = document.createElement("div");
    card.className = "v-card glass-panel";
    card.innerText = cardData.teks || "Error";

    setupCardInput(card, playerId);
    uiArea.appendChild(card);
  }

  function setupCardInput(card, playerId) {
    let startX = 0;
    let isDragging = false;
    let answered = false; // FIX #2: Per-card answer lock

    const processSwipe = (diffX) => {
      if (answered) return; // Prevent double-swipe
      const threshold = 50;
      if (Math.abs(diffX) < threshold) {
        card.style.transform = "translateX(0) rotate(0deg)";
        return;
      }
      answered = true; // Lock this card

      let side;
      if (diffX > threshold) {
        side = "kanan";
      } else {
        side = "kiri";
      }

      // FIX #9: P2 area is rotated 180deg visually — invert swipe direction for P2
      if (playerId === 2) {
        side = side === "kanan" ? "kiri" : "kanan";
      }

      handleAnswer(playerId, side);
    };

    // Touch Events
    card.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
      isDragging = true;
      card.style.transition = "none";
    }, { passive: true });

    card.addEventListener("touchmove", (e) => {
      if (!isDragging) return;
      const diffX = e.touches[0].clientX - startX;
      const rotate = diffX / 10;
      card.style.transform = `translateX(${diffX}px) rotate(${rotate}deg)`;
    }, { passive: true });

    card.addEventListener("touchend", (e) => {
      if (!isDragging) return;
      isDragging = false;
      card.style.transition = "transform 0.3s ease";
      processSwipe(e.changedTouches[0].clientX - startX);
    });

    // Mouse Events
    card.addEventListener("mousedown", (e) => {
      startX = e.clientX;
      isDragging = true;
      card.style.transition = "none";
    });

    card.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const diffX = e.clientX - startX;
      const rotate = diffX / 10;
      card.style.transform = `translateX(${diffX}px) rotate(${rotate}deg)`;
    });

    const handleMouseUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      card.style.transition = "transform 0.3s ease";
      processSwipe(e.clientX - startX);
    };

    card.addEventListener("mouseup", handleMouseUp);
    card.addEventListener("mouseleave", handleMouseUp);
  }

  function handleAnswer(playerId, side) {
    // FIX #2: Global isTransitioning guard — block if already processing for this player
    if (!state.isActive) return;

    const pState = playerId === 1 ? state.p1 : state.p2;
    const card = pState.currentCard;

    if (!card) return;

    const isCorrect = side === card.hukum;

    if (isCorrect) {
      pState.score += 10;
      if (typeof sounds.correct === "function") sounds.correct();

      const cardEl = playerId === 1
        ? ui.p1.cardArea?.firstChild
        : ui.p2.cardArea?.firstChild;

      if (cardEl) {
        cardEl.classList.add("correct-flash");
        const moveX = side === "kanan" ? 500 : -500;
        cardEl.style.transform = `translateX(${moveX}px) rotate(${moveX / 10}deg) scale(0)`;
      }

      if (typeof ParticleManager !== "undefined") {
        ParticleManager.burst(window.innerWidth / 2, window.innerHeight / 2, 40);
      }

      setTimeout(() => {
        pState.index++;
        loadCard(playerId);
      }, 300);
    } else {
      pState.score = Math.max(0, pState.score - 5);
      if (typeof sounds.wrong === "function") sounds.wrong();

      const cardEl = playerId === 1
        ? ui.p1.cardArea?.firstChild
        : ui.p2.cardArea?.firstChild;

      if (cardEl) {
        cardEl.classList.add("wrong-flash");
        setTimeout(() => cardEl.classList.remove("wrong-flash"), 400);
      }
    }

    updateScoreUI();
  }

  function startTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    updateTimerUI();

    state.timerInterval = setInterval(() => {
      state.timeLeft--;
      updateTimerUI();
      if (state.timeLeft <= 0) {
        endGame();
      }
    }, 1000);
  }

  function updateTimerUI() {
    if (ui.timer) ui.timer.innerText = state.timeLeft;
  }

  function updateScoreUI() {
    if (ui.p1.score) ui.p1.score.innerText = state.p1.score;
    if (ui.p2.score) ui.p2.score.innerText = state.p2.score;
  }

  function endGame() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    state.isActive = false;

    if (ui.container) ui.container.classList.add("hidden");
    if (ui.resultScreen) ui.resultScreen.classList.remove("hidden");

    const p1s = state.p1.score;
    const p2s = state.p2.score;
    const winnerText = document.getElementById("v-winner-text");
    const finalP1 = document.getElementById("v-final-p1");
    const finalP2 = document.getElementById("v-final-p2");

    if (finalP1) finalP1.innerText = p1s;
    if (finalP2) finalP2.innerText = p2s;

    let finalStatus = "Draw";
    let msg = "🤝 SERI!";

    if (p1s > p2s) {
      msg = "🏆 PEMAIN 1 MENANG!";
      finalStatus = "Win";
    } else if (p2s > p1s) {
      msg = `🏆 ${state.p2.name ? state.p2.name.toUpperCase() : "PEMAIN 2"} MENANG!`;
      finalStatus = "Lose";
    }

    if (winnerText) winnerText.innerText = msg;

    if (window.socket) {
      window.socket.emit("laporSkorVersusLokal", {
        game: "tajwid",
        status: finalStatus,
        score: p1s,
        p2Name: state.p2.name || "Guest",
      });
    }

    if (typeof AudioManager !== "undefined") AudioManager.playWin();
  }

  // FIX #1 & #3: restartGame re-shuffles and does NOT trigger Swal prompt again
  window.restartGame = function () {
    if (!state.questionsP1 || state.questionsP1.length === 0) {
      console.warn("VersusTajwid: No questions for restart.");
      exitVersus();
      return;
    }
    // Use the original question pool (we keep a reference via questionsP1 which was already shuffled)
    // Re-shuffle and start a new round without asking for P2 name again
    _startRound(state.questionsP1);
  };

  return {
    init: init,
    handleInput: handleAnswer,
    exitVersus: exitVersus,
  };
})();
