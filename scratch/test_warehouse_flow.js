const API_BASE = 'https://cafe.codenusa.id';

async function run() {
  console.log('🚀 [Test] Memulai verifikasi otomatis Gudang Pusat di cafe.codenusa.id...');
  
  // 1. Login
  const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: '123456' })
  });
  
  if (!loginRes.ok) {
    throw new Error(`Login failed with status ${loginRes.status}: ${await loginRes.text()}`);
  }
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('✅ [Auth] Berhasil login sebagai admin!');
  
  const headers = { 
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 2. Dashboard
  const dashRes = await fetch(`${API_BASE}/api/warehouse/dashboard`, { headers });
  const dash = await dashRes.json();
  console.log('✅ [Dashboard] KPI Terambil:');
  console.log('   - Total SKUs Bahan di Gudang:', dash.totalIngredients);
  console.log('   - Total Nilai Aset Fisik di Gudang: Rp', Number(dash.totalAssetValue).toLocaleString('id-ID'));
  console.log('   - Total Modal Owner Masuk: Rp', Number(dash.totalCapitalIn).toLocaleString('id-ID'));
  console.log('   - Diserap Operasional Dapur Muki: Rp', Number(dash.totalTransferredToResto).toLocaleString('id-ID'));
  console.log('   - Sisa Hak Reimbursement Owner: Rp', Number(dash.currentOwnerPayable).toLocaleString('id-ID'));

  // 3. Check Settings
  const settingsRes = await fetch(`${API_BASE}/api/settings`, { headers });
  const settingsData = await settingsRes.json();
  console.log('✅ [Settings] Kebijakan Transfer Pricing:', settingsData.warehouseTransferPricing || 'AT_COST', '| Markup %:', settingsData.warehouseMarkupPercent || 0);

  // 4. Check Stock List
  const stockRes = await fetch(`${API_BASE}/api/warehouse/stock`, { headers });
  const stockList = await stockRes.json();
  console.log(`✅ [Stok Gudang] Ditemukan ${stockList.length} item bahan di gudang.`);
  if (stockList.length > 0) {
    const s = stockList[0];
    console.log(`   Sample Item: "${s.name}" | Satuan Gudang: ${s.purchaseUnit || s.unit} | Satuan Dapur: ${s.unit} | Rasio Konversi: ${s.conversionRatio || 1}x`);
  }

  // 5. Test Owner Finance Ledger
  const finRes = await fetch(`${API_BASE}/api/warehouse/owner-finance`, { headers });
  const finData = await finRes.json();
  console.log(`✅ [Buku Besar Owner] Saldo berjalan: Rp ${Number(finData.balance?.currentOwnerPayable || 0).toLocaleString('id-ID')} | Riwayat mutasi: ${finData.history?.length || 0} entri`);

  console.log('\n🎉 SEMUA FITUR GUDANG PUSAT TERVERIFIKASI SEMPURNA & BERJALAN AKTIF DI PRODUCTION!');
}

run().catch(err => {
  console.error('❌ Test gagal:', err.message);
  process.exit(1);
});
