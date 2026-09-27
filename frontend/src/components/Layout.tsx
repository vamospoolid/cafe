import React, { useState, useEffect, useContext, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { POSContext } from '../context/POSContext';
import { useVertical } from '../context/VerticalContext';
import NotificationBell from './NotificationBell';
import TenantOutletSwitcher from './TenantOutletSwitcher';
import { NetworkStatusBanner } from './NetworkStatusBanner';
import SubscriptionBanner from './SubscriptionBanner';
import { seedLocalCatalogCache } from '../utils/catalogCacheSeeder';
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
  Cpu,
  Car,
  Wrench,
  BarChart3,
  ShoppingBag,
  Coffee,
  Shirt,
  Layers,
  LogOut
} from 'lucide-react';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('pos_sidebar_collapsed') === 'true';
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Sync isMobile on viewport resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileOpen]);

  const handleLogout = async () => {
    setIsProfileOpen(false);
    setIsMoreMenuOpen(false);
    try {
      if (posContext?.logout) {
        await posContext.logout();
      }
    } catch (err) {
      console.warn('Logout error:', err);
    }
    window.location.href = '/login';
  };

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('pos_sidebar_collapsed', String(next));
      return next;
    });
  };
  const location = useLocation();
  const isPOSPage = location.pathname === '/pos' || location.pathname.startsWith('/pos');
  const posContext = useContext(POSContext);
  const { isBengkel, isRetail, isLaundry } = useVertical();
  const [kdsCount, setKdsCount] = useState(0);
  const [activeBroadcasts, setActiveBroadcasts] = useState<any[]>([]);
  const [dismissedBroadcastIds, setDismissedBroadcastIds] = useState<string[]>(() => {
    try {
      const stored = sessionStorage.getItem('dismissed_broadcast_ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const socket = useSocket();

  const fetchActiveBroadcasts = async () => {
    if (!posContext?.token) return;
    try {
      const res = await fetch('/api/platform-admin/active-broadcasts', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveBroadcasts(data.broadcasts || []);
      }
    } catch (err) {
      console.warn('Failed to fetch active broadcasts:', err);
    }
  };

  const dismissBroadcast = (id: string) => {
    const updated = [...dismissedBroadcastIds, id];
    setDismissedBroadcastIds(updated);
    try {
      sessionStorage.setItem('dismissed_broadcast_ids', JSON.stringify(updated));
    } catch (_) {}
  };

  const isBroadcastDismissed = (id: string) => dismissedBroadcastIds.includes(id);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isKDSEnabled = !isBengkel && !isRetail && !isLaundry && posContext?.settings?.enableKDS !== false;

  const fetchKdsCount = async () => {
    if (!posContext?.token || isBengkel || isRetail || isLaundry || !isKDSEnabled) {
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
    if (posContext?.token && isKDSEnabled && !isBengkel && !isRetail && !isLaundry) {
      fetchKdsCount();
    } else {
      setKdsCount(0);
    }
    if (posContext?.token) {
      seedLocalCatalogCache(posContext.token);
      fetchActiveBroadcasts();
      const bcInterval = setInterval(fetchActiveBroadcasts, 30000);
      return () => clearInterval(bcInterval);
    }
  }, [posContext?.token, isKDSEnabled, isBengkel, isRetail, isLaundry]);

  useEffect(() => {
    if (!socket || !posContext?.token || isBengkel || isRetail || isLaundry || !isKDSEnabled) return;

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
  }, [socket, posContext?.token, isBengkel, isRetail, isLaundry, isKDSEnabled]);

  // Auto-refresh fitur saat paket/status tenant berubah (setelah verifikasi invoice oleh platform admin)
  useEffect(() => {
    if (!socket || !posContext?.fetchTenantFeatures) return;

    const handlePlanUpgrade = () => {
      posContext.fetchTenantFeatures();
    };

    socket.on('tenant:status_changed', handlePlanUpgrade);
    socket.on('subscription:renewed', handlePlanUpgrade);
    socket.on('tenant:reactivated', handlePlanUpgrade);

    return () => {
      socket.off('tenant:status_changed', handlePlanUpgrade);
      socket.off('subscription:renewed', handlePlanUpgrade);
      socket.off('tenant:reactivated', handlePlanUpgrade);
    };
  }, [socket, posContext?.fetchTenantFeatures]);
  const titleMap: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/pos': isBengkel ? 'POS Bengkel - Servis & Penjualan' : isRetail ? 'POS Kasir Grosir & Retail' : isLaundry ? 'POS Kasir Laundry & Kiloan' : 'POS - Point of Sale',
    '/laundry-kanban': 'Papan Status Cucian & Rak',
    '/meja': isBengkel ? 'Stall / Pit Pengerjaan' : isLaundry ? 'Rak Simpan / Keranjang' : 'Manajemen Meja',
    '/riwayat': 'Riwayat Transaksi',
    '/produk': isBengkel ? 'Katalog Jasa & Suku Cadang' : isRetail ? 'Katalog Barang & UOM' : isLaundry ? 'Katalog Paket Layanan' : 'Katalog Produk',
    '/kategori': isBengkel ? 'Kategori Jasa & Parts' : isRetail ? 'Kategori Sembako & Barang' : isLaundry ? 'Kategori Layanan Cuci' : 'Kategori Menu',
    '/reservasi': 'Buku Reservasi',
    '/kds': 'Dapur (KDS)',
    '/bahan-baku': isLaundry ? 'Bahan Kimia & Parfum' : 'Manajemen Bahan Baku',
    '/po': 'Purchase Order (PO)',
    '/supplier': isBengkel ? 'Supplier Suku Cadang' : isRetail ? 'Supplier & Distributor' : isLaundry ? 'Supplier Bahan Kimia' : 'Supplier Bahan',
    '/gudang': isBengkel ? 'Gudang Spare Part' : isRetail ? 'Gudang & Rak Toko' : isLaundry ? 'Gudang Chemical & Perlengkapan' : 'Gudang Pusat',
    '/pengeluaran': 'Petty Cash & Biaya',
    '/karyawan': 'Data Karyawan',
    '/absensi': 'Absensi Karyawan',
    '/shift': 'Riwayat Shift & Kasir',
    '/crm': isBengkel ? 'Data Pelanggan & Kendaraan' : isRetail ? 'Buku Pelanggan & Limit Bon Warung' : isLaundry ? 'Buku Pelanggan & WhatsApp' : 'Pelanggan & CRM',
    '/laporan': isBengkel ? 'Laporan Bengkel' : isRetail ? 'Laporan Penjualan & Margin Grosir' : isLaundry ? 'Laporan Laundry & Tonase' : 'Laporan Penjualan',
    '/retail/surat-jalan': 'Surat Jalan & Armada Toko',
    '/audit-log': 'Audit Trail & Log Aktivitas',
    '/pengaturan': 'Pengaturan Sistem'
  };
  const pageTitle = titleMap[location.pathname] || (posContext?.settings?.storeName ? `${posContext.settings.storeName} POS` : 'CodePOS');

  const mobileTitleMap: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/pos': isBengkel ? 'POS Bengkel' : isRetail ? 'POS Kasir' : isLaundry ? 'Kasir Laundry' : 'POS Kasir',
    '/laundry-kanban': 'Status Cucian',
    '/meja': isBengkel ? 'Stall Pit' : isLaundry ? 'Rak Simpan' : 'Denah Meja',
    '/riwayat': 'Riwayat',
    '/produk': isBengkel ? 'Suku Cadang' : isRetail ? 'Katalog Barang' : isLaundry ? 'Layanan Cuci' : 'Katalog Menu',
    '/kategori': isBengkel ? 'Kategori Jasa' : isRetail ? 'Kategori Barang' : isLaundry ? 'Kategori' : 'Kategori',
    '/reservasi': 'Reservasi',
    '/kds': 'Dapur (KDS)',
    '/bahan-baku': isLaundry ? 'Chemical' : 'Bahan Baku',
    '/po': 'Purchase Order',
    '/supplier': 'Supplier',
    '/gudang': 'Gudang',
    '/pengeluaran': 'Arus Kas',
    '/kas': 'Arus Kas',
    '/kasbon': 'Kasbon',
    '/karyawan': 'Karyawan',
    '/absensi': 'Absensi',
    '/shift': 'Shift Kasir',
    '/crm': isBengkel ? 'Data Kendaraan' : isRetail ? 'Buku Bon Warung' : isLaundry ? 'Pelanggan WA' : 'Pelanggan CRM',
    '/laporan': isBengkel ? 'Laporan Bengkel' : isRetail ? 'Laporan Retail' : isLaundry ? 'Laporan Laundry' : 'Laporan',
    '/retail/surat-jalan': 'Surat Jalan',
    '/audit-log': 'Audit Log',
    '/pengaturan': 'Pengaturan',
    '/platform-admin': 'Control Plane'
  };
  const mobilePageTitle = mobileTitleMap[location.pathname] || (isPOSPage ? (isBengkel ? 'POS Bengkel' : isRetail ? 'POS Kasir' : isLaundry ? 'Kasir Laundry' : 'POS Kasir') : pageTitle);

  const getMobileHeaderIcon = () => {
    if (isPOSPage) {
      if (isBengkel) return Wrench;
      if (isRetail) return ShoppingBag;
      if (isLaundry) return Shirt;
      return Coffee;
    }
    if (location.pathname === '/dashboard') return LayoutDashboard;
    if (location.pathname === '/laporan') return BarChart3;
    if (location.pathname === '/gudang') return Boxes;
    if (location.pathname === '/produk') return Package;
    if (location.pathname === '/crm') return Users;
    if (location.pathname === '/laundry-kanban') return Layers;
    if (location.pathname === '/pengeluaran' || location.pathname === '/kas') return Wallet;
    return Sparkles;
  };
  const MobileHeaderIcon = getMobileHeaderIcon();

  const mobileIconBg = isBengkel 
    ? 'bg-purple-600' 
    : isRetail 
    ? 'bg-indigo-600' 
    : isLaundry
    ? 'bg-cyan-600'
    : 'bg-amber-600';

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
  const isPlatformAdmin = posContext?.user?.isPlatformAdmin || userRole === 'SUPERADMIN' || (userRole === 'OWNER' && posContext?.user?.username === 'admin');

  const renderPlanBadge = (featureKey: string, tierLabel: 'PRO' | 'BIZ') => {
    if (isPlatformAdmin) return null;
    if (posContext?.hasFeature && posContext.hasFeature(featureKey)) return null;
    return (
      <span 
        className={`ml-auto px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
          tierLabel === 'BIZ' 
            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
        }`}
        title={`Modul ${tierLabel === 'BIZ' ? 'Paket Business' : 'Paket Growth'}`}
      >
        {tierLabel}
      </span>
    );
  };

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
                <img 
                  src={posContext?.settings?.logoUrl || '/logo.png'} 
                  alt={posContext?.settings?.storeName || 'Logo'} 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src !== window.location.origin + '/logo.png') {
                      target.src = '/logo.png';
                    }
                  }}
                />
              </div>
              {!isCollapsed && (
                <div className="brand-text truncate">
                  <div className="brand-title truncate">{posContext?.settings?.storeName || 'CodePOS'}</div>
                  <div className="brand-subtitle truncate">{posContext?.settings?.receiptHeader?.split('\n')[0] || 'Point of Sale Platform'}</div>
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
            {isBengkel ? (
              <>
                {checkAccess(['Admin']) && (
                  <NavLink to="/dashboard" title="Dashboard" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                    <LayoutDashboard size={20} className="shrink-0" />
                    <span>Dashboard</span>
                  </NavLink>
                )}
                {checkAccess(['Admin', 'Kasir']) && (
                  <NavLink to="/pos" title="POS Kasir Bengkel" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                    <ShoppingCart size={20} className="shrink-0" />
                    <span>POS Kasir Bengkel</span>
                  </NavLink>
                )}
                {checkAccess(['Admin', 'Kasir']) && (
                  <NavLink to="/bengkel/board" title="Status Board SPK" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Clock size={20} className="shrink-0" />
                    <span>Status Board SPK</span>
                  </NavLink>
                )}
                {checkAccess(['Admin', 'Kasir']) && (
                  <NavLink to="/bengkel/kendaraan" title="Riwayat Kendaraan" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Car size={20} className="shrink-0" />
                    <span>Riwayat Kendaraan</span>
                  </NavLink>
                )}
                {checkAccess(['Admin']) && (
                  <NavLink to="/bengkel/jasa" title="Katalog Jasa" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Wrench size={20} className="shrink-0" />
                    <span>Katalog Jasa</span>
                  </NavLink>
                )}
                {checkAccess(['Admin']) && (
                  <NavLink to="/produk" title="Sparepart & Stok" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Package size={20} className="shrink-0" />
                    <span>Sparepart & Stok</span>
                  </NavLink>
                )}
                {checkAccess(['Admin']) && (
                  <NavLink to="/bengkel/mekanik" title="Mekanik & Komisi" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Award size={20} className="shrink-0" />
                    <span>Mekanik & Komisi</span>
                  </NavLink>
                )}
                {checkAccess(['Admin', 'Kasir']) && (
                  <NavLink to="/bengkel/invoices" title="Invoice B2B (A4)" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                    <FileText size={20} className="shrink-0" />
                    <span>Invoice B2B (A4)</span>
                  </NavLink>
                )}
                {checkAccess(['Admin']) && (
                  <NavLink to="/bengkel/laporan" title="Laporan Bengkel" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                    <BarChart3 size={20} className="shrink-0" />
                    <span>Laporan Bengkel</span>
                  </NavLink>
                )}
                {checkAccess(['Admin', 'Kasir']) && (
                  <NavLink to="/kas" title="Arus Kas / Petty Cash" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Wallet size={20} className="shrink-0" />
                    <span>Arus Kas</span>
                  </NavLink>
                )}

                {/* Group Pembelian & Suku Cadang Bengkel */}
                {checkAccess(['Admin']) && (
                  <>
                    <div className="sidebar-section-title">
                      <span>Suku Cadang & Suplai</span>
                    </div>
                    <NavLink to="/bengkel/pengadaan" title="Rencana Belanja & Permintaan" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                      <ShoppingCart size={20} className="shrink-0" />
                      <span>Rencana Belanja (PO)</span>
                    </NavLink>
                    <NavLink to="/supplier" title="Supplier Suku Cadang" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                      <Truck size={20} className="shrink-0" />
                      <span>Supplier SC</span>
                    </NavLink>
                  </>
                )}
              </>
            ) : isRetail ? (
              <>
                {checkAccess(['Admin']) && (
                  <NavLink to="/dashboard" title="Dashboard" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                    <LayoutDashboard size={20} className="shrink-0" />
                    <span>Dashboard</span>
                  </NavLink>
                )}
                {checkAccess(['Admin', 'Kasir']) && (
                  <NavLink to="/pos" title="POS Kasir Grosir" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                    <ShoppingCart size={20} className="shrink-0 text-amber-500" />
                    <span className="font-bold">POS Kasir Grosir</span>
                  </NavLink>
                )}
                {checkAccess(['Admin', 'Kasir']) && (
                  <NavLink to="/retail/surat-jalan" title="Surat Jalan & Armada" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Truck size={20} className="shrink-0 text-amber-500" />
                    <span>Surat Jalan / Armada</span>
                  </NavLink>
                )}
                {checkAccess(['Admin']) && (
                  <NavLink to="/produk" title="Katalog & Multi-Satuan" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Package size={20} className="shrink-0" />
                    <span>Katalog & UOM</span>
                  </NavLink>
                )}
                {checkAccess(['Admin', 'Kasir']) && (
                  <NavLink to="/kas" title="Arus Kas / Petty Cash" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Wallet size={20} className="shrink-0" />
                    <span>Arus Kas</span>
                  </NavLink>
                )}

                {/* Suplai & Gudang Toko Grosir */}
                {checkAccess(['Admin']) && (
                  <>
                    <div className="sidebar-section-title">
                      <span>Suplai & Gudang</span>
                    </div>
                    <NavLink to="/supplier" title="Supplier & Distributor" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                      <Truck size={20} className="shrink-0" />
                      <span>Distributor / Suplai</span>
                    </NavLink>
                    <NavLink to="/gudang" title="Gudang & Rak Toko" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                      <Boxes size={20} className="shrink-0" />
                      <span>Gudang & Rak</span>
                      {renderPlanBadge('warehouse.management', 'BIZ')}
                    </NavLink>
                  </>
                )}
              </>
            ) : (
              <>
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
                    {renderPlanBadge('pos.kds', 'PRO')}
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
                {!isBengkel && !isRetail && !isLaundry && checkAccess(['Admin', 'Kasir']) && (
                  <NavLink to="/reservasi" title="Reservasi" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Calendar size={20} className="shrink-0" />
                    <span>Reservasi</span>
                    {renderPlanBadge('pos.reservations', 'PRO')}
                  </NavLink>
                )}
                {!isBengkel && !isRetail && !isLaundry && checkAccess(['Admin', 'Kasir', 'Dapur']) && (
                  <NavLink to="/meja" title="Nomor Meja" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Grid size={20} className="shrink-0" />
                    <span>Nomor Meja</span>
                    {renderPlanBadge('pos.tables', 'PRO')}
                  </NavLink>
                )}
                {isLaundry && checkAccess(['Admin', 'Kasir', 'Dapur']) && (
                  <>
                    <NavLink to="/laundry-kanban" title="Papan Status Cucian" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                      <Layers size={20} className="shrink-0" />
                      <span>Status Cucian</span>
                    </NavLink>
                    <NavLink to="/meja" title="Rak Simpan Cucian" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                      <Grid size={20} className="shrink-0" />
                      <span>Rak Simpan</span>
                    </NavLink>
                  </>
                )}
                {!isBengkel && !isRetail && !isLaundry && checkAccess(['Admin', 'Kasir']) && (
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
                        {renderPlanBadge('warehouse.management', 'BIZ')}
                      </NavLink>
                    )}
                    <NavLink to="/gudang" title="Gudang Pusat" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                      <Boxes size={20} className="shrink-0" />
                      <span>Gudang Pusat</span>
                      {renderPlanBadge('warehouse.management', 'BIZ')}
                    </NavLink>
                    {!isBengkel && !isRetail && (
                      <NavLink to="/bahan-baku" title="Bahan Baku" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                        <PackageSearch size={20} className="shrink-0" />
                        <span>Bahan Baku</span>
                        {renderPlanBadge('inventory.advanced', 'PRO')}
                      </NavLink>
                    )}
                  </>
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
              <NavLink 
                to="/crm" 
                title={isRetail ? "Buku Pelanggan & Bon Warung" : isBengkel ? "Data Pelanggan & Kendaraan" : "CRM & Member"} 
                className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Award size={20} className="shrink-0" />
                <span>{isRetail ? "Pelanggan & Bon" : isBengkel ? "Pelanggan & Unit" : "CRM & Member"}</span>
                {renderPlanBadge('crm.loyalty', 'PRO')}
              </NavLink>
            )}
            {checkAccess(['Admin']) && (
              <NavLink to="/absensi" title="Absensi Karyawan" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <Fingerprint size={20} className="shrink-0" />
                <span>Absensi Karyawan</span>
                {renderPlanBadge('hr.attendance', 'PRO')}
              </NavLink>
            )}
            {checkAccess(['Admin']) && (
              <NavLink to="/kasbon" title="Kasbon Karyawan" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <CreditCard size={20} className="shrink-0" />
                <span>Kasbon Karyawan</span>
                {renderPlanBadge('finance.loans', 'BIZ')}
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
            {checkAccess(['Admin']) && !isBengkel && (
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

                {/* SaaS Control Plane: EXCLUSIVELY FOR SUPERADMIN / PLATFORM OWNER */}
                {Boolean(
                  posContext?.user?.isPlatformAdmin === true || 
                  posContext?.user?.role === 'SUPERADMIN'
                ) && (
                  <>
                    <div className="sidebar-section-divider"></div>
                    <NavLink 
                      to="/platform-admin" 
                      title="SaaS Platform Admin" 
                      className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}
                      style={{
                        background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
                        border: '1px solid rgba(124, 58, 237, 0.35)',
                        color: '#c4b5fd'
                      }}
                    >
                      <Cpu size={20} className="shrink-0 text-violet-400" />
                      <span className="font-extrabold text-violet-200">SaaS Control Plane</span>
                    </NavLink>
                  </>
                )}
              </>
            )}

            {/* Tombol Logout Langsung di Sidebar Bawah */}
            <div className="sidebar-section-divider"></div>
            <button
              type="button"
              onClick={handleLogout}
              className="nav-item text-rose-400 hover:text-rose-200 hover:bg-rose-500/15 transition-all w-full text-left cursor-pointer border-none bg-transparent font-bold flex items-center gap-3 px-4 py-2.5 rounded-xl"
              title="Keluar / Log Out"
            >
              <LogOut size={20} className="shrink-0 text-rose-400" />
              <span>Keluar / Log Out</span>
            </button>
          </nav>
        </aside>
      )}

      {/* Main Content */}
      <main className="main-content">
        <header className="topbar flex items-center justify-between w-full h-14 sm:h-16 px-3 sm:px-6 bg-white border-b border-slate-200/80 shrink-0 gap-2 overflow-hidden">
          {/* SISI KIRI: Mobile Brand & Page Title ATAU Desktop Sidebar Toggle & Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
            {!isMobile && (
              <button 
                type="button"
                className="icon-btn hover:bg-slate-100 p-2 rounded-xl text-slate-600 hover:text-indigo-600 transition-colors shrink-0"
                onClick={toggleSidebar}
                title={isCollapsed ? "Perluas Sidebar" : "Kecilkan Sidebar (Minimize)"}
              >
                {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
              </button>
            )}

            {isMobile ? (
              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                <div className={`w-8 h-8 rounded-xl ${mobileIconBg} text-white flex items-center justify-center shrink-0 shadow-xs font-black`}>
                  <MobileHeaderIcon size={15} />
                </div>
                <div className="flex flex-col min-w-0 truncate">
                  <span className="font-black text-sm text-slate-900 tracking-tight leading-none truncate">
                    {mobilePageTitle}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 leading-none truncate mt-0.5">
                    {posContext?.settings?.storeName || (isBengkel ? 'Bengkel Motor/Mobil' : isRetail ? 'Toko Retail & Grosir' : 'Kafe & Resto')}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <h1 className="page-title truncate shrink-0" style={{ fontSize: '1.25rem', fontWeight: 800 }}>{pageTitle}</h1>
                <div className="shrink-0">
                  <TenantOutletSwitcher />
                </div>
              </>
            )}
          </div>
          
          {/* SISI KANAN: Aksi Terpadu Sejajar */}
          <div className="topbar-actions flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Mobile Tenant Switcher (Compact Trigger) */}
            {isMobile && (
              <TenantOutletSwitcher compact={true} />
            )}

            {/* Indikator Status Koneksi & Antrean Offline */}
            <NetworkStatusBanner compactOnly />
            
            <NotificationBell />
            
            {/* User Profile Trigger & Clickable Dropdown */}
            <div ref={profileDropdownRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsProfileOpen(prev => !prev)}
                className="user-profile flex items-center gap-2 cursor-pointer hover:bg-gray-100/80 active:bg-gray-200/70 rounded-xl p-1 sm:p-1.5 transition-all shrink-0 border border-transparent hover:border-gray-200"
                aria-expanded={isProfileOpen}
                aria-haspopup="true"
                title="Menu Profil & Akun"
              >
                <div className="avatar bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-sm w-7 h-7 sm:w-8 sm:h-8 text-xs font-black flex items-center justify-center rounded-full shrink-0">
                  {posContext?.user?.username?.substring(0, 2).toUpperCase() || 'U'}
                </div>
                {!isMobile && (
                  <>
                    <div className="user-info text-left">
                      <span className="user-name block font-bold text-xs text-slate-800 leading-tight">
                        {posContext?.user?.username || 'User'}
                      </span>
                      <span className="user-role block text-[10px] text-slate-500 font-medium capitalize">
                        {posContext?.user?.role || 'Staff'}
                      </span>
                    </div>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180 text-indigo-600' : ''}`} />
                  </>
                )}
              </button>
              
              {/* Dropdown Menu (Controlled via State + Touch/Click Responsive) */}
              {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* User Summary Header */}
                  <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2.5">
                    <div className="avatar bg-indigo-600 text-white w-7 h-7 text-xs font-black flex items-center justify-center rounded-full shrink-0">
                      {posContext?.user?.username?.substring(0, 2).toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black text-slate-800 truncate">{posContext?.user?.username || 'User'}</div>
                      <div className="text-[10px] font-semibold text-slate-500 capitalize truncate">
                        {posContext?.user?.role || 'Staff'} • {posContext?.user?.businessType || 'Multi-Business'}
                      </div>
                    </div>
                  </div>

                  {Boolean(
                    posContext?.user?.isPlatformAdmin === true || 
                    posContext?.user?.role === 'SUPERADMIN'
                  ) && (
                    <NavLink
                      to="/platform-admin"
                      onClick={() => setIsProfileOpen(false)}
                      className="w-full text-left px-4 py-2.5 text-xs text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 font-extrabold transition-colors border-b border-indigo-100 flex items-center gap-2"
                    >
                      <Sparkles size={15} className="text-amber-500" />
                      <span>SaaS Command Center</span>
                    </NavLink>
                  )}

                  <button 
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      setIsPinModalOpen(true);
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs text-indigo-600 hover:bg-indigo-50 font-bold transition-colors border-b border-slate-100 flex items-center gap-2 cursor-pointer"
                  >
                    <Fingerprint size={15} /> Ganti Kasir (PIN)
                  </button>

                  <button 
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-xs text-rose-600 hover:bg-rose-50 font-bold transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut size={15} /> Keluar / Log Out
                  </button>
                </div>
              )}
            </div>

            {/* Tombol Logout Langsung di Topbar (Desktop Only) */}
            <button
              type="button"
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 transition-all text-xs font-bold shrink-0 cursor-pointer shadow-xs active:scale-95 ml-0.5 sm:ml-1"
              title="Keluar / Log Out dari akun"
            >
              <LogOut size={15} />
              <span>Keluar</span>
            </button>
          </div>
        </header>
        
        {/* Offline Banner Alert */}
        <NetworkStatusBanner />
        
        {/* SaaS Subscription Dunning & Expiration Banner */}
        <SubscriptionBanner />
        
        {/* ─── LIVE SYSTEM BROADCAST BANNER (MAINTENANCE / EMERGENCY WARNING) ─── */}
        {activeBroadcasts.length > 0 && !isBroadcastDismissed(activeBroadcasts[0].id) && (
          <div className="px-4 sm:px-6 pt-3 pb-1">
            <div className={`p-3.5 sm:p-4 rounded-2xl border shadow-md flex items-start justify-between gap-3 text-xs transition-all ${
              activeBroadcasts[0].type === 'DANGER'
                ? 'bg-gradient-to-r from-rose-950/90 via-rose-900/80 to-rose-950/90 border-rose-700/50 text-rose-100 shadow-rose-950/30'
                : activeBroadcasts[0].type === 'WARNING'
                ? 'bg-gradient-to-r from-amber-950/90 via-amber-900/80 to-amber-950/90 border-amber-700/50 text-amber-100 shadow-amber-950/30'
                : 'bg-gradient-to-r from-indigo-950/90 via-indigo-900/80 to-indigo-950/90 border-indigo-700/50 text-indigo-100 shadow-indigo-950/30'
            }`}>
              <div className="flex items-start gap-3 min-w-0">
                <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                  activeBroadcasts[0].type === 'DANGER'
                    ? 'bg-rose-500/20 text-rose-300'
                    : activeBroadcasts[0].type === 'WARNING'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-indigo-500/20 text-indigo-300'
                }`}>
                  <ShieldAlert size={18} className="animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/10 border border-white/20">
                      PENGUMUMAN PLATFORM
                    </span>
                    <span className="font-bold text-white text-xs sm:text-sm">
                      {activeBroadcasts[0].title}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs opacity-90 leading-relaxed">
                    {activeBroadcasts[0].message}
                  </p>
                </div>
              </div>

              <button
                onClick={() => dismissBroadcast(activeBroadcasts[0].id)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition-colors shrink-0 cursor-pointer"
                title="Tutup Pengumuman"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div 
          className={`page-content flex-1 min-h-0 w-full flex flex-col ${isPOSPage ? 'page-content-pos overflow-hidden' : 'overflow-y-auto overflow-x-hidden'} ${isMobile && !isPOSPage ? 'pb-24 sm:pb-0' : ''}`} 
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
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

      {/* Docked Native-style Bottom Navigation Bar for Mobile */}
      {isMobile && (
        <nav 
          aria-label="Navigasi Bawah Mobile"
          className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] z-40 pb-[env(safe-area-inset-bottom)]"
        >
          <div className="grid grid-cols-5 items-center justify-items-center h-full px-2 max-w-lg mx-auto">
            {/* 1. HOME / DASHBOARD */}
            <NavLink
              to="/dashboard"
              onClick={() => posContext?.triggerHaptic(15)}
              className={({ isActive }) => `
                flex flex-col items-center justify-center w-full py-1.5 px-1 rounded-2xl transition-all duration-150 active:scale-90
                ${isActive
                  ? isRetail
                    ? 'bg-purple-100/90 text-purple-800 border border-purple-200/80 font-bold shadow-xs'
                    : isBengkel
                    ? 'bg-amber-100/90 text-amber-900 border border-amber-200/80 font-bold shadow-xs'
                    : 'bg-emerald-100/90 text-emerald-900 border border-emerald-200/80 font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 font-medium'
                }
              `}
            >
              <LayoutDashboard size={20} className="transition-transform shrink-0" />
              <span className="text-[10px] tracking-tight leading-tight mt-0.5 truncate max-w-full">Home</span>
            </NavLink>

            {/* 2. VERTICAL SPECIFIC FEATURE (Kiri Dalam) */}
            {isRetail ? (
              <NavLink
                to="/retail/surat-jalan"
                onClick={() => posContext?.triggerHaptic(15)}
                className={({ isActive }) => `
                  flex flex-col items-center justify-center w-full py-1.5 px-1 rounded-2xl transition-all duration-150 active:scale-90
                  ${isActive
                    ? 'bg-purple-100/90 text-purple-800 border border-purple-200/80 font-bold shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 font-medium'
                  }
                `}
              >
                <Truck size={20} className="transition-transform shrink-0" />
                <span className="text-[10px] tracking-tight leading-tight mt-0.5 truncate max-w-full">Surat Jalan</span>
              </NavLink>
            ) : isBengkel ? (
              <NavLink
                to="/bengkel/board"
                onClick={() => posContext?.triggerHaptic(15)}
                className={({ isActive }) => `
                  flex flex-col items-center justify-center w-full py-1.5 px-1 rounded-2xl transition-all duration-150 active:scale-90
                  ${isActive
                    ? 'bg-amber-100/90 text-amber-900 border border-amber-200/80 font-bold shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 font-medium'
                  }
                `}
              >
                <Wrench size={20} className="transition-transform shrink-0" />
                <span className="text-[10px] tracking-tight leading-tight mt-0.5 truncate max-w-full">Antrean SPK</span>
              </NavLink>
            ) : isLaundry ? (
              <NavLink
                to="/laundry-kanban"
                onClick={() => posContext?.triggerHaptic(15)}
                className={({ isActive }) => `
                  flex flex-col items-center justify-center w-full py-1.5 px-1 rounded-2xl transition-all duration-150 active:scale-90
                  ${isActive
                    ? 'bg-cyan-100/90 text-cyan-900 border border-cyan-200/80 font-bold shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 font-medium'
                  }
                `}
              >
                <Layers size={20} className="transition-transform shrink-0" />
                <span className="text-[10px] tracking-tight leading-tight mt-0.5 truncate max-w-full">Cucian</span>
              </NavLink>
            ) : (
              <NavLink
                to="/meja"
                onClick={() => posContext?.triggerHaptic(15)}
                className={({ isActive }) => `
                  flex flex-col items-center justify-center w-full py-1.5 px-1 rounded-2xl transition-all duration-150 active:scale-90
                  ${isActive
                    ? 'bg-emerald-100/90 text-emerald-900 border border-emerald-200/80 font-bold shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 font-medium'
                  }
                `}
              >
                <Grid size={20} className="transition-transform shrink-0" />
                <span className="text-[10px] tracking-tight leading-tight mt-0.5 truncate max-w-full">Meja</span>
              </NavLink>
            )}

            {/* 3. HERO FLOATING POS BUTTON (TENGAH - Elevated App Action Button) */}
            <div className="flex flex-col items-center justify-center relative -translate-y-3.5">
              <NavLink
                to="/pos"
                onClick={() => posContext?.triggerHaptic(25)}
                className={({ isActive }) => `
                  relative flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all duration-200 active:scale-90 cursor-pointer
                  shadow-[0_8px_20px_rgba(0,0,0,0.18)] ring-4 ring-white
                  ${isRetail
                    ? 'bg-gradient-to-tr from-purple-700 via-indigo-600 to-purple-600 text-white shadow-purple-600/35'
                    : isBengkel
                    ? 'bg-gradient-to-tr from-amber-600 via-orange-600 to-amber-500 text-white shadow-amber-600/35'
                    : isLaundry
                    ? 'bg-gradient-to-tr from-cyan-600 via-sky-600 to-blue-500 text-white shadow-cyan-600/35'
                    : 'bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white shadow-emerald-600/35'
                  }
                  ${isActive
                    ? isRetail
                      ? 'ring-4 ring-offset-2 ring-offset-white ring-purple-500 scale-105'
                      : isBengkel
                      ? 'ring-4 ring-offset-2 ring-offset-white ring-amber-500 scale-105'
                      : isLaundry
                      ? 'ring-4 ring-offset-2 ring-offset-white ring-cyan-500 scale-105'
                      : 'ring-4 ring-offset-2 ring-offset-white ring-emerald-500 scale-105'
                    : 'hover:scale-105'
                  }
                `}
                title="Buka Layar Kasir POS"
              >
                <ShoppingCart size={21} className="shrink-0 stroke-[2.3]" />
                <span className="text-[8.5px] font-black uppercase tracking-wider leading-none mt-0.5">
                  {isBengkel ? 'SPK' : isLaundry ? 'NOTA' : 'KASIR'}
                </span>

                {/* Subtle active status pulse dot */}
                {location.pathname === '/pos' && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400 border-2 border-white"></span>
                  </span>
                )}
              </NavLink>
            </div>

            {/* 4. RIWAYAT TRANSAKSI (Kanan Dalam) */}
            <NavLink
              to="/riwayat"
              onClick={() => posContext?.triggerHaptic(15)}
              className={({ isActive }) => `
                flex flex-col items-center justify-center w-full py-1.5 px-1 rounded-2xl transition-all duration-150 active:scale-90
                ${isActive
                  ? isRetail
                    ? 'bg-purple-100/90 text-purple-800 border border-purple-200/80 font-bold shadow-xs'
                    : isBengkel
                    ? 'bg-amber-100/90 text-amber-900 border border-amber-200/80 font-bold shadow-xs'
                    : 'bg-emerald-100/90 text-emerald-900 border border-emerald-200/80 font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 font-medium'
                }
              `}
            >
              <History size={20} className="transition-transform shrink-0" />
              <span className="text-[10px] tracking-tight leading-tight mt-0.5 truncate max-w-full">Riwayat</span>
            </NavLink>

            {/* 5. MENU LAINNYA (Kanan Luar) */}
            <button 
              type="button" 
              onClick={() => {
                posContext?.triggerHaptic(15);
                setIsMoreMenuOpen(true);
              }}
              className={`
                flex flex-col items-center justify-center w-full py-1.5 px-1 rounded-2xl transition-all duration-150 active:scale-90 focus:outline-none cursor-pointer
                ${isMoreMenuOpen
                  ? isRetail
                    ? 'bg-purple-100/90 text-purple-800 border border-purple-200/80 font-bold shadow-xs'
                    : isBengkel
                    ? 'bg-amber-100/90 text-amber-900 border border-amber-200/80 font-bold shadow-xs'
                    : 'bg-emerald-100/90 text-emerald-900 border border-emerald-200/80 font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 font-medium'
                }
              `}
            >
              <Menu size={20} className="transition-transform shrink-0" />
              <span className="text-[10px] tracking-tight leading-tight mt-0.5 truncate max-w-full">Lainnya</span>
            </button>
          </div>
        </nav>
      )}

      {/* Slide up Drawer Menu for other features */}
      {isMobile && isMoreMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end justify-center animate-in fade-in duration-200" onClick={() => setIsMoreMenuOpen(false)}>
          <div 
            className="bg-white w-full rounded-t-3xl p-5 pb-8 shadow-2xl max-w-md border-t border-slate-100 flex flex-col gap-3.5 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Handle Bar */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 opacity-80" />

            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isRetail ? 'bg-purple-100 text-purple-700' : isBengkel ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  <Grid size={16} />
                </div>
                <span className="font-extrabold text-sm text-slate-800">Semua Fitur Aplikasi</span>
              </div>
              <button 
                type="button"
                className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                onClick={() => setIsMoreMenuOpen(false)}
              >
                Tutup
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {checkAccess(['Admin']) && (
                <NavLink 
                  to="/produk" 
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-indigo-50/20 hover:border-indigo-100 transition-colors gap-2 text-center"
                >
                  <Package size={18} className="text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-700">Produk</span>
                </NavLink>
              )}

              {!isBengkel && !isRetail && checkAccess(['Admin', 'Kasir']) && (
                <NavLink 
                  to="/reservasi" 
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-indigo-50/20 hover:border-indigo-100 transition-colors gap-2 text-center"
                >
                  <Calendar size={18} className="text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-700">Reservasi</span>
                </NavLink>
              )}

              {/* Bengkel Specific Drawer Links */}
              {isBengkel && checkAccess(['Admin', 'Kasir']) && (
                <>
                  <NavLink 
                    to="/bengkel/board" 
                    onClick={() => setIsMoreMenuOpen(false)}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl border border-amber-100 bg-amber-50/50 hover:bg-amber-100/50 transition-colors gap-2 text-center"
                  >
                    <Wrench size={18} className="text-amber-600" />
                    <span className="text-[10px] font-bold text-amber-900">Board SPK</span>
                  </NavLink>
                  <NavLink 
                    to="/bengkel/kendaraan" 
                    onClick={() => setIsMoreMenuOpen(false)}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl border border-amber-100 bg-amber-50/50 hover:bg-amber-100/50 transition-colors gap-2 text-center"
                  >
                    <Car size={18} className="text-amber-600" />
                    <span className="text-[10px] font-bold text-amber-900">Kendaraan</span>
                  </NavLink>
                  <NavLink 
                    to="/bengkel/jasa" 
                    onClick={() => setIsMoreMenuOpen(false)}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl border border-amber-100 bg-amber-50/50 hover:bg-amber-100/50 transition-colors gap-2 text-center"
                  >
                    <Settings size={18} className="text-amber-600" />
                    <span className="text-[10px] font-bold text-amber-900">Jasa Servis</span>
                  </NavLink>
                  <NavLink 
                    to="/bengkel/mekanik" 
                    onClick={() => setIsMoreMenuOpen(false)}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl border border-amber-100 bg-amber-50/50 hover:bg-amber-100/50 transition-colors gap-2 text-center"
                  >
                    <Award size={18} className="text-amber-600" />
                    <span className="text-[10px] font-bold text-amber-900">Mekanik</span>
                  </NavLink>
                  <NavLink 
                    to="/bengkel/invoices" 
                    onClick={() => setIsMoreMenuOpen(false)}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl border border-amber-100 bg-amber-50/50 hover:bg-amber-100/50 transition-colors gap-2 text-center"
                  >
                    <FileText size={18} className="text-amber-600" />
                    <span className="text-[10px] font-bold text-amber-900">Invoice B2B</span>
                  </NavLink>
                </>
              )}

              {isRetail && checkAccess(['Admin', 'Kasir']) && (
                <NavLink 
                  to="/retail/surat-jalan" 
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-purple-100 bg-purple-50/50 hover:bg-purple-100/50 transition-colors gap-2 text-center"
                >
                  <Truck size={18} className="text-purple-600" />
                  <span className="text-[10px] font-bold text-purple-900">Surat Jalan</span>
                </NavLink>
              )}

              {isKDSEnabled && checkAccess(['Admin', 'Kasir', 'Dapur']) && (
                <NavLink 
                  to="/kds" 
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-indigo-50/20 hover:border-indigo-100 transition-colors gap-2 text-center relative"
                >
                  <ChefHat size={18} className="text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-700">Dapur (KDS)</span>
                  {kdsCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
                      {kdsCount}
                    </span>
                  )}
                </NavLink>
              )}

              {/* Gudang Pusat / Gudang Spare Part */}
              {checkAccess(['Admin', 'Dapur']) && (
                <NavLink 
                  to="/gudang" 
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-indigo-50/20 hover:border-indigo-100 transition-colors gap-2 text-center"
                >
                  <Boxes size={18} className="text-indigo-600" />
                  <span className="text-[10px] font-bold text-slate-700">
                    {isBengkel ? 'Gudang SC' : isRetail ? 'Gudang & Rak' : 'Gudang Pusat'}
                  </span>
                </NavLink>
              )}

              {/* Bahan Baku / Inventory — Kafe only */}
              {!isBengkel && !isRetail && checkAccess(['Admin', 'Dapur']) && (
                <NavLink 
                  to="/bahan-baku" 
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-indigo-50/20 hover:border-indigo-100 transition-colors gap-2 text-center"
                >
                  <PackageSearch size={18} className="text-indigo-600" />
                  <span className="text-[10px] font-bold text-slate-700">Bahan Baku</span>
                </NavLink>
              )}

              {/* Purchase Order — Kafe only */}
              {!isBengkel && !isRetail && checkAccess(['Admin', 'Dapur']) && localStorage.getItem('feature_enable_po') === 'true' && (
                <NavLink 
                  to="/purchase-order" 
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-indigo-50/20 hover:border-indigo-100 transition-colors gap-2 text-center"
                >
                  <ClipboardList size={18} className="text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-700">PO / Belanja</span>
                </NavLink>
              )}

              {/* Supplier */}
              {checkAccess(['Admin', 'Dapur']) && (
                <NavLink 
                  to="/supplier" 
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-indigo-50/20 hover:border-indigo-100 transition-colors gap-2 text-center"
                >
                  <Truck size={18} className="text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-700">
                    {isBengkel ? 'Supplier SC' : isRetail ? 'Distributor' : 'Supplier'}
                  </span>
                </NavLink>
              )}

              {!isBengkel && !isRetail && checkAccess(['Admin', 'Kasir']) && (
                <NavLink 
                  to="/qrcode" 
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-indigo-50/20 hover:border-indigo-100 transition-colors gap-2 text-center"
                >
                  <QrCode size={18} className="text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-700">QR Code</span>
                </NavLink>
              )}

              {checkAccess(['Admin', 'Kasir']) && (
                <NavLink 
                  to="/kas" 
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-indigo-50/20 hover:border-indigo-100 transition-colors gap-2 text-center"
                >
                  <Wallet size={18} className="text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-700">Petty Cash</span>
                </NavLink>
              )}

              {checkAccess(['Admin']) && (
                <NavLink 
                  to="/karyawan" 
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-indigo-50/20 hover:border-indigo-100 transition-colors gap-2 text-center"
                >
                  <Users size={18} className="text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-700">Karyawan</span>
                </NavLink>
              )}

              {checkAccess(['Admin']) && (
                <NavLink 
                  to="/crm" 
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-indigo-50/20 hover:border-indigo-100 transition-colors gap-2 text-center"
                >
                  <Award size={18} className="text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-700">CRM Member</span>
                </NavLink>
              )}

              {checkAccess(['Admin']) && (
                <NavLink 
                  to="/absensi" 
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-indigo-50/20 hover:border-indigo-100 transition-colors gap-2 text-center"
                >
                  <Fingerprint size={18} className="text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-700">Absensi</span>
                </NavLink>
              )}

              {checkAccess(['Admin']) && (
                <NavLink 
                  to="/kasbon" 
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-indigo-50/20 hover:border-indigo-100 transition-colors gap-2 text-center"
                >
                  <CreditCard size={18} className="text-indigo-600" />
                  <span className="text-[10px] font-bold text-slate-700">Kasbon Staf</span>
                </NavLink>
              )}

              {checkAccess(['Admin', 'Kasir']) && (
                <NavLink 
                  to="/shift" 
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-indigo-50/20 hover:border-indigo-100 transition-colors gap-2 text-center"
                >
                  <Clock size={18} className="text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-700">Shift History</span>
                </NavLink>
              )}

              {checkAccess(['Admin']) && (
                <NavLink 
                  to="/laporan" 
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-indigo-50/20 hover:border-indigo-100 transition-colors gap-2 text-center"
                >
                  <FileText size={18} className="text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-700">Laporan</span>
                </NavLink>
              )}

              {checkAccess(['Admin']) && (
                <NavLink 
                  to="/pengaturan" 
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-indigo-50/20 hover:border-indigo-100 transition-colors gap-2 text-center"
                >
                  <Settings size={18} className="text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-700">Pengaturan</span>
                </NavLink>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 flex gap-2">
              <button 
                onClick={() => { setIsMoreMenuOpen(false); setIsPinModalOpen(true); }}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-indigo-600 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Fingerprint size={14} /> Ganti Kasir
              </button>
              <button 
                onClick={handleLogout}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
