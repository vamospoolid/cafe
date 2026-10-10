import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { ElectronPrinterService } from './printerService';
import { LicenseManager } from './licenseManager';
import { ServerManager } from './serverManager';

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  const vertical = process.env.STANDALONE_VERTICAL || 'BENGKEL';
  const verticalTitles: Record<string, string> = {
    BENGKEL: 'CodePOS Bengkel Motor & Mobil',
    KAFE: 'CodePOS Resto & Kafe',
    RETAIL: 'CodePOS Toko Retail & Bangunan',
    LAUNDRY: 'CodePOS Laundry Kiloan & Satuan',
    RENTAL: 'CodePOS Rental & Sewa Kendaraan'
  };

  const appTitle = verticalTitles[vertical] || `CodePOS ${vertical} Standalone`;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: appTitle,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  const port = parseInt(process.env.PORT || '3001', 10);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // Mode Produksi Standalone: Pastikan server lokal Express aktif
    const rootDir = path.resolve(__dirname, '../../..');
    const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
    const storageDir = path.join(appData, `CodePOS_${vertical}`);

    // Tampilkan layar memuat ringan sebelum server siap
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${appTitle} - Memuat...</title>
          <style>
            body { margin: 0; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; }
            .spinner { width: 44px; height: 44px; border: 4px solid #334155; border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 20px; }
            @keyframes spin { to { transform: rotate(360deg); } }
            h2 { font-size: 1.25rem; font-weight: 600; margin: 0 0 8px 0; color: #e2e8f0; }
            p { font-size: 0.85rem; color: #94a3b8; margin: 0; }
          </style>
        </head>
        <body>
          <div class="spinner"></div>
          <h2>Memulai ${appTitle}</h2>
          <p>Mempersiapkan database lokal & sistem kasir...</p>
        </body>
      </html>
    `)}`);

    try {
      await ServerManager.ensureBackendRunning({
        port,
        vertical,
        appDataDir: storageDir,
        rootDir
      });
      // Muat halaman utama kasir setelah server siap
      if (mainWindow) {
        mainWindow.loadURL(`http://localhost:${port}`);
      }
    } catch (e) {
      if (mainWindow) {
        mainWindow.loadURL(`http://localhost:${port}`);
      }
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Register IPC Handlers for Printer & Hardware ─────────────────────────────
ipcMain.handle('printer:printRaw', async (_event, { bytes, printerName }) => {
  try {
    const buffer = Buffer.from(bytes);
    return await ElectronPrinterService.sendRawBytesToPrinter(buffer, printerName);
  } catch (err: any) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('printer:printReceipt', async (_event, { receiptData, options }) => {
  try {
    return await ElectronPrinterService.printReceipt(receiptData, options);
  } catch (err: any) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('printer:kickCashDrawer', async (_event, { printerName }) => {
  try {
    return await ElectronPrinterService.kickCashDrawer(printerName);
  } catch (err: any) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('printer:listPrinters', async () => {
  try {
    return await ElectronPrinterService.listInstalledPrinters();
  } catch (err) {
    return [];
  }
});

// ─── Register IPC Handlers for License & Anti-Piracy ──────────────────────────
ipcMain.handle('license:getHardwareId', async () => {
  const vertical = process.env.STANDALONE_VERTICAL || 'BENGKEL';
  return await LicenseManager.getHardwareId(vertical);
});

ipcMain.handle('license:getStatus', async () => {
  const vertical = process.env.STANDALONE_VERTICAL || 'BENGKEL';
  return await LicenseManager.checkActivationStatus(vertical);
});

ipcMain.handle('license:verify', async (_event, { licenseKey }) => {
  const vertical = process.env.STANDALONE_VERTICAL || 'BENGKEL';
  const verification = await LicenseManager.verifyLicenseKey(licenseKey, vertical);
  if (verification.valid) {
    await LicenseManager.saveLicenseKey(licenseKey, vertical);
    return { success: true, payload: verification.payload };
  } else {
    return { success: false, error: verification.error };
  }
});

// Window controls
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  ServerManager.stopBackend();
});

app.on('window-all-closed', () => {
  ServerManager.stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
