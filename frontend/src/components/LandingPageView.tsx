import React, { useState, useEffect, useContext } from 'react';
import { 
  Sparkles, 
  Store, 
  ChefHat, 
  Layers, 
  BarChart3, 
  ShieldCheck, 
  Zap, 
  WifiOff, 
  CreditCard, 
  Printer, 
  Smartphone, 
  Monitor, 
  Clock, 
  TrendingUp, 
  ChevronRight, 
  ChevronLeft,
  Check, 
  X, 
  ArrowRight, 
  Utensils, 
  Users, 
  Package, 
  Building2, 
  HelpCircle, 
  QrCode, 
  CheckCircle2,
  Coffee,
  Star,
  Quote,
  Sliders,
  RefreshCw,
  Plus,
  Minus,
  Trash2,
  Play,
  HeartHandshake,
  MessageCircle,
  Laptop,
  Receipt,
  FileSpreadsheet,
  Split,
  ChevronDown,
  Shirt,
  Wrench
} from 'lucide-react';
import { TenantRegisterWizard } from './TenantRegisterWizard';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';
import { 
  VERTICAL_LANDING_ITEMS, 
  INDUSTRY_SOLUTIONS, 
  type VerticalId 
} from '../data/verticalLandingData';

interface LandingPageProps {
  onNavigateLogin?: () => void;
  onLaunchDemo?: () => void;
}

interface CartItem {
  id: number;
  name: string;
  price: number;
  qty: number;
  category: string;
}

