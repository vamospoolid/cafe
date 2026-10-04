const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { generateAndroidIcons } = require('./lib/icon_generator');

const rootDir = path.resolve(__dirname, '..');
const mobileDir = path.join(rootDir, 'mobile');
const androidDir = path.join(mobileDir, 'android');
const androidResDir = path.join(androidDir, 'app', 'src', 'main', 'res');
const releaseDir = path.join(rootDir, 'release');
const capacitorConfigPath = path.join(mobileDir, 'capacitor.config.json');
const stringsXmlPath = path.join(androidResDir, 'values', 'strings.xml');

// 1. Parsing Arguments (--tenant=slug, --target=cashier|staff|all, --env=dev|prod)
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value || true;
    } else if (!args.target) {
      args.target = arg;
    }
  });
  return args;
}

const args = parseArgs();
const rawTarget = (args.target || 'all').toLowerCase();
const tenantSlug = args.tenant || 'mukiramen';
const envMode = args.env || 'prod';

const buildGradlePath = path.join(androidDir, 'app', 'build.gradle');

console.log('================================================================');
console.log('🚀 GENERATOR APK ANDROID MULTI-TENANT DENGAN LOGO KUSTOM 🚀');
console.log('================================================================');
console.log(`[KONFIGURASI] Tenant Slug : ${tenantSlug}`);
console.log(`[KONFIGURASI] Target Build: ${rawTarget.toUpperCase()}`);
console.log(`[KONFIGURASI] Environment : ${envMode.toUpperCase()}`);
console.log('================================================================\n');

// 2. Setup Environment Variables (JAVA_HOME & ANDROID_HOME)
let javaHome = process.env.JAVA_HOME;
const defaultJbr = 'C:\\Program Files\\Android\\Android Studio\\jbr';
if (!javaHome || !fs.existsSync(javaHome)) {
  if (fs.existsSync(defaultJbr)) {
    javaHome = defaultJbr;
  }
}

let androidHome = process.env.ANDROID_HOME;
const defaultSdk = path.join(process.env.LOCALAPPDATA || 'C:\\Users\\Balanipastudio\\AppData\\Local', 'Android', 'Sdk');
if (!androidHome || !fs.existsSync(androidHome)) {
  if (fs.existsSync(defaultSdk)) {
    androidHome = defaultSdk;
  }
}

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
  PATH: `${javaHome ? path.join(javaHome, 'bin') + ';' : ''}${process.env.PATH}`
};

// 3. Resolusi Data Tenant & Logo dari Pengaturan
async function resolveTenantInfo(slug) {
  let storeName = 'MUKI RAMEN';
  let logoFile = path.join(rootDir, 'frontend', 'public', 'logo.png');
  let baseUrl = args.url 
    ? args.url.replace(/\/$/, '')
    : args.domain 
    ? `https://${args.domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
    : (slug === 'mukiramen' ? 'https://app.mukiramen.id' : (envMode === 'dev' ? 'http://192.168.100.197:5173' : 'https://cafe.codenusa.id'));

  try {
    const { PrismaClient } = require(path.join(rootDir, 'backend', 'node_modules', '@prisma/client'));
    const prisma = new PrismaClient();
    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ slug: slug }, { id: slug }] }
    });

    const settings = tenant ? await prisma.settings.findFirst({ where: { tenantId: tenant.id } }) : null;

    if (tenant) {
      storeName = tenant.name || storeName;
      if (tenant.customDomain && !args.url && !args.domain) {
        baseUrl = `https://${tenant.customDomain}`;
      }
      if (tenant.logoUrl && !settings?.logoUrl) {
        settings = { ...(settings || {}), logoUrl: tenant.logoUrl };
      }
    }

    if (settings) {
      if (settings.storeName) storeName = settings.storeName;
      if (settings.logoUrl) {
        if (settings.logoUrl.startsWith('http://') || settings.logoUrl.startsWith('https://')) {
          // Download remote logo to temp file for mipmaps generation
          try {
            const https = settings.logoUrl.startsWith('https://') ? require('https') : require('http');
            const tempLogoPath = path.join(rootDir, 'release', `temp_logo_${slug}.png`);
            if (!fs.existsSync(path.dirname(tempLogoPath))) {
              fs.mkdirSync(path.dirname(tempLogoPath), { recursive: true });
            }
            await new Promise((resolve, reject) => {
              const fileStream = fs.createWriteStream(tempLogoPath);
              https.get(settings.logoUrl, (response) => {
                response.pipe(fileStream);
                fileStream.on('finish', () => {
                  fileStream.close();
                  logoFile = tempLogoPath;
                  resolve();
                });
              }).on('error', (err) => {
                fs.unlink(tempLogoPath, () => {});
                reject(err);
              });
            });
          } catch (dlErr) {
            console.warn('[WARN] Gagal mengunduh logo remote, menggunakan fallback:', dlErr.message);
          }
        } else {
          // Cari lokasi file logo lokal
          const cleanLogo = settings.logoUrl.replace(/^\//, '');
          const candidates = [
            path.join(rootDir, 'frontend', 'public', cleanLogo),
            path.join(rootDir, 'backend', cleanLogo),
            path.join(rootDir, 'backend', 'uploads', cleanLogo),
            path.join(rootDir, 'frontend', cleanLogo)
          ];

          for (const c of candidates) {
            if (fs.existsSync(c)) {
              logoFile = c;
              break;
            }
          }
        }
      }
    }
    await prisma.$disconnect();
  } catch (e) {
    console.log('[INFO] Mode database offline/fallback digunakan.');
  }

  return { storeName, logoFile, baseUrl, cleanSlug: slug.replace(/[^a-z0-9]/g, '') };
}

