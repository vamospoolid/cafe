import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

const DeliveryOrdersView = lazy(() => import('./DeliveryOrdersView'));
const POSRetail = lazy(() => import('./POSRetail'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center p-12 text-amber-600 font-medium">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mr-3"></div>
    Memuat modul Toko Grosir & Retail...
  </div>
);

export const RetailRoutes: React.FC = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="surat-jalan" replace />} />
        <Route path="surat-jalan" element={<DeliveryOrdersView />} />
        <Route path="pos" element={<POSRetail />} />
        <Route path="*" element={<Navigate to="surat-jalan" replace />} />
      </Routes>
    </Suspense>
  );
};

export default RetailRoutes;
