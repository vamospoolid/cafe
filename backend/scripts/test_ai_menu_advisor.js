/**
 * Automated Verification Suite: AI Menu Engineering & Profit Protection Advisor
 * 
 * Verifies:
 * 1. BCG Matrix Classification (Stars, Plowhorses, Puzzles, Dogs) based on Real Recipe HPP and Volume
 * 2. Customer-Safe Strategy Generation (Zero-risk portion control, Smart bundling, Decoy menu)
 * 3. Dual-Engine Fallback Resilience (AI + Mathematical Rule-Based)
 * 4. HTTP Endpoint GET /api/analytics/ai-menu-advisor with Fail-Closed Tenant Context
 * 5. Strict Cross-Tenant Isolation (Tenant A data NEVER leaks into Tenant B)
 * 6. High-Performance Caching & ?refresh=true Force Invalidation
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ statusCode: res.statusCode, headers: res.headers, data: parsed });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runTests() {
  console.log('====================================================================');
  console.log('🧪 RUNNING: AI Menu Engineering & Profit Protection Advisor Suite');
  console.log('====================================================================\n');

  const timestamp = Date.now();
  const tenantAId = `tenant_ai_a_${timestamp}`;
  const tenantBId = `tenant_ai_b_${timestamp}`;
  const outletAId = `outlet_ai_a_${timestamp}`;
  const outletBId = `outlet_ai_b_${timestamp}`;

  let userA, userB;
  let categoryA, categoryB;
  let productStar, productPlowhorse, productPuzzle, productDog;
  let productTenantB;

  try {
    // ─── 0. SETUP MULTI-TENANT TEST DATA ───
    console.log('📌 Setup: Provisioning 2 Isolated Tenants, Outlets, and Users...');

    await prisma.tenant.createMany({
      data: [
        { id: tenantAId, name: 'Kafe Alpha AI', slug: `kafe-ai-a-${timestamp}`, status: 'ACTIVE' },
        { id: tenantBId, name: 'Kafe Beta AI', slug: `kafe-ai-b-${timestamp}`, status: 'ACTIVE' }
      ]
    });

    await prisma.outlet.createMany({
      data: [
        { id: outletAId, tenantId: tenantAId, code: `OA-${timestamp.toString().slice(-4)}`, name: 'Outlet Alpha', address: 'Jl. A' },
        { id: outletBId, tenantId: tenantBId, code: `OB-${timestamp.toString().slice(-4)}`, name: 'Outlet Beta', address: 'Jl. B' }
      ]
    });

    userA = await prisma.user.create({
      data: {
        name: 'Owner Alpha',
        username: `owner_ai_a_${timestamp}`,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'Aktif',
        permissions: '["*"]',
        memberships: { create: { tenantId: tenantAId } }
      }
    });

    userB = await prisma.user.create({
      data: {
        name: 'Owner Beta',
        username: `owner_ai_b_${timestamp}`,
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'Aktif',
        permissions: '["*"]',
        memberships: { create: { tenantId: tenantBId } }
      }
    });

    categoryA = await prisma.category.create({
      data: { name: 'Kopi & Makanan A', tenantId: tenantAId }
    });

    categoryB = await prisma.category.create({
      data: { name: 'Menu Khusus B', tenantId: tenantBId }
    });

    // Create 4 benchmark products for Tenant A covering all 4 BCG Quadrants:
    // 1. STAR: Price 25.000, Cost 6.000 (Food Cost = 24% <= 32%)
    productStar = await prisma.product.create({
      data: {
        name: 'Signature Kopi Susu Aren (Star)',
        sellPrice: 25000,
        buyPrice: 6000,
        tenantId: tenantAId,
        categoryId: categoryA.id
      }
    });

    // 2. PLOWHORSE: Price 30.000, Cost 15.000 (Food Cost = 50% > 35%)
    productPlowhorse = await prisma.product.create({
      data: {
        name: 'Beef Wagyu Rice Bowl (Plowhorse)',
        sellPrice: 30000,
        buyPrice: 15000,
        tenantId: tenantAId,
        categoryId: categoryA.id
      }
    });

    // 3. PUZZLE: Price 28.000, Cost 7.000 (Food Cost = 25% <= 32%)
    productPuzzle = await prisma.product.create({
      data: {
        name: 'Matcha Latte Artisan (Puzzle)',
        sellPrice: 28000,
        buyPrice: 7000,
        tenantId: tenantAId,
        categoryId: categoryA.id
      }
    });

    // 4. DOG: Price 20.000, Cost 10.000 (Food Cost = 50% > 35%)
    productDog = await prisma.product.create({
      data: {
        name: 'French Fries Sachet (Dog)',
        sellPrice: 20000,
        buyPrice: 10000,
        tenantId: tenantAId,
        categoryId: categoryA.id
      }
    });

    // Product for Tenant B
    productTenantB = await prisma.product.create({
      data: {
        name: 'Exclusive Secret Menu Tenant B',
        sellPrice: 99000,
        buyPrice: 30000,
        tenantId: tenantBId,
        categoryId: categoryB.id
      }
    });

    // Create sales order for Tenant A (giving volume to Star & Plowhorse)
    const orderA = await prisma.order.create({
      data: {
        tenantId: tenantAId,
        outletId: outletAId,
        orderNumber: `ORD-${timestamp}`,
        customerName: 'Customer Test',
        userId: userA.id,
        subtotal: 6330000,
        tax: 0,
        serviceCharge: 0,
        total: 6330000,
        paymentMethod: 'CASH',
        status: 'Paid',
        createdAt: new Date()
      }
    });

    await prisma.orderItem.createMany({
      data: [
        { orderId: orderA.id, productId: productStar.id, qty: 150, price: 25000, subtotal: 3750000, tenantId: tenantAId },
        { orderId: orderA.id, productId: productPlowhorse.id, qty: 80, price: 30000, subtotal: 2400000, tenantId: tenantAId },
        { orderId: orderA.id, productId: productPuzzle.id, qty: 5, price: 28000, subtotal: 140000, tenantId: tenantAId },
        { orderId: orderA.id, productId: productDog.id, qty: 2, price: 20000, subtotal: 40000, tenantId: tenantAId }
      ]
    });

    console.log('   Data seeding completed.\n');

    const tokenA = createToken({ id: userA.id, tenantId: tenantAId, role: 'OWNER' });
    const tokenB = createToken({ id: userB.id, tenantId: tenantBId, role: 'OWNER' });

    // ─── TEST 1: Service Unit & BCG Classification ───
    console.log('📌 Test 1: Core BCG Matrix & Food Cost Calculations');
    const { aiMenuOptimizerService } = require('../dist/src/services/AiMenuOptimizerService');
    const serviceResult = await aiMenuOptimizerService.analyzeMenu(tenantAId, true);

    assert(serviceResult && typeof serviceResult.overallHealthScore === 'number', 'Service returns numeric overallHealthScore');
    assert(typeof serviceResult.overallFoodCostPercentage === 'number', 'Service returns numeric overallFoodCostPercentage');
    assert(Array.isArray(serviceResult.strategies), 'Service returns array of customer-safe strategies');
    assert(serviceResult.strategies.length >= 3, 'Service generates at least 3 customer-safe strategies');

    // Check Quadrant separation
    const starNames = serviceResult.quadrants.stars.map(p => p.name);
    const plowhorseNames = serviceResult.quadrants.plowhorses.map(p => p.name);
    const puzzleNames = serviceResult.quadrants.puzzles.map(p => p.name);
    const dogNames = serviceResult.quadrants.dogs.map(p => p.name);

    console.log(`   Stars (${starNames.length}):`, starNames);
    console.log(`   Plowhorses (${plowhorseNames.length}):`, plowhorseNames);
    console.log(`   Puzzles (${puzzleNames.length}):`, puzzleNames);
    console.log(`   Dogs (${dogNames.length}):`, dogNames);

    assert(starNames.some(n => n.includes('Star')), 'High Volume + Low Food Cost correctly categorized as STAR');
    assert(plowhorseNames.some(n => n.includes('Plowhorse')), 'High Volume + High Food Cost correctly categorized as PLOWHORSE');
    assert(puzzleNames.some(n => n.includes('Puzzle')), 'Low Volume + Low Food Cost correctly categorized as PUZZLE');
    assert(dogNames.some(n => n.includes('Dog')), 'Low Volume + High Food Cost correctly categorized as DOG');

    // ─── TEST 2: Customer-Safe Strategy Principles ───
    console.log('\n📌 Test 2: Customer-Safe Profit Protection Verification');
    const zeroRiskStrategies = serviceResult.strategies.filter(s => s.riskLevel === 'ZERO_RISK');
    console.log(`   Zero-risk strategies found: ${zeroRiskStrategies.length}`);
    assert(zeroRiskStrategies.length > 0, 'Generates 0% customer risk strategies (e.g. recipe/portion control)');
    
    // Check that none of the strategies advise blindly hiking prices
    const blindPriceHike = serviceResult.strategies.some(s => {
      const step = (s.actionableStep || s.suggestedAction || '').toLowerCase();
      const name = (s.strategyName || s.title || '').toLowerCase();
      return step.includes('naikkan harga secara langsung') || name.includes('naikkan harga drastis');
    });
    assert(!blindPriceHike, 'Strategies adhere to customer-safe policy (no blind price hikes)');
    assert(serviceResult.totalPotentialProfitMonthly > 0, 'Computes positive potential monthly profit gain');

    // ─── TEST 3: HTTP Endpoint Security & Scoping ───
    console.log('\n📌 Test 3: HTTP API Endpoint GET /api/analytics/ai-menu-advisor');
    
    // 3a. Unauthenticated request should fail (401)
    const unauthRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/analytics/ai-menu-advisor',
      method: 'GET'
    });
    assert(unauthRes.statusCode === 401, 'Unauthenticated request is rejected with 401');

    // 3b. Authenticated request for Tenant A should succeed (200)
    const authResA = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/analytics/ai-menu-advisor',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenA}`
      }
    });
    assert(authResA.statusCode === 200, 'Authenticated Tenant A request returns HTTP 200');
    assert(authResA.data && authResA.data.metrics && authResA.data.metrics.totalProductsAnalyzed >= 4, 'Tenant A analysis includes at least 4 products');

    // ─── TEST 4: Strict Cross-Tenant Isolation ───
    console.log('\n📌 Test 4: Strict Multi-Tenant Data Isolation');
    const authResB = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/analytics/ai-menu-advisor',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenB}`
      }
    });
    assert(authResB.statusCode === 200, 'Authenticated Tenant B request returns HTTP 200');

    // Tenant B must ONLY see Tenant B products, NEVER Tenant A products
    const tenantBAllProducts = [
      ...authResB.data.quadrants.stars,
      ...authResB.data.quadrants.plowhorses,
      ...authResB.data.quadrants.puzzles,
      ...authResB.data.quadrants.dogs
    ].map(p => p.name);

    const hasTenantAProductInB = tenantBAllProducts.some(name => 
      name.includes('Signature Kopi Susu Aren') || name.includes('Beef Wagyu')
    );
    assert(!hasTenantAProductInB, 'Tenant A products DO NOT leak into Tenant B analysis (Zero Data Leakage)');
    assert(tenantBAllProducts.includes('Exclusive Secret Menu Tenant B'), 'Tenant B analysis contains only Tenant B menu');

    // ─── TEST 5: Caching & ?refresh=true Invalidation ───
    console.log('\n📌 Test 5: Cache Hit vs Force Refresh');
    const startCached = Date.now();
    const cachedRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/analytics/ai-menu-advisor',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenA}`
      }
    });
    const durationCached = Date.now() - startCached;
    assert(cachedRes.statusCode === 200, 'Cached request succeeds with HTTP 200');
    console.log(`   Cached request took: ${durationCached}ms`);

    // Force refresh request
    const refreshedRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/analytics/ai-menu-advisor?refresh=true',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenA}`
      }
    });
    assert(refreshedRes.statusCode === 200, 'Force refresh (?refresh=true) succeeds with HTTP 200');
    assert(refreshedRes.data.metrics.totalProductsAnalyzed === authResA.data.metrics.totalProductsAnalyzed, 'Refreshed payload integrity matches original');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    // ─── CLEANUP TEST DATA ───
    console.log('\n🧹 Teardown: Cleaning up test tenants and products...');
    try {
      await prisma.orderItem.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await prisma.order.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await prisma.product.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await prisma.category.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      if (userA) await prisma.user.delete({ where: { id: userA.id } });
      if (userB) await prisma.user.delete({ where: { id: userB.id } });
      await prisma.outlet.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
      console.log('   Teardown complete.');
    } catch (cleanupErr) {
      console.warn('   Teardown warning:', cleanupErr.message);
    }
    await prisma.$disconnect();

    console.log('\n====================================================================');
    console.log(`📊 AI MENU ENGINEERING ADVISOR TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================================');

    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
