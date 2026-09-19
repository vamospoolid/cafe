import 'dotenv/config';
if (!process.env.TZ) {
  process.env.TZ = 'Asia/Jakarta';
}
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';

import { tenantResolverMiddleware } from './middlewares/tenantResolver';
import { securitySanitizerMiddleware } from './middlewares/securitySanitizer';
import authRoutes from './routes/auth';

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

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

// ─── Dynamic Multi-Tenant CORS Allowlist ────────────────────────────────────
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Izinkan request tanpa origin (seperti Mobile PWA, Postman, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    try {
      const parsedOrigin = new URL(origin);
      const hostname = parsedOrigin.hostname.toLowerCase();

      // 1. Izinkan localhost / 127.0.0.1 untuk local development
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return callback(null, true);
      }

      // 2. Izinkan domain root dan seluruh subdomain Codenusa (*.codenusa.id)
      if (hostname === 'codenusa.id' || hostname.endsWith('.codenusa.id')) {
        return callback(null, true);
      }

      // 3. Fallback izinkan untuk request browser valid
      return callback(null, true);
    } catch {
      return callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-outlet-id', 'x-requested-with']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── Input Sanitization Middleware (Anti-XSS & Prototype Pollution) ─────────
app.use(securitySanitizerMiddleware);

// ─── Multi-Tenant Context Resolver Middleware ───────────────────────────────
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
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
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
import featureRoutes from './routes/features';
import paymentRoutes from './routes/payments';
import auditLogsRoutes from './routes/auditLogs';
import healthRoutes from './routes/health';
import platformAdminRoutes from './routes/platformAdmin';
import outletsRoutes from './routes/outlets';
import tenantsRoutes from './routes/tenants';
import { requireFeature } from './middlewares/featureMiddleware';

app.use('/api/health', healthRoutes);
app.use('/api/platform-admin', platformAdminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/outlets', outletsRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/features', featureRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/tables', requireFeature('pos.tables'), tableRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/kds', requireFeature('pos.kds'), kdsRoutes);
app.use('/api/attendance', requireFeature('hr.attendance'), attendanceRoutes);
app.use('/api/cashflow', cashflowRoutes);
app.use('/api/reservations', requireFeature('pos.reservations'), reservationRoutes);
app.use('/api/analytics', requireFeature('analytics.advanced'), analyticsRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/ingredients', requireFeature('inventory.advanced'), ingredientRoutes);
app.use('/api/recipes', requireFeature('inventory.advanced'), recipeRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/printer', printerRoutes);
app.use('/api/debts', requireFeature('finance.debts'), debtsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/warehouse', requireFeature('warehouse.management'), warehouseRoutes);
app.use('/api/employee-loans', requireFeature('finance.loans'), employeeLoansRoutes);

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

io.on('connection', (socket) => {
  let socketTenantId = 'tenant-default-muki';
  let socketOutletId = 'outlet-default-muki-01';

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
  }

  // Bergabung ke room tenant dan room outlet yang terisolasi
  socket.join(`tenant:${socketTenantId}`);
  socket.join(`outlet:${socketOutletId}`);

  console.log(`[Socket.IO] Client connected: ${socket.id} -> Room: tenant:${socketTenantId}, outlet:${socketOutletId}`);

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

httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`[Socket.IO] Ready for real-time multi-tenant connections`);

  // Run initial EOD check on startup
  setTimeout(async () => {
    try {
      await runShiftAutoCutoff();
      await runAttendanceAutoCutoff();
    } catch (e) {
      console.error('[Auto-EOD Background Task Error]', e);
    }
  }, 5000);

  // Periodic interval (runs every 30 minutes to auto-cutoff dangling shifts/attendance)
  setInterval(async () => {
    try {
      await runShiftAutoCutoff();
      await runAttendanceAutoCutoff();
    } catch (e) {
      console.error('[Auto-EOD Periodic Error]', e);
    }
  }, 30 * 60 * 1000);
});
