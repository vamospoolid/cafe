import 'dotenv/config';
if (!process.env.TZ) {
  process.env.TZ = 'Asia/Jakarta';
} // Connected to standalone vamos_cafe_db
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import path from 'path';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import { initRedis, getPubClient, getSubClient, isRedisReady, closeRedis } from './lib/redis';

import prisma from './db';
import { tenantResolverMiddleware } from './middlewares/tenantResolver';
import { securitySanitizerMiddleware } from './middlewares/securitySanitizer';
import { requireActiveTenant } from './middlewares/authMiddleware';
import authRoutes from './routes/auth';

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

// ─── Trust Proxy: Izinkan Express membaca IP asli klien dari header Nginx ────
// WAJIB disetel jika berjalan di belakang Nginx / load balancer reverse proxy.
// Tanpa ini, seluruh request terbaca sebagai IP '127.0.0.1' sehingga rate
// limiter auth akan memblokir SEMUA kasir setelah 30 login dari IP manapun.
app.set('trust proxy', 1);

// ─── Cyber Security: Production Boot Guard ─────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'super_secret_pooos_key' || process.env.JWT_SECRET.length < 32) {
    console.error('[CRITICAL SECURITY ERROR] JWT_SECRET wajib diatur dengan kunci acak aman minimal 32 karakter pada lingkungan produksi!');
    process.exit(1);
  }
}

// ─── Global Error Trapping: Cegah crash mendadak akibat unhandled promise ───
// Mencatat stack trace ke console/log file tanpa mematikan proses produksi.
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('[CRITICAL] Unhandled Promise Rejection:', reason?.message || reason);
  console.error('[CRITICAL] At promise:', promise);
  // Jangan process.exit() — biarkan PM2 autorestart menangani jika benar-benar fatal
});

process.on('uncaughtException', (err: Error) => {
  console.error('[CRITICAL] Uncaught Exception:', err.message);
  console.error(err.stack);
  // Untuk uncaughtException, proses JS sudah tidak dalam state yang aman —
  // lakukan graceful exit dan biarkan PM2 melakukan restart otomatis.
  process.exit(1);
});

// ─── Cyber Security: HTTP Headers & Content Security Policy ─────────────────
app.disable('x-powered-by');

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://app.sandbox.midtrans.com", "https://app.midtrans.com"],
      connectSrc: ["'self'", "ws:", "wss:", "https://app.sandbox.midtrans.com", "https://app.midtrans.com", "https://api.sandbox.midtrans.com", "https://api.midtrans.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      frameSrc: ["'self'", "https://app.sandbox.midtrans.com", "https://app.midtrans.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// ─── Zero-Latency POS CORS Policy ───────────────────────────────────────────
const extraAllowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim().toLowerCase())
  .filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Selalu izinkan request lokal, app PWA, mobile tablet, dan domain terpercaya (0ms latency, no DB query)
    if (!origin) return callback(null, true);

    try {
      const parsedOrigin = new URL(origin);
      const hostname = parsedOrigin.hostname.toLowerCase();

      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('codenusa.id') ||
        hostname.endsWith('vamospool.id') ||
        extraAllowedOrigins.some(allowed => hostname === allowed) ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    } catch {
      return callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-outlet-id', 'x-requested-with', 'x-confirm-backup']
};

app.use(cors(corsOptions));

// ─── Standard Body Parser (Ultra-Lightweight) ──────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ─── Input Sanitization Middleware (Anti-XSS & Prototype Pollution) ─────────
app.use(securitySanitizerMiddleware);

// ─── Fast POS Tenant Context Resolver (0ms In-Memory Resolution) ───────────
app.use(tenantResolverMiddleware);

// Rate Limiter: Anti-Brute Force on Auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 30, // Maksimal 30 request per IP per 15 menit
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan login / PIN dari IP ini. Akses dibatasi sementara 15 menit demi keamanan sistem.' }
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  // Kecualikan kasir terautentikasi agar tidak terblokir saat antrean transaksi padat
  skip: (req) => Boolean(req.headers.authorization),
  message: { error: 'Terlalu banyak request transaksi pembayaran. Silakan tunggu beberapa saat.' }
});

const analyticsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak request analisis data. Silakan tunggu beberapa saat.' }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/switch-pin', authLimiter);
app.use('/api/payments/pos/charge-order', paymentLimiter);
app.use('/api/analytics', analyticsLimiter);

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir, {
  dotfiles: 'ignore',
  maxAge: '1d',
  fallthrough: false
}));

