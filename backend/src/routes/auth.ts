import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { AuditLogger } from '../services/AuditLogger';

const router = Router();
const prisma = new PrismaClient();
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
    m => requestedTenantId ? m.tenantId === requestedTenantId && m.status === 'ACTIVE' : m.status === 'ACTIVE'
  );

  // Jika belum ada membership terdaftar, fallback ke default tenant
  let activeTenantId = activeMembership?.tenantId || 'tenant-default-muki';
  let activeOutletId = activeMembership?.tenant.outlets[0]?.id || 'outlet-default-muki-01';
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
    isPlatformAdmin: user.isPlatformAdmin
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });

  const { passwordHash, ...safeUser } = user;

  const membershipsList = user.memberships.map(m => ({
    tenantId: m.tenantId,
    tenantName: m.tenant.name,
    tenantSlug: m.tenant.slug,
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

    const user = await prisma.user.findUnique({
      where: { username }
    });

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

    // Resolusi tenant jika disediakan
    let requestedTenantId: string | undefined;
    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) requestedTenantId = tenant.id;
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
    const tenantId = (req.query.tenantId as string) || 'tenant-default-muki';
    
    const staff = await prisma.user.findMany({
      where: {
        status: 'Aktif',
        OR: [
          { memberships: { some: { tenantId, status: 'ACTIVE' } } },
          { memberships: { none: {} } }
        ]
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
      ownerPin
    } = req.body;

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

    // 2. Validasi keunikan Username
    const existingUser = await prisma.user.findUnique({ where: { username: ownerUsername } });
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
          username: ownerUsername,
          passwordHash,
          pin,
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

      // d. Hubungkan Membership Owner
      const ownerRole = await tx.role.findFirst({
        where: { OR: [{ id: 'role-system-owner' }, { name: 'OWNER' }] }
      });

      await tx.tenantMembership.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          roleId: ownerRole?.id || 'role-system-owner',
          pin,
          employmentType: 'FULL_TIME',
          status: 'ACTIVE'
        }
      });

      // e. Inisialisasi Kategori Bawaan
      const catFood = await tx.category.create({
        data: { tenantId: tenant.id, name: 'Makanan', printerTarget: 'KITCHEN' }
      });
      const catDrink = await tx.category.create({
        data: { tenantId: tenant.id, name: 'Minuman', printerTarget: 'BAR' }
      });

      // f. Inisialisasi Meja Bawaan
      await tx.table.createMany({
        data: [
          { tenantId: tenant.id, outletId: primaryOutlet.id, tableNo: '01', name: 'Area Utama', capacity: 4, posX: 20, posY: 30 },
          { tenantId: tenant.id, outletId: primaryOutlet.id, tableNo: '02', name: 'Area Utama', capacity: 4, posX: 50, posY: 30 },
          { tenantId: tenant.id, outletId: primaryOutlet.id, tableNo: '03', name: 'Area VIP', capacity: 6, posX: 80, posY: 30 }
        ]
      });

      // g. Inisialisasi TenantPaymentConfig
      await tx.tenantPaymentConfig.create({
        data: {
          tenantId: tenant.id,
          isMidtransEnabled: false,
          midtransMode: 'SANDBOX',
          enableQRIS: true,
          enableGoPay: true
        }
      });

      // h. Inisialisasi Settings Toko Default
      await tx.settings.create({
        data: {
          tenantId: tenant.id,
          outletId: primaryOutlet.id,
          storeName: businessName,
          receiptHeader: `Selamat Datang di ${businessName}`,
          receiptFooter: 'Terima kasih atas kunjungan Anda!'
        }
      });

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
