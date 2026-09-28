import React, { useState, useEffect, useContext } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { POSContext } from '../context/POSContext';
import NotificationBell from './NotificationBell';
import TenantOutletSwitcher from './TenantOutletSwitcher';
import OpenShiftModal from './OpenShiftModal';
import useSocket from '../hooks/useSocket';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Tags, 
  Truck, 
  Users, 
  Wallet, 
  FileText, 
  History, 
  Clock, 
  Calendar, 
  Grid, 
  QrCode,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChefHat,
  Menu,
  Fingerprint,
  Settings,
  Award,
  ClipboardList,
  PackageSearch,
  Boxes,
  Delete,
  PanelLeftClose,
  PanelLeftOpen,
  CreditCard,
  ShieldAlert,
  Sparkles,
  Store,
  LayoutGrid
} from 'lucide-react';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('pos_sidebar_collapsed') === 'true';
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isGlobalShiftModalOpen, setIsGlobalShiftModalOpen] = useState(false);
  const [globalShiftModalMode, setGlobalShiftModalMode] = useState<'open' | 'close'>('open');

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('pos_sidebar_collapsed', String(next));
      return next;
    });
  };
  const location = useLocation();
  const posContext = useContext(POSContext);
  const [kdsCount, setKdsCount] = useState(0);
  const socket = useSocket();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isKDSEnabled = posContext?.settings?.enableKDS !== false;

  const fetchKdsCount = async () => {
    if (!posContext?.token || !isKDSEnabled) {
      setKdsCount(0);
      return;
    }
    try {
      const res = await fetch('/api/kds/active', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setKdsCount(data.length);
      }
    } catch (err) {
      console.error('Failed to fetch KDS count:', err);
    }
  };

  useEffect(() => {
    if (posContext?.token && isKDSEnabled) {
      fetchKdsCount();
    } else {
      setKdsCount(0);
    }
  }, [posContext?.token, isKDSEnabled]);

  useEffect(() => {
    if (!posContext?.token) return;

    socket.on('order:new', fetchKdsCount);
    socket.on('order:void', fetchKdsCount);
    socket.on('kds:statusChanged', fetchKdsCount);
    socket.on('order:paid', fetchKdsCount);

    return () => {
      socket.off('order:new', fetchKdsCount);
      socket.off('order:void', fetchKdsCount);
      socket.off('kds:statusChanged', fetchKdsCount);
      socket.off('order:paid', fetchKdsCount);
    };
  }, [socket, posContext?.token]);
  const titleMap: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/pos': 'POS - Point of Sale',
    '/meja': 'Manajemen Meja',
    '/riwayat': 'Riwayat Transaksi',
    '/produk': 'Katalog Produk',
    '/kategori': 'Kategori Menu',
    '/reservasi': 'Buku Reservasi',
    '/kds': 'Dapur (KDS)',
    '/bahan-baku': 'Manajemen Bahan Baku',
    '/po': 'Purchase Order (PO)',
    '/supplier': 'Supplier Bahan',
    '/pengeluaran': 'Petty Cash & Biaya',
    '/karyawan': 'Data Karyawan',
    '/absensi': 'Absensi Karyawan',
    '/shift': 'Riwayat Shift & Kasir',
    '/crm': 'Pelanggan & CRM',
    '/laporan': 'Laporan Penjualan',
    '/audit-log': 'Audit Trail & Log Aktivitas',
    '/cabang': 'Manajemen Cabang',
    '/pengaturan': 'Pengaturan Sistem'
  };
  const pageTitle = titleMap[location.pathname] || 'MUKI RAMEN POS';

  // Quick PIN Switch States
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  const handlePinSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pinInput.length < 4) {
      setPinError('PIN minimal 4 digit.');
      return;
    }
    submitPin(pinInput);
  };

  const submitPin = async (val: string) => {
    setPinLoading(true);
    setPinError('');
    try {
      const res = await fetch('/api/auth/switch-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: val })
      });
      const data = await res.json();
      if (res.ok) {
        posContext?.login(data.user, data.token);
        setIsPinModalOpen(false);
        setPinInput('');
        window.location.reload();
      } else {
        setPinError(data.error || 'PIN salah atau user tidak aktif.');
        setPinInput('');
      }
    } catch (err) {
      setPinError('Terjadi kesalahan jaringan.');
    } finally {
      setPinLoading(false);
    }
  };

  const handleKeypadClick = (num: string) => {
    setPinError('');
    if (pinInput.length < 6) {
      const newPin = pinInput + num;
      setPinInput(newPin);
      if (newPin.length === 6) {
        setTimeout(() => {
          submitPin(newPin);
        }, 150);
      }
    }
  };

  const handleBackspace = () => {
    setPinInput(prev => prev.slice(0, -1));
  };

  const userRole = posContext?.user?.role || 'OWNER';
  const checkAccess = (allowedRoles: string[]) => {
    if (!userRole) return true;
    const roleUpper = String(userRole).toUpperCase();
    // SuperAdmin, Owner, and Admin have universal access
    if (roleUpper === 'OWNER' || roleUpper === 'ADMIN' || roleUpper === 'SUPERADMIN') {
      return true;
    }
    return allowedRoles.some(r => {
      const ru = r.toUpperCase();
      if (ru === 'ADMIN' && (roleUpper === 'ADMIN' || roleUpper === 'OWNER' || roleUpper === 'SUPERADMIN')) return true;
      if (ru === 'KASIR' && (roleUpper === 'KASIR' || roleUpper === 'CASHIER' || roleUpper === 'OWNER' || roleUpper === 'ADMIN')) return true;
      if (ru === 'DAPUR' && (roleUpper === 'DAPUR' || roleUpper === 'KITCHEN' || roleUpper === 'OWNER' || roleUpper === 'ADMIN')) return true;
      if (ru === 'GUDANG' && (roleUpper === 'GUDANG' || roleUpper === 'WAREHOUSE' || roleUpper === 'OWNER' || roleUpper === 'ADMIN')) return true;
      return ru === roleUpper;
    });
  };

  return (
    <div className={`app-container ${(isCollapsed && !isMobile) ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar */}
      {!isMobile && (
        <aside className="sidebar">
          <div className="sidebar-header flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={toggleSidebar} title={isCollapsed ? "Klik untuk memperluas sidebar" : ""}>
              <div className="brand-logo shrink-0" style={{ overflow: 'hidden', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', padding: '2px' }}>
                {posContext?.settings?.logoUrl ? (
                  <img src={posContext.settings.logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <img src="/logo-muki-ramen.png" alt="MUKI RAMEN" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                )}
              </div>
              {!isCollapsed && (
                <div className="brand-text truncate">
                  <div className="brand-title truncate">{posContext?.settings?.storeName || 'MUKI RAMEN'}</div>
                  <div className="brand-subtitle truncate">Japanese Ramen POS</div>
                </div>
              )}
            </div>
            
            <button 
              type="button"
              onClick={toggleSidebar}
              className="sidebar-collapse-btn text-purple-300 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-all"
              title={isCollapsed ? "Perluas Sidebar" : "Kecilkan Sidebar (Minimize)"}
            >
              {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>
        
          <nav className="nav-menu">
            {checkAccess(['Admin']) && (
              <NavLink to="/dashboard" title="Dashboard" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <LayoutDashboard size={20} className="shrink-0" />
                <span>Dashboard</span>
              </NavLink>
            )}
            {checkAccess(['Admin', 'Kasir']) && (
              <NavLink to="/pos" title="POS / Penjualan" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <ShoppingCart size={20} className="shrink-0" />
                <span>POS / Penjualan</span>
              </NavLink>
            )}
            {isKDSEnabled && checkAccess(['Admin', 'Dapur']) && (
              <NavLink to="/kds" title="Dapur (KDS)" className={({isActive}) => `nav-item relative ${isActive ? 'active' : ''}`}>
                <ChefHat size={20} className="shrink-0" />
                <span>Dapur (KDS)</span>
                {kdsCount > 0 && (
                  <span className="badge-count" style={{ 
                    backgroundColor: '#ef4444', 
                    color: 'white', 
                    fontSize: '0.7rem', 
                    fontWeight: 800, 
                    padding: '2px 6px', 
                    borderRadius: '9999px',
                    marginLeft: 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '18px',
                    height: '18px',
                    lineHeight: 1
                  }}>
                    {kdsCount}
                  </span>
                )}
              </NavLink>
            )}
            {checkAccess(['Admin']) && (
              <NavLink to="/produk" title="Produk" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <Package size={20} className="shrink-0" />
                <span>Produk</span>
              </NavLink>
            )}
            {checkAccess(['Admin', 'Kasir']) && (
              <NavLink to="/reservasi" title="Reservasi" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <Calendar size={20} className="shrink-0" />
                <span>Reservasi</span>
              </NavLink>
            )}
            {checkAccess(['Admin', 'Kasir', 'Dapur']) && (
              <NavLink to="/meja" title="Nomor Meja" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <Grid size={20} className="shrink-0" />
                <span>Nomor Meja</span>
              </NavLink>
            )}
            {checkAccess(['Admin', 'Kasir']) && (
              <NavLink to="/qrcode" title="Generate QR Code" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <QrCode size={20} className="shrink-0" />
                <span>Generate QR Code</span>
              </NavLink>
            )}
            {checkAccess(['Admin', 'Kasir']) && (
              <NavLink to="/kas" title="Arus Kas / Petty Cash" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <Wallet size={20} className="shrink-0" />
                <span>Arus Kas / Petty Cash</span>
              </NavLink>
            )}

            {/* Group Pembelian */}
            {checkAccess(['Admin', 'Dapur']) && (
              <>
                <div className="sidebar-section-title">
                  <span>Pembelian</span>
                </div>
                <NavLink to="/supplier" title="Supplier" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                  <Truck size={20} className="shrink-0" />
                  <span>Supplier</span>
                </NavLink>
                {localStorage.getItem('feature_enable_po') === 'true' && (
                  <NavLink to="/purchase-order" title="Purchase Order" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                    <ClipboardList size={20} className="shrink-0" />
                    <span>Purchase Order</span>
                  </NavLink>
                )}
                <NavLink to="/gudang" title="Gudang Pusat" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                  <Boxes size={20} className="shrink-0" />
                  <span>Gudang Pusat</span>
                </NavLink>
                {posContext?.settings && (posContext.settings as any).ingredientTrackingEnabled && (
                  <NavLink to="/bahan-baku" title="Bahan Baku" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                    <PackageSearch size={20} className="shrink-0" />
                    <span>Bahan Baku</span>
                  </NavLink>
                )}
              </>
            )}

            <div className="sidebar-section-title">
              <span>SDM</span>
            </div>

            {checkAccess(['Admin']) && (
              <NavLink to="/karyawan" title="Pengguna & Karyawan" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <Users size={20} className="shrink-0" />
                <span>Pengguna & Karyawan</span>
              </NavLink>
            )}
            {checkAccess(['Admin']) && (
              <NavLink to="/crm" title="CRM & Member" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <Award size={20} className="shrink-0" />
                <span>CRM & Member</span>
              </NavLink>
            )}
            {checkAccess(['Admin']) && (
              <NavLink to="/absensi" title="Absensi Karyawan" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <Fingerprint size={20} className="shrink-0" />
                <span>Absensi Karyawan</span>
              </NavLink>
            )}
            {checkAccess(['Admin']) && (
              <NavLink to="/kasbon" title="Kasbon Karyawan" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <CreditCard size={20} className="shrink-0" />
                <span>Kasbon Karyawan</span>
              </NavLink>
            )}
            {checkAccess(['Admin', 'Kasir']) && (
              <NavLink to="/riwayat" title="Riwayat Transaksi" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <History size={20} className="shrink-0" />
                <span>Riwayat Transaksi</span>
              </NavLink>
            )}
            {checkAccess(['Admin', 'Kasir']) && (
              <NavLink to="/shift" title="History Shift" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <Clock size={20} className="shrink-0" />
                <span>History Shift</span>
              </NavLink>
            )}
            {checkAccess(['Admin']) && (
              <NavLink to="/laporan" title="Laporan" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <FileText size={20} className="shrink-0" />
                <span>Laporan</span>
              </NavLink>
            )}
            
            {checkAccess(['Admin']) && (
              <>
                <div className="sidebar-section-divider"></div>
                <NavLink to="/audit-log" title="Audit Trail Log" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                  <ShieldAlert size={20} className="shrink-0" />
                  <span>Audit Trail Log</span>
                </NavLink>
                <NavLink to="/pengaturan" title="Pengaturan Sistem" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                  <Settings size={20} className="shrink-0" />
                  <span>Pengaturan Sistem</span>
                </NavLink>
              </>
            )}
          </nav>
        </aside>
      )}

      {/* Main Content */}
      <main className="main-content">
        <header className="topbar" style={{ padding: isMobile ? '0.75rem 1rem' : '0 1.5rem', minHeight: isMobile ? '64px' : '64px' }}>
          <div className="flex items-center gap-3">
            {!isMobile ? (
              <>
                <button 
                  type="button"
                  className="icon-btn hover:bg-slate-100 p-2 rounded-xl text-slate-600 hover:text-indigo-600 transition-colors"
                  onClick={toggleSidebar}
                  title={isCollapsed ? "Perluas Sidebar" : "Kecilkan Sidebar (Minimize)"}
                >
                  {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
                </button>
                <h1 className="page-title" style={{ fontSize: '1.25rem', fontWeight: 800 }}>{pageTitle}</h1>
              </>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
                  <LayoutGrid size={20} />
                </div>
                <div className="flex flex-col min-w-0">
                  <h1 className="text-base font-extrabold text-slate-900 leading-tight truncate">{pageTitle}</h1>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate mt-0.5">
                    {posContext?.settings?.storeName || 'VAMOS POOL & CAFE'}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <div className="topbar-actions flex items-center gap-2 sm:gap-3">
            {/* Shift Kasir Quick Widget */}
            {posContext?.activeShift ? (
              <button
                type="button"
                onClick={() => {
                  setGlobalShiftModalMode('close');
                  setIsGlobalShiftModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-full shadow-xs transition-all active:scale-95 cursor-pointer"
                title="Shift Kasir Aktif - Klik untuk Tutup Shift & Rekonsiliasi"
              >
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <span className="hidden sm:inline">Kasir:</span>
                <strong className="text-indigo-950 font-extrabold max-w-[85px] truncate">
                  {posContext.activeShift.user?.name || posContext.activeShift.user?.username || 'Aktif'}
                </strong>
                <span className="text-[10px] text-indigo-600 bg-indigo-200/60 px-1.5 py-0.5 rounded-md hidden md:inline">Tutup</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setGlobalShiftModalMode('open');
                  setIsGlobalShiftModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-full shadow-xs transition-all active:scale-95 cursor-pointer"
                title="Kasir Belum Buka - Klik untuk Buka Shift"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>+ Buka Kasir</span>
              </button>
            )}

            {/* Indikator Status Koneksi */}
            {posContext?.isOnline ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full select-none shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                {!isMobile && <span>Online</span>}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-full select-none shadow-sm animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                {!isMobile && <span>Mode Offline</span>}
              </span>
            )}
            
            <NotificationBell />
            
            <div className="user-profile relative group cursor-pointer hover:bg-gray-50 rounded-lg p-1 transition-colors">
              <div className="avatar bg-indigo-600 text-white font-black text-xs w-9 h-9 rounded-full flex items-center justify-center shadow-sm">
                {posContext?.user?.username?.substring(0, 2).toUpperCase() || 'AD'}
              </div>
              {!isMobile && (
                <>
                  <div className="user-info">
                    <span className="user-name">{posContext?.user?.username || 'User'}</span>
                    <span className="user-role capitalize">{posContext?.user?.role || 'Staff'}</span>
                  </div>
                  <ChevronDown size={16} className="text-muted" />
                </>
              )}
              
              {/* Dropdown Menu (Hover) */}
              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                <button 
                  onClick={() => setIsPinModalOpen(true)}
                  className="w-full text-left px-4 py-3 text-sm text-indigo-600 hover:bg-indigo-50 font-bold transition-colors border-b border-gray-100 flex items-center gap-2"
                >
                  <Fingerprint size={16} /> Ganti Kasir
                </button>
                <button 
                  onClick={() => posContext?.logout()}
                  className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 font-bold transition-colors flex items-center gap-2"
                >
                  Keluar / Log Out
                </button>
              </div>
            </div>
          </div>
        </header>
        
        <div className="page-content flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden flex flex-col pb-24 md:pb-0" style={{ WebkitOverflowScrolling: 'touch' }}>
          {children}
        </div>
      </main>

      {/* Numeric Keypad Modal for Quick PIN Switch */}
      {isPinModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
          <div className="bg-white rounded-3xl w-full max-w-xs shadow-2xl border border-slate-100 p-6 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <Fingerprint size={24} />
            </div>
            
            <h3 className="text-base font-bold text-slate-800">Ganti Kasir Cepat</h3>
            <p className="text-[11px] text-slate-400 mt-1 mb-4 text-center">Masukkan 6 digit PIN kasir Anda untuk bertukar sesi dengan cepat.</p>

            {/* PIN Dots Display */}
            <div className="flex gap-3 my-4">
              {[...Array(6)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                    i < pinInput.length 
                      ? 'bg-indigo-600 border-indigo-600 scale-110 shadow-sm' 
                      : 'border-slate-200 bg-slate-50'
                  }`}
                ></div>
              ))}
            </div>

            {pinError && (
              <p className="text-[11px] text-red-500 font-bold mb-2 text-center animate-pulse">{pinError}</p>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2.5 w-full mt-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  type="button"
                  disabled={pinLoading}
                  onClick={() => handleKeypadClick(num)}
                  className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 text-lg font-extrabold transition-all active:scale-95 border border-slate-100 flex items-center justify-center"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                disabled={pinLoading}
                onClick={() => setPinInput('')}
                className="h-12 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition-all active:scale-95 flex items-center justify-center"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={pinLoading}
                onClick={() => handleKeypadClick('0')}
                className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 text-lg font-extrabold transition-all active:scale-95 border border-slate-100 flex items-center justify-center"
              >
                0
              </button>
              <button
                type="button"
                disabled={pinLoading}
                onClick={handleBackspace}
                className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm font-semibold transition-all active:scale-95 flex items-center justify-center"
                title="Backspace"
              >
                <Delete size={18} />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2.5 w-full mt-5">
              <button
                type="button"
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold transition-all active:scale-95"
                onClick={() => { setIsPinModalOpen(false); setPinInput(''); setPinError(''); }}
                disabled={pinLoading}
              >
                Batal
              </button>
              <button
                type="button"
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all active:scale-95"
                onClick={() => handlePinSubmit()}
                disabled={pinLoading || pinInput.length === 0}
              >
                {pinLoading ? '...' : 'Masuk'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Docked Native Android-style Bottom Navigation Bar for Mobile */}
      {isMobile && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40"
          style={{
            background: 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(0,0,0,0.07)',
            boxShadow: '0 -4px 30px rgba(0,0,0,0.07)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <div className="grid grid-cols-5 items-end h-[62px] px-1">

            {/* 1. Home */}
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-2xl transition-all active:scale-90 ${
                  isActive
                    ? 'text-emerald-700'
                    : 'text-slate-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`flex items-center justify-center rounded-2xl transition-all ${
                    isActive ? 'bg-emerald-100 px-4 py-1' : 'px-4 py-1'
                  }`}>
                    <LayoutGrid size={22} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={`text-[11px] leading-none transition-all ${
                    isActive ? 'font-bold' : 'font-medium'
                  }`}>Home</span>
                </>
              )}
            </NavLink>

            {/* 2. Meja */}
            <NavLink
              to="/meja"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-2xl transition-all active:scale-90 ${
                  isActive
                    ? 'text-emerald-700'
                    : 'text-slate-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`flex items-center justify-center rounded-2xl transition-all ${
                    isActive ? 'bg-emerald-100 px-4 py-1' : 'px-4 py-1'
                  }`}>
                    <Grid size={22} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={`text-[11px] leading-none transition-all ${
                    isActive ? 'font-bold' : 'font-medium'
                  }`}>Meja</span>
                </>
              )}
            </NavLink>

            {/* 3. Floating Center FAB: KASIR */}
            <div className="flex flex-col items-center justify-end pb-1">
              <NavLink
                to="/pos"
                title="Kasir POS"
                className={({ isActive }) =>
                  `relative flex flex-col items-center justify-center w-[58px] h-[58px] rounded-full -mt-6
                  bg-gradient-to-b from-teal-400 to-emerald-600
                  shadow-[0_6px_24px_rgba(16,185,129,0.45)]
                  border-[3.5px] border-white
                  active:scale-90 transition-all
                  ${ isActive ? 'ring-2 ring-offset-1 ring-emerald-400' : '' }`
                }
              >
                <ShoppingCart size={22} strokeWidth={2.5} className="text-white" />
                <span className="text-[8.5px] font-black tracking-widest text-white uppercase mt-0.5">KASIR</span>
              </NavLink>
            </div>

            {/* 4. Riwayat */}
            <NavLink
              to="/riwayat"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-2xl transition-all active:scale-90 ${
                  isActive
                    ? 'text-emerald-700'
                    : 'text-slate-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`flex items-center justify-center rounded-2xl transition-all ${
                    isActive ? 'bg-emerald-100 px-4 py-1' : 'px-4 py-1'
                  }`}>
                    <History size={22} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={`text-[11px] leading-none transition-all ${
                    isActive ? 'font-bold' : 'font-medium'
                  }`}>Riwayat</span>
                </>
              )}
            </NavLink>

            {/* 5. Lainnya */}
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen(true)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-2xl transition-all active:scale-90 focus:outline-none ${
                isMoreMenuOpen
                  ? 'text-emerald-700'
                  : 'text-slate-400'
              }`}
            >
              <div className={`flex items-center justify-center rounded-2xl transition-all ${
                isMoreMenuOpen ? 'bg-emerald-100 px-4 py-1' : 'px-4 py-1'
              }`}>
                <Menu size={22} strokeWidth={isMoreMenuOpen ? 2.5 : 2} />
              </div>
              <span className={`text-[11px] leading-none transition-all ${
                isMoreMenuOpen ? 'font-bold' : 'font-medium'
              }`}>Lainnya</span>
            </button>

          </div>
        </div>
      )}

      {/* Slide up Drawer Menu for other features */}
      {isMobile && isMoreMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center animate-in fade-in duration-200"
          style={{ background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)' }}
          onClick={() => setIsMoreMenuOpen(false)}
        >
          <div
            className="bg-white w-full rounded-t-[28px] shadow-2xl max-w-md flex flex-col animate-in slide-in-from-bottom duration-300"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>

            {/* Header */}
            <div className="flex justify-between items-center px-5 pt-1 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm">
                  <LayoutGrid size={15} className="text-white" />
                </div>
                <div>
                  <p className="font-extrabold text-sm text-slate-800 leading-tight">Menu Lengkap</p>
                  <p className="text-[10px] text-slate-400 font-medium">{posContext?.settings?.storeName || 'VAMOS POOL & CAFE'}</p>
                </div>
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                onClick={() => setIsMoreMenuOpen(false)}
              >
                <ChevronDown size={16} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 max-h-[60vh] overflow-y-auto px-4 py-3">
              {checkAccess(['Admin']) && (
                <NavLink to="/produk" onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white active:bg-slate-50 transition-all active:scale-95 gap-1.5 text-center border border-slate-100/80 shadow-sm">
                  <div className="w-11 h-11 rounded-2xl bg-violet-100 flex items-center justify-center">
                    <Package size={20} className="text-violet-600" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 leading-tight">Produk</span>
                </NavLink>
              )}

              {checkAccess(['Admin', 'Kasir']) && (
                <NavLink to="/reservasi" onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white active:bg-slate-50 transition-all active:scale-95 gap-1.5 text-center border border-slate-100/80 shadow-sm">
                  <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center">
                    <Calendar size={20} className="text-blue-600" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 leading-tight">Reservasi</span>
                </NavLink>
              )}

              {isKDSEnabled && checkAccess(['Admin', 'Kasir', 'Dapur']) && (
                <NavLink to="/kds" onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white active:bg-slate-50 transition-all active:scale-95 gap-1.5 text-center border border-slate-100/80 shadow-sm">
                  <div className="w-11 h-11 rounded-2xl bg-orange-100 flex items-center justify-center relative">
                    <ChefHat size={20} className="text-orange-600" />
                    {kdsCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black px-1 py-0.5 rounded-full min-w-[16px] text-center">{kdsCount}</span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 leading-tight">Dapur KDS</span>
                </NavLink>
              )}

              {checkAccess(['Admin', 'Dapur']) && (
                <NavLink to="/gudang" onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white active:bg-slate-50 transition-all active:scale-95 gap-1.5 text-center border border-slate-100/80 shadow-sm">
                  <div className="w-11 h-11 rounded-2xl bg-cyan-100 flex items-center justify-center">
                    <Boxes size={20} className="text-cyan-600" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 leading-tight">Gudang</span>
                </NavLink>
              )}

              {checkAccess(['Admin', 'Dapur']) && (
                <NavLink to="/bahan-baku" onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white active:bg-slate-50 transition-all active:scale-95 gap-1.5 text-center border border-slate-100/80 shadow-sm">
                  <div className="w-11 h-11 rounded-2xl bg-lime-100 flex items-center justify-center">
                    <PackageSearch size={20} className="text-lime-700" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 leading-tight">Bahan Baku</span>
                </NavLink>
              )}

              {checkAccess(['Admin', 'Dapur']) && localStorage.getItem('feature_enable_po') === 'true' && (
                <NavLink to="/purchase-order" onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white active:bg-slate-50 transition-all active:scale-95 gap-1.5 text-center border border-slate-100/80 shadow-sm">
                  <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center">
                    <ClipboardList size={20} className="text-amber-600" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 leading-tight">PO Belanja</span>
                </NavLink>
              )}

              {checkAccess(['Admin', 'Dapur']) && (
                <NavLink to="/supplier" onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white active:bg-slate-50 transition-all active:scale-95 gap-1.5 text-center border border-slate-100/80 shadow-sm">
                  <div className="w-11 h-11 rounded-2xl bg-teal-100 flex items-center justify-center">
                    <Truck size={20} className="text-teal-600" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 leading-tight">Supplier</span>
                </NavLink>
              )}

              {checkAccess(['Admin', 'Kasir']) && (
                <NavLink to="/qrcode" onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white active:bg-slate-50 transition-all active:scale-95 gap-1.5 text-center border border-slate-100/80 shadow-sm">
                  <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <QrCode size={20} className="text-slate-600" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 leading-tight">QR Code</span>
                </NavLink>
              )}

              {checkAccess(['Admin', 'Kasir']) && (
                <NavLink to="/kas" onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white active:bg-slate-50 transition-all active:scale-95 gap-1.5 text-center border border-slate-100/80 shadow-sm">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-100 flex items-center justify-center">
                    <Wallet size={20} className="text-emerald-600" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 leading-tight">Petty Cash</span>
                </NavLink>
              )}

              {checkAccess(['Admin']) && (
                <NavLink to="/karyawan" onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white active:bg-slate-50 transition-all active:scale-95 gap-1.5 text-center border border-slate-100/80 shadow-sm">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-100 flex items-center justify-center">
                    <Users size={20} className="text-indigo-600" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 leading-tight">Karyawan</span>
                </NavLink>
              )}

              {checkAccess(['Admin']) && (
                <NavLink to="/crm" onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white active:bg-slate-50 transition-all active:scale-95 gap-1.5 text-center border border-slate-100/80 shadow-sm">
                  <div className="w-11 h-11 rounded-2xl bg-pink-100 flex items-center justify-center">
                    <Award size={20} className="text-pink-600" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 leading-tight">CRM Member</span>
                </NavLink>
              )}

              {checkAccess(['Admin']) && (
                <NavLink to="/absensi" onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white active:bg-slate-50 transition-all active:scale-95 gap-1.5 text-center border border-slate-100/80 shadow-sm">
                  <div className="w-11 h-11 rounded-2xl bg-yellow-100 flex items-center justify-center">
                    <Fingerprint size={20} className="text-yellow-600" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 leading-tight">Absensi</span>
                </NavLink>
              )}

              {checkAccess(['Admin']) && (
                <NavLink to="/kasbon" onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white active:bg-slate-50 transition-all active:scale-95 gap-1.5 text-center border border-slate-100/80 shadow-sm">
                  <div className="w-11 h-11 rounded-2xl bg-rose-100 flex items-center justify-center">
                    <CreditCard size={20} className="text-rose-600" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 leading-tight">Kasbon Staf</span>
                </NavLink>
              )}

              {checkAccess(['Admin', 'Kasir']) && (
                <NavLink to="/shift" onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white active:bg-slate-50 transition-all active:scale-95 gap-1.5 text-center border border-slate-100/80 shadow-sm">
                  <div className="w-11 h-11 rounded-2xl bg-sky-100 flex items-center justify-center">
                    <Clock size={20} className="text-sky-600" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 leading-tight">Shift</span>
                </NavLink>
              )}

              {checkAccess(['Admin']) && (
                <NavLink to="/laporan" onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white active:bg-slate-50 transition-all active:scale-95 gap-1.5 text-center border border-slate-100/80 shadow-sm">
                  <div className="w-11 h-11 rounded-2xl bg-fuchsia-100 flex items-center justify-center">
                    <FileText size={20} className="text-fuchsia-600" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 leading-tight">Laporan</span>
                </NavLink>
              )}

              {checkAccess(['Admin']) && (
                <NavLink to="/pengaturan" onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white active:bg-slate-50 transition-all active:scale-95 gap-1.5 text-center border border-slate-100/80 shadow-sm">
                  <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <Settings size={20} className="text-slate-600" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 leading-tight">Pengaturan</span>
                </NavLink>
              )}
            </div>

            <div className="flex gap-2 px-4 py-3 border-t border-slate-100">
              <button
                onClick={() => { setIsMoreMenuOpen(false); setIsPinModalOpen(true); }}
                className="flex-1 py-3 px-4 rounded-2xl border border-slate-200 bg-white text-indigo-600 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Fingerprint size={15} /> Ganti Kasir
              </button>
              <button
                onClick={() => posContext?.logout()}
                className="flex-1 py-3 px-4 rounded-2xl bg-rose-50 text-rose-600 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Open/Close Shift Modal */}
      <OpenShiftModal
        isOpen={isGlobalShiftModalOpen}
        mode={globalShiftModalMode}
        onClose={() => setIsGlobalShiftModalOpen(false)}
        onSuccess={() => {
          setIsGlobalShiftModalOpen(false);
          posContext?.fetchActiveShift();
        }}
      />
    </div>
  );
};

export default Layout;
