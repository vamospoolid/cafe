import prisma from '../db';
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken, AuthRequest } from '../middlewares/authMiddleware';
import { AuditLogger } from '../services/AuditLogger';

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
    m => requestedTenantId ? m.tenantId === requestedTenantId && m.status === 'ACTIVE' : m.status === 'ACTIVE'
  );

  // Jika belum ada membership aktif spesifik, ambil membership pertama user
  let activeTenantId = activeMembership?.tenantId || (user.isPlatformAdmin ? undefined : user.memberships[0]?.tenantId);
  let activeOutletId = activeMembership?.tenant?.outlets[0]?.id || user.memberships[0]?.tenant?.outlets[0]?.id;
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
    status: m.status,
    businessType: m.tenant.businessType || 'CAFE'
  }));

  return {
    token,
    user: {
      ...safeUser,
      tenantId: activeTenantId,
      outletId: activeOutletId,
      businessType: activeMembership?.tenant?.businessType || 'CAFE',
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
    const targetTenantId = tenantId || (req.headers['x-tenant-id'] as string);
    
    if (!pin) {
      return res.status(400).json({ error: 'PIN wajib diisi.' });
    }

    // USR-004: Fail-closed tenant scoping — hanya user dengan membership aktif di tenant ini
    const tenantFilter = targetTenantId ? {
      memberships: { some: { tenantId: targetTenantId, status: 'ACTIVE' } }
    } : {};

    const pinCondition = targetTenantId ? {
      OR: [
        { pin },
        { memberships: { some: { tenantId: targetTenantId, pin, status: 'ACTIVE' } } }
      ]
    } : { pin };

    let user;
    if (userId) {
      user = await prisma.user.findFirst({
        where: { id: Number(userId), status: 'Aktif', ...tenantFilter, ...pinCondition }
      });
    } else if (username) {
      user = await prisma.user.findFirst({
        where: { username, status: 'Aktif', ...tenantFilter, ...pinCondition }
      });
    } else {
      user = await prisma.user.findFirst({
        where: { status: 'Aktif', ...tenantFilter, ...pinCondition }
      });
    }

    if (!user) {
      return res.status(401).json({ error: 'PIN salah atau pengguna tidak terdaftar di outlet ini.' });
    }

    const authData = await generateAuthResponse(user.id, targetTenantId);

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
      return res.status(400).json({ error: 'Tenant context diperlukan untuk melihat daftar staf', code: 'MISSING_TENANT_CONTEXT' });
    }
    
    // USR-004: Fail-closed tenant scoping — hapus memberships: { none: {} }
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
    const targetTenantId = tenantId || (req.headers['x-tenant-id'] as string);
    if (!targetTenantId) {
      return res.status(400).json({ error: 'Tenant context diperlukan untuk login QR.', code: 'MISSING_TENANT_CONTEXT' });
    }

    if (!code) {
      return res.status(400).json({ error: 'Kode PIN / Barcode ID diperlukan.' });
    }

    const cleanCode = String(code).trim();
    let extractedPin: string | null = null;

    // Hanya ekstrak jika berupa format PIN explisit atau angka PIN murni
    if (cleanCode.startsWith('PIN-') || cleanCode.startsWith('PIN:')) {
      extractedPin = cleanCode.replace(/^(PIN-|PIN:)/i, '').trim();
    } else if (/^\d{4,8}$/.test(cleanCode)) {
      // Kode numerik PIN 4-8 digit
      extractedPin = cleanCode;
    }

    if (!extractedPin) {
      return res.status(401).json({ 
        error: 'Format QR/Barcode tidak valid. QR Login kasir wajib memuat PIN atau token keamanan terverifikasi.' 
      });
    }

    // Strict tenant scoping — hanya user dengan membership aktif di tenant target
    const tenantFilter = targetTenantId ? {
      memberships: { some: { tenantId: targetTenantId, status: 'ACTIVE' } }
    } : {};

    const user = await prisma.user.findFirst({
      where: {
        status: 'Aktif',
        pin: extractedPin,
        ...tenantFilter
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'PIN tidak valid atau staf tidak terdaftar pada kafe/outlet ini.' });
    }

    const authData = await generateAuthResponse(user.id, targetTenantId);

    // Audit Log: Quick PIN Switch via QR / Barcode
    await AuditLogger.log({
      tenantId: authData.user.tenantId,
      outletId: authData.user.outletId,
      userId: user.id,
      userName: user.name,
      userRole: authData.user.role,
      action: 'SWITCH_PIN',
      resource: 'AUTH',
      resourceId: String(user.id),
      description: `User ${user.name} berhasil login cepat via PIN / Barcode.`,
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

// GET /api/auth/check-slug - Cek ketersediaan subdomain / slug realtime
router.get('/check-slug', async (req: Request, res: Response) => {
  try {
    const rawSlug = (req.query.slug as string) || '';
    if (!rawSlug.trim()) {
      return res.status(400).json({ available: false, error: 'Slug tidak boleh kosong' });
    }

    const cleanSlug = rawSlug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    const reservedSlugs = ['app', 'api', 'admin', 'www', 'platform', 'platform-admin', 'system', 'root', 'login', 'pos', 'staff'];

    if (reservedSlugs.includes(cleanSlug)) {
      return res.json({
        available: false,
        slug: cleanSlug,
        error: `Subdomain '${cleanSlug}' adalah kata terpesan sistem.`,
        suggestions: [`${cleanSlug}-cafe`, `${cleanSlug}-pos`, `${cleanSlug}-01`]
      });
    }

    const existingTenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: cleanSlug },
          { name: { equals: rawSlug.trim(), mode: 'insensitive' } }
        ]
      }
    });

    if (existingTenant) {
      // Cari alternatif slug yang belum dipakai
      const alt1 = `${cleanSlug}-cafe`;
      const alt2 = `${cleanSlug}-01`;
      const alt3 = `${cleanSlug}-${Math.floor(100 + Math.random() * 900)}`;

      const checkAlts = await prisma.tenant.findMany({
        where: { slug: { in: [alt1, alt2, alt3] } },
        select: { slug: true }
      });
      const takenAlts = new Set(checkAlts.map(t => t.slug));
      const suggestions = [alt1, alt2, alt3].filter(s => !takenAlts.has(s));

      return res.json({
        available: false,
        slug: cleanSlug,
        error: `Subdomain '${cleanSlug}' sudah digunakan oleh kafe lain.`,
        suggestions
      });
    }

    return res.json({
      available: true,
      slug: cleanSlug,
      message: `Subdomain '${cleanSlug}.codenusa.id' tersedia!`
    });
  } catch (err) {
    console.error('Check Slug Error:', err);
    return res.status(500).json({ available: false, error: 'Gagal mengecek subdomain' });
  }
});

