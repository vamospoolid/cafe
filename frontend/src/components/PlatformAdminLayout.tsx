import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { POSContext } from '../context/POSContext';
import { 
  Cpu, 
  ArrowLeft, 
  LogOut, 
  Activity, 
  Clock, 
  ShieldCheck
} from 'lucide-react';

interface PlatformAdminLayoutProps {
  children: React.ReactNode;
}

export const PlatformAdminLayout: React.FC<PlatformAdminLayoutProps> = ({ children }) => {
  const posContext = useContext(POSContext);
  const navigate = useNavigate();
  const [serverTime, setServerTime] = useState<string>('');
  const [latencyMs, setLatencyMs] = useState<number>(18);
  const [apiOnline, setApiOnline] = useState<boolean>(true);

  // Realtime Clock & Telemetry Heartbeat
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setServerTime(now.toLocaleTimeString('id-ID', { hour12: false }) + ' WIB');
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);

    // Heartbeat check to /api/health
    const checkPing = async () => {
      const t0 = performance.now();
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const t1 = performance.now();
          setLatencyMs(Math.round(t1 - t0));
          setApiOnline(true);
        } else {
          setApiOnline(false);
        }
      } catch {
        setApiOnline(false);
      }
    };

    checkPing();
    const pingInterval = setInterval(checkPing, 15000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(pingInterval);
    };
  }, []);

  // SuperAdmin Access Guard
  const user = posContext?.user;
  const isSuper = user?.isPlatformAdmin === true || 
                  user?.role === 'OWNER' || 
                  user?.role === 'SUPERADMIN' || 
                  (user as any)?.roleId === 'role-system-owner';

  if (!isSuper) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-4 animate-bounce">
          <ShieldCheck size={32} />
        </div>
        <h1 className="text-xl font-black text-rose-400">Akses Terlarang (403 Forbidden)</h1>
        <p className="text-sm text-slate-400 max-w-md mt-2">
          Area ini khusus untuk <strong>Platform Developer &amp; SuperAdmin</strong>. Akun kasir/staf toko Anda tidak memiliki hak akses ke Master Command Center.
        </p>
        <button
          onClick={() => navigate('/pos')}
          className="mt-6 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-indigo-600/30"
        >
          <ArrowLeft size={16} /> Kembali ke Aplikasi POS
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* ─── STANDALONE MASTER DEVELOPER NAVBAR ──────────────────────────── */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        {/* Left: Brand & Engine Identity */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-400 p-[1px] shadow-md shadow-indigo-900/40 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
                <Cpu size={18} className="text-indigo-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-widest text-slate-200 uppercase">
                  CODENUSA <span className="text-indigo-400">SAAS PLATFORM</span>
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-400/10 text-amber-400 border border-amber-400/20">
                  DEVELOPER CONSOLE
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                <span>Multi-Tenant Core Engine v2.4</span>
                <span>•</span>
                <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Active Control Mode
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Realtime Telemetry Pulse */}
        <div className="hidden md:flex items-center gap-6 px-4 py-1.5 bg-slate-950/80 rounded-full border border-slate-800/80 text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <Activity size={13} className={apiOnline ? "text-emerald-400" : "text-rose-400"} />
            <span className="text-slate-400">API Health:</span>
            <span className={`font-bold ${apiOnline ? "text-emerald-400" : "text-rose-400"}`}>
              {apiOnline ? `Online (${latencyMs}ms)` : 'Offline'}
            </span>
          </div>

          <div className="h-3 w-px bg-slate-800"></div>

          <div className="flex items-center gap-2 text-slate-300">
            <Clock size={13} className="text-slate-400" />
            <span>{serverTime}</span>
          </div>
        </div>

        {/* Right: Quick Actions & Profile */}
        <div className="flex items-center gap-3">
          {/* Back to POS Workspace */}
          <button
            onClick={() => navigate('/pos')}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border border-slate-700/60 shadow-xs"
            title="Buka Aplikasi POS Kafe / Merchant Workspace"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">Buka POS Kafe</span>
          </button>

          {/* Developer Profile */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-xs">
              {user?.username?.substring(0, 2).toUpperCase() || 'DEV'}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-bold text-slate-200">{user?.name || user?.username}</div>
              <div className="text-[10px] text-amber-400 font-mono">Platform Developer</div>
            </div>

            <button
              onClick={() => posContext?.logout()}
              className="p-2 rounded-xl hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors ml-1 cursor-pointer"
              title="Logout Session"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONSOLE CONTENT CONTAINER ──────────────────────────────── */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
};

export default PlatformAdminLayout;
