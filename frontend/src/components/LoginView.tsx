import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Lock, AlertCircle, Eye, EyeOff, Coffee, Sparkles, MapPin, Phone, ShieldCheck, CheckCircle2, Tablet } from 'lucide-react';
import { POSContext } from '../context/POSContext';

interface PublicBranding {
  storeName: string;
  logoUrl: string;
  tenantSlug: string;
  tenantName: string;
  address?: string;
  phone?: string;
  primaryColor: string;
  accentColor: string;
  loginLayout: 'split_modern' | 'centered_glass' | 'minimal_luxe' | 'cafe_atmosphere';
  loginCoverUrl: string;
  loginTagline: string;
  faviconUrl: string | null;
  hidePlatformBranding: boolean;
}

const defaultBranding: PublicBranding = {
  storeName: 'CodePOS Platform',
  logoUrl: '/logo.png',
  tenantSlug: 'platform',
  tenantName: 'CodePOS Platform',
  address: '',
  phone: '',
  primaryColor: '#4f46e5',
  accentColor: '#f59e0b',
  loginLayout: 'split_modern',
  loginCoverUrl: '/assets/images/cafe_login_cover.png',
  loginTagline: 'Point of Sale & Business Management Multi-Outlet SaaS',
  faviconUrl: null,
  hidePlatformBranding: false
};

