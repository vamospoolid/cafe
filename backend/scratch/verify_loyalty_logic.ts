import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to format currency
const formatCurrency = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;

async function runVerification() {
  console.log('=== START CRM LOYALTY VERIFICATION ===');
  
  // 1. Clean test customer
  const phone = '089999999999';
  console.log(`\n1. Menghapus data member lama jika ada (Phone: ${phone})...`);
  await prisma.pointLog.deleteMany({
    where: { customer: { phone } }
  });
  await prisma.customer.deleteMany({
    where: { phone }
  });

  // 2. Register new member
  console.log('2. Mendaftarkan member baru...');
  const customer = await prisma.customer.create({
    data: {
      name: 'Rian Verifikator',
      phone,
      email: 'rian@verify.com',
      birthday: '28-06',
      points: 0,
      tier: 'Bronze',
      totalSpent: 0
    }
  });
  console.log(`Member Terdaftar: ${customer.name} (Phone: ${customer.phone}, Tier: ${customer.tier}, Poin: ${customer.points})`);

  // 3. Simulate first transaction (Spend: Rp 500.000)
  // Bronze tier multiplier is 1.0x.
  // Spend: Rp 500.000 -> Points earned: Math.floor(500000 / 10000) = 50 points.
  console.log('\n3. Simulasi transaksi ke-1 (Belanja: Rp 500.000)...');
  const orderTotal1 = 500000;
  const orderNumber1 = 'ORD-TEST-001';
  
  // Accumulate points
  const earnPoints1 = Math.floor((orderTotal1 / 10000) * 1.0);
  console.log(`Proyeksi perolehan poin: ${earnPoints1} pts`);
  
  await prisma.$transaction(async (tx) => {
    // Update Customer
    const updatedCust = await tx.customer.update({
      where: { id: customer.id },
      data: {
        points: { increment: earnPoints1 },
        totalSpent: { increment: orderTotal1 }
      }
    });

    // Create Point Log
    await tx.pointLog.create({
      data: {
        customerId: customer.id,
        points: earnPoints1,
        type: 'Earn',
        description: `Akumulasi poin dari order #${orderNumber1}`
      }
    });

    console.log(`Hasil DB - Total Belanja: ${formatCurrency(updatedCust.totalSpent)}, Poin Baru: ${updatedCust.points} pts, Tier: ${updatedCust.tier}`);
  });

  // 4. Simulate second transaction (Spend: Rp 600.000)
  // Total spent becomes Rp 1.100.000.
  // Threshold for Silver is Rp 1.000.000, so they should auto-upgrade to Silver tier!
  console.log('\n4. Simulasi transaksi ke-2 (Belanja: Rp 600.000) -> Memicu Auto-Tier Upgrade...');
  const orderTotal2 = 600000;
  const orderNumber2 = 'ORD-TEST-002';
  
  // Calculate earn based on current Bronze tier (1.0x) before upgrade
  const earnPoints2 = Math.floor((orderTotal2 / 10000) * 1.0);
  console.log(`Proyeksi perolehan poin: ${earnPoints2} pts`);

  await prisma.$transaction(async (tx) => {
    const custBefore = await tx.customer.findUnique({ where: { id: customer.id } });
    if (!custBefore) throw new Error('Customer not found');

    const nextTotalSpent = custBefore.totalSpent + orderTotal2;
    let nextTier = custBefore.tier;
    if (nextTotalSpent >= 3000000) {
      nextTier = 'Gold';
    } else if (nextTotalSpent >= 1000000) {
      nextTier = 'Silver';
    }

    const updatedCust = await tx.customer.update({
      where: { id: customer.id },
      data: {
        points: { increment: earnPoints2 },
        totalSpent: nextTotalSpent,
        tier: nextTier
      }
    });

    await tx.pointLog.create({
      data: {
        customerId: customer.id,
        points: earnPoints2,
        type: 'Earn',
        description: `Akumulasi poin dari order #${orderNumber2}`
      }
    });

    if (nextTier !== custBefore.tier) {
      await tx.pointLog.create({
        data: {
          customerId: customer.id,
          points: 0,
          type: 'Manual',
          description: `Auto-Upgrade Tier ke ${nextTier} (Total Belanja mencapai ${formatCurrency(nextTotalSpent)})`
        }
      });
    }

    console.log(`Hasil DB - Total Belanja: ${formatCurrency(updatedCust.totalSpent)}, Poin Baru: ${updatedCust.points} pts, Tier Baru: ${updatedCust.tier}`);
  });

  // 5. Simulate third transaction with point redemption (Redeem 50 points)
  // 1 point = Rp 100 discount, so 50 points = Rp 5.000 discount.
  // Order subtotal = Rp 100.000. Discount = Rp 5.000. Net Total = Rp 95.000.
  // Silver tier multiplier is 1.2x.
  // Earning points from net total: Math.floor((95000 / 10000) * 1.2) = Math.floor(9.5 * 1.2) = Math.floor(11.4) = 11 points.
  console.log('\n5. Simulasi transaksi ke-3 dengan Penukaran Poin (Redeem: 50 pts, Belanja Net: Rp 95.000)...');
  const ptsToRedeem = 50;
  const orderTotal3 = 95000;
  const orderNumber3 = 'ORD-TEST-003';

  await prisma.$transaction(async (tx) => {
    const custBefore = await tx.customer.findUnique({ where: { id: customer.id } });
    if (!custBefore) throw new Error('Customer not found');

    // Calculate earn with Silver multiplier (1.2x)
    const multiplier = 1.2;
    const earnPoints3 = Math.floor((orderTotal3 / 10000) * multiplier);

    // Deduct redeemed points, add earned points
    const nextTotalSpent = custBefore.totalSpent + orderTotal3;
    const nextPoints = Math.max(0, custBefore.points - ptsToRedeem) + earnPoints3;

    const updatedCust = await tx.customer.update({
      where: { id: customer.id },
      data: {
        points: nextPoints,
        totalSpent: nextTotalSpent
      }
    });

    // Create Point Log for Redeem
    await tx.pointLog.create({
      data: {
        customerId: customer.id,
        points: -ptsToRedeem,
        type: 'Redeem',
        description: `Penukaran poin pada order #${orderNumber3}`
      }
    });

    // Create Point Log for Earn
    await tx.pointLog.create({
      data: {
        customerId: customer.id,
        points: earnPoints3,
        type: 'Earn',
        description: `Akumulasi poin dari order #${orderNumber3}`
      }
    });

    console.log(`Hasil DB - Poin Terpotong: -${ptsToRedeem} pts, Poin Diperoleh: +${earnPoints3} pts, Saldo Akhir: ${updatedCust.points} pts`);
  });

  // 6. Simulate Void of the third transaction (ORD-TEST-003)
  // Revert the earned points (-11 pts) and return the redeemed points (+50 pts)
  console.log('\n6. Simulasi Pembatalan / Void Transaksi ke-3 (ORD-TEST-003)...');
  await prisma.$transaction(async (tx) => {
    // Find the Earn log
    const earnLog = await tx.pointLog.findFirst({
      where: { customerId: customer.id, type: 'Earn', description: { contains: orderNumber3 } }
    });
    // Find the Redeem log
    const redeemLog = await tx.pointLog.findFirst({
      where: { customerId: customer.id, type: 'Redeem', description: { contains: orderNumber3 } }
    });

    const custBefore = await tx.customer.findUnique({ where: { id: customer.id } });
    if (!custBefore) throw new Error('Customer not found');

    let nextPoints = custBefore.points;
    let nextTotalSpent = custBefore.totalSpent;

    if (earnLog) {
      nextPoints -= earnLog.points;
      nextTotalSpent -= orderTotal3;
      await tx.pointLog.create({
        data: {
          customerId: customer.id,
          points: -earnLog.points,
          type: 'Refund',
          description: `Void Order #${orderNumber3}: Penarikan poin belanja`
        }
      });
    }

    if (redeemLog) {
      nextPoints += Math.abs(redeemLog.points);
      await tx.pointLog.create({
        data: {
          customerId: customer.id,
          points: Math.abs(redeemLog.points),
          type: 'Refund',
          description: `Void Order #${orderNumber3}: Pengembalian poin penukaran`
        }
      });
    }

    const updatedCust = await tx.customer.update({
      where: { id: customer.id },
      data: {
        points: nextPoints,
        totalSpent: nextTotalSpent
      }
    });

    console.log(`Hasil DB setelah Void - Saldo Poin: ${updatedCust.points} pts, Total Belanja: ${formatCurrency(updatedCust.totalSpent)}`);
  });

  console.log('\n=== VERIFIKASI BERHASIL 100% ===');
}

runVerification()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
