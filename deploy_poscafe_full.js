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
        echo 'DATABASE_URL="postgresql://poscafe_user:poscafe_secure_pass_2026@localhost:5432/poscafe_db?schema=public"' > ${appDir}/backend/.env
        echo 'JWT_SECRET="poscafe_super_secret_123"' >> ${appDir}/backend/.env
        echo "✅ File .env berhasil dibuat."
    fi`,
    `npm install -g pm2`,
    `cd ${appDir}/backend && pm2 stop poscafe-backend || true`,
    `cd ${appDir}/backend && npx prisma generate`,
    `cd ${appDir}/backend && npx prisma db push --accept-data-loss`,
    `cd ${appDir}/backend && npx tsc`,
    
    // 3. Restart PM2 Backend
    `echo "🔄 [3/5] Restart PM2 Backend..."`,
    `cd ${appDir}/backend && pm2 delete poscafe-backend || true`,
    // Run backend on port 5000 using compiled JS
    `cd ${appDir}/backend && PORT=5000 pm2 start dist/src/index.js --name poscafe-backend --interpreter node`,
    `pm2 save`,

    // 4. Setup Frontend
    `echo "🌐 [4/5] Setup Frontend..."`,
    `cd ${appDir}/frontend && npm install`,
    `cd ${appDir}/frontend && npm run build`,

    // 5. Reload Nginx
    `echo "⚙️ [5/5] Reloading Nginx Web Server..."`,
    `nginx -t && systemctl reload nginx`,
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
