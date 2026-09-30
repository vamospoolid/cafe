import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  getSavedBluetoothPrinter,
  printBluetoothReceipt,
  COMMON_PRINTER_SERVICES,
  isWebBluetoothSupported,
  connectGattWithRetry,
  setActiveWebBluetoothDevice
} from '../utils/printerBluetooth';
import { POSContext } from './POSContext';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PrinterStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error' | 'printing';

export interface DetectedPrinterInfo {
  name: string;
  brand: string;        // 'Rongta' | 'Xprinter' | 'HPRT' | 'Bixolon' | 'Generic'
  model: string;        // dari Device Information 0x180A jika tersedia
  serviceUUID: string;
  writeCharUUID: string;
  paperWidth: 58 | 80;
}

interface PrinterContextValue {
  status: PrinterStatus;
  printerInfo: DetectedPrinterInfo | null;
  lastError: string | null;
  printReceipt: (order: any) => Promise<void>;
  reconnect: () => Promise<void>;
  disconnect: () => void;
}

// ─── UUID → Brand Map ─────────────────────────────────────────────────────────

const UUID_BRAND_MAP: Record<string, { brand: string; writeCharUUID: string }> = {
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2': { brand: 'Rongta',  writeCharUUID: 'bef8d6c9-9c21-4c9e-b632-bd1c4ab6b21c' },
  '49535343-fe7d-4ae5-8fa9-9fafd205e455': { brand: 'Generic ESC/POS (ISSC)', writeCharUUID: '49535343-8841-43f4-a8d4-ecbe34729bb3' },
  '0000fee7-0000-1000-8000-00805f9b34fb': { brand: 'HPRT',    writeCharUUID: '0000fee8-0000-1000-8000-00805f9b34fb' },
  '0000ff00-0000-1000-8000-00805f9b34fb': { brand: 'Xprinter / Bixolon', writeCharUUID: '0000ff02-0000-1000-8000-00805f9b34fb' },
  '0000ffe0-0000-1000-8000-00805f9b34fb': { brand: 'Generic (HM-10)',   writeCharUUID: '0000ffe1-0000-1000-8000-00805f9b34fb' },
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e': { brand: 'Generic (NUS)',     writeCharUUID: '6e400002-b5a3-f393-e0a9-e50e24dcca9e' },
  '000018f0-0000-1000-8000-00805f9b34fb': { brand: 'Star Micronics',    writeCharUUID: '00002af1-0000-1000-8000-00805f9b34fb' },
};

const DEVICE_INFO_SERVICE = '0000180a-0000-1000-8000-00805f9b34fb';
const MANUFACTURER_CHAR    = '00002a29-0000-1000-8000-00805f9b34fb';
const MODEL_NUMBER_CHAR    = '00002a24-0000-1000-8000-00805f9b34fb';

// ─── Context ──────────────────────────────────────────────────────────────────

export const PrinterContext = createContext<PrinterContextValue>({
  status: 'idle',
  printerInfo: null,
  lastError: null,
  printReceipt: async () => {},
  reconnect: async () => {},
  disconnect: () => {},
});

export const usePrinter = () => useContext(PrinterContext);

// ─── Detect Brand from GATT ───────────────────────────────────────────────────

