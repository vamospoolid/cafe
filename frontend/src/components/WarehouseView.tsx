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
  Sparkles,
  ArrowLeft,
  Save,
  Trash2,
  Building2,
  Store,
  Info,
  Check,
  Ban,
  AlertCircle
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

  // Void Inbound Modal State
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidTarget, setVoidTarget] = useState<any>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidLoading, setVoidLoading] = useState(false);

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

  // Reimburse / Settlement Form State
  const [reimburseForm, setReimburseForm] = useState({
    amount: 0,
    paymentMethod: 'Transfer Bank',
    deductFromBranchCash: false,
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
      'Apakah Anda yakin menyetujui distribusi bahan baku ini ke Dapur Cabang?'
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
      'Konfirmasi Terima Bahan di Cabang',
      `Konfirmasi penerimaan barang untuk ${reqNumber}? Stok fisik dapur cabang akan bertambah, stok gudang berkurang, dan settlement modal pusat akan dibukukan secara otomatis.`
    );
    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`/api/warehouse/transfers/${id}/receive`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        toast('Bahan berhasil diterima di dapur cabang!', 'success');
        fetchData();
      } else {
        const data = await res.json();
        toast(data.error || 'Gagal konfirmasi penerimaan', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ─── REIMBURSE / SETTLEMENT ACTIONS ────────────────────────────────────
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
        toast('Penyelesaian settlement kas ke entitas pusat berhasil dicatat!', 'success');
        setShowReimburseModal(false);
        setReimburseForm({
          amount: 0,
          paymentMethod: 'Transfer Bank',
          deductFromBranchCash: false,
          notes: ''
        });
        fetchData();
      } else {
        toast(data.error || 'Gagal mencatat settlement dana', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan jaringan', 'error');
    }
  };

  // ─── VOID INBOUND (Koreksi Salah Input) ────────────────────────────────
  const submitVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidTarget) return;
    if (!voidReason.trim()) {
      toast('Alasan pembatalan wajib diisi', 'warning');
      return;
    }
    setVoidLoading(true);
    try {
      const res = await fetch(`/api/warehouse/inbounds/${voidTarget.id}/void`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ voidReason })
      });
      const data = await res.json();
      if (res.ok) {
        toast(`✅ ${data.message}`, 'success');
        setShowVoidModal(false);
        setVoidTarget(null);
        setVoidReason('');
        fetchData();
      } else {
        toast(data.error || 'Gagal membatalkan penerimaan', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setVoidLoading(false);
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
            Central Warehouse Management &bull; Multi-Unit Supply Chain &bull; Rekonsiliasi Settlement
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowInboundModal(true)}
            className="btn btn-primary shadow-sm hover:shadow flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-bold"
          >
            <Plus size={15} /> + Penerimaan Pasokan Masuk
          </button>
          <button
            onClick={() => setShowTransferModal(true)}
            className="btn bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-bold"
          >
            <ArrowRightLeft size={15} /> Request Bahan ke Dapur
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

        {/* Investasi Pengadaan Pusat */}
        <div className="card p-4 bg-white shadow-sm border border-slate-200/80 rounded-2xl flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ArrowDownLeft size={22} />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Investasi Pengadaan Pusat</div>
            <div className="text-base sm:text-xl font-black text-slate-900">
              {formatCurrency(dashboardData?.totalCapitalIn || 0)}
            </div>
          </div>
        </div>

        {/* Realisasi Distribusi Outlet */}
        <div className="card p-4 bg-white shadow-sm border border-slate-200/80 rounded-2xl flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <ArrowUpRight size={22} />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Realisasi Distribusi Outlet</div>
            <div className="text-base sm:text-xl font-black text-slate-900">
              {formatCurrency(dashboardData?.totalTransferredToResto || 0)}
            </div>
          </div>
        </div>

        {/* Kewajiban Settlement Cabang */}
        <div className="card p-4 bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-200 rounded-2xl flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0">
            <Wallet size={22} />
          </div>
          <div>
            <div className="text-[10px] text-amber-100 font-bold uppercase tracking-wider">Kewajiban Settlement Cabang</div>
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
          <Truck size={16} /> Penerimaan Pasokan ({inbounds.length})
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`py-2.5 px-4 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'transfers'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ArrowRightLeft size={16} /> Distribusi ke Dapur Cabang ({transfers.length})
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
          <Coins size={16} /> Rekonsiliasi &amp; Settlement Finansial
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
                      <th className="p-3.5 text-right">Stok di Dapur Cabang</th>
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
            <h3 className="text-sm font-black text-slate-800">Riwayat Penerimaan Pasokan Masuk Gudang</h3>
            <button
              onClick={() => setShowInboundModal(true)}
              className="btn btn-primary py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1"
            >
              <Plus size={14} /> + Penerimaan Pasokan Masuk
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
                      <tr key={inb.id} className={`hover:bg-slate-50 transition-colors ${inb.isVoided ? 'opacity-50' : ''}`}>
                        <td className="p-3.5">
                          <div className="flex flex-col gap-1">
                            <span className="font-mono font-bold text-indigo-700">{inb.invoiceNumber}</span>
                            {inb.isVoided && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-50 text-red-600 border border-red-200 w-fit">
                                <Ban size={9} /> DIBATALKAN
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-500">{new Date(inb.date).toLocaleDateString('id-ID')}</td>
                        <td className="p-3.5 font-bold text-slate-800">{inb.supplier?.name || inb.supplierName || 'Toko Bebas'}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {inb.paymentSource === 'DANA_PRIBADI_OWNER' ? 'Modal Pusat' : 'Kas Operasional'}
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
                          <div className="flex items-center justify-end gap-2">
                            <span className={inb.isVoided ? 'line-through text-slate-400' : ''}>
                              {formatCurrency(inb.totalAmount)}
                            </span>
                            {!inb.isVoided && (
                              <button
                                onClick={() => { setVoidTarget(inb); setVoidReason(''); setShowVoidModal(true); }}
                                title="Batalkan / Koreksi Salah Input"
                                className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 transition-colors flex-shrink-0"
                              >
                                <Ban size={13} />
                              </button>
                            )}
                          </div>
                          {inb.isVoided && inb.voidReason && (
                            <div className="text-[10px] text-red-500 font-normal text-right mt-1 max-w-[180px] ml-auto">
                              Alasan: {inb.voidReason}
                            </div>
                          )}
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

      {/* ─── TAB 3: PERMINTAAN & DISTRIBUSI KE DAPUR CABANG ────────────────── */}
      {activeTab === 'transfers' && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-800">Riwayat Pengajuan &amp; Distribusi Bahan ke Dapur Cabang</h3>
            <button
              onClick={() => setShowTransferModal(true)}
              className="btn btn-primary py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1"
            >
              <Plus size={14} /> + Permintaan Bahan Baru
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
                              {tr.status === 'RECEIVED' ? 'Diterima Cabang' : tr.status === 'APPROVED' ? 'Disetujui Gudang' : 'Menunggu Approval'}
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
                                  Konfirmasi Terima di Cabang ✓
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

      {/* ─── TAB 4: REKONSILIASI & SETTLEMENT FINANSIAL ───────────────────── */}
      {activeTab === 'finance' && (
        <div className="flex flex-col gap-4">
          {/* Summary Box */}
          <div className="card p-5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl shadow-lg border border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-300">Status Saldo Kewajiban Settlement Cabang</div>
              <div className="text-2xl sm:text-3xl font-black mt-1 text-white">
                {formatCurrency(financeData?.summary?.currentOwnerPayable || 0)}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                Akumulasi nilai bahan baku yang telah didistribusikan ke unit operasional dapur cabang yang belum diselesaikan (settled) kembali ke entitas modal pusat.
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
              <Coins size={16} /> Proses Settlement / Pencairan Balik
            </button>
          </div>

          {/* Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3.5 bg-slate-50 border-b border-slate-100 font-black text-xs text-slate-700 uppercase">
              Buku Rekonsiliasi Settlement Pengadaan
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
                            {isPlus ? 'Pasokan Modal Pusat' : isDiserap ? 'Distribusi ke Cabang' : 'Settlement Selesai'}
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

      {/* ─── FULL PAGE: BELANJA MASUK GUDANG (INBOUND) ───────────────────── */}
      {showInboundModal && (
        <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col h-screen w-screen overflow-hidden animate-fade-in">
          {/* Top Sticky Navbar */}
          <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                type="button"
                onClick={() => setShowInboundModal(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Kembali ke Gudang</span>
              </button>
              <div className="h-6 w-px bg-slate-200 hidden sm:block" />
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 truncate">
                  <span className="p-1.5 rounded-xl bg-indigo-100 text-indigo-700">
                    <Truck size={18} />
                  </span>
                  <span>Form Penerimaan Pasokan Masuk Gudang Pusat</span>
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
                  Pencatatan pasokan partai besar / grosir ke Central Warehouse (Bahan Baku)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-black bg-emerald-50 text-emerald-800 border-emerald-200">
                <span>Sumber:</span>
                <span>{inboundForm.paymentSource === 'DANA_PRIBADI_OWNER' ? 'Modal Pusat' : 'Kas Operasional'}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowInboundModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer hidden sm:block"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitInbound}
                className="px-5 py-2 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Save size={16} />
                <span>Simpan Belanja Masuk</span>
              </button>
            </div>
          </header>

          {/* Scrollable Form Body */}
          <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8">
            <form onSubmit={submitInbound} className="max-w-7xl mx-auto w-full space-y-6 pb-24">
              {/* Card 1: Informasi Pengadaan & Supplier */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                      <Store size={18} />
                    </span>
                    <div>
                      <h2 className="font-extrabold text-sm sm:text-base text-slate-800">Informasi Supplier & Transaksi</h2>
                      <p className="text-xs text-slate-400">Pilih supplier dan tentukan sumber dana pengadaan</p>
                    </div>
                  </div>

                  <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600">
                    ID Transaksi Baru
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Supplier */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Pilih Supplier <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className="w-full py-2.5 px-3 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 outline-none transition-all"
                      value={inboundForm.supplierId}
                      onChange={e => setInboundForm({ ...inboundForm, supplierId: e.target.value })}
                    >
                      <option value="">-- Bebas / Tanpa Akun Supplier --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.phone || 'No Telp -'})</option>
                      ))}
                    </select>
                  </div>

                  {/* Toko / Pasar Bebas */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Nama Toko / Distributor {inboundForm.supplierId ? '(Otomatis)' : '(Bebas)'}
                    </label>
                    <input
                      type="text"
                      disabled={!!inboundForm.supplierId}
                      className="w-full py-2.5 px-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white disabled:bg-slate-100 border border-slate-200 focus:border-indigo-600 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 outline-none transition-all"
                      placeholder="Contoh: Grosir Makmur / Pasar Induk"
                      value={inboundForm.supplierName}
                      onChange={e => setInboundForm({ ...inboundForm, supplierName: e.target.value })}
                    />
                  </div>

                  {/* Sumber Dana */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Sumber Dana Pembelian <span className="text-rose-500">*</span>
                    </label>
                    <select
                      className={`w-full py-2.5 px-3 border rounded-xl text-xs sm:text-sm font-black outline-none transition-all ${
                        inboundForm.paymentSource === 'DANA_PRIBADI_OWNER'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}
                      value={inboundForm.paymentSource}
                      onChange={e => setInboundForm({ ...inboundForm, paymentSource: e.target.value })}
                    >
                      <option value="DANA_PRIBADI_OWNER">🏢 Modal Pengadaan Pusat (Non-Operasional Cabang)</option>
                      <option value="KAS_MUKI">🏪 Kas Operasional Outlet / Cabang</option>
                    </select>
                  </div>

                  {/* Tanggal */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Tanggal Pembelian <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      className="w-full py-2.5 px-3 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl text-xs sm:text-sm font-bold text-slate-800 outline-none transition-all"
                      value={inboundForm.date}
                      onChange={e => setInboundForm({ ...inboundForm, date: e.target.value })}
                    />
                  </div>
                </div>

                {/* Info Alert Box */}
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900">
                  <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    {inboundForm.paymentSource === 'DANA_PRIBADI_OWNER' ? (
                      <span>
                        <strong>Mode Modal Pengadaan Pusat Aktif:</strong> Nilai total belanja barang ini akan dicatat sebagai penambahan <strong>Investasi Pengadaan Pusat di Gudang</strong>. Kas harian kasir cabang <u>sama sekali tidak berkurang</u> hingga barang didistribusikan ke unit operasional dapur cabang.
                      </span>
                    ) : (
                      <span>
                        <strong>Mode Kas Operasional Cabang:</strong> Nilai total belanja akan langsung dipotong dari arus kas harian operasional cabang.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 2: Rincian Bahan Baku yang Dibelanja (Ergonomic Smart-Card Layout) */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                      <Package size={18} />
                    </span>
                    <div>
                      <h2 className="font-extrabold text-sm sm:text-base text-slate-800">Daftar Bahan Baku Grosir yang Masuk</h2>
                      <p className="text-xs text-slate-400">Input kuantitas kemasan grosir, rasio konversi isi, dan harga modal beli dengan kalkulasi HPP otomatis</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddInboundItem}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus size={15} /> + Tambah Bahan Baku
                  </button>
                </div>

                {/* Card-based List of Inbound Items */}
                <div className="space-y-4">
                  {inboundForm.items.map((it, idx) => {
                    const selectedIng = stockList.find(s => s.id === Number(it.ingredientId));
                    const baseUnit = selectedIng?.unit || 'unit';
                    const qty = Number(it.purchaseQty) || 0;
                    const ratio = Number(it.conversionRatio) || 1;
                    const price = Number(it.purchasePrice) || 0;
                    const baseTotal = qty * ratio;
                    const subtotal = qty * price;
                    const costPerBaseUnit = ratio > 0 ? (price / ratio) : 0;
                    const pUnit = it.purchaseUnit || 'Grosir';

                    const presetUnits = ['Karton', 'Dus', 'Pak', 'Karung', 'Jerigen', 'Bal'];

                    return (
                      <div 
                        key={idx} 
                        className={`rounded-2xl border transition-all p-4 sm:p-5 relative ${
                          it.ingredientId 
                            ? 'bg-slate-50/50 border-slate-200/90 shadow-xs hover:border-indigo-300' 
                            : 'bg-amber-50/20 border-amber-200'
                        }`}
                      >
                        {/* Item Card Header */}
                        <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-200/60">
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-black flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                              Baris Bahan #{idx + 1}
                            </span>
                            {selectedIng && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {selectedIng.category || 'Bahan'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Live Subtotal Badge */}
                            <div className="text-right">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">Subtotal Baris</span>
                              <span className="text-sm font-black text-slate-900">
                                {formatCurrency(subtotal)}
                              </span>
                            </div>

                            {inboundForm.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveInboundItem(idx)}
                                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-100/60 transition-colors ml-1"
                                title="Hapus Baris Ini"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Grid Form Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 sm:gap-4 items-start">
                          {/* Sisi 1: Pemilihan Bahan Baku (4 Kolom) */}
                          <div className="md:col-span-4 space-y-1.5">
                            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                              Bahan Baku Terdaftar <span className="text-rose-500">*</span>
                            </label>
                            <select
                              className="w-full py-2.5 px-3 text-xs font-bold bg-white rounded-xl border border-slate-200 focus:border-indigo-600 outline-none shadow-2xs"
                              value={it.ingredientId}
                              onChange={e => handleInboundItemChange(idx, 'ingredientId', e.target.value)}
                              required
                            >
                              <option value="">-- Pilih Bahan Baku --</option>
                              {stockList.map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({s.category}) — Satuan Dapur: {s.unit}
                                </option>
                              ))}
                            </select>

                            {selectedIng ? (
                              <div className="flex items-center justify-between text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/60 text-slate-500">
                                <span>Stok Gudang Fisik:</span>
                                <strong className="text-slate-800">{selectedIng.warehouseStock} {selectedIng.unit}</strong>
                              </div>
                            ) : (
                              <div className="text-[10px] text-amber-600 italic">Pilih bahan baku untuk mulai menghitung</div>
                            )}
                          </div>

                          {/* Sisi 2: Satuan Grosir & Kuantitas Beli (4 Kolom) */}
                          <div className="md:col-span-4 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              {/* Satuan Grosir */}
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                  Kemasan Grosir
                                </label>
                                <input
                                  type="text"
                                  className="w-full py-2 px-2.5 text-xs font-semibold bg-white rounded-xl border border-slate-200 focus:border-indigo-600 outline-none shadow-2xs"
                                  placeholder="cth: Karton"
                                  value={it.purchaseUnit}
                                  onChange={e => handleInboundItemChange(idx, 'purchaseUnit', e.target.value)}
                                  required
                                />
                              </div>

                              {/* Qty Beli */}
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                  Kuantitas (Qty)
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  min="0.01"
                                  className="w-full py-2 px-2 text-xs font-black text-center bg-white rounded-xl border border-slate-200 focus:border-indigo-600 outline-none shadow-2xs"
                                  value={it.purchaseQty}
                                  onChange={e => handleInboundItemChange(idx, 'purchaseQty', Number(e.target.value))}
                                  required
                                />
                              </div>
                            </div>

                            {/* Quick Preset Unit Chips */}
                            <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
                              <span className="text-[9px] text-slate-400 font-bold uppercase shrink-0">Cepat:</span>
                              {presetUnits.map(unit => (
                                <button
                                  type="button"
                                  key={unit}
                                  onClick={() => handleInboundItemChange(idx, 'purchaseUnit', unit)}
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold border transition-colors shrink-0 ${
                                    it.purchaseUnit === unit 
                                      ? 'bg-indigo-600 text-white border-indigo-600' 
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {unit}
                                </button>
                              ))}
                            </div>

                            {/* Rasio Konversi Isi */}
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                  Isi per 1 {pUnit}
                                </label>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  (ke Satuan Dapur)
                                </span>
                              </div>
                              <div className="relative flex items-center">
                                <input
                                  type="number"
                                  step="any"
                                  min="0.001"
                                  className="w-full py-2 pl-3 pr-16 text-xs font-black bg-white rounded-xl border border-slate-200 focus:border-indigo-600 outline-none shadow-2xs"
                                  value={it.conversionRatio}
                                  onChange={e => handleInboundItemChange(idx, 'conversionRatio', Number(e.target.value))}
                                  required
                                />
                                <span className="absolute right-3 text-[11px] font-bold text-indigo-600 pointer-events-none">
                                  {baseUnit}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Sisi 3: Harga Beli & Hasil Konversi (4 Kolom) */}
                          <div className="md:col-span-4 space-y-2">
                            {/* Harga Beli Satuan Grosir */}
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                Harga Beli per 1 {pUnit}
                              </label>
                              <div className="relative flex items-center">
                                <span className="absolute left-3 text-xs font-bold text-slate-400">Rp</span>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  className="w-full py-2 pl-8 pr-3 text-xs font-black text-right bg-white rounded-xl border border-slate-200 focus:border-indigo-600 outline-none shadow-2xs"
                                  value={it.purchasePrice}
                                  onChange={e => handleInboundItemChange(idx, 'purchasePrice', Number(e.target.value))}
                                  required
                                />
                              </div>
                            </div>

                            {/* Visual Feedback Result Box */}
                            <div className="bg-white rounded-xl border border-indigo-100 p-2.5 space-y-1.5 shadow-2xs">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 font-medium">Hasil Masuk Stok:</span>
                                <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
                                  +{baseTotal.toLocaleString('id-ID')} {baseUnit}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-xs pt-1 border-t border-dashed border-slate-100">
                                <span className="text-slate-400 text-[10px] font-medium">HPP Modal per {baseUnit}:</span>
                                <span className="font-extrabold text-emerald-700 text-[11px]">
                                  {formatCurrency(costPerBaseUnit)} / {baseUnit}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Row Button */}
                <div className="pt-2 flex justify-start">
                  <button
                    type="button"
                    onClick={handleAddInboundItem}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-all border border-indigo-200 cursor-pointer active:scale-95"
                  >
                    <Plus size={16} />
                    <span>+ Tambah Baris Bahan Baku Lain</span>
                  </button>
                </div>
              </div>


              {/* Card 3: Catatan & Ringkasan Total */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Catatan Tambahan / Nomor Surat Jalan / Faktur
                  </label>
                  <textarea
                    rows={3}
                    className="w-full py-2.5 px-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition-all resize-none"
                    placeholder="Contoh: No Nota #INV-89102, pengiriman tahap 1 via truk ekspedisi, kondisi kardus baik."
                    value={inboundForm.notes}
                    onChange={e => setInboundForm({ ...inboundForm, notes: e.target.value })}
                  />
                </div>

                <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-lg border border-slate-800 space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">Ringkasan Pengadaan</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-600/50 text-indigo-200 font-bold">
                      {inboundForm.items.length} SKU Bahan
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Total Jenis Barang:</span>
                      <strong className="text-white">{inboundForm.items.length} Item</strong>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Metode Pembebanan:</span>
                      <strong className="text-emerald-400">
                        {inboundForm.paymentSource === 'DANA_PRIBADI_OWNER' ? 'Buku Besar Modal Pusat' : 'Kas Operasional Outlet'}
                      </strong>
                    </div>
                    <div className="pt-3 border-t border-slate-800 flex justify-between items-baseline">
                      <span className="text-sm font-extrabold text-white">Grand Total Belanja:</span>
                      <span className="text-xl sm:text-2xl font-black text-amber-400">
                        {formatCurrency(
                          inboundForm.items.reduce((acc, it) => acc + ((Number(it.purchaseQty) || 0) * (Number(it.purchasePrice) || 0)), 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </form>
          </main>

          {/* Sticky Bottom Bar */}
          <footer className="bg-white border-t border-slate-200 px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 shadow-lg">
            <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
              <span className="font-bold text-slate-800">Grand Total:</span>
              <span className="text-base font-black text-indigo-700">
                {formatCurrency(
                  inboundForm.items.reduce((acc, it) => acc + ((Number(it.purchaseQty) || 0) * (Number(it.purchasePrice) || 0)), 0)
                )}
              </span>
              <span className="hidden sm:inline text-slate-300">&bull;</span>
              <span className="bg-slate-100 px-2.5 py-1 rounded-lg font-semibold">
                {inboundForm.items.length} Macam Bahan
              </span>
              <span className={`px-2.5 py-1 rounded-lg font-bold ${
                inboundForm.paymentSource === 'DANA_PRIBADI_OWNER' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {inboundForm.paymentSource === 'DANA_PRIBADI_OWNER' ? 'Modal Pusat' : 'Kas Operasional'}
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowInboundModal(false)}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitInbound}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save size={16} />
                <span>Simpan Belanja Masuk Gudang</span>
              </button>
            </div>
          </footer>
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

      {/* ─── MODAL: SETTLEMENT / PENGEMBALIAN MODAL PUSAT ────────────────── */}
      {showReimburseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Coins className="text-amber-500" size={20} /> Settlement Kas ke Entitas Pusat
              </h3>
              <button onClick={() => setShowReimburseModal(false)} className="icon-btn hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitReimburse} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Nominal Settlement (Rp)</label>
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
                  <option value="Transfer Bank">Transfer Bank (Rekening Induk / Penampung)</option>
                  <option value="Tunai">Kas Tunai Cabang (Cash On Hand)</option>
                </select>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="deductCash"
                  className="mt-0.5 w-4 h-4 rounded text-amber-600 cursor-pointer"
                  checked={reimburseForm.deductFromBranchCash}
                  onChange={e => setReimburseForm({ ...reimburseForm, deductFromBranchCash: e.target.checked })}
                />
                <label htmlFor="deductCash" className="text-xs font-semibold text-amber-900 cursor-pointer">
                  Catat Otomatis di Arus Kas / Petty Cash Cabang
                  <span className="block text-[10px] text-amber-700 font-normal mt-0.5">
                    Centang ini jika pembayaran settlement diambil langsung dari kas operasional cabang (kategori: Settlement Modal Pusat).
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Catatan / Bukti Referensi</label>
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

      {/* ─── MODAL: VOID / KOREKSI PENERIMAAN BARANG ──────────────────────── */}
      {showVoidModal && voidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-red-100 p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Ban className="text-red-500" size={20} />
                Batalkan Penerimaan
              </h3>
              <button onClick={() => setShowVoidModal(false)} className="icon-btn hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            {/* Info alert */}
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex gap-2.5 text-xs text-amber-900">
              <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong>Data tidak akan dihapus — hanya ditandai VOID.</strong>
                <br/>Stok gudang akan dikembalikan otomatis. Riwayat tetap tersimpan untuk keperluan audit.
              </div>
            </div>

            {/* Target info */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
              <div className="font-mono font-black text-indigo-700 text-sm mb-1">{voidTarget.invoiceNumber}</div>
              <div className="text-slate-600">Supplier: <strong>{voidTarget.supplier?.name || voidTarget.supplierName || 'Toko Bebas'}</strong></div>
              <div className="text-slate-600">Total: <strong className="text-red-600">{formatCurrency(voidTarget.totalAmount)}</strong></div>
              <div className="text-slate-600 mt-1">Item: {voidTarget.items?.length || 0} jenis bahan baku</div>
            </div>

            <form onSubmit={submitVoid} className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Alasan Pembatalan <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full px-3 py-2.5 text-xs font-medium bg-slate-50 rounded-xl border border-slate-200 outline-none resize-none"
                  rows={3}
                  placeholder="Contoh: Salah input jumlah, supplier tidak jadi kirim, invoice ganda..."
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowVoidModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={voidLoading || !voidReason.trim()}
                  className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-black text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Ban size={13} />
                  {voidLoading ? 'Memproses...' : 'Konfirmasi Batalkan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
