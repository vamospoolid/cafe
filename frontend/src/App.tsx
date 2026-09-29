import React, { useContext, useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import POSView from './components/POSView';
import KDSView from './components/KDSView';
import TableView from './components/TableView';
import QRCodeView from './components/QRCodeView';
import ReservationView from './components/ReservationView';
import DashboardView from './components/DashboardView';
import LoginView from './components/LoginView';
import CustomerSupportWidget from './components/CustomerSupportWidget';
import DineInView from './components/DineInView';
import StaffPWAView from './components/StaffPWAView';
import DeviceActivationView from './components/DeviceActivationView';
import InAppUpdateBanner from './components/InAppUpdateBanner';
import { POSProvider, POSContext } from './context/POSContext';
import { seedLocalCatalogCache } from './utils/catalogCacheSeeder';
import FeatureGuard from './components/FeatureGuard';
import { VerticalProvider, useVertical } from './context/VerticalContext';
import VerticalGuard from './components/VerticalGuard';
import ChunkErrorBoundary from './components/ChunkErrorBoundary';
import { updatePwaManifestForRoute } from './utils/pwaManager';

// ─── Code Splitting & Dynamic Imports for Large Modules (Bundle Optimization) ─────
const BengkelRoutes = React.lazy(() => import('./verticals/bengkel/BengkelRoutes'));
const RetailRoutes = React.lazy(() => import('./verticals/retail/RetailRoutes'));
const POSBengkel = React.lazy(() => import('./verticals/bengkel/POSBengkel'));
const POSRetail = React.lazy(() => import('./verticals/retail/POSRetail'));
const POSLaundry = React.lazy(() => import('./verticals/laundry/POSLaundry'));
const LaundryKanbanView = React.lazy(() => import('./verticals/laundry/LaundryKanbanView'));
const ReportViewAdaptive = React.lazy(() => import('./components/ReportViewAdaptive'));
const ProductView = React.lazy(() => import('./components/ProductView'));
const TransactionHistoryView = React.lazy(() => import('./components/TransactionHistoryView'));
const ShiftHistoryView = React.lazy(() => import('./components/ShiftHistoryView'));
const CashFlowView = React.lazy(() => import('./components/CashFlowView'));
const UserView = React.lazy(() => import('./components/UserView'));
const AttendanceView = React.lazy(() => import('./components/AttendanceView'));
const SettingsView = React.lazy(() => import('./components/SettingsView'));
const CRMView = React.lazy(() => import('./components/CRMView'));
const IngredientView = React.lazy(() => import('./components/IngredientView'));
const SupplierView = React.lazy(() => import('./components/SupplierView'));
const PurchaseOrderView = React.lazy(() => import('./components/PurchaseOrderView'));
const WarehouseView = React.lazy(() => import('./components/WarehouseView'));
const EmployeeLoanView = React.lazy(() => import('./components/EmployeeLoanView'));
const AuditLogView = React.lazy(() => import('./components/AuditLogView'));
const LandingPageView = React.lazy(() => import('./components/LandingPageView'));
const PlatformAdminLayout = React.lazy(() => import('./components/PlatformAdminLayout'));
const SaaSPlatformAdminView = React.lazy(() => import('./components/SaaSPlatformAdminView'));
const TenantOutletHubView = React.lazy(() => import('./components/TenantOutletHubView'));

const RouteSuspenseFallback = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-12 min-h-[350px] text-center bg-slate-50 gap-2.5">
    <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    <span className="text-xs font-bold text-slate-500">Memuat Halaman...</span>
  </div>
);

const POSViewAdaptive = () => {
  const { isBengkel, isRetail, isLaundry } = useVertical();
  if (isBengkel) {
    return (
      <Suspense fallback={<div className="p-8 text-center text-purple-600 font-bold text-xs">Memuat POS Kasir Bengkel...</div>}>
        <POSBengkel />
      </Suspense>
    );
  }
  if (isRetail) {
    return (
      <Suspense fallback={<div className="p-8 text-center text-emerald-600 font-bold text-xs">Memuat POS Kasir Toko Grosir...</div>}>
        <POSRetail />
      </Suspense>
    );
  }
  if (isLaundry) {
    return (
      <Suspense fallback={<div className="p-8 text-center text-cyan-600 font-bold text-xs">Memuat POS Kasir Laundry...</div>}>
        <POSLaundry />
      </Suspense>
    );
  }
  return <POSView />;
};

