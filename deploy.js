const { execSync } = require('child_process');
const { Client } = require('ssh2');

// Konfigurasi SSH VPS
const sshConfig = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const appDir = '/var/www/poscafe';

// Target deploy: 'all', 'backend', 'frontend'
const target = process.argv[2] || 'all';
// Pesan commit custom (opsional)
const commitMsg = process.argv[3] || `Deploy update: ${new Date().toLocaleString('id-ID')}`;

console.log('====================================================');
console.log(`🚀 MEMULAI PROSES DEPLOYMENT (${target.toUpperCase()})`);
console.log('====================================================\n');

// 1. Git lokal
try {
    console.log('📦 [1/3] Memeriksa perubahan Git lokal...');
    
    // Cek apakah ada perubahan file lokal
    const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    
    if (status) {
        console.log('   -> Perubahan terdeteksi. Menambahkan file ke Git...');
        execSync('git add .', { stdio: 'inherit' });
        
        console.log(`   -> Commit dengan pesan: "${commitMsg}"`);
        execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });
        
        console.log('   -> Mengunggah (push) kode ke GitHub...');
        execSync('git push origin main', { stdio: 'inherit' });
        console.log('✅ Git Push Berhasil!\n');
    } else {
        console.log('   -> Tidak ada perubahan lokal baru yang perlu di-commit.\n');
    }
} catch (error) {
    console.error('❌ Gagal pada proses Git lokal:', error.message);
    process.exit(1);
}

// 2. SSH deploy ke VPS
console.log('🌐 [2/3] Menghubungkan ke server VPS via SSH...');
const conn = new Client();

let remoteCmd = '';
if (target === 'backend') {
    remoteCmd = `
    cd ${appDir}
    echo "=== PULLING LATEST CODE ==="
    git reset --hard && git pull origin main
    
    echo "=== SETTING UP BACKEND ==="
    cd backend
    npx prisma db push --accept-data-loss
    npx tsc
    pm2 restart poscafe-backend
    echo "✅ Backend updated & restarted!"
    `;
} else if (target === 'frontend') {
    remoteCmd = `
    cd ${appDir}
    echo "=== PULLING LATEST CODE ==="
    git reset --hard && git pull origin main
    
    echo "=== BUILDING FRONTEND ==="
    cd frontend
    npm install
    npm run build
    echo "✅ Frontend updated & rebuilt!"
    `;
} else {
    // default/all
    remoteCmd = `
    cd ${appDir}
    echo "=== PULLING LATEST CODE ==="
    git reset --hard && git pull origin main
    
    echo "=== SETTING UP BACKEND ==="
    cd backend
    npx prisma db push --accept-data-loss
    npx tsc
    pm2 restart poscafe-backend
    
    echo "=== BUILDING FRONTEND ==="
    cd ../frontend
    npm install
    npm run build
    echo "✅ All components updated successfully!"
    `;
}

conn.on('ready', () => {
    console.log('✅ Berhasil terhubung ke VPS!');
    console.log('⚙️  Menjalankan skrip deploy di VPS...\n');
    
    conn.exec(remoteCmd, (err, stream) => {
        if (err) {
            console.error('❌ Gagal menjalankan skrip di VPS:', err.message);
            conn.end();
            process.exit(1);
        }
        
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', (code) => {
            console.log('\n====================================================');
            console.log(`🎉 [3/3] DEPLOY SELESAI DENGAN KODE: ${code}`);
            console.log('====================================================');
            conn.end();
        });
    });
}).on('error', (err) => {
    console.error('❌ Gagal terhubung ke VPS:', err.message);
}).connect(sshConfig);
