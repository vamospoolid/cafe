import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Lock, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  LogIn, 
  Coffee, 
  MapPin, 
  ShieldCheck, 
  Zap, 
  Store, 
  X,
  Sparkles,
  Smartphone
} from 'lucide-react';
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
  storeName: 'CodePOS',
  logoUrl: '/logo.png',
  tenantSlug: 'platform',
  tenantName: 'CodePOS',
  address: '',
  phone: '',
  primaryColor: '#4f46e5',
  accentColor: '#f59e0b',
  loginLayout: 'split_modern',
  loginCoverUrl: '/assets/images/cafe_login_cover.png',
  loginTagline: 'Sistem Kasir & Manajemen Bisnis',
  faviconUrl: null,
  hidePlatformBranding: false
};

const LoginView: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
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

  const sanitizeTagline = (str?: string) => {
    if (!str) return 'Sistem Kasir & Manajemen Bisnis';
    if (str.toLowerCase().includes('saas') || str.toLowerCase().includes('multi-outlet')) {
      return 'Sistem Kasir & Manajemen Bisnis';
    }
    return str;
  };

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
            loginTagline: sanitizeTagline(data.loginTagline) || prev.loginTagline
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
              loginTagline: sanitizeTagline(data.loginTagline) || prev.loginTagline
            }));
          }
        }
      } catch (e) {}
    }, 400);
    return () => clearTimeout(timer);
  }, [username]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Mohon isi username dan kata sandi / PIN.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const params = new URLSearchParams(window.location.search);
      const tenantSlug = params.get('tenant') || params.get('slug') || branding.tenantSlug;

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password, tenantSlug })
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

  // Reusable Form Component with Refined UX & Aesthetics
  const renderLoginForm = (isGlassDark = false) => (
    <>
      {/* Header Logo & Title */}
      <div className="text-center mb-7 sm:mb-8">
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4 overflow-hidden shadow-lg p-2.5 transition-all duration-300 hover:scale-105 ${
          isGlassDark 
            ? 'bg-white/10 border border-white/20 backdrop-blur-md shadow-black/20' 
            : 'bg-white border border-slate-100 shadow-slate-200/80'
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
          {branding.loginTagline || 'Sistem Kasir & Manajemen Bisnis'}
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200/90 rounded-2xl flex items-start gap-3 animate-headShake shadow-sm">
          <AlertCircle className="text-rose-500 mt-0.5 flex-shrink-0" size={18} />
          <div className="flex-1">
            <p className="text-rose-800 text-xs font-semibold leading-relaxed">{error}</p>
          </div>
          <button 
            type="button" 
            onClick={() => setError('')} 
            className="text-rose-400 hover:text-rose-600 transition-colors p-0.5"
            aria-label="Tutup pesan error"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Form Fields */}
      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label className={`block text-xs font-extrabold uppercase tracking-wider mb-2 ${isGlassDark ? 'text-slate-200' : 'text-slate-700'}`}>
            Username Kasir / Admin
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <User size={18} className={`transition-colors ${isGlassDark ? 'text-slate-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`} />
            </div>
            <input 
              ref={usernameInputRef}
              type="text" 
              value={username}
              autoFocus
              autoComplete="username"
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  passwordInputRef.current?.focus();
                }
              }}
              className={`block w-full pl-11 pr-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-medium focus:outline-none ${
                isGlassDark 
                  ? 'bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:bg-white/20 focus:border-white/40 focus:ring-4 focus:ring-white/10' 
                  : 'bg-slate-50/80 border border-slate-200/90 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 hover:border-slate-300'
              }`}
              placeholder="Masukkan username akun Anda"
              required
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className={`block text-xs font-extrabold uppercase tracking-wider ${isGlassDark ? 'text-slate-200' : 'text-slate-700'}`}>
              Password / PIN
            </label>
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className={`text-xs cursor-pointer font-semibold transition-colors focus:outline-none ${
                isGlassDark ? 'text-slate-300 hover:text-white' : 'text-indigo-600 hover:text-indigo-700 hover:underline'
              }`}
            >
              Lupa PIN?
            </button>
          </div>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock size={18} className={`transition-colors ${isGlassDark ? 'text-slate-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`} />
            </div>
            <input 
              ref={passwordInputRef}
              type={showPassword ? "text" : "password"} 
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              className={`block w-full pl-11 pr-12 py-3.5 rounded-2xl transition-all duration-200 text-sm font-medium focus:outline-none ${
                isGlassDark 
                  ? 'bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:bg-white/20 focus:border-white/40 focus:ring-4 focus:ring-white/10' 
                  : 'bg-slate-50/80 border border-slate-200/90 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 hover:border-slate-300'
              }`}
              placeholder="Masukkan kata sandi atau PIN"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              className={`absolute inset-y-0 right-0 pr-4 flex items-center transition-colors focus:outline-none ${
                isGlassDark ? 'text-slate-300 hover:text-white' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Submit Button with Dynamic Custom Brand Color & Glow */}
        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            backgroundColor: branding.primaryColor || '#4f46e5',
            boxShadow: `0 10px 25px -5px ${branding.primaryColor || '#4f46e5'}40`
          }}
          className="w-full flex justify-center items-center gap-2.5 py-4 px-4 rounded-2xl text-sm font-black text-white hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-[0.98] cursor-pointer mt-3"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Memverifikasi Kredensial...</span>
            </>
          ) : (
            <>
              <LogIn size={18} />
              <span>Masuk Sekarang</span>
            </>
          )}
        </button>
      </form>

      {/* APK Downloads Links (Kasir & Mobile Admin) */}
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2">
        <a
          href="/downloads/pos.apk"
          download="mukiramen-pos-tablet.apk"
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-xs ${
            isGlassDark 
              ? 'bg-white/10 hover:bg-white/20 text-indigo-200 border border-white/10' 
              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100'
          }`}
          title="Unduh file APK khusus tablet kasir Android"
        >
          <Smartphone size={13} />
          <span>APK Kasir Tablet</span>
        </a>

        <a
          href="/downloads/admin.apk"
          download="mukiramen-admin.apk"
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-xs ${
            isGlassDark 
              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30' 
              : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
          }`}
          title="Unduh file APK khusus Mobile Admin & Owner Android"
        >
          <Smartphone size={13} />
          <span>APK Mobile Admin</span>
        </a>
      </div>

      {/* Clean Standalone Branding Footer */}
      <div className="mt-6 pt-4 border-t border-slate-100/60 text-center">
        <div className={`text-xs font-semibold ${isGlassDark ? 'text-slate-400' : 'text-slate-400'}`}>
          Powered by <strong className={isGlassDark ? 'text-slate-200' : 'text-slate-700'}>CodePOS</strong> &bull; Sistem Kasir Pintar
        </div>
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
          alt="Atmosphere" 
          className="absolute inset-0 w-full h-full object-cover scale-105"
        />
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xl" />
        <div 
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ backgroundColor: branding.primaryColor || '#4f46e5' }}
        />
        <div 
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-25 pointer-events-none"
          style={{ backgroundColor: branding.accentColor || '#f59e0b' }}
        />

        {/* Floating Glass Card */}
        <div className="relative z-10 w-full max-w-md bg-slate-900/75 border border-white/20 p-8 sm:p-10 rounded-[2.5rem] shadow-2xl backdrop-blur-2xl transition-all duration-300">
          {renderLoginForm(true)}
        </div>

        {/* Forgot PIN Modal */}
        {showForgotModal && renderForgotModal()}
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
        {/* Forgot PIN Modal */}
        {showForgotModal && renderForgotModal()}
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
              <Coffee size={14} /> Japanese Ramen Bar & Cafe POS
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight text-white">
              {branding.storeName}
            </h1>
            <p className="text-[#c7b7aa] leading-relaxed text-sm">
              {branding.loginTagline || 'Sistem operasional kasir terpadu, resep bahan baku, dan pemesanan meja real-time.'}
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
        {/* Forgot PIN Modal */}
        {showForgotModal && renderForgotModal()}
      </div>
    );
  }

  // ─── FORGOT PIN MODAL HELPER ─────────────────────────────────────────────
  function renderForgotModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl border border-slate-100 text-slate-800 space-y-4 animate-scale-in">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
            <ShieldCheck size={26} />
          </div>
          <div className="text-center space-y-1.5">
            <h3 className="text-base font-extrabold text-slate-900">Bantuan Lupa PIN / Sandi</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Demi keamanan kasir dan data toko Anda, silakan hubungi <strong>Store Manager</strong> atau <strong>Owner</strong> untuk melakukan reset PIN akun kasir Anda melalui menu <em>Karyawan</em>.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── DEFAULT LAYOUT: Split-Screen Modern (Elevated UX & Aesthetics) ──────
  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* Side Hero Panel (Hidden on mobile/small tablets) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-950 items-center justify-center">
        {/* Cover Atmosphere Image */}
        <img 
          src={branding.loginCoverUrl || '/assets/images/cafe_login_cover.png'} 
          alt="Cafe Interior" 
          className="absolute inset-0 w-full h-full object-cover opacity-45 mix-blend-luminosity scale-105 transition-transform duration-10000"
        />
        {/* Decorative Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-950/85 to-slate-900/60" />
        
        {/* Floating Ambient Glowing Blobs */}
        <div 
          className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] rounded-full blur-3xl pointer-events-none opacity-25"
          style={{ backgroundColor: branding.primaryColor || '#4f46e5' }}
        />
        <div 
          className="absolute bottom-[-10%] right-[-10%] w-[30rem] h-[30rem] rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ backgroundColor: branding.accentColor || '#f59e0b' }}
        />

        {/* Content Box with Modern Micro-Pills */}
        <div className="relative z-10 p-14 lg:p-16 max-w-xl text-white space-y-8 animate-fade-in">
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-3xl border border-white/20 overflow-hidden shadow-2xl p-3 transition-transform hover:scale-105">
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
            <h1 className="text-4xl font-black tracking-tight leading-tight">
              {branding.storeName}
            </h1>
            <p className="text-slate-300 leading-relaxed font-medium text-sm max-w-md">
              {branding.loginTagline || 'Sistem operasional kasir, Kitchen Display System (KDS), tata letak meja pelanggan, dan inventaris bahan baku terpadu.'}
            </p>
          </div>

          {/* Standalone Feature Highlights */}
          <div className="space-y-3.5 pt-2">
            <div className="flex items-center gap-3.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-3.5 shadow-sm transition-all hover:bg-white/10">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Zap size={16} />
              </div>
              <span className="text-xs font-semibold text-slate-200">Transaksi Kasir Cepat & Cetak Struk Instan</span>
            </div>

            <div className="flex items-center gap-3.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-3.5 shadow-sm transition-all hover:bg-white/10">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <Store size={16} />
              </div>
              <span className="text-xs font-semibold text-slate-200">Kitchen Display System (KDS) & Manajemen Meja</span>
            </div>

            <div className="flex items-center gap-3.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-3.5 shadow-sm transition-all hover:bg-white/10">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <span className="text-xs font-semibold text-slate-200">Kontrol Resep, Stok Bahan & Laporan Keuangan Akurat</span>
            </div>
          </div>
          
          {/* Status Indicator Badge */}
          <div className="inline-flex items-center gap-2.5 bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 shadow-inner">
            <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-200 font-bold tracking-wider uppercase">Sistem Kasir Siap Digunakan</span>
          </div>
        </div>
      </div>

      {/* Login Form Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-slate-50">
        <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-xl border border-slate-100 transition-all duration-300 hover:shadow-2xl">
          {renderLoginForm(false)}
        </div>
      </div>

      {/* Forgot PIN Modal */}
      {showForgotModal && renderForgotModal()}
    </div>
  );
};

export default LoginView;
