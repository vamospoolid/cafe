import { Router, Response } from 'express';
import prisma from '../../db';
import { AuthRequest } from '../../middlewares/authMiddleware';

const router = Router();

// Helper untuk menghitung jatuh tempo berdasarkan termin
function calculateDueDate(baseDate: Date, paymentTerm: string, customDueDate?: string | null): Date {
  const date = new Date(baseDate);
  switch (paymentTerm) {
    case 'CASH':
      return date;
    case 'NET_7':
      date.setDate(date.getDate() + 7);
      return date;
    case 'NET_14':
      date.setDate(date.getDate() + 14);
      return date;
    case 'NET_30':
      date.setDate(date.getDate() + 30);
      return date;
    case 'NET_60':
      date.setDate(date.getDate() + 60);
      return date;
    case 'CUSTOM':
      return customDueDate ? new Date(customDueDate) : new Date(date.setDate(date.getDate() + 30));
    default:
      date.setDate(date.getDate() + 30);
      return date;
  }
}

// GET /api/bengkel/supplier-invoices/summary - Ringkasan Finansial Hutang Nota
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const now = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);

    // 1. Ambil semua nota yang belum lunas
    const activeInvoices = await prisma.supplierInvoice.findMany({
      where: {
        tenantId,
        status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] }
      },
      select: {
        id: true,
        remainingAmount: true,
        dueDate: true,
        status: true
      }
    });

    let totalDebt = 0;
    let dueThisWeekCount = 0;
    let dueThisWeekAmount = 0;
    let overdueCount = 0;
    let overdueAmount = 0;

    for (const inv of activeInvoices) {
      totalDebt += inv.remainingAmount;
      const due = new Date(inv.dueDate);

      if (due < now) {
        overdueCount++;
        overdueAmount += inv.remainingAmount;
      } else if (due <= sevenDaysLater) {
        dueThisWeekCount++;
        dueThisWeekAmount += inv.remainingAmount;
      }
    }

    // 2. Total pembayaran bulan ini
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const paymentsThisMonth = await prisma.supplierInvoicePayment.aggregate({
      where: {
        tenantId,
        paymentDate: { gte: startOfMonth }
      },
      _sum: { amount: true },
      _count: true
    });

    res.json({
      totalDebt,
      dueThisWeekCount,
      dueThisWeekAmount,
      overdueCount,
      overdueAmount,
      totalActiveInvoices: activeInvoices.length,
      paidThisMonthAmount: paymentsThisMonth._sum.amount || 0,
      paidThisMonthCount: paymentsThisMonth._count || 0
    });
  } catch (error) {
    console.error('Error fetching supplier invoices summary:', error);
    res.status(500).json({ error: 'Gagal memuat ringkasan hutang supplier' });
  }
});

// GET /api/bengkel/supplier-invoices - Daftar Faktur Masuk
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { status, supplierId, search, limit = '100', offset = '0' } = req.query;

    const where: any = { tenantId };

    if (status && typeof status === 'string' && status !== 'ALL') {
      if (status === 'OVERDUE') {
        const now = new Date();
        where.AND = [
          { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
          { dueDate: { lt: now } }
        ];
      } else {
        where.status = status;
      }
    }

    if (supplierId) {
      where.supplierId = parseInt(String(supplierId), 10);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { supplier: { name: { contains: q, mode: 'insensitive' } } },
        { notes: { contains: q, mode: 'insensitive' } }
      ];
    }

    const [invoices, totalCount] = await Promise.all([
      prisma.supplierInvoice.findMany({
        where,
        include: {
          supplier: {
            select: { id: true, name: true, phone: true, contact: true }
          },
          items: {
            select: {
              id: true,
              productId: true,
              partName: true,
              qty: true,
              buyPrice: true,
              subtotal: true
            }
          },
          payments: {
            orderBy: { paymentDate: 'desc' }
          }
        },
        orderBy: [
          { status: 'asc' }, // Prioritaskan UNPAID/OVERDUE di atas
          { dueDate: 'asc' }
        ],
        take: parseInt(String(limit), 10),
        skip: parseInt(String(offset), 10)
      }),
      prisma.supplierInvoice.count({ where })
    ]);

    // Dinamis update status OVERDUE jika waktu sudah lewat saat di-query
    const now = new Date();
    const formatted = invoices.map(inv => {
      const isPastDue = new Date(inv.dueDate) < now && inv.remainingAmount > 0;
      const effectiveStatus = isPastDue && inv.status !== 'PAID' ? 'OVERDUE' : inv.status;
      return {
        ...inv,
        status: effectiveStatus,
        isOverdue: isPastDue
      };
    });

    res.json({
      invoices: formatted,
      totalCount
    });
  } catch (error) {
    console.error('Error fetching supplier invoices:', error);
    res.status(500).json({ error: 'Gagal mengambil data faktur pembelian' });
  }
});

