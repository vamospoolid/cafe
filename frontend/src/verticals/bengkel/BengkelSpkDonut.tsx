import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';

interface SpkStatusSummary {
  pending: number;
  assigned: number;
  inProgress: number;
  waitingParts: number;
  done: number;
  paidToday: number;
}

interface BengkelSpkDonutProps {
  summary: SpkStatusSummary;
}

export const BengkelSpkDonut: React.FC<BengkelSpkDonutProps> = ({ summary }) => {
  const chartData = [
    { name: 'Antrian', value: summary.pending, color: '#94a3b8' },
    { name: 'Ditugaskan', value: summary.assigned, color: '#3b82f6' },
    { name: 'Pengerjaan', value: summary.inProgress, color: '#f59e0b' },
    { name: 'Tunggu Part', value: summary.waitingParts, color: '#f43f5e' },
    { name: 'Selesai Belum Bayar', value: summary.done, color: '#10b981' },
    { name: 'Lunas Hari Ini', value: summary.paidToday, color: '#0d9488' },
  ].filter(item => item.value > 0);

  const total = summary.pending + summary.assigned + summary.inProgress +
                summary.waitingParts + summary.done + summary.paidToday;

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-violet-50 text-violet-600">
            <PieIcon size={16} />
          </div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Distribusi Status SPK
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          Proporsi status pengerjaan unit bengkel saat ini
        </p>
      </div>

      <div className="w-full h-[180px] relative my-2">
        {total === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Belum ada SPK terdata
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `${value} Unit (${total > 0 ? Math.round((Number(value) / total) * 100) : 0}%)`,
                    name,
                  ]}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#fff',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-black text-slate-800">{total}</span>
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Unit</span>
            </div>
          </>
        )}
      </div>

      {/* Mini Legend List */}
      <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100">
        {[
          { label: 'Antrian', val: summary.pending, color: 'bg-slate-400' },
          { label: 'Ditugaskan', val: summary.assigned, color: 'bg-blue-500' },
          { label: 'Pengerjaan', val: summary.inProgress, color: 'bg-amber-500' },
          { label: 'Tunggu Part', val: summary.waitingParts, color: 'bg-rose-500' },
          { label: 'Selesai', val: summary.done, color: 'bg-emerald-500' },
          { label: 'Lunas', val: summary.paidToday, color: 'bg-teal-600' },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between text-[11px] px-1 py-0.5">
            <span className="flex items-center gap-1.5 text-slate-600 truncate">
              <span className={`w-2 h-2 rounded-full shrink-0 ${item.color}`} />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="font-bold text-slate-800 shrink-0">{item.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
