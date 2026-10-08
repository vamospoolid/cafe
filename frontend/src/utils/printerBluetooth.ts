import EscPosEncoder from 'esc-pos-encoder';

export interface BluetoothDeviceInfo {
  id: string;
  name: string;
  type: 'WEB_BLUETOOTH' | 'CORDOVA_SERIAL';
  address?: string;
}

export type PrinterRole = 'cashier' | 'kitchen';

// In-memory reference for Web Bluetooth device instances (Kasir & Dapur)
let activeCashierDevice: any = null;
let activeKitchenDevice: any = null;

export const setActiveWebBluetoothDevice = (device: any, role: PrinterRole = 'cashier') => {
  if (role === 'kitchen') {
    activeKitchenDevice = device;
  } else {
    activeCashierDevice = device;
  }
};

export const getActiveWebBluetoothDevice = (role: PrinterRole = 'cashier'): any => {
  return role === 'kitchen' ? activeKitchenDevice : activeCashierDevice;
};

// Common thermal printer Bluetooth Low Energy (BLE) / GATT Service UUIDs
export const COMMON_PRINTER_SERVICES: (string | number)[] = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard ESC/POS printer service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent UART (very common in 58mm/80mm mini POS)
  '0000e781-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Rongta / Goojprt / PT-210 RPP02N
  '0000fee7-0000-1000-8000-00805f9b34fb', // HPRT
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
  '0000fff0-0000-1000-8000-00805f9b34fb', // Generic POS
  '0000ff00-0000-1000-8000-00805f9b34fb', // Xprinter / Bixolon
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 UART
  '0000180a-0000-1000-8000-00805f9b34fb', // Device Information Service (0x180A)
  '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile
  '0000ae30-0000-1000-8000-00805f9b34fb', // Other POS
  '0000ae01-0000-1000-8000-00805f9b34fb',
  '0000af30-0000-1000-8000-00805f9b34fb',
  0x18f0,
  0xffe0,
  0xff00,
  0xfee7,
  0x180a,
  0xfff0
];

export const isWebBluetoothSupported = (): boolean => {
  return typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;
};

export const isNativeMobile = (): boolean => {
  return !!(window as any).cordova || !!(window as any).Capacitor?.isNativePlatform();
};

export const isBluetoothSupported = (): boolean => {
  return isWebBluetoothSupported() || isNativeMobile();
};

export const getSavedBluetoothPrinter = (role: PrinterRole = 'cashier'): BluetoothDeviceInfo | null => {
  const prefix = role === 'kitchen' ? 'bluetooth_kitchen_printer_' : 'bluetooth_printer_';
  let id = localStorage.getItem(`${prefix}id`) || localStorage.getItem(`${prefix}mac`);
  let name = localStorage.getItem(`${prefix}name`);
  let type = (localStorage.getItem(`${prefix}type`) as any) || (isWebBluetoothSupported() ? 'WEB_BLUETOOTH' : 'CORDOVA_SERIAL');
  
  // Fallback untuk cashier jika menggunakan prefix alternatif
  if (!id && role === 'cashier') {
    id = localStorage.getItem('bluetooth_cashier_printer_id') || localStorage.getItem('bluetooth_cashier_printer_mac');
    name = localStorage.getItem('bluetooth_cashier_printer_name');
    type = (localStorage.getItem('bluetooth_cashier_printer_type') as any) || type;
  }

  if (!id) return null;
  return { 
    id, 
    name: name || (role === 'kitchen' ? 'Printer Dapur' : 'Printer Kasir'), 
    type,
    address: id
  };
};

export const saveSavedBluetoothPrinter = (role: PrinterRole, info: BluetoothDeviceInfo) => {
  if (role === 'kitchen') {
    localStorage.setItem('bluetooth_kitchen_printer_id', info.id);
    localStorage.setItem('bluetooth_kitchen_printer_name', info.name);
    localStorage.setItem('bluetooth_kitchen_printer_type', info.type);
    localStorage.setItem('bluetooth_kitchen_printer_mac', info.address || info.id);
  } else {
    localStorage.setItem('bluetooth_printer_id', info.id);
    localStorage.setItem('bluetooth_printer_name', info.name);
    localStorage.setItem('bluetooth_printer_type', info.type);
    localStorage.setItem('bluetooth_printer_mac', info.address || info.id);
    localStorage.setItem('bluetooth_cashier_printer_id', info.id);
    localStorage.setItem('bluetooth_cashier_printer_name', info.name);
    localStorage.setItem('bluetooth_cashier_printer_type', info.type);
    localStorage.setItem('bluetooth_cashier_printer_mac', info.address || info.id);
  }
};

export const clearSavedBluetoothPrinter = (role?: PrinterRole) => {
  if (!role || role === 'cashier') {
    localStorage.removeItem('bluetooth_printer_id');
    localStorage.removeItem('bluetooth_printer_name');
    localStorage.removeItem('bluetooth_printer_mac');
    localStorage.removeItem('bluetooth_printer_type');
    localStorage.removeItem('bluetooth_cashier_printer_id');
    localStorage.removeItem('bluetooth_cashier_printer_name');
    localStorage.removeItem('bluetooth_cashier_printer_mac');
    localStorage.removeItem('bluetooth_cashier_printer_type');
    if (activeCashierDevice && activeCashierDevice.gatt?.connected) {
      try { activeCashierDevice.gatt.disconnect(); } catch {}
    }
    activeCashierDevice = null;
  }
  if (!role || role === 'kitchen') {
    localStorage.removeItem('bluetooth_kitchen_printer_id');
    localStorage.removeItem('bluetooth_kitchen_printer_name');
    localStorage.removeItem('bluetooth_kitchen_printer_mac');
    localStorage.removeItem('bluetooth_kitchen_printer_type');
    if (activeKitchenDevice && activeKitchenDevice.gatt?.connected) {
      try { activeKitchenDevice.gatt.disconnect(); } catch {}
    }
    activeKitchenDevice = null;
  }
};

