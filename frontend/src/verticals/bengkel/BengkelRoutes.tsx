import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

const StatusBoard = lazy(() => import('./StatusBoard'));
const WorkOrderForm = lazy(() => import('./WorkOrderForm'));
const VehicleHistory = lazy(() => import('./VehicleHistory'));
const ServiceTypeManager = lazy(() => import('./ServiceTypeManager'));
const MechanicList = lazy(() => import('./MechanicList'));
const InvoiceManager = lazy(() => import('./InvoiceManager'));
const POSBengkel = lazy(() => import('./POSBengkel'));
const BengkelReports = lazy(() => import('./BengkelReports'));
const BengkelProcurementView = lazy(() => import('./BengkelProcurementView'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center p-12 text-purple-600 font-medium">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mr-3"></div>
    Memuat modul Bengkel...
  </div>
);

export const BengkelRoutes: React.FC = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="board" replace />} />
        <Route path="board" element={<StatusBoard />} />
        <Route path="spk/new" element={<WorkOrderForm />} />
        <Route path="spk/:id" element={<WorkOrderForm />} />
        <Route path="pos" element={<POSBengkel />} />
        <Route path="kendaraan" element={<VehicleHistory />} />
        <Route path="jasa" element={<ServiceTypeManager />} />
        <Route path="mekanik" element={<MechanicList />} />
        <Route path="invoices" element={<InvoiceManager />} />
        <Route path="laporan" element={<BengkelReports />} />
        <Route path="pengadaan" element={<BengkelProcurementView />} />
        <Route path="*" element={<Navigate to="board" replace />} />
      </Routes>
    </Suspense>
  );
};

export default BengkelRoutes;
