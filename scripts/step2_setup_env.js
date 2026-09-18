const { Client } = require('ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

async function runStep2() {
  console.log('================================================================');
  console.log('🚀 MENJALANKAN LANGKAH 2: SETUP PRODUCTION .ENV DI /var/www/codepos');
  console.log('================================================================\n');

  const conn = new Client();
  return new Promise((resolve, reject) => {
    conn.on('ready', () => {
      console.log('✅ SSH Berhasil Terhubung ke VPS (173.212.243.240)');
      
      const remoteScript = `
        set -e
        echo "📍 [1] Memeriksa template /var/www/codepos/deployment/env/.env.production.example..."
        
        cd /var/www/codepos/backend
        
        # Buat .env terkonfigurasi dengan production secrets yang aman
        cat << 'EOF' > .env
# ==============================================================================
# Codenusa Multi-Tenant B2B SaaS POS - Production Environment Variables
# Location: /var/www/codepos/backend/.env
# ==============================================================================

PORT=5000
NODE_ENV=production
TZ=Asia/Jakarta

# PostgreSQL Database Connection (Production Pool)
DATABASE_URL="postgresql://poscafe_user:poscafe_secure_pass_2026@localhost:5432/poscafe_db?schema=public&connection_limit=20&pool_timeout=10"

# JWT Authentication Master Secret
JWT_SECRET="super_secret_pooos_key_codenusa_saas_production_2026"

# Encryption Keys (AES-256 for Tenant Midtrans BYOK & Database Backups)
PAYMENT_ENCRYPTION_KEY="c0d3nu5a_p4ym3nt_3ncrypt10n_k3y_32b!"
BACKUP_ENCRYPTION_KEY="c0d3nu5a_b4ckup_m4st3r_3ncrypt_k3y_!"

# Level 1 Midtrans SaaS Billing Credentials
MIDTRANS_SERVER_KEY="Mid-server-placeholder-codenusa-prod"
MIDTRANS_CLIENT_KEY="Mid-client-placeholder-codenusa-prod"
MIDTRANS_IS_PRODUCTION=false

# Dynamic Subdomain Base Domain
COOKIE_DOMAIN=".codenusa.id"
APP_DOMAIN="codenusa.id"
EOF

        chmod 600 .env
        echo "✅ File /var/www/codepos/backend/.env berhasil dibuat dengan izin akses 600."

        echo ""
        echo "🔍 [2] Verifikasi isi file .env (tanpa membocorkan password penuh):"
        ls -la /var/www/codepos/backend/.env
        grep -E "PORT|NODE_ENV|TZ|APP_DOMAIN|COOKIE_DOMAIN" /var/www/codepos/backend/.env

        echo ""
        echo "🛡️ [3] Memastikan sistem legacy (/var/www/poscafe/backend/.env) tetap utuh:"
        ls -la /var/www/poscafe/backend/.env
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
            console.log('\n✅ LANGKAH 2 SUKSES DISELESAIKAN (Exit code: 0)');
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

runStep2().catch(err => {
  console.error('❌ Error executing Step 2:', err);
  process.exit(1);
});
