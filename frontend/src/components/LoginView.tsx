import React, { useState, useContext } from 'react';
import { ShoppingCart, User, Lock, AlertCircle, Eye, EyeOff, Coffee } from 'lucide-react';
import { POSContext } from '../context/POSContext';

const LoginView = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const posContext = useContext(POSContext);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login gagal, periksa username dan password.');
      }

      if (posContext) {
        posContext.login(data.user, data.token);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* Side Hero Panel (Hidden on mobile/tablet) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-950 items-center justify-center">
        {/* Cover Image */}
        <img 
          src="/assets/images/cafe_login_cover.png" 
          alt="Cafe Interior" 
          className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-luminosity scale-105 hover:scale-100 transition-transform duration-10000"
        />
        {/* Decorative Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950 via-slate-950/80 to-transparent" />
        
        {/* Floating circles decoration */}
        <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30rem] h-[30rem] rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        {/* Content Box with glassmorphism */}
        <div className="relative z-10 p-16 max-w-xl text-white">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-black rounded-3xl border border-white/10 mb-8 overflow-hidden shadow-inner">
            <img src="/logo-sol-cafe.png" alt="SOL Cafe Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-4 leading-tight">
            SOL Cafe <span className="text-indigo-400 font-medium text-2xl block mt-1">Cafe Management Platform</span>
          </h1>
          <p className="text-slate-300 leading-relaxed font-medium mb-8 text-sm">
            Platform modern untuk mengelola operasional kasir, Kitchen Display System (KDS), tata letak meja pelanggan, inventaris bahan baku, hingga jurnal akuntansi otomatis dalam satu dashboard terintegrasi.
          </p>
          
          <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-sm max-w-sm">
            <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-300 font-bold tracking-wider uppercase">Sistem Aktif & Siap Digunakan</span>
          </div>
        </div>
      </div>

      {/* Login Form Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-slate-50">
        <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-[2rem] shadow-xl border border-slate-100/80 transition-all duration-300 hover:shadow-2xl">
          {/* Logo Header */}
          <div className="text-center lg:text-left mb-8">
            <div className="lg:hidden inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-black mb-4 overflow-hidden shadow-sm">
              <img src="/logo-sol-cafe.png" alt="SOL Cafe Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Selamat Datang</h2>
            <p className="text-slate-500 mt-2 font-medium text-sm">Masuk untuk mengakses kasir dan back-office</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 animate-headShake">
              <AlertCircle className="text-rose-500 mt-0.5 flex-shrink-0" size={18} />
              <p className="text-rose-700 text-xs font-semibold leading-relaxed">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User size={18} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 shadow-sm bg-slate-50/50 focus:bg-white text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none" 
                  placeholder="Masukkan username"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Password / PIN</label>
                <span className="text-xs text-slate-400 hover:text-indigo-600 cursor-pointer font-semibold transition-colors">Lupa Password?</span>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock size={18} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-12 py-3.5 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all duration-200 shadow-sm bg-slate-50/50 focus:bg-white text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none" 
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Quick Demo Helper Hint */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs text-slate-500 flex flex-col gap-2">
              <span className="font-bold text-slate-700">Informasi Akses Demo:</span>
              <div className="flex justify-between">
                <span>Username: <strong className="text-slate-700">admin</strong></span>
                <span>PIN: <strong className="text-slate-700">123456</strong></span>
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-4 px-4 border border-transparent rounded-2xl shadow-lg shadow-indigo-500/10 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
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
          </form>

          {/* Copyright */}
          <div className="mt-8 text-center text-xs text-slate-400 font-medium">
            &copy; 2026 SOL Cafe System &bull; Versi Premium
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
