const prisma = require('../src/db').default;

async function check() {
  const shifts = await prisma.shift.findMany({
    orderBy: { id: 'desc' },
    take: 5
  });
  console.log('=== SHIFTS ===');
  console.log(JSON.stringify(shifts, null, 2));

  const cashFlows = await prisma.cashFlow.findMany({
    orderBy: { id: 'desc' },
    take: 5
  });
  console.log('=== CASHFLOWS ===');
  console.log(JSON.stringify(cashFlows, null, 2));

  const orders = await prisma.order.findMany({
    orderBy: { id: 'desc' },
    take: 5
  });
  console.log('=== ORDERS ===');
  console.log(JSON.stringify(orders.map(o => ({ id: o.id, orderNumber: o.orderNumber, total: o.total, createdAt: o.createdAt, status: o.status, tenantId: o.tenantId })), null, 2));
}

check().then(() => prisma.$disconnect()).catch(console.error);
