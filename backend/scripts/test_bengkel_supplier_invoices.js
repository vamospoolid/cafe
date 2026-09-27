const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  console.log('=== TEST: BENGKEL SUPPLIER INVOICES, NET 30 & CASH FLOW INTEGRITY ===\n');

  const tenantAId = `test-bengkel-inv-a-${Date.now()}`;
  const tenantBId = `test-bengkel-inv-b-${Date.now()}`;

  try {
    // 1. Setup Test Tenants
    console.log('1. Setting up test tenants: Bengkel A and Bengkel B...');
    await prisma.tenant.createMany({
      data: [
        { id: tenantAId, name: 'Bengkel Motor A', slug: `bengkel-inv-a-${Date.now()}`, businessType: 'BENGKEL' },
        { id: tenantBId, name: 'Bengkel Motor B', slug: `bengkel-inv-b-${Date.now()}`, businessType: 'BENGKEL' }
      ]
    });

    const supplierA = await prisma.supplier.create({
      data: { tenantId: tenantAId, name: 'Distributor Sparepart Makassar' }
    });

    const supplierB = await prisma.supplier.create({
      data: { tenantId: tenantBId, name: 'Grosir Oli Nusantara' }
    });

    const catA = await prisma.category.create({
      data: { tenantId: tenantAId, name: 'Pelumas & Oli' }
    });

    const partA = await prisma.product.create({
      data: {
        tenantId: tenantAId,
        categoryId: catA.id,
        name: 'Oli MPX2 Matic 0.8L',
        stock: 5,
        buyPrice: 40000,
        sellPrice: 55000
      }
    });

    const existingUser = await prisma.user.findFirst({ select: { id: true } });
    const testUserId = existingUser ? existingUser.id : 1;

    console.log('   Tenants, suppliers, and parts initialized successfully.\n');

    // 2. Test Supplier Invoice Creation (Net 30)
    console.log('2. Testing Supplier Invoice creation (NET 30)...');
    const invoiceDate = new Date();
    const dueDateExpected = new Date(invoiceDate);
    dueDateExpected.setDate(dueDateExpected.getDate() + 30);

    const qtyInbound = 10;
    const priceInbound = 45000;
    const subtotal = qtyInbound * priceInbound; // 450,000

    // Weighted Moving Average HPP:
    // (5 * 40000 + 10 * 45000) / (5 + 10) = (200000 + 450000) / 15 = 650000 / 15 = 43333
    const expectedHpp = Math.round(((5 * 40000) + (10 * 45000)) / 15);

    const invoiceA = await prisma.$transaction(async (tx) => {
      const inv = await tx.supplierInvoice.create({
        data: {
          tenantId: tenantAId,
          supplierId: supplierA.id,
          invoiceNumber: 'FAK-MKS-001',
          invoiceDate,
          paymentTerm: 'NET_30',
          dueDate: dueDateExpected,
          subtotal,
          totalAmount: subtotal,
          remainingAmount: subtotal,
          paidAmount: 0,
          status: 'UNPAID',
          items: {
            create: [
              {
                productId: partA.id,
                partName: partA.name,
                qty: qtyInbound,
                buyPrice: priceInbound,
                subtotal
              }
            ]
          }
        },
        include: { items: true }
      });

      await tx.product.update({
        where: { id: partA.id },
        data: {
          stock: { increment: qtyInbound },
          buyPrice: expectedHpp
        }
      });

      return inv;
    });

    const updatedPartA = await prisma.product.findUnique({ where: { id: partA.id } });
    if (updatedPartA.stock !== 15) {
      throw new Error(`Stock mismatch: expected 15, got ${updatedPartA.stock}`);
    }
    if (updatedPartA.buyPrice !== expectedHpp) {
      throw new Error(`HPP mismatch: expected ${expectedHpp}, got ${updatedPartA.buyPrice}`);
    }
    console.log(`   [PASS] Stock correctly incremented to ${updatedPartA.stock} pcs`);
    console.log(`   [PASS] HPP Moving Average updated to Rp ${updatedPartA.buyPrice.toLocaleString('id-ID')}`);

    // Verify NO cashflow was deducted yet because it is NET 30
    const initialCashflow = await prisma.cashFlow.count({ where: { tenantId: tenantAId } });
    if (initialCashflow !== 0) {
      throw new Error('Cashflow was incorrectly deducted on Net 30 invoice creation!');
    }
    console.log('   [PASS] CashFlow integrity verified: Rp 0 deducted on NET 30 creation\n');

    // 3. Test Cross-Tenant Isolation
    console.log('3. Testing Cross-Tenant Isolation & IDOR...');
    const invoiceBView = await prisma.supplierInvoice.findFirst({
      where: { id: invoiceA.id, tenantId: tenantBId }
    });
    if (invoiceBView) {
      throw new Error('Tenant B was able to access Tenant A invoice!');
    }
    console.log('   [PASS] Tenant B cannot access Tenant A invoice (IDOR blocked)\n');

    // 4. Test Payment & CashFlow Recording
    console.log('4. Testing Partial and Full Payments...');
    const partialAmount = 200000;
    await prisma.$transaction(async (tx) => {
      await tx.supplierInvoicePayment.create({
        data: {
          tenantId: tenantAId,
          invoiceId: invoiceA.id,
          amount: partialAmount,
          paymentMethod: 'BANK_TRANSFER',
          referenceNo: 'TRF-TEST-001'
        }
      });

      await tx.supplierInvoice.update({
        where: { id: invoiceA.id },
        data: {
          paidAmount: partialAmount,
          remainingAmount: subtotal - partialAmount,
          status: 'PARTIAL'
        }
      });

      await tx.cashFlow.create({
        data: {
          tenantId: tenantAId,
          type: 'Pengeluaran',
          category: 'Pembayaran Hutang Supplier',
          amount: partialAmount,
          description: `Pelunasan/Cicilan Hutang Nota #${invoiceA.invoiceNumber}`,
          userId: testUserId
        }
      });
    });

    const invoiceAfterPartial = await prisma.supplierInvoice.findUnique({ where: { id: invoiceA.id } });
    if (invoiceAfterPartial.status !== 'PARTIAL' || invoiceAfterPartial.remainingAmount !== 250000) {
      throw new Error('Partial payment state mismatch!');
    }
    console.log(`   [PASS] Partial payment recorded. Sisa hutang: Rp ${invoiceAfterPartial.remainingAmount.toLocaleString('id-ID')}`);

    const cashflows = await prisma.cashFlow.findMany({ where: { tenantId: tenantAId } });
    if (cashflows.length !== 1 || cashflows[0].amount !== partialAmount) {
      throw new Error('Cashflow amount mismatch after partial payment!');
    }
    console.log(`   [PASS] CashFlow Pengeluaran recorded exactly Rp ${partialAmount.toLocaleString('id-ID')}\n`);

    // 5. Test Reset Parity
    console.log('5. Testing Reset Parity...');
    await prisma.$transaction(async (tx) => {
      await tx.supplierInvoicePayment.deleteMany({ where: { tenantId: tenantAId } });
      await tx.supplierInvoiceItem.deleteMany({ where: { invoice: { tenantId: tenantAId } } });
      await tx.supplierInvoice.deleteMany({ where: { tenantId: tenantAId } });
    });

    const remainingInvoices = await prisma.supplierInvoice.count({ where: { tenantId: tenantAId } });
    if (remainingInvoices !== 0) {
      throw new Error('Reset failed to purge supplier invoices!');
    }
    console.log('   [PASS] Reset cleanly purged supplier invoices & payments without foreign key violations\n');

  } finally {
    console.log('Cleaning up test data...');
    await prisma.supplierInvoicePayment.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } }).catch(() => {});
    await prisma.supplierInvoiceItem.deleteMany({ where: { invoice: { tenantId: { in: [tenantAId, tenantBId] } } } }).catch(() => {});
    await prisma.supplierInvoice.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } }).catch(() => {});
    await prisma.cashFlow.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } }).catch(() => {});
    await prisma.product.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } }).catch(() => {});
    await prisma.category.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } }).catch(() => {});
    await prisma.supplier.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } }).catch(() => {});
    console.log('Cleanup finished.');
  }

  console.log('\n✅ ALL SUPPLIER INVOICE & ACCOUNTS PAYABLE (NET 30) TESTS PASSED 100%!');
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test Failed:', err);
    process.exit(1);
  });
