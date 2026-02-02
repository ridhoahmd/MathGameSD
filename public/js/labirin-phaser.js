// ============================================
// LABIRIN ILMU - PHASER VERSION (Hybrid)
// Maze Game with Phaser 3
// ============================================

// === SOCKET & STATE (Keep from original) ===
const socket = window.socket;
let playerName = localStorage.getItem("playerName") || "Guest";
let level = "mudah";
let cols, rows;
let size = 30;
let grid = [];
let current;
let stack = [];
let questions = [];
let score = 0;
let gameActive = false;
let finishNode;

// AI Tutor
let tutorUsageCount = 0;
const MAX_TUTOR_USAGE = 3;

// === DOM ELEMENTS ===
const tutorOverlay = document.getElementById("tutor-overlay");
const tutorText = document.getElementById("tutor-text");
const loadingScreen = document.getElementById("loading-screen");
const quizModal = document.getElementById("quiz-modal");

// === PHASER CONFIG ===
const config = {
  type: Phaser.AUTO,
  width: 600,
  height: 600,
  parent: "game-container",
  backgroundColor: "#0a0a1a",
  scene: {
    preload: preload,
    create: create,
    update: update,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
};

// === PHASER GAME VARIABLES ===
let game;
let mazeGraphics;
let playerSprite;
let finishSprite;
let questionMarkers = [];
let cursors;
let moveCooldown = false;

// === DIFFICULTY BUTTONS ===
document.querySelectorAll(".btn-difficulty").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".btn-difficulty")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    level = btn.dataset.level;
  });
});

// === AI TUTOR LISTENER ===
if (socket) {
  socket.on("penjelasanTutor", (data) => {
    const textEl = document.getElementById("tutor-text");
    if (!textEl) return;

    const content = data.penjelasan || data.teks;
    textEl.innerHTML = content;
    textEl.style.opacity = 0;
    textEl.style.transition = "opacity 0.5s ease-in";
    setTimeout(() => {
      textEl.style.opacity = 1;
    }, 50);
  });
}

window.tutupTutorLabirin = function () {
  if (tutorOverlay) tutorOverlay.style.display = "none";
  if (quizModal) quizModal.style.display = "flex";
};

// === REQUEST GAME FROM SERVER ===
window.requestGame = function () {
  if (socket) {
    socket.emit("mulaiGame", "labirin");
  }

  const btn = document.querySelector(".btn-start-game");
  if (btn) {
    btn.innerText = "⏳ MENGHUBUNGI SERVER...";
    btn.disabled = true;
  }

  tutorUsageCount = 0;

  const inputKodeKelas = document.getElementById("inputKodeKelas");
  const kodeAkses = inputKodeKelas
    ? inputKodeKelas.value.trim().toUpperCase()
    : "";

  socket.emit("mintaSoalAI", {
    kategori: "labirin",
    tingkat: level,
    kodeAkses: kodeAkses,
  });

  // Failsafe timeout
  setTimeout(() => {
    if (
      !gameActive &&
      loadingScreen &&
      loadingScreen.style.display !== "none"
    ) {
      if (btn) {
        btn.innerText = "🚀 MULAI MISI (RETRY)";
        btn.disabled = false;
      }
      alert("Server sedang sibuk. Silakan coba lagi.");
    }
  }, 10000);
};

// === SOCKET DATA HANDLER ===
if (socket) {
  socket.on("soalDariAI", (response) => {
    if (loadingScreen) loadingScreen.style.display = "none";

    if (response && response.kategori === "labirin") {
      let info = response.data;
      if (Array.isArray(info)) info = info[0];

      cols = info.maze_size || 10;
      rows = info.maze_size || 10;
      questions = info.soal_list || [];

      // Calculate cell size based on available space
      // Use logical width/height (minus headers/footers)
      const isMobile = window.innerWidth <= 768;
      const headerHeight = 70;
      const footerHeight = isMobile ? 180 : 40; // Space for D-Pad

      const availableWidth = window.innerWidth - 40; // 20px padding each side
      const availableHeight = window.innerHeight - headerHeight - footerHeight;

      size = Math.floor(
        Math.min(availableWidth / cols, availableHeight / rows),
      );

      // Minimum size for playability
      if (size < 25) size = 25;

      // Update Phaser config size
      config.width = cols * size;
      config.height = rows * size;

      // Initialize Phaser game
      initPhaserGame();
    } else {
      alert(response.error || "Gagal memuat soal. Coba lagi.");
      location.reload();
    }
  });
}

