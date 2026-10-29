/**
 * EMVCo MPM QRIS Dynamic Generator & CRC-16/CCITT-FALSE Checksum Engine
 * Mengonversi QRIS Statis UMKM (Tag 01 = 11) menjadi QRIS Dinamis (Tag 01 = 12)
 * dengan menyuntikkan Tag 54 (Nominal Transaksi + Kode Unik) dan menghitung ulang Tag 63 (CRC-16).
 */

export interface TLVNode {
  tag: string;
  length: number;
  value: string;
}

/**
 * Menghitung Checksum CRC-16/CCITT-FALSE (Polynomial 0x1021, Initial 0xFFFF)
 * Sesuai Standar Nasional QRIS Bank Indonesia (EMVCo MPM Tag 63).
 */
export function computeCRC16CCITT(payloadWith6304: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payloadWith6304.length; i++) {
    crc ^= payloadWith6304.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Mem-parsing string EMVCo QRIS menjadi daftar node TLV berurutan.
 */
export function parseEMVCoTLV(rawQris: string): TLVNode[] {
  const clean = rawQris.trim();
  const nodes: TLVNode[] = [];
  let idx = 0;

  while (idx + 4 <= clean.length) {
    const tag = clean.substring(idx, idx + 2);
    const lenStr = clean.substring(idx + 2, idx + 4);
    const length = parseInt(lenStr, 10);
    if (isNaN(length) || length < 0 || idx + 4 + length > clean.length) {
      break;
    }
    const value = clean.substring(idx + 4, idx + 4 + length);
    nodes.push({ tag, length, value });
    idx += 4 + length;
    if (tag === '63') {
      break;
    }
  }

  return nodes;
}

/**
 * Memvalidasi apakah string adalah payload EMVCo QRIS yang sah.
 */
export function isValidStaticQris(rawQris: string): boolean {
  if (!rawQris || typeof rawQris !== 'string') return false;
  const clean = rawQris.trim();
  if (!clean.startsWith('000201')) return false;
  const nodes = parseEMVCoTLV(clean);
  if (nodes.length < 5) return false;
  const hasMerchantInfo = nodes.some(n => ['26', '27', '51'].includes(n.tag));
  const hasCountry = nodes.some(n => n.tag === '58');
  return hasMerchantInfo && hasCountry;
}

/**
 * Membuat template QRIS Statis standar EMVCo berdasarkan Nama Toko & Kota
 * (Digunakan sebagai fallback/simulator apabila pemilik toko belum mengunggah QRIS asli).
 */
export function buildFallbackStaticQris(merchantName: string, merchantCity = 'INDONESIA'): string {
  const safeName = (merchantName || 'LAUNDRY OUTLET').toUpperCase().replace(/[^A-Z0-9 .,-]/g, '').substring(0, 25) || 'LAUNDRY OUTLET';
  const safeCity = (merchantCity || 'JAKARTA').toUpperCase().replace(/[^A-Z0-9 .,-]/g, '').substring(0, 15) || 'JAKARTA';

  const formatTLV = (tag: string, val: string) => `${tag}${val.length.toString().padStart(2, '0')}${val}`;

  // Sub-TLV untuk Tag 26 (Merchant Account Information)
  const domGui = formatTLV('00', 'ID.CO.QRIS.WWW');
  const mpan = formatTLV('01', '936009140000000001');
  const mid = formatTLV('02', 'ID1026000000001');
  const criteria = formatTLV('03', 'UMI');
  const tag26 = formatTLV('26', `${domGui}${mpan}${mid}${criteria}`);

  const body = [
    formatTLV('00', '01'),
    formatTLV('01', '11'),
    tag26,
    formatTLV('52', '7210'), // MCC Laundry & Drycleaning Services
    formatTLV('53', '360'),  // IDR Currency
    formatTLV('58', 'ID'),
    formatTLV('59', safeName),
    formatTLV('60', safeCity),
    formatTLV('61', '10110')
  ].join('');

  const payloadForCrc = `${body}6304`;
  const crc = computeCRC16CCITT(payloadForCrc);
  return `${payloadForCrc}${crc}`;
}

/**
 * Mengonversi QRIS Statis menjadi QRIS Dinamis EMVCo dengan menyuntikkan:
 * - Tag 01 = "12" (Dynamic QRIS)
 * - Tag 54 = Nominal bulat (tanpa desimal)
 * - Tag 63 = Checksum CRC-16/CCITT-FALSE baru
 */
export function convertStaticToDynamicQris(staticQris: string, amount: number): string {
  const cleanAmount = Math.max(1, Math.round(Number(amount) || 0));
  const amountStr = String(cleanAmount);

  const nodes = parseEMVCoTLV(staticQris);
  if (nodes.length < 4) {
    throw new Error('Format string QRIS Statis tidak valid (bukan standar EMVCo)');
  }

  // Buang Tag 63 lama dan Tag 54 lama jika ada
  const filteredNodes = nodes.filter(n => n.tag !== '63' && n.tag !== '54');

  // Pastikan Tag 01 bernilai "12" (Dinamis)
  const hasTag01 = filteredNodes.some(n => n.tag === '01');
  if (hasTag01) {
    for (const node of filteredNodes) {
      if (node.tag === '01') {
        node.value = '12';
        node.length = 2;
      }
    }
  } else {
    // Sisipkan setelah Tag 00
    filteredNodes.splice(1, 0, { tag: '01', length: 2, value: '12' });
  }

  // Sisipkan Tag 54 (Transaction Amount) tepat setelah Tag 53 (Transaction Currency) atau sebelum Tag 58 (Country Code)
  const tag54Node: TLVNode = {
    tag: '54',
    length: amountStr.length,
    value: amountStr
  };

  const idx53 = filteredNodes.findIndex(n => n.tag === '53');
  const idx58 = filteredNodes.findIndex(n => n.tag === '58');

  if (idx53 !== -1) {
    filteredNodes.splice(idx53 + 1, 0, tag54Node);
  } else if (idx58 !== -1) {
    filteredNodes.splice(idx58, 0, tag54Node);
  } else {
    filteredNodes.push(tag54Node);
  }

  // Rakit kembali string TLV tanpa Tag 63
  const serializedBody = filteredNodes
    .map(n => `${n.tag}${n.value.length.toString().padStart(2, '0')}${n.value}`)
    .join('');

  const payloadWith6304 = `${serializedBody}6304`;
  const crcHex = computeCRC16CCITT(payloadWith6304);
  return `${payloadWith6304}${crcHex}`;
}

/**
 * Mengekstrak kandidat angka nominal Rupiah dari teks Push Notification Android
 * Mendukung format: GoPay Merchant, Dana Bisnis, ShopeePay Merchant, Livin Merchant, BCA, BRI, QRIS Soundbox.
 * Contoh:
 * - "Pembayaran QRIS sebesar Rp 35.017 berhasil diterima" -> [35017]
 * - "Dana masuk Rp35,017.00 dari BUDI" -> [35017]
 * - "Terima IDR 35017 via QRIS" -> [35017]
 */
export function extractNominalFromNotification(notificationText: string): number[] {
  if (!notificationText || typeof notificationText !== 'string') return [];

  const candidates = new Set<number>();

  // 1. Cari pola dengan prefix Rp / IDR (misal: Rp 35.017, Rp35,017.00, IDR 35.017)
  const currencyRegex = /(?:rp\.?|idr)\s*([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,9})(?:[.,][0-9]{2})?\b/gi;
  let match: RegExpExecArray | null;
  while ((match = currencyRegex.exec(notificationText)) !== null) {
    const rawNum = match[1].replace(/[.,]/g, '');
    const parsed = parseInt(rawNum, 10);
    if (!isNaN(parsed) && parsed >= 100) {
      candidates.add(parsed);
    }
  }

  // 2. Cari pola angka ribuan bertitik/koma atau angka bulat >= 1000 di dalam teks
  const generalNumberRegex = /\b([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{4,9})\b/g;
  while ((match = generalNumberRegex.exec(notificationText)) !== null) {
    const rawNum = match[1].replace(/\./g, '');
    const parsed = parseInt(rawNum, 10);
    if (!isNaN(parsed) && parsed >= 100) {
      candidates.add(parsed);
    }
  }

  return Array.from(candidates);
}