async function detectPrinterBrand(gattServer: any): Promise<{ brand: string; model: string; serviceUUID: string; writeCharUUID: string }> {
  let brand = 'Generic ESC/POS';
  let model = '';
  let serviceUUID = '';
  let writeCharUUID = '';

  try {
    const services = await gattServer.getPrimaryServices();
    const serviceUuids = services.map((s: any) => s.uuid.toLowerCase());

    // 1. Coba baca Device Information Service 0x180A jika ada
    const infoService = services.find((s: any) => s.uuid.toLowerCase() === DEVICE_INFO_SERVICE.toLowerCase());
    if (infoService) {
      try {
        const mfChar = await infoService.getCharacteristic(MANUFACTURER_CHAR);
        const mfVal = await mfChar.readValue();
        brand = new TextDecoder().decode(mfVal).trim();
      } catch { /* ignore */ }
      try {
        const modelChar = await infoService.getCharacteristic(MODEL_NUMBER_CHAR);
        const modelVal = await modelChar.readValue();
        model = new TextDecoder().decode(modelVal).trim();
      } catch { /* ignore */ }
    }

    // 2. Match UUID dengan tabel known brands (in-memory)
    for (const [uuid, info] of Object.entries(UUID_BRAND_MAP)) {
      if (serviceUuids.includes(uuid.toLowerCase())) {
        if (!brand || brand === 'Generic ESC/POS') {
          brand = info.brand;
        }
        serviceUUID = uuid;
        writeCharUUID = info.writeCharUUID;
        break;
      }
    }

    // 3. Fallback: scan characteristic write jika belum ketemu
    if (!writeCharUUID) {
      for (const svc of services) {
        try {
          const chars = await svc.getCharacteristics();
          const writeable = chars.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
          if (writeable) {
            serviceUUID = svc.uuid;
            writeCharUUID = writeable.uuid;
            break;
          }
        } catch { /* skip */ }
      }
    }
  } catch (err) {
    console.warn('[detectPrinterBrand] Service discovery warning:', err);
  }

  return { brand, model, serviceUUID, writeCharUUID };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const PrinterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const posContext = useContext(POSContext);
  const [status, setStatus] = useState<PrinterStatus>('idle');
  const [printerInfo, setPrinterInfo] = useState<DetectedPrinterInfo | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const deviceRef = useRef<any>(null);

  // ─── Auto-reconnect: Opsi B (watchAdvertisements + getDevices) ─────────────
  // Cara kerja:
  //   1. Panggil navigator.bluetooth.getDevices() untuk mendapat device yang sudah di-grant
  //   2. Panggil device.watchAdvertisements() agar browser "mendengarkan" sinyal BLE printer
  //   3. Saat printer menyala & mengirim iklan BLE → event advertisementreceived terpicu
  //   4. Koneksi GATT dibuka otomatis → printer tersambung tanpa user klik apapun
  const reconnect = useCallback(async () => {
    const saved = getSavedBluetoothPrinter();
    if (!saved || !isWebBluetoothSupported()) return;

    const bt = (navigator as any).bluetooth;
    if (!bt) return;

    try {
      setStatus('connecting');
      setLastError(null);

      // ── Langkah 1: Ambil device yang sudah pernah di-grant permission ──
      let device: any = null;
      if (bt.getDevices) {
        const granted = await bt.getDevices();
        device = granted.find((d: any) => d.id === saved.id || d.name === saved.name)
               || granted[0]
               || null;
      }

      if (!device) {
        // Belum ada device yang di-grant — perlu scan manual sekali
        setStatus('disconnected');
        setLastError('Printer belum pernah dipasangkan di browser ini. Silakan scan printer dari Pengaturan.');
        return;
      }

      deviceRef.current = device;
      setActiveWebBluetoothDevice(device);

      // ── Langkah 2: Coba connect langsung dulu (jika printer sudah menyala) ──
      if (device.gatt?.connected) {
        // Sudah terkoneksi (misal tab tidak di-reload)
        const gatt = device.gatt;
        const detected = await detectPrinterBrand(gatt);
        const paperWidth = (localStorage.getItem('printer_paper_width') === '80mm' ? 80 : 58) as 58 | 80;
        setPrinterInfo({ name: device.name || saved.name, brand: detected.brand, model: detected.model, serviceUUID: detected.serviceUUID, writeCharUUID: detected.writeCharUUID, paperWidth });
        setStatus('connected');
        return;
      }

      try {
        const gatt = await connectGattWithRetry(device, 2);
        const detected = await detectPrinterBrand(gatt);
        const paperWidth = (localStorage.getItem('printer_paper_width') === '80mm' ? 80 : 58) as 58 | 80;
        setPrinterInfo({
          name: device.name || saved.name,
          brand: detected.brand,
          model: detected.model,
          serviceUUID: detected.serviceUUID,
          writeCharUUID: detected.writeCharUUID,
          paperWidth,
        });
        setStatus('connected');

        device.addEventListener('gattserverdisconnected', () => {
          setStatus('disconnected');
        });
        return;
      } catch {
        // Printer belum menyala / belum dalam jangkauan — pakai watchAdvertisements
      }

      // ── Langkah 3: watchAdvertisements — auto-connect saat printer menyala ──
      if (device.watchAdvertisements) {
        setStatus('disconnected'); // Tampilkan status menunggu
        setLastError('Menunggu printer menyala… Koneksi otomatis saat printer terdeteksi.');

        // Hentikan watch lama jika ada
        try { device.unwatchAdvertisements?.(); } catch { /* ignore */ }

        device.watchAdvertisements();

        const onAdvert = async () => {
          device.removeEventListener('advertisementreceived', onAdvert);
          try { device.unwatchAdvertisements?.(); } catch { /* ignore */ }

          try {
            setStatus('connecting');
            setLastError(null);
            const gatt = await connectGattWithRetry(device, 3);
            const detected = await detectPrinterBrand(gatt);
            const paperWidth = (localStorage.getItem('printer_paper_width') === '80mm' ? 80 : 58) as 58 | 80;
            setPrinterInfo({
              name: device.name || saved.name,
              brand: detected.brand,
              model: detected.model,
              serviceUUID: detected.serviceUUID,
              writeCharUUID: detected.writeCharUUID,
              paperWidth,
            });
            setStatus('connected');
            setLastError(null);

            device.addEventListener('gattserverdisconnected', () => {
              setStatus('disconnected');
            });
          } catch (err: any) {
            setStatus('error');
            setLastError('Gagal konek setelah printer terdeteksi: ' + err.message);
          }
        };

        device.addEventListener('advertisementreceived', onAdvert);
        return;
      }

      // ── Fallback: browser tidak mendukung watchAdvertisements ──
      setStatus('disconnected');
      setLastError('Printer tidak terjangkau. Pastikan printer sudah menyala.');

    } catch (err: any) {
      console.warn('[PrinterContext] Auto-reconnect gagal:', err.message);
      setStatus('disconnected');
    }
  }, []);

  // Auto-reconnect saat provider mount (hanya jika ada printer tersimpan)
  useEffect(() => {
    const saved = getSavedBluetoothPrinter();
    if (saved && isWebBluetoothSupported()) {
      // Delay kecil agar browser siap
      const timer = setTimeout(() => reconnect(), 1500);
      return () => clearTimeout(timer);
    }
  }, [reconnect]);

  const disconnect = useCallback(() => {
    try {
      if (deviceRef.current?.gatt?.connected) {
        deviceRef.current.gatt.disconnect();
      }
    } catch { /* ignore */ }
    deviceRef.current = null;
    setActiveWebBluetoothDevice(null);
    setStatus('disconnected');
    setPrinterInfo(null);
  }, []);

  const printReceipt = useCallback(async (order: any) => {
    const settings = posContext?.settings;
    if (!settings) throw new Error('Settings tidak tersedia');

    setStatus('printing');
    try {
      await printBluetoothReceipt(order, {
        name: settings.storeName || 'Kasir',
        address: settings.address,
        phone: settings.phone,
        footer: settings.receiptFooter,
        paperWidth: printerInfo?.paperWidth === 80 ? '80mm' : '58mm',
      }, {
        autoKickDrawer: true,
      });
      setStatus('connected');
    } catch (err: any) {
      setStatus('error');
      setLastError(err.message);
      throw err;
    }
  }, [posContext?.settings, printerInfo]);

  return (
    <PrinterContext.Provider value={{ status, printerInfo, lastError, printReceipt, reconnect, disconnect }}>
      {children}
    </PrinterContext.Provider>
  );
};
