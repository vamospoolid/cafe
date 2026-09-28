import React, { useState, useContext } from 'react';
import { 
  Store, 
  Globe, 
  MapPin, 
  User, 
  Lock, 
  Key, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Layers, 
  X, 
  RefreshCw,
  ShieldCheck,
  Coffee,
  Utensils,
  Cake,
  Wrench,
  Package,
  Zap,
  CheckCircle2,
  Shirt
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';

interface WizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialPlan?: string;
}

export const TenantRegisterWizard: React.FC<WizardProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  initialPlan = 'GROWTH'
}) => {
  const posContext = useContext(POSContext);
  const [step, setStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [businessType, setBusinessType] = useState<string>('coffee');

  const [formData, setFormData] = useState({
    businessName: '',
    slug: '',
    outletName: '',
    outletCode: 'OUT-01',
    ownerName: '',
    ownerUsername: '',
    ownerPassword: '',
    ownerPin: '123456',
    planCode: initialPlan
  });

  const [slugStatus, setSlugStatus] = useState<{
    checking: boolean;
    available?: boolean;
    message?: string;
    suggestions?: string[];
  }>({ checking: false });

  // Update planCode jika initialPlan berubah
  React.useEffect(() => {
    if (initialPlan) {
      setFormData(prev => ({ ...prev, planCode: initialPlan }));
    }
  }, [initialPlan]);

  // Realtime Slug Check
  React.useEffect(() => {
    if (!formData.slug.trim()) {
      setSlugStatus({ checking: false });
      return;
    }
    const timer = setTimeout(async () => {
      setSlugStatus({ checking: true });
      try {
        const res = await fetch(`/api/auth/check-slug?slug=${encodeURIComponent(formData.slug.trim())}`);
        const data = await res.json();
        if (data.available) {
          setSlugStatus({ checking: false, available: true, message: data.message });
        } else {
          setSlugStatus({
            checking: false,
            available: false,
            message: data.error || 'Subdomain sudah dipakai.',
            suggestions: data.suggestions
          });
        }
      } catch (err) {
        setSlugStatus({ checking: false });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [formData.slug]);

  if (!isOpen) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const autoSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    setFormData(prev => ({
      ...prev,
      businessName: name,
      slug: prev.slug === '' || prev.slug === autoSlug.slice(0, -1) ? autoSlug : prev.slug,
      outletName: prev.outletName === '' ? `${name} (Pusat)` : prev.outletName
    }));
  };

  // Fast Fill Demo Data untuk customer yang ingin coba instan
  const handleFastFillSample = (targetType?: string) => {
    const chosenType = targetType || businessType;
    if (targetType) setBusinessType(targetType);

    const randomNum = Math.floor(100 + Math.random() * 900);
    const isBengkelSelected = chosenType === 'bengkel';
    const isRetailSelected = ['grosir', 'retail', 'bangunan', 'umkm'].includes(chosenType);
    const isLaundrySelected = chosenType === 'laundry';

    const sampleName = isBengkelSelected 
      ? `Bengkel Jaya Motor ${randomNum}` 
      : (isRetailSelected 
        ? `Toko Grosir Berkah Sembako ${randomNum}` 
        : (isLaundrySelected
          ? `Berkah Laundry Kiloan ${randomNum}`
          : `Kafe Senja ${randomNum}`));
    const sampleSlug = isBengkelSelected 
      ? `bengkeljaya${randomNum}` 
      : (isRetailSelected 
        ? `grosirberkah${randomNum}` 
        : (isLaundrySelected
          ? `berkahlaundry${randomNum}`
          : `senjacafe${randomNum}`));
    const sampleUser = isBengkelSelected 
      ? `owner_bengkel${randomNum}` 
      : (isRetailSelected 
        ? `owner_grosir${randomNum}` 
        : (isLaundrySelected
          ? `owner_laundry${randomNum}`
          : `owner_senja${randomNum}`));
    const sampleOwnerName = isBengkelSelected 
      ? 'Hendra Wijaya' 
      : (isRetailSelected 
        ? 'H. Suwandi' 
        : (isLaundrySelected
          ? 'Hj. Maryam'
          : 'Budi Hartono'));

    setFormData({
      businessName: sampleName,
      slug: sampleSlug,
      outletName: isBengkelSelected 
        ? `${sampleName} - Workshop Pusat` 
        : (isLaundrySelected 
          ? `${sampleName} - Outlet Utama`
          : `${sampleName} - Toko Utama`),
      outletCode: 'OUT-01',
      ownerName: sampleOwnerName,
      ownerUsername: sampleUser,
      ownerPassword: 'password123',
      ownerPin: '123456',
      planCode: 'GROWTH'
    });
    toast(`Data contoh ${isBengkelSelected ? 'bengkel' : (isRetailSelected ? 'toko grosir & retail' : (isLaundrySelected ? 'laundry kiloan & satuan' : 'kafe'))} berhasil diisi otomatis!`, 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (!formData.businessName.trim()) {
        toast('Mohon masukkan nama bisnis / usaha Anda', 'error');
        return;
      }
      setStep(2);
      return;
    }

    setSubmitting(true);
    try {
      const isRetailType = ['grosir', 'retail', 'bangunan', 'umkm'].includes(businessType);
      const res = await fetch('/api/auth/register-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          businessType: businessType === 'bengkel' 
            ? 'BENGKEL' 
            : (isRetailType ? 'RETAIL' : (businessType === 'laundry' ? 'LAUNDRY' : 'CAFE'))
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast(`🎉 ${data.message || 'Selamat! Akun uji coba siap digunakan.'}`, 'success');
        if (data.token && data.user && posContext?.login) {
          posContext.login(data.user, data.token);
        }
        onClose();
        if (onSuccess) onSuccess();
        // Arahkan ke kasir POS
        window.location.href = '/pos';
      } else {
        toast(data.error || 'Pendaftaran gagal, mohon periksa kembali data Anda.', 'error');
      }
    } catch (err: any) {
      toast('Terjadi kesalahan koneksi server', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const isRetailCurrent = ['grosir', 'retail', 'bangunan', 'umkm'].includes(businessType);
  const isBengkelCurrent = businessType === 'bengkel';
  const isLaundryCurrent = businessType === 'laundry';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden my-6">
        
        {/* Soft Header */}
        <div className="bg-gradient-to-b from-indigo-50/70 via-purple-50/30 to-white px-6 sm:px-8 pt-7 pb-5 relative border-b border-slate-100">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100 transition-colors"
            title="Tutup"
          >
            <X size={18} />
          </button>
          
          <div className="flex items-center gap-2 text-[11px] font-extrabold tracking-wider uppercase text-indigo-600 mb-1.5">
            <Sparkles size={14} className="text-amber-500" /> Uji Coba Gratis 14 Hari Penuh
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Mulai Toko Anda dalam 1 Menit
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Tanpa kartu kredit • Siap pakai jualan • {isRetailCurrent ? 'Katalog grosir & rak otomatis disiapkan' : (isBengkelCurrent ? 'Stall servis & suku cadang disiapkan' : (isLaundryCurrent ? 'Rak simpan, paket kiloan & chemical otomatis disiapkan' : 'Menu & meja otomatis disiapkan'))}
          </p>

          {/* Stepper Wizard Indicator (Hanya 2 Langkah Sangat Ringkas) */}
          <div className="flex items-center gap-3 mt-5">
            <div className="flex-1 flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                step >= 1 ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-200 text-slate-600'
              }`}>1</span>
              <span className={`text-xs font-bold ${step >= 1 ? 'text-slate-800' : 'text-slate-400'}`}>
                {isRetailCurrent ? 'Profil Toko Retail' : (isBengkelCurrent ? 'Profil Bengkel' : (isLaundryCurrent ? 'Profil Laundry' : 'Profil Kafe'))}
              </span>
            </div>
            <div className="w-8 h-0.5 bg-slate-200" />
            <div className="flex-1 flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                step >= 2 ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-200 text-slate-600'
              }`}>2</span>
              <span className={`text-xs font-bold ${step >= 2 ? 'text-slate-800' : 'text-slate-400'}`}>Akun Pemilik & Paket</span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          
          {/* STEP 1: Profil Bisnis & Tipe Usaha */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              
              {/* Quick Fill Helpers (Opsi Cepat Sesuai Model Bisnis) */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-500" />
                    <span>Coba langsung demo terisi otomatis:</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleFastFillSample('laundry')}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm ${
                      isLaundryCurrent 
                        ? 'bg-cyan-600 hover:bg-cyan-700 text-white ring-2 ring-cyan-300' 
                        : 'bg-white border border-slate-200 hover:bg-cyan-50 text-slate-700'
                    }`}
                  >
                    <Shirt size={13} className={isLaundryCurrent ? 'text-white' : 'text-cyan-600'} />
                    <span>⚡ Isi Contoh Laundry</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFastFillSample('grosir')}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm ${
                      isRetailCurrent 
                        ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-300' 
                        : 'bg-white border border-slate-200 hover:bg-amber-50 text-slate-700'
                    }`}
                  >
                    <Package size={13} className="text-amber-700" />
                    <span>Contoh Toko Grosir</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFastFillSample('coffee')}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm ${
                      businessType === 'coffee'
                        ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' 
                        : 'bg-white border border-slate-200 hover:bg-indigo-50 text-slate-700'
                    }`}
                  >
                    <Coffee size={13} />
                    <span>Contoh Kafe</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFastFillSample('bengkel')}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm ${
                      isBengkelCurrent 
                        ? 'bg-purple-600 text-white ring-2 ring-purple-300' 
                        : 'bg-white border border-slate-200 hover:bg-purple-50 text-slate-700'
                    }`}
                  >
                    <Wrench size={13} />
                    <span>Contoh Bengkel</span>
                  </button>
                </div>
              </div>

              {/* Pilihan Jenis Bidang Usaha / Vertikal */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                  Pilih Jenis Usaha Anda
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {[
                    { id: 'laundry', label: 'Laundry Kiloan', sub: 'Kiloan & Satuan', icon: Shirt, isLaundry: true },
                    { id: 'coffee', label: 'Coffee & Kafe', sub: 'Minuman & Cafe', icon: Coffee },
                    { id: 'grosir', label: 'Toko Grosir', sub: 'Sembako & Ritel', icon: Package, isRetail: true },
                    { id: 'bengkel', label: 'Bengkel Servis', sub: 'Motor & Mobil', icon: Wrench },
                    { id: 'resto', label: 'Resto Kuliner', sub: 'Makanan & Saji', icon: Utensils }
                  ].map(item => {
                    const IconComp = item.icon;
                    const isSelected = businessType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setBusinessType(item.id)}
                        className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 relative ${
                          isSelected 
                            ? (item.isLaundry
                                ? 'border-cyan-500 bg-cyan-50/80 text-cyan-950 shadow-md ring-2 ring-cyan-300'
                                : (item.isRetail 
                                    ? 'border-amber-500 bg-amber-50/80 text-amber-950 shadow-md ring-2 ring-amber-300' 
                                    : 'border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-sm'))
                            : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-600'
                        }`}
                      >
                        <IconComp 
                          size={22} 
                          className={
                            isSelected 
                              ? (item.isLaundry ? 'text-cyan-600' : (item.isRetail ? 'text-amber-600' : 'text-indigo-600')) 
                              : 'text-slate-400'
                          } 
                        />
                        <span className="text-xs font-black leading-tight">{item.label}</span>
                        <span className="text-[10px] text-slate-400 font-medium leading-none">{item.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nama Bisnis */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  {businessType === 'bengkel'
                    ? 'Nama Bengkel / Workshop Usaha *'
                    : (isRetailCurrent
                      ? 'Nama Toko Grosir / Retail *'
                      : (isLaundryCurrent
                        ? 'Nama Laundry / Usaha Cuci *'
                        : 'Nama Kafe / Resto / Brand Usaha *'))}
                </label>
                <div className="relative">
                  <Store size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder={
                      isRetailCurrent 
                        ? "Contoh: Toko Grosir Sembako Berkah" 
                        : (isBengkelCurrent 
                          ? "Contoh: Bengkel Jaya Motor" 
                          : (isLaundryCurrent
                            ? "Contoh: Berkah Laundry Kiloan & Satuan"
                            : "Contoh: Kopi Kenangan Bahagia"))
                    }
                    className="w-full pl-10 pr-4 py-3 bg-slate-50/50 focus:bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    value={formData.businessName}
                    onChange={handleNameChange}
                  />
                </div>
              </div>

              {/* Subdomain Slug (Tampil Halus) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Alamat URL Akses Web Kasir
                  </label>
                  {slugStatus.checking && (
                    <span className="text-[11px] font-medium text-slate-400 animate-pulse flex items-center gap-1">
                      <RefreshCw size={11} className="animate-spin" /> Memeriksa...
                    </span>
                  )}
                  {!slugStatus.checking && slugStatus.available === true && (
                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <Check size={12} /> Tersedia
                    </span>
                  )}
                </div>
                <div className="relative flex items-center">
                  <Globe size={18} className="absolute left-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder={
                      isRetailCurrent 
                        ? "tokogrosir" 
                        : (isBengkelCurrent 
                          ? "bengkeljaya" 
                          : (isLaundryCurrent ? "berkahlaundry" : "namakafe"))
                    }
                    className="w-full pl-10 pr-28 py-3 bg-slate-50/50 focus:bg-white border border-slate-200 rounded-2xl text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    value={formData.slug}
                    onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  />
                  <span className="absolute right-3.5 text-xs font-bold text-slate-400 font-mono">
                    .codenusa.id
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Otomatis terisi dari nama {isRetailCurrent ? "toko grosir" : (isBengkelCurrent ? "bengkel" : (isLaundryCurrent ? "laundry" : "kafe"))} Anda.
                </p>
              </div>

            </div>
          )}

          {/* STEP 2: Akun Pemilik & Pilihan Paket */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Nama Anda (Pemilik / Manajer) *
                </label>
                <div className="relative">
                  <User size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Budi Santoso"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50/50 focus:bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    value={formData.ownerName}
                    onChange={e => setFormData({ ...formData, ownerName: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Username Login *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="budi_owner"
                    className="w-full px-4 py-3 bg-slate-50/50 focus:bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    value={formData.ownerUsername}
                    onChange={e => setFormData({ ...formData, ownerUsername: e.target.value.toLowerCase().replace(/\s/g, '') })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="password"
                      required
                      placeholder="Minimal 6 karakter"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50/50 focus:bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                      value={formData.ownerPassword}
                      onChange={e => setFormData({ ...formData, ownerPassword: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Pilihan Paket Uji Coba */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                  Pilih Paket Uji Coba (Semua Gratis 14 Hari)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { code: 'STARTER', name: 'Starter', price: 'Rp 79rb/bln', desc: '1 Outlet, Kasir POS, KDS Dapur, Meja' },
                    { code: 'GROWTH', name: 'Growth', price: 'Rp 165rb/bln', desc: '2 Outlet, Resep HPP, Absensi GPS, CRM', rec: true },
                    { code: 'BUSINESS', name: 'Business', price: 'Rp 299rb/bln', desc: '5 Outlet, Gudang Pusat, Payroll Kasbon' }
                  ].map(p => (
                    <div
                      key={p.code}
                      onClick={() => setFormData({ ...formData, planCode: p.code })}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                        formData.planCode === p.code
                          ? 'border-indigo-600 bg-indigo-50/60 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div>
                        {p.rec && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-black uppercase mb-1 inline-block">
                            Direkomendasikan
                          </span>
                        )}
                        <h4 className="text-xs font-black text-slate-900">{p.name}</h4>
                        <p className="text-[11px] font-bold text-indigo-600">{p.price}</p>
                        <p className="text-[10px] text-slate-500 mt-1 leading-tight">{p.desc}</p>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${
                          formData.planCode === p.code ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                        }`}>
                          {formData.planCode === p.code && <Check size={10} />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 font-medium">
                <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                <span>Uji coba gratis 14 hari penuh. Tidak dikenakan biaya apapun hari ini.</span>
              </div>

            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all flex items-center gap-1.5"
              >
                <ChevronLeft size={16} /> Sebelumnya
              </button>
            ) : <div />}

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 rounded-2xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Menyiapkan Akun Kafe...
                </>
              ) : step === 2 ? (
                <>
                  <CheckCircle2 size={16} /> Mulai Uji Coba Sekarang
                </>
              ) : (
                <>
                  Lanjut ke Akun <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

export default TenantRegisterWizard;
