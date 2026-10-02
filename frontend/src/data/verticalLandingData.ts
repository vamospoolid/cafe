import { 
  Coffee, 
  Wrench, 
  Package, 
  Shirt, 
  Sparkles, 
  Store, 
  ChefHat, 
  BarChart3, 
  ShieldCheck, 
  Zap, 
  Clock, 
  QrCode, 
  Users 
} from 'lucide-react';
import React from 'react';

export type VerticalId = 'cafe' | 'bengkel' | 'retail' | 'laundry' | 'rental';

export interface VerticalLandingItem {
  id: VerticalId;
  label: string;
  sublabel: string;
  wizardType: string; // Type passed to TenantRegisterWizard
  badge: string;
  badgeIcon: React.ElementType;
  title: string;
  subtitle: string;
  rating: string;
  usersCount: string;
  offlineStatus: string;
  ctaText: string;
  theme: {
    accentText: string;
    accentBg: string;
    accentBorder: string;
    btnGradient: string;
    glowColor: string;
    pillBg: string;
    badgeTone: string;
  };
  floatingBadge: string;
  floatingSub: string;
  floatingMicroTop: {
    icon: React.ElementType;
    value: string;
    label: string;
  };
  floatingMicroBottom: {
    icon: React.ElementType;
    value: string;
    label: string;
  };
  mockup: {
    screenTitle: string;
    orderNumber: string;
    statusBadge: string;
    statusBadgeColor: string;
    infoLabel: string;
    infoValue: string;
    tagPill: string;
    items: Array<{
      name: string;
      qty: string;
      price: string;
      tag?: string;
    }>;
    subtotal: string;
    taxOrDeposit?: string;
    total: string;
    actionButtonText: string;
    actionButtonColor: string;
    chips: string[];
  };
}

