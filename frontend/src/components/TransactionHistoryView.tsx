import React, { useState, useEffect, useContext } from 'react';
import { History, Search, RotateCcw, Printer, Filter, ShoppingCart, DollarSign, BarChart2, User, XCircle, Download, FileText, Zap, Eye, Calendar } from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import ReceiptPrinter from './ReceiptPrinter';
import OrderDetailModal from './OrderDetailModal';
import { exportFinancialPDF } from '../utils/pdfGenerator';
import { getTodayStr, getYesterdayStr, getLast7DaysRange, getThisMonthRange, formatLocalDate } from '../utils/dateUtils';
import { toast, confirmAlert, errorAlert } from '../utils/alert';

const TransactionHistoryView = () => {
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [printOrder, setPrintOrder] = useState<any>(null);
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<any>(null);
  
  // Filter States: Default to 'today'
  const [preset, setPreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all'>('today');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const posContext = useContext(POSContext);
  const [printLoading, setPrintLoading] = useState<number | null>(null);

  const handleSelectPreset = (newPreset: 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all') => {
    setPreset(newPreset);
    if (newPreset === 'today') {
      const t = getTodayStr();
      setStartDate(t);
      setEndDate(t);
    } else if (newPreset === 'yesterday') {
      const y = getYesterdayStr();
      setStartDate(y);
      setEndDate(y);
    } else if (newPreset === 'week') {
      const r = getLast7DaysRange();
      setStartDate(r.startDate);
      setEndDate(r.endDate);
    } else if (newPreset === 'month') {
      const r = getThisMonthRange();
      setStartDate(r.startDate);
      setEndDate(r.endDate);
    } else if (newPreset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleDirectPrint = async (orderId: number) => {
    if (!posContext?.settings?.printerIp) {
      toast('IP Printer belum dikonfigurasi di menu Pengaturan', 'error');
      return;
    }
    setPrintLoading(orderId);
    try {
      const res = await fetch('/api/printer/receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (res.ok) {
        toast('Struk berhasil dicetak langsung ke printer!', 'success');
      } else {
        toast(data.error || 'Gagal mencetak struk', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan jaringan ke printer', 'error');
    } finally {
      setPrintLoading(null);
    }
  };

  const formatCurrency = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;
  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.toLocaleDateString('id-ID')} ${d.toLocaleTimeString('id-ID')}`;
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let url = '/api/orders';
      const params = new URLSearchParams();
      if (startDate && endDate) {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      } else if (startDate) {
        params.append('date', startDate);
      }
      if (statusFilter) params.append('status', statusFilter);
      params.append('tzOffset', String(new Date().getTimezoneOffset()));
      
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${posContext?.token}` } });
      const data = await res.json();
      if (res.ok) setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (posContext?.token) fetchOrders();
  }, [posContext?.token, startDate, endDate, statusFilter]);

  const handleVoid = async (id: number, orderNumber: string) => {
    if (!posContext?.user?.permissions?.canVoid) {
      toast('Anda tidak memiliki akses untuk membatalkan pesanan (Void).', 'error');
      return;
    }
    const confirmResult = await confirmAlert('Konfirmasi', `Apakah Anda yakin ingin membatalkan transaksi ${orderNumber}? Stok produk akan dikembalikan.`);
    if (!confirmResult.isConfirmed) return;

    try {
      const res = await fetch(`/api/orders/${id}/void`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        toast('Transaksi berhasil dibatalkan (Void).', 'success');
        fetchOrders();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal melakukan void transaksi.', 'error');
      }
    } catch (err) { console.error(err); }
  };

  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q);
  });

  const validOrders = orders.filter(o => o.status !== 'Void');
  const totalSales = validOrders.reduce((sum, o) => sum + o.total, 0);
  const avgSales = validOrders.length > 0 ? totalSales / validOrders.length : 0;

  // EXPORT FUNCTIONS
  const exportPDF = async () => {
    const oldestDate = orders.length > 0 ? orders[orders.length - 1].createdAt.split('T')[0] : getTodayStr();
    const rangeStart = startDate || oldestDate;
    const rangeEnd = endDate || getTodayStr();
    
    await exportFinancialPDF(
      'transactions',
      posContext?.settings || {},
      filteredOrders,
      rangeStart,
      rangeEnd,
      (posContext?.user as any)?.name || 'Admin'
    );
  };

  const exportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredOrders.map(trx => ({
      "No. Transaksi": trx.orderNumber,
      "Tanggal": formatDate(trx.createdAt),
      "Pelanggan": trx.customerName,
      "Kasir": trx.user?.name,
      "Total Penjualan": trx.total,
      "Status": trx.status,
      "Metode Pembayaran": trx.paymentMethod || '-'
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transaksi");
    XLSX.writeFile(workbook, `Laporan_Transaksi_${Date.now()}.xlsx`);
  };

  const handleReset = () => {
    handleSelectPreset('today');
    setStatusFilter('');
    setSearchQuery('');
  };

  return (
    <div 
      className="p-3 sm:p-6 pb-52 sm:pb-20 flex-1 min-h-0 h-full w-full overflow-y-auto bg-slate-50 flex flex-col gap-4"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-slate-900">
            <History className="text-primary" /> Riwayat Transaksi
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Daftar transaksi penjualan dengan sinkronisasi waktu lokal real-time</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="flex-1 sm:flex-initial btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-2 px-3.5 text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 rounded-xl transition-all active:scale-95" onClick={exportPDF}>
            <FileText size={15} className="text-rose-500" /> Export PDF
          </button>
          <button className="flex-1 sm:flex-initial btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-2 px-3.5 text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 rounded-xl transition-all active:scale-95" onClick={exportExcel}>
            <Download size={15} className="text-emerald-600" /> Export Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
        <div className="card flex items-center justify-between p-4 border-l-4 border-primary shadow-sm bg-white rounded-2xl">
          <div>
            <div className="text-2xl font-black text-slate-900">{validOrders.length}</div>
            <div className="text-xs font-semibold text-slate-500">Total Transaksi Sah</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-primary">
            <ShoppingCart size={20} />
          </div>
        </div>
        
        <div className="card flex items-center justify-between p-4 border-l-4 border-success shadow-sm bg-white rounded-2xl">
          <div>
            <div className="text-2xl font-black text-emerald-600">{formatCurrency(totalSales)}</div>
            <div className="text-xs font-semibold text-slate-500">Total Penjualan</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="card flex items-center justify-between p-4 border-l-4 border-indigo-500 shadow-sm bg-white rounded-2xl">
          <div>
            <div className="text-2xl font-black text-indigo-700">{formatCurrency(avgSales)}</div>
            <div className="text-xs font-semibold text-slate-500">Rata-rata Transaksi</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
            <BarChart2 size={20} />
          </div>
        </div>
      </div>

      <div className="card flex-initial md:flex-1 flex flex-col p-0 shadow-sm bg-white rounded-2xl border border-slate-200/80 overflow-hidden shrink-0">
        <div className="border-b border-slate-200">
          <button 
            className="w-full p-3.5 sm:p-4 flex justify-between items-center bg-slate-50/70 hover:bg-slate-100/70 transition-colors"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
          >
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-indigo-700">
              <Filter size={16} /> Filter &amp; Pencarian Transaksi
            </div>
            <span className={`text-xs text-slate-400 transform transition-transform ${isFilterOpen ? 'rotate-180' : ''}`}>▼</span>
          </button>
          
          {isFilterOpen && (
            <div className="p-3.5 sm:p-4 bg-white space-y-3.5 border-t border-slate-100">
              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap mr-1 flex items-center gap-1">
                  <Calendar size={13} /> Periode:
                </span>
                <button 
                  type="button"
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${preset === 'today' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  onClick={() => handleSelectPreset('today')}
                >
                  Hari Ini
                </button>
                <button 
                  type="button"
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${preset === 'yesterday' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  onClick={() => handleSelectPreset('yesterday')}
                >
                  Kemarin
                </button>
                <button 
                  type="button"
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${preset === 'week' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  onClick={() => handleSelectPreset('week')}
                >
                  7 Hari Terakhir
                </button>
                <button 
                  type="button"
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${preset === 'month' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  onClick={() => handleSelectPreset('month')}
                >
                  Bulan Ini
                </button>
                <button 
                  type="button"
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${preset === 'all' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  onClick={() => handleSelectPreset('all')}
                >
                  Semua
                </button>
                <button 
                  type="button"
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${preset === 'custom' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  onClick={() => setPreset('custom')}
                >
                  Kustom ⚙️
                </button>
              </div>

              {/* Filter Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1 border-t border-slate-50">
                {preset === 'custom' ? (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Dari Tanggal</label>
                      <input 
                        type="date" 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20" 
                        value={startDate} 
                        onChange={e => setStartDate(e.target.value)} 
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Sampai Tanggal</label>
                      <input 
                        type="date" 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20" 
                        value={endDate} 
                        onChange={e => setEndDate(e.target.value)} 
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Pilih Tanggal Spesifik</label>
                    <input 
                      type="date" 
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20" 
                      value={startDate} 
                      onChange={e => {
                        setPreset('custom');
                        setStartDate(e.target.value);
                        setEndDate(e.target.value);
                      }} 
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Status Pembayaran</label>
                  <select 
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-primary/20" 
                    value={statusFilter} 
                    onChange={e => setStatusFilter(e.target.value)}
                  >
                    <option value="">Semua Status</option>
                    <option value="Paid">Lunas (Paid)</option>
                    <option value="Pending">Menunggu (Pending)</option>
                    <option value="Void">Dibatalkan (Void)</option>
                  </select>
                </div>

                <div className={preset === 'custom' ? 'sm:col-span-2 md:col-span-1' : 'sm:col-span-2'}>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Cari Spesifik</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                      <input 
                        type="text" 
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20" 
                        placeholder="No. Transaksi / Pelanggan..." 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                      />
                    </div>
                    <button 
                      className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors" 
                      onClick={handleReset}
                      title="Reset Filter ke Hari Ini"
                    >
                      <RotateCcw size={14} /> Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="p-8 text-center text-gray-500">Memuat riwayat transaksi...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-gray-400 font-medium">Tidak ada riwayat transaksi.</div>
        ) : (
          <>
            {/* Mobile Cards View (Visible on Mobile Screens < 640px) */}
            <div className="sm:hidden divide-y divide-slate-100">
              {filteredOrders.map((trx, idx) => (
                <div key={trx.id} className={`p-4 space-y-3 ${trx.status === 'Void' ? 'opacity-60 bg-slate-50/50' : 'bg-white'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400">#{idx + 1}</span>
                      <span className="font-extrabold text-sm text-primary">{trx.orderNumber}</span>
                    </div>
                    {trx.status === 'Void' ? (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 font-bold">VOID</span>
                    ) : trx.status === 'Paid' ? (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold">LUNAS</span>
                    ) : (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-bold">PENDING</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Waktu:</span>
                      <span className="font-medium text-slate-700">{formatDate(trx.createdAt)}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Pelanggan:</span>
                      <span className="font-bold text-slate-800 truncate block">{trx.customerName || 'Tamu'}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Kasir / Metode:</span>
                      <span className="font-medium text-slate-700">{trx.user?.name || '-'} • <span className="text-slate-500">{trx.paymentMethod || '-'}</span></span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Total:</span>
                      <span className="font-black text-sm text-slate-900">{formatCurrency(trx.total)}</span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-50">
                    <button 
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs flex items-center gap-1.5 transition-colors"
                      onClick={() => setSelectedDetailOrder(trx)}
                    >
                      <Eye size={14} /> Rincian
                    </button>
                    <button 
                      className={`px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs flex items-center gap-1.5 transition-colors ${printLoading === trx.id ? 'opacity-60 cursor-not-allowed' : ''}`}
                      onClick={() => handleDirectPrint(trx.id)}
                      disabled={printLoading === trx.id}
                    >
                      <Zap size={14} className={printLoading === trx.id ? 'animate-pulse' : ''} /> Cetak Struk
                    </button>
                    {trx.status !== 'Void' && posContext?.user?.permissions?.canVoid && (
                      <button 
                        className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs flex items-center gap-1.5 transition-colors"
                        onClick={() => handleVoid(trx.id, trx.orderNumber)}
                      >
                        <XCircle size={14} /> Void
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop / Tablet Table View (Visible on Screens >= 640px) */}
            <div className="hidden sm:block table-responsive p-0 overflow-x-auto">
              <table className="data-table w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>NO. TRANSAKSI</th>
                    <th>TANGGAL &amp; WAKTU</th>
                    <th>PELANGGAN</th>
                    <th>KASIR</th>
                    <th>TOTAL</th>
                    <th>STATUS &amp; METODE</th>
                    <th className="text-right">AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((trx, idx) => (
                    <tr key={trx.id} className={trx.status === 'Void' ? 'opacity-50 bg-gray-50' : ''}>
                      <td className="text-muted">{idx + 1}</td>
                      <td className="font-bold text-primary">{trx.orderNumber}</td>
                      <td className="text-sm">{formatDate(trx.createdAt)}</td>
                      <td>
                        <div className="flex items-center gap-1 font-semibold text-gray-800">
                          <User size={14} className="text-gray-400" /> {trx.customerName}
                        </div>
                      </td>
                      <td className="text-sm">{trx.user?.name}</td>
                      <td className="font-bold text-gray-900">{formatCurrency(trx.total)}</td>
                      <td>
                        {trx.status === 'Void' ? (
                          <span className="text-xs px-2 py-1 rounded-md bg-red-100 text-red-700 border border-red-200 font-bold">VOID</span>
                        ) : trx.status === 'Paid' ? (
                          <div className="flex flex-col gap-1 items-start">
                            <span className="text-xs px-2 py-1 rounded-md bg-green-100 text-green-700 border border-green-200 font-bold">LUNAS</span>
                            <span className="text-xs text-muted">{trx.paymentMethod}</span>
                          </div>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-md bg-yellow-100 text-yellow-700 border border-yellow-200 font-bold">PENDING</span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button 
                            className="icon-btn text-indigo-600 bg-indigo-50" 
                            title="Lihat Rincian Pesanan" 
                            onClick={() => setSelectedDetailOrder(trx)}
                          >
                            <Eye size={16}/>
                          </button>
                          <button 
                            className={`icon-btn text-emerald-600 bg-emerald-50 ${printLoading === trx.id ? 'opacity-60 cursor-not-allowed' : ''}`} 
                            title="Cetak Struk Termal Langsung" 
                            onClick={() => handleDirectPrint(trx.id)}
                            disabled={printLoading === trx.id}
                          >
                            <Zap size={16} className={printLoading === trx.id ? 'animate-pulse' : ''} />
                          </button>
                          {trx.status !== 'Void' && posContext?.user?.permissions?.canVoid && (
                            <button className="icon-btn text-red-600 bg-red-50" onClick={() => handleVoid(trx.id, trx.orderNumber)}>
                              <XCircle size={16}/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      
      {/* Detailed Order Bottom Sheet / Modal */}
      {selectedDetailOrder && (
        <OrderDetailModal 
          order={selectedDetailOrder}
          isOpen={Boolean(selectedDetailOrder)}
          onClose={() => setSelectedDetailOrder(null)}
          onDirectPrint={handleDirectPrint}
          onPreviewReceipt={(ord) => setPrintOrder(ord)}
          onVoid={handleVoid}
          canVoid={Boolean(posContext?.user?.permissions?.canVoid)}
          printLoading={printLoading === selectedDetailOrder?.id}
        />
      )}

      {printOrder && <ReceiptPrinter order={printOrder} onClose={() => setPrintOrder(null)} />}
    </div>
  );
};

export default TransactionHistoryView;
