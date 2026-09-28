import React, { useState, useEffect, useContext } from 'react';
import { 
  QrCode, Printer, AlertTriangle, Users, Globe, Search, Copy, ExternalLink, 
  Download, Check, RefreshCw
} from 'lucide-react';
import PrintQRModal from './PrintQRModal';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';

const QRCodeView = () => {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedQRTable, setSelectedQRTable] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const posContext = useContext(POSContext);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tables', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        
        const rawBaseUrl = posContext?.settings?.qrCodeBaseUrl?.trim();
        let baseUrl = `${window.location.protocol}//${window.location.host}`;
        if (rawBaseUrl) {
          baseUrl = rawBaseUrl.startsWith('http://') || rawBaseUrl.startsWith('https://') 
            ? rawBaseUrl 
            : `${window.location.protocol}//${rawBaseUrl}`;
          if (baseUrl.endsWith('/')) {
            baseUrl = baseUrl.slice(0, -1);
          }
        }

        const mappedTables = data.map((t: any) => ({
          ...t,
          no: t.tableNo.toLowerCase().startsWith('meja') ? t.tableNo : `Meja ${t.tableNo}`,
          desc: `Kapasitas: ${t.capacity || 2} Orang`,
          active: t.active !== undefined ? t.active : (t.status !== 'Nonaktif'),
          url: `${baseUrl}/dinein/table/${t.id}?ref=${encodeURIComponent(t.tableNo)}`
        }));
        setTables(mappedTables);
      }
    } catch (err) {
      console.error(err);
      toast('Gagal memuat daftar meja', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (posContext?.token) {
      fetchTables();
    }
  }, [posContext?.token, posContext?.settings]);

  const toggleActive = (id: number) => {
    setTables(prev => prev.map(t => t.id === id ? { ...t, active: !t.active } : t));
  };

  const handleCopyLink = async (table: any) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(table.url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = table.url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedId(table.id);
      toast(`Link ${table.no} berhasil disalin ke clipboard!`, 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error(err);
      toast('Gagal menyalin link', 'error');
    }
  };

  const handleDownloadPNG = async (table: any) => {
    try {
      toast(`Menyiapkan berkas QR ${table.no}...`, 'info');
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(table.url)}`;
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `QR-${table.no.replace(/\s+/g, '-')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast(`QR ${table.no} berhasil diunduh!`, 'success');
    } catch (err) {
      console.error(err);
      toast('Gagal mengunduh QR PNG', 'error');
    }
  };

  const getTableBadgeNumber = (tableNo: string) => {
    const match = tableNo.match(/\d+/);
    if (match) return match[0].padStart(2, '0');
    return tableNo.slice(0, 2).toUpperCase();
  };

  // Metrics
  const totalCapacity = tables.reduce((acc, t) => acc + (t.capacity || 0), 0);
  const rawBaseUrl = posContext?.settings?.qrCodeBaseUrl?.trim();
  const displayDomain = rawBaseUrl 
    ? rawBaseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '') 
    : window.location.host;

  const activeTablesCount = tables.filter(t => t.active).length;
  const inactiveTablesCount = tables.filter(t => !t.active).length;

  const filteredTables = tables.filter(t => {
    const matchSearch = !searchQuery.trim() || 
      t.no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tableNo.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchStatus = true;
    if (statusFilter === 'active') matchStatus = t.active;
    if (statusFilter === 'inactive') matchStatus = !t.active;

    return matchSearch && matchStatus;
  });

  return (
    <div className="p-3 sm:p-6 pb-52 sm:pb-16 w-full flex flex-col gap-3.5 sm:gap-6 animate-fade-in max-w-7xl mx-auto">
      
      {/* ─────────────────────────────────────────────────────────────
          1. TOP METRIC CARDS (KAPASITAS TOTAL & DOMAIN DINE-IN)
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* Card 1: Kapasitas Total */}
          <div className="p-3.5 sm:p-5 bg-amber-50/60 border border-amber-200/70 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-amber-700">
              <Users size={16} className="shrink-0" />
              <span className="text-[11px] sm:text-xs font-bold tracking-tight">Kapasitas Total</span>
            </div>
            <div className="mt-2">
              <h3 className="text-lg sm:text-2xl font-black text-slate-900">
                {totalCapacity} <span className="text-xs sm:text-sm font-bold text-amber-800">Kursi</span>
              </h3>
            </div>
          </div>

          {/* Card 2: Domain Dine-In */}
          <div className="p-3.5 sm:p-5 bg-sky-50/60 border border-sky-200/70 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-sky-700">
              <Globe size={16} className="shrink-0" />
              <span className="text-[11px] sm:text-xs font-bold tracking-tight">Domain Dine-In</span>
            </div>
            <div className="mt-2">
              <h3 className="text-xs sm:text-base font-black text-slate-900 truncate font-mono">
                {displayDomain}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. SEARCH & STATUS FILTER STRIP
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
        {/* Search input */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nomor meja (misal: Meja 01)..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({tables.length})
          </button>

          <button
            onClick={() => setStatusFilter('active')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
              statusFilter === 'active'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Aktif ({activeTablesCount})
          </button>

          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
              statusFilter === 'inactive'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Nonaktif ({inactiveTablesCount})
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. TABLE QR CARDS GRID (PRECISE VISUAL MATCH)
      ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80">
          <RefreshCw className="animate-spin inline-block mb-2 text-indigo-600" size={24} />
          <p className="font-bold text-slate-600">Memuat QR Code Meja...</p>
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="bg-white p-10 rounded-3xl border border-slate-200/80 text-center flex flex-col items-center">
          <AlertTriangle size={44} className="text-amber-500 mb-3" />
          <h3 className="text-base font-bold text-slate-800">Tidak Ada Data Meja</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            {searchQuery 
              ? 'Tidak ada nomor meja yang cocok dengan filter pencarian.' 
              : 'Belum ada meja yang terdaftar di sistem. Buka menu Manajemen Meja untuk menambah meja.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredTables.map(table => {
            const badgeNum = getTableBadgeNumber(table.tableNo || table.no);
            const storeName = posContext?.settings?.storeName || 'MUKI RAMEN';

            return (
              <div 
                key={table.id}
                className="bg-white rounded-3xl border border-indigo-100/90 shadow-xs p-5 space-y-4 hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between"
              >
                {/* CARD HEADER */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Squircle Number Badge */}
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100/80 text-indigo-600 font-black text-sm flex items-center justify-center shrink-0 shadow-2xs">
                      {badgeNum}
                    </div>
                    <div>
                      <h4 className="font-black text-base text-slate-900 leading-tight">
                        {table.no}
                      </h4>
                      <p className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                        <Users size={12} className="text-slate-400" />
                        <span>{table.desc}</span>
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${table.active ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {table.active ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleActive(table.id)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        table.active ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                      role="switch"
                      aria-checked={table.active}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          table.active ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* QR STAND TABLE TENT PREVIEW CARD */}
                <div className="w-64 max-w-full mx-auto p-5 bg-white rounded-2xl border border-indigo-100/80 shadow-md text-center flex flex-col items-center justify-center relative">
                  {/* Stand Header */}
                  <div className="font-black text-xs tracking-wider text-indigo-700 uppercase">
                    {storeName}
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Scan Meja untuk Pesan
                  </div>

                  {/* QR Image Box */}
                  <div className="my-3 relative">
                    {table.active ? (
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(table.url)}`} 
                        alt={`QR Code ${table.no}`} 
                        className="w-44 h-44 object-contain rounded-lg"
                      />
                    ) : (
                      <div className="w-44 h-44 bg-slate-50 border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-400 p-2">
                        <QrCode size={40} className="text-slate-300 mb-1.5" />
                        <span className="text-xs font-bold">QR Nonaktif</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">Aktifkan toggle di atas</span>
                      </div>
                    )}
                  </div>

                  {/* Stand Footer */}
                  <div className="border-t border-slate-100 pt-2 w-full">
                    <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 block">
                      NOMOR MEJA
                    </span>
                    <span className="text-lg font-black text-slate-900 block mt-0.5">
                      {table.no}
                    </span>
                  </div>
                </div>

                {/* URL DISPLAY & COPY / OPEN ACTIONS */}
                <div className="flex items-center justify-between gap-2 px-1 text-slate-400">
                  <span className="text-xs font-mono text-slate-400 truncate flex-1" title={table.url}>
                    {table.url.replace(/^https?:\/\//, '')}
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleCopyLink(table)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Salin Link Meja"
                    >
                      {copiedId === table.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>

                    <a
                      href={table.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Buka Halaman Self-Order"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>

                {/* BOTTOM ACTION BUTTONS: CETAK STAND & UNDUH PNG */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <button
                    disabled={!table.active}
                    onClick={() => {
                      setSelectedQRTable(table);
                      setIsPrintModalOpen(true);
                    }}
                    className="w-full py-2.5 px-3 bg-indigo-50/80 hover:bg-indigo-100 disabled:opacity-50 text-indigo-700 border border-indigo-200/80 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-2xs"
                  >
                    <Printer size={14} />
                    <span>Cetak Stand</span>
                  </button>

                  <button
                    disabled={!table.active}
                    onClick={() => handleDownloadPNG(table)}
                    className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-2xs"
                  >
                    <Download size={14} />
                    <span>Unduh PNG</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL PRINT QR STAND */}
      <PrintQRModal 
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        tableData={selectedQRTable}
      />
    </div>
  );
};

export default QRCodeView;
