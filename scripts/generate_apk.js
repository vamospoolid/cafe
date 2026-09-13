const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const mobileDir = path.join(rootDir, 'mobile');
const androidDir = path.join(mobileDir, 'android');
const releaseDir = path.join(rootDir, 'release');

console.log('==================================================');
console.log('🚀 PROSES GENERATE APK ANDROID (STAFF & ABSENSI) 🚀');
console.log('==================================================');

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

try {
    // 2. Sync Capacitor
    console.log('\n[1/3] 🔄 Menyinkronkan asset & plugin ke Android (Capacitor Sync)...');
    execSync('npx cap sync android', { cwd: mobileDir, stdio: 'inherit', env });

    // 3. Build APK via Gradle
    console.log('\n[2/3] ⚙️  Mengompilasi Native APK via Gradle...');
    const gradlewCmd = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
    execSync(`${gradlewCmd} assembleDebug`, { cwd: androidDir, stdio: 'inherit', env });

    // 4. Salin APK ke folder release
    console.log('\n[3/3] 📦 Memindahkan file APK ke folder release...');
    if (!fs.existsSync(releaseDir)) {
        fs.mkdirSync(releaseDir, { recursive: true });
    }

    const sourceApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
    const targetApk = path.join(releaseDir, 'muki-staff-pos.apk');
    const targetDebug = path.join(releaseDir, 'app-debug.apk');

    if (fs.existsSync(sourceApk)) {
        fs.copyFileSync(sourceApk, targetApk);
        fs.copyFileSync(sourceApk, targetDebug);

        const stats = fs.statSync(targetApk);
        const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

        console.log('\n==================================================');
        console.log('✅ APK BERHASIL DIGENERATE!');
        console.log('==================================================');
        console.log(`📁 Lokasi APK : ${targetApk}`);
        console.log(`⚖️  Ukuran File: ${sizeMb} MB`);
        console.log(`📱 Siap diinstall di HP Android Staf.`);
        console.log('==================================================\n');
    } else {
        throw new Error('File APK tidak ditemukan di direktori build output.');
    }
} catch (err) {
    console.error('\n❌ Gagal membuat APK:', err.message);
    process.exit(1);
}
