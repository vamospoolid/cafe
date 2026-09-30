const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const VPS_CONFIG = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07',
  readyTimeout: 30000
};

async function deploy() {
  const conn = new Client();

  conn.on('ready', () => {
    console.log('✅ Terhubung ke VPS cafe.codenusa.id via SSH.');

    conn.sftp((err, sftp) => {
      if (err) {
        console.error('❌ SFTP error:', err);
        conn.end();
        return;
      }

      const filesToUpload = [
        {
          local: path.resolve(__dirname, '../backend/src/routes/products.ts'),
          remote: '/var/www/poscafe/backend/src/routes/products.ts'
        },
        {
          local: path.resolve(__dirname, '../backend/src/routes/categories.ts'),
          remote: '/var/www/poscafe/backend/src/routes/categories.ts'
        },
        {
          local: path.resolve(__dirname, '../backend/src/routes/waste.ts'),
          remote: '/var/www/poscafe/backend/src/routes/waste.ts'
        }
      ];

      let completed = 0;
      filesToUpload.forEach(f => {
        const readStream = fs.createReadStream(f.local);
        const writeStream = sftp.createWriteStream(f.remote);
        writeStream.on('close', () => {
          console.log(`📤 Uploaded ${path.basename(f.local)} -> ${f.remote}`);
          completed++;
          if (completed === filesToUpload.length) {
            runRemoteCommands();
          }
        });
        readStream.pipe(writeStream);
      });
    });

    function runRemoteCommands() {
      const sqlCommands = `
UPDATE "Ingredient" SET "tenantId" = 'tenant-vamos-pool' WHERE "tenantId" IS NULL;
UPDATE "RecipeItem" SET "tenantId" = 'tenant-vamos-pool' WHERE "tenantId" IS NULL;
UPDATE "Category" SET "tenantId" = 'tenant-vamos-pool' WHERE "tenantId" IS NULL;
UPDATE "Product" SET "tenantId" = 'tenant-vamos-pool' WHERE "tenantId" IS NULL;
UPDATE "Supplier" SET "tenantId" = 'tenant-vamos-pool' WHERE "tenantId" IS NULL;
      `.trim();

      const cmd = `
echo "=== 1. UPDATING DATABASE TENANT IDS ==="
sudo -u postgres psql -d poscafe_db -c "${sqlCommands.replace(/\n/g, ' ')}"

echo "=== 2. COMPILING BACKEND TYPESCRIPT ==="
cd /var/www/poscafe/backend
npx tsc

echo "=== 3. RESTARTING BACKEND PM2 ==="
pm2 restart poscafe-backend

echo "=== 4. VERIFYING STATUS ==="
pm2 status poscafe-backend
      `;

      conn.exec(cmd, (err, stream) => {
        if (err) {
          console.error('❌ Remote command execution failed:', err);
          conn.end();
          return;
        }

        stream.on('data', data => process.stdout.write(data));
        stream.stderr.on('data', data => process.stderr.write(data));
        stream.on('close', (code) => {
          console.log(`\n🎉 Proses deploy dan update database selesai dengan kode: ${code}`);
          conn.end();
        });
      });
    }
  });

  conn.on('error', (err) => {
    console.error('❌ Gagal terhubung ke VPS:', err);
  });

  conn.connect(VPS_CONFIG);
}

deploy();
