#!/bin/bash
# ============================================
# DEPLOY SCRIPT — MathGameSD
# Push ke GitHub + Update VPS otomatis
# Jalankan: bash deploy.sh
# ============================================

VPS_USER="videa_games"
VPS_IP="203.145.35.186"
VPS_PASS="HANTUqwerty12!21@"
VPS_DIR="~/MathGameSD"
BRANCH="main"

# Baca PAT dari .env (aman, tidak ikut ke GitHub)
if [[ -f ".env" ]]; then
  export $(grep -E '^GH_PAT=' .env | xargs)
  GH_TOKEN="$GH_PAT"
fi


echo ""
echo "🚀 MathGameSD Deploy Script"
echo "============================"
echo ""

# ─── STEP 1: Cek perubahan ───────────────────────────────────────
if [[ -z $(git status --porcelain) ]]; then
  echo "ℹ️  Tidak ada perubahan baru di kode."
  echo "   Lewati commit, langsung update VPS..."
  SKIP_COMMIT=true
else
  echo "📝 Perubahan yang akan di-commit:"
  git status --short
  echo ""
  read -p "Masukkan pesan commit: " COMMIT_MSG
  if [[ -z "$COMMIT_MSG" ]]; then
    COMMIT_MSG="update: $(date '+%Y-%m-%d %H:%M')"
  fi
  git add .
  git commit -m "$COMMIT_MSG"
  echo ""
  SKIP_COMMIT=false
fi

# ─── STEP 2: Push ke GitHub ──────────────────────────────────────
if [[ "$SKIP_COMMIT" != "true" ]]; then
  if [[ -z "$GH_TOKEN" ]]; then
    echo "❌ GH_TOKEN kosong di deploy.sh. Isi dulu!"
    exit 1
  fi

  echo ""
  echo "📤 Push ke GitHub..."
  REMOTE_URL="https://ridhoahmd:${GH_TOKEN}@github.com/ridhoahmd/MathGameSD.git"
  git push "$REMOTE_URL" "$BRANCH" 2>&1 | grep -v "$GH_TOKEN"

  if [[ ${PIPESTATUS[0]} -ne 0 ]]; then
    echo "❌ Gagal push ke GitHub. Cek token atau koneksi."
    exit 1
  fi
  echo "✅ GitHub berhasil diupdate!"
fi

# ─── STEP 3: Update VPS ──────────────────────────────────────────
echo ""
echo "🖥️  Menghubungkan ke VPS dan update server..."
sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} \
  "cd ${VPS_DIR} && git pull origin ${BRANCH} && npx prisma migrate deploy && pm2 restart math-game-sd && pm2 status" 2>&1 | grep -v "warning\|perl\|LC_\|LANG\|locale\|Falling back\|Terminated\|AUTHORIZED\|monitored\|idcloudhost\|Aspire"

if [[ ${PIPESTATUS[0]} -eq 0 ]]; then
  echo ""
  echo "✅ VPS berhasil diupdate!"
  echo "🌐 Cek website: https://games.videaclass.com"
else
  echo "❌ Gagal update VPS. Coba manual:"
  echo "   sshpass -p '...' ssh videa_games@${VPS_IP} 'cd ~/MathGameSD && git pull && pm2 restart math-game-sd'"
fi

echo ""
echo "🎉 Deploy selesai!"
echo ""