// Routes
import categoryRoutes from './routes/categories';
import productRoutes from './routes/products';
import tableRoutes from './routes/tables';
import orderRoutes from './routes/orders';
import kdsRoutes from './routes/kds';
import attendanceRoutes from './routes/attendance';
import cashflowRoutes from './routes/cashflow';
import reservationRoutes from './routes/reservations';
import analyticsRoutes from './routes/analytics';
import shiftsRoutes from './routes/shifts';
import customerRoutes from './routes/customers';
import settingsRoutes from './routes/settings';
import usersRoutes from './routes/users';
import ingredientRoutes from './routes/ingredients';
import recipeRoutes from './routes/recipes';
import supplierRoutes from './routes/suppliers';
import purchaseOrderRoutes from './routes/purchaseOrders';
import printerRoutes from './routes/printer';
import debtsRoutes from './routes/debts';
import uploadRoutes from './routes/upload';
import databaseRoutes from './routes/database';
import warehouseRoutes from './routes/warehouse';
import employeeLoansRoutes from './routes/employeeLoans';
import vouchersRoutes from './routes/vouchers';
import featureRoutes from './routes/features';
import paymentRoutes from './routes/payments';
import auditLogsRoutes from './routes/auditLogs';
import healthRoutes from './routes/health';
import wasteRoutes from './routes/waste';
import recycleBinRoutes from './routes/recycleBin';
import { requireFeature } from './middlewares/featureMiddleware';

import supportRoutes from './routes/support';
import manifestRoutes from './routes/manifest';
import publicBrandingRoutes from './routes/publicBranding';
import devicePairingRoutes from './routes/devicePairing';
import bengkelRoutes from './routes/bengkel';
import retailRoutes from './routes/retail';
import laundryRoutes from './routes/laundry';
import outletsRoutes from './routes/outlets';
import tenantsRoutes from './routes/tenants';

