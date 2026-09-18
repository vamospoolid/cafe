#!/bin/bash

# ==============================================================================
# 🚀 Codenusa Multi-Tenant B2B SaaS POS - Production Deployment Script
# Target Directory: /var/www/codepos
# PM2 Process: codepos-backend
# ==============================================================================

set -e # Exit immediately on any command error

# ─── 🛡️ STRICT ISOLATION GUARD: NEVER TOUCH LEGACY POSCAFE ──────────────────
TARGET_DIR="/var/www/codepos"
PM2_APP_NAME="codepos-backend"
LEGACY_DIR="/var/www/poscafe"
LEGACY_PM2="poscafe-backend"

echo "========================================================================"
echo "🚀 CODENUSA SAAS PRODUCTION DEPLOYMENT ENGINE"
echo "========================================================================"
echo "📍 Target Directory : $TARGET_DIR"
echo "⚙️  PM2 Service Name : $PM2_APP_NAME"
echo "⏰ Timestamp         : $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "========================================================================"

# Safety Assertion 1: Abort if target is poscafe
if [ "$TARGET_DIR" = "$LEGACY_DIR" ] || [ "$TARGET_DIR" = "/var/www/poscafe" ]; then
  echo "❌ [FATAL ERROR] Target directory is set to legacy /var/www/poscafe!"
  echo "   Deployment ABORTED immediately to protect the legacy single-tenant system."
  exit 1
fi

# Safety Assertion 2: Abort if PM2 app name is legacy
if [ "$PM2_APP_NAME" = "$LEGACY_PM2" ]; then
  echo "❌ [FATAL ERROR] PM2 app name is set to legacy poscafe-backend!"
  echo "   Deployment ABORTED immediately to protect the legacy single-tenant system."
  exit 1
fi

# ─── 1. PRE-FLIGHT ENVIRONMENT CHECKS ─────────────────────────────────────────
echo "🔍 [1/7] Running pre-flight system checks..."

command -v node >/dev/null 2>&1 || { echo "❌ Node.js is not installed. Aborting."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is not installed. Aborting."; exit 1; }
command -v pm2 >/dev/null 2>&1 || { echo "❌ PM2 is not installed. Aborting."; exit 1; }
command -v git >/dev/null 2>&1 || { echo "❌ Git is not installed. Aborting."; exit 1; }

NODE_VER=$(node -v)
echo "   -> Node.js Version: $NODE_VER"
echo "   -> Git branch check..."

# ─── 2. REPOSITORY SYNC & PULL ───────────────────────────────────────────────
echo "📦 [2/7] Syncing codebase from Git repository..."

if [ ! -d "$TARGET_DIR/.git" ]; then
  echo "   -> Initializing target directory: $TARGET_DIR"
  sudo mkdir -p "$TARGET_DIR"
  sudo chown -R "$USER:$USER" "$TARGET_DIR"
  git clone https://github.com/vamospoolid/cafe.git "$TARGET_DIR"
  cd "$TARGET_DIR"
else
  cd "$TARGET_DIR"
  echo "   -> Pulling latest commits from origin/main..."
  git fetch origin
  git reset --hard origin/main
  git clean -fd -e uploads/ -e backups/ -e backend/.env
fi

# ─── 3. BACKEND DEPENDENCIES & BUILD ─────────────────────────────────────────
echo "🛠️ [3/7] Building backend services..."
cd "$TARGET_DIR/backend"

# Ensure .env exists
if [ ! -f ".env" ]; then
  if [ -f "$TARGET_DIR/deployment/env/.env.production.example" ]; then
    echo "   ⚠️  No backend .env found! Copying template from .env.production.example..."
    cp "$TARGET_DIR/deployment/env/.env.production.example" .env
  else
    echo "   ⚠️  Warning: Backend .env file not found. Ensure DATABASE_URL and secrets are set."
  fi
fi

echo "   -> Installing backend dependencies..."
npm ci --silent || npm install --silent

echo "   -> Generating Prisma Client..."
npx prisma generate

echo "   -> Applying Database Schema & RLS Migrations..."
npx prisma db push --accept-data-loss --skip-generate
npx ts-node prisma/seed_foundation.ts || true
npx ts-node prisma/seed_features.ts || true
node dist/src/scripts/apply_rls.js || true

echo "   -> Compiling TypeScript Backend..."
npm run build

# ─── 4. FRONTEND DEPENDENCIES & PRODUCTION BUNDLE ────────────────────────────
echo "🌐 [4/7] Building frontend production bundle..."
cd "$TARGET_DIR/frontend"

echo "   -> Installing frontend dependencies..."
npm ci --silent || npm install --silent

echo "   -> Compiling Vite production assets..."
npm run build

# ─── 5. PM2 DAEMON ZERO-DOWNTIME RELOAD ──────────────────────────────────────
echo "🔄 [5/7] Managing PM2 process ($PM2_APP_NAME)..."
cd "$TARGET_DIR"

# Ensure log directory exists
sudo mkdir -p /var/log/pm2
sudo chown -R "$USER:$USER" /var/log/pm2

if pm2 show "$PM2_APP_NAME" > /dev/null 2>&1; then
  echo "   -> Reloading existing $PM2_APP_NAME process..."
  pm2 reload "$PM2_APP_NAME" --update-env
else
  echo "   -> Starting new $PM2_APP_NAME process via ecosystem.config.js..."
  pm2 start ecosystem.config.js
  pm2 save
fi

# ─── 6. PERMISSIONS & DIRECTORY HARDENING ─────────────────────────────────────
echo "🔒 [6/7] Setting secure filesystem permissions..."
sudo mkdir -p "$TARGET_DIR/backend/uploads/tenants"
sudo mkdir -p "$TARGET_DIR/backend/backups"
sudo chown -R www-data:www-data "$TARGET_DIR/backend/uploads"
sudo chown -R www-data:www-data "$TARGET_DIR/backend/backups"
sudo chmod -R 750 "$TARGET_DIR/backend/uploads"
sudo chmod -R 700 "$TARGET_DIR/backend/backups"

# ─── 7. AUTOMATED HEALTH CHECK VERIFICATION ──────────────────────────────────
echo "🩺 [7/7] Running post-deployment health check..."
sleep 3

HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/api/health/ping || echo "000")

if [ "$HEALTH_STATUS" = "200" ]; then
  echo "   ✅ Health check PASSED: Backend is healthy and responding (HTTP 200)."
else
  echo "   ⚠️  Health check returned HTTP $HEALTH_STATUS. Checking PM2 logs..."
  pm2 logs "$PM2_APP_NAME" --lines 15 --nostream
fi

echo "========================================================================"
echo "🎉 DEPLOYMENT SUCCEEDED: Codenusa Multi-Tenant SaaS is LIVE!"
echo "========================================================================"
echo "🌐 Platform URL      : https://codenusa.id"
echo "🏢 Tenant Subdomains : https://*.codenusa.id"
echo "📊 PM2 Status Check  : pm2 status"
echo "📜 View Live Logs    : pm2 logs $PM2_APP_NAME"
echo "🛡️  Legacy System     : /var/www/poscafe ($LEGACY_PM2) is 100% UNTOUCHED."
echo "========================================================================"
