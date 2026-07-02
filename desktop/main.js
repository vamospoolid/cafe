/**
 * SOL CAFE POS — Electron Main Process
 * ─────────────────────────────────────
 * Membungkus web POS (cafe.codenusa.id) ke dalam desktop app
 * dengan kemampuan raw ESC/POS USB thermal printing.
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const printer = require('./printer');

// ── Konfigurasi ──
const POS_URL = 'http://cafe.codenusa.id';
let mainWindow = null;

// ── Buat jendela utama ──
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'SOL CAFE POS',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    }
  });

  // Muat website POS
  mainWindow.loadURL(POS_URL);

  // Fullscreen-like kiosk mode (F11 toggle)
  mainWindow.on('enter-full-screen', () => {
    mainWindow.setMenuBarVisibility(false);
  });

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Inject CSS override untuk menyembunyikan elemen browser-only
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS(`
      /* Sembunyikan tombol install PWA atau elemen browser-only */
      .pwa-install-prompt { display: none !important; }
    `);
  });

  // Buka DevTools saat development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

// ── IPC Handlers untuk Raw Printing ──

// Cetak struk kasir (receipt)
ipcMain.handle('print-receipt', async (event, orderData, storeSettings) => {
  try {
    console.log('[Printer] Mencetak struk order:', orderData.orderNumber);
    const result = await printer.printReceipt(orderData, storeSettings);
    return { success: true, message: 'Struk berhasil dicetak' };
  } catch (err) {
    console.error('[Printer] Gagal cetak struk:', err.message);
    return { success: false, message: err.message };
  }
});

// Cetak tiket dapur (kitchen ticket)
ipcMain.handle('print-kitchen', async (event, orderData) => {
  try {
    console.log('[Printer] Mencetak tiket dapur:', orderData.orderNumber);
    const result = await printer.printKitchenTicket(orderData);
    return { success: true, message: 'Tiket dapur berhasil dicetak' };
  } catch (err) {
    console.error('[Printer] Gagal cetak tiket dapur:', err.message);
    return { success: false, message: err.message };
  }
});

// Test print
ipcMain.handle('print-test', async (event, printerName, storeName) => {
  try {
    console.log('[Printer] Test print ke:', printerName);
    const result = await printer.testPrint(printerName, storeName);
    return { success: true, message: 'Halaman uji berhasil dicetak' };
  } catch (err) {
    console.error('[Printer] Gagal test print:', err.message);
    return { success: false, message: err.message };
  }
});

// Daftar printer yang terpasang
ipcMain.handle('get-printers', async () => {
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    // Filter hanya printer POS/thermal
    return printers.map(p => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: p.isDefault,
      status: p.status
    }));
  } catch (err) {
    return [];
  }
});

// Set printer yang dipakai
ipcMain.handle('set-printer', async (event, printerName) => {
  printer.setPrinterName(printerName);
  return { success: true, message: `Printer diset ke: ${printerName}` };
});

// Dapatkan printer yang aktif
ipcMain.handle('get-active-printer', async () => {
  return { name: printer.getActivePrinter() };
});

// ── App Lifecycle ──
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ── Error Handling ──
process.on('uncaughtException', (err) => {
  console.error('[App] Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('[App] Unhandled Rejection:', err);
});
