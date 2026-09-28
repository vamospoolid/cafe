/**
 * ==============================================================================
 * SYNC CATALOG TO VPS (poscafe_db)
 * ==============================================================================
 * Script ini mengekstrak katalog produk dan kategori lokal (Vamos Pool & Cafe)
 * dan menginjeksinya secara bersih ke database poscafe_db di VPS.
 * ==============================================================================
 */

const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const { Client } = require('ssh2');
const fs = require('fs');

const prisma = new PrismaClient();

const VPS_CONFIG = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07',
  readyTimeout: 30000
};

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (val instanceof Date) return `'${val.toISOString()}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function generateSql() {
  console.log('📦 1. Mengambil data dari database lokal...');
  
  const tenant = await prisma.tenant.findUnique({
    where: { id: 'tenant-vamos-pool' }
  });

  const categories = await prisma.category.findMany({
    where: { tenantId: 'tenant-vamos-pool' },
    orderBy: { id: 'asc' }
  });

  const products = await prisma.product.findMany({
    where: { tenantId: 'tenant-vamos-pool' },
    orderBy: { id: 'asc' }
  });

  const suppliers = await prisma.supplier.findMany({
    orderBy: { id: 'asc' }
  });

  const ingredients = await prisma.ingredient.findMany({
    orderBy: { id: 'asc' }
  });

  const recipes = await prisma.recipeItem.findMany({
    where: {
      productId: { in: products.map(p => p.id) }
    },
    orderBy: { id: 'asc' }
  });

  const users = await prisma.user.findMany({
    where: { username: { in: ['admin', 'kasir'] } }
  });

  console.log(`📊 Statistik Data Lokal:`);
  console.log(`   - Tenant: ${tenant?.name || 'VAMOS POOL & CAFE'} (${tenant?.id})`);
  console.log(`   - Kategori: ${categories.length} item`);
  console.log(`   - Produk: ${products.length} item`);
  console.log(`   - Supplier: ${suppliers.length} item`);
  console.log(`   - Bahan Baku (Ingredients): ${ingredients.length} item`);
  console.log(`   - Resep (Recipes): ${recipes.length} item`);
  console.log(`   - User: ${users.map(u => u.username).join(', ')}`);

  let sql = `-- ==========================================================\n`;
  sql += `-- MIGRATION SCRIPT: SYNC LOCAL CATALOG TO VPS POSCAFE_DB\n`;
  sql += `-- Generated at: ${new Date().toISOString()}\n`;
  sql += `-- ==========================================================\n\n`;
  sql += `BEGIN;\n\n`;

  // 1. Tenant Upsert
  sql += `-- 1. UPSERT TENANT VAMOS POOL\n`;
  sql += `INSERT INTO "Tenant" (id, name, slug, status, "businessType", "createdAt", "updatedAt")\n`;
  sql += `VALUES ('tenant-vamos-pool', 'VAMOS POOL & CAFE', 'vamospool', 'ACTIVE', 'CAFE', NOW(), NOW())\n`;
  sql += `ON CONFLICT (id) DO UPDATE SET\n`;
  sql += `  name = EXCLUDED.name,\n`;
  sql += `  slug = EXCLUDED.slug,\n`;
  sql += `  status = EXCLUDED.status,\n`;
  sql += `  "businessType" = EXCLUDED."businessType",\n`;
  sql += `  "updatedAt" = NOW();\n\n`;

  // 2. Clean old test transactions & catalog
  sql += `-- 2. CLEAN OLD TEST DATA & CATALOG (CASCADE SAFE)\n`;
  sql += `TRUNCATE TABLE \n`;
  sql += `  "OrderItem",\n`;
  sql += `  "Order",\n`;
  sql += `  "DeliveryOrder",\n`;
  sql += `  "PaymentTransaction",\n`;
  sql += `  "DebtPayment",\n`;
  sql += `  "Debt",\n`;
  sql += `  "RecipeItem",\n`;
  sql += `  "WasteLog",\n`;
  sql += `  "ProductPriceTier",\n`;
  sql += `  "ProductUOM",\n`;
  sql += `  "WorkOrderPart",\n`;
  sql += `  "PartRequest",\n`;
  sql += `  "SupplierInvoiceItem",\n`;
  sql += `  "WarehouseInboundItem",\n`;
  sql += `  "WarehouseRequisitionItem",\n`;
  sql += `  "WarehouseSaleItem",\n`;
  sql += `  "PurchaseOrderItem",\n`;
  sql += `  "Product",\n`;
  sql += `  "Category"\n`;
  sql += `CASCADE;\n\n`;

  // 3. Insert Categories (root categories first, then child categories)
  sql += `-- 3. INSERT CATEGORIES\n`;
  // First root categories (parentId IS NULL)
  const rootCats = categories.filter(c => !c.parentId);
  const childCats = categories.filter(c => c.parentId);

  for (const c of rootCats) {
    sql += `INSERT INTO "Category" (id, "tenantId", name, icon, color, "sortOrder", "printerTarget", "stationTarget", "isActive", "parentId", "deletedAt")\n`;
    sql += `VALUES (${c.id}, ${escapeSql(c.tenantId)}, ${escapeSql(c.name)}, ${escapeSql(c.icon)}, ${escapeSql(c.color)}, ${c.sortOrder}, ${escapeSql(c.printerTarget)}, ${escapeSql(c.stationTarget)}, ${escapeSql(c.isActive)}, NULL, ${escapeSql(c.deletedAt)});\n`;
  }
  for (const c of childCats) {
    sql += `INSERT INTO "Category" (id, "tenantId", name, icon, color, "sortOrder", "printerTarget", "stationTarget", "isActive", "parentId", "deletedAt")\n`;
    sql += `VALUES (${c.id}, ${escapeSql(c.tenantId)}, ${escapeSql(c.name)}, ${escapeSql(c.icon)}, ${escapeSql(c.color)}, ${c.sortOrder}, ${escapeSql(c.printerTarget)}, ${escapeSql(c.stationTarget)}, ${escapeSql(c.isActive)}, ${c.parentId}, ${escapeSql(c.deletedAt)});\n`;
  }
  sql += `SELECT setval(pg_get_serial_sequence('"Category"', 'id'), coalesce(max(id), 1)) FROM "Category";\n\n`;

  // 4. Insert Suppliers (clean old or upsert)
  if (suppliers.length > 0) {
    sql += `-- 4. UPSERT SUPPLIERS\n`;
    for (const s of suppliers) {
      sql += `INSERT INTO "Supplier" (id, "tenantId", name, contact, phone, email, address, notes, "deletedAt", "createdAt", "updatedAt")\n`;
      sql += `VALUES (${s.id}, ${escapeSql(s.tenantId)}, ${escapeSql(s.name)}, ${escapeSql(s.contact)}, ${escapeSql(s.phone)}, ${escapeSql(s.email)}, ${escapeSql(s.address)}, ${escapeSql(s.notes)}, ${escapeSql(s.deletedAt)}, ${escapeSql(s.createdAt)}, ${escapeSql(s.updatedAt)})\n`;
      sql += `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, contact = EXCLUDED.contact, phone = EXCLUDED.phone, address = EXCLUDED.address;\n`;
    }
    sql += `SELECT setval(pg_get_serial_sequence('"Supplier"', 'id'), coalesce(max(id), 1)) FROM "Supplier";\n\n`;
  }

  // 5. Insert Ingredients (upsert)
  if (ingredients.length > 0) {
    sql += `-- 5. UPSERT INGREDIENTS\n`;
    for (const ing of ingredients) {
      sql += `INSERT INTO "Ingredient" (id, "tenantId", name, category, "subCategory", unit, stock, "minStock", "buyPrice", "supplierId", "deletedAt", "purchaseUnit", "conversionRatio", "warehouseStock", "warehouseMinStock", "createdAt", "updatedAt")\n`;
      sql += `VALUES (${ing.id}, ${escapeSql(ing.tenantId)}, ${escapeSql(ing.name)}, ${escapeSql(ing.category)}, ${escapeSql(ing.subCategory)}, ${escapeSql(ing.unit)}, ${ing.stock}, ${ing.minStock}, ${ing.buyPrice}, ${escapeSql(ing.supplierId)}, ${escapeSql(ing.deletedAt)}, ${escapeSql(ing.purchaseUnit)}, ${ing.conversionRatio}, ${ing.warehouseStock}, ${ing.warehouseMinStock}, ${escapeSql(ing.createdAt)}, ${escapeSql(ing.updatedAt)})\n`;
      sql += `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, stock = EXCLUDED.stock, "buyPrice" = EXCLUDED."buyPrice", "minStock" = EXCLUDED."minStock";\n`;
    }
    sql += `SELECT setval(pg_get_serial_sequence('"Ingredient"', 'id'), coalesce(max(id), 1)) FROM "Ingredient";\n\n`;
  }

  // 6. Insert Products
  sql += `-- 6. INSERT PRODUCTS (${products.length} items)\n`;
  for (const p of products) {
    sql += `INSERT INTO "Product" (id, "tenantId", barcode, name, "categoryId", "subCategoryId", "buyPrice", "sellPrice", stock, "minStock", "imageUrl", status, "deletedAt", "sellPriceRetail", "sellPriceMitra", "sellPriceGrosir", "minQtyGrosir", brand, "vehicleType", "storageLocation", "baseUom", "createdAt", "updatedAt")\n`;
    sql += `VALUES (${p.id}, ${escapeSql(p.tenantId)}, ${escapeSql(p.barcode)}, ${escapeSql(p.name)}, ${p.categoryId}, ${escapeSql(p.subCategoryId)}, ${p.buyPrice}, ${p.sellPrice}, ${p.stock}, ${p.minStock}, ${escapeSql(p.imageUrl)}, ${escapeSql(p.status)}, ${escapeSql(p.deletedAt)}, ${escapeSql(p.sellPriceRetail)}, ${escapeSql(p.sellPriceMitra)}, ${escapeSql(p.sellPriceGrosir)}, ${escapeSql(p.minQtyGrosir)}, ${escapeSql(p.brand)}, ${escapeSql(p.vehicleType)}, ${escapeSql(p.storageLocation)}, ${escapeSql(p.baseUom)}, ${escapeSql(p.createdAt)}, ${escapeSql(p.updatedAt)});\n`;
  }
  sql += `SELECT setval(pg_get_serial_sequence('"Product"', 'id'), coalesce(max(id), 1)) FROM "Product";\n\n`;

  // 7. Insert Recipes
  if (recipes.length > 0) {
    sql += `-- 7. INSERT RECIPES (${recipes.length} items)\n`;
    for (const r of recipes) {
      sql += `INSERT INTO "RecipeItem" (id, "tenantId", "productId", "ingredientId", "qtyPerServing")\n`;
      sql += `VALUES (${r.id}, ${escapeSql(r.tenantId)}, ${r.productId}, ${r.ingredientId}, ${r.qtyPerServing});\n`;
    }
    sql += `SELECT setval(pg_get_serial_sequence('"RecipeItem"', 'id'), coalesce(max(id), 1)) FROM "RecipeItem";\n\n`;
  }

  // 8. Users & TenantMembership
  sql += `-- 8. ENSURE USERS & TENANT MEMBERSHIP\n`;
  const { randomUUID } = require('crypto');
  for (const u of users) {
    const membershipId = randomUUID();
    sql += `INSERT INTO "User" (username, name, role, permissions, "passwordHash", pin, status, "createdAt", "updatedAt")\n`;
    sql += `VALUES (${escapeSql(u.username)}, ${escapeSql(u.username)}, ${escapeSql(u.role)}, ${escapeSql(u.permissions || '["*"]')}, ${escapeSql(u.passwordHash)}, ${escapeSql(u.pin)}, 'ACTIVE', NOW(), NOW())\n`;
    sql += `ON CONFLICT (username) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", pin = EXCLUDED.pin, permissions = EXCLUDED.permissions, status = 'ACTIVE';\n`;
    
    // Link to tenant-vamos-pool in TenantMembership
    sql += `INSERT INTO "TenantMembership" (id, "userId", "tenantId", status, "employmentType", "createdAt", "updatedAt")\n`;
    sql += `SELECT '${membershipId}', u.id, 'tenant-vamos-pool', 'ACTIVE', 'FULL_TIME', NOW(), NOW()\n`;
    sql += `FROM "User" u WHERE u.username = ${escapeSql(u.username)}\n`;
    sql += `ON CONFLICT ("userId", "tenantId") DO UPDATE SET status = 'ACTIVE';\n`;
  }

  sql += `\nCOMMIT;\n`;

  return sql;
}

