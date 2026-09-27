const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/**
 * Spesifikasi resolusi icon Android Mipmaps
 */
const MIPMAP_SIZES = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 }
];

/**
 * Menghasilkan Icon Android Mipmaps & Splash Screen dari gambar logo toko
 * @param {string} inputLogoPath - Path file logo toko (.png, .jpg, .webp, dll)
 * @param {string} androidResDir - Path direktori mobile/android/app/src/main/res
 * @param {Object} [options]
 * @param {string} [options.bgColor='#ffffff'] - Warna background adaptive icon
 */
async function generateAndroidIcons(inputLogoPath, androidResDir, options = {}) {
  const bgColor = options.bgColor || '#ffffff';

  if (!fs.existsSync(inputLogoPath)) {
    throw new Error(`File logo tidak ditemukan di: ${inputLogoPath}`);
  }

  if (!fs.existsSync(androidResDir)) {
    throw new Error(`Direktori Android res tidak ditemukan di: ${androidResDir}`);
  }

  console.log(`\n🎨 [ICON GENERATOR] Memproses asset icon dari: ${path.basename(inputLogoPath)}`);

  // 1. Generate icon untuk setiap level mipmap
  for (const item of MIPMAP_SIZES) {
    const targetDir = path.join(androidResDir, item.folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // A. ic_launcher.png (Square / Rounded)
    const launcherPath = path.join(targetDir, 'ic_launcher.png');
    await sharp(inputLogoPath)
      .resize(item.size, item.size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(launcherPath);

    // B. ic_launcher_round.png (Circular mask)
    const launcherRoundPath = path.join(targetDir, 'ic_launcher_round.png');
    const circleBuffer = Buffer.from(
      `<svg width="${item.size}" height="${item.size}"><circle cx="${item.size / 2}" cy="${item.size / 2}" r="${item.size / 2}" fill="#fff"/></svg>`
    );

    const resizedLogo = await sharp(inputLogoPath)
      .resize(Math.round(item.size * 0.85), Math.round(item.size * 0.85), { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toBuffer();

    await sharp({
      create: {
        width: item.size,
        height: item.size,
        channels: 4,
        background: bgColor
      }
    })
      .composite([
        { input: resizedLogo, gravity: 'center' }
      ])
      .png()
      .toFile(launcherRoundPath);

    // C. ic_launcher_foreground.png (Adaptive icon layer)
    const foregroundSize = Math.round(item.size * 1.5);
    const launcherFgPath = path.join(targetDir, 'ic_launcher_foreground.png');
    await sharp(inputLogoPath)
      .resize(item.size, item.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({
        top: Math.round((foregroundSize - item.size) / 2),
        bottom: Math.round((foregroundSize - item.size) / 2),
        left: Math.round((foregroundSize - item.size) / 2),
        right: Math.round((foregroundSize - item.size) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(launcherFgPath);

    console.log(`  ✓ ${item.folder} (${item.size}x${item.size} px)`);
  }

  // 2. Generate Adaptive Icons XML (Android 8.0+)
  const anyDpiDir = path.join(androidResDir, 'mipmap-anydpi-v26');
  if (!fs.existsSync(anyDpiDir)) {
    fs.mkdirSync(anyDpiDir, { recursive: true });
  }

  const adaptiveXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>`;

  fs.writeFileSync(path.join(anyDpiDir, 'ic_launcher.xml'), adaptiveXmlContent, 'utf-8');
  fs.writeFileSync(path.join(anyDpiDir, 'ic_launcher_round.xml'), adaptiveXmlContent, 'utf-8');
  console.log(`  ✓ mipmap-anydpi-v26/ic_launcher.xml (Adaptive XML)`);

  // 3. Generate Colors XML for background (Use standard ic_launcher_background.xml)
  const valuesDir = path.join(androidResDir, 'values');
  if (!fs.existsSync(valuesDir)) {
    fs.mkdirSync(valuesDir, { recursive: true });
  }
  const icLauncherBgXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${bgColor}</color>
</resources>`;
  fs.writeFileSync(path.join(valuesDir, 'ic_launcher_background.xml'), icLauncherBgXml, 'utf-8');

  // Clean up any old duplicate ic_launcher_colors.xml if it exists
  const oldColorsXml = path.join(valuesDir, 'ic_launcher_colors.xml');
  if (fs.existsSync(oldColorsXml)) {
    fs.unlinkSync(oldColorsXml);
  }

  // 4. Generate Splash Screen (1080 x 1920)
  const drawableDir = path.join(androidResDir, 'drawable');
  if (!fs.existsSync(drawableDir)) {
    fs.mkdirSync(drawableDir, { recursive: true });
  }

  const splashLogoBuffer = await sharp(inputLogoPath)
    .resize(360, 360, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer();

  const splashPath = path.join(drawableDir, 'splash.png');
  await sharp({
    create: {
      width: 1080,
      height: 1920,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 } // Modern dark slate background (#0f172a)
    }
  })
    .composite([
      { input: splashLogoBuffer, gravity: 'center' }
    ])
    .png()
    .toFile(splashPath);

  console.log(`  ✓ drawable/splash.png (1080x1920 px Splash Screen)`);
  console.log(`✨ [ICON GENERATOR] Semua asset Android berhasil diperbarui!\n`);
}

module.exports = {
  generateAndroidIcons,
  MIPMAP_SIZES
};
