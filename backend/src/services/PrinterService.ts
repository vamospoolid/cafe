import * as net from 'net';

// ─── ESC/POS Commands untuk 80mm & 58mm printer ──────────────────────────────
const ESC = 0x1b;
const GS  = 0x1d;

const CMD = {
  INIT:         Buffer.from([ESC, 0x40]),
  ALIGN_LEFT:   Buffer.from([ESC, 0x61, 0x00]),
  ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]),
  ALIGN_RIGHT:  Buffer.from([ESC, 0x61, 0x02]),
  BOLD_ON:      Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF:     Buffer.from([ESC, 0x45, 0x00]),
  DOUBLE_ON:    Buffer.from([GS,  0x21, 0x11]), // double width + height
  DOUBLE_OFF:   Buffer.from([GS,  0x21, 0x00]),
  CUT:          Buffer.from([GS,  0x56, 0x41, 0x05]),
  LF:           Buffer.from([0x0a]),
  LINE_CHAR:    '─'.repeat(47) + '\n',
  LINE_DASH:    '-'.repeat(47) + '\n',
  LINE_DOUBLE:  '='.repeat(47) + '\n',
};

const str = (text: string) => Buffer.from(text + '\n', 'utf-8');
const pad = (left: string, right: string, width = 47): string => {
  const space = width - left.length - right.length;
  return left + ' '.repeat(Math.max(1, space)) + right + '\n';
};
const fmt = (n: number) => `Rp ${(n || 0).toLocaleString('id-ID')}`;

// ─── Kirim buffer ke printer via TCP/IP ───────────────────────────────────
const sendToNetwork = (host: string, port: number, data: Buffer): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!host) return reject(new Error('Host IP printer tidak valid'));
    const client = new net.Socket();
    client.setTimeout(5000);
    client.connect(port || 9100, host, () => {
      client.write(data, () => {
        client.destroy();
        resolve();
      });
    });
    client.on('timeout', () => { client.destroy(); reject(new Error(`Printer timeout ke ${host}:${port}`)); });
    client.on('error', (err) => { client.destroy(); reject(err); });
  });
};

// ─── Format Struk Kasir / Customer Bill ─────────────────────────────────────
export const buildReceipt = (order: any, settings: any): Buffer => {
  const parts: Buffer[] = [];
  const push = (...bufs: Buffer[]) => parts.push(...bufs);

  push(CMD.INIT, CMD.ALIGN_CENTER);

  // Header toko
  if (settings?.storeName) {
    push(CMD.BOLD_ON, CMD.DOUBLE_ON);
    push(str(settings.storeName));
    push(CMD.DOUBLE_OFF, CMD.BOLD_OFF);
  }
  if (settings?.address)       push(str(settings.address));
  if (settings?.phone)         push(str(`Tel: ${settings.phone}`));
  if (settings?.receiptHeader) push(CMD.LF, str(settings.receiptHeader));

  push(CMD.ALIGN_LEFT);
  push(str(CMD.LINE_CHAR));
  push(str(pad('No. Order:', order.orderNumber || `#${order.id}`)));
  push(str(pad('Kasir:', order.user?.name || order.user?.username || '-')));
  if (order.table?.tableNo) {
    push(CMD.BOLD_ON);
    push(str(pad('MEJA:', `${order.table.tableNo} (${order.orderType || 'Dine In'})`)));
    push(CMD.BOLD_OFF);
  } else {
    push(str(pad('Tipe:', order.orderType || 'Take Away')));
  }
  push(str(pad('Waktu:', new Date(order.paidAt || order.createdAt).toLocaleString('id-ID'))));
  push(str(CMD.LINE_CHAR));

  // Items
  for (const item of order.items || []) {
    push(str(`${item.product?.name || item.qty + 'x Item'}`));
    push(str(pad(`  ${item.qty}x ${fmt(item.price)}`, fmt(item.subtotal))));
    if (item.notes) push(str(`  * Note: ${item.notes}`));
  }

  push(str(CMD.LINE_CHAR));
  push(str(pad('Subtotal', fmt(order.subtotal))));
  if (order.discount > 0) push(str(pad('Diskon', `-${fmt(order.discount)}`)));
  if (order.tax > 0)      push(str(pad('Pajak', fmt(order.tax))));
  if (order.serviceCharge > 0) push(str(pad('Service', fmt(order.serviceCharge))));
  push(CMD.BOLD_ON);
  push(str(pad('TOTAL', fmt(order.total))));
  push(CMD.BOLD_OFF);
  push(str(pad('Metode Bayar', order.paymentMethod || '-')));

  if (order.customer?.name) {
    push(str(CMD.LINE_DASH));
    push(str(pad('Member:', order.customer.name)));
    if (order.customer.points !== undefined) push(str(pad('Poin:', `${order.customer.points} poin`)));
  }

  push(CMD.ALIGN_CENTER);
  push(str(CMD.LINE_CHAR));
  push(CMD.LF);
  push(str(settings?.receiptFooter || 'Terima kasih atas kunjungan Anda!'));
  push(str('Sampai jumpa kembali 🙏'));
  push(CMD.LF, CMD.LF, CMD.LF);
  push(CMD.CUT);

  return Buffer.concat(parts);
};

