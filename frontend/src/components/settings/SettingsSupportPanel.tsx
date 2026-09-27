import React from 'react';
import {
  Headphones,
  Phone,
  MessageSquare,
  Send,
  HelpCircle,
  CheckCircle2
} from 'lucide-react';
import { toast } from '../../utils/alert';

interface SettingsSupportPanelProps {
  isBengkel: boolean;
  posContext: any;
}

export const SettingsSupportPanel: React.FC<SettingsSupportPanelProps> = ({ isBengkel, posContext }) => {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Headphones size={22} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
              Pusat Bantuan & Layanan CS 24/7
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Online
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Dapatkan pendampingan teknis langsung dari tim engineer & support Codenusa POS.</p>
          </div>
        </div>

        {/* WhatsApp Direct Button */}
        <a
          href={`https://wa.me/628123456789?text=Halo%20Tim%20Support%20Codenusa%20POS,%20saya%20butuh%20bantuan%20operasional%20${isBengkel ? 'bengkel' : 'kafe'}.`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-600/20 transition-all active:scale-95 shrink-0"
        >
          <Phone size={15} />
          <span>Chat WhatsApp CS Live (VIP)</span>
        </a>
      </div>

      {/* Grid 2 Kolom: Tiket Bantuan & Solusi Cepat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Kolom Kiri: Form Tiket Bantuan */}
        <div className="lg:col-span-7 bg-slate-50/70 p-5 sm:p-6 rounded-3xl border border-slate-200/80 space-y-5">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-indigo-600" />
            <h4 className="text-sm font-bold text-slate-800">Kirim Tiket Kendala / Permintaan Bantuan</h4>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const formDataObj = new FormData(form);
              const payload = {
                name: formDataObj.get('name') || posContext?.user?.name || 'Owner',
                phone: formDataObj.get('phone') || posContext?.settings?.phone || '',
                email: formDataObj.get('email') || '',
                category: formDataObj.get('category') || 'PRINTER',
                message: formDataObj.get('message') || '',
                tenantId: posContext?.user?.tenantId || 'default-tenant'
              };

              if (!payload.message) {
                return toast('Mohon deskripsikan kendala Anda.', 'warning');
              }

              try {
                const res = await fetch('/api/support/tickets', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok) {
                  toast(`🎉 ${data.message || 'Tiket berhasil dikirim! Tim CS akan segera menghubungi.'}`, 'success');
                  form.reset();
                } else {
                  toast(data.error || 'Gagal mengirim tiket bantuan', 'error');
                }
              } catch {
                toast('Gagal terhubung ke server support.', 'error');
              }
            }}
            className="space-y-4 text-xs"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-600 mb-1">Nama Pengirim / Kasir</label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={posContext?.user?.name || ''}
                  placeholder="Nama staf / owner"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 mb-1">Nomor WhatsApp Aktif</label>
                <input
                  type="tel"
                  name="phone"
                  required
                  defaultValue={posContext?.settings?.phone || ''}
                  placeholder="0812xxxxxx"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">Kategori Kendala</label>
              <select
                name="category"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="PRINTER">🖨️ Printer Kasir / Bluetooth / Kertas Struk</option>
                <option value="PAYMENT">💳 Pembayaran QRIS / EDC / Midtrans</option>
                {!isBengkel && <option value="KDS">🍳 Layar Dapur (KDS) & Sinkronisasi Pesanan</option>}
                <option value="INVENTORY">{isBengkel ? '📦 Stok Suku Cadang, Oli & Gudang Pit' : '📦 Resep HPP / Stok Bahan Baku / Gudang'}</option>
                <option value="OFFLINE_SYNC">⚡ Mode Offline & Sinkronisasi Data</option>
                <option value="FEATURE_REQUEST">✨ Usulan Fitur Baru / Konsultasi Bisnis</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 mb-1">Deskripsi Detail Kendala</label>
              <textarea
                name="message"
                required
                rows={4}
                placeholder="Jelaskan kendala yang dialami secara singkat (misal: Printer Bluetooth tidak mau pairing setelah update Android...)"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 active:scale-95 transition-all text-xs"
            >
              <Send size={14} />
              <span>Kirim Tiket ke Tim Support</span>
            </button>
          </form>
        </div>

        {/* Kolom Kanan: FAQ & Solusi Cepat */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2">
            <HelpCircle size={18} className="text-amber-500" />
            <h4 className="text-sm font-bold text-slate-800">Panduan Mandiri Solusi Cepat</h4>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-1.5">
              <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500" />
                Printer Bluetooth Tidak Merespons?
              </h5>
              <p className="text-slate-500 leading-relaxed">
                Pastikan Bluetooth di tablet menyala. Masuk ke menu <strong>Pengaturan &gt; Printer Bluetooth</strong>, lalu klik <strong>"Scan &amp; Pair Perangkat"</strong>. Jika masih gagal, restart printer thermal selama 5 detik.
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-1.5">
              <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500" />
                Internet {isBengkel ? 'Bengkel' : 'Kafe'} Putus Tiba-Tiba?
              </h5>
              <p className="text-slate-500 leading-relaxed">
                Tenang! POS otomatis beralih ke <strong>Mode Offline</strong>. Anda tetap bisa melayani {isBengkel ? 'SPK servis & cetak struk' : 'pesanan kasir & mencetak struk'}. Data otomatis tersinkronisasi kembali saat internet online.
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-1.5">
              <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500" />
                QRIS Dinamis Tidak Muncul?
              </h5>
              <p className="text-slate-500 leading-relaxed">
                Pastikan Server Key Midtrans sudah dimasukkan di menu <strong>Metode Pembayaran</strong>, atau gunakan upload gambar QRIS Statis BCA/GoPay sebagai metode pembayaran alternatif.
              </p>
            </div>

            <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-1">
              <span className="font-bold text-indigo-900 block">📞 Hotline Darurat CS 24 Jam</span>
              <p className="text-indigo-700">
                Email: <span className="font-mono font-bold">support@codenusa.id</span><br />
                Telepon / WhatsApp: <span className="font-mono font-bold">+62 812-9876-5432</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsSupportPanel;
