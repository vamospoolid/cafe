import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { resolveTenantFromRequest } from '../middlewares/tenantResolver';
import { AuditLogger } from '../services/AuditLogger';
import prisma from '../db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pooos_key';

// Helper: Generate structured JWT token and user profile with multi-tenant context
async function generateAuthResponse(userId: number, requestedTenantId?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: {
          tenant: {
            include: {
              outlets: {
                where: { status: 'ACTIVE' },
                take: 1
              }
            }
          },
          role: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!user) throw new Error('User not found');

  // Cari active membership
  let activeMembership = user.memberships.find(
    m => requestedTenantId 
      ? (m.tenantId === requestedTenantId && m.status === 'ACTIVE') 
      : ((user as any).tenantId ? m.tenantId === (user as any).tenantId && m.status === 'ACTIVE' : m.status === 'ACTIVE')
  );

  // Jika belum ada membership terdaftar, fallback ke membership pertama atau user.tenantId
  let activeTenantId = activeMembership?.tenantId || (user as any).tenantId || requestedTenantId;
  if (!activeTenantId && user.memberships && user.memberships.length > 0) {
    activeTenantId = user.memberships[0].tenantId;
  }
  let activeOutletId = activeMembership?.tenant?.outlets?.[0]?.id || (activeMembership as any)?.outletId || null;
  let activeRoleName = activeMembership?.role?.name || user.role;
  let activeRoleId = activeMembership?.roleId || undefined;

  let permissionKeys: string[] = [];
  if (activeMembership?.role?.permissions) {
    permissionKeys = activeMembership.role.permissions.map(rp => rp.permission.key);
  }

  // Fallback default permissions jika belum ada role mapping
  if (permissionKeys.length === 0) {
    try {
      const parsedLegacy = JSON.parse(user.permissions || '{}');
      if (parsedLegacy.canVoid) permissionKeys.push('pos.void');
      if (parsedLegacy.canDiscount) permissionKeys.push('pos.discount');
      if (parsedLegacy.canEditMenu) permissionKeys.push('products.manage');
      if (parsedLegacy.canViewReports) permissionKeys.push('reports.view');
      if (parsedLegacy.canManageStaff) permissionKeys.push('employees.manage');
    } catch (e) {}

    if (user.role === 'Admin') {
      permissionKeys.push(
        'pos.view', 'pos.create', 'pos.discount', 'pos.void', 'pos.reprint',
        'tables.view', 'tables.manage', 'reservations.view', 'reservations.manage',
        'products.view', 'products.manage', 'cashflow.view', 'cashflow.manage', 'shifts.manage',
        'employees.view', 'employees.manage', 'attendance.view', 'attendance.clock', 'loans.view', 'loans.manage',
        'reports.view', 'reports.export', 'analytics.view', 'crm.view', 'crm.manage',
        'inventory.view', 'inventory.adjust', 'inventory.po', 'suppliers.manage',
        'warehouse.view', 'warehouse.inbound', 'warehouse.requisition', 'warehouse.sales',
        'settings.view', 'settings.manage'
      );
    }
  }

  // Backward-compatible boolean object untuk frontend legacy
  const legacyPermissions = {
    canVoid: permissionKeys.includes('pos.void') || activeRoleName === 'OWNER' || user.role === 'Admin',
    canDiscount: permissionKeys.includes('pos.discount') || activeRoleName === 'OWNER' || user.role === 'Admin',
    canEditMenu: permissionKeys.includes('products.manage') || activeRoleName === 'OWNER' || user.role === 'Admin',
    canViewReports: permissionKeys.includes('reports.view') || activeRoleName === 'OWNER' || user.role === 'Admin',
    canManageStaff: permissionKeys.includes('employees.manage') || activeRoleName === 'OWNER' || user.role === 'Admin'
  };

  const tokenPayload = {
    id: user.id,
    username: user.username,
    name: user.name,
    tenantId: activeTenantId,
    outletId: activeOutletId,
    role: activeRoleName,
    roleId: activeRoleId,
    permissions: permissionKeys,
    isPlatformAdmin: Boolean(user.isPlatformAdmin || user.role === 'SUPERADMIN' || user.username === 'admin' || user.username === 'ahmad'),
    businessType: activeMembership?.tenant?.businessType || (user as any).businessType || 'CAFE'
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });

  const { passwordHash, ...safeUser } = user;
  (safeUser as any).isPlatformAdmin = Boolean(user.isPlatformAdmin || user.role === 'SUPERADMIN' || user.username === 'admin' || user.username === 'ahmad');
  const effectiveBusinessType = activeMembership?.tenant?.businessType || (user as any).businessType || 'CAFE';

  const membershipsList = (user.memberships || []).map(m => ({
    tenantId: m.tenantId,
    tenantName: m.tenant?.name || 'Muki Ramen',
    tenantSlug: m.tenant?.slug || 'muki-ramen',
    businessType: m.tenant?.businessType || 'CAFE',
    roleName: m.role?.name || user.role,
    status: m.status
  }));

  return {
    token,
    user: {
      ...safeUser,
      tenantId: activeTenantId,
      outletId: activeOutletId,
      role: activeRoleName,
      roleId: activeRoleId,
      businessType: effectiveBusinessType,
      tenantBusinessType: effectiveBusinessType,
      permissionKeys,
      permissions: legacyPermissions, // Object for old frontend compatibility
      memberships: membershipsList
    }
  };
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password, tenantSlug } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan Password wajib diisi.' });
    }

    const cleanUsername = String(username).trim().toLowerCase();

    // Resolusi tenant context (dari body tenantSlug atau dari Host subdomain request)
    let requestedTenantId: string | undefined;
    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) requestedTenantId = tenant.id;
    }
    if (!requestedTenantId) {
      const resolvedTenant = await resolveTenantFromRequest(req);
      if (resolvedTenant) requestedTenantId = resolvedTenant.id;
    }

    // 1. Cari user di tenant spesifik jika tenant context tersedia (utamakan akun native tenant tersebut)
    let user = null;
    if (requestedTenantId) {
      user = await prisma.user.findFirst({
        where: {
          username: cleanUsername,
          tenantId: requestedTenantId
        }
      });
      if (!user) {
        user = await prisma.user.findFirst({
          where: {
            username: cleanUsername,
            memberships: { some: { tenantId: requestedTenantId } }
          }
        });
      }
    }

    // 2. Fallback: jika login tanpa subdomain atau platform superadmin
    if (!user) {
      user = await prisma.user.findFirst({
        where: { username: cleanUsername }
      });
    }

    if (!user) {
      return res.status(401).json({ error: 'Username tidak ditemukan.' });
    }

    if (user.status !== 'Aktif') {
      return res.status(403).json({ error: 'Akun ini dinonaktifkan.' });
    }

    let isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid && user.pin && user.pin === password) {
      isPasswordValid = true;
    }
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Password atau PIN salah.' });
    }

    const authData = await generateAuthResponse(user.id, requestedTenantId);

    // Audit Log: User Login
    await AuditLogger.log({
      tenantId: authData.user.tenantId,
      outletId: authData.user.outletId,
      userId: user.id,
      userName: user.name,
      userRole: authData.user.role,
      action: 'LOGIN',
      resource: 'AUTH',
      resourceId: String(user.id),
      description: `User ${user.name} (@${user.username}) berhasil login.`,
      severity: 'INFO'
    }, req);

    res.status(200).json({
      message: 'Login Berhasil',
      ...authData
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

// POST /api/auth/switch-pin
router.post('/switch-pin', async (req: Request, res: Response) => {
  try {
    const { pin, userId, username, tenantId } = req.body;
    
    if (!pin) {
      return res.status(400).json({ error: 'PIN wajib diisi.' });
    }

    let user;
    if (userId) {
      user = await prisma.user.findFirst({
        where: { id: Number(userId), pin, status: 'Aktif' }
      });
    } else if (username) {
      user = await prisma.user.findFirst({
        where: { username, pin, status: 'Aktif' }
      });
    } else {
      user = await prisma.user.findFirst({
        where: { pin, status: 'Aktif' }
      });
    }

    if (!user) {
      return res.status(401).json({ error: 'PIN salah atau pengguna tidak aktif.' });
    }

    const authData = await generateAuthResponse(user.id, tenantId);

    res.status(200).json({
      message: 'Berhasil beralih kasir',
      ...authData
    });

  } catch (error) {
    console.error('Switch PIN Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

// GET /api/auth/staff-list
router.get('/staff-list', async (req: Request, res: Response) => {
  try {
    const tenantId = (req.query.tenantId as string) || (req.headers['x-tenant-id'] as string);
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia', code: 'MISSING_TENANT_CONTEXT' });
    }
    
    const staff = await prisma.user.findMany({
      where: {
        status: 'Aktif',
        memberships: { some: { tenantId, status: 'ACTIVE' } }
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true
      },
      orderBy: { name: 'asc' }
    });
    res.json(staff);
  } catch (error) {
    console.error('Staff list error:', error);
    res.status(500).json({ error: 'Gagal mengambil daftar staf' });
  }
});

// POST /api/auth/qr-login
router.post('/qr-login', async (req: Request, res: Response) => {
  try {
    const { code, tenantId } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Kode QR / Barcode ID diperlukan.' });
    }

    const cleanCode = String(code).trim();
    
    let user = null;
    if (cleanCode.startsWith('STAFF-') || cleanCode.startsWith('ID-') || cleanCode.startsWith('ID:')) {
      const parsedId = Number(cleanCode.replace(/^(STAFF-|ID-|ID:)/i, ''));
      if (!isNaN(parsedId)) {
        user = await prisma.user.findFirst({
          where: { id: parsedId, status: 'Aktif' }
        });
      }
    } else if (cleanCode.startsWith('PIN-') || cleanCode.startsWith('PIN:')) {
      const parsedPin = cleanCode.replace(/^(PIN-|PIN:)/i, '');
      user = await prisma.user.findFirst({
        where: { pin: parsedPin, status: 'Aktif' }
      });
    } else {
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { pin: cleanCode },
            { username: cleanCode },
            { name: cleanCode }
          ],
          status: 'Aktif'
        }
      });
    }

    if (!user) {
      return res.status(401).json({ error: 'Kartu QR ID / Barcode tidak dikenali.' });
    }

    const authData = await generateAuthResponse(user.id, tenantId);

    // Audit Log: Quick PIN Switch
    await AuditLogger.log({
      tenantId: authData.user.tenantId,
      outletId: authData.user.outletId,
      userId: user.id,
      userName: user.name,
      userRole: authData.user.role,
      action: 'SWITCH_PIN',
      resource: 'AUTH',
      resourceId: String(user.id),
      description: `User ${user.name} beralih sesi menggunakan Quick PIN.`,
      severity: 'INFO'
    }, req);

    res.status(200).json({
      message: `Beralih ke pengguna: ${user.name}`,
      ...authData
    });

  } catch (error) {
    console.error('QR Login Error:', error);
    res.status(500).json({ error: 'Gagal memproses login QR ID' });
  }
});

