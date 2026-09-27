import { queueManager } from './queueManager';

export const REPORT_QUEUE_NAME = 'report-queue';

export interface ReportJobData {
  tenantId: string;
  reportType: 'SALES_SUMMARY' | 'PROFIT_LOSS' | 'INVENTORY_AUDIT' | 'WASTE_ANALYSIS';
  format: 'PDF' | 'JSON' | 'CSV';
  startDate?: string;
  endDate?: string;
  outletId?: string;
  requestedByUserId?: number | string;
}

/**
 * Enqueue a heavy report or PDF export to BullMQ background queue.
 */
export async function enqueueReportGeneration(
  data: ReportJobData
): Promise<{ id: string; status: string }> {
  const jobId = `report_${data.tenantId}_${data.reportType.toLowerCase()}_${Date.now()}`;

  return await queueManager.addJob(
    REPORT_QUEUE_NAME,
    'generate-report',
    data,
    {
      jobId,
      attempts: 2,
      removeOnComplete: 100,
      removeOnFail: 200
    }
  );
}
