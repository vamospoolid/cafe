import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, ZapOff } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

const BarcodeScannerModal: React.FC<BarcodeScannerProps> = ({ onDetected, onClose }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const divId = 'barcode-scanner-viewport';

  useEffect(() => {
    let mounted = true;
    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(divId, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: { ideal: 'environment' } },
          { fps: 15, qrbox: { width: 260, height: 140 }, aspectRatio: 1.7 },
          (decodedText: string) => {
            if (!mounted) return;
            if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
            onDetected(decodedText);
          },
          (_err: any) => {}
        );
        if (mounted) setIsStarting(false);
      } catch (err: any) {
        if (mounted) {
          setError(
            String(err?.message || '').includes('Permission')
              ? 'Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser.'
              : 'Gagal membuka kamera. Pastikan perangkat memiliki kamera.'
          );
          setIsStarting(false);
        }
      }
    };
    startScanner();
    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);

  const cornerClasses = [
    'top-0 left-0 border-t-2 border-l-2 rounded-tl-xl',
    'top-0 right-0 border-t-2 border-r-2 rounded-tr-xl',
    'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl',
    'bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl',
  ];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 bg-black/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
            <Camera size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Scan Barcode Produk</p>
            <p className="text-white/50 text-[11px]">Arahkan kamera ke barcode atau QR</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <X size={18} className="text-white" />
        </button>
      </div>

      {/* Camera viewport */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <div id={divId} className="w-full h-full" />

        {/* Loading */}
        {isStarting && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-3">
            <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-white/70 text-sm">Membuka kamera...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-4 px-8">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center">
              <ZapOff size={32} className="text-red-400" />
            </div>
            <p className="text-white text-center text-sm font-medium leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-white text-slate-900 rounded-xl font-bold text-sm"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Scan overlay */}
        {!isStarting && !error && (
          <>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 300px 160px at center, transparent 0%, rgba(0,0,0,0.65) 100%)' }}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative" style={{ width: 268, height: 148 }}>
                {cornerClasses.map((cls, i) => (
                  <div key={i} className={'absolute w-7 h-7 border-white/90 ' + cls} />
                ))}
                <div
                  className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent rounded-full"
                  style={{
                    animation: 'scanLine 2s ease-in-out infinite',
                    boxShadow: '0 0 8px rgba(52,211,153,0.8)'
                  }}
                />
              </div>
            </div>
            <div className="absolute bottom-8 left-4 right-4 flex flex-col items-center">
              <p className="text-white/80 text-xs text-center bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
                EAN-13, CODE-128, QR Code, dan format lainnya didukung
              </p>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes scanLine {
          0%   { top: 8px;              opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: calc(100% - 8px); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default BarcodeScannerModal;