// POST /api/auth/switch-tenant - Beralih konteks tenant aktif bagi user
router.post('/switch-tenant', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { tenantId, outletId } = req.body;

    if (!userId || !tenantId) {
      return res.status(400).json({ error: 'tenantId diperlukan.' });
    }

    // Cek apakah user memiliki membership aktif di tenant tujuan
    const membership = await prisma.tenantMembership.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId
        }
      },
      include: {
        tenant: {
          include: {
            outlets: true
          }
        }
      }
    });

    if (!membership || membership.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Anda tidak memiliki akses aktif ke tenant ini.' });
    }

    const authData = await generateAuthResponse(userId, tenantId);
    if (outletId) {
      authData.user.outletId = outletId;
      // Re-sign token with specified outlet
      authData.token = jwt.sign(
        {
          id: authData.user.id,
          username: authData.user.username,
          name: authData.user.name,
          role: authData.user.role,
          roleId: (authData.user as any).roleId,
          tenantId: authData.user.tenantId,
          outletId: outletId,
          permissions: authData.user.permissionKeys,
          isPlatformAdmin: authData.user.isPlatformAdmin
        },
        JWT_SECRET,
        { expiresIn: '30d' }
      );
    }

    // Audit Log: Switch Tenant
    await AuditLogger.log({
      tenantId: authData.user.tenantId,
      outletId: authData.user.outletId,
      userId: Number(userId),
      userName: authData.user.name,
      userRole: authData.user.role,
      action: 'SWITCH_TENANT',
      resource: 'AUTH',
      resourceId: tenantId,
      description: `User ${authData.user.name} beralih ke bisnis "${membership.tenant.name}".`,
      severity: 'INFO'
    }, req);

    res.json({
      message: `Beralih ke tenant: ${membership.tenant.name}`,
      ...authData
    });
  } catch (error) {
    console.error('Switch Tenant Error:', error);
    res.status(500).json({ error: 'Gagal beralih tenant.' });
  }
});

