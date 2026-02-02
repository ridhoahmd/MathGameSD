// ============================================
// TANGKAP BINTANG - PHASER GAME
// Educational Math Game with Phaser 3
// ============================================

// Socket connection for score saving
const socket = io();
const username = localStorage.getItem("playerName") || "Guest";

// Game State
let gameActive = false;
let currentDifficulty = "mudah"; // mudah, sedang, sulit
let combo = 0;
let maxCombo = 0;

// Config
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "game-container",
  backgroundColor: "#0a0a1a",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: {
    preload: preload,
    create: create,
    update: update,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH, // Let Phaser handle centering inside container
  },
};

// Game Variables
let player;
let stars;
let cursors;
let score = 0;
let lives = 3;
let timeLeft = 60;
let currentQuestion = null;
let correctAnswer = null;
let gameOver = false;
let timerEvent;
let starSpawnTimer;

// Particles
let emitter;

// DOM Elements
const scoreDisplay = document.getElementById("score-display");
const livesDisplay = document.getElementById("lives-display");
const timeDisplay = document.getElementById("time-display");
const questionText = document.getElementById("question-text");
const gameOverModal = document.getElementById("game-over-modal");
const startScreen = document.getElementById("start-screen");
const finalScoreEl = document.getElementById("final-score");

// Initialize Phaser Game (Wait for user to start)
let game;

// --- DIFFICULTY SETTINGS ---
const difficultySettings = {
  mudah: { spawnRate: 1500, speedMin: 2, speedMax: 4, ops: ["+"] },
  sedang: { spawnRate: 1200, speedMin: 4, speedMax: 6, ops: ["+", "-"] },
  sulit: { spawnRate: 800, speedMin: 6, speedMax: 9, ops: ["+", "-", "×"] },
};

// --- GLOBAL FUNCTIONS ---
window.selectDifficulty = function (level) {
  currentDifficulty = level;
  startScreen.classList.add("hidden"); // Hide start screen
  startGame();
};

function startGame() {
  if (!game) {
    game = new Phaser.Game(config);
  } else {
    // Restart scene if game already exists
    game.scene.scenes[0].scene.restart();
  }
  gameActive = true;
}

// Preload
function preload() {
  this.load.on("complete", () => {
    console.log(`🎮 Tangkap Bintang loaded! Difficulty: ${currentDifficulty}`);
  });
}

