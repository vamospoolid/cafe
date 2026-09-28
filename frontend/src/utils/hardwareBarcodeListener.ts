/**
 * Hardware Barcode & QR Scanner Listener (Global HID Keystroke Buffer)
 * 
 * Works with:
 * - Wireless 2.4GHz USB Dongle Barcode Scanners (Honeywell, Eyoyo, Netum, Zebra)
 * - Bluetooth HID Barcode Scanners
 * - Built-in Hardware Scanners on Android POS handhelds (Sunmi, iMin)
 * 
 * Key Features:
 * 1. Ultra-fast keystroke interval detection (< 50ms threshold) to distinguish
 *    hardware laser/CCD scans from manual human typing.
 * 2. Works regardless of whether search bar is currently focused.
 * 3. Native Web Audio API Beep Generator (1800Hz pleasant checkout chime, 0 external asset dependency).
 * 4. Haptic vibration feedback for tablet/mobile.
 */

let audioCtx: AudioContext | null = null;

/**
 * Play a high-precision, pleasant POS confirmation beep
 */
export function playScannerBeep(success: boolean = true) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (success) {
      // Pleasant high-pitch POS checkout chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, audioCtx.currentTime); // A6 note
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } else {
      // Low double-beep for unfound product
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    }

    // Trigger haptic vibration on mobile/tablet
    if ('vibrate' in navigator) {
      navigator.vibrate(success ? 35 : [50, 50, 50]);
    }
  } catch {
    // Ignore audio permission/context errors silently
  }
}

export interface BarcodeListenerOptions {
  minBarcodeLength?: number;
  maxKeyIntervalMs?: number;
  onScan: (barcode: string) => void;
}

/**
 * Initializes a global window listener for hardware barcode scanners
 * Returns an unbind cleanup function.
 */
export function initHardwareBarcodeListener(options: BarcodeListenerOptions): () => void {
  const minLength = options.minBarcodeLength ?? 3;
  const maxInterval = options.maxKeyIntervalMs ?? 50; // Hardware scanners burst keys in 10-35ms

  let buffer = '';
  let lastKeyTime = 0;
  let keyIntervals: number[] = [];

  const handleKeyDown = (e: KeyboardEvent) => {
    // Ignore meta/control keys
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    const now = Date.now();
    const timeDiff = now - lastKeyTime;
    lastKeyTime = now;

    // Enter signals end of barcode transmission from hardware scanner
    if (e.key === 'Enter') {
      if (buffer.length >= minLength) {
        // Calculate average keystroke interval
        const avgInterval = keyIntervals.length > 0 
          ? keyIntervals.reduce((a, b) => a + b, 0) / keyIntervals.length 
          : 0;

        // If average interval is fast (< maxInterval), it was definitively a hardware scan
        const isHardwareBurst = avgInterval < maxInterval || keyIntervals.length === 0;

        // Check if an input field is currently active
        const activeElem = document.activeElement as HTMLElement | null;
        const isInputFocused = activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA');

        if (isHardwareBurst) {
          e.preventDefault();
          e.stopPropagation();

          const scannedCode = buffer.trim();
          buffer = '';
          keyIntervals = [];

          if (scannedCode) {
            playScannerBeep(true);
            options.onScan(scannedCode);
          }
          return;
        }

        // If it was manual Enter on a normal input, let it pass through
        if (isInputFocused) {
          buffer = '';
          keyIntervals = [];
          return;
        }
      }

      // Reset on non-qualifying Enter
      buffer = '';
      keyIntervals = [];
      return;
    }

    // Ignore single modifier or function keys
    if (e.key.length > 1) return;

    // If gap between characters is too long, reset buffer (user was likely typing manually elsewhere)
    if (timeDiff > maxInterval * 3 && buffer.length > 0) {
      buffer = '';
      keyIntervals = [];
    }

    if (buffer.length > 0) {
      keyIntervals.push(timeDiff);
    }
    buffer += e.key;

    // Safety: prevent buffer from growing indefinitely
    if (buffer.length > 64) {
      buffer = buffer.slice(-32);
      keyIntervals = keyIntervals.slice(-31);
    }
  };

  window.addEventListener('keydown', handleKeyDown, true);

  return () => {
    window.removeEventListener('keydown', handleKeyDown, true);
  };
}
