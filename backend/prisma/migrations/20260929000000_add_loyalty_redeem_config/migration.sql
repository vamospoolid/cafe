-- Migration: add_loyalty_redeem_config
-- Tanggal: 2026-09-29

-- 1. Tambah 3 field konfigurasi penukaran poin di tabel Settings
ALTER TABLE "Settings" 
  ADD COLUMN IF NOT EXISTS "loyaltyMaxRedeemPerOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "loyaltyRedeemMinPoints"   INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "loyaltyMinOrderForEarn"   DOUBLE PRECISION NOT NULL DEFAULT 0;

-- 2. Tambah orderId di PointLog untuk traceability (nullable)
ALTER TABLE "PointLog"
  ADD COLUMN IF NOT EXISTS "orderId" INTEGER;

-- 3. Tambah foreign key constraint (dengan SetNull on delete)
ALTER TABLE "PointLog"
  ADD CONSTRAINT "PointLog_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Index untuk query lookup per order
CREATE INDEX IF NOT EXISTS "PointLog_orderId_idx" ON "PointLog"("orderId");
