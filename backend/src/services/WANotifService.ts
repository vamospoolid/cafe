import prisma from '../db';
import { whatsAppManager } from './WhatsAppManager';
import { whatsAppTemplateService } from './WhatsAppTemplateService';

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
   * Mengirim pesan dengan memprioritaskan Gateway Baileys mandiri tenant, lalu fallback ke Fonnte
   */
  private static async sendTenantOrFonnte(
    tenantId: string,
    phone: string,
    message: string,
    triggerKey: string,
    referenceId?: string
  ): Promise<boolean> {
    try {
      // 1. Cek sesi Baileys tenant mandiri
      const waStatus = await whatsAppManager.getTenantStatus(tenantId);
      if (waStatus.status === 'CONNECTED') {
        const result = await whatsAppManager.sendMessage(tenantId, phone, message, {
          triggerKey,
          referenceId
        });
        if (result.success) {
          console.log(`[WANotifService] Berhasil kirim pesan via Baileys tenant (${tenantId}) ke ${phone}`);
          return true;
        }
      }
    } catch (e: any) {
      console.warn(`[WANotifService] Baileys tenant send error, mencoba fallback:`, e.message);
    }

    // 2. Fallback ke Fonnte jika Baileys belum terhubung
    return this.sendFonnteMessage(phone, message);
  }

  /**
   * Send WhatsApp message via Fonnte API (Fallback)
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

    return this.sendTenantOrFonnte(
      payload.tenantId,
      payload.customerPhone,
      message,
      'SPK_CREATED',
      payload.spkNumber
    );
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

    return this.sendTenantOrFonnte(
      payload.tenantId,
      payload.customerPhone,
      message,
      'SPK_DONE',
      payload.spkNumber
    );
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

    return this.sendTenantOrFonnte(
      payload.tenantId,
      payload.customerPhone,
      message,
      'LAUNDRY_RECEIVED',
      payload.orderNumber
    );
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

    return this.sendTenantOrFonnte(
      payload.tenantId,
      payload.customerPhone,
      message,
      'LAUNDRY_READY',
      payload.orderNumber
    );
  }

  /**
   * Kirim pesan WhatsApp kustom (misal: Rental Busana, dsb)
   */
  public static async sendCustomNotification(payload: {
    tenantId: string;
    customerPhone?: string;
    phone?: string;
    message: string;
    triggerKey?: string;
    referenceId?: string;
  }): Promise<boolean> {
    const targetPhone = payload.customerPhone || payload.phone;
    if (!targetPhone) return false;
    return this.sendTenantOrFonnte(
      payload.tenantId,
      targetPhone,
      payload.message,
      payload.triggerKey || 'CUSTOM_NOTIF',
      payload.referenceId
    );
  }

  /**
   * Kirim WhatsApp Pengingat Jatuh Tempo Pengembalian Busana (H-1 / Hari-H)
   */
  public static async sendRentalDueReminder(payload: {
    tenantId: string;
    customerName: string;
    customerPhone: string;
    orderNumber: string;
    attireSummary: string;
    returnDeadline: Date | string;
    storeName?: string;
    storeAddress?: string;
    isToday?: boolean;
  }): Promise<boolean> {
    if (!payload.customerPhone) return false;

    const tenant = await prisma.tenant.findUnique({
      where: { id: payload.tenantId },
      select: { name: true }
    });
    const storeName = payload.storeName || tenant?.name || 'Butik Sewa Busana';

    const deadlineStr = new Date(payload.returnDeadline).toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const timingLabel = payload.isToday ? 'HARI INI' : 'BESOK';

    // 1. Cek apakah ada custom template dari tenant
    let message = '';
    const template = await prisma.whatsAppTemplate.findUnique({
      where: {
        tenantId_triggerKey: {
          tenantId: payload.tenantId,
          triggerKey: 'RENTAL_DUE_REMINDER'
        }
      }
    });

    if (template && template.isActive) {
      message = whatsAppTemplateService.interpolate(template.templateBody, {
        storeName,
        storeAddress: payload.storeAddress,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        orderNumber: payload.orderNumber,
        attireSummary: payload.attireSummary,
        returnDeadline: `${deadlineStr} (${timingLabel})`
      });
    } else {
      message = `Halo Kak *${payload.customerName}*,\n` +
        `Semoga acara bahagianya berjalan lancar dan berkesan! ✨\n\n` +
        `Kami dari *${storeName}* ingin menginfokan bahwa masa sewa busana adat Anda dijadwalkan berakhir *${timingLabel}*:\n\n` +
        `📋 *Rincian Sewa Busana*:\n` +
        `• No. Kontrak: *#${payload.orderNumber}*\n` +
        `• Busana: *${payload.attireSummary}*\n` +
        `• Batas Pengembalian: *${deadlineStr}*\n\n` +
        `⚠️ *Catatan Penting Pengembalian*:\n` +
        `1. Pastikan seluruh kelengkapan aksesoris (saloko/mahkota, bando, keris, gelang, selempang, dll) telah lengkap di dalam tas busana.\n` +
        `2. Pakaian *TIDAK PERLU DICUCI* oleh penyewa (sudah termasuk perawatan cuci profesional dari butik kami).\n` +
        `3. Pengembalian tepat waktu akan membebaskan Anda dari denda keterlambatan harian dan uang jaminan (*deposit*) dapat langsung direfund penuh.\n\n` +
        (payload.storeAddress ? `📍 *Alamat Butik*: ${payload.storeAddress}\n\n` : '') +
        `Jika ada kendala terkait pengembalian, silakan balas pesan WhatsApp ini.\n` +
        `Terima kasih! 🙏\n*${storeName}*`;
    }

    return this.sendTenantOrFonnte(
      payload.tenantId,
      payload.customerPhone,
      message,
      'RENTAL_DUE_REMINDER',
      payload.orderNumber
    );
  }

  /**
   * Kirim WhatsApp Peringatan Keterlambatan Busana (Overdue Alert & Denda Berjalan)
   */
  public static async sendRentalOverdueAlert(payload: {
    tenantId: string;
    customerName: string;
    customerPhone: string;
    orderNumber: string;
    attireSummary: string;
    returnDeadline: Date | string;
    daysLate: number;
    estimatedLateFee?: number;
    storeName?: string;
  }): Promise<boolean> {
    if (!payload.customerPhone) return false;

    const tenant = await prisma.tenant.findUnique({
      where: { id: payload.tenantId },
      select: { name: true }
    });
    const storeName = payload.storeName || tenant?.name || 'Butik Sewa Busana';

    const deadlineStr = new Date(payload.returnDeadline).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const lateDays = Math.max(1, payload.daysLate || 1);
    const dendaStr = payload.estimatedLateFee && payload.estimatedLateFee > 0
      ? `Rp ${payload.estimatedLateFee.toLocaleString('id-ID')}`
      : `Rp ${(lateDays * 50000).toLocaleString('id-ID')} (estimasi)`;

    let message = '';
    const template = await prisma.whatsAppTemplate.findUnique({
      where: {
        tenantId_triggerKey: {
          tenantId: payload.tenantId,
          triggerKey: 'RENTAL_OVERDUE_ALERT'
        }
      }
    });

    if (template && template.isActive) {
      message = whatsAppTemplateService.interpolate(template.templateBody, {
        storeName,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        orderNumber: payload.orderNumber,
        attireSummary: payload.attireSummary,
        returnDeadline: deadlineStr,
        daysLate: lateDays,
        estimatedLateFee: dendaStr
      });
    } else {
      message = `🚨 *PEMBERITAHUAN KETERLAMBATAN PENGEMBALIAN BUSANA*\n\n` +
        `Kepada Yth. Kak *${payload.customerName}*,\n` +
        `Sistem kami mencatat bahwa busana sewa Anda di *${storeName}* telah *MELEWATI BATAS WAKTU PENGEMBALIAN*:\n\n` +
        `• No. Kontrak: *#${payload.orderNumber}*\n` +
        `• Busana: *${payload.attireSummary}*\n` +
        `• Jadwal Kembali: *${deadlineStr}*\n` +
        `• Keterlambatan: *${lateDays} Hari*\n` +
        `• Akumulasi Denda: *${dendaStr}*\n\n` +
        `Mohon kerjasamanya untuk segera mengembalikan busana dan aksesoris hari ini agar tidak terjadi penambahan denda harian serta tidak mengganggu jadwal sewa pelanggan lain berikutnya.\n\n` +
        `Silakan konfirmasi waktu kedatangan Anda dengan membalas pesan ini.\n\n` +
        `Hormat kami,\n*${storeName}*`;
    }

    return this.sendTenantOrFonnte(
      payload.tenantId,
      payload.customerPhone,
      message,
      'RENTAL_OVERDUE_ALERT',
      payload.orderNumber
    );
  }

  /**
   * Kirim WA Pengingat Ganti Oli & Servis Berkala (Bengkel Vertical)
   */
  public static async sendOilReminder(payload: {
    tenantId: string;
    customerName: string;
    customerPhone: string;
    vehiclePlate: string;
    vehicleBrand?: string;
    vehicleModel?: string;
    lastServiceDate: string;
    intervalMonths?: number;
    customMessage?: string;
  }): Promise<{ success: boolean; message: string }> {
    if (!payload.customerPhone) {
      return { success: false, message: 'Nomor WhatsApp tidak tersedia' };
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: payload.tenantId },
      select: { name: true }
    });
    const bengkelName = tenant?.name || 'Bengkel Kami';
    const vehicleDesc = [payload.vehicleBrand, payload.vehicleModel].filter(Boolean).join(' ');
    const intervalMonths = payload.intervalMonths || 2;

    const formattedLastDate = new Date(payload.lastServiceDate).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const defaultMessage = `Halo Kak *${payload.customerName}*, salam dari *${bengkelName}*! 🙏\n\n` +
      `Kami ingin menginfokan bahwa kendaraan Anda dengan Plat Nomor *${payload.vehiclePlate}*${vehicleDesc ? ` (${vehicleDesc})` : ''} sudah waktunya untuk *Ganti Oli & Servis Berkala* nih. 🛵💨\n\n` +
      `📋 *Catatan Servis Sebelumnya*:\n` +
      `• Servis Terakhir: *${formattedLastDate}*\n` +
      `• Rekomendasi Siklus: Rutin setiap *${intervalMonths} Bulan*\n\n` +
      `Ganti oli tepat waktu menjaga performa mesin tetap prima, tarikan enteng, dan konsumsi bensin lebih hemat.\n\n` +
      `Yuk mampir ke *${bengkelName}* untuk servis dan ganti oli berkualitas! Kakak bisa balas pesan ini untuk reservasi antrean ya. Terima kasih! 🙏`;

    const finalMessage = payload.customMessage || defaultMessage;

    const sent = await this.sendTenantOrFonnte(
      payload.tenantId,
      payload.customerPhone,
      finalMessage,
      'BENGKEL_OIL_REMINDER',
      payload.vehiclePlate
    );

    return {
      success: sent,
      message: finalMessage
    };
  }
}

export default WANotifService;


