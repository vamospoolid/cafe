import React, { useState, useEffect, useContext } from 'react';
import { History, Search, RotateCcw, Printer, Filter, ShoppingCart, DollarSign, BarChart2, User, XCircle, Download, FileText, Zap } from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import ReceiptPrinter from './ReceiptPrinter';

import { toast, confirmAlert, errorAlert } from '../utils/alert';
const TransactionHistoryView = () => {
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [printOrder, setPrintOrder] = useState<any>(null);
  
  // Filter States
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const posContext = useContext(POSContext);
  const [printLoading, setPrintLoading] = useState<number | null>(null);

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
      if (dateFilter) params.append('date', dateFilter);
      if (statusFilter) params.append('status', statusFilter);
      
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
  }, [posContext?.token, dateFilter, statusFilter]);

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
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Laporan Riwayat Transaksi', 14, 15);
    doc.setFontSize(10);
    doc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, 14, 22);

    const tableColumn = ["No", "No. Transaksi", "Tanggal", "Pelanggan", "Kasir", "Total", "Status"];
    const tableRows: any[] = [];

    filteredOrders.forEach((trx, idx) => {
      tableRows.push([
        idx + 1,
        trx.orderNumber,
        formatDate(trx.createdAt),
        trx.customerName,
        trx.user?.name,
        formatCurrency(trx.total),
        trx.status
      ]);
    });

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 25,
    });
    doc.save(`Laporan_Transaksi_${Date.now()}.pdf`);
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

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <History className="text-primary" /> Riwayat Transaksi
          </h2>
          <p className="text-muted mt-1">Daftar semua transaksi penjualan yang telah diproses</p>
        </div>
        <div className="flex gap-2">
          <button className="btn bg-white border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={exportPDF}>
            <FileText size={16} className="text-red-500" /> Export PDF
          </button>
          <button className="btn bg-white border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={exportExcel}>
            <Download size={16} className="text-green-600" /> Export Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card flex items-center justify-between p-4 border-l-4 border-primary shadow-sm">
          <div>
            <div className="text-2xl font-bold">{validOrders.length}</div>
            <div className="text-sm text-muted">Total Transaksi Sah</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-primary">
            <ShoppingCart size={20} />
          </div>
        </div>
        
        <div className="card flex items-center justify-between p-4 border-l-4 border-success shadow-sm">
          <div>
            <div className="text-2xl font-bold text-success">{formatCurrency(totalSales)}</div>
            <div className="text-sm text-muted">Total Penjualan</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-success">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="card flex items-center justify-between p-4 border-l-4 border-indigo-500 shadow-sm">
          <div>
            <div className="text-2xl font-bold text-indigo-700">{formatCurrency(avgSales)}</div>
            <div className="text-sm text-muted">Rata-rata Transaksi</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500">
            <BarChart2 size={20} />
          </div>
        </div>
      </div>

      <div className="card flex-1 flex flex-col p-0 overflow-hidden shadow-sm">
        <div className="border-b border-gray-200">
          <button 
            className="w-full p-4 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
          >
            <div className="flex items-center gap-2 font-bold text-primary">
              <Filter size={18} /> Filter Transaksi
            </div>
            <span className={`transform transition-transform ${isFilterOpen ? 'rotate-180' : ''}`}>â–¼</span>
          </button>
          
          {isFilterOpen && (
            <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-4 gap-4 border-t border-gray-100">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Tanggal Transaksi</label>
                <input type="date" className="form-control" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Status Pembayaran</label>
                <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="">Semua Status</option>
                  <option value="Paid">Lunas (Paid)</option>
                  <option value="Pending">Menunggu (Pending)</option>
                  <option value="Void">Dibatalkan (Void)</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-muted mb-1">Cari Spesifik</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input type="text" className="form-control pl-9" placeholder="Cari No. Transaksi atau Nama..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  </div>
                  <button className="btn bg-gray-100 text-gray-700 hover:bg-gray-200 px-4 flex items-center gap-2 whitespace-nowrap" onClick={() => { setDateFilter(''); setStatusFilter(''); setSearchQuery(''); }}>
                    <RotateCcw size={16} /> Reset
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="table-responsive p-4 flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Memuat riwayat transaksi...</div>
          ) : (
            <table className="data-table w-full text-left border-collapse">
              <thead>
                <tr>
                  <th>#</th>
                  <th>NO. TRANSAKSI</th>
                  <th>TANGGAL & WAKTU</th>
                  <th>PELANGGAN</th>
                  <th>KASIR</th>
                  <th>TOTAL</th>
                  <th>STATUS & METODE</th>
                  <th className="text-right">AKSI</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500">Tidak ada riwayat transaksi.</td>
                  </tr>
                ) : filteredOrders.map((trx, idx) => (
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
                        <button className="icon-btn text-blue-600 bg-blue-50" title="Preview / Cetak PDF" onClick={() => setPrintOrder(trx)}><Printer size={16}/></button>
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
          )}
        </div>
      </div>
      
      {printOrder && <ReceiptPrinter order={printOrder} onClose={() => setPrintOrder(null)} />}
    </div>
  );
};

export default TransactionHistoryView;
