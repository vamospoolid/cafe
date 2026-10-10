import { contextBridge, ipcRenderer } from 'electron';

// Expose safe Electron APIs to the frontend React window object
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Direct USB / ESC-POS Printing APIs
  printRaw: (bytes: number[] | Uint8Array, printerName?: string) => {
    const arrayBuffer = Array.from(bytes);
    return ipcRenderer.invoke('printer:printRaw', { bytes: arrayBuffer, printerName });
  },

  printReceipt: (receiptData: any, options?: any) => {
    return ipcRenderer.invoke('printer:printReceipt', { receiptData, options });
  },

  kickCashDrawer: (printerName?: string) => {
    return ipcRenderer.invoke('printer:kickCashDrawer', { printerName });
  },

  listPrinters: () => {
    return ipcRenderer.invoke('printer:listPrinters');
  },

  // Licensing & Hardware ID APIs
  getHardwareId: () => {
    return ipcRenderer.invoke('license:getHardwareId');
  },

  verifyLicense: (licenseKey: string) => {
    return ipcRenderer.invoke('license:verify', { licenseKey });
  },

  getLicenseStatus: () => {
    return ipcRenderer.invoke('license:getStatus');
  },

  // System & Window Controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
});