async function main() {
  const info = await resolveTenantInfo(tenantSlug);
  console.log(`[TENANT INFO] Nama Usaha : ${info.storeName}`);
  console.log(`[TENANT INFO] Logo Sumber: ${info.logoFile}`);
  console.log(`[TENANT INFO] Base URL   : ${info.baseUrl}\n`);

  // A. Generate Seluruh Resolusi Icon Android Mipmap
  await generateAndroidIcons(info.logoFile, androidResDir);

  // B. Definisikan 2 Target Aplikasi
  const isMukiRamen = info.cleanSlug === 'mukiramen' || info.baseUrl.includes('mukiramen');
  
  const cashierUrl = isMukiRamen ? 'https://app.mukiramen.id' : `${info.baseUrl}/pos`;
  const staffUrl = isMukiRamen ? 'https://staff.mukiramen.id' : `${info.baseUrl}/staff`;
  
  const cashierAppId = isMukiRamen ? 'id.mukiramen.pos' : `id.codenusa.${info.cleanSlug}.pos`;
  const staffAppId = isMukiRamen ? 'id.mukiramen.staff' : `id.codenusa.${info.cleanSlug}.staff`;

  const cashierApkName = isMukiRamen ? 'mukiramen-pos-tablet.apk' : `${info.cleanSlug}-pos-tablet.apk`;
  const staffApkName = isMukiRamen ? 'mukiramen-staff.apk' : `${info.cleanSlug}-staff.apk`;

  const buildTargets = [
    {
      type: 'cashier',
      name: `${info.storeName} - Kasir & Tablet POS`,
      appId: cashierAppId,
      appName: `${info.storeName} POS`,
      url: cashierUrl,
      orientation: 'sensorLandscape',
      outputFileName: cashierApkName
    },
    {
      type: 'staff',
      name: `${info.storeName} - Portal Staf & Absensi`,
      appId: staffAppId,
      appName: `${info.storeName} Staf`,
      url: staffUrl,
      orientation: 'portrait',
      outputFileName: staffApkName
    }
  ];

  const isCashierTarget = ['cashier', 'pos', 'kasir', 'tablet'].includes(rawTarget);
  const isStaffTarget = ['staff', 'staf', 'absensi'].includes(rawTarget);

  const targetsToBuild = isCashierTarget
    ? [buildTargets[0]]
    : isStaffTarget
    ? [buildTargets[1]]
    : buildTargets;

  if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir, { recursive: true });
  }

  const gradlewCmd = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

  for (const target of targetsToBuild) {
    console.log(`----------------------------------------------------------------`);
    console.log(`📦 [MEMPROSES APK] ${target.name}`);
    console.log(`🌐 Target URL   : ${target.url}`);
    console.log(`🆔 Application ID: ${target.appId}`);
    console.log(`📐 Orientasi Layar: ${target.orientation}`);
    console.log(`----------------------------------------------------------------`);

    // 1. Update strings.xml dengan nama brand toko
    const stringsContent = `<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">${target.appName}</string>
    <string name="title_activity_main">${target.appName}</string>
    <string name="package_name">${target.appId}</string>
    <string name="custom_url_scheme">${target.appId}</string>
</resources>`;
    fs.writeFileSync(stringsXmlPath, stringsContent, 'utf-8');

    // 1b. Update orientasi layar di AndroidManifest.xml
    const manifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
    if (fs.existsSync(manifestPath)) {
      let manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      if (manifestContent.includes('android:screenOrientation="')) {
        manifestContent = manifestContent.replace(/android:screenOrientation="[^"]*"/g, `android:screenOrientation="${target.orientation}"`);
      } else {
        manifestContent = manifestContent.replace('<activity', `<activity\n            android:screenOrientation="${target.orientation}"`);
      }
      fs.writeFileSync(manifestPath, manifestContent, 'utf-8');
    }

    // 1c. Update applicationId di build.gradle agar Application ID Android benar-benar independen
    if (fs.existsSync(buildGradlePath)) {
      let gradleContent = fs.readFileSync(buildGradlePath, 'utf-8');
      gradleContent = gradleContent.replace(/applicationId\s+"[^"]*"/, `applicationId "${target.appId}"`);
      fs.writeFileSync(buildGradlePath, gradleContent, 'utf-8');
      console.log(`[GRADLE] Injeksi Application ID: ${target.appId}`);
    }

    // 2. Update capacitor.config.json
    const configData = {
      appId: target.appId,
      appName: target.appName,
      webDir: '../frontend/dist',
      server: {
        url: target.url,
        cleartext: true
      }
    };
    fs.writeFileSync(capacitorConfigPath, JSON.stringify(configData, null, 2), 'utf-8');

    // 3. Capacitor Sync
    console.log(`[1/3] 🔄 Menyinkronkan konfigurasi Capacitor Android...`);
    execSync('npx cap sync android', { cwd: mobileDir, stdio: 'inherit', env });

    // 4. Gradle Build
    console.log(`[2/3] ⚙️  Mengompilasi Native APK (${target.appName})...`);
    execSync(`${gradlewCmd} assembleDebug`, { cwd: androidDir, stdio: 'inherit', env });

    // 5. Salin file APK ke folder release
    console.log(`[3/3] 📁 Menyimpan file APK hasil kompilasi...`);
    const sourceApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
    const targetApk = path.join(releaseDir, target.outputFileName);

    if (fs.existsSync(sourceApk)) {
      fs.copyFileSync(sourceApk, targetApk);
      const stats = fs.statSync(targetApk);
      const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`✨ Sukses Kompilasi: ${target.outputFileName} (${sizeMb} MB)`);

      // Duplikasi alias pos-cashier untuk kompatibilitas endpoint platformAdmin
      if (target.type === 'cashier') {
        const aliasName = `${info.cleanSlug}-pos-cashier.apk`;
        if (target.outputFileName !== aliasName) {
          fs.copyFileSync(sourceApk, path.join(releaseDir, aliasName));
          console.log(`✨ Alias dibuat: ${aliasName}`);
        }
      }
    } else {
      throw new Error(`File APK ${target.outputFileName} tidak ditemukan di output gradle.`);
    }
  }

  console.log('\n================================================================');
  console.log('🎉 SEMUA APK BRANDED BERHASIL DIGENERATE DENGAN LOGO KUSTOM!');
  console.log('================================================================');
  targetsToBuild.forEach((t, i) => {
    console.log(`${i + 1}. ${t.name} -> ${path.join(releaseDir, t.outputFileName)}`);
  });
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('\n❌ Gagal membuat APK:', err.message);
  process.exit(1);
});