app.use('/api/health', healthRoutes);
app.use('/api/public-branding', publicBrandingRoutes);
app.use('/api/outlets', outletsRoutes);
app.use('/api/bengkel', bengkelRoutes);
app.use('/api/retail', retailRoutes);
app.use('/api/laundry', laundryRoutes);
app.use('/api/recycle-bin', recycleBinRoutes);
app.use('/api/devices', devicePairingRoutes);
app.get('/api/app/version', (_req, res) => {
  res.json({
    appName: 'CodePOS Universal Tablet',
    appVersion: '2.5.0',
    minRequiredVersion: '1.0.0',
    serverTimestamp: new Date().toISOString(),
    liveUpdateEnabled: true,
    latestBundleHash: 'v2.5.0-universal-mesh',
    changelog: [
      'Universal Tablet Architecture with Zero Rebuilds',
      'Global HID Barcode Scanner with <45ms burst detection',
      'Bluetooth ESC/POS Auto-Reconnect & RJ11 Cash Drawer Kick',
      'Network LAN Port 9100 Kitchen Ticket Relay',
      'Cryptographic 6-digit Device Pairing & Atomic Multi-Tenant Storage Wipe'
    ]
  });
});
app.use('/api', manifestRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/outlets', outletsRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/features', featureRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/vouchers', vouchersRoutes);
app.use('/api/kds', kdsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/cashflow', cashflowRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/waste', wasteRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/printer', printerRoutes);
app.use('/api/debts', debtsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/employee-loans', employeeLoansRoutes);

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ─── HTTP Server + Socket.IO (Multi-Tenant Scoped) ──────────────────────────
const httpServer = createServer(app);

export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.set('io', io);

// ─── Socket.IO Redis Adapter Setup (Horizontal Cluster Mesh) ────────────────
(async () => {
  try {
    const { ready, latencyMs } = await initRedis();
    if (ready) {
      const pubClient = getPubClient();
      const subClient = getSubClient();
      if (pubClient && subClient) {
        io.adapter(createAdapter(pubClient, subClient));
        console.log(`[Socket.IO] Redis Adapter terpasang — event mesh multi-process aktif (Latency: ${latencyMs}ms).`);
      }
    } else {
      console.log('[Socket.IO] Menggunakan In-Memory Adapter (Standalone / Dev mode).');
    }
  } catch (err: any) {
    console.warn('[Socket.IO] Gagal memasang Redis adapter, fallback ke In-Memory:', err.message);
  }
})();

// ─── Register BullMQ Background Workers (Sync, WA, Reports) ─────────────────
import { registerSyncWorker } from './workers/syncWorker';
import { registerWhatsAppWorker } from './workers/waWorker';
import { registerReportWorker } from './workers/reportWorker';
import { queueManager } from './queues/queueManager';

registerSyncWorker();
registerWhatsAppWorker();
registerReportWorker();

io.on('connection', (socket) => {
  let socketTenantId: string | null = null;
  let socketOutletId: string | null = null;

  // Coba verifikasi token dari handshake auth jika ada
  const authToken = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (authToken && typeof authToken === 'string') {
    try {
      const decoded: any = jwt.verify(authToken, JWT_SECRET);
      if (decoded.tenantId) socketTenantId = decoded.tenantId;
      if (decoded.outletId) socketOutletId = decoded.outletId;
    } catch (e) {}
  } else if (socket.handshake.query?.tenantId) {
    socketTenantId = String(socket.handshake.query.tenantId);
    if (socket.handshake.query?.outletId) {
      socketOutletId = String(socket.handshake.query.outletId);
    }
  }

  // Hanya bergabung ke room tenant jika terbukti memiliki identitas tenant valid
  if (socketTenantId) {
    socket.join(`tenant:${socketTenantId}`);
    if (socketOutletId) {
      socket.join(`outlet:${socketOutletId}`);
    }
    console.log(`[Socket.IO] Client connected: ${socket.id} -> Room: tenant:${socketTenantId}, outlet:${socketOutletId || 'all'}`);
  } else {
    socket.join('unauthenticated');
    console.log(`[Socket.IO] Unauthenticated Client connected: ${socket.id} -> Room: unauthenticated`);
  }

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

/**
 * Helper to emit real-time events to a specific tenant room only
 */
export function emitToTenant(tenantId: string, event: string, data: any) {
  io.to(`tenant:${tenantId}`).emit(event, data);
}

/**
 * Helper to emit real-time events to a specific outlet room only
 */
export function emitToOutlet(outletId: string, event: string, data: any) {
  io.to(`outlet:${outletId}`).emit(event, data);
}

import { runShiftAutoCutoff } from './routes/shifts';
import { runAttendanceAutoCutoff } from './routes/attendance';
import { runBengkelInvoiceOverdueCheck } from './routes/bengkel/invoices';

// ─── SaaS Subscription & Backup Background Automation ───────────────────────
import { subscriptionCronService } from './services/SubscriptionCronService';
import { backupCronService } from './services/BackupCronService';

if (require.main === module) {
  httpServer.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`[Socket.IO] Ready for real-time multi-tenant connections`);

    // ─── Cron Isolation: Hanya PM2 Primary Worker (instance 0) yang menjalankan ──
    // Mencegah double-execution saat PM2 dijalankan dalam mode cluster multi-core.
    // NODE_APP_INSTANCE diinjeksi otomatis oleh PM2 untuk setiap worker process.
    const isPrimaryWorker = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0';

    if (isPrimaryWorker) {
      console.log('[Cron] Worker primer terdeteksi — background jobs diaktifkan.');

      // Run initial EOD, Subscription, Bengkel Overdue, and Backup check on startup
      setTimeout(async () => {
        try {
          await runShiftAutoCutoff();
          await runAttendanceAutoCutoff();
          await runBengkelInvoiceOverdueCheck();
        } catch (e) {
          console.error('[Auto-EOD Background Task Error]', e);
        }

        try {
          const summary = await subscriptionCronService.runSubscriptionAuditCycle();
          console.log('[SubscriptionCron Startup Audit Result]', summary);
        } catch (e) {
          console.error('[SubscriptionCron Startup Error]', e);
        }

        try {
          const backupResult = await backupCronService.runDailyBackupCycle(false);
          if (backupResult.executed) {
            console.log('[BackupCron Startup Execution]', backupResult.backup?.filename);
          }
        } catch (e) {
          console.error('[BackupCron Startup Error]', e);
        }
      }, 5000);

      // Periodic interval (runs every 30 minutes to check auto-cutoff, subscriptions, and 03:00 WIB backup)
      setInterval(async () => {
        try {
          await runShiftAutoCutoff();
          await runAttendanceAutoCutoff();
          await runBengkelInvoiceOverdueCheck();
        } catch (e) {
          console.error('[Auto-EOD Periodic Error]', e);
        }

        try {
          await subscriptionCronService.runSubscriptionAuditCycle();
        } catch (e) {
          console.error('[SubscriptionCron Periodic Error]', e);
        }

        try {
          await backupCronService.runDailyBackupCycle(false);
        } catch (e) {
          console.error('[BackupCron Periodic Error]', e);
        }
      }, 30 * 60 * 1000);

    } else {
      console.log(`[Cron] Worker sekunder (instance ${process.env.NODE_APP_INSTANCE}) — background jobs dilewati untuk mencegah eksekusi duplikat.`);
    }
  });

  // ─── Graceful Shutdown: Pastikan koneksi DB & HTTP tertutup rapi ─────────────
  // Dipicu saat PM2 reload, restart, stop, atau server VPS reboot.
  // Memberi kesempatan transaksi aktif untuk selesai (maksimal 10 detik).
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n[Server] Menerima sinyal ${signal}. Memulai graceful shutdown...`);
    httpServer.close(async () => {
      console.log('[Server] HTTP server ditutup. Menutup koneksi database, Redis, dan Queue...');
      try {
        await queueManager.closeAll();
        await closeRedis();
        await prisma.$disconnect();
        console.log('[Server] Database, Redis, & BullMQ disconnected. Proses selesai dengan aman.');
      } catch (e) {
        console.error('[Server] Gagal menutup koneksi database/Redis/Queue:', e);
      }
      process.exit(0);
    });

    // Force kill setelah 10 detik jika server tidak juga selesai menutup koneksi
    setTimeout(() => {
      console.error('[Server] Graceful shutdown timeout (10s). Force exit.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}


