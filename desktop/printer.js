/**
 * SOL CAFE POS — Raw ESC/POS Thermal Printer Module
 * ──────────────────────────────────────────────────
 * Mengirim perintah ESC/POS langsung ke printer thermal via:
 *   1. Windows Raw Print (copy /b ke printer share)
 *   2. TCP/IP Network (socket port 9100)
 * 
 * Mendukung: Iware XS 80 BT dan printer ESC/POS 80mm lainnya.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');

// ═══════════════════════════════════════════════════════════════
// ESC/POS COMMAND SET
// ═══════════════════════════════════════════════════════════════

const ESC = 0x1b;
const GS  = 0x1d;

const CMD = {
  INIT:          Buffer.from([ESC, 0x40]),                    // Reset printer
  ALIGN_LEFT:    Buffer.from([ESC, 0x61, 0x00]),
  ALIGN_CENTER:  Buffer.from([ESC, 0x61, 0x01]),
  ALIGN_RIGHT:   Buffer.from([ESC, 0x61, 0x02]),
  BOLD_ON:       Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF:      Buffer.from([ESC, 0x45, 0x00]),
  UNDERLINE_ON:  Buffer.from([ESC, 0x2d, 0x01]),
  UNDERLINE_OFF: Buffer.from([ESC, 0x2d, 0x00]),
  DOUBLE_ON:     Buffer.from([GS,  0x21, 0x11]),              // Double width + height
  DOUBLE_OFF:    Buffer.from([GS,  0x21, 0x00]),
  WIDE_ON:       Buffer.from([GS,  0x21, 0x10]),              // Double width only
  WIDE_OFF:      Buffer.from([GS,  0x21, 0x00]),
  TALL_ON:       Buffer.from([GS,  0x21, 0x01]),              // Double height only
  TALL_OFF:      Buffer.from([GS,  0x21, 0x00]),
  CUT:           Buffer.from([GS,  0x56, 0x41, 0x03]),        // Partial cut
  FULL_CUT:      Buffer.from([GS,  0x56, 0x00]),              // Full cut
  BEEP:          Buffer.from([ESC, 0x42, 0x03, 0x02]),        // Beep 3x
  OPEN_DRAWER:   Buffer.from([ESC, 0x70, 0x00, 0x19, 0x78]), // Kick cash drawer
  LF:            Buffer.from([0x0a]),
};

// Lebar cetak: 48 karakter untuk font standar pada kertas 80mm
const PRINT_WIDTH = 48;
const LINE_SOLID  = '\u2500'.repeat(PRINT_WIDTH);  // ─────
const LINE_DASH   = '-'.repeat(PRINT_WIDTH);
const LINE_EQUAL  = '='.repeat(PRINT_WIDTH);

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/** Konversi string ke buffer UTF-8 dengan newline */
const str = (text) => Buffer.from(text + '\n', 'utf-8');

/** Pad kiri-kanan dalam satu baris */
const pad = (left, right, width = PRINT_WIDTH) => {
  const space = width - left.length - right.length;
  return left + ' '.repeat(Math.max(1, space)) + right;
};

/** Format mata uang Indonesia */
const fmt = (n) => `Rp ${(n || 0).toLocaleString('id-ID')}`;

/** Format tanggal Indonesia */
const fmtDate = (iso) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

// ═══════════════════════════════════════════════════════════════
// PRINTER STATE
// ═══════════════════════════════════════════════════════════════

let activePrinterName = 'POS80 Printer'; // Default nama printer Windows

// ═══════════════════════════════════════════════════════════════
// SEND TO PRINTER — Windows Raw Print via share name
// ═══════════════════════════════════════════════════════════════

/**
 * Kirim buffer ESC/POS ke printer Windows via raw print.
 * Menggunakan perintah: copy /b file.bin "\\localhost\PrinterName"
 */