/**
 * Mencari instance BluetoothDevice aktif atau memulihkan dari granted devices di Chrome
 */
export const getActiveOrSavedDevice = async (role: PrinterRole = 'cashier'): Promise<any> => {
  const current = role === 'kitchen' ? activeKitchenDevice : activeCashierDevice;
  if (current) return current;

  const saved = getSavedBluetoothPrinter(role);
  if (saved && (navigator as any).bluetooth?.getDevices) {
    try {
      const devices = await (navigator as any).bluetooth.getDevices();
      const match = devices.find((d: any) => d.id === saved.id || d.name === saved.name) || devices[0];
      if (match) {
        if (role === 'kitchen') activeKitchenDevice = match;
        else activeCashierDevice = match;
        return match;
      }
    } catch (e) {
      console.warn(`[Printer ${role}] Gagal membaca granted devices:`, e);
    }
  }
  return null;
};

/**
 * Koneksi GATT server dengan pembersihan socket dan auto-retry tangguh
 */
export const connectGattWithRetry = async (device: any, maxRetries = 2): Promise<any> => {
  if (!device) throw new Error('Perangkat printer Bluetooth tidak ditemukan.');

  if (device.gatt?.connected) {
    return device.gatt;
  }

  let lastError: any = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Disconnect socket lama jika dalam keadaan hanging / half-open
      if (device.gatt) {
        try {
          device.gatt.disconnect();
        } catch { /* ignore */ }
      }

      await new Promise(r => setTimeout(r, 350));

      const server = await device.gatt.connect();
      if (server && server.connected) {
        return server;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[GATT Connect] Percobaan ${attempt}/${maxRetries} gagal:`, err.message);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 800));
      }
    }
  }

  const errDesc = lastError?.message || 'Connection attempt failed';
  throw new Error(
    `Koneksi Bluetooth ke "${device.name || 'Printer'}" gagal (${errDesc}).\n\n` +
    `💡 Solusi Cepat:\n` +
    `1. Matikan dan hidupkan kembali printer Anda (Power restart).\n` +
    `2. Jika printer sudah terpasang di "Bluetooth Windows", buka Windows Settings > Bluetooth dan klik "Remove Device", lalu sambungkan langsung dari tombol Scan di sini (agar koneksi tidak diblokir OS Windows).\n` +
    `3. Pastikan printer tidak sedang terhubung ke HP / tablet lain.`
  );
};

/**
 * Request pair via Web Bluetooth API (Chrome Android / Windows / Mac)
 */
export const pairWebBluetoothPrinter = async (role: PrinterRole = 'cashier'): Promise<BluetoothDeviceInfo> => {
  if (!isWebBluetoothSupported()) {
    throw new Error('Browser ini tidak mendukung Web Bluetooth. Pastikan Anda menggunakan Google Chrome pada Android/Windows/Mac melalui HTTPS.');
  }

  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: COMMON_PRINTER_SERVICES
    });

    if (role === 'kitchen') {
      activeKitchenDevice = device;
    } else {
      activeCashierDevice = device;
    }

    // Uji koneksi awal seketika agar user tahu status perangkat
    try {
      await connectGattWithRetry(device, 2);
    } catch (connErr: any) {
      console.warn(`[Pair ${role}] Peringatan koneksi awal:`, connErr.message);
    }

    const info: BluetoothDeviceInfo = {
      id: device.id,
      name: device.name || (role === 'kitchen' ? 'Printer Dapur' : 'Printer Kasir'),
      type: 'WEB_BLUETOOTH',
      address: device.id
    };

    saveSavedBluetoothPrinter(role, info);
    return info;
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err.message?.includes('User cancelled')) {
      throw new Error('Pemindaian dibatalkan oleh pengguna.');
    }
    throw new Error(err.message || 'Gagal menyambungkan printer via Web Bluetooth.');
  }
};

/**
 * Send raw bytes over Web Bluetooth GATT Server
 */
const sendBytesWebBluetooth = async (device: any, bytes: Uint8Array): Promise<void> => {
  if (!device) {
    throw new Error('Perangkat Bluetooth tidak ditemukan. Silakan sambungkan ulang di Pengaturan.');
  }

  const server = await connectGattWithRetry(device, 2);

  // Cari characteristic write (kirim data)
  let writeChar: any = null;
  
  // 1. Coba getPrimaryServices() sekaligus (paling cepat dan hemat round-trip)
  try {
    const services = await server.getPrimaryServices();
    for (const service of services) {
      try {
        const chars = await service.getCharacteristics();
        for (const c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            writeChar = c;
            break;
          }
        }
        if (writeChar) break;
      } catch {
        // continue
      }
    }
  } catch (e: any) {
    console.warn('[BLE Discovery] getPrimaryServices warning:', e);
  }

  // 2. Fallback: Telusuri known services
  if (!writeChar) {
    for (const sUuid of COMMON_PRINTER_SERVICES) {
      try {
        const service = await server.getPrimaryService(sUuid);
        const chars = await service.getCharacteristics();
        for (const c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            writeChar = c;
            break;
          }
        }
        if (writeChar) break;
      } catch {
        // continue
      }
    }
  }

  if (!writeChar) {
    throw new Error('Tidak dapat menemukan characteristic kirim data (write) pada printer Bluetooth ini.');
  }

  // Kirim data dalam ukuran chunk aman (20 byte MTU standar BLE universal)
  const chunkSize = 20;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    if (writeChar.properties.writeWithoutResponse) {
      await writeChar.writeValueWithoutResponse(chunk);
    } else {
      await writeChar.writeValue(chunk);
    }
    // Delay 15ms antar potongan agar buffer printer thermal tidak overload
    await new Promise(res => setTimeout(res, 15));
  }
};

/**
 * Fallback Cordova / Capacitor Bluetooth Serial
 */
export const getBluetoothSerial = (): any => {
  return (window as any).bluetoothSerial || null;
};

export const listPairedBluetoothDevices = (): Promise<BluetoothDeviceInfo[]> => {
  return new Promise((resolve, reject) => {
    const bt = getBluetoothSerial();
    if (!bt) {
      reject(new Error('Bluetooth serial plugin tidak tersedia di browser web. Gunakan tombol Pindai Web Bluetooth Chrome.'));
      return;
    }

    bt.list(
      (devices: any[]) => {
        resolve(devices.map(d => ({
          id: d.id || d.address,
          name: d.name || 'Bluetooth Printer',
          type: 'CORDOVA_SERIAL',
          address: d.address
        })));
      },
      (err: any) => {
        reject(new Error(err || 'Gagal memindai perangkat Bluetooth'));
      }
    );
  });
};

export const discoverUnpairedBluetoothDevices = (): Promise<BluetoothDeviceInfo[]> => {
  return new Promise((resolve, reject) => {
    const bt = getBluetoothSerial();
    if (!bt) {
      reject(new Error('Bluetooth serial plugin tidak tersedia di browser web.'));
      return;
    }

    if (!bt.discoverUnpaired) {
      reject(new Error('Modul scan perangkat baru tidak didukung di perangkat ini.'));
      return;
    }

    bt.discoverUnpaired(
      (devices: any[]) => {
        resolve(devices.map(d => ({
          id: d.id || d.address,
          name: d.name || 'Perangkat Bluetooth Baru',
          type: 'CORDOVA_SERIAL',
          address: d.address
        })));
      },
      (err: any) => {
        reject(new Error(err || 'Gagal mencari perangkat Bluetooth baru. Pastikan izin lokasi & Bluetooth aktif di HP.'));
      }
    );
  });
};

export const isBluetoothConnected = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const bt = getBluetoothSerial();
    if (!bt || !bt.isConnected) return resolve(false);
    bt.isConnected(
      () => resolve(true),
      () => resolve(false)
    );
  });
};

export const isBluetoothEnabled = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const win = window as any;
    if (win.Capacitor?.Plugins?.HardwareBridge) {
      win.Capacitor.Plugins.HardwareBridge.getHardwareStatus()
        .then((status: any) => resolve(!!status?.isBluetoothEnabled))
        .catch(() => resolve(false));
      return;
    }

    const bt = getBluetoothSerial();
    if (!bt || !bt.isEnabled) return resolve(false);
    bt.isEnabled(
      () => resolve(true),
      () => resolve(false)
    );
  });
};

export const requestEnableBluetooth = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const win = window as any;
    if (win.Capacitor?.Plugins?.HardwareBridge) {
      win.Capacitor.Plugins.HardwareBridge.requestEnableBluetooth()
        .then(() => resolve(true))
        .catch(() => resolve(false));
      return;
    }

    const bt = getBluetoothSerial();
    if (bt && bt.enable) {
      bt.enable(
        () => resolve(true),
        () => resolve(false)
      );
    } else {
      resolve(false);
    }
  });
};

export const isWebUsbSupported = (): boolean => {
  return typeof navigator !== 'undefined' && !!(navigator as any).usb;
};

export const pairWebUsbPrinter = async (): Promise<any> => {
  if (!isWebUsbSupported()) {
    throw new Error('Browser atau WebView ini tidak mendukung koneksi WebUSB.');
  }
  const device = await (navigator as any).usb.requestDevice({
    filters: [
      { classCode: 7 } // USB Printer Class Code
    ]
  });
  if (device) {
    localStorage.setItem('usb_printer_saved', 'true');
    localStorage.setItem('usb_printer_name', device.productName || 'USB Thermal Printer');
  }
  return device;
};

export const printViaWebUsb = async (bytes: Uint8Array): Promise<void> => {
  if (!isWebUsbSupported()) return;
  const usb = (navigator as any).usb;
  const devices = await usb.getDevices();
  if (!devices || devices.length === 0) {
    throw new Error('Perangkat USB Thermal Printer tidak ditemukan. Pastikan kabel OTG terpasang.');
  }
  const device = devices[0];
  await device.open();
  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }
  await device.claimInterface(0);

  const outEndpoint = device.configuration?.interfaces[0]?.alternate?.endpoints.find(
    (e: any) => e.direction === 'out'
  );
  const endpointNumber = outEndpoint?.endpointNumber || 1;
  await device.transferOut(endpointNumber, bytes);
  await device.close();
};

export const printViaRawBtIntent = (bytes: Uint8Array): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = window.btoa(binary);
      const rawbtUrl = `rawbt:data;base64,${base64Data}`;
      
      const link = document.createElement('a');
      link.href = rawbtUrl;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      resolve();
    } catch (e: any) {
      reject(new Error('Gagal mencetak via RawBT: ' + e.message));
    }
  });
};

export const connectBluetoothPrinter = (macAddress: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const bt = getBluetoothSerial();
    if (!bt) {
      reject(new Error('Bluetooth serial plugin tidak tersedia.'));
      return;
    }

    bt.connect(
      macAddress,
      () => resolve(),
      (err: any) => reject(new Error(err || 'Koneksi printer Bluetooth gagal'))
    );
  });
};

export const disconnectBluetoothPrinter = (): Promise<void> => {
  return new Promise((resolve) => {
    const bt = getBluetoothSerial();
    if (!bt) {
      resolve();
      return;
    }

    bt.disconnect(
      () => resolve(),
      () => resolve()
    );
  });
};

// Lacak MAC yang saat ini sedang aktif terkoneksi di Cordova
let currentConnectedMac: string | null = null;

export const printRawBytes = async (bytes: Uint8Array, role: PrinterRole = 'cashier'): Promise<void> => {
  // 1. Web Bluetooth (Chrome Desktop / Android HTTPS)
  const savedPrinter = getSavedBluetoothPrinter(role) || (role === 'kitchen' ? getSavedBluetoothPrinter('cashier') : null);
  const effectiveRole: PrinterRole = getSavedBluetoothPrinter(role) ? role : 'cashier';

  if (isWebBluetoothSupported() && (getActiveWebBluetoothDevice(effectiveRole) || savedPrinter?.type === 'WEB_BLUETOOTH' || localStorage.getItem('bluetooth_printer_type') === 'WEB_BLUETOOTH')) {
    let device = await getActiveOrSavedDevice(effectiveRole);

    // ── Auto-reconnect saat print: jika device ada tapi GATT terputus ──
    if (!device) {
      if (savedPrinter && (navigator as any).bluetooth?.getDevices) {
        try {
          const granted = await (navigator as any).bluetooth.getDevices();
          device = granted.find((d: any) => d.id === savedPrinter.id || d.name === savedPrinter.name) || granted[0] || null;
          if (device) {
            setActiveWebBluetoothDevice(device, effectiveRole);
          }
        } catch { /* ignore */ }
      }
    }

    if (!device) {
      throw new Error(`Printer Bluetooth ${effectiveRole === 'kitchen' ? 'Dapur' : 'Kasir'} belum terhubung. Pastikan printer menyala atau sambungkan di menu Pengaturan.`);
    }

    // Pastikan GATT terkoneksi sebelum kirim data
    if (!device.gatt?.connected) {
      try {
        await connectGattWithRetry(device, 2);
      } catch (reconnErr: any) {
        throw new Error(`Printer ${effectiveRole === 'kitchen' ? 'Dapur' : 'Kasir'} ditemukan tapi gagal konek: ${reconnErr.message}. Pastikan printer menyala.`);
      }
    }

    await sendBytesWebBluetooth(device, bytes);
    return;
  }


  // 2. Cordova / Capacitor Bluetooth Serial (Native Android APK)
  const bt = getBluetoothSerial();
  if (bt) {
    // A. Pastikan Bluetooth aktif di HP / Tablet
    const enabled = await isBluetoothEnabled();
    if (!enabled) {
      const prompted = await requestEnableBluetooth();
      if (!prompted) {
        throw new Error('Bluetooth perangkat dalam keadaan mati. Silakan aktifkan Bluetooth.');
      }
      await new Promise(r => setTimeout(r, 1200));
    }

    // B. Tentukan target MAC & Nama Printer sesuai role
    const kitchenSaved = getSavedBluetoothPrinter('kitchen');
    const cashierSaved = getSavedBluetoothPrinter('cashier');

    let targetMac = '';
    let targetName = '';

    if (role === 'kitchen') {
      if (kitchenSaved) {
        targetMac = kitchenSaved.address || kitchenSaved.id;
        targetName = kitchenSaved.name;
      } else if (cashierSaved) {
        // Fallback otomatis ke printer kasir jika printer dapur belum disetel terpisah
        targetMac = cashierSaved.address || cashierSaved.id;
        targetName = cashierSaved.name + ' (Fallback Dapur)';
      }
    } else {
      if (cashierSaved) {
        targetMac = cashierSaved.address || cashierSaved.id;
        targetName = cashierSaved.name;
      }
    }

    if (!targetMac) {
      throw new Error(`Belum ada Printer ${role === 'kitchen' ? 'Dapur' : 'Kasir'} yang dihubungkan di Pengaturan.`);
    }

    // C. Auto-switch socket jika berpindah printer (Kasir vs Dapur) atau koneksi terputus
    const isConn = await isBluetoothConnected();
    if (!isConn || currentConnectedMac !== targetMac) {
      if (isConn) {
        try {
          await disconnectBluetoothPrinter();
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 250));
      }

      try {
        console.log(`[Printer] Menghubungkan ke ${targetName} (${targetMac})...`);
        await connectBluetoothPrinter(targetMac);
        currentConnectedMac = targetMac;
      } catch (connErr: any) {
        console.warn(`[Printer] Gagal konek ke ${targetMac}:`, connErr);
        throw new Error(`Gagal menyambung ke Printer ${role === 'kitchen' ? 'Dapur' : 'Kasir'} (${targetName}): ${connErr.message || connErr}`);
      }
    }

    return new Promise((resolve, reject) => {
      bt.write(
        bytes.buffer,
        () => resolve(),
        async (err: any) => {
          console.warn('[Printer] Write pertama gagal, mencoba reconnect:', err);
          try {
            await disconnectBluetoothPrinter();
            await new Promise(r => setTimeout(r, 300));
            await connectBluetoothPrinter(targetMac);
            currentConnectedMac = targetMac;
            bt.write(
              bytes.buffer, 
              () => resolve(), 
              (retryErr: any) => reject(new Error(retryErr || 'Gagal mengirim data cetak ke printer Bluetooth'))
            );
          } catch (retryErr: any) {
            reject(new Error(retryErr.message || 'Printer Bluetooth terputus dan gagal tersambung kembali'));
          }
        }
      );
    });
  }

  // 3. WebUSB Printer Fallback (USB OTG / Direct Cable)
  if (isWebUsbSupported() && localStorage.getItem('usb_printer_saved') === 'true') {
    try {
      await printViaWebUsb(bytes);
      return;
    } catch (usbErr) {
      console.warn('[Printer] WebUSB print error, trying fallback:', usbErr);
    }
  }

  // 4. RawBT Android URL Scheme Fallback (Universal USB / Bluetooth)
  if (isNativeMobile()) {
    try {
      await printViaRawBtIntent(bytes);
      return;
    } catch (rawbtErr) {
      console.warn('[Printer] RawBT intent error:', rawbtErr);
    }
  }

  throw new Error(`Tidak ada modul printer yang aktif untuk ${role === 'kitchen' ? 'Dapur' : 'Kasir'}. Silakan periksa di Pengaturan.`);
};

/**
 * Deteksi apakah nama perangkat printer adalah hardware thermal 58mm (max 32 karakter per baris Font A)
 */
export const isKnown58mmPrinter = (name?: string): boolean => {
  if (!name) return false;
  const n = name.toLowerCase();
  if (/80|3inch|300|xp-n|xp-c|xp-q|tm-t/i.test(n)) {
    return false;
  }
  return /rpp|58|pt[-_]?210|pos[-_]?58|mpt|mtp|zj[-_]?58|mini|goojprt|ble_pos|bluetooth/i.test(n);
};

/**
 * Dapatkan lebar baris karakter efektif (32 karakter untuk 58mm, 48 karakter untuk 80mm)
 */
export const getEffectiveLineWidth = (paperWidthSetting?: '58mm' | '80mm', role: PrinterRole = 'cashier'): number => {
  const saved = getSavedBluetoothPrinter(role) || getSavedBluetoothPrinter('cashier');
  const devName = saved?.name || '';
  
  // Jika perangkat Bluetooth adalah hardware 58mm (seperti RPP02N_BLE milik user), paksa 32 kolom agar garis tidak patah/meluber
  if (isKnown58mmPrinter(devName)) {
    return 32;
  }
  
  const widthPref = paperWidthSetting || (localStorage.getItem('printer_paper_width') as '58mm' | '80mm') || '58mm';
  return widthPref === '80mm' ? 48 : 32;
};

/**
 * Word wrap helper: memotong teks menjadi array baris sesuai batas karakter tanpa memutus suku kata
 */
export const wrapText = (text: string, maxWidth: number): string[] => {
  if (!text) return [];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      if (word.length > maxWidth) {
        for (let i = 0; i < word.length; i += maxWidth) {
          lines.push(word.substring(i, i + maxWidth));
        }
      } else {
        currentLine = word;
      }
    } else {
      if ((currentLine + ' ' + word).length <= maxWidth) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        if (word.length > maxWidth) {
          for (let i = 0; i < word.length; i += maxWidth) {
            lines.push(word.substring(i, i + maxWidth));
          }
          currentLine = '';
        } else {
          currentLine = word;
        }
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
};

/**
 * Test Print Function (Kasir atau Dapur)
 */
export const testPrintBluetooth = async (role: PrinterRole = 'cashier'): Promise<void> => {
  const isKitchen = role === 'kitchen';
  const lineWidth = getEffectiveLineWidth(undefined, role);
  const divider = '='.repeat(lineWidth);
  const subDivider = '-'.repeat(lineWidth);

  const encoder = new EscPosEncoder();
  const bytes = encoder
    .initialize()
    .align('center')
    .line(divider)
    .bold(true)
    .line(isKitchen ? '*** TIKET UJI DAPUR ***' : '*** STRUK UJI KASIR ***')
    .bold(false)
    .line(isKitchen ? '[ TEST PRINTER DAPUR OK ]' : '[ TEST PRINTER KASIR OK ]')
    .line(divider)
    .align('left')
    .line(`Kertas : ${lineWidth} Kolom (${lineWidth === 32 ? '58mm' : '80mm'})`)
    .line(`Waktu  : ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`)
    .line(`Target : ${isKitchen ? 'Dapur (Tiket Makanan)' : 'Kasir (Struk Konsumen)'}`)
    .line('Status : Terhubung & Siap')
    .line(subDivider)
    .align('center')
    .line(isKitchen ? 'Pesanan Siap Diproses Koki' : 'Printer Siap Digunakan')
    .line('\n\n\n')
    .cut()
    .encode();

  await printRawBytes(bytes, role);
};

/**
 * Sinyal pembuka laci kasir otomatis RJ11 via printer thermal (ESC p 0 25 250)
 */
export const kickCashDrawer = async (): Promise<void> => {
  try {
    const drawerBytes = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    await printRawBytes(drawerBytes);
  } catch (err) {
    console.warn('[Printer] Gagal mengirim sinyal kick cash drawer:', err);
  }
};

/**
 * Helper deteksi apakah item ditujukan untuk Bar Minuman
 */
export const isBarItem = (item: any): boolean => {
  const target = item.product?.category?.stationTarget || item.product?.category?.printerTarget || item.product?.printerTarget;
  if (target === 'BAR' || target === 'BEVERAGE') return true;
  if (target === 'KITCHEN' || target === 'GRILL') return false;
  const catName = (item.product?.category?.name || item.categoryName || '').toLowerCase();
  const prodName = (item.product?.name || item.name || '').toLowerCase();
  return (
    catName.includes('minum') || catName.includes('beverage') || catName.includes('drink') ||
    catName.includes('tea') || catName.includes('kopi') || catName.includes('coffee') ||
    catName.includes('jus') || catName.includes('juice') || catName.includes('boba') ||
    catName.includes('mocktail') || catName.includes('cocktail') || catName.includes('bar') ||
    prodName.includes('ocha') || prodName.includes('juice') || prodName.includes('jus ') ||
    prodName.includes('ice') || prodName.includes('es ') || prodName.includes('soda') ||
    prodName.includes('latte') || prodName.includes('tea') || prodName.includes('teh') ||
    prodName.includes('kopi') || prodName.includes('coffee') || prodName.includes('americano') ||
    prodName.includes('cappuccino') || prodName.includes('espresso') || prodName.includes('machiatto') ||
    prodName.includes('macchiato') || prodName.includes('frappe') || prodName.includes('smoothie') ||
    prodName.includes('milkshake') || prodName.includes('shake') || prodName.includes('boba') ||
    prodName.includes('syrup') || prodName.includes('sirup') || prodName.includes('mineral') ||
    prodName.includes('aqua') || prodName.includes('cola') || prodName.includes('fanta') ||
    prodName.includes('sprite') || prodName.includes('lemonade') || prodName.includes('squash') ||
    prodName.includes('beer') || prodName.includes('mocktail')
  );
};

export const isKitchenItem = (item: any): boolean => {
  const target = item.product?.category?.stationTarget || item.product?.category?.printerTarget || item.product?.printerTarget;
  if (target === 'KITCHEN' || target === 'GRILL' || target === 'DESSERT') return true;
  if (target === 'BAR' || target === 'BEVERAGE') return false;
  return !isBarItem(item);
};

/**
 * Format label meja secara seragam & jelas (Meja 1, Meja 2 + Meja 3, atau Take Away)
 */
export const formatOrderTableLabel = (order: any): { isDineIn: boolean; label: string } => {
  if (!order) return { isDineIn: false, label: 'TAKE AWAY' };

  let tablePart = '';

  if (order.table?.tableNo) {
    tablePart = `MEJA ${order.table.tableNo}`;
    if (order.table.name && !order.table.name.toLowerCase().includes('meja')) {
      tablePart += ` (${order.table.name})`;
    }
  } else if (order.table?.name) {
    tablePart = order.table.name.toUpperCase();
  } else if (order.tableName) {
    tablePart = order.tableName.toUpperCase();
  } else if (order.tableNo) {
    tablePart = `MEJA ${order.tableNo}`;
  } else if (order.tableId) {
    tablePart = `MEJA ${order.tableId}`;
  }

  // Handle joined tables
  if (order.joinedTables && Array.isArray(order.joinedTables) && order.joinedTables.length > 0) {
    const extra = order.joinedTables.map((t: any) => t.tableNo ? `MEJA ${t.tableNo}` : t.name).join(' + ');
    tablePart = tablePart ? `${tablePart} + ${extra}` : extra;
  }

  if (tablePart) {
    return { isDineIn: true, label: tablePart };
  }

  const isDineIn = order.orderType === 'Dine In' || order.orderType === 'DINE IN' || order.orderType === 'dine_in';
  if (isDineIn) {
    return { isDineIn: true, label: 'DINE IN' };
  }

  return { isDineIn: false, label: (order.orderType || 'TAKE AWAY').toUpperCase() };
};

/**
 * Print Order Receipt to Bluetooth Thermal Printer (Struk Kasir Konsumen)
 */
export const printBluetoothReceipt = async (
  order: any, 
  settings: { name: string; address?: string; phone?: string; footer?: string; paperWidth?: '58mm' | '80mm' },
  options?: { autoKickDrawer?: boolean }
): Promise<void> => {
  try {
    const lineWidth = getEffectiveLineWidth(settings.paperWidth, 'cashier');
    const is80mm = lineWidth >= 48;
    const divider = '='.repeat(lineWidth);
    const subDivider = '-'.repeat(lineWidth);

    const encoder = new EscPosEncoder();
    const { isDineIn, label: tableLabel } = formatOrderTableLabel(order);
    
    // Header Toko
    let encoded = encoder
      .initialize()
      .align('center')
      .bold(true)
      .line(settings.name || 'MUKI RAMEN')
      .bold(false);

    if (settings.address) {
      const addrLines = wrapText(settings.address, lineWidth);
      addrLines.forEach(l => { encoded = encoded.line(l); });
    }
    if (settings.phone) {
      encoded = encoded.line(`Telp: ${settings.phone}`);
    }

    // Informasi Order & NOMOR MEJA
    const orderTime = new Date(order.paidAt || order.createdAt || Date.now());
    const timeStr = orderTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const dateStr = orderTime.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });

    encoded = encoded
      .line(divider)
      .align('left')
      .line(`No Struk : ${(order.orderNumber || `#${order.id}` || '').substring(0, 20)}`)
      .line(`Waktu    : ${timeStr}  ${dateStr}`)
      .line(`Kasir    : ${(order.user?.name || order.cashierName || 'Kasir').substring(0, 20)}`)
      .bold(true)
      .line(`${isDineIn ? 'Meja     ' : 'Tipe     '}: ${tableLabel}`)
      .bold(false);

    if (order.customerName) {
      encoded = encoded.line(`Pelanggan: ${order.customerName.substring(0, 20)}`);
    }
    encoded = encoded.line(subDivider);

    // Items list (penanganan 58mm 2-baris vs 80mm 1-baris tanpa overflow)
    const items = order.items || [];
    items.forEach((item: any) => {
      const productName = item.product?.name || item.productName || item.name || 'Item';
      const qty = item.quantity || item.qty || 1;
      const price = item.price || item.unitPrice || 0;
      const total = item.subtotal || (qty * price);

      const qtyPriceStr = `${qty} x ${Math.round(price).toLocaleString('id-ID')}`;
      const totalStr = Math.round(total).toLocaleString('id-ID');
      
      if (is80mm) {
        // 80mm (48 kolom)
        const shortName = productName.length > 24 ? productName.substring(0, 24) : productName.padEnd(24, ' ');
        const paddedQty = qtyPriceStr.padStart(12, ' ');
        const paddedTotal = totalStr.padStart(10, ' ');
        encoded = encoded.line(`${shortName} ${paddedQty} ${paddedTotal}`);
      } else {
        // 58mm (32 kolom): Layout 2-baris profesional agar nama produk tidak terpotong & harga tidak meluap
        encoded = encoded.line(productName);
        const leftPart = `  ${qtyPriceStr}`;
        const spaceCount = Math.max(1, 32 - leftPart.length - totalStr.length);
        encoded = encoded.line(`${leftPart}${' '.repeat(spaceCount)}${totalStr}`);
      }

      if (item.notes && item.notes.trim()) {
        const noteWrapped = wrapText(item.notes.trim(), lineWidth - 4);
        noteWrapped.forEach(n => {
          encoded = encoded.line(`  * ${n}`);
        });
      }
    });

    // Totals Section
    const subtotal = order.subtotal || order.total || 0;
    const tax = order.tax || 0;
    const discount = order.discountAmount || order.discount || 0;
    const grandTotal = order.total || order.grandTotal || subtotal;
    const cashReceived = order.cashReceived || grandTotal;
    const changeDue = order.changeDue || Math.max(0, cashReceived - grandTotal);
    const paymentMethod = (order.paymentMethod || 'TUNAI').toUpperCase();

    const makeTotalLine = (label: string, value: string): string => {
      const valStr = `Rp ${value}`;
      const spaceCount = Math.max(1, lineWidth - label.length - valStr.length);
      return `${label}${' '.repeat(spaceCount)}${valStr}`;
    };

    encoded = encoded
      .line(subDivider)
      .line(makeTotalLine('Subtotal', Math.round(subtotal).toLocaleString('id-ID')));

    if (discount > 0) {
      encoded = encoded.line(makeTotalLine('Diskon', `-${Math.round(discount).toLocaleString('id-ID')}`));
    }
    if (tax > 0) {
      encoded = encoded.line(makeTotalLine('PB1 (Pajak)', Math.round(tax).toLocaleString('id-ID')));
    }

    encoded = encoded
      .bold(true)
      .line(makeTotalLine('TOTAL', Math.round(grandTotal).toLocaleString('id-ID')))
      .bold(false)
      .line(makeTotalLine(`Bayar (${paymentMethod})`, Math.round(cashReceived).toLocaleString('id-ID')))
      .line(makeTotalLine('Kembali', Math.round(changeDue).toLocaleString('id-ID')))
      .line(divider)
      .align('center')
      .line(settings.footer || 'Terima Kasih Atas Kunjungan Anda!')
      .line('\n\n\n')
      .cut();

    const bytes = encoded.encode();
    await printRawBytes(bytes, 'cashier');

    // Otomatis kick laci kasir jika pembayaran tunai
    const shouldKick = options?.autoKickDrawer ?? (paymentMethod === 'TUNAI' || paymentMethod === 'CASH');
    if (shouldKick) {
      await kickCashDrawer();
    }
  } catch (err: any) {
    console.error('Error printing receipt via Bluetooth:', err);
    throw err;
  }
};

/**
 * Print Kitchen / Bar Ticket to Bluetooth Thermal Printer (Tiket Dapur & Bar)
 * Format rapi, nomor meja besar, tanpa wrap berantakan pada printer 58mm maupun 80mm
 */
export const printBluetoothKitchenTicket = async (
  order: any,
  target: 'kitchen' | 'bar',
  settings?: { storeName?: string; paperWidth?: '58mm' | '80mm' }
): Promise<void> => {
  try {
    const isKitchen = target === 'kitchen';
    const role: PrinterRole = isKitchen ? 'kitchen' : 'cashier';
    const lineWidth = getEffectiveLineWidth(settings?.paperWidth, role);
    const divider = '='.repeat(lineWidth);
    const subDivider = '-'.repeat(lineWidth);

    const encoder = new EscPosEncoder();
    const title = isKitchen ? 'TIKET DAPUR' : 'TIKET BAR';
    const subTitle = isKitchen ? '[ PESANAN MAKANAN ]' : '[ PESANAN MINUMAN ]';

    // Filter items
    const allItems = order.items || [];
    const filterFn = isKitchen ? isKitchenItem : isBarItem;
    const filteredItems = allItems.filter(filterFn);
    
    // Jangan pernah fallback mencetak seluruh item! Jika tidak ada menu yang sesuai, beri peringatan
    if (filteredItems.length === 0) {
      throw new Error(`Pesanan ini tidak memiliki menu ${isKitchen ? 'makanan untuk Tiket Dapur' : 'minuman untuk Tiket Bar'}.`);
    }

    const { isDineIn, label: tableLabel } = formatOrderTableLabel(order);

    const orderTime = new Date(order.createdAt || Date.now());
    const timeStr = orderTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const dateStr = orderTime.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const cashierName = (order.user?.name || order.cashierName || 'Kasir').substring(0, 14);
    const orderNum = (order.orderNumber || `#${order.id || ''}`).substring(0, 18);

    let encoded = encoder
      .initialize()
      .align('center')
      .line(divider)
      .bold(true)
      .line(`*** ${title} ***`)
      .bold(false)
      .line(subTitle)
      .line(divider);

    // NOMOR MEJA SANGAT BESAR DI TENGAH TIKET (Double Height & Width)
    encoded = encoded
      .align('center')
      .bold(true)
      .width(2)
      .height(2)
      .line(tableLabel || (isDineIn ? 'DINE IN' : 'TAKE AWAY'))
      .width(1)
      .height(1)
      .bold(false)
      .line(isDineIn ? '--- DINE IN ---' : '--- TAKE AWAY ---')
      .line(subDivider)
      .align('left');

    // Meta Order yang dibatasi tepat pada lebar baris
    // Baris 1: No Order & Jam
    const rightTime = `${timeStr} ${dateStr}`;
    const leftNo = `No: ${orderNum}`;
    const spaceMeta = Math.max(1, lineWidth - leftNo.length - rightTime.length);
    encoded = encoded.line(`${leftNo}${' '.repeat(spaceMeta)}${rightTime}`);

    // Baris 2: Kasir & Tamu
    let line2 = `Kasir: ${cashierName}`;
    if (order.customerName) {
      const guest = ` | Tamu: ${order.customerName.substring(0, 10)}`;
      if ((line2 + guest).length <= lineWidth) {
        line2 += guest;
      }
    }
    encoded = encoded.line(line2);

    encoded = encoded
      .line(subDivider)
      .bold(true)
      .line(isKitchen ? 'DAFTAR PESANAN MAKANAN:' : 'DAFTAR PESANAN MINUMAN:')
      .bold(false);

    let totalQty = 0;
    filteredItems.forEach((item: any, idx: number) => {
      const productName = item.product?.name || item.productName || item.name || 'Item';
      const qty = item.quantity || item.qty || 1;
      totalQty += Number(qty) || 1;

      // Header Baris: [2x] NAMA PRODUK (Besar & Tebal)
      const prefix = `[${qty}x] `;
      const wrappedName = wrapText(productName.toUpperCase(), lineWidth - prefix.length);

      encoded = encoded.bold(true);
      if (wrappedName.length === 0) {
        encoded = encoded.line(`${prefix}${productName.toUpperCase()}`);
      } else {
        encoded = encoded.line(`${prefix}${wrappedName[0]}`);
        for (let i = 1; i < wrappedName.length; i++) {
          encoded = encoded.line(`     ${wrappedName[i]}`);
        }
      }
      encoded = encoded.bold(false);

      // Catatan Koki (Notes)
      if (item.notes && item.notes.trim()) {
        const notePrefix = `  >> Note: `;
        const wrappedNotes = wrapText(item.notes.trim(), lineWidth - notePrefix.length);
        encoded = encoded.bold(true);
        if (wrappedNotes.length === 0) {
          encoded = encoded.line(`${notePrefix}${item.notes}`);
        } else {
          encoded = encoded.line(`${notePrefix}${wrappedNotes[0]}`);
          for (let i = 1; i < wrappedNotes.length; i++) {
            encoded = encoded.line(`           ${wrappedNotes[i]}`);
          }
        }
        encoded = encoded.bold(false);
      }

      // Beri jarak antar menu agar chef mudah membaca
      if (idx < filteredItems.length - 1) {
        encoded = encoded.line('');
      }
    });

    encoded = encoded
      .line(subDivider)
      .line(`Total: ${filteredItems.length} menu (${totalQty} porsi)`)
      .line(divider)
      .align('center')
      .bold(true)
      .line(isKitchen ? 'MOHON SEGERA DIPROSES!' : 'SAJIKAN DINGIN & SEGAR!')
      .bold(false)
      .line('\n\n\n')
      .cut();

    const bytes = encoded.encode();
    await printRawBytes(bytes, 'kitchen');
  } catch (err: any) {
    console.error(`Error printing ${target} ticket via Bluetooth:`, err);
    throw err;
  }
};

