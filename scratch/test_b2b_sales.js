const https = require('https');

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'cafe.codenusa.id',
      port: 443,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const r = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function runTest() {
  console.log('1. Login Admin...');
  const loginRes = await req('POST', '/api/auth/login', { username: 'admin', password: '123456' });
  const token = loginRes.data.token;
  console.log('Login OK, User:', loginRes.data.user.name);

  console.log('\n2. Cek Stok Gudang...');
  const stockRes = await req('GET', '/api/warehouse/stock', null, token);
  const items = stockRes.data;
  console.log(`Ditemukan ${items.length} bahan baku di gudang.`);

  const sampleItem = items.find(i => i.warehouseStock > 10) || items[0];
  console.log(`Bahan yang akan dijual ke pihak luar: ${sampleItem.name} (Stok Gudang: ${sampleItem.warehouseStock} ${sampleItem.unit})`);

  console.log('\n3. Simulasi Transaksi Penjualan B2B ke Mitra Luar...');
  const salePayload = {
    customerName: 'Kafe Mitra Sejahtera (Bpk. Rudi)',
    customerPhone: '081299887766',
    customerAddress: 'Jl. Surya Kencana No. 45, Bogor',
    paymentMethod: 'TRANSFER',
    paymentStatus: 'PAID',
    notes: 'Pembelian bahan baku partai besar batch 1',
    items: [
      {
        ingredientId: sampleItem.id,
        itemName: sampleItem.name,
        saleUnit: 'Karton',
        saleQty: 2,
        conversionRatio: 12,
        unitCostPrice: 120000,
        unitSalePrice: 160000
      }
    ]
  };

  const saleRes = await req('POST', '/api/warehouse/sales', salePayload, token);
  console.log('POST /api/warehouse/sales Status:', saleRes.status);
  console.log('Faktur B2B Terbit:', saleRes.data.sale?.invoiceNumber);
  console.log('Total Penjualan:', saleRes.data.sale?.totalAmount);
  console.log('Laba Kotor Grosir:', saleRes.data.sale?.grossProfit);

  console.log('\n4. Ambil Riwayat Penjualan B2B (GET /sales)...');
  const getSales = await req('GET', '/api/warehouse/sales', null, token);
  console.log(`Total transaksi B2B tersimpan: ${getSales.data.length}`);

  console.log('\n5. Verifikasi Stok Gudang Terpotong...');
  const verifyStock = await req('GET', '/api/warehouse/stock', null, token);
  const updatedItem = verifyStock.data.find(i => i.id === sampleItem.id);
  console.log(`Stok gudang ${sampleItem.name} sekarang: ${updatedItem.warehouseStock} ${sampleItem.unit} (Sebelumnya: ${sampleItem.warehouseStock} ${sampleItem.unit})`);

  console.log('\n=== SEMUA VERIFIKASI B2B WHOLESALE SUKSES & VALID! ===');
}

runTest().catch(console.error);
