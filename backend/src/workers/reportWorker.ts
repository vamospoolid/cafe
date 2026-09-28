import fs from 'fs';
import path from 'path';
import prisma from '../db';
import { emitToTenant } from '../index';
import { queueManager } from '../queues/queueManager';
import { REPORT_QUEUE_NAME, ReportJobData } from '../queues/reportQueue';

/**
 * Worker processor for heavy report generation.
 * Pulls large dataset from DB in background and emits Socket.IO download link.
 */
export async function processReportJob(job: { id?: string; name: string; data: ReportJobData }) {
  const { tenantId, reportType, format, startDate, endDate, outletId } = job.data;
  const jobId = job.id || `rep_${Date.now()}`;

  console.log(`[ReportWorker] Memproses ${reportType} (${format}) untuk Tenant: ${tenantId}...`);

  // Ensure output directory exists: /uploads/reports/temp/:tenantId/
  const tempDir = path.resolve(process.cwd(), 'uploads', 'reports', 'temp', tenantId);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const dateFilter: any = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  let reportPayload: any = {};

  if (reportType === 'SALES_SUMMARY') {
    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        ...(outletId ? { outletId } : {}),
        status: 'Paid',
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {})
      },
      include: {
        items: { include: { product: true } },
        user: { select: { name: true, username: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const totalTransactions = orders.length;

    reportPayload = {
      title: 'Laporan Penjualan Ringkas',
      reportType,
      tenantId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalRevenue,
        totalTransactions,
        averageTicket: totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0
      },
      ordersCount: orders.length
    };
  } else {
    // Generic / other reports
    reportPayload = {
      title: `Laporan ${reportType}`,
      reportType,
      tenantId,
      generatedAt: new Date().toISOString(),
      status: 'COMPLETED'
    };
  }

  // Save report artifact to disk
  const filename = `${reportType.toLowerCase()}_${jobId}.${format.toLowerCase()}`;
  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(reportPayload, null, 2), 'utf-8');

  const downloadUrl = `/api/analytics/download-report/${tenantId}/${filename}`;

  // Emit Socket.IO event to tenant room
  emitToTenant(tenantId, 'report:ready', {
    jobId,
    reportType,
    format,
    filename,
    downloadUrl,
    generatedAt: new Date().toISOString()
  });

  console.log(`[ReportWorker] Laporan ${reportType} selesai dibuat: ${filePath}`);

  return { success: true, filename, downloadUrl };
}

/**
 * Register ReportWorker with QueueManager
 */
export function registerReportWorker(): void {
  queueManager.registerWorker(REPORT_QUEUE_NAME, processReportJob, {
    concurrency: 2 // Max 2 heavy reports concurrently to protect server CPU
  });
}