// === DYNAMIC RESIZE ===
let resizeTimeout;
window.addEventListener("resize", () => {
  if (!gameActive) return;
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    // Recalculate size
    const info = { maze_size: cols }; // Re-use current cols
    const isMobile = window.innerWidth <= 768;
    const headerHeight = 70;
    const footerHeight = isMobile ? 180 : 40;
    const availableWidth = window.innerWidth - 40;
    const availableHeight = window.innerHeight - headerHeight - footerHeight;

    let newSize = Math.floor(
      Math.min(availableWidth / cols, availableHeight / rows),
    );
    if (newSize < 25) newSize = 25;

    // Determine if significant change
    if (Math.abs(newSize - size) > 2) {
      size = newSize;
      config.width = cols * size;
      config.height = rows * size;
      // Restart Phaser game to apply new config
      initPhaserGame();
    }
  }, 500);
});

// === PHASER INITIALIZATION ===
function initPhaserGame() {
  if (game) {
    game.destroy(true);
  }

  score = 0;
  const scoreEl = document.getElementById("score");
  if (scoreEl) scoreEl.innerText = score;

  game = new Phaser.Game(config);
  gameActive = true;
}

// === PHASER PRELOAD ===
function preload() {
  // No external assets needed
}

// === PHASER CREATE ===
function create() {
  const scene = this;

  // Background Grid matching maze cells
  this.add.grid(
    config.width / 2,
    config.height / 2,
    config.width,
    config.height,
    size,
    size,
    0x000000,
    0,
    0x1f4068,
    0.3,
  );

  // Create graphics for maze
  mazeGraphics = this.add.graphics();

  // Generate maze
  generateMaze();

  // Draw maze
  drawMaze(mazeGraphics);

  // Create player
  createPlayer(scene);

  // Create finish point
  createFinish(scene);

  // Create question markers
  createQuestionMarkers(scene);

  // Input handling
  cursors = this.input.keyboard.createCursorKeys();

  // WASD support
  this.input.keyboard.on("keydown-W", () => movePlayer(0, -1, scene));
  this.input.keyboard.on("keydown-A", () => movePlayer(-1, 0, scene));
  this.input.keyboard.on("keydown-S", () => movePlayer(0, 1, scene));
  this.input.keyboard.on("keydown-D", () => movePlayer(1, 0, scene));

  // Arrow keys
  this.input.keyboard.on("keydown-UP", () => movePlayer(0, -1, scene));
  this.input.keyboard.on("keydown-LEFT", () => movePlayer(-1, 0, scene));
  this.input.keyboard.on("keydown-DOWN", () => movePlayer(0, 1, scene));
  this.input.keyboard.on("keydown-RIGHT", () => movePlayer(1, 0, scene));

  // Touch/swipe handling
  let touchStartX = 0;
  let touchStartY = 0;

  this.input.on("pointerdown", (pointer) => {
    touchStartX = pointer.x;
    touchStartY = pointer.y;
  });

  this.input.on("pointerup", (pointer) => {
    const dx = pointer.x - touchStartX;
    const dy = pointer.y - touchStartY;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > 30) {
        movePlayer(dx > 0 ? 1 : -1, 0, scene);
      }
    } else {
      if (Math.abs(dy) > 30) {
        movePlayer(0, dy > 0 ? 1 : -1, scene);
      }
    }
  });

  // Store scene reference
  this.gameScene = scene;
}

// === PHASER UPDATE ===
function update() {
  if (!gameActive) return;

  // Pulse effect for finish
  if (finishSprite) {
    const pulse = Math.sin(this.time.now / 200) * 0.1 + 1;
    finishSprite.setScale(pulse);
  }

  // Pulse effect for question markers
  questionMarkers.forEach((marker) => {
    if (marker.active) {
      const pulse = Math.sin(this.time.now / 300) * 0.1 + 1;
      marker.setScale(pulse);
    }
  });
}

// === MAZE GENERATION (DFS Algorithm) ===
function generateMaze() {
  grid = [];
  stack = [];

  // Create cells
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      grid.push({
        i: i,
        j: j,
        walls: [true, true, true, true], // top, right, bottom, left
        visited: false,
        isQuestion: false,
        questionData: null,
      });
    }
  }

  // DFS maze generation
  current = grid[0];
  current.visited = true;
  finishNode = grid[grid.length - 1];

  let processing = true;
  while (processing) {
    const next = checkNeighbors(current);
    if (next) {
      next.visited = true;
      stack.push(current);
      removeWalls(current, next);
      current = next;
    } else if (stack.length > 0) {
      current = stack.pop();
    } else {
      processing = false;
    }
  }

  // Place questions randomly
  let qIndex = 0;
  const shuffledIndices = Array.from({ length: grid.length }, (_, i) => i).sort(
    () => Math.random() - 0.5,
  );

  for (const i of shuffledIndices) {
    if (i > 0 && i < grid.length - 1 && qIndex < questions.length) {
      if (Math.random() < 0.3) {
        grid[i].isQuestion = true;
        grid[i].questionData = questions[qIndex];
        qIndex++;
      }
    }
  }

  // Reset current to start
  current = grid[0];
}

