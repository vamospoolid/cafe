import prisma from '../db';
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken, requirePermission } from '../middlewares/authMiddleware';
import { AuditLogger } from '../services/AuditLogger';
import { TenantContext } from '../utils/tenantContext';
import { invalidateTenantCache } from '../middlewares/tenantResolver';
import { cacheService } from '../services/CacheService';
import { whatsAppTemplateService } from '../services/WhatsAppTemplateService';

const router = Router();

// Helper to strictly resolve tenantId from token, header, or async context
const resolveSettingsTenantId = (req: Request): string | undefined => {
  return (req as any).user?.tenantId || 
         (req as any).tenantId || 
         (req.headers['x-tenant-id'] as string) || 
         TenantContext.getTenantId() || 
         undefined;
};

// GET /api/settings/public - Public store branding resolver
router.get('/public', async (req: Request, res: Response) => {
  try {
    const tenantQuery = (req.query.tenant as string) || (req.query.username as string) || (req.query.tenantId as string);
    const tableId = req.query.tableId as string;
    let tenant = null;

    if (tenantQuery) {
      const clean = tenantQuery.trim().toLowerCase();
      tenant = await prisma.tenant.findFirst({
        where: {
          OR: [
            { slug: clean },
            { id: clean },
            { name: { contains: clean, mode: 'insensitive' } },
            { memberships: { some: { user: { username: clean } } } }
          ]
        },
        include: { settings: true }
      });
    }

    if (!tenant && tableId) {
      const numTableId = Number(tableId);
      if (!isNaN(numTableId)) {
        const table = await prisma.table.findUnique({
          where: { id: numTableId },
          include: { tenant: { include: { settings: true } } }
        });
        if (table?.tenant) {
          tenant = table.tenant;
        }
      }
    }

    if (!tenant) {
      const { resolveTenantFromRequest } = require('../middlewares/tenantResolver');
      const resolved = await resolveTenantFromRequest(req);
      if (resolved) {
        tenant = await prisma.tenant.findUnique({
          where: { id: resolved.id },
          include: { settings: true }
        });
      }
    }

    const settings = tenant?.settings?.[0] || await prisma.settings.findFirst({
      where: tenant ? { tenantId: tenant.id } : undefined
    });

    const storeName = settings?.storeName || tenant?.name || 'CodePOS Platform';
    const logoUrl = settings?.logoUrl || tenant?.logoUrl || '/logo.png';

    res.setHeader('Cache-Control', 'public, max-age=180');

    return res.json({
      storeName,
      logoUrl,
      tenantSlug: tenant?.slug || 'platform',
      tenantName: tenant?.name || storeName,
      address: settings?.address || '',
      primaryColor: settings?.primaryColor || '#4f46e5',
      accentColor: settings?.accentColor || '#f59e0b',
      loginLayout: settings?.loginLayout || 'split_modern',
      loginCoverUrl: settings?.loginCoverUrl || '/assets/images/cafe_login_cover.png',
      loginTagline: settings?.loginTagline || '',
      faviconUrl: settings?.faviconUrl || null,
      hidePlatformBranding: Boolean(settings?.hidePlatformBranding)
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Gagal memuat branding publik' });
  }
});

// Get settings (Tenant Scoped)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = resolveSettingsTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }

    let settings = await prisma.settings.findFirst({
      where: { tenantId }
    });
    
    // If no settings exist yet for this tenant, create dynamic default from tenant profile
    if (!settings) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId }
      });

      const tenantOutlet = await prisma.outlet.findFirst({
        where: { tenantId }
      });

      const initialStoreName = tenant?.name || 'Kafe Mitra';
      const initialAddress = tenantOutlet?.address || '';
      const initialPhone = tenantOutlet?.phone || '';
      const initialLogo = tenant?.logoUrl || '/logo.png';
      const initialLat = tenantOutlet?.latitude || -6.200000;
      const initialLng = tenantOutlet?.longitude || 106.816666;

      settings = await prisma.settings.create({
        data: {
          tenantId,
          storeName: initialStoreName,
          phone: initialPhone,
          address: initialAddress,
          logoUrl: initialLogo,
          taxRate: 0,
          serviceCharge: 0,
          receiptHeader: initialAddress ? `${initialStoreName}\n${initialAddress}` : initialStoreName,
          receiptFooter: 'Terima kasih atas kunjungan Anda!\nSilakan datang kembali',
          storeLatitude: initialLat,
          storeLongitude: initialLng,
          gpsRadiusMeters: 200,
          profitSharingOwnerPercent: 80,
          enableProfitSharing: false,
          profitSharingRamenPercent: 20,
          profitSharingDrinkPercent: 20,
          profitSharingOpexMode: 'BEFORE_SPLIT',
          enableDailyOmzetBonus: false,
          dailyOmzetTiers: JSON.stringify([
            { minOmzet: 2500000, bonus: 5000 },
            { minOmzet: 3000000, bonus: 10000 },
            { minOmzet: 4000000, bonus: 15000 },
            { minOmzet: 5000000, bonus: 20000 },
            { minOmzet: 6000000, bonus: 25000 }
          ]),
        }
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessType: true }
    });
    
    res.json({
      ...settings,
      businessType: tenant?.businessType || 'CAFE'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Gagal mengambil pengaturan toko' });
  }
});

