import React, { useState, useEffect, useContext } from 'react';
import { 
  MessageSquare, 
  QrCode, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Send, 
  Sparkles, 
  Smartphone, 
  ShieldCheck, 
  Info, 
  Sliders, 
  History, 
  RotateCcw,
  Check,
  Flame,
  AlertTriangle
} from 'lucide-react';
import { POSContext } from '../../context/POSContext';
import { toast, confirmAlert } from '../../utils/alert';

interface WhatsAppStatus {
  status: 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTED' | 'SUSPENDED';
  phoneConnected: string | null;
  qrCode: string | null;
  monthlyQuota: number;
  usedThisMonth: number;
  autoSendReceipt: boolean;
  autoSendReminder: boolean;
}

interface WhatsAppTemplate {
  id: string;
  triggerKey: string;
  title: string;
  templateBody: string;
  isActive: boolean;
  vertical: string;
}

interface WhatsAppLog {
  id: string;
  recipientPhone: string;
  recipientName: string | null;
  triggerKey: string | null;
  messageBody: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

export const SettingsWhatsAppGateway: React.FC = () => {
  const posContext = useContext(POSContext);
  const token = posContext?.token;

  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [statusData, setStatusData] = useState<WhatsAppStatus | null>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('RECEIPT');
  const [editedTemplateBody, setEditedTemplateBody] = useState<string>('');
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'connection' | 'templates' | 'test' | 'logs'>('connection');

  // Test send state
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Halo! Ini adalah pesan uji coba dari sistem CodePOS WhatsApp Gateway Anda.');
  const [sendingTest, setSendingTest] = useState(false);

  // Switches
  const [autoSendReceipt, setAutoSendReceipt] = useState(true);
  const [autoSendReminder, setAutoSendReminder] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // 1. Fetch Status
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setStatusData(json.data);
          setAutoSendReceipt(json.data.autoSendReceipt ?? true);
          setAutoSendReminder(json.data.autoSendReminder ?? true);
        }
      }
    } catch (err) {
      console.error('Failed to fetch WhatsApp status:', err);
    }
  };

  // 2. Fetch Templates
  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/whatsapp/templates', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setTemplates(json.data);
          if (json.data.length > 0 && !editedTemplateBody) {
            const first = json.data.find((t: WhatsAppTemplate) => t.triggerKey === selectedTemplateKey) || json.data[0];
            setSelectedTemplateKey(first.triggerKey);
            setEditedTemplateBody(first.templateBody);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch WhatsApp templates:', err);
    }
  };

  // 3. Fetch Logs
  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/whatsapp/logs?limit=30', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setLogs(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch WhatsApp logs:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchStatus();
      fetchTemplates();
      fetchLogs();
    }
  }, [token]);

  // Polling saat status SCAN_QR agar otomatis berubah ke CONNECTED saat user scan di HP
  useEffect(() => {
    let interval: any;
    if (statusData?.status === 'SCAN_QR') {
      interval = setInterval(() => {
        fetchStatus();
      }, 3500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [statusData?.status]);

  // Handle Switch Template
  const handleSelectTemplate = (key: string) => {
    setSelectedTemplateKey(key);
    const tmpl = templates.find(t => t.triggerKey === key);
    if (tmpl) {
      setEditedTemplateBody(tmpl.templateBody);
    }
  };

  // Insert Variable Tag into Template
  const handleInsertVariable = (varName: string) => {
    setEditedTemplateBody(prev => prev + varName);
  };

  // Start Connection & Get QR
  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        }
      });
      const json = await res.json();
      if (json.success) {
        toast('Sesi WhatsApp dibuat. Silakan scan QR code dengan aplikasi WhatsApp Anda.', 'info');
        if (json.qrCode) {
          setStatusData(prev => prev ? { ...prev, status: 'SCAN_QR', qrCode: json.qrCode } : {
            status: 'SCAN_QR',
            phoneConnected: null,
            qrCode: json.qrCode,
            monthlyQuota: 1000,
            usedThisMonth: 0,
            autoSendReceipt: true,
            autoSendReminder: true
          });
        }
        await fetchStatus();
      } else {
        toast(json.error || 'Gagal memulai koneksi WhatsApp', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Error saat menghubungkan WhatsApp', 'error');
    } finally {
      setConnecting(false);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    const confirmed = await confirmAlert(
      'Putus Koneksi WhatsApp?',
      'Nomor WhatsApp ini tidak akan lagi mengirim struk atau pesan otomatis sampai Anda menghubungkannya kembali.'
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        toast('WhatsApp berhasil diputus.', 'success');
        await fetchStatus();
      } else {
        toast(json.error || 'Gagal memutus sesi WhatsApp', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Error memutus WhatsApp', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Save Switches
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/whatsapp/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          autoSendReceipt,
          autoSendReminder
        })
      });
      const json = await res.json();
      if (json.success) {
        toast('Preferensi pengiriman otomatis WhatsApp berhasil disimpan!', 'success');
        await fetchStatus();
      } else {
        toast(json.error || 'Gagal menyimpan preferensi', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Gagal menyimpan pengaturan', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Save Template Edit
  const handleSaveTemplate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/templates/${selectedTemplateKey}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          templateBody: editedTemplateBody
        })
      });
      const json = await res.json();
      if (json.success) {
        toast('Template pesan berhasil diperbarui!', 'success');
        await fetchTemplates();
      } else {
        toast(json.error || 'Gagal menyimpan template', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Gagal menyimpan template', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Reset Templates to Default
  const handleResetTemplates = async () => {
    const confirmed = await confirmAlert(
      'Kembalikan Template ke Standar?',
      'Seluruh redaksi template pesan WhatsApp akan direset ke pengaturan default bawaan jenis usaha Anda.'
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/templates/reset', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        toast('Template berhasil dikembalikan ke standar vertikal!', 'success');
        await fetchTemplates();
        const activeTmpl = json.data?.find((t: any) => t.triggerKey === selectedTemplateKey);
        if (activeTmpl) setEditedTemplateBody(activeTmpl.templateBody);
      } else {
        toast(json.error || 'Gagal mereset template', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Error saat mereset template', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Test Send
  const handleTestSend = async () => {
    if (!testPhone.trim() || !testMessage.trim()) {
      return toast('Harap isi nomor tujuan dan pesan uji coba.', 'warning');
    }

    setSendingTest(true);
    try {
      const res = await fetch('/api/whatsapp/test-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          recipientPhone: testPhone,
          message: testMessage
        })
      });
      const json = await res.json();
      if (json.success) {
        toast('Pesan uji coba berhasil dijadwalkan dan dikirim!', 'success');
        setTestPhone('');
        await fetchStatus();
        await fetchLogs();
      } else {
        toast(json.error || 'Gagal mengirim pesan uji coba', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Gagal kirim pesan uji coba', 'error');
    } finally {
      setSendingTest(false);
    }
  };

  const isConnected = statusData?.status === 'CONNECTED' && Boolean(statusData?.phoneConnected);
  const isScanQR = statusData?.status === 'SCAN_QR' || (statusData?.status === 'CONNECTED' && !statusData?.phoneConnected);
  const quotaUsed = statusData?.usedThisMonth || 0;
  const quotaTotal = statusData?.monthlyQuota || 1000;
  const quotaPercentage = Math.min(100, Math.round((quotaUsed / quotaTotal) * 100));

  const activeTemplateObj = templates.find(t => t.triggerKey === selectedTemplateKey);

  // Live WhatsApp preview parser
  const renderPreviewText = (text: string) => {
    let sample = text
      .split('{storeName}').join(posContext?.settings?.storeName || 'Kedai Kami')
      .split('{customerName}').join('Budi Santoso')
      .split('{orderNumber}').join('ORD-2026-0042')
      .split('{totalAmount}').join('Rp 68.000')
      .split('{paymentMethod}').join('QRIS Mandiri')
      .split('{invoiceUrl}').join(`${typeof window !== 'undefined' ? window.location.origin : 'https://codenusa.id'}/invoice/order/ORD-2026-0042`)
      .split('{orderItems}').join('• Ramen Spesial x2 = Rp 50.000\n• Ocha Dingin x2 = Rp 18.000')
      .split('{tableName}').join('Meja 04')
      .split('{reservationDate}').join('30/09/2026')
      .split('{reservationTime}').join('19:30')
      .split('{pax}').join('4')
      .split('{vehiclePlate}').join('B 1234 XYZ')
      .split('{vehicleModel}').join('Honda Vario 160')
      .split('{workOrderNumber}').join('SPK-202609-0012')
      .split('{mechanicName}').join('Mas Agus')
      .split('{rackNumber}').join('A-02')
      .split('{weightKg}').join('4.5 Kg')
      .split('{perfume}').join('Lavender Premium')
      .split('{attireSummary}').join('Set Baju Bodo Tokko Merah Marun (Lengkap Saloko & Keris)')
      .split('{pickupDate}').join('Jumat, 25 Sep 2026')
      .split('{returnDeadline}').join('Senin, 28 Sep 2026, 17:00 WITA')
      .split('{depositAmount}').join('Rp 150.000')
      .split('{daysLate}').join('2')
      .split('{estimatedLateFee}').join('Rp 100.000');

    return sample;
  };

  const availableVariables = [
    { tag: '{storeName}', label: 'Nama Toko' },
    { tag: '{customerName}', label: 'Nama Pelanggan' },
    { tag: '{orderNumber}', label: 'No. Nota / SPK' },
    { tag: '{totalAmount}', label: 'Total Bayar' },
    { tag: '{paymentMethod}', label: 'Metode Bayar' },
    { tag: '{orderItems}', label: 'Daftar Menu' },
    { tag: '{invoiceUrl}', label: 'Link Struk Online' },
    { tag: '{tableName}', label: 'Nomor Meja' },
    { tag: '{vehiclePlate}', label: 'Plat Nomor' },
    { tag: '{vehicleModel}', label: 'Model Motor/Mobil' },
    { tag: '{rackNumber}', label: 'Rak Cucian' },
    { tag: '{attireSummary}', label: 'Koleksi Busana Adat' },
    { tag: '{pickupDate}', label: 'Jadwal Ambil/Fitting' },
    { tag: '{returnDeadline}', label: 'Batas Pengembalian' },
    { tag: '{depositAmount}', label: 'Uang Jaminan/Deposit' },
    { tag: '{daysLate}', label: 'Hari Terlambat' },
    { tag: '{estimatedLateFee}', label: 'Estimasi Denda' }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Sub Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <MessageSquare size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              WhatsApp CRM & Gateway Independen
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700">
                Multi-Tenant Add-On
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Gunakan nomor WhatsApp bisnis Anda sendiri untuk e-Receipt kasir dan notifikasi pelanggan otomatis.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveSubTab('connection')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'connection'
                ? 'bg-white text-emerald-700 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode size={14} />
            <span>Koneksi & Status</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('templates')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'templates'
                ? 'bg-white text-emerald-700 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders size={14} />
            <span>Editor Template</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('test')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'test'
                ? 'bg-white text-emerald-700 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Send size={14} />
            <span>Tes Kirim</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('logs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === 'logs'
                ? 'bg-white text-emerald-700 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History size={14} />
            <span>Riwayat Pesan</span>
          </button>
        </div>
      </div>

      {/* ─── TAB 1: CONNECTION & QUOTA ────────────────────────────────────────── */}
      {activeSubTab === 'connection' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status Box */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <div>
                  <h4 className="text-base font-black text-slate-800">Status Perangkat WhatsApp</h4>
                  <p className="text-xs text-slate-500">Koneksi multi-device terenkripsi berbasis sesi privat tenant.</p>
                </div>
                <div>
                  {isConnected ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 size={14} /> Terhubung
                    </span>
                  ) : isScanQR ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-700 border border-amber-200 animate-pulse">
                      <QrCode size={14} /> Menunggu Scan QR
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-600 border border-slate-200">
                      <XCircle size={14} /> Belum Terhubung
                    </span>
                  )}
                </div>
              </div>

              {isConnected ? (
                <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-5 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                        <Smartphone size={24} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-emerald-800">Nomor WhatsApp Aktif:</div>
                        <div className="text-lg font-black text-emerald-950 font-mono">
                          +{statusData?.phoneConnected || '-'}
                        </div>
                        <div className="text-[11px] text-emerald-700 flex items-center gap-1 mt-0.5">
                          <ShieldCheck size={13} /> Sesi mandiri aktif & terisolasi per tenant
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDisconnect}
                      disabled={loading}
                      className="px-4 py-2.5 rounded-xl text-xs font-black bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 transition-all shadow-xs active:scale-95 shrink-0"
                    >
                      Putus Sesi WhatsApp
                    </button>
                  </div>
                </div>
              ) : connecting || (isScanQR && !statusData?.qrCode) ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 animate-spin">
                    <RefreshCw size={24} />
                  </div>
                  <h5 className="text-sm font-black text-slate-800 mb-1">Sedang Menyiapkan QR Code...</h5>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Menghubungkan ke server WhatsApp multi-device. Kode QR akan muncul dalam beberapa detik...
                  </p>
                </div>
              ) : isScanQR && statusData?.qrCode ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center mb-6">
                  <div className="max-w-xs mx-auto mb-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm inline-block">
                    <img 
                      src={statusData.qrCode} 
                      alt="WhatsApp QR Code" 
                      className="w-56 h-56 mx-auto rounded-lg"
                    />
                  </div>
                  <h5 className="text-sm font-black text-slate-800 mb-1">Scan Kode QR di Atas</h5>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mb-4 leading-relaxed">
                    Buka WhatsApp di HP Anda ➔ Pengaturan / Titik 3 ➔ <b>Perangkat Tertaut</b> ➔ <b>Tautkan Perangkat</b> ➔ Arahkan kamera ke QR ini.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={fetchStatus}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all flex items-center gap-1.5"
                    >
                      <RefreshCw size={13} /> Periksa Status Sekarang
                    </button>
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={connecting}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all"
                    >
                      Generate QR Baru
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50/80 border border-dashed border-slate-300 rounded-2xl p-8 text-center mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
                    <MessageSquare size={28} />
                  </div>
                  <h5 className="text-base font-black text-slate-800 mb-1">Belum Ada Nomor WhatsApp Terhubung</h5>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mb-5 leading-relaxed">
                    Hubungkan nomor WhatsApp kasir atau admin toko Anda sekarang untuk mulai mengirim nota transaksi digital dan notifikasi otomatis ke pelanggan.
                  </p>
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={connecting}
                    className="px-6 py-3 rounded-xl text-sm font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 transition-all active:scale-95 inline-flex items-center gap-2"
                  >
                    <QrCode size={18} />
                    {connecting ? 'Menyiapkan Kode QR...' : 'Tautkan Nomor WhatsApp Sekarang'}
                  </button>
                </div>
              )}

              {/* Automatic Trigger Switches */}
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <h5 className="text-xs font-black text-slate-400 uppercase tracking-wider">Otomasi Trigger Kasir</h5>
                
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70">
                  <div className="space-y-0.5 pr-4">
                    <div className="text-xs font-bold text-slate-800">Kirim e-Receipt Nota Otomatis</div>
                    <div className="text-[11px] text-slate-500">
                      Otomatis kirim struk digital sesaat setelah kasir menyelesaikan transaksi jika nomor HP pembeli terisi.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoSendReceipt}
                    onChange={(e) => setAutoSendReceipt(e.target.checked)}
                    className="toggle toggle-emerald"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70">
                  <div className="space-y-0.5 pr-4">
                    <div className="text-xs font-bold text-slate-800">Kirim Notifikasi SPK / Reservasi / Cucian Selesai</div>
                    <div className="text-[11px] text-slate-500">
                      Kirim pesan pengingat booking meja, estimasi SPK bengkel, atau pakaian laundry siap ambil di rak.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoSendReminder}
                    onChange={(e) => setAutoSendReminder(e.target.checked)}
                    className="toggle toggle-emerald"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-sm"
                  >
                    {savingSettings ? 'Menyimpan...' : 'Simpan Preferensi Trigger'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quota & Info Sidecard */}
          <div className="space-y-6">
            {/* Quota Card */}
            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <MessageSquare size={120} />
              </div>
              <div className="relative z-10 space-y-4">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  <Sparkles size={11} /> Kuota Pesan Bulanan
                </span>
                <div>
                  <div className="text-3xl font-black tracking-tight">{quotaUsed} <span className="text-sm font-semibold text-slate-400">/ {quotaTotal}</span></div>
                  <p className="text-xs text-slate-400 mt-1">Pesan terkirim periode ini</p>
                </div>

                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${quotaPercentage}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Terpakai: {quotaPercentage}%</span>
                  <span>Sisa: {Math.max(0, quotaTotal - quotaUsed)} pesan</span>
                </div>
              </div>
            </div>

            {/* Migration Resilience Info Box */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h5 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-emerald-600" />
                Resiliensi Migrasi MVP
              </h5>
              <p className="text-xs text-slate-600 leading-relaxed">
                Fitur WhatsApp CRM dirancang <b>100% independen</b>. Jika Anda mengubah jenis bisnis (misalnya dari Kafe ke Bengkel Motor), sesi WhatsApp Anda <b>tidak akan terputus</b> dan data kontak pelanggan tetap terjaga utuh.
              </p>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 space-y-1">
                <div className="flex items-center gap-1 text-slate-700 font-bold">
                  <Check size={12} className="text-emerald-600" /> Multi-Session Isolation
                </div>
                <div>Folder kredensial terisolasi per tenant ID sehingga aman dari kebocoran akun.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: TEMPLATE EDITOR ───────────────────────────────────────────── */}
      {activeSubTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Template Selector & Editor */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-black text-slate-800">Kustomisasi Redaksi Pesan</h4>
                  <p className="text-xs text-slate-500">Sesuaikan kata-kata pesan WhatsApp agar cocok dengan gaya bahasa toko Anda.</p>
                </div>
                <button
                  type="button"
                  onClick={handleResetTemplates}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all flex items-center gap-1"
                >
                  <RotateCcw size={13} /> Reset Default
                </button>
              </div>

              {/* Template Pills Selection */}
              <div className="flex flex-wrap gap-2">
                {templates.map(tmpl => {
                  const isSelected = tmpl.triggerKey === selectedTemplateKey;
                  return (
                    <button
                      key={tmpl.triggerKey}
                      type="button"
                      onClick={() => handleSelectTemplate(tmpl.triggerKey)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border text-left ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/20'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      {tmpl.title}
                    </button>
                  );
                })}
              </div>

              {/* Variable Quick Insert Badges */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Klik Variabel untuk Menyisipkan ke Pesan:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {availableVariables.map(v => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => handleInsertVariable(v.tag)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-all active:scale-95"
                    >
                      {v.tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 block">
                  Teks Template Pesan ({activeTemplateObj?.title || 'Aktif'}):
                </label>
                <textarea
                  rows={10}
                  value={editedTemplateBody}
                  onChange={(e) => setEditedTemplateBody(e.target.value)}
                  className="w-full p-4 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all leading-relaxed"
                  placeholder="Ketik template pesan WhatsApp Anda..."
                />
                <span className="text-[11px] text-slate-400 block">
                  Tip: Gunakan tanda asteris (*) untuk <b>tebal</b>, garis bawah (_) untuk <i>miring</i>, dan tilde (~) untuk coret.
                </span>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={loading}
                  className="px-6 py-3 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                >
                  {loading ? 'Menyimpan...' : 'Simpan Perubahan Template'}
                </button>
              </div>
            </div>
          </div>

          {/* Live Interactive WhatsApp Chat Mockup */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 rounded-3xl p-4 shadow-xl border border-slate-800 text-white max-w-sm mx-auto">
              {/* Phone Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 px-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                    WA
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">{posContext?.settings?.storeName || 'Kedai Kami'}</div>
                    <div className="text-[10px] text-emerald-400">Online</div>
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">Live Preview</span>
              </div>

              {/* Chat Canvas (WhatsApp Background pattern style) */}
              <div className="py-6 px-3 min-h-[380px] bg-slate-950/60 rounded-2xl my-3 flex flex-col justify-end">
                {/* Bubble Chat */}
                <div className="bg-[#005c4b] text-white p-3.5 rounded-2xl rounded-tr-none shadow-md max-w-[92%] ml-auto text-xs leading-relaxed space-y-2 relative border border-emerald-500/20">
                  <div className="whitespace-pre-wrap font-sans text-[11.5px]">
                    {renderPreviewText(editedTemplateBody)}
                  </div>
                  <div className="flex items-center justify-end gap-1 text-[9px] text-emerald-200/70 pt-1">
                    <span>14:28</span>
                    <span className="text-cyan-300 font-bold">✓✓</span>
                  </div>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-1">
                Pratinjau tampilan pesan di WhatsApp pelanggan
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: TEST SEND ─────────────────────────────────────────────────── */}
      {activeSubTab === 'test' && (
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Send size={20} />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-800">Uji Coba Kirim Pesan WhatsApp</h4>
              <p className="text-xs text-slate-500">Kirim pesan uji coba ke nomor Anda sendiri untuk memastikan koneksi gateway berjalan lancar.</p>
            </div>
          </div>

          {!isConnected && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
              <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
              <div>
                <b>Perhatian:</b> Sesi WhatsApp tenant saat ini belum terhubung. Harap hubungkan nomor di tab <b>Koneksi & Status</b> terlebih dahulu sebelum mengirim pesan.
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nomor WhatsApp Penerima (Contoh: 08123456789 atau 628123456789):
              </label>
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="0812xxxxxxxx"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Isi Pesan Uji Coba:
              </label>
              <textarea
                rows={4}
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="w-full p-4 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <button
              type="button"
              onClick={handleTestSend}
              disabled={sendingTest || !isConnected}
              className="w-full py-3 rounded-xl text-sm font-black bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Send size={16} />
              {sendingTest ? 'Mengirim Pesan...' : 'Kirim Pesan Sekarang'}
            </button>
          </div>
        </div>
      )}

      {/* ─── TAB 4: MESSAGE AUDIT LOGS ────────────────────────────────────────── */}
      {activeSubTab === 'logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-black text-slate-800">Riwayat Pengiriman Pesan</h4>
              <p className="text-xs text-slate-500">Log audit pesan WhatsApp yang terkirim dari sistem POS ini.</p>
            </div>
            <button
              type="button"
              onClick={fetchLogs}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 transition-all flex items-center gap-1.5"
            >
              <RefreshCw size={13} /> Refresh Log
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black border-y border-slate-100">
                <tr>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Penerima</th>
                  <th className="py-3 px-4">Kategori Trigger</th>
                  <th className="py-3 px-4">Cuplikan Pesan</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Belum ada riwayat pesan yang terkirim.
                    </td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {new Date(log.createdAt).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        +{log.recipientPhone}
                        {log.recipientName && (
                          <span className="block text-[10px] text-slate-400 font-normal">
                            ({log.recipientName})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-slate-100 text-slate-700">
                          {log.triggerKey || 'MANUAL'}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-600" title={log.messageBody}>
                        {log.messageBody}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {log.status === 'SENT' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                            Terkirim
                          </span>
                        ) : log.status === 'FAILED' ? (
                          <span 
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 cursor-pointer" 
                            title={log.errorMessage || 'Gagal'}
                          >
                            Gagal
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                            Antrean
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsWhatsAppGateway;
