#!/usr/bin/env node
/**
 * generate_license_key.mjs
 * Developer Tool: Generator Serial Activation Key untuk Klien Standalone Beli-Putus (1x Bayar)
 *
 * Cara Penggunaan:
 *   node scripts/generate_license_key.mjs --hwid="CPOS-89F1-2B04-7E1A" --store="Bengkel Jaya Motor" --vertical="BENGKEL"
 *
 * Opsi:
 *   --hwid      Hardware ID dari tablet/komputer kasir (Format: CPOS-XXXX-XXXX-XXXX)
 *   --store     Nama Usaha / Toko klien
 *   --vertical  Jenis usaha: BENGKEL | RETAIL | CAFE | LAUNDRY | RENTAL (default: RETAIL)
 */

import crypto from 'node:crypto';

const MASTER_SALT = 'CODEPOS_STANDALONE_SECURE_HMAC_SALT_2026_V1';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, ...vals] = arg.slice(2).split('=');
      params[key] = vals.join('=');
    }
  }

  return params;
}

function generateSerialKey(hwid, storeName, vertical) {
  const cleanHwid = String(hwid || '').trim().toUpperCase();
  const cleanStore = String(storeName || '').trim().toUpperCase();
  const cleanVertical = String(vertical || 'RETAIL').trim().toUpperCase();

  if (!cleanHwid) {
    throw new Error('Hardware ID (--hwid) wajib diisi! Contoh: --hwid="CPOS-89F1-2B04-7E1A"');
  }
  if (!cleanStore) {
    throw new Error('Nama Toko (--store) wajib diisi! Contoh: --store="Toko Barokah"');
  }

  const payload = `${cleanHwid}#${cleanVertical}#${cleanStore}#${MASTER_SALT}`;
  const hashHex = crypto.createHash('sha256').update(payload).digest('hex').toUpperCase();

  const p1 = hashHex.slice(0, 4);
  const p2 = hashHex.slice(8, 12);
  const p3 = hashHex.slice(16, 20);
  const p4 = hashHex.slice(24, 28);
  const vertTag = cleanVertical.slice(0, 3);

  return {
    serialKey: `KEY-${vertTag}-${p1}-${p2}-${p3}-${p4}`,
    hwid: cleanHwid,
    storeName: cleanStore,
    vertical: cleanVertical,
    payloadHash: hashHex.slice(0, 16)
  };
}

// Execution
try {
  const args = parseArgs();

  const hwid = args.hwid || args.id;
  const store = args.store || args.name || 'Toko Demo Standalone';
  const vertical = args.vertical || args.vert || 'RETAIL';

  if (!hwid) {
    console.log(`
========================================================================
   🔐 CODEPOS STANDALONE LICENSE GENERATOR (OFFLINE ANTI-COPY)
========================================================================

Penggunaan:
  node scripts/generate_license_key.mjs --hwid="[HARDWARE_ID]" --store="[NAMA_TOKO]" --vertical="[VERTICAL]"

Contoh:
  node scripts/generate_license_key.mjs --hwid="CPOS-89F1-2B04-7E1A" --store="Bengkel Maju Motor" --vertical="BENGKEL"
  node scripts/generate_license_key.mjs --hwid="CPOS-A1B2-C3D4-E5F6" --store="Kopi Senja" --vertical="CAFE"
  node scripts/generate_license_key.mjs --hwid="CPOS-1122-3344-5566" --store="Toko Bangunan Makmur" --vertical="RETAIL"
========================================================================
`);
    process.exit(1);
  }

  const result = generateSerialKey(hwid, store, vertical);

  console.log(`
========================================================================
   ✅ LISENSI BELI-PUTUS CODEPOS BERHASIL DITERBITKAN
========================================================================
  Perangkat (HWID)  : \x1b[36m${result.hwid}\x1b[0m
  Nama Toko         : \x1b[33m${result.storeName}\x1b[0m
  Jenis Vertikal    : \x1b[35m${result.vertical}\x1b[0m
  Tipe Lisensi      : \x1b[32mLifetime Standalone (Beli-Putus 1x Bayar)\x1b[0m
------------------------------------------------------------------------
  SERIAL KEY AKTIVASI : \x1b[1m\x1b[42m\x1b[30m ${result.serialKey} \x1b[0m
========================================================================

Pesan WhatsApp siap kirim ke klien:
------------------------------------------------------------------------
Halo kak! Terima kasih atas pembelian CodePOS Standalone Beli-Putus.
Berikut Serial Key Aktivasi untuk perangkat Anda:

• Toko: *${result.storeName}*
• Vertikal: *${result.vertical}*
• Serial Key: *${result.serialKey}*

Silakan tempelkan kunci di atas pada form aktivasi di aplikasi kasir.
Aplikasi akan aktif permanen selamanya secara offline tanpa kuota internet!
------------------------------------------------------------------------
`);
} catch (err) {
  console.error('\x1b[31m[ERROR]:\x1b[0m', err.message);
  process.exit(1);
}
