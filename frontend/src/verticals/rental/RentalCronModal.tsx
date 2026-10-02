import React, { useState } from 'react';
import { 
  BellRing, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Loader2, 
  Clock, 
  Shirt, 
  MessageSquare, 
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';

export interface RentalReminderAuditResult {
  checkedOrders: number;
  dueRemindersSent: number;
  overdueAlertsSent: number;
  pickupRemindersSent: number;
  errors: number;
  timestamp: string;
}

interface RentalCronModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFinished?: () => void;
}

export const RentalCronModal: React.FC<RentalCronModalProps> = ({
  isOpen,
  onClose,
  onFinished
}) => {
  const { token } = usePOS();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RentalReminderAuditResult | null>(null);

  if (!isOpen) return null;

  const handleRunCron = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/rental/notifications/run-cron', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menjalankan cron pengingat sewa.');
      }

      setResult(data.audit);
      toast('Siklus pengingat WhatsApp berhasil dijalankan!', 'success');
      if (onFinished) {
        onFinished();
      }
    } catch (err: any) {
      console.error('[RentalCronModal] Error running cron:', err);
      toast(err.message || 'Terjadi kesalahan saat memicu WhatsApp reminder.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-5 bg-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <BellRing className="text-white animate-pulse" size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white tracking-tight flex items-center gap-2">
                Auto-Reminder WhatsApp Rental
              </h3>
              <p className="text-xs text-indigo-100 font-medium">
                Pemicu Otomatis Jadwal Ambil, Jatuh Tempo &amp; Overdue
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Explanation Banner */}
          <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-2xl p-4 text-xs text-indigo-950 space-y-2">
            <div className="flex items-center gap-2 font-bold text-indigo-900">
              <Sparkles size={15} className="text-indigo-600 shrink-0" />
              <span>Sistem Pengingat Pintar Butik Rental:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-700 ml-1">
              <li>
                <strong className="text-slate-900">Pengingat Ambil (H-1):</strong> Notifikasi ke penyewa terjadwal untuk datang mengambil busana &amp; membawa KTP.
              </li>
              <li>
                <strong className="text-slate-900">Jatuh Tempo (H-1 &amp; Hari-H):</strong> Notifikasi checklist aksesoris, tanpa cuci, dan pengembalian uang jaminan (deposit).
              </li>
              <li>
                <strong className="text-slate-900">Overdue (Terlambat):</strong> Peringatan denda berjalan Rp 50.000/hari bagi busana yang lewat batas waktu.
              </li>
            </ul>
            <p className="text-[11px] text-indigo-800 italic pt-1 border-t border-indigo-200/60">
              *Di latar belakang, scheduler CodePOS juga otomatis memeriksa siklus ini setiap 30 menit.
            </p>
          </div>

          {/* Trigger Button or Loading State */}
          {!result && !loading && (
            <div className="text-center py-4">
              <p className="text-xs text-slate-500 mb-4">
                Klik tombol di bawah untuk memindai seluruh order rental aktif dan mengirimkan WhatsApp reminder secara serentak sekarang.
              </p>
              <button
                onClick={handleRunCron}
                className="w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-200 hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles size={18} />
                Jalankan Pemeriksaan &amp; Kirim WhatsApp Sekarang
              </button>
            </div>
          )}

          {loading && (
            <div className="py-10 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 border-4 border-indigo-200 border-t-indigo-600 animate-spin flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-600" size={24} />
              </div>
              <p className="text-sm font-bold text-slate-800">Sedang Memproses Notifikasi...</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Memeriksa kontrak sewa, menghitung selisih hari, dan mengirimkan pesan via gateway WhatsApp butik.
              </p>
            </div>
          )}

          {/* Result Card */}
          {result && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm bg-emerald-50 border border-emerald-200 p-3 rounded-2xl">
                <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
                <span>Pemeriksaan Selesai & Notifikasi Berhasil Diproses!</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Order Diperiksa</p>
                  <p className="text-2xl font-black text-slate-800 mt-0.5">{result.checkedOrders}</p>
                  <span className="text-[10px] text-slate-400">Total pesanan aktif</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-center">
                  <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Pengingat Ambil</p>
                  <p className="text-2xl font-black text-blue-800 mt-0.5">{result.pickupRemindersSent}</p>
                  <span className="text-[10px] text-blue-600">Ambil busana H-1</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                  <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Jatuh Tempo</p>
                  <p className="text-2xl font-black text-amber-800 mt-0.5">{result.dueRemindersSent}</p>
                  <span className="text-[10px] text-amber-600">H-1 & Hari-H kembali</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-center">
                  <p className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Overdue (Denda)</p>
                  <p className="text-2xl font-black text-rose-800 mt-0.5">{result.overdueAlertsSent}</p>
                  <span className="text-[10px] text-rose-600">Terlambat kembali</span>
                </div>
              </div>

              {result.errors > 0 && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-700 flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>Ditemukan {result.errors} kendala saat transmisi pesan (misal nomor salah/gateway offline).</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleRunCron}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={13} /> Jalankan Lagi
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Tutup & Kembali
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RentalCronModal;