// POST /api/auth/register-tenant - Pendaftaran mandiri tenant baru (Onboarding Wizard)

router.post('/register-tenant', async (req: Request, res: Response) => {
  try {
    const {
      businessName,
      slug,
      planCode,
      businessType: rawBusinessType,
      outletName,
      outletCode,
      ownerName,
      ownerUsername,
      ownerPassword,
      ownerPin
    } = req.body;

    const rawUpper = String(rawBusinessType || '').toUpperCase();
    const businessType = ['BENGKEL', 'RETAIL', 'LAUNDRY'].includes(rawUpper) ? rawUpper : 'CAFE';

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
          businessType,
          logoUrl: '/logo.png',
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

      // e. Inisialisasi Kategori Bawaan & Layanan Sesuai Vertikal
      if (businessType === 'BENGKEL') {
        await tx.category.createMany({
          data: [
            { tenantId: tenant.id, name: 'Oli & Pelumas Mesin', printerTarget: 'NONE' },
            { tenantId: tenant.id, name: 'Suku Cadang Fast Moving', printerTarget: 'NONE' },
            { tenantId: tenant.id, name: 'Ban & Kaki-Kaki', printerTarget: 'NONE' },
            { tenantId: tenant.id, name: 'Aki & Kelistrikan', printerTarget: 'NONE' }
          ]
        });

        // Seed default Bengkel Service Types
        await tx.serviceType.createMany({
          data: [
            { tenantId: tenant.id, name: 'Ganti Oli Mesin', priceRetail: 20000, priceMitra: 15000, priceGrosir: 15000, vehicleType: 'ALL' },
            { tenantId: tenant.id, name: 'Tune Up Injeksi / Karburator', priceRetail: 65000, priceMitra: 50000, priceGrosir: 45000, vehicleType: 'MOTOR' },
            { tenantId: tenant.id, name: 'Servis CVT Lengkap', priceRetail: 65000, priceMitra: 50000, priceGrosir: 50000, vehicleType: 'MOTOR' },
            { tenantId: tenant.id, name: 'Ganti Kampas Rem Depan / Belakang', priceRetail: 25000, priceMitra: 20000, priceGrosir: 20000, vehicleType: 'ALL' },
            { tenantId: tenant.id, name: 'Servis Ringan + Pengecekan 12 Titik', priceRetail: 50000, priceMitra: 40000, priceGrosir: 35000, vehicleType: 'ALL' }
          ]
        });
      } else if (businessType === 'RETAIL') {
        await tx.category.createMany({
          data: [
            { tenantId: tenant.id, name: 'Sembako & Minyak', printerTarget: 'NONE' },
            { tenantId: tenant.id, name: 'Mie & Makanan Instan', printerTarget: 'NONE' },
            { tenantId: tenant.id, name: 'Minuman Karton & Dus', printerTarget: 'NONE' },
            { tenantId: tenant.id, name: 'Sabun & Kebersihan', printerTarget: 'NONE' },
            { tenantId: tenant.id, name: 'Bumbu Dapur & Sambal', printerTarget: 'NONE' },
            { tenantId: tenant.id, name: 'Rokok & Tembakau', printerTarget: 'NONE' }
          ]
        });

        // Inisialisasi Rak/Gudang Bawaan Retail
        await tx.table.createMany({
          data: [
            { tenantId: tenant.id, outletId: primaryOutlet.id, tableNo: 'RAK-01', name: 'Rak Depan (Sembako)', capacity: 1, posX: 20, posY: 30 },
            { tenantId: tenant.id, outletId: primaryOutlet.id, tableNo: 'RAK-02', name: 'Rak Tengah (Makanan & Snack)', capacity: 1, posX: 50, posY: 30 },
            { tenantId: tenant.id, outletId: primaryOutlet.id, tableNo: 'GDG-01', name: 'Gudang Belakang (Karton & Bal)', capacity: 1, posX: 80, posY: 30 }
          ]
        });
      } else if (businessType === 'LAUNDRY') {
        const catKiloan = await tx.category.create({
          data: { tenantId: tenant.id, name: 'Cuci Kiloan Reguler', printerTarget: 'NONE' }
        });
        const catKilat = await tx.category.create({
          data: { tenantId: tenant.id, name: 'Cuci Kilat & Express', printerTarget: 'NONE' }
        });
        const catSatuan = await tx.category.create({
          data: { tenantId: tenant.id, name: 'Cuci Satuan & Bedcover', printerTarget: 'NONE' }
        });
        const catDryClean = await tx.category.create({
          data: { tenantId: tenant.id, name: 'Dry Clean & Perawatan Sepatu', printerTarget: 'NONE' }
        });

        // Inisialisasi Auto-Seed Produk Bawaan Laundry Lengkap
        await tx.product.createMany({
          data: [
            // Cuci Kiloan Reguler
            { tenantId: tenant.id, categoryId: catKiloan.id, name: 'Cuci Kering Setrika (Reguler)', sellPrice: 7000, buyPrice: 2000, baseUom: 'Kg', stock: 999, minStock: 5, status: 'Aktif' },
            { tenantId: tenant.id, categoryId: catKiloan.id, name: 'Cuci Lipat Kering (Non Setrika)', sellPrice: 5000, buyPrice: 1500, baseUom: 'Kg', stock: 999, minStock: 5, status: 'Aktif' },
            { tenantId: tenant.id, categoryId: catKiloan.id, name: 'Setrika Rapi Saja', sellPrice: 4500, buyPrice: 1200, baseUom: 'Kg', stock: 999, minStock: 5, status: 'Aktif' },
            { tenantId: tenant.id, categoryId: catKiloan.id, name: 'Cuci Basah Bersih', sellPrice: 3500, buyPrice: 1000, baseUom: 'Kg', stock: 999, minStock: 5, status: 'Aktif' },
            // Cuci Kilat & Express
            { tenantId: tenant.id, categoryId: catKilat.id, name: 'Cuci Kering Setrika (Kilat 24 Jam)', sellPrice: 10000, buyPrice: 2500, baseUom: 'Kg', stock: 999, minStock: 5, status: 'Aktif' },
            { tenantId: tenant.id, categoryId: catKilat.id, name: 'Cuci Express 6 Jam', sellPrice: 15000, buyPrice: 3500, baseUom: 'Kg', stock: 999, minStock: 5, status: 'Aktif' },
            // Cuci Satuan & Bedcover
            { tenantId: tenant.id, categoryId: catSatuan.id, name: 'Bedcover King / Jumbo', sellPrice: 25000, buyPrice: 6000, baseUom: 'Pcs', stock: 999, minStock: 5, status: 'Aktif' },
            { tenantId: tenant.id, categoryId: catSatuan.id, name: 'Bedcover Single / Sedang', sellPrice: 20000, buyPrice: 5000, baseUom: 'Pcs', stock: 999, minStock: 5, status: 'Aktif' },
            { tenantId: tenant.id, categoryId: catSatuan.id, name: 'Selimut Tebal / Fleece', sellPrice: 15000, buyPrice: 4000, baseUom: 'Pcs', stock: 999, minStock: 5, status: 'Aktif' },
            { tenantId: tenant.id, categoryId: catSatuan.id, name: 'Sprei Set + Sarung Bantal', sellPrice: 12000, buyPrice: 3000, baseUom: 'Pcs', stock: 999, minStock: 5, status: 'Aktif' },
            // Dry Clean & Sepatu
            { tenantId: tenant.id, categoryId: catDryClean.id, name: 'Jas Pria / Blazer Kerja', sellPrice: 30000, buyPrice: 7000, baseUom: 'Pcs', stock: 999, minStock: 5, status: 'Aktif' },
            { tenantId: tenant.id, categoryId: catDryClean.id, name: 'Gamis / Gaun Panjang', sellPrice: 25000, buyPrice: 6000, baseUom: 'Pcs', stock: 999, minStock: 5, status: 'Aktif' },
            { tenantId: tenant.id, categoryId: catDryClean.id, name: 'Sepatu Sneakers / Canvas', sellPrice: 35000, buyPrice: 8000, baseUom: 'Pcs', stock: 999, minStock: 5, status: 'Aktif' },
            { tenantId: tenant.id, categoryId: catDryClean.id, name: 'Tas Ransel / Backpack', sellPrice: 25000, buyPrice: 6000, baseUom: 'Pcs', stock: 999, minStock: 5, status: 'Aktif' }
          ]
        });

        // Inisialisasi Rak Penyimpanan Cucian
        await tx.table.createMany({
          data: [
            { tenantId: tenant.id, outletId: primaryOutlet.id, tableNo: 'RAK-A1', name: 'Rak A1 (Cucian Siap Ambil)', capacity: 1, posX: 20, posY: 30 },
            { tenantId: tenant.id, outletId: primaryOutlet.id, tableNo: 'RAK-A2', name: 'Rak A2 (Cucian Siap Ambil)', capacity: 1, posX: 50, posY: 30 },
            { tenantId: tenant.id, outletId: primaryOutlet.id, tableNo: 'RAK-B1', name: 'Rak B1 (Cucian Siap Ambil)', capacity: 1, posX: 80, posY: 30 },
            { tenantId: tenant.id, outletId: primaryOutlet.id, tableNo: 'RAK-B2', name: 'Rak B2 (Cucian Siap Ambil)', capacity: 1, posX: 20, posY: 60 },
            { tenantId: tenant.id, outletId: primaryOutlet.id, tableNo: 'HANGER-01', name: 'Gantungan Jas & Bedcover', capacity: 1, posX: 50, posY: 60 }
          ]
        });

        // Inisialisasi Bahan Kimia & Operasional Awal
        await tx.ingredient.createMany({
          data: [
            { tenantId: tenant.id, name: 'Deterjen Cair Konsentrat Super', unit: 'liter', stock: 50, minStock: 10, buyPrice: 12000 },
            { tenantId: tenant.id, name: 'Pewangi Parfum Sakura', unit: 'liter', stock: 20, minStock: 5, buyPrice: 28000 },
            { tenantId: tenant.id, name: 'Pewangi Parfum Akasia', unit: 'liter', stock: 20, minStock: 5, buyPrice: 28000 },
            { tenantId: tenant.id, name: 'Softener / Pelembut Blue Fresh', unit: 'liter', stock: 30, minStock: 5, buyPrice: 15000 },
            { tenantId: tenant.id, name: 'Plastik Jinjing HD Size L', unit: 'pack', stock: 50, minStock: 10, buyPrice: 18000 }
          ]
        });
      } else {
        await tx.category.create({
          data: { tenantId: tenant.id, name: 'Makanan', printerTarget: 'KITCHEN' }
        });
        await tx.category.create({
          data: { tenantId: tenant.id, name: 'Minuman', printerTarget: 'BAR' }
        });

        // Inisialisasi Meja Bawaan Cafe
        await tx.table.createMany({
          data: [
            { tenantId: tenant.id, outletId: primaryOutlet.id, tableNo: '01', name: 'Area Utama', capacity: 4, posX: 20, posY: 30 },
            { tenantId: tenant.id, outletId: primaryOutlet.id, tableNo: '02', name: 'Area Utama', capacity: 4, posX: 50, posY: 30 },
            { tenantId: tenant.id, outletId: primaryOutlet.id, tableNo: '03', name: 'Area VIP', capacity: 6, posX: 80, posY: 30 }
          ]
        });
      }

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
          logoUrl: '/logo.png',
          receiptHeader: businessType === 'BENGKEL'
            ? `Selamat Datang di ${businessName} (Workshop & Servis)`
            : (businessType === 'RETAIL' 
                ? `Selamat Datang di ${businessName} (Grosir & Retail)` 
                : (businessType === 'LAUNDRY' 
                    ? `Selamat Datang di ${businessName} (Laundry Kiloan & Satuan)` 
                    : `Selamat Datang di ${businessName}`)),
          receiptFooter: businessType === 'BENGKEL'
            ? 'Garansi servis berlaku 7 hari kerja. Terima kasih!'
            : (businessType === 'RETAIL' 
                ? 'Barang yang sudah dibeli dapat ditukar maksimal 2x24 jam dengan nota resmi. Terima kasih!' 
                : (businessType === 'LAUNDRY' 
                    ? 'Nota laundry wajib dibawa saat pengambilan cucian. Klaim maksimal 1x24 jam. Terima kasih!' 
                    : 'Terima kasih atas kunjungan Anda!'))
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
