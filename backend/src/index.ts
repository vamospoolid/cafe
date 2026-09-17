import 'dotenv/config';
if (!process.env.TZ) {
  process.env.TZ = 'Asia/Jakarta';
}
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import authRoutes from './routes/auth';

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 5000;

// Cyber Security: Hide server identity & apply HTTP protection headers
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false
}));
app.disable('x-powered-by');

app.use(cors());
app.use(express.json());
import fs from 'fs';

// Rate Limiter: Anti-Brute Force on Auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 30, // Maksimal 30 request per IP per 15 menit
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan login / PIN dari IP ini. Akses dibatasi sementara 15 menit demi keamanan sistem.' }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/switch-pin', authLimiter);

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

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
import courseRoutes from './routes/course';
import batchRoutes from './routes/batch';
import liveSessionRoutes from './routes/liveSession';
import studentProgressRoutes from './routes/studentProgress';

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/orders', orderRoutes);
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
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/printer', printerRoutes);
app.use('/api/debts', debtsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/employee-loans', employeeLoansRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/live-sessions', liveSessionRoutes);
app.use('/api/progress', studentProgressRoutes);

app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'Backend is running' });
});

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ─── HTTP Server + Socket.IO ───────────────────────────────────────────────
const httpServer = createServer(app);

export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

import { runShiftAutoCutoff } from './routes/shifts';
import { runAttendanceAutoCutoff } from './routes/attendance';

httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`[Socket.IO] Ready for real-time connections`);

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


