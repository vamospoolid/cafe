import React, { useState, useEffect, useContext } from 'react';
import { 
  History, Search, RotateCcw, Printer, Filter, ShoppingCart, DollarSign, 
  BarChart2, User, XCircle, Download, FileText, Zap, Eye, Calendar,
  Wrench, Car, Bike, Phone, MessageCircle, CheckCircle2, AlertCircle, 
  Package, Tag, ArrowRight, X, Clock, ShieldCheck
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { useVertical } from '../context/VerticalContext';
import { WorkOrderReceiptPrinter } from '../verticals/bengkel/WorkOrderReceiptPrinter';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import ReceiptPrinter from './ReceiptPrinter';
import OrderDetailModal from './OrderDetailModal';
import SalesReturnModal from './SalesReturnModal';
import { exportFinancialPDF } from '../utils/pdfGenerator';
import { getTodayStr, getYesterdayStr, getLast7DaysRange, getThisMonthRange, formatLocalDate } from '../utils/dateUtils';
import { toast, confirmAlert, errorAlert } from '../utils/alert';

// ----------------------------------------------------
// BENGKEL WORK ORDER DETAIL MODAL
// ----------------------------------------------------
interface BengkelWorkOrderDetailModalProps {
  workOrder: any;
  isOpen: boolean;
  onClose: () => void;
  onPrintReceipt: (workOrder: any) => void;
  onPartReturned?: () => void;
  token?: string | null;
}

const BengkelWorkOrderDetailModal: React.FC<BengkelWorkOrderDetailModalProps> = ({
  workOrder,
  isOpen,
  onClose,
  onPrintReceipt,
  onPartReturned,
  token
}) => {
  if (!isOpen || !workOrder) return null;

  const [partToReturn, setPartToReturn] = useState<any>(null);
  const [returnQty, setReturnQty] = useState<number>(1);
  const [returnReason, setReturnReason] = useState<string>('Batal pasang atas permintaan konsumen');
  const [returnCondition, setReturnCondition] = useState<'GOOD' | 'DAMAGED'>('GOOD');
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  const fmt = (val: number) => `Rp ${Math.round(val || 0).toLocaleString('id-ID')}`;
  const isPaid = workOrder.spkStatus === 'PAID' || workOrder.spkStatus === 'DELIVERED';
  const isCancelled = workOrder.spkStatus === 'CANCELLED';
  const isMotor = (workOrder.vehicleType || 'MOTOR').toUpperCase() === 'MOTOR';

  const openReturnDialog = (part: any) => {
    setPartToReturn(part);
    setReturnQty(part.qty || 1);
    setReturnReason('Batal pasang atas permintaan konsumen');
    setReturnCondition('GOOD');
  };

  const handleConfirmReturnPart = async () => {
    if (!partToReturn) return;
    setReturnSubmitting(true);
    try {
      const res = await fetch(`/api/bengkel/work-orders/${workOrder.id}/return-parts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          parts: [{ partId: partToReturn.id, qty: returnQty, condition: returnCondition }],
          reason: returnReason.trim() || 'Retur suku cadang dari konsumen',
          refundMethod: 'CASH'
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast('Suku cadang berhasil diretur dan stok telah dikembalikan ke inventori bengkel!', 'success');
        setPartToReturn(null);
        if (onPartReturned) onPartReturned();
        onClose();
      } else {
        toast(data.error || 'Gagal memproses retur suku cadang', 'error');
      }
    } catch (err: any) {
      toast('Terjadi kesalahan jaringan: ' + (err?.message || ''), 'error');
    } finally {
      setReturnSubmitting(false);
    }
  };

  const sendWhatsApp = () => {
    if (!workOrder.customerPhone) {
      toast('Nomor telepon konsumen tidak tersedia', 'error');
      return;
    }
    const cleanPhone = workOrder.customerPhone.replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
    
    const msg = `Halo ${workOrder.customerName || 'Bpk/Ibu'}, ini rincian SPK Servis di Bengkel kami:\n` +
      `*No. SPK:* ${workOrder.orderNumber}\n` +
      `*Plat Kendaraan:* ${workOrder.vehiclePlate}\n` +
      `*Mekanik:* ${workOrder.mechanicName || '-'}\n` +
      `*Total Biaya:* ${fmt(workOrder.total)}\n` +
      `*Status:* ${isPaid ? 'LUNAS' : 'BELUM LUNAS'}\n\n` +
      `Terima kasih telah mempercayakan kendaraan Anda kepada kami.`;

    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-inner ${
              isCancelled ? 'bg-rose-100 text-rose-600' : isPaid ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
            }`}>
              <Wrench size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {workOrder.orderNumber}
                </h3>
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                  isCancelled ? 'bg-rose-50 text-rose-700 border-rose-200' :
                  isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  workOrder.spkStatus === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {isCancelled ? 'BATAL' : isPaid ? 'LUNAS' : workOrder.spkStatus === 'IN_PROGRESS' ? 'DIKERJAKAN' : 'ANTREAN'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                <Clock size={12} /> {new Date(workOrder.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition active:scale-90"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* Kendaraan & Konsumen Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Box Kendaraan */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  {isMotor ? <Bike size={13} className="text-amber-400" /> : <Car size={13} className="text-blue-400" />} 
                  {workOrder.vehicleType || 'KENDARAAN'}
                </span>
                {workOrder.odometer && (
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md font-mono">
                    {workOrder.odometer.toLocaleString('id-ID')} KM
                  </span>
                )}
              </div>
              <div className="text-xl sm:text-2xl font-black tracking-widest text-amber-300 font-mono">
                {workOrder.vehiclePlate || 'WALK-IN'}
              </div>
              {(workOrder.vehicleBrand || workOrder.vehicleModel) && (
                <div className="text-xs text-slate-300 font-medium mt-1">
                  {workOrder.vehicleBrand} {workOrder.vehicleModel}
                </div>
              )}
            </div>

            {/* Box Konsumen & Mekanik */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Konsumen &amp; Mekanik</span>
                <div className="font-extrabold text-sm text-slate-800">{workOrder.customerName || 'Walk-in Konsumen'}</div>
                {workOrder.customerPhone && (
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Phone size={11} className="text-emerald-600" /> {workOrder.customerPhone}
                  </div>
                )}
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Mekanik Penanggungjawab:</span>
                <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                  {workOrder.mechanicName || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Keluhan / Diagnosa */}
          {(workOrder.complaint || workOrder.diagnosis) && (
            <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-3 text-amber-900">
              {workOrder.complaint && (
                <div><span className="font-bold">Keluhan:</span> {workOrder.complaint}</div>
              )}
              {workOrder.diagnosis && (
                <div className="mt-1"><span className="font-bold">Diagnosa:</span> {workOrder.diagnosis}</div>
              )}
            </div>
          )}

          {/* Rincian Jasa Servis */}
          <div>
            <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Wrench size={13} className="text-blue-600" /> Jasa Servis ({workOrder.services?.length || 0})
            </div>
            {workOrder.services && workOrder.services.length > 0 ? (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {workOrder.services.map((srv: any, idx: number) => (
                  <div key={srv.id || idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                    <div>
                      <div className="font-bold text-slate-800">{srv.serviceName}</div>
                      {srv.mechanicName && (
                        <div className="text-[10px] text-slate-400">Mekanik: {srv.mechanicName}</div>
                      )}
                    </div>
                    <div className="font-black text-slate-900">{fmt(srv.subtotal || srv.price)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                Tidak ada jasa servis tercatat
              </div>
            )}
          </div>

          {/* Rincian Suku Cadang & Oli */}
          <div>
            <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Package size={13} className="text-emerald-600" /> Suku Cadang &amp; Oli ({workOrder.parts?.length || 0})
            </div>
            {workOrder.parts && workOrder.parts.length > 0 ? (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {workOrder.parts.map((part: any, idx: number) => (
                  <div key={part.id || idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                    <div>
                      <div className="font-bold text-slate-800">{part.partName || part.product?.name}</div>
                      <div className="text-[10px] text-slate-400">{part.qty} x {fmt(part.price)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="font-black text-slate-900">{fmt(part.subtotal || (part.price * part.qty))}</div>
                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={() => openReturnDialog(part)}
                          title="Retur Suku Cadang & Pulihkan Stok"
                          className="px-2 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-[10px] font-bold flex items-center gap-1 transition active:scale-95"
                        >
                          <RotateCcw size={10} /> Retur
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                Tidak ada penggantian sparepart/oli
              </div>
            )}
          </div>

          {/* Ringkasan Finansial */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-slate-500">
              <span>Total Biaya Jasa Servis:</span>
              <span className="font-bold text-slate-700">{fmt(workOrder.totalServices)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Total Sparepart &amp; Oli:</span>
              <span className="font-bold text-slate-700">{fmt(workOrder.totalParts)}</span>
            </div>
            {workOrder.discount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Diskon SPK:</span>
                <span className="font-bold">- {fmt(workOrder.discount)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
              <span className="font-black text-slate-900">Total Tagihan:</span>
              <span className="text-base font-black text-blue-700">{fmt(workOrder.total)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600 pt-1">
              <span>Jumlah Terbayar:</span>
              <span className="font-bold text-emerald-700">{fmt(workOrder.paidAmount)}</span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2 shrink-0">
          {workOrder.customerPhone ? (
            <button
              type="button"
              onClick={sendWhatsApp}
              className="btn bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 py-2.5 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
            >
              <MessageCircle size={15} /> WhatsApp
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPrintReceipt(workOrder.rawWorkOrder || workOrder)}
              className="btn bg-indigo-600 text-white hover:bg-indigo-700 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition active:scale-95"
            >
              <Printer size={15} className="text-white" /> Cetak Struk SPK
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn bg-slate-100 text-slate-700 hover:bg-slate-200 py-2.5 px-4 rounded-xl font-bold text-xs transition"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>

      {/* Sub-modal: Retur Suku Cadang Bengkel dengan Keterangan */}
      {partToReturn && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div 
            className="bg-white rounded-3xl max-w-sm w-full p-4 sm:p-5 space-y-3.5 shadow-2xl border border-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <RotateCcw size={16} />
                </div>
                <div>
                  <h4 className="font-black text-xs sm:text-sm text-slate-800">Retur Suku Cadang</h4>
                  <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{partToReturn.partName || partToReturn.product?.name}</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setPartToReturn(null)}
                className="w-7 h-7 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-xs"
              >
                <X size={14} />
              </button>
            </div>

            {/* Input Kuantitas */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Kuantitas yang Diretur (maks {partToReturn.qty})
              </label>
              <div className="flex items-center gap-2">
                <input 
                  type="number"
                  min={1}
                  max={partToReturn.qty}
                  value={returnQty}
                  onChange={e => setReturnQty(Math.max(1, Math.min(partToReturn.qty, parseInt(e.target.value || '1', 10))))}
                  className="w-20 px-3 py-1.5 rounded-xl border border-slate-200 font-black text-xs focus:ring-2 focus:ring-primary/20 text-center"
                />
                <span className="text-xs text-slate-500">
                  Nilai Refund: <strong className="text-purple-700">{fmt(partToReturn.price * returnQty)}</strong>
                </span>
              </div>
            </div>

            {/* Input Keterangan / Alasan */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Keterangan / Alasan Retur
              </label>
              <input 
                type="text"
                value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
                placeholder="Misal: Batal pasang, Salah tipe oli, dll."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Kondisi */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Kondisi Suku Cadang
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReturnCondition('GOOD')}
                  className={`py-2 px-2.5 rounded-xl text-[10px] font-bold border transition ${
                    returnCondition === 'GOOD'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Layak (+Stok Gudang)
                </button>
                <button
                  type="button"
                  onClick={() => setReturnCondition('DAMAGED')}
                  className={`py-2 px-2.5 rounded-xl text-[10px] font-bold border transition ${
                    returnCondition === 'DAMAGED'
                      ? 'bg-rose-50 text-rose-800 border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Rusak / Cacat Pabrik
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPartToReturn(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReturnPart}
                disabled={returnSubmitting}
                className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md flex items-center gap-1 active:scale-95 disabled:opacity-50"
              >
                <RotateCcw size={12} className={returnSubmitting ? 'animate-spin' : ''} /> 
                {returnSubmitting ? 'Memproses...' : 'Konfirmasi Retur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ----------------------------------------------------
// MAIN COMPONENT: TransactionHistoryView
// ----------------------------------------------------
const TransactionHistoryView = () => {
  const { isBengkel, isRetail, isCafe } = useVertical();
  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Print & Modal States
  const [printOrder, setPrintOrder] = useState<any>(null);
  const [printBengkelOrder, setPrintBengkelOrder] = useState<any>(null);
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<any>(null);
  const [selectedBengkelOrder, setSelectedBengkelOrder] = useState<any>(null);
  const [orderToReturn, setOrderToReturn] = useState<any>(null);
  
  // Filter States: Default to 'today'
  const [preset, setPreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all'>('today');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const posContext = useContext(POSContext);
  const [printLoading, setPrintLoading] = useState<string | number | null>(null);

  const handleSelectPreset = (newPreset: 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all') => {
    setPreset(newPreset);
    if (newPreset === 'today') {
      const t = getTodayStr();
      setStartDate(t);
      setEndDate(t);
    } else if (newPreset === 'yesterday') {
      const y = getYesterdayStr();
      setStartDate(y);
      setEndDate(y);
    } else if (newPreset === 'week') {
      const r = getLast7DaysRange();
      setStartDate(r.startDate);
      setEndDate(r.endDate);
    } else if (newPreset === 'month') {
      const r = getThisMonthRange();
      setStartDate(r.startDate);
      setEndDate(r.endDate);
    } else if (newPreset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  const formatCurrency = (val: number) => `Rp ${Math.round(val || 0).toLocaleString('id-ID')}`;
  const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return `${d.toLocaleDateString('id-ID')} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
  };

  // FETCH ORDERS (VERTICAL-ADAPTIVE)
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate && endDate) {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      } else if (startDate) {
        params.append('startDate', startDate);
      }
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);
      params.append('tzOffset', String(new Date().getTimezoneOffset()));

      if (isBengkel) {
        // Fetch SPK Bengkel Work Orders
        const url = `/api/bengkel/work-orders?${params.toString()}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${posContext?.token}` } });
        if (res.ok) {
          const data = await res.json();
          // Normalize WorkOrder items
          const normalized = data.map((wo: any) => ({
            id: wo.id,
            orderNumber: wo.spkNumber,
            createdAt: wo.createdAt,
            customerName: wo.customer?.name || (wo.vehiclePlate ? `Plat: ${wo.vehiclePlate}` : 'Walk-in Konsumen'),
            customerPhone: wo.customer?.phone || '',
            customerTier: wo.customer?.priceTier || wo.priceTier || 'UMUM',
            vehiclePlate: wo.vehiclePlate || '-',
            vehicleType: wo.vehicleType || 'MOTOR',
            vehicleBrand: wo.vehicleBrand || '',
            vehicleModel: wo.vehicleModel || '',
            odometer: wo.odometer,
            complaint: wo.complaint,
            diagnosis: wo.diagnosis,
            mechanicName: wo.mechanicName || wo.services?.find((s: any) => s.mechanicName)?.mechanicName || '-',
            total: wo.totalAmount || 0,
            totalServices: wo.totalServices || 0,
            totalParts: wo.totalParts || 0,
            discount: wo.discount || 0,
            paidAmount: wo.paidAmount || 0,
            status: wo.status === 'PAID' || wo.status === 'DELIVERED' ? 'Paid' : wo.status === 'CANCELLED' ? 'Void' : wo.status,
            spkStatus: wo.status,
            paymentMethod: wo.paidAmount >= wo.totalAmount && wo.totalAmount > 0 ? 'LUNAS' : wo.paidAmount > 0 ? 'DP / SEBAGIAN' : 'BELUM BAYAR',
            user: { name: wo.mechanicName || 'Mekanik Bengkel' },
            services: wo.services || [],
            parts: wo.parts || [],
            rawWorkOrder: wo
          }));
          setOrders(normalized);
        }
      } else {
        // Fetch Retail or Cafe Orders
        const url = `/api/orders?${params.toString()}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${posContext?.token}` } });
        if (res.ok) {
          const data = await res.json();
          const normalized = data.map((ord: any) => ({
            ...ord,
            customerName: ord.customerName || 'Pelanggan Umum',
            paymentMethod: ord.paymentMethod || 'TUNAI',
            priceTier: ord.customer?.priceTier || ord.priceTier || 'UMUM'
          }));
          setOrders(normalized);
        }
      }
    } catch (err) {
      console.error('Error fetching transaction history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (posContext?.token) fetchOrders();
  }, [posContext?.token, startDate, endDate, statusFilter, isBengkel]);

  // DIRECT PRINT (ESC/POS Network)
  const handleDirectPrint = async (orderId: number | string) => {
    if (!posContext?.settings?.printerIp) {
      toast('IP Printer belum dikonfigurasi di menu Pengaturan', 'error');
      return;
    }
    setPrintLoading(orderId);
    try {
      const res = await fetch('/api/printer/receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (res.ok) {
        toast('Struk berhasil dicetak langsung ke printer!', 'success');
      } else {
        toast(data.error || 'Gagal mencetak struk', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan jaringan ke printer', 'error');
    } finally {
      setPrintLoading(null);
    }
  };

  // VOID / BATALKAN PESANAN
  const handleVoid = async (id: number | string, orderNumber: string) => {
    if (!posContext?.user?.permissions?.canVoid) {
      toast('Anda tidak memiliki akses untuk membatalkan pesanan (Void).', 'error');
      return;
    }
    const confirmResult = await confirmAlert(
      'Konfirmasi Pembatalan', 
      `Apakah Anda yakin ingin membatalkan transaksi ${orderNumber}? ${isBengkel ? 'Status SPK akan diubah menjadi CANCELLED dan stok part akan dikembalikan.' : 'Stok produk akan dikembalikan.'}`
    );
    if (!confirmResult.isConfirmed) return;

    try {
      if (isBengkel) {
        const res = await fetch(`/api/bengkel/work-orders/${id}/status`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${posContext?.token}` 
          },
          body: JSON.stringify({ status: 'CANCELLED' })
        });
        if (res.ok) {
          toast(`SPK ${orderNumber} berhasil dibatalkan.`, 'success');
          fetchOrders();
        } else {
          const err = await res.json();
          toast(err.error || 'Gagal membatalkan SPK.', 'error');
        }
      } else {
        const res = await fetch(`/api/orders/${id}/void`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${posContext?.token}` }
        });
        if (res.ok) {
          toast('Transaksi berhasil dibatalkan (Void).', 'success');
          fetchOrders();
        } else {
          const err = await res.json();
          toast(err.error || 'Gagal melakukan void transaksi.', 'error');
        }
      }
    } catch (err) { 
      console.error(err); 
    }
  };

  // Client-side filtering
  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const matchOrderNo = (o.orderNumber || '').toLowerCase().includes(q);
    const matchCustomer = (o.customerName || '').toLowerCase().includes(q);
    const matchPlate = (o.vehiclePlate || '').toLowerCase().includes(q);
    const matchMechanic = (o.mechanicName || '').toLowerCase().includes(q);
    return matchOrderNo || matchCustomer || matchPlate || matchMechanic;
  });

  const validOrders = orders.filter(o => o.status !== 'Void' && o.status !== 'CANCELLED');
  const totalSales = validOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const avgSales = validOrders.length > 0 ? totalSales / validOrders.length : 0;

  // EXPORT FUNCTIONS
  const exportPDF = async () => {
    const oldestDate = orders.length > 0 ? orders[orders.length - 1].createdAt.split('T')[0] : getTodayStr();
    const rangeStart = startDate || oldestDate;
    const rangeEnd = endDate || getTodayStr();
    
    await exportFinancialPDF(
      'transactions',
      posContext?.settings || {},
      filteredOrders,
      rangeStart,
      rangeEnd,
      (posContext?.user as any)?.name || 'Admin'
    );
  };

  const exportExcel = () => {
    let exportData: any[] = [];
    if (isBengkel) {
      exportData = filteredOrders.map(trx => ({
        "No. SPK": trx.orderNumber,
        "Tanggal": formatDate(trx.createdAt),
        "No. Polisi": trx.vehiclePlate || '-',
        "Tipe": trx.vehicleType || '-',
        "Pelanggan": trx.customerName || '-',
        "Mekanik": trx.mechanicName || '-',
        "Total Jasa": trx.totalServices || 0,
        "Total Part": trx.totalParts || 0,
        "Total Biaya": trx.total || 0,
        "Status": trx.status === 'Paid' ? 'LUNAS' : trx.status === 'Void' ? 'BATAL' : 'PROSES',
        "Pembayaran": trx.paymentMethod || '-'
      }));
    } else {
      exportData = filteredOrders.map(trx => ({
        "No. Transaksi": trx.orderNumber,
        "Tanggal": formatDate(trx.createdAt),
        "Pelanggan": trx.customerName,
        "Tier": trx.priceTier || 'UMUM',
        "Kasir": trx.user?.name,
        "Total Penjualan": trx.total,
        "Status": trx.status,
        "Metode Pembayaran": trx.paymentMethod || '-'
      }));
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, isBengkel ? "SPK Bengkel" : "Transaksi");
    XLSX.writeFile(workbook, `Laporan_${isBengkel ? 'SPK_Bengkel' : 'Transaksi'}_${Date.now()}.xlsx`);
  };

  const handleReset = () => {
    handleSelectPreset('today');
    setStatusFilter('');
    setSearchQuery('');
  };

  return (
    <div className="p-3 sm:p-6 pb-52 sm:pb-16 w-full flex flex-col gap-3.5 sm:gap-4">
      {/* HEADER / ACTION TOOLBAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 shrink-0">
        <div className="hidden sm:block">
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-slate-900">
            {isBengkel ? <Wrench className="text-blue-600" size={24} /> : <History className="text-primary" size={24} />} 
            {isBengkel ? 'Riwayat Servis & SPK' : isRetail ? 'Riwayat Penjualan Retail' : 'Riwayat Transaksi'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isBengkel 
              ? 'Daftar Surat Perintah Kerja (SPK), riwayat pekerjaan servis, dan penjualan suku cadang' 
              : isRetail 
              ? 'Daftar faktur kasir retail, tier harga ecer/grosir, dan status bon tempo'
              : 'Daftar transaksi penjualan dengan sinkronisasi waktu lokal real-time'}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            className="flex-1 sm:flex-none btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-2.5 px-3.5 text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 rounded-xl transition-all active:scale-95" 
            onClick={exportPDF}
          >
            <FileText size={15} className="text-rose-500" /> Export PDF
          </button>
          <button 
            className="flex-1 sm:flex-none btn bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-2.5 px-3.5 text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 rounded-xl transition-all active:scale-95" 
            onClick={exportExcel}
          >
            <Download size={15} className="text-emerald-600" /> Export Excel
          </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 shrink-0">
        <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 border-l-4 border-l-blue-600">
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block truncate">
              {isBengkel ? 'Total SPK' : isRetail ? 'Transaksi' : 'Pesanan'}
            </span>
            <div className="text-sm sm:text-2xl font-black text-slate-900 truncate">{validOrders.length}</div>
          </div>
          <div className="hidden sm:flex w-10 h-10 rounded-xl bg-blue-50 items-center justify-center text-blue-600 shrink-0">
            {isBengkel ? <Wrench size={20} /> : <ShoppingCart size={20} />}
          </div>
        </div>
        
        <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 border-l-4 border-l-emerald-600">
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block truncate">
              {isBengkel ? 'Omzet Servis' : 'Penjualan'}
            </span>
            <div className="text-xs sm:text-2xl font-black text-emerald-600 truncate">{formatCurrency(totalSales)}</div>
          </div>
          <div className="hidden sm:flex w-10 h-10 rounded-xl bg-emerald-50 items-center justify-center text-emerald-600 shrink-0">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-xs bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 border-l-4 border-l-indigo-600">
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block truncate">
              {isBengkel ? 'Rata-rata SPK' : 'Rata-rata'}
            </span>
            <div className="text-xs sm:text-2xl font-black text-indigo-700 truncate">{formatCurrency(avgSales)}</div>
          </div>
          <div className="hidden sm:flex w-10 h-10 rounded-xl bg-indigo-50 items-center justify-center text-indigo-500 shrink-0">
            <BarChart2 size={20} />
          </div>
        </div>
      </div>

      {/* FILTER & PENCARIAN BOX */}
      <div className="card flex-initial md:flex-1 flex flex-col p-0 shadow-sm bg-white rounded-2xl border border-slate-200/80 overflow-hidden shrink-0">
        <div className="border-b border-slate-200">
          <button 
            className="w-full p-3.5 sm:p-4 flex justify-between items-center bg-slate-50/70 hover:bg-slate-100/70 transition-colors"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
          >
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-indigo-700">
              <Filter size={16} /> Filter &amp; Pencarian {isBengkel ? 'SPK' : 'Transaksi'}
            </div>
            <span className={`text-xs text-slate-400 transform transition-transform ${isFilterOpen ? 'rotate-180' : ''}`}>▼</span>
          </button>
          
          {isFilterOpen && (
            <div className="p-3.5 sm:p-4 bg-white space-y-3.5 border-t border-slate-100">
              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap mr-1 flex items-center gap-1">
                  <Calendar size={13} /> Periode:
                </span>
                <button 
                  type="button"
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${preset === 'today' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  onClick={() => handleSelectPreset('today')}
                >
                  Hari Ini
                </button>
                <button 
                  type="button"
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${preset === 'yesterday' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  onClick={() => handleSelectPreset('yesterday')}
                >
                  Kemarin
                </button>
                <button 
                  type="button"
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${preset === 'week' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  onClick={() => handleSelectPreset('week')}
                >
                  7 Hari Terakhir
                </button>
                <button 
                  type="button"
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${preset === 'month' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  onClick={() => handleSelectPreset('month')}
                >
                  Bulan Ini
                </button>
                <button 
                  type="button"
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${preset === 'all' ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  onClick={() => handleSelectPreset('all')}
                >
                  Semua
                </button>
              </div>

              {/* Form Input Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                {preset === 'custom' || preset === 'week' || preset === 'month' ? (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Dari Tanggal</label>
                      <input 
                        type="date" 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20" 
                        value={startDate} 
                        onChange={e => setStartDate(e.target.value)} 
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Sampai Tanggal</label>
                      <input 
                        type="date" 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20" 
                        value={endDate} 
                        onChange={e => setEndDate(e.target.value)} 
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Pilih Tanggal Spesifik</label>
                    <input 
                      type="date" 
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20" 
                      value={startDate} 
                      onChange={e => {
                        setPreset('custom');
                        setStartDate(e.target.value);
                        setEndDate(e.target.value);
                      }} 
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Status {isBengkel ? 'SPK' : 'Pembayaran'}</label>
                  <select 
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-primary/20" 
                    value={statusFilter} 
                    onChange={e => setStatusFilter(e.target.value)}
                  >
                    <option value="">Semua Status</option>
                    {isBengkel ? (
                      <>
                        <option value="Paid">Lunas / Selesai (PAID)</option>
                        <option value="IN_PROGRESS">Sedang Dikerjakan</option>
                        <option value="Pending">Antrean (PENDING)</option>
                        <option value="Void">Dibatalkan (CANCELLED)</option>
                      </>
                    ) : (
                      <>
                        <option value="Paid">Lunas (Paid)</option>
                        <option value="Pending">Menunggu / Bon (Pending)</option>
                        <option value="Void">Dibatalkan (Void)</option>
                      </>
                    )}
                  </select>
                </div>

                <div className={preset === 'custom' || preset === 'week' || preset === 'month' ? 'sm:col-span-2 md:col-span-1' : 'sm:col-span-2'}>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Cari Spesifik</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                      <input 
                        type="text" 
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20" 
                        placeholder={isBengkel ? "No. SPK / Plat Nomor / Mekanik..." : isRetail ? "No. Faktur / Pelanggan..." : "No. Transaksi / Pelanggan..."} 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                      />
                    </div>
                    <button 
                      type="button"
                      className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors" 
                      onClick={handleReset}
                      title="Reset Filter ke Hari Ini"
                    >
                      <RotateCcw size={14} /> Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* LOADING & EMPTY STATES */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-medium">Memuat riwayat {isBengkel ? 'SPK Bengkel' : 'transaksi'}...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium">
            <p className="text-sm">Tidak ada riwayat {isBengkel ? 'SPK servis' : 'transaksi'} pada periode ini.</p>
            <p className="text-xs text-slate-400 mt-1">Coba sesuaikan filter tanggal atau cari dengan kata kunci lain.</p>
          </div>
        ) : (
          <>
            {/* MOBILE CARDS VIEW (Screen < 640px) */}
            <div className="sm:hidden divide-y divide-slate-100">
              {filteredOrders.map((trx, idx) => {
                const isPaid = trx.status === 'Paid';
                const isVoid = trx.status === 'Void' || trx.status === 'CANCELLED';
                const hasReturn = trx.items?.some((i: any) => (i.returnedQty || 0) > 0);
                const isMotor = (trx.vehicleType || 'MOTOR').toUpperCase() === 'MOTOR';

                return (
                  <div key={trx.id} className={`p-3.5 space-y-2.5 transition-colors ${isVoid ? 'opacity-60 bg-slate-50/50' : 'bg-white'}`}>
                    {/* Header Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                        <span className="font-black text-xs text-slate-900 tracking-tight">{trx.orderNumber}</span>
                        {isBengkel && trx.vehiclePlate && trx.vehiclePlate !== '-' && (
                          <span className="bg-slate-50 text-slate-800 border border-slate-300/80 font-mono font-bold px-2 py-0.5 rounded-lg text-[10px] tracking-wider ml-1 shadow-2xs flex items-center gap-1">
                            {isMotor ? <Bike size={11} className="text-purple-600" /> : <Car size={11} className="text-purple-600" />}
                            {trx.vehiclePlate}
                          </span>
                        )}
                        {isRetail && trx.priceTier && (
                          <span className="bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded text-[9px] border border-indigo-200">
                            {trx.priceTier}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        {hasReturn && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-extrabold flex items-center gap-0.5">
                            <RotateCcw size={9} /> RETUR
                          </span>
                        )}
                        {isVoid ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 font-bold">
                            {isBengkel ? 'BATAL' : 'VOID'}
                          </span>
                        ) : isPaid ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>LUNAS
                          </span>
                        ) : isBengkel && trx.spkStatus === 'IN_PROGRESS' ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 font-bold">
                            PROSES
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-bold">
                            {isBengkel ? 'ANTREAN' : 'PENDING'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Waktu:</span>
                        <span className="font-semibold text-slate-700">{formatDate(trx.createdAt)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">
                          {isBengkel ? 'Konsumen:' : 'Pelanggan:'}
                        </span>
                        <span className="font-bold text-slate-800 truncate block">{trx.customerName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">
                          {isBengkel ? 'Mekanik & Bayar:' : 'Kasir & Metode:'}
                        </span>
                        <span className="font-medium text-slate-700 truncate block">
                          {isBengkel ? trx.mechanicName : (trx.user?.name || '-')} • <span className="font-bold text-slate-600">{trx.paymentMethod}</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">
                          {isBengkel ? 'Total Biaya:' : 'Total Penjualan:'}
                        </span>
                        <span className="font-black text-sm text-slate-900">{formatCurrency(trx.total)}</span>
                      </div>
                    </div>

                    {/* Breakdown Summary Pill */}
                    {isBengkel ? (
                      (trx.services?.length > 0 || trx.parts?.length > 0) && (
                        <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 space-y-0.5">
                          {trx.services?.length > 0 && (
                            <div className="truncate"><span className="font-bold text-blue-600">Jasa:</span> {trx.services.map((s: any) => s.serviceName).join(', ')}</div>
                          )}
                          {trx.parts?.length > 0 && (
                            <div className="truncate"><span className="font-bold text-emerald-600">Part:</span> {trx.parts.map((p: any) => `${p.partName || p.product?.name} (${p.qty})`).join(', ')}</div>
                          )}
                        </div>
                      )
                    ) : (
                      trx.items?.length > 0 && (
                        <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100 truncate">
                          <span className="font-semibold text-slate-600">Item:</span> {trx.items.map((i: any) => `${i.product?.name || i.name} (${i.qty})`).join(', ')}
                        </div>
                      )
                    )}

                    {/* Actions Footer */}
                    <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-50">
                      {isBengkel ? (
                        <>
                          <button 
                            type="button"
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs flex items-center gap-1 transition-colors active:scale-95"
                            onClick={() => setSelectedBengkelOrder(trx)}
                          >
                            <Eye size={13} /> Rincian
                          </button>
                          <button 
                            type="button"
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/80 font-bold text-xs flex items-center gap-1 transition-colors active:scale-95 shadow-2xs"
                            onClick={() => setPrintBengkelOrder(trx.rawWorkOrder || trx)}
                          >
                            <Printer size={13} className="text-indigo-600" /> Struk SPK
                          </button>
                          {!isVoid && posContext?.user?.permissions?.canVoid && (
                            <button 
                              type="button"
                              className="px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs flex items-center gap-1 transition-colors active:scale-95"
                              onClick={() => handleVoid(trx.id, trx.orderNumber)}
                            >
                              <XCircle size={13} /> Batal
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <button 
                            type="button"
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs flex items-center gap-1 transition-colors active:scale-95"
                            onClick={() => setSelectedDetailOrder(trx)}
                          >
                            <Eye size={13} /> Rincian
                          </button>
                          <button 
                            type="button"
                            className={`px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs flex items-center gap-1 transition-colors active:scale-95 ${printLoading === trx.id ? 'opacity-60 cursor-not-allowed' : ''}`}
                            onClick={() => handleDirectPrint(trx.id)}
                            disabled={printLoading === trx.id}
                          >
                            <Zap size={13} className={printLoading === trx.id ? 'animate-pulse' : ''} /> Struk
                          </button>
                          {isPaid && (
                            <button 
                              type="button"
                              className="px-2.5 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold text-xs flex items-center gap-1 transition-colors active:scale-95 border border-purple-200/50"
                              onClick={() => setOrderToReturn(trx)}
                              title="Retur Barang"
                            >
                              <RotateCcw size={13} /> Retur
                            </button>
                          )}
                          {!isVoid && posContext?.user?.permissions?.canVoid && (
                            <button 
                              type="button"
                              className="px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs flex items-center gap-1 transition-colors active:scale-95"
                              onClick={() => handleVoid(trx.id, trx.orderNumber)}
                            >
                              <XCircle size={13} /> Void
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP TABLE VIEW (Screen >= 640px) */}
            <div className="hidden sm:block table-responsive p-0 overflow-x-auto">
              <table className="data-table w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{isBengkel ? 'NO. SPK' : 'NO. TRANSAKSI'}</th>
                    <th>{isBengkel ? 'PLAT & KENDARAAN' : 'TANGGAL & WAKTU'}</th>
                    <th>{isBengkel ? 'KONSUMEN' : 'PELANGGAN'}</th>
                    <th>{isBengkel ? 'MEKANIK' : 'KASIR'}</th>
                    <th>{isBengkel ? 'TOTAL BIAYA' : 'TOTAL'}</th>
                    <th>STATUS &amp; METODE</th>
                    <th className="text-right">AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((trx, idx) => {
                    const isPaid = trx.status === 'Paid';
                    const isVoid = trx.status === 'Void' || trx.status === 'CANCELLED';
                    const isMotor = (trx.vehicleType || 'MOTOR').toUpperCase() === 'MOTOR';

                    return (
                      <tr key={trx.id} className={isVoid ? 'opacity-50 bg-gray-50' : ''}>
                        <td className="text-muted">{idx + 1}</td>
                        <td className="font-extrabold text-primary">{trx.orderNumber}</td>
                        
                        {/* Kolom 3: Plat & Kendaraan (Bengkel) vs Tanggal (Retail/Cafe) */}
                        {isBengkel ? (
                          <td>
                            <div className="flex flex-col gap-0.5">
                              <span className="bg-slate-50 text-slate-800 border border-slate-300/80 font-mono font-bold px-2 py-0.5 rounded-lg text-xs tracking-wider inline-flex items-center gap-1.5 w-fit shadow-2xs">
                                {isMotor ? <Bike size={12} className="text-purple-600" /> : <Car size={12} className="text-purple-600" />}
                                {trx.vehiclePlate || 'WALK-IN'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {formatDate(trx.createdAt)}
                              </span>
                            </div>
                          </td>
                        ) : (
                          <td className="text-sm">{formatDate(trx.createdAt)}</td>
                        )}

                        {/* Kolom 4: Pelanggan */}
                        <td>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1 font-semibold text-gray-800">
                              <User size={13} className="text-gray-400" /> {trx.customerName}
                            </div>
                            {isRetail && trx.priceTier && (
                              <span className="text-[10px] text-indigo-600 font-bold">
                                Tier: {trx.priceTier}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Kolom 5: Kasir / Mekanik */}
                        <td className="text-sm font-medium text-slate-700">
                          {isBengkel ? trx.mechanicName : (trx.user?.name || '-')}
                        </td>

                        {/* Kolom 6: Total */}
                        <td>
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900">{formatCurrency(trx.total)}</span>
                            {isBengkel && (trx.totalServices > 0 || trx.totalParts > 0) && (
                              <span className="text-[10px] text-slate-400">
                                Jasa {formatCurrency(trx.totalServices)} • Part {formatCurrency(trx.totalParts)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Kolom 7: Status */}
                        <td>
                          {isVoid ? (
                            <span className="text-xs px-2 py-1 rounded-md bg-red-100 text-red-700 border border-red-200 font-bold">
                              {isBengkel ? 'BATAL' : 'VOID'}
                            </span>
                          ) : isPaid ? (
                            <div className="flex flex-col gap-0.5 items-start">
                              <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold">LUNAS</span>
                              <span className="text-[11px] text-slate-500 font-medium">{trx.paymentMethod}</span>
                            </div>
                          ) : isBengkel && trx.spkStatus === 'IN_PROGRESS' ? (
                            <span className="text-xs px-2 py-1 rounded-md bg-blue-100 text-blue-800 border border-blue-200 font-bold">PROSES</span>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded-md bg-yellow-100 text-yellow-700 border border-yellow-200 font-bold">
                              {isBengkel ? 'ANTREAN' : 'PENDING'}
                            </span>
                          )}
                        </td>

                        {/* Kolom 8: Aksi */}
                        <td className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {isBengkel ? (
                              <>
                                <button 
                                  type="button"
                                  className="icon-btn text-indigo-600 bg-indigo-50 hover:bg-indigo-100" 
                                  title="Lihat Rincian SPK" 
                                  onClick={() => setSelectedBengkelOrder(trx)}
                                >
                                  <Eye size={16}/>
                                </button>
                                <button 
                                  type="button"
                                  className="icon-btn text-slate-900 bg-slate-100 hover:bg-slate-200" 
                                  title="Cetak Struk SPK Termal" 
                                  onClick={() => setPrintBengkelOrder(trx.rawWorkOrder || trx)}
                                >
                                  <Printer size={16} className="text-amber-500" />
                                </button>
                                {!isVoid && posContext?.user?.permissions?.canVoid && (
                                  <button 
                                    type="button"
                                    className="icon-btn text-red-600 bg-red-50 hover:bg-red-100" 
                                    title="Batalkan SPK & Kembalikan Stok"
                                    onClick={() => handleVoid(trx.id, trx.orderNumber)}
                                  >
                                    <XCircle size={16}/>
                                  </button>
                                )}
                              </>
                            ) : (
                              <>
                                <button 
                                  type="button"
                                  className="icon-btn text-indigo-600 bg-indigo-50 hover:bg-indigo-100" 
                                  title="Lihat Rincian Pesanan" 
                                  onClick={() => setSelectedDetailOrder(trx)}
                                >
                                  <Eye size={16}/>
                                </button>
                                <button 
                                  type="button"
                                  className={`icon-btn text-emerald-600 bg-emerald-50 hover:bg-emerald-100 ${printLoading === trx.id ? 'opacity-60 cursor-not-allowed' : ''}`} 
                                  title="Cetak Struk Termal Langsung" 
                                  onClick={() => handleDirectPrint(trx.id)}
                                  disabled={printLoading === trx.id}
                                >
                                  <Zap size={16} className={printLoading === trx.id ? 'animate-pulse' : ''} />
                                </button>
                                {isPaid && (
                                  <button 
                                    type="button"
                                    className="icon-btn text-purple-600 bg-purple-50 hover:bg-purple-100" 
                                    title="Retur Barang & Kembalikan Stok" 
                                    onClick={() => setOrderToReturn(trx)}
                                  >
                                    <RotateCcw size={16}/>
                                  </button>
                                )}
                                {!isVoid && posContext?.user?.permissions?.canVoid && (
                                  <button 
                                    type="button"
                                    className="icon-btn text-red-600 bg-red-50 hover:bg-red-100" 
                                    title="Batalkan Transaksi"
                                    onClick={() => handleVoid(trx.id, trx.orderNumber)}
                                  >
                                    <XCircle size={16}/>
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      
      {/* Bengkel Detailed SPK Modal */}
      {selectedBengkelOrder && (
        <BengkelWorkOrderDetailModal
          workOrder={selectedBengkelOrder}
          isOpen={Boolean(selectedBengkelOrder)}
          onClose={() => setSelectedBengkelOrder(null)}
          onPrintReceipt={(wo) => setPrintBengkelOrder(wo)}
          onPartReturned={() => fetchOrders()}
          token={posContext?.token}
        />
      )}

      {/* Bengkel Thermal SPK Receipt Printer */}
      {printBengkelOrder && (
        <WorkOrderReceiptPrinter
          workOrder={printBengkelOrder}
          onClose={() => setPrintBengkelOrder(null)}
          autoPrint={true}
        />
      )}

      {/* Standard Retail/Cafe Detailed Order Bottom Sheet / Modal */}
      {selectedDetailOrder && (
        <OrderDetailModal 
          order={selectedDetailOrder}
          isOpen={Boolean(selectedDetailOrder)}
          onClose={() => setSelectedDetailOrder(null)}
          onDirectPrint={handleDirectPrint}
          onPreviewReceipt={(ord) => setPrintOrder(ord)}
          onVoid={handleVoid}
          onReturn={(ord) => setOrderToReturn(ord)}
          canVoid={Boolean(posContext?.user?.permissions?.canVoid)}
          printLoading={printLoading === selectedDetailOrder?.id}
        />
      )}

      {/* Standard Sales Return & Restock Modal */}
      {orderToReturn && (
        <SalesReturnModal 
          order={orderToReturn}
          isOpen={Boolean(orderToReturn)}
          token={posContext?.token}
          onClose={() => setOrderToReturn(null)}
          onSuccess={() => {
            fetchOrders();
            if (selectedDetailOrder && selectedDetailOrder.id === orderToReturn.id) {
              setSelectedDetailOrder(null);
            }
          }}
        />
      )}

      {/* Standard Receipt Printer Modal */}
      {printOrder && <ReceiptPrinter order={printOrder} onClose={() => setPrintOrder(null)} />}
    </div>
  );
};

export default TransactionHistoryView;
