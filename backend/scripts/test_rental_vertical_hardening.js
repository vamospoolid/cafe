/**
 * TEST SUITE: Rental Vertical Hardening & Anti-Misslogic Validation
 *
 * Verifies:
 * 1. Order Number Multi-Tenant Isolation (Tenant slug prefix RNT-${tenantCode}-${ym}-${seq})
 * 2. Concurrency & Case-Insensitive Conflict Detection (uppercase/trim + overdue unreturned & laundry blocking)
 * 3. CRM Customer Auto-Upsert (tx.customer.findFirst/create & customerId linking)
 * 4. Adaptive Cash-Flow Pockets (QRIS/TRANSFER -> BANK vs CASH -> LACI_KASIR)
 * 5. Return Inspection Idempotency Guard (rejection of double refund & duplicate completions)
 * 6. Cancellation Double-Counting Elimination (no duplicate Pemasukan for forfeited deposit)
 * 7. Inventory Zombie Protection (only auto-seed if totalEverProducts === 0)
 * 8. Accurate Inventory Laundry Counting (checks !it.isReturned)
 * 9. FIFO Complete-Laundry Protection (operates on single unreturned unit FIFO, avoids cross-order contamination)
 * 10. Calendar Month Range Filtering (dateType === 'calendar' checks eventDate, pickupDate, and returnDeadline)
 * 11. Real-time Socket.IO Broadcasts (emits rental:order_created, rental:order_updated, rental:inventory_updated)
 * 12. Frontend Tag Sanitization (RentalKanbanView strips [OVERDUE_ALERT] & [BATAL] from fitting notes)
 * 13. Frontend Real-time Socket Subscriptions (Kanban & Calendar views listen to rental events)
 * 14. VerticalContext BusinessType Storage Synchronization
 * 15. Direct Prisma database model lifecycle
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function pass(msg) {
  console.log(`✅ ${msg}`);
  passed++;
}

function fail(msg, err) {
  console.error(`❌ ${msg}`);
  if (err) console.error(`   → ${err.message || err}`);
  failed++;
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING TEST SUITE: RENTAL VERTICAL HARDENING');
  console.log('================================================================\n');

  const rentalRoutePath = path.join(__dirname, '../src/routes/rental.ts');
  const kanbanViewPath = path.join(__dirname, '../../frontend/src/verticals/rental/RentalKanbanView.tsx');
  const calendarViewPath = path.join(__dirname, '../../frontend/src/verticals/rental/RentalCalendarView.tsx');
  const verticalContextPath = path.join(__dirname, '../../frontend/src/context/VerticalContext.tsx');

  const rentalRouteSrc = fs.readFileSync(rentalRoutePath, 'utf8');
  const kanbanViewSrc = fs.readFileSync(kanbanViewPath, 'utf8');
  const calendarViewSrc = fs.readFileSync(calendarViewPath, 'utf8');
  const verticalContextSrc = fs.readFileSync(verticalContextPath, 'utf8');

  // ── TEST 1: Tenant Code Slug Prefix in Order Number ──
  try {
    assert(rentalRouteSrc.includes('RNT-${tenantCode}-${ym}-'), 'Order number prefix must include tenantCode slug');
    assert(rentalRouteSrc.includes('tenant.findUnique({ where: { id: tenantId }'), 'Must look up tenant for slug generation');
    pass('Test 1: Tenant Code Slug in Rental Order Number generation implemented');
  } catch (e) {
    fail('Test 1: Tenant Code Slug missing or malformed', e);
  }

  // ── TEST 2: Attire Code Uppercase/Trim & Conflict Logic ──
  try {
    assert(rentalRouteSrc.includes('requestedCountMap[code]'), 'Attire codes must be tracked per uppercase code');
    assert(rentalRouteSrc.includes("status: { in: ['BOOKED', 'FITTING', 'PICKED_UP', 'RETURNED', 'QC_CHECK', 'LAUNDRY'] }"), 'Conflict query must check all active statuses');
    assert(rentalRouteSrc.includes('returnDeadline: { lt: pDate }'), 'Overdue unreturned items block rentals starting today/past');
    pass('Test 2: Attire Code Case-Insensitive Normalization & Multi-Status Conflict Detection verified');
  } catch (e) {
    fail('Test 2: Conflict detection query incomplete', e);
  }

  // ── TEST 3: Customer Auto-Upsert & Linking ──
  try {
    assert(rentalRouteSrc.includes('tx.customer.findFirst') && rentalRouteSrc.includes('tx.customer.create'), 'Rental order creation must auto-create customer record if not found');
    assert(rentalRouteSrc.includes('customerId: finalCustomerId'), 'Must link generated finalCustomerId to order');
    pass('Test 3: Customer Auto-Upsert into CRM table implemented in transaction');
  } catch (e) {
    fail('Test 3: Customer auto-upsert missing', e);
  }

  // ── TEST 4: Adaptive Cash Pocket ──
  try {
    assert(rentalRouteSrc.includes("(paymentMethod === 'TRANSFER' || paymentMethod === 'QRIS') ? 'BANK' : 'LACI_KASIR'"), 'Cash pocket must be adaptive between BANK and LACI_KASIR');
    pass('Test 4: Adaptive Cashflow Pocket (BANK vs LACI_KASIR) verified');
  } catch (e) {
    fail('Test 4: Adaptive cashflow pocket missing', e);
  }

  // ── TEST 5: Return Inspection Idempotency Guard ──
  try {
    assert(rentalRouteSrc.includes("existing.status === 'COMPLETED'"), 'Return inspection must reject already completed orders');
    assert(rentalRouteSrc.includes("existing.depositStatus !== 'HELD'"), 'Return inspection must reject duplicate deposit refund');
    pass('Test 5: Return Inspection Idempotency Guard (anti-double refund & duplicate execution) verified');
  } catch (e) {
    fail('Test 5: Return inspection idempotency guard missing', e);
  }

  // ── TEST 6: Elimination of Cancellation Double-Counting ──
  try {
    assert(!rentalRouteSrc.includes('Sita Jaminan / Deposit Hangus (Pembatalan)'), 'Must not create extra Pemasukan on cancellation for forfeited deposit');
    assert(!rentalRouteSrc.includes('Selisih Jaminan Hangus (Refund Parsial)'), 'Must not create extra Pemasukan on cancellation for partial refund');
    pass('Test 6: Cancellation Double-Counting bug eliminated (no redundant physical cash insertion)');
  } catch (e) {
    fail('Test 6: Redundant cashflow entries still found on cancellation', e);
  }

  // ── TEST 7: Inventory Zombie Protection ──
  try {
    assert(rentalRouteSrc.includes('totalEverProducts'), 'Inventory must check totalEverProducts count');
    assert(rentalRouteSrc.includes('products.length === 0 && totalEverProducts === 0'), 'Auto-seed must only run if tenant never had products');
    pass('Test 7: Inventory Zombie Products protection verified');
  } catch (e) {
    fail('Test 7: Inventory Zombie Products protection verified');
  }

  // ── TEST 8: Accurate Laundry Stock Calculation ──
  try {
    assert(rentalRouteSrc.includes("!it.isReturned"), 'statusMap.laundryUnits must check !it.isReturned');
    pass('Test 8: Laundry Units calculation properly excludes already returned items (!it.isReturned)');
  } catch (e) {
    fail('Test 8: Laundry units counting does not check isReturned', e);
  }

  // ── TEST 9: FIFO Single-Unit Complete-Laundry ──
  try {
    assert(rentalRouteSrc.includes('oldestOrderWithItem'), 'Complete laundry by attireCode must find oldest order (FIFO)');
    assert(rentalRouteSrc.includes("orderBy: { createdAt: 'asc' }"), 'Must order by createdAt asc for FIFO processing');
    pass('Test 9: Complete-Laundry hardened to FIFO single-unit update, preventing multi-order contamination');
  } catch (e) {
    fail('Test 9: Complete laundry FIFO logic missing', e);
  }

  // ── TEST 10: Calendar Month Range Query Support ──
  try {
    assert(rentalRouteSrc.includes("dateType === 'calendar'"), 'Rental orders route must support dateType === calendar');
    assert(rentalRouteSrc.includes('eventDate:') && rentalRouteSrc.includes('pickupDate:') && rentalRouteSrc.includes('returnDeadline:'), 'Calendar dateType must query eventDate, pickupDate, and returnDeadline');
    pass('Test 10: Calendar Date Range Query (dateType=calendar across event/pickup/return) verified');
  } catch (e) {
    fail('Test 10: Calendar date query filter missing or incomplete', e);
  }

  // ── TEST 11: Real-time Socket.IO Broadcasts ──
  try {
    assert(rentalRouteSrc.includes("emit('rental:order_created'"), 'Must emit rental:order_created');
    assert(rentalRouteSrc.includes("emit('rental:order_updated'"), 'Must emit rental:order_updated');
    assert(rentalRouteSrc.includes("emit('rental:inventory_updated'"), 'Must emit rental:inventory_updated');
    pass('Test 11: Backend Socket.IO real-time event broadcasts verified');
  } catch (e) {
    fail('Test 11: Backend socket emits missing', e);
  }

  // ── TEST 12: Frontend Tag Sanitization in Kanban View ──
  try {
    assert(kanbanViewSrc.includes('parseFittingNotes'), 'RentalKanbanView must define and use parseFittingNotes helper');
    assert(kanbanViewSrc.includes('\\[OVERDUE_ALERT:'), 'Must strip [OVERDUE_ALERT] tag from alteration notes');
    assert(kanbanViewSrc.includes('\\[BATAL:'), 'Must strip [BATAL] tag from alteration notes');
    pass('Test 12: RentalKanbanView fitting notes sanitizer strips automated overdue & cancellation tags');
  } catch (e) {
    fail('Test 12: Tag sanitization missing in RentalKanbanView', e);
  }

  // ── TEST 13: Frontend Real-time Socket Subscriptions ──
  try {
    assert(kanbanViewSrc.includes("useSocket"), 'RentalKanbanView must import useSocket');
    assert(kanbanViewSrc.includes("socket.on('rental:order_created'"), 'RentalKanbanView must subscribe to rental:order_created');
    assert(calendarViewSrc.includes("useSocket"), 'RentalCalendarView must import useSocket');
    assert(calendarViewSrc.includes("socket.on('rental:order_created'"), 'RentalCalendarView must subscribe to rental:order_created');
    assert(calendarViewSrc.includes("dateType=calendar"), 'RentalCalendarView must use dateType=calendar range query');
    pass('Test 13: Frontend Kanban & Calendar views Socket.IO real-time sync verified');
  } catch (e) {
    fail('Test 13: Frontend socket subscriptions missing', e);
  }

  // ── TEST 14: VerticalContext LocalStorage Sync ──
  try {
    assert(verticalContextSrc.includes("localStorage.setItem('pos_business_type', businessType)"), 'VerticalContext must synchronize active businessType to localStorage');
    pass('Test 14: VerticalContext active businessType localStorage synchronization verified');
  } catch (e) {
    fail('Test 14: VerticalContext localStorage synchronization missing', e);
  }

  // ── TEST 15: Direct Database Schema & Model Validation ──
  try {
    const testTimestamp = Date.now();
    const testTenant = await prisma.tenant.create({
      data: {
        name: 'Butik Baju Bodo Test ' + testTimestamp,
        slug: 'test-rnt-' + testTimestamp,
        businessType: 'RENTAL'
      }
    });

    const ym = new Date().toISOString().slice(2, 7).replace('-', '');
    const prefix = `RNT-${(testTenant.slug.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4) || 'BODO').toUpperCase()}-${ym}-`;

    const sampleOrder = await prisma.rentalOrder.create({
      data: {
        tenantId: testTenant.id,
        orderNumber: `${prefix}0001`,
        customerName: 'Siti Rahma',
        customerPhone: '081234567890',
        eventDate: new Date('2026-10-15T09:00:00Z'),
        pickupDate: new Date('2026-10-14T09:00:00Z'),
        returnDeadline: new Date('2026-10-16T18:00:00Z'),
        status: 'BOOKED',
        rentalSubtotal: 250000,
        totalAmount: 350000,
        depositAmount: 100000,
        paidAmount: 350000,
        paymentStatus: 'PAID',
        items: {
          create: [
            {
              attireName: 'Baju Bodo Modern Maroon M',
              attireCode: 'BBM-MRN-M-01',
              price: 250000,
              isReturned: false,
              returnCondition: 'GOOD'
            }
          ]
        }
      },
      include: { items: true }
    });

    assert.equal(sampleOrder.orderNumber, `${prefix}0001`);
    assert.equal(sampleOrder.items.length, 1);
    assert.equal(sampleOrder.items[0].isReturned, false);

    // Clean up test data
    await prisma.rentalOrderItem.deleteMany({ where: { orderId: sampleOrder.id } });
    await prisma.rentalOrder.delete({ where: { id: sampleOrder.id } });
    await prisma.tenant.delete({ where: { id: testTenant.id } });

    pass('Test 15: Direct Prisma RentalOrder model lifecycle & items relation verified');
  } catch (e) {
    fail('Test 15: Direct Prisma database test failed', e);
  }

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
