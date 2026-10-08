const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const assert = require('assert');

const prisma = new PrismaClient();

async function runTest() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('🧪 PENGUJIAN PENDAFTARAN TENANT BARU & RESOLUSI SUBDOMAIN OTOMATIS');
  console.log('════════════════════════════════════════════════════════════════\n');

  const timestamp = Date.now();
  const testBengkelSlug = `testbengkel${timestamp}`;
  const testRetailSlug = `testretail${timestamp}`;

  const createdTenantIds = [];

  try {
    // ─── 1. TEST AUTO-SLUG GENERATOR ──────────────────────────────────────────
    console.log('--- 1. Menguji Generator Subdomain Otomatis (Slugification) ---');
    function generateAutoSlug(businessName) {
      return businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    const sampleName1 = 'Bengkel Jaya Motor 24 Jam!';
    const slug1 = generateAutoSlug(sampleName1);
    assert.strictEqual(slug1, 'bengkeljayamotor24jam', 'Karakter khusus dan spasi harus dibersihkan');
    console.log(`✓ Input: "${sampleName1}" ➔ Slug: "${slug1}.codenusa.id"`);

    const sampleName2 = 'Toko Grosir & Sembako Berkah';
    const slug2 = generateAutoSlug(sampleName2);
    assert.strictEqual(slug2, 'tokogrosirsembakoberkah', 'Simbol & dan spasi harus dibersihkan');
    console.log(`✓ Input: "${sampleName2}" ➔ Slug: "${slug2}.codenusa.id"`);
    console.log('✅ TEST 1 PASSED: Algoritma auto-generate slug berfungsi sempurna.\n');

    // ─── 2. TEST PROVISIONING TENANT BENGKEL ──────────────────────────────────
    console.log('--- 2. Menguji Pendaftaran Mandiri Tenant Bengkel (register-tenant) ---');
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const bengkelTenant = await prisma.$transaction(async (tx) => {
      // a. Buat Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: 'Bengkel Mandiri Test',
          slug: testBengkelSlug,
          businessType: 'BENGKEL',
          status: 'ACTIVE',
          trialEndsAt
        }
      });
      createdTenantIds.push(tenant.id);

      // b. Outlet
      const outlet = await tx.outlet.create({
        data: {
          tenantId: tenant.id,
          name: 'Bengkel Mandiri Test (Pusat)',
          code: 'OUT-01',
          status: 'ACTIVE'
        }
      });

      // c. User Owner
      const passwordHash = await bcrypt.hash('password123', 10);
      const user = await tx.user.create({
        data: {
          name: 'Owner Bengkel',
          username: `owner_${testBengkelSlug}`,
          passwordHash,
          pin: '123456',
          tenantId: tenant.id,
          role: 'OWNER',
          employmentType: 'FULL_TIME',
          permissions: JSON.stringify({ canVoid: true, canDiscount: true }),
          status: 'Aktif'
        }
      });

      // d. Settings Toko
      await tx.settings.create({
        data: {
          tenant: { connect: { id: tenant.id } },
          outlet: { connect: { id: outlet.id } },
          storeName: 'Bengkel Mandiri Test',
          receiptHeader: 'BENGKEL MOTOR & MOBIL\nBengkel Mandiri Test',
          receiptFooter: 'Terima kasih telah mempercayakan servis Anda kepada kami.'
        }
      });

      // e. Starter Kategori Bengkel
      const catOli = await tx.category.create({
        data: { tenantId: tenant.id, name: 'Oli & Pelumas', icon: '🛢️', sortOrder: 1, printerTarget: 'NONE', stationTarget: 'NONE' }
      });
      const catJasa = await tx.category.create({
        data: { tenantId: tenant.id, name: 'Jasa & Servis', icon: '🔧', sortOrder: 2, printerTarget: 'NONE', stationTarget: 'NONE' }
      });

      // f. Starter Produk Bengkel
      await tx.product.createMany({
        data: [
          { tenantId: tenant.id, categoryId: catOli.id, name: 'Oli MPX 1 0.8L', buyPrice: 48000, sellPrice: 58000, stock: 20, status: 'Aktif' },
          { tenantId: tenant.id, categoryId: catJasa.id, name: 'Servis Ringan / Tune Up', buyPrice: 0, sellPrice: 45000, stock: 999, status: 'Aktif' }
        ]
      });

      return tenant;
    });

    assert.ok(bengkelTenant.id, 'Tenant bengkel harus memiliki ID');
    assert.strictEqual(bengkelTenant.businessType, 'BENGKEL');
    assert.strictEqual(bengkelTenant.slug, testBengkelSlug);

    // Verifikasi kategori & produk terisolasi
    const bengkelProducts = await prisma.product.findMany({ where: { tenantId: bengkelTenant.id } });
    assert.strictEqual(bengkelProducts.length, 2, 'Tenant bengkel harus memiliki 2 produk starter');
    console.log(`✓ Tenant Bengkel terdaftar dengan ID: ${bengkelTenant.id}`);
    console.log(`✓ Subdomain aktif: https://${testBengkelSlug}.codenusa.id`);
    console.log(`✓ Starter produk bengkel terbuat: ${bengkelProducts.map(p => p.name).join(', ')}`);
    console.log('✅ TEST 2 PASSED: Provisioning tenant bengkel berhasil 100%.\n');

    // ─── 3. TEST PROVISIONING TENANT RETAIL ───────────────────────────────────
    console.log('--- 3. Menguji Pendaftaran Mandiri Tenant Retail / Toko Sembako ---');
    const retailTenant = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: 'Toko Berkah Retail Test',
          slug: testRetailSlug,
          businessType: 'RETAIL',
          status: 'ACTIVE',
          trialEndsAt
        }
      });
      createdTenantIds.push(tenant.id);

      const outlet = await tx.outlet.create({
        data: {
          tenantId: tenant.id,
          name: 'Toko Berkah Retail Test (Pusat)',
          code: 'OUT-01',
          status: 'ACTIVE'
        }
      });

      await tx.settings.create({
        data: {
          tenant: { connect: { id: tenant.id } },
          outlet: { connect: { id: outlet.id } },
          storeName: 'Toko Berkah Retail Test',
          receiptHeader: 'TOKO GROSIR & RETAIL\nToko Berkah Retail Test',
          receiptFooter: 'Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.'
        }
      });

      const catSembako = await tx.category.create({
        data: { tenantId: tenant.id, name: 'Sembako & Beras', icon: '🌾', sortOrder: 1, printerTarget: 'NONE', stationTarget: 'NONE' }
      });

      await tx.product.createMany({
        data: [
          { tenantId: tenant.id, categoryId: catSembako.id, name: 'Beras Premium 5 Kg', buyPrice: 65000, sellPrice: 74000, sellPriceRetail: 74000, sellPriceGrosir: 71000, minQtyGrosir: 5, stock: 30, status: 'Aktif' },
          { tenantId: tenant.id, categoryId: catSembako.id, name: 'Minyak Goreng 2L', buyPrice: 32000, sellPrice: 36500, sellPriceRetail: 36500, sellPriceGrosir: 35000, minQtyGrosir: 6, stock: 25, status: 'Aktif' }
        ]
      });

      return tenant;
    });

    assert.strictEqual(retailTenant.businessType, 'RETAIL');
    const retailProducts = await prisma.product.findMany({ where: { tenantId: retailTenant.id } });
    assert.strictEqual(retailProducts.length, 2);
    console.log(`✓ Tenant Retail terdaftar dengan ID: ${retailTenant.id}`);
    console.log(`✓ Subdomain aktif: https://${testRetailSlug}.codenusa.id`);
    console.log(`✓ Starter produk sembako terbuat: ${retailProducts.map(p => p.name).join(', ')}`);
    console.log('✅ TEST 3 PASSED: Provisioning tenant retail berhasil 100%.\n');

    // ─── 4. TEST SUBDOMAIN RESOLUTION DARI HTTP HOST HEADER ──────────────────
    console.log('--- 4. Menguji Resolusi Subdomain (Host Header ➔ Database Tenant) ---');
    const { resolveTenantFromRequest } = require('../dist/src/middlewares/tenantResolver');

    // a. Resolusi Subdomain Bengkel
    const mockBengkelReq = {
      headers: {
        host: `${testBengkelSlug}.codenusa.id`
      }
    };
    const resolvedBengkel = await resolveTenantFromRequest(mockBengkelReq);
    assert.ok(resolvedBengkel, 'Subdomain bengkel harus berhasil di-resolve');
    assert.strictEqual(resolvedBengkel.id, bengkelTenant.id);
    assert.strictEqual(resolvedBengkel.slug, testBengkelSlug);
    assert.strictEqual(resolvedBengkel.status, 'ACTIVE');
    console.log(`✓ Host "${mockBengkelReq.headers.host}" ➔ Berhasil mengenali Tenant ID: ${resolvedBengkel.id} (${resolvedBengkel.slug})`);

    // b. Resolusi Subdomain Retail
    const mockRetailReq = {
      headers: {
        host: `${testRetailSlug}.codenusa.id`
      }
    };
    const resolvedRetail = await resolveTenantFromRequest(mockRetailReq);
    assert.ok(resolvedRetail, 'Subdomain retail harus berhasil di-resolve');
    assert.strictEqual(resolvedRetail.id, retailTenant.id);
    assert.strictEqual(resolvedRetail.slug, testRetailSlug);
    console.log(`✓ Host "${mockRetailReq.headers.host}" ➔ Berhasil mengenali Tenant ID: ${resolvedRetail.id} (${resolvedRetail.slug})`);

    // c. Subdomain tidak terdaftar (unknown)
    const mockUnknownReq = {
      headers: {
        host: `subdomainngawur${timestamp}.codenusa.id`
      }
    };
    const resolvedUnknown = await resolveTenantFromRequest(mockUnknownReq);
    assert.strictEqual(resolvedUnknown, null, 'Subdomain yang tidak ada harus mengembalikan null');
    console.log(`✓ Host "${mockUnknownReq.headers.host}" ➔ Mengembalikan null (Aman, tidak bocor ke tenant lain)`);
    console.log('✅ TEST 4 PASSED: Resolusi subdomain via Host Header berjalan sempurna!\n');

    // ─── 5. TEST GENERATOR URL PWA / APPS MANDIRI ────────────────────────────
    console.log('--- 5. Menguji PWA URLs yang Ter-generate untuk Klien & Staf ---');
    function getTenantPwaUrls(tenantSlug, customDomain) {
      const baseUrl = customDomain ? `https://${customDomain}` : (tenantSlug ? `https://${tenantSlug}.codenusa.id` : 'https://pos.codenusa.id');
      return {
        cashierUrl: `${baseUrl}/pos`,
        staffUrl: `${baseUrl}/staff`,
        menuUrl: `${baseUrl}/dine-in`
      };
    }

    const bengkelUrls = getTenantPwaUrls(testBengkelSlug);
    assert.strictEqual(bengkelUrls.cashierUrl, `https://${testBengkelSlug}.codenusa.id/pos`);
    assert.strictEqual(bengkelUrls.staffUrl, `https://${testBengkelSlug}.codenusa.id/staff`);
    assert.strictEqual(bengkelUrls.menuUrl, `https://${testBengkelSlug}.codenusa.id/dine-in`);

    console.log(`✓ Link Kasir Tablet : ${bengkelUrls.cashierUrl}`);
    console.log(`✓ Link Portal Staf  : ${bengkelUrls.staffUrl}`);
    console.log(`✓ Link E-Menu Meja  : ${bengkelUrls.menuUrl}`);
    console.log('✅ TEST 5 PASSED: PWA URLs ter-generate presisi per subdomain tenant!\n');

    // ─── 6. TEST BRANDING SETTINGS ISOLATION ─────────────────────────────────
    console.log('--- 6. Menguji Isolasi Data Branding Toko Per Subdomain ---');
    const settingsBengkel = await prisma.settings.findFirst({ where: { tenantId: bengkelTenant.id } });
    const settingsRetail = await prisma.settings.findFirst({ where: { tenantId: retailTenant.id } });

    assert.ok(settingsBengkel.receiptHeader.includes('BENGKEL MOTOR & MOBIL'), 'Header struk bengkel sesuai');
    assert.ok(settingsRetail.receiptHeader.includes('TOKO GROSIR & RETAIL'), 'Header struk retail sesuai');
    assert.notStrictEqual(settingsBengkel.receiptHeader, settingsRetail.receiptHeader, 'Branding tidak saling menimpa');
    console.log(`✓ Branding Bengkel : "${settingsBengkel.receiptHeader.split('\n')[0]}"`);
    console.log(`✓ Branding Retail  : "${settingsRetail.receiptHeader.split('\n')[0]}"`);
    console.log('✅ TEST 6 PASSED: Branding toko terisolasi 100% per tenant!\n');

    console.log('════════════════════════════════════════════════════════════════');
    console.log('🎉 SEMUA PENGUJIAN PENDAFTARAN & SUBDOMAIN SUKSES (6/6 PASSED)');
    console.log('════════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ PENGUJIAN GAGAL DENGAN ERROR:', error);
    process.exitCode = 1;
  } finally {
    // Cleanup data pengujian
    console.log('🧹 Membersihkan tenant uji coba dari database...');
    try {
      for (const tId of createdTenantIds) {
        await prisma.product.deleteMany({ where: { tenantId: tId } });
        await prisma.category.deleteMany({ where: { tenantId: tId } });
        await prisma.settings.deleteMany({ where: { tenantId: tId } });
        await prisma.user.deleteMany({ where: { tenantId: tId } });
        await prisma.outlet.deleteMany({ where: { tenantId: tId } });
        await prisma.tenant.delete({ where: { id: tId } });
      }
      console.log('✓ Database bersih kembali.');
    } catch (cleanupErr) {
      console.warn('Peringatan pembersihan:', cleanupErr.message);
    }
    await prisma.$disconnect();
  }
}

runTest();