export const VERTICAL_LANDING_ITEMS: VerticalLandingItem[] = [
  {
    id: 'cafe',
    label: 'Kafe & Resto',
    sublabel: 'Dine-in, KDS & Meja QR',
    wizardType: 'coffee',
    badge: 'Software POS & Ekosistem Bisnis Kafe #1',
    badgeIcon: Coffee,
    title: 'Kondisi Ramai Tetap Terkendali, Pesanan Dapur Cepat Saji',
    subtitle: 'Catat transaksi kasir 1.2 detik, kelola meja & QR dine-in, pisahkan pesanan dapur koki & barista via KDS otomatis, serta pantau HPP resep bahan baku tanpa bon bocor.',
    rating: '4.9',
    usersCount: '800+ Mitra Kafe & Resto',
    offlineStatus: '100% Offline-First & Struk Thermal',
    ctaText: 'Coba Kasir Kafe (Gratis 14 Hari)',
    theme: {
      accentText: 'text-amber-400',
      accentBg: 'bg-amber-500/20',
      accentBorder: 'border-amber-400/40',
      btnGradient: 'from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-400 text-slate-950',
      glowColor: 'bg-amber-500/20',
      pillBg: 'bg-amber-400/10 text-amber-300 border-amber-400/30',
      badgeTone: 'bg-amber-100 text-amber-900 border-amber-300'
    },
    floatingBadge: 'Penjualan Naik 45%',
    floatingSub: 'Resep & HPP Terhitung Otomatis',
    floatingMicroTop: {
      icon: Zap,
      value: '1.2 Detik',
      label: 'Transaksi Kilat'
    },
    floatingMicroBottom: {
      icon: ChefHat,
      value: 'KDS Real-Time',
      label: 'Dapur & Bar Sinkron'
    },
    mockup: {
      screenTitle: 'Layar Kasir Kafe (Dine-in)',
      orderNumber: '#ORD-0082',
      statusBadge: 'Memasak di Dapur',
      statusBadgeColor: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
      infoLabel: 'Meja Tamu',
      infoValue: 'Meja 04 (4 Tamu Dine-in)',
      tagPill: 'Pecah Tagihan (Split Bill)',
      items: [
        { name: '2x Tori Paitan Ramen Komplit', qty: '2 Porsi', price: 'Rp 96.000', tag: 'Extra Nori & Telur' },
        { name: '1x Matcha Latte Ice (Oatmilk)', qty: '1 Cup', price: 'Rp 32.000', tag: 'Less Ice 50% Sugar' },
        { name: '1x Gyoza Panggang Gurih', qty: '1 Porsi', price: 'Rp 28.000', tag: '5 Pcs' }
      ],
      subtotal: 'Rp 156.000',
      taxOrDeposit: '+ PB1 Resto 10%: Rp 15.600',
      total: 'Rp 171.600',
      actionButtonText: '⚡ Cetak Struk Dapur / Split Bill',
      actionButtonColor: 'bg-amber-400 hover:bg-amber-300 text-slate-950',
      chips: ['Layar Dapur KDS Otomatis', 'Split Bill Per Meja', 'Resep Bahan Mentah Terpotong']
    }
  },
  {
    id: 'bengkel',
    label: 'Bengkel Servis',
    sublabel: 'SPK, Plat No & Komisi',
    wizardType: 'bengkel',
    badge: 'Sistem Manajemen Bengkel Motor & Mobil Modern',
    badgeIcon: Wrench,
    title: 'Tinggalkan Nota Kertas, Tertibkan Antrean Servis & Montir',
    subtitle: 'Penerbitan SPK digital montir, rekam jejak servis via plat nomor kendaraan, suku cadang multi-tier (Ori/KW), dan hitung otomatis komisi mekanik tanpa hitung manual di akhir bulan.',
    rating: '4.95',
    usersCount: '450+ Mitra Bengkel Motor & Mobil',
    offlineStatus: 'Cetak SPK A4 / Thermal & Riwayat Plat',
    ctaText: 'Coba Kasir Bengkel (Gratis 14 Hari)',
    theme: {
      accentText: 'text-rose-400',
      accentBg: 'bg-rose-500/20',
      accentBorder: 'border-rose-400/40',
      btnGradient: 'from-rose-500 via-rose-400 to-rose-500 hover:from-rose-400 hover:to-rose-500 text-white',
      glowColor: 'bg-rose-600/20',
      pillBg: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
      badgeTone: 'bg-rose-100 text-rose-900 border-rose-300'
    },
    floatingBadge: 'Riwayat Plat Nomor Otomatis',
    floatingSub: 'Komisi Montir Terhitung Real-Time',
    floatingMicroTop: {
      icon: Wrench,
      value: 'SPK Digital',
      label: 'Antrean Stall Servis'
    },
    floatingMicroBottom: {
      icon: Users,
      value: 'Bagi Hasil Montir',
      label: 'Otomatis di Payroll'
    },
    mockup: {
      screenTitle: 'Layar SPK Bengkel (Pit Servis 2)',
      orderNumber: '#SPK-0102',
      statusBadge: 'Dalam Pengerjaan',
      statusBadgeColor: 'bg-rose-500/20 text-rose-300 border-rose-400/40',
      infoLabel: 'Kendaraan & Pemilik',
      infoValue: 'Honda Vario 150 (DD 4512 AB)',
      tagPill: 'Pelanggan: Hendra Wijaya',
      items: [
        { name: '1x Oli Mesin Matic 10W-30 (MPX2)', qty: '1 Btl', price: 'Rp 58.000', tag: 'Suku Cadang Asli' },
        { name: '1x Kampas Rem Depan Cakram', qty: '1 Set', price: 'Rp 45.000', tag: 'Kondisi Aus Tipis' },
        { name: 'Jasa Tune-Up & Servis Injeksi', qty: '1 Jasa', price: 'Rp 65.000', tag: 'Mekanik: Mas Hendra' }
      ],
      subtotal: 'Rp 168.000',
      taxOrDeposit: 'Komisi Montir: Rp 25.000',
      total: 'Rp 168.000',
      actionButtonText: '⚡ Selesai Servis & Cetak Faktur SPK',
      actionButtonColor: 'bg-rose-500 hover:bg-rose-400 text-white',
      chips: ['Riwayat Servis via Plat Nomor', 'Bagi Hasil Mekanik Transparan', 'Peringatan Stok Sparepart Tipis']
    }
  },
  {
    id: 'retail',
    label: 'Grosir & Retail',
    sublabel: 'Barcode & Satuan Dus',
    wizardType: 'grosir',
    badge: 'Software Kasir Toko Grosir, Retail & Material #1',
    badgeIcon: Package,
    title: 'Kasir Cepat Barcode 1 Detik, Tertibkan Piutang & Multi-Satuan',
    subtitle: 'Didesain untuk kecepatan kasir toko sembako, minimarket, & toko bangunan: scan barcode laser kilat, jual per dus/karton/bal otomatis potong stok pcs, dan kelola plafon bon langganan.',
    rating: '4.9',
    usersCount: '600+ Mitra Toko Grosir & Retail',
    offlineStatus: 'Keyboard-First UX & Barcode Laser',
    ctaText: 'Coba Toko Grosir (Gratis 14 Hari)',
    theme: {
      accentText: 'text-blue-400',
      accentBg: 'bg-blue-500/20',
      accentBorder: 'border-blue-400/40',
      btnGradient: 'from-blue-500 via-indigo-400 to-blue-500 hover:from-blue-400 hover:to-blue-500 text-white',
      glowColor: 'bg-blue-600/20',
      pillBg: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
      badgeTone: 'bg-blue-100 text-blue-900 border-blue-300'
    },
    floatingBadge: 'Multi-Satuan Dus/Lusin/Pcs',
    floatingSub: 'Plafon Piutang Bon Otomatis',
    floatingMicroTop: {
      icon: Zap,
      value: 'Scan 1 Detik',
      label: 'Tanpa Sentuh Mouse'
    },
    floatingMicroBottom: {
      icon: Store,
      value: 'Surat Jalan',
      label: 'Armada Pengiriman'
    },
    mockup: {
      screenTitle: 'Layar Kasir Cepat (Toko Grosir)',
      orderNumber: '#FP-0882',
      statusBadge: 'Siap Kirim / Armada',
      statusBadgeColor: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
      infoLabel: 'Pelanggan Langganan',
      infoValue: 'Warung Bu Dewi (Mitra Grosir)',
      tagPill: 'Plafon Bon: Sisa Rp 2.1 Jt',
      items: [
        { name: '1x Beras Ramos Super 5kg (Dus)', qty: '1 Dus (4 Pcs)', price: 'Rp 280.000', tag: 'Harga Tier Grosir' },
        { name: '2x Minyak Goreng Kemasan 2L', qty: '2 Pcs', price: 'Rp 68.000', tag: 'Scan Barcode' },
        { name: '1x Telur Ayam Ras Pilihan', qty: '1 Rak (30 Btr)', price: 'Rp 52.000', tag: 'Eceran' }
      ],
      subtotal: 'Rp 400.000',
      taxOrDeposit: 'Termin Tempo: 14 Hari',
      total: 'Rp 400.000',
      actionButtonText: '⚡ Terbitkan Surat Jalan & Struk Faktur',
      actionButtonColor: 'bg-blue-500 hover:bg-blue-400 text-white',
      chips: ['Konversi Satuan Bertingkat (UOM)', 'Buku Piutang & Plafon Bon', 'Scan Barcode Keyboard-First']
    }
  },
  {
    id: 'laundry',
    label: 'Laundry Kiloan',
    sublabel: 'Timbangan Desimal & Rak',
    wizardType: 'laundry',
    badge: 'Software Kasir Laundry Kiloan & Satuan Modern',
    badgeIcon: Shirt,
    title: 'Timbang Kiloan Kilat, Pantau Rak & Notif WhatsApp Otomatis',
    subtitle: 'Didesain khusus untuk usaha laundry kiloan & satuan: input timbangan desimal (Kg), varian aroma parfum, papan kanban pencucian s/d rak simpan, dan WhatsApp otomatis saat cucian siap diambil.',
    rating: '4.92',
    usersCount: '550+ Mitra Laundry Kiloan',
    offlineStatus: 'Timbangan Desimal & Integrasi WA',
    ctaText: 'Coba Kasir Laundry (Gratis 14 Hari)',
    theme: {
      accentText: 'text-cyan-400',
      accentBg: 'bg-cyan-500/20',
      accentBorder: 'border-cyan-400/40',
      btnGradient: 'from-cyan-400 via-teal-300 to-cyan-400 hover:from-cyan-300 hover:to-cyan-400 text-slate-950',
      glowColor: 'bg-cyan-500/20',
      pillBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
      badgeTone: 'bg-cyan-100 text-cyan-900 border-cyan-300'
    },
    floatingBadge: 'Nomor Rak Simpan B-03',
    floatingSub: 'WhatsApp Notif Ambil Otomatis',
    floatingMicroTop: {
      icon: Clock,
      value: 'SLA Kilat 6 Jam',
      label: 'Tier Reguler & Express'
    },
    floatingMicroBottom: {
      icon: Shirt,
      value: 'Dual Payment',
      label: 'Bayar di Muka / Saat Ambil'
    },
    mockup: {
      screenTitle: 'Layar Kasir Drop-off Laundry',
      orderNumber: '#LND-0092',
      statusBadge: 'Selesai di Rak Simpan',
      statusBadgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
      infoLabel: 'Pelanggan & Rak',
      infoValue: 'Ibu Hj. Maryam (0812-9988-xxxx)',
      tagPill: 'Rak Simpan: B-03',
      items: [
        { name: 'Cuci Kering Setrika Reguler (2 Hari)', qty: '3.8 Kg', price: 'Rp 38.000', tag: 'Timbangan Desimal' },
        { name: 'Cuci Bed Cover King Size', qty: '1 Pcs', price: 'Rp 35.000', tag: 'Plastik + Hanger' },
        { name: 'Upgrade Parfum Sakura Blossom', qty: '1 Varian', price: 'Rp 5.000', tag: 'Grade-A Wangi Tahan Lama' }
      ],
      subtotal: 'Rp 78.000',
      taxOrDeposit: 'Status Bayar: Bayar Saat Ambil',
      total: 'Rp 78.000',
      actionButtonText: '⚡ Kirim WA "Cucian Siap Diambil"',
      actionButtonColor: 'bg-cyan-400 hover:bg-cyan-300 text-slate-950',
      chips: ['Input Timbangan Desimal (Kg)', 'Kanban Status Cuci s/d Rak', 'Notifikasi WhatsApp Otomatis']
    }
  },
  {
    id: 'rental',
    label: 'Sewa Busana Adat',
    sublabel: 'Kalender H-Day & Jaminan',
    wizardType: 'rental',
    badge: 'Software Manajemen Sewa Busana Adat, Baju Bodo & Jas Tutup',
    badgeIcon: Sparkles,
    title: 'Jadwal Sewa Pengantin Anti-Bentrok, Catat Jaminan & Fitting Rapi',
    subtitle: 'Kelola kalender booking H-Day busana adat Bugis/Makassar/Jawa, uang jaminan deposit sewa anti-rugi, checklist aksesoris mahkota/saloko, hingga kontrol QC pengembalian & cuci sutra.',
    rating: '4.96',
    usersCount: '350+ Sanggar & Butik Busana',
    offlineStatus: 'Kalender Booking & Kontrak Sewa',
    ctaText: 'Coba Kasir Sewa Busana (Gratis 14 Hari)',
    theme: {
      accentText: 'text-purple-300',
      accentBg: 'bg-purple-500/20',
      accentBorder: 'border-purple-400/40',
      btnGradient: 'from-purple-500 via-pink-400 to-amber-400 hover:from-purple-400 hover:to-amber-300 text-slate-950',
      glowColor: 'bg-purple-600/25',
      pillBg: 'bg-purple-500/10 text-purple-200 border-purple-400/30',
      badgeTone: 'bg-purple-100 text-purple-900 border-purple-300'
    },
    floatingBadge: 'Kalender H-Day Anti-Bentrok',
    floatingSub: 'Uang Jaminan & QC Aksesoris Emas',
    floatingMicroTop: {
      icon: Sparkles,
      value: 'Anti-Double Book',
      label: 'Proteksi Jadwal Busana'
    },
    floatingMicroBottom: {
      icon: ShieldCheck,
      value: 'Deposit Aman',
      label: 'Kompensasi Kerusakan'
    },
    mockup: {
      screenTitle: 'Layar Kontrak Sewa Busana Adat',
      orderNumber: '#RNT-BODO-041',
      statusBadge: 'Fitting Selesai (H-3 Acara)',
      statusBadgeColor: 'bg-purple-500/20 text-purple-200 border-purple-400/40',
      infoLabel: 'Penyewa & Acara',
      infoValue: 'Andi Tenri Bau (0813-5544-xxxx)',
      tagPill: 'Acara: 18 Okt • Gedung Manggala',
      items: [
        { name: 'Baju Bodo Modern Organza Marun (M)', qty: '1 Set', price: 'Rp 250.000', tag: 'Permak Pinggang Selesai' },
        { name: 'Jas Tutup Adat Bugis Hitam Emas (L)', qty: '1 Set', price: 'Rp 200.000', tag: 'Lipa Sabbe Sutra' },
        { name: 'Set Mahkota Saloko Bugis Komplit', qty: '1 Paket', price: 'Rp 75.000', tag: 'Bando, Kalung & Gelang' }
      ],
      subtotal: 'Rp 525.000',
      taxOrDeposit: '+ Titipan Jaminan Deposit: Rp 200.000',
      total: 'Rp 725.000',
      actionButtonText: '⚡ Cetak Kontrak Sewa & Kwitansi',
      actionButtonColor: 'bg-purple-500 hover:bg-purple-400 text-white',
      chips: ['Kalender H-Day Anti-Double Booking', 'Uang Jaminan & Kompensasi Rusak', 'Checklist Aksesoris & QC Cuci Sutra']
    }
  }
];

