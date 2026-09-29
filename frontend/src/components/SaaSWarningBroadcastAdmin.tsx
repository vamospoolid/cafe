import React, { useState, useEffect, useContext } from 'react';
import { 
  AlertTriangle, 
  Send, 
  Radio, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Info, 
  AlertOctagon, 
  Building2, 
  RefreshCw,
  Eye,
  Megaphone,
  Bell
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast, confirmAlert } from '../utils/alert';

interface BroadcastItem {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'DANGER';
  targetTenantId?: string | null;
  targetTenantName?: string | null;
  isActive: boolean;
  createdAt: string;
}

export const SaaSWarningBroadcastAdmin: React.FC = () => {
  const posContext = useContext(POSContext);
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'INFO' | 'WARNING' | 'DANGER'>('WARNING');
  const [targetTenantId, setTargetTenantId] = useState<string>('GLOBAL');

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${posContext?.token}` };
      const [bRes, tRes] = await Promise.all([
        fetch('/api/platform-admin/broadcasts', { headers }),
        fetch('/api/platform-admin/tenants', { headers })
      ]);

      if (bRes.ok) {
        const data = await bRes.json();
        setBroadcasts(data.broadcasts || []);
      }
      if (tRes.ok) {
        const data = await tRes.json();
        setTenants(data.tenants || []);
      }
    } catch (err) {
      console.error('Failed to load broadcasts:', err);
      toast('Gagal memuat data broadcast', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [posContext?.token]);

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      return toast('Judul dan pesan siaran wajib diisi', 'error');
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/platform-admin/broadcasts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${posContext?.token}`
        },
        body: JSON.stringify({
          title,
          message,
          type,
          targetTenantId: targetTenantId === 'GLOBAL' ? null : targetTenantId
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast('✅ Siaran pengumuman berhasil dipublikasikan ke POS & Dashboard tenant!', 'success');
        setTitle('');
        setMessage('');
        setType('WARNING');
        setTargetTenantId('GLOBAL');
        fetchData();
      } else {
        toast(data.error || 'Gagal membuat siaran', 'error');
      }
    } catch (err) {
      toast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    const confirmed = await confirmAlert(
      'Hapus Siaran Pengumuman?',
      'Banner ini akan langsung dicabut dari layar POS dan Dashboard seluruh tenant.'
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/platform-admin/broadcasts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${posContext?.token}` }
      });
      if (res.ok) {
        toast('Siaran berhasil dihapus', 'success');
        fetchData();
      } else {
        toast('Gagal menghapus siaran', 'error');
      }
    } catch (err) {
      toast('Terjadi kesalahan', 'error');
    }
  };

  const getTypeStyle = (bType: string) => {
    switch (bType) {
      case 'DANGER':
        return {
          badge: 'bg-rose-50 text-rose-700 border-rose-200',
          card: 'border-rose-200 bg-rose-50/50',
          icon: AlertOctagon,
          iconColor: 'text-rose-600 bg-rose-100',
          textColor: 'text-rose-950'
        };
      case 'WARNING':
        return {
          badge: 'bg-amber-50 text-amber-800 border-amber-200',
          card: 'border-amber-200 bg-amber-50/50',
          icon: AlertTriangle,
          iconColor: 'text-amber-600 bg-amber-100',
          textColor: 'text-amber-950'
        };
      default:
        return {
          badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          card: 'border-indigo-200 bg-indigo-50/50',
          icon: Info,
          iconColor: 'text-indigo-600 bg-indigo-100',
          textColor: 'text-indigo-950'
        };
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/90 p-6 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-[10px] font-bold tracking-widest uppercase border border-slate-200">
              System Broadcast
            </span>
            <span className="flex items-center gap-1 text-slate-500 text-xs font-semibold">
              <Megaphone size={13} className="text-amber-500" />
              Live Emergency &amp; Maintenance Push
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-950 mt-1">
            System Warning &amp; Tenant Broadcast Engine
          </h2>
          <p className="text-xs text-slate-500 max-w-xl mt-1 font-medium">
            Kirimkan notifikasi banner langsung ke layar kasir POS dan Dashboard seluruh tenant (atau tenant spesifik) secara instan.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer border border-slate-200 shadow-2xs"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Form Buat Broadcast Baru ───────────────────────────────────── */}
        <div className="lg:col-span-1 bg-white border border-slate-200/90 p-6 rounded-2xl space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex items-center gap-2 font-black text-slate-950 text-sm">
            <Send size={16} className="text-slate-700" />
            <span>Buat Siaran Baru</span>
          </div>

          <form onSubmit={handleCreateBroadcast} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-600 font-bold mb-1.5">Tipe Peringatan</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'INFO', label: 'Info / Update', active: 'border-slate-900 bg-slate-900 text-white shadow-2xs' },
                  { id: 'WARNING', label: 'Warning / Dunning', active: 'border-amber-400 bg-amber-50 text-amber-800 shadow-2xs' },
                  { id: 'DANGER', label: 'Urgent / Maint.', active: 'border-rose-400 bg-rose-50 text-rose-700 shadow-2xs' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setType(item.id as any)}
                    className={`p-2.5 rounded-xl font-bold border transition-all text-center cursor-pointer text-[11px] ${
                      type === item.id
                        ? item.active
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1.5">Target Penerima</label>
              <select
                value={targetTenantId}
                onChange={(e) => setTargetTenantId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white font-medium shadow-2xs"
              >
                <option value="GLOBAL">🌐 Seluruh Tenant (Global Broadcast)</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    🏢 {t.name} ({t.slug})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1.5">Judul Pengumuman</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Pemeliharaan Server Malam Ini (01:00 WIB)"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-slate-400 focus:bg-white shadow-2xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1.5">Isi Pesan Detail</label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tuliskan rincian instruksi atau pemberitahuan untuk kasir / owner tenant..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-slate-400 focus:bg-white shadow-2xs font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-xs active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Radio size={14} className={submitting ? 'animate-pulse' : ''} />
              <span>{submitting ? 'Memproses Siaran...' : 'Publikasikan Siaran'}</span>
            </button>
          </form>
        </div>

        {/* ─── Daftar Siaran Aktif ────────────────────────────────────────── */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 p-6 rounded-2xl space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-slate-950 text-sm">
              <Bell size={16} className="text-amber-500" />
              <span>Daftar Siaran Aktif ({broadcasts.length})</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono font-semibold">Live on POS Screens</span>
          </div>

          {broadcasts.length === 0 ? (
            <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <Radio size={32} className="mx-auto mb-2 opacity-30 text-slate-500" />
              <p className="text-xs font-bold text-slate-600">Tidak ada siaran aktif saat ini</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Siaran baru yang dibuat akan langsung tampil sebagai banner di seluruh aplikasi kasir tenant.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {broadcasts.map((b) => {
                const style = getTypeStyle(b.type);
                const Icon = style.icon;

                return (
                  <div
                    key={b.id}
                    className={`p-4 rounded-2xl border transition-all ${style.card}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`p-2 rounded-xl shrink-0 ${style.iconColor}`}>
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${style.badge}`}>
                              {b.type}
                            </span>
                            <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                              <Building2 size={11} /> {b.targetTenantName || 'Global (Semua Tenant)'}
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                              <Clock size={11} /> {new Date(b.createdAt).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <h4 className={`text-sm font-extrabold ${style.textColor}`}>{b.title}</h4>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-line font-medium">
                            {b.message}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteBroadcast(b.id)}
                        className="p-2 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors shrink-0 cursor-pointer border border-slate-200 shadow-xs"
                        title="Hapus / Cabut Siaran"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SaaSWarningBroadcastAdmin;
