import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Copy, 
  Check, 
  Send, 
  HardDrive, 
  ShieldCheck, 
  RefreshCw, 
  Download, 
  Activity, 
  Clock, 
  DollarSign, 
  Laptop,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface OfflineClient {
  hardwareId: string;
  vertical: string;
  version: string;
  totalRevenue: number;
  totalOrders: number;
  lastTransactionAt: string | null;
  lastHeartbeatAt: string;
  hasBackupSnapshot: boolean;
  ipAddress?: string;
  description?: string;
}

export const OfflineClientsAdminView: React.FC = () => {
  // State Generator Lisensi
  const [hardwareId, setHardwareId] = useState('');
  const [vertical, setVertical] = useState<'BENGKEL' | 'KAFE' | 'RETAIL' | 'LAUNDRY' | 'RENTAL'>('BENGKEL');
  const [tier, setTier] = useState<'PRO' | 'ENTERPRISE'>('PRO');
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLicense, setGeneratedLicense] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // State Tabel Telemetri Klien
  const [clients, setClients] = useState<OfflineClient[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch daftar klien offline saat pertama dimuat
  const fetchOfflineClients = async () => {
    setIsLoadingClients(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('pos_token') || '';
      const res = await fetch('/api/sync/clients', {
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setClients(data.clients || []);
      }
    } catch (err: any) {
      console.warn('Gagal memuat telemetri klien:', err.message);
      // Fallback data demo jika belum ada heartbeat di audit log
      setClients([]);
    } finally {
      setIsLoadingClients(false);
    }
  };

  useEffect(() => {
    fetchOfflineClients();
  }, []);

  // Handler Generate Lisensi
  const handleGenerateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hardwareId.trim()) {
      setErrorMsg('Hardware ID wajib diisi!');
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('pos_token') || '';
      const res = await fetch('/api/sync/generate-license', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          hardwareId: hardwareId.trim().toUpperCase(),
          vertical,
          tier,
          storeName: storeName.trim() || undefined,
          ownerName: ownerName.trim() || undefined
        })
      });

      const data = await res.json();

      if (res.ok && data.success && data.licenseKey) {
        setGeneratedLicense(data.licenseKey);
        setSuccessMsg(`Serial lisensi untuk "${storeName || hardwareId}" berhasil diterbitkan!`);
      } else {
        setErrorMsg(data.error || 'Gagal menerbitkan lisensi.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Koneksi ke server gagal.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLicense = () => {
    if (!generatedLicense) return;
    navigator.clipboard.writeText(generatedLicense);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    if (!generatedLicense) return;
    const cleanPhone = clientPhone.replace(/[^0-9]/g, '');
    const phone = cleanPhone.startsWith('0') ? '62' + cleanPhone.substring(1) : cleanPhone;
    
    const text = encodeURIComponent(
      `Halo Kak ${ownerName || 'Pemilik Usaha'},\n\n` +
      `Berikut adalah Kunci Lisensi Resmi CodePOS (${vertical}) untuk toko *${storeName || 'Usaha Anda'}*:\n\n` +
      `🔑 *Hardware ID:* ${hardwareId.trim().toUpperCase()}\n` +
      `📦 *Serial Lisensi:* \`${generatedLicense}\`\n\n` +
      `*Cara Aktivasi:*\n` +
      `1. Buka aplikasi CodePOS di laptop/PC Anda.\n` +
      `2. Klik "Aktivasi Lisensi" di pojok kanan atas.\n` +
      `3. Tempelkan serial lisensi di atas dan klik "Aktivasi Sekarang".\n\n` +
      `Terima kasih telah mempercayakan CodePOS!`
    );

    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const handleDownloadBackup = async (hwId: string) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('pos_token') || '';
      const res = await fetch(`/api/sync/download-backup/${hwId}`, {
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Snapshot metadata pemulihan untuk HWID ${hwId} berhasil diambil:\n` + JSON.stringify(data.metrics, null, 2));
      } else {
        alert(`Gagal mengambil data pemulihan: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Gagal mengambil data pemulihan: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Header Section ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5 text-violet-700 font-black text-sm uppercase tracking-wider mb-1">
            <HardDrive size={20} />
            <span>Control Plane Klien Beli-Putus</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Lisensi Hardware & Telemetri Klien Offline
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Terbitkan serial lisensi kriptografis anti-pirasi dan pantau cadangan snapshot database dari klien beli-putus.
          </p>
        </div>

        <button
          onClick={fetchOfflineClients}
          disabled={isLoadingClients}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all active:scale-95 border border-slate-200 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={15} className={isLoadingClients ? 'animate-spin' : ''} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Notifikasi Sukses / Error */}
      {successMsg && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold animate-in fade-in">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ─── 1. Generator Lisensi Kriptografis ─── */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4 border-b pb-3 border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
            <Key size={18} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900">Penerbitan Serial Lisensi Beli-Putus (HMAC-SHA256)</h2>
            <p className="text-[11px] text-slate-500">Kunci lisensi terikat secara matematis ke motherboard & CPU klien.</p>
          </div>
        </div>

        <form onSubmit={handleGenerateLicense} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Hardware ID Klien *</label>
            <input
              type="text"
              placeholder="Contoh: BK-8821-F904-77A1"
              value={hardwareId}
              onChange={(e) => setHardwareId(e.target.value.toUpperCase())}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xs font-bold tracking-wide focus:border-violet-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Vertikal Aplikasi *</label>
            <select
              value={vertical}
              onChange={(e) => setVertical(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:border-violet-600 focus:outline-none bg-white"
            >
              <option value="BENGKEL">Bengkel Motor & Mobil (BK)</option>
              <option value="KAFE">Resto, Cafe & F&B (CF)</option>
              <option value="RETAIL">Toko Retail & Bangunan (RT)</option>
              <option value="LAUNDRY">Laundry Kiloan & Satuan (LD)</option>
              <option value="RENTAL">Rental & Sewa Kendaraan (RN)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Tier Lisensi</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:border-violet-600 focus:outline-none bg-white"
            >
              <option value="PRO">PRO (Beli-Putus Lifetime - 1 Cabang)</option>
              <option value="ENTERPRISE">ENTERPRISE (Beli-Putus Full Unlocked)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Toko / Usaha</label>
            <input
              type="text"
              placeholder="Contoh: Bengkel Maju Jaya"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-violet-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Pemilik (Owner)</label>
            <input
              type="text"
              placeholder="Contoh: Bpk. Bambang"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-violet-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">No. WhatsApp Klien (Opsional)</label>
            <input
              type="text"
              placeholder="Contoh: 081234567890"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-violet-600 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3 flex justify-end pt-2">
            <button
              type="submit"
              disabled={isGenerating}
              className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Key size={16} />
              <span>{isGenerating ? 'Memproses Kriptografi...' : 'Terbitkan Serial Lisensi'}</span>
            </button>
          </div>
        </form>

        {/* Kotak Hasil Serial Key yang Terbit */}
        {generatedLicense && (
          <div className="mt-6 p-4 rounded-xl bg-violet-50/80 border-2 border-violet-200 animate-in fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black text-violet-800 uppercase tracking-wider">
                ✨ Serial Activation Key Resmi Klien:
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-200 text-violet-900">
                {tier} LIFETIME
              </span>
            </div>

            <div className="p-3 bg-white rounded-lg border border-violet-200 font-mono text-xs text-slate-800 break-all select-all font-bold">
              {generatedLicense}
            </div>

            <div className="flex flex-wrap gap-2.5 mt-3 justify-end">
              <button
                type="button"
                onClick={handleCopyLicense}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copied ? 'Tersalin!' : 'Salin Serial'}</span>
              </button>

              {clientPhone && (
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <Send size={14} />
                  <span>Kirim ke WhatsApp Klien</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── 2. Tabel Telemetri Heartbeat & Disaster Recovery ─── */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b pb-3 border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Activity size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">Telemetri Heartbeat & Cadangan Bencana Klien</h2>
              <p className="text-[11px] text-slate-500">Memonitor riwayat sync saat kasir tethering HP dan status snapshot database.</p>
            </div>
          </div>

          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full self-start">
            Total Klien Terdaftar: {clients.length}
          </span>
        </div>

        {clients.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Laptop size={44} className="mx-auto mb-3 text-slate-300" />
            <p className="text-xs font-bold text-slate-600">Belum ada telemetri heartbeat dari komputer kasir offline.</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
              Saat laptop kasir terhubung ke internet (tethering HP 1–2 menit), metrik transaksi dan cadangan database akan otomatis terdaftar di sini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Hardware ID</th>
                  <th className="py-3 px-3">Vertikal</th>
                  <th className="py-3 px-3">Versi</th>
                  <th className="py-3 px-3 text-right">Total Omset</th>
                  <th className="py-3 px-3 text-center">Transaksi</th>
                  <th className="py-3 px-3">Heartbeat Terakhir</th>
                  <th className="py-3 px-3 text-center">Aksi Pemulihan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {clients.map((c) => (
                  <tr key={c.hardwareId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      {c.hardwareId}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-700">
                        {c.vertical}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px]">
                      v{c.version}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-700 font-mono">
                      Rp {c.totalRevenue.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-3 text-center font-bold">
                      {c.totalOrders}
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[11px]">
                      {new Date(c.lastHeartbeatAt).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => handleDownloadBackup(c.hardwareId)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold border border-indigo-200 transition-all active:scale-95 cursor-pointer"
                        title="Unduh Snapshot Cadangan Darurat"
                      >
                        <Download size={13} />
                        <span>Unduh Backup</span>
                      </button>
                    </td>
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

export default OfflineClientsAdminView;
