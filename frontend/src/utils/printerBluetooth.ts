import EscPosEncoder from 'esc-pos-encoder';

export interface BluetoothDevice {
  name: string;
  id: string; // MAC address
  address?: string;
  class?: number;
}

export const getBluetoothSerial = (): any => {
  return (window as any).bluetoothSerial || null;
};

export const isNativeMobile = (): boolean => {
  return !!(window as any).cordova || !!(window as any).Capacitor?.isNativePlatform();
};

export const listPairedBluetoothDevices = (): Promise<BluetoothDevice[]> => {
  return new Promise((resolve, reject) => {
    const bt = getBluetoothSerial();
    if (!bt) {
      reject(new Error('Bluetooth serial plugin tidak tersedia. Pastikan aplikasi berjalan di perangkat native Android/iOS.'));
      return;
    }

    bt.list(
      (devices: BluetoothDevice[]) => {
        resolve(devices);
      },
      (err: any) => {
        reject(new Error(err || 'Gagal memindai perangkat Bluetooth'));
      }
    );
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
      () => {
        resolve();
      },
      (err: any) => {
        reject(new Error(err || 'Koneksi printer Bluetooth gagal'));
      }
    );
  });
};

export const disconnectBluetoothPrinter = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const bt = getBluetoothSerial();
    if (!bt) {
      resolve();
      return;
    }

    bt.disconnect(
      () => {
        resolve();
      },
      (err: any) => {
        reject(new Error(err || 'Gagal memutus koneksi printer'));
      }
    );
  });
};

export const printRawBytes = (bytes: Uint8Array): Promise<void> => {
  return new Promise((resolve, reject) => {
    const bt = getBluetoothSerial();
    if (!bt) {
      reject(new Error('Bluetooth serial tidak terhubung.'));
      return;
    }

    bt.write(
      bytes.buffer,
      () => {
        resolve();
      },
      (err: any) => {
        reject(new Error(err || 'Gagal mengirim data cetak ke printer'));
      }
    );
  });
};

export const printBluetoothReceipt = async (order: any, settings: { name: string; address: string; footer: string }): Promise<void> => {
  try {
    const encoder = new EscPosEncoder();
    
    // Header
    let encoded = encoder
      .initialize()
      .align('center')
      .line(settings.name)
      .line(settings.address)
      .line('--------------------------------')
      .align('left')
      .line(`No: ${order.orderNumber}`)
      .line(`Tgl: ${new Date(order.createdAt).toLocaleString()}`)
      .line(`Kasir: ${order.user?.name || 'Kasir'}`)
      .line(`Meja: ${order.tableName || 'Meja'}`)
      .line('--------------------------------');

    // Items
    order.items.forEach((item: any) => {
      const name = item.productName || item.product?.name || '';
      const qty = item.quantity;
      const price = item.price;
      const total = qty * price;

      // Format name: max 16 chars, then Qty & Price on right
      const qtyPriceStr = `${qty}x${(price / 1000).toFixed(0)}k`;
      const totalStr = `${(total / 1000).toFixed(0)}k`;
      
      // Calculate spaces for 32 chars line width
      const spaceCount = 32 - name.substring(0, 16).length - qtyPriceStr.length - totalStr.length - 2;
      const spaces = ' '.repeat(spaceCount > 0 ? spaceCount : 1);
      
      encoded = encoded.line(`${name.substring(0, 16)}${spaces}${qtyPriceStr} ${totalStr}`);
      if (item.notes) {
        encoded = encoded.line(` * ${item.notes}`);
      }
    });

    // Totals
    encoded = encoded
      .line('--------------------------------')
      .align('right')
      .line(`Subtotal: Rp ${order.subtotal?.toLocaleString() || order.total?.toLocaleString()}`)
      .line(`Pajak: Rp ${order.tax?.toLocaleString() || '0'}`)
      .line(`Total: Rp ${order.total?.toLocaleString()}`)
      .line(`Bayar (${order.paymentMethod}): Rp ${order.cashReceived?.toLocaleString() || order.total?.toLocaleString()}`)
      .line(`Kembali: Rp ${(order.changeDue || 0).toLocaleString()}`)
      .line('--------------------------------')
      .align('center')
      .line(settings.footer)
      .line('\n\n\n')
      .cut();

    const bytes = encoded.encode();
    await printRawBytes(bytes);
  } catch (err) {
    console.error('Error printing receipt via Bluetooth:', err);
    throw err;
  }
};
