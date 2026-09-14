import React, { useState, useEffect, useContext } from 'react';
import { 
  Boxes, 
  Plus, 
  ArrowRightLeft, 
  Wallet, 
  ClipboardCheck, 
  Truck, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Printer, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Coins, 
  Calendar,
  X,
  Clock,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Package,
  Layers,
  Sparkles
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';

export default function WarehouseView() {
  const posContext = useContext(POSContext);
  const [activeTab, setActiveTab] = useState<'stock' | 'inbound' | 'transfers' | 'finance'>('stock');

  // Loading states
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [stockList, setStockList] = useState<any[]>([]);
  const [inbounds, setInbounds] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [financeData, setFinanceData] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  // Search & Filters
  const [searchStock, setSearchStock] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Modals
  const [showInboundModal, setShowInboundModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showReimburseModal, setShowReimburseModal] = useState(false);
  const [showOpnameModal, setShowOpnameModal] = useState(false);
  const [selectedIngredientForOpname, setSelectedIngredientForOpname] = useState<any>(null);
  const [actualOpnameStock, setActualOpnameStock] = useState<number>(0);

  // Inbound Form State
  const [inboundForm, setInboundForm] = useState({
    supplierId: '',
    supplierName: '',
    paymentSource: 'DANA_PRIBADI_OWNER',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
    items: [
      { ingredientId: '', itemName: '', purchaseUnit: 'Karton', purchaseQty: 1, conversionRatio: 1, purchasePrice: 0 }
    ]
  });

  // Transfer Form State
  const [transferForm, setTransferForm] = useState({
    notes: '',
    items: [
      { ingredientId: '', requestedUnit: '', requestedQty: 1 }
    ]
  });

  // Reimburse Form State
  const [reimburseForm, setReimburseForm] = useState({
    amount: 0,
    paymentMethod: 'Transfer Bank',
    deductFromMukiCash: false,
    notes: ''
  });

  const formatCurrency = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  // Fetch all warehouse data
  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${posContext?.token}` };
      
      const [dashRes, stockRes, inbRes, transRes, finRes, supRes] = await Promise.all([
        fetch('/api/warehouse/dashboard', { headers }),
        fetch('/api/warehouse/stock', { headers }),
        fetch('/api/warehouse/inbounds', { headers }),
        fetch('/api/warehouse/transfers', { headers }),
        fetch('/api/warehouse/owner-finance', { headers }),
        fetch('/api/suppliers', { headers })
      ]);

      if (dashRes.ok) setDashboardData(await dashRes.json());
      if (stockRes.ok) setStockList(await stockRes.json());
      if (inbRes.ok) setInbounds(await inbRes.json());
      if (transRes.ok) setTransfers(await transRes.json());
      if (finRes.ok) setFinanceData(await finRes.json());
      if (supRes.ok) setSuppliers(await supRes.json());
    } catch (err) {
      console.error(err);
      toast('Gagal memuat data gudang', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (posContext?.token) {
      fetchData();
    }
  }, [posContext?.token]);

  // ─── INBOUND ACTIONS ───────────────────────────────────────────────────
  const handleAddInboundItem = () => {
    setInboundForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { ingredientId: '', itemName: '', purchaseUnit: 'Karton', purchaseQty: 1, conversionRatio: 1, purchasePrice: 0 }
      ]
    }));
  };

  const handleRemoveInboundItem = (idx: number) => {
    setInboundForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const handleInboundItemChange = (idx: number, field: string, val: any) => {
    setInboundForm(prev => {
      const newItems = [...prev.items];
      const item = { ...newItems[idx], [field]: val };

      if (field === 'ingredientId') {
        const found = stockList.find(s => s.id === Number(val));
        if (found) {
          item.itemName = found.name;
          item.purchaseUnit = found.purchaseUnit || 'Karton';
          item.conversionRatio = found.conversionRatio || 1;
          item.purchasePrice = found.buyPrice ? (found.buyPrice * (found.conversionRatio || 1)) : 0;
        }
      }
      newItems[idx] = item;
      return { ...prev, items: newItems };
    });
  };

  const submitInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inboundForm.items.length === 0 || !inboundForm.items[0].ingredientId) {
      toast('Pilih minimal satu bahan baku', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/warehouse/inbound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify(inboundForm)
      });

      const data = await res.json();
      if (res.ok) {
        toast('Barang masuk gudang berhasil dicatat!', 'success');
        setShowInboundModal(false);
        setInboundForm({
          supplierId: '',
          supplierName: '',
          paymentSource: 'DANA_PRIBADI_OWNER',
          date: new Date().toISOString().slice(0, 10),
          notes: '',
          items: [{ ingredientId: '', itemName: '', purchaseUnit: 'Karton', purchaseQty: 1, conversionRatio: 1, purchasePrice: 0 }]
        });
        fetchData();
      } else {
        toast(data.error || 'Gagal mencatat barang masuk', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan jaringan', 'error');
    }
  };

  // ─── TRANSFER ACTIONS ──────────────────────────────────────────────────
  const handleAddTransferItem = () => {
    setTransferForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { ingredientId: '', requestedUnit: '', requestedQty: 1 }
      ]
    }));
  };

  const handleRemoveTransferItem = (idx: number) => {
    setTransferForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const handleTransferItemChange = (idx: number, field: string, val: any) => {
    setTransferForm(prev => {
      const newItems = [...prev.items];
      const item = { ...newItems[idx], [field]: val };

      if (field === 'ingredientId') {
        const found = stockList.find(s => s.id === Number(val));
        if (found) {
          item.requestedUnit = found.unit; // Default satuan dasar dapur
        }
      }
      newItems[idx] = item;
      return { ...prev, items: newItems };
    });
  };

  const submitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferForm.items.length === 0 || !transferForm.items[0].ingredientId) {
      toast('Pilih minimal satu bahan yang diminta', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/warehouse/transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify(transferForm)
      });

      const data = await res.json();
      if (res.ok) {
        toast('Permintaan bahan ke gudang berhasil diajukan!', 'success');
        setShowTransferModal(false);
        setTransferForm({
          notes: '',
          items: [{ ingredientId: '', requestedUnit: '', requestedQty: 1 }]
        });
        fetchData();
      } else {
        toast(data.error || 'Gagal mengajukan transfer bahan', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan jaringan', 'error');
    }
  };

  const handleApproveTransfer = async (id: number) => {
    const confirm = await confirmAlert(
      'Setujui Pengiriman Bahan',
      'Apakah Anda yakin menyetujui pengiriman bahan baku ini ke Dapur Muki?'
    );
    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`/api/warehouse/transfers/${id}/approve`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        toast('Permintaan transfer telah disetujui untuk dikirim', 'success');
        fetchData();
      } else {
        const data = await res.json();
        toast(data.error || 'Gagal menyetujui transfer', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReceiveTransfer = async (id: number, reqNumber: string) => {
    const confirm = await confirmAlert(
      'Konfirmasi Terima Bahan di Dapur',
      `Konfirmasi penerimaan barang untuk ${reqNumber}? Stok fisik dapur akan bertambah, stok gudang berkurang, dan tagihan ke owner akan tercatat otomatis.`
    );
    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`/api/warehouse/transfers/${id}/receive`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        toast('Bahan berhasil diterima di dapur!', 'success');
        fetchData();
      } else {
        const data = await res.json();
        toast(data.error || 'Gagal konfirmasi penerimaan', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ─── REIMBURSE ACTIONS ─────────────────────────────────────────────────
  const submitReimburse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reimburseForm.amount <= 0) {
      toast('Jumlah pembayaran harus lebih dari 0', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/warehouse/owner-finance/reimburse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify(reimburseForm)
      });

      const data = await res.json();
      if (res.ok) {
        toast('Pembayaran pengembalian dana ke owner berhasil dicatat!', 'success');
        setShowReimburseModal(false);
        setReimburseForm({
          amount: 0,
          paymentMethod: 'Transfer Bank',
          deductFromMukiCash: false,
          notes: ''
        });
        fetchData();
      } else {
        toast(data.error || 'Gagal mencatat pengembalian dana', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan jaringan', 'error');
    }
  };

  // ─── OPNAME ACTIONS ────────────────────────────────────────────────────
  const submitOpname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredientForOpname) return;

    try {
      const res = await fetch('/api/warehouse/opname', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          ingredientId: selectedIngredientForOpname.id,
          actualStock: actualOpnameStock
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast('Stok fisik gudang berhasil disesuaikan', 'success');
        setShowOpnameModal(false);
        setSelectedIngredientForOpname(null);
        fetchData();
      } else {
        toast(data.error || 'Gagal opname gudang', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered Stock Items
  const filteredStock = stockList.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(searchStock.toLowerCase());
    const matchCat = filterCategory ? item.category === filterCategory : true;
    return matchSearch && matchCat;
  });

  return (
    <div className="p-3 sm:p-6 pb-28 sm:pb-16 w-full flex flex-col gap-4">
      {/* Top Header & Title */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-slate-900">
            <Boxes className="text-indigo-600" size={26} /> Manajemen Gudang Bahan Baku
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Central Warehouse &bull; Suplai Modal Pribadi Owner &bull; Konversi Grosir ke Dapur Muki
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowInboundModal(true)}
            className="btn btn-primary shadow-sm hover:shadow flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-bold"
          >
            <Plus size={15} /> + Belanja Masuk Gudang
          </button>
          <button
            onClick={() => setShowTransferModal(true)}
            className="btn bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-bold"
          >
            <ArrowRightLeft size={15} /> Request Bahan Dapur
          </button>
        </div>
      </div>

      {/* KPI Cards Header */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Nilai Aset Gudang */}
        <div className="card p-4 bg-white shadow-sm border border-slate-200/80 rounded-2xl flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Package size={22} />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Aset Fisik di Gudang</div>
            <div className="text-base sm:text-xl font-black text-slate-900">
              {formatCurrency(dashboardData?.totalAssetValue || 0)}
            </div>
          </div>
        </div>

        {/* Modal Owner Masuk */}
        <div className="card p-4 bg-white shadow-sm border border-slate-200/80 rounded-2xl flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ArrowDownLeft size={22} />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Modal Owner Masuk</div>
            <div className="text-base sm:text-xl font-black text-slate-900">
              {formatCurrency(dashboardData?.totalCapitalIn || 0)}
            </div>
          </div>
        </div>

        {/* Diserap Dapur Muki */}
        <div className="card p-4 bg-white shadow-sm border border-slate-200/80 rounded-2xl flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <ArrowUpRight size={22} />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Diserap Dapur Muki</div>
            <div className="text-base sm:text-xl font-black text-slate-900">
              {formatCurrency(dashboardData?.totalTransferredToResto || 0)}
            </div>
          </div>
        </div>

        {/* Sisa Piutang Owner */}
        <div className="card p-4 bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-200 rounded-2xl flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0">
            <Wallet size={22} />
          </div>
          <div>
            <div className="text-[10px] text-amber-100 font-bold uppercase tracking-wider">Tagihan Resto ke Owner</div>
            <div className="text-base sm:text-xl font-black text-white">
              {formatCurrency(dashboardData?.currentOwnerPayable || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('stock')}
          className={`py-2.5 px-4 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'stock'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers size={16} /> Stok Bahan Gudang ({filteredStock.length})
        </button>

        <button
          onClick={() => setActiveTab('inbound')}
          className={`py-2.5 px-4 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'inbound'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Truck size={16} /> Barang Masuk / Belanja ({inbounds.length})
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`py-2.5 px-4 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'transfers'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ArrowRightLeft size={16} /> Transfer ke Dapur Muki ({transfers.length})
          {transfers.filter(t => t.status === 'PENDING').length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
              {transfers.filter(t => t.status === 'PENDING').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('finance')}
          className={`py-2.5 px-4 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'finance'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Coins size={16} /> Rekonsiliasi Modal Owner
        </button>
      </div>

      {/* ─── TAB 1: STOK BAHAN GUDANG ─────────────────────────────────────── */}
      {activeTab === 'stock' && (
        <div className="flex flex-col gap-3">
          {/* Search & Filter Toolbar */}
          <div className="card p-3 bg-white shadow-sm border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row gap-2.5 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Cari nama bahan baku gudang..."
                value={searchStock}
                onChange={e => setSearchStock(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-48 shrink-0">
              <select
                className="w-full px-3 py-2 text-xs font-semibold bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
              >
                <option value="">Semua Kategori</option>
                <option value="FOOD">Makanan (Food)</option>
                <option value="DRINK">Minuman (Drink)</option>
                <option value="PACKAGING">Packaging / Kemasan</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
            {loading ? (
              <div className="p-10 text-center text-slate-400 text-xs font-medium">Memuat stok bahan gudang...</div>
            ) : filteredStock.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-xs font-medium">Tidak ada bahan baku ditemukan.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-400 font-bold uppercase">
                      <th className="p-3.5">Bahan Baku</th>
                      <th className="p-3.5">Kategori</th>
                      <th className="p-3.5">Satuan Konversi</th>
                      <th className="p-3.5 text-right">Stok Fisik Gudang</th>
                      <th className="p-3.5 text-right">Stok di Dapur Muki</th>
                      <th className="p-3.5 text-right">Nilai Modal / Aset</th>
                      <th className="p-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredStock.map(item => {
                      const ratio = item.conversionRatio || 1;
                      const pUnit = item.purchaseUnit || 'Grosir';
                      const wholesaleEquivalent = ratio > 1 ? (item.warehouseStock / ratio).toFixed(1) : null;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3.5 font-bold text-slate-800">
                            {item.name}
                            {item.supplier && (
                              <div className="text-[10px] text-slate-400 font-normal">
                                Supplier: {item.supplier.name}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-600">
                            {ratio > 1 ? (
                              <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                1 {pUnit} = {ratio} {item.unit}
                              </span>
                            ) : (
                              <span className="text-slate-400">1:1 ({item.unit})</span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="font-black text-slate-900 text-sm">
                              {item.warehouseStock} <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                            </div>
                            {wholesaleEquivalent && (
                              <div className="text-[10px] font-semibold text-indigo-600">
                                &asymp; {wholesaleEquivalent} {pUnit}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 text-right font-bold text-slate-600">
                            {item.stock} <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                          </td>
                          <td className="p-3.5 text-right font-black text-slate-800">
                            {formatCurrency(item.warehouseStock * item.buyPrice)}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => {
                                setSelectedIngredientForOpname(item);
                                setActualOpnameStock(item.warehouseStock);
                                setShowOpnameModal(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors"
                            >
                              Opname
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: INBOUND (BARANG MASUK DARI SUPPLIER) ──────────────────── */}
      {activeTab === 'inbound' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-800">Riwayat Belanja Masuk Gudang (Modal Owner)</h3>
            <button
              onClick={() => setShowInboundModal(true)}
              className="btn btn-primary py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1"
            >
              <Plus size={14} /> Tambah Belanja Masuk
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
            {inbounds.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-xs font-medium">Belum ada riwayat belanja barang masuk.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-400 font-bold uppercase">
                      <th className="p-3.5">No. Invoice</th>
                      <th className="p-3.5">Tanggal</th>
                      <th className="p-3.5">Supplier</th>
                      <th className="p-3.5">Sumber Dana</th>
                      <th className="p-3.5">Item Barang</th>
                      <th className="p-3.5 text-right">Total Belanja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {inbounds.map(inb => (
                      <tr key={inb.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-indigo-700">{inb.invoiceNumber}</td>
                        <td className="p-3.5 text-slate-500">{new Date(inb.date).toLocaleDateString('id-ID')}</td>
                        <td className="p-3.5 font-bold text-slate-800">{inb.supplier?.name || inb.supplierName || 'Toko Bebas'}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {inb.paymentSource === 'DANA_PRIBADI_OWNER' ? 'Dana Pribadi Owner' : 'Kas Muki'}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-col gap-0.5">
                            {inb.items?.map((it: any) => (
                              <span key={it.id} className="text-[11px] text-slate-600">
                                &bull; {it.itemName}: <strong>{it.purchaseQty} {it.purchaseUnit}</strong> ({it.baseQty} {it.ingredient?.unit})
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3.5 text-right font-black text-slate-900 text-sm">
                          {formatCurrency(inb.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: PERMINTAAN & TRANSFER KE DAPUR MUKI ────────────────────── */}
      {activeTab === 'transfers' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-800">Riwayat Pengajuan &amp; Transfer Bahan ke Dapur</h3>
            <button
              onClick={() => setShowTransferModal(true)}
              className="btn btn-primary py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1"
            >
              <Plus size={14} /> + Buat Permintaan Dapur
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
            {transfers.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-xs font-medium">Belum ada pengajuan transfer bahan.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-400 font-bold uppercase">
                      <th className="p-3.5">No. Requisition</th>
                      <th className="p-3.5">Diminta Oleh</th>
                      <th className="p-3.5">Item Permintaan</th>
                      <th className="p-3.5 text-right">Nilai Transfer (HPP)</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {transfers.map(tr => {
                      return (
                        <tr key={tr.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3.5">
                            <div className="font-mono font-bold text-indigo-700">{tr.reqNumber}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(tr.createdAt).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="p-3.5 font-semibold text-slate-800">
                            {tr.requestedBy?.name || 'Staff'}
                          </td>
                          <td className="p-3.5">
                            <div className="flex flex-col gap-0.5">
                              {tr.items?.map((it: any) => (
                                <span key={it.id} className="text-[11px] text-slate-700">
                                  &bull; {it.itemName}: <strong>{it.requestedQty} {it.requestedUnit}</strong> ({it.baseQty} {it.ingredient?.unit})
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3.5 text-right font-black text-slate-900 text-sm">
                            {formatCurrency(tr.totalTransferCost)}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                              tr.status === 'RECEIVED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : tr.status === 'APPROVED'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {tr.status === 'RECEIVED' ? 'Diterima Dapur' : tr.status === 'APPROVED' ? 'Disetujui Gudang' : 'Menunggu Approval'}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex justify-end gap-1.5">
                              {tr.status === 'PENDING' && (
                                <button
                                  onClick={() => handleApproveTransfer(tr.id)}
                                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200"
                                >
                                  Setujui &amp; Kirim
                                </button>
                              )}
                              {tr.status === 'APPROVED' && (
                                <button
                                  onClick={() => handleReceiveTransfer(tr.id, tr.reqNumber)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs"
                                >
                                  Terima di Dapur ✓
                                </button>
                              )}
                              {tr.status === 'RECEIVED' && (
                                <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 justify-end">
                                  <CheckCircle2 size={13} /> Selesai
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 4: REKONSILIASI DANA PRIBADI OWNER ───────────────────────── */}
      {activeTab === 'finance' && (
        <div className="flex flex-col gap-4">
          {/* Summary Box */}
          <div className="card p-5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl shadow-lg border border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-300">Status Saldo Hutang Muki ke Owner</div>
              <div className="text-2xl sm:text-3xl font-black mt-1 text-white">
                {formatCurrency(financeData?.summary?.currentOwnerPayable || 0)}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                Akumulasi nilai bahan baku yang sudah diambil &amp; diserap Dapur Muki Ramen dari gudang owner, yang belum disetor balik ke rekening pribadi owner.
              </p>
            </div>
            <button
              onClick={() => {
                setReimburseForm(prev => ({
                  ...prev,
                  amount: financeData?.summary?.currentOwnerPayable || 0
                }));
                setShowReimburseModal(true);
              }}
              className="px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 shrink-0 flex items-center justify-center gap-2"
            >
              <Coins size={16} /> Setor / Bayar Balik ke Owner
            </button>
          </div>

          {/* Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3.5 bg-slate-50 border-b border-slate-100 font-black text-xs text-slate-700 uppercase">
              Buku Kas Rekonsiliasi Modal Owner
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 font-bold uppercase">
                    <th className="p-3.5">Tanggal</th>
                    <th className="p-3.5">Jenis Transaksi</th>
                    <th className="p-3.5">Deskripsi / Referensi</th>
                    <th className="p-3.5">Oleh</th>
                    <th className="p-3.5 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(financeData?.transactions || []).map((t: any) => {
                    const isPlus = t.type === 'CAPITAL_IN';
                    const isDiserap = t.type === 'TRANSFER_TO_RESTO';
                    const isPaid = t.type === 'REIMBURSEMENT_PAID';

                    return (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5 text-slate-500">{new Date(t.date || t.createdAt).toLocaleDateString('id-ID')}</td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            isPlus
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : isDiserap
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {isPlus ? 'Modal Beli Masuk' : isDiserap ? 'Diserap Dapur Muki' : 'Reimburse Terbayar'}
                          </span>
                        </td>
                        <td className="p-3.5 font-medium text-slate-800">{t.description}</td>
                        <td className="p-3.5 text-slate-500">{t.user?.name || 'Admin'}</td>
                        <td className={`p-3.5 text-right font-black text-sm ${
                          isPaid ? 'text-emerald-600' : isDiserap ? 'text-amber-600' : 'text-blue-600'
                        }`}>
                          {formatCurrency(t.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: BELANJA MASUK GUDANG ─────────────────────────────────── */}
      {showInboundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 p-5 sm:p-6 flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base sm:text-lg flex items-center gap-2">
                <Truck className="text-indigo-600" size={20} /> Belanja Barang Masuk Gudang (Modal Owner)
              </h3>
              <button onClick={() => setShowInboundModal(false)} className="icon-btn hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitInbound} className="flex-1 overflow-y-auto pt-3 flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Supplier</label>
                  <select
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 rounded-xl border border-slate-200 outline-none"
                    value={inboundForm.supplierId}
                    onChange={e => setInboundForm({ ...inboundForm, supplierId: e.target.value })}
                  >
                    <option value="">-- Pilih Supplier Terdaftar / Bebas --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                {!inboundForm.supplierId && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Nama Toko / Pasar (Jika Bebas)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 rounded-xl border border-slate-200 outline-none"
                      placeholder="Contoh: Toko Sembako Jaya"
                      value={inboundForm.supplierName}
                      onChange={e => setInboundForm({ ...inboundForm, supplierName: e.target.value })}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Sumber Dana Belanja</label>
                  <select
                    className="w-full px-3 py-2 text-xs font-black bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 outline-none"
                    value={inboundForm.paymentSource}
                    onChange={e => setInboundForm({ ...inboundForm, paymentSource: e.target.value })}
                  >
                    <option value="DANA_PRIBADI_OWNER">Dana Pribadi Owner (Di luar Kas Muki)</option>
                    <option value="KAS_MUKI">Kas Operasional Muki Ramen</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Tanggal Pembelian</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 rounded-xl border border-slate-200 outline-none"
                    value={inboundForm.date}
                    onChange={e => setInboundForm({ ...inboundForm, date: e.target.value })}
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-slate-800 uppercase">Daftar Bahan Yang Dibelanja</span>
                  <button
                    type="button"
                    onClick={handleAddInboundItem}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Plus size={14} /> + Tambah Baris
                  </button>
                </div>

                <div className="space-y-2.5 max-h-56 overflow-y-auto">
                  {inboundForm.items.map((it, idx) => {
                    const baseTotal = (Number(it.purchaseQty) || 0) * (Number(it.conversionRatio) || 1);
                    const subtotal = (Number(it.purchaseQty) || 0) * (Number(it.purchasePrice) || 0);

                    return (
                      <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <select
                            className="flex-1 px-3 py-2 text-xs font-bold bg-white rounded-xl border border-slate-200"
                            value={it.ingredientId}
                            onChange={e => handleInboundItemChange(idx, 'ingredientId', e.target.value)}
                            required
                          >
                            <option value="">-- Pilih Bahan Baku --</option>
                            {stockList.map(s => (
                              <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
                            ))}
                          </select>
                          {inboundForm.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveInboundItem(idx)}
                              className="text-rose-500 hover:text-rose-700 p-1"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Satuan Grosir</label>
                            <input
                              type="text"
                              className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white rounded-lg border border-slate-200"
                              placeholder="Karton/Dus"
                              value={it.purchaseUnit}
                              onChange={e => handleInboundItemChange(idx, 'purchaseUnit', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Qty Beli</label>
                            <input
                              type="number"
                              step="any"
                              className="w-full px-2.5 py-1.5 text-xs font-bold bg-white rounded-lg border border-slate-200"
                              value={it.purchaseQty}
                              onChange={e => handleInboundItemChange(idx, 'purchaseQty', Number(e.target.value))}
                              required
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Isi per Satuan</label>
                            <input
                              type="number"
                              step="any"
                              className="w-full px-2.5 py-1.5 text-xs font-bold bg-white rounded-lg border border-slate-200"
                              value={it.conversionRatio}
                              onChange={e => handleInboundItemChange(idx, 'conversionRatio', Number(e.target.value))}
                              required
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Harga / Satuan Beli</label>
                            <input
                              type="number"
                              step="any"
                              className="w-full px-2.5 py-1.5 text-xs font-bold bg-white rounded-lg border border-slate-200"
                              value={it.purchasePrice}
                              onChange={e => handleInboundItemChange(idx, 'purchasePrice', Number(e.target.value))}
                              required
                            />
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-500 font-medium flex justify-between pt-1 border-t border-slate-200/60">
                          <span>Masuk Gudang: <strong className="text-indigo-700">{baseTotal} unit</strong></span>
                          <span>Subtotal: <strong className="text-slate-900">{formatCurrency(subtotal)}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Catatan Tambahan</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-xs font-medium bg-slate-50 rounded-xl border border-slate-200 outline-none"
                  placeholder="Catatan surat jalan / nomor nota / kondisi barang"
                  value={inboundForm.notes}
                  onChange={e => setInboundForm({ ...inboundForm, notes: e.target.value })}
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInboundModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary px-5 py-2.5 rounded-xl text-xs font-bold shadow-md"
                >
                  Simpan Barang Masuk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: REQUEST BAHAN DAPUR ─────────────────────────────────── */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 p-5 sm:p-6 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base sm:text-lg flex items-center gap-2">
                <ArrowRightLeft className="text-indigo-600" size={20} /> Pengajuan Permintaan Bahan Dapur
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="icon-btn hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitTransfer} className="flex-1 overflow-y-auto pt-3 flex flex-col gap-4">
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-slate-800 uppercase">Daftar Bahan Yang Diambil</span>
                  <button
                    type="button"
                    onClick={handleAddTransferItem}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Plus size={14} /> + Tambah Baris
                  </button>
                </div>

                {transferForm.items.map((it, idx) => {
                  const foundIng = stockList.find(s => s.id === Number(it.ingredientId));
                  return (
                    <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <select
                          className="flex-1 px-3 py-2 text-xs font-bold bg-white rounded-xl border border-slate-200"
                          value={it.ingredientId}
                          onChange={e => handleTransferItemChange(idx, 'ingredientId', e.target.value)}
                          required
                        >
                          <option value="">-- Pilih Bahan Baku --</option>
                          {stockList.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} (Stok Gudang: {s.warehouseStock} {s.unit})
                            </option>
                          ))}
                        </select>
                        {transferForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTransferItem(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Jumlah Diminta</label>
                          <input
                            type="number"
                            step="any"
                            className="w-full px-2.5 py-1.5 text-xs font-bold bg-white rounded-lg border border-slate-200"
                            value={it.requestedQty}
                            onChange={e => handleTransferItemChange(idx, 'requestedQty', Number(e.target.value))}
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Satuan</label>
                          <select
                            className="w-full px-2.5 py-1.5 text-xs font-bold bg-white rounded-lg border border-slate-200"
                            value={it.requestedUnit}
                            onChange={e => handleTransferItemChange(idx, 'requestedUnit', e.target.value)}
                          >
                            {foundIng && (
                              <>
                                <option value={foundIng.unit}>{foundIng.unit} (Satuan Dapur)</option>
                                {foundIng.purchaseUnit && (
                                  <option value={foundIng.purchaseUnit}>{foundIng.purchaseUnit} (Isi {foundIng.conversionRatio || 1} {foundIng.unit})</option>
                                )}
                              </>
                            )}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Catatan Koki / Dapur</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-xs font-medium bg-slate-50 rounded-xl border border-slate-200 outline-none"
                  placeholder="Misal: Persiapan weekend / ramen batch siang"
                  value={transferForm.notes}
                  onChange={e => setTransferForm({ ...transferForm, notes: e.target.value })}
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary px-5 py-2.5 rounded-xl text-xs font-bold shadow-md"
                >
                  Ajukan Permintaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: REIMBURSE OWNER ──────────────────────────────────────── */}
      {showReimburseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Coins className="text-amber-500" size={20} /> Pengembalian Modal ke Owner
              </h3>
              <button onClick={() => setShowReimburseModal(false)} className="icon-btn hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitReimburse} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Nominal Pembayaran (Rp)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2.5 text-sm font-black text-indigo-700 bg-slate-50 rounded-xl border border-slate-200 outline-none"
                  value={reimburseForm.amount}
                  onChange={e => setReimburseForm({ ...reimburseForm, amount: Number(e.target.value) })}
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Metode Pembayaran</label>
                <select
                  className="w-full px-3 py-2 text-xs font-semibold bg-white rounded-xl border border-slate-200"
                  value={reimburseForm.paymentMethod}
                  onChange={e => setReimburseForm({ ...reimburseForm, paymentMethod: e.target.value })}
                >
                  <option value="Transfer Bank">Transfer Bank ke Rekening Owner</option>
                  <option value="Tunai">Uang Tunai Laci Kasir</option>
                </select>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="deductCash"
                  className="mt-0.5 w-4 h-4 rounded text-amber-600 cursor-pointer"
                  checked={reimburseForm.deductFromMukiCash}
                  onChange={e => setReimburseForm({ ...reimburseForm, deductFromMukiCash: e.target.checked })}
                />
                <label htmlFor="deductCash" className="text-xs font-semibold text-amber-900 cursor-pointer">
                  Catat Otomatis di Arus Kas / Petty Cash Muki
                  <span className="block text-[10px] text-amber-700 font-normal mt-0.5">
                    Centang ini jika pembayaran diambil langsung dari kas operasional Muki Ramen (kategori: Setor Modal Owner).
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Catatan / Bukti Bayar</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-xs font-medium bg-slate-50 rounded-xl border border-slate-200 outline-none"
                  placeholder="Contoh: Transfer BCA Ref #88912"
                  value={reimburseForm.notes}
                  onChange={e => setReimburseForm({ ...reimburseForm, notes: e.target.value })}
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReimburseModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary px-5 py-2 rounded-xl text-xs font-bold"
                >
                  Catat Pembayaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: OPNAME STOK GUDANG ───────────────────────────────────── */}
      {showOpnameModal && selectedIngredientForOpname && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">Opname Stok Gudang</h3>
              <button onClick={() => setShowOpnameModal(false)} className="icon-btn hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitOpname} className="flex flex-col gap-3">
              <div className="text-xs text-slate-600">
                Bahan: <strong className="text-slate-900">{selectedIngredientForOpname.name}</strong>
              </div>
              <div className="text-xs text-slate-600">
                Stok Sistem Saat Ini: <strong className="text-indigo-600">{selectedIngredientForOpname.warehouseStock} {selectedIngredientForOpname.unit}</strong>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Stok Fisik Sebenarnya ({selectedIngredientForOpname.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  className="w-full px-3 py-2 text-sm font-black text-slate-900 bg-slate-50 rounded-xl border border-slate-200 outline-none"
                  value={actualOpnameStock}
                  onChange={e => setActualOpnameStock(Number(e.target.value))}
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowOpnameModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary px-4 py-2 rounded-xl text-xs font-bold">
                  Simpan Penyesuaian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
