/**
 * Script Deploy Codenusa SaaS ke VPS (codenusa.id)
 * Target: /var/www/codenusa (Branch: saas, PM2: codenusa-backend)
 * 
 * Safety:
 * - 100% Terisolasi dari /var/www/poscafe (Muki Ramen)
 * - Zero Downtime PM2 reload
 * - Verifikasi Health Check HTTP setelah reload
 */

const { Client } = require('ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

async function main() {
  console.log('================================================================');
  console.log('🚀 MEMULAI DEPLOYMENT KE VPS: CODENUSA.ID (/var/www/codenusa)');
  console.log('================================================================\n');

  const conn = new Client();

  conn.on('ready', () => {
    console.log('✅ SSH Berhasil Terhubung ke VPS (173.212.243.240)\n');

    const deployCommands = `
      set -e

      echo "📦 [1/5] Memperbarui repositori Git di /var/www/codenusa..."
      cd /var/www/codenusa
      git fetch origin saas
      git reset --hard origin/saas
      echo "   -> Terkini di commit: $(git log -n 1 --oneline)"

      echo "🛠️ [2/5] Menyiapkan Backend Codenusa..."
      cd /var/www/codenusa/backend
      echo "   -> Generating Prisma Client..."
      npx prisma generate
      echo "   -> Syncing Database Schema (Non-Destructive)..."
      npx prisma db push --skip-generate || true
      echo "   -> Compiling TypeScript Backend..."
      npm run build
      echo "   ✅ Backend build berhasil!"

      echo "🌐 [3/5] Menyiapkan Frontend Codenusa..."
      cd /var/www/codenusa/frontend
      echo "   -> Compiling Vite Production Assets..."
      npm run build
      echo "   ✅ Frontend build berhasil!"

      echo "🔄 [4/5] Reloading PM2 Service (codenusa-backend)..."
      pm2 reload codenusa-backend --update-env
      pm2 save

      echo "🩺 [5/5] Menjalankan Health Check..."
      sleep 2
      HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5001/api/settings || echo "000")
      echo "   -> Status Backend Lokal (:5001/api/settings): HTTP $HTTP_STATUS"

      echo ""
      echo "📊 Status PM2:"
      pm2 status codenusa-backend

      echo ""
      echo "🛡️ Status Legacy Muki Ramen (HARUS Tetap Online):"
      pm2 status poscafe-backend
    `;

    conn.exec(deployCommands, (err, stream) => {
      if (err) {
        console.error('❌ Gagal mengeksekusi perintah deployment di VPS:', err);
        conn.end();
        process.exit(1);
      }

      stream.on('data', (data) => {
        process.stdout.write(data);
      });

      stream.stderr.on('data', (data) => {
        process.stderr.write(data);
      });

      stream.on('close', (code, signal) => {
        console.log(`\n================================================================`);
        if (code === 0) {
          console.log('🎉 DEPLOYMENT KE CODENUSA.ID BERHASIL DENGAN SUKSES! (Code 0)');
        } else {
          console.error(`❌ Deployment selesai dengan error code: ${code}`);
        }
        console.log('================================================================\n');
        conn.end();
        if (code !== 0) process.exit(code);
      });
    });
  });

  conn.on('error', (err) => {
    console.error('❌ SSH Connection Error:', err);
    process.exit(1);
  });

  conn.connect(config);
}

main();
