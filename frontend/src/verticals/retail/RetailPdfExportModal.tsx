import React, { useState, useEffect, useContext } from 'react';
import {
  X,
  FileText,
  Wallet,
  ClipboardCheck,
  ShieldAlert,
  Download,
  RefreshCw,
  User,
  Calendar,
  Layers,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Building2,
  Printer
} from 'lucide-react';
import { POSContext } from '../../context/POSContext';
import { toast } from '../../utils/alert';
import {
  exportRetailReportPDF,
  exportCustomerStatementPDF,
  exportStockOpnamePDF
} from '../../utils/retailPdfGenerator';

export type RetailPdfDocType = 'OMNIBUS' | 'CUSTOMER_STATEMENT' | 'STOCK_OPNAME' | 'AR_AGEING';

interface RetailPdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: any;
  startDate: string;
  endDate: string;
  initialCustomerId?: number | null;
  initialDocType?: RetailPdfDocType;
}

export const RetailPdfExportModal: React.FC<RetailPdfExportModalProps> = ({
  isOpen,
  onClose,
  reportData,
  startDate,
  endDate,
  initialCustomerId = null,
  initialDocType = 'OMNIBUS'
}) => {
  const posContext = useContext(POSContext);
  const token = posContext?.token;
  const userName = (posContext?.user as any)?.name || posContext?.user?.username || 'Admin Toko';
  const settings = posContext?.settings || { storeName: 'TOKO GROSIR & RETAIL' };

  const [selectedDocType, setSelectedDocType] = useState<RetailPdfDocType>(initialDocType);
  const [loading, setLoading] = useState<boolean>(false);

  // Customer Statement Options
  const [customers, setCustomers] = useState<any[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState<boolean>(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(initialCustomerId);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [statementStatus, setStatementStatus] = useState<'UNPAID' | 'ALL'>('UNPAID');

  // Categories for Stock Opname Filter
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // Sinkronisasi prop initial
  useEffect(() => {
    if (isOpen) {
      setSelectedDocType(initialDocType || 'OMNIBUS');
      if (initialCustomerId) {
        setSelectedCustomerId(initialCustomerId);
      }
    }
  }, [isOpen, initialDocType, initialCustomerId]);

  // Load customer list for statement
  useEffect(() => {
    if (!isOpen || !token) return;

    const fetchCustomers = async () => {
      setLoadingCustomers(true);
      try {
        const res = await fetch('/api/retail/customers/credit-summary', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setCustomers(Array.isArray(data) ? data : []);
          if (!selectedCustomerId && data.length > 0 && !initialCustomerId) {
            setSelectedCustomerId(data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load customers for statement:', err);
      } finally {
        setLoadingCustomers(false);
      }
    };

    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setCategories(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };

    fetchCustomers();
    fetchCategories();
  }, [isOpen, token]);

  if (!isOpen) return null;

  // Filter customers for dropdown search
  const filteredCustomers = customers.filter(c =>
    (c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone || '').includes(customerSearch)
  );

  const selectedCustomerObj = customers.find(c => c.id === selectedCustomerId);

  // Handler Generate & Download PDF
  const handleGeneratePDF = async () => {
    if (!token) {
      toast('Sesi login telah berakhir, silakan login kembali.', 'error');
      return;
    }

    setLoading(true);
    try {
      if (selectedDocType === 'OMNIBUS' || selectedDocType === 'AR_AGEING') {
        if (!reportData) {
          toast('Data laporan belum tersedia. Silakan muat ulang.', 'error');
          return;
        }
        await exportRetailReportPDF(settings, reportData, startDate, endDate, userName);
        toast('Dokumen PDF Laporan Retail berhasil diunduh!', 'success');
        onClose();
      } else if (selectedDocType === 'CUSTOMER_STATEMENT') {
        if (!selectedCustomerId) {
          toast('Harap pilih pelanggan/mandor yang akan dicetak tagihannya.', 'error');
          return;
        }

        const queryParams = new URLSearchParams({
          status: statementStatus,
          startDate,
          endDate
        });

        const res = await fetch(`/api/retail/customers/${selectedCustomerId}/statement?${queryParams.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Gagal mengambil data tagihan pelanggan');
        }

        const statementData = await res.json();
        await exportCustomerStatementPDF(settings, statementData, userName);
        toast(`Lembar Tagihan untuk ${statementData.customer?.name || 'Pelanggan'} berhasil diunduh!`, 'success');
        onClose();
      } else if (selectedDocType === 'STOCK_OPNAME') {
        const queryParams = new URLSearchParams();
        if (selectedCategoryId) queryParams.append('categoryId', selectedCategoryId);

        const res = await fetch(`/api/retail/inventory/opname-sheet?${queryParams.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Gagal mengambil data stock opname');
        }

        const opnameData = await res.json();
        await exportStockOpnamePDF(settings, opnameData, userName);
        toast('Lembar Audit Fisik Stock Opname berhasil diunduh!', 'success');
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Gagal mencetak dokumen PDF.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-2xl overflow-hidden flex flex-col my-auto transition-all">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Printer size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/20">
                  RETAIL &amp; MATERIAL DOKUMEN
                </span>
                <span className="text-xs text-slate-400 font-mono">A4 Format</span>
              </div>
              <h3 className="font-black text-base sm:text-lg text-white mt-0.5">
                Cetak Dokumen &amp; Laporan PDF Resmi
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          
          {/* Active Period Pill */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-indigo-600" />
              <span className="font-bold">Periode Laporan Aktif:</span>
              <span className="font-mono font-extrabold text-slate-800">
                {startDate} s/d {endDate}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Otomatis tercetak di kop surat
            </span>
          </div>

          {/* Section: Select Document Type */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 block mb-2.5">
              1. Pilih Jenis Dokumen PDF yang Dibutuhkan
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Option 1: Omnibus Executive Report */}
              <div
                onClick={() => setSelectedDocType('OMNIBUS')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  selectedDocType === 'OMNIBUS'
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <FileText size={18} />
                    </div>
                    {selectedDocType === 'OMNIBUS' && (
                      <CheckCircle2 size={18} className="text-indigo-600" />
                    )}
                  </div>
                  <h4 className="font-black text-xs text-slate-900">
                    Laporan Eksekutif Lengkap (6 Pilar)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    Omzet 3-tier, laba kotor &amp; bersih, fast/slow moving, delivery DO, piutang AR, &amp; rekap kas laci.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] font-bold text-indigo-700">
                  Untuk Owner / Pertanggungjawaban
                </div>
              </div>

              {/* Option 2: Customer Statement of Account */}
              <div
                onClick={() => setSelectedDocType('CUSTOMER_STATEMENT')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  selectedDocType === 'CUSTOMER_STATEMENT'
                    ? 'border-rose-600 bg-rose-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                      <Wallet size={18} />
                    </div>
                    {selectedDocType === 'CUSTOMER_STATEMENT' && (
                      <CheckCircle2 size={18} className="text-rose-600" />
                    )}
                  </div>
                  <h4 className="font-black text-xs text-slate-900">
                    Lembar Tagihan Bon Pelanggan / Mandor
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    Rincian faktur bon per mitra, item barang, histori cicilan, sisa tagihan &amp; lembar tanda tangan.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] font-bold text-rose-700">
                  Untuk Penagihan Langsung ke Mitra
                </div>
              </div>

              {/* Option 3: Physical Stock Opname Sheet */}
              <div
                onClick={() => setSelectedDocType('STOCK_OPNAME')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  selectedDocType === 'STOCK_OPNAME'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <ClipboardCheck size={18} />
                    </div>
                    {selectedDocType === 'STOCK_OPNAME' && (
                      <CheckCircle2 size={18} className="text-emerald-600" />
                    )}
                  </div>
                  <h4 className="font-black text-xs text-slate-900">
                    Lembar Audit Fisik Stock Opname
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    Formulir cetak checklist rak &amp; gudang dengan kolom kosong [Fisik Nyata], [Selisih], &amp; [Paraf].
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] font-bold text-emerald-700">
                  Untuk Petugas Gudang &amp; Valuasi Stok
                </div>
              </div>

              {/* Option 4: AR Ageing Ledger */}
              <div
                onClick={() => setSelectedDocType('AR_AGEING')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  selectedDocType === 'AR_AGEING'
                    ? 'border-amber-600 bg-amber-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                      <ShieldAlert size={18} />
                    </div>
                    {selectedDocType === 'AR_AGEING' && (
                      <CheckCircle2 size={18} className="text-amber-600" />
                    )}
                  </div>
                  <h4 className="font-black text-xs text-slate-900">
                    Buku Piutang &amp; Umur Bon (AR Ageing)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    Rekapitulasi seluruh debitur toko yang dikelompokkan: Lancar (≤30h), Waspada (31-60h), &amp; Macet (&gt;60h).
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] font-bold text-amber-700">
                  Untuk Audit Piutang &amp; Mitigasi Macet
                </div>
              </div>

            </div>
          </div>

          {/* Dynamic Configuration per Document Type */}
          
          {/* CONFIG FOR CUSTOMER STATEMENT */}
          {selectedDocType === 'CUSTOMER_STATEMENT' && (
            <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80 space-y-3.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                  <User size={14} />
                  2. Konfigurasi Lembar Tagihan Bon Pelanggan
                </span>
                {selectedCustomerObj && (
                  <span className="text-[11px] font-bold text-rose-700 bg-white px-2 py-0.5 rounded-lg border border-rose-200">
                    Sisa Piutang: Rp {(selectedCustomerObj.totalDebt || 0).toLocaleString('id-ID')}
                  </span>
                )}
              </div>

              {/* Customer Selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Pilih Pelanggan / Mandor / Warung Langganan:
                </label>
                
                {/* Search Bar for Customers */}
                <input
                  type="text"
                  placeholder="Ketik nama atau no HP untuk mencari mitra..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white mb-2 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />

                <select
                  value={selectedCustomerId || ''}
                  onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                  disabled={loadingCustomers}
                  className="w-full text-xs font-bold px-3 py-2.5 rounded-xl border border-rose-200 bg-white text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                >
                  <option value="" disabled>-- Pilih Pelanggan Dari Daftar --</option>
                  {filteredCustomers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''} — Piutang: Rp {(c.totalDebt || 0).toLocaleString('id-ID')}
                    </option>
                  ))}
                </select>

                {filteredCustomers.length === 0 && !loadingCustomers && (
                  <p className="text-[11px] text-rose-600 mt-1 italic">
                    Tidak ditemukan pelanggan yang cocok dengan kata kunci.
                  </p>
                )}
              </div>

              {/* Filter Status Bon */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStatementStatus('UNPAID')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                    statementStatus === 'UNPAID'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Hanya Bon Belum Lunas (Aktif)
                </button>
                <button
                  type="button"
                  onClick={() => setStatementStatus('ALL')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                    statementStatus === 'ALL'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Semua Riwayat (Termasuk Lunas)
                </button>
              </div>
            </div>
          )}

          {/* CONFIG FOR STOCK OPNAME */}
          {selectedDocType === 'STOCK_OPNAME' && (
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-3 animate-fade-in">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <Layers size={14} />
                2. Filter Rak &amp; Kategori Barang Opname (Opsional)
              </span>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Kategori Produk:
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2.5 rounded-xl border border-emerald-200 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">Semua Kategori (Seluruh Etalase &amp; Gudang)</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Dokumen dicetak dengan format landscape dan dilengkapi kolom hitung fisik kosong serta valuasi modal HPP.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleGeneratePDF}
            disabled={loading || (selectedDocType === 'CUSTOMER_STATEMENT' && !selectedCustomerId)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-700 to-purple-700 hover:from-indigo-800 hover:to-purple-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-indigo-200 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Memproses Dokumen PDF...</span>
              </>
            ) : (
              <>
                <Download size={15} />
                <span>Unduh Dokumen PDF Resmi</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