const LoginView = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const posContext = useContext(POSContext);

  const [branding, setBranding] = useState<PublicBranding>(defaultBranding);

  // Jika sudah login (memiliki token aktif), otomatis arahkan ke dashboard
  useEffect(() => {
    if (posContext?.token) {
      navigate('/dashboard', { replace: true });
    }
  }, [posContext?.token, navigate]);

  // Injeksi CSS Variables dan Favicon dinamis ke browser
  useEffect(() => {
    if (branding.primaryColor) {
      document.documentElement.style.setProperty('--brand-primary', branding.primaryColor);
    }
    if (branding.accentColor) {
      document.documentElement.style.setProperty('--brand-accent', branding.accentColor);
    }

    // Dynamic Browser Tab Title
    document.title = `${branding.storeName} — POS & Kasir Back-Office`;

    // Dynamic Favicon
    if (branding.faviconUrl || branding.logoUrl) {
      const iconUrl = branding.faviconUrl || branding.logoUrl;
      let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = iconUrl;
    }
  }, [branding]);

  // Fetch initial branding based on hostname / subdomain / query param
  useEffect(() => {
    const fetchInitialBranding = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tenantParam = params.get('tenant') || params.get('slug');
        const url = tenantParam 
          ? `/api/public-branding?tenant=${encodeURIComponent(tenantParam)}` 
          : '/api/public-branding';

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setBranding(prev => ({
            ...prev,
            ...data,
            primaryColor: data.primaryColor || prev.primaryColor,
            accentColor: data.accentColor || prev.accentColor,
            loginLayout: data.loginLayout || prev.loginLayout,
            loginCoverUrl: data.loginCoverUrl || prev.loginCoverUrl,
            loginTagline: data.loginTagline || prev.loginTagline
          }));
        }
      } catch (e) {
        console.warn('Could not fetch initial branding:', e);
      }
    };
    fetchInitialBranding();
  }, []);

  // Dynamic branding switch when typing username (auto-detect tenant)
  useEffect(() => {
    if (!username || username.length < 3) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/public-branding?username=${encodeURIComponent(username.trim())}`);
        if (res.ok) {
          const data = await res.json();
          if (data.storeName) {
            setBranding(prev => ({
              ...prev,
              ...data,
              primaryColor: data.primaryColor || prev.primaryColor,
              accentColor: data.accentColor || prev.accentColor,
              loginLayout: data.loginLayout || prev.loginLayout,
              loginCoverUrl: data.loginCoverUrl || prev.loginCoverUrl,
              loginTagline: data.loginTagline || prev.loginTagline
            }));
          }
        }
      } catch (e) {}
    }, 400);
    return () => clearTimeout(timer);
  }, [username]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const params = new URLSearchParams(window.location.search);
      const tenantSlug = params.get('tenant') || params.get('slug') || branding.tenantSlug;

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, tenantSlug })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login gagal, periksa username dan password.');
      }

      if (posContext) {
        posContext.login(data.user, data.token);
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reusable Form Component with Dynamic Styling
  const renderLoginForm = (isGlassDark = false) => (
    <>
      {/* Header Logo & Title */}
      <div className="text-center mb-7">
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4 overflow-hidden shadow-lg p-2.5 transition-transform hover:scale-105 ${
          isGlassDark ? 'bg-white/10 border border-white/20 backdrop-blur-md' : 'bg-white border border-slate-200'
        }`}>
          <img 
            src={branding.logoUrl || '/logo.png'} 
            alt={`${branding.storeName} Logo`} 
            style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (target.src !== window.location.origin + '/logo.png') {
                target.src = '/logo.png';
              }
            }}
          />
        </div>
        <h2 className={`text-2xl sm:text-3xl font-black tracking-tight ${isGlassDark ? 'text-white' : 'text-slate-900'}`}>
          {branding.storeName}
        </h2>
        <p className={`mt-1.5 font-medium text-xs sm:text-sm max-w-sm mx-auto leading-relaxed ${isGlassDark ? 'text-slate-300' : 'text-slate-500'}`}>
          {branding.loginTagline || `Masuk untuk mengakses kasir dan back-office ${branding.storeName}`}
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 animate-headShake">
          <AlertCircle className="text-rose-500 mt-0.5 flex-shrink-0" size={18} />
          <p className="text-rose-700 text-xs font-semibold leading-relaxed">{error}</p>
        </div>
      )}

      {/* Form Fields */}
      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label className={`block text-xs font-extrabold uppercase tracking-wider mb-2 ${isGlassDark ? 'text-slate-200' : 'text-slate-700'}`}>
            Username
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <User size={18} className={isGlassDark ? 'text-slate-400' : 'text-slate-400 group-focus-within:text-indigo-600'} />
            </div>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`block w-full pl-11 pr-4 py-3.5 rounded-2xl transition-all duration-200 shadow-sm text-sm font-medium focus:outline-none ${
                isGlassDark 
                  ? 'bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:bg-white/20 focus:border-white/40 focus:ring-4 focus:ring-white/10' 
                  : 'bg-slate-50/70 border border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
              }`}
              placeholder="Masukkan username kasir / admin"
              required
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className={`block text-xs font-extrabold uppercase tracking-wider ${isGlassDark ? 'text-slate-200' : 'text-slate-700'}`}>
              Password / PIN
            </label>
            <span className={`text-xs cursor-pointer font-semibold transition-colors ${isGlassDark ? 'text-slate-300 hover:text-white' : 'text-slate-400 hover:text-indigo-600'}`}>
              Lupa PIN?
            </span>
          </div>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock size={18} className={isGlassDark ? 'text-slate-400' : 'text-slate-400 group-focus-within:text-indigo-600'} />
            </div>
            <input 
              type={showPassword ? "text" : "password"} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`block w-full pl-11 pr-12 py-3.5 rounded-2xl transition-all duration-200 shadow-sm text-sm font-medium focus:outline-none ${
                isGlassDark 
                  ? 'bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:bg-white/20 focus:border-white/40 focus:ring-4 focus:ring-white/10' 
                  : 'bg-slate-50/70 border border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
              }`}
              placeholder="Masukkan password atau PIN"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className={`absolute inset-y-0 right-0 pr-4 flex items-center transition-colors focus:outline-none ${isGlassDark ? 'text-slate-300 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Quick Demo Helper Hint */}
        <div className={`rounded-2xl p-3.5 text-xs flex flex-col gap-1.5 ${
          isGlassDark ? 'bg-white/5 border border-white/10 text-slate-300' : 'bg-slate-50 border border-slate-100 text-slate-500'
        }`}>
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-1.5">
              <Sparkles size={13} style={{ color: branding.accentColor || '#f59e0b' }} /> Info Login Cepat:
            </span>
            <span className="opacity-80">Default Admin</span>
          </div>
          <div className="flex justify-between text-[11px] font-medium pt-1 border-t border-white/10">
            <span>User: <strong className={isGlassDark ? 'text-white' : 'text-slate-800'}>admin</strong></span>
            <span>PIN: <strong className={isGlassDark ? 'text-white' : 'text-slate-800'}>123456</strong></span>
          </div>
        </div>

        {/* Submit Button with Custom Brand Color */}
        <button 
          type="submit" 
          disabled={loading}
          style={{ backgroundColor: branding.primaryColor || '#4f46e5' }}
          className="w-full flex justify-center items-center gap-2 py-4 px-4 rounded-2xl shadow-lg text-sm font-black text-white hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-white/20 disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Menghubungkan...
            </>
          ) : 'Masuk Sekarang'}
        </button>

        {/* Separator / Device Activation Alternative */}
        <div className="relative my-4 flex items-center justify-center">
          <div className={`border-t w-full ${isGlassDark ? 'border-white/10' : 'border-slate-200'}`}></div>
          <span className={`px-2.5 text-[10px] font-bold uppercase tracking-wider ${isGlassDark ? 'bg-transparent text-slate-400' : 'bg-white text-slate-400'}`}>
            atau
          </span>
          <div className={`border-t w-full ${isGlassDark ? 'border-white/10' : 'border-slate-200'}`}></div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/activate-tablet')}
          className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border text-xs font-bold transition-all active:scale-[0.98] ${
            isGlassDark
              ? 'border-indigo-400/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
              : 'border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100/70'
          }`}
        >
          <Tablet size={16} />
          Aktivasi Tablet Kasir Baru (Kode Pairing)
        </button>
      </form>

      {/* Navigation & Branding Footer */}
      <div className="mt-6 text-center space-y-3">
        <a
          href="/"
          className={`text-xs font-bold transition-colors inline-flex items-center gap-1.5 ${
            isGlassDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>&larr; Kembali ke Beranda</span>
        </a>

        {!branding.hidePlatformBranding && (
          <div className={`text-[11px] font-medium pt-2 border-t ${
            isGlassDark ? 'border-white/10 text-slate-400' : 'border-slate-150 text-slate-400'
          }`}>
            Powered by <strong>CodePOS</strong> &bull; Multi-Outlet SaaS Platform
          </div>
        )}
      </div>
    </>
  );

  // ─── LAYOUT PRESET 2: Centered Glassmorphism ─────────────────────────────
  if (branding.loginLayout === 'centered_glass') {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        {/* Fullscreen Background Cover with Blur */}
        <img 
          src={branding.loginCoverUrl || '/assets/images/cafe_login_cover.png'} 
          alt="Cafe Atmosphere" 
          className="absolute inset-0 w-full h-full object-cover scale-105"
        />
        <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-xl" />
        <div 
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ backgroundColor: branding.primaryColor || '#4f46e5' }}
        />
        <div 
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-25 pointer-events-none"
          style={{ backgroundColor: branding.accentColor || '#f59e0b' }}
        />

        {/* Floating Glass Card */}
        <div className="relative z-10 w-full max-w-md bg-slate-900/70 border border-white/20 p-8 sm:p-10 rounded-[2.5rem] shadow-2xl backdrop-blur-2xl transition-all duration-300">
          {renderLoginForm(true)}
        </div>
      </div>
    );
  }

  // ─── LAYOUT PRESET 3: Minimalist Luxe Tablet ──────────────────────────────
  if (branding.loginLayout === 'minimal_luxe') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-900 font-sans">
        <div className="w-full max-w-md bg-slate-850 bg-slate-900 border border-slate-800 p-8 sm:p-10 rounded-3xl shadow-2xl">
          {renderLoginForm(true)}
        </div>
      </div>
    );
  }

  // ─── LAYOUT PRESET 4: Cafe Atmosphere (Boutique) ─────────────────────────
  if (branding.loginLayout === 'cafe_atmosphere') {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row bg-[#1a1614] text-[#ede3da] font-sans">
        {/* Left Atmosphere Panel */}
        <div className="hidden lg:flex lg:w-3/5 relative overflow-hidden items-center justify-center p-16">
          <img 
            src={branding.loginCoverUrl || '/assets/images/cafe_login_cover.png'} 
            alt="Cafe Interior" 
            className="absolute inset-0 w-full h-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#1a1614] via-[#1a1614]/80 to-transparent" />
          
          <div className="relative z-10 max-w-lg space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold tracking-wider uppercase">
              <Coffee size={14} /> Artisan Cafe & Roastery POS
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight text-white">
              {branding.storeName}
            </h1>
            <p className="text-[#c7b7aa] leading-relaxed text-sm">
              {branding.loginTagline || 'Sistem operasional kasir, manajemen resep bahan baku, dan pemesanan meja real-time.'}
            </p>
            {branding.address && (
              <div className="flex items-start gap-2.5 text-xs text-[#a8988b]">
                <MapPin size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <span>{branding.address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Form Card */}
        <div className="w-full lg:w-2/5 flex items-center justify-center p-6 sm:p-12 bg-[#221d1a]">
          <div className="w-full max-w-md bg-[#2a2420] border border-amber-900/30 p-8 sm:p-10 rounded-3xl shadow-2xl">
            {renderLoginForm(true)}
          </div>
        </div>
      </div>
    );
  }

  // ─── DEFAULT LAYOUT: Split-Screen Modern (Preserves Existing Flow) ────────
  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* Side Hero Panel (Hidden on mobile/tablet) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-950 items-center justify-center">
        {/* Cover Image */}
        <img 
          src={branding.loginCoverUrl || '/assets/images/cafe_login_cover.png'} 
          alt="Cafe Interior" 
          className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-luminosity scale-105 hover:scale-100 transition-transform duration-10000"
        />
        {/* Decorative Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-950/80 to-transparent" />
        
        {/* Floating circles decoration */}
        <div 
          className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ backgroundColor: branding.primaryColor || '#4f46e5' }}
        />
        <div 
          className="absolute bottom-[-10%] right-[-10%] w-[30rem] h-[30rem] rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ backgroundColor: branding.accentColor || '#f59e0b' }}
        />

        {/* Content Box with glassmorphism */}
        <div className="relative z-10 p-16 max-w-xl text-white animate-fade-in">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-3xl border border-white/20 mb-8 overflow-hidden shadow-2xl p-2.5 transition-all">
            <img 
              src={branding.logoUrl || '/logo.png'} 
              alt={`${branding.storeName} Logo`} 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target.src !== window.location.origin + '/logo.png') {
                  target.src = '/logo.png';
                }
              }}
            />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-4 leading-tight">
            {branding.storeName}
          </h1>
          <p className="text-slate-300 leading-relaxed font-medium mb-8 text-sm">
            {branding.loginTagline || 'Platform modern untuk mengelola operasional kasir POS, Kitchen Display System (KDS), tata letak meja pelanggan, inventaris bahan baku, hingga jurnal akuntansi terintegrasi.'}
          </p>
          
          <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-sm max-w-sm">
            <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-300 font-bold tracking-wider uppercase">Sistem Aktif & Terisolasi Aman</span>
          </div>
        </div>
      </div>

      {/* Login Form Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-slate-50">
        <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-[2rem] shadow-xl border border-slate-100/80 transition-all duration-300 hover:shadow-2xl">
          {renderLoginForm(false)}
        </div>
      </div>
    </div>
  );
};

export default LoginView;