// GET /api/bengkel/supplier-invoices/:id - Detail Faktur
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const invoice = await prisma.supplierInvoice.findFirst({
      where: { id: String(id), tenantId },
      include: {
        supplier: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                barcode: true,
                stock: true,
                brand: true,
                storageLocation: true
              }
            }
          }
        },
        payments: {
          orderBy: { paymentDate: 'desc' }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Faktur pembelian tidak ditemukan' });
    }

    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice detail:', error);
    res.status(500).json({ error: 'Gagal memuat rincian faktur pembelian' });
  }
});

// POST /api/bengkel/supplier-invoices - Simpan Faktur Masuk + Update Stok & HPP
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const user = (req as any).user;
    const userId = user?.id;

    const {
      supplierId,
      invoiceNumber,
      invoiceDate = new Date().toISOString(),
      paymentTerm = 'NET_30',
      customDueDate,
      taxAmount = 0,
      notes,
      receivedBy,
      proofImageUrl,
      items = []
    } = req.body;

    if (!supplierId) {
      return res.status(400).json({ error: 'Supplier wajib dipilih' });
    }
    if (!invoiceNumber || !String(invoiceNumber).trim()) {
      return res.status(400).json({ error: 'Nomor nota / faktur fisik supplier wajib diisi' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Minimal 1 suku cadang wajib dimasukkan ke dalam nota' });
    }

    // 1. Verifikasi Supplier milik tenant ini
    const supplier = await prisma.supplier.findFirst({
      where: { id: parseInt(String(supplierId), 10), tenantId }
    });
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier tidak ditemukan atau tidak memiliki akses' });
    }

    // 2. Cek apakah nomor nota ini sudah pernah diinput untuk supplier yang sama
    const existing = await prisma.supplierInvoice.findFirst({
      where: {
        tenantId,
        supplierId: supplier.id,
        invoiceNumber: String(invoiceNumber).trim()
      }
    });
    if (existing) {
      return res.status(400).json({
        error: `Nomor nota "${invoiceNumber}" dari supplier ${supplier.name} sudah pernah dicatat sebelumnya (ID: ${existing.id}).`
      });
    }

    // 3. Validasi & Ambil data semua produk yang diinput
    const productIds = items.map(i => parseInt(String(i.productId), 10));
    const validProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId
      }
    });

    if (validProducts.length !== new Set(productIds).size) {
      return res.status(400).json({ error: 'Beberapa suku cadang tidak ditemukan dalam katalog tenant ini' });
    }

    const prodMap = new Map(validProducts.map(p => [p.id, p]));

    // 4. Kalkulasi Subtotal & Total
    let subtotal = 0;
    const processedItems: Array<{
      productId: number;
      partName: string;
      qty: number;
      buyPrice: number;
      subtotal: number;
      oldStock: number;
      oldBuyPrice: number;
      newBuyPrice: number;
    }> = [];

    for (const item of items) {
      const pid = parseInt(String(item.productId), 10);
      const prod = prodMap.get(pid)!;
      const qty = Math.max(1, parseInt(String(item.qty), 10) || 1);
      const buyPrice = Math.max(0, parseFloat(String(item.buyPrice)) || 0);
      const itemSubtotal = qty * buyPrice;

      subtotal += itemSubtotal;

      // Rumus Moving Average HPP
      const oldStock = Math.max(0, prod.stock || 0);
      const oldBuyPrice = prod.buyPrice || 0;
      const weightedHPP = (oldStock + qty > 0)
        ? Math.round(((oldStock * oldBuyPrice) + (qty * buyPrice)) / (oldStock + qty))
        : buyPrice;

      processedItems.push({
        productId: pid,
        partName: item.partName || prod.name,
        qty,
        buyPrice,
        subtotal: itemSubtotal,
        oldStock,
        oldBuyPrice,
        newBuyPrice: weightedHPP
      });
    }

    const parsedTax = Math.max(0, parseFloat(String(taxAmount)) || 0);
    const totalAmount = subtotal + parsedTax;

    const parsedInvoiceDate = new Date(invoiceDate);
    const dueDate = calculateDueDate(parsedInvoiceDate, paymentTerm, customDueDate);

    const isCash = paymentTerm === 'CASH';
    const initialPaid = isCash ? totalAmount : 0;
    const initialRemaining = isCash ? 0 : totalAmount;
    const initialStatus = isCash ? 'PAID' : 'UNPAID';

    // 5. Eksekusi Atomik Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 5.1. Buat Faktur Supplier
      const inv = await tx.supplierInvoice.create({
        data: {
          tenantId,
          supplierId: supplier.id,
          invoiceNumber: String(invoiceNumber).trim(),
          invoiceDate: parsedInvoiceDate,
          paymentTerm,
          dueDate,
          subtotal,
          taxAmount: parsedTax,
          totalAmount,
          paidAmount: initialPaid,
          remainingAmount: initialRemaining,
          status: initialStatus,
          notes: notes ? String(notes).trim() : null,
          receivedBy: receivedBy ? String(receivedBy).trim() : null,
          proofImageUrl: proofImageUrl ? String(proofImageUrl).trim() : null,
          items: {
            create: processedItems.map(p => ({
              productId: p.productId,
              partName: p.partName,
              qty: p.qty,
              buyPrice: p.buyPrice,
              subtotal: p.subtotal
            }))
          }
        },
        include: {
          items: true
        }
      });

      // 5.2. Update Stok & HPP Moving Average untuk masing-masing Produk
      for (const item of processedItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.qty },
            buyPrice: item.newBuyPrice
          }
        });
      }

      // 5.3. Jika Pembayaran Tunai (CASH / COD), langsung buat record Payment & Potong Kas Keluar
      if (isCash) {
        await tx.supplierInvoicePayment.create({
          data: {
            tenantId,
            invoiceId: inv.id,
            amount: totalAmount,
            paymentMethod: 'CASH',
            paymentDate: parsedInvoiceDate,
            notes: `Pembayaran tunai langsung (COD) saat barang diterima`,
            referenceNo: `COD-${inv.invoiceNumber}`
          }
        });

        let effectiveUserId = userId ? parseInt(String(userId), 10) : null;
        if (!effectiveUserId) {
          const firstUser = await tx.user.findFirst({
            where: { memberships: { some: { tenantId } } },
            select: { id: true }
          });
          effectiveUserId = firstUser?.id || 1;
        }

        await tx.cashFlow.create({
          data: {
            tenantId,
            type: 'Pengeluaran',
            category: 'Pembelian Stok - Tunai (COD)',
            amount: totalAmount,
            description: `Pembelian Suku Cadang Tunai Nota #${inv.invoiceNumber} (${supplier.name})`,
            userId: effectiveUserId
          }
        });
      }

      return inv;
    });

    res.status(201).json({
      message: `Faktur pembelian #${result.invoiceNumber} berhasil disimpan. Stok suku cadang telah bertambah.`,
      invoice: result
    });
  } catch (error) {
    console.error('Error creating supplier invoice:', error);
    res.status(500).json({ error: 'Gagal menyimpan faktur pembelian suku cadang' });
  }
});

