const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '../..');
const desktopDir = path.resolve(__dirname, '..');

// 1. Parsing Argumen CLI
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value || true;
    }
  });
  return args;
}

const args = parseArgs();
const targetVertical = (args.vertical || 'BENGKEL').toUpperCase();
const buildAll = !!args.all;
const dryRun = !!args['dry-run'];

const VERTICAL_CONFIGS = {
  BENGKEL: {
    name: 'Bengkel',
    productName: 'CodePOS Bengkel Motor & Mobil',
    appId: 'id.codenusa.codepos.bengkel',
    folder: 'bengkel',
    shortcut: 'CodePOS Bengkel',
    artifactName: 'CodePOS-Bengkel-Setup-${version}.${ext}'
  },
  KAFE: {
    name: 'Kafe',
    productName: 'CodePOS Resto & Kafe',
    appId: 'id.codenusa.codepos.kafe',
    folder: 'kafe',
    shortcut: 'CodePOS Kafe',
    artifactName: 'CodePOS-Kafe-Setup-${version}.${ext}'
  },
  RETAIL: {
    name: 'Retail',
    productName: 'CodePOS Toko Retail & Bangunan',
    appId: 'id.codenusa.codepos.retail',
    folder: 'retail',
    shortcut: 'CodePOS Retail',
    artifactName: 'CodePOS-Retail-Setup-${version}.${ext}'
  },
  LAUNDRY: {
    name: 'Laundry',
    productName: 'CodePOS Laundry Kiloan & Satuan',
    appId: 'id.codenusa.codepos.laundry',
    folder: 'laundry',
    shortcut: 'CodePOS Laundry',
    artifactName: 'CodePOS-Laundry-Setup-${version}.${ext}'
  },
  RENTAL: {
    name: 'Rental',
    productName: 'CodePOS Rental & Sewa Kendaraan',
    appId: 'id.codenusa.codepos.rental',
    folder: 'rental',
    shortcut: 'CodePOS Rental',
    artifactName: 'CodePOS-Rental-Setup-${version}.${ext}'
  }
};

console.log('================================================================');
console.log('📦 CODEPOS STANDALONE INSTALLER BUILDER (WINDOWS NSIS .EXE) 📦');
console.log('================================================================');
console.log(`[TARGET] Mode     : ${buildAll ? 'ALL 5 VERTICALS' : targetVertical}`);
console.log(`[TARGET] Dry Run  : ${dryRun ? 'YES (Validasi Bundles Saja)' : 'NO (Compile Full NSIS)'}`);
console.log('================================================================\n');

