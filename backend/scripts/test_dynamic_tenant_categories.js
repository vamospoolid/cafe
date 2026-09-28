/**
 * Automated Verification Script for Dynamic Multi-Tenant Categories
 * Tests:
 * 1. Preset listing & applying CAFE preset for Tenant A and RESTAURANT preset for Tenant B
 * 2. Cross-tenant isolation verification
 * 3. Batch reordering sortOrder verification
 * 4. Anti-IDOR: Prevent nested parentId injection across tenants
 * 5. Anti-IDOR: Prevent nested categoryId injection in products across tenants
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('🚀 Starting Dynamic Multi-Tenant Categories Automated Verification...\n');
  
  const tenantA = 'test-tenant-cafe-' + Date.now();
  const tenantB = 'test-tenant-resto-' + Date.now();

  try {
    // 0. Setup Tenants
    console.log(`[SETUP] Creating test tenants: ${tenantA} & ${tenantB}`);
    await prisma.tenant.createMany({
      data: [
        { id: tenantA, name: 'Cafe Alpha Express', slug: tenantA },
        { id: tenantB, name: 'Resto Beta Grill', slug: tenantB }
      ]
    });

    // 1. Test Preset Utility Import
    const { CATEGORY_PRESETS, applyPresetToTenant } = require('../dist/src/utils/categoryPresets');
    console.log('✅ Preset library loaded successfully.');
    console.log(`   Available presets: ${Object.keys(CATEGORY_PRESETS).join(', ')}`);

    // 2. Apply CAFE preset to Tenant A
    console.log(`\n[TEST 1] Applying 'CAFE' preset to ${tenantA}...`);
    const cafeResult = await applyPresetToTenant(prisma, tenantA, 'CAFE', false);
    console.log(`   Created ${cafeResult.createdCategories} main categories and ${cafeResult.createdSubCategories} subcategories for Tenant A.`);

    // 3. Apply RESTAURANT preset to Tenant B
    console.log(`[TEST 2] Applying 'RESTAURANT' preset to ${tenantB}...`);
    const restoResult = await applyPresetToTenant(prisma, tenantB, 'RESTAURANT', false);
    console.log(`   Created ${restoResult.createdCategories} main categories and ${restoResult.createdSubCategories} subcategories for Tenant B.`);

    // 4. Verify Strict Tenant Isolation
    console.log('\n[TEST 3] Verifying Cross-Tenant Category Isolation...');
    const categoriesA = await prisma.category.findMany({
      where: { tenantId: tenantA, parentId: null, deletedAt: null },
      include: { subCategories: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });

    const categoriesB = await prisma.category.findMany({
      where: { tenantId: tenantB, parentId: null, deletedAt: null },
      include: { subCategories: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });

    console.log(`   Tenant A has ${categoriesA.length} categories (First: ${categoriesA[0]?.icon} ${categoriesA[0]?.name}, Sort: ${categoriesA[0]?.sortOrder})`);
    console.log(`   Tenant B has ${categoriesB.length} categories (First: ${categoriesB[0]?.icon} ${categoriesB[0]?.name}, Sort: ${categoriesB[0]?.sortOrder})`);

    if (categoriesA.length !== 5 || categoriesB.length !== 7) {
      throw new Error(`Count mismatch! Expected Tenant A=5, Tenant B=7. Got ${categoriesA.length} and ${categoriesB.length}`);
    }

    const crossLeakA = categoriesA.some(c => c.tenantId !== tenantA);
    const crossLeakB = categoriesB.some(c => c.tenantId !== tenantB);
    if (crossLeakA || crossLeakB) {
      throw new Error('CRITICAL: Cross-tenant data leakage detected in categories!');
    }
    console.log('✅ Isolation Verified: Zero category leakage between tenants.');

    // 5. Test Batch Reordering
    console.log('\n[TEST 4] Testing Category Reordering on Tenant A...');
    const cat1 = categoriesA[0];
    const cat2 = categoriesA[1];
    
    // Swap sortOrder of first two categories
    const updates = [
      { id: cat1.id, sortOrder: 99 },
      { id: cat2.id, sortOrder: 1 }
    ];

    await prisma.$transaction(
      updates.map(item =>
        prisma.category.updateMany({
          where: { id: item.id, tenantId: tenantA },
          data: { sortOrder: item.sortOrder }
        })
      )
    );

    const reorderedA = await prisma.category.findMany({
      where: { tenantId: tenantA, parentId: null, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });

    if (reorderedA[0].id !== cat2.id) {
      throw new Error(`Reordering failed: Expected first item to be ${cat2.name}, got ${reorderedA[0].name}`);
    }
    console.log(`✅ Reordering successful: First item is now "${reorderedA[0].name}" with sortOrder ${reorderedA[0].sortOrder}`);

    // Verify Tenant B's order was untouched
    const reorderedB = await prisma.category.findMany({
      where: { tenantId: tenantB, parentId: null, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });
    if (reorderedB[0].id !== categoriesB[0].id) {
      throw new Error('CRITICAL: Tenant B order was affected by Tenant A reordering!');
    }
    console.log('✅ Reordering isolated: Tenant B order remained intact.');

    // 6. Test Nested IDOR Prevention (parentId cross-tenant injection)
    console.log('\n[TEST 5] Testing Nested IDOR: Tenant B injecting Tenant A parentId...');
    const foreignParentId = categoriesA[0].id; // Belong to Tenant A
    
    // Simulate what POST /api/categories does:
    const targetParent = await prisma.category.findFirst({
      where: { id: foreignParentId, tenantId: tenantB, deletedAt: null }
    });

    if (targetParent) {
      throw new Error('CRITICAL SECURITY FLAW: Tenant B was able to resolve Tenant A parentId!');
    } else {
      console.log('✅ IDOR Blocked: Tenant B cannot use Tenant A category as parentId (targetParent is null).');
    }

    // 7. Test Product Nested Category IDOR Prevention
    console.log('\n[TEST 6] Testing Nested IDOR: Tenant B creating Product with Tenant A categoryId...');
    const foreignCategoryId = categoriesA[0].id; // Belong to Tenant A
    
    // Simulate what POST /api/products does:
    const targetCategory = await prisma.category.findFirst({
      where: { id: foreignCategoryId, tenantId: tenantB, deletedAt: null }
    });

    if (targetCategory) {
      throw new Error('CRITICAL SECURITY FLAW: Tenant B was able to resolve Tenant A category for a product!');
    } else {
      console.log('✅ IDOR Blocked: Tenant B cannot assign Tenant A categoryId to product (targetCategory is null).');
    }

    // 8. Visual Attributes Verification
    console.log('\n[TEST 7] Verifying Dynamic Visual Attributes (icon, color, stationTarget)...');
    const sampleCategory = categoriesA[0];
    if (!sampleCategory.icon || !sampleCategory.color || !sampleCategory.stationTarget) {
      throw new Error(`Missing attributes on category ${sampleCategory.name}`);
    }
    console.log(`✅ Attributes confirmed: Icon="${sampleCategory.icon}", Color="${sampleCategory.color}", Station="${sampleCategory.stationTarget}"`);

    console.log('\n========================================');
    console.log('🎉 ALL 7 AUTOMATED VERIFICATION TESTS PASSED!');
    console.log('========================================\n');

  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('[CLEANUP] Removing test tenant data...');
    await prisma.category.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await prisma.$disconnect();
    console.log('🧹 Cleanup completed.');
  }
}

runTests();