// Helper: Deteksi apakah suatu item adalah produk Showcase / Ready-to-drink (tidak perlu dicetak ke dapur/bar)
export const isShowcaseItem = (item: any): boolean => {
  const target = item.product?.category?.printerTarget;
  if (target === 'NONE') return true;
  const prodName = (item.product?.name || '').toLowerCase();
  const catName = (item.product?.category?.name || '').toLowerCase();
  if (prodName.includes('air mineral') || prodName.includes('mineral water') || catName.includes('showcase') || catName.includes('display') || catName.includes('snack')) {
    return true;
  }
  return false;
};

// Helper: Deteksi apakah item ditujukan untuk Bar Minuman
export const isBarItem = (item: any): boolean => {
  if (isShowcaseItem(item)) return false;
  const target = item.product?.category?.printerTarget;
  if (target === 'BAR') return true;
  if (target === 'KITCHEN') return false;
  const catName = (item.product?.category?.name || '').toLowerCase();
  const prodName = (item.product?.name || '').toLowerCase();
  return (
    catName.includes('minum') || catName.includes('beverage') || catName.includes('drink') ||
    catName.includes('tea') || catName.includes('kopi') || catName.includes('coffee') ||
    prodName.includes('ocha') || prodName.includes('juice') || prodName.includes('ice') ||
    prodName.includes('soda') || prodName.includes('latte') || prodName.includes('tea')
  );
};

// Helper: Deteksi apakah item ditujukan untuk Dapur Makanan
export const isKitchenItem = (item: any): boolean => {
  if (isShowcaseItem(item)) return false;
  if (isBarItem(item)) return false;
  const target = item.product?.category?.printerTarget;
  if (target === 'KITCHEN') return true;
  return true; // Default fallback untuk makanan/ramen/topping
};

