import prisma from '../db';
import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { io, emitToTenant } from '../index';
import { TenantContext } from '../utils/tenantContext';

const router = Router();

// Get table detail (Public - for Dine-In customers to verify table number)
router.get('/public/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let tenantId: string | undefined = (req.query.tenantId as string) || (req.headers['x-tenant-id'] as string) || undefined;
    const tenantSlug = req.query.tenant as string;

    if (!tenantId && tenantSlug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) tenantId = tenant.id;
    }

    if (!tenantId) {
      const { resolveTenantFromRequest } = require('../middlewares/tenantResolver');
      const resolved = await resolveTenantFromRequest(req);
      if (resolved) tenantId = resolved.id;
    }

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context wajib disertakan.', code: 'MISSING_TENANT_CONTEXT' });
    }

    const numId = Number(id);
    let table = null;

    if (!isNaN(numId)) {
      table = await prisma.table.findFirst({
        where: { id: numId, tenantId },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              businessType: true,
              logoUrl: true,
              settings: true
            }
          }
        }
      });
    }

    const paramId = String(id);
    if (!table) {
      table = await prisma.table.findFirst({
        where: { tableNo: paramId, tenantId },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              businessType: true,
              logoUrl: true,
              settings: true
            }
          }
        }
      });
    }

    if (!table) {
      const allTables = await prisma.table.findMany({
        where: { tenantId },
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              businessType: true,
              logoUrl: true,
              settings: true
            }
          }
        }
      });
      table = allTables.find(t => t.tableNo.toLowerCase() === paramId.toLowerCase()) || null;
    }

    if (!table) {
      return res.status(404).json({ error: 'Meja tidak ditemukan di restoran ini' });
    }
    res.json(table);
  } catch (error) {
    console.error('Error fetching public table:', error);
    res.status(500).json({ error: 'Failed to fetch table details' });
  }
});

// POST /api/tables/public/call-waiter - Customer calls waiter from table
router.post('/public/call-waiter', async (req: Request, res: Response) => {
  try {
    const { tableId, tableNo, tenantId } = req.body;
    let targetTenantId = tenantId;
    let resolvedTableNo = tableNo;

    if (tableId && (!targetTenantId || !resolvedTableNo)) {
      const numTableId = Number(tableId);
      if (!isNaN(numTableId)) {
        const table = await prisma.table.findUnique({ where: { id: numTableId } });
        if (table) {
          targetTenantId = targetTenantId || table.tenantId;
          resolvedTableNo = resolvedTableNo || table.tableNo;
        }
      }
    }

    if (targetTenantId) {
      emitToTenant(targetTenantId, 'waiter:call', {
        tableId,
        tableNo: resolvedTableNo || 'Dine-In',
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: 'Pelayan telah diberitahu' });
  } catch (error) {
    console.error('Call waiter error:', error);
    res.status(500).json({ error: 'Gagal memanggil pelayan' });
  }
});

// Get all tables (Scoped to active tenant)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia' });
    }
    const tables = await prisma.table.findMany({
      where: {
        deletedAt: null,
        tenantId
      },
      orderBy: { tableNo: 'asc' }
    });
    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// Create new table (Scoped to active tenant)
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const { tableNo, name, capacity, status, qrUrl } = req.body;
    
    if (!tableNo) return res.status(400).json({ error: 'Table Number is required' });
    
    const table = await prisma.table.create({
      data: {
        tenantId,
        tableNo,
        name: name || `Meja ${tableNo}`,
        capacity: Number(capacity) || 4,
        status: status || 'Aktif',
        qrUrl,
        posX: req.body.posX !== undefined ? Number(req.body.posX) : 10,
        posY: req.body.posY !== undefined ? Number(req.body.posY) : 10,
        shape: req.body.shape || 'square'
      }
    });
    res.status(201).json(table);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create table' });
  }
});

// Batch update table layouts (positions) - Scoped to tenant
router.put('/layout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const { layouts } = req.body;
    if (!Array.isArray(layouts)) {
      return res.status(400).json({ error: 'Format layouts tidak valid' });
    }

    const updates = await prisma.$transaction(
      layouts.map((lay: any) => 
        prisma.table.updateMany({
          where: { 
            id: Number(lay.id),
            tenantId
          },
          data: {
            posX: lay.posX !== undefined ? Number(lay.posX) : undefined,
            posY: lay.posY !== undefined ? Number(lay.posY) : undefined
          }
        })
      )
    );

    res.json({ message: 'Tata letak meja berhasil diperbarui', count: updates.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memperbarui tata letak meja' });
  }
});

