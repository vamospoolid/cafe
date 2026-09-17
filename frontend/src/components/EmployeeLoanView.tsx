import React, { useState, useEffect, useContext, useMemo } from 'react';
import { 
  CreditCard, Plus, Search, Filter, Calendar, CheckCircle2, Clock, 
  Trash2, Edit3, DollarSign, User, AlertCircle, Eye, ChevronRight,
  TrendingDown, FileText, Check, X, Building2, Wallet, ArrowUpRight,
  Receipt, RefreshCw
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';

interface EmployeeLoan {
  id: number;
  userId: number;
  amount: number;
  remaining: number;
  date: string;
  source: 'KAS_OWNER' | 'KASIR';
  reason?: string;
  status: 'Belum Lunas' | 'Lunas';
  approvedBy?: string;
  settledAt?: string;
  settledNote?: string;
  user?: {
    id: number;
    name: string;
    username: string;
    role: string;
    employmentType?: string;
    status?: string;
  };
  payments?: {
    id: number;
    amountPaid: number;
    paymentDate: string;
    paymentMethod: string;
    notes?: string;
    paidBy?: string;
  }[];
}

const EmployeeLoanView: React.FC = () => {
  const posContext = useContext(POSContext);
  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Belum Lunas' | 'Lunas'>('ALL');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('ALL');

  // Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<EmployeeLoan | null>(null);
  const [formData, setFormData] = useState({
    userId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    source: 'KAS_OWNER',
    reason: '',
    approvedBy: ''
  });

  // Payment Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedLoanForPay, setSelectedLoanForPay] = useState<EmployeeLoan | null>(null);
  const [payFormData, setPayFormData] = useState({
    amountPaid: '',
    paymentMethod: 'POTONG_GAJI',
    notes: 'Potong Gaji / Pelunasan Kasbon'
  });

  // Detail Modal
  const [detailLoan, setDetailLoan] = useState<EmployeeLoan | null>(null);

  const formatRupiah = (num: number) => {
    return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.filter((u: any) => u.status !== 'Nonaktif'));
      }
    } catch (e) {
      console.error('Fetch employees error:', e);
    }
  };

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const [loansRes, summaryRes] = await Promise.all([
        fetch('/api/employee-loans', {
          headers: { Authorization: `Bearer ${posContext?.token}` }
        }),
        fetch('/api/employee-loans/summary', {
          headers: { Authorization: `Bearer ${posContext?.token}` }
        })
      ]);

      if (loansRes.ok) {
        const data = await loansRes.json();
        setLoans(data);
      }
      if (summaryRes.ok) {
        const sData = await summaryRes.json();
        setSummary(sData);
      }
    } catch (e) {
      console.error('Fetch loans error:', e);
      toast('Gagal memuat data kasbon karyawan', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchLoans();
  }, [posContext?.token]);

  const handleOpenCreateModal = () => {
    setEditingLoan(null);
    setFormData({
      userId: employees.length > 0 ? String(employees[0].id) : '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      source: 'KAS_OWNER',
      reason: '',
      approvedBy: (posContext?.user as any)?.name || posContext?.user?.username || 'Owner / Manajemen'
    });
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (loan: EmployeeLoan) => {
    setEditingLoan(loan);
    setFormData({
      userId: String(loan.userId),
      amount: String(loan.amount),
      date: loan.date ? loan.date.split('T')[0] : new Date().toISOString().split('T')[0],
      source: loan.source,
      reason: loan.reason || '',
      approvedBy: loan.approvedBy || ''
    });
    setIsFormModalOpen(true);
  };

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.userId) return toast('Pilih karyawan terlebih dahulu', 'error');
    if (!formData.amount || Number(formData.amount) <= 0) return toast('Masukkan nominal kasbon yang valid', 'error');

    try {
      const url = editingLoan ? `/api/employee-loans/${editingLoan.id}` : '/api/employee-loans';
      const method = editingLoan ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify(formData)
      });

      const resData = await res.json();
      if (res.ok) {
        toast(editingLoan ? 'Kasbon berhasil diperbarui' : 'Kasbon berhasil dicatat!', 'success');
        setIsFormModalOpen(false);
        fetchLoans();
      } else {
        toast(resData.error || 'Gagal menyimpan kasbon', 'error');
      }
    } catch (err: any) {
      console.error(err);
      toast('Terjadi kesalahan koneksi', 'error');
    }
  };

  const handleOpenPayModal = (loan: EmployeeLoan) => {
    setSelectedLoanForPay(loan);
    setPayFormData({
      amountPaid: String(loan.remaining),
      paymentMethod: 'POTONG_GAJI',
      notes: `Potong Gaji / Pelunasan Kasbon (${loan.user?.name || ''})`
    });
    setIsPayModalOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanForPay) return;
    if (!payFormData.amountPaid || Number(payFormData.amountPaid) <= 0) {
      return toast('Nominal pembayaran harus lebih dari 0', 'error');
    }

    try {
      const res = await fetch(`/api/employee-loans/${selectedLoanForPay.id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify(payFormData)
      });

      const resData = await res.json();
      if (res.ok) {
        toast('Pembayaran/pelunasan kasbon berhasil dicatat!', 'success');
        setIsPayModalOpen(false);
        fetchLoans();
      } else {
        toast(resData.error || 'Gagal memproses pembayaran', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan server', 'error');
    }
  };

  const handleDeleteLoan = async (loan: EmployeeLoan) => {
    const resConfirm = await confirmAlert(
      'Hapus Kasbon?',
      `Yakin ingin menghapus catatan kasbon ${loan.user?.name} senilai ${formatRupiah(loan.amount)}?`
    );

    if (!resConfirm.isConfirmed) return;

    try {
      const res = await fetch(`/api/employee-loans/${loan.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });

      if (res.ok) {
        toast('Catatan kasbon berhasil dihapus', 'success');
        fetchLoans();
      } else {
        const data = await res.json();
        toast(data.error || 'Gagal menghapus kasbon', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan koneksi', 'error');
    }
  };

  const filteredLoans = useMemo(() => {
    return loans.filter(l => {
      const matchSearch = l.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.approvedBy?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchStatus = statusFilter === 'ALL' || l.status === statusFilter;
      const matchUser = selectedUserFilter === 'ALL' || String(l.userId) === selectedUserFilter;

      return matchSearch && matchStatus && matchUser;
    });
  }, [loans, searchQuery, statusFilter, selectedUserFilter]);

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-3.5 sm:space-y-6 pb-28 sm:pb-12 animate-in fade-in duration-200">
      
      {/* Header View */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
            <CreditCard size={22} className="sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-black text-slate-900 tracking-tight truncate">
              Kasbon &amp; Pinjaman Staf
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5 line-clamp-1 sm:line-clamp-none">
              Pencatatan kasbon dari kas owner/kasir &amp; otomatisasi potong gaji
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-xl text-xs font-black shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
        >
          <Plus size={16} /> Input Kasbon Baru
        </button>
      </div>

      {/* Stats Summary Cards (Responsive 2x2 on Mobile, 4 Cols on Desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        
        {/* Card 1: Total Outstanding */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-rose-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-rose-500 block leading-tight">
              Belum Lunas
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <TrendingDown size={16} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm sm:text-2xl font-black text-slate-900 tracking-tight block truncate">
              {formatRupiah(summary?.totalOutstanding || 0)}
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5 block truncate">
              {summary?.activeLoanCount || 0} pinjaman aktif
            </span>
          </div>
        </div>

        {/* Card 2: Jumlah Karyawan Berhutang */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-amber-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-600 block leading-tight">
              Staf Berhutang
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <User size={16} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm sm:text-2xl font-black text-slate-900 tracking-tight block">
              {summary?.uniqueEmployeesWithDebt || 0} <span className="text-xs font-bold text-slate-400">orang</span>
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5 block truncate">
              Potong saat gajian
            </span>
          </div>
        </div>

        {/* Card 3: Total Pinjaman Bulan Ini */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-indigo-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-indigo-600 block leading-tight">
              Bulan Ini
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Calendar size={16} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm sm:text-2xl font-black text-slate-900 tracking-tight block truncate">
              {formatRupiah(summary?.totalLoansThisMonth || 0)}
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5 block truncate">
              Periode {new Date().toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Card 4: Sumber Kas Terbanyak */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-emerald-200/80 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-emerald-600 block leading-tight">
              Sumber Kas
            </span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Building2 size={16} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xs sm:text-lg font-black text-slate-800 tracking-tight block truncate">
              Kas Owner
            </span>
            <span className="text-[10px] sm:text-[11px] text-emerald-600 font-bold mt-0.5 block truncate">
              ✓ Laci kasir aman
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-2.5 sm:gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-1 items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-2.5 sm:top-3 text-slate-400" />
            <input 
              type="text"
              placeholder="Cari staf, alasan kasbon..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto">
          {/* Filter Status */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl flex-1 sm:flex-initial justify-between">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all text-center ${
                statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Belum Lunas')}
              className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all text-center whitespace-nowrap ${
                statusFilter === 'Belum Lunas' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Belum Lunas
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Lunas')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all text-center ${
                statusFilter === 'Lunas' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Lunas
            </button>
          </div>

          {/* Filter Karyawan */}
          <select
            value={selectedUserFilter}
            onChange={e => setSelectedUserFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white cursor-pointer shrink-0"
          >
            <option value="ALL">Semua Karyawan</option>
            {employees.map(u => (
              <option key={u.id} value={String(u.id)}>{u.name} ({u.role})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content: Mobile Vertical Cards & Desktop Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
        
        {/* ── MOBILE CARDS VIEW (< 640px) ── */}
        <div className="sm:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <RefreshCw size={24} className="animate-spin inline-block text-indigo-600 mb-2" />
              <p className="text-xs font-semibold">Memuat data kasbon karyawan...</p>
            </div>
          ) : filteredLoans.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <CreditCard size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="font-bold text-slate-700 text-xs">Tidak ada data kasbon ditemukan</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Semua kasbon sudah lunas atau belum ada catatan input.</p>
            </div>
          ) : (
            filteredLoans.map(loan => (
              <div key={loan.id} className="p-3.5 space-y-3 bg-white hover:bg-slate-50/50 transition-colors">
                
                {/* Header: User & Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 font-black text-xs flex items-center justify-center border border-indigo-100 shrink-0">
                      {loan.user?.name?.substring(0, 2).toUpperCase() || 'ST'}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-xs text-slate-900 leading-tight truncate">
                        {loan.user?.name || 'Karyawan'}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 font-bold">
                          {loan.user?.role || 'Staff'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(loan.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase inline-flex items-center gap-1 shrink-0 ${
                      loan.status === 'Lunas'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {loan.status === 'Lunas' ? (
                      <>
                        <CheckCircle2 size={11} /> Lunas
                      </>
                    ) : (
                      <>
                        <Clock size={11} /> Belum Lunas
                      </>
                    )}
                  </span>
                </div>

                {/* Reason Note */}
                {loan.reason && (
                  <p className="text-[11px] text-slate-600 font-medium italic bg-slate-50/80 px-2.5 py-1.5 rounded-xl border border-slate-100">
                    "{loan.reason}"
                  </p>
                )}

                {/* 2x2 Financial Metrics Block */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Pinjaman Awal</span>
                    <span className="font-black text-slate-800 text-xs mt-0.5 block">
                      {formatRupiah(loan.amount)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Sisa Belum Lunas</span>
                    <span className={`font-black text-xs mt-0.5 block ${loan.remaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {loan.remaining > 0 ? formatRupiah(loan.remaining) : 'Rp 0 (Lunas)'}
                    </span>
                  </div>

                  <div className="pt-1.5 border-t border-slate-200/60 col-span-2 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-medium">
                      Sumber Dana:
                    </span>
                    {loan.source === 'KAS_OWNER' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700">
                        <Building2 size={11} /> Kas Owner / Transfer
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700">
                        <Wallet size={11} /> Laci Kasir (Petty Cash)
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Toolbar */}
                <div className="flex items-center justify-between gap-1.5 pt-1">
                  {loan.remaining > 0 ? (
                    <button
                      type="button"
                      onClick={() => handleOpenPayModal(loan)}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1.5 transition-all"
                    >
                      <DollarSign size={14} /> Pelunasan / Potong
                    </button>
                  ) : (
                    <div className="flex-1 py-1.5 px-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-black text-center flex items-center justify-center gap-1">
                      <CheckCircle2 size={13} /> Selesai Dilunasi
                    </div>
                  )}

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDetailLoan(loan)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                      title="Lihat Detail & Riwayat"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(loan)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-colors"
                      title="Edit Kasbon"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLoan(loan)}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors border border-rose-200"
                      title="Hapus Kasbon"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>

        {/* ── DESKTOP TABLE VIEW (>= 640px) ── */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                <th className="p-4 pl-6">Karyawan / Staf</th>
                <th className="p-4">Tanggal Pinjam</th>
                <th className="p-4">Sumber Kas</th>
                <th className="p-4 text-right">Nominal Pinjaman</th>
                <th className="p-4 text-right">Sisa Belum Lunas</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 pr-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Memuat data kasbon karyawan...
                  </td>
                </tr>
              ) : filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    <CreditCard size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="font-bold text-slate-600 text-sm">Tidak ada data kasbon ditemukan</p>
                    <p className="text-xs text-slate-400 mt-0.5">Semua kasbon sudah lunas atau belum ada data input.</p>
                  </td>
                </tr>
              ) : (
                filteredLoans.map(loan => (
                  <tr key={loan.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 font-black text-xs flex items-center justify-center border border-indigo-100 shrink-0">
                          {loan.user?.name?.substring(0, 2).toUpperCase() || 'ST'}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 text-sm block">{loan.user?.name || 'Karyawan'}</span>
                          <span className="text-[11px] text-slate-400 font-medium block">
                            {loan.user?.role || 'Staff'} {loan.reason ? `• ${loan.reason}` : ''}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 font-medium text-slate-600">
                      {new Date(loan.date).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>

                    <td className="p-4">
                      {loan.source === 'KAS_OWNER' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-100">
                          <Building2 size={12} /> Kas Owner / Transfer
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-[11px] font-bold border border-amber-200">
                          <Wallet size={12} /> Kasir (Petty Cash)
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-right font-black text-slate-900 text-xs sm:text-sm">
                      {formatRupiah(loan.amount)}
                    </td>

                    <td className="p-4 text-right">
                      {loan.remaining > 0 ? (
                        <span className="font-black text-rose-600 text-xs sm:text-sm">
                          {formatRupiah(loan.remaining)}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-bold">Rp 0 (Lunas)</span>
                      )}
                    </td>

                    <td className="p-4 text-center">
                      {loan.status === 'Lunas' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-black border border-emerald-200">
                          <CheckCircle2 size={12} /> Lunas
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[11px] font-black border border-rose-200">
                          <Clock size={12} /> Belum Lunas
                        </span>
                      )}
                    </td>

                    <td className="p-4 pr-6 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {loan.remaining > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenPayModal(loan)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-lg text-[11px] font-black transition-all border border-indigo-200 flex items-center gap-1 cursor-pointer"
                            title="Proses Pembayaran / Potong Gaji"
                          >
                            <DollarSign size={13} /> Bayar
                          </button>
                        )}
                        
                        <button
                          type="button"
                          onClick={() => setDetailLoan(loan)}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
                          title="Lihat Riwayat & Detail"
                        >
                          <Eye size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(loan)}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer"
                          title="Edit Kasbon"
                        >
                          <Edit3 size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteLoan(loan)}
                          className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-all border border-rose-200 cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Input / Edit Kasbon */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3.5 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/50 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    {editingLoan ? 'Edit Data Kasbon' : 'Input Kasbon Karyawan'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium">Catat pinjaman dana operasional untuk staf</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsFormModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center active:scale-95 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveLoan} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1">
              {/* Karyawan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Karyawan / Peminjam <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.userId}
                  onChange={e => setFormData(p => ({ ...p, userId: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                  required
                >
                  <option value="">-- Pilih Karyawan --</option>
                  {employees.map(u => (
                    <option key={u.id} value={u.id}>{u.name} — {u.role} ({u.employmentType || 'FULL_TIME'})</option>
                  ))}
                </select>
              </div>

              {/* Nominal & Tanggal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nominal Kasbon <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                    <input 
                      type="number"
                      placeholder="0"
                      value={formData.amount}
                      onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                      className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 outline-none focus:border-indigo-500 focus:bg-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Tanggal Pinjam <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                    required
                  />
                </div>
              </div>

              {/* Sumber Kas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Sumber Dana Kasbon
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    formData.source === 'KAS_OWNER' ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}>
                    <input 
                      type="radio" 
                      name="source" 
                      value="KAS_OWNER"
                      checked={formData.source === 'KAS_OWNER'}
                      onChange={e => setFormData(p => ({ ...p, source: e.target.value }))}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-black text-slate-800 block">Kas Owner / Bank</span>
                      <span className="text-[10px] text-slate-500 block">Tidak potong laci kasir</span>
                    </div>
                  </label>

                  <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    formData.source === 'KASIR' ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}>
                    <input 
                      type="radio" 
                      name="source" 
                      value="KASIR"
                      checked={formData.source === 'KASIR'}
                      onChange={e => setFormData(p => ({ ...p, source: e.target.value }))}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="text-xs font-black text-slate-800 block">Laci Kasir (Petty Cash)</span>
                      <span className="text-[10px] text-amber-600 block">Potong uang shift kasir</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Keperluan / Alasan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Keperluan / Alasan Kasbon
                </label>
                <input 
                  type="text"
                  placeholder="Contoh: Kebutuhan keluarga mendesak, obat..."
                  value={formData.reason}
                  onChange={e => setFormData(p => ({ ...p, reason: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              {/* Disetujui Oleh */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Disetujui Oleh
                </label>
                <input 
                  type="text"
                  placeholder="Nama Owner / Manager"
                  value={formData.approvedBy}
                  onChange={e => setFormData(p => ({ ...p, approvedBy: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              {/* Footer Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold active:scale-95 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-500/20 flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <Check size={16} /> {editingLoan ? 'Simpan Perubahan' : 'Simpan Kasbon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pelunasan / Potong Gaji */}
      {isPayModalOpen && selectedLoanForPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3.5 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/50 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200 shrink-0">
                  <DollarSign size={20} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">Pelunasan Kasbon</h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium">{selectedLoanForPay.user?.name}</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsPayModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center active:scale-95 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Pinjaman Awal:</span>
                  <span className="font-bold text-slate-700">{formatRupiah(selectedLoanForPay.amount)}</span>
                </div>
                <div className="flex justify-between text-rose-600 font-black">
                  <span>Sisa Belum Lunas:</span>
                  <span>{formatRupiah(selectedLoanForPay.remaining)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nominal Pembayaran <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                  <input 
                    type="number"
                    max={selectedLoanForPay.remaining}
                    value={payFormData.amountPaid}
                    onChange={e => setPayFormData(p => ({ ...p, amountPaid: e.target.value }))}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 outline-none focus:border-indigo-500 focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Metode Pembayaran
                </label>
                <select
                  value={payFormData.paymentMethod}
                  onChange={e => setPayFormData(p => ({ ...p, paymentMethod: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                >
                  <option value="POTONG_GAJI">Potong Gaji (Payroll Deduction)</option>
                  <option value="TUNAI">Tunai / Cash</option>
                  <option value="TRANSFER">Transfer Bank</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Catatan Pelunasan
                </label>
                <input 
                  type="text"
                  value={payFormData.notes}
                  onChange={e => setPayFormData(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold active:scale-95 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-500/20 flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <Check size={16} /> Proses Pelunasan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail & Riwayat Pembayaran */}
      {detailLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3.5 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/50 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">Detail Kasbon</h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium">{detailLoan.user?.name}</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setDetailLoan(null)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center active:scale-95 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-2.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Peminjam</span>
                  <span className="font-bold text-slate-800 text-xs sm:text-sm">{detailLoan.user?.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Tanggal Pinjam</span>
                  <span className="font-bold text-slate-800 text-xs sm:text-sm">
                    {new Date(detailLoan.date).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Nominal Pinjaman</span>
                  <span className="font-black text-slate-900 text-xs sm:text-sm">{formatRupiah(detailLoan.amount)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Sisa Belum Lunas</span>
                  <span className="font-black text-rose-600 text-xs sm:text-sm">{formatRupiah(detailLoan.remaining)}</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-200">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Keperluan / Catatan</span>
                  <span className="font-medium text-slate-700">{detailLoan.reason || '-'}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                  Riwayat Pembayaran / Potongan
                </h4>
                {detailLoan.payments && detailLoan.payments.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {detailLoan.payments.map((p, idx) => (
                      <div key={p.id || idx} className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="font-black text-emerald-700 block text-xs">{formatRupiah(p.amountPaid)}</span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {new Date(p.paymentDate).toLocaleDateString('id-ID', { dateStyle: 'medium' })} • {p.paymentMethod}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium text-right">
                          {p.notes || 'Pelunasan'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 p-4 text-center bg-slate-50 rounded-xl border border-slate-200">
                    Belum ada pembayaran atau potongan gaji untuk kasbon ini.
                  </p>
                )}
              </div>

              <div className="pt-3 flex justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDetailLoan(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold active:scale-95 transition-all"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeLoanView;
