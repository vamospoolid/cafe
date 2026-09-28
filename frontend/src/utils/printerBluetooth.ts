import EscPosEncoder from 'esc-pos-encoder';

export interface BluetoothDeviceInfo {
  id: string;
  name: string;
  type: 'WEB_BLUETOOTH' | 'CORDOVA_SERIAL';
  address?: string;
}

// In-memory reference for Web Bluetooth device instance
let activeWebBluetoothDevice: any = null;

// Common thermal printer Bluetooth Low Energy (BLE) / GATT Service UUIDs
export const COMMON_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard ESC/POS printer service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent UART (very common in 58mm/80mm mini POS)
  '0000e781-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
  '0000fff0-0000-1000-8000-00805f9b34fb', // Generic POS
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile
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

export const getSavedBluetoothPrinter = (): BluetoothDeviceInfo | null => {
  const id = localStorage.getItem('bluetooth_printer_id') || localStorage.getItem('bluetooth_printer_mac');
  const name = localStorage.getItem('bluetooth_printer_name') || 'Printer Bluetooth';
  const type = (localStorage.getItem('bluetooth_printer_type') as any) || (isWebBluetoothSupported() ? 'WEB_BLUETOOTH' : 'CORDOVA_SERIAL');
  
  if (!id) return null;
  return { id, name, type };
};

export const clearSavedBluetoothPrinter = () => {
  localStorage.removeItem('bluetooth_printer_id');
  localStorage.removeItem('bluetooth_printer_name');
  localStorage.removeItem('bluetooth_printer_mac');
  localStorage.removeItem('bluetooth_printer_type');
  if (activeWebBluetoothDevice && activeWebBluetoothDevice.gatt?.connected) {
    try {
      activeWebBluetoothDevice.gatt.disconnect();
    } catch {
      // ignore
    }
  }
  activeWebBluetoothDevice = null;
};

/**
 * Request pair via Web Bluetooth API (Chrome Android / Windows / Mac)
 */
export const pairWebBluetoothPrinter = async (): Promise<BluetoothDeviceInfo> => {
  if (!isWebBluetoothSupported()) {
    throw new Error('Browser ini tidak mendukung Web Bluetooth. Pastikan Anda menggunakan Google Chrome pada Android/Windows/Mac melalui HTTPS.');
  }

  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: COMMON_PRINTER_SERVICES
    });

    activeWebBluetoothDevice = device;
    const info: BluetoothDeviceInfo = {
      id: device.id,
      name: device.name || 'Thermal Printer',
      type: 'WEB_BLUETOOTH'
    };

    localStorage.setItem('bluetooth_printer_id', device.id);
    localStorage.setItem('bluetooth_printer_name', info.name);
    localStorage.setItem('bluetooth_printer_type', 'WEB_BLUETOOTH');
    localStorage.setItem('bluetooth_printer_mac', device.id); // for backwards compat

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

  let server = device.gatt;
  if (!server?.connected) {
    server = await device.gatt.connect();
  }

  // Find any primary service that has a writable characteristic
  let writeChar: any = null;
  
  // Try searching through known common services first
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
      // Continue to next service
    }
  }

  // If not found in known list, discover all primary services
  if (!writeChar) {
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
          // ignore
        }
      }
    } catch (e: any) {
      console.warn('Could not list all primary services:', e);
    }
  }

  if (!writeChar) {
    throw new Error('Tidak dapat menemukan characteristic cetak pada printer Bluetooth ini.');
  }

  // Send bytes in safe chunks (MTU safe: 80 bytes)
  const chunkSize = 80;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    if (writeChar.properties.writeWithoutResponse) {
      await writeChar.writeValueWithoutResponse(chunk);
    } else {
      await writeChar.writeValue(chunk);
    }
    // Small delay to let thermal printer buffer process
    await new Promise(res => setTimeout(res, 20));
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

