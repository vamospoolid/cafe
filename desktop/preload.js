/**
 * SOL CAFE POS — Preload Script
 * ──────────────────────────────
 * Bridge antara web renderer (cafe.codenusa.id) dan Electron main process.
 * Mengekspos API printer ke window.electronPOS secara aman.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronPOS', {
  // ── Informasi Platform ──
  isElectron: true,
  platform: process.platform,

  // ── Printer API ──
  printer: {
    /**
     * Cetak struk kasir langsung ke printer thermal (raw ESC/POS)
     * @param {Object} orderData - Data pesanan lengkap
     * @param {Object} storeSettings - Pengaturan toko (nama, alamat, dll)
     * @returns {Promise<{success: boolean, message: string}>}
     */
    printReceipt: (orderData, storeSettings) => {
      return ipcRenderer.invoke('print-receipt', orderData, storeSettings);
    },

    /**
     * Cetak tiket dapur
     * @param {Object} orderData - Data pesanan
     * @returns {Promise<{success: boolean, message: string}>}
     */
    printKitchen: (orderData) => {
      return ipcRenderer.invoke('print-kitchen', orderData);
    },

    /**
     * Cetak halaman uji
     * @param {string} printerName - Nama printer Windows
     * @param {string} storeName - Nama toko
     * @returns {Promise<{success: boolean, message: string}>}
     */
    testPrint: (printerName, storeName) => {
      return ipcRenderer.invoke('print-test', printerName, storeName);
    },

    /**
     * Ambil daftar printer yang terpasang di Windows
     * @returns {Promise<Array<{name, displayName, isDefault, status}>>}
     */
    getPrinters: () => {
      return ipcRenderer.invoke('get-printers');
    },

    /**
     * Set printer aktif yang dipakai untuk cetak
     * @param {string} printerName - Nama printer Windows
     */
    setPrinter: (printerName) => {
      return ipcRenderer.invoke('set-printer', printerName);
    },

    /**
     * Dapatkan nama printer yang sedang aktif
     * @returns {Promise<{name: string}>}
     */
    getActivePrinter: () => {
      return ipcRenderer.invoke('get-active-printer');
    }
  }
});
