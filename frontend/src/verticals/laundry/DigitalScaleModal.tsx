import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Scale,
  Cpu,
  Terminal,
  Settings2,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Zap,
  Volume2,
  RefreshCw,
  Usb
} from 'lucide-react';
import {
  scaleDriver,
  type ScaleConnectionStatus,
  type ScaleReading,
  type ScaleConfig,
  type ScaleFormatPreset
} from '../../utils/digitalScaleDriver';
import { toast } from '../../utils/alert';

interface DigitalScaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyWeight?: (weight: number) => void;
}

export const DigitalScaleModal: React.FC<DigitalScaleModalProps> = ({
  isOpen,
  onClose,
  onApplyWeight
}) => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'config' | 'simulator'>('monitor');
  const [status, setStatus] = useState<ScaleConnectionStatus>(scaleDriver.getStatus());
  const [currentReading, setCurrentReading] = useState<ScaleReading | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [config, setConfig] = useState<ScaleConfig>(scaleDriver.getConfig());
  const [simWeight, setSimWeight] = useState<number>(3.5);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    setStatus(scaleDriver.getStatus());
    setConfig(scaleDriver.getConfig());

    const unsubStatus = scaleDriver.onStatusChange(newStatus => {
      setStatus(newStatus);
    });

    const unsubReading = scaleDriver.onReading(reading => {
      setCurrentReading(reading);
    });

    const unsubLog = scaleDriver.onRawLog(logMsg => {
      setLogs(prev => [...prev.slice(-80), `[${new Date().toLocaleTimeString()}] ${logMsg}`]);
    });

    return () => {
      unsubStatus();
      unsubReading();
      unsubLog();
    };
  }, [isOpen]);

  useEffect(() => {
    if (activeTab === 'monitor') {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    try {
      const ok = await scaleDriver.connect();
      if (ok) {
        toast('Timbangan digital berhasil terhubung!', 'success');
      }
    } catch (err: any) {
      toast(err.message || 'Gagal menyambungkan timbangan', 'error');
    }
  };

  const handleDisconnect = async () => {
    await scaleDriver.disconnect();
    toast('Timbangan diputuskan.', 'info');
  };

  const handleSaveConfig = () => {
    scaleDriver.setConfig(config);
    toast('Konfigurasi serial timbangan disimpan!', 'success');
  };

  const handleStartSim = () => {
    scaleDriver.startSimulation(simWeight);
    toast(`Simulator aktif pada ${simWeight} Kg`, 'info');
  };

  const handleStopSim = () => {
    scaleDriver.stopSimulation();
    toast('Simulator dinonaktifkan.', 'info');
  };

  const handleTestBeep = () => {
    scaleDriver.playBeepSound();
    toast('Nada audio validasi stable-lock berbunyi', 'info');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 p-5 text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
              <Scale size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Konfigurasi Timbangan Digital
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                    status === 'CONNECTED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                      : status === 'SIMULATING'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
                      : status === 'CONNECTING'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {status}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Web Serial API • Direct USB/RS-232 Hardware Interface
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/60 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigator */}
        <div className="flex items-center gap-1 bg-slate-100 p-1.5 border-b border-slate-200 text-xs font-semibold">
          {[
            { id: 'monitor', label: 'Serial Monitor & Live Data', icon: Terminal },
            { id: 'config', label: 'Pengaturan Port & Protokol', icon: Settings2 },
            { id: 'simulator', label: 'Virtual Simulator (Testing)', icon: Zap }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
                  active
                    ? 'bg-white text-cyan-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto">
          {/* TAB 1: SERIAL MONITOR & LIVE READOUT */}
          {activeTab === 'monitor' && (
            <div className="space-y-4">
              {/* LCD Display Readout */}
              <div className="bg-slate-950 rounded-2xl p-4 border border-cyan-500/40 flex items-center justify-between shadow-inner">
                <div>
                  <span className="text-[10px] font-mono tracking-widest text-cyan-400 font-bold block mb-1">
                    LIVE SCALE READOUT
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        currentReading?.isStable ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-300">
                      {currentReading?.isStable ? 'STATUS: STABLE (TERKUNCI)' : 'STATUS: UNSTABLE (BERGERAK)'}
                    </span>
                  </div>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black font-mono text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]">
                    {currentReading ? currentReading.weight.toFixed(2) : '0.00'}
                  </span>
                  <span className="text-lg font-black text-cyan-300 font-mono">KG</span>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {status === 'CONNECTED' ? (
                    <button
                      onClick={handleDisconnect}
                      className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold flex items-center gap-2 transition-all"
                    >
                      <Square size={14} />
                      <span>Putuskan Port</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleConnect}
                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
                    >
                      <Usb size={15} />
                      <span>Hubungkan Timbangan USB</span>
                    </button>
                  )}

                  <button
                    onClick={handleTestBeep}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
                    title="Uji Suara Beep Konfirmasi"
                  >
                    <Volume2 size={16} />
                  </button>
                </div>

                {onApplyWeight && currentReading && (
                  <button
                    onClick={() => {
                      onApplyWeight(currentReading.weight);
                      onClose();
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
                  >
                    <CheckCircle2 size={15} />
                    <span>Gunakan Bobot ({currentReading.weight.toFixed(2)} Kg)</span>
                  </button>
                )}
              </div>

              {/* Terminal Raw Console */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Terminal size={14} className="text-slate-500" />
                    Serial Raw Stream (Real-Time Terminal)
                  </span>
                  <button
                    onClick={() => setLogs([])}
                    className="text-[11px] text-slate-500 hover:text-slate-800"
                  >
                    Bersihkan Log
                  </button>
                </div>
                <div className="bg-slate-950 text-cyan-300 font-mono text-[11px] p-3 rounded-2xl h-44 overflow-y-auto border border-slate-800 space-y-1 shadow-inner">
                  {logs.length === 0 ? (
                    <div className="text-slate-600 italic">
                      Menunggu data stream dari serial port timbangan...
                    </div>
                  ) : (
                    logs.map((l, i) => <div key={i}>{l}</div>)
                  )}
                  <div ref={logEndRef} />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONFIGURATION */}
          {activeTab === 'config' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-cyan-50 border border-cyan-100 text-xs text-cyan-900 leading-relaxed">
                Sesuaikan parameter komunikasi serial sesuai dengan buku panduan timbangan digital
                Anda. Standar timbangan Sayaki, CAS, dan Matrix umumnya adalah <strong>9600 Baud Rate, 8-N-1</strong>.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Baud Rate (Kecepatan Serial)
                  </label>
                  <select
                    value={config.baudRate}
                    onChange={e => setConfig({ ...config, baudRate: parseInt(e.target.value) })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                  >
                    <option value={9600}>9600 (Standar Industri)</option>
                    <option value={4800}>4800</option>
                    <option value={2400}>2400</option>
                    <option value={19200}>19200</option>
                    <option value={115200}>115200</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Format Protokol Timbangan
                  </label>
                  <select
                    value={config.format}
                    onChange={e => setConfig({ ...config, format: e.target.value as ScaleFormatPreset })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                  >
                    <option value="AUTO">Otomatis (Auto-Detect Regex)</option>
                    <option value="CAS">CAS (PR-Plus, PB-150, SW-1S)</option>
                    <option value="SAYAKI">Sayaki (A12E, T7E)</option>
                    <option value="MATRIX">Matrix / Sonic / GSF</option>
                    <option value="GENERIC">Generic ASCII Stream</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Ambang Waktu Stabilitas Kunci (ms)
                  </label>
                  <input
                    type="number"
                    step={100}
                    min={300}
                    max={2000}
                    value={config.stableThresholdMs}
                    onChange={e => setConfig({ ...config, stableThresholdMs: parseInt(e.target.value) || 600 })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Nilai diam minimal sebelum auto-lock & nada bunyi dipicu (rekomendasi: 600 ms).
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Parity Bit
                  </label>
                  <select
                    value={config.parity}
                    onChange={e => setConfig({ ...config, parity: e.target.value as any })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                  >
                    <option value="none">None (Tanpa Paritas - 8-N-1)</option>
                    <option value="even">Even</option>
                    <option value="odd">Odd</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={handleSaveConfig}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
                >
                  Simpan Konfigurasi
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: SIMULATOR MODE */}
          {activeTab === 'simulator' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-100 text-xs text-purple-900 leading-relaxed">
                Mode simulasi memungkinkan Anda menguji integrasi penimbangan real-time di POS
                tanpa memerlukan timbangan fisik tercolok. Sangat berguna untuk demo atau pelatihan kasir!
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Target Berat Simulasi:</span>
                  <span className="text-lg font-black font-mono text-purple-700">{simWeight.toFixed(2)} KG</span>
                </div>

                <input
                  type="range"
                  min="0.1"
                  max="25.0"
                  step="0.05"
                  value={simWeight}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    setSimWeight(val);
                    if (status === 'SIMULATING') {
                      scaleDriver.setSimulatedWeight(val);
                    }
                  }}
                  className="w-full accent-purple-600 cursor-pointer"
                />

                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {[1.5, 3.25, 4.8, 6.5, 8.0, 12.0].map(w => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => {
                        setSimWeight(w);
                        if (status === 'SIMULATING') {
                          scaleDriver.setSimulatedWeight(w);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-purple-300 text-xs font-semibold text-slate-700 transition-all shadow-2xs"
                    >
                      {w} Kg
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                {status === 'SIMULATING' ? (
                  <button
                    onClick={handleStopSim}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <Square size={15} />
                    <span>Hentikan Simulator</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStartSim}
                    className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <Play size={15} />
                    <span>Mulai Simulator Virtual</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            {status === 'CONNECTED'
              ? 'Timbangan Aktif • Data tersinkronisasi'
              : status === 'SIMULATING'
              ? 'Simulator Aktif • Data virtual'
              : 'Mode Manual Aktif'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