// Create Game Objects
function create() {
  const scene = this; // Capture scene reference

  // Reset State
  score = 0;
  lives = 3;
  timeLeft = 60;
  combo = 0;
  gameOver = false;
  updateUI();

  // Background gradient
  const bg = this.add.graphics();
  bg.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a1a3e, 0x1a1a3e, 1);
  bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // Add stars background decoration
  for (let i = 0; i < 50; i++) {
    const x = Phaser.Math.Between(0, GAME_WIDTH);
    const y = Phaser.Math.Between(0, GAME_HEIGHT);
    const size = Phaser.Math.Between(1, 3);
    const star = this.add.circle(x, y, size, 0xffffff, 0.3);

    this.tweens.add({
      targets: star,
      alpha: { from: 0.1, to: 0.5 },
      duration: Phaser.Math.Between(1000, 3000),
      yoyo: true,
      repeat: -1,
    });
  }

  // Generate Player Texture
  if (!this.textures.exists("player")) {
    const playerGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    playerGraphics.fillStyle(0x00f2ff, 0.3); // Glow
    playerGraphics.fillRoundedRect(-5, -5, 90, 40, 15);
    playerGraphics.fillStyle(0x00f2ff, 1); // Body
    playerGraphics.fillRoundedRect(0, 0, 80, 30, 10);
    playerGraphics.fillStyle(0x00b4d8, 1); // Highlight
    playerGraphics.fillRoundedRect(5, 5, 70, 20, 8);
    playerGraphics.fillStyle(0xffffff, 0.5); // Shine
    playerGraphics.fillRoundedRect(15, 8, 50, 5, 3);
    playerGraphics.generateTexture("player", 90, 40);
  }

  // Create Player
  player = this.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT - 50, "player");
  player.setCollideWorldBounds(true);
  player.setImmovable(true);

  // Generate Star Textures
  if (!this.textures.exists("star")) {
    const starGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    starGraphics.fillStyle(0xffeb3b, 1);
    drawStar(starGraphics, 25, 25, 5, 25, 12);
    starGraphics.generateTexture("star", 50, 50);
  }

  if (!this.textures.exists("wrongStar")) {
    const wrongStarGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    wrongStarGraphics.fillStyle(0xff4444, 1);
    drawStar(wrongStarGraphics, 25, 25, 5, 25, 12);
    wrongStarGraphics.generateTexture("wrongStar", 50, 50);
  }

  // Powerup Texture
  if (!this.textures.exists("particle")) {
    const p = this.make.graphics({ x: 0, y: 0, add: false });
    p.fillStyle(0xffffff, 1);
    p.fillCircle(4, 4, 4);
    p.generateTexture("particle", 8, 8);
  }

  // Particle Emitter
  const particles = this.add.particles(0, 0, "particle", {
    speed: { min: 50, max: 150 },
    scale: { start: 1, end: 0 },
    lifespan: 600,
    emitting: false,
  });
  emitter = particles;

  // Stars group
  stars = this.physics.add.group();

  // Collision detection
  this.physics.add.overlap(player, stars, collectStar, null, this);

  // Input
  cursors = this.input.keyboard.createCursorKeys();
  this.input.on("pointermove", (pointer) => {
    if (!gameOver) {
      // Scale pointer x to match canvas scaling
      const scaleX = GAME_WIDTH / scene.scale.displaySize.width;
      // Simple approximation or just rely on Phaser's internal input mapping which is usually good
      player.x = Phaser.Math.Clamp(pointer.x, 40, GAME_WIDTH - 40);
    }
  });

  // Generate first question
  generateQuestion();

  // Timer
  timerEvent = this.time.addEvent({
    delay: 1000,
    callback: updateTimer,
    callbackScope: this,
    loop: true,
  });

  // Spawn stars periodically based on difficulty
  const settings = difficultySettings[currentDifficulty];
  starSpawnTimer = this.time.addEvent({
    delay: settings.spawnRate,
    callback: spawnStar,
    callbackScope: this,
    loop: true,
  });

  // Initial spawns
  for (let i = 0; i < 3; i++) {
    this.time.delayedCall(i * 500, spawnStar, [], this);
  }
}

// Update Loop
function update() {
  if (gameOver) return;

  // Keyboard controls
  if (cursors.left.isDown) {
    player.x -= 10;
  } else if (cursors.right.isDown) {
    player.x += 10;
  }

  // Keep player in bounds
  player.x = Phaser.Math.Clamp(player.x, 40, GAME_WIDTH - 40);

  // Move stars down
  stars.getChildren().forEach((star) => {
    star.y += star.getData("speed");
    star.rotation += 0.02;

    // Update text position
    const text = star.getData("text");
    if (text && text.active) {
      text.x = star.x;
      text.y = star.y;
    }

    // Remove off-screen stars
    if (star.y > GAME_HEIGHT + 30) {
      if (text) text.destroy();
      star.destroy();
    }
  });
}

// Draw Star Shape Helper
function drawStar(graphics, cx, cy, spikes, outerRadius, innerRadius) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  graphics.beginPath();
  graphics.moveTo(cx, cy - outerRadius);

  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    graphics.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    graphics.lineTo(x, y);
    rot += step;
  }

  graphics.lineTo(cx, cy - outerRadius);
  graphics.closePath();
  graphics.fillPath();
}

// Generate Math Question
function generateQuestion() {
  const settings = difficultySettings[currentDifficulty];
  const op = settings.ops[Math.floor(Math.random() * settings.ops.length)];
  let a, b;

  if (op === "+") {
    a = Phaser.Math.Between(1, 20);
    b = Phaser.Math.Between(1, 20);
    correctAnswer = a + b;
  } else if (op === "-") {
    a = Phaser.Math.Between(10, 30);
    b = Phaser.Math.Between(1, a);
    correctAnswer = a - b;
  } else if (op === "×") {
    a = Phaser.Math.Between(2, 9);
    b = Phaser.Math.Between(2, 9);
    correctAnswer = a * b;
  }

  currentQuestion = `${a} ${op} ${b} = ?`;
  questionText.textContent = currentQuestion;

  // Animate Question Text
  questionText.style.transform = "scale(1.2)";
  setTimeout(() => (questionText.style.transform = "scale(1)"), 200);
}

