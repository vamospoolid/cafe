import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Search, 
  Plus, 
  Trash2, 
  Calendar, 
  CreditCard, 
  Wallet, 
  ArrowRight, 
  User, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  CheckCircle2, 
  Tag, 
  Clock, 
  Check, 
  X,
  Layers,
  Scissors,
  Camera,
  Shirt
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import { RentalReceiptPrinter } from './RentalReceiptPrinter';

// ─── MASTER PRESET BUSANA & AKSESORIS ─────────────────────────────────────────
interface AttirePreset {
  id: string;
  name: string;
  code: string;
  category: 'MODERN' | 'LABU' | 'PENGANTIN' | 'KLASIK' | 'PRIA' | 'ANAK';
  color: string;
  size: string;
  price: number;
  rackHangerCode: string;
  imageUrl?: string;
  defaultAccessories: string[];
}

const DEFAULT_ATTIRES: AttirePreset[] = [
  {
    id: 'att-1',
    name: 'Baju Bodo Modern Organza Payet',
    code: 'BBM-ORG-MRH-M-01',
    category: 'MODERN',
    color: 'Merah Marun',
    size: 'M',
    price: 250000,
    rackHangerCode: 'Hanger A-01',
    defaultAccessories: ['Saloko Mahkota', 'Bando Emas', 'Kalung Beranak', '2x Gelang Ponto', 'Lipa Sabbe']
  },
  {
    id: 'att-2',
    name: 'Baju Bodo Modern Organza Payet',
    code: 'BBM-ORG-SGE-L-02',
    category: 'MODERN',
    color: 'Sage Green',
    size: 'L',
    price: 250000,
    rackHangerCode: 'Hanger A-02',
    defaultAccessories: ['Saloko Mahkota', 'Bando Emas', 'Kalung Beranak', '2x Gelang Ponto', 'Lipa Sabbe']
  },
  {
    id: 'att-3',
    name: 'Baju Bodo Modern Organza Payet',
    code: 'BBM-ORG-LLC-S-03',
    category: 'MODERN',
    color: 'Lilac Pastel',
    size: 'S',
    price: 250000,
    rackHangerCode: 'Hanger A-03',
    defaultAccessories: ['Saloko Mahkota', 'Bando Emas', 'Kalung Beranak', '2x Gelang Ponto', 'Lipa Sabbe']
  },
  {
    id: 'att-4',
    name: 'Baju La\'bu Sutra Hijab Friendly',
    code: 'BBL-STR-HJU-M-01',
    category: 'LABU',
    color: 'Hijau Botol',
    size: 'M',
    price: 300000,
    rackHangerCode: 'Hanger B-01',
    defaultAccessories: ['Bando Emas Hijab', 'Kalung Beranak', '2x Gelang Ponto', 'Pending Ikat Pinggang', 'Lipa Sabbe Sutra']
  },
  {
    id: 'att-5',
    name: 'Baju La\'bu Sutra Hijab Friendly',
    code: 'BBL-STR-MRH-XL-02',
    category: 'LABU',
    color: 'Merah Darah',
    size: 'XL',
    price: 300000,
    rackHangerCode: 'Hanger B-02',
    defaultAccessories: ['Bando Emas Hijab', 'Kalung Beranak', '2x Gelang Ponto', 'Pending Ikat Pinggang', 'Lipa Sabbe Sutra']
  },
  {
    id: 'att-6',
    name: 'Baju Bodo Pengantin Adat Full Mutiara',
    code: 'BBP-PYT-GLD-L-01',
    category: 'PENGANTIN',
    color: 'Gold Emas',
    size: 'L',
    price: 850000,
    rackHangerCode: 'Hanger VIP-01',
    defaultAccessories: ['Saloko Akbar Emas', 'Bando Pengantin', 'Kalung Beranak 3 Susun', '2x Gelang Ponto Naga', 'Pending Emas', 'Sumpit Hias', 'Lipa Sabbe Antik']
  },
  {
    id: 'att-7',
    name: 'Baju Bodo Pengantin Putih Suci',
    code: 'BBP-PYT-PTH-M-02',
    category: 'PENGANTIN',
    color: 'Putih Silver',
    size: 'M',
    price: 850000,
    rackHangerCode: 'Hanger VIP-02',
    defaultAccessories: ['Saloko Akbar Perak', 'Bando Perak', 'Kalung Beranak Silver', '2x Gelang Ponto Silver', 'Pending Silver', 'Lipa Sabbe']
  },
  {
    id: 'att-8',
    name: 'Baju Bodo Klasik Tradisional Kasa',
    code: 'BBK-KSA-KNG-S-01',
    category: 'KLASIK',
    color: 'Kuning Teratai',
    size: 'S',
    price: 175000,
    rackHangerCode: 'Hanger C-01',
    defaultAccessories: ['Bando Emas', 'Kalung Beranak', '2x Gelang Ponto', 'Lipa Sabbe']
  },
  {
    id: 'att-9',
    name: 'Set Jas Tutup Pria Sutra Pabiring',
    code: 'JTP-STR-HTM-L-01',
    category: 'PRIA',
    color: 'Hitam Emas',
    size: 'L',
    price: 200000,
    rackHangerCode: 'Hanger P-01',
    defaultAccessories: ['Songkok Recca Emas', 'Tataroppeng Keris', 'Rantai Sumping Emas', 'Lipa Sabbe Pria']
  },
  {
    id: 'att-10',
    name: 'Set Jas Tutup Pria Sutra Pabiring',
    code: 'JTP-STR-MRH-XL-02',
    category: 'PRIA',
    color: 'Merah Marun',
    size: 'XL',
    price: 200000,
    rackHangerCode: 'Hanger P-02',
    defaultAccessories: ['Songkok Recca Emas', 'Tataroppeng Keris', 'Rantai Sumping Emas', 'Lipa Sabbe Pria']
  },
  {
    id: 'att-11',
    name: 'Set Baju Bodo Cilik (Anak Pawai/Karnaval)',
    code: 'BBA-STN-PNK-JR-01',
    category: 'ANAK',
    color: 'Pink Fanta',
    size: 'Junior',
    price: 100000,
    rackHangerCode: 'Hanger K-01',
    defaultAccessories: ['Bando Anak', 'Kalung Anak', 'Gelang Karet', 'Sarung Anak']
  }
];