function index(i, j) {
  if (i < 0 || j < 0 || i > cols - 1 || j > rows - 1) return -1;
  return i + j * cols;
}

function checkNeighbors(cell) {
  const neighbors = [];
  const top = grid[index(cell.i, cell.j - 1)];
  const right = grid[index(cell.i + 1, cell.j)];
  const bottom = grid[index(cell.i, cell.j + 1)];
  const left = grid[index(cell.i - 1, cell.j)];

  if (top && !top.visited) neighbors.push(top);
  if (right && !right.visited) neighbors.push(right);
  if (bottom && !bottom.visited) neighbors.push(bottom);
  if (left && !left.visited) neighbors.push(left);

  if (neighbors.length > 0) {
    return neighbors[Math.floor(Math.random() * neighbors.length)];
  }
  return undefined;
}

function removeWalls(a, b) {
  const x = a.i - b.i;
  if (x === 1) {
    a.walls[3] = false;
    b.walls[1] = false;
  }
  if (x === -1) {
    a.walls[1] = false;
    b.walls[3] = false;
  }

  const y = a.j - b.j;
  if (y === 1) {
    a.walls[0] = false;
    b.walls[2] = false;
  }
  if (y === -1) {
    a.walls[2] = false;
    b.walls[0] = false;
  }
}

// === DRAW MAZE ===
// === DRAW MAZE ===
function drawMaze(graphics) {
  graphics.clear();

  // 1. Draw Glow (Super Thick)
  graphics.lineStyle(12, 0x00f2ff, 0.5);
  drawWalls(graphics);

  // 2. Draw Core (Thin, bright)
  graphics.lineStyle(2, 0xffffff, 1);
  drawWalls(graphics);
}

function drawWalls(graphics) {
  for (const cell of grid) {
    const x = cell.i * size;
    const y = cell.j * size;

    if (cell.walls[0]) {
      // Top
      graphics.beginPath();
      graphics.moveTo(x, y);
      graphics.lineTo(x + size, y);
      graphics.strokePath();
    }
    if (cell.walls[1]) {
      // Right
      graphics.beginPath();
      graphics.moveTo(x + size, y);
      graphics.lineTo(x + size, y + size);
      graphics.strokePath();
    }
    if (cell.walls[2]) {
      // Bottom
      graphics.beginPath();
      graphics.moveTo(x + size, y + size);
      graphics.lineTo(x, y + size);
      graphics.strokePath();
    }
    if (cell.walls[3]) {
      // Left
      graphics.beginPath();
      graphics.moveTo(x, y + size);
      graphics.lineTo(x, y);
      graphics.strokePath();
    }
  }
}

// === CREATE PLAYER ===
// === CREATE PLAYER ===
function createPlayer(scene) {
  const x = current.i * size + size / 2;
  const y = current.j * size + size / 2;

  // Particle Trail
  const particles = scene.add.particles(0, 0, "player", {
    speed: 10,
    scale: { start: 0.5, end: 0 },
    blendMode: "ADD",
    lifespan: 200,
    frequency: 50,
    follow: null, // Will attach to sprite
  });

  // Create player texture (Glowing Orb)
  const playerGraphics = scene.make.graphics({ x: 0, y: 0, add: false });
  playerGraphics.fillStyle(0x00ffff, 0.4); // Glow
  playerGraphics.fillCircle(size / 2, size / 2, size / 2.5);
  playerGraphics.fillStyle(0xffffff, 1); // Core
  playerGraphics.fillCircle(size / 2, size / 2, size / 4);
  playerGraphics.generateTexture("player", size, size);

  playerSprite = scene.add.sprite(x, y, "player");
  playerSprite.setDepth(10);

  particles.startFollow(playerSprite);

  // Idle Animation (Pulse)
  scene.tweens.add({
    targets: playerSprite,
    scale: { from: 1, to: 1.1 },
    alpha: { from: 0.8, to: 1 },
    duration: 600,
    yoyo: true,
    repeat: -1,
  });
}

