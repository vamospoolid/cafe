import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  WASocket,
  ConnectionState
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import prisma from '../db';

export interface SendMessageOptions {
  triggerKey?: string;
  recipientName?: string;
  referenceId?: string;
}

export class WhatsAppManager {
  private static instance: WhatsAppManager;
  private sessions = new Map<string, WASocket>();
  private reconnectingTenants = new Set<string>();
  private messageQueues = new Map<string, Array<() => Promise<void>>>();
  private isProcessingQueue = new Map<string, boolean>();

  private sessionsBaseDir = path.resolve(__dirname, '../../storage/whatsapp_sessions');

  private constructor() {
    // Pastikan direktori dasar penyimpanan sesi WhatsApp ada
    if (!fs.existsSync(this.sessionsBaseDir)) {
      fs.mkdirSync(this.sessionsBaseDir, { recursive: true });
    }
  }

  public static getInstance(): WhatsAppManager {
    if (!WhatsAppManager.instance) {
      WhatsAppManager.instance = new WhatsAppManager();
    }
    return WhatsAppManager.instance;
  }

  /**
   * Helper mendapatkan folder auth keys per tenant
   */
  private getTenantSessionDir(tenantId: string): string {
    const dir = path.join(this.sessionsBaseDir, tenantId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Normalisasi nomor telepon ke format JID WhatsApp (@s.whatsapp.net)
   * Contoh: 08123456789 -> 628123456789
   */
  public normalizePhone(phone: string): string {
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    } else if (clean.startsWith('8')) {
      clean = '62' + clean;
    }
    return clean;
  }

  /**
   * Ambil status konfigurasi dan koneksi tenant dari database & memory
   */
  public async getTenantStatus(tenantId: string) {
    let config = await prisma.tenantWhatsAppConfig.findUnique({
      where: { tenantId }
    });

    if (!config) {
      config = await prisma.tenantWhatsAppConfig.create({
        data: {
          tenantId,
          status: 'DISCONNECTED',
          monthlyQuota: 1000,
          usedThisMonth: 0,
          isAddonActive: true
        }
      });
    }

    const sock = this.sessions.get(tenantId);
    const isSocketReady = Boolean(sock && sock.user && (sock.user as any).id);

    // KOREKSI STATUS KRUSIAL:
    // Hanya boleh berstatus 'CONNECTED' jika socket di memory benar-benar mempunyai user ID (sudah pairing)
    if (isSocketReady) {
      const userJid = (sock!.user as any)?.id || '';
      const phone = userJid.split(':')[0] || userJid.split('@')[0];
      if (config.status !== 'CONNECTED' || config.phoneConnected !== phone) {
        config = await prisma.tenantWhatsAppConfig.update({
          where: { tenantId },
          data: { 
            status: 'CONNECTED',
            phoneConnected: phone || config.phoneConnected,
            qrCode: null
          }
        });
      }
    } else {
      // Jika socket tidak ready di memory:
      const sessionDir = this.getTenantSessionDir(tenantId);
      const credsFile = path.join(sessionDir, 'creds.json');
      const hasSavedCreds = fs.existsSync(credsFile);

      // Jika di DB tercatat CONNECTED tapi tidak ada creds di disk, reset ke DISCONNECTED
      if (config.status === 'CONNECTED' && !hasSavedCreds) {
        config = await prisma.tenantWhatsAppConfig.update({
          where: { tenantId },
          data: {
            status: 'DISCONNECTED',
            phoneConnected: null,
            qrCode: null
          }
        });
      }
    }

    return {
      status: config.status,
      phoneConnected: config.phoneConnected,
      qrCode: config.status === 'SCAN_QR' ? config.qrCode : null,
      monthlyQuota: config.monthlyQuota,
      usedThisMonth: config.usedThisMonth,
      autoSendReceipt: config.autoSendReceipt,
      autoSendReminder: config.autoSendReminder,
      updatedAt: config.updatedAt
    };
  }

  /**
   * Inisialisasi atau request koneksi Baileys baru untuk tenant tertentu.
   * Menghasilkan QR Code yang dapat di-scan di Back-Office.
   */
  public async initSession(tenantId: string, forceNew = false): Promise<string | null> {
    if (this.sessions.has(tenantId) && !forceNew) {
      return null;
    }

    if (this.sessions.has(tenantId)) {
      try {
        const existingSocket = this.sessions.get(tenantId);
        existingSocket?.end(undefined);
      } catch (e) {
        console.error(`[WhatsAppManager] Error closing socket for tenant ${tenantId}:`, e);
      }
      this.sessions.delete(tenantId);
    }

    const sessionDir = this.getTenantSessionDir(tenantId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const logger = pino({ level: 'warn' });

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      browser: ['CodePOS SaaS', 'Chrome', '124.0.0.0']
    });

    this.sessions.set(tenantId, sock);

    sock.ev.on('creds.update', saveCreds);

    return new Promise<string | null>((resolve) => {
      let isResolved = false;

      const timer = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          resolve(null);
        }
      }, 15000);

      sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrDataUrl = await QRCode.toDataURL(qr);
            await prisma.tenantWhatsAppConfig.upsert({
              where: { tenantId },
              update: {
                status: 'SCAN_QR',
                qrCode: qrDataUrl
              },
              create: {
                tenantId,
                status: 'SCAN_QR',
                qrCode: qrDataUrl,
                isAddonActive: true
              }
            });

            if (!isResolved) {
              isResolved = true;
              clearTimeout(timer);
              resolve(qrDataUrl);
            }
          } catch (qrErr) {
            console.error(`[WhatsAppManager] Failed to generate QR DataURL:`, qrErr);
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.warn(`[WhatsAppManager] Sesi tenant ${tenantId} ditutup. Code: ${statusCode}, Reconnect: ${shouldReconnect}`);

          this.sessions.delete(tenantId);

          if (statusCode === DisconnectReason.loggedOut) {
            try {
              if (fs.existsSync(sessionDir)) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
              }
            } catch (err) {
              console.error(`[WhatsAppManager] Gagal membersihkan folder sesi ${tenantId}:`, err);
            }

            await prisma.tenantWhatsAppConfig.upsert({
              where: { tenantId },
              update: {
                status: 'DISCONNECTED',
                phoneConnected: null,
                qrCode: null
              },
              create: {
                tenantId,
                status: 'DISCONNECTED',
                isAddonActive: true
              }
            });
          } else if (shouldReconnect) {
            if (!this.reconnectingTenants.has(tenantId)) {
              this.reconnectingTenants.add(tenantId);
              setTimeout(async () => {
                this.reconnectingTenants.delete(tenantId);
                console.log(`[WhatsAppManager] Mencoba reconnect otomatis tenant ${tenantId}...`);
                await this.initSession(tenantId);
              }, 5000);
            }
          }

          if (!isResolved) {
            isResolved = true;
            clearTimeout(timer);
            resolve(null);
          }
        } else if (connection === 'open') {
          const userJid = sock.user?.id || '';
          const phone = userJid.split(':')[0] || userJid.split('@')[0];

          console.log(`✅ [WhatsAppManager] WhatsApp terhubung untuk tenant: ${tenantId} (${phone})`);

          await prisma.tenantWhatsAppConfig.upsert({
            where: { tenantId },
            update: {
              status: 'CONNECTED',
              phoneConnected: phone,
              qrCode: null,
              lastConnectedAt: new Date()
            },
            create: {
              tenantId,
              status: 'CONNECTED',
              phoneConnected: phone,
              qrCode: null,
              isAddonActive: true,
              lastConnectedAt: new Date()
            }
          });

          if (!isResolved) {
            isResolved = true;
            clearTimeout(timer);
            resolve(null);
          }
        }
      });
    });
  }

  /**
   * Putus sesi WhatsApp tenant dan bersihkan kredensial lokal
   */
  public async disconnectSession(tenantId: string): Promise<boolean> {
    const sock = this.sessions.get(tenantId);
    if (sock) {
      try {
        if (sock.user && (sock.user as any).id) {
          await sock.logout();
        } else {
          sock.end(undefined);
        }
      } catch (e) {
        try {
          sock.end(undefined);
        } catch (_) {}
      }
      this.sessions.delete(tenantId);
    }

    const sessionDir = this.getTenantSessionDir(tenantId);
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.error(`[WhatsAppManager] Gagal hapus direktori sesi tenant ${tenantId}:`, e);
    }

    await prisma.tenantWhatsAppConfig.upsert({
      where: { tenantId },
      update: {
        status: 'DISCONNECTED',
        phoneConnected: null,
        qrCode: null
      },
      create: {
        tenantId,
        status: 'DISCONNECTED',
        isAddonActive: true
      }
    });

    return true;
  }

  /**
   * Kirim pesan teks WhatsApp dengan penanganan antrean & rate limiting anti-spam
   */
  public async sendMessage(
    tenantId: string,
    recipientPhone: string,
    messageBody: string,
    options?: SendMessageOptions
  ): Promise<{ success: boolean; logId?: string; error?: string }> {
    const cleanPhone = this.normalizePhone(recipientPhone);
    if (!cleanPhone || cleanPhone.length < 9) {
      return { success: false, error: 'Nomor telepon tidak valid' };
    }

    // 1. Cek Kuota Tenant
    const config = await prisma.tenantWhatsAppConfig.findUnique({
      where: { tenantId }
    });

    if (config && config.usedThisMonth >= config.monthlyQuota) {
      const log = await prisma.whatsAppLog.create({
        data: {
          tenantId,
          recipientPhone: cleanPhone,
          recipientName: options?.recipientName,
          triggerKey: options?.triggerKey || 'MANUAL',
          messageBody,
          status: 'FAILED',
          errorMessage: 'Kuota pesan bulanan habis',
          referenceId: options?.referenceId
        }
      });
      return { success: false, logId: log.id, error: 'Kuota pesan bulanan telah habis' };
    }

    // 2. Pastikan Sesi Aktif di Memory
    let sock = this.sessions.get(tenantId);
    if (!sock) {
      const sessionDir = this.getTenantSessionDir(tenantId);
      const credsFile = path.join(sessionDir, 'creds.json');
      if (fs.existsSync(credsFile)) {
        console.log(`[WhatsAppManager] Memulihkan sesi tenant ${tenantId} dari disk...`);
        await this.initSession(tenantId);
        sock = this.sessions.get(tenantId);
      }
    }

    const isSocketReady = Boolean(sock && sock.user && (sock.user as any).id);
    if (!sock || !isSocketReady) {
      const log = await prisma.whatsAppLog.create({
        data: {
          tenantId,
          recipientPhone: cleanPhone,
          recipientName: options?.recipientName,
          triggerKey: options?.triggerKey || 'MANUAL',
          messageBody,
          status: 'FAILED',
          errorMessage: 'WhatsApp belum terhubung (belum scan QR code)',
          referenceId: options?.referenceId
        }
      });
      return { 
        success: false, 
        logId: log.id, 
        error: 'WhatsApp belum terhubung. Silakan scan QR code terlebih dahulu di menu CRM / Pengaturan.' 
      };
    }

    // 3. Masukkan ke Queue Pengiriman Tenant
    return new Promise((resolve) => {
      const task = async () => {
        try {
          const jid = `${cleanPhone}@s.whatsapp.net`;
          await sock!.sendMessage(jid, { text: messageBody });

          // Update kuota terpakai
          await prisma.tenantWhatsAppConfig.update({
            where: { tenantId },
            data: { usedThisMonth: { increment: 1 } }
          });

          // Catat log sukses
          const log = await prisma.whatsAppLog.create({
            data: {
              tenantId,
              recipientPhone: cleanPhone,
              recipientName: options?.recipientName,
              triggerKey: options?.triggerKey || 'MANUAL',
              messageBody,
              status: 'SENT',
              referenceId: options?.referenceId,
              sentAt: new Date()
            }
          });

          resolve({ success: true, logId: log.id });
        } catch (err: any) {
          console.error(`[WhatsAppManager] Gagal kirim pesan ke ${cleanPhone}:`, err);
          const log = await prisma.whatsAppLog.create({
            data: {
              tenantId,
              recipientPhone: cleanPhone,
              recipientName: options?.recipientName,
              triggerKey: options?.triggerKey || 'MANUAL',
              messageBody,
              status: 'FAILED',
              errorMessage: err?.message || 'Error internal pengiriman',
              referenceId: options?.referenceId
            }
          });
          resolve({ success: false, logId: log.id, error: err?.message });
        }
      };

      if (!this.messageQueues.has(tenantId)) {
        this.messageQueues.set(tenantId, []);
      }
      this.messageQueues.get(tenantId)!.push(task);

      this.processQueue(tenantId);
    });
  }

  /**
   * Eksekusi antrean pesan per tenant dengan delay acak 1.5 - 3 detik (anti-ban)
   */
  private async processQueue(tenantId: string) {
    if (this.isProcessingQueue.get(tenantId)) return;

    this.isProcessingQueue.set(tenantId, true);
    const queue = this.messageQueues.get(tenantId);

    while (queue && queue.length > 0) {
      const task = queue.shift();
      if (task) {
        await task();
        const delay = Math.floor(Math.random() * 1500) + 1500;
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    this.isProcessingQueue.set(tenantId, false);
  }

  /**
   * Muat kembali seluruh sesi yang sebelumnya aktif saat backend server dinyalakan
   */
  public async autoRestoreActiveSessions() {
    try {
      const activeConfigs = await prisma.tenantWhatsAppConfig.findMany({
        where: { status: 'CONNECTED' },
        select: { tenantId: true }
      });

      console.log(`[WhatsAppManager] Memeriksa ${activeConfigs.length} sesi WhatsApp yang tersimpan...`);

      for (const config of activeConfigs) {
        const sessionDir = this.getTenantSessionDir(config.tenantId);
        const credsFile = path.join(sessionDir, 'creds.json');
        if (fs.existsSync(credsFile)) {
          this.initSession(config.tenantId).catch((err) => {
            console.error(`[WhatsAppManager] Gagal restore sesi ${config.tenantId}:`, err);
          });
        } else {
          await prisma.tenantWhatsAppConfig.update({
            where: { tenantId: config.tenantId },
            data: { status: 'DISCONNECTED', phoneConnected: null }
          });
        }
      }
    } catch (e) {
      console.error('[WhatsAppManager] Error auto-restoring sessions:', e);
    }
  }
}

export const whatsAppManager = WhatsAppManager.getInstance();