// Update settings
router.put('/', authenticateToken, requirePermission('settings.manage'), async (req: Request, res: Response) => {
  try {
    const data = req.body;
    
    // Remove ID if present to avoid updating primary key issues
    const { id, ...updateData } = data;
    
    // Convert string numbers to float for safety
    if (updateData.taxRate !== undefined) updateData.taxRate = Number(updateData.taxRate);
    if (updateData.serviceCharge !== undefined) updateData.serviceCharge = Number(updateData.serviceCharge);
    if (updateData.loyaltyEarnPerAmount !== undefined) updateData.loyaltyEarnPerAmount = Number(updateData.loyaltyEarnPerAmount);
    if (updateData.loyaltyPointValue !== undefined) updateData.loyaltyPointValue = Number(updateData.loyaltyPointValue);
    if (updateData.loyaltySilverThreshold !== undefined) updateData.loyaltySilverThreshold = Number(updateData.loyaltySilverThreshold);
    if (updateData.loyaltyGoldThreshold !== undefined) updateData.loyaltyGoldThreshold = Number(updateData.loyaltyGoldThreshold);
    if (updateData.loyaltySilverMultiplier !== undefined) updateData.loyaltySilverMultiplier = Number(updateData.loyaltySilverMultiplier);
    if (updateData.loyaltyGoldMultiplier !== undefined) updateData.loyaltyGoldMultiplier = Number(updateData.loyaltyGoldMultiplier);
    
    if (updateData.ingredientTrackingEnabled !== undefined) updateData.ingredientTrackingEnabled = Boolean(updateData.ingredientTrackingEnabled);
    if (updateData.enableKitchenAuditMode !== undefined) updateData.enableKitchenAuditMode = Boolean(updateData.enableKitchenAuditMode);
    if (updateData.enableStaffMealTracking !== undefined) updateData.enableStaffMealTracking = Boolean(updateData.enableStaffMealTracking);
    if (updateData.enableBlindClose !== undefined) updateData.enableBlindClose = Boolean(updateData.enableBlindClose);
    
    if (updateData.enableKDS !== undefined) updateData.enableKDS = Boolean(updateData.enableKDS);
    if (updateData.autoCompleteKDSOnPay !== undefined) updateData.autoCompleteKDSOnPay = Boolean(updateData.autoCompleteKDSOnPay);
    if (updateData.autoPrintReceipt !== undefined) updateData.autoPrintReceipt = Boolean(updateData.autoPrintReceipt);
    if (updateData.enableTieredPricing !== undefined) updateData.enableTieredPricing = Boolean(updateData.enableTieredPricing);
    if (updateData.autoPrintKitchen !== undefined) updateData.autoPrintKitchen = Boolean(updateData.autoPrintKitchen);
    if (updateData.autoPrintBar !== undefined) updateData.autoPrintBar = Boolean(updateData.autoPrintBar);

    if (updateData.receiptShowCashier !== undefined) updateData.receiptShowCashier = Boolean(updateData.receiptShowCashier);
    if (updateData.receiptShowTable !== undefined) updateData.receiptShowTable = Boolean(updateData.receiptShowTable);

    if (updateData.storeLatitude !== undefined) updateData.storeLatitude = Number(updateData.storeLatitude);
    if (updateData.storeLongitude !== undefined) updateData.storeLongitude = Number(updateData.storeLongitude);
    if (updateData.gpsRadiusMeters !== undefined) updateData.gpsRadiusMeters = Number(updateData.gpsRadiusMeters);
    if (updateData.enableGpsValidation !== undefined) updateData.enableGpsValidation = Boolean(updateData.enableGpsValidation);
    if (updateData.enableCameraPhoto !== undefined) updateData.enableCameraPhoto = Boolean(updateData.enableCameraPhoto);
    if (updateData.workShifts !== undefined && typeof updateData.workShifts !== 'string') {
      updateData.workShifts = JSON.stringify(updateData.workShifts);
    }

    // Jam Operasional Outlet & Kontrol Shift Kasir
    if (updateData.operatingHours !== undefined && typeof updateData.operatingHours !== 'string') {
      updateData.operatingHours = JSON.stringify(updateData.operatingHours);
    }
    if (updateData.earlyOpenBufferMinutes !== undefined) updateData.earlyOpenBufferMinutes = Number(updateData.earlyOpenBufferMinutes);
    if (updateData.closingGraceMinutes !== undefined) updateData.closingGraceMinutes = Number(updateData.closingGraceMinutes);
    if (updateData.enforceOperatingHours !== undefined) updateData.enforceOperatingHours = Boolean(updateData.enforceOperatingHours);
    if (updateData.allowOrdersAfterClose !== undefined) updateData.allowOrdersAfterClose = Boolean(updateData.allowOrdersAfterClose);

    // Reward & Punishment Karyawan
    if (updateData.enableZeroLateBonus !== undefined) updateData.enableZeroLateBonus = Boolean(updateData.enableZeroLateBonus);
    if (updateData.zeroLateBonusAmount !== undefined) updateData.zeroLateBonusAmount = Number(updateData.zeroLateBonusAmount);
    if (updateData.zeroLateMinAttendance !== undefined) updateData.zeroLateMinAttendance = Number(updateData.zeroLateMinAttendance);
    if (updateData.zeroLateMaxLateAllowed !== undefined) updateData.zeroLateMaxLateAllowed = Number(updateData.zeroLateMaxLateAllowed);
    if (updateData.enableLatePenalty !== undefined) updateData.enableLatePenalty = Boolean(updateData.enableLatePenalty);
    if (updateData.latePenaltyType !== undefined) updateData.latePenaltyType = String(updateData.latePenaltyType);
    if (updateData.latePenaltyAmount !== undefined) updateData.latePenaltyAmount = Number(updateData.latePenaltyAmount);
    if (updateData.enableAlphaPenalty !== undefined) updateData.enableAlphaPenalty = Boolean(updateData.enableAlphaPenalty);
    if (updateData.alphaPenaltyAmount !== undefined) updateData.alphaPenaltyAmount = Number(updateData.alphaPenaltyAmount);

    // Warehouse & Transfer Pricing
    if (updateData.warehouseTransferPricing !== undefined) updateData.warehouseTransferPricing = String(updateData.warehouseTransferPricing);
    if (updateData.warehouseMarkupPercent !== undefined) updateData.warehouseMarkupPercent = Number(updateData.warehouseMarkupPercent);

    // Konfigurasi Bagi Hasil (Profit Sharing)
    if (updateData.enableProfitSharing !== undefined) updateData.enableProfitSharing = Boolean(updateData.enableProfitSharing);
    if (updateData.profitSharingOwnerPercent !== undefined) updateData.profitSharingOwnerPercent = Number(updateData.profitSharingOwnerPercent);
    if (updateData.profitSharingRamenPercent !== undefined) updateData.profitSharingRamenPercent = Number(updateData.profitSharingRamenPercent);
    if (updateData.profitSharingDrinkPercent !== undefined) updateData.profitSharingDrinkPercent = Number(updateData.profitSharingDrinkPercent);
    if (updateData.profitSharingOpexMode !== undefined) updateData.profitSharingOpexMode = String(updateData.profitSharingOpexMode);

    // Konfigurasi Bonus Omzet Harian
    if (updateData.enableDailyOmzetBonus !== undefined) updateData.enableDailyOmzetBonus = Boolean(updateData.enableDailyOmzetBonus);
    if (updateData.dailyOmzetTiers !== undefined && typeof updateData.dailyOmzetTiers !== 'string') {
      updateData.dailyOmzetTiers = JSON.stringify(updateData.dailyOmzetTiers);
    }

    // Dynamic White-Label Theming & Login Layout Validation (Anti-XSS & Safety)
    const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (updateData.primaryColor !== undefined) {
      const color = String(updateData.primaryColor).trim();
      if (!HEX_COLOR_REGEX.test(color)) {
        return res.status(400).json({ error: 'Format warna primer tidak valid. Gunakan format HEX (misal: #4f46e5).' });
      }
      updateData.primaryColor = color;
    }
    if (updateData.accentColor !== undefined) {
      const color = String(updateData.accentColor).trim();
      if (!HEX_COLOR_REGEX.test(color)) {
        return res.status(400).json({ error: 'Format warna aksen tidak valid. Gunakan format HEX (misal: #f59e0b).' });
      }
      updateData.accentColor = color;
    }
    if (updateData.loginLayout !== undefined) {
      const allowedLayouts = ['split_modern', 'centered_glass', 'minimal_luxe', 'cafe_atmosphere'];
      const layout = String(updateData.loginLayout).trim();
      if (!allowedLayouts.includes(layout)) {
        return res.status(400).json({ error: 'Preset layout login tidak dikenali. Pilihan: split_modern, centered_glass, minimal_luxe, cafe_atmosphere.' });
      }
      updateData.loginLayout = layout;
    }
    if (updateData.loginCoverUrl !== undefined) updateData.loginCoverUrl = String(updateData.loginCoverUrl);
    if (updateData.loginTagline !== undefined) updateData.loginTagline = String(updateData.loginTagline).slice(0, 200);
    if (updateData.faviconUrl !== undefined) updateData.faviconUrl = updateData.faviconUrl ? String(updateData.faviconUrl) : null;
    if (updateData.hidePlatformBranding !== undefined) updateData.hidePlatformBranding = Boolean(updateData.hidePlatformBranding);

    const tenantId = resolveSettingsTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context tidak tersedia. Silakan login ulang.', code: 'MISSING_TENANT_CONTEXT' });
    }

    // Whitelist scalar fields of Prisma model Settings to prevent crash on non-schema fields (businessType, id, tenantId, etc.)
    const SETTINGS_SCALAR_FIELDS = new Set([
      'storeName', 'phone', 'address', 'logoUrl', 'receiptHeader', 'receiptFooter',
      'receiptPaperSize', 'wifiName', 'wifiPassword', 'receiptShowCashier', 'receiptShowTable',
      'taxRate', 'serviceCharge', 'includeTax', 'bankName', 'accountNumber', 'accountName',
      'qrisUrl', 'qrCodeBaseUrl', 'enableDrinkCustomization', 'loyaltyEnabled', 'loyaltyEarnPerAmount',
      'loyaltyPointValue', 'loyaltySilverThreshold', 'loyaltyGoldThreshold', 'loyaltySilverMultiplier',
      'loyaltyGoldMultiplier', 'ingredientTrackingEnabled', 'enableKitchenAuditMode', 'enableStaffMealTracking',
      'printerIp', 'printerPort', 'windowsPrinterName', 'autoPrintKDS', 'autoPrintReceipt',
      'kitchenPrinterIp', 'kitchenPrinterPort', 'autoPrintKitchen', 'barPrinterIp', 'barPrinterPort',
      'autoPrintBar', 'enableKDS', 'autoCompleteKDSOnPay', 'storeLatitude', 'storeLongitude',
      'gpsRadiusMeters', 'enableGpsValidation', 'enableCameraPhoto', 'googleMapsUrl', 'workShifts', 'enableZeroLateBonus',
      'zeroLateBonusAmount', 'zeroLateMinAttendance', 'zeroLateMaxLateAllowed', 'enableLatePenalty',
      'latePenaltyType', 'latePenaltyAmount', 'enableAlphaPenalty', 'alphaPenaltyAmount',
      'warehouseTransferPricing', 'warehouseMarkupPercent', 'enableProfitSharing',
      'profitSharingOwnerPercent', 'profitSharingRamenPercent', 'profitSharingDrinkPercent',
      'profitSharingOpexMode', 'enableDailyOmzetBonus', 'dailyOmzetTiers', 'operatingHours',
      'earlyOpenBufferMinutes', 'closingGraceMinutes', 'enforceOperatingHours', 'allowOrdersAfterClose',
      'primaryColor', 'accentColor', 'loginLayout', 'loginCoverUrl', 'loginTagline', 'faviconUrl',
      'hidePlatformBranding'
    ]);

    const sanitizedData: Record<string, any> = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (SETTINGS_SCALAR_FIELDS.has(key)) {
        sanitizedData[key] = value;
      }
    }

    let settings = await prisma.settings.findFirst({
      where: { tenantId }
    });
    const oldSettings = settings ? { ...settings } : null;
    
    if (settings) {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: sanitizedData
      });
    } else {
      settings = await prisma.settings.create({
        data: {
          ...sanitizedData,
          tenantId
        }
      });
    }

    // Audit Log: Settings Update
    await AuditLogger.log({
      action: 'SETTINGS_UPDATE',
      resource: 'SETTINGS',
      resourceId: String(settings.id),
      description: `Memperbarui konfigurasi toko / hardware (${settings.storeName}).`,
      oldValue: oldSettings,
      newValue: sanitizedData,
      severity: 'WARNING'
    }, req);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { businessType: true }
    });

    res.json({
      ...settings,
      businessType: tenant?.businessType || 'CAFE'
    });
  } catch (error: any) {
    console.error('Settings update error:', error);
    res.status(500).json({ error: 'Gagal menyimpan pengaturan toko: ' + (error?.message || 'Internal error') });
  }
});

