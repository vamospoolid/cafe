import React, { useState } from 'react';
import { X, Fingerprint, LogIn, LogOut, CheckCircle2, AlertTriangle, Delete } from 'lucide-react';

interface ClockInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ClockInModal: React.FC<ClockInModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [pin, setPin] = useState('');
  const [statusMsg, setStatusMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleNumpad = (num: string) => {
    if (pin.length < 6 && !loading) {
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

  const processAttendance = async (type: 'IN' | 'OUT') => {
    if (pin.length < 4) {
      setStatusMsg({ type: 'error', text: 'PIN minimal 4 digit!' });
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch('/api/attendance/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, type })
      });
      const data = await res.json();
      
      if (res.ok) {
        setStatusMsg({ type: 'success', text: data.message });
        setTimeout(() => {
          setPin('');
          setStatusMsg(null);
          setLoading(false);
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Gagal melakukan absensi' });
        setLoading(false);
        setPin(''); // Reset on error for retry
      }
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Terjadi kesalahan jaringan' });
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Area */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-6 relative flex flex-col items-center justify-center text-center">
          <button 
            type="button"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors" 
            onClick={onClose} 
            disabled={loading}
          >
            <X size={18} />
          </button>
          
          <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
            <Fingerprint size={30} className="text-indigo-200" />
          </div>
          
          <h2 className="text-lg font-black tracking-tight">Terminal Absensi Staf</h2>
          <p className="text-xs text-indigo-200 mt-0.5">Ketik 6-Digit PIN Anda untuk Masuk / Pulang</p>
        </div>

        {/* PIN Display */}
        <div className="p-6 bg-slate-50 flex flex-col items-center">
          <div className="flex gap-2.5 mb-5 justify-center">
            {[...Array(6)].map((_, i) => (
              <div 
                key={i} 
                className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                  i < pin.length ? 'bg-indigo-600 shadow-md scale-110' : 'bg-slate-300'
                }`}
              />
            ))}
          </div>

          {statusMsg && (
            <div className={`text-xs font-black p-3 rounded-xl w-full text-center mb-4 flex items-center justify-center gap-2 ${
              statusMsg.type === 'success' 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2.5 w-full max-w-[240px] mx-auto mb-5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button 
                key={num} 
                className="w-14 h-14 rounded-2xl bg-white border border-slate-200/80 text-xl font-black text-slate-800 flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 active:scale-95 transition-all shadow-sm mx-auto disabled:opacity-50"
                onClick={() => handleNumpad(num.toString())}
                disabled={loading}
              >
                {num}
              </button>
            ))}
            <button 
              className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 font-black flex items-center justify-center hover:bg-rose-100 active:scale-95 transition-all mx-auto disabled:opacity-50"
              onClick={handleBackspace}
              disabled={loading}
              title="Hapus"
            >
              <Delete size={18} />
            </button>
            <button 
              className="w-14 h-14 rounded-2xl bg-white border border-slate-200/80 text-xl font-black text-slate-800 flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 active:scale-95 transition-all shadow-sm mx-auto disabled:opacity-50"
              onClick={() => handleNumpad('0')}
              disabled={loading}
            >
              0
            </button>
            <button 
              className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 font-black flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all mx-auto text-xs uppercase tracking-wider disabled:opacity-50"
              onClick={() => {if(!loading) setPin('')}}
              disabled={loading}
            >
              C
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex w-full gap-2.5">
            <button 
              className="flex-1 py-3 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
              disabled={pin.length < 4 || loading}
              onClick={() => processAttendance('IN')}
            >
              <LogIn size={16} />
              MASUK (IN)
            </button>
            <button 
              className="flex-1 py-3 px-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-rose-500/20 disabled:opacity-50"
              disabled={pin.length < 4 || loading}
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
