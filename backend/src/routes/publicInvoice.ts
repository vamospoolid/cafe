import { Router, Request, Response } from 'express';
import prisma from '../db';

const router = Router();

/**
 * GET /api/public/invoice/order/:orderNumber
 * Mengambil detail nota publik POS (Kafe, Resto, Retail, Laundry)
 */
router.get('/order/:orderNumber', async (req: Request, res: Response) => {
  try {
    const orderNumber = String(req.params.orderNumber || '').trim();
    if (!orderNumber) {
      return res.status(400).json({ error: 'Nomor nota tidak valid' });
    }

    // 1. Cari di tabel Order (Kafe, Resto, Retail)
    const order = await prisma.order.findFirst({
      where: { orderNumber },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            businessType: true,
            phone: true,
            logoUrl: true,
            settings: {
              select: {
                storeName: true,
                address: true,
                phone: true,
                logoUrl: true,
                receiptFooter: true
              }
            }
          }
        },
        table: {
          select: {
            tableNo: true,
            name: true
          }
        },
        customer: {
          select: {
            name: true,
            phone: true
          }
        },
        items: {
          select: {
            id: true,
            qty: true,
            price: true,
            subtotal: true,
            notes: true,
            product: {
              select: {
                name: true,
                imageUrl: true
              }
            }
          }
        }
      }
    });

    if (order) {
      const storeSettings = (order.tenant as any)?.settings?.[0] || (order.tenant as any)?.settings || {};
      return res.json({
        success: true,
        type: 'ORDER',
        data: {
          orderNumber: order.orderNumber,
          createdAt: order.createdAt,
          paidAt: order.paidAt || order.createdAt,
          status: order.status,
          customerName: order.customerName || order.customer?.name || 'Pelanggan Umum',
          customerPhone: order.customerPhone || order.customer?.phone || null,
          tableName: order.table?.name || (order.table?.tableNo ? `Meja ${order.table.tableNo}` : null),
          paymentMethod: order.paymentMethod || 'Tunai',
          subtotal: order.subtotal,
          discount: order.discount,
          tax: order.tax,
          serviceCharge: order.serviceCharge,
          total: order.total,
          items: order.items.map(it => ({
            id: it.id,
            name: it.product?.name || 'Item',
            qty: it.qty,
            price: it.price,
            subtotal: it.subtotal,
            notes: it.notes,
            imageUrl: it.product?.imageUrl || null
          })),
          store: {
            name: storeSettings.storeName || order.tenant?.name || 'CodePOS Store',
            address: storeSettings.address || null,
            phone: storeSettings.phone || order.tenant?.phone || null,
            logoUrl: storeSettings.logoUrl || order.tenant?.logoUrl || null,
            receiptFooter: storeSettings.receiptFooter || 'Terima kasih atas kunjungan Anda!',
            businessType: order.tenant?.businessType || 'CAFE'
          }
        }
      });
    }

    // 2. Jika tidak ada di Order, cari di LaundryOrder
    const laundry = await prisma.laundryOrder.findFirst({
      where: { orderNumber },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            businessType: true,
            phone: true,
            logoUrl: true,
            settings: {
              select: {
                storeName: true,
                address: true,
                phone: true,
                logoUrl: true,
                receiptFooter: true
              }
            }
          }
        },
        customer: {
          select: {
            name: true,
            phone: true
          }
        },
        items: true
      }
    });

    if (laundry) {
      const storeSettings = (laundry.tenant as any)?.settings?.[0] || (laundry.tenant as any)?.settings || {};
      return res.json({
        success: true,
        type: 'LAUNDRY',
        data: {
          orderNumber: laundry.orderNumber,
          createdAt: laundry.createdAt,
          paidAt: laundry.completedAt || (laundry.paymentStatus === 'PAID' ? laundry.updatedAt : null),
          status: laundry.status,
          paymentStatus: laundry.paymentStatus,
          customerName: laundry.customerName || laundry.customer?.name || 'Pelanggan Laundry',
          customerPhone: laundry.customerPhone || laundry.customer?.phone || null,
          rackNumber: laundry.rackLocation || null,
          perfume: laundry.perfumeVariant || null,
          speedTier: laundry.serviceSpeed,
          paymentMethod: laundry.paymentMethod || 'Tunai',
          subtotal: laundry.subtotal,
          discount: laundry.discount,
          tax: 0,
          total: laundry.totalAmount,
          items: laundry.items.map((it: any) => ({
            id: it.id,
            name: it.serviceName || it.name || 'Layanan Laundry',
            qty: it.qty || it.weight || 1,
            unit: it.unit || 'Kg',
            price: it.price || 0,
            subtotal: it.subtotal || 0,
            notes: it.notes
          })),
          store: {
            name: storeSettings.storeName || laundry.tenant?.name || 'CodePOS Laundry',
            address: storeSettings.address || null,
            phone: storeSettings.phone || laundry.tenant?.phone || null,
            logoUrl: storeSettings.logoUrl || laundry.tenant?.logoUrl || null,
            receiptFooter: storeSettings.receiptFooter || 'Terima kasih telah mencuci bersama kami!',
            businessType: 'LAUNDRY'
          }
        }
      });
    }

    return res.status(404).json({ error: 'Struk atau nomor nota tidak ditemukan' });
  } catch (error: any) {
    console.error('[Public Order Invoice Error]:', error);
    return res.status(500).json({ error: 'Gagal memuat struk digital' });
  }
});

