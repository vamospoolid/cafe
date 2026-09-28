import React from 'react';
import { Award, Wrench } from 'lucide-react';

interface TopServiceItem {
  name: string;
  count: number;
  omzet: number;
}

interface BengkelTopServicesProps {
  services: TopServiceItem[];
}

export const BengkelTopServices: React.FC<BengkelTopServicesProps> = ({ services = [] }) => {
  const maxOmzet = Math.max(...services.map(s => s.omzet), 1);

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
            <Award size={16} />
          </div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Top Jasa Servis Hari Ini
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          5 layanan terlaris berdasarkan pendapatan jasa
        </p>
      </div>

      <div className="flex flex-col gap-3 my-3">
        {services.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-center text-slate-400">
            <Wrench size={24} className="mb-1 text-slate-300" />
            <span className="text-xs">Belum ada transaksi jasa hari ini</span>
          </div>
        ) : (
          services.map((item, idx) => {
            const pct = Math.min(100, Math.round((item.omzet / maxOmzet) * 100));
            return (
              <div key={item.name + idx} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5 truncate max-w-[180px]">
                    <span className="text-[10px] w-4 h-4 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="truncate">{item.name}</span>
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-500">
                      {item.count} SPK
                    </span>
                    <span className="font-bold text-slate-900">
                      Rp {item.omzet.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
        <span>Kontribusi jasa margin tinggi</span>
        <span className="font-bold text-indigo-600">~80% Margin</span>
      </div>
    </div>
  );
};
