const { Client } = require('ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

async function runStep1() {
  console.log('================================================================');
  console.log('🚀 MENJALANKAN LANGKAH 1: CLONE REPO SAAS KE /var/www/codepos');
  console.log('================================================================\n');

  const conn = new Client();
  return new Promise((resolve, reject) => {
    conn.on('ready', () => {
      console.log('✅ SSH Berhasil Terhubung ke VPS (173.212.243.240)');
      
      const remoteScript = `
        set -e
        echo "📍 [1] Memeriksa direktori /var/www..."
        cd /var/www
        
        if [ -d "codepos" ]; then
          echo "ℹ️ Direktori /var/www/codepos sudah ada. Melakukan git pull..."
          cd codepos
          git fetch origin
          git status
        else
          echo "📦 Melakukan git clone repository https://github.com/vamospoolid/cafe.git ke /var/www/codepos..."
          git clone https://github.com/vamospoolid/cafe.git codepos
        fi
        
        echo ""
        echo "🔍 [2] Verifikasi direktori dan isolasi:"
        ls -ld /var/www/codepos
        ls -la /var/www/codepos | head -n 15
        
        echo ""
        echo "🛡️ [3] Memastikan sistem legacy (/var/www/poscafe) aman & utuh:"
        ls -ld /var/www/poscafe
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
            console.log('\n✅ LANGKAH 1 SUKSES DISELESAIKAN (Exit code: 0)');
            resolve();
          } else {
            reject(new Error(`Command failed with exit code ${code}`));
          }
        });
      });
    }).on('error', (err) => {
      reject(err);
    }).connect(config);
  });
}

runStep1().catch(err => {
  console.error('❌ Error executing Step 1:', err);
  process.exit(1);
});
