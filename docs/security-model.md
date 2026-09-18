# Multi-Tenant SaaS Security Model & Threat Mitigation

## 1. Threat Modeling & OWASP Top 10 Mitigation

### 1.1 Broken Access Control & Cross-Tenant Data Access (IDOR)
- **Risk**: Tenant A alters request parameters (e.g. `GET /api/orders/52` or `DELETE /api/products/10`) to view or mutate Tenant B's data.
- **Mitigation**:
  1. **Zero Client Trust**: `tenantId` is never read from client query params, request bodies, or URL parameters for authorization.
  2. **Server-Side Context**: `tenantId` is extracted solely from the cryptographically verified JWT / Session context.
  3. **Prisma Query Extension**: An automated Prisma client middleware/extension automatically injects `where: { tenantId: ctx.tenantId }` on all read, update, and delete operations.
  4. **PostgreSQL RLS (Row Level Security)**: Defense-in-depth policy `current_setting('app.current_tenant_id')` ensures that even raw SQL queries cannot leak cross-tenant rows.

### 1.2 Identification and Authentication Failures
- **Risk**: Weak passwords, credential stuffing, brute force on PIN logins, token tampering.
- **Mitigation**:
  1. **Password Hashing**: `bcrypt` with salt rounds >= 10.
  2. **PIN Security**: PINs are hashed or strictly scoped per tenant membership, with progressive delay and IP/Tenant-aware rate limiting.
  3. **Session Management**: JWT with expiration + secure token revocation list or Redis/DB-backed session tracking.
  4. **HttpOnly & Secure Cookies**: Prevent XSS token theft.

### 1.3 Privilege Escalation (Horizontal & Vertical)
- **Risk**: A `Cashier` user invokes `/api/analytics` or `/api/users` to grant themselves `Owner` rights, or a tenant Owner accesses platform administrative endpoints.
- **Mitigation**:
  1. **Granular RBAC**: Endpoint authorization checks require specific permissions (e.g. `req.hasPermission('reports.view')`).
  2. **Strict Platform Admin Boundary**: Platform admins use a distinct model/claim (`isPlatformAdmin: true`) and isolated route prefix (`/api/platform/*`). A tenant `Owner` has zero permissions in the platform administrative space.

### 1.4 Injection (SQL, Command, File Path)
- **Risk**: Unsanitized parameters in queries, backup generation, or file upload handlers.
- **Mitigation**:
  1. **Parameterized Queries**: Prisma ORM enforces parameterized SQL by default.
  2. **Safe Backup Execution**: The current `exec(pg_dump ...)` vulnerability is replaced with secure, sanitized streaming using strict parameter arrays and environment variables.
  3. **Safe File Uploads**: Uploaded filenames are randomized (UUIDv4), MIME types are strictly verified, execution is disabled on the upload directory, and tenant files are isolated: `/uploads/tenants/:tenantId/:uuid.:ext`.

---

## 2. API Authorization Matrix

| Endpoint Group | Required Auth | Required Tenant Status | Required Permission | Required Feature Gate |
| :--- | :--- | :--- | :--- | :--- |
| `POST /api/auth/login` | Public | N/A | None | None |
| `POST /api/orders` | Authenticated | `ACTIVE`, `TRIAL` | `pos.create` | `feature.pos` |
| `POST /api/orders/:id/void` | Authenticated | `ACTIVE`, `TRIAL` | `pos.void` | `feature.pos` |
| `GET /api/analytics/*` | Authenticated | `ACTIVE`, `TRIAL` | `reports.view` | `feature.advanced_reports` |
| `POST /api/warehouse/*` | Authenticated | `ACTIVE`, `TRIAL` | `warehouse.manage` | `feature.warehouse` |
| `POST /api/attendance/clock-in`| Authenticated | `ACTIVE`, `TRIAL` | `attendance.clock` | `feature.attendance` |
| `GET /api/settings` | Authenticated | `ACTIVE`, `TRIAL` | `settings.view` | None |
| `PUT /api/settings` | Authenticated | `ACTIVE`, `TRIAL` | `settings.manage` | None |
| `GET /api/platform/*` | Platform Admin | N/A | `platform.admin` | None |

---

## 3. Defense-in-Depth PostgreSQL Row-Level Security (RLS) Design

### 3.1 Session Variable Injection
On each transaction / query from connection pool:
```sql
-- Set context within the transaction boundary
SET LOCAL app.current_tenant_id = 'tenant_uuid_123';
SET LOCAL app.is_platform_admin = 'false';
```

### 3.2 Tenant Isolation Policy
```sql
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_order_policy ON "Order"
    FOR ALL
    USING (
        current_setting('app.is_platform_admin', true) = 'true'
        OR "tenantId" = current_setting('app.current_tenant_id', true)
    );
```

### 3.3 Connection Pool Safety
To prevent tenant context leakage across pooled connections:
- Always use `SET LOCAL` within an explicit PostgreSQL transaction block (`BEGIN ... COMMIT`), which automatically clears the session variable upon transaction completion.
- Automated reset hook on connection return to pool: `DISCARD ALL` / `RESET ALL`.
