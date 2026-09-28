const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("================================================================");
  console.log("🔍 AUDIT DEDUPLIKASI PRA-MIGRASI MULTI-TENANT (CodePOS)");
  console.log("================================================================\n");

  try {
    // 1. Customer Phone Duplicates
    const duplicateCustomers = await prisma.$queryRawUnsafe(`
      SELECT "tenantId", "phone", COUNT(*)::int as count
      FROM "Customer"
      WHERE "phone" IS NOT NULL AND "phone" <> ''
      GROUP BY "tenantId", "phone"
      HAVING COUNT(*) > 1
    `);
    console.log(`[1] Duplikasi No. HP Pelanggan (Customer.phone per tenant): ${duplicateCustomers.length === 0 ? '✅ AMAN (0 Duplikat)' : '⚠️ DITEMUKAN ' + duplicateCustomers.length + ' DUPLIKAT'}`);
    if (duplicateCustomers.length > 0) console.table(duplicateCustomers);

    // 2. Product Barcode Duplicates
    const duplicateBarcodes = await prisma.$queryRawUnsafe(`
      SELECT "tenantId", "barcode", COUNT(*)::int as count
      FROM "Product"
      WHERE "barcode" IS NOT NULL AND "barcode" <> ''
      GROUP BY "tenantId", "barcode"
      HAVING COUNT(*) > 1
    `);
    console.log(`[2] Duplikasi Barcode Produk (Product.barcode per tenant): ${duplicateBarcodes.length === 0 ? '✅ AMAN (0 Duplikat)' : '⚠️ DITEMUKAN ' + duplicateBarcodes.length + ' DUPLIKAT'}`);
    if (duplicateBarcodes.length > 0) console.table(duplicateBarcodes);

    // 3. Vehicle Plate Duplicates
    const duplicatePlates = await prisma.$queryRawUnsafe(`
      SELECT "tenantId", "plateNumber", COUNT(*)::int as count
      FROM "Vehicle"
      WHERE "plateNumber" IS NOT NULL AND "plateNumber" <> ''
      GROUP BY "tenantId", "plateNumber"
      HAVING COUNT(*) > 1
    `);
    console.log(`[3] Duplikasi Plat Kendaraan (Vehicle.plateNumber per tenant): ${duplicatePlates.length === 0 ? '✅ AMAN (0 Duplikat)' : '⚠️ DITEMUKAN ' + duplicatePlates.length + ' DUPLIKAT'}`);
    if (duplicatePlates.length > 0) console.table(duplicatePlates);

    // 4. WorkOrder SPK Duplicates
    const duplicateSpk = await prisma.$queryRawUnsafe(`
      SELECT "tenantId", "spkNumber", COUNT(*)::int as count
      FROM "WorkOrder"
      WHERE "spkNumber" IS NOT NULL AND "spkNumber" <> ''
      GROUP BY "tenantId", "spkNumber"
      HAVING COUNT(*) > 1
    `);
    console.log(`[4] Duplikasi No. SPK (WorkOrder.spkNumber per tenant): ${duplicateSpk.length === 0 ? '✅ AMAN (0 Duplikat)' : '⚠️ DITEMUKAN ' + duplicateSpk.length + ' DUPLIKAT'}`);
    if (duplicateSpk.length > 0) console.table(duplicateSpk);

    console.log("\n================================================================");
    if (duplicateCustomers.length === 0 && duplicateBarcodes.length === 0 && duplicatePlates.length === 0 && duplicateSpk.length === 0) {
      console.log("🏁 HASIL AUDIT: SEMUA DATA BERSIH & SIAP MIGRASI KE PRODUCTION!");
    } else {
      console.log("⚠️ PERHATIAN: Bersihkan data duplikat di atas sebelum menerapkan compound unique index.");
    }
    console.log("================================================================\n");

  } catch (err) {
    console.error("Gagal menjalankan audit deduplikasi:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
