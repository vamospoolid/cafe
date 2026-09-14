const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const mobileDir = path.join(rootDir, 'mobile');
const androidDir = path.join(mobileDir, 'android');
const releaseDir = path.join(rootDir, 'release');
const capacitorConfigPath = path.join(mobileDir, 'capacitor.config.json');

console.log('======================================================');
console.log('🚀 GENERATOR NATIVE APK ANDROID (POS KASIR & STAF) 🚀');
console.log('======================================================');

// 1. Setup Environment Variables (JAVA_HOME & ANDROID_HOME)
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

console.log(`[INFO] JAVA_HOME   : ${javaHome || 'Default System'}`);
console.log(`[INFO] ANDROID_HOME: ${androidHome || 'Default System'}`);

const env = {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_HOME: androidHome,
    PATH: `${javaHome ? path.join(javaHome, 'bin') + ';' : ''}${process.env.PATH}`
};

const buildTargets = [
    {
        type: 'cashier',
        name: 'SOL POS - Kasir & Tablet',
        appId: 'id.codenusa.poscafe',
        appName: 'SOL POS Kasir',
        url: 'https://cafe.codenusa.id/pos',
        outputFileName: 'sol-pos-cashier.apk'
    },
    {
        type: 'staff',
        name: 'SOL POS - Portal Staf & Absensi',
        appId: 'id.codenusa.cafestaff',
        appName: 'SOL Staff Portal',
        url: 'https://cafe.codenusa.id/staff',
        outputFileName: 'muki-staff-pos.apk'
    }
];

// Check CLI arguments (e.g. node generate_apk.js cashier or node generate_apk.js staff)
const targetArg = process.argv[2] ? process.argv[2].toLowerCase() : 'all';
const targetsToBuild = targetArg === 'cashier' 
    ? [buildTargets[0]] 
    : targetArg === 'staff' 
    ? [buildTargets[1]] 
    : buildTargets;

if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir, { recursive: true });
}

const gradlewCmd = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

try {
    for (const target of targetsToBuild) {
        console.log(`\n------------------------------------------------------`);
        console.log(`📦 [MEMPROSES] ${target.name}`);
        console.log(`🌐 Target URL : ${target.url}`);
        console.log(`------------------------------------------------------`);

        // A. Update capacitor.config.json
        const configData = {
            appId: target.appId,
            appName: target.appName,
            webDir: "../frontend/dist",
            server: {
                url: target.url,
                cleartext: true
            }
        };
        fs.writeFileSync(capacitorConfigPath, JSON.stringify(configData, null, 2), 'utf-8');

        // B. Capacitor Sync
        console.log(`[1/3] 🔄 Menyinkronkan konfigurasi Capacitor...`);
        execSync('npx cap sync android', { cwd: mobileDir, stdio: 'inherit', env });

        // C. Gradle Build
        console.log(`[2/3] ⚙️  Mengompilasi Native APK (${target.appName})...`);
        execSync(`${gradlewCmd} assembleDebug`, { cwd: androidDir, stdio: 'inherit', env });

        // D. Copy to release
        console.log(`[3/3] 📁 Menyimpan file ke folder release...`);
        const sourceApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
        const targetApk = path.join(releaseDir, target.outputFileName);

        if (fs.existsSync(sourceApk)) {
            fs.copyFileSync(sourceApk, targetApk);
            const stats = fs.statSync(targetApk);
            const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`✨ Sukses: ${target.outputFileName} (${sizeMb} MB)`);
        } else {
            throw new Error(`File APK ${target.outputFileName} tidak ditemukan.`);
        }
    }

    console.log('\n======================================================');
    console.log('🎉 SEMUA APK NATIVE BERHASIL DIGENERATE!');
    console.log('======================================================');
    console.log(`1. 🛒 APK KASIR TABLET  : ${path.join(releaseDir, 'sol-pos-cashier.apk')}`);
    console.log(`2. 📱 APK PORTAL STAF   : ${path.join(releaseDir, 'muki-staff-pos.apk')}`);
    console.log('======================================================\n');
} catch (err) {
    console.error('\n❌ Gagal membuat APK:', err.message);
    process.exit(1);
}
