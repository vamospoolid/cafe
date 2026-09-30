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
    console.log('✅ Connected to VPS via SSH.');

    conn.sftp((err, sftp) => {
      if (err) throw err;

      // 1. Upload updated orders.ts
      const localFile = path.resolve(__dirname, '../backend/src/routes/orders.ts');
      const remoteFile = '/var/www/poscafe/backend/src/routes/orders.ts';

      const readStream = fs.createReadStream(localFile);
      const writeStream = sftp.createWriteStream(remoteFile);

      writeStream.on('close', () => {
        console.log(`📤 Uploaded ${localFile} -> ${remoteFile}`);

        // 2. Upload SQL script for backfilling Order #173 and updating Settings
        const sql = `
-- 1. Enable ingredient tracking on all settings rows
UPDATE "Settings" SET "ingredientTrackingEnabled" = true;

-- 2. Backfill Order #173 (Beef Tumis Slice qty 2)
-- Ingredient 5 (Beef Slice Shortplate): 200 unit
-- Ingredient 3 (Beras Pulen Super): 200 unit
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "IngredientLog" WHERE "referenceId" = 'ORD-20260929-008') THEN
    INSERT INTO "IngredientLog" ("ingredientId", "change", "cost", "type", "description", "referenceId", "createdAt", "updatedAt", "tenantId")
    VALUES 
      (5, -200, 26000, 'Produksi', 'Order ORD-20260929-008', 'ORD-20260929-008', '2026-09-29 00:41:42.373', NOW(), 'tenant-vamos-pool'),
      (3, -200, 2800, 'Produksi', 'Order ORD-20260929-008', 'ORD-20260929-008', '2026-09-29 00:41:42.373', NOW(), 'tenant-vamos-pool');
    
    UPDATE "Ingredient" SET stock = stock - 200 WHERE id = 5;
    UPDATE "Ingredient" SET stock = stock - 200 WHERE id = 3;
    RAISE NOTICE 'Backfilled Order ORD-20260929-008 successfully';
  ELSE
    RAISE NOTICE 'Order ORD-20260929-008 already has logs';
  END IF;
END $$;

SELECT count(*) as total_logs FROM "IngredientLog";
SELECT id, "ingredientId", "change", "type", "description", "referenceId", "createdAt" 
FROM "IngredientLog" 
WHERE "referenceId" = 'ORD-20260929-008';
        `.trim();

        const sqlStream = sftp.createWriteStream('/tmp/backfill_orders.sql');
        sqlStream.on('close', () => {
          console.log('📁 Uploaded /tmp/backfill_orders.sql');

          const cmd = `
echo "=== 1. RUNNING BACKFILL & SETTINGS SQL ==="
sudo -u postgres psql -d poscafe_db -f /tmp/backfill_orders.sql && rm -f /tmp/backfill_orders.sql

echo "=== 2. COMPILING BACKEND TYPESCRIPT ==="
cd /var/www/poscafe/backend
npx tsc

echo "=== 3. RESTARTING PM2 ==="
pm2 restart poscafe-backend

echo "=== 4. STATUS ==="
pm2 status poscafe-backend
          `;

          conn.exec(cmd, (err, execStream) => {
            if (err) throw err;
            execStream.on('data', d => process.stdout.write(d));
            execStream.stderr.on('data', d => process.stderr.write(d));
            execStream.on('close', code => {
              console.log(`\n🎉 Deploy and backfill finished with code: ${code}`);
              conn.end();
            });
          });
        });
        sqlStream.end(sql);
      });

      readStream.pipe(writeStream);
    });
  }).on('error', err => console.error('SSH Error:', err)).connect(VPS_CONFIG);
}

deploy();