/**
 * POST /api/settings/migrate-vertical
 * Transisi Terpandu Profil Bisnis (Kafe <-> Bengkel <-> Retail)
 * Akses: Hanya role OWNER atau PLATFORM_ADMIN dengan validasi password.
 */
router.post('/migrate-vertical', authenticateToken, requirePermission('settings.manage'), async (req: Request, res: Response) => {
  try {
    const tenantId = resolveSettingsTenantId(req);
    const user = (req as any).user;
    const userId = user?.id;

    if (!tenantId || !userId) {
      return res.status(400).json({ error: 'Konteks sesi atau tenant tidak valid.' });
    }

    // Layer 1: Role check (OWNER or Platform Admin)
    const userRole = (user?.role || '').toUpperCase();
    if (userRole !== 'OWNER' && !user?.isPlatformAdmin) {
      return res.status(403).json({ error: 'Akses Ditolak: Hanya Akun Owner yang berhak melakukan migrasi jenis bisnis.' });
    }

    const { targetBusinessType, password, migrationStrategy = 'CLEAN_PIVOT' } = req.body;

    if (!['CAFE', 'BENGKEL', 'RETAIL', 'LAUNDRY'].includes(targetBusinessType)) {
      return res.status(400).json({ error: 'Jenis bisnis target tidak valid. Pilihan: CAFE, BENGKEL, RETAIL, LAUNDRY.' });
    }

    // Layer 2: Password Challenge
    if (!password) {
      return res.status(400).json({ error: 'Kata sandi akun Owner wajib diisi untuk otorisasi migrasi bisnis.' });
    }

    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) {
      return res.status(404).json({ error: 'Data user tidak ditemukan.' });
    }

    const isMatch = await bcrypt.compare(password, currentUser.passwordHash);
    if (!isMatch && currentUser.pin !== password) {
      return res.status(401).json({ error: 'Kata sandi / PIN otorisasi salah. Migrasi dibatalkan demi keamanan data.' });
    }

    // Cek tenant saat ini
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, businessType: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant tidak ditemukan.' });
    }

    const currentBusinessType = tenant.businessType || 'CAFE';
    if (currentBusinessType === targetBusinessType) {
      return res.status(400).json({ error: `Bisnis Anda saat ini sudah terdaftar sebagai profil [${targetBusinessType}].` });
    }

    // Eksekusi migrasi transaksional
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update businessType pada tenant
      const updatedTenant = await tx.tenant.update({
        where: { id: tenantId },
        data: { businessType: targetBusinessType }
      });

      // 2. Jika CLEAN_PIVOT, nonaktifkan kategori lama & sediakan starter categories baru
      let newCategoriesCount = 0;
      let newServicesCount = 0;

      if (migrationStrategy === 'CLEAN_PIVOT') {
        // Nonaktifkan kategori lama
        await tx.category.updateMany({
          where: { tenantId },
          data: { isActive: false }
        });

        if (targetBusinessType === 'BENGKEL') {
          // Buat kategori bawaan bengkel
          await tx.category.createMany({
            data: [
              { tenantId, name: 'Oli & Pelumas Mesin', printerTarget: 'NONE' },
              { tenantId, name: 'Suku Cadang Fast Moving', printerTarget: 'NONE' },
              { tenantId, name: 'Ban & Kaki-Kaki', printerTarget: 'NONE' },
              { tenantId, name: 'Aki & Kelistrikan', printerTarget: 'NONE' }
            ]
          });
          newCategoriesCount = 4;

          // Buat jasa servis bawaan bengkel jika belum ada
          const existingServices = await tx.serviceType.count({ where: { tenantId } });
          if (existingServices === 0) {
            await tx.serviceType.createMany({
              data: [
                { tenantId, name: 'Ganti Oli Mesin', priceRetail: 20000, priceMitra: 15000, priceGrosir: 15000, vehicleType: 'ALL', status: 'ACTIVE' },
                { tenantId, name: 'Tune Up Injeksi / Karburator', priceRetail: 65000, priceMitra: 50000, priceGrosir: 45000, vehicleType: 'MOTOR', status: 'ACTIVE' },
                { tenantId, name: 'Servis CVT Lengkap', priceRetail: 65000, priceMitra: 50000, priceGrosir: 50000, vehicleType: 'MOTOR', status: 'ACTIVE' },
                { tenantId, name: 'Ganti Kampas Rem Depan / Belakang', priceRetail: 25000, priceMitra: 20000, priceGrosir: 20000, vehicleType: 'ALL', status: 'ACTIVE' },
                { tenantId, name: 'Servis Ringan + Pengecekan 12 Titik', priceRetail: 50000, priceMitra: 40000, priceGrosir: 35000, vehicleType: 'ALL', status: 'ACTIVE' }
              ]
            });
            newServicesCount = 5;
          }

          // Perbarui footer struk bengkel
          await tx.settings.updateMany({
            where: { tenantId },
            data: {
              receiptHeader: `Selamat Datang di ${tenant.name} (Workshop & Servis)`,
              receiptFooter: 'Garansi servis berlaku 7 hari kerja. Terima kasih!'
            }
          });
        } else if (targetBusinessType === 'CAFE') {
          // Buat kategori bawaan kafe
          await tx.category.createMany({
            data: [
              { tenantId, name: 'Makanan', printerTarget: 'KITCHEN' },
              { tenantId, name: 'Minuman', printerTarget: 'BAR' }
            ]
          });
          newCategoriesCount = 2;

          // Inisialisasi meja bawaan jika belum ada meja
          const existingTables = await tx.table.count({ where: { tenantId } });
          if (existingTables === 0) {
            await tx.table.createMany({
              data: [
                { tenantId, tableNo: '01', name: 'Area Utama', capacity: 4 },
                { tenantId, tableNo: '02', name: 'Area Utama', capacity: 4 },
                { tenantId, tableNo: '03', name: 'Area VIP', capacity: 6 }
              ]
            });
          }

          // Perbarui footer struk kafe
          await tx.settings.updateMany({
            where: { tenantId },
            data: {
              receiptHeader: `Selamat Datang di ${tenant.name}`,
              receiptFooter: 'Terima kasih atas kunjungan Anda!'
            }
          });
        }
      }

      return {
        tenant: updatedTenant,
        newCategoriesCount,
        newServicesCount
      };
    });

    // 3. Cache Invalidation
    await invalidateTenantCache(tenantId);
    await cacheService.del(`cache:tenant:businessType:${tenantId}`);

    // 3.5. Adaptasi Otomatis Template WhatsApp CRM ke Vertikal Baru
    try {
      await whatsAppTemplateService.seedDefaultTemplates(tenantId, targetBusinessType);
    } catch (waErr: any) {
      console.warn(`[Settings] Gagal update template WhatsApp saat migrasi vertikal:`, waErr.message);
    }

    // 4. Audit Log
    await AuditLogger.log({
      tenantId,
      action: 'TENANT_VERTICAL_MIGRATION',
      resource: 'SETTINGS',
      resourceId: tenantId,
      description: `Migrasi profil bisnis berhasil dari [${currentBusinessType}] ke [${targetBusinessType}] (Strategi: ${migrationStrategy}).`,
      severity: 'CRITICAL'
    }, req);

    return res.json({
      success: true,
      message: `Profil bisnis berhasil dialihkan ke [${targetBusinessType}]. Antarmuka dan modul kasir kini telah disesuaikan.`,
      previousBusinessType: currentBusinessType,
      currentBusinessType: targetBusinessType,
      newCategoriesCount: result.newCategoriesCount,
      newServicesCount: result.newServicesCount
    });
  } catch (error: any) {
    console.error('Migrate vertical error:', error);
    res.status(500).json({ error: error?.message || 'Gagal memproses migrasi jenis bisnis' });
  }
});

