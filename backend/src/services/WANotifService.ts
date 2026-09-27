import prisma from '../db';

interface SPKNotificationPayload {
  tenantId: string;
  customerName: string;
  customerPhone: string;
  spkNumber: string;
  vehiclePlate: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  complaint?: string;
  totalAmount?: number;
}

export class WANotifService {
  /**
   * Normalize Indonesian phone number to international format (e.g. 6281234567890)
   */
  private static normalizePhone(phone: string): string {
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    } else if (clean.startsWith('8')) {
      clean = '62' + clean;
    }
    return clean;
  }

  /**
   * Send WhatsApp message via Fonnte API
   */
  private static async sendFonnteMessage(phone: string, message: string): Promise<boolean> {
    const token = process.env.FONNTE_TOKEN;
    if (!token) {
      console.log(`[WANotifService] FONNTE_TOKEN is not configured. Simulating WA to ${phone}:`);
      console.log(`----------------------------------------\n${message}\n----------------------------------------`);
      return false;
    }

    try {
      const target = this.normalizePhone(phone);
      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target,
          message,
          countryCode: '62'
        })
      });

      const resJson: any = await response.json().catch(() => ({}));
      if (response.ok && resJson.status === true) {
        console.log(`[WANotifService] WA successfully sent to ${target}`);
        return true;
      } else {
        console.warn(`[WANotifService] Fonnte API returned error:`, resJson);
        return false;
      }
    } catch (error) {
      console.error('[WANotifService] Error connecting to Fonnte API:', error);
      return false;
    }
  }

  /**
   * Kirim WA saat SPK baru dibuat & diterima oleh bengkel
   */
  public static async sendSPKReceived(payload: SPKNotificationPayload): Promise<boolean> {
    if (!payload.customerPhone) return false;

    // Get bengkel store name from tenant or settings
    const tenant = await prisma.tenant.findUnique({
      where: { id: payload.tenantId },
      select: { name: true }
    });
    const bengkelName = tenant?.name || 'Bengkel Resmi';

    const vehicleDesc = [payload.vehicleBrand, payload.vehicleModel].filter(Boolean).join(' ');

    const message = `Halo *${payload.customerName}*,\n` +
      `Terima kasih telah mempercayakan kendaraan Anda di *${bengkelName}*.\n\n` +
      `📋 *Tanda Terima SPK Servis*:\n` +
      `• No. SPK: *${payload.spkNumber}*\n` +
      `• No. Plat: *${payload.vehiclePlate}*${vehicleDesc ? ` (${vehicleDesc})` : ''}\n` +
      (payload.complaint ? `• Keluhan: _${payload.complaint}_\n` : '') +
      `• Status: *Sedang Dalam Pengerjaan*\n\n` +
      `Mekanik kami sedang menangani kendaraan Anda dengan standar terbaik. Kami akan mengabari Anda kembali saat servis telah selesai.\n\n` +
      `Salam,\n*${bengkelName}*`;

    return this.sendFonnteMessage(payload.customerPhone, message);
  }

  /**
   * Kirim WA saat servis dinyatakan SELESAI (Status DONE)
   */
  public static async sendSPKDone(payload: SPKNotificationPayload): Promise<boolean> {
    if (!payload.customerPhone) return false;

    const tenant = await prisma.tenant.findUnique({
      where: { id: payload.tenantId },
      select: { name: true }
    });
    const bengkelName = tenant?.name || 'Bengkel Resmi';

    const formattedAmount = (payload.totalAmount || 0).toLocaleString('id-ID');

    const message = `Halo *${payload.customerName}*,\n` +
      `Kabar baik! Kendaraan Anda telah *SELESAI DISERVIS* di *${bengkelName}*. 🎉\n\n` +
      `📋 *Rincian Pengambilan Kendaraan*:\n` +
      `• No. SPK: *${payload.spkNumber}*\n` +
      `• No. Plat: *${payload.vehiclePlate}*\n` +
      `• Total Biaya: *Rp ${formattedAmount}*\n` +
      `• Status: *Siap Diambil*\n\n` +
      `Silakan datang ke bengkel kami untuk pengambilan kendaraan dan penyelesaian administrasi kasir.\n\n` +
      `Terima kasih atas kepercayaan Anda!\n*${bengkelName}*`;

    return this.sendFonnteMessage(payload.customerPhone, message);
  }
  /**
   * Kirim WA saat cucian baru diterima (Drop-off Nota Cuci)
   */
  public static async sendLaundryReceived(payload: {
    tenantId: string;
    customerName: string;
    customerPhone: string;
    orderNumber: string;
    serviceSummary?: string;
    perfumeVariant?: string;
    totalAmount: number;
    paidAmount: number;
    paymentStatus: string;
    estimatedDone?: string;
  }): Promise<boolean> {
    if (!payload.customerPhone) return false;

    const tenant = await prisma.tenant.findUnique({
      where: { id: payload.tenantId },
      select: { name: true }
    });
    const laundryName = tenant?.name || 'Laundry Kami';

    const formattedTotal = (payload.totalAmount || 0).toLocaleString('id-ID');
    const isLunas = payload.paymentStatus === 'PAID' || payload.paidAmount >= payload.totalAmount;
    const paymentLabel = isLunas ? 'LUNAS' : `BELUM LUNAS (Sisa: Rp ${(payload.totalAmount - payload.paidAmount).toLocaleString('id-ID')})`;

    const message = `Halo *${payload.customerName}*,\n` +
      `Terima kasih telah mempercayakan cucian Anda di *${laundryName}*.\n\n` +
      `🧺 *Tanda Terima Nota Cuci*:\n` +
      `• No. Nota: *${payload.orderNumber}*\n` +
      (payload.serviceSummary ? `• Rincian: *${payload.serviceSummary}*\n` : '') +
      (payload.perfumeVariant ? `• Varian Parfum: *${payload.perfumeVariant}*\n` : '') +
      (payload.estimatedDone ? `• Estimasi Selesai: *${payload.estimatedDone}*\n` : '') +
      `• Total Tagihan: *Rp ${formattedTotal}* (${paymentLabel})\n\n` +
      `Pakaian Anda sedang kami proses dengan higienis dan cermat. Kami akan mengabari Anda kembali saat cucian telah selesai.\n\n` +
      `Salam,\n*${laundryName}*`;

    return this.sendFonnteMessage(payload.customerPhone, message);
  }

  /**
   * Kirim WA saat cucian selesai dipacking & masuk rak simpan (Status READY)
   */
  public static async sendLaundryReady(payload: {
    tenantId: string;
    customerName: string;
    customerPhone: string;
    orderNumber: string;
    rackLocation?: string;
    totalAmount: number;
    paidAmount: number;
    paymentStatus: string;
  }): Promise<boolean> {
    if (!payload.customerPhone) return false;

    const tenant = await prisma.tenant.findUnique({
      where: { id: payload.tenantId },
      select: { name: true }
    });
    const laundryName = tenant?.name || 'Laundry Kami';

    const formattedTotal = (payload.totalAmount || 0).toLocaleString('id-ID');
    const remaining = Math.max(0, payload.totalAmount - (payload.paidAmount || 0));
    const isLunas = remaining === 0 || payload.paymentStatus === 'PAID';
    const sisaText = isLunas ? 'Rp 0 (LUNAS)' : `Rp ${remaining.toLocaleString('id-ID')} (Bayar saat ambil)`;

    const message = `Halo *${payload.customerName}*,\n` +
      `Kabar gembira! Cucian Anda telah *SELESAI & RAPI* di *${laundryName}*. 🎉\n\n` +
      `🧺 *Rincian Pengambilan Cucian*:\n` +
      `• No. Nota: *${payload.orderNumber}*\n` +
      (payload.rackLocation ? `• Posisi Rak: *${payload.rackLocation}*\n` : '') +
      `• Total Biaya: *Rp ${formattedTotal}*\n` +
      `• Sisa Tagihan: *${sisaText}*\n` +
      `• Status: *Siap Diambil*\n\n` +
      `Silakan datang ke outlet kami untuk pengambilan pakaian dengan menyebutkan nomor nota ini.\n\n` +
      `Terima kasih!\n*${laundryName}*`;

    return this.sendFonnteMessage(payload.customerPhone, message);
  }
}

export default WANotifService;

