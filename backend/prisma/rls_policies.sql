-- ============================================================================
-- CODENUSA MULTI-TENANT SAAS POS: POSTGRESQL ROW-LEVEL SECURITY (RLS) POLICIES
-- Phase 12: Defense-in-Depth Tenant Isolation
-- ============================================================================

-- Function to safely set the current tenant session variable
CREATE OR REPLACE FUNCTION set_current_tenant(p_tenant_id TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', p_tenant_id, true);
END;
$$ LANGUAGE plpgsql;

-- ─── 1. Enable RLS and Create Policies for Business Tables ──────────────────

DO $$
DECLARE
  tbl_name TEXT;
  tables_list TEXT[] := ARRAY[
    'Category',
    'Product',
    'Table',
    'Reservation',
    'Customer',
    'PointLog',
    'Order',
    'CashFlow',
    'Attendance',
    'Settings',
    'Shift',
    'Supplier',
    'Ingredient',
    'IngredientLog',
    'PurchaseOrder',
    'Debt',
    'DebtPayment',
    'LeaveRequest',
    'ShiftHandover',
    'KitchenChecklist',
    'WarehouseInbound',
    'WarehouseRequisition',
    'OwnerFundTransaction',
    'WarehouseSale',
    'EmployeeLoan',
    'TenantPaymentConfig',
    'AuditLog',
    'UsageRecord',
    'Subscription',
    'Invoice',
    'PaymentTransaction',
    'TenantFeature'
  ];
BEGIN
  FOREACH tbl_name IN ARRAY tables_list LOOP
    -- Check if table exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = tbl_name
    ) THEN
      -- Enable RLS
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl_name);
      
      -- Force RLS so table owner also obeys the policy in normal queries
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl_name);

      -- Drop existing policy if present
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl_name);

      -- Create comprehensive Tenant Isolation Policy
      EXECUTE format($policy$
        CREATE POLICY tenant_isolation_policy ON %I
        FOR ALL
        USING (
          current_setting('app.current_tenant_id', true) = 'PLATFORM_SUPERADMIN'
          OR "tenantId" = current_setting('app.current_tenant_id', true)
          OR ("tenantId" IS NULL AND (current_setting('app.current_tenant_id', true) IS NULL OR current_setting('app.current_tenant_id', true) = ''))
        )
        WITH CHECK (
          current_setting('app.current_tenant_id', true) = 'PLATFORM_SUPERADMIN'
          OR "tenantId" = current_setting('app.current_tenant_id', true)
        );
      $policy$, tbl_name);

      RAISE NOTICE 'RLS Enabled and Policy Created for table: %', tbl_name;
    END IF;
  END LOOP;
END $$;
