const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..');

const files = [
  'middlewares/authMiddleware.ts',
  'middlewares/tenantResolver.ts',
  'routes/analytics.ts',
  'routes/attendance.ts',
  'routes/auth.ts',
  'routes/cashflow.ts',
  'routes/categories.ts',
  'routes/customers.ts',
  'routes/database.ts',
  'routes/debts.ts',
  'routes/employeeLoans.ts',
  'routes/health.ts',
  'routes/ingredients.ts',
  'routes/kds.ts',
  'routes/orders.ts',
  'routes/platformAdmin.ts',
  'routes/printer.ts',
  'routes/products.ts',
  'routes/purchaseOrders.ts',
  'routes/recipes.ts',
  'routes/recycleBin.ts',
  'routes/reservations.ts',
  'routes/settings.ts',
  'routes/shifts.ts',
  'routes/suppliers.ts',
  'routes/tables.ts',
  'routes/tenantReset.ts',
  'routes/users.ts',
  'routes/vouchers.ts',
  'routes/warehouse.ts',
  'routes/waste.ts',
  'services/AuditLogger.ts',
  'services/BackupService.ts',
  'services/FeatureService.ts',
  'services/PaymentService.ts',
  'services/QuotaService.ts',
  'scripts/apply_rls.ts',
  'scripts/audit.ts'
];

files.forEach(relFile => {
  const filePath = path.join(baseDir, relFile);
  let content = fs.readFileSync(filePath, 'utf8');

  // Determine import path for db.ts
  const depth = relFile.split('/').length - 1;
  const dbImportPath = depth === 1 ? '../db' : './db';

  // Check if prisma is already imported from db
  const hasPrismaDbImport = new RegExp(`import\\s+prisma\\s+from\\s+['"]\\.?\\.?\\/db['"]`).test(content);

  // Replace `const prisma = new PrismaClient();`
  const hasNewPrisma = /const\s+prisma\s*=\s*new\s+PrismaClient\s*\([^)]*\);?/.test(content);
  if (hasNewPrisma) {
    content = content.replace(/const\s+prisma\s*=\s*new\s+PrismaClient\s*\([^)]*\);?\r?\n?/, '');
  }

  // Handle @prisma/client import of PrismaClient
  // 1. If only PrismaClient: `import { PrismaClient } from '@prisma/client';`
  content = content.replace(/import\s*\{\s*PrismaClient\s*\}\s*from\s*['"]@prisma\/client['"];?\r?\n?/, '');

  // 2. If PrismaClient with others: `import { PrismaClient, Prisma } from '@prisma/client';`
  content = content.replace(/import\s*\{\s*PrismaClient\s*,\s*([^}]+)\}\s*from\s*['"]@prisma\/client['"]/, "import { $1 } from '@prisma/client'");
  content = content.replace(/import\s*\{\s*([^}]+),\s*PrismaClient\s*\}\s*from\s*['"]@prisma\/client['"]/, "import { $1 } from '@prisma/client'");

  // Add db import if missing
  if (!hasPrismaDbImport) {
    content = `import prisma from '${dbImportPath}';\n` + content;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated ${relFile}`);
});

console.log('Successfully refactored all files to use singleton prisma!');
