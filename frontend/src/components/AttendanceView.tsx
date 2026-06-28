import React, { useState, useEffect, useContext } from 'react';
import { UserCheck, Calendar, Clock, Download, CheckCircle, Fingerprint, FileText } from 'lucide-react';
import ClockInModal from './ClockInModal';
import { POSContext } from '../context/POSContext';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const AttendanceView = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  
  const posContext = useContext(POSContext);

  const fetchAttendances = async () => {
    setLoading(true);
    try {
      let url = '/api/attendance';
      if (dateFilter) url += `?date=${dateFilter}`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${posContext?.token}` } });
      const data = await res.json();
      if (res.ok) setAttendances(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (posContext?.token) fetchAttendances();
  }, [posContext?.token, dateFilter]);

  const formatTime = (isoString?: string) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const calculateDuration = (inTime: string, outTime?: string) => {
    if (!outTime) return '-';
    const start = new Date(inTime).getTime();
    const end = new Date(outTime).getTime();
    const diffHours = (end - start) / (1000 * 60 * 60);
    return `${diffHours.toFixed(1)} Jam`;
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Laporan Absensi Karyawan', 14, 15);
    doc.setFontSize(10);
    doc.text(`Filter Tanggal: ${dateFilter}`, 14, 22);
    doc.text(`Dicetak Pada: ${new Date().toLocaleString('id-ID')}`, 14, 28);

    const tableColumn = ["Nama", "Role", "Jam Masuk", "Jam Keluar", "Durasi", "Status"];
    const tableRows: any[] = [];

    attendances.forEach((att) => {
      tableRows.push([
        att.user?.name,
        att.user?.role,
        formatTime(att.clockIn),
        formatTime(att.clockOut),
        calculateDuration(att.clockIn, att.clockOut),
        att.clockOut ? 'Selesai Shift' : 'Sedang Bekerja'
      ]);
    });

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 32,
    });
    doc.save(`Laporan_Absensi_${dateFilter}.pdf`);
  };

  return (
    <div className="p-6 h-full flex flex-col bg-slate-50 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <UserCheck className="text-primary" /> Absensi Karyawan
          </h2>
          <p className="text-muted mt-1">Pantau kehadiran harian staf menggunakan terminal absensi PIN</p>
        </div>
        <div className="flex gap-3">
          <button className="btn bg-white border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={exportPDF}>
            <FileText size={16} className="text-red-500" /> Export Laporan PDF
          </button>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Fingerprint size={18} /> Terminal Absensi (Mesin)
          </button>
        </div>
      </div>

      <div className="card flex-1 flex flex-col p-0 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-muted" />
            <input 
              type="date" 
              className="form-control text-sm font-semibold text-primary" 
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive p-4 flex-1 overflow-y-auto">
          {loading ? (
             <div className="p-8 text-center text-gray-500">Memuat data absensi...</div>
          ) : (
            <table className="data-table w-full text-left border-collapse">
              <thead>
                <tr>
                  <th>NAMA KARYAWAN</th>
                  <th>ROLE</th>
                  <th>JAM MASUK (IN)</th>
                  <th>JAM KELUAR (OUT)</th>
                  <th>DURASI KERJA</th>
                  <th>STATUS ABSENSI</th>
                </tr>
              </thead>
              <tbody>
                {attendances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">Tidak ada data absensi untuk tanggal ini.</td>
                  </tr>
                ) : attendances.map((att) => (
                  <tr key={att.id}>
                    <td className="font-bold text-gray-800">{att.user?.name}</td>
                    <td><span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">{att.user?.role}</span></td>
                    <td>
                      <div className="flex items-center gap-2 font-semibold text-success">
                        <Clock size={14} /> {formatTime(att.clockIn)}
                      </div>
                    </td>
                    <td>
                      <div className={`flex items-center gap-2 font-semibold ${att.clockOut ? 'text-danger' : 'text-gray-400'}`}>
                        <Clock size={14} /> {formatTime(att.clockOut)}
                      </div>
                    </td>
                    <td className="font-bold text-indigo-700">{calculateDuration(att.clockIn, att.clockOut)}</td>
                    <td>
                      {att.clockOut ? (
                        <span className="badge bg-green-100 text-green-700 font-bold border border-green-200 flex items-center gap-1 w-max"><CheckCircle size={12} /> Selesai Shift</span>
                      ) : (
                        <span className="badge bg-yellow-100 text-yellow-700 font-bold border border-yellow-200 flex items-center gap-1 w-max">Sedang Bekerja</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <ClockInModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchAttendances} />
    </div>
  );
};

export default AttendanceView;
