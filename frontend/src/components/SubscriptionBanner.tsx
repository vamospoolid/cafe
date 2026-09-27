import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePOS } from '../context/POSContext';
import useSocket from '../hooks/useSocket';
import { AlertTriangle, Clock, Sparkles, ArrowRight, X } from 'lucide-react';

export const SubscriptionBanner: React.FC = () => {
  const { tenantPlan, fetchTenantFeatures } = usePOS();
  const navigate = useNavigate();
  const socket = useSocket();
  const [isDismissed, setIsDismissed] = useState(false);

  // Dengarkan notifikasi Socket.IO real-time untuk siklus langganan
  useEffect(() => {
    if (!socket) return;

    const handleSubscriptionUpdate = () => {
      fetchTenantFeatures();
    };

    socket.on('tenant:status_changed', handleSubscriptionUpdate);
    socket.on('tenant:reactivated', handleSubscriptionUpdate);
    socket.on('subscription:invoice_created', handleSubscriptionUpdate);

    return () => {
      socket.off('tenant:status_changed', handleSubscriptionUpdate);
      socket.off('tenant:reactivated', handleSubscriptionUpdate);
      socket.off('subscription:invoice_created', handleSubscriptionUpdate);
    };
  }, [socket, fetchTenantFeatures]);

  if (!tenantPlan) return null;

  const { status, trialEndsAt, currentPeriodEnd, plan } = tenantPlan;
  const now = Date.now();

  let bannerType: 'GRACE_PERIOD' | 'TRIAL_EXPIRING' | 'SUBSCRIPTION_EXPIRING' | null = null;
  let daysLeft = 0;

  if (status === 'GRACE_PERIOD') {
    bannerType = 'GRACE_PERIOD';
    // Grace period default 3 hari dari batas akhir
    const expiryBase = currentPeriodEnd ? new Date(currentPeriodEnd).getTime() : (trialEndsAt ? new Date(trialEndsAt).getTime() : now);
    const graceEnd = expiryBase + 3 * 24 * 60 * 60 * 1000;
    daysLeft = Math.max(0, Math.ceil((graceEnd - now) / (1000 * 3600 * 24)));
  } else if (status === 'TRIAL' && trialEndsAt) {
    const endMs = new Date(trialEndsAt).getTime();
    daysLeft = Math.ceil((endMs - now) / (1000 * 3600 * 24));
    if (daysLeft <= 5) {
      bannerType = 'TRIAL_EXPIRING';
    }
  } else if (status === 'ACTIVE' && currentPeriodEnd) {
    const endMs = new Date(currentPeriodEnd).getTime();
    daysLeft = Math.ceil((endMs - now) / (1000 * 3600 * 24));
    if (daysLeft <= 7) {
      bannerType = 'SUBSCRIPTION_EXPIRING';
    }
  }

  // Jika kondisi aman dan tidak perlu peringatan
  if (!bannerType) return null;

  // Grace period tidak boleh di-dismiss karena kritis
  if (isDismissed && bannerType !== 'GRACE_PERIOD') return null;

  const handleActionClick = () => {
    navigate('/pengaturan?tab=saas_plan');
  };

  if (bannerType === 'GRACE_PERIOD') {
    return (
      <div className="px-3 sm:px-6 pt-2.5 pb-1 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-rose-950/95 via-amber-950/90 to-rose-950/95 border border-rose-500/40 shadow-lg shadow-rose-950/20 text-rose-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 animate-pulse">
              <AlertTriangle size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500 text-white">
                  MASA TENGGANG AKTIF
                </span>
                <span className="font-extrabold text-white text-xs sm:text-sm">
                  Sisa {daysLeft} Hari Sebelum Kasir Dinonaktifkan
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-rose-200/90 mt-0.5">
                Tagihan langganan telah jatuh tempo. Selesaikan pembayaran sekarang agar operasional kasir tetap lancar.
              </p>
            </div>
          </div>

          <button
            onClick={handleActionClick}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-transform active:scale-95 shrink-0 cursor-pointer"
          >
            Bayar Tagihan Sekarang <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  if (bannerType === 'TRIAL_EXPIRING') {
    return (
      <div className="px-3 sm:px-6 pt-2.5 pb-1 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-indigo-950/95 via-purple-950/90 to-indigo-950/95 border border-indigo-500/40 shadow-lg shadow-indigo-950/20 text-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-500 text-white">
                  TRIAL BERAKHIR
                </span>
                <span className="font-extrabold text-white text-xs sm:text-sm">
                  Masa Uji Coba Tersisa {daysLeft} Hari Lagi
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-indigo-200/90 mt-0.5">
                Pilih paket bisnis Anda untuk terus menikmati fitur lengkap CodePOS tanpa jeda.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleActionClick}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-transform active:scale-95 shrink-0 cursor-pointer"
            >
              Pilih Paket Langganan <ArrowRight size={14} />
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 rounded-lg text-indigo-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Tutup banner"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SUBSCRIPTION_EXPIRING (H-7 s/d H-1)
  return (
    <div className="px-3 sm:px-6 pt-2.5 pb-1 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-950/95 via-amber-900/85 to-amber-950/95 border border-amber-500/40 shadow-lg shadow-amber-950/20 text-amber-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500 text-white">
                PERPANJANGAN PAKET
              </span>
              <span className="font-extrabold text-white text-xs sm:text-sm">
                Paket {plan?.name || 'SaaS'} Tersisa {daysLeft} Hari
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-amber-200/90 mt-0.5">
              Invoice perpanjangan telah tersedia. Bayar sekarang untuk kelancaran transaksi tanpa gangguan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleActionClick}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-900 font-black text-xs shadow-md flex items-center justify-center gap-1.5 transition-transform active:scale-95 shrink-0 cursor-pointer"
          >
            Perpanjang Sekarang <ArrowRight size={14} />
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 rounded-lg text-amber-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Tutup banner"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionBanner;
