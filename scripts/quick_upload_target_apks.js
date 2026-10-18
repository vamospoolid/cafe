const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

const rootDir = path.resolve(__dirname, '..');
const releaseDir = path.join(rootDir, 'release');

const targetApks = [
  'usahabersama-pos-cashier.apk',
  'sabarjaya-pos-cashier.apk',
  'tokoberkah-pos-cashier.apk',
  'mukiramen-pos-cashier.apk',
  'laundry-pos-cashier.apk'
];

async function main() {
  console.log('🚀 Quick Upload Target APKs to VPS...');

  const conn = new Client();
  conn.on('ready', () => {
    console.log('✅ SSH Connected');

    conn.sftp((err, sftp) => {
      if (err) {
        console.error('SFTP Error:', err);
        conn.end();
        return;
      }

      let idx = 0;
      function next() {
        if (idx >= targetApks.length) {
          console.log('\n🎉 Semua Target APK Berhasil Diupload ke VPS!');
          const finalizeCmd = `
            mkdir -p /var/www/codenusa/frontend/dist/downloads
            cp -f /var/www/codenusa/release/*.apk /var/www/codenusa/frontend/dist/downloads/
            echo "--- VERIFIKASI FILE DI DIST DOWNLOADS ---"
            ls -lh /var/www/codenusa/frontend/dist/downloads/
            echo "--- HTTP CHECK ---"
            curl -s -I https://codenusa.id/downloads/usahabersama-pos-cashier.apk | head -n 5
          `;
          conn.exec(finalizeCmd, (fErr, fStream) => {
            fStream.pipe(process.stdout);
            fStream.on('close', () => {
              console.log('✅ Selesai!');
              conn.end();
            });
          });
          return;
        }

        const apkName = targetApks[idx];
        const localFile = path.join(releaseDir, apkName);
        const remoteFile = `/var/www/codenusa/release/${apkName}`;

        if (!fs.existsSync(localFile)) {
          console.warn(`File lokal ${apkName} tidak ditemukan, skip.`);
          idx++;
          next();
          return;
        }

        const stats = fs.statSync(localFile);
        const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`[${idx + 1}/${targetApks.length}] Uploading ${apkName} (${sizeMb} MB)...`);

        sftp.fastPut(localFile, remoteFile, (putErr) => {
          if (putErr) {
            console.error(`❌ Gagal upload ${apkName}:`, putErr.message);
          } else {
            console.log(`  ✓ Sukses: ${remoteFile}`);
          }
          idx++;
          next();
        });
      }

      next();
    });
  });

  conn.on('error', err => {
    console.error('SSH Error:', err.message);
  });

  conn.connect(config);
}

main();
