// public/zuma.js - VERSI LENGKAP DENGAN INTEGRASI AI & KEAMANAN

// --- 1. CONFIG SUARA ---
const sfxTembak = new Audio('https://actions.google.com/sounds/v1/cartoon/pop.ogg');
const sfxLedakan = new Audio('/explosion.mp3');

// --- 2. INISIALISASI SOCKET.IO & GAME ---
const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const finalScoreEl = document.getElementById('final-score');
const gameOverScreen = document.getElementById('game-over-screen');

let score = 0;
let gameActive = false;
let myName = "";
let myRoom = "";
let spawnRate = 4000; 
let lastSpawnTime = 0;

// Ambil nama dari localStorage dan isi otomatis
const savedName = localStorage.getItem("playerName");
if (savedName) {
    const inputNama = document.getElementById('username');
    if (inputNama) {
        inputNama.value = savedName;
    }
}

// --- 3. FUNGSI START GAME YANG SUDAH DIPERBAIKI ---
function startGameMultiplayer() {
    const nameInput = document.getElementById('username').value;
    const roomInput = document.getElementById('room-code').value;

    if(nameInput.trim() === "" || roomInput.trim() === "") {
        alert("Isi Nama dan Room dulu!");
        return;
    }
    myName = nameInput;
    myRoom = roomInput;
    socket.emit('joinRoom', { username: myName, room: myRoom });

    // Sembunyikan layar login, tampilkan wadah game
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';

    // Tampilkan pesan loading di canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 30px Orbitron';
    ctx.textAlign = 'center';
    ctx.fillText('🤖 AI sedang menciptakan level...', canvas.width / 2, canvas.height / 2);

    // Minta data level baru ke server
    socket.emit('mintaSoalAI', 'zuma');
}

// Listener untuk menerima data level dari server
socket.on('soalDariAI', (res) => {
    // --- TAMBAHKAN INI UNTUK DIAGNOSTIK ---
    console.log("Data diterima dari server:", res);

    // Pastikan ini data untuk zuma
    if (res.kategori !== 'zuma') return;

    const levelData = res.data;
    console.log("Data level Zuma:", levelData);

    // Terapkan data dari AI ke dalam game
    applyAIDataToGame(levelData);
});

// --- 5. FUNGSI UNTUK MENERAPKAN DATA AI KE GAME ---
function applyAIDataToGame(data) {
    // 1. Ubah warna player dengan warna pertama dari palet
    player.color = data.palet_warna[0];

    // 2. Tampilkan deskripsi level di UI
    const descEl = document.getElementById('level-description');
    if(descEl) {
        descEl.innerText = data.deskripsi;
    }

    // 3. Ubah background game container
    const gameContainer = document.getElementById('game-container');
    if(gameContainer) {
        gameContainer.style.background = `linear-gradient(135deg, ${data.palet_warna[1]}, ${data.palet_warna[2]})`;
    }

    // 4. Mulai game loop
    gameActive = true;
    requestAnimationFrame(update);
}

// --- 6. LISTENER LAINNYA ---
socket.on('updateSkorLawan', (skorLawan) => {
    document.getElementById('opponent-score').innerText = skorLawan;
});

// --- 7. LOGIKA GAME UTAMA (TIDAK BERUBAH) ---
const pathPoints = [
    {x: 50, y: 50}, {x: 750, y: 50}, {x: 750, y: 500},
    {x: 50, y: 500}, {x: 50, y: 300}, {x: 400, y: 300}
];
const player = { x: 400, y: 550, angle: 0, currentAmmo: 0, color: '#ff9800' }; // Warna akan di-override oleh AI
let bullets = [];
let enemies = [];

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function createMathProblem() {
    const a = randomInt(1, 5);
    const b = randomInt(1, 5);
    return { text: `${a} + ${b}`, value: a + b };
}
function getNextAmmo() {
    const activeEnemies = enemies.filter(e => e.active);
    if (activeEnemies.length > 0) return activeEnemies[Math.floor(Math.random() * activeEnemies.length)].value;
    return randomInt(2, 10);
}
player.currentAmmo = randomInt(2, 10);

