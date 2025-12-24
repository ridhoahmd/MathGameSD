// public/zuma.js - VERSI FINAL (LOGIKA ARRAY LEVELING + DEBUGGING)

const socket = io(); // Koneksi ke Server
const sfxTembak = new Audio("/explosion.mp3");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const finalScoreEl = document.getElementById("final-score");
const gameOverScreen = document.getElementById("game-over-screen");

// --- GAME STATE GLOBAL ---
let score = 0;
let gameActive = false;
let myName = "";
let myRoom = "";
let lastSpawnTime = 0;
let levelData = {}; // Data config dari AI/Server

// --- VARIABEL LEVELING & WIN CONDITION ---
let currentLevelNumber = 1;
let maxEnemies = 20; // Target musuh per level
let spawnedEnemies = 0; // Musuh yang sudah keluar
let pathPoints = []; // Array koordinat jalur (Dinamis)

// --- SETUP CANVAS RESPONSIF ---
function resizeCanvas() {
  const width = Math.min(window.innerWidth * 0.95, 800);
  const height = width * 0.75; // Rasio 4:3
  canvas.width = width;
  canvas.height = height;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas(); // Init awal

// --- LOGIKA KESULITAN ---
let selectedDifficulty = "mudah";
document.addEventListener("DOMContentLoaded", () => {
  const savedName = localStorage.getItem("playerName");
  if (savedName) document.getElementById("username").value = savedName;

  const buttons = document.querySelectorAll(".btn-difficulty");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      selectedDifficulty = button.dataset.level;
    });
  });
});

// --- OBJEK PLAYER ---
const player = {
  x: canvas.width / 2,
  y: canvas.height * 0.9,
  angle: 0,
  currentAmmo: 0,
  color: "#ff9800",
};
let bullets = [];
let enemies = [];

// --- HELPER FUNCTIONS ---
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function createMathProblem() {
  const a = randomInt(1, 5);
  const b = randomInt(1, 5);
  return { text: `${a} + ${b}`, value: a + b };
}
function getNextAmmo() {
  const activeEnemies = enemies.filter((e) => e.active);
  if (activeEnemies.length > 0)
    return activeEnemies[Math.floor(Math.random() * activeEnemies.length)]
      .value;
  return randomInt(2, 10);
}

// ==========================================
// 1. PATH GENERATOR ENGINE (FIXED: STEPS VARIABLE)
// ==========================================
function generatePath(pola) {
    console.log("🛣️ Mencoba generate pola:", pola); 
    
    let points = [];
    const w = canvas.width;
    const h = canvas.height;
    
    // 🔥 INI YANG HILANG SEBELUMNYA 🔥
    const steps = 300; // Resolusi jalur (Wajib ada disini)
    // --------------------------------

    // Safety Check
    if (w === 0 || h === 0) {
        console.error("❌ Canvas size 0!");
        return [];
    }

    // Handle Pola Acak (Agar tidak lari ke default terus)
    if (pola === "acak") {
        const daftar = ["spiral", "kotak", "lingkaran", "huruf_u", "huruf_s", "garis_lurus"];
        pola = daftar[Math.floor(Math.random() * daftar.length)];
        console.log(`🎲 Pola 'acak' menjadi: ${pola}`);
    }

    switch (pola) {
        case "garis_lurus":
            for (let i = 0; i <= steps; i++) {
                points.push({ x: (i / steps) * w, y: h * 0.2 + (i / steps) * (h * 0.6) });
            }
            break;

        case "lingkaran":
        case "oval":
            const cx = w / 2, cy = h / 2;
            const radius = h * 0.35;
            for (let i = 0; i <= steps; i++) {
                const angle = (i / steps) * Math.PI * 2;
                points.push({
                    x: cx + Math.cos(angle) * radius,
                    y: cy + Math.sin(angle) * radius
                });
            }
            break;

        case "kotak":
            const pad = 50;
            for(let i=0; i<steps/4; i++) points.push({x: pad + (i/(steps/4))*(w-2*pad), y: pad});
            for(let i=0; i<steps/4; i++) points.push({x: w-pad, y: pad + (i/(steps/4))*(h-2*pad)});
            for(let i=0; i<steps/4; i++) points.push({x: w-pad - (i/(steps/4))*(w-2*pad), y: h-pad});
            for(let i=0; i<steps/4; i++) points.push({x: pad, y: h-pad - (i/(steps/4))*(h-2*pad)});
            break;

        case "huruf_u":
        case "balikan":
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                if(t < 0.33) points.push({ x: w*0.15, y: t * 3 * h * 0.8 }); 
                else if (t < 0.66) points.push({ x: w*0.15 + (t-0.33)*3 * w*0.7, y: h*0.8 }); 
                else points.push({ x: w*0.85, y: h*0.8 - (t-0.66)*3 * h * 0.8 }); 
            }
            break;

        case "huruf_s":
        case "gelombang":
        case "ular":
            for (let i = 0; i <= steps; i++) {
                const x = (i / steps) * w;
                const y = (h / 3) + Math.sin((i / steps) * Math.PI * 4) * (h * 0.2);
                points.push({ x: x, y: y });
            }
            break;

        case "spiral":
        default: 
            if (pola !== "spiral") console.warn(`⚠️ Pola '${pola}' fallback ke Spiral.`);
            const centerX = w / 2;
            const centerY = h / 2;
            for (let i = 0; i <= steps; i++) {
                const angle = 0.1 * i;
                const r = 10 + 1.8 * i; 
                if (r < w/2) {
                    points.push({
                        x: centerX + r * Math.cos(angle),
                        y: centerY + r * Math.sin(angle)
                    });
                }
            }
            points.reverse(); 
            break;
    }
    return points;
}