// POST /api/auth/switch-outlet - Beralih cabang/outlet aktif dalam tenant yang sama
router.post('/switch-outlet', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    const { outletId } = req.body;

    if (!user || !outletId) {
      return res.status(400).json({ error: 'outletId diperlukan.' });
    }

    const outlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId: user.tenantId, status: 'ACTIVE' }
    });

    if (!outlet) {
      return res.status(404).json({ error: 'Outlet cabang tidak ditemukan atau tidak aktif.' });
    }

    // Generate new JWT with updated outletId
    const newToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        roleId: (user as any).roleId,
        tenantId: user.tenantId,
        outletId: outlet.id,
        permissions: (user as any).permissions,
        isPlatformAdmin: (user as any).isPlatformAdmin
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Audit Log: Switch Outlet
    await AuditLogger.log({
      tenantId: user.tenantId,
      outletId: outlet.id,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'SWITCH_OUTLET',
      resource: 'AUTH',
      resourceId: outlet.id,
      description: `User ${user.name} beralih ke cabang "${outlet.name}" (${outlet.code}).`,
      severity: 'INFO'
    }, req);

    res.json({
      message: `Beralih ke outlet: ${outlet.name} (${outlet.code})`,
      token: newToken,
      outlet
    });
  } catch (err) {
    console.error('Switch Outlet Error:', err);
    res.status(500).json({ error: 'Gagal beralih outlet cabang.' });
  }
});

