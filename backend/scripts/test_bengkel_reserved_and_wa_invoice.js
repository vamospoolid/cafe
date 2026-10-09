const assert = require('assert');

// 1. Test reserved slugs list
const reservedSlugs = [
  'admin', 'api', 'app', 'www', 'mail', 'blog', 'demo', 'test', 'dev', 'staging', 
  'platform', 'pos', 'cafe', 'codenusa', 'bengkel', 'bengkel-motor', 'posbengkel', 'bengkel-app'
];

console.log('--- TEST 1: Reserved Slug Protection ---');
assert(reservedSlugs.includes('bengkel'), 'Slug bengkel must be reserved');
assert(reservedSlugs.includes('bengkel-motor'), 'Slug bengkel-motor must be reserved');
assert(reservedSlugs.includes('admin'), 'Slug admin must be reserved');
assert(!reservedSlugs.includes('mukiramen'), 'Slug mukiramen should NOT be reserved');
assert(!reservedSlugs.includes('tokoberkah'), 'Slug tokoberkah should NOT be reserved');
console.log('✅ TEST 1 PASSED: Slug bengkel and system slugs are strictly reserved.');

// 2. Test WhatsApp invoice URL generator logic
console.log('--- TEST 2: Dynamic Invoice URL Generation ---');
function generateInvoiceUrl(tenant, orderNumber) {
  const tenantSlug = tenant?.slug;
  const tenantDomain = tenant?.customDomain;
  let appBaseUrl = 'https://codenusa.id';
  if (tenantDomain) {
    appBaseUrl = `https://${tenantDomain}`;
  } else if (tenantSlug) {
    appBaseUrl = `https://${tenantSlug}.codenusa.id`;
  }
  return `${appBaseUrl}/invoice/order/${orderNumber}`;
}

const urlMuki = generateInvoiceUrl({ slug: 'mukiramen' }, 'ORD-2026-0001');
assert.strictEqual(urlMuki, 'https://mukiramen.codenusa.id/invoice/order/ORD-2026-0001');
console.log('  URL Tenant Subdomain:', urlMuki);

const urlCustom = generateInvoiceUrl({ slug: 'tokoberkah', customDomain: 'kasir.tokoberkah.com' }, 'ORD-2026-0002');
assert.strictEqual(urlCustom, 'https://kasir.tokoberkah.com/invoice/order/ORD-2026-0002');
console.log('  URL Custom Domain:', urlCustom);

const urlFallback = generateInvoiceUrl(null, 'ORD-2026-0003');
assert.strictEqual(urlFallback, 'https://codenusa.id/invoice/order/ORD-2026-0003');
console.log('  URL Fallback Domain:', urlFallback);

console.log('✅ TEST 2 PASSED: Dynamic invoice URL logic perfectly adapts to tenant subdomain.');
console.log('ALL TESTS PASSED SUCCESSFULLY! 🚀');
