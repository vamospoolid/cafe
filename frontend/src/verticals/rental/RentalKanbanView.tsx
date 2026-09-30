import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Sparkles, 
  Search, 
  Layers, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  Plus, 
  Printer, 
  RefreshCw, 
  ArrowRight, 
  DollarSign, 
  Check, 
  X,
  CreditCard,
  Wallet,
  MessageSquare,
  ShieldCheck,
  Tag,
  Calendar,
  User,
  Scissors,
  Camera,
  Shirt
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import { RentalReceiptPrinter } from './RentalReceiptPrinter';

interface RentalOrderItem {
  id: string;
  attireName: string;
  attireCode: string;
  rackHangerCode?: string;
  color?: string;
  size?: string;
  price: number;
  isReturned: boolean;
  returnCondition: string;
  damageNotes?: string;
}

interface RentalOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  eventLocation?: string;
  eventDate: string;
  pickupDate: string;
  returnDeadline: string;
  actualReturnDate?: string;
  status: 'BOOKED' | 'FITTING' | 'PICKED_UP' | 'RETURNED' | 'QC_CHECK' | 'LAUNDRY' | 'COMPLETED' | 'CANCELLED';
  rentalSubtotal: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: 'UNPAID' | 'DP_PAID' | 'FULL_PAID';
  paymentMethod?: string;
  depositAmount: number;
  depositRefunded: number;
  depositStatus: 'NONE' | 'HELD' | 'PARTIAL_REFUND' | 'FULL_REFUND' | 'FORFEITED';
  lateFee: number;
  damageFee: number;
  fittingNotes?: string;
  fittingDone: boolean;
  accessoryChecklist?: Array<{ name: string; checked: boolean; attireCode?: string }>;
  items: RentalOrderItem[];
  createdAt: string;
}