export interface IndustrySolutionItem {
  id: VerticalId;
  wizardType: string;
  title: string;
  description: string;
  badge: string;
  badgeTone: string;
  icon: React.ElementType;
  points: string[];
}

export const INDUSTRY_SOLUTIONS: IndustrySolutionItem[] = [
  {
    id: 'cafe',
    wizardType: 'coffee',
    title: 'Kafe, Coffee Shop & Resto Cepat Saji',
    description: 'Kelola alur meja dine-in, split bill per orang, layar pesanan dapur koki & barista (KDS), serta resep bahan baku presisi hingga gramasi.',
    badge: 'Spesialis F&B',
    badgeTone: 'bg-amber-100 text-amber-900 border-amber-300',
    icon: Coffee,
    points: [
      'Multi tipe pemesanan: Meja Dine-in, Takeaway, dan Ojol Delivery',
      'Layar Dapur Otomatis (KDS): Routing makanan ke dapur dan minuman ke barista',
      'Formula Resep Bahan Baku (BOM): Stok bahan baku terpotong otomatis saat menu terjual',
      'Pecah tagihan (Split Bill) per orang atau per pesanan meja secara fleksibel'
    ]
  },
  {
    id: 'bengkel',
    wizardType: 'bengkel',
    title: 'Bengkel Motor & Mobil Modern',
    description: 'Tertibkan pendaftaran servis kendaraan, penerbitan SPK montir, suku cadang berjenjang, dan kalkulasi komisi mekanik otomatis.',
    badge: 'Spesialis Otomotif',
    badgeTone: 'bg-rose-100 text-rose-900 border-rose-300',
    icon: Wrench,
    points: [
      'SPK (Surat Perintah Kerja) digital langsung ke pit / stall mekanik',
      'Pencarian riwayat servis instan via Plat Nomor kendaraan pelanggan',
      'Katalog suku cadang multi-tier (Original, OEM, dan Aftermarket KW)',
      'Bagi hasil dan komisi montir terhitung otomatis tanpa rekap manual akhir bulan'
    ]
  },
  {
    id: 'retail',
    wizardType: 'grosir',
    title: 'Toko Grosir, Minimarket & Toko Material',
    description: 'Kecepatan kasir barcode 1 detik tanpa mouse, konversi satuan bertingkat (dus/pcs), cetak Surat Jalan pengiriman, dan kontrol plafon piutang bon.',
    badge: 'Spesialis Grosir & Retail',
    badgeTone: 'bg-blue-100 text-blue-900 border-blue-300',
    icon: Package,
    points: [
      'Kasir keyboard-first super kilat didukung scanner barcode laser',
      'Konversi multi-satuan bertingkat: Jual per dus otomatis potong stok eceran pcs',
      'Penerbitan Surat Jalan (Delivery Order) dan manajemen armada kirim',
      'Buku piutang bon tempo pelanggan lengkap dengan batas limit kredit (plafon)'
    ]
  },
  {
    id: 'laundry',
    wizardType: 'laundry',
    title: 'Laundry Kiloan, Satuan & Drop-Off',
    description: 'Input timbangan desimal akurat, pilihan varian aroma parfum, kanban status cucian, nomor rak simpan, dan WhatsApp notifikasi otomatis.',
    badge: 'Spesialis Laundry',
    badgeTone: 'bg-cyan-100 text-cyan-900 border-cyan-300',
    icon: Shirt,
    points: [
      'Input timbangan desimal presisi (Kg) dengan opsi tarif reguler, kilat, dan express',
      'Pilihan varian aroma parfum pelanggan & manajemen alokasi nomor rak simpan',
      'Papan kanban alur cuci: Drop-off -> Cuci -> Kering -> Setrika -> Rak Simpan',
      'Integrasi notifikasi WhatsApp otomatis begitu pakaian selesai disetrika'
    ]
  },
  {
    id: 'rental',
    wizardType: 'rental',
    title: 'Sanggar Sewa Busana Adat, Baju Bodo & Jas Tutup',
    description: 'Kalender booking H-Day anti-bentrok, pengelolaan uang jaminan deposit sewa, checklist aksesoris mahkota adat, dan alur QC pengembalian busana.',
    badge: 'Spesialis Sewa Busana',
    badgeTone: 'bg-purple-100 text-purple-900 border-purple-300',
    icon: Sparkles,
    points: [
      'Kalender booking visual berbasis tanggal acara (H-Day) anti-double booking',
      'Pencatatan uang jaminan deposit sewa dan denda keterlambatan/kerusakan kain',
      'Checklist aksesoris perhiasan adat lengkap (Saloko, Gelang Ponto, Bando Emas)',
      'Alur QC pengembalian busana dan antrean cuci uap/laundry sutra terpadu'
    ]
  }
];
