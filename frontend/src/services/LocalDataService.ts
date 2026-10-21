/**
 * LocalDataService.ts
 * Engine Akses Data Lokal untuk Mode 100% Offline Standalone APK
 * Mengelola seluruh operasi bisnis kasir, shift, stok, piutang, dan rekapitulasi langsung di Dexie v2
 */

import { 
  offlineDb, 
  type LocalProduct, 
  type LocalOrder, 
  type LocalOrderItem, 
  type LocalShift, 
  type LocalCustomer, 
  type LocalDebt, 
  type LocalCashFlow 
} from '../db/offlineDb';

export interface CheckoutPayload {
  customerName?: string;
  customerPhone?: string;
  customerId?: number | null;
  tableId?: number | null;
  tableName?: string | null;
  items: {
    productId: number;
    productName: string;
    qty: number;
    price: number;
    cost?: number;
    notes?: string;
    selectedUom?: string;
    selectedVariants?: any[];
  }[];
  subtotal: number;
  discount?: number;
  tax?: number;
  serviceCharge?: number;
  total: number;
  paymentMethod: string; // CASH | QRIS | TRANSFER | BON | TEMPO | SPLIT
  notes?: string;
  vertical?: string;
  shiftId?: number | null;
  userId?: number;
  cashierName?: string;
}

export class LocalDataService {
  /**
   * Cek integritas jam perangkat (Clock Tampering Guard)
   * Mencegah manipulasi waktu mundur di Android
   */
  static async verifyClockIntegrity(): Promise<{ valid: boolean; message?: string }> {
    try {
      const lastOrder = await offlineDb.localOrders.orderBy('createdAt').last();
      if (lastOrder && new Date() < new Date(lastOrder.createdAt)) {
        return {
          valid: false,
          message: `Jam sistem Android tidak valid! Waktu saat ini (${new Date().toLocaleString('id-ID')}) lebih lampau dari transaksi terakhir (${new Date(lastOrder.createdAt).toLocaleString('id-ID')}). Harap sesuaikan tanggal & waktu perangkat.`
        };
      }
      return { valid: true };
    } catch (_) {
      return { valid: true };
    }
  }