/**
 * GET /api/public/invoice/spk/:spkNumber
 * Mengambil detail nota / SPK publik Bengkel Motor & Mobil
 */
router.get('/spk/:spkNumber', async (req: Request, res: Response) => {
  try {
    const spkNumber = String(req.params.spkNumber || '').trim();
    if (!spkNumber) {
      return res.status(400).json({ error: 'Nomor SPK tidak valid' });
    }

    const wo = await prisma.workOrder.findFirst({
      where: { spkNumber },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            businessType: true,
            phone: true,
            logoUrl: true,
            settings: {
              select: {
                storeName: true,
                address: true,
                phone: true,
                logoUrl: true,
                receiptFooter: true
              }
            }
          }
        },
        customer: {
          select: {
            name: true,
            phone: true
          }
        },
        services: true,
        parts: true
      }
    });

    if (!wo) {
      return res.status(404).json({ error: 'SPK Bengkel tidak ditemukan' });
    }

    const storeSettings = (wo.tenant as any)?.settings?.[0] || (wo.tenant as any)?.settings || {};

    return res.json({
      success: true,
      type: 'BENGKEL_SPK',
      data: {
        spkNumber: wo.spkNumber,
        createdAt: wo.createdAt,
        completedAt: wo.completedAt,
        status: wo.status,
        customerName: wo.customer?.name || 'Pelanggan Bengkel',
        customerPhone: wo.customer?.phone || null,
        vehiclePlate: wo.vehiclePlate || '-',
        vehicleBrand: wo.vehicleBrand || null,
        vehicleModel: wo.vehicleModel || null,
        vehicleType: wo.vehicleType,
        odometer: wo.odometer,
        complaint: wo.complaint,
        diagnosis: wo.diagnosis,
        mechanicName: wo.mechanicName || 'Tim Mekanik',
        totalServices: wo.totalServices,
        totalParts: wo.totalParts,
        discount: wo.discount,
        tax: wo.taxAmount,
        total: wo.totalAmount,
        paidAmount: wo.paidAmount,
        services: wo.services.map((s: any) => ({
          id: s.id,
          name: s.serviceName,
          price: s.price,
          qty: s.qty,
          subtotal: s.subtotal,
          mechanicName: s.mechanicName
        })),
        parts: wo.parts.map((p: any) => ({
          id: p.id,
          name: p.partName,
          partNumber: p.partNumber,
          price: p.price,
          qty: p.qty,
          subtotal: p.subtotal
        })),
        store: {
          name: storeSettings.storeName || wo.tenant?.name || 'CodePOS Bengkel',
          address: storeSettings.address || null,
          phone: storeSettings.phone || wo.tenant?.phone || null,
          logoUrl: storeSettings.logoUrl || wo.tenant?.logoUrl || null,
          receiptFooter: storeSettings.receiptFooter || 'Terima kasih atas kepercayaan servis di bengkel kami!',
          businessType: 'BENGKEL'
        }
      }
    });
  } catch (error: any) {
    console.error('[Public SPK Invoice Error]:', error);
    return res.status(500).json({ error: 'Gagal memuat SPK bengkel' });
  }
});

export default router;