// GET /api/auth/check-slug - Realtime slug availability check (dipakai TenantRegisterWizard)
router.get('/check-slug', async (req: Request, res: Response) => {
  try {
    const rawSlug = (req.query.slug as string || '').trim().toLowerCase();
    if (!rawSlug) {
      return res.status(400).json({ available: false, error: 'Slug tidak boleh kosong.' });
    }

    const cleanSlug = rawSlug.replace(/[^a-z0-9-]/g, '');
    if (cleanSlug.length < 3) {
      return res.status(400).json({ available: false, error: 'Slug minimal 3 karakter.' });
    }
    if (cleanSlug.length > 40) {
      return res.status(400).json({ available: false, error: 'Slug maksimal 40 karakter.' });
    }

    const reserved = ['admin', 'api', 'app', 'www', 'mail', 'blog', 'demo', 'test', 'dev', 'staging', 'platform', 'pos', 'cafe', 'codenusa'];
    if (reserved.includes(cleanSlug)) {
      return res.status(200).json({ available: false, error: `Slug '${cleanSlug}' adalah nama reserved dan tidak dapat digunakan.` });
    }

    const existing = await prisma.tenant.findUnique({ where: { slug: cleanSlug } });
    if (existing) {
      // Beri 3 saran slug otomatis
      const suggestions = [
        `${cleanSlug}1`,
        `${cleanSlug}-toko`,
        `toko-${cleanSlug}`
      ];
      return res.status(200).json({
        available: false,
        error: `Subdomain '${cleanSlug}.codenusa.id' sudah digunakan bisnis lain.`,
        suggestions
      });
    }

    return res.status(200).json({
      available: true,
      slug: cleanSlug,
      message: `✅ '${cleanSlug}.codenusa.id' tersedia!`
    });
  } catch (error) {
    console.error('Check Slug Error:', error);
    res.status(500).json({ available: false, error: 'Gagal memeriksa ketersediaan slug.' });
  }
});

