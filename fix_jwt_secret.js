const { Client } = require('ssh2');
const crypto = require('crypto');

const sshConfig = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const appDir = '/var/www/poscafe';

// Generate a strong JWT secret
const newJwtSecret = crypto.randomBytes(64).toString('hex');

const conn = new Client();

const cmd = `
echo "=== CEK JWT_SECRET ==="
if grep -q "JWT_SECRET" ${appDir}/backend/.env; then
    CURRENT=$(grep "JWT_SECRET" ${appDir}/backend/.env | cut -d '=' -f2-)
    echo "JWT_SECRET saat ini: $CURRENT"
    if [ "$CURRENT" = "super_secret_pooos_key" ] || [ -z "$CURRENT" ]; then
        echo "⚠️  JWT_SECRET masih default atau kosong! Mengupdate..."
        sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${newJwtSecret}/" ${appDir}/backend/.env
        echo "✅ JWT_SECRET berhasil diperbarui ke nilai acak yang kuat!"
    else
        LEN=\${#CURRENT}
        echo "✅ JWT_SECRET sudah ada (panjang: $LEN karakter)"
        if [ $LEN -lt 32 ]; then
            echo "⚠️  JWT_SECRET terlalu pendek (<32 char)! Mengupdate..."
            sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${newJwtSecret}/" ${appDir}/backend/.env
            echo "✅ JWT_SECRET berhasil diperbarui!"
        else
            echo "✅ JWT_SECRET sudah kuat, tidak perlu diubah."
        fi
    fi
else
    echo "⚠️  JWT_SECRET tidak ditemukan di .env! Menambahkan..."
    echo "JWT_SECRET=${newJwtSecret}" >> ${appDir}/backend/.env
    echo "✅ JWT_SECRET berhasil ditambahkan!"
fi

echo ""
echo "=== VERIFIKASI FINAL ==="
grep "JWT_SECRET" ${appDir}/backend/.env | sed 's/JWT_SECRET=.*/JWT_SECRET=[REDACTED - OK]/'
`;

conn.on('ready', () => {
    console.log('✅ Terhubung ke VPS!');
    console.log('🔐 Memeriksa & memperbarui JWT_SECRET...\n');

    conn.exec(cmd, (err, stream) => {
        if (err) {
            console.error('❌ Gagal:', err.message);
            conn.end();
            return;
        }

        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', () => {
            console.log('\n✅ Selesai!');
            conn.end();
        });
    });
}).on('error', err => {
    console.error('❌ Gagal terhubung:', err.message);
}).connect(sshConfig);
