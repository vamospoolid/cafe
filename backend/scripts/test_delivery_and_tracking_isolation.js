/**
 * Test Suite: Delivery, Auto-Payment Midtrans, and Customer Live Tracking Isolation
 */

const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:5000';

function pass(msg) {
  console.log(`  ✅ ${msg}`);
}

function fail(msg) {
  console.error(`  ❌ ${msg}`);
  process.exit(1);
}

async function runTests() {
  console.log('\n🧪 === TEST SUITE: DELIVERY, AUTO-PAYMENT & TRACKING ISOLATION === 🧪\n');

  try {
    // 0. Ambil Tenant dan Product yang valid
    const product = await prisma.product.findFirst({
      where: { deletedAt: null }
    });
    assert(product, 'Harus ada minimal 1 produk di database');
    const tenantId = product.tenantId;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    console.log(`Tenant Context: ${tenant.name} (${tenantId})`);

    // Pastikan TenantPaymentConfig tersedia dalam mode test
    await prisma.tenantPaymentConfig.upsert({
      where: { tenantId },
      update: {
        isMidtransEnabled: true,
        midtransMode: 'SANDBOX',
        serverKey: 'SB-Mid-server-TEST_KEY',
        clientKey: 'SB-Mid-client-mock'
      },
      create: {
        tenantId,
        isMidtransEnabled: true,
        midtransMode: 'SANDBOX',
        serverKey: 'SB-Mid-server-TEST_KEY',
        clientKey: 'SB-Mid-client-mock'
      }
    });

    // Cari User
    let user = await prisma.user.findFirst({ where: { tenantId } });
    if (!user) {
      user = await prisma.user.findFirst();
    }
    assert(user, 'User harus tersedia');

    // ─── TEST 1: Pembuatan Order Kafe Delivery & Tracking Code ──────────────
    console.log('\n👉 [Test 1] Pembuatan Order Kafe Delivery & Tracking Code:');
    const { generateTrackingCode } = require('../dist/src/utils/tracking');
    const cafeTrackingCode = generateTrackingCode('ORD');
    assert(cafeTrackingCode.startsWith('ORD-TK-'), 'Tracking code harus diawali ORD-TK-');
    assert(cafeTrackingCode.length >= 14, 'Tracking code harus memiliki entropi cukup');

    const cafeOrder = await prisma.order.create({
      data: {
        tenantId,
        orderNumber: `ORD-TEST-${Date.now().toString().slice(-5)}`,
        customerName: 'Budi Santoso',
        customerPhone: '081234567890',
        userId: user.id,
        trackingCode: cafeTrackingCode,
        orderType: 'Delivery',
        deliveryStatus: 'PENDING',
        deliveryAddress: 'Jl. Merdeka No. 45, Pagar Coklat',
        deliveryNotes: 'Jangan pencet bel, taruh teras',
        deliveryFee: 10000,
        subtotal: 50000,
        tax: 0,
        serviceCharge: 0,
        total: 60000,
        status: 'Pending',
        items: {
          create: [
            {
              productId: product.id,
              qty: 2,
              price: 25000,
              subtotal: 50000
            }
          ]
        }
      }
    });
    assert(cafeOrder.trackingCode === cafeTrackingCode, 'Order berhasil menyimpan trackingCode');
    assert(cafeOrder.deliveryFee === 10000, 'Ongkir tersimpan benar');
    pass('Order Kafe bertipe Delivery dengan trackingCode tersimpan sempurna.');

    // ─── TEST 2: Endpoint Pelacakan Publik (Zero-IDOR & Masking) ─────────────
    console.log('\n👉 [Test 2] Endpoint Pelacakan Publik /api/tracking/public/:code:');
    const trackRes = await fetch(`${BASE_URL}/api/tracking/public/${cafeTrackingCode}`);
    assert(trackRes.status === 200, 'Endpoint publik harus return HTTP 200');
    const trackData = await trackRes.json();

    assert(trackData.success === true, 'Response status success');
    assert(trackData.vertical === 'CAFE', 'Vertical terdeteksi sebagai CAFE');
    assert(trackData.customerName === 'Budi Santoso', 'Nama customer sesuai');
    assert(trackData.deliveryFee === 10000, 'Ongkir sesuai');
    assert(trackData.items.length === 1, 'Rincian menu tampil');
    assert(!trackData.secretKey && !trackData.serverKey, 'Zero-Leakage: Tidak membocorkan serverKey');
    assert(!trackData.tenantId, 'Zero-Leakage: Tidak membocorkan raw tenantId internal');
    pass('Halaman pelacakan publik tersanitasi aman dari kebocoran data sensitif.');

    // Tes proteksi token salah (Fail-Closed)
    const fakeRes = await fetch(`${BASE_URL}/api/tracking/public/ORD-TK-FAKE1234`);
    assert(fakeRes.status === 404, 'Kode acak palsu harus mengembalikan 404 Not Found');
    pass('Proteksi Fail-Closed aktif: kode pelacakan salah ditolak dengan 404.');

    // ─── TEST 3: Pembuatan Laundry Order Antar-Jemput & Snap Token ───────────
    console.log('\n👉 [Test 3] Laundry Order Antar-Jemput & Midtrans Snap Token:');
    const lndTrackingCode = generateTrackingCode('LND');
    assert(lndTrackingCode.startsWith('LND-TK-'), 'Tracking code harus diawali LND-TK-');

    const laundryOrder = await prisma.laundryOrder.create({
      data: {
        tenantId,
        orderNumber: `LD-TEST-${Date.now().toString().slice(-5)}`,
        customerName: 'Siti Aminah',
        customerPhone: '089876543210',
        trackingCode: lndTrackingCode,
        deliveryType: 'FULL_SERVICE',
        pickupStatus: 'PENDING',
        deliveryStatus: 'PENDING',
        deliveryAddress: 'Komplek Griya Asri Blok C-2',
        deliveryNotes: 'Pintu gerbang putih',
        deliveryFee: 15000,
        perfumeVariant: 'Akasia Manis',
        serviceCategory: 'KILOAN',
        serviceSpeed: 'REGULAR',
        subtotal: 45000,
        totalAmount: 60000, // 45000 + 15000
        paymentStatus: 'UNPAID',
        items: {
          create: [
            {
              serviceName: 'Cuci Komplit Kiloan',
              unitType: 'KG',
              qty: 5.0,
              pricePerUnit: 9000,
              subtotal: 45000
            }
          ]
        }
      }
    });

    // Minta Snap Token publik dari halaman pelacakan
    const chargeRes = await fetch(`${BASE_URL}/api/payments/public/charge-tracking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackingCode: lndTrackingCode })
    });
    assert(chargeRes.status === 200, 'Charge tracking laundry harus return HTTP 200');
    const chargeData = await chargeRes.json();

    assert(chargeData.vertical === 'LAUNDRY', 'Charge mendeteksi LAUNDRY');
    assert(chargeData.snapToken, 'Snap token harus digenerate');
    assert(chargeData.gatewayOrderId.startsWith('LND-ORD-'), 'Gateway order ID berawalan LND-ORD-');

    const createdTxn = await prisma.paymentTransaction.findUnique({
      where: { gatewayOrderId: chargeData.gatewayOrderId }
    });
    assert(createdTxn, 'PaymentTransaction harus tersimpan di database');
    assert(createdTxn.laundryOrderId === laundryOrder.id, 'Relasi ke LaundryOrder terhubung');
    assert(createdTxn.status === 'PENDING', 'Status awal transaksi adalah PENDING');
    pass('Pembuatan Snap Token Midtrans untuk Laundry Order berhasil terverifikasi.');

    // ─── TEST 4: Midtrans Webhook Settlement untuk Laundry ───────────────────
    console.log('\n👉 [Test 4] Simulasi Webhook Midtrans Settlement (Auto-Lunas):');
    const webhookPayload = {
      order_id: chargeData.gatewayOrderId,
      status_code: '200',
      gross_amount: '60000.00',
      transaction_status: 'settlement',
      payment_type: 'qris',
      signature_key: 'mock-signature-sandbox',
      transaction_id: `mid-txn-${Date.now()}`
    };

    const webhookRes = await fetch(`${BASE_URL}/api/payments/midtrans/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    });
    if (!webhookRes.ok) {
      console.error('Webhook error:', await webhookRes.text());
    }
    assert(webhookRes.status === 200, 'Webhook harus return 200 OK');

    const updatedLnd = await prisma.laundryOrder.findUnique({
      where: { id: laundryOrder.id }
    });
    assert(updatedLnd.paymentStatus === 'PAID', 'Status LaundryOrder harus berubah menjadi PAID');
    assert(updatedLnd.paidAmount === 60000, 'paidAmount harus otomatis terupdate 60000');
    assert(updatedLnd.paymentMethod?.includes('QRIS'), 'Metode pembayaran tercatat QRIS');
    pass('Webhook Midtrans settlement berhasil melunasi LaundryOrder secara otomatis.');

    // ─── TEST 5: Transisi Status Pengantaran ─────────────────────────────────
    console.log('\n👉 [Test 5] Transisi Status Pengantaran Kurir (Delivery Status):');
    await prisma.order.update({
      where: { id: cafeOrder.id },
      data: {
        deliveryStatus: 'ON_DELIVERY',
        courierName: 'Mas Dimas (Honda Vario B 1234 CD)',
        courierPhone: '081122334455'
      }
    });

    const verifyOnDelivery = await fetch(`${BASE_URL}/api/tracking/public/${cafeTrackingCode}`);
    const onDeliveryData = await verifyOnDelivery.json();
    assert(onDeliveryData.deliveryStatus === 'ON_DELIVERY', 'Status kurir terupdate ON_DELIVERY');
    assert(onDeliveryData.courierName.includes('Mas Dimas'), 'Nama kurir tampil di tracking publik');
    assert(onDeliveryData.courierPhone === '081122334455', 'Nomor kurir tampil');

    // Selesaikan pengantaran
    await prisma.order.update({
      where: { id: cafeOrder.id },
      data: {
        deliveryStatus: 'DELIVERED',
        deliveredAt: new Date()
      }
    });
    const verifyDelivered = await fetch(`${BASE_URL}/api/tracking/public/${cafeTrackingCode}`);
    const deliveredData = await verifyDelivered.json();
    assert(deliveredData.deliveryStatus === 'DELIVERED', 'Status kurir terupdate DELIVERED');
    assert(deliveredData.deliveredAt, 'Timestamp deliveredAt tercatat');
    pass('Siklus transisi status pengantaran kurir berjalan mulus dan realtime.');

    // ─── TEST 6: Isolasi Vertikal (Zero Domain Leakage) ─────────────────────
    console.log('\n👉 [Test 6] Uji Isolasi Vertikal & Zero Domain Leakage:');
    const cafeCheck = await (await fetch(`${BASE_URL}/api/tracking/public/${cafeTrackingCode}`)).json();
    assert(cafeCheck.perfumeVariant === undefined, 'Data Kafe DILARANG memuat field laundry perfumeVariant');
    assert(cafeCheck.rackLocation === undefined, 'Data Kafe DILARANG memuat field laundry rackLocation');

    const lndCheck = await (await fetch(`${BASE_URL}/api/tracking/public/${lndTrackingCode}`)).json();
    assert(lndCheck.kdsStatus === undefined, 'Data Laundry DILARANG memuat field dapur kdsStatus');
    assert(lndCheck.tableId === undefined, 'Data Laundry DILARANG memuat field meja tableId');
    pass('Zero Domain Leakage TERBUKTI: Kafe dan Laundry 100% terisolasi.');

    console.log('\n🎉 SEMUA 6 PENGUJIAN PENGANTARAN, MIDTRANS & LIVE TRACKING BERHASIL! 100% PASS! 🎉\n');

    // Cleanup data uji
    await prisma.orderItem.deleteMany({ where: { orderId: cafeOrder.id } });
    await prisma.order.delete({ where: { id: cafeOrder.id } });
    await prisma.paymentTransaction.deleteMany({ where: { laundryOrderId: laundryOrder.id } });
    await prisma.laundryOrderItem.deleteMany({ where: { orderId: laundryOrder.id } });
    await prisma.laundryOrder.delete({ where: { id: laundryOrder.id } });

  } catch (err) {
    fail(`Pengujian gagal: ${err.message}\n${err.stack}`);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
