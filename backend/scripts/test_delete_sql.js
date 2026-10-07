const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteTenantClean(prisma, tenantId) {
  // 1. Order & sub-items
  await prisma.$executeRawUnsafe(`DELETE FROM "OrderItem" WHERE "orderId" IN (SELECT id FROM "Order" WHERE "tenantId" = $1) OR "productId" IN (SELECT id FROM "Product" WHERE "tenantId" = $1)`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "Order" WHERE "tenantId" = $1`, tenantId);

  // 2. Bengkel
  await prisma.$executeRawUnsafe(`DELETE FROM "WorkOrderReturnItem" WHERE "returnId" IN (SELECT id FROM "WorkOrderReturn" WHERE "tenantId" = $1) OR "productId" IN (SELECT id FROM "Product" WHERE "tenantId" = $1)`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "WorkOrderReturn" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "WorkOrderInvoiceItem" WHERE "invoiceId" IN (SELECT id FROM "WorkOrderInvoice" WHERE "tenantId" = $1)`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "WorkOrderInvoice" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "WorkOrderPart" WHERE "tenantId" = $1 OR "productId" IN (SELECT id FROM "Product" WHERE "tenantId" = $1)`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "WorkOrderService" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "PartRequest" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "WorkOrder" WHERE "tenantId" = $1`, tenantId);

  // 3. Warehouse & Purchasing
  await prisma.$executeRawUnsafe(`DELETE FROM "WarehouseSaleItem" WHERE "saleId" IN (SELECT id FROM "WarehouseSale" WHERE "tenantId" = $1) OR "productId" IN (SELECT id FROM "Product" WHERE "tenantId" = $1)`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "WarehouseSale" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "WarehouseInboundItem" WHERE "inboundId" IN (SELECT id FROM "WarehouseInbound" WHERE "tenantId" = $1) OR "productId" IN (SELECT id FROM "Product" WHERE "tenantId" = $1)`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "WarehouseInbound" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "WarehouseRequisitionItem" WHERE "requisitionId" IN (SELECT id FROM "WarehouseRequisition" WHERE "tenantId" = $1) OR "productId" IN (SELECT id FROM "Product" WHERE "tenantId" = $1)`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "WarehouseRequisition" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "PurchaseOrderItem" WHERE "tenantId" = $1 OR "poId" IN (SELECT id FROM "PurchaseOrder" WHERE "tenantId" = $1) OR "productId" IN (SELECT id FROM "Product" WHERE "tenantId" = $1)`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "PurchaseOrder" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "SupplierInvoiceItem" WHERE "invoiceId" IN (SELECT id FROM "SupplierInvoice" WHERE "tenantId" = $1) OR "productId" IN (SELECT id FROM "Product" WHERE "tenantId" = $1)`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "SupplierInvoicePayment" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "SupplierInvoice" WHERE "tenantId" = $1`, tenantId);

  // 4. Rental & Laundry
  await prisma.$executeRawUnsafe(`DELETE FROM "RentalOrderItem" WHERE "orderId" IN (SELECT id FROM "RentalOrder" WHERE "tenantId" = $1) OR "productId" IN (SELECT id FROM "Product" WHERE "tenantId" = $1)`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "RentalOrder" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "LaundryOrderItem" WHERE "orderId" IN (SELECT id FROM "LaundryOrder" WHERE "tenantId" = $1)`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "LaundryOrder" WHERE "tenantId" = $1`, tenantId);

  // 5. Delivery
  await prisma.$executeRawUnsafe(`DELETE FROM "DeliveryOrderItem" WHERE "deliveryOrderId" IN (SELECT id FROM "DeliveryOrder" WHERE "tenantId" = $1)`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "DeliveryOrder" WHERE "tenantId" = $1`, tenantId);

  // 6. Recipe & Products
  await prisma.$executeRawUnsafe(`DELETE FROM "RecipeItem" WHERE "tenantId" = $1 OR "productId" IN (SELECT id FROM "Product" WHERE "tenantId" = $1) OR "ingredientId" IN (SELECT id FROM "Ingredient" WHERE "tenantId" = $1)`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "ProductPriceTier" WHERE "tenantId" = $1 OR "productId" IN (SELECT id FROM "Product" WHERE "tenantId" = $1)`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "ProductUOM" WHERE "tenantId" = $1 OR "productId" IN (SELECT id FROM "Product" WHERE "tenantId" = $1)`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "Product" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "Category" WHERE "tenantId" = $1`, tenantId);

  // 7. Ingredients & Logs
  await prisma.$executeRawUnsafe(`DELETE FROM "IngredientLog" WHERE "tenantId" = $1 OR "ingredientId" IN (SELECT id FROM "Ingredient" WHERE "tenantId" = $1)`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "WasteLog" WHERE "tenantId" = $1 OR "ingredientId" IN (SELECT id FROM "Ingredient" WHERE "tenantId" = $1)`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "Ingredient" WHERE "tenantId" = $1`, tenantId);

  // 8. Finance, Shifts, CashFlow, HR
  await prisma.$executeRawUnsafe(`DELETE FROM "DebtPayment" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "Debt" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "EmployeeLoanPayment" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "EmployeeLoan" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "CommissionPayout" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "MechanicProfile" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "Vehicle" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "OwnerFundTransaction" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "CashFlow" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "ShiftHandover" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "Shift" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "LeaveRequest" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "Attendance" WHERE "tenantId" = $1`, tenantId);

  // 9. Tables, CRM & Settings
  await prisma.$executeRawUnsafe(`DELETE FROM "KitchenChecklist" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "Reservation" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "Table" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "PointLog" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "Customer" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "Voucher" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "Supplier" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "ServiceType" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "Settings" WHERE "tenantId" = $1`, tenantId);

  // 10. WhatsApp, Logs & Sessions
  await prisma.$executeRawUnsafe(`DELETE FROM "WhatsAppLog" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "WhatsAppTemplate" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "TenantWhatsAppConfig" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "TenantPaymentConfig" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "AuditLog" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "UserSession" WHERE "tenantId" = $1`, tenantId);

  // 11. Memberships, Roles & Outlets
  await prisma.$executeRawUnsafe(`DELETE FROM "TenantMembership" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "TenantFeature" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "RolePermission" WHERE "roleId" IN (SELECT id FROM "Role" WHERE "tenantId" = $1)`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "Role" WHERE "tenantId" = $1`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "Outlet" WHERE "tenantId" = $1`, tenantId);

  // 12. Users & Tenant
  await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE "tenantId" = $1 AND "isPlatformAdmin" = false`, tenantId);
  await prisma.$executeRawUnsafe(`DELETE FROM "Tenant" WHERE "id" = $1`, tenantId);
}

module.exports = { deleteTenantClean };
