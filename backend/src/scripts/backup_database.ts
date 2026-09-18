import 'dotenv/config';
import { BackupService } from '../services/BackupService';

async function main() {
  console.log('=====================================================');
  console.log('📦 Codenusa SaaS Database Backup CLI Engine');
  console.log('=====================================================');

  const args = process.argv.slice(2);
  const isEncrypted = !args.includes('--no-encrypt');
  const shouldPurge = args.includes('--purge');
  const tenantArg = args.find(a => a.startsWith('--tenant='));
  const tenantId = tenantArg ? tenantArg.split('=')[1] : undefined;

  const retentionArg = args.find(a => a.startsWith('--retention='));
  const retentionDays = retentionArg ? parseInt(retentionArg.split('=')[1], 10) : 30;

  console.log(`[Config] Encryption: ${isEncrypted ? 'AES-256 Enabled 🔒' : 'Disabled ⚠️'}`);
  console.log(`[Config] Scope: ${tenantId ? `Tenant (${tenantId})` : 'Full Platform (All Tenants)'}`);
  console.log(`[Config] Retention Policy: ${retentionDays} Days`);

  try {
    console.log('\n[1/3] Generating database snapshot & packaging...');
    const backup = await BackupService.createBackup({
      tenantId,
      isEncrypted,
      compress: true,
      type: 'json'
    });

    console.log(`✅ Backup Created Successfully!`);
    console.log(`   📁 File: ${backup.fileName}`);
    console.log(`   📊 Size: ${(backup.sizeBytes / 1024).toFixed(2)} KB`);
    console.log(`   🔐 Checksum SHA-256: ${backup.checksumSha256}`);
    console.log(`   🏷️  Scope: ${backup.scope}`);

    if (shouldPurge) {
      console.log(`\n[2/3] Executing automated backup retention purge (> ${retentionDays} days)...`);
      const purgeResult = await BackupService.purgeOldBackups(retentionDays);
      console.log(`✅ Retention Purge Completed:`);
      console.log(`   🗑️  Deleted: ${purgeResult.deletedCount} files`);
      console.log(`   💾 Freed Space: ${(purgeResult.freedBytes / 1024).toFixed(2)} KB`);
      console.log(`   📦 Retained: ${purgeResult.retainedCount} backups`);
    }

    console.log('\n[3/3] Backup operation finished with 0 errors.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

main();
