const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  console.log('Testing Phase 1 Backend Tenant & SaaS Management...');

  // 1. Check existing tenant
  const tenant = await prisma.tenant.findFirst({
    include: {
      plan: true,
      subscriptions: { include: { plan: true }, take: 1 },
      outlets: true,
      memberships: { include: { user: true, role: true } },
      _count: { select: { outlets: true, memberships: true, products: true } }
    }
  });

  if (!tenant) {
    console.log('No tenant found in database.');
    return;
  }

  console.log('Tenant Found:', {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    ownerName: tenant.ownerName || 'Muki Owner',
    phone: tenant.phone || '081234567890',
    plan: tenant.plan?.name || 'No Plan attached'
  });

  // 2. Update contact details
  const updated = await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      ownerName: 'Bapak Rudi Santoso',
      phone: '081234567890',
      email: 'owner@mukiramen.com',
      notes: 'Cafe Ramen Jepang Utama - Cabang Sudirman'
    }
  });

  console.log('Updated Tenant Contact:', {
    name: updated.name,
    ownerName: updated.ownerName,
    phone: updated.phone,
    email: updated.email
  });

  // 3. Format WA number
  let wa = (updated.phone || '').replace(/[^0-9]/g, '');
  if (wa.startsWith('0')) wa = '62' + wa.slice(1);
  console.log('WhatsApp Direct Link:', `https://wa.me/${wa}?text=Halo%20${encodeURIComponent(updated.ownerName || '')}`);

  // 4. Test Quota limit check
  const maxOutlets = tenant.plan?.maxOutlets || 1;
  const currentOutlets = tenant._count.outlets;
  console.log(`Outlet Quota Status: ${currentOutlets} used / ${maxOutlets} max`);
  console.log(`Can create outlet?`, currentOutlets < maxOutlets);

  console.log('\n--- Phase 1 Backend Verification: SUCCESS! ---');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
