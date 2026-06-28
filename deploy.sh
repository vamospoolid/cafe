#!/bin/bash

# ==============================================================================
# Script Deploy VPS untuk Aplikasi Pooos (Frontend & Backend)
# ==============================================================================

# Konfigurasi Path
APP_DIR="/var/www/solcafe" # Menggunakan folder solcafe yang baru dibuat
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"

# Nama proses di PM2 untuk backend
PM2_APP_NAME="pooos-backend"

echo "==========================================="
echo "🚀 Memulai Proses Deployment Aplikasi Pooos"
echo "==========================================="

# 1. Update Code dari Repository
echo "📦 1. Mengambil update terbaru dari Git..."
cd $APP_DIR
git fetch origin
git reset --hard origin/main
# git pull origin main

# 2. Build & Deploy Backend
echo "🛠️ 2. Menyiapkan Backend..."
cd $BACKEND_DIR

echo "   -> Install Dependencies Backend..."
npm install

echo "   -> Generate Prisma Client..."
npx prisma generate

# echo "   -> Menjalankan Migrasi Database..."
# npx prisma migrate deploy

echo "   -> Restarting / Starting Backend dengan PM2..."
# Jika menggunakan ts-node untuk menjalankan langsung file TS
pm2 restart $PM2_APP_NAME || pm2 start src/index.ts --name $PM2_APP_NAME --interpreter=ts-node

# 3. Build & Deploy Frontend
echo "🌐 3. Menyiapkan Frontend..."
cd $FRONTEND_DIR

echo "   -> Install Dependencies Frontend..."
npm install

echo "   -> Membangun (Build) Frontend..."
npm run build

# 4. Restart Web Server (Nginx) - Sesuaikan jika menggunakan Apache atau yang lain
echo "🔄 4. Restart Nginx..."
# Sesuaikan path hasil build di konfigurasi Nginx Anda ke $FRONTEND_DIR/dist
sudo systemctl restart nginx

echo "==========================================="
echo "✅ Deployment Selesai!"
echo "==========================================="
echo "Jalankan 'pm2 logs' untuk memantau backend."
