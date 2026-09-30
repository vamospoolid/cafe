import React from 'react';
import { Printer, BluetoothOff, BluetoothSearching, BluetoothConnected } from 'lucide-react';
import { usePrinter } from '../../context/PrinterContext';

/**
 * Badge status printer yang muncul di header/toolbar POSView.
 * Klik untuk reconnect jika terputus.
 */
export const PrinterStatusBadge: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  const { status, printerInfo, reconnect } = usePrinter();

  const handleClick = () => {
    if (onClick) onClick();
    if (status === 'disconnected' || status === 'error') {
      reconnect();
    }
  };

  if (status === 'idle') {
    // Printer belum dikonfigurasi — tampilkan ikon kecil abu-abu saja
    return (
      <button
        type="button"
        title="Printer belum dikonfigurasi — klik untuk ke Pengaturan"
        onClick={onClick}
        className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
      >
        <Printer size={17} />
      </button>
    );
  }

  const configs = {
    connected: {
      icon: <BluetoothConnected size={14} />,
      label: printerInfo?.name?.split('_')[0] || 'Printer',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
      dot: 'bg-emerald-500 animate-pulse',
    },
    printing: {
      icon: <Printer size={14} className="animate-bounce" />,
      label: 'Mencetak...',
      cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      dot: 'bg-indigo-500 animate-pulse',
    },
    connecting: {
      icon: <BluetoothSearching size={14} className="animate-pulse" />,
      label: 'Menghubungkan...',
      cls: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-400 animate-spin',
    },
    disconnected: {
      icon: <BluetoothOff size={14} />,
      label: 'Printer Offline',
      cls: 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 cursor-pointer',
      dot: 'bg-slate-400',
    },
    error: {
      icon: <BluetoothOff size={14} />,
      label: 'Printer Error',
      cls: 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 cursor-pointer',
      dot: 'bg-rose-500',
    },
  };

  const cfg = configs[status as keyof typeof configs] || configs.disconnected;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={
        status === 'connected'
          ? `${printerInfo?.brand || 'Printer'} — ${printerInfo?.paperWidth || 58}mm`
          : status === 'disconnected' || status === 'error'
          ? 'Klik untuk reconnect'
          : cfg.label
      }
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all ${cfg.cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.icon}
      <span className="hidden sm:inline">{cfg.label}</span>
    </button>
  );
};

export default PrinterStatusBadge;
