import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  UserCheck,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  ArrowRight,
} from 'lucide-react';

interface SpkStatusSummary {
  pending: number;
  assigned: number;
  inProgress: number;
  waitingParts: number;
  done: number;
  paidToday: number;
}

interface BengkelSpkPipelineProps {
  summary: SpkStatusSummary;
  spkDoneUnpaid?: number;
}

export const BengkelSpkPipeline: React.FC<BengkelSpkPipelineProps> = ({
  summary,
  spkDoneUnpaid = 0,
}) => {
  const navigate = useNavigate();

  const stages = [
    {
      key: 'PENDING',
      label: 'Antrian Masuk',
      count: summary.pending,
      icon: Clock,
      color: 'slate',
      bgClass: 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-700',
      badgeClass: 'bg-slate-200/70 text-slate-800',
      description: 'Menunggu mekanik',
    },
    {
      key: 'ASSIGNED',
      label: 'Ditugaskan',
      count: summary.assigned,
      icon: UserCheck,
      color: 'blue',
      bgClass: 'bg-blue-50/70 hover:bg-blue-100/70 border-blue-200 text-blue-700',
      badgeClass: 'bg-blue-200/70 text-blue-800',
      description: 'Siap dikerjakan',
    },
    {
      key: 'IN_PROGRESS',
      label: 'Pengerjaan',
      count: summary.inProgress,
      icon: Wrench,
      color: 'amber',
      bgClass: 'bg-amber-50/70 hover:bg-amber-100/70 border-amber-200 text-amber-800',
      badgeClass: 'bg-amber-200/70 text-amber-900',
      description: 'Sedang diservis',
    },
    {
      key: 'WAITING_PARTS',
      label: 'Tunggu Sparepart',
      count: summary.waitingParts,
      icon: AlertTriangle,
      color: 'rose',
      bgClass: summary.waitingParts > 0
        ? 'bg-rose-50 hover:bg-rose-100/80 border-rose-300 ring-1 ring-rose-300 text-rose-800'
        : 'bg-rose-50/40 hover:bg-rose-100/60 border-rose-200 text-rose-700',
      badgeClass: 'bg-rose-200 text-rose-900',
      description: 'Menunggu suku cadang',
    },
    {
      key: 'DONE',
      label: 'Selesai (Belum Bayar)',
      count: summary.done,
      icon: CheckCircle2,
      color: 'emerald',
      bgClass: spkDoneUnpaid > 0
        ? 'bg-emerald-50 hover:bg-emerald-100/80 border-amber-300 ring-1 ring-amber-300 text-emerald-900'
        : 'bg-emerald-50/60 hover:bg-emerald-100/70 border-emerald-200 text-emerald-800',
      badgeClass: 'bg-emerald-200 text-emerald-900',
      description: spkDoneUnpaid > 0 ? `${spkDoneUnpaid} belum lunas kasir` : 'Unit siap diambil',
    },
    {
      key: 'PAID',
      label: 'Lunas Hari Ini',
      count: summary.paidToday,
      icon: Receipt,
      color: 'teal',
      bgClass: 'bg-teal-50/80 hover:bg-teal-100/80 border-teal-200 text-teal-800',
      badgeClass: 'bg-teal-200 text-teal-950',
      description: 'Tuntas & serah terima',
    },
  ];

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col gap-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Pipeline Alur Pengerjaan SPK (Live Kanban Status)
          </h3>
        </div>
        <button
          onClick={() => navigate('/bengkel/board')}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
        >
          <span>Buka Kanban Board Lengkap</span>
          <ArrowRight size={13} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {stages.map((stage) => {
          const Icon = stage.icon;
          return (
            <div
              key={stage.key}
              onClick={() => navigate(`/bengkel/board?status=${stage.key}`)}
              className={`flex flex-col p-3 rounded-xl border transition-all cursor-pointer group shadow-2xs hover:shadow-xs active:scale-[0.98] ${stage.bgClass}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="p-1.5 rounded-lg bg-white/70 shadow-2xs">
                  <Icon size={16} />
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-black ${stage.badgeClass}`}
                >
                  {stage.count}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-800 line-clamp-1 mb-0.5">
                {stage.label}
              </span>
              <span className="text-[10px] text-slate-500 leading-tight">
                {stage.description}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