async function executeOnVps(sql) {
  console.log('🚀 2. Mengirim dan mengeksekusi SQL di VPS...');
  
  const tmpSqlPath = '/tmp/sync_vamos_catalog.sql';

  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      console.log('✅ Terhubung ke VPS via SSH.');

      // Upload SQL via SFTP
      conn.sftp((err, sftp) => {
        if (err) return reject(err);

        const writeStream = sftp.createWriteStream(tmpSqlPath);
        writeStream.on('close', () => {
          console.log(`📁 File SQL berhasil di-upload ke ${tmpSqlPath}`);

          // Jalankan psql
          const cmd = `sudo -u postgres psql -d poscafe_db -f ${tmpSqlPath} && rm -f ${tmpSqlPath}`;
          console.log(`⚡ Menjalankan psql di database poscafe_db...`);

          conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);

            let stdout = '';
            let stderr = '';

            stream.on('data', (d) => stdout += d);
            stream.stderr.on('data', (d) => stderr += d);

            stream.on('close', (code) => {
              if (code !== 0) {
                console.error('❌ Terjadi kesalahan saat eksekusi psql:');
                console.error(stderr || stdout);
                conn.end();
                return reject(new Error(`psql exited with code ${code}`));
              }

              console.log('✨ Output psql berhasil:');
              console.log(stdout.slice(0, 500) + '...\n[Truncated]');

              // Verifikasi hasil akhir di database
              conn.exec(`sudo -u postgres psql -d poscafe_db -c 'SELECT count(*) as total_category FROM "Category"; SELECT count(*) as total_product FROM "Product"; SELECT count(*) as total_order FROM "Order"; SELECT id, name, "sellPrice" FROM "Product" LIMIT 5;'`, (err, verifyStream) => {
                if (err) return reject(err);

                let verifyOut = '';
                verifyStream.on('data', (d) => verifyOut += d);
                verifyStream.on('close', () => {
                  console.log('\n🔍 HASIL VERIFIKASI DI VPS poscafe_db:');
                  console.log(verifyOut);
                  conn.end();
                  resolve();
                });
              });
            });
          });
        });

        writeStream.end(sql);
      });
    });

    conn.on('error', (err) => {
      console.error('❌ Gagal terhubung ke VPS:', err);
      reject(err);
    });

    conn.connect(VPS_CONFIG);
  });
}

async function main() {
  try {
    const sql = await generateSql();
    fs.writeFileSync(path.resolve(__dirname, 'last_catalog_sync.sql'), sql);
    console.log('💾 File SQL lokal disimpan ke scripts/last_catalog_sync.sql');
    await executeOnVps(sql);
    console.log('\n🎉 PROSES PENGGANTIAN PRODUK & KATEGORI DI VPS SELESAI DENGAN SUKSES!');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
