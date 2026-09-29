/**
 * Helper untuk format teks struk digital WhatsApp & deep-link
 */

export interface ReceiptOrderData {
  orderNumber: string;
  createdAt?: string;
  paidAt?: string;
  customerName?: string;
  customerPhone?: string;
  table?: { tableNo?: string } | null;
  tableId?: number | null;
  cashierName?: string;
  user?: { name?: string; username?: string } | null;
  items: Array<{
    name?: string;
    product?: { name: string };
    qty: number;
    price: number;
    notes?: string;
  }>;
  subtotal: number;
  discount?: number;
  voucherCode?: string;
  voucherDiscount?: number;
  tax?: number;
  serviceCharge?: number;
  total: number;
  paymentMethod?: string;
  isPaid?: boolean;
}

export interface ReceiptSettings {
  storeName?: string;
  address?: string;
  phone?: string;
  receiptFooter?: string;
  wifiName?: string;
  wifiPassword?: string;
}

/**
 * Normalisasi nomor HP ke format internasional WhatsApp (628xxx)
 */
export const formatWhatsAppNumber = (phone: string): string => {
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (clean.startsWith('8')) {
    clean = '62' + clean;
  }
  return clean;
};

/**
 * Format angka ke mata uang Rupiah
 */
const fmtRp = (val: number | undefined | null) => `Rp ${(Number(val) || 0).toLocaleString('id-ID')}`;

/**
 * Buat template teks nota WhatsApp yang rapi dan elegan
 */
export const generateWhatsAppReceiptText = (
  order: ReceiptOrderData,
  settings?: ReceiptSettings
): string => {
  const storeName = settings?.storeName || 'KAFE & RESTORAN';
  const address = settings?.address || '';
  const phone = settings?.phone || '';
  const dateStr = order.paidAt || order.createdAt || new Date().toISOString();
  const formattedDate = new Date(dateStr).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const cashier = order.cashierName || order.user?.name || order.user?.username || 'Kasir';
  const tableName = order.table?.tableNo ? `Meja ${order.table.tableNo}` : 'Take Away / Bungkus';
  const custName = order.customerName || 'Pelanggan Terhormat';

  let text = `🧾 *STRUK PEMBELIAN - ${storeName.toUpperCase()}*\n`;
  if (address) text += `📍 ${address}\n`;
  if (phone) text += `📞 Telp: ${phone}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `*No. Nota* : #${order.orderNumber}\n`;
  text += `*Waktu*    : ${formattedDate}\n`;
  text += `*Kasir*    : ${cashier}\n`;
  text += `*Tipe*     : ${tableName}\n`;
  text += `*Pelanggan*: ${custName}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `*DETAIL PESANAN:*\n`;

  order.items.forEach((item, idx) => {
    const itemName = item.name || item.product?.name || `Item ${idx + 1}`;
    const itemTotal = item.qty * item.price;
    text += `• *${itemName}*\n`;
    text += `  ${item.qty}x @ ${fmtRp(item.price)} = ${fmtRp(itemTotal)}\n`;
    if (item.notes) {
      text += `  _(Catatan: ${item.notes})_\n`;
    }
  });

  text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  text += `*Subtotal*       : ${fmtRp(order.subtotal)}\n`;
  if (order.voucherDiscount && order.voucherDiscount > 0) {
    text += `*Voucher (${order.voucherCode || 'Promo'})* : -${fmtRp(order.voucherDiscount)}\n`;
  }
  const remainingDiscount = (order.discount || 0) - (order.voucherDiscount || 0);
  if (remainingDiscount > 0) {
    text += `*Diskon / Potongan* : -${fmtRp(remainingDiscount)}\n`;
  } else if (!order.voucherDiscount && order.discount && order.discount > 0) {
    text += `*Diskon/Promo*   : -${fmtRp(order.discount)}\n`;
  }
  if (order.tax && order.tax > 0) {
    text += `*PB1 / Pajak*    : ${fmtRp(order.tax)}\n`;
  }
  if (order.serviceCharge && order.serviceCharge > 0) {
    text += `*Service Charge* : ${fmtRp(order.serviceCharge)}\n`;
  }
  text += `*TOTAL AKHIR*    : *${fmtRp(order.total)}*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `*Pembayaran*     : ${order.paymentMethod || 'Tunai'} (${order.isPaid ? 'LUNAS ✅' : 'BELUM LUNAS'})\n\n`;

  if (settings?.wifiName || settings?.wifiPassword) {
    text += `📶 *Info Wi-Fi Kafe:*\n`;
    if (settings.wifiName) text += `SSID: *${settings.wifiName}*\n`;
    if (settings.wifiPassword) text += `Pass: *${settings.wifiPassword}*\n\n`;
  }

  const footer = settings?.receiptFooter || 'Terima kasih atas kunjungan Anda! Silakan datang kembali 🙏';
  text += `_${footer}_\n`;

  return text;
};

/**
 * Buat tautan deep-link WhatsApp Web / App
 */
export const generateWhatsAppReceiptUrl = (
  phone: string,
  order: ReceiptOrderData,
  settings?: ReceiptSettings
): string => {
  const cleanPhone = formatWhatsAppNumber(phone);
  const text = generateWhatsAppReceiptText(order, settings);
  const encodedText = encodeURIComponent(text);

  if (cleanPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
};