// === CREATE FINISH ===
function createFinish(scene) {
  const x = finishNode.i * size + size / 2;
  const y = finishNode.j * size + size / 2;

  // Finish Zone graphic
  const finishGraphics = scene.make.graphics({ x: 0, y: 0, add: false });
  finishGraphics.fillStyle(0x00ff00, 0.3);
  finishGraphics.fillCircle(size / 2, size / 2, size / 2.2); // Outer ring
  finishGraphics.lineStyle(2, 0x00ff00, 1);
  finishGraphics.strokeCircle(size / 2, size / 2, size / 2.2);
  finishGraphics.generateTexture("finish", size, size);

  finishSprite = scene.add.sprite(x, y, "finish");
  finishSprite.setDepth(5);

  // Rotating 'Portal' effect
  scene.tweens.add({
    targets: finishSprite,
    angle: 360,
    duration: 3000,
    repeat: -1,
  });

  // Flag Icon
  scene.add
    .text(x, y, "🏁", {
      fontSize: size / 2 + "px",
    })
    .setOrigin(0.5)
    .setDepth(6);
}

// === CREATE QUESTION MARKERS ===
function createQuestionMarkers(scene) {
  questionMarkers = [];

  for (const cell of grid) {
    if (cell.isQuestion) {
      const x = cell.i * size + size / 2;
      const y = cell.j * size + size / 2;

      // Animated Square Shape (Modified)
      const markerGraphics = scene.make.graphics({ x: 0, y: 0, add: false });
      markerGraphics.lineStyle(2, 0xff00cc, 1);
      markerGraphics.fillStyle(0xff00cc, 0.5);
      markerGraphics.strokeRect(
        size * 0.25,
        size * 0.25,
        size * 0.5,
        size * 0.5,
      );
      markerGraphics.fillRect(size * 0.25, size * 0.25, size * 0.5, size * 0.5);
      markerGraphics.generateTexture(
        "question_" + cell.i + "_" + cell.j,
        size,
        size,
      );

      const marker = scene.add.sprite(
        x,
        y,
        "question_" + cell.i + "_" + cell.j,
      );
      marker.setDepth(5);
      marker.cellIndex = index(cell.i, cell.j);

      // Rotating Animation
      scene.tweens.add({
        targets: marker,
        angle: 360,
        duration: 2000,
        repeat: -1,
      });

      // Flashing "!"
      const text = scene.add
        .text(x, y, "!", {
          fontFamily: "Arial",
          fontSize: size / 2 + "px",
          fontStyle: "bold",
          color: "#fff",
        })
        .setOrigin(0.5)
        .setDepth(6);

      marker.textObj = text; // Link text to marker for cleanup
      questionMarkers.push(marker);
    }
  }
}

// === MOVE PLAYER ===
let pendingNode = null;

function movePlayer(dx, dy, scene) {
  if (!gameActive || moveCooldown) return;

  let next;
  let blocked = false;

  if (dx === 1) {
    if (current.walls[1]) blocked = true;
    else next = grid[index(current.i + 1, current.j)];
  } else if (dx === -1) {
    if (current.walls[3]) blocked = true;
    else next = grid[index(current.i - 1, current.j)];
  } else if (dy === 1) {
    if (current.walls[2]) blocked = true;
    else next = grid[index(current.i, current.j + 1)];
  } else if (dy === -1) {
    if (current.walls[0]) blocked = true;
    else next = grid[index(current.i, current.j - 1)];
  }

  if (!blocked && next) {
    if (next.isQuestion) {
      openQuiz(next);
    } else {
      // Move player
      current = next;
      moveCooldown = true;

      const targetX = current.i * size + size / 2;
      const targetY = current.j * size + size / 2;

      scene.tweens.add({
        targets: playerSprite,
        x: targetX,
        y: targetY,
        duration: 150,
        ease: "Power2",
        onComplete: () => {
          moveCooldown = false;
          checkFinish();
        },
      });
    }
  }
}

// === QUIZ FUNCTIONS ===
function openQuiz(node) {
  gameActive = false;
  pendingNode = node;

  if (quizModal) {
    quizModal.style.display = "flex";

    const title = document.querySelector("#quiz-modal h2");
    if (title) {
      title.innerText = "RINTANGAN!";
      title.style.color = "#ff00cc";
    }

    const qText = document.getElementById("q-text");
    if (qText) {
      qText.innerText = node.questionData.tanya;
      qText.style.color = "white";
    }

    const input = document.getElementById("q-input");
    if (input) {
      input.value = "";
      input.style.display = "block";
      input.focus();
    }

    const submitBtn = document.querySelector(".btn-submit-answer");
    if (submitBtn) {
      submitBtn.innerText = "CEK JAWABAN";
      submitBtn.onclick = checkQuiz;
    }
  }
}

