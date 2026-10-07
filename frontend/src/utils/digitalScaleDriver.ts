/**
 * digitalScaleDriver.ts
 * ============================================================================
 * Driver Komunikasi Hardware Timbangan Digital Komersial (CodePOS Laundry)
 * Menggunakan Web Serial API (Zero-Installation / Native Chromium Browser).
 * 
 * Mendukung berbagai protokol timbangan di Indonesia:
 * - Sayaki (A12E, T7E, A15E)
 * - CAS (PR-Plus, PB-150, SW-1S, CI-2001)
 * - Matrix / GSF / Nankai RS-232
 * - Yaohua / Sonic / Henkrr / Daijin
 * - Generic ASCII Streaming Scale
 * ============================================================================
 */

export interface ScaleReading {
  weight: number;
  unit: 'KG' | 'G' | 'LBS';
  isStable: boolean;
  rawText: string;
  timestamp: number;
}

export type ScaleFormatPreset = 'AUTO' | 'CAS' | 'SAYAKI' | 'MATRIX' | 'GENERIC';

export interface ScaleConfig {
  baudRate: number;
  dataBits: 7 | 8;
  stopBits: 1 | 2;
  parity: 'none' | 'even' | 'odd';
  format: ScaleFormatPreset;
  stableThresholdMs: number;
}

export type ScaleConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'SIMULATING';

const DEFAULT_SCALE_CONFIG: ScaleConfig = {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  format: 'AUTO',
  stableThresholdMs: 600
};

export class DigitalScaleDriver {
  private static instance: DigitalScaleDriver | null = null;

  private port: any = null;
  private reader: any = null;
  private isReading: boolean = false;
  private status: ScaleConnectionStatus = 'DISCONNECTED';
  private config: ScaleConfig = { ...DEFAULT_SCALE_CONFIG };

  // Listeners & Callbacks
  private onReadingListeners: Set<(reading: ScaleReading) => void> = new Set();
  private onStatusListeners: Set<(status: ScaleConnectionStatus) => void> = new Set();
  private onLogListeners: Set<(log: string) => void> = new Set();
  private onStableLockListeners: Set<(weight: number) => void> = new Set();

  // Internal Stable State Detector
  private lastStableWeight: number | null = null;
  private candidateWeight: number | null = null;
  private candidateStartTime: number = 0;
  private hasEmittedStableLock: boolean = false;

  // Simulation mode timer
  private simulationInterval: any = null;
  private simulatedWeight: number = 0;

  constructor() {
    this.loadSavedConfig();
  }

  public static getInstance(): DigitalScaleDriver {
    if (!DigitalScaleDriver.instance) {
      DigitalScaleDriver.instance = new DigitalScaleDriver();
    }
    return DigitalScaleDriver.instance;
  }

  /**
   * Cek dukungan Web Serial API di browser saat ini
   */
  public static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public getStatus(): ScaleConnectionStatus {
    return this.status;
  }

  public getConfig(): ScaleConfig {
    return { ...this.config };
  }

  public setConfig(newConfig: Partial<ScaleConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
  }

  private loadSavedConfig() {
    try {
      const saved = localStorage.getItem('codepos_scale_config');
      if (saved) {
        this.config = { ...DEFAULT_SCALE_CONFIG, ...JSON.parse(saved) };
      }
    } catch (_) {}
  }

  private saveConfig() {
    try {
      localStorage.setItem('codepos_scale_config', JSON.stringify(this.config));
    } catch (_) {}
  }

  private updateStatus(newStatus: ScaleConnectionStatus) {
    this.status = newStatus;
    this.onStatusListeners.forEach(listener => listener(newStatus));
  }

  private logRaw(message: string) {
    this.onLogListeners.forEach(listener => listener(message));
  }

  // ─── KONEKSI WEB SERIAL API ────────────────────────────────────────────────

  /**
   * Buka dialog browser untuk memilih USB/Serial Port dan mulai membaca data
   */
  public async connect(): Promise<boolean> {
    if (this.status === 'SIMULATING') {
      this.stopSimulation();
    }

    if (!DigitalScaleDriver.isSupported()) {
      throw new Error(
        'Browser Anda tidak mendukung Web Serial API. Silakan gunakan Google Chrome atau Microsoft Edge terbaru.'
      );
    }

    try {
      this.updateStatus('CONNECTING');
      this.logRaw('[SCALE] Meminta otorisasi port dari browser...');

      // Browser native prompt dialog
      this.port = await (navigator as any).serial.requestPort();

      await this.port.open({
        baudRate: this.config.baudRate,
        dataBits: this.config.dataBits,
        stopBits: this.config.stopBits,
        parity: this.config.parity,
        bufferSize: 255
      });

      this.updateStatus('CONNECTED');
      this.logRaw(`[SCALE] Port serial terbuka pada ${this.config.baudRate} bps 8-N-1.`);

      this.startReadingStream();
      return true;
    } catch (error: any) {
      console.warn('[DigitalScaleDriver Connection Error]', error);
      this.updateStatus('DISCONNECTED');
      this.logRaw(`[SCALE ERROR] Gagal menghubungkan port: ${error.message || 'Dibatalkan oleh kasir'}`);
      return false;
    }
  }

