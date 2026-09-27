import React from 'react';
import { AlertCircle, AlertTriangle, ChevronRight, Clock, PackageX, ReceiptText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BengkelAlertBannerProps {
  lowStockCount: number;
  piutangOverdueCount: number;
  spkWaitingParts: number;
  spkTertundaLama: number;
}

export const BengkelAlertBanner: React.FC<BengkelAlertBannerProps> = ({
  lowStockCount,
  piutangOverdueCount,
  spkWaitingParts,
  spkTertundaLama,
}) => {
  const navigate = useNavigate();

  const alerts: Array<{
    id: string;
    level: 'danger' | 'warning';
    icon: React.ElementType;
    title: string;
    description: string;
    actionLabel: string;
    onClick: () => void;
  }> = [];

  if (piutangOverdueCount > 0) {
    alerts.push({
      id: 'piutang-overdue',
      level: 'danger',
      icon: ReceiptText,
      title: `${piutangOverdueCount} Invoice B2B Melewati Jatuh Tempo!`,
      description: 'Segera lakukan follow up penagihan atau konfirmasi pembayaran pelanggan.',
      actionLabel: 'Lihat Piutang',
      onClick: () => navigate('/bengkel/invoices'),
    });
  }

  if (spkTertundaLama > 0) {
    alerts.push({
      id: 'spk-stalled',
      level: 'danger',
      icon: Clock,
      title: `${spkTertundaLama} SPK Belum Selesai > 3 Hari`,
      description: 'Ada unit kendaraan tertahan di pengerjaan lebih dari batas estimasi wajar.',
      actionLabel: 'Buka Kanban Board',
      onClick: () => navigate('/bengkel/board'),
    });
  }

  if (spkWaitingParts > 0) {
    alerts.push({
      id: 'waiting-parts',
      level: 'warning',
      icon: AlertTriangle,
      title: `${spkWaitingParts} SPK Menunggu Sparepart`,
      description: 'Pekerjaan terhenti karena komponen suku cadang belum tersedia atau inden.',
      actionLabel: 'Cek Antrian',
      onClick: () => navigate('/bengkel/board?status=WAITING_PARTS'),
    });
  }

  if (lowStockCount > 0) {
    alerts.push({
      id: 'low-stock',
      level: 'warning',
      icon: PackageX,
      title: `${lowStockCount} Sparepart Mencapai Batas Minimum`,
      description: 'Stok menipis, segera buat purchase order ke supplier sebelum kehabisan.',
      actionLabel: 'Kelola Stok',
      onClick: () => navigate('/produk'),
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      {alerts.map((alert) => {
        const Icon = alert.icon;
        const isDanger = alert.level === 'danger';

        return (
          <div
            key={alert.id}
            className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:px-4 rounded-xl border transition-all ${
              isDanger
                ? 'bg-rose-50/90 border-rose-200 text-rose-950'
                : 'bg-amber-50/90 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  isDanger ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {isDanger ? <AlertCircle size={18} /> : <Icon size={18} />}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight">
                  {alert.title}
                </span>
                <span
                  className={`text-xs ${
                    isDanger ? 'text-rose-700' : 'text-amber-800'
                  }`}
                >
                  {alert.description}
                </span>
              </div>
            </div>

            <button
              onClick={alert.onClick}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer self-end sm:self-center ${
                isDanger
                  ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs shadow-rose-200'
                  : 'bg-amber-600 text-white hover:bg-amber-700 shadow-xs shadow-amber-200'
              }`}
            >
              <span>{alert.actionLabel}</span>
              <ChevronRight size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
