/**
 * Utility for compressing image data URLs (e.g. webcam selfies / file uploads)
 * using HTML5 Canvas before saving to IndexedDB or uploading to API.
 */

/**
 * Converts a base64 Data URL to a native browser File object.
 */
export function dataURLtoFile(dataurl: string, filename = 'upload.webp'): File {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/webp';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Compresses an image to a base64 Data URL.
 */
export async function compressImage(
  dataUrlOrFile: string | File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.75,
  format = 'image/webp'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const processImage = (src: string) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate scaling preserving aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }

        // Draw and export compressed format (WebP or JPEG)
        ctx.drawImage(img, 0, 0, width, height);
        try {
          const compressedDataUrl = canvas.toDataURL(format, quality);
          // If browser doesn't support WebP export, canvas falls back to image/png or image/jpeg
          resolve(compressedDataUrl);
        } catch {
          resolve(canvas.toDataURL('image/jpeg', quality));
        }
      };

      img.onerror = (err) => {
        console.error('Image compression error:', err);
        resolve(src); // Fallback to original
      };

      img.src = src;
    };

    if (typeof dataUrlOrFile === 'string') {
      processImage(dataUrlOrFile);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          processImage(e.target.result as string);
        } else {
          reject(new Error('Failed to read image file'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(dataUrlOrFile);
    }
  });
}

/**
 * Compresses an image file and returns a genuine File object ready for FormData / Multer upload.
 */
export async function compressImageFile(
  file: File | string,
  optionsOrMaxWidth?: { maxWidth?: number; maxHeight?: number; quality?: number; format?: string } | number,
  maxHeight = 800,
  quality = 0.75
): Promise<File> {
  const opts = typeof optionsOrMaxWidth === 'object' && optionsOrMaxWidth !== null
    ? optionsOrMaxWidth
    : { maxWidth: typeof optionsOrMaxWidth === 'number' ? optionsOrMaxWidth : 800, maxHeight, quality };

  const format = opts.format || 'image/webp';
  const dataUrl = await compressImage(
    file,
    opts.maxWidth || 800,
    opts.maxHeight || 800,
    opts.quality || 0.75,
    format
  );

  const originalName = typeof file === 'object' && file.name ? file.name : 'upload';
  const ext = format === 'image/webp' ? '.webp' : (format === 'image/png' ? '.png' : '.jpg');
  const baseName = originalName.replace(/\.[^/.]+$/, "");
  return dataURLtoFile(dataUrl, `${baseName}${ext}`);
}
