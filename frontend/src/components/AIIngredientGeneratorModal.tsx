import React, { useState, useContext } from 'react';
import { 
  X, Sparkles, Coffee, Utensils, CupSoda, Cake, Flame, Check, 
  Layers, Package, Building2, AlertCircle, ArrowRight, RefreshCw,
  Search, CheckSquare, Square
} from 'lucide-react';
import { POSContext } from '../context/POSContext';

interface AIIngredientGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface GeneratedSupplier {
  name: string;
  contact?: string;
  phone?: string;
  address?: string;
}

interface GeneratedIngredient {
  name: string;
  category: 'FOOD' | 'DRINK' | 'PACKAGING';
  unit: string;
  minStock: number;
  supplierName?: string;
  subCategory?: string;
  selected?: boolean;
}

const BUSINESS_MODELS = [
  {
    id: 'coffee_shop',
    title: 'Coffee Shop & Cafe',
    desc: 'Kopi, Susu, Sirup Butterscotch, Pandan, Gula Aren, Cup 16oz',
    icon: Coffee,
    color: 'from-amber-600 to-amber-800',
    border: 'border-amber-200 hover:border-amber-400 bg-amber-50/50'
  },
  {
    id: 'resto',
    title: 'Restoran & Rumah Makan',
    desc: 'Ayam, Daging Sapi, Telur, Mie, Bumbu Dapur, Kecap, Box Bento',
    icon: Utensils,
    color: 'from-rose-600 to-rose-800',
    border: 'border-rose-200 hover:border-rose-400 bg-rose-50/50'
  },
  {
    id: 'boba',
    title: 'Boba & Minuman Kekinian',
    desc: 'Tapioca Boba, Brown Sugar, Bubuk Taro, Creamer, Cup Sealer',
    icon: CupSoda,
    color: 'from-purple-600 to-indigo-700',
    border: 'border-purple-200 hover:border-purple-400 bg-purple-50/50'
  },
  {
    id: 'bakery',
    title: 'Bakery & Pastry',
    desc: 'Tepung Terigu, Butter Anchor, Ragi, Telur, Cokelat DCC, Dus Box',
    icon: Cake,
    color: 'from-yellow-600 to-amber-700',
    border: 'border-yellow-200 hover:border-yellow-400 bg-yellow-50/50'
  },
  {
    id: 'warmindo',
    title: 'Warmindo & Street Food',
    desc: 'Indomie, Telur, Kornet, Keju, Sayur Sawi, Plastik Kuah',
    icon: Flame,
    color: 'from-orange-600 to-red-700',
    border: 'border-orange-200 hover:border-orange-400 bg-orange-50/50'
  }
];

