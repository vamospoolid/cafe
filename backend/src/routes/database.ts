import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();
const prisma = new PrismaClient();

// GET /api/database/info - Mengambil status & ringkasan database
router.get('/info', authenticateToken, async (req: Request, res: Response) => {
  try {
    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgres = dbUrl.startsWith('postgres');

    const [userCount, orderCount, productCount, ingredientCount, saleCount] = await Promise.all([
      prisma.user.count().catch(() => 0),
      prisma.order.count().catch(() => 0),
      prisma.product.count().catch(() => 0),
      prisma.ingredient.count().catch(() => 0),
      prisma.warehouseSale.count().catch(() => 0),
    ]);

    res.json({
      engine: isPostgres ? 'PostgreSQL' : 'SQLite',
      status: 'Connected',
      timestamp: new Date().toISOString(),
      counts: {
        users: userCount,
        orders: orderCount,
        products: productCount,
        ingredients: ingredientCount,
        warehouseSales: saleCount
      }
    });
  } catch (error: any) {
    console.error('Gagal mengambil info database:', error);
    res.status(500).json({ error: 'Gagal mengambil informasi database' });
  }
});

// GET /api/database/backup - Unduh backup database (PostgreSQL / Prisma Data Snapshot)
router.get('/backup', authenticateToken, async (req: Request, res: Response) => {
  try {
    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgres = dbUrl.startsWith('postgres');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (isPostgres) {
      // 1. Coba pg_dump jika pg_dump tersedia di server environment
      const tempDumpPath = path.join(process.cwd(), `temp_backup_${Date.now()}.sql`);
      
      exec(`pg_dump "${dbUrl}" --clean --if-exists`, { maxBuffer: 1024 * 1024 * 50 }, async (err, stdout) => {
        if (!err && stdout && stdout.length > 100) {
          fs.writeFileSync(tempDumpPath, stdout, 'utf8');
          return res.download(tempDumpPath, `backup-poscafe-${timestamp}.sql`, (downloadErr) => {
            try { if (fs.existsSync(tempDumpPath)) fs.unlinkSync(tempDumpPath); } catch (_) {}
            if (downloadErr && !res.headersSent) {
              res.status(500).json({ error: 'Gagal mengunduh file dump SQL' });
            }
          });
        }

        // 2. Fallback: Ekspor komprehensif seluruh tabel via Prisma JSON Snapshot
        try {
          const [
            users, categories, products, tables, reservations, customers, pointLogs,
            orders, orderItems, cashFlows, attendances, settings, shifts, suppliers,
            ingredients, recipeItems, ingredientLogs, purchaseOrders, purchaseOrderItems,
            debts, debtPayments, leaveRequests, shiftHandovers, kitchenChecklists,
            warehouseInbounds, warehouseInboundItems, warehouseRequisitions, warehouseRequisitionItems,
            ownerFundTransactions, warehouseSales, warehouseSaleItems
          ] = await Promise.all([
            prisma.user.findMany(),
            prisma.category.findMany(),
            prisma.product.findMany(),
            prisma.table.findMany(),
            prisma.reservation.findMany(),
            prisma.customer.findMany(),
            prisma.pointLog.findMany(),
            prisma.order.findMany(),
            prisma.orderItem.findMany(),
            prisma.cashFlow.findMany(),
            prisma.attendance.findMany(),
            prisma.settings.findMany(),
            prisma.shift.findMany(),
            prisma.supplier.findMany(),
            prisma.ingredient.findMany(),
            prisma.recipeItem.findMany(),
            prisma.ingredientLog.findMany(),
            prisma.purchaseOrder.findMany(),
            prisma.purchaseOrderItem.findMany(),
            prisma.debt.findMany(),
            prisma.debtPayment.findMany(),
            prisma.leaveRequest.findMany(),
            prisma.shiftHandover.findMany(),
            prisma.kitchenChecklist.findMany(),
            prisma.warehouseInbound.findMany(),
            prisma.warehouseInboundItem.findMany(),
            prisma.warehouseRequisition.findMany(),
            prisma.warehouseRequisitionItem.findMany(),
            prisma.ownerFundTransaction.findMany(),
            prisma.warehouseSale.findMany(),
            prisma.warehouseSaleItem.findMany()
          ]);

          const snapshot = {
            metadata: {
              system: 'POS & Central Warehouse Cafe',
              engine: 'PostgreSQL',
              exportedAt: new Date().toISOString(),
              version: '2026.1'
            },
            data: {
              users, categories, products, tables, reservations, customers, pointLogs,
              orders, orderItems, cashFlows, attendances, settings, shifts, suppliers,
              ingredients, recipeItems, ingredientLogs, purchaseOrders, purchaseOrderItems,
              debts, debtPayments, leaveRequests, shiftHandovers, kitchenChecklists,
              warehouseInbounds, warehouseInboundItems, warehouseRequisitions, warehouseRequisitionItems,
              ownerFundTransactions, warehouseSales, warehouseSaleItems
            }
          };

          const jsonContent = JSON.stringify(snapshot, null, 2);
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="backup-poscafe-${timestamp}.json"`);
          return res.send(jsonContent);
        } catch (exportErr: any) {
          console.error('Gagal membuat fallback snapshot:', exportErr);
          return res.status(500).json({ error: 'Gagal membuat backup data PostgreSQL' });
        }
      });
    } else {
      // Fallback untuk SQLite lokal
      const dbPath = path.join(__dirname, '../../prisma/dev.db');
      if (fs.existsSync(dbPath)) {
        res.download(dbPath, `backup-poscafe-${timestamp}.db`, (err) => {
          if (err && !res.headersSent) {
            res.status(500).json({ error: 'Gagal mengunduh file SQLite' });
          }
        });
      } else {
        res.status(404).json({ error: 'Database aktif tidak ditemukan' });
      }
    }
  } catch (error: any) {
    console.error('Terjadi kesalahan sistem saat backup:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Terjadi kesalahan sistem saat backup' });
    }
  }
});

// POST /api/database/restart - Restart server backend (di bawah PM2)
router.post('/restart', authenticateToken, (req: Request, res: Response) => {
  try {
    res.status(200).json({ message: 'Server backend sedang merestart. Halaman akan dimuat ulang beberapa detik lagi...' });
    
    // Delay 1 detik agar respon HTTP sempat dikirim ke klien
    setTimeout(() => {
      console.log('[System] Restart dipicu oleh pengguna. Mematikan proses Node.js...');
      process.exit(0); // PM2 otomatis menghidupkan kembali proses jika exit code 0/1
    }, 1000);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal memicu restart server' });
  }
});

export default router;

