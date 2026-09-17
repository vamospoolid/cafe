import React, { useState, useEffect, useContext, useMemo } from 'react';
import { 
  DollarSign, Plus, ArrowUpRight, ArrowDownRight, Wallet, 
  FileText, Tag, Layers, Search, Utensils, Coffee, Box, Zap, Users, Wrench, User, Calendar, Trash2,
  Filter, RefreshCw
} from 'lucide-react';
import CashFlowModal from './CashFlowModal';
import { POSContext } from '../context/POSContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast, confirmAlert } from '../utils/alert';
import { exportPettyCashPDF } from '../utils/pdfGenerator';

const CashFlowView = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cashflows, setCashflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [selectedMainCat, setSelectedMainCat] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Date Filter State: 'all' | 'today' | 'yesterday' | 'last7' | 'this_month' | 'custom'
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'yesterday' | 'last7' | 'this_month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const posContext = useContext(POSContext);

  const formatCurrency = (val: any) => {
    const num = Number(val) || 0;
    return `Rp ${num.toLocaleString('id-ID')}`;
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '-';
      return `${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return String(isoString);
    }
  };

  const fetchCashflow = async (s?: string, e?: string, type?: string) => {
    setLoading(true);
    try {
      const url = new URL(`${window.location.origin}/api/cashflow`);
      const t = type !== undefined ? type : filterType;
      const start = s !== undefined ? s : startDate;
      const end = e !== undefined ? e : endDate;

      if (t) url.searchParams.set('type', t);
      if (start && end) {
        url.searchParams.set('startDate', start);
        url.searchParams.set('endDate', end);
        url.searchParams.set('tzOffset', (new Date().getTimezoneOffset()).toString());
      }

      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${posContext?.token}` } });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setCashflows(data);
      } else {
        setCashflows([]);
      }
    } catch (err) {
      console.error(err);
      setCashflows([]);
    } finally {
      setLoading(false);
    }
  };

  const setPresetDate = (preset: 'all' | 'today' | 'yesterday' | 'last7' | 'this_month') => {
    setDatePreset(preset);
    const now = new Date();
    let s: Date | null = null;
    let e: Date | null = null;

    if (preset === 'today') {
      s = new Date();
      e = new Date();
    } else if (preset === 'yesterday') {
      s = new Date();
      s.setDate(now.getDate() - 1);
      e = new Date();
      e.setDate(now.getDate() - 1);
    } else if (preset === 'last7') {
      s = new Date();
      s.setDate(now.getDate() - 6);
      e = new Date();
    } else if (preset === 'this_month') {
      s = new Date(now.getFullYear(), now.getMonth(), 1);
      e = new Date();
    }

    const startStr = s ? s.toISOString().split('T')[0] : '';
    const endStr = e ? e.toISOString().split('T')[0] : '';
    setStartDate(startStr);
    setEndDate(endStr);
    fetchCashflow(startStr, endStr, filterType);
  };

  useEffect(() => {
    if (posContext?.token) fetchCashflow(startDate, endDate, filterType);
  }, [posContext?.token, filterType]);

  const handleSave = async (data: any) => {
    try {
      const res = await fetch('/api/cashflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${posContext?.token}` },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        toast('Transaksi kas berhasil dicatat!', 'success');
        setIsModalOpen(false);
        fetchCashflow();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menyimpan transaksi kas', 'error');
      }
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: number) => {
    const c = await confirmAlert('Hapus Catatan Kas', 'Apakah Anda yakin ingin menghapus catatan transaksi kas ini?');
    if (!c.isConfirmed) return;

    try {
      const res = await fetch(`/api/cashflow/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        toast('Catatan kas berhasil dihapus', 'success');
        fetchCashflow();
      }
    } catch (err) { console.error(err); }
  };

  // Helper to parse category string "Main Category - Sub Category" or just "Category"
  const parseCategory = (catStr: any) => {
    if (!catStr || typeof catStr !== 'string') return { main: 'Umum', sub: '' };
    const parts = catStr.split(' - ');
    if (parts.length > 1) {
      return { main: parts[0].trim(), sub: parts.slice(1).join(' - ').trim() };
    }
    return { main: catStr.trim(), sub: '' };
  };

  // Filtered cashflows based on Main Category and Search Query
  const filteredCashflows = useMemo(() => {
    return cashflows.filter(cf => {
      const { main } = parseCategory(cf.category);
      if (selectedMainCat !== 'ALL') {
        const mainLower = (main || '').toLowerCase();
        const selLower = selectedMainCat.toLowerCase();
        if (!mainLower.includes(selLower) && !selLower.includes(mainLower)) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = (cf.description || '').toLowerCase().includes(q);
        const matchCat = (cf.category || '').toLowerCase().includes(q);
        const matchUser = (cf.user?.name || '').toLowerCase().includes(q);
        if (!matchDesc && !matchCat && !matchUser) return false;
      }
      return true;
    });
  }, [cashflows, selectedMainCat, searchQuery]);

  const totalIn = cashflows.filter(c => c.type === 'Pemasukan').reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
  const totalOut = cashflows.filter(c => c.type === 'Pengeluaran').reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
  const balance = totalIn - totalOut;

  // Summary Metrics Breakdown
  const expenseBreakdown = useMemo(() => {
    const map: Record<string, number> = {
      'Bahan Makanan': 0,
      'Bahan Minuman': 0,
      'Kemasan & Packaging': 0,
      'Operasional Cafe': 0,
      'SDM & Karyawan': 0,
      'Lainnya': 0
    };

    cashflows.filter(c => c.type === 'Pengeluaran').forEach(cf => {
      const { main } = parseCategory(cf.category);
      const amt = Number(cf.amount) || 0;
      if (main.includes('Makanan')) map['Bahan Makanan'] += amt;
      else if (main.includes('Minuman')) map['Bahan Minuman'] += amt;
      else if (main.includes('Kemasan')) map['Kemasan & Packaging'] += amt;
      else if (main.includes('Operasional')) map['Operasional Cafe'] += amt;
      else if (main.includes('SDM') || main.includes('Gaji') || main.includes('Karyawan')) map['SDM & Karyawan'] += amt;
      else map['Lainnya'] += amt;
    });

    return map;
  }, [cashflows]);

  const exportPDF = async () => {
    if (filteredCashflows.length === 0) {
      toast('Tidak ada data transaksi kas untuk diekspor.', 'error');
      return;
    }
    try {
      await exportPettyCashPDF(
        filteredCashflows,
        posContext?.settings || { storeName: 'MUKI RAMEN' },
        {
          category: selectedMainCat === 'ALL' ? 'Semua Kategori' : selectedMainCat,
          type: filterType || 'Semua',
          searchQuery: searchQuery
        },
        posContext?.user?.username || 'Administrator'
      );
      toast('Laporan Buku Kas & Arus Kas berhasil diunduh!', 'success');
    } catch (err) {
      console.error('Gagal export PDF kas:', err);
      toast('Terjadi kesalahan saat membuat dokumen PDF.', 'error');
    }
  };

  const categoryIcons: Record<string, any> = {
    'Bahan Makanan': <Utensils size={14} className="text-amber-500" />,
    'Bahan Minuman': <Coffee size={14} className="text-orange-500" />,
    'Kemasan & Packaging': <Box size={14} className="text-blue-500" />,
    'Operasional Cafe': <Zap size={14} className="text-purple-500" />,
    'SDM & Karyawan': <Users size={14} className="text-emerald-500" />,
    'Perawatan & Aset': <Wrench size={14} className="text-slate-500" />
  };

  return (
    <div className="p-3 sm:p-5 pb-52 sm:pb-16 w-full flex flex-col gap-3.5 sm:gap-4">
      {/* 1. Header Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 sm:gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200/80 shadow-sm shrink-0">
        <div className="hidden sm:flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-primary shadow-inner">
            <DollarSign size={22} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Arus Kas & Pembelanjaan (Petty Cash)</h2>
            <p className="text-[11px] text-gray-500">Pencatatan pembelanjaan bahan baku, operasional, & kas masuk luar POS</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            className="flex-1 sm:flex-none py-2 px-3 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95" 
            onClick={exportPDF}
          >
            <FileText size={15} className="text-rose-500" /> 
            <span>Export PDF</span>
          </button>
          <button 
            className="flex-1 sm:flex-none py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-indigo-200 transition-all active:scale-95" 
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={16} /> 
            <span>+ Catat Kas</span>
          </button>
        </div>
      </div>

      {/* Date Range / Period Filter Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Filter size={14} className="text-indigo-600" /> Filter Periode:
          </span>
          {[
            { label: 'Semua Waktu', val: 'all' },
            { label: 'Hari Ini', val: 'today' },
            { label: 'Kemarin', val: 'yesterday' },
            { label: 'Minggu Ini (7 Hari)', val: 'last7' },
            { label: 'Bulan Ini', val: 'this_month' }
          ].map(p => (
            <button
              key={p.val}
              onClick={() => setPresetDate(p.val as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                datePreset === p.val
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Date Pickers */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
            <Calendar size={13} className="text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setDatePreset('custom');
                if (e.target.value && endDate) fetchCashflow(e.target.value, endDate, filterType);
              }}
              className="text-xs bg-transparent font-medium text-slate-700 outline-none"
            />
            <span className="text-xs text-slate-400">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value);
                setDatePreset('custom');
                if (startDate && e.target.value) fetchCashflow(startDate, e.target.value, filterType);
              }}
              className="text-xs bg-transparent font-medium text-slate-700 outline-none"
            />
          </div>

          <button
            onClick={() => fetchCashflow(startDate, endDate, filterType)}
            title="Muat Ulang Data Kas"
            className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center transition-all active:scale-95 shrink-0"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Compact 3-KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
        <div className="p-3 sm:p-3.5 rounded-2xl border-l-4 border-emerald-500 shadow-sm bg-white flex items-center justify-between border border-gray-200/80">
          <div>
            <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Total Pemasukan (In)</div>
            <div className="text-lg sm:text-xl font-black text-emerald-600 tracking-tight">{formatCurrency(totalIn)}</div>
            <div className="text-[10px] text-gray-400">Modal & kas masuk luar POS</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <ArrowDownRight size={20} />
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-2xl border-l-4 border-rose-500 shadow-sm bg-white flex items-center justify-between border border-gray-200/80">
          <div>
            <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Total Pengeluaran (Out)</div>
            <div className="text-lg sm:text-xl font-black text-rose-600 tracking-tight">{formatCurrency(totalOut)}</div>
            <div className="text-[10px] text-gray-400">Belanja bahan baku & operasional</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <ArrowUpRight size={20} />
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-2xl border-l-4 border-indigo-500 shadow-sm bg-indigo-50/70 border border-indigo-200 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Saldo Kas Bersih</div>
            <div className={`text-lg sm:text-xl font-black tracking-tight ${balance >= 0 ? 'text-indigo-900' : 'text-rose-600'}`}>
              {formatCurrency(balance)}
            </div>
            <div className="text-[10px] text-indigo-600/80">Pemasukan dikurangi Pengeluaran</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
            <Wallet size={20} />
          </div>
        </div>
      </div>

      {/* 3. Category Filter Pills */}
      <div className="bg-white p-3 rounded-2xl border border-gray-200/80 shadow-sm space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
            <Layers size={14} className="text-indigo-600" />
            <span>Kategori Belanja</span>
            <span className="text-[10px] text-gray-400 font-normal">(Klik untuk filter cepat)</span>
          </div>
          {selectedMainCat !== 'ALL' && (
            <button 
              onClick={() => setSelectedMainCat('ALL')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline"
            >
              Reset Filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { id: 'Makanan', label: 'Makanan', icon: <Utensils size={12} className="text-amber-600" />, amount: expenseBreakdown['Bahan Makanan'], bg: 'bg-amber-50', border: 'border-amber-400', ring: 'ring-amber-200', text: 'text-amber-800' },
            { id: 'Minuman', label: 'Minuman', icon: <Coffee size={12} className="text-orange-600" />, amount: expenseBreakdown['Bahan Minuman'], bg: 'bg-orange-50', border: 'border-orange-400', ring: 'ring-orange-200', text: 'text-orange-800' },
            { id: 'Kemasan', label: 'Kemasan', icon: <Box size={12} className="text-blue-600" />, amount: expenseBreakdown['Kemasan & Packaging'], bg: 'bg-blue-50', border: 'border-blue-400', ring: 'ring-blue-200', text: 'text-blue-800' },
            { id: 'Operasional', label: 'Operasional', icon: <Zap size={12} className="text-purple-600" />, amount: expenseBreakdown['Operasional Cafe'], bg: 'bg-purple-50', border: 'border-purple-400', ring: 'ring-purple-200', text: 'text-purple-800' },
            { id: 'SDM', label: 'SDM / Gaji', icon: <Users size={12} className="text-emerald-600" />, amount: expenseBreakdown['SDM & Karyawan'], bg: 'bg-emerald-50', border: 'border-emerald-400', ring: 'ring-emerald-200', text: 'text-emerald-800' },
            { id: 'Lainnya', label: 'Lainnya', icon: <Tag size={12} className="text-slate-500" />, amount: expenseBreakdown['Lainnya'], bg: 'bg-slate-100', border: 'border-slate-400', ring: 'ring-slate-300', text: 'text-slate-800' },
          ].map(cat => {
            const isSelected = selectedMainCat === cat.id;
            return (
              <div 
                key={cat.id}
                onClick={() => setSelectedMainCat(isSelected ? 'ALL' : cat.id)}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  isSelected ? `${cat.bg} ${cat.border} ring-2 ${cat.ring} shadow-sm font-bold` : 'bg-slate-50 border-gray-200/70 hover:bg-slate-100/70'
                }`}
              >
                <div className={`flex items-center gap-1 text-[11px] font-bold ${isSelected ? cat.text : 'text-gray-600'} mb-0.5`}>
                  {cat.icon} <span>{cat.label}</span>
                </div>
                <div className="text-xs font-black text-gray-900">{formatCurrency(cat.amount)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Main Transaction Section - shrink-0 with full visibility */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden flex flex-col shrink-0">
        {/* Table & Filter Header */}
        <div className="p-3.5 sm:p-4 border-b border-gray-200 bg-slate-50/80 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-1.5">
              <span>📋 Rincian Riwayat Transaksi Kas</span>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                {filteredCashflows.length} Transaksi
              </span>
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select 
              className="text-xs py-1.5 px-2.5 bg-white font-semibold text-gray-700 border border-gray-300 rounded-lg shadow-sm outline-none cursor-pointer flex-1 sm:flex-none"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
              <option value="">Semua (In & Out)</option>
              <option value="Pemasukan">Pemasukan (In)</option>
              <option value="Pengeluaran">Pengeluaran (Out)</option>
            </select>

            <select
              className="text-xs py-1.5 px-2.5 bg-white font-semibold text-gray-700 border border-gray-300 rounded-lg shadow-sm outline-none cursor-pointer flex-1 sm:flex-none"
              value={selectedMainCat}
              onChange={e => setSelectedMainCat(e.target.value)}
            >
              <option value="ALL">Semua Kategori</option>
              <option value="Makanan">Bahan Makanan</option>
              <option value="Minuman">Bahan Minuman</option>
              <option value="Kemasan">Kemasan & Packaging</option>
              <option value="Operasional">Operasional Cafe</option>
              <option value="SDM">SDM & Gaji</option>
              <option value="Perawatan">Perawatan & Aset</option>
              <option value="Modal">Modal / Non-POS</option>
            </select>

            {/* Search Box */}
            <div className="relative w-full sm:w-48">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                className="w-full text-xs pl-8 pr-2.5 py-1.5 bg-white border border-gray-300 rounded-lg shadow-sm outline-none"
                placeholder="Cari keterangan / kasir..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="p-10 text-center text-gray-500">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            Memuat data kas...
          </div>
        ) : filteredCashflows.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <FileText size={36} className="mx-auto text-gray-300 mb-2" />
            <div className="font-bold text-gray-600 text-sm">Belum Ada Catatan Kas Yang Sesuai Filter</div>
            <p className="text-xs text-gray-400 mt-1">Klik tombol "+ Catat Kas" di atas untuk menambah pengeluaran baru.</p>
          </div>
        ) : (
          <div className="p-0">
            {/* Mobile View: High-Contrast Card List */}
            <div className="sm:hidden divide-y divide-gray-100">
              {filteredCashflows.map((cf, idx) => {
                const { main, sub } = parseCategory(cf.category);
                const isIncome = cf.type === 'Pemasukan';
                const amt = Number(cf.amount) || 0;
                return (
                  <div key={cf.id || idx} className="p-3.5 space-y-2 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          {categoryIcons[main] || <Tag size={13} className="text-gray-400" />}
                          <span className="font-bold text-sm text-gray-900">{main}</span>
                        </div>
                        {sub && (
                          <span className="inline-block mt-0.5 text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 font-semibold">
                            {sub}
                          </span>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div className={`font-black text-sm ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(amt)}
                        </div>
                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isIncome ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {isIncome ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
                          {cf.type || 'Pengeluaran'}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-gray-700 font-medium bg-slate-50 p-2.5 rounded-xl border border-gray-100">
                      {cf.description || '-'}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-400 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} /> {formatDate(cf.date)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 font-semibold text-gray-600">
                          <User size={11} /> {cf.user?.name || 'Staff'}
                        </span>
                        <button 
                          onClick={() => handleDelete(cf.id)}
                          className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50"
                          title="Hapus"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Full Data Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-gray-200 text-xs font-black text-gray-600 uppercase tracking-wider">
                    <th className="py-3 px-4">TANGGAL</th>
                    <th className="py-3 px-4">JENIS</th>
                    <th className="py-3 px-4">KATEGORI BELANJA</th>
                    <th className="py-3 px-4">RINCIAN KETERANGAN</th>
                    <th className="py-3 px-4 text-right">NOMINAL</th>
                    <th className="py-3 px-4 text-center">PENCATAT</th>
                    <th className="py-3 px-4 text-center">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredCashflows.map((cf, idx) => {
                    const { main, sub } = parseCategory(cf.category);
                    const isIncome = cf.type === 'Pemasukan';
                    const amt = Number(cf.amount) || 0;
                    return (
                      <tr key={cf.id || idx} className={`hover:bg-indigo-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                        <td className="py-3 px-4 text-xs font-medium text-gray-600 whitespace-nowrap">{formatDate(cf.date)}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isIncome ? (
                            <span className="bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md">
                              <ArrowDownRight size={13} /> IN
                            </span>
                          ) : (
                            <span className="bg-rose-50 text-rose-700 font-bold border border-rose-200 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md">
                              <ArrowUpRight size={13} /> OUT
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            {categoryIcons[main] || <Tag size={13} className="text-gray-400" />}
                            <span className="font-bold text-gray-900">{main}</span>
                          </div>
                          {sub && (
                            <span className="inline-block mt-0.5 text-xs text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-100 font-medium">
                              {sub}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-800 font-medium max-w-[320px]">
                          <p className="line-clamp-2" title={cf.description}>{cf.description || '-'}</p>
                        </td>
                        <td className={`py-3 px-4 text-right font-black text-sm tracking-tight whitespace-nowrap ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(amt)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className="text-xs bg-gray-100 text-gray-700 font-semibold px-2 py-1 rounded-md">
                            {cf.user?.name || 'Staff'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button 
                            onClick={() => handleDelete(cf.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hapus Transaksi"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <CashFlowModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} />
    </div>
  );
};

export default CashFlowView;
