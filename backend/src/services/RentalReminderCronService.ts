import prisma from '../db';
import { WANotifService } from './WANotifService';

export interface RentalReminderAuditResult {
  checkedOrders: number;
  dueRemindersSent: number;
  overdueAlertsSent: number;
  pickupRemindersSent: number;
  errors: number;
  timestamp: string;
}

export class RentalReminderCronService {
  /**
   * Menjalankan siklus pemeriksaan dan pengiriman notifikasi pengingat rental WhatsApp
   * Dipanggil otomatis oleh scheduler latar belakang setiap periode tertentu.
   */
  public async runRentalReminderCycle(): Promise<RentalReminderAuditResult> {
    const now = new Date();
    const result: RentalReminderAuditResult = {
      checkedOrders: 0,
      dueRemindersSent: 0,
      overdueAlertsSent: 0,
      pickupRemindersSent: 0,
      errors: 0,
      timestamp: now.toISOString()
    };

    try {
      // ── 1. AMBIL SEMUA ORDER AKTIF (PICKED_UP & BOOKED) ───────────────────
      const activeRentalOrders = await prisma.rentalOrder.findMany({
        where: {
          status: { in: ['PICKED_UP', 'BOOKED', 'FITTING'] },
          customerPhone: { not: null }
        },
        include: {
          items: true,
          tenant: {
            select: {
              name: true,
              settings: {
                select: {
                  storeName: true,
                  address: true
                }
              }
            }
          }
        }
      });

      result.checkedOrders = activeRentalOrders.length;

      // Batas waktu hari ini dan besok
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
      const endOfTomorrow = new Date(endOfToday.getTime() + 24 * 60 * 60 * 1000);

      for (const order of activeRentalOrders) {
        if (!order.customerPhone) continue;

        const storeName = order.tenant?.settings?.[0]?.storeName || order.tenant?.name || 'Butik Sewa Busana';
        const storeAddress = order.tenant?.settings?.[0]?.address || undefined;
        const attireSummary = order.items.map(i => i.attireName).join(', ') || 'Set Busana Adat';

        // ── KELOMPOK A: ORDER PICKED_UP (BUSANA SEDANG DIBAWA PENYEWA) ─────
        if (order.status === 'PICKED_UP') {
          const deadline = new Date(order.returnDeadline);

          // KASUS 1: TERLAMBAT / OVERDUE (returnDeadline < now)
          if (deadline < now) {
            const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const alertTag = `[OVERDUE_ALERT:${todayDateStr}]`;

            // Debounce / Cooldown: Hanya kirim maksimal 1x per hari kalender agar tidak spamming kuota WA penyewa
            if (order.fittingNotes && order.fittingNotes.includes(alertTag)) {
              continue;
            }

            const diffMs = now.getTime() - deadline.getTime();
            const daysLate = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
            const estimatedLateFee = daysLate * 50000;

            try {
              const sent = await WANotifService.sendRentalOverdueAlert({
                tenantId: order.tenantId,
                customerName: order.customerName,
                customerPhone: order.customerPhone,
                orderNumber: order.orderNumber,
                attireSummary,
                returnDeadline: deadline,
                daysLate,
                estimatedLateFee,
                storeName
              });

              if (sent) {
                result.overdueAlertsSent++;
                const newNotes = order.fittingNotes ? `${order.fittingNotes}\n${alertTag}` : alertTag;
                await prisma.rentalOrder.update({
                  where: { id: order.id },
                  data: { fittingNotes: newNotes }
                });
                console.log(`[RentalCron] Sent overdue alert to ${order.customerName} (${order.orderNumber}), late ${daysLate} days`);
              }
            } catch (err: any) {
              result.errors++;
              console.error(`[RentalCron] Error sending overdue alert for ${order.orderNumber}:`, err.message);
            }
          } 
          // KASUS 2: JATUH TEMPO HARI INI (antara 00:00 s.d 23:59 hari ini)
          else if (deadline >= startOfToday && deadline <= endOfToday) {
            // Kirim reminder Hari-H jika belum dikirim atau notifReturnDueSent false
            if (!order.notifReturnDueSent) {
              try {
                const sent = await WANotifService.sendRentalDueReminder({
                  tenantId: order.tenantId,
                  customerName: order.customerName,
                  customerPhone: order.customerPhone,
                  orderNumber: order.orderNumber,
                  attireSummary,
                  returnDeadline: deadline,
                  storeName,
                  storeAddress,
                  isToday: true
                });

                if (sent) {
                  result.dueRemindersSent++;
                  await prisma.rentalOrder.update({
                    where: { id: order.id },
                    data: { notifReturnDueSent: true }
                  });
                  console.log(`[RentalCron] Sent due-today reminder to ${order.customerName} (${order.orderNumber})`);
                }
              } catch (err: any) {
                result.errors++;
                console.error(`[RentalCron] Error sending due-today reminder for ${order.orderNumber}:`, err.message);
              }
            }
          }
          // KASUS 3: JATUH TEMPO BESOK / H-1 (antara besok 00:00 s.d 23:59)
          else if (deadline >= startOfTomorrow && deadline <= endOfTomorrow) {
            if (!order.notifReturnDueSent) {
              try {
                const sent = await WANotifService.sendRentalDueReminder({
                  tenantId: order.tenantId,
                  customerName: order.customerName,
                  customerPhone: order.customerPhone,
                  orderNumber: order.orderNumber,
                  attireSummary,
                  returnDeadline: deadline,
                  storeName,
                  storeAddress,
                  isToday: false
                });

                if (sent) {
                  result.dueRemindersSent++;
                  await prisma.rentalOrder.update({
                    where: { id: order.id },
                    data: { notifReturnDueSent: true }
                  });
                  console.log(`[RentalCron] Sent H-1 reminder to ${order.customerName} (${order.orderNumber})`);
                }
              } catch (err: any) {
                result.errors++;
                console.error(`[RentalCron] Error sending H-1 reminder for ${order.orderNumber}:`, err.message);
              }
            }
          }
        }

        // ── KELOMPOK B: ORDER BOOKED / FITTING (PENGAMBILAN BESOK H-1) ──────
        else if (order.status === 'BOOKED' || order.status === 'FITTING') {
          const pickupDate = new Date(order.pickupDate);
          if (pickupDate >= startOfTomorrow && pickupDate <= endOfTomorrow && !order.notifPickupSent) {
            try {
              const pickupDateStr = pickupDate.toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
              });

              const msg = `Halo Kak *${order.customerName}*,\n` +
                `Pengingat ramah dari *${storeName}*:\n` +
                `Busana sewa pesanan Anda (*#${order.orderNumber}* - ${attireSummary}) dijadwalkan dapat *DIAMBIL BESOK* (${pickupDateStr}). ✨\n\n` +
                `Silakan bawa identitas jaminan (KTP/SIM asli) dan sisa pelunasan saat pengambilan.\n\n` +
                (storeAddress ? `📍 Alamat Butik: ${storeAddress}\n\n` : '') +
                `Terima kasih! Kami tunggu kedatangannya. 🙏`;

              const sent = await WANotifService.sendCustomNotification({
                tenantId: order.tenantId,
                customerPhone: order.customerPhone,
                message: msg,
                triggerKey: 'RENTAL_PICKUP_REMINDER',
                referenceId: order.orderNumber
              });

              if (sent) {
                result.pickupRemindersSent++;
                await prisma.rentalOrder.update({
                  where: { id: order.id },
                  data: { notifPickupSent: true }
                });
                console.log(`[RentalCron] Sent pickup reminder to ${order.customerName} (${order.orderNumber})`);
              }
            } catch (err: any) {
              result.errors++;
              console.error(`[RentalCron] Error sending pickup reminder for ${order.orderNumber}:`, err.message);
            }
          }
        }
      }

      console.log(`[RentalCron Summary] ${JSON.stringify(result)}`);
      return result;
    } catch (globalError: any) {
      console.error('[RentalCron] Global cycle error:', globalError);
      result.errors++;
      return result;
    }
  }
}

export const rentalReminderCronService = new RentalReminderCronService();
export default rentalReminderCronService;
