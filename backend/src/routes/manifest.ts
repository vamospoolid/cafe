import { Router, Request, Response } from 'express';
import prisma from '../db';
import { resolveTenantFromRequest } from '../middlewares/tenantResolver';

const router = Router();

/** Helper: ambil branding data per tenant */
async function getTenantBranding(req: Request) {
  const resolvedTenant = await resolveTenantFromRequest(req);
  const tenantId = resolvedTenant?.id;

  let settings: any = null;
  let tenant: any = null;

  if (tenantId) {
    [settings, tenant] = await Promise.all([
      prisma.settings.findFirst({ where: { tenantId } }),
      prisma.tenant.findUnique({ where: { id: tenantId } })
    ]);
  }

  const storeName = settings?.storeName || tenant?.name || 'CodePOS Platform';
  const logoUrl = settings?.logoUrl || '/logo.png';
  const themeColor = settings?.primaryColor || '#4f46e5';
  const businessType: string = tenant?.businessType || 'CAFE';
  const slug = tenant?.slug || 'platform';

  return { storeName, logoUrl, themeColor, businessType, slug };
}

// ─── GET /api/manifest.json — Manifest Kasir Utama (Tablet / Desktop) ─────────
router.get('/manifest.json', async (req: Request, res: Response) => {
  try {
    const { storeName, logoUrl, themeColor, businessType, slug } = await getTenantBranding(req);

    // Shortcuts dinamis per vertikal bisnis
    const shortcuts: any[] = [
      { name: 'Buka Kasir (POS)', short_name: 'Kasir', url: '/pos', icons: [{ src: logoUrl, sizes: '96x96' }] }
    ];
    if (businessType === 'CAFE' || businessType === 'RETAIL') {
      shortcuts.push({ name: 'Kitchen Display (KDS)', short_name: 'Dapur', url: '/kds', icons: [{ src: logoUrl, sizes: '96x96' }] });
    }
    if (businessType === 'BENGKEL') {
      shortcuts.push({ name: 'Work Order (SPK)', short_name: 'SPK', url: '/pos', icons: [{ src: logoUrl, sizes: '96x96' }] });
    }

    const manifest = {
      name: `${storeName} — Kasir & Operasional`,
      short_name: storeName,
      description: `Sistem Kasir & Operasional Bisnis ${storeName}`,
      start_url: '/pos',
      scope: '/',
      display: 'standalone',
      orientation: 'landscape-primary',
      background_color: '#0f172a',
      theme_color: themeColor,
      id: `codepos-pos-${slug}`,
      icons: [
        { src: logoUrl, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: logoUrl, sizes: '512x512', type: 'image/png', purpose: 'any' }
      ],
      shortcuts,
      categories: ['business', 'productivity'],
      lang: 'id-ID'
    };

    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(manifest);
  } catch (err: any) {
    console.error('Error generating dynamic manifest:', err);
    res.status(500).json({ error: 'Gagal membuat manifest PWA.' });
  }
});

// ─── GET /api/staff-manifest.json — Manifest Apps Staf (HP Portrait) ──────────
router.get('/staff-manifest.json', async (req: Request, res: Response) => {
  try {
    const { storeName, logoUrl, slug } = await getTenantBranding(req);

    const manifest = {
      name: `${storeName} — Apps Staf`,
      short_name: `${storeName} Staf`,
      description: `Absensi, Handover Shift & Stok untuk Staf ${storeName}`,
      start_url: '/staff',
      scope: '/staff',
      display: 'standalone',
      orientation: 'portrait-primary',
      background_color: '#0f172a',
      theme_color: '#10b981',
      id: `codepos-staff-${slug}`,
      icons: [
        { src: logoUrl, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: logoUrl, sizes: '512x512', type: 'image/png', purpose: 'any' }
      ],
      shortcuts: [
        { name: 'Absensi', short_name: 'Absensi', url: '/staff', icons: [{ src: logoUrl, sizes: '96x96' }] }
      ],
      categories: ['business', 'productivity'],
      lang: 'id-ID'
    };

    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(manifest);
  } catch (err: any) {
    console.error('Error generating staff manifest:', err);
    res.status(500).json({ error: 'Gagal membuat manifest PWA Staf.' });
  }
});

export default router;
