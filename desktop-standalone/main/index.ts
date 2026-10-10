import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { ElectronPrinterService } from './printerService';
import { LicenseManager } from './licenseManager';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'CodePOS Standalone',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  // URL target: local Express server port 3001 or static dist folder
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadURL('http://localhost:3001');
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
