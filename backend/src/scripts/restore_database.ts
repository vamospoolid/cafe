import 'dotenv/config';
import { BackupService } from '../services/BackupService';

async function main() {
  console.log('=====================================================');
  console.log('♻️  Codenusa SaaS Database Disaster Recovery Restore CLI');
  console.log('=====================================================');

  const args = process.argv.slice(2);
  const fileArg = args.find(a => a.startsWith('--file='));
  const fileName = fileArg ? fileArg.split('=')[1] : undefined;

  const tenantArg = args.find(a => a.startsWith('--tenant='));
  const targetTenantId = tenantArg ? tenantArg.split('=')[1] : undefined;

  if (!fileName) {
    console.error('❌ Error: Parameter --file=<backup_file_name> is required.');
    console.log('Contoh: npx ts-node src/scripts/restore_database.ts --file=backup-full-2026-09-18.json.gz.enc');
    process.exit(1);
  }

  console.log(`[Target File] ${fileName}`);
  if (targetTenantId) console.log(`[Target Tenant Override] ${targetTenantId}`);

  try {
    console.log('\n[1/2] Verifying checksum, decrypting & uncompressing...');
    const result = await BackupService.restoreBackup(fileName, targetTenantId);

    console.log(`\n[2/2] ✅ ${result.message}`);
    if (result.recordCounts) {
      console.log('📊 Restored Entities:');
      for (const [key, count] of Object.entries(result.recordCounts)) {
        console.log(`   - ${key}: ${count}`);
      }
    }

    console.log('\n✅ Disaster Recovery Restore Completed Successfully.');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Restore failed:', error.message || error);
    process.exit(1);
  }
}

main();
