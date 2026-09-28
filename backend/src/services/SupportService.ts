import prisma from '../db';
import { AuditLogger } from './AuditLogger';

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  tenantId?: string | null;
  tenantName?: string;
  outletName?: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  category: 'PRINTER_HARDWARE' | 'OFFLINE_SYNC' | 'PAYMENT_QRIS' | 'INVENTORY_RECIPE' | 'ACCOUNT_ACCESS' | 'GENERAL';
  priority: 'CRITICAL_RUSH_HOUR' | 'HIGH' | 'MEDIUM' | 'LOW';
  subject: string;
  message: string;
  deviceInfo?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
}

// In-memory persistent support ticket registry with audit logging
const supportTicketsStore: SupportTicket[] = [
  {
    id: 'ticket-demo-01',
    ticketNumber: 'TKT-2026-0001',
    tenantId: 'tenant-default-muki',
    tenantName: 'Muki Ramen',
    outletName: 'Senopati Pusat',
    contactName: 'Budi Manager',
    contactPhone: '081298765432',
    contactEmail: 'budi@mukiramen.com',
    category: 'PRINTER_HARDWARE',
    priority: 'MEDIUM',
    subject: 'Panduan konfigurasi printer thermal Bluetooth 80mm di meja bar',
    message: 'Halo tim support, bagaimana cara menghubungkan 2 printer sekaligus untuk kasir dan bar minuman?',
    deviceInfo: 'Android 14 POS Tablet / Chrome 124',
    status: 'RESOLVED',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 20).toISOString()
  }
];

export class SupportService {
  private static instance: SupportService;

  public static getInstance(): SupportService {
    if (!SupportService.instance) {
      SupportService.instance = new SupportService();
    }
    return SupportService.instance;
  }

  public getAllTickets(tenantId?: string | null, isPlatformAdmin: boolean = false): SupportTicket[] {
    if (isPlatformAdmin) {
      return [...supportTicketsStore].reverse();
    }
    if (tenantId) {
      return supportTicketsStore.filter(t => t.tenantId === tenantId).reverse();
    }
    return [];
  }

  public async createTicket(data: {
    tenantId?: string | null;
    tenantName?: string;
    outletName?: string;
    contactName: string;
    contactPhone: string;
    contactEmail?: string;
    category: 'PRINTER_HARDWARE' | 'OFFLINE_SYNC' | 'PAYMENT_QRIS' | 'INVENTORY_RECIPE' | 'ACCOUNT_ACCESS' | 'GENERAL';
    priority: 'CRITICAL_RUSH_HOUR' | 'HIGH' | 'MEDIUM' | 'LOW';
    subject: string;
    message: string;
    deviceInfo?: string;
  }, req?: any): Promise<SupportTicket> {
    const timestamp = new Date();
    const datePrefix = timestamp.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const ticketNumber = `TKT-${datePrefix}-${randomSuffix}`;
    const id = `ticket-${Date.now()}-${randomSuffix}`;

    const newTicket: SupportTicket = {
      id,
      ticketNumber,
      tenantId: data.tenantId || null,
      tenantName: data.tenantName || 'Unregistered / Visitor',
      outletName: data.outletName || 'Main',
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      category: data.category || 'GENERAL',
      priority: data.priority || 'MEDIUM',
      subject: data.subject,
      message: data.message,
      deviceInfo: data.deviceInfo || 'Web Browser',
      status: 'OPEN',
      createdAt: timestamp.toISOString(),
      updatedAt: timestamp.toISOString()
    };

    supportTicketsStore.push(newTicket);

    // Record in Audit Log
    if (req) {
      await AuditLogger.log({
        tenantId: data.tenantId || null,
        action: 'SUPPORT_TICKET_CREATED',
        resource: 'SETTINGS',
        resourceId: ticketNumber,
        description: `Tiket Bantuan dibuat (#${ticketNumber}): ${data.subject} [Prioritas: ${data.priority}]`,
        severity: data.priority === 'CRITICAL_RUSH_HOUR' ? 'CRITICAL' : 'INFO'
      }, req);
    }

    return newTicket;
  }

  public updateTicketStatus(id: string, status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'): SupportTicket | null {
    const ticket = supportTicketsStore.find(t => t.id === id);
    if (!ticket) return null;

    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    return ticket;
  }

  public getFAQList() {
    return [
      {
        id: 'faq-1',
        category: 'PRINTER_HARDWARE',
        question: 'Printer Bluetooth Thermal Tidak Terdeteksi / Tidak Merespon',
        answer: '1. Pastikan Bluetooth di perangkat Android/iPad Anda aktif dan ter-pairing dengan printer (PIN default: 0000 atau 1234).\n2. Buka menu Pengaturan POS > Printer > pilih jenis Bluetooth ESC/POS.\n3. Klik "Test Print 58mm / 80mm". Jika lampu printer berkedip merah, periksa apakah kertas struk terpasang terbalik atau habis.',
        tags: ['printer', 'bluetooth', 'thermal', 'struk', 'macet']
      },
      {
        id: 'faq-2',
        category: 'OFFLINE_SYNC',
        question: 'Bagaimana Cara Menggunakan POS Saat Internet / WiFi Mati?',
        answer: 'Codenusa POS otomatis beralih ke mode Offline-First. Kasir dapat terus menginput pesanan dan mencetak struk kasir tanpa kendala. Begitu internet kembali tersambung, sistem akan menampilkan indikator hijau dan menyinkronkan seluruh transaksi antrean secara otomatis.',
        tags: ['offline', 'internet mati', 'sync', 'antrean']
      },
      {
        id: 'faq-3',
        category: 'PAYMENT_QRIS',
        question: 'Uang Pembayaran QRIS Pelanggan Masuk ke Mana?',
        answer: 'Karena Codenusa POS menggunakan model Bring-Your-Own-Key (BYOK) Midtrans, seluruh pembayaran QRIS langsung masuk 100% ke rekening bank merchant pemilik kafe yang terdaftar di portal Midtrans tanpa ada penahanan dana dari kami.',
        tags: ['qris', 'midtrans', 'pembayaran', 'rekening', 'dana']
      },
      {
        id: 'faq-4',
        category: 'ACCOUNT_ACCESS',
        question: 'Lupa PIN Kasir atau Password Akun Staf',
        answer: 'Pemilik kafe (Owner / Admin) dapat masuk ke menu Pengguna (Users) > klik tombol edit pada staf terkait > ubah PIN (4-8 digit) atau atur ulang password baru secara instan.',
        tags: ['pin', 'lupa password', 'kasir', 'hak akses']
      },
      {
        id: 'faq-5',
        category: 'INVENTORY_RECIPE',
        question: 'Mengapa Stok Bahan Baku Resep Tidak Terpotong Otomatis?',
        answer: 'Pastikan menu produk telah dihubungkan dengan resep bahan baku di menu Resep (Recipes). Jika porsi menu terjual dengan status "Paid", sistem akan memotong gramatur bahan baku secara realtime.',
        tags: ['resep', 'stok', 'bahan baku', 'hpp', 'dapur']
      }
    ];
  }
}

export const supportService = SupportService.getInstance();
