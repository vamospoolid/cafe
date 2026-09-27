import { Queue, Worker, Job, JobsOptions, WorkerOptions } from 'bullmq';
import Redis from 'ioredis';
import { isRedisReady, getBullMQConnectionOptions, getRedisUrl } from '../lib/redis';

export type JobProcessor<T = any, R = any> = (job: { id?: string; name: string; data: T }) => Promise<R>;

interface RegisteredWorkerEntry {
  queueName: string;
  processor: JobProcessor;
  worker?: Worker;
}

class QueueManager {
  private static instance: QueueManager;
  private queues = new Map<string, Queue>();
  private workers = new Map<string, RegisteredWorkerEntry>();
  private isShuttingDown = false;

  public static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  /**
   * Get or create a BullMQ Queue instance
   */
  public getOrCreateQueue(queueName: string): Queue | null {
    if (this.queues.has(queueName)) {
      return this.queues.get(queueName)!;
    }

    if (!isRedisReady()) {
      return null;
    }

    try {
      const connection = new Redis(getRedisUrl(), getBullMQConnectionOptions());
      const queue = new Queue(queueName, { connection });
      this.queues.set(queueName, queue);
      console.log(`[BullMQ] Queue [${queueName}] aktif di Redis.`);
      return queue;
    } catch (err: any) {
      console.warn(`[BullMQ Warn] Gagal membuat queue [${queueName}]:`, err.message);
      return null;
    }
  }

  /**
   * Register a worker processor for a specific queue.
   * If Redis is ready, creates a BullMQ Worker.
   * If Redis is offline, stores the processor for in-memory execution fallback.
   */
  public registerWorker(queueName: string, processor: JobProcessor, options: Partial<WorkerOptions> = {}): void {
    const entry: RegisteredWorkerEntry = {
      queueName,
      processor
    };

    if (isRedisReady()) {
      try {
        const connection = new Redis(getRedisUrl(), getBullMQConnectionOptions());
        const worker = new Worker(
          queueName,
          async (job: Job) => {
            return await processor({
              id: job.id,
              name: job.name,
              data: job.data
            });
          },
          {
            connection,
            concurrency: options.concurrency || 5,
            limiter: options.limiter,
            ...options
          }
        );

        worker.on('completed', (job: Job) => {
          console.log(`[BullMQ Worker:${queueName}] Job ${job.id} (${job.name}) selesai.`);
        });

        worker.on('failed', (job: Job | undefined, err: Error) => {
          console.error(`[BullMQ Worker:${queueName}] Job ${job?.id} (${job?.name}) gagal:`, err.message);
        });

        entry.worker = worker;
        console.log(`[BullMQ] Worker [${queueName}] aktif (Concurrency: ${options.concurrency || 5}).`);
      } catch (err: any) {
        console.warn(`[BullMQ Warn] Worker [${queueName}] fallback ke in-memory runner:`, err.message);
      }
    } else {
      console.log(`[BullMQ] Worker [${queueName}] terdaftar pada mode In-Memory Fallback.`);
    }

    this.workers.set(queueName, entry);
  }

  /**
   * Add a job to queue with Graceful In-Memory Fallback.
   * If Redis is ready, pushes to BullMQ Queue.
   * If Redis is offline, dispatches to processor asynchronously via setImmediate.
   */
  public async addJob<T = any>(
    queueName: string,
    jobName: string,
    data: T,
    options: JobsOptions = {}
  ): Promise<{ id: string; status: 'QUEUED' | 'IN_MEMORY_DISPATCHED' }> {
    const queue = this.getOrCreateQueue(queueName);

    if (queue && isRedisReady()) {
      try {
        const job = await queue.add(jobName, data, options);
        return {
          id: String(job.id),
          status: 'QUEUED'
        };
      } catch (err: any) {
        console.warn(`[BullMQ Add Error on ${queueName}]: ${err.message}, fallback ke In-Memory.`);
      }
    }

    // In-Memory Fallback Execution
    const generatedId = options.jobId ? String(options.jobId) : `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const workerEntry = this.workers.get(queueName);

    if (workerEntry && workerEntry.processor) {
      setImmediate(async () => {
        try {
          await workerEntry.processor({
            id: generatedId,
            name: jobName,
            data
          });
        } catch (err: any) {
          console.error(`[In-Memory Worker Error on ${queueName}]:`, err.message);
        }
      });
    } else {
      console.warn(`[QueueManager Warn] Tidak ada worker terdaftar untuk queue [${queueName}].`);
    }

    return {
      id: generatedId,
      status: 'IN_MEMORY_DISPATCHED'
    };
  }

  /**
   * Get queue health and counts for telemetry
   */
  public async getQueueStats(queueName: string): Promise<{ waiting: number; active: number; failed: number; mode: string }> {
    const queue = this.queues.get(queueName);
    if (queue && isRedisReady()) {
      try {
        const [waiting, active, failed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getFailedCount()
        ]);
        return { waiting, active, failed, mode: 'Redis (BullMQ)' };
      } catch (_e) {}
    }

    return { waiting: 0, active: 0, failed: 0, mode: 'In-Memory Fallback' };
  }

  /**
   * Graceful close of all queues and workers on server shutdown
   */
  public async closeAll(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log('[BullMQ] Menutup seluruh Queue & Worker dengan aman...');
    for (const [name, entry] of this.workers.entries()) {
      if (entry.worker) {
        try {
          await entry.worker.close();
          console.log(`[BullMQ] Worker [${name}] ditutup.`);
        } catch (_e) {}
      }
    }

    for (const [name, queue] of this.queues.entries()) {
      try {
        await queue.close();
        console.log(`[BullMQ] Queue [${name}] ditutup.`);
      } catch (_e) {}
    }

    this.workers.clear();
    this.queues.clear();
  }
}

export const queueManager = QueueManager.getInstance();
