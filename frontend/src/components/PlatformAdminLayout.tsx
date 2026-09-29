import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { POSContext } from '../context/POSContext';
import { 
  Cpu, 
  ArrowLeft, 
  LogOut, 
  Clock, 
  ShieldCheck,
  Radio
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
  const token = posContext?.token;
  const user = posContext?.user;
  const isSuper = user?.isPlatformAdmin === true || 
                  user?.role === 'SUPERADMIN' ||
                  user?.username === 'admin' ||
                  user?.username === 'ahmad';

  // 1. Jika belum login sama sekali
  if (!token || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mb-4 shadow-xl">
          <ShieldCheck size={36} />
        </div>
        <h1 className="text-2xl font-black text-white">Master SaaS Command Center</h1>
        <p className="text-sm text-slate-400 max-w-md mt-2">
          Silakan masuk terlebih dahulu menggunakan akun <strong>Platform Developer / SuperAdmin</strong> untuk mengelola seluruh tenant, paket, dan operasional SaaS.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-6">
          <button
            onClick={() => navigate('/login')}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md active:scale-95"
          >
            <LogOut size={16} /> Masuk ke Halaman Login
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            <ArrowLeft size={16} /> Ke Halaman Beranda
          </button>
        </div>
      </div>
    );
  }

  // 2. Jika sudah login tetapi bukan SuperAdmin
  if (!isSuper) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="w-16 h-16 rounded-2xl bg-rose-600 text-white flex items-center justify-center mb-4 shadow-lg border-2 border-rose-400">
          <ShieldCheck size={32} />
        </div>
        <h1 className="text-2xl font-black text-white">Akses Terbatas (403 Forbidden)</h1>
        <p className="text-sm text-slate-300 max-w-md mt-2">
          Anda sedang login sebagai <strong>{user?.name || user?.username}</strong> ({user?.role}). Akun toko/kasir ini tidak memiliki hak akses ke Master Command Center.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-6">
          <button
            onClick={() => navigate('/pos')}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all border-2 border-indigo-400 shadow-md active:scale-95"
          >
            <ArrowLeft size={16} /> Kembali ke Aplikasi POS
          </button>
          <button
            onClick={() => {
              posContext?.logout();
              navigate('/login');
            }}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <LogOut size={16} /> Ganti Akun SuperAdmin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 flex flex-col font-sans antialiased selection:bg-indigo-600 selection:text-white relative overflow-x-hidden">

      {/* ─── STANDALONE MASTER DEVELOPER NAVBAR (HIGH-CONTRAST SOLID DARK) ──────── */}
      <header className="sticky top-0 z-50 bg-[#090d16] border-b-2 border-slate-800 px-4 sm:px-8 py-3 flex items-center justify-between shadow-md">
        {/* Left: Brand & Engine Identity */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white border-2 border-indigo-400 shadow-sm flex items-center justify-center font-black">
              <Cpu size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-tight text-white uppercase">
                  CODENUSA <span className="text-indigo-400 font-black">CONTROL PLANE</span>
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 border border-amber-300">
                  SUPERADMIN
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-2 mt-0.5">
                <span>Multi-Tenant Core v2.4</span>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Active Node Cluster
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Realtime Telemetry Pulse */}
        <div className="hidden md:flex items-center gap-4 px-3.5 py-1.5 bg-slate-900 rounded-xl border border-slate-700 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <Radio size={14} className={apiOnline ? "text-emerald-400 animate-pulse" : "text-rose-400"} />
            <span className="text-slate-400">API Health:</span>
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-black font-mono ${apiOnline ? "bg-emerald-500 text-slate-950" : "bg-rose-500 text-white"}`}>
              {apiOnline ? `Online (${latencyMs}ms)` : 'Offline'}
            </span>
          </div>

          <div className="h-3.5 w-px bg-slate-700"></div>

          <div className="flex items-center gap-2 text-slate-200 font-mono">
            <Clock size={14} className="text-slate-400" />
            <span>{serverTime}</span>
          </div>
        </div>

        {/* Right: Quick Actions & Profile */}
        <div className="flex items-center gap-3">
          {/* Back to POS Workspace */}
          <button
            onClick={() => navigate('/pos')}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black flex items-center gap-2 transition-all cursor-pointer border-2 border-slate-600 shadow-sm active:scale-95"
            title="Buka Aplikasi POS Kafe / Merchant Workspace"
          >
            <ArrowLeft size={14} className="text-slate-300" />
            <span className="hidden sm:inline">Buka POS Kafe</span>
          </button>

          {/* Developer Profile */}
          <div className="flex items-center gap-2.5 pl-3 border-l-2 border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center text-xs border border-indigo-400 shadow-sm">
              {user?.username?.substring(0, 2).toUpperCase() || 'SA'}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-black text-white leading-tight">{user?.name || user?.username}</div>
              <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wide">Platform Lead</div>
            </div>

            <button
              onClick={() => posContext?.logout()}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white transition-colors ml-1 cursor-pointer border border-slate-700"
              title="Logout Session"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONSOLE CONTENT CONTAINER ──────────────────────────────── */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 relative z-10">
        {children}
      </main>
    </div>
  );
};

export default PlatformAdminLayout;

