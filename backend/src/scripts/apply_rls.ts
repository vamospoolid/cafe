import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BUSINESS_TABLES = [
  'Category',
  'Product',
  'Table',
  'Reservation',
  'Customer',
  'PointLog',
  'Order',
  'CashFlow',
  'Attendance',
  'Settings',
  'Shift',
  'Supplier',
  'Ingredient',
  'IngredientLog',
  'PurchaseOrder',
  'Debt',
  'DebtPayment',
  'LeaveRequest',
  'ShiftHandover',
  'KitchenChecklist',
  'WarehouseInbound',
  'WarehouseRequisition',
  'OwnerFundTransaction',
  'WarehouseSale',
  'EmployeeLoan',
  'TenantPaymentConfig',
  'AuditLog',
  'UsageRecord',
  'Subscription',
  'Invoice',
  'PaymentTransaction',
  'TenantFeature'
];

export async function applyRLSPolicies() {
  console.log('\n🔒 === MENERAPKAN ROW LEVEL SECURITY (RLS) POSTGRESQL === 🔒\n');

  try {
    // 1. Buat Application Role khusus 'codepos_app' (Non-Superuser) untuk kepatuhan RLS
    try {
      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'codepos_app') THEN
            CREATE ROLE codepos_app WITH LOGIN PASSWORD 'codepos_secure_app_2026';
          END IF;
        END $$;
      `);
      await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO codepos_app;`);
      await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO codepos_app;`);
      await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON SCHEMA public TO codepos_app;`);
      console.log(' ✅ Dedicated Application Role "codepos_app" created and privileges granted.');
    } catch (roleErr: any) {
      console.warn(' ℹ️ Role creation note:', roleErr?.message || roleErr);
    }

    let successCount = 0;

    for (const tbl of BUSINESS_TABLES) {
      try {
        // 1. Enable RLS on table
        await prisma.$executeRawUnsafe(`ALTER TABLE "${tbl}" ENABLE ROW LEVEL SECURITY;`);

        // 2. Force RLS on table (so table owners also obey policy)
        await prisma.$executeRawUnsafe(`ALTER TABLE "${tbl}" FORCE ROW LEVEL SECURITY;`);

        // 3. Drop existing policy if present
        await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS tenant_isolation_policy ON "${tbl}";`);

        // 4. Create Tenant Isolation Policy
        const policySql = `
          CREATE POLICY tenant_isolation_policy ON "${tbl}"
          FOR ALL
          USING (
            current_setting('app.current_tenant_id', true) = 'PLATFORM_SUPERADMIN'
            OR "tenantId" = current_setting('app.current_tenant_id', true)
            OR ("tenantId" IS NULL AND (current_setting('app.current_tenant_id', true) IS NULL OR current_setting('app.current_tenant_id', true) = ''))
          )
          WITH CHECK (
            current_setting('app.current_tenant_id', true) = 'PLATFORM_SUPERADMIN'
            OR "tenantId" = current_setting('app.current_tenant_id', true)
          );
        `;
        await prisma.$executeRawUnsafe(policySql);

        console.log(` ✅ RLS Policy applied to: "${tbl}"`);
        successCount++;
      } catch (err: any) {
        console.warn(` ⚠️ Table "${tbl}" skipped or notice: ${err?.message || err}`);
      }
    }

    console.log(`\n🎉 Berhasil mengaktifkan RLS pada ${successCount} dari ${BUSINESS_TABLES.length} tabel bisnis!`);

    // Verifikasi tabel-tabel yang telah aktif RLS di PostgreSQL catalog
    const rlsTables: any = await prisma.$queryRawUnsafe(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public' AND rowsecurity = true
      ORDER BY tablename ASC;
    `);

    console.log(`\n📋 Verifikasi Katalog PostgreSQL (Total: ${rlsTables.length} tabel terproteksi RLS):`);
    rlsTables.forEach((t: any) => {
      console.log(`   🛡️ ${t.tablename}`);
    });

    return rlsTables;
  } catch (error: any) {
    console.error('❌ Gagal menerapkan RLS policies:', error?.message || error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  applyRLSPolicies()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
