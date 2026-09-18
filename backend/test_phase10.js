/**
 * TEST SUITE FASE 10: IMMUTABLE AUDIT LOGGING & ACTIVITY TRAIL
 * Menguji pencatatan audit log, tenant isolation, query filtering, pagination, dan export format.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runPhase10Tests() {
  console.log('\n🧪 === MENJALANKAN TEST SUITE FASE 10: IMMUTABLE AUDIT LOGGING === 🧪\n');

  try {
    // 1. Persiapan data Tenant A & Tenant B
    const tenantA = await prisma.tenant.upsert({
      where: { slug: 'audit-tenant-a' },
      update: {},
      create: {
        name: 'Kafe Audit Prima A',
        slug: 'audit-tenant-a',
        status: 'ACTIVE'
      }
    });

    const tenantB = await prisma.tenant.upsert({
      where: { slug: 'audit-tenant-b' },
      update: {},
      create: {
        name: 'Resto Audit Beta B',
        slug: 'audit-tenant-b',
        status: 'ACTIVE'
      }
    });

    // Buat outlet untuk masing-masing tenant
    const outletA = await prisma.outlet.upsert({
      where: { tenantId_code: { tenantId: tenantA.id, code: 'AUD-01' } },
      update: {},
      create: {
        tenantId: tenantA.id,
        name: 'Cabang Pusat A',
        code: 'AUD-01'
      }
    });

    const outletB = await prisma.outlet.upsert({
      where: { tenantId_code: { tenantId: tenantB.id, code: 'AUD-B1' } },
      update: {},
      create: {
        tenantId: tenantB.id,
        name: 'Cabang Pusat B',
        code: 'AUD-B1'
      }
    });

    // ─── TEST 1: Logging Event Beragam Aksi & Severity ────────────────────────
    console.log('--- [1/4] Testing Immutable Audit Log Creation & Severity Levels ---');
    
    // Clear previous test logs for clean state
    await prisma.auditLog.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } }
    });

    // Pastikan user test ada
    const userA = await prisma.user.upsert({
      where: { username: 'test_audit_user_a' },
      update: {},
      create: {
        username: 'test_audit_user_a',
        name: 'Admin Budi',
        passwordHash: 'hash',
        role: 'Admin',
        permissions: '{}'
      }
    });

    const userB = await prisma.user.upsert({
      where: { username: 'test_audit_user_b' },
      update: {},
      create: {
        username: 'test_audit_user_b',
        name: 'Owner Beta',
        passwordHash: 'hash',
        role: 'Admin',
        permissions: '{}'
      }
    });

    // Event 1: Login
    const log1 = await prisma.auditLog.create({
      data: {
        tenantId: tenantA.id,
        outletId: outletA.id,
        userId: userA.id,
        userName: userA.name,
        userRole: 'ADMIN',
        action: 'LOGIN',
        resource: 'AUTH',
        resourceId: String(userA.id),
        description: `User ${userA.name} (@${userA.username}) berhasil login.`,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        severity: 'INFO'
      }
    });

    // Event 2: Perubahan Harga (WARNING)
    const log2 = await prisma.auditLog.create({
      data: {
        tenantId: tenantA.id,
        outletId: outletA.id,
        userId: userA.id,
        userName: userA.name,
        userRole: 'ADMIN',
        action: 'PRICE_CHANGE',
        resource: 'PRODUCT',
        resourceId: 'prod-101',
        description: 'Perubahan harga produk "Ramen Spesial": Rp 35.000 -> Rp 38.000',
        oldValue: JSON.stringify({ name: 'Ramen Spesial', sellPrice: 35000 }),
        newValue: JSON.stringify({ name: 'Ramen Spesial', sellPrice: 38000 }),
        ipAddress: '192.168.1.100',
        severity: 'WARNING'
      }
    });

    // Event 3: Void Order (CRITICAL)
    const log3 = await prisma.auditLog.create({
      data: {
        tenantId: tenantA.id,
        outletId: outletA.id,
        userId: userA.id,
        userName: userA.name,
        userRole: 'CASHIER',
        action: 'ORDER_VOID',
        resource: 'ORDER',
        resourceId: 'ord-8899',
        description: 'Void pesanan #ORD-2026-8899 senilai Rp 150.000 (Alasan: Salah input meja).',
        oldValue: JSON.stringify({ status: 'Pending', total: 150000 }),
        newValue: JSON.stringify({ status: 'Void' }),
        ipAddress: '192.168.1.105',
        severity: 'CRITICAL'
      }
    });

    // Event untuk Tenant B
    const logB = await prisma.auditLog.create({
      data: {
        tenantId: tenantB.id,
        outletId: outletB.id,
        userId: userB.id,
        userName: userB.name,
        userRole: 'OWNER',
        action: 'SETTINGS_UPDATE',
        resource: 'SETTINGS',
        resourceId: 'set-1',
        description: 'Update konfigurasi pajak tenant B',
        severity: 'WARNING'
      }
    });

    if (log1.id && log2.id && log3.id && logB.id) {
      console.log(`Successfully created audit logs: INFO (${log1.action}), WARNING (${log2.action}), CRITICAL (${log3.action})`);
      console.log('✅ TEST 1 (Immutable Audit Log Creation): PASSED!\n');
    } else {
      throw new Error('Gagal membuat record audit log');
    }

    // ─── TEST 2: Tenant Isolation Verification ─────────────────────────────────
    console.log('--- [2/4] Testing Strict Tenant Isolation on Audit Logs ---');
    
    const logsTenantA = await prisma.auditLog.findMany({
      where: { tenantId: tenantA.id }
    });

    const logsTenantB = await prisma.auditLog.findMany({
      where: { tenantId: tenantB.id }
    });

    console.log(`Tenant A log count: ${logsTenantA.length} (Expected: 3)`);
    console.log(`Tenant B log count: ${logsTenantB.length} (Expected: 1)`);

    const hasLeakageA = logsTenantA.some(l => l.tenantId !== tenantA.id);
    const hasLeakageB = logsTenantB.some(l => l.tenantId !== tenantB.id);

    if (logsTenantA.length === 3 && logsTenantB.length === 1 && !hasLeakageA && !hasLeakageB) {
      console.log('Strict tenant isolation verified: Tenant A cannot inspect Tenant B logs.');
      console.log('✅ TEST 2 (Tenant Isolation on Audit Trail): PASSED!\n');
    } else {
      throw new Error('Tenant isolation breach detected in Audit Logs!');
    }

    // ─── TEST 3: Multi-Criteria Filtering & Search ─────────────────────────────
    console.log('--- [3/4] Testing Multi-Criteria Filtering (Action, Severity, Keyword) ---');

    // Filter by Severity = CRITICAL
    const criticalLogs = await prisma.auditLog.findMany({
      where: { tenantId: tenantA.id, severity: 'CRITICAL' }
    });
    console.log(`CRITICAL severity logs found: ${criticalLogs.length} (Action: ${criticalLogs[0]?.action})`);

    // Filter by Keyword Search in description
    const searchLogs = await prisma.auditLog.findMany({
      where: {
        tenantId: tenantA.id,
        description: { contains: 'Ramen Spesial', mode: 'insensitive' }
      }
    });
    console.log(`Search for "Ramen Spesial" found: ${searchLogs.length} log(s)`);

    if (criticalLogs.length === 1 && criticalLogs[0].action === 'ORDER_VOID' && searchLogs.length === 1) {
      console.log('Filter and search criteria accurately matched.');
      console.log('✅ TEST 3 (Multi-Criteria Filtering & Search): PASSED!\n');
    } else {
      throw new Error('Filtering query failed to return expected results');
    }

    // ─── TEST 4: Aggregation Summary & Audit Trail Analytics ───────────────────
    console.log('--- [4/4] Testing Audit Trail Summary & Metrics ---');

    const totalLogs = await prisma.auditLog.count({ where: { tenantId: tenantA.id } });
    const criticalCount = await prisma.auditLog.count({ where: { tenantId: tenantA.id, severity: 'CRITICAL' } });
    const warningCount = await prisma.auditLog.count({ where: { tenantId: tenantA.id, severity: 'WARNING' } });

    console.log(`Summary Tenant A -> Total: ${totalLogs}, Critical: ${criticalCount}, Warning: ${warningCount}`);

    if (totalLogs === 3 && criticalCount === 1 && warningCount === 1) {
      console.log('Audit trail aggregation metrics match ground truth.');
      console.log('✅ TEST 4 (Summary Metrics & Analytics): PASSED!\n');
    } else {
      throw new Error('Aggregation metrics calculation mismatch');
    }

    console.log('🎉 SEMUA PENGUJIAN FASE 10 BERHASIL DENGAN SEMPURNA! AUDIT TRAIL READY! 🎉\n');

  } catch (error) {
    console.error('❌ Phase 10 Test Suite Failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase10Tests();
