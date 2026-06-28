import React, { useState, useEffect, useContext } from 'react';
import { Settings, Store, Receipt, Percent, CreditCard, Image as ImageIcon, Save, UploadCloud, Phone, MapPin, Sparkles, Check, Info, ShieldAlert, Award, PackageSearch } from 'lucide-react';
import { POSContext } from '../context/POSContext';

import { toast, confirmAlert, errorAlert } from '../utils/alert';

const SettingsView = () => {
  const [activeTab, setActiveTab] = useState('profil');
  const [loading, setLoading] = useState(false);
  const posContext = useContext(POSContext);

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
                        â˜• Kustomisasi Minuman (Sugar, Ice, Temperature)
                      </div>
                      <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Tampilkan pilihan **level gula, jumlah es, dan pilihan suhu (panas/dingin)** saat kasir memasukkan item minuman ke keranjang belanja POS. 
                        Opsi pilihan akan diteruskan ke cetakan KDS dapur dan struk pembayaran.
                      </div>
                      <div className="mt-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full ${ formData.enableDrinkCustomization ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                          {formData.enableDrinkCustomization ? 'âœ“ KUSTOMISASI AKTIF' : 'KUSTOMISASI NONAKTIF'}
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
                    ðŸ’³ Detail Rekening Bank Penerima
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
                    ðŸ“± Kode QRIS Statis Toko
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
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                        ðŸ† Aktifkan Program Loyalitas Poin Belanja
                      </div>
                      <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Jika dinonaktifkan, seluruh pencatatan/penghitungan poin belanja baru dan fitur penukaran poin cashback (redeem) di kasir POS akan disembunyikan dan diabaikan secara otomatis.
                      </div>
                      <div className="mt-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full ${ formData.loyaltyEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                          {formData.loyaltyEnabled ? 'âœ“ PROGRAM AKTIF' : 'PROGRAM NONAKTIF'}
                        </span>
                      </div>
                    </div>
                  </label>
                </div>

                {formData.loyaltyEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 animate-fade-in">
                    
                    {/* Nilai Perolehan & Penukaran */}
                    <div className="space-y-5 bg-slate-50/50 border border-slate-100 rounded-3xl p-5">
                      <h4 className="font-bold text-xs text-indigo-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        â­ Konversi Poin & Nilai Belanja
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
                        ðŸ“ˆ Pengaturan Tingkat Keanggotaan (Tier)
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
                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>ðŸ“¦ Simple Mode</div>
                    {!formData.ingredientTrackingEnabled && <span style={{ background: '#4f46e5', color: 'white', fontSize: '.65rem', fontWeight: 700, padding: '.2rem .6rem', borderRadius: '.375rem' }}>AKTIF</span>}
                  </div>
                  <ul style={{ fontSize: '.8rem', color: '#475569', lineHeight: 1.8, paddingLeft: '1rem' }}>
                    <li>HPP diinput manual per produk</li>
                    <li>Stok dilacak per produk jadi</li>
                    <li>PO â†’ naikkan stok produk langsung</li>
                    <li>âœ… Cocok untuk kafe baru / operasi sederhana</li>
                  </ul>
                </div>
                <div onClick={() => setFormData(p => ({ ...p, ingredientTrackingEnabled: true }))} className="cursor-pointer"
                  style={{ border: formData.ingredientTrackingEnabled ? '2.5px solid #7c3aed' : '2px solid #e2e8f0', borderRadius: '1.25rem', padding: '1.5rem', background: formData.ingredientTrackingEnabled ? '#faf5ff' : 'white', transition: 'all .2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.75rem' }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>ðŸ”¬ Advanced Mode</div>
                    {formData.ingredientTrackingEnabled && <span style={{ background: '#7c3aed', color: 'white', fontSize: '.65rem', fontWeight: 700, padding: '.2rem .6rem', borderRadius: '.375rem' }}>AKTIF</span>}
                  </div>
                  <ul style={{ fontSize: '.8rem', color: '#475569', lineHeight: 1.8, paddingLeft: '1rem' }}>
                    <li>HPP otomatis dari resep bahan baku</li>
                    <li>Stok dilacak per bahan baku (gram, ml)</li>
                    <li>Order â†’ kurangi stok bahan baku otomatis</li>
                    <li>PO â†’ naikkan stok bahan baku</li>
                    <li>âœ… Cocok untuk kafe dengan kontrol biaya ketat</li>
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

        </div>
      </div>
    </div>
  );
};

export default SettingsView;
