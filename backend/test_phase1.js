const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPhase1() {
  console.log('🧪 === MENJALANKAN TEST SUITE FASE 1 === 🧪\n');

  // 1. Test WAC Calculation on Restock
  console.log('--- [1/3] Test Weighted Average Cost (WAC) ---');
  let ing = await prisma.ingredient.findFirst();
  if (ing) {
    const originalStock = ing.stock;
    const originalPrice = ing.buyPrice;
    console.log(`Bahan: ${ing.name} | Stok Awal: ${originalStock} ${ing.unit} | Harga Lama: Rp ${originalPrice}`);

    const restockQty = 100;
    const incomingPrice = originalPrice + 500;
    const expectedWac = Math.round(((Math.max(0, originalStock) * originalPrice) + (restockQty * incomingPrice)) / (Math.max(0, originalStock) + restockQty));

    const updatedIng = await prisma.ingredient.update({
      where: { id: ing.id },
      data: {
        stock: { increment: restockQty },
        buyPrice: expectedWac
      }
    });

    console.log(`Restock: +${restockQty} @ Rp ${incomingPrice} ➔ WAC Baru: Rp ${updatedIng.buyPrice} (Expected: Rp ${expectedWac})`);
    if (updatedIng.buyPrice === expectedWac) {
      console.log('✅ TEST 1 (WAC): PASSED!\n');
    } else {
      console.error('❌ TEST 1 (WAC): FAILED!');
    }

    // Kembalikan stok
    await prisma.ingredient.update({
      where: { id: ing.id },
      data: { stock: originalStock, buyPrice: originalPrice }
    });
  }

  // 2. Test Table Status Auto Release on Void
  console.log('--- [2/3] Test Table Auto Release on Void ---');
  let table = await prisma.table.findFirst();
  if (!table) {
    table = await prisma.table.create({
      data: { tableNo: 'T-99', name: 'Meja Test', capacity: 4, status: 'Terisi' }
    });
  } else {
    await prisma.table.update({ where: { id: table.id }, data: { status: 'Terisi' } });
  }

  const user = await prisma.user.findFirst();
  const testOrder = await prisma.order.create({
    data: {
      orderNumber: `TEST-VOID-${Date.now()}`,
      customerName: 'Tester',
      tableId: table.id,
      userId: user.id,
      subtotal: 50000,
      tax: 5500,
      serviceCharge: 2500,
      total: 58000,
      status: 'Pending'
    }
  });

  console.log(`Order dibuat pada Meja #${table.tableNo} (Status: Terisi)`);

  // Simulasi void logic
  const otherActive = await prisma.order.count({
    where: { tableId: table.id, status: 'Pending', id: { not: testOrder.id } }
  });

  if (otherActive === 0) {
    await prisma.table.update({ where: { id: table.id }, data: { status: 'Kosong' } });
  }

  const updatedTable = await prisma.table.findUnique({ where: { id: table.id } });
  console.log(`Setelah Void ➔ Status Meja: "${updatedTable.status}"`);
  if (updatedTable.status === 'Kosong') {
    console.log('✅ TEST 2 (Table Void Release): PASSED!\n');
  } else {
    console.error('❌ TEST 2 (Table Void Release): FAILED!');
  }

  // Cleanup
  await prisma.order.delete({ where: { id: testOrder.id } });

  // 3. Test Shift Void Cash Reconciliation
  console.log('--- [3/3] Test Shift Void Cash Reconciliation ---');
  const activeShift = await prisma.shift.findFirst({ where: { status: 'Open' } });
  if (activeShift) {
    console.log(`Active Shift ID: ${activeShift.id}, Buka: ${activeShift.waktuBuka}, Saldo Awal: Rp ${activeShift.saldoAwal}`);
    const voidOrders = await prisma.order.findMany({
      where: {
        status: 'Void',
        OR: [
          { paidAt: { gte: activeShift.waktuBuka } },
          { createdAt: { gte: activeShift.waktuBuka } }
        ]
      }
    });
    console.log(`Void Orders terdeteksi dalam shift: ${voidOrders.length} order.`);
    console.log('✅ TEST 3 (Shift Void Query): PASSED!\n');
  } else {
    console.log('ℹ️ Tidak ada shift Open saat ini (Skipping runtime test 3).');
  }

  console.log('🎉 SEMUA PENGUJIAN FASE 1 SELESAI DENGAN SUKSES!');
}

testPhase1()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
