import React, { useState, useEffect, useContext } from 'react';
import { Settings, Store, Receipt, Percent, CreditCard, Image as ImageIcon, Save, UploadCloud, Phone, MapPin, Sparkles, Check, Info, ShieldAlert, Award, PackageSearch, Coffee, Smartphone, Sliders, Package, Layers, Printer, Database, RefreshCw, Utensils, ChefHat, Clock, X, Boxes, Flame, EyeOff, ShieldCheck, ExternalLink, Compass, Headphones, MessageSquare, Shirt, AlertCircle } from 'lucide-react';
import { POSContext } from '../context/POSContext';

import { toast, confirmAlert, errorAlert } from '../utils/alert';
import { useSearchParams } from 'react-router-dom';
import SettingsBluetoothPrinter from './settings/SettingsBluetoothPrinter';
import TenantResetModal from './TenantResetModal';
import RecycleBinModal from './RecycleBinModal';
import TenantPWASection from './TenantPWASection';
import SettingsWhatsAppGateway from './settings/SettingsWhatsAppGateway';

const SettingsView = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'profil');
  const [mobileNavMode, setMobileNavMode] = useState<'grid' | 'slider'>('grid');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);
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
    enableKitchenAuditMode: false,
    enableStaffMealTracking: true,
    enableBlindClose: true,
    warehouseTransferPricing: 'AT_COST',
    warehouseMarkupPercent: 0,
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
    googleMapsUrl: '',
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
    // Sistem Bagi Hasil (Profit Sharing)
    profitSharingOwnerPercent: 80,
    profitSharingRamenPercent: 20,
    profitSharingDrinkPercent: 20,
    profitSharingOpexMode: 'BEFORE_SPLIT',
    // Bonus Harian Omzet Karyawan
    enableDailyOmzetBonus: true,
    dailyOmzetTiers: '',
  });

  const [dailyTiersList, setDailyTiersList] = useState<Array<{ minOmzet: number; bonus: number; label?: string }>>([
    { minOmzet: 6000000, bonus: 25000, label: 'Tier >= 6.0 Juta' },
    { minOmzet: 5000000, bonus: 20000, label: 'Tier >= 5.0 Juta' },
    { minOmzet: 4000000, bonus: 15000, label: 'Tier >= 4.0 Juta' },
    { minOmzet: 3000000, bonus: 10000, label: 'Tier >= 3.0 Juta' },
    { minOmzet: 2500000, bonus: 5000,  label: 'Tier >= 2.5 Juta' }
  ]);
  const [newTier, setNewTier] = useState({ minOmzet: 3500000, bonus: 12500, label: '' });

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
      if (posContext.settings.dailyOmzetTiers) {
        try {
          const parsedTiers = JSON.parse(posContext.settings.dailyOmzetTiers);
          if (Array.isArray(parsedTiers) && parsedTiers.length > 0) setDailyTiersList(parsedTiers);
        } catch {}
      }
    }
  }, [posContext?.settings]);

  const handleAddTier = () => {
    if (!newTier.minOmzet || Number(newTier.minOmzet) <= 0) return toast('Min omzet harus lebih dari 0', 'warning');
    if (!newTier.bonus || Number(newTier.bonus) <= 0) return toast('Nominal bonus harus lebih dari 0', 'warning');
    const label = newTier.label.trim() || `Tier >= Rp ${(Number(newTier.minOmzet) / 1000000).toFixed(1)} Juta`;
    const updated = [...dailyTiersList, { minOmzet: Number(newTier.minOmzet), bonus: Number(newTier.bonus), label }];
    updated.sort((a, b) => Number(b.minOmzet) - Number(a.minOmzet));
    setDailyTiersList(updated);
    setFormData(prev => ({ ...prev, dailyOmzetTiers: JSON.stringify(updated) }));
    setNewTier({ minOmzet: 0, bonus: 0, label: '' });
    toast('Tier bonus baru berhasil ditambahkan!', 'success');
  };

  const handleDeleteTier = (idx: number) => {
    if (dailyTiersList.length <= 1) return toast('Minimal harus menyisakan 1 tier omzet', 'warning');
    const updated = dailyTiersList.filter((_, i) => i !== idx);
    setDailyTiersList(updated);
    setFormData(prev => ({ ...prev, dailyOmzetTiers: JSON.stringify(updated) }));
    toast('Tier berhasil dihapus', 'info');
  };

  const [resolvingMaps, setResolvingMaps] = useState(false);

  const handleResolveMaps = async (customUrl?: string) => {
    const targetUrl = (customUrl || formData.googleMapsUrl || '').trim();
    if (!targetUrl && !formData.storeLatitude && !formData.storeLongitude) {
      return toast('Masukkan Link Google Maps atau koordinat toko terlebih dahulu', 'warning');
    }

    setResolvingMaps(true);
    try {
      const res = await fetch('/api/settings/resolve-maps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          url: targetUrl || undefined,
          latitude: formData.storeLatitude || undefined,
          longitude: formData.storeLongitude || undefined
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const { latitude, longitude, address, placeName, googleMapsUrl } = json.data;
        setFormData(prev => ({
          ...prev,
          storeLatitude: latitude,
          storeLongitude: longitude,
          googleMapsUrl: googleMapsUrl || targetUrl,
          ...(address ? { address } : {})
        }));
        toast(`Lokasi & Alamat berhasil dideteksi! ${placeName ? `${placeName} — ` : ''}${address ? 'Alamat toko otomatis disinkronkan.' : ''}`, 'success');
      } else {
        toast(json.error || 'Gagal mendeteksi lokasi dari Google Maps', 'error');
      }
    } catch (err: any) {
      toast('Terjadi kesalahan saat memproses link Google Maps: ' + err.message, 'error');
    } finally {
      setResolvingMaps(false);
    }
  };

  const handleGetDeviceCoordinates = () => {
    if (!navigator.geolocation) {
      return toast('Browser tidak mendukung Geolocation', 'error');
    }
    toast('Mendeteksi koordinat GPS perangkat...', 'info');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;
        setFormData(prev => ({
          ...prev,
          storeLatitude: lat,
          storeLongitude: lon,
          googleMapsUrl: mapsUrl
        }));
        toast(`Koordinat berhasil diambil: ${lat.toFixed(6)}, ${lon.toFixed(6)}`, 'success');

        // Otomatis tarik alamat dari koordinat baru
        try {
          const res = await fetch('/api/settings/resolve-maps', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${posContext?.token}`
            },
            body: JSON.stringify({ latitude: lat, longitude: lon })
          });
          const json = await res.json();
          if (res.ok && json.success && json.data.address) {
            setFormData(prev => ({ ...prev, address: json.data.address }));
            toast('Alamat toko otomatis diperbarui sesuai titik GPS perangkat!', 'success');
          }
        } catch {}
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

  const businessType: 'CAFE' | 'BENGKEL' | 'RETAIL' | 'LAUNDRY' | 'RENTAL' = ((formData as any).businessType || posContext?.settings?.businessType || 'CAFE').toUpperCase() as any;
  const isBengkel = businessType === 'BENGKEL';
  const isRetail = businessType === 'RETAIL';
  const isLaundry = businessType === 'LAUNDRY';
  const isRental = businessType === 'RENTAL';
  const isCafe = businessType === 'CAFE';
  const verticalStore = isRental ? 'Sanggar Busana' : (isBengkel ? 'Bengkel' : isRetail ? 'Toko Retail' : isLaundry ? 'Laundry' : 'Kafe');
  const verticalPrinter = isRental ? 'Nota Sewa & Printer' : (isBengkel ? 'SPK & Printer' : isRetail ? 'Struk & Barcode' : isLaundry ? 'Nota Laundry' : 'Printer & KDS');

  const allTabs = [
    { 
      id: 'profil', 
      label: `Profil ${verticalStore}`, 
      desc: `Identitas, alamat, kontak, & logo resmi ${verticalStore.toLowerCase()}`, 
      icon: Store, 
      category: 'store', 
      show: true 
    },
    { 
      id: 'branding', 
      label: 'Branding & Tampilan', 
      desc: 'Warna tema brand, cover login, & tata letak aplikasi', 
      icon: Sparkles, 
      category: 'store', 
      show: true 
    },
    { 
      id: 'jam_operasional', 
      label: 'Jam Operasional & Shift', 
      desc: 'Jadwal buka-tutup outlet & toleransi shift kerja', 
      icon: Clock, 
      category: 'store', 
      show: true 
    },
    { 
      id: 'struk', 
      label: verticalPrinter, 
      desc: isRental ? 'Format lembar kontrak sewa, jaminan & printer kasir' : (isBengkel ? 'Format SPK, estimasi biaya & struk thermal' : (isRetail ? 'Format struk belanja & barcode thermal' : (isLaundry ? 'Format nota timbangan & label rak cuci' : 'Format nota thermal, target dapur/bar & KDS'))), 
      icon: Receipt, 
      category: 'pos', 
      show: true 
    },
    { 
      id: 'pwa_mobile', 
      label: 'Aplikasi Mobile & PWA', 
      desc: 'Link mandiri per tenant, QR Code tablet kasir & portal absensi staf', 
      icon: Smartphone, 
      category: 'pos', 
      show: true 
    },
    { 
      id: 'printer_bt', 
      label: 'Printer Bluetooth', 
      desc: 'Koneksi printer thermal mobile Android & Web Bluetooth', 
      icon: Printer, 
      category: 'pos', 
      show: true 
    },
    { 
      id: 'koneksi_server', 
      label: 'Koneksi Terminal', 
      desc: 'IP backend server & sinkronisasi kasir multi-device', 
      icon: Smartphone, 
      category: 'pos', 
      show: true 
    },
    { 
      id: 'bayar', 
      label: 'Metode Pembayaran', 
      desc: 'QRIS statis/dinamis, transfer rekening bank, & kas tunai', 
      icon: CreditCard, 
      category: 'finance', 
      show: true 
    },
    { 
      id: 'pajak', 
      label: 'Pajak & Service', 
      desc: 'Pengaturan persentase PB1/PPN & service charge toko', 
      icon: Percent, 
      category: 'finance', 
      show: true 
    },
    { 
      id: 'fitur', 
      label: 'Mode Operasional POS', 
      desc: 'Aturan transaksi kasir, tier harga, & opsi pesanan', 
      icon: Settings, 
      category: 'finance', 
      show: true 
    },
    { 
      id: 'bagi_hasil', 
      label: 'Bagi Hasil & Bonus', 
      desc: 'Skema bonus target omzet harian & pembagian profit', 
      icon: Sliders, 
      category: 'finance', 
      show: true 
    },
    { 
      id: 'crm', 
      label: 'CRM & Member', 
      desc: 'Tingkatan tier loyalitas member & perolehan poin belanja', 
      icon: Award, 
      category: 'team', 
      show: true 
    },
    { 
      id: 'absensi_gps', 
      label: 'Absensi & GPS Toko', 
      desc: 'Titik koordinat outlet & radius geofencing presensi karyawan', 
      icon: MapPin, 
      category: 'team', 
      show: true 
    },
    { 
      id: 'inventaris', 
      label: isRental ? 'Aset Busana & Perawatan' : 'Mode Inventaris', 
      desc: isRental ? 'Pelacakan aset busana, nomor gantungan & perawatan' : (isBengkel ? 'Pelacakan stok sparepart & audit fisik' : (isRetail ? 'Pelacakan stok barang dagangan & multi-gudang' : (isLaundry ? 'Pelacakan deterjen, pewangi & konsumabel' : 'Pelacakan bahan baku, resep BOM & transfer gudang'))), 
      icon: PackageSearch, 
      category: 'system', 
      show: true 
    },
    { 
      id: 'whatsapp', 
      label: 'WhatsApp Gateway', 
      desc: 'Gateway WhatsApp mandiri untuk e-Receipt kasir, SPK, dan notifikasi pelanggan', 
      icon: MessageSquare, 
      category: 'system', 
      show: true 
    },
    { 
      id: 'database', 
      label: 'Database & Backup', 
      desc: 'Cadangkan data snapshot JSON, restore, atau reset toko', 
      icon: Database, 
      category: 'system', 
      show: true 
    },
    { 
      id: 'bantuan_cs', 
      label: 'Bantuan & CS 24/7', 
      desc: 'Kontak support WhatsApp teknisi resmi & pusat bantuan', 
      icon: Headphones, 
      category: 'system', 
      show: true 
    },
  ];
  const currentTab = allTabs.find(t => t.id === activeTab) || allTabs[0];
  const CurrentIcon = currentTab.icon;

  return (
    <div className="p-3 sm:p-6 lg:p-8 w-full flex flex-col pb-52 sm:pb-20">
      {/* Desktop Header Action Bar */}
      <div className="hidden sm:flex justify-between items-center gap-4 mb-6 shrink-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-slate-800 tracking-tight">
            <Settings className="text-indigo-600" size={26} /> Pengaturan Sistem
          </h2>
          <p className="text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-wider">
            Konfigurasi profil toko, mode POS, format struk printer, & metode pembayaran.
          </p>
        </div>
        <button 
          className="btn btn-primary shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all font-bold text-sm active:scale-95 shrink-0" 
          onClick={handleSave}
          disabled={loading}
        >
          <Save size={16} /> {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>

      {/* Mobile Top App Bar (Sleek Super App Header) */}
      <div className="lg:hidden mb-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <CurrentIcon size={16} />
          </div>
          <div>
            <h2 className="text-xs font-black text-slate-800 leading-tight">{currentTab.label}</h2>
            <p className="text-[10px] text-slate-400">Pengaturan Sistem {verticalStore}</p>
          </div>
        </div>

        {/* View Switcher: Grid vs Slider */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setMobileNavMode('grid')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
              mobileNavMode === 'grid' 
                ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/60 font-black' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Boxes size={12} />
            <span>Grid ({allTabs.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileNavMode('slider')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
              mobileNavMode === 'slider' 
                ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/60 font-black' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders size={12} />
            <span>Geser</span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Hub: ALL 13 SETTINGS BUTTONS */}
      {mobileNavMode === 'grid' ? (
        <div className="lg:hidden mb-4 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-sm animate-fade-in">
          <div className="flex items-center justify-between mb-2.5 px-0.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Boxes size={12} className="text-indigo-600" />
              <span>Semua Modul Pengaturan ({allTabs.length} Menu)</span>
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {allTabs.map(tab => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex flex-col items-center justify-center p-2 rounded-xl text-center transition-all active:scale-95 cursor-pointer border ${
                    isSelected
                      ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20 border-indigo-600'
                      : 'bg-slate-50/70 hover:bg-slate-100/90 border-slate-200/70 text-slate-700'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1 transition-all ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-white text-indigo-600 border border-slate-200/60 shadow-xs'
                  }`}>
                    <Icon size={16} />
                  </div>
                  <span className={`text-[10px] font-bold leading-tight line-clamp-1 ${
                    isSelected ? 'text-white font-black' : 'text-slate-800'
                  }`}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="lg:hidden mb-4 animate-fade-in">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {allTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all border whitespace-nowrap active:scale-95 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 border-indigo-600 scale-[1.02]'
                      : 'bg-white text-slate-700 hover:text-slate-900 border-slate-200 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Layout Container */}
      <div className="flex flex-col lg:flex-row gap-6 w-full items-start mb-6">
        {/* Desktop Sidebar Navigation Tabs */}
        <div className="hidden lg:flex w-72 shrink-0 flex-col gap-2">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-1">Kelompok Menu</div>
          {allTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left font-bold transition-all text-sm border ${
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
                  <h3 className="text-base font-bold text-slate-800">
                    {isRental ? 'Informasi Profil Sanggar & Butik Busana' : `Informasi Profil ${verticalStore}`}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isRental 
                      ? 'Atur nama sanggar, nomor WhatsApp butik, alamat galeri/fitting, dan logo resmi usaha.' 
                      : `Atur nama, nomor kontak, alamat ${verticalStore.toLowerCase()}, dan logo resmi usaha.`}
                  </p>
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
                        placeholder={isRental ? "Nama Sanggar / Galeri Busana Anda" : `Nama ${verticalStore} Anda`}
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
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">URL Logo Restoran / Kedai (Path / Link)</label>
                    <div className="relative">
                      <ImageIcon size={16} className="absolute left-3 top-3.5 text-slate-400" />
                      <input 
                        type="text" 
                        name="logoUrl" 
                        className="form-control pl-10" 
                        style={{ paddingLeft: '2.5rem' }} 
                        value={formData.logoUrl} 
                        onChange={handleChange} 
                        placeholder="/logo-muki-ramen.png"
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
                        placeholder="Contoh: http://mukiramen.com"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col">
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Logo Toko (Pratinjau & Unggah)</label>
                  <label className="flex-1 border-2 border-dashed border-indigo-200 hover:border-indigo-500 rounded-2xl bg-indigo-50/20 hover:bg-indigo-50/40 p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 group min-h-[180px] relative overflow-hidden">
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const result = event.target?.result as string;
                            setFormData((prev: any) => ({ ...prev, logoUrl: result }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    {formData.logoUrl ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-24 h-24 rounded-2xl bg-white border border-slate-200 shadow-md p-2 flex items-center justify-center overflow-hidden">
                          <img src={formData.logoUrl} alt="Preview Logo" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-xs font-bold text-indigo-600 group-hover:underline mt-1">Klik untuk mengganti logo</span>
                        <span className="text-[10px] text-slate-400">Dimensi 1:1 direkomendasikan</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 group-hover:text-indigo-600 group-hover:scale-105 transition-all mb-2">
                          <ImageIcon size={26} />
                        </div>
                        <span className="text-xs font-bold text-slate-700">Pilih atau Seret Foto Logo</span>
                        <span className="text-[10px] text-slate-400 mt-1">Format: JPG/PNG (Dimensi 1:1 direkomendasikan)</span>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pwa_mobile' && (
            <div className="space-y-6 animate-fade-in">
              <TenantPWASection
                tenantSlug={posContext?.user?.memberships?.[0]?.tenantSlug || ''}
                storeName={formData.storeName}
                businessType={businessType}
              />
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
                    <h3 className="text-base font-black text-slate-800">
                      {isRental ? 'Nota Kontrak Sewa & Printer Kasir' : isCafe ? 'Multi-Printer, Split Struk & KDS' : 'Printer Struk Kasir'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isRental 
                        ? 'Format lembar kontrak sewa busana, uang jaminan/deposit, dan printer kasir.' 
                        : isCafe
                        ? 'Pengaturan cetak struk otomatis (Payment-First) dan kontrol fitur Layar Dapur (KDS).'
                        : 'Pengaturan cetak struk otomatis dan konfigurasi printer kasir.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* PENGATURAN KDS (KITCHEN DISPLAY SYSTEM) - HANYA UNTUK KAFE / F&B */}
              {isCafe && (
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
              )}
              
              {/* PRINTER CARDS: KASIR, DAPUR, BAR */}
              <div className={`grid grid-cols-1 ${!isCafe ? 'max-w-xl' : 'md:grid-cols-3'} gap-5`}>
                
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

                {/* 2. PRINTER DAPUR & BAR (ONLY FOR CAFE / F&B) */}
                {isCafe && (
                  <>
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
              </>
            )}

              </div>

              {/* MAPPING KATEGORI MENU KE TARGET PRINTER (ONLY FOR CAFE / F&B) */}
              {isCafe && (
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
              )}

              
              {/* HEADER & FOOTER FORMAT STRUK */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                      {isRental ? 'Pesan Pembuka Nota Kontrak Sewa (Header)' : 'Pesan Pembuka Struk (Header)'}
                    </label>
                    <textarea 
                      name="receiptHeader" 
                      rows={3} 
                      className="form-control text-sm" 
                      value={formData.receiptHeader} 
                      onChange={handleChange}
                      placeholder={isRental ? "Contoh: SANGGAR BUSANA ADAT BUGIS — Syarat: Wajib menjaga keutuhan kain & aksesoris adat." : "Contoh: Selamat Datang di MUKI RAMEN! Nikmati hidangan autentik kami."}
                    ></textarea>
                    <p className="text-[10px] font-semibold text-slate-400 mt-1">
                      {isRental ? 'Muncul di baris teratas nota kontrak sewa setelah nama sanggar busana.' : 'Muncul di baris teratas struk printer setelah nama restoran.'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                      {isRental ? 'Pesan Penutup & Klausul Nota (Footer)' : 'Pesan Penutup Struk (Footer)'}
                    </label>
                    <textarea 
                      name="receiptFooter" 
                      rows={3} 
                      className="form-control text-sm" 
                      value={formData.receiptFooter} 
                      onChange={handleChange}
                      placeholder={isRental ? "Contoh: Pengembalian H+1 maks pukul 17:00 WITA. Busana sutra dicuci khusus oleh sanggar (penyewa tidak perlu mencuci)." : "Contoh: Arigatou Gozaimasu! Follow Instagram @mukiramen.id"}
                    ></textarea>
                    <p className="text-[10px] font-semibold text-slate-400 mt-1">
                      {isRental ? 'Muncul di bagian bawah nota sewa sebagai pengingat batas pengembalian dan jaminan.' : 'Muncul di baris paling bawah struk belanja setelah rincian total bayar.'}
                    </p>
                  </div>
                </div>

                {/* Preview Struk Premium */}
                <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200/60 rounded-3xl p-6 shadow-inner">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Sparkles size={12} className="text-amber-500 animate-pulse" /> {isRental ? 'Live Preview Nota Sewa Busana' : 'Live Preview Struk Kasir'}
                  </div>
                  
                  {/* Mock Receipt Container */}
                  <div className="bg-white w-64 p-5 font-mono text-[10px] text-slate-700 shadow-lg border border-slate-200 relative">
                    <div className="font-black text-center text-xs text-slate-800 uppercase tracking-wide mb-1">
                      {formData.storeName || (isRental ? 'SANGGAR BUSANA ADAT BUGIS' : 'MUKI RAMEN')}
                    </div>
                    <div className="text-center text-[8px] text-slate-400 mb-2 leading-tight whitespace-pre-wrap">
                      {formData.address || (isRental ? 'Jl. Somba Opu No. 45, Makassar' : 'Jl. Senopati No. 88, Jakarta Selatan')}
                    </div>
                    
                    {formData.receiptHeader ? (
                      <div className="border-b border-dashed border-slate-300 text-center mb-2 pb-2 text-[8px] text-slate-500 italic whitespace-pre-wrap">
                        {formData.receiptHeader}
                      </div>
                    ) : (
                      isRental && (
                        <div className="border-b border-dashed border-slate-300 text-center mb-2 pb-2 text-[8px] text-indigo-700 font-bold tracking-wider">
                          *** NOTA KONTRAK SEWA BUSANA ***
                        </div>
                      )
                    )}
                    
                    {isRental ? (
                      <div className="text-left space-y-1.5 my-3 text-[9px]">
                        <div className="flex justify-between font-bold text-slate-800">
                          <span>1x Baju Bodo Tokko VIP (3 Hari)</span>
                          <span>250.000</span>
                        </div>
                        <div className="text-[7.5px] text-slate-400 pl-2">Kode: BD-001 (Merah Maroon, Sz M)</div>

                        <div className="flex justify-between font-bold text-slate-800">
                          <span>1x Set Aksesoris Pengantin</span>
                          <span>100.000</span>
                        </div>
                        <div className="text-[7.5px] text-slate-400 pl-2">Saloko, Keris Tataroppa, Kalung</div>

                        <div className="border-t border-dotted border-slate-200 pt-1 flex justify-between text-indigo-700 font-bold">
                          <span>Uang Jaminan / Deposit</span>
                          <span>150.000</span>
                        </div>
                        <div className="text-[7.5px] text-indigo-500 pl-2">*Refundable saat busana kembali utuh</div>
                      </div>
                    ) : (
                      <div className="text-left space-y-1 my-3">
                        <div className="flex justify-between"><span>2x Tori Paitan Ramen</span><span>116.000</span></div>
                        <div className="flex justify-between"><span>1x Gyoza Panggang</span><span>28.000</span></div>
                        <div className="flex justify-between"><span>2x Ocha Dingin</span><span>24.000</span></div>
                      </div>
                    )}
                    
                    <div className="border-t border-dashed border-slate-300 mt-2 pt-2 text-right font-black text-slate-800 text-[11px]">
                      {isRental ? 'TOTAL TAGIHAN: Rp 500.000' : 'TOTAL: Rp 184.800'}
                    </div>

                    {formData.receiptFooter ? (
                      <div className="border-t border-dashed border-slate-300 mt-3 pt-2 text-center text-[8px] text-slate-500 italic whitespace-pre-wrap">
                        {formData.receiptFooter}
                      </div>
                    ) : (
                      isRental && (
                        <div className="border-t border-dashed border-slate-300 mt-3 pt-2 text-center text-[7.5px] text-slate-500 leading-tight">
                          Jatuh Tempo: H+1 jam 17:00 WITA<br/>
                          Pakaian sutra dicuci khusus oleh sanggar.
                        </div>
                      )
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
                  <h3 className="text-base font-bold text-slate-800">
                    {isRental ? 'Pengaturan Pajak Sewa & Biaya Tambahan' : 'Pengaturan Pajak & Service Charge'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isRental ? 'Konfigurasi persentase tarif PPN/pajak sewa busana (opsional).' : 'Konfigurasi persentase PPN (PB1) dan biaya layanan restoran.'}
                  </p>
                </div>
              </div>
              
              <div className="max-w-2xl space-y-6">
                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 text-xs font-semibold text-indigo-800 flex items-start gap-3">
                  <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    {isRental 
                      ? 'Konfigurasi pajak ini akan otomatis diperhitungkan pada nota kontrak sewa dan kwitansi kasir. Isi angka 0 jika tidak memungut pajak.'
                      : 'Konfigurasi persentase pajak dan layanan ini akan otomatis ditambahkan ke kalkulasi akhir pada modul Kasir POS dan struk penjualan. Isi angka 0 jika tidak ingin membebankan biaya tambahan ke pelanggan.'}
                  </div>
                </div>

                <div className={`grid grid-cols-1 ${isRental ? 'max-w-xs' : 'sm:grid-cols-2'} gap-5`}>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                      {isRental ? 'Pajak Sewa (PPN) %' : 'Pajak (PPN / PB1) %'}
                    </label>
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
                  {!isRental && (
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
                  )}
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
                      <div className="font-bold text-sm text-slate-800">
                        {isRental ? 'Tarif Sewa Termasuk Pajak (Include Tax)' : 'Harga Menu Termasuk Pajak (Include Tax)'}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {isRental
                          ? 'Aktifkan opsi ini jika tarif sewa pakaian pada katalog sudah termasuk PPN di dalamnya. Sistem kasir akan menghitung DPP secara otomatis.'
                          : 'Aktifkan opsi ini jika harga produk yang Anda input di menu Produk sudah bersih/termasuk PPN di dalamnya. Sistem POS akan mengkalkulasikan DPP (Dasar Pengenaan Pajak) secara otomatis ke belakang layar.'}
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
                  <h3 className="text-base font-bold text-slate-800">
                    {isRental ? 'Aturan & Operasional Sewa Busana' : 'Fitur Tambahan POS'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isRental 
                      ? 'Konfigurasi durasi sewa standar, denda keterlambatan harian, dan jaminan keamanan busana.' 
                      : 'Personalisasikan fungsionalitas dan fitur penunjang operasional kasir.'}
                  </p>
                </div>
              </div>

              <div className="max-w-2xl space-y-5">
                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 text-xs font-semibold text-indigo-800 flex items-start gap-3">
                  <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    {isRental 
                      ? 'Aturan operasional ini berlaku sebagai parameter default saat kasir membuat kontrak persewaan baju adat baru dan pencetakan nota perjanjian.' 
                      : 'Mengaktifkan fitur-fitur di bawah ini akan menambahkan parameter opsional pada saat kasir membuat pesanan makanan/minuman di terminal POS.'}
                  </div>
                </div>

                {/* RENTAL OPERATIONAL POLICIES CARD */}
                {isRental && (
                  <div className="bg-white p-5 rounded-2xl border border-indigo-200/80 shadow-sm space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                          <Shirt size={18} />
                        </div>
                        <div>
                          <div className="font-black text-sm text-slate-800">Kebijakan & Operasional Sewa Busana</div>
                          <div className="text-[11px] text-slate-400">Aturan durasi peminjaman, denda keterlambatan harian, dan jaminan keamanan</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        SOP SANGGAR
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Durasi Sewa Standar */}
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Durasi Sewa Default</label>
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="number" 
                            name="rentalDefaultDays" 
                            className="form-control text-sm font-bold w-20 text-center" 
                            value={(formData as any).rentalDefaultDays || 3} 
                            onChange={handleChange}
                            min="1"
                            max="30"
                          />
                          <span className="text-xs font-bold text-slate-600">Hari</span>
                        </div>
                        <p className="text-[10px] text-slate-400">Default 3 hari: H-1 Ambil, Hari H, H+1 Kembali.</p>
                      </div>

                      {/* Denda Keterlambatan per Hari */}
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Denda Telat / Hari</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                          <input 
                            type="number" 
                            name="rentalLateFeePerDay" 
                            className="form-control text-sm font-bold pl-9" 
                            value={(formData as any).rentalLateFeePerDay || 50000} 
                            onChange={handleChange}
                            step="5000"
                            min="0"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400">Dihitung otomatis saat melewati batas waktu.</p>
                      </div>

                      {/* Standar Uang Jaminan / Deposit */}
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Standar Uang Jaminan</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                          <input 
                            type="number" 
                            name="rentalDepositAmount" 
                            className="form-control text-sm font-bold pl-9" 
                            value={(formData as any).rentalDepositAmount || 150000} 
                            onChange={handleChange}
                            step="10000"
                            min="0"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400">Uang deposit / jaminan (refundable).</p>
                      </div>
                    </div>

                    <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200/70 text-xs font-medium text-amber-800 flex items-start gap-2.5">
                      <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Klausul Perawatan Pakaian Sutra:</strong> Pada vertikal RENTAL, penyewa diwajibkan mengembalikan pakaian tanpa dicuci sendiri demi menjaga keaslian serat benang emas dan sutra Bugis. Pencucian &amp; uap dilakukan steril oleh tim sanggar.
                      </div>
                    </div>
                  </div>
                )}

                {/* Drink Customization Toggle Card (ONLY FOR CAFE / F&B) */}
                {!isRental && (
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
                )}

                {/* Blind Cash Drawer Count Toggle Card */}
                <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${formData.enableBlindClose ? 'bg-indigo-50/20 border-indigo-200' : 'bg-white border-slate-200'} shadow-sm mt-4`}>
                  <label className="flex items-start justify-between gap-4 cursor-pointer select-none">
                    <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                          <EyeOff size={16} className="text-indigo-600" />
                          <span>Blind Cash Drawer Count (Hitung Kas Tutup Shift Buta)</span>
                        </span>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${formData.enableBlindClose ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                          {formData.enableBlindClose ? '✓ AKTIF (STANDAR ANTI-FRAUD)' : 'NONAKTIF'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                        Saat kasir melakukan Tutup Shift, sistem menyembunyikan estimasi omset &amp; saldo kas laci sistem. Kasir wajib menghitung uang fisik secara murni dan objektif. Sistem pusat mendeteksi selisih otomatis untuk laporan Owner.
                      </p>
                    </div>

                    <div className="relative mt-1 shrink-0">
                      <input
                        type="checkbox"
                        name="enableBlindClose"
                        className="sr-only"
                        checked={formData.enableBlindClose}
                        onChange={handleChange}
                      />
                      <div
                        style={{
                          width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                          background: formData.enableBlindClose ? '#4f46e5' : '#cbd5e1',
                          transition: 'background 0.2s', position: 'relative',
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: 3,
                          left: formData.enableBlindClose ? 23 : 3,
                          width: 18, height: 18, borderRadius: '50%', background: 'white',
                          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </div>
                    </div>
                  </label>
                </div>

                {/* High-Precision Mode Toggle Card (ONLY FOR NON-RENTAL) */}
                {!isRental && (
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
                )}
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
              <div className="border-b border-slate-100 pb-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <PackageSearch size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">
                      {isRental ? 'Manajemen Aset Busana & Kebijakan Perawatan' : 'Mode Inventaris & Pelacakan Bahan Baku'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isRental 
                        ? 'Siklus hidup busana adat, standarisasi uap sutra, dan pelacakan kelengkapan aksesoris.' 
                        : 'Pilih cara sistem mengelola stok dan menghitung HPP (Harga Pokok Produksi).'}
                    </p>
                  </div>
                </div>

                {isRental && (
                  <button
                    type="button"
                    onClick={() => window.location.href = '/rental-inventory'}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    <Shirt size={15} />
                    <span>Buka Inventaris Busana</span>
                  </button>
                )}
              </div>

              {isRental ? (
                <div className="space-y-6 max-w-4xl">
                  {/* SIKLUS ASET BUSANA ADAT */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-amber-500" />
                        <h4 className="font-black text-sm text-slate-800">Alur Standar Siklus Aset Busana Sanggar</h4>
                      </div>
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        6 TAHAP STANDAR OPERASIONAL
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 space-y-1">
                        <div className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Tahap 1</div>
                        <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span>Tersedia di Lemari</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Busana bersih tergantung di hanger berkode siap dipilih dan difitting oleh calon pengantin atau tamu.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 space-y-1">
                        <div className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Tahap 2</div>
                        <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          <span>Dibooking / Fitting</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Klien membayar DP atau lunas, menentukan tanggal acara pernikahan, dan busana dikunci dari peminjam lain.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 space-y-1">
                        <div className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Tahap 3</div>
                        <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                          <span>Dibawa Klien (Acara)</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Penyewa mengambil pakaian lengkap bersama aksesoris (saloko, keris) dengan menitipkan jaminan/KTP.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 space-y-1">
                        <div className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Tahap 4</div>
                        <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          <span>Kembali (QC Fisik)</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Pemeriksaan kondisi kain sutra, noda make-up, kelengkapan permata aksesoris, dan perhitungan denda bila telat.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 space-y-1">
                        <div className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Tahap 5</div>
                        <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                          <span>Cuci &amp; Uap Sutra</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Perawatan dry clean atau steaming uap khusus sutra tanpa mesin cuci putar agar serat benang emas awet.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 space-y-1">
                        <div className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Tahap 6</div>
                        <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                          <span>Restock Siap Sewa</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Aset kembali berstatus Tersedia dan siap direntalkan kembali untuk acara hajatan berikutnya.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* SOP PERAWATAN KAIN SUTRA BUGIS & AKSESORIS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white space-y-2">
                      <div className="flex items-center gap-2 font-black text-xs text-indigo-900">
                        <ShieldCheck size={16} className="text-indigo-600" />
                        <span>SOP Kain Sutra Sengkang &amp; Baju Bodo</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Kain sutra asli dan tenun benang emas Bugis <strong>pantang terkena deterjen berklorin</strong> atau perasan mesin cuci. Sanggar menggunakan teknologi steamer uap panas vertikal untuk mensterilkan kain sekaligus menghilangkan kusut tanpa merusak serat.
                      </p>
                    </div>

                    <div className="p-5 rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50/50 to-white space-y-2">
                      <div className="flex items-center gap-2 font-black text-xs text-amber-900">
                        <Award size={16} className="text-amber-600" />
                        <span>Perawatan Aksesoris Kuningan &amp; Permata</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Saloko (mahkota), keris tataroppa, bando banna, dan kalung berunang dilap kering dengan kain microfiber halus setelah pemakaian. Simpan dalam kotak beludru bersekat dengan silica gel untuk mencegah oksidasi warna emas.
                      </p>
                    </div>
                  </div>

                  {/* SHORTCUT ACTIONS */}
                  <div className="p-5 rounded-3xl border border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <Boxes size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-800">Kelola Koleksi Pakaian &amp; Nomor Hanger</div>
                        <div className="text-[11px] text-slate-400">Tambahkan busana baru, ukuran, tarif sewa harian, foto, dan stok aksesoris.</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => window.location.href = '/rental-inventory'}
                        className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Shirt size={14} />
                        <span>Katalog Busana</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.location.href = '/rental-kanban'}
                        className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Layers size={14} />
                        <span>Papan Sewa</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
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
                  Isi resep menu di <strong>Produk → Edit → Tab Resep</strong> sebelum mengaktifkan Advanced Mode.
                </p>
              </div>

              {/* Kontrol Dapur & Mode Audit Opsional (HANYA KAFE / F&B) */}
              {isCafe && (
                <div className="pt-6 border-t border-slate-100 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
                      <ShieldAlert size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Kontrol Dapur & Mode Audit Inventaris (Opsional)</h4>
                      <p className="text-xs text-slate-400">Atur tingkat detail pencatatan bahan sisa/waste agar staf dapur tetap nyaman dan tidak terbebani.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Mode Audit Detail Toggle */}
                    <div className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
                          <Flame size={16} className="text-rose-500" />
                          <span>Mode Audit Detail Dapur</span>
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            name="enableKitchenAuditMode"
                            checked={formData.enableKitchenAuditMode || false}
                            onChange={handleChange}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                        </label>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {formData.enableKitchenAuditMode 
                          ? '🟢 AKTIF: Dapur dapat memilih tombol cepat alasan kerugian (Gosong, Tumpah, Basi, dll) untuk audit performa per koki.' 
                          : '⚪ NONAKTIF (Mode Cepat): Staf dapur cukup 1-klik kurangi/tambah stok biasa tanpa form berbelit-belit.'}
                      </p>
                    </div>

                    {/* Staff Meal Tracking Toggle */}
                    <div className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
                          <Utensils size={16} className="text-emerald-500" />
                          <span>Pencatatan Makan Karyawan (Staff Meal)</span>
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            name="enableStaffMealTracking"
                            checked={formData.enableStaffMealTracking !== false}
                            onChange={handleChange}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Mengizinkan dapur mencatat konsumsi resmi staf agar HPP makanan terpisah dari kerugian/waste dan stok tetap akurat.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Warehouse & Transfer Pricing Settings */}
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <Boxes size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Gudang Pusat &amp; Kebijakan Transfer Pricing {isCafe ? 'ke Dapur' : 'ke Unit Cabang'}
                    </h4>
                    <p className="text-xs text-slate-400">
                      Tentukan harga transfer {isCafe ? 'bahan baku saat dikirim dari Gudang Pusat ke Dapur Cabang.' : 'stok barang saat didistribusikan dari Gudang Pusat ke Unit Cabang.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    onClick={() => setFormData(p => ({ ...p, warehouseTransferPricing: 'AT_COST' }))}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                      (formData.warehouseTransferPricing || 'AT_COST') === 'AT_COST'
                        ? 'bg-amber-50/30 border-amber-500 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                        <span>Harga Modal Asli (At Cost)</span>
                      </span>
                      {(formData.warehouseTransferPricing || 'AT_COST') === 'AT_COST' && (
                        <span className="bg-amber-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">AKTIF</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Unit operasional cabang dibebankan persis sesuai harga modal pembelian supplier tanpa margin keuntungan (Margin 0%). Standar multi-outlet terintegrasi.
                    </p>
                  </div>

                  <div
                    onClick={() => setFormData(p => ({ ...p, warehouseTransferPricing: 'MARKUP' }))}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                      formData.warehouseTransferPricing === 'MARKUP'
                        ? 'bg-amber-50/30 border-amber-500 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                        <span>Markup Margin (+%)</span>
                      </span>
                      {formData.warehouseTransferPricing === 'MARKUP' && (
                        <span className="bg-amber-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">AKTIF</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Gudang mengenakan selisih persentase keuntungan tertentu saat barang didistribusikan ke unit operasional cabang.
                    </p>
                  </div>
                </div>

                {formData.warehouseTransferPricing === 'MARKUP' && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-4 max-w-sm">
                    <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Persentase Margin Markup:</label>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        name="warehouseMarkupPercent"
                        min="0"
                        max="100"
                        step="0.5"
                        value={formData.warehouseMarkupPercent || 0}
                        onChange={handleChange}
                        className="form-control font-bold text-sm bg-white pr-8"
                        placeholder="Contoh: 5"
                      />
                      <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>
                )}

                <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-2xl flex items-start gap-2.5 text-xs text-sky-800">
                  <Info size={16} className="text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Catatan Modal Pengadaan Pusat:</strong> Setiap penerimaan pasokan stok partai besar ke gudang default tercatat menggunakan <em>Modal Pengadaan Pusat</em>. Kas operasional cabang tidak akan terpotong sampai barang didistribusikan ke unit operasional atau dilakukan proses settlement pengembalian.
                  </div>
                </div>

                {/* Modul Purchase Order (PO Formal) Toggle */}
                <div className="pt-6 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        Modul Purchase Order (PO Formal Supplier)
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Aktifkan jika ingin menerbitkan surat pesanan resmi (PO) ke distributor luar kota. Nonaktifkan untuk menyembunyikan menu PO dan menggunakan alur belanja langsung ke gudang yang lebih sederhana.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                      <input
                        type="checkbox"
                        checked={localStorage.getItem('feature_enable_po') === 'true'}
                        onChange={(e) => {
                          localStorage.setItem('feature_enable_po', e.target.checked ? 'true' : 'false');
                          toast(`Modul Purchase Order ${e.target.checked ? 'diaktifkan' : 'dinonaktifkan'}. Silakan muat ulang halaman.`, 'success');
                          setFormData(prev => ({ ...prev }));
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>
              </div>
          </>
        )}
      </div>
    )}

          {/* ─── Tab Printer Bluetooth ─── */}
          {activeTab === 'printer_bt' && (
            <div className="space-y-8 animate-fade-in">
              <div className="border-b border-slate-100 pb-4 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600"><Printer size={18} /></div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Pengaturan Printer Bluetooth (Tablet & Mobile)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Pindai dan hubungkan tablet atau browser Chrome Anda dengan printer termal nirkabel Bluetooth.</p>
                </div>
              </div>
              
              <SettingsBluetoothPrinter />
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
                    <h4 className="text-sm font-black text-slate-900">Aplikasi PWA Staf</h4>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Staf dapat membuka <strong>{window.location.origin}/staff</strong> di browser smartphone untuk melakukan absensi selfie &amp; operasional harian.
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
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin size={14} className="text-rose-500" /> Koordinat & Radius Toko
                    </h4>
                    {formData.storeLatitude && formData.storeLongitude && (
                      <a
                        href={formData.googleMapsUrl || `https://www.google.com/maps?q=${formData.storeLatitude},${formData.storeLongitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                      >
                        <ExternalLink size={12} /> Buka di Maps
                      </a>
                    )}
                  </div>

                  {/* GOOGLE MAPS AUTO-SYNC INPUT */}
                  <div className="p-3.5 bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/50 rounded-xl border border-indigo-100 space-y-2">
                    <label className="block text-[11px] font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Compass size={13} className="text-indigo-600" /> Link Google Maps Toko
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        name="googleMapsUrl"
                        value={formData.googleMapsUrl || ''}
                        onChange={handleChange}
                        className="form-control text-xs font-mono flex-1 bg-white"
                        placeholder="https://maps.app.goo.gl/... atau tautan Google Maps"
                      />
                      <button
                        type="button"
                        onClick={() => handleResolveMaps()}
                        disabled={resolvingMaps || !formData.googleMapsUrl}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                      >
                        {resolvingMaps ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <Sparkles size={13} className="text-amber-300" />
                        )}
                        <span>{resolvingMaps ? 'Mengurai...' : 'Deteksi Otomatis'}</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      💡 <em>Tips:</em> Tempel tautan dari Google Maps (termasuk link pendek <code>maps.app.goo.gl</code>). Sistem akan otomatis mengisi <strong>Latitude, Longitude, dan Alamat Toko</strong>.
                    </p>
                  </div>

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

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleGetDeviceCoordinates}
                      className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-200 active:scale-95"
                    >
                      <MapPin size={13} className="text-indigo-600" /> Koordinat Perangkat Ini
                    </button>
                    {formData.storeLatitude && formData.storeLongitude && (
                      <button
                        type="button"
                        onClick={() => handleResolveMaps()}
                        disabled={resolvingMaps}
                        className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-emerald-200 active:scale-95 whitespace-nowrap"
                        title="Sinkronkan ulang alamat berdasarkan titik latitude & longitude di atas"
                      >
                        <RefreshCw size={13} className={resolvingMaps ? 'animate-spin' : ''} /> Tarik Alamat
                      </button>
                    )}
                  </div>
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

          {activeTab === 'bagi_hasil' && (
            <div className="space-y-8 animate-fade-in">
              <div className="border-b border-slate-100 pb-4 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                  <Sliders size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Sistem Bagi Hasil & Bonus Omzet Karyawan</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isRental
                      ? 'Konfigurasi persentase profit sharing divisi Sewa Busana & Aksesoris/Rias, serta skema reward omzet harian.'
                      : isBengkel
                      ? 'Konfigurasi persentase profit sharing divisi Jasa Servis & Sparepart, serta skema reward omzet harian.'
                      : isLaundry
                      ? 'Konfigurasi persentase profit sharing divisi Laundry Kiloan & Satuan, serta skema reward omzet harian.'
                      : isRetail
                      ? 'Konfigurasi persentase profit sharing divisi Retail & Grosir, serta skema reward omzet harian.'
                      : isCafe
                      ? 'Konfigurasi persentase profit sharing divisi Makanan & Minuman, serta skema tier reward omzet harian.'
                      : 'Konfigurasi persentase pembagian hasil usaha (profit sharing) antar divisi serta skema tier reward omzet harian.'}
                  </p>
                </div>
              </div>

              {/* ── BAGIAN 1: SISTEM BAGI HASIL USAHA (PROFIT SHARING) ── */}
              {(() => {
                const div1Title = isRental 
                  ? 'Divisi Sewa Busana Adat' 
                  : isBengkel 
                  ? 'Divisi Jasa Servis & Mekanik' 
                  : isLaundry 
                  ? 'Divisi Laundry Kiloan' 
                  : isRetail 
                  ? 'Divisi Retail & Ecer' 
                  : isCafe 
                  ? 'Divisi Makanan (Food)' 
                  : 'Divisi Utama (Layanan / Produk 1)';

                const div1Pj = isRental ? 'PJ Busana' : isBengkel ? 'PJ Servis' : isLaundry ? 'PJ Kiloan' : isRetail ? 'PJ Retail' : isCafe ? 'PJ Makanan' : 'PJ Divisi 1';
                const div1Icon = isRental ? '👘' : isBengkel ? '🔧' : isLaundry ? '🧺' : isRetail ? '📦' : isCafe ? '🍜' : '⭐';

                const div2Title = isRental 
                  ? 'Divisi Aksesoris & Rias' 
                  : isBengkel 
                  ? 'Divisi Sparepart & Oli' 
                  : isLaundry 
                  ? 'Divisi Laundry Satuan & Dry Clean' 
                  : isRetail 
                  ? 'Divisi Grosir & Partai' 
                  : isCafe 
                  ? 'Divisi Minuman (Drink)' 
                  : 'Divisi Pendukung (Layanan / Produk 2)';

                const div2Pj = isRental ? 'PJ Aksesoris' : isBengkel ? 'PJ Sparepart' : isLaundry ? 'PJ Satuan' : isRetail ? 'PJ Grosir' : isCafe ? 'PJ Minuman' : 'PJ Divisi 2';
                const div2Icon = isRental ? '✨' : isBengkel ? '⚙️' : isLaundry ? '👔' : isRetail ? '🛒' : isCafe ? '🍹' : '✨';

                return (
                  <div className="p-5 sm:p-6 rounded-2xl border border-orange-200/80 bg-orange-50/30 space-y-6">
                    <div className="flex items-center gap-2 text-orange-800 font-bold text-sm">
                      <Sliders size={18} className="text-orange-600" />
                      <span>I. Pembagian Hasil Usaha (Profit Sharing)</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Divisi 1 */}
                      <div className="p-4 rounded-xl bg-white border border-orange-200/90 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                            <span className="text-base">{div1Icon}</span>
                            <span>{div1Title}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-100 text-orange-800">
                            Total 100% Laba
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                              Bagian {div1Pj}
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                name="profitSharingRamenPercent"
                                className="form-control font-black text-orange-600 pr-7"
                                value={formData.profitSharingRamenPercent ?? 20}
                                onChange={handleChange}
                                min={0}
                                max={100}
                                placeholder="20"
                              />
                              <span className="absolute right-2.5 top-2.5 text-xs font-bold text-slate-400">%</span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                              Bagian Owner
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                readOnly
                                disabled
                                className="form-control font-black text-indigo-700 bg-slate-100/80 pr-7 cursor-not-allowed"
                                value={Math.max(0, 100 - (Number(formData.profitSharingRamenPercent) || 0))}
                              />
                              <span className="absolute right-2.5 top-2.5 text-xs font-bold text-slate-400">%</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-2.5 bg-orange-50/60 rounded-lg text-xs font-semibold text-orange-900 border border-orange-100 flex items-center justify-between">
                          <span>Rasio Bagi Hasil:</span>
                          <strong className="font-bold text-orange-800">
                            {Math.max(0, 100 - (Number(formData.profitSharingRamenPercent) || 0))}% Owner : {Number(formData.profitSharingRamenPercent) || 0}% {div1Pj}
                          </strong>
                        </div>
                      </div>

                      {/* Divisi 2 */}
                      <div className="p-4 rounded-xl bg-white border border-cyan-200/90 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                            <span className="text-base">{div2Icon}</span>
                            <span>{div2Title}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-100 text-cyan-800">
                            Total 100% Laba
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                              Bagian {div2Pj}
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                name="profitSharingDrinkPercent"
                                className="form-control font-black text-cyan-600 pr-7"
                                value={formData.profitSharingDrinkPercent ?? 20}
                                onChange={handleChange}
                                min={0}
                                max={100}
                                placeholder="20"
                              />
                              <span className="absolute right-2.5 top-2.5 text-xs font-bold text-slate-400">%</span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                              Bagian Owner
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                readOnly
                                disabled
                                className="form-control font-black text-indigo-700 bg-slate-100/80 pr-7 cursor-not-allowed"
                                value={Math.max(0, 100 - (Number(formData.profitSharingDrinkPercent) || 0))}
                              />
                              <span className="absolute right-2.5 top-2.5 text-xs font-bold text-slate-400">%</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-2.5 bg-cyan-50/60 rounded-lg text-xs font-semibold text-cyan-900 border border-cyan-100 flex items-center justify-between">
                          <span>Rasio Bagi Hasil:</span>
                          <strong className="font-bold text-cyan-800">
                            {Math.max(0, 100 - (Number(formData.profitSharingDrinkPercent) || 0))}% Owner : {Number(formData.profitSharingDrinkPercent) || 0}% {div2Pj}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                        Mode Pembebanan Biaya Bersama (Shared OPEX: Listrik, Air, Wifi &amp; Operasional Rutin)
                      </label>
                      <select
                        name="profitSharingOpexMode"
                        className="form-control font-medium text-slate-800 bg-white"
                        value={formData.profitSharingOpexMode || 'BEFORE_SPLIT'}
                        onChange={handleChange}
                      >
                        <option value="BEFORE_SPLIT">Mode A (Rekomendasi): Dipotong Proporsional dari Omzet Sebelum Bagi Hasil</option>
                        <option value="OWNER_COVERED">Mode B: Ditanggung Penuh oleh Owner (PJ Terima Bersih dari Omzet - Belanja Langsung)</option>
                        <option value="SPLIT_50_50">Mode C: Split Beban (50% Owner : 25% {div1Pj} : 25% {div2Pj})</option>
                      </select>
                      <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                        Biaya operasional kas kecil seperti token listrik, air galon, internet wifi, serta kebutuhan operasional rutin akan dikurangkan secara otomatis berdasarkan opsi di atas.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* ── BAGIAN 2: SKEMA TIER REWARD BONUS OMZET HARIAN ── */}
              <div className="p-5 sm:p-6 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                    <Award size={18} className="text-indigo-600" />
                    <span>II. Skema Reward Bonus Omzet Harian (Karyawan Full-Time)</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      name="enableDailyOmzetBonus"
                      checked={formData.enableDailyOmzetBonus ?? true}
                      onChange={handleChange}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span>Aktifkan Bonus Omzet Harian</span>
                  </label>
                </div>

                {formData.enableDailyOmzetBonus && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Karyawan berstatus <strong>Full Time</strong> yang hadir/terlambat pada hari kerja akan otomatis mendapatkan reward sesuai tier omzet kotor harian yang tercapai. Karyawan <strong>Daily Worker (DW)</strong> dan status <strong>Libur/Izin/Sakit</strong> bernilai Rp 0 bonus.
                    </p>

                    {/* Form Tambah Tier Baru */}
                    <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Target Min. Omzet (Rp)</label>
                        <input
                          type="number"
                          className="form-control text-xs font-bold"
                          value={newTier.minOmzet || ''}
                          onChange={(e) => setNewTier({ ...newTier, minOmzet: Number(e.target.value) })}
                          placeholder="Contoh: 3500000"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Reward Bonus / Orang (Rp)</label>
                        <input
                          type="number"
                          className="form-control text-xs font-bold text-emerald-600"
                          value={newTier.bonus || ''}
                          onChange={(e) => setNewTier({ ...newTier, bonus: Number(e.target.value) })}
                          placeholder="Contoh: 12500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Label / Keterangan</label>
                        <input
                          type="text"
                          className="form-control text-xs"
                          value={newTier.label}
                          onChange={(e) => setNewTier({ ...newTier, label: e.target.value })}
                          placeholder="Tier >= 3.5 Juta"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddTier}
                        className="btn btn-primary bg-indigo-600 hover:bg-indigo-700 text-xs font-bold py-2.5 h-[38px] flex items-center justify-center gap-1.5"
                      >
                        + Tambah Tier
                      </button>
                    </div>

                    {/* Tabel Daftar Tier */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-black tracking-wider">
                          <tr>
                            <th className="p-3">Peringkat Tier</th>
                            <th className="p-3">Minimal Omzet Harian</th>
                            <th className="p-3">Reward / Karyawan</th>
                            <th className="p-3">Keterangan</th>
                            <th className="p-3 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dailyTiersList.map((tier, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 font-bold text-slate-700">Tier #{idx + 1}</td>
                              <td className="p-3 font-mono font-bold text-slate-900">
                                Rp {(tier.minOmzet || 0).toLocaleString('id-ID')}
                              </td>
                              <td className="p-3 font-mono font-bold text-emerald-600">
                                +Rp {(tier.bonus || 0).toLocaleString('id-ID')}
                              </td>
                              <td className="p-3 text-slate-500">{tier.label || `Omzet >= Rp ${(tier.minOmzet/1000000).toFixed(1)} Jt`}</td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTier(idx)}
                                  className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-bold text-[11px] transition-colors"
                                  title="Hapus Tier"
                                >
                                  Hapus
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
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

          {activeTab === 'whatsapp' && (
            <div className="space-y-6 animate-fade-in">
              <SettingsWhatsAppGateway />
            </div>
          )}

          {/* Bottom Save Action for settings tabs */}
          {['profil', 'struk', 'pajak', 'bayar', 'fitur', 'bagi_hasil', 'crm', 'inventaris', 'absensi_gps'].includes(activeTab) && (
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

      {/* Mobile Floating Sticky Save Action Bar (Always visible on mobile above bottom navigation bar) */}
      <div className="fixed bottom-[84px] left-3 right-3 sm:hidden z-30 animate-in slide-in-from-bottom-5 duration-200">
        <div className="bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-2xl border border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
              <CurrentIcon size={16} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-white leading-tight truncate">{currentTab.label}</span>
              <span className="text-[10px] text-slate-400 leading-tight">Tekan untuk simpan</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-indigo-500/30 flex items-center gap-1.5 disabled:opacity-50 shrink-0"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{loading ? 'Menyimpan...' : 'Simpan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const DatabaseSettingsPanel = ({ token }: { token: string | null | undefined }) => {
  const [backingUp, setBackingUp] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [healthData, setHealthData] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(true);

  const fetchHealthAndBackups = async () => {
    setLoadingHealth(true);
    try {
      // 1. Fetch deep health
      const healthRes = await fetch('/api/health/deep');
      if (healthRes.ok) {
        const hData = await healthRes.json();
        setHealthData(hData);
      }

      // 2. Fetch backups
      if (token) {
        const backupRes = await fetch('/api/health/backups', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (backupRes.ok) {
          const bData = await backupRes.json();
          setBackups(bData.backups || []);
        }
      }
    } catch (e) {
      console.error('Error fetching observability telemetry:', e);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealthAndBackups();
    const interval = setInterval(fetchHealthAndBackups, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, [token]);

  const handleCreateEncryptedBackup = async () => {
    if (!token) return;
    setBackingUp(true);
    try {
      const response = await fetch('/api/health/backups/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isEncrypted, compress: true, type: 'json' })
      });

      const data = await response.json();
      if (response.ok) {
        toast(`Backup ${data.backup?.fileName} berhasil dibuat!`, 'success');
        fetchHealthAndBackups();
      } else {
        toast(data.error || 'Gagal membuat backup', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan saat membuat backup', 'error');
    } finally {
      setBackingUp(false);
    }
  };

  const handlePurgeOldBackups = async () => {
    const result = await confirmAlert(
      'Pangkas Backup Usang?',
      'Apakah Anda yakin ingin menghapus seluruh berkas backup yang berumur lebih dari 30 hari? Tindakan ini tidak dapat dibatalkan.'
    );
    if (!result.isConfirmed || !token) return;

    try {
      const res = await fetch('/api/health/backups/purge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ retentionDays: 30 })
      });
      const data = await res.json();
      if (res.ok) {
        toast(`Pembersihan selesai: ${data.result?.deletedCount || 0} berkas lama dihapus.`, 'success');
        fetchHealthAndBackups();
      } else {
        toast(data.error || 'Gagal memangkas backup lama', 'error');
      }
    } catch (e: any) {
      toast(e.message || 'Terjadi kesalahan saat memangkas backup', 'error');
    }
  };

  const handleDownloadLegacyBackup = async () => {
    if (!token) return;
    setBackingUp(true);
    try {
      const response = await fetch('/api/database/backup', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Gagal mengunduh backup');
      
      let filename = `backup-codepos-${new Date().toISOString().slice(0,10)}.json`;
      const disposition = response.headers.get('content-disposition');
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast(`Berkas backup (${filename}) berhasil diunduh!`, 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal mengunduh backup', 'error');
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
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        toast(data.message || 'Server sedang merestart...', 'success');
        setTimeout(() => window.location.reload(), 5000);
      } else {
        toast(data.error || 'Gagal merestart server', 'error');
      }
    } catch {
      toast('Perintah restart berhasil dikirim. Halaman akan dimuat ulang...', 'success');
      setTimeout(() => window.location.reload(), 5000);
    } finally {
      setRestarting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header Status Observability & Telemetry ── */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-500/20 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className={`w-3.5 h-3.5 rounded-full animate-pulse ${healthData?.status === 'healthy' ? 'bg-emerald-400 ring-4 ring-emerald-500/20' : 'bg-amber-400 ring-4 ring-amber-500/20'}`} />
              <h4 className="text-lg font-black tracking-tight">System Health & Telemetry Live</h4>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-indigo-200 border border-white/10">
                {healthData?.status || 'HEALTHY'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Engine: <strong className="text-white">{healthData?.database?.engine || 'PostgreSQL'}</strong> • Uptime: <strong className="text-white">{healthData?.server?.uptimeSeconds ? `${Math.floor(healthData.server.uptimeSeconds / 60)} menit` : '-'}</strong> • Latensi DB: <strong className="text-emerald-300">{healthData?.database?.latencyMs ?? 0} ms</strong>
            </p>
          </div>
          <button
            onClick={fetchHealthAndBackups}
            disabled={loadingHealth}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all border border-white/10 shrink-0 self-start sm:self-auto"
          >
            <RefreshCw size={13} className={loadingHealth ? 'animate-spin' : ''} />
            Refresh Metrik
          </button>
        </div>

        {/* Telemetry Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 relative z-10">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400">Database Latency</div>
            <div className="text-base font-black text-emerald-400 mt-0.5">{healthData?.database?.latencyMs ?? 0} ms</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400">PostgreSQL RLS</div>
            <div className="text-base font-black text-indigo-300 mt-0.5">{healthData?.database?.rlsEnforced ? '🛡️ Aktif' : 'Non-RLS'}</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400">RAM Heap Node</div>
            <div className="text-base font-black text-amber-300 mt-0.5">{healthData?.memory?.heapUsedMb ?? 0} MB</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400">Total Tenants</div>
            <div className="text-base font-black text-white mt-0.5">{healthData?.database?.telemetry?.tenants ?? 1} Bisnis</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400">Socket.IO Clients</div>
            <div className="text-base font-black text-cyan-300 mt-0.5">{healthData?.realtime?.activeSocketClients ?? 0} Online</div>
          </div>
        </div>
      </div>

      {/* ── Action Cards: Backup & Disaster Recovery ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Automated Encrypted Backup Engine */}
        <div className="p-6 rounded-3xl border border-slate-200 bg-white hover:border-slate-300 shadow-sm transition-all space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-bold text-sm text-slate-800 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <UploadCloud size={18} />
              </div>
              <div>
                <div>Buat Backup Terenkripsi</div>
                <div className="text-[11px] font-normal text-slate-400">AES-256 + Gzip + SHA-256 Checksum</div>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600">
              <input 
                type="checkbox" 
                checked={isEncrypted} 
                onChange={(e) => setIsEncrypted(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" 
              />
              <span>Enkripsi AES-256</span>
            </label>
          </div>
          
          <p className="text-xs text-slate-500 leading-relaxed">
            Menghasilkan snapshot database terstruktur yang dipaket dengan kompresi Gzip dan dienkripsi AES-256-CBC. Disimpan secara aman di server untuk Disaster Recovery.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreateEncryptedBackup}
              disabled={backingUp}
              className="btn btn-primary bg-indigo-600 border-indigo-600 text-xs font-bold py-2.5 px-4 flex-1 flex items-center justify-center gap-2 rounded-xl"
            >
              <UploadCloud size={14} />
              {backingUp ? 'Memproses...' : 'Buat Snapshot Baru'}
            </button>
            <button
              type="button"
              onClick={handleDownloadLegacyBackup}
              disabled={backingUp}
              title="Unduh file JSON langsung ke perangkat ini"
              className="btn btn-outline text-xs font-bold py-2.5 px-4 flex items-center justify-center gap-2 rounded-xl border border-slate-200 hover:bg-slate-50"
            >
              Unduh Langsung
            </button>
          </div>
        </div>

        {/* Card 2: Server Maintenance & Retention Purge */}
        <div className="p-6 rounded-3xl border border-slate-200 bg-white hover:border-slate-300 shadow-sm transition-all space-y-4">
          <div className="font-bold text-sm text-slate-800 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Sparkles size={18} />
            </div>
            <div>
              <div>Pemeliharaan & Retensi 30 Hari</div>
              <div className="text-[11px] font-normal text-slate-400">Pangkas file usang & restart layanan</div>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Menghapus berkas snapshot backup yang berumur lebih dari 30 hari untuk menjaga kapasitas SSD VPS tetap efisien, serta opsi restart background PM2 process.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePurgeOldBackups}
              className="btn btn-outline text-xs font-bold py-2.5 px-4 flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200"
            >
              Pangkas Backup &gt; 30 Hari
            </button>
            <button
              type="button"
              onClick={handleRestart}
              disabled={restarting}
              className="btn btn-danger text-xs font-bold py-2.5 px-4 flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              <RefreshCw size={13} className={restarting ? 'animate-spin' : ''} />
              {restarting ? 'Merestart...' : 'Restart Server'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Table of Stored Backups ── */}
      <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <Database size={16} className="text-indigo-600" />
            <span>Daftar Snapshot Backup di Server ({backups.length})</span>
          </h4>
        </div>

        {backups.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            Belum ada berkas backup yang tersimpan di server. Klik "Buat Snapshot Baru" di atas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase font-black tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Nama Berkas</th>
                  <th className="py-2.5 px-3">Cakupan (Scope)</th>
                  <th className="py-2.5 px-3">Ukuran</th>
                  <th className="py-2.5 px-3">Keamanan</th>
                  <th className="py-2.5 px-3">Waktu Dibuat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.map((b, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-700">{b.fileName}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-600">
                        {b.scope}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-semibold">{(b.sizeBytes / 1024).toFixed(1)} KB</td>
                    <td className="py-3 px-3">
                      {b.isEncrypted ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                          🔒 AES-256
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">Plain</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-400">{new Date(b.createdAt).toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
