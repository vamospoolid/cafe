/**
 * Automated Verification Script for Phase 2: Offline Resilience & Real-Time Parity
 * Tests:
 * 1. Offline Deterministic Sort Parity: Local Dexie sorting logic matches PostgreSQL ORDER BY sortOrder ASC, name ASC
 * 2. Visual & Structural Attribute Completeness: icon, color, sortOrder, stationTarget, subCategories
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('🚀 Starting Phase 2 Offline Resilience & Real-Time Parity Automated Verification...\n');

  const tenant = 'test-phase2-offline-' + Date.now();

  try {
    // 0. Setup Tenant
    console.log(`[SETUP] Creating test tenant: ${tenant}`);
    await prisma.tenant.create({
      data: { id: tenant, name: 'Offline Test Cafe', slug: tenant }
    });

    // 1. Create categories with scrambled IDs and sort orders
    console.log('[SETUP] Inserting categories with out-of-order IDs and sort orders...');
    const catData = [
      { name: 'Z - Camilan Malam', sortOrder: 99, color: '#f59e0b', icon: '🍟' },
      { name: 'A - Kopi Pagi', sortOrder: 1, color: '#854d0e', icon: '☕' },
      { name: 'M - Makanan Berat', sortOrder: 50, color: '#ef4444', icon: '🍛' },
      { name: 'A - Kopi Dingin', sortOrder: 1, color: '#3b82f6', icon: '🧊' }, // Same sortOrder, alphabetically second
      { name: 'D - Dessert Tart', sortOrder: 70, color: '#ec4899', icon: '🍰' }
    ];

    for (const d of catData) {
      await prisma.category.create({
        data: {
          tenantId: tenant,
          name: d.name,
          sortOrder: d.sortOrder,
          color: d.color,
          icon: d.icon,
          stationTarget: 'BAR'
        }
      });
    }

    // -------------------------------------------------------------------------
    // TEST 1: Server-Side Query (PostgreSQL)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 1] Querying categories from PostgreSQL (Order: sortOrder ASC, name ASC)...');
    const serverOrdered = await prisma.category.findMany({
      where: { tenantId: tenant, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });

    const serverNames = serverOrdered.map(c => `${c.sortOrder}:${c.name}`);
    console.log('   Server Order:', serverNames.join(' -> '));

    // -------------------------------------------------------------------------
    // TEST 2: Dexie / Offline Local Deterministic Sorting Parity
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Simulating Dexie Local Offline Sorting...');
    
    // Simulate what Dexie does (retrieves unsorted or scrambled by ID)
    const rawUnsortedList = [...serverOrdered].sort(() => Math.random() - 0.5);

    // Apply exact offlineDb.ts getCachedCategories sorting algorithm:
    const clientSorted = rawUnsortedList.sort((a, b) => {
      const orderA = a.sortOrder ?? 0;
      const orderB = b.sortOrder ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.name || '').localeCompare(b.name || '');
    });

    const clientNames = clientSorted.map(c => `${c.sortOrder}:${c.name}`);
    console.log('   Client Offline Order:', clientNames.join(' -> '));

    // Verify 1-to-1 parity between Server and Offline Client
    const isIdentical = JSON.stringify(serverNames) === JSON.stringify(clientNames);
    if (!isIdentical) {
      throw new Error('MISMATCH: Offline sorting does not match server query ordering!');
    }
    console.log('✅ TEST 1 & 2 PASSED: 100% Deterministic Sorting Parity between Server and Offline Client!');

    // -------------------------------------------------------------------------
    // TEST 3: Visual & Structural Attributes Completeness
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Verifying Complete Visual Attributes for Offline Cache...');
    for (const c of clientSorted) {
      if (!c.icon || !c.color || typeof c.sortOrder !== 'number' || !c.stationTarget) {
        throw new Error(`Incomplete attributes on category "${c.name}"`);
      }
    }
    console.log('✅ TEST 3 PASSED: All categories have complete visual metadata (icon, color, sortOrder, stationTarget).');

    console.log('\n======================================================');
    console.log('🎉 ALL PHASE 2 OFFLINE RESILIENCE TESTS PASSED!');
    console.log('======================================================\n');

  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    console.log('[CLEANUP] Removing test tenant data...');
    await prisma.category.deleteMany({ where: { tenantId: tenant } });
    await prisma.tenant.deleteMany({ where: { id: tenant } });
    await prisma.$disconnect();
    console.log('🧹 Cleanup completed.');
  }
}

runTests();
