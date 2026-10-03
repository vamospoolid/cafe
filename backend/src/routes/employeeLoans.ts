import prisma from '../db';
import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { TenantContext } from '../utils/tenantContext';

const router = Router();

function getTenantId(req: Request): string | undefined {
  const user = (req as AuthRequest).user;
  return user?.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string);
}

function tenantWhere(tenantId: string | undefined): { tenantId: string } {
  if (!tenantId) throw new Error('MISSING_TENANT_ID: EmployeeLoan query requires tenant context');
  return { tenantId };
}

// Router-level fail-closed guard: all loan operations require authentication & tenant context
router.use(authenticateToken);
router.use((req: Request, res: Response, next) => {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    return res.status(400).json({ 
      error: 'Tenant context tidak tersedia. Silakan login ulang.', 
      code: 'MISSING_TENANT_CONTEXT' 
    });
  }
  next();
});

// GET all employee loans with optional filters - Scoped to tenant
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { status, userId, startDate, endDate } = req.query;
    const whereClause: any = {
      ...tenantWhere(tenantId)
    };

    if (status && status !== 'ALL') {
      whereClause.status = String(status);
    }
    if (userId) {
      whereClause.userId = Number(userId);
    }
    if (startDate && endDate) {
      whereClause.date = {
        gte: new Date(`${startDate}T00:00:00.000Z`),
        lte: new Date(`${endDate}T23:59:59.999Z`)
      };
    }

    const loans = await prisma.employeeLoan.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
            employmentType: true,
            status: true
          }
        },
        payments: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { date: 'desc' }
    });

    res.json(loans);
  } catch (error) {
    console.error('Fetch Employee Loans Error:', error);
    res.status(500).json({ error: 'Gagal mengambil data kasbon karyawan' });
  }
});

// GET loan summary statistics - Scoped to tenant
router.get('/summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const allLoans = await prisma.employeeLoan.findMany({
      where: tenantWhere(tenantId),
      include: {
        user: {
          select: { id: true, name: true, role: true }
        }
      }
    });

    const activeLoans = allLoans.filter(l => l.status === 'Belum Lunas');
    const totalOutstanding = activeLoans.reduce((sum, l) => sum + (l.remaining || 0), 0);
    const totalOriginalActive = activeLoans.reduce((sum, l) => sum + (l.amount || 0), 0);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const loansThisMonth = allLoans.filter(l => {
      const d = new Date(l.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const totalLoansThisMonth = loansThisMonth.reduce((sum, l) => sum + (l.amount || 0), 0);

    // Unique employees with outstanding loans
    const uniqueEmployeesWithDebt = new Set(activeLoans.map(l => l.userId)).size;
    const pendingApprovalCount = allLoans.filter(l => l.status === 'MENUNGGU_PERSETUJUAN').length;

    res.json({
      totalOutstanding,
      totalOriginalActive,
      activeLoanCount: activeLoans.length,
      totalLoansThisMonth,
      uniqueEmployeesWithDebt,
      pendingApprovalCount
    });
  } catch (error) {
    console.error('Fetch Loan Summary Error:', error);
    res.status(500).json({ error: 'Gagal mengambil ringkasan kasbon' });
  }
});

// GET my loans (for logged in staff in StaffPWA /staff) - Scoped to tenant
router.get('/my', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const userId = user?.id;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const loans = await prisma.employeeLoan.findMany({
      where: { 
        userId,
        ...tenantWhere(tenantId)
      },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { date: 'desc' }
    });

    const totalOutstanding = loans
      .filter(l => l.status === 'Belum Lunas')
      .reduce((sum, l) => sum + (l.remaining || 0), 0);

    res.json({
      loans,
      totalOutstanding,
      activeCount: loans.filter(l => l.status === 'Belum Lunas').length
    });
  } catch (error) {
    console.error('Fetch My Loans Error:', error);
    res.status(500).json({ error: 'Gagal mengambil riwayat kasbon pribadi' });
  }
});

// POST request loan (from Staff PWA) - Scoped to tenant
router.post('/request', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const userId = user?.id;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { amount, reason } = req.body;
    const loanAmount = Number(amount);
    if (!loanAmount || loanAmount <= 0) {
      return res.status(400).json({ error: 'Nominal kasbon harus lebih besar dari 0' });
    }

    const loan = await prisma.employeeLoan.create({
      data: {
        tenantId,
        userId,
        amount: loanAmount,
        remaining: loanAmount,
        date: new Date(),
        source: 'MENUNGGU',
        reason: reason ? String(reason).trim() : 'Pengajuan Kasbon Staf',
        status: 'MENUNGGU_PERSETUJUAN'
      },
      include: {
        user: {
          select: { id: true, name: true, username: true, role: true }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Permohonan kasbon berhasil diajukan dan menunggu persetujuan manajemen.',
      data: loan
    });
  } catch (error: any) {
    console.error('Request Loan Error:', error);
    res.status(400).json({ error: error.message || 'Gagal mengajukan kasbon' });
  }
});

