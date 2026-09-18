import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

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

  // Karyawan, Absensi & Pinjaman
  { key: 'employees.view', name: 'Lihat Karyawan', module: 'HR', description: 'Melihat daftar staf dan profil' },
  { key: 'employees.manage', name: 'Kelola Karyawan', module: 'HR', description: 'Menambah dan mengedit akun staf serta hak akses' },
  { key: 'attendance.view', name: 'Lihat Absensi', module: 'HR', description: 'Melihat rekap kehadiran staf' },
  { key: 'attendance.clock', name: 'Absen Mandiri', module: 'HR', description: 'Melakukan clock-in dan clock-out mandiri' },
  { key: 'loans.view', name: 'Lihat Kasbon', module: 'HR', description: 'Melihat riwayat pinjaman/kasbon staf' },
  { key: 'loans.manage', name: 'Kelola Kasbon', module: 'HR', description: 'Menyetujui dan mencairkan kasbon staf' },

  // Laporan & Analitik
  { key: 'reports.view', name: 'Lihat Laporan Penjualan', module: 'REPORTS', description: 'Melihat omzet, laba kotor, dan riwayat transaksi' },
  { key: 'reports.export', name: 'Ekspor Data (Excel/PDF)', module: 'REPORTS', description: 'Mengunduh laporan dalam format Excel atau PDF' },
  { key: 'analytics.view', name: 'Lihat Analitik Lanjutan', module: 'REPORTS', description: 'Melihat statistik jam sibuk, bagi hasil, dan performa menu' },

  // CRM & Pelanggan
  { key: 'crm.view', name: 'Lihat Pelanggan', module: 'CRM', description: 'Melihat database pelanggan dan poin reward' },
  { key: 'crm.manage', name: 'Kelola Pelanggan & Poin', module: 'CRM', description: 'Menambah pelanggan dan mengatur poin loyalty' },

  // Inventaris & Gudang Cabang
  { key: 'inventory.view', name: 'Lihat Stok Bahan Baku', module: 'INVENTORY', description: 'Melihat sisa stok bahan baku dapur' },
  { key: 'inventory.adjust', name: 'Penyesuaian Stok / Rusak', module: 'INVENTORY', description: 'Mencatat barang rusak, waste, dan opname' },
  { key: 'inventory.po', name: 'Kelola Purchase Order', module: 'INVENTORY', description: 'Membuat dan menerima PO dari supplier' },
  { key: 'suppliers.manage', name: 'Kelola Supplier', module: 'INVENTORY', description: 'Menambah dan mengedit kontak vendor/supplier' },

  // Gudang Pusat (Central Warehouse)
  { key: 'warehouse.view', name: 'Lihat Gudang Pusat', module: 'WAREHOUSE', description: 'Melihat stok grosir di gudang pusat' },
  { key: 'warehouse.inbound', name: 'Belanja Grosir Inbound', module: 'WAREHOUSE', description: 'Mencatat nota belanja modal gudang pusat' },
  { key: 'warehouse.requisition', name: 'Kelola Distribusi Requisition', module: 'WAREHOUSE', description: 'Menyetujui permintaan bahan baku dari cabang' },
  { key: 'warehouse.sales', name: 'Penjualan B2B Gudang', module: 'WAREHOUSE', description: 'Membuat nota penjualan grosir ke mitra' },

  // Pengaturan & Platform & Security
  { key: 'settings.view', name: 'Lihat Pengaturan Toko', module: 'SETTINGS', description: 'Melihat konfigurasi printer, pajak, dan profil toko' },
  { key: 'settings.manage', name: 'Ubah Pengaturan Toko', module: 'SETTINGS', description: 'Mengubah konfigurasi hardware, pajak, dan bonus omzet' },
  { key: 'audit.view', name: 'Lihat Audit Trail & Log', module: 'SETTINGS', description: 'Melihat riwayat aktivitas sensitif dan perubahan data' },
  { key: 'audit.export', name: 'Ekspor Audit Log', module: 'SETTINGS', description: 'Mengunduh catatan audit log dalam format data' },
  { key: 'platform.admin', name: 'Super Admin Platform', module: 'PLATFORM', description: 'Akses penuh ke konfigurasi multi-tenant SaaS' },
];

