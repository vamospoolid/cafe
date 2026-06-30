import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// GET all customers with optional search & filter
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { search, tier } = req.query;

    const whereCondition: any = {};

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
          select: { remaining: true }
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
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id: Number(id) },
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
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { name, phone, email, birthday } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Nama dan nomor telepon wajib diisi' });
    }

    // Check unique phone
    const existingPhone = await prisma.customer.findUnique({
      where: { phone }
    });
    if (existingPhone) {
      return res.status(400).json({ error: 'Nomor telepon sudah terdaftar' });
    }

    // Check unique email if provided
    if (email) {
      const existingEmail = await prisma.customer.findUnique({
        where: { email }
      });
      if (existingEmail) {
        return res.status(400).json({ error: 'Email sudah terdaftar' });
      }
    }

    const customer = await prisma.customer.create({
      data: {
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
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phone, email, birthday, pointsAdjustment, adjustmentReason } = req.body;

    const existingCustomer = await prisma.customer.findUnique({
      where: { id: Number(id) }
    });

    if (!existingCustomer) {
      return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
    }

    // Check phone uniqueness if updated
    if (phone && phone !== existingCustomer.phone) {
      const existingPhone = await prisma.customer.findUnique({
        where: { phone }
      });
      if (existingPhone) {
        return res.status(400).json({ error: 'Nomor telepon sudah terdaftar' });
      }
    }

    // Check email uniqueness if updated
    if (email && email !== existingCustomer.email) {
      const existingEmail = await prisma.customer.findUnique({
        where: { email }
      });
      if (existingEmail) {
        return res.status(400).json({ error: 'Email sudah terdaftar' });
      }
    }

    const updateData: any = {
      name,
      phone,
      email: email || null,
      birthday: birthday || null
    };

    // Handle manual points adjustment if requested by admin
    let pointsLogData = null;
    if (pointsAdjustment !== undefined && pointsAdjustment !== 0) {
      const newPoints = Math.max(0, existingCustomer.points + Number(pointsAdjustment));
      updateData.points = newPoints;
      
      pointsLogData = {
        points: Number(pointsAdjustment),
        type: 'Manual',
        description: adjustmentReason || 'Penyesuaian manual oleh admin'
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

// DELETE customer
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: Number(id) }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
    }

    await prisma.customer.delete({
      where: { id: Number(id) }
    });

    res.json({ message: 'Pelanggan berhasil dihapus' });
  } catch (error: any) {
    console.error('Delete Customer Error:', error);
    res.status(500).json({ error: 'Gagal menghapus pelanggan' });
  }
});

export default router;
