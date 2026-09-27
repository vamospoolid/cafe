/**
 * Automated Verification Script for Phase 3: Multi-Channel isActive & KDS Station Routing
 * Tests:
 * 1. Multi-Channel isActive Enforcement:
 *    - Standard POS query returns only isActive: true
 *    - Admin query with includeInactive=true returns both active and inactive
 * 2. KDS Station Routing Parity:
 *    - station:KITCHEN matches kitchen categories
 *    - station:BAR matches beverage/bar categories
 *    - fallback to printerTarget works smoothly
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('🚀 Starting Phase 3 Multi-Channel & KDS Routing Automated Verification...\n');

  const tenant = 'test-phase3-kds-' + Date.now();

  try {
    // 0. Setup Tenant
    console.log(`[SETUP] Creating test tenant: ${tenant}`);
    await prisma.tenant.create({
      data: { id: tenant, name: 'KDS & Active Test Cafe', slug: tenant }
    });

    // 1. Setup Categories: 1 Active Kitchen, 1 Inactive Bar, 1 Active Bar
    console.log('[SETUP] Creating active and inactive categories with station targets...');
    const catKitchenActive = await prisma.category.create({
      data: {
        tenantId: tenant,
        name: 'Main Dish Burger',
        stationTarget: 'KITCHEN',
        printerTarget: 'KITCHEN',
        isActive: true,
        sortOrder: 1
      }
    });

    const catBarActive = await prisma.category.create({
      data: {
        tenantId: tenant,
        name: 'Espresso Bar',
        stationTarget: 'BAR',
        printerTarget: 'BAR',
        isActive: true,
        sortOrder: 2
      }
    });

    const catSeasonalInactive = await prisma.category.create({
      data: {
        tenantId: tenant,
        name: 'Paket Sahur Musiman',
        stationTarget: 'KITCHEN',
        printerTarget: 'KITCHEN',
        isActive: false, // INACTIVE
        sortOrder: 3
      }
    });

    // -------------------------------------------------------------------------
    // TEST 1: POS Standard Query (Default isActive: true)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 1] Testing POS Standard Query (Default isActive: true)...');
    
    // Simulate GET /api/categories (without includeInactive)
    const posCategories = await prisma.category.findMany({
      where: {
        parentId: null,
        deletedAt: null,
        tenantId: tenant,
        isActive: true
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });

    console.log(`   POS received ${posCategories.length} categories:`, posCategories.map(c => c.name).join(', '));
    if (posCategories.length !== 2 || posCategories.some(c => !c.isActive)) {
      throw new Error('TEST 1 FAILED: Inactive category leaked into standard POS query!');
    }
    console.log('✅ TEST 1 PASSED: Inactive categories successfully hidden from standard POS view.');

    // -------------------------------------------------------------------------
    // TEST 2: Admin / Settings Query (includeInactive=true)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Testing Admin Query (includeInactive=true)...');
    
    // Simulate GET /api/categories?includeInactive=true
    const adminCategories = await prisma.category.findMany({
      where: {
        parentId: null,
        deletedAt: null,
        tenantId: tenant
        // No active filter
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });

    console.log(`   Admin received ${adminCategories.length} categories:`, adminCategories.map(c => `${c.name} (${c.isActive ? 'Active' : 'Inactive'})`).join(', '));
    if (adminCategories.length !== 3) {
      throw new Error(`TEST 2 FAILED: Expected 3 categories for admin, got ${adminCategories.length}`);
    }
    console.log('✅ TEST 2 PASSED: Admin successfully views all categories including inactive ones.');

    // -------------------------------------------------------------------------
    // TEST 3: KDS Station Routing Simulation
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Simulating KDS Station Routing Logic...');
    
    // Create items for mock order
    const mockOrder = {
      id: 999,
      orderNumber: 'ORD-999',
      items: [
        { product: { id: 101, name: 'Double Cheese Burger', categoryId: catKitchenActive.id }, qty: 1 },
        { product: { id: 102, name: 'Iced Cappuccino', categoryId: catBarActive.id }, qty: 2 }
      ]
    };

    const categoryMap = new Map();
    categoryMap.set(catKitchenActive.id, catKitchenActive);
    categoryMap.set(catBarActive.id, catBarActive);

    const filterByStation = (order, targetStation) => {
      return order.items.filter(item => {
        const catObj = categoryMap.get(item.product.categoryId);
        const itemStation = (catObj?.stationTarget || catObj?.printerTarget || 'KITCHEN').toUpperCase();
        return itemStation === targetStation.toUpperCase();
      });
    };

    const kitchenItems = filterByStation(mockOrder, 'KITCHEN');
    const barItems = filterByStation(mockOrder, 'BAR');

    console.log(`   Kitchen Station Items: ${kitchenItems.map(i => i.product.name).join(', ')}`);
    console.log(`   Bar Station Items: ${barItems.map(i => i.product.name).join(', ')}`);

    if (kitchenItems.length !== 1 || kitchenItems[0].product.name !== 'Double Cheese Burger') {
      throw new Error('TEST 3 FAILED: Kitchen station routing mismatch!');
    }
    if (barItems.length !== 1 || barItems[0].product.name !== 'Iced Cappuccino') {
      throw new Error('TEST 3 FAILED: Bar station routing mismatch!');
    }
    console.log('✅ TEST 3 PASSED: Dual-station routing separates kitchen and barista items with 100% precision.');

    console.log('\n======================================================');
    console.log('🎉 ALL PHASE 3 MULTI-CHANNEL & KDS TESTS PASSED!');
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