const SYSTEM_ROLES = [
  {
    id: 'role-system-owner',
    name: 'OWNER',
    description: 'Pemilik Usaha / Tenant Owner - Hak akses penuh ke seluruh modul bisnis',
    isSystem: true,
    permissions: SYSTEM_PERMISSIONS.map(p => p.key) // Semua permission
  },
  {
    id: 'role-system-admin',
    name: 'ADMIN',
    description: 'Administrator Toko - Mengelola operasional, staf, inventaris, dan laporan',
    isSystem: true,
    permissions: SYSTEM_PERMISSIONS.filter(p => p.module !== 'PLATFORM').map(p => p.key)
  },
  {
    id: 'role-system-manager',
    name: 'MANAGER',
    description: 'Manager Outlet - Mengawasi kasir, dapur, stok harian, dan absensi',
    isSystem: true,
    permissions: [
      'pos.view', 'pos.create', 'pos.discount', 'pos.void', 'pos.reprint',
      'kds.view', 'kds.cook', 'kds.serve',
      'tables.view', 'tables.manage', 'reservations.view', 'reservations.manage',
      'products.view', 'cashflow.view', 'cashflow.manage', 'shifts.manage',
      'employees.view', 'attendance.view', 'attendance.clock', 'loans.view',
      'reports.view', 'crm.view', 'crm.manage', 'inventory.view', 'inventory.adjust',
      'settings.view'
    ]
  },
  {
    id: 'role-system-cashier',
    name: 'CASHIER',
    description: 'Kasir - Melayani transaksi penjualan, buka/tutup kas, dan meja',
    isSystem: true,
    permissions: [
      'pos.view', 'pos.create', 'pos.discount', 'pos.reprint',
      'tables.view', 'reservations.view', 'reservations.manage',
      'products.view', 'cashflow.view', 'cashflow.manage', 'shifts.manage',
      'attendance.clock', 'crm.view', 'crm.manage'
    ]
  },
  {
    id: 'role-system-kitchen',
    name: 'KITCHEN',
    description: 'Staf Dapur / Barista - Memasak pesanan KDS dan melihat resep',
    isSystem: true,
    permissions: [
      'kds.view', 'kds.cook', 'kds.serve', 'attendance.clock', 'inventory.view'
    ]
  },
  {
    id: 'role-system-warehouse',
    name: 'WAREHOUSE',
    description: 'Staf Gudang Pusat - Mengelola stok grosir, inbound belanja, dan distribusi',
    isSystem: true,
    permissions: [
      'warehouse.view', 'warehouse.inbound', 'warehouse.requisition', 'warehouse.sales',
      'inventory.view', 'inventory.adjust', 'inventory.po', 'suppliers.manage',
      'attendance.clock'
    ]
  },
  {
    id: 'role-system-hr',
    name: 'HR',
    description: 'Personalia - Mengelola jadwal staf, absensi, cuti, dan kasbon',
    isSystem: true,
    permissions: [
      'employees.view', 'employees.manage', 'attendance.view', 'attendance.clock',
      'loans.view', 'loans.manage', 'reports.view'
    ]
  }
];