// --- CLASS BULLET & ENEMY ---
class Bullet {
  constructor(x, y, angle, value) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * 12;
    this.vy = Math.sin(angle) * 12;
    this.value = value;
    this.radius = 15;
    this.active = true;
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
    ctx.fillStyle = "#ffeb3b";
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.stroke();
    ctx.fillStyle = "black";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.value, this.x, this.y);
  }
}

class Enemy {
  constructor() {
    this.pathIndex = 0;
    this.x = pathPoints.length > 0 ? pathPoints[0].x : 0;
    this.y = pathPoints.length > 0 ? pathPoints[0].y : 0;

    // Kecepatan adaptif
    let baseSpeed =
      levelData.speed === "cepat"
        ? 1.5
        : levelData.speed === "lambat"
        ? 0.5
        : 1.0;
    this.speed = baseSpeed;

    this.radius = 25;
    const problem = createMathProblem();
    this.text = problem.text;
    this.value = problem.value;
    this.active = true;
    this.color = levelData.palet_warna
      ? levelData.palet_warna[randomInt(0, levelData.palet_warna.length - 1)]
      : "#e91e63";
  }
  update() {
    const target = pathPoints[Math.floor(this.pathIndex + 1)];
    if (!target) {
      endGame();
      return;
    }
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < this.speed) {
      this.pathIndex += this.speed;
    } else {
      this.x += (dx / distance) * this.speed;
      this.y += (dy / distance) * this.speed;
    }
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "white";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.text, this.x, this.y);
  }
}

// ==========================================
// 2. GAME FLOW (UPDATE A: HANDLING ARRAY)
// ==========================================

function startGameMultiplayer() {
  const nameInput = document.getElementById("username").value;
  const roomInput = document.getElementById("room-code").value;

  if (nameInput.trim() === "") {
    alert("Silakan isi Nama Pilot dulu!");
    return;
  }

  myName = nameInput;
  if (roomInput.trim() === "") {
    myRoom = "solo_" + myName + "_" + Math.floor(Math.random() * 10000);
  } else {
    myRoom = roomInput;
  }

  socket.emit("joinRoom", { username: myName, room: myRoom });

  currentLevelNumber = 1;
  requestLevelData();
}

function requestLevelData() {
  document.getElementById(
    "login-screen"
  ).innerHTML = `<h2 style='color:white;'>🛸 Memuat Level ${currentLevelNumber}...</h2>`;

  // Minta soal ke server
  socket.emit("mintaSoalAI", {
    kategori: "zuma",
    tingkat: selectedDifficulty,
  });
}

