/**
 * SEED WAREHOUSE SAMPLE DATA
 * Jalankan: node scratch/seed_warehouse_sample.js
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'https://cafe.codenusa.id';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '123456';  // PIN / password admin

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      },
      rejectUnauthorized: false
    };
    const req = lib.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('\n WAREHOUSE SAMPLE DATA SEEDER\n');

  // 1. Login
  console.log('Step 1: Login admin...');
  const loginRes = await request('POST', '/api/auth/login', {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD
  });
  if (loginRes.status !== 200 || !loginRes.data.token) {
    console.error('Login gagal:', loginRes.data);
    process.exit(1);
  }
  const token = loginRes.data.token;
  console.log('Login berhasil.\n');

  // 2. Ambil bahan baku
  console.log('Step 2: Ambil daftar bahan baku...');
  const stockRes = await request('GET', '/api/warehouse/stock', null, token);
  const ingredients = stockRes.data;
  console.log(`Ditemukan ${ingredients.length} bahan baku.\n`);
  if (ingredients.length < 2) {
    console.error('Perlu minimal 2 bahan baku. Tambahkan dulu di menu Bahan Baku.');
    process.exit(1);
  }

  const [bahan1, bahan2, bahan3] = ingredients.slice(0, 3);
  console.log('Bahan yang digunakan:');
  console.log(`  [1] ${bahan1.name} (unit: ${bahan1.unit})`);
  console.log(`  [2] ${bahan2.name} (unit: ${bahan2.unit})`);
  if (bahan3) console.log(`  [3] ${bahan3.name} (unit: ${bahan3.unit})`);
  console.log('');

  // 3. Inbound #1 - Belanja normal
  console.log('Step 3: Inbound #1 - Belanja normal (Modal Pusat)...');
  const inb1 = await request('POST', '/api/warehouse/inbound', {
    supplierId: null,
    supplierName: 'Pasar Induk Kramat Jati',
    paymentSource: 'DANA_PRIBADI_OWNER',
    date: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
    notes: 'Belanja mingguan bahan baku pokok',
    items: [
      { ingredientId: bahan1.id, itemName: bahan1.name, purchaseUnit: 'Karton', purchaseQty: 3, conversionRatio: 12, purchasePrice: 180000 },
      { ingredientId: bahan2.id, itemName: bahan2.name, purchaseUnit: 'Karung', purchaseQty: 2, conversionRatio: 25, purchasePrice: 375000 }
    ]
  }, token);
  if (inb1.status === 201) console.log(`  OK: ${inb1.data.inbound.invoiceNumber} — Rp ${inb1.data.inbound.totalAmount.toLocaleString('id-ID')}\n`);
  else console.log('  GAGAL:', inb1.data?.error || 'unknown', '\n');

  // 4. Inbound #2 - Akan di-void (salah input)
  console.log('Step 4: Inbound #2 - Salah input (akan di-void)...');
  const inb2 = await request('POST', '/api/warehouse/inbound', {
    supplierId: null,
    supplierName: 'Toko NURMADINA',
    paymentSource: 'DANA_PRIBADI_OWNER',
    date: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
    notes: 'CONTOH SALAH INPUT - qty 100 karton padahal harusnya 1',
    items: [
      { ingredientId: bahan1.id, itemName: bahan1.name, purchaseUnit: 'Karton', purchaseQty: 100, conversionRatio: 12, purchasePrice: 180000 }
    ]
  }, token);
  let inb2Id = null;
  if (inb2.status === 201) {
    inb2Id = inb2.data.inbound.id;
    console.log(`  OK: ${inb2.data.inbound.invoiceNumber} — Rp ${inb2.data.inbound.totalAmount.toLocaleString('id-ID')} (SALAH!)\n`);
  } else console.log('  GAGAL:', inb2.data?.error, '\n');

  // 5. Void inbound #2
  if (inb2Id) {
    console.log('Step 5: VOID Inbound #2 (koreksi salah input)...');
    const voidRes = await request('POST', `/api/warehouse/inbounds/${inb2Id}/void`, {
      voidReason: 'Salah input quantity — harusnya 1 Karton bukan 100 Karton. Koreksi oleh admin.'
    }, token);
    if (voidRes.status === 200) console.log(`  OK: ${voidRes.data.message}\n`);
    else console.log('  GAGAL:', voidRes.data?.error, '\n');
  }

  // 6. Inbound #3 - Kas Operasional
  if (bahan3) {
    console.log('Step 6: Inbound #3 - Belanja via Kas Operasional...');
    const inb3 = await request('POST', '/api/warehouse/inbound', {
      supplierId: null,
      supplierName: 'Supermarket Giant Mampang',
      paymentSource: 'KAS_MUKI',
      date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      notes: 'Pembelian insidental dari kas operasional cabang',
      items: [
        { ingredientId: bahan3.id, itemName: bahan3.name, purchaseUnit: 'Jerigen', purchaseQty: 4, conversionRatio: 5000, purchasePrice: 55000 }
      ]
    }, token);
    if (inb3.status === 201) console.log(`  OK: ${inb3.data.inbound.invoiceNumber} (Kas Operasional)\n`);
    else console.log('  GAGAL:', inb3.data?.error, '\n');
  }

  // 7. Buat Requisition Transfer ke Dapur
  console.log('Step 7: Buat Requisition Transfer ke Dapur...');
  const reqRes = await request('POST', '/api/warehouse/transfers', {
    notes: 'Permintaan bahan minggu pertama — kebutuhan dapur normal',
    items: [
      { ingredientId: bahan1.id, requestedUnit: bahan1.unit, requestedQty: 15 },
      { ingredientId: bahan2.id, requestedUnit: bahan2.unit, requestedQty: 10 }
    ]
  }, token);
  let reqId = null;
  if (reqRes.status === 201) {
    reqId = reqRes.data.requisition?.id;
    console.log(`  OK: ${reqRes.data.requisition?.reqNumber} — Status: ${reqRes.data.requisition?.status}\n`);
  } else console.log('  GAGAL:', reqRes.data?.error, '\n');

  // 8. Approve + Receive
  if (reqId) {
    console.log('Step 8: Approve Requisition...');
    const appRes = await request('PUT', `/api/warehouse/transfers/${reqId}/approve`, { approvedNotes: 'Disetujui' }, token);
    console.log(`  ${appRes.status === 200 ? 'OK: APPROVED' : 'GAGAL: ' + appRes.data?.error}\n`);

    console.log('Step 9: Konfirmasi Penerimaan di Dapur...');
    const recRes = await request('PUT', `/api/warehouse/transfers/${reqId}/receive`, { receivedNotes: 'Diterima lengkap' }, token);
    console.log(`  ${recRes.status === 200 ? 'OK: RECEIVED' : 'GAGAL: ' + recRes.data?.error}\n`);
  }

  // 10. Settlement
  console.log('Step 10: Settlement sebagian Modal Pusat...');
  const setRes = await request('POST', '/api/warehouse/owner-finance/reimburse', {
    amount: 350000,
    paymentMethod: 'Transfer Bank',
    deductFromBranchCash: true,
    notes: 'Cicilan pertama — transfer BCA ref #SAMPLE001'
  }, token);
  console.log(`  ${setRes.status === 201 ? 'OK: Settlement Rp 350.000 berhasil' : 'GAGAL: ' + setRes.data?.error}\n`);

  console.log('========================================');
  console.log('SELESAI! Buka cafe.codenusa.id/gudang');
  console.log('');
  console.log('Yang akan terlihat:');
  console.log('  Tab Penerimaan Pasokan:');
  console.log('    - INB-xxx (Pasar Induk)   : AKTIF, 2 bahan, Rp 1.290.000');
  console.log('    - INB-xxx (Toko NURMADINA): VOID/DIBATALKAN (salah qty 100 karton)');
  console.log('    - INB-xxx (Giant Mampang) : AKTIF, 1 bahan, Kas Operasional');
  console.log('  Tab Distribusi ke Dapur:');
  console.log('    - REQ-xxx: RECEIVED — kewajiban settlement terbentuk');
  console.log('  Tab Rekonsiliasi & Settlement:');
  console.log('    - Investasi modal pusat masuk');
  console.log('    - Koreksi VOID (negatif = reversal)');
  console.log('    - Distribusi ke Dapur');
  console.log('    - Settlement Rp 350.000 (cicilan)');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