export async function seedMultiTenantFoundation() {
  console.log('🚀 [Seed Phase 1] Memulai inisialisasi fondasi SaaS Multi-Tenant...');

  // 1. Seed Permissions
  console.log('📌 [1/5] Mendaftarkan Granular Permission Keys...');
  for (const perm of SYSTEM_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: {
        name: perm.name,
        module: perm.module,
        description: perm.description
      },
      create: {
        key: perm.key,
        name: perm.name,
        module: perm.module,
        description: perm.description
      }
    });
  }
  console.log(`✅ Berhasil mendaftarkan ${SYSTEM_PERMISSIONS.length} Permission Keys.`);

  // 2. Seed System Roles & RolePermission mappings
  console.log('📌 [2/5] Mendaftarkan System Default Roles...');
  const allPerms = await prisma.permission.findMany();
  const permMap = new Map(allPerms.map(p => [p.key, p.id]));

  for (const roleDef of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { id: roleDef.id },
      update: {
        name: roleDef.name,
        description: roleDef.description,
        isSystem: true
      },
      create: {
        id: roleDef.id,
        name: roleDef.name,
        description: roleDef.description,
        isSystem: true
      }
    });

    // Sync role permissions
    for (const permKey of roleDef.permissions) {
      const permId = permMap.get(permKey);
      if (permId) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permId
            }
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permId
          }
        });
      }
    }
  }
  console.log(`✅ Berhasil mendaftarkan ${SYSTEM_ROLES.length} System Roles.`);

  // 3. Seed Default Master Tenant (Muki Ramen)
  console.log('📌 [3/5] Membuat Default Master Tenant (Muki Ramen)...');
  const masterTenant = await prisma.tenant.upsert({
    where: { slug: 'mukiramen' },
    update: {
      name: 'MUKI RAMEN',
      status: 'ACTIVE'
    },
    create: {
      id: 'tenant-default-muki',
      name: 'MUKI RAMEN',
      slug: 'mukiramen',
      status: 'ACTIVE'
    }
  });
  console.log(`✅ Master Tenant Aktif: [${masterTenant.id}] ${masterTenant.name} (${masterTenant.slug})`);

  // 4. Seed Default Primary Outlet (Muki Ramen - Pusat Wonomulyo)
  console.log('📌 [4/5] Membuat Default Primary Outlet...');
  const primaryOutlet = await prisma.outlet.upsert({
    where: {
      tenantId_code: {
        tenantId: masterTenant.id,
        code: 'MUK-01'
      }
    },
    update: {
      name: 'Muki Ramen - Pusat Wonomulyo',
      status: 'ACTIVE',
      latitude: -3.4026521,
      longitude: 119.2137757,
      gpsRadiusMeters: 300
    },
    create: {
      id: 'outlet-default-muki-01',
      tenantId: masterTenant.id,
      name: 'Muki Ramen - Pusat Wonomulyo',
      code: 'MUK-01',
      status: 'ACTIVE',
      latitude: -3.4026521,
      longitude: 119.2137757,
      gpsRadiusMeters: 300
    }
  });
  console.log(`✅ Primary Outlet Aktif: [${primaryOutlet.id}] ${primaryOutlet.name} (${primaryOutlet.code})`);

  // 5. Hubungkan User Existing ke Master Tenant
  console.log('📌 [5/5] Mengaitkan Pengguna Existing ke Master Tenant...');
  const existingUsers = await prisma.user.findMany();
  
  for (const user of existingUsers) {
    let targetRoleId = 'role-system-cashier';
    const lowerRole = user.role.toLowerCase();
    
    if (lowerRole.includes('admin') || lowerRole.includes('owner')) {
      targetRoleId = 'role-system-owner';
    } else if (lowerRole.includes('dapur') || lowerRole.includes('kitchen')) {
      targetRoleId = 'role-system-kitchen';
    } else if (lowerRole.includes('gudang') || lowerRole.includes('warehouse')) {
      targetRoleId = 'role-system-warehouse';
    }

    await prisma.tenantMembership.upsert({
      where: {
        userId_tenantId: {
          userId: user.id,
          tenantId: masterTenant.id
        }
      },
      update: {
        roleId: targetRoleId,
        pin: user.pin,
        status: user.status === 'Aktif' ? 'ACTIVE' : 'SUSPENDED'
      },
      create: {
        userId: user.id,
        tenantId: masterTenant.id,
        roleId: targetRoleId,
        pin: user.pin,
        status: user.status === 'Aktif' ? 'ACTIVE' : 'SUSPENDED'
      }
    });
  }
  console.log(`✅ Berhasil menghubungkan ${existingUsers.length} user ke Master Tenant.`);

  // 6. Hubungkan Data Bisnis yang Belum Memiliki tenantId (Safe Non-destructive Backfill)
  console.log('📌 Mengaitkan data bisnis yang ada ke Master Tenant & Outlet...');
  await Promise.all([
    prisma.category.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id } }).catch(() => {}),
    prisma.product.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id } }).catch(() => {}),
    prisma.table.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id, outletId: primaryOutlet.id } }).catch(() => {}),
    prisma.customer.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id } }).catch(() => {}),
    prisma.pointLog.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id } }).catch(() => {}),
    prisma.order.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id, outletId: primaryOutlet.id } }).catch(() => {}),
    prisma.orderItem.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id, outletId: primaryOutlet.id } }).catch(() => {}),
    prisma.cashFlow.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id, outletId: primaryOutlet.id } }).catch(() => {}),
    prisma.attendance.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id, outletId: primaryOutlet.id } }).catch(() => {}),
    prisma.settings.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id, outletId: primaryOutlet.id } }).catch(() => {}),
    prisma.shift.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id, outletId: primaryOutlet.id } }).catch(() => {}),
    prisma.supplier.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id } }).catch(() => {}),
    prisma.ingredient.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id } }).catch(() => {}),
    prisma.recipeItem.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id } }).catch(() => {}),
    prisma.ingredientLog.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id, outletId: primaryOutlet.id } }).catch(() => {}),
    prisma.purchaseOrder.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id, outletId: primaryOutlet.id } }).catch(() => {}),
    prisma.purchaseOrderItem.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id } }).catch(() => {}),
    prisma.debt.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id } }).catch(() => {}),
    prisma.debtPayment.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id } }).catch(() => {}),
    prisma.leaveRequest.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id } }).catch(() => {}),
    prisma.shiftHandover.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id, outletId: primaryOutlet.id } }).catch(() => {}),
    prisma.kitchenChecklist.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id, outletId: primaryOutlet.id } }).catch(() => {}),
    prisma.warehouseInbound.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id } }).catch(() => {}),
    prisma.warehouseInboundItem.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id } }).catch(() => {}),
    prisma.warehouseRequisition.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id, outletId: primaryOutlet.id } }).catch(() => {}),
    prisma.warehouseRequisitionItem.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id } }).catch(() => {}),
    prisma.ownerFundTransaction.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id } }).catch(() => {}),
    prisma.warehouseSale.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id } }).catch(() => {}),
    prisma.warehouseSaleItem.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id } }).catch(() => {}),
    prisma.employeeLoan.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id } }).catch(() => {}),
    prisma.employeeLoanPayment.updateMany({ where: { tenantId: null }, data: { tenantId: masterTenant.id } }).catch(() => {})
  ]);

  console.log('🎉 [Phase 1 Complete] Inisialisasi fondasi SaaS multi-tenant berhasil diselesaikan!');
}

// Auto-run if executed directly
if (require.main === module) {
  seedMultiTenantFoundation()
    .catch((e) => {
      console.error('❌ Error executing foundation seed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
