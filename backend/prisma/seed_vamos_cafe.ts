import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SYSTEM_PERMISSIONS = [
  // POS & Sales
  { key: 'pos.view', name: 'Lihat Kasir POS', module: 'POS', description: 'Melihat antarmuka kasir dan menu produk' },
  { key: 'pos.create', name: 'Buat Transaksi', module: 'POS', description: 'Memproses transaksi penjualan baru' },
  { key: 'pos.discount', name: 'Beri Diskon', module: 'POS', description: 'Memberikan diskon kustom pada pesanan' },
  { key: 'pos.void', name: 'Batalkan / Void Transaksi', module: 'POS', description: 'Membatalkan pesanan yang sudah dibuat/dibayar' },
  { key: 'pos.refund', name: 'Refund Pesanan', module: 'POS', description: 'Mengembalikan dana transaksi ke pelanggan' },
  { key: 'pos.reprint', name: 'Cetak Ulang Struk', module: 'POS', description: 'Mencetak ulang struk transaksi lama' },

  // Kitchen Display (KDS)
  { key: 'kds.view', name: 'Lihat Layar KDS', module: 'KDS', description: 'Melihat antrian pesanan dapur' },
  { key: 'kds.cook', name: 'Update Status Masak', module: 'KDS', description: 'Mengubah status pesanan menjadi sedang dimasak/siap' },
  { key: 'kds.serve', name: 'Selesaikan Sajian', module: 'KDS', description: 'Menandai pesanan telah disajikan ke meja' },

  // Meja & Reservasi
  { key: 'tables.view', name: 'Lihat Denah Meja', module: 'TABLES', description: 'Melihat status dan denah meja' },
  { key: 'tables.manage', name: 'Kelola Meja', module: 'TABLES', description: 'Menambah, mengedit, dan mengatur layout meja' },
  { key: 'reservations.view', name: 'Lihat Reservasi', module: 'RESERVATIONS', description: 'Melihat daftar booking meja' },
  { key: 'reservations.manage', name: 'Kelola Reservasi', module: 'RESERVATIONS', description: 'Menerima dan mengedit reservasi pelanggan' },

  // Produk & Kategori
  { key: 'products.view', name: 'Lihat Produk', module: 'PRODUCTS', description: 'Melihat daftar menu dan harga' },
  { key: 'products.manage', name: 'Kelola Produk & Harga', module: 'PRODUCTS', description: 'Menambah, mengedit, dan menghapus produk serta harga' },

  // Keuangan & Kas
  { key: 'cashflow.view', name: 'Lihat Arus Kas', module: 'FINANCE', description: 'Melihat catatan pemasukan dan pengeluaran kas' },
  { key: 'cashflow.manage', name: 'Kelola Arus Kas', module: 'FINANCE', description: 'Mencatat mutasi kas masuk dan keluar laci' },
  { key: 'shifts.manage', name: 'Buka / Tutup Shift', module: 'FINANCE', description: 'Melakukan pembukaan dan penutupan shift kasir' },

  // Karyawan & Absensi
  { key: 'employees.view', name: 'Lihat Karyawan', module: 'HR', description: 'Melihat daftar staf dan profil' },
  { key: 'employees.manage', name: 'Kelola Karyawan', module: 'HR', description: 'Menambah dan mengedit akun staf serta hak akses' },
  { key: 'attendance.view', name: 'Lihat Absensi', module: 'HR', description: 'Melihat rekap kehadiran staf' },
  { key: 'attendance.clock', name: 'Absen Mandiri', module: 'HR', description: 'Melakukan clock-in dan clock-out mandiri' },

  // Laporan & Analitik
  { key: 'reports.view', name: 'Lihat Laporan Penjualan', module: 'REPORTS', description: 'Melihat omzet, laba kotor, dan riwayat transaksi' },
  { key: 'reports.export', name: 'Ekspor Data (Excel/PDF)', module: 'REPORTS', description: 'Mengunduh laporan dalam format Excel atau PDF' },
  { key: 'analytics.view', name: 'Lihat Analitik Lanjutan', module: 'REPORTS', description: 'Melihat statistik performa menu' },

  // CRM
  { key: 'crm.view', name: 'Lihat Pelanggan', module: 'CRM', description: 'Melihat database pelanggan dan poin reward' },
  { key: 'crm.manage', name: 'Kelola Pelanggan & Poin', module: 'CRM', description: 'Menambah pelanggan dan mengatur poin loyalty' },

  // Inventaris
  { key: 'inventory.view', name: 'Lihat Stok Bahan Baku', module: 'INVENTORY', description: 'Melihat sisa stok bahan baku dapur' },
  { key: 'inventory.adjust', name: 'Penyesuaian Stok / Rusak', module: 'INVENTORY', description: 'Mencatat barang rusak, waste, dan opname' },
  { key: 'inventory.po', name: 'Kelola Purchase Order', module: 'INVENTORY', description: 'Membuat dan menerima PO dari supplier' },
  { key: 'suppliers.manage', name: 'Kelola Supplier', module: 'INVENTORY', description: 'Menambah dan mengedit kontak vendor/supplier' }
];