class Bullet {
    constructor(x, y, angle, value) {
        this.x = x; this.y = y; this.vx = Math.cos(angle) * 12; this.vy = Math.sin(angle) * 12; 
        this.value = value; this.radius = 20; this.active = true;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.active = false;
    }
    draw() {
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fillStyle = '#ffeb3b'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#333'; ctx.stroke(); ctx.fillStyle = 'black'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(this.value, this.x, this.y); ctx.closePath();
    }
}

class Enemy {
    constructor() {
        this.pathIndex = 0; this.x = pathPoints[0].x; this.y = pathPoints[0].y;
        this.speed = 0.3; this.radius = 35; 
        const problem = createMathProblem();
        this.text = problem.text; this.value = problem.value; this.active = true;
    }
    update() {
        const target = pathPoints[this.pathIndex + 1];
        if (!target) {
            gameActive = false;
            finalScoreEl.innerText = score;
            gameOverScreen.style.display = 'block';

            // --- PERUBAHAN: KIRIM SKOR KE SERVER, BUKAN LANGSUNG KE FIREBASE ---
            socket.emit('simpanSkor', {
                nama: myName,
                skor: score,
                game: 'zuma'
            });
            console.log(`Melaporkan skor ${score} untuk game zuma ke server.`);
            return;
        }
        const dx = target.x - this.x; const dy = target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < this.speed) this.pathIndex++;
        else { this.x += (dx / distance) * this.speed; this.y += (dy / distance) * this.speed; }
    }
    draw() {
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fillStyle = '#e91e63'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'white'; ctx.stroke(); ctx.fillStyle = 'white'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(this.text, this.x, this.y); ctx.closePath();
    }
}

canvas.addEventListener('mousemove', (e) => {
    if (!gameActive) return;
    const rect = canvas.getBoundingClientRect();
    player.angle = Math.atan2((e.clientY - rect.top) - player.y, (e.clientX - rect.left) - player.x);
});
canvas.addEventListener('mousedown', () => {
    if (!gameActive) return;
    
    sfxTembak.currentTime = 0;
    sfxTembak.play();

    bullets.push(new Bullet(player.x, player.y, player.angle, player.currentAmmo));
    setTimeout(() => { player.currentAmmo = getNextAmmo(); }, 100);
});
function checkCollisions() {
    bullets.forEach(bullet => {
        enemies.forEach(enemy => {
            if (!bullet.active || !enemy.active) return;
            const dist = Math.sqrt((bullet.x - enemy.x)**2 + (bullet.y - enemy.y)**2);
            if (dist < bullet.radius + enemy.radius + 30) {
                bullet.active = false; 
                if (bullet.value === enemy.value) {
                    enemy.active = false; 
                    
                    sfxLedakan.currentTime = 0;
                    sfxLedakan.play();

                    score += 10;
                    scoreEl.innerText = score;
                    socket.emit('laporSkor', { skor: score, room: myRoom });
                    player.currentAmmo = getNextAmmo();
                } 
            }
        });
    });
}
function update(timestamp) {
    if (!gameActive) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath(); ctx.moveTo(pathPoints[0].x, pathPoints[0].y); for (let i = 1; i < pathPoints.length; i++) ctx.lineTo(pathPoints[i].x, pathPoints[i].y); ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 10; ctx.setLineDash([20, 20]); ctx.stroke(); ctx.setLineDash([]);
    if (timestamp - lastSpawnTime > spawnRate) { enemies.push(new Enemy()); lastSpawnTime = timestamp; if (enemies.length === 1) player.currentAmmo = enemies[0].value; }
    enemies = enemies.filter(e => e.active); enemies.forEach(e => { e.update(); e.draw(); });
    bullets = bullets.filter(b => b.active); bullets.forEach(b => { b.update(); b.draw(); });
    checkCollisions();
    ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(player.angle); ctx.fillStyle = player.color; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(0, -15, 70, 30); ctx.rotate(-player.angle); ctx.fillStyle = 'white'; ctx.font = 'bold 28px Arial'; ctx.fillText(player.currentAmmo, 0, 0); ctx.restore();
    requestAnimationFrame(update);
}