import prisma from '../db';
import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';

const router = Router();

// GET all customers with optional search & filter
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    // Fail-closed: tidak pernah fallback ke tenant hardcoded
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const { search, tier } = req.query;

    const whereCondition: any = { tenantId, deletedAt: null };

    if (search) {
      whereCondition.OR = [
        { name: { contains: String(search) } },
        { phone: { contains: String(search) } },
        { email: { contains: String(search) } }
      ];
    }

    if (tier) {
      whereCondition.tier = String(tier);
    }

    const customers = await prisma.customer.findMany({
      where: whereCondition,
      include: {
        debts: {
          where: { status: 'Belum Lunas' },
          select: { id: true, remaining: true, status: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json(customers);
  } catch (error: any) {
    console.error('Fetch Customers Error:', error);
    res.status(500).json({ error: 'Gagal mengambil data pelanggan' });
  }
});

// GET customer detail, order history, and point logs
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const { id } = req.params;

    const customer = await prisma.customer.findFirst({
      where: { id: Number(id), tenantId },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            createdAt: true
          }
        },
        pointLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20
        },
        debts: {
          orderBy: { createdAt: 'desc' },
          include: {
            payments: {
              orderBy: { createdAt: 'desc' }
            },
            order: {
              select: {
                orderNumber: true
              }
            }
          }
        },
        // Riwayat SPK bengkel — hanya ada data jika tenant bengkel
        workOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            vehicle: {
              select: { plateNumber: true, brand: true, model: true, year: true }
            },
            services: {
              select: {
                id: true,
                serviceName: true,
                subtotal: true,
                serviceType: { select: { name: true } }
              }
            },
            parts: {
              select: { id: true, partName: true, qty: true, subtotal: true }
            }
          }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
    }

    res.json(customer);
  } catch (error: any) {
    console.error('Fetch Customer Detail Error:', error);
    res.status(500).json({ error: 'Gagal mengambil detail pelanggan' });
  }
});


// POST register new customer
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const { name, phone, email, birthday } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Nama dan nomor telepon wajib diisi' });
    }

    // Check unique phone within tenant
    const existingPhone = await prisma.customer.findFirst({
      where: { phone, tenantId }
    });
    if (existingPhone) {
      return res.status(400).json({ error: 'Nomor telepon sudah terdaftar di outlet Anda' });
    }

    // Check unique email within tenant if provided
    if (email) {
      const existingEmail = await prisma.customer.findFirst({
        where: { email, tenantId }
      });
      if (existingEmail) {
        return res.status(400).json({ error: 'Email sudah terdaftar di outlet Anda' });
      }
    }

    const customer = await prisma.customer.create({
      data: {
        tenantId,
        name,
        phone,
        email: email || null,
        birthday: birthday || null,
        points: 0,
        tier: 'Bronze',
        totalSpent: 0
      }
    });

    res.status(201).json(customer);
  } catch (error: any) {
    console.error('Create Customer Error:', error);
    res.status(500).json({ error: 'Gagal mendaftarkan pelanggan' });
  }
});

// PUT update customer
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const { id } = req.params;
    const { name, phone, email, birthday, pointsAdjustment, adjustmentReason } = req.body;

    const existingCustomer = await prisma.customer.findFirst({
      where: { id: Number(id), tenantId }
    });

    if (!existingCustomer) {
      return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
    }

    // Check phone uniqueness if updated
    if (phone && phone !== existingCustomer.phone) {
      const existingPhone = await prisma.customer.findFirst({
        where: { phone, tenantId, id: { not: Number(id) } }
      });
      if (existingPhone) {
        return res.status(400).json({ error: 'Nomor telepon sudah terdaftar di outlet Anda' });
      }
    }

    // Check email uniqueness if updated
    if (email && email !== existingCustomer.email) {
      const existingEmail = await prisma.customer.findFirst({
        where: { email, tenantId, id: { not: Number(id) } }
      });
      if (existingEmail) {
        return res.status(400).json({ error: 'Email sudah terdaftar di outlet Anda' });
      }
    }

    const updateData: any = {
      name,
      phone,
      email: email || null,
      birthday: birthday || null
    };

    // Handle manual points adjustment if requested by admin
    // CRM-004: Role guard — hanya Owner/Admin yang boleh adjust poin manual
    // Staf kasir tidak boleh menyalahgunakan endpoint ini untuk kecurangan poin
    let pointsLogData = null;
    if (pointsAdjustment !== undefined && Number(pointsAdjustment) !== 0) {
      const allowedRoles = ['OWNER', 'Owner', 'owner', 'Admin', 'admin', 'superadmin', 'SUPERADMIN', 'Manager', 'manager'];
      const userRole = req.user?.role || '';
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          error: 'Hanya Owner / Admin yang dapat menyesuaikan poin secara manual',
          code: 'INSUFFICIENT_ROLE'
        });
      }

      const newPoints = Math.max(0, existingCustomer.points + Number(pointsAdjustment));
      updateData.points = newPoints;

      pointsLogData = {
        tenantId,
        points: Number(pointsAdjustment),
        type: 'Manual',
        description: adjustmentReason || `Penyesuaian manual oleh ${req.user?.name || userRole}`
      };
    }

    const customer = await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id: Number(id) },
        data: updateData
      });

      if (pointsLogData) {
        await tx.pointLog.create({
          data: {
            tenantId,
            customerId: Number(id),
            points: pointsLogData.points,
            type: pointsLogData.type,
            description: pointsLogData.description
          }
        });
      }

      return updated;
    });

    res.json(customer);
  } catch (error: any) {
    console.error('Update Customer Error:', error);
    res.status(500).json({ error: 'Gagal memperbarui pelanggan' });
  }
});

// DELETE customer (Soft delete to Recycle Bin for 30 days)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const { id } = req.params;

    const customer = await prisma.customer.findFirst({
      where: { id: Number(id), tenantId, deletedAt: null }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
    }

    await prisma.customer.updateMany({
      where: { id: Number(id), tenantId },
      data: { deletedAt: new Date() }
    });

    res.json({ success: true, message: `Pelanggan "${customer.name}" berhasil dipindahkan ke Keranjang Sampah.` });
  } catch (error: any) {
    console.error('Delete Customer Error:', error);
    res.status(500).json({ error: 'Gagal menghapus pelanggan' });
  }
});

export default router;
