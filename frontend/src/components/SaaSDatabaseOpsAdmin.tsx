import React, { useState, useEffect, useContext } from 'react';
import { 
  Database, 
  HardDrive, 
  RefreshCw, 
  Download, 
  ShieldCheck, 
  Activity, 
  Server, 
  Layers, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Cpu, 
  FileCode,
  Zap,
  Trash2,
  Lock,
  BarChart3,
  TrendingUp,
  FileText,
  RotateCcw,
  Check,
  XCircle,
  Calendar,
  Archive
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';

export const SaaSDatabaseOpsAdmin: React.FC = () => {
  const posContext = useContext(POSContext);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [backupActionLoading, setBackupActionLoading] = useState(false);
  
  const [dbInfo, setDbInfo] = useState<any>({
    engine: 'PostgreSQL 16',
    status: 'CONNECTED',
    latencyMs: 12,
    poolStatus: 'Healthy (Max: 20 connections)',
    uptimeSeconds: 0,
    totalRecords: 0,
    counts: {
      tenants: 0,
      outlets: 0,
      users: 0,
      orders: 0,
      products: 0,
      categories: 0,
      ingredients: 0,
      ingredientLogs: 0,
      invoices: 0,
      subscriptions: 0,
      paymentTransactions: 0,
      auditLogs: 0,
      tables: 0,
      cashFlows: 0
    }
  });

  const [backups, setBackups] = useState<any[]>([]);
  const [cronStatus, setCronStatus] = useState<any>(null);

  const fetchDatabaseStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/platform-admin/database-stats', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDbInfo(data);
      } else {
        const fallbackRes = await fetch('/api/database/info', {
          headers: { Authorization: `Bearer ${posContext?.token}` }
        });
        if (fallbackRes.ok) {
          const fbData = await fallbackRes.json();
          setDbInfo((prev: any) => ({
            ...prev,
            ...fbData,
            totalRecords: Object.values(fbData.counts || {}).reduce((a: any, b: any) => Number(a) + Number(b), 0)
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load database stats:', err);
      toast('Gagal memuat statistik database', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await fetch('/api/platform-admin/backups', {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
        if (data.cronStatus) setCronStatus(data.cronStatus);
      }
    } catch (err) {
      console.error('Failed to load backups:', err);
    }
  };

  useEffect(() => {
    fetchDatabaseStats();
    fetchBackups();
  }, [posContext?.token]);

  const handleCreateInstantBackup = async () => {
    const confirmed = await confirmAlert(
      'Buat Snapshot Backup Database Sekarang?',
      'Sistem akan mencadangkan seluruh data multi-tenant dengan enkripsi AES-256-CBC dan kompresi Gzip berkas aman (.json.gz.enc).'
    );
    if (!confirmed) return;

    setBackupActionLoading(true);
    try {
      const res = await fetch('/api/platform-admin/backups/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ scope: 'FULL', isEncrypted: true, compress: true })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat backup');

      toast(`✅ Backup ${data.backup?.filename} berhasil dibuat (${data.backup?.sizeFormatted})!`, 'success');
      await fetchBackups();
    } catch (err: any) {
      toast(err.message || 'Gagal membuat snapshot backup', 'error');
    } finally {
      setBackupActionLoading(false);
    }
  };

  const handlePurgeRetention = async () => {
    const confirmed = await confirmAlert(
      'Jalankan Rotasi Retensi GFS?',
      'Sistem akan memangkas berkas backup kedaluwarsa sesuai kebijakan Grandfather-Father-Son (7 Harian, 4 Mingguan, 3 Bulanan) untuk menghemat ruang disk.'
    );
    if (!confirmed) return;

    setBackupActionLoading(true);
    try {
      const res = await fetch('/api/platform-admin/backups/purge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ useGfs: true })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memproses rotasi retensi');

      toast(`🗑️ Rotasi GFS selesai: ${data.result?.deletedCount || 0} berkas dipangkas (${data.result?.freedFormatted || '0 KB'} dibebaskan).`, 'success');
      await fetchBackups();
    } catch (err: any) {
      toast(err.message || 'Gagal memproses pembersihan retensi', 'error');
    } finally {
      setBackupActionLoading(false);
    }
  };

  const handleVerifyIntegrity = async (fileName: string) => {
    try {
      const res = await fetch(`/api/platform-admin/backups/verify/${encodeURIComponent(fileName)}`, {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      const data = await res.json();
      if (data.isValid) {
        toast(`🛡️ Integritas Kriptografi VALID: ${fileName} utuh & anti-tamper signature lolos verifikasi.`, 'success');
      } else {
        toast(`⚠️ Integritas TIDAK VALID: ${data.error || 'Checksum/signature mismatch'}`, 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Gagal memverifikasi integritas berkas', 'error');
    }
  };

  const handleDownloadBackup = async (fileName: string) => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/platform-admin/backups/download/${encodeURIComponent(fileName)}`, {
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (!res.ok) throw new Error('Gagal mengunduh berkas');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast(`✅ Berkas ${fileName} berhasil diunduh.`, 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal mengunduh berkas', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleRestoreBackup = async (fileName: string) => {
    const confirmed = await confirmAlert(
      `⚠️ PERINGATAN: Restore Database dari ${fileName}?`,
      'Operasi ini akan memulihkan data database dari snapshot yang dipilih. Pastikan Anda telah membuat cadangan darurat terkini sebelum mengeksekusi.'
    );
    if (!confirmed) return;

    setBackupActionLoading(true);
    try {
      const res = await fetch('/api/platform-admin/backups/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({ fileName })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal merestorasi database');

      toast(`✅ Disaster Recovery BERHASIL: ${data.message} (${data.durationMs} ms)`, 'success');
      await fetchDatabaseStats();
    } catch (err: any) {
      toast(err.message || 'Gagal memulihkan database', 'error');
    } finally {
      setBackupActionLoading(false);
    }
  };

  const tableList = [
    { name: 'orders', label: 'Transaksi & Pesanan POS', count: dbInfo.counts?.orders || 0, color: 'bg-emerald-600' },
    { name: 'products & categories', label: 'Master Menu & Katalog', count: (dbInfo.counts?.products || 0) + (dbInfo.counts?.categories || 0), color: 'bg-indigo-600' },
    { name: 'ingredients & logs', label: 'Bahan Baku & Resep HPP', count: (dbInfo.counts?.ingredients || 0) + (dbInfo.counts?.ingredientLogs || 0), color: 'bg-amber-600' },
    { name: 'users & memberships', label: 'Akun Pengguna & Staff', count: dbInfo.counts?.users || 0, color: 'bg-sky-600' },
    { name: 'tenants & outlets', label: 'Mitra Usaha & Cabang Toko', count: (dbInfo.counts?.tenants || 0) + (dbInfo.counts?.outlets || 0), color: 'bg-purple-600' },
    { name: 'invoices & payments', label: 'Tagihan & Payment Ledger', count: (dbInfo.counts?.invoices || 0) + (dbInfo.counts?.paymentTransactions || 0), color: 'bg-rose-600' },
    { name: 'cash_flows', label: 'Arus Kas Masuk / Keluar', count: dbInfo.counts?.cashFlows || 0, color: 'bg-teal-600' },
    { name: 'audit_logs', label: 'Jejak Audit & Keamanan', count: dbInfo.counts?.auditLogs || 0, color: 'bg-slate-700' },
  ];

  const maxCount = Math.max(...tableList.map(t => Number(t.count) || 1), 10);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── Header Hub ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/90 p-6 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-[10px] font-bold tracking-widest uppercase border border-slate-200">
              Database Ops &amp; Disaster Recovery Center
            </span>
            <span className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {dbInfo.status || 'CONNECTED'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-950 mt-1">
            Database Control, Automated Backup &amp; DR
          </h2>
          <p className="text-xs text-slate-500 max-w-xl mt-1 font-medium">
            Pencadangan otomatis 03:00 WIB, enkripsi AES-256, kebijakan retensi GFS, dan Disaster Recovery Engine deterministik (RTO &lt; 10m).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => { fetchDatabaseStats(); fetchBackups(); }}
            disabled={loading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer border border-slate-200 shadow-2xs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handlePurgeRetention}
            disabled={backupActionLoading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
            title="Pangkas berkas backup kedaluwarsa dengan kebijakan GFS"
          >
            <Archive size={14} />
            <span>GFS Prune</span>
          </button>

          <button
            onClick={handleCreateInstantBackup}
            disabled={backupActionLoading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <ShieldCheck size={14} className={backupActionLoading ? 'animate-spin' : ''} />
            <span>{backupActionLoading ? 'Memproses...' : 'Snapshot Backup Sekarang'}</span>
          </button>
        </div>
      </div>

      {/* ─── Metric Cards Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Engine &amp; Latency</span>
            <Database size={16} className="text-slate-700" />
          </div>
          <div className="text-xl font-black text-slate-950 font-mono">{dbInfo.engine || 'PostgreSQL'}</div>
          <div className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1 font-bold">
            <CheckCircle2 size={12} /> {dbInfo.latencyMs ?? 12} ms latency
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Jadwal Backup Otonom</span>
            <Calendar size={16} className="text-indigo-600" />
          </div>
          <div className="text-xl font-black text-slate-950 font-mono">03:00 WIB</div>
          <div className="text-[11px] text-indigo-700 mt-1 flex items-center gap-1 font-bold">
            <Clock size={12} /> {cronStatus?.currentWibTime || '24h Daily Automated'}
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Kebijakan Retensi GFS</span>
            <Archive size={16} className="text-emerald-600" />
          </div>
          <div className="text-xl font-black text-slate-950 font-mono">7D / 4W / 3M</div>
          <div className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1 font-bold">
            <ShieldCheck size={12} /> Anti-Disk Exhaustion
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Target Recovery SLA</span>
            <Zap size={16} className="text-amber-600" />
          </div>
          <div className="text-xl font-black text-slate-950 font-mono">RTO &lt; 10 Menit</div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">RPO &lt; 1 Jam (Deterministic)</div>
        </div>
      </div>

      {/* ─── Disaster Recovery Backup Repository ──────────────────────────── */}
      <div className="bg-white border border-slate-200/90 p-6 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-950 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600" /> Repositori Snapshot Berkas Cadangan ({backups.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Snapshot terenkripsi AES-256-CBC, kompresi Gzip, dan tanda tangan HMAC-SHA256 untuk pemulihan bencana instan.
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono font-bold bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
            Total Berkas: {backups.length}
          </span>
        </div>

        {backups.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
            Belum ada berkas backup yang tersimpan di disk server. Klik <strong>"Snapshot Backup Sekarang"</strong> di atas untuk membuat cadangan pertama.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] text-slate-500 font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Nama Berkas</th>
                  <th className="py-3 px-3">Tier GFS</th>
                  <th className="py-3 px-3">Lingkup</th>
                  <th className="py-3 px-3">Ukuran</th>
                  <th className="py-3 px-3">Enkripsi</th>
                  <th className="py-3 px-3">Integritas</th>
                  <th className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {backups.map((b, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 truncate max-w-[240px]">
                      {b.filename}
                      <div className="text-[10px] text-slate-400 font-normal font-sans">
                        {new Date(b.createdAt).toLocaleString('id-ID')}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        b.gfsTier === 'SON_DAILY' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        b.gfsTier === 'FATHER_WEEKLY' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                        b.gfsTier === 'GRANDFATHER_MONTHLY' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                        'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {b.gfsTier || 'DAILY'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-bold">
                        {b.scope}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      {b.sizeFormatted}
                    </td>
                    <td className="py-3 px-3">
                      <span className="flex items-center gap-1 text-[11px] text-slate-800 font-bold">
                        <Lock size={12} className="text-emerald-600" />
                        {b.isEncrypted ? 'AES-256' : 'Plain'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {b.isValid ? (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                          <CheckCircle2 size={13} /> Valid
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-amber-700 font-bold">
                          <AlertTriangle size={13} /> Perlu Verifikasi
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleVerifyIntegrity(b.filename)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-200 cursor-pointer"
                          title="Verifikasi HMAC Checksum"
                        >
                          Verifikasi
                        </button>
                        <button
                          onClick={() => handleDownloadBackup(b.filename)}
                          disabled={downloading}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-200 cursor-pointer flex items-center gap-1"
                          title="Unduh Berkas Aman"
                        >
                          <Download size={11} /> Unduh
                        </button>
                        <button
                          onClick={() => handleRestoreBackup(b.filename)}
                          disabled={backupActionLoading}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold border border-rose-200 cursor-pointer flex items-center gap-1"
                          title="Disaster Recovery Restore"
                        >
                          <RotateCcw size={11} /> Restore
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Table Sizing & Distribution ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200/90 p-6 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-extrabold text-slate-950 uppercase tracking-wider flex items-center gap-2">
              <HardDrive size={16} className="text-slate-700" /> Distribusi Baris Data per Entitas Bisnis
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Volume baris data dari seluruh tenant yang tersimpan di database
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono font-medium">Prisma Multi-Tenant Extension</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tableList.map((tbl, idx) => {
            const count = Number(tbl.count) || 0;
            const pct = Math.min(100, Math.max(6, (count / maxCount) * 100));

            return (
              <div key={idx} className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
                <div className="flex justify-between items-center text-xs mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-900 font-bold">{tbl.name}</span>
                  </div>
                  <span className="font-mono font-extrabold text-slate-950">
                    {count.toLocaleString('id-ID')} rows
                  </span>
                </div>
                <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden mb-1">
                  <div 
                    className="bg-slate-900 h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500 font-medium">{tbl.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Disaster Recovery Procedures Alert ───────────────────────────── */}
      <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex items-start gap-4 text-xs text-slate-600 shadow-2xs">
        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 mt-0.5">
          <FileCode size={18} />
        </div>
        <div>
          <div className="font-bold text-slate-950 mb-0.5">Prosedur Disaster Recovery CLI (RPO &lt; 1 Jam, RTO &lt; 10 Menit)</div>
          <p className="leading-relaxed text-slate-600">
            Untuk memulihkan sistem secara instan dari CLI VPS jika terjadi crash database total:
            <code className="block mt-2 p-2.5 rounded-xl bg-white text-slate-900 font-mono text-[11px] border border-slate-200 shadow-2xs">
              npx ts-node src/scripts/restore_database.ts --file=&lt;nama-file-backup.json.gz.enc&gt;
            </code>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SaaSDatabaseOpsAdmin;
