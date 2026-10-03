-- Migration: Add retail UOM & pricing tier snapshot fields to OrderItem
-- Required for: Retail vertical checkout (uomName, uomRatio, priceTierName)
-- Bug: POST /api/orders returns 500 because these columns don't exist in production

-- Add uomName column (nullable, stores unit of measure name like DUS, KARTON, BAL)
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "uomName" TEXT;

-- Add uomRatio column (nullable, stores multiplier to base unit, e.g. 40 for DUS of 40 PCS)
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "uomRatio" DOUBLE PRECISION;

-- Add priceTierName column (nullable, stores price tier label like Eceran, Grosir Partai)
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "priceTierName" TEXT;
