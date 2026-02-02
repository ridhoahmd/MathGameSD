// ============================================
// TEMBAK ANGKA - PHASER VERSION (Hybrid)
// Zuma-style Math Game with Phaser 3
// ============================================

// === SOCKET & STATE (Keep from original) ===
const socket = window.socket;
let myName = localStorage.getItem("playerName") || "Guest";
let myRoom = "";
let score = 0;
let gameActive = false;
let levelData = {};
let currentLevelNumber = 1;
let maxEnemies = 20;
let spawnedEnemies = 0;
let selectedDifficulty = "mudah";

// === DOM ELEMENTS ===
const scoreEl = document.getElementById("score");
const finalScoreEl = document.getElementById("final-score");
const opponentScoreEl = document.getElementById("opponent-score");
const gameOverScreen = document.getElementById("game-over-screen");
const targetEl = document.getElementById("target-count");
const loginScreen = document.getElementById("login-screen");
const gameHud = document.getElementById("game-hud");

// === PHASER CONFIG ===
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
    autoCenter: Phaser.Scale.NO_CENTER,
  },
};

// === PHASER GAME VARIABLES ===
let game;
let pathGraphics;
let pathCurve;
let turret;
let turretBase;
let ammoText;
let marbles;
let bullets;
let particles;
let emitter;
let cursors;
let lastSpawnTime = 0;
let player = { currentAmmo: 5, angle: 0 };

// === DIFFICULTY BUTTONS ===
document.addEventListener("DOMContentLoaded", () => {
  const savedName = localStorage.getItem("playerName");
  if (savedName) {
    const userInput = document.getElementById("username");
    if (userInput) userInput.value = savedName;
  }

  const buttons = document.querySelectorAll(".btn-difficulty");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      selectedDifficulty = button.dataset.level;
    });
  });
});

// === START GAME (Keep original socket logic) ===
window.startGameMultiplayer = function () {
  const nameInput = document.getElementById("username");
  const roomInput = document.getElementById("room-code");

  if (!nameInput || nameInput.value.trim() === "") {
    alert("Isi nama dulu!");
    return;
  }

  myName = nameInput.value;
  localStorage.setItem("playerName", myName);

  if (socket) {
    socket.emit("mintaDataProfil", myName);
    socket.emit("mulaiGame", "zuma");

    let room = roomInput ? roomInput.value.trim() : "";
    if (room === "")
      room = "solo_" + myName + "_" + Math.floor(Math.random() * 1000);
    myRoom = room;
    socket.emit("joinRoom", { username: myName, room: myRoom });

    currentLevelNumber = 1;
    requestLevelData();
  } else {
    alert("Koneksi Server Terputus!");
  }
};

function requestLevelData() {
  if (loginScreen) {
    loginScreen.innerHTML = `<h2 style='color:white;'>🛸 Memuat Level ${currentLevelNumber}...</h2>`;
  }

  if (socket) {
    socket.emit("mintaSoalAI", {
      kategori: "zuma",
      tingkat: selectedDifficulty,
    });
  }
}

// === SOCKET HANDLERS ===
if (socket) {
  socket.on("soalDariAI", (data) => {
    if (data.kategori === "zuma") {
      let info = data.data;

      if (Array.isArray(info) && info.length > 0) {
        let index = (currentLevelNumber - 1) % info.length;
        levelData = info[index];
      } else if (info && typeof info === "object") {
        levelData = info;
      } else {
        levelData = { pola: "spiral", speed: "sedang" };
      }

      // Hide login, show HUD
      if (loginScreen) loginScreen.style.display = "none";
      if (gameOverScreen) {
        gameOverScreen.classList.add("hidden");
        gameOverScreen.style.display = "none";
      }
      if (gameHud) {
        gameHud.style.display = "flex";
        gameHud.style.zIndex = "9999";
      }

      // Initialize Phaser game
      initPhaserGame();
    }
  });

  socket.on("updateOpponentScore", (skorLawan) => {
    if (opponentScoreEl) opponentScoreEl.innerText = skorLawan;
  });
}

