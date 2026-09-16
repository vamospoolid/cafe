import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// GET all employee loans with optional filters
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status, userId, startDate, endDate } = req.query;
    const whereClause: any = {};

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

// GET loan summary statistics
router.get('/summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const allLoans = await prisma.employeeLoan.findMany({
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

    res.json({
      totalOutstanding,
      totalOriginalActive,
      activeLoanCount: activeLoans.length,
      totalLoansThisMonth,
      uniqueEmployeesWithDebt
    });
  } catch (error) {
    console.error('Fetch Loan Summary Error:', error);
    res.status(500).json({ error: 'Gagal mengambil ringkasan kasbon' });
  }
});

// GET my loans (for logged in staff in StaffPWA /staff)
router.get('/my', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const loans = await prisma.employeeLoan.findMany({
      where: { userId },
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

// POST create new employee loan
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { userId, amount, date, source, reason, approvedBy } = req.body;
    const authUser = (req as any).user;

    if (!userId) {
      return res.status(400).json({ error: 'Karyawan / staf wajib dipilih' });
    }
    const loanAmount = Number(amount);
    if (!loanAmount || loanAmount <= 0) {
      return res.status(400).json({ error: 'Nominal kasbon harus lebih besar dari 0' });
    }

    const loanDate = date ? new Date(date) : new Date();
    const loanSource = source || 'KAS_OWNER'; // 'KAS_OWNER' | 'KASIR'
    const approverName = approvedBy || authUser.name || authUser.username || 'Owner / Manajemen';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create EmployeeLoan record
      const loan = await tx.employeeLoan.create({
        data: {
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
            type: 'Pengeluaran',
            category: 'Kasbon Karyawan',
            amount: loanAmount,
            description: `Kasbon Tunai Kasir untuk ${loan.user.name}: ${reason || 'Kasbon Karyawan'}`,
            userId: authUser.id
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

// PUT update employee loan
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const loanId = Number(req.params.id);
    const { amount, reason, date, source, approvedBy } = req.body;

    const existing = await prisma.employeeLoan.findUnique({
      where: { id: loanId },
      include: { payments: true }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Data kasbon tidak ditemukan' });
    }

    const totalPaid = existing.payments.reduce((sum, p) => sum + p.amountPaid, 0);
    const newAmount = amount !== undefined ? Number(amount) : existing.amount;
    const newRemaining = Math.max(0, newAmount - totalPaid);
    const newStatus = newRemaining === 0 ? 'Lunas' : 'Belum Lunas';

    const updated = await prisma.employeeLoan.update({
      where: { id: loanId },
      data: {
        amount: newAmount,
        remaining: newRemaining,
        status: newStatus,
        reason: reason !== undefined ? reason : existing.reason,
        source: source !== undefined ? source : existing.source,
        date: date ? new Date(date) : existing.date,
        approvedBy: approvedBy !== undefined ? approvedBy : existing.approvedBy
      },
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

// POST payment / settlement for a single loan
router.post('/:id/payments', authenticateToken, async (req: Request, res: Response) => {
  try {
    const loanId = Number(req.params.id);
    const { amountPaid, paymentMethod, notes } = req.body;
    const authUser = (req as any).user;

    const payAmt = Number(amountPaid);
    if (!payAmt || payAmt <= 0) {
      return res.status(400).json({ error: 'Nominal pembayaran harus lebih besar dari 0' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const loan = await tx.employeeLoan.findUnique({
        where: { id: loanId },
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
          loanId,
          amountPaid: payAmt,
          paymentMethod: paymentMethod || 'POTONG_GAJI',
          notes: notes || (isSettled ? 'Pelunasan Kasbon' : 'Cicilan Kasbon'),
          paidBy: authUser.name || authUser.username || 'Owner'
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

      return updatedLoan;
    });

    res.json(result);
  } catch (error: any) {
    console.error('Process Loan Payment Error:', error);
    res.status(400).json({ error: error.message || 'Gagal memproses pembayaran kasbon' });
  }
});

// POST bulk settle loans during Payroll closing
router.post('/bulk-settle-payroll', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { userId, loanIds, period, notes } = req.body;
    const authUser = (req as any).user;

    const whereClause: any = {
      status: 'Belum Lunas'
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
            loanId: loan.id,
            amountPaid: remainingToPay,
            paymentMethod: 'POTONG_GAJI',
            notes: notes || `Potong Gaji Otomatis ${period || ''}`.trim(),
            paidBy: authUser.name || authUser.username || 'Owner'
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

// DELETE loan record
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const loanId = Number(req.params.id);
    await prisma.employeeLoan.delete({
      where: { id: loanId }
    });

    res.json({ message: 'Data kasbon berhasil dihapus' });
  } catch (error: any) {
    console.error('Delete Loan Error:', error);
    res.status(400).json({ error: error.message || 'Gagal menghapus data kasbon' });
  }
});

export default router;
