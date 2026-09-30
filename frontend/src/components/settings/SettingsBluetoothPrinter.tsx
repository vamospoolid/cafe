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
  Receipt,
  Utensils,
  ChefHat
} from 'lucide-react';
import { toast } from '../../utils/alert';
import {
  type PrinterRole,
  isWebBluetoothSupported,
  isNativeMobile,
  isWebUsbSupported,
  pairWebUsbPrinter,
  pairWebBluetoothPrinter,
  getSavedBluetoothPrinter,
  saveSavedBluetoothPrinter,
  clearSavedBluetoothPrinter,
  testPrintBluetooth,
  listPairedBluetoothDevices,
  discoverUnpairedBluetoothDevices,
  connectBluetoothPrinter,
  disconnectBluetoothPrinter
} from '../../utils/printerBluetooth';
import { usePrinter } from '../../context/PrinterContext';

// ─── Brand Config ─────────────────────────────────────────────────────────────

const PRINTER_BRANDS = [
  {
    key: 'AUTO',
    label: 'Auto-Detect (Disarankan)',
    description: 'Sistem mengenali jenis printer otomatis',
    models: '',
    icon: '🔍',
  },
  {
    key: 'RONGTA',
    label: 'Rongta',
    description: 'RPP02N, RPP300, RPP02B, RPP320',
    models: 'RPP02N, RPP300',
    icon: '🖨️',
  },
  {
    key: 'XPRINTER',
    label: 'Xprinter',
    description: 'XP-P300, XP-58, XP-80, XP-T81',
    models: 'XP-P300, XP-58',
    icon: '🖨️',
  },
  {
    key: 'HPRT',
    label: 'HPRT',
    description: 'HM-E200, HM-E300, HPRT-58',
    models: 'HM-E200, HM-E300',
    icon: '🖨️',
  },
  {
    key: 'BIXOLON',
    label: 'Bixolon',
    description: 'SPP-R200, SPP-R210, SPP-R300',
    models: 'SPP-R200',
    icon: '🖨️',
  },
  {
    key: 'GENERIC',
    label: 'Generic / Lainnya',
    description: 'Mini POS 58mm/80mm, Iware, PT-210, dan lainnya',
    models: '',
    icon: '🖨️',
  },
];

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status, lastError }: { status: string; lastError?: string | null }) => {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    connected:    { label: 'Terhubung',              cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500 animate-pulse' },
    connecting:   { label: 'Menghubungkan...',        cls: 'bg-amber-100 text-amber-800 border-amber-200',   dot: 'bg-amber-500 animate-spin' },
    printing:     { label: 'Mencetak...',             cls: 'bg-indigo-100 text-indigo-800 border-indigo-200', dot: 'bg-indigo-500 animate-pulse' },
    disconnected: { label: lastError?.includes('Menunggu') ? 'Menunggu Printer…' : 'Terputus',
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

// ─── Main Component ───────────────────────────────────────────────────────────

export const SettingsBluetoothPrinter: React.FC = () => {
  const printer = usePrinter();

  // Tab Role Aktif: Kasir vs Dapur
  const [activeRole, setActiveRole] = useState<PrinterRole>('cashier');

  // Perangkat tersimpan per role
  const [cashierPrinter, setCashierPrinter] = useState<any>(() => getSavedBluetoothPrinter('cashier'));
  const [kitchenPrinter, setKitchenPrinter] = useState<any>(() => getSavedBluetoothPrinter('kitchen'));

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

  const currentSaved = activeRole === 'kitchen' ? kitchenPrinter : cashierPrinter;

  const handlePairWebBluetooth = async () => {
    setScanning(true);
    try {
      const paired = await pairWebBluetoothPrinter(activeRole);
      if (activeRole === 'kitchen') {
        setKitchenPrinter(paired);
      } else {
        setCashierPrinter(paired);
      }
      localStorage.setItem('printer_brand', selectedBrand);
      localStorage.setItem('printer_paper_width', paperWidth);
      localStorage.setItem('printer_auto_connect', autoConnect ? 'true' : 'false');
      toast(`✅ Printer ${activeRole === 'kitchen' ? 'Dapur' : 'Kasir'} "${paired.name}" berhasil disambungkan!`, 'success');
      if (activeRole === 'cashier') {
        setTimeout(() => printer.reconnect(), 500);
      }
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
      if (list.length === 0) toast('Tidak ada perangkat Bluetooth yang sudah dipasangkan di HP.', 'warning');
      else toast(`Menemukan ${list.length} perangkat Bluetooth dipasangkan.`, 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal memindai Bluetooth', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleScanUnpaired = async () => {
    setScanning(true);
    try {
      toast('Mencari perangkat Bluetooth di sekitar...', 'info');
      const list = await discoverUnpairedBluetoothDevices();
      setNativeDevices(prev => {
        const map = new Map(prev.map(d => [d.id, d]));
        list.forEach(d => map.set(d.id, d));
        return Array.from(map.values());
      });
      if (list.length === 0) toast('Tidak menemukan perangkat Bluetooth baru. Pastikan printer menyala & Bluetooth aktif.', 'warning');
      else toast(`Menemukan ${list.length} perangkat Bluetooth baru.`, 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal mencari perangkat baru', 'error');
    } finally {
      setScanning(false);
    }
  };

  const handleSelectNativePrinter = async (device: any, targetRole: PrinterRole = activeRole) => {
    setConnecting(true);
    try {
      await connectBluetoothPrinter(device.id);
      await disconnectBluetoothPrinter();
      const info = {
        id: device.id,
        name: device.name || (targetRole === 'kitchen' ? 'Printer Dapur' : 'Printer Kasir'),
        type: 'CORDOVA_SERIAL' as const,
        address: device.id
      };
      saveSavedBluetoothPrinter(targetRole, info);
      if (targetRole === 'kitchen') {
        setKitchenPrinter(info);
      } else {
        setCashierPrinter(info);
      }
      toast(`✅ Printer ${targetRole === 'kitchen' ? 'Dapur' : 'Kasir'} berhasil disetel ke "${info.name}"!`, 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal terhubung ke printer', 'error');
    } finally {
      setConnecting(false);
    }
  };

  const handleTestPrint = async () => {
    if (!currentSaved) {
      toast(`Belum ada printer ${activeRole === 'kitchen' ? 'Dapur' : 'Kasir'} yang tersambung`, 'warning');
      return;
    }
    setPrinting(true);
    try {
      await testPrintBluetooth(activeRole);
      toast(`✅ Struk tes ${activeRole === 'kitchen' ? 'Dapur' : 'Kasir'} berhasil dicetak!`, 'success');
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
      const info = { id: 'USB-DIRECT', name: dev.productName || 'USB Thermal Printer', type: 'USB_DIRECT' as any };
      saveSavedBluetoothPrinter(activeRole, info);
      if (activeRole === 'kitchen') setKitchenPrinter(info);
      else setCashierPrinter(info);
      toast(`✅ Printer USB "${dev.productName || 'Thermal'}" terhubung untuk ${activeRole === 'kitchen' ? 'Dapur' : 'Kasir'}!`, 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal menyambungkan printer USB.', 'error');
    } finally {
      setConnectingUsb(false);
    }
  };

  const handleDisconnect = () => {
    clearSavedBluetoothPrinter(activeRole);
    if (activeRole === 'kitchen') {
      setKitchenPrinter(null);
    } else {
      localStorage.removeItem('usb_printer_saved');
      localStorage.removeItem('usb_printer_name');
      printer.disconnect();
      setCashierPrinter(null);
    }
    toast(`Koneksi printer ${activeRole === 'kitchen' ? 'Dapur' : 'Kasir'} diputus.`, 'info');
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

      {/* ─── Browser Support Banner ─── */}
      {isWebBt ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
          <BluetoothConnected className="text-emerald-600 shrink-0 mt-0.5" size={18} />
          <div className="text-xs space-y-0.5">
            <p className="font-bold text-emerald-900">Chrome Web Bluetooth Aktif ✓</p>
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

      {/* ─── Role Switcher Tabs (Kasir vs Dapur) ─── */}
      <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1.5 shadow-inner">
        <button
          type="button"
          onClick={() => setActiveRole('cashier')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${
            activeRole === 'cashier'
              ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80 ring-2 ring-indigo-500/10'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Receipt size={16} />
          <span>Printer Struk Kasir</span>
          {cashierPrinter ? (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" title="Terhubung" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300" title="Belum diatur" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveRole('kitchen')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${
            activeRole === 'kitchen'
              ? 'bg-white text-amber-700 shadow-sm border border-slate-200/80 ring-2 ring-amber-500/10'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Utensils size={16} />
          <span>Printer Tiket Dapur</span>
          {kitchenPrinter ? (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" title="Terhubung" />
          ) : cashierPrinter ? (
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" title="Fallback ke Printer Kasir" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300" title="Belum diatur" />
          )}
        </button>
      </div>

      {/* ─── Status Card (Per Role Aktif) ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-2">
            {activeRole === 'kitchen' ? <ChefHat size={16} className="text-amber-500" /> : <Printer size={16} className="text-indigo-500" />}
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
              {activeRole === 'kitchen' ? 'Status Printer Dapur (Koki)' : 'Status Printer Kasir (Konsumen)'}
            </span>
          </div>
          <StatusBadge status={activeRole === 'cashier' ? printer.status : (kitchenPrinter ? 'connected' : 'idle')} lastError={activeRole === 'cashier' ? printer.lastError : null} />
        </div>

        <div className="p-4">
          {currentSaved ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className={`w-11 h-11 rounded-2xl text-white flex items-center justify-center shadow-md shrink-0 ${
                  activeRole === 'kitchen' ? 'bg-amber-600 shadow-amber-600/20' : 'bg-indigo-600 shadow-indigo-600/20'
                }`}>
                  {activeRole === 'kitchen' ? <Utensils size={22} /> : <Receipt size={22} />}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-slate-800">{currentSaved.name || (activeRole === 'kitchen' ? 'Printer Dapur' : 'Printer Kasir')}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      activeRole === 'kitchen' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'
                    }`}>
                      {activeRole === 'kitchen' ? '🍜 Target: Tiket Dapur' : '💳 Target: Struk Kasir'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                    Kertas {paperWidth} · ID: {currentSaved.id} · {currentSaved.type === 'WEB_BLUETOOTH' ? 'Chrome Web Bluetooth' : currentSaved.type === 'USB_DIRECT' ? 'USB OTG' : 'Bluetooth Serial'}
                  </div>
                  {activeRole === 'cashier' && printer.lastError && (
                    <div className={`text-[11px] mt-0.5 ${printer.lastError.includes('Menunggu') ? 'text-sky-500' : 'text-rose-500'}`}>
                      {printer.lastError.includes('Menunggu') ? '🔵 ' : '⚠️ '}{printer.lastError}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {activeRole === 'cashier' && (
                  <button
                    type="button"
                    onClick={() => printer.reconnect()}
                    disabled={printer.status === 'connecting'}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={printer.status === 'connecting' ? 'animate-spin' : ''} />
                    Hubungkan Ulang
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleTestPrint}
                  disabled={printing || (activeRole === 'cashier' && printer.status === 'connecting')}
                  className={`px-4 py-2 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 ${
                    activeRole === 'kitchen' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/10' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10'
                  }`}
                >
                  <Printer size={13} />
                  {printing ? 'Mencetak...' : `Tes Cetak ${activeRole === 'kitchen' ? 'Dapur' : 'Kasir'}`}
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-3 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold rounded-xl transition-all active:scale-95"
                  title={`Putuskan ${activeRole === 'kitchen' ? 'Printer Dapur' : 'Printer Kasir'}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center space-y-2">
              <BluetoothSearching size={32} className="mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-600">
                {activeRole === 'kitchen' ? 'Printer Dapur Belum Diatur' : 'Printer Kasir Belum Diatur'}
              </p>
              <p className="text-[11px] text-slate-400">
                {activeRole === 'kitchen'
                  ? 'Tiket dapur otomatis dialihkan ke Printer Kasir jika printer dapur belum disetel.'
                  : 'Scan dan pilih printer thermal untuk kasir dari daftar di bawah ini.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Konfigurasi Umum ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center gap-2">
          <Zap size={15} className="text-slate-500" />
          <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Konfigurasi Ukuran & Brand</span>
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
          </div>

          {/* Paper Width */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Lebar Kertas Thermal</label>
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
              <div className="text-[11px] text-slate-400 mt-0.5">Otomatis tersambung ke printer yang tersimpan</div>
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

      {/* ─── Action Buttons ─── */}
      <div className="flex flex-wrap gap-2.5">
        {isWebBt && (
          <button
            type="button"
            onClick={handlePairWebBluetooth}
            disabled={scanning}
            className={`flex-1 min-w-[200px] flex items-center justify-center gap-2 px-5 py-3 text-white text-xs font-black rounded-xl shadow-md disabled:opacity-50 transition-all active:scale-[0.98] ${
              activeRole === 'kitchen' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
            }`}
          >
            <BluetoothSearching size={16} className={scanning ? 'animate-pulse' : ''} />
            {scanning ? 'Membuka Pemindai Chrome...' : `Scan & Pilih ${activeRole === 'kitchen' ? 'Printer Dapur' : 'Printer Kasir'}`}
          </button>
        )}

        {isNative && (
          <div className="flex flex-wrap gap-2 w-full">
            <button
              type="button"
              onClick={handleScanNative}
              disabled={scanning}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
            >
              <Bluetooth size={15} />
              {scanning ? 'Memindai...' : 'Scan Perangkat Paired'}
            </button>
            <button
              type="button"
              onClick={handleScanUnpaired}
              disabled={scanning}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-all disabled:opacity-50"
            >
              <BluetoothSearching size={15} />
              {scanning ? 'Mencari...' : 'Cari Perangkat Baru'}
            </button>
          </div>
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

      {/* ─── Native Device List ─── */}
      {isNative && nativeDevices.length > 0 && (
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
          <div className="bg-slate-50 px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 flex items-center justify-between">
            <span>Daftar Perangkat Bluetooth HP ({nativeDevices.length})</span>
            <span className="text-indigo-600 font-semibold lowercase">klik tombol untuk menetapkan target</span>
          </div>
          <div className="divide-y divide-slate-100">
            {nativeDevices.map(d => {
              const isSelectedCashier = cashierPrinter?.id === d.id;
              const isSelectedKitchen = kitchenPrinter?.id === d.id;

              return (
                <div key={d.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                  <div>
                    <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <span>{d.name || 'Printer Bluetooth'}</span>
                      {isSelectedCashier && (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-extrabold rounded-md border border-indigo-200">
                          💳 Kasir Aktif
                        </span>
                      )}
                      {isSelectedKitchen && (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-extrabold rounded-md border border-amber-200">
                          🍜 Dapur Aktif
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase">{d.id}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={connecting}
                      onClick={() => handleSelectNativePrinter(d, 'cashier')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isSelectedCashier
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'border border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100'
                      }`}
                    >
                      <Receipt size={13} />
                      <span>{isSelectedCashier ? '✓ Terpilih Kasir' : '+ Set Kasir'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={connecting}
                      onClick={() => handleSelectNativePrinter(d, 'kitchen')}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isSelectedKitchen
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'border border-amber-200 bg-amber-50/50 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      <Utensils size={13} />
                      <span>{isSelectedKitchen ? '✓ Terpilih Dapur' : '+ Set Dapur'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Petunjuk Lengkap ─── */}
      <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-xs space-y-2">
        <div className="font-bold flex items-center gap-1.5 text-slate-800">
          <Info size={14} className="text-indigo-600" />
          <span>Panduan Penggunaan Dual Printer (Kasir &amp; Dapur)</span>
        </div>
        <ol className="list-decimal list-inside space-y-1.5 text-slate-600 pl-1 leading-relaxed text-[11px]">
          <li>Nyalakan kedua printer thermal (Printer Kasir dan Printer Dapur).</li>
          <li>
            <strong>Di HP Android:</strong> Buka <strong>Pengaturan HP &gt; Bluetooth</strong>, pasangkan (*pair*) kedua printer dengan memasukkan PIN (<code>0000</code> atau <code>1234</code>).
          </li>
          <li>
            Kembali ke aplikasi ini, klik <strong>"Scan Perangkat Paired"</strong>. Kedua printer akan muncul di daftar perangkat di atas.
          </li>
          <li>
            Klik tombol <strong>"+ Set Kasir"</strong> pada printer kasir, dan klik tombol <strong>"+ Set Dapur"</strong> pada printer dapur.
          </li>
          <li>
            ✅ <strong>Selesai!</strong> Saat transaksi POS, struk kasir otomatis dicetak ke Printer Kasir, dan tiket pesanan koki otomatis dicetak ke Printer Dapur secara bergantian tanpa perlu ubah setting lagi!
          </li>
        </ol>
      </div>

    </div>
  );
};

export default SettingsBluetoothPrinter;