const KANBAN_STAGES: Array<{ key: RentalOrder['status']; label: string; color: string; badge: string }> = [
  { key: 'BOOKED', label: '1. Terjadwal (Booked)', color: 'border-blue-500', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'FITTING', label: '2. Fitting & Permak', color: 'border-purple-500', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: 'PICKED_UP', label: '3. Dibawa Klien', color: 'border-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'RETURNED', label: '4. Kembali (Menunggu QC)', color: 'border-orange-500', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  { key: 'LAUNDRY', label: '5. Cuci & Uap Sutra', color: 'border-cyan-500', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { key: 'COMPLETED', label: '6. Selesai (Rekonsiliasi)', color: 'border-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
];

export const RentalKanbanView: React.FC = () => {
  const { token } = usePOS();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<RentalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});

  // Inspection & QC Modal State
  const [qcModalOrder, setQcModalOrder] = useState<RentalOrder | null>(null);
  const [checklist, setChecklist] = useState<Array<{ name: string; checked: boolean }>>([]);
  const [lateFeeInput, setLateFeeInput] = useState<number>(0);
  const [damageFeeInput, setDamageFeeInput] = useState<number>(0);
  const [nextStageInput, setNextStageInput] = useState<'LAUNDRY' | 'COMPLETED'>('LAUNDRY');
  const [isProcessingQc, setIsProcessingQc] = useState(false);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<RentalOrder | null>(null);

  // Fetch Orders
  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/rental/orders?limit=150', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders || []);
        setStageCounts(data.summary || {});
      } else {
        toast(data.error || 'Gagal mengambil data sewa.', 'error');
      }
    } catch (err: any) {
      toast('Gagal terhubung ke server rental.', 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Transisi Status Sederhana (Next Stage)
  const handleQuickAdvance = async (orderId: string, nextStatus: RentalOrder['status']) => {
    try {
      const res = await fetch(`/api/rental/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (res.ok) {
        toast(data.message || 'Status berhasil diperbarui.', 'success');
        fetchOrders();
      } else {
        toast(data.error || 'Gagal mengubah status.', 'error');
      }
    } catch (e: any) {
      toast('Gagal memperbarui status sewa.', 'error');
    }
  };

  // Buka Modal QC & Return Inspection
  const handleOpenQcModal = (order: RentalOrder) => {
    setQcModalOrder(order);
    // Init checklist dari order
    if (order.accessoryChecklist && Array.isArray(order.accessoryChecklist)) {
      setChecklist(order.accessoryChecklist.map(it => ({ name: it.name, checked: true })));
    } else {
      setChecklist([
        { name: 'Saloko / Mahkota Kepala', checked: true },
        { name: 'Bando Emas Adat', checked: true },
        { name: 'Kalung Beranak 3 Susun', checked: true },
        { name: 'Sepasang Gelang Ponto (2 Pcs)', checked: true },
        { name: 'Lipa Sabbe / Sarung Sutra', checked: true }
      ]);
    }
    setLateFeeInput(0);
    setDamageFeeInput(0);
    setNextStageInput('LAUNDRY');
  };

  // Submit QC & Refund
  const handleSubmitQc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qcModalOrder) return;

    setIsProcessingQc(true);
    try {
      const payload = {
        accessoryChecklist: checklist,
        lateFee: lateFeeInput,
        damageFee: damageFeeInput,
        nextStage: nextStageInput
      };

      const res = await fetch(`/api/rental/orders/${qcModalOrder.id}/return-inspection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        toast(`Inspeksi selesai! Uang deposit yang dikembalikan: Rp ${data.refundAmount?.toLocaleString('id-ID')}`, 'success');
        setQcModalOrder(null);
        fetchOrders();
      } else {
        toast(data.error || 'Gagal memproses inspeksi.', 'error');
      }
    } catch (e: any) {
      toast('Gagal memproses inspeksi pengembalian.', 'error');
    } finally {
      setIsProcessingQc(false);
    }
  };

  // Filter orders by search
  const filteredOrders = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(o => 
      o.customerName.toLowerCase().includes(q) ||
      o.orderNumber.toLowerCase().includes(q) ||
      (o.customerPhone && o.customerPhone.includes(q)) ||
      o.items.some(i => i.attireName.toLowerCase().includes(q) || i.attireCode.toLowerCase().includes(q))
    );
  }, [orders, search]);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-100">
      
      {/* ─── TOP ACTION BAR ───────────────────────────────────────────────── */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Layers className="text-amber-500" size={20} />
            Papan Status Sewa Busana Adat
          </h1>
          <p className="text-xs text-slate-500">
            Lacak siklus busana: Booked ➔ Fitting ➔ Diambil Klien ➔ Kembali ➔ Cuci ➔ Selesai.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Cari penyewa, nota, baju..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <button
            onClick={fetchOrders}
            className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shrink-0"
            title="Refresh Data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => navigate('/pos')}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shrink-0"
          >
            <Plus size={15} /> Booking Baru
          </button>
        </div>
      </div>

      {/* ─── KANBAN BOARD COLUMNS ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto p-4 flex gap-4 no-scrollbar">
        {KANBAN_STAGES.map(stage => {
          const stageOrders = filteredOrders.filter(o => o.status === stage.key);
          return (
            <div 
              key={stage.key}
              className="w-80 min-w-[320px] max-w-[320px] flex flex-col bg-slate-50/80 rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden"
            >
              {/* Column Header */}
              <div className={`p-3 bg-white border-b-2 ${stage.color} flex items-center justify-between`}>
                <span className="font-bold text-xs text-slate-800">{stage.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${stage.badge}`}>
                  {stageOrders.length}
                </span>
              </div>

              {/* Column Cards Container */}
              <div className="flex-1 p-2.5 overflow-y-auto space-y-2.5">
                {stageOrders.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs font-medium border border-dashed border-slate-200 rounded-xl">
                    Tidak ada pesanan di tahap ini
                  </div>
                ) : (
                  stageOrders.map(order => {
                    const eventDateStr = new Date(order.eventDate).toLocaleDateString('id-ID', { dateStyle: 'medium' });
                    const returnDeadlineStr = new Date(order.returnDeadline).toLocaleDateString('id-ID', { dateStyle: 'short' });

                    return (
                      <div
                        key={order.id}
                        className="bg-white rounded-xl border border-slate-200/90 p-3 shadow-xs hover:shadow-md transition-all space-y-2.5"
                      >
                        {/* Order Header: OrderNo & Payment Status */}
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] font-bold text-slate-700">
                              #{order.orderNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedOrderForReceipt(order)}
                              title="Cetak Struk / Kontrak Sewa"
                              className="p-1 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            >
                              <Printer size={13} />
                            </button>
                          </div>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            order.paymentStatus === 'FULL_PAID'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : order.paymentStatus === 'DP_PAID'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {order.paymentStatus === 'FULL_PAID' ? 'Lunas' : order.paymentStatus === 'DP_PAID' ? 'DP Terbayar' : 'Belum Bayar'}
                          </span>
                        </div>

                        {/* Customer Info */}
                        <div>
                          <div className="font-bold text-slate-900 text-xs line-clamp-1">{order.customerName}</div>
                          {order.customerPhone && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone size={11} className="text-slate-400" />
                              {order.customerPhone}
                            </div>
                          )}
                        </div>

                        {/* Items Preview */}
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
                          {order.items.map(it => (
                            <div key={it.id} className="text-[11px] text-slate-700 flex items-center justify-between">
                              <span className="truncate pr-1">• {it.attireName}</span>
                              <span className="font-mono font-bold text-[10px] text-indigo-600 shrink-0">
                                {it.rackHangerCode || it.attireCode}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Event Date & Return Deadline */}
                        <div className="grid grid-cols-2 gap-1.5 text-[10px] pt-1 border-t border-slate-100">
                          <div>
                            <span className="text-slate-400 block">Tgl Acara:</span>
                            <span className="font-semibold text-slate-700">{eventDateStr}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Batas Kembali:</span>
                            <span className="font-semibold text-amber-700">{returnDeadlineStr}</span>
                          </div>
                        </div>

                        {/* Deposit Status Badge */}
                        {order.depositAmount > 0 && (
                          <div className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-amber-50/60 border border-amber-200/60 text-amber-900">
                            <span className="font-medium">Jaminan Deposit:</span>
                            <span className="font-bold">Rp {order.depositAmount.toLocaleString('id-ID')}</span>
                          </div>
                        )}

                        {/* Fitting Notes if present */}
                        {order.fittingNotes && (
                          <div className="text-[10px] text-purple-700 bg-purple-50/60 p-1.5 rounded border border-purple-100 flex items-start gap-1">
                            <Scissors size={12} className="shrink-0 mt-0.5 text-purple-500" />
                            <span className="line-clamp-2">{order.fittingNotes}</span>
                          </div>
                        )}

                        {/* Stage Specific Action Buttons */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                          {order.status === 'BOOKED' && (
                            <button
                              onClick={() => handleQuickAdvance(order.id, 'FITTING')}
                              className="w-full py-1.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 flex items-center justify-center gap-1"
                            >
                              <Scissors size={13} /> Masuk Fitting
                            </button>
                          )}

                          {order.status === 'FITTING' && (
                            <button
                              onClick={() => handleQuickAdvance(order.id, 'PICKED_UP')}
                              className="w-full py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-1 shadow-xs"
                            >
                              <CheckCircle2 size={13} /> Diambil Klien
                            </button>
                          )}

                          {order.status === 'PICKED_UP' && (
                            <button
                              onClick={() => handleOpenQcModal(order)}
                              className="w-full py-1.5 rounded-lg text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center gap-1 shadow-xs"
                            >
                              <ArrowRight size={13} /> Terima & Cek QC
                            </button>
                          )}

                          {order.status === 'RETURNED' && (
                            <button
                              onClick={() => handleOpenQcModal(order)}
                              className="w-full py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1"
                            >
                              <ShieldCheck size={13} /> Proses Refund Deposit
                            </button>
                          )}

                          {order.status === 'LAUNDRY' && (
                            <button
                              onClick={() => handleQuickAdvance(order.id, 'COMPLETED')}
                              className="w-full py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1"
                            >
                              <CheckCircle2 size={13} /> Cuci Selesai (Ready)
                            </button>
                          )}

                          {order.status === 'COMPLETED' && (
                            <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 mx-auto py-1">
                              <Check size={13} /> Transaksi Selesai
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── MODAL QC INSPECTION & REFUND DEPOSIT ───────────────────────────── */}
      {qcModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <ShieldCheck className="text-amber-500" size={18} />
                  Inspeksi Pengembalian & Rekonsiliasi Jaminan
                </h3>
                <p className="text-[11px] text-slate-500">
                  Nota #{qcModalOrder.orderNumber} • {qcModalOrder.customerName}
                </p>
              </div>
              <button
                onClick={() => setQcModalOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitQc} className="p-4 space-y-4 overflow-y-auto text-xs">
              
              {/* Checklist Aksesoris */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Checklist Kelengkapan Aksesoris:</span>
                  <span className="text-[10px] text-slate-500">Centang jika lengkap</span>
                </div>

                <div className="space-y-1.5">
                  {checklist.map((item, idx) => (
                    <label key={idx} className="flex items-center gap-2 p-1.5 bg-white rounded-md border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => {
                          const updated = [...checklist];
                          updated[idx].checked = e.target.checked;
                          setChecklist(updated);
                        }}
                        className="rounded text-indigo-600"
                      />
                      <span className={`text-xs ${item.checked ? 'text-slate-700' : 'text-rose-600 line-through'}`}>
                        {item.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Denda Keterlambatan & Kerusakan */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Denda Keterlambatan (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={lateFeeInput || ''}
                    onChange={(e) => setLateFeeInput(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-right font-bold bg-slate-50"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Denda Kerusakan / Hilang (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={damageFeeInput || ''}
                    onChange={(e) => setDamageFeeInput(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-right font-bold bg-slate-50"
                  />
                </div>
              </div>

              {/* Kalkulasi Refund Deposit */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Uang Deposit Tertahan:</span>
                  <span className="font-bold">Rp {qcModalOrder.depositAmount.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>Potongan Denda (Telat/Rusak):</span>
                  <span className="font-bold">- Rp {(lateFeeInput + damageFeeInput).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-800 pt-1 border-t border-amber-200">
                  <span>Sisa Deposit Dikembalikan:</span>
                  <span className="text-emerald-600 font-extrabold">
                    Rp {Math.max(0, qcModalOrder.depositAmount - (lateFeeInput + damageFeeInput)).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Next Step: Cuci atau Langsung Selesai */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">Tahap Selanjutnya untuk Busana Ini:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNextStageInput('LAUNDRY')}
                    className={`p-2 rounded-lg border text-left font-medium transition-all ${
                      nextStageInput === 'LAUNDRY'
                        ? 'bg-cyan-50 border-cyan-400 text-cyan-900 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block font-bold">🧼 Masuk Cuci & Uap</span>
                    <span className="text-[10px] text-slate-500">Kirim ke antrean laundry butik</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNextStageInput('COMPLETED')}
                    className={`p-2 rounded-lg border text-left font-medium transition-all ${
                      nextStageInput === 'COMPLETED'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block font-bold">✅ Selesai (Langsung Bersih)</span>
                    <span className="text-[10px] text-slate-500">Pakaian langsung masuk hanger display</span>
                  </button>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setQcModalOrder(null)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isProcessingQc}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1 shadow-md"
                >
                  {isProcessingQc ? 'Memproses...' : 'Konfirmasi & Kembalikan Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cetak Resi Thermal & Kontrak Sewa A4 */}
      {selectedOrderForReceipt && (
        <RentalReceiptPrinter
          order={selectedOrderForReceipt}
          onClose={() => setSelectedOrderForReceipt(null)}
        />
      )}

    </div>
  );
};

export default RentalKanbanView;
