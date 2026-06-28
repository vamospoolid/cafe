import React, { useState } from 'react';
import { X, Fingerprint, LogIn, LogOut, CheckCircle, AlertTriangle } from 'lucide-react';

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
        }, 2000);
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Gagal absensi' });
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
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-content" style={{ maxWidth: '400px', padding: 0, overflow: 'hidden' }}>
        
        {/* Header Area */}
        <div className="bg-primary text-white p-6 relative flex flex-col items-center justify-center text-center">
          <button className="absolute top-4 right-4 text-white hover:text-gray-200" onClick={onClose} disabled={loading}>
            <X size={24} />
          </button>
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3">
            <Fingerprint size={32} />
          </div>
          <h2 className="text-xl font-bold mb-1">Terminal Absensi</h2>
          <p className="text-sm text-primary-100 opacity-80">Masukkan PIN 6-Digit Anda (Default: 123456)</p>
        </div>

        {/* PIN Display */}
        <div className="p-6 bg-slate-50 flex flex-col items-center">
          <div className="flex gap-3 mb-6 justify-center">
            {[...Array(6)].map((_, i) => (
              <div 
                key={i} 
                className={`w-4 h-4 rounded-full ${i < pin.length ? 'bg-primary shadow-md scale-110' : 'bg-gray-300'}`}
                style={{ transition: 'all 0.2s' }}
              />
            ))}
          </div>

          {statusMsg && (
            <div className={`text-sm font-bold p-3 rounded-lg w-full text-center mb-4 flex items-center justify-center gap-2 ${
              statusMsg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {statusMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              {statusMsg.text}
            </div>
          )}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[250px] mx-auto mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button 
                key={num} 
                className="w-16 h-16 rounded-full bg-white border border-gray-200 text-2xl font-bold text-gray-800 flex items-center justify-center hover:bg-primary hover:text-white hover:border-primary transition-colors shadow-sm mx-auto disabled:opacity-50"
                onClick={() => handleNumpad(num.toString())}
                disabled={loading}
              >
                {num}
              </button>
            ))}
            <button 
              className="w-16 h-16 rounded-full bg-red-50 text-danger border border-red-100 font-bold flex items-center justify-center hover:bg-red-100 transition-colors mx-auto disabled:opacity-50"
              onClick={handleBackspace}
              disabled={loading}
            >
              Hapus
            </button>
            <button 
              className="w-16 h-16 rounded-full bg-white border border-gray-200 text-2xl font-bold text-gray-800 flex items-center justify-center hover:bg-primary hover:text-white hover:border-primary transition-colors shadow-sm mx-auto disabled:opacity-50"
              onClick={() => handleNumpad('0')}
              disabled={loading}
            >
              0
            </button>
            <button 
              className="w-16 h-16 rounded-full bg-gray-100 text-gray-500 font-bold flex items-center justify-center hover:bg-gray-200 transition-colors mx-auto text-xs disabled:opacity-50"
              onClick={() => {if(!loading) setPin('')}}
              disabled={loading}
            >
              Clear
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex w-full gap-3">
            <button 
              className="flex-1 py-3 px-4 bg-success text-white rounded-xl font-bold flex flex-col items-center justify-center hover:bg-green-600 transition-colors shadow-sm disabled:opacity-50"
              disabled={pin.length < 4 || loading}
              onClick={() => processAttendance('IN')}
            >
              <LogIn size={20} className="mb-1" />
              CLOCK IN
            </button>
            <button 
              className="flex-1 py-3 px-4 bg-danger text-white rounded-xl font-bold flex flex-col items-center justify-center hover:bg-red-600 transition-colors shadow-sm disabled:opacity-50"
              disabled={pin.length < 4 || loading}
              onClick={() => processAttendance('OUT')}
            >
              <LogOut size={20} className="mb-1" />
              CLOCK OUT
            </button>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default ClockInModal;
