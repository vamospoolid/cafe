import React, { useState, useEffect, useRef } from 'react';
import { X, Fingerprint, LogIn, LogOut, CheckCircle2, AlertTriangle, Delete, ScanLine } from 'lucide-react';
import { playScannerBeep } from '../utils/hardwareBarcodeListener';

interface ClockInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ClockInModal: React.FC<ClockInModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [pin, setPin] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Barcode scanner keystroke buffer ref
  const barcodeBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  // Handle Physical Keyboard & Barcode Scanner Keystrokes
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if modifier keys (Ctrl/Alt/Meta) are active
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      const interval = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Escape to close
      if (e.key === 'Escape' && !loading) {
        onClose();
        return;
      }

      // Fast typing from barcode scanner (< 50ms between keys)
      if (e.key === 'Enter') {
        const bufferedBarcode = barcodeBufferRef.current.trim();
        barcodeBufferRef.current = '';

        if (bufferedBarcode.length >= 3) {
          e.preventDefault();
          playScannerBeep(true);
          setPin(bufferedBarcode);
          processAttendance('IN', bufferedBarcode);
          return;
        }

        // If human pressed Enter with manual PIN
        if (pin.length >= 4 && !loading) {
          e.preventDefault();
          processAttendance('IN', pin);
          return;
        }
      }

      // Track barcode buffer
      if (e.key.length === 1) {
        if (interval > 100) {
          barcodeBufferRef.current = e.key;
        } else {
          barcodeBufferRef.current += e.key;
        }
      }

      // Direct Numpad / Digits from human keyboard
      if (/^[0-9]$/.test(e.key) && !loading) {
        setPin(prev => (prev.length < 10 ? prev + e.key : prev));
        setStatusMsg(null);
      } else if (e.key === 'Backspace' && !loading) {
        setPin(prev => prev.slice(0, -1));
        setStatusMsg(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, pin, loading]);

  if (!isOpen) return null;

  const handleNumpad = (num: string) => {
    if (pin.length < 10 && !loading) {
      setPin(prev => prev + num);
      setStatusMsg(null);
    }
  };

  const handleBackspace = () => {
    if (!loading) {
      setPin(prev => prev.slice(0, -1));
      setStatusMsg(null);
    }
  };

  const processAttendance = async (type: 'IN' | 'OUT', overrideCode?: string) => {
    const codeToSend = overrideCode || pin;
    if (codeToSend.length < 3) {
      setStatusMsg({ type: 'error', text: 'PIN atau Barcode minimal 3-4 digit!' });
      playScannerBeep(false);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('staff_token') || sessionStorage.getItem('token');
      const tenantId = localStorage.getItem('tenantId') || localStorage.getItem('activeTenantId') || sessionStorage.getItem('tenantId');

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (tenantId) headers['x-tenant-id'] = tenantId;

      const res = await fetch('/api/attendance/clock', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pin: codeToSend,
          code: codeToSend,
          type,
          ...(tenantId ? { tenantId } : {})
        })
      });
      const data = await res.json();

      if (res.ok) {
        playScannerBeep(true);
        setStatusMsg({ type: 'success', text: data.message });
        setTimeout(() => {
          setPin('');
          setStatusMsg(null);
          setLoading(false);
          onSuccess();
          onClose();
        }, 1200);
      } else {
        playScannerBeep(false);
        setStatusMsg({ type: 'error', text: data.error || 'Gagal melakukan absensi' });
        setLoading(false);
        setPin(''); // Reset on error for retry
      }
    } catch (err) {
      console.error(err);
      playScannerBeep(false);
      setStatusMsg({ type: 'error', text: 'Terjadi kesalahan sistem atau koneksi' });
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header Area */}
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 text-white p-5 sm:p-6 relative flex flex-col items-center justify-center text-center">
          <button
            type="button"
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors active:scale-95"
            onClick={onClose}
            disabled={loading}
          >
            <X size={18} />
          </button>

          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/15 rounded-2xl flex items-center justify-center mb-2.5 shadow-inner">
            <Fingerprint size={28} className="text-indigo-200" />
          </div>

          <h2 className="text-base sm:text-lg font-black tracking-tight">Terminal Absensi Staf</h2>
          <p className="text-[11px] sm:text-xs text-indigo-200 mt-0.5">
            Ketik PIN atau Scan Kartu Barcode Staf
          </p>

          <div className="mt-2.5 flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full border border-white/15 text-[10px] text-indigo-100 font-medium">
            <ScanLine size={12} className="text-emerald-300 animate-pulse" />
            <span>Scanner Barcode Hardware Siap</span>
          </div>
        </div>

        {/* PIN Display & Numpad */}
        <div className="p-4 sm:p-6 bg-slate-50 flex flex-col items-center">
          {/* PIN Bullet Dots / Text Display */}
          <div className="flex gap-2.5 mb-4 sm:mb-5 justify-center items-center min-h-[24px]">
            {pin.length <= 6 ? (
              [...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                    i < pin.length ? 'bg-indigo-600 shadow-md scale-110' : 'bg-slate-300'
                  }`}
                />
              ))
            ) : (
              <span className="font-mono text-sm font-bold tracking-widest text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200">
                {pin.slice(0, 12)}
              </span>
            )}
          </div>

          {statusMsg && (
            <div
              className={`text-xs font-black p-2.5 sm:p-3 rounded-xl w-full text-center mb-3.5 flex items-center justify-center gap-2 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5 w-full max-w-[240px] mx-auto mb-4 sm:mb-5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                type="button"
                className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200/80 text-xl font-black text-slate-800 flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 active:scale-95 transition-all shadow-sm mx-auto disabled:opacity-50"
                onClick={() => handleNumpad(num.toString())}
                disabled={loading}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 font-black flex items-center justify-center hover:bg-rose-100 active:scale-95 transition-all mx-auto disabled:opacity-50"
              onClick={handleBackspace}
              disabled={loading}
              title="Hapus"
            >
              <Delete size={18} />
            </button>
            <button
              type="button"
              className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200/80 text-xl font-black text-slate-800 flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 active:scale-95 transition-all shadow-sm mx-auto disabled:opacity-50"
              onClick={() => handleNumpad('0')}
              disabled={loading}
            >
              0
            </button>
            <button
              type="button"
              className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-slate-100 text-slate-500 font-black flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all mx-auto text-xs uppercase tracking-wider disabled:opacity-50"
              onClick={() => {
                if (!loading) setPin('');
              }}
              disabled={loading}
            >
              C
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex w-full gap-2 sm:gap-2.5">
            <button
              type="button"
              className="flex-1 py-3 px-2 sm:px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
              disabled={pin.length < 3 || loading}
              onClick={() => processAttendance('IN')}
            >
              <LogIn size={16} />
              MASUK (IN)
            </button>
            <button
              type="button"
              className="flex-1 py-3 px-2 sm:px-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-rose-500/20 disabled:opacity-50 cursor-pointer"
              disabled={pin.length < 3 || loading}
              onClick={() => processAttendance('OUT')}
            >
              <LogOut size={16} />
              PULANG (OUT)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClockInModal;
