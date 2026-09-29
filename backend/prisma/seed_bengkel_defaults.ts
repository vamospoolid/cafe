import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function seedBengkelDefaults(tenantId: string, client: PrismaClient = prisma) {
  console.log(`🔧 Seeding Bengkel defaults for tenant: ${tenantId}...`);

  // 1. Kategori Sparepart Bengkel Default
  const defaultCategories = [
    { name: 'Oli & Pelumas' },
    { name: 'Ban & Roda' },
    { name: 'Rem & Pengereman' },
    { name: 'Mesin & Transmisi' },
    { name: 'Kelistrikan & Aki' },
    { name: 'Suspensi & Kaki-kaki' },
    { name: 'Body & Aksesoris' },
    { name: 'Jasa & Servis' },
  ];

  const createdCategories: Record<string, number> = {};
  for (const cat of defaultCategories) {
    let existing = await client.category.findFirst({
      where: { tenantId, name: cat.name }
    });
    if (!existing) {
      existing = await client.category.create({
        data: {
          tenantId,
          name: cat.name,
        }
      });
    }
    createdCategories[cat.name] = existing.id;
  }

  // 2. ServiceType Bengkel Default
  const defaultServiceTypes = [
    { name: 'Tune Up Ringan Motor', priceRetail: 45000, priceMitra: 40000, priceGrosir: 35000, vehicleType: 'MOTOR' },
    { name: 'Tune Up Lengkap Motor', priceRetail: 85000, priceMitra: 75000, priceGrosir: 65000, vehicleType: 'MOTOR' },
    { name: 'Ganti Oli Motor', priceRetail: 20000, priceMitra: 15000, priceGrosir: 15000, vehicleType: 'MOTOR' },
    { name: 'Servis CVT / Transmisi Matic', priceRetail: 65000, priceMitra: 55000, priceGrosir: 50000, vehicleType: 'MOTOR' },
    { name: 'Ganti Kampas Rem Motor', priceRetail: 25000, priceMitra: 20000, priceGrosir: 20000, vehicleType: 'MOTOR' },
    { name: 'Ganti Ban Luar / Dalam Motor', priceRetail: 25000, priceMitra: 20000, priceGrosir: 20000, vehicleType: 'MOTOR' },
    { name: 'Tune Up Mesin Mobil', priceRetail: 175000, priceMitra: 150000, priceGrosir: 140000, vehicleType: 'MOBIL' },
    { name: 'Ganti Oli + Filter Mobil', priceRetail: 50000, priceMitra: 40000, priceGrosir: 35000, vehicleType: 'MOBIL' },
    { name: 'Servis Rem 4 Roda Mobil', priceRetail: 150000, priceMitra: 130000, priceGrosir: 120000, vehicleType: 'MOBIL' },
    { name: 'Spooring & Balancing Mobil', priceRetail: 200000, priceMitra: 175000, priceGrosir: 160000, vehicleType: 'MOBIL' },
    { name: 'Kuras Radiator & Coolant', priceRetail: 75000, priceMitra: 65000, priceGrosir: 60000, vehicleType: 'ALL' },
  ];

  for (const st of defaultServiceTypes) {
    const existing = await client.serviceType.findFirst({
      where: { tenantId, name: st.name }
    });
    if (!existing) {
      await client.serviceType.create({
        data: {
          tenantId,
          ...st,
        }
      });
    }
  }

  // 3. Produk Sparepart Contoh Bengkel
  const catOliId = createdCategories['Oli & Pelumas'];
  const catRemId = createdCategories['Rem & Pengereman'];
  const catMesinId = createdCategories['Mesin & Transmisi'];

  const defaultProducts = [
    {
      name: 'Oli Shell Advance AX7 10W-40 (0.8L)',
      categoryId: catOliId,
      barcode: 'SHELL-AX7-08',
      buyPrice: 42000,
      sellPrice: 55000,
      sellPriceRetail: 55000,
      sellPriceMitra: 49000,
      sellPriceGrosir: 45000,
      minQtyGrosir: 6,
      stock: 48,
      minStock: 6,
    },
    {
      name: 'Oli Motul Scooter Expert LE 10W-40 (1L)',
      categoryId: catOliId,
      barcode: 'MOTUL-LE-1L',
      buyPrice: 65000,
      sellPrice: 85000,
      sellPriceRetail: 85000,
      sellPriceMitra: 77000,
      sellPriceGrosir: 72000,
      minQtyGrosir: 6,
      stock: 24,
      minStock: 4,
    },
    {
      name: 'Kampas Rem Depan Honda Vario / Beat',
      categoryId: catRemId,
      barcode: 'PAD-HON-VAR',
      buyPrice: 22000,
      sellPrice: 38000,
      sellPriceRetail: 38000,
      sellPriceMitra: 32000,
      sellPriceGrosir: 28000,
      minQtyGrosir: 10,
      stock: 30,
      minStock: 5,
    },
    {
      name: 'Busi Denso U24EPR9',
      categoryId: catMesinId,
      barcode: 'BUSI-DENSO-U24',
      buyPrice: 13000,
      sellPrice: 22000,
      sellPriceRetail: 22000,
      sellPriceMitra: 18000,
      sellPriceGrosir: 16000,
      minQtyGrosir: 10,
      stock: 50,
      minStock: 10,
    }
  ];

  for (const prod of defaultProducts) {
    if (!prod.categoryId) continue;
    const existing = await client.product.findFirst({
      where: { tenantId, barcode: prod.barcode }
    });
    if (!existing) {
      await client.product.create({
        data: {
          tenantId,
          ...prod,
        }
      });
    }
  }

  console.log(`✅ Default Bengkel categories, service types, and products seeded for tenant: ${tenantId}`);
}

