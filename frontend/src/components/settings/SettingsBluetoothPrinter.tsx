import React, { useState, useEffect, useContext } from 'react';
import {
  Printer,
  BluetoothSearching,
  BluetoothConnected,
  BluetoothOff,
  Bluetooth,
  Check,
  Info,
  Usb,
  Zap,
  RefreshCw,
  Trash2,
  ChevronDown,
  Wifi,
} from 'lucide-react';
import { toast } from '../../utils/alert';
import {
  isWebBluetoothSupported,
  isNativeMobile,
  isWebUsbSupported,
  pairWebUsbPrinter,
  pairWebBluetoothPrinter,
  getSavedBluetoothPrinter,
  clearSavedBluetoothPrinter,
  testPrintBluetooth,
  listPairedBluetoothDevices,
  connectBluetoothPrinter,
  disconnectBluetoothPrinter
} from '../../utils/printerBluetooth';
import { usePrinter } from '../../context/PrinterContext';

// â”€â”€â”€ Brand Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PRINTER_BRANDS = [
  {
    key: 'AUTO',
    label: 'Auto-Detect (Disarankan)',
    description: 'Sistem mengenali jenis printer otomatis',
    models: '',
    icon: 'ðŸ”',
  },
  {
    key: 'RONGTA',
    label: 'Rongta',
    description: 'RPP02N, RPP300, RPP02B, RPP320',
    models: 'RPP02N, RPP300',
    icon: 'ðŸ–¨ï¸',
  },
  {
    key: 'XPRINTER',
    label: 'Xprinter',
    description: 'XP-P300, XP-58, XP-80, XP-T81',
    models: 'XP-P300, XP-58',
    icon: 'ðŸ–¨ï¸',
  },
  {
    key: 'HPRT',
    label: 'HPRT',
    description: 'HM-E200, HM-E300, HPRT-58',
    models: 'HM-E200, HM-E300',
    icon: 'ðŸ–¨ï¸',
  },
  {
    key: 'BIXOLON',
    label: 'Bixolon',
    description: 'SPP-R200, SPP-R210, SPP-R300',
    models: 'SPP-R200',
    icon: 'ðŸ–¨ï¸',
  },
  {
    key: 'GENERIC',
    label: 'Generic / Lainnya',
    description: 'Mini POS 58mm/80mm, Iware, PT-210, dan lainnya',
    models: '',
    icon: 'ðŸ–¨ï¸',
  },
];

