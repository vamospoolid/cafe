/**
 * Test Suite: PHASE 15 - Production Readiness & Zero-Impact VPS Deployment
 * Run with: node test_phase15.js
 */

const fs = require('fs');
const path = require('path');

async function runPhase15Tests() {
  console.log('===============================================================');
  console.log('🧪 TEST SUITE: PHASE 15 - Production Readiness & Zero-Impact VPS Deployment');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    const rootDir = path.resolve(__dirname, '..');

    // ─── TEST 1: Deployment Script & Strict Legacy Protection ────────────────
    console.log('--- TEST 1: Deployment Script & Strict Legacy Protection ---');
    const deployScriptPath = path.join(rootDir, 'scripts', 'deploy_saas.sh');
    assert(fs.existsSync(deployScriptPath), `Production deployment script exists: scripts/deploy_saas.sh`);

    const deployContent = fs.readFileSync(deployScriptPath, 'utf-8');
    assert(deployContent.includes('TARGET_DIR="/var/www/codepos"'), `Deployment script targets /var/www/codepos exclusively`);
    assert(deployContent.includes('PM2_APP_NAME="codepos-backend"'), `PM2 process name is set to codepos-backend`);
    assert(deployContent.includes('FATAL ERROR') && deployContent.includes('/var/www/poscafe'), `Strict safety assertion prevents overwriting /var/www/poscafe`);
    assert(deployContent.includes('api/health/ping') || deployContent.includes('api/health/deep'), `Automated post-deploy health check is integrated`);

    // ─── TEST 2: PM2 Ecosystem Configuration ────────────────────────────────
    console.log('\n--- TEST 2: PM2 Ecosystem Configuration ---');
    const ecosystemPath = path.join(rootDir, 'ecosystem.config.js');
    assert(fs.existsSync(ecosystemPath), `PM2 ecosystem configuration exists: ecosystem.config.js`);

    const ecosystem = require(ecosystemPath);
    assert(Array.isArray(ecosystem.apps) && ecosystem.apps.length > 0, `Ecosystem contains apps array`);
    const appConfig = ecosystem.apps[0];
    assert(appConfig.name === 'codepos-backend', `PM2 app name is codepos-backend`);
    assert(appConfig.cwd === '/var/www/codepos/backend', `PM2 cwd is /var/www/codepos/backend`);
    assert(appConfig.script.includes('dist/src/index.js') || appConfig.script.includes('dist/index.js'), `PM2 script points to compiled TypeScript dist/src/index.js`);
    assert(appConfig.env?.PORT === 5000, `PM2 port configured to 5000`);

    // ─── TEST 3: Nginx Server Block & Wildcard Subdomain Routing ─────────────
    console.log('\n--- TEST 3: Nginx Server Block & Wildcard Subdomain Routing ---');
    const nginxPath = path.join(rootDir, 'deployment', 'nginx', 'codepos.conf');
    assert(fs.existsSync(nginxPath), `Nginx config file exists: deployment/nginx/codepos.conf`);

    const nginxContent = fs.readFileSync(nginxPath, 'utf-8');
    assert(nginxContent.includes('server_name codenusa.id *.codenusa.id;'), `Nginx handles wildcard subdomains (*.codenusa.id)`);
    assert(nginxContent.includes('/var/www/codepos/frontend/dist;'), `Nginx root points to /var/www/codepos/frontend/dist`);
    assert(nginxContent.includes('proxy_pass http://127.0.0.1:5000;'), `Nginx proxies API to backend upstream http://127.0.0.1:5000`);
    assert(nginxContent.includes('proxy_set_header Upgrade $http_upgrade;') && nginxContent.includes('proxy_set_header Connection "upgrade";'), `Nginx WebSockets proxy configuration present`);
    assert(nginxContent.includes('X-Tenant-Host $host;'), `Nginx forwards X-Tenant-Host header for tenant resolution`);
    assert(nginxContent.includes('Strict-Transport-Security'), `Nginx enforces HSTS security header`);

    // ─── TEST 4: Production Environment Variables Template ───────────────────
    console.log('\n--- TEST 4: Production Environment Variables Template ---');
    const envExamplePath = path.join(rootDir, 'deployment', 'env', '.env.production.example');
    assert(fs.existsSync(envExamplePath), `Production .env template exists: deployment/env/.env.production.example`);

    const envContent = fs.readFileSync(envExamplePath, 'utf-8');
    assert(envContent.includes('DATABASE_URL='), `.env template contains DATABASE_URL`);
    assert(envContent.includes('JWT_SECRET='), `.env template contains JWT_SECRET`);
    assert(envContent.includes('PAYMENT_ENCRYPTION_KEY='), `.env template contains PAYMENT_ENCRYPTION_KEY`);
    assert(envContent.includes('BACKUP_ENCRYPTION_KEY='), `.env template contains BACKUP_ENCRYPTION_KEY`);
    assert(envContent.includes('MIDTRANS_SERVER_KEY='), `.env template contains MIDTRANS_SERVER_KEY`);

    // ─── TEST 5: Deployment Documentation & Runbook ──────────────────────────
    console.log('\n--- TEST 5: Deployment Documentation & Runbook ---');
    const docPath = path.join(rootDir, 'docs', 'deployment.md');
    assert(fs.existsSync(docPath), `Deployment documentation exists: docs/deployment.md`);
    const docContent = fs.readFileSync(docPath, 'utf-8');
    assert(docContent.includes('/var/www/codepos'), `Documentation clearly specifies target /var/www/codepos`);
    assert(docContent.includes('/var/www/poscafe'), `Documentation explicitly identifies legacy /var/www/poscafe protection`);

  } catch (err) {
    console.error('Unhandled test execution error:', err);
    failed++;
  }

  console.log('\n===============================================================');
  console.log(`🏁 PHASE 15 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runPhase15Tests();
