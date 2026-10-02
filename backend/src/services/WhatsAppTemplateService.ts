import prisma from '../db';

export interface TemplateContext {
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
  customerName?: string;
  customerPhone?: string;
  orderNumber?: string;
  orderDate?: string;
  orderItems?: string;
  totalAmount?: string;
  paymentMethod?: string;
  invoiceUrl?: string;
  tableName?: string;
  reservationDate?: string;
  reservationTime?: string;
  pax?: number | string;
  vehiclePlate?: string;
  vehicleModel?: string;
  workOrderNumber?: string;
  mechanicName?: string;
  rackNumber?: string;
  weightKg?: string | number;
  perfume?: string;
  customNote?: string;
  attireSummary?: string;
  pickupDate?: string;
  returnDeadline?: string;
  depositAmount?: string;
  daysLate?: number | string;
  estimatedLateFee?: string;
}

export const DEFAULT_TEMPLATES_BY_VERTICAL: Record<
  string,
  Array<{
    triggerKey: string;
    title: string;
    templateBody: string;
    variables: string[];
  }>
> = {
  CAFE: [
    {
      triggerKey: 'RECEIPT',
      title: 'Struk Kasir Digital (e-Receipt)',
      variables: ['{storeName}', '{customerName}', '{orderNumber}', '{orderItems}', '{totalAmount}', '{paymentMethod}', '{invoiceUrl}'],
      templateBody:
        `Halo Kak *{customerName}*, terima kasih telah berkunjung ke *{storeName}*! ☕\n\n` +
        `Berikut adalah rincian pesanan Anda:\n` +
        `No. Nota: *#{orderNumber}*\n` +
        `Metode: {paymentMethod}\n\n` +
        `Pesanan:\n{orderItems}\n\n` +
        `*Total Bayar: {totalAmount}*\n\n` +
        `Lihat struk digital lengkap:\n{invoiceUrl}\n\n` +
        `Semoga harimu menyenangkan! Ditunggu kedatangannya kembali ya Kak! 😊`
    },
    {
      triggerKey: 'RESERVATION_CONFIRM',
      title: 'Konfirmasi Reservasi Meja',
      variables: ['{storeName}', '{customerName}', '{tableName}', '{reservationDate}', '{reservationTime}', '{pax}'],
      templateBody:
        `Halo Kak *{customerName}*,\n` +
        `Reservasi meja Anda di *{storeName}* telah kami konfirmasi! 📅\n\n` +
        `Rincian Reservasi:\n` +
        `• Meja: *{tableName}*\n` +
        `• Tanggal: *{reservationDate}*\n` +
        `• Waktu: *{reservationTime}*\n` +
        `• Jumlah Tamu: *{pax} Orang*\n\n` +
        `Mohon hadir 10 menit sebelum jadwal. Jika ada perubahan, silakan balas pesan ini. Sampai jumpa!`
    },
    {
      triggerKey: 'LOYALTY_POINT',
      title: 'Poin Loyalitas Member',
      variables: ['{storeName}', '{customerName}', '{totalAmount}', '{customNote}'],
      templateBody:
        `Halo Kak *{customerName}*! 🎉\n` +
        `Selamat, Anda mendapatkan poin baru dari pembelanjaan di *{storeName}*.\n\n` +
        `{customNote}\n\n` +
        `Tukarkan poin Anda dengan promo & menu favorit pada kunjungan berikutnya!`
    }
  ],
  BENGKEL: [
    {
      triggerKey: 'SPK_CREATED',
      title: 'Penerimaan Servis / SPK Masuk',
      variables: ['{storeName}', '{customerName}', '{workOrderNumber}', '{vehiclePlate}', '{vehicleModel}', '{mechanicName}'],
      templateBody:
        `Halo Bpk/Ibu *{customerName}*,\n` +
        `Kendaraan Anda telah kami terima untuk servis di *{storeName}*. 🔧\n\n` +
        `No. SPK: *#{workOrderNumber}*\n` +
        `Unit: *{vehicleModel}* ({vehiclePlate})\n` +
        `Mekanik: *{mechanicName}*\n\n` +
        `Tim mekanik kami sedang melakukan inspeksi awal. Kami akan mengabari estimasi biaya dan pengerjaan selanjutnya. Terima kasih!`
    },
    {
      triggerKey: 'SPK_DONE',
      title: 'Unit Selesai & Siap Diambil',
      variables: ['{storeName}', '{customerName}', '{vehiclePlate}', '{vehicleModel}', '{totalAmount}', '{invoiceUrl}'],
      templateBody:
        `Kabar baik Bpk/Ibu *{customerName}*! 🛵🚗\n` +
        `Pengerjaan servis kendaraan Anda (*{vehicleModel}* - {vehiclePlate}) di *{storeName}* telah *SELESAI* dan siap diambil.\n\n` +
        `Total Biaya: *{totalAmount}*\n` +
        `Rincian Invoice & Garansi:\n{invoiceUrl}\n\n` +
        `Silakan ambil kendaraan pada jam operasional kami. Terima kasih atas kepercayaannya!`
    },
    {
      triggerKey: 'OIL_REMINDER',
      title: 'Pengingat Ganti Oli Berkala',
      variables: ['{storeName}', '{customerName}', '{vehiclePlate}', '{vehicleModel}'],
      templateBody:
        `Halo Bpk/Ibu *{customerName}*,\n` +
        `Waktunya servis berkala untuk *{vehicleModel}* ({vehiclePlate}) Anda di *{storeName}*! 🛠️\n\n` +
        `Jaga performa mesin tetap prima dan hemat BBM dengan ganti oli tepat waktu. Dapatkan gratis cek 10 titik kendaraan hari ini. Ditunggu kedatangannya!`
    }
  ],
  RETAIL: [
    {
      triggerKey: 'RECEIPT',
      title: 'Nota Belanja Digital',
      variables: ['{storeName}', '{customerName}', '{orderNumber}', '{orderItems}', '{totalAmount}', '{invoiceUrl}'],
      templateBody:
        `Halo Bpk/Ibu *{customerName}*,\n` +
        `Terima kasih telah berbelanja di *{storeName}*. 🛒\n\n` +
        `No. Transaksi: *#{orderNumber}*\n` +
        `Items:\n{orderItems}\n\n` +
        `*Total: {totalAmount}*\n\n` +
        `Cek nota digital: {invoiceUrl}\n` +
        `Terima kasih dan selamat berbelanja kembali!`
    },
    {
      triggerKey: 'AR_DUE',
      title: 'Pengingat Jatuh Tempo Piutang / Bon',
      variables: ['{storeName}', '{customerName}', '{orderNumber}', '{totalAmount}', '{customNote}'],
      templateBody:
        `Halo Bpk/Ibu *{customerName}*,\n` +
        `Mengingatkan tagihan belanja Anda di *{storeName}* untuk nota *#{orderNumber}* sebesar *{totalAmount}*.\n\n` +
        `Catatan: {customNote}\n\n` +
        `Mohon konfirmasi pembayaran jika telah ditransfer. Terima kasih atas kerja samanya.`
    }
  ],
  LAUNDRY: [
    {
      triggerKey: 'LAUNDRY_RECEIVED',
      title: 'Nota Cucian Masuk (Drop-off)',
      variables: ['{storeName}', '{customerName}', '{orderNumber}', '{weightKg}', '{perfume}', '{totalAmount}'],
      templateBody:
        `Halo Kak *{customerName}*,\n` +
        `Cucian Anda telah diterima di *{storeName}*! 🧺\n\n` +
        `No. Nota: *#{orderNumber}*\n` +
        `Berat/Jumlah: *{weightKg}*\n` +
        `Parfum: *{perfume}*\n` +
        `Total: *{totalAmount}*\n\n` +
        `Kami akan mengabari via WhatsApp segera setelah cucian selesai, wangi, dan rapi!`
    },
    {
      triggerKey: 'LAUNDRY_READY',
      title: 'Cucian Selesai (Siap Ambil)',
      variables: ['{storeName}', '{customerName}', '{orderNumber}', '{rackNumber}', '{totalAmount}'],
      templateBody:
        `Kabar gembira Kak *{customerName}*! ✨🧺\n` +
        `Cucian Anda (Nota *#{orderNumber}*) di *{storeName}* sudah *SELESAI* & wangi.\n\n` +
        `Lokasi Simpan: *Rak {rackNumber}*\n` +
        `Total: *{totalAmount}*\n\n` +
        `Bisa diambil hari ini di outlet kami ya. Terima kasih banyak!`
    }
  ],
  RENTAL: [
    {
      triggerKey: 'RENTAL_BOOKING',
      title: 'Konfirmasi Booking & Sewa Busana',
      variables: ['{storeName}', '{customerName}', '{orderNumber}', '{attireSummary}', '{pickupDate}', '{returnDeadline}', '{totalAmount}', '{depositAmount}', '{invoiceUrl}'],
      templateBody:
        `Halo Kak *{customerName}*,\n` +
        `Terima kasih telah mempercayakan busana adat Anda di *{storeName}*! ✨\n\n` +
        `📋 *Rincian Booking Busana*:\n` +
        `• No. Kontrak: *#{orderNumber}*\n` +
        `• Busana: *{attireSummary}*\n` +
        `• Jadwal Ambil / Fitting: *{pickupDate}*\n` +
        `• Batas Pengembalian: *{returnDeadline}*\n` +
        `• Total Biaya: *{totalAmount}*\n` +
        `• Jaminan/Deposit: *{depositAmount}*\n\n` +
        `Nota & Ketentuan Sewa Digital:\n{invoiceUrl}\n\n` +
        `Silakan bawa identitas jaminan asli (KTP/SIM) saat pengambilan. Sampai jumpa!`
    },
    {
      triggerKey: 'RENTAL_PICKUP_READY',
      title: 'Busana Siap Diambil / Fitting',
      variables: ['{storeName}', '{customerName}', '{orderNumber}', '{attireSummary}', '{pickupDate}', '{storeAddress}'],
      templateBody:
        `Halo Kak *{customerName}*,\n` +
        `Kabar baik dari *{storeName}*! 👘✨\n` +
        `Set busana sewa pesanan Anda (*#{orderNumber}* - {attireSummary}) sudah *SIAP DIAMBIL* atau fitting akhir.\n\n` +
        `Jadwal Ambil: *{pickupDate}*\n` +
        `📍 Alamat Butik: {storeAddress}\n\n` +
        `Mohon bawa identitas jaminan asli (KTP/SIM) dan sisa pelunasan saat pengambilan. Ditunggu kedatangannya Kak! 🙏`
    },
    {
      triggerKey: 'RENTAL_DUE_REMINDER',
      title: 'Pengingat Batas Pengembalian (H-1 & Hari-H)',
      variables: ['{storeName}', '{customerName}', '{orderNumber}', '{attireSummary}', '{returnDeadline}', '{storeAddress}'],
      templateBody:
        `Halo Kak *{customerName}*,\n` +
        `Semoga acara bahagianya berjalan lancar dan berkesan! ✨\n\n` +
        `Kami dari *{storeName}* menginfokan pengingat jadwal pengembalian busana adat:\n` +
        `• No. Kontrak: *#{orderNumber}*\n` +
        `• Busana: *{attireSummary}*\n` +
        `• Batas Waktu: *{returnDeadline}*\n\n` +
        `⚠️ *Catatan Penting Pengembalian*:\n` +
        `1. Pastikan seluruh kelengkapan aksesoris (saloko/mahkota, bando, keris, gelang, selempang, dll) telah lengkap di dalam tas busana.\n` +
        `2. Pakaian *TIDAK PERLU DICUCI* oleh penyewa (sudah termasuk perawatan cuci profesional dari butik kami).\n` +
        `3. Pengembalian tepat waktu membebaskan Anda dari denda harian dan uang jaminan (*deposit*) dapat langsung direfund penuh.\n\n` +
        `📍 Lokasi Butik: {storeAddress}\n` +
        `Terima kasih atas kerja samanya! 🙏`
    },
    {
      triggerKey: 'RENTAL_OVERDUE_ALERT',
      title: 'Peringatan Keterlambatan Pengembalian (Overdue)',
      variables: ['{storeName}', '{customerName}', '{orderNumber}', '{attireSummary}', '{returnDeadline}', '{daysLate}', '{estimatedLateFee}'],
      templateBody:
        `🚨 *PEMBERITAHUAN KETERLAMBATAN PENGEMBALIAN BUSANA*\n\n` +
        `Kepada Yth. Kak *{customerName}*,\n` +
        `Sistem kami mencatat bahwa busana sewa Anda di *{storeName}* telah *MELEWATI BATAS WAKTU PENGEMBALIAN*:\n\n` +
        `• No. Kontrak: *#{orderNumber}*\n` +
        `• Busana: *{attireSummary}*\n` +
        `• Jadwal Kembali: *{returnDeadline}*\n` +
        `• Keterlambatan: *{daysLate} Hari*\n` +
        `• Akumulasi Denda: *{estimatedLateFee}*\n\n` +
        `Mohon kerjasamanya untuk segera mengembalikan busana dan aksesoris hari ini agar tidak terjadi penambahan denda harian serta tidak mengganggu jadwal sewa pelanggan lain berikutnya.\n\n` +
        `Silakan konfirmasi waktu kedatangan Anda dengan membalas pesan ini. Terima kasih! 🙏`
    },
    {
      triggerKey: 'RENTAL_RETURNED_QC',
      title: 'Tanda Terima Pengembalian & Refund Jaminan',
      variables: ['{storeName}', '{customerName}', '{orderNumber}', '{attireSummary}', '{depositAmount}', '{customNote}'],
      templateBody:
        `Halo Kak *{customerName}*,\n` +
        `Terima kasih! Busana sewa (*#{orderNumber}* - {attireSummary}) telah kami terima kembali di *{storeName}* dalam kondisi baik. ✅\n\n` +
        `Rincian Pengembalian:\n` +
        `• Uang Jaminan / Deposit Direfund: *{depositAmount}*\n` +
        `• Catatan: {customNote}\n\n` +
        `Senang dapat menjadi bagian dari hari istimewa Anda. Sampai jumpa di acara keluarga berikutnya! 🌸`
    }
  ]
};

