const { Client } = require('ssh2');

const VPS_CONFIG = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07',
  readyTimeout: 30000
};

const sql = `
BEGIN;

-- 1. Pindahkan seluruh relasi bisnis dari tenant-default-muki ke tenant-vamos-pool (agar tidak ada data yang hilang)
UPDATE "Order" SET "tenantId" = 'tenant-vamos-pool' WHERE "tenantId" = 'tenant-default-muki';
UPDATE "OrderItem" SET "tenantId" = 'tenant-vamos-pool' WHERE "tenantId" = 'tenant-default-muki';
UPDATE "Shift" SET "tenantId" = 'tenant-vamos-pool' WHERE "tenantId" = 'tenant-default-muki';
UPDATE "CashFlow" SET "tenantId" = 'tenant-vamos-pool' WHERE "tenantId" = 'tenant-default-muki';
UPDATE "Attendance" SET "tenantId" = 'tenant-vamos-pool' WHERE "tenantId" = 'tenant-default-muki';
UPDATE "Table" SET "tenantId" = 'tenant-vamos-pool' WHERE "tenantId" = 'tenant-default-muki';
UPDATE "Category" SET "tenantId" = 'tenant-vamos-pool' WHERE "tenantId" = 'tenant-default-muki';
UPDATE "Product" SET "tenantId" = 'tenant-vamos-pool' WHERE "tenantId" = 'tenant-default-muki';
UPDATE "Settings" SET "tenantId" = 'tenant-vamos-pool' WHERE "tenantId" = 'tenant-default-muki' AND NOT EXISTS (SELECT 1 FROM "Settings" WHERE "tenantId" = 'tenant-vamos-pool');

-- 2. Hapus duplikasi membership yang mengarah ke tenant-default-muki
DELETE FROM "TenantMembership" WHERE "tenantId" = 'tenant-default-muki';

-- 3. Ubah slug tenant-default-muki agar slug 'mukiramen' dapat digunakan oleh tenant utama
UPDATE "Tenant" SET slug = 'mukiramen-archive', status = 'ARCHIVED' WHERE id = 'tenant-default-muki';

-- 4. Ubah tenant-vamos-pool menjadi tenant MUKI RAMEN dengan slug 'mukiramen' dan customDomain 'app.mukiramen.id'
UPDATE "Tenant" 
SET 
  name = 'MUKI RAMEN',
  slug = 'mukiramen',
  "customDomain" = 'app.mukiramen.id',
  "ownerName" = 'Owner Muki Ramen',
  status = 'ACTIVE'
WHERE id = 'tenant-vamos-pool';

-- 5. Pastikan nama outlet selaras
UPDATE "Outlet" 
SET name = 'Muki Ramen - Pusat Wonomulyo' 
WHERE "tenantId" = 'tenant-vamos-pool';

-- 6. Pastikan settings storeName selaras
UPDATE "Settings" 
SET "storeName" = 'MUKI RAMEN' 
WHERE "tenantId" = 'tenant-vamos-pool';

COMMIT;

-- Verifikasi hasil
SELECT id, name, slug, "customDomain", status FROM "Tenant" WHERE id IN ('tenant-vamos-pool', 'tenant-default-muki');
SELECT id, username, "tenantId" FROM "User" WHERE id = 11;
SELECT "userId", "tenantId", "roleId", status FROM "TenantMembership" WHERE "userId" = 11;
`.trim();

const conn = new Client();
conn.on('ready', () => {
  console.log('✅ Connected to VPS.');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const stream = sftp.createWriteStream('/tmp/migrate_mukiramen.sql');
    stream.on('close', () => {
      console.log('✅ Uploaded /tmp/migrate_mukiramen.sql');
      conn.exec('sudo -u postgres psql -d poscafe_db -f /tmp/migrate_mukiramen.sql && rm -f /tmp/migrate_mukiramen.sql', (err2, execStream) => {
        if (err2) throw err2;
        execStream.on('data', d => process.stdout.write(d));
        execStream.stderr.on('data', d => process.stderr.write(d));
        execStream.on('close', (code) => {
          console.log(`\n✅ Migration executed with exit code: ${code}`);
          // Restart pm2 poscafe-backend to clear any in-memory cache
          conn.exec('pm2 restart poscafe-backend', (err3, restartStream) => {
            if (err3) throw err3;
            restartStream.on('data', d => process.stdout.write(d));
            restartStream.on('close', () => {
              console.log('✅ poscafe-backend restarted successfully.');
              conn.end();
            });
          });
        });
      });
    });
    stream.end(sql);
  });
}).on('error', err => console.error('Connection error:', err)).connect(VPS_CONFIG);
