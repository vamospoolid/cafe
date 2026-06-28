import * as net from 'net';

// ─── ESC/POS Commands untuk 80mm printer ──────────────────────────────────
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
};

const str = (text: string) => Buffer.from(text + '\n', 'utf-8');
const pad = (left: string, right: string, width = 47): string => {
  const space = width - left.length - right.length;
  return left + ' '.repeat(Math.max(1, space)) + right + '\n';
};
const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

// ─── Kirim buffer ke printer via TCP/IP ───────────────────────────────────
const sendToNetwork = (host: string, port: number, data: Buffer): Promise<void> => {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.setTimeout(5000);
    client.connect(port, host, () => {
      client.write(data, () => {
        client.destroy();
        resolve();
      });
    });
    client.on('timeout', () => { client.destroy(); reject(new Error('Printer timeout')); });
    client.on('error', (err) => { client.destroy(); reject(err); });
  });
};

// ─── Format struk kasir (receipt) ─────────────────────────────────────────
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
  push(str(pad('No:', order.orderNumber || '-')));
  push(str(pad('Kasir:', order.user?.name || '-')));
  if (order.table?.tableNo) push(str(pad('Meja:', order.table.tableNo)));
  push(str(pad('Waktu:', new Date(order.paidAt || order.createdAt).toLocaleString('id-ID'))));
  push(str(CMD.LINE_CHAR));

  // Items
  for (const item of order.items || []) {
    push(str(`${item.product?.name || item.qty + 'x Item'}`));
    push(str(pad(`  ${item.qty}x ${fmt(item.price)}`, fmt(item.subtotal))));
    if (item.notes) push(str(`  * ${item.notes}`));
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
  push(str('Sampai jumpa lagi ☕'));
  push(CMD.LF, CMD.LF, CMD.LF);
  push(CMD.CUT);

  return Buffer.concat(parts);
};

// ─── Format tiket dapur (kitchen ticket) ──────────────────────────────────
export const buildKitchenTicket = (order: any): Buffer => {
  const parts: Buffer[] = [];
  const push = (...bufs: Buffer[]) => parts.push(...bufs);

  push(CMD.INIT, CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_ON);
  push(str('*** DAPUR ***'));
  push(CMD.DOUBLE_OFF, CMD.BOLD_OFF, CMD.ALIGN_LEFT);
  push(str(CMD.LINE_CHAR));
  push(CMD.BOLD_ON);
  push(str(pad('ORDER:', order.orderNumber || '-')));
  if (order.table?.tableNo) push(str(pad('MEJA:', order.table.tableNo)));
  else push(str(pad('TIPE:', 'Take Away')));
  push(str(pad('WAKTU:', new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }))));
  push(CMD.BOLD_OFF);
  push(str(CMD.LINE_CHAR));

  for (const item of order.items || []) {
    push(CMD.BOLD_ON);
    push(str(`${item.qty}x  ${item.product?.name || 'Item'}`));
    push(CMD.BOLD_OFF);
    if (item.notes) push(str(`     >> ${item.notes}`));
  }

  push(str(CMD.LINE_CHAR));
  push(CMD.LF, CMD.LF, CMD.LF);
  push(CMD.CUT);

  return Buffer.concat(parts);
};

// ─── Print test page ───────────────────────────────────────────────────────
export const buildTestPage = (storeName: string): Buffer => {
  const parts: Buffer[] = [];
  const push = (...bufs: Buffer[]) => parts.push(...bufs);
  push(CMD.INIT, CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_ON);
  push(str(storeName || 'SOL CAFE'));
  push(CMD.DOUBLE_OFF, CMD.BOLD_OFF);
  push(str(CMD.LINE_CHAR));
  push(str('✓ Printer Termal Terhubung'));
  push(str(`Waktu: ${new Date().toLocaleString('id-ID')}`));
  push(str('Lebar kertas: 80mm'));
  push(str(CMD.LINE_CHAR));
  push(CMD.LF, CMD.LF, CMD.LF);
  push(CMD.CUT);
  return Buffer.concat(parts);
};

// ─── Public API ───────────────────────────────────────────────────────────
export const PrinterService = {
  async printReceipt(order: any, settings: any): Promise<void> {
    const ip   = settings?.printerIp;
    const port = settings?.printerPort || 9100;
    if (!ip) throw new Error('IP printer belum dikonfigurasi');
    const buf = buildReceipt(order, settings);
    await sendToNetwork(ip, port, buf);
  },

  async printKitchenTicket(order: any, settings: any): Promise<void> {
    const ip   = settings?.printerIp;
    const port = settings?.printerPort || 9100;
    if (!ip) throw new Error('IP printer belum dikonfigurasi');
    const buf = buildKitchenTicket(order);
    await sendToNetwork(ip, port, buf);
  },

  async testPrint(ip: string, port: number, storeName: string): Promise<void> {
    const buf = buildTestPage(storeName);
    await sendToNetwork(ip, port, buf);
  }
};
