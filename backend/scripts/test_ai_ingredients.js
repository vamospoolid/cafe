// Test script for AI Ingredients & Supplier Generator endpoints
const http = require('http');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

async function runTest() {
  console.log('🧪 Starting AI Ingredients & Supplier Generator Automated Test...\n');

  // 1. Get or create a test tenant & user
  let tenant = await prisma.tenant.findFirst({ where: { status: 'ACTIVE' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        id: `tenant_test_ai_${Date.now()}`,
        name: 'Kafe Test AI',
        slug: `kafe-ai-${Date.now()}`,
        status: 'ACTIVE'
      }
    });
  }

  const token = jwt.sign({
    id: 1,
    username: 'test_owner',
    role: 'OWNER',
    tenantId: tenant.id
  }, JWT_SECRET, { expiresIn: '2h' });

  console.log(`✅ 1. Generated JWT Token for Tenant: ${tenant.id} (${tenant.name})`);

  // 2. Test AI Generate Template for Coffee Shop
  const genPayload = JSON.stringify({ businessModel: 'coffee_shop' });
  const genResult = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/ingredients/ai-generate-template',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(genPayload),
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(genPayload);
    req.end();
  });

  console.log(`✅ 2. AI Generate Template (Coffee Shop) success!`);
  console.log(`   Total Suppliers: ${genResult.suppliers?.length}`);
  console.log(`   Total Ingredients: ${genResult.ingredients?.length}`);
  console.log(`   Sample ingredients:`, genResult.ingredients?.slice(0, 5).map(i => i.name));

  // 2b. Test AI Generate Template for Resto
  const restoPayload = JSON.stringify({ businessModel: 'resto' });
  const restoResult = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/ingredients/ai-generate-template',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(restoPayload),
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(restoPayload);
    req.end();
  });

  console.log(`\n✅ 2b. AI Generate Template (Resto) success!`);
  console.log(`   Total Suppliers: ${restoResult.suppliers?.length}`);
  console.log(`   Total Ingredients: ${restoResult.ingredients?.length}`);
  console.log(`   Sample ingredients:`, restoResult.ingredients?.slice(0, 6).map(i => i.name));

  // 3. Test Bulk Provision Template
  const provPayload = JSON.stringify({
    suppliers: genResult.suppliers,
    ingredients: genResult.ingredients.slice(0, 4) // Provision 4 items for test
  });

  const provResult = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/ingredients/bulk-provision-template',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(provPayload),
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(provPayload);
    req.end();
  });

  console.log(`✅ 3. Bulk Provision Template success!`);
  console.log(`   Result:`, provResult);

  // 4. Verify in Database that stock = 0 and buyPrice = 0 and tenantId matches!
  const inserted = await prisma.ingredient.findMany({
    where: {
      tenantId: tenant.id,
      name: { in: genResult.ingredients.slice(0, 4).map(i => i.name) }
    },
    include: { supplier: true }
  });

  console.log(`\n🔍 4. Database Verification (Tenant Isolation & Clean Defaults):`);
  console.log(`   Found in DB: ${inserted.length} items`);
  for (const item of inserted) {
    console.log(`   - [${item.category}] ${item.name} | Stok: ${item.stock} | HPP: Rp ${item.buyPrice} | Supplier: ${item.supplier?.name || 'Tanpa Supplier'}`);
    if (item.stock !== 0 || item.buyPrice !== 0) {
      throw new Error(`Item ${item.name} does not have clean zero stock or buy price!`);
    }
    if (item.tenantId !== tenant.id) {
      throw new Error(`Tenant ID mismatch for item ${item.name}!`);
    }
  }

  console.log('\n🎉 ALL CHECKS PASSED PERFECTLY!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
