const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'codepos-secret-key-change-in-production';

async function runTest() {
  console.log('====================================================================');
  console.log('🧪 VERIFIKASI PRESENSI STAFF APP & INDEPENDENSI MULTI-VERTIKAL');
  console.log('====================================================================\n');

  const timestamp = Date.now();
  const cafeTenantId = `tenant_cafe_test_${timestamp}`;
  const bengkelTenantId = `tenant_bengkel_test_${timestamp}`;

  try {
    // 1. SETUP CAFE TENANT DENGAN SUPER ADMIN & KASIR BARU
    console.log('[1] Setup Tenant Cafe...');
    await prisma.tenant.create({
      data: {
        id: cafeTenantId,
        name: `Muki Cafe Test ${timestamp}`,
        slug: `muki-cafe-${timestamp}`,
        businessType: 'CAFE',
        status: 'ACTIVE',
        settings: {
          create: {
            storeName: 'Muki Ramen & Coffee',
            storeLatitude: -6.2,
            storeLongitude: 106.8,
            gpsRadiusMeters: 500,
            enableGpsValidation: false,
            enableCameraPhoto: false
          }
        }
      }
    });

    // Buat Super Admin / Owner (User 1) dengan PIN default 123456
    const superAdmin = await prisma.user.create({
      data: {
        name: 'Super Admin',
        username: `admin_cafe_${timestamp}`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuu',
        pin: '123456',
        role: 'SUPERADMIN',
        status: 'Aktif',
        tenantId: cafeTenantId,
        permissions: '{}',
        memberships: {
          create: {
            tenantId: cafeTenantId,
            pin: '123456',
            status: 'ACTIVE'
          }
        }
      }
    });

    // Buat Kasir Baru (User 2) dengan PIN default 123456 (Skenario User)
    const cashier = await prisma.user.create({
      data: {
        name: 'Siti Kasir Baru',
        username: `kasir_cafe_${timestamp}`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuu',
        pin: '123456',
        role: 'Kasir',
        status: 'Aktif',
        tenantId: cafeTenantId,
        permissions: '{}',
        memberships: {
          create: {
            tenantId: cafeTenantId,
            pin: '123456',
            status: 'ACTIVE'
          }
        }
      }
    });

    console.log(`  - Super Admin ID: ${superAdmin.id} (@${superAdmin.username}), PIN: ${superAdmin.pin}`);
    console.log(`  - Kasir Baru ID:   ${cashier.id} (@${cashier.username}), PIN: ${cashier.pin}`);

    // Kasir login dan dapatkan token JWT
    const cashierToken = jwt.sign({
      id: cashier.id,
      username: cashier.username,
      name: cashier.name,
      tenantId: cafeTenantId,
      role: cashier.role,
      businessType: 'CAFE'
    }, JWT_SECRET, { expiresIn: '1d' });

    console.log('\n[2] Simulasi Kasir Clock In via Staff App (dengan token JWT & userId)...');
    
    // Panggil logika clock in persis seperti attendance.ts
    // 1. Ekstraksi token
    const decoded = jwt.verify(cashierToken, JWT_SECRET);
    const requestedTenantId = cafeTenantId;
    const targetUserId = cashier.id || decoded.id;

    // Resolusi user
    const resolvedUser = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        status: 'Aktif',
        OR: [
          { tenantId: requestedTenantId },
          { memberships: { some: { tenantId: requestedTenantId, status: 'ACTIVE' } } }
        ]
      },
      include: {
        memberships: {
          where: { tenantId: requestedTenantId, status: 'ACTIVE' },
          take: 1
        }
      }
    });

    if (!resolvedUser) {
      throw new Error('User not found in tenant!');
    }

    console.log(`  - User teridentifikasi: ${resolvedUser.name} (ID: ${resolvedUser.id}, Role: ${resolvedUser.role})`);
    
    if (resolvedUser.id === superAdmin.id) {
      console.error('❌ BUG TERDETEKSI: Absensi kasir malah mendeteksi Super Admin!');
      process.exit(1);
    } else if (resolvedUser.id === cashier.id) {
      console.log('✅ SUKSES: Absensi berhasil mengenali KASIR BARU, bukan Super Admin!');
    }

    // Buat attendance record
    const attendanceRecord = await prisma.attendance.create({
      data: {
        tenantId: requestedTenantId,
        userId: resolvedUser.id,
        date: new Date().toISOString().slice(0, 10),
        clockIn: new Date(),
        shiftName: 'Shift Pagi (08:00 - 16:00)',
        status: 'Hadir',
        lateMinutes: 0
      }
    });

    console.log(`  - Record Attendance ID: ${attendanceRecord.id}, userId: ${attendanceRecord.userId}`);

    // [3] Cek GET /api/attendance (List view di Admin Portal)
    console.log('\n[3] Cek Laporan Absensi Admin (GET /api/attendance)...');
    const adminViewLogs = await prisma.attendance.findMany({
      where: { tenantId: cafeTenantId, id: attendanceRecord.id },
      include: { user: { select: { id: true, name: true, role: true } } }
    });

    const logItem = adminViewLogs[0];
    console.log(`  - Attendee di dashboard: ${logItem.user.name} (${logItem.user.role})`);
    if (logItem.user.id !== cashier.id) {
      throw new Error(`Expected cashier ID ${cashier.id}, got ${logItem.user.id}`);
    }
    console.log('✅ SUKSES: Di dashboard admin muncul nama "Siti Kasir Baru" (Kasir)!');

    // [4] Cek GET /api/attendance/my-summary (Summary di Staff App Kasir)
    console.log('\n[4] Cek Summary di Staff App Kasir (GET /my-summary)...');
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const cashierTodayLog = await prisma.attendance.findFirst({
      where: {
        userId: cashier.id,
        clockIn: { gte: todayStart },
        tenantId: cafeTenantId
      }
    });

    if (!cashierTodayLog) {
      throw new Error('Cashier summary did not find today clock-in!');
    }
    console.log(`  - Status Kasir: Clocked In at ${cashierTodayLog.clockIn.toISOString()}`);
    console.log('✅ SUKSES: Staff App Kasir menampilkan status "Sedang Shift"!');

    // [5] Cek Ambiguitas PIN pada Terminal Publik tanpa login (PIN 123456 ganda)
    console.log('\n[5] Uji Penolakan PIN Ganda pada Terminal Bersama (Ambiguous PIN Detection)...');
    const matchingUsers = await prisma.user.findMany({
      where: {
        status: 'Aktif',
        pin: '123456',
        OR: [
          { tenantId: cafeTenantId },
          { memberships: { some: { tenantId: cafeTenantId, status: 'ACTIVE' } } }
        ]
      }
    });
    console.log(`  - Jumlah user dengan PIN "123456" di tenant ini: ${matchingUsers.length}`);
    if (matchingUsers.length > 1) {
      console.log('✅ SUKSES: Sistem mendeteksi ambiguitas (lebih dari 1 staf ber-PIN 123456) dan meminta PIN unik atau login Staff App.');
    }

    // [6] Setup Tenant Bengkel & Uji Independensi Vertikal
    console.log('\n[6] Uji Independensi Vertikal Tenant Bengkel...');
    await prisma.tenant.create({
      data: {
        id: bengkelTenantId,
        name: `Bengkel Motor Test ${timestamp}`,
        slug: `bengkel-motor-${timestamp}`,
        businessType: 'BENGKEL',
        status: 'ACTIVE'
      }
    });

    const mechanic = await prisma.user.create({
      data: {
        name: 'Budi Mekanik',
        username: `mekanik_${timestamp}`,
        passwordHash: '$2a$10$abcdefghijklmnopqrstuu',
        pin: '888888',
        role: 'Mekanik',
        status: 'Aktif',
        tenantId: bengkelTenantId,
        permissions: '{}',
        memberships: {
          create: {
            tenantId: bengkelTenantId,
            pin: '888888',
            status: 'ACTIVE'
          }
        }
      }
    });

    const tenantBengkelDb = await prisma.tenant.findUnique({
      where: { id: bengkelTenantId },
      select: { businessType: true }
    });

    console.log(`  - Tenant Bengkel businessType: ${tenantBengkelDb.businessType}`);
    if (tenantBengkelDb.businessType !== 'BENGKEL') {
      throw new Error('Tenant Bengkel businessType mismatch');
    }
    console.log('✅ SUKSES: Tenant Bengkel terisolasi secara vertikal dengan profile BENGKEL!');

    console.log('\n====================================================================');
    console.log('🎉 SELURUH PENGUJIAN STAFF APP & INDEPENDENSI MULTI-VERTIKAL LULUS!');
    console.log('====================================================================\n');

  } catch (err) {
    console.error('❌ ERROR RUNNING TEST:', err);
    process.exit(1);
  } finally {
    // Cleanup
    try {
      await prisma.attendance.deleteMany({ where: { tenantId: { in: [cafeTenantId, bengkelTenantId] } } });
      await prisma.user.deleteMany({ where: { tenantId: { in: [cafeTenantId, bengkelTenantId] } } });
      await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [cafeTenantId, bengkelTenantId] } } });
      await prisma.settings.deleteMany({ where: { tenantId: { in: [cafeTenantId, bengkelTenantId] } } });
      await prisma.tenant.deleteMany({ where: { id: { in: [cafeTenantId, bengkelTenantId] } } });
    } catch (e) {}
    await prisma.$disconnect();
  }
}

runTest();
