#!/bin/bash

# ==============================================================================
# Script Deploy & Setup VPS untuk Aplikasi Pooos (Frontend & Backend)
# Langsung dari Repository GitHub
# ==============================================================================

# Konfigurasi Repository dan Path
REPO_URL="https://github.com/vamospoolid/cafe.git"
APP_DIR="/var/www/solcafe" # Ubah path ini jika Anda menggunakan folder lain di VPS
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
PM2_APP_NAME="solpos-backend"

echo "=========================================================="
echo "🚀 Memulai Proses Deployment Aplikasi Pooos dari GitHub"
echo "=========================================================="

# 1. Update / Clone Code dari Repository
if [ ! -d "$APP_DIR/.git" ]; then
    echo "📦 [1/4] Repository belum ada di VPS. Melakukan git clone..."
    # Membuat direktori jika belum ada, dan mengatur permission (sesuaikan jika perlu)
    sudo mkdir -p $APP_DIR
    sudo chown -R $USER:$USER $APP_DIR
    
    # Clone repository
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
else
    echo "📦 [1/4] Repository ditemukan. Mengambil update terbaru dari Git (Branch: main)..."
    cd $APP_DIR
    # Buang perubahan lokal jika ada, lalu sinkronisasi dengan branch main di origin
    git fetch origin
    git reset --hard origin/main
    git clean -fd
fi

# 2. Setup dan Build Backend
echo "🛠️ [2/4] Menyiapkan environment Backend..."
cd $BACKEND_DIR

echo "   -> Menginstal Dependencies Backend..."
npm install

echo "   -> Men-generate Prisma Client..."
npx prisma generate

# Hapus tanda pagar (#) pada baris di bawah ini jika Anda ingin 
# skrip otomatis melakukan push skema DB saat deploy
# echo "   -> Push Skema Database Prisma..."
# npx prisma db push

echo "   -> Me-restart atau Menjalankan Backend dengan PM2..."
# Cek apakah PM2 app sudah berjalan, jika ada restart, jika tidak jalankan baru
if pm2 show $PM2_APP_NAME > /dev/null; then
    pm2 restart $PM2_APP_NAME
else
    # Gunakan ts-node untuk environment TS (pastikan ts-node terinstall)
    # atau ubah ke node dist/index.js jika Anda melakukan build (tsc) terlebih dahulu
    pm2 start src/index.ts --name $PM2_APP_NAME --interpreter=ts-node
    pm2 save
fi

# 3. Setup dan Build Frontend
echo "🌐 [3/4] Menyiapkan environment Frontend..."
cd $FRONTEND_DIR

echo "   -> Menginstal Dependencies Frontend..."
npm install

echo "   -> Mem-build Frontend..."
npm run build

# 4. Restart Nginx (Opsional, diaktifkan jika menggunakan Nginx)
echo "🔄 [4/4] Memperbarui Web Server..."
# Jika Anda mengonfigurasi Nginx untuk menunjuk ke $FRONTEND_DIR/dist
# maka biasanya tidak perlu restart, tapi untuk memastikan konfigurasi termuat:
# sudo systemctl restart nginx
echo "   -> (Dilewati) Nginx biasanya tidak perlu di-restart hanya untuk file statis."

echo "=========================================================="
echo "✅ Deployment dari GitHub Selesai dengan Sukses!"
echo "=========================================================="
echo "💡 Cek status backend dengan: pm2 status"
echo "💡 Cek log backend dengan: pm2 logs $PM2_APP_NAME"
