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
  Shirt,
  BellRing,
  Coins,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Table,
  LayoutGrid,
  AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import useSocket from '../../hooks/useSocket';
import { toast } from '../../utils/alert';
import { RentalReceiptPrinter } from './RentalReceiptPrinter';
import { RentalCronModal } from './RentalCronModal';
import { RentalSendReminderModal, type RentalOrderReminderTarget } from './RentalSendReminderModal';

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
  { key: 'PICKED_UP', label: '3. Dibawa Klien', color: 'border-indigo-500', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { key: 'RETURNED', label: '4. Kembali (Menunggu QC)', color: 'border-violet-500', badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  { key: 'LAUNDRY', label: '5. Cuci & Uap Sutra', color: 'border-cyan-500', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { key: 'COMPLETED', label: '6. Selesai (Rekonsiliasi)', color: 'border-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
];

export const RentalKanbanView: React.FC = () => {
  const { token } = usePOS();
  const socket = useSocket();
  const navigate = useNavigate();

  // Helper memisahkan catatan jaminan fisik dan membersihkan tag internal
  const parseFittingNotes = (rawNotes?: string | null) => {
    let collateralText = '';
    let cleanNotes = rawNotes || '';
    if (cleanNotes.includes('[Jaminan Fisik:')) {
      const match = cleanNotes.match(/\[Jaminan Fisik:\s*([^\]]+)\]/);
      if (match) {
        collateralText = match[1];
        cleanNotes = cleanNotes.replace(/\[Jaminan Fisik:\s*[^\]]+\]/, '').trim();
      }
    }
    // Bersihkan tag otomatis peringatan jatuh tempo dan riwayat pembatalan
    cleanNotes = cleanNotes
      .replace(/\[OVERDUE_ALERT:[^\]]+\]/g, '')
      .replace(/\[BATAL:[^\]]+\]/g, '')
      .trim();

    return { collateralText, cleanNotes };
  };

  const [orders, setOrders] = useState<RentalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [activeMobileStage, setActiveMobileStage] = useState<RentalOrder['status']>('BOOKED');

  // Inspection & QC Modal State
  const [qcModalOrder, setQcModalOrder] = useState<RentalOrder | null>(null);
  const [attireQcList, setAttireQcList] = useState<Array<{
    id: string;
    name: string;
    code: string;
    rackHangerCode?: string;
    size?: string;
    color?: string;
    checked: boolean;
  }>>([]);
  const [checklist, setChecklist] = useState<Array<{ name: string; checked: boolean }>>([]);
  const [lateFeeInput, setLateFeeInput] = useState<number>(0);
  const [damageFeeInput, setDamageFeeInput] = useState<number>(0);
  const [nextStageInput, setNextStageInput] = useState<'LAUNDRY' | 'COMPLETED'>('COMPLETED');
  const [settleBalance, setSettleBalance] = useState<boolean>(true);
  const [settleAmountInput, setSettleAmountInput] = useState<number>(0);
  const [settlePaymentMethod, setSettlePaymentMethod] = useState<string>('CASH');
  const [isProcessingQc, setIsProcessingQc] = useState(false);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<RentalOrder | null>(null);
  const [cronModalOpen, setCronModalOpen] = useState(false);
  const [selectedReminderOrder, setSelectedReminderOrder] = useState<RentalOrderReminderTarget | null>(null);

  // Modal Pembatalan Kontrak Sewa
  const [cancellingOrder, setCancellingOrder] = useState<RentalOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('Permintaan pembatalan dari pelanggan');
  const [refundPaidInput, setRefundPaidInput] = useState<number>(0);
  const [refundDepositChecked, setRefundDepositChecked] = useState<boolean>(true);
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  const handleOpenCancelModal = (order: RentalOrder) => {
    setCancellingOrder(order);
    setCancelReason('Permintaan pembatalan dari pelanggan');
    setRefundPaidInput(order.paidAmount || 0);
    setRefundDepositChecked(order.depositAmount > 0);
  };

  // View Mode: 'kanban' (Kolom visual) vs 'table' (Tabel operasional cepat & densitas tinggi)
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('rental_view_mode');
      if (saved === 'kanban' || saved === 'table') return saved;
    } catch (e) {}
    return 'kanban';
  });

  const handleSetViewMode = (mode: 'kanban' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem('rental_view_mode', mode);
    } catch (e) {}
  };

  // Table Smart Triage Filter
  type TableFilterType = 'ALL' | 'OVERDUE' | 'TODAY' | 'TOMORROW' | 'PICKED_UP' | 'QC_WAITING' | 'UNPAID';
  const [tableFilter, setTableFilter] = useState<TableFilterType>('ALL');

  // Desktop Column Visibility Filter (Pilihan Menyembunyikan/Menampilkan Antrean)
  const [visibleStages, setVisibleStages] = useState<RentalOrder['status'][]>(() => {
    try {
      const saved = localStorage.getItem('rental_kanban_visible_stages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    // Default tampilkan 5 kolom aktif agar langsung pas di layar web laptop tanpa overflow
    return KANBAN_STAGES.filter(s => s.key !== 'COMPLETED').map(s => s.key);
  });

  useEffect(() => {
    try {
      localStorage.setItem('rental_kanban_visible_stages', JSON.stringify(visibleStages));
    } catch (e) {}
  }, [visibleStages]);

  const toggleStageVisibility = (key: RentalOrder['status']) => {
    setVisibleStages(prev => {
      if (prev.includes(key)) {
        if (prev.length <= 1) {
          toast('Minimal 1 kolom antrean harus tetap tampil di papan.', 'info');
          return prev;
        }
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  const setAllStagesVisible = (showAll: boolean) => {
    if (showAll) {
      setVisibleStages(KANBAN_STAGES.map(s => s.key));
    } else {
      // Sembunyikan COMPLETED (Selesai), tampilkan 5 tahap aktif berjalan saja
      setVisibleStages(KANBAN_STAGES.filter(s => s.key !== 'COMPLETED').map(s => s.key));
    }
  };

  const handleOpenReminder = (order: RentalOrder) => {
    setSelectedReminderOrder({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      returnDeadline: order.returnDeadline,
      pickupDate: order.pickupDate,
      status: order.status,
      totalAmount: order.totalAmount,
      depositAmount: order.depositAmount,
      items: order.items
    });
  };

  // WhatsApp Gateway Status
  const [waStatus, setWaStatus] = useState<{
    status: 'CONNECTED' | 'SCAN_QR' | 'DISCONNECTED' | 'SUSPENDED';
    phoneConnected: string | null;
    monthlyQuota: number;
    usedThisMonth: number;
  } | null>(null);

  const fetchWaStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/whatsapp/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setWaStatus(json.data);
        }
      }
    } catch (e) {
      // silent fail
    }
  }, [token]);

  // Fetch Orders
  const fetchOrders = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      fetchWaStatus();
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
  }, [token, fetchWaStatus]);

  useEffect(() => {
    fetchOrders();
    fetchWaStatus();
  }, [fetchOrders, fetchWaStatus]);

  // Real-time synchronization via Socket.IO
  useEffect(() => {
    if (!socket) return;
    const handleRentalChange = () => {
      fetchOrders();
    };
    socket.on('rental:order_created', handleRentalChange);
    socket.on('rental:order_updated', handleRentalChange);
    socket.on('rental:inventory_updated', handleRentalChange);

    return () => {
      socket.off('rental:order_created', handleRentalChange);
      socket.off('rental:order_updated', handleRentalChange);
      socket.off('rental:inventory_updated', handleRentalChange);
    };
  }, [socket, fetchOrders]);

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

    // 1. Checklist Busana & Pakaian Utama
    if (order.items && Array.isArray(order.items) && order.items.length > 0) {
      setAttireQcList(order.items.map(it => ({
        id: it.id,
        name: it.attireName,
        code: it.attireCode,
        rackHangerCode: it.rackHangerCode,
        size: it.size,
        color: it.color,
        checked: true
      })));
    } else {
      setAttireQcList([]);
    }

    // 2. Checklist Aksesoris
    if (order.accessoryChecklist && Array.isArray(order.accessoryChecklist) && order.accessoryChecklist.length > 0) {
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
    setNextStageInput('COMPLETED'); // Default Selesai (Langsung Bersih)

    // Inisialisasi status pelunasan sewa (untuk klien yang bayar full saat kembali / masih ada sisa DP)
    const unpaid = Math.max(0, order.totalAmount - order.paidAmount);
    setSettleBalance(unpaid > 0);
    setSettleAmountInput(unpaid);
    setSettlePaymentMethod('CASH');
  };

  // Helper Centang Semua QC
  const totalQcItems = attireQcList.length + checklist.length;
  const totalCheckedQcItems = attireQcList.filter(a => a.checked).length + checklist.filter(c => c.checked).length;
  const isAllQcChecked = totalQcItems > 0 && totalCheckedQcItems === totalQcItems;

  const handleToggleCheckAll = (check: boolean) => {
    setAttireQcList(prev => prev.map(a => ({ ...a, checked: check })));
    setChecklist(prev => prev.map(c => ({ ...c, checked: check })));
  };

  // Submit QC & Refund
  const handleSubmitQc = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!qcModalOrder) return;

    setIsProcessingQc(true);
    try {
      const itemConditions = attireQcList.map(a => ({
        itemId: a.id,
        returnCondition: a.checked ? 'GOOD' : 'DAMAGED',
        damageNotes: a.checked ? undefined : 'Tercatat cacat/perlu penanganan saat inspeksi QC'
      }));

      const payload = {
        accessoryChecklist: checklist,
        itemConditions,
        lateFee: lateFeeInput,
        damageFee: damageFeeInput,
        settleBalance: settleBalance && settleAmountInput > 0,
        settleAmount: settleBalance ? settleAmountInput : 0,
        paymentMethod: settlePaymentMethod,
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
        const msg = data.settledAmount > 0
          ? `Inspeksi selesai! Pelunasan sewa diterima: Rp ${data.settledAmount.toLocaleString('id-ID')}. Sisa deposit: Rp ${data.refundAmount?.toLocaleString('id-ID')}`
          : `Inspeksi selesai! Uang deposit yang dikembalikan: Rp ${data.refundAmount?.toLocaleString('id-ID')}`;
        toast(msg, 'success');
        
        // Tampilkan modal cetak Kwitansi Pengembalian Uang Jaminan (Deposit Refund)
        setSelectedOrderForReceipt({
          ...(data.order || qcModalOrder),
          lateFee: lateFeeInput,
          damageFee: damageFeeInput,
          depositRefunded: data.refundAmount,
          settledAmount: data.settledAmount,
          defaultDocType: 'DEPOSIT_REFUND'
        });

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

  // Submit Pembatalan Kontrak Sewa
  const handleConfirmCancel = async () => {
    if (!cancellingOrder || !token) return;
    setIsSubmittingCancel(true);
    try {
      const res = await fetch(`/api/rental/orders/${cancellingOrder.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          reason: cancelReason.trim() || 'Dibatalkan oleh pelanggan',
          refundPaidAmount: refundPaidInput,
          refundDepositAmount: refundDepositChecked ? cancellingOrder.depositAmount : 0,
          paymentMethod: 'CASH'
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast(`Kontrak #${cancellingOrder.orderNumber} berhasil dibatalkan.`, 'success');
        setCancellingOrder(null);
        fetchOrders();
      } else {
        toast(data.error || 'Gagal membatalkan kontrak sewa.', 'error');
      }
    } catch (e: any) {
      toast('Terjadi kesalahan saat membatalkan kontrak sewa.', 'error');
    } finally {
      setIsSubmittingCancel(false);
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

  // Date & Urgency Helpers for Table & Triage
  const now = useMemo(() => new Date(), [orders]);
  const startOfToday = useMemo(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()), [now]);
  const endOfToday = useMemo(() => new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999), [now]);
  const endOfTomorrow = useMemo(() => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999), [now]);

  const isOrderOverdue = useCallback((order: RentalOrder) => {
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') return false;
    return new Date(order.returnDeadline) < now;
  }, [now]);

  const isOrderDueToday = useCallback((order: RentalOrder) => {
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') return false;
    const d = new Date(order.returnDeadline);
    return d >= startOfToday && d <= endOfToday;
  }, [startOfToday, endOfToday]);

  const isOrderDueTomorrow = useCallback((order: RentalOrder) => {
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') return false;
    const d = new Date(order.returnDeadline);
    return d > endOfToday && d <= endOfTomorrow;
  }, [endOfToday, endOfTomorrow]);

  // Metric counts for Smart Triage
  const overdueCount = useMemo(() => filteredOrders.filter(isOrderOverdue).length, [filteredOrders, isOrderOverdue]);
  const dueTodayCount = useMemo(() => filteredOrders.filter(isOrderDueToday).length, [filteredOrders, isOrderDueToday]);
  const dueTomorrowCount = useMemo(() => filteredOrders.filter(isOrderDueTomorrow).length, [filteredOrders, isOrderDueTomorrow]);
  const pickedUpCount = useMemo(() => filteredOrders.filter(o => o.status === 'PICKED_UP').length, [filteredOrders]);
  const qcWaitingCount = useMemo(() => filteredOrders.filter(o => o.status === 'RETURNED').length, [filteredOrders]);
  const unpaidCount = useMemo(() => filteredOrders.filter(o => (o.totalAmount - o.paidAmount) > 0 && o.status !== 'CANCELLED').length, [filteredOrders]);
  const activeCount = useMemo(() => filteredOrders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED').length, [filteredOrders]);

  // Filtered orders for Table view
  const tableFilteredOrders = useMemo(() => {
    return filteredOrders.filter(order => {
      if (tableFilter === 'ALL') return true;
      if (tableFilter === 'OVERDUE') return isOrderOverdue(order);
      if (tableFilter === 'TODAY') return isOrderDueToday(order);
      if (tableFilter === 'TOMORROW') return isOrderDueTomorrow(order);
      if (tableFilter === 'PICKED_UP') return order.status === 'PICKED_UP';
      if (tableFilter === 'QC_WAITING') return order.status === 'RETURNED';
      if (tableFilter === 'UNPAID') return (order.totalAmount - order.paidAmount) > 0 && order.status !== 'CANCELLED';
      return true;
    });
  }, [filteredOrders, tableFilter, isOrderOverdue, isOrderDueToday, isOrderDueTomorrow]);

  // Sorted orders: Overdue first, Due today next, then soonest return deadline, completed last
  const sortedTableOrders = useMemo(() => {
    return [...tableFilteredOrders].sort((a, b) => {
      const aOverdue = isOrderOverdue(a);
      const bOverdue = isOrderOverdue(b);
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      const aDueToday = isOrderDueToday(a);
      const bDueToday = isOrderDueToday(b);
      if (aDueToday && !bDueToday) return -1;
      if (!aDueToday && bDueToday) return 1;

      const aDone = a.status === 'COMPLETED' || a.status === 'CANCELLED';
      const bDone = b.status === 'COMPLETED' || b.status === 'CANCELLED';
      if (!aDone && bDone) return -1;
      if (aDone && !bDone) return 1;

      return new Date(a.returnDeadline).getTime() - new Date(b.returnDeadline).getTime();
    });
  }, [tableFilteredOrders, isOrderOverdue, isOrderDueToday]);

  const renderUrgencyBadge = (order: RentalOrder) => {
    if (order.status === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
          <CheckCircle2 size={12} /> Dikembalikan
        </span>
      );
    }
    if (order.status === 'CANCELLED') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
          Batal
        </span>
      );
    }

    const d = new Date(order.returnDeadline);
    const diffDays = Math.ceil((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

    if (isOrderOverdue(order)) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-black text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-200">
          <AlertTriangle size={12} className="text-rose-600 animate-pulse" />
          Telat {diffDays} Hari
        </span>
      );
    }

    if (isOrderDueToday(order)) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-300">
          <Clock size={12} className="text-amber-600" />
          Hari Ini ({d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})
        </span>
      );
    }

    if (isOrderDueTomorrow(order)) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-200">
          <Clock size={12} className="text-sky-600" />
          Besok
        </span>
      );
    }

    const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
        <Calendar size={11} className="text-slate-400" />
        H-{daysLeft} Hari
      </span>
    );
  };

  // Helper render order card (shared between Mobile & Desktop)
  const renderOrderCard = (order: RentalOrder) => {
    const eventDateStr = new Date(order.eventDate).toLocaleDateString('id-ID', { dateStyle: 'medium' });
    const returnDeadlineStr = new Date(order.returnDeadline).toLocaleDateString('id-ID', { dateStyle: 'short' });
    const isOverdue = order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && new Date(order.returnDeadline) < new Date();

    // Parse collateral and fitting notes separately
    const { collateralText, cleanNotes: notesText } = parseFittingNotes(order.fittingNotes);

    return (
      <div
        key={order.id}
        className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 shadow-xs hover:shadow-md transition-all space-y-3"
      >
        {/* Order Header: OrderNo & Payment Status */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/60">
              #{order.orderNumber}
            </span>
            <button
              type="button"
              onClick={() => setSelectedOrderForReceipt(order)}
              title="Cetak Struk / Kontrak Sewa"
              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 border border-slate-200/60 transition-colors cursor-pointer"
            >
              <Printer size={13} />
            </button>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
            order.paymentStatus === 'FULL_PAID'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : order.paidAmount === 0
              ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
              : 'bg-amber-100 text-amber-800 border border-amber-200'
          }`}>
            {order.paymentStatus === 'FULL_PAID' 
              ? 'Lunas' 
              : order.paidAmount === 0 
              ? 'Bayar Saat Kembali' 
              : `DP (Sisa Rp ${(order.totalAmount - order.paidAmount).toLocaleString('id-ID')})`}
          </span>
        </div>

        {/* Customer Info */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-black text-slate-900 text-sm truncate">{order.customerName}</div>
            {order.customerPhone && (
              <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-medium">
                <Phone size={12} className="text-slate-400 shrink-0" />
                <span className="truncate">{order.customerPhone}</span>
              </div>
            )}
          </div>
          {order.customerPhone && (
            <button
              type="button"
              onClick={() => handleOpenReminder(order)}
              title="Kirim Pengingat WhatsApp"
              className="px-2.5 py-1.5 rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all flex items-center gap-1 text-xs font-bold cursor-pointer shrink-0 active:scale-95 shadow-2xs"
            >
              <MessageSquare size={12} />
              <span>WA</span>
            </button>
          )}
        </div>

        {/* Items Preview */}
        <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1.5">
          {order.items.map((it, idx) => (
            <div key={it.id || idx} className="text-xs text-slate-700 flex items-center justify-between gap-2">
              <span className="font-semibold truncate">• {it.attireName}</span>
              <span className="font-mono font-bold text-[10px] text-amber-900 bg-amber-100/70 px-1.5 py-0.5 rounded border border-amber-200/50 shrink-0">
                {it.rackHangerCode || it.attireCode}
              </span>
            </div>
          ))}
        </div>

        {/* Event Date & Return Deadline */}
        <div className="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-slate-100">
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
            <span className="text-slate-400 text-[10px] font-bold uppercase block flex items-center gap-1">
              <Calendar size={11} className="text-slate-400" /> Tgl Acara
            </span>
            <span className="font-bold text-slate-800 text-[11px] block mt-0.5">{eventDateStr}</span>
          </div>
          <div className={`p-2 rounded-xl border ${
            isOverdue 
              ? 'bg-rose-50 border-rose-200 text-rose-900' 
              : 'bg-amber-50/60 border-amber-100 text-amber-900'
          }`}>
            <span className={`text-[10px] font-bold uppercase block flex items-center gap-1 ${
              isOverdue ? 'text-rose-600' : 'text-amber-700'
            }`}>
              <Clock size={11} /> Batas Kembali
            </span>
            <span className="font-bold text-[11px] block mt-0.5">
              {returnDeadlineStr}
              {isOverdue && <span className="ml-1 text-[9px] font-black bg-rose-200 text-rose-900 px-1 py-0.2 rounded">Terlambat</span>}
            </span>
          </div>
        </div>

        {/* Deposit & Collateral Badges */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {order.depositAmount > 0 && (
            <div className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-900 font-bold">
              <Coins size={12} className="text-amber-600" />
              <span>Deposit: Rp {order.depositAmount.toLocaleString('id-ID')}</span>
            </div>
          )}

          {collateralText && (
            <div className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200/70 text-blue-900 font-bold">
              <ShieldCheck size={12} className="text-blue-600" />
              <span>Jaminan: {collateralText}</span>
            </div>
          )}
        </div>

        {/* Fitting / Permak Notes */}
        {notesText && (
          <div className="text-[11px] text-purple-800 bg-purple-50/70 p-2 rounded-xl border border-purple-200/60 flex items-start gap-1.5">
            <Scissors size={13} className="shrink-0 mt-0.5 text-purple-600" />
            <span className="line-clamp-2">{notesText}</span>
          </div>
        )}

        {/* Stage Specific Action Buttons */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          {order.status === 'BOOKED' && (
            <div className="w-full flex items-center gap-1.5">
              <button
                onClick={() => handleQuickAdvance(order.id, 'FITTING')}
                className="flex-1 py-2.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                <Scissors size={14} />
                <span>Masuk Fitting &amp; Permak</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenCancelModal(order)}
                className="px-2.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer active:scale-95 transition-all shrink-0"
                title="Batalkan Kontrak Sewa"
              >
                Batal
              </button>
            </div>
          )}

          {order.status === 'FITTING' && (
            <div className="w-full flex items-center gap-1.5">
              <button
                onClick={() => handleQuickAdvance(order.id, 'PICKED_UP')}
                className="flex-1 py-2.5 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                <CheckCircle2 size={14} />
                <span>Busana Diambil Klien</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenCancelModal(order)}
                className="px-2.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer active:scale-95 transition-all shrink-0"
                title="Batalkan Kontrak Sewa"
              >
                Batal
              </button>
            </div>
          )}

          {order.status === 'PICKED_UP' && (
            <div className="w-full flex flex-col gap-1.5">
              <button
                onClick={() => handleOpenQcModal(order)}
                className="w-full py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                <ShieldCheck size={14} />
                <span>Inspeksi QC &amp; Refund</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickAdvance(order.id, 'RETURNED')}
                className="w-full py-1.5 rounded-lg text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
                title="Baju tiba di sanggar, menunggu giliran dicek oleh staf QC"
              >
                <Clock size={12} />
                <span>Tandai Kembali (Antre QC)</span>
              </button>
            </div>
          )}

          {order.status === 'RETURNED' && (
            <button
              onClick={() => handleOpenQcModal(order)}
              className="w-full py-2.5 rounded-xl text-xs font-black bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
            >
              <ShieldCheck size={14} />
              <span>Mulai Inspeksi QC &amp; Refund</span>
            </button>
          )}

          {order.status === 'LAUNDRY' && (
            <button
              onClick={() => handleQuickAdvance(order.id, 'COMPLETED')}
              className="w-full py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
            >
              <CheckCircle2 size={14} />
              <span>Cuci Selesai (Kembali ke Rak)</span>
            </button>
          )}

          {order.status === 'COMPLETED' && (
            <span className="text-xs text-emerald-700 font-bold flex items-center justify-center gap-1.5 mx-auto py-1">
              <Check size={14} />
              <span>Selesai &amp; Rekonsiliasi Tutup</span>
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-100">
      
      {/* ─── TOP ACTION BAR (RESPONSIVE) ──────────────────────────────────── */}
      <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
        <div>
          <h1 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
            <Layers className="text-indigo-600" size={19} />
            Papan Operasional Sewa Busana
          </h1>
          <p className="text-[11px] text-slate-500 hidden sm:block">
            {viewMode === 'kanban'
              ? 'Lacak siklus busana visual: Booked ➔ Fitting ➔ Diambil ➔ Kembali ➔ Cuci ➔ Selesai'
              : 'Tabel triase berkecepatan tinggi dengan indikator urgensi & pengembalian otomatis'}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          {/* View Mode Toggle: Kanban vs Table Operasional */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => handleSetViewMode('kanban')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-white text-indigo-900 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tampilan Papan Kanban Visual"
            >
              <LayoutGrid size={13} />
              <span className="hidden xs:inline">Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('table')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-indigo-900 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tampilan Tabel Operasional Cepat & Triase"
            >
              <Table size={13} />
              <span className="hidden xs:inline">Tabel Cepat</span>
            </button>
          </div>

          <div className="relative flex-1 sm:w-52 min-w-[140px]">
            <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Cari nama, nota, baju..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          <button
            onClick={fetchOrders}
            className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shrink-0 cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>

          {/* WhatsApp Gateway Status Indicator Badge */}
          <button
            type="button"
            onClick={() => navigate('/settings')}
            title={
              waStatus?.status === 'CONNECTED'
                ? `WhatsApp Gateway Aktif (${waStatus.phoneConnected ? '+' + waStatus.phoneConnected : 'Online'}) • Kuota: ${waStatus.usedThisMonth}/${waStatus.monthlyQuota} pesan. Klik untuk kelola.`
                : waStatus?.status === 'SCAN_QR'
                ? 'WhatsApp butuh Scan QR. Klik untuk buka QR scanner di menu Pengaturan.'
                : 'WhatsApp Gateway belum terhubung. Klik untuk hubungkan WhatsApp toko Anda di menu Pengaturan.'
            }
            className={`px-2.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all shrink-0 cursor-pointer ${
              waStatus?.status === 'CONNECTED'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-2xs'
                : waStatus?.status === 'SCAN_QR'
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 animate-pulse shadow-2xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              waStatus?.status === 'CONNECTED'
                ? 'bg-emerald-500 ring-2 ring-emerald-200 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
                : waStatus?.status === 'SCAN_QR'
                ? 'bg-amber-500 ring-2 ring-amber-200 animate-ping'
                : 'bg-slate-400'
            }`} />
            <MessageSquare size={13} className={waStatus?.status === 'CONNECTED' ? 'text-emerald-600' : 'text-slate-400'} />
            <span className="hidden sm:inline font-bold">
              {waStatus?.status === 'CONNECTED'
                ? 'WA Online'
                : waStatus?.status === 'SCAN_QR'
                ? 'Scan QR WA'
                : 'WA Offline'}
            </span>
          </button>

          <button
            onClick={() => setCronModalOpen(true)}
            className="px-3 py-1.5 sm:py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all shrink-0 cursor-pointer"
            title="Pindai & kirim WhatsApp reminder otomatis"
          >
            <BellRing size={13} />
            <span className="hidden xs:inline sm:inline">Auto-Reminder</span>
            <span className="xs:hidden">WA</span>
          </button>

          <button
            onClick={() => navigate('/pos')}
            className="px-3.5 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all shrink-0 cursor-pointer active:scale-95"
          >
            <Plus size={14} />
            <span>Booking</span>
          </button>
        </div>
      </div>

      {/* ─── KANBAN VIEW MODE ────────────────────────────────────────────── */}
      {viewMode === 'kanban' && (
        <>
          {/* ─── DESKTOP STAGE COLUMN TOGGLE BAR (hidden md:flex) ─────────────── */}
          <div className="hidden md:flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 gap-3 text-xs shrink-0 shadow-2xs">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-1">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 shrink-0 uppercase tracking-wider">
                <SlidersHorizontal size={13} className="text-indigo-600" />
                Kolom Antrean:
              </span>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1 shrink-0 pr-2 border-r border-slate-200">
                <button
                  type="button"
                  onClick={() => setAllStagesVisible(false)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    visibleStages.length === 5 && !visibleStages.includes('COMPLETED')
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                  title="Sembunyikan kolom pesanan selesai agar 5 kolom aktif pas di layar tanpa overflow"
                >
                  Aktif Saja (5)
                </button>
                <button
                  type="button"
                  onClick={() => setAllStagesVisible(true)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                    visibleStages.length === KANBAN_STAGES.length
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Semua (6)
                </button>
              </div>

              {/* Stage Checkbox Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {KANBAN_STAGES.map(stage => {
                  const isVisible = visibleStages.includes(stage.key);
                  const count = filteredOrders.filter(o => o.status === stage.key).length;
                  const shortName = stage.label.replace(/^\d+\.\s*/, '');
                  return (
                    <button
                      key={stage.key}
                      type="button"
                      onClick={() => toggleStageVisibility(stage.key)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                        isVisible
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-950 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 opacity-60'
                      }`}
                      title={isVisible ? `Klik untuk sembunyikan kolom ${stage.label}` : `Klik untuk tampilkan kolom ${stage.label}`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-black ${
                        isVisible ? 'bg-indigo-600 text-white' : 'border border-slate-300 text-transparent'
                      }`}>
                        {isVisible ? '✓' : ''}
                      </span>
                      <span>{shortName}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        isVisible ? 'bg-indigo-100 text-indigo-900 font-black' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Counter & Reset */}
            <div className="flex items-center gap-2 shrink-0 text-slate-500 text-[11px]">
              <span>
                Tampil: <strong className="text-slate-800">{visibleStages.length}</strong>/6 Kolom
              </span>
              {visibleStages.length < 6 && (
                <button
                  type="button"
                  onClick={() => setAllStagesVisible(true)}
                  className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                >
                  Reset Semua
                </button>
              )}
            </div>
          </div>

          {/* ─── MOBILE STAGE SWITCHER TABS (md:hidden) ───────────────────────── */}
          <div className="md:hidden px-3 py-2 bg-white border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 shadow-2xs">
            {KANBAN_STAGES.map(stage => {
              const count = filteredOrders.filter(o => o.status === stage.key).length;
              const isSelected = activeMobileStage === stage.key;
              const shortLabel = stage.label.replace(/^\d+\.\s*/, '');
              return (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() => setActiveMobileStage(stage.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs ring-2 ring-indigo-500/40'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span>{shortLabel}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : count > 0 
                      ? 'bg-indigo-100 text-indigo-900' 
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ─── MOBILE VIEW CONTAINER (md:hidden) ────────────────────────────── */}
          <div className="md:hidden flex-1 overflow-y-auto p-3.5 space-y-3 pb-28">
            {(() => {
              const currentStage = KANBAN_STAGES.find(s => s.key === activeMobileStage) || KANBAN_STAGES[0];
              const stageOrders = filteredOrders.filter(o => o.status === currentStage.key);
              
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wide">
                      {currentStage.label}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${currentStage.badge}`}>
                      {stageOrders.length} Pesanan
                    </span>
                  </div>

                  {stageOrders.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto">
                        <Layers size={24} />
                      </div>
                      <div className="text-xs font-bold text-slate-700">Tidak ada pesanan di tahap ini</div>
                      <p className="text-[11px] text-slate-400">
                        Gunakan tombol booking untuk mencatat kontrak sewa baru
                      </p>
                      <button
                        onClick={() => navigate('/pos')}
                        className="mt-2 px-4 py-2 bg-indigo-900 hover:bg-slate-900 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Plus size={14} /> Buat Booking Baru
                      </button>
                    </div>
                  ) : (
                    stageOrders.map(order => renderOrderCard(order))
                  )}
                </div>
              );
            })()}
          </div>

          {/* ─── DESKTOP KANBAN BOARD COLUMNS (hidden md:flex) ────────────────── */}
          <div className="hidden md:flex flex-1 overflow-x-auto p-3 sm:p-4 gap-3.5 scrollbar-thin scrollbar-thumb-indigo-200 hover:scrollbar-thumb-indigo-400 scrollbar-track-slate-100">
            {KANBAN_STAGES.filter(stage => visibleStages.includes(stage.key)).map(stage => {
              const stageOrders = filteredOrders.filter(o => o.status === stage.key);
              return (
                <div 
                  key={stage.key}
                  className="flex-1 min-w-[210px] max-w-sm flex flex-col bg-slate-50/90 rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all duration-200"
                >
                  {/* Column Header */}
                  <div className={`p-2.5 sm:p-3 bg-white border-b-2 ${stage.color} flex items-center justify-between shrink-0`}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-extrabold text-xs text-slate-800 truncate">{stage.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${stage.badge}`}>
                        {stageOrders.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleStageVisibility(stage.key)}
                        className="w-5 h-5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                        title={`Sembunyikan kolom ${stage.label}`}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Column Cards Container */}
                  <div className="flex-1 p-2.5 overflow-y-auto space-y-2.5">
                    {stageOrders.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-xs font-medium border border-dashed border-slate-200 rounded-xl">
                        Tidak ada pesanan di tahap ini
                      </div>
                    ) : (
                      stageOrders.map(order => renderOrderCard(order))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ─── TABLE VIEW MODE (TRIAGE STRIP & OPERATIONAL TABLE) ───────────── */}
      {viewMode === 'table' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 1. Mini KPI Triage Metrics Strip & Filter Pills */}
          <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2.5 shrink-0 space-y-2.5 shadow-2xs">
            {/* Mini KPI Triage Metrics Strip */}
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-6 gap-2">
              <button
                type="button"
                onClick={() => setTableFilter('ALL')}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  tableFilter === 'ALL'
                    ? 'bg-indigo-50/90 border-indigo-300 ring-2 ring-indigo-400/40 shadow-2xs'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Aktif</div>
                <div className="text-base font-black text-slate-900 mt-0.5">{activeCount}</div>
              </button>

              <button
                type="button"
                onClick={() => setTableFilter('OVERDUE')}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  tableFilter === 'OVERDUE'
                    ? 'bg-rose-100 border-rose-300 ring-2 ring-rose-400/40 shadow-2xs'
                    : overdueCount > 0
                    ? 'bg-rose-50/90 border-rose-200 hover:bg-rose-100/60'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  Telat Kembali
                </div>
                <div className="text-base font-black text-rose-700 mt-0.5">{overdueCount}</div>
              </button>

              <button
                type="button"
                onClick={() => setTableFilter('TODAY')}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  tableFilter === 'TODAY'
                    ? 'bg-amber-100 border-amber-300 ring-2 ring-amber-400/40 shadow-2xs'
                    : dueTodayCount > 0
                    ? 'bg-amber-50/90 border-amber-200 hover:bg-amber-100/60'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Hari Ini</div>
                <div className="text-base font-black text-amber-800 mt-0.5">{dueTodayCount}</div>
              </button>

              <button
                type="button"
                onClick={() => setTableFilter('PICKED_UP')}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  tableFilter === 'PICKED_UP'
                    ? 'bg-indigo-100 border-indigo-300 ring-2 ring-indigo-400/40 shadow-2xs'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Di Klien</div>
                <div className="text-base font-black text-indigo-900 mt-0.5">{pickedUpCount}</div>
              </button>

              <button
                type="button"
                onClick={() => setTableFilter('QC_WAITING')}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  tableFilter === 'QC_WAITING'
                    ? 'bg-violet-100 border-violet-300 ring-2 ring-violet-400/40 shadow-2xs'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="text-[10px] font-bold text-violet-700 uppercase tracking-wider">Menunggu QC</div>
                <div className="text-base font-black text-violet-900 mt-0.5">{qcWaitingCount}</div>
              </button>

              <button
                type="button"
                onClick={() => setTableFilter('UNPAID')}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  tableFilter === 'UNPAID'
                    ? 'bg-orange-100 border-orange-300 ring-2 ring-orange-400/40 shadow-2xs'
                    : unpaidCount > 0
                    ? 'bg-orange-50/90 border-orange-200 hover:bg-orange-100/60'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="text-[10px] font-bold text-orange-700 uppercase tracking-wider">Ada Sisa DP</div>
                <div className="text-base font-black text-orange-800 mt-0.5">{unpaidCount}</div>
              </button>
            </div>

            {/* Filter Pills Bar */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none pt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
                  Filter Cepat:
                </span>
                {[
                  { id: 'ALL', label: 'Semua', count: filteredOrders.length },
                  { id: 'OVERDUE', label: '🔴 Telat', count: overdueCount },
                  { id: 'TODAY', label: '🟡 Hari Ini', count: dueTodayCount },
                  { id: 'TOMORROW', label: '🟢 Besok', count: dueTomorrowCount },
                  { id: 'PICKED_UP', label: '👗 Di Klien', count: pickedUpCount },
                  { id: 'QC_WAITING', label: '🔍 Cek QC', count: qcWaitingCount },
                  { id: 'UNPAID', label: '💰 Sisa DP', count: unpaidCount }
                ].map(tab => {
                  const isSelected = tableFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTableFilter(tab.id as TableFilterType)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        isSelected ? 'bg-white/20 text-white font-black' : 'bg-slate-200 text-slate-600 font-bold'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="text-[11px] text-slate-500 font-medium shrink-0 ml-auto hidden sm:block">
                Menampilkan <strong className="text-slate-800">{sortedTableOrders.length}</strong> pesanan
              </div>
            </div>
          </div>

          {/* 2. Main Content: Empty State OR Desktop Table / Mobile Cards */}
          <div className="flex-1 overflow-hidden p-3 sm:p-4 flex flex-col">
            {sortedTableOrders.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <Table size={28} />
                </div>
                <div className="text-sm font-bold text-slate-800">Tidak ada data sewa pada filter ini</div>
                <p className="text-xs text-slate-400 max-w-sm">
                  {tableFilter !== 'ALL'
                    ? 'Coba pilih filter lain atau klik tombol di bawah untuk menampilkan seluruh pesanan.'
                    : 'Belum ada transaksi sewa busana yang tercatat di sistem.'}
                </p>
                {tableFilter !== 'ALL' && (
                  <button
                    onClick={() => setTableFilter('ALL')}
                    className="mt-2 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Tampilkan Semua Data
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* 2a. DESKTOP HIGH-DENSITY DATA TABLE (hidden on mobile, visible md:flex) */}
                <div className="hidden md:flex flex-1 bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex-col">
                  <div className="flex-1 overflow-x-auto overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50/95 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-wider backdrop-blur-xs">
                        <tr>
                          <th className="py-3 px-3.5 whitespace-nowrap">Nota &amp; Waktu</th>
                          <th className="py-3 px-3.5 whitespace-nowrap">Klien &amp; Kontak</th>
                          <th className="py-3 px-3.5 min-w-[200px]">Busana &amp; No. Hanger</th>
                          <th className="py-3 px-3.5 whitespace-nowrap">Tgl Acara ➔ Batas Kembali</th>
                          <th className="py-3 px-3.5 whitespace-nowrap">Biaya &amp; Jaminan</th>
                          <th className="py-3 px-3.5 whitespace-nowrap">Status Tahapan</th>
                          <th className="py-3 px-3.5 whitespace-nowrap text-right">Aksi Operasional</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortedTableOrders.map((order) => {
                          const eventDateStr = new Date(order.eventDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                          const returnDateObj = new Date(order.returnDeadline);
                          const returnDateStr = returnDateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                          const returnTimeStr = returnDateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

                          const { collateralText, cleanNotes: notesText } = parseFittingNotes(order.fittingNotes);

                          const stageInfo = KANBAN_STAGES.find(s => s.key === order.status) || {
                            key: order.status,
                            label: order.status,
                            color: 'border-slate-400',
                            badge: 'bg-slate-50 text-slate-700 border-slate-200'
                          };

                          const overdue = isOrderOverdue(order);
                          const dueToday = isOrderDueToday(order);

                          return (
                            <tr
                              key={order.id}
                              className={`hover:bg-slate-50/80 transition-colors ${
                                overdue
                                  ? 'bg-rose-50/30'
                                  : dueToday
                                  ? 'bg-amber-50/30'
                                  : ''
                              }`}
                            >
                              {/* 1. Nota & Waktu */}
                              <td className="py-3 px-3.5 align-top whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/80">
                                    #{order.orderNumber}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedOrderForReceipt(order)}
                                    title="Cetak Struk / Kontrak Sewa"
                                    className="p-1 rounded-md text-slate-400 hover:text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer"
                                  >
                                    <Printer size={13} />
                                  </button>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1">
                                  {new Date(order.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                </div>
                                {notesText && (
                                  <div
                                    className="mt-1 inline-flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/60 max-w-[140px] truncate"
                                    title={notesText}
                                  >
                                    <Scissors size={10} className="shrink-0" />
                                    <span className="truncate">{notesText}</span>
                                  </div>
                                )}
                              </td>

                              {/* 2. Klien & Kontak */}
                              <td className="py-3 px-3.5 align-top">
                                <div className="font-bold text-slate-900 text-xs">
                                  {order.customerName}
                                </div>
                                {order.customerPhone ? (
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenReminder(order)}
                                      title="Kirim Pengingat WhatsApp"
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 transition-colors cursor-pointer"
                                    >
                                      <MessageSquare size={10} />
                                      <span>{order.customerPhone}</span>
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400">-</span>
                                )}
                                {order.eventLocation && (
                                  <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]" title={order.eventLocation}>
                                    📍 {order.eventLocation}
                                  </div>
                                )}
                              </td>

                              {/* 3. Busana & No. Hanger */}
                              <td className="py-3 px-3.5 align-top">
                                <div className="space-y-1">
                                  {order.items.map((it, idx) => (
                                    <div key={it.id || idx} className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold text-slate-800 text-[11px]">
                                        {it.attireName}
                                      </span>
                                      <span className="font-mono text-[10px] font-bold text-amber-900 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/70 shrink-0">
                                        🏷️ {it.rackHangerCode || it.attireCode}
                                      </span>
                                      {it.size && (
                                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1 rounded">
                                          {it.size}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </td>

                              {/* 4. Tgl Acara ➔ Batas Kembali & Urgensi */}
                              <td className="py-3 px-3.5 align-top whitespace-nowrap">
                                <div className="text-[11px] text-slate-600 font-medium">
                                  Acara: <strong className="text-slate-900">{eventDateStr}</strong>
                                </div>
                                <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                                  Kembali: <strong className="text-slate-900">{returnDateStr} {returnTimeStr}</strong>
                                </div>
                                <div className="mt-1.5">
                                  {renderUrgencyBadge(order)}
                                </div>
                              </td>

                              {/* 5. Biaya & Jaminan */}
                              <td className="py-3 px-3.5 align-top whitespace-nowrap">
                                <div className="font-extrabold text-slate-900 text-xs">
                                  Rp {order.totalAmount.toLocaleString('id-ID')}
                                </div>
                                <div className="mt-0.5">
                                  {order.paymentStatus === 'FULL_PAID' ? (
                                    <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                      ✓ Lunas
                                    </span>
                                  ) : order.paidAmount === 0 ? (
                                    <span className="text-[10px] font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                                      Bayar Saat Kembali
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                      Sisa: Rp {(order.totalAmount - order.paidAmount).toLocaleString('id-ID')}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 flex-wrap mt-1">
                                  {order.depositAmount > 0 && (
                                    <span className="text-[10px] font-bold text-amber-900 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/70 inline-flex items-center gap-0.5">
                                      <Coins size={10} className="text-amber-600" />
                                      Dep: Rp {order.depositAmount.toLocaleString('id-ID')}
                                    </span>
                                  )}
                                  {collateralText && (
                                    <span className="text-[10px] font-bold text-blue-900 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200/70 inline-flex items-center gap-0.5">
                                      <ShieldCheck size={10} className="text-blue-600" />
                                      {collateralText}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 6. Status Tahapan */}
                              <td className="py-3 px-3.5 align-top whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold border ${stageInfo.badge}`}>
                                  {stageInfo.label}
                                </span>
                              </td>

                              {/* 7. Aksi Cepat Operasional */}
                              <td className="py-3 px-3.5 align-top whitespace-nowrap text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {order.status === 'BOOKED' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleQuickAdvance(order.id, 'FITTING')}
                                        className="px-3 py-1.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white shadow-2xs cursor-pointer active:scale-95 transition-all inline-flex items-center gap-1"
                                      >
                                        <Scissors size={12} />
                                        <span>Fitting</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenCancelModal(order)}
                                        className="px-2 py-1.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer active:scale-95 transition-all"
                                        title="Batalkan Kontrak"
                                      >
                                        Batal
                                      </button>
                                    </>
                                  )}

                                  {order.status === 'FITTING' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleQuickAdvance(order.id, 'PICKED_UP')}
                                        className="px-3 py-1.5 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-2xs cursor-pointer active:scale-95 transition-all inline-flex items-center gap-1"
                                      >
                                        <CheckCircle2 size={12} />
                                        <span>Ambil Busana</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenCancelModal(order)}
                                        className="px-2 py-1.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer active:scale-95 transition-all"
                                        title="Batalkan Kontrak"
                                      >
                                        Batal
                                      </button>
                                    </>
                                  )}

                                  {order.status === 'PICKED_UP' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenQcModal(order)}
                                        className="px-3 py-1.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs cursor-pointer active:scale-95 transition-all inline-flex items-center gap-1"
                                      >
                                        <ShieldCheck size={12} />
                                        <span>Terima &amp; QC</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleQuickAdvance(order.id, 'RETURNED')}
                                        className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 cursor-pointer active:scale-95 transition-all"
                                        title="Tandai baju sudah kembali, antre QC"
                                      >
                                        Antre QC
                                      </button>
                                    </>
                                  )}

                                  {order.status === 'RETURNED' && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenQcModal(order)}
                                      className="px-3 py-1.5 rounded-xl text-xs font-black bg-violet-600 hover:bg-violet-700 text-white shadow-2xs cursor-pointer active:scale-95 transition-all inline-flex items-center gap-1"
                                    >
                                      <ShieldCheck size={12} />
                                      <span>Mulai QC &amp; Refund</span>
                                    </button>
                                  )}

                                  {order.status === 'LAUNDRY' && (
                                    <button
                                      type="button"
                                      onClick={() => handleQuickAdvance(order.id, 'COMPLETED')}
                                      className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer active:scale-95 transition-all inline-flex items-center gap-1"
                                    >
                                      <CheckCircle2 size={12} />
                                      <span>Selesai Cuci</span>
                                    </button>
                                  )}

                                  {order.status === 'COMPLETED' && (
                                    <span className="text-xs text-emerald-700 font-bold inline-flex items-center gap-1 px-2 py-1">
                                      <Check size={14} />
                                      <span>Selesai</span>
                                    </span>
                                  )}

                                  {order.customerPhone && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenReminder(order)}
                                      title="Kirim Pengingat WhatsApp"
                                      className="p-1.5 rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                                    >
                                      <MessageSquare size={13} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2b. MOBILE HIGH-DENSITY TRIAGE LIST (visible md:hidden) */}
                <div className="md:hidden flex-1 overflow-y-auto space-y-3 pb-24">
                  {sortedTableOrders.map((order) => renderOrderCard(order))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL QC INSPECTION & REFUND DEPOSIT (TRUE FULL PAGE ON MOBILE) ───── */}
      {qcModalOrder && (
        <div className="fixed inset-0 z-50 bg-white sm:bg-slate-950/70 sm:backdrop-blur-xs flex flex-col sm:items-center sm:justify-center sm:p-4 overflow-hidden">
          <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-3xl flex flex-col shadow-2xl sm:border sm:border-slate-200 overflow-hidden animate-in fade-in duration-200">
            
            {/* Modal Header (Pinned Top with Deep Royal Indigo) */}
            <div className="p-4 sm:p-5 border-b border-indigo-800 flex items-center justify-between bg-indigo-700 text-white shrink-0 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 text-white flex items-center justify-center shrink-0 border border-white/20">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-white leading-tight">
                    Inspeksi Pengembalian &amp; Rekonsiliasi Jaminan
                  </h3>
                  <p className="text-xs text-indigo-100 font-medium">
                    Nota #{qcModalOrder.orderNumber} • {qcModalOrder.customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQcModalOrder(null)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Tutup Modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs flex flex-col">
              
              {/* Quick Action Bar: Summary Count & Centang Semua Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 bg-slate-50 border border-slate-200/90 rounded-2xl">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${isAllQcChecked ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-600'}`} />
                  <span className="text-xs font-bold text-slate-800">
                    Status QC: <strong className="text-indigo-950 font-black">{totalCheckedQcItems}</strong> dari {totalQcItems} Item Terverifikasi
                  </span>
                  {isAllQcChecked ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Semua Lengkap &amp; Bersih
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      {totalQcItems - totalCheckedQcItems} Belum Centang
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => handleToggleCheckAll(true)}
                    className="px-3 py-1.5 rounded-xl font-black text-[11px] bg-slate-900 hover:bg-indigo-950 text-white flex items-center gap-1.5 transition-all active:scale-95 shadow-xs cursor-pointer"
                  >
                    <Check size={13} className="stroke-[3]" />
                    <span>Centang Semua</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleCheckAll(false)}
                    className="px-2.5 py-1.5 rounded-xl font-bold text-[11px] bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                  >
                    <X size={13} />
                    <span>Hapus Semua</span>
                  </button>
                </div>
              </div>

              {/* 1. Checklist Busana & Pakaian Utama */}
              {attireQcList.length > 0 && (
                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/90 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                      <Shirt size={14} className="text-indigo-600" />
                      <span>Busana &amp; Pakaian Utama ({attireQcList.length} Set):</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">Centang jika kondisi baik &amp; utuh</span>
                  </div>

                  <div className="space-y-1.5">
                    {attireQcList.map((item, idx) => (
                      <label 
                        key={item.id || idx} 
                        className={`flex items-center justify-between gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                          item.checked 
                            ? 'bg-white border-slate-200/90 hover:border-indigo-300 shadow-2xs' 
                            : 'bg-rose-50/80 border-rose-200 text-rose-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={(e) => {
                              const updated = [...attireQcList];
                              updated[idx].checked = e.target.checked;
                              setAttireQcList(updated);
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <span className={`text-xs font-bold block truncate ${item.checked ? 'text-slate-800' : 'text-rose-700 font-extrabold'}`}>
                              {item.name}
                            </span>
                            <span className="text-[10px] text-slate-500 block truncate">
                              {item.size ? `Ukuran: ${item.size} • ` : ''}
                              {item.color ? `Warna: ${item.color} • ` : ''}
                              <span className="font-semibold text-indigo-700">{item.rackHangerCode || item.code}</span>
                            </span>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                          item.checked 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-rose-100 text-rose-700 border-rose-200'
                        }`}>
                          {item.checked ? 'Kondisi Baik' : 'Cacat / Robek'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Checklist Kelengkapan Aksesoris */}
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/90 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                    <Layers size={13} className="text-indigo-600" />
                    <span>Kelengkapan Aksesori &amp; Perhiasan ({checklist.length} Pcs):</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">Centang jika lengkap dikembalikan</span>
                </div>

                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {checklist.map((item, idx) => (
                    <label 
                      key={idx} 
                      className={`flex items-center justify-between gap-2.5 p-2 rounded-xl border transition-all cursor-pointer ${
                        item.checked 
                          ? 'bg-white border-slate-200/90 hover:border-indigo-300 shadow-2xs' 
                          : 'bg-rose-50/80 border-rose-200 text-rose-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(e) => {
                            const updated = [...checklist];
                            updated[idx].checked = e.target.checked;
                            setChecklist(updated);
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer shrink-0"
                        />
                        <span className={`text-xs font-semibold truncate ${item.checked ? 'text-slate-800' : 'text-rose-600 line-through'}`}>
                          {item.name}
                        </span>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                        item.checked 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-rose-100 text-rose-700 border-rose-200'
                      }`}>
                        {item.checked ? 'Lengkap' : 'Hilang / Rusak'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Denda Keterlambatan & Kerusakan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block text-xs">Denda Keterlambatan (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={lateFeeInput || ''}
                    onChange={(e) => setLateFeeInput(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-right font-bold text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block text-xs">Denda Kerusakan / Hilang (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={damageFeeInput || ''}
                    onChange={(e) => setDamageFeeInput(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-right font-bold text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Pelunasan Biaya Sewa (Bayar Saat Pengembalian / Sisa DP) */}
              {qcModalOrder && (qcModalOrder.totalAmount - qcModalOrder.paidAmount) > 0 && (
                <div className="p-3.5 bg-indigo-50/90 rounded-2xl border-2 border-indigo-200/90 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Coins size={16} />
                      </div>
                      <div>
                        <span className="font-black text-indigo-950 text-xs sm:text-sm block">
                          {qcModalOrder.paidAmount === 0 ? 'Pelunasan Sewa (Bayar Full Saat Kembali)' : 'Pelunasan Sisa Biaya Sewa'}
                        </span>
                        <span className="text-[10px] text-indigo-700 font-medium block">
                          {qcModalOrder.paidAmount === 0
                            ? 'Klien bayar saat busana dikembalikan. Tagihkan sebelum mengembalikan KTP/Jaminan.'
                            : `Total Kontrak: Rp ${qcModalOrder.totalAmount.toLocaleString('id-ID')} • Terbayar DP: Rp ${qcModalOrder.paidAmount.toLocaleString('id-ID')}`}
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-indigo-700 text-white shrink-0 shadow-xs">
                      Rp {(qcModalOrder.totalAmount - qcModalOrder.paidAmount).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-indigo-200/80">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settleBalance}
                        onChange={(e) => setSettleBalance(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        Terima Pembayaran Pelunasan Sekarang
                      </span>
                    </label>

                    {settleBalance && (
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <span className="text-xs font-bold text-slate-500">Nominal: Rp</span>
                        <input
                          type="number"
                          min="0"
                          max={qcModalOrder.totalAmount - qcModalOrder.paidAmount}
                          value={settleAmountInput || ''}
                          onChange={(e) => setSettleAmountInput(Math.min(qcModalOrder.totalAmount - qcModalOrder.paidAmount, Math.max(0, Number(e.target.value) || 0)))}
                          className="w-28 px-2 py-1 text-right font-black text-xs rounded-xl border border-indigo-300 bg-white text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </div>
                    )}
                  </div>

                  {settleBalance && settleAmountInput > 0 && (
                    <div className="pt-2 border-t border-indigo-200/60 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-600 mr-1">Metode Bayar:</span>
                      {[
                        { id: 'CASH', label: 'Tunai Kasir' },
                        { id: 'QRIS', label: 'QRIS' },
                        { id: 'TRANSFER', label: 'Transfer BCA' },
                        { id: 'DEBIT', label: 'Kartu Debit' }
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSettlePaymentMethod(m.id)}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                            settlePaymentMethod === m.id
                              ? 'bg-indigo-700 text-white border-indigo-700 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-indigo-50'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Kalkulasi Rekonsiliasi Kasir & Refund Deposit */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                <div className="font-extrabold text-slate-900 text-xs mb-1.5 flex items-center justify-between">
                  <span>Ringkasan Kas Laci Kasir:</span>
                  <span className="text-[10px] text-slate-500 font-semibold">Rekonsiliasi Pengembalian</span>
                </div>

                {qcModalOrder && (qcModalOrder.totalAmount - qcModalOrder.paidAmount) > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Pelunasan Biaya Sewa Diterima:</span>
                    <span className="font-bold text-indigo-950">
                      + Rp {(settleBalance ? settleAmountInput : 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-slate-600">
                  <span>Uang Deposit Jaminan (Awal):</span>
                  <span className="font-bold text-slate-900">Rp {qcModalOrder.depositAmount.toLocaleString('id-ID')}</span>
                </div>

                {(lateFeeInput + damageFeeInput) > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Potongan Denda (Telat/Rusak):</span>
                    <span className="font-bold">- Rp {(lateFeeInput + damageFeeInput).toLocaleString('id-ID')}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-700 pt-1.5 border-t border-slate-200">
                  <span>Sisa Uang Deposit Dikembalikan ke Klien:</span>
                  <span className="text-emerald-700 font-bold">
                    Rp {Math.max(0, qcModalOrder.depositAmount - (lateFeeInput + damageFeeInput)).toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Net Cash Collected / Paid */}
                <div className="flex justify-between items-baseline text-sm font-black text-slate-900 pt-2 border-t-2 border-slate-200">
                  <span>Total Kas Masuk Diterima Kasir:</span>
                  <span className="text-base text-indigo-700 font-black">
                    Rp {((settleBalance ? settleAmountInput : 0) + Math.max(0, (lateFeeInput + damageFeeInput) - qcModalOrder.depositAmount)).toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="p-2 bg-amber-50/80 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 font-medium flex items-center gap-1.5 mt-1">
                  <ShieldCheck size={14} className="text-amber-700 shrink-0" />
                  <span>Pastikan dokumen jaminan fisik (KTP/SIM) dikembalikan kepada klien setelah pelunasan selesai.</span>
                </div>
              </div>

              {/* Next Step: Default Selesai (Langsung Bersih) on Left, Masuk Cuci & Uap on Right */}
              <div>
                <label className="font-bold text-slate-800 block mb-2 text-xs">
                  Tahap Selanjutnya untuk Busana Ini:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setNextStageInput('COMPLETED')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      nextStageInput === 'COMPLETED'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-xs ring-2 ring-emerald-400/50'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block font-black text-xs text-emerald-800 flex items-center gap-1.5">
                      <Check size={14} className="text-emerald-600" />
                      <span>Selesai (Langsung Bersih)</span>
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Pakaian masih bersih, langsung kembali ke rak/hanger display
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNextStageInput('LAUNDRY')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      nextStageInput === 'LAUNDRY'
                        ? 'bg-cyan-50 border-cyan-500 text-cyan-950 shadow-xs ring-2 ring-cyan-400/50'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block font-black text-xs text-cyan-800 flex items-center gap-1.5">
                      <span>🧼</span>
                      <span>Masuk Cuci &amp; Uap</span>
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Kirim ke antrean laundry / dry-clean butik sanggar
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Submit Action Buttons (Pinned Bottom Bar - Always Visible) */}
            <div className="p-3 sm:p-4.5 border-t border-slate-200 bg-white shrink-0 flex items-center gap-2.5 shadow-lg">
              <button
                type="button"
                onClick={() => setQcModalOrder(null)}
                className="px-5 py-3 border border-slate-200 rounded-2xl text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleSubmitQc()}
                disabled={isProcessingQc}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:bg-slate-300 text-white rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>
                  {isProcessingQc
                    ? 'Memproses...'
                    : (settleBalance && settleAmountInput > 0)
                    ? `Konfirmasi Pelunasan (Rp ${settleAmountInput.toLocaleString('id-ID')}) & Terima Busana`
                    : 'Konfirmasi & Kembalikan Deposit'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pembatalan Kontrak Sewa */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} />
                <h3 className="font-black text-sm">Batalkan Kontrak Sewa</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setCancellingOrder(null)}
                className="p-1 rounded-xl text-white/80 hover:text-white hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="flex justify-between font-black text-slate-800">
                  <span>Kontrak #{cancellingOrder.orderNumber}</span>
                  <span>Rp {cancellingOrder.totalAmount.toLocaleString('id-ID')}</span>
                </div>
                <div className="text-slate-500 font-medium">Penyewa: {cancellingOrder.customerName}</div>
                <div className="text-[11px] text-slate-600">
                  Item: {cancellingOrder.items.map(i => i.attireName).join(', ')}
                </div>
              </div>

              {/* Alasan Pembatalan */}
              <div>
                <label className="block font-black text-slate-700 mb-1">Alasan Pembatalan:</label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="Misal: Acara diundur, ganti konsep busana..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold"
                />
              </div>

              {/* Refund DP / Uang Sewa */}
              {cancellingOrder.paidAmount > 0 && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-900">Uang Sewa / DP Masuk:</span>
                    <span className="font-black text-amber-900">Rp {cancellingOrder.paidAmount.toLocaleString('id-ID')}</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-800 mb-1">Nominal Refund DP ke Penyewa (Kas Keluar):</label>
                    <input
                      type="number"
                      value={refundPaidInput}
                      min={0}
                      max={cancellingOrder.paidAmount}
                      onChange={e => setRefundPaidInput(Number(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 text-xs bg-white rounded-xl border border-amber-300 font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-[10px] text-amber-700 mt-0.5 block">Isi 0 jika DP hangus (non-refundable).</span>
                  </div>
                </div>
              )}

              {/* Refund Deposit */}
              {cancellingOrder.depositAmount > 0 && (
                <label className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="font-bold text-indigo-900 block">Kembalikan Uang Deposit Jaminan</span>
                    <span className="text-[10px] text-indigo-700">Rp {cancellingOrder.depositAmount.toLocaleString('id-ID')} akan dicatat sebagai kas keluar laci</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={refundDepositChecked}
                    onChange={e => setRefundDepositChecked(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </label>
              )}

              <p className="text-[11px] text-slate-500">
                ⚠️ Pembatalan akan membebaskan slot busana pada tanggal tersebut agar bisa disewa oleh pelanggan lain.
              </p>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isSubmittingCancel}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:bg-slate-300 text-white font-black text-xs shadow-md transition-all cursor-pointer"
              >
                {isSubmittingCancel ? 'Membatalkan...' : 'Konfirmasi Batal'}
              </button>
            </div>
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

      {/* Modal Auto-Reminder WA Cron Cycle */}
      <RentalCronModal
        isOpen={cronModalOpen}
        onClose={() => setCronModalOpen(false)}
        onFinished={fetchOrders}
      />

      {/* Modal Kirim Pengingat WhatsApp Per Order */}
      <RentalSendReminderModal
        isOpen={!!selectedReminderOrder}
        onClose={() => setSelectedReminderOrder(null)}
        order={selectedReminderOrder}
        onSuccess={fetchOrders}
      />

    </div>
  );
};

export default RentalKanbanView;
