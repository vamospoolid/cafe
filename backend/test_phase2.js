const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

async function testPhase2() {
  console.log('🧪 === MENJALANKAN TEST SUITE FASE 2: USER, MEMBERSHIP & RBAC === 🧪\n');

  // 1. Test Seeded Roles & Permissions
  console.log('--- [1/4] Test Roles & Permissions Seeding Integrity ---');
  const [roleCount, permCount] = await Promise.all([
    prisma.role.count(),
    prisma.permission.count()
  ]);
  console.log(`Ditemukan ${roleCount} roles dan ${permCount} permission keys terdaftar di DB.`);
  if (roleCount >= 7 && permCount >= 40) {
    console.log('✅ TEST 1 (Role & Permission Registry): PASSED!\n');
  } else {
    throw new Error('❌ TEST 1: Role / Permission count kurang dari batas minimum.');
  }

  // 2. Test Tenant Membership Resolution for Admin
  console.log('--- [2/4] Test Tenant Membership Association ---');
  const adminUser = await prisma.user.findFirst({
    where: { username: 'admin' },
    include: {
      memberships: {
        include: {
          tenant: true,
          role: {
            include: {
              permissions: {
                include: { permission: true }
              }
            }
          }
        }
      }
    }
  });

  if (!adminUser || adminUser.memberships.length === 0) {
    throw new Error('❌ TEST 2: Admin user tidak memiliki tenant membership terdaftar.');
  }

  const membership = adminUser.memberships[0];
  const roleName = membership.role?.name;
  const permissionKeys = membership.role?.permissions.map(p => p.permission.key) || [];
  console.log(`User: ${adminUser.username} | Tenant: ${membership.tenant.name} (${membership.tenant.slug}) | Role: ${roleName}`);
  console.log(`Permissions (${permissionKeys.length} keys): ${permissionKeys.slice(0, 5).join(', ')}...`);
  
  if (permissionKeys.includes('pos.create') && permissionKeys.includes('employees.manage')) {
    console.log('✅ TEST 2 (Tenant Membership & Permission Mapping): PASSED!\n');
  } else {
    throw new Error('❌ TEST 2: Admin role tidak memiliki permission wajib.');
  }

  // 3. Test Cashier Limited Permissions (RBAC Boundary)
  console.log('--- [3/4] Test Cashier RBAC Boundary & Privilege Isolation ---');
  const cashierRole = await prisma.role.findFirst({
    where: { name: 'CASHIER' },
    include: {
      permissions: {
        include: { permission: true }
      }
    }
  });

  const cashierPerms = cashierRole?.permissions.map(p => p.permission.key) || [];
  const canManageStaff = cashierPerms.includes('employees.manage');
  const canManageSettings = cashierPerms.includes('settings.manage');
  const canCreatePOS = cashierPerms.includes('pos.create');

  console.log(`Cashier Perms: pos.create = ${canCreatePOS}, employees.manage = ${canManageStaff}, settings.manage = ${canManageSettings}`);
  if (canCreatePOS && !canManageStaff && !canManageSettings) {
    console.log('✅ TEST 3 (Cashier Privilege Boundary): PASSED (Kasir tidak bisa mengelola staf/pengaturan)!\n');
  } else {
    throw new Error('❌ TEST 3: Privilege boundary Cashier bocor!');
  }

  // 4. Test Multi-Tenant Token Payload Structure
  console.log('--- [4/4] Test Multi-Tenant JWT Token Payload ---');
  const tokenPayload = {
    id: adminUser.id,
    username: adminUser.username,
    tenantId: membership.tenantId,
    role: roleName,
    permissions: permissionKeys
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });
  const verified = jwt.verify(token, JWT_SECRET);

  if (verified.tenantId === 'tenant-default-muki' && Array.isArray(verified.permissions) && verified.permissions.length > 0) {
    console.log(`Token verified successfully with tenantId: "${verified.tenantId}" & ${verified.permissions.length} permissions.`);
    console.log('✅ TEST 4 (Multi-Tenant JWT Token Payload): PASSED!\n');
  } else {
    throw new Error('❌ TEST 4: Token payload tidak valid.');
  }

  console.log('🎉 SEMUA PENGUJIAN FASE 2 SELESAI DENGAN SUKSES TANPA REGRESI! 🎉');
}

testPhase2()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
