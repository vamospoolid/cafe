import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  Sparkles,
  RefreshCw,
  Database,
  Trash2,
  ShieldAlert
} from 'lucide-react';
import { toast, confirmAlert } from '../../utils/alert';
import TenantResetModal from '../TenantResetModal';
import RecycleBinModal from '../RecycleBinModal';

interface DatabaseSettingsPanelProps {
  token: string | null | undefined;
}

export const SettingsDatabaseBackup: React.FC<DatabaseSettingsPanelProps> = ({ token }) => {
  const [backingUp, setBackingUp] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [healthData, setHealthData] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(true);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);

  const fetchHealthAndBackups = async () => {
    setLoadingHealth(true);
    try {
      // 1. Fetch deep health
      const healthRes = await fetch('/api/health/deep');
      if (healthRes.ok) {
        const hData = await healthRes.json();
        setHealthData(hData);
      }

      // 2. Fetch backups
      if (token) {
        const backupRes = await fetch('/api/health/backups', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (backupRes.ok) {
          const bData = await backupRes.json();
          setBackups(bData.backups || []);
        }
      }
    } catch (e) {
      console.error('Error fetching observability telemetry:', e);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealthAndBackups();
    const interval = setInterval(fetchHealthAndBackups, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, [token]);

  const handleCreateEncryptedBackup = async () => {
    if (!token) return;
    setBackingUp(true);
    try {
      const response = await fetch('/api/health/backups/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isEncrypted, compress: true, type: 'json' })
      });

      const data = await response.json();
      if (response.ok) {
        toast(`Backup ${data.backup?.fileName} berhasil dibuat!`, 'success');
        fetchHealthAndBackups();
      } else {
        toast(data.error || 'Gagal membuat backup', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Terjadi kesalahan saat membuat backup', 'error');
    } finally {
      setBackingUp(false);
    }
  };

  const handlePurgeOldBackups = async () => {
    const result = await confirmAlert(
      'Pangkas Backup Usang?',
      'Apakah Anda yakin ingin menghapus seluruh berkas backup yang berumur lebih dari 30 hari? Tindakan ini tidak dapat dibatalkan.'
    );
    if (!result.isConfirmed || !token) return;

    try {
      const res = await fetch('/api/health/backups/purge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ retentionDays: 30 })
      });
      const data = await res.json();
      if (res.ok) {
        toast(`Pembersihan selesai: ${data.result?.deletedCount || 0} berkas lama dihapus.`, 'success');
        fetchHealthAndBackups();
      } else {
        toast(data.error || 'Gagal memangkas backup lama', 'error');
      }
    } catch (e: any) {
      toast(e.message || 'Terjadi kesalahan saat memangkas backup', 'error');
    }
  };

  const handleDownloadLegacyBackup = async () => {
    if (!token) return;
    setBackingUp(true);
    try {
      const response = await fetch('/api/database/backup', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Gagal mengunduh backup');
      
      let filename = `backup-codepos-${new Date().toISOString().slice(0,10)}.json`;
      const disposition = response.headers.get('content-disposition');
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast(`Berkas backup (${filename}) berhasil diunduh!`, 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal mengunduh backup', 'error');
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestart = async () => {
    const result = await confirmAlert(
      'Restart Server POS SaaS?',
      'Apakah Anda yakin ingin melakukan restart pada server POS? Koneksi akan terputus sementara selama beberapa detik.'
    );
    if (!result.isConfirmed) return;

    setRestarting(true);
    try {
      const response = await fetch('/api/database/restart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        toast(data.message || 'Server sedang merestart...', 'success');
        setTimeout(() => window.location.reload(), 5000);
      } else {
        toast(data.error || 'Gagal merestart server', 'error');
      }
    } catch {
      toast('Perintah restart berhasil dikirim. Halaman akan dimuat ulang...', 'success');
      setTimeout(() => window.location.reload(), 5000);
    } finally {
      setRestarting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header Status Observability & Telemetry ── */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-500/20 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className={`w-3.5 h-3.5 rounded-full animate-pulse ${healthData?.status === 'healthy' ? 'bg-emerald-400 ring-4 ring-emerald-500/20' : 'bg-amber-400 ring-4 ring-amber-500/20'}`} />
              <h4 className="text-lg font-black tracking-tight">System Health & Telemetry Live</h4>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-indigo-200 border border-white/10">
                {healthData?.status || 'HEALTHY'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Engine: <strong className="text-white">{healthData?.database?.engine || 'PostgreSQL'}</strong> • Uptime: <strong className="text-white">{healthData?.server?.uptimeSeconds ? `${Math.floor(healthData.server.uptimeSeconds / 60)} menit` : '-'}</strong> • Latensi DB: <strong className="text-emerald-300">{healthData?.database?.latencyMs ?? 0} ms</strong>
            </p>
          </div>
          <button
            onClick={fetchHealthAndBackups}
            disabled={loadingHealth}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all border border-white/10 shrink-0 self-start sm:self-auto"
          >
            <RefreshCw size={13} className={loadingHealth ? 'animate-spin' : ''} />
            Refresh Metrik
          </button>
        </div>

        {/* Telemetry Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 relative z-10">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400">Database Latency</div>
            <div className="text-base font-black text-emerald-400 mt-0.5">{healthData?.database?.latencyMs ?? 0} ms</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400">PostgreSQL RLS</div>
            <div className="text-base font-black text-indigo-300 mt-0.5">{healthData?.database?.rlsEnforced ? '🛡️ Aktif' : 'Non-RLS'}</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400">RAM Heap Node</div>
            <div className="text-base font-black text-amber-300 mt-0.5">{healthData?.memory?.heapUsedMb ?? 0} MB</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400">Total Tenants</div>
            <div className="text-base font-black text-white mt-0.5">{healthData?.database?.telemetry?.tenants ?? 1} Bisnis</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400">Socket.IO Clients</div>
            <div className="text-base font-black text-cyan-300 mt-0.5">{healthData?.realtime?.activeSocketClients ?? 0} Online</div>
          </div>
        </div>
      </div>

      {/* ── Action Cards: Backup & Disaster Recovery ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Automated Encrypted Backup Engine */}
        <div className="p-6 rounded-3xl border border-slate-200 bg-white hover:border-slate-300 shadow-sm transition-all space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-bold text-sm text-slate-800 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <UploadCloud size={18} />
              </div>
              <div>
                <div>Buat Backup Terenkripsi</div>
                <div className="text-[11px] font-normal text-slate-400">AES-256 + Gzip + SHA-256 Checksum</div>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600">
              <input 
                type="checkbox" 
                checked={isEncrypted} 
                onChange={(e) => setIsEncrypted(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" 
              />
              <span>Enkripsi AES-256</span>
            </label>
          </div>
          
          <p className="text-xs text-slate-500 leading-relaxed">
            Menghasilkan snapshot database terstruktur yang dipaket dengan kompresi Gzip dan dienkripsi AES-256-CBC. Disimpan secara aman di server untuk Disaster Recovery.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreateEncryptedBackup}
              disabled={backingUp}
              className="btn btn-primary bg-indigo-600 border-indigo-600 text-xs font-bold py-2.5 px-4 flex-1 flex items-center justify-center gap-2 rounded-xl"
            >
              <UploadCloud size={14} />
              {backingUp ? 'Memproses...' : 'Buat Snapshot Baru'}
            </button>
            <button
              type="button"
              onClick={handleDownloadLegacyBackup}
              disabled={backingUp}
              title="Unduh file JSON langsung ke perangkat ini"
              className="btn btn-outline text-xs font-bold py-2.5 px-4 flex items-center justify-center gap-2 rounded-xl border border-slate-200 hover:bg-slate-50"
            >
              Unduh Langsung
            </button>
          </div>
        </div>

        {/* Card 2: Server Maintenance & Retention Purge */}
        <div className="p-6 rounded-3xl border border-slate-200 bg-white hover:border-slate-300 shadow-sm transition-all space-y-4">
          <div className="font-bold text-sm text-slate-800 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Sparkles size={18} />
            </div>
            <div>
              <div>Pemeliharaan & Retensi 30 Hari</div>
              <div className="text-[11px] font-normal text-slate-400">Pangkas file usang & restart layanan</div>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Menghapus berkas snapshot backup yang berumur lebih dari 30 hari untuk menjaga kapasitas SSD VPS tetap efisien, serta opsi restart background PM2 process.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePurgeOldBackups}
              className="btn btn-outline text-xs font-bold py-2.5 px-4 flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200"
            >
              Pangkas Backup &gt; 30 Hari
            </button>
            <button
              type="button"
              onClick={handleRestart}
              disabled={restarting}
              className="btn btn-danger text-xs font-bold py-2.5 px-4 flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              <RefreshCw size={13} className={restarting ? 'animate-spin' : ''} />
              {restarting ? 'Merestart...' : 'Restart Server'}
            </button>
          </div>
        </div>

        {/* Card 3: Keranjang Sampah Sementara (Recycle Bin / 30-Day Soft Delete) */}
        <div className="p-6 rounded-3xl border border-amber-200/90 dark:border-amber-800/60 bg-gradient-to-br from-amber-50/50 via-white to-orange-50/30 dark:from-slate-800 dark:to-amber-950/30 hover:border-amber-400 shadow-sm transition-all space-y-4 md:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
                <Trash2 size={24} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Keranjang Sampah Toko (Recycle Bin)</h4>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    Retensi 30 Hari
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Pulihkan menu produk, bahan baku, kategori, meja, pelanggan, atau supplier yang tidak sengaja terhapus. Item disimpan aman selama 30 hari sebelum dibersihkan permanen.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsRecycleBinOpen(true)}
              className="btn btn-primary bg-amber-600 hover:bg-amber-700 border-amber-600 text-xs font-bold py-3 px-5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 shrink-0 self-start sm:self-auto text-white"
            >
              <Trash2 size={16} />
              <span>Buka Keranjang Sampah</span>
            </button>
          </div>
        </div>

        {/* Card 4: Tenant Reset & Starter Templates Gate (Multi-Layer Protected) */}
        <div className="p-6 rounded-3xl border border-indigo-200/90 dark:border-indigo-800/60 bg-gradient-to-br from-indigo-50/60 via-white to-amber-50/30 dark:from-slate-800 dark:to-indigo-950/40 hover:border-indigo-400 shadow-sm transition-all space-y-4 md:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
                <ShieldAlert size={24} className="text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Pusat Reset Data & Starter Templates Usaha</h4>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                    Multi-Tenant Safe
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Pasang template menu & bahan baku industri (Coffee Shop, Restoran F&B, Bakery) atau bersihkan transaksi simulasi sebelum Grand Opening dengan proteksi kata sandi ganda.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              className="btn btn-primary bg-indigo-600 hover:bg-indigo-700 border-indigo-600 text-xs font-bold py-3 px-5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 shrink-0 self-start sm:self-auto"
            >
              <Sparkles size={16} className="text-amber-300" />
              <span>Buka Menu Reset & Template</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recycle Bin Modal */}
      <RecycleBinModal
        isOpen={isRecycleBinOpen}
        onClose={() => setIsRecycleBinOpen(false)}
        onItemRestored={() => fetchHealthAndBackups()}
      />

      {/* Tenant Reset Modal */}
      <TenantResetModal 
        isOpen={isResetModalOpen} 
        onClose={() => setIsResetModalOpen(false)} 
        onSuccess={() => fetchHealthAndBackups()}
      />

      {/* ── Table of Stored Backups ── */}
      <div className="p-6 rounded-3xl border border-slate-200 bg-white shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <Database size={16} className="text-indigo-600" />
            <span>Daftar Snapshot Backup di Server ({backups.length})</span>
          </h4>
        </div>

        {backups.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            Belum ada berkas backup yang tersimpan di server. Klik "Buat Snapshot Baru" di atas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase font-black tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Nama Berkas</th>
                  <th className="py-2.5 px-3">Cakupan (Scope)</th>
                  <th className="py-2.5 px-3">Ukuran</th>
                  <th className="py-2.5 px-3">Keamanan</th>
                  <th className="py-2.5 px-3">Waktu Dibuat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.map((b, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-700">{b.fileName}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-600">
                        {b.scope}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-semibold">{(b.sizeBytes / 1024).toFixed(1)} KB</td>
                    <td className="py-3 px-3">
                      {b.isEncrypted ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                          🔒 AES-256
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">Plain</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-400">{new Date(b.createdAt).toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsDatabaseBackup;
