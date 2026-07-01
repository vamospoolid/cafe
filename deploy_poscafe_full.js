const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const repoUrl = 'https://github.com/vamospoolid/cafe.git';
const appDir = '/var/www/poscafe';
const domain = 'cafe.codenusa.id';

const deployCommands = [
    // 1. Persiapan Folder & Git Clone / Pull
    `echo "📦 [1/5] Setup Repository Git..."`,
    `mkdir -p ${appDir}`,
    `if [ ! -d "${appDir}/.git" ]; then
        echo "Cloning repository..."
        git clone ${repoUrl} ${appDir}
    else
        echo "Pulling latest changes..."
        cd ${appDir} && git reset --hard && git pull origin main
    fi`,

    // 2. Setup Backend & Database
    `echo "🛠️ [2/5] Setup Backend & Database..."`,
    `cd ${appDir}/backend && npm install`,
    `if [ ! -f "${appDir}/backend/.env" ]; then
        echo 'DATABASE_URL="file:/var/www/poscafe/backend/prisma/dev.db"' > ${appDir}/backend/.env
        echo 'JWT_SECRET="poscafe_super_secret_123"' >> ${appDir}/backend/.env
        echo "✅ File .env berhasil dibuat."
    fi`,
    `cd ${appDir}/backend && npx prisma generate`,
    `cd ${appDir}/backend && npx prisma db push --accept-data-loss`,
    `cd ${appDir}/backend && npx tsc`,
    
    // 3. Restart PM2 Backend
    `echo "🔄 [3/5] Restart PM2 Backend..."`,
    // Pastikan pm2 terinstall secara global jika belum
    `npm install -g pm2`,
    `cd ${appDir}/backend && pm2 stop poscafe-backend || true`,
    `cd ${appDir}/backend && pm2 delete poscafe-backend || true`,
    // Run backend on port 5000 using compiled JS
    `cd ${appDir}/backend && PORT=5000 pm2 start dist/src/index.js --name poscafe-backend --interpreter node`,
    `pm2 save`,

    // 4. Setup Frontend
    `echo "🌐 [4/5] Setup Frontend..."`,
    `cd ${appDir}/frontend && npm install`,
    `cd ${appDir}/frontend && npm run build`,

    // 5. Setup Nginx
    `echo "⚙️ [5/5] Setup Nginx Server Block..."`,
    `cat << 'EOF' > /etc/nginx/sites-available/${domain}
server {
    listen 80;
    server_name ${domain} www.${domain};

    # Frontend
    root ${appDir}/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO Proxy
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
EOF`,
    `ln -sf /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/`,
    `systemctl restart nginx`,
    `echo "✅ Deploy Complete!"`
];

async function deploy() {
    console.log('🚀 Memulai proses deployment ke VPS...\n');
    const conn = new Client();

    return new Promise((resolve, reject) => {
        conn.on('ready', async () => {
            console.log('✅ Berhasil terhubung ke VPS via SSH.\n');
            
            // Gabungkan semua perintah menjadi satu script panjang
            const fullScript = deployCommands.join('\n');

            conn.exec(fullScript, (err, stream) => {
                if (err) {
                    conn.end();
                    return reject(err);
                }

                stream.on('data', (data) => {
                    process.stdout.write(data.toString());
                });

                stream.stderr.on('data', (data) => {
                    process.stderr.write(data.toString());
                });

                stream.on('close', (code) => {
                    console.log(`\n🎉 Proses eksekusi selesai dengan kode: ${code}`);
                    conn.end();
                    resolve();
                });
            });
        }).on('error', (err) => {
            console.error('❌ Gagal terhubung ke VPS:', err.message);
            reject(err);
        }).connect(config);
    });
}

deploy().catch(console.error);
