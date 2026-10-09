import React, { useState, useEffect } from 'react';
import { 
  X, Phone, Send, Copy, Check, Droplets, Calendar, Clock, 
  Car, Bike, AlertCircle, MessageCircle, ExternalLink, Sparkles
} from 'lucide-react';
import { toast } from '../../utils/alert';

interface OilReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: any;
  token: string | null;
  storeName?: string;
  defaultIntervalMonths?: number;
}

export const OilReminderModal: React.FC<OilReminderModalProps> = ({
  isOpen,
  onClose,
  vehicle,
  token,
  storeName = 'Bengkel Kami',
  defaultIntervalMonths = 2
}) => {
  const [intervalMonths, setIntervalMonths] = useState<number>(defaultIntervalMonths);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [sendingGateway, setSendingGateway] = useState<boolean>(false);

  const plateNumber = vehicle?.plateNumber || vehicle?.vehiclePlate || '';
  const brand = vehicle?.brand || vehicle?.vehicleBrand || '';
  const model = vehicle?.model || vehicle?.vehicleModel || '';
  const vehicleDesc = [brand, model].filter(Boolean).join(' ');
  const isMotor = (vehicle?.vehicleType || 'MOTOR').toUpperCase() === 'MOTOR';

  // Extract last service date
  const lastServiceDateRaw = vehicle?.lastService?.date || vehicle?.workOrders?.[0]?.createdAt || vehicle?.oilReminder?.lastServiceDate || null;
  const lastDateFormatted = lastServiceDateRaw 
    ? new Date(lastServiceDateRaw).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Servis Terakhir';

  const daysSince = vehicle?.oilReminder?.daysSince ?? (
    lastServiceDateRaw 
      ? Math.max(0, Math.floor((Date.now() - new Date(lastServiceDateRaw).getTime()) / (1000 * 60 * 60 * 24)))
      : null
  );

  const lastOilPart = vehicle?.lastService?.oilPart || vehicle?.oilReminder?.lastOilPart || null;

  // Generate Message Template
  const generateTemplate = (name: string, interval: number) => {
    const custName = name.trim() || 'Pelanggan';
    const approxMonths = daysSince !== null ? Math.round(daysSince / 30) : interval;

    return (
      `Halo Kak *${custName}*, salam dari *${storeName}*! 🙏\n\n` +
      `Kami ingin menginfokan bahwa kendaraan Anda dengan Plat Nomor *${plateNumber}*${vehicleDesc ? ` (${vehicleDesc})` : ''} sudah waktunya untuk *Ganti Oli & Servis Berkala* nih. 🛵💨\n\n` +
      `📋 *Catatan Servis Sebelumnya*:\n` +
      `• Servis Terakhir: *${lastDateFormatted}*` + (daysSince !== null ? ` (sekitar ${daysSince} hari / ${approxMonths} bulan lalu)\n` : '\n') +
      (lastOilPart ? `• Oli Terakhir: *${lastOilPart}*\n` : '') +
      `• Rekomendasi Siklus: Rutin setiap *${interval} Bulan*\n\n` +
      `Ganti oli tepat waktu menjaga performa mesin tetap dingin, tarikan enteng, dan konsumsi bensin lebih hemat.\n\n` +
      `Yuk mampir ke *${storeName}* untuk servis dan ganti oli berkualitas! Kakak bisa balas pesan ini untuk reservasi antrean ya. Terima kasih! 🙏`
    );
  };

  // Sync initial fields on modal open
  useEffect(() => {
    if (isOpen && vehicle) {
      const initialName = vehicle?.customer?.name || vehicle?.customerName || '';
      const rawPhone = vehicle?.customer?.phone || vehicle?.customerPhone || '';
      const cleanPhone = rawPhone.startsWith('WALKIN-') ? '' : rawPhone;

      setCustomerName(initialName);
      setCustomerPhone(cleanPhone);
      setIntervalMonths(defaultIntervalMonths);
      setCustomMessage(generateTemplate(initialName, defaultIntervalMonths));
      setCopied(false);
    }
  }, [isOpen, vehicle, defaultIntervalMonths, storeName]);

  // Update message when interval or customer name changes
  const handleIntervalChange = (newInterval: number) => {
    setIntervalMonths(newInterval);
    setCustomMessage(generateTemplate(customerName, newInterval));
  };

  const handleNameChange = (newName: string) => {
    setCustomerName(newName);
    setCustomMessage(generateTemplate(newName, intervalMonths));
  };

  if (!isOpen || !vehicle) return null;

  // Clean phone number for wa.me
  const cleanDigits = customerPhone.replace(/[^0-9]/g, '');
  const internationalPhone = cleanDigits.startsWith('0') 
    ? '62' + cleanDigits.slice(1) 
    : cleanDigits.startsWith('62') 
    ? cleanDigits 
    : cleanDigits.startsWith('8') 
    ? '62' + cleanDigits 
    : cleanDigits;

  const waLink = internationalPhone
    ? `https://wa.me/${internationalPhone}?text=${encodeURIComponent(customMessage)}`
    : null;

  // Copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(customMessage);
    setCopied(true);
    toast('Pesan berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  // Send via Gateway API
  const handleSendGateway = async () => {
    if (!token) return;
    if (!internationalPhone) {
      toast('Nomor WhatsApp pelanggan belum diisi!', 'warning');
      return;
    }

    setSendingGateway(true);
    try {
      const res = await fetch('/api/bengkel/vehicles/send-oil-reminder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          vehiclePlate: plateNumber,
          intervalMonths,
          customerName: customerName.trim(),
          customerPhone: internationalPhone,
          customMessage
        })
      });

      const data = await res.json();
      if (res.ok) {
        if (data.gatewaySent) {
          toast('✅ Pengingat ganti oli berhasil dikirim via WhatsApp Gateway!', 'success');
        } else {
          toast('Gateway belum terhubung. Membuka WhatsApp Web langsung...', 'info');
          if (data.waLink) window.open(data.waLink, '_blank');
        }
        onClose();
      } else {
        toast(data.error || 'Gagal mengirim pengingat', 'error');
      }
    } catch (e: any) {
      toast(e.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setSendingGateway(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in slide-in-from-bottom duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-purple-950 flex items-center justify-center font-black shadow-md">
              <Droplets size={20} />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base flex items-center gap-1.5">
                <span>Pengingat Ganti Oli via WA</span>
                <Sparkles size={14} className="text-amber-300" />
              </h3>
              <p className="text-[11px] text-purple-200">Kirim pesan ramah untuk ajak pelanggan servis berkala</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Target Vehicle Banner */}
          <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="bg-white text-slate-900 font-mono font-black text-xs px-2.5 py-1 rounded-lg border border-purple-200 shadow-2xs">
                {plateNumber}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">
                  {vehicleDesc || (isMotor ? 'Sepeda Motor' : 'Mobil')}
                </div>
                <div className="text-[10px] text-slate-500">
                  Terakhir servis: <span className="font-semibold text-purple-900">{lastDateFormatted}</span>
                  {daysSince !== null && ` (${daysSince} hari lalu)`}
                </div>
              </div>
            </div>

            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
              daysSince !== null && daysSince >= 60
                ? 'bg-rose-100 text-rose-800 border-rose-200'
                : 'bg-amber-100 text-amber-800 border-amber-200'
            }`}>
              {daysSince !== null && daysSince >= 60 ? 'Waktunya Servis' : 'Segera Servis'}
            </span>
          </div>

          {/* Form Inputs: Customer Name, Phone, and Interval Choice */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Nama Pelanggan
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Nama Pelanggan..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-purple-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Nomor WhatsApp
                </label>
                <div className="relative">
                  <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0812xxxxxx"
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-purple-500 focus:bg-white transition font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Interval Cycle Selection (2 Bulan vs 3 Bulan) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                Rekomendasi Siklus Interval Ganti Oli:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleIntervalChange(2)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    intervalMonths === 2
                      ? 'bg-purple-700 text-white border-purple-700 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Clock size={13} />
                  <span>2 Bulan Sekali (Motor Harian)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleIntervalChange(3)}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    intervalMonths === 3
                      ? 'bg-purple-700 text-white border-purple-700 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Clock size={13} />
                  <span>3 Bulan Sekali (Mobil / Santai)</span>
                </button>
              </div>
            </div>

            {/* Textarea: Custom Message / Preview */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <MessageCircle size={12} className="text-purple-600" />
                  <span>Pratinjau Pesan WhatsApp</span>
                </label>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-[11px] text-purple-700 hover:text-purple-900 font-bold flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  <span>{copied ? 'Tersalin' : 'Salin Pesan'}</span>
                </button>
              </div>
              <textarea
                rows={7}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-purple-500 focus:bg-white transition leading-relaxed"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Anda dapat mengedit teks pesan di atas sebelum mengirimkannya ke pelanggan.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white text-xs font-bold transition cursor-pointer"
          >
            Tutup
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Direct WhatsApp Web / Mobile Link Button */}
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                onClick={onClose}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs shadow-md transition cursor-pointer"
              >
                <Phone size={14} />
                <span>Buka di WhatsApp (wa.me)</span>
                <ExternalLink size={12} />
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-200 text-slate-400 font-bold text-xs cursor-not-allowed"
                title="Isi nomor WhatsApp terlebih dahulu"
              >
                <Phone size={14} />
                <span>WhatsApp (Isi No HP)</span>
              </button>
            )}

            {/* Gateway Automatic Send Button */}
            <button
              type="button"
              onClick={handleSendGateway}
              disabled={sendingGateway || !internationalPhone}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 active:scale-95 text-white font-black text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              <Send size={14} />
              <span>{sendingGateway ? 'Mengirim...' : 'Kirim via Gateway'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OilReminderModal;