// === PHASER INITIALIZATION ===
function initPhaserGame() {
  console.log("Initializing Phaser Game...");
  // Destroy existing game if any
  if (game) {
    game.destroy(true);
  }

  // Reset state
  score = 0;
  spawnedEnemies = 0;
  maxEnemies = 15 + currentLevelNumber * 5;
  player.currentAmmo = Math.floor(Math.random() * 9) + 1;

  if (scoreEl) scoreEl.innerText = score;
  if (targetEl) targetEl.innerText = `${spawnedEnemies}/${maxEnemies}`;

  // Create Phaser game
  game = new Phaser.Game(config);
  gameActive = true;
}

// === PHASER PRELOAD ===
function preload() {
  // Create textures programmatically
  this.load.on("complete", () => {
    console.log("🎮 Tembak Angka Phaser loaded!");
  });
}

// === PHASER CREATE ===
function create() {
  console.log("Create Function Started. OLD Game Active:", gameActive);
  // gameActive = true; // 🔧 FIX: Moved to end of function to prevent race condition
  const scene = this;

  try {
    // Create path graphics
    pathGraphics = this.add.graphics();

    // Generate path based on level data
    const pathPoints = generatePathPoints(
      levelData.pola || "spiral",
      config.width,
      config.height,
    );

    // Draw path
    drawPath(pathGraphics, pathPoints);

    // Create path curve for marble following
    pathCurve = new Phaser.Curves.Spline(pathPoints);

    // Create marble group
    marbles = this.physics.add.group();

    // Create bullet group
    bullets = this.physics.add.group();

    // Create particle emitter
    const particleGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    particleGraphics.fillStyle(0xffffff, 1);
    particleGraphics.fillCircle(4, 4, 4);
    particleGraphics.generateTexture("particle", 8, 8);

    particles = this.add.particles(0, 0, "particle", {
      speed: { min: 50, max: 150 },
      scale: { start: 1, end: 0 },
      lifespan: 500,
      blendMode: "ADD",
      emitting: false,
    });

    // Pre-generate textures
    generateGameTextures(scene);

    // Create turret
    createTurret(scene);

    // Input handling
    this.input.on("pointermove", (pointer) => {
      if (!gameActive) return;
      const angle = Phaser.Math.Angle.Between(
        turret.x,
        turret.y,
        pointer.x,
        pointer.y,
      );
      turret.rotation = angle;
      player.angle = angle;
    });

    this.input.on("pointerdown", (pointer) => {
      if (!gameActive) {
        console.warn("Click ignored: Game Inactive");
        return;
      }

      // Check if clicking on turret (swap ammo)
      const dist = Phaser.Math.Distance.Between(
        pointer.x,
        pointer.y,
        turret.x,
        turret.y,
      );
      if (dist < 50) {
        swapAmmo(scene);
        return;
      }

      // Shoot
      shootBullet(scene, pointer);
    });

    // Keyboard input
    this.input.keyboard.on("keydown-SPACE", () => {
      swapAmmo(scene);
    });

    // Collision detection
    this.physics.add.overlap(bullets, marbles, handleCollision, null, this);

    // Store scene reference
    this.gameScene = scene;

    // Start spawning
    lastSpawnTime = Date.now();

    gameActive = true;
    console.log("Create Function Finished. Game Active Forced to True.");
  } catch (e) {
    console.error("CRITICAL ERROR IN CREATE:", e);
    // Try to recover
    gameActive = true;
  }
}

