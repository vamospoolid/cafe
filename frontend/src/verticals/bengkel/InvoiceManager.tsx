import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FileText, 
  Plus, 
  Printer, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Building, 
  ArrowLeft, 
  Search, 
  X, 
  Check, 
  Clock, 
  Receipt, 
  ChevronRight,
  ShieldAlert,
  Car
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import { generateWorkOrderInvoicePDF } from '../../utils/pdfGenerator';

export const InvoiceManager: React.FC = () => {
  const { token, settings } = usePOS();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Detail Modal / Printable View
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [billingName, setBillingName] = useState<string>('');
  const [billingAddress, setBillingAddress] = useState<string>('');
  const [billingNpwp, setBillingNpwp] = useState<string>('');
  const [taxRate, setTaxRate] = useState<number>(0.11); // PPN 11%
  const [availableWorkOrders, setAvailableWorkOrders] = useState<any[]>([]);
  const [selectedWoIds, setSelectedWoIds] = useState<string[]>([]);
  const [woSearchQuery, setWoSearchQuery] = useState<string>('');

  const fetchInvoices = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/bengkel/invoices', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
      toast('Gagal memuat daftar invoice', 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleOpenCreate = async () => {
    if (!token) return;
    try {
      // Fetch SPKs with status PAID or DONE to aggregate into invoice
      const res = await fetch('/api/bengkel/work-orders?status=ALL', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Saring hanya SPK yang tidak dibatalkan (CANCELLED)
        const validList = Array.isArray(data) ? data.filter((wo: any) => wo.status !== 'CANCELLED') : [];
        setAvailableWorkOrders(validList);
      }
      setSelectedWoIds([]);
      setBillingName('');
      setBillingAddress('');
      setBillingNpwp('');
      setWoSearchQuery('');
      setShowCreateModal(true);
    } catch (e) {
      console.error(e);
      toast('Gagal memuat SPK untuk pembuatan invoice', 'error');
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingName.trim() || selectedWoIds.length === 0) {
      toast('Nama penagihan dan minimal 1 SPK wajib dipilih', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/bengkel/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          billingName: billingName.trim(),
          billingAddress: billingAddress.trim() || null,
          billingNpwp: billingNpwp.trim() || null,
          workOrderIds: selectedWoIds,
          taxRate
        })
      });

      if (res.ok) {
        const created = await res.json();
        toast(`Invoice ${created.invoiceNumber} berhasil diterbitkan!`, 'success');
        setShowCreateModal(false);
        fetchInvoices();
      } else {
        const err = await res.json();
        toast(err.error || 'Gagal menerbitkan invoice', 'error');
      }
    } catch (e) {
      console.error(e);
      toast('Terjadi kesalahan koneksi', 'error');
    }
  };

  const handleViewDetail = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/bengkel/invoices/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedInvoice(data);
      }
    } catch (e) {
      console.error(e);
      toast('Gagal memuat rincian invoice', 'error');
    }
  };

  const handleUpdateStatus = async (invoiceId: string, newStatus: string) => {
    if (!token) return;
    try {
      setUpdatingStatusId(invoiceId);
      const res = await fetch(`/api/bengkel/invoices/${invoiceId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        toast(`Status invoice berhasil diubah menjadi ${newStatus === 'PAID' ? 'LUNAS' : newStatus}`, 'success');
        await fetchInvoices();
        if (selectedInvoice && selectedInvoice.id === invoiceId) {
          setSelectedInvoice((prev: any) => prev ? { ...prev, status: newStatus } : null);
        }
      } else {
        toast('Gagal memperbarui status invoice', 'error');
      }
    } catch (e) {
      console.error(e);
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Metrics
  const unpaidInvoices = useMemo(() => invoices.filter(i => i.status !== 'PAID'), [invoices]);
  const paidInvoices = useMemo(() => invoices.filter(i => i.status === 'PAID'), [invoices]);

  const unpaidTotal = useMemo(() => 
    unpaidInvoices.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0)
  , [unpaidInvoices]);

  const paidTotal = useMemo(() => 
    paidInvoices.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0)
  , [paidInvoices]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Status filter
      if (statusFilter === 'UNPAID' && inv.status === 'PAID') return false;
      if (statusFilter === 'PAID' && inv.status !== 'PAID') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = inv.invoiceNumber?.toLowerCase().includes(q);
        const matchName = inv.billingName?.toLowerCase().includes(q);
        const matchNpwp = inv.billingNpwp?.toLowerCase().includes(q);
        if (!matchNum && !matchName && !matchNpwp) return false;
      }

      return true;
    });
  }, [invoices, statusFilter, searchQuery]);

  // Selected SPK sum in Create Modal
  const selectedWoTotal = useMemo(() => {
    const selected = availableWorkOrders.filter(w => selectedWoIds.includes(w.id));
    const subtotal = selected.reduce((sum, w) => sum + (Number(w.totalAmount) || 0), 0);
    const tax = subtotal * taxRate;
    return {
      subtotal,
      tax,
      total: subtotal + tax
    };
  }, [availableWorkOrders, selectedWoIds, taxRate]);

  const filteredAvailableWo = useMemo(() => {
    if (!woSearchQuery.trim()) return availableWorkOrders;
    const q = woSearchQuery.toLowerCase().trim();
    return availableWorkOrders.filter(w => 
      w.spkNumber?.toLowerCase().includes(q) ||
      w.vehiclePlate?.toLowerCase().includes(q) ||
      w.customerName?.toLowerCase().includes(q)
    );
  }, [availableWorkOrders, woSearchQuery]);

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen pb-32 sm:pb-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase bg-purple-100 text-purple-800 mb-1.5">
            <Building size={13} />
            B2B & Fleet Billing
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Invoice Penagihan Formal
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Faktur tagihan gabungan SPK berformat resmi A4 untuk mitra instansi, perusahaan logistik, rental, atau ojek online.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-700 hover:bg-purple-800 active:scale-95 text-white font-semibold text-sm rounded-xl shadow-sm shadow-purple-200 transition"
        >
          <Plus size={18} />
          Terbitkan Invoice Baru
        </button>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <Receipt size={22} />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Diterbitkan</div>
            <div className="text-lg font-black text-slate-900">{invoices.length} Invoice</div>
            <div className="text-xs text-slate-400 font-mono">
              Rp {(unpaidTotal + paidTotal).toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200/80 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={22} />
          </div>
          <div>
            <div className="text-xs font-medium text-amber-700 uppercase tracking-wide">Belum Lunas (Unpaid)</div>
            <div className="text-lg font-black text-amber-900">{unpaidInvoices.length} Invoice</div>
            <div className="text-xs font-bold text-amber-600 font-mono">
              Rp {unpaidTotal.toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Sudah Lunas (Paid)</div>
            <div className="text-lg font-black text-emerald-900">{paidInvoices.length} Invoice</div>
            <div className="text-xs font-bold text-emerald-600 font-mono">
              Rp {paidTotal.toLocaleString('id-ID')}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nomor invoice, klien / PT, atau NPWP..."
            className="w-full pl-9 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
              statusFilter === 'ALL'
                ? 'bg-purple-700 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Semua ({invoices.length})
          </button>
          <button
            onClick={() => setStatusFilter('UNPAID')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
              statusFilter === 'UNPAID'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-amber-700 hover:bg-amber-50'
            }`}
          >
            Belum Lunas ({unpaidInvoices.length})
          </button>
          <button
            onClick={() => setStatusFilter('PAID')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
              statusFilter === 'PAID'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Lunas ({paidInvoices.length})
          </button>
        </div>
      </div>

      {/* Invoice List Container */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-sm">
          Memuat data invoice penagihan...
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FileText size={36} className="mx-auto text-slate-300 mb-2" />
          <h4 className="font-bold text-slate-700 text-base">Tidak ada invoice ditemukan</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'ALL'
              ? 'Coba sesuaikan kata kunci pencarian atau filter status Anda.'
              : 'Belum ada invoice B2B yang diterbitkan. Klik tombol Terbitkan Invoice Baru untuk membuat faktur tagihan gabungan SPK.'}
          </p>
        </div>
      ) : (
        <>
          {/* MOBILE VIEW: Responsive Cards (block md:hidden) */}
          <div className="block md:hidden space-y-3">
            {filteredInvoices.map((inv) => {
              const isPaid = inv.status === 'PAID';
              return (
                <div
                  key={inv.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-purple-300 transition"
                >
                  {/* Top Bar: Invoice Number & Status Pill */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200/80 whitespace-nowrap">
                      {inv.invoiceNumber}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        isPaid
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isPaid ? <Check size={12} /> : <Clock size={12} />}
                      {isPaid ? 'LUNAS' : 'BELUM LUNAS'}
                    </span>
                  </div>

                  {/* Client Info */}
                  <div className="mb-3">
                    <h3 className="font-bold text-slate-900 text-sm">{inv.billingName}</h3>
                    {inv.billingNpwp && (
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                        NPWP: {inv.billingNpwp}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5">
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={13} className="text-slate-400" />
                        {new Date(inv.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                      <span>•</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {inv.workOrders?.length || 0} SPK
                      </span>
                    </div>
                  </div>

                  {/* Bottom Bar: Amount & Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div>
                      <div className="text-[11px] text-slate-400 uppercase font-medium">Total Tagihan</div>
                      <div className="text-base font-black text-slate-900">
                        Rp {inv.totalAmount.toLocaleString('id-ID')}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isPaid && (
                        <button
                          onClick={() => handleUpdateStatus(inv.id, 'PAID')}
                          disabled={updatingStatusId === inv.id}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-lg border border-emerald-200 transition"
                          title="Tandai Sudah Lunas"
                        >
                          <Check size={14} className="inline mr-1" />
                          Lunas
                        </button>
                      )}
                      <button
                        onClick={() => handleViewDetail(inv.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-lg shadow-sm transition"
                      >
                        <FileText size={14} />
                        Lihat Faktur
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP VIEW: Spacious Table (hidden md:block) */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-4 whitespace-nowrap">Nomor Invoice</th>
                    <th className="p-4">Klien / Perusahaan</th>
                    <th className="p-4 whitespace-nowrap">Tanggal Terbit</th>
                    <th className="p-4 text-center whitespace-nowrap">Jumlah SPK</th>
                    <th className="p-4 text-right whitespace-nowrap">Total Tagihan</th>
                    <th className="p-4 text-center whitespace-nowrap">Status</th>
                    <th className="p-4 text-center whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.map((inv) => {
                    const isPaid = inv.status === 'PAID';
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-4 font-mono font-bold text-purple-700 whitespace-nowrap">
                          {inv.invoiceNumber}
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-800">{inv.billingName}</div>
                          {inv.billingNpwp && (
                            <div className="text-xs text-slate-400 font-mono">
                              NPWP: {inv.billingNpwp}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-slate-600 text-xs whitespace-nowrap">
                          {new Date(inv.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="p-4 text-center whitespace-nowrap">
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {inv.workOrders?.length || 0} SPK
                          </span>
                        </td>
                        <td className="p-4 text-right font-black text-slate-900 whitespace-nowrap">
                          Rp {inv.totalAmount.toLocaleString('id-ID')}
                        </td>
                        <td className="p-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                              isPaid
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {isPaid ? <Check size={12} /> : <Clock size={12} />}
                            {isPaid ? 'LUNAS' : 'BELUM LUNAS'}
                          </span>
                        </td>
                        <td className="p-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            {!isPaid && (
                              <button
                                onClick={() => handleUpdateStatus(inv.id, 'PAID')}
                                disabled={updatingStatusId === inv.id}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-lg border border-emerald-200 transition"
                                title="Tandai Sudah Lunas"
                              >
                                Tandai Lunas
                              </button>
                            )}
                            <button
                              onClick={() => handleViewDetail(inv.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 font-semibold rounded-lg text-xs transition"
                              title="Lihat Faktur & Cetak A4"
                            >
                              <FileText size={15} />
                              Detail / A4
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal View A4 Formal Invoice */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-4 sm:p-8 shadow-2xl my-4 sm:my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-200 gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg">Pratinjau Faktur Tagihan Formal</h3>
                  <div className="text-xs text-slate-400 font-mono">{selectedInvoice.invoiceNumber}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {selectedInvoice.status !== 'PAID' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedInvoice.id, 'PAID')}
                    disabled={updatingStatusId === selectedInvoice.id}
                    className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition shadow-sm"
                  >
                    <Check size={14} />
                    Tandai Lunas
                  </button>
                )}
                <button
                  onClick={async () => {
                    try {
                      toast('Membuat dokumen PDF...', 'info');
                      await generateWorkOrderInvoicePDF(selectedInvoice, settings || {});
                      toast('Invoice PDF berhasil diunduh!', 'success');
                    } catch (e) {
                      console.error(e);
                      toast('Gagal mengunduh PDF invoice', 'error');
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition"
                >
                  <Download size={15} />
                  Download PDF
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-lg text-xs shadow-sm transition"
                >
                  <Printer size={15} />
                  Cetak A4
                </button>
              </div>
            </div>

            {/* Printable Paper Preview (Scrollable Area) */}
            <div className="overflow-y-auto flex-1 pr-1">
              <div className="border border-slate-200 rounded-xl p-5 sm:p-8 bg-white shadow-sm font-sans text-slate-800">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start pb-6 mb-6 border-b-2 border-slate-800 gap-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-purple-900 tracking-wide uppercase">
                      {settings?.storeName || 'BENGKEL REPARASI RESMI'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      {settings?.address || 'Jl. Raya Bengkel No. 12, Workshop Otomotif'}
                    </p>
                    <p className="text-xs text-slate-500">Telp: {settings?.phone || '0812-3456-7890'}</p>
                  </div>

                  <div className="sm:text-right">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-wider">FAKTUR INVOICE</h1>
                    <p className="text-sm font-bold text-purple-700 mt-1 font-mono">{selectedInvoice.invoiceNumber}</p>
                    <p className="text-xs text-slate-500">
                      Tanggal: {new Date(selectedInvoice.createdAt).toLocaleDateString('id-ID')}
                    </p>
                    <span
                      className={`inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        selectedInvoice.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {selectedInvoice.status === 'PAID' ? 'STATUS: LUNAS' : 'STATUS: MENUNGGU PEMBAYARAN'}
                    </span>
                  </div>
                </div>

                {/* Bill To */}
                <div className="mb-6 bg-slate-50/70 p-3 sm:p-4 rounded-lg border border-slate-100">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ditagihkan Kepada:</div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">{selectedInvoice.billingName}</h3>
                  {selectedInvoice.billingAddress && (
                    <p className="text-xs text-slate-600 mt-0.5">{selectedInvoice.billingAddress}</p>
                  )}
                  {selectedInvoice.billingNpwp && (
                    <p className="text-xs text-slate-500 font-mono mt-0.5">NPWP: {selectedInvoice.billingNpwp}</p>
                  )}
                </div>

                {/* SPK Table Breakdown */}
                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 font-bold text-slate-700 uppercase">
                      <tr>
                        <th className="p-3 whitespace-nowrap">No. SPK</th>
                        <th className="p-3 whitespace-nowrap">Plat Kendaraan</th>
                        <th className="p-3">Rincian Pekerjaan & Sparepart</th>
                        <th className="p-3 text-right whitespace-nowrap">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedInvoice.workOrders?.map((item: any) => (
                        <tr key={item.id}>
                          <td className="p-3 font-mono font-bold text-purple-700 whitespace-nowrap">
                            {item.workOrder?.spkNumber}
                          </td>
                          <td className="p-3 font-semibold whitespace-nowrap">
                            {item.workOrder?.vehiclePlate}
                          </td>
                          <td className="p-3 text-slate-600">
                            {item.workOrder?.services?.map((s: any) => s.serviceName).join(', ') || 'Jasa Servis'}
                            {item.workOrder?.parts?.length > 0 && ` + ${item.workOrder.parts.length} part`}
                          </td>
                          <td className="p-3 text-right font-bold text-slate-900 whitespace-nowrap">
                            Rp {item.amount.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="flex justify-end pt-4 border-t border-slate-200">
                  <div className="w-full sm:w-72 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal SPK</span>
                      <span className="font-semibold">Rp {selectedInvoice.subtotal.toLocaleString('id-ID')}</span>
                    </div>
                    {selectedInvoice.taxAmount > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>PPN (11%)</span>
                        <span className="font-semibold">Rp {selectedInvoice.taxAmount.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm sm:text-base font-black text-purple-900 pt-2 border-t border-slate-200">
                      <span>Total Tagihan</span>
                      <span>Rp {selectedInvoice.totalAmount.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Create Invoice */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl my-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">Terbitkan Faktur Invoice Baru</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Klien / Perusahaan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={billingName}
                  onChange={(e) => setBillingName(e.target.value)}
                  placeholder="Contoh: PT Sumber Logistik Express / CV Mitra Rent"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">NPWP Klien (Opsional)</label>
                  <input
                    type="text"
                    value={billingNpwp}
                    onChange={(e) => setBillingNpwp(e.target.value)}
                    placeholder="01.234.567.8-901.000"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pajak PPN</label>
                  <select
                    value={taxRate}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 bg-white"
                  >
                    <option value="0">Tanpa PPN (0%)</option>
                    <option value="0.11">PPN 11% (Standar Faktur Pajak)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Penagihan (Opsional)</label>
                <input
                  type="text"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="Jl. Sudirman No. 45, Gedung Menara..."
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Pilih SPK yang Digabungkan <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-xs font-bold text-purple-700">
                    {selectedWoIds.length} SPK Dipilih
                  </span>
                </div>

                {/* SPK quick search */}
                <input
                  type="text"
                  value={woSearchQuery}
                  onChange={(e) => setWoSearchQuery(e.target.value)}
                  placeholder="Filter no. SPK, plat nomor, atau pelanggan..."
                  className="w-full px-3 py-1.5 mb-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />

                <div className="border border-slate-200 rounded-xl p-2 max-h-48 overflow-y-auto space-y-1.5 bg-slate-50/50">
                  {filteredAvailableWo.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Tidak ada SPK aktif yang dapat digabungkan.
                    </div>
                  ) : (
                    filteredAvailableWo.map((wo) => {
                      const isChecked = selectedWoIds.includes(wo.id);
                      return (
                        <label
                          key={wo.id}
                          className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer text-xs transition border ${
                            isChecked
                              ? 'bg-purple-50/80 border-purple-200 text-purple-900'
                              : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedWoIds((prev) => [...prev, wo.id]);
                              } else {
                                setSelectedWoIds((prev) => prev.filter((x) => x !== wo.id));
                              }
                            }}
                            className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-purple-700">{wo.spkNumber}</span>
                              <span className="font-semibold text-slate-800">({wo.vehiclePlate})</span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {wo.customerName} {wo.customerPhone ? `• ${wo.customerPhone}` : ''}
                            </div>
                          </div>
                          <span className="font-bold text-slate-900 font-mono shrink-0">
                            Rp {Number(wo.totalAmount).toLocaleString('id-ID')}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Summary Calculation */}
              {selectedWoIds.length > 0 && (
                <div className="bg-purple-50/60 p-3.5 rounded-xl border border-purple-100 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal ({selectedWoIds.length} SPK):</span>
                    <span className="font-mono font-semibold">Rp {selectedWoTotal.subtotal.toLocaleString('id-ID')}</span>
                  </div>
                  {selectedWoTotal.tax > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>PPN 11%:</span>
                      <span className="font-mono font-semibold">Rp {selectedWoTotal.tax.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-purple-950 pt-1.5 border-t border-purple-200">
                    <span>Total Faktur Tagihan:</span>
                    <span className="font-mono">Rp {selectedWoTotal.total.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={selectedWoIds.length === 0}
                  className="flex-1 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 active:scale-95 disabled:opacity-50 text-white font-bold text-sm shadow-sm transition"
                >
                  Terbitkan Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceManager;