const AIIngredientGeneratorModal: React.FC<AIIngredientGeneratorModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const posContext = useContext(POSContext);

  const [step, setStep] = useState<'SELECT' | 'REVIEW'>('SELECT');
  const [selectedModel, setSelectedModel] = useState<string>('coffee_shop');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [suppliers, setSuppliers] = useState<GeneratedSupplier[]>([]);
  const [ingredients, setIngredients] = useState<GeneratedIngredient[]>([]);
  const [filterCat, setFilterCat] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/ingredients/ai-generate-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          businessModel: selectedModel,
          customPrompt: customPrompt.trim() || undefined
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal generate bahan baku');
      }

      const data = await res.json();
      const ingsWithSelection = (data.ingredients || []).map((item: any) => ({
        ...item,
        selected: true
      }));

      setSuppliers(data.suppliers || []);
      setIngredients(ingsWithSelection);
      setStep('REVIEW');
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat memproses AI generator.');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleItemSelection = (index: number) => {
    setIngredients(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], selected: !copy[index].selected };
      return copy;
    });
  };

  const toggleSelectAll = (select: boolean) => {
    setIngredients(prev => prev.map(item => ({ ...item, selected: select })));
  };

  const handleSaveToCatalog = async () => {
    const selectedIngredients = ingredients.filter(i => i.selected);
    if (selectedIngredients.length === 0) {
      alert('Pilih minimal 1 bahan baku untuk disimpan.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/ingredients/bulk-provision-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          suppliers,
          ingredients: selectedIngredients
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan bahan baku');
      }

      const result = await res.json();
      alert(`Sukses! ${result.addedCount} bahan baku dan ${result.totalSuppliers} supplier berhasil ditambahkan ke katalog Anda.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan ke katalog.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredIngredients = ingredients.filter(item => {
    const matchCat = filterCat === 'ALL' || item.category === filterCat;
    const matchSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.supplierName && item.supplierName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  const selectedCount = ingredients.filter(i => i.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-700 text-white shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner">
              <Sparkles size={22} className="text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">AI Starter Bahan Baku & Supplier</h2>
                <span className="bg-amber-400 text-purple-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Inteligensi F&B
                </span>
              </div>
              <p className="text-xs text-purple-100 font-medium mt-0.5">
                Rancang otomatis katalog bahan baku dapur & supplier mitra dengan stok awal bersih (0)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating || isSaving}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {step === 'SELECT' ? (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-black text-gray-800 uppercase tracking-wider mb-2">
                  1. Pilih Model Bisnis F&B Anda <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {BUSINESS_MODELS.map(model => {
                    const Icon = model.icon;
                    const isSelected = selectedModel === model.id;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => setSelectedModel(model.id)}
                        className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                          isSelected
                            ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/70 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/70 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${model.color} text-white flex items-center justify-center shadow-sm`}>
                            <Icon size={16} />
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                              <Check size={12} />
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900 leading-tight">{model.title}</h4>
                          <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">{model.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Prompt / Catatan Tambahan */}
              <div>
                <label className="block text-xs font-black text-gray-800 uppercase tracking-wider mb-1.5">
                  2. Permintaan Khusus / Menu Andalan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Contoh: Kami fokus di menu kopi susu kekinian dengan varian rasa pandan, caramel butterscotch, dan pastry croissant..."
                  className="w-full bg-slate-50 border border-gray-300 text-gray-800 text-xs sm:text-sm rounded-2xl p-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-gray-400"
                ></textarea>
                <p className="text-[11px] text-gray-400 mt-1 italic">
                  💡 AI akan memformulasikan jenis bahan baku, satuan (gram/ml/pcs), dan supplier yang paling relevan.
                </p>
              </div>

              {/* Security & Multi-tenant note */}
              <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-2xl flex items-start gap-2.5">
                <AlertCircle size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-900 leading-relaxed">
                  <span className="font-bold">Keamanan & Isolasi Tenant:</span> Semua bahan baku dan supplier akan terbuat secara eksklusif hanya untuk outlet/tenant Anda. Stok awal di-set ke <strong>0</strong> agar siap diisi saat stok opname.
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Banner */}
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-base shadow-sm">
                    {ingredients.length}
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-emerald-950">
                      Rancangan Bahan Baku Siap Ditambahkan
                    </h3>
                    <p className="text-xs text-emerald-700">
                      {selectedCount} dari {ingredients.length} bahan baku terpilih • Terhubung ke {suppliers.length} supplier mitra
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(true)}
                    className="px-2.5 py-1 text-xs font-bold bg-white text-emerald-800 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm"
                  >
                    Pilih Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(false)}
                    className="px-2.5 py-1 text-xs font-bold bg-white text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors shadow-sm"
                  >
                    Batal Semua
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-gray-200 text-xs">
                  {[
                    { id: 'ALL', label: 'Semua' },
                    { id: 'DRINK', label: '🥤 Minuman' },
                    { id: 'FOOD', label: '🍲 Makanan' },
                    { id: 'PACKAGING', label: '📦 Kemasan' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilterCat(tab.id)}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                        filterCat === tab.id
                          ? 'bg-white text-indigo-700 shadow-sm border border-indigo-200'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 sm:max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari bahan atau supplier..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Checklist Table */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm max-h-[360px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 text-gray-700 uppercase font-black tracking-wider sticky top-0 z-10 border-b border-gray-200">
                    <tr>
                      <th className="p-3 w-10 text-center">Pilih</th>
                      <th className="p-3">Nama Bahan Baku</th>
                      <th className="p-3">Kategori</th>
                      <th className="p-3">Satuan</th>
                      <th className="p-3">Min. Stok</th>
                      <th className="p-3">Rekomendasi Supplier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredIngredients.map((item) => {
                      const realIndex = ingredients.findIndex(i => i.name === item.name);
                      return (
                        <tr 
                          key={item.name} 
                          onClick={() => toggleItemSelection(realIndex)}
                          className={`cursor-pointer transition-colors ${
                            item.selected ? 'hover:bg-indigo-50/40 bg-white' : 'bg-gray-50/80 text-gray-400'
                          }`}
                        >
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => toggleItemSelection(realIndex)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-bold text-gray-900">
                            {item.name}
                            {item.subCategory && (
                              <span className="block text-[10px] text-gray-400 font-normal">
                                {item.subCategory}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              item.category === 'DRINK' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' :
                              item.category === 'FOOD' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}>
                              {item.category}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-gray-700">
                            {item.unit}
                          </td>
                          <td className="p-3 font-semibold text-gray-700">
                            {item.minStock} {item.unit}
                          </td>
                          <td className="p-3">
                            {item.supplierName ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                                <Building2 size={12} className="text-indigo-500" />
                                {item.supplierName}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Suppliers Preview Bar */}
              <div className="p-3 bg-slate-50 border border-gray-200 rounded-2xl space-y-1.5">
                <span className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5 uppercase tracking-wider">
                  <Building2 size={13} className="text-indigo-600" />
                  Supplier Mitra yang akan didaftarkan ({suppliers.length}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {suppliers.map(sup => (
                    <span key={sup.name} className="px-2.5 py-1 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 shadow-sm flex items-center gap-1">
                      🏢 {sup.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-gray-50 border-t border-gray-200 shrink-0">
          {step === 'SELECT' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isGenerating}
                className="px-4 py-2.5 text-xs sm:text-sm font-bold text-gray-600 hover:text-gray-800 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-purple-200 flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>AI Merumuskan Bahan Baku...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} className="text-amber-300" />
                    <span>Generate Katalog Bahan Baku</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('SELECT')}
                disabled={isSaving}
                className="px-4 py-2.5 text-xs sm:text-sm font-bold text-gray-600 hover:text-gray-800 transition-colors"
              >
                ← Ganti Model Bisnis
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs sm:text-sm hover:bg-gray-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveToCatalog}
                  disabled={isSaving || selectedCount === 0}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-200 flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Menyimpan ke Database...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Tambahkan {selectedCount} Bahan ke Katalog</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIIngredientGeneratorModal;
