import React, { useState } from 'react';
import { 
  MessageSquare, 
  Send, 
  ExternalLink, 
  X, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Shirt, 
  Calendar,
  Sparkles,
  Phone
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { toast } from '../../utils/alert';

export interface RentalOrderReminderTarget {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  returnDeadline: string;
  pickupDate?: string;
  status: string;
  totalAmount?: number;
  depositAmount?: number;
  attireSummary?: string;
  items?: Array<{ attireName: string }>;
}

interface RentalSendReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: RentalOrderReminderTarget | null;
  onSuccess?: () => void;
}

export const RentalSendReminderModal: React.FC<RentalSendReminderModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccess
}) => {
  const { token, settings } = usePOS();
  const [reminderType, setReminderType] = useState<'AUTO' | 'DUE_TODAY' | 'DUE_H1' | 'OVERDUE' | 'PICKUP'>('AUTO');
  const [sending, setSending] = useState(false);

  if (!isOpen || !order) return null;

  const cleanPhone = order.customerPhone ? order.customerPhone.replace(/[^0-9]/g, '') : '';
  const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
  const storeName = settings?.storeName || 'Butik Sewa Busana';
  const storeAddress = settings?.address || '';
  const attireSummary = order.attireSummary || (order.items && order.items.length > 0 ? order.items.map(i => i.attireName).join(', ') : 'Set Busana Adat');

  const deadline = new Date(order.returnDeadline);
  const now = new Date();
  const isOverdue = deadline < now;
  const diffDays = Math.max(1, Math.ceil((now.getTime() - deadline.getTime()) / (24 * 60 * 60 * 1000)));

  // Generate preview message based on selected type
  const getPreviewMessage = () => {
    let effectiveType = reminderType;
    if (effectiveType === 'AUTO') {
      if (order.status === 'BOOKED' || order.status === 'FITTING') {
        effectiveType = 'PICKUP';
      } else if (isOverdue) {
        effectiveType = 'OVERDUE';
      } else {
        effectiveType = 'DUE_H1';
      }
    }

    const deadlineStr = deadline.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    if (effectiveType === 'OVERDUE') {
      const estimatedFee = diffDays * 50000;
      return `🚨 *PEMBERITAHUAN KETERLAMBATAN PENGEMBALIAN BUSANA*\n\n` +
        `Kepada Yth. Kak *${order.customerName}*,\n` +
        `Sistem kami mencatat bahwa busana sewa Anda di *${storeName}* telah *MELEWATI BATAS WAKTU PENGEMBALIAN*:\n\n` +
        `• No. Kontrak: *#${order.orderNumber}*\n` +
        `• Busana: *${attireSummary}*\n` +
        `• Jadwal Kembali: *${deadlineStr}*\n` +
        `• Keterlambatan: *${diffDays} Hari*\n` +
        `• Akumulasi Denda: *Rp ${estimatedFee.toLocaleString('id-ID')}*\n\n` +
        `Mohon kerjasamanya untuk segera mengembalikan busana dan aksesoris hari ini agar tidak terjadi penambahan denda harian serta tidak mengganggu jadwal sewa pelanggan lain berikutnya.\n\n` +
        `Silakan konfirmasi waktu kedatangan Anda dengan membalas pesan ini.\n\n` +
        `Hormat kami,\n*${storeName}*`;
    }

    if (effectiveType === 'PICKUP') {
      const pickupDateStr = order.pickupDate 
        ? new Date(order.pickupDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
        : 'Sesuai Jadwal';

      return `Halo Kak *${order.customerName}*,\n` +
        `Pengingat ramah dari *${storeName}*:\n` +
        `Busana sewa pesanan Anda (*#${order.orderNumber}* - ${attireSummary}) dijadwalkan dapat *DIAMBIL* (${pickupDateStr}). ✨\n\n` +
        `Silakan bawa identitas jaminan (KTP/SIM asli) dan sisa pelunasan saat pengambilan.\n\n` +
        (storeAddress ? `📍 Alamat Butik: ${storeAddress}\n\n` : '') +
        `Terima kasih! Kami tunggu kedatangannya. 🙏`;
    }

    const timingLabel = effectiveType === 'DUE_TODAY' ? 'HARI INI' : 'BESOK';
    return `Halo Kak *${order.customerName}*,\n` +
      `Semoga acara bahagianya berjalan lancar dan berkesan! ✨\n\n` +
      `Kami dari *${storeName}* ingin menginfokan bahwa masa sewa busana adat Anda dijadwalkan berakhir *${timingLabel}*:\n\n` +
      `📋 *Rincian Sewa Busana*:\n` +
      `• No. Kontrak: *#${order.orderNumber}*\n` +
      `• Busana: *${attireSummary}*\n` +
      `• Batas Pengembalian: *${deadlineStr}*\n\n` +
      `⚠️ *Catatan Penting Pengembalian*:\n` +
      `1. Pastikan seluruh kelengkapan aksesoris (saloko/mahkota, bando, keris, gelang, selempang, dll) telah lengkap di dalam tas busana.\n` +
      `2. Pakaian *TIDAK PERLU DICUCI* oleh penyewa (sudah termasuk perawatan cuci profesional dari butik kami).\n` +
      `3. Pengembalian tepat waktu akan membebaskan Anda dari denda keterlambatan harian dan uang jaminan (*deposit*) dapat langsung direfund penuh.\n\n` +
      (storeAddress ? `📍 *Alamat Butik*: ${storeAddress}\n\n` : '') +
      `Jika ada kendala terkait pengembalian, silakan balas pesan WhatsApp ini.\n` +
      `Terima kasih! 🙏\n*${storeName}*`;
  };

  const handleSendViaGateway = async () => {
    if (!order.customerPhone) {
      toast('Nomor WhatsApp pelanggan belum terdaftar pada pesanan ini.', 'error');
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/rental/orders/${order.id}/send-reminder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reminderType })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim pengingat sewa.');
      }

      toast(data.message || 'Pesan pengingat berhasil dikirim!', 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[RentalSendReminderModal] Send error:', err);
      toast(err.message || 'Gagal mengirim WhatsApp.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleOpenWAWeb = () => {
    if (!formattedPhone) {
      toast('Nomor WhatsApp pelanggan tidak tersedia.', 'error');
      return;
    }
    const msg = getPreviewMessage();
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <MessageSquare className="text-emerald-100" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white tracking-tight flex items-center gap-2">
                Kirim Pengingat WhatsApp
              </h3>
              <p className="text-xs text-emerald-100 font-medium">
                Kontrak #{order.orderNumber} • {order.customerName}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          
          {/* Order Snapshot */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Pelanggan:</span>
              <span className="font-bold text-slate-800 flex items-center gap-1">
                {order.customerName}
                {order.customerPhone && (
                  <span className="font-mono text-slate-500">({order.customerPhone})</span>
                )}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Busana:</span>
              <span className="font-semibold text-slate-700 truncate max-w-[240px]">{attireSummary}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Batas Kembali:</span>
              <span className={`font-bold ${isOverdue ? 'text-rose-600' : 'text-amber-700'}`}>
                {deadline.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                {isOverdue && ` (${diffDays} hari terlambat)`}
              </span>
            </div>
          </div>

          {/* Type Selector */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">Pilih Jenis Pesan:</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { key: 'AUTO', label: '⚡ Otomatis Pintar', desc: 'Sesuai deadline & status' },
                { key: 'DUE_H1', label: '⏰ Jatuh Tempo H-1', desc: 'Pengingat besok kembali' },
                { key: 'DUE_TODAY', label: '📅 Jatuh Tempo Hari-H', desc: 'Pengingat kembali hari ini' },
                { key: 'OVERDUE', label: '🚨 Overdue (Denda)', desc: 'Peringatan keterlambatan' },
                { key: 'PICKUP', label: '📦 Jadwal Ambil', desc: 'Pengingat ambil pesanan' },
              ].map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setReminderType(opt.key as any)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    reminderType === opt.key
                      ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-bold ring-2 ring-emerald-200'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <p className="text-xs font-bold">{opt.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Pratinjau Pesan WhatsApp:</label>
            <div className="p-3 bg-emerald-900/5 border border-emerald-200/60 rounded-2xl text-[11px] font-mono text-slate-800 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto select-all">
              {getPreviewMessage()}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleOpenWAWeb}
            className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <ExternalLink size={14} />
            Buka WA Web / App
          </button>
          <button
            type="button"
            disabled={sending || !order.customerPhone}
            onClick={handleSendViaGateway}
            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-200 transition-all cursor-pointer"
          >
            {sending ? (
              <span className="flex items-center gap-1">Mengirim...</span>
            ) : (
              <>
                <Send size={14} />
                Kirim via Gateway Butik
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default RentalSendReminderModal;