// === PHASER UPDATE ===
function update() {
  // 🔧 FIX: Safety Check to prevent crash if update runs before init
  if (!gameActive || !marbles || !bullets) {
    return;
  }

  const scene = this;
  const now = Date.now();

  // Spawn marbles
  const spawnRate = levelData.speed === "cepat" ? 1500 : 3000;
  if (now - lastSpawnTime > spawnRate && spawnedEnemies < maxEnemies) {
    spawnMarble(scene);
    lastSpawnTime = now;
  }

  // Update marbles along path
  marbles.getChildren().forEach((marble) => {
    if (!marble.active) return;

    marble.pathProgress += marble.speed;

    if (marble.pathProgress >= 1) {
      // Reached end - game over
      console.warn("Marble reached end! Game Over.");
      endGame();
      return;
    }

    const point = pathCurve.getPoint(marble.pathProgress);
    if (point) {
      marble.x = point.x;
      marble.y = point.y;
      if (marble.valueText) {
        marble.valueText.x = point.x;
        marble.valueText.y = point.y;
      }
    }
  });

  // Update bullets (remove off-screen)
  bullets.getChildren().forEach((bullet) => {
    if (
      bullet.x < 0 ||
      bullet.x > config.width ||
      bullet.y < 0 ||
      bullet.y > config.height
    ) {
      if (bullet.valueText) bullet.valueText.destroy();
      bullet.destroy();
    }
  });

  // Check level complete
  // Safeguarded condition
  if (
    spawnedEnemies > 0 &&
    spawnedEnemies >= maxEnemies &&
    marbles.countActive() === 0
  ) {
    console.warn("Level Complete Triggered!", {
      spawnedEnemies,
      maxEnemies,
      active: marbles.countActive(),
    });
    gameActive = false;
    setTimeout(() => {
      alert(`🎉 LEVEL ${currentLevelNumber} SELESAI!`);
      currentLevelNumber++;
      requestLevelData();
    }, 500);
  }

  // Update ammo display
  if (ammoText) {
    ammoText.setText(player.currentAmmo.toString());
  }
}

// === HELPER FUNCTIONS ===

function generatePathPoints(pola, w, h) {
  let points = [];
  const steps = 100;

  pola = pola ? pola.toLowerCase().replace(/\s+/g, "_") : "spiral";

  if (pola.includes("spiral") || pola.includes("lingkaran")) {
    const cx = w / 2,
      cy = h / 2;
    for (let i = 0; i <= steps; i++) {
      const angle = 0.15 * i;
      const r = 20 + 2 * i;
      if (r < w / 2) {
        points.push({
          x: cx + r * Math.cos(angle),
          y: cy + r * Math.sin(angle),
        });
      }
    }
    points.reverse();
  } else if (pola.includes("zigzag")) {
    for (let i = 0; i <= steps; i++) {
      points.push({
        x: (i / steps) * w,
        y: h / 2 + Math.sin(i * 0.2) * (h * 0.35),
      });
    }
  } else if (pola.includes("oval") || pola.includes("elips")) {
    const cx = w / 2,
      cy = h / 2;
    const rX = w * 0.4,
      rY = h * 0.35;
    for (let i = 0; i <= steps; i++) {
      const prog = 1 - i / steps;
      const ang = (i / steps) * Math.PI * 4;
      points.push({
        x: cx + Math.cos(ang) * (rX * prog),
        y: cy + Math.sin(ang) * (rY * prog),
      });
    }
    points.reverse();
  } else {
    // Default wave
    for (let i = 0; i <= steps; i++) {
      points.push({
        x: (i / steps) * w,
        y: h * 0.2 + Math.sin(i / 20) * 50 + (i / steps) * (h * 0.6),
      });
    }
  }

  return points;
}

function drawPath(graphics, points) {
  // Outer glow
  graphics.lineStyle(40, 0x00f2ff, 0.1);
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    graphics.lineTo(points[i].x, points[i].y);
  }
  graphics.strokePath();

  // Inner groove
  graphics.lineStyle(32, 0x000000, 0.6);
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    graphics.lineTo(points[i].x, points[i].y);
  }
  graphics.strokePath();

  // Center line
  graphics.lineStyle(2, 0xffffff, 0.05);
  graphics.beginPath();
  graphics.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    graphics.lineTo(points[i].x, points[i].y);
  }
  graphics.strokePath();
}

