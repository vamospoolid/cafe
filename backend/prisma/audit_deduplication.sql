-- ============================================================================
-- CODENUSA MULTI-TENANT SAAS POS: PRE-MIGRATION DEDUPLICATION AUDIT
-- Phase: Database Integrity Verification
-- ============================================================================

-- 1. Check duplicate phone numbers in Customer within the same tenant
SELECT 
  "tenantId", 
  "phone", 
  COUNT(*) as duplicate_count,
  ARRAY_AGG("id") as customer_ids,
  ARRAY_AGG("name") as customer_names
FROM "Customer"
WHERE "phone" IS NOT NULL AND "phone" <> ''
GROUP BY "tenantId", "phone"
HAVING COUNT(*) > 1;

-- 2. Check duplicate barcodes in Product within the same tenant
SELECT 
  "tenantId", 
  "barcode", 
  COUNT(*) as duplicate_count,
  ARRAY_AGG("id") as product_ids,
  ARRAY_AGG("name") as product_names
FROM "Product"
WHERE "barcode" IS NOT NULL AND "barcode" <> ''
GROUP BY "tenantId", "barcode"
HAVING COUNT(*) > 1;

-- 3. Check duplicate plateNumbers in Vehicle within the same tenant
SELECT 
  "tenantId", 
  "plateNumber", 
  COUNT(*) as duplicate_count,
  ARRAY_AGG("id") as vehicle_ids
FROM "Vehicle"
WHERE "plateNumber" IS NOT NULL AND "plateNumber" <> ''
GROUP BY "tenantId", "plateNumber"
HAVING COUNT(*) > 1;

-- 4. Check duplicate spkNumbers in WorkOrder within the same tenant
SELECT 
  "tenantId", 
  "spkNumber", 
  COUNT(*) as duplicate_count,
  ARRAY_AGG("id") as work_order_ids
FROM "WorkOrder"
WHERE "spkNumber" IS NOT NULL AND "spkNumber" <> ''
GROUP BY "tenantId", "spkNumber"
HAVING COUNT(*) > 1;
