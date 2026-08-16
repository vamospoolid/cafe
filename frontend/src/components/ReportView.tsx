import { useState, useEffect, useContext } from 'react';
import { Calendar, DollarSign, TrendingUp, ShoppingBag, Layers, PieChart as PieChartIcon, Printer, User, Award, ListFilter, AlertTriangle, ArrowUpRight, ArrowDownRight, BookOpen, CreditCard, ChevronRight, RefreshCw, Download, Check, Search } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';
import { exportFinancialPDF } from '../utils/pdfGenerator';

const COLORS = ['#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

type QuickFilterType = 'today' | 'yesterday' | 'week' | 'month' | 'custom';
type TabType = 'dashboard' | 'products' | 'product_details' | 'shifts' | 'inventory' | 'transactions' | 'accounting';
type AccountingSubTabType = 'pl' | 'cashflow' | 'ledger';

const ReportView = () => {
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>('month');
  const [startDate, setStartDate] = useState(() => {
    // Default to last 30 days
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [accountingSubTab, setAccountingSubTab] = useState<AccountingSubTabType>('pl');
  const [loading, setLoading] = useState(true);

  // Search & Sort States
  const [productSearch, setProductSearch] = useState('');
  const [productSortKey, setProductSortKey] = useState<'qty' | 'revenue' | 'profit' | 'margin'>('qty');
  const [productSortOrder, setProductSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const [productDetailSearch, setProductDetailSearch] = useState('');
  const [transactionSearch, setTransactionSearch] = useState('');
  
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventorySortKey, setInventorySortKey] = useState<'stockAwal' | 'masuk' | 'keluarProduksi' | 'stockAkhir' | 'totalValuation'>('totalValuation');
  const [inventorySortOrder, setInventorySortOrder] = useState<'asc' | 'desc'>('desc');

  // Laporan Data
  const [reportData, setReportData] = useState<any>({
    summary: { revenue: 0, profit: 0, hpp: 0, transactionsCount: 0, discounts: 0, tax: 0, serviceCharge: 0 },
    paymentMethods: { Tunai: { count: 0, amount: 0 }, QRIS: { count: 0, amount: 0 }, Kartu: { count: 0, amount: 0 }, Split: { count: 0, amount: 0 } },
    categories: [],
    products: [],
    shifts: [],
    todayRecap: { revenue: 0, pendingAmount: 0, pendingCount: 0, expenses: 0, cashInDrawer: 0, qtySold: 0, otherIncomes: 0, qris: 0 },
    periodRecap: { netIncome: 0, revenue: 0, expenses: 0, revenueBreakdown: { makanan: 0, minuman: 0, dessert: 0, other: 0 }, growth: 0, dineIn: 0, takeaway: 0, qrisTotal: 0, qrisCount: 0 },
    dailyTimeline: []
  });

  // Product Details & Transactions State
  const [productDetailsData, setProductDetailsData] = useState<any>({
    summary: { totalAssetValuation: 0, totalPotentialSales: 0, criticalProductsCount: 0 },
    products: []
  });
  const [transactionsData, setTransactionsData] = useState<any[]>([]);

  // Accounting Data
  const [accountingData, setAccountingData] = useState<any>({
    profitLoss: { operatingRevenue: 0, salesRevenue: 0, otherRevenue: 0, shiftOverage: 0, cogs: 0, grossProfit: 0, operatingExpenses: 0, opexAmount: 0, shiftShortage: 0, netIncome: 0 },
    cashFlow: { inflow: { salesReceipts: 0, otherReceipts: 0, overages: 0, total: 0 }, outflow: { opexPayments: 0, shortages: 0, total: 0 }, netCashFlow: 0 },
    journals: []
  });

  // Inventory Report Data
  const [inventoryData, setInventoryData] = useState<any>({
    summary: { totalAssetValuation: 0, criticalItemsCount: 0, totalMutationsCount: 0 },
    inventory: []
  });

  const posContext = useContext(POSContext);

  const formatCurrency = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;

  const downloadCSVFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportCSV = () => {
    if (activeTab === 'inventory') {
      const headers = ['Nama Bahan Baku', 'Satuan', 'Supplier', 'Stok Awal', 'Masuk (Restock/PO)', 'Keluar (Produksi)', 'Keluar (Rusak)', 'Penyesuaian', 'Stok Akhir', 'Estimasi Nilai Aset'];
      const data = inventoryData.inventory?.map((item: any) => [
        item.name,
        item.unit,
        item.supplierName,
        item.stockAwal,
        item.masuk,
        item.keluarProduksi,
        item.keluarRusak,
        item.penyesuaian,
        item.stockAkhir,
        item.totalValuation
      ]) || [];

      const csvRows = [headers.join(',')];
      data.forEach((row: any) => {
        csvRows.push(row.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(','));
      });
      downloadCSVFile(`Laporan_Stok_${startDate}_to_${endDate}.csv`, csvRows.join('\n'));
    } else if (activeTab === 'products') {
      const headers = ['Nama Menu', 'Kategori', 'Terjual (Qty)', 'Omzet Kotor', 'Total HPP', 'Keuntungan', 'Margin Laba (%)'];
      const data = reportData.products?.map((p: any) => [
        p.name,
        p.category,
        p.qty,
        p.revenue,
        p.cost,
        p.profit,
        p.margin
      ]) || [];

      const csvRows = [headers.join(',')];
      data.forEach((row: any) => {
        csvRows.push(row.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(','));
      });
      downloadCSVFile(`Laporan_Penjualan_Menu_${startDate}_to_${endDate}.csv`, csvRows.join('\n'));
    } else if (activeTab === 'accounting') {
      if (accountingSubTab === 'pl') {
        const headers = ['Keterangan', 'Nominal'];
        const data = [
          ['1. PENDAPATAN OPERASIONAL', ''],
          ['Penjualan Bersih Kasir', accountingData.profitLoss?.salesRevenue || 0],
          ['Pendapatan Lain-lain (Petty Cash Masuk)', accountingData.profitLoss?.otherRevenue || 0],
          ['Kelebihan Uang Kasir (Overage)', accountingData.profitLoss?.shiftOverage || 0],
          ['Total Pendapatan Operasional', accountingData.profitLoss?.operatingRevenue || 0],
          ['', ''],
          ['2. HARGA POKOK PENJUALAN (HPP)', ''],
          ['Beban Pokok Persediaan Bahan Baku (HPP)', -(accountingData.profitLoss?.cogs || 0)],
          ['Total Beban HPP', -(accountingData.profitLoss?.cogs || 0)],
          ['', ''],
          ['LABA KOTOR (GROSS PROFIT)', accountingData.profitLoss?.grossProfit || 0],
          ['', ''],
          ['3. BEBAN OPERASIONAL (OPEX)', ''],
          ['Beban Kas Operasional (Petty Cash Keluar)', -(accountingData.profitLoss?.opexAmount || 0)],
          ['Kekurangan Uang Kasir (Shortage)', -(accountingData.profitLoss?.shiftShortage || 0)],
          ['Total Beban Operasional', -(accountingData.profitLoss?.operatingExpenses || 0)],
          ['', ''],
          ['LABA BERSIH OPERASIONAL (NET INCOME)', accountingData.profitLoss?.netIncome || 0]
        ];
        
        const csvRows = [headers.join(',')];
        data.forEach(row => {
          csvRows.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));
        });
        
        downloadCSVFile(`Laba_Rugi_${startDate}_to_${endDate}.csv`, csvRows.join('\n'));
      } else if (accountingSubTab === 'cashflow') {
        const headers = ['Kategori / Keterangan', 'Kas Masuk', 'Kas Keluar'];
        const data = [
          ['ARUS KAS MASUK (INFLOW)', '', ''],
          ['Penerimaan Uang dari Pelanggan (Omzet)', accountingData.cashFlow?.inflow?.salesReceipts || 0, ''],
          ['Penerimaan Petty Cash', accountingData.cashFlow?.inflow?.otherReceipts || 0, ''],
          ['Akumulasi Kelebihan Uang Laci Shift', accountingData.cashFlow?.inflow?.overages || 0, ''],
          ['Total Kas Masuk', accountingData.cashFlow?.inflow?.total || 0, ''],
          ['', '', ''],
          ['ARUS KAS KELUAR (OUTFLOW)', '', ''],
          ['Pembayaran Biaya Petty Cash', '', -(accountingData.cashFlow?.outflow?.opexPayments || 0)],
          ['Akumulasi Kekurangan Uang Laci Shift', '', -(accountingData.cashFlow?.outflow?.shortages || 0)],
          ['Total Kas Keluar', '', -(accountingData.cashFlow?.outflow?.total || 0)],
          ['', '', ''],
          ['KENAIKAN/(PENURUNAN) KAS BERSIH', accountingData.cashFlow?.netCashFlow || 0, '']
        ];
        
        const csvRows = [headers.join(',')];
        data.forEach(row => {
          csvRows.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));
        });
        
        downloadCSVFile(`Arus_Kas_${startDate}_to_${endDate}.csv`, csvRows.join('\n'));
      } else if (accountingSubTab === 'ledger') {
        const headers = ['Tanggal', 'Referensi', 'Keterangan Transaksi', 'Nama Akun', 'Debit', 'Kredit'];
        const csvRows = [headers.join(',')];
        
        accountingData.journals?.forEach((j: any) => {
          j.lines?.forEach((l: any, idx: number) => {
            const dateStr = new Date(j.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            csvRows.push([
              idx === 0 ? dateStr : '',
              idx === 0 ? j.reference : '',
              idx === 0 ? j.description : '',
              l.account,
              l.debit > 0 ? l.debit : 0,
              l.credit > 0 ? l.credit : 0
            ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));
          });
        });
        
        downloadCSVFile(`Buku_Besar_${startDate}_to_${endDate}.csv`, csvRows.join('\n'));
      }
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${posContext?.token}` };
      const [resReports, resAccounting, resInventory, resProductDetails, resTransactions] = await Promise.all([
        fetch(`/api/analytics/reports?startDate=${startDate}&endDate=${endDate}`, { headers }),
        fetch(`/api/analytics/accounting?startDate=${startDate}&endDate=${endDate}`, { headers }),
        fetch(`/api/analytics/inventory?startDate=${startDate}&endDate=${endDate}`, { headers }),
        fetch(`/api/analytics/product-details`, { headers }),
        fetch(`/api/orders?startDate=${startDate}&endDate=${endDate}`, { headers })
      ]);

      if (resReports.ok) {
        setReportData(await resReports.json());
      }
      if (resAccounting.ok) {
        setAccountingData(await resAccounting.json());
      }
      if (resInventory.ok) {
        setInventoryData(await resInventory.json());
      }
      if (resProductDetails.ok) {
        setProductDetailsData(await resProductDetails.json());
      }
      if (resTransactions.ok) {
        setTransactionsData(await resTransactions.json());
      }
    } catch (err) {
      console.error(err);
      toast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Quick Filter presets
  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (quickFilter === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (quickFilter === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      setStartDate(yesterdayStr);
      setEndDate(yesterdayStr);
    } else if (quickFilter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(today.getDate() - 6);
      setStartDate(weekAgo.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (quickFilter === 'month') {
      const lastMonth = new Date();
      lastMonth.setDate(today.getDate() - 30);
      setStartDate(lastMonth.toISOString().split('T')[0]);
      setEndDate(todayStr);
    }
  }, [quickFilter]);

  // Fetch when range changes
  useEffect(() => {
    if (posContext?.token) {
      fetchReport();
    }
  }, [posContext?.token, startDate, endDate]);

  const handlePrint = async () => {
    if (activeTab === 'accounting') {
      await exportFinancialPDF(
        accountingSubTab,
        posContext?.settings || {},
        accountingData,
        startDate,
        endDate,
        (posContext?.user as any)?.name || 'Admin'
      );
    } else if (activeTab === 'inventory') {
      await exportFinancialPDF(
        'inventory',
        posContext?.settings || {},
        inventoryData,
        startDate,
        endDate,
        (posContext?.user as any)?.name || 'Admin'
      );
    } else if (activeTab === 'product_details') {
      // Find filtered product details to export
      const query = productDetailSearch.toLowerCase();
      const filteredDetails = (productDetailsData.products || []).filter((p: any) =>
        p.name.toLowerCase().includes(query) || p.barcode.toLowerCase().includes(query) || p.categoryName.toLowerCase().includes(query)
      );
      await exportFinancialPDF(
        'product_details',
        posContext?.settings || {},
        { ...productDetailsData, products: filteredDetails },
        startDate,
        endDate,
        (posContext?.user as any)?.name || 'Admin'
      );
    } else if (activeTab === 'transactions') {
      // Find filtered transactions to export
      const query = transactionSearch.toLowerCase();
      const filteredTransactions = transactionsData.filter((o: any) =>
        o.orderNumber.toLowerCase().includes(query) || o.customerName.toLowerCase().includes(query)
      );
      await exportFinancialPDF(
        'transactions',
        posContext?.settings || {},
        filteredTransactions,
        startDate,
        endDate,
        (posContext?.user as any)?.name || 'Admin'
      );
    } else if (activeTab === 'products') {
      // Find filtered products to export the exact view
      const query = productSearch.toLowerCase();
      const filteredProducts = (reportData.products || [])
        .filter((p: any) => p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query))
        .sort((a: any, b: any) => {
          let valA = a[productSortKey];
          let valB = b[productSortKey];
          if (productSortOrder === 'asc') return valA > valB ? 1 : -1;
          return valA < valB ? 1 : -1;
        });
      await exportFinancialPDF(
        'products',
        posContext?.settings || {},
        filteredProducts,
        startDate,
        endDate,
        (posContext?.user as any)?.name || 'Admin'
      );
    } else if (activeTab === 'shifts') {
      await exportFinancialPDF(
        'shifts',
        posContext?.settings || {},
        reportData.shifts || [],
        startDate,
        endDate,
        (posContext?.user as any)?.name || 'Admin'
      );
    } else if (activeTab === 'dashboard') {
      await exportFinancialPDF(
        'dashboard',
        posContext?.settings || {},
        reportData,
        startDate,
        endDate,
        (posContext?.user as any)?.name || 'Admin'
      );
    }
  };

  const getMarginBadgeStyle = (margin: number) => {
    if (margin >= 60) return { bg: 'rgba(16,185,129,0.1)', text: '#10b981', label: 'Tinggi' };
    if (margin >= 40) return { bg: 'rgba(59,130,246,0.1)', text: '#3b82f6', label: 'Sedang' };
    return { bg: 'rgba(245,158,11,0.1)', text: '#f59e0b', label: 'Rendah' };
  };

  return (
    <div className="report-container" style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column', background: '#f8fafc', color: '#1e293b', overflowY: 'auto', gap: '1.5rem', boxSizing: 'border-box', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      
      {/* CSS Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .report-container, .report-container * {
            visibility: visible;
          }
          .report-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .card {
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
          }
        }
        
        .card-premium {
          background: white;
          border: 1px solid rgba(226, 232, 240, 0.8);
          border-radius: 1.25rem;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .card-premium:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 20px -3px rgba(0, 0, 0, 0.08), 0 4px 8px -2px rgba(0, 0, 0, 0.04);
          border-color: rgba(16, 185, 129, 0.3);
        }
        
        .badge-premium {
          font-size: 0.72rem;
          font-weight: 800;
          padding: 0.25rem 0.6rem;
          border-radius: 9999px;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }
        
        .table-premium {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }
        .table-premium th {
          background: #f8fafc;
          border-bottom: 2px solid #e2e8f0;
          padding: 0.875rem 1.25rem;
          text-align: left;
          font-size: 0.7rem;
          font-weight: 800;
          color: #64748b;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .table-premium td {
          padding: 1rem 1.25rem;
          font-size: 0.82rem;
          color: #334155;
          border-bottom: 1px solid #e2e8f0;
        }
        .table-premium tr {
          transition: background 0.15s ease;
        }
        .table-premium tr:hover td {
          background: #f8fafc !important;
        }
        .table-premium tr:last-child td {
          border-bottom: none;
        }
        
        .paper-report-container {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 1.5rem;
          padding: 2.5rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02);
          max-width: 780px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }
        
        .glow-pulse {
          animation: pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse-glow {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.85;
            transform: scale(1.02);
          }
        }
        
        .grid-7-cards {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 0.75rem;
        }
        @media (max-width: 1200px) {
          .grid-7-cards {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        @media (max-width: 768px) {
          .grid-7-cards {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>

      {/* ─── Top Info Bar ─── */}
      <div style={{ background: 'rgba(16,185,129,0.08)', borderLeft: '4px solid #10b981', padding: '0.65rem 1rem', borderRadius: '0.5rem', fontSize: '0.78rem', color: '#10b981', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s infinite' }} />
        INFO: REKAP HARIAN DIHITUNG PER SIKLUS OPERASIONAL KAFE (09:00 - SELESAI)
      </div>

      {/* ─── Header & Print Button (no-print) ─── */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1.4rem', color: '#1e293b', margin: 0 }}>
            <TrendingUp color="#10b981" size={24} /> Laporan Penjualan & Keuangan Cafe
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0.25rem 0 0' }}>Pantau perkembangan omzet, P&L, arus kas, dan kinerja porsi menu terjual</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={fetchReport}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', cursor: 'pointer', color: '#64748b', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.875rem', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem', boxShadow: '0 4px 14px rgba(16,185,129,0.2)' }}
          >
            <Printer size={16} /> Unduh Laporan PDF
          </button>
        </div>
      </div>

      {/* ─── Today's Summary Grid (Rekap Hari Ini - 7 Cards) ─── */}
      <div>
        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ringkasan Operasional Hari Ini</div>
        <div className="grid-7-cards">
          
          {/* Revenue Hari Ini */}
          <div className="card-premium">
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Revenue Hari Ini</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#10b981' }}>{formatCurrency(reportData.todayRecap?.revenue)}</span>
            <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Pendapatan hari ini</span>
          </div>

          {/* Tagihan Pending */}
          <div className="card-premium">
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Tagihan Pending</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f59e0b' }}>{formatCurrency(reportData.todayRecap?.pendingAmount)}</span>
            <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>{reportData.todayRecap?.pendingCount} tagihan belum lunas</span>
          </div>

          {/* Total Pengeluaran */}
          <div className="card-premium">
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Pengeluaran</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#ef4444' }}>{formatCurrency(reportData.todayRecap?.expenses)}</span>
            <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Operasional & petty cash</span>
          </div>

          {/* Total Cash Hari Ini */}
          <div className="card-premium">
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Cash Hari Ini</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f59e0b' }}>{formatCurrency(reportData.todayRecap?.cashInDrawer)}</span>
            <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Est. uang laci + modal awal</span>
          </div>

          {/* Total Porsi Terjual */}
          <div className="card-premium">
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Porsi Terjual</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#3b82f6' }}>{reportData.todayRecap?.qtySold} Qty</span>
            <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Makanan & minuman</span>
          </div>

          {/* Pemasukan Lain */}
          <div className="card-premium">
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Pemasukan Lain</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#10b981' }}>{formatCurrency(reportData.todayRecap?.otherIncomes)}</span>
            <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Pemasukan manual kas</span>
          </div>

          {/* Transaksi QRIS */}
          <div className="card-premium">
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Transaksi QRIS</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#7c3aed' }}>{formatCurrency(reportData.todayRecap?.qris)}</span>
            <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Pembayaran non-tunai</span>
          </div>

        </div>
      </div>

      {/* ─── Period Date Filter Bar (no-print) ─── */}
      <div className="no-print" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '0.85rem 1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        
        {/* Date pickers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Dari</span>
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setQuickFilter('custom');
              }}
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.4rem 0.65rem', color: '#334155', fontSize: '0.8rem', fontWeight: 600 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Ke</span>
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value);
                setQuickFilter('custom');
              }}
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.4rem 0.65rem', color: '#334155', fontSize: '0.8rem', fontWeight: 600 }}
            />
          </div>
          <button
            onClick={fetchReport}
            style={{ background: '#10b981', border: 'none', borderRadius: '0.5rem', color: 'white', padding: '0.45rem 1rem', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 4px rgba(16,185,129,0.1)' }}
          >
            Terapkan Filter
          </button>
        </div>

        {/* Quick filter selector */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.25rem', borderRadius: '0.625rem', gap: '0.15rem' }}>
          {[
            { key: 'today', label: 'Hari Ini' },
            { key: 'yesterday', label: 'Kemarin' },
            { key: 'week', label: 'Mingguan' },
            { key: 'month', label: 'Bulanan' },
            { key: 'custom', label: 'Kustom' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setQuickFilter(f.key as QuickFilterType)}
              style={{ border: 'none', background: quickFilter === f.key ? '#10b981' : 'transparent', color: quickFilter === f.key ? 'white' : '#64748b', padding: '0.35rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.12s' }}
            >
              {f.label}
            </button>
          ))}
        </div>

      </div>

      {/* ─── Period Performance Cards (Based on Date Filter) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem' }}>
        
        {/* Period Net Income */}
        <div className="card-premium" style={{ borderLeft: '4px solid #10b981' }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Period Net Income</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>{formatCurrency(reportData.periodRecap?.netIncome)}</span>
          <span style={{ fontSize: '0.62rem', color: '#64748b' }}>Rev: {formatCurrency(reportData.periodRecap?.revenue)} - Exp: {formatCurrency(reportData.periodRecap?.expenses)}</span>
        </div>

        {/* Period Total Revenue */}
        <div className="card-premium">
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Period Total Revenue</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>{formatCurrency(reportData.periodRecap?.revenue)}</span>
          <span style={{ fontSize: '0.58rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Mkn: {formatCurrency(reportData.periodRecap?.revenueBreakdown?.makanan)} - Mnm: {formatCurrency(reportData.periodRecap?.revenueBreakdown?.minuman)}
          </span>
        </div>

        {/* Trend vs Yesterday / Previous Period */}
        <div className="card-premium">
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Trend vs Previous Period</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 900, color: reportData.periodRecap?.growth >= 0 ? '#10b981' : '#ef4444' }}>
            {reportData.periodRecap?.growth >= 0 ? '+' : ''}{reportData.periodRecap?.growth?.toFixed(1)}%
          </span>
          <span style={{ fontSize: '0.62rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
            {reportData.periodRecap?.growth >= 0 ? (
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center' }}><ArrowUpRight size={12} /> growth</span>
            ) : (
              <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center' }}><ArrowDownRight size={12} /> decline</span>
            )}
          </span>
        </div>

        {/* Period Dine-In Revenue */}
        <div className="card-premium">
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Period Dine-In Bill</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#3b82f6' }}>{formatCurrency(reportData.periodRecap?.dineIn)}</span>
          <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Penjualan makan di tempat</span>
        </div>

        {/* Period Takeaway Revenue */}
        <div className="card-premium">
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Period Takeaway Bill</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f59e0b' }}>{formatCurrency(reportData.periodRecap?.takeaway)}</span>
          <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Penjualan bungkus / ojek online</span>
        </div>

        {/* Period Trx QRIS */}
        <div className="card-premium">
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Period Trx QRIS</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#7c3aed' }}>{formatCurrency(reportData.periodRecap?.qrisTotal)}</span>
          <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Total dari {reportData.periodRecap?.qrisCount} transaksi QRIS</span>
        </div>

      </div>

      {/* ─── Navigation Tabs (no-print) ─── */}
      <div className="no-print" style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem', overflowX: 'auto' }}>
        {[
          { key: 'dashboard', label: 'Dashboard Laporan', icon: <PieChartIcon size={16} /> },
          { key: 'products', label: 'Penjualan Per-Menu (Margin)', icon: <Award size={16} /> },
          { key: 'product_details', label: 'Detail Menu & Valuasi', icon: <ShoppingBag size={16} /> },
          { key: 'shifts', label: 'Laporan Audit Shift', icon: <User size={16} /> },
          { key: 'inventory', label: 'Laporan Stok & Mutasi', icon: <Layers size={16} /> },
          { key: 'transactions', label: 'Riwayat Transaksi', icon: <ListFilter size={16} /> },
          { key: 'accounting', label: 'Laba Rugi & Arus Kas', icon: <BookOpen size={16} /> }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as TabType)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: 'none', background: 'transparent', borderBottom: activeTab === t.key ? '3px solid #10b981' : '3px solid transparent', color: activeTab === t.key ? '#10b981' : '#64748b', fontWeight: 700, fontSize: '0.85rem', padding: '0.5rem 1rem', cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap' }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB CONTENT 1: DASHBOARD LAPORAN (Vamos Pool Style) ─── */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Revenue Trend Chart */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '1.25rem', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>Revenue Trend (Selected Period)</h3>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Financial trajectory and growth over the selected period</span>
              </div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem', fontWeight: 700 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f59e0b' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} /> Minuman
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#10b981' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} /> Makanan
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#7c3aed' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed' }} /> Total Omzet
                </span>
              </div>
            </div>

            <div style={{ height: 260 }}>
              {reportData.dailyTimeline?.length === 0 ? (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                  Tidak ada data untuk grafik pada rentang tanggal ini.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={reportData.dailyTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorMakanan" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorMinuman" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="dateLabel" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `Rp ${val / 1000}k`} />
                    <Tooltip
                      contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.5rem', color: '#334155', fontSize: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                      formatter={(val: any) => [formatCurrency(Number(val)), '']}
                    />
                    <Area type="monotone" dataKey="total" stroke="#7c3aed" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                    <Area type="monotone" dataKey="makanan" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#colorMakanan)" />
                    <Area type="monotone" dataKey="minuman" stroke="#f59e0b" strokeWidth={1.5} fillOpacity={1} fill="url(#colorMinuman)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Detailed Revenue Log (Table) */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '1.25rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#1e293b' }}>Detailed Revenue Log</h3>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Daily breakdown of F&B operations, expenses, and net profit</span>
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.08)', padding: '0.2rem 0.5rem', borderRadius: '0.25rem' }}>
                {reportData.dailyTimeline?.length || 0} records found
              </span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['DATE', 'PENDAPATAN MAKANAN', 'PENDAPATAN MINUMAN', 'TOTAL (OMZET)', 'EXPENSES', 'NET PROFIT', 'TRANSAKSI'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.dailyTimeline?.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#4b5563', fontSize: '0.8rem' }}>No data records found</td>
                  </tr>
                ) : (
                  [...reportData.dailyTimeline].reverse().map((row: any, idx: number) => (
                    <tr key={row.dateRaw} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? 'transparent' : '#f8fafc' }}>
                      <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>{row.dateLabel}</td>
                      <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>{formatCurrency(row.makanan)}</td>
                      <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600 }}>{formatCurrency(row.minuman)}</td>
                      <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.8rem', fontWeight: 800, color: '#1e293b' }}>{formatCurrency(row.total)}</td>
                      <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.8rem', fontWeight: 800, color: row.profit >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(row.profit)}</td>
                      <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>{row.count} trx</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ─── TAB CONTENT 2: PENJUALAN PER-MENU ─── */}
      {activeTab === 'products' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Search & Filter bar (no-print) */}
          <div className="no-print" style={{ display: 'flex', gap: '1rem', background: 'white', padding: '1rem', borderRadius: '1rem', border: '1px solid #e2e8f0', alignItems: 'center' }}>
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              placeholder="Cari nama menu atau kategori..."
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.85rem', color: '#1e293b' }}
            />
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
              Urutkan: 
              <select 
                value={productSortKey} 
                onChange={e => setProductSortKey(e.target.value as any)}
                style={{ marginLeft: '0.35rem', border: '1px solid #e2e8f0', borderRadius: '0.35rem', padding: '0.2rem', background: '#f8fafc', fontWeight: 700 }}
              >
                <option value="qty">Terjual (Qty)</option>
                <option value="revenue">Omzet Kotor</option>
                <option value="profit">Keuntungan</option>
                <option value="margin">Margin Laba</option>
              </select>
              <select 
                value={productSortOrder} 
                onChange={e => setProductSortOrder(e.target.value as any)}
                style={{ marginLeft: '0.25rem', border: '1px solid #e2e8f0', borderRadius: '0.35rem', padding: '0.2rem', background: '#f8fafc', fontWeight: 700 }}
              >
                <option value="desc">Terbesar</option>
                <option value="asc">Terkecil</option>
              </select>
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '1.25rem', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <table className="table-premium">
              <thead>
                <tr>
                  {['Nama Menu', 'Kategori', 'Terjual (Qty)', 'Omzet Kotor', 'Total HPP', 'Keuntungan', 'Margin Laba', 'Ambang'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(reportData.products || [])
                  .filter((p: any) => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.category.toLowerCase().includes(productSearch.toLowerCase()))
                  .sort((a: any, b: any) => {
                    let valA = a[productSortKey] || 0;
                    let valB = b[productSortKey] || 0;
                    if (productSortOrder === 'asc') return valA > valB ? 1 : -1;
                    return valA < valB ? 1 : -1;
                  })
                  .length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Belum ada data penjualan produk</td>
                  </tr>
                ) : (
                  (reportData.products || [])
                    .filter((p: any) => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.category.toLowerCase().includes(productSearch.toLowerCase()))
                    .sort((a: any, b: any) => {
                      let valA = a[productSortKey] || 0;
                      let valB = b[productSortKey] || 0;
                      if (productSortOrder === 'asc') return valA > valB ? 1 : -1;
                      return valA < valB ? 1 : -1;
                    })
                    .map((p: any, idx: number) => {
                      const ms = getMarginBadgeStyle(p.margin);
                      return (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 700, color: '#1e293b' }}>{p.name}</td>
                          <td style={{ color: '#64748b', fontWeight: 600 }}>{p.category}</td>
                          <td style={{ fontWeight: 800, color: '#3b82f6' }}>{p.qty} porsi</td>
                          <td style={{ fontWeight: 700, color: '#1e293b' }}>{formatCurrency(p.revenue)}</td>
                          <td style={{ color: '#64748b', fontWeight: 500 }}>{formatCurrency(p.cost)}</td>
                          <td style={{ fontWeight: 700, color: '#10b981' }}>{formatCurrency(p.profit)}</td>
                          
                          {/* Margin % */}
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontWeight: 800, color: '#1e293b' }}>{p.margin}%</span>
                              <div style={{ width: 45, height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(100, p.margin)}%`, background: p.margin >= 60 ? '#10b981' : p.margin >= 40 ? '#3b82f6' : '#f97316', height: '100%' }} />
                              </div>
                            </div>
                          </td>

                          {/* Ambang Margin Tag */}
                          <td>
                            <span className="badge-premium" style={{ background: ms.bg, color: ms.text }}>
                              {ms.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB CONTENT 3: LAPORAN AUDIT SHIFT ─── */}
      {activeTab === 'shifts' && (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '1.25rem', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <table className="table-premium">
            <thead>
              <tr>
                {['Waktu Tutup', 'Staf Kasir', 'Saldo Awal', 'Sistem (POS)', 'Fisik Laci', 'Selisih Kas', 'Audit Status'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportData.shifts?.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Belum ada shift ditutup dalam rentang tanggal ini</td>
                </tr>
              ) : (
                reportData.shifts.map((s: any) => {
                  const hasDiscrepancy = s.selisih !== 0;
                  const isNegative = s.selisih < 0;
                  return (
                    <tr key={s.id}>
                      <td style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 700 }}>
                        {s.waktuTutup ? new Date(s.waktuTutup).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td style={{ fontWeight: 700, color: '#1e293b' }}>{s.user?.name}</td>
                      <td style={{ color: '#64748b', fontWeight: 600 }}>{formatCurrency(s.saldoAwal)}</td>
                      <td style={{ fontWeight: 700, color: '#1e293b' }}>{formatCurrency(s.saldoSistem || 0)}</td>
                      <td style={{ fontWeight: 700, color: '#1e293b' }}>{formatCurrency(s.saldoFisikLaci || 0)}</td>
                      <td style={{ fontWeight: 800 }}>
                        {s.selisih === 0 ? (
                          <span style={{ color: '#10b981' }}>Rp 0</span>
                        ) : isNegative ? (
                          <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                            <ArrowDownRight size={14} /> {formatCurrency(s.selisih)}
                          </span>
                        ) : (
                          <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                            <ArrowUpRight size={14} /> +{formatCurrency(s.selisih)}
                          </span>
                        )}
                      </td>
                      <td>
                        {!hasDiscrepancy ? (
                          <span className="badge-premium" style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981' }}>
                            <Check size={12} /> Cocok (OK)
                          </span>
                        ) : (
                          <span className="badge-premium" style={{ background: isNegative ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', color: isNegative ? '#ef4444' : '#f59e0b' }}>
                            <AlertTriangle size={11} /> {isNegative ? 'Selisih Minus' : 'Selisih Plus'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── TAB CONTENT 4: LAPORAN MUTASI & VALUASI STOK ─── */}
      {activeTab === 'inventory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div className="card-premium" style={{ borderLeft: '4px solid #10b981' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Valuasi Aset Persediaan</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981' }}>{formatCurrency(inventoryData.summary?.totalAssetValuation)}</span>
              <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Total nilai stok dikali harga beli</span>
            </div>
            
            <div className="card-premium" style={{ borderLeft: '4px solid #ef4444' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Bahan Baku Kritis (Stok Menipis)</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }} className={inventoryData.summary?.criticalItemsCount > 0 ? 'glow-pulse' : ''}>
                {inventoryData.summary?.criticalItemsCount} Item
              </span>
              <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Bahan dengan stok di bawah batas minimum</span>
            </div>

            <div className="card-premium" style={{ borderLeft: '4px solid #3b82f6' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Aktivitas Mutasi Stok</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#3b82f6' }}>{inventoryData.summary?.totalMutationsCount} Log</span>
              <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Total mutasi tercatat dalam periode ini</span>
            </div>
          </div>

          {/* Search bar & Export */}
          <div className="no-print" style={{ display: 'flex', gap: '1rem', background: 'white', padding: '1rem', borderRadius: '1rem', border: '1px solid #e2e8f0', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1 }}>
              <Search size={16} color="#94a3b8" />
              <input
                type="text"
                placeholder="Cari bahan baku..."
                value={inventorySearch}
                onChange={e => setInventorySearch(e.target.value)}
                style={{ border: 'none', outline: 'none', width: '100%', maxWidth: '300px', fontSize: '0.85rem', color: '#1e293b' }}
              />
            </div>
            
            <button
              onClick={exportCSV}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', cursor: 'pointer', color: '#10b981', fontWeight: 800, fontSize: '0.78rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              <Download size={14} /> Ekspor CSV (Excel)
            </button>
          </div>

          {/* Mutation Table */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '1.25rem', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <table className="table-premium">
              <thead>
                <tr>
                  {['Nama Bahan', 'Satuan', 'Supplier', 'Stok Awal', 'Masuk (+)', 'Keluar (Prod)', 'Rusak (-)', 'Penyesuaian', 'Stok Akhir', 'Nilai Aset'].map(h => (
                    <th key={h} style={{ textAlign: ['Nama Bahan', 'Satuan', 'Supplier'].includes(h) ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(inventoryData.inventory || [])
                  .filter((item: any) => item.name.toLowerCase().includes(inventorySearch.toLowerCase()))
                  .length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Tidak ada data mutasi stok</td>
                  </tr>
                ) : (
                  (inventoryData.inventory || [])
                    .filter((item: any) => item.name.toLowerCase().includes(inventorySearch.toLowerCase()))
                    .map((item: any) => {
                      const isLow = item.stockAkhir <= item.minStock;
                      return (
                        <tr key={item.id} style={{ background: isLow ? 'rgba(239,68,68,0.02)' : 'transparent' }}>
                          <td style={{ fontWeight: 700, color: isLow ? '#dc2626' : '#1e293b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {isLow && <AlertTriangle size={14} color="#dc2626" />}
                            {item.name}
                          </td>
                          <td style={{ color: '#64748b' }}>{item.unit}</td>
                          <td style={{ color: '#64748b', fontSize: '0.78rem' }}>{item.supplierName}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.stockAwal.toLocaleString('id-ID')}</td>
                          <td style={{ textAlign: 'right', color: '#166534', fontWeight: 600 }}>{item.masuk > 0 ? `+${item.masuk.toLocaleString('id-ID')}` : '0'}</td>
                          <td style={{ textAlign: 'right', color: '#475569' }}>{item.keluarProduksi > 0 ? `-${item.keluarProduksi.toLocaleString('id-ID')}` : '0'}</td>
                          <td style={{ textAlign: 'right', color: '#dc2626' }}>{item.keluarRusak > 0 ? `-${item.keluarRusak.toLocaleString('id-ID')}` : '0'}</td>
                          <td style={{ textAlign: 'right', color: item.penyesuaian > 0 ? '#166534' : item.penyesuaian < 0 ? '#dc2626' : '#475569' }}>
                            {item.penyesuaian === 0 ? '0' : `${item.penyesuaian > 0 ? '+' : ''}${item.penyesuaian.toLocaleString('id-ID')}`}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: isLow ? '#dc2626' : '#1e293b' }}>
                            {item.stockAkhir.toLocaleString('id-ID')}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#10b981' }}>{formatCurrency(item.totalValuation)}</td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
 
         </div>
       )}

      {/* ─── TAB CONTENT 6: DETAIL MENU & VALUASI BARANG JADI (BARU) ─── */}
      {activeTab === 'product_details' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div className="card-premium" style={{ borderLeft: '4px solid #10b981' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Valuasi Aset Barang Jadi (HPP)</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981' }}>{formatCurrency(productDetailsData.summary?.totalAssetValuation)}</span>
              <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Investasi stok produk jadi siap jual</span>
            </div>
            
            <div className="card-premium" style={{ borderLeft: '4px solid #3b82f6' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Potensi Omzet Penjualan</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#3b82f6' }}>{formatCurrency(productDetailsData.summary?.totalPotentialSales)}</span>
              <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Estimasi nilai jual seluruh stok barang jadi</span>
            </div>

            <div className="card-premium" style={{ borderLeft: '4px solid #ef4444' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Produk Jadi Stok Kritis</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {productDetailsData.summary?.criticalProductsCount} Menu
              </span>
              <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Produk dengan stok di bawah batas minimum</span>
            </div>
          </div>

          {/* Search bar (no-print) */}
          <div className="no-print" style={{ display: 'flex', gap: '1rem', background: 'white', padding: '1rem', borderRadius: '1rem', border: '1px solid #e2e8f0', alignItems: 'center' }}>
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              placeholder="Cari barcode, nama produk, atau kategori..."
              value={productDetailSearch}
              onChange={e => setProductDetailSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.85rem', color: '#1e293b' }}
            />
          </div>

          {/* Table */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '1.25rem', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <table className="table-premium">
              <thead>
                <tr>
                  {['Barcode', 'Nama Produk', 'Kategori', 'Stok', 'Min Stok', 'Harga Beli (HPP)', 'Harga Jual', 'Margin (Rp / %)', 'Nilai Aset', 'Potensi Omzet', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: ['Barcode', 'Nama Produk', 'Kategori', 'Status'].includes(h) ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(productDetailsData.products || [])
                  .filter((p: any) =>
                    p.name.toLowerCase().includes(productDetailSearch.toLowerCase()) ||
                    p.barcode.toLowerCase().includes(productDetailSearch.toLowerCase()) ||
                    p.categoryName.toLowerCase().includes(productDetailSearch.toLowerCase())
                  )
                  .length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Tidak ada data produk</td>
                  </tr>
                ) : (
                  (productDetailsData.products || [])
                    .filter((p: any) =>
                      p.name.toLowerCase().includes(productDetailSearch.toLowerCase()) ||
                      p.barcode.toLowerCase().includes(productDetailSearch.toLowerCase()) ||
                      p.categoryName.toLowerCase().includes(productDetailSearch.toLowerCase())
                    )
                    .map((p: any) => {
                      const isLow = p.stock <= p.minStock;
                      return (
                        <tr key={p.id} style={{ background: isLow ? 'rgba(239,68,68,0.02)' : 'transparent' }}>
                          <td style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.78rem' }}>{p.barcode}</td>
                          <td style={{ fontWeight: 700, color: isLow ? '#dc2626' : '#1e293b' }}>{p.name}</td>
                          <td style={{ color: '#64748b' }}>{p.categoryName}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: isLow ? '#dc2626' : '#1e293b' }}>{p.stock} unit</td>
                          <td style={{ textAlign: 'right', color: '#64748b' }}>{p.minStock} unit</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(p.buyPrice)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(p.sellPrice)}</td>
                          <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 700 }}>
                            {formatCurrency(p.marginNominal)} ({p.marginPercent}%)
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#475569' }}>{formatCurrency(p.totalAssetValuation)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#10b981' }}>{formatCurrency(p.totalPotentialSales)}</td>
                          <td>
                            {isLow ? (
                              <span className="badge-premium" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                                <AlertTriangle size={11} /> Kritis
                              </span>
                            ) : (
                              <span className="badge-premium" style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981' }}>
                                <Check size={11} /> Aman
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB CONTENT 7: LAPORAN RIWAYAT TRANSAKSI PENJUALAN (BARU) ─── */}
      {activeTab === 'transactions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <div className="card-premium" style={{ borderLeft: '4px solid #10b981' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Omzet Sah (Bersih)</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#10b981' }}>
                {formatCurrency(transactionsData.filter(o => o.status !== 'Void').reduce((sum, o) => sum + o.total, 0))}
              </span>
              <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Total penjualan bersih dikurangi diskon</span>
            </div>
            
            <div className="card-premium" style={{ borderLeft: '4px solid #3b82f6' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Volume Penjualan</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#3b82f6' }}>
                {transactionsData.filter(o => o.status !== 'Void').length} Transaksi
              </span>
              <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Jumlah pesanan diselesaikan (non-Void)</span>
            </div>

            <div className="card-premium" style={{ borderLeft: '4px solid #f59e0b' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Rata-rata Keranjang Belanja</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f59e0b' }}>
                {(() => {
                  const valids = transactionsData.filter(o => o.status !== 'Void');
                  const total = valids.reduce((sum, o) => sum + o.total, 0);
                  const avg = valids.length > 0 ? total / valids.length : 0;
                  return formatCurrency(avg);
                })()}
              </span>
              <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Rata-rata nilai belanja per transaksi</span>
            </div>

            <div className="card-premium" style={{ borderLeft: '4px solid #ef4444' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Transaksi Void (Batal)</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#ef4444' }}>
                {transactionsData.filter(o => o.status === 'Void').length} Void
              </span>
              <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>Transaksi dibatalkan & stok direfund</span>
            </div>
          </div>

          {/* Search bar (no-print) */}
          <div className="no-print" style={{ display: 'flex', gap: '1rem', background: 'white', padding: '1rem', borderRadius: '1rem', border: '1px solid #e2e8f0', alignItems: 'center' }}>
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              placeholder="Cari berdasarkan No. Order atau nama pelanggan..."
              value={transactionSearch}
              onChange={e => setTransactionSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.85rem', color: '#1e293b' }}
            />
          </div>

          {/* Table */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '1.25rem', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <table className="table-premium">
              <thead>
                <tr>
                  {['Tanggal/Waktu', 'No. Order', 'Pelanggan', 'Kasir', 'Metode Bayar', 'Status', 'Total Bersih'].map(h => (
                    <th key={h} style={{ textAlign: ['Tanggal/Waktu', 'No. Order', 'Pelanggan', 'Kasir', 'Metode Bayar', 'Status'].includes(h) ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactionsData.filter((o: any) =>
                  o.orderNumber.toLowerCase().includes(transactionSearch.toLowerCase()) ||
                  o.customerName.toLowerCase().includes(transactionSearch.toLowerCase())
                ).length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Tidak ada transaksi ditemukan</td>
                  </tr>
                ) : (
                  transactionsData
                    .filter((o: any) =>
                      o.orderNumber.toLowerCase().includes(transactionSearch.toLowerCase()) ||
                      o.customerName.toLowerCase().includes(transactionSearch.toLowerCase())
                    )
                    .map((o: any) => {
                      const isVoid = o.status === 'Void';
                      const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '—';
                      return (
                        <tr key={o.id} style={{ background: isVoid ? 'rgba(239,68,68,0.02)' : 'transparent' }}>
                          <td style={{ color: '#64748b', fontSize: '0.78rem' }}>{dateStr}</td>
                          <td style={{ fontWeight: 800, color: '#1e293b' }}>{o.orderNumber}</td>
                          <td style={{ fontWeight: 600, color: '#334155' }}>{o.customerName || 'Walk-in'}</td>
                          <td style={{ color: '#64748b' }}>{o.user?.name || 'Kasir'}</td>
                          <td style={{ color: '#334155', fontWeight: 600 }}>{o.paymentMethod || 'Tunai'}</td>
                          <td>
                            {isVoid ? (
                              <span className="badge-premium" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                                Void
                              </span>
                            ) : (
                              <span className="badge-premium" style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981' }}>
                                Paid
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: isVoid ? '#94a3b8' : '#1e293b' }}>
                            {formatCurrency(o.total)}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB CONTENT 5: LABA RUGI & ARUS KAS (AKUNTANSI) ─── */}
      {activeTab === 'accounting' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Sub Tab Navigation (no-print) */}
          <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.35rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
              {[
                { key: 'pl', label: 'Laporan Laba Rugi (P&L)', icon: <TrendingUp size={14} /> },
                { key: 'cashflow', label: 'Laporan Arus Kas', icon: <CreditCard size={14} /> },
                { key: 'ledger', label: 'Jurnal Ledger Umum', icon: <BookOpen size={14} /> }
              ].map(sub => (
                <button
                  key={sub.key}
                  onClick={() => setAccountingSubTab(sub.key as AccountingSubTabType)}
                  style={{ border: 'none', background: accountingSubTab === sub.key ? 'white' : 'transparent', color: accountingSubTab === sub.key ? '#10b981' : '#64748b', padding: '0.45rem 1rem', borderRadius: '0.5rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', transition: 'all 0.12s', boxShadow: accountingSubTab === sub.key ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
                >
                  {sub.icon} {sub.label}
                </button>
              ))}
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={exportCSV}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', cursor: 'pointer', color: '#10b981', fontWeight: 800, fontSize: '0.78rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.12s' }}
                onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                onMouseOut={(e) => e.currentTarget.style.background = 'white'}
              >
                <Download size={14} /> Ekspor CSV (Excel)
              </button>
              <button
                onClick={handlePrint}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1rem', background: '#10b981', border: 'none', borderRadius: '0.75rem', cursor: 'pointer', color: 'white', fontWeight: 800, fontSize: '0.78rem', boxShadow: '0 1px 2px rgba(16,185,129,0.15)', transition: 'all 0.12s' }}
                onMouseOver={(e) => e.currentTarget.style.background = '#0d9488'}
                onMouseOut={(e) => e.currentTarget.style.background = '#10b981'}
              >
                <Printer size={14} /> Unduh Laporan PDF (Eksklusif)
              </button>
            </div>
          </div>

          {/* Laba Rugi (P&L) */}
          {accountingSubTab === 'pl' && (
            <div className="paper-report-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#1e293b', letterSpacing: '0.05em' }}>LAPORAN LABA RUGI</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, marginTop: '0.2rem' }}>
                  Periode: {new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} s/d {new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '650px', margin: '0 auto', width: '100%' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>1. PENDAPATAN OPERASIONAL</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingLeft: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Penjualan Bersih Kasir</span>
                      <span style={{ fontWeight: 700, color: '#1e293b' }}>{formatCurrency(accountingData.profitLoss?.salesRevenue)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Pendapatan Lain-lain (Petty Cash Masuk)</span>
                      <span style={{ fontWeight: 700, color: '#1e293b' }}>{formatCurrency(accountingData.profitLoss?.otherRevenue)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Kelebihan Uang Kasir (Overage)</span>
                      <span style={{ fontWeight: 700, color: '#1e293b' }}>{formatCurrency(accountingData.profitLoss?.shiftOverage)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 800, borderTop: '1px dashed #e2e8f0', paddingTop: '0.4rem', marginTop: '0.25rem' }}>
                      <span style={{ color: '#1e293b' }}>Total Pendapatan Operasional</span>
                      <span style={{ color: '#1e293b' }}>{formatCurrency(accountingData.profitLoss?.operatingRevenue)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>2. HARGA POKOK PENJUALAN (HPP)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingLeft: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Beban Pokok Persediaan Bahan Baku (HPP)</span>
                      <span style={{ fontWeight: 700, color: '#ef4444' }}>-{formatCurrency(accountingData.profitLoss?.cogs)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 800, borderTop: '1px dashed #e2e8f0', paddingTop: '0.4rem', marginTop: '0.25rem' }}>
                      <span style={{ color: '#1e293b' }}>Total Beban HPP</span>
                      <span style={{ color: '#ef4444' }}>-{formatCurrency(accountingData.profitLoss?.cogs)}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 900, background: '#f8fafc', padding: '0.6rem 1rem', borderRadius: '0.5rem', borderLeft: '4px solid #10b981', margin: '0.5rem 0' }}>
                  <span style={{ color: '#10b981' }}>LABA KOTOR (GROSS PROFIT)</span>
                  <span style={{ color: '#10b981' }}>{formatCurrency(accountingData.profitLoss?.grossProfit)}</span>
                </div>

                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>3. BEBAN OPERASIONAL (OPEX)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingLeft: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Beban Kas Operasional (Petty Cash Keluar)</span>
                      <span style={{ fontWeight: 700, color: '#ef4444' }}>-{formatCurrency(accountingData.profitLoss?.opexAmount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Kekurangan Uang Kasir (Shortage)</span>
                      <span style={{ fontWeight: 700, color: '#ef4444' }}>-{formatCurrency(accountingData.profitLoss?.shiftShortage)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 800, borderTop: '1px dashed #e2e8f0', paddingTop: '0.4rem', marginTop: '0.25rem' }}>
                      <span style={{ color: '#1e293b' }}>Total Beban Operasional</span>
                      <span style={{ color: '#ef4444' }}>-{formatCurrency(accountingData.profitLoss?.operatingExpenses)}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 950, background: 'rgba(16,185,129,0.08)', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1.5px solid #10b981', marginTop: '0.5rem' }}>
                  <span style={{ color: '#10b981' }}>LABA BERSIH OPERASIONAL (NET INCOME)</span>
                  <span style={{ color: '#10b981', borderBottom: '3px double #10b981', paddingBottom: '2px' }}>{formatCurrency(accountingData.profitLoss?.netIncome)}</span>
                </div>

              </div>
            </div>
          )}

          {/* Arus Kas */}
          {accountingSubTab === 'cashflow' && (
            <div className="paper-report-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#1e293b', letterSpacing: '0.05em' }}>LAPORAN ARUS KAS (METODE LANGSUNG)</h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, marginTop: '0.2rem' }}>
                  Periode: {new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} s/d {new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '650px', margin: '0 auto', width: '100%' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#10b981', borderBottom: '1.5px solid #a7f3d0', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>ARUS KAS MASUK (INFLOW)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingLeft: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Penerimaan Uang dari Pelanggan (Omzet)</span>
                      <span style={{ fontWeight: 700, color: '#1e293b' }}>{formatCurrency(accountingData.cashFlow?.inflow?.salesReceipts)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Penerimaan Petty Cash</span>
                      <span style={{ fontWeight: 700, color: '#1e293b' }}>{formatCurrency(accountingData.cashFlow?.inflow?.otherReceipts)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Akumulasi Kelebihan Uang Laci Shift</span>
                      <span style={{ fontWeight: 700, color: '#1e293b' }}>{formatCurrency(accountingData.cashFlow?.inflow?.overages)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 800, borderTop: '1px dashed #e2e8f0', paddingTop: '0.4rem', marginTop: '0.25rem' }}>
                      <span style={{ color: '#10b981' }}>Total Kas Masuk</span>
                      <span style={{ color: '#10b981' }}>{formatCurrency(accountingData.cashFlow?.inflow?.total)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#ef4444', borderBottom: '1.5px solid #fca5a5', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>ARUS KAS KELUAR (OUTFLOW)</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingLeft: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Pembayaran Biaya Petty Cash (Bahan & Operasional)</span>
                      <span style={{ fontWeight: 700, color: '#ef4444' }}>-{formatCurrency(accountingData.cashFlow?.outflow?.opexPayments)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Akumulasi Kekurangan Uang Laci Shift</span>
                      <span style={{ fontWeight: 700, color: '#ef4444' }}>-{formatCurrency(accountingData.cashFlow?.outflow?.shortages)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 800, borderTop: '1px dashed #e2e8f0', paddingTop: '0.4rem', marginTop: '0.25rem' }}>
                      <span style={{ color: '#ef4444' }}>Total Kas Keluar</span>
                      <span style={{ color: '#ef4444' }}>-{formatCurrency(accountingData.cashFlow?.outflow?.total)}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 950, background: 'rgba(16,185,129,0.08)', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1.5px solid #10b981', marginTop: '0.5rem' }}>
                  <span style={{ color: '#10b981' }}>KENAIKAN/(PENURUNAN) KAS BERSIH</span>
                  <span style={{ color: '#10b981', borderBottom: '3px double #10b981', paddingBottom: '2px' }}>{formatCurrency(accountingData.cashFlow?.netCashFlow)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Jurnal Ledger */}
          {accountingSubTab === 'ledger' && (
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '1.25rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#1e293b' }}>BUKU JURNAL UMUM (DOUBLE ENTRY LEDGER)</h3>
                <p style={{ margin: '0.15rem 0 0', color: '#64748b', fontSize: '0.72rem', fontWeight: 600 }}>Daftar entri jurnal penyeimbang otomatis yang digenerate oleh sistem POS</p>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                    {['TANGGAL / REF', 'DESKRIPSI TRANSAKSI & AKUN', 'DEBIT', 'KREDIT'].map((h, i) => (
                      <th key={h} style={{ padding: '0.65rem 1.25rem', textAlign: i >= 2 ? 'right' : 'left', fontSize: '0.65rem', fontWeight: 800, color: '#475569', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accountingData.journals?.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontSize: '0.85rem' }}>Belum ada entri jurnal dalam rentang tanggal ini</td>
                    </tr>
                  ) : (
                    accountingData.journals.map((j: any) => (
                      <tr key={j.reference} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '1rem 1.25rem', verticalAlign: 'top', width: '20%' }}>
                          <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#1e293b' }}>
                            {new Date(j.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 800, background: 'rgba(16,185,129,0.08)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', marginTop: '0.2rem', display: 'inline-block' }}>
                            {j.reference}
                          </span>
                        </td>

                        <td colSpan={3} style={{ padding: 0 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                              <tr style={{ background: 'rgba(248,250,252,0.6)' }}>
                                <td colSpan={3} style={{ padding: '0.5rem 1.25rem', fontWeight: 700, fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', borderBottom: '1px solid #e2e8f0' }}>
                                  {j.description}
                                </td>
                              </tr>
                              {j.lines?.map((l: any, idx: number) => {
                                const isCredit = l.credit > 0;
                                return (
                                  <tr key={idx} style={{ borderBottom: idx === j.lines.length - 1 ? 'none' : '1px dashed #e2e8f0' }}>
                                    <td style={{ padding: '0.55rem 1.25rem', fontSize: '0.8rem', color: isCredit ? '#475569' : '#1e293b', fontWeight: isCredit ? 500 : 700, paddingLeft: isCredit ? '2.5rem' : '1.25rem', width: '50%' }}>
                                      {l.account}
                                    </td>
                                    <td style={{ padding: '0.55rem 1.25rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', width: '25%' }}>
                                      {l.debit > 0 ? formatCurrency(l.debit) : ''}
                                    </td>
                                    <td style={{ padding: '0.55rem 1.25rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', width: '25%' }}>
                                      {l.credit > 0 ? formatCurrency(l.credit) : ''}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', color: '#64748b', fontSize: '0.78rem', borderTop: '1px solid #e2e8f0', marginTop: 'auto' }}>
        <span>{posContext?.settings?.storeName || 'SOL Cafe'} POS System — Modul Laporan Akuntansi Versi 1.3</span>
        <span>Filter Aktif: {startDate} s/d {endDate}</span>
      </div>

    </div>
  );
};

export default ReportView;
