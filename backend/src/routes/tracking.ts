import { Router, Request, Response } from 'express';
import prisma from '../db';

const router = Router();

/**
 * GET /api/tracking/public/:code
 * Endpoint publik (tanpa login kasir) untuk melacak status pesanan Kafe atau Laundry
 * Menerapkan prinsip Zero-IDOR & Data Sanitization ketat.
 */
router.get('/public/:code', async (req: Request, res: Response) => {
  try {
    const rawCode = String(req.params.code || '').trim().toUpperCase();
    if (!rawCode || rawCode.length < 5) {
      return res.status(400).json({ error: 'Kode pelacakan tidak valid' });
    }

    // 1. Cek di Order Kafe / F&B
    const cafeOrder = await prisma.order.findFirst({
      where: { trackingCode: rawCode },
      include: {
        tenant: {
          select: {
            name: true,
            logoUrl: true,
            phone: true,
            slug: true
          }
        },
        items: {
          include: {
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

    if (cafeOrder) {
      // Sanitasi Data Kafe: Tidak membocorkan HPP, gross margin, supplier, dsb.
      return res.json({
        success: true,
        vertical: 'CAFE',
        trackingCode: cafeOrder.trackingCode,
        orderNumber: cafeOrder.orderNumber,
        customerName: cafeOrder.customerName,
        orderType: cafeOrder.orderType,
        deliveryStatus: cafeOrder.deliveryStatus,
        kdsStatus: cafeOrder.kdsStatus,
        deliveryAddress: cafeOrder.deliveryAddress,
        deliveryNotes: cafeOrder.deliveryNotes,
        deliveryFee: cafeOrder.deliveryFee,
        courierType: cafeOrder.courierType,
        courierName: cafeOrder.courierName,
        courierPhone: cafeOrder.courierPhone,
        deliveredAt: cafeOrder.deliveredAt,
        status: cafeOrder.status, // "Pending", "Paid", "Void"
        paymentMethod: cafeOrder.paymentMethod,
        paidAt: cafeOrder.paidAt,
        subtotal: cafeOrder.subtotal,
        discount: cafeOrder.discount,
        tax: cafeOrder.tax,
        serviceCharge: cafeOrder.serviceCharge,
        total: cafeOrder.total,
        createdAt: cafeOrder.createdAt,
        tenant: cafeOrder.tenant,
        items: cafeOrder.items.map(it => ({
          name: it.product?.name || 'Menu Item',
          imageUrl: it.product?.imageUrl || null,
          qty: it.qty,
          price: it.price,
          subtotal: it.subtotal,
          notes: it.notes
        }))
      });
    }

    // 2. Cek di Laundry Order
    const laundryOrder = await prisma.laundryOrder.findFirst({
      where: { trackingCode: rawCode },
      include: {
        tenant: {
          select: {
            name: true,
            logoUrl: true,
            phone: true,
            slug: true
          }
        },
        items: true
      }
    });

    if (laundryOrder) {
      // Sanitasi Data Laundry: Istilah laundry murni tanpa istilah meja/makanan
      return res.json({
        success: true,
        vertical: 'LAUNDRY',
        trackingCode: laundryOrder.trackingCode,
        orderNumber: laundryOrder.orderNumber,
        customerName: laundryOrder.customerName,
        serviceCategory: laundryOrder.serviceCategory,
        serviceSpeed: laundryOrder.serviceSpeed,
        perfumeVariant: laundryOrder.perfumeVariant,
        rackLocation: laundryOrder.rackLocation,
        deliveryType: laundryOrder.deliveryType,
        pickupStatus: laundryOrder.pickupStatus,
        deliveryStatus: laundryOrder.deliveryStatus,
        pickupAddress: laundryOrder.pickupAddress,
        pickupTimeSlot: laundryOrder.pickupTimeSlot,
        deliveryAddress: laundryOrder.deliveryAddress,
        deliveryNotes: laundryOrder.deliveryNotes,
        courierName: laundryOrder.courierName,
        courierPhone: laundryOrder.courierPhone,
        pickupFee: laundryOrder.pickupFee || 0,
        deliveryFee: laundryOrder.deliveryFee || 0,
        status: laundryOrder.status, // "RECEIVED", "WASHING", "DRYING", "IRONING", "READY", "COMPLETED"
        paymentStatus: laundryOrder.paymentStatus, // "UNPAID", "PARTIAL", "PAID"
        paymentMethod: laundryOrder.paymentMethod,
        paymentVerificationStatus: laundryOrder.paymentVerificationStatus || 'NONE',
        paymentProofImage: laundryOrder.paymentProofImage || null,
        qrisUniqueCode: laundryOrder.qrisUniqueCode || 0,
        qrisUniqueAmount: laundryOrder.qrisUniqueAmount || 0,
        quotaKgUsed: laundryOrder.quotaKgUsed || 0,
        depositUsed: laundryOrder.depositUsed || 0,
        intakePhotos: laundryOrder.intakePhotos || null,
        subtotal: laundryOrder.subtotal,
        speedSurcharge: laundryOrder.speedSurcharge,
        discount: laundryOrder.discount,
        totalAmount: laundryOrder.totalAmount,
        paidAmount: laundryOrder.paidAmount,
        estimatedDoneAt: laundryOrder.estimatedDoneAt,
        readyAt: laundryOrder.readyAt,
        completedAt: laundryOrder.completedAt,
        createdAt: laundryOrder.createdAt,
        tenant: laundryOrder.tenant,
        items: laundryOrder.items.map(it => ({
          serviceName: it.serviceName,
          unitType: it.unitType,
          qty: it.qty,
          pricePerUnit: it.pricePerUnit,
          subtotal: it.subtotal,
          notes: it.notes
        }))
      });
    }

    // 3. Jika tidak ditemukan di kedua vertikal
    return res.status(404).json({
      error: 'Pesanan tidak ditemukan. Periksa kembali kode pelacakan Anda.'
    });
  } catch (err: any) {
    console.error('[Tracking API /public/:code Error]', err);
    return res.status(500).json({ error: 'Gagal memuat status pelacakan pesanan' });
  }
});

export default router;
