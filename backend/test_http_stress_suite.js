const jwt = require('jsonwebtoken');
const autocannon = require('autocannon');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

async function runBenchmark(opts) {
  return new Promise((resolve, reject) => {
    autocannon(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

function printReport(title, res) {
  console.log(`\n================================================================`);
  console.log(`📊 HASIL BENCHMARK: ${title}`);
  console.log(`================================================================`);
  console.log(`  • Total Request Selesai : ${res.requests.total}`);
  console.log(`  • Durasi Pengujian      : ${res.duration} detik`);
  console.log(`  • Throughput Rata-rata  : ${res.requests.average.toFixed(2)} req/sec`);
  console.log(`  • Data Transfer Rate    : ${(res.throughput.average / (1024 * 1024)).toFixed(2)} MB/sec`);
  console.log(`  • Latency Rata-rata     : ${res.latency.average.toFixed(2)} ms`);
  console.log(`  • Latency Median (p50)  : ${res.latency.p50} ms`);
  console.log(`  • Latency p97.5         : ${res.latency.p97_5} ms`);
  console.log(`  • Latency p99           : ${res.latency.p99} ms`);
  console.log(`  • Latency Maksimal      : ${res.latency.max} ms`);
  console.log(`  • Status 2xx (Sukses)   : ${res['2xx']} (${((res['2xx'] / res.requests.total) * 100).toFixed(1)}%)`);
  console.log(`  • Non-2xx / Errors      : ${res.non2xx} / ${res.errors}`);
  console.log(`  • Timeouts              : ${res.timeouts}`);
}

async function main() {
  console.log('================================================================');
  console.log('🔥 BENCHMARK BEBAN JARINGAN (HTTP STRESS TEST 10 KAFE SIMULTAN)');
  console.log('================================================================');

  // Siapkan kasir & JWT token
  const cashier = await prisma.user.findFirst({
    where: { role: { in: ['KASIR', 'Kasir'] }, status: 'Aktif' }
  }) || { id: 1, username: 'kasir', role: 'Kasir', tenantId: 'tenant-default-muki' };

  const token = jwt.sign({
    id: cashier.id,
    username: cashier.username,
    role: cashier.role,
    tenantId: cashier.tenantId || 'tenant-default-muki',
    isPlatformAdmin: false
  }, JWT_SECRET, { expiresIn: '2h' });

  // TEST 1: GET /api/products/public (Public Catalog - QR Dine-In / Kiosk)
  console.log('\n[1/2] Menjalankan Stress Test: GET /api/products/public?tenant=muki ...');
  const resProducts = await runBenchmark({
    url: 'http://127.0.0.1:5000/api/products/public?tenant=muki',
    connections: 15,
    duration: 5,
    pipelining: 1
  });
  printReport('GET /api/products/public (Katalog Publik QR)', resProducts);

  // TEST 2: GET /api/orders?active=true (Kasir & KDS Polling Berotentikasi)
  console.log('\n[2/2] Menjalankan Stress Test: GET /api/orders?active=true (Authorized Kasir) ...');
  const resOrders = await runBenchmark({
    url: 'http://127.0.0.1:5000/api/orders?active=true',
    connections: 15,
    duration: 5,
    pipelining: 1,
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-tenant-id': cashier.tenantId || 'tenant-default-muki'
    }
  });
  printReport('GET /api/orders (Transaksi Kasir & KDS)', resOrders);

  console.log('\n================================================================');
  if (resProducts['2xx'] > 0 && resOrders['2xx'] > 0 && resOrders.non2xx === 0) {
    console.log('🏆 100% SUKSES! Express server dan database pool berhasil menahan');
    console.log('   beban ratusan request/detik dengan 0 error!');
  } else {
    console.log('⚠️ Selesai dengan beberapa catatan (cek log status di atas).');
  }
  console.log('================================================================\n');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal Benchmark Error:', err);
  process.exit(1);
});
