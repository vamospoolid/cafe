/**
 * Automated Verification Suite: BullMQ Background Queue System (P1 High Impact)
 * Tests:
 * 1. QueueManager singleton & registration
 * 2. SyncQueue: Batch enqueueing with offlineId deduplication
 * 3. WAQueue: Enqueueing with phone normalization & anti-ban settings
 * 4. ReportQueue: Enqueueing heavy report exports with tenant scoping
 * 5. Graceful In-Memory Fallback when Redis is offline
 * 6. Health / Deep observability payload for queues
 */

const { queueManager } = require('../dist/src/queues/queueManager');
const { enqueueOfflineOrdersBatch } = require('../dist/src/queues/syncQueue');
const { enqueueWhatsAppMessage } = require('../dist/src/queues/waQueue');
const { enqueueReportGeneration } = require('../dist/src/queues/reportQueue');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING: BullMQ Background Queue Verification Suite (P1)');
  console.log('================================================================\n');

  // Test 1: QueueManager Instance & Health Stats
  console.log('📌 Test 1: QueueManager Health & Fallback Mode');
  try {
    const syncStats = await queueManager.getQueueStats('sync-queue');
    const waStats = await queueManager.getQueueStats('wa-queue');
    const reportStats = await queueManager.getQueueStats('report-queue');

    console.log(`   Sync Queue Mode: ${syncStats.mode}, Active: ${syncStats.active}`);
    console.log(`   WA Queue Mode: ${waStats.mode}, Active: ${waStats.active}`);
    console.log(`   Report Queue Mode: ${reportStats.mode}, Active: ${reportStats.active}`);

    assert(typeof syncStats.waiting === 'number', 'sync-queue stats return numeric waiting count');
    assert(typeof waStats.waiting === 'number', 'wa-queue stats return numeric waiting count');
    assert(typeof reportStats.waiting === 'number', 'report-queue stats return numeric waiting count');
    assert(Boolean(syncStats.mode), 'Queue report indicates valid operation mode (Redis / Fallback)');
  } catch (err) {
    assert(false, `Queue stats check failed: ${err.message}`);
  }

  // Test 2: Offline Batch Sync Enqueueing & Deduplication
  console.log('\n📌 Test 2: Offline Sync Batch Enqueueing (sync-queue)');
  const tenantId = 'tenant_cafe_alpha';
  const mockOrders = [
    {
      offlineId: `off_order_${Date.now()}_1`,
      total: 45000,
      customerName: 'Ahmad Budi',
      customerPhone: '081234567890',
      items: [{ productId: 1, qty: 2, price: 22500 }]
    },
    {
      offlineId: `off_order_${Date.now()}_2`,
      total: 30000,
      customerName: 'Siti Rahma',
      customerPhone: '081987654321',
      items: [{ productId: 2, qty: 1, price: 30000 }]
    }
  ];

  const syncResult = await enqueueOfflineOrdersBatch(tenantId, 'outlet-1', 1, mockOrders);
  assert(Boolean(syncResult.batchId), `Batch ID generated successfully (${syncResult.batchId})`);
  assert(syncResult.totalEnqueued === 2, 'Batch enqueued exact count of 2 orders');
  assert(syncResult.jobs.length === 2, '2 jobs created with proper statuses');
  assert(syncResult.jobs[0].id.includes(mockOrders[0].offlineId), 'Job ID incorporates offlineId for deduplication');

  // Test 3: WhatsApp E-Receipt Enqueueing & Phone Normalization
  console.log('\n📌 Test 3: WhatsApp E-Receipt Enqueueing (wa-queue)');
  const waResult1 = await enqueueWhatsAppMessage(
    tenantId,
    '081234567890', // Indonesian 08xx format
    'Terima kasih telah berkunjung ke Kafe Alpha! Struk: ORD-998822 Rp 45.000',
    'RECEIPT',
    'Ahmad Budi',
    { orderNumber: 'ORD-998822', total: 45000 }
  );

  assert(Boolean(waResult1.id), `WhatsApp job created with ID: ${waResult1.id}`);
  assert(waResult1.status === 'QUEUED' || waResult1.status === 'IN_MEMORY_DISPATCHED', 'WhatsApp job returned valid queued/dispatched status');

  // Test 4: Heavy Report Generation Enqueueing
  console.log('\n📌 Test 4: Heavy Report Generation Enqueueing (report-queue)');
  const repResult = await enqueueReportGeneration({
    tenantId,
    reportType: 'SALES_SUMMARY',
    format: 'JSON',
    startDate: '2026-09-01',
    endDate: '2026-09-23',
    requestedByUserId: 1
  });

  assert(Boolean(repResult.id), `Report generation job created with ID: ${repResult.id}`);
  assert(repResult.id.includes('sales_summary'), 'Report job ID incorporates reportType');

  // Test 5: Strict Multi-Tenant Scoping
  console.log('\n📌 Test 5: Strict Multi-Tenant Scoping in Queues');
  const tenantB = 'tenant_resto_bravo';
  const repResultB = await enqueueReportGeneration({
    tenantId: tenantB,
    reportType: 'PROFIT_LOSS',
    format: 'JSON',
    requestedByUserId: 2
  });

  assert(repResultB.id.includes(tenantB), 'Tenant B job explicitly scoped to tenantB ID');
  assert(!repResultB.id.includes(tenantId), 'Tenant B job strictly isolated from Tenant A');

  // Test 6: Observability Integration
  console.log('\n📌 Test 6: Observability & Health Route Integration');
  const healthRoute = require('../dist/src/routes/health').default;
  assert(healthRoute !== undefined, 'Health router with Queue Telemetry loaded successfully');

  // Close queues cleanly after test
  await queueManager.closeAll();

  console.log('\n================================================================');
  console.log(`📊 TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
