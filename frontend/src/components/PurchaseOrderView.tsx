import React, { useState, useEffect, useContext } from 'react';
import { 
  ClipboardList, Plus, Send, PackageCheck, XCircle, Search, 
  Trash2, Sliders, Package, FilePlus, Check, X, Calendar, User, Building2, ChevronRight
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';

interface POItem { 
  id?: number; 
  productId?: number | null; 
  ingredientId?: number | null; 
  itemName: string; 
  unit: string; 
  qtyOrdered: number; 
  qtyReceived?: number; 
  unitPrice: number; 
  subtotal?: number; 
}

interface PO { 
  id: number; 
  poNumber: string; 
  status: string; 
  totalAmount: number; 
  orderedAt: string; 
  supplier: { name: string; phone?: string }; 
  user: { name: string }; 
  _count?: { items: number }; 
  items?: POItem[]; 
}

const API = '/api';

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  Draft: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  Dikirim: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  'Diterima Sebagian': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' },
  Diterima: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300' },
  Dibatalkan: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300' },
};

const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

const PurchaseOrderView: React.FC = () => {
  const posContext = useContext(POSContext);
  const token = posContext?.token;
  const settings = posContext?.settings;
  const isAdvanced = (settings as any)?.ingredientTrackingEnabled ?? false;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [pos, setPos] = useState<PO[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [receiveModal, setReceiveModal] = useState<PO | null>(null);
  const [receiveQtys, setReceiveQtys] = useState<Record<number, string>>({});

  const [newPO, setNewPO] = useState({ supplierId: '', notes: '', items: [] as POItem[] });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = filterStatus ? `?status=${filterStatus}` : '';
      const [rPos, rSup, rProd, rIng] = await Promise.all([
        fetch(`${API}/purchase-orders${params}`, { headers }),
        fetch(`${API}/suppliers`, { headers }),
        fetch(`${API}/products`, { headers }),
        fetch(`${API}/ingredients`, { headers }),
      ]);
      if (rPos.ok) setPos(await rPos.json());
      if (rSup.ok) setSuppliers(await rSup.json());
      if (rProd.ok) setProducts(await rProd.json());
      if (rIng.ok) setIngredients(await rIng.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (token) fetchData(); }, [token, filterStatus]);

  const addItem = () => setNewPO(p => ({ 
    ...p, 
    items: [...p.items, { itemName: '', unit: isAdvanced ? 'gram' : 'pcs', qtyOrdered: 1, unitPrice: 0 }] 
  }));

  const removeItem = (i: number) => setNewPO(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));

  const updateItem = (i: number, field: string, val: any) => setNewPO(p => {
    const items = [...p.items];
    (items[i] as any)[field] = val;
    if (field === 'productId' && val) {
      const prod = products.find((x: any) => x.id === Number(val));
      if (prod) { items[i].itemName = prod.name; items[i].unit = 'pcs'; items[i].unitPrice = prod.buyPrice || 0; }
    }
    if (field === 'ingredientId' && val) {
      const ing = ingredients.find((x: any) => x.id === Number(val));
      if (ing) { items[i].itemName = ing.name; items[i].unit = ing.unit; items[i].unitPrice = ing.buyPrice || 0; }
    }
    return { ...p, items };
  });

  const handleCreate = async () => {
    if (!newPO.supplierId) return toast('Pilih supplier terlebih dahulu', 'error');
    if (newPO.items.length === 0) return toast('Tambahkan minimal 1 item', 'error');
    const items = newPO.items.map(it => ({ ...it, qtyOrdered: Number(it.qtyOrdered), unitPrice: Number(it.unitPrice) }));
    const res = await fetch(`${API}/purchase-orders`, { method: 'POST', headers, body: JSON.stringify({ supplierId: newPO.supplierId, notes: newPO.notes, items }) });
    if (res.ok) { 
      toast('Purchase Order berhasil dibuat', 'success'); 
      setShowCreate(false); 
      setNewPO({ supplierId: '', notes: '', items: [] }); 
      fetchData(); 
    } else { 
      const err = await res.json(); 
      toast(err.error || 'Gagal membuat PO', 'error'); 
    }
  };

  const handleSend = async (po: PO) => {
    const c = await confirmAlert('Kirim PO', `Tandai PO ${po.poNumber} sebagai Dikirim?`);
    if (!c.isConfirmed) return;
    const res = await fetch(`${API}/purchase-orders/${po.id}/send`, { method: 'PATCH', headers });
    if (res.ok) { toast('PO berhasil dikirim', 'success'); fetchData(); }
    else { const err = await res.json(); toast(err.error, 'error'); }
  };

  const handleCancel = async (po: PO) => {
    const c = await confirmAlert('Batalkan PO', `Batalkan PO ${po.poNumber}?`);
    if (!c.isConfirmed) return;
    const res = await fetch(`${API}/purchase-orders/${po.id}/cancel`, { method: 'PATCH', headers });
    if (res.ok) { toast('PO dibatalkan', 'success'); fetchData(); }
    else { const err = await res.json(); toast(err.error, 'error'); }
  };

  const openReceive = async (po: PO) => {
    const res = await fetch(`${API}/purchase-orders/${po.id}`, { headers });
    if (res.ok) {
      const data = await res.json();
      setReceiveModal(data);
      const init: Record<number, string> = {};
      (data.items || []).forEach((it: any) => { init[it.id] = String(it.qtyOrdered - (it.qtyReceived || 0)); });
      setReceiveQtys(init);
    }
  };

  const handleReceive = async () => {
    if (!receiveModal) return;
    const receivedItems = Object.entries(receiveQtys).map(([itemId, qty]) => ({ itemId: Number(itemId), qtyReceived: Number(qty) })).filter(x => x.qtyReceived > 0);
    const res = await fetch(`${API}/purchase-orders/${receiveModal.id}/receive`, { method: 'PATCH', headers, body: JSON.stringify({ receivedItems }) });
    if (res.ok) { toast('Penerimaan barang berhasil diproses', 'success'); setReceiveModal(null); fetchData(); }
    else { const err = await res.json(); toast(err.error || 'Gagal', 'error'); }
  };

  const filtered = pos.filter(p => 
    p.poNumber.toLowerCase().includes(search.toLowerCase()) || 
    (p.supplier?.name || '').toLowerCase().includes(search.toLowerCase())
  );
  
  const totalDraft = pos.filter(p => p.status === 'Draft').length;
  const totalDikirim = pos.filter(p => p.status === 'Dikirim').length;
  const totalDiterima = pos.filter(p => p.status === 'Diterima').length;

  return (
    <div 
      className="p-3.5 sm:p-6 pb-32 sm:pb-8 flex-1 min-h-0 h-full w-full overflow-y-auto bg-slate-50 flex flex-col gap-4 sm:gap-6"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-sm">
        <div>
          <h2 className="flex items-center gap-2.5 text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-inner">
              <ClipboardList size={20} />
            </div>
            <span>Purchase Order (PO Belanja)</span>
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">Mode Sistem:</span>
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
              isAdvanced ? 'bg-purple-100 text-purple-800' : 'bg-sky-100 text-sky-800'
            }`}>
              {isAdvanced ? <Sliders size={12} /> : <Package size={12} />}
              <span>{isAdvanced ? 'Advanced (Bahan Baku)' : 'Simple (Produk Jadi)'}</span>
            </span>
          </div>
        </div>

        <button 
          onClick={() => { 
            setShowCreate(true); 
            setNewPO({ supplierId: '', notes: '', items: [] }); 
          }} 
          className="w-full sm:w-auto flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm shadow-md shadow-purple-200 transition-all active:scale-95"
        >
          <Plus size={18} />
          <span>Buat PO Baru</span>
        </button>
      </div>

      {/* KPI Stats Cards (2 cols on mobile, 4 cols on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {[
          { label: 'Total PO', val: pos.length, color: 'text-purple-600', bg: 'bg-purple-50/70 border-purple-200', active: filterStatus === '' },
          { label: 'Draft', val: totalDraft, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', active: filterStatus === 'Draft' },
          { label: 'Dikirim', val: totalDikirim, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', active: filterStatus === 'Dikirim' },
          { label: 'Diterima', val: totalDiterima, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', active: filterStatus === 'Diterima' },
        ].map(s => (
          <div 
            key={s.label} 
            onClick={() => setFilterStatus(s.label === 'Total PO' ? '' : s.label)}
            className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${s.bg} ${
              s.active ? 'ring-2 ring-purple-500 shadow-sm' : 'hover:shadow-sm opacity-90'
            }`}
          >
            <div className={`text-2xl sm:text-3xl font-black ${s.color}`}>{s.val}</div>
            <div className={`text-xs font-bold uppercase tracking-wider ${s.color} opacity-80 mt-0.5`}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
        <div className="flex-1 bg-white rounded-xl sm:rounded-2xl px-3.5 py-2.5 border border-gray-200 shadow-sm flex items-center gap-2.5">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Cari nomor PO atau nama supplier..." 
            className="border-none outline-none flex-1 text-sm bg-transparent text-gray-800 placeholder-gray-400" 
          />
        </div>

        <select 
          value={filterStatus} 
          onChange={e => setFilterStatus(e.target.value)} 
          className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl px-3.5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm outline-none cursor-pointer"
        >
          <option value="">Semua Status</option>
          {['Draft', 'Dikirim', 'Diterima Sebagian', 'Diterima', 'Dibatalkan'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
          <div className="animate-spin w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full mx-auto mb-3"></div>
          Memuat data purchase order...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
          <ClipboardList size={48} className="mx-auto text-gray-300 mb-3" />
          <div className="font-bold text-gray-600 text-base">Belum Ada Purchase Order</div>
          <p className="text-xs text-gray-400 mt-1">Buat PO baru untuk memesan bahan baku ke supplier</p>
        </div>
      ) : (
        <>
          {/* Mobile Card View (< md) */}
          <div className="md:hidden space-y-3">
            {filtered.map(po => {
              const sc = STATUS_CONFIG[po.status] || STATUS_CONFIG.Draft;
              return (
                <div key={po.id} className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2.5">
                    <div>
                      <div className="font-mono font-black text-sm text-purple-700">{po.poNumber}</div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                        <Building2 size={13} className="text-gray-400" />
                        <span className="font-bold text-gray-800">{po.supplier?.name}</span>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${sc.bg} ${sc.text} ${sc.border}`}>
                      {po.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs py-1">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Total Pembelian</span>
                      <span className="font-black text-emerald-700 text-sm">{fmt(po.totalAmount)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Tanggal PO</span>
                      <span className="font-medium text-gray-600">{new Date(po.orderedAt).toLocaleDateString('id-ID')}</span>
                    </div>
                  </div>

                  {/* Actions on Mobile */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
                    {po.status === 'Draft' && (
                      <button 
                        onClick={() => handleSend(po)} 
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-50 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 active:scale-95 transition-all"
                      >
                        <Send size={13} />
                        <span>Kirim PO</span>
                      </button>
                    )}
                    {['Dikirim', 'Diterima Sebagian'].includes(po.status) && (
                      <button 
                        onClick={() => openReceive(po)} 
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 active:scale-95 transition-all"
                      >
                        <PackageCheck size={14} />
                        <span>Terima Barang</span>
                      </button>
                    )}
                    {['Draft', 'Dikirim'].includes(po.status) && (
                      <button 
                        onClick={() => handleCancel(po)} 
                        title="Batalkan PO"
                        className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-200 active:scale-95 transition-all"
                      >
                        <XCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-xs font-extrabold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">NO. PO</th>
                  <th className="py-3.5 px-4">SUPPLIER</th>
                  <th className="py-3.5 px-4">TOTAL</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4">TANGGAL PO</th>
                  <th className="py-3.5 px-4 text-center">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filtered.map((po, idx) => {
                  const sc = STATUS_CONFIG[po.status] || STATUS_CONFIG.Draft;
                  return (
                    <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-purple-700 text-xs">{po.poNumber}</td>
                      <td className="py-3.5 px-4 font-semibold text-gray-900">{po.supplier?.name}</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-700">{fmt(po.totalAmount)}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border inline-block ${sc.bg} ${sc.text} ${sc.border}`}>
                          {po.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-500">{new Date(po.orderedAt).toLocaleDateString('id-ID')}</td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {po.status === 'Draft' && (
                            <button 
                              onClick={() => handleSend(po)} 
                              className="flex items-center gap-1 py-1.5 px-2.5 bg-blue-50 text-blue-700 font-bold text-xs rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                            >
                              <Send size={12} /> Kirim
                            </button>
                          )}
                          {['Dikirim', 'Diterima Sebagian'].includes(po.status) && (
                            <button 
                              onClick={() => openReceive(po)} 
                              className="flex items-center gap-1 py-1.5 px-2.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
                            >
                              <PackageCheck size={13} /> Terima
                            </button>
                          )}
                          {['Draft', 'Dikirim'].includes(po.status) && (
                            <button 
                              onClick={() => handleCancel(po)} 
                              title="Batalkan PO"
                              className="p-1.5 bg-rose-50 text-rose-600 rounded-lg border border-rose-200 hover:bg-rose-100 transition-colors"
                            >
                              <XCircle size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Create PO Modal (Responsive full height sheet on mobile, clean modal dialog on desktop) */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 overflow-y-auto">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-2xl sm:rounded-3xl shadow-2xl flex flex-col sm:overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-50 to-purple-50/50 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-200">
                  <FilePlus size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base sm:text-lg">Buat Purchase Order Baru</h3>
                  <p className="text-xs text-gray-500">Pemesanan barang ke supplier / vendor</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreate(false)} 
                className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Body with Smooth Mobile Scroll */}
            <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto max-h-[calc(100vh-140px)] sm:max-h-[70vh]">
              {/* Supplier & Catatan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Supplier / Vendor <span className="text-rose-500">*</span>
                  </label>
                  <select 
                    value={newPO.supplierId} 
                    onChange={e => setNewPO(p => ({ ...p, supplierId: e.target.value }))} 
                    className="w-full bg-slate-50 border border-gray-300 text-gray-900 text-sm font-semibold rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer"
                  >
                    <option value="">— Pilih Supplier —</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} {s.phone ? `(${s.phone})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Catatan PO</label>
                  <input 
                    value={newPO.notes} 
                    onChange={e => setNewPO(p => ({ ...p, notes: e.target.value }))} 
                    placeholder="Contoh: Kirim sebelum jam 10 pagi..." 
                    className="w-full bg-slate-50 border border-gray-300 text-gray-900 text-sm rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Items Repeater */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Daftar Item PO ({newPO.items.length})
                  </label>
                  <button 
                    type="button"
                    onClick={addItem} 
                    className="flex items-center gap-1.5 py-1.5 px-3 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-xl font-bold text-xs transition-colors"
                  >
                    <Plus size={14} /> Tambah Item
                  </button>
                </div>

                {newPO.items.length === 0 ? (
                  <div className="p-6 border-2 border-dashed border-gray-200 rounded-2xl text-center text-gray-400">
                    <Package size={28} className="mx-auto text-gray-300 mb-1.5" />
                    <p className="text-xs font-medium">Belum ada item ditambahkan. Klik "Tambah Item" di atas.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {newPO.items.map((it, i) => (
                      <div key={i} className="p-3 bg-slate-50 border border-gray-200 rounded-xl space-y-2">
                        {/* Selector */}
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center shrink-0">
                            {i + 1}
                          </span>
                          <div className="flex-1">
                            {isAdvanced ? (
                              <select 
                                value={it.ingredientId || ''} 
                                onChange={e => updateItem(i, 'ingredientId', e.target.value)} 
                                className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-900 focus:outline-none"
                              >
                                <option value="">— Pilih Bahan Baku —</option>
                                {ingredients.map((x: any) => <option key={x.id} value={x.id}>{x.name} ({x.unit})</option>)}
                              </select>
                            ) : (
                              <select 
                                value={it.productId || ''} 
                                onChange={e => updateItem(i, 'productId', e.target.value)} 
                                className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-900 focus:outline-none"
                              >
                                <option value="">— Pilih Produk Jadi —</option>
                                {products.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
                              </select>
                            )}
                          </div>
                          <button 
                            type="button"
                            onClick={() => removeItem(i)} 
                            className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors shrink-0"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        {/* Unit, Qty, Unit Price */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">Satuan</label>
                            <input 
                              type="text" 
                              value={it.unit} 
                              onChange={e => updateItem(i, 'unit', e.target.value)} 
                              placeholder="Satuan" 
                              className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs text-center font-medium text-gray-800"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">Qty Order</label>
                            <input 
                              type="number" 
                              value={it.qtyOrdered} 
                              onChange={e => updateItem(i, 'qtyOrdered', e.target.value)} 
                              placeholder="Qty" 
                              className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs text-center font-bold text-gray-900"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">Harga Beli</label>
                            <input 
                              type="number" 
                              value={it.unitPrice} 
                              onChange={e => updateItem(i, 'unitPrice', e.target.value)} 
                              placeholder="Harga" 
                              className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs text-right font-bold text-gray-900"
                            />
                          </div>
                        </div>

                        <div className="text-right text-xs font-bold text-purple-700 pt-0.5">
                          Subtotal: {fmt(Number(it.qtyOrdered || 0) * Number(it.unitPrice || 0))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Grand Total */}
                {newPO.items.length > 0 && (
                  <div className="p-3.5 bg-purple-50/80 border border-purple-200 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-900">Total Estimasi PO:</span>
                    <span className="text-base font-black text-purple-900">
                      {fmt(newPO.items.reduce((s, it) => s + (Number(it.qtyOrdered || 0) * Number(it.unitPrice || 0)), 0))}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3 shrink-0">
              <button 
                type="button" 
                onClick={() => setShowCreate(false)} 
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-100 transition-colors"
              >
                Batal
              </button>
              <button 
                type="button" 
                onClick={handleCreate} 
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md shadow-purple-200 transition-all active:scale-95"
              >
                Simpan PO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal (Responsive full height sheet on mobile, clean modal dialog on desktop) */}
      {receiveModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 overflow-y-auto">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-lg sm:rounded-3xl shadow-2xl flex flex-col sm:overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-50 to-emerald-50/50 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200">
                  <PackageCheck size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base sm:text-lg">Konfirmasi Penerimaan Barang</h3>
                  <p className="text-xs text-gray-500">{receiveModal.poNumber} — {receiveModal.supplier?.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setReceiveModal(null)} 
                className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-140px)] sm:max-h-[65vh]">
              {(receiveModal.items || []).map((it: any) => {
                const remaining = it.qtyOrdered - (it.qtyReceived || 0);
                return (
                  <div key={it.id} className="bg-slate-50 rounded-xl p-3.5 border border-gray-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-gray-900">{it.itemName}</span>
                      <span className="text-[11px] text-gray-500 font-medium">
                        Order: {it.qtyOrdered} {it.unit}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 flex justify-between">
                      <span>Sudah diterima: <strong className="text-emerald-700">{it.qtyReceived || 0}</strong> {it.unit}</span>
                      <span>Sisa: <strong className="text-amber-700">{remaining}</strong> {it.unit}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <label className="text-xs font-bold text-gray-700 shrink-0">Terima Sekarang ({it.unit}):</label>
                      <input 
                        type="number" 
                        value={receiveQtys[it.id] || ''} 
                        onChange={e => setReceiveQtys(p => ({ ...p, [it.id]: e.target.value }))}
                        max={remaining} 
                        min={0} 
                        placeholder={`Maks ${remaining}`}
                        className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3 shrink-0">
              <button 
                type="button" 
                onClick={() => setReceiveModal(null)} 
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-100 transition-colors"
              >
                Batal
              </button>
              <button 
                type="button" 
                onClick={handleReceive} 
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-200 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Check size={16} />
                <span>Simpan Penerimaan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrderView;