function sendToWindowsPrinter(printerName, data) {
  const tmpFile = path.join(os.tmpdir(), `solcafe_receipt_${Date.now()}.bin`);
  
  try {
    // Tulis buffer ESC/POS ke file sementara
    fs.writeFileSync(tmpFile, data);
    
    // Kirim ke printer via Windows share
    // Metode 1: via share name (paling reliable)
    const shareName = `\\\\localhost\\${printerName}`;
    
    try {
      execSync(`copy /b "${tmpFile}" "${shareName}"`, {
        shell: 'cmd.exe',
        timeout: 10000,
        windowsHide: true
      });
      console.log(`[Printer] Berhasil cetak via share: ${shareName}`);
      return;
    } catch (shareErr) {
      console.warn(`[Printer] Share gagal, coba via port langsung...`);
    }

    // Metode 2: via PowerShell Out-Printer (fallback)
    try {
      // Gunakan PowerShell untuk raw print
      const psCmd = `
        $bytes = [System.IO.File]::ReadAllBytes('${tmpFile.replace(/\\/g, '\\\\')}')
        $printer = Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Name='${printerName}'"
        if ($printer) {
          $portName = $printer.PortName
          $file = [System.IO.File]::OpenWrite("\\\\.\\$portName")
          $file.Write($bytes, 0, $bytes.Length)
          $file.Close()
        }
      `.replace(/\n/g, '; ');
      
      execSync(`powershell -Command "${psCmd}"`, {
        timeout: 10000,
        windowsHide: true
      });
      console.log(`[Printer] Berhasil cetak via PowerShell port langsung`);
      return;
    } catch (psErr) {
      console.warn(`[Printer] PowerShell gagal, coba via print command...`);
    }

    // Metode 3: via print command (fallback terakhir)
    execSync(`print /d:"${shareName}" "${tmpFile}"`, {
      shell: 'cmd.exe',
      timeout: 10000,
      windowsHide: true
    });
    console.log(`[Printer] Berhasil cetak via print command`);

  } finally {
    // Hapus file sementara
    try { fs.unlinkSync(tmpFile); } catch (e) { /* ignore */ }
  }
}

/**
 * Kirim buffer ESC/POS ke printer via TCP/IP network (port 9100)
 */
function sendToNetworkPrinter(host, port, data) {
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
}

// ═══════════════════════════════════════════════════════════════
// BUILD RECEIPT — Struk Kasir
// ═══════════════════════════════════════════════════════════════

function buildReceipt(order, settings) {
  const parts = [];
  const push = (...bufs) => parts.push(...bufs);

  push(CMD.INIT);

  // ── HEADER TOKO ──
  push(CMD.ALIGN_CENTER);
  if (settings?.storeName) {
    push(CMD.BOLD_ON, CMD.DOUBLE_ON);
    push(str(settings.storeName));
    push(CMD.DOUBLE_OFF, CMD.BOLD_OFF);
  }
  if (settings?.address)       push(str(settings.address));
  if (settings?.phone)         push(str(`Tel: ${settings.phone}`));
  if (settings?.receiptHeader) {
    push(CMD.LF);
    push(str(settings.receiptHeader));
  }

  // ── INFO PESANAN ──
  push(CMD.ALIGN_LEFT);
  push(str(LINE_SOLID));
  push(str(pad('No    :', order.orderNumber || '-')));
  push(str(pad('Kasir :', order.user?.name || '-')));
  if (order.table?.tableNo) {
    push(str(pad('Meja  :', order.table.tableNo)));
  }
  if (order.customerName && order.customerName !== 'Umum') {
    push(str(pad('Plgn  :', order.customerName)));
  }
  push(str(pad('Waktu :', fmtDate(order.paidAt || order.createdAt))));
  push(str(LINE_SOLID));

  // ── ITEM PESANAN ──
  for (const item of (order.items || [])) {
    const name = item.product?.name || 'Produk';
    push(str(name));
    const qtyPrice = `  ${item.qty}x ${fmt(item.price)}`;
    const subtotal = fmt(item.qty * item.price);
    push(str(pad(qtyPrice, subtotal)));
    if (item.notes) push(str(`  * ${item.notes}`));
  }

  // ── TOTAL ──
  push(str(LINE_SOLID));
  push(str(pad('Subtotal', fmt(order.subtotal || order.total))));
  if (order.discount > 0)      push(str(pad('Diskon', `-${fmt(order.discount)}`)));
  if (order.tax > 0)           push(str(pad('Pajak', fmt(order.tax))));
  if (order.serviceCharge > 0) push(str(pad('Service', fmt(order.serviceCharge))));
  push(str(LINE_SOLID));

  // ── GRAND TOTAL (besar) ──
  push(CMD.BOLD_ON, CMD.DOUBLE_ON);
  push(str(pad('TOTAL', fmt(order.total), 24)));  // 24 = half width for double-size
  push(CMD.DOUBLE_OFF, CMD.BOLD_OFF);

  push(str(pad('Bayar', order.paymentMethod || 'Tunai')));

  // ── MEMBER ──
  if (order.customer?.name) {
    push(str(LINE_DASH));
    push(str(pad('Member', order.customer.name)));
    if (order.customer.points !== undefined) {
      push(str(pad('Poin', `${order.customer.points} poin`)));
    }
  }

  // ── FOOTER ──
  push(CMD.ALIGN_CENTER);
  push(str(LINE_SOLID));
  push(CMD.LF);
  push(str(settings?.receiptFooter || 'Terima kasih atas kunjungan Anda!'));
  push(str('Sampai jumpa lagi'));
  push(CMD.LF, CMD.LF, CMD.LF);
  push(CMD.CUT);

  return Buffer.concat(parts);
}

// ═══════════════════════════════════════════════════════════════
// BUILD KITCHEN TICKET — Tiket Dapur
// ═══════════════════════════════════════════════════════════════

