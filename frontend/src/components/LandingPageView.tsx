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
  Shirt
} from 'lucide-react';
import { TenantRegisterWizard } from './TenantRegisterWizard';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';

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

  // Hero Carousel State (Gaya Kasir Pintar)
  const [currentHeroSlide, setCurrentHeroSlide] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);

  const heroSlides = [
    {
      id: 'pos-omzet',
      badge: 'Software POS & Ekosistem Bisnis Kafe #1',
      badgeIcon: Coffee,
      title: 'Kondisi Tak Menentu, Bisnis Kafe Tetap Maju',
      subtitle: 'Dipercaya oleh 500++ pengusaha kuliner di Indonesia. Catat transaksi kasir kilat 1.2 detik, cetak struk thermal otomatis, dan pantau pertumbuhan omzet real-time langsung dari smartphone Anda.',
      rating: '4.9',
      usersCount: '500+ Mitra Kafe & Resto',
      offlineStatus: '100% Offline-First',
      ctaText: 'Daftar Sekarang (Gratis 14 Hari)',
      image: '/assets/images/codenusa_hero_banner.jpg',
      imageAlt: 'Barista Ramah & Kasir Codenusa POS',
      floatingBadge: 'Penjualan Naik 45%',
      floatingSub: 'Omzet Real-time di HP'
    },
    {
      id: 'kds-dapur',
      badge: 'Layar Dapur Digital (Kitchen Display System)',
      badgeIcon: ChefHat,
      title: 'Dapur Cepat Tanpa Kertas, Pesanan Tepat Tanpa Cemas',
      subtitle: 'Layar Dapur Otomatis (KDS) menghubungkan kasir ke dapur dalam hitungan milidetik. Pesanan terpisah otomatis: makanan ke koki dapur, minuman ke barista bar tanpa tiket kertas tercecer.',
      rating: '4.9',
      usersCount: 'Waktu Saji 35% Lebih Cepat',
      offlineStatus: 'Sync Instan Dapur & Bar',
      ctaText: 'Coba Layar Dapur KDS',
      image: '/assets/images/chef_kitchen_kds.jpg',
      imageAlt: 'Koki Dapur Restoran Menggunakan KDS',
      floatingBadge: 'Dapur Rapi & Cepat',
      floatingSub: 'Routing Makanan & Bar'
    },
    {
      id: 'resep-hpp',
      badge: 'Resep Bahan Baku (BOM) & HPP Otomatis',
      badgeIcon: Package,
      title: 'Ketahui Untung Bersih, Stop Kebocoran Bahan Baku',
      subtitle: 'Formula Resep (BOM) presisi hingga gram & mililiter. Setiap menu terjual di kasir, stok biji kopi, susu, dan sirup langsung terpotong otomatis. Pantau HPP riil dan cegah limbah berlebih.',
      rating: '4.9',
      usersCount: 'Tekan Waste s/d 40%',
      offlineStatus: 'Audit Kasir Blind Z-Report',
      ctaText: 'Kelola Resep Sekarang',
      image: '/assets/images/fresh_ingredients_inventory.jpg',
      imageAlt: 'Manajemen Resep Bahan Baku & HPP',
      floatingBadge: 'HPP Presisi Tiap Porsi',
      floatingSub: 'Stok Terpotong Otomatis'
    },
    {
      id: 'retail-grosir',
      badge: 'Software Kasir Toko Grosir & Sembako #1',
      badgeIcon: Store,
      title: 'Transaksi Kilat Tanpa Antre, Hitung Grosir & Bon Otomatis',
      subtitle: 'Didesain khusus untuk toko grosir dan minimarket: scan barcode laser kilat, jual per dus/karton/bal langsung potong stok fisik, serta kelola buku bon warung langganan tanpa selisih.',
      rating: '4.9',
      usersCount: '400+ Mitra Grosir & Sembako',
      offlineStatus: 'Dukung Barcode Laser Scanner',
      ctaText: 'Coba Toko Grosir (Gratis 14 Hari)',
      image: '/assets/images/fresh_ingredients_inventory.jpg',
      imageAlt: 'Kasir Toko Grosir & Minimarket Cepat',
      floatingBadge: 'Multi-Satuan Dus/Bal',
      floatingSub: 'Buku Bon Warung Aman'
    },
    {
      id: 'laundry-kiloan',
      badge: 'Software Kasir Laundry Kiloan & Satuan #1',
      badgeIcon: Shirt,
      title: 'Timbang Kiloan Kilat, Pantau Rak & Notif WhatsApp',
      subtitle: 'Didesain khusus untuk usaha laundry kiloan & satuan: input timbangan desimal (Kg), varian aroma parfum, papan kanban pencucian s/d rak simpan, dan WhatsApp otomatis saat cucian siap diambil.',
      rating: '4.9',
      usersCount: '350+ Mitra Laundry Kiloan',
      offlineStatus: '100% Offline-First & Struk Thermal',
      ctaText: 'Coba Laundry (Gratis 14 Hari)',
      image: '/assets/images/codenusa_hero_banner.jpg',
      imageAlt: 'Kasir Laundry Kiloan & Satuan Codenusa POS',
      floatingBadge: 'Rak & Notif WA Otomatis',
      floatingSub: 'Desimal Kg & Varian Parfum'
    }
  ];

  // Auto-play interval slider (Kasir Pintar Style)
  useEffect(() => {
    if (isHeroPaused) return;
    const timer = setInterval(() => {
      setCurrentHeroSlide(prev => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [isHeroPaused, heroSlides.length]);

  const handleNextHeroSlide = () => {
    setCurrentHeroSlide(prev => (prev + 1) % heroSlides.length);
  };

  const handlePrevHeroSlide = () => {
    setCurrentHeroSlide(prev => (prev - 1 + heroSlides.length) % heroSlides.length);
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

  // Daftar Solusi Bisnis Kuliner (Gaya Kasir Pintar Kuliner)
  const culinarySolutions = [
    {
      title: 'Kasir Transaksi Cepat & Serba Lengkap',
      description: 'Catat pesanan pelanggan di kasir dalam 1 detik. Mendukung pembayaran Tunai, QRIS Dinamis, Debit, Kartu Kredit, dan Split Bill per meja secara otomatis.',
      badge: 'Point of Sale',
      image: '/assets/images/cafe_pos_hero.jpg',
      icon: Store,
      points: [
        'Multi tipe harga (Dine-in, Takeaway, dan Ojol Delivery)',
        'Cetak struk kasir via Thermal Bluetooth, USB, atau kirim struk digital WhatsApp',
        'Pecah tagihan (Split Bill) per orang atau per pesanan meja'
      ]
    },
    {
      title: 'Layar Dapur Otomatis (Kitchen Display System)',
      description: 'Hilangkan tiket kertas yang tercecer dan teriak-teriak antar staf. Pesanan kasir langsung muncul di layar tablet dapur koki dan barista bar secara real-time.',
      badge: 'Operasional Dapur',
      image: '/assets/images/chef_kitchen_kds.jpg',
      icon: ChefHat,
      points: [
        'Routing otomatis: Makanan ke Dapur, Minuman ke Barista Bar',
        'Timer durasi masak: Ketahui pesanan yang tertunda dengan warna peringatan',
        'Notifikasi ke waiter saat pesanan selesai disiapkan'
      ]
    },
    {
      title: 'Resep Bahan Baku (BOM) & HPP Otomatis',
      description: 'Ketahui keuntungan bersih tiap porsi makanan secara presisi. Setiap menu terjual di kasir, stok gramasi bahan mentah di gudang langsung terpotong otomatis.',
      badge: 'Manajemen Resep',
      image: '/assets/images/fresh_ingredients_inventory.jpg',
      icon: Package,
      points: [
        'Kalkulasi otomatis HPP (Harga Pokok Penjualan) per gram bahan baku',
        'Peringatan otomatis saat stok bahan baku menipis',
        'Catat food waste / limbah sisa produksi agar biaya tidak bocor'
      ]
    },
    {
      title: 'Laporan Finansial & Blind Z-Report Kasir',
      description: 'Tutup kasir harian tanpa cemas uang hilang. Fitur Blind Z-Report mewajibkan kasir menghitung fisik uang tunai tanpa melihat angka sistem terlebih dahulu.',
      badge: 'Keuangan & Laba',
      image: '/assets/images/cafe_pos_hero.jpg',
      icon: BarChart3,
      points: [
        'Rekonsiliasi otomatis selisih kas kasir setiap pergantian shift',
        'Laporan laba kotor, omzet harian/bulanan, dan jam ramai penjualan',
        'Pantau omzet semua cabang dari HP pemilik kapan saja'
      ]
    },
    {
      title: 'Kasir Laundry Kiloan, Satuan & Kanban Rak',
      description: 'Solusi lengkap operasional laundry modern: input timbangan desimal (Kg), pilihan aroma parfum, papan kanban cuci-kering-setrika, dan WhatsApp otomatis saat cucian siap diambil di rak.',
      badge: 'Spesialis Laundry',
      image: '/assets/images/codenusa_hero_banner.jpg',
      icon: Shirt,
      points: [
        'Input berat timbangan desimal (Kg), hitung otomatis harga kiloan & tier express',
        'Alokasi nomor rak simpan & WhatsApp notifikasi otomatis ke pelanggan',
        'Analisis aging rack (cucian mengendap) & kontrol stok deterjen/parfum'
      ]
    }
  ];

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
        <span>Solusi POS & Bisnis Kuliner #1: Uji coba gratis 14 hari tanpa kartu kredit!</span>
        <button 
          onClick={() => setIsRegisterOpen(true)}
          className="underline font-bold text-amber-300 hover:text-white ml-1 transition-colors"
        >
          Daftar Sekarang &rarr;
        </button>
      </div>

      {/* ─── 1. NAVBAR ALA KASIR PINTAR (SOFT INDIGO TONE) ───────────────── */}
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
                Solusi Kasir Bisnis Kuliner
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-600">
            <a href="#solusi" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
              <span>Solusi Kuliner</span>
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

      {/* ─── 2. HERO PROMO CAROUSEL (GAYA KASIR PINTAR BANNER) ─────────────── */}
      <section 
        className="relative overflow-hidden bg-gradient-to-br from-[#0b0f19] via-[#151733] to-[#25225c] text-white py-14 sm:py-20 lg:py-24"
        onMouseEnter={() => setIsHeroPaused(true)}
        onMouseLeave={() => setIsHeroPaused(false)}
      >
        {/* Ambient Glows */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none translate-y-1/2" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          {/* Arrow Navigation (Kiri & Kanan ala Kasir Pintar) */}
          <button
            onClick={handlePrevHeroSlide}
            aria-label="Slide Sebelumnya"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/25 border border-white/20 text-white flex items-center justify-center backdrop-blur-md shadow-xl transition-all hover:scale-110 active:scale-95"
          >
            <ChevronLeft size={22} />
          </button>

          <button
            onClick={handleNextHeroSlide}
            aria-label="Slide Selanjutnya"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/25 border border-white/20 text-white flex items-center justify-center backdrop-blur-md shadow-xl transition-all hover:scale-110 active:scale-95"
          >
            <ChevronRight size={22} />
          </button>

          {/* Current Slide Content */}
          {heroSlides.map((slide, index) => {
            if (index !== currentHeroSlide) return null;
            const BadgeIcon = slide.badgeIcon;

            return (
              <div 
                key={slide.id} 
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center px-4 sm:px-8 transition-opacity duration-500 animate-fadeIn"
              >
                
                {/* Left Column (Copywriting & CTA) */}
                <div className="lg:col-span-7 text-center lg:text-left">
                  
                  {/* Category Pill */}
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-amber-300 text-xs font-bold shadow-inner backdrop-blur-md mb-5">
                    <BadgeIcon size={14} className="text-amber-400" />
                    <span>{slide.badge}</span>
                  </div>

                  {/* Headline Utama */}
                  <h1 className="text-3xl sm:text-5xl lg:text-[3.25rem] font-black tracking-tight text-white leading-[1.14] mb-5">
                    {slide.title}
                  </h1>

                  {/* Subtitle / Penjelasan Solusi */}
                  <p className="text-base sm:text-lg text-slate-200 font-normal leading-relaxed mb-8 max-w-2xl">
                    {slide.subtitle}
                  </p>

                  {/* Proof Badges (Rating, Users, Offline) */}
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4 mb-8 text-xs sm:text-sm font-bold">
                    <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 backdrop-blur-sm">
                      <Star size={15} className="text-amber-400 fill-amber-400" />
                      <span>Rating {slide.rating}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 backdrop-blur-sm">
                      <Users size={15} className="text-indigo-300" />
                      <span>{slide.usersCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 backdrop-blur-sm">
                      <Zap size={15} className="text-emerald-400 fill-emerald-400" />
                      <span>{slide.offlineStatus}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 mb-8">
                    <button
                      onClick={() => setIsRegisterOpen(true)}
                      className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl text-sm sm:text-base font-black text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-400 shadow-xl shadow-amber-500/25 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <span>{slide.ctaText}</span>
                      <ArrowRight size={18} className="text-slate-950" />
                    </button>

                    <button
                      onClick={handleInstantDemoLogin}
                      disabled={demoLoading}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-sm sm:text-base font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md shadow-sm transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-70"
                    >
                      <Zap size={18} className="text-amber-400 fill-amber-400" />
                      <span>{demoLoading ? 'Menyiapkan Kasir...' : '⚡ Coba Demo Kasir (1-Klik)'}</span>
                    </button>
                  </div>

                  {/* Small Guarantee List */}
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
                      Gratis Bantuan Setup Menu
                    </span>
                  </div>

                </div>

                {/* Right Column (3D Pop-Out Visual AI) */}
                <div className="lg:col-span-5">
                  <div className="relative mx-auto max-w-md lg:max-w-none">
                    
                    {/* Frame Container */}
                    <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white/20 bg-slate-900 aspect-[16/10] sm:aspect-[4/3] group">
                      <img 
                        src={slide.image} 
                        alt={slide.imageAlt} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                      
                      {/* Top-Left Floating Badge */}
                      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-bold text-white flex items-center gap-2 shadow-lg">
                        <Sparkles size={14} className="text-amber-400" />
                        <span>{slide.floatingBadge}</span>
                      </div>

                      {/* Bottom Overlay Label */}
                      <div className="absolute bottom-4 left-4 right-4 text-white text-left">
                        <div className="text-sm font-black flex items-center gap-2">
                          <span>{slide.floatingSub}</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        </div>
                        <div className="text-[11px] text-slate-300">Ekosistem terintegrasi Codenusa POS</div>
                      </div>
                    </div>

                    {/* Floating Micro Badge Kiri Atas */}
                    <div className="hidden sm:flex absolute -top-4 -left-4 bg-white/90 backdrop-blur-md p-3 rounded-2xl border border-white/50 shadow-2xl items-center gap-2.5 text-xs text-slate-900">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                        <Zap size={16} />
                      </div>
                      <div>
                        <div className="font-extrabold text-[12px]">1.2 Detik</div>
                        <div className="text-[10px] text-slate-500 font-medium">Transaksi Kilat</div>
                      </div>
                    </div>

                    {/* Floating Micro Badge Kanan Bawah */}
                    <div className="hidden sm:flex absolute -bottom-5 -right-3 bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-white/50 shadow-2xl items-center gap-2.5 text-xs text-slate-900">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                        <Printer size={16} />
                      </div>
                      <div>
                        <div className="font-extrabold text-[12px]">Thermal / WA</div>
                        <div className="text-[10px] text-slate-500 font-medium">Struk Otomatis</div>
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            );
          })}

          {/* Bottom Dot Pagination (Ala Kasir Pintar) */}
          <div className="flex items-center justify-center gap-2.5 mt-10">
            {heroSlides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentHeroSlide(idx)}
                aria-label={`Pindah ke slide ${idx + 1}`}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  currentHeroSlide === idx 
                    ? 'w-8 bg-amber-400 shadow-md shadow-amber-400/50' 
                    : 'w-2.5 bg-white/30 hover:bg-white/60'
                }`}
              />
            ))}
          </div>

        </div>
      </section>

      {/* ─── 3. SOLUSI UNTUK BISNIS KULINER (GAYA KASIR PINTAR) ───────────── */}
      <section id="solusi" className="py-20 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider">
              Ekosistem Terintegrasi
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-3 mb-3">
              Solusi Lengkap untuk Segala Bisnis Kuliner
            </h2>
            <p className="text-sm sm:text-base text-slate-500">
              Dirancang khusus menjawab tantangan nyata operasional kafe, warung makan, resto cepat saji, hingga bisnis franchise multi-cabang.
            </p>
          </div>

          {/* Interactive Feature List & Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Solution Selector Cards */}
            <div className="lg:col-span-5 space-y-3">
              {culinarySolutions.map((sol, index) => {
                const IconComponent = sol.icon;
                const isActive = activeSolutionIndex === index;

                return (
                  <div
                    key={index}
                    onClick={() => setActiveSolutionIndex(index)}
                    className={`p-5 rounded-3xl border transition-all cursor-pointer text-left ${
                      isActive 
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' 
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
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                        }`}>
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

            {/* Right Column: Detailed Active Showcase with AI Image */}
            <div className="lg:col-span-7">
              <div className="bg-slate-50 rounded-[2.5rem] border border-slate-200/80 overflow-hidden shadow-sm flex flex-col justify-between">
                
                {/* Solution Cover Image */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-200">
                  <img 
                    src={culinarySolutions[activeSolutionIndex].image} 
                    alt={culinarySolutions[activeSolutionIndex].title}
                    className="w-full h-full object-cover transition-all duration-500 hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/20 to-transparent" />
                  <div className="absolute bottom-4 left-6">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-600 text-white shadow-sm">
                      {culinarySolutions[activeSolutionIndex].badge}
                    </span>
                    <div className="text-white font-black text-lg sm:text-xl mt-1">
                      {culinarySolutions[activeSolutionIndex].title}
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-8">
                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    {culinarySolutions[activeSolutionIndex].description}
                  </p>

                  <div className="space-y-3 pt-4 border-t border-slate-200">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Keunggulan Modul:</h4>
                    {culinarySolutions[activeSolutionIndex].points.map((pt, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                        <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                        <span>{pt}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <span className="text-xs text-slate-500">Ingin melihat langsung bagaimana fitur ini berjalan di kafe Anda?</span>
                    <button
                      onClick={() => setIsRegisterOpen(true)}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                    >
                      <span>Coba Fitur Ini Gratis</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>

              </div>
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
                Daftar & Beri Nama Toko
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Cukup masukkan nama kafe Anda dan tentukan tipe usaha kuliner Anda. Proses registrasi hanya butuh 60 detik!
              </p>
            </div>

            <div className="p-6 bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg mb-5 shadow-sm">
                2
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                Menu & Meja Siap Otomatis
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Sistem langsung membuatkan template menu makanan, minuman, dan tata letak meja standar yang siap pakai.
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
                Buka kasir di tablet atau HP Anda, klik menu pesanan, simulasikan pembayaran QRIS, dan hubungkan printer thermal Anda.
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
                <h4 className="text-sm font-bold text-slate-800">Butuh Bantuan Memasukkan Daftar Menu Toko Anda?</h4>
                <p className="text-xs text-slate-500">Tim spesialis kami siap membantu mengimpor daftar menu Anda secara gratis selama masa uji coba.</p>
              </div>
            </div>
            <a
              href="https://wa.me/6281234567890?text=Halo%20Tim%20Codenusa,%20saya%20ingin%20dibantu%20setup%20uji%20coba%20kafe%20saya"
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
        onSuccess={() => {
          setIsRegisterOpen(false);
        }}
      />

    </div>
  );
};

export default LandingPageView;