// POST approve loan request - Scoped to tenant (Admin/Owner only)
router.post('/:id/approve', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const loanId = Number(req.params.id);
    const { source } = req.body; // 'KAS_OWNER' | 'KASIR'
    const authUser = (req as AuthRequest).user;
    const outletId = authUser?.outletId;

    const loan = await prisma.employeeLoan.findFirst({
      where: { id: loanId, ...tenantWhere(tenantId) },
      include: { user: true }
    });

    if (!loan) {
      return res.status(404).json({ error: 'Data pengajuan kasbon tidak ditemukan' });
    }
    if (loan.status !== 'MENUNGGU_PERSETUJUAN') {
      return res.status(400).json({ error: `Kasbon ini sudah berstatus ${loan.status}` });
    }

    const loanSource = source || 'KAS_OWNER';
    const approverName = authUser?.name || authUser?.username || 'Owner / Manajemen';

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.employeeLoan.update({
        where: { id: loanId },
        data: {
          status: 'Belum Lunas',
          source: loanSource,
          approvedBy: approverName,
          date: new Date()
        },
        include: {
          user: { select: { id: true, name: true, username: true, role: true } },
          payments: true
        }
      });

      if (loanSource === 'KASIR') {
        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId,
            type: 'Pengeluaran',
            category: 'Kasbon Karyawan',
            cashPocket: 'LACI_KASIR',
            status: 'APPROVED',
            amount: loan.amount,
            description: `Kasbon Tunai Kasir untuk ${loan.user.name}: ${loan.reason || 'Kasbon Karyawan'}`,
            userId: authUser?.id || 1
          }
        });
      }

      return updated;
    });

    res.json({
      success: true,
      message: 'Pengajuan kasbon berhasil disetujui & dicairkan.',
      data: result
    });
  } catch (error: any) {
    console.error('Approve Loan Error:', error);
    res.status(400).json({ error: error.message || 'Gagal menyetujui kasbon' });
  }
});

// POST reject loan request - Scoped to tenant (Admin/Owner only)
router.post('/:id/reject', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const loanId = Number(req.params.id);
    const { reason } = req.body;
    const authUser = (req as AuthRequest).user;

    const loan = await prisma.employeeLoan.findFirst({
      where: { id: loanId, ...tenantWhere(tenantId) }
    });

    if (!loan) {
      return res.status(404).json({ error: 'Data pengajuan kasbon tidak ditemukan' });
    }
    if (loan.status !== 'MENUNGGU_PERSETUJUAN') {
      return res.status(400).json({ error: `Kasbon ini sudah berstatus ${loan.status}` });
    }

    const updated = await prisma.employeeLoan.update({
      where: { id: loanId },
      data: {
        status: 'Ditolak',
        remaining: 0,
        settledNote: reason || 'Ditolak oleh manajemen',
        approvedBy: authUser?.name || authUser?.username || 'Owner / Manajemen'
      }
    });

    res.json({
      success: true,
      message: 'Pengajuan kasbon telah ditolak.',
      data: updated
    });
  } catch (error: any) {
    console.error('Reject Loan Error:', error);
    res.status(400).json({ error: error.message || 'Gagal menolak kasbon' });
  }
});

