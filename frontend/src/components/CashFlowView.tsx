import React, { useState, useEffect, useContext, useMemo } from 'react';
import { 
  DollarSign, Plus, ArrowUpRight, ArrowDownRight, Wallet, Download, 
  FileText, Filter, Tag, Layers, Search, Utensils, Coffee, Box, Zap, Users, Wrench
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
      if (selectedMainCat !== 'ALL' && !main.toLowerCase().includes(selectedMainCat.toLowerCase())) {
        return false;
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
      else if (main.includes('SDM') || main.includes('Gaji')) map['SDM & Karyawan'] += cf.amount;
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

  const totalIn = cashflows.filter(c => c.type === 'Pemasukan').reduce((acc, c) => acc + c.amount, 0);
  const totalOut = cashflows.filter(c => c.type === 'Pengeluaran').reduce((acc, c) => acc + c.amount, 0);
  const balance = totalIn - totalOut;

  const categoryIcons: Record<string, any> = {
    'Bahan Makanan': <Utensils size={14} className="text-amber-500" />,
    'Bahan Minuman': <Coffee size={14} className="text-orange-500" />,
    'Kemasan & Packaging': <Box size={14} className="text-blue-500" />,
    'Operasional Cafe': <Zap size={14} className="text-purple-500" />,
    'SDM & Karyawan': <Users size={14} className="text-emerald-500" />,
    'Perawatan & Aset': <Wrench size={14} className="text-slate-500" />
  };

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50 overflow-y-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-primary shadow-inner">
              <DollarSign size={22} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Arus Kas & Pembelanjaan</h2>
              <p className="text-xs text-muted">Pencatatan pembelanjaan bahan baku, operasional, SDM, dan kas non-POS</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button className="btn bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 shadow-sm" onClick={exportPDF}>
             <FileText size={16} className="text-rose-500" /> 
             <span>Export PDF</span>
          </button>
          <button className="btn btn-primary flex items-center gap-1.5 shadow-md shadow-indigo-200" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> 
            <span>Catat Transaksi Kas</span>
          </button>
        </div>
      </div>

      {/* Main KPI Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card flex items-center justify-between p-5 border-l-4 border-emerald-500 shadow-sm bg-white hover:shadow transition-shadow">
          <div>
            <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">Total Pemasukan (In)</div>
            <div className="text-2xl font-black text-emerald-600 tracking-tight">{formatCurrency(totalIn)}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">Kas masuk dari modal & pendapatan luar</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <ArrowDownRight size={24} />
          </div>
        </div>

        <div className="card flex items-center justify-between p-5 border-l-4 border-rose-500 shadow-sm bg-white hover:shadow transition-shadow">
          <div>
            <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider mb-1">Total Pengeluaran (Out)</div>
            <div className="text-2xl font-black text-rose-600 tracking-tight">{formatCurrency(totalOut)}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">Belanja bahan baku, operasional & SDM</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <ArrowUpRight size={24} />
          </div>
        </div>

        <div className="card flex items-center justify-between p-5 border-l-4 border-indigo-500 shadow-sm bg-indigo-50/70 border border-indigo-100 hover:shadow transition-shadow">
          <div>
            <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">Saldo Kas Bersih</div>
            <div className={`text-2xl font-black tracking-tight ${balance >= 0 ? 'text-indigo-900' : 'text-rose-600'}`}>
              {formatCurrency(balance)}
            </div>
            <div className="text-[11px] text-indigo-600/80 mt-0.5">Pemasukan dikurangi Pengeluaran</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <Wallet size={24} />
          </div>
        </div>
      </div>

      {/* Category Expense Breakdown Cards */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <Layers size={16} className="text-indigo-600" />
            Distribusi Belanja Berdasarkan Kategori
          </h3>
          <span className="text-xs text-gray-500">Total Belanja: {formatCurrency(totalOut)}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div 
            onClick={() => setSelectedMainCat(selectedMainCat === 'Makanan' ? 'ALL' : 'Makanan')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              selectedMainCat === 'Makanan' ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-200' : 'bg-slate-50 border-gray-200/70 hover:bg-slate-100/70'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 mb-1">
              <Utensils size={14} className="text-amber-600" /> Makanan
            </div>
            <div className="text-sm font-black text-gray-900">{formatCurrency(expenseBreakdown['Bahan Makanan'])}</div>
          </div>

          <div 
            onClick={() => setSelectedMainCat(selectedMainCat === 'Minuman' ? 'ALL' : 'Minuman')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              selectedMainCat === 'Minuman' ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-200' : 'bg-slate-50 border-gray-200/70 hover:bg-slate-100/70'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-orange-800 mb-1">
              <Coffee size={14} className="text-orange-600" /> Minuman
            </div>
            <div className="text-sm font-black text-gray-900">{formatCurrency(expenseBreakdown['Bahan Minuman'])}</div>
          </div>

          <div 
            onClick={() => setSelectedMainCat(selectedMainCat === 'Kemasan' ? 'ALL' : 'Kemasan')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              selectedMainCat === 'Kemasan' ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200' : 'bg-slate-50 border-gray-200/70 hover:bg-slate-100/70'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800 mb-1">
              <Box size={14} className="text-blue-600" /> Kemasan
            </div>
            <div className="text-sm font-black text-gray-900">{formatCurrency(expenseBreakdown['Kemasan & Packaging'])}</div>
          </div>

          <div 
            onClick={() => setSelectedMainCat(selectedMainCat === 'Operasional' ? 'ALL' : 'Operasional')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              selectedMainCat === 'Operasional' ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-200' : 'bg-slate-50 border-gray-200/70 hover:bg-slate-100/70'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-800 mb-1">
              <Zap size={14} className="text-purple-600" /> Operasional
            </div>
            <div className="text-sm font-black text-gray-900">{formatCurrency(expenseBreakdown['Operasional Cafe'])}</div>
          </div>

          <div 
            onClick={() => setSelectedMainCat(selectedMainCat === 'SDM' ? 'ALL' : 'SDM')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              selectedMainCat === 'SDM' ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200' : 'bg-slate-50 border-gray-200/70 hover:bg-slate-100/70'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 mb-1">
              <Users size={14} className="text-emerald-600" /> SDM / Gaji
            </div>
            <div className="text-sm font-black text-gray-900">{formatCurrency(expenseBreakdown['SDM & Karyawan'])}</div>
          </div>

          <div 
            onClick={() => setSelectedMainCat(selectedMainCat === 'Lainnya' ? 'ALL' : 'Lainnya')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              selectedMainCat === 'Lainnya' ? 'bg-slate-200 border-slate-400 ring-2 ring-slate-300' : 'bg-slate-50 border-gray-200/70 hover:bg-slate-100/70'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
              <Tag size={14} className="text-slate-500" /> Lainnya
            </div>
            <div className="text-sm font-black text-gray-900">{formatCurrency(expenseBreakdown['Lainnya'])}</div>
          </div>
        </div>
      </div>

      {/* Main Table Card with Search & Filters */}
      <div className="card flex-1 flex flex-col p-0 overflow-hidden shadow-sm bg-white rounded-2xl border border-gray-200/80">
        <div className="p-4 border-b border-gray-200 bg-gray-50/80 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          {/* Category Filter Pills & Type Select */}
          <div className="flex flex-wrap items-center gap-2">
            <select 
              className="form-control text-xs py-1.5 px-3 h-auto bg-white font-semibold text-gray-700 border-gray-300 rounded-lg shadow-sm"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
              <option value="">Semua Transaksi (In & Out)</option>
              <option value="Pemasukan">Hanya Pemasukan (In)</option>
              <option value="Pengeluaran">Hanya Pengeluaran (Out)</option>
            </select>

            <select
              className="form-control text-xs py-1.5 px-3 h-auto bg-white font-semibold text-gray-700 border-gray-300 rounded-lg shadow-sm"
              value={selectedMainCat}
              onChange={e => setSelectedMainCat(e.target.value)}
            >
              <option value="ALL">Semua Kategori Utama</option>
              <option value="Makanan">Bahan Makanan</option>
              <option value="Minuman">Bahan Minuman</option>
              <option value="Kemasan">Kemasan & Packaging</option>
              <option value="Operasional">Operasional Cafe</option>
              <option value="SDM">SDM & Tenaga Kerja</option>
              <option value="Perawatan">Perawatan & Aset</option>
              <option value="Modal">Modal / Non-POS</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              className="form-control text-xs pl-9 pr-3 py-1.5 bg-white border-gray-300 rounded-lg shadow-sm"
              placeholder="Cari keterangan, kategori, kasir..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive p-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3"></div>
              Memuat data arus kas...
            </div>
          ) : filteredCashflows.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <FileText size={36} className="mx-auto text-gray-300 mb-2" />
              Tidak ada catatan arus kas yang sesuai filter.
            </div>
          ) : (
            <table className="data-table w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
                  <th className="py-3 px-4">TANGGAL</th>
                  <th className="py-3 px-4">JENIS</th>
                  <th className="py-3 px-4">KATEGORI BELANJA</th>
                  <th className="py-3 px-4">RINCIAN KETERANGAN</th>
                  <th className="py-3 px-4 text-right">NOMINAL</th>
                  <th className="py-3 px-4 text-center">PENCATAT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredCashflows.map((cf) => {
                  const { main, sub } = parseCategory(cf.category);
                  return (
                    <tr key={cf.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-xs font-medium text-gray-600">{formatDate(cf.date)}</td>
                      <td className="py-3 px-4">
                        {cf.type === 'Pemasukan' ? (
                          <span className="badge bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 flex items-center gap-1 w-max text-[11px] px-2 py-0.5 rounded-md">
                            <ArrowDownRight size={13} /> IN
                          </span>
                        ) : (
                          <span className="badge bg-rose-50 text-rose-700 font-bold border border-rose-200 flex items-center gap-1 w-max text-[11px] px-2 py-0.5 rounded-md">
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
                      <td className="py-3 px-4 text-xs text-gray-700 font-normal max-w-[280px]">
                        <p className="line-clamp-2" title={cf.description}>{cf.description}</p>
                      </td>
                      <td className={`py-3 px-4 text-right font-black text-sm tracking-tight ${cf.type === 'Pemasukan' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {cf.type === 'Pemasukan' ? '+' : '-'}{formatCurrency(cf.amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-xs bg-gray-100 text-gray-700 font-semibold px-2 py-1 rounded-md">
                          {cf.user?.name || 'Staff'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CashFlowModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} />
    </div>
  );
};

export default CashFlowView;
