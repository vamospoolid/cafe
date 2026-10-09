import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, Car, Bike, Calendar, Wrench, Package, Phone, User, Clock, 
  ArrowLeft, ChevronRight, Gauge, Plus, ShieldCheck, Sparkles, FileText,
  X, Star, Droplets, AlertTriangle, AlertCircle, MessageCircle, ExternalLink
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import { OilReminderModal } from './OilReminderModal';

export const VehicleHistory: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, settings } = usePOS();

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [search, setSearch] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'MOTOR' | 'MOBIL' | 'LOYAL' | 'OIL_DUE'>(() => {
    const qTab = searchParams.get('tab');
    return qTab === 'OIL_DUE' ? 'OIL_DUE' : 'ALL';
  });
  const [selectedPlate, setSelectedPlate] = useState<string | null>(() => {
    return searchParams.get('plate') || null;
  });
  const [historyData, setHistoryData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Oil Reminder State (2 Bulan vs 3 Bulan)
  const [oilInterval, setOilInterval] = useState<2 | 3>(2);
  const [isOilModalOpen, setIsOilModalOpen] = useState<boolean>(false);
  const [selectedOilModalVehicle, setSelectedOilModalVehicle] = useState<any | null>(null);

  // Load all vehicles
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`/api/bengkel/vehicles?search=${encodeURIComponent(search)}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setVehicles(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, search]);

  // Load history when vehicle selected
  useEffect(() => {
    if (!selectedPlate || !token) return;
    setLoadingHistory(true);
    fetch(`/api/bengkel/vehicles/history/${encodeURIComponent(selectedPlate)}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setHistoryData(data))
      .catch(console.error)
      .finally(() => setLoadingHistory(false));
  }, [selectedPlate, token]);

  // Derived metrics for selected vehicle
  const historyList = historyData?.history || [];
  const totalSpending = historyList.reduce((acc: number, wo: any) => acc + (wo.totalAmount || 0), 0);
  const latestKm = historyList[0]?.currentKm || historyData?.vehicle?.currentKm || historyData?.vehicle?.odometer || null;
  const isSelectedMotor = historyData?.vehicle?.vehicleType?.toUpperCase() === 'MOTOR';

  // Category counts and filtering
  const motorCount = vehicles.filter(v => (v.vehicleType || 'MOTOR').toUpperCase() === 'MOTOR').length;
  const mobilCount = vehicles.filter(v => (v.vehicleType || '').toUpperCase() === 'MOBIL').length;
  const loyalCount = vehicles.filter(v => (v._count?.workOrders || 0) >= 3).length;
  const oilDueCount = vehicles.filter(v => {
    if (!v.oilReminder) return false;
    return oilInterval === 2
      ? (v.oilReminder.isDue2Months || v.oilReminder.isDueSoon2Months)
      : (v.oilReminder.isDue3Months || v.oilReminder.isDueSoon3Months);
  }).length;

  const filteredVehicles = vehicles.filter(v => {
    const isMotor = (v.vehicleType || 'MOTOR').toUpperCase() === 'MOTOR';
    const serviceCount = v._count?.workOrders || 0;
    if (activeTab === 'MOTOR') return isMotor;
    if (activeTab === 'MOBIL') return !isMotor;
    if (activeTab === 'LOYAL') return serviceCount >= 3;
    if (activeTab === 'OIL_DUE') {
      if (!v.oilReminder) return false;
      return oilInterval === 2
        ? (v.oilReminder.isDue2Months || v.oilReminder.isDueSoon2Months)
        : (v.oilReminder.isDue3Months || v.oilReminder.isDueSoon3Months);
    }
    return true;
  });

  return (
    <div className="p-3 sm:p-6 pb-32 sm:pb-8 bg-slate-50 min-h-screen">
      {/* PAGE HEADER */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wider">
            Rekam Medis Otomotif
          </span>
          <span className="text-[11px] font-semibold text-slate-400">
            {vehicles.length} Kendaraan Terdata
          </span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Buku Riwayat Servis</span>
              <span className="text-xs sm:text-sm font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200 hidden sm:inline-block">
                Vehicle Passport
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Lacak rekam medis berkala per plat nomor, riwayat penggantian sparepart, dan interval kilometer.
            </p>
          </div>
          <button
            onClick={() => navigate('/bengkel/spk/new')}
            className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-purple-700/25 transition active:scale-95 cursor-pointer"
          >
            <Plus size={15} />
            <span>Buat SPK Baru</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTAINER: 2-COLUMN ON DESKTOP, DRILL-DOWN ON MOBILE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: VEHICLE LIST (Hidden on mobile if a vehicle is selected) */}
        <div className={`bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[calc(100vh-170px)] sm:h-[calc(100vh-200px)] ${
          selectedPlate ? 'hidden lg:flex' : 'flex'
        }`}>
          {/* Search Box */}
          <div className="relative mb-2.5">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari plat, pemilik, atau tipe..."
              className="w-full pl-9 pr-8 py-2.5 bg-slate-50/80 border border-slate-200 focus:border-purple-500 focus:bg-white focus:ring-4 focus:ring-purple-500/10 rounded-xl text-xs font-semibold outline-none transition-all placeholder:text-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Quick Segment Filter Pills */}
          <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'ALL', label: 'Semua', count: vehicles.length, icon: null },
              { id: 'OIL_DUE', label: 'Ganti Oli', count: oilDueCount, icon: Droplets, isWarning: true },
              { id: 'MOTOR', label: 'Motor', count: motorCount, icon: Bike },
              { id: 'MOBIL', label: 'Mobil', count: mobilCount, icon: Car },
              { id: 'LOYAL', label: 'Loyal (≥3x)', count: loyalCount, icon: Star },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isOilTab = tab.id === 'OIL_DUE';
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? isOilTab
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-purple-700 text-white shadow-xs'
                      : isOilTab && tab.count > 0
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                  }`}
                >
                  {Icon && <Icon size={12} className={isActive ? 'text-white' : isOilTab ? 'text-rose-600' : 'text-slate-500'} />}
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive 
                      ? 'bg-white/20 text-white font-black' 
                      : isOilTab && tab.count > 0
                      ? 'bg-rose-200 text-rose-800 font-black'
                      : 'bg-slate-200/80 text-slate-600 font-semibold'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Oil Interval Switcher */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1.5 mb-2.5 text-[11px]">
            <span className="text-slate-500 font-semibold flex items-center gap-1">
              <Droplets size={12} className="text-purple-600" />
              <span>Siklus Oli:</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOilInterval(2)}
                className={`px-2 py-0.5 rounded-lg font-bold text-[10px] transition cursor-pointer ${
                  oilInterval === 2 
                    ? 'bg-purple-700 text-white shadow-2xs' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                2 Bulan (Motor)
              </button>
              <button
                type="button"
                onClick={() => setOilInterval(3)}
                className={`px-2 py-0.5 rounded-lg font-bold text-[10px] transition cursor-pointer ${
                  oilInterval === 3 
                    ? 'bg-purple-700 text-white shadow-2xs' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                3 Bulan (Mobil)
              </button>
            </div>
          </div>

          {/* List of Vehicles */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 divide-y-0">
            {loading ? (
              <div className="text-center py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                <span className="text-xs font-medium">Memuat data kendaraan...</span>
              </div>
            ) : filteredVehicles.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400 font-medium">
                {search ? 'Tidak ada kendaraan yang cocok dengan pencarian.' : 'Belum ada kendaraan dalam kategori ini.'}
              </div>
            ) : (
              filteredVehicles.map(v => {
                const isSelected = selectedPlate === v.plateNumber;
                const isMotor = (v.vehicleType || 'MOTOR').toUpperCase() === 'MOTOR';
                const serviceCount = v._count?.workOrders || 0;
                const vehicleModelDisplay = v.brand || v.model
                  ? `${v.brand || ''} ${v.model || ''}`.trim()
                  : isMotor
                  ? 'Sepeda Motor (Model belum tercatat)'
                  : 'Mobil (Model belum tercatat)';

                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedPlate(v.plateNumber)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group ${
                      isSelected
                        ? 'bg-purple-50/80 border-purple-400 ring-2 ring-purple-400/30 shadow-md'
                        : 'bg-white border-slate-200/90 hover:border-purple-300 hover:bg-slate-50/70 shadow-2xs hover:shadow-sm'
                    }`}
                  >
                    {/* Top Row: Authentic Plate Badge + Type & Visits */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      {/* Authentic Modern Automotive Plate Badge */}
                      <div className="bg-white text-slate-900 font-mono font-black text-xs sm:text-sm px-2.5 py-1 rounded-lg border border-slate-300 shadow-2xs tracking-widest inline-flex items-center gap-1.5 shrink-0 group-hover:border-purple-500 transition-colors select-all">
                        <span className="text-[9px] font-black px-1 py-0.5 rounded bg-slate-900 text-white tracking-normal leading-none">
                          RI
                        </span>
                        <span>{v.plateNumber}</span>
                      </div>

                      {/* Vehicle Type & Total Visits Chip */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                          isMotor 
                            ? 'bg-amber-50 text-amber-800 border-amber-200/80' 
                            : 'bg-blue-50 text-blue-700 border-blue-200/80'
                        }`}>
                          {isMotor ? <Bike size={11} className="shrink-0 text-amber-600" /> : <Car size={11} className="shrink-0 text-blue-600" />}
                          <span>{isMotor ? 'Motor' : 'Mobil'}</span>
                        </span>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border inline-flex items-center gap-1 ${
                          serviceCount >= 5 
                            ? 'bg-purple-50 text-purple-900 border-purple-200' 
                            : serviceCount > 0 
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80' 
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          <Wrench size={10} />
                          <span>{serviceCount}x</span>
                        </span>
                      </div>
                    </div>

                    {/* Middle: Brand & Model */}
                    <div className="mb-1.5">
                      <div className="font-black text-slate-900 text-xs sm:text-sm tracking-tight truncate flex items-center gap-1.5">
                        {v.brand || v.model ? (
                          <span>{vehicleModelDisplay}</span>
                        ) : (
                          <span className="text-slate-400 font-semibold italic text-xs">
                            {vehicleModelDisplay}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Oil Reminder Badge & Quick WA Action */}
                    {(() => {
                      const rem = v.oilReminder;
                      if (!rem || rem.daysSinceLastService === null) return null;
                      const isOverdue = oilInterval === 2 ? rem.isDue2Months : rem.isDue3Months;
                      const isDueSoon = oilInterval === 2 ? rem.isDueSoon2Months : rem.isDueSoon3Months;

                      if (!isOverdue && !isDueSoon) return null;

                      return (
                        <div className={`mb-2 px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-between gap-1.5 transition-all ${
                          isOverdue
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-amber-50 text-amber-900 border border-amber-200'
                        }`}>
                          <div className="flex items-center gap-1.5 truncate">
                            <Droplets size={12} className={isOverdue ? 'text-rose-600 shrink-0' : 'text-amber-600 shrink-0'} />
                            <span className="truncate">
                              {isOverdue ? 'Waktunya Ganti Oli!' : 'Segera Ganti Oli'}
                            </span>
                            <span className="text-[10px] font-normal opacity-75 shrink-0">
                              ({rem.daysSinceLastService} hr lalu)
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOilModalVehicle(v);
                              setIsOilModalOpen(true);
                            }}
                            className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-[10px] flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs"
                            title="Kirim pengingat WhatsApp ke pelanggan"
                          >
                            <MessageCircle size={10} />
                            <span>Ingatkan</span>
                          </button>
                        </div>
                      );
                    })()}

                    {/* Bottom Row: Customer Name, Phone, and Direct Action Button */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs gap-2">
                      <div className="flex items-center gap-1.5 text-slate-600 font-medium truncate min-w-0">
                        <User size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate font-semibold text-slate-800">
                          {v.customer?.name || 'Walk-In Customer'}
                        </span>
                        {v.customer?.phone && (
                          <span className="text-[10px] text-slate-400 truncate hidden sm:inline">
                            • {v.customer.phone}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/bengkel/spk/new?plate=${encodeURIComponent(v.plateNumber)}`);
                          }}
                          title="Buat SPK Baru untuk kendaraan ini"
                          className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 active:scale-95 text-purple-700 font-black text-[10px] border border-purple-200 flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                        >
                          <Plus size={11} />
                          <span>+ SPK</span>
                        </button>
                        <ChevronRight size={15} className={`shrink-0 transition-transform ${isSelected ? 'text-purple-600 translate-x-0.5' : 'text-slate-300 group-hover:text-purple-400'}`} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: SERVICING PASSPORT & TIMELINE (Shown on mobile when vehicle is selected) */}
        <div className={`lg:col-span-2 space-y-4 sm:space-y-6 ${
          !selectedPlate ? 'hidden lg:block' : 'block'
        }`}>
          {/* MOBILE BACK BUTTON (Visible only on mobile screen when vehicle selected) */}
          <div className="lg:hidden flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setSelectedPlate(null)}
              className="flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition active:scale-95 cursor-pointer"
            >
              <ArrowLeft size={14} /> ← Daftar Kendaraan
            </button>
            <span className="text-[11px] font-mono font-black bg-purple-100 text-purple-900 px-2.5 py-0.5 rounded-lg border border-purple-300">
              {selectedPlate}
            </span>
          </div>

          {!selectedPlate ? (
            /* EMPTY DESKTOP PLACEHOLDER */
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 flex flex-col items-center justify-center h-[calc(100vh-200px)] shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 mb-4 border border-purple-100">
                <Car size={32} />
              </div>
              <h3 className="font-bold text-slate-800 text-base">Pilih Kendaraan</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Pilih plat nomor dari daftar di sebelah kiri untuk melihat rekam jejak digital, pergantian sparepart, dan interval kilometer.
              </p>
            </div>
          ) : loadingHistory ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400 flex flex-col items-center justify-center shadow-sm">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mb-3"></div>
              <span className="text-xs font-semibold">Membuka Paspor Rekam Medis...</span>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-5">
              
              {/* VEHICLE PASSPORT DIGITAL CARD - ROYAL PURPLE & INDIGO GRADIENT */}
              <div className="bg-gradient-to-br from-purple-700 via-purple-800 to-indigo-900 text-white rounded-2xl p-4 sm:p-6 shadow-lg border border-purple-500/30 relative overflow-hidden">
                {/* Background Watermark Accent */}
                <div className="absolute -right-8 -bottom-8 opacity-15 text-white pointer-events-none">
                  {isSelectedMotor ? <Bike size={180} /> : <Car size={180} />}
                </div>

                <div className="relative z-10">
                  {/* Top Badge Strip */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck size={15} className="text-amber-300" />
                      <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-purple-200">
                        PASPOR KENDARAAN TERVERIFIKASI
                      </span>
                    </div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-lg bg-white/20 text-white border border-white/30 backdrop-blur-sm">
                      {historyData?.vehicle?.vehicleType}
                    </span>
                  </div>

                  {/* License Plate Display (Modern Indonesian White Plate with Black Lettering) */}
                  <div className="my-2">
                    <div className="inline-flex items-center gap-2.5 bg-white text-slate-950 border-2 border-slate-900 px-4 py-1.5 rounded-xl shadow-md">
                      <div className="w-2 h-2 rounded-full bg-slate-200 border border-slate-500"></div>
                      <span className="text-2xl sm:text-3xl font-black font-mono tracking-widest text-slate-950">
                        {historyData?.vehicle?.plateNumber}
                      </span>
                      <div className="w-2 h-2 rounded-full bg-slate-200 border border-slate-500"></div>
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold text-white mt-2 uppercase tracking-wide">
                      {historyData?.vehicle?.brand || ''} {historyData?.vehicle?.model || ''} {historyData?.vehicle?.year ? `(${historyData?.vehicle?.year})` : ''}
                    </h3>
                  </div>

                  {/* Customer Info & Action Buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 mt-3 border-t border-white/20">
                    <div className="flex items-center gap-2.5 text-xs text-white bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/15">
                      <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white font-bold shrink-0">
                        <User size={13} />
                      </div>
                      <div>
                        <div className="text-[10px] text-purple-200">Pemilik Kendaraan</div>
                        <div className="font-bold text-white">{historyData?.vehicle?.customer?.name || 'Walk-In Customer'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {historyData?.vehicle?.customer?.phone && (
                        <a
                          href={`https://wa.me/${historyData.vehicle.customer.phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                        >
                          <Phone size={12} />
                          WhatsApp
                        </a>
                      )}
                      <button
                        onClick={() => navigate('/bengkel/spk/new')}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black transition shadow-sm cursor-pointer active:scale-95"
                      >
                        <Plus size={13} /> SPK Baru
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* OIL MAINTENANCE CYCLE & REMINDER CARD */}
              {(() => {
                const rem = historyData?.oilReminder;
                const cycleDays = oilInterval === 2 ? 60 : 90;
                const daysSince = rem?.daysSinceLastService ?? null;
                const nextDueDate = rem ? (oilInterval === 2 ? rem.nextDue2Months : rem.nextDue3Months) : null;
                const isOverdue = rem ? (oilInterval === 2 ? rem.isDue2Months : rem.isDue3Months) : false;
                const isDueSoon = rem ? (oilInterval === 2 ? rem.isDueSoon2Months : rem.isDueSoon3Months) : false;
                const lastOil = rem?.lastOilPartName || null;
                const progress = daysSince !== null ? Math.min(100, Math.round((daysSince / cycleDays) * 100)) : 0;
                const daysDiff = daysSince !== null ? daysSince - cycleDays : 0;

                return (
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm">
                    {/* Header Widget */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isOverdue 
                            ? 'bg-rose-100 text-rose-700' 
                            : isDueSoon 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          <Droplets size={16} />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                            <span>Siklus & Pengingat Ganti Oli</span>
                            {isOverdue && (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                                Telat Ganti Oli
                              </span>
                            )}
                            {isDueSoon && (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-white">
                                Waktunya Servis
                              </span>
                            )}
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Rekomendasi interval: 2 bulan (~60 hari) untuk motor harian, 3 bulan (~90 hari) untuk mobil.
                          </p>
                        </div>
                      </div>

                      {/* Interval Switcher inside Detail */}
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setOilInterval(2)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                            oilInterval === 2
                              ? 'bg-purple-700 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          2 Bulan
                        </button>
                        <button
                          type="button"
                          onClick={() => setOilInterval(3)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                            oilInterval === 3
                              ? 'bg-purple-700 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          3 Bulan
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar & Status Details */}
                    {daysSince === null ? (
                      <div className="py-4 text-center text-xs text-slate-400">
                        Belum ada catatan servis sebelumnya untuk menghitung siklus oli kendaraan ini.
                      </div>
                    ) : (
                      <div className="pt-3 space-y-3">
                        {/* Progress Bar */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                            <span className="text-slate-600">
                              Estimasi Masa Pakai Oli ({daysSince} / {cycleDays} hari)
                            </span>
                            <span className={
                              isOverdue ? 'text-rose-600' : isDueSoon ? 'text-amber-700' : 'text-emerald-600'
                            }>
                              {progress}% {isOverdue ? `(Lewat ${daysDiff} hr)` : `(Sisa ${cycleDays - daysSince} hr)`}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isOverdue 
                                  ? 'bg-rose-600' 
                                  : isDueSoon 
                                  ? 'bg-amber-500' 
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>

                        {/* Info Tiles */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                            <div className="text-[10px] font-semibold text-slate-400 uppercase">Servis Terakhir</div>
                            <div className="font-bold text-slate-800 mt-0.5">
                              {rem?.lastServiceDate ? new Date(rem.lastServiceDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">({daysSince} hari yang lalu)</div>
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                            <div className="text-[10px] font-semibold text-slate-400 uppercase">Part Oli Terakhir</div>
                            <div className="font-bold text-purple-700 truncate mt-0.5" title={lastOil || 'Servis Rutin'}>
                              {lastOil || 'Servis Rutin / Oli Standar'}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">Penggantian sebelumnya</div>
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                            <div className="text-[10px] font-semibold text-slate-400 uppercase">Jatuh Tempo ({oilInterval} Bulan)</div>
                            <div className={`font-bold mt-0.5 ${isOverdue ? 'text-rose-600' : 'text-slate-800'}`}>
                              {nextDueDate ? new Date(nextDueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                            </div>
                            <div className={`text-[10px] font-bold ${isOverdue ? 'text-rose-600' : isDueSoon ? 'text-amber-700' : 'text-emerald-600'}`}>
                              {isOverdue ? `⚠️ Terlewat ${daysDiff} hari` : `✅ Sisa ${cycleDays - daysSince} hari`}
                            </div>
                          </div>
                        </div>

                        {/* WhatsApp Reminder Action Banner */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 bg-emerald-50/50 -mx-4 -mb-4 p-3 sm:px-4 rounded-b-2xl">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                              <MessageCircle size={14} />
                            </div>
                            <div className="text-xs">
                              <div className="font-bold text-slate-800">
                                Kirim Pengingat WhatsApp ke Konsumen
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {historyData?.vehicle?.customer?.phone 
                                  ? `Nomor terdaftar: ${historyData.vehicle.customer.phone} (${historyData.vehicle.customer.name})`
                                  : 'Nomor WhatsApp belum tercatat untuk pelanggan ini'}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOilModalVehicle({
                                ...historyData?.vehicle,
                                oilReminder: historyData?.oilReminder
                              });
                              setIsOilModalOpen(true);
                            }}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                          >
                            <MessageCircle size={13} />
                            <span>Kirim Pengingat WhatsApp</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* METRIC STRIP: 3 STAT CARDS */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-[10px] sm:text-xs font-semibold text-slate-500 mb-0.5">Total Kunjungan</div>
                  <div className="text-base sm:text-xl font-black text-purple-700">
                    {historyList.length} <span className="text-[10px] sm:text-xs font-bold">Kali</span>
                  </div>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-[10px] sm:text-xs font-semibold text-slate-500 mb-0.5">Total Nilai Servis</div>
                  <div className="text-base sm:text-xl font-black text-slate-900 truncate">
                    Rp {totalSpending.toLocaleString('id-ID')}
                  </div>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-[10px] sm:text-xs font-semibold text-slate-500 mb-0.5">Odometer Terakhir</div>
                  <div className="text-base sm:text-xl font-black text-emerald-600 truncate">
                    {latestKm ? `${latestKm.toLocaleString('id-ID')} KM` : '-'}
                  </div>
                </div>
              </div>

              {/* SERVICING TIMELINE */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                  <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                    <Calendar size={18} className="text-purple-600" />
                    <span>Rekam Jejak Kunjungan Servis</span>
                  </h3>
                  <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    {historyList.length} Riwayat
                  </span>
                </div>

                {historyList.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <FileText size={32} className="mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="text-xs font-medium">Belum ada catatan transaksi servis untuk kendaraan ini.</p>
                  </div>
                ) : (
                  <div className="relative pl-5 sm:pl-6 border-l-2 border-purple-300 space-y-4 sm:space-y-6">
                    {historyList.map((wo: any) => (
                      <div key={wo.id} className="relative group">
                        {/* Dot on Timeline */}
                        <div className="absolute -left-[27px] sm:-left-[31px] top-2 w-3.5 sm:w-4 h-3.5 sm:h-4 rounded-full bg-purple-600 border-2 border-white ring-2 ring-purple-200"></div>

                        {/* Work Order Card */}
                        <div className="bg-slate-50 hover:bg-slate-100/80 transition p-3.5 sm:p-4 rounded-xl border border-slate-200/90 shadow-sm">
                          
                          {/* Card Header: SPK + Date + Total */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2.5 pb-2 border-b border-slate-200/70">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-xs text-purple-800 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
                                {wo.spkNumber}
                              </span>
                              <span className="text-xs font-semibold text-slate-600">
                                {new Date(wo.createdAt).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                            <span className="text-xs sm:text-sm font-black text-slate-900">
                              Rp {wo.totalAmount?.toLocaleString('id-ID')}
                            </span>
                          </div>

                          {/* Odometer & Status */}
                          <div className="flex items-center justify-between gap-2 mb-2 text-xs">
                            {wo.currentKm ? (
                              <div className="flex items-center gap-1.5 text-slate-600 font-mono text-[11px]">
                                <Gauge size={13} className="text-purple-600 shrink-0" />
                                <span>Odometer: <strong className="text-slate-800">{wo.currentKm.toLocaleString()} KM</strong></span>
                              </div>
                            ) : <div></div>}
                            {wo.status && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                {wo.status}
                              </span>
                            )}
                          </div>

                          {/* Complaint / Catatan Keluhan */}
                          {wo.complaint && (
                            <div className="text-xs text-slate-700 italic bg-white p-2.5 rounded-lg border border-slate-200/80 mb-2.5 flex items-start gap-1.5">
                              <span className="text-slate-400 font-bold not-italic">Keluhan:</span>
                              <span>"{wo.complaint}"</span>
                            </div>
                          )}

                          {/* Services List */}
                          {wo.services?.length > 0 && (
                            <div className="text-xs text-slate-700 space-y-1 mb-2.5">
                              <div className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Jasa Yang Dikerjakan:</div>
                              <div className="space-y-1 bg-white p-2 rounded-lg border border-slate-200/70">
                                {wo.services.map((s: any) => (
                                  <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-1.5 truncate">
                                      <Wrench size={12} className="text-purple-600 shrink-0" />
                                      <span className="font-semibold text-slate-800 truncate">{s.serviceName}</span>
                                    </div>
                                    {(s.mechanicName || s.mechanic?.name) && (
                                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 shrink-0">
                                        Mekanik: {s.mechanicName || s.mechanic?.name}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Parts List */}
                          {wo.parts?.length > 0 && (
                            <div className="text-xs text-slate-700 space-y-1 pt-1">
                              <div className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Sparepart Yang Diganti:</div>
                              <div className="space-y-1 bg-white p-2 rounded-lg border border-slate-200/70">
                                {wo.parts.map((p: any) => (
                                  <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-1.5 truncate">
                                      <Package size={12} className="text-amber-600 shrink-0" />
                                      <span className="font-semibold text-slate-800 truncate">{p.partName}</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded shrink-0">
                                      {p.qty}x
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL PENGINGAT GANTI OLI WHATSAPP */}
      <OilReminderModal
        isOpen={isOilModalOpen}
        onClose={() => {
          setIsOilModalOpen(false);
          setSelectedOilModalVehicle(null);
        }}
        vehicle={selectedOilModalVehicle || (historyData?.vehicle ? {
          ...historyData.vehicle,
          oilReminder: historyData.oilReminder
        } : null)}
        token={token}
        storeName={settings?.storeName || 'Bengkel Kami'}
        defaultIntervalMonths={oilInterval}
      />
    </div>
  );
};

export default VehicleHistory;
