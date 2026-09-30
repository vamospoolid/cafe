const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function setupKitchenUser() {
  // 1. Upsert role-system-kitchen
  const kitchenRole = await prisma.role.upsert({
    where: { id: 'role-system-kitchen' },
    update: { name: 'DAPUR', description: 'Staf Dapur & Barista' },
    create: {
      id: 'role-system-kitchen',
      name: 'DAPUR',
      description: 'Staf Dapur & Barista',
      isSystem: true
    }
  });

  // 2. Attach permissions
  const permKeys = ['inventory.view', 'inventory.adjust', 'kds.view', 'kds.cook', 'kds.serve', 'attendance.clock'];
  const perms = await prisma.permission.findMany({ where: { key: { in: permKeys } } });
  for (const p of perms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: kitchenRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: kitchenRole.id, permissionId: p.id }
    });
  }

  // 3. Upsert user dapur
  const passwordHash = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { username: 'dapur' },
    update: {
      name: 'Chef Dapur',
      role: 'Dapur',
      passwordHash,
      pin: '123456',
      permissions: JSON.stringify(permKeys)
    },
    create: {
      name: 'Chef Dapur',
      username: 'dapur',
      role: 'Dapur',
      passwordHash,
      pin: '123456',
      permissions: JSON.stringify(permKeys),
      status: 'Aktif'
    }
  });

  // 4. Create membership for tenant
  const tenant = await prisma.tenant.findFirst();
  if (tenant) {
    const existingMembership = await prisma.tenantMembership.findFirst({
      where: { userId: user.id, tenantId: tenant.id }
    });
    if (!existingMembership) {
      await prisma.tenantMembership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          roleId: kitchenRole.id,
          status: 'ACTIVE'
        }
      });
    }
  }

  console.log('SUCCESS: Dapur user created/updated successfully!');
  console.log('Username: dapur');
  console.log('Password: password123');
  console.log('PIN: 123456');
}

setupKitchenUser()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
