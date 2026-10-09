import prisma from '../db';
import { whatsAppManager } from './WhatsAppManager';
import { whatsAppTemplateService } from './WhatsAppTemplateService';

export class WhatsAppTriggerService {
  private static instance: WhatsAppTriggerService;

  public static getInstance(): WhatsAppTriggerService {
    if (!WhatsAppTriggerService.instance) {
      WhatsAppTriggerService.instance = new WhatsAppTriggerService();
    }
    return WhatsAppTriggerService.instance;
  }

  /**
   * Helper format Rupiah
   */
  private formatRupiah(amount: number): string {
    return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
  }

  /**
   * 1. Trigger Kirim Struk Digital (e-Receipt) saat Transaksi Kasir Lunas
   */
  public async triggerOrderReceipt(orderId: number, tenantId: string): Promise<void> {
    try {
      if (!tenantId || !orderId) return;

      // Cek apakah fitur switch autoSendReceipt aktif untuk tenant ini
      const config = await prisma.tenantWhatsAppConfig.findUnique({
        where: { tenantId }
      });
      if (!config || !config.autoSendReceipt || config.status !== 'CONNECTED') {
        return;
      }

      // Ambil detail order
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: { product: true }
          },
          customer: true,
          tenant: true
        }
      });

      if (!order) return;

      const recipientPhone = order.customerPhone || order.customer?.phone;
      if (!recipientPhone) return;

      // Ambil template RECEIPT milik tenant
      const template = await prisma.whatsAppTemplate.findUnique({
        where: {
          tenantId_triggerKey: {
            tenantId,
            triggerKey: 'RECEIPT'
          }
        }
      });

      if (!template || !template.isActive) return;

      // Format daftar item pesanan
      const itemsList = order.items
        .map((it) => `• ${it.product?.name || 'Item'} x${it.qty} = ${this.formatRupiah(it.subtotal)}`)
        .join('\n');

      const tenantSlug = (order.tenant as any)?.slug;
      const tenantDomain = (order.tenant as any)?.customDomain;
      let appBaseUrl = process.env.PUBLIC_APP_URL || 'https://codenusa.id';
      if (tenantDomain) {
        appBaseUrl = `https://${tenantDomain}`;
      } else if (tenantSlug) {
        appBaseUrl = `https://${tenantSlug}.codenusa.id`;
      }
      const invoiceUrl = `${appBaseUrl}/invoice/order/${order.orderNumber}`;

      // Interpolasi variabel
      const messageBody = whatsAppTemplateService.interpolate(template.templateBody, {
        storeName: order.tenant?.name || 'Toko Kami',
        customerName: order.customerName || order.customer?.name || 'Pelanggan',
        customerPhone: recipientPhone,
        orderNumber: order.orderNumber,
        orderDate: new Date(order.createdAt).toLocaleDateString('id-ID'),
        orderItems: itemsList,
        totalAmount: this.formatRupiah(order.total),
        paymentMethod: order.paymentMethod || 'Tunai',
        invoiceUrl
      });

      // Kirim via queue WhatsAppManager
      await whatsAppManager.sendMessage(tenantId, recipientPhone, messageBody, {
        triggerKey: 'RECEIPT',
        recipientName: order.customerName || order.customer?.name || undefined,
        referenceId: order.orderNumber
      });
    } catch (err: any) {
      console.warn(`[WhatsAppTrigger] Gagal kirim e-Receipt order #${orderId}:`, err.message);
    }
  }

  /**
   * 2. Trigger Konfirmasi Reservasi Meja (Kafe)
   */
  public async triggerReservationConfirmation(reservationId: number, tenantId: string): Promise<void> {
    try {
      if (!tenantId || !reservationId) return;

      const config = await prisma.tenantWhatsAppConfig.findUnique({
        where: { tenantId }
      });
      if (!config || !config.autoSendReminder || config.status !== 'CONNECTED') {
        return;
      }

      const resv = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: {
          table: true,
          tenant: true
        }
      });

      if (!resv || !resv.phone) return;

      const template = await prisma.whatsAppTemplate.findUnique({
        where: {
          tenantId_triggerKey: {
            tenantId,
            triggerKey: 'RESERVATION_CONFIRM'
          }
        }
      });

      if (!template || !template.isActive) return;

      const messageBody = whatsAppTemplateService.interpolate(template.templateBody, {
        storeName: resv.tenant?.name || 'Kafe Kami',
        customerName: resv.customerName,
        customerPhone: resv.phone,
        tableName: resv.table?.name || resv.table?.tableNo || 'Meja Khusus',
        reservationDate: resv.date,
        reservationTime: resv.time,
        pax: resv.guests || 1
      });

      await whatsAppManager.sendMessage(tenantId, resv.phone, messageBody, {
        triggerKey: 'RESERVATION_CONFIRM',
        recipientName: resv.customerName,
        referenceId: `RESV-${reservationId}`
      });
    } catch (err: any) {
      console.warn(`[WhatsAppTrigger] Gagal kirim konfirmasi reservasi #${reservationId}:`, err.message);
    }
  }

  /**
   * 3. Trigger SPK Dibuat (Bengkel)
   */
  public async triggerWorkOrderCreated(workOrderId: string, tenantId: string): Promise<void> {
    try {
      if (!tenantId || !workOrderId) return;

      const config = await prisma.tenantWhatsAppConfig.findUnique({
        where: { tenantId }
      });
      if (!config || !config.autoSendReminder || config.status !== 'CONNECTED') {
        return;
      }

      const wo = await prisma.workOrder.findUnique({
        where: { id: workOrderId },
        include: {
          customer: true,
          tenant: true,
          services: true
        }
      });

      if (!wo || !wo.customer?.phone) return;
      const recipientPhone = wo.customer.phone;

      const template = await prisma.whatsAppTemplate.findUnique({
        where: {
          tenantId_triggerKey: {
            tenantId,
            triggerKey: 'SPK_CREATED'
          }
        }
      });

      if (!template || !template.isActive) return;

      const mechanicNames = Array.from(new Set(wo.services.map(s => s.mechanicName).filter(Boolean))).join(', ') || 'Tim Mekanik';

      const messageBody = whatsAppTemplateService.interpolate(template.templateBody, {
        storeName: wo.tenant?.name || 'Bengkel Kami',
        customerName: wo.customer?.name || 'Pelanggan',
        customerPhone: recipientPhone,
        workOrderNumber: wo.spkNumber,
        vehiclePlate: wo.vehiclePlate || '-',
        vehicleModel: wo.vehicleModel || '-',
        mechanicName: mechanicNames
      });

      await whatsAppManager.sendMessage(tenantId, recipientPhone, messageBody, {
        triggerKey: 'SPK_CREATED',
        recipientName: wo.customer?.name || undefined,
        referenceId: wo.spkNumber
      });
    } catch (err: any) {
      console.warn(`[WhatsAppTrigger] Gagal kirim SPK created #${workOrderId}:`, err.message);
    }
  }

  /**
   * 4. Trigger Unit Bengkel Selesai (Bengkel)
   */
  public async triggerWorkOrderDone(workOrderId: string, tenantId: string): Promise<void> {
    try {
      if (!tenantId || !workOrderId) return;

      const config = await prisma.tenantWhatsAppConfig.findUnique({
        where: { tenantId }
      });
      if (!config || !config.autoSendReminder || config.status !== 'CONNECTED') {
        return;
      }

      const wo = await prisma.workOrder.findUnique({
        where: { id: workOrderId },
        include: {
          customer: true,
          tenant: true
        }
      });

      const recipientPhone = wo?.customer?.phone;
      if (!wo || !recipientPhone) return;

      const template = await prisma.whatsAppTemplate.findUnique({
        where: {
          tenantId_triggerKey: {
            tenantId,
            triggerKey: 'SPK_DONE'
          }
        }
      });

      if (!template || !template.isActive) return;

      const tenantSlug = (wo.tenant as any)?.slug;
      const tenantDomain = (wo.tenant as any)?.customDomain;
      let appBaseUrl = process.env.PUBLIC_APP_URL || 'https://codenusa.id';
      if (tenantDomain) {
        appBaseUrl = `https://${tenantDomain}`;
      } else if (tenantSlug) {
        appBaseUrl = `https://${tenantSlug}.codenusa.id`;
      }
      const invoiceUrl = `${appBaseUrl}/invoice/spk/${wo.spkNumber}`;

      const messageBody = whatsAppTemplateService.interpolate(template.templateBody, {
        storeName: wo.tenant?.name || 'Bengkel Kami',
        customerName: wo.customer?.name || 'Pelanggan',
        customerPhone: recipientPhone,
        workOrderNumber: wo.spkNumber,
        vehiclePlate: wo.vehiclePlate || '-',
        vehicleModel: wo.vehicleModel || '-',
        totalAmount: this.formatRupiah(wo.totalAmount),
        invoiceUrl
      });

      await whatsAppManager.sendMessage(tenantId, recipientPhone, messageBody, {
        triggerKey: 'SPK_DONE',
        recipientName: wo.customer?.name || undefined,
        referenceId: wo.spkNumber
      });
    } catch (err: any) {
      console.warn(`[WhatsAppTrigger] Gagal kirim SPK done #${workOrderId}:`, err.message);
    }
  }
}

export const whatsAppTriggerService = WhatsAppTriggerService.getInstance();