function createTurret(scene) {
  const x = config.width / 2;
  const y = config.height * 0.85;

  // 1. Turret Base (Futuristic Platform)
  turretBase = scene.add.graphics();

  // Outer Ring (Rotating glow)
  turretBase.lineStyle(2, 0x00f2ff, 0.5);
  turretBase.strokeCircle(x, y, 45);

  // Main Body
  turretBase.fillStyle(0x1a1a2e, 1);
  turretBase.fillCircle(x, y, 38);
  turretBase.lineStyle(4, 0x00f2ff, 1);
  turretBase.strokeCircle(x, y, 38);

  // Inner Detail
  turretBase.fillStyle(0x000000, 0.5);
  turretBase.fillCircle(x, y, 20);

  // 2. Turret Barrel (Double Blaster)
  const barrelGraphics = scene.make.graphics({ x: 0, y: 0, add: false });

  // Barrel Body
  barrelGraphics.fillStyle(0x333333, 1);
  barrelGraphics.fillRoundedRect(0, -15, 65, 30, 5);

  // Neon Strips
  barrelGraphics.fillStyle(0x00f2ff, 1);
  barrelGraphics.fillRect(10, -10, 45, 4);
  barrelGraphics.fillRect(10, 6, 45, 4);

  // Muzzle Flash Area
  barrelGraphics.fillStyle(0xffffff, 0.8);
  barrelGraphics.fillRect(60, -12, 4, 24);

  barrelGraphics.generateTexture("barrel", 70, 30);

  turret = scene.add.sprite(x, y, "barrel");
  turret.setOrigin(0.1, 0.5); // Set pivot slightly back

  // Ammo display (Holo-projector style)
  const colors = [
    "#f00",
    "#0f0",
    "#00f",
    "#ff0",
    "#0ff",
    "#f0f",
    "#f80",
    "#8f0",
    "#80f",
  ];

  /* 
     We will create a dynamic sprite for the current ammo orb 
     instead of a static circle, so it matches the 3D marbles 
  */

  // Initial Ammo Text
  ammoText = scene.add
    .text(x, y, player.currentAmmo.toString(), {
      fontFamily: "Orbitron",
      fontSize: "24px",
      fontStyle: "bold",
      color: "#fff",
      shadow: { blur: 5, color: "#000000", fill: true },
    })
    .setOrigin(0.5)
    .setDepth(10);

  // Update ammo visual helper
  updateTurretAmmoVisual(scene);

  // Pulsing animation for the base
  scene.tweens.add({
    targets: turretBase,
    scale: { from: 1, to: 1.05 },
    alpha: { from: 0.8, to: 1 },
    duration: 1000,
    yoyo: true,
    repeat: -1,
  });
}

// Helper to update the orb graphics in the center of turret
function updateTurretAmmoVisual(scene) {
  if (!turret.ammoOrb) {
    turret.ammoOrb = scene.add
      .sprite(turret.x, turret.y, "marble_ff0000")
      .setDepth(9);
  }

  // Get current color key
  const colors = [
    "#f00",
    "#0f0",
    "#00f",
    "#ff0",
    "#0ff",
    "#f0f",
    "#f80",
    "#8f0",
    "#80f",
  ];
  const colorHex = colors[player.currentAmmo % colors.length];
  const textureKey = "marble_" + colorHex.replace("#", "");

  if (scene.textures.exists(textureKey)) {
    turret.ammoOrb.setTexture(textureKey);
    turret.ammoOrb.setScale(0.8);
    turret.ammoOrb.setDepth(200); // 🔧 FIX: High depth to ensure visibility over turret base
    turret.ammoOrb.setVisible(true);
  } else {
    console.error(`❌ Missing Texture for Ammo Orb: ${textureKey}`);
  }
}

function spawnMarble(scene) {
  console.log("Spawning marble...");
  if (!pathCurve) {
    console.error("Path curve missing!");
    return;
  }

  spawnedEnemies++;
  if (targetEl) {
    targetEl.innerText = `${spawnedEnemies}/${maxEnemies}`;
  }

  // Create marble
  const startPoint = pathCurve.getPoint(0);

  // Math question
  const a = Math.floor(Math.random() * 5) + 1;
  const b = Math.floor(Math.random() * 5) + 1;
  const value = a + b;
  const text = `${a}+${b}`;

  // Color palette
  const palette = levelData.palet_warna || [
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffff00",
    "#ff00ff",
  ];
  const colorHex = palette[Math.floor(Math.random() * palette.length)];
  const color = Phaser.Display.Color.HexStringToColor(colorHex).color;

  // Use pre-generated texture based on color
  const textureKey = "marble_" + colorHex.replace("#", "");

  const marble = scene.physics.add.sprite(
    startPoint.x,
    startPoint.y,
    textureKey,
  );
  marble.value = value;
  marble.pathProgress = 0;
  marble.speed = levelData.speed === "cepat" ? 0.002 : 0.001;
  marble.colorHex = colorHex;

  // Value text
  const valueText = scene.add
    .text(startPoint.x, startPoint.y, text, {
      fontFamily: "Arial",
      fontSize: "12px",
      fontStyle: "bold",
      color: "#fff",
      stroke: "#000",
      strokeThickness: 2,
    })
    .setOrigin(0.5);

  marble.valueText = valueText;
  marbles.add(marble);
}

