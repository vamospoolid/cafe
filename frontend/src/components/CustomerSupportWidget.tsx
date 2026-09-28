import React, { useState, useEffect, useContext } from 'react';
import { 
  Headphones, 
  MessageSquare, 
  Send, 
  Search, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  ChevronDown, 
  X, 
  Printer, 
  WifiOff, 
  CreditCard, 
  Users, 
  Package, 
  Sparkles,
  PhoneCall,
  Clock,
  ExternalLink
} from 'lucide-react';
import { POSContext } from '../context/POSContext';
import { toast } from '../utils/alert';

export const CustomerSupportWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'ticket' | 'faq'>('whatsapp');
  const posContext = useContext(POSContext);

  // Form State
  const [contactName, setContactName] = useState(posContext?.user?.name || '');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [category, setCategory] = useState<'PRINTER_HARDWARE' | 'OFFLINE_SYNC' | 'PAYMENT_QRIS' | 'INVENTORY_RECIPE' | 'ACCOUNT_ACCESS' | 'GENERAL'>('PRINTER_HARDWARE');
  const [priority, setPriority] = useState<'CRITICAL_RUSH_HOUR' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ticketResult, setTicketResult] = useState<any>(null);

  // FAQ State
  const [faqs, setFaqs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('faq-1');

  useEffect(() => {
    if (posContext?.user?.name && !contactName) {
      setContactName(posContext.user.name);
    }
  }, [posContext?.user]);

  useEffect(() => {
    if (isOpen && faqs.length === 0) {
      fetch('/api/support/faq')
        .then(res => res.json())
        .then(data => {
          if (data.faqs) setFaqs(data.faqs);
        })
        .catch(console.warn);
    }
  }, [isOpen]);

  const handleWhatsAppDirect = (customMessage?: string) => {
    const userAny = posContext?.user as any;
    const tenantName = userAny?.tenantName || userAny?.tenantId || 'Kafe Mitra';
    const outletName = userAny?.outletName || 'Outlet';
    const userName = posContext?.user?.name || contactName || 'Pengguna Kasir';

    const defaultMsg = customMessage || `Halo Tim Support Codenusa POS,%0A%0ASaya butuh bantuan teknis:%0A- Kafe: *${encodeURIComponent(tenantName)}*%0A- Cabang: *${encodeURIComponent(outletName)}*%0A- Kontak: *${encodeURIComponent(userName)}*%0A- Topik: *${encodeURIComponent(subject || 'Konsultasi Operasional POS')}*%0A%0APesan: ${encodeURIComponent(message || 'Mohon dibantu verifikasi sistem kasir.')}`;
    
    window.open(`https://wa.me/628123456789?text=${defaultMsg}`, '_blank');
  };

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactPhone || !subject || !message) {
      toast('Mohon lengkapi semua bidang yang bertanda bintang (*)', 'error');
      return;
    }

    const userAny = posContext?.user as any;
    setSubmitting(true);
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: posContext?.user?.tenantId,
          tenantName: userAny?.tenantName || userAny?.tenantId || 'Kafe Pengguna',
          outletName: userAny?.outletName || 'Cabang Utama',
          contactName,
          contactPhone,
          contactEmail,
          category,
          priority,
          subject,
          message,
          deviceInfo: `${navigator.userAgent} // Offline: ${!navigator.onLine}`
        })
      });

      const data = await res.json();
      if (res.ok) {
        setTicketResult(data.ticket);
        toast(`🎉 ${data.message}`, 'success');
      } else {
        toast(data.error || 'Gagal mengirimkan tiket', 'error');
      }
    } catch (err: any) {
      toast('Terjadi kendala jaringan saat mengirim tiket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredFaqs = faqs.filter(f => 
    f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.tags && f.tags.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  return (
    <>
      {/* ─── Floating Support Button Launcher ──────────────────────────────── */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 text-white font-extrabold text-xs sm:text-sm rounded-full shadow-2xl shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all group border border-white/20"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
        </span>
        <Headphones className="w-4 h-4 group-hover:rotate-12 transition-transform" />
        <span className="tracking-wide">Bantuan CS 24/7</span>
      </button>

      {/* ─── Interactive Customer Support Modal ────────────────────────────── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full sm:max-w-lg bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] text-slate-100">
            
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 border-b border-slate-800 flex items-center justify-between relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    Pusat Bantuan & Support POS
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-black rounded-full uppercase">
                      Online
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">Siap membantu kendala operasional kasir & resto Anda</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsOpen(false);
                  setTicketResult(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="grid grid-cols-3 p-2 bg-slate-950/70 border-b border-slate-800 text-xs font-bold">
              <button
                onClick={() => setActiveTab('whatsapp')}
                className={`py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'whatsapp' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>WhatsApp Live</span>
              </button>

              <button
                onClick={() => setActiveTab('ticket')}
                className={`py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'ticket' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Buat Tiket</span>
              </button>

              <button
                onClick={() => setActiveTab('faq')}
                className={`py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'faq' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Solusi Cepat</span>
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* TAB 1: WHATSAPP LIVE CS */}
              {activeTab === 'whatsapp' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                      <PhoneCall className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-extrabold text-white">Layanan WhatsApp Prioritas 24/7</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Hubungi langsung tim teknisi Codenusa. Pesan akan diformat otomatis dengan identitas kafe dan status outlet Anda untuk penanganan kilat.
                    </p>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                      <div className="text-slate-400 font-semibold">Pilih Topik Kendala Cepat:</div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => handleWhatsAppDirect('Kendala Printer Bluetooth: Struk kasir tidak mau keluar saat jam sibuk.')}
                          className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg text-left border border-slate-800 flex items-center gap-1.5 font-bold"
                        >
                          <Printer className="w-3.5 h-3.5 text-amber-400" />
                          <span>Printer Macet</span>
                        </button>

                        <button
                          onClick={() => handleWhatsAppDirect('Kendala QRIS Midtrans: Status pembayaran tertahan / belum otomatis lunas.')}
                          className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg text-left border border-slate-800 flex items-center gap-1.5 font-bold"
                        >
                          <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Status QRIS</span>
                        </button>

                        <button
                          onClick={() => handleWhatsAppDirect('Kendala Offline Sync: Ada pesanan kasir antrean yang belum ter-upload.')}
                          className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg text-left border border-slate-800 flex items-center gap-1.5 font-bold"
                        >
                          <WifiOff className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Offline Sync</span>
                        </button>

                        <button
                          onClick={() => handleWhatsAppDirect('Bantuan Reset PIN Staf / Akun Owner Kafe.')}
                          className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg text-left border border-slate-800 flex items-center gap-1.5 font-bold"
                        >
                          <Users className="w-3.5 h-3.5 text-purple-400" />
                          <span>Reset PIN / Akun</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleWhatsAppDirect()}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
                  >
                    <span>Buka WhatsApp CS Sekarang</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* TAB 2: TICKET HELPDESK FORM */}
              {activeTab === 'ticket' && (
                <div className="animate-fade-in">
                  {ticketResult ? (
                    <div className="p-6 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl text-center space-y-4">
                      <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-white">Tiket Berhasil Dikirim!</h4>
                        <div className="inline-block px-3 py-1 bg-indigo-600 text-white font-mono font-bold text-xs rounded-lg mt-2">
                          #{ticketResult.ticketNumber}
                        </div>
                        <p className="text-xs text-slate-300 mt-2">
                          Tim Teknisi kami telah menerima keluhan Anda ({ticketResult.subject}). Kami akan menghubungi Anda di WhatsApp <strong>{ticketResult.contactPhone}</strong>.
                        </p>
                      </div>
                      <button
                        onClick={() => setTicketResult(null)}
                        className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
                      >
                        Kirim Tiket Lain
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleTicketSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Nama Kontak *</label>
                          <input
                            type="text"
                            required
                            placeholder="Contoh: Budi (Kasir)"
                            value={contactName}
                            onChange={(e) => setContactName(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">No. WhatsApp *</label>
                          <input
                            type="tel"
                            required
                            placeholder="0812xxxxxxx"
                            value={contactPhone}
                            onChange={(e) => setContactPhone(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Kategori Kendala</label>
                          <select
                            value={category}
                            onChange={(e: any) => setCategory(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                          >
                            <option value="PRINTER_HARDWARE">Printer Thermal & Bluetooth</option>
                            <option value="PAYMENT_QRIS">QRIS & Pembayaran Midtrans</option>
                            <option value="OFFLINE_SYNC">Koneksi & Offline Sync</option>
                            <option value="INVENTORY_RECIPE">Resep & Stok Bahan Baku</option>
                            <option value="ACCOUNT_ACCESS">Akun Staf & Hak Akses</option>
                            <option value="GENERAL">Konsultasi / Fitur Baru</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Tingkat Urgensi</label>
                          <select
                            value={priority}
                            onChange={(e: any) => setPriority(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                          >
                            <option value="CRITICAL_RUSH_HOUR">🚨 Urgent (Jam Sibuk Kasir)</option>
                            <option value="HIGH">Tinggi (Mempengaruhi Jualan)</option>
                            <option value="MEDIUM">Sedang (Kendala Standar)</option>
                            <option value="LOW">Rendah (Pertanyaan Umum)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Judul Kendala *</label>
                        <input
                          type="text"
                          required
                          placeholder="Ringkasan singkat kendala yang dialami"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">Detail Masalah / Kronologi *</label>
                        <textarea
                          required
                          rows={3}
                          placeholder="Ceritakan langkah kejadian saat kendala terjadi..."
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
                      >
                        {submitting ? 'Mengirimkan Tiket...' : 'Kirimkan Tiket Bantuan'}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* TAB 3: FAQ KNOWLEDGE BASE */}
              {activeTab === 'faq' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari solusi (contoh: printer, offline, pin, qris)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-2">
                    {filteredFaqs.map((faq) => {
                      const isExpanded = expandedFaqId === faq.id;
                      return (
                        <div
                          key={faq.id}
                          className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 transition-all"
                        >
                          <button
                            onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                            className="w-full flex items-center justify-between text-left gap-2"
                          >
                            <span className="text-xs font-bold text-white">{faq.question}</span>
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-slate-850 text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                              {faq.answer}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 text-center text-[10px] text-slate-500">
              Codenusa Support Engine v2.6 &bull; Tim Teknis Siaga Jam 07:00 - 24:00 WIB
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CustomerSupportWidget;