// POST /api/bengkel/supplier-invoices/:id/payments - Pembayaran / Cicilan Hutang Nota
router.post('/:id/payments', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const user = (req as any).user;
    const userId = user?.id;
    const { id } = req.params;

    const {
      amount,
      paymentMethod = 'BANK_TRANSFER',
      paymentDate = new Date().toISOString(),
      referenceNo,
      notes
    } = req.body;

    const payAmount = parseFloat(String(amount));
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ error: 'Nominal pembayaran harus lebih besar dari 0' });
    }

    // 1. Verifikasi Faktur milik Tenant
    const invoice = await prisma.supplierInvoice.findFirst({
      where: { id: String(id), tenantId },
      include: { supplier: true }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Faktur tidak ditemukan atau tidak memiliki akses' });
    }

    if (invoice.status === 'PAID' || invoice.remainingAmount <= 0) {
      return res.status(400).json({ error: 'Faktur ini sudah lunas seluruhnya' });
    }

    if (payAmount > invoice.remainingAmount) {
      return res.status(400).json({
        error: `Nominal pembayaran (Rp ${payAmount.toLocaleString('id-ID')}) melebihi sisa hutang (Rp ${invoice.remainingAmount.toLocaleString('id-ID')})`
      });
    }

    const newPaidAmount = invoice.paidAmount + payAmount;
    const newRemainingAmount = Math.max(0, invoice.totalAmount - newPaidAmount);
    const newStatus = newRemainingAmount <= 0 ? 'PAID' : 'PARTIAL';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Catat pembayaran
      const payment = await tx.supplierInvoicePayment.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          amount: payAmount,
          paymentMethod,
          paymentDate: new Date(paymentDate),
          referenceNo: referenceNo ? String(referenceNo).trim() : null,
          notes: notes ? String(notes).trim() : null
        }
      });

      // 2. Perbarui status dan sisa hutang faktur
      const updatedInvoice = await tx.supplierInvoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          status: newStatus
        }
      });

      // 3. Catat di Arus Kas jika uang keluar dari kas/bank toko (bukan dana talangan owner di luar pembukuan)
      if (paymentMethod !== 'DANA_PRIBADI_OWNER') {
        let effectiveUserId = userId ? parseInt(String(userId), 10) : null;
        if (!effectiveUserId) {
          const firstUser = await tx.user.findFirst({
            where: { memberships: { some: { tenantId } } },
            select: { id: true }
          });
          effectiveUserId = firstUser?.id || 1;
        }

        const methodLabel = paymentMethod === 'CASH' ? 'Kas Laci Kasir' : 'Transfer Bank';
        await tx.cashFlow.create({
          data: {
            tenantId,
            type: 'Pengeluaran',
            category: 'Pembayaran Hutang Supplier',
            amount: payAmount,
            description: `Pelunasan/Cicilan Hutang Nota #${invoice.invoiceNumber} (${invoice.supplier.name}) via ${methodLabel}${referenceNo ? ` [Ref: ${referenceNo}]` : ''}`,
            userId: effectiveUserId
          }
        });
      }

      return { payment, updatedInvoice };
    });

    res.status(201).json({
      message: newStatus === 'PAID'
        ? `Faktur #${invoice.invoiceNumber} telah LUNAS.`
        : `Pembayaran Rp ${payAmount.toLocaleString('id-ID')} berhasil dicatat. Sisa hutang: Rp ${newRemainingAmount.toLocaleString('id-ID')}`,
      payment: result.payment,
      invoice: result.updatedInvoice
    });
  } catch (error) {
    console.error('Error processing supplier invoice payment:', error);
    res.status(500).json({ error: 'Gagal memproses pembayaran faktur supplier' });
  }
});

// DELETE /api/bengkel/supplier-invoices/:id - Batalkan / Hapus Faktur (Rollback Stok)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const invoice = await prisma.supplierInvoice.findFirst({
      where: { id: String(id), tenantId },
      include: {
        items: true,
        payments: true
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Faktur tidak ditemukan' });
    }

    if (invoice.payments.length > 0) {
      return res.status(400).json({
        error: 'Faktur yang sudah memiliki riwayat pembayaran tidak dapat dihapus langsung. Batalkan pembayaran terlebih dahulu.'
      });
    }

    // Rollback stok suku cadang
    await prisma.$transaction(async (tx) => {
      for (const item of invoice.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { decrement: item.qty }
          }
        });
      }

      await tx.supplierInvoice.delete({
        where: { id: invoice.id }
      });
    });

    res.json({
      message: `Faktur #${invoice.invoiceNumber} berhasil dihapus dan penambahan stok telah dikembalikan.`
    });
  } catch (error) {
    console.error('Error deleting supplier invoice:', error);
    res.status(500).json({ error: 'Gagal menghapus faktur supplier' });
  }
});

export default router;
