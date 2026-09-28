import { Router, Response } from 'express';
import prisma from '../../db';
import { AuthRequest } from '../../middlewares/authMiddleware';

const router = Router();

// Helper generate Invoice Number: INV-YYYYMM-001
async function generateInvoiceNumber(tenantId: string): Promise<string> {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `INV-${ym}-`;
  
  const last = await prisma.workOrderInvoice.findFirst({
    where: {
      tenantId,
      invoiceNumber: { startsWith: prefix }
    },
    orderBy: { invoiceNumber: 'desc' }
  });

  let seq = 1;
  if (last && last.invoiceNumber) {
    const parts = last.invoiceNumber.split('-');
    if (parts.length >= 3) {
      const lastSeq = parseInt(parts[2], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
  }

  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// GET /api/bengkel/invoices
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { status, customerId, search } = req.query;

    const where: any = { tenantId };

    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }

    if (customerId) {
      where.customerId = parseInt(String(customerId), 10);
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { billingName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const invoices = await prisma.workOrderInvoice.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        workOrders: {
          include: {
            workOrder: {
              select: {
                id: true,
                spkNumber: true,
                vehiclePlate: true,
                totalAmount: true,
                status: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Gagal memuat daftar invoice' });
  }
});

// GET /api/bengkel/invoices/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;

    const invoice = await prisma.workOrderInvoice.findFirst({
      where: { id: String(id), tenantId },
      include: {
        customer: true,
        workOrders: {
          include: {
            workOrder: {
              include: {
                services: {
                  include: {
                    serviceType: true
                  }
                },
                parts: {
                  include: {
                    product: { select: { id: true, name: true, barcode: true } }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice tidak ditemukan' });
    }

    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice detail:', error);
    res.status(500).json({ error: 'Gagal memuat rincian invoice' });
  }
});

// POST /api/bengkel/invoices (Generate invoice dari satu atau lebih SPK)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { customerId, billingName, billingAddress, billingNpwp, workOrderIds, taxRate, dueDate, notes } = req.body;

    if (!billingName || !workOrderIds || !Array.isArray(workOrderIds) || workOrderIds.length === 0) {
      return res.status(400).json({ error: 'Nama penagihan dan minimal 1 SPK wajib dipilih' });
    }

    // Double validate work orders belong to tenant
    const workOrders = await prisma.workOrder.findMany({
      where: {
        id: { in: workOrderIds },
        tenantId
      }
    });

    if (workOrders.length !== workOrderIds.length) {
      return res.status(400).json({ error: 'Beberapa SPK tidak valid atau milik tenant lain' });
    }

    const cancelledWo = workOrders.find(wo => wo.status === 'CANCELLED');
    if (cancelledWo) {
      return res.status(400).json({
        error: `SPK ${cancelledWo.spkNumber} berstatus BATAL (CANCELLED) dan tidak dapat dimasukkan ke dalam invoice penagihan.`
      });
    }

    // Calculate subtotal from work orders
    const subtotal = workOrders.reduce((sum, wo) => sum + wo.totalAmount, 0);
    const parsedTaxRate = taxRate != null ? parseFloat(taxRate) : 0;
    const taxAmount = subtotal * parsedTaxRate;
    const totalAmount = subtotal + taxAmount;

    const invoiceNumber = await generateInvoiceNumber(tenantId);

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.workOrderInvoice.create({
        data: {
          tenantId,
          invoiceNumber,
          customerId: customerId ? parseInt(String(customerId), 10) : null,
          billingName: String(billingName).trim(),
          billingAddress: billingAddress ? String(billingAddress).trim() : null,
          billingNpwp: billingNpwp ? String(billingNpwp).trim() : null,
          subtotal,
          taxRate: parsedTaxRate,
          taxAmount,
          totalAmount,
          paidAmount: 0,
          dueDate: dueDate ? new Date(dueDate) : null,
          status: 'DRAFT',
          notes: notes ? String(notes).trim() : null,
          workOrders: {
            create: workOrders.map(wo => ({
              workOrderId: wo.id,
              amount: wo.totalAmount
            }))
          }
        },
        include: {
          workOrders: true
        }
      });

      return inv;
    });

    res.status(201).json(invoice);
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Gagal membuat invoice' });
  }
});

// PATCH /api/bengkel/invoices/:id/status
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { id } = req.params;
    const { status, paidAmount } = req.body;

    const existing = await prisma.workOrderInvoice.findFirst({
      where: { id: String(id), tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Invoice tidak ditemukan' });
    }

    const updated = await prisma.workOrderInvoice.update({
      where: { id: existing.id },
      data: {
        ...(status && { status }),
        ...(paidAmount !== undefined && { paidAmount: parseFloat(paidAmount) })
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating invoice status:', error);
    res.status(500).json({ error: 'Gagal memperbarui status invoice' });
  }
});

/**
 * Background Automation: Periksa invoice yang melewati dueDate dan set status menjadi OVERDUE
 */
export async function runBengkelInvoiceOverdueCheck(): Promise<{ count: number }> {
  try {
    const now = new Date();
    const result = await prisma.workOrderInvoice.updateMany({
      where: {
        status: { in: ['SENT', 'DRAFT', 'PARTIALLY_PAID'] },
        dueDate: { lt: now }
      },
      data: {
        status: 'OVERDUE'
      }
    });
    if (result.count > 0) {
      console.log(`[Bengkel Cron] ${result.count} invoice B2B jatuh tempo otomatis diubah menjadi OVERDUE.`);
    }
    return { count: result.count };
  } catch (e) {
    console.error('[Bengkel Cron Overdue Error]', e);
    return { count: 0 };
  }
}

export default router;