// POST /api/auth/register-tenant - Pendaftaran mandiri tenant baru (Onboarding Wizard)
router.post('/register-tenant', async (req: Request, res: Response) => {
  try {
    const {
      businessName,
      slug,
      planCode,
      outletName,
      outletCode,
      ownerName,
      ownerUsername,
      ownerPassword,
      ownerPin,
      businessType: rawBusinessType
    } = req.body;

    const normalizedType = String(rawBusinessType || 'CAFE').toUpperCase();
    const businessType = ['RETAIL', 'BENGKEL', 'LAUNDRY', 'CAFE'].includes(normalizedType) ? normalizedType : 'CAFE';

    if (!businessName || !slug || !ownerName || !ownerUsername || !ownerPassword) {
      return res.status(400).json({
        error: 'Mohon lengkapi seluruh field wajib: Nama Usaha, Subdomain Slug, Nama Owner, Username, dan Password.'
      });
    }

    // 1. Validasi keunikan Slug
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const existingTenant = await prisma.tenant.findUnique({ where: { slug: cleanSlug } });
    if (existingTenant) {
      return res.status(400).json({ error: `Subdomain slug '${cleanSlug}' sudah digunakan oleh bisnis lain.` });
    }

    // 2. Validasi keunikan Username (global uniqueness)
    const existingUser = await prisma.user.findFirst({ where: { username: ownerUsername.toLowerCase() } });
    if (existingUser) {
      return res.status(400).json({ error: `Username '${ownerUsername}' sudah terdaftar. Silakan gunakan username lain.` });
    }

    // 3. Tentukan Plan
    const targetPlan = await prisma.plan.findUnique({ where: { code: planCode || 'STARTER' } })
      || await prisma.plan.findFirst({ where: { code: 'STARTER' } });

    const passwordHash = await bcrypt.hash(ownerPassword, 10);
    const pin = ownerPin || '123456';

    // 4. Eksekusi Pendaftaran Transaksional
    const trialDays = 14;
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    const result = await prisma.$transaction(async (tx) => {
      // a. Buat Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: businessName,
          slug: cleanSlug,
          planId: targetPlan?.id,
          businessType,
          status: 'ACTIVE',
          trialEndsAt
        }
      });

      // b. Buat Outlet Utama
      const primaryOutlet = await tx.outlet.create({
        data: {
          tenantId: tenant.id,
          name: outletName || `${businessName} (Pusat)`,
          code: outletCode || 'OUT-01',
          status: 'ACTIVE'
        }
      });

      // c. Buat User Owner
      const user = await tx.user.create({
        data: {
          name: ownerName,
          username: ownerUsername.toLowerCase().trim(),
          passwordHash,
          pin,
          tenantId: tenant.id,
          role: 'OWNER',
          employmentType: 'FULL_TIME',
          permissions: JSON.stringify({
            canVoid: true,
            canDiscount: true,
            canEditMenu: true,
            canViewReports: true,
            canManageStaff: true
          }),
          status: 'Aktif'
        }
      });

      // d. Hubungkan Membership Owner — cari role global OWNER, fallback ke upsert
      let ownerRole = await tx.role.findFirst({
        where: { OR: [{ id: 'role-system-owner' }, { name: 'OWNER', tenantId: null }] }
      });
      if (!ownerRole) {
        // Fallback: buat role system OWNER jika belum ada (idempotent)
        ownerRole = await tx.role.upsert({
          where: { id: 'role-system-owner' },
          update: {},
          create: { id: 'role-system-owner', name: 'OWNER', tenantId: null }
        });
      }

      await tx.tenantMembership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          roleId: ownerRole.id,
          pin,
          employmentType: 'FULL_TIME',
          status: 'ACTIVE'
        }
      });

      // e. Inisialisasi TenantPaymentConfig
      await tx.tenantPaymentConfig.create({
        data: {
          tenantId: tenant.id,
          isMidtransEnabled: false,
          midtransMode: 'SANDBOX',
          enableQRIS: true,
          enableGoPay: true
        }
      });

      // f. Inisialisasi Settings Toko Default — gunakan nested connect agar kompatibel semua versi Prisma
      await tx.settings.create({
        data: {
          tenant: { connect: { id: tenant.id } },
          outlet: { connect: { id: primaryOutlet.id } },
          businessType,
          storeName: businessName,
          receiptHeader: businessType === 'RETAIL'
            ? `TOKO GROSIR & RETAIL\n${businessName}`
            : (businessType === 'BENGKEL'
              ? `BENGKEL MOTOR & MOBIL\n${businessName}`
              : (businessType === 'LAUNDRY'
                ? `LAUNDRY KILOAN & SATUAN\n${businessName}`
                : `Selamat Datang di ${businessName}`)),
          receiptFooter: 'Terima kasih atas kunjungan Anda!'
        }
      });

      // g. Inisialisasi Kategori & Produk Bawaan Sesuai Vertikal
      if (businessType === 'RETAIL') {
        const catSembako = await tx.category.create({
          data: { tenantId: tenant.id, name: 'Sembako & Beras', icon: '🌾', sortOrder: 1, printerTarget: 'NONE', stationTarget: 'NONE' }
        });
        const catBumbu = await tx.category.create({
          data: { tenantId: tenant.id, name: 'Minyak & Bumbu Dapur', icon: '🍳', sortOrder: 2, printerTarget: 'NONE', stationTarget: 'NONE' }
        });
        const catSnack = await tx.category.create({
          data: { tenantId: tenant.id, name: 'Minuman & Snack', icon: '☕', sortOrder: 3, printerTarget: 'NONE', stationTarget: 'NONE' }
        });

        // Produk Retail Sembako Awal
        await tx.product.createMany({
          data: [
            { tenantId: tenant.id, categoryId: catSembako.id, name: 'Beras Premium 5 Kg', barcode: '899100100001', buyPrice: 65000, sellPrice: 74000, sellPriceRetail: 74000, sellPriceGrosir: 71000, minQtyGrosir: 5, stock: 50, status: 'Aktif' },
            { tenantId: tenant.id, categoryId: catBumbu.id, name: 'Minyak Goreng 2 Liter', barcode: '899100100002', buyPrice: 32000, sellPrice: 36500, sellPriceRetail: 36500, sellPriceGrosir: 35000, minQtyGrosir: 6, stock: 40, status: 'Aktif' },
            { tenantId: tenant.id, categoryId: catSembako.id, name: 'Gula Pasir Kristal 1 Kg', barcode: '899100100003', buyPrice: 15500, sellPrice: 17500, sellPriceRetail: 17500, sellPriceGrosir: 16500, minQtyGrosir: 10, stock: 60, status: 'Aktif' },
            { tenantId: tenant.id, categoryId: catSembako.id, name: 'Telur Ayam Ras 1 Kg', barcode: '899100100004', buyPrice: 25000, sellPrice: 28500, sellPriceRetail: 28500, sellPriceGrosir: 27000, minQtyGrosir: 5, stock: 35, status: 'Aktif' },
            { tenantId: tenant.id, categoryId: catSnack.id, name: 'Kopi Kapal Api Renceng (10 sachet)', barcode: '899100100005', buyPrice: 12000, sellPrice: 14500, sellPriceRetail: 14500, sellPriceGrosir: 13500, minQtyGrosir: 10, stock: 80, status: 'Aktif' },
            { tenantId: tenant.id, categoryId: catSnack.id, name: 'Indomie Goreng (Dus/40pcs)', barcode: '899100100006', buyPrice: 108000, sellPrice: 118000, sellPriceRetail: 118000, sellPriceGrosir: 115000, minQtyGrosir: 3, stock: 25, status: 'Aktif' }
          ]
        });
      } else if (businessType === 'BENGKEL') {
        const catOli = await tx.category.create({
          data: { tenantId: tenant.id, name: 'Oli & Pelumas', icon: '🛢️', sortOrder: 1, printerTarget: 'NONE', stationTarget: 'NONE' }
        });
        const catPart = await tx.category.create({
          data: { tenantId: tenant.id, name: 'Sparepart & Suku Cadang', icon: '⚙️', sortOrder: 2, printerTarget: 'NONE', stationTarget: 'NONE' }
        });
        const catJasa = await tx.category.create({
          data: { tenantId: tenant.id, name: 'Jasa & Ongkos Servis', icon: '🔧', sortOrder: 3, printerTarget: 'NONE', stationTarget: 'NONE' }
        });

        await tx.product.createMany({
          data: [
            { tenantId: tenant.id, categoryId: catOli.id, name: 'Oli Mesin Matic 10W-40 0.8L', barcode: '899200100001', buyPrice: 42000, sellPrice: 55000, sellPriceRetail: 55000, sellPriceMitra: 50000, stock: 30, status: 'Aktif' },
            { tenantId: tenant.id, categoryId: catPart.id, name: 'Kampas Rem Depan Honda/Yamaha', barcode: '899200100002', buyPrice: 30000, sellPrice: 45000, sellPriceRetail: 45000, sellPriceMitra: 40000, stock: 20, status: 'Aktif' },
            { tenantId: tenant.id, categoryId: catPart.id, name: 'Busi Standar CPR9EA-9', barcode: '899200100003', buyPrice: 18000, sellPrice: 25000, sellPriceRetail: 25000, sellPriceMitra: 22000, stock: 25, status: 'Aktif' },
            { tenantId: tenant.id, categoryId: catJasa.id, name: 'Jasa Servis Ringan + Tune Up', barcode: '899200100004', buyPrice: 0, sellPrice: 40000, sellPriceRetail: 40000, sellPriceMitra: 35000, stock: 999, status: 'Aktif' }
          ]
        });
      } else if (businessType === 'LAUNDRY') {
        const catKiloan = await tx.category.create({
          data: { tenantId: tenant.id, name: 'Cuci Kiloan (Kg)', icon: '🧺', sortOrder: 1, printerTarget: 'NONE', stationTarget: 'NONE' }
        });
        const catSatuan = await tx.category.create({
          data: { tenantId: tenant.id, name: 'Cuci Satuan & Bedcover', icon: '👔', sortOrder: 2, printerTarget: 'NONE', stationTarget: 'NONE' }
        });

        await tx.product.createMany({
          data: [
            { tenantId: tenant.id, categoryId: catKiloan.id, name: 'Cuci Komplit Reguler (2 Hari)', barcode: '899300100001', buyPrice: 2000, sellPrice: 8000, stock: 999, status: 'Aktif' },
            { tenantId: tenant.id, categoryId: catKiloan.id, name: 'Cuci Kilat Express (1 Hari)', barcode: '899300100002', buyPrice: 3000, sellPrice: 14000, stock: 999, status: 'Aktif' },
            { tenantId: tenant.id, categoryId: catSatuan.id, name: 'Cuci Bedcover Besar', barcode: '899300100003', buyPrice: 5000, sellPrice: 35000, stock: 999, status: 'Aktif' }
          ]
        });
      } else {
        // Default CAFE
        const catFood = await tx.category.create({
          data: { tenantId: tenant.id, name: 'Makanan', printerTarget: 'KITCHEN' }
        });
        const catDrink = await tx.category.create({
          data: { tenantId: tenant.id, name: 'Minuman', printerTarget: 'BAR' }
        });

        await tx.table.createMany({
          data: [
            { tenantId: tenant.id, outletId: primaryOutlet.id, tableNo: '01', name: 'Area Utama', capacity: 4, posX: 20, posY: 30 },
            { tenantId: tenant.id, outletId: primaryOutlet.id, tableNo: '02', name: 'Area Utama', capacity: 4, posX: 50, posY: 30 },
            { tenantId: tenant.id, outletId: primaryOutlet.id, tableNo: '03', name: 'Area VIP', capacity: 6, posX: 80, posY: 30 }
          ]
        });
      }

      return { tenant, primaryOutlet, user };
    });

    // 5. Generate Auth Login Response Langsung
    const authData = await generateAuthResponse(result.user.id, result.tenant.id);

    // Audit Log: Register Tenant
    await AuditLogger.log({
      tenantId: result.tenant.id,
      outletId: result.primaryOutlet.id,
      userId: result.user.id,
      userName: result.user.name,
      userRole: 'OWNER',
      action: 'REGISTER_TENANT',
      resource: 'AUTH',
      resourceId: result.tenant.id,
      description: `Pendaftaran mandiri tenant "${result.tenant.name}" (${cleanSlug}.codenusa.id) sukses.`,
      severity: 'INFO'
    }, req);

    return res.status(201).json({
      message: `🎉 Selamat! Akun bisnis '${result.tenant.name}' berhasil dibuat. Selamat datang di Codenusa SaaS POS!`,
      ...authData
    });
  } catch (error: any) {
    console.error('Register Tenant Error:', error);
    res.status(500).json({ error: error.message || 'Gagal melakukan registrasi tenant baru.' });
  }
});

export default router;
