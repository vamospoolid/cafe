import React, { useState, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  X,
  QrCode,
  Bike,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  Upload,
  Zap,
  ShieldCheck,
  Plus,
  Trash2,
  Save,
  RefreshCw
} from 'lucide-react';
import { toast } from '../../utils/alert';

interface DeliveryZone {
  id: string;
  name: string;
  pickupFee: number;
  deliveryFee: number;
  description: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

export default function LaundryPortalQrisModal({ isOpen, onClose, token }: Props) {
  const [activeTab, setActiveTab] = useState<'PORTAL' | 'QRIS' | 'ZONES'>('QRIS');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tenantSlug, setTenantSlug] = useState('demo');
  const [tenantName, setTenantName] = useState('Laundry Outlet');
  const [qrisStaticPayload, setQrisStaticPayload] = useState('');
  const [hasCustomQris, setHasCustomQris] = useState(false);
  const [qrisWebhookSecret, setQrisWebhookSecret] = useState('');
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);

  const [copiedPortal, setCopiedPortal] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Simulator State
  const [simAmount, setSimAmount] = useState<string>('35017');
  const [simBankApp, setSimBankApp] = useState<string>('GoPay Merchant');
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  const fetchSettings = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/laundry/portal-settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (res.ok) {
        setTenantSlug(json.tenantSlug || 'demo');
        setTenantName(json.tenantName || 'Laundry Outlet');
        setQrisStaticPayload(json.qrisStaticPayload || '');
        setHasCustomQris(Boolean(json.hasCustomQris));
        setQrisWebhookSecret(json.qrisWebhookSecret || '');
        if (Array.isArray(json.deliveryZones)) {
          setDeliveryZones(json.deliveryZones);
        }
      }
    } catch (err) {
      console.error('Failed to load portal settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const portalUrl = `${window.location.origin}/laundry-portal/${tenantSlug}`;
  const webhookUrl = `${window.location.origin}/api/laundry/qris-auto-webhook?token=${qrisWebhookSecret}`;

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/laundry/portal-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          qrisStaticPayload: qrisStaticPayload.trim(),
          deliveryZones
        })
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal menyimpan pengaturan');
      }
      setHasCustomQris(Boolean(json.hasCustomQris));
      setQrisWebhookSecret(json.qrisWebhookSecret || qrisWebhookSecret);
      toast('Pengaturan QRIS Dinamis & Zona Antar-Jemput disimpan!', 'success');
    } catch (err: any) {
      toast(err.message || 'Gagal menyimpan pengaturan', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Decode Static QRIS Image uploaded by Merchant
  const handleDecodeQrisImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const tempDivId = 'qris-static-file-decoder';
      let tempDiv = document.getElementById(tempDivId);
      if (!tempDiv) {
        tempDiv = document.createElement('div');
        tempDiv.id = tempDivId;
        tempDiv.style.display = 'none';
        document.body.appendChild(tempDiv);
      }
      const html5QrCode = new Html5Qrcode(tempDivId);
      const decodedText = await html5QrCode.scanFile(file, false);
      html5QrCode.clear();

      if (decodedText && decodedText.trim().startsWith('000201')) {
        setQrisStaticPayload(decodedText.trim());
        toast('Berhasil membaca kode EMVCo dari gambar QRIS toko Anda!', 'success');
      } else {
        toast('Gambar QR terbaca, namun bukan format EMVCo QRIS standar (000201...).', 'warning');
      }
    } catch (err) {
      toast('Gagal mendeteksi QR dari gambar. Pastikan gambar QRIS jelas dan tidak terpotong.', 'error');
    }
  };

  const handleRunSimulator = async () => {
    const cleanNominal = parseInt(String(simAmount).replace(/[^0-9]/g, ''), 10) || 0;
    if (cleanNominal < 100) {
      toast('Masukkan nominal simulasi minimal Rp 100', 'warning');
      return;
    }
    setSimLoading(true);
    setSimResult(null);
    try {
      const formattedRp = cleanNominal.toLocaleString('id-ID');
      const sampleNotification = `${simBankApp}: Pembayaran QRIS sebesar Rp ${formattedRp} berhasil diterima di ${tenantName}`;

      const res = await fetch(`/api/laundry/qris-auto-webhook?token=${encodeURIComponent(qrisWebhookSecret)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: simBankApp,
          text: sampleNotification,
          packageName: simBankApp.toLowerCase().replace(/\s+/g, '.')
        })
      });
      const json = await res.json();
      setSimResult({ ...json, sampleNotification });
      if (json.matched) {
        toast(json.message || 'Auto-Settlement Berhasil!', 'success');
      } else {
        toast(json.reason || 'Simulasi terkirim (belum ada nota dengan nominal tersebut)', 'info');
      }
    } catch (err: any) {
      toast('Gagal menjalankan simulasi webhook', 'error');
    } finally {
      setSimLoading(false);
    }
  };

  const handleAddZone = () => {
    setDeliveryZones(prev => [
      ...prev,
      {
        id: `zone-${Date.now()}`,
        name: `Zona ${prev.length + 1}`,
        pickupFee: 5000,
        deliveryFee: 5000,
        description: 'Tarif jemput & antar kurir outlet'
      }
    ]);
  };

  const handleRemoveZone = (id: string) => {
    if (deliveryZones.length <= 1) {
      toast('Minimal harus ada 1 zona tarif antar-jemput.', 'warning');
      return;
    }
    setDeliveryZones(prev => prev.filter(z => z.id !== id));
  };

  const updateZoneField = (id: string, field: keyof DeliveryZone, value: any) => {
    setDeliveryZones(prev => prev.map(z => (z.id === id ? { ...z, [field]: value } : z)));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center">
              <QrCode size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">
                Customer App Laundry & QRIS Dinamis Auto-Settlement
              </h3>
              <p className="text-[11px] text-slate-400">
                Konversi QRIS Statis ke Dinamis (EMVCo CRC-16) + Pembaca Notifikasi Android & Tarif Kurir
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 pt-3 bg-slate-950/50 border-b border-slate-800 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('QRIS')}
            className={`px-3.5 py-2 rounded-t-xl text-xs font-extrabold flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'QRIS'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap size={14} /> 1. QRIS Dinamis & Webhook HP
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ZONES')}
            className={`px-3.5 py-2 rounded-t-xl text-xs font-extrabold flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'ZONES'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bike size={14} /> 2. Tarif Jemput & Antar
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PORTAL')}
            className={`px-3.5 py-2 rounded-t-xl text-xs font-extrabold flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'PORTAL'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone size={14} /> 3. Link Customer App
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Memuat konfigurasi...</div>
          ) : (
            <>
              {/* ─── TAB 1: QRIS DINAMIS EMVCo CRC-16 & WEBHOOK ANDROID ──────── */}
              {activeTab === 'QRIS' && (
                <div className="space-y-4">
                  {/* Box 1: Upload / Input QRIS Statis */}
                  <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                          <ShieldCheck size={14} className="text-emerald-400" />
                          Langkah 1: Masukkan QRIS Statis Toko Anda (Zero-API Key)
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Upload foto cetakan QRIS toko Anda (GoPay Merchant / Dana Bisnis / BCA / BRI / Mandiri). Sistem otomatis mengubahnya menjadi QRIS Dinamis ber-nominal terkunci!
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0 ${
                          hasCustomQris
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {hasCustomQris ? '✅ QRIS Toko Aktif' : 'Mode Template Demo'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition shrink-0">
                        <Upload size={14} /> Upload Gambar QRIS Toko
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleDecodeQrisImage}
                          className="hidden"
                        />
                      </label>
                      <span className="text-[11px] text-slate-400">
                        atau tempelkan string EMVCo (`000201010211...`) di bawah:
                      </span>
                    </div>

                    <textarea
                      rows={2}
                      value={qrisStaticPayload}
                      onChange={e => setQrisStaticPayload(e.target.value)}
                      placeholder="00020101021126... (Otomatis terisi saat Anda upload gambar QRIS di atas)"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-[11px] font-mono text-cyan-300 focus:border-cyan-500 outline-none"
                    />
                  </div>

                  {/* Box 2: Webhook URL untuk Pembaca Notifikasi Android (Lapisan 3) */}
                  <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                      <Smartphone size={14} className="text-cyan-400" />
                      Langkah 2: URL Webhook Auto-Settlement Notifikasi HP Android (Lapisan 3)
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Pasang URL ini pada aplikasi <strong>Notification Forwarder / MacroDroid</strong> di HP Android toko yang menerima notifikasi uang masuk <em>(GoPay Merchant, Dana Bisnis, Livin, BCA, BRI)</em>. Saat ada notifikasi masuk sesuai nominal + 2 digit kode unik, nota otomatis berubah <strong>LUNAS dalam 1 detik</strong>!
                    </p>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={webhookUrl}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-[11px] font-mono text-slate-300"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(webhookUrl);
                          setCopiedWebhook(true);
                          toast('URL Webhook disalin!', 'success');
                          setTimeout(() => setCopiedWebhook(false), 2000);
                        }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                      >
                        {copiedWebhook ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        Salin URL
                      </button>
                    </div>
                  </div>

                  {/* Box 3: Simulator Test Notifikasi Uang Masuk */}
                  <div className="bg-gradient-to-br from-indigo-950/60 to-cyan-950/50 border border-cyan-500/40 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-extrabold text-cyan-300 flex items-center gap-1.5">
                      <Zap size={14} /> Simulator Uji Coba Auto-Settlement 1 Detik
                    </h4>
                    <p className="text-[11px] text-slate-300">
                      Ingin mengetes bagaimana nota pelanggan langsung berubah menjadi <strong>LUNAS</strong> saat HP toko menerima notifikasi? Masukkan nominal QRIS beserta kode uniknya (contoh: <code>35017</code>) lalu klik tombol simulasi:
                    </p>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">Aplikasi Merchant</label>
                        <select
                          value={simBankApp}
                          onChange={e => setSimBankApp(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-white"
                        >
                          <option value="GoPay Merchant">GoPay Merchant</option>
                          <option value="Dana Bisnis">Dana Bisnis</option>
                          <option value="BCA Mobile QRIS">BCA Mobile QRIS</option>
                          <option value="BRI Merchant">BRI Merchant</option>
                          <option value="Livin Merchant">Livin Mandiri</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">
                          Nominal + Kode Unik (Rp)
                        </label>
                        <input
                          type="number"
                          value={simAmount}
                          onChange={e => setSimAmount(e.target.value)}
                          placeholder="35017"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-black text-emerald-400"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleRunSimulator}
                          disabled={simLoading}
                          className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 transition"
                        >
                          <Zap size={13} />
                          {simLoading ? 'Mengirim...' : 'Test Notif Masuk'}
                        </button>
                      </div>
                    </div>

                    {simResult && (
                      <div
                        className={`p-3 rounded-xl border text-xs ${
                          simResult.matched
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                            : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                        }`}
                      >
                        <p className="font-mono text-[10px] opacity-80 mb-1">
                          Notif Simulasi: "{simResult.sampleNotification}"
                        </p>
                        <p className="font-extrabold">
                          {simResult.matched ? `✅ ${simResult.message}` : `ℹ️ ${simResult.reason}`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─── TAB 2: PENGATURAN ZONA TARIF JEMPUT & ANTAR ────────────── */}
              {activeTab === 'ZONES' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-extrabold text-white">
                        Daftar Zona Tarif Penjemputan (`pickupFee`) & Pengantaran (`deliveryFee`)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Biaya jemput dan biaya antar dihitung terpisah sesuai opsi yang dipilih pelanggan di aplikasi.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddZone}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1"
                    >
                      <Plus size={14} /> Tambah Zona
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {deliveryZones.map(zone => (
                      <div
                        key={zone.id}
                        className="bg-slate-800/60 border border-slate-700 rounded-xl p-3.5 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={zone.name}
                            onChange={e => updateZoneField(zone.id, 'name', e.target.value)}
                            placeholder="Nama Zona / Jarak"
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-extrabold text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveZone(zone.id)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-bold text-cyan-400 mb-1">
                              Biaya Jemput (Rp)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="500"
                              value={zone.pickupFee}
                              onChange={e => updateZoneField(zone.id, 'pickupFee', Number(e.target.value) || 0)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-indigo-400 mb-1">
                              Biaya Antar (Rp)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="500"
                              value={zone.deliveryFee}
                              onChange={e => updateZoneField(zone.id, 'deliveryFee', Number(e.target.value) || 0)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">Keterangan</label>
                            <input
                              type="text"
                              value={zone.description || ''}
                              onChange={e => updateZoneField(zone.id, 'description', e.target.value)}
                              placeholder="Keterangan zona"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ─── TAB 3: LINK & QR PORTAL PELANGGAN MANDIRI ──────────────── */}
              {activeTab === 'PORTAL' && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 flex flex-col items-center text-center space-y-4">
                  <div className="bg-white p-3 rounded-2xl shadow-lg">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
                        portalUrl
                      )}`}
                      alt="QR Customer Portal Laundry"
                      className="w-44 h-44 rounded-lg"
                    />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">Portal Pelanggan Mandiri {tenantName}</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-md">
                      Bagikan link atau QR ini ke WhatsApp & Bio Instagram toko Anda. Pelanggan bisa memesan penjemputan kurir, mengecek status cucian, melihat saldo kuota Kg, dan membayar via QRIS Dinamis!
                    </p>
                  </div>

                  <div className="w-full flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={portalUrl}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(portalUrl);
                        setCopiedPortal(true);
                        toast('Link Portal Pelanggan disalin!', 'success');
                        setTimeout(() => setCopiedPortal(false), 2000);
                      }}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                    >
                      {copiedPortal ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      Salin
                    </button>
                    <a
                      href={portalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5"
                    >
                      <ExternalLink size={14} /> Buka App
                    </a>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Save */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-cyan-600/20"
          >
            <Save size={14} />
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan QRIS & Zona Ongkir'}
          </button>
        </div>
      </div>
    </div>
  );
}

