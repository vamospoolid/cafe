import React from 'react';
import { Users, Flame, ChevronRight, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface MechanicLeaderboardItem {
  id: string;
  name: string;
  spkCount: number;
  omzetJasa: number;
  estimasiKomisi: number;
  pendingCommission: number;
}

interface BengkelMechanicLeaderboardProps {
  data: MechanicLeaderboardItem[];
  totalKomisiPending: number;
}

export const BengkelMechanicLeaderboard: React.FC<BengkelMechanicLeaderboardProps> = ({
  data = [],
  totalKomisiPending = 0,
}) => {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
              <Users size={16} />
            </div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Leaderboard Mekanik Hari Ini
            </h3>
          </div>
          <button
            onClick={() => navigate('/bengkel/mechanics')}
            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 cursor-pointer"
          >
            <span>Semua</span>
            <ChevronRight size={13} />
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Produktivitas pengerjaan & perolehan komisi jasa
        </p>
      </div>

      <div className="flex flex-col gap-2 my-3">
        {data.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-center text-slate-400">
            <Award size={24} className="mb-1 text-slate-300" />
            <span className="text-xs">Belum ada aktivitas servis mekanik hari ini</span>
          </div>
        ) : (
          data.map((m, idx) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 hover:bg-slate-100/70 border border-slate-100 transition-all text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
                    idx === 0
                      ? 'bg-amber-400 text-amber-950 shadow-2xs'
                      : idx === 1
                      ? 'bg-slate-200 text-slate-700'
                      : idx === 2
                      ? 'bg-orange-200 text-orange-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800 truncate">
                      {m.name}
                    </span>
                    {idx === 0 && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-800 flex items-center gap-0.5">
                        <Flame size={10} className="text-amber-600" />
                        TOP
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {m.spkCount} SPK diselesaikan
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-black text-slate-900">
                  Rp {m.omzetJasa.toLocaleString('id-ID')}
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold">
                  Komisi: +Rp {m.estimasiKomisi.toLocaleString('id-ID')}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500">Total Komisi Pending Bengkel:</span>
        <span className="font-bold text-violet-700">
          Rp {totalKomisiPending.toLocaleString('id-ID')}
        </span>
      </div>
    </div>
  );
};
