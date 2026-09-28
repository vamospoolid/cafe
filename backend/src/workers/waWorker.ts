import { emitToTenant } from '../index';
import { AuditLogger } from '../services/AuditLogger';
import { queueManager } from '../queues/queueManager';
import { WA_QUEUE_NAME, WhatsAppJobData } from '../queues/waQueue';

/**
 * Worker processor for WhatsApp messages.
 * Sends message through gateway with rate-limiting and logs delivery outcome.
 */
export async function processWhatsAppJob(job: { id?: string; name: string; data: WhatsAppJobData }) {
  const { tenantId, phone, content, messageType, recipientName, metadata } = job.data;

  console.log(`[WAWorker] Mengirim ${messageType} ke ${phone} (Tenant: ${tenantId})...`);

  // Gateway dispatch logic
  // If an external WA gateway URL / token is configured in process.env, it can make HTTP call here.
  // Default resilient provider simulator / webhook logger:
  const gatewayUrl = process.env.WA_GATEWAY_URL;
  const gatewayApiKey = process.env.WA_API_KEY;

  let deliverySuccess = true;
  let deliveryResponse: any = { status: 'DELIVERED', timestamp: new Date().toISOString() };

  if (gatewayUrl && gatewayApiKey) {
    try {
      // Real HTTP gateway call
      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': gatewayApiKey
        },
        body: JSON.stringify({
          target: phone,
          message: content
        })
      });

      if (!response.ok) {
        throw new Error(`Gateway returned HTTP ${response.status}`);
      }
      deliveryResponse = await response.json();
    } catch (err: any) {
      deliverySuccess = false;
      console.error(`[WAWorker Error] Gagal mengirim pesan ke ${phone}:`, err.message);

      await AuditLogger.log({
        tenantId,
        action: 'WHATSAPP_DELIVERY_FAILED',
        resource: 'NOTIFICATION',
        severity: 'WARNING',
        description: `Gagal mengirim WhatsApp ${messageType} ke ${phone}: ${err.message}`,
        newValue: { phone, messageType, error: err.message }
      });

      emitToTenant(tenantId, 'wa:delivery_failed', {
        jobId: job.id,
        phone,
        messageType,
        error: err.message
      });

      throw err; // Trigger BullMQ retry backoff
    }
  } else {
    // Development / Simulator Mode: logs receipt delivery
    console.log(`[WAWorker Mock] Sukses simulasi kirim WA ke ${phone}: "${content.slice(0, 60)}..."`);
  }

  // Emit real-time delivery success to tenant cashier
  emitToTenant(tenantId, 'wa:delivery_success', {
    jobId: job.id,
    phone,
    recipientName,
    messageType,
    orderNumber: metadata?.orderNumber
  });

  return { success: true, phone, response: deliveryResponse };
}

/**
 * Register WhatsApp worker with anti-ban rate limiting (1 msg / 1500ms)
 */
export function registerWhatsAppWorker(): void {
  queueManager.registerWorker(WA_QUEUE_NAME, processWhatsAppJob, {
    concurrency: 1, // Single concurrency per worker instance to preserve message ordering
    limiter: {
      max: 1,
      duration: 1500 // Anti-ban rate limit: max 1 message per 1.5s
    }
  });
}
