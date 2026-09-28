import React from 'react';
import { ReceiptText, ArrowUpRight, Wallet, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BengkelPiutangBlokProps {
  totalPiutangAktif: number;
  piutangOverdueCount: number;
  kasTunai: number;
  kasDigital: number;
}

export const BengkelPiutangBlok: React.FC<BengkelPiutangBlokProps> = ({
  totalPiutangAktif = 0,
  piutangOverdueCount = 0,
  kasTunai = 0,
  kasDigital = 0,
}) => {
  const navigate = useNavigate();
  const totalKasMasuk = kasTunai + kasDigital;

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <ReceiptText size={16} />
            </div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Piutang B2B & Arus Kas Masuk
            </h3>
          </div>
          <button
            onClick={() => navigate('/bengkel/invoices')}
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
          >
            <span>Invoice B2B</span>
            <ArrowUpRight size={13} />
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Tagihan tempo perusahaan & setoran kas kasir hari ini
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3">
        {/* Box Piutang Outstanding */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-slate-500">
                Total Piutang Belum Tertagih
              </span>
              {piutangOverdueCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded-md">
                  <AlertCircle size={10} />
                  {piutangOverdueCount} Overdue
                </span>
              )}
            </div>
            <div className="text-base font-black text-slate-900">
              Rp {totalPiutangAktif.toLocaleString('id-ID')}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200/60 text-[10px] text-slate-500">
            Termasuk fleet kantor & pelanggan tempo
          </div>
        </div>

        {/* Box Arus Kas Masuk Hari Ini */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                <Wallet size={12} className="text-teal-600" />
                Kas Diterima Hari Ini
              </span>
              <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/60">
                Real-Time
              </span>
            </div>
            <div className="text-base font-black text-teal-700">
              Rp {totalKasMasuk.toLocaleString('id-ID')}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-600">Tunai: <strong>Rp {kasTunai.toLocaleString('id-ID')}</strong></span>
            <span className="text-slate-600">Digital: <strong>Rp {kasDigital.toLocaleString('id-ID')}</strong></span>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>Kolektibilitas kas kasir terjaga dari SPK Paid</span>
        <button
          onClick={() => navigate('/bengkel/laporan')}
          className="font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
        >
          Lihat Buku Kas Bengkel →
        </button>
      </div>
    </div>
  );
};