// ─── POST /api/settings/resolve-maps: Extract Address & Coordinates from Google Maps URL or Lat/Lng ───
router.post('/resolve-maps', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { url, latitude: inputLat, longitude: inputLon } = req.body;

    let latitude: number | null = inputLat !== undefined && inputLat !== null && !isNaN(Number(inputLat)) ? Number(inputLat) : null;
    let longitude: number | null = inputLon !== undefined && inputLon !== null && !isNaN(Number(inputLon)) ? Number(inputLon) : null;
    let address = '';
    let placeName = '';
    let canonicalUrl = '';

    if (url && typeof url === 'string' && url.trim().length > 0) {
      const trimmedUrl = url.trim();
      let finalUrl = trimmedUrl;
      let htmlContent = '';

      // Follow redirects to unpack shortlinks like maps.app.goo.gl
      try {
        const response = await fetch(trimmedUrl, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
          }
        });
        finalUrl = response.url || trimmedUrl;
        htmlContent = await response.text();
      } catch (fetchErr: any) {
        console.warn('[Settings Maps Resolver] Direct fetch error:', fetchErr?.message);
      }

      // 1. Extract Coordinates from URL regex patterns
      const coordsMatch1 = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      const coordsMatch2 = finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      const coordsMatch3 = finalUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
      const coordsMatch4 = finalUrl.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
      const coordsMatch5 = finalUrl.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);

      if (coordsMatch1) {
        latitude = parseFloat(coordsMatch1[1]);
        longitude = parseFloat(coordsMatch1[2]);
      } else if (coordsMatch2) {
        latitude = parseFloat(coordsMatch2[1]);
        longitude = parseFloat(coordsMatch2[2]);
      } else if (coordsMatch3) {
        latitude = parseFloat(coordsMatch3[1]);
        longitude = parseFloat(coordsMatch3[2]);
      } else if (coordsMatch4) {
        latitude = parseFloat(coordsMatch4[1]);
        longitude = parseFloat(coordsMatch4[2]);
      } else if (coordsMatch5) {
        latitude = parseFloat(coordsMatch5[1]);
        longitude = parseFloat(coordsMatch5[2]);
      }

      // 2. Extract Place Name
      const placeMatch = finalUrl.match(/\/maps\/place\/([^/@]+)/);
      if (placeMatch && placeMatch[1]) {
        placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
      }

      if (!placeName && htmlContent) {
        const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          placeName = titleMatch[1].replace(/\s*-\s*Google Maps/i, '').replace(/\s*·\s*Google Maps/i, '').trim();
        }
      }

      // 3. Extract OpenGraph Description (often contains the address on Google Maps)
      if (htmlContent) {
        const ogDescMatch = htmlContent.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                            htmlContent.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
        if (ogDescMatch && ogDescMatch[1]) {
          address = ogDescMatch[1].trim();
        }
      }
    }

    // 4. Reverse Geocoding fallback if coordinates are found and address is minimal or missing
    if (latitude !== null && longitude !== null && (!address || address.length < 5)) {
      try {
        const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
        const geoRes = await fetch(nominatimUrl, {
          headers: {
            'User-Agent': 'CodePOS-StoreLocator/1.0 (contact@codepos.id)',
            'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8'
          }
        });
        if (geoRes.ok) {
          const geoData: any = await geoRes.json();
          if (geoData?.display_name) {
            address = geoData.display_name;
          }
        }
      } catch (geoErr) {
        console.warn('[Reverse Geocoding] Nominatim lookup failed:', geoErr);
      }
    }

    // Generate Canonical Maps URL
    if (latitude !== null && longitude !== null) {
      canonicalUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
    }

    if (latitude === null || longitude === null) {
      return res.status(400).json({
        error: 'Tidak dapat menemukan koordinat dari link tersebut. Pastikan link Google Maps valid (contoh: https://maps.app.goo.gl/... atau tautan dari Google Maps).'
      });
    }

    return res.json({
      success: true,
      data: {
        latitude,
        longitude,
        address: address || 'Alamat Lokasi Terdeteksi di Google Maps',
        placeName: placeName || '',
        googleMapsUrl: canonicalUrl
      }
    });
  } catch (error: any) {
    console.error('Resolve maps error:', error);
    return res.status(500).json({ error: error?.message || 'Gagal memproses data lokasi Google Maps' });
  }
});

export default router;
