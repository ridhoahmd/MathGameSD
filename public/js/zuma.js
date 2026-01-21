const sfxTembak = new Audio("/explosion.mp3");
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const finalScoreEl = document.getElementById("final-score");
const opponentScoreEl = document.getElementById("opponent-score");
const gameOverScreen = document.getElementById("game-over-screen");
const targetEl = document.getElementById("target-count");

let score = 0;
let gameActive = false;
let animationId;
let myName = "";
let myRoom = "";
let lastSpawnTime = 0;
let levelData = {};
let currentLevelNumber = 1;
let maxEnemies = 20;
let spawnedEnemies = 0;
let pathPoints = [];
let bullets = [];
let enemies = [];
let selectedDifficulty = "mudah";
const player = { x: 0, y: 0, angle: 0, currentAmmo: 1, color: "#ff9800" };

// Resizer
function resizeCanvas() {
  const width = Math.min(window.innerWidth * 0.95, 800);
  const height = width * 0.75;
  canvas.width = width;
  canvas.height = height;
  player.x = width / 2;
  player.y = height * 0.9;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Init
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

// --- 1. KONEKSI SERVER & START ---
function startGameMultiplayer() {
  const nameInput = document.getElementById("username");
  const roomInput = document.getElementById("room-code");

  if (!nameInput || nameInput.value.trim() === "") {
    alert("Isi nama dulu!");
    return;
  }

  myName = nameInput.value;
  localStorage.setItem("playerName", myName);

  if (window.socket) {
    console.log("🔄 Re-Login Session Zuma...");
    window.socket.emit("mintaDataProfil", myName);
    window.socket.emit("mulaiGame", "zuma");

    // Join Room
    let room = roomInput ? roomInput.value.trim() : "";
    if (room === "")
      room = "solo_" + myName + "_" + Math.floor(Math.random() * 1000);
    myRoom = room;
    window.socket.emit("joinRoom", { username: myName, room: myRoom });

    currentLevelNumber = 1;
    requestLevelData();
  } else {
    alert("Koneksi Server Terputus!");
  }
}

function requestLevelData() {
  const loginScreen = document.getElementById("login-screen");
  if (loginScreen)
    loginScreen.innerHTML = `<h2 style='color:white;'>🛸 Memuat Level ${currentLevelNumber}...</h2>`;

  if (window.socket) {
    console.log(`📡 Request Zuma Level: ${currentLevelNumber}`);
    window.socket.emit("mintaSoalAI", {
      kategori: "zuma",
      tingkat: selectedDifficulty,
    });
  }
}

// --- 2. HANDLER DATA SERVER ---
if (window.socket) {
  window.socket.on("soalDariAI", (data) => {
    if (data.kategori === "zuma") {
      console.log("✅ Config Zuma Diterima:", data.data);

      let info = data.data;

      if (Array.isArray(info) && info.length > 0) {
        let index = (currentLevelNumber - 1) % info.length;
        levelData = info[index];
      } else if (info && typeof info === "object") {
        levelData = info;
      } else {
        levelData = { pola: "spiral", speed: "sedang" };
      }

      // UI Switch
      document.getElementById("login-screen").style.display = "none";
      document.getElementById("game-hud").style.display = "block";

      // Generate Path
      pathPoints = generatePath(levelData.pola || "spiral");

      initGameEngine();
    }
  });

  // Terima Update Skor Lawan (PvP)
  window.socket.on("updateOpponentScore", (skorLawan) => {
    if (opponentScoreEl) opponentScoreEl.innerText = skorLawan;
  });
}

// --- 3. GAME ENGINE INIT ---
function initGameEngine() {
  scoreEl.innerText = score;
  bullets = [];
  enemies = [];

  spawnedEnemies = 0;
  maxEnemies = 15 + currentLevelNumber * 5;

  // Update Target Awal
  if (targetEl) targetEl.innerText = `${spawnedEnemies}/${maxEnemies}`;

  // [FIX] Ammo Tidak Boleh 0
  player.currentAmmo = Math.floor(Math.random() * 9) + 1;

  gameActive = true;
  lastSpawnTime = Date.now() - 5000;

  if (animationId) cancelAnimationFrame(animationId);
  update();
}

// --- 4. GAME LOOP ---
function update() {
  if (!gameActive) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Gambar Jalur
  if (pathPoints.length > 0) {
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (let i = 1; i < pathPoints.length; i++)
      ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 30;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // Spawn Enemy
  const now = Date.now();
  let spawnRate =
    levelData.speed && levelData.speed.toLowerCase() === "cepat" ? 1500 : 3000;

  if (now - lastSpawnTime > spawnRate && spawnedEnemies < maxEnemies) {
    if (pathPoints.length > 0) {
      enemies.push(new Enemy());

      spawnedEnemies++;

      // Update Target Counter
      if (targetEl) {
        targetEl.innerText = `${spawnedEnemies}/${maxEnemies}`;
        targetEl.parentElement.classList.remove("target-update");
        void targetEl.parentElement.offsetWidth;
        targetEl.parentElement.classList.add("target-update");
      }

      lastSpawnTime = now;
      if (enemies.length === 1) player.currentAmmo = enemies[0].value;
    }
  }

  // Update Entities
  enemies = enemies.filter((e) => e.active);
  enemies.forEach((e) => {
    e.update();
    e.draw();
  });

  bullets = bullets.filter((b) => b.active);
  bullets.forEach((b) => {
    b.update();
    b.draw();
  });

  checkCollisions();
  drawPlayer();

  // Cek Level Selesai (Menang)
  if (spawnedEnemies >= maxEnemies && enemies.length === 0) {
    gameActive = false;
    setTimeout(() => {
      alert(`🎉 LEVEL ${currentLevelNumber} SELESAI!`);
      currentLevelNumber++;
      requestLevelData();
    }, 500);
    return;
  }

  animationId = requestAnimationFrame(update);
}

// --- 5. CLASSES ---
class Enemy {
  constructor() {
    this.pathIndex = 0;
    this.x = pathPoints[0].x;
    this.y = pathPoints[0].y;
    this.speed =
      levelData.speed && levelData.speed.toLowerCase() === "cepat" ? 1.5 : 1.0;
    this.radius = 20;
    this.active = true;

    // Soal Matematika
    const a = Math.floor(Math.random() * 5) + 1;
    const b = Math.floor(Math.random() * 5) + 1;
    this.text = `${a}+${b}`;
    this.value = a + b;

    // Warna
    const palette = levelData.palet_warna || ["#F00", "#0F0", "#00F"];
    this.color = palette[Math.floor(Math.random() * palette.length)];
  }
  update() {
    const target = pathPoints[Math.floor(this.pathIndex + 1)];
    if (!target) {
      endGame();
      return;
    } // Kalah

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.speed) {
      this.pathIndex += this.speed;
    } else {
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
    }
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.text, this.x, this.y);
  }
}

