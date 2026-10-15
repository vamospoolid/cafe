import React, { useState, useContext, useEffect } from 'react';
import { 
  Store, 
  Globe, 
  MapPin, 
  User, 
  Lock, 
  Eye,
  EyeOff,
  Phone,
  Check, 
  ChevronRight, 
  Sparkles, 
  X, 
  RefreshCw,
  ShieldCheck,
  Coffee,
  Wrench,
  Package,
  Zap,
  CheckCircle2,
  Shirt,
  MessageSquare,
  ExternalLink,
  Copy
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';

interface WizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialPlan?: string;
  initialBusinessType?: string;
  initialStoreName?: string;
  initialPhone?: string;
}

const resolveBusinessType = (raw?: string): string => {
  if (!raw) return 'coffee';
  const norm = raw.toLowerCase();
  if (['cafe', 'coffee', 'resto', 'kuliner'].includes(norm)) return 'coffee';
  if (['bengkel', 'otomotif'].includes(norm)) return 'bengkel';
  if (['retail', 'grosir', 'sembako', 'bangunan', 'umkm'].includes(norm)) return 'grosir';
  if (['laundry'].includes(norm)) return 'laundry';
  if (['rental', 'baju_bodo'].includes(norm)) return 'rental';
  return 'coffee';
};

