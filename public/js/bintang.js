// ============================================
// TANGKAP BINTANG - PHASER GAME
// Educational Math Game with Phaser 3
// ============================================

// Socket connection for score saving
const socket = io();
const username = localStorage.getItem("playerName") || "Guest";

// Game Configuration
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
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
    autoCenter: Phaser.Scale.CENTER_BOTH,
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

// DOM Elements
const scoreDisplay = document.getElementById("score-display");
const livesDisplay = document.getElementById("lives-display");
const timeDisplay = document.getElementById("time-display");
const questionText = document.getElementById("question-text");
const gameOverModal = document.getElementById("game-over-modal");
const finalScoreEl = document.getElementById("final-score");

// Initialize Phaser Game
const game = new Phaser.Game(config);

// Preload - No external assets needed
function preload() {
  // Create graphics textures programmatically
  this.load.on("complete", () => {
    console.log("🎮 Tangkap Bintang loaded!");
  });
}

// Create Game Objects
function create() {
  // Background gradient
  const bg = this.add.graphics();
  bg.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a1a3e, 0x1a1a3e, 1);
  bg.fillRect(0, 0, 800, 600);

  // Add stars background decoration
  for (let i = 0; i < 50; i++) {
    const x = Phaser.Math.Between(0, 800);
    const y = Phaser.Math.Between(0, 600);
    const size = Phaser.Math.Between(1, 3);
    const star = this.add.circle(x, y, size, 0xffffff, 0.3);

    // Twinkle animation
    this.tweens.add({
      targets: star,
      alpha: { from: 0.1, to: 0.5 },
      duration: Phaser.Math.Between(1000, 3000),
      yoyo: true,
      repeat: -1,
    });
  }

  // Create player (basket/character) with glow effect
  const playerGraphics = this.make.graphics({ x: 0, y: 0, add: false });
  // Glow effect (outer)
  playerGraphics.fillStyle(0x00f2ff, 0.3);
  playerGraphics.fillRoundedRect(-5, -5, 90, 40, 15);
  // Main body
  playerGraphics.fillStyle(0x00f2ff, 1);
  playerGraphics.fillRoundedRect(0, 0, 80, 30, 10);
  // Inner highlight
  playerGraphics.fillStyle(0x00b4d8, 1);
  playerGraphics.fillRoundedRect(5, 5, 70, 20, 8);
  // Center glow
  playerGraphics.fillStyle(0xffffff, 0.5);
  playerGraphics.fillRoundedRect(15, 8, 50, 5, 3);
  playerGraphics.generateTexture("player", 90, 40);

  player = this.physics.add.sprite(400, 550, "player");
  player.setCollideWorldBounds(true);
  player.setImmovable(true);

  // Add glow animation to player
  this.tweens.add({
    targets: player,
    alpha: { from: 0.85, to: 1 },
    duration: 800,
    yoyo: true,
    repeat: -1,
  });

  // Create star texture
  const starGraphics = this.make.graphics({ x: 0, y: 0, add: false });
  starGraphics.fillStyle(0xffeb3b, 1);
  drawStar(starGraphics, 25, 25, 5, 25, 12);
  starGraphics.generateTexture("star", 50, 50);

  // Wrong star texture (red)
  const wrongStarGraphics = this.make.graphics({ x: 0, y: 0, add: false });
  wrongStarGraphics.fillStyle(0xff4444, 1);
  drawStar(wrongStarGraphics, 25, 25, 5, 25, 12);
  wrongStarGraphics.generateTexture("wrongStar", 50, 50);

  // Stars group
  stars = this.physics.add.group();

  // Collision detection
  this.physics.add.overlap(player, stars, collectStar, null, this);

  // Input
  cursors = this.input.keyboard.createCursorKeys();

  // Touch/Mouse controls for mobile
  this.input.on("pointermove", (pointer) => {
    if (!gameOver) {
      player.x = Phaser.Math.Clamp(pointer.x, 40, 760);
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

  // Spawn stars periodically
  starSpawnTimer = this.time.addEvent({
    delay: 1500,
    callback: spawnStar,
    callbackScope: this,
    loop: true,
  });

  // Spawn initial stars
  for (let i = 0; i < 3; i++) {
    this.time.delayedCall(i * 500, spawnStar, [], this);
  }
}

// Update Loop
function update() {
  if (gameOver) return;

  // Keyboard controls
  if (cursors.left.isDown) {
    player.x -= 8;
  } else if (cursors.right.isDown) {
    player.x += 8;
  }

  // Keep player in bounds
  player.x = Phaser.Math.Clamp(player.x, 40, 760);

  // Move stars down
  stars.getChildren().forEach((star) => {
    star.y += star.getData("speed");

    // Update text position
    const text = star.getData("text");
    if (text && text.active) {
      text.x = star.x;
      text.y = star.y;
    }

    // Remove stars that go off screen (including their text)
    if (star.y > 620) {
      if (text) text.destroy();
      star.destroy();
    }
  });
}

// Draw Star Shape
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
  const operations = ["+", "-", "×"];
  const op = operations[Math.floor(Math.random() * operations.length)];

  let a, b;

  switch (op) {
    case "+":
      a = Phaser.Math.Between(1, 20);
      b = Phaser.Math.Between(1, 20);
      correctAnswer = a + b;
      break;
    case "-":
      a = Phaser.Math.Between(10, 30);
      b = Phaser.Math.Between(1, a);
      correctAnswer = a - b;
      break;
    case "×":
      a = Phaser.Math.Between(1, 10);
      b = Phaser.Math.Between(1, 10);
      correctAnswer = a * b;
      break;
  }

  currentQuestion = `${a} ${op} ${b} = ?`;
  questionText.textContent = currentQuestion;
}

// Spawn Star
function spawnStar() {
  if (gameOver) return;

  const x = Phaser.Math.Between(50, 750);
  const isCorrect = Math.random() < 0.4; // 40% chance for correct answer
  const value = isCorrect
    ? correctAnswer
    : correctAnswer + Phaser.Math.Between(-10, 10) || correctAnswer + 1;

  const texture = isCorrect ? "star" : "wrongStar";
  const star = stars.create(x, -30, texture);
  star.setData("value", value);
  star.setData("isCorrect", value === correctAnswer);
  star.setData("speed", Phaser.Math.Between(2, 4));

  // Add number text on star
  const scene = game.scene.scenes[0];
  const text = scene.add.text(x, -30, value.toString(), {
    fontFamily: "Orbitron, sans-serif",
    fontSize: "16px",
    fontStyle: "bold",
    color: "#000",
  });
  text.setOrigin(0.5);
  star.setData("text", text);
}

// Collect Star
function collectStar(player, star) {
  const isCorrect = star.getData("isCorrect");
  const text = star.getData("text");

  if (text) text.destroy();
  star.destroy();

  if (isCorrect) {
    // Correct answer!
    score += 10;
    scoreDisplay.textContent = score;

    // Play sound
    if (typeof AudioManager !== "undefined") {
      AudioManager.playCorrect();
    }

    // Visual feedback
    showFeedback(this, player.x, player.y - 30, "+10", 0x38ef7d);

    // Generate new question
    generateQuestion();

    // Clear remaining stars
    stars.getChildren().forEach((s) => {
      const t = s.getData("text");
      if (t) t.destroy();
      s.destroy();
    });
  } else {
    // Wrong answer
    score = Math.max(0, score - 5);
    lives--;
    scoreDisplay.textContent = score;
    updateLivesDisplay();

    // Play sound
    if (typeof AudioManager !== "undefined") {
      AudioManager.playWrong();
    }

    // Visual feedback
    showFeedback(this, player.x, player.y - 30, "-5", 0xff4444);

    if (lives <= 0) {
      endGame(this);
    }
  }
}

// Show Feedback Text
function showFeedback(scene, x, y, text, color) {
  const feedback = scene.add.text(x, y, text, {
    fontFamily: "Orbitron, sans-serif",
    fontSize: "24px",
    fontStyle: "bold",
    color: Phaser.Display.Color.IntegerToColor(color).rgba,
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

// Update Timer
function updateTimer() {
  if (gameOver) return;

  timeLeft--;
  timeDisplay.textContent = timeLeft;

  if (timeLeft <= 0) {
    endGame(this);
  }
}

// Update Lives Display
function updateLivesDisplay() {
  let hearts = "";
  for (let i = 0; i < lives; i++) {
    hearts += "❤️";
  }
  for (let i = lives; i < 3; i++) {
    hearts += "🖤";
  }
  livesDisplay.textContent = hearts;
}

// End Game
function endGame(scene) {
  gameOver = true;

  // Stop timers
  if (timerEvent) timerEvent.remove();
  if (starSpawnTimer) starSpawnTimer.remove();

  // Show final score
  finalScoreEl.textContent = score;
  gameOverModal.classList.remove("hidden");

  // Save score to server
  socket.emit("simpanSkor", {
    nama: username,
    game: "bintang",
    skor: score,
  });

  console.log("🌟 Game Over! Score:", score);
}