class Bullet {
  constructor(x, y, angle, val) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * 10;
    this.vy = Math.sin(angle) * 10;
    this.value = val;
    this.active = true;
    this.radius = 12;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (
      this.x < 0 ||
      this.x > canvas.width ||
      this.y < 0 ||
      this.y > canvas.height
    )
      this.active = false;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = "yellow";
    ctx.fill();
    ctx.fillStyle = "black";
    ctx.fillText(this.value, this.x, this.y);
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(0, -10, 50, 20);
  ctx.rotate(-player.angle);
  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.fillText(player.currentAmmo, 0, 0);
  ctx.restore();
}

function checkCollisions() {
  bullets.forEach((b) => {
    enemies.forEach((e) => {
      if (!b.active || !e.active) return;
      const dist = Math.sqrt((b.x - e.x) ** 2 + (b.y - e.y) ** 2);

      if (dist < b.radius + e.radius) {
        b.active = false;

        if (b.value === e.value) {
          e.active = false;
          score += 10;
          scoreEl.innerText = score;

          if (window.socket) {
            window.socket.emit("updateDuelScore", {
              room: myRoom,
              skor: score,
            });
          }

          try {
            AudioManager.playCorrect();
          } catch (e) {}

          const activeEnemies = enemies.filter((en) => en.active);

          if (activeEnemies.length > 0) {
            if (Math.random() < 0.8) {
              const randomEnemy =
                activeEnemies[Math.floor(Math.random() * activeEnemies.length)];
              player.currentAmmo = randomEnemy.value;
            } else {
              player.currentAmmo = Math.floor(Math.random() * 9) + 1;
            }
          } else {
            player.currentAmmo = Math.floor(Math.random() * 9) + 1;
          }
        } else {
        }
      }
    });
  });
}