// 🔥 INI BAGIAN UTAMA PERBAIKANNYA 🔥
socket.on("soalDariAI", (data) => {
  console.log("📦 PAKET DITERIMA:", data); // Debug Log

  if (data.kategori === "zuma") {
    let info = data.data;

    // Cek apakah data berupa Array (Banyak Level)
    if (Array.isArray(info)) {
      console.log(
        `✅ Data Array terdeteksi. Mengambil Level ${currentLevelNumber}`
      );

      // Ambil index level yang sesuai (dikurangi 1 karena array mulai dari 0)
      let index = currentLevelNumber - 1;

      // Safety: Jika level melebihi jumlah data, loop kembali
      if (index >= info.length) index = index % info.length;

      levelData = info[index];
    } else {
      console.warn("⚠️ Data Object Tunggal terdeteksi (Fallback Mode).");
      levelData = info;
    }

    console.log("⚙️ CONFIG LEVEL AKTIF:", levelData);

    // Setup UI
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("game-hud").style.display = "block";
    const bgColors = levelData.palet_warna || ["#000", "#333"];
    document.getElementById(
      "game-container"
    ).style.background = `linear-gradient(135deg, ${bgColors[0]}, ${bgColors[1]})`;

    // GENERATE JALUR
    pathPoints = generatePath(levelData.pola || "spiral");

    // Debug Jalur
    if (pathPoints.length === 0)
      console.error("❌ ERROR: Path kosong! Cek fungsi generatePath.");

    // Reset Player
    player.x = canvas.width / 2;
    player.y = canvas.height * 0.9;

    alert(`LEVEL ${currentLevelNumber}: ${levelData.deskripsi || "Mulai!"}`);
    initGameEngine();
  }
});

function initGameEngine() {
  score = 0; 
  bullets = [];
  enemies = [];
  scoreEl.innerText = score;
  
  // Win Condition
  spawnedEnemies = 0;
  maxEnemies = 15 + (currentLevelNumber * 5); 
  
  player.currentAmmo = randomInt(2, 10);
  // Safety check warna
  player.color = (levelData.palet_warna && levelData.palet_warna.length > 0) 
                 ? levelData.palet_warna[0] 
                 : "#ff9800";
  
  gameActive = true;

  // 🔥 PERBAIKAN UTAMA: KURANGI WAKTU AGAR LANGSUNG SPAWN
  // Kita set waktu terakhir spawn ke "Masa Lalu" (misal 5 detik lalu)
  // Jadi saat update() jalan pertama kali, selisihnya sudah > spawnRate
  lastSpawnTime = Date.now() - 5000; 
  
  requestAnimationFrame(update);
}

// ==========================================
// 3. UPDATE LOOP (UPDATE B: DEBUGGING SPAWN)
// ==========================================
function update(timestamp) {
  if (!gameActive) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // --- 🔥 FIX WAKTU: Gunakan Date.now() agar sinkron dengan initGameEngine ---
  const now = Date.now(); 
  // --------------------------------------------------------------------------

  // Gambar Jalur
  if (pathPoints.length > 0) {
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (let i = 1; i < pathPoints.length; i++)
      ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 40;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillStyle = "red";
    ctx.fillText("ERROR: PATH TIDAK DITEMUKAN", 50, 50);
  }

  // LOGIKA SPAWN + DEBUG
  // LOGIKA SPAWN + DEBUG
  let currentSpawnRate = levelData.speed === "cepat" ? 2000 : 3500;
  
  // Karena kita sudah manipulasi lastSpawnTime di init, ini harusnya TRUE sekarang
  if (now - lastSpawnTime > currentSpawnRate && spawnedEnemies < maxEnemies) {
    
    // Validasi Path sebelum spawn
    if (pathPoints && pathPoints.length > 0) {
        console.log(`🚀 SPAWNING ENEMY NO. ${spawnedEnemies + 1}`); // Log Munculnya Musuh
        
        enemies.push(new Enemy());
        spawnedEnemies++; 
        lastSpawnTime = now;
    } else {
        console.error("❌ Gagal Spawn: PathPoints kosong atau undefined!");
    }
    
    if (enemies.length === 1) player.currentAmmo = enemies[0].value;
  }

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

  if (spawnedEnemies >= maxEnemies && enemies.length === 0) {
    levelComplete();
    return;
  }

  requestAnimationFrame(update);
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(0, -15, 60, 30);
  ctx.rotate(-player.angle);
  ctx.fillStyle = "white";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(player.currentAmmo, 0, 0);
  ctx.restore();
}

