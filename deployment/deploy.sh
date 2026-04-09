#!/bin/bash
# =============================================================================
# DEPLOY SCRIPT — MathGameSD (games.videaclass.com)
# Jalankan script ini di VPS sebagai root atau user dengan sudo access.
# Perintah: bash deployment/deploy.sh
# =============================================================================

set -e  # Hentikan script jika ada perintah yang gagal

# === KONFIGURASI ===
DOMAIN="games.videaclass.com"
APP_DIR="/home/deploy/MathGameSD"      # <-- SESUAIKAN dengan path di VPS kamu
APP_NAME="math-game-sd"
NODE_MIN_VERSION="18"
NGINX_CONF_DEST="/etc/nginx/sites-available/$DOMAIN"
WEBROOT="/var/www/certbot"

# === WARNA TERMINAL ===
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() { echo -e "\n${BLUE}▶ $1${NC}"; }
print_ok()   { echo -e "${GREEN}✅ $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_err()  { echo -e "${RED}❌ $1${NC}"; exit 1; }

# =============================================================================
# STEP 1: CEK DEPENDENCY
# =============================================================================
print_step "STEP 1: Mengecek dependencies..."

# Cek Node.js
if ! command -v node &>/dev/null; then
    print_warn "Node.js tidak ditemukan. Menginstall via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt "$NODE_MIN_VERSION" ]; then
    print_err "Node.js versi $NODE_VERSION terlalu lama. Butuh minimal v$NODE_MIN_VERSION."
fi
print_ok "Node.js $(node -v) OK"

# Cek npm
if ! command -v npm &>/dev/null; then print_err "npm tidak ditemukan!"; fi
print_ok "npm $(npm -v) OK"

# Cek PM2
if ! command -v pm2 &>/dev/null; then
    print_warn "PM2 tidak ditemukan. Menginstall..."
    sudo npm install -g pm2
fi
print_ok "PM2 $(pm2 -v) OK"

# Cek Nginx
if ! command -v nginx &>/dev/null; then
    print_warn "Nginx tidak ditemukan. Menginstall..."
    sudo apt-get update && sudo apt-get install -y nginx
fi
print_ok "Nginx OK"

# Cek Certbot
if ! command -v certbot &>/dev/null; then
    print_warn "Certbot tidak ditemukan. Menginstall..."
    sudo apt-get install -y certbot python3-certbot-nginx
fi
print_ok "Certbot OK"

# =============================================================================
# STEP 2: SETUP DIREKTORI & UPLOAD KODE
# =============================================================================
print_step "STEP 2: Setup direktori aplikasi..."

# Buat direktori jika belum ada
sudo mkdir -p "$APP_DIR"
sudo mkdir -p "$WEBROOT"
sudo mkdir -p "$APP_DIR/logs"

print_ok "Direktori $APP_DIR siap"

# Cek apakah sudah ada kode di folder
if [ ! -f "$APP_DIR/server.js" ]; then
    print_err "File server.js tidak ditemukan di $APP_DIR. Upload kode dulu!\nCara: scp -r ./MathGameSD-main/* user@IP_VPS:$APP_DIR/"
fi

# =============================================================================
# STEP 3: INSTALL DEPENDENCIES & SETUP ENV
# =============================================================================
print_step "STEP 3: Install npm dependencies..."

cd "$APP_DIR"

# Cek .env ada atau belum
if [ ! -f ".env" ]; then
    print_warn ".env tidak ditemukan! Menyalin dari .env.example..."
    cp .env.example .env
    print_err ".env sudah dibuat dari template. Silakan isi nilai-nilainya dulu:\n  nano $APP_DIR/.env\nLalu jalankan script ini lagi."
fi

# Install production dependencies saja
npm install --omit=dev

# Generate Prisma client
npx prisma generate

# Jalankan Prisma migrations
npx prisma migrate deploy || print_warn "Prisma migrate gagal/tidak ada migration baru."

print_ok "Dependencies selesai diinstall"

# =============================================================================
# STEP 4: KONFIGURASI NGINX
# =============================================================================
print_step "STEP 4: Mengkonfigurasi Nginx..."

# Copy nginx config
sudo cp "$APP_DIR/deployment/nginx.conf" "$NGINX_CONF_DEST"

# Buat symlink ke sites-enabled jika belum ada
if [ ! -f "/etc/nginx/sites-enabled/$DOMAIN" ]; then
    sudo ln -sf "$NGINX_CONF_DEST" "/etc/nginx/sites-enabled/$DOMAIN"
    print_ok "Symlink Nginx dibuat"
fi

# Hapus default nginx config yang konflik
if [ -f "/etc/nginx/sites-enabled/default" ]; then
    sudo rm /etc/nginx/sites-enabled/default
    print_warn "Config 'default' Nginx dihapus untuk menghindari konflik"
fi

# Test konfigurasi nginx
sudo nginx -t || print_err "Konfigurasi Nginx invalid! Periksa $NGINX_CONF_DEST"

# Reload Nginx (tanpa SSL dulu, untuk Certbot challenge)
# Sementara komentari SSL di nginx.conf agar bisa minta sertifikat
sudo sed -i 's|ssl_certificate |# ssl_certificate |g' "$NGINX_CONF_DEST"
sudo sed -i 's|ssl_certificate_key |# ssl_certificate_key |g' "$NGINX_CONF_DEST"
sudo sed -i 's|include /etc/letsencrypt|# include /etc/letsencrypt|g' "$NGINX_CONF_DEST"
sudo sed -i 's|ssl_dhparam |# ssl_dhparam |g' "$NGINX_CONF_DEST"
# Ubah listen 443 jadi 80 sementara
sudo sed -i 's|listen 443 ssl http2;|listen 80;|g' "$NGINX_CONF_DEST"

# Restart nginx dengan config HTTP saja
sudo systemctl restart nginx
print_ok "Nginx berjalan (mode HTTP sementara)"

# =============================================================================
# STEP 5: CERTBOT SSL
# =============================================================================
print_step "STEP 5: Mendapatkan sertifikat SSL dari Let's Encrypt..."

# Jalankan certbot
sudo certbot --nginx \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --register-unsafely-without-email \
    --redirect || {
    print_warn "Certbot gagal. Mencoba dengan email..."
    echo -n "Masukkan email untuk sertifikat SSL: "
    read CERT_EMAIL
    sudo certbot --nginx \
        -d "$DOMAIN" \
        --non-interactive \
        --agree-tos \
        -m "$CERT_EMAIL" \
        --redirect
}

# Copy config nginx yang sudah diperbarui dengan SSL aktif
sudo cp "$APP_DIR/deployment/nginx.conf" "$NGINX_CONF_DEST"
sudo nginx -t && sudo systemctl reload nginx
print_ok "SSL Certbot aktif untuk $DOMAIN"

# Setup auto-renew SSL (cron)
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && systemctl reload nginx") | sort -u | crontab -
print_ok "Auto-renew SSL terjadwal tiap hari jam 03:00"

# =============================================================================
# STEP 6: JALANKAN APLIKASI DENGAN PM2
# =============================================================================
print_step "STEP 6: Menjalankan aplikasi dengan PM2..."

cd "$APP_DIR"

# Hentikan instance lama jika ada
pm2 stop "$APP_NAME" 2>/dev/null || true
pm2 delete "$APP_NAME" 2>/dev/null || true

# Jalankan dengan ecosystem config
pm2 start ecosystem.config.js --env production

# Simpan konfigurasi PM2 agar auto-start setelah reboot
pm2 save

# Setup PM2 startup script
pm2 startup | tail -1 | sudo bash || print_warn "Jalankan perintah pm2 startup secara manual jika gagal"

print_ok "Aplikasi berjalan dengan PM2"

# =============================================================================
# STEP 7: VERIFIKASI AKHIR
# =============================================================================
print_step "STEP 7: Verifikasi deployment..."

sleep 3  # Tunggu app siap

# Cek apakah app berjalan
if pm2 list | grep -q "$APP_NAME.*online"; then
    print_ok "PM2 process '$APP_NAME' ONLINE"
else
    print_err "PM2 process '$APP_NAME' TIDAK berjalan! Cek logs: pm2 logs $APP_NAME"
fi

# Cek HTTP response
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000" 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
    print_ok "Server merespons HTTP $HTTP_STATUS pada port 3000"
else
    print_warn "Server tidak merespons pada port 3000 (status: $HTTP_STATUS). Cek: pm2 logs $APP_NAME"
fi

# Cek HTTPS
HTTPS_STATUS=$(curl -sk -o /dev/null -w "%{http_code}" "https://$DOMAIN" 2>/dev/null || echo "000")
if [ "$HTTPS_STATUS" = "200" ]; then
    print_ok "HTTPS aktif dan berjalan di https://$DOMAIN"
else
    print_warn "HTTPS status: $HTTPS_STATUS — mungkin DNS belum propagasi penuh (tunggu 5-30 menit)"
fi

# =============================================================================
# SELESAI
# =============================================================================
echo ""
echo -e "${GREEN}=============================================="
echo -e "  ✅ DEPLOYMENT SELESAI!"
echo -e "  🌐 URL: https://$DOMAIN"
echo -e "  📊 Monitor: pm2 monit"
echo -e "  📋 Logs:    pm2 logs $APP_NAME"
echo -e "  🔄 Restart: pm2 restart $APP_NAME"
echo -e "==============================================${NC}"
echo ""