export const TenantRegisterWizard: React.FC<WizardProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  initialPlan = 'GROWTH',
  initialBusinessType = 'coffee',
  initialStoreName = '',
  initialPhone = ''
}) => {
  const posContext = useContext(POSContext);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [businessType, setBusinessType] = useState<string>(() => resolveBusinessType(initialBusinessType));
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [successData, setSuccessData] = useState<any>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    businessName: initialStoreName || '',
    phone: initialPhone || '',
    ownerName: '',
    city: '',
    address: '',
    slug: '',
    ownerUsername: '',
    ownerPassword: 'password123',
    ownerPin: '123456',
    planCode: initialPlan
  });

  const [slugStatus, setSlugStatus] = useState<{
    checking: boolean;
    available?: boolean;
    message?: string;
  }>({ checking: false });

  // Update initial props when changed
  useEffect(() => {
    if (initialStoreName && !formData.businessName) {
      const autoSlug = initialStoreName.toLowerCase().replace(/[^a-z0-9]/g, '');
      setFormData(prev => ({
        ...prev,
        businessName: initialStoreName,
        slug: autoSlug
      }));
    }
  }, [initialStoreName]);

  useEffect(() => {
    if (initialPhone && !formData.phone) {
      setFormData(prev => ({ ...prev, phone: initialPhone }));
    }
  }, [initialPhone]);

  useEffect(() => {
    if (initialPlan) {
      setFormData(prev => ({ ...prev, planCode: initialPlan }));
    }
  }, [initialPlan]);

  useEffect(() => {
    if (initialBusinessType) {
      setBusinessType(resolveBusinessType(initialBusinessType));
    }
  }, [initialBusinessType]);

  // Realtime Slug Checker
  useEffect(() => {
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
            message: data.error || 'Subdomain sudah dipakai'
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
    const autoSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    setFormData(prev => ({
      ...prev,
      businessName: name,
      slug: prev.slug === '' || prev.slug === autoSlug.slice(0, -1) ? autoSlug : prev.slug
    }));
  };

  const handleFastFillSample = (targetType?: string) => {
    const chosenType = targetType || businessType;
    if (targetType) setBusinessType(targetType);

    const randomNum = Math.floor(100 + Math.random() * 900);
    const isBengkelSelected = chosenType === 'bengkel';
    const isRetailSelected = ['grosir', 'retail', 'bangunan', 'umkm'].includes(chosenType);
    const isLaundrySelected = chosenType === 'laundry';
    const isRentalSelected = chosenType === 'rental';

    const sampleName = isRentalSelected
      ? `Sanggar Busana Bugis ${randomNum}`
      : (isBengkelSelected 
        ? `Bengkel Jaya Motor ${randomNum}` 
        : (isRetailSelected 
          ? `Toko Grosir Berkah ${randomNum}` 
          : (isLaundrySelected
            ? `Berkah Laundry Kiloan ${randomNum}`
            : `Kafe Senja ${randomNum}`)));

    const sampleSlug = isRentalSelected
      ? `sanggartengki${randomNum}`
      : (isBengkelSelected 
        ? `bengkeljaya${randomNum}` 
        : (isRetailSelected 
          ? `grosirberkah${randomNum}` 
          : (isLaundrySelected
            ? `berkahlaundry${randomNum}`
            : `senjacafe${randomNum}`)));

    const sampleOwnerName = isRentalSelected
      ? 'Andi Tenri'
      : (isBengkelSelected 
        ? 'Hendra Wijaya' 
        : (isRetailSelected 
          ? 'H. Suwandi' 
          : (isLaundrySelected
            ? 'Hj. Maryam'
            : 'Budi Hartono')));

    const sampleCity = isRentalSelected
      ? 'Makassar'
      : (isBengkelSelected 
        ? 'Bekasi' 
        : (isRetailSelected 
          ? 'Surabaya' 
          : (isLaundrySelected
            ? 'Bandung'
            : 'Jakarta Selatan')));

    setFormData({
      businessName: sampleName,
      phone: `0812${Math.floor(10000000 + Math.random() * 90000000)}`,
      ownerName: sampleOwnerName,
      city: sampleCity,
      address: `Jl. Ahmad Yani No. ${Math.floor(10 + Math.random() * 80)}`,
      slug: sampleSlug,
      ownerUsername: '',
      ownerPassword: 'password123',
      ownerPin: '123456',
      planCode: 'GROWTH'
    });
    toast(`Data contoh ${chosenType} berhasil diisi otomatis!`, 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.businessName.trim()) {
      toast('Mohon masukkan nama toko / usaha Anda', 'error');
      return;
    }

    const cleanPhone = formData.phone.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      toast('Mohon masukkan nomor WhatsApp / HP aktif (minimal 8 digit)', 'error');
      return;
    }

    // Capture UTM tracking params from URL or localStorage
    let utmSource = null;
    let utmCampaign = null;
    let utmMedium = null;
    let fbclid = null;

    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      utmSource = sp.get('utm_source') || localStorage.getItem('cp_utm_source');
      utmCampaign = sp.get('utm_campaign') || localStorage.getItem('cp_utm_campaign');
      utmMedium = sp.get('utm_medium') || localStorage.getItem('cp_utm_medium');
      fbclid = sp.get('fbclid') || localStorage.getItem('cp_fbclid');
    }

    setSubmitting(true);
    try {
      const isRetailType = ['grosir', 'retail', 'bangunan', 'umkm'].includes(businessType);
      const mappedBusinessType = businessType === 'rental'
        ? 'RENTAL'
        : (businessType === 'bengkel' 
          ? 'BENGKEL' 
          : (isRetailType ? 'RETAIL' : (businessType === 'laundry' ? 'LAUNDRY' : 'CAFE')));

      const res = await fetch('/api/auth/register-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          businessType: mappedBusinessType,
          utmSource,
          utmCampaign,
          utmMedium,
          fbclid
        })
      });

      const data = await res.json();
      if (res.ok) {
        // Trigger Meta / Facebook Pixel Lead & CompleteRegistration Event
        try {
          if (typeof window !== 'undefined' && (window as any).fbq) {
            (window as any).fbq('track', 'CompleteRegistration', {
              content_name: formData.businessName,
              currency: 'IDR',
              value: 0,
              status: 'success'
            });
          }
        } catch (e) {}

        // Auto login to context if available
        if (data.token && data.user && posContext?.login) {
          posContext.login(data.user, data.token);
        }

        toast(`🎉 ${data.message || 'Selamat! Akun toko Anda aktif.'}`, 'success');
        
        // Show Success Modal / Welcome Kit screen
        setSuccessData(data.credentials || {
          businessName: formData.businessName,
          slug: formData.slug || formData.businessName.toLowerCase().replace(/[^a-z0-9]/g, ''),
          phone: cleanPhone,
          username: cleanPhone || 'owner',
          password: formData.ownerPassword || 'password123',
          subdomainUrl: `https://${formData.slug || 'toko'}.codenusa.id/pos`,
          posUrl: '/pos'
        });

        if (onSuccess) onSuccess();
      } else {
        toast(data.error || 'Pendaftaran gagal, mohon periksa kembali data Anda.', 'error');
      }
    } catch (err: any) {
      toast('Terjadi kesalahan koneksi server', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenWhatsAppKit = () => {
    if (!successData) return;
    const phone = successData.phone || formData.phone.replace(/[^0-9]/g, '');
    let targetPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;

    const message = `Halo ${successData.businessName || 'Kak'}! 🚀\n\nSelamat, akun CodePOS Anda telah aktif:\n\n🏪 *Nama Toko:* ${successData.businessName}\n🌐 *Link Kasir:* ${successData.subdomainUrl || 'https://' + successData.slug + '.codenusa.id/pos'}\n👤 *Username:* ${successData.username}\n🔑 *Password:* ${successData.password || formData.ownerPassword}\n\nSimpan pesan ini untuk akses kasir kapan saja. Butuh bantuan hubungi CS CodePOS.`;

    const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const handleCopyAccess = () => {
    if (!successData) return;
    const text = `Akses Kasir CodePOS:\nNama Toko: ${successData.businessName}\nLink: ${successData.subdomainUrl}\nUser: ${successData.username}\nPass: ${successData.password || formData.ownerPassword}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast('Detail login disalin ke clipboard!', 'success');
  };

  const isRetailCurrent = ['grosir', 'retail', 'bangunan', 'umkm'].includes(businessType);
  const isBengkelCurrent = businessType === 'bengkel';
  const isLaundryCurrent = businessType === 'laundry';
  const isRentalCurrent = businessType === 'rental';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-3 sm:p-4 animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-3xl sm:rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden my-4 sm:my-6 transition-all">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100 transition-colors"
          title="Tutup"
        >
          <X size={20} />
        </button>

        {/* ─── SUCCESS / WELCOME KIT SCREEN ─── */}
        {successData ? (
          <div className="p-6 sm:p-8 text-center space-y-5 animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={36} className="text-emerald-600 animate-bounce" />
            </div>

            <div>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Pendaftaran Berhasil • Langsung Aktif 14 Hari
              </span>
              <h3 className="text-2xl font-black text-slate-900 mt-2">
                Selamat Datang, {successData.businessName}!
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Toko dan sistem kasir Anda telah siap pakai. Data login Anda telah disiapkan:
              </p>
            </div>

            {/* Credential Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left space-y-2.5 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-sans font-bold">Akses Kasir POS</span>
                <button
                  type="button"
                  onClick={handleCopyAccess}
                  className="flex items-center gap-1 text-[11px] font-sans font-bold text-indigo-600 hover:text-indigo-800"
                >
                  <Copy size={12} /> {copied ? 'Tersalin!' : 'Salin Akun'}
                </button>
              </div>

              <div>
                <span className="text-slate-400 font-sans block text-[10px]">Alamat Web Toko:</span>
                <span className="text-indigo-600 font-bold break-all">
                  {successData.subdomainUrl || `https://${successData.slug}.codenusa.id/pos`}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-slate-400 font-sans block text-[10px]">Username:</span>
                  <span className="text-slate-800 font-bold">{successData.username}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-sans block text-[10px]">Password:</span>
                  <span className="text-slate-800 font-bold">{successData.password || formData.ownerPassword}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => { window.location.href = '/pos'; }}
                className="w-full py-3.5 px-6 rounded-2xl font-black text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <span>Buka Dashboard Kasir Sekarang</span>
                <ExternalLink size={16} />
              </button>

              <button
                type="button"
                onClick={handleOpenWhatsAppKit}
                className="w-full py-3 px-6 rounded-2xl font-bold text-xs text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageSquare size={16} className="text-emerald-600" />
                <span>Simpan Detail Akun ke WhatsApp Saya</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Butuh panduan instalasi printer atau scanner barcode? Tim CS WhatsApp kami siap membantu.
            </p>
          </div>
        ) : (
          /* ─── 1-PAGE FRICTIONLESS REGISTRATION FORM ─── */
          <>
            {/* Header */}
            <div className="bg-gradient-to-b from-indigo-50/80 via-purple-50/40 to-white px-6 sm:px-8 pt-6 pb-4 border-b border-slate-100 text-left">
              <div className="flex items-center gap-1.5 text-[11px] font-black tracking-wider uppercase text-indigo-600 mb-1">
                <Sparkles size={14} className="text-amber-500" /> Uji Coba Gratis 14 Hari Penuh
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Mulai Toko Anda dalam 30 Detik
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cukup isi data usaha Anda. Sistem & katalog {isRetailCurrent ? 'retail grosir' : (isBengkelCurrent ? 'bengkel motor' : (isLaundryCurrent ? 'laundry' : (isRentalCurrent ? 'sewa busana' : 'kafe')))} langsung disiapkan otomatis.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4 text-left">
              
              {/* 1. Pilihan Bidang Usaha (5 Vertikal) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                  <span>1. Bidang Usaha Anda</span>
                  <span className="text-[10px] text-indigo-600 font-semibold lowercase">katalog & fitur otomatis sesuai</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {[
                    { id: 'coffee', label: 'Kafe & Resto', icon: Coffee },
                    { id: 'bengkel', label: 'Bengkel Servis', icon: Wrench },
                    { id: 'grosir', label: 'Grosir & Retail', icon: Package },
                    { id: 'laundry', label: 'Laundry Kiloan', icon: Shirt },
                    { id: 'rental', label: 'Sewa Busana', icon: Sparkles }
                  ].map(item => {
                    const IconComp = item.icon;
                    const isSelected = businessType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setBusinessType(item.id)}
                        className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          isSelected 
                            ? 'border-indigo-600 bg-indigo-50/90 text-indigo-950 shadow-sm ring-2 ring-indigo-400/70 font-black' 
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600 hover:bg-slate-50 font-bold'
                        }`}
                      >
                        <IconComp size={16} className={isSelected ? 'text-indigo-600' : 'text-slate-400'} />
                        <span className="text-[11px] leading-tight">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fast Fill Demo Helper */}
              <div className="flex items-center justify-between px-3 py-2 bg-indigo-50/70 rounded-xl border border-indigo-100 text-xs">
                <span className="text-indigo-900 font-semibold text-[11px] flex items-center gap-1.5">
                  <Zap size={13} className="text-amber-500 fill-amber-500" />
                  <span>Ingin coba langsung tanpa ketik?</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleFastFillSample(businessType)}
                  className="px-2.5 py-1 rounded-lg font-bold text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all cursor-pointer"
                >
                  Isi Otomatis Contoh &rarr;
                </button>
              </div>

              {/* 2. Nama Usaha & Nomor WhatsApp (Dua Field Paling Penting) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Nama Toko / Usaha *
                  </label>
                  <div className="relative">
                    <Store size={16} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder={
                        isRentalCurrent ? "Sanggar Busana Bugis" :
                        isRetailCurrent ? "Toko Grosir Berkah" :
                        isBengkelCurrent ? "Bengkel Jaya Motor" :
                        isLaundryCurrent ? "Fresh Laundry Kiloan" :
                        "Kafe Senja Bahagia"
                      }
                      value={formData.businessName}
                      onChange={handleNameChange}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50/50 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider flex items-center justify-between">
                    <span>Nomor WhatsApp Aktif *</span>
                    <span className="text-[10px] text-emerald-600 font-semibold">kirim info akun</span>
                  </label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-3 text-emerald-500" />
                    <input
                      type="tel"
                      required
                      placeholder="0812-3456-7890"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50/50 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Nama Pemilik & Kota / Domisili */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Nama Pemilik / Manajer
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Contoh: Budi Santoso"
                      value={formData.ownerName}
                      onChange={e => setFormData({ ...formData, ownerName: e.target.value })}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50/50 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Kota / Domisili Usaha
                  </label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Contoh: Jakarta / Surabaya / Makassar"
                      value={formData.city}
                      onChange={e => setFormData({ ...formData, city: e.target.value })}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50/50 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Password Kasir */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider flex items-center justify-between">
                  <span>Password Login Kasir *</span>
                  <span className="text-[10px] text-slate-400">bisa diubah kapan saja</span>
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Minimal 6 karakter"
                    value={formData.ownerPassword}
                    onChange={e => setFormData({ ...formData, ownerPassword: e.target.value })}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50/50 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* 5. Subdomain & Username (Accordion Kustomisasi Halus) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>{showAdvanced ? '− Sembunyikan' : '+ Kustomisasi Alamat Subdomain & Username'}</span>
                  {!showAdvanced && formData.slug && (
                    <span className="text-[11px] text-slate-400 font-mono font-normal">
                      ({formData.slug}.codenusa.id)
                    </span>
                  )}
                </button>

                {showAdvanced && (
                  <div className="mt-2.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-fade-in">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-700 uppercase">
                          Alamat Subdomain Kasir
                        </label>
                        {slugStatus.checking && (
                          <span className="text-[10px] text-slate-400 animate-pulse flex items-center gap-1">
                            <RefreshCw size={10} className="animate-spin" /> Memeriksa...
                          </span>
                        )}
                        {!slugStatus.checking && slugStatus.available === true && (
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                            <Check size={11} /> Tersedia
                          </span>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <Globe size={15} className="absolute left-3 text-slate-400" />
                        <input
                          type="text"
                          value={formData.slug}
                          onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                          placeholder="namatoko"
                          className="w-full pl-8 pr-24 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="absolute right-3 text-xs font-bold text-slate-400 font-mono">
                          .codenusa.id
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase block mb-1">
                        Alamat Lengkap Toko (Opsional)
                      </label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Contoh: Jl. Sudirman No. 45"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Security & Guarantee Badge */}
              <div className="p-2.5 bg-emerald-50 border border-emerald-200/80 rounded-xl flex items-center gap-2 text-[11px] text-emerald-800 font-semibold">
                <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                <span>Uji coba gratis 14 hari penuh • Bebas pakai semua fitur kasir & stok • Tanpa kartu kredit.</span>
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 px-6 rounded-2xl font-black text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Menyiapkan Toko & Sistem Kasir Anda...</span>
                    </>
                  ) : (
                    <>
                      <span>Mulai Toko Gratis 14 Hari Sekarang</span>
                      <ChevronRight size={18} />
                    </>
                  )}
                </button>
              </div>

            </form>
          </>
        )}

      </div>
    </div>
  );
};

export default TenantRegisterWizard;
