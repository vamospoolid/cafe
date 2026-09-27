/**
 * AUTOMATED MULTI-TENANT SUPPLIER HARDENING & ZERO-IDOR VERIFICATION SUITE
 * Standard: saas-cross-tenant-isolation & saas-zero-idor-and-nested-isolation
 * 
 * Verifies:
 * 1. Cross-Tenant Name Independence (Tenant A & B have same supplier names without conflict)
 * 2. Direct IDOR Protection (Tenant B cannot GET, PUT, DELETE Tenant A's supplier)
 * 3. Nested FK Injection on Ingredients (Tenant B cannot attach Tenant A's supplier on POST & PUT)
 * 4. Nested FK Injection on Warehouse Inbound (Tenant B cannot use Tenant A's supplier for inbound)
 * 5. Soft-Delete & Recycle Bin Isolation (Tenant B cannot see, restore, or purge Tenant A's deleted supplier)
 * 6. Soft-Deleted Supplier Linkage Prevention (Cannot attach soft-deleted supplier to new ingredients)
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'code-pos-super-secret-jwt-key-change-in-production';
const PORT = process.env.PORT || 5000;

function httpRequest({ method, path, token, body }) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ statusCode: res.statusCode, headers: res.headers, data: parsed });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runSupplierHardeningSuite() {
  console.log('====================================================================');
  console.log('🛡️  SUPPLIER MULTI-TENANT HARDENING & ZERO-IDOR VERIFICATION SUITE');
  console.log('====================================================================\n');

  const timestamp = Date.now();
  const tenantAId = `tenant_sup_a_${timestamp}`;
  const tenantBId = `tenant_sup_b_${timestamp}`;
  const outletAId = `outlet_sup_a_${timestamp}`;
  const outletBId = `outlet_sup_b_${timestamp}`;

  let userA, userB;
  let supplierA, supplierB;
  let ingredientB;

  let passedTests = 0;
  let totalTests = 6;

  try {
    // 0. Setup Tenants, Outlets, and Users
    console.log(`[SETUP] Creating isolated test tenants:`);
    console.log(`  - Tenant A: ${tenantAId}`);
    console.log(`  - Tenant B: ${tenantBId}`);

    const businessPlan = await prisma.plan.findFirst({
      where: {
        OR: [
          { name: { contains: 'Business' } },
          { name: { contains: 'Enterprise' } },
          { name: { contains: 'Pro' } }
        ]
      }
    });

    await prisma.tenant.createMany({
      data: [
        { id: tenantAId, name: 'Tenant A Roastery', slug: `roastery-a-${timestamp}`, status: 'ACTIVE', planId: businessPlan?.id },
        { id: tenantBId, name: 'Tenant B Patisserie', slug: `patisserie-b-${timestamp}`, status: 'ACTIVE', planId: businessPlan?.id }
      ]
    });

    // Explicitly grant features required by /api/ingredients and /api/warehouse
    const requiredFeatures = await prisma.feature.findMany({
      where: { key: { in: ['inventory.advanced', 'warehouse.management'] } }
    });

    if (requiredFeatures.length > 0) {
      const overrides = [];
      for (const feat of requiredFeatures) {
        overrides.push({ tenantId: tenantAId, featureId: feat.id, isEnabled: true });
        overrides.push({ tenantId: tenantBId, featureId: feat.id, isEnabled: true });
      }
      await prisma.tenantFeature.createMany({ data: overrides });
    }

    await prisma.outlet.createMany({
      data: [
        { id: outletAId, tenantId: tenantAId, code: `OUT-A-${timestamp.toString().slice(-4)}`, name: 'Outlet Alpha' },
        { id: outletBId, tenantId: tenantBId, code: `OUT-B-${timestamp.toString().slice(-4)}`, name: 'Outlet Beta' }
      ]
    });

    userA = await prisma.user.create({
      data: {
        name: 'Owner Alpha',
        username: `owner_a_${timestamp}`,
        passwordHash: 'dummy',
        role: 'OWNER',
        status: 'Aktif',
        permissions: '["*"]',
        memberships: { create: { tenantId: tenantAId } }
      }
    });

    userB = await prisma.user.create({
      data: {
        name: 'Owner Beta',
        username: `owner_b_${timestamp}`,
        passwordHash: 'dummy',
        role: 'OWNER',
        status: 'Aktif',
        permissions: '["*"]',
        memberships: { create: { tenantId: tenantBId } }
      }
    });

    const tokenA = createToken({ id: userA.id, username: userA.username, role: userA.role, tenantId: tenantAId, outletId: outletAId });
    const tokenB = createToken({ id: userB.id, username: userB.username, role: userB.role, tenantId: tenantBId, outletId: outletBId });

    // -----------------------------------------------------------------------
    // TEST 1: Cross-Tenant Name Independence
    // -----------------------------------------------------------------------
    console.log('\n[TEST 1] Cross-Tenant Name Independence (Identical names across tenants)...');
    const commonName = 'PT Sumber Makmur Bersama';

    const resSupA = await httpRequest({
      method: 'POST',
      path: '/api/suppliers',
      token: tokenA,
      body: { name: commonName, phone: '081211112222', contact: 'Budi A' }
    });

    const resSupB = await httpRequest({
      method: 'POST',
      path: '/api/suppliers',
      token: tokenB,
      body: { name: commonName, phone: '081233334444', contact: 'Budi B' }
    });

    if (resSupA.statusCode === 201 && resSupB.statusCode === 201 && resSupA.data.id !== resSupB.data.id) {
      supplierA = resSupA.data;
      supplierB = resSupB.data;
      console.log(`  ✅ PASS: Both tenants created supplier with name "${commonName}" independently without unique collision!`);
      console.log(`     Tenant A Supplier ID: ${supplierA.id} | Tenant B Supplier ID: ${supplierB.id}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: Supplier creation failed. Status A: ${resSupA.statusCode}, Status B: ${resSupB.statusCode}`);
    }

    // -----------------------------------------------------------------------
    // TEST 2: Direct IDOR Protection (Tenant B cannot GET, PUT, DELETE Supplier A)
    // -----------------------------------------------------------------------
    console.log('\n[TEST 2] Direct IDOR Protection on Supplier CRUD...');
    const idorGet = await httpRequest({
      method: 'GET',
      path: `/api/suppliers/${supplierA.id}`,
      token: tokenB
    });

    const idorPut = await httpRequest({
      method: 'PUT',
      path: `/api/suppliers/${supplierA.id}`,
      token: tokenB,
      body: { name: 'Hacked by Tenant B' }
    });

    const idorDelete = await httpRequest({
      method: 'DELETE',
      path: `/api/suppliers/${supplierA.id}`,
      token: tokenB
    });

    if (idorGet.statusCode === 404 && idorPut.statusCode === 404 && idorDelete.statusCode === 404) {
      console.log('  ✅ PASS: All direct IDOR attempts by Tenant B on Supplier A were safely blocked with 404 Not Found!');
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: IDOR vulnerability detected! GET: ${idorGet.statusCode}, PUT: ${idorPut.statusCode}, DELETE: ${idorDelete.statusCode}`);
    }

    // -----------------------------------------------------------------------
    // TEST 3: Nested Foreign Key Injection on Ingredients (POST & PUT)
    // -----------------------------------------------------------------------
    console.log('\n[TEST 3] Nested FK Injection Prevention on Ingredients (POST & PUT)...');
    
    // 3a. Tenant B tries to create ingredient with Supplier A
    const postNestedFk = await httpRequest({
      method: 'POST',
      path: '/api/ingredients',
      token: tokenB,
      body: {
        name: 'Tepung Terigu B',
        unit: 'kg',
        buyPrice: 12000,
        supplierId: supplierA.id // Tenant A's supplier!
      }
    });

    const preventedPost = postNestedFk.statusCode === 400;

    // 3b. Tenant B creates ingredient with its own Supplier B (should succeed)
    const validPost = await httpRequest({
      method: 'POST',
      path: '/api/ingredients',
      token: tokenB,
      body: {
        name: 'Tepung Terigu B Valid',
        unit: 'kg',
        buyPrice: 12000,
        supplierId: supplierB.id // Own supplier
      }
    });

    const allowedValid = validPost.statusCode === 201;
    ingredientB = validPost.data;

    // 3c. Tenant B tries to update ingredient to use Supplier A
    const putNestedFk = await httpRequest({
      method: 'PUT',
      path: `/api/ingredients/${ingredientB.id}`,
      token: tokenB,
      body: {
        supplierId: supplierA.id // Tenant A's supplier!
      }
    });

    const preventedPut = putNestedFk.statusCode === 400;

    if (preventedPost && allowedValid && preventedPut) {
      console.log('  ✅ PASS: Nested FK Injection into Ingredients was blocked on both POST and PUT (400 Bad Request)!');
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: Nested FK prevention failed! Post Status: ${postNestedFk.statusCode}, Valid Status: ${validPost.statusCode}, Put Status: ${putNestedFk.statusCode}`);
    }

    // -----------------------------------------------------------------------
    // TEST 4: Nested Foreign Key Injection on Warehouse Inbound
    // -----------------------------------------------------------------------
    console.log('\n[TEST 4] Nested FK Injection Prevention on Warehouse Inbound...');
    
    const warehouseInboundFk = await httpRequest({
      method: 'POST',
      path: '/api/warehouse/inbound',
      token: tokenB,
      body: {
        supplierId: supplierA.id, // Tenant A's supplier!
        supplierName: 'Supplier A',
        items: [
          {
            ingredientId: ingredientB.id,
            itemName: ingredientB.name,
            purchaseQty: 10,
            purchasePrice: 12000,
            conversionRatio: 1
          }
        ]
      }
    });

    if (warehouseInboundFk.statusCode === 400) {
      console.log('  ✅ PASS: Warehouse Inbound with cross-tenant supplierId was rejected with 400 Bad Request!');
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: Warehouse Inbound allowed cross-tenant supplierId! Status: ${warehouseInboundFk.statusCode}`);
    }

    // -----------------------------------------------------------------------
    // TEST 5: Soft-Delete & Recycle Bin Cross-Tenant Isolation
    // -----------------------------------------------------------------------
    console.log('\n[TEST 5] Soft-Delete & Recycle Bin Cross-Tenant Isolation...');
    
    // 5a. Tenant A soft-deletes Supplier A
    const delRes = await httpRequest({
      method: 'DELETE',
      path: `/api/suppliers/${supplierA.id}`,
      token: tokenA
    });

    const delSuccess = delRes.statusCode === 200 && delRes.data.success;

    // 5b. Tenant B checks its Recycle Bin -> Supplier A must NOT appear
    const binRes = await httpRequest({
      method: 'GET',
      path: '/api/recycle-bin?type=SUPPLIER',
      token: tokenB
    });

    const notInBin = Array.isArray(binRes.data.items) && !binRes.data.items.some(i => i.id === supplierA.id);

    // 5c. Tenant B attempts to restore Supplier A -> Must be rejected (400 / 404 / 500 with error)
    const restoreRes = await httpRequest({
      method: 'POST',
      path: '/api/recycle-bin/restore',
      token: tokenB,
      body: { type: 'SUPPLIER', id: supplierA.id }
    });

    const restoreBlocked = restoreRes.statusCode >= 400;

    // 5d. Tenant B attempts to purge Supplier A -> Must be rejected
    const purgeRes = await httpRequest({
      method: 'DELETE',
      path: '/api/recycle-bin/purge',
      token: tokenB,
      body: { type: 'SUPPLIER', id: supplierA.id }
    });

    const purgeBlocked = purgeRes.statusCode >= 400;

    if (delSuccess && notInBin && restoreBlocked && purgeBlocked) {
      console.log('  ✅ PASS: Soft-deleted supplier is isolated from other tenants in Recycle Bin and cannot be restored/purged!');
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: Recycle Bin isolation breached! delSuccess: ${delSuccess}, notInBin: ${notInBin}, restoreBlocked: ${restoreBlocked}, purgeBlocked: ${purgeBlocked}`);
    }

    // -----------------------------------------------------------------------
    // TEST 6: Soft-Deleted Supplier Linkage Prevention
    // -----------------------------------------------------------------------
    console.log('\n[TEST 6] Prevention of Linking Soft-Deleted Supplier to New Ingredients...');
    
    // Tenant A attempts to link soft-deleted Supplier A to a new ingredient
    const linkDeletedRes = await httpRequest({
      method: 'POST',
      path: '/api/ingredients',
      token: tokenA,
      body: {
        name: 'Kopi Arabika Baru',
        unit: 'kg',
        buyPrice: 95000,
        supplierId: supplierA.id // Already soft-deleted!
      }
    });

    if (linkDeletedRes.statusCode === 400) {
      console.log('  ✅ PASS: Attempt to attach a soft-deleted supplier to an ingredient was blocked with 400 Bad Request!');
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: Soft-deleted supplier was permitted to be linked! Status: ${linkDeletedRes.statusCode}`);
    }

  } catch (err) {
    console.error('Test execution encountered an error:', err);
  } finally {
    // Cleanup Test Data
    console.log('\n[CLEANUP] Cleaning up test records...');
    try {
      await prisma.warehouseInboundItem.deleteMany({ where: { inbound: { tenantId: { in: [tenantAId, tenantBId] } } } });
      await prisma.warehouseInbound.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await prisma.ingredient.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await prisma.supplier.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await prisma.tenantFeature.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await prisma.user.deleteMany({ where: { id: { in: [userA?.id, userB?.id].filter(Boolean) } } });
      await prisma.outlet.deleteMany({ where: { id: { in: [outletAId, outletBId] } } });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
      console.log('  🧹 Cleanup complete.');
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr);
    }
    await prisma.$disconnect();
  }

  console.log('\n====================================================================');
  console.log(`🏁 TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  if (passedTests === totalTests) {
    console.log('🎉 ALL SUPPLIER MULTI-TENANT ISOLATION SUITES PASSED (100%)');
  } else {
    console.log(`⚠️ WARNING: ${totalTests - passedTests} TEST(S) FAILED`);
  }
  console.log('====================================================================\n');

  process.exit(passedTests === totalTests ? 0 : 1);
}

runSupplierHardeningSuite();
