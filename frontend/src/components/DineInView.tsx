import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { 
  Coffee, 
  ShoppingCart, 
  Search, 
  ChevronRight, 
  Plus, 
  Minus, 
  Utensils, 
  Sparkles, 
  Clock, 
  Heart,
  User,
  Phone,
  MessageSquare,
  CheckCircle,
  MapPin,
  Check
} from 'lucide-react';
import Swal from 'sweetalert2';

const DineInView = () => {
  const { tableId } = useParams();
  const [searchParams] = useSearchParams();
  const tableRef = searchParams.get('ref') || 'Dine-In';

  const [tableInfo, setTableInfo] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [orderSuccess, setOrderSuccess] = useState<any>(null);
  const [isLandingPage, setIsLandingPage] = useState(true);

  useEffect(() => {
    const initData = async () => {
      try {
        // Fetch Table Info
        const tableRes = await fetch(`/api/tables/public/${tableId}`);
        if (tableRes.ok) {
          setTableInfo(await tableRes.json());
        }

        // Fetch Products
        const prodRes = await fetch('/api/products/public');
        if (prodRes.ok) {
          setProducts(await prodRes.json());
        }

        // Fetch Categories
        const catRes = await fetch('/api/categories/public');
        if (catRes.ok) {
          const cats = await catRes.json();
          setCategories(cats);
        }
      } catch (err) {
        console.error('Error initializing Dine-In menu:', err);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [tableId]);

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategoryId === null || p.categoryId === selectedCategoryId;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Cart operations
  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        price: product.sellPrice,
        imageUrl: product.imageUrl,
        qty: 1,
        notes: ''
      }];
    });
  };

  const updateQty = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const updateNotes = (productId: number, notes: string) => {
    setCart(prev => prev.map(item => 
      item.productId === productId ? { ...item, notes } : item
    ));
  };

  // Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const taxAmount = Math.round(cartSubtotal * 0.11); // PPN 11%
  const serviceAmount = Math.round(cartSubtotal * 0.05); // Service Charge 5%
  const cartTotal = cartSubtotal + taxAmount + serviceAmount;

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      Swal.fire('Oops', 'Keranjang belanja Anda masih kosong', 'warning');
      return;
    }
    if (!customerName.trim()) {
      Swal.fire('Wajib Diisi', 'Silakan masukkan Nama Anda untuk konfirmasi pesanan', 'warning');
      return;
    }

    try {
      const orderPayload = {
        customerName: `${customerName} (Meja ${tableRef})`,
        customerPhone,
        tableId: Number(tableId),
        items: cart,
        subtotal: cartSubtotal,
        tax: taxAmount,
        serviceCharge: serviceAmount,
        total: cartTotal
      };

      const res = await fetch('/api/orders/dinein', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      const data = await res.json();
      if (res.ok) {
        setOrderSuccess(data.order);
        setCart([]);
        setIsCartOpen(false);
      } else {
        Swal.fire('Gagal', data.error || 'Terjadi kesalahan saat memesan', 'error');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Koneksi Gagal', 'Gagal menghubungi server', 'error');
    }
  };

  const formatCurrency = (val: number) => {
    return `Rp ${(val || 0).toLocaleString('id-ID')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-600 mb-4"></div>
        <p className="text-slate-600 font-bold">Menyiapkan Menu Sol Cafe...</p>
      </div>
    );
  }

  if (orderSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-emerald-100 max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
            <CheckCircle size={48} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">Pesanan Terkirim!</h2>
            <p className="text-slate-500 mt-2 font-medium text-sm">
              Pesanan Anda dengan nomor <strong className="text-slate-800">{orderSuccess.orderNumber}</strong> sedang dipersiapkan di dapur kafe.
            </p>
          </div>
          
          <div className="bg-slate-50 rounded-2xl p-4 text-left border border-slate-100 space-y-3">
            <div className="flex justify-between text-xs text-slate-500 font-bold">
              <span>MEJA: {tableRef}</span>
              <span>NAMA: {customerName}</span>
            </div>
            <div className="border-t border-dashed border-slate-200 pt-2 space-y-2">
              {orderSuccess.items?.map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-sm text-slate-700">
                  <span>{item.qty}x {products.find(p => p.id === item.productId)?.name || 'Produk'}</span>
                  <span className="font-bold">{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed border-slate-200 pt-2 flex justify-between font-black text-slate-800 text-sm">
              <span>Total Tagihan (Dine-in)</span>
              <span>{formatCurrency(orderSuccess.total)}</span>
            </div>
          </div>

          <p className="text-xs text-slate-400">Silakan lakukan pembayaran di kasir setelah selesai makan dengan menyebutkan nomor meja.</p>
          
          <button 
            onClick={() => setOrderSuccess(null)}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg transition-transform active:scale-[0.98]"
          >
            Pesan Menu Tambahan
          </button>
        </div>
      </div>
    );
  }

  if (isLandingPage) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans relative overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute top-[-20%] left-[-20%] w-[80vw] h-[80vw] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[80vw] h-[80vw] rounded-full bg-amber-500/10 blur-[100px] pointer-events-none" />

        {/* Top Navbar */}
        <header className="p-5 flex justify-between items-center z-10 max-w-md mx-auto w-full">
          <span className="text-xl font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            SOL CAFE
          </span>
          <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-black text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            Meja {tableInfo?.tableNo || tableRef} &bull; Aktif
          </span>
        </header>

        {/* Hero Section */}
        <main className="flex-1 flex flex-col justify-center px-6 py-4 max-w-md mx-auto w-full z-10 space-y-8">
          {/* Aesthetic Centerpiece (Illustrative Card) */}
          <div className="relative group mx-auto w-full max-w-[280px] aspect-[4/3] rounded-3xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-xl p-5 flex flex-col justify-between shadow-2xl shadow-black/40">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-transparent to-amber-500/10 pointer-events-none" />
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-amber-400">
                <Coffee size={22} />
              </div>
              <span className="text-[10px] font-bold text-white/40 tracking-widest uppercase">Self-Order QR</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-white/90">Waktu Kopi Santai</h3>
              <p className="text-[10px] text-white/50 leading-relaxed">
                Pesan kopi hangat dan makanan penutup langsung dari HP Anda.
              </p>
            </div>
          </div>

          {/* Titles */}
          <div className="text-center space-y-3">
            <h2 className="text-2xl font-black tracking-tight leading-tight">
              Selamat Datang di <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-amber-200">SOL Cafe</span>
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              Pesan menu favorit Anda langsung dari meja tanpa perlu mengantre. Makanan dan minuman akan disajikan hangat ke meja Anda!
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button 
              onClick={() => setIsLandingPage(false)}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-[0.98] text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-amber-500/15 transition-all flex items-center justify-center gap-2"
            >
              <Utensils size={18} />
              <span>Lihat Menu & Mulai Pesan</span>
            </button>
            <button 
              type="button"
              onClick={() => {
                Swal.fire({
                  title: 'Hubungi Pelayan?',
                  text: 'Pelayan kami akan segera datang ke meja Anda.',
                  icon: 'question',
                  showCancelButton: true,
                  confirmButtonText: 'Ya, Hubungi',
                  cancelButtonText: 'Batal',
                  confirmButtonColor: '#10b981',
                  cancelButtonColor: '#3b82f6'
                }).then((result) => {
                  if (result.isConfirmed) {
                    Swal.fire('Terkirim', 'Pelayan telah diberitahu dan sedang menuju meja Anda.', 'success');
                  }
                });
              }}
              className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 active:scale-[0.98] text-white/80 font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              <MessageSquare size={14} />
              <span>Panggil Pelayan</span>
            </button>
          </div>

          {/* Step Guide */}
          <div className="pt-4 space-y-3">
            <h4 className="text-[10px] text-center font-bold text-white/40 tracking-wider uppercase">3 Langkah Praktis</h4>
            <div className="grid grid-cols-3 gap-3">
              {[
                { step: '1', title: 'Pilih Menu', desc: 'Sesuaikan selera Anda' },
                { step: '2', title: 'Kirim Order', desc: 'Nama & kirim pesanan' },
                { step: '3', title: 'Disajikan', desc: 'Duduk & nikmati hidangan' }
              ].map(s => (
                <div key={s.step} className="p-3 rounded-2xl bg-white/5 border border-white/5 text-center flex flex-col justify-center space-y-1">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-black flex items-center justify-center mx-auto mb-1">
                    {s.step}
                  </span>
                  <div className="text-[10px] font-bold text-white/80">{s.title}</div>
                  <div className="text-[8px] text-white/40 leading-snug">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="p-6 text-center text-[10px] text-white/30 z-10">
          &copy; 2026 SOL Cafe &bull; Premium QR Ordering System
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative pb-20">
      {/* Mobile-styled Header */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 z-10 p-4">
        <div className="flex justify-between items-center max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Coffee size={20} />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 leading-tight">SOL CAFE</h1>
              <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <MapPin size={12} className="text-slate-400" />
                <span>Dine-In &bull; <strong className="text-indigo-600">Meja {tableRef}</strong></span>
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsCartOpen(true)}
            className="relative p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-800 transition-colors"
          >
            <ShoppingCart size={20} />
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-indigo-600 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                {cart.reduce((sum, item) => sum + item.qty, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-tr from-indigo-950 via-slate-900 to-indigo-900 rounded-3xl p-6 text-white relative overflow-hidden shadow-lg">
          <div className="absolute top-[-20%] right-[-10%] w-48 h-48 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />
          <div className="relative z-10 space-y-2">
            <span className="inline-flex items-center gap-1 bg-white/10 border border-white/10 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-indigo-200">
              <Sparkles size={10} /> QR ORDER DINE-IN
            </span>
            <h2 className="text-xl font-black">Pesan Langsung dari Meja Anda</h2>
            <p className="text-xs text-indigo-200 leading-relaxed max-w-md">
              Pilih hidangan favorit Anda, masukkan catatan memasak, dan pesan tanpa menunggu antrean kasir. Makanan disajikan hangat!
            </p>
          </div>
        </div>

        {/* Search Control */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Cari makanan atau minuman..." 
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 transition-colors"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button 
            onClick={() => setSelectedCategoryId(null)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              selectedCategoryId === null 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Semua Menu
          </button>
          {categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                selectedCategoryId === cat.id 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' 
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 gap-4">
          {filteredProducts.map(prod => (
            <div key={prod.id} className="bg-white rounded-3xl border border-slate-100 p-3 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="space-y-2">
                <div className="aspect-square w-full rounded-2xl bg-slate-50 overflow-hidden relative border border-slate-100/50">
                  <img 
                    src={prod.imageUrl || '/assets/images/cafe_login_cover.png'} 
                    alt={prod.name} 
                    className="w-full h-full object-cover"
                    onError={(e: any) => { e.target.src = '/assets/images/cafe_login_cover.png'; }}
                  />
                  {prod.stock <= 5 && (
                    <span className="absolute top-2 left-2 bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">
                      Stok Menipis
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{prod.name}</h4>
                  <span className="text-[10px] text-slate-400 font-semibold">{prod.category?.name}</span>
                </div>
              </div>

              <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-50">
                <span className="text-xs font-black text-indigo-600">{formatCurrency(prod.sellPrice)}</span>
                <button 
                  onClick={() => addToCart(prod)}
                  className="w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center transition-colors active:scale-90"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Floating Bottom Bar (Cart Summary) */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-150 p-4 shadow-xl z-10 flex justify-center">
          <button 
            onClick={() => setIsCartOpen(true)}
            className="max-w-3xl w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/10 flex justify-between items-center transition-transform active:scale-[0.98]"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} />
              <span className="text-sm">{cart.reduce((sum, item) => sum + item.qty, 0)} Item</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span>Lihat Keranjang ({formatCurrency(cartSubtotal)})</span>
              <ChevronRight size={16} />
            </div>
          </button>
        </div>
      )}

      {/* Cart Slider Drawer Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-20 flex justify-end">
          <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl animate-slide-left">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                  <ShoppingCart className="text-indigo-600" /> Keranjang Belanja
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Dine-In &bull; Meja {tableRef}</p>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.map(item => (
                <div key={item.productId} className="flex gap-3 p-3 border border-slate-100 rounded-2xl bg-slate-50/50">
                  <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                    <img 
                      src={item.imageUrl || '/assets/images/cafe_login_cover.png'} 
                      alt={item.name} 
                      className="w-full h-full object-cover"
                      onError={(e: any) => { e.target.src = '/assets/images/cafe_login_cover.png'; }}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between">
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{item.name}</h4>
                      <span className="text-xs font-black text-slate-800">{formatCurrency(item.price * item.qty)}</span>
                    </div>

                    {/* Note Editor */}
                    <input 
                      type="text" 
                      placeholder="Tambahkan catatan (opsional)..."
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-600 outline-none placeholder-slate-400"
                      value={item.notes}
                      onChange={e => updateNotes(item.productId, e.target.value)}
                    />

                    {/* Qty controller */}
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-[10px] text-slate-400 font-semibold">{formatCurrency(item.price)}/item</span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => updateQty(item.productId, -1)}
                          className="w-6 h-6 rounded bg-white border border-slate-200 text-slate-600 flex items-center justify-center active:scale-95"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-black text-slate-800 min-w-4 text-center">{item.qty}</span>
                        <button 
                          onClick={() => updateQty(item.productId, 1)}
                          className="w-6 h-6 rounded bg-white border border-slate-200 text-slate-600 flex items-center justify-center active:scale-95"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Check-Out Form & Pricing */}
            <form onSubmit={handlePlaceOrder} className="border-t border-slate-100 p-4 space-y-4 bg-slate-50/50">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Informasi Pemesan</h4>
                
                <div className="space-y-2">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="text" 
                      placeholder="Nama Lengkap Anda *"
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 transition-colors"
                      required
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                  </div>

                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="tel" 
                      placeholder="Nomor WA (Opsional - untuk struk digital)"
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 transition-colors"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Pricing Breakdown */}
              <div className="border-t border-slate-200/60 pt-3 text-xs space-y-2 text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-800">{formatCurrency(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>PPN (11%)</span>
                  <span className="font-bold text-slate-800">{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Service Charge (5%)</span>
                  <span className="font-bold text-slate-800">{formatCurrency(serviceAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-dashed border-slate-200 pt-2 font-black text-slate-800 text-sm">
                  <span>Total Bayar</span>
                  <span className="text-indigo-600">{formatCurrency(cartTotal)}</span>
                </div>
              </div>

              {/* Action Button */}
              <button 
                type="submit"
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/10 transition-transform active:scale-[0.98] flex items-center justify-center gap-1.5"
              >
                <Check size={18} />
                <span>Kirim Pesanan ke Dapur</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Lucide X icon wrapper since X wasn't explicitly imported from lucide-react in imports list
const X = ({ size, className }: { size?: number, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

export default DineInView;
