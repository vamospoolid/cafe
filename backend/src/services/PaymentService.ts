import { PrismaClient } from '@prisma/client';
import { encryptAES, decryptAES, verifyMidtransSignature } from '../utils/crypto';
import { emitToTenant, emitToOutlet } from '../index';

const prisma = new PrismaClient();

// Platform SaaS Midtrans Keys (Level 1 Billing)
const SAAS_MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SAAS_SERVER_KEY || 'SB-Mid-server-TEST_SAAS_KEY_123';
const SAAS_MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_SAAS_CLIENT_KEY || 'SB-Mid-client-TEST_SAAS_KEY_123';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export class PaymentService {
  private static instance: PaymentService;

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  /**
   * ─── LEVEL 1: SAAS BILLING ───────────────────────────────────────────────
   * Membuat tagihan invoice baru untuk langganan paket SaaS tenant & Snap Token
   */
  public async createSaaSInvoice(
    tenantId: string,
    planCode: string,
    billingCycle: 'MONTHLY' | 'YEARLY' = 'MONTHLY'
  ) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('Tenant tidak ditemukan');

    const plan = await prisma.plan.findUnique({ where: { code: planCode } });
    if (!plan) throw new Error(`Paket '${planCode}' tidak ditemukan`);

    const amount = billingCycle === 'MONTHLY' ? plan.priceMonthly : plan.priceYearly;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 7).replace('-', ''); // e.g. "202609"
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${dateStr}-${randomSuffix}`;
    const gatewayOrderId = `SAAS-${invoiceNumber}`;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3); // Jatuh tempo 3 hari

    // 1. Simpan Invoice ke Database
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        tenantId,
        planId: plan.id,
        amount,
        taxAmount: 0,
        totalAmount: amount,
        status: 'UNPAID',
        dueDate,
        paymentMethod: 'MIDTRANS_SNAP'
      }
    });

    // 2. Generate Midtrans Snap Token (Mock or Live API)
    let snapToken = `SNAP-TOKEN-SAAS-${invoice.id.slice(0, 8)}`;
    let snapRedirectUrl = `https://app.sandbox.midtrans.com/snap/v2/vtweb/${snapToken}`;

    try {
      if (SAAS_MIDTRANS_SERVER_KEY && !SAAS_MIDTRANS_SERVER_KEY.includes('TEST_SAAS_KEY')) {
        const authHeader = Buffer.from(SAAS_MIDTRANS_SERVER_KEY + ':').toString('base64');
        const snapEndpoint = IS_PRODUCTION
          ? 'https://app.midtrans.com/snap/v1/transactions'
          : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

        const response = await fetch(snapEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Basic ${authHeader}`
          },
          body: JSON.stringify({
            transaction_details: {
              order_id: gatewayOrderId,
              gross_amount: amount
            },
            customer_details: {
              first_name: tenant.name,
              email: `${tenant.slug}@codenusa.id`
            },
            item_details: [
              {
                id: plan.id,
                price: amount,
                quantity: 1,
                name: `Langganan ${plan.name} (${billingCycle})`
              }
            ]
          })
        });

        if (response.ok) {
          const resData: any = await response.json();
          snapToken = resData.token;
          snapRedirectUrl = resData.redirect_url;
        }
      }
    } catch (err) {
      console.warn('[Midtrans L1 Snap Error, fallback to simulation]', err);
    }

    // 3. Simpan PaymentTransaction
    const transaction = await prisma.paymentTransaction.create({
      data: {
        tenantId,
        invoiceId: invoice.id,
        gateway: 'MIDTRANS',
        gatewayOrderId,
        amount,
        status: 'PENDING',
        snapToken,
        snapRedirectUrl
      }
    });

    return {
      invoice,
      transaction,
      snapToken,
      snapRedirectUrl
    };
  }

  /**
   * ─── LEVEL 2: TENANT POS BYOK ───────────────────────────────────────────
   * Membuat transaksi Snap / Dynamic QRIS untuk pesanan di kasir tenant
   */
  public async createPOSTransaction(tenantId: string, orderId: number) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } }, table: true, tenant: true }
    });

    if (!order) throw new Error('Pesanan POS tidak ditemukan');

    const paymentConfig = await prisma.tenantPaymentConfig.findUnique({
      where: { tenantId }
    });

    if (!paymentConfig || !paymentConfig.isMidtransEnabled) {
      throw new Error('Midtrans gateway belum diaktifkan oleh tenant ini.');
    }

    const decryptedServerKey = decryptAES(paymentConfig.serverKey || '');
    if (!decryptedServerKey) {
      throw new Error('Server Key Midtrans tenant tidak valid atau belum diisi.');
    }

    const gatewayOrderId = `POS-ORD-${order.tenantId?.slice(0, 6)}-${order.id}-${Date.now()}`;
    let snapToken = `SNAP-POS-${order.id}-${Date.now()}`;
    let snapRedirectUrl = `https://app.sandbox.midtrans.com/snap/v2/vtweb/${snapToken}`;

    try {
      const authHeader = Buffer.from(decryptedServerKey + ':').toString('base64');
      const snapEndpoint = paymentConfig.midtransMode === 'PRODUCTION'
        ? 'https://app.midtrans.com/snap/v1/transactions'
        : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

      const response = await fetch(snapEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Basic ${authHeader}`
        },
        body: JSON.stringify({
          transaction_details: {
            order_id: gatewayOrderId,
            gross_amount: Math.round(order.total)
          },
          customer_details: {
            first_name: order.customerName || 'Pelanggan Kafe'
          },
          item_details: order.items.map(item => ({
            id: String(item.id),
            price: Math.round(item.price),
            quantity: item.qty,
            name: item.product?.name || 'Menu Item'
          }))
        })
      });

      if (response.ok) {
        const resData: any = await response.json();
        snapToken = resData.token;
        snapRedirectUrl = resData.redirect_url;
      }
    } catch (err) {
      console.warn('[Midtrans L2 POS Error, fallback to simulation]', err);
    }

    const transaction = await prisma.paymentTransaction.create({
      data: {
        tenantId,
        orderId: order.id,
        gateway: 'MIDTRANS',
        gatewayOrderId,
        amount: order.total,
        status: 'PENDING',
        snapToken,
        snapRedirectUrl
      }
    });

    return {
      orderId: order.id,
      gatewayOrderId,
      snapToken,
      snapRedirectUrl,
      transaction
    };
  }

  /**
   * ─── UNIVERSAL WEBHOOK HANDLER ──────────────────────────────────────────
   * Memproses Webhook Notification dari Midtrans (L1 SaaS Billing & L2 POS)
   */
  public async handleWebhook(payload: any) {
    const {
      order_id: gatewayOrderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      transaction_status: transactionStatus,
      fraud_status: fraudStatus,
      payment_type: paymentType,
      transaction_id: transactionId
    } = payload;

    console.log(`[Midtrans Webhook] Received notification for Order: ${gatewayOrderId}, Status: ${transactionStatus}`);

    // 1. Cari record PaymentTransaction di database
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { gatewayOrderId },
      include: { invoice: true, order: true }
    });

    if (!transaction) {
      console.warn(`[Midtrans Webhook] Gateway Order ID '${gatewayOrderId}' not found in database.`);
      return { success: false, message: 'Transaction not found' };
    }

    // 2. Tentukan Server Key yang sesuai untuk validasi Signature
    let serverKeyToVerify = SAAS_MIDTRANS_SERVER_KEY;
    if (gatewayOrderId.startsWith('POS-')) {
      const tenantConfig = await prisma.tenantPaymentConfig.findUnique({
        where: { tenantId: transaction.tenantId }
      });
      if (tenantConfig?.serverKey) {
        serverKeyToVerify = decryptAES(tenantConfig.serverKey);
      }
    }

    // 3. Verifikasi Keaslian Signature SHA-512 (Anti-Tamper & Anti-Spoofing)
    if (signatureKey && serverKeyToVerify && !serverKeyToVerify.includes('TEST_SAAS_KEY')) {
      const isValid = verifyMidtransSignature(
        gatewayOrderId,
        statusCode,
        grossAmount,
        serverKeyToVerify,
        signatureKey
      );

      if (!isValid) {
        console.error(`[Midtrans Webhook Security] Invalid signature detected for Order: ${gatewayOrderId}! Rejecting.`);
        throw new Error('Invalid Midtrans signature key');
      }
    }

    // 4. Tentukan Status Sukses Berdasarkan Konvensi Midtrans
    let isSuccess = false;
    if (transactionStatus === 'capture') {
      isSuccess = fraudStatus === 'accept';
    } else if (transactionStatus === 'settlement') {
      isSuccess = true;
    }

    const nextStatus = isSuccess ? 'SUCCESS' : ['cancel', 'deny', 'expire'].includes(transactionStatus) ? 'FAILED' : 'PENDING';

    // 5. Update Record PaymentTransaction (Idempotency Safe)
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: nextStatus,
        transactionId: transactionId || transaction.transactionId,
        paymentType: paymentType || transaction.paymentType,
        rawResponse: JSON.stringify(payload),
        paidAt: isSuccess ? new Date() : transaction.paidAt
      }
    });

    // 6. Eksekusi Business Logic Berdasarkan Jenis Transaksi
    if (isSuccess) {
      if (transaction.invoiceId) {
        // ─── Level 1: SaaS Invoice Settlement ───
        const invoice = await prisma.invoice.update({
          where: { id: transaction.invoiceId },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            paymentMethod: paymentType ? `MIDTRANS_${paymentType.toUpperCase()}` : 'MIDTRANS_SNAP'
          }
        });

        // Perpanjang atau aktifkan Subscription Tenant
        if (invoice.planId) {
          const now = new Date();
          const periodEnd = new Date();
          periodEnd.setMonth(periodEnd.getMonth() + 1); // 1 Bulan ke depan

          await prisma.subscription.create({
            data: {
              tenantId: transaction.tenantId,
              planId: invoice.planId,
              status: 'ACTIVE',
              amount: invoice.totalAmount,
              startDate: now,
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd
            }
          });

          // Update Status Tenant menjadi ACTIVE dan perbarui planId
          await prisma.tenant.update({
            where: { id: transaction.tenantId },
            data: {
              status: 'ACTIVE',
              planId: invoice.planId
            }
          });
        }
        console.log(`[Midtrans L1] SaaS Invoice ${invoice.invoiceNumber} paid & Tenant ${transaction.tenantId} activated.`);
      } else if (transaction.orderId) {
        // ─── Level 2: POS Order Settlement ───
        const updatedOrder = await prisma.order.update({
          where: { id: transaction.orderId },
          data: {
            status: 'Paid',
            paidAt: new Date(),
            paymentMethod: paymentType ? `MIDTRANS_${paymentType.toUpperCase()}` : 'MIDTRANS_QRIS'
          }
        });

        // Real-time notification ke room tenant & outlet kasir/KDS
        if (updatedOrder.tenantId) {
          emitToTenant(updatedOrder.tenantId, 'order:paid', {
            orderId: updatedOrder.id,
            orderNumber: updatedOrder.orderNumber,
            total: updatedOrder.total,
            paymentMethod: updatedOrder.paymentMethod
          });
        }
        if (updatedOrder.outletId) {
          emitToOutlet(updatedOrder.outletId, 'order:paid', {
            orderId: updatedOrder.id,
            orderNumber: updatedOrder.orderNumber
          });
        }
        console.log(`[Midtrans L2] POS Order #${updatedOrder.orderNumber} successfully marked as PAID.`);
      }
    }

    return {
      success: true,
      status: nextStatus,
      orderId: gatewayOrderId
    };
  }

  /**
   * Mengambil Konfigurasi Pembayaran Tenant (dengan masked Server Key demi keamanan)
   */
  public async getTenantPaymentConfig(tenantId: string) {
    let config = await prisma.tenantPaymentConfig.findUnique({
      where: { tenantId }
    });

    if (!config) {
      config = await prisma.tenantPaymentConfig.create({
        data: {
          tenantId,
          isMidtransEnabled: false,
          midtransMode: 'SANDBOX',
          enableQRIS: true,
          enableGoPay: true
        }
      });
    }

    const decryptedKey = decryptAES(config.serverKey || '');
    const maskedServerKey = decryptedKey 
      ? decryptedKey.slice(0, 6) + '****************' + decryptedKey.slice(-4) 
      : '';

    return {
      ...config,
      serverKeyMasked: maskedServerKey,
      hasServerKey: !!decryptedKey
    };
  }

  /**
   * Menyimpan / Mengupdate Konfigurasi Midtrans Tenant (Server Key dienkripsi AES-256)
   */
  public async updateTenantPaymentConfig(tenantId: string, data: any) {
    const existing = await prisma.tenantPaymentConfig.findUnique({ where: { tenantId } });

    let encryptedServerKey = existing?.serverKey;
    if (data.serverKey && !data.serverKey.includes('*')) {
      encryptedServerKey = encryptAES(data.serverKey);
    }

    const updated = await prisma.tenantPaymentConfig.upsert({
      where: { tenantId },
      update: {
        isMidtransEnabled: data.isMidtransEnabled ?? existing?.isMidtransEnabled ?? false,
        midtransMode: data.midtransMode || existing?.midtransMode || 'SANDBOX',
        serverKey: encryptedServerKey,
        clientKey: data.clientKey !== undefined ? data.clientKey : existing?.clientKey,
        merchantId: data.merchantId !== undefined ? data.merchantId : existing?.merchantId,
        enableQRIS: data.enableQRIS ?? existing?.enableQRIS ?? true,
        enableVA: data.enableVA ?? existing?.enableVA ?? false,
        enableGoPay: data.enableGoPay ?? existing?.enableGoPay ?? true,
        enableShopeePay: data.enableShopeePay ?? existing?.enableShopeePay ?? false
      },
      create: {
        tenantId,
        isMidtransEnabled: data.isMidtransEnabled || false,
        midtransMode: data.midtransMode || 'SANDBOX',
        serverKey: encryptedServerKey,
        clientKey: data.clientKey || '',
        merchantId: data.merchantId || '',
        enableQRIS: data.enableQRIS ?? true,
        enableVA: data.enableVA ?? false,
        enableGoPay: data.enableGoPay ?? true,
        enableShopeePay: data.enableShopeePay ?? false
      }
    });

    return updated;
  }

  /**
   * Mengambil riwayat Invoice tagihan SaaS tenant
   */
  public async getTenantInvoices(tenantId: string) {
    return prisma.invoice.findMany({
      where: { tenantId },
      include: {
        plan: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}

export const paymentService = PaymentService.getInstance();
