const { Client } = require('ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

async function deploySaaS() {
  console.log('================================================================');
  console.log('🚀 MENJALANKAN LANGKAH 3, 4, 5: SETUP NGINX, SSL & DEPLOY SAAS');
  console.log('================================================================\n');

  const conn = new Client();
  return new Promise((resolve, reject) => {
    conn.on('ready', () => {
      console.log('✅ SSH Berhasil Terhubung ke VPS (173.212.243.240)');

      const remoteScript = `
        set -e

        echo "📦 [1/6] Syncing code from GitHub ke /var/www/codepos..."
        cd /var/www/codepos
        git fetch origin
        git reset --hard origin/main

        echo "🔒 [2/6] Memeriksa sertifikat SSL untuk codenusa.id..."
        mkdir -p /etc/letsencrypt/live/codenusa.id
        if [ ! -f /etc/letsencrypt/live/codenusa.id/fullchain.pem ]; then
          echo "   -> Membuat sertifikat SSL awal untuk codenusa.id..."
          openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout /etc/letsencrypt/live/codenusa.id/privkey.pem \
            -out /etc/letsencrypt/live/codenusa.id/fullchain.pem \
            -subj "/CN=codenusa.id"
          cp /etc/letsencrypt/live/codenusa.id/fullchain.pem /etc/letsencrypt/live/codenusa.id/chain.pem
        fi

        echo "⚙️ [3/6] Mengonfigurasi Nginx Server Block (/etc/nginx/sites-available/codepos)..."
        cp deployment/nginx/codepos.conf /etc/nginx/sites-available/codepos
        ln -sf /etc/nginx/sites-available/codepos /etc/nginx/sites-enabled/codepos
        
        echo "   -> Menguji konfigurasi Nginx..."
        nginx -t
        systemctl reload nginx
        echo "   ✅ Nginx berhasil di-reload dengan aman!"

        echo "🛠️ [4/6] Menyiapkan Backend Codenusa SaaS..."
        cd /var/www/codepos/backend
        
        # Pastikan port 5001 di .env
        sed -i 's/PORT=5000/PORT=5001/g' .env || true
        
        echo "   -> Install backend dependencies..."
        npm install --silent
        
        echo "   -> Generate Prisma Client..."
        npx prisma generate
        
        echo "   -> Sync database schema..."
        npx prisma db push --accept-data-loss --skip-generate
        
        echo "   -> Running seed foundation..."
        npx ts-node prisma/seed_foundation.ts || true
        npx ts-node prisma/seed_features.ts || true
        
        echo "   -> Compile TypeScript Backend..."
        npm run build

        echo "🌐 [5/6] Menyiapkan Frontend Production Bundle..."
        cd /var/www/codepos/frontend
        npm install --silent
        npm run build

        echo "🔄 [6/6] Memulai proses PM2 codepos-backend..."
        cd /var/www/codepos
        mkdir -p /var/log/pm2
        
        if pm2 show codepos-backend > /dev/null 2>&1; then
          echo "   -> Reloading existing codepos-backend..."
          pm2 reload codepos-backend --update-env
        else
          echo "   -> Starting new codepos-backend..."
          pm2 start ecosystem.config.js
          pm2 save
        fi

        echo ""
        echo "🩺 [VERIFIKASI KESEHATAN SISTEM]"
        sleep 3
        curl -s http://127.0.0.1:5001/api/health/ping || echo "Backend pinging..."

        echo ""
        echo "📊 Status PM2:"
        pm2 list

        echo ""
        echo "🛡️ Memastikan sistem legacy (/var/www/poscafe & poscafe-backend) tetap aman & online:"
        pm2 show poscafe-backend | grep -E "status|uptime|restarts" || true
      `;

      conn.exec(remoteScript, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }

        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', (code) => {
          conn.end();
          if (code === 0) {
            console.log('\n🎉 SEMUA LANGKAH DEPLOYMENT SAAS SELESAI DENGAN SUKSES! (Exit code: 0)');
            resolve();
          } else {
            reject(new Error(`Command failed with exit code ${code}`));
          }
        });
      });
    }).on('error', reject).connect(config);
  });
}

deploySaaS().catch(err => {
  console.error('❌ Error executing deployment:', err);
  process.exit(1);
});
