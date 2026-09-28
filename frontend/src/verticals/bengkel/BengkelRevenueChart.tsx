import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { TrendingUp, Wrench, Package, BarChart3 } from 'lucide-react';

interface RevenueDataPoint {
  date: string;
  label: string;
  omzetJasa: number;
  omzetParts: number;
  omzetTotal: number;
  totalSpk: number;
}

interface BengkelRevenueChartProps {
  data: RevenueDataPoint[];
  days: number;
  onDaysChange: (days: number) => void;
  loading?: boolean;
}

const formatRupiahShort = (val: number) => {
  if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}M`;
  if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(1)}jt`;
  if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}rb`;
  return `Rp ${val}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as RevenueDataPoint;
    return (
      <div className="bg-white text-slate-800 p-3 rounded-xl shadow-xl border border-slate-200 text-xs min-w-[170px]">
        <div className="font-black border-b border-slate-100 pb-1.5 mb-2 flex justify-between items-center text-slate-700">
          <span>{data.date}</span>
          <span className="text-[10px] bg-purple-50 text-purple-700 font-bold px-1.5 py-0.5 rounded-full border border-purple-100">
            {data.totalSpk} SPK
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center gap-4">
            <span className="flex items-center gap-1.5 text-indigo-600 font-bold">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              Jasa Servis
            </span>
            <span className="font-extrabold text-slate-900">
              Rp {data.omzetJasa.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Sparepart
            </span>
            <span className="font-extrabold text-slate-900">
              Rp {data.omzetParts.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="border-t border-slate-100 pt-1.5 mt-0.5 flex justify-between items-center text-purple-700 font-black">
            <span>Total Omzet</span>
            <span>Rp {data.omzetTotal.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const BengkelRevenueChart: React.FC<BengkelRevenueChartProps> = ({
  data,
  days,
  onDaysChange,
  loading = false,
}) => {
  const [chartMode, setChartMode] = useState<'all' | 'jasa' | 'parts'>('all');
  const totalOmzetPeriod = data.reduce((acc, curr) => acc + curr.omzetTotal, 0);
  const totalSpkPeriod = data.reduce((acc, curr) => acc + curr.totalSpk, 0);

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-700">
              <TrendingUp size={16} />
            </div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">
              Tren Omzet: Jasa vs Sparepart
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Total {days} Hari: <strong className="text-slate-800">Rp {totalOmzetPeriod.toLocaleString('id-ID')}</strong> ({totalSpkPeriod} SPK lunas)
          </p>
        </div>

        {/* View Mode Filters & Day Range */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Selector (Semua vs Jasa vs Parts) */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
            {[
              { id: 'all', label: '📊 Semua' },
              { id: 'jasa', label: '🔧 Jasa' },
              { id: 'parts', label: '⚙️ Parts' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setChartMode(m.id as any)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  chartMode === m.id
                    ? 'bg-white text-purple-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Days Range Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200/60">
            <button
              onClick={() => onDaysChange(7)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                days === 7
                  ? 'bg-white text-purple-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => onDaysChange(30)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                days === 30
                  ? 'bg-white text-purple-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 Hari
            </button>
          </div>
        </div>
      </div>

      <div className="w-full h-[260px] relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs flex items-center justify-center z-10 rounded-xl">
            <span className="text-xs font-bold text-slate-500">Memuat tren analitik...</span>
          </div>
        )}
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold">
            Belum ada transaksi SPK lunas pada periode ini
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="colorBengkelTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorBengkelJasa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorBengkelParts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatRupiahShort}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: '8px', fontSize: '11px' }}
              />

              {(chartMode === 'all') && (
                <Area
                  type="monotone"
                  dataKey="omzetTotal"
                  name="Total Omzet"
                  stroke="#7c3aed"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorBengkelTotal)"
                />
              )}
              {(chartMode === 'all' || chartMode === 'jasa') && (
                <Area
                  type="monotone"
                  dataKey="omzetJasa"
                  name="Omzet Jasa"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorBengkelJasa)"
                />
              )}
              {(chartMode === 'all' || chartMode === 'parts') && (
                <Area
                  type="monotone"
                  dataKey="omzetParts"
                  name="Omzet Sparepart"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorBengkelParts)"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