function shootBullet(scene, pointer) {
  console.log("Shooting bullet...");
  const angle = Phaser.Math.Angle.Between(
    turret.x,
    turret.y,
    pointer.x,
    pointer.y,
  );

  const colors = [
    "#f00",
    "#0f0",
    "#00f",
    "#ff0",
    "#0ff",
    "#f0f",
    "#f80",
    "#8f0",
    "#80f",
  ];
  const colorHex = colors[player.currentAmmo % colors.length];
  const color = Phaser.Display.Color.HexStringToColor(colorHex).color;

  // 🔧 FIX: Use Native Circle Shape instead of Texture (Bypassing texture gen issues)
  const bullet = scene.add.circle(turret.x, turret.y, 12, color, 1);
  bullet.setDepth(1000);
  bullet.setVisible(true);
  bullet.setActive(true);
  bullet.value = player.currentAmmo;

  // Add Physics
  scene.physics.add.existing(bullet);

  // Add white glow border (stroke)
  bullet.setStrokeStyle(2, 0xffffff);

  console.log("🔥 BULLET SHAPE SPAWNED:", {
    x: bullet.x,
    y: bullet.y,
    color: colorHex,
    visible: bullet.visible,
    depth: bullet.depth,
    hasBody: !!bullet.body,
  });

  // Update visual immediately after shooting
  if (ammoText) {
    ammoText.setText(player.currentAmmo.toString());
  }

  updateTurretAmmoVisual(scene);

  const speed = 1000;
  // Physics body velocity
  bullet.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

  // Value text
  const valueText = scene.add
    .text(turret.x, turret.y, player.currentAmmo.toString(), {
      fontFamily: "Orbitron",
      fontSize: "16px",
      fontStyle: "bold",
      color: "#fff",
      stroke: "#000",
      strokeThickness: 2,
      shadow: { blur: 2, color: "#000000", fill: true },
    })
    .setOrigin(0.5);

  bullet.valueText = valueText;

  // Update text position
  scene.time.addEvent({
    delay: 16,
    callback: () => {
      if (bullet.active && valueText.active) {
        valueText.x = bullet.x;
        valueText.y = bullet.y;
      }
    },
    loop: true,
  });

  bullets.add(bullet);

  // Play sound
  try {
    AudioManager.playCorrect();
  } catch (e) {}
}

function handleCollision(bullet, marble) {
  if (!bullet.active || !marble.active) return;

  const scene = game.scene.scenes[0];

  if (bullet.value === marble.value) {
    // Correct hit!
    score += 10;
    if (scoreEl) scoreEl.innerText = score;

    // Particles
    if (particles) {
      particles.setPosition(marble.x, marble.y);
      particles.setParticleTint(
        Phaser.Display.Color.HexStringToColor(marble.colorHex || "#ffffff")
          .color,
      );
      particles.explode(15);
    }

    // Cleanup
    if (marble.valueText) marble.valueText.destroy();
    marble.destroy();

    // Send score to opponent
    if (socket) {
      socket.emit("updateDuelScore", { room: myRoom, skor: score });
    }

    try {
      AudioManager.playCorrect();
    } catch (e) {}

    // Smart ammo swap
    const activeMarbles = marbles.getChildren().filter((m) => m.active);
    if (activeMarbles.length > 0 && Math.random() < 0.8) {
      const randomMarble =
        activeMarbles[Math.floor(Math.random() * activeMarbles.length)];
      player.currentAmmo = randomMarble.value;
    } else {
      player.currentAmmo = Math.floor(Math.random() * 9) + 1;
    }

    // Update visuals
    if (scene) {
      updateTurretAmmoVisual(scene);
      if (ammoText) ammoText.setText(player.currentAmmo.toString());
    }
  }

  // Remove bullet
  if (bullet.valueText) bullet.valueText.destroy();
  bullet.destroy();
}

