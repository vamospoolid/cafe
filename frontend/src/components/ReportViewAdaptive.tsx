import React, { Suspense, useState, useContext } from 'react';
import { useVertical } from '../context/VerticalContext';
import { POSContext } from '../context/POSContext';
import { BarChart3, Building2, Layers } from 'lucide-react';

const ReportViewCafe = React.lazy(() => import('./ReportView').then(m => ({ default: m.ReportView })));
const BengkelReports = React.lazy(() => import('../verticals/bengkel/BengkelReports').then(m => ({ default: m.BengkelReports })));
const RetailReports = React.lazy(() => import('../verticals/retail/RetailReports').then(m => ({ default: m.RetailReports })));
const LaundryReports = React.lazy(() => import('../verticals/laundry/LaundryReports').then(m => ({ default: m.LaundryReports })));
const RentalReports = React.lazy(() => import('../verticals/rental/RentalReports').then(m => ({ default: m.RentalReports })));
const ConsolidatedOutletDashboard = React.lazy(() => import('./ConsolidatedOutletDashboard').then(m => ({ default: m.ConsolidatedOutletDashboard })));

const FallbackLoader = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-12 min-h-[400px] text-center bg-slate-50 gap-3">
    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 animate-pulse">
      <BarChart3 size={20} />
    </div>
    <span className="text-xs font-semibold text-slate-500">Menyiapkan Laporan...</span>
  </div>
);

export const ReportViewAdaptive: React.FC = () => {
  const { isBengkel, isRetail, isLaundry, isRental } = useVertical();
  const posContext = useContext(POSContext);
  const [activeTab, setActiveTab] = useState<'vertical' | 'consolidated'>('vertical');

  const verticalLabel = isBengkel 
    ? 'Laporan Bengkel' 
    : isRetail 
    ? 'Laporan Retail' 
    : isLaundry 
    ? 'Laporan Laundry' 
    : isRental
    ? 'Laporan Rental'
    : 'Laporan Kafe';

  const isOwnerOrAdmin = ['OWNER', 'ADMIN'].includes(String(posContext?.user?.role).toUpperCase()) || (posContext?.user as any)?.isPlatformAdmin;

  return (
    <div className="p-3 sm:p-6 pb-28 sm:pb-16 w-full flex flex-col gap-3.5 sm:gap-5">
      {/* TOP TAB CONTROLLER: LAPORAN VERTIKAL VS KONSOLIDASI CABANG */}
      {isOwnerOrAdmin && (
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/90 w-fit shrink-0 shadow-2xs self-start">
          <button
            onClick={() => setActiveTab('vertical')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'vertical'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers size={14} />
            <span>{verticalLabel}</span>
          </button>
          <button
            onClick={() => setActiveTab('consolidated')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'consolidated'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 size={14} />
            <span>Konsolidasi Cabang</span>
          </button>
        </div>
      )}

      {/* CONTENT AREA */}
      <Suspense fallback={<FallbackLoader />}>
        {activeTab === 'consolidated' ? (
          <ConsolidatedOutletDashboard />
        ) : isBengkel ? (
          <BengkelReports />
        ) : isRetail ? (
          <RetailReports />
        ) : isLaundry ? (
          <LaundryReports />
        ) : isRental ? (
          <RentalReports />
        ) : (
          <ReportViewCafe />
        )}
      </Suspense>
    </div>
  );
};

export default ReportViewAdaptive;

