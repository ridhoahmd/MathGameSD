// public/zuma.js - VERSI LENGKAP DAN SUDAH DIPERBAIKI
const socket = io();
const sfxTembak = new Audio('/explosion.mp3');
const sfxLedakan = new Audio('/explosion.mp3');

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

// --- LOGIKA KESULITAN ---
let selectedDifficulty = 'mudah'; // Nilai default
document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.btn-difficulty');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            selectedDifficulty = button.dataset.level;
        });
    });
});

// --- DATA LEVEL LOKAL ---
const levels = [
    { tema: "Hutan", deskripsi: "Hentikan invasi serangga!", palet_warna: ["#228B22", "#90EE90", "#FFD700", "#8B4513"], speed: 'lambat' },
    { tema: "Lautan", deskripsi: "Jaga mutiara dari ular laut!", palet_warna: ["#00BFFF", "#20B2AA", "#F0FFFF", "#4682B4"], speed: 'sedang' },
    { tema: "Gurun", deskripsi: "Badai pasir mendekati oasis!", palet_warna: ["#EDC9AF", "#F4A460", "#D2691E", "#8B7355"], speed: 'cepat' }
];

// --- OBJEK DAN VARIABEL GAME ---
const pathPoints = [
    {x: 50, y: 50}, {x: 750, y: 50}, {x: 750, y: 500},
    {x: 50, y: 500}, {x: 50, y: 300}, {x: 400, y: 300}
];
const player = { x: 400, y: 550, angle: 0, currentAmmo: 0, color: '#ff9800' };
let bullets = [];
let enemies = [];

// --- FUNGSI-FUNGSI HELPER ---
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

// --- KELAS BULLET ---
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

// --- KELAS ENEMY ---
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
            endGame(); // Panggil fungsi endGame
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

// --- FUNGSI UTAMA GAME ---
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

    // --- LANGSUNG MULAI GAME ---
    applyAIDataToGame();
}

function applyAIDataToGame() {
    // Pilih level acak
    const levelData = levels[Math.floor(Math.random() * levels.length)];
    console.log("Menggunakan level Zuma lokal:", levelData);

    // 1. Ubah warna player
    player.color = levelData.palet_warna[0];

    // 2. Tampilkan deskripsi level
    const descEl = document.getElementById('level-description');
    if(descEl) {
        descEl.innerText = levelData.deskripsi;
    }

    // 3. Ubah background
    const gameContainer = document.getElementById('game-container');
    if(gameContainer) {
        gameContainer.style.background = `linear-gradient(135deg, ${levelData.palet_warna[1]}, ${levelData.palet_warna[2]})`;
    }
    
    // 4. Terapkan tingkat kesulitan ke variabel game
    if (levelData.speed === 'lambat') { spawnRate = 5000; }
    else if (levelData.speed === 'sedang') { spawnRate = 4000; }
    else if (levelData.speed === 'cepat') { spawnRate = 2500; }

    // Reset game state
    score = 0;
    bullets = [];
    enemies = [];
    scoreEl.innerText = score;
    player.currentAmmo = randomInt(2, 10);

    // 5. Mulai game loop
    gameActive = true;
    requestAnimationFrame(update);
}

function update(timestamp) {
    if (!gameActive) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Gambar path
    ctx.beginPath(); ctx.moveTo(pathPoints[0].x, pathPoints[0].y); for (let i = 1; i < pathPoints.length; i++) ctx.lineTo(pathPoints[i].x, pathPoints[i].y); ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 10; ctx.setLineDash([20, 20]); ctx.stroke(); ctx.setLineDash([]);
    
    // Spawn musuh
    if (timestamp - lastSpawnTime > spawnRate) { enemies.push(new Enemy()); lastSpawnTime = timestamp; if (enemies.length === 1) player.currentAmmo = enemies[0].value; }
    
    // Update dan gambar musuh
    enemies = enemies.filter(e => e.active); enemies.forEach(e => { e.update(); e.draw(); });
    
    // Update dan gambar peluru
    bullets = bullets.filter(b => b.active); bullets.forEach(b => { b.update(); b.draw(); });
    
    // Cek tabrakan
    checkCollisions();
    
    // Gambar player
    ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(player.angle); ctx.fillStyle = player.color; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(0, -15, 70, 30); ctx.rotate(-player.angle); ctx.fillStyle = 'white'; ctx.font = 'bold 28px Arial'; ctx.fillText(player.currentAmmo, 0, 0); ctx.restore();
    
    requestAnimationFrame(update);
}

function checkCollisions() {
    bullets.forEach(bullet => {
        enemies.forEach(enemy => {
            if (!bullet.active || !enemy.active) return;
            const dist = Math.sqrt((bullet.x - enemy.x)**2 + (bullet.y - enemy.y)**2);
            if (dist < bullet.radius + enemy.radius + 30) {
                bullet.active = false; 
                if (bullet.value === enemy.value) {
                    enemy.active = false; 
                    score += 10;
                    scoreEl.innerText = score;
                    socket.emit('laporSkor', { skor: score, room: myRoom });
                    player.currentAmmo = getNextAmmo();
                } 
            }
        });
    });
}

function endGame() {
    gameActive = false;
    // Kirim skor ke server
    socket.emit('simpanSkor', {
        nama: myName,
        skor: score,
        game: 'zuma'
    });
    console.log(`Melaporkan skor ${score} untuk game zuma ke server.`);
}

// --- EVENT LISTENER CANVAS ---
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

// --- FUNGSI HELPER UNTUK SCRIPT DI BAWAH ---
const saved = localStorage.getItem("playerName");
if(saved) document.getElementById('username').value = saved;

const oriStart = window.startGameMultiplayer;
window.startGameMultiplayer = function() {
    oriStart();
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-hud').style.display = 'block';
}