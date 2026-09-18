import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const SYSTEM_FEATURES = [
  // ─── POS & Core Modules ──────────────────────────────────────────────────
  {
    key: 'pos.cashier',
    name: 'POS Kasir & Transaksi',
    module: 'POS',
    description: 'Modul transaksi penjualan kasir, cetak struk, dan pembayaran tunai/qris',
    isCore: true,
    status: 'ACTIVE'
  },
  {
    key: 'pos.kds',
    name: 'Kitchen Display System (KDS)',
    module: 'OPERATIONS',
    description: 'Layar antrian pesanan dapur real-time untuk tim kitchen dan barista',
    isCore: false,
    status: 'ACTIVE'
  },
  {
    key: 'pos.tables',
    name: 'Manajemen Meja & Dine-In',
    module: 'OPERATIONS',
    description: 'Visualisasi denah meja interaktif, status meja terisi, dan merge/split bill',
    isCore: false,
    status: 'ACTIVE'
  },
  {
    key: 'pos.reservations',
    name: 'Sistem Reservasi Meja',
    module: 'OPERATIONS',
    description: 'Pencatatan booking meja pelanggan dan reminder status reservasi',
    isCore: false,
    status: 'ACTIVE'
  },
  {
    key: 'inventory.basic',
    name: 'Katalog Menu & Stok Produk',
    module: 'POS',
    description: 'Pengelolaan menu makanan/minuman, kategori, varian, dan stok item langsung',
    isCore: true,
    status: 'ACTIVE'
  },
  {
    key: 'inventory.advanced',
    name: 'Resep (BOM) & Inventaris Bahan Baku',
    module: 'OPERATIONS',
    description: 'Bill of Materials resep otomatis potong stok bahan mentah saat menu terjual',
    isCore: false,
    status: 'ACTIVE'
  },
  {
    key: 'warehouse.management',
    name: 'Central Warehouse & Distribusi Cabang',
    module: 'WAREHOUSE',
    description: 'Gudang pusat, surat jalan inbound, purchase order supplier, dan permintaan cabang',
    isCore: false,
    status: 'ACTIVE'
  },
  {
    key: 'crm.loyalty',
    name: 'CRM & Program Loyalitas Poin',
    module: 'ADVANCED',
    description: 'Database pelanggan, tier member, perolehan poin belanja, dan diskon loyalty',
    isCore: false,
    status: 'ACTIVE'
  },
  {
    key: 'hr.attendance',
    name: 'Absensi GPS Geofencing Karyawan',
    module: 'HR',
    description: 'Presensi masuk/pulang staff dengan validasi titik koordinat GPS radius outlet',
    isCore: false,
    status: 'ACTIVE'
  },
  {
    key: 'hr.payroll',
    name: 'Penggajian & Slip Gaji Otomatis',
    module: 'HR',
    description: 'Kalkulasi gaji pokok, tunjangan kehadiran harian, dan cetak slip gaji',
    isCore: false,
    status: 'ACTIVE'
  },
  {
    key: 'finance.loans',
    name: 'Kasbon & Pinjaman Karyawan',
    module: 'FINANCE',
    description: 'Pengajuan pinjaman karyawan dan cicilan potong gaji otomatis',
    isCore: false,
    status: 'ACTIVE'
  },
  {
    key: 'finance.cashflow',
    name: 'Buku Kas & Petty Cash Harian',
    module: 'FINANCE',
    description: 'Pencatatan uang masuk, kas kecil operasional outlet, dan rekonsiliasi shift',
    isCore: true,
    status: 'ACTIVE'
  },
  {
    key: 'finance.debts',
    name: 'Hutang Piutang & Supplier AP/AR',
    module: 'FINANCE',
    description: 'Manajemen tagihan invoice supplier dan piutang pelanggan/mitra',
    isCore: false,
    status: 'ACTIVE'
  },
  {
    key: 'analytics.advanced',
    name: 'Executive Analytics & Profitability',
    module: 'ADVANCED',
    description: 'Laporan margin kotor HPP/COGS, jam sibuk outlet, performa menu, dan trend penjualan',
    isCore: false,
    status: 'ACTIVE'
  },
  {
    key: 'multi_outlet',
    name: 'Multi-Outlet / Multi-Cabang',
    module: 'ADVANCED',
    description: 'Kemampuan mengelola lebih dari 1 outlet cabang dalam 1 akun bisnis',
    isCore: false,
    status: 'ACTIVE'
  },
  {
    key: 'payment.digital',
    name: 'Gateway Pembayaran Midtrans (QRIS/VA)',
    module: 'FINANCE',
    description: 'Integrasi otomatis pembayaran digital QRIS dinamik, GoPay, ShopeePay, dan Virtual Account',
    isCore: false,
    status: 'ACTIVE'
  }
];

