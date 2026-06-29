import React, { useState, useEffect, useContext } from 'react';
import { Camera, Plus, Trash2, Minus, Search, CreditCard, User, Edit2, ShoppingCart, Package, ArrowRight, X, Save, Lock, Play } from 'lucide-react';
import CheckoutModal from './CheckoutModal';
import CustomerModal from './CustomerModal';
import DrinkCustomizationModal from './DrinkCustomizationModal';
import type { DrinkCustomization } from './DrinkCustomizationModal';
import OpenShiftModal from './OpenShiftModal';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';
import { offlineDB } from '../utils/offlineDb';

export interface CartItem {
  product: any;
  qty: number;
  notes?: string;
}

export const POSView = () => {
  const [activeCategory, setActiveCategory] = useState<number | 'Semua'>('Semua');
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customer, setCustomer] = useState<any>(null);
  
  const [orderType, setOrderType] = useState<'Dine In' | 'Take Away'>('Take Away');
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);

  const [drinkModalOpen, setDrinkModalOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<any>(null);
  const [isOpenShiftOpen, setIsOpenShiftOpen] = useState(false);
  
  const posContext = useContext(POSContext);
  const drinkCustomizationEnabled = posContext?.settings?.enableDrinkCustomization ?? false;

  useEffect(() => {
    if (posContext?.token) {
      fetchCategories();
      fetchProducts();
      fetchTables();
    }
  }, [posContext?.token]);

  const fetchTables = async () => {
    try {
      const res = await fetch('/api/tables', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        setTables(await res.json());
      }
    } catch (err) {}
  };

  const fetchCategories = async () => {
    if (navigator.onLine) {
      try {
        const res = await fetch('/api/categories', {
          headers: { Authorization: `Bearer ${posContext?.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setCategories(data);
          await offlineDB.saveCategories(data);
        }
      } catch (err) {
        console.error('Fetch categories failed, loading from cache:', err);
        const cached = await offlineDB.getCategories();
        setCategories(cached);
      }
    } else {
      const cached = await offlineDB.getCategories();
      setCategories(cached);
    }
  };

  const fetchProducts = async () => {
    if (navigator.onLine) {
      try {
        const res = await fetch('/api/products', {
          headers: { Authorization: `Bearer ${posContext?.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const activeProducts = data.filter((p: any) => p.status === 'Aktif');
          setProducts(activeProducts);
          await offlineDB.saveProducts(activeProducts);
        }
      } catch (err) {
        console.error('Fetch products failed, loading from cache:', err);
        const cached = await offlineDB.getProducts();
        setProducts(cached);
      }
    } else {
      const cached = await offlineDB.getProducts();
      setProducts(cached);
    }
  };

  const formatCurrency = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;

  const addToCart = (product: any, customization?: DrinkCustomization) => {
    const notesStr = customization
      ? [customization.temperature, customization.sugar, customization.ice, customization.notes].filter(Boolean).join(' • ')
      : '';
    setCart(prev => {
      // If same product and same notes -> stack qty
      const existing = prev.find(item => item.product.id === product.id && item.notes === notesStr);
      if (existing) {
        return prev.map(item => item.product.id === product.id && item.notes === notesStr ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { product, qty: 1, notes: notesStr }];
    });
  };

  const handleProductClick = (product: any) => {
    // Determine if product is a drink (category name contains minuman or bevvies)
    const categoryName = categories.find((c: any) => c.id === product.categoryId)?.name?.toLowerCase() || '';
    const isDrink = categoryName.includes('minum') || categoryName.includes('bev');
    if (drinkCustomizationEnabled && isDrink) {
      setPendingProduct(product);
      setDrinkModalOpen(true);
    } else {
      addToCart(product);
    }
  };

  const decreaseQty = (productId: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === productId);
      if (existing && existing.qty > 1) {
        return prev.map(item => item.product.id === productId ? { ...item, qty: item.qty - 1 } : item);
      }
      return prev.filter(item => item.product.id !== productId);
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const taxRate = posContext?.settings?.taxRate || 0;
  const serviceChargeRate = posContext?.settings?.serviceCharge || 0;

  const subtotal = cart.reduce((sum, item) => sum + (item.product.sellPrice * item.qty), 0);
  const discount = customer?.discountAmount || 0;
  const tax = (subtotal - discount) * (taxRate / 100);
  const serviceCharge = (subtotal - discount) * (serviceChargeRate / 100);
  const total = subtotal - discount + tax + serviceCharge;

  const handleSaveBill = async () => {
    if (cart.length === 0 || !selectedTableId) return;

    try {
      const payload = {
        customerName: customer ? customer.name : 'Pelanggan Dine-In',
        customerPhone: customer?.phone || '',
        tableId: selectedTableId,
        items: cart.map(item => ({
          productId: item.product.id,
          qty: item.qty,
          price: item.product.sellPrice,
          notes: item.notes || ''
        })),
        subtotal,
        tax,
        serviceCharge,
        total,
        discount,
        customerId: customer?.id,
        pointsUsed: customer?.pointsUsed || 0,
        paymentMethod: 'Pending',
        isPaid: false
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast('Bill berhasil disimpan! Pesanan dikirim ke Dapur.', 'success');
        setCart([]);
        setCustomer(null);
        setSelectedTableId(null);
        fetchProducts(); // Refresh stock
      } else {
        const data = await res.json();
        toast(data.error || 'Gagal menyimpan bill', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan server', 'error');
    }
  };

  const filteredProducts = activeCategory === 'Semua' 
    ? products 
    : products.filter(p => p.categoryId === activeCategory);

  const isShiftRequired = posContext?.user?.role === 'Kasir' || posContext?.user?.role === 'Admin';
  const hasActiveShift = posContext?.activeShift !== null;

  if (isShiftRequired && !hasActiveShift) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50/50 p-6 text-center min-h-[500px]">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200/80 shadow-lg flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-6 border border-indigo-100">
            <Lock size={28} className="animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Shift Belum Dibuka</h3>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Untuk mulai melayani transaksi penjualan di kasir, Anda harus membuka shift baru dan memasukkan saldo modal laci awal terlebih dahulu.
          </p>
          <button 
            className="w-full btn btn-primary mt-6 py-3 rounded-xl font-bold text-sm shadow-md hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
            onClick={() => setIsOpenShiftOpen(true)}
          >
            <Play size={16} /> Buka Shift Kasir Sekarang
          </button>
        </div>

        <OpenShiftModal 
          isOpen={isOpenShiftOpen} 
          onClose={() => setIsOpenShiftOpen(false)} 
          onSuccess={() => posContext?.fetchActiveShift()} 
          mode="open" 
        />
      </div>
    );
  }

  return (
    <div className="pos-layout">
      {/* Kiri: Daftar Produk */}
      <div className="pos-main">
        {/* Scanner & Filter */}
        <div className="pos-toolbar">
          <div className="scanner-box">
            <Search size={20} />
            <input 
              type="text" 
              className="scanner-input" 
              placeholder="Scan / ketik barcode..."
              autoFocus
            />
            <button className="scanner-btn">
              <Camera size={16} /> Kamera
            </button>
          </div>
          
          <div className="category-filter">
            <button 
              className={`category-chip ${activeCategory === 'Semua' ? 'active' : ''}`}
              onClick={() => setActiveCategory('Semua')}
            >
              Semua
            </button>
            {categories.map(cat => (
              <button 
                key={cat.id}
                className={`category-chip ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Produk */}
        <div className="product-grid overflow-y-auto">
          {filteredProducts.map(product => (
            <div key={product.id} className="product-card cursor-pointer group" onClick={() => handleProductClick(product)}>
              <div className="product-img-wrapper bg-gray-100 flex items-center justify-center relative overflow-hidden">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="product-img group-hover:scale-105 transition-transform" />
                ) : (
                  <Package size={40} className="text-gray-300" />
                )}
                <div className="absolute inset-0 bg-black bg-opacity-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
              <div className="product-info">
                <div>
                  <div className="product-name truncate" title={product.name}>{product.name}</div>
                  <div className="product-price">{formatCurrency(product.sellPrice)}</div>
                  <div className="product-stock flex justify-between items-center mt-1">
                    <span className={`text-xs font-semibold ${product.stock <= product.minStock ? 'text-red-500' : 'text-gray-500'}`}>Stok: {product.stock}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full text-center p-12 text-gray-400">
              <Package size={48} className="mx-auto mb-4 opacity-50" />
              <p>Belum ada produk untuk kategori ini.</p>
            </div>
          )}
        </div>
      </div>

      {/* Kanan: Keranjang */}
      <div className="pos-sidebar">
        <div className="cart-header">
          <div className="cart-title">
            <ShoppingCart size={20} /> Keranjang
          </div>
          <button className="icon-btn text-danger" onClick={() => setCart([])} disabled={cart.length === 0}>
            <Trash2 size={18} />
          </button>
        </div>

        <div className="cart-body flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <ShoppingCart size={48} className="mb-4 opacity-30" />
              <p>Keranjang masih kosong</p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={idx} className="cart-item">
                <div className="cart-item-info">
                  <div className="cart-item-name truncate max-w-[150px]">{item.product.name}</div>
                  {item.notes && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600, marginTop: '0.15rem', lineHeight: 1.3 }}>{item.notes}</div>
                  )}
                  <div className="cart-item-price">{formatCurrency(item.product.sellPrice)} <span className="text-muted" style={{fontSize: '12px', fontWeight: 'normal'}}>x {item.qty}</span></div>
                  
                  <div className="cart-item-controls mt-2">
                    <button className="qty-btn" onClick={() => decreaseQty(item.product.id)}><Minus size={14} /></button>
                    <span className="qty-val">{item.qty}</span>
                    <button className="qty-btn" onClick={() => addToCart(item.product)}><Plus size={14} /></button>
                  </div>
                </div>
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between'}}>
                  <button className="cart-item-remove text-gray-400 hover:text-red-500" onClick={() => removeFromCart(item.product.id)}><X size={16}/></button>
                  <div style={{fontWeight: 700, fontSize: '0.875rem'}}>{formatCurrency(item.product.sellPrice * item.qty)}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="cart-footer">
          <div className="summary-row">
            <span>Subtotal</span>
            <span style={{fontWeight: 600, color: 'var(--text-main)'}}>{formatCurrency(subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>Diskon <span className="text-muted" style={{fontSize: '10px'}}>{customer?.pointsUsed ? `(Poin: ${customer.pointsUsed})` : ''}</span></span>
            <span className="text-red-500">-{formatCurrency(discount)}</span>
          </div>
          <div className="summary-row">
            <span>PPN <span className="text-muted" style={{fontSize: '10px'}}>({taxRate}%)</span></span>
            <span>{formatCurrency(tax)}</span>
          </div>
          {serviceChargeRate > 0 && (
            <div className="summary-row">
              <span>Layanan <span className="text-muted" style={{fontSize: '10px'}}>({serviceChargeRate}%)</span></span>
              <span>{formatCurrency(serviceCharge)}</span>
            </div>
          )}
          <div className="summary-total border-t pt-3 mt-2">
            <span>Total</span>
            <span className="text-xl">{formatCurrency(total)}</span>
          </div>
          
          {/* Customer Selection */}
          <div 
            className="mb-3 p-3 border border-gray-200 rounded-lg flex items-center justify-between bg-white cursor-pointer hover:border-primary transition-colors group shadow-sm"
            onClick={() => setIsCustomerModalOpen(true)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-primary flex items-center justify-center">
                <User size={20} />
              </div>
              <div>
                <div className="font-bold text-sm text-gray-800">
                  {customer ? customer.name : 'Pelanggan Umum'}
                </div>
                <div className="text-xs text-muted">
                  {customer?.points ? `Member (${customer.points} pts)` : 'Klik untuk data Pemesan'}
                </div>
              </div>
            </div>
            <Edit2 size={16} className="text-gray-400 group-hover:text-primary" />
          </div>

          {/* Table / Order Type Selection */}
          <div className="mb-4 p-3 border border-gray-200 rounded-lg bg-white shadow-sm flex flex-col gap-3">
            <div className="flex gap-2">
              <button 
                className={`flex-1 py-2 text-sm font-bold rounded-md border transition-all ${orderType === 'Take Away' ? 'bg-primary text-white border-primary' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                onClick={() => { setOrderType('Take Away'); setSelectedTableId(null); }}
              >
                Take Away
              </button>
              <button 
                className={`flex-1 py-2 text-sm font-bold rounded-md border transition-all ${orderType === 'Dine In' ? 'bg-primary text-white border-primary' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                onClick={() => setOrderType('Dine In')}
              >
                Dine In
              </button>
            </div>
            
            {orderType === 'Dine In' && (
              <select 
                className="form-control font-semibold bg-blue-50 border-blue-200 text-blue-900"
                value={selectedTableId || ''}
                onChange={e => setSelectedTableId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">-- Pilih Nomor Meja --</option>
                {tables.filter(t => t.status === 'Aktif').map(t => (
                  <option key={t.id} value={t.id}>Meja {t.tableNo} (Kapasitas: {t.capacity})</option>
                ))}
              </select>
            )}
          </div>

          {orderType === 'Dine In' && (
            <button 
              className={`w-full font-bold rounded-lg py-3 mb-2 flex items-center justify-center gap-2 border-2 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800 transition-all shadow-sm ${cart.length === 0 || !selectedTableId ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={cart.length === 0 || !selectedTableId}
              onClick={handleSaveBill}
            >
              <Save size={20} /> Simpan Bill (Kirim ke Dapur)
            </button>
          )}

          <button 
            className="btn-checkout py-3 flex items-center justify-center gap-2"
            disabled={cart.length === 0 || (orderType === 'Dine In' && !selectedTableId)}
            onClick={() => setIsCheckoutOpen(true)}
          >
            <CreditCard size={20} /> Proses Pembayaran
          </button>
        </div>
      </div>
      
      <CheckoutModal 
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)} 
        onSuccess={() => {
          setCart([]);
          setCustomer(null);
          fetchProducts(); // Refresh stock
        }}
        total={total} 
        subtotal={subtotal}
        tax={tax}
        serviceCharge={serviceCharge}
        cart={cart}
        customer={{ ...customer, tableId: selectedTableId }}
      />

      <CustomerModal 
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSelect={(data) => setCustomer(data)}
      />

      <DrinkCustomizationModal
        isOpen={drinkModalOpen}
        productName={pendingProduct?.name || ''}
        onClose={() => { setDrinkModalOpen(false); setPendingProduct(null); }}
        onConfirm={(customization) => {
          if (pendingProduct) addToCart(pendingProduct, customization);
          setDrinkModalOpen(false);
          setPendingProduct(null);
        }}
      />
    </div>
  );
};

export default POSView;