// ─── Format Tiket Dapur (Kitchen Order Ticket - KOT / Makanan) ───────────────
export const buildKitchenTicket = (order: any, specificItems?: any[]): Buffer => {
  const parts: Buffer[] = [];
  const push = (...bufs: Buffer[]) => parts.push(...bufs);

  const items = specificItems || (order.items || []).filter(isKitchenItem);

  push(CMD.INIT, CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_ON);
  push(str('*** TIKET DAPUR (MAKANAN) ***'));
  push(CMD.DOUBLE_OFF, CMD.BOLD_OFF, CMD.ALIGN_LEFT);
  push(str(CMD.LINE_DOUBLE));
  
  push(CMD.BOLD_ON, CMD.DOUBLE_ON);
  if (order.table?.tableNo) {
    push(str(`MEJA: ${order.table.tableNo}`));
  } else {
    push(str(`TIPE: ${order.orderType || 'TAKE AWAY'}`));
  }
  push(CMD.DOUBLE_OFF, CMD.BOLD_OFF);

  push(str(pad('No. Order:', order.orderNumber || `#${order.id}`)));
  push(str(pad('Waktu:', new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))));
  if (order.user?.name) push(str(pad('Pelayan/Kasir:', order.user.name)));
  push(str(CMD.LINE_CHAR));

  push(CMD.BOLD_ON);
  push(str('QTY   NAMA MENU & CATATAN KHUSUS'));
  push(CMD.BOLD_OFF);
  push(str(CMD.LINE_DASH));

  for (const item of items) {
    push(CMD.BOLD_ON, CMD.DOUBLE_ON);
    push(str(`[${item.qty}x] ${item.product?.name || 'Item'}`));
    push(CMD.DOUBLE_OFF, CMD.BOLD_OFF);
    if (item.notes) {
      push(CMD.BOLD_ON);
      push(str(`     >> NOTE: ${item.notes}`));
      push(CMD.BOLD_OFF);
    }
    push(CMD.LF);
  }

  if (items.length === 0) {
    push(str('(Tidak ada item makanan)'));
  }

  push(str(CMD.LINE_DOUBLE));
  push(CMD.ALIGN_CENTER);
  push(str('Segera disajikan setelah selesai dimasak!'));
  push(CMD.LF, CMD.LF, CMD.LF);
  push(CMD.CUT);

  return Buffer.concat(parts);
};

// ─── Format Tiket Bar (Bar Order Ticket - BOT / Minuman) ────────────────────
export const buildBarTicket = (order: any, specificItems?: any[]): Buffer => {
  const parts: Buffer[] = [];
  const push = (...bufs: Buffer[]) => parts.push(...bufs);

  const items = specificItems || (order.items || []).filter(isBarItem);

  push(CMD.INIT, CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_ON);
  push(str('*** TIKET BAR (MINUMAN) ***'));
  push(CMD.DOUBLE_OFF, CMD.BOLD_OFF, CMD.ALIGN_LEFT);
  push(str(CMD.LINE_DOUBLE));
  
  push(CMD.BOLD_ON, CMD.DOUBLE_ON);
  if (order.table?.tableNo) {
    push(str(`MEJA: ${order.table.tableNo}`));
  } else {
    push(str(`TIPE: ${order.orderType || 'TAKE AWAY'}`));
  }
  push(CMD.DOUBLE_OFF, CMD.BOLD_OFF);

  push(str(pad('No. Order:', order.orderNumber || `#${order.id}`)));
  push(str(pad('Waktu:', new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))));
  if (order.user?.name) push(str(pad('Pelayan/Kasir:', order.user.name)));
  push(str(CMD.LINE_CHAR));

  push(CMD.BOLD_ON);
  push(str('QTY   NAMA MINUMAN & CATATAN KHUSUS'));
  push(CMD.BOLD_OFF);
  push(str(CMD.LINE_DASH));

  for (const item of items) {
    push(CMD.BOLD_ON, CMD.DOUBLE_ON);
    push(str(`[${item.qty}x] ${item.product?.name || 'Item'}`));
    push(CMD.DOUBLE_OFF, CMD.BOLD_OFF);
    if (item.notes) {
      push(CMD.BOLD_ON);
      push(str(`     >> NOTE: ${item.notes}`));
      push(CMD.BOLD_OFF);
    }
    push(CMD.LF);
  }

  if (items.length === 0) {
    push(str('(Tidak ada item minuman)'));
  }

  push(str(CMD.LINE_DOUBLE));
  push(CMD.ALIGN_CENTER);
  push(str('Sajikan dalam keadaan segar & dingin!'));
  push(CMD.LF, CMD.LF, CMD.LF);
  push(CMD.CUT);

  return Buffer.concat(parts);
};

