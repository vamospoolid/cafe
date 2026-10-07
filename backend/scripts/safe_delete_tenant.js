const { PrismaClient } = require('@prisma/client');

async function deleteTenantSafely(prisma, tenantId) {
  // 1. Order Items & Orders
  await prisma.orderItem.deleteMany({ where: { order: { tenantId } } });
  await prisma.order.deleteMany({ where: { tenantId } });

  // 2. Delivery Orders
  await prisma.deliveryOrderItem.deleteMany({ where: { deliveryOrder: { tenantId } } });
  await prisma.deliveryOrder.deleteMany({ where: { tenantId } });

  // 3. Bengkel Work Orders & Parts
  await prisma.workOrderInvoiceItem.deleteMany({ where: { invoice: { tenantId } } });
  await prisma.workOrderInvoice.deleteMany({ where: { tenantId } });
  await prisma.workOrderReturnItem.deleteMany({ where: { returnOrder: { tenantId } } });
  await prisma.workOrderReturn.deleteMany({ where: { tenantId } });
  await prisma.workOrderPart.deleteMany({ where: { workOrder: { tenantId } } });
  await prisma.workOrderService.deleteMany({ where: { workOrder: { tenantId } } });
  await prisma.partRequest.deleteMany({ where: { tenantId } });
  await prisma.workOrder.deleteMany({ where: { tenantId } });

  // 4. Rental & Laundry Orders
  await prisma.rentalOrderItem.deleteMany({ where: { rentalOrder: { tenantId } } });
  await prisma.rentalOrder.deleteMany({ where: { tenantId } });
  await prisma.laundryOrderItem.deleteMany({ where: { laundryOrder: { tenantId } } });
  await prisma.laundryOrder.deleteMany({ where: { tenantId } });

  // 5. Warehouse & Purchasing
  await prisma.warehouseSaleItem.deleteMany({ where: { sale: { tenantId } } });
  await prisma.warehouseSale.deleteMany({ where: { tenantId } });
  await prisma.warehouseInboundItem.deleteMany({ where: { inbound: { tenantId } } });
  await prisma.warehouseInbound.deleteMany({ where: { tenantId } });
  await prisma.warehouseRequisitionItem.deleteMany({ where: { requisition: { tenantId } } });
  await prisma.warehouseRequisition.deleteMany({ where: { tenantId } });

  await prisma.supplierInvoicePayment.deleteMany({ where: { tenantId } });
  await prisma.supplierInvoiceItem.deleteMany({ where: { invoice: { tenantId } } });
  await prisma.supplierInvoice.deleteMany({ where: { tenantId } });
  await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { tenantId } } });
  await prisma.purchaseOrder.deleteMany({ where: { tenantId } });

  // 6. Recipes & Catalog
  await prisma.recipeItem.deleteMany({ where: { tenantId } });
  await prisma.productPriceTier.deleteMany({ where: { tenantId } });
  await prisma.productUOM.deleteMany({ where: { tenantId } });
  await prisma.product.deleteMany({ where: { tenantId } });
  await prisma.category.deleteMany({ where: { tenantId } });

  // 7. Ingredients & Logs
  await prisma.wasteLog.deleteMany({ where: { tenantId } });
  await prisma.ingredientLog.deleteMany({ where: { tenantId } });
  await prisma.ingredient.deleteMany({ where: { tenantId } });

  // 8. Finance, Debts, Loans, HR
  await prisma.debtPayment.deleteMany({ where: { tenantId } });
  await prisma.debt.deleteMany({ where: { tenantId } });
  await prisma.employeeLoanPayment.deleteMany({ where: { tenantId } });
  await prisma.employeeLoan.deleteMany({ where: { tenantId } });
  await prisma.commissionPayout.deleteMany({ where: { tenantId } });
  await prisma.mechanicProfile.deleteMany({ where: { tenantId } });
  await prisma.vehicle.deleteMany({ where: { tenantId } });
  await prisma.ownerFundTransaction.deleteMany({ where: { tenantId } });
  await prisma.cashFlow.deleteMany({ where: { tenantId } });
  await prisma.shiftHandover.deleteMany({ where: { tenantId } });
  await prisma.shift.deleteMany({ where: { tenantId } });
  await prisma.leaveRequest.deleteMany({ where: { tenantId } });
  await prisma.attendance.deleteMany({ where: { tenantId } });

  // 9. Tables, CRM & Settings
  await prisma.kitchenChecklist.deleteMany({ where: { tenantId } });
  await prisma.reservation.deleteMany({ where: { tenantId } });
  await prisma.table.deleteMany({ where: { tenantId } });
  await prisma.pointLog.deleteMany({ where: { tenantId } });
  await prisma.customer.deleteMany({ where: { tenantId } });
  await prisma.voucher.deleteMany({ where: { tenantId } });
  await prisma.supplier.deleteMany({ where: { tenantId } });
  await prisma.serviceType.deleteMany({ where: { tenantId } });
  await prisma.settings.deleteMany({ where: { tenantId } });

  // 10. Communication & Logs
  await prisma.whatsAppLog.deleteMany({ where: { tenantId } });
  await prisma.whatsAppTemplate.deleteMany({ where: { tenantId } });
  await prisma.tenantWhatsAppConfig.deleteMany({ where: { tenantId } });
  await prisma.tenantPaymentConfig.deleteMany({ where: { tenantId } });
  await prisma.auditLog.deleteMany({ where: { tenantId } });
  await prisma.userSession.deleteMany({ where: { tenantId } });

  // 11. Memberships, Features & Outlets
  await prisma.tenantMembership.deleteMany({ where: { tenantId } });
  await prisma.tenantFeature.deleteMany({ where: { tenantId } });
  await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } });
  await prisma.role.deleteMany({ where: { tenantId } });
  await prisma.outlet.deleteMany({ where: { tenantId } });

  // 12. Users & Tenant
  await prisma.user.deleteMany({ where: { tenantId, isPlatformAdmin: false } });
  await prisma.tenant.delete({ where: { id: tenantId } });
}

module.exports = { deleteTenantSafely };