/**
 * Standalone runner: creates or updates demo Bengkel tenant
 */
async function runStandalone() {
  const tenantBengkelId = 'tenant-demo-bengkel';
  const slug = 'bengkeljaya';

  console.log('🏁 Creating Demo Bengkel Tenant...');
  const tenant = await prisma.tenant.upsert({
    where: { id: tenantBengkelId },
    update: {
      businessType: 'BENGKEL',
      name: 'Bengkel Motor Jaya Abadi',
      slug,
      status: 'ACTIVE'
    },
    create: {
      id: tenantBengkelId,
      name: 'Bengkel Motor Jaya Abadi',
      slug,
      businessType: 'BENGKEL',
      status: 'ACTIVE'
    }
  });

  const outlet = await prisma.outlet.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'BJ-01' } },
    update: {},
    create: {
      id: 'outlet-bengkel-jaya',
      tenantId: tenant.id,
      name: 'Bengkel Jaya Pusat',
      code: 'BJ-01',
      status: 'ACTIVE'
    }
  });

  const passwordHash = await bcrypt.hash('admin123', 10);

  // 1. Admin Bengkel
  const adminUser = await prisma.user.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: 'admin_bengkel' } },
    update: {},
    create: {
      name: 'Haji Jaya (Owner)',
      username: 'admin_bengkel',
      tenantId: tenant.id,
      passwordHash,
      pin: '123456',
      role: 'Admin',
      status: 'Aktif',
      permissions: JSON.stringify(['all'])
    }
  });

  await prisma.tenantMembership.upsert({
    where: {
      userId_tenantId: { userId: adminUser.id, tenantId: tenant.id }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: adminUser.id,
      status: 'ACTIVE'
    }
  });

  // 2. Mekanik Bengkel dengan MechanicProfile
  const mekanikUser = await prisma.user.upsert({
    where: { tenantId_username: { tenantId: tenant.id, username: 'mekanik_budi' } },
    update: {},
    create: {
      name: 'Budi Santoso (Mekanik Senior)',
      username: 'mekanik_budi',
      tenantId: tenant.id,
      passwordHash,
      pin: '123456',
      role: 'Mekanik',
      status: 'Aktif',
      permissions: JSON.stringify(['pos', 'bengkel'])
    }
  });

  await prisma.tenantMembership.upsert({
    where: {
      userId_tenantId: { userId: mekanikUser.id, tenantId: tenant.id }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: mekanikUser.id,
      status: 'ACTIVE'
    }
  });

  await prisma.mechanicProfile.upsert({
    where: { userId: mekanikUser.id },
    update: {
      commissionType: 'PERCENT',
      commissionRate: 0.20,
    },
    create: {
      tenantId: tenant.id,
      userId: mekanikUser.id,
      commissionType: 'PERCENT',
      commissionRate: 0.20,
      pendingCommission: 0,
      paidCommission: 0
    }
  });

  // 3. Seed defaults
  await seedBengkelDefaults(tenant.id, prisma);

  // 4. Sample Customer & Kendaraan
  const sampleCustomer = await prisma.customer.upsert({
    where: { tenantId_phone: { tenantId: tenant.id, phone: '081234567890' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Pak Bambang',
      phone: '081234567890',
      priceTier: 'MITRA',
      tier: 'Gold',
    }
  });

  const sampleVehicle = await prisma.vehicle.upsert({
    where: { tenantId_plateNumber: { tenantId: tenant.id, plateNumber: 'B 4123 ABC' } },
    update: {},
    create: {
      tenantId: tenant.id,
      customerId: sampleCustomer.id,
      plateNumber: 'B 4123 ABC',
      brand: 'Honda',
      model: 'Vario 150',
      vehicleType: 'MOTOR',
      year: 2021,
      color: 'Hitam Matte'
    }
  });

  console.log('🎉 Demo Bengkel Setup Completed Successfully!');
  console.log(`Tenant ID: ${tenant.id} | Slug: ${tenant.slug}`);
  console.log(`Admin Login: admin_bengkel / admin123 (PIN: 123456)`);
  console.log(`Mekanik: mekanik_budi / admin123 (PIN: 123456)`);
  console.log(`Sample Kendaraan: ${sampleVehicle.plateNumber} (${sampleVehicle.brand} ${sampleVehicle.model})`);
}

if (require.main === module) {
  runStandalone()
    .catch((err) => {
      console.error('❌ Error seeding bengkel defaults:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