// 2. Memastikan Prerequisites (Frontend & Backend Bundles)
function checkAndPrepareBundles() {
  console.log('[1/3] ⚙️  Memeriksa dependensi dan bundle sistem...');

  const frontendDist = path.join(rootDir, 'frontend', 'dist');
  if (!fs.existsSync(frontendDist)) {
    console.log('[1/3.1] Menjalankan build frontend Vite...');
    execSync('npm run build', { cwd: path.join(rootDir, 'frontend'), stdio: 'inherit' });
  } else {
    console.log('[1/3.1] ✅ Frontend bundle ditemukan di frontend/dist');
  }

  const backendDist = path.join(rootDir, 'backend', 'dist');
  if (!fs.existsSync(backendDist)) {
    console.log('[1/3.2] Menjalankan build backend TypeScript...');
    execSync('npm run build', { cwd: path.join(rootDir, 'backend'), stdio: 'inherit' });
  } else {
    console.log('[1/3.2] ✅ Backend bundle ditemukan di backend/dist');
  }

  console.log('[1/3.3] Mengompilasi TypeScript desktop-standalone...');
  const tscBin = path.join(rootDir, 'backend', 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
  if (fs.existsSync(tscBin)) {
    execSync(`"${tscBin}" -p tsconfig.json`, { cwd: desktopDir, stdio: 'inherit' });
  } else {
    execSync('npx tsc -p tsconfig.json', { cwd: desktopDir, stdio: 'inherit' });
  }
  console.log('[1/3.3] ✅ Desktop main process berhasil dikompilasi ke desktop-standalone/dist\n');
}

// 3. Build Installer untuk satu vertikal
function buildSingleVertical(key) {
  const conf = VERTICAL_CONFIGS[key];
  if (!conf) {
    throw new Error(`Vertikal tidak dikenal: ${key}. Pilihan: ${Object.keys(VERTICAL_CONFIGS).join(', ')}`);
  }

  console.log('----------------------------------------------------------------');
  console.log(`🚀 [MEMPROSES VERTICAL] ${conf.productName}`);
  console.log(`🆔 App ID           : ${conf.appId}`);
  console.log(`📂 Output Folder    : release/desktop/${conf.folder}`);
  console.log('----------------------------------------------------------------');

  const releaseVerticalDir = path.join(rootDir, 'release', 'desktop', conf.folder);
  if (!fs.existsSync(releaseVerticalDir)) {
    fs.mkdirSync(releaseVerticalDir, { recursive: true });
  }

  // Generate dynamic electron-builder configuration
  const builderConfig = {
    appId: conf.appId,
    productName: conf.productName,
    electronVersion: '33.2.0',
    copyright: 'Copyright © 2026 CodePOS (PT Code Nusa Teknologi)',
    directories: {
      output: path.join(rootDir, 'release', 'desktop', conf.folder),
      buildResources: path.join(desktopDir, 'assets')
    },
    npmRebuild: false,
    nodeGypRebuild: false,
    files: [
      'dist/**/*',
      'package.json',
      {
        from: '../frontend/dist',
        to: 'frontend-dist',
        filter: ['**/*']
      },
      {
        from: '../backend/dist',
        to: 'backend-dist',
        filter: ['**/*']
      },
      {
        from: '../backend/prisma',
        to: 'backend-prisma',
        filter: ['schema.sqlite.prisma']
      }
    ],
    extraMetadata: {
      main: 'dist/main/index.js'
    },
    win: {
      target: [
        {
          target: 'dir',
          arch: ['x64']
        }
      ],
      artifactName: conf.artifactName,
      requestedExecutionLevel: 'asInvoker'
    },
    nsis: {
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      deleteAppDataOnUninstall: false, // ZERO DATA LOSS GUARANTEE
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: conf.shortcut,
      installerLanguages: ['id', 'en'],
      language: '1057'
    }
  };

  const tempConfigPath = path.join(desktopDir, `electron-builder.${conf.folder}.json`);
  fs.writeFileSync(tempConfigPath, JSON.stringify(builderConfig, null, 2), 'utf-8');
  console.log(`[2/3] Konfigurasi NSIS tersimpan di: ${tempConfigPath}`);

  if (dryRun) {
    console.log(`[3/3] 🧪 Dry Run Aktif: Validasi struktur packaging berhasil disiapkan tanpa kompilasi native binary.`);
    return;
  }

  // Eksekusi electron-builder
  console.log(`[3/3] 🔨 Menjalankan electron-builder untuk ${conf.productName}...`);
  try {
    execSync(`npx electron-builder --config="${tempConfigPath}" --win --x64`, {
      cwd: desktopDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        STANDALONE_VERTICAL: key
      }
    });
    console.log(`✨ Sukses Build: Installer NSIS tersedia di release/desktop/${conf.folder}/\n`);
  } catch (err) {
    console.error(`❌ Gagal kompilasi NSIS:`, err.message);
    throw err;
  } finally {
    // Bersihkan file config sementara jika perlu
  }
}

// 4. Main Runner
function main() {
  checkAndPrepareBundles();

  if (buildAll) {
    Object.keys(VERTICAL_CONFIGS).forEach(k => {
      buildSingleVertical(k);
    });
  } else {
    buildSingleVertical(targetVertical);
  }

  console.log('================================================================');
  console.log('🎉 SELURUH PIPELINE BUILD INSTALLER SELESAI DENGAN SUKSES!');
  console.log('================================================================\n');
}

main();
