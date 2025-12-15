# 🚀 Videa Class - Portal Edukasi & Game Interaktif SD

![Project Status](https://img.shields.io/badge/status-active-success)
![Node Version](https://img.shields.io/badge/node-v18%2B-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**Videa Class** adalah platform pembelajaran berbasis web (Web-based Learning) yang menggabungkan konsep *Gamification* dengan materi pelajaran Sekolah Dasar (SD). Aplikasi ini dirancang untuk membuat belajar Matematika, Sejarah Islam (SKI), dan Tahfidz menjadi menyenangkan melalui berbagai mini-game interaktif.

## ✨ Fitur Utama

### 🎮 Game Edukasi
1.  **Math Battle (Tarung Matematika):**
    * Duel matematika real-time atau melawan AI.
    * Tingkat kesulitan adaptif: Mudah (1-20), Sedang (Perkalian/Bagi), Sulit (Campuran & Kurung).
2.  **Jejak Nabi:** Kuis interaktif sejarah 25 Nabi & Rasul.
3.  **Sambung Ayat:** Tes hafalan Juz 30 (Juz Amma).
4.  **Kasir Cilik:** Simulasi berhitung uang kembalian dan total belanja.
5.  **Labirin Ilmu:** Game logika mencari jalan sambil menjawab soal.
6.  **Zuma & Memory Game:** Melatih ketangkasan dan daya ingat.

### 🤖 Integrasi AI (Artificial Intelligence)
* **Dynamic Question Generator:** Soal tidak pernah habis karena digenerate otomatis oleh AI (**Zhipu GLM-4 / Google Gemini**) saat stok soal di database habis.
* **Smart Fallback:** Sistem otomatis beralih ke *Offline Mode* atau *Cache* jika koneksi internet lambat atau kuota API habis.

### 👨‍🏫 Panel Guru (CMS)
* **Manajemen Soal Manual:** Guru bisa memasukkan soal khusus untuk ujian/kelas tertentu.
* **Laporan Nilai:** Download rekap nilai siswa dalam format **PDF** otomatis.
* **Monitoring Real-time:** Melihat siapa yang sedang online dan skor terkini.
* **Role Management:** Mengatur akses pengguna (Siswa/Guru/Admin).

### 💬 Fitur Sosial & Sistem
* **Global Chat:** Diskusi antar siswa dengan fitur keamanan (tanpa private chat) dan dukungan stiker/emoji.
* **Leaderboard Real-time:** Papan peringkat yang diupdate langsung menggunakan Socket.IO.
* **UI Tema Dark Galactic:** Tampilan antariksa yang menarik dengan animasi *Starfield* (Vanilla JS) dan scrollbar kustom.

---

## 🛠️ Teknologi yang Digunakan (Tech Stack)

### Backend
* **Node.js & Express:** Server utama aplikasi.
* **Socket.IO:** Komunikasi dua arah real-time (untuk chat & sinkronisasi skor).
* **Axios:** Request HTTP ke API AI.

### Database & Auth
* **Firebase Realtime Database:** Menyimpan data skor, soal, dan chat.
* **Firebase Authentication:** Sistem login aman (Email/Google).

### Frontend
* **HTML5, CSS3:** Desain responsif (Mobile Friendly).
* **Vanilla JavaScript:** Logika game tanpa framework berat (High Performance).
* **jsPDF:** Generate laporan PDF di sisi client.

### Deployment
* **Railway:** Hosting server Node.js.

---

## ⚙️ Cara Install & Menjalankan (Local)

Ikuti langkah ini untuk menjalankan proyek di komputer Anda:

### 1. Clone Repositori
```bash
git clone [https://github.com/username-anda/videa-class.git](https://github.com/username-anda/videa-class.git)
cd videa-class
