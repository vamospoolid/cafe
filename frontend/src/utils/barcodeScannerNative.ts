import { getCapacitor } from './kioskNative';

export const isNativePlatform = (): boolean => {
  return !!getCapacitor()?.isNativePlatform();
};

export const startNativeBarcodeScan = async (): Promise<string> => {
  if (!isNativePlatform()) {
    throw new Error('Barcode scanning native hanya tersedia di perangkat mobile.');
  }

  try {
    // Dynamically import Capacitor ML Kit to prevent issues in pure web environment
    const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
    
    // Check permission
    const status = await BarcodeScanner.checkPermissions();
    if (status.camera !== 'granted') {
      const requestStatus = await BarcodeScanner.requestPermissions();
      if (requestStatus.camera !== 'granted') {
        throw new Error('Izin kamera ditolak.');
      }
    }

    // Launch scan interface
    const { barcodes } = await BarcodeScanner.scan();
    if (barcodes && barcodes.length > 0) {
      return barcodes[0].rawValue || barcodes[0].displayValue || '';
    }
    throw new Error('Tidak ada barcode terdeteksi.');
  } catch (err: any) {
    console.error('Error in barcode scanning:', err);
    throw err;
  }
};