const AppRoutes = () => {
  const context = useContext(POSContext);
  const navigate = useNavigate();
  const location = useLocation();

  // Sinkronisasi manifest PWA (Kasir vs Staf) & dynamic metadata toko
  useEffect(() => {
    updatePwaManifestForRoute(location.pathname, {
      storeName: context?.settings?.storeName,
      logoUrl: context?.settings?.logoUrl,
      themeColor: context?.settings?.primaryColor
    });
  }, [location.pathname, context?.settings]);

  // Seed IndexedDB catalog cache setiap kali token berubah (login/refresh)
  useEffect(() => {
    if (context?.token && navigator.onLine) {
      seedLocalCatalogCache(context.token).catch(console.warn);
    }
  }, [context?.token]);

  // Deteksi Domain:
  // Root domain codenusa.id & www.codenusa.id menampilkan Landing Page Marketing SaaS.
  // Subdomain tenant (misal: jakartamotor.codenusa.id, sabarjaya.codenusa.id) langsung menampilkan Login POS Kasir.
  const hostname = window.location.hostname.toLowerCase();
  const isTenantSubdomain = hostname.endsWith('.codenusa.id') && hostname !== 'codenusa.id' && hostname !== 'www.codenusa.id';
  const isPlatformLandingDomain = !isTenantSubdomain;

  // Rute publik landing page SaaS (bisa diakses langsung kapan saja via /landing atau /landing-page)
  const isLandingRoute = location.pathname === '/landing' || location.pathname === '/landing-page';
  if (isLandingRoute) {
    return (
      <Suspense fallback={<RouteSuspenseFallback />}>
        <LandingPageView onNavigateLogin={() => navigate('/login')} />
        <CustomerSupportWidget />
      </Suspense>
    );
  }
  // Jika ini rute staff PWA mandiri (bisa dibuka di HP staf/dapur), biarkan terbuka
  const isStaffRoute = location.pathname.startsWith('/staff') || location.pathname.startsWith('/dapur-app');
  if (isStaffRoute) {
    return (
      <Routes>
        <Route path="/staff" element={<StaffPWAView />} />
        <Route path="/dapur-app" element={<StaffPWAView />} />
        <Route path="*" element={<StaffPWAView />} />
      </Routes>
    );
  }

  // Jika ini rute dine-in pelanggan mandiri, biarkan terbuka tanpa login
  const isDineInRoute = location.pathname.startsWith('/dinein/table/') || location.pathname.startsWith('/order');
  if (isDineInRoute) {
    return (
      <Routes>
        <Route path="/dinein/table/:tableId" element={<DineInView />} />
        <Route path="/order" element={<DineInView />} />
      </Routes>
    );
  }

  // Jika belum login (tidak ada token), arahkan ke Landing Page (khusus codenusa.id) atau langsung ke LoginView (subdomain tenant)
  if (!context?.token) {
    return (
      <Suspense fallback={<RouteSuspenseFallback />}>
        <Routes>
          <Route path="/" element={isPlatformLandingDomain ? <LandingPageView onNavigateLogin={() => navigate('/login')} /> : <LoginView />} />
          <Route path="/login" element={<LoginView />} />
          <Route path="/landing" element={<LandingPageView onNavigateLogin={() => navigate('/login')} />} />
          <Route path="/landing-page" element={<LandingPageView onNavigateLogin={() => navigate('/login')} />} />
          <Route path="/register" element={<LandingPageView onNavigateLogin={() => navigate('/login')} />} />
          <Route path="/platform-admin" element={<PlatformAdminLayout><SaaSPlatformAdminView /></PlatformAdminLayout>} />
          <Route path="/activate-tablet" element={<DeviceActivationView onSuccess={(data) => { context?.login(data.device || { username: 'tablet', role: 'CASHIER' }, data.token); navigate('/pos'); }} onSwitchToManualLogin={() => navigate('/login')} />} />
          <Route path="/order" element={<DineInView />} />
          <Route path="/staff" element={<StaffPWAView />} />
          <Route path="*" element={<Navigate to={isPlatformLandingDomain ? "/" : "/login"} replace />} />
        </Routes>
        <CustomerSupportWidget />
        <InAppUpdateBanner />
      </Suspense>
    );
  }

  return (
    <ChunkErrorBoundary>
      <InAppUpdateBanner />
      <Routes>
        {/* ─── STANDALONE SAAS DEVELOPER MASTER CONSOLE ─────────────────── */}
        <Route
          path="/platform-admin/*"
          element={
            <PlatformAdminLayout>
              <Suspense fallback={<RouteSuspenseFallback />}>
                <SaaSPlatformAdminView />
              </Suspense>
            </PlatformAdminLayout>
          }
        />
        <Route
          path="/platform-admin"
          element={
            <PlatformAdminLayout>
              <Suspense fallback={<RouteSuspenseFallback />}>
                <SaaSPlatformAdminView />
              </Suspense>
            </PlatformAdminLayout>
          }
        />

        {/* ─── PUBLIC LANDING PAGE (DAPAT DIAKSES KAPAN SAJA) ───────────── */}
        <Route
          path="/landing"
          element={
            <Suspense fallback={<RouteSuspenseFallback />}>
              <LandingPageView onNavigateLogin={() => navigate('/login')} />
            </Suspense>
          }
        />

        {/* ─── REGULAR MERCHANT PORTAL & POS (WRAPPED IN LAYOUT) ─────────── */}
        <Route
          path="/*"
          element={
            <Layout>
              <Suspense fallback={<RouteSuspenseFallback />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/login" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardView />} />
            <Route path="/pos" element={<POSViewAdaptive />} />
                  <Route
                    path="/bengkel/*"
                    element={
                      <VerticalGuard allow="BENGKEL">
                        <Suspense fallback={<div className="p-8 text-center text-purple-600 font-bold text-xs">Memuat modul Bengkel...</div>}>
                          <BengkelRoutes />
                        </Suspense>
                      </VerticalGuard>
                    }
                  />
                  <Route
                    path="/retail/*"
                    element={
                      <VerticalGuard allow="RETAIL">
                        <Suspense fallback={<div className="p-8 text-center text-amber-600 font-bold text-xs">Memuat modul Toko Grosir...</div>}>
                          <RetailRoutes />
                        </Suspense>
                      </VerticalGuard>
                    }
                  />
                  <Route
                    path="/laundry-kanban"
                    element={
                      <VerticalGuard allow="LAUNDRY">
                        <Suspense fallback={<div className="p-8 text-center text-cyan-600 font-bold text-xs">Memuat Papan Status Cucian...</div>}>
                          <LaundryKanbanView />
                        </Suspense>
                      </VerticalGuard>
                    }
                  />
                  <Route path="/kds" element={<FeatureGuard featureKey="pos.kds"><KDSView /></FeatureGuard>} />
                  <Route path="/meja" element={<FeatureGuard featureKey="pos.tables"><TableView /></FeatureGuard>} />
                  <Route path="/qrcode" element={<QRCodeView />} />
                  <Route path="/reservasi" element={<FeatureGuard featureKey="pos.reservations"><ReservationView /></FeatureGuard>} />
                  <Route path="/produk" element={<ProductView />} />
                  <Route path="/kas" element={<CashFlowView />} />
                  <Route path="/karyawan" element={<UserView />} />
                  <Route path="/absensi" element={<FeatureGuard featureKey="hr.attendance"><AttendanceView /></FeatureGuard>} />
                  <Route path="/kasbon" element={<FeatureGuard featureKey="finance.loans"><EmployeeLoanView /></FeatureGuard>} />
                  <Route path="/riwayat" element={<TransactionHistoryView />} />
                  <Route path="/shift" element={<ShiftHistoryView />} />
                  <Route path="/laporan" element={<ReportViewAdaptive />} />
                  <Route path="/crm" element={<FeatureGuard featureKey="crm.loyalty"><CRMView /></FeatureGuard>} />
                  <Route path="/pengaturan" element={<SettingsView />} />
                  <Route path="/bahan-baku" element={<FeatureGuard featureKey="inventory.advanced"><IngredientView /></FeatureGuard>} />
                  <Route path="/supplier" element={<SupplierView />} />
                  <Route path="/purchase-order" element={<FeatureGuard featureKey="warehouse.management"><PurchaseOrderView /></FeatureGuard>} />
                  <Route path="/gudang" element={<FeatureGuard featureKey="warehouse.management"><WarehouseView /></FeatureGuard>} />
                  <Route path="/audit-log" element={<AuditLogView />} />
                  <Route path="/cabang" element={<TenantOutletHubView />} />
                  <Route path="/activate-tablet" element={<DeviceActivationView onSuccess={(data) => { context?.login(data.device || { username: 'tablet', role: 'CASHIER' }, data.token); navigate('/pos'); }} onSwitchToManualLogin={() => navigate('/dashboard')} />} />

                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Suspense>
            </Layout>
          }
        />
      </Routes>
    </ChunkErrorBoundary>
  );
};

function App() {
  return (
    <POSProvider>
      <VerticalProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </VerticalProvider>
    </POSProvider>
  );
}

export default App;
