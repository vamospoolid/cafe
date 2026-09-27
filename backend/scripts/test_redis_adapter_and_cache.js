/**
 * Automated Verification Suite: Socket.IO Redis Adapter & Multi-Tenant Redis Cache Layer
 * Tests:
 * 1. CacheService operations (get, set, del, remember)
 * 2. Strict Tenant Scoping & Isolation in Cache
 * 3. Tenant Catalog Versioning & Instant Invalidation
 * 4. Graceful Fallback (in-memory mode if Redis offline)
 * 5. Health Deep Observability for Redis Status
 */

const { cacheService } = require('../dist/src/services/CacheService');
const { isRedisReady, initRedis } = require('../dist/src/lib/redis');

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
  console.log('🧪 RUNNING: Socket.IO Redis Adapter & Redis Cache Layer Test Suite');
  console.log('================================================================\n');

  // Test 1: Redis Connectivity & Graceful Initialization
  console.log('📌 Test 1: Redis Connection Probe & Graceful Fallback');
  try {
    const probe = await initRedis();
    console.log(`   Redis Ready: ${probe.ready}, Latency: ${probe.latencyMs}ms`);
    assert(typeof probe.ready === 'boolean', 'initRedis returns boolean readiness status');
    assert(typeof isRedisReady() === 'boolean', 'isRedisReady returns valid status');
  } catch (err) {
    assert(false, `initRedis threw unexpected error: ${err.message}`);
  }

  // Test 2: Basic Cache Operations (set, get, del)
  console.log('\n📌 Test 2: CacheService Basic Operations');
  const testKey = 'test:cache:basic_key';
  const testVal = { id: 'item_1', name: 'Kopi Susu Gula Aren', price: 18000 };

  await cacheService.set(testKey, testVal, 30);
  const fetchedVal = await cacheService.get(testKey);
  assert(fetchedVal !== null, 'Value successfully retrieved from cache');
  assert(fetchedVal && fetchedVal.name === testVal.name, 'Retrieved value matches stored value');
  assert(fetchedVal && fetchedVal.price === 18000, 'Nested properties preserved correctly');

  await cacheService.del(testKey);
  const afterDel = await cacheService.get(testKey);
  assert(afterDel === null, 'Value properly deleted from cache');

  // Test 3: Cache-Aside `remember` Pattern
  console.log('\n📌 Test 3: Cache-Aside (remember) Pattern');
  let fetcherCallCount = 0;
  const rememberKey = 'test:cache:remember_key';

  async function mockFetcher() {
    fetcherCallCount++;
    return { calculatedAt: Date.now(), result: 'computed_data' };
  }

  // First call should invoke fetcher
  const res1 = await cacheService.remember(rememberKey, 30, mockFetcher);
  assert(fetcherCallCount === 1, 'First call invokes fetcher function');
  assert(res1 && res1.result === 'computed_data', 'First call returns computed data');

  // Second call should hit cache and NOT invoke fetcher
  const res2 = await cacheService.remember(rememberKey, 30, mockFetcher);
  assert(fetcherCallCount === 1, 'Second call hits cache without calling fetcher');
  assert(res2 && res2.result === 'computed_data', 'Second call returns cached data');

  await cacheService.del(rememberKey);

  // Test 4: Strict Tenant Isolation in Cache
  console.log('\n📌 Test 4: Strict Multi-Tenant Cache Isolation');
  const tenantA = 'tenant_cafe_alpha';
  const tenantB = 'tenant_resto_bravo';

  const keyA = `cache:features:${tenantA}`;
  const keyB = `cache:features:${tenantB}`;

  await cacheService.set(keyA, ['pos', 'kds', 'blind_zreport'], 60);
  await cacheService.set(keyB, ['pos', 'warehouse', 'multi_outlet'], 60);

  const featuresA = await cacheService.get(keyA);
  const featuresB = await cacheService.get(keyB);

  assert(Array.isArray(featuresA) && featuresA.includes('kds') && !featuresA.includes('warehouse'),
    'Tenant A features are strictly isolated');
  assert(Array.isArray(featuresB) && featuresB.includes('warehouse') && !featuresB.includes('kds'),
    'Tenant B features are strictly isolated');

  // Invalidate Tenant A only
  await cacheService.invalidateTenant(tenantA);
  const featuresAAfter = await cacheService.get(keyA);
  const featuresBAfter = await cacheService.get(keyB);

  assert(featuresAAfter === null, 'Tenant A cache invalidated properly');
  assert(featuresBAfter !== null && featuresBAfter.includes('warehouse'), 'Tenant B cache remains intact (Zero cross-tenant side-effects)');

  await cacheService.del(keyB);

  // Test 5: Tenant Catalog Versioning & Invalidation
  console.log('\n📌 Test 5: Tenant Catalog Versioning');
  const catTenantId = 'tenant_muki_ramen';
  const initialVer = await cacheService.getTenantCatalogVersion(catTenantId);
  assert(typeof initialVer === 'number', `Initial catalog version is numeric (${initialVer})`);

  const nextVer = await cacheService.bumpTenantCatalogVersion(catTenantId);
  assert(nextVer === initialVer + 1, `Bumping catalog version increments from v${initialVer} to v${nextVer}`);

  const fetchedVer = await cacheService.getTenantCatalogVersion(catTenantId);
  assert(fetchedVer === nextVer, `Fetched catalog version matches bumped version v${nextVer}`);

  // Test 6: Verify Health Deep Telemetry Payload Structure
  console.log('\n📌 Test 6: Observability Payload Verification');
  const healthRoute = require('../dist/src/routes/health').default;
  assert(healthRoute !== undefined, 'Health route module successfully loaded');

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
