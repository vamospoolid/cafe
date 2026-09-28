import React, { useState, useEffect, useRef, useContext } from 'react';
import { 
  Building2, 
  Store, 
  ChevronDown, 
  Check, 
  Plus, 
  RefreshCw,
  ArrowRight,
  Coffee,
  Wrench,
  ShoppingBag,
  Shirt
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';
import { offlineDb } from '../db/offlineDb';
import TenantRegisterWizard from './TenantRegisterWizard';

const getVerticalMeta = (type?: string) => {
  switch ((type || '').toUpperCase()) {
    case 'BENGKEL':
      return {
        label: 'Bengkel',
        icon: Wrench,
        badgeBg: 'bg-blue-50 text-blue-700 border-blue-200/80',
        activeIconBg: 'bg-blue-600 text-white',
        inactiveIconBg: 'bg-blue-100 text-blue-700'
      };
    case 'RETAIL':
      return {
        label: 'Retail',
        icon: ShoppingBag,
        badgeBg: 'bg-purple-50 text-purple-700 border-purple-200/80',
        activeIconBg: 'bg-purple-600 text-white',
        inactiveIconBg: 'bg-purple-100 text-purple-700'
      };
    case 'LAUNDRY':
      return {
        label: 'Laundry',
        icon: Shirt,
        badgeBg: 'bg-teal-50 text-teal-700 border-teal-200/80',
        activeIconBg: 'bg-teal-600 text-white',
        inactiveIconBg: 'bg-teal-100 text-teal-700'
      };
    case 'CAFE':
    default:
      return {
        label: 'Kafe & Resto',
        icon: Coffee,
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-200/80',
        activeIconBg: 'bg-amber-600 text-white',
        inactiveIconBg: 'bg-amber-100 text-amber-700'
      };
  }
};

interface TenantOutletSwitcherProps {
  compact?: boolean;
}

export const TenantOutletSwitcher: React.FC<TenantOutletSwitcherProps> = ({ compact = false }) => {
  const posContext = useContext(POSContext);
  const [isOpen, setIsOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const user = posContext?.user;
  const memberships = user?.memberships || [];
  const currentTenantId = user?.tenantId;
  const currentOutletId = user?.outletId;
  const currentMembership = memberships.find(m => m.tenantId === currentTenantId);
  const currentTenantName = currentMembership?.tenantName 
    || posContext?.settings?.storeName 
    || 'Kafe Utama';
  const currentBusinessType = currentMembership?.businessType || user?.businessType || 'CAFE';
  const currentMeta = getVerticalMeta(currentBusinessType);
  const CurrentIcon = currentMeta.icon;

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSwitchTenant = async (targetTenantId: string, targetTenantName: string) => {
    if (targetTenantId === currentTenantId) {
      setIsOpen(false);
      return;
    }

    // 1. Pre-Switch Offline Guard: Cek apakah ada antrean offline yang belum tersinkron
    try {
      const pendingCount = await offlineDb.getAllPendingOrdersCount(currentTenantId);
      if (pendingCount > 0) {
        const confirmSwitch = window.confirm(
          `⚠️ Perhatian Sinkronisasi Offline:\n\nTerdapat ${pendingCount} pesanan offline yang belum tersinkronisasi ke server untuk bisnis saat ini (${currentTenantName}).\n\nBeralih bisnis sekarang berisiko menunda pengiriman transaksi offline tersebut.\n\nApakah Anda yakin ingin tetap beralih bisnis?`
        );
        if (!confirmSwitch) {
          return;
        }
      }
    } catch (err) {
      console.warn('Gagal memeriksa antrean offline sebelum switch:', err);
    }

    setSwitching(targetTenantId);
    try {
      const res = await fetch('/api/auth/switch-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ tenantId: targetTenantId })
      });

      const data = await res.json();
      if (res.ok) {
        // 2. Pembersihan Cache Atomik: Bersihkan cache katalog lokal agar tidak ada kebocoran data antar tenant
        try {
          await offlineDb.clearCatalogCache();
          // Reset data cart & meja lokal
          localStorage.removeItem('pos_cart');
          localStorage.removeItem('pos_active_table');
        } catch (cacheErr) {
          console.warn('Gagal membersihkan cache lokal katalog:', cacheErr);
        }

        toast(`✅ Beralih ke bisnis: ${targetTenantName}`, 'success');
        if (data.token && data.user && posContext?.login) {
          posContext.login(data.user, data.token);
        }
        setIsOpen(false);
        // Reload location to reset view states cleanly
        window.location.reload();
      } else {
        toast(data.error || 'Gagal beralih tenant', 'error');
      }
    } catch (e) {
      toast('Terjadi kesalahan saat beralih tenant', 'error');
    } finally {
      setSwitching(null);
    }
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center rounded-xl bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/90 text-slate-800 transition-all active:scale-95 text-left shadow-xs shrink-0 ${
            compact ? 'gap-1 px-1.5 py-1' : 'gap-2 px-2.5 sm:px-3 py-1.5'
          }`}
          title="Beralih cabang atau bisnis"
        >
          <div className={`${compact ? 'w-5 h-5 rounded-md' : 'w-6 h-6 rounded-lg'} ${currentMeta.activeIconBg} flex items-center justify-center shrink-0 shadow-xs`}>
            <CurrentIcon size={compact ? 11 : 13} />
          </div>
          {compact ? (
            <span className="text-[10.5px] font-extrabold tracking-tight leading-none text-slate-900 line-clamp-1 max-w-[65px] truncate">
              {currentTenantName}
            </span>
          ) : (
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-tight leading-none text-slate-900 line-clamp-1 max-w-[110px] sm:max-w-[150px]">
                  {currentTenantName}
                </span>
                <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${currentMeta.badgeBg} leading-tight hidden xs:inline-block`}>
                  {currentMeta.label}
                </span>
              </div>
              <div className="text-[10px] font-medium text-slate-500 leading-none mt-0.5 hidden sm:block">
                {user?.role || 'Staff'} • Codenusa
              </div>
            </div>
          )}
          <ChevronDown size={compact ? 11 : 13} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-24px)] bg-white rounded-3xl shadow-2xl border border-slate-200/90 p-3 z-50 animate-fade-in text-slate-800">
            
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-black tracking-wider uppercase text-slate-400">
                Bisnis & Cabang Anda
              </span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black">
                {memberships.length} Akun
              </span>
            </div>

            {/* List of Memberships */}
            <div className="max-h-60 overflow-y-auto py-1 space-y-1">
              {memberships.map(m => {
                const isActive = m.tenantId === currentTenantId;
                const isProcessing = switching === m.tenantId;
                const meta = getVerticalMeta(m.businessType);
                const IconComponent = meta.icon;

                return (
                  <button
                    key={m.tenantId}
                    onClick={() => handleSwitchTenant(m.tenantId, m.tenantName)}
                    disabled={isProcessing}
                    className={`w-full p-2.5 rounded-2xl text-left flex items-center justify-between transition-all ${
                      isActive 
                        ? 'bg-indigo-50 border border-indigo-200/80 text-indigo-950 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive ? meta.activeIconBg : meta.inactiveIconBg
                      }`}>
                        <IconComponent size={15} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold leading-tight">{m.tenantName}</span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full border ${meta.badgeBg}`}>
                            {meta.label}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{m.tenantSlug}.codenusa.id</div>
                      </div>
                    </div>

                    <div>
                      {isProcessing ? (
                        <RefreshCw size={14} className="animate-spin text-indigo-600" />
                      ) : isActive ? (
                        <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check size={12} />
                        </div>
                      ) : (
                        <ArrowRight size={14} className="text-slate-300" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Register New Business Action */}
            <div className="pt-2 border-t border-slate-100 mt-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsWizardOpen(true);
                }}
                className="w-full py-2.5 px-3 rounded-2xl bg-slate-900 hover:bg-indigo-600 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Plus size={14} />
                <span>+ Daftarkan Usaha Baru</span>
              </button>
            </div>

          </div>
        )}
      </div>

      {/* Onboarding Wizard Modal */}
      <TenantRegisterWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
      />
    </>
  );
};

export default TenantOutletSwitcher;
