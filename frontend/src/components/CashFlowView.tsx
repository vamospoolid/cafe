import React, { useState, useEffect, useContext } from 'react';
import { DollarSign, Plus, ArrowUpRight, ArrowDownRight, Wallet, Download, FileText } from 'lucide-react';
import CashFlowModal from './CashFlowModal';
import { POSContext } from '../context/POSContext';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const CashFlowView = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cashflows, setCashflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
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
      if (res.ok) setCashflows(data);
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

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Laporan Arus Kas (Buku Kas)', 14, 15);
    doc.setFontSize(10);
    doc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, 14, 22);

    const tableColumn = ["Tanggal", "Jenis", "Kategori", "Keterangan", "Nominal", "Kasir"];
    const tableRows: any[] = [];

    cashflows.forEach((cf) => {
      tableRows.push([
        formatDate(cf.date),
        cf.type,
        cf.category,
        cf.description,
        cf.type === 'Pemasukan' ? `+${formatCurrency(cf.amount)}` : `-${formatCurrency(cf.amount)}`,
        cf.user?.name || '-'
      ]);
    });

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 25,
    });
    doc.save(`Laporan_Kas_${Date.now()}.pdf`);
  };

  const totalIn = cashflows.filter(c => c.type === 'Pemasukan').reduce((acc, c) => acc + c.amount, 0);
  const totalOut = cashflows.filter(c => c.type === 'Pengeluaran').reduce((acc, c) => acc + c.amount, 0);
  const balance = totalIn - totalOut;

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="text-primary" /> Arus Kas (Buku Kas)
          </h2>
          <p className="text-muted mt-1">Catat dan pantau pengeluaran serta pemasukan di luar transaksi POS</p>
        </div>
        <div className="flex gap-2">
          <button className="btn bg-white border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={exportPDF}>
             <FileText size={16} className="text-red-500" /> Export PDF
          </button>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> Tambah Transaksi
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card flex items-center justify-between p-4 border-l-4 border-success shadow-sm">
          <div>
            <div className="text-2xl font-bold text-success">{formatCurrency(totalIn)}</div>
            <div className="text-sm text-muted">Total Pemasukan</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-success">
            <ArrowDownRight size={20} />
          </div>
        </div>
        <div className="card flex items-center justify-between p-4 border-l-4 border-danger shadow-sm">
          <div>
            <div className="text-2xl font-bold text-danger">{formatCurrency(totalOut)}</div>
            <div className="text-sm text-muted">Total Pengeluaran</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-danger">
            <ArrowUpRight size={20} />
          </div>
        </div>
        <div className="card flex items-center justify-between p-4 border-l-4 border-primary shadow-sm bg-indigo-50">
          <div>
            <div className="text-2xl font-bold text-primary">{formatCurrency(balance)}</div>
            <div className="text-sm text-indigo-700 font-semibold">Saldo Kas Bersih</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-primary">
            <Wallet size={20} />
          </div>
        </div>
      </div>

      <div className="card flex-1 flex flex-col p-0 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <select 
            className="form-control text-sm py-1 h-auto"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="">Semua Transaksi</option>
            <option value="Pemasukan">Pemasukan (In)</option>
            <option value="Pengeluaran">Pengeluaran (Out)</option>
          </select>
        </div>

        <div className="table-responsive p-4 flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Memuat data arus kas...</div>
          ) : (
            <table className="data-table w-full text-left border-collapse">
              <thead>
                <tr>
                  <th>TANGGAL</th>
                  <th>JENIS</th>
                  <th>KATEGORI</th>
                  <th>KETERANGAN</th>
                  <th>NOMINAL</th>
                  <th>OLEH</th>
                </tr>
              </thead>
              <tbody>
                {cashflows.map((cf) => (
                  <tr key={cf.id}>
                    <td className="text-sm">{formatDate(cf.date)}</td>
                    <td>
                      {cf.type === 'Pemasukan' ? (
                        <span className="badge bg-green-100 text-green-700 font-bold border border-green-200 flex items-center gap-1 w-max">
                          <ArrowDownRight size={12} /> IN
                        </span>
                      ) : (
                        <span className="badge bg-red-100 text-red-700 font-bold border border-red-200 flex items-center gap-1 w-max">
                          <ArrowUpRight size={12} /> OUT
                        </span>
                      )}
                    </td>
                    <td className="font-semibold text-gray-800">{cf.category}</td>
                    <td className="text-sm text-gray-600 max-w-[200px] truncate" title={cf.description}>{cf.description}</td>
                    <td className={`font-bold ${cf.type === 'Pemasukan' ? 'text-success' : 'text-danger'}`}>
                      {cf.type === 'Pemasukan' ? '+' : '-'}{formatCurrency(cf.amount)}
                    </td>
                    <td className="text-xs text-muted font-medium">{cf.user?.name}</td>
                  </tr>
                ))}
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
