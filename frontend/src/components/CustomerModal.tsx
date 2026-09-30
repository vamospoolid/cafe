import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  X, Search, UserCheck, Star, Gift, User, Phone, 
  ArrowRight, UserPlus, Minus, Plus
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: any) => void;
}

const CustomerModal: React.FC<CustomerModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [newPhone, setNewPhone] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Loyalty Redeem State (baru) ──────────────────────────────
  const [redeemEnabled, setRedeemEnabled] = useState(false);
  const [redeemQty, setRedeemQty] = useState(0);

  const posContext = useContext(POSContext);
  const debounceTimer = useRef<any>(null);

  const settings = posContext?.settings;
  const loyaltyEnabled    = settings ? settings.loyaltyEnabled !== false : true;
  const loyaltyPointValue = settings ? (settings.loyaltyPointValue || 100) : 100;
  const maxRedeemSetting  = settings ? (settings.loyaltyMaxRedeemPerOrder || 0) : 0;
  const minRedeemSetting  = settings ? (settings.loyaltyRedeemMinPoints || 1) : 1;

  // Computed: maksimum poin yang bisa ditukar pada transaksi ini
  const customerPoints = selectedCustomer?.points || 0;
  const maxRedeemable  = maxRedeemSetting > 0
    ? Math.min(customerPoints, maxRedeemSetting)
    : customerPoints;

  // Computed: nominal diskon & sisa poin
  const discountAmount  = redeemEnabled ? redeemQty * loyaltyPointValue : 0;
  const remainingPoints = customerPoints - (redeemEnabled ? redeemQty : 0);

  // ── Reset saat modal tutup ───────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedCustomer(null);
      setNewPhone('');
      setShowAddMember(false);
      setRedeemEnabled(false);
      setRedeemQty(0);
    }
  }, [isOpen]);

  // Reset redeem saat customer diganti
  useEffect(() => {
    setRedeemEnabled(false);
    setRedeemQty(0);
  }, [selectedCustomer]);

  // ── Search ───────────────────────────────────────────────────
  const searchCustomers = async (query: string) => {
    if (!query || query.trim().length === 0) {
      setSearchResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(query.trim())}`, {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to search customers:', err);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setSelectedCustomer(null);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => searchCustomers(val), 250);
  };

  const handleSelectMember = (cust: any) => {
    setSelectedCustomer(cust);
    setSearchQuery(cust.name);
    setSearchResults([]);
    setShowAddMember(false);
  };

  // ── Stepper helpers ──────────────────────────────────────────
  const changeRedeemQty = (delta: number) => {
    setRedeemQty(q => Math.min(maxRedeemable, Math.max(0, q + delta)));
  };

  const setPreset = (val: number) => {
    setRedeemQty(Math.min(maxRedeemable, Math.max(0, val)));
  };

  // ── Proceed ──────────────────────────────────────────────────
  const handleProceed = async () => {
    const guestName = searchQuery.trim() || 'Pelanggan Umum';

    if (selectedCustomer) {
      const data: any = {
        id:     selectedCustomer.id,
        name:   selectedCustomer.name,
        phone:  selectedCustomer.phone || '',
        points: selectedCustomer.points || 0,
        tier:   selectedCustomer.tier || 'Bronze'
      };

      if (loyaltyEnabled && redeemEnabled && redeemQty >= minRedeemSetting) {
        data.pointsUsed     = redeemQty;
        data.discountAmount = redeemQty * loyaltyPointValue;
      }

      onSelect(data);
      onClose();
    } else {
      const cleanPhone = newPhone.trim();
      if (cleanPhone) {
        try {
          const res = await fetch('/api/customers', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${posContext?.token}`
            },
            body: JSON.stringify({ name: guestName, phone: cleanPhone })
          });
          const cust = await res.json();
          if (res.ok && cust?.id) {
            toast(
              cust.alreadyExists
                ? `Member "${cust.name}" berhasil dihubungkan ke CRM!`
                : `✨ Member baru "${cust.name}" otomatis tersimpan di CRM!`,
              'success'
            );
            onSelect({
              id: cust.id, name: cust.name,
              phone: cust.phone, points: cust.points || 0,
              tier: cust.tier || 'Bronze'
            });
            onClose();
            return;
          }
        } catch (err) {
          console.error('Auto register customer failed:', err);
        }
      }
      onSelect({ name: guestName, phone: cleanPhone || undefined });
      onClose();
    }
  };

  if (!isOpen) return null;

  // ── Tier color helper ────────────────────────────────────────
  const tierStyle = (tier: string) =>
    tier === 'Gold'   ? 'bg-amber-100 text-amber-800' :
    tier === 'Silver' ? 'bg-slate-200 text-slate-700' :
                        'bg-orange-100 text-orange-800';

  const tierBadgeStyle = (tier: string) =>
    tier === 'Gold'   ? 'bg-amber-100 text-amber-800 border-amber-200' :
    tier === 'Silver' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                        'bg-orange-100 text-orange-700 border-orange-200';

  // ── Quick preset values ──────────────────────────────────────
  const presets = [
    { label: '25 pts', val: 25 },
    { label: '50 pts', val: 50 },
    { label: '100 pts', val: 100 },
    { label: `Semua (${maxRedeemable})`, val: maxRedeemable }
  ].filter(p => p.val > 0 && p.val <= maxRedeemable && p.val >= minRedeemSetting);

  // Deduplicate & keep unique vals
  const uniquePresets = presets.filter((p, i, arr) => arr.findIndex(x => x.val === p.val) === i);

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="p-4 sm:p-5 border-b border-indigo-100/70 bg-indigo-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-inner">
              <UserCheck size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-indigo-950 tracking-tight">
                Pilih Pelanggan / Member
              </h2>
              <p className="text-[11px] text-indigo-600/80 font-medium">
                Cari member terdaftar atau input nama tamu langsung
              </p>
            </div>
          </div>
          <button
            type="button"
            className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors shadow-sm"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* Search Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Ketik Nama Pelanggan / Member
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none transition-all shadow-sm"
                placeholder="Contoh: Zidan, Andi, Bu Rina..."
                value={searchQuery}
                onChange={handleQueryChange}
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setSelectedCustomer(null); setSearchResults([]); }}
                  className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Search Results */}
          {loading ? (
            <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <div className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full" />
              <span>Mencari data member...</span>
            </div>
          ) : searchResults.length > 0 && !selectedCustomer ? (
            <div className="space-y-1.5 border border-indigo-100 bg-indigo-50/40 p-2 rounded-2xl">
              <div className="text-[10px] font-black text-indigo-800 uppercase px-2 py-0.5 tracking-wider">
                Member Ditemukan ({searchResults.length})
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-indigo-100/60 rounded-xl bg-white border border-indigo-100/80 shadow-sm">
                {searchResults.map(cust => (
                  <div
                    key={cust.id}
                    onClick={() => handleSelectMember(cust)}
                    className="p-2.5 hover:bg-indigo-50/70 transition-colors cursor-pointer flex items-center justify-between gap-2 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${tierStyle(cust.tier)}`}>
                        {cust.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-xs text-slate-900 truncate group-hover:text-indigo-600">
                          {cust.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium truncate">
                          {cust.phone || 'Tanpa No. HP'} • <span className="font-bold text-slate-600">{cust.tier || 'Bronze'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 font-black text-xs text-indigo-700 justify-end">
                        <Star size={12} className="text-amber-500 fill-amber-500" />
                        <span>{cust.points || 0} pts</span>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-600 block">Pilih →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* ── Selected Member Card ─────────────────────────── */}
          {selectedCustomer && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50/50 border border-indigo-200 p-4 rounded-2xl space-y-3">

              {/* Member Info */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
                    {selectedCustomer.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-sm text-slate-900">{selectedCustomer.name}</span>
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${tierBadgeStyle(selectedCustomer.tier)}`}>
                        {selectedCustomer.tier || 'Bronze'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {selectedCustomer.phone || '-'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="text-xs text-slate-400 hover:text-rose-600 font-bold underline shrink-0"
                >
                  Ganti
                </button>
              </div>

              {/* ── Point Redemption Panel ──────────────────── */}
              {loyaltyEnabled && (
                <div className="bg-white rounded-xl border border-indigo-100 p-3 space-y-3 shadow-sm">

                  {/* Baris Saldo + Toggle */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                        Saldo Poin
                      </div>
                      <div className="flex items-center gap-1">
                        <Star size={13} className="text-amber-500 fill-amber-500" />
                        <span className="text-base font-black text-indigo-700">{customerPoints}</span>
                        <span className="text-xs text-slate-400 font-medium">poin</span>
                        {customerPoints > 0 && (
                          <span className="text-[10px] text-slate-400">
                            (= Rp {(customerPoints * loyaltyPointValue).toLocaleString('id-ID')})
                          </span>
                        )}
                      </div>
                    </div>

                    {customerPoints >= minRedeemSetting ? (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <span className="text-xs font-bold text-slate-600">Tukar</span>
                        {/* Toggle Switch */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={redeemEnabled}
                          onClick={() => {
                            const next = !redeemEnabled;
                            setRedeemEnabled(next);
                            if (!next) setRedeemQty(0);
                          }}
                          className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 focus:outline-none ${
                            redeemEnabled ? 'bg-emerald-500' : 'bg-slate-200'
                          }`}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${
                            redeemEnabled ? 'left-[22px]' : 'left-0.5'
                          }`} />
                        </button>
                      </label>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">
                        {customerPoints === 0 ? 'Belum ada poin' : `Min. ${minRedeemSetting} poin`}
                      </span>
                    )}
                  </div>

                  {/* Panel Redeem — muncul saat toggle ON */}
                  {redeemEnabled && customerPoints >= minRedeemSetting && (
                    <div className="space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">

                      {/* Stepper Counter */}
                      <div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Jumlah Poin yang Ditukar
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => changeRedeemQty(-10)}
                            disabled={redeemQty <= 0}
                            className="w-10 h-10 rounded-xl bg-emerald-100 hover:bg-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-700 font-black text-lg flex items-center justify-center transition-all active:scale-95 shrink-0"
                          >
                            <Minus size={16} />
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={maxRedeemable}
                            step={1}
                            value={redeemQty}
                            onChange={e => {
                              const v = Math.min(maxRedeemable, Math.max(0, Number(e.target.value) || 0));
                              setRedeemQty(v);
                            }}
                            className="flex-1 text-center py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl text-sm font-black text-slate-900 outline-none transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => changeRedeemQty(10)}
                            disabled={redeemQty >= maxRedeemable}
                            className="w-10 h-10 rounded-xl bg-emerald-100 hover:bg-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-700 font-black text-lg flex items-center justify-center transition-all active:scale-95 shrink-0"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                        {maxRedeemSetting > 0 && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            Maks. {maxRedeemSetting} poin per transaksi
                          </p>
                        )}
                      </div>

                      {/* Quick Preset Pills */}
                      {uniquePresets.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap">
                          {uniquePresets.map(p => (
                            <button
                              key={p.val}
                              type="button"
                              onClick={() => setPreset(p.val)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all active:scale-95 ${
                                redeemQty === p.val
                                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                                  : 'bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Live Preview Banner */}
                      {redeemQty > 0 ? (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 flex items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-black text-emerald-800">
                              🎉 Hemat Rp {discountAmount.toLocaleString('id-ID')}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                              Sisa poin setelah tukar:{' '}
                              <span className="font-bold text-indigo-600">{remainingPoints} poin</span>
                            </div>
                          </div>
                          <Gift size={18} className="text-emerald-400 shrink-0" />
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 text-center italic">
                          Masukkan jumlah poin atau pilih preset di atas
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Non-Member / Guest ────────────────────────────── */}
          {!selectedCustomer && (
            <div className="space-y-3">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-start gap-2 text-slate-600 text-xs font-medium">
                  <User size={15} className="text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span>Transaksi akan diproses untuk: </span>
                    <strong className="text-slate-900">"{searchQuery.trim() || 'Pelanggan Umum'}"</strong>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Bukan member? Tidak masalah! Transaksi tetap bisa langsung dilanjutkan.
                    </p>
                  </div>
                </div>

                {!showAddMember ? (
                  <button
                    type="button"
                    onClick={() => setShowAddMember(true)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 pt-1"
                  >
                    <UserPlus size={12} />
                    <span>+ Daftarkan No. WA Member Baru (Opsional)</span>
                  </button>
                ) : (
                  <div className="pt-2 border-t border-slate-200 space-y-1.5 animate-in fade-in duration-150">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Nomor WhatsApp Pelanggan Baru (Opsional):
                    </label>
                    <div className="relative">
                      <Phone size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="tel"
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500"
                        placeholder="Contoh: 08123456789"
                        value={newPhone}
                        onChange={e => setNewPhone(e.target.value)}
                      />
                    </div>
                    <p className="text-[10px] text-indigo-600 font-medium">
                      ✨ Member baru akan otomatis tersimpan & mengumpulkan poin dari transaksi ini!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer CTA ─────────────────────────────────────── */}
        <div className="p-4 border-t border-slate-100 bg-white flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            className="flex-initial py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs transition-colors"
            onClick={onClose}
          >
            Batal
          </button>

          <button
            type="button"
            className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-95"
            onClick={handleProceed}
          >
            <span>
              {selectedCustomer
                ? `Terapkan Member (${selectedCustomer.name})${redeemEnabled && redeemQty > 0 ? ` · Hemat Rp ${discountAmount.toLocaleString('id-ID')}` : ''}`
                : `Lanjutkan Transaksi (${searchQuery.trim() || 'Tamu Umum'})`}
            </span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerModal;