// POST create new employee loan - Scoped to tenant
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { userId, amount, date, source, reason, approvedBy } = req.body;
    const authUser = (req as AuthRequest).user;
    const tenantId = authUser?.tenantId || TenantContext.getTenantId() || (req.headers['x-tenant-id'] as string);
    const outletId = authUser?.outletId;

    if (!userId) {
      return res.status(400).json({ error: 'Karyawan / staf wajib dipilih' });
    }

    // Validasi kepemilikan tenant: pastikan staf memang terdaftar di tenant aktif
    const targetMembership = await prisma.tenantMembership.findUnique({
      where: {
        userId_tenantId: {
          userId: Number(userId),
          tenantId: tenantId!
        }
      }
    });
    if (!targetMembership) {
      return res.status(404).json({ error: 'Karyawan tidak ditemukan dalam cabang/tenant ini' });
    }

    const loanAmount = Number(amount);
    if (!loanAmount || loanAmount <= 0) {
      return res.status(400).json({ error: 'Nominal kasbon harus lebih besar dari 0' });
    }

    const loanDate = date ? new Date(date) : new Date();
    const loanSource = source || 'KAS_OWNER'; // 'KAS_OWNER' | 'KASIR'
    const approverName = approvedBy || authUser?.name || authUser?.username || 'Owner / Manajemen';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create EmployeeLoan record
      const loan = await tx.employeeLoan.create({
        data: {
          tenantId,
          userId: Number(userId),
          amount: loanAmount,
          remaining: loanAmount,
          date: loanDate,
          source: loanSource,
          reason: reason || 'Kasbon Karyawan',
          status: 'Belum Lunas',
          approvedBy: approverName
        },
        include: {
          user: {
            select: { id: true, name: true, username: true, role: true }
          }
        }
      });

      // 2. If source is KASIR (Laci Kasir), create a CashFlow Pengeluaran
      if (loanSource === 'KASIR') {
        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId,
            type: 'Pengeluaran',
            category: 'Kasbon Karyawan',
            amount: loanAmount,
            description: `Kasbon Tunai Kasir untuk ${loan.user.name}: ${reason || 'Kasbon Karyawan'}`,
            userId: authUser?.id || 1
          }
        });
      }

      return loan;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Create Employee Loan Error:', error);
    res.status(400).json({ error: error.message || 'Gagal menyimpan kasbon karyawan' });
  }
});

// PUT update employee loan - Scoped to tenant
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const loanId = Number(req.params.id);
    const { amount, reason, date, source, approvedBy } = req.body;

    const existing = await prisma.employeeLoan.findFirst({
      where: { id: loanId, ...tenantWhere(tenantId) },
      include: { payments: true }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Data kasbon tidak ditemukan' });
    }

    const totalPaid = existing.payments.reduce((sum, p) => sum + p.amountPaid, 0);
    const newAmount = amount !== undefined ? Number(amount) : existing.amount;
    const newRemaining = Math.max(0, newAmount - totalPaid);
    const newStatus = newRemaining === 0 ? 'Lunas' : 'Belum Lunas';

    await prisma.employeeLoan.updateMany({
      where: { id: loanId, ...tenantWhere(tenantId) },
      data: {
        amount: newAmount,
        remaining: newRemaining,
        status: newStatus,
        reason: reason !== undefined ? reason : existing.reason,
        source: source !== undefined ? source : existing.source,
        date: date ? new Date(date) : existing.date,
        approvedBy: approvedBy !== undefined ? approvedBy : existing.approvedBy
      }
    });

    const updated = await prisma.employeeLoan.findFirst({
      where: { id: loanId, ...tenantWhere(tenantId) },
      include: {
        user: { select: { id: true, name: true, role: true } },
        payments: true
      }
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Update Employee Loan Error:', error);
    res.status(400).json({ error: error.message || 'Gagal memperbarui data kasbon' });
  }
});

