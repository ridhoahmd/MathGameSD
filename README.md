# 🎮 MathGameSD: Platform Edukasi Interaktif Premium

![Project Banner](https://img.shields.io/badge/Status-5%20Stars%20Visuals-brightgreen) ![Tech](https://img.shields.io/badge/Stack-Node.js%20%7C%20Socket.io%20%7C%20Canvas-blue)

**MathGameSD** adalah platform game edukasi berbasis web yang menggabungkan pembelajaran Matematika dan Islam dengan visualisasi tingkat tinggi (_Modern UI/UX_). Proyek ini dirancang untuk siswa Sekolah Dasar agar belajar menjadi aktivitas yang adiktif dan menyenangkan.

---

## ✨ Fitur Unggulan (Major Upgrades)

Proyek ini telah melalui tahap **"5-Star Visual Overhaul"**, mengubah tampilan game edukasi sederhana menjadi pengalaman visual kelas premium.

### 🌟 Koleksi Game (9-in-1)

| Game                      | Visual Theme & Upgrade                                                                                                      |
| :------------------------ | :-------------------------------------------------------------------------------------------------------------------------- |
| **🏎️ Labirin Matematika** | **Neon Cyber-Maze**: Tampilan grid neon menyala, player sebagai orb cahaya, dan parit digital.                              |
| **🎹 Piano Nada**         | **Glass Synthesizer**: Tuts piano kaca transparan dengan efek LED glow dan feedback visual partikel.                        |
| **🐸 Zuma Math**          | **Mech Turret & 3D Marbles**: Engine Canvas kustom dengan bola 3D (ray-traced style), shooter mekanik, dan sistem partikel. |
| **🛒 Kasir Cilik**        | **Modern POS**: Struk belanja realistis dengan efek sobekan kertas dan panel register digital retro.                        |
| **🕌 Sambung Ayat**       | **Royal Islamic**: Tema _Deep Emerald & Gold_ mewah dengan ornamen geometri dan font Arab (Amiri) yang jelas.               |
| **⚔️ Math Battle**        | **Multiplayer Duel**: Sistem PvP _real-time_ dengan Socket.io.                                                              |
| **🧠 Memory Lab**         | **Smart Grid**: Penyesuaian ukuran kartu otomatis berdasarkan kesulitan.                                                    |
| **🕋 Jejak Nabi**         | **Interactive Story**: Kuis sejarah nabi dengan visual storytelling.                                                        |
| **📖 Tajwid Hukum**       | **Glass UI**: Belajar hukum tajwid dengan antarmuka modern yang bersih.                                                     |

### 🚀 Fitur Teknis & Gameplay

1.  **Global Combo System 🔥**: Mekanisme _streak_ universal. Menjawab benar berturut-turut memberikan efek api, pengali skor (Multiplier), dan audio feedback yang memuaskan.
2.  **AI Tutor Integration 🤖**: Menggunakan LLM (Large Language Model) via API untuk memberikan penjelasan otomatis jika siswa menjawab salah.
3.  **Real-Time Multiplayer ⚡**: Menggunakan **Socket.io** untuk sinkronisasi skor dan duel antar siswa secara langsung dengan latensi rendah.
4.  **Premium Dashboard 🎨**: 7 Pilihan Tema (Default, Forest, Ocean, Hacker, Crimson, **Royal Islamic**, **Obsidian Stealth**).
5.  **Procedural Assets 🎨**: Zuma dan Labirin tidak menggunakan gambar statis, melainkan digambar secara _real-time_ dengan kode (Canvas API) untuk kualitas grafis tajam di semua resolusi.

---

## 🛠️ Teknologi yang Digunakan

- **Backend**: Node.js, Express.js
- **Real-time Communication**: Socket.io
- **Database**: Prisma ORM (SQLite/PostgreSQL)
- **Frontend**: HTML5, Vanilla CSS3 (Glassmorphism, Animations), Vanilla JavaScript.
- **Rendering**: HTML5 Canvas API (untuk Zuma & Labirin).
- **AI Service**: Custom AI Controller (integrasi eksternal).

---

## 📂 Struktur Proyek

```
MathGameSD-main/
├── prisma/             # Skema & Migrasi Database
├── public/             # Frontend Files
│   ├── css/            # Style (Tema Premium per Game)
│   ├── html/           # Halaman Game
│   ├── js/             # Logika Game
│   │   ├── classes/    # Class Module (GameEngine, dll)
│   │   ├── utils/      # Utilitas (ComboManager, UI)
│   │   ├── zuma.js     # Canvas Engine Zuma
│   │   └── ...
│   └── assets/         # Audio & Gambar pendukung
├── src/                # Backend Source COde
│   ├── controllers/    # Game & User Logic
│   └── ...
└── server.js           # Entry Point Aplikasi
```

---

## 💻 Cara Menjalankan (Installation)

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

---

## 🔒 Security & Roles

- **Role Siswa**: Login, Main Game, Leaderboard, Ganti Profil (Avatar DiceBear).
- **Role Admin/Guru**:
  - Login menggunakan **Google Sign-In** (atau Token Khusus).
  - Dashboard analitik siswa.
  - Manajemen soal AI.

---

> **Status Proyek**: ✅ **Stable & Polished**.
> Dikembangkan dengan fokus pada _Kenyamanan Pengguna_ dan _Visual Excellence_.

_Dibuat oleh Tim Pengembang MathGameSD (2026)_
