import React, { useState, useEffect } from 'react';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  X,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  ShoppingBag,
  Package,
  FolderTree,
  Armchair,
  Users,
  Truck,
  ShieldAlert,
  Lock
} from 'lucide-react';

const API_URL = '/api';
const getAuthToken = () => localStorage.getItem('pos_token') || localStorage.getItem('token') || '';


interface BinnedItem {
  id: number;
  type: 'PRODUCT' | 'INGREDIENT' | 'CATEGORY' | 'TABLE' | 'CUSTOMER' | 'SUPPLIER';
  typeName: string;
  name: string;
  detail: string;
  deletedAt: string;
  daysRemaining: number;
}

interface RecycleBinCounts {
  products: number;
  ingredients: number;
  categories: number;
  tables: number;
  customers: number;
  suppliers: number;
}

interface RecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemRestored?: () => void;
}

export const RecycleBinModal: React.FC<RecycleBinModalProps> = ({
  isOpen,
  onClose,
  onItemRestored
}) => {
  const [items, setItems] = useState<BinnedItem[]>([]);
  const [counts, setCounts] = useState<RecycleBinCounts>({
    products: 0,
    ingredients: 0,
    categories: 0,
    tables: 0,
    customers: 0,
    suppliers: 0
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Empty Recycle Bin State
  const [isEmptyModalOpen, setIsEmptyModalOpen] = useState(false);
  const [emptyPassword, setEmptyPassword] = useState('');
  const [emptyLoading, setEmptyLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchBinnedItems();
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  const fetchBinnedItems = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/recycle-bin`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat isi keranjang sampah.');
      if (data.success) {
        setItems(data.items || []);
        setCounts(data.counts || {
          products: 0,
          ingredients: 0,
          categories: 0,
          tables: 0,
          customers: 0,
          suppliers: 0
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch recycle bin items:', err);
      setErrorMsg(err.message || 'Gagal memuat isi keranjang sampah.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (item: BinnedItem) => {
    setActionLoadingId(`restore-${item.type}-${item.id}`);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/recycle-bin/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: item.type, id: item.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memulihkan item.');
      if (data.success) {
        setSuccessMsg(data.message);
        fetchBinnedItems();
        if (onItemRestored) onItemRestored();
      }
    } catch (err: any) {
      console.error('Restore error:', err);
      setErrorMsg(err.message || 'Gagal memulihkan item.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePurge = async (item: BinnedItem) => {
    if (!window.confirm(`Hapus permanen "${item.name}"? Data tidak akan bisa dikembalikan lagi!`)) {
      return;
    }
    setActionLoadingId(`purge-${item.type}-${item.id}`);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/recycle-bin/purge/${item.type}/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus item secara permanen.');
      if (data.success) {
        setSuccessMsg(data.message);
        fetchBinnedItems();
      }
    } catch (err: any) {
      console.error('Purge error:', err);
      setErrorMsg(err.message || 'Gagal menghapus item secara permanen.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleEmptyRecycleBin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emptyPassword) {
      setErrorMsg('Kata sandi Owner wajib diisi.');
      return;
    }
    setEmptyLoading(true);
    setErrorMsg(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/recycle-bin/empty`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: emptyPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengosongkan keranjang sampah.');
      if (data.success) {
        setSuccessMsg(data.message);
        setIsEmptyModalOpen(false);
        setEmptyPassword('');
        fetchBinnedItems();
      }
    } catch (err: any) {
      console.error('Empty recycle bin error:', err);
      setErrorMsg(err.message || 'Gagal mengosongkan keranjang sampah.');
    } finally {
      setEmptyLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredItems = items.filter(item => {
    const matchesTab = activeTab === 'ALL' || item.type === activeTab;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.detail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.typeName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PRODUCT':
        return <ShoppingBag className="w-4 h-4 text-emerald-400" />;
      case 'INGREDIENT':
        return <Package className="w-4 h-4 text-amber-400" />;
      case 'CATEGORY':
        return <FolderTree className="w-4 h-4 text-blue-400" />;
      case 'TABLE':
        return <Armchair className="w-4 h-4 text-purple-400" />;
      case 'CUSTOMER':
        return <Users className="w-4 h-4 text-pink-400" />;
      case 'SUPPLIER':
        return <Truck className="w-4 h-4 text-indigo-400" />;
      default:
        return <Layers className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'PRODUCT':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'INGREDIENT':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'CATEGORY':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'TABLE':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'CUSTOMER':
        return 'bg-pink-500/10 text-pink-400 border-pink-500/20';
      case 'SUPPLIER':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 shadow-inner">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-wide">
                  Keranjang Sampah (Recycle Bin)
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                  Retensi 30 Hari
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Item yang dihapus dapat dipulihkan sewaktu-waktu sebelum dibersihkan permanen secara otomatis.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action & Status Alerts */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400 text-sm animate-fade-in">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-400 text-sm animate-fade-in">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Search & Statistics Bar */}
        <div className="px-6 pt-4 pb-2 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari item di keranjang sampah..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              onClick={() => fetchBinnedItems()}
              disabled={loading}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Segarkan
            </button>
            {items.length > 0 && (
              <button
                onClick={() => setIsEmptyModalOpen(true)}
                className="px-3.5 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Kosongkan Semua ({items.length})
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-6 py-2 border-b border-slate-800 flex items-center gap-2 overflow-x-auto custom-scrollbar">
          {[
            { id: 'ALL', label: 'Semua', count: items.length, icon: Layers },
            { id: 'PRODUCT', label: 'Menu Produk', count: counts.products, icon: ShoppingBag },
            { id: 'INGREDIENT', label: 'Bahan Baku', count: counts.ingredients, icon: Package },
            { id: 'CATEGORY', label: 'Kategori', count: counts.categories, icon: FolderTree },
            { id: 'TABLE', label: 'Meja', count: counts.tables, icon: Armchair },
            { id: 'CUSTOMER', label: 'Pelanggan', count: counts.customers, icon: Users },
            { id: 'SUPPLIER', label: 'Supplier', count: counts.suppliers, icon: Truck }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-amber-500/30 text-amber-200' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Item List Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <RotateCcw className="w-8 h-8 animate-spin text-amber-400 mb-3" />
              <p className="text-sm">Memuat item keranjang sampah...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 border border-dashed border-slate-800 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center mb-3">
                <Trash2 className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-base font-semibold text-slate-300">Keranjang Sampah Bersih</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Tidak ada data {activeTab !== 'ALL' ? 'pada kategori ini' : ''} yang sedang dihapus sementara.
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isRestoring = actionLoadingId === `restore-${item.type}-${item.id}`;
              const isPurging = actionLoadingId === `purge-${item.type}-${item.id}`;
              const isUrgent = item.daysRemaining <= 7;

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className="group bg-slate-800/50 hover:bg-slate-800/90 border border-slate-700/60 hover:border-slate-600 rounded-xl p-4 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg border flex-shrink-0 ${getTypeBadgeClass(item.type)}`}>
                      {getTypeIcon(item.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-white truncate">{item.name}</h4>
                        <span className={`px-2 py-0.5 text-[10px] font-semibold border rounded-md ${getTypeBadgeClass(item.type)}`}>
                          {item.typeName}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 truncate">{item.detail}</p>
                      
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          Dihapus: {new Date(item.deletedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold text-[10px] border flex items-center gap-1 ${
                            isUrgent
                              ? 'bg-red-500/10 text-red-400 border-red-500/30'
                              : 'bg-slate-700 text-slate-300 border-slate-600'
                          }`}
                        >
                          <Clock className="w-2.5 h-2.5" />
                          {isUrgent ? `⚠️ Sisa ${item.daysRemaining} hari lagi` : `Sisa ${item.daysRemaining} hari`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-slate-700/60">
                    <button
                      onClick={() => handleRestore(item)}
                      disabled={isRestoring || isPurging}
                      className="px-3.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                      {isRestoring ? 'Memulihkan...' : 'Pulihkan'}
                    </button>
                    <button
                      onClick={() => handlePurge(item)}
                      disabled={isRestoring || isPurging}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-red-600/20 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/30 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {isPurging ? 'Menghapus...' : 'Hapus Fisik'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <span>Menampilkan {filteredItems.length} dari total {items.length} item di sampah</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg transition-colors border border-slate-700"
          >
            Tutup
          </button>
        </div>

      </div>

      {/* Password Prompt Modal for Emptying Recycle Bin */}
      {isEmptyModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-red-500/40 rounded-2xl shadow-2xl p-6 text-white space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Kosongkan Semua Sampah</h3>
                <p className="text-xs text-red-300">Tindakan ini permanen & tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Seluruh <strong className="text-white">{items.length} item</strong> di keranjang sampah akan dihapus secara fisik dan permanen dari database. Masukkan kata sandi akun Owner untuk melanjutkan.
            </p>

            <form onSubmit={handleEmptyRecycleBin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Kata Sandi Akun Owner
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={emptyPassword}
                    onChange={(e) => setEmptyPassword(e.target.value)}
                    placeholder="Masukkan kata sandi..."
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEmptyModalOpen(false);
                    setEmptyPassword('');
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={emptyLoading || !emptyPassword}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {emptyLoading ? 'Memproses...' : 'Hapus Selamanya'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default RecycleBinModal;
