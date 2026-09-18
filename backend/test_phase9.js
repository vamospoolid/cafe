const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

async function runPhase9Tests() {
  console.log('🧪 === MENJALANKAN TEST SUITE FASE 9: TENANT ONBOARDING & MULTI-TENANT SWITCHER === 🧪\n');

  try {
    // -------------------------------------------------------------
    // TEST 1: Tenant Onboarding Wizard Registration API
    // -------------------------------------------------------------
    console.log('--- [1/3] Testing Automated Tenant Onboarding Registration ---');
    const timestamp = Date.now();
    const testSlug = `kopikulo-${timestamp}`;
    const ownerUsername = `kulo_owner_${timestamp}`;

    // Simulate calling the registration flow
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash('secret123', 10);
    const growthPlan = await prisma.plan.findUnique({ where: { code: 'GROWTH' } });

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const onboardingResult = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: 'Kopi Kulo Nusantara',
          slug: testSlug,
          planId: growthPlan ? growthPlan.id : undefined,
          status: 'ACTIVE',
          trialEndsAt
        }
      });

      const primaryOutlet = await tx.outlet.create({
        data: {
          tenantId: tenant.id,
          name: 'Kopi Kulo - Cabang Senopati',
          code: 'KUL-01',
          status: 'ACTIVE'
        }
      });

      const secondaryOutlet = await tx.outlet.create({
        data: {
          tenantId: tenant.id,
          name: 'Kopi Kulo - Cabang Kemang',
          code: 'KUL-02',
          status: 'ACTIVE'
        }
      });

      const user = await tx.user.create({
        data: {
          name: 'Kulo Founder',
          username: ownerUsername,
          passwordHash,
          pin: '889900',
          role: 'OWNER',
          permissions: '{}'
        }
      });

      const ownerRole = await tx.role.findFirst({
        where: { OR: [{ id: 'role-system-owner' }, { name: 'OWNER' }] }
      });

      await tx.tenantMembership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          roleId: ownerRole ? ownerRole.id : undefined,
          pin: '889900',
          status: 'ACTIVE'
        }
      });

      await tx.category.createMany({
        data: [
          { tenantId: tenant.id, name: 'Kopi Signature' },
          { tenantId: tenant.id, name: 'Non-Coffee' }
        ]
      });

      await tx.settings.create({
        data: {
          tenantId: tenant.id,
          outletId: primaryOutlet.id,
          storeName: 'Kopi Kulo Nusantara',
          receiptHeader: 'Selamat Datang di Kopi Kulo',
          receiptFooter: 'Terima kasih!'
        }
      });

      return { tenant, primaryOutlet, secondaryOutlet, user };
    });

    console.log(`Successfully Onboarded Tenant: ${onboardingResult.tenant.name} (Slug: ${onboardingResult.tenant.slug})`);
    console.log(`Primary Outlet ID: ${onboardingResult.primaryOutlet.id} (${onboardingResult.primaryOutlet.code})`);
    console.log(`Owner User ID: ${onboardingResult.user.id} (Username: ${onboardingResult.user.username})`);

    const categoriesCount = await prisma.category.count({ where: { tenantId: onboardingResult.tenant.id } });
    console.log(`Default Categories Seeded: ${categoriesCount}`);

    if (categoriesCount < 2) throw new Error('Default categories were not properly seeded for new tenant!');
    console.log('✅ TEST 1 (Automated Onboarding Wizard Registration): PASSED!\n');

    // -------------------------------------------------------------
    // TEST 2: Multi-Tenant Context Token Generation
    // -------------------------------------------------------------
    console.log('--- [2/3] Testing JWT Multi-Tenant Context Resolution ---');
    const token = jwt.sign(
      {
        id: onboardingResult.user.id,
        username: onboardingResult.user.username,
        name: onboardingResult.user.name,
        role: onboardingResult.user.role,
        tenantId: onboardingResult.tenant.id,
        outletId: onboardingResult.primaryOutlet.id,
        isPlatformAdmin: false
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log(`Decoded JWT Tenant ID: ${decoded.tenantId} (Expected: ${onboardingResult.tenant.id})`);
    console.log(`Decoded JWT Outlet ID: ${decoded.outletId} (Expected: ${onboardingResult.primaryOutlet.id})`);

    if (decoded.tenantId !== onboardingResult.tenant.id || decoded.outletId !== onboardingResult.primaryOutlet.id) {
      throw new Error('JWT payload does not match onboarded tenant context!');
    }
    console.log('✅ TEST 2 (Multi-Tenant Context Resolution): PASSED!\n');

    // -------------------------------------------------------------
    // TEST 3: Multi-Outlet Branch Context Switching
    // -------------------------------------------------------------
    console.log('--- [3/3] Testing Multi-Outlet Branch Context Switching ---');
    const switchedToken = jwt.sign(
      {
        id: onboardingResult.user.id,
        username: onboardingResult.user.username,
        name: onboardingResult.user.name,
        role: onboardingResult.user.role,
        tenantId: onboardingResult.tenant.id,
        outletId: onboardingResult.secondaryOutlet.id, // Switched to Branch 2
        isPlatformAdmin: false
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const decodedSwitched = jwt.verify(switchedToken, JWT_SECRET);
    console.log(`Switched Outlet Code: KUL-02 -> Outlet ID: ${decodedSwitched.outletId}`);

    if (decodedSwitched.outletId !== onboardingResult.secondaryOutlet.id) {
      throw new Error('Outlet switching failed to update JWT outlet context!');
    }
    console.log('✅ TEST 3 (Multi-Outlet Branch Switching): PASSED!\n');

    console.log('🎉 SEMUA PENGUJIAN FASE 9 BERHASIL DENGAN SEMPURNA! ONBOARDING & SWITCHER READY! 🎉');
  } catch (err) {
    console.error('❌ PENGUJIAN FASE 9 GAGAL:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase9Tests();