// â”€â”€â”€ Status Badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const StatusBadge = ({ status, lastError }: { status: string; lastError?: string | null }) => {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    connected:    { label: 'Terhubung',              cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500 animate-pulse' },
    connecting:   { label: 'Menghubungkan...',        cls: 'bg-amber-100 text-amber-800 border-amber-200',   dot: 'bg-amber-500 animate-spin' },
    printing:     { label: 'Mencetak...',             cls: 'bg-indigo-100 text-indigo-800 border-indigo-200', dot: 'bg-indigo-500 animate-pulse' },
    disconnected: { label: lastError?.includes('Menunggu') ? 'Menunggu Printerâ€¦' : 'Terputus',
                    cls: lastError?.includes('Menunggu') ? 'bg-sky-100 text-sky-700 border-sky-200' : 'bg-slate-100 text-slate-600 border-slate-200',
                    dot: lastError?.includes('Menunggu') ? 'bg-sky-400 animate-pulse' : 'bg-slate-400' },
    error:        { label: 'Error',                  cls: 'bg-rose-100 text-rose-700 border-rose-200',        dot: 'bg-rose-500' },
    idle:         { label: 'Belum dikonfigurasi',     cls: 'bg-slate-100 text-slate-500 border-slate-200',    dot: 'bg-slate-300' },
  };
  const s = map[status] || map.idle;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${s.cls}`}>
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
};

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const SettingsBluetoothPrinter: React.FC = () => {
  const printer = usePrinter();
  const [savedPrinter, setSavedPrinter] = useState<any>(getSavedBluetoothPrinter());
  const [nativeDevices, setNativeDevices] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [connectingUsb, setConnectingUsb] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState(() => localStorage.getItem('printer_brand') || 'AUTO');
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>(() => (localStorage.getItem('printer_paper_width') as any) || '58mm');
  const [autoConnect, setAutoConnect] = useState(() => localStorage.getItem('printer_auto_connect') !== 'false');
  const [showBrandMenu, setShowBrandMenu] = useState(false);

  const isWebBt = isWebBluetoothSupported();
  const isNative = isNativeMobile();
  const isUsb = isWebUsbSupported();

  const handlePairWebBluetooth = async () => {
    setScanning(true);
    try {
      const paired = await pairWebBluetoothPrinter();
      setSavedPrinter(paired);
      localStorage.setItem('printer_brand', selectedBrand);
      localStorage.setItem('printer_paper_width', paperWidth);
      localStorage.setItem('printer_auto_connect', autoConnect ? 'true' : 'false');
      toast(`âœ… Printer "${paired.name}" berhasil disambungkan!`, 'success');
      // Trigger auto-reconnect di context
      setTimeout(() => printer.reconnect(), 500);
    } catch (err: any) {
      toast(err.message || 'Gagal memindai printer Bluetooth', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleScanNative = async () => {
    setScanning(true);
    try {
      const list = await listPairedBluetoothDevices();
      setNativeDevices(list);
      if (list.length === 0) toast('Tidak ada perangkat Bluetooth yang sudah dipasangkan.', 'warning');
      else toast(`Menemukan ${list.length} perangkat Bluetooth.`, 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal memindai Bluetooth', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleSelectNativePrinter = async (device: any) => {
    setConnecting(true);
    try {
      await connectBluetoothPrinter(device.id);
      await disconnectBluetoothPrinter();
      localStorage.setItem('bluetooth_printer_id', device.id);
      localStorage.setItem('bluetooth_printer_name', device.name || 'Printer Bluetooth');
      localStorage.setItem('bluetooth_printer_type', 'CORDOVA_SERIAL');
      localStorage.setItem('bluetooth_printer_mac', device.id);
      setSavedPrinter({ id: device.id, name: device.name || 'Printer Bluetooth', type: 'CORDOVA_SERIAL' });
      toast('Printer Bluetooth berhasil terhubung!', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal terhubung ke printer', 'error');
    } finally {
      setConnecting(false);
    }
  };

  const handleTestPrint = async () => {
    if (!savedPrinter) {
      toast('Belum ada printer yang tersambung', 'warning');
      return;
    }
    setPrinting(true);
    try {
      await testPrintBluetooth();
      toast('âœ… Struk tes berhasil dicetak!', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal tes cetak. Pastikan printer nyala.', 'error');
    } finally {
      setPrinting(false);
    }
  };

  const handlePairUsb = async () => {
    setConnectingUsb(true);
    try {
      const dev = await pairWebUsbPrinter();
      setSavedPrinter({ id: 'USB-DIRECT', name: dev.productName || 'USB Thermal Printer', type: 'USB_DIRECT' });
      toast(`âœ… Printer USB "${dev.productName || 'Thermal'}" terhubung!`, 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal menyambungkan printer USB.', 'error');
    } finally {
      setConnectingUsb(false);
    }
  };

  const handleDisconnect = () => {
    clearSavedBluetoothPrinter();
    localStorage.removeItem('usb_printer_saved');
    localStorage.removeItem('usb_printer_name');
    printer.disconnect();
    setSavedPrinter(null);
    toast('Koneksi printer diputus.', 'info');
  };

  const handleSaveBrand = (key: string) => {
    setSelectedBrand(key);
    localStorage.setItem('printer_brand', key);
    setShowBrandMenu(false);
    toast(`Brand printer diset ke: ${PRINTER_BRANDS.find(b => b.key === key)?.label}`, 'info');
  };

  const handlePaperWidthChange = (w: '58mm' | '80mm') => {
    setPaperWidth(w);
    localStorage.setItem('printer_paper_width', w);
  };

  const handleAutoConnectChange = (v: boolean) => {
    setAutoConnect(v);
    localStorage.setItem('printer_auto_connect', v ? 'true' : 'false');
  };

  const selectedBrandInfo = PRINTER_BRANDS.find(b => b.key === selectedBrand) || PRINTER_BRANDS[0];

  return (
    <div className="space-y-5">

      {/* â”€â”€â”€ Browser Support Banner â”€â”€â”€ */}
      {isWebBt ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
          <BluetoothConnected className="text-emerald-600 shrink-0 mt-0.5" size={18} />
          <div className="text-xs space-y-0.5">
            <p className="font-bold text-emerald-900">Chrome Web Bluetooth Aktif âœ“</p>
            <p className="text-emerald-700 leading-relaxed">
              Browser ini mendukung koneksi langsung ke printer Bluetooth BLE tanpa instalasi tambahan.
            </p>
          </div>
        </div>
      ) : !isNative ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
          <BluetoothOff className="text-amber-600 shrink-0 mt-0.5" size={18} />
          <div className="text-xs space-y-0.5">
            <p className="font-bold text-amber-900">Gunakan Google Chrome untuk Bluetooth</p>
            <p className="text-amber-700 leading-relaxed">
              Buka halaman ini via <strong>Chrome Android</strong> dengan HTTPS untuk menggunakan printer Bluetooth secara nirkabel.
            </p>
          </div>
        </div>
      ) : null}

      {/* â”€â”€â”€ Status Card â”€â”€â”€ */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Printer size={16} className="text-slate-500" />
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Status Printer</span>
          </div>
          <StatusBadge status={printer.status} lastError={printer.lastError} />
        </div>

        <div className="p-4">
          {savedPrinter ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                  <Printer size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-slate-800">{savedPrinter.name || 'Printer Bluetooth'}</span>
                    {printer.printerInfo?.brand && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">
                        {printer.printerInfo.brand}
                      </span>
                    )}
                    {printer.printerInfo?.model && (
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-full">
                        {printer.printerInfo.model}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                    Kertas {paperWidth} Â· {savedPrinter.type === 'WEB_BLUETOOTH' ? 'Chrome Web Bluetooth' : savedPrinter.type === 'USB_DIRECT' ? 'USB OTG' : 'Bluetooth Serial'}
                  </div>
                  {printer.lastError && (
                    <div className={`text-[11px] mt-0.5 ${printer.lastError.includes('Menunggu') ? 'text-sky-500' : 'text-rose-500'}`}>
                      {printer.lastError.includes('Menunggu') ? 'ðŸ”µ ' : 'âš  '}{printer.lastError}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => printer.reconnect()}
                  disabled={printer.status === 'connecting'}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw size={13} className={printer.status === 'connecting' ? 'animate-spin' : ''} />
                  Hubungkan Ulang
                </button>
                <button
                  type="button"
                  onClick={handleTestPrint}
                  disabled={printing || printer.status === 'connecting'}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/10 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Printer size={13} />
                  {printing ? 'Mencetak...' : 'Tes Cetak'}
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-3 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold rounded-xl transition-all active:scale-95"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center space-y-2">
              <BluetoothSearching size={32} className="mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-600">Belum Ada Printer Terhubung</p>
              <p className="text-[11px] text-slate-400">Scan dan pilih printer BLE dari daftar di bawah ini.</p>
            </div>
          )}
        </div>
      </div>

      {/* â”€â”€â”€ Konfigurasi â”€â”€â”€ */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center gap-2">
          <Zap size={15} className="text-slate-500" />
          <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Konfigurasi</span>
        </div>
        <div className="p-4 space-y-4">

          {/* Brand Picker */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Merk Printer</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowBrandMenu(v => !v)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 hover:bg-slate-100 transition-colors"
              >
                <span>{selectedBrandInfo.icon} {selectedBrandInfo.label}</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${showBrandMenu ? 'rotate-180' : ''}`} />
              </button>
              {showBrandMenu && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
                  {PRINTER_BRANDS.map(b => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => handleSaveBrand(b.key)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left text-xs hover:bg-slate-50 transition-colors ${selectedBrand === b.key ? 'bg-indigo-50 text-indigo-800' : 'text-slate-700'}`}
                    >
                      <span className="text-base">{b.icon}</span>
                      <div>
                        <div className="font-bold">{b.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{b.description}</div>
                      </div>
                      {selectedBrand === b.key && <Check size={14} className="ml-auto text-indigo-600 mt-0.5 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedBrandInfo.models && (
              <p className="text-[10px] text-slate-400">Model: {selectedBrandInfo.models}</p>
            )}
          </div>

          {/* Paper Width */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Lebar Kertas</label>
            <div className="flex gap-2">
              {(['58mm', '80mm'] as const).map(w => (
                <button
                  key={w}
                  type="button"
                  onClick={() => handlePaperWidthChange(w)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    paperWidth === w
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* Auto Connect */}
          <div className="flex items-center justify-between py-1">
            <div>
              <div className="text-xs font-bold text-slate-700">Auto-konek saat buka Kasir</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Otomatis tersambung ke printer tersimpan</div>
            </div>
            <button
              type="button"
              onClick={() => handleAutoConnectChange(!autoConnect)}
              className={`relative w-11 h-6 rounded-full transition-colors ${autoConnect ? 'bg-indigo-600' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${autoConnect ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* â”€â”€â”€ Action Buttons â”€â”€â”€ */}
      <div className="flex flex-wrap gap-3">
        {isWebBt && (
          <button
            type="button"
            onClick={handlePairWebBluetooth}
            disabled={scanning}
            className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            <BluetoothSearching size={16} className={scanning ? 'animate-pulse' : ''} />
            {scanning ? 'Membuka Pemindai Chrome...' : 'Scan & Pilih Printer Bluetooth'}
          </button>
        )}

        {isNative && (
          <button
            type="button"
            onClick={handleScanNative}
            disabled={scanning}
            className="flex items-center justify-center gap-2 px-4 py-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
          >
            <Bluetooth size={15} />
            {scanning ? 'Memindai...' : 'Scan Perangkat Paired'}
          </button>
        )}

        {isUsb && (
          <button
            type="button"
            onClick={handlePairUsb}
            disabled={connectingUsb}
            className="flex items-center justify-center gap-2 px-4 py-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
          >
            <Usb size={15} />
            {connectingUsb ? 'Menghubungkan USB...' : 'Printer USB (OTG)'}
          </button>
        )}
      </div>

      {/* â”€â”€â”€ Native Device List â”€â”€â”€ */}
      {isNative && nativeDevices.length > 0 && (
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
          <div className="bg-slate-50 px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
            Perangkat Bluetooth Tersedia
          </div>
          <div className="divide-y divide-slate-100">
            {nativeDevices.map(d => (
              <div key={d.id} className="p-4 flex justify-between items-center hover:bg-slate-50/50 transition-colors">
                <div>
                  <div className="text-sm font-bold text-slate-800">{d.name || 'Printer Bluetooth'}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase">{d.id}</div>
                </div>
                <button
                  type="button"
                  disabled={connecting}
                  onClick={() => handleSelectNativePrinter(d)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    savedPrinter?.id === d.id
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {savedPrinter?.id === d.id ? 'âœ“ Terpilih' : 'Hubungkan'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* â”€â”€â”€ Petunjuk â”€â”€â”€ */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
        <div className="font-bold flex items-center gap-1.5 text-slate-800">
          <Info size={14} className="text-indigo-500" />
          Langkah Setup Printer di Tablet / Chrome Android
        </div>
        <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
          <li>Nyalakan printer dan pastikan Bluetooth di tablet <strong>aktif</strong>.</li>
          <li>Klik tombol <strong>"Scan & Pilih Printer Bluetooth"</strong> di atas.</li>
          <li>Pilih nama printer Anda dari dialog Chrome (<em>contoh: RPP02N_BLE, XP-P300</em>).</li>
          <li>Klik <strong>"Tes Cetak"</strong> untuk memastikan printer berfungsi.</li>
          <li>Setelah terhubung, setiap selesai transaksi kasir akan langsung muncul tombol cetak struk!</li>` + "`n" + `          <li>&#10003; Mulai sekarang, <strong>setiap login atau buka kasir, printer otomatis tersambung kembali</strong> &mdash; tanpa scan ulang!</li>` + "`n" + `          <li>Jika printer sempat mati lalu dinyalakan, sistem akan mendeteksi dan konek otomatis dalam beberapa detik.</li>
        </ol>
      </div>
    </div>
  );
};

export default SettingsBluetoothPrinter;
