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
let isHoveringTurret = false; // Track hover state for visual feedback

// Resizer
function resizeCanvas() {
  // 1. Ambil dimensi layar
  const winW = window.innerWidth;
  const winH = window.innerHeight;

  // 2. Tentukan batasan (Max width 800 desktop, tapi di HP full width)
  let targetW = Math.min(winW, 800);

  // 3. Hitung tinggi ideal (Ratio 4:3 default)
  let targetH = targetW * 0.75;

  // 4. Cek apakah tinggi melebihi layar? (Penting buat HP landscape / pendek)
  // Kurangi 80px buat space UI (Score bar yang floating)
  if (targetH > winH * 0.9) {
    targetH = winH * 0.9;
    // Recalculate width to maintain aspect ratio somewhat, or just crop?
    // Better: Keep logic simple. Just fit height.
    targetW = targetH / 0.75;
  }

  canvas.width = targetW;
  canvas.height = targetH;

  // Update posisi player (selalu di bawah tengah)
  player.x = targetW / 2;
  player.y = targetH * 0.9; // 90% dari atas
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

      // [PERBAIKAN] Ubah 'block' jadi 'flex' agar layout tombol rapi & muncul
      const hud = document.getElementById("game-hud");
      if (hud) {
        hud.style.display = "flex";
        hud.style.zIndex = "9999"; // Paksa tampil paling atas
      }

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

  // 🔧 FIX: Reset canvas dan player position ke center saat level baru
  resizeCanvas();

  gameActive = true;
  lastSpawnTime = Date.now() - 5000;

  if (animationId) cancelAnimationFrame(animationId);
  update();
}

// --- 4. GAME LOOP ---
// --- 3.5 PARTICLE SYSTEM (NEW) ---
const particles = [];
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 1.0; // Opacity
    this.decay = Math.random() * 0.03 + 0.01;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
  }
  draw() {
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }
}

