import { Router, Request, Response } from 'express';
import prisma from '../db';
import { resolveTenantFromRequest } from '../middlewares/tenantResolver';

const router = Router();

// GET /api/manifest.json - Dynamic Multi-Tenant PWA Manifest
router.get('/manifest.json', async (req: Request, res: Response) => {
  try {
    const resolvedTenant = await resolveTenantFromRequest(req);
    const tenantId = resolvedTenant?.id;

    let settings = null;
    let tenant = null;

    if (tenantId) {
      settings = await prisma.settings.findFirst({
        where: { tenantId }
      });
      tenant = await prisma.tenant.findUnique({
        where: { id: tenantId }
      });
    }

    const storeName = settings?.storeName || tenant?.name || 'CodePOS Platform';
    const logoUrl = settings?.logoUrl || '/logo.png';

    const manifest = {
      name: `${storeName} - POS & Dining Platform`,
      short_name: storeName,
      description: `Sistem Kasir & Operasional Bisnis ${storeName}`,
      start_url: '/pos',
      scope: '/',
      display: 'standalone',
      orientation: 'landscape-primary',
      background_color: '#0f172a',
      theme_color: '#4f46e5',
      icons: [
        {
          src: logoUrl,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: logoUrl,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        }
      ],
      categories: ['business', 'food', 'productivity'],
      lang: 'id-ID'
    };

    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache 5 menit
    res.json(manifest);
  } catch (err: any) {
    console.error('Error generating dynamic manifest:', err);
    res.status(500).json({ error: 'Gagal membuat manifest PWA.' });
  }
});

export default router;
