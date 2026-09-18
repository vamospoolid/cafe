const { Client } = require('ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

async function checkNginxAndSSL() {
  console.log('================================================================');
  console.log('🔍 MEMERIKSA STATUS SSL & KONFIGURASI NGINX DI VPS');
  console.log('================================================================\n');

  const conn = new Client();
  return new Promise((resolve, reject) => {
    conn.on('ready', () => {
      console.log('✅ SSH Berhasil Terhubung ke VPS');

      const remoteScript = `
        echo "📍 [1] Memeriksa sertifikat SSL yang ada di /etc/letsencrypt/live/..."
        ls -la /etc/letsencrypt/live/ 2>/dev/null || echo "Folder letsencrypt belum ada / kosong"

        echo ""
        echo "📍 [2] Memeriksa file konfigurasi Nginx di /etc/nginx/sites-available/..."
        ls -la /etc/nginx/sites-available/
        
        echo ""
        echo "📍 [3] Memeriksa file konfigurasi Nginx di /etc/nginx/sites-enabled/..."
        ls -la /etc/nginx/sites-enabled/
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
          resolve();
        });
      });
    }).on('error', reject).connect(config);
  });
}

checkNginxAndSSL().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
