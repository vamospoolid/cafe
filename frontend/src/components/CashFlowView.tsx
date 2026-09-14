import React, { useState, useEffect, useContext, useMemo } from 'react';
import { 
  DollarSign, Plus, ArrowUpRight, ArrowDownRight, Wallet, 
  FileText, Filter, Tag, Layers, Search, Utensils, Coffee, Box, Zap, Users, Wrench, User, RotateCcw, Eye
} from 'lucide-react';
import CashFlowModal from './CashFlowModal';
import { POSContext } from '../context/POSContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const CashFlowView = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cashflows, setCashflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [selectedMainCat, setSelectedMainCat] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const posContext = useContext(POSContext);

  const formatCurrency = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;
  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.toLocaleDateString('id-ID')} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const fetchCashflow = async () => {
    setLoading(true);
    try {
      let url = '/api/cashflow';
      if (filterType) url += `?type=${filterType}`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${posContext?.token}` } });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setCashflows(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (posContext?.token) fetchCashflow();
  }, [posContext?.token, filterType]);

  const handleSave = async (data: any) => {
    try {
      const res = await fetch('/api/cashflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${posContext?.token}` },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchCashflow();
      }
    } catch (err) { console.error(err); }
  };

  // Helper to parse category string "Main Category - Sub Category" or just "Category"
  const parseCategory = (catStr: string) => {
    if (!catStr) return { main: 'Umum', sub: '' };
    const parts = catStr.split(' - ');
    if (parts.length > 1) {
      return { main: parts[0].trim(), sub: parts.slice(1).join(' - ').trim() };
    }
    return { main: catStr.trim(), sub: '' };
  };

  // Filtered cashflows based on Main Category and Search Query
  const filteredCashflows = useMemo(() => {
    return cashflows.filter(cf => {
      const { main, sub } = parseCategory(cf.category);
      if (selectedMainCat !== 'ALL') {
        const mainLower = main.toLowerCase();
        const selLower = selectedMainCat.toLowerCase();
        if (!mainLower.includes(selLower) && !selLower.includes(mainLower)) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = cf.description?.toLowerCase().includes(q);
        const matchCat = cf.category?.toLowerCase().includes(q);
        const matchUser = cf.user?.name?.toLowerCase().includes(q);
        if (!matchDesc && !matchCat && !matchUser) return false;
      }
      return true;
    });
  }, [cashflows, selectedMainCat, searchQuery]);

  const totalIn = cashflows.filter(c => c.type === 'Pemasukan').reduce((acc, c) => acc + c.amount, 0);
  const totalOut = cashflows.filter(c => c.type === 'Pengeluaran').reduce((acc, c) => acc + c.amount, 0);
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
      if (main.includes('Makanan')) map['Bahan Makanan'] += cf.amount;
      else if (main.includes('Minuman')) map['Bahan Minuman'] += cf.amount;
      else if (main.includes('Kemasan')) map['Kemasan & Packaging'] += cf.amount;
      else if (main.includes('Operasional')) map['Operasional Cafe'] += cf.amount;
      else if (main.includes('SDM') || main.includes('Gaji') || main.includes('Karyawan')) map['SDM & Karyawan'] += cf.amount;
      else map['Lainnya'] += cf.amount;
    });

    return map;
  }, [cashflows]);

  const exportPDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN BUKU KAS & ARUS KAS (PETTY CASH)', 14, 15);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tanggal Cetak : ${new Date().toLocaleString('id-ID')}`, 14, 22);
    doc.text(`Filter Kategori : ${selectedMainCat === 'ALL' ? 'Semua Kategori' : selectedMainCat} | Jenis: ${filterType || 'Semua'}`, 14, 27);

    const tableColumn = ["Tanggal", "Jenis", "Kategori Utama", "Sub Kategori", "Keterangan", "Nominal", "Kasir"];
    const tableRows: any[] = [];

    filteredCashflows.forEach((cf) => {
      const { main, sub } = parseCategory(cf.category);
      tableRows.push([
        formatDate(cf.date),
        cf.type,
        main,
        sub || '-',
        cf.description,
        cf.type === 'Pemasukan' ? `+${formatCurrency(cf.amount)}` : `-${formatCurrency(cf.amount)}`,
        cf.user?.name || '-'
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 32,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      columnStyles: {
        5: { halign: 'right', fontStyle: 'bold' }
      }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 40;
    
    // Summary Box
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Ringkasan Arus Kas:', 14, finalY + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Total Pemasukan (In)   : ${formatCurrency(totalIn)}`, 14, finalY + 16);
    doc.text(`Total Pengeluaran (Out) : ${formatCurrency(totalOut)}`, 14, finalY + 21);
    doc.setFont('helvetica', 'bold');
    doc.text(`Saldo Kas Bersih       : ${formatCurrency(balance)}`, 14, finalY + 27);

    doc.save(`Laporan_Kas_${Date.now()}.pdf`);
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
    <div className="p-3.5 sm:p-5 pb-32 sm:pb-8 h-full flex flex-col bg-slate-50 overflow-y-auto space-y-3.5 sm:space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200/80 shadow-sm shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-primary shadow-inner">
            <DollarSign size={20} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Arus Kas & Pembelanjaan</h2>
            <p className="text-[11px] text-gray-500">Pencatatan pembelanjaan bahan baku, operasional, & kas non-POS</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            className="flex-1 sm:flex-none py-2 px-3 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all" 
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

      {/* Main KPI Stats Cards - Compact Design */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
        <div className="p-3 sm:p-3.5 rounded-xl border-l-4 border-emerald-500 shadow-sm bg-white flex items-center justify-between border border-gray-200/80">
          <div>
            <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Total Pemasukan (In)</div>
            <div className="text-lg sm:text-xl font-black text-emerald-600 tracking-tight">{formatCurrency(totalIn)}</div>
            <div className="text-[10px] text-gray-400">Modal & kas masuk luar POS</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <ArrowDownRight size={18} />
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl border-l-4 border-rose-500 shadow-sm bg-white flex items-center justify-between border border-gray-200/80">
          <div>
            <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Total Pengeluaran (Out)</div>
            <div className="text-lg sm:text-xl font-black text-rose-600 tracking-tight">{formatCurrency(totalOut)}</div>
            <div className="text-[10px] text-gray-400">Belanja bahan baku & operasional</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <ArrowUpRight size={18} />
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl border-l-4 border-indigo-500 shadow-sm bg-indigo-50/70 border border-indigo-200 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Saldo Kas Bersih</div>
            <div className={`text-lg sm:text-xl font-black tracking-tight ${balance >= 0 ? 'text-indigo-900' : 'text-rose-600'}`}>
              {formatCurrency(balance)}
            </div>
            <div className="text-[10px] text-indigo-600/80">Pemasukan dikurangi Pengeluaran</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
            <Wallet size={18} />
          </div>
        </div>
      </div>

      {/* Category Expense Breakdown Cards - Compact Filter Bar */}
      <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-gray-200/80 shadow-sm space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
            <Layers size={14} className="text-indigo-600" />
            <span>Distribusi Belanja Kategori</span>
            <span className="text-[10px] text-gray-400 font-normal">(Klik kategori untuk filter cepat)</span>
          </div>
          <span className="text-xs text-gray-600 font-bold">Total Belanja: {formatCurrency(totalOut)}</span>
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

      {/* Main Table / Mobile Cards with Search & Filters */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm flex flex-col overflow-hidden">
        {/* Table Title & Filter Toolbar */}
        <div className="p-3.5 sm:p-4 border-b border-gray-200 bg-slate-50/70 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-1.5">
              <span>📋 Rincian Catatan Transaksi Kas</span>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                {filteredCashflows.length} Data
              </span>
            </h3>
            {selectedMainCat !== 'ALL' && (
              <button 
                onClick={() => setSelectedMainCat('ALL')}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 font-bold underline"
              >
                Reset Filter ({selectedMainCat})
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select 
              className="text-xs py-1.5 px-2.5 bg-white font-semibold text-gray-700 border border-gray-300 rounded-lg shadow-sm outline-none cursor-pointer"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
              <option value="">Semua (In & Out)</option>
              <option value="Pemasukan">Pemasukan (In)</option>
              <option value="Pengeluaran">Pengeluaran (Out)</option>
            </select>

            <select
              className="text-xs py-1.5 px-2.5 bg-white font-semibold text-gray-700 border border-gray-300 rounded-lg shadow-sm outline-none cursor-pointer"
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
            <div className="relative flex-1 sm:w-56">
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                className="w-full text-xs pl-8 pr-2.5 py-1.5 bg-white border border-gray-300 rounded-lg shadow-sm outline-none"
                placeholder="Cari keterangan, kasir..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3"></div>
            Memuat data arus kas...
          </div>
        ) : filteredCashflows.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <FileText size={40} className="mx-auto text-gray-300 mb-2" />
            <div className="font-bold text-gray-600 text-sm">Tidak Ada Catatan Kas Yang Sesuai Filter</div>
            <p className="text-xs text-gray-400 mt-1">Coba ganti filter kategori atau klik tombol "+ Catat Kas" untuk menambah pengeluaran baru.</p>
          </div>
        ) : (
          <>
            {/* Mobile Cards List (< md) */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredCashflows.map((cf) => {
                const { main, sub } = parseCategory(cf.category);
                return (
                  <div key={cf.id} className="p-3.5 space-y-2 hover:bg-slate-50 transition-colors">
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

                      <div className="text-right">
                        <div className={`font-black text-sm ${cf.type === 'Pemasukan' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {cf.type === 'Pemasukan' ? '+' : '-'}{formatCurrency(cf.amount)}
                        </div>
                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          cf.type === 'Pemasukan' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {cf.type === 'Pemasukan' ? <ArrowDownRight size={11} /> : <ArrowUpRight size={11} />}
                          {cf.type}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-700 font-medium line-clamp-2 bg-slate-50/90 p-2 rounded-lg border border-gray-100">
                      {cf.description}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-gray-400 pt-0.5">
                      <span>{formatDate(cf.date)}</span>
                      <span className="flex items-center gap-1 font-semibold text-gray-600">
                        <User size={11} /> {cf.user?.name || 'Staff'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-gray-200 text-xs font-black text-gray-600 uppercase tracking-wider">
                    <th className="py-3 px-4">TANGGAL</th>
                    <th className="py-3 px-4">JENIS</th>
                    <th className="py-3 px-4">KATEGORI BELANJA</th>
                    <th className="py-3 px-4">RINCIAN KETERANGAN</th>
                    <th className="py-3 px-4 text-right">NOMINAL</th>
                    <th className="py-3 px-4 text-center">PENCATAT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredCashflows.map((cf, idx) => {
                    const { main, sub } = parseCategory(cf.category);
                    return (
                      <tr key={cf.id} className={`hover:bg-indigo-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                        <td className="py-3 px-4 text-xs font-medium text-gray-600 whitespace-nowrap">{formatDate(cf.date)}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {cf.type === 'Pemasukan' ? (
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
                          <p className="line-clamp-2" title={cf.description}>{cf.description}</p>
                        </td>
                        <td className={`py-3 px-4 text-right font-black text-sm tracking-tight whitespace-nowrap ${cf.type === 'Pemasukan' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {cf.type === 'Pemasukan' ? '+' : '-'}{formatCurrency(cf.amount)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className="text-xs bg-gray-100 text-gray-700 font-semibold px-2 py-1 rounded-md">
                            {cf.user?.name || 'Staff'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <CashFlowModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} />
    </div>
  );
};

export default CashFlowView;
