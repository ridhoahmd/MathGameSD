# Panduan Deployment (Production)

Game Edukasi Videa Class ini telah dilengkapi pengaturan untuk berjalan prima di _Production Environment_ (seperti VPS Ubuntu/Debian).

## 1. Persiapan URL Production (.env)

Pastikan Anda mengubah atau membuat file `.env` di server Anda. Parameter krusial yang harus disesuaikan untuk production:

```env
# SERVER CONFIG
PORT=3000
NODE_ENV=production

# (Isi dengan URL/IP Asli Server Anda jika diperlukan oleh socket.io CORS, dll, walaupun saat ini menggunakan default socket config)
# CORS_ORIGIN=https://videaclass.com
```

> **INFO:** Template `.env.example` sudah tersedia. Konfigurasi `DATABASE` dan `API_KEY` cukup disalin dari environment lokal jika memakai _managed DB_ seperti Railway.

## 2. Process Manager (PM2)

Game ini wajib memakai PM2 di _Production_ karena:

1. Otomatis nge-restart server misal _crash_ karena trafik padat.
2. Mode _Cluster_ bawaan akan mengoptimalkan CPU Server.

### Instalasi PM2 (Jika server belum punya):

\`\`\`bash
npm install pm2 -g
\`\`\`

### Menjalankan Server:

File konfigurasi \`ecosystem.config.js\` dan perintah _npm_ sudah berhasil diatur. Anda cukup menjalankan:

\`\`\`bash
npm run start:prod
\`\`\`
_(Perintah ini akan membaca ecosystem.config.js dan mengaktifkan mode cluster max instance dengan NODE_ENV=production)_

### Perintah Berguna Lainnya:

- \`npm run restart\` : Merestart server setelah Anda menarik (_git pull_) _update_ terbaru.
- \`npm run stop\` : Mematikan server.
- \`pm2 logs math-game-sd\` : Melihat log server jika ada error di cloud.

## 3. Ketahanan Memori Klien (Sudah Ditangani!)

Pada sisi _front-end_, kami menyadari bahwa mode berkelanjutan (_Endless_) di beberapa game seperti **Sambung Ayat** berpotensi menyebabkan layar patah-patah (lagging) di _HP Low-End_ karena array pertanyaan menumpuk hingga 200 buah.
**Perbaikan Telah Dilakukan:** Algoritma pembersihan memori (Garbage Collection) lokal telah ditambahkan ke skrip \`ayat.js\`. Jika bank soal melewati 30, skrip secara otomatis menghapus soal lama yang telah diselesaikan (menjaganya tetap ringan di RAM HP).

**Untuk Labirin Phaser**: _Smart Zoom Camera_ telah dianalisis kualitasnya. Pada konfigurasi _resize handler_ Phaser saat ini (`labirin-phaser.js`), kamera selalu mencari rasio terkecil `Math.min(zoomX, zoomY)` agar **keseluruhan Maze dijamin muat di layar** (_fit to screen_), tanpa peduli seberapa ajaib _aspect ratio_ perangkatnya (iPad 4:3 maupun ROG Phone yang amat lebar 21:9).

## 4. Setup Reverse Proxy (Nginx) & SSL Certbot

Aplikasi MathGameSD memerlukan Node Socket.IO yang mengharuskan VPS memakai **Nginx** sebagai jembatan _(reverse-proxy)_ agar grafik koneksi domain ke port 80/443 dialihkan secara stabil ke port lokal 3000. Karena peladen VPS Anda memijak pada **Linux Mint** (turunan Ubuntu/Debian), instruksi pemasangan APT ini sangatlah presisi.

### Langkah A: Instalasi Komponen Nginx & Certbot
Buka jalur terminal SSH VPS Linux Mint Anda, lalu kopas baris berikut:

```bash
sudo apt update
sudo apt install nginx python3-certbot-nginx -y
```

### Langkah B: Daftarkan Config Ke Nginx
Di proyek web ini, sudah terselip _file template_ siap pakai (berada di _folder_ `nginx/games.videaclass.com.conf` setelah Anda *git pull* nanti). 

Eksekusi rangkaian perintah ini:
1. Pindahkan _file_ racikan konfigurasi tersebut murni ke direktori utama Linux Mint:
   ```bash
   sudo cp path/to/MathGameSD-main/nginx/games.videaclass.com.conf /etc/nginx/sites-available/
   ```
2. Ciptakan *symlink* pengaktifan portal site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/games.videaclass.com.conf /etc/nginx/sites-enabled/
   ```
3. Uji kecacatan sintaks sistem Nginx:
   ```bash
   sudo nginx -t
   ```
4. Apabila pesannya *Success / OK*, jalankan _restart_:
   ```bash
   sudo systemctl restart nginx
   ```

### Langkah C: Aktivasi Keamanan Berlapis (HTTPS) Gratis
Dikarenakan identitas _game_ ini bermukim di _subdomain_ `games.videaclass.com`, pasang sertifikat SSL yang dienkripsi (Secure Socket Layer) secara gratis hanya lewat **Satu Langkah** cerdas Certbot:

```bash
sudo certbot --nginx -d games.videaclass.com
```
_(Ketik "Y" dan masukkan surel Anda bila ditanyakan. Jika Certbot memberi tawaran apakah akan "memaksa pengalihan rute/redirect" – ketik yang setara dengan persetujuan **"Yes/Redirect HTTP to HTTPS"**. Sistem peretasan Node.JS di Socket.io Anda pun tuntas diamankan!)_
