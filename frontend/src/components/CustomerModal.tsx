import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  X, Search, UserCheck, Star, Gift, Tag, User, Phone, 
  Crown, Sparkles, Check, ArrowRight, UserPlus, AlertCircle
} from 'lucide-react';
import { POSContext } from '../context/POSContext';

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
  const [redeemPoints, setRedeemPoints] = useState(false);
  
  const posContext = useContext(POSContext);
  const debounceTimer = useRef<any>(null);

  const settings = posContext?.settings;
  const loyaltyEnabled = settings ? settings.loyaltyEnabled !== false : true;
  const loyaltyPointValue = settings ? (settings.loyaltyPointValue || 100) : 100;

  // Real-time search by Name or Phone
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
        if (Array.isArray(data)) {
          setSearchResults(data);
        } else {
          setSearchResults([]);
        }
      }
    } catch (err) {
      console.error('Failed to search customers:', err);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedCustomer(null);
      setNewPhone('');
      setShowAddMember(false);
      setRedeemPoints(false);
      return;
    }
  }, [isOpen]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setSelectedCustomer(null);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      searchCustomers(val);
    }, 250);
  };

  const handleSelectMember = (cust: any) => {
    setSelectedCustomer(cust);
    setSearchQuery(cust.name);
    setSearchResults([]);
    setShowAddMember(false);
  };

  const handleProceed = () => {
    const guestName = searchQuery.trim() || 'Pelanggan Umum';

    if (selectedCustomer) {
      const data: any = {
        id: selectedCustomer.id,
        name: selectedCustomer.name,
        phone: selectedCustomer.phone || '',
        points: selectedCustomer.points || 0,
        tier: selectedCustomer.tier || 'Bronze'
      };

      if (loyaltyEnabled && redeemPoints && selectedCustomer.points > 0) {
        data.pointsUsed = selectedCustomer.points;
        data.discountAmount = selectedCustomer.points * loyaltyPointValue;
      }

      onSelect(data);
    } else {
      // Guest / Non-member or New Member
      const data: any = {
        name: guestName,
        phone: newPhone.trim() || undefined
      };
      onSelect(data);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
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

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Main Search Input */}
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

          {/* Member Search Results (Live Auto-suggest Dropdown) */}
          {loading ? (
            <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <div className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
              <span>Mencari data member...</span>
            </div>
          ) : searchResults.length > 0 && !selectedCustomer ? (
            <div className="space-y-1.5 border border-indigo-100 bg-indigo-50/40 p-2 rounded-2xl">
              <div className="text-[10px] font-black text-indigo-800 uppercase px-2 py-0.5 tracking-wider">
                Member Ditemukan ({searchResults.length})
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-indigo-100/60 rounded-xl bg-white border border-indigo-100/80 shadow-sm">
                {searchResults.map((cust) => {
                  const isGold = cust.tier === 'Gold';
                  const isSilver = cust.tier === 'Silver';
                  return (
                    <div 
                      key={cust.id}
                      onClick={() => handleSelectMember(cust)}
                      className="p-2.5 hover:bg-indigo-50/70 transition-colors cursor-pointer flex items-center justify-between gap-2 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                          isGold ? 'bg-amber-100 text-amber-800' : isSilver ? 'bg-slate-200 text-slate-800' : 'bg-orange-100 text-orange-800'
                        }`}>
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
                        <span className="text-[9px] font-bold text-emerald-600 block">
                          Pilih Member →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Selected Member Active Box */}
          {selectedCustomer && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50/50 border border-indigo-200 p-4 rounded-2xl space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
                    {selectedCustomer.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-sm text-slate-900">{selectedCustomer.name}</span>
                      <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase">
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
                  className="text-xs text-slate-400 hover:text-rose-600 font-bold underline"
                >
                  Ganti
                </button>
              </div>

              {/* Point Info & Redemption Option */}
              {loyaltyEnabled && (
                <div className="bg-white p-3 rounded-xl border border-indigo-100 flex items-center justify-between gap-3 shadow-xs">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saldo Poin Member</div>
                    <div className="text-base font-black text-indigo-700 flex items-center gap-1">
                      <Star size={14} className="text-amber-500 fill-amber-500" />
                      <span>{selectedCustomer.points || 0}</span>
                      <span className="text-xs font-normal text-slate-400">Poin</span>
                    </div>
                  </div>

                  {selectedCustomer.points > 0 ? (
                    <label className="flex items-center gap-2 cursor-pointer bg-emerald-50 hover:bg-emerald-100/80 px-3 py-2 rounded-xl border border-emerald-200 transition-all">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                        checked={redeemPoints}
                        onChange={e => setRedeemPoints(e.target.checked)}
                      />
                      <div className="text-right">
                        <span className="text-xs font-black text-emerald-800 block leading-tight">Tukar Poin</span>
                        <span className="text-[10px] text-emerald-700 font-bold">
                          -Rp {((selectedCustomer.points || 0) * loyaltyPointValue).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </label>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Belum ada poin untuk ditukar</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Non-Member / Guest Notice & Optional Registration */}
          {!selectedCustomer && (
            <div className="space-y-3">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-start gap-2 text-slate-600 text-xs font-medium">
                  <User size={15} className="text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span>Transaksi akan diproses untuk: </span>
                    <strong className="text-slate-900">"{searchQuery.trim() || 'Pelanggan Umum'}"</strong>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Bukan member? Tidak masalah! Transaksi tetap bisa langsung dilanjutkan tanpa hambatan.
                    </p>
                  </div>
                </div>

                {/* Optional Add Member Toggle */}
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
                      ✨ Member baru akan otomatis tersimpan & mengumpulkan poin belanja dari transaksi ini!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
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
                ? `Terapkan Member (${selectedCustomer.name})` 
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
