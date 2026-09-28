import { queueManager } from './queueManager';

export const WA_QUEUE_NAME = 'wa-queue';

export interface WhatsAppJobData {
  tenantId: string;
  phone: string;
  messageType: 'RECEIPT' | 'SHIFT_ZREPORT' | 'ALERT' | 'SYSTEM';
  recipientName?: string;
  content: string;
  metadata?: any;
}

/**
 * Enqueue WhatsApp E-Receipt or notification for asynchronous delivery.
 * Rate-limited to prevent carrier or gateway bans.
 */
export async function enqueueWhatsAppMessage(
  tenantId: string,
  phone: string,
  content: string,
  messageType: 'RECEIPT' | 'SHIFT_ZREPORT' | 'ALERT' | 'SYSTEM' = 'RECEIPT',
  recipientName?: string,
  metadata?: any
): Promise<{ id: string; status: string }> {
  // Normalize Indonesian phone number (08xx -> 628xx)
  let cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.slice(1);
  } else if (!cleanPhone.startsWith('62') && cleanPhone.length > 8) {
    cleanPhone = '62' + cleanPhone;
  }

  const jobData: WhatsAppJobData = {
    tenantId,
    phone: cleanPhone,
    messageType,
    recipientName,
    content,
    metadata
  };

  const jobId = `wa_${tenantId}_${cleanPhone}_${Date.now()}`;

  return await queueManager.addJob(
    WA_QUEUE_NAME,
    'send-whatsapp-message',
    jobData,
    {
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000 // 5s, 10s, 20s
      },
      removeOnComplete: 200,
      removeOnFail: 500
    }
  );
}
