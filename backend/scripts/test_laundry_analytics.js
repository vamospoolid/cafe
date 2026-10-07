require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

async function check() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'laundry1' } });
  if (!tenant) return;
  const user = await prisma.user.findFirst({ where: { tenantId: tenant.id } });
  if (!user) return;

  const expenseCount = await prisma.cashFlow.count({ where: { tenantId: tenant.id, type: 'Pengeluaran' } });
  if (expenseCount === 0) {
    await prisma.cashFlow.createMany({
      data: [
        {
          tenantId: tenant.id,
          userId: user.id,
          type: 'Pengeluaran',
          category: 'Bahan Kimia & Sabun',
          amount: 35000,
          description: 'Beli Deterjen Cair Konsentrat 5 Liter',
          date: new Date()
        },
        {
          tenantId: tenant.id,
          userId: user.id,
          type: 'Pengeluaran',
          category: 'Operasional Listrik, Air & Gas',
          amount: 22000,
          description: 'Isi Ulang Gas LPG 3Kg untuk Dryer Pengering',
          date: new Date()
        },
        {
          tenantId: tenant.id,
          userId: user.id,
          type: 'Pengeluaran',
          category: 'Kemasan & Plastik',
          amount: 15000,
          description: 'Plastik Jinjing Kiloan & Klip Hanger',
          date: new Date()
        }
      ]
    });
    console.log('✅ Created 3 sample petty cash expenses');
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, tenantId: tenant.id },
    process.env.JWT_SECRET || 'codepos_jwt_secret_key_super_secure',
    { expiresIn: '1h' }
  );

  const res = await fetch('http://localhost:5000/api/laundry/reports/analytics?period=month', {
    headers: {
      Authorization: 'Bearer ' + token,
      'x-tenant-id': tenant.id
    }
  });

  const data = await res.json();
  console.log('Analytics Response HTTP Status:', res.status);
  console.log('Summary (P&L):');
  console.log('  Omzet Bersih:', data.summary?.totalRevenue);
  console.log('  Beban Opex Kas Kecil:', data.summary?.totalExpense);
  console.log('  Laba Bersih Operasional:', data.summary?.netOperatingProfit);
  console.log('  Net Margin:', data.summary?.netProfitMargin + '%');
  console.log('Expense Breakdown:', data.expenses?.categories);
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
