#!/bin/bash
# =============================================================================
# UPDATE SCRIPT — MathGameSD (Setelah kode baru di-push)
# Jalankan setelah git pull / upload kode baru ke VPS
# Perintah: bash deployment/update.sh
# =============================================================================

set -e

APP_DIR="/home/deploy/MathGameSD"   # <-- SESUAIKAN
APP_NAME="math-game-sd"

cd "$APP_DIR"

echo "🔄 Menginstall dependency baru (jika ada)..."
npm install --omit=dev

echo "⚙️  Menjalankan Prisma migrate..."
npx prisma generate
npx prisma migrate deploy || echo "Tidak ada migration baru."

echo "♻️  Merestart PM2..."
pm2 restart "$APP_NAME"

echo "✅ Update selesai! Status:"
pm2 list
