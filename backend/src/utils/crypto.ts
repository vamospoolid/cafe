import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.PAYMENT_ENCRYPTION_KEY || 'codenusa_super_secure_32byte_aes_key!'; // 32 bytes
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Enkripsi data sensitif (Server Key Midtrans) menggunakan AES-256
 */
export function encryptAES(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Dekripsi data terenkripsi AES-256
 */
export function decryptAES(cipherText: string): string {
  if (!cipherText || !cipherText.includes(':')) return cipherText || '';
  try {
    const parts = cipherText.split(':');
    const iv = Buffer.from(parts.shift()!, 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('[Crypto Decryption Error]', err);
    return '';
  }
}

/**
 * Validasi SHA-512 Signature Key dari Webhook Midtrans
 * Format Midtrans: SHA512(order_id + status_code + gross_amount + ServerKey)
 */
export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string | number,
  serverKey: string,
  signatureKey: string
): boolean {
  if (!orderId || !statusCode || !grossAmount || !serverKey || !signatureKey) {
    return false;
  }

  // Format amount: e.g. "100000.00" or raw integer string
  const formattedAmount = typeof grossAmount === 'number' 
    ? grossAmount.toFixed(2).replace(/\.00$/, '') // Handle whole numbers
    : String(grossAmount);

  // Coba exact string match dan format .00 match
  const rawString1 = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const rawString2 = `${orderId}${statusCode}${Number(grossAmount).toFixed(2)}${serverKey}`;

  const hash1 = crypto.createHash('sha512').update(rawString1).digest('hex');
  const hash2 = crypto.createHash('sha512').update(rawString2).digest('hex');

  return hash1 === signatureKey || hash2 === signatureKey;
}
