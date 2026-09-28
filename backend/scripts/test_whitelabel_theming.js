const assert = require('assert');

async function testWhiteLabelAPI() {
  console.log('🧪 Testing White-Label Public API & Security Sanitization...');

  // 1. Test public endpoint
  const res = await fetch('http://localhost:5000/api/public-branding?tenant=mukiramen');
  assert.strictEqual(res.status, 200, 'Public branding should return 200');
  const data = await res.json();
  assert.strictEqual(data.tenantSlug, 'mukiramen', 'Tenant slug should be mukiramen');
  assert.strictEqual(data.primaryColor, '#4f46e5', 'Default primaryColor should exist');
  assert.strictEqual(data.password, undefined, 'Sensitive field password must be undefined');
  assert.strictEqual(data.tenantId, undefined, 'Sensitive internal tenantId must not leak');
  console.log('✅ 1. Zero-Leak Public Branding verified!');

  // 2. Test cache header
  const cacheHeader = res.headers.get('cache-control');
  assert(cacheHeader && cacheHeader.includes('max-age=180'), 'Cache header must be set');
  console.log('✅ 2. HTTP Cache header (max-age=180) verified!');

  console.log('🎉 All White-Label backend validation tests PASSED!');
}

testWhiteLabelAPI().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