// --- HELPER: DRAW 3D MARBLE ---
function draw3DMarble(x, y, radius, color, text) {
  // 1. Base Shadow
  ctx.beginPath();
  ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fill();

  // 2. Main Sphere (Radial Gradient for 3D)
  const grad = ctx.createRadialGradient(
    x - radius / 3,
    y - radius / 3,
    radius / 10,
    x,
    y,
    radius,
  );
  grad.addColorStop(0, "#fff"); // Highlight
  grad.addColorStop(0.3, color); // Body color
  grad.addColorStop(1, "#000"); // Shadow edge

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // 3. Specular Reflection (Glass Effect)
  ctx.beginPath();
  ctx.ellipse(
    x - radius / 3,
    y - radius / 3,
    radius / 2.5,
    radius / 4,
    Math.PI / 4,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fill();

  // 4. Text
  if (text !== undefined) {
    ctx.fillStyle = "white";
    ctx.font = "bold " + radius * 0.8 + "px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "black";
    ctx.shadowBlur = 4;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  }
}

// --- 4. GAME LOOP ---
function update() {
  if (!gameActive) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // GAMBAR JALUR (TRACK GROOVE EFFECT)
  if (pathPoints.length > 0) {
    // Outer Glow / Border
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (let i = 1; i < pathPoints.length; i++)
      ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    ctx.strokeStyle = "rgba(0, 242, 255, 0.1)"; // Neon Blue low opacity
    ctx.lineWidth = 40;
    ctx.lineCap = "round";
    ctx.stroke();

    // Inner Groove (Darker)
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 32;
    ctx.stroke();

    // Center Line (Guide)
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 2;
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

  // Update & Draw Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].draw();
    if (particles[i].life <= 0) particles.splice(i, 1);
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

  // Cek Level Selesai
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
    const palette = levelData.palet_warna || [
      "#ff0000",
      "#00ff00",
      "#0000ff",
      "#ffff00",
      "#f0f",
    ];
    this.color = palette[Math.floor(Math.random() * palette.length)];
  }
  update() {
    const target = pathPoints[Math.floor(this.pathIndex + 1)];
    if (!target) {
      endGame();
      return;
    }

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
    draw3DMarble(this.x, this.y, this.radius, this.color, this.text);
  }
}

class Bullet {
  constructor(x, y, angle, val) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * 12; // Slightly faster
    this.vy = Math.sin(angle) * 12;
    this.value = val;
    this.active = true;
    this.radius = 12;
    // Tentukan warna berdasarkan value (agar konsisten)
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
    this.color = colors[val % colors.length];
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
    draw3DMarble(this.x, this.y, this.radius, this.color, this.value);

    // Trail effect
    if (Math.random() < 0.5) {
      particles.push(new Particle(this.x, this.y, this.color));
    }
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  // 🎯 VISUAL HINT: Pulsing Ring untuk indikasi "bisa di-klik"
  const pulseTime = Date.now() / 800;
  const pulseRadius = 50 + Math.sin(pulseTime) * 8;
  const pulseOpacity = 0.3 + Math.sin(pulseTime) * 0.15;

  ctx.beginPath();
  ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(0, 242, 255, ${pulseOpacity})`;
  ctx.lineWidth = isHoveringTurret ? 4 : 2;
  ctx.stroke();

  // Extra glow saat hover
  if (isHoveringTurret) {
    ctx.beginPath();
    ctx.arc(0, 0, pulseRadius + 5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 0, ${pulseOpacity * 0.5})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.rotate(player.angle);

  // MECH TURRET DESIGN

  // Barrel (Laras Meriam)
  ctx.fillStyle = "#444";
  ctx.fillRect(0, -12, 60, 24);

  // Barrel Glow Strip
  ctx.fillStyle = "#00f2ff";
  ctx.fillRect(10, -4, 40, 8); // Neon strip

  // Turret Body (Circle)
  const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, 35);
  grad.addColorStop(0, "#555");
  grad.addColorStop(1, "#222");

  ctx.beginPath();
  ctx.arc(0, 0, 35, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = isHoveringTurret ? "#ffff00" : "#00f2ff"; // Yellow saat hover
  ctx.stroke();

  // Ammo Display (Center) - Render as marble inside turret
  // Kita perlu rotate balik agar teks tidak miring
  ctx.rotate(-player.angle);

  // Draw Ammo Marble in center
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
  let ammoColor = colors[player.currentAmmo % colors.length];

  // Efek Loading (Pulsing)
  let pulse = (Date.now() / 200) % Math.PI;
  let size = 15 + Math.sin(pulse) * 2;

  draw3DMarble(0, 0, size, ammoColor, player.currentAmmo);

  // 🎯 TOOLTIP TEXT saat hover atau permanen sebagai hint
  if (isHoveringTurret || Date.now() % 4000 < 2000) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "black";
    ctx.shadowBlur = 3;
    ctx.fillText("KLIK / SPACE", 0, 45);
    ctx.fillText("TUKAR AMMO", 0, 58);
    ctx.shadowBlur = 0;
  }

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

          // SPAWN PARTICLES (EXPLOSION)
          for (let i = 0; i < 10; i++) {
            particles.push(new Particle(e.x, e.y, e.color));
          }

          if (window.socket) {
            window.socket.emit("updateDuelScore", {
              room: myRoom,
              skor: score,
            });
          }

          try {
            AudioManager.playCorrect();
          } catch (e) {}

          // Smart Ammo Swap Logic (Original)
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
          // Salah tembak? (Mungkin nanti tambah penalti)
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
  const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
  const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);

  const x = clientX - rect.left;
  const y = clientY - rect.top;
  player.angle = Math.atan2(y - player.y, x - player.x);

  // 🔥 FITUR BARU: Swap Ammo saat klik Player/Meriam
  const dist = Math.sqrt((x - player.x) ** 2 + (y - player.y) ** 2);
  if (dist < 60) {
    // Radius klik meriam agak besar biar gampang kena di HP
    swapAmmo();
    return;
  }

  bullets.push(
    new Bullet(player.x, player.y, player.angle, player.currentAmmo),
  );

  try {
    sfxTembak.currentTime = 0;
    sfxTembak.play();
  } catch (e) {}
};

// 🔥 FUNGSI SWAP AMMO CERDAS (ENHANCED)
function swapAmmo() {
  const oldAmmo = player.currentAmmo;

  // Animasi visual kecil
  player.color = "#fff";
  setTimeout(() => (player.color = "#ff9800"), 100);

  // Ambil semua musuh aktif
  const activeEnemies = enemies.filter((e) => e.active);

  if (activeEnemies.length === 0) {
    // Jika tidak ada musuh, random total 1-9
    player.currentAmmo = Math.floor(Math.random() * 9) + 1;
  } else {
    // Coba cari musuh yang nilainya BEDA dengan ammo sekarang
    const differentEnemies = activeEnemies.filter(
      (e) => e.value !== player.currentAmmo,
    );

    if (differentEnemies.length > 0) {
      // Prioritas: Ganti ke ammo yang bisa nembak musuh lain
      const target =
        differentEnemies[Math.floor(Math.random() * differentEnemies.length)];
      player.currentAmmo = target.value;
    } else {
      // Jika semua musuh nilainya SAMA dengan ammo kita sekarang,
      // Kita tetap acak 20% kemungkinan dapat angka random biar gak stuck,
      // tapi 80% tetap pertahankan angka yang berguna itu.
      if (Math.random() < 0.2) {
        player.currentAmmo = Math.floor(Math.random() * 9) + 1;
      } else {
        // Tetap pakai nilai dari salah satu musuh (yang sama)
        player.currentAmmo = activeEnemies[0].value;
      }
    }
  }

  // 🎨 VISUAL FEEDBACK: Particle burst saat swap
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
  for (let i = 0; i < 8; i++) {
    particles.push(
      new Particle(
        player.x,
        player.y,
        colors[player.currentAmmo % colors.length],
      ),
    );
  }

  // 🔊 SOUND EFFECT (gunakan audio yang ada)
  try {
    const swapSfx = new Audio("/explosion.mp3");
    swapSfx.volume = 0.3;
    swapSfx.playbackRate = 1.5; // Lebih cepat untuk swap
    swapSfx.play();
  } catch (e) {}

  // 📊 DEBUG LOG
  console.log(`🔄 Ammo Swapped: ${oldAmmo} → ${player.currentAmmo}`);
}

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

  // 🎯 HOVER DETECTION untuk visual feedback
  const dist = Math.sqrt((x - player.x) ** 2 + (y - player.y) ** 2);
  isHoveringTurret = dist < 60;
  canvas.style.cursor = isHoveringTurret ? "pointer" : "crosshair";
});

// ⌨️ KEYBOARD SHORTCUT: Spacebar untuk swap ammo
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && gameActive) {
    e.preventDefault();
    swapAmmo();
  }
});
