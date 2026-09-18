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
  Crown,
  ShieldCheck
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';

interface WizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const TenantRegisterWizard: React.FC<WizardProps> = ({ isOpen, onClose, onSuccess }) => {
  const posContext = useContext(POSContext);
  const [step, setStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    businessName: '',
    slug: '',
    outletName: '',
    outletCode: 'OUT-01',
    ownerName: '',
    ownerUsername: '',
    ownerPassword: '',
    ownerPin: '123456',
    planCode: 'GROWTH'
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 4) {
      setStep(step + 1);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (res.ok) {
        toast(`🎉 ${data.message}`, 'success');
        if (data.token && data.user && posContext?.login) {
          posContext.login(data.user, data.token);
        }
        onClose();
        if (onSuccess) onSuccess();
      } else {
        toast(data.error || 'Pendaftaran gagal', 'error');
      }
    } catch (err: any) {
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-center gap-2 text-xs font-black tracking-widest uppercase text-indigo-400 mb-1">
            <Sparkles size={14} /> Pendaftaran Akun Bisnis SaaS
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Mulai Usaha Baru Anda
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Setup multi-tenant instan dengan database terisolasi & gratis uji coba 14 hari.
          </p>

          {/* Stepper Wizard Progress */}
          <div className="grid grid-cols-4 gap-2 mt-5">
            {[
              { num: 1, label: 'Bisnis' },
              { num: 2, label: 'Outlet' },
              { num: 3, label: 'Akun' },
              { num: 4, label: 'Paket' }
            ].map(s => (
              <div key={s.num} className="space-y-1">
                <div className={`h-1.5 rounded-full transition-all ${
                  step >= s.num ? 'bg-indigo-400 shadow-sm shadow-indigo-400/50' : 'bg-white/20'
                }`} />
                <span className={`text-[10px] font-bold block text-center ${
                  step >= s.num ? 'text-white' : 'text-slate-400'
                }`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          
          {/* STEP 1: Profil Bisnis */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Nama Bisnis / Brand Kafe / Resto *
                </label>
                <div className="relative">
                  <Store size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kopi Senja Nusantara"
                    className="form-control pl-10 text-slate-900 font-semibold bg-white border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                    value={formData.businessName}
                    onChange={handleNameChange}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Subdomain Slug (URL Akses Unik) *
                </label>
                <div className="relative flex items-center">
                  <Globe size={18} className="absolute left-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="kopisenja"
                    className="form-control pl-10 pr-32 font-mono text-sm text-slate-900 font-bold bg-white border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                    value={formData.slug}
                    onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  />
                  <span className="absolute right-3.5 text-xs font-bold text-slate-400 font-mono">
                    .codenusa.id
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Alamat aplikasi Anda: <span className="font-mono text-indigo-600 font-bold">{formData.slug || 'nama-kafe'}.codenusa.id</span>
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: Outlet Pertama */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Nama Cabang / Outlet Pertama *
                </label>
                <div className="relative">
                  <MapPin size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kopi Senja - Cabang Utama"
                    className="form-control pl-10 text-slate-900 font-semibold bg-white border-slate-300 focus:border-indigo-600"
                    value={formData.outletName}
                    onChange={e => setFormData({ ...formData, outletName: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Kode Outlet (Singkatan Cabang) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: JKT-01 atau KS-01"
                  className="form-control uppercase font-mono text-slate-900 font-bold bg-white border-slate-300 focus:border-indigo-600"
                  value={formData.outletCode}
                  onChange={e => setFormData({ ...formData, outletCode: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
          )}

          {/* STEP 3: Akun Pemilik (Owner) */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Nama Lengkap Pemilik (Owner) *
                </label>
                <div className="relative">
                  <User size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Budi Santoso"
                    className="form-control pl-10 text-slate-900 font-semibold bg-white border-slate-300 focus:border-indigo-600"
                    value={formData.ownerName}
                    onChange={e => setFormData({ ...formData, ownerName: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Username Login *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="budi_owner"
                    className="form-control text-slate-900 font-semibold bg-white border-slate-300 focus:border-indigo-600"
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
                      className="form-control pl-10 text-slate-900 font-semibold bg-white border-slate-300 focus:border-indigo-600"
                      value={formData.ownerPassword}
                      onChange={e => setFormData({ ...formData, ownerPassword: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  PIN Cepat Kasir (4-8 Digit Angka)
                </label>
                <div className="relative">
                  <Key size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="password"
                    maxLength={8}
                    placeholder="123456"
                    className="form-control pl-10 font-mono tracking-widest text-slate-900 font-bold bg-white border-slate-300 focus:border-indigo-600"
                    value={formData.ownerPin}
                    onChange={e => setFormData({ ...formData, ownerPin: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Pilihan Paket Awal */}
          {step === 4 && (
            <div className="space-y-4 animate-fade-in">
              <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                Pilih Paket Langganan Awal (Uji Coba Gratis 14 Hari)
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { code: 'STARTER', name: 'Starter', price: 'Rp 99rb/bln', desc: '1 Cabang, 3 Staff' },
                  { code: 'GROWTH', name: 'Growth', price: 'Rp 199rb/bln', desc: '2 Cabang, 10 Staff, KDS, Resep, CRM', rec: true },
                  { code: 'BUSINESS', name: 'Business', price: 'Rp 399rb/bln', desc: '5 Cabang, 30 Staff, Warehouse, Payroll' }
                ].map(p => (
                  <div
                    key={p.code}
                    onClick={() => setFormData({ ...formData, planCode: p.code })}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                      formData.planCode === p.code
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-md scale-[1.02]'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      {p.rec && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-black uppercase mb-1.5 inline-block">
                          Populer
                        </span>
                      )}
                      <h4 className="text-sm font-black text-slate-800">{p.name}</h4>
                      <p className="text-[11px] font-bold text-indigo-600 mt-0.5">{p.price}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{p.desc}</p>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                        formData.planCode === p.code ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                      }`}>
                        {formData.planCode === p.code && <Check size={12} />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 font-semibold">
                <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                <span>Uji coba gratis 14 hari aktif otomatis. Tidak perlu kartu kredit saat pendaftaran.</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="btn btn-secondary px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5"
              >
                <ChevronLeft size={16} /> Sebelumnya
              </button>
            ) : <div />}

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20"
            >
              {submitting ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : step === 4 ? (
                <>
                  <Check size={16} /> Daftarkan Bisnis Sekarang
                </>
              ) : (
                <>
                  Lanjut <ChevronRight size={16} />
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