// ─── Print test page ───────────────────────────────────────────────────────
export const buildTestPage = (storeName: string, roleName = 'PRINTER'): Buffer => {
  const parts: Buffer[] = [];
  const push = (...bufs: Buffer[]) => parts.push(...bufs);
  push(CMD.INIT, CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_ON);
  push(str(storeName || 'SOL CAFE'));
  push(CMD.DOUBLE_OFF, CMD.BOLD_OFF);
  push(str(CMD.LINE_DOUBLE));
  push(CMD.BOLD_ON);
  push(str(`[ TEST PRINT: ${roleName.toUpperCase()} ]`));
  push(CMD.BOLD_OFF);
  push(str('✓ Koneksi Printer ESC/POS Berhasil!'));
  push(str(`Waktu Uji: ${new Date().toLocaleString('id-ID')}`));
  push(str('Status: Siap Mencetak Pesanan'));
  push(str(CMD.LINE_CHAR));
  push(CMD.LF, CMD.LF, CMD.LF);
  push(CMD.CUT);
  return Buffer.concat(parts);
};

// ─── Public API ───────────────────────────────────────────────────────────
export const PrinterService = {
  // Struk Kasir
  async printReceipt(order: any, settings: any): Promise<void> {
    const ip   = settings?.printerIp;
    const port = settings?.printerPort || 9100;
    if (!ip) throw new Error('IP printer kasir belum dikonfigurasi');
    const buf = buildReceipt(order, settings);
    await sendToNetwork(ip, port, buf);
  },

  // Struk Dapur (Makanan)
  async printKitchenTicket(order: any, settings: any, specificItems?: any[]): Promise<void> {
    const ip   = settings?.kitchenPrinterIp || settings?.printerIp;
    const port = settings?.kitchenPrinterPort || settings?.printerPort || 9100;
    if (!ip) throw new Error('IP printer dapur belum dikonfigurasi');
    const buf = buildKitchenTicket(order, specificItems);
    await sendToNetwork(ip, port, buf);
  },

  // Struk Bar (Minuman)
  async printBarTicket(order: any, settings: any, specificItems?: any[]): Promise<void> {
    const ip   = settings?.barPrinterIp || settings?.printerIp;
    const port = settings?.barPrinterPort || settings?.printerPort || 9100;
    if (!ip) throw new Error('IP printer bar belum dikonfigurasi');
    const buf = buildBarTicket(order, specificItems);
    await sendToNetwork(ip, port, buf);
  },

  // Cetak Semua (Split Cetak ke Masing-Masing Printer Sesuai Target)
  async printAllSplitTickets(order: any, settings: any): Promise<{ receipt?: boolean; kitchen?: boolean; bar?: boolean; errors?: string[] }> {
    const results: any = { errors: [] };

    // 1. Kasir
    if (settings?.printerIp) {
      try {
        await this.printReceipt(order, settings);
        results.receipt = true;
      } catch (e: any) {
        results.errors.push(`Gagal cetak Kasir: ${e.message}`);
      }
    }

    // 2. Dapur
    const kitchenIp = settings?.kitchenPrinterIp || settings?.printerIp;
    if (kitchenIp) {
      try {
        await this.printKitchenTicket(order, settings);
        results.kitchen = true;
      } catch (e: any) {
        results.errors.push(`Gagal cetak Dapur: ${e.message}`);
      }
    }

    // 3. Bar
    const barIp = settings?.barPrinterIp || settings?.printerIp;
    if (barIp) {
      try {
        await this.printBarTicket(order, settings);
        results.bar = true;
      } catch (e: any) {
        results.errors.push(`Gagal cetak Bar: ${e.message}`);
      }
    }

    return results;
  },

  async testPrint(ip: string, port: number, storeName: string, roleName = 'PRINTER'): Promise<void> {
    const buf = buildTestPage(storeName, roleName);
    await sendToNetwork(ip, port, buf);
  }
};
