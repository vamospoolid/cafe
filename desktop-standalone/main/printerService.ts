import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ─── ESC/POS Constants ────────────────────────────────────────────────────────
export const ESC_POS_COMMANDS = {
  INIT: Buffer.from([0x1b, 0x40]),
  ALIGN_LEFT: Buffer.from([0x1b, 0x61, 0x00]),
  ALIGN_CENTER: Buffer.from([0x1b, 0x61, 0x01]),
  ALIGN_RIGHT: Buffer.from([0x1b, 0x61, 0x02]),
  BOLD_ON: Buffer.from([0x1b, 0x45, 0x01]),
  BOLD_OFF: Buffer.from([0x1b, 0x45, 0x00]),
  DOUBLE_ON: Buffer.from([0x1d, 0x21, 0x11]),
  DOUBLE_HEIGHT: Buffer.from([0x1d, 0x21, 0x01]),
  NORMAL: Buffer.from([0x1d, 0x21, 0x00]),
  FEED_3_LINES: Buffer.from([0x1b, 0x64, 0x03]),
  PAPER_CUT: Buffer.from([0x1d, 0x56, 0x41, 0x03]), // GS V A 3 (feed & cut)
  DRAWER_KICK_PIN2: Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]), // ESC p 0 25 250 (pulse 50ms)
  DRAWER_KICK_PIN5: Buffer.from([0x1b, 0x70, 0x01, 0x19, 0xfa]), // ESC p 1 25 250
};

export interface PrinterDevice {
  name: string;
  isDefault: boolean;
  status?: string;
  isOnline?: boolean;
}

export interface PrintReceiptOptions {
  printerName?: string;
  paperWidth?: '58mm' | '80mm';
  autoKickDrawer?: boolean;
  autoCut?: boolean;
}

export interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
  total: number;
  note?: string;
}

export interface ReceiptData {
  storeName?: string;
  address?: string;
  phone?: string;
  headerMessage?: string;
  footerMessage?: string;
  orderNumber?: string;
  cashierName?: string;
  date?: string;
  time?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  paymentMethod: string;
  cashGiven?: number;
  change?: number;
  notes?: string;
}

/**
 * Service cetak langsung ESC/POS & kontrol laci kasir (Windows Standalone)
 */
