-- Migration: add_performance_indexes_security_hardening
-- Generated: 2026-09-30
-- Purpose: Tambah composite indexes untuk Customer, Debt, dan Voucher
--          guna meningkatkan performa query CRM, piutang aging, dan validasi voucher
--          serta eliminasi full table scan lintas tenant.

-- ─── Customer: CRM loyalty tier & credit risk filter ─────────────────────────
CREATE INDEX IF NOT EXISTS "Customer_tenantId_tier_idx"
  ON "Customer" ("tenantId", "tier");

CREATE INDEX IF NOT EXISTS "Customer_tenantId_isCreditBlocked_idx"
  ON "Customer" ("tenantId", "isCreditBlocked");

-- ─── Debt: Piutang status filter & aging report ───────────────────────────────
CREATE INDEX IF NOT EXISTS "Debt_tenantId_status_idx"
  ON "Debt" ("tenantId", "status");

CREATE INDEX IF NOT EXISTS "Debt_tenantId_customerId_idx"
  ON "Debt" ("tenantId", "customerId");

CREATE INDEX IF NOT EXISTS "Debt_tenantId_dueDate_idx"
  ON "Debt" ("tenantId", "dueDate");

-- ─── Voucher: Expired cleanup job ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Voucher_tenantId_validUntil_idx"
  ON "Voucher" ("tenantId", "validUntil");
