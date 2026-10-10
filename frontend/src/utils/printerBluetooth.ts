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
      // Disconnect socket lama hanya jika masih dalam keadaan terhubung sebagian
      if (device.gatt?.connected) {
        try {
          device.gatt.disconnect();
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 200));
      }

      // Timeout proteksi 4.5 detik agar Chrome tidak menggantung tanpa batas di Windows BLE
      const server = await Promise.race([
        device.gatt.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Koneksi Bluetooth timeout (4.5s). Printer tidak merespons.')), 4500)
        )
      ]);

      if (server && server.connected) {
        return server;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[GATT Connect] Percobaan ${attempt}/${maxRetries} gagal:`, err.message);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 500));
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
  // 0. Electron Desktop Standalone (Direct Raw USB Spooler / IPC)
  if (typeof window !== 'undefined' && (window as any).electronAPI?.printRaw) {
    try {
      const savedPrinter = getSavedBluetoothPrinter(role) || (role === 'kitchen' ? getSavedBluetoothPrinter('cashier') : null);
      const targetPrinterName = savedPrinter?.name;
      const res = await (window as any).electronAPI.printRaw(bytes, targetPrinterName);
      if (res && res.success !== false) {
        return;
      }
    } catch (electronErr: any) {
      console.warn('[Printer] Electron direct raw printing fallback to bluetooth:', electronErr);
    }
  }

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
 * Test Print Function (Kasir atau Dapur / Gudang)
 */
export const testPrintBluetooth = async (role: PrinterRole = 'cashier', businessType: string = 'CAFE'): Promise<void> => {
  const isKitchen = role === 'kitchen';
  const encoder = new EscPosEncoder();

  let headerTitle = isKitchen ? 'TIKET UJI COBA PRINTER DAPUR' : 'STRUK UJI COBA PRINTER KASIR';
  let subTitle = isKitchen ? 'TEST PRINTER DAPUR OK' : 'TEST PRINTER KASIR OK';
  let targetDesc = isKitchen ? 'Printer Dapur (Tiket Pesanan)' : 'Printer Kasir (Struk Konsumen)';
  let footerDesc = isKitchen ? 'Pesanan Siap Diproses' : 'Printer Siap Digunakan Kasir';

  if (businessType === 'BENGKEL') {
    headerTitle = isKitchen ? 'TEST PRINTER GUDANG PART' : 'STRUK TEST PRINTER BENGKEL';
    subTitle = isKitchen ? 'GUDANG SPAREPART OK' : 'KASIR BENGKEL OK';
    targetDesc = isKitchen ? 'Printer Gudang / Part Desk' : 'Printer Kasir Bengkel';
    footerDesc = isKitchen ? 'Pengambilan Part Siap' : 'Sistem Servis & SPK Aktif';
  } else if (businessType === 'RETAIL') {
    headerTitle = isKitchen ? 'TEST PRINTER GUDANG' : 'STRUK TEST PRINTER GROSIR';
    subTitle = isKitchen ? 'GUDANG PACKING OK' : 'KASIR RETAIL/GROSIR OK';
    targetDesc = isKitchen ? 'Printer Gudang / Packing' : 'Printer Kasir Retail';
    footerDesc = isKitchen ? 'Surat Jalan / Packing Siap' : 'Sistem Kasir & Bon Siap';
  }

  const bytes = encoder
    .initialize()
    .align('center')
    .line('================================')
    .bold(true)
    .line(headerTitle)
    .bold(false)
    .line(subTitle)
    .line('================================')
    .align('left')
    .line(`Waktu  : ${new Date().toLocaleString('id-ID')}`)
    .line(`Target : ${targetDesc}`)
    .line('Status : Berhasil Terhubung!')
    .line('--------------------------------')
    .align('center')
    .line(footerDesc)
    .line('\n\n\n')
    .cut()
    .encode();

  await printRawBytes(bytes, role);
};

/**
 * Sinyal pembuka laci kasir otomatis RJ11 via printer thermal (ESC p 0 25 250)
 */
export const kickCashDrawer = async (): Promise<void> => {
  // 0. Electron Desktop Standalone (Direct Spooler / IPC)
  if (typeof window !== 'undefined' && (window as any).electronAPI?.kickCashDrawer) {
    try {
      const res = await (window as any).electronAPI.kickCashDrawer();
      if (res && res.success !== false) return;
    } catch (e) {
      console.warn('[Printer] Electron kick cash drawer fallback:', e);
    }
  }

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
    const is80mm = settings.paperWidth === '80mm' || localStorage.getItem('printer_paper_width') === '80mm';
    const lineWidth = is80mm ? 48 : 32;
    const divider = '='.repeat(lineWidth);
    const subDivider = '-'.repeat(lineWidth);

    const encoder = new EscPosEncoder();
    const { isDineIn, label: tableLabel } = formatOrderTableLabel(order);
    
    // Header Toko
    let encoded = encoder
      .initialize()
      .align('center')
      .bold(true)
      .line(settings.name || 'KAFE & RESTORAN')
      .bold(false);

    if (settings.address) {
      encoded = encoded.line(settings.address);
    }
    if (settings.phone) {
      encoded = encoded.line(`Telp: ${settings.phone}`);
    }

    // Informasi Order & NOMOR MEJA
    encoded = encoded
      .line(divider)
      .align('left')
      .line(`No Struk : ${order.orderNumber || order.id}`)
      .line(`Tanggal  : ${new Date(order.paidAt || order.createdAt || Date.now()).toLocaleString('id-ID')}`)
      .line(`Kasir    : ${order.user?.name || order.cashierName || 'Kasir'}`)
      .bold(true)
      .line(`${isDineIn ? 'Meja     ' : 'Tipe     '}: ${tableLabel}`)
      .bold(false);

    if (order.customerName) {
      encoded = encoded.line(`Pelanggan: ${order.customerName}`);
    }
    encoded = encoded.line(subDivider);

    // Items list (formatted for 32 chars 58mm or 48 chars 80mm)
    const items = order.items || [];
    items.forEach((item: any) => {
      const productName = item.product?.name || item.productName || item.name || 'Item';
      const qty = item.quantity || item.qty || 1;
      const price = item.price || item.unitPrice || 0;
      const total = item.subtotal || (qty * price);

      const qtyPriceStr = `${qty}x${Math.round(price).toLocaleString('id-ID')}`;
      const totalStr = Math.round(total).toLocaleString('id-ID');
      
      const maxNameLen = is80mm ? 24 : 14;
      const shortName = productName.length > maxNameLen ? productName.substring(0, maxNameLen) : productName.padEnd(maxNameLen, ' ');
      const paddedQty = qtyPriceStr.padStart(is80mm ? 12 : 9, ' ');
      const paddedTotal = totalStr.padStart(is80mm ? 12 : 9, ' ');

      encoded = encoded.line(`${shortName} ${paddedQty} ${paddedTotal}`);
      if (item.notes) {
        encoded = encoded.line(` * ${item.notes}`);
      }
    });

    // Totals Section
    const subtotal = order.subtotal || order.total || 0;
    const tax = order.tax || 0;
    const discount = order.discount !== undefined ? order.discount : (order.discountAmount || 0);
    const grandTotal = order.total || order.grandTotal || (subtotal - discount + tax);
    const cashReceived = order.cashReceived || grandTotal;
    const changeDue = order.changeDue || Math.max(0, cashReceived - grandTotal);
    const paymentMethod = (order.paymentMethod || 'TUNAI').toUpperCase();

    encoded = encoded
      .line(subDivider)
      .align('right')
      .line(`Subtotal: Rp ${Math.round(subtotal).toLocaleString('id-ID')}`);

    const voucherCode = order.voucher?.code || order.voucherCode;
    if (voucherCode) {
      encoded = encoded.line(`Voucher (${voucherCode}): -Rp ${Math.round(discount).toLocaleString('id-ID')}`);
    } else if (discount > 0) {
      encoded = encoded.line(`Diskon: -Rp ${Math.round(discount).toLocaleString('id-ID')}`);
    }
    if (tax > 0) {
      encoded = encoded.line(`Pajak: Rp ${Math.round(tax).toLocaleString('id-ID')}`);
    }

    encoded = encoded
      .bold(true)
      .line(`TOTAL: Rp ${Math.round(grandTotal).toLocaleString('id-ID')}`)
      .bold(false)
      .line(`Bayar (${paymentMethod}): Rp ${Math.round(cashReceived).toLocaleString('id-ID')}`)
      .line(`Kembali: Rp ${Math.round(changeDue).toLocaleString('id-ID')}`)
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
 */
export const printBluetoothKitchenTicket = async (
  order: any,
  target: 'kitchen' | 'bar',
  settings?: { storeName?: string; paperWidth?: '58mm' | '80mm' }
): Promise<void> => {
  try {
    const is80mm = settings?.paperWidth === '80mm' || localStorage.getItem('printer_paper_width') === '80mm';
    const lineWidth = is80mm ? 48 : 32;
    const divider = '='.repeat(lineWidth);
    const subDivider = '-'.repeat(lineWidth);

    const encoder = new EscPosEncoder();
    const isKitchen = target === 'kitchen';
    const title = isKitchen ? '*** TIKET DAPUR (MAKANAN) ***' : '*** TIKET BAR (MINUMAN) ***';

    // Filter items
    const allItems = order.items || [];
    const filterFn = isKitchen ? isKitchenItem : isBarItem;
    const filteredItems = allItems.filter(filterFn);
    
    // Jangan pernah fallback mencetak seluruh item! Jika tidak ada menu yang sesuai, beri peringatan
    if (filteredItems.length === 0) {
      throw new Error(`Pesanan ini tidak memiliki menu ${isKitchen ? 'makanan untuk Tiket Dapur' : 'minuman untuk Tiket Bar'}.`);
    }

    const { isDineIn, label: tableLabel } = formatOrderTableLabel(order);

    let encoded = encoder
      .initialize()
      .align('center')
      .line(divider)
      .bold(true)
      .line(title)
      .bold(false)
      .line(divider)
      .align('left')
      // TAMPILKAN NOMOR MEJA TEBAL & BESAR DI TIKET DAPUR
      .bold(true)
      .line(`${isDineIn ? 'MEJA     ' : 'TIPE     '}: ${tableLabel}`)
      .bold(false)
      .line(`No Order : ${order.orderNumber || `#${order.id}`}`)
      .line(`Waktu    : ${new Date(order.createdAt || Date.now()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} (${new Date(order.createdAt || Date.now()).toLocaleDateString('id-ID')})`)
      .line(`Pelayan  : ${order.user?.name || order.cashierName || 'Kasir'}`);

    if (order.customerName) {
      encoded = encoded.line(`Tamu     : ${order.customerName}`);
    }

    encoded = encoded
      .line(subDivider)
      .bold(true)
      .line(isKitchen ? 'DAFTAR PESANAN MAKANAN:' : 'DAFTAR PESANAN MINUMAN:')
      .bold(false);

    filteredItems.forEach((item: any) => {
      const productName = item.product?.name || item.productName || item.name || 'Item';
      const qty = item.quantity || item.qty || 1;
      
      encoded = encoded
        .bold(true)
        .line(`[${qty}x] ${productName}`)
        .bold(false);

      if (item.notes) {
        encoded = encoded.line(`   * Catatan: ${item.notes}`);
      }
    });

    encoded = encoded
      .line(divider)
      .align('center')
      .line(isKitchen ? 'Mohon segera diproses & disajikan!' : 'Sajikan dingin & segar!')
      .line('\n\n\n')
      .cut();

    const bytes = encoded.encode();
    await printRawBytes(bytes, 'kitchen');
  } catch (err: any) {
    console.error(`Error printing ${target} ticket via Bluetooth:`, err);
    throw err;
  }
};

/**
 * Print Work Order / SPK Bengkel Receipt to Bluetooth Thermal Printer (Struk Bengkel)
 */
export const printBluetoothBengkelWorkOrder = async (
  rawWorkOrder: any,
  settings: { name?: string; storeName?: string; address?: string; phone?: string; footer?: string; paperWidth?: '58mm' | '80mm' },
  options?: { autoKickDrawer?: boolean }
): Promise<void> => {
  try {
    const workOrder = rawWorkOrder?.order ? { ...rawWorkOrder.order, ...rawWorkOrder } : rawWorkOrder;
    const is80mm = settings.paperWidth === '80mm' || localStorage.getItem('printer_paper_width') === '80mm';
    const lineWidth = is80mm ? 48 : 32;
    const divider = '='.repeat(lineWidth);
    const subDivider = '-'.repeat(lineWidth);

    const encoder = new EscPosEncoder();
    const storeName = settings.storeName || settings.name || 'BENGKEL REPARASI RESMI';

    let encoded = encoder
      .initialize()
      .align('center')
      .bold(true)
      .line(storeName)
      .bold(false);

    if (settings.address) encoded = encoded.line(settings.address);
    if (settings.phone) encoded = encoded.line(`Telp/WA: ${settings.phone}`);

    const formatDate = (iso: string) => {
      if (!iso) return '-';
      return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const formatTime = (iso: string) => {
      if (!iso) return '-';
      return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    };
    const fmt = (n: number) => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;

    encoded = encoded
      .line(divider)
      .align('left')
      .line(`No. SPK   : ${workOrder.spkNumber || workOrder.id || '-'}`)
      .line(`Waktu     : ${formatDate(workOrder.createdAt)} ${formatTime(workOrder.createdAt)}`)
      .line(`Kasir     : ${workOrder.user?.name || workOrder.cashierName || 'Kasir'}`)
      .bold(true)
      .line(`No. Polisi: ${workOrder.vehiclePlate || 'WALK-IN'}`)
      .bold(false);

    if (workOrder.vehicleBrand || workOrder.vehicleModel) {
      encoded = encoded.line(`Kendaraan : ${[workOrder.vehicleBrand, workOrder.vehicleModel].filter(Boolean).join(' ')}`);
    }
    if (workOrder.odometer) {
      encoded = encoded.line(`Kilometer : ${workOrder.odometer.toLocaleString('id-ID')} km`);
    }
    if (workOrder.customerName) {
      encoded = encoded.line(`Konsumen  : ${workOrder.customerName}`);
    }
    if (workOrder.mechanicName) {
      encoded = encoded.line(`Mekanik   : ${workOrder.mechanicName}`);
    }

    // Jasa Servis
    if (workOrder.services && workOrder.services.length > 0) {
      encoded = encoded.line(subDivider).bold(true).line('[ JASA REPARASI & SERVIS ]').bold(false);
      workOrder.services.forEach((s: any) => {
        const name = s.serviceName || s.name || 'Jasa';
        const qty = s.qty || 1;
        const price = s.price || 0;
        const subtotal = s.subtotal || (qty * price);
        const qtyStr = `${qty}x${Math.round(price).toLocaleString('id-ID')}`;
        const totalStr = Math.round(subtotal).toLocaleString('id-ID');

        const maxNameLen = is80mm ? 24 : 14;
        const shortName = name.length > maxNameLen ? name.substring(0, maxNameLen) : name.padEnd(maxNameLen, ' ');
        const paddedQty = qtyStr.padStart(is80mm ? 12 : 9, ' ');
        const paddedTotal = totalStr.padStart(is80mm ? 12 : 9, ' ');

        encoded = encoded.line(`${shortName} ${paddedQty} ${paddedTotal}`);
      });
    }

    // Suku Cadang / Oli
    if (workOrder.parts && workOrder.parts.length > 0) {
      encoded = encoded.line(subDivider).bold(true).line('[ SUKU CADANG / OLI ]').bold(false);
      workOrder.parts.forEach((p: any) => {
        const name = p.partName || p.productName || p.name || 'Part';
        const qty = p.qty || 1;
        const price = p.price || 0;
        const subtotal = p.subtotal || (qty * price);
        const qtyStr = `${qty}x${Math.round(price).toLocaleString('id-ID')}`;
        const totalStr = Math.round(subtotal).toLocaleString('id-ID');

        const maxNameLen = is80mm ? 24 : 14;
        const shortName = name.length > maxNameLen ? name.substring(0, maxNameLen) : name.padEnd(maxNameLen, ' ');
        const paddedQty = qtyStr.padStart(is80mm ? 12 : 9, ' ');
        const paddedTotal = totalStr.padStart(is80mm ? 12 : 9, ' ');

        encoded = encoded.line(`${shortName} ${paddedQty} ${paddedTotal}`);
      });
    }

    // Totals
    const subtotal = (workOrder.totalServices || 0) + (workOrder.totalParts || 0);
    const discount = workOrder.discount || 0;
    const tax = workOrder.taxAmount || 0;
    const grandTotal = workOrder.totalAmount || (subtotal - discount + tax);
    const paidAmount = workOrder.paidAmount || grandTotal;
    const changeAmount = Math.max(0, paidAmount - grandTotal);
    const paymentMethod = (workOrder.paymentMethod || 'TUNAI').toUpperCase();

    encoded = encoded
      .line(subDivider)
      .align('right')
      .line(`Subtotal: ${fmt(subtotal)}`);

    if (discount > 0) encoded = encoded.line(`Diskon: -${fmt(discount)}`);
    if (tax > 0) encoded = encoded.line(`PPN: ${fmt(tax)}`);

    encoded = encoded
      .bold(true)
      .line(`TOTAL: ${fmt(grandTotal)}`)
      .bold(false)
      .line(`Bayar (${paymentMethod}): ${fmt(paidAmount)}`);

    if (changeAmount > 0) {
      encoded = encoded.line(`Kembali: ${fmt(changeAmount)}`);
    }
    if (paidAmount < grandTotal) {
      encoded = encoded.bold(true).line(`Sisa Piutang: ${fmt(grandTotal - paidAmount)}`).bold(false);
    }

    encoded = encoded
      .line(divider)
      .align('center')
      .bold(true)
      .line('GARANSI SERVIS 7 HARI KERJA')
      .bold(false)
      .line('Simpan struk ini sebagai bukti garansi.')
      .line(settings.footer || 'Terima Kasih Atas Kepercayaan Anda!')
      .line('\n\n\n')
      .cut();

    const bytes = encoded.encode();
    await printRawBytes(bytes, 'cashier');

    const shouldKick = options?.autoKickDrawer ?? (paymentMethod === 'TUNAI' || paymentMethod === 'CASH');
    if (shouldKick) {
      await kickCashDrawer();
    }
  } catch (err: any) {
    console.error('Error printing Bengkel work order via Bluetooth:', err);
    throw err;
  }
};

/**
 * Print Retail / Grosir Order Receipt to Bluetooth Thermal Printer (Struk Retail & Grosir)
 */
export const printBluetoothRetailReceipt = async (
  rawOrder: any,
  settings: { name?: string; storeName?: string; address?: string; phone?: string; footer?: string; paperWidth?: '58mm' | '80mm' },
  options?: { autoKickDrawer?: boolean }
): Promise<void> => {
  try {
    const order = rawOrder?.order ? { ...rawOrder.order, ...rawOrder } : rawOrder;
    const is80mm = settings.paperWidth === '80mm' || localStorage.getItem('printer_paper_width') === '80mm';
    const lineWidth = is80mm ? 48 : 32;
    const divider = '='.repeat(lineWidth);
    const subDivider = '-'.repeat(lineWidth);

    const encoder = new EscPosEncoder();
    const storeName = settings.storeName || settings.name || 'TOKO GROSIR & SEMBAKO';

    let encoded = encoder
      .initialize()
      .align('center')
      .bold(true)
      .line(storeName)
      .bold(false);

    if (settings.address) encoded = encoded.line(settings.address);
    if (settings.phone) encoded = encoded.line(`Telp/WA: ${settings.phone}`);

    const fmt = (n: number) => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;

    encoded = encoded
      .line(divider)
      .align('left')
      .line(`No Faktur : ${order.orderNumber || order.id || '-'}`)
      .line(`Tanggal   : ${new Date(order.paidAt || order.createdAt || Date.now()).toLocaleString('id-ID')}`)
      .line(`Kasir     : ${order.user?.name || order.cashierName || 'Kasir'}`)
      .line(`Pelanggan : ${order.customer?.name || order.customerName || 'Pelanggan Umum'}`);

    if (order.priceTier && order.priceTier !== 'UMUM') {
      encoded = encoded.line(`Tier Harga: ${order.priceTier}`);
    }

    encoded = encoded.line(subDivider);

    const items = order.items || [];
    items.forEach((item: any) => {
      const productName = item.productName || item.product?.name || item.name || 'Item';
      const qty = item.qty || item.quantity || 1;
      const uom = item.uomName ? ` ${item.uomName}` : '';
      const price = item.price || item.unitPrice || 0;
      const total = item.subtotal || (qty * price);

      const qtyPriceStr = `${qty}${uom}x${Math.round(price).toLocaleString('id-ID')}`;
      const totalStr = Math.round(total).toLocaleString('id-ID');

      const maxNameLen = is80mm ? 22 : 13;
      const shortName = productName.length > maxNameLen ? productName.substring(0, maxNameLen) : productName.padEnd(maxNameLen, ' ');
      const paddedQty = qtyPriceStr.padStart(is80mm ? 13 : 9, ' ');
      const paddedTotal = totalStr.padStart(is80mm ? 13 : 10, ' ');

      encoded = encoded.line(`${shortName} ${paddedQty} ${paddedTotal}`);
    });

    const subtotal = order.subtotal || order.total || 0;
    const discount = order.discount || order.discountAmount || 0;
    const tax = order.tax || order.taxAmount || 0;
    const grandTotal = order.total || order.grandTotal || (subtotal - discount + tax);
    const cashReceived = order.cashReceived || order.paidAmount || grandTotal;
    const changeDue = Math.max(0, cashReceived - grandTotal);
    const paymentMethod = (order.paymentMethod || 'TUNAI').toUpperCase();

    encoded = encoded
      .line(subDivider)
      .align('right')
      .line(`Subtotal: ${fmt(subtotal)}`);

    if (discount > 0) encoded = encoded.line(`Diskon: -${fmt(discount)}`);
    if (tax > 0) encoded = encoded.line(`PPN: ${fmt(tax)}`);

    encoded = encoded
      .bold(true)
      .line(`TOTAL: ${fmt(grandTotal)}`)
      .bold(false);

    if (paymentMethod === 'BON' || paymentMethod === 'TEMPO') {
      encoded = encoded
        .bold(true)
        .line('PEMBAYARAN: BON TEMPO (HUTANG)')
        .bold(false);
      if (order.dueDate) {
        encoded = encoded.line(`Jatuh Tempo: ${new Date(order.dueDate).toLocaleDateString('id-ID')}`);
      }
    } else {
      encoded = encoded
        .line(`Bayar (${paymentMethod}): ${fmt(cashReceived)}`)
        .line(`Kembali: ${fmt(changeDue)}`);
    }

    encoded = encoded
      .line(divider)
      .align('center')
      .line(settings.footer || 'Barang yang sudah dibeli tidak dapat ditukar.')
      .line('Terima Kasih Atas Kunjungan Anda!')
      .line('\n\n\n')
      .cut();

    const bytes = encoded.encode();
    await printRawBytes(bytes, 'cashier');

    const shouldKick = options?.autoKickDrawer ?? (paymentMethod === 'TUNAI' || paymentMethod === 'CASH');
    if (shouldKick) {
      await kickCashDrawer();
    }
  } catch (err: any) {
    console.error('Error printing Retail order via Bluetooth:', err);
    throw err;
  }
};

/**
 * Print Rental Busana Adat / Baju Bodo Receipt to Bluetooth Thermal Printer
 */
export const printBluetoothRentalOrder = async (
  rawOrder: any,
  settings: { name?: string; storeName?: string; address?: string; phone?: string; footer?: string; paperWidth?: '58mm' | '80mm' },
  options?: { autoKickDrawer?: boolean }
): Promise<void> => {
  try {
    const order = rawOrder?.order ? { ...rawOrder.order, ...rawOrder } : rawOrder;
    const is80mm = settings.paperWidth === '80mm' || localStorage.getItem('printer_paper_width') === '80mm';
    const lineWidth = is80mm ? 48 : 32;
    const divider = '='.repeat(lineWidth);
    const subDivider = '-'.repeat(lineWidth);

    const encoder = new EscPosEncoder();
    const storeName = settings.storeName || settings.name || 'SANGGAR SEWA BUSANA ADAT';

    let encoded = encoder
      .initialize()
      .align('center')
      .bold(true)
      .line(storeName)
      .bold(false);

    if (settings.address) encoded = encoded.line(settings.address);
    if (settings.phone) encoded = encoded.line(`Telp/WA: ${settings.phone}`);

    const formatDate = (iso: string) => {
      if (!iso) return '-';
      return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const fmt = (n: number) => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;

    encoded = encoded
      .line(divider)
      .align('left')
      .line(`No. Nota  : ${order.orderNumber || order.id || '-'}`)
      .line(`Tanggal   : ${formatDate(order.createdAt)}`)
      .line(`Penyewa   : ${order.customerName || 'Pelanggan'}`)
      .line(`No. HP    : ${order.customerPhone || '-'}`)
      .line(subDivider)
      .line(`Tgl Acara : ${formatDate(order.eventDate)}`)
      .line(`Tgl Ambil : ${formatDate(order.pickupDate)}`)
      .bold(true)
      .line(`Batas Kemb: ${formatDate(order.returnDeadline)}`)
      .bold(false);

    if (order.eventLocation) {
      encoded = encoded.line(`Lokasi    : ${order.eventLocation}`);
    }

    // Daftar Busana
    if (order.items && order.items.length > 0) {
      encoded = encoded.line(subDivider).bold(true).line('[ BUSANA & AKSESORIS ]').bold(false);
      order.items.forEach((it: any) => {
        const name = it.attireName || it.name || 'Baju Bodo';
        const price = it.price || 0;
        const totalStr = Math.round(price).toLocaleString('id-ID');
        const hanger = it.rackHangerCode ? ` [${it.rackHangerCode}]` : '';
        const sizeColor = [it.size, it.color].filter(Boolean).join('/');

        const maxNameLen = is80mm ? 26 : 16;
        const shortName = name.length > maxNameLen ? name.substring(0, maxNameLen) : name.padEnd(maxNameLen, ' ');
        const paddedTotal = totalStr.padStart(is80mm ? 14 : 10, ' ');

        encoded = encoded.line(`${shortName}${paddedTotal}`);
        if (hanger || sizeColor) {
          encoded = encoded.line(` > ${hanger} ${sizeColor}`.trim());
        }
      });
    }

    // Fitting Notes
    if (order.fittingNotes) {
      encoded = encoded.line(subDivider).line(`Catatan: ${order.fittingNotes}`);
    }

    const subtotal = order.rentalSubtotal || order.subtotal || 0;
    const discount = order.discount || 0;
    const deposit = order.depositAmount || 0;
    const paid = order.paidAmount || 0;
    const total = order.totalAmount || (subtotal - discount);
    const sisa = Math.max(0, total - paid);

    encoded = encoded
      .line(subDivider)
      .align('right')
      .line(`Subtotal Sewa: ${fmt(subtotal)}`);

    if (discount > 0) encoded = encoded.line(`Diskon: -${fmt(discount)}`);
    encoded = encoded.bold(true).line(`TOTAL SEWA: ${fmt(total)}`).bold(false);

    if (deposit > 0) {
      encoded = encoded.line(`Uang Jaminan (Deposit): ${fmt(deposit)}`);
    }

    encoded = encoded
      .line(`Uang Muka (DP) Dibayar: ${fmt(paid)}`)
      .bold(true)
      .line(`Sisa Pelunasan: ${fmt(sisa)}`)
      .bold(false);

    encoded = encoded
      .line(divider)
      .align('center')
      .line('KETENTUAN SEWA:')
      .line('1. Maksimal sewa 3 hari kerja.')
      .line('2. Jangan cuci baju sendiri (sutera).')
      .line('3. Aksesoris wajib kembali lengkap.')
      .line('4. Deposit kembali saat barang OK.')
      .line('--------------------------------')
      .line(settings.footer || 'Terima kasih telah mempercayai kami!')
      .line('\n\n\n')
      .cut();

    const bytes = encoded.encode();
    await printRawBytes(bytes, 'cashier');

    if (options?.autoKickDrawer) {
      await kickCashDrawer();
    }
  } catch (err: any) {
    console.error('Error printing Rental order via Bluetooth:', err);
    throw err;
  }
};


