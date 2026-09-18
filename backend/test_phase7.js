const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { PaymentService } = require('./dist/src/services/PaymentService');
const { encryptAES, decryptAES, verifyMidtransSignature } = require('./dist/src/utils/crypto');

const paymentService = PaymentService.getInstance();

async function runPhase7Tests() {
  console.log('🧪 === MENJALANKAN TEST SUITE FASE 7: SUBSCRIPTION, INVOICING & MIDTRANS GATEWAY === 🧪\n');

  try {
    // -------------------------------------------------------------
    // TEST 1: AES-256 Encryption & Decryption Integrity
    // -------------------------------------------------------------
    console.log('--- [1/5] Testing AES-256 Key Encryption & Decryption ---');
    const sampleServerKey = 'SB-Mid-server-REAL_MERCHANT_KEY_998877';
    const encrypted = encryptAES(sampleServerKey);
    const decrypted = decryptAES(encrypted);

    console.log(`Original Key: ${sampleServerKey}`);
    console.log(`Encrypted:    ${encrypted}`);
    console.log(`Decrypted:    ${decrypted}`);

    if (decrypted !== sampleServerKey) {
      throw new Error('AES-256 decryption failed to match original key!');
    }
    console.log('✅ TEST 1 (AES-256 Encryption/Decryption): PASSED!\n');

    // -------------------------------------------------------------
    // TEST 2: SHA-512 Midtrans Webhook Signature Verification
    // -------------------------------------------------------------
    console.log('--- [2/5] Testing SHA-512 Signature Verification ---');
    const crypto = require('crypto');
    const orderId = 'SAAS-INV-202609-1234';
    const statusCode = '200';
    const grossAmount = '199000.00';
    const serverKey = 'SB-Mid-server-SAMPLE_KEY';
    const validSignature = crypto.createHash('sha512').update(`${orderId}${statusCode}${grossAmount}${serverKey}`).digest('hex');

    const isValid = verifyMidtransSignature(orderId, statusCode, grossAmount, serverKey, validSignature);
    const isFakeValid = verifyMidtransSignature(orderId, statusCode, grossAmount, serverKey, 'fake_invalid_signature_hex');

    if (!isValid || isFakeValid) {
      throw new Error('SHA-512 signature validation logic failed!');
    }
    console.log('✅ TEST 2 (SHA-512 Webhook Signature Anti-Tamper): PASSED!\n');

    // -------------------------------------------------------------
    // TEST 3: Level 1 SaaS Billing (Invoice & Snap Creation)
    // -------------------------------------------------------------
    console.log('--- [3/5] Testing Level 1: SaaS Invoice & Snap Creation ---');
    const tenant = await prisma.tenant.findUnique({ where: { slug: 'mukiramen' } });
    if (!tenant) throw new Error('Tenant mukiramen not found');

    const invoiceResult = await paymentService.createSaaSInvoice(tenant.id, 'GROWTH', 'MONTHLY');
    console.log(`Created Invoice Number: ${invoiceResult.invoice.invoiceNumber}`);
    console.log(`Invoice Amount: Rp ${invoiceResult.invoice.totalAmount}`);
    console.log(`Snap Token: ${invoiceResult.snapToken}`);

    if (!invoiceResult.invoice || invoiceResult.invoice.status !== 'UNPAID') {
      throw new Error('Invoice not properly created or status is not UNPAID');
    }
    console.log('✅ TEST 3 (L1 SaaS Invoice & Snap Creation): PASSED!\n');

    // -------------------------------------------------------------
    // TEST 4: Level 1 SaaS Webhook Settlement & Subscription Activation
    // -------------------------------------------------------------
    console.log('--- [4/5] Testing L1 SaaS Webhook Settlement & Activation ---');
    const webhookPayload = {
      order_id: invoiceResult.transaction.gatewayOrderId,
      status_code: '200',
      gross_amount: invoiceResult.invoice.totalAmount,
      transaction_status: 'settlement',
      payment_type: 'qris',
      transaction_id: `midtrans-txn-${Date.now()}`
    };

    const webhookResult = await paymentService.handleWebhook(webhookPayload);
    console.log('Webhook Result:', webhookResult);

    const updatedInvoice = await prisma.invoice.findUnique({ where: { id: invoiceResult.invoice.id } });
    const latestSubscription = await prisma.subscription.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Invoice Status after Webhook: ${updatedInvoice.status}`);
    console.log(`Subscription Active Period End: ${latestSubscription?.currentPeriodEnd}`);

    if (updatedInvoice.status !== 'PAID') {
      throw new Error('Invoice status should be PAID after settlement webhook!');
    }
    if (!latestSubscription || latestSubscription.status !== 'ACTIVE') {
      throw new Error('Subscription was not created / activated!');
    }
    console.log('✅ TEST 4 (L1 SaaS Webhook Settlement & Auto-Renewal): PASSED!\n');

    // -------------------------------------------------------------
    // TEST 5: Level 2 Tenant POS BYOK & Order Webhook
    // -------------------------------------------------------------
    console.log('--- [5/5] Testing Level 2: Tenant POS BYOK Config & Charge ---');
    // Save tenant's custom Midtrans Server Key
    await paymentService.updateTenantPaymentConfig(tenant.id, {
      isMidtransEnabled: true,
      midtransMode: 'SANDBOX',
      serverKey: 'SB-Mid-server-TENANT_BYOK_KEY_12345',
      clientKey: 'SB-Mid-client-TENANT_BYOK_KEY_12345',
      enableQRIS: true
    });

    const tenantConfig = await paymentService.getTenantPaymentConfig(tenant.id);
    console.log(`Tenant Midtrans Enabled: ${tenantConfig.isMidtransEnabled}`);
    console.log(`Masked Server Key: ${tenantConfig.serverKeyMasked}`);

    if (!tenantConfig.isMidtransEnabled || !tenantConfig.hasServerKey) {
      throw new Error('Tenant payment config not saved properly!');
    }

    // Create a dummy order for POS transaction test
    const testOrder = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        orderNumber: `ORD-TEST-${Date.now()}`,
        customerName: 'Budi Santoso',
        userId: 1,
        subtotal: 50000,
        tax: 5000,
        serviceCharge: 0,
        total: 55000,
        status: 'Pending'
      }
    });

    const posTxn = await paymentService.createPOSTransaction(tenant.id, testOrder.id);
    console.log(`Created POS Gateway Order ID: ${posTxn.gatewayOrderId}`);

    // Trigger POS Settlement Webhook
    await paymentService.handleWebhook({
      order_id: posTxn.gatewayOrderId,
      status_code: '200',
      gross_amount: 55000,
      transaction_status: 'settlement',
      payment_type: 'gopay'
    });

    const paidOrder = await prisma.order.findUnique({ where: { id: testOrder.id } });
    console.log(`POS Order Status after Payment Webhook: ${paidOrder.status} (Method: ${paidOrder.paymentMethod})`);

    if (paidOrder.status !== 'Paid') {
      throw new Error('POS Order status should be Paid after payment webhook!');
    }
    console.log('✅ TEST 5 (Level 2 Tenant POS BYOK & Dynamic QRIS Webhook): PASSED!\n');

    console.log('🎉 SEMUA PENGUJIAN FASE 7 BERHASIL DENGAN SEMPURNA! LEVEL 1 & 2 MIDTRANS GATEWAY READY! 🎉');
  } catch (err) {
    console.error('❌ PENGUJIAN FASE 7 GAGAL:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase7Tests();
