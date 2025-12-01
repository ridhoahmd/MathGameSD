// public/game.js - FULL CODE

// --- 1. CONFIG SUARA & FIREBASE ---
const sfxBenar = new Audio('https://actions.google.com/sounds/v1/cartoon/pop.ogg');
const sfxSalah = new Audio('https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg');

const firebaseConfig = {
    apiKey: "AIzaSyApeL2uxjjfsiwtHhCd4mmgWT0biz-nI84",
    authDomain: "mathgamesd.firebaseapp.com",
    // Pastikan ini URL Database Anda yang benar
    databaseURL: "https://mathgamesd-default-rtdb.asia-southeast1.firebasedatabase.app", 
    projectId: "mathgamesd",
    storageBucket: "mathgamesd.firebasestorage.app",
    messagingSenderId: "595640141584",
    appId: "1:595640141584:web:d02523bc844e52550f4795"
};

let database = null;
try {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
} catch (e) { console.log(e); }

// --- KONEKSI SOCKET ---
const socket = io(); 

// 👇👇 KODE BARU DILETAKKAN DI SINI (SETELAH SOCKET) 👇👇
// Cek apakah ada nama yang tersimpan dari Login Google?
const savedName = localStorage.getItem("playerName");
if (savedName) {
    // Jika ada, otomatis isi kolom nama
    const inputNama = document.getElementById('username');
    if (inputNama) {
        inputNama.value = savedName;
        // inputNama.readOnly = true; // Aktifkan ini kalau mau nama tidak bisa diganti
    }
}
// 👆👆 SELESAI PENEMPATANNYA 👆👆


// --- VARIABEL GAME ---
let score = 0;
let currentResult = 0;
let myRoom = ""; 

// --- 2. LOGIKA GAME ---
function startGame() {
    const name = document.getElementById('username').value;
    const room = document.getElementById('room-code').value;

    if(name.trim() === "" || room.trim() === "") {
        alert("Nama dan Kode Kamar harus diisi!");
        return;
    }
    myRoom = room;
    socket.emit('joinRoom', { username: name, room: room });
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    generateQuestion();
}


// generate pertanyaan:
function generateQuestion() {
    // Tampilkan loading
    document.getElementById('question-display').innerText = "🤖 AI sedang berpikir...";
    
    // Minta Server (yang nanti minta ke Gemini)
    socket.emit('mintaSoalAI');
}


socket.on('soalDariAI', (data) => {
    // Tampilkan Soal dari AI
    document.getElementById('question-display').innerText = data.soal;
    
    // Simpan Kunci Jawaban
    currentResult = data.jawaban;
    
    // Reset input
    document.getElementById('answer-input').value = '';
    document.getElementById('answer-input').focus();
});



function checkAnswer() {
    const playerAnswer = parseInt(document.getElementById('answer-input').value);
    
    if (playerAnswer === currentResult) {
        score += 10; 
        sfxBenar.currentTime = 0;
        sfxBenar.play(); // 🔊 SUARA BENAR
        alert("Benar! 🎉");
        socket.emit('laporSkor', { skor: score, room: myRoom }); 
    } else {
        sfxSalah.currentTime = 0;
        sfxSalah.play(); // 🔊 SUARA SALAH
        alert("Salah, coba lagi nanti ya! 😢");
    }
    document.getElementById('score').innerText = score;
    generateQuestion();
}

socket.on('updateSkorLawan', (skorBaruLawan) => {
    document.getElementById('opponent-score').innerText = skorBaruLawan;
});

// --- 3. DOWNLOAD & SIMPAN ---
async function downloadSertifikat() {
    const name = document.getElementById('username').value;
    
    // Simpan ke Database
    if (database) {
        database.ref('leaderboard/' + name).update({ 
            nama: name,
            skor_math: score, 
            waktu_math: new Date().toString()
        }).then(() => console.log("Tersimpan!")).catch(e => alert("Gagal simpan: " + e));
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text("SERTIFIKAT JUARA", 20, 20);
    doc.text(`Nama: ${name}`, 20, 40);
    doc.text(`Skor Math: ${score}`, 20, 50);
    doc.save(`Sertifikat_${name}.pdf`);
}