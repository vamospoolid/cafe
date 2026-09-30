const { Client } = require('ssh2');
const crypto = require('crypto');

const sshConfig = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const appDir = '/var/www/poscafe';
// Generate 64-byte hex = 128 char — jauh lebih kuat dari default
const newJwtSecret = crypto.randomBytes(64).toString('hex');

const conn = new Client();

// Force update karena secret saat ini hanya 36 char (kurang kuat)
const cmd = `
echo "=== FORCE UPDATE JWT_SECRET (36 char -> 128 char) ==="
sed -i 's|^JWT_SECRET=.*|JWT_SECRET=${newJwtSecret}|' ${appDir}/backend/.env

echo "=== VERIFIKASI ==="
RESULT=$(grep "JWT_SECRET" ${appDir}/backend/.env | cut -d'=' -f2- | wc -c)
echo "Panjang JWT_SECRET baru: $RESULT karakter"
grep "JWT_SECRET" ${appDir}/backend/.env | sed 's/JWT_SECRET=.*/JWT_SECRET=[REDACTED - UPGRADED TO 128 CHARS]/'

echo ""
echo "=== RESTART BACKEND ==="
cd ${appDir}/backend
pm2 restart poscafe-backend
sleep 2
pm2 status poscafe-backend
echo "✅ Backend restart dengan JWT_SECRET baru!"
`;

conn.on('ready', () => {
    console.log('✅ Terhubung ke VPS!');
    console.log('🔐 Upgrade JWT_SECRET dari 36 char -> 128 char...\n');

    conn.exec(cmd, (err, stream) => {
        if (err) {
            console.error('❌ Gagal:', err.message);
            conn.end();
            return;
        }
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', () => {
            console.log('\n🎉 JWT_SECRET berhasil diupgrade!');
            console.log('⚠️  Semua session login lama akan otomatis expired (perlu login ulang)');
            conn.end();
        });
    });
}).on('error', err => {
    console.error('❌ Gagal terhubung:', err.message);
}).connect(sshConfig);
