import prisma from '../db';
import { Router, Request, Response } from 'express';
import { resolveTenantFromRequest } from '../middlewares/tenantResolver';

const router = Router();

/**
 * GET /api/public-branding
 * Zero-Leak Public Branding & Dynamic White-Label Theme Endpoint
 * Safe for unauthenticated login page & dynamic PWA manifest.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantQuery = (req.query.tenant as string) || (req.query.username as string) || (req.query.slug as string);
    let tenant: any = null;

    if (tenantQuery) {
      const clean = tenantQuery.trim().toLowerCase();
      tenant = await prisma.tenant.findFirst({
        where: {
          OR: [
            { slug: clean },
            { id: clean },
            { customDomain: clean },
            { name: { contains: clean, mode: 'insensitive' } },
            { memberships: { some: { user: { username: clean } } } }
          ]
        },
        include: { settings: true }
      });
    }

    if (!tenant) {
      const resolved = await resolveTenantFromRequest(req);
      if (resolved) {
        tenant = await prisma.tenant.findUnique({
          where: { id: resolved.id },
          include: { settings: true }
        });
      } else {
        const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().toLowerCase();
        if (host.includes('cafe')) {
          tenant = await prisma.tenant.findFirst({
            where: { OR: [{ id: 'tenant-default-muki' }, { slug: 'mukiramen' }, { businessType: 'CAFE' }] },
            include: { settings: true }
          });
        }
      }
    }

    const settings = tenant?.settings?.[0] || await prisma.settings.findFirst({
      where: tenant ? { tenantId: tenant.id } : undefined
    });

    const storeName = settings?.storeName || tenant?.name || 'CodePOS Platform';
    const logoUrl = settings?.logoUrl || tenant?.logoUrl || '/logo.png';

    // HTTP Cache: 3 minutes public caching for ultra-fast loading without hitting DB on every hit
    res.setHeader('Cache-Control', 'public, max-age=180');

    return res.json({
      storeName,
      logoUrl,
      tenantSlug: tenant?.slug || 'platform',
      tenantName: tenant?.name || storeName,
      address: settings?.address || '',
      phone: settings?.phone || '',
      primaryColor: settings?.primaryColor || '#4f46e5',
      accentColor: settings?.accentColor || '#f59e0b',
      loginLayout: settings?.loginLayout || 'split_modern',
      loginCoverUrl: settings?.loginCoverUrl || '/assets/images/cafe_login_cover.png',
      loginTagline: settings?.loginTagline || '',
      faviconUrl: settings?.faviconUrl || null,
      hidePlatformBranding: Boolean(settings?.hidePlatformBranding)
    });
  } catch (err: any) {
    console.error('[PublicBranding] Error resolving public branding:', err);
    return res.status(500).json({ error: 'Gagal memuat branding publik' });
  }
});

export default router;
