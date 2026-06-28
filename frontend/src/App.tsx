import React, { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import POSView from './components/POSView';
import KDSView from './components/KDSView';
import TableView from './components/TableView';
import QRCodeView from './components/QRCodeView';
import ReservationView from './components/ReservationView';
import ProductView from './components/ProductView';
import TransactionHistoryView from './components/TransactionHistoryView';
import ShiftHistoryView from './components/ShiftHistoryView';
import DashboardView from './components/DashboardView';
import CashFlowView from './components/CashFlowView';
import UserView from './components/UserView';
import AttendanceView from './components/AttendanceView';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';
import ReportView from './components/ReportView';
import CRMView from './components/CRMView';
import DineInView from './components/DineInView';
import IngredientView from './components/IngredientView';
import SupplierView from './components/SupplierView';
import PurchaseOrderView from './components/PurchaseOrderView';
import { POSProvider, POSContext } from './context/POSContext';


const AppRoutes = () => {
  const context = useContext(POSContext);
  
  // Jika ini rute dine-in pelanggan mandiri, biarkan terbuka tanpa login
  const isDineInRoute = window.location.pathname.startsWith('/dinein/table/');
  
  if (isDineInRoute) {
    return (
      <Routes>
        <Route path="/dinein/table/:tableId" element={<DineInView />} />
      </Routes>
    );
  }

  // Jika belum login (tidak ada token), arahkan semua ke halaman Login
  if (!context?.token) {
    return (
      <Routes>
        <Route path="*" element={<LoginView />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardView />} />
        <Route path="/pos" element={<POSView />} />
        <Route path="/kds" element={<KDSView />} />
        <Route path="/meja" element={<TableView />} />
        <Route path="/qrcode" element={<QRCodeView />} />
        <Route path="/reservasi" element={<ReservationView />} />
        <Route path="/produk" element={<ProductView />} />
        <Route path="/kas" element={<CashFlowView />} />
        <Route path="/karyawan" element={<UserView />} />
        <Route path="/absensi" element={<AttendanceView />} />
        <Route path="/riwayat" element={<TransactionHistoryView />} />
        <Route path="/shift" element={<ShiftHistoryView />} />
        <Route path="/laporan" element={<ReportView />} />
        <Route path="/crm" element={<CRMView />} />
        <Route path="/pengaturan" element={<SettingsView />} />
        <Route path="/bahan-baku" element={<IngredientView />} />
        <Route path="/supplier" element={<SupplierView />} />
        <Route path="/purchase-order" element={<PurchaseOrderView />} />
        <Route path="*" element={<div className="p-8 text-center text-muted">Halaman tidak ditemukan...</div>} />
      </Routes>
    </Layout>
  );
};

function App() {
  return (
    <POSProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </POSProvider>
  );
}

export default App;