  /**
   * Otomatis sambungkan kembali ke port yang sebelumnya sudah pernah diizinkan kasir
   */
  public async autoReconnect(): Promise<boolean> {
    if (!DigitalScaleDriver.isSupported()) return false;
    if (this.status === 'CONNECTED' || this.status === 'SIMULATING') return true;

    try {
      const ports = await (navigator as any).serial.getPorts();
      if (ports && ports.length > 0) {
        this.port = ports[0];
        await this.port.open({
          baudRate: this.config.baudRate,
          dataBits: this.config.dataBits,
          stopBits: this.config.stopBits,
          parity: this.config.parity,
          bufferSize: 255
        });

        this.updateStatus('CONNECTED');
        this.logRaw('[SCALE] Berhasil auto-reconnect ke port sebelumnya.');
        this.startReadingStream();
        return true;
      }
    } catch (e: any) {
      console.debug('[Scale auto-reconnect skipped]', e);
    }
    return false;
  }

  /**
   * Putuskan koneksi port serial
   */
  public async disconnect(): Promise<void> {
    this.isReading = false;
    this.stopSimulation();

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch (_) {}
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch (_) {}
      this.port = null;
    }

    this.updateStatus('DISCONNECTED');
    this.logRaw('[SCALE] Port serial ditutup.');
  }

  // ─── STREAM READING & PARSING LOOP ──────────────────────────────────────────

  private async startReadingStream() {
    this.isReading = true;
    let buffer = '';

    try {
      const textDecoder = new TextDecoderStream();
      this.port.readable.pipeTo(textDecoder.writable);
      this.reader = textDecoder.readable.getReader();

      while (this.isReading) {
        const { value, done } = await this.reader.read();
        if (done) break;

        if (value) {
          buffer += value;

          // Pisahkan berdasarkan baris baru (\r atau \n)
          if (buffer.includes('\n') || buffer.includes('\r')) {
            const lines = buffer.split(/[\r\n]+/);
            buffer = lines.pop() || ''; // simpan pecahan baris yang belum selesai

            for (const line of lines) {
              const clean = line.trim();
              if (clean) {
                this.logRaw(`[RX] ${clean}`);
                const reading = this.parseScaleString(clean);
                if (reading) {
                  this.processReading(reading);
                }
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[Scale Stream Error]', err);
      this.logRaw(`[SCALE ERROR STREAM] ${err.message || err}`);
    } finally {
      if (this.status === 'CONNECTED') {
        this.updateStatus('DISCONNECTED');
      }
    }
  }

  /**
   * Parser Universal: Menangani berbagai format string timbangan komersial
   */
  public parseScaleString(raw: string): ScaleReading | null {
    if (!raw || raw.length < 2) return null;

    let isStable = true;
    let weight = 0;
    const now = Date.now();

    // 1. FORMAT CAS / SAYAKI / YAOHUA: "ST,GS,+004.25kg" atau "US,GS,+004.10kg"
    if (raw.includes('ST,') || raw.includes('US,') || raw.includes('GS,')) {
      isStable = !raw.toUpperCase().includes('US'); // ST = Stable, US = Unstable
      const match = raw.match(/[+-]?\s*(\d+(?:\.\d+)?)/);
      if (match) {
        weight = parseFloat(match[1]);
      }
    }
    // 2. FORMAT MATRIX / SONIC: "wn004.250kg" atau "wn-000.00kg"
    else if (raw.toLowerCase().startsWith('wn') || raw.toLowerCase().startsWith('ww')) {
      const match = raw.match(/([+-]?\d+(?:\.\d+)?)/);
      if (match) {
        weight = parseFloat(match[1]);
      }
      isStable = !raw.includes('?');
    }
    // 3. FORMAT GENERIC ASCII STREAM: "=04.25kg" atau "4.25 KG" atau "+  3.50 kg"
    else {
      // Periksa tanda stabilitas huruf S atau U
      if (raw.toUpperCase().startsWith('U') || raw.includes('UNSTABLE')) {
        isStable = false;
      }
      const match = raw.match(/([+-]?\d+(?:\.\d+)?)/);
      if (match) {
        weight = parseFloat(match[1]);
      }
    }

    if (isNaN(weight)) return null;

    return {
      weight: Math.abs(weight),
      unit: 'KG',
      isStable,
      rawText: raw,
      timestamp: now
    };
  }

  /**
   * Filter Stabilitas & Deteksi Stable-Lock
   */
  private processReading(reading: ScaleReading) {
    // Siarkan ke seluruh listener UI
    this.onReadingListeners.forEach(listener => listener(reading));

    // Evaluasi apakah bobot sudah mengunci (konstan selama threshold ms)
    const now = reading.timestamp;
    const currentWeight = reading.weight;

    if (currentWeight <= 0.05) {
      // Timbangan kosong / zero
      this.lastStableWeight = null;
      this.candidateWeight = null;
      this.hasEmittedStableLock = false;
      return;
    }

    if (this.candidateWeight === null || Math.abs(currentWeight - this.candidateWeight) > 0.02) {
      // Bobot berubah (ada penambahan/pengurangan baju di timbangan)
      this.candidateWeight = currentWeight;
      this.candidateStartTime = now;
      this.hasEmittedStableLock = false;
    } else {
      // Bobot konstan
      const duration = now - this.candidateStartTime;
      if (duration >= this.config.stableThresholdMs && !this.hasEmittedStableLock) {
        this.hasEmittedStableLock = true;
        this.lastStableWeight = currentWeight;

        // Picu audio konfirmasi & event kunci berat
        this.playBeepSound();
        this.onStableLockListeners.forEach(listener => listener(currentWeight));
        this.logRaw(`[SCALE LOCK] Bobot stabil terkunci pada: ${currentWeight.toFixed(2)} KG`);
      }
    }
  }

  // ─── AUDIO FEEDBACK (WEB AUDIO SYNTHESIZER) ─────────────────────────────────

  /**
   * Membunyikan nada beep konfirmasi lembut saat berat terkunci stabil (880 Hz / A5)
   */
  public playBeepSound() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const audioCtx = new AudioContextClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880 Hz (A5 chime)
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (_) {}
  }

  // ─── SIMULATION MODE (TESTING TANPA TIMBANGAN FISIK) ────────────────────────

  /**
   * Aktifkan simulator virtual untuk demo atau testing kasir
   */
  public startSimulation(targetWeight: number = 3.65) {
    if (this.status === 'CONNECTED') {
      this.disconnect();
    }

    this.updateStatus('SIMULATING');
    this.simulatedWeight = targetWeight;
    this.logRaw(`[SIMULATOR] Memulai simulasi timbangan target ${targetWeight} KG...`);

    let tick = 0;
    this.simulationInterval = setInterval(() => {
      tick++;
      // 3 tick pertama sedikit berosilasi (unstable), lalu stabil
      const isSimStable = tick > 3;
      const jitter = isSimStable ? 0 : (Math.random() * 0.08 - 0.04);
      const currentVal = Math.max(0, parseFloat((this.simulatedWeight + jitter).toFixed(2)));

      const raw = isSimStable
        ? `ST,GS,+${currentVal.toFixed(2).padStart(6, '0')}kg\r\n`
        : `US,GS,+${currentVal.toFixed(2).padStart(6, '0')}kg\r\n`;

      this.logRaw(`[SIM RX] ${raw.trim()}`);
      this.processReading({
        weight: currentVal,
        unit: 'KG',
        isStable: isSimStable,
        rawText: raw.trim(),
        timestamp: Date.now()
      });
    }, 250);
  }

  public setSimulatedWeight(val: number) {
    this.simulatedWeight = Math.max(0, val);
    this.candidateWeight = null;
    this.hasEmittedStableLock = false;
  }

  public stopSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    if (this.status === 'SIMULATING') {
      this.updateStatus('DISCONNECTED');
      this.logRaw('[SIMULATOR] Mode simulasi dihentikan.');
    }
  }

  // ─── EVENT SUBSCRIBERS ──────────────────────────────────────────────────────

  public onReading(callback: (reading: ScaleReading) => void): () => void {
    this.onReadingListeners.add(callback);
    return () => this.onReadingListeners.delete(callback);
  }

  public onStatusChange(callback: (status: ScaleConnectionStatus) => void): () => void {
    this.onStatusListeners.add(callback);
    return () => this.onStatusListeners.delete(callback);
  }

  public onRawLog(callback: (log: string) => void): () => void {
    this.onLogListeners.add(callback);
    return () => this.onLogListeners.delete(callback);
  }

  public onStableLock(callback: (weight: number) => void): () => void {
    this.onStableLockListeners.add(callback);
    return () => this.onStableLockListeners.delete(callback);
  }
}

// Export singleton instance default
export const scaleDriver = DigitalScaleDriver.getInstance();