export const LandingPageView: React.FC<LandingPageProps> = ({ 
  onNavigateLogin = () => { window.location.href = '/login'; }, 
  onLaunchDemo 
}) => {
  const posContext = useContext(POSContext);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [selectedPlanCode, setSelectedPlanCode] = useState('GROWTH');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('YEARLY');
  const [activeTab, setActiveTab] = useState<'pos' | 'kds' | 'warehouse' | 'analytics'>('pos');
  const [activeSolutionIndex, setActiveSolutionIndex] = useState<number>(0);
  const [demoLoading, setDemoLoading] = useState(false);

  // Multi-Vertical Landing State
  const getInitialVertical = (): VerticalId => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const vert = params.get('vertical')?.toLowerCase();
      if (vert === 'bengkel') return 'bengkel';
      if (vert === 'retail' || vert === 'grosir') return 'retail';
      if (vert === 'laundry') return 'laundry';
      if (vert === 'rental') return 'rental';
      if (vert === 'cafe' || vert === 'coffee') return 'cafe';
    }
    return 'cafe';
  };

  const [activeVertical, setActiveVertical] = useState<VerticalId>(getInitialVertical);
  const [selectedVerticalForRegister, setSelectedVerticalForRegister] = useState<string>('coffee');

  const currentVertical = VERTICAL_LANDING_ITEMS.find(v => v.id === activeVertical) || VERTICAL_LANDING_ITEMS[0];

  const handleSelectVertical = (vId: VerticalId) => {
    setActiveVertical(vId);
    if (typeof window !== 'undefined' && window.history) {
      const url = new URL(window.location.href);
      url.searchParams.set('vertical', vId);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleOpenRegisterWithVertical = (wizardType: string) => {
    setSelectedVerticalForRegister(wizardType);
    setSelectedPlanCode('GROWTH');
    setIsRegisterOpen(true);
  };
  
  // Interactive Simulator State
  const [simulatedTable, setSimulatedTable] = useState('Meja 04');
  const [simulatedCart, setSimulatedCart] = useState<CartItem[]>([
    { id: 1, name: 'Tori Paitan Ramen', price: 48000, qty: 2, category: 'Ramen' },
    { id: 3, name: 'Matcha Latte Ice', price: 28000, qty: 1, category: 'Drink' }
  ]);
  const [qrisModalOpen, setQrisModalOpen] = useState(false);

  // KDS Interactive Tickets
  const [kdsTickets, setKdsTickets] = useState([
    { id: 'TKT-041', table: 'Meja 08', elapsed: '04:12 m', items: ['1x Spicy Miso Ramen (Extra Nori)', '1x Gyoza Panggang (5 pcs)'], status: 'Pending' },
    { id: 'TKT-042', table: 'Meja 04', elapsed: '09:45 m', items: ['2x Tori Paitan Ramen', '1x Matcha Latte Ice'], status: 'Cooking' },
    { id: 'TKT-040', table: 'Meja 02', elapsed: '14:20 m', items: ['1x Shoyu Ramen Komplit', '2x Ocha Dingin'], status: 'Ready' }
  ]);

  const cartSubtotal = simulatedCart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const cartTax = Math.round(cartSubtotal * 0.1);
  const cartTotal = cartSubtotal + cartTax;

  const handleAddToCart = (item: { id: number; name: string; price: number; category: string }) => {
    setSimulatedCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const handleUpdateQty = (id: number, delta: number) => {
    setSimulatedCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQty = item.qty + delta;
          return newQty > 0 ? { ...item, qty: newQty } : null;
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const handleUpdateKdsStatus = (id: string, nextStatus: string) => {
    setKdsTickets(prev => prev.map(t => t.id === id ? { ...t, status: nextStatus } : t));
  };

  // 1-Klik Coba Demo Kasir Instan
  const handleInstantDemoLogin = async () => {
    setDemoLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'password' })
      });
      const data = await res.json();
      if (res.ok && data.token && posContext?.login) {
        posContext.login(data.user, data.token);
        toast('🎉 Masuk ke mode demo kasir kafe berhasil!', 'success');
        window.location.href = '/pos';
        return;
      }

      const resFallback = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: '123456' })
      });
      const dataFallback = await resFallback.json();
      if (resFallback.ok && dataFallback.token && posContext?.login) {
        posContext.login(dataFallback.user, dataFallback.token);
        toast('🎉 Masuk ke mode demo kasir kafe berhasil!', 'success');
        window.location.href = '/pos';
        return;
      }

      onNavigateLogin();
    } catch (err) {
      onNavigateLogin();
    } finally {
      setDemoLoading(false);
    }
  };

  const handleOpenRegisterWithPlan = (planCode: string) => {
    setSelectedPlanCode(planCode);
    setIsRegisterOpen(true);
  };

  // Pricing Data
  const pricingPlans = [
    {
      code: 'STARTER',
      name: 'Starter (UMKM)',
      description: 'Ideal untuk kedai kopi kecil, warung makan, atau usaha kuliner pemula.',
      priceMonthly: 79000,
      priceYearly: 65000,
      badge: null,
      features: [
        '1 Outlet / Cabang Toko',
        '1 Akun Kasir',
        'Maksimal 25 Menu Produk',
        'POS Kasir Cepat & Offline-First',
        'Layar Antrean Dapur & Bar (KDS)',
        'Manajemen Meja Pelanggan',
        'Buku Kas Harian & Z-Report',
        'Cetak Struk Thermal Bluetooth/USB'
      ]
    },
    {
      code: 'GROWTH',
      name: 'Growth (Berkembang)',
      description: 'Paling diminati untuk kafe ramai, coffeeshop, dan resto modern.',
      priceMonthly: 165000,
      priceYearly: 137000,
      badge: 'Paling Populer',
      features: [
        'Hingga 2 Outlet / Cabang',
        '5 Akun Staf Kasir & Dapur',
        'Maksimal 80 Menu Produk',
        'Resep Bahan Baku & HPP Otomatis',
        'Absensi GPS & Selfie Karyawan',
        'CRM Poin Loyalitas Pelanggan',
        'Dynamic QRIS Kasir Terintegrasi',
        'Semua Fitur di Paket Starter'
      ]
    },
    {
      code: 'BUSINESS',
      name: 'Business (Lengkap)',
      description: 'Solusi lengkap multi-cabang dengan gudang terpusat & payroll staf.',
      priceMonthly: 299000,
      priceYearly: 249000,
      badge: 'Multi-Cabang',
      features: [
        'Hingga 5 Outlet / Cabang',
        '20 Akun Pengguna & Manajer',
        'Maksimal 250 Menu Produk',
        'Gudang Pusat (Central Warehouse)',
        'Penggajian (Payroll) & Slip Gaji',
        'Kasbon & Cicilan Karyawan',
        'Bagi Hasil & Komisi Penjualan',
        'Manajemen Hutang Piutang Supplier'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      
      {/* ─── TOP ANNOUNCEMENT BAR ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 text-white text-xs py-2 px-4 text-center font-semibold flex items-center justify-center gap-2">
        <Sparkles size={14} className="text-amber-300 animate-spin" style={{ animationDuration: '6s' }} />
        <span>Solusi POS & Operasional Multi-UMKM #1: Uji coba gratis 14 hari tanpa kartu kredit!</span>
        <button 
          onClick={() => handleOpenRegisterWithVertical(currentVertical.wizardType)}
          className="underline font-bold text-amber-300 hover:text-white ml-1 transition-colors"
        >
          Daftar Sekarang &rarr;
        </button>
      </div>

      {/* ─── 1. NAVBAR MULTI-UMKM (SOFT INDIGO TONE) ───────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/70 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/25">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-1.5">
                CODENUSA <span className="text-indigo-600 font-extrabold">POS</span>
              </span>
              <span className="text-[10px] text-slate-500 font-semibold tracking-wide block -mt-1">
                Software Kasir & Operasional Multi-UMKM
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-600">
            <a href="#solusi" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
              <span>Solusi Industri</span>
            </a>
            <a href="#cara-kerja" className="hover:text-indigo-600 transition-colors">Cara Memulai</a>
            <a href="#simulator" className="hover:text-indigo-600 transition-colors">Simulasi POS</a>
            <a href="#perangkat" className="hover:text-indigo-600 transition-colors">Hardware</a>
            <a href="#pricing" className="hover:text-indigo-600 transition-colors">Harga Paket</a>
            <a href="#faq" className="hover:text-indigo-600 transition-colors">FAQ</a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onNavigateLogin}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-700 hover:text-indigo-600 hover:bg-slate-100 transition-all"
            >
              Masuk
            </button>
            
            {/* 1-Click Demo Button */}
            <button
              onClick={handleInstantDemoLogin}
              disabled={demoLoading}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition-all active:scale-95 disabled:opacity-70"
              title="Coba demo kasir langsung tanpa registrasi"
            >
              <Zap size={14} className="text-amber-500 fill-amber-500" />
              <span>{demoLoading ? 'Membuka...' : 'Coba Demo Kasir'}</span>
            </button>

            {/* Main CTA */}
            <button
              onClick={() => setIsRegisterOpen(true)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all active:scale-95"
            >
              <span>Daftar Gratis</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* ─── 2. HERO SECTION MULTI-VERTICAL (DILENGKAPI MOCKUP REALISTIS) ─────────────── */}
      <section 
        className="relative overflow-hidden bg-gradient-to-br from-[#0b0f19] via-[#111728] to-[#1c1938] text-white pt-10 pb-16 sm:pt-14 sm:pb-24"
      >
        {/* Ambient Glows */}
        <div className={`absolute top-0 left-1/4 w-[28rem] h-[28rem] ${currentVertical.theme.glowColor} rounded-full blur-3xl pointer-events-none -translate-y-1/2 transition-colors duration-700`} />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none translate-y-1/2" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          {/* Vertical Selector Bar (Pills 5 Vertikal) */}
          <div className="flex flex-col items-center mb-8 sm:mb-12">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 mb-3 flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-400" />
              <span>Pilih Jenis Usaha Anda untuk Melihat Solusi Spesifik:</span>
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 bg-slate-900/80 border border-slate-700/60 rounded-2xl sm:rounded-full backdrop-blur-xl shadow-2xl max-w-full">
              {VERTICAL_LANDING_ITEMS.map((item) => {
                const IconComp = item.badgeIcon;
                const isSelected = activeVertical === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectVertical(item.id)}
                    className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl sm:rounded-full text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer ${
                      isSelected
                        ? `${item.theme.accentBg} ${item.theme.accentText} border ${item.theme.accentBorder} shadow-lg scale-105`
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                    }`}
                  >
                    <IconComp size={16} className={isSelected ? item.theme.accentText : 'text-slate-400'} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic 2-Column Hero Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Column (Dynamic Copywriting & CTAs) */}
            <div className="lg:col-span-6 text-center lg:text-left">
              
              {/* Category Pill */}
              <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold shadow-inner backdrop-blur-md mb-5 ${currentVertical.theme.pillBg}`}>
                {React.createElement(currentVertical.badgeIcon, { size: 14, className: currentVertical.theme.accentText })}
                <span>{currentVertical.badge}</span>
              </div>

              {/* Dynamic Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-[3.1rem] font-black tracking-tight text-white leading-[1.14] mb-5">
                {currentVertical.title}
              </h1>

              {/* Dynamic Subtitle */}
              <p className="text-base sm:text-lg text-slate-200 font-normal leading-relaxed mb-8 max-w-xl">
                {currentVertical.subtitle}
              </p>

              {/* Proof Badges (Rating, Users, Offline) */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4 mb-8 text-xs sm:text-sm font-bold">
                <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 backdrop-blur-sm">
                  <Star size={15} className="text-amber-400 fill-amber-400" />
                  <span>Rating {currentVertical.rating}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 backdrop-blur-sm">
                  <Users size={15} className="text-indigo-300" />
                  <span>{currentVertical.usersCount}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 backdrop-blur-sm">
                  <Zap size={15} className="text-emerald-400 fill-emerald-400" />
                  <span>{currentVertical.offlineStatus}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 mb-8">
                <button
                  onClick={() => handleOpenRegisterWithVertical(currentVertical.wizardType)}
                  className={`w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl text-sm sm:text-base font-black shadow-xl transition-all hover:scale-[1.02] active:scale-95 bg-gradient-to-r ${currentVertical.theme.btnGradient}`}
                >
                  <span>{currentVertical.ctaText}</span>
                  <ArrowRight size={18} />
                </button>

                <button
                  onClick={handleInstantDemoLogin}
                  disabled={demoLoading}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-sm sm:text-base font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md shadow-sm transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-70"
                >
                  <Zap size={18} className="text-amber-400 fill-amber-400" />
                  <span>{demoLoading ? 'Menyiapkan...' : '⚡ Coba Demo Kasir (1-Klik)'}</span>
                </button>
              </div>

              {/* Guarantee List */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-5 text-xs text-slate-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-amber-400" />
                  14 Hari Gratis Penuh
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-amber-400" />
                  Tanpa Kartu Kredit
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-amber-400" />
                  Katalog & Data Contoh Otomatis
                </span>
              </div>

            </div>

            {/* Right Column (Live Adaptive POS Tablet Mockup Simulator) */}
            <div className="lg:col-span-6">
              <div className="relative mx-auto max-w-lg lg:max-w-none">
                
                {/* Tablet Frame */}
                <div className="relative rounded-3xl p-3 sm:p-4 bg-slate-900/90 border-2 border-slate-700/80 shadow-2xl backdrop-blur-xl group transition-all duration-500">
                  
                  {/* Tablet Top Bezel Camera & Status Bar */}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950/60 rounded-t-2xl border-b border-slate-800 text-[11px] text-slate-400 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-mono text-white text-[10px]">CodePOS v2.10 • {currentVertical.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">Offline-Ready ⚡</span>
                      <div className="w-2 h-2 rounded-full bg-slate-600" />
                    </div>
                  </div>

                  {/* Mockup Screen Body */}
                  <div className="bg-slate-950/90 rounded-2xl p-4 sm:p-5 border border-slate-800/80 text-left">
                    
                    {/* Header Row */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                      <div>
                        <div className="text-xs font-bold text-slate-400">{currentVertical.mockup.screenTitle}</div>
                        <div className="text-base font-black text-white flex items-center gap-2">
                          <span>{currentVertical.mockup.orderNumber}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${currentVertical.mockup.statusBadgeColor}`}>
                            {currentVertical.mockup.statusBadge}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">{currentVertical.mockup.infoLabel}</div>
                        <div className="text-xs font-bold text-slate-200">{currentVertical.mockup.infoValue}</div>
                      </div>
                    </div>

                    {/* Tag Pill */}
                    <div className="mb-3">
                      <span className="inline-block text-[11px] px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
                        {currentVertical.mockup.tagPill}
                      </span>
                    </div>

                    {/* Order / Transaction Items List */}
                    <div className="space-y-2 mb-4">
                      {currentVertical.mockup.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-slate-800/60 text-xs">
                          <div>
                            <div className="font-bold text-slate-200">{item.name}</div>
                            {item.tag && <div className="text-[10px] text-slate-400">{item.tag}</div>}
                          </div>
                          <div className="text-right pl-3">
                            <span className="text-slate-400 mr-2">{item.qty}</span>
                            <span className="font-mono font-bold text-white">{item.price}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Financial Summary */}
                    <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs mb-4">
                      <div className="flex justify-between text-slate-400">
                        <span>Subtotal Transaksi</span>
                        <span className="font-mono">{currentVertical.mockup.subtotal}</span>
                      </div>
                      {currentVertical.mockup.taxOrDeposit && (
                        <div className="flex justify-between text-amber-400/90 text-[11px]">
                          <span>{currentVertical.mockup.taxOrDeposit}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-black text-white pt-1 border-t border-slate-800/60">
                        <span>Total Pembayaran</span>
                        <span className="font-mono text-emerald-400">{currentVertical.mockup.total}</span>
                      </div>
                    </div>

                    {/* Action Button & Chips */}
                    <button 
                      onClick={() => handleOpenRegisterWithVertical(currentVertical.wizardType)}
                      className={`w-full py-2.5 rounded-xl text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer ${currentVertical.mockup.actionButtonColor}`}
                    >
                      {currentVertical.mockup.actionButtonText}
                    </button>

                    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-800/60">
                      {currentVertical.mockup.chips.map((chip, ci) => (
                        <span key={ci} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/70 text-slate-400 border border-slate-700/50">
                          ✓ {chip}
                        </span>
                      ))}
                    </div>

                  </div>

                  {/* Floating Micro Badge Kiri Atas */}
                  <div className="hidden sm:flex absolute -top-4 -left-4 bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-white/40 shadow-2xl items-center gap-2.5 text-xs text-slate-900">
                    <div className={`w-8 h-8 rounded-xl ${currentVertical.theme.accentBg} ${currentVertical.theme.accentText} flex items-center justify-center font-black`}>
                      {React.createElement(currentVertical.floatingMicroTop.icon, { size: 16 })}
                    </div>
                    <div>
                      <div className="font-extrabold text-[12px]">{currentVertical.floatingMicroTop.value}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{currentVertical.floatingMicroTop.label}</div>
                    </div>
                  </div>

                  {/* Floating Micro Badge Kanan Bawah */}
                  <div className="hidden sm:flex absolute -bottom-5 -right-3 bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-white/40 shadow-2xl items-center gap-2.5 text-xs text-slate-900">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                      {React.createElement(currentVertical.floatingMicroBottom.icon, { size: 16 })}
                    </div>
                    <div>
                      <div className="font-extrabold text-[12px]">{currentVertical.floatingMicroBottom.value}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{currentVertical.floatingMicroBottom.label}</div>
                    </div>
                  </div>

                </div>

              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ─── 3. SOLUSI BERDASARKAN JENIS USAHA UMKM ───────────── */}
      <section id="solusi" className="py-20 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider">
              Ekosistem Terintegrasi Multi-UMKM
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-3 mb-3">
              Solusi Lengkap untuk 5 Industri Usaha UMKM
            </h2>
            <p className="text-sm sm:text-base text-slate-500">
              Tidak ada sistem satu ukuran untuk semua. CodePOS menghadirkan modul operasional khusus yang menjawab kebutuhan spesifik bisnis Anda tanpa kompromi.
            </p>
          </div>

          {/* Interactive Feature List & Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Solution Selector Cards */}
            <div className="lg:col-span-5 space-y-3">
              {INDUSTRY_SOLUTIONS.map((sol, index) => {
                const IconComponent = sol.icon;
                const isActive = activeSolutionIndex === index;

                return (
                  <div
                    key={sol.id}
                    onClick={() => setActiveSolutionIndex(index)}
                    className={`p-5 rounded-3xl border transition-all cursor-pointer text-left ${
                      isActive 
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-500/20' 
                        : 'border-slate-200/80 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                        isActive ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <IconComponent size={20} />
                      </div>
                      <div>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${sol.badgeTone}`}>
                          {sol.badge}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 mt-1.5 mb-1">{sol.title}</h3>
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{sol.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Detailed Active Showcase */}
            <div className="lg:col-span-7">
              {(() => {
                const activeSol = INDUSTRY_SOLUTIONS[activeSolutionIndex] || INDUSTRY_SOLUTIONS[0];
                const ActiveIcon = activeSol.icon;
                return (
                  <div className="bg-slate-50 rounded-[2.5rem] border border-slate-200/80 overflow-hidden shadow-sm flex flex-col justify-between p-6 sm:p-8">
                    
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                        <ActiveIcon size={24} />
                      </div>
                      <div>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${activeSol.badgeTone}`}>
                          {activeSol.badge}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                          {activeSol.title}
                        </h3>
                      </div>
                    </div>

                    <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-6">
                      {activeSol.description}
                    </p>

                    <div className="space-y-3 pt-4 border-t border-slate-200">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Fitur Utama & Keunggulan Khusus:</h4>
                      {activeSol.points.map((pt, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
                          <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                          <span>{pt}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <span className="text-xs text-slate-500">Mulai operasional toko Anda hari ini tanpa kendala:</span>
                      <button
                        onClick={() => handleOpenRegisterWithVertical(activeSol.wizardType)}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
                      >
                        <span>Coba Gratis untuk {activeSol.title.split(',')[0]}</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>

                  </div>
                );
              })()}
            </div>

          </div>

        </div>
      </section>

      {/* ─── 4. CARA MEMULAI TAHAP UJI COBA (3 LANGKAH RAMAH) ──────────────── */}
      <section id="cara-kerja" className="py-16 bg-[#F8FAFC]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider">
              Kemudahan Memulai
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-3 mb-2">
              Mulai Uji Coba Tanpa Ribet dalam 3 Langkah
            </h2>
            <p className="text-sm text-slate-500">
              Tidak butuh instalasi teknis rumit. Langsung buka lewat browser HP, tablet, atau laptop.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg mb-5 shadow-sm">
                1
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                Daftar & Beri Nama Usaha
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Cukup masukkan nama toko/bengkel/sanggar Anda dan pilih bidang usaha Anda. Proses registrasi hanya butuh 60 detik!
              </p>
            </div>

            <div className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg mb-5 shadow-sm">
                2
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                Katalog & Modul Siap Otomatis
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Sistem langsung membuatkan data produk contoh, alur operasional, dan pengaturan standar sesuai vertikal usaha yang dipilih.
              </p>
            </div>

            <div className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg mb-5 shadow-sm">
                3
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                Langsung Buka Kasir & Cetak Struk
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Buka kasir di tablet, laptop, atau smartphone Anda, mulai transaksi pertama, dan hubungkan printer thermal Anda.
              </p>
            </div>

          </div>

          {/* Quick CS Support Helper */}
          <div className="mt-10 p-5 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-slate-50 rounded-3xl border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                <HeartHandshake size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Butuh Bantuan Memasukkan Daftar Katalog & Menu Usaha Anda?</h4>
                <p className="text-xs text-slate-500">Tim spesialis kami siap membantu mengimpor data produk Anda secara gratis selama masa uji coba.</p>
              </div>
            </div>
            <a
              href="https://wa.me/6281234567890?text=Halo%20Tim%20Codenusa,%20saya%20ingin%20dibantu%20setup%20uji%20coba%20usaha%20saya"
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 shadow-sm transition-all"
            >
              <MessageCircle size={15} />
              <span>Hubungi CS WhatsApp</span>
            </a>
          </div>

        </div>
      </section>

      {/* ─── 5. SIMULATOR LIVE INTERAKTIF ─────────────────────────────────── */}
      <section id="simulator" className="py-20 bg-white border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider">
              Uji Coba Langsung di Browser
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-3 mb-2">
              Rasakan Kemudahan Aplikasi Kasir Ini
            </h2>
            <p className="text-sm sm:text-base text-slate-500">
              Silakan klik menu makanan di bawah atau ganti tab untuk melihat bagaimana pesanan kasir dan tiket dapur terhubung secara real-time.
            </p>
          </div>

          {/* Simulator Tabs */}
          <div className="flex items-center justify-center gap-1.5 p-1.5 bg-slate-100 rounded-2xl max-w-xl mx-auto mb-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('pos')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === 'pos'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Store size={15} />
              <span>Kasir POS</span>
            </button>

            <button
              onClick={() => setActiveTab('kds')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === 'kds'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ChefHat size={15} />
              <span>Layar Dapur (KDS)</span>
            </button>

            <button
              onClick={() => setActiveTab('warehouse')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === 'warehouse'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package size={15} />
              <span>Resep HPP & Stok</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                activeTab === 'analytics'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 size={15} />
              <span>Laporan Kasir</span>
            </button>
          </div>

          {/* Simulator Container */}
          <div className="bg-[#F8FAFC] rounded-[2.5rem] border border-slate-200/80 shadow-md p-6 sm:p-8 min-h-[440px] relative overflow-hidden">
            
            {/* Top Bar */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-400" />
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="text-xs text-slate-500 font-mono ml-2">codenusa-pos // mode-simulasi-aktif</span>
              </div>
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                ● Live Interaktif
              </span>
            </div>

            {/* TAB 1: POS VIEW */}
            {activeTab === 'pos' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100">Semua Menu</span>
                      <span className="px-3 py-1 bg-white text-slate-600 rounded-lg text-xs font-bold border border-slate-200">Ramen & Mie</span>
                      <span className="px-3 py-1 bg-white text-slate-600 rounded-lg text-xs font-bold border border-slate-200">Minuman Kopi</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">Pilih Meja:</span>
                      <select
                        value={simulatedTable}
                        onChange={(e) => setSimulatedTable(e.target.value)}
                        className="px-2.5 py-1 bg-white border border-slate-200 text-slate-800 rounded-lg text-xs font-bold"
                      >
                        <option value="Meja 01">Meja 01</option>
                        <option value="Meja 04">Meja 04 (Indoor)</option>
                        <option value="Meja 08">Meja 08 (Outdoor)</option>
                        <option value="Takeaway">Takeaway (Bungkus)</option>
                      </select>
                    </div>
                  </div>

                  {/* Menu Items Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div 
                      onClick={() => handleAddToCart({ id: 1, name: 'Tori Paitan Ramen', price: 48000, category: 'Ramen' })}
                      className="p-3.5 bg-white hover:bg-indigo-50/40 rounded-2xl border border-slate-200/80 hover:border-indigo-300 transition-all cursor-pointer group shadow-sm"
                    >
                      <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-700">Tori Paitan Ramen</div>
                      <div className="text-xs text-indigo-600 font-black mt-1">Rp 48.000</div>
                      <div className="text-[10px] text-slate-400 mt-2 flex justify-between items-center">
                        <span>Stok: 42 porsi</span>
                        <span className="text-indigo-600 font-bold group-hover:underline">+ Tambah</span>
                      </div>
                    </div>

                    <div 
                      onClick={() => handleAddToCart({ id: 2, name: 'Spicy Miso Ramen', price: 52000, category: 'Ramen' })}
                      className="p-3.5 bg-white hover:bg-indigo-50/40 rounded-2xl border border-slate-200/80 hover:border-indigo-300 transition-all cursor-pointer group shadow-sm"
                    >
                      <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-700">Spicy Miso Ramen</div>
                      <div className="text-xs text-indigo-600 font-black mt-1">Rp 52.000</div>
                      <div className="text-[10px] text-slate-400 mt-2 flex justify-between items-center">
                        <span>Stok: 28 porsi</span>
                        <span className="text-indigo-600 font-bold group-hover:underline">+ Tambah</span>
                      </div>
                    </div>

                    <div 
                      onClick={() => handleAddToCart({ id: 3, name: 'Matcha Latte Ice', price: 28000, category: 'Drink' })}
                      className="p-3.5 bg-white hover:bg-indigo-50/40 rounded-2xl border border-slate-200/80 hover:border-indigo-300 transition-all cursor-pointer group shadow-sm"
                    >
                      <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-700">Matcha Latte Ice</div>
                      <div className="text-xs text-indigo-600 font-black mt-1">Rp 28.000</div>
                      <div className="text-[10px] text-slate-400 mt-2 flex justify-between items-center">
                        <span>Stok: 65 cup</span>
                        <span className="text-indigo-600 font-bold group-hover:underline">+ Tambah</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                    <span>💡 <em>Klik menu di atas untuk menambah item ke pesanan kasir</em></span>
                    <button 
                      onClick={() => setSimulatedCart([])}
                      className="text-slate-400 hover:text-rose-600 flex items-center gap-1 text-[11px] font-bold"
                    >
                      <Trash2 size={13} /> Reset
                    </button>
                  </div>
                </div>

                {/* Simulated Cart Summary */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-800">Pesanan Kasir</span>
                      <span className="text-[11px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md font-bold">{simulatedTable}</span>
                    </div>

                    <div className="space-y-2 py-3 text-xs max-h-[160px] overflow-y-auto">
                      {simulatedCart.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 text-xs">Keranjang masih kosong</div>
                      ) : (
                        simulatedCart.map(item => (
                          <div key={item.id} className="flex justify-between items-center text-slate-700">
                            <div>
                              <div className="font-bold text-slate-900">{item.name}</div>
                              <div className="text-[10px] text-slate-400">Rp {item.price.toLocaleString('id-ID')}</div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button 
                                onClick={() => handleUpdateQty(item.id, -1)}
                                className="w-5 h-5 bg-slate-100 border border-slate-200 rounded flex items-center justify-center hover:bg-slate-200 text-slate-600"
                              >
                                <Minus size={11} />
                              </button>
                              <span className="font-bold text-xs w-4 text-center">{item.qty}</span>
                              <button 
                                onClick={() => handleUpdateQty(item.id, 1)}
                                className="w-5 h-5 bg-slate-100 border border-slate-200 rounded flex items-center justify-center hover:bg-slate-200 text-slate-600"
                              >
                                <Plus size={11} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Pajak Resto (10%)</span>
                      <span>Rp {cartTax.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-slate-900">
                      <span>Total Tagihan</span>
                      <span className="text-indigo-600 font-bold">Rp {cartTotal.toLocaleString('id-ID')}</span>
                    </div>
                    <button 
                      onClick={() => setQrisModalOpen(true)}
                      disabled={simulatedCart.length === 0}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                    >
                      <CreditCard size={15} />
                      <span>Simulasi Bayar QRIS</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: KDS VIEW */}
            {activeTab === 'kds' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
                {kdsTickets.map(ticket => {
                  const isPending = ticket.status === 'Pending';
                  const isCooking = ticket.status === 'Cooking';

                  return (
                    <div 
                      key={ticket.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isCooking 
                          ? 'bg-indigo-50/70 border-indigo-200 shadow-sm' 
                          : isPending 
                            ? 'bg-amber-50/70 border-amber-200' 
                            : 'bg-emerald-50/70 border-emerald-200'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-black text-slate-900">{ticket.id} • {ticket.table}</span>
                        <span className="text-[11px] font-mono font-bold flex items-center gap-1 text-slate-500">
                          <Clock size={13} /> {ticket.elapsed}
                        </span>
                      </div>

                      <div className="text-xs text-slate-700 space-y-1.5 mb-4 min-h-[48px]">
                        {ticket.items.map((it, idx) => (
                          <div key={idx} className="font-semibold">• {it}</div>
                        ))}
                      </div>

                      {isPending && (
                        <button 
                          onClick={() => handleUpdateKdsStatus(ticket.id, 'Cooking')}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm active:scale-95"
                        >
                          Mulai Masak (Cooking)
                        </button>
                      )}

                      {isCooking && (
                        <button 
                          onClick={() => handleUpdateKdsStatus(ticket.id, 'Ready')}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm active:scale-95"
                        >
                          Siap Saji (Ready)
                        </button>
                      )}

                      {!isPending && !isCooking && (
                        <div className="text-center py-2 bg-emerald-100/80 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1">
                          <CheckCircle2 size={14} /> Siap Diantar Waiter
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 3: RESEP & GUDANG */}
            {activeTab === 'warehouse' && (
              <div className="space-y-4 animate-fade-in text-left">
                <div className="p-4 bg-white rounded-2xl border border-slate-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-800">Komposisi Resep HPP: Tori Paitan Ramen</span>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      HPP: Rp 16.400 / Porsi
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-600 mt-3">
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                      <div className="font-bold text-slate-800">Mie Basah Ramen</div>
                      <div className="text-[11px] text-slate-400">120 gram (Rp 4.200)</div>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                      <div className="font-bold text-slate-800">Kuah Kaldu Paitan</div>
                      <div className="text-[11px] text-slate-400">250 ml (Rp 7.500)</div>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                      <div className="font-bold text-slate-800">Chashu Ayam & Telur</div>
                      <div className="text-[11px] text-slate-400">1 set komplit (Rp 4.700)</div>
                    </div>
                  </div>
                </div>
                <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 text-xs text-slate-600 flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-600 shrink-0" />
                  <span>Saat kasir mencatat penjualan 1 porsi Tori Paitan, stok mie, kaldu, dan telur di gudang otomatis terpotong presisi!</span>
                </div>
              </div>
            )}

            {/* TAB 4: LAPORAN Z-REPORT */}
            {activeTab === 'analytics' && (
              <div className="space-y-4 animate-fade-in text-left">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 bg-white rounded-2xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">Total Omzet Shift Kasir</div>
                    <div className="text-lg font-black text-slate-900 mt-1">Rp 3.420.000</div>
                    <div className="text-[11px] text-emerald-600 font-bold mt-1">48 Transaksi Selesai</div>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">Pembayaran QRIS / Non-Tunai</div>
                    <div className="text-lg font-black text-slate-900 mt-1">Rp 2.150.000</div>
                    <div className="text-[11px] text-indigo-600 font-bold mt-1">Langsung Masuk Rekening</div>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">Uang Fisik di Laci Kasir</div>
                    <div className="text-lg font-black text-slate-900 mt-1">Rp 1.270.000</div>
                    <div className="text-[11px] text-emerald-600 font-bold mt-1">Selisih Kasir: Rp 0 (Pas)</div>
                  </div>
                </div>
                <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                  <span>Fitur Blind Z-Report kami mencegah kasir memanipulasi pembukuan uang setoran saat penutupan shift harian.</span>
                </div>
              </div>
            )}

          </div>

        </div>
      </section>

      {/* ─── 6. HARDWARE & PERANGKAT BEBAS (ALA KASIR PINTAR) ──────────────── */}
      <section id="perangkat" className="py-16 bg-[#F8FAFC]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider">
              Kompatibel & Fleksibel
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 mb-2">
              Bisa Digunakan di Berbagai Perangkat
            </h2>
            <p className="text-sm text-slate-500">
              Tidak perlu membeli mesin kasir khusus puluhan juta. Manfaatkan smartphone, tablet, atau laptop yang sudah Anda miliki.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 text-center shadow-sm">
              <Smartphone className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
              <div className="text-sm font-bold text-slate-800">HP Android & iPhone</div>
              <div className="text-[11px] text-slate-500 mt-1">Untuk kasir keliling & waiter</div>
            </div>

            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 text-center shadow-sm">
              <Monitor className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
              <div className="text-sm font-bold text-slate-800">Tablet iPad & Android</div>
              <div className="text-[11px] text-slate-500 mt-1">Tampilan meja kasir estetik</div>
            </div>

            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 text-center shadow-sm">
              <Laptop className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
              <div className="text-sm font-bold text-slate-800">Laptop / PC Kasir</div>
              <div className="text-[11px] text-slate-500 mt-1">Back-office & laporan pemilik</div>
            </div>

            <div className="p-5 bg-white rounded-3xl border border-slate-200/80 text-center shadow-sm">
              <Printer className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
              <div className="text-sm font-bold text-slate-800">Printer Thermal 58/80mm</div>
              <div className="text-[11px] text-slate-500 mt-1">Koneksi Bluetooth, USB & LAN</div>
            </div>
          </div>

        </div>
      </section>

      {/* ─── 7. PAKET HARGA (TRANSPARAN & MUDAH DIPAHAMI) ──────────────────── */}
      <section id="pricing" className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider">
              Biaya Ramah UMKM
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-3 mb-2">
              Paket Harga Bersahabat Tanpa Biaya Tersembunyi
            </h2>
            <p className="text-sm sm:text-base text-slate-500 mb-6">
              Semua paket sudah termasuk masa uji coba 14 hari penuh secara gratis.
            </p>

            {/* Toggle Billing */}
            <div className="inline-flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl">
              <button
                onClick={() => setBillingCycle('MONTHLY')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  billingCycle === 'MONTHLY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Bayar Bulanan
              </button>
              <button
                onClick={() => setBillingCycle('YEARLY')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  billingCycle === 'YEARLY' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600'
                }`}
              >
                <span>Bayar Tahunan</span>
                <span className="px-1.5 py-0.5 bg-amber-400 text-slate-950 rounded-full text-[10px] font-black">Hemat 20%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {pricingPlans.map(plan => {
              const price = billingCycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;
              const isPopular = plan.code === 'GROWTH';

              return (
                <div
                  key={plan.code}
                  className={`bg-white rounded-[2.5rem] p-6 sm:p-8 border transition-all flex flex-col justify-between ${
                    isPopular 
                      ? 'border-indigo-600 shadow-xl shadow-indigo-600/10 scale-[1.02] relative ring-2 ring-indigo-600/20' 
                      : 'border-slate-200/80 shadow-sm hover:shadow-md'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-full shadow-sm">
                      Paling Banyak Dipilih
                    </div>
                  )}

                  <div>
                    <h3 className="text-lg font-black text-slate-900">{plan.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 min-h-[32px]">{plan.description}</p>

                    <div className="my-5 pb-5 border-b border-slate-100">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-black text-slate-900">
                          Rp {price.toLocaleString('id-ID')}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">/bulan</span>
                      </div>
                      <div className="text-[11px] text-indigo-600 font-bold mt-1">
                        {billingCycle === 'YEARLY' ? 'Ditagih per tahun (Hemat 20%)' : 'Ditagih per bulan'}
                      </div>
                    </div>

                    <div className="space-y-2.5 text-xs text-slate-600 mb-6">
                      {plan.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenRegisterWithPlan(plan.code)}
                    className={`w-full py-3.5 rounded-2xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 ${
                      isPopular
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/25'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    <span>Mulai Uji Coba Gratis</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ─── 8. FAQ & TANYA JAWAB (ALA KASIR PINTAR) ───────────────────────── */}
      <section id="faq" className="py-16 bg-[#F8FAFC] border-t border-slate-200/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">
              Pertanyaan Seputar Uji Coba Codenusa POS
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Jawaban atas keraguan Anda sebelum memulai uji coba gratis.
            </p>
          </div>

          <div className="space-y-3.5">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <h4 className="text-sm font-bold text-slate-900 mb-1">Apakah masa uji coba 14 hari benar-benar gratis?</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ya, 100% gratis tanpa biaya pendaftaran dan tanpa meminta kartu kredit. Anda dapat menguji seluruh fitur POS kasir, KDS layar dapur, hingga kartu stok bahan baku secara bebas.
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <h4 className="text-sm font-bold text-slate-900 mb-1">Apakah data jualan saya akan hilang setelah masa uji coba berakhir?</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tidak. Semua data menu, stok bahan baku, dan riwayat transaksi tersimpan aman di database cloud. Saat Anda memutuskan melanjutkan langganan, semua data tetap utuh.
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <h4 className="text-sm font-bold text-slate-900 mb-1">Apakah aplikasi ini bisa tetap jalan saat internet di kafe mati?</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Bisa! Codenusa POS mengusung teknologi Offline-First. Kasir tetap bisa membuat pesanan dan mencetak struk secara offline, lalu otomatis tersinkronisasi saat sinyal kembali normal.
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <h4 className="text-sm font-bold text-slate-900 mb-1">Apakah bisa saya coba tanpa harus mengisi formulir pendaftaran dulu?</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Sangat bisa! Cukup klik tombol <strong>"Coba Demo Kasir (1-Klik)"</strong> di atas. Anda akan langsung masuk ke akun demo kasir dengan produk ramen, kopi, dan denah meja yang sudah terisi lengkap.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ─── 9. BOTTOM CTA BANNER (WARM & CONVERTING) ──────────────────────── */}
      <section className="py-16 bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight mb-3">
            Siap Memajukan Operasional Kafe & Restoran Anda?
          </h2>
          <p className="text-sm sm:text-base text-indigo-100 max-w-xl mx-auto mb-8">
            Bergabunglah dengan ratusan pengusaha kuliner di Indonesia. Uji coba gratis 14 hari penuh, langsung siap jualan hari ini.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              onClick={() => setIsRegisterOpen(true)}
              className="w-full sm:w-auto px-8 py-4 bg-white text-indigo-700 hover:bg-slate-50 font-extrabold text-sm sm:text-base rounded-2xl shadow-lg shadow-black/10 transition-all hover:scale-[1.02] active:scale-95"
            >
              Mulai Uji Coba Gratis 14 Hari
            </button>
            <button
              onClick={handleInstantDemoLogin}
              disabled={demoLoading}
              className="w-full sm:w-auto px-6 py-4 bg-indigo-800/80 hover:bg-indigo-800 text-white font-bold text-sm sm:text-base rounded-2xl border border-indigo-400/40 transition-all flex items-center justify-center gap-2"
            >
              <Zap size={18} className="text-amber-300 fill-amber-300" />
              <span>{demoLoading ? 'Menyiapkan...' : 'Coba Demo Kasir (1-Klik)'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ─── 10. FOOTER ALA SAAS MODERN ────────────────────────────────────── */}
      <footer className="py-12 bg-white border-t border-slate-200 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-[11px]">
              C
            </div>
            <span className="font-bold text-slate-900">Codenusa POS</span>
            <span>&bull; Ekosistem SaaS & POS Bisnis Kuliner Indonesia</span>
          </div>
          <div>
            &copy; 2026 Codenusa POS. Seluruh hak cipta dilindungi undang-undang.
          </div>
        </div>
      </footer>

      {/* ─── MODAL SIMULASI QRIS ───────────────────────────────────────────── */}
      {qrisModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl text-center">
            <h3 className="text-base font-bold text-slate-900 mb-1">Simulasi Pembayaran QRIS</h3>
            <p className="text-xs text-slate-500 mb-4">Total Tagihan: <strong className="text-indigo-600 font-bold">Rp {cartTotal.toLocaleString('id-ID')}</strong></p>
            
            <div className="w-48 h-48 mx-auto bg-slate-50 rounded-2xl border border-slate-200 p-3 flex items-center justify-center mb-4">
              <QrCode size={140} className="text-slate-800" />
            </div>

            <p className="text-[11px] text-slate-400 mb-4">
              Terhubung otomatis dengan Midtrans Direct (BYOK). Uang langsung cair ke rekening bank Anda.
            </p>

            <button
              onClick={() => {
                setQrisModalOpen(false);
                toast('Simulasi pembayaran QRIS berhasil diselesaikan!', 'success');
                setSimulatedCart([]);
              }}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all"
            >
              Tutup & Selesaikan Transaksi
            </button>
          </div>
        </div>
      )}

      {/* ─── REGISTER TRIAL WIZARD MODAL ───────────────────────────────────── */}
      <TenantRegisterWizard
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        initialPlan={selectedPlanCode}
        initialBusinessType={selectedVerticalForRegister}
        onSuccess={() => {
          setIsRegisterOpen(false);
        }}
      />

    </div>
  );
};

export default LandingPageView;
