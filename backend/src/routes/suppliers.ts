import prisma from '../db';
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middlewares/authMiddleware';
import { AuditLogger } from '../services/AuditLogger';

const router = Router();

function getTenantId(req: Request): string | undefined {
  const user = (req as any).user;
  return user?.tenantId || (req.headers['x-tenant-id'] as string);
}

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

// GET all suppliers (Scoped to active tenant)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)!;
    const suppliers = await prisma.supplier.findMany({
      where: {
        deletedAt: null,
        tenantId
      },
      include: {
        _count: { select: { purchaseOrders: true, ingredients: true, supplierInvoices: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data supplier' });
  }
});

// GET single supplier + PO history (Scoped to active tenant)
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req)!;
    const supplier = await prisma.supplier.findFirst({
      where: { 
        id: Number(id),
        tenantId
      },
      include: {
        ingredients: { select: { id: true, name: true, unit: true } },
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, poNumber: true, status: true, totalAmount: true, orderedAt: true }
        }
      }
    });
    if (!supplier) return res.status(404).json({ error: 'Supplier tidak ditemukan atau Anda tidak memiliki akses' });
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil detail supplier' });
  }
});

// POST create supplier (Scoped to active tenant)
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req)!;
    const { name, contact, phone, email, address, notes } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nama supplier wajib diisi' });

    const supplier = await prisma.supplier.create({
      data: { tenantId, name: name.trim(), contact, phone, email, address, notes }
    });

    await AuditLogger.log({
      tenantId,
      action: 'SUPPLIER_CREATE',
      resource: 'SUPPLIER',
      resourceId: String(supplier.id),
      description: `Supplier "${supplier.name}" berhasil dibuat.`,
      newValue: { name: supplier.name, contact, phone },
      severity: 'INFO'
    }, req);

    res.status(201).json(supplier);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal membuat supplier' });
  }
});

// PUT update supplier (Scoped to active tenant)
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supplierId = Number(id);
    const tenantId = getTenantId(req)!;
    const { name, contact, phone, email, address, notes } = req.body;

    const existing = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        tenantId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Supplier tidak ditemukan atau Anda tidak memiliki akses' });
    }

    await prisma.supplier.updateMany({
      where: { id: supplierId, tenantId },
      data: { 
        name: name !== undefined ? name.trim() : undefined, 
        contact, 
        phone, 
        email, 
        address, 
        notes 
      }
    });

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, tenantId }
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier tidak ditemukan' });
    }

    await AuditLogger.log({
      tenantId,
      action: 'SUPPLIER_UPDATE',
      resource: 'SUPPLIER',
      resourceId: String(supplierId),
      description: `Supplier "${supplier.name}" berhasil diperbarui.`,
      oldValue: { name: existing.name, phone: existing.phone },
      newValue: { name: supplier.name, phone: supplier.phone },
      severity: 'INFO'
    }, req);

    res.json(supplier);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memperbarui supplier' });
  }
});

// DELETE supplier (Scoped to active tenant)
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supplierId = Number(id);
    const tenantId = getTenantId(req)!;

    const existing = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        tenantId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Supplier tidak ditemukan atau Anda tidak memiliki akses' });
    }

    // Check how many active ingredients are linked
    const activeIngredientsCount = await prisma.ingredient.count({
      where: {
        supplierId,
        tenantId,
        deletedAt: null
      }
    });

    // Soft delete supplier (Move to Recycle Bin for 30 days)
    await prisma.supplier.updateMany({
      where: { id: supplierId, tenantId },
      data: { deletedAt: new Date() }
    });

    await AuditLogger.log({
      tenantId,
      action: 'SUPPLIER_DELETE_SOFT',
      resource: 'SUPPLIER',
      resourceId: String(supplierId),
      description: `Supplier "${existing.name}" dipindahkan ke Keranjang Sampah. (${activeIngredientsCount} bahan baku terhubung)`,
      oldValue: { name: existing.name, activeIngredientsCount },
      severity: 'WARNING'
    }, req);

    res.json({ 
      success: true, 
      message: `Supplier "${existing.name}" berhasil dipindahkan ke Keranjang Sampah.`,
      activeIngredientsCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal menghapus supplier' });
  }
});

export default router;
