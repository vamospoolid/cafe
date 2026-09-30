const { Client } = require('ssh2');
const config = { host: '173.212.243.240', port: 22, username: 'root', password: 'Ahmad_dcc07', readyTimeout: 15000 };

const scriptOnVps = `
const { PrismaClient } = require('/var/www/poscafe/backend/node_modules/@prisma/client');
const bcrypt = require('/var/www/poscafe/backend/node_modules/bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('=== STARTING VPS REPAIR ===');

  // 1. Assign ENTERPRISE plan to tenant-vamos-pool
  const enterprisePlan = await prisma.plan.findFirst({
    where: { code: 'ENTERPRISE' }
  });

  if (enterprisePlan) {
    await prisma.tenant.updateMany({
      where: { id: 'tenant-vamos-pool' },
      data: { planId: enterprisePlan.id, status: 'ACTIVE' }
    });
    console.log('✅ Plan Enterprise assigned to tenant-vamos-pool!');
  }

  // Also make sure pos.tables isCore in Feature table so it is NEVER locked
  await prisma.feature.updateMany({
    where: { key: 'pos.tables' },
    data: { isCore: true }
  });
  console.log('✅ pos.tables marked as isCore!');

  // 2. Ensure role-system-kitchen exists
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
  console.log('✅ role-system-kitchen ready!');

  // 3. Create user dapur
  const passwordHash = await bcrypt.hash('password123', 10);
  const permKeys = ['inventory.view', 'inventory.adjust', 'kds.view', 'kds.cook', 'kds.serve', 'attendance.clock', 'tables.view'];

  const dapurUser = await prisma.user.upsert({
    where: { username: 'dapur' },
    update: {
      name: 'Chef Dapur',
      role: 'Dapur',
      passwordHash,
      pin: '123456',
      permissions: JSON.stringify(permKeys),
      status: 'Aktif'
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
  console.log('✅ User dapur upserted! ID:', dapurUser.id);

  // 4. Attach memberships to both tenants for user dapur
  const tenants = await prisma.tenant.findMany();
  for (const t of tenants) {
    const existing = await prisma.tenantMembership.findFirst({
      where: { userId: dapurUser.id, tenantId: t.id }
    });
    if (!existing) {
      await prisma.tenantMembership.create({
        data: {
          userId: dapurUser.id,
          tenantId: t.id,
          roleId: kitchenRole.id,
          status: 'ACTIVE'
        }
      });
    } else {
      await prisma.tenantMembership.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE', roleId: kitchenRole.id }
      });
    }
  }
  console.log('✅ Memberships linked to all tenants for dapur user!');

  // Also ensure user iqram and irfan have memberships
  const otherKitchenUsers = await prisma.user.findMany({
    where: { username: { in: ['iqram', 'irfan', 'sarah'] } }
  });
  for (const u of otherKitchenUsers) {
    for (const t of tenants) {
      const existing = await prisma.tenantMembership.findFirst({
        where: { userId: u.id, tenantId: t.id }
      });
      if (!existing) {
        await prisma.tenantMembership.create({
          data: {
            userId: u.id,
            tenantId: t.id,
            roleId: kitchenRole.id,
            status: 'ACTIVE'
          }
        });
      }
    }
  }
  console.log('✅ Other kitchen users updated!');

  console.log('=== VPS REPAIR COMPLETED SUCCESSFULLY ===');
}

main().catch(console.error).finally(() => prisma.$disconnect());
`;

const conn = new Client();
conn.on('ready', () => {
  console.log('🔗 Connected to VPS. Running fix script...\n');
  const remotePath = '/var/www/poscafe/backend/fix_vps_dapur_and_plan.js';
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const writeStream = sftp.createWriteStream(remotePath);
    writeStream.write(scriptOnVps);
    writeStream.end();
    writeStream.on('close', () => {
      console.log('Uploaded script to VPS. Executing...');
      conn.exec(`node ${remotePath} && rm -f ${remotePath}`, (execErr, stream) => {
        if (execErr) throw execErr;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', code => {
          console.log('\nFinished with exit code:', code);
          // Restart backend to clear in-memory caches
          conn.exec('pm2 restart poscafe-backend || pm2 restart all', (pmErr, pmStream) => {
            if (pmErr) throw pmErr;
            pmStream.on('data', d => process.stdout.write(d.toString()));
            pmStream.on('close', () => {
              console.log('PM2 restarted!');
              conn.end();
            });
          });
        });
      });
    });
  });
}).connect(config);
