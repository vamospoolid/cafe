import React, { useState, useContext } from 'react';
import { 
  Building2, 
  Store, 
  ChevronDown, 
  Check, 
  Plus, 
  Sparkles, 
  RefreshCw,
  Crown,
  Layers,
  ArrowRight
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';
import TenantRegisterWizard from './TenantRegisterWizard';

export const TenantOutletSwitcher: React.FC = () => {
  const posContext = useContext(POSContext);
  const [isOpen, setIsOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const user = posContext?.user;
  const memberships = user?.memberships || [];
  const currentTenantId = user?.tenantId;
  const currentOutletId = user?.outletId;
  const currentTenantName = memberships.find(m => m.tenantId === currentTenantId)?.tenantName || 'Kafe Utama';

  const handleSwitchTenant = async (targetTenantId: string, targetTenantName: string) => {
    if (targetTenantId === currentTenantId) {
      setIsOpen(false);
      return;
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
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-all backdrop-blur-md active:scale-95 text-left"
        >
          <div className="w-7 h-7 rounded-xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0">
            <Building2 size={15} />
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-black tracking-tight leading-tight line-clamp-1 text-white">
              {currentTenantName}
            </div>
            <div className="text-[10px] font-bold text-slate-300 leading-tight">
              {user?.role || 'Staff'} • Codenusa SaaS
            </div>
          </div>
          <ChevronDown size={14} className={`text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute left-0 mt-2 w-72 bg-white rounded-3xl shadow-2xl border border-slate-200/90 p-3 z-50 animate-fade-in text-slate-800">
            
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
                        isActive ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Store size={15} />
                      </div>
                      <div>
                        <div className="text-xs font-bold leading-tight">{m.tenantName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{m.tenantSlug}.codenusa.id</div>
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
