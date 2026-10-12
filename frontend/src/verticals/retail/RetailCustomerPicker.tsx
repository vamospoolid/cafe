import React, { useState, useEffect } from 'react';
import { 
  User, 
  Search, 
  AlertTriangle, 
  ShieldCheck, 
  Check, 
  Phone, 
  DollarSign, 
  X, 
  Wallet,
  Plus,
  ArrowLeft,
  Building,
  Tag,
  Clock,
  Sparkles
} from 'lucide-react';
import { toast } from '../../utils/alert';

export interface CustomerData {
  id: number;
  name: string;
  phone: string;
  priceTier?: string;
  creditLimit: number;
  creditTermDays: number;
  isCreditBlocked: boolean;
  activeDebtTotal?: number;
  remainingLimit?: number;
  isOverLimit?: boolean;
}

interface RetailCustomerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: CustomerData | null) => void;
  selectedCustomer: CustomerData | null;
  onPayDebt?: (customer: CustomerData) => void;
}

export const RetailCustomerPicker: React.FC<RetailCustomerPickerProps> = ({
  isOpen,
  onClose,
  onSelectCustomer,
  selectedCustomer,
  onPayDebt
}) => {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(false);

  // Quick Customer Registration States
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPriceTier, setNewPriceTier] = useState<'UMUM' | 'MITRA' | 'GROSIR'>('MITRA');
  const [newCreditLimit, setNewCreditLimit] = useState<number | string>(1000000);
  const [newCreditTermDays, setNewCreditTermDays] = useState<number | string>(14);
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
      setIsAddingNew(false);
      setFormError('');
    }
  }, [isOpen]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('pos_token') || localStorage.getItem('token');
      const res = await fetch('/api/retail/customers/credit-summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartAddNew = (initialName: string = '') => {
    setNewName(initialName);
    setNewPhone('');
    setNewPriceTier('MITRA');
    setNewCreditLimit(1000000);
    setNewCreditTermDays(14);
    setFormError('');
    setIsAddingNew(true);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setFormError('Nama warung / pelanggan wajib diisi');
      return;
    }
    if (!newPhone.trim()) {
      setFormError('Nomor telepon / WhatsApp wajib diisi');
      return;
    }

    setIsSubmittingNew(true);
    setFormError('');

    try {
      const token = localStorage.getItem('pos_token') || localStorage.getItem('token');
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newName.trim(),
          phone: newPhone.trim(),
          priceTier: newPriceTier,
          creditLimit: Number(newCreditLimit) || 0,
          creditTermDays: Number(newCreditTermDays) || 14,
          isCreditBlocked: false
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Gagal mendaftarkan pelanggan baru');
      }

      const created = await res.json();
      const mappedCustomer: CustomerData = {
        id: created.id,
        name: created.name,
        phone: created.phone,
        priceTier: created.priceTier || newPriceTier,
        creditLimit: created.creditLimit !== undefined ? Number(created.creditLimit) : (Number(newCreditLimit) || 0),
        creditTermDays: created.creditTermDays !== undefined ? Number(created.creditTermDays) : (Number(newCreditTermDays) || 14),
        isCreditBlocked: Boolean(created.isCreditBlocked),
        activeDebtTotal: 0,
        remainingLimit: created.creditLimit !== undefined ? Number(created.creditLimit) : (Number(newCreditLimit) || 0),
        isOverLimit: false
      };

      toast(`🎉 Pelanggan "${mappedCustomer.name}" berhasil didaftarkan!`, 'success');
      onSelectCustomer(mappedCustomer);
      setIsAddingNew(false);
      onClose();
    } catch (err: any) {
      console.error('Error creating customer:', err);
      setFormError(err.message || 'Gagal menyimpan data pelanggan');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  if (!isOpen) return null;

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isAddingNew ? (
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                title="Kembali ke daftar pelanggan"
              >
                <ArrowLeft size={18} />
              </button>
            ) : (
              <User size={18} className="text-emerald-400" />
            )}
            <h3 className="font-extrabold text-sm tracking-tight">
              {isAddingNew ? 'Daftar Warung / Pelanggan Baru' : 'Pilih Warung / Pelanggan Mitra'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {!isAddingNew && (
              <button
                type="button"
                onClick={() => handleStartAddNew(search.trim())}
                className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs flex items-center gap-1 transition shadow-xs cursor-pointer"
                title="Daftarkan warung atau pelanggan baru langsung dari kasir"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">Tambah Baru</span>
              </button>
            )}
            <button 
              type="button"
              onClick={onClose} 
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ─── FORM TAMBAH PELANGGAN CEPAT ─── */}
        {isAddingNew ? (
          <form onSubmit={handleCreateCustomer} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                <AlertTriangle size={15} className="shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Warung / Toko / Pelanggan <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Building size={15} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Contoh: Warung Bu Siti / Toko Barokah"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-purple-600 font-bold text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nomor WhatsApp / HP <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="tel"
                  required
                  placeholder="Contoh: 081234567890"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-purple-600 font-bold font-mono text-slate-900"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Digunakan untuk kirim faktur &amp; tagihan bon otomatis via WhatsApp.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kategori Harga (Price Tier)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'UMUM', label: 'Eceran', desc: 'Harga Umum' },
                  { id: 'MITRA', label: 'Warung', desc: 'Grosir Sedang' },
                  { id: 'GROSIR', label: 'Partai', desc: 'Harga Terendah' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setNewPriceTier(t.id as any)}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      newPriceTier === t.id
                        ? 'bg-purple-50 border-purple-600 text-purple-950 font-black shadow-2xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-black">{t.label}</div>
                    <div className="text-[10px] text-slate-400">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Plafon Bon (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    value={newCreditLimit}
                    onChange={e => setNewCreditLimit(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-purple-600 font-bold font-mono text-slate-900"
                  />
                </div>
                <span className="text-[10px] text-slate-400">Maks bon tempo</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jatuh Tempo (Hari)
                </label>
                <div className="relative">
                  <Clock size={15} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={newCreditTermDays}
                    onChange={e => setNewCreditTermDays(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-purple-600 font-bold font-mono text-slate-900"
                  />
                </div>
                <span className="text-[10px] text-slate-400">Default: 14 hari</span>
              </div>
            </div>

            <div className="pt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingNew}
                className="flex-1 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 active:scale-95 text-white font-extrabold text-xs transition shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSubmittingNew ? (
                  <span>Menyimpan...</span>
                ) : (
                  <>
                    <Check size={15} />
                    <span>Simpan &amp; Pilih</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* ─── LIST VIEW DAFTAR PELANGGAN ─── */
          <>
            {/* Search */}
            <div className="p-3 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama warung, pemilik, atau nomor HP... (Tekan Esc untuk batal)"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-semibold"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* Opsi Pelanggan Umum */}
              <div
                onClick={() => {
                  onSelectCustomer(null);
                  onClose();
                }}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  selectedCustomer === null
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold'
                    : 'hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div>
                  <div className="text-xs font-bold">🛒 Pelanggan Umum (Tanpa Bon)</div>
                  <div className="text-[11px] text-slate-500">Harga Eceran Biasa • Bayar Tunai / QRIS Langsung</div>
                </div>
                {selectedCustomer === null && <Check size={16} className="text-emerald-600" />}
              </div>

              {loading ? (
                <div className="p-8 text-center text-xs text-slate-400 font-semibold">Memuat data pelanggan &amp; buku bon...</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <div className="text-xs text-slate-400">Tidak ada pelanggan yang cocok dengan "{search}".</div>
                  <button
                    type="button"
                    onClick={() => handleStartAddNew(search.trim())}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Daftarkan "{search || 'Baru'}" Sebagai Pelanggan Baru</span>
                  </button>
                </div>
              ) : (
                filtered.map(c => {
                  const isSelected = selectedCustomer?.id === c.id;
                  const hasDebt = (c.activeDebtTotal || 0) > 0;
                  const isBlocked = c.isCreditBlocked;

                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        onSelectCustomer(c);
                        onClose();
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-500 shadow-2xs'
                          : 'hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{c.name}</span>
                          {c.priceTier && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {c.priceTier}
                            </span>
                          )}
                          {isBlocked && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 flex items-center gap-0.5">
                              <AlertTriangle size={10} /> DIBLOKIR
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1 font-mono">
                            <Phone size={11} /> {c.phone}
                          </span>
                          {c.creditLimit > 0 && (
                            <span>
                              Plafon: <strong>Rp {c.creditLimit.toLocaleString('id-ID')}</strong> ({c.creditTermDays} hari)
                            </span>
                          )}
                        </div>
                        {hasDebt && (
                          <div className="text-[11px]">
                            <span className="text-amber-700 font-bold">
                              Bon Berjalan: Rp {(c.activeDebtTotal || 0).toLocaleString('id-ID')}
                            </span>
                            {c.creditLimit > 0 && (
                              <span className="text-slate-500 ml-2">
                                (Sisa Plafon: Rp {(c.remainingLimit || 0).toLocaleString('id-ID')})
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {hasDebt && onPayDebt && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPayDebt(c);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="Terima Setoran / Bayar Cicilan Bon Pelanggan Ini"
                          >
                            <Wallet size={12} />
                            <span>Bayar Bon</span>
                          </button>
                        )}
                        {isSelected && <Check size={18} className="text-emerald-600 shrink-0" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center">
              <span>Tekan <strong>Esc</strong> untuk menutup</span>
              <button
                type="button"
                onClick={() => handleStartAddNew(search.trim())}
                className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} />
                <span>Tambah Pelanggan Baru</span>
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default RetailCustomerPicker;
