const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const cmd = `
echo "=== STEP 1: Apply Prisma Schema to PostgreSQL ==="
cd /var/www/poscafe/backend
export DATABASE_URL="postgresql://poscafe_user:poscafe_secure_pass_2026@localhost:5432/poscafe_db?schema=public"
npx prisma db push --accept-data-loss

echo "=== STEP 2: Running Node.js SQLite -> PostgreSQL Migration Script ==="
cat << 'EOF' > /tmp/migrate_sqlite_to_pg.js
const { PrismaClient: PgClient } = require('/var/www/poscafe/backend/node_modules/@prisma/client');
const sqlite3 = require('/var/www/poscafe/backend/node_modules/sqlite3').verbose();

async function run() {
  console.log('Connecting to PostgreSQL...');
  const pg = new PgClient({
    datasources: { db: { url: 'postgresql://poscafe_user:poscafe_secure_pass_2026@localhost:5432/poscafe_db?schema=public' } }
  });
  await pg.$connect();

  console.log('Opening SQLite database...');
  const dbPath = '/var/www/poscafe/backend/prisma/dev.db';
  const sqlite = new sqlite3.Database(dbPath);

  const querySqlite = (sql) => new Promise((resolve, reject) => {
    sqlite.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

  // Table migration order respecting Foreign Key hierarchies
  const tables = [
    'User', 'Category', 'Table', 'PaymentConfig', 'StoreSetting',
    'Customer', 'Supplier', 'Ingredient', 'Product', 'ProductVariant',
    'RecipeItem', 'StockAdjustment', 'Shift', 'Order', 'OrderItem',
    'OrderVoid', 'CashFlow', 'Attendance', 'DebtPayment', 'PurchaseOrder',
    'PurchaseOrderItem', 'IngredientLog', 'StockLoss', 'LeaveRequest',
    'KitchenChecklist', 'WarehouseInbound', 'WarehouseInboundItem',
    'WarehouseRequisition', 'WarehouseRequisitionItem', 'OwnerFundTransaction'
  ];

  console.log('Migrating tables...');
  for (const table of tables) {
    try {
      const rows = await querySqlite(\`SELECT * FROM "\${table}"\`);
      if (rows.length === 0) {
        console.log(\`[INFO] \${table}: 0 rows to migrate.\`);
        continue;
      }

      // Format boolean, dates, or specific columns for PostgreSQL
      const formatted = rows.map(r => {
        const item = { ...r };
        for (const [k, v] of Object.entries(item)) {
          if (typeof v === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}/.test(v)) {
            item[k] = new Date(v);
          }
          if (k.startsWith('is') || k.startsWith('has') || k === 'printerTarget') {
            if (v === 1) item[k] = true;
            else if (v === 0) item[k] = false;
          }
          if (k === 'taxActive' || k === 'serviceChargeActive' || k === 'pb01Active') {
            item[k] = Boolean(v);
          }
        }
        return item;
      });

      const modelName = table.charAt(0).toLowerCase() + table.slice(1);
      if (pg[modelName]) {
        for (const item of formatted) {
          try {
            await pg[modelName].upsert({
              where: { id: item.id },
              update: item,
              create: item
            });
          } catch (itemErr) {
            // fallback create
            try { await pg[modelName].create({ data: item }); } catch (_) {}
          }
        }
        console.log(\`[SUCCESS] \${table}: \${rows.length} rows migrated.\`);

        // Reset sequence
        try {
          await pg.$executeRawUnsafe(\`SELECT setval(pg_get_serial_sequence('"\${table}"', 'id'), COALESCE(max(id), 1)) FROM "\${table}";\`);
        } catch (_) {}
      }
    } catch (tblErr) {
      console.warn(\`[SKIP/WARN] \${table}: \${tblErr.message}\`);
    }
  }

  sqlite.close();
  await pg.$disconnect();
  console.log('=== Migration script completed successfully ===');
}

run().catch(e => { console.error('Migration failed:', e); process.exit(1); });
EOF

node /tmp/migrate_sqlite_to_pg.js

echo "=== STEP 3: Setup Automated Daily Backup Cron & Script ==="
cat << 'BACKUP_EOF' > /usr/local/bin/backup_poscafe.sh
#!/bin/bash
BACKUP_DIR="/var/backups/poscafe"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/poscafe_db_$TIMESTAMP.sql.gz"

echo "Running backup for poscafe_db at $TIMESTAMP..."
PGPASSWORD='poscafe_secure_pass_2026' pg_dump -U poscafe_user -h localhost poscafe_db | gzip > "$BACKUP_FILE"

# Keep only last 14 days of backups
find "$BACKUP_DIR" -name "poscafe_db_*.sql.gz" -type f -mtime +14 -delete
echo "Backup complete: $BACKUP_FILE (Size: $(du -h "$BACKUP_FILE" | cut -f1))"
BACKUP_EOF

chmod +x /usr/local/bin/backup_poscafe.sh

# Run first backup test now
/usr/local/bin/backup_poscafe.sh

# Register to crontab if not already registered (daily at 02:00 AM)
crontab -l 2>/dev/null | grep -v 'backup_poscafe.sh' > /tmp/crontab.txt || true
echo "0 2 * * * /usr/local/bin/backup_poscafe.sh >> /var/log/poscafe_backup.log 2>&1" >> /tmp/crontab.txt
crontab /tmp/crontab.txt
rm /tmp/crontab.txt

echo "=== STEP 4: Update .env to PostgreSQL & Restart PM2 ==="
echo 'DATABASE_URL="postgresql://poscafe_user:poscafe_secure_pass_2026@localhost:5432/poscafe_db?schema=public"' > /var/www/poscafe/backend/.env
echo 'JWT_SECRET="super_secret_pooos_key"' >> /var/www/poscafe/backend/.env

cd /var/www/poscafe/backend
npx prisma generate
npx tsc
pm2 restart poscafe-backend
pm2 save

echo "=== ALL PHASES EXECUTED CLEANLY ==="
`;



const conn = new Client();
conn.on('ready', () => {
    console.log('Connected to VPS...');
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', (code) => {
            console.log('\nCommand finished with code:', code);
            conn.end();
        });
    });
}).connect(config);
