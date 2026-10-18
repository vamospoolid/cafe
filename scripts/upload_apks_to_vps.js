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

async function main() {
  console.log('================================================================');
  console.log('🚀 UPLOAD APK & DEPLOY CODENUSA SAAS KE VPS (173.212.243.240)');
  console.log('================================================================\n');

  const conn = new Client();

  conn.on('ready', () => {
    console.log('✅ SSH Berhasil Terhubung ke VPS\n');

    // 1. Git pull and build backend & frontend on VPS
    const deployCommands = `
      set -e
      echo "📦 [1/4] Memperbarui repositori Git di /var/www/codenusa..."
      cd /var/www/codenusa
      git fetch origin saas
      git reset --hard origin/saas

      echo "🛠️ [2/4] Compiling Backend & Frontend..."
      cd /var/www/codenusa/backend
      npm run build

      cd /var/www/codenusa/frontend
      npm run build

      echo "📁 [3/4] Menyiapkan direktori downloads..."
      mkdir -p /var/www/codenusa/release
      mkdir -p /var/www/codenusa/frontend/dist/downloads

      echo "🔄 [4/4] Reloading PM2..."
      pm2 reload codenusa-backend --update-env
      pm2 save
    `;

    conn.exec(deployCommands, (err, stream) => {
      if (err) {
        console.error('❌ Gagal mengeksekusi deploy command:', err);
        conn.end();
        return;
      }

      stream.on('close', (code, signal) => {
        if (code !== 0) {
          console.error(`❌ Deployment command gagal dengan exit code ${code}`);
          conn.end();
          return;
        }

        console.log('\n✅ Deployment kode berhasil! Memulai upload file APK via SFTP...\n');

        conn.sftp((sftpErr, sftp) => {
          if (sftpErr) {
            console.error('❌ SFTP error:', sftpErr);
            conn.end();
            return;
          }

          const apks = fs.readdirSync(releaseDir).filter(f => f.endsWith('.apk'));
          console.log(`Ditemukan ${apks.length} file APK untuk diupload:`, apks);

          let current = 0;

          function uploadNext() {
            if (current >= apks.length) {
              console.log('\n🎉 SEMUA FILE APK BERHASIL DIUPLOAD KE VPS!');
              // Verifikasi HTTP
              conn.exec('curl -s -I https://codenusa.id/downloads/usahabersama-pos-cashier.apk | head -n 5', (curlErr, curlStream) => {
                let out = '';
                curlStream.on('data', d => { out += d.toString(); });
                curlStream.on('close', () => {
                  console.log('\n[HASIL UJI CURL VPS]:\n' + out);
                  conn.end();
                });
              });
              return;
            }

            const apkFile = apks[current];
            const localPath = path.join(releaseDir, apkFile);
            const remoteReleasePath = `/var/www/codenusa/release/${apkFile}`;
            const remoteDistPath = `/var/www/codenusa/frontend/dist/downloads/${apkFile}`;

            const stats = fs.statSync(localPath);
            const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`[${current + 1}/${apks.length}] Mengupload ${apkFile} (${sizeMb} MB)...`);

            sftp.fastPut(localPath, remoteReleasePath, (upErr) => {
              if (upErr) {
                console.error(`❌ Gagal upload ${apkFile} ke release:`, upErr.message);
              } else {
                console.log(`  ✓ Tersimpan di /var/www/codenusa/release/${apkFile}`);
              }

              sftp.fastPut(localPath, remoteDistPath, (distErr) => {
                if (distErr) {
                  console.error(`❌ Gagal upload ${apkFile} ke dist/downloads:`, distErr.message);
                } else {
                  console.log(`  ✓ Tersimpan di /var/www/codenusa/frontend/dist/downloads/${apkFile}`);
                }
                current++;
                uploadNext();
              });
            });
          }

          uploadNext();
        });
      });

      stream.on('data', (data) => {
        process.stdout.write(data);
      });

      stream.stderr.on('data', (data) => {
        process.stderr.write(data);
      });
    });
  });

  conn.on('error', (err) => {
    console.error('❌ Koneksi SSH Gagal:', err.message);
  });

  conn.connect(config);
}

main();