function buildKitchenTicket(order) {
  const parts = [];
  const push = (...bufs) => parts.push(...bufs);

  push(CMD.INIT);
  push(CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_ON);
  push(str('*** DAPUR ***'));
  push(CMD.DOUBLE_OFF, CMD.BOLD_OFF);
  push(CMD.ALIGN_LEFT);
  push(str(LINE_SOLID));

  push(CMD.BOLD_ON);
  push(str(pad('ORDER :', order.orderNumber || '-')));
  if (order.table?.tableNo) {
    push(str(pad('MEJA  :', order.table.tableNo)));
  } else {
    push(str(pad('TIPE  :', 'Take Away')));
  }
  push(str(pad('WAKTU :', new Date(order.createdAt).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit'
  }))));
  push(CMD.BOLD_OFF);
  push(str(LINE_SOLID));

  // Items dengan font besar
  for (const item of (order.items || [])) {
    push(CMD.BOLD_ON, CMD.WIDE_ON);
    push(str(`${item.qty}x  ${item.product?.name || 'Item'}`));
    push(CMD.WIDE_OFF, CMD.BOLD_OFF);
    if (item.notes) {
      push(str(`     >> ${item.notes}`));
    }
  }

  push(str(LINE_SOLID));
  push(CMD.LF, CMD.LF, CMD.LF);
  push(CMD.CUT);

  return Buffer.concat(parts);
}

// ═══════════════════════════════════════════════════════════════
// BUILD TEST PAGE — Halaman Uji
// ═══════════════════════════════════════════════════════════════

function buildTestPage(storeName) {
  const parts = [];
  const push = (...bufs) => parts.push(...bufs);

  push(CMD.INIT);
  push(CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_ON);
  push(str(storeName || 'SOL CAFE'));
  push(CMD.DOUBLE_OFF, CMD.BOLD_OFF);
  push(str(LINE_SOLID));
  push(CMD.LF);
  push(str('>>> PRINTER TERHUBUNG <<<'));
  push(CMD.LF);
  push(str(`Waktu: ${new Date().toLocaleString('id-ID')}`));
  push(str(`Printer: ${activePrinterName}`));
  push(str(`Lebar: 80mm (${PRINT_WIDTH} karakter)`));
  push(CMD.LF);

  // Test semua fitur
  push(CMD.ALIGN_LEFT);
  push(str(LINE_SOLID));
  push(str('Test Alignment:'));
  push(CMD.ALIGN_LEFT);   push(str('  Kiri'));
  push(CMD.ALIGN_CENTER); push(str('Tengah'));
  push(CMD.ALIGN_RIGHT);  push(str('Kanan'));
  push(CMD.ALIGN_LEFT);
  push(str(LINE_SOLID));

  push(str('Test Font:'));
  push(CMD.BOLD_ON);      push(str('  Bold text'));     push(CMD.BOLD_OFF);
  push(CMD.DOUBLE_ON);    push(str('  BESAR'));         push(CMD.DOUBLE_OFF);
  push(CMD.WIDE_ON);      push(str('  Lebar'));         push(CMD.WIDE_OFF);
  push(str(LINE_SOLID));

  push(str('Test Kolom:'));
  push(str(pad('Item', 'Harga')));
  push(str(pad('Americano', 'Rp 25.000')));
  push(str(pad('Matcha Latte', 'Rp 35.000')));
  push(str(LINE_SOLID));

  push(CMD.ALIGN_CENTER);
  push(CMD.LF);
  push(CMD.BOLD_ON);
  push(str('>> TEST BERHASIL <<'));
  push(CMD.BOLD_OFF);
  push(CMD.LF, CMD.LF, CMD.LF);
  push(CMD.CUT);

  return Buffer.concat(parts);
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

module.exports = {
  /**
   * Set nama printer Windows yang aktif
   */
  setPrinterName(name) {
    activePrinterName = name;
    console.log(`[Printer] Active printer set to: ${name}`);
  },

  /**
   * Dapatkan nama printer aktif
   */
  getActivePrinter() {
    return activePrinterName;
  },

  /**
   * Cetak struk kasir
   */
  async printReceipt(order, settings) {
    const buf = buildReceipt(order, settings);
    sendToWindowsPrinter(activePrinterName, buf);
    return true;
  },

  /**
   * Cetak tiket dapur
   */
  async printKitchenTicket(order) {
    const buf = buildKitchenTicket(order);
    sendToWindowsPrinter(activePrinterName, buf);
    return true;
  },

  /**
   * Cetak halaman uji
   */
  async testPrint(printerName, storeName) {
    if (printerName) activePrinterName = printerName;
    const buf = buildTestPage(storeName || 'SOL CAFE');
    sendToWindowsPrinter(activePrinterName, buf);
    return true;
  }
};
