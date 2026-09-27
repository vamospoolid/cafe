import React, { useState, useEffect, useContext, useMemo } from 'react';
import { 
  QrCode, 
  Printer, 
  AlertTriangle, 
  Search, 
  ExternalLink, 
  Copy, 
  Check, 
  Download, 
  Sparkles, 
  Users, 
  Globe, 
  CheckCircle2, 
  RefreshCw,
  Layers,
  HelpCircle,
  Eye,
  SlidersHorizontal,
  FileSpreadsheet
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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  
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

        // Memetakan data dari backend ke format tampilan QR yang aman per tenant
        const mappedTables = data.map((t: any) => ({
          ...t,
          no: `Meja ${t.tableNo}`,
          desc: `Kapasitas: ${t.capacity || 4} Orang`,
          active: t.active !== undefined ? t.active : true,
          url: `${baseUrl}/dinein/table/${t.id}?ref=${t.tableNo}`
        }));
        setTables(mappedTables);
      }
    } catch (err) {
      console.error('Gagal mengambil data meja:', err);
      toast('Gagal memuat data meja. Silakan coba lagi.', 'error');
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

  const handleCopyLink = (table: any) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(table.url);
      setCopiedId(table.id);
      toast(`Link ${table.no} berhasil disalin ke clipboard!`, 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      toast(table.url, 'info');
    }
  };

  const handleDownloadQR = async (table: any) => {
    try {
      toast(`Menyiapkan kartu stand PNG untuk ${table.no}...`, 'info');
      const storeName = posContext?.settings?.storeName || 'KAFE & RESTORAN';
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(table.url)}`;

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        // Buat canvas beresolusi tinggi (Ukuran A6 proporsional: 800 x 1100 px siap cetak)
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 1100;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Background putih bersih
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Border luar elegan
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 10;
        ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

        // Aksen atas (Indigo brand)
        ctx.fillStyle = '#4F46E5';
        ctx.fillRect(40, 40, canvas.width - 80, 14);

        // Nama Kafe / Store
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1E1B4B';
        ctx.font = 'bold 44px sans-serif';
        ctx.fillText(storeName.toUpperCase(), canvas.width / 2, 130);

        // Subtitle Instruksi
        ctx.fillStyle = '#64748B';
        ctx.font = '600 24px sans-serif';
        ctx.fillText('Scan QR untuk Pesan & Bayar', canvas.width / 2, 180);

        // Box QR Code
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(100, 220, 600, 600);
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 3;
        ctx.strokeRect(100, 220, 600, 600);

        // Render QR Code tajam
        ctx.drawImage(img, 130, 250, 540, 540);

        // Label NOMOR MEJA
        ctx.fillStyle = '#94A3B8';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('NOMOR MEJA', canvas.width / 2, 890);

        // Angka / Nama Meja Besar
        ctx.fillStyle = '#0F172A';
        ctx.font = '900 68px sans-serif';
        ctx.fillText(table.no.toUpperCase(), canvas.width / 2, 970);

        // Footer Dine-In
        ctx.fillStyle = '#4F46E5';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('✨ Dine-In Self Order', canvas.width / 2, 1025);

        // Export ke file PNG murni
        canvas.toBlob((blob) => {
          if (!blob) {
            toast('Gagal memproses gambar', 'error');
            return;
          }
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `QR-${table.no.replace(/\s+/g, '-')}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Tunggu 30 detik sebelum menghapus blob URL agar browser selesai menulis file ke disk
          setTimeout(() => {
            window.URL.revokeObjectURL(blobUrl);
          }, 30000);

          toast(`Kartu QR Code ${table.no} berhasil diunduh sebagai file PNG!`, 'success');
        }, 'image/png');
      };

      img.onerror = () => {
        // Fallback langsung download gambar mentah
        fetch(qrApiUrl)
          .then(res => res.blob())
          .then(blob => {
            const pngBlob = new Blob([blob], { type: 'image/png' });
            const blobUrl = window.URL.createObjectURL(pngBlob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `QR-${table.no.replace(/\s+/g, '-')}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 30000);
            toast(`QR Code ${table.no} berhasil diunduh!`, 'success');
          })
          .catch(() => {
            window.open(qrApiUrl, '_blank');
          });
      };

      img.src = qrApiUrl;
    } catch (err) {
      console.error(err);
      toast('Gagal mengunduh gambar QR.', 'error');
    }
  };

  // Cetak Semua Meja Sekaligus (Stand Akrilik Siap Potong)
  const handleBulkPrint = () => {
    const activeTables = tables.filter(t => t.active);
    if (activeTables.length === 0) {
      toast('Tidak ada meja aktif untuk dicetak.', 'warning');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast('Pop-up terblokir. Izinkan pop-up di browser untuk mencetak.', 'error');
      return;
    }

    const storeName = posContext?.settings?.storeName || 'KAFE & RESTORAN';

    const cardsHtml = activeTables.map(t => `
      <div style="
        border: 2px dashed #cbd5e1; 
        border-radius: 16px; 
        padding: 24px; 
        width: 240px; 
        text-align: center; 
        page-break-inside: avoid;
        margin: 12px;
        display: inline-block;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
      ">
        <div style="font-size: 14px; font-weight: 800; color: #4338ca; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
          ${storeName}
        </div>
        <div style="font-size: 11px; color: #64748b; margin-bottom: 12px;">
          Scan untuk Pesan Menu & Bayar
        </div>
        <div style="background: #ffffff; padding: 10px; border-radius: 12px; border: 1px solid #e2e8f0; display: inline-block; margin-bottom: 12px;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(t.url)}" width="160" height="160" alt="QR" />
        </div>
        <div style="font-size: 12px; font-weight: 700; color: #64748b; letter-spacing: 1px;">NOMOR MEJA</div>
        <div style="font-size: 28px; font-weight: 900; color: #0f172a; margin-top: 2px;">
          ${t.no.toUpperCase()}
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 6px;">
          Dine-In Self Order
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cetak QR Code Stand Meja - ${storeName}</title>
          <style>
            @media print {
              body { margin: 0; padding: 10mm; }
              @page { size: A4; margin: 10mm; }
            }
          </style>
        </head>
        <body style="margin: 0; padding: 20px; background: #fff; text-align: center;">
          <div style="margin-bottom: 20px;">
            <h2 style="margin: 0; font-family: sans-serif; color: #1e293b;">Stand Akrilik QR Meja - ${storeName}</h2>
            <p style="margin: 4px 0 0; font-family: sans-serif; font-size: 12px; color: #64748b;">Potong sesuai garis putus-putus dan pasang pada akrilik meja</p>
          </div>
          <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;">
            ${cardsHtml}
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter & Search
  const filteredTables = useMemo(() => {
    return tables.filter(table => {
      const matchQuery = table.no.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (table.desc && table.desc.toLowerCase().includes(searchQuery.toLowerCase()));
      if (statusFilter === 'ACTIVE') return matchQuery && table.active;
      if (statusFilter === 'INACTIVE') return matchQuery && !table.active;
      return matchQuery;
    });
  }, [tables, searchQuery, statusFilter]);

  const totalCapacity = tables.reduce((acc, t) => acc + (Number(t.capacity) || 4), 0);
  const activeCount = tables.filter(t => t.active).length;
  const storeName = posContext?.settings?.storeName || 'Kafe Anda';

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-32 sm:pb-20 w-full max-w-7xl mx-auto flex flex-col gap-6">
      
      {/* ─── 1. HEADER SECTION (MODERN SAAS HERO BAR) ────────────────────── */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold mb-3">
              <Sparkles size={14} className="text-indigo-600" />
              <span>Dine-In Self-Order Ecosystem</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <QrCode className="text-indigo-600" size={28} />
              <span>QR Code Nomor Meja</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1.5 max-w-2xl leading-relaxed">
              Cetak QR Code untuk stand akrilik tiap meja. Pelanggan cukup scan untuk melihat menu digital, memesan mandiri, dan bayar QRIS langsung dari tempat duduk.
            </p>
          </div>

          {/* Action Header Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchTables}
              disabled={loading}
              className="p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all active:scale-95 disabled:opacity-50"
              title="Refresh Data Meja"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin text-indigo-600' : ''} />
            </button>

            <button
              onClick={handleBulkPrint}
              disabled={loading || tables.length === 0}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              <Printer size={18} />
              <span>Cetak Semua Stand Akrilik</span>
            </button>
          </div>
        </div>

        {/* ─── 2. STATS OVERVIEW CARDS ────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/60">
            <div className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
              <Layers size={14} className="text-indigo-600" /> Total Meja
            </div>
            <div className="text-xl font-black text-slate-900 mt-1">{tables.length} Meja</div>
          </div>

          <div className="bg-emerald-50/60 rounded-2xl p-3.5 border border-emerald-100">
            <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" /> Siap Scan Aktif
            </div>
            <div className="text-xl font-black text-emerald-900 mt-1">{activeCount} Meja</div>
          </div>

          <div className="bg-amber-50/60 rounded-2xl p-3.5 border border-amber-100">
            <div className="text-xs text-amber-700 font-semibold flex items-center gap-1.5">
              <Users size={14} className="text-amber-600" /> Kapasitas Total
            </div>
            <div className="text-xl font-black text-amber-900 mt-1">{totalCapacity} Kursi</div>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/60 truncate">
            <div className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
              <Globe size={14} className="text-blue-600" /> Domain Dine-In
            </div>
            <div className="text-xs font-mono font-bold text-slate-700 mt-1.5 truncate" title={window.location.origin}>
              {window.location.host}
            </div>
          </div>
        </div>

      </div>

      {/* ─── 3. SEARCH, FILTER, & CONTROLS TOOLBAR ───────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3.5 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nomor meja (misal: Meja 01)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({tables.length})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Aktif ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('INACTIVE')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'INACTIVE'
                ? 'bg-slate-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Nonaktif ({tables.length - activeCount})
          </button>
        </div>

      </div>

      {/* ─── 4. CARDS GRID (PREMIUM ACRYLIC STAND MOCKUP) ────────────────── */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-24 bg-white rounded-3xl border border-slate-200/80">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent mb-3" />
          <p className="text-sm font-bold text-slate-600">Menyiapkan data QR Code meja...</p>
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200/80 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-lg font-black text-slate-800">
            {searchQuery ? 'Meja Tidak Ditemukan' : 'Belum Ada Meja Terdaftar'}
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
            {searchQuery 
              ? `Tidak ditemukan meja yang cocok dengan kata kunci "${searchQuery}". Coba ubah filter atau pencarian Anda.`
              : 'Anda belum menambahkan meja ke dalam sistem. Silakan buka menu "Nomor Meja" untuk menambahkan meja kafe Anda.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTables.map(table => (
            <div 
              key={table.id} 
              className={`group bg-white rounded-3xl border transition-all duration-300 flex flex-col overflow-hidden ${
                table.active 
                  ? 'border-slate-200 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/10' 
                  : 'border-slate-200/60 bg-slate-50/50 opacity-70'
              }`}
            >
              
              {/* Card Header: Table No & Toggle */}
              <div className="p-5 pb-4 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                    table.active ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {table.tableNo || '#'}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 leading-none">{table.no}</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1 flex items-center gap-1">
                      <Users size={12} /> {table.desc}
                    </p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold ${table.active ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {table.active ? 'Aktif' : 'Off'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={table.active} 
                      onChange={() => toggleActive(table.id)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>
              </div>

              {/* Card Body: Acrylic Stand Mockup */}
              <div className="p-6 flex flex-col items-center justify-center flex-1 bg-gradient-to-b from-slate-50/50 to-white">
                
                {/* Acrylic Tent Frame */}
                <div className="relative bg-white p-4 rounded-2xl border-2 border-slate-200/90 shadow-md group-hover:border-indigo-200 group-hover:shadow-lg transition-all flex flex-col items-center">
                  
                  {/* Store Name Banner */}
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 mb-1">
                    {storeName}
                  </div>
                  <div className="text-[9px] font-semibold text-slate-400 mb-3">
                    Scan Meja untuk Pesan
                  </div>

                  {/* QR Image Box */}
                  <div className="relative w-44 h-44 bg-white rounded-xl flex items-center justify-center overflow-hidden">
                    {table.active ? (
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(table.url)}`} 
                        alt={`QR Code ${table.no}`} 
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-300 p-4 text-center">
                        <QrCode size={48} className="mb-2 opacity-50" />
                        <span className="text-xs font-bold text-slate-400">QR Dinonaktifkan</span>
                      </div>
                    )}
                  </div>

                  {/* Big Table Name at the Bottom of Mockup */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 w-full text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">NOMOR MEJA</div>
                    <div className="text-xl font-black text-slate-900">{table.no}</div>
                  </div>

                </div>

                {/* Live URL Preview & Quick Actions */}
                <div className="w-full mt-4 flex items-center justify-between gap-2 px-1">
                  <span className="text-[11px] font-mono text-slate-500 truncate max-w-[180px]" title={table.url}>
                    {table.url.replace(/^https?:\/\//, '')}
                  </span>

                  <div className="flex items-center gap-1">
                    {/* Copy Link */}
                    <button
                      onClick={() => handleCopyLink(table)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                      title="Salin Link Menu Meja"
                    >
                      {copiedId === table.id ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                    </button>

                    {/* Open External Dine-In Page */}
                    <a
                      href={table.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                      title="Buka Halaman Menu Pelanggan"
                    >
                      <ExternalLink size={15} />
                    </a>
                  </div>
                </div>

              </div>

              {/* Card Footer: Action Buttons */}
              <div className="p-4 pt-3 bg-white border-t border-slate-100 grid grid-cols-2 gap-2">
                <button 
                  disabled={!table.active}
                  onClick={() => { setSelectedQRTable(table); setIsPrintModalOpen(true); }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition-all active:scale-95 disabled:opacity-40"
                >
                  <Printer size={15} />
                  <span>Cetak Stand</span>
                </button>

                <button 
                  disabled={!table.active}
                  onClick={() => handleDownloadQR(table)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-40"
                >
                  <Download size={15} />
                  <span>Unduh PNG</span>
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* ─── 5. HELPER TIPS CARD ─────────────────────────────────────────── */}
      <div className="bg-amber-50/60 rounded-3xl p-5 border border-amber-200/70 flex flex-col sm:flex-row items-start sm:items-center gap-4 text-xs text-amber-900">
        <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <HelpCircle size={22} />
        </div>
        <div className="flex-1">
          <div className="font-bold text-sm text-amber-950">💡 Tips Penataan Stand Akrilik Meja Kafe:</div>
          <p className="mt-0.5 text-amber-800/90 leading-relaxed">
            Gunakan tombol <strong>"Cetak Semua Stand Akrilik"</strong> untuk mencetak semua kartu meja di kertas foto atau concorde A4, lalu potong dan selipkan ke akrilik tenda ukuran 10x15 cm (A6). Pelanggan Anda akan langsung bisa scan dan memesan secara mandiri.
          </p>
        </div>
      </div>

      {/* Print Modal Tunggal (Bawaan) */}
      <PrintQRModal 
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        tableData={selectedQRTable}
      />

    </div>
  );
};

export default QRCodeView;

