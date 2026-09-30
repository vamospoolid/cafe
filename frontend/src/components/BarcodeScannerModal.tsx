import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, ZapOff, ImageUp, CheckCircle, Scan, Keyboard, Flashlight, ArrowRight } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

// ID unik container scanner live
const SCANNER_DIV_ID = 'barcode-scanner-live-viewport';
const FILE_SCANNER_DIV_ID = 'barcode-file-scanner-temp';

const BarcodeScannerModal: React.FC<BarcodeScannerProps> = ({ onDetected, onClose }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);

  // Tabs mode: 'camera' | 'file' | 'manual'
  const [mode, setMode] = useState<'camera' | 'file' | 'manual'>('camera');
  const [fileScanning, setFileScanning] = useState(false);
  const [fileScanResult, setFileScanResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Pastikan hidden DOM container untuk scanFile selalu ada di DOM
  const ensureFileContainer = () => {
    let el = document.getElementById(FILE_SCANNER_DIV_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = FILE_SCANNER_DIV_ID;
      el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:300px;height:300px;opacity:0;pointer-events:none;z-index:-1;';
      document.body.appendChild(el);
    }
    return el;
  };

  // ─── Inisialisasi scanner kamera ──────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'camera') return;

    let mounted = true;
    const startScanner = async () => {
      setIsStarting(true);
      setCameraError(null);
      setHasTorch(false);
      setTorchOn(false);

      // 1. Cek ketersediaan navigator.mediaDevices
      if (!navigator?.mediaDevices?.getUserMedia) {
        if (!mounted) return;
        setCameraError(
          'Browser tidak mendukung akses kamera langsung, atau koneksi tidak menggunakan HTTPS.\n\nGunakan tab "Scan dari Foto" atau "Input Manual".'
        );
        setIsStarting(false);
        return;
      }

      // 2. Cek perangkat video fisik jika didukung browser
      try {
        if (navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter(d => d.kind === 'videoinput');
          if (videoInputs.length === 0) {
            if (!mounted) return;
            setCameraError(
              'Perangkat ini tidak memiliki kamera (atau webcam tidak terdeteksi).\n\nSilakan gunakan opsi "Scan dari Foto" atau "Input Manual".'
            );
            setIsStarting(false);
            return;
          }
        }
      } catch {
        // EnumerateDevices mungkin diblokir sebelum user mengizinkan kamera; lanjutkan coba start
      }

      // 3. Pastikan elemen container live ada dan bersih
      const el = document.getElementById(SCANNER_DIV_ID);
      if (el) el.innerHTML = '';

      try {
        const scanner = new Html5Qrcode(SCANNER_DIV_ID, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: { ideal: 'environment' } },
          {
            fps: 15,
            qrbox: { width: 260, height: 140 },
            aspectRatio: 1.7,
          },
          (decodedText: string) => {
            if (!mounted) return;
            if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
            onDetected(decodedText);
          },
          (_err: any) => {}
        );

        if (!mounted) return;
        setIsStarting(false);

        // Cek torch/flashlight capability
        try {
          const capabilities = scanner.getRunningTrackCapabilities() as any;
          if (capabilities && 'torch' in capabilities) {
            setHasTorch(true);
          }
        } catch {}
      } catch (err: any) {
        if (!mounted) return;
        const msg = String(err?.message || err || '');
        const errName = String(err?.name || '');

        if (
          errName === 'NotAllowedError' ||
          errName === 'PermissionDeniedError' ||
          msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('denied')
        ) {
          setCameraError(
            'Izin akses kamera diblokir oleh browser.\n\nKlik ikon gembok di sebelah URL / address bar untuk mengaktifkan izin kamera, lalu muat ulang.'
          );
        } else if (
          errName === 'NotFoundError' ||
          errName === 'DevicesNotFoundError' ||
          msg.toLowerCase().includes('notfound') ||
          msg.toLowerCase().includes('no camera') ||
          msg.toLowerCase().includes('no suitable')
        ) {
          setCameraError(
            'Kamera tidak ditemukan di perangkat ini (tidak ada webcam/kamera terpasang).'
          );
        } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
          setCameraError(
            'Kamera sedang dipakai oleh aplikasi lain (seperti Zoom, Google Meet, dll).\nTutup aplikasi tersebut lalu coba lagi.'
          );
        } else {
          setCameraError(
            'Gagal membuka kamera (' + (errName || msg || 'kesalahan perangkat') + ').'
          );
        }
        setIsStarting(false);
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
  }, [mode]);

  // Toggle senter / torch HP
  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: !torchOn } as any]
      });
      setTorchOn(!torchOn);
    } catch (e) {
      console.warn('Torch not supported on this track', e);
    }
  };

  // ─── Switch mode ──────────────────────────────────────────────────────────
  const switchMode = (targetMode: 'camera' | 'file' | 'manual') => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setFileScanResult(null);
    setMode(targetMode);
  };

  // ─── Scan dari File Foto Barcode ──────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileScanning(true);
    setFileScanResult(null);

    // Pastikan container DOM terdaftar
    ensureFileContainer();

    let tempScanner: Html5Qrcode | null = null;
    try {
      tempScanner = new Html5Qrcode(FILE_SCANNER_DIV_ID, { verbose: false });
      const result = await tempScanner.scanFile(file, false);
      if (navigator.vibrate) navigator.vibrate([60, 30, 60]);
      setFileScanResult({ ok: true, msg: result });
      // Beri user feedback visual 700ms lalu inject hasil
      setTimeout(() => {
        onDetected(result);
      }, 700);
    } catch (err: any) {
      console.warn('Scan file error:', err);
      setFileScanResult({
        ok: false,
        msg: 'Barcode tidak terdeteksi di gambar ini.\nPastikan foto barcode tegak lurus, cukup cahaya, dan tidak buram/pecah.'
      });
    } finally {
      if (tempScanner) {
        try { tempScanner.clear(); } catch {}
      }
      setFileScanning(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    onDetected(manualCode.trim());
  };

  const corners = [
    'top-0 left-0 border-t-2 border-l-2 rounded-tl-xl',
    'top-0 right-0 border-t-2 border-r-2 rounded-tr-xl',
    'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl',
    'bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl',
  ];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black select-none">

      {/* Hidden file inputs */}
      {/* 1. Kamera HP native via browser file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
      {/* 2. File picker / Galeri foto */}
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-safe-top pt-4 pb-3 bg-black/85 backdrop-blur-md shrink-0 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            {mode === 'camera' && <Camera size={18} className="text-emerald-400" />}
            {mode === 'file' && <ImageUp size={18} className="text-emerald-400" />}
            {mode === 'manual' && <Keyboard size={18} className="text-emerald-400" />}
          </div>
          <div>
            <p className="text-white font-black text-sm leading-tight">
              {mode === 'camera' && 'Scan Barcode — Kamera'}
              {mode === 'file' && 'Scan Barcode — dari Foto'}
              {mode === 'manual' && 'Input Barcode Manual'}
            </p>
            <p className="text-white/50 text-[11px]">
              {mode === 'camera' && 'Arahkan kotak ke barcode produk'}
              {mode === 'file' && 'Ambil foto atau pilih dari galeri'}
              {mode === 'manual' && 'Ketik kode barcode / SKU'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Torch toggle jika supported */}
          {mode === 'camera' && hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                torchOn ? 'bg-amber-400 text-black' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title="Flashlight"
            >
              <Flashlight size={16} />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center transition-colors"
          >
            <X size={18} className="text-white" />
          </button>
        </div>
      </div>

      {/* ── Mode Switcher Pills ── */}
      <div className="flex shrink-0 px-4 py-2.5 gap-2 bg-black/75 border-b border-white/5 overflow-x-auto">
        <button
          type="button"
          onClick={() => switchMode('camera')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
            mode === 'camera'
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
        >
          <Camera size={13} /> Kamera Langsung
        </button>
        <button
          type="button"
          onClick={() => switchMode('file')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
            mode === 'file'
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
        >
          <ImageUp size={13} /> Scan dari Foto
        </button>
        <button
          type="button"
          onClick={() => switchMode('manual')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
            mode === 'manual'
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
        >
          <Keyboard size={13} /> Ketik Manual
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">

        {/* ── MODE 1: KAMERA LIVE ── */}
        {mode === 'camera' && (
          <>
            <div id={SCANNER_DIV_ID} className="w-full h-full" />

            {/* Spinner saat booting camera */}
            {isStarting && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-3 z-10">
                <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
                <p className="text-white/80 text-sm font-semibold">Menghubungkan ke kamera...</p>
              </div>
            )}

            {/* Error kamera / Device tanpa kamera */}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 gap-5 px-6 z-20">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <ZapOff size={32} className="text-amber-400" />
                </div>
                <div className="text-center max-w-sm">
                  <p className="text-white font-black text-base mb-2">Kamera Tidak Tersedia</p>
                  <p className="text-white/70 text-xs leading-relaxed whitespace-pre-line">
                    {cameraError}
                  </p>
                </div>

                {/* Alternatif tindakan langsung */}
                <div className="w-full max-w-xs flex flex-col gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => switchMode('file')}
                    className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/30"
                  >
                    <ImageUp size={18} />
                    Gunakan Opsi Scan dari Foto
                  </button>

                  <button
                    type="button"
                    onClick={() => switchMode('manual')}
                    className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                  >
                    <Keyboard size={16} />
                    Ketik Barcode Manual
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-2.5 px-4 text-white/50 hover:text-white text-xs font-semibold transition-all mt-1"
                  >
                    Kembali
                  </button>
                </div>
              </div>
            )}

            {/* Scanning viewfinder overlay */}
            {!isStarting && !cameraError && (
              <>
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: 'radial-gradient(ellipse 320px 180px at center, transparent 0%, rgba(0,0,0,0.65) 100%)' }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative" style={{ width: 268, height: 148 }}>
                    {corners.map((cls, i) => (
                      <div key={i} className={'absolute w-7 h-7 border-emerald-400 ' + cls} />
                    ))}
                    <div
                      className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent rounded-full"
                      style={{ animation: 'scanLine 2s ease-in-out infinite', boxShadow: '0 0 10px rgba(52,211,153,0.9)' }}
                    />
                  </div>
                </div>

                <div className="absolute bottom-6 left-4 right-4 flex flex-col items-center gap-2 z-10 pointer-events-auto">
                  <p className="text-white/80 text-xs text-center bg-black/60 px-4 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
                    Arahkan ke Barcode / QR Code
                  </p>
                  <button
                    type="button"
                    onClick={() => switchMode('file')}
                    className="text-white/60 text-[11px] flex items-center gap-1.5 hover:text-white py-1 px-3 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <ImageUp size={12} /> Kamera bermasalah? Scan dari foto
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ── MODE 2: SCAN DARI FILE FOTO ── */}
        {mode === 'file' && (
          <div className="flex flex-col items-center justify-center gap-5 px-6 py-8 w-full max-w-sm">

            {!fileScanResult && !fileScanning && (
              <>
                <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                  <Scan size={40} className="text-emerald-400" strokeWidth={1.8} />
                </div>

                <div className="text-center">
                  <p className="text-white font-black text-base mb-1.5">Scan Barcode dari Foto</p>
                  <p className="text-white/60 text-xs leading-relaxed max-w-xs">
                    Pilih gambar atau foto barcode produk. AI decoder otomatis membaca barcode dari gambar tersebut.
                  </p>
                </div>

                {/* Tombol aksi */}
                <div className="flex flex-col gap-3 w-full pt-1">
                  {/* Ambil foto via kamera HP (native, tanpa butuh WebRTC live stream) */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-emerald-500/30"
                  >
                    <Camera size={20} />
                    Ambil Foto Barcode
                  </button>

                  {/* Pilih gambar yang sudah ada / upload di desktop */}
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="w-full py-3.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all border border-white/10"
                  >
                    <ImageUp size={18} />
                    Pilih File / Galeri
                  </button>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center w-full">
                  <p className="text-white/40 text-[11px] leading-relaxed">
                    💡 <strong className="text-white/70">Tips:</strong> Foto dari jarak 10–20 cm tegak lurus, pastikan barcode tajam dan barcode terisi penuh dalam gambar.
                  </p>
                </div>
              </>
            )}

            {/* Spinner saat memproses decoding file gambar */}
            {fileScanning && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-14 h-14 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
                <p className="text-white font-bold text-sm">Membaca barcode dari gambar...</p>
                <p className="text-white/40 text-xs">Mendeteksi EAN-13, QR, CODE-128...</p>
              </div>
            )}

            {/* Hasil scan file */}
            {fileScanResult && (
              <div className="flex flex-col items-center gap-4 w-full text-center py-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border ${
                  fileScanResult.ok ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-red-500/20 border-red-500/30'
                }`}>
                  {fileScanResult.ok
                    ? <CheckCircle size={36} className="text-emerald-400" />
                    : <ZapOff size={36} className="text-red-400" />
                  }
                </div>

                <div>
                  <p className={`font-black text-base mb-1.5 ${fileScanResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fileScanResult.ok ? '✅ Barcode Terdeteksi!' : '❌ Gagal Terbaca'}
                  </p>
                  {fileScanResult.ok ? (
                    <div className="bg-white/10 border border-emerald-500/30 px-5 py-3 rounded-2xl">
                      <p className="text-white font-mono text-xl font-black tracking-wider">
                        {fileScanResult.msg}
                      </p>
                    </div>
                  ) : (
                    <p className="text-white/70 text-xs leading-relaxed max-w-xs whitespace-pre-line">
                      {fileScanResult.msg}
                    </p>
                  )}
                </div>

                {!fileScanResult.ok && (
                  <div className="w-full flex flex-col gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => { setFileScanResult(null); fileInputRef.current?.click(); }}
                      className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                    >
                      <Camera size={18} /> Coba Foto Lagi
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('manual')}
                      className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-semibold text-xs transition-all"
                    >
                      Ketik Manual Saja
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── MODE 3: INPUT MANUAL CEPAT ── */}
        {mode === 'manual' && (
          <div className="flex flex-col items-center justify-center gap-5 px-6 py-8 w-full max-w-sm">
            <div className="w-20 h-20 rounded-3xl bg-indigo-500/20 border-2 border-indigo-500/40 flex items-center justify-center shadow-lg shadow-indigo-500/10">
              <Keyboard size={40} className="text-indigo-400" strokeWidth={1.8} />
            </div>

            <div className="text-center">
              <p className="text-white font-black text-base mb-1.5">Input Barcode / SKU</p>
              <p className="text-white/60 text-xs leading-relaxed max-w-xs">
                Ketik nomor barcode yang tertera pada kemasan produk atau nomor barcode kustom.
              </p>
            </div>

            <form onSubmit={handleManualSubmit} className="w-full flex flex-col gap-3">
              <input
                type="text"
                autoFocus
                placeholder="Contoh: 8991234567890"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="w-full bg-white/10 border-2 border-white/20 focus:border-emerald-400 text-white text-center font-mono text-lg font-bold py-3.5 px-4 rounded-2xl outline-none transition-all placeholder-white/30"
              />

              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/30"
              >
                Gunakan Barcode Ini <ArrowRight size={18} />
              </button>
            </form>
          </div>
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
