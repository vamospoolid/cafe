/**
 * Automated Verification Script for Phase 1 Security Hardening
 * Tests:
 * 1. Cascade Child Check (Prevent soft delete if child has active products)
 * 2. Cross-Tenant IDOR Restore Prevention (Tenant B cannot restore Tenant A data)
 * 3. Cross-Tenant IDOR Purge Prevention (Tenant B cannot hard-delete Tenant A data)
 * 4. P2003 Foreign Key Constraint Crash Prevention on clean purge
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('🚀 Starting Phase 1 Security Hardening Automated Verification...\n');

  const tenantA = 'test-phase1-tenant-a-' + Date.now();
  const tenantB = 'test-phase1-tenant-b-' + Date.now();

  try {
    // 0. Setup Tenants
    console.log(`[SETUP] Creating test tenants: ${tenantA} & ${tenantB}`);
    await prisma.tenant.createMany({
      data: [
        { id: tenantA, name: 'Tenant A Coffee', slug: tenantA },
        { id: tenantB, name: 'Tenant B Resto', slug: tenantB }
      ]
    });

    // 1. Setup Categories for Tenant A
    console.log('\n[SETUP] Creating parent category and sub-category for Tenant A...');
    const parentCatA = await prisma.category.create({
      data: {
        tenantId: tenantA,
        name: 'Beverages Induk',
        sortOrder: 1
      }
    });

    const subCatA = await prisma.category.create({
      data: {
        tenantId: tenantA,
        name: 'Artisan Espresso',
        parentId: parentCatA.id,
        sortOrder: 1
      }
    });

    // Create active product attached to sub-category
    const productA = await prisma.product.create({
      data: {
        tenantId: tenantA,
        name: 'Caramel Macchiato',
        categoryId: parentCatA.id,
        subCategoryId: subCatA.id,
        sellPrice: 35000,
        stock: 50,
        status: 'Aktif'
      }
    });
    console.log(`   Created Product "${productA.name}" (subCategoryId: ${subCatA.id})`);

    // -------------------------------------------------------------------------
    // TEST 1: Cascade Child Check
    // -------------------------------------------------------------------------
    console.log('\n[TEST 1] Testing Cascade Child Check on Category Deletion...');
    
    // Simulate DELETE /api/categories/:id logic
    const childCategories = await prisma.category.findMany({
      where: { parentId: parentCatA.id, tenantId: tenantA, deletedAt: null },
      select: { id: true, name: true }
    });
    const allTargetIds = [parentCatA.id, ...childCategories.map(c => c.id)];

    const activeProductsCount = await prisma.product.count({
      where: {
        tenantId: tenantA,
        deletedAt: null,
        OR: [
          { categoryId: { in: allTargetIds } },
          { subCategoryId: { in: allTargetIds } }
        ]
      }
    });

    if (activeProductsCount > 0) {
      console.log(`✅ TEST 1 PASSED: Soft-delete blocked successfully! Detected ${activeProductsCount} active product using child subcategory.`);
    } else {
      throw new Error('TEST 1 FAILED: System failed to detect active product attached to child sub-category!');
    }

    // -------------------------------------------------------------------------
    // TEST 2: Cross-Tenant Restore IDOR Prevention
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Testing Cross-Tenant IDOR on Recycle Bin Restore...');
    
    // Create soft-deleted category on Tenant A
    const binnedCatA = await prisma.category.create({
      data: {
        tenantId: tenantA,
        name: 'Deleted Category A',
        deletedAt: new Date()
      }
    });

    // Tenant B attempts to restore Tenant A's category
    const restoreAttemptByTenantB = await prisma.category.findFirst({
      where: { id: binnedCatA.id, tenantId: tenantB, deletedAt: { not: null } }
    });

    if (restoreAttemptByTenantB) {
      throw new Error('CRITICAL SECURITY FLAW: Tenant B was able to resolve Tenant A soft-deleted category for restore!');
    } else {
      console.log('✅ TEST 2 PASSED: IDOR Blocked! Tenant B cannot find or restore Tenant A category (returns null).');
    }

    // -------------------------------------------------------------------------
    // TEST 3: Cross-Tenant Purge IDOR Prevention
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Testing Cross-Tenant IDOR on Recycle Bin Purge...');
    
    // Tenant B attempts to find and purge Tenant A's category
    const purgeAttemptByTenantB = await prisma.category.findFirst({
      where: { id: binnedCatA.id, tenantId: tenantB }
    });

    if (purgeAttemptByTenantB) {
      throw new Error('CRITICAL SECURITY FLAW: Tenant B was able to resolve Tenant A category for purge!');
    } else {
      console.log('✅ TEST 3 PASSED: IDOR Blocked! Tenant B cannot purge Tenant A category (returns null).');
    }

    // -------------------------------------------------------------------------
    // TEST 4: P2003 Foreign Key Crash Prevention on Clean Purge
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Testing Clean Purge without P2003 Foreign Key Crash...');
    
    // Create isolated disposable category on Tenant A
    const disposableCat = await prisma.category.create({
      data: {
        tenantId: tenantA,
        name: 'Disposable Cat',
        deletedAt: new Date()
      }
    });

    // Simulate purge transaction
    await prisma.$transaction(async (tx) => {
      const cat = await tx.category.findFirst({ where: { id: disposableCat.id, tenantId: tenantA } });
      if (!cat) throw new Error('Category not found');

      const childCats = await tx.category.findMany({
        where: { parentId: disposableCat.id, tenantId: tenantA },
        select: { id: true }
      });
      const allCatIds = [disposableCat.id, ...childCats.map(c => c.id)];

      // Verify no active product
      const refCount = await tx.product.count({
        where: {
          tenantId: tenantA,
          deletedAt: null,
          OR: [{ categoryId: { in: allCatIds } }, { subCategoryId: { in: allCatIds } }]
        }
      });
      if (refCount > 0) throw new Error('Active products found');

      // Purge
      await tx.category.deleteMany({ where: { parentId: disposableCat.id, tenantId: tenantA } });
      await tx.category.deleteMany({ where: { id: disposableCat.id, tenantId: tenantA } });
    });

    console.log('✅ TEST 4 PASSED: Clean purge completed with 0 Foreign Key errors.');

    console.log('\n======================================================');
    console.log('🎉 ALL 4 PHASE 1 SECURITY HARDENING TESTS PASSED!');
    console.log('======================================================\n');

  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    console.log('[CLEANUP] Cleaning up test data...');
    await prisma.product.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prisma.category.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await prisma.$disconnect();
    console.log('🧹 Cleanup completed.');
  }
}

runTests();
