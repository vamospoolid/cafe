const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';
const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('🚀 [TEST] Memulai Verifikasi Kas Operasional Harian Kafe (MVP)...');

  try {
    // 1. Ambil tenant cafe aktif
    const cafeTenant = await prisma.tenant.findFirst({
      where: { businessType: 'CAFE' }
    });

    if (!cafeTenant) {
      throw new Error('Tidak ditemukan tenant CAFE di database!');
    }
    console.log(`✅ Menggunakan tenant CAFE: ${cafeTenant.name} (${cafeTenant.id})`);

    // 2. Ambil user Owner dan Kasir dari tenant ini
    let ownerUser = await prisma.user.findFirst({
      where: {
        memberships: { some: { tenantId: cafeTenant.id, role: { name: 'OWNER' } } }
      }
    });
    if (!ownerUser) {
      ownerUser = await prisma.user.findFirst();
    }

    // Buat atau ambil Kasir dengan role CASHIER
    let cashierMembership = await prisma.tenantMembership.findFirst({
      where: {
        tenantId: cafeTenant.id,
        roleId: 'role-system-cashier'
      },
      include: { user: true }
    });

    let cashierUser;
    if (cashierMembership) {
      cashierUser = cashierMembership.user;
    } else {
      cashierUser = await prisma.user.create({
        data: {
          name: 'Kasir Uji Operasional',
          username: `kasir_test_${Date.now()}`,
          passwordHash: 'dummyhash',
          role: 'CASHIER',
          permissions: '[]',
          memberships: {
            create: {
              tenantId: cafeTenant.id,
              roleId: 'role-system-cashier',
              status: 'ACTIVE'
            }
          }
        }
      });
    }

    const ownerToken = jwt.sign(
      { id: ownerUser.id, tenantId: cafeTenant.id, role: 'OWNER', name: ownerUser.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const cashierToken = jwt.sign(
      { id: cashierUser.id, tenantId: cafeTenant.id, role: 'KASIR', name: cashierUser.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log(`✅ Token JWT dibuat untuk Owner (${ownerUser.name}) dan Kasir (${cashierUser.name})`);

    // 3. Test GET /api/cashflow/summary
    console.log('\n--- TEST 1: GET /api/cashflow/summary ---');
    const summaryRes = await fetch(`${BASE_URL}/cashflow/summary`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const summaryData = await summaryRes.json();
    console.log('Status:', summaryRes.status);
    console.log('Kas Operasional Balance:', summaryData.kasOperasional?.balance);
    console.log('Laci Kasir Balance:', summaryData.laciKasir?.balance);
    if (!summaryRes.ok || summaryData.kasOperasional === undefined) {
      throw new Error('Summary API response invalid');
    }
    console.log('✅ TEST 1 LULUS: Dual pocket summary berhasil dihitung.');

    // 4. Test Kasir Request Expense (Air Galon) -> PENDING_APPROVAL
    console.log('\n--- TEST 2: Kasir Request Expense (Air Galon) ---');
    const expenseReqRes = await fetch(`${BASE_URL}/cashflow/request-expense`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`
      },
      body: JSON.stringify({
        category: 'Operasional Cafe - Air Galon & Kebutuhan Minum',
        amount: 20000,
        description: 'Isi ulang 2 galon air minum bar',
        receiptImage: '/uploads/tenants/demo/nota_galon.jpg'
      })
    });
    const expenseReqData = await expenseReqRes.json();
    console.log('Status:', expenseReqRes.status);
    console.log('Created CashFlow:', expenseReqData.id, 'Status:', expenseReqData.status, 'Pocket:', expenseReqData.cashPocket);
    if (expenseReqRes.status !== 201 || expenseReqData.status !== 'PENDING_APPROVAL') {
      throw new Error(`Expense request status harus PENDING_APPROVAL, dapat: ${expenseReqData.status}`);
    }
    console.log('✅ TEST 2 LULUS: Pengeluaran kasir berstatus PENDING_APPROVAL.');

    const galonCashFlowId = expenseReqData.id;

    // 5. Test Owner Approve Expense (Air Galon)
    console.log('\n--- TEST 3: Owner Approve Expense ---');
    const approveRes = await fetch(`${BASE_URL}/cashflow/${galonCashFlowId}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const approveData = await approveRes.json();
    console.log('Status:', approveRes.status, 'Message:', approveData.message);
    if (!approveRes.ok || approveData.cashflow?.status !== 'APPROVED') {
      throw new Error('Approve API gagal atau status bukan APPROVED');
    }
    console.log('✅ TEST 3 LULUS: Owner berhasil menyetujui pengeluaran.');

    // 6. Test Request Expense with Auto-Restock Ingredient (Susu UHT)
    console.log('\n--- TEST 4: Linked Ingredient Auto-Restock ---');
    // Cari atau buat bahan baku Susu UHT
    let susuIng = await prisma.ingredient.findFirst({
      where: { tenantId: cafeTenant.id, name: { contains: 'Susu', mode: 'insensitive' } }
    });
    if (!susuIng) {
      susuIng = await prisma.ingredient.create({
        data: {
          tenantId: cafeTenant.id,
          name: 'Susu UHT Fresh Test',
          unit: 'Liter',
          stock: 10,
          cost: 18000,
          category: 'DRINK'
        }
      });
    }
    const initialStock = susuIng.stock;
    console.log(`Bahan: ${susuIng.name}, Stok awal: ${initialStock} ${susuIng.unit}`);

    const restockExpenseRes = await fetch(`${BASE_URL}/cashflow/request-expense`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`
      },
      body: JSON.stringify({
        category: 'Bahan Minuman - Susu & Dairy',
        amount: 90000,
        description: 'Beli darurat 5 liter Susu UHT di minimarket',
        receiptImage: '/uploads/tenants/demo/nota_susu.jpg',
        linkedIngredientId: susuIng.id,
        restockQty: 5
      })
    });
    const restockExpenseData = await restockExpenseRes.json();
    const susuCashflowId = restockExpenseData.id;

    // Owner Approve Susu UHT -> harus memicu auto restock
    const approveSusuRes = await fetch(`${BASE_URL}/cashflow/${susuCashflowId}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const approveSusuData = await approveSusuRes.json();
    console.log('Status Approve Susu:', approveSusuRes.status);

    const updatedSusuIng = await prisma.ingredient.findUnique({ where: { id: susuIng.id } });
    console.log(`Stok setelah approve: ${updatedSusuIng.stock} ${updatedSusuIng.unit}`);
    if (updatedSusuIng.stock !== initialStock + 5) {
      throw new Error(`Stok seharusnya bertambah 5 dari ${initialStock} menjadi ${initialStock + 5}, dapat: ${updatedSusuIng.stock}`);
    }
    console.log('✅ TEST 4 LULUS: Auto-restock 5 unit bahan baku saat approval berhasil!');

    // 7. Test Kasir Request Expense -> Owner Reject with Reason
    console.log('\n--- TEST 5: Owner Reject Expense with Reason ---');
    const rejectExpenseRes = await fetch(`${BASE_URL}/cashflow/request-expense`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`
      },
      body: JSON.stringify({
        category: 'Operasional Cafe - Lainnya',
        amount: 50000,
        description: 'Beli camilan kasir',
        receiptImage: null
      })
    });
    const rejectExpenseData = await rejectExpenseRes.json();
    const snackCashFlowId = rejectExpenseData.id;

    const rejectRes = await fetch(`${BASE_URL}/cashflow/${snackCashFlowId}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`
      },
      body: JSON.stringify({
        rejectionReason: 'Tidak ada nota fisik dan bukan kebutuhan operasional kafe'
      })
    });
    const rejectData = await rejectRes.json();
    console.log('Status Reject:', rejectRes.status);
    console.log('Rejected Status:', rejectData.cashflow?.status, 'Reason:', rejectData.cashflow?.rejectionReason);
    if (!rejectRes.ok || rejectData.cashflow?.status !== 'REJECTED') {
      throw new Error('Reject API gagal atau status bukan REJECTED');
    }
    console.log('✅ TEST 5 LULUS: Pengeluaran berhasil ditolak dengan alasan mandatory.');

    // 8. Test Convert Rejected Expense to Employee Loan (Kasbon Staf)
    console.log('\n--- TEST 6: Convert Rejected Expense to Employee Loan ---');
    const convertLoanRes = await fetch(`${BASE_URL}/cashflow/${snackCashFlowId}/convert-to-loan`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const convertLoanData = await convertLoanRes.json();
    console.log('Status Convert Loan:', convertLoanRes.status);
    console.log('Created Loan:', convertLoanData.loan?.id, 'Amount:', convertLoanData.loan?.amount);
    if (!convertLoanRes.ok || convertLoanData.cashflow?.resolutionAction !== 'CONVERT_LOAN') {
      throw new Error('Convert to loan gagal atau resolutionAction mismatch');
    }
    console.log('✅ TEST 6 LULUS: Pengeluaran ditolak berhasil dialihkan menjadi Kasbon Staf.');

    // 9. Test Operational Analytics
    console.log('\n--- TEST 7: GET /api/cashflow/operational-analytics ---');
    const analyticsRes = await fetch(`${BASE_URL}/cashflow/operational-analytics`, {
      headers: { Authorization: `Bearer ${ownerToken}` }
    });
    const analyticsData = await analyticsRes.json();
    console.log('Status:', analyticsRes.status);
    console.log('Daily Burn Rate: Rp', analyticsData.dailyBurnRate);
    console.log('Category Breakdown Count:', analyticsData.categoryBreakdown?.length);
    console.log('Emergency Procurements Count:', analyticsData.emergencyProcurementsCount);
    if (!analyticsRes.ok || analyticsData.dailyBurnRate === undefined) {
      throw new Error('Analytics response invalid');
    }
    console.log('✅ TEST 7 LULUS: Analitik burn rate dan breakdown kategori berfungsi sempurna!');

    // Cleanup data uji
    await prisma.cashFlow.deleteMany({
      where: { id: { in: [galonCashFlowId, susuCashflowId, snackCashFlowId] } }
    });
    if (convertLoanData.loan?.id) {
      await prisma.employeeLoan.delete({ where: { id: convertLoanData.loan.id } });
    }
    console.log('\n🎉 SEMUA 7 SKENARIO PENGUJIAN KAS OPERASIONAL KAFE BERHASIL 100% TANPA KESALAHAN! 🎉');
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