export const SYSTEM_PLANS = [
  {
    code: 'STARTER',
    name: 'Paket Starter (UMKM)',
    description: 'Cocok untuk cafe / resto pemula dengan 1 outlet kasir.',
    priceMonthly: 99000,
    priceYearly: 990000,
    maxOutlets: 1,
    maxUsers: 3,
    maxProducts: 100,
    featureKeys: [
      'pos.cashier',
      'inventory.basic',
      'finance.cashflow'
    ]
  },
  {
    code: 'GROWTH',
    name: 'Paket Growth (Berkembang)',
    description: 'Untuk cafe/resto yang membutuhkan Kitchen Display, Resep Bahan Baku, dan Absensi GPS.',
    priceMonthly: 199000,
    priceYearly: 1990000,
    maxOutlets: 2,
    maxUsers: 10,
    maxProducts: 500,
    featureKeys: [
      'pos.cashier',
      'pos.kds',
      'pos.tables',
      'pos.reservations',
      'inventory.basic',
      'inventory.advanced',
      'crm.loyalty',
      'hr.attendance',
      'finance.cashflow',
      'payment.digital'
    ]
  },
  {
    code: 'BUSINESS',
    name: 'Paket Business (Lengkap)',
    description: 'Solusi all-in-one lengkap dengan Central Warehouse, Payroll, Kasbon, dan Advanced Analytics.',
    priceMonthly: 399000,
    priceYearly: 3990000,
    maxOutlets: 5,
    maxUsers: 30,
    maxProducts: 2000,
    featureKeys: [
      'pos.cashier',
      'pos.kds',
      'pos.tables',
      'pos.reservations',
      'inventory.basic',
      'inventory.advanced',
      'warehouse.management',
      'crm.loyalty',
      'hr.attendance',
      'hr.payroll',
      'finance.loans',
      'finance.cashflow',
      'finance.debts',
      'analytics.advanced',
      'multi_outlet',
      'payment.digital'
    ]
  },
  {
    code: 'ENTERPRISE',
    name: 'Paket Enterprise (Custom & Skala Besar)',
    description: 'Tanpa batas outlet, tanpa batas staff, dan seluruh fitur premium aktif.',
    priceMonthly: 799000,
    priceYearly: 7990000,
    maxOutlets: 999,
    maxUsers: 999,
    maxProducts: 99999,
    featureKeys: SYSTEM_FEATURES.map(f => f.key)
  }
];

export async function seedFeaturesAndPlans() {
  console.log('🌱 [Seed] Mendaftarkan Centralized Feature Registry...');

  const featureMap = new Map<string, string>();

  for (const feat of SYSTEM_FEATURES) {
    const record = await prisma.feature.upsert({
      where: { key: feat.key },
      update: {
        name: feat.name,
        module: feat.module,
        description: feat.description,
        isCore: feat.isCore,
        status: feat.status
      },
      create: {
        key: feat.key,
        name: feat.name,
        module: feat.module,
        description: feat.description,
        isCore: feat.isCore,
        status: feat.status
      }
    });
    featureMap.set(record.key, record.id);
  }
  console.log(`✅ ${SYSTEM_FEATURES.length} Fitur berhasil didaftarkan ke Feature Registry.`);

  console.log('🌱 [Seed] Mendaftarkan SaaS Plans & Relasi Fitur...');
  let enterprisePlanId = '';

  for (const p of SYSTEM_PLANS) {
    const planRecord = await prisma.plan.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        description: p.description,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        maxOutlets: p.maxOutlets,
        maxUsers: p.maxUsers,
        maxProducts: p.maxProducts,
        isActive: true
      },
      create: {
        code: p.code,
        name: p.name,
        description: p.description,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        maxOutlets: p.maxOutlets,
        maxUsers: p.maxUsers,
        maxProducts: p.maxProducts,
        isActive: true
      }
    });

    if (p.code === 'ENTERPRISE') enterprisePlanId = planRecord.id;

    // Hubungkan Plan dengan PlanFeature
    for (const fKey of p.featureKeys) {
      const featId = featureMap.get(fKey);
      if (featId) {
        await prisma.planFeature.upsert({
          where: {
            planId_featureId: {
              planId: planRecord.id,
              featureId: featId
            }
          },
          update: {},
          create: {
            planId: planRecord.id,
            featureId: featId
          }
        });
      }
    }
  }
  console.log(`✅ ${SYSTEM_PLANS.length} SaaS Plans berhasil didaftarkan.`);

  // Pasangkan Master Tenant default ke paket ENTERPRISE
  const defaultTenant = await prisma.tenant.findUnique({
    where: { slug: 'mukiramen' }
  });

  if (defaultTenant && enterprisePlanId) {
    await prisma.tenant.update({
      where: { id: defaultTenant.id },
      data: { planId: enterprisePlanId }
    });
    console.log(`✅ Master Tenant (${defaultTenant.name}) berhasil diasosiasikan dengan Paket ENTERPRISE.`);
  }
}

if (require.main === module) {
  seedFeaturesAndPlans()
    .catch(e => {
      console.error('❌ Error seeding features & plans:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
