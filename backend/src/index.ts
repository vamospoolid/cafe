import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import authRoutes from './routes/auth';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`[Socket.IO] Ready for real-time connections`);
});
