import React, { useState, useEffect, useContext } from 'react';
import { Settings, Store, Receipt, Percent, CreditCard, Image as ImageIcon, Save, UploadCloud, Phone, MapPin, Sparkles, Check, Info, ShieldAlert, Award, PackageSearch, Coffee, Smartphone, Sliders, Package, Layers, Printer, Database, RefreshCw } from 'lucide-react';
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
  const [highPrecisionMode, setHighPrecisionMode] = useState(() => {
    return localStorage.getItem('high_precision_mode') === 'true';
  });

  const handleHighPrecisionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setHighPrecisionMode(checked);
    localStorage.setItem('high_precision_mode', checked ? 'true' : 'false');
    toast(`Mode Presisi Tinggi ${checked ? 'diaktifkan' : 'dinonaktifkan'} untuk perangkat ini.`, 'success');
  };

  const handleTestPrint = async () => {
    const ip = formData.printerIp;
    const port = formData.printerPort || 9100;
    if (!ip) {
      toast('IP Printer wajib diisi untuk melakukan tes', 'error');
      return;
    }

    setTestLoading(true);
    try {
      const res = await fetch('/api/printer/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ ip, port })
      });
      const data = await res.json();
      if (res.ok) {
        toast('Halaman uji berhasil dikirim ke printer!', 'success');
      } else {
        toast(data.error || 'Gagal terhubung ke printer', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan koneksi', 'error');
    } finally {
      setTestLoading(false);
    }
  };

  const [formData, setFormData] = useState({
    storeName: 'SOL CAFE',
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
    printerIp: '',
    printerPort: 9100,
    autoPrintKDS: false,
    autoPrintReceipt: false,
  });

  useEffect(() => {
    if (posContext?.settings) {
      setFormData({
        ...formData,
        ...posContext.settings
      });
    }
  }, [posContext?.settings]);

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
    <div className="p-6 h-full flex flex-col bg-slate-50/50 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2 text-slate-800 tracking-tight">
            <Settings className="text-indigo-600 animate-spin-slow" size={26} /> Pengaturan Sistem
          </h2>
          <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
            Konfigurasi profil toko, perpajakan, format struk printer, & metode pembayaran.
          </p>
        </div>
        <button 
          className="btn btn-primary shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all font-bold text-sm hover:scale-[1.02]" 
          onClick={handleSave}
          disabled={loading}
        >
          <Save size={16} /> {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 flex-1 h-full items-start">
        
        {/* Navigation Tabs (Sidebar style on desktop) */}
        <div className="w-full lg:w-72 shrink-0 space-y-2.5">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-2">Kelompok Menu</div>
          <button 
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left font-bold transition-all text-sm border ${
              activeTab === 'profil' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 border-indigo-600 scale-[1.02]' 
                : 'bg-white text-slate-600 hover:text-slate-900 border-slate-100 hover:border-slate-200 hover:translate-x-1 shadow-sm'
            }`}
            onClick={() => setActiveTab('profil')}
          >
            <Store size={18} className={activeTab === 'profil' ? 'text-white' : 'text-slate-400'} /> Profil Kafe
          </button>
          <button 
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left font-bold transition-all text-sm border ${
              activeTab === 'struk' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 border-indigo-600 scale-[1.02]' 
                : 'bg-white text-slate-600 hover:text-slate-900 border-slate-100 hover:border-slate-200 hover:translate-x-1 shadow-sm'
            }`}
            onClick={() => setActiveTab('struk')}
          >
            <Receipt size={18} className={activeTab === 'struk' ? 'text-white' : 'text-slate-400'} /> Format Struk
          </button>
          <button 
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left font-bold transition-all text-sm border ${
              activeTab === 'pajak' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 border-indigo-600 scale-[1.02]' 
                : 'bg-white text-slate-600 hover:text-slate-900 border-slate-100 hover:border-slate-200 hover:translate-x-1 shadow-sm'
            }`}
            onClick={() => setActiveTab('pajak')}
          >
            <Percent size={18} className={activeTab === 'pajak' ? 'text-white' : 'text-slate-400'} /> Pajak & Service
          </button>
          <button 
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left font-bold transition-all text-sm border ${
              activeTab === 'bayar' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 border-indigo-600 scale-[1.02]' 
                : 'bg-white text-slate-600 hover:text-slate-900 border-slate-100 hover:border-slate-200 hover:translate-x-1 shadow-sm'
            }`}
            onClick={() => setActiveTab('bayar')}
          >
            <CreditCard size={18} className={activeTab === 'bayar' ? 'text-white' : 'text-slate-400'} /> Metode Pembayaran
          </button>
          <button 
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left font-bold transition-all text-sm border ${
              activeTab === 'fitur' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 border-indigo-600 scale-[1.02]' 
                : 'bg-white text-slate-600 hover:text-slate-900 border-slate-100 hover:border-slate-200 hover:translate-x-1 shadow-sm'
            }`}
            onClick={() => setActiveTab('fitur')}
          >
            <Settings size={18} className={activeTab === 'fitur' ? 'text-white' : 'text-slate-400'} /> Fitur Tambahan POS
          </button>
          <button 
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left font-bold transition-all text-sm border ${
              activeTab === 'crm' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 border-indigo-600 scale-[1.02]' 
                : 'bg-white text-slate-600 hover:text-slate-900 border-slate-100 hover:border-slate-200 hover:translate-x-1 shadow-sm'
            }`}
            onClick={() => setActiveTab('crm')}
          >
            <Award size={18} className={activeTab === 'crm' ? 'text-white' : 'text-slate-400'} /> CRM & Loyalitas Member
          </button>
          <button 
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left font-bold transition-all text-sm border ${
              activeTab === 'inventaris' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 border-indigo-600 scale-[1.02]' 
                : 'bg-white text-slate-600 hover:text-slate-900 border-slate-100 hover:border-slate-200 hover:translate-x-1 shadow-sm'
            }`}
            onClick={() => setActiveTab('inventaris')}
          >
            <PackageSearch size={18} className={activeTab === 'inventaris' ? 'text-white' : 'text-slate-400'} /> Mode Inventaris
          </button>
          <button 
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left font-bold transition-all text-sm border ${
              activeTab === 'printer_bt' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 border-indigo-600 scale-[1.02]' 
                : 'bg-white text-slate-600 hover:text-slate-900 border-slate-100 hover:border-slate-200 hover:translate-x-1 shadow-sm'
            }`}
            onClick={() => setActiveTab('printer_bt')}
          >
            <Printer size={18} className={activeTab === 'printer_bt' ? 'text-white' : 'text-slate-400'} /> Printer Bluetooth
          </button>
          <button 
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left font-bold transition-all text-sm border ${
              activeTab === 'database' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 border-indigo-600 scale-[1.02]' 
                : 'bg-white text-slate-600 hover:text-slate-900 border-slate-100 hover:border-slate-200 hover:translate-x-1 shadow-sm'
            }`}
            onClick={() => setActiveTab('database')}
          >
            <Database size={18} className={activeTab === 'database' ? 'text-white' : 'text-slate-400'} /> Database & Backup
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 w-full bg-white p-6 sm:p-8 shadow-sm border border-slate-200/80 rounded-3xl overflow-hidden min-h-[500px]">
          
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
              <div className="border-b border-slate-100 pb-4 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Receipt size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Format Struk Printer Thermal</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Personalisasikan teks sambutan pembuka dan penutup di struk belanja pelanggan.</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="space-y-5">
                  {/* Konfigurasi Koneksi Printer Termal */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-4 shadow-sm">
                    <div className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Printer size={16} className="text-indigo-600" />
                      <span>Koneksi Printer Jaringan (TCP/IP Direct)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">IP Address Printer</label>
                        <input 
                          type="text" 
                          name="printerIp" 
                          className="form-control text-sm" 
                          value={formData.printerIp || ''} 
                          onChange={handleChange}
                          placeholder="Contoh: 192.168.1.100"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Port</label>
                        <input 
                          type="number" 
                          name="printerPort" 
                          className="form-control text-sm" 
                          value={formData.printerPort || 9100} 
                          onChange={handleChange}
                          placeholder="9100"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary text-xs py-2 w-full flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm"
                      onClick={handleTestPrint}
                      disabled={testLoading}
                    >
                      <Printer size={14} />
                      {testLoading ? 'Menguji Koneksi...' : 'Uji Cetak Printer (Test Print)'}
                    </button>
                    <div className="border-t border-slate-200/80 pt-3 space-y-2">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          name="autoPrintReceipt" 
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20" 
                          checked={formData.autoPrintReceipt || false} 
                          onChange={handleChange}
                        />
                        <span className="text-xs font-bold text-slate-600">Cetak Struk Otomatis (Saat Pembayaran Sukses)</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          name="autoPrintKDS" 
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20" 
                          checked={formData.autoPrintKDS || false} 
                          onChange={handleChange}
                        />
                        <span className="text-xs font-bold text-slate-600">Cetak Tiket Dapur Otomatis (Saat Simpan Bill)</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Pesan Pembuka (Header)</label>
                    <textarea 
                      name="receiptHeader" 
                      rows={3} 
                      className="form-control text-sm" 
                      value={formData.receiptHeader} 
                      onChange={handleChange}
                      placeholder="Contoh: Selamat Datang di Cafe Kami! Jangan lupa tag Instagram kami @kopi.cafe"
                    ></textarea>
                    <p className="text-[10px] font-semibold text-slate-400 mt-1">Muncul di baris teratas struk printer setelah nama kafe.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Pesan Penutup (Footer)</label>
                    <textarea 
                      name="receiptFooter" 
                      rows={3} 
                      className="form-control text-sm" 
                      value={formData.receiptFooter} 
                      onChange={handleChange}
                      placeholder="Contoh: Terima kasih atas kunjungan Anda. Struk ini merupakan bukti pembayaran sah."
                    ></textarea>
                    <p className="text-[10px] font-semibold text-slate-400 mt-1">Muncul di baris paling bawah struk belanja setelah rincian total bayar.</p>
                  </div>
                </div>

                {/* Preview Struk Premium */}
                <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200/60 rounded-3xl p-6 shadow-inner">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Sparkles size={12} className="text-amber-500 animate-pulse" /> Live Preview Struk
                  </div>
                  
                  {/* Mock Receipt Container with classic paper roll effect */}
                  <div className="bg-white w-64 p-5 font-mono text-[10px] text-slate-700 shadow-lg border border-slate-200 relative">
                    {/* Top serrated edge or decorative line */}
                    <div className="w-full flex justify-between absolute -top-1 left-0 right-0 px-2 overflow-hidden opacity-30 select-none">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <span key={i} className="text-slate-400" style={{ transform: 'scale(1.5)', display: 'inline-block' }}>^</span>
                      ))}
                    </div>

                    <div className="font-black text-center text-xs text-slate-800 uppercase tracking-wide mb-1">{formData.storeName || 'SOL CAFE'}</div>
                    <div className="text-center text-[8px] text-slate-400 mb-2 leading-tight whitespace-pre-wrap">{formData.address || 'Alamat Kafe Belum Ditentukan'}</div>
                    
                    {formData.receiptHeader && (
                      <div className="border-b border-dashed border-slate-300 text-center mb-2 pb-2 text-[8px] text-slate-500 italic whitespace-pre-wrap">
                        {formData.receiptHeader}
                      </div>
                    )}
                    
                    <div className="text-left space-y-1 my-3">
                      <div className="flex justify-between"><span>1x Caramel Macchiato</span><span>32.000</span></div>
                      <div className="flex justify-between"><span>2x Croissant Almond</span><span>38.000</span></div>
                      <div className="flex justify-between"><span>1x Iced Jasmine Tea</span><span>12.000</span></div>
                    </div>
                    
                    <div className="border-t border-dashed border-slate-300 mt-2 pt-2 text-right font-black text-slate-800 text-[11px]">
                      TOTAL BAYAR: Rp 82.000
                    </div>

                    <div className="border-t border-dashed border-slate-300 mt-3 pt-3 text-center text-[8px] text-slate-400 leading-tight whitespace-pre-wrap">
                      {formData.receiptFooter || 'Terima Kasih Atas Kunjungan Anda'}
                    </div>
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
                <div className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-sm transition-all">
                  <label className="flex items-start gap-4 cursor-pointer select-none">
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
                     <div>
                      <div className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                        <Coffee size={16} className="text-indigo-650" />
                        <span>Kustomisasi Minuman (Sugar, Ice, Temperature)</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Tampilkan pilihan **level gula, jumlah es, dan pilihan suhu (panas/dingin)** saat kasir memasukkan item minuman ke keranjang belanja POS. 
                        Opsi pilihan akan diteruskan ke cetakan KDS dapur dan struk pembayaran.
                      </div>
                      <div className="mt-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full ${ formData.enableDrinkCustomization ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                          {formData.enableDrinkCustomization ? '✓ KUSTOMISASI AKTIF' : 'KUSTOMISASI NONAKTIF'}
                        </span>
                      </div>
                    </div>
                  </label>
                </div>

                {/* High-Precision Mode Toggle Card */}
                <div className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-sm transition-all mt-4">
                  <label className="flex items-start gap-4 cursor-pointer select-none">
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
                    <div>
                      <div className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                        <Sliders size={16} className="text-indigo-650" />
                        <span>Mode Presisi Tinggi (Kontrol Hardware & Sistem Ketat)</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Aktifkan jika perangkat ini bertindak sebagai terminal kasir utama yang membutuhkan kontrol fisik ketat, cetak matrix bluetooth terpisah, pembukaan laci kas RJ11 otomatis, dan penguncian Kiosk mode.
                      </div>
                      <div className="mt-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full ${ highPrecisionMode ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                          {highPrecisionMode ? '✓ MODE PRESISI AKTIF' : 'MODE PRESISI NONAKTIF'}
                        </span>
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
                {/* Enable/Disable Toggle */}
                <div className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-sm transition-all">
                  <label className="flex items-start gap-4 cursor-pointer select-none">
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
                             <div>
                      <div className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                        <Award size={16} className="text-indigo-650" />
                        <span>Aktifkan Program Loyalitas Poin Belanja</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Jika dinonaktifkan, seluruh pencatatan/penghitungan poin belanja baru dan fitur penukaran poin cashback (redeem) di kasir POS akan disembunyikan dan diabaikan secara otomatis.
                      </div>
                      <div className="mt-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full ${ formData.loyaltyEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                          {formData.loyaltyEnabled ? '✓ PROGRAM AKTIF' : 'PROGRAM NONAKTIF'}
                        </span>
                      </div>
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

export default SettingsView;
