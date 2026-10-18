import React, { useState, useEffect, useContext } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Award, 
  Coins, 
  TrendingUp, 
  History, 
  Edit, 
  Trash2, 
  X, 
  Calendar, 
  Mail, 
  Phone,
  Sparkles,
  ChevronRight,
  Plus,
  Minus,
  Cake,
  AlertTriangle,
  Wallet,
  Eye,
  Ticket,
  Tag,
  Percent,
  CheckCircle,
  Clock,
  MessageSquare,
  Store,
  Coffee,
  Gift,
  Layers,
  Save,
  Info,
  Star
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';
import { useVertical } from '../context/VerticalContext';
import SettingsWhatsAppGateway from './settings/SettingsWhatsAppGateway';

const CRMView = () => {
  const posContext = useContext(POSContext);
  const { isBengkel, isRental, isRetail } = useVertical();
  const isAdminOrOwner = posContext?.user?.role?.toUpperCase() === 'ADMIN' || posContext?.user?.role?.toUpperCase() === 'OWNER';
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState('');

  // Selected customer for detail drawer
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [customerDetail, setCustomerDetail] = useState<any>(null);

  // Modal registration/edit states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalCustomer, setModalCustomer] = useState<any>(null); // Null for Add, object for Edit
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    birthday: '',
    priceTier: 'UMUM',
    creditLimit: 0,
    creditTermDays: 14,
    pointsAdjustment: 0,
    adjustmentReason: ''
  });

  // Pay debt modal states
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<any>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<string>('Tunai');
  const [payLoading, setPayLoading] = useState(false);

  const handleOpenPayModal = (debt: any) => {
    setSelectedDebt(debt);
    setPayAmount(debt.remaining); // Default bayar lunas
    setPayMethod('Tunai');
    setIsPayModalOpen(true);
  };

  const handlePayDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt) return;
    if (payAmount <= 0 || payAmount > selectedDebt.remaining) {
      toast(`Jumlah pembayaran tidak valid (Maksimal: ${formatCurrency(selectedDebt.remaining)})`, 'warning');
      return;
    }

    setPayLoading(true);
    try {
      const res = await fetch(`/api/debts/${selectedDebt.id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          amountPaid: payAmount,
          paymentMethod: payMethod
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast('Pembayaran piutang berhasil dicatat!', 'success');
        setIsPayModalOpen(false);
        fetchCustomers();
        if (selectedCustomer) {
          fetchCustomerDetail(selectedCustomer.id);
        }
      } else {
        toast(data.error || 'Gagal mencatat pembayaran piutang', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Gangguan koneksi ke server', 'error');
    } finally {
      setPayLoading(false);
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (searchQuery) queryParams.append('search', searchQuery);
      if (selectedTier) queryParams.append('tier', selectedTier);

      const res = await fetch(`/api/customers?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        setCustomers(await res.json());
      } else {
        toast('Gagal mengambil data pelanggan', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Gangguan koneksi ke server', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Tab Switch: Members / Vouchers / Loyalty Rules / WhatsApp Gateway
  const [activeTab, setActiveTab] = useState<'members' | 'vouchers' | 'loyalty' | 'whatsapp'>('members');

  // Loyalty Point Settings State
  const [loyaltyForm, setLoyaltyForm] = useState({
    loyaltyEnabled: true,
    loyaltyEarnPerAmount: 10000,
    loyaltyPointValue: 100,
    loyaltySilverThreshold: 1000000,
    loyaltyGoldThreshold: 3000000,
    loyaltySilverMultiplier: 1.2,
    loyaltyGoldMultiplier: 1.5,
    loyaltyMaxRedeemPerOrder: 0,
    loyaltyRedeemMinPoints: 1,
    loyaltyMinOrderForEarn: 0
  });
  const [loyaltySaving, setLoyaltySaving] = useState(false);

  useEffect(() => {
    if (posContext?.settings) {
      const s = posContext.settings;
      setLoyaltyForm({
        loyaltyEnabled: s.loyaltyEnabled !== false,
        loyaltyEarnPerAmount: s.loyaltyEarnPerAmount ?? 10000,
        loyaltyPointValue: s.loyaltyPointValue ?? 100,
        loyaltySilverThreshold: s.loyaltySilverThreshold ?? 1000000,
        loyaltyGoldThreshold: s.loyaltyGoldThreshold ?? 3000000,
        loyaltySilverMultiplier: s.loyaltySilverMultiplier ?? 1.2,
        loyaltyGoldMultiplier: s.loyaltyGoldMultiplier ?? 1.5,
        loyaltyMaxRedeemPerOrder: s.loyaltyMaxRedeemPerOrder ?? 0,
        loyaltyRedeemMinPoints: s.loyaltyRedeemMinPoints ?? 1,
        loyaltyMinOrderForEarn: s.loyaltyMinOrderForEarn ?? 0
      });
    }
  }, [posContext?.settings]);

  const handleSaveLoyaltySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoyaltySaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify(loyaltyForm)
      });
      if (res.ok) {
        toast('✅ Aturan poin & loyalitas berhasil diperbarui!', 'success');
        if (posContext?.fetchSettings) {
          await posContext.fetchSettings();
        }
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.error || 'Gagal menyimpan aturan loyalitas', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi gangguan koneksi saat menyimpan pengaturan loyalitas', 'error');
    } finally {
      setLoyaltySaving(false);
    }
  };

  // Voucher State
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [voucherSubmitting, setVoucherSubmitting] = useState(false);
  const [voucherForm, setVoucherForm] = useState({
    code: '',
    description: '',
    type: 'PERCENT',
    amount: '',
    minSpend: '',
    maxDiscount: '',
    maxUsage: '',
    validUntil: '',
    status: 'Aktif'
  });

  const fetchVouchers = async () => {
    setVouchersLoading(true);
    try {
      const res = await fetch('/api/vouchers', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVouchers(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
      toast('Gagal mengambil data kupon promo', 'error');
    } finally {
      setVouchersLoading(false);
    }
  };

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherForm.code.trim() || !voucherForm.amount) {
      toast('Kode voucher dan diskon harus diisi', 'warning');
      return;
    }
    setVoucherSubmitting(true);
    try {
      const res = await fetch('/api/vouchers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          code: voucherForm.code.trim().toUpperCase(),
          description: voucherForm.description,
          type: voucherForm.type,
          amount: Number(voucherForm.amount),
          minSpend: Number(voucherForm.minSpend) || 0,
          maxDiscount: voucherForm.maxDiscount ? Number(voucherForm.maxDiscount) : null,
          maxUsage: voucherForm.maxUsage ? Number(voucherForm.maxUsage) : null,
          validUntil: voucherForm.validUntil ? new Date(voucherForm.validUntil).toISOString() : null,
          status: voucherForm.status
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast(`✅ Voucher "${data.code}" berhasil dibuat!`, 'success');
        setIsVoucherModalOpen(false);
        setVoucherForm({
          code: '',
          description: '',
          type: 'PERCENT',
          amount: '',
          minSpend: '',
          maxDiscount: '',
          maxUsage: '',
          validUntil: '',
          status: 'Aktif'
        });
        fetchVouchers();
      } else {
        toast(data.error || 'Gagal membuat voucher', 'error');
      }
    } catch (e) {
      console.error(e);
      toast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setVoucherSubmitting(false);
    }
  };

  const handleDeleteVoucher = async (id: number, code: string) => {
    const confirmResult = await confirmAlert(
      'Hapus Voucher',
      `Hapus kupon promo "${code}" secara permanen?`
    );
    if (!confirmResult.isConfirmed) return;

    try {
      const res = await fetch(`/api/vouchers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        toast(`Voucher "${code}" berhasil dihapus`, 'success');
        fetchVouchers();
      } else {
        const data = await res.json();
        toast(data.error || 'Gagal menghapus voucher', 'error');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleVoucherStatus = async (voucher: any) => {
    const newStatus = voucher.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
    try {
      const res = await fetch(`/api/vouchers/${voucher.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        toast(`Status voucher diubah ke ${newStatus}`, 'success');
        fetchVouchers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (posContext?.token) {
      if (activeTab === 'members') {
        fetchCustomers();
      } else if (activeTab === 'vouchers') {
        fetchVouchers();
      }
    }
  }, [posContext?.token, activeTab, searchQuery, selectedTier]);

  const fetchCustomerDetail = async (id: number) => {
    setDrawerLoading(true);
    try {
      const res = await fetch(`/api/customers/${id}`, {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        setCustomerDetail(await res.json());
      } else {
        toast('Gagal mengambil detail pelanggan', 'error');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleOpenDrawer = (customer: any) => {
    setSelectedCustomer(customer);
    fetchCustomerDetail(customer.id);
  };

  const handleCloseDrawer = () => {
    setSelectedCustomer(null);
    setCustomerDetail(null);
  };

  const handleOpenModal = (customer: any = null) => {
    if (customer) {
      setModalCustomer(customer);
      setFormData({
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
        birthday: customer.birthday || '',
        priceTier: customer.priceTier || 'UMUM',
        creditLimit: customer.creditLimit || 0,
        creditTermDays: customer.creditTermDays || 14,
        pointsAdjustment: 0,
        adjustmentReason: ''
      });
    } else {
      setModalCustomer(null);
      setFormData({
        name: '',
        phone: '',
        email: '',
        birthday: '',
        priceTier: 'UMUM',
        creditLimit: 0,
        creditTermDays: 14,
        pointsAdjustment: 0,
        adjustmentReason: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      toast('Nama dan Nomor Telepon wajib diisi', 'warning');
      return;
    }

    try {
      const url = modalCustomer 
        ? `/api/customers/${modalCustomer.id}` 
        : '/api/customers';
      const method = modalCustomer ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (res.ok) {
        toast(modalCustomer ? 'Data pelanggan diperbarui' : 'Pelanggan berhasil terdaftar', 'success');
        setIsModalOpen(false);
        fetchCustomers();
        if (selectedCustomer && selectedCustomer.id === modalCustomer?.id) {
          fetchCustomerDetail(selectedCustomer.id);
        }
      } else {
        toast(data.error || 'Gagal menyimpan data pelanggan', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Gangguan koneksi ke server', 'error');
    }
  };

  const handleDeleteCustomer = async (id: number, name: string) => {
    const confirmResult = await confirmAlert(
      'Hapus Pelanggan', 
      `Apakah Anda yakin ingin menghapus member ${name}? Seluruh riwayat poin akan dihapus secara permanen.`
    );
    if (!confirmResult.isConfirmed) return;

    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        toast('Pelanggan berhasil dihapus', 'success');
        fetchCustomers();
        if (selectedCustomer?.id === id) {
          handleCloseDrawer();
        }
      } else {
        const data = await res.json();
        toast(data.error || 'Gagal menghapus pelanggan', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Calculations for KPI
  const totalMembers = customers.length;
  const silverMembers = customers.filter(c => c.tier === 'Silver').length;
  const goldMembers = customers.filter(c => c.tier === 'Gold').length;
  const totalPoints = customers.reduce((sum, c) => sum + (c.points || 0), 0);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Gold': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Silver': return 'bg-slate-200 text-slate-800 border-slate-300';
      default: return 'bg-orange-100 text-orange-800 border-orange-200';
    }
  };

  const formatCurrency = (val: number) => {
    return `Rp ${(val || 0).toLocaleString('id-ID')}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="p-3 sm:p-6 pb-52 sm:pb-16 w-full flex flex-col gap-3.5 sm:gap-4 relative">
      {/* TOP TAB NAVIGATION */}
      <div className="flex border-b border-slate-200 gap-6 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`pb-3 text-sm font-black flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'members'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Users size={16} /> Anggota &amp; Pelanggan
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
            {customers.length}
          </span>
        </button>
        {/* Voucher Tab: hanya relevan untuk Kafe & Retail */}
        {!isRental && !isBengkel && (
        <button
          type="button"
          onClick={() => setActiveTab('vouchers')}
          className={`pb-3 text-sm font-black flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'vouchers'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Ticket size={16} /> Kupon &amp; Voucher Promo
          {vouchers.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
              {vouchers.length}
            </span>
          )}
        </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab('loyalty')}
          className={`pb-3 text-sm font-black flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'loyalty'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Coins size={16} /> Aturan Poin &amp; Loyalitas
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
            1 Pts = Rp {loyaltyForm.loyaltyPointValue}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('whatsapp')}
          className={`pb-3 text-sm font-black flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'whatsapp'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <MessageSquare size={16} /> WhatsApp Gateway &amp; Notif
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
            Add-On
          </span>
        </button>
      </div>

      {activeTab === 'members' && (
        <div className="flex-1 flex flex-col gap-3.5 sm:gap-4">
          {/* HEADER / ACTION TOOLBAR */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 sm:gap-4 shrink-0">
            <div className="hidden sm:block">
              <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-slate-900">
                <Award className="text-primary" size={24} /> Manajemen CRM &amp; Loyalitas
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Pantau level keanggotaan pelanggan, total belanja, dan poin loyalitas</p>
            </div>
            <button 
              className="btn btn-primary shadow-md hover:shadow-lg flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold w-full sm:w-auto transition-all active:scale-95"
              onClick={() => handleOpenModal(null)}
            >
              <UserPlus size={16} /> + Tambah Member Baru
            </button>
          </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 shrink-0">
          <div className="card flex items-center gap-3 p-3.5 bg-white shadow-sm border border-slate-200/80 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">Total Member</div>
              <div className="text-lg sm:text-2xl font-black text-slate-900">{totalMembers}</div>
            </div>
          </div>

          <div className="card flex items-center gap-3 p-3.5 bg-white shadow-sm border border-slate-200/80 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <Award size={20} />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">Silver</div>
              <div className="text-lg sm:text-2xl font-black text-slate-900">{silverMembers}</div>
            </div>
          </div>

          <div className="card flex items-center gap-3 p-3.5 bg-white shadow-sm border border-slate-200/80 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">Gold</div>
              <div className="text-lg sm:text-2xl font-black text-slate-900">{goldMembers}</div>
            </div>
          </div>

          <div className="card flex items-center gap-3 p-3.5 bg-white shadow-sm border border-slate-200/80 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Coins size={20} />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">Poin Aktif</div>
              <div className="text-lg sm:text-2xl font-black text-slate-900">{totalPoints}</div>
            </div>
          </div>
        </div>

        {/* Filter & Search */}
        <div className="card p-3 bg-white shadow-sm border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row gap-2.5 items-center shrink-0">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input 
              type="text" 
              className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400" 
              placeholder="Cari nama, WA, atau email member..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-44 shrink-0">
            <select 
              className="w-full px-3 py-2 text-xs font-semibold bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={selectedTier}
              onChange={e => setSelectedTier(e.target.value)}
            >
              <option value="">Semua Level Tier</option>
              <option value="Bronze">Bronze Tier</option>
              <option value="Silver">Silver Tier</option>
              <option value="Gold">Gold Tier</option>
            </select>
          </div>
        </div>

        {/* Data Container */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col shrink-0">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-medium text-xs">Memuat data pelanggan...</div>
          ) : customers.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-medium text-xs">Tidak ada member ditemukan.</div>
          ) : (
            <>
              {/* Mobile Member Cards (< 768px) */}
              <div className="crm-mobile-cards md:hidden divide-y divide-slate-100">
                {customers.map((c) => {
                  const totalDebt = c.debts ? c.debts.reduce((sum: number, d: any) => sum + (Number(d.remaining) || 0), 0) : 0;
                  return (
                    <div 
                      key={c.id} 
                      className={`p-4 space-y-3 cursor-pointer transition-colors ${selectedCustomer?.id === c.id ? 'bg-indigo-50/40' : 'bg-white hover:bg-slate-50'}`}
                      onClick={() => handleOpenDrawer(c)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-black text-sm flex items-center justify-center shadow-sm shrink-0">
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-extrabold text-sm text-slate-900 leading-tight">{c.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                                <Phone size={11} className="text-slate-400" /> {c.phone || '-'}
                              </span>
                              {c.birthday && (
                                <span className="text-[10px] text-pink-600 bg-pink-50 px-1.5 py-0.2 rounded font-bold flex items-center gap-0.5">
                                  <Cake size={10} /> {c.birthday}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {c.priceTier && c.priceTier !== 'UMUM' && (
                            <span className="text-[10px] px-2 py-0.5 font-black rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {c.priceTier}
                            </span>
                          )}
                          <span className={`text-[10px] px-2.5 py-0.5 font-extrabold rounded-full border ${getTierColor(c.tier)}`}>
                            {c.tier}
                          </span>
                        </div>
                      </div>

                      {/* Points & Spent Grid */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">Saldo Poin:</span>
                          <span className="font-black text-indigo-700">{c.points} <span className="text-[10px] font-normal text-slate-400">pts</span></span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">Total Belanja:</span>
                          <span className="font-bold text-slate-800">{formatCurrency(c.totalSpent)}</span>
                        </div>
                        {totalDebt > 0 && (
                          <div className="col-span-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between">
                            <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                              <AlertTriangle size={12} /> Piutang: {formatCurrency(totalDebt)}
                            </span>
                            <button 
                              className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-[11px] border border-rose-200"
                              onClick={(e) => {
                                e.stopPropagation();
                                const firstActiveDebt = c.debts?.find((d: any) => d.status === 'Belum Lunas');
                                if (firstActiveDebt) handleOpenPayModal(firstActiveDebt);
                              }}
                            >
                              Bayar Piutang 💳
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Actions Footer */}
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-50" onClick={e => e.stopPropagation()}>
                        <button 
                          className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
                          onClick={() => handleOpenDrawer(c)}
                        >
                          <Eye size={13} /> Rincian &amp; Riwayat
                        </button>
                        <button 
                          className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs flex items-center gap-1.5 transition-colors"
                          onClick={() => handleOpenModal(c)}
                        >
                          <Edit size={13} /> Edit
                        </button>
                        {isAdminOrOwner && (
                          <button 
                            className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs flex items-center gap-1.5 transition-colors"
                            onClick={() => handleDeleteCustomer(c.id, c.name)}
                          >
                            <Trash2 size={13} /> Hapus
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table (>= 768px) */}
              <div className="crm-desktop-table hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-3.5 font-bold text-xs text-slate-400 uppercase">Pelanggan</th>
                      <th className="p-3.5 font-bold text-xs text-slate-400 uppercase">Kontak</th>
                      <th className="p-3.5 font-bold text-xs text-slate-400 uppercase">Level / Tier</th>
                      <th className="p-3.5 font-bold text-xs text-slate-400 uppercase text-right">Saldo Poin</th>
                      <th className="p-3.5 font-bold text-xs text-slate-400 uppercase text-right">Total Transaksi</th>
                      <th className="p-3.5 font-bold text-xs text-slate-400 uppercase text-right">Total Piutang</th>
                      <th className="p-3.5 font-bold text-xs text-slate-400 uppercase text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => {
                      const totalDebt = c.debts ? c.debts.reduce((sum: number, d: any) => sum + (Number(d.remaining) || 0), 0) : 0;
                      return (
                        <tr 
                          key={c.id} 
                          className={`hover:bg-slate-50 border-b border-slate-50 transition-colors cursor-pointer ${selectedCustomer?.id === c.id ? 'bg-indigo-50/40' : ''}`}
                          onClick={() => handleOpenDrawer(c)}
                        >
                          <td className="p-3.5">
                            <div className="font-bold text-slate-800">{c.name}</div>
                            {c.birthday && (
                              <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Cake size={11} className="text-pink-500" />
                                <span>Ultah: {c.birthday}</span>
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 text-xs">
                            <div className="flex items-center gap-1 text-slate-600 font-medium">
                              <Phone size={12} className="text-slate-400" /> {c.phone || '-'}
                            </div>
                            {c.email && (
                              <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                                <Mail size={11} className="text-slate-400" /> {c.email}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] px-2 py-0.5 font-bold rounded-full border ${getTierColor(c.tier)}`}>
                                {c.tier}
                              </span>
                              {c.priceTier && c.priceTier !== 'UMUM' && (
                                <span className="text-[10px] px-2 py-0.5 font-black rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  {c.priceTier}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 text-right font-bold text-indigo-600">
                            {c.points} <span className="text-[10px] font-normal text-slate-400">pts</span>
                          </td>
                          <td className="p-3.5 text-right font-semibold text-slate-800">
                            {formatCurrency(c.totalSpent)}
                          </td>
                          <td className="p-3.5 text-right font-bold text-rose-600">
                            {totalDebt > 0 ? formatCurrency(totalDebt) : '-'}
                          </td>
                          <td className="p-3.5 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-end gap-1.5">
                              <button 
                                className="icon-btn text-blue-600 bg-blue-50 border border-blue-100" 
                                title="Edit Profil"
                                onClick={() => handleOpenModal(c)}
                              >
                                <Edit size={14}/>
                              </button>
                              {isAdminOrOwner && (
                                <button 
                                  className="icon-btn text-rose-600 bg-rose-50 border border-rose-100" 
                                  title="Hapus Member"
                                  onClick={() => handleDeleteCustomer(c.id, c.name)}
                                >
                                  <Trash2 size={14}/>
                                </button>
                              )}
                              <button 
                                className="icon-btn text-slate-600 bg-slate-50 border border-slate-100"
                                title="Lihat Detail"
                                onClick={() => handleOpenDrawer(c)}
                              >
                                <ChevronRight size={14} />
                              </button>
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
      </div>
      )}

      {activeTab === 'vouchers' && (
        <div className="flex-1 flex flex-col gap-3.5 sm:gap-4 animate-fade-in">
          {/* HEADER / ACTION TOOLBAR VOUCHERS */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 sm:gap-4 shrink-0">
            <div>
              <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-slate-900">
                <Ticket className="text-indigo-600" size={24} /> Kupon Promo &amp; Voucher Diskon
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola kode kupon promo kasir POS, diskon persen / nominal, batas kuota, dan masa berlaku
              </p>
            </div>
            <button 
              type="button"
              className="btn btn-primary shadow-md hover:shadow-lg flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold w-full sm:w-auto transition-all active:scale-95"
              onClick={() => setIsVoucherModalOpen(true)}
            >
              <Plus size={16} /> + Buat Voucher Baru
            </button>
          </div>

          {/* KPI Cards Vouchers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 shrink-0">
            <div className="card flex items-center gap-3 p-3.5 bg-white shadow-sm border border-slate-200/80 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Ticket size={20} />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Total Kupon</div>
                <div className="text-lg sm:text-2xl font-black text-slate-900">{vouchers.length}</div>
              </div>
            </div>

            <div className="card flex items-center gap-3 p-3.5 bg-white shadow-sm border border-slate-200/80 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle size={20} />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Kupon Aktif</div>
                <div className="text-lg sm:text-2xl font-black text-slate-900">
                  {vouchers.filter(v => v.status === 'Aktif').length}
                </div>
              </div>
            </div>

            <div className="card flex items-center gap-3 p-3.5 bg-white shadow-sm border border-slate-200/80 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <TrendingUp size={20} />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Total Dipakai</div>
                <div className="text-lg sm:text-2xl font-black text-slate-900">
                  {vouchers.reduce((acc, v) => acc + (v.usedCount || 0), 0)}x
                </div>
              </div>
            </div>

            <div className="card flex items-center gap-3 p-3.5 bg-white shadow-sm border border-slate-200/80 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Tag size={20} />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">Tipe Kupon</div>
                <div className="text-sm font-black text-slate-800">
                  {vouchers.filter(v => v.type === 'PERCENT').length} % • {vouchers.filter(v => v.type === 'FIXED').length} Rp
                </div>
              </div>
            </div>
          </div>

          {/* Vouchers Data Container */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col shrink-0">
            {vouchersLoading ? (
              <div className="p-12 text-center text-slate-400 font-medium text-xs">Memuat data kupon promo...</div>
            ) : vouchers.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Ticket size={24} />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm">Belum Ada Kupon Promo</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Buat kode promo diskon pertama untuk meningkatkan transaksi kasir Anda.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsVoucherModalOpen(true)}
                  className="btn btn-primary btn-sm py-2 px-4 rounded-xl text-xs font-bold"
                >
                  + Buat Kupon Sekarang
                </button>
              </div>
            ) : (
              <>
                {/* Mobile Voucher Cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {vouchers.map(v => (
                    <div key={v.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-mono font-black text-sm px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 border border-indigo-200">
                            {v.code}
                          </span>
                          <div className="text-xs font-bold text-slate-800 mt-2">
                            {v.type === 'PERCENT' ? `Diskon ${v.amount}%` : `Potongan ${formatCurrency(v.amount)}`}
                            {v.maxDiscount && ` (Maks. ${formatCurrency(v.maxDiscount)})`}
                          </div>
                          {v.description && <div className="text-[11px] text-slate-400 mt-0.5">{v.description}</div>}
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${v.status === 'Aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                          {v.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 space-y-1">
                        <div>Min. Belanja: <b className="text-slate-700">{formatCurrency(v.minSpend)}</b></div>
                        <div>Terpakai: <b className="text-slate-700">{v.usedCount || 0} / {v.maxUsage || '∞'}</b></div>
                        <div>Berlaku: <b className="text-slate-700">{v.validUntil ? formatDate(v.validUntil) : 'Selamanya'}</b></div>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => handleToggleVoucherStatus(v)}
                          className="text-xs font-bold text-slate-600 hover:text-slate-900"
                        >
                          Ubah Status ({v.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'})
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteVoucher(v.id, v.code)}
                          className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                        >
                          <Trash2 size={13} /> Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Voucher Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="p-3.5 font-bold text-xs text-slate-400 uppercase">Kode Promo</th>
                        <th className="p-3.5 font-bold text-xs text-slate-400 uppercase">Diskon</th>
                        <th className="p-3.5 font-bold text-xs text-slate-400 uppercase">Min. Belanja</th>
                        <th className="p-3.5 font-bold text-xs text-slate-400 uppercase text-center">Kuota &amp; Dipakai</th>
                        <th className="p-3.5 font-bold text-xs text-slate-400 uppercase">Masa Berlaku</th>
                        <th className="p-3.5 font-bold text-xs text-slate-400 uppercase text-center">Status</th>
                        <th className="p-3.5 font-bold text-xs text-slate-400 uppercase text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vouchers.map(v => (
                        <tr key={v.id} className="hover:bg-slate-50 border-b border-slate-50 transition-colors">
                          <td className="p-3.5">
                            <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                              {v.code}
                            </span>
                            {v.description && <div className="text-[10px] text-slate-400 mt-1 font-medium">{v.description}</div>}
                          </td>
                          <td className="p-3.5 font-extrabold text-xs text-slate-800">
                            {v.type === 'PERCENT' ? (
                              <span>
                                {v.amount}%
                                {v.maxDiscount && (
                                  <span className="block text-[10px] text-slate-400 font-medium">
                                    Maks. {formatCurrency(v.maxDiscount)}
                                  </span>
                                )}
                              </span>
                            ) : (
                              formatCurrency(v.amount)
                            )}
                          </td>
                          <td className="p-3.5 text-xs font-semibold text-slate-600">
                            {formatCurrency(v.minSpend)}
                          </td>
                          <td className="p-3.5 text-xs text-center font-bold text-slate-700">
                            <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-[11px]">
                              {v.usedCount || 0} / {v.maxUsage || '∞'}
                            </span>
                          </td>
                          <td className="p-3.5 text-xs font-medium text-slate-600">
                            {v.validUntil ? formatDate(v.validUntil) : <span className="text-emerald-600 font-bold">Tanpa Batas</span>}
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleVoucherStatus(v)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold cursor-pointer transition-all active:scale-95 ${
                                v.status === 'Aktif'
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                              }`}
                              title="Klik untuk mengubah status"
                            >
                              {v.status}
                            </button>
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteVoucher(v.id, v.code)}
                              className="icon-btn text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 p-1.5 rounded-lg inline-flex"
                              title="Hapus Voucher"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'loyalty' && (
        <form onSubmit={handleSaveLoyaltySettings} className="flex-1 flex flex-col gap-4 animate-fade-in max-w-4xl">
          {/* HEADER LOYALTY */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 sm:gap-4 shrink-0 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center shrink-0 shadow-sm">
                <Coins size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900">
                    Aturan Poin &amp; Sistem Loyalitas CRM
                  </h2>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    loyaltyForm.loyaltyEnabled 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}>
                    {loyaltyForm.loyaltyEnabled ? '✓ AKTIF' : 'NONAKTIF'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atur rasio belanja per poin dan nilai tukar diskon nota / klaim menu gratis untuk pelanggan Anda
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loyaltySaving}
              className="btn btn-primary shadow-md hover:shadow-lg flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 shrink-0"
            >
              <Save size={15} />
              <span>{loyaltySaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
            </button>
          </div>

          {/* SIMULASI VAMOSMOBILE BANNER */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-indigo-50 border border-amber-200/80 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-200">
                <Coffee size={20} />
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-sm text-amber-950 flex items-center gap-1.5">
                    <Gift size={15} className="text-amber-600" />
                    Simulasi: Tukar 100 Poin = Kopi Susu Gratis (Ala Vamosmobile / Starbucks)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900">
                    Panduan Praktis
                  </span>
                </div>
                <p className="text-xs text-amber-900/90 leading-relaxed">
                  Jika Anda ingin pelanggan bisa menukarkan <strong>100 Poin</strong> untuk mendapatkan <strong>1 Kopi Susu gratis (Harga Rp 10.000)</strong>:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                  <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200/60">
                    <div className="font-extrabold text-amber-800 text-[11px] mb-0.5">1. Set Nilai Potongan</div>
                    <div className="text-slate-600 text-[11px]">
                      Atur <strong>Nilai Potongan = Rp {loyaltyForm.loyaltyPointValue || 100} / Poin</strong> di bawah. Maka 100 poin bernilai diskon Rp {(100 * (Number(loyaltyForm.loyaltyPointValue) || 100)).toLocaleString('id-ID')}.
                    </div>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200/60">
                    <div className="font-extrabold text-amber-800 text-[11px] mb-0.5">2. Pelanggan Kumpul Poin</div>
                    <div className="text-slate-600 text-[11px]">
                      Tiap belanja <strong>Rp {(Number(loyaltyForm.loyaltyEarnPerAmount) || 10000).toLocaleString('id-ID')}</strong> dapat 1 poin. Belanja Rp 100.000 dapat 10 poin.
                    </div>
                  </div>
                  <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200/60">
                    <div className="font-extrabold text-amber-800 text-[11px] mb-0.5">3. Kasir Tukar di POS</div>
                    <div className="text-slate-600 text-[11px]">
                      Kasir pilih member, centang <strong>Tukar 100 Poin</strong>, tagihan Kopi Susu dipotong Rp 10.000 jadi <strong>Rp 0 (Gratis)</strong>!
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TOGGLE PROGRAM LOYALITAS */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <label className="flex items-start justify-between gap-4 cursor-pointer select-none">
              <div className="space-y-1 flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-slate-800">
                    Aktifkan Program Poin Belanja &amp; Loyalitas Pelanggan
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Memberikan poin otomatis saat member berbelanja di kasir POS dan membolehkan penukaran poin sebagai potongan tagihan struk.
                </p>
              </div>

              <div className="relative mt-1 shrink-0">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={loyaltyForm.loyaltyEnabled}
                  onChange={e => setLoyaltyForm({ ...loyaltyForm, loyaltyEnabled: e.target.checked })}
                />
                <div
                  style={{
                    width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                    background: loyaltyForm.loyaltyEnabled ? '#4f46e5' : '#cbd5e1',
                    transition: 'background 0.2s', position: 'relative',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3,
                    left: loyaltyForm.loyaltyEnabled ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </div>
              </div>
            </label>
          </div>

          {loyaltyForm.loyaltyEnabled && (
            <>
              {/* KONVERSI POIN & NILAI BELANJA */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Sparkles size={17} className="text-indigo-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Konversi Poin &amp; Nilai Belanja
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Kelipatan Belanja Per 1 Poin (Earn)
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        min={1}
                        className="form-control pl-4 pr-28 font-bold text-slate-900 bg-slate-50/60 focus:bg-white text-sm" 
                        value={loyaltyForm.loyaltyEarnPerAmount} 
                        onChange={e => setLoyaltyForm({ ...loyaltyForm, loyaltyEarnPerAmount: Number(e.target.value) })} 
                      />
                      <span className="absolute right-3.5 top-2.5 font-bold text-xs text-slate-400">
                        Rupiah belanja
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Contoh: Rp 10.000. Pelanggan belanja Rp 50.000 otomatis dapat 5 Poin.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Nilai Potongan Per 1 Poin (Redeem)
                    </label>
                    <div className="relative">
                      <input 
                        type="number" 
                        min={0}
                        className="form-control pl-4 pr-28 font-bold text-slate-900 bg-slate-50/60 focus:bg-white text-sm" 
                        value={loyaltyForm.loyaltyPointValue} 
                        onChange={e => setLoyaltyForm({ ...loyaltyForm, loyaltyPointValue: Number(e.target.value) })} 
                      />
                      <span className="absolute right-3.5 top-2.5 font-bold text-xs text-slate-400">
                        Rupiah / Poin
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Contoh: Rp 100. Nilai diskon langsung saat 1 poin ditukarkan di kasir.
                    </p>
                  </div>
                </div>

                {/* LIVE PREVIEW PILLS */}
                <div className="pt-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Simulasi Nilai Tukar Saat Ini:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[10, 50, 100, 200, 500].map(pts => {
                      const rupiahVal = pts * (Number(loyaltyForm.loyaltyPointValue) || 100);
                      const is100 = pts === 100;
                      return (
                        <div 
                          key={pts}
                          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border flex items-center gap-1.5 ${
                            is100
                              ? 'bg-amber-50 text-amber-900 border-amber-300 ring-2 ring-amber-200/60'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          <Coins size={13} className={is100 ? 'text-amber-600' : 'text-slate-400'} />
                          <span>{pts} Poin</span>
                          <span className="text-slate-400 font-normal">=</span>
                          <span className={is100 ? 'text-amber-700 font-black' : 'text-indigo-600 font-black'}>
                            Rp {rupiahVal.toLocaleString('id-ID')}
                          </span>
                          {is100 && (
                            <span className="text-[10px] bg-amber-200/90 text-amber-900 px-1.5 py-0.2 rounded-md font-bold ml-0.5">
                              Kopi Susu
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* BATASAN & SYARAT PENUKARAN */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Gift size={17} className="text-emerald-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Syarat &amp; Batasan Penukaran Poin
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Min. Poin untuk Tukar
                    </label>
                    <input 
                      type="number" 
                      min={1}
                      className="form-control font-bold text-slate-900 bg-slate-50/60 focus:bg-white text-sm" 
                      value={loyaltyForm.loyaltyRedeemMinPoints} 
                      onChange={e => setLoyaltyForm({ ...loyaltyForm, loyaltyRedeemMinPoints: Number(e.target.value) })} 
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Min. poin yang wajib dimiliki sebelum boleh tukar
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Maks. Poin per Transaksi
                    </label>
                    <input 
                      type="number" 
                      min={0}
                      className="form-control font-bold text-slate-900 bg-slate-50/60 focus:bg-white text-sm" 
                      value={loyaltyForm.loyaltyMaxRedeemPerOrder} 
                      onChange={e => setLoyaltyForm({ ...loyaltyForm, loyaltyMaxRedeemPerOrder: Number(e.target.value) })} 
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      0 = tanpa batas maksimal per transaksi
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Min. Belanja untuk Dapat Poin
                    </label>
                    <input 
                      type="number" 
                      min={0}
                      className="form-control font-bold text-slate-900 bg-slate-50/60 focus:bg-white text-sm" 
                      value={loyaltyForm.loyaltyMinOrderForEarn} 
                      onChange={e => setLoyaltyForm({ ...loyaltyForm, loyaltyMinOrderForEarn: Number(e.target.value) })} 
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      0 = belanja nominal berapa pun tetap dapat poin
                    </p>
                  </div>
                </div>
              </div>

              {/* TINGKAT KEANGGOTAAN (TIERING) */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Layers size={17} className="text-purple-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Tingkat Keanggotaan (Tiering) &amp; Bonus Multiplier
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {/* Silver Tier */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Award size={16} className="text-slate-500" />
                        Level Silver
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                        {loyaltyForm.loyaltySilverMultiplier}x Poin
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                          Batas Belanja (Rp)
                        </label>
                        <input 
                          type="number" 
                          className="form-control font-bold text-xs bg-white" 
                          value={loyaltyForm.loyaltySilverThreshold} 
                          onChange={e => setLoyaltyForm({ ...loyaltyForm, loyaltySilverThreshold: Number(e.target.value) })} 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                          Multiplier Poin (x)
                        </label>
                        <input 
                          type="number" 
                          step="0.1" 
                          min={1}
                          className="form-control font-bold text-xs bg-white" 
                          value={loyaltyForm.loyaltySilverMultiplier} 
                          onChange={e => setLoyaltyForm({ ...loyaltyForm, loyaltySilverMultiplier: Number(e.target.value) })} 
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Pelanggan mencapai akumulasi belanja Rp {Number(loyaltyForm.loyaltySilverThreshold || 0).toLocaleString('id-ID')} otomatis naik ke Silver.
                    </p>
                  </div>

                  {/* Gold Tier */}
                  <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Award size={16} className="text-amber-500" />
                        Level Gold
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {loyaltyForm.loyaltyGoldMultiplier}x Poin
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                          Batas Belanja (Rp)
                        </label>
                        <input 
                          type="number" 
                          className="form-control font-bold text-xs bg-white" 
                          value={loyaltyForm.loyaltyGoldThreshold} 
                          onChange={e => setLoyaltyForm({ ...loyaltyForm, loyaltyGoldThreshold: Number(e.target.value) })} 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                          Multiplier Poin (x)
                        </label>
                        <input 
                          type="number" 
                          step="0.1" 
                          min={1}
                          className="form-control font-bold text-xs bg-white" 
                          value={loyaltyForm.loyaltyGoldMultiplier} 
                          onChange={e => setLoyaltyForm({ ...loyaltyForm, loyaltyGoldMultiplier: Number(e.target.value) })} 
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Member Gold mendapatkan bonus poin {Math.round(((Number(loyaltyForm.loyaltyGoldMultiplier) || 1.5) - 1) * 100)}% lebih banyak pada tiap transaksi.
                    </p>
                  </div>
                </div>
              </div>

              {/* SAVE BUTTON FOOTER */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={loyaltySaving}
                  className="btn btn-primary shadow-lg hover:shadow-xl flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                >
                  <Save size={16} />
                  <span>{loyaltySaving ? 'Menyimpan Perubahan...' : 'Simpan Semua Aturan Loyalitas'}</span>
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {activeTab === 'whatsapp' && (
        <div className="flex-1 flex flex-col gap-3.5 sm:gap-4 animate-fade-in">
          <SettingsWhatsAppGateway />
        </div>
      )}

      {/* Customer Detail Right Drawer / Mobile Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 lg:static lg:w-96 bg-black/50 lg:bg-transparent z-50 flex justify-end">
          <div className="w-full max-w-md lg:w-96 bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl relative animate-slide-left">
          {/* Drawer Header */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
            <div>
              <div className="text-xs text-muted font-bold uppercase">Detail Member</div>
              <h3 className="font-bold text-gray-800 text-lg leading-tight mt-0.5">{selectedCustomer.name}</h3>
            </div>
            <button className="icon-btn hover:bg-gray-200" onClick={handleCloseDrawer}>
              <X size={20} />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32 sm:pb-6">
            {/* Stats Panel */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-blue-100/50 p-4 rounded-xl space-y-4 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-muted font-semibold">Tier Keanggotaan</div>
                  <div className="text-xl font-black text-indigo-900 mt-0.5 flex items-center gap-1">
                    <Award size={18} className="text-amber-500 fill-amber-500" /> {selectedCustomer.tier}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted font-semibold">Total Poin</div>
                  <div className="text-2xl font-black text-indigo-600">{selectedCustomer.points} <span className="text-xs font-bold text-indigo-400">pts</span></div>
                </div>
              </div>

              <div className="border-t border-indigo-100/70 pt-3 flex justify-between text-xs">
                <div>
                  <span className="text-muted block">
                    {isRental ? 'Total Nilai Sewa' : isBengkel ? 'Total Nilai Servis' : 'Akumulasi Belanja'}
                  </span>
                  <span className="font-bold text-gray-800">{formatCurrency(selectedCustomer.totalSpent)}</span>
                </div>
                <div className="text-right">
                  <span className="text-muted block">Bergabung</span>
                  <span className="font-bold text-gray-800">{formatDate(selectedCustomer.createdAt)}</span>
                </div>
              </div>

              {customerDetail?.debts && customerDetail.debts.length > 0 && (
                <div className="border-t border-indigo-100/70 pt-3 flex justify-between text-xs items-center">
                  <span className="text-red-700 font-bold">Total Piutang Aktif</span>
                  <span className="font-black text-red-600 text-sm">
                    {formatCurrency(customerDetail.debts.filter((d: any) => d.status === 'Belum Lunas').reduce((sum: number, d: any) => sum + d.remaining, 0))}
                  </span>
                </div>
              )}
            </div>

            {/* Piutang & Kasbon Section */}
            <div>
              <h4 className="font-bold text-sm text-gray-800 flex items-center gap-2 mb-3">
                <Wallet size={16} className="text-red-500" /> Piutang & Kasbon ({customerDetail?.debts?.filter((d: any) => d.status === 'Belum Lunas').length || 0})
              </h4>
              {drawerLoading ? (
                <div className="text-xs text-muted py-2 text-center">Memuat data piutang...</div>
              ) : !customerDetail?.debts || customerDetail.debts.length === 0 ? (
                <div className="text-xs text-muted py-4 text-center border border-dashed rounded-lg">Tidak ada riwayat piutang</div>
              ) : (
                <div className="space-y-3">
                  {customerDetail.debts.map((d: any) => {
                    const isOverdue = d.status === 'Belum Lunas' && d.dueDate && new Date(d.dueDate) < new Date();
                    return (
                      <div key={d.id} className={`p-3 border rounded-lg flex flex-col gap-2 ${d.status === 'Lunas' ? 'border-gray-100 bg-gray-50/30' : 'border-red-100 bg-red-50/10'}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono text-xs font-bold text-gray-700 block">{d.order?.orderNumber || 'Manual'}</span>
                            <span className="text-[10px] text-muted block mt-0.5">Dibuat: {formatDate(d.createdAt)}</span>
                          </div>
                          <div className="text-right">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${d.status === 'Lunas' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                              {d.status}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between text-xs border-t border-dashed pt-2 mt-1">
                          <div>
                            <span className="text-muted block">Jumlah Piutang</span>
                            <span className="font-bold text-gray-700">{formatCurrency(d.amount)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-muted block">Sisa Tagihan</span>
                            <span className={`font-black ${d.status === 'Lunas' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(d.remaining)}</span>
                          </div>
                        </div>

                        {d.status === 'Belum Lunas' && d.dueDate && (
                          <div className="flex justify-between items-center text-[10px] mt-1 p-1 bg-amber-50 rounded">
                            <span className="text-amber-800 font-semibold">Jatuh Tempo: {formatDate(d.dueDate)}</span>
                            {isOverdue && <span className="text-red-600 font-bold uppercase tracking-wider animate-pulse">Overdue</span>}
                          </div>
                        )}

                        {d.status === 'Belum Lunas' && (
                          <button
                            className="btn btn-outline btn-xs justify-center mt-1 py-1 w-full bg-white text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleOpenPayModal(d)}
                          >
                            Bayar Tagihan Ini
                          </button>
                        )}

                        {/* Payment History inside each debt */}
                        {d.payments && d.payments.length > 0 && (
                          <div className="mt-2 bg-gray-50 p-2 rounded text-[10px] space-y-1">
                            <div className="font-bold text-gray-500 uppercase tracking-wider">Riwayat Cicilan:</div>
                            {d.payments.map((p: any) => (
                              <div key={p.id} className="flex justify-between text-gray-600">
                                <span>{formatDate(p.createdAt)} ({p.paymentMethod})</span>
                                <span className="font-bold text-green-600">+{formatCurrency(p.amountPaid)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Shopping History — Riwayat Transaksi (Kafe) / Servis Kendaraan (Bengkel) / Sewa Busana (Rental) */}
            <div>
              <h4 className="font-bold text-sm text-gray-800 flex items-center gap-2 mb-3">
                <TrendingUp size={16} className="text-primary" />
                {isBengkel ? '10 Servis Kendaraan Terakhir' : isRental ? '10 Riwayat Sewa Busana Adat' : '10 Transaksi Terakhir'}
              </h4>
              {drawerLoading ? (
                <div className="text-xs text-muted py-2 text-center">Memuat riwayat...</div>
              ) : isRental ? (
                // ── RENTAL: Riwayat Sewa Busana Adat ──────────────────────
                !customerDetail?.rentalOrders || customerDetail.rentalOrders.length === 0 ? (
                  <div className="text-xs text-muted py-4 text-center border border-dashed rounded-lg">
                    Belum ada riwayat sewa busana untuk pelanggan ini
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {customerDetail.rentalOrders.slice(0, 10).map((ro: any) => {
                      const isCompleted = ro.status === 'COMPLETED';
                      const isCancelled = ro.status === 'CANCELLED';
                      const isOverdue = ro.status === 'PICKED_UP' && new Date(ro.returnDeadline) < new Date();
                      return (
                        <div key={ro.id} className="p-3 border border-amber-100 bg-amber-50/20 rounded-xl hover:bg-amber-50/50 transition-colors space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-mono text-xs font-black text-amber-900 block">{ro.orderNumber}</span>
                              <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <Calendar size={10} /> Acara: <strong>{formatDate(ro.eventDate)}</strong>
                              </span>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                              isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              isCancelled ? 'bg-slate-100 text-slate-600 border-slate-200' :
                              isOverdue ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse' :
                              ro.status === 'PICKED_UP' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              ro.status === 'RETURNED' || ro.status === 'QC_CHECK' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                              'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}>
                            {/* FIX: Map status rental ke label Indonesia */}
                            {(() => {
                              const RENTAL_STATUS_LABEL: Record<string, string> = {
                                BOOKED: 'Terjadwal', FITTING: 'Fitting', PICKED_UP: 'Di Klien',
                                RETURNED: 'Dikembalikan', QC_CHECK: 'Cek QC', LAUNDRY: 'Laundry/Cuci',
                                COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan'
                              };
                              return RENTAL_STATUS_LABEL[ro.status] || ro.status;
                            })()}
                            </span>
                          </div>

                          {/* Items / Busana Adat */}
                          {ro.items && ro.items.length > 0 && (
                            <div className="space-y-1 bg-white p-2 rounded-lg border border-slate-100 text-[10px]">
                              {ro.items.map((it: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-slate-700">
                                  <span className="font-medium truncate max-w-[200px]">
                                    👘 {it.attireName || it.name}
                                    {it.size ? ` (${it.size})` : ''} {it.color ? `• ${it.color}` : ''}
                                  </span>
                                  {it.rackHangerCode && (
                                    <span className="font-mono text-[9px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded">
                                      {it.rackHangerCode}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {ro.fittingNotes && (
                            <div className="text-[10px] text-slate-600 italic bg-amber-50/60 p-1.5 rounded">
                              Ukuran/Fitting: "{ro.fittingNotes}"
                            </div>
                          )}

                          <div className="flex justify-between items-center pt-1.5 border-t border-amber-100/60 text-[11px]">
                            <span className="text-slate-500 text-[10px]">
                              Deposit: <strong className="text-slate-700">Rp {(ro.depositAmount || 0).toLocaleString('id-ID')}</strong>
                            </span>
                            <div className="text-right">
                              <span className="font-black text-slate-900 block">Rp {(ro.totalAmount || 0).toLocaleString('id-ID')}</span>
                              <span className={`text-[9px] font-bold ${ro.paymentStatus === 'FULL_PAID' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {ro.paymentStatus === 'FULL_PAID' ? 'Lunas' : 'Belum Lunas / DP'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : isBengkel ? (
                // ── BENGKEL: Riwayat SPK/Servis ──────────────────────────
                !customerDetail?.workOrders || customerDetail.workOrders.length === 0 ? (
                  <div className="text-xs text-muted py-4 text-center border border-dashed rounded-lg">
                    Belum ada riwayat servis kendaraan
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customerDetail.workOrders.slice(0, 10).map((wo: any) => (
                      <div key={wo.id} className="p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono text-xs font-black text-indigo-700 block">{wo.spkNumber || wo.id?.slice(0,8)}</span>
                            <span className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
                              <Calendar size={10} /> {formatDate(wo.createdAt)}
                            </span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            wo.status === 'PAID' || wo.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            wo.status === 'DONE' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            wo.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {wo.status}
                          </span>
                        </div>
                        {/* Kendaraan & Mekanik */}
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                          {wo.vehicle && (
                            <div className="bg-slate-50 rounded-lg px-2 py-1.5">
                              <span className="text-slate-400 block">Kendaraan</span>
                              <span className="font-bold text-slate-700">{wo.vehicle.plateNumber} — {wo.vehicle.brand} {wo.vehicle.model}</span>
                            </div>
                          )}
                          {wo.services && wo.services.length > 0 && (
                            <div className="bg-slate-50 rounded-lg px-2 py-1.5">
                              <span className="text-slate-400 block">Jenis Servis</span>
                              <span className="font-bold text-slate-700 truncate block">
                                {wo.services.map((s: any) => s.serviceType?.name || s.serviceName || '-').join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                          <span className="text-[10px] text-slate-500">
                            {wo.services?.length || 0} jasa · {wo.parts?.length || 0} sparepart
                          </span>
                          <span className="text-xs font-black text-slate-800">{formatCurrency(wo.grandTotal || wo.totalAmount || 0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                // ── KAFE: Riwayat Order ───────────────────────────────────
                !customerDetail?.orders || customerDetail.orders.length === 0 ? (
                  <div className="text-xs text-muted py-4 text-center border border-dashed rounded-lg">Belum ada transaksi belanja</div>
                ) : (
                  <div className="space-y-2">
                    {customerDetail.orders.map((o: any) => (
                      <div key={o.id} className="p-3 border border-gray-100 rounded-lg flex justify-between items-center hover:bg-slate-50 transition-colors">
                        <div>
                          <span className="font-mono text-xs font-bold text-gray-700 block">{o.orderNumber}</span>
                          <span className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
                            <Calendar size={10} /> {formatDate(o.createdAt)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-gray-800 block">{formatCurrency(o.total)}</span>
                          <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${o.status === 'Paid' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                            {o.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Point Audit Logs */}
            <div>
              <h4 className="font-bold text-sm text-gray-800 flex items-center gap-2 mb-3">
                <History size={16} className="text-primary" /> Riwayat Mutasi Poin
              </h4>
              {drawerLoading ? (
                <div className="text-xs text-muted py-2 text-center">Memuat riwayat poin...</div>
              ) : !customerDetail?.pointLogs || customerDetail.pointLogs.length === 0 ? (
                <div className="text-xs text-muted py-4 text-center border border-dashed rounded-lg">Tidak ada riwayat perubahan poin</div>
              ) : (
                <div className="space-y-2">
                  {customerDetail.pointLogs.map((log: any) => (
                    <div key={log.id} className="p-3 border border-gray-50 rounded-lg bg-gray-50/50 flex justify-between items-start">
                      <div className="flex-1 pr-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border block w-max uppercase ${
                          log.type === 'Earn' ? 'bg-green-50 text-green-700 border-green-200' :
                          log.type === 'Redeem' ? 'bg-red-50 text-red-700 border-red-200' :
                          log.type === 'Refund' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {log.type}
                        </span>
                        <p className="text-[11px] text-gray-600 mt-1.5 leading-relaxed">{log.description || 'Penyesuaian Poin'}</p>
                        <span className="text-[9px] text-muted block mt-1">{formatDate(log.createdAt)}</span>
                      </div>
                      <span className={`text-sm font-black whitespace-nowrap ${log.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {log.points > 0 ? `+${log.points}` : log.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Register/Edit Member Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-md sm:rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden border-0 sm:border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="font-extrabold text-base sm:text-lg text-slate-800 flex items-center gap-2">
                {modalCustomer ? <Edit className="text-primary" size={20} /> : <UserPlus className="text-primary" size={20} />} 
                {modalCustomer ? 'Edit Data Member' : 'Pendaftaran Member Baru'}
              </h2>
              <button className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors shadow-sm" onClick={() => setIsModalOpen(false)}><X size={18} /></button>
            </div>
            
            <form onSubmit={handleSaveCustomer} className="flex-1 flex flex-col overflow-hidden min-h-0">
              <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto max-h-[calc(100vh-140px)] sm:max-h-[70vh] pb-24 sm:pb-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nama Lengkap *</label>
                  <input 
                    type="text" 
                    className="form-control w-full" 
                    placeholder="Nama pelanggan..."
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Nomor Telepon / WA *</label>
                  <input 
                    type="tel" 
                    className="form-control w-full" 
                    placeholder="Contoh: 08123456789"
                    required
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Alamat Email (Opsional)</label>
                  <input 
                    type="email" 
                    className="form-control w-full" 
                    placeholder="pelanggan@domain.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tanggal Lahir (Opsional)</label>
                  <input 
                    type="text" 
                    className="form-control w-full" 
                    placeholder="Format: DD-MM (Contoh: 28-06)"
                    value={formData.birthday}
                    onChange={e => setFormData({ ...formData, birthday: e.target.value })}
                  />
                </div>

                {/* Price Tier & Plafon Bon Kredit (Retail & Bengkel) */}
                <div className="p-3 border border-indigo-100 bg-indigo-50/50 rounded-xl space-y-3">
                  <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Store size={14} className="text-indigo-600" />
                    <span>Klasifikasi Tier Harga &amp; Bon Tempo</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Tier Harga Pelanggan</label>
                      <select
                        className="form-control w-full text-xs font-bold"
                        value={formData.priceTier}
                        onChange={e => setFormData({ ...formData, priceTier: e.target.value })}
                      >
                        <option value="UMUM">UMUM (Harga Eceran)</option>
                        <option value="MITRA">MITRA (Warung Langganan)</option>
                        <option value="GROSIR">GROSIR (Partai / Volume)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Plafon Bon Kredit (Rp)</label>
                      <input
                        type="number"
                        className="form-control w-full text-xs"
                        placeholder="Contoh: 5000000"
                        value={formData.creditLimit || ''}
                        onChange={e => setFormData({ ...formData, creditLimit: Number(e.target.value) || 0 })}
                      />
                      <span className="text-[9.5px] text-slate-400">0 = Tanpa limit / tunai saja</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Termin Jatuh Tempo (Hari)</label>
                    <input
                      type="number"
                      className="form-control w-full text-xs"
                      placeholder="14"
                      value={formData.creditTermDays || 14}
                      onChange={e => setFormData({ ...formData, creditTermDays: Number(e.target.value) || 14 })}
                    />
                    <span className="text-[9.5px] text-slate-400">Batas waktu pelunasan bon nota (Net-14, Net-30)</span>
                  </div>
                </div>

                {/* Points Adjustment (Only for Admin when editing) */}
                {modalCustomer && isAdminOrOwner && (
                  <div className="p-3 border border-amber-200 bg-amber-50/50 rounded-lg flex flex-col gap-3">
                    <div className="text-xs font-bold text-amber-800 flex items-center gap-1">
                      <AlertTriangle size={14} />
                      <span>Penyesuaian Saldo Poin (Khusus Admin)</span>
                    </div>
                    <div className="text-xs text-amber-700">Poin aktif saat ini: <strong>{modalCustomer.points} pts</strong></div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-[10px] text-gray-600 mb-0.5">Jumlah Mutasi Poin</label>
                        <input 
                          type="number" 
                          className="form-control w-full" 
                          placeholder="Contoh: 10 atau -10"
                          value={formData.pointsAdjustment || ''}
                          onChange={e => setFormData({ ...formData, pointsAdjustment: Number(e.target.value) })}
                        />
                      </div>
                      <div className="flex-[2]">
                        <label className="block text-[10px] text-gray-600 mb-0.5">Alasan Perubahan</label>
                        <input 
                          type="text" 
                          className="form-control w-full" 
                          placeholder="Alasan penyesuaian..."
                          value={formData.adjustmentReason}
                          onChange={e => setFormData({ ...formData, adjustmentReason: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-5 flex gap-3 border-t border-gray-100 bg-slate-50 shrink-0">
                <button type="button" className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all active:scale-95" onClick={() => setIsModalOpen(false)}>Batal</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-200 transition-all active:scale-95">Simpan Data</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Debt Modal Dialog */}
      {isPayModalOpen && selectedDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-md sm:rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden border-0 sm:border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="font-extrabold text-base sm:text-lg text-slate-800 flex items-center gap-2">
                <Wallet className="text-red-500" size={20} /> Bayar Piutang / Kasbon
              </h2>
              <button className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors shadow-sm" onClick={() => setIsPayModalOpen(false)}><X size={18} /></button>
            </div>
            
            <form onSubmit={handlePayDebt} className="flex-1 flex flex-col overflow-hidden min-h-0">
              <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto max-h-[calc(100vh-140px)] sm:max-h-[70vh] pb-24 sm:pb-4">
                <div className="p-3 border border-red-100 bg-red-50/10 rounded-lg">
                  <div className="text-xs text-muted font-bold uppercase">No. Order</div>
                  <div className="text-sm font-mono font-bold text-gray-800">{selectedDebt.order?.orderNumber || 'Manual'}</div>
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-dashed border-red-200">
                    <div>
                      <span className="text-[10px] text-muted block">Total Piutang</span>
                      <span className="text-xs font-bold text-gray-700">{formatCurrency(selectedDebt.amount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted block">Sisa Tagihan</span>
                      <span className="text-xs font-bold text-red-600">{formatCurrency(selectedDebt.remaining)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Jumlah Pembayaran *</label>
                  <input 
                    type="number" 
                    className="form-control w-full" 
                    placeholder="Masukkan nominal bayar..."
                    required
                    max={selectedDebt.remaining}
                    min={1}
                    value={payAmount || ''}
                    onChange={e => setPayAmount(Number(e.target.value))}
                  />
                  <div className="flex gap-1.5 mt-1.5">
                    <button
                      type="button"
                      className="btn btn-outline btn-xs py-0.5 px-2 bg-slate-50 text-[10px]"
                      onClick={() => setPayAmount(selectedDebt.remaining)}
                    >
                      Bayar Lunas
                    </button>
                    {selectedDebt.remaining > 50000 && (
                      <button
                        type="button"
                        className="btn btn-outline btn-xs py-0.5 px-2 bg-slate-50 text-[10px]"
                        onClick={() => setPayAmount(50000)}
                      >
                        Rp 50.000
                      </button>
                    )}
                    {selectedDebt.remaining > 100000 && (
                      <button
                        type="button"
                        className="btn btn-outline btn-xs py-0.5 px-2 bg-slate-50 text-[10px]"
                        onClick={() => setPayAmount(100000)}
                      >
                        Rp 100.000
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Metode Pembayaran *</label>
                  <select 
                    className="form-control w-full"
                    required
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value)}
                  >
                    <option value="Tunai">Tunai / Cash</option>
                    <option value="Transfer">Transfer Bank</option>
                    <option value="Kartu">Debit / Kredit</option>
                  </select>
                </div>
              </div>

              <div className="p-4 sm:p-5 flex gap-3 border-t border-gray-100 bg-slate-50 shrink-0">
                <button type="button" className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all active:scale-95" onClick={() => setIsPayModalOpen(false)}>Batal</button>
                <button type="submit" className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs shadow-md shadow-primary/20 transition-all active:scale-95" disabled={payLoading}>
                  {payLoading ? 'Memproses...' : 'Simpan Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE VOUCHER MODAL DIALOG */}
      {isVoucherModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Ticket size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Buat Kupon Promo Baru</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Buat kode diskon untuk diterapkan di kasir POS</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVoucherModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors shadow-sm"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateVoucher} className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kode Voucher / Promo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: RAMEN20"
                    value={voucherForm.code}
                    onChange={e => setVoucherForm({ ...voucherForm, code: e.target.value.toUpperCase() })}
                    className="form-control w-full font-mono uppercase font-black"
                  />
                  <span className="text-[10px] text-slate-400">Kode unik tanpa spasi</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tipe Potongan *</label>
                  <select
                    className="form-control w-full font-bold"
                    value={voucherForm.type}
                    onChange={e => setVoucherForm({ ...voucherForm, type: e.target.value })}
                  >
                    <option value="PERCENT">Persentase (%)</option>
                    <option value="FIXED">Nominal Tetap (Rp)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi Singkat</label>
                <input
                  type="text"
                  placeholder="Contoh: Promo Grand Opening Diskon 20%"
                  value={voucherForm.description}
                  onChange={e => setVoucherForm({ ...voucherForm, description: e.target.value })}
                  className="form-control w-full text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {voucherForm.type === 'PERCENT' ? 'Persentase Diskon (%) *' : 'Nominal Diskon (Rp) *'}
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={voucherForm.type === 'PERCENT' ? 100 : undefined}
                    placeholder={voucherForm.type === 'PERCENT' ? 'Contoh: 15' : 'Contoh: 20000'}
                    value={voucherForm.amount}
                    onChange={e => setVoucherForm({ ...voucherForm, amount: e.target.value })}
                    className="form-control w-full font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Minimal Belanja (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="0 jika tanpa batas"
                    value={voucherForm.minSpend}
                    onChange={e => setVoucherForm({ ...voucherForm, minSpend: e.target.value })}
                    className="form-control w-full font-bold"
                  />
                </div>
              </div>

              {voucherForm.type === 'PERCENT' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Maksimal Nilai Diskon (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Kosongkan jika tanpa batas maksimum"
                    value={voucherForm.maxDiscount}
                    onChange={e => setVoucherForm({ ...voucherForm, maxDiscount: e.target.value })}
                    className="form-control w-full font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Batas maksimal nominal hemat yang didapatkan pelanggan</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Batas Kuota Pemakaian</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="Kosongkan jika tak terbatas"
                    value={voucherForm.maxUsage}
                    onChange={e => setVoucherForm({ ...voucherForm, maxUsage: e.target.value })}
                    className="form-control w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Berlaku Sampai Tanggal</label>
                  <input
                    type="date"
                    value={voucherForm.validUntil}
                    onChange={e => setVoucherForm({ ...voucherForm, validUntil: e.target.value })}
                    className="form-control w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status Voucher</label>
                <select
                  className="form-control w-full font-bold"
                  value={voucherForm.status}
                  onChange={e => setVoucherForm({ ...voucherForm, status: e.target.value })}
                >
                  <option value="Aktif">Aktif (Bisa Dipakai di Kasir)</option>
                  <option value="Nonaktif">Nonaktif (Diarsipkan)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsVoucherModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={voucherSubmitting}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50"
                >
                  {voucherSubmitting ? 'Menyimpan...' : 'Simpan Kupon Promo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMView;
