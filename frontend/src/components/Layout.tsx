import React, { useState, useContext } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { POSContext } from '../context/POSContext';
import NotificationBell from './NotificationBell';
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
  ChefHat,
  Menu,
  Fingerprint,
  Settings,
  Award,
  ClipboardList,
  PackageSearch,
  Delete
} from 'lucide-react';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const posContext = useContext(POSContext);
  const titleMap: Record<string, string> = {
    '/pos': 'POS - Point of Sale',
    '/kds': 'Dapur (KDS)',
    '/crm': 'CRM & Loyalitas Pelanggan',
  };
  const pageTitle = titleMap[location.pathname] || 'Dashboard';

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

  const userRole = posContext?.user?.role || 'Admin';
  const checkAccess = (allowedRoles: string[]) => {
    return allowedRoles.includes(userRole) || userRole === 'Admin';
  };

  return (
    <div className={`app-container ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-logo" style={{ overflow: 'hidden', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {posContext?.settings?.logoUrl ? (
              <img src={posContext.settings.logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <ShoppingCart size={32} />
            )}
          </div>
          <div className="brand-text">
            <div className="brand-title">{posContext?.settings?.storeName || 'SOL Cafe'}</div>
            <div className="brand-subtitle">Point of Sale System v1.0.0</div>
          </div>
        </div>
        
        <nav className="nav-menu">
          {checkAccess(['Admin']) && (
            <NavLink to="/dashboard" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </NavLink>
          )}
          {checkAccess(['Admin', 'Kasir']) && (
            <NavLink to="/pos" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <ShoppingCart size={20} />
              <span>POS / Penjualan</span>
            </NavLink>
          )}
          {checkAccess(['Admin', 'Kasir', 'Dapur']) && (
            <NavLink to="/kds" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <ChefHat size={20} />
              <span>Dapur (KDS)</span>
            </NavLink>
          )}
          {checkAccess(['Admin']) && (
            <NavLink to="/produk" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <Package size={20} />
              <span>Produk</span>
            </NavLink>
          )}
          {checkAccess(['Admin', 'Kasir']) && (
            <NavLink to="/reservasi" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <Calendar size={20} />
              <span>Reservasi</span>
            </NavLink>
          )}
          {checkAccess(['Admin', 'Kasir', 'Dapur']) && (
            <NavLink to="/meja" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <Grid size={20} />
              <span>Nomor Meja</span>
            </NavLink>
          )}
          {checkAccess(['Admin', 'Kasir']) && (
            <NavLink to="/qrcode" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <QrCode size={20} />
              <span>Generate QR Code</span>
            </NavLink>
          )}
          {checkAccess(['Admin', 'Kasir']) && (
            <NavLink to="/kas" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <Wallet size={20} />
              <span>Arus Kas / Petty Cash</span>
            </NavLink>
          )}

          {/* Group Pembelian */}
          {checkAccess(['Admin', 'Dapur']) && (
            <>
              <div style={{ padding: '0.5rem 1rem 0.25rem', fontSize: '.65rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '.08em', textTransform: 'uppercase' }}>Pembelian</div>
              <NavLink to="/supplier" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <Truck size={20} />
                <span>Supplier</span>
              </NavLink>
              <NavLink to="/purchase-order" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <ClipboardList size={20} />
                <span>Purchase Order</span>
              </NavLink>
              {posContext?.settings && (posContext.settings as any).ingredientTrackingEnabled && (
                <NavLink to="/bahan-baku" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                  <PackageSearch size={20} />
                  <span>Bahan Baku</span>
                </NavLink>
              )}
            </>
          )}
          <div style={{ padding: '0.25rem 1rem 0', fontSize: '.65rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '.08em', textTransform: 'uppercase' }}>SDM</div>

          {checkAccess(['Admin']) && (
            <NavLink to="/karyawan" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users size={20} />
              <span>Pengguna & Karyawan</span>
            </NavLink>
          )}
          {checkAccess(['Admin']) && (
            <NavLink to="/crm" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <Award size={20} />
              <span>CRM & Member</span>
            </NavLink>
          )}
          {checkAccess(['Admin', 'Kasir', 'Dapur', 'Waiter']) && (
            <NavLink to="/absensi" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <Fingerprint size={20} />
              <span>Absensi Karyawan</span>
            </NavLink>
          )}
          {checkAccess(['Admin', 'Kasir']) && (
            <NavLink to="/riwayat" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <History size={20} />
              <span>Riwayat Transaksi</span>
            </NavLink>
          )}
          {checkAccess(['Admin', 'Kasir']) && (
            <NavLink to="/shift" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <Clock size={20} />
              <span>History Shift</span>
            </NavLink>
          )}
          {checkAccess(['Admin']) && (
            <NavLink to="/laporan" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <FileText size={20} />
              <span>Laporan</span>
            </NavLink>
          )}
          
          {checkAccess(['Admin']) && (
            <>
              <div className="border-t border-gray-200 my-2 mx-4"></div>
              <NavLink to="/pengaturan" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <Settings size={20} />
                <span>Pengaturan Sistem</span>
              </NavLink>
            </>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="topbar">
          <div className="flex items-center gap-4">
            <button className="icon-btn hover:bg-gray-100 p-2 rounded-md" onClick={() => setIsCollapsed(!isCollapsed)}>
              <Menu size={20} />
            </button>
            <h1 className="page-title">{pageTitle}</h1>
          </div>
          
          <div className="topbar-actions">
            <NotificationBell />
            
            <div className="user-profile relative group cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors">
              <div className="avatar bg-indigo-100 text-indigo-700">{posContext?.user?.username?.substring(0, 2).toUpperCase() || 'U'}</div>
              <div className="user-info">
                <span className="user-name">{posContext?.user?.username || 'User'}</span>
                <span className="user-role capitalize">{posContext?.user?.role || 'Staff'}</span>
              </div>
              <ChevronDown size={16} className="text-muted" />
              
              {/* Dropdown Menu (Hover) */}
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
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
        
        <div className="page-content">
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
    </div>
  );
};

export default Layout;
