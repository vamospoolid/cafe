import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Crown, Sparkles, CheckCircle2, ArrowRight, ShieldCheck, 
  Boxes, CreditCard, ChefHat, PackageSearch, Fingerprint, 
  Award, Calendar, Grid, MessageCircle
} from 'lucide-react';
import { usePOS } from '../context/POSContext';

interface FeatureLockedPaywallProps {
  featureKey: string;
}

interface FeatureMeta {
  title: string;
  category: string;
  requiredPlan: 'GROWTH' | 'BUSINESS' | 'ENTERPRISE';
  requiredPlanName: string;
  priceTag: string;
  icon: React.ReactNode;
  heroHeadline: string;
  description: string;
  highlights: { title: string; desc: string }[];
  badgeColor: string;
}

const FEATURE_REGISTRY: Record<string, FeatureMeta> = {
  'inventory.advanced': {
    title: 'Resep (BOM) & Manajemen Bahan Baku',
    category: 'INVENTORY & HPP INTELLIGENCE',
    requiredPlan: 'GROWTH',
    requiredPlanName: 'Paket Growth',
    priceTag: 'Rp 165.000 / bln',
    icon: <PackageSearch className="text-amber-500" size={32} />,
    heroHeadline: 'Cegah Kebocoran Bahan Baku & Hitung HPP Menu Otomatis',
    description: 'Ketahui secara presisi margin keuntungan setiap cup kopi & makanan yang terjual. Stok susu, biji kopi, dan sirup otomatis terpotong setiap kali kasir menyelesaikan transaksi.',
    highlights: [
      { title: 'Otomatisasi Potong Stok Real-Time', desc: 'Stok bahan baku berkurang otomatis sesuai gramatur resep (Bill of Materials).' },
      { title: 'Kalkulasi HPP & COGS Presisi', desc: 'Ketahui margin keuntungan kotor per menu secara akurat tanpa hitung manual.' },
      { title: 'Audit Waste & Stock Loss', desc: 'Pencatatan bahan basi, tumpah, atau rusak dengan laporan akuntabilitas staf.' }
    ],
    badgeColor: 'from-amber-500 to-orange-500'
  },
  'pos.kds': {
    title: 'Kitchen Display System (KDS)',
    category: 'OPERASIONAL DAPUR & BAR',
    requiredPlan: 'GROWTH',
    requiredPlanName: 'Paket Growth',
    priceTag: 'Rp 165.000 / bln',
    icon: <ChefHat className="text-emerald-500" size={32} />,
    heroHeadline: 'Pesanan Dapur & Bar Rapi Tanpa Kertas Struk Hilang',
    description: 'Tampilkan antrean pesanan digital di layar tablet dapur & barista. Dilengkapi pemisahan otomatis tiket makanan vs minuman dan alarm pesanan baru.',
    highlights: [
      { title: 'Layar Dapur & Bar Terpisah', desc: 'Pesanan makanan masuk ke layar dapur, minuman masuk ke layar barista.' },
      { title: 'Status Masak Real-Time', desc: 'Staf kasir dapat melihat langsung status makanan sedang dimasak atau siap saji.' },
      { title: 'Notifikasi Audio Pesanan', desc: 'Bunyi alarm otomatis saat kasir memproses pesanan baru.' }
    ],
    badgeColor: 'from-emerald-500 to-teal-500'
  },
  'hr.attendance': {
    title: 'Absensi GPS Geofencing & Selfie',
    category: 'MANAJEMEN SDM & STAF',
    requiredPlan: 'GROWTH',
    requiredPlanName: 'Paket Growth',
    priceTag: 'Rp 165.000 / bln',
    icon: <Fingerprint className="text-indigo-500" size={32} />,
    heroHeadline: 'Cegah Titip Absen & Manipulasi Jam Kerja Staf',
    description: 'Validasi kehadiran karyawan dengan koordinat radius GPS outlet dan verifikasi foto selfie langsung dari tablet kasir atau ponsel karyawan.',
    highlights: [
      { title: 'Geofencing Radius Toko', desc: 'Karyawan hanya bisa clock-in saat berada dalam radius yang ditentukan (misal 50 meter).' },
      { title: 'Verifikasi Wajah / Selfie', desc: 'Mengurangi 100% risiko titip absen antar karyawan.' },
      { title: 'Rekapitulasi Jam Kerja & Terlambat', desc: 'Laporan jam kerja otomatis untuk dasar perhitungan gaji bulanan.' }
    ],
    badgeColor: 'from-indigo-500 to-blue-500'
  },
  'crm.loyalty': {
    title: 'CRM & Program Loyalitas Poin Member',
    category: 'CUSTOMER RELATIONSHIP & RETENTION',
    requiredPlan: 'GROWTH',
    requiredPlanName: 'Paket Growth',
    priceTag: 'Rp 165.000 / bln',
    icon: <Award className="text-violet-500" size={32} />,
    heroHeadline: 'Tingkatkan Repeat Order Pelanggan Hingga 40%',
    description: 'Bangun basis pelanggan setia kafe Anda. Berikan poin belanja reward, catat nomor WhatsApp pelanggan, dan berikan promo khusus member.',
    highlights: [
      { title: 'Poin Belanja Otomatis', desc: 'Kumpulkan poin reward setiap transaksi untuk ditukar diskon atau menu gratis.' },
      { title: 'Database Pelanggan Terpusat', desc: 'Riwayat belanja, menu favorit, dan total nominal pembelian setiap pelanggan.' },
      { title: 'Level Membership Tier', desc: 'Tingkatan Silver, Gold, Platinum untuk pelanggan loyal kafe Anda.' }
    ],
    badgeColor: 'from-violet-500 to-purple-500'
  },
  'pos.tables': {
    title: 'Visual Manajemen Meja & Dine-In',
    category: 'OPERASIONAL RESTORAN',
    requiredPlan: 'GROWTH',
    requiredPlanName: 'Paket Growth',
    priceTag: 'Rp 165.000 / bln',
    icon: <Grid className="text-sky-500" size={32} />,
    heroHeadline: 'Visualisasi Denah Meja, Split Bill & Pindah Meja',
    description: 'Kelola layout ruangan kafe secara visual. Kasir dapat dengan mudah memantau meja kosong vs terisi, menggabungkan meja, atau memisahkan tagihan struk.',
    highlights: [
      { title: 'Denah Meja Interaktif', desc: 'Warna indikator real-time untuk meja kosong, terisi, dan menunggu tagihan.' },
      { title: 'Split Bill & Gabung Meja', desc: 'Fleksibilitas pembayaran rombongan pelanggan tanpa repot.' },
      { title: 'Durasi Makan Pelanggan', desc: 'Pantau berapa lama meja terisi untuk optimasi perputaran meja (table turnover).' }
    ],
    badgeColor: 'from-sky-500 to-cyan-500'
  },
  'pos.reservations': {
    title: 'Sistem Reservasi & Booking Meja',
    category: 'OPERASIONAL RESTORAN',
    requiredPlan: 'GROWTH',
    requiredPlanName: 'Paket Growth',
    priceTag: 'Rp 165.000 / bln',
    icon: <Calendar className="text-teal-500" size={32} />,
    heroHeadline: 'Pencatatan Reservasi Meja & Booking Event Kafe',
    description: 'Kelola jadwal booking meja pelanggan, acara ulang tahun, atau meeting VIP dengan sistem pengingat dan deposit uang muka terintegrasi.',
    highlights: [
      { title: 'Jadwal Booking Terstruktur', desc: 'Kalender jadwal reservasi rapi agar tidak terjadi double booking.' },
      { title: 'Pencatatan Uang Muka (DP)', desc: 'Integrasi deposit pemesanan langsung ke arus kas POS.' },
      { title: 'Pengingat WhatsApp', desc: 'Konfirmasi reservasi pelanggan sebelum waktu kedatangan.' }
    ],
    badgeColor: 'from-teal-500 to-emerald-500'
  },
  'finance.loans': {
    title: 'Kasbon & Pinjaman Staf Terintegrasi',
    category: 'KEUANGAN & PAYROLL BISNIS',
    requiredPlan: 'BUSINESS',
    requiredPlanName: 'Paket Business',
    priceTag: 'Rp 299.000 / bln',
    icon: <CreditCard className="text-purple-500" size={32} />,
    heroHeadline: 'Otomatisasi Catatan Kasbon & Potong Gaji Staf yang Transparan',
    description: 'Tinggalkan catatan bon kertas yang sering hilang atau lupa dipotong saat gajian. Sistem mencatat pinjaman staf secara rapi dan otomatis memotong pada slip gaji akhir bulan.',
    highlights: [
      { title: 'Pencatatan Kasbon Multi-Staf', desc: 'Persetujuan pinjaman kasbon dari kas outlet atau kas owner dengan riwayat transparan.' },
      { title: 'Otomatisasi Potong Gaji (Payroll)', desc: 'Nominal sisa kasbon langsung memotong total gaji saat proses penggajian bulanan.' },
      { title: 'Buku Pembantu Piutang Staf', desc: 'Laporan sisa saldo hutang setiap karyawan terpantau secara akurat dan rapi.' }
    ],
    badgeColor: 'from-purple-600 to-indigo-600'
  },
  'warehouse.management': {
    title: 'Gudang Pusat & Distribusi Stok Multi-Cabang',
    category: 'SUPPLY CHAIN & LOGISTIK',
    requiredPlan: 'BUSINESS',
    requiredPlanName: 'Paket Business',
    priceTag: 'Rp 299.000 / bln',
    icon: <Boxes className="text-blue-600" size={32} />,
    heroHeadline: 'Kelola Central Kitchen & Distribusi Bahan ke Seluruh Cabang',
    description: 'Kendalikan rantai pasok bisnis kafe multi-outlet Anda. Lakukan Purchase Order ke supplier besar, terima barang di gudang utama, dan transfer stok ke cabang dengan surat jalan digital.',
    highlights: [
      { title: 'Transfer Stok Antar Outlet', desc: 'Permintaan bahan dari outlet (Stock Request) dan pengiriman dari gudang pusat.' },
      { title: 'Purchase Order (PO) Supplier', desc: 'Faktur pemesanan bahan baku partai besar dengan pelacakan status pengiriman.' },
      { title: 'Monitoring Stok Terpusat', desc: 'Pantau persediaan bahan baku di seluruh cabang dalam satu layar eksekutif.' }
    ],
    badgeColor: 'from-blue-600 to-cyan-600'
  }
};