export class ElectronPrinterService {
  /**
   * Mengambil daftar printer yang terinstal di Windows
   */
  public static async listInstalledPrinters(): Promise<PrinterDevice[]> {
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync(
          'powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object Name, Default, PrinterStatus | ConvertTo-Json"'
        );
        if (!stdout.trim()) return [];
        const parsed = JSON.parse(stdout);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        return list.map((p: any) => ({
          name: p.Name,
          isDefault: Boolean(p.Default),
          status: p.PrinterStatus === 3 ? 'Idle' : 'Ready',
          isOnline: true
        }));
      } else {
        // Fallback CUPS untuk Linux/macOS
        const { stdout } = await execAsync('lpstat -p -d');
        const lines = stdout.split('\n');
        const printers: PrinterDevice[] = [];
        let defPrinter = '';
        for (const line of lines) {
          if (line.startsWith('system default destination:')) {
            defPrinter = line.split(':')[1]?.trim() || '';
          } else if (line.startsWith('printer ')) {
            const parts = line.split(' ');
            if (parts[1]) {
              printers.push({
                name: parts[1],
                isDefault: parts[1] === defPrinter,
                isOnline: true
              });
            }
          }
        }
        return printers;
      }
    } catch (err) {
      console.warn('[PrinterService] Gagal membaca daftar printer sistem:', err);
      return [];
    }
  }

  /**
   * Menemukan printer default sistem
   */
  public static async getDefaultPrinterName(): Promise<string | null> {
    const list = await this.listInstalledPrinters();
    const def = list.find(p => p.isDefault);
    return def ? def.name : (list.length > 0 ? list[0].name : null);
  }

  /**
   * Mengirim byte mentah ke printer Windows secara langsung
   */
  public static async sendRawBytesToPrinter(bytes: Buffer | Uint8Array, targetPrinter?: string): Promise<{ success: boolean; message: string }> {
    const printerName = targetPrinter || (await this.getDefaultPrinterName());
    if (!printerName) {
      throw new Error('Tidak ada printer yang terdeteksi atau dipilih di sistem.');
    }

    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `codepos_print_${Date.now()}_${Math.random().toString(36).substring(7)}.bin`);

    try {
      // 1. Tulis byte ke temporary file
      await fs.promises.writeFile(tempFile, Buffer.from(bytes));

      if (process.platform === 'win32') {
        // 2. Kirim raw spool file ke printer Windows menggunakan PowerShell Raw Spooler
        const escapedPrinter = printerName.replace(/'/g, "''");
        const psScript = `
          $bytes = [System.IO.File]::ReadAllBytes('${tempFile}');
          $printerName = '${escapedPrinter}';
          
          # Gunakan RawPrinterHelper atau kirim via Copy-Item ke port printer
          Add-Type -TypeDefinition @"
          using System;
          using System.IO;
          using System.Runtime.InteropServices;

          public class RawPrinterHelper {
              [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
              public class DOCINFOA {
                  [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
                  [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
                  [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
              }
              [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
              public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

              [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
              public static extern bool ClosePrinter(IntPtr hPrinter);

              [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
              public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

              [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
              public static extern bool EndDocPrinter(IntPtr hPrinter);

              [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
              public static extern bool StartPagePrinter(IntPtr hPrinter);

              [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
              public static extern bool EndPagePrinter(IntPtr hPrinter);

              [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
              public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

              public static bool SendBytesToPrinter(string szPrinterName, byte[] pBytes) {
                  IntPtr hPrinter = new IntPtr(0);
                  DOCINFOA di = new DOCINFOA();
                  bool bSuccess = false;
                  di.pDocName = "CodePOS Receipt";
                  di.pDataType = "RAW";

                  if (OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero)) {
                      if (StartDocPrinter(hPrinter, 1, di)) {
                          if (StartPagePrinter(hPrinter)) {
                              IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(pBytes.Length);
                              Marshal.Copy(pBytes, 0, pUnmanagedBytes, pBytes.Length);
                              int dwWritten = 0;
                              bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, pBytes.Length, out dwWritten);
                              Marshal.FreeCoTaskMem(pUnmanagedBytes);
                              EndPagePrinter(hPrinter);
                          }
                          EndDocPrinter(hPrinter);
                      }
                      ClosePrinter(hPrinter);
                  }
                  return bSuccess;
              }
          }
"@
          [RawPrinterHelper]::SendBytesToPrinter($printerName, $bytes)
        `;

        const { stdout } = await execAsync(`powershell -NoProfile -Command "${psScript.replace(/\r?\n/g, ' ')}"`);
        const isSuccess = stdout.toLowerCase().includes('true');

        if (!isSuccess) {
          // Fallback: copy file to shared printer or Out-Printer
          await execAsync(`powershell -NoProfile -Command "Get-Content -Path '${tempFile}' -Raw | Out-Printer -Name '${escapedPrinter}'"`);
        }
      } else {
        // Linux / macOS lp command
        await execAsync(`lp -d "${printerName}" -o raw "${tempFile}"`);
      }

      return { success: true, message: `Data cetak berhasil dikirim ke printer '${printerName}'.` };
    } catch (err: any) {
      console.error('[PrinterService] Gagal mengirim data ke printer:', err);
      throw new Error(`Gagal mencetak ke printer '${printerName}': ${err.message}`);
    } finally {
      // Hapus file sementara
      try {
        if (fs.existsSync(tempFile)) {
          await fs.promises.unlink(tempFile);
        }
      } catch { /* ignore cleanup error */ }
    }
  }

  /**
   * Mengirim pulsa RJ11 untuk menendang laci kasir (Cash Drawer Kick)
   */
  public static async kickCashDrawer(targetPrinter?: string): Promise<{ success: boolean; message: string }> {
    try {
      // Gabungkan pulsa tendang untuk pin 2 dan pin 5
      const drawerBuffer = Buffer.concat([
        ESC_POS_COMMANDS.INIT,
        ESC_POS_COMMANDS.DRAWER_KICK_PIN2,
        ESC_POS_COMMANDS.DRAWER_KICK_PIN5
      ]);

      return await this.sendRawBytesToPrinter(drawerBuffer, targetPrinter);
    } catch (err: any) {
      console.warn('[PrinterService] Gagal menendang laci kasir:', err);
      throw new Error(`Gagal membuka laci kasir: ${err.message}`);
    }
  }

  /**
   * Menghasilkan buffer ESC/POS terformat untuk struk kasir
   */
  public static formatReceiptToBuffer(data: ReceiptData, options: PrintReceiptOptions = {}): Buffer {
    const widthCols = options.paperWidth === '80mm' ? 48 : 32;
    const chunks: Buffer[] = [];

    const append = (buf: Buffer) => chunks.push(buf);
    const appendText = (text: string) => chunks.push(Buffer.from(text, 'ascii'));
    const appendLine = (text: string = '') => chunks.push(Buffer.from(text + '\n', 'ascii'));

    // 1. Inisialisasi printer
    append(ESC_POS_COMMANDS.INIT);

    // 2. Header Toko (Tengah & Tebal)
    append(ESC_POS_COMMANDS.ALIGN_CENTER);
    if (data.storeName) {
      append(ESC_POS_COMMANDS.BOLD_ON);
      append(ESC_POS_COMMANDS.DOUBLE_HEIGHT);
      appendLine(data.storeName);
      append(ESC_POS_COMMANDS.NORMAL);
      append(ESC_POS_COMMANDS.BOLD_OFF);
    }

    if (data.address) appendLine(data.address);
    if (data.phone) appendLine(`Telp: ${data.phone}`);
    if (data.headerMessage) appendLine(data.headerMessage);

    appendLine('-'.repeat(widthCols));

    // 3. Info Transaksi (Kiri)
    append(ESC_POS_COMMANDS.ALIGN_LEFT);
    if (data.orderNumber) appendLine(`No. Nota : ${data.orderNumber}`);
    if (data.date || data.time) {
      const dateTimeStr = [data.date, data.time].filter(Boolean).join(' ');
      appendLine(`Waktu    : ${dateTimeStr}`);
    }
    if (data.cashierName) appendLine(`Kasir    : ${data.cashierName}`);

    appendLine('-'.repeat(widthCols));

    // 4. Daftar Item / Produk
    for (const item of data.items) {
      // Baris 1: Nama Item
      append(ESC_POS_COMMANDS.BOLD_ON);
      appendLine(item.name);
      append(ESC_POS_COMMANDS.BOLD_OFF);

      // Baris 2: Qty x Harga pada kolom kiri, Subtotal pada kolom kanan
      const qtyPriceStr = `  ${item.qty} x ${Math.round(item.price).toLocaleString('id-ID')}`;
      const totalStr = Math.round(item.total).toLocaleString('id-ID');
      const spaces = Math.max(1, widthCols - qtyPriceStr.length - totalStr.length);
      appendLine(`${qtyPriceStr}${' '.repeat(spaces)}${totalStr}`);

      if (item.note) {
        appendLine(`  * ${item.note}`);
      }
    }

    appendLine('-'.repeat(widthCols));

    // 5. Total & Pembayaran (Kanan)
    const printRow = (label: string, valStr: string, bold: boolean = false) => {
      const spaces = Math.max(1, widthCols - label.length - valStr.length);
      if (bold) append(ESC_POS_COMMANDS.BOLD_ON);
      appendLine(`${label}${' '.repeat(spaces)}${valStr}`);
      if (bold) append(ESC_POS_COMMANDS.BOLD_OFF);
    };

    printRow('Subtotal', `Rp ${Math.round(data.subtotal).toLocaleString('id-ID')}`);
    if (data.discount && data.discount > 0) {
      printRow('Diskon', `-Rp ${Math.round(data.discount).toLocaleString('id-ID')}`);
    }
    if (data.tax && data.tax > 0) {
      printRow('Pajak', `Rp ${Math.round(data.tax).toLocaleString('id-ID')}`);
    }

    appendLine('='.repeat(widthCols));
    printRow('TOTAL AKHIR', `Rp ${Math.round(data.total).toLocaleString('id-ID')}`, true);
    appendLine('='.repeat(widthCols));

    printRow('Metode Bayar', data.paymentMethod.toUpperCase());
    if (data.cashGiven !== undefined && data.cashGiven > 0) {
      printRow('Tunai Diterima', `Rp ${Math.round(data.cashGiven).toLocaleString('id-ID')}`);
      printRow('Kembalian', `Rp ${Math.round(data.change || 0).toLocaleString('id-ID')}`);
    }

    // 6. Footer & Ucapan Terima Kasih
    appendLine('-'.repeat(widthCols));
    append(ESC_POS_COMMANDS.ALIGN_CENTER);
    if (data.footerMessage) {
      appendLine(data.footerMessage);
    } else {
      appendLine('Terima Kasih Atas Kunjungan Anda');
      appendLine('Barang yang sudah dibeli tidak dapat ditukar');
    }

    // 7. Feed 3 Baris & Potong Kertas
    append(ESC_POS_COMMANDS.FEED_3_LINES);
    if (options.autoCut !== false) {
      append(ESC_POS_COMMANDS.PAPER_CUT);
    }

    // 8. Tendang Laci jika opsi autoKickDrawer aktif
    if (options.autoKickDrawer) {
      append(ESC_POS_COMMANDS.DRAWER_KICK_PIN2);
      append(ESC_POS_COMMANDS.DRAWER_KICK_PIN5);
    }

    return Buffer.concat(chunks);
  }

  /**
   * Cetak struk lengkap dan opsional tendang laci kasir dalam 1 perintah
   */
  public static async printReceipt(data: ReceiptData, options: PrintReceiptOptions = {}): Promise<{ success: boolean; message: string }> {
    const rawBuffer = this.formatReceiptToBuffer(data, options);
    return await this.sendRawBytesToPrinter(rawBuffer, options.printerName);
  }
}
