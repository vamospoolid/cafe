const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import FeatureService directly from compiled dist or ts-node
const { FeatureService } = require('./dist/src/services/FeatureService');
const featureService = FeatureService.getInstance();

async function runPhase5Tests() {
  console.log('🧪 === MENJALANKAN TEST SUITE FASE 5: FEATURE REGISTRY & ENTITLEMENTS === 🧪\n');

  try {
    // -------------------------------------------------------------
    // TEST 1: Feature Registry & SaaS Plans Integrity
    // -------------------------------------------------------------
    console.log('--- [1/5] Verifying System Feature Registry & Plans ---');
    const allFeatures = await prisma.feature.findMany();
    const allPlans = await prisma.plan.findMany({ include: { features: true } });

    console.log(`Registered Features count: ${allFeatures.length}`);
    console.log(`Registered SaaS Plans count: ${allPlans.length}`);

    if (allFeatures.length < 10) throw new Error('Feature registry count too low');
    if (allPlans.length < 4) throw new Error('SaaS plans count too low');

    console.log('✅ TEST 1 (Feature Registry & Plans in DB): PASSED!\n');

    // -------------------------------------------------------------
    // TEST 2: Enterprise Tenant (MUKI RAMEN) Feature Entitlements
    // -------------------------------------------------------------
    console.log('--- [2/5] Testing Enterprise Tenant Feature Resolution ---');
    const masterTenant = await prisma.tenant.findUnique({ where: { slug: 'mukiramen' } });
    if (!masterTenant) throw new Error('Master tenant mukiramen not found');

    featureService.clearCache(masterTenant.id);
    const mukiFeatures = await featureService.getTenantFeatures(masterTenant.id);
    console.log(`Master Tenant (${masterTenant.name}) Active Features (${mukiFeatures.length}):`, mukiFeatures.slice(0, 5).join(', ') + '...');

    const isKdsEnabled = await featureService.isEnabled(masterTenant.id, 'pos.kds');
    const isWarehouseEnabled = await featureService.isEnabled(masterTenant.id, 'warehouse.management');
    const isCashierEnabled = await featureService.isEnabled(masterTenant.id, 'pos.cashier');

    if (!isKdsEnabled || !isWarehouseEnabled || !isCashierEnabled) {
      throw new Error(`Enterprise tenant should have all features enabled! KDS: ${isKdsEnabled}, Warehouse: ${isWarehouseEnabled}`);
    }
    console.log('✅ TEST 2 (Enterprise Tenant Full Access): PASSED!\n');

    // -------------------------------------------------------------
    // TEST 3: Starter Tenant Feature Limitation
    // -------------------------------------------------------------
    console.log('--- [3/5] Testing Starter Tenant Feature Limitations ---');
    const starterPlan = await prisma.plan.findUnique({ where: { code: 'STARTER' } });
    if (!starterPlan) throw new Error('STARTER plan not found');

    // Create a temporary starter tenant
    const starterTenant = await prisma.tenant.upsert({
      where: { slug: 'test-starter-tenant' },
      update: { planId: starterPlan.id, status: 'ACTIVE' },
      create: {
        id: 'tenant-test-starter',
        name: 'Starter Cafe Test',
        slug: 'test-starter-tenant',
        planId: starterPlan.id,
        status: 'ACTIVE'
      }
    });

    featureService.clearCache(starterTenant.id);
    const starterFeatures = await featureService.getTenantFeatures(starterTenant.id);
    console.log(`Starter Tenant Active Features (${starterFeatures.length}):`, starterFeatures.join(', '));

    const starterCashier = await featureService.isEnabled(starterTenant.id, 'pos.cashier');
    const starterKds = await featureService.isEnabled(starterTenant.id, 'pos.kds');
    const starterWarehouse = await featureService.isEnabled(starterTenant.id, 'warehouse.management');

    console.log(`Starter Tenant Access -> pos.cashier (Core): ${starterCashier}, pos.kds: ${starterKds}, warehouse: ${starterWarehouse}`);

    if (!starterCashier) throw new Error('Starter tenant should have pos.cashier!');
    if (starterKds) throw new Error('Starter tenant should NOT have pos.kds!');
    if (starterWarehouse) throw new Error('Starter tenant should NOT have warehouse.management!');

    console.log('✅ TEST 3 (Starter Plan Feature Restriction): PASSED!\n');

    // -------------------------------------------------------------
    // TEST 4: Tenant Feature Override (Add-on Grant)
    // -------------------------------------------------------------
    console.log('--- [4/5] Testing Add-on Grant (Feature Override) ---');
    console.log('Granting "pos.kds" as an add-on to Starter Tenant...');
    await featureService.grantTenantFeature(starterTenant.id, 'pos.kds');

    const starterKdsAfterGrant = await featureService.isEnabled(starterTenant.id, 'pos.kds');
    console.log(`Starter Tenant Access to pos.kds after Add-on Grant: ${starterKdsAfterGrant}`);

    if (!starterKdsAfterGrant) throw new Error('Add-on grant failed: pos.kds should now be enabled!');
    console.log('✅ TEST 4 (Add-on Grant Override): PASSED!\n');

    // -------------------------------------------------------------
    // TEST 5: Tenant Feature Override (Explicit Revoke)
    // -------------------------------------------------------------
    console.log('--- [5/5] Testing Explicit Revoke on Starter Tenant ---');
    console.log('Revoking "pos.kds" override from Starter Tenant...');
    await featureService.revokeTenantFeature(starterTenant.id, 'pos.kds');

    const starterKdsAfterRevoke = await featureService.isEnabled(starterTenant.id, 'pos.kds');
    console.log(`Starter Tenant Access to pos.kds after Revoke: ${starterKdsAfterRevoke}`);

    if (starterKdsAfterRevoke) throw new Error('Explicit revoke failed: pos.kds should now be disabled!');
    console.log('✅ TEST 5 (Explicit Revoke Override): PASSED!\n');

    console.log('🎉 SEMUA PENGUJIAN FASE 5 BERHASIL DENGAN SEMPURNA! FEATURE REGISTRY & ENTITLEMENTS READY! 🎉');
  } catch (err) {
    console.error('❌ PENGUJIAN FASE 5 GAGAL:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase5Tests();