export const POSRental: React.FC = () => {
  const { token, user } = usePOS();
  const navigate = useNavigate();

  // Filter Catalog State
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [attires] = useState<AttirePreset[]>(DEFAULT_ATTIRES);

  // Cart / Selected Attires
  const [selectedItems, setSelectedItems] = useState<AttirePreset[]>([]);

  // Customer & Event Details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  
  // Dates
  const todayStr = new Date().toISOString().split('T')[0];
  const [eventDate, setEventDate] = useState(todayStr);
  const [pickupDate, setPickupDate] = useState(todayStr);
  
  // Return date defaults to eventDate + 1 day
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [returnDeadline, setReturnDeadline] = useState(tomorrow.toISOString().split('T')[0]);

  // Financials
  const [discount, setDiscount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'TRANSFER'>('CASH');
  const [depositAmount, setDepositAmount] = useState<number>(100000); // Default jaminan Rp 100k
  const [fittingNotes, setFittingNotes] = useState('');
  const [createdOrderForPrint, setCreatedOrderForPrint] = useState<any | null>(null);

  // Submitting State
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto calculate subtotal
  const subtotal = useMemo(() => {
    return selectedItems.reduce((acc, it) => acc + it.price, 0);
  }, [selectedItems]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal - discount);
  }, [subtotal, discount]);

  // Set default paidAmount to 30% DP or full when items change
  useEffect(() => {
    if (selectedItems.length > 0 && paidAmount === 0) {
      setPaidAmount(Math.round(totalAmount * 0.3)); // Saran DP 30%
    }
  }, [totalAmount]);

  // Filtered Attire List
  const filteredAttires = useMemo(() => {
    return attires.filter(it => {
      const matchCat = selectedCategory === 'ALL' || it.category === selectedCategory;
      const matchSearch = 
        it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.color.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.rackHangerCode.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [attires, selectedCategory, searchQuery]);

  // Add Item to Order
  const handleAddItem = (attire: AttirePreset) => {
    const isAlreadyAdded = selectedItems.some(i => i.id === attire.id);
    if (isAlreadyAdded) {
      toast('Baju ini sudah dimasukkan ke daftar sewa.', 'error');
      return;
    }
    setSelectedItems(prev => [...prev, attire]);
    toast(`${attire.name} (${attire.color}) ditambahkan.`, 'success');
  };

  // Remove Item
  const handleRemoveItem = (id: string) => {
    setSelectedItems(prev => prev.filter(i => i.id !== id));
  };

  // Submit Order
  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      toast('Nama penyewa / pengantin wajib diisi.', 'error');
      return;
    }

    if (selectedItems.length === 0) {
      toast('Pilih minimal 1 set busana untuk disewa.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // Satukan checklist aksesoris dari semua baju yang dipilih
      const consolidatedAccessories: Array<{ name: string; checked: boolean; attireCode: string }> = [];
      selectedItems.forEach(item => {
        item.defaultAccessories.forEach(acc => {
          consolidatedAccessories.push({
            name: `${acc} [${item.rackHangerCode}]`,
            checked: true,
            attireCode: item.code
          });
        });
      });

      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        eventLocation: eventLocation.trim() || null,
        eventDate,
        pickupDate,
        returnDeadline,
        rentalSubtotal: subtotal,
        discount,
        paidAmount,
        paymentMethod,
        depositAmount,
        fittingNotes: fittingNotes.trim() || null,
        accessoryChecklist: consolidatedAccessories,
        items: selectedItems.map(it => ({
          attireName: it.name,
          attireCode: it.code,
          rackHangerCode: it.rackHangerCode,
          color: it.color,
          size: it.size,
          price: it.price
        }))
      };

      const res = await fetch('/api/rental/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan kontrak sewa.');
      }

      toast(`Booking sewa #${data.order.orderNumber} berhasil dibuat!`, 'success');
      // Buka popup cetak resi & kontrak
      setCreatedOrderForPrint(data.order);

      // Reset form
      setSelectedItems([]);
      setCustomerName('');
      setCustomerPhone('');
      setEventLocation('');
      setFittingNotes('');
      setPaidAmount(0);
      setDiscount(0);
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan sistem.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden bg-slate-50">
      
      {/* ─── KIRI: KATALOG BUSANA DENGAN FILTER CEPAT ─────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 bg-white">
        
        {/* Header & Search */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="text-amber-500" size={20} />
              Koleksi Busana Adat & Baju Bodo
            </h1>
            <p className="text-xs text-slate-500">Pilih busana yang tersedia untuk dicatat ke kontrak sewa.</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Cari warna, model, hanger..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-slate-50"
            />
          </div>
        </div>

        {/* Category Pills Filter */}
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex gap-1.5 overflow-x-auto text-xs no-scrollbar">
          {[
            { id: 'ALL', label: 'Semua Koleksi' },
            { id: 'MODERN', label: 'Bodo Modern' },
            { id: 'LABU', label: 'Baju La\'bu (Hijab)' },
            { id: 'PENGANTIN', label: 'Pengantin Glamour' },
            { id: 'KLASIK', label: 'Klasik Kasa' },
            { id: 'PRIA', label: 'Jas Tutup Pria' },
            { id: 'ANAK', label: 'Anak / Karnaval' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 ${
                selectedCategory === tab.id
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-200'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Attires Grid */}
        <div className="flex-1 p-4 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filteredAttires.map(attire => {
            const isAdded = selectedItems.some(i => i.id === attire.id);
            return (
              <div 
                key={attire.id}
                className={`relative rounded-xl border p-3.5 flex flex-col justify-between transition-all ${
                  isAdded 
                    ? 'border-amber-400 bg-amber-50/40 shadow-sm' 
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div>
                  {/* Top Bar: Hanger Badge & Size */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      <Tag size={10} className="text-slate-500" />
                      {attire.rackHangerCode}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      Size {attire.size}
                    </span>
                  </div>

                  {/* Title & SKU */}
                  <h3 className="font-semibold text-slate-800 text-sm line-clamp-1">{attire.name}</h3>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">{attire.code}</div>

                  {/* Color Pill */}
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-xs font-medium text-slate-700">{attire.color}</span>
                  </div>

                  {/* Default Accessories List Preview */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-600">Aksesoris Termasuk:</span>
                    <p className="line-clamp-2 mt-0.5 leading-relaxed text-slate-500">
                      {attire.defaultAccessories.join(', ')}
                    </p>
                  </div>
                </div>

                {/* Bottom Bar: Price & Add Button */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Biaya Sewa</span>
                    <span className="text-sm font-bold text-emerald-600">
                      Rp {attire.price.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <button
                    onClick={() => isAdded ? handleRemoveItem(attire.id) : handleAddItem(attire)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                      isAdded
                        ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'
                        : 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <X size={14} /> Batal
                      </>
                    ) : (
                      <>
                        <Plus size={14} /> Tambah
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── KANAN: FORM KONTRAK SEWA, JADWAL & PEMBAYARAN ─────────────────── */}
      <div className="w-full lg:w-[420px] xl:w-[460px] bg-slate-50 border-t lg:border-t-0 flex flex-col h-full overflow-hidden">
        
        {/* Header Form */}
        <div className="p-4 bg-white border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="text-indigo-600" size={18} />
            Form Kontrak Sewa Busana
          </h2>
          <p className="text-xs text-slate-500">Isi data penyewa, jadwal acara, DP, dan uang jaminan.</p>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmitBooking} className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Data Penyewa */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <User size={13} className="text-slate-400" />
              Identitas Penyewa
            </h3>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Nama Klien / Pengantin *</label>
              <input
                type="text"
                required
                placeholder="Contoh: Nurul Hidayah & Muh. Ridwan"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">No. WhatsApp *</label>
                <input
                  type="tel"
                  placeholder="0812xxxxxxxx"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Lokasi Gedung / Acara</label>
                <input
                  type="text"
                  placeholder="Contoh: Gedung IMMIM"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                />
              </div>
            </div>
          </div>

          {/* Jadwal Waktu Sewa (Anti-Double Booking) */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={13} className="text-slate-400" />
              Jadwal Acara & Batas Waktu
            </h3>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-600 block mb-1">Tgl Ambil</label>
                <input
                  type="date"
                  required
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-amber-700 block mb-1 font-bold">Hari H Acara</label>
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-amber-300 bg-amber-50/50 text-amber-900 font-semibold focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600 block mb-1">Batas Kembali</label>
                <input
                  type="date"
                  required
                  value={returnDeadline}
                  onChange={(e) => setReturnDeadline(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Busana Yang Dipilih */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Shirt size={13} className="text-slate-400" />
                Busana Dipilih ({selectedItems.length})
              </h3>
              {selectedItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedItems([])}
                  className="text-[11px] text-rose-500 hover:underline"
                >
                  Hapus Semua
                </button>
              )}
            </div>

            {selectedItems.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg">
                Belum ada busana yang dipilih dari katalog sebelah kiri.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {selectedItems.map((item, idx) => (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-slate-800 truncate">{item.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {item.color} • Size {item.size} • <span className="font-mono text-indigo-600">{item.rackHangerCode}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-slate-700">Rp {item.price.toLocaleString('id-ID')}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Catatan Permak / Fitting */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Scissors size={13} className="text-slate-400" />
              Catatan Permak & Fitting Khusus
            </label>
            <textarea
              rows={2}
              placeholder="Contoh: Lengan dipeniti 2cm, sarung sutra dinaikkan 4cm, furing dada..."
              value={fittingNotes}
              onChange={(e) => setFittingNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 resize-none"
            />
          </div>

          {/* Finansial, DP & Uang Jaminan (Deposit) */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-slate-400" />
              Pembayaran & Uang Jaminan
            </h3>

            {/* Rincian Angka */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Sewa:</span>
                <span className="font-semibold">Rp {subtotal.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-slate-600 items-center">
                <span>Diskon Paket:</span>
                <input
                  type="number"
                  min="0"
                  value={discount || ''}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-24 text-right px-2 py-1 text-xs border border-slate-200 rounded-md bg-slate-50"
                />
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-800 pt-1.5 border-t border-slate-100">
                <span>Total Sewa Bersih:</span>
                <span className="text-indigo-600">Rp {totalAmount.toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* Uang Jaminan / Deposit Titipan */}
            <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-amber-900">Uang Jaminan (Deposit):</span>
                <span className="text-[10px] text-amber-700 font-semibold">Refundable 100%</span>
              </div>
              <input
                type="number"
                min="0"
                step="10000"
                value={depositAmount || ''}
                onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                className="w-full text-right font-bold text-xs px-2.5 py-1.5 rounded-md border border-amber-300 bg-white text-slate-800 focus:outline-none"
              />
              <p className="text-[10px] text-amber-800/80 mt-1">
                *Uang jaminan disimpan terpisah dan dikembalikan saat busana kembali lengkap & aman.
              </p>
            </div>

            {/* Pembayaran DP / Lunas Sekarang */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">Dibayar Hari Ini (DP/Lunas):</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPaidAmount(Math.round(totalAmount * 0.3))}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                  >
                    DP 30%
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaidAmount(totalAmount)}
                    className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold"
                  >
                    Lunas
                  </button>
                </div>
              </div>

              <input
                type="number"
                min="0"
                value={paidAmount || ''}
                onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-full text-right font-bold text-sm px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              {/* Metode Bayar */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {(['CASH', 'QRIS', 'TRANSFER'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      paymentMethod === m
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || selectedItems.length === 0}
            className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
              isSubmitting || selectedItems.length === 0
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 hover:shadow-lg'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Menyimpan Kontrak Sewa...
              </span>
            ) : (
              <>
                <CheckCircle2 size={18} />
                Konfirmasi Booking & Cetak Nota
              </>
            )}
          </button>
        </form>
      </div>

      {/* Popup Cetak Resi Thermal & Kontrak Sewa A4 */}
      {createdOrderForPrint && (
        <RentalReceiptPrinter
          order={createdOrderForPrint}
          onClose={() => {
            setCreatedOrderForPrint(null);
            navigate('/rental-kanban');
          }}
        />
      )}

    </div>
  );
};

export default POSRental;
