import React, { useState, useEffect, useContext } from 'react';
import { History, Clock, FileText, CheckCircle, AlertTriangle, Play, Square } from 'lucide-react';
import OpenShiftModal from './OpenShiftModal';
import { POSContext } from '../context/POSContext';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const ShiftHistoryView = () => {
  const [shifts, setShifts] = useState<any[]>([]);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'open' | 'close'>('open');
  const posContext = useContext(POSContext);

  const formatCurrency = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;
  const formatTime = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };
  const formatDate = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('id-ID');
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${posContext?.token}` };
      const [shiftsRes, currentRes] = await Promise.all([
        fetch('/api/shifts', { headers }),
        fetch('/api/shifts/current', { headers })
      ]);

      if (shiftsRes.ok) setShifts(await shiftsRes.json());
      if (currentRes.ok) setActiveShift(await currentRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (posContext?.token) fetchData();
  }, [posContext?.token]);

  const handleOpenShift = () => {
    setModalMode('open');
    setIsModalOpen(true);
  };

  const handleCloseShift = () => {
    setModalMode('close');
    setIsModalOpen(true);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Laporan Riwayat Shift & Rekap Kasir', 14, 15);
    doc.setFontSize(10);
    doc.text(`Dicetak Pada: ${new Date().toLocaleString('id-ID')}`, 14, 22);

    const tableColumn = ["Tanggal", "Kasir", "Jam Buka", "Jam Tutup", "Saldo Awal", "Sistem", "Laci Fisik", "Selisih"];
    const tableRows: any[] = [];

    shifts.forEach((s) => {
      tableRows.push([
        formatDate(s.waktuBuka),
        s.user?.name,
        formatTime(s.waktuBuka),
        formatTime(s.waktuTutup),
        formatCurrency(s.saldoAwal),
        s.saldoSistem ? formatCurrency(s.saldoSistem) : '-',
        s.saldoFisikLaci ? formatCurrency(s.saldoFisikLaci) : '-',
        s.selisih ? formatCurrency(s.selisih) : '-'
      ]);
    });

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 28,
    });
    doc.save(`Laporan_Shift_${Date.now()}.pdf`);
  };

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <History className="text-primary" /> Manajemen Shift & Rekap Kasir
          </h2>
          <p className="text-muted mt-1">Kelola pembukaan dan penutupan shift kasir setiap harinya</p>
        </div>
        <div className="flex gap-3">
          <button className="btn bg-white border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={exportPDF}>
            <FileText size={16} className="text-red-500" /> Export Laporan PDF
          </button>
          {!activeShift ? (
            <button className="btn btn-primary" onClick={handleOpenShift}>
              <Play size={18} /> Buka Shift (Mulai)
            </button>
          ) : (
            <button className="btn bg-danger text-white hover:bg-red-700" onClick={handleCloseShift}>
              <Square size={18} /> Tutup Shift (Akhiri)
            </button>
          )}
        </div>
      </div>

      {activeShift && (
        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl mb-6 flex justify-between items-center shadow-sm">
          <div>
            <h3 className="font-bold text-indigo-800 flex items-center gap-2">
              <Clock size={18} /> Shift Aktif Saat Ini
            </h3>
            <p className="text-sm text-indigo-600 mt-1">Anda sudah membuka shift sejak {formatTime(activeShift.waktuBuka)} dengan saldo awal {formatCurrency(activeShift.saldoAwal)}</p>
          </div>
          <span className="badge bg-indigo-100 text-indigo-700 font-bold border-indigo-300 animate-pulse">BERJALAN</span>
        </div>
      )}

      <div className="card flex-1 flex flex-col p-0 overflow-hidden shadow-sm">
        <div className="table-responsive p-4 flex-1 overflow-y-auto">
          {loading ? (
             <div className="p-8 text-center text-gray-500">Memuat riwayat shift...</div>
          ) : (
            <table className="data-table w-full text-left border-collapse">
              <thead>
                <tr>
                  <th>TANGGAL & WAKTU</th>
                  <th>KASIR</th>
                  <th>SALDO AWAL</th>
                  <th>SALDO SISTEM</th>
                  <th>SALDO FISIK</th>
                  <th>SELISIH (MINUS/LEBIH)</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {shifts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">Tidak ada riwayat shift ditemukan.</td>
                  </tr>
                ) : shifts.map((shift) => (
                  <tr key={shift.id}>
                    <td>
                      <div className="font-bold text-gray-800">{formatDate(shift.waktuBuka)}</div>
                      <div className="text-xs text-muted flex items-center gap-1">
                        <Clock size={12} /> {formatTime(shift.waktuBuka)} - {shift.waktuTutup ? formatTime(shift.waktuTutup) : 'Sekarang'}
                      </div>
                    </td>
                    <td className="font-semibold text-gray-700">{shift.user?.name}</td>
                    <td className="text-gray-600">{formatCurrency(shift.saldoAwal)}</td>
                    <td className="font-bold text-gray-800">
                      {shift.saldoSistem !== null ? formatCurrency(shift.saldoSistem) : '-'}
                    </td>
                    <td className="font-bold text-primary">
                      {shift.saldoFisikLaci !== null ? formatCurrency(shift.saldoFisikLaci) : '-'}
                    </td>
                    <td>
                      {shift.selisih !== null ? (
                        <span className={`font-bold px-2 py-1 rounded text-xs ${
                          shift.selisih === 0 ? 'bg-gray-100 text-gray-600' :
                          shift.selisih > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {shift.selisih > 0 ? '+' : ''}{formatCurrency(shift.selisih)}
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      {shift.status === 'Closed' ? (
                        <span className="badge bg-green-100 text-green-700 flex items-center gap-1 w-max border border-green-200">
                          <CheckCircle size={12} /> Selesai
                        </span>
                      ) : (
                        <span className="badge bg-blue-100 text-blue-700 flex items-center gap-1 w-max border border-blue-200">
                          <Play size={12} /> Aktif
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <OpenShiftModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => {
          fetchData();
          posContext?.fetchActiveShift();
        }} 
        mode={modalMode} 
      />
    </div>
  );
};

export default ShiftHistoryView;
