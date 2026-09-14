import React, { useState, useEffect, useContext } from 'react';
import { History, Clock, FileText, CheckCircle, Play, Square, Download } from 'lucide-react';
import OpenShiftModal from './OpenShiftModal';
import { POSContext } from '../context/POSContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportShiftSettlementPDF } from '../utils/pdfGenerator';
import { toast } from '../utils/alert';

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

  const handleDownloadShiftSlip = async (shift: any) => {
    try {
      await exportShiftSettlementPDF(
        posContext?.settings || {},
        shift,
        shift.user?.name || 'Kasir'
      );
      toast(`Slip Berita Acara Shift #${shift.id} berhasil diunduh!`, 'success');
    } catch (e) {
      console.error(e);
      toast('Gagal mengunduh Slip Shift', 'error');
    }
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

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 28,
    });
    doc.save(`Laporan_Shift_${Date.now()}.pdf`);
  };

  return (
    <div 
      className="p-3 sm:p-6 pb-32 sm:pb-8 flex-1 min-h-0 h-full w-full overflow-y-auto bg-slate-50 flex flex-col gap-4"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 shrink-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-slate-900">
            <History className="text-primary" /> Riwayat &amp; Rekap Shift Kasir
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Kelola pembukaan dan penutupan shift kasir setiap harinya</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button 
            className="flex-1 sm:flex-initial btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-2.5 px-3.5 text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 rounded-xl transition-all" 
            onClick={exportPDF}
          >
            <FileText size={15} className="text-rose-500" /> Export PDF
          </button>
          {!activeShift ? (
            <button 
              className="flex-1 sm:flex-initial btn btn-primary py-2.5 px-4 text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 rounded-xl transition-all" 
              onClick={handleOpenShift}
            >
              <Play size={16} /> Buka Shift
            </button>
          ) : (
            <button 
              className="flex-1 sm:flex-initial btn bg-rose-600 text-white hover:bg-rose-700 py-2.5 px-4 text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 rounded-xl transition-all" 
              onClick={handleCloseShift}
            >
              <Square size={16} /> Tutup Shift
            </button>
          )}
        </div>
      </div>

      {activeShift && (
        <div className="bg-indigo-50 border border-indigo-200/80 p-4 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 shadow-sm shrink-0">
          <div>
            <h3 className="font-extrabold text-indigo-950 flex items-center gap-2 text-sm">
              <Clock size={16} className="text-indigo-600" /> Shift Aktif Saat Ini
            </h3>
            <p className="text-xs text-indigo-700 mt-0.5">
              Dibuka sejak <span className="font-bold">{formatTime(activeShift.waktuBuka)}</span> • Modal Awal: <span className="font-bold">{formatCurrency(activeShift.saldoAwal)}</span>
            </p>
          </div>
          <span className="self-start sm:self-center px-3 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-black tracking-wider uppercase shadow-sm animate-pulse">
            SEDANG BERJALAN
          </span>
        </div>
      )}

      <div className="card flex-1 flex flex-col p-0 overflow-hidden shadow-sm bg-white rounded-2xl border border-slate-200/80 shrink-0">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium text-xs">Memuat riwayat shift...</div>
        ) : shifts.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium text-xs">Tidak ada riwayat shift ditemukan.</div>
        ) : (
          <>
            {/* Mobile Cards View (< 640px) */}
            <div className="sm:hidden divide-y divide-slate-100">
              {shifts.map((shift) => (
                <div key={shift.id} className="p-4 space-y-3 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-extrabold text-sm text-slate-900">{shift.user?.name || 'Kasir'}</div>
                      <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                        <Clock size={12} className="text-slate-400" /> {formatDate(shift.waktuBuka)} ({formatTime(shift.waktuBuka)} - {shift.waktuTutup ? formatTime(shift.waktuTutup) : 'Aktif'})
                      </div>
                    </div>
                    {shift.status === 'Closed' ? (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold flex items-center gap-1">
                        <CheckCircle size={11} /> Selesai
                      </span>
                    ) : (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold flex items-center gap-1">
                        <Play size={11} /> Aktif
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">Saldo Awal:</span>
                      <span className="font-medium text-slate-700">{formatCurrency(shift.saldoAwal)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">Sistem (Ekspektasi):</span>
                      <span className="font-bold text-slate-900">{shift.saldoSistem !== null ? formatCurrency(shift.saldoSistem) : '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">Fisik Laci:</span>
                      <span className="font-bold text-primary">{shift.saldoFisikLaci !== null ? formatCurrency(shift.saldoFisikLaci) : '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">Selisih Kas:</span>
                      {shift.selisih !== null ? (
                        <span className={`font-bold px-1.5 py-0.2 rounded text-[11px] ${
                          shift.selisih === 0 ? 'bg-slate-100 text-slate-600' :
                          shift.selisih > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {shift.selisih > 0 ? '+' : ''}{formatCurrency(shift.selisih)}
                        </span>
                      ) : '-'}
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-1">
                    <button
                      className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5"
                      onClick={() => handleDownloadShiftSlip(shift)}
                    >
                      <Download size={13} /> Unduh Slip PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (>= 640px) */}
            <div className="hidden sm:block table-responsive p-0 overflow-x-auto">
              <table className="data-table w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th>TANGGAL &amp; WAKTU</th>
                    <th>KASIR</th>
                    <th>SALDO AWAL</th>
                    <th>SALDO SISTEM</th>
                    <th>SALDO FISIK</th>
                    <th>SELISIH</th>
                    <th>STATUS</th>
                    <th className="text-right">AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((shift) => (
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
                      <td className="text-right">
                        <button
                          className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-200 inline-flex items-center gap-1"
                          onClick={() => handleDownloadShiftSlip(shift)}
                          title="Unduh Dokumen Berita Acara Shift PDF"
                        >
                          <Download size={12} /> Slip PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <OpenShiftModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchData}
        mode={modalMode}
      />
    </div>
  );
};

export default ShiftHistoryView;

