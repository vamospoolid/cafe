# Zero-Downtime Safe Multi-Tenant Migration Plan

## 1. Migration Principles
1. **Zero Impact on Existing Production Instance**: The existing VPS deployment `/var/www/poscafe` with PM2 `poscafe-backend` and its production database will remain untouched and isolated.
2. **Dedicated SaaS Environment**: The new SaaS deployment will use `/var/www/codepos` on the server with its own service definitions and isolated database instances/schemas.
3. **Non-Destructive Staged Migrations**: No columns or tables dropped prematurely. Every schema evolution is backward-compatible.

---

## 2. Staged Database Migration Strategy

### Phase A: Add Multi-Tenant Entities & Nullable Tenant Keys
1. Create new core tables:
   - `Tenant`, `Outlet`, `TenantMembership`, `Role`, `Permission`, `RolePermission`, `UserSession`.
   - `Plan`, `Feature`, `PlanFeature`, `TenantFeature`, `Subscription`, `SubscriptionItem`, `Invoice`, `UsageRecord`, `AuditLog`.
2. Alter all existing business tables to add `tenantId` (nullable) and `outletId` (nullable).
3. Generate and verify migration scripts.

### Phase B: Seed System Metadata & Default Master Tenant
1. Seed default system permissions and system roles (`OWNER`, `ADMIN`, `CASHIER`, `KITCHEN`, `WAREHOUSE`, `HR`).
2. Seed default SaaS subscription plans (`STARTER`, `GROWTH`, `BUSINESS`, `ENTERPRISE`) and system features (`pos`, `inventory`, `kds`, `crm`, `attendance`, `warehouse`, `loans`).
3. Seed default Master Tenant (e.g., `tenant-muki-ramen`, slug `mukiramen`) and default Primary Outlet (e.g., `outlet-muki-central`, code `MUK-01`).

### Phase C: Backfill Existing Data to Master Tenant
1. Execute backfill script assigning all existing records (`users`, `products`, `categories`, `orders`, `attendances`, `shifts`, `ingredients`, `warehouse_inbounds`, etc.) to the Master Tenant and Primary Outlet.
2. Migrate existing user credentials and permissions into `User` and `TenantMembership` records.
3. Migrate singleton `Settings` into the Master Tenant / Primary Outlet settings.

### Phase D: Data Integrity Verification & Health Check
1. Execute verification queries ensuring 0 orphaned rows (no records with `tenantId IS NULL`).
2. Verify foreign key integrity and user membership linkages.

### Phase E: Add Multi-Tenant Constraints & Composite Indexes
1. Alter `tenantId` to `NOT NULL` on all business tables.
2. Replace single-column global unique constraints with tenant-scoped compound unique constraints:
   - `Product`: `@@unique([tenantId, barcode])` (instead of global unique).
   - `Customer`: `@@unique([tenantId, phone])` and `@@unique([tenantId, email])`.
   - `Order`: `@@unique([tenantId, orderNumber])` and `@@unique([tenantId, offlineId])`.
   - `Table`: `@@unique([outletId, tableNo])`.
   - `PurchaseOrder`: `@@unique([tenantId, poNumber])`.
   - `WarehouseInbound`: `@@unique([tenantId, invoiceNumber])`.
   - `WarehouseRequisition`: `@@unique([tenantId, reqNumber])`.
   - `WarehouseSale`: `@@unique([tenantId, invoiceNumber])`.
3. Add multi-tenant performance indexes:
   - `@@index([tenantId, createdAt])`
   - `@@index([tenantId, outletId])`
   - `@@index([tenantId, status])`

### Phase F: Enable Application Scoping & RLS Defense
1. Deploy Prisma multi-tenant client extension for automated context filtering.
2. Activate and verify PostgreSQL Row Level Security (RLS) policies.

---

## 3. Rollback & Disaster Recovery Strategy
- Full automated database snapshot before every migration step.
- Reversible Prisma migrations.
- Complete rollback scripts prepared for each stage.
