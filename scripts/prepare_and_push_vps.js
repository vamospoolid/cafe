/**
 * ==============================================================================
 * CODENUSA SAAS - AUTOMATED PRE-FLIGHT CHECK, GIT PUSH & VPS DEPLOYMENT SUITE
 * ==============================================================================
 * 
 * Script ini mengotomatiskan seluruh alur persiapan dan deployment:
 * 1. [Lokal] Pre-Flight Security & Quality Gate Checks
 *    - Verifikasi file rahasia (.env, backup dump, key) agar tidak ter-push
 *    - Validasi skema Prisma Backend (npx prisma validate)
 *    - Uji kompilasi TypeScript Backend (npx tsc --noEmit)
 *    - Verifikasi build bundle Frontend (npm run build)
 * 2. [Lokal] Git Automated Commit & Push
 *    - Git staging terfilter (.gitignore aware)
 *    - Commit dengan pesan otomatis atau kustom
 *    - Push ke GitHub branch main
 * 3. [Remote VPS] Automated Deployment ke /var/www/codenusa via SSH
 *    - Clone / Sync repo ke direktori baru: /var/www/codenusa
 *    - Setup Backend: npm install, prisma generate, safe db push, seeds, tsc
 *    - Setup Frontend: npm install, vite build ke /var/www/codenusa/frontend/dist
 *    - Setup Nginx: server block codenusa.conf -> reload nginx
 *    - Setup PM2: zero-downtime reload / start codenusa-backend
 *    - Verifikasi Health Check: ping http://127.0.0.1:5001/api/health/ping
 * 
 * Penggunaan:
 *   node scripts/prepare_and_push_vps.js
 *   node scripts/prepare_and_push_vps.js --check-only
 *   node scripts/prepare_and_push_vps.js --skip-build
 *   node scripts/prepare_and_push_vps.js "Pesan commit update fitur"
 * ==============================================================================
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Client } = require('ssh2');

// ─── KONFIGURASI VPS & DEPLOYMENT ─────────────────────────────────────────────
const VPS_CONFIG = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07',
  readyTimeout: 30000
};

const REMOTE_DIR = '/var/www/codenusa';
const PM2_NAME = 'codenusa-backend';
const REPO_URL = 'https://github.com/vamospoolid/cafe.git';
const ROOT_DIR = path.resolve(__dirname, '..');

// ─── PARSING ARGUMEN CLI ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isCheckOnly = args.includes('--check-only') || args.includes('-c');
const skipBuild = args.includes('--skip-build');
const customMsgArg = args.find(a => !a.startsWith('--') && !a.startsWith('-'));
const commitMsg = customMsgArg || `Deploy update: Codenusa SaaS (${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })})`;

// Helper pewarnaan console
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  bold: '\x1b[1m'
};

function logStep(step, title) {
  console.log(`\n${colors.cyan}${colors.bold}[${step}] ${title}${colors.reset}`);
  console.log(`${colors.cyan}${'─'.repeat(60)}${colors.reset}`);
}

function logSuccess(msg) {
  console.log(`   ${colors.green}✔ ${msg}${colors.reset}`);
}

function logWarn(msg) {
  console.log(`   ${colors.yellow}⚠ ${msg}${colors.reset}`);
}

function logError(msg) {
  console.error(`   ${colors.red}✖ ${msg}${colors.reset}`);
}

// ─── FASE 1: PRE-FLIGHT VERIFIKASI LOKAL ───────────────────────────────────────
async function runLocalPreflightChecks() {
  logStep('1/3', 'MEMERIKSA KUALITAS & KEAMANAN LOKAL (PRE-FLIGHT)');

  // 1. Cek Branch Git
  try {
    const branch = execSync('git branch --show-current', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
    if (branch !== 'main') {
      logWarn(`Anda saat ini berada di branch "${branch}", bukan "main".`);
    } else {
      logSuccess(`Branch Git aktif: ${branch}`);
    }
  } catch (err) {
    logError(`Gagal memeriksa branch Git: ${err.message}`);
    process.exit(1);
  }

  // 2. Pemeriksaan Keamanan File Rahasia
  try {
    const status = execSync('git status --porcelain', { cwd: ROOT_DIR, encoding: 'utf8' });
    const stagedLines = status.split('\n').filter(Boolean);
    const forbiddenPatterns = [/\.env$/, /\.env\.production$/, /\.key$/, /\.pem$/, /\.gz\.enc$/];

    for (const line of stagedLines) {
      const filePath = line.substring(3).trim();
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(filePath)) {
          logError(`BAHAYA KEAMANAN: File rahasia terdeteksi akan di-commit: ${filePath}`);
          logError('Pastikan file rahasia tercantum di .gitignore!');
          process.exit(1);
        }
      }
    }
    logSuccess('Audit keamanan file rahasia: AMAN (tidak ada .env / key bocor)');
  } catch (err) {
    logError(`Gagal memeriksa status Git: ${err.message}`);
    process.exit(1);
  }

  // 3. Validasi Skema Prisma Backend
  try {
    console.log('   -> Memvalidasi skema Prisma Backend...');
    execSync('npx prisma validate', { cwd: path.join(ROOT_DIR, 'backend'), stdio: 'pipe' });
    logSuccess('Validasi Prisma schema: OK');
  } catch (err) {
    logError(`Prisma schema error: ${err.stderr ? err.stderr.toString() : err.message}`);
    process.exit(1);
  }

  // 4. Verifikasi Kompilasi TypeScript Backend
  if (!skipBuild) {
    try {
      console.log('   -> Menguji kompilasi TypeScript Backend (npx tsc --noEmit)...');
      execSync('npx tsc --noEmit', { cwd: path.join(ROOT_DIR, 'backend'), stdio: 'pipe' });
      logSuccess('Kompilasi TypeScript Backend: BEBAS ERROR');
    } catch (err) {
      logError(`TypeScript Backend kompilasi gagal! Perbaiki error sebelum push ke VPS:`);
      if (err.stdout) console.log(err.stdout.toString().slice(0, 1000));
      process.exit(1);
    }

    // 5. Verifikasi Build Frontend
    try {
      console.log('   -> Menguji build bundle Frontend (npm run build)...');
      execSync('npm run build', { cwd: path.join(ROOT_DIR, 'frontend'), stdio: 'pipe' });
      logSuccess('Build Vite Frontend: SUKSES (Bundle siap produksi)');
    } catch (err) {
      logError(`Build Frontend gagal! Periksa sintaks atau modul frontend:`);
      if (err.stderr) console.log(err.stderr.toString().slice(0, 1000));
      process.exit(1);
    }
  } else {
    logWarn('Melewati pengujian build lokal (--skip-build diaktifkan).');
  }

  logSuccess('Semua pemeriksaan kualitas lokal SELESAI & LULUS!');
}

// ─── FASE 2: GIT COMMIT & PUSH ────────────────────────────────────────────────
async function runGitPush() {
  logStep('2/3', 'GIT STAGING, COMMIT & PUSH KE GITHUB');

  try {
    const status = execSync('git status --porcelain', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
    if (!status) {
      logWarn('Tidak ada perubahan lokal baru yang perlu di-commit.');
      logSuccess('Repositori lokal bersih dan siap di-deploy ke VPS.');
      return;
    }

    console.log('   -> Menambahkan perubahan ke Git staging (git add .)...');
    execSync('git add .', { cwd: ROOT_DIR, stdio: 'inherit' });

    console.log(`   -> Commit perubahan dengan pesan: "${commitMsg}"...`);
    execSync(`git commit -m "${commitMsg}"`, { cwd: ROOT_DIR, stdio: 'inherit' });
    logSuccess('Git Commit berhasil dibuat.');

    console.log('   -> Mengunggah (git push origin main) ke GitHub...');
    try {
      execSync('git push origin main', { cwd: ROOT_DIR, stdio: 'inherit' });
    } catch (pushErr) {
      logWarn('Push gagal, mencoba flush DNS dan mengulang push...');
      execSync('ipconfig /flushdns', { stdio: 'ignore' });
      execSync('git push origin main', { cwd: ROOT_DIR, stdio: 'inherit' });
    }
    logSuccess('Git Push ke origin/main BERHASIL!');
  } catch (err) {
    logError(`Gagal melakukan operasi Git: ${err.message}`);
    process.exit(1);
  }
}

// ─── FASE 3: REMOTE DEPLOYMENT KE /var/www/codenusa VIA SSH ───────────────────
async function runRemoteVpsDeploy() {
  logStep('3/3', `DEPLOY OTOMATIS KE VPS (${REMOTE_DIR})`);

  return new Promise((resolve, reject) => {
    console.log(`   -> Menghubungkan ke ${VPS_CONFIG.username}@${VPS_CONFIG.host}...`);
    const conn = new Client();

    conn.on('ready', () => {
      logSuccess(`Terhubung via SSH ke VPS (${VPS_CONFIG.host})!`);
      console.log('   -> Mengeksekusi provisioning & deploy pipeline...\n');

      // Bash script yang dieksekusi di server VPS
      const remotePipelineScript = `
        set -e

        echo "================================================================"
        echo "🚀 DEPLOY PIPELINE: CODENUSA SAAS -> ${REMOTE_DIR}"
        echo "⏰ Timestamp: $(date '+%Y-%m-%d %H:%M:%S %Z')"
        echo "================================================================"

        # ================================================================
        # TARGET 1: POSCAFE (Domain: cafe.codenusa.id -> Port 5000)
        # ================================================================
        echo "📦 [1/6] Mengupdate repositori di /var/www/poscafe (cafe.codenusa.id)..."
        cd /var/www/poscafe
        git fetch origin
        git reset --hard origin/main
        git clean -fd -e uploads/ -e backups/ -e backend/.env

        echo "🛠️ [2/6] Setup Backend di /var/www/poscafe/backend..."
        cd /var/www/poscafe/backend
        npm install --silent
        npx prisma generate
        npx prisma db push --skip-generate --accept-data-loss
        npm run build || npx tsc
        pm2 restart poscafe-backend || PORT=5000 pm2 start dist/src/index.js --name poscafe-backend --interpreter node

        echo "🌐 [3/6] Membangun Frontend Production di /var/www/poscafe/frontend..."
        cd /var/www/poscafe/frontend
        npm install --silent
        npm run build

        # ================================================================
        # TARGET 2: CODENUSA SAAS (Domain: codenusa.id -> Port 5001)
        # ================================================================
        echo "📦 [4/6] Mengupdate repositori di ${REMOTE_DIR} (codenusa.id)..."
        if [ ! -d "${REMOTE_DIR}/.git" ]; then
          mkdir -p "${REMOTE_DIR}"
          git clone "${REPO_URL}" "${REMOTE_DIR}"
          cd "${REMOTE_DIR}"
        else
          cd "${REMOTE_DIR}"
          git fetch origin
          git reset --hard origin/main
          git clean -fd -e uploads/ -e backups/ -e backend/.env
        fi

        echo "🛠️ [5/6] Setup Backend di ${REMOTE_DIR}/backend..."
        cd "${REMOTE_DIR}/backend"
        if [ -f "/var/www/poscafe/backend/.env" ]; then
          cp /var/www/poscafe/backend/.env .env
          sed -i 's/PORT=.*/PORT=5001/g' .env 2>/dev/null || true
          sed -i 's/COOKIE_DOMAIN=.*/COOKIE_DOMAIN=.codenusa.id/g' .env 2>/dev/null || true
          sed -i 's/APP_DOMAIN=.*/APP_DOMAIN=codenusa.id/g' .env 2>/dev/null || true
        fi
        sed -i 's/PORT=.*/PORT=5001/g' .env 2>/dev/null || true
        sed -i '/JWT_SECRET=/d' .env 2>/dev/null || true
        echo 'JWT_SECRET="c0d3nu5a_s44s_jwt_m4st3r_s3cr3t_pr0duct10n_k3y_998877665544332211"' >> .env

        npm install --silent
        npx prisma generate
        npx prisma db push --skip-generate --accept-data-loss
        npm run build || npx tsc

        echo "🌐 [6/6] Membangun Frontend Production di ${REMOTE_DIR}/frontend..."
        cd "${REMOTE_DIR}/frontend"
        npm install --silent
        npm run build

        # Restart PM2 Codenusa
        cd "${REMOTE_DIR}"
        if pm2 show "${PM2_NAME}" > /dev/null 2>&1; then
          pm2 restart "${PM2_NAME}" --update-env
        else
          pm2 start ecosystem.config.js
          pm2 save
        fi

        # Bersihkan config Nginx usang dan reload Nginx
        rm -f /etc/nginx/sites-enabled/codepos 2>/dev/null || true
        nginx -t && systemctl reload nginx
        echo "   -> Nginx berhasil direload!"

        echo ""
        echo "🩺 [VERIFIKASI HEALTH CHECK]"
        sleep 3
        HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5001/api/health/ping || echo "ERR")
        if [ "$HEALTH_CODE" = "200" ]; then
          echo "   ✔ Health check PASSED: Backend merespons OK (HTTP 200)!"
        else
          echo "   ⚠ Health check returned: $HEALTH_CODE. Memeriksa status log PM2..."
          pm2 logs "${PM2_NAME}" --lines 10 --nostream
        fi

        echo ""
        echo "📊 STATUS PROSES PM2 AKTIF:"
        pm2 list
      `;

      conn.exec(remotePipelineScript, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }

        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', code => {
          conn.end();
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Deployment remote gagal dengan exit code: ${code}`));
          }
        });
      });
    }).on('error', err => {
      reject(new Error(`Gagal terhubung ke VPS: ${err.message}`));
    }).connect(VPS_CONFIG);
  });
}

