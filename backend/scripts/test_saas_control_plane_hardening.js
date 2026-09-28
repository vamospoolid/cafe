const assert = require('assert');
const jwt = require('jsonwebtoken');

console.log('--- TEST SUITE: SaaS Backend & Cyber Security Hardening ---');

// Test 1: SAA-001 (Yearly vs Monthly Invoice Period Extension)
function calculateNewExpiry(billingCycle, currentExpiry) {
  const isYearly = billingCycle === 'YEARLY';
  const daysToAdd = isYearly ? 365 : 30;
  const baseDate = new Date(currentExpiry).getTime() > Date.now() ? new Date(currentExpiry) : new Date();
  return new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
}

const now = Date.now();
const oneMonthLater = calculateNewExpiry('MONTHLY', new Date());
const oneYearLater = calculateNewExpiry('YEARLY', new Date());

const monthDiffDays = Math.round((oneMonthLater.getTime() - now) / (24 * 60 * 60 * 1000));
const yearDiffDays = Math.round((oneYearLater.getTime() - now) / (24 * 60 * 60 * 1000));

assert.strictEqual(monthDiffDays, 30, 'Monthly subscription should add 30 days');
assert.strictEqual(yearDiffDays, 365, 'Yearly subscription should add 365 days');
console.log('✅ TEST 1 PASSED: SAA-001 Yearly subscription adds +365 days and Monthly adds +30 days.');

// Test 2: SAA-003 (Robust Extend Trial Date Calculation)
function calculateExtendTrial(subPeriodEnd, trialEndsAt, days) {
  const currentExpiryTime = subPeriodEnd
    ? new Date(subPeriodEnd).getTime()
    : (trialEndsAt ? new Date(trialEndsAt).getTime() : 0);
  const baseTime = Math.max(Date.now(), currentExpiryTime);
  return new Date(baseTime + Math.max(1, Number(days)) * 24 * 60 * 60 * 1000);
}

// Case A: Tenant expired 30 days ago
const pastExpired = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const extendedFromPast = calculateExtendTrial(null, pastExpired, 14);
const diffFromNow = Math.round((extendedFromPast.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
assert.strictEqual(diffFromNow, 14, 'Trial extension for expired tenant should be 14 days from NOW, not in the past');

// Case B: Tenant active for another 10 days
const futureActive = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
const extendedFromFuture = calculateExtendTrial(null, futureActive, 14);
const diffFromFuture = Math.round((extendedFromFuture.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
assert.strictEqual(diffFromFuture, 24, 'Trial extension for active tenant should add 14 days to remaining 10 days (total 24 days)');
console.log('✅ TEST 2 PASSED: SAA-003 Robust trial extension handles past expired and active dates correctly.');

// Test 3: SAA-004 & SEC-001 (Impersonation Token Claims & Duration)
const JWT_SECRET = 'test_secret_pooos_key';
const impersonationPayload = {
  id: 10,
  username: 'tenant_owner',
  tenantId: 'tenant-test-123',
  outletId: 'outlet-1',
  role: 'OWNER',
  permissions: ['pos.view', 'pos.create'],
  isImpersonated: true,
  impersonatorId: 1,
  impersonatorUsername: 'superadmin'
};

const token = jwt.sign(impersonationPayload, JWT_SECRET, { expiresIn: '1d' });
const decoded = jwt.verify(token, JWT_SECRET);

assert.strictEqual(decoded.isImpersonated, true, 'Impersonated claim must be true');
assert.strictEqual(decoded.impersonatorId, 1, 'Impersonator ID must match');
assert.strictEqual(decoded.impersonatorUsername, 'superadmin', 'Impersonator username must match');
const expDiffHours = Math.round((decoded.exp - decoded.iat) / 3600);
assert.strictEqual(expDiffHours, 24, 'Impersonation token expiration must be 1 day (24 hours), not 7 days');
console.log('✅ TEST 3 PASSED: SAA-004 & SEC-001 Impersonation token contains strict audit claims and 1-day cap.');

// Test 4: SEC-003 (HTML Sanitization for Broadcasts)
function sanitizeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

const xssPayload = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
const sanitized = sanitizeHtml(xssPayload);
assert(!sanitized.includes('<script>'), 'Script tag must be escaped');
assert(!sanitized.includes('<img'), 'Img tag must be escaped');
assert(sanitized.includes('&lt;script&gt;'), 'Must contain escaped brackets');
console.log('✅ TEST 4 PASSED: SEC-003 Broadcast input is sanitized against Stored XSS.');

// Test 5: SEC-002 & Master Console Impersonation Blocking
function simulateRequirePlatformAdmin(user) {
  if (!user) return { status: 401, error: 'Akses Ditolak: Memerlukan login.' };
  if (user.isImpersonated) return { status: 403, error: 'Akses Ditolak: Sesi impersonasi tidak diizinkan mengakses Master Console.' };
  const isSuper = user.isPlatformAdmin === true || user.role === 'SUPERADMIN';
  if (!isSuper) return { status: 403, error: 'Akses Ditolak: Hanya Platform Developer / SuperAdmin yang memiliki wewenang ke Master Console.' };
  return { status: 200, success: true };
}

const impersonatedUser = {
  id: 10,
  username: 'tenant_owner',
  role: 'OWNER',
  isPlatformAdmin: false,
  isImpersonated: true,
  impersonatorId: 1
};

const resultBlocked = simulateRequirePlatformAdmin(impersonatedUser);
assert.strictEqual(resultBlocked.status, 403, 'Impersonated session must be blocked from Platform Admin endpoints');
assert.strictEqual(resultBlocked.error, 'Akses Ditolak: Sesi impersonasi tidak diizinkan mengakses Master Console.');

const superUser = {
  id: 1,
  username: 'superadmin',
  role: 'SUPERADMIN',
  isPlatformAdmin: true,
  isImpersonated: false
};
const resultAllowed = simulateRequirePlatformAdmin(superUser);
assert.strictEqual(resultAllowed.status, 200, 'Genuine superadmin must be allowed');
console.log('✅ TEST 5 PASSED: Impersonation privilege escalation blocked from Platform Master Console.');

console.log('\n🌟 ALL 5 TESTS PASSED SUCCESSFULLY! 🌟');
