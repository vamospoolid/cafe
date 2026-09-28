import React, { useState, useEffect } from 'react';
import { User, Search, AlertTriangle, ShieldCheck, Check, Phone, DollarSign, X } from 'lucide-react';

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
}

export const RetailCustomerPicker: React.FC<RetailCustomerPickerProps> = ({
  isOpen,
  onClose,
  onSelectCustomer,
  selectedCustomer
}) => {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
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

  if (!isOpen) return null;

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User size={18} className="text-emerald-400" />
            <h3 className="font-bold text-sm">Pilih Warung / Pelanggan Langganan</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X size={18} />
          </button>
        </div>

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
            <div className="p-8 text-center text-xs text-slate-400">Tidak ada pelanggan yang cocok.</div>
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
                  {isSelected && <Check size={18} className="text-emerald-600 shrink-0" />}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center">
          <span>Tekan <strong>Esc</strong> untuk menutup</span>
          <span className="font-semibold text-emerald-700">Otomatis menyesuaikan harga khusus warung</span>
        </div>

      </div>
    </div>
  );
};

export default RetailCustomerPicker;