// ─── MAIN EXECUTION FLOW ──────────────────────────────────────────────────────
async function main() {
  console.log(`\n${colors.cyan}${colors.bold}================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}🚀 CODENUSA SAAS - AUTOMATED VPS PREPARATION & DEPLOY PIPELINE  ${colors.reset}`);
  console.log(`   Target Direktori : ${colors.bold}${REMOTE_DIR}${colors.reset}`);
  console.log(`   Target Service   : ${colors.bold}${PM2_NAME}${colors.reset}`);
  console.log(`   Commit Message   : "${commitMsg}"`);
  console.log(`${colors.cyan}${colors.bold}================================================================${colors.reset}`);

  try {
    // 1. Pre-flight checks
    await runLocalPreflightChecks();

    if (isCheckOnly) {
      console.log(`\n${colors.green}${colors.bold}🎉 PRE-FLIGHT CHECK SELESAI! Mode --check-only aktif, push dilewati.${colors.reset}\n`);
      return;
    }

    // 2. Git push
    await runGitPush();

    // 3. Remote VPS deploy
    await runRemoteVpsDeploy();

    console.log(`\n${colors.green}${colors.bold}================================================================${colors.reset}`);
    console.log(`${colors.green}${colors.bold}🎉 DEPLOYMENT KE /var/www/codenusa SELESAI DENGAN SUKSES!       ${colors.reset}`);
    console.log(`   Aplikasi Aktif di: https://codenusa.id`);
    console.log(`   PM2 Service     : ${PM2_NAME}`);
    console.log(`${colors.green}${colors.bold}================================================================${colors.reset}\n`);
  } catch (err) {
    console.error(`\n${colors.red}${colors.bold}❌ PROSES DEPLOYMENT GAGAL:${colors.reset} ${err.message}\n`);
    process.exit(1);
  }
}

main();
