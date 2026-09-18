# Codenusa POS SaaS Platform Architecture

## 1. Executive Summary & Vision
The Codenusa POS platform is evolving from a single-tenant restaurant application into a secure, horizontally scalable, multi-tenant B2B SaaS platform capable of serving thousands of tenants (F&B businesses, cafes, cloud kitchens, retail stores), each with multiple physical outlets, dozens of staff members, granular role-based access control, subscription-based feature entitlement, offline POS synchronization, and multi-tenant database isolation.

---

## 2. Transition Overview

### 2.1 Current Architecture (Single-Tenant)
- **Deployment**: 1 VPS deployment in `/var/www/poscafe`, PM2 instance `poscafe-backend`, pointing directly to `poscafe_db`.
- **Tenant Scope**: Implicit single tenant (Muki Ramen cafe). All data in tables (`User`, `Product`, `Order`, `Settings`, `WarehouseInbound`, etc.) resides in one flat namespace without tenant ownership keys.
- **Settings**: Singleton table accessed via `prisma.settings.findFirst()`.
- **Identity**: Direct user binding (`username` is globally unique, role is a raw string).
- **Entitlements**: Hardcoded logic with basic boolean flags.

### 2.2 Target SaaS Architecture (Multi-Tenant)
```
                                 [ DNS / Cloudflare / Reverse Proxy ]
                                                  |
                     +----------------------------+----------------------------+
                     |                                                         |
         [ *.codenusa.id / app.codenusa.id ]                    [ admin.codenusa.id ]
                     |                                                         |
        [ Tenant Resolver & Context ]                            [ Platform Admin API ]
                     |                                                         |
        +------------+------------+                                            |
        |                         |                                            |
 [ HTTP API Gateway ]     [ Socket.IO Cluster ]                                |
 (Express + RateLimiter)   (Tenant Room Scopes)                                |
        |                         |                                            |
        +------------+------------+                                            |
                     |                                                         |
       [ Multi-Tenant Middlewares ]                                            |
       - Authentication (JWT / Cookie)                                         |
       - Tenant Context & Resolution                                           |
       - Outlet Context Resolution                                             |
       - Granular RBAC & Permissions                                           |
       - Entitlement & Feature Gatekeeper                                      |
       - Usage / Quota Gatekeeper                                              |
       - Request Audit & Traceability                                          |
                     |                                                         |
         [ Core Service Layer ]                                                |
         - TenantService          - ProductService                             |
         - AuthService            - OrderService                               |
         - FeatureService         - InventoryService                           |
         - SubscriptionService    - AttendanceService                          |
         - BillingService         - WarehouseService                           |
                     |                                                         |
         [ Tenant Isolation Engine ]                                           |
         - Application-level Tenant Scoping (Prisma Tenant Extension)          |
         - Defense-in-Depth PostgreSQL Row-Level Security (RLS)                |
                     |                                                         |
         [ Shared PostgreSQL Database (Logical Isolation) ]                    |
         - Core SaaS Catalogs (Tenants, Users, Memberships, Plans, Features)   |
         - Tenant-Partitionable Business Data (tenant_id indexed)              |
```

---

## 3. High-Level System Components

### 3.1 Infrastructure & Deployment Isolation (Zero Impact on Legacy)
- **Legacy VPS Environment**: `/var/www/poscafe` remains completely untouched and dedicated to existing contracted client.
- **SaaS Platform Environment**: `/var/www/codepos` running under separate PM2 processes (`codepos-backend`), dedicated Nginx upstream configuration, and dedicated database (`codepos_saas_db` or isolated credentials).

### 3.2 Tenant Context & Resolution Pipeline
Every incoming API request is resolved deterministically through the Tenant Context pipeline:
1. **Subdomain / Hostname Resolution**: E.g., `mukiramen.codenusa.id` -> resolves tenant slug `mukiramen`.
2. **Authenticated Token Resolution**: JWT payload contains `userId`, `activeTenantId`, `activeOutletId`, `roleId`, and `membershipStatus`.
3. **Tenant Context Verification**: The backend validates that:
   - The user has an `ACTIVE` membership in the requested `tenantId`.
   - The tenant status is not `SUSPENDED` or `CANCELLED`.
   - The `outletId` (if specified) belongs to that `tenantId`.
4. **Context Injection**: `req.tenantContext = { tenantId, outletId, userId, roleId, permissions, plan }`.

### 3.3 Database Tenancy Strategy
- **Stage 1 (Current SaaS Target)**: Shared PostgreSQL database with **Logical Tenant Isolation** via mandatory `tenant_id` on all business entities, indexed composite keys, automated Prisma Client query-scoping extensions, and PostgreSQL Row-Level Security (RLS) defense-in-depth.
- **Stage 2 (Growth Target)**: PostgreSQL declarative table partitioning by `tenant_id` for ultra-high transaction tables (`orders`, `order_items`, `ingredient_logs`).
- **Stage 3 (Enterprise Target)**: Schema-per-tenant or dedicated DB-per-tenant for large enterprise customers via dynamic connection routing without changing application domain logic.

---

## 4. Key SaaS Subsystems

### 4.1 Subscription, Billing & Lifecycle Engine
- **Plans**: Starter, Growth, Business, Enterprise.
- **Feature Registry**: Granular capabilities (POS, KDS, Advanced Inventory, Central Warehouse, CRM, Multi-Outlet, GPS Attendance, Payroll, Employee Loans).
- **Tenant Feature Overrides**: Add-ons, custom quota expansions, promotional features.
- **Subscription Lifecycle**: `TRIAL` -> `ACTIVE` -> `PAST_DUE` -> `GRACE_PERIOD` -> `SUSPENDED` -> `CANCELLED`.
- **Payment Abstraction**: Modular payment provider gateway (Xendit, Midtrans, Manual Transfer) with idempotent webhook signature verification.

### 4.2 Security & Compliance Architecture
- **Tenant Data Isolation**: Zero trust towards client-supplied tenant IDs. Enforced at query generation time.
- **RBAC**: Fine-grained permission keys (`pos.create`, `inventory.adjust`, `payroll.view`, `settings.manage`).
- **Audit Logging**: Immutable audit trail for all financial, inventory, security, and administrative actions.
- **Defensive Headers & Rate Limiting**: Helmet, strict CORS allowlists, IP/Tenant-aware rate limiting.