  /**
   * Menghasilkan nomor urut order offline unik per hari
   * Format: FK-YYYYMMDD-XXXX (Retail) / ORD-YYYYMMDD-XXXX (Kafe) / SPK-YYYYMMDD-XXXX (Bengkel)
   */
  static async generateOrderNumber(vertical: string = 'RETAIL'): Promise<string> {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    let prefix = 'ORD';
    const vert = vertical.toUpperCase();
    if (vert === 'RETAIL') prefix = 'FK';
    else if (vert === 'BENGKEL') prefix = 'SPK';
    else if (vert === 'LAUNDRY') prefix = 'NC'; // Nota Cuci
    else if (vert === 'RENTAL') prefix = 'KS'; // Kontrak Sewa

    const startOfDay = new Date(yyyy, now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
    const endOfDay = new Date(yyyy, now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    const todayOrders = await offlineDb.localOrders
      .where('createdAt')
      .between(startOfDay, endOfDay, true, true)
      .count();

    const seq = String(todayOrders + 1).padStart(4, '0');
    return `${prefix}-${dateStr}-${seq}`;
  }

  /**
   * Transaksi Checkout Kasir Lokal Lengkap & Atomik
   */
  static async checkoutOrder(payload: CheckoutPayload): Promise<{ success: boolean; order: LocalOrder; error?: string }> {
    // 1. Guard jam perangkat
    const clockCheck = await this.verifyClockIntegrity();
    if (!clockCheck.valid) {
      throw new Error(clockCheck.message);
    }

    const orderNumber = await this.generateOrderNumber(payload.vertical || 'RETAIL');
    const offlineId = `OFF-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();
    const isPaid = payload.paymentMethod.toUpperCase() !== 'BON' && payload.paymentMethod.toUpperCase() !== 'TEMPO';

    return await offlineDb.transaction('rw', [
      offlineDb.localOrders,
      offlineDb.localOrderItems,
      offlineDb.localProducts,
      offlineDb.localIngredients,
      offlineDb.localRecipes,
      offlineDb.localShifts,
      offlineDb.localCashFlow,
      offlineDb.localCustomers,
      offlineDb.localDebts
    ], async () => {
      // A. Simpan Order Induk
      const orderRecord: LocalOrder = {
        orderNumber,
        offlineId,
        tableId: payload.tableId || null,
        tableName: payload.tableName || null,
        customerId: payload.customerId || null,
        customerName: payload.customerName || 'Pelanggan Umum',
        customerPhone: payload.customerPhone || null,
        subtotal: payload.subtotal,
        discount: payload.discount || 0,
        tax: payload.tax || 0,
        serviceCharge: payload.serviceCharge || 0,
        total: payload.total,
        paymentMethod: payload.paymentMethod,
        status: isPaid ? 'Paid' : 'Pending',
        isPaid,
        shiftId: payload.shiftId || null,
        userId: payload.userId || 1,
        cashierName: payload.cashierName || 'Kasir',
        notes: payload.notes || null,
        createdAt: nowIso,
        paidAt: isPaid ? nowIso : null,
        businessType: payload.vertical || 'RETAIL',
        tenantId: 'standalone'
      };

      const orderId = await offlineDb.localOrders.add(orderRecord);
      orderRecord.id = orderId;

      // B. Simpan Items & Potong Stok Produk / Bahan Baku
      for (const item of payload.items) {
        await offlineDb.localOrderItems.add({
          orderId,
          productId: item.productId,
          productName: item.productName,
          qty: item.qty,
          price: item.price,
          cost: item.cost || 0,
          subtotal: item.qty * item.price,
          notes: item.notes,
          selectedUom: item.selectedUom,
          selectedVariants: item.selectedVariants
        });

        // Kurangi stok produk
        const prod = await offlineDb.localProducts.get(item.productId);
        if (prod && prod.trackStock !== false) {
          const newStock = Math.max(0, (prod.stock || 0) - item.qty);
          await offlineDb.localProducts.update(item.productId, { stock: newStock });
        }

        // Jika Kafe: kurangi bahan baku resep jika ada
        const recipes = await offlineDb.localRecipes.where('productId').equals(item.productId).toArray();
        for (const r of recipes) {
          const ing = await offlineDb.localIngredients.get(r.ingredientId);
          if (ing) {
            const deduct = r.qtyPerServing * item.qty;
            await offlineDb.localIngredients.update(r.ingredientId, {
              stock: Math.max(0, ing.stock - deduct)
            });
          }
        }
      }

      // C. Update Shift Kasir jika ada shift aktif
      if (payload.shiftId) {
        const shift = await offlineDb.localShifts.get(payload.shiftId);
        if (shift && shift.status === 'Open') {
          const isCash = payload.paymentMethod.toUpperCase() === 'CASH' || payload.paymentMethod.toUpperCase() === 'TUNAI';
          const newSaldoSistem = (shift.saldoSistem || 0) + payload.total;
          const newSaldoElektronik = isCash ? (shift.saldoElektronik || 0) : (shift.saldoElektronik || 0) + payload.total;

          await offlineDb.localShifts.update(payload.shiftId, {
            saldoSistem: newSaldoSistem,
            saldoElektronik: newSaldoElektronik
          });
        }
      }

      // D. Pencatatan Piutang jika metode BON / TEMPO
      if (!isPaid && payload.customerId) {
        await offlineDb.localDebts.add({
          orderId,
          orderNumber,
          customerId: payload.customerId,
          customerName: payload.customerName || 'Pelanggan',
          totalAmount: payload.total,
          remaining: payload.total,
          status: 'Belum Lunas',
          createdAt: nowIso,
          tenantId: 'standalone'
        });

        const cust = await offlineDb.localCustomers.get(payload.customerId);
        if (cust) {
          await offlineDb.localCustomers.update(payload.customerId, {
            currentDebt: (cust.currentDebt || 0) + payload.total
          });
        }
      }

      // E. Update Poin & Total Belanja Member
      if (payload.customerId && isPaid) {
        const cust = await offlineDb.localCustomers.get(payload.customerId);
        if (cust) {
          const earnedPoints = Math.floor(payload.total / 10000); // 1 poin per 10.000
          await offlineDb.localCustomers.update(payload.customerId, {
            points: (cust.points || 0) + earnedPoints,
            totalSpent: (cust.totalSpent || 0) + payload.total
          });
        }
      }

      return { success: true, order: orderRecord };
    });
  }

  // ─── Shift Kasir Lokal ─────────────────────────────────────────────────────

  static async getActiveShift(): Promise<LocalShift | null> {
    const shift = await offlineDb.localShifts.where('status').equals('Open').first();
    return shift || null;
  }

  static async openShift(cashierName: string, saldoAwal: number, userId: number = 1): Promise<LocalShift> {
    const active = await this.getActiveShift();
    if (active) {
      throw new Error('Shift kasir sudah dalam status terbuka.');
    }

    const shiftData: LocalShift = {
      status: 'Open',
      waktuBuka: new Date().toISOString(),
      userId,
      cashierName,
      saldoAwal: Number(saldoAwal) || 0,
      saldoSistem: Number(saldoAwal) || 0,
      saldoElektronik: 0,
      saldoFisikLaci: 0,
      selisih: 0,
      tenantId: 'standalone'
    };

    const id = await offlineDb.localShifts.add(shiftData);
    shiftData.id = id;

    // Catat modal awal laci ke CashFlow
    await offlineDb.localCashFlow.add({
      type: 'Pemasukan',
      category: 'Modal Awal Kasir',
      cashPocket: 'LACI_KASIR',
      amount: Number(saldoAwal) || 0,
      description: `Buka Shift Kasir - ${cashierName}`,
      shiftId: id,
      userId,
      createdAt: new Date().toISOString(),
      tenantId: 'standalone'
    });

    return shiftData;
  }

  static async closeShift(shiftId: number, saldoFisik: number, varianceReason?: string): Promise<LocalShift> {
    const shift = await offlineDb.localShifts.get(shiftId);
    if (!shift || shift.status === 'Closed') {
      throw new Error('Shift tidak ditemukan atau sudah ditutup.');
    }

    const waktuTutup = new Date().toISOString();
    
    // Hitung total penjualan tunai selama shift
    const ordersInShift = await offlineDb.localOrders
      .where('shiftId')
      .equals(shiftId)
      .filter(o => o.status === 'Paid')
      .toArray();

    const cashSales = ordersInShift
      .filter(o => o.paymentMethod.toUpperCase() === 'CASH' || o.paymentMethod.toUpperCase() === 'TUNAI')
      .reduce((sum, o) => sum + o.total, 0);

    const nonCashSales = ordersInShift
      .filter(o => o.paymentMethod.toUpperCase() !== 'CASH' && o.paymentMethod.toUpperCase() !== 'TUNAI')
      .reduce((sum, o) => sum + o.total, 0);

    // Ambil mutasi kas kecil laci
    const flows = await offlineDb.localCashFlow.where('shiftId').equals(shiftId).toArray();
    const cashIn = flows
      .filter(f => f.type === 'Pemasukan' && f.category !== 'Modal Awal Kasir' && f.cashPocket === 'LACI_KASIR')
      .reduce((sum, f) => sum + f.amount, 0);
    const cashOut = flows
      .filter(f => f.type === 'Pengeluaran' && f.cashPocket === 'LACI_KASIR')
      .reduce((sum, f) => sum + f.amount, 0);

    const expectedCashInDrawer = shift.saldoAwal + cashSales + cashIn - cashOut;
    const selisih = Number(saldoFisik) - expectedCashInDrawer;

    const updatedData: Partial<LocalShift> = {
      status: 'Closed',
      waktuTutup,
      saldoSistem: expectedCashInDrawer,
      saldoElektronik: nonCashSales,
      saldoFisikLaci: Number(saldoFisik),
      selisih,
      varianceReason: varianceReason || null
    };

    await offlineDb.localShifts.update(shiftId, updatedData);
    return { ...shift, ...updatedData } as LocalShift;
  }

  // ─── Pelunasan Piutang Bon Tempo Lokal ──────────────────────────────────────

  static async payCustomerDebt(debtId: number, amountPaid: number, paymentMethod: string = 'CASH'): Promise<{ success: boolean; remaining: number }> {
    const debt = await offlineDb.localDebts.get(debtId);
    if (!debt || debt.status === 'Lunas') {
      throw new Error('Data piutang tidak ditemukan atau sudah lunas.');
    }

    const payAmt = Number(amountPaid);
    if (payAmt <= 0) throw new Error('Jumlah pembayaran tidak valid.');

    const newRemaining = Math.max(0, debt.remaining - payAmt);
    const newStatus = newRemaining === 0 ? 'Lunas' : 'Belum Lunas';

    await offlineDb.transaction('rw', [offlineDb.localDebts, offlineDb.localDebtPayments, offlineDb.localCashFlow, offlineDb.localCustomers], async () => {
      await offlineDb.localDebts.update(debtId, {
        remaining: newRemaining,
        status: newStatus
      });

      await offlineDb.localDebtPayments.add({
        debtId,
        amountPaid: payAmt,
        paymentMethod,
        createdAt: new Date().toISOString(),
        tenantId: 'standalone'
      });

      // Catat ke CashFlow
      await offlineDb.localCashFlow.add({
        type: 'Pemasukan',
        category: 'Pembayaran Piutang',
        cashPocket: 'LACI_KASIR',
        amount: payAmt,
        description: `Pelunasan Bon: ${debt.customerName}`,
        createdAt: new Date().toISOString(),
        tenantId: 'standalone'
      });

      // Kurangi total hutang di profil customer
      const cust = await offlineDb.localCustomers.get(debt.customerId);
      if (cust) {
        await offlineDb.localCustomers.update(debt.customerId, {
          currentDebt: Math.max(0, (cust.currentDebt || 0) - payAmt)
        });
      }
    });

    return { success: true, remaining: newRemaining };
  }

  // ─── Seed Data Awal Toko Baru (First Boot Standalone) ──────────────────────

  static async seedInitialStoreData(vertical: string = 'RETAIL'): Promise<void> {
    const count = await offlineDb.localProducts.count();
    if (count > 0) return; // Sudah ada data, jangan timpa

    const vert = vertical.toUpperCase();
    if (vert === 'RETAIL') {
      const catId = await offlineDb.localCategories.add({ name: 'Sembako & Kebutuhan Pokok', tenantId: 'standalone' });
      await offlineDb.localProducts.bulkAdd([
        { name: 'Beras Premium 5kg', price: 72000, buyPrice: 65000, barcode: '8991001001', stock: 50, trackStock: true, categoryId: catId, tenantId: 'standalone' },
        { name: 'Minyak Goreng 2L', price: 34000, buyPrice: 30000, barcode: '8991001002', stock: 40, trackStock: true, categoryId: catId, tenantId: 'standalone' },
        { name: 'Gula Pasir 1kg', price: 17500, buyPrice: 15500, barcode: '8991001003', stock: 60, trackStock: true, categoryId: catId, tenantId: 'standalone' },
        { name: 'Telur Ayam 1kg (Karton)', price: 28000, buyPrice: 25000, barcode: '8991001004', stock: 30, trackStock: true, categoryId: catId, tenantId: 'standalone' }
      ]);
    } else if (vert === 'BENGKEL') {
      const catParts = await offlineDb.localCategories.add({ name: 'Sparepart & Oli', tenantId: 'standalone' });
      const catServices = await offlineDb.localCategories.add({ name: 'Jasa Servis', tenantId: 'standalone' });
      await offlineDb.localProducts.bulkAdd([
        { name: 'Oli Mesin MPX2 0.8L', price: 58000, buyPrice: 48000, barcode: '8992001001', stock: 25, trackStock: true, categoryId: catParts, tenantId: 'standalone' },
        { name: 'Busi Standar Denso U24EPR9', price: 25000, buyPrice: 18000, barcode: '8992001002', stock: 30, trackStock: true, categoryId: catParts, tenantId: 'standalone' },
        { name: 'Jasa Servis Ringan + Tune Up', price: 45000, buyPrice: 0, barcode: 'SRV-001', stock: 999, trackStock: false, categoryId: catServices, tenantId: 'standalone' },
        { name: 'Jasa Ganti Oli', price: 10000, buyPrice: 0, barcode: 'SRV-002', stock: 999, trackStock: false, categoryId: catServices, tenantId: 'standalone' }
      ]);
    } else {
      // CAFE
      const catDrink = await offlineDb.localCategories.add({ name: 'Minuman Kopi', tenantId: 'standalone' });
      const catSnack = await offlineDb.localCategories.add({ name: 'Makanan & Snack', tenantId: 'standalone' });
      await offlineDb.localProducts.bulkAdd([
        { name: 'Kopi Susu Gula Aren', price: 18000, buyPrice: 7000, barcode: 'CF-001', stock: 100, trackStock: true, categoryId: catDrink, tenantId: 'standalone' },
        { name: 'Americano Ice', price: 15000, buyPrice: 5000, barcode: 'CF-002', stock: 100, trackStock: true, categoryId: catDrink, tenantId: 'standalone' },
        { name: 'Croissant Butter', price: 22000, buyPrice: 12000, barcode: 'CF-003', stock: 20, trackStock: true, categoryId: catSnack, tenantId: 'standalone' }
      ]);
    }

    // Default Customer Umum
    await offlineDb.localCustomers.add({
      name: 'Pelanggan Umum',
      phone: '08000000000',
      points: 0,
      totalSpent: 0,
      creditLimit: 0,
      currentDebt: 0,
      tenantId: 'standalone'
    });
  }
}