// Spawn Star
function spawnStar() {
  if (gameOver) return;

  const x = Phaser.Math.Between(50, GAME_WIDTH - 50);
  const isCorrect = Math.random() < 0.4; // 40% Chance correct

  // Logic to prevent too many wrong stars in a row?
  // For now simple random is fine strictly

  const value = isCorrect
    ? correctAnswer
    : correctAnswer +
      (Phaser.Math.Between(0, 1) ? 1 : -1) * Phaser.Math.Between(1, 5);

  const texture = isCorrect ? "star" : "wrongStar";
  const star = stars.create(x, -40, texture);

  const settings = difficultySettings[currentDifficulty];
  const speed = Phaser.Math.Between(settings.speedMin, settings.speedMax);

  star.setData("value", value);
  star.setData("isCorrect", value === correctAnswer);
  star.setData("speed", speed);

  // Add number text
  const scene = game.scene.scenes[0];
  const text = scene.add.text(x, -40, value.toString(), {
    fontFamily: "Orbitron, sans-serif",
    fontSize: "18px",
    fontStyle: "bold",
    color: "#000",
  });
  text.setOrigin(0.5);
  star.setData("text", text);
}

// Collect Star Handler
function collectStar(player, star) {
  const isCorrect = star.getData("isCorrect");
  const value = star.getData("value");
  const text = star.getData("text");
  const scene = this;

  // Cleanup star
  if (text) text.destroy();
  star.destroy();

  if (value === correctAnswer) {
    // CORRECT!
    score += 10 + combo * 5; // Combo Bonus
    combo++;
    if (combo > maxCombo) maxCombo = combo;

    // Play Sound
    try {
      AudioManager.playCorrect();
    } catch (e) {}

    // Visuals
    showFeedback(
      scene,
      player.x,
      player.y - 50,
      `+${10 + combo * 5}`,
      0x38ef7d,
    );

    if (combo > 1) {
      showFeedback(
        scene,
        player.x,
        player.y - 80,
        `${combo}x COMBO!`,
        0xffeb3b,
      );
    }

    // Particles
    if (emitter) {
      emitter.setPosition(player.x, player.y);
      emitter.setParticleTint(0x38ef7d);
      emitter.explode(10);
    }

    generateQuestion();

    // Clear other stars to prevent confusion
    stars.getChildren().forEach((s) => {
      if (s.getData("text")) s.getData("text").destroy();
      s.destroy();
    });
  } else {
    // WRONG!
    combo = 0; // Reset Combo
    score = Math.max(0, score - 5);
    lives--;

    // Play Sound
    try {
      AudioManager.playWrong();
    } catch (e) {}

    // Visuals
    showFeedback(scene, player.x, player.y - 50, "-5", 0xff4444);

    // Particles
    if (emitter) {
      emitter.setPosition(player.x, player.y);
      emitter.setParticleTint(0xff4444);
      emitter.explode(10);
    }

    if (lives <= 0) endGame(scene);
  }

  updateUI();
}

function showFeedback(scene, x, y, text, color) {
  const feedback = scene.add.text(x, y, text, {
    fontFamily: "Orbitron, sans-serif",
    fontSize: "24px",
    fontStyle: "bold",
    color: Phaser.Display.Color.IntegerToColor(color).rgba,
    stroke: "#000",
    strokeThickness: 3,
  });
  feedback.setOrigin(0.5);

  scene.tweens.add({
    targets: feedback,
    y: y - 50,
    alpha: 0,
    duration: 800,
    onComplete: () => feedback.destroy(),
  });
}

function updateUI() {
  scoreDisplay.innerText = score;
  timeDisplay.innerText = timeLeft;

  let hearts = "";
  for (let i = 0; i < lives; i++) hearts += "❤️";
  for (let i = lives; i < 3; i++) hearts += "🖤";
  livesDisplay.innerText = hearts;
}

function updateTimer() {
  if (gameOver) return;
  timeLeft--;
  timeDisplay.innerText = timeLeft;
  if (timeLeft <= 0) endGame(this);
}

function endGame(scene) {
  gameOver = true;
  if (timerEvent) timerEvent.remove();
  if (starSpawnTimer) starSpawnTimer.remove();

  finalScoreEl.innerText = score;
  gameOverModal.classList.remove("hidden");

  // Save Score
  if (socket) {
    socket.emit("simpanSkor", {
      nama: username,
      game: "bintang",
      skor: score,
    });
  }
}
