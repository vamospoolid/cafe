import React, { useState, useEffect } from 'react';
import { 
  Sparkles, X, Check, Coffee, Cake, Shirt, CheckCircle2, 
  Layers, Package, AlertCircle, RefreshCw, Info 
} from 'lucide-react';
import { toast } from '../utils/alert';

interface PresetItem {
  name: string;
  category: string;
  subCategory: string;
  unit: string;
  stock: number;
  minStock: number;
  purchaseUnit: string;
  conversionRatio: number;
}

interface StarterPackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultVertical?: 'CAFE' | 'BAKERY' | 'LAUNDRY';
}

export const StarterPackModal: React.FC<StarterPackModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultVertical = 'CAFE'
}) => {
  const [activeVertical, setActiveVertical] = useState<'CAFE' | 'BAKERY' | 'LAUNDRY'>(defaultVertical);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [packData, setPackData] = useState<{
    name: string;
    tagline: string;
    icon: string;
    items: PresetItem[];
  } | null>(null);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());

  // Fetch preview preset data when activeVertical changes
  const fetchPreview = async (vertical: 'CAFE' | 'BAKERY' | 'LAUNDRY') => {
    setLoading(true);
    try {
      const token = localStorage.getItem('pos_token') || localStorage.getItem('token') || '';
      const res = await fetch(`/api/ingredients/starter-pack-preview?vertical=${vertical}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPackData(data);
        // Default: pilih semua item
        const allNames = new Set<string>((data.items || []).map((i: PresetItem) => i.name));
        setSelectedNames(allNames);
      } else {
        toast(data.error || 'Gagal memuat pratinjau template', 'error');
      }
    } catch (e: any) {
      toast('Terjadi kesalahan memuat data template', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveVertical(defaultVertical);
      fetchPreview(defaultVertical);
    }
  }, [isOpen, defaultVertical]);

  const handleVerticalChange = (v: 'CAFE' | 'BAKERY' | 'LAUNDRY') => {
    setActiveVertical(v);
    fetchPreview(v);
  };

  const handleToggleSelectAll = () => {
    if (!packData) return;
    if (selectedNames.size === packData.items.length) {
      setSelectedNames(new Set());
    } else {
      setSelectedNames(new Set(packData.items.map(i => i.name)));
    }
  };

  const handleToggleItem = (name: string) => {
    const next = new Set(selectedNames);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setSelectedNames(next);
  };

  const handleApplyStarterPack = async () => {
    if (selectedNames.size === 0) {
      toast('Pilih minimal 1 bahan baku untuk diterapkan', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('pos_token') || localStorage.getItem('token') || '';
      const res = await fetch('/api/ingredients/apply-starter-pack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          vertical: activeVertical,
          selectedItemNames: Array.from(selectedNames)
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast(data.message || `Berhasil menerapkan ${data.insertedCount} bahan baku!`, 'success');
        onSuccess();
        onClose();
      } else {
        toast(data.error || 'Gagal menerapkan starter pack', 'error');
      }
    } catch (e: any) {
      toast(e.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-start shrink-0 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10 space-y-1">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-widest">
              <Sparkles size={14} /> Template Starter Pack Bahan Baku (Stok 0)
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Setup Cepat Inventori Otomatis
            </h3>
            <p className="text-xs text-slate-300 max-w-xl">
              Pilih paket bahan baku standar industri. Seluruh item disetel dengan <strong>stok awal 0</strong> agar Anda dapat melakukan opname atau pencatatan belanja saat barang riil tiba.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer relative z-10"
          >
            <X size={18} />
          </button>
        </div>

        {/* 3 Verticals Tabs */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { id: 'CAFE', label: 'Coffee Shop & Kafe', icon: Coffee, desc: '18 Bahan Standar' },
              { id: 'BAKERY', label: 'Toko Kue & Roti', icon: Cake, desc: '19 Bahan Standar' },
              { id: 'LAUNDRY', label: 'Jasa Laundry', icon: Shirt, desc: '15 Bahan Kimia' }
            ].map(tab => {
              const Icon = tab.icon;
              const isSelected = activeVertical === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleVerticalChange(tab.id as any)}
                  className={`p-3 rounded-2xl text-left transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-white border-indigo-600 shadow-md ring-2 ring-indigo-500/20'
                      : 'bg-white/60 border-slate-200 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                      <Icon size={16} />
                    </div>
                    <span className={`text-xs font-black ${isSelected ? 'text-indigo-950' : 'text-slate-700'}`}>
                      {tab.label}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold mt-1 pl-8">
                    {tab.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Table / Checklist */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <RefreshCw size={24} className="animate-spin mx-auto text-indigo-600" />
              <p className="text-xs font-bold">Memuat daftar bahan baku standar...</p>
            </div>
          ) : packData ? (
            <>
              <div className="flex justify-between items-center text-xs font-bold text-slate-600 pb-1">
                <div className="flex items-center gap-2">
                  <span className="text-slate-900 font-black">{packData.name}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-indigo-600 font-bold">{selectedNames.size} dari {packData.items.length} dipilih</span>
                </div>

                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  {selectedNames.size === packData.items.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
                </button>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-500 uppercase font-black text-[10px] border-b border-slate-200">
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedNames.size === packData.items.length && packData.items.length > 0}
                          onChange={handleToggleSelectAll}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3">Nama Bahan Baku</th>
                      <th className="py-2.5 px-3">Kategori</th>
                      <th className="py-2.5 px-3">Satuan Pakai</th>
                      <th className="py-2.5 px-3">Kemasan Beli &amp; Konversi</th>
                      <th className="py-2.5 px-3 text-center">Stok Awal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {packData.items.map((item, idx) => {
                      const isChecked = selectedNames.has(item.name);
                      return (
                        <tr 
                          key={idx}
                          onClick={() => handleToggleItem(item.name)}
                          className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                            isChecked ? 'bg-indigo-50/20' : 'opacity-60'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleItem(item.name)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {item.name}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                              {item.subCategory}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                            {item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-600">
                            <span className="font-semibold text-slate-800">{item.purchaseUnit}</span>
                            <span className="text-[10px] text-slate-400 block">
                              1 {item.purchaseUnit.split(' ')[0]} = {item.conversionRatio.toLocaleString('id-ID')} {item.unit}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-mono font-black">
                              0 {item.unit}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Info size={14} className="text-indigo-600 shrink-0" />
            <span>Stok 0 disiapkan. Masukkan stok riil kapan saja lewat <strong>Stock Opname</strong> atau <strong>Faktur Beli</strong>.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleApplyStarterPack}
              disabled={submitting || selectedNames.size === 0}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles size={14} />
              {submitting ? 'Menyimpan...' : `Terapkan ke Stok Saya (${selectedNames.size} Bahan)`}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default StarterPackModal;