// --- 6. PATH GENERATOR (POLYGLOT VERSION) ---
function generatePath(pola) {
  let points = [];
  const w = canvas.width;
  const h = canvas.height;
  const steps = 400;

  pola = pola ? pola.toLowerCase().replace(/\s+/g, "_") : "spiral";
  console.log("🛠️ Generasi Pola:", pola);

  // SPIRAL / LINGKARAN
  if (pola.includes("spiral") || pola.includes("lingkaran")) {
    const cx = w / 2,
      cy = h / 2;
    for (let i = 0; i <= steps; i++) {
      const angle = 0.1 * i;
      const r = 10 + 1.5 * i;
      if (r < w / 2)
        points.push({
          x: cx + r * Math.cos(angle),
          y: cy + r * Math.sin(angle),
        });
    }
    points.reverse();
  }
  // OVAL / ELIPS
  else if (pola.includes("oval") || pola.includes("elips")) {
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
  }
  // TANGGA / STEPS
  else if (pola.includes("tangga") || pola.includes("steps")) {
    let x = w * 0.1,
      y = h * 0.15;
    const sW = (w * 0.8) / 5,
      sH = (h * 0.7) / 5;
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 20; j++) points.push({ x: x + (j / 20) * sW, y: y });
      x += sW;
      for (let j = 0; j < 20; j++) points.push({ x: x, y: y + (j / 20) * sH });
      y += sH;
    }
  }
  // HURUF U / TAPAL KUDA
  else if (pola.includes("huruf_u") || pola.includes("tapal_kuda")) {
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      let px, py;
      if (t < 0.33) {
        px = w * 0.15;
        py = h * 0.9 - (t / 0.33) * (h * 0.7);
      } else if (t < 0.66) {
        px = w * 0.15 + ((t - 0.33) / 0.33) * (w * 0.7);
        py = h * 0.2;
      } else {
        px = w * 0.85;
        py = h * 0.2 + ((t - 0.66) / 0.34) * (h * 0.7);
      }
      points.push({ x: px, y: py });
    }
  }
  // ZIGZAG
  else if (pola.includes("zigzag")) {
    for (let i = 0; i <= steps; i++)
      points.push({
        x: (i / steps) * w,
        y: h / 2 + Math.sin(i * 0.2) * (h * 0.35),
      });
  }
  // DEFAULT
  else {
    for (let i = 0; i <= steps; i++)
      points.push({
        x: (i / steps) * w,
        y: h * 0.2 + Math.sin(i / 20) * 50 + (i / steps) * (h * 0.6),
      });
  }
  return points;
}

function endGame() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  gameActive = false;
  if (animationId) cancelAnimationFrame(animationId);
  if (gameOverScreen) gameOverScreen.style.display = "flex";
  if (finalScoreEl) finalScoreEl.innerText = score;

  if (window.socket) {
    window.socket.emit("mintaDataProfil", myName);
    window.socket.emit("simpanSkor", {
      nama: myName,
      skor: score,
      game: "zuma",
    });
  }
}

// Input Handlers
window.handleInput = function (e) {
  if (!gameActive) return;
  const rect = canvas.getBoundingClientRect();
  // Support Touch & Mouse
  const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
  const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);

  const x = clientX - rect.left;
  const y = clientY - rect.top;
  player.angle = Math.atan2(y - player.y, x - player.x);

  bullets.push(
    new Bullet(player.x, player.y, player.angle, player.currentAmmo),
  );
  try {
    sfxTembak.currentTime = 0;
    sfxTembak.play();
  } catch (e) {}
};

canvas.addEventListener("mousedown", window.handleInput);
canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    window.handleInput(e);
  },
  { passive: false },
);
canvas.addEventListener("mousemove", (e) => {
  if (!gameActive) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  player.angle = Math.atan2(y - player.y, x - player.x);
});