export class WhatsAppTemplateService {
  private static instance: WhatsAppTemplateService;

  public static getInstance(): WhatsAppTemplateService {
    if (!WhatsAppTemplateService.instance) {
      WhatsAppTemplateService.instance = new WhatsAppTemplateService();
    }
    return WhatsAppTemplateService.instance;
  }

  /**
   * Mengambil semua template tenant. Jika belum ada, otomatis inisialisasi default sesuai vertikal toko.
   */
  public async getTemplatesForTenant(tenantId: string, vertical = 'CAFE') {
    let templates = await prisma.whatsAppTemplate.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' }
    });

    if (templates.length === 0) {
      await this.seedDefaultTemplates(tenantId, vertical);
      templates = await prisma.whatsAppTemplate.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'asc' }
      });
    }

    return templates;
  }

  /**
   * Seed template default untuk tenant baru atau saat perpindahan vertikal
   */
  public async seedDefaultTemplates(tenantId: string, vertical = 'CAFE') {
    const targetVertical = vertical.toUpperCase();
    const defaults = DEFAULT_TEMPLATES_BY_VERTICAL[targetVertical] || DEFAULT_TEMPLATES_BY_VERTICAL['CAFE'];

    for (const t of defaults) {
      await prisma.whatsAppTemplate.upsert({
        where: {
          tenantId_triggerKey: {
            tenantId,
            triggerKey: t.triggerKey
          }
        },
        update: {
          title: t.title,
          vertical: targetVertical
        },
        create: {
          tenantId,
          triggerKey: t.triggerKey,
          title: t.title,
          templateBody: t.templateBody,
          vertical: targetVertical,
          isActive: true
        }
      });
    }
  }

  /**
   * Reset template tenant ke default bawaan vertikal
   */
  public async resetTemplatesToDefault(tenantId: string, vertical = 'CAFE') {
    const targetVertical = vertical.toUpperCase();
    const defaults = DEFAULT_TEMPLATES_BY_VERTICAL[targetVertical] || DEFAULT_TEMPLATES_BY_VERTICAL['CAFE'];

    for (const t of defaults) {
      await prisma.whatsAppTemplate.upsert({
        where: {
          tenantId_triggerKey: {
            tenantId,
            triggerKey: t.triggerKey
          }
        },
        update: {
          templateBody: t.templateBody,
          isActive: true,
          title: t.title,
          vertical: targetVertical
        },
        create: {
          tenantId,
          triggerKey: t.triggerKey,
          title: t.title,
          templateBody: t.templateBody,
          vertical: targetVertical,
          isActive: true
        }
      });
    }
  }

  /**
   * Interpolasi string template dengan nilai nyata
   */
  public interpolate(template: string, ctx: TemplateContext): string {
    let result = template;
    const map: Record<string, string> = {
      '{storeName}': ctx.storeName || 'Toko Kami',
      '{storePhone}': ctx.storePhone || '',
      '{storeAddress}': ctx.storeAddress || '',
      '{customerName}': ctx.customerName || 'Pelanggan',
      '{customerPhone}': ctx.customerPhone || '',
      '{orderNumber}': ctx.orderNumber || '-',
      '{orderDate}': ctx.orderDate || new Date().toLocaleDateString('id-ID'),
      '{orderItems}': ctx.orderItems || '-',
      '{totalAmount}': ctx.totalAmount || 'Rp 0',
      '{paymentMethod}': ctx.paymentMethod || 'Tunai',
      '{invoiceUrl}': ctx.invoiceUrl || '',
      '{tableName}': ctx.tableName || '-',
      '{reservationDate}': ctx.reservationDate || '',
      '{reservationTime}': ctx.reservationTime || '',
      '{pax}': String(ctx.pax || '1'),
      '{vehiclePlate}': ctx.vehiclePlate || '-',
      '{vehicleModel}': ctx.vehicleModel || '-',
      '{workOrderNumber}': ctx.workOrderNumber || '-',
      '{mechanicName}': ctx.mechanicName || 'Mekanik',
      '{rackNumber}': ctx.rackNumber || '-',
      '{weightKg}': String(ctx.weightKg || '-'),
      '{perfume}': ctx.perfume || 'Reguler',
      '{customNote}': ctx.customNote || '',
      '{attireSummary}': ctx.attireSummary || 'Set Busana Adat',
      '{pickupDate}': ctx.pickupDate || '-',
      '{returnDeadline}': ctx.returnDeadline || '-',
      '{depositAmount}': ctx.depositAmount || 'Rp 0',
      '{daysLate}': String(ctx.daysLate || '0'),
      '{estimatedLateFee}': ctx.estimatedLateFee || 'Rp 0'
    };

    for (const [key, value] of Object.entries(map)) {
      result = result.split(key).join(value);
    }

    return result;
  }
}

export const whatsAppTemplateService = WhatsAppTemplateService.getInstance();
