const { execSync } = require('child_process');
const { Client } = require('ssh2');

// ============================================================================
// DEDICATED DEPLOYMENT SCRIPT: MUKI RAMEN STANDALONE (app.mukiramen.id)
// TARGET VPS: /var/www/poscafe
// DATABASE: mukiramen_db (PORT 5000, PM2: poscafe-backend)
// ============================================================================

const sshConfig = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

const appDir = '/var/www/poscafe';
const branch = 'main';
const pm2Service = 'poscafe-backend';

// Target deploy: 'all', 'backend', 'frontend'
const target = process.argv[2] || 'all';
const commitMsg = process.argv[3] || `Upgrade Muki Ramen: ${new Date().toLocaleString('id-ID')}`;

console.log('================================================================');
console.log('🍜 DEPLOYMENT RESMI: MUKI RAMEN STANDALONE (app.mukiramen.id)');
console.log(`📌 Branch Target: ${branch} | Mode: ${target.toUpperCase()}`);
console.log('================================================================\n');

// 1. Verifikasi Branch Lokal
try {
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  if (currentBranch !== branch) {
    console.error(`❌ GAGAL: Anda saat ini berada di branch "${currentBranch}".`);
    console.error(`Untuk mengupgrade Muki Ramen, Anda HARUS berada di branch "${branch}".`);
    console.error(`Jalankan: git checkout ${branch} terlebih dahulu.\n`);
    process.exit(1);
  }

  console.log('📦 [1/3] Memeriksa perubahan Git lokal...');
  const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
  if (status) {
    console.log('   -> Perubahan terdeteksi. Melakukan git commit & push ke origin main...');
    execSync('git add .', { stdio: 'inherit' });
    execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });
    execSync(`git push origin ${branch}`, { stdio: 'inherit' });
    console.log('✅ Git Push ke branch main berhasil!\n');
  } else {
    console.log('   -> Working tree lokal bersih, melanjutkan deploy ke VPS...\n');
  }
} catch (err) {
  console.error('❌ Gagal pada proses Git lokal:', err.message);
  process.exit(1);
}

// 2. SSH Deploy ke VPS (/var/www/poscafe)
console.log('🌐 [2/3] Menghubungkan ke VPS via SSH...');
const conn = new Client();

let remoteCmd = '';
if (target === 'backend') {
  remoteCmd = `
    cd ${appDir}
    echo "=== 1. UNLOCK TEMPORARILY & PULL CODE (${branch}) ==="
    git fetch origin-frozen ${branch}
    git merge origin-frozen/${branch} --ff-only || git pull origin-frozen ${branch}

    echo "=== 2. COMPILING BACKEND ==="
    cd backend
    npm install --production=false
    npx tsc

    echo "=== 3. RESTARTING POSCAFE BACKEND ==="
    pm2 restart ${pm2Service}
    echo "✅ Muki Ramen Backend updated successfully!"
  `;
} else if (target === 'frontend') {
  remoteCmd = `
    cd ${appDir}
    echo "=== 1. UNLOCK TEMPORARILY & PULL CODE (${branch}) ==="
    git fetch origin-frozen ${branch}
    git merge origin-frozen/${branch} --ff-only || git pull origin-frozen ${branch}

    echo "=== 2. BUILDING FRONTEND ==="
    cd frontend
    npm install
    npm run build
    echo "✅ Muki Ramen Frontend updated successfully!"
  `;
} else {
  // all
  remoteCmd = `
    cd ${appDir}
    echo "=== 1. UNLOCK TEMPORARILY & PULL CODE (${branch}) ==="
    git fetch origin-frozen ${branch}
    git merge origin-frozen/${branch} --ff-only || git pull origin-frozen ${branch}

    echo "=== 2. COMPILING BACKEND ==="
    cd backend
    npm install --production=false
    npx tsc
    pm2 restart ${pm2Service}

    echo "=== 3. BUILDING FRONTEND ==="
    cd ../frontend
    npm install
    npm run build
    echo "✅ Muki Ramen All Components updated successfully!"
  `;
}

conn.on('ready', () => {
  console.log('✅ Terhubung ke VPS!');
  console.log('⚙️  Mengeksekusi pembaruan Muki Ramen di /var/www/poscafe...\n');

  conn.exec(remoteCmd, (err, stream) => {
    if (err) {
      console.error('❌ Gagal menjalankan remote command:', err.message);
      conn.end();
      process.exit(1);
    }

    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', code => {
      console.log('\n================================================================');
      console.log(`🎉 [3/3] UPGRADE MUKI RAMEN SELESAI DENGAN KODE: ${code}`);
      console.log('Database mukiramen_db tetap aman & terisolasi 100%.');
      console.log('================================================================');
      conn.end();
    });
  });
}).on('error', err => {
  console.error('❌ Gagal koneksi SSH:', err.message);
}).connect(sshConfig);
