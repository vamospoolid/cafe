import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Car,
  User,
  Wrench,
  Package,
  Plus,
  Trash2,
  Save,
  CreditCard,
  Printer,
  ArrowLeft,
  XCircle,
  AlertTriangle,
  Gauge,
  Phone,
  Tag,
  Bike,
  Sparkles,
  FileText
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import { WorkOrderReceiptPrinter } from './WorkOrderReceiptPrinter';
import { BengkelCheckoutModal } from './BengkelCheckoutModal';

export const WorkOrderForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryPlate = searchParams.get('plate');
  const navState = location.state as {
    vehiclePlate?: string;
    customerName?: string;
    customerPhone?: string;
    priceTier?: string;
    vehicleType?: string;
    services?: any[];
    parts?: any[];
    cartItems?: any[];
  } | undefined;
  const { token } = usePOS();
  const isEditing = Boolean(id);

  const [currentWorkOrder, setCurrentWorkOrder] = useState<any | null>(null);
  const [showThermalReceipt, setShowThermalReceipt] = useState<boolean>(false);

  // Form States
  const [spkNumber, setSpkNumber] = useState<string>('');
  const [status, setStatus] = useState<string>('PENDING');
  const [vehiclePlate, setVehiclePlate] = useState<string>('');
  const [vehicleBrand, setVehicleBrand] = useState<string>('');
  const [vehicleModel, setVehicleModel] = useState<string>('');
  const [vehicleType, setVehicleType] = useState<string>('MOTOR');
  const [currentKm, setCurrentKm] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [priceTier, setPriceTier] = useState<string>('UMUM');
  const [complaint, setComplaint] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Items
  const [services, setServices] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);

  // Catalogs
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [availableMechanics, setAvailableMechanics] = useState<any[]>([]);

  // Payment Modal State
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');

  // Custom / Non-Catalog Part Input
  const [showCustomPartInput, setShowCustomPartInput] = useState<boolean>(false);
  const [customPartName, setCustomPartName] = useState<string>('');
  const [customPartPrice, setCustomPartPrice] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);

  // Load Catalogs
  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    fetch('/api/bengkel/service-types', { headers })
      .then(r => r.json())
      .then(data => Array.isArray(data) && setAvailableServices(data))
      .catch(console.error);

    fetch('/api/products', { headers })
      .then(r => r.json())
      .then(data => {
        const prods = Array.isArray(data) ? data : data.products || [];
        setAvailableProducts(prods);
      })
      .catch(console.error);

    fetch('/api/bengkel/mechanics', { headers })
      .then(r => r.json())
      .then(data => Array.isArray(data) && setAvailableMechanics(data))
      .catch(console.error);
  }, [token]);

  // Load Existing SPK if editing
  const loadExisting = useCallback(async () => {
    if (!id || !token) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/bengkel/work-orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentWorkOrder(data);
        setSpkNumber(data.spkNumber);
        setStatus(data.status);
        setVehiclePlate(data.vehiclePlate || data.vehicle?.plateNumber || '');
        setVehicleBrand(data.vehicleBrand || data.vehicle?.brand || '');
        setVehicleModel(data.vehicleModel || data.vehicle?.model || '');
        setVehicleType(data.vehicleType || data.vehicle?.vehicleType || 'MOTOR');
        setCurrentKm(data.currentKm ? String(data.currentKm) : (data.odometer ? String(data.odometer) : ''));
        setCustomerName(data.customerName || data.customer?.name || '');
        const rawPhone = data.customerPhone || data.customer?.phone || '';
        setCustomerPhone(rawPhone.startsWith('WALKIN-') ? '' : rawPhone);
        setPriceTier(data.priceTier || data.customer?.priceTier || 'UMUM');
        setComplaint(data.complaint || '');
        setNotes(data.notes || '');
        setServices(data.services || []);
        setParts(data.parts || []);
      } else {
        toast('Gagal memuat detail SPK', 'error');
      }
    } catch (e) {
      console.error(e);
      toast('Terjadi kesalahan saat memuat SPK', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    if (isEditing) loadExisting();
  }, [isEditing, loadExisting]);

  // Pre-fill from navigation state or URL query param (?plate=...&name=...&phone=...&tier=...)
  useEffect(() => {
    if (isEditing) return;

    // 1. Pre-fill directly from navigation state (transfer from POS Bengkel)
    if (navState) {
      if (navState.vehiclePlate) {
        setVehiclePlate(navState.vehiclePlate.trim().toUpperCase());
      }
      if (navState.customerName) {
        setCustomerName(navState.customerName.trim());
      }
      if (navState.customerPhone) {
        const rawPhone = navState.customerPhone.trim();
        setCustomerPhone(rawPhone.startsWith('WALKIN-') ? '' : rawPhone);
      }
      if (navState.priceTier) {
        setPriceTier(navState.priceTier);
      }
      if (navState.vehicleType) {
        setVehicleType(navState.vehicleType);
      }

      // Pre-fill items from POS Cart if available
      if (Array.isArray(navState.cartItems) && navState.cartItems.length > 0) {
        const srvItems = navState.cartItems
          .filter(i => i.type === 'SERVICE')
          .map(s => ({
            serviceTypeId: s.serviceTypeId,
            serviceName: s.name,
            price: s.price,
            subtotal: s.price * (s.qty || 1),
            mechanicId: s.mechanicId || null
          }));
        const prtItems = navState.cartItems
          .filter(i => i.type === 'PART')
          .map(p => ({
            productId: p.productId || null,
            partName: p.name,
            qty: p.qty || 1,
            price: p.price,
            subtotal: p.price * (p.qty || 1)
          }));
        if (srvItems.length > 0) setServices(srvItems);
        if (prtItems.length > 0) setParts(prtItems);
      } else {
        if (Array.isArray(navState.services) && navState.services.length > 0) setServices(navState.services);
        if (Array.isArray(navState.parts) && navState.parts.length > 0) setParts(navState.parts);
      }
    }

    // 2. Pre-fill from query params if passed
    const qPlate = searchParams.get('plate');
    const qName = searchParams.get('name');
    const qPhone = searchParams.get('phone');
    const qTier = searchParams.get('tier');

    if (qPlate) setVehiclePlate(qPlate.trim().toUpperCase());
    if (qName) setCustomerName(qName.trim());
    if (qPhone) {
      const raw = qPhone.trim();
      setCustomerPhone(raw.startsWith('WALKIN-') ? '' : raw);
    }
    if (qTier) setPriceTier(qTier);

    // 3. Lookup vehicle history if plate provided (to autofill brand, model, customer if missing)
    const effectivePlate = (qPlate || navState?.vehiclePlate || '').trim().toUpperCase();
    if (effectivePlate && token) {
      fetch(`/api/bengkel/vehicles/history/${encodeURIComponent(effectivePlate)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          if (data?.vehicle) {
            if (data.vehicle.brand) setVehicleBrand(prev => prev || data.vehicle.brand);
            if (data.vehicle.model) setVehicleModel(prev => prev || data.vehicle.model);
            if (data.vehicle.vehicleType) setVehicleType(prev => prev || data.vehicle.vehicleType);
            if (data.vehicle.customer) {
              if (data.vehicle.customer.name) setCustomerName(prev => prev || data.vehicle.customer.name);
              const rawCustPhone = data.vehicle.customer.phone || '';
              const cleanCustPhone = rawCustPhone.startsWith('WALKIN-') ? '' : rawCustPhone;
              if (cleanCustPhone) setCustomerPhone(prev => prev || cleanCustPhone);
              if (data.vehicle.customer.priceTier) setPriceTier(prev => prev === 'UMUM' ? data.vehicle.customer.priceTier : prev);
            }
          }
        })
        .catch(console.warn);
    }
  }, [isEditing, navState, searchParams, token]);

  // Lookup vehicle if typing plate number
  const handlePlateBlur = async () => {
    if (isEditing || !vehiclePlate.trim() || !token) return;
    try {
      const clean = vehiclePlate.trim().toUpperCase();
      const res = await fetch(`/api/bengkel/vehicles/history/${encodeURIComponent(clean)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.vehicle && (data.vehicle.id || data.vehicle.brand || data.vehicle.customer || data.vehicle.plateNumber)) {
          if (data.vehicle.brand) setVehicleBrand(data.vehicle.brand);
          if (data.vehicle.model) setVehicleModel(data.vehicle.model || '');
          if (data.vehicle.vehicleType) setVehicleType(data.vehicle.vehicleType || 'MOTOR');
          if (data.vehicle.customer) {
            if (data.vehicle.customer.name) {
              setCustomerName(prev => prev || data.vehicle.customer.name);
            }
            const raw = data.vehicle.customer.phone || '';
            const cleanPhone = raw.startsWith('WALKIN-') ? '' : raw;
            if (cleanPhone) {
              setCustomerPhone(prev => prev || cleanPhone);
            }
            if (data.vehicle.customer.priceTier) {
              setPriceTier(prev => prev === 'UMUM' ? data.vehicle.customer.priceTier : prev);
            }
          }
          toast(`Data kendaraan ${clean} ditemukan dari kunjungan sebelumnya`, 'info');
        }
      }
    } catch (e) {
      console.warn(e);
    }
  };

  // Add Service Item
  const handleAddService = (serviceTypeId: string) => {
    const srv = availableServices.find(s => s.id === serviceTypeId);
    if (!srv) return;

    let price = srv.priceRetail;
    if (priceTier === 'MITRA' && srv.priceMitra != null) price = srv.priceMitra;
    if (priceTier === 'GROSIR' && srv.priceGrosir != null) price = srv.priceGrosir;

    setServices(prev => [
      ...prev,
      {
        serviceTypeId: srv.id,
        serviceName: srv.name,
        price,
        subtotal: price,
        mechanicId: availableMechanics[0]?.id || null
      }
    ]);
  };

  // Add Part Item
  const handleAddPart = (productId: number) => {
    const prod = availableProducts.find(p => p.id === productId);
    if (!prod) return;

    let price = prod.sellPrice;
    if (priceTier === 'MITRA' && prod.sellPriceMitra != null) price = prod.sellPriceMitra;
    if (priceTier === 'GROSIR' && prod.sellPriceGrosir != null) price = prod.sellPriceGrosir;

    setParts(prev => [
      ...prev,
      {
        productId: prod.id,
        partName: prod.name,
        qty: 1,
        price,
        subtotal: price
      }
    ]);
  };

  // Add Custom / Non-Catalog Part
  const handleAddCustomPart = () => {
    if (!customPartName.trim()) {
      toast('Nama sparepart wajib diisi', 'warning');
      return;
    }
    const price = Math.max(0, parseFloat(customPartPrice) || 0);
    setParts(prev => [
      ...prev,
      {
        productId: null,
        partName: customPartName.trim(),
        qty: 1,
        price,
        subtotal: price
      }
    ]);
    setCustomPartName('');
    setCustomPartPrice('');
    setShowCustomPartInput(false);
  };

  // Totals Calculation
  const totalServices = services.reduce((sum, s) => sum + (s.subtotal || s.price || 0), 0);
  const totalParts = parts.reduce((sum, p) => sum + (p.subtotal || p.qty * p.price || 0), 0);
  const totalAmount = totalServices + totalParts;

  // Submit / Save SPK
  const handleSave = async () => {
    if (!vehiclePlate.trim()) {
      toast('Nomor Plat Kendaraan wajib diisi', 'warning');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
        vehicleBrand,
        vehicleModel,
        vehicleType,
        currentKm: currentKm ? parseInt(currentKm, 10) : null,
        customerName: customerName.trim() || 'Pelanggan Umum',
        customerPhone: customerPhone.trim() || null,
        priceTier,
        complaint,
        notes,
        services,
        parts
      };

      const res = await fetch('/api/bengkel/work-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const created = await res.json();
        toast(`SPK ${created.spkNumber} berhasil dibuat!`, 'success');
        navigate('/bengkel/board');
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menyimpan SPK', 'error');
      }
    } catch (e: any) {
      console.error(e);
      toast(e.message || 'Gagal menghubungi server', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Process Payment
  const handleProcessPayment = async () => {
    if (!id || !token) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/bengkel/work-orders/${id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          paymentMethod,
          paidAmount: payAmount,
          discountAmount: 0
        })
      });

      if (res.ok) {
        toast('Pembayaran SPK berhasil diproses! Status SPK: LUNAS', 'success');
        setShowPayModal(false);
        await loadExisting();
        setShowThermalReceipt(true);
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal memproses pembayaran', 'error');
      }
    } catch (e) {
      console.error(e);
      toast('Terjadi kesalahan saat memproses pembayaran', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Cancel SPK (Batalkan SPK & restore stock otomatis via backend)
  const handleCancelWorkOrder = async () => {
    if (!id || !token) return;
    const confirmCancel = window.confirm(
      `Apakah Anda yakin ingin membatalkan SPK ${spkNumber}?\n\nSemua suku cadang yang telah dipotong akan otomatis dikembalikan ke stok gudang.`
    );
    if (!confirmCancel) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/bengkel/work-orders/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'CANCELLED',
          mechanicNotes: 'Dibatalkan oleh kasir/pengguna'
        })
      });

      if (res.ok) {
        toast(`SPK ${spkNumber} berhasil dibatalkan dan stok sparepart telah dikembalikan`, 'success');
        setStatus('CANCELLED');
        await loadExisting();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal membatalkan SPK', 'error');
      }
    } catch (e) {
      console.error(e);
      toast('Terjadi kesalahan jaringan saat membatalkan SPK', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 pb-48 sm:pb-20 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => navigate('/bengkel/board')}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 shadow-sm transition active:scale-95 cursor-pointer"
            title="Kembali ke Antrean SPK"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-2xl font-black text-slate-900 tracking-tight truncate">
                {isEditing ? `SPK #${spkNumber}` : 'Buat SPK Baru'}
              </h1>
              {isEditing && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  status === 'DONE' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                  status === 'WIP' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  status === 'CANCELLED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                  'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {status}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {isEditing ? `Estimasi Total: Rp ${totalAmount.toLocaleString('id-ID')}` : 'Input data kendaraan, keluhan servis, jasa & sparepart'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isEditing && status === 'PAID' && (
            <button
              onClick={() => setShowThermalReceipt(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition active:scale-95 cursor-pointer"
            >
              <Printer size={16} className="text-amber-400" />
              <span>Cetak Struk Kasir</span>
            </button>
          )}

          {isEditing && status === 'CANCELLED' && (
            <div className="w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold text-xs">
              <XCircle size={15} className="text-rose-600 shrink-0" />
              <span>SPK DIBATALKAN</span>
            </div>
          )}

          {isEditing && status !== 'PAID' && status !== 'CANCELLED' && status !== 'DELIVERED' && (
            <>
              <button
                type="button"
                onClick={handleCancelWorkOrder}
                disabled={loading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                title="Batalkan SPK ini dan kembalikan stok sparepart"
              >
                <XCircle size={15} className="text-rose-600" />
                <span>Batalkan SPK</span>
              </button>
              <button
                onClick={() => setShowPayModal(true)}
                className="flex-2 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition active:scale-95 cursor-pointer"
              >
                <CreditCard size={16} />
                <span>Proses Pembayaran</span>
              </button>
            </>
          )}

          {!isEditing && (
            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer active:scale-95"
            >
              <Save size={16} />
              <span>Simpan &amp; Cetak SPK</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Data Kendaraan & Customer */}
        <div className="space-y-6">
          {/* Card Kendaraan */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5 font-black text-slate-900 text-sm sm:text-base">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Car size={18} />
                </div>
                <span>Data Kendaraan</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60">
                Wajib Isi Plat
              </span>
            </div>

            <div className="space-y-4">
              {/* License Plate Hero Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Nomor Plat Kendaraan</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Tekan enter / tab untuk auto-cek</span>
                </div>
                <div className="relative flex items-center">
                  <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-900 text-white tracking-wider mr-1">
                      RI
                    </span>
                  </div>
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                    onBlur={handlePlateBlur}
                    placeholder="Contoh: B 1234 ABC"
                    className="w-full pl-14 pr-10 py-2.5 bg-slate-50/70 border border-slate-300 focus:bg-white focus:border-purple-600 focus:ring-4 focus:ring-purple-500/10 rounded-xl text-base sm:text-lg font-black tracking-widest text-slate-900 uppercase placeholder:text-slate-400 placeholder:font-normal placeholder:tracking-normal outline-none transition-all shadow-2xs"
                  />
                  {vehiclePlate.trim() && (
                    <button
                      type="button"
                      onClick={handlePlateBlur}
                      title="Cek Riwayat Kendaraan"
                      className="absolute right-2.5 p-1 rounded-lg hover:bg-slate-200/60 text-purple-600 transition-colors cursor-pointer"
                    >
                      <Sparkles size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Jenis Kendaraan & Odometer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Jenis Kendaraan (Segmented Pill Toggle) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Jenis Kendaraan
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/70">
                    <button
                      type="button"
                      onClick={() => setVehicleType('MOTOR')}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        vehicleType === 'MOTOR'
                          ? 'bg-purple-700 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      <Bike size={15} />
                      <span>Motor</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVehicleType('MOBIL')}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        vehicleType === 'MOBIL'
                          ? 'bg-purple-700 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      <Car size={15} />
                      <span>Mobil</span>
                    </button>
                  </div>
                </div>

                {/* Odometer (KM) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Odometer (KM)
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3 pointer-events-none text-slate-400">
                      <Gauge size={16} />
                    </div>
                    <input
                      type="number"
                      value={currentKm}
                      onChange={(e) => setCurrentKm(e.target.value)}
                      placeholder="15400"
                      className="w-full pl-9 pr-12 py-2 bg-slate-50/70 border border-slate-300 focus:bg-white focus:border-purple-600 focus:ring-4 focus:ring-purple-500/10 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-2xs"
                    />
                    <span className="absolute right-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      KM
                    </span>
                  </div>
                </div>
              </div>

              {/* Merk & Model / Tipe */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Merk */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Merk Kendaraan
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3 pointer-events-none text-slate-400">
                      <Tag size={15} />
                    </div>
                    <input
                      type="text"
                      value={vehicleBrand}
                      onChange={(e) => setVehicleBrand(e.target.value)}
                      placeholder="Honda / Yamaha"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50/70 border border-slate-300 focus:bg-white focus:border-purple-600 focus:ring-4 focus:ring-purple-500/10 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-2xs"
                    />
                  </div>
                  {/* Quick Brand Suggestions */}
                  <div className="flex items-center gap-1 mt-1.5 overflow-x-auto pb-0.5">
                    {['Honda', 'Yamaha', 'Toyota', 'Suzuki'].map(brand => (
                      <button
                        key={brand}
                        type="button"
                        onClick={() => setVehicleBrand(brand)}
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 hover:bg-purple-50 text-slate-600 hover:text-purple-700 border border-slate-200 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        {brand}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Model / Tipe */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Model / Seri
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3 pointer-events-none text-slate-400">
                      <Wrench size={15} />
                    </div>
                    <input
                      type="text"
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                      placeholder="Vario 150 / Avanza"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50/70 border border-slate-300 focus:bg-white focus:border-purple-600 focus:ring-4 focus:ring-purple-500/10 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-2xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card Customer & Price Tier */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5 font-black text-slate-900 text-sm sm:text-base">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <User size={18} />
                </div>
                <span>Data Pelanggan &amp; Tier</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Opsional
              </span>
            </div>

            <div className="space-y-4">
              {/* Nama Pelanggan */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">Nama Pelanggan</label>
                  <button
                    type="button"
                    onClick={() => setCustomerName('Pelanggan Walk-In')}
                    className="text-[10px] font-bold text-purple-700 hover:text-purple-900 hover:underline cursor-pointer"
                  >
                    + Konsumen Umum
                  </button>
                </div>
                <div className="relative flex items-center">
                  <div className="absolute left-3 pointer-events-none text-slate-400">
                    <User size={16} />
                  </div>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nama konsumen walk-in atau member"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50/70 border border-slate-300 focus:bg-white focus:border-purple-600 focus:ring-4 focus:ring-purple-500/10 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-2xs"
                  />
                </div>
              </div>

              {/* Nomor WhatsApp */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nomor WhatsApp (Notifikasi SPK)
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 pointer-events-none text-emerald-600 flex items-center gap-1 font-bold text-xs">
                    <Phone size={14} />
                    <span>+62</span>
                  </div>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, '');
                      if (val.startsWith('62')) val = '0' + val.slice(2);
                      setCustomerPhone(val);
                    }}
                    placeholder="81234567890"
                    className="w-full pl-16 pr-3 py-2 bg-slate-50/70 border border-slate-300 focus:bg-white focus:border-purple-600 focus:ring-4 focus:ring-purple-500/10 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-2xs"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Untuk update progres servis &amp; kirim nota digital via WA
                </p>
              </div>

              {/* Price Tier Segmented Control */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Price Tier (3-Tier Pricing)
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/70">
                  {[
                    { id: 'UMUM', label: 'UMUM', desc: 'Standar' },
                    { id: 'MITRA', label: 'MITRA', desc: 'Ojol/Mitra' },
                    { id: 'GROSIR', label: 'GROSIR', desc: 'Grosir/Bengkel' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPriceTier(t.id)}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all cursor-pointer ${
                        priceTier === t.id
                          ? 'bg-purple-700 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      <span className="text-xs font-black leading-tight">{t.label}</span>
                      <span className={`text-[9px] leading-tight ${priceTier === t.id ? 'text-purple-200' : 'text-slate-400'}`}>
                        {t.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Keluhan & Catatan */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 font-black text-slate-900 text-sm sm:text-base">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <span>Keluhan &amp; Catatan Servis</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">Keluhan Konsumen</label>
                <span className="text-[10px] text-slate-400">Pilih cepat:</span>
              </div>

              {/* Quick Complaint Tags */}
              <div className="flex items-center gap-1 mb-2 overflow-x-auto pb-0.5">
                {[
                  'Ganti Oli & Filter',
                  'Rem Bunyi Decit',
                  'Tarikan Berat',
                  'Servis Berkala',
                  'Mati Total',
                  'Getar di CVT'
                ].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setComplaint(prev => prev ? `${prev}, ${tag}` : tag)}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-700 border border-slate-200/80 transition-colors whitespace-nowrap cursor-pointer active:scale-95"
                  >
                    +{tag}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                placeholder="Contoh: Mesin bergetar saat tarikan awal, rem depan bunyi decit..."
                className="w-full p-3 bg-slate-50/70 border border-slate-300 focus:bg-white focus:border-purple-600 focus:ring-4 focus:ring-purple-500/10 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all resize-none shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Catatan Tambahan Internal
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Bodi kiri ada baret halus, helm titip di resepsionis..."
                className="w-full p-3 bg-slate-50/70 border border-slate-300 focus:bg-white focus:border-purple-600 focus:ring-4 focus:ring-purple-500/10 rounded-xl text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all resize-none shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Jasa & Spareparts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card Jasa Servis */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <Wrench size={18} className="text-purple-600 shrink-0" />
                <span className="text-sm sm:text-base">Pekerjaan / Jasa Servis</span>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                  {services.length} Jasa
                </span>
              </div>

              {/* Add Service Selector */}
              <div className="w-full sm:w-auto">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddService(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="w-full sm:w-auto px-3 py-2 sm:py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none bg-slate-50/50"
                >
                  <option value="">+ Tambah Jasa Katalog...</option>
                  {availableServices.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Rp {s.priceRetail.toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Services Table */}
            {services.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
                Belum ada jasa ditambahkan. Pilih dari katalog di atas.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs">
                    <tr>
                      <th className="p-2.5 rounded-l-lg">Nama Jasa</th>
                      <th className="p-2.5">Mekanik yang Mengerjakan</th>
                      <th className="p-2.5 text-right">Biaya (Rp)</th>
                      <th className="p-2.5 rounded-r-lg text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {services.map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="p-2.5 font-medium text-slate-800">{s.serviceName}</td>
                        <td className="p-2.5">
                          <select
                            value={s.mechanicId || ''}
                            onChange={(e) => {
                              const val = e.target.value ? parseInt(e.target.value, 10) : null;
                              setServices(prev => prev.map((item, i) => i === idx ? { ...item, mechanicId: val } : item));
                            }}
                            className="px-2 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-purple-500"
                          >
                            <option value="">Pilih Mekanik...</option>
                            {availableMechanics.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} {m.commissionRate != null ? `(${Math.round(m.commissionRate <= 1 ? m.commissionRate * 100 : m.commissionRate)}% komisi)` : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2.5 text-right font-semibold text-slate-900">
                          Rp {(s.subtotal || s.price).toLocaleString('id-ID')}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => setServices(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Card Sparepart */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <Package size={18} className="text-purple-600 shrink-0" />
                <span className="text-sm sm:text-base">Sparepart & Suku Cadang</span>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                  {parts.length} Part
                </span>
              </div>

              {/* Add Part Selector */}
              <div className="w-full sm:w-auto flex items-center gap-2">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddPart(parseInt(e.target.value, 10));
                      e.target.value = '';
                    }
                  }}
                  className="w-full sm:w-auto px-3 py-2 sm:py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none bg-slate-50/50"
                >
                  <option value="">+ Dari Katalog Sparepart...</option>
                  {availableProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stok: {p.stock} | Rp {p.sellPrice.toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCustomPartInput(v => !v)}
                  className="px-2.5 py-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold whitespace-nowrap transition cursor-pointer"
                >
                  + Part Manual
                </button>
              </div>
            </div>

            {/* Custom Part Input Form */}
            {showCustomPartInput && (
              <div className="mb-4 p-3 bg-purple-50/60 border border-purple-200 rounded-xl flex flex-wrap items-center gap-2 animate-fade-in">
                <input
                  type="text"
                  placeholder="Nama Sparepart (misal: Busi Iridium NGK)"
                  value={customPartName}
                  onChange={e => setCustomPartName(e.target.value)}
                  className="flex-1 min-w-[200px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium outline-none focus:border-purple-500"
                />
                <div className="relative w-36">
                  <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">Rp</span>
                  <input
                    type="number"
                    placeholder="Harga Satuan"
                    value={customPartPrice}
                    onChange={e => setCustomPartPrice(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold outline-none focus:border-purple-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomPart}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs"
                >
                  Tambahkan
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomPartInput(false)}
                  className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
                >
                  Batal
                </button>
              </div>
            )}

            {/* Parts Table */}
            {parts.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
                Belum ada sparepart digunakan pada SPK ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs">
                    <tr>
                      <th className="p-2.5 rounded-l-lg">Nama Sparepart</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">Harga Satuan</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                      <th className="p-2.5 rounded-r-lg text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parts.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="p-2.5 font-medium text-slate-800">{p.partName}</td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            min="1"
                            value={p.qty}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                              setParts(prev => prev.map((item, i) => i === idx ? { ...item, qty: val, subtotal: val * item.price } : item));
                            }}
                            className="w-16 px-2 py-1 border border-slate-200 rounded text-center text-xs"
                          />
                        </td>
                        <td className="p-2.5 text-right text-slate-600">
                          Rp {p.price.toLocaleString('id-ID')}
                        </td>
                        <td className="p-2.5 text-right font-semibold text-slate-900">
                          Rp {(p.subtotal || p.qty * p.price).toLocaleString('id-ID')}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => setParts(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Financial Summary Box */}
          <div className="bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-950 text-white p-5 sm:p-7 rounded-2xl shadow-xl border border-purple-800/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <div className="text-purple-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Total Tagihan SPK
              </div>
              <div className="text-3xl sm:text-4xl font-black text-amber-300 tracking-tight">
                Rp {totalAmount.toLocaleString('id-ID')}
              </div>
              <div className="text-xs text-purple-200/90 flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
                <span>Jasa: <b>Rp {totalServices.toLocaleString('id-ID')}</b></span>
                <span>•</span>
                <span>Part: <b>Rp {totalParts.toLocaleString('id-ID')}</b></span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
              {isEditing && status === 'PAID' && (
                <button
                  type="button"
                  onClick={() => setShowThermalReceipt(true)}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 cursor-pointer"
                >
                  <Printer size={17} className="text-slate-950" />
                  Cetak Struk Kasir
                </button>
              )}

              {isEditing && status !== 'PAID' && status !== 'CANCELLED' && (
                <button
                  type="button"
                  onClick={() => setShowPayModal(true)}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-950/40 transition active:scale-95 cursor-pointer"
                >
                  <CreditCard size={19} />
                  <span>Bayar Kasir Sekarang</span>
                </button>
              )}

              {isEditing && (
                <button
                  type="button"
                  onClick={() => setShowThermalReceipt(true)}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Printer size={16} />
                  <span>Struk Thermal</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Safe bottom clearance spacer for mobile nav */}
      <div className="h-16 sm:h-8" aria-hidden="true" />

      {/* Modal Pembayaran Kasir Bengkel (Aesthetic 2-Column Checkout) */}
      {showPayModal && (
        <BengkelCheckoutModal
          isOpen={showPayModal}
          onClose={() => setShowPayModal(false)}
          onSuccess={(completedOrder) => {
            setCurrentWorkOrder(completedOrder);
            setStatus(completedOrder.status || 'PAID');
            setShowPayModal(false);
            setShowThermalReceipt(true);
            loadExisting();
          }}
          subtotal={totalAmount}
          cartItems={[
            ...services.map(s => ({
              id: `srv-${s.id || s.serviceTypeId || s.serviceName}`,
              type: 'SERVICE',
              serviceTypeId: s.serviceTypeId,
              name: s.serviceName,
              price: s.price,
              qty: s.qty || 1,
              mechanicId: s.mechanicId,
              mechanicName: s.mechanicName || availableMechanics.find(m => m.id === s.mechanicId)?.name
            })),
            ...parts.map(p => ({
              id: `part-${p.id || p.productId || p.partName}`,
              type: 'PART',
              productId: p.productId,
              name: p.partName,
              price: p.price,
              qty: p.qty || 1
            }))
          ]}
          vehiclePlate={vehiclePlate || 'UMUM'}
          customerName={customerName || 'Konsumen Walk-In'}
          customerPhone={customerPhone || ''}
          priceTier={(priceTier as any) || 'UMUM'}
          vehicleType={(vehicleType as any) || 'MOTOR'}
          token={token}
          existingWorkOrderId={id}
          isDirectSale={false}
        />
      )}

      {/* Modal Cetak Struk Thermal */}
      {showThermalReceipt && (currentWorkOrder || (isEditing && id)) && (
        <WorkOrderReceiptPrinter
          workOrder={currentWorkOrder || {
            id,
            spkNumber,
            status,
            vehiclePlate,
            vehicleBrand,
            vehicleModel,
            vehicleType,
            customerName,
            customerPhone,
            services,
            parts,
            totalServices,
            totalParts,
            totalAmount,
            paidAmount: totalAmount,
            createdAt: new Date().toISOString()
          }}
          onClose={() => setShowThermalReceipt(false)}
          autoPrint={true}
        />
      )}
    </div>
  );
};

export default WorkOrderForm;
