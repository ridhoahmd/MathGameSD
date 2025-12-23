# 🚀 Videa Class - Platform Game Edukasi Berbasis AI

**Videa Class** adalah platform web interaktif yang menggabungkan keseruan bermain game dengan materi edukasi (Matematika, Sejarah Islam, Tahfidz, Tajwid, dll). Proyek ini didukung oleh **Artificial Intelligence (AI)** untuk membuat soal secara dinamis dan memberikan penjelasan layaknya guru privat.

![Tech Stack](https://img.shields.io/badge/Backend-Node.js-green)
![Tech Stack](https://img.shields.io/badge/Realtime-Socket.io-blue)
![Tech Stack](https://img.shields.io/badge/Database-Firebase-orange)
![Tech Stack](https://img.shields.io/badge/AI-OpenAI%20%2F%20GLM--4-purple)

---

## 🎮 Daftar Mini-Games

Platform ini memiliki berbagai jenis permainan edukatif:

## 🎮 Daftar Mini-Games

Platform ini memiliki berbagai jenis permainan edukatif:

1.  **⚔️ Tarung Matematika (PvP):** Duel matematika real-time antar siswa. Siapa cepat dia dapat skor.
2.  **🐫 Jejak Nabi:** Kuis sejarah Islam dan kisah Nabi dengan narasi yang menarik.
3.  **📖 Sambung Ayat:** Tes hafalan surat pendek hingga Juz 30.
4.  **🕌 Pilah Hukum Tajwid:** Game drag-and-drop untuk memilah hukum bacaan (Izhar, Ikhfa, dll).
5.  **🧠 Lab Memori:** Game mengasah ingatan dengan mencocokkan pasangan kartu (Sinonim/Antonim, Negara & Ibukota).
6.  **🎹 Piano Speed:** Game ritme musik untuk melatih kecepatan jari dan fokus.
7.  **🚀 Tembak angka/zuma:** Game tembak bola berwarna dengan elemen kuis di dalamnya.
8.  **🛒 Kasir Cilik:** Simulasi menghitung total belanja dan kembalian.
9.  **🗝️ Labirin Ilmu:** Petualangan mencari jalan keluar sambil menjawab kuis pengetahuan umum.

---

## 🤖 Fitur Unggulan

### 1. AI Tutor (Guru Videa) 👨‍🏫
Fitur cerdas yang akan muncul ketika siswa salah menjawab soal.
* **Analisis Kesalahan:** AI menjelaskan *kenapa* jawaban siswa salah.
* **Personalisasi:** Menyebut nama siswa dan menggunakan bahasa yang ramah anak.
* **Visual:** Menggunakan format teks berwarna (Bold/Highlight) agar mudah dibaca.
* **Game Support:** Tersedia di game Tajwid, Labirin, Jejak Nabi, dan Sambung Ayat.

### 2. Real-time Multiplayer 🌐
Menggunakan **Socket.IO** untuk pengalaman bermain bersama tanpa delay.
* Chat Global antar pemain.
* Update skor lawan secara live (di Math Battle & Zuma).
* Sistem Room untuk duel privat.

### 3. Dynamic Content Generation 🎲
Soal tidak pernah habis! Server menggunakan AI (OpenAI/GLM-4) untuk men-generate soal baru setiap kali permainan dimulai, disesuaikan dengan tingkat kesulitan (Mudah/Sedang/Sulit).

### 4. Leaderboard & Database 🏆
Terintegrasi dengan **Firebase Realtime Database** untuk menyimpan skor, koin, dan data pemain secara aman.

---

## 🛠️ Teknologi yang Digunakan

* **Frontend:** HTML5, CSS3 (Modern Neon Style), Vanilla JavaScript.
* **Backend:** Node.js, Express.js.
* **Komunikasi:** Socket.IO (WebSocket).
* **Database:** Firebase Realtime Database.
* **AI Engine:** OpenAI API / Zhipu AI (GLM-4).
* **Keamanan:** Helmet.js (CSP), Express Rate Limit.

---

## ⚙️ Cara Instalasi & Menjalankan

Ikuti langkah ini untuk menjalankan proyek di komputer lokal:

### 1. Clone Repository
```bash
git clone [https://github.com/username-anda/mathgamesd.git](https://github.com/username-anda/mathgamesd.git)
cd mathgamesd