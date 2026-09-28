import React, { useState } from 'react';
import { Printer, Check, Info, Usb } from 'lucide-react';
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

export const SettingsBluetoothPrinter: React.FC = () => {
  const [savedPrinter, setSavedPrinter] = useState<any>(getSavedBluetoothPrinter());
  const [nativeDevices, setNativeDevices] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [connectingUsb, setConnectingUsb] = useState(false);

  const isWebBt = isWebBluetoothSupported();
  const isNative = isNativeMobile();
  const isUsb = isWebUsbSupported();

  const handlePairWebBluetooth = async () => {
    setScanning(true);
    try {
      const paired = await pairWebBluetoothPrinter();
      setSavedPrinter(paired);
      toast(`Printer "${paired.name}" berhasil disambungkan!`, 'success');
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
      toast(`Menemukan ${list.length} perangkat Bluetooth terpasang.`, 'success');
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
      
      setSavedPrinter({
        id: device.id,
        name: device.name || 'Printer Bluetooth',
        type: 'CORDOVA_SERIAL'
      });
      toast('Printer Bluetooth berhasil terhubung dan disimpan!', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal terhubung ke printer', 'error');
    } finally {
      setConnecting(false);
    }
  };

  const handleTestPrint = async () => {
    if (!savedPrinter) {
      toast('Belum ada printer Bluetooth yang tersambung', 'warning');
      return;
    }

    setPrinting(true);
    try {
      await testPrintBluetooth();
      toast('Struk tes cetak berhasil dikirim ke printer!', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal melakukan tes cetak. Pastikan printer hidup dan berada dalam jangkauan.', 'error');
    } finally {
      setPrinting(false);
    }
  };

  const handlePairUsb = async () => {
    setConnectingUsb(true);
    try {
      const dev = await pairWebUsbPrinter();
      setSavedPrinter({
        id: 'USB-DIRECT',
        name: dev.productName || 'USB Thermal Printer',
        type: 'USB_DIRECT'
      });
      toast(`Printer USB "${dev.productName || 'Thermal'}" berhasil terhubung!`, 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal menyambungkan printer USB. Pastikan kabel OTG terpasang.', 'error');
    } finally {
      setConnectingUsb(false);
    }
  };

  const handleDisconnect = () => {
    clearSavedBluetoothPrinter();
    localStorage.removeItem('usb_printer_saved');
    localStorage.removeItem('usb_printer_name');
    setSavedPrinter(null);
    toast('Koneksi printer telah diputus.', 'info');
  };

  return (
    <div className="space-y-6">
      {/* ── Status Banner ── */}
      {isWebBt ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-800">
          <Check className="text-emerald-600 shrink-0 mt-0.5" size={18} />
          <div className="text-xs space-y-1">
            <p className="font-bold text-emerald-900">Browser Google Chrome Mendukung Koneksi Web Bluetooth Langsung</p>
            <p className="text-emerald-700 leading-relaxed">
              Anda dapat menghubungkan tablet / PC Anda dengan printer thermal Bluetooth secara langsung dari browser ini tanpa memerlukan instalasi aplikasi tambahan.
            </p>
          </div>
        </div>
      ) : !isNative ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-800">
          <Info className="text-amber-600 shrink-0 mt-0.5" size={18} />
          <div className="text-xs space-y-1">
            <p className="font-bold text-amber-900">Perhatian Browser</p>
            <p className="text-amber-700 leading-relaxed">
              Untuk menggunakan printer thermal Bluetooth secara nirkabel dari tablet, disarankan membuka web POS ini menggunakan <strong>Google Chrome</strong> dengan koneksi HTTPS.
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Active Saved Printer Card ── */}
      {savedPrinter ? (
        <div className="p-5 border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-50/50 to-purple-50/30 rounded-2xl shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                <Printer size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-800">{savedPrinter.name || 'Printer Bluetooth'}</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
                    Tersambung
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  ID: {savedPrinter.id} • {savedPrinter.type === 'WEB_BLUETOOTH' ? 'Chrome Web Bluetooth' : 'Native Bluetooth'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleTestPrint}
                disabled={printing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/10 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                <Printer size={14} />
                <span>{printing ? 'Mencetak...' : 'Tes Cetak Struk'}</span>
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                className="px-3 py-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold rounded-xl transition-all active:scale-95"
              >
                Putuskan
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-slate-50/50">
          <Printer size={32} className="mx-auto text-slate-300 mb-2" />
          <h4 className="text-xs font-bold text-slate-700">Belum Ada Printer Bluetooth Terhubung</h4>
          <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
            Klik tombol pindai di bawah ini untuk mencari dan menyambungkan printer thermal kasir/waiter Anda.
          </p>
        </div>
      )}

      {/* ── Action Buttons ── */}
      <div className="flex flex-wrap gap-3">
        {isWebBt && (
          <button
            type="button"
            onClick={handlePairWebBluetooth}
            disabled={scanning}
            className="btn btn-primary bg-indigo-600 hover:bg-indigo-700 border-indigo-600 flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-black shadow-md shadow-indigo-600/20"
          >
            <Printer size={16} />
            <span>{scanning ? 'Membuka Pemindai Chrome...' : 'Pindai & Sambungkan Printer (Web Bluetooth)'}</span>
          </button>
        )}

        {isNative && (
          <button
            type="button"
            onClick={handleScanNative}
            disabled={scanning}
            className="btn btn-outline flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold"
          >
            <span>{scanning ? 'Memindai...' : 'Pindai Perangkat Paired'}</span>
          </button>
        )}

        {isUsb && (
          <button
            type="button"
            onClick={handlePairUsb}
            disabled={connectingUsb}
            className="btn btn-outline border-slate-300 hover:border-indigo-500 hover:text-indigo-600 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold"
          >
            <Usb size={16} />
            <span>{connectingUsb ? 'Menghubungkan USB...' : 'Hubungkan Printer USB (OTG / Kabel)'}</span>
          </button>
        )}
      </div>

      {/* ── Native Devices List (if running in APK) ── */}
      {isNative && nativeDevices.length > 0 && (
        <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
          <div className="bg-slate-50 px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
            Daftar Perangkat Bluetooth Paired
          </div>
          <div className="divide-y divide-slate-100">
            {nativeDevices.map(d => (
              <div key={d.id} className="p-4 flex justify-between items-center hover:bg-slate-50/50 transition-colors">
                <div>
                  <div className="text-sm font-bold text-slate-800">{d.name || 'Printer Bluetooth'}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-wider">{d.id}</div>
                </div>
                <button
                  type="button"
                  disabled={connecting}
                  onClick={() => handleSelectNativePrinter(d)}
                  className={`btn px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    savedPrinter?.id === d.id 
                      ? 'btn-primary bg-green-600 border-green-600 text-white hover:bg-green-700 shadow-md shadow-green-600/10' 
                      : 'btn-outline border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {savedPrinter?.id === d.id ? 'Terpilih' : 'Hubungkan'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Petunjuk Praktis ── */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 text-xs space-y-2">
        <div className="font-bold flex items-center gap-1.5 text-slate-900">
          <Info size={15} className="text-indigo-600" />
          <span>Langkah Cepat Menyambungkan di Tablet / Chrome:</span>
        </div>
        <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
          <li>Nyalakan <strong>Bluetooth</strong> pada tablet dan hidupkan <strong>Printer Thermal Bluetooth</strong> Anda.</li>
          <li>Klik tombol <strong>"Pindai & Sambungkan Printer (Web Bluetooth)"</strong> di atas.</li>
          <li>Pada kotak dialog Chrome yang muncul, pilih nama printer Anda (misal: <em>RPP02N, Panda, Mini POS 58/80, Iware, PT-210</em>) lalu klik <strong>Pair / Sambungkan</strong>.</li>
          <li>Klik <strong>"Tes Cetak Struk"</strong> untuk memastikan kertas mencetak dengan benar.</li>
          <li>Setelah terhubung, setiap transaksi kasir di tablet ini dapat langsung mencetak struk via Bluetooth!</li>
        </ol>
      </div>
    </div>
  );
};

export default SettingsBluetoothPrinter;
