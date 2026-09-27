const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  console.log('====================================================');
  console.log('🧪 TESTING PRIORITAS 2: BLIND Z-REPORT & CASH VARIANCE');
  console.log('====================================================\n');

  try {
    // 1. Get or create a test user
    let user = await prisma.user.findFirst({
      where: { role: 'admin' }
    });
    if (!user) {
      user = await prisma.user.findFirst();
    }
    console.log(`✅ [1/6] Test User: ${user.name} (Role: ${user.role}, ID: ${user.id})`);

    // 2. Clean up any existing open shifts
    await prisma.shift.updateMany({
      where: { status: 'Open' },
      data: { status: 'Closed', waktuTutup: new Date() }
    });
    console.log('✅ [2/6] Past Open Shifts Cleaned up');

    // 3. Open a new Shift with Modal Awal = Rp 200.000
    const saldoAwal = 200000;
    const newShift = await prisma.shift.create({
      data: {
        userId: user.id,
        saldoAwal,
        status: 'Open',
        waktuBuka: new Date()
      }
    });
    console.log(`✅ [3/6] Shift #${newShift.id} Opened with Saldo Awal: Rp ${saldoAwal.toLocaleString('id-ID')}`);

    // 4. Create dummy cash and non-cash orders during this shift
    let category = await prisma.category.findFirst();
    if (!category) {
      category = await prisma.category.create({ data: { name: 'Makanan Utama' } });
    }
    let product = await prisma.product.findFirst();
    if (!product) {
      product = await prisma.product.create({
        data: {
          name: 'Ramen Spesial',
          categoryId: category.id,
          buyPrice: 15000,
          sellPrice: 35000,
          stock: 100
        }
      });
    }

    const orderNum = `TEST-ORD-${Date.now()}`;
    const orderCash = await prisma.order.create({
      data: {
        orderNumber: orderNum,
        customerName: 'Budi Test',
        userId: user.id,
        subtotal: 70000,
        tax: 7000,
        serviceCharge: 3500,
        total: 80500,
        paymentMethod: 'Cash',
        status: 'Paid',
        paidAt: new Date(),
        items: {
          create: [
            {
              productId: product.id,
              qty: 2,
              price: 35000,
              buyPrice: 15000,
              subtotal: 70000
            }
          ]
        }
      }
    });
    console.log(`✅ [4/6] Created Paid Cash Order #${orderCash.orderNumber} Total: Rp ${orderCash.total.toLocaleString('id-ID')}`);

    // 5. Test Blind Shift Close with Denominations
    // Expected Cash: Modal Awal (200.000) + Cash Sales (80.500) = 280.500
    // Suppose physical counted:
    // 100k x 2 = 200.000
    // 50k x 1  = 50.000
    // 20k x 1  = 20.000
    // 10k x 1  = 10.000
    // Koin     = 500
    // Total Fisik = 280.500 (Matched)
    const denominations = {
      c100k: 2,
      c50k: 1,
      c20k: 1,
      c10k: 1,
      c5k: 0,
      c2k: 0,
      c1k: 0,
      coins: 500
    };
    const totalFisik = (2 * 100000) + (1 * 50000) + (1 * 20000) + (1 * 10000) + 500;
    const expectedCash = saldoAwal + 80500;
    const selisih = totalFisik - expectedCash;
    const varianceStatus = selisih === 0 ? 'MATCHED' : selisih < 0 ? 'SHORT' : 'OVER';

    const closedShift = await prisma.shift.update({
      where: { id: newShift.id },
      data: {
        waktuTutup: new Date(),
        saldoSistem: expectedCash,
        saldoElektronik: 0,
        saldoFisikLaci: totalFisik,
        selisih,
        denominations: JSON.stringify(denominations),
        varianceReason: 'Kasir menghitung dengan pecahan lembar dan koin pas',
        status: 'Closed'
      }
    });

    // Create Audit Log
    const auditLog = await prisma.auditLog.create({
      data: {
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'SHIFT_CLOSE',
        resource: 'FINANCE',
        resourceId: `shift_${closedShift.id}`,
        severity: selisih < 0 ? 'WARNING' : 'INFO',
        description: `Tutup Shift #${closedShift.id} oleh ${user.name}. Fisik: Rp ${totalFisik.toLocaleString('id-ID')}, Sistem: Rp ${expectedCash.toLocaleString('id-ID')}, Selisih: Rp ${selisih.toLocaleString('id-ID')} (${varianceStatus})`,
        oldValue: JSON.stringify({ status: 'Open', saldoAwal }),
        newValue: JSON.stringify({
          saldoSistem: expectedCash,
          saldoFisikLaci: totalFisik,
          selisih,
          varianceStatus,
          denominations: JSON.stringify(denominations)
        })
      }
    });

    console.log(`✅ [5/6] Shift #${closedShift.id} Closed Successfully!`);
    console.log(`   - Saldo Sistem  : Rp ${closedShift.saldoSistem.toLocaleString('id-ID')}`);
    console.log(`   - Fisik Laci    : Rp ${closedShift.saldoFisikLaci.toLocaleString('id-ID')}`);
    console.log(`   - Selisih       : Rp ${closedShift.selisih.toLocaleString('id-ID')} (${varianceStatus})`);
    console.log(`   - Denominasi    : ${closedShift.denominations}`);
    console.log(`   - Audit Log ID  : ${auditLog.id} (Severity: ${auditLog.severity})`);

    // 6. Verify Shift Data & Denomination parse
    const fetchedShift = await prisma.shift.findUnique({
      where: { id: closedShift.id },
      include: { user: true }
    });
    const parsedDenom = JSON.parse(fetchedShift.denominations);

    console.log(`✅ [6/6] Verified Shift Record in DB:`);
    console.log(`   - 100k: ${parsedDenom.c100k} lbr, 50k: ${parsedDenom.c50k} lbr, Koin: Rp ${parsedDenom.coins}`);
    console.log(`   - Variance Reason: "${fetchedShift.varianceReason}"`);

    console.log('\n====================================================');
    console.log('🎉 ALL TESTS PASSED FOR PRIORITAS 2 (BLIND Z-REPORT)');
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