// POST payment / settlement for a single loan - Scoped to tenant
router.post('/:id/payments', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const loanId = Number(req.params.id);
    const { amountPaid, paymentMethod, notes } = req.body;
    const authUser = (req as AuthRequest).user;

    const payAmt = Number(amountPaid);
    if (!payAmt || payAmt <= 0) {
      return res.status(400).json({ error: 'Nominal pembayaran harus lebih besar dari 0' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const loan = await tx.employeeLoan.findFirst({
        where: { id: loanId, ...tenantWhere(tenantId) },
        include: { user: true }
      });

      if (!loan) {
        throw new Error('Data kasbon tidak ditemukan');
      }
      if (loan.status === 'Lunas' || loan.remaining <= 0) {
        throw new Error('Kasbon ini sudah lunas');
      }
      if (payAmt > loan.remaining) {
        throw new Error(`Nominal pembayaran melebihi sisa kasbon (Sisa: Rp ${loan.remaining.toLocaleString('id-ID')})`);
      }

      const newRemaining = Math.max(0, loan.remaining - payAmt);
      const isSettled = newRemaining === 0;

      // 1. Create payment record
      await tx.employeeLoanPayment.create({
        data: {
          tenantId,
          loanId,
          amountPaid: payAmt,
          paymentMethod: paymentMethod || 'POTONG_GAJI',
          notes: notes || (isSettled ? 'Pelunasan Kasbon' : 'Cicilan Kasbon'),
          paidBy: authUser?.name || authUser?.username || 'Owner'
        }
      });

      // 2. Update loan remaining and status
      const updatedLoan = await tx.employeeLoan.update({
        where: { id: loanId },
        data: {
          remaining: newRemaining,
          status: isSettled ? 'Lunas' : 'Belum Lunas',
          settledAt: isSettled ? new Date() : loan.settledAt,
          settledNote: isSettled ? (notes || 'Pelunasan Kasbon') : loan.settledNote
        },
        include: {
          user: { select: { id: true, name: true, role: true } },
          payments: { orderBy: { createdAt: 'desc' } }
        }
      });

      // 3. Catat entri CashFlow penerimaan kas jika dibayar tunai atau transfer
      const pm = (paymentMethod || 'POTONG_GAJI').toUpperCase();
      const isCashPayment = pm === 'TUNAI' || pm === 'CASH' || pm === 'KASIR';
      const isTransferPayment = pm === 'TRANSFER' || pm === 'BANK' || pm === 'NON_TUNAI';

      if (isCashPayment || isTransferPayment) {
        await tx.cashFlow.create({
          data: {
            tenantId,
            outletId: authUser?.outletId,
            userId: authUser?.id || 1,
            type: 'Pemasukan',
            category: isCashPayment ? 'Pengembalian Kasbon - Tunai' : 'Pengembalian Kasbon - Non-Tunai',
            cashPocket: isCashPayment ? 'LACI_KASIR' : 'KAS_OPERASIONAL',
            status: 'APPROVED',
            amount: payAmt,
            description: `Pengembalian kasbon via ${pm} dari staf ${loan.user.name} (${isSettled ? 'Lunas' : 'Cicilan'})`,
            date: new Date()
          }
        });
      }

      return updatedLoan;
    });

    res.json(result);
  } catch (error: any) {
    console.error('Process Loan Payment Error:', error);
    res.status(400).json({ error: error.message || 'Gagal memproses pembayaran kasbon' });
  }
});

// POST bulk settle loans during Payroll closing - Scoped to tenant
router.post('/bulk-settle-payroll', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { userId, loanIds, period, notes } = req.body;
    const authUser = (req as AuthRequest).user;

    const whereClause: any = {
      status: 'Belum Lunas',
      ...tenantWhere(tenantId)
    };

    if (loanIds && Array.isArray(loanIds) && loanIds.length > 0) {
      whereClause.id = { in: loanIds.map((id: any) => Number(id)) };
    } else if (userId) {
      whereClause.userId = Number(userId);
    } else {
      return res.status(400).json({ error: 'Parameter userId atau loanIds wajib disertakan' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const activeLoans = await tx.employeeLoan.findMany({
        where: whereClause,
        include: { user: true }
      });

      if (activeLoans.length === 0) {
        return { message: 'Tidak ada kasbon aktif yang perlu dilunasi', count: 0, totalSettled: 0 };
      }

      let totalSettled = 0;

      for (const loan of activeLoans) {
        const remainingToPay = loan.remaining;
        totalSettled += remainingToPay;

        // Create payment record
        await tx.employeeLoanPayment.create({
          data: {
            tenantId,
            loanId: loan.id,
            amountPaid: remainingToPay,
            paymentMethod: 'POTONG_GAJI',
            notes: notes || `Potong Gaji Otomatis ${period || ''}`.trim(),
            paidBy: authUser?.name || authUser?.username || 'Owner'
          }
        });

        // Mark as lunas
        await tx.employeeLoan.update({
          where: { id: loan.id },
          data: {
            remaining: 0,
            status: 'Lunas',
            settledAt: new Date(),
            settledNote: notes || `Lunas via Potong Gaji Periode ${period || ''}`.trim()
          }
        });
      }

      return {
        message: `Berhasil melunasi ${activeLoans.length} kasbon dengan total Rp ${totalSettled.toLocaleString('id-ID')}`,
        count: activeLoans.length,
        totalSettled
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error('Bulk Settle Loans Error:', error);
    res.status(400).json({ error: error.message || 'Gagal melunasi kasbon via payroll' });
  }
});

// DELETE loan record - Scoped to tenant
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const loanId = Number(req.params.id);

    const existing = await prisma.employeeLoan.findFirst({
      where: { id: loanId, ...tenantWhere(tenantId) }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Data kasbon tidak ditemukan' });
    }

    await prisma.employeeLoan.deleteMany({
      where: { id: loanId, ...tenantWhere(tenantId) }
    });

    res.json({ message: 'Data kasbon berhasil dihapus' });
  } catch (error: any) {
    console.error('Delete Loan Error:', error);
    res.status(400).json({ error: error.message || 'Gagal menghapus data kasbon' });
  }
});

export default router;
