import crypto from 'crypto';

/**
 * Menghasilkan Tracking Code unik dengan entropi tinggi (NanoID-like)
 * Format: ORD-TK-XXXXXXXX atau LND-TK-XXXXXXXX
 * Karakter: Alphanumeric non-ambigu (tanpa 0, O, 1, I) untuk kemudahan baca & ketik
 */
export function generateTrackingCode(prefix: 'ORD' | 'LND'): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let token = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    token += chars[bytes[i] % chars.length];
  }
  return `${prefix}-TK-${token}`;
}
