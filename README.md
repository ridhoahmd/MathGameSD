# 🎮 MathGameSD — Platform Game Edukasi Interaktif

![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen?style=flat-square)
![Node](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933?style=flat-square&logo=nodedotjs)
![Socket.io](https://img.shields.io/badge/Socket.io-4.8.1-010101?style=flat-square&logo=socketdotio)
![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?style=flat-square&logo=prisma)
![License](https://img.shields.io/badge/License-ISC-blue?style=flat-square)

**MathGameSD** adalah platform game edukasi berbasis web yang dirancang untuk siswa **Sekolah Dasar**. Menggabungkan pembelajaran **Matematika** dan **Pendidikan Islam** dalam format 10 mini-game interaktif dengan desain premium, sistem multiplayer real-time, dan AI Tutor otomatis. Proyek ini dikembangkan oleh **Videa Class** sebagai tugas akhir / capstone project.

---

## 📑 Daftar Isi

- [Demo & Akses](#-demo--akses)
- [Fitur Unggulan](#-fitur-unggulan)
- [Koleksi Game (10-in-1)](#-koleksi-game-10-in-1)
- [Arsitektur Sistem](#-arsitektur-sistem)
- [Teknologi yang Digunakan](#-teknologi-yang-digunakan)
- [Struktur Proyek](#-struktur-proyek)
- [Skema Database](#-skema-database)
- [Cara Instalasi & Menjalankan](#-cara-instalasi--menjalankan)
- [Konfigurasi Environment](#-konfigurasi-environment)
- [Deployment ke Production (VPS)](#-deployment-ke-production-vps)
- [Pengujian (Testing)](#-pengujian-testing)
- [Roles & Hak Akses](#-roles--hak-akses)
- [Keamanan](#-keamanan)
- [Tim Pengembang](#-tim-pengembang)

---

## 🌐 Demo & Akses

| Lingkungan   | URL                                   |
| :----------- | :------------------------------------ |
| Production   | `https://games.videaclass.com`        |
| Local Dev    | `http://localhost:3000`               |
| Admin Panel  | `/html/guru.html`                     |
| Leaderboard  | `/html/leaderboard.html`              |

---

## ✨ Fitur Unggulan

### 🔥 Global Combo System
Mekanisme *streak* universal di seluruh game. Menjawab benar berturut-turut memunculkan efek api, pengganda skor (*Score Multiplier*), dan audio feedback memuaskan — mendorong siswa untuk terus bermain.

### ⚔️ Versus Mode (Multiplayer Real-Time)
Duel PvP langsung menggunakan **Socket.io**. Tersedia di modul Sambung Ayat, Tajwid, Jejak Nabi, dan Math Battle. Dilengkapi mekanisme *Guest Challenge* serta bonus **XP & Koin** untuk pemenang.

### 🛒 Premium Shop System (Toko)
Pemain dapat menukarkan **Koin** hasil bermain untuk membeli item kosmetik: Tema Papan Peringkat, Avatar Khusus, Frame Profil, dan Badge eksklusif.

### 🤖 AI Tutor Integration
Menggunakan **ZhipuAI (GLM-4)** via OpenAI-compatible API. Jika siswa salah menjawab, AI secara otomatis memberikan penjelasan logis yang mudah dipahami.

### 🚀 Robust Real-Time Engine
- Manajemen resource anti memory leak di sisi frontend (terutama Phaser games).
- Socket.io listeners terisolasi per-game session — bebas duplikasi event.
- Reconnect handler otomatis jika koneksi terputus.

### 🎨 Premium Dashboard (7 Tema)
Guru / Admin dapat memantau data siswa dengan 7 pilihan tema tampilan:
`Default` · `Forest` · `Ocean` · `Hacker` · `Crimson` · `Royal Islamic` · `Obsidian Stealth`

### 📊 Analytics & Laporan PDF
Dashboard guru menampilkan statistik per-siswa: rata-rata skor, frekuensi bermain, dan topik dominan. Tersedia fitur ekspor laporan kemajuan siswa dalam format **PDF** menggunakan jsPDF.

### 📱 Progressive Web App (PWA)
Didukung `manifest.json` dan Service Worker (`sw.js`) untuk pengalaman offline-first dan kemampuan instalasi di perangkat mobile.

---

## 🕹️ Koleksi Game (10-in-1)

| Game | Tema Visual | Engine | Kategori |
| :--- | :--- | :---: | :---: |
| 🏎️ **Labirin Matematika** | Neon Cyber-Maze: grid neon menyala, player orb cahaya | Phaser.js | Matematika |
| 🎹 **Piano Nada** | Glass Synthesizer: tuts kaca transparan dengan efek LED glow | Canvas | Matematika |
| 🐸 **Zuma Math** | Mech Turret & 3D Marbles: bola 3D mekanik dengan sistem partikel | Phaser.js | Matematika |
| 🛒 **Kasir Cilik** | Modern POS: struk belanja realistis dengan efek sobekan kertas | Canvas | Matematika |
| ⭐ **Tangkap Bintang** | Cosmic Catch: menangkap jawaban jatuh ala rasi bintang | Canvas | Matematika |
| 🧠 **Memory Lab** | Smart Grid: kartu memori adaptif berdasarkan tingkat kesulitan | DOM | Matematika |
| 🕌 **Sambung Ayat** | Royal Islamic: tema Deep Emerald & Gold, font Arab (Amiri) | DOM | Islam |
| 🕋 **Jejak Nabi** | Interactive Story: kuis sejarah nabi dengan visual storytelling | DOM | Islam |
| 📖 **Tajwid Hukum** | Glass UI: belajar hukum tajwid dengan antarmuka modern | DOM | Islam |
| ⚔️ **Math Battle** | Multiplayer Duel: PvP real-time adu cepat menyelesaikan soal | DOM | Matematika |

---

## 🏗️ Arsitektur Sistem

```
Browser (Siswa / Guru)
       │
       │  HTTP / WebSocket (Socket.io)
       ▼
 ┌─────────────────────────────┐
 │       server.js             │  ← Entry Point (Express + Socket.io)
 │   Express REST API          │
 │   Socket.io Server          │
 └─────────┬───────────────────┘
           │
    ┌──────┴──────────────────────────────────┐
    │              src/sockets/               │
    │  ┌─────────────┐  ┌──────────────────┐  │
    │  │ userHandler │  │  gameHandler     │  │
    │  │ adminHandler│  │  shopHandler     │  │
    │  │ chatHandler │  │  socketManager   │  │
    │  └─────────────┘  └──────────────────┘  │
    └──────┬──────────────────────────────────┘
           │
    ┌──────┴──────────────────────────────────┐
    │           src/services/                 │
    │  aiService.js  (ZhipuAI / GLM-4)        │
    └──────┬──────────────────────────────────┘
           │
    ┌──────┴──────────────────────────────────┐
    │        Prisma ORM (PostgreSQL)          │
    │  User · Game · Score · GameQuestion     │
    │  VersusMatch                            │
    └─────────────────────────────────────────┘
```

**Alur data utama:**
1. Siswa login via **Firebase Auth** → token JWT dikirim ke server.
2. Server memvalidasi JWT → sesi Socket.io aktif.
3. Setiap jawaban benar → event `mulaiGame` / `kirimSkor` dikirim → server memvalidasi & menyimpan ke database.
4. Leaderboard diperbarui real-time untuk semua client.

---

## 🛠️ Teknologi yang Digunakan

### Backend
| Library | Versi | Kegunaan |
| :--- | :---: | :--- |
| Node.js | ≥ 20.0.0 | Runtime JavaScript server-side |
| Express.js | ^5.1.0 | HTTP Server & REST API |
| Socket.io | ^4.8.1 | Komunikasi real-time (WebSocket) |
| Prisma ORM | ^5.22.0 | Database access layer |
| JSON Web Token | ^9.0.3 | Autentikasi token berbasis JWT |
| Firebase (Admin) | ^12.6.0 | Autentikasi Google Sign-In siswa |
| OpenAI SDK | ^6.14.0 | Koneksi ke ZhipuAI / GLM-4 (AI Tutor) |
| Winston | ^3.19.0 | Sistem logging terstruktur |
| Helmet | ^8.1.0 | HTTP security headers |
| express-rate-limit | ^8.2.1 | Rate limiting API |
| compression | ^1.8.1 | Kompresi respons HTTP (gzip) |
| XSS | ^1.0.15 | Sanitasi input (XSS protection) |
| Morgan | ^1.10.1 | HTTP request logger |

### Frontend
| Teknologi | Kegunaan |
| :--- | :--- |
| HTML5 / Vanilla CSS3 | Struktur & styling (Glassmorphism, animasi) |
| Vanilla JavaScript (ES6+) | Logika game & integrasi WebSocket |
| Phaser.js | Engine game 2D (Labirin & Zuma) |
| HTML5 Canvas API | Rendering game custom |
| jsPDF | Ekspor laporan kemajuan siswa ke PDF |
| Font Amiri (Google Fonts) | Teks Arab untuk modul Islam |

### DevOps & Tooling
| Tool | Kegunaan |
| :--- | :--- |
| PM2 | Process manager & cluster mode di production |
| Nginx | Reverse proxy & SSL termination |
| Certbot | Sertifikat SSL gratis (Let's Encrypt) |
| Jest | Unit & integration testing |
| Puppeteer | End-to-end / browser testing |
| Supertest | HTTP API testing |

---

## 📂 Struktur Proyek

```
MathGameSD-main/
│
├── prisma/
│   ├── schema.prisma          # Definisi skema database (User, Score, Game, dll.)
│   └── migrations/            # Riwayat migrasi database
│
├── public/                    # Semua aset frontend (diakses langsung browser)
│   ├── index.html             # Halaman utama / lobby pemilihan game
│   ├── manifest.json          # Konfigurasi PWA
│   ├── sw.js                  # Service Worker (caching offline)
│   ├── favicon.ico
│   ├── logo-videa.png
│   │
│   ├── html/                  # Halaman per-game & panel admin
│   │   ├── guru.html          # Dashboard Admin / Guru
│   │   ├── leaderboard.html   # Papan Peringkat Global
│   │   ├── toko.html          # Toko (Shop) kosmetik
│   │   ├── labirin-phaser.html
│   │   ├── zuma-phaser.html
│   │   ├── ayat.html          # Sambung Ayat
│   │   ├── nabi.html          # Jejak Nabi
│   │   ├── tajwid.html        # Hukum Tajwid
│   │   ├── math.html          # Math Battle (Versus)
│   │   ├── memory.html        # Memory Lab
│   │   ├── kasir.html         # Kasir Cilik
│   │   ├── piano.html         # Piano Nada
│   │   └── bintang.html       # Tangkap Bintang
│   │
│   ├── js/                    # Logika JavaScript frontend
│   │   ├── classes/           # Modul Class (GameEngine, dll.)
│   │   ├── utils/             # Utilitas (ComboManager, UI helper)
│   │   ├── zuma-phaser.js     # Engine Phaser untuk game Zuma
│   │   ├── labirin-phaser.js  # Engine Phaser untuk game Labirin
│   │   ├── toko.js            # Logika UI & transaksi Toko
│   │   ├── ayat-versus.js     # Socket handler untuk Sambung Ayat Versus
│   │   └── ...                # JS per-game lainnya
│   │
│   └── css/                   # Stylesheet premium per-game & global
│
├── src/                       # Source code backend
│   ├── sockets/               # Socket.io event handlers
│   │   ├── socketManager.js   # Inisialisasi & routing semua handler
│   │   ├── userHandler.js     # Login, register, profil, leaderboard
│   │   ├── gameHandler.js     # Validasi & penyimpanan skor game
│   │   ├── adminHandler.js    # Event khusus guru (ban, soal, analytics)
│   │   ├── shopHandler.js     # Transaksi toko (beli item, equip)
│   │   └── chatHandler.js     # Chat/pesan antar client
│   │
│   ├── services/
│   │   └── aiService.js       # Integrasi ZhipuAI (GLM-4) untuk AI Tutor
│   │
│   ├── config/                # Konfigurasi (database, firebase, dll.)
│   └── utils/                 # Utilitas backend (logger, helper)
│
├── tests/                     # File pengujian
│   ├── server.test.js         # API & server integration test
│   ├── versus.test.js         # Unit test mode Versus
│   └── screenshots/           # Screenshot hasil E2E test (Puppeteer)
│
├── nginx/                     # Template konfigurasi Nginx
│   └── games.videaclass.com.conf
│
├── logs/                      # Log server (dihasilkan PM2 & Winston)
├── deployment/                # Aset pendukung deployment
├── laporan/                   # Dokumen laporan proyek
├── asset/                     # Aset tambahan proyek
│
├── server.js                  # 🚀 Entry Point — Express + Socket.io server
├── ecosystem.config.js        # Konfigurasi PM2 (cluster mode)
├── jest.config.js             # Konfigurasi Jest testing
├── .env.example               # Template variabel lingkungan
├── .gitignore
├── package.json
├── DEPLOYMENT.md              # Panduan lengkap deployment ke VPS
└── README.md                  # Dokumentasi proyek (file ini)
```

---

## 🗄️ Skema Database

Proyek menggunakan **PostgreSQL** (via Railway atau VPS) dengan **Prisma ORM**.

```
┌──────────────────┐       ┌──────────────────┐
│      User        │       │      Game        │
│ ─────────────── │       │ ─────────────── │
│ id (PK)          │◄──┐   │ id (PK)          │
│ firebaseUid      │   │   │ slug (UNIQUE)     │
│ username (UNIQUE)│   │   │ title            │
│ role             │   │   │ description      │
│ coins            │   └───┤ scores[]         │
│ totalScore       │       │ versusMatches[]  │
│ xp               │       └──────────────────┘
│ level            │
│ photoURL         │       ┌──────────────────┐
│ inventory (JSON) │       │      Score       │
│ activeTheme      │       │ ─────────────── │
│ equippedFrame    │◄──────│ userId (FK)      │
│ equippedBadge    │       │ gameId (FK)      │
│ createdAt        │       │ score            │
│ updatedAt        │       │ playedAt         │
└──────────────────┘       └──────────────────┘

┌──────────────────────────┐     ┌──────────────────┐
│      VersusMatch         │     │  GameQuestion    │
│ ──────────────────────── │     │ ─────────────── │
│ id (PK)                  │     │ id (PK)          │
│ p1Id (FK → User)         │     │ category         │
│ gameId (FK → Game)       │     │ level            │
│ p1Score                  │     │ content (JSON)   │
│ p2Name                   │     │ createdAt        │
│ status (Win/Lose/Draw)   │     └──────────────────┘
│ playedAt                 │
└──────────────────────────┘
```

**Tabel:**
- **`User`** — Data pemain: profil, koin, XP, level, inventori kosmetik.
- **`Game`** — Metadata tiap mini-game (slug unik sebagai ID).
- **`Score`** — Riwayat skor per-sesi bermain setiap siswa.
- **`GameQuestion`** — Bank soal (isi dalam format JSON, diindeks per kategori & level).
- **`VersusMatch`** — Riwayat duel mode Versus (PvP).

---

## 💻 Cara Instalasi & Menjalankan

### Prerequisites

- **Node.js** versi **≥ 20.0.0** ([download](https://nodejs.org))
- **npm** ≥ 10
- **PostgreSQL** (lokal atau cloud seperti [Railway](https://railway.app))
- Akun **Firebase** (untuk autentikasi siswa)
- API Key **ZhipuAI** (untuk fitur AI Tutor — opsional)

### Langkah Instalasi

**1. Clone repositori**
```bash
git clone https://github.com/your-org/MathGameSD.git
cd MathGameSD-main
```

**2. Install dependencies**
```bash
npm install
```
> Prisma Client akan di-generate otomatis via script `postinstall`.

**3. Konfigurasi environment**
```bash
cp .env.example .env
```
Isi file `.env` sesuai petunjuk di bagian [Konfigurasi Environment](#-konfigurasi-environment).

**4. Setup database**
```bash
# Generate Prisma Client
npx prisma generate

# Buat tabel di database (development)
npx prisma db push

# Atau jalankan migrasi (production)
npx prisma migrate deploy
```

**5. Jalankan server (Development)**
```bash
npm start
```

**6. Akses aplikasi**
```
http://localhost:3000
```

---

## ⚙️ Konfigurasi Environment

Salin `.env.example` menjadi `.env` dan isi semua variabel berikut:

```env
# ─── SERVER ────────────────────────────────────────
PORT=3000
NODE_ENV=development

# ─── FIREBASE (Google Sign-In untuk siswa) ─────────
API_KEY="AIzaSy..."
FIREBASE_API_KEY="AIzaSy..."

# ─── AI TUTOR (ZhipuAI / GLM-4) ────────────────────
# Daftar di: https://open.bigmodel.cn
ZHIPU_API_KEY="your_api_key.secret"

# ─── DATABASE (PostgreSQL) ─────────────────────────
# Contoh Railway: postgresql://user:pass@host:port/dbname
DATABASE_URL="postgresql://user:password@localhost:5432/mathgamesd"

# ─── KEAMANAN ───────────────────────────────────────
# Password login khusus Guru/Admin (via form manual)
GURU_PASSWORD="GURU2025"
```

> ⚠️ **Jangan pernah commit file `.env` ke repositori.** File ini sudah ada di `.gitignore`.

---

## 🚀 Deployment ke Production (VPS)

Panduan lengkap tersedia di [`DEPLOYMENT.md`](./DEPLOYMENT.md). Berikut ringkasannya:

### Stack Deployment

```
Internet → Nginx (Port 80/443) → PM2 Cluster → Node.js (Port 3000) → PostgreSQL
              SSL/HTTPS via Certbot
```

### Langkah Cepat

```bash
# 1. Install PM2 secara global
npm install pm2 -g

# 2. Jalankan server dalam mode cluster (semua CPU core)
npm run start:prod

# 3. Daftarkan PM2 agar auto-start saat server reboot
pm2 startup
pm2 save
```

**Perintah PM2 berguna:**
```bash
npm run restart      # Restart setelah git pull update
npm run stop         # Matikan server
pm2 logs math-game-sd  # Lihat log real-time
pm2 monit            # Monitor penggunaan CPU & RAM
```

### Nginx & SSL

```bash
# Install Nginx & Certbot
sudo apt update && sudo apt install nginx python3-certbot-nginx -y

# Salin konfigurasi Nginx
sudo cp nginx/games.videaclass.com.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/games.videaclass.com.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx

# Aktifkan HTTPS gratis
sudo certbot --nginx -d games.videaclass.com
```

---

## 🧪 Pengujian (Testing)

Proyek menggunakan **Jest** sebagai test runner, **Supertest** untuk API testing, dan **Puppeteer** untuk E2E browser testing.

```bash
# Jalankan semua test
npm test

# Lihat laporan coverage
open coverage/index.html
```

**File test tersedia:**
| File | Jenis | Deskripsi |
| :--- | :--- | :--- |
| `tests/server.test.js` | Integration | API endpoint & Socket.io events |
| `tests/versus.test.js` | Unit | Logika matchmaking & scoring mode Versus |

---

## 👥 Roles & Hak Akses

### 🎓 Siswa
- Daftar & Login via **Google Sign-In** (Firebase Auth)
- Bermain semua 10 mini-game
- Mengumpulkan **Koin** & **XP** dari setiap sesi bermain
- Belanja item kosmetik di **Toko**
- Menantang pemain lain di **Mode Versus**
- Memantau posisi di **Papan Peringkat Global**
- Mendapat penjelasan dari **AI Tutor** saat salah menjawab

### 👨‍🏫 Guru / Admin
- Login via **Google Sign-In** atau token bypass khusus (`GURU_PASSWORD`)
- Akses **Analytics Dashboard** per-siswa (skor, frekuensi, progress)
- Manajemen **Bank Soal**: tambah, edit, atau update soal secara *real-time*
- **Student Blocking (Ban System)**: blokir siswa secara live saat kelas berlangsung
- Ekspor **laporan kemajuan siswa** dalam format PDF
- Pilih **7 tema tampilan** dashboard

---

## 🔒 Keamanan

| Fitur | Detail |
| :--- | :--- |
| **HTTP Headers** | Helmet.js mengaktifkan CSP, HSTS, X-Frame-Options, dll. |
| **Rate Limiting** | `express-rate-limit` mencegah brute force & spam request |
| **XSS Protection** | Library `xss` menyaring semua input user |
| **Autentikasi JWT** | Semua event Socket.io kritis memvalidasi token JWT |
| **Role-Based Access** | Admin/Guru endpoint terproteksi, siswa tidak bisa akses |
| **HTTPS** | SSL via Certbot (Let's Encrypt) di production |
| **Input Sanitization** | Data soal & skor divalidasi di server sebelum disimpan |

---

## 📁 File Konfigurasi Penting

| File | Deskripsi |
| :--- | :--- |
| `server.js` | Entry point — inisialisasi Express, Socket.io, middleware |
| `ecosystem.config.js` | Konfigurasi PM2 (cluster max, restart otomatis, logging) |
| `prisma/schema.prisma` | Skema database Prisma |
| `.env.example` | Template variabel lingkungan |
| `public/sw.js` | Service Worker untuk PWA & caching offline |
| `public/manifest.json` | Manifest PWA (ikon, nama, warna tema) |
| `nginx/games.videaclass.com.conf` | Template konfigurasi Nginx reverse proxy |
| `jest.config.js` | Konfigurasi runner test Jest |
| `DEPLOYMENT.md` | Panduan deployment lengkap ke VPS |

---

## 🗓️ Riwayat Pengembangan

| Fase | Fitur Utama |
| :--- | :--- |
| **v0.1** | Prototype 5 game dasar (Math, Ayat, Tajwid, Nabi, Memory) |
| **v0.5** | Integrasi Socket.io, sistem login Firebase, database Prisma |
| **v0.8** | Phaser engine (Zuma & Labirin), 5-Star Visual Overhaul |
| **v0.9** | AI Tutor (ZhipuAI), Versus Mode PvP, Toko Kosmetik |
| **v1.0** | Combo System, Dashboard Guru, PDF Report, PWA, Production Ready |

---

## 👨‍💻 Tim Pengembang

**MathGameSD** dikembangkan oleh **Tim Videa Class** (2025–2026).

> 💡 **Kontribusi**: Untuk melaporkan bug atau mengusulkan fitur baru, silakan buka *issue* di repositori ini.

---

> **Status Proyek**: ✅ **Stable & Production Ready**
>
> Iterasi final telah memastikan: sinkronisasi mobile responsif, kestabilan Socket.io real-time tanpa memory leak, score validation end-to-end, dan deployment VPS dengan SSL aktif.