export const FeatureLockedPaywall: React.FC<FeatureLockedPaywallProps> = ({ featureKey }) => {
  const navigate = useNavigate();
  const { tenantPlan } = usePOS();

  const meta = FEATURE_REGISTRY[featureKey] || {
    title: 'Modul Ekosistem Premium',
    category: 'FITUR LANJUTAN SAAS',
    requiredPlan: 'GROWTH',
    requiredPlanName: 'Paket Growth',
    priceTag: 'Rp 165.000 / bln',
    icon: <Sparkles className="text-amber-500" size={32} />,
    heroHeadline: 'Tingkatkan Performa Bisnis Kafe Anda ke Level Berikutnya',
    description: 'Modul ini dirancang khusus untuk meningkatkan efisiensi operasional, mencegah kebocoran finansial, dan mempercepat pertumbuhan kafe Anda.',
    highlights: [
      { title: 'Otomasi Operasional Bisnis', desc: 'Hemat waktu dan tenaga dengan sistem terintegrasi Codenusa POS.' },
      { title: 'Laporan Real-Time', desc: 'Akses data akurat kapan saja dan di mana saja langsung dari dashboard.' },
      { title: 'Dukungan Prioritas 24/7', desc: 'Didampingi tim customer care khusus untuk kelancaran operasional toko.' }
    ],
    badgeColor: 'from-indigo-600 to-purple-600'
  };

  const handleUpgradeClick = () => {
    navigate('/pengaturan');
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Hero Presentation Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white shadow-2xl border border-indigo-900/50 p-6 sm:p-10">
        {/* Ambient Glows */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          {/* Category & Badge */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-white/10 text-indigo-300 text-xs font-black uppercase tracking-wider border border-white/10 backdrop-blur-md">
                {meta.category}
              </span>
            </div>

            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r ${meta.badgeColor} text-white text-xs font-black shadow-lg shadow-indigo-500/20`}>
              <Crown size={14} />
              <span>Tersedia di {meta.requiredPlanName}</span>
            </div>
          </div>

          {/* Main Title & Value Headline */}
          <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 shadow-inner backdrop-blur-md">
              {meta.icon}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                {meta.heroHeadline}
              </h1>
              <p className="text-sm sm:text-base text-slate-300 mt-2 leading-relaxed max-w-3xl">
                {meta.description}
              </p>
            </div>
          </div>

          {/* Value Highlights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {meta.highlights.map((item, idx) => (
              <div 
                key={idx}
                className="bg-white/5 border border-white/10 hover:border-white/20 transition-all rounded-2xl p-4 backdrop-blur-sm"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-white tracking-wide">{item.title}</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Footer */}
          <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-left">
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
                  Investasi Mulai Dari
                </span>
                <span className="text-lg font-black text-white">
                  {meta.priceTag}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <a
                href="https://api.whatsapp.com/send?phone=6281510283383&text=Halo%20Admin%2C%20saya%20tertarik%20dengan%20fitur%20"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 border border-white/10 backdrop-blur-sm"
              >
                <MessageCircle size={15} /> Tanya CS WhatsApp
              </a>

              <button
                onClick={handleUpgradeClick}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-2xl bg-gradient-to-r ${meta.badgeColor} hover:brightness-110 active:scale-95 text-white font-black text-xs transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30`}
              >
                <Sparkles size={15} /> Buka Fitur Ini — Upgrade Sekarang <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Trust & Guarantee Banner */}
      <div className="mt-4 px-6 py-3.5 rounded-2xl bg-slate-100 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2 font-medium">
          <ShieldCheck size={16} className="text-emerald-600" />
          <span>Garansi aktivasi instan otomatis 24 jam via QRIS / Virtual Account Midtrans.</span>
        </div>
        <button 
          onClick={() => navigate('/pengaturan')}
          className="text-indigo-600 font-bold hover:underline flex items-center gap-1"
        >
          Lihat Perbandingan Semua Paket <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
};
export default FeatureLockedPaywall;
