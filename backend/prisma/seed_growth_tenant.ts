import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 [Seed Growth] Menyiapkan Akun Tenant Paket GROWTH...');

  // 1. Ambil Plan GROWTH
  const growthPlan = await prisma.plan.findUnique({
    where: { code: 'GROWTH' }
  });

  if (!growthPlan) {
    throw new Error('Plan GROWTH tidak ditemukan!');
  }

  // 2. Buat atau update Tenant Growth
  const tenantId = 'tenant-growth-demo';
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'kopi-growth' },
    update: {
      name: 'Kopi Nusantara Growth Demo',
      planId: growthPlan.id,
      status: 'ACTIVE'
    },
    create: {
      id: tenantId,
      name: 'Kopi Nusantara Growth Demo',
      slug: 'kopi-growth',
      planId: growthPlan.id,
      status: 'ACTIVE'
    }
  });

  console.log(`✅ Tenant Growth berhasil dibuat: [${tenant.id}] ${tenant.name}`);

  // 3. Buat Outlet Utama
  const outlet = await prisma.outlet.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: 'GRW-01'
      }
    },
    update: {
      name: 'Kopi Growth - Cabang Senopati',
      status: 'ACTIVE'
    },
    create: {
      id: 'outlet-growth-01',
      tenantId: tenant.id,
      name: 'Kopi Growth - Cabang Senopati',
      code: 'GRW-01',
      status: 'ACTIVE',
      latitude: -6.220000,
      longitude: 106.810000,
      gpsRadiusMeters: 100
    }
  });

  // 4. Buat Pengaturan Toko
  const existingSettings = await prisma.settings.findFirst({
    where: { tenantId: tenant.id }
  });

  if (!existingSettings) {
    await prisma.settings.create({
      data: {
        storeName: 'KOPI NUSANTARA GROWTH',
        phone: '081299887766',
        address: 'Jl. Senopati No. 45, Jakarta Selatan',
        logoUrl: '/logo-djoin-cafe.png',
        taxRate: 11,
        serviceCharge: 5,
        includeTax: true,
        receiptHeader: 'KOPI NUSANTARA GROWTH\nJl. Senopati No. 45, Jakarta',
        receiptFooter: 'Terima Kasih!\nPowered by Codenusa SaaS',
        tenantId: tenant.id
      }
    });
  }

  // 5. Cari Role OWNER
  let ownerRole = await prisma.role.findFirst({
    where: { name: 'OWNER', isSystem: true }
  });

  // 6. Buat User Owner Growth
  const hashedPassword = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { username: 'owner_growth' },
    update: {
      name: 'Hendro (Owner Growth)',
      passwordHash: hashedPassword,
      role: 'OWNER',
      status: 'Aktif'
    },
    create: {
      name: 'Hendro (Owner Growth)',
      username: 'owner_growth',
      passwordHash: hashedPassword,
      pin: '123456',
      role: 'OWNER',
      status: 'Aktif',
      permissions: JSON.stringify({
        canVoid: true,
        canDiscount: true,
        canEditMenu: true,
        canViewReports: true,
        canManageStaff: true
      })
    }
  });

  // 7. Hubungkan Membership Tenant
  await prisma.tenantMembership.upsert({
    where: {
      userId_tenantId: {
        userId: user.id,
        tenantId: tenant.id
      }
    },
    update: {
      status: 'ACTIVE',
      roleId: ownerRole?.id || null
    },
    create: {
      userId: user.id,
      tenantId: tenant.id,
      status: 'ACTIVE',
      roleId: ownerRole?.id || null
    }
  });

  // 8. Subscription Aktif
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await prisma.subscription.upsert({
    where: { id: 'sub-growth-demo' },
    update: {
      status: 'ACTIVE',
      amount: 179000,
      currentPeriodEnd: nextMonth
    },
    create: {
      id: 'sub-growth-demo',
      tenantId: tenant.id,
      planId: growthPlan.id,
      amount: 179000,
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: nextMonth,
      billingCycle: 'MONTHLY'
    }
  });

  console.log(`✅ User Owner Growth berhasil dibuat & dikaitkan:`);
  console.log(`   - Username: owner_growth`);
  console.log(`   - Password: password123`);
  console.log(`   - Plan    : GROWTH (Rp 179.000/bln)`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
