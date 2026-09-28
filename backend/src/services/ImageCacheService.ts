import fs from 'fs';
import path from 'path';
import prisma from '../db';

export class ImageCacheService {
  private static isRunning = false;

  /**
   * Cache all external (http/https) product images locally to ./uploads/products/
   */
  public static async cacheProductImages(tenantId?: string): Promise<{ success: boolean; processed: number; errors: number }> {
    if (!tenantId) {
      throw new Error('MISSING_TENANT_ID: ImageCacheService requires a valid tenantId context.');
    }

    if (this.isRunning) {
      console.log('[ImageCacheService] Caching job already running in background.');
      return { success: true, processed: 0, errors: 0 };
    }

    this.isRunning = true;
    let processed = 0;
    let errors = 0;

    try {
      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'products');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Find products with external HTTP URLs
      const products = await prisma.product.findMany({
        where: {
          tenantId,
          imageUrl: { startsWith: 'http' }
        },
        select: { id: true, name: true, imageUrl: true }
      });

      console.log(`[ImageCacheService] Found ${products.length} products with external AI images to cache.`);

      for (const prod of products) {
        if (!prod.imageUrl || !prod.imageUrl.startsWith('http')) continue;

        try {
          // Download image with 8s timeout
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);

          const response = await fetch(prod.imageUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 CodePOS Image Downloader'
            }
          });
          clearTimeout(timeout);

          if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            if (buffer.length > 500) { // Valid image payload
              const fileName = `${prod.id}.jpg`;
              const filePath = path.join(uploadsDir, fileName);
              fs.writeFileSync(filePath, buffer);

              const localUrl = `/uploads/products/${fileName}`;
              await prisma.product.update({
                where: { id: prod.id },
                data: { imageUrl: localUrl }
              });

              processed++;
              console.log(`[ImageCacheService] Cached photo for '${prod.name}' -> ${localUrl}`);
            }
          } else {
            console.warn(`[ImageCacheService] HTTP ${response.status} downloading photo for '${prod.name}'`);
            errors++;
          }
        } catch (downloadErr: any) {
          console.warn(`[ImageCacheService] Error downloading photo for '${prod.name}':`, downloadErr?.message);
          errors++;
        }

        // Polite delay (1000ms) between downloads to prevent API rate limiting
        await new Promise(res => setTimeout(res, 1000));
      }
    } catch (err: any) {
      console.error('[ImageCacheService] Unhandled error during image caching:', err?.message);
    } finally {
      this.isRunning = false;
    }

    return { success: true, processed, errors };
  }
}
