import React, { useState, useEffect, useContext } from 'react';
import { Settings, Store, Receipt, Percent, CreditCard, Image as ImageIcon, Save, UploadCloud, Phone, MapPin, Sparkles, Check, Info, ShieldAlert, Award, PackageSearch, Coffee, Smartphone, Sliders, Package, Layers, Printer, Database, RefreshCw, Utensils, ChefHat, Clock, X } from 'lucide-react';
import { POSContext } from '../context/POSContext';

import { toast, confirmAlert, errorAlert } from '../utils/alert';
import { 
  isNativeMobile, 
  listPairedBluetoothDevices, 
  connectBluetoothPrinter, 
  disconnectBluetoothPrinter, 
  printRawBytes 
} from '../utils/printerBluetooth';
import EscPosEncoder from 'esc-pos-encoder';

const SettingsView = () => {
  const [activeTab, setActiveTab] = useState('profil');
  const [loading, setLoading] = useState(false);
  const posContext = useContext(POSContext);
  const [testLoading, setTestLoading] = useState(false);
  
  const [isElectronApp, setIsElectronApp] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState<any[]>([]);

  useEffect(() => {
    const win = window as any;
    if (win.electronPOS && win.electronPOS.printer) {
      setIsElectronApp(true);
      win.electronPOS.printer.getPrinters()
        .then((list: any[]) => {
          setAvailablePrinters(list);
        })
        .catch(console.error);
    }
  }, []);

  const [highPrecisionMode, setHighPrecisionMode] = useState(() => {
    return localStorage.getItem('high_precision_mode') === 'true';
  });

  const handleHighPrecisionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setHighPrecisionMode(checked);
    localStorage.setItem('high_precision_mode', checked ? 'true' : 'false');
    toast(`Mode Presisi Tinggi ${checked ? 'diaktifkan' : 'dinonaktifkan'} untuk perangkat ini.`, 'success');
  };

  const [testingTarget, setTestingTarget] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (e) {
      console.error('Failed to fetch categories in settings:', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'struk') {
      fetchCategories();
    }
  }, [activeTab]);

  const handleUpdateCategoryTarget = async (catId: number, target: string) => {
    try {
      const res = await fetch(`/api/categories/${catId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ printerTarget: target })
      });
      if (res.ok) {
        setCategories(prev => prev.map(c => c.id === catId ? { ...c, printerTarget: target } : c));
        toast('Target printer kategori berhasil diperbarui!', 'success');
      }
    } catch (e) {
      toast('Gagal memperbarui kategori', 'error');
    }
  };

  const handleTestSpecificPrint = async (roleName: 'KASIR' | 'DAPUR' | 'BAR', ip?: string, port?: number) => {
    const win = window as any;
    if (win.electronPOS && win.electronPOS.printer) {
      if (!formData.windowsPrinterName) {
        toast('Pilih printer Windows terlebih dahulu!', 'error');
        return;
      }
      setTestingTarget(roleName);
      try {
        await win.electronPOS.printer.testPrint(formData.windowsPrinterName, formData.storeName);
        toast(`Halaman uji ${roleName} berhasil dikirim ke printer lokal!`, 'success');
      } catch (err: any) {
        toast('Gagal mencetak: ' + err.message, 'error');
      } finally {
        setTestingTarget(null);
      }
      return;
    }

    const targetIp = ip || (roleName === 'DAPUR' ? formData.kitchenPrinterIp : (roleName === 'BAR' ? formData.barPrinterIp : formData.printerIp));
    const targetPort = port || (roleName === 'DAPUR' ? formData.kitchenPrinterPort : (roleName === 'BAR' ? formData.barPrinterPort : formData.printerPort)) || 9100;

    if (!targetIp) {
      toast(`IP Printer untuk ${roleName} belum diisi!`, 'error');
      return;
    }

    setTestingTarget(roleName);
    try {
      const res = await fetch('/api/printer/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ ip: targetIp, port: targetPort, roleName })
      });
      const data = await res.json();
      if (res.ok) {
        toast(`✓ Halaman uji Printer ${roleName} (${targetIp}) berhasil dicetak!`, 'success');
      } else {
        toast(data.error || `Gagal terhubung ke printer ${roleName}`, 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan koneksi', 'error');
    } finally {
      setTestingTarget(null);
    }
  };

  const [formData, setFormData] = useState({
    storeName: 'MUKI RAMEN',
    phone: '',
    address: '',
    logoUrl: '',
    qrCodeBaseUrl: '',
    receiptHeader: '',
    receiptFooter: '',
    taxRate: 0,
    serviceCharge: 0,
    includeTax: false,
    bankName: '',
    accountNumber: '',
    accountName: '',
    qrisUrl: '',
    enableDrinkCustomization: false,
    loyaltyEnabled: true,
    loyaltyEarnPerAmount: 10000,
    loyaltyPointValue: 100,
    loyaltySilverThreshold: 1000000,
    loyaltyGoldThreshold: 3000000,
    loyaltySilverMultiplier: 1.2,
    loyaltyGoldMultiplier: 1.5,
    ingredientTrackingEnabled: false,
    // Printer Kasir
    printerIp: '',
    printerPort: 9100,
    windowsPrinterName: '',
    autoPrintKDS: false,
    autoPrintReceipt: false,
    // Printer Dapur
    kitchenPrinterIp: '',
    kitchenPrinterPort: 9100,
    autoPrintKitchen: false,
    // Printer Bar
    barPrinterIp: '',
    barPrinterPort: 9100,
    autoPrintBar: false,
    // KDS
    enableKDS: true,
    autoCompleteKDSOnPay: true,
    // Absensi & GPS Geofencing
    storeLatitude: -3.4026521,
    storeLongitude: 119.2137757,
    gpsRadiusMeters: 300,
    enableGpsValidation: true,
    enableCameraPhoto: true,
    workShifts: '',
    // Reward & Punishment Karyawan
    enableZeroLateBonus: true,
    zeroLateBonusAmount: 200000,
    zeroLateMinAttendance: 20,
    zeroLateMaxLateAllowed: 0,
    enableLatePenalty: false,
    latePenaltyType: 'FLAT',
    latePenaltyAmount: 10000,
    enableAlphaPenalty: false,
    alphaPenaltyAmount: 50000,
  });

  const [shiftsList, setShiftsList] = useState<Array<{ id: string; name: string; start: string; end: string; lateTolerance: number }>>([
    { id: 'pagi', name: 'Shift Pagi', start: '08:00', end: '16:00', lateTolerance: 15 },
    { id: 'siang', name: 'Shift Siang / Sore', start: '14:00', end: '22:00', lateTolerance: 15 },
    { id: 'full', name: 'Shift Full / Normal', start: '09:00', end: '18:00', lateTolerance: 15 }
  ]);

  const [newShift, setNewShift] = useState({ name: '', start: '08:00', end: '16:00', lateTolerance: 15 });

  useEffect(() => {
    if (posContext?.settings) {
      setFormData({
        ...formData,
        ...posContext.settings
      });
      if (posContext.settings.workShifts) {
        try {
          const parsed = JSON.parse(posContext.settings.workShifts);
          if (Array.isArray(parsed) && parsed.length > 0) setShiftsList(parsed);
        } catch {}
      }
    }
  }, [posContext?.settings]);

  const handleGetDeviceCoordinates = () => {
    if (!navigator.geolocation) {
      return toast('Browser tidak mendukung Geolocation', 'error');
    }
    toast('Mendeteksi koordinat GPS perangkat...', 'info');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setFormData(prev => ({
          ...prev,
          storeLatitude: pos.coords.latitude,
          storeLongitude: pos.coords.longitude
        }));
        toast(`Koordinat berhasil diambil: ${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`, 'success');
      },
      err => {
        toast('Gagal mengambil koordinat GPS: ' + err.message, 'error');
      },
      { enableHighAccuracy: true }
    );
  };

  const handleAddShift = () => {
    if (!newShift.name.trim()) return toast('Nama shift harus diisi', 'warning');
    const id = 'shift_' + Date.now();
    const updated = [...shiftsList, { ...newShift, id, lateTolerance: Number(newShift.lateTolerance) || 15 }];
    setShiftsList(updated);
    setFormData(prev => ({ ...prev, workShifts: JSON.stringify(updated) }));
    setNewShift({ name: '', start: '08:00', end: '16:00', lateTolerance: 15 });
    toast('Shift baru berhasil ditambahkan!', 'success');
  };

  const handleDeleteShift = (id: string) => {
    if (shiftsList.length <= 1) return toast('Minimal harus menyisakan 1 shift kerja', 'warning');
    const updated = shiftsList.filter(s => s.id !== id);
    setShiftsList(updated);
    setFormData(prev => ({ ...prev, workShifts: JSON.stringify(updated) }));
    toast('Shift berhasil dihapus', 'info');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        toast('Pengaturan berhasil disimpan!', 'success');
        posContext?.fetchSettings(); // Refresh context
      } else {
        toast('Gagal menyimpan pengaturan.', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 w-full flex flex-col pb-52 sm:pb-20">
      {/* Header Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 sm:gap-4 mb-4 sm:mb-6 shrink-0">
        <div className="hidden sm:block">
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-slate-800 tracking-tight">
            <Settings className="text-indigo-600" size={26} /> Pengaturan Sistem
          </h2>
          <p className="text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-wider">
            Konfigurasi profil toko, mode POS, format struk printer, & metode pembayaran.
          </p>
        </div>
        <button 
          className="btn btn-primary shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 flex items-center justify-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl transition-all font-bold text-xs sm:text-sm active:scale-95 shrink-0 w-full sm:w-auto" 
          onClick={handleSave}
          disabled={loading}
        >
          <Save size={16} /> {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 w-full items-start mb-6">
        
        {/* Navigation Tabs (Scrollable pills on mobile, sidebar on desktop) */}
        <div className="w-full lg:w-72 shrink-0 flex lg:flex-col overflow-x-auto lg:overflow-visible gap-2 pb-2 lg:pb-0 no-scrollbar">
          <div className="hidden lg:block text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-1">Kelompok Menu</div>
          
          {[
            { id: 'profil', label: 'Profil Kafe', icon: Store },
            { id: 'struk', label: 'Printer & KDS', icon: Receipt },
            { id: 'pajak', label: 'Pajak & Service', icon: Percent },
            { id: 'bayar', label: 'Metode Pembayaran', icon: CreditCard },
            { id: 'fitur', label: 'Mode Operasional POS', icon: Settings },
            { id: 'crm', label: 'CRM & Member', icon: Award },
            { id: 'inventaris', label: 'Mode Inventaris', icon: PackageSearch },
            { id: 'printer_bt', label: 'Printer Bluetooth', icon: Printer },
            { id: 'database', label: 'Database & Backup', icon: Database },
            { id: 'absensi_gps', label: 'Absensi & GPS Toko', icon: MapPin },
            { id: 'koneksi_server', label: 'Koneksi Terminal', icon: Smartphone },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 flex items-center gap-2 sm:gap-3 px-3.5 py-2.5 lg:px-4 lg:py-3 rounded-2xl text-left font-bold transition-all text-xs sm:text-sm border whitespace-nowrap lg:whitespace-normal ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 border-indigo-600 scale-[1.02]'
                    : 'bg-white text-slate-600 hover:text-slate-900 border-slate-100 hover:border-slate-200 shadow-sm'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 w-full bg-white p-4 sm:p-6 lg:p-8 shadow-sm border border-slate-200/80 rounded-3xl min-h-[500px] mb-8 sm:mb-0">
          
          {activeTab === 'profil' && (
            <div className="space-y-8 animate-fade-in">
              <div className="border-b border-slate-100 pb-4 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Store size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Informasi Profil Kafe</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Atur nama, nomor kontak, alamat kafe, dan logo resmi usaha.</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Nama Bisnis / Toko</label>
                    <div className="relative">
                      <Store size={16} className="absolute left-3 top-3.5 text-slate-400" />
                      <input 
                        type="text" 
                        name="storeName" 
                        className="form-control pl-10" 
                        style={{ paddingLeft: '2.5rem' }} 
                        value={formData.storeName} 
                        onChange={handleChange} 
                        placeholder="Nama Kafe Anda"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Nomor Telepon / WA</label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3 top-3.5 text-slate-400" />
                      <input 
                        type="text" 
                        name="phone" 
                        className="form-control pl-10" 
                        style={{ paddingLeft: '2.5rem' }}
                        value={formData.phone} 
                        onChange={handleChange} 
                        placeholder="0812xxxxxxxx"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Alamat Lengkap</label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3 top-3.5 text-slate-400" />
                      <textarea 
                        name="address" 
                        rows={3} 
                        className="form-control pl-10" 
                        style={{ paddingLeft: '2.5rem' }}
                        value={formData.address} 
                        onChange={handleChange}
                        placeholder="Alamat lengkap outlet kafe"
                      ></textarea>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">URL Logo Kafe (Path / Link)</label>
                    <div className="relative">
                      <ImageIcon size={16} className="absolute left-3 top-3.5 text-slate-400" />
                      <input 
                        type="text" 
                        name="logoUrl" 
                        className="form-control pl-10" 
                        style={{ paddingLeft: '2.5rem' }}
                        value={formData.logoUrl} 
                        onChange={handleChange} 
                        placeholder="/logo-sol-cafe.png"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Base URL QR Code / Dine-In</label>
                    <div className="relative">
                      <Sparkles size={16} className="absolute left-3 top-3.5 text-slate-400" />
                      <input 
                        type="text" 
                        name="qrCodeBaseUrl" 
                        className="form-control pl-10" 
                        style={{ paddingLeft: '2.5rem' }}
                        value={formData.qrCodeBaseUrl || ''} 
                        onChange={handleChange} 
                        placeholder="Contoh: http://app.solcafe.com"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col">
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Logo Toko (Opsional)</label>
                  <div className="flex-1 border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-2xl bg-slate-50/50 hover:bg-indigo-50/20 p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 group min-h-[180px]">
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 group-hover:text-indigo-600 group-hover:scale-110 transition-all mb-3">
                      <ImageIcon size={22} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Pilih atau Seret Foto Logo</span>
                    <span className="text-[10px] text-slate-400 mt-1">Format: JPG/PNG (Dimensi 1:1 direkomendasikan)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'struk' && (
            <div className="space-y-8 animate-fade-in">
              <div className="border-b border-slate-100 pb-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Printer size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">Multi-Printer, Split Struk & KDS</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Pengaturan cetak struk otomatis (Payment-First) dan kontrol fitur Layar Dapur (KDS).</p>
                  </div>
                </div>
              </div>

              {/* PENGATURAN KDS (KITCHEN DISPLAY SYSTEM) */}
              <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                      <ChefHat size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm text-white">Layar Dapur (Kitchen Display System / KDS)</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${formData.enableKDS ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                          {formData.enableKDS ? 'KDS Aktif' : 'KDS Dinonaktifkan'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                        Jika Anda ingin operasional 100% menggunakan tiket fisik cetak tanpa layar monitor dapur, Anda dapat menonaktifkan KDS agar kasir tidak terbebani proses manual di dapur.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white/5 p-3.5 rounded-xl border border-white/10 shrink-0">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        name="enableKDS" 
                        className="w-4 h-4 rounded border-slate-400 text-indigo-500 focus:ring-indigo-400" 
                        checked={formData.enableKDS ?? true} 
                        onChange={handleChange}
                      />
                      <span className="text-xs font-bold text-white">Tampilkan Menu KDS</span>
                    </label>

                    <div className="hidden sm:block w-px h-6 bg-white/20"></div>

                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        name="autoCompleteKDSOnPay" 
                        className="w-4 h-4 rounded border-slate-400 text-amber-400 focus:ring-amber-400" 
                        checked={formData.autoCompleteKDSOnPay ?? true} 
                        onChange={handleChange}
                      />
                      <span className="text-xs font-bold text-amber-300">Auto Selesaikan saat Bayar</span>
                    </label>
                  </div>
                </div>
              </div>
              
              {/* 3 PRINTER CARDS: KASIR, DAPUR, BAR */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* 1. PRINTER KASIR */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 relative overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <Receipt size={16} />
                      </div>
                      <div>
                        <div className="font-black text-xs text-slate-800">PRINTER KASIR</div>
                        <div className="text-[10px] text-slate-400">Struk Tagihan Pelanggan</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">IP Address Printer Kasir</label>
                      <input 
                        type="text" 
                        name="printerIp" 
                        className="form-control text-xs font-mono" 
                        value={formData.printerIp || ''} 
                        onChange={handleChange}
                        placeholder="192.168.1.200"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Port ESC/POS</label>
                      <input 
                        type="number" 
                        name="printerPort" 
                        className="form-control text-xs font-mono" 
                        value={formData.printerPort || 9100} 
                        onChange={handleChange}
                        placeholder="9100"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    onClick={() => handleTestSpecificPrint('KASIR', formData.printerIp, formData.printerPort)}
                    disabled={testingTarget === 'KASIR'}
                  >
                    <Printer size={14} />
                    {testingTarget === 'KASIR' ? 'Menguji...' : 'Uji Cetak Kasir'}
                  </button>

                  <div className="pt-2 border-t border-slate-100">
                    <label className="flex items-start gap-2 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        name="autoPrintReceipt" 
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 mt-0.5" 
                        checked={formData.autoPrintReceipt || false} 
                        onChange={handleChange}
                      />
                      <span className="text-[11px] font-bold text-slate-600">Auto-Print saat Pembayaran Sukses</span>
                    </label>
                  </div>
                </div>

                {/* 2. PRINTER DAPUR (FOOD) */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 relative overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                        <Utensils size={16} />
                      </div>
                      <div>
                        <div className="font-black text-xs text-slate-800">PRINTER DAPUR (KOT)</div>
                        <div className="text-[10px] text-slate-400">Tiket Makanan & Ramen</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">IP Address Printer Dapur</label>
                      <input 
                        type="text" 
                        name="kitchenPrinterIp" 
                        className="form-control text-xs font-mono" 
                        value={formData.kitchenPrinterIp || ''} 
                        onChange={handleChange}
                        placeholder="192.168.1.201"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Port ESC/POS</label>
                      <input 
                        type="number" 
                        name="kitchenPrinterPort" 
                        className="form-control text-xs font-mono" 
                        value={formData.kitchenPrinterPort || 9100} 
                        onChange={handleChange}
                        placeholder="9100"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl border border-amber-200 flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    onClick={() => handleTestSpecificPrint('DAPUR', formData.kitchenPrinterIp, formData.kitchenPrinterPort)}
                    disabled={testingTarget === 'DAPUR'}
                  >
                    <Printer size={14} />
                    {testingTarget === 'DAPUR' ? 'Menguji...' : 'Uji Cetak Dapur'}
                  </button>

                  <div className="pt-2 border-t border-slate-100">
                    <label className="flex items-start gap-2 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        name="autoPrintKitchen" 
                        className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/20 mt-0.5" 
                        checked={formData.autoPrintKitchen || false} 
                        onChange={handleChange}
                      />
                      <span className="text-[11px] font-bold text-slate-600">Auto-Print saat Simpan Bill / Order Baru</span>
                    </label>
                  </div>
                </div>

                {/* 3. PRINTER BAR (DRINKS) */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 relative overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                        <Coffee size={16} />
                      </div>
                      <div>
                        <div className="font-black text-xs text-slate-800">PRINTER BAR (BOT)</div>
                        <div className="text-[10px] text-slate-400">Tiket Minuman & Barista</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">IP Address Printer Bar</label>
                      <input 
                        type="text" 
                        name="barPrinterIp" 
                        className="form-control text-xs font-mono" 
                        value={formData.barPrinterIp || ''} 
                        onChange={handleChange}
                        placeholder="192.168.1.202"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Port ESC/POS</label>
                      <input 
                        type="number" 
                        name="barPrinterPort" 
                        className="form-control text-xs font-mono" 
                        value={formData.barPrinterPort || 9100} 
                        onChange={handleChange}
                        placeholder="9100"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    onClick={() => handleTestSpecificPrint('BAR', formData.barPrinterIp, formData.barPrinterPort)}
                    disabled={testingTarget === 'BAR'}
                  >
                    <Printer size={14} />
                    {testingTarget === 'BAR' ? 'Menguji...' : 'Uji Cetak Bar'}
                  </button>

                  <div className="pt-2 border-t border-slate-100">
                    <label className="flex items-start gap-2 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        name="autoPrintBar" 
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20 mt-0.5" 
                        checked={formData.autoPrintBar || false} 
                        onChange={handleChange}
                      />
                      <span className="text-[11px] font-bold text-slate-600">Auto-Print saat Simpan Bill / Order Baru</span>
                    </label>
                  </div>
                </div>

              </div>

              {/* MAPPING KATEGORI MENU KE TARGET PRINTER */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
                      <Layers size={18} className="text-indigo-600" />
                      Routing Kategori Menu ke Printer Tujuan
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">Tentukan kemana struk pesanan per kategori menu akan otomatis diarahkan.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categories.map((cat) => {
                    const target = cat.printerTarget || 'KITCHEN';
                    return (
                      <div key={cat.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
                        <div className="font-bold text-xs text-slate-800">{cat.name}</div>
                        <select 
                          className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border cursor-pointer outline-none transition-all ${
                            target === 'KITCHEN' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                            (target === 'BAR' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-200 text-slate-700 border-slate-300')
                          }`}
                          value={target}
                          onChange={(e) => handleUpdateCategoryTarget(cat.id, e.target.value)}
                        >
                          <option value="KITCHEN">🍳 Dapur (Makanan)</option>
                          <option value="BAR">🍹 Bar (Minuman Racikan)</option>
                          <option value="NONE">🥤 Showcase / Kasir Saja</option>
                        </select>
                      </div>
                    );
                  })}
                  {categories.length === 0 && (
                    <div className="col-span-full text-center py-4 text-xs text-slate-400">
                      Memuat daftar kategori menu...
                    </div>
                  )}
                </div>
              </div>
              
              {/* HEADER & FOOTER FORMAT STRUK */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Pesan Pembuka Struk (Header)</label>
                    <textarea 
                      name="receiptHeader" 
                      rows={3} 
                      className="form-control text-sm" 
                      value={formData.receiptHeader} 
                      onChange={handleChange}
                      placeholder="Contoh: Selamat Datang di MUKI RAMEN! Nikmati hidangan autentik kami."
                    ></textarea>
                    <p className="text-[10px] font-semibold text-slate-400 mt-1">Muncul di baris teratas struk printer setelah nama restoran.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Pesan Penutup Struk (Footer)</label>
                    <textarea 
                      name="receiptFooter" 
                      rows={3} 
                      className="form-control text-sm" 
                      value={formData.receiptFooter} 
                      onChange={handleChange}
                      placeholder="Contoh: Arigatou Gozaimasu! Follow Instagram @mukiramen.id"
                    ></textarea>
                    <p className="text-[10px] font-semibold text-slate-400 mt-1">Muncul di baris paling bawah struk belanja setelah rincian total bayar.</p>
                  </div>
                </div>

                {/* Preview Struk Premium */}
                <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200/60 rounded-3xl p-6 shadow-inner">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Sparkles size={12} className="text-amber-500 animate-pulse" /> Live Preview Struk Kasir
                  </div>
                  
                  {/* Mock Receipt Container */}
                  <div className="bg-white w-64 p-5 font-mono text-[10px] text-slate-700 shadow-lg border border-slate-200 relative">
                    <div className="font-black text-center text-xs text-slate-800 uppercase tracking-wide mb-1">{formData.storeName || 'MUKI RAMEN'}</div>
                    <div className="text-center text-[8px] text-slate-400 mb-2 leading-tight whitespace-pre-wrap">{formData.address || 'Jl. Senopati No. 88, Jakarta Selatan'}</div>
                    
                    {formData.receiptHeader && (
                      <div className="border-b border-dashed border-slate-300 text-center mb-2 pb-2 text-[8px] text-slate-500 italic whitespace-pre-wrap">
                        {formData.receiptHeader}
                      </div>
                    )}
                    
                    <div className="text-left space-y-1 my-3">
                      <div className="flex justify-between"><span>2x Tori Paitan Ramen</span><span>116.000</span></div>
                      <div className="flex justify-between"><span>1x Gyoza Panggang</span><span>28.000</span></div>
                      <div className="flex justify-between"><span>2x Ocha Dingin</span><span>24.000</span></div>
                    </div>
                    
                    <div className="border-t border-dashed border-slate-300 mt-2 pt-2 text-right font-black text-slate-800 text-[11px]">
                      TOTAL: Rp 184.800
                    </div>

                    {formData.receiptFooter && (
                      <div className="border-t border-dashed border-slate-300 mt-3 pt-2 text-center text-[8px] text-slate-500 italic whitespace-pre-wrap">
                        {formData.receiptFooter}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pajak' && (
            <div className="space-y-8 animate-fade-in">
              <div className="border-b border-slate-100 pb-4 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Percent size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Pengaturan Pajak & Service Charge</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Konfigurasi persentase PPN (PB1) dan biaya layanan restoran.</p>
                </div>
              </div>
              
              <div className="max-w-2xl space-y-6">
                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 text-xs font-semibold text-indigo-800 flex items-start gap-3">
                  <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    Konfigurasi persentase pajak dan layanan ini akan otomatis ditambahkan ke kalkulasi akhir pada modul Kasir POS dan struk penjualan. 
                    Isi angka **0** jika tidak ingin membebankan biaya tambahan ke pelanggan.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Pajak (PPN / PB1) %</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        name="taxRate" 
                        className="form-control pl-4 pr-10 font-bold text-lg text-slate-800" 
                        value={formData.taxRate} 
                        onChange={handleChange} 
                        placeholder="0"
                        min="0"
                      />
                      <span className="absolute right-4 top-3.5 font-bold text-slate-400">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Service Charge %</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        name="serviceCharge" 
                        className="form-control pl-4 pr-10 font-bold text-lg text-slate-800" 
                        value={formData.serviceCharge} 
                        onChange={handleChange} 
                        placeholder="0"
                        min="0"
                      />
                      <span className="absolute right-4 top-3.5 font-bold text-slate-400">%</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <label className="flex items-start gap-3.5 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      name="includeTax" 
                      className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500/20 mt-0.5" 
                      checked={formData.includeTax} 
                      onChange={handleChange} 
                    />
                    <div>
                      <div className="font-bold text-sm text-slate-800">Harga Menu Termasuk Pajak (Include Tax)</div>
                      <div className="text-xs text-slate-400 mt-1">
                        Aktifkan opsi ini jika harga produk yang Anda input di menu **Produk** sudah bersih/termasuk PPN di dalamnya. 
                        Sistem POS akan mengkalkulasikan DPP (Dasar Pengenaan Pajak) secara otomatis ke belakang layar.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'fitur' && (
            <div className="space-y-8 animate-fade-in">
              <div className="border-b border-slate-100 pb-4 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Settings size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Fitur Tambahan POS</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Personalisasikan fungsionalitas dan fitur penunjang operasional kasir.</p>
                </div>
              </div>

              <div className="max-w-2xl space-y-5">
                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 text-xs font-semibold text-indigo-800 flex items-start gap-3">
                  <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    Mengaktifkan fitur-fitur di bawah ini akan menambahkan parameter opsional pada saat kasir membuat pesanan makanan/minuman di terminal POS.
                  </div>
                </div>

                {/* Drink Customization Toggle Card */}
                <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${formData.enableDrinkCustomization ? 'bg-indigo-50/20 border-indigo-200' : 'bg-white border-slate-200'} shadow-sm`}>
                  <label className="flex items-start justify-between gap-4 cursor-pointer select-none">
                    <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                          <Coffee size={16} className="text-indigo-600" />
                          <span>Kustomisasi Minuman (Sugar, Ice, Temperature)</span>
                        </span>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${formData.enableDrinkCustomization ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                          {formData.enableDrinkCustomization ? '✓ AKTIF' : 'NONAKTIF'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                        Tampilkan opsi pilihan level gula, jumlah es, dan suhu (panas/dingin) saat kasir memasukkan item minuman ke keranjang belanja POS.
                      </p>
                    </div>

                    <div className="relative mt-1 shrink-0">
                      <input
                        type="checkbox"
                        name="enableDrinkCustomization"
                        className="sr-only"
                        checked={formData.enableDrinkCustomization}
                        onChange={handleChange}
                      />
                      <div
                        style={{
                          width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                          background: formData.enableDrinkCustomization ? '#4f46e5' : '#cbd5e1',
                          transition: 'background 0.2s', position: 'relative',
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: 3,
                          left: formData.enableDrinkCustomization ? 23 : 3,
                          width: 18, height: 18, borderRadius: '50%', background: 'white',
                          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </div>
                    </div>
                  </label>
                </div>

                {/* High-Precision Mode Toggle Card */}
                <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${highPrecisionMode ? 'bg-indigo-50/20 border-indigo-200' : 'bg-white border-slate-200'} shadow-sm mt-4`}>
                  <label className="flex items-start justify-between gap-4 cursor-pointer select-none">
                    <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                          <Sliders size={16} className="text-indigo-600" />
                          <span>Mode Presisi Tinggi (Hardware & Sistem Ketat)</span>
                        </span>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${highPrecisionMode ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                          {highPrecisionMode ? '✓ AKTIF' : 'NONAKTIF'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                        Aktifkan untuk terminal kasir utama yang membutuhkan kontrol fisik ketat, cetak matrix bluetooth, pembukaan laci kas RJ11, dan kiosk mode.
                      </p>
                    </div>

                    <div className="relative mt-1 shrink-0">
                      <input
                        type="checkbox"
                        name="highPrecisionMode"
                        className="sr-only"
                        checked={highPrecisionMode}
                        onChange={handleHighPrecisionChange}
                      />
                      <div
                        style={{
                          width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                          background: highPrecisionMode ? '#4f46e5' : '#cbd5e1',
                          transition: 'background 0.2s', position: 'relative',
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: 3,
                          left: highPrecisionMode ? 23 : 3,
                          width: 18, height: 18, borderRadius: '50%', background: 'white',
                          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bayar' && (
            <div className="space-y-8 animate-fade-in">
              <div className="border-b border-slate-100 pb-4 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Metode Pembayaran Non-Tunai</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Konfigurasi info rekening bank untuk transfer kasir serta gambar QRIS statis toko.</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="space-y-5">
                  <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard size={14} className="text-slate-400" />
                    <span>Detail Rekening Bank Penerima</span>
                  </h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nama Bank</label>
                      <input 
                        type="text" 
                        name="bankName" 
                        className="form-control bg-white" 
                        value={formData.bankName} 
                        onChange={handleChange} 
                        placeholder="Contoh: BCA, Mandiri, BRI"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nomor Rekening</label>
                      <input 
                        type="text" 
                        name="accountNumber" 
                        className="form-control bg-white font-mono" 
                        value={formData.accountNumber} 
                        onChange={handleChange} 
                        placeholder="Nomor rekening penerima"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nama Pemilik Rekening (A/N)</label>
                      <input 
                        type="text" 
                        name="accountName" 
                        className="form-control bg-white" 
                        value={formData.accountName} 
                        onChange={handleChange} 
                        placeholder="Atas nama pemegang rekening"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Smartphone size={14} className="text-slate-400" />
                    <span>Kode QRIS Statis Toko</span>
                  </h4>
                  <div className="border-2 border-dashed border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/10 rounded-3xl bg-slate-50 p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 group min-h-[220px]">
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 group-hover:text-indigo-600 group-hover:scale-110 transition-all mb-3">
                      <UploadCloud size={20} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Unggah File QRIS (JPEG/PNG)</span>
                    <span className="text-[10px] text-slate-400 mt-1.5 px-4 leading-relaxed">
                      Kode QR ini akan otomatis muncul pada layar pembayar QRIS di terminal kasir untuk kemudahan scan pelanggan.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'crm' && (
            <div className="space-y-8 animate-fade-in">
              <div className="border-b border-slate-100 pb-4 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Award size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Sistem Loyalitas & Member (CRM)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Konfigurasi opsi keaktifan loyalitas poin belanja, rasio perolehan poin, nilai diskon, dan level keanggotaan.</p>
                </div>
              </div>

              <div className="max-w-3xl space-y-6">
                {/* Enable/Disable Toggle Card */}
                <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${formData.loyaltyEnabled ? 'bg-indigo-50/20 border-indigo-200' : 'bg-white border-slate-200'} shadow-sm`}>
                  <label className="flex items-start justify-between gap-4 cursor-pointer select-none">
                    <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                          <Award size={16} className="text-indigo-600" />
                          <span>Aktifkan Program Loyalitas Belanja</span>
                        </span>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${formData.loyaltyEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                          {formData.loyaltyEnabled ? '✓ AKTIF' : 'NONAKTIF'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                        Berikan poin reward otomatis saat pelanggan bertransaksi dan izinkan penukaran poin sebagai diskon cashback pembayaran di kasir POS.
                      </p>
                    </div>

                    <div className="relative mt-1 shrink-0">
                      <input
                        type="checkbox"
                        name="loyaltyEnabled"
                        className="sr-only"
                        checked={formData.loyaltyEnabled}
                        onChange={handleChange}
                      />
                      <div
                        style={{
                          width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                          background: formData.loyaltyEnabled ? '#4f46e5' : '#cbd5e1',
                          transition: 'background 0.2s', position: 'relative',
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: 3,
                          left: formData.loyaltyEnabled ? 23 : 3,
                          width: 18, height: 18, borderRadius: '50%', background: 'white',
                          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </div>
                    </div>
                  </label>
                </div>

                {formData.loyaltyEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 animate-fade-in">
                    
                    {/* Nilai Perolehan & Penukaran */}
                    <div className="space-y-5 bg-slate-50/50 border border-slate-100 rounded-3xl p-5">
                      <h4 className="font-bold text-xs text-indigo-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <Sparkles size={14} />
                        <span>Konversi Poin & Nilai Belanja</span>
                      </h4>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Kelipatan Belanja Per 1 Poin</label>
                        <div className="relative">
                          <input 
                            type="number" 
                            name="loyaltyEarnPerAmount" 
                            className="form-control pl-4 pr-24 font-bold text-slate-800 bg-white" 
                            value={formData.loyaltyEarnPerAmount} 
                            onChange={handleChange} 
                            min="1"
                          />
                          <span className="absolute right-4 top-3.5 font-bold text-xs text-slate-400">Rupiah belanja</span>
                        </div>
                        <p className="text-[9px] font-semibold text-slate-400 mt-1">Default: Rp 10.000. Pelanggan dapat 1 poin per kelipatan ini.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Nilai Potongan Per 1 Poin (Redeem)</label>
                        <div className="relative">
                          <input 
                            type="number" 
                            name="loyaltyPointValue" 
                            className="form-control pl-4 pr-24 font-bold text-slate-800 bg-white" 
                            value={formData.loyaltyPointValue} 
                            onChange={handleChange} 
                            min="0"
                          />
                          <span className="absolute right-4 top-3.5 font-bold text-xs text-slate-400">Rupiah / Poin</span>
                        </div>
                        <p className="text-[9px] font-semibold text-slate-400 mt-1">Default: Rp 100. Nilai diskon langsung per poin yang ditukar.</p>
                      </div>
                    </div>

                    {/* Leveling / Tiering Thresholds & Multipliers */}
                    <div className="space-y-5 bg-slate-50/50 border border-slate-100 rounded-3xl p-5">
                      <h4 className="font-bold text-xs text-indigo-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <Layers size={14} />
                        <span>Pengaturan Tingkat Keanggotaan (Tier)</span>
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Batas Silver (Rp)</label>
                          <input 
                            type="number" 
                            name="loyaltySilverThreshold" 
                            className="form-control font-bold text-xs bg-white" 
                            value={formData.loyaltySilverThreshold} 
                            onChange={handleChange} 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Multiplier Silver (x)</label>
                          <input 
                            type="number" 
                            name="loyaltySilverMultiplier" 
                            step="0.1" 
                            className="form-control font-bold text-xs bg-white" 
                            value={formData.loyaltySilverMultiplier} 
                            onChange={handleChange} 
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Batas Gold (Rp)</label>
                          <input 
                            type="number" 
                            name="loyaltyGoldThreshold" 
                            className="form-control font-bold text-xs bg-white" 
                            value={formData.loyaltyGoldThreshold} 
                            onChange={handleChange} 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Multiplier Gold (x)</label>
                          <input 
                            type="number" 
                            name="loyaltyGoldMultiplier" 
                            step="0.1" 
                            className="form-control font-bold text-xs bg-white" 
                            value={formData.loyaltyGoldMultiplier} 
                            onChange={handleChange} 
                          />
                        </div>
                      </div>
                      <p className="text-[9px] font-semibold text-slate-400 mt-1">Level Bronze didapatkan secara default (multiplier 1.0x). Multiplier perolehan poin berlaku otomatis setelah pelanggan melewati batas akumulasi belanja.</p>
                    </div>

                  </div>
                )}
              </div>
            </div>
          )}

          {/* â”€â”€â”€ Tab Inventaris â”€â”€â”€ */}
          {activeTab === 'inventaris' && (
            <div className="space-y-8 animate-fade-in">
              <div className="border-b border-slate-100 pb-4 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600"><PackageSearch size={18} /></div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Mode Inventaris & Pelacakan Bahan Baku</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Pilih cara sistem mengelola stok dan menghitung HPP (Harga Pokok Produksi).</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div onClick={() => setFormData(p => ({ ...p, ingredientTrackingEnabled: false }))} className="cursor-pointer"
                  style={{ border: !formData.ingredientTrackingEnabled ? '2.5px solid #4f46e5' : '2px solid #e2e8f0', borderRadius: '1.25rem', padding: '1.5rem', background: !formData.ingredientTrackingEnabled ? '#f5f3ff' : 'white', transition: 'all .2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.75rem' }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Package size={18} className="text-indigo-600" />
                      <span>Simple Mode</span>
                    </div>
                    {!formData.ingredientTrackingEnabled && <span style={{ background: '#4f46e5', color: 'white', fontSize: '.65rem', fontWeight: 700, padding: '.2rem .6rem', borderRadius: '.375rem' }}>AKTIF</span>}
                  </div>
                  <ul style={{ fontSize: '.8rem', color: '#475569', lineHeight: 1.8, paddingLeft: '1rem' }}>
                    <li>HPP diinput manual per produk</li>
                    <li>Stok dilacak per produk jadi</li>
                    <li>PO → naikkan stok produk langsung</li>
                    <li>✓ Cocok untuk kafe baru / operasi sederhana</li>
                  </ul>
                </div>
                <div onClick={() => setFormData(p => ({ ...p, ingredientTrackingEnabled: true }))} className="cursor-pointer"
                  style={{ border: formData.ingredientTrackingEnabled ? '2.5px solid #7c3aed' : '2px solid #e2e8f0', borderRadius: '1.25rem', padding: '1.5rem', background: formData.ingredientTrackingEnabled ? '#faf5ff' : 'white', transition: 'all .2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.75rem' }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Sliders size={18} className="text-indigo-600" />
                      <span>Advanced Mode</span>
                    </div>
                    {formData.ingredientTrackingEnabled && <span style={{ background: '#7c3aed', color: 'white', fontSize: '.65rem', fontWeight: 700, padding: '.2rem .6rem', borderRadius: '.375rem' }}>AKTIF</span>}
                  </div>
                  <ul style={{ fontSize: '.8rem', color: '#475569', lineHeight: 1.8, paddingLeft: '1rem' }}>
                    <li>HPP otomatis dari resep bahan baku</li>
                    <li>Stok dilacak per bahan baku (gram, ml)</li>
                    <li>Order → kurangi stok bahan baku otomatis</li>
                    <li>PO → naikkan stok bahan baku</li>
                    <li>✓ Cocok untuk kafe dengan kontrol biaya ketat</li>
                  </ul>
                </div>
              </div>
              <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '1rem', padding: '1rem 1.25rem', display: 'flex', gap: '.75rem' }}>
                <Info size={18} color="#92400e" style={{ flexShrink: 0, marginTop: '.1rem' }} />
                <p style={{ fontSize: '.8rem', color: '#78350f', lineHeight: 1.7, margin: 0 }}>
                  Mengubah mode tidak menghapus data. Menu <strong>Bahan Baku</strong> di sidebar hanya muncul jika Advanced Mode aktif.
                  Isi resep menu di <strong>Produk â†’ Edit â†’ Tab Resep</strong> sebelum mengaktifkan Advanced Mode.
                </p>
              </div>
            </div>
          )}

          {/* ─── Tab Printer Bluetooth ─── */}
          {activeTab === 'printer_bt' && (
            <div className="space-y-8 animate-fade-in">
              <div className="border-b border-slate-100 pb-4 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600"><Printer size={18} /></div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Pengaturan Printer Bluetooth</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Pindai dan hubungkan tablet Anda dengan printer termal nirkabel lokal.</p>
                </div>
              </div>
              
              {!isNativeMobile() ? (
                <div className="p-4 border border-amber-100 bg-amber-50/50 rounded-2xl flex items-start gap-3">
                  <Info className="text-amber-600 shrink-0 mt-0.5" size={18} />
                  <div className="text-xs text-amber-800 font-medium leading-relaxed">
                    Pengaturan printer Bluetooth serial hanya dapat diakses melalui aplikasi native mobile POS (HP/Tablet) Android & iOS. Saat ini Anda mengakses aplikasi melalui browser web standar.
                  </div>
                </div>
              ) : (
                <>
                  {!highPrecisionMode && (
                    <div className="p-4 border border-amber-100 bg-amber-50/50 rounded-2xl flex items-start gap-3 mb-4">
                      <Info className="text-amber-600 shrink-0 mt-0.5" size={18} />
                      <div className="text-xs text-amber-800 font-medium leading-relaxed">
                        Catatan: <strong>Mode Presisi Tinggi</strong> sedang nonaktif. Aktifkan Mode Presisi Tinggi di tab <strong>Fitur Tambahan POS</strong> jika perangkat ini ingin melakukan cetak Bluetooth otomatis saat checkout kasir.
                      </div>
                    </div>
                  )}
                  <BluetoothPrinterConfig />
                </>
              )}
            </div>
          )}

          {activeTab === 'database' && (
            <div className="space-y-8 animate-fade-in">
              <div className="border-b border-slate-100 pb-4 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Database size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Database & Backup</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Cadangkan data transaksi Anda atau restart server backend kasir.</p>
                </div>
              </div>
              <DatabaseSettingsPanel token={posContext?.token} />
            </div>
          )}

          {activeTab === 'absensi_gps' && (
            <div className="space-y-8 animate-fade-in">
              <div className="border-b border-slate-100 pb-4 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <MapPin size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Pengaturan Absensi, GPS, & Shift Kerja</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Konfigurasi radius geofencing lokasi toko, validasi kamera selfie, dan master shift kerja staf.
                  </p>
                </div>
              </div>

              {/* PWA SHORTCUT BANNER */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Smartphone className="text-amber-600" size={18} />
                    <h4 className="text-sm font-black text-slate-900">Aplikasi PWA Staf & Dapur</h4>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Staf dapat membuka <strong>{window.location.origin}/staff</strong> di browser smartphone untuk melakukan absensi selfie & input stok dapur.
                  </p>
                </div>
                <a
                  href="/staff"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-md shadow-amber-500/20 whitespace-nowrap"
                >
                  Buka PWA Staf
                </a>
              </div>

              {/* GEOFENCING GPS FORM */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4 p-5 rounded-2xl border border-slate-200 bg-white">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin size={14} className="text-rose-500" /> Koordinat & Radius Toko
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Latitude Toko</label>
                      <input
                        type="number"
                        step="any"
                        name="storeLatitude"
                        value={formData.storeLatitude}
                        onChange={handleChange}
                        className="form-control text-xs font-mono"
                        placeholder="-6.200000"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Longitude Toko</label>
                      <input
                        type="number"
                        step="any"
                        name="storeLongitude"
                        value={formData.storeLongitude}
                        onChange={handleChange}
                        className="form-control text-xs font-mono"
                        placeholder="106.816666"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Radius Toleransi Kehadiran (Meter)
                    </label>
                    <input
                      type="number"
                      name="gpsRadiusMeters"
                      value={formData.gpsRadiusMeters}
                      onChange={handleChange}
                      className="form-control text-xs"
                      placeholder="100"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Karyawan harus berada maksimal dalam radius ini dari koordinat toko agar absensi berstatus <strong>Hadir</strong>.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleGetDeviceCoordinates}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-slate-200"
                  >
                    <MapPin size={14} className="text-indigo-600" /> Gunakan Koordinat GPS Perangkat Ini
                  </button>
                </div>

                {/* TOGGLES */}
                <div className="space-y-4 p-5 rounded-2xl border border-slate-200 bg-white">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert size={14} className="text-indigo-600" /> Validasi & Keamanan Absensi
                  </h4>

                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        name="enableGpsValidation"
                        checked={formData.enableGpsValidation}
                        onChange={handleChange}
                        className="w-4 h-4 text-indigo-600 rounded mt-0.5"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Wajibkan Validasi Radius GPS</span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Tolak Clock In jika karyawan berada di luar radius meter toko yang ditentukan.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        name="enableCameraPhoto"
                        checked={formData.enableCameraPhoto}
                        onChange={handleChange}
                        className="w-4 h-4 text-indigo-600 rounded mt-0.5"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Wajibkan Foto Selfie Kamera</span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Karyawan wajib mengambil foto selfie wajah saat menekan tombol Clock In.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* MASTER SHIFT KERJA */}
              <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock size={14} className="text-indigo-600" /> Master Shift Operasional Toko
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Shift kerja yang dapat dipilih oleh staf sebelum melakukan Clock In.
                    </p>
                  </div>
                </div>

                {/* SHIFT LIST */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {shiftsList.map(shift => (
                    <div key={shift.id} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2 relative group">
                      <div className="flex justify-between items-start">
                        <h5 className="text-xs font-black text-slate-900">{shift.name}</h5>
                        {shiftsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteShift(shift.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg"
                            title="Hapus Shift"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 font-semibold space-y-0.5">
                        <p>Jam: <strong>{shift.start} - {shift.end}</strong></p>
                        <p>Toleransi: <strong>{shift.lateTolerance} Menit</strong></p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* FORM TAMBAH SHIFT */}
                <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row items-end gap-3">
                  <div className="flex-1 w-full">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nama Shift Baru</label>
                    <input
                      type="text"
                      value={newShift.name}
                      onChange={e => setNewShift({ ...newShift, name: e.target.value })}
                      placeholder="Misal: Shift Malam (22:00 - 06:00)"
                      className="form-control text-xs"
                    />
                  </div>
                  <div className="w-full md:w-32">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Jam Mulai</label>
                    <input
                      type="time"
                      value={newShift.start}
                      onChange={e => setNewShift({ ...newShift, start: e.target.value })}
                      className="form-control text-xs"
                    />
                  </div>
                  <div className="w-full md:w-32">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Jam Selesai</label>
                    <input
                      type="time"
                      value={newShift.end}
                      onChange={e => setNewShift({ ...newShift, end: e.target.value })}
                      className="form-control text-xs"
                    />
                  </div>
                  <div className="w-full md:w-32">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Toleransi (Mnt)</label>
                    <input
                      type="number"
                      value={newShift.lateTolerance}
                      onChange={e => setNewShift({ ...newShift, lateTolerance: Number(e.target.value) })}
                      className="form-control text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddShift}
                    className="w-full md:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold whitespace-nowrap shadow-sm"
                  >
                    + Tambah Shift
                  </button>
                </div>
              </div>

              {/* REWARD & PUNISHMENT KARYAWAN */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* KARTU REWARD: BONUS ZERO LATE */}
                <div className="p-5 rounded-2xl border border-emerald-100 bg-emerald-50/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                        🎁
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                          Reward: Bonus Zero Late
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Insentif bulanan staf tanpa keterlambatan.
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="enableZeroLateBonus"
                        checked={formData.enableZeroLateBonus}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {formData.enableZeroLateBonus && (
                    <div className="space-y-3 pt-2 border-t border-emerald-100/60 animate-fade-in">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Nominal Bonus Bulanan (Rp)
                        </label>
                        <input
                          type="number"
                          name="zeroLateBonusAmount"
                          value={formData.zeroLateBonusAmount}
                          onChange={handleChange}
                          className="form-control text-xs font-bold text-emerald-700"
                          placeholder="200000"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          Bonus yang diperoleh karyawan jika 0 kali terlambat.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                            Min. Hadir (Hari/Bln)
                          </label>
                          <input
                            type="number"
                            name="zeroLateMinAttendance"
                            value={formData.zeroLateMinAttendance}
                            onChange={handleChange}
                            className="form-control text-xs"
                            placeholder="20"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                            Maks. Telat Ditoleransi
                          </label>
                          <input
                            type="number"
                            name="zeroLateMaxLateAllowed"
                            value={formData.zeroLateMaxLateAllowed}
                            onChange={handleChange}
                            className="form-control text-xs"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* KARTU PUNISHMENT: POTONGAN TELAT & ALPA */}
                <div className="p-5 rounded-2xl border border-rose-100 bg-rose-50/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 font-bold">
                        ⚖️
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                          Punishment: Potongan Telat
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Denda atas keterlambatan & ketidakhadiran.
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="enableLatePenalty"
                        checked={formData.enableLatePenalty}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                    </label>
                  </div>

                  {formData.enableLatePenalty && (
                    <div className="space-y-3 pt-2 border-t border-rose-100/60 animate-fade-in">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Metode Hitung Potongan
                        </label>
                        <select
                          name="latePenaltyType"
                          value={formData.latePenaltyType}
                          onChange={handleChange}
                          className="form-control text-xs"
                        >
                          <option value="FLAT">Flat per Kejadian Telat (Rp / Kejadian)</option>
                          <option value="PER_MINUTE">Per Menit Keterlambatan (Rp / Menit)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Nominal Potongan {formData.latePenaltyType === 'PER_MINUTE' ? '(Rp / Menit)' : '(Rp / Kejadian)'}
                        </label>
                        <input
                          type="number"
                          name="latePenaltyAmount"
                          value={formData.latePenaltyAmount}
                          onChange={handleChange}
                          className="form-control text-xs font-bold text-rose-700"
                          placeholder={formData.latePenaltyType === 'PER_MINUTE' ? '1000' : '10000'}
                        />
                      </div>
                    </div>
                  )}

                  {/* SUB: POTONGAN ALPA */}
                  <div className="pt-3 border-t border-rose-100/60">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-700">Potongan Alpa (Tanpa Izin)</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          name="enableAlphaPenalty"
                          checked={formData.enableAlphaPenalty}
                          onChange={handleChange}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                      </label>
                    </div>
                    {formData.enableAlphaPenalty && (
                      <div>
                        <input
                          type="number"
                          name="alphaPenaltyAmount"
                          value={formData.alphaPenaltyAmount}
                          onChange={handleChange}
                          className="form-control text-xs font-bold text-rose-700"
                          placeholder="50000"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          Nominal potongan per hari alpa.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'koneksi_server' && (
            <div className="space-y-8 animate-fade-in">
              <div className="border-b border-slate-100 pb-4 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Smartphone size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Koneksi Terminal POS</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Konfigurasikan alamat IP atau URL server backend untuk terminal kasir ini.</p>
                </div>
              </div>
              <TerminalConnectionConfig />
            </div>
          )}

          {/* Bottom Save Action for settings tabs */}
          {['profil', 'struk', 'pajak', 'bayar', 'fitur', 'crm', 'inventaris', 'absensi_gps'].includes(activeTab) && (
            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-end">
              <button 
                type="button"
                className="btn btn-primary shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all font-bold text-xs sm:text-sm hover:scale-[1.02] w-full sm:w-auto" 
                onClick={handleSave}
                disabled={loading}
              >
                <Save size={16} /> {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

const BluetoothPrinterConfig = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selectedMac, setSelectedMac] = useState(localStorage.getItem('bluetooth_printer_mac') || '');
  const [connecting, setConnecting] = useState(false);

  const scan = async () => {
    setScanning(true);
    try {
      const list = await listPairedBluetoothDevices();
      setDevices(list);
      toast(`Menemukan ${list.length} perangkat Bluetooth terpasang.`, 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal memindai Bluetooth', 'error');
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    if (isNativeMobile()) {
      scan();
    }
  }, []);

  const handleSelectPrinter = async (mac: string) => {
    setConnecting(true);
    try {
      await connectBluetoothPrinter(mac);
      await disconnectBluetoothPrinter();
      
      localStorage.setItem('bluetooth_printer_mac', mac);
      setSelectedMac(mac);
      toast('Printer Bluetooth berhasil terhubung dan disimpan!', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal terhubung ke printer', 'error');
    } finally {
      setConnecting(false);
    }
  };

  const handleTestPrintBt = async () => {
    if (!selectedMac) {
      toast('Pilih printer terlebih dahulu', 'warning');
      return;
    }

    try {
      await connectBluetoothPrinter(selectedMac);
      const encoder = new EscPosEncoder();
      const bytes = encoder
        .initialize()
        .align('center')
        .line('SOL CAFE')
        .line('=== TEST PRINT OK ===')
        .line('Printer Bluetooth Terkoneksi!')
        .line(new Date().toLocaleString())
        .line('\n\n\n')
        .cut()
        .encode();
      
      await printRawBytes(bytes);
      await disconnectBluetoothPrinter();
      toast('Test print berhasil dikirim!', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal melakukan test print', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={scan}
          disabled={scanning}
          className="btn btn-outline flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold"
        >
          {scanning ? 'Memindai...' : 'Pindai Perangkat'}
        </button>
        {selectedMac && (
          <button
            type="button"
            onClick={handleTestPrintBt}
            className="btn btn-primary bg-indigo-600 border-indigo-600 flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold"
          >
            <Printer size={14} /> Tes Cetak Struk
          </button>
        )}
      </div>

      <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
        <div className="bg-slate-50 px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
          Daftar Perangkat Bluetooth Berpasangan
        </div>
        {devices.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 font-semibold leading-relaxed">
            Tidak ada perangkat Bluetooth paired ditemukan.<br />
            Pastikan printer thermal telah diaktifkan dan disandingkan (paired) di menu Pengaturan Bluetooth tablet Anda.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {devices.map(d => (
              <div key={d.id} className="p-4 flex justify-between items-center hover:bg-slate-50/50 transition-colors">
                <div>
                  <div className="text-sm font-bold text-slate-800">{d.name || 'Printer Bluetooth'}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-wider">{d.id}</div>
                </div>
                <button
                  type="button"
                  disabled={connecting}
                  onClick={() => handleSelectPrinter(d.id)}
                  className={`btn px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedMac === d.id 
                      ? 'btn-primary bg-green-600 border-green-600 text-white hover:bg-green-700 shadow-md shadow-green-600/10' 
                      : 'btn-outline border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {selectedMac === d.id ? 'Terpilih' : 'Hubungkan'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const DatabaseSettingsPanel = ({ token }: { token: string | null | undefined }) => {
  const [backingUp, setBackingUp] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const handleBackup = async () => {
    if (!token) return;
    setBackingUp(true);
    try {
      const response = await fetch('/api/database/backup', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Gagal melakukan backup database');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-poscafe-${new Date().toISOString().slice(0,10)}.db`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast('Backup database berhasil diunduh!', 'success');
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan saat mengunduh backup', 'error');
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestart = async () => {
    const result = await confirmAlert(
      'Restart Server POS?',
      'Apakah Anda yakin ingin melakukan restart pada server POS? Koneksi akan terputus sementara selama beberapa detik.'
    );
    if (!result.isConfirmed) return;

    setRestarting(true);
    try {
      const response = await fetch('/api/database/restart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (response.ok) {
        toast(data.message || 'Server sedang merestart...', 'success');
        setTimeout(() => {
          window.location.reload();
        }, 5000);
      } else {
        toast(data.error || 'Gagal merestart server', 'error');
      }
    } catch (err: any) {
      // It's normal to catch network error if server exits instantly
      toast('Perintah restart berhasil dikirim. Halaman akan dimuat ulang...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } finally {
      setRestarting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 text-xs font-semibold text-indigo-800 flex items-start gap-3">
        <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
        <div>
          Lakukan backup database secara berkala untuk menghindari kehilangan data penting toko. 
          Restart server dapat digunakan untuk memuat ulang konfigurasi sistem atau membebaskan memori server.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backup Card */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-sm transition-all space-y-4">
          <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <UploadCloud size={16} />
            </div>
            <span>Cadangkan Database (Backup)</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Unduh seluruh data POS Anda (transaksi, stok, resep, member, dll) ke dalam file `.db`. 
            File ini dapat digunakan untuk merestorasi data jika terjadi kerusakan sistem di masa mendatang.
          </p>
          <button
            type="button"
            onClick={handleBackup}
            disabled={backingUp}
            className="btn btn-primary bg-indigo-600 border-indigo-600 text-xs font-bold py-2.5 px-4 w-full flex items-center justify-center gap-2"
          >
            <UploadCloud size={14} />
            {backingUp ? 'Mengunduh...' : 'Unduh Backup Database (.db)'}
          </button>
        </div>

        {/* Restart Card */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-sm transition-all space-y-4">
          <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-650">
              <RefreshCw size={16} />
            </div>
            <span>Restart Server POS Cafe</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Matikan sementara dan nyalakan ulang proses backend POS di VPS (melalui pengelola proses PM2). 
            Berguna jika server melambat atau untuk me-refresh cache database.
          </p>
          <button
            type="button"
            onClick={handleRestart}
            disabled={restarting}
            className="btn btn-danger text-xs font-bold py-2.5 px-4 w-full flex items-center justify-center gap-2"
            style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '0.75rem', cursor: 'pointer' }}
          >
            <RefreshCw size={14} className={restarting ? 'animate-spin' : ''} />
            {restarting ? 'Merestart Server...' : 'Restart Server Sekarang'}
          </button>
        </div>
      </div>
    </div>
  );
};

const TerminalConnectionConfig = () => {
  const defaultUrl = window.location.origin.includes('localhost') || window.location.origin.startsWith('file:') || window.location.origin.startsWith('capacitor:')
    ? 'http://localhost:5000'
    : window.location.origin;
  const [backendUrl, setBackendUrl] = useState(
    localStorage.getItem('pos_backend_url') || defaultUrl
  );
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const handleTestConnection = async () => {
    setTesting(true);
    setTestStatus('idle');
    setTestMessage('');
    try {
      const cleanUrl = backendUrl.trim().endsWith('/') ? backendUrl.trim().slice(0, -1) : backendUrl.trim();
      const res = await fetch(`${cleanUrl}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.status === 'OK') {
        setTestStatus('success');
        setTestMessage('Terhubung! Server backend aktif dan merespon dengan baik.');
        toast('Koneksi ke server berhasil!', 'success');
      } else {
        setTestStatus('error');
        setTestMessage(data.message || 'Server merespon, namun status kesehatan tidak OK.');
        toast('Koneksi gagal: respon tidak valid', 'error');
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.message || 'Gagal terhubung ke server. Pastikan alamat IP/URL benar, server telah dijalankan, dan berada di jaringan WiFi yang sama.');
      toast('Gagal terhubung ke server', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConnection = () => {
    let cleanUrl = backendUrl.trim();
    if (!cleanUrl) {
      toast('Alamat URL Server tidak boleh kosong!', 'warning');
      return;
    }
    // Ensure it starts with http:// or https://
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`;
    }
    localStorage.setItem('pos_backend_url', cleanUrl);
    toast('Konfigurasi URL Server berhasil disimpan! Halaman akan dimuat ulang.', 'success');
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 text-xs font-semibold text-indigo-800 flex items-start gap-3">
        <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
        <div>
          Secara bawaan (default), terminal kasir terhubung ke <strong>http://localhost:5000</strong>. 
          Anda dapat mengubahnya ke alamat IP server lokal di toko Anda (misal: <code>http://192.168.1.100:5000</code>) 
          atau URL domain VPS online (misal: <code>http://cafe.codenusa.id</code>) untuk menghubungkan terminal tablet ini.
        </div>
      </div>

      <div className="max-w-xl p-6 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-sm transition-all space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
            Alamat URL / IP Server Backend
          </label>
          <input
            type="text"
            className="form-control bg-white font-mono text-sm"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="Contoh: http://localhost:5000 atau http://192.168.1.100:5000"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="btn btn-outline flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold w-1/2"
            style={{ border: '1px solid #e2e8f0' }}
          >
            {testing ? 'Menguji...' : 'Tes Koneksi'}
          </button>
          <button
            type="button"
            onClick={handleSaveConnection}
            className="btn btn-primary bg-indigo-600 border-indigo-600 text-xs font-bold py-2.5 px-4 w-1/2 flex items-center justify-center gap-2"
          >
            <Check size={14} />
            Simpan & Terapkan
          </button>
        </div>

        {testStatus !== 'idle' && (
          <div
            className={`p-4 rounded-xl text-xs font-semibold flex items-start gap-2.5 animate-fade-in ${
              testStatus === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                : 'bg-red-50 text-red-800 border border-red-100'
            }`}
          >
            {testStatus === 'success' ? (
              <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">✓</div>
            ) : (
              <div className="w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0">!</div>
            )}
            <div className="leading-relaxed">{testMessage}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsView;
