/**
 * PWA Manager & Dynamic Multi-Tenant PWA Adapter
 * Mengelola instalasi PWA, pergantian manifest dinamis (Kasir vs Staf),
 * serta auto-create link & QR Code per tenant.
 */

// Simpan event instalasi PWA (beforeinstallprompt)
let deferredInstallPrompt: any = null;
const installPromptListeners: Array<(canInstall: boolean) => void> = [];

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installPromptListeners.forEach((listener) => listener(true));
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installPromptListeners.forEach((listener) => listener(false));
  });
}

/**
 * Berlangganan status kesiapan instalasi PWA
 */
export function onInstallPromptChange(callback: (canInstall: boolean) => void): () => void {
  installPromptListeners.push(callback);
  callback(Boolean(deferredInstallPrompt));
  return () => {
    const idx = installPromptListeners.indexOf(callback);
    if (idx !== -1) installPromptListeners.splice(idx, 1);
  };
}

/**
 * Cek apakah aplikasi saat ini sudah diinstal sebagai PWA standalone
 */
export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Cek apakah browser mendukung dan siap menampilkan dialog instalasi PWA
 */
export function canInstallPwa(): boolean {
  return Boolean(deferredInstallPrompt);
}

/**
 * Pemicu dialog instalasi PWA bawaan browser (Chrome, Edge, Android)
 */
export async function promptInstallPwa(): Promise<'accepted' | 'dismissed' | 'unsupported'> {
  if (!deferredInstallPrompt) {
    return 'unsupported';
  }
  try {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installPromptListeners.forEach((listener) => listener(false));
    return outcome;
  } catch (err) {
    console.error('[PWA] Error prompt install:', err);
    return 'unsupported';
  }
}

/**
 * Auto-generate link mandiri per tenant berdasarkan slug / domain aktif
 */
export function getTenantPwaUrls(tenantSlug?: string, customDomain?: string) {
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://app.mukiramen.id';
  const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : 'app.mukiramen.id';
  const isLocal = hostname.includes('localhost') || hostname.includes('127.0.0.1');

  // Khusus ekosistem domain resmi Muki Ramen (app.mukiramen.id & staff.mukiramen.id)
  if (hostname.includes('mukiramen.id') || tenantSlug === 'mukiramen') {
    return {
      cashierUrl: 'https://app.mukiramen.id/pos',
      staffUrl: 'https://staff.mukiramen.id',
      menuUrl: 'https://app.mukiramen.id/menu',
      dashboardUrl: 'https://app.mukiramen.id/',
      baseUrl: 'https://app.mukiramen.id',
    };
  }

  let baseUrl = currentOrigin;
  let staffUrl = `${currentOrigin}/staff`;

  if (customDomain) {
    const cleanDomain = customDomain.replace(/^https?:\/\//, '');
    baseUrl = `https://${cleanDomain}`;
    staffUrl = `${baseUrl}/staff`;
  } else if (!isLocal && tenantSlug) {
    if (currentOrigin.includes(tenantSlug)) {
      baseUrl = currentOrigin;
    } else {
      baseUrl = `https://${tenantSlug}.codenusa.id`;
    }
    staffUrl = `${baseUrl}/staff`;
  }

  return {
    cashierUrl: `${baseUrl}/pos`,
    staffUrl,
    menuUrl: `${baseUrl}/menu`,
    dashboardUrl: `${baseUrl}/`,
    baseUrl,
  };
}

/**
 * Update manifest link, title, apple-touch-icon, and theme-color dynamically
 * berdasarkan route (Kasir vs Staf) dan branding tenant.
 */
export function updatePwaManifestForRoute(
  pathname: string,
  branding?: {
    storeName?: string;
    logoUrl?: string;
    themeColor?: string;
  }
) {
  if (typeof document === 'undefined') return;

  const isStaffRoute = pathname.startsWith('/staff');
  const targetManifest = isStaffRoute ? '/api/staff-manifest.json' : '/api/manifest.json';

  // 1. Update <link rel="manifest">
  let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  if (!manifestLink) {
    manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    document.head.appendChild(manifestLink);
  }
  if (manifestLink.getAttribute('href') !== targetManifest) {
    manifestLink.setAttribute('href', targetManifest);
  }

  // 2. Update Theme Color
  const themeColor = isStaffRoute
    ? '#10b981'
    : (branding?.themeColor || '#4f46e5');
  let metaTheme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!metaTheme) {
    metaTheme = document.createElement('meta');
    metaTheme.name = 'theme-color';
    document.head.appendChild(metaTheme);
  }
  metaTheme.setAttribute('content', themeColor);

  // 3. Update Apple Mobile Web App Title & Page Title
  if (branding?.storeName) {
    const appTitle = isStaffRoute
      ? `${branding.storeName} Staf`
      : `${branding.storeName} POS`;

    let metaAppleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null;
    if (!metaAppleTitle) {
      metaAppleTitle = document.createElement('meta');
      metaAppleTitle.name = 'apple-mobile-web-app-title';
      document.head.appendChild(metaAppleTitle);
    }
    metaAppleTitle.setAttribute('content', appTitle);

    document.title = `${appTitle} — Sistem Kasir & Operasional Bisnis`;
  }

  // 4. Update Apple Touch Icon & Favicon jika ada logo kustom
  if (branding?.logoUrl) {
    let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
    if (!appleTouchIcon) {
      appleTouchIcon = document.createElement('link');
      appleTouchIcon.rel = 'apple-touch-icon';
      document.head.appendChild(appleTouchIcon);
    }
    appleTouchIcon.setAttribute('href', branding.logoUrl);

    let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (favicon) {
      favicon.setAttribute('href', branding.logoUrl);
    }
  }
}
