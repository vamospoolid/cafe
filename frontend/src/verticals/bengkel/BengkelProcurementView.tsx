import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ClipboardList,
  ShoppingCart,
  Plus,
  Printer,
  Search,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  Sparkles,
  Trash2,
  RefreshCw,
  Phone,
  User,
  ArrowRight,
  FileText,
  DollarSign,
  Clock,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast, confirmAlert } from '../../utils/alert';
import { PartRequestModal } from './PartRequestModal';
import { ConvertToProductModal } from './ConvertToProductModal';
import { SupplierInvoiceModal } from './SupplierInvoiceModal';
import { SupplierPaymentModal } from './SupplierPaymentModal';

export const BengkelProcurementView: React.FC = () => {
  const { token } = usePOS();

  const [activeTab, setActiveTab] = useState<'SHEET' | 'REQUESTS' | 'INVOICES'>('SHEET');
  const [loading, setLoading] = useState<boolean>(false);

  // Shopping Sheet Data
  const [shoppingData, setShoppingData] = useState<any>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL');
  const [checkedItemIds, setCheckedItemIds] = useState<Record<string, boolean>>({});

  // Requests Table Data
  const [requests, setRequests] = useState<any[]>([]);
  const [requestStats, setRequestStats] = useState<any>({});
  const [requestSearch, setRequestSearch] = useState<string>('');
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>('ALL');

  // Supplier Invoices & Accounts Payable Data
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoiceSummary, setInvoiceSummary] = useState<any>(null);
  const [invoiceSearch, setInvoiceSearch] = useState<string>('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('ALL');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [convertTargetRequest, setConvertTargetRequest] = useState<any | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [selectedInvoiceForPay, setSelectedInvoiceForPay] = useState<any | null>(null);

  // Fetch Shopping Sheet
  const fetchShoppingSheet = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/bengkel/part-requests/shopping-sheet', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setShoppingData(data);
      }
    } catch (e) {
      console.error(e);
      toast('Gagal memuat lembar rekomendasi belanja', 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch Part Requests List
  const fetchPartRequests = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(
        `/api/bengkel/part-requests?status=${requestStatusFilter}&search=${encodeURIComponent(requestSearch)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setRequests(data.items || []);
        setRequestStats(data.stats || {});
      }
    } catch (e) {
      console.error(e);
      toast('Gagal memuat catatan permintaan', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, requestStatusFilter, requestSearch]);

  // Fetch Supplier Invoices
  const fetchInvoices = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(
        `/api/bengkel/supplier-invoices?status=${invoiceStatusFilter}&search=${encodeURIComponent(invoiceSearch)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
      }
    } catch (e) {
      console.error(e);
      toast('Gagal memuat daftar faktur pembelian', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, invoiceStatusFilter, invoiceSearch]);

  // Fetch Invoice Summary
  const fetchInvoiceSummary = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/bengkel/supplier-invoices/summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setInvoiceSummary(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'SHEET') {
      fetchShoppingSheet();
    } else if (activeTab === 'REQUESTS') {
      fetchPartRequests();
    } else if (activeTab === 'INVOICES') {
      fetchInvoices();
      fetchInvoiceSummary();
    }
  }, [activeTab, fetchShoppingSheet, fetchPartRequests, fetchInvoices, fetchInvoiceSummary]);

  // Toggle item checkbox in shopping sheet
  const toggleItemCheck = (id: string) => {
    setCheckedItemIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Change request status
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/bengkel/part-requests/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        toast('Status permintaan diperbarui', 'success');
        fetchPartRequests();
        if (activeTab === 'SHEET') fetchShoppingSheet();
      }
    } catch (e) {
      console.error(e);
      toast('Gagal memperbarui status', 'error');
    }
  };

  // Delete request
  const handleDeleteRequest = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus catatan permintaan ini?')) return;
    try {
      const res = await fetch(`/api/bengkel/part-requests/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast('Catatan permintaan berhasil dihapus', 'success');
        fetchPartRequests();
      }
    } catch (e) {
      console.error(e);
      toast('Gagal menghapus catatan', 'error');
    }
  };

  // Filter shopping list by brand
  const filteredShoppingItems = useMemo(() => {
    if (!shoppingData?.items) return [];
    if (selectedBrand === 'ALL') return shoppingData.items;
    return shoppingData.items.filter((item: any) =>
      (item.brand || 'Lainnya').toUpperCase() === selectedBrand.toUpperCase()
    );
  }, [shoppingData, selectedBrand]);

  const brandList = useMemo(() => {
    if (!shoppingData?.groupedByBrand) return [];
    return Object.keys(shoppingData.groupedByBrand).sort();
  }, [shoppingData]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Top Header Bar */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
            <ShoppingCart size={15} />
            <span>Pengadaan & Stok Suku Cadang</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Rencana Belanja & Buku Permintaan
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Konsolidasi stok minimum dan catatan suku cadang dicari konsumen untuk belanja distributor / Makassar
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs hover:shadow transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={16} />
            <span>Catat Barang Kosong</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Printer size={16} />
            <span>Cetak Lembar Belanja</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTab('SHEET')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'SHEET'
              ? 'border-amber-600 text-amber-700 bg-amber-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <ShoppingCart size={15} />
          <span>📋 Lembar Rencana Belanja</span>
          {shoppingData?.summary?.totalItems > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900">
              {shoppingData.summary.totalItems}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('REQUESTS')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'REQUESTS'
              ? 'border-amber-600 text-amber-700 bg-amber-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <ClipboardList size={15} />
          <span>📖 Buku Permintaan Konsumen (Defecta)</span>
          {requestStats?.pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-200 text-rose-900">
              {requestStats.pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('INVOICES')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'INVOICES'
              ? 'border-amber-600 text-amber-700 bg-amber-50/50 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileText size={15} />
          <span>🧾 Faktur Masuk & Hutang Tempo (Net 30)</span>
          {invoiceSummary?.dueThisWeekCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
              {invoiceSummary.dueThisWeekCount} nota jatuh tempo
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: LEMBAR RENCANA BELANJA */}
      {activeTab === 'SHEET' && (
        <div className="space-y-5">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-medium text-slate-500">Estimasi Modal Belanja</span>
              <div className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                Rp {(shoppingData?.summary?.totalEstimatedModal || 0).toLocaleString('id-ID')}
              </div>
              <span className="text-[10px] text-slate-400 mt-1">Berdasarkan HPP terakhir</span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-medium text-slate-500">Total Item Dibelanjakan</span>
              <div className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                {shoppingData?.summary?.totalItems || 0} Macam
              </div>
              <span className="text-[10px] text-slate-400 mt-1">Gabungan stok & pesanan</span>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-800">Stok Menipis / Minum</span>
                <AlertTriangle size={14} className="text-rose-600" />
              </div>
              <div className="text-lg sm:text-xl font-black text-rose-900 mt-1">
                {shoppingData?.summary?.lowStockItemsCount || 0} Part
              </div>
              <span className="text-[10px] text-rose-700 mt-1">Harus segera di-restock</span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-800">Permintaan Pelanggan</span>
                <ClipboardList size={14} className="text-amber-600" />
              </div>
              <div className="text-lg sm:text-xl font-black text-amber-900 mt-1">
                {shoppingData?.summary?.activeRequestsCount || 0} Item
              </div>
              <span className="text-[10px] text-amber-700 mt-1">Menunggu dibeli dari luar</span>
            </div>
          </div>

          {/* Brand Filter Pills */}
          {brandList.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                <Layers size={13} /> Merk:
              </span>
              <button
                onClick={() => setSelectedBrand('ALL')}
                className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 ${
                  selectedBrand === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Semua Merk ({shoppingData?.items?.length || 0})
              </button>
              {brandList.map(b => (
                <button
                  key={b}
                  onClick={() => setSelectedBrand(b)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 ${
                    selectedBrand === b
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {b} ({shoppingData.groupedByBrand[b]?.length || 0})
                </button>
              ))}
            </div>
          )}

          {/* Shopping Checklist Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Checklist Barang Belanjaan
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  ({filteredShoppingItems.length} item)
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Centang item saat belanja di toko grosir / Makassar
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50 font-bold uppercase text-[10px]">
                    <th className="py-3 px-4 w-12 text-center">Beli</th>
                    <th className="py-3 px-4">Nama Suku Cadang</th>
                    <th className="py-3 px-4">Merk / Kategori</th>
                    <th className="py-3 px-3 text-center">Sisa Stok</th>
                    <th className="py-3 px-3 text-center bg-amber-50/50">Target Beli</th>
                    <th className="py-3 px-4 text-right">Est. Modal Satuan</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-4">Lokasi Rak</th>
                    <th className="py-3 px-4">Sumber / Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredShoppingItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        {loading ? 'Memuat daftar belanja...' : 'Tidak ada kebutuhan belanja saat ini. Stok masih aman!'}
                      </td>
                    </tr>
                  ) : (
                    filteredShoppingItems.map((item: any) => {
                      const isChecked = !!checkedItemIds[item.id];
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isChecked ? 'bg-emerald-50/50 text-slate-400 line-through' : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleItemCheck(item.id)}
                              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {item.partName}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                                {item.brand}
                              </span>
                              <span className="text-slate-500 text-[11px]">
                                {item.categoryName}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-slate-600">
                            {item.currentStock} pcs
                            <div className="text-[10px] text-slate-400">Min: {item.minStock}</div>
                          </td>
                          <td className="py-3 px-3 text-center font-black text-amber-900 bg-amber-50/30 text-sm">
                            {item.targetBuyQty} pcs
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-700">
                            Rp {(item.estimatedUnitPrice || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            Rp {(item.estimatedSubtotal || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                            {item.storageLocation}
                          </td>
                          <td className="py-3 px-4">
                            {item.type === 'RESTOCK_MINIMUM' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                                🔴 Stok Limit
                              </span>
                            ) : (
                              <div>
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                                  🟠 Request: {item.customerName || 'Pelanggan'}
                                </span>
                                {item.notes && (
                                  <div className="text-[10px] text-slate-400 mt-0.5">{item.notes}</div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BUKU CATATAN PERMINTAAN KONSUMEN (DEFECTA) */}
      {activeTab === 'REQUESTS' && (
        <div className="space-y-4">
          {/* Controls: Search & Status Filter */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={requestSearch}
                onChange={(e) => setRequestSearch(e.target.value)}
                placeholder="Cari part, merk, nama konsumen..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Search size={15} />
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              {['ALL', 'PENDING', 'IN_PURCHASE_LIST', 'PURCHASED', 'CANCELLED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setRequestStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 ${
                    requestStatusFilter === st
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'ALL'
                    ? 'Semua'
                    : st === 'PENDING'
                    ? 'Menunggu'
                    : st === 'IN_PURCHASE_LIST'
                    ? 'Masuk Rencana'
                    : st === 'PURCHASED'
                    ? 'Sudah Dibeli'
                    : 'Batal'}
                </button>
              ))}
            </div>
          </div>

          {/* Requests Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50 font-bold uppercase text-[10px]">
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Suku Cadang Dicari</th>
                    <th className="py-3 px-4">Merk & Tipe</th>
                    <th className="py-3 px-3 text-center">Jumlah</th>
                    <th className="py-3 px-4">Konsumen Pemesan</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        {loading ? 'Memuat data...' : 'Belum ada catatan permintaan suku cadang.'}
                      </td>
                    </tr>
                  ) : (
                    requests.map((r: any) => {
                      const isLinked = !!r.productId;
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                            {new Date(r.createdAt).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{r.partName}</div>
                            {r.notes && (
                              <div className="text-[11px] text-slate-500 mt-0.5">{r.notes}</div>
                            )}
                            {isLinked && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium mt-1">
                                <CheckCircle2 size={11} /> Terhubung Katalog (ID #{r.productId})
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-800">{r.brand || '-'}</span>
                            <div className="text-[11px] text-slate-500">{r.vehicleType || 'MOTOR'}</div>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-800">
                            {r.requestedQty} pcs
                          </td>
                          <td className="py-3 px-4">
                            {r.customerName ? (
                              <div>
                                <div className="font-semibold text-slate-800 flex items-center gap-1">
                                  <User size={12} className="text-slate-400" />
                                  <span>{r.customerName}</span>
                                </div>
                                {r.customerPhone && (
                                  <a
                                    href={`https://wa.me/${r.customerPhone.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] text-emerald-600 hover:text-emerald-700 flex items-center gap-1 mt-0.5"
                                  >
                                    <Phone size={11} />
                                    <span>{r.customerPhone}</span>
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Umum / Walk-in</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={r.status}
                              onChange={(e) => handleUpdateStatus(r.id, e.target.value)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                r.status === 'PENDING'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : r.status === 'IN_PURCHASE_LIST'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : r.status === 'PURCHASED'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              <option value="PENDING">Menunggu</option>
                              <option value="IN_PURCHASE_LIST">Masuk Rencana</option>
                              <option value="PURCHASED">Sudah Dibeli</option>
                              <option value="CANCELLED">Batal</option>
                            </select>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isLinked && r.status !== 'PURCHASED' && (
                                <button
                                  onClick={() => setConvertTargetRequest(r)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs cursor-pointer"
                                  title="1-Klik daftarkan ke katalog master produk"
                                >
                                  <Sparkles size={12} />
                                  <span>Jadikan Produk</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteRequest(r.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Hapus catatan"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FAKTUR PEMBELIAN & BUKU HUTANG TEMPO (NET 30) */}
      {activeTab === 'INVOICES' && (
        <div className="space-y-5">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-medium text-slate-500">Total Sisa Hutang Supplier</span>
              <div className="text-lg sm:text-xl font-black text-rose-700 mt-1">
                Rp {(invoiceSummary?.totalDebt || 0).toLocaleString('id-ID')}
              </div>
              <span className="text-[10px] text-slate-400 mt-1">
                Dari {invoiceSummary?.totalActiveInvoices || 0} faktur aktif belum lunas
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-amber-800">Jatuh Tempo $\le$ 7 Hari</span>
              <div className="text-lg sm:text-xl font-black text-amber-900 mt-1">
                {invoiceSummary?.dueThisWeekCount || 0} Nota
              </div>
              <span className="text-[10px] font-bold text-amber-700 mt-1">
                Nominal: Rp {(invoiceSummary?.dueThisWeekAmount || 0).toLocaleString('id-ID')}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-rose-800">Lewat Jatuh Tempo (Overdue)</span>
              <div className="text-lg sm:text-xl font-black text-rose-900 mt-1">
                {invoiceSummary?.overdueCount || 0} Nota
              </div>
              <span className="text-[10px] font-bold text-rose-700 mt-1">
                Wajib segera dilunasi: Rp {(invoiceSummary?.overdueAmount || 0).toLocaleString('id-ID')}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-emerald-800">Terbayar Bulan Ini</span>
              <div className="text-lg sm:text-xl font-black text-emerald-900 mt-1">
                Rp {(invoiceSummary?.paidThisMonthAmount || 0).toLocaleString('id-ID')}
              </div>
              <span className="text-[10px] text-emerald-600 mt-1">
                {invoiceSummary?.paidThisMonthCount || 0} transaksi pelunasan
              </span>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <input
                  type="text"
                  placeholder="Cari no. faktur / supplier..."
                  value={invoiceSearch}
                  onChange={e => setInvoiceSearch(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              </div>

              <select
                value={invoiceStatusFilter}
                onChange={e => setInvoiceStatusFilter(e.target.value)}
                className="h-9 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:outline-none"
              >
                <option value="ALL">Semua Status</option>
                <option value="UNPAID">Belum Lunas (Unpaid)</option>
                <option value="PARTIAL">Cicilan (Partial)</option>
                <option value="OVERDUE">Jatuh Tempo (Overdue)</option>
                <option value="PAID">Lunas (Paid)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} />
                <span>+ Input Faktur Masuk (Net 30)</span>
              </button>
            </div>
          </div>

          {/* Table Invoices */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="py-3 px-4">No. Faktur & Supplier</th>
                    <th className="py-3 px-4">Tgl Nota & Termin</th>
                    <th className="py-3 px-4">Jatuh Tempo</th>
                    <th className="py-3 px-4">Suku Cadang Masuk</th>
                    <th className="py-3 px-4 text-right">Total Tagihan</th>
                    <th className="py-3 px-4 text-right">Sisa Hutang</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        Belum ada faktur pembelian suku cadang dicatat.
                      </td>
                    </tr>
                  ) : (
                    invoices.map(inv => {
                      const dueDate = new Date(inv.dueDate);
                      const now = new Date();
                      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                      const isExpanded = expandedInvoiceId === inv.id;

                      let dueBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      let dueLabel = `${diffDays} hari lagi`;

                      if (inv.remainingAmount <= 0) {
                        dueBadgeClass = 'bg-slate-100 text-slate-500 border-slate-200';
                        dueLabel = 'Lunas';
                      } else if (diffDays < 0) {
                        dueBadgeClass = 'bg-rose-100 text-rose-800 border-rose-300 font-black animate-pulse';
                        dueLabel = `Overdue ${Math.abs(diffDays)} hari`;
                      } else if (diffDays === 0) {
                        dueBadgeClass = 'bg-amber-100 text-amber-800 border-amber-300 font-black';
                        dueLabel = 'Hari Ini!';
                      } else if (diffDays <= 7) {
                        dueBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
                        dueLabel = `${diffDays} hari lagi`;
                      }

                      return (
                        <React.Fragment key={inv.id}>
                          <tr className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-black text-slate-800 text-xs sm:text-sm">
                                {inv.invoiceNumber}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <Building2 size={11} className="text-slate-400" />
                                {inv.supplier?.name}
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <div className="text-slate-700 font-medium">
                                {new Date(inv.invoiceDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </div>
                              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full inline-block mt-0.5">
                                {inv.paymentTerm.replace('_', ' ')}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <div className="text-slate-700 font-medium">
                                {dueDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </div>
                              <span className={`text-[10px] px-2 py-0.5 rounded-md border inline-block mt-0.5 ${dueBadgeClass}`}>
                                {dueLabel}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <button
                                onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                              >
                                <span>{inv.items?.length || 0} Macam Part</span>
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </button>
                            </td>

                            <td className="py-3 px-4 text-right font-bold text-slate-700">
                              Rp {(inv.totalAmount || 0).toLocaleString('id-ID')}
                            </td>

                            <td className="py-3 px-4 text-right font-black text-rose-700 text-xs sm:text-sm">
                              Rp {(inv.remainingAmount || 0).toLocaleString('id-ID')}
                            </td>

                            <td className="py-3 px-4 text-center">
                              {inv.status === 'PAID' ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  LUNAS
                                </span>
                              ) : inv.status === 'PARTIAL' ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                                  CICILAN
                                </span>
                              ) : inv.isOverdue ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                  OVERDUE
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                  BELUM LUNAS
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {inv.remainingAmount > 0 && (
                                  <button
                                    onClick={() => {
                                      setSelectedInvoiceForPay(inv);
                                      setShowPaymentModal(true);
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                                  >
                                    <DollarSign size={13} />
                                    <span>Bayar</span>
                                  </button>
                                )}

                                {inv.paidAmount === 0 && (
                                  <button
                                    onClick={async () => {
                                      if (confirm(`Yakin ingin membatalkan faktur #${inv.invoiceNumber}? Stok suku cadang akan dikembalikan.`)) {
                                        try {
                                          const res = await fetch(`/api/bengkel/supplier-invoices/${inv.id}`, {
                                            method: 'DELETE',
                                            headers: { Authorization: `Bearer ${token}` }
                                          });
                                          const data = await res.json();
                                          if (res.ok) {
                                            toast(data.message || 'Faktur berhasil dihapus', 'success');
                                            fetchInvoices();
                                            fetchInvoiceSummary();
                                          } else {
                                            toast(data.error || 'Gagal menghapus faktur', 'error');
                                          }
                                        } catch (e) {
                                          toast('Terjadi kesalahan', 'error');
                                        }
                                      }
                                    }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Batalkan & Rollback Stok"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* EXPANDED ROW: RINCIAN SUKU CADANG MASUK & RIWAYAT PEMBAYARAN */}
                          {isExpanded && (
                            <tr className="bg-slate-50/80">
                              <td colSpan={8} className="p-4 border-y border-slate-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                  {/* Rincian Part */}
                                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                                    <h5 className="font-bold text-slate-700 mb-2 flex items-center gap-1">
                                      <Package size={14} className="text-amber-600" />
                                      Rincian Suku Cadang dalam Nota:
                                    </h5>
                                    <ul className="divide-y divide-slate-100">
                                      {inv.items?.map((it: any) => (
                                        <li key={it.id} className="py-1.5 flex justify-between">
                                          <span>{it.partName} <span className="text-slate-400 font-bold">x{it.qty}</span></span>
                                          <span className="font-bold text-slate-700">Rp {(it.subtotal || 0).toLocaleString('id-ID')}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>

                                  {/* Riwayat Pembayaran */}
                                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                                    <h5 className="font-bold text-slate-700 mb-2 flex items-center gap-1">
                                      <DollarSign size={14} className="text-emerald-600" />
                                      Riwayat Cicilan / Pembayaran:
                                    </h5>
                                    {(!inv.payments || inv.payments.length === 0) ? (
                                      <p className="text-slate-400 italic text-[11px]">Belum ada pembayaran dicatat.</p>
                                    ) : (
                                      <ul className="divide-y divide-slate-100">
                                        {inv.payments.map((p: any) => (
                                          <li key={p.id} className="py-1.5 flex justify-between items-center">
                                            <div>
                                              <span className="font-bold text-emerald-700 block">Rp {(p.amount || 0).toLocaleString('id-ID')}</span>
                                              <span className="text-[10px] text-slate-400">
                                                {new Date(p.paymentDate).toLocaleDateString('id-ID')} • {p.paymentMethod} {p.referenceNo ? `(${p.referenceNo})` : ''}
                                              </span>
                                            </div>
                                            {p.notes && <span className="text-[10px] text-slate-500 italic max-w-[150px] truncate">{p.notes}</span>}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Catat Permintaan */}
      <PartRequestModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          fetchPartRequests();
          if (activeTab === 'SHEET') fetchShoppingSheet();
        }}
      />

      {/* Modal 1-Klik Konversi Produk Baru */}
      <ConvertToProductModal
        isOpen={!!convertTargetRequest}
        onClose={() => setConvertTargetRequest(null)}
        partRequest={convertTargetRequest}
        onSuccess={() => {
          fetchPartRequests();
          if (activeTab === 'SHEET') fetchShoppingSheet();
        }}
      />

      {/* Modal Input Faktur Masuk (Net 30) */}
      <SupplierInvoiceModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        onSuccess={() => {
          fetchInvoices();
          fetchInvoiceSummary();
        }}
      />

      {/* Modal Bayar / Cicil Hutang Nota */}
      <SupplierPaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedInvoiceForPay(null);
        }}
        invoice={selectedInvoiceForPay}
        onSuccess={() => {
          fetchInvoices();
          fetchInvoiceSummary();
        }}
      />
    </div>
  );
};

export default BengkelProcurementView;
