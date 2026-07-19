const { execSync } = require('child_process');
const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const appDir = '/var/www/poscafe';

try {
    console.log('📦 [1/3] Memulai commit lokal untuk mengeluarkan database dari pelacakan Git...');
    execSync('git add .gitignore backend/.gitignore', { stdio: 'inherit' });
    execSync('git commit -m "chore: untrack sqlite database and ignore .db files"', { stdio: 'inherit' });
    execSync('git push origin main', { stdio: 'inherit' });
    console.log('✅ Commit lokal dan push berhasil!');
} catch (error) {
    console.error('❌ Gagal melakukan push lokal:', error.message);
    process.exit(1);
}

console.log('\n🌐 [2/3] Menghubungkan ke VPS via SSH untuk melakukan transisi secara aman...');
const conn = new Client();

const cmd = `
cd ${appDir}
echo "=== 1. Menarik pembaruan dari Git (Git Pull) ==="
git reset --hard && git pull origin main

echo "=== 2. Memulihkan file database dari backup ==="
if [ -f "${appDir}/backend/prisma/dev.db.bak" ]; then
    cp ${appDir}/backend/prisma/dev.db.bak ${appDir}/backend/prisma/dev.db
    echo "✅ Database berhasil dipulihkan dari backup!"
else
    echo "⚠️ Peringatan: File backup database tidak ditemukan!"
fi

echo "=== 3. Restarting backend ==="
cd backend
npx prisma generate
pm2 restart poscafe-backend
echo "✅ Backend restarted!"
`;

conn.on('ready', () => {
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', (code) => {
            console.log(`\n🎉 [3/3] Transisi selesai dengan kode keluar: ${code}`);
            conn.end();
        });
    });
}).connect(config);