// Update table (Scoped to active tenant)
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tableId = Number(id);
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const { tableNo, name, capacity, status, qrUrl } = req.body;
    
    const existing = await prisma.table.findFirst({
      where: {
        id: tableId,
        tenantId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Meja tidak ditemukan atau Anda tidak memiliki akses.' });
    }

    // Anti-IDOR: gunakan updateMany dengan { id, tenantId } bukan update dengan { id } saja
    const updateResult = await prisma.table.updateMany({
      where: { id: tableId, tenantId },
      data: {
        tableNo,
        name,
        capacity: capacity !== undefined ? Number(capacity) : undefined,
        status,
        qrUrl,
        posX: req.body.posX !== undefined ? Number(req.body.posX) : undefined,
        posY: req.body.posY !== undefined ? Number(req.body.posY) : undefined,
        shape: req.body.shape
      }
    });

    if (updateResult.count === 0) {
      return res.status(404).json({ error: 'Meja tidak ditemukan atau akses ditolak.' });
    }

    const table = await prisma.table.findFirst({ where: { id: tableId, tenantId } });
    res.json(table);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update table' });
  }
});

// Delete table (Scoped to active tenant)
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tableId = Number(id);
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    
    const existing = await prisma.table.findFirst({
      where: {
        id: tableId,
        tenantId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Meja tidak ditemukan atau Anda tidak memiliki akses.' });
    }

    // Optional check if table has active orders
    const allPendingOrders = await prisma.order.findMany({
      where: { 
        status: 'Pending',
        tenantId
      },
      select: { id: true, tableId: true, joinedTableIds: true }
    });
    
    const hasActiveOrders = allPendingOrders.some(o => {
      if (o.tableId === tableId) return true;
      if (o.joinedTableIds) {
        try {
          const ids = typeof o.joinedTableIds === 'string' ? JSON.parse(o.joinedTableIds) : o.joinedTableIds;
          if (Array.isArray(ids) && ids.includes(tableId)) return true;
        } catch (e) {}
      }
      return false;
    });
    
    if (hasActiveOrders) {
      return res.status(400).json({ error: 'Tidak dapat menghapus meja yang sedang memiliki pesanan aktif.' });
    }
    
    // Anti-IDOR: gunakan updateMany dengan { id, tenantId } untuk soft-delete
    const softDeleteResult = await prisma.table.updateMany({
      where: { id: tableId, tenantId },
      data: { deletedAt: new Date() }
    });

    if (softDeleteResult.count === 0) {
      return res.status(404).json({ error: 'Meja tidak ditemukan atau akses ditolak.' });
    }
    res.json({ success: true, message: 'Meja berhasil dipindahkan ke Keranjang Sampah.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete table' });
  }
});

// Clear / Release Table (Kosongkan Meja Langsung) - Scoped to tenant
router.post('/:id/clear', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const tenantId = user?.tenantId || TenantContext.getTenantId();
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }
    const { id } = req.params;
    const tableId = Number(id);

    const candidateOrders = await prisma.order.findMany({
      where: {
        tenantId,
        OR: [
          { status: 'Pending' },
          {
            status: 'Paid',
            kdsStatus: { in: ['Pending', 'Cooking', 'Ready', 'Cancelled'] }
          }
        ]
      }
    });

    const activeOrders = candidateOrders.filter(o => {
      if (o.tableId === tableId) return true;
      if (o.joinedTableIds) {
        try {
          const ids = typeof o.joinedTableIds === 'string' ? JSON.parse(o.joinedTableIds) : o.joinedTableIds;
          if (Array.isArray(ids) && ids.includes(tableId)) return true;
        } catch (e) {}
      }
      return false;
    });

    const pendingUnpaid = activeOrders.filter(o => o.status === 'Pending');
    if (pendingUnpaid.length > 0 && !req.body.forceDetach) {
      const orderNums = pendingUnpaid.map(o => o.orderNumber).join(', ');
      return res.status(400).json({
        error: `Terdapat pesanan belum lunas (${orderNums}) di meja ini. Harap selesaikan pembayaran terlebih dahulu atau batalkan pesanan.`,
        code: 'TABLE_HAS_UNPAID_ORDERS',
        pendingOrders: pendingUnpaid.map(o => ({ id: o.id, orderNumber: o.orderNumber, total: o.total }))
      });
    }

    const now = new Date();
    await prisma.order.updateMany({
      where: {
        id: { in: activeOrders.map(o => o.id) },
        tenantId
      },
      data: {
        kdsStatus: 'Served',
        servedAt: now,
        ...(req.body.forceDetach ? { tableId: null } : {})
      }
    });

    // Perbarui status meja menjadi 'Kosong' di database
    await prisma.table.updateMany({
      where: { id: tableId, tenantId },
      data: { status: 'Kosong' }
    });

    if (tenantId) {
      emitToTenant(tenantId, 'table:update', { tableId, status: 'Kosong' });
      emitToTenant(tenantId, 'order:paid', { tableId });
      emitToTenant(tenantId, 'order:new', { tableId });
      emitToTenant(tenantId, 'kds:statusChanged', { tableId, kdsStatus: 'Served' });
    }

    res.json({ message: 'Meja berhasil dibersihkan & dikosongkan', clearedCount: activeOrders.length });
  } catch (error: any) {
    console.error('Clear table error:', error);
    res.status(500).json({ error: error.message || 'Gagal mengosongkan meja' });
  }
});

export default router;