function checkCollisions() {
  bullets.forEach((bullet) => {
    enemies.forEach((enemy) => {
      if (!bullet.active || !enemy.active) return;
      const dist = Math.sqrt(
        (bullet.x - enemy.x) ** 2 + (bullet.y - enemy.y) ** 2
      );

      if (dist < bullet.radius + enemy.radius + 10) {
        bullet.active = false;
        if (bullet.value === enemy.value) {
          enemy.active = false;
          score += 10;
          AudioManager.playCorrect();
          scoreEl.innerText = score;
          socket.emit("simpanSkor", { skor: score, room: myRoom });
          player.currentAmmo = getNextAmmo();
        }
      }
    });
  });
}

function levelComplete() {
  gameActive = false;
  AudioManager.playWin();

  setTimeout(() => {
    alert(
      `🎉 LEVEL ${currentLevelNumber} SELESAI!\nSiap lanjut ke level berikutnya?`
    );
    currentLevelNumber++;
    requestLevelData();
  }, 500);
}

function endGame() {
  if (!gameActive) return;
  gameActive = false;
  finalScoreEl.innerText = score;
  gameOverScreen.style.display = "block";
  socket.emit("simpanSkor", { nama: myName, skor: score, game: "zuma" });
  AudioManager.playWin();
}

socket.on("updateSkorLawan", (skorLawan) => {
  document.getElementById("opponent-score").innerText = skorLawan;
});

// ==========================================
// 4. INPUT HANDLER & RECONNECT
// ==========================================

function getMousePos(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
  const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

canvas.addEventListener("mousemove", (e) => {
  if (!gameActive) return;
  const pos = getMousePos(canvas, e);
  player.angle = Math.atan2(pos.y - player.y, pos.x - player.x);
});

canvas.addEventListener("mousedown", (e) => {
  handleInput(e);
});

canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    handleInput(e);
  },
  { passive: false }
);

function handleInput(e) {
  if (!gameActive) return;
  const pos = getMousePos(canvas, e);
  player.angle = Math.atan2(pos.y - player.y, pos.x - player.x);

  try {
    if (typeof AudioManager !== "undefined") AudioManager.playTone(600, 0, 0.1);
    sfxTembak.currentTime = 0;
    sfxTembak.play();
  } catch (err) {}

  bullets.push(
    new Bullet(player.x, player.y, player.angle, player.currentAmmo)
  );
  setTimeout(() => {
    player.currentAmmo = getNextAmmo();
  }, 100);
}

function createOfflineUI() {
  if (document.getElementById("connection-overlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "connection-overlay";
  overlay.innerHTML = `<div class="wifi-icon">📡</div><div class="conn-text">KONEKSI TERPUTUS</div><div class="conn-sub">Mencoba menghubungkan kembali...</div>`;
  document.body.appendChild(overlay);
}
createOfflineUI();

let isReconnecting = false;
let wasPlaying = false;

socket.on("disconnect", (reason) => {
  console.log("⚠️ Koneksi putus:", reason);
  isReconnecting = true;
  wasPlaying = gameActive;
  const overlay = document.getElementById("connection-overlay");
  if (overlay) overlay.style.display = "flex";
  if (typeof gameActive !== "undefined") gameActive = false;
});

socket.on("connect", () => {
  if (isReconnecting) {
    console.log("✅ Terhubung kembali!");
    isReconnecting = false;
    const overlay = document.getElementById("connection-overlay");
    if (overlay) overlay.style.display = "none";
    if (wasPlaying) {
      gameActive = true;
      requestAnimationFrame(update);
    }
  }
});
