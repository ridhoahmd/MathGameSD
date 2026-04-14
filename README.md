# 🎮 MathGameSD: Platform Edukasi Interaktif Premium

![Project Banner](https://img.shields.io/badge/Status-5%20Stars%20Visuals-brightgreen) ![Tech](https://img.shields.io/badge/Stack-Node.js%20%7C%20Socket.io%20%7C%20Phaser-blue)

**MathGameSD** adalah platform game edukasi berbasis web yang menggabungkan pembelajaran Matematika dan Islam dengan visualisasi tingkat tinggi (_Modern UI/UX_). Proyek ini dirancang untuk siswa Sekolah Dasar agar belajar menjadi aktivitas yang adiktif dan menyenangkan.

---

## ✨ Fitur Unggulan (Major Upgrades)

Proyek ini telah melalui tahap **"5-Star Visual Overhaul"**, mengubah tampilan game edukasi sederhana menjadi pengalaman visual kelas premium dan stabil.

### 🌟 Koleksi Game (10-in-1)

| Game                      | Visual Theme & Upgrade                                                                                                      |
| :------------------------ | :-------------------------------------------------------------------------------------------------------------------------- |
| **🏎️ Labirin Matematika** | **Neon Cyber-Maze**: Menggunakan **Phaser Engine**, tampilan grid neon menyala, player sebagai orb cahaya, dan parit digital. |
| **🎹 Piano Nada**         | **Glass Synthesizer**: Tuts piano kaca transparan dengan efek LED glow dan feedback visual partikel.                        |
| **🐸 Zuma Math**          | **Mech Turret & 3D Marbles**: Menggunakan **Phaser Engine** dengan bola 3D mekanik, *shooter* akurat, dan sistem partikel.     |
| **🛒 Kasir Cilik**        | **Modern POS**: Struk belanja realistis dengan efek sobekan kertas dan panel register digital retro.                        |
| **🕌 Sambung Ayat**       | **Royal Islamic**: Tema _Deep Emerald & Gold_ mewah dengan ornamen geometri dan font Arab (Amiri) yang jelas.               |
| **⚔️ Math Battle**        | **Multiplayer Duel**: Sistem PvP PvP _real-time_ untuk adu cepat menyelesaikan soal.                                        |
| **🧠 Memory Lab**         | **Smart Grid**: Penyesuaian ukuran kartu otomatis berdasarkan tingkat kesulitan.                                            |
| **🕋 Jejak Nabi**         | **Interactive Story**: Kuis sejarah nabi dengan visual storytelling.                                                        |
| **📖 Tajwid Hukum**       | **Glass UI**: Belajar hukum tajwid dengan antarmuka modern yang bersih.                                                     |
| **⭐ Tangkap Bintang**    | **Cosmic Catch**: Game menangkap jawaban yang jatuh ala rasi bintang dengan *Twinkling Background* interaktif.                  |

### 🚀 Fitur Teknis & Gameplay

1.  **Global Combo System 🔥**: Mekanisme _streak_ universal. Menjawab benar berturut-turut memberikan efek api, pengali skor (Multiplier), dan audio feedback yang memuaskan.
2.  **Versus Mode & Database Integration ⚔️**: Menggunakan **Socket.io** untuk sinkronisasi duel multiplayer secara langsung di berbagai modul (Sambung Ayat, Tajwid, Jejak Nabi, Math). Lengkap dengan mekanisme *Guest Challenge* dan *Bonus Reward XP & Coins* untuk pemenang!
3.  **Premium Shop System (Toko) 🛒**: Pemain dapat menukarkan **Koin** hasil bermain untuk membeli kosmetik keren seperti Tema Papan Peringkat, Avatar Khusus, dan item gaya visual lainnya.
4.  **AI Tutor Integration 🤖**: Menggunakan LLM (Large Language Model) via API untuk memberikan penjelasan logis secara otomatis jika siswa salah menjawab.
5.  **Robust Engine & Stability 🚀**: Manajemen resource anti bocor (Memory Leak Protection). Instance game Phaser dan **Socket.io listeners** dirancang untuk stabil selama berjam-jam bermain, bebas *crash*.
6.  **Premium Dashboard 🎨**: 7 Pilihan Tema Kustomisasi (Default, Forest, Ocean, Hacker, Crimson, **Royal Islamic**, **Obsidian Stealth**).

---

## 🛠️ Teknologi yang Digunakan

- **Backend**: Node.js, Express.js
- **Real-time Communication**: Socket.io
- **Database**: Prisma ORM (SQLite/PostgreSQL)
- **Frontend**: HTML5, Vanilla CSS3 (Glassmorphism, Animations), Vanilla JavaScript
- **Game Engine & Rendering**: **Phaser.js** (Untuk mekanika game kompleks seperti Zuma & Labirin) dan HTML5 Canvas API
- **AI Service**: Custom AI Controller (integrasi eksternal)

---

## 📂 Struktur Proyek

```
MathGameSD-main/
├── prisma/             # Skema & Migrasi Database
├── public/             # Frontend Files
│   ├── css/            # Style (Tema Premium per Game)
│   ├── html/           # Halaman Game, Shop (Toko), & Dashboard
│   ├── js/             # Logika Game & Integrasi WebSocket
│   │   ├── classes/    # Class Module (GameEngine, dll)
│   │   ├── utils/      # Utilitas (ComboManager, UI)
│   │   ├── zuma-phaser.js # Engine Phaser untuk Game Zuma
│   │   ├── toko.js     # Engine UI & Sistem transaksi Shop/Toko
│   │   └── ...
│   └── assets/         # Audio & Gambar pendukung
├── src/                # Backend Source Code
│   ├── controllers/    # Game & User Logic
│   └── ...
├── server.js           # Entry Point Aplikasi Utama (Node.js)
└── DEPLOYMENT.md       # Spesifikasi Deployment Server (PM2 & Nginx)
```

---

## 💻 Cara Menjalankan (Local Development)

1.  **Prerequisites**: Pastikan `Node.js` dan `npm` sudah terinstall.
2.  **Clone/Download** repositori ini.
3.  **Install Dependencies**:
    ```bash
    npm install
    ```
4.  **Setup Database**:
    ```bash
    npx prisma generate
    npx prisma db push
    ```
5.  **Jalankan Server**:
    ```bash
    npm start
    ```
6.  Buka browser dan akses: `http://localhost:3000`

> 🚀 **Production / VPS Deployment**: Proyek ini telah mendukung fungsionalitas arsitektur *Production Ready* penuh menggunakan VPS Ubuntu. Untuk instruksi cara mengatur **PM2 Cluster, Load Balancing, Nginx Server, dan SSL Certbot**, silakan rujuk ke dokumentasi internal di `DEPLOYMENT.md`.

---

## 🔒 Security & Roles

- **Role Siswa**: Mendaftar/Login, Bermain secara Live, Mengumpulkan Koin Harian, Mengakses **Toko**, Bertarung Mode Versus, dan memantau Papan Peringkat Global.
- **Role Admin/Guru**:
  - Login Eksklusif memanfaatkan **Google Sign-In** (atau token bypass khusus).
  - Mengakses **Analytics Dashboard Super-Detail** per siswa.
  - Melakukan manajemen dan pembaruan soal AI secara *real-time*.
  - Menggunakan fitur pengawasan canggih: **Student Blocking (Ban System)** secara live saat kelas berlangsung, serta memantau perkembangan nilai secara presisi.

---

> **Status Proyek**: ✅ **Stable & Production Ready**.
> Mengukuhkan iterasi akhir proyek, memastikan sinkronisasi responsivitas *mobile*, kestabilan server *real-time Socket*, tanpa kebocoran memori (Zero Memory Leaks).

_Dibuat oleh Tim Pengembang MathGameSD (2026)_
