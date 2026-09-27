const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { STARTER_TEMPLATES } = require('../dist/src/routes/tenantReset');

async function testLaundrySprint1() {
  console.log('=== [TEST] SPRINT 1: LAUNDRY BACKEND DATA HARDENING & MIGRATION PARITY ===\n');

  try {
    // 1. Verifikasi STARTER_TEMPLATES
    console.log('[TEST 1] Verifikasi STARTER_TEMPLATES LAUNDRY_KILOAN_SATUAN...');
    const laundryTpl = STARTER_TEMPLATES.LAUNDRY_KILOAN_SATUAN;
    if (!laundryTpl) {
      throw new Error('Template LAUNDRY_KILOAN_SATUAN tidak ditemukan di STARTER_TEMPLATES!');
    }
    console.log('✅ Template name:', laundryTpl.name);
    console.log('✅ Business type:', laundryTpl.businessType);
    console.log('✅ Kategori count:', laundryTpl.categories.length);
    console.log('✅ Bahan kimia count:', laundryTpl.ingredients.length);
    console.log('✅ Produk/Layanan count:', laundryTpl.products.length);
    console.log('✅ Rak count:', laundryTpl.tables.length);

    // 2. Buat Tenant Uji Coba Laundry
    console.log('\n[TEST 2] Membuat mock tenant bertipe LAUNDRY...');
    const testSlug = `test-laundry-${Date.now()}`;
    const testTenant = await prisma.tenant.create({
      data: {
        name: 'Berkah Laundry Express',
        slug: testSlug,
        businessType: 'LAUNDRY',
        status: 'ACTIVE'
      }
    });
    console.log('✅ Mock tenant created:', testTenant.id, `(${testTenant.name})`);

    // 3. Simulasikan pembuatan order laundry
    console.log('\n[TEST 3] Membuat LaundryOrder dan LaundryOrderItem...');
    const order = await prisma.laundryOrder.create({
      data: {
        tenantId: testTenant.id,
        orderNumber: `LD-${Date.now()}`,
        customerName: 'Budi Santoso',
        customerPhone: '081234567890',
        serviceCategory: 'KILOAN',
        serviceSpeed: 'REGULAR',
        perfumeVariant: 'Sakura',
        rackLocation: 'RAK-A1',
        status: 'RECEIVED',
        totalAmount: 35000,
        paidAmount: 35000,
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        items: {
          create: [
            {
              serviceName: 'Cuci Kering Setrika',
              unitType: 'KG',
              qty: 5.0,
              pricePerUnit: 7000,
              subtotal: 35000
            }
          ]
        }
      },
      include: { items: true }
    });
    console.log('✅ Order created:', order.orderNumber, 'Items:', order.items.length);

    // 4. Verifikasi kueri simetris backup
    console.log('\n[TEST 4] Memverifikasi query backup scoped ke tenant...');
    const [ordersInBackup, itemsInBackup] = await Promise.all([
      prisma.laundryOrder.findMany({ where: { tenantId: testTenant.id } }),
      prisma.laundryOrderItem.findMany({ where: { order: { tenantId: testTenant.id } } })
    ]);
    if (ordersInBackup.length !== 1 || itemsInBackup.length !== 1) {
      throw new Error(`Kueri backup gagal! Orders: ${ordersInBackup.length}, Items: ${itemsInBackup.length}`);
    }
    console.log('✅ Backup query verified: 1 order & 1 item scoped to tenant.');

    // 5. Simulasikan Reset Transaksi Aman
    console.log('\n[TEST 5] Menguji reset transaksi pada tenant laundry...');
    await prisma.$transaction(async (tx) => {
      await tx.laundryOrderItem.deleteMany({ where: { order: { tenantId: testTenant.id } } });
      const delRes = await tx.laundryOrder.deleteMany({ where: { tenantId: testTenant.id } });
      console.log('✅ Deleted laundry orders in reset:', delRes.count);
    });

    const remainingOrders = await prisma.laundryOrder.count({ where: { tenantId: testTenant.id } });
    if (remainingOrders !== 0) {
      throw new Error('Reset transaksi gagal: data laundry masih tersisa!');
    }
    console.log('✅ Reset berhasil! Sisa order laundry:', remainingOrders);

    // 6. Cleanup mock tenant
    console.log('\n[TEST 6] Membersihkan mock tenant...');
    await prisma.tenant.delete({ where: { id: testTenant.id } });
    console.log('✅ Mock tenant cleaned up cleanly.');

    console.log('\n🎉 ALL SPRINT 1 BACKEND TESTS PASSED SUCCESSFULLY! 🎉\n');
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testLaundrySprint1();
