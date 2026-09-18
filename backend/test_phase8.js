const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { QuotaService } = require('./dist/src/services/QuotaService');
const quotaService = QuotaService.getInstance();

async function runPhase8Tests() {
  console.log('🧪 === MENJALANKAN TEST SUITE FASE 8: USAGE TRACKING & QUOTA ENFORCEMENT === 🧪\n');

  try {
    // -------------------------------------------------------------
    // TEST 1: Enterprise Tenant Quotas (Unlimited/High Limits)
    // -------------------------------------------------------------
    console.log('--- [1/4] Testing Enterprise Tenant Quota Limits ---');
    const enterprisePlan = await prisma.plan.findUnique({ where: { code: 'ENTERPRISE' } });
    const masterTenant = await prisma.tenant.findUnique({ where: { slug: 'mukiramen' } });
    if (!masterTenant) throw new Error('Master tenant mukiramen not found');

    if (enterprisePlan) {
      await prisma.tenant.update({
        where: { id: masterTenant.id },
        data: { planId: enterprisePlan.id }
      });
    }

    const enterpriseUsage = await quotaService.getUsageAndLimits(masterTenant.id);
    console.log(`Enterprise Tenant: ${enterpriseUsage.tenantName}`);
    console.log('Quotas:', enterpriseUsage.quotas);

    if (enterpriseUsage.quotas.outlets.max < 100) {
      throw new Error('Enterprise tenant should have 999 max outlets!');
    }
    console.log('✅ TEST 1 (Enterprise Quotas): PASSED!\n');

    // -------------------------------------------------------------
    // TEST 2: Starter Tenant Quota Enforcement (Strict Limits)
    // -------------------------------------------------------------
    console.log('--- [2/4] Testing Starter Tenant Quota Strict Limits ---');
    const starterPlan = await prisma.plan.findUnique({ where: { code: 'STARTER' } });
    if (!starterPlan) throw new Error('STARTER plan not found');

    const starterTenant = await prisma.tenant.upsert({
      where: { slug: 'test-quota-starter' },
      update: { planId: starterPlan.id, status: 'ACTIVE' },
      create: {
        id: 'tenant-test-quota-starter',
        name: 'Warung Kopi Starter Quota',
        slug: 'test-quota-starter',
        planId: starterPlan.id,
        status: 'ACTIVE'
      }
    });

    const initialUsage = await quotaService.getUsageAndLimits(starterTenant.id);
    console.log(`Starter Max Users: ${initialUsage.quotas.users.max}`);
    console.log(`Starter Max Outlets: ${initialUsage.quotas.outlets.max}`);
    console.log(`Starter Max Products: ${initialUsage.quotas.products.max}`);

    if (initialUsage.quotas.users.max !== 3 || initialUsage.quotas.outlets.max !== 1) {
      throw new Error(`Starter plan limits incorrect! Expected users: 3, outlets: 1. Got: ${initialUsage.quotas.users.max}`);
    }
    console.log('✅ TEST 2 (Starter Quota Limits Structure): PASSED!\n');

    // -------------------------------------------------------------
    // TEST 3: Staff Limit Breach Prevention
    // -------------------------------------------------------------
    console.log('--- [3/4] Testing Staff Limit Rejection on Exceeding Quota ---');
    // Clear any previous test memberships for this tenant
    await prisma.tenantMembership.deleteMany({ where: { tenantId: starterTenant.id } });

    // Add 3 staff members (Max Starter Limit is 3)
    for (let i = 1; i <= 3; i++) {
      const dummyUser = await prisma.user.upsert({
        where: { username: `staff_starter_${i}` },
        update: {},
        create: {
          name: `Staff Starter ${i}`,
          username: `staff_starter_${i}`,
          passwordHash: 'dummyhash',
          role: 'Kasir',
          permissions: '{}'
        }
      });

      await prisma.tenantMembership.create({
        data: {
          userId: dummyUser.id,
          tenantId: starterTenant.id,
          roleId: 'role-system-cashier',
          status: 'ACTIVE'
        }
      });
    }

    const checkAfter3Users = await quotaService.canCreateUser(starterTenant.id);
    console.log(`Can create 4th user for Starter Tenant? -> allowed: ${checkAfter3Users.allowed} (${checkAfter3Users.current}/${checkAfter3Users.max})`);

    if (checkAfter3Users.allowed) {
      throw new Error('Quota validation failed: 4th user should be BLOCKED (allowed: false)!');
    }
    console.log(`Rejection Message: "${checkAfter3Users.message}"`);
    console.log('✅ TEST 3 (Staff Quota Limit Enforcement): PASSED!\n');

    // -------------------------------------------------------------
    // TEST 4: UsageRecord Mutation & Persistence
    // -------------------------------------------------------------
    console.log('--- [4/4] Testing UsageRecord Persistence ---');
    const record = await quotaService.trackUsage(starterTenant.id, 'USERS', 3, 3);
    console.log(`Tracked Usage Record ID: ${record.id}, Metric: ${record.metric}, Period: ${record.period}, Value: ${record.currentValue}/${record.limitValue}`);

    if (!record.id || record.currentValue !== 3) {
      throw new Error('UsageRecord persistence failed!');
    }
    console.log('✅ TEST 4 (Usage Tracking & Persistence): PASSED!\n');

    console.log('🎉 SEMUA PENGUJIAN FASE 8 BERHASIL DENGAN SEMPURNA! USAGE TRACKING & QUOTAS READY! 🎉');
  } catch (err) {
    console.error('❌ PENGUJIAN FASE 8 GAGAL:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase8Tests();