function swapAmmo(scene) {
  const activeMarbles = marbles.getChildren().filter((m) => m.active);

  if (activeMarbles.length === 0) {
    player.currentAmmo = Math.floor(Math.random() * 9) + 1;
  } else {
    const different = activeMarbles.filter(
      (m) => m.value !== player.currentAmmo,
    );
    if (different.length > 0) {
      const target = different[Math.floor(Math.random() * different.length)];
      player.currentAmmo = target.value;
    } else if (Math.random() < 0.2) {
      player.currentAmmo = Math.floor(Math.random() * 9) + 1;
    }
  }

  // Visual feedback
  if (particles && turret) {
    particles.setPosition(turret.x, turret.y);
    particles.explode(8);
  }

  // Update orb visual
  if (scene && turret && turret.ammoOrb) {
    updateTurretAmmoVisual(scene);
  }
  if (ammoText) {
    ammoText.setText(player.currentAmmo.toString());
  }

  try {
    AudioManager.playCorrect();
  } catch (e) {}
}

function endGame() {
  gameActive = false;
  console.log("Showing Game Over Screen");

  if (gameOverScreen) {
    gameOverScreen.classList.remove("hidden");
    gameOverScreen.style.display = "flex"; // Force it
  }
  if (finalScoreEl) finalScoreEl.innerText = score;

  if (socket) {
    socket.emit("mintaDataProfil", myName);
    socket.emit("simpanSkor", {
      nama: myName,
      skor: score,
      game: "zuma",
    });
  }
}

// === RESTART FUNCTION ===
window.restartZuma = function () {
  if (gameOverScreen) {
    gameOverScreen.classList.add("hidden");
    gameOverScreen.style.display = "none";
  }
  score = 0;
  currentLevelNumber = 1;
  requestLevelData();
};

function generateGameTextures(scene) {
  // 1. Generate Bullet Textures (for each color)
  const colors = [
    "#f00",
    "#0f0",
    "#00f",
    "#ff0",
    "#0ff",
    "#f0f",
    "#f80",
    "#8f0",
    "#80f",
  ];

  colors.forEach((colorHex) => {
    const color = Phaser.Display.Color.HexStringToColor(colorHex).color;

    // 1. Bullet Texture (Glowing Orb)
    const bKey = "bullet_" + colorHex.replace("#", "");
    if (!scene.textures.exists(bKey)) {
      const bg = scene.make.graphics({ x: 0, y: 0, add: false });

      // Outer Glow
      bg.fillStyle(color, 0.4);
      bg.fillCircle(12, 12, 12);

      // Core
      bg.fillStyle(color, 1);
      bg.fillCircle(12, 12, 9);

      // Shine
      bg.fillStyle(0xffffff, 0.8);
      bg.fillCircle(8, 8, 3);

      bg.generateTexture(bKey, 24, 24);
    }

    // 2. Marble Texture (3D Glossy Sphere)
    const mKey = "marble_" + colorHex.replace("#", "");
    if (!scene.textures.exists(mKey)) {
      const mg = scene.make.graphics({ x: 0, y: 0, add: false });

      // Drop Shadow (offset)
      mg.fillStyle(0x000000, 0.4);
      mg.fillCircle(24, 24, 20);

      // Base Circle (Darker shade for 3D depth)
      const darkerColor =
        Phaser.Display.Color.IntegerToColor(color).darken(20).color;
      mg.fillStyle(darkerColor, 1);
      mg.fillCircle(22, 22, 20);

      // Gradient Body (Fake gradient via circles)
      mg.fillStyle(color, 1);
      mg.fillCircle(22, 20, 18); // Shifted up slightly

      // Specular Highlight (The "Glossy" look)
      mg.fillStyle(0xffffff, 0.2); // Soft broad display
      mg.fillEllipse(22, 12, 14, 8);

      mg.fillStyle(0xffffff, 0.9); // Sharp specular
      mg.fillCircle(22, 10, 3);

      mg.generateTexture(mKey, 48, 48); // Slightly larger canvas for shadow
    }
  });
}
