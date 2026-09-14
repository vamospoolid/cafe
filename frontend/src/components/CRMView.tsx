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
  Eye
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';

const CRMView = () => {
  const posContext = useContext(POSContext);
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

  useEffect(() => {
    if (posContext?.token) {
      fetchCustomers();
    }
  }, [posContext?.token, searchQuery, selectedTier]);

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
    <div 
      className="p-3 sm:p-6 pb-32 sm:pb-8 flex-1 min-h-0 h-full w-full overflow-y-auto bg-slate-50 flex flex-col gap-4 relative"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Main CRM Workspace */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-slate-900">
              <Award className="text-primary" /> Manajemen CRM &amp; Loyalitas
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Pantau level keanggotaan pelanggan, total belanja, dan poin loyalitas</p>
          </div>
          <button 
            className="btn btn-primary shadow-sm flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold w-full sm:w-auto transition-all active:scale-95"
            onClick={() => handleOpenModal(null)}
          >
            <UserPlus size={16} /> Tambah Member Baru
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
        <div className="card flex-1 p-0 overflow-hidden shadow-sm border border-slate-200/80 rounded-2xl flex flex-col bg-white shrink-0">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-medium text-xs">Memuat data pelanggan...</div>
          ) : customers.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-medium text-xs">Tidak ada member ditemukan.</div>
          ) : (
            <>
              {/* Mobile Member Cards (< 768px) */}
              <div className="md:hidden divide-y divide-slate-100">
                {customers.map((c) => {
                  const totalDebt = c.debts ? c.debts.filter((d: any) => d.status === 'Belum Lunas').reduce((sum: number, d: any) => sum + d.remaining, 0) : 0;
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
                        <span className={`text-[10px] px-2.5 py-0.5 font-extrabold rounded-full border ${getTierColor(c.tier)} shrink-0`}>
                          {c.tier}
                        </span>
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
                        {posContext?.user?.role === 'Admin' && (
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
              <div className="hidden md:block table-responsive flex-1 overflow-y-auto">
                <table className="data-table w-full text-left border-collapse">
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
                      const totalDebt = c.debts ? c.debts.filter((d: any) => d.status === 'Belum Lunas').reduce((sum: number, d: any) => sum + d.remaining, 0) : 0;
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
                            <span className={`text-[10px] px-2 py-0.5 font-bold rounded-full border ${getTierColor(c.tier)}`}>
                              {c.tier}
                            </span>
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
                              {posContext?.user?.role === 'Admin' && (
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
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
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
                  <span className="text-muted block">Akumulasi Belanja</span>
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

            {/* Shopping History List */}
            <div>
              <h4 className="font-bold text-sm text-gray-800 flex items-center gap-2 mb-3">
                <TrendingUp size={16} className="text-primary" /> 10 Transaksi Terakhir
              </h4>
              {drawerLoading ? (
                <div className="text-xs text-muted py-2 text-center">Memuat riwayat belanja...</div>
              ) : !customerDetail?.orders || customerDetail.orders.length === 0 ? (
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
        <div className="modal-overlay z-20">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header bg-slate-50 border-b border-gray-100">
              <h2 className="modal-title flex items-center gap-2">
                {modalCustomer ? <Edit className="text-primary" /> : <UserPlus className="text-primary" />} 
                {modalCustomer ? 'Edit Data Member' : 'Pendaftaran Member Baru'}
              </h2>
              <button className="icon-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveCustomer}>
              <div className="modal-body space-y-4">
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

                {/* Points Adjustment (Only for Admin when editing) */}
                {modalCustomer && posContext?.user?.role === 'Admin' && (
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

              <div className="modal-footer flex gap-3 border-t border-gray-100 bg-slate-50">
                <button type="button" className="btn btn-outline flex-1 justify-center" onClick={() => setIsModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary flex-1 justify-center">Simpan Data</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Debt Modal Dialog */}
      {isPayModalOpen && selectedDebt && (
        <div className="modal-overlay z-20">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header bg-slate-50 border-b border-gray-100">
              <h2 className="modal-title flex items-center gap-2">
                <Wallet className="text-red-500" /> Bayar Piutang / Kasbon
              </h2>
              <button className="icon-btn" onClick={() => setIsPayModalOpen(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handlePayDebt}>
              <div className="modal-body space-y-4">
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

              <div className="modal-footer flex gap-3 border-t border-gray-100 bg-slate-50">
                <button type="button" className="btn btn-outline flex-1 justify-center" onClick={() => setIsPayModalOpen(false)}>Batal</button>
                <button type="submit" className="btn btn-primary flex-1 justify-center" disabled={payLoading}>
                  {payLoading ? 'Memproses...' : 'Simpan Pembayaran'}
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