export const printRawBytes = async (bytes: Uint8Array): Promise<void> => {
  // 1. Web Bluetooth (Chrome Desktop / Android HTTPS)
  if (isWebBluetoothSupported() && (activeWebBluetoothDevice || localStorage.getItem('bluetooth_printer_type') === 'WEB_BLUETOOTH')) {
    if (!activeWebBluetoothDevice) {
      activeWebBluetoothDevice = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: COMMON_PRINTER_SERVICES
      });
    }
    await sendBytesWebBluetooth(activeWebBluetoothDevice, bytes);
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

    // B. Periksa status koneksi socket, lakukan silent auto-reconnect jika perlu
    const connected = await isBluetoothConnected();
    if (!connected) {
      const savedMac = localStorage.getItem('bluetooth_printer_mac') || localStorage.getItem('bluetooth_printer_id');
      if (savedMac) {
        try {
          await connectBluetoothPrinter(savedMac);
        } catch (connErr) {
          console.warn('[Printer] Auto-reconnect gagal, mencoba write langsung:', connErr);
        }
      }
    }

    return new Promise((resolve, reject) => {
      bt.write(
        bytes.buffer,
        () => resolve(),
        async (err: any) => {
          console.warn('[Printer] Write pertama gagal, mencoba reconnect:', err);
          try {
            const savedMac = localStorage.getItem('bluetooth_printer_mac') || localStorage.getItem('bluetooth_printer_id');
            if (savedMac) {
              await connectBluetoothPrinter(savedMac);
              bt.write(
                bytes.buffer, 
                () => resolve(), 
                (retryErr: any) => reject(new Error(retryErr || 'Gagal mengirim data cetak ke printer Bluetooth'))
              );
              return;
            }
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

  throw new Error('Tidak ada modul printer yang aktif. Silakan hubungkan printer Bluetooth atau USB di menu Pengaturan.');
};

/**
 * Test Print Function
 */
export const testPrintBluetooth = async (): Promise<void> => {
  const encoder = new EscPosEncoder();
  const bytes = encoder
    .initialize()
    .align('center')
    .line('================================')
    .bold(true)
    .line('STRUK UJI COBA PRINTER')
    .bold(false)
    .line('TEST PRINT BLUETOOTH OK')
    .line('================================')
    .align('left')
    .line(`Waktu  : ${new Date().toLocaleString('id-ID')}`)
    .line('Koneksi: Web Bluetooth / Serial')
    .line('Status : Berhasil Terhubung!')
    .line('--------------------------------')
    .align('center')
    .line('Printer Siap Digunakan')
    .line('\n\n\n')
    .cut()
    .encode();

  await printRawBytes(bytes);
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
 * Print Order Receipt to Bluetooth Thermal Printer
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
    
    // Header
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

    encoded = encoded
      .line(divider)
      .align('left')
      .line(`No Struk : ${order.orderNumber || order.id}`)
      .line(`Tanggal  : ${new Date(order.createdAt || Date.now()).toLocaleString('id-ID')}`)
      .line(`Kasir    : ${order.user?.name || order.cashierName || 'Kasir'}`)
      .line(`Meja     : ${order.tableName || order.table?.name || 'Take Away'}`)
      .line(`Pesanan  : ${order.customerName ? order.customerName : '-'}`)
      .line(subDivider);

    // Items list (formatted for 32 chars 58mm or 48 chars 80mm)
    const items = order.items || [];
    items.forEach((item: any) => {
      const productName = item.product?.name || item.productName || item.name || 'Item';
      const qty = item.quantity || item.qty || 1;
      const price = item.price || item.unitPrice || 0;
      const total = item.subtotal || (qty * price);

      const qtyPriceStr = `${qty}x${Math.round(price).toLocaleString('id-ID')}`;
      const totalStr = Math.round(total).toLocaleString('id-ID');
      
      // Calculate layout spaces based on 58mm vs 80mm
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
    const discount = order.discountAmount || 0;
    const grandTotal = order.total || order.grandTotal || subtotal;
    const cashReceived = order.cashReceived || grandTotal;
    const changeDue = order.changeDue || Math.max(0, cashReceived - grandTotal);
    const paymentMethod = (order.paymentMethod || 'TUNAI').toUpperCase();

    encoded = encoded
      .line(subDivider)
      .align('right')
      .line(`Subtotal: Rp ${Math.round(subtotal).toLocaleString('id-ID')}`);

    if (discount > 0) {
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
    await printRawBytes(bytes);

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