async function main() {
  console.log('🌱 Menyiapkan database mandiri VAMOS POOL & CAFE (vamos_cafe_db)...');

  // 1. Daftarkan Hak Akses (Permissions)
  console.log('📌 [1/7] Menyiapkan Sistem Hak Akses...');
  const permMap = new Map<string, string>();
  for (const perm of SYSTEM_PERMISSIONS) {
    const p = await prisma.permission.upsert({
      where: { key: perm.key },
      update: { name: perm.name, module: perm.module, description: perm.description },
      create: { key: perm.key, name: perm.name, module: perm.module, description: perm.description }
    });
    permMap.set(perm.key, p.id);
  }

  // 2. Daftarkan Role Sistem
  console.log('📌 [2/7] Menyiapkan System Roles...');
  const SYSTEM_ROLES = [
    {
      id: 'role-system-owner',
      name: 'OWNER',
      description: 'Pemilik Usaha - Akses Penuh ke Seluruh Fitur',
      permissions: SYSTEM_PERMISSIONS.map(p => p.key)
    },
    {
      id: 'role-system-admin',
      name: 'ADMIN',
      description: 'Administrator Operasional',
      permissions: SYSTEM_PERMISSIONS.map(p => p.key)
    },
    {
      id: 'role-system-cashier',
      name: 'KASIR',
      description: 'Kasir Front Office',
      permissions: ['pos.view', 'pos.create', 'pos.reprint', 'tables.view', 'reservations.view', 'reservations.manage', 'cashflow.view', 'cashflow.manage', 'shifts.manage', 'attendance.clock', 'crm.view', 'crm.manage']
    }
  ];

  for (const r of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { id: r.id },
      update: { name: r.name, description: r.description, isSystem: true },
      create: { id: r.id, name: r.name, description: r.description, isSystem: true }
    });

    for (const pKey of r.permissions) {
      const pId = permMap.get(pKey);
      if (pId) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: pId } },
          update: {},
          create: { roleId: role.id, permissionId: pId }
        });
      }
    }
  }

  // 3. Buat Master Tenant Utama
  console.log('📌 [3/7] Membuat Tenant Utama VAMOS POOL & CAFE...');
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'vamospool' },
    update: {
      name: 'VAMOS POOL & CAFE',
      status: 'ACTIVE',
      ownerName: 'Owner Vamos Pool'
    },
    create: {
      id: 'tenant-vamos-pool',
      name: 'VAMOS POOL & CAFE',
      slug: 'vamospool',
      status: 'ACTIVE',
      ownerName: 'Owner Vamos Pool'
    }
  });

  // 4. Buat Outlet Utama
  console.log('📌 [4/7] Membuat Outlet Pusat...');
  const outlet = await prisma.outlet.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'VM01' } },
    update: {
      name: 'Vamos Pool & Cafe - Pusat',
      address: 'Jl. Pemuda No. 1, Polewali Mandar',
      tenantId: tenant.id,
      status: 'ACTIVE'
    },
    create: {
      name: 'Vamos Pool & Cafe - Pusat',
      code: 'VM01',
      tenantId: tenant.id,
      address: 'Jl. Pemuda No. 1, Polewali Mandar',
      status: 'ACTIVE'
    }
  });

  // 5. Setup Pengaturan Toko
  console.log('📌 [5/7] Mengonfigurasi Pengaturan Toko...');
  const defaultShifts = JSON.stringify([
    { id: '1', name: 'Shift Pagi - Siang', start: '10:00', end: '18:00', lateTolerance: 15 },
    { id: '2', name: 'Shift Sore - Malam', start: '17:00', end: '01:00', lateTolerance: 15 }
  ]);

  const existingSettings = await prisma.settings.findFirst({
    where: { tenantId: tenant.id }
  });

  if (!existingSettings) {
    await prisma.settings.create({
      data: {
        tenant: { connect: { id: tenant.id } },
        outlet: { connect: { id: outlet.id } },
        storeName: 'VAMOS POOL & CAFE',
        phone: '081234567890',
        address: 'Jl. Pemuda No. 1, Polewali Mandar, Sulawesi Barat',
        receiptHeader: 'VAMOS POOL & CAFE\nBilliard & Cafe Premium\nJl. Pemuda No. 1, Polman',
        receiptFooter: 'Terima Kasih Atas Kunjungan Anda!\nFollow IG: @vamospool.id',
        bankName: 'BCA',
        accountNumber: '8830-1928-11',
        accountName: 'VAMOS POOL & CAFE',
        workShifts: defaultShifts,
        taxRate: 0,
        serviceCharge: 0,
        includeTax: false,
        enableDrinkCustomization: true,
        enableKDS: true,
        loyaltyEnabled: true,
        loyaltyEarnPerAmount: 10000,
        loyaltyPointValue: 100
      }
    });
  }

  // 6. Buat Akun Pengguna (admin & kasir)
  console.log('📌 [6/7] Membuat Akun Pengguna...');
  const passAdmin = await bcrypt.hash('admin123', 10);
  const passKasir = await bcrypt.hash('kasir123', 10);

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      name: 'Owner Vamos',
      role: 'admin',
      passwordHash: passAdmin,
      permissions: JSON.stringify(['*']),
      status: 'Aktif'
    },
    create: {
      username: 'admin',
      name: 'Owner Vamos',
      role: 'admin',
      passwordHash: passAdmin,
      pin: '123456',
      permissions: JSON.stringify(['*']),
      status: 'Aktif'
    }
  });

  const kasirUser = await prisma.user.upsert({
    where: { username: 'kasir' },
    update: {
      name: 'Kasir Vamos',
      role: 'kasir',
      passwordHash: passKasir,
      permissions: JSON.stringify(['pos.*', 'tables.*', 'shifts.*']),
      status: 'Aktif'
    },
    create: {
      username: 'kasir',
      name: 'Kasir Vamos',
      role: 'kasir',
      passwordHash: passKasir,
      pin: '112233',
      permissions: JSON.stringify(['pos.*', 'tables.*', 'shifts.*']),
      status: 'Aktif'
    }
  });

  await prisma.tenantMembership.upsert({
    where: { userId_tenantId: { userId: adminUser.id, tenantId: tenant.id } },
    update: { roleId: 'role-system-owner', status: 'ACTIVE' },
    create: { userId: adminUser.id, tenantId: tenant.id, roleId: 'role-system-owner', status: 'ACTIVE' }
  });

  await prisma.tenantMembership.upsert({
    where: { userId_tenantId: { userId: kasirUser.id, tenantId: tenant.id } },
    update: { roleId: 'role-system-cashier', status: 'ACTIVE' },
    create: { userId: kasirUser.id, tenantId: tenant.id, roleId: 'role-system-cashier', status: 'ACTIVE' }
  });

  // 7. Kategori Awal & Meja
  console.log('📌 [7/7] Menyiapkan Kategori Menu & Denah Meja...');
  const catNames = ['Kopi & Minuman', 'Makanan & Snack', 'Biliar & Game'];
  for (const name of catNames) {
    const exists = await prisma.category.findFirst({
      where: { name, tenantId: tenant.id }
    });
    if (!exists) {
      await prisma.category.create({
        data: { name, tenantId: tenant.id }
      });
    }
  }

  const tables = [
    { tableNo: 'Meja 01', capacity: 4 },
    { tableNo: 'Meja 02', capacity: 4 },
    { tableNo: 'Meja 03', capacity: 6 },
    { tableNo: 'Meja 04', capacity: 6 },
    { tableNo: 'Pool 01 (Regular)', capacity: 4 },
    { tableNo: 'Pool 02 (Regular)', capacity: 4 },
    { tableNo: 'Pool VIP 01', capacity: 8 }
  ];

  for (const t of tables) {
    const exists = await prisma.table.findFirst({
      where: { tableNo: t.tableNo, tenantId: tenant.id }
    });
    if (!exists) {
      await prisma.table.create({
        data: {
          tableNo: t.tableNo,
          capacity: t.capacity,
          tenantId: tenant.id,
          outletId: outlet.id,
          status: 'Tersedia'
        }
      });
    }
  }

  // 8. Produk & Menu Awal
  console.log('📌 [8/8] Menyiapkan Menu Produk Awal...');
  const catDrinks = await prisma.category.findFirst({ where: { name: 'Kopi & Minuman', tenantId: tenant.id } });
  const catFoods = await prisma.category.findFirst({ where: { name: 'Makanan & Snack', tenantId: tenant.id } });
  const catPool = await prisma.category.findFirst({ where: { name: 'Biliar & Game', tenantId: tenant.id } });

  const initialProducts = [
    // Minuman
    { name: 'Kopi Susu Gula Aren', categoryId: catDrinks?.id, buyPrice: 8000, sellPrice: 18000, stock: 150 },
    { name: 'Americano / Long Black', categoryId: catDrinks?.id, buyPrice: 5000, sellPrice: 15000, stock: 150 },
    { name: 'Caffe Latte', categoryId: catDrinks?.id, buyPrice: 9000, sellPrice: 20000, stock: 150 },
    { name: 'Matcha Latte Ice', categoryId: catDrinks?.id, buyPrice: 10000, sellPrice: 22000, stock: 150 },
    { name: 'Lemon Tea Ice', categoryId: catDrinks?.id, buyPrice: 4000, sellPrice: 12000, stock: 150 },
    { name: 'Air Mineral 600ml', categoryId: catDrinks?.id, buyPrice: 2500, sellPrice: 5000, stock: 200 },
    // Makanan
    { name: 'Nasi Goreng Spesial Vamos', categoryId: catFoods?.id, buyPrice: 12000, sellPrice: 25000, stock: 50 },
    { name: 'Mie Goreng Telur', categoryId: catFoods?.id, buyPrice: 10000, sellPrice: 20000, stock: 50 },
    { name: 'Kentang Goreng (French Fries)', categoryId: catFoods?.id, buyPrice: 7000, sellPrice: 15000, stock: 80 },
    { name: 'Cireng Crispy Bumbu Rujak', categoryId: catFoods?.id, buyPrice: 6000, sellPrice: 15000, stock: 80 },
    { name: 'Roti Bakar Coklat Keju', categoryId: catFoods?.id, buyPrice: 8000, sellPrice: 18000, stock: 60 },
    // Biliar
    { name: 'Sewa Meja Regular (1 Jam)', categoryId: catPool?.id, buyPrice: 0, sellPrice: 35000, stock: 999 },
    { name: 'Sewa Meja VIP (1 Jam)', categoryId: catPool?.id, buyPrice: 0, sellPrice: 60000, stock: 999 }
  ];

  for (const prod of initialProducts) {
    if (!prod.categoryId) continue;
    const exists = await prisma.product.findFirst({
      where: { name: prod.name, tenantId: tenant.id }
    });
    if (!exists) {
      await prisma.product.create({
        data: {
          name: prod.name,
          categoryId: prod.categoryId,
          tenantId: tenant.id,
          buyPrice: prod.buyPrice,
          sellPrice: prod.sellPrice,
          stock: prod.stock,
          status: 'Aktif'
        }
      });
    }
  }

  console.log('\n======================================================');
  console.log('🎉 SEED DATABASE VAMOS POOL & CAFE SELESAI DENGAN SUKSES!');
  console.log('   - Tenant   : VAMOS POOL & CAFE (Slug: vamospool)');
  console.log('   - Outlet   : Vamos Pool & Cafe - Pusat');
  console.log('   - Login 1  : admin / admin123 (Owner / Full Access)');
  console.log('   - Login 2  : kasir / kasir123 (Kasir POS)');
  console.log('======================================================');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding vamos cafe:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
