import { queueManager } from './queueManager';

export const SYNC_QUEUE_NAME = 'sync-queue';

export interface OfflineOrderJobData {
  tenantId: string;
  outletId?: string;
  userId: number | string;
  order: any;
  batchId: string;
  orderIndex: number;
  totalInBatch: number;
}

/**
 * Enqueue a batch of offline orders to BullMQ background queue.
 * Returns batch tracking details.
 */
export async function enqueueOfflineOrdersBatch(
  tenantId: string,
  outletId: string | undefined,
  userId: number | string,
  orders: any[]
): Promise<{ batchId: string; totalEnqueued: number; jobs: { id: string; status: string }[] }> {
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const totalInBatch = orders.length;
  const jobs: { id: string; status: string }[] = [];

  for (let i = 0; i < orders.length; i++) {
    const ord = orders[i];
    const jobId = ord.offlineId ? `${tenantId}_${ord.offlineId}` : `${tenantId}_${batchId}_${i}`;

    const jobData: OfflineOrderJobData = {
      tenantId,
      outletId: ord.outletId || outletId,
      userId,
      order: ord,
      batchId,
      orderIndex: i,
      totalInBatch
    };

    const queuedJob = await queueManager.addJob(
      SYNC_QUEUE_NAME,
      'process-offline-order',
      jobData,
      {
        jobId, // Automatic deduplication via BullMQ
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 100,
        removeOnFail: 500
      }
    );

    jobs.push(queuedJob);
  }

  return {
    batchId,
    totalEnqueued: jobs.length,
    jobs
  };
}
