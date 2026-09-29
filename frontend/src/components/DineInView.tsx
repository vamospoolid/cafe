import React, { useState, useEffect, useMemo } from 'react';
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
  User, 
  Phone, 
  MessageSquare, 
  CheckCircle, 
  MapPin, 
  Check,
  Flame,
  ChefHat,
  X,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Receipt
} from 'lucide-react';
import Swal from 'sweetalert2';
import useSocket from '../hooks/useSocket';

interface CartItem {
  productId: number;
  name: string;
  price: number;
  imageUrl?: string;
  qty: number;
  notes: string;
}

const DineInView = () => {
  const socket = useSocket();
  const { tableId } = useParams();
  const [searchParams] = useSearchParams();
  const tableRef = searchParams.get('ref') || 'Dine-In';

  const [tableInfo, setTableInfo] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [orderSuccess, setOrderSuccess] = useState<any>(null);
  const [activeItemForNotes, setActiveItemForNotes] = useState<any | null>(null);

  const [storeBranding, setStoreBranding] = useState<any>({
    storeName: 'Kafe & Resto',
    logoUrl: '/logo.png',
    address: ''
  });

  // Fetch initial data with automatic tenant resolution from tableId
  useEffect(() => {
    let isMounted = true;

    const initData = async () => {
      try {
        setLoading(true);

        // 1. Fetch Table Info first (which resolves tenant context automatically)
        let resolvedTenantId: string | null = null;
        let tableData: any = null;

        try {
          const tableRes = await fetch(`/api/tables/public/${tableId}`);
          if (tableRes.ok) {
            tableData = await tableRes.json();
            if (isMounted) {
              setTableInfo(tableData);
              resolvedTenantId = tableData.tenantId || tableData.tenant?.id || null;
              if (tableData.tenant) {
                setStoreBranding({
                  storeName: tableData.tenant.name || 'Kafe & Resto',
                  logoUrl: tableData.tenant.logoUrl || '/logo.png',
                  address: tableData.tenant.settings?.[0]?.address || ''
                });
              }
            }
          }
        } catch (tableErr) {
          console.warn('Table fetch error:', tableErr);
        }

        // 2. Build query string for products, categories, and settings
        const qParams = new URLSearchParams();
        if (tableId) qParams.set('tableId', tableId);
        if (resolvedTenantId) qParams.set('tenantId', resolvedTenantId);
        const qs = qParams.toString() ? `?${qParams.toString()}` : '';

        // 3. Parallel fetch of products, categories, and store settings
        const [prodRes, catRes, brandRes] = await Promise.all([
          fetch(`/api/products/public${qs}`).catch(() => null),
          fetch(`/api/categories/public${qs}`).catch(() => null),
          fetch(`/api/settings/public${qs}`).catch(() => null)
        ]);

        if (isMounted) {
          if (prodRes && prodRes.ok) {
            const prodData = await prodRes.json();
            setProducts(Array.isArray(prodData) ? prodData : []);
          }

          if (catRes && catRes.ok) {
            const catData = await catRes.json();
            setCategories(Array.isArray(catData) ? catData : []);
          }

          if (brandRes && brandRes.ok) {
            const brandData = await brandRes.json();
            if (brandData?.storeName) {
              setStoreBranding((prev: any) => ({
                ...prev,
                storeName: brandData.storeName || prev.storeName,
                logoUrl: brandData.logoUrl || prev.logoUrl,
                address: brandData.address || prev.address
              }));
            }
          }
        }
      } catch (err) {
        console.error('Error initializing Dine-In menu:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (tableId) {
      initData();
    }

    return () => {
      isMounted = false;
    };
  }, [tableId]);

  // Real-time Live Kitchen Stock Sync & Sold-Out Lock
  useEffect(() => {
    if (!socket) return;

    const handleStockSync = (data: any) => {
      console.log('[DineIn Socket] menu:stock_sync received:', data);
      if (data?.soldOutProductIds) {
        setProducts(prev => prev.map(p => {
          if (data.soldOutProductIds.includes(p.id)) {
            return { ...p, isSoldOut: true, stock: 0 };
          }
          if (data.availableProductIds && data.availableProductIds.includes(p.id)) {
            return { ...p, isSoldOut: false };
          }
          return p;
        }));
      }
    };

    const handleProductSoldOut = (data: any) => {
      console.log('[DineIn Socket] product:sold_out received:', data);
      if (data?.productId) {
        setProducts(prev => prev.map(p => p.id === data.productId ? { ...p, isSoldOut: true, stock: 0 } : p));
      }
    };

    socket.on('menu:stock_sync', handleStockSync);
    socket.on('product:sold_out', handleProductSoldOut);

    return () => {
      socket.off('menu:stock_sync', handleStockSync);
      socket.off('product:sold_out', handleProductSoldOut);
    };
  }, [socket]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = selectedCategoryId === null || p.categoryId === selectedCategoryId;
      const matchesSearch = !searchQuery.trim() || p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategoryId, searchQuery]);

  // Cart operations
  const addToCart = (product: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isSoldOut = Boolean(product.isSoldOut || (product.stock !== undefined && product.stock <= 0 && !product.hasRecipe));
    if (isSoldOut) {
      Swal.fire({
        icon: 'warning',
        title: 'Menu Sedang Habis',
        text: `Maaf, menu "${product.name}" baru saja habis di dapur!`,
        confirmButtonColor: '#d97706',
        customClass: { popup: 'rounded-3xl' }
      });
      return;
    }

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

  const updateQty = (productId: number, delta: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean) as CartItem[]);
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
  const totalCartItems = cart.reduce((sum, item) => sum + item.qty, 0);

  const formatCurrency = (val: number) => {
    return `Rp ${(val || 0).toLocaleString('id-ID')}`;
  };

  // Order Submission
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      Swal.fire('Oops', 'Keranjang belanja Anda masih kosong', 'warning');
      return;
    }
    if (!customerName.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Nama Pemesan Diperlukan',
        text: 'Silakan masukkan Nama Anda agar pelayan dapat mengantar ke meja yang tepat.',
        confirmButtonColor: '#d97706',
        customClass: { popup: 'rounded-3xl' }
      });
      return;
    }

    try {
      const activeTableNo = tableInfo?.tableNo || tableRef || tableId;
      const orderPayload = {
        customerName: `${customerName} (Meja ${activeTableNo})`,
        customerPhone,
        tableId: tableInfo?.id || (isNaN(Number(tableId)) ? tableId : Number(tableId)),
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
        Swal.fire('Gagal Memesan', data.error || 'Terjadi kendala saat mengirimkan pesanan.', 'error');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Koneksi Terputus', 'Gagal menghubungi server restoran. Mohon periksa koneksi internet Anda.', 'error');
    }
  };

  // Payment listener
  const [isPayingMidtrans, setIsPayingMidtrans] = useState(false);
  const [isPaidOnline, setIsPaidOnline] = useState(false);

  useEffect(() => {
    if (!socket || !orderSuccess) return;

    const handleOrderPaid = (data: any) => {
      console.log('[DineIn Socket] order:paid received:', data);
      if (data?.order?.id === orderSuccess.id || data?.order?.orderNumber === orderSuccess.orderNumber) {
        setIsPaidOnline(true);
        setOrderSuccess((prev: any) => ({ ...prev, status: 'Paid', paymentMethod: data?.order?.paymentMethod || 'MIDTRANS_QRIS' }));
        Swal.fire({
          icon: 'success',
          title: '🎉 Pembayaran Lunas!',
          text: 'Pembayaran pesanan Anda telah berhasil terverifikasi otomatis.',
          timer: 3500,
          showConfirmButton: false,
          customClass: { popup: 'rounded-3xl' }
        });
      }
    };

    socket.on('order:paid', handleOrderPaid);
    return () => {
      socket.off('order:paid', handleOrderPaid);
    };
  }, [socket, orderSuccess]);

  const handlePayMidtrans = async () => {
    if (!orderSuccess) return;
    setIsPayingMidtrans(true);
    try {
      const res = await fetch('/api/payments/public/charge-dinein', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderSuccess.id })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses gateway pembayaran online');
      }

      if (data.snapToken && (window as any).snap) {
        (window as any).snap.pay(data.snapToken, {
          onSuccess: function(result: any) {
            console.log('Payment success:', result);
            setIsPaidOnline(true);
          },
          onPending: function(result: any) {
            console.log('Payment pending:', result);
            Swal.fire('Menunggu Pembayaran', 'Silakan selesaikan pembayaran QRIS di aplikasi E-Wallet / Mobile Banking Anda.', 'info');
          },
          onError: function(result: any) {
            console.error('Payment error:', result);
            Swal.fire('Pembayaran Gagal', 'Silakan coba lagi atau bayar manual ke kasir.', 'error');
          }
        });
      } else if (data.snapRedirectUrl) {
        window.open(data.snapRedirectUrl, '_blank');
      } else {
        Swal.fire('QRIS Siap', 'Silakan scan QRIS untuk menyelesaikan pesanan Anda.', 'info');
      }
    } catch (err: any) {
      console.error('Midtrans DineIn Pay Error:', err);
      Swal.fire('Info Pembayaran', err.message || 'Pembayaran online belum tersedia saat ini. Anda dapat membayar langsung di kasir.', 'info');
    } finally {
      setIsPayingMidtrans(false);
    }
  };

  const handleCallWaiter = () => {
    Swal.fire({
      title: 'Panggil Pelayan?',
      text: `Pelayan kami akan segera mendatangi Meja ${tableInfo?.tableNo || tableRef}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Panggil',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#d97706',
      cancelButtonColor: '#78716c',
      customClass: { popup: 'rounded-3xl' }
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({
          icon: 'success',
          title: 'Pelayan Diberitahu',
          text: 'Pelayan kami sedang bergegas menuju ke meja Anda.',
          timer: 2500,
          showConfirmButton: false,
          customClass: { popup: 'rounded-3xl' }
        });
      }
    });
  };

  // ─── LOADING STATE ───
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-[#FAF8F5] text-stone-700 font-sans">
        <div className="relative flex items-center justify-center mb-5">
          <div className="w-16 h-16 rounded-full border-4 border-amber-200 border-t-amber-600 animate-spin"></div>
          <Utensils className="absolute text-amber-600 animate-pulse" size={24} />
        </div>
        <h3 className="text-base font-bold text-stone-800 tracking-tight">Menyiapkan Hidangan Lezat...</h3>
        <p className="text-xs text-stone-500 mt-1">Menghubungkan ke Meja {tableRef}</p>
      </div>
    );
  }

  // ─── ORDER SUCCESS STATE ───
  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-stone-800 flex flex-col items-center justify-center p-4 font-sans relative">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] p-7 shadow-[0_12px_45px_-10px_rgba(0,0,0,0.08)] border border-stone-200/80 text-center space-y-6">
          
          {/* Status Icon */}
          <div className="relative mx-auto w-20 h-20 rounded-full flex items-center justify-center bg-gradient-to-tr from-amber-50 to-amber-100 border border-amber-200/80 shadow-inner">
            {isPaidOnline || orderSuccess.status === 'Paid' ? (
              <CheckCircle className="text-emerald-600" size={44} />
            ) : (
              <ChefHat className="text-amber-600" size={44} />
            )}
            <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shadow">
              ✓
            </span>
          </div>

          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/60 mb-2">
              <Sparkles size={12} /> Pesanan Terkirim ke Dapur
            </span>
            <h2 className="text-2xl font-black text-stone-900 tracking-tight">
              {isPaidOnline || orderSuccess.status === 'Paid' ? '🎉 Pembayaran Lunas!' : 'Terima Kasih Atas Pesanan Anda!'}
            </h2>
            <p className="text-stone-500 mt-1.5 text-xs font-medium leading-relaxed">
              Nomor Pesanan: <strong className="text-stone-800 font-bold">{orderSuccess.orderNumber}</strong>
            </p>
          </div>

          {/* Receipt Card */}
          <div className="bg-stone-50/80 rounded-3xl p-5 text-left border border-stone-200/70 space-y-3.5">
            <div className="flex justify-between items-center text-xs text-stone-500 font-semibold border-b border-stone-200/80 pb-2.5">
              <span className="flex items-center gap-1 text-stone-800 font-bold">
                <MapPin size={13} className="text-amber-600" /> Meja {tableRef}
              </span>
              <span>Pemesan: <strong className="text-stone-800 font-bold">{customerName || 'Tamu'}</strong></span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {orderSuccess.items?.map((item: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-stone-200/80 text-stone-700 flex items-center justify-center text-[10px] font-bold">
                      {item.qty}x
                    </span>
                    <span className="text-stone-700 font-medium line-clamp-1">
                      {products.find(p => p.id === item.productId)?.name || item.name || 'Menu Resto'}
                    </span>
                  </div>
                  <span className="font-bold text-stone-900">{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-stone-200 pt-3 flex justify-between items-center">
              <span className="text-xs font-bold text-stone-500">Total Tagihan (Termasuk Pajak & Layanan)</span>
              <span className="text-base font-black text-amber-800">{formatCurrency(orderSuccess.total)}</span>
            </div>
          </div>

          {/* Action CTAs */}
          {!(isPaidOnline || orderSuccess.status === 'Paid') && (
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handlePayMidtrans}
                disabled={isPayingMidtrans}
                className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Sparkles size={16} />
                <span>{isPayingMidtrans ? 'Menghubungkan Pembayaran...' : 'Bayar Sekarang (QRIS / E-Wallet)'}</span>
              </button>
              <p className="text-[11px] text-stone-400 leading-snug">
                Atau Anda dapat melakukan pembayaran langsung di kasir saat selesai makan.
              </p>
            </div>
          )}

          <button 
            onClick={() => { setOrderSuccess(null); setIsPaidOnline(false); }}
            className="w-full py-3 bg-stone-100 hover:bg-stone-200 active:scale-[0.98] text-stone-700 font-bold rounded-2xl transition-all text-xs flex items-center justify-center gap-1.5"
          >
            <Plus size={14} /> Pesan Menu Tambahan
          </button>
        </div>
      </div>
    );
  }

  // ─── MAIN MENU CATALOG SCREEN (PREMIUM & SOFT) ───
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-800 font-sans flex flex-col pb-28">
      
      {/* 1. Frosted Glass Sticky Header */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-stone-200/70 shadow-[0_2px_12px_rgba(0,0,0,0.02)] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          
          {/* Brand Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white p-1 border border-stone-200/80 shadow-xs flex items-center justify-center overflow-hidden">
              <img 
                src={storeBranding.logoUrl || '/logo.png'} 
                alt={storeBranding.storeName} 
                className="w-full h-full object-contain" 
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src !== window.location.origin + '/logo.png') {
                    target.src = '/logo.png';
                  }
                }}
              />
            </div>
            <div>
              <h1 className="text-sm font-black text-stone-900 tracking-tight leading-tight">
                {storeBranding.storeName}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200/60 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  Meja {tableInfo?.tableNo || tableRef}
                </span>
                <span className="text-[10px] text-stone-400 font-medium">Self-Order</span>
              </div>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={handleCallWaiter}
              title="Panggil Pelayan"
              className="p-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200/80 active:scale-95 text-stone-600 transition-all flex items-center gap-1 text-xs font-bold"
            >
              <MessageSquare size={16} />
              <span className="hidden sm:inline">Panggil</span>
            </button>

            <button 
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white transition-all shadow-sm shadow-amber-600/20"
            >
              <ShoppingCart size={18} />
              {totalCartItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-stone-900 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow">
                  {totalCartItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 pt-4 space-y-4">
        
        {/* Soft Hero Welcome Card */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-amber-500/15 border border-amber-200/60 p-5 shadow-[0_8px_30px_rgb(217,119,6,0.06)]">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 rounded-full bg-amber-400/20 blur-2xl pointer-events-none"></div>
          <div className="relative z-10 flex justify-between items-center">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/90 text-amber-800 border border-amber-200/70 shadow-xs">
                <Sparkles size={10} className="text-amber-600" /> Dine-In Order
              </span>
              <h2 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
                Pesan Hidangan dari Meja Anda
              </h2>
              <p className="text-xs text-stone-500 max-w-sm leading-relaxed">
                Pilih menu favorit, tentukan catatan sesuai selera, dan makanan disajikan langsung ke meja Anda.
              </p>
            </div>
            <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-white/80 border border-amber-200/70 shadow-xs items-center justify-center text-amber-700 flex-shrink-0">
              <ChefHat size={28} />
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={17} />
          <input 
            type="text" 
            placeholder="Cari makanan lezat atau minuman segar..." 
            className="w-full pl-10 pr-10 py-3 bg-white border border-stone-200/80 rounded-2xl text-xs sm:text-sm font-medium text-stone-800 placeholder-stone-400 outline-none focus:border-amber-500 focus:ring-3 focus:ring-amber-500/10 shadow-xs transition-all"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Category Filter Pills (Smooth Horizontal Scroll) */}
        <div className="flex gap-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none -mx-4 px-4">
          <button 
            onClick={() => setSelectedCategoryId(null)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedCategoryId === null 
                ? 'bg-stone-900 text-white shadow-md shadow-stone-900/10 scale-[1.02]' 
                : 'bg-white text-stone-600 border border-stone-200/80 hover:bg-stone-50 shadow-xs'
            }`}
          >
            <span>Semua Menu</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedCategoryId === null ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'}`}>
              {products.length}
            </span>
          </button>
          
          {categories.map(cat => {
            const count = products.filter(p => p.categoryId === cat.id).length;
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button 
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected 
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20 scale-[1.02]' 
                    : 'bg-white text-stone-600 border border-stone-200/80 hover:bg-stone-50 shadow-xs'
                }`}
              >
                {cat.icon && <span>{cat.icon}</span>}
                <span>{cat.name}</span>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Product Catalog Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-stone-200/70 shadow-xs space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <Utensils size={24} />
            </div>
            <h3 className="text-sm font-bold text-stone-800">Menu Tidak Ditemukan</h3>
            <p className="text-xs text-stone-400 max-w-xs mx-auto">
              Tidak ada menu yang sesuai dengan pencarian "{searchQuery}". Coba kata kunci lainnya.
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-all"
              >
                Reset Pencarian
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
            {filteredProducts.map(prod => {
              const isSoldOut = Boolean(prod.isSoldOut || (prod.stock !== undefined && prod.stock <= 0 && !prod.hasRecipe));
              const cartItem = cart.find(item => item.productId === prod.id);

              return (
                <div 
                  key={prod.id} 
                  className={`group bg-white rounded-3xl border p-3 flex flex-col justify-between transition-all duration-300 shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_26px_rgba(0,0,0,0.06)] ${
                    isSoldOut 
                      ? 'border-stone-200/60 opacity-60 grayscale-[40%]' 
                      : 'border-stone-200/70 hover:border-amber-300/80'
                  }`}
                >
                  <div className="space-y-2.5">
                    
                    {/* Image Box */}
                    <div 
                      className="aspect-[4/3] w-full rounded-2xl bg-stone-100 overflow-hidden relative border border-stone-200/50 cursor-pointer"
                      onClick={() => !isSoldOut && addToCart(prod)}
                    >
                      <img 
                        src={prod.imageUrl || '/assets/images/cafe_login_cover.png'} 
                        alt={prod.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e: any) => { e.target.src = '/assets/images/cafe_login_cover.png'; }}
                      />

                      {/* Sold Out Overlay */}
                      {isSoldOut ? (
                        <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-2 text-center">
                          <span className="px-2.5 py-1 bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm">
                            Habis
                          </span>
                        </div>
                      ) : prod.stock !== undefined && prod.stock <= 5 && !prod.hasRecipe ? (
                        <span className="absolute top-2 left-2 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                          Sisa {prod.stock}
                        </span>
                      ) : null}

                      {/* In-Cart Pill Indicator */}
                      {cartItem && (
                        <span className="absolute top-2 right-2 bg-stone-900 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-md">
                          {cartItem.qty}
                        </span>
                      )}
                    </div>

                    {/* Product Meta */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold text-amber-700/80 uppercase tracking-wider">
                        {prod.category?.name || 'Menu Spesial'}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-stone-900 line-clamp-1 leading-snug">
                        {prod.name}
                      </h4>
                      {prod.description && (
                        <p className="text-[11px] text-stone-400 line-clamp-1">
                          {prod.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Price & Action Button */}
                  <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-stone-100">
                    <span className="text-xs sm:text-sm font-black text-stone-900 tracking-tight">
                      {formatCurrency(prod.sellPrice)}
                    </span>

                    {isSoldOut ? (
                      <span className="text-[10px] font-bold text-rose-500 uppercase bg-rose-50 px-2 py-1 rounded-xl border border-rose-200/50">
                        Habis
                      </span>
                    ) : cartItem ? (
                      /* Quantity Stepper if in cart */
                      <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200/80 rounded-xl p-0.5">
                        <button 
                          onClick={(e) => updateQty(prod.id, -1, e)}
                          className="w-6 h-6 rounded-lg bg-white text-stone-700 flex items-center justify-center shadow-xs active:scale-90 hover:bg-amber-100 transition-colors"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-black text-amber-900 min-w-[16px] text-center">
                          {cartItem.qty}
                        </span>
                        <button 
                          onClick={(e) => updateQty(prod.id, 1, e)}
                          className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-xs active:scale-90 hover:bg-amber-700 transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    ) : (
                      /* Add Button */
                      <button 
                        onClick={(e) => addToCart(prod, e)}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border border-amber-200/70 shadow-xs flex items-center justify-center transition-all active:scale-90"
                        title="Tambah ke Keranjang"
                      >
                        <Plus size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 3. Floating Bottom Island (Cart Trigger) */}
      {cart.length > 0 && (
        <div className="fixed bottom-3 inset-x-0 z-40 max-w-xl mx-auto px-4">
          <button 
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3.5 px-5 bg-stone-900/95 backdrop-blur-xl hover:bg-stone-900 text-white font-bold rounded-3xl shadow-[0_12px_35px_-5px_rgba(28,25,23,0.35)] border border-white/10 flex justify-between items-center transition-transform active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="relative w-8 h-8 rounded-xl bg-amber-500 text-stone-900 flex items-center justify-center font-black">
                <ShoppingCart size={17} />
              </div>
              <div className="text-left">
                <span className="text-xs text-stone-300 font-medium block">
                  {totalCartItems} Menu Dipilih
                </span>
                <span className="text-sm font-black text-white">
                  {formatCurrency(cartSubtotal)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-white/10 px-3 py-1.5 rounded-2xl">
              <span>Lihat Pesanan</span>
              <ChevronRight size={14} />
            </div>
          </button>
        </div>
      )}

      {/* 4. Cart Sheet / Slider Drawer Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 text-stone-800">
            
            {/* Drawer Header */}
            <div className="p-4 border-b border-stone-200/80 flex justify-between items-center bg-[#FAF8F5]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-200/70 text-amber-700 flex items-center justify-center">
                  <ShoppingCart size={18} />
                </div>
                <div>
                  <h3 className="font-black text-stone-900 text-sm">Keranjang Pesanan</h3>
                  <p className="text-[11px] text-stone-500 font-medium">
                    Meja {tableInfo?.tableNo || tableRef} &bull; Dine-In
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors"
              >
                <X size={17} />
              </button>
            </div>

            {/* Cart Items Scrollable List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-16 space-y-2">
                  <Utensils className="mx-auto text-stone-300" size={32} />
                  <p className="text-xs font-bold text-stone-500">Keranjang masih kosong</p>
                  <p className="text-[11px] text-stone-400">Pilih menu favorit Anda dari katalog.</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.productId} className="p-3.5 border border-stone-200/80 rounded-2xl bg-white shadow-xs space-y-2.5">
                    <div className="flex gap-3">
                      <div className="w-14 h-14 rounded-xl bg-stone-100 overflow-hidden flex-shrink-0 border border-stone-200/60">
                        <img 
                          src={item.imageUrl || '/assets/images/cafe_login_cover.png'} 
                          alt={item.name} 
                          className="w-full h-full object-cover"
                          onError={(e: any) => { e.target.src = '/assets/images/cafe_login_cover.png'; }}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h4 className="text-xs font-bold text-stone-900 line-clamp-1">{item.name}</h4>
                          <span className="text-xs font-black text-stone-900">{formatCurrency(item.price * item.qty)}</span>
                        </div>
                        <span className="text-[10px] text-stone-400 font-medium">{formatCurrency(item.price)}/porsi</span>

                        {/* Qty Controller */}
                        <div className="flex justify-end items-center gap-2 mt-1">
                          <button 
                            onClick={() => updateQty(item.productId, -1)}
                            className="w-6 h-6 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center active:scale-95"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-xs font-black text-stone-800 min-w-[16px] text-center">{item.qty}</span>
                          <button 
                            onClick={() => updateQty(item.productId, 1)}
                            className="w-6 h-6 rounded-lg bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center active:scale-95 shadow-xs"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Note Input */}
                    <input 
                      type="text" 
                      placeholder="Catatan khusus (contoh: pedas manis, es sedikit)..."
                      className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200/70 rounded-xl text-[11px] text-stone-700 outline-none focus:border-amber-400 focus:bg-white placeholder-stone-400 transition-colors"
                      value={item.notes}
                      onChange={e => updateNotes(item.productId, e.target.value)}
                    />
                  </div>
                ))
              )}
            </div>

            {/* Check-Out Form & Cost Summary */}
            {cart.length > 0 && (
              <form onSubmit={handlePlaceOrder} className="border-t border-stone-200/80 p-4 space-y-3.5 bg-[#FAF8F5]">
                
                {/* Customer Information */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                    Informasi Meja & Pemesan
                  </span>
                  
                  <div className="space-y-2">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
                      <input 
                        type="text" 
                        placeholder="Nama Pemesan (Wajib) *"
                        className="w-full pl-9 pr-3 py-2 bg-white border border-stone-200/80 rounded-xl text-xs font-medium text-stone-800 outline-none focus:border-amber-500 shadow-xs placeholder-stone-400"
                        required
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                      />
                    </div>

                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
                      <input 
                        type="tel" 
                        placeholder="Nomor WA (Opsional - untuk nota digital)"
                        className="w-full pl-9 pr-3 py-2 bg-white border border-stone-200/80 rounded-xl text-xs font-medium text-stone-800 outline-none focus:border-amber-500 shadow-xs placeholder-stone-400"
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Pricing Breakdown */}
                <div className="border-t border-stone-200/80 pt-2.5 text-xs space-y-1.5 text-stone-500">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-semibold text-stone-800">{formatCurrency(cartSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>PPN (11%)</span>
                    <span className="font-medium text-stone-700">{formatCurrency(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>Service Charge (5%)</span>
                    <span className="font-medium text-stone-700">{formatCurrency(serviceAmount)}</span>
                  </div>
                  <div className="flex justify-between border-t border-dashed border-stone-200 pt-2 font-black text-stone-900 text-sm">
                    <span>Total Pembayaran</span>
                    <span className="text-amber-800 font-black">{formatCurrency(cartTotal)}</span>
                  </div>
                </div>

                {/* Submit CTA */}
                <button 
                  type="submit"
                  className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black text-sm rounded-2xl shadow-lg shadow-amber-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Check size={18} />
                  <span>Kirim Pesanan ke Dapur</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DineInView;