window.checkQuiz = function () {
  const userAns = document.getElementById("q-input").value.toLowerCase().trim();
  const correct = pendingNode.questionData.jawab.toLowerCase().trim();

  const title = document.querySelector("#quiz-modal h2");
  const qText = document.getElementById("q-text");

  if (
    userAns === correct ||
    (correct.includes(userAns) && userAns.length > 1)
  ) {
    try {
      AudioManager.playCorrect();
    } catch (e) {}

    if (title) {
      title.innerText = "✅ RINTANGAN HANCUR!";
      title.style.color = "#00ff00";
    }
    if (qText) qText.innerText = "Jalan terbuka...";

    setTimeout(() => {
      if (quizModal) quizModal.style.display = "none";
      pendingNode.isQuestion = false;

      // Remove marker
      const markerToRemove = questionMarkers.find(
        (m) => m.cellIndex === index(pendingNode.i, pendingNode.j),
      );
      if (markerToRemove) markerToRemove.destroy();

      score += 20;
      const scoreEl = document.getElementById("score");
      if (scoreEl) scoreEl.innerText = score;

      current = pendingNode;

      // Move player
      const scene = game.scene.scenes[0];
      const targetX = current.i * size + size / 2;
      const targetY = current.j * size + size / 2;

      scene.tweens.add({
        targets: playerSprite,
        x: targetX,
        y: targetY,
        duration: 150,
        ease: "Power2",
      });

      gameActive = true;
      checkFinish();
    }, 1000);
  } else {
    try {
      AudioManager.playWrong();
    } catch (e) {}

    if (tutorUsageCount < MAX_TUTOR_USAGE) {
      tutorUsageCount++;

      if (quizModal) quizModal.style.display = "none";

      if (tutorOverlay) {
        tutorOverlay.style.display = "flex";
        if (tutorText) {
          tutorText.innerHTML = `
            <div class="tutor-loading-box">
              <div class="loader-spinner"></div>
              <span class="loading-text">GURU SEDANG MEMBACA PETA...</span>
              <div style="margin-top: 8px; font-size: 0.85rem; color: #ffd700;">
                (Sisa Bantuan: ${MAX_TUTOR_USAGE - tutorUsageCount})
              </div>
            </div>
          `;
        }
      }

      socket.emit("mintaPenjelasan", {
        game: "labirin",
        soal: document.getElementById("q-text").innerText,
        jawabanUser: userAns,
        jawabanBenar: correct,
      });
    } else {
      if (title) {
        title.innerText = "❌ SALAH! (Bantuan Habis)";
        title.style.color = "red";
      }
      if (qText) {
        qText.style.color = "#ff6b6b";
        qText.innerText = "Coba lagi ya...";
      }

      document.getElementById("q-input").value = "";

      setTimeout(() => {
        if (title) {
          title.innerText = "RINTANGAN!";
          title.style.color = "#ff00cc";
        }
        if (qText) {
          qText.style.color = "white";
          qText.innerText = pendingNode.questionData.tanya;
        }
      }, 1500);
    }
  }
};

// === CHECK FINISH ===
function checkFinish() {
  if (current === finishNode) {
    try {
      AudioManager.playWin();
    } catch (e) {}
    score += 50;
    gameActive = false;

    socket.emit("simpanSkor", {
      nama: playerName,
      skor: score,
      game: "labirin",
    });

    if (quizModal) {
      quizModal.style.display = "flex";

      const title = document.querySelector("#quiz-modal h2");
      if (title) {
        title.innerText = "🏆 MISI SELESAI!";
        title.style.color = "#00f2ff";
      }

      const qText = document.getElementById("q-text");
      if (qText) qText.innerText = `Skor Akhir: ${score}`;

      const input = document.getElementById("q-input");
      if (input) input.style.display = "none";

      const submitBtn = document.querySelector(".btn-submit-answer");
      if (submitBtn) {
        submitBtn.innerText = "KEMBALI KE MENU";
        submitBtn.onclick = function () {
          window.location.href = "/";
        };
      }
    }
  }
}

// === CONTROL BUTTONS (Mobile) ===
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".btn-ctrl").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (!game || !game.scene.scenes[0]) return;
      const scene = game.scene.scenes[0];
      const direction = btn.innerText;

      if (direction === "▲") movePlayer(0, -1, scene);
      else if (direction === "▶") movePlayer(1, 0, scene);
      else if (direction === "▼") movePlayer(0, 1, scene);
      else if (direction === "◀") movePlayer(-1, 0, scene);
    });
  });
});
