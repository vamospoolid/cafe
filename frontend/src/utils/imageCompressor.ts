/**
 * Utility for compressing image data URLs (e.g. webcam selfies / file uploads)
 * using HTML5 Canvas before saving to IndexedDB or uploading to API.
 */
export async function compressImage(
  dataUrlOrFile: string | File,
  maxWidth = 640,
  maxHeight = 640,
  quality = 0.65
): Promise<string> {
  return new Promise((resolve, reject) => {
    let sourceDataUrl = '';

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

        // Draw and export compressed JPEG
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
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

export async function compressImageFile(
  file: File | string,
  optionsOrMaxWidth?: { maxWidth?: number; maxHeight?: number; quality?: number; format?: string } | number,
  maxHeight = 800,
  quality = 0.7
): Promise<string> {
  if (typeof optionsOrMaxWidth === 'object' && optionsOrMaxWidth !== null) {
    return compressImage(
      file,
      optionsOrMaxWidth.maxWidth || 800,
      optionsOrMaxWidth.maxHeight || 800,
      optionsOrMaxWidth.quality || 0.7
    );
  }
  return compressImage(file, typeof optionsOrMaxWidth === 'number' ? optionsOrMaxWidth : 800, maxHeight, quality);
}
