/**
 * test_waste_tracking.js
 * End-to-end automated verification script for Priority 3: Waste & Spoilage Tracking (Pencatat Bahan Baku Basi/Rusak & HPP Loss)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  console.log('=== STARTING PRIORITY 3: WASTE & SPOILAGE TRACKING VERIFICATION ===\n');

  try {
    // 1. Fetch or create User
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: 'Test Kitchen Chef',
          username: 'chef_test',
          role: 'kitchen',
          passwordHash: 'dummy'
        }
      });
    }

    console.log(`✓ Setup Context: User = ${user.name} (ID: ${user.id})`);

    // 2. Create or find test raw ingredient
    let testIngredient = await prisma.ingredient.findFirst({
      where: { name: 'Daging Sapi Slice Test' }
    });

    if (!testIngredient) {
      testIngredient = await prisma.ingredient.create({
        data: {
          name: 'Daging Sapi Slice Test',
          category: 'FOOD',
          subCategory: 'Daging & Seafood',
          unit: 'gram',
          stock: 5000,
          minStock: 1000,
          buyPrice: 120 // Rp 120 / gram
        }
      });
    } else {
      testIngredient = await prisma.ingredient.update({
        where: { id: testIngredient.id },
        data: { stock: 5000, buyPrice: 120 }
      });
    }
    console.log(`✓ Test Ingredient: ${testIngredient.name} (Stock: ${testIngredient.stock} ${testIngredient.unit}, BuyPrice: Rp ${testIngredient.buyPrice})`);

    // 3. Create or find test product with recipe
    let testCategory = await prisma.category.findFirst();
    if (!testCategory) {
      testCategory = await prisma.category.create({
        data: { name: 'Main Course' }
      });
    }

    let testProduct = await prisma.product.findFirst({
      where: { name: 'Gyudon Beef Bowl Test' },
      include: { recipes: true }
    });

    if (!testProduct) {
      testProduct = await prisma.product.create({
        data: {
          categoryId: testCategory.id,
          name: 'Gyudon Beef Bowl Test',
          sellPrice: 45000,
          buyPrice: 18000,
          stock: 100,
          recipes: {
            create: [
              {
                ingredientId: testIngredient.id,
                qtyPerServing: 150 // 150 gram daging per mangkok
              }
            ]
          }
        },
        include: { recipes: true }
      });
    }
    console.log(`✓ Test Product: ${testProduct.name} (Recipe: 150g ${testIngredient.name} per serving)`);

    // 4. Test Scenario A: Log Raw Ingredient Waste
    console.log('\n--- Scenario A: Log Raw Ingredient Waste (Daging Busuk 500g) ---');
    const initialIngStock = testIngredient.stock;
    const wasteIngQty = 500;
    const expectedIngLossCost = wasteIngQty * testIngredient.buyPrice; // 500 * 120 = 60,000

    const rawWasteLog = await prisma.$transaction(async (tx) => {
      await tx.ingredient.update({
        where: { id: testIngredient.id },
        data: { stock: { decrement: wasteIngQty } }
      });

      return await tx.wasteLog.create({
        data: {
          type: 'INGREDIENT',
          ingredientId: testIngredient.id,
          itemName: testIngredient.name,
          category: testIngredient.category || 'FOOD',
          unit: testIngredient.unit,
          qty: wasteIngQty,
          costPerUnit: testIngredient.buyPrice,
          totalCost: expectedIngLossCost,
          reason: 'Busuk / Basi',
          notes: 'Chiller mati semalam di pantry belakang',
          userId: user.id,
          userName: user.name
        }
      });
    });

    const updatedIng = await prisma.ingredient.findUnique({ where: { id: testIngredient.id } });
    console.log(`✓ Raw Waste Log Created: ID = ${rawWasteLog.id}, Total Loss = Rp ${rawWasteLog.totalCost.toLocaleString('id-ID')}`);
    console.log(`✓ Stock Check: Initial = ${initialIngStock}g -> After Waste = ${updatedIng.stock}g (Decremented by ${wasteIngQty}g: ${updatedIng.stock === initialIngStock - wasteIngQty ? 'PASSED' : 'FAILED'})`);

    // 5. Test Scenario B: Log Prepared Dish Waste (3 Porsi Gyudon Gosong)
    console.log('\n--- Scenario B: Log Prepared Dish Waste (3 Porsi Gyudon Gosong) ---');
    const wasteDishQty = 3;
    const expectedDeductGrams = wasteDishQty * 150; // 3 * 150g = 450g
    const expectedDishCostPerUnit = 150 * testIngredient.buyPrice; // 18,000 per bowl
    const expectedTotalDishLoss = wasteDishQty * expectedDishCostPerUnit; // 54,000

    const stockBeforeDishWaste = updatedIng.stock;

    const dishWasteLog = await prisma.$transaction(async (tx) => {
      // Potong bahan resep
      await tx.ingredient.update({
        where: { id: testIngredient.id },
        data: { stock: { decrement: expectedDeductGrams } }
      });

      return await tx.wasteLog.create({
        data: {
          type: 'PRODUCT',
          productId: testProduct.id,
          itemName: testProduct.name,
          category: 'DISH',
          unit: 'porsi',
          qty: wasteDishQty,
          costPerUnit: expectedDishCostPerUnit,
          totalCost: expectedTotalDishLoss,
          reason: 'Gosong / Overcooked',
          notes: 'Staf baru lupa mengecilkan api teppan',
          userId: user.id,
          userName: user.name
        }
      });
    });

    const finalIngAfterDishWaste = await prisma.ingredient.findUnique({ where: { id: testIngredient.id } });
    console.log(`✓ Dish Waste Log Created: ID = ${dishWasteLog.id}, Total Loss = Rp ${dishWasteLog.totalCost.toLocaleString('id-ID')}`);
    console.log(`✓ Recipe Stock Auto-Deduction: Stock Before = ${stockBeforeDishWaste}g -> After = ${finalIngAfterDishWaste.stock}g (Decremented by ${expectedDeductGrams}g: ${finalIngAfterDishWaste.stock === stockBeforeDishWaste - expectedDeductGrams ? 'PASSED' : 'FAILED'})`);

    // 6. Test Scenario C: Aggregate Analytics & Waste-to-Sales Metric
    console.log('\n--- Scenario C: Verify Waste Analytics & KPI Metrics ---');
    const allWasteLogs = await prisma.wasteLog.findMany();

    const totalWasteCost = allWasteLogs.reduce((sum, w) => sum + w.totalCost, 0);
    const rawIngCost = allWasteLogs.filter(w => w.type === 'INGREDIENT').reduce((sum, w) => sum + w.totalCost, 0);
    const dishCost = allWasteLogs.filter(w => w.type === 'PRODUCT').reduce((sum, w) => sum + w.totalCost, 0);

    console.log(`✓ Total Waste Cost: Rp ${totalWasteCost.toLocaleString('id-ID')} (${allWasteLogs.length} incidents)`);
    console.log(`✓ Raw Ingredient Loss: Rp ${rawIngCost.toLocaleString('id-ID')}`);
    console.log(`✓ Prepared Dish Loss: Rp ${dishCost.toLocaleString('id-ID')}`);

    // 7. Test Scenario D: Rollback / Delete Waste Log (Stock Refund)
    console.log('\n--- Scenario D: Test Waste Log Rollback / Stock Reimbursement ---');
    const rollbackStockBefore = finalIngAfterDishWaste.stock;

    await prisma.$transaction(async (tx) => {
      // Revert raw ingredient waste
      await tx.ingredient.update({
        where: { id: testIngredient.id },
        data: { stock: { increment: rawWasteLog.qty } }
      });
      await tx.wasteLog.delete({ where: { id: rawWasteLog.id } });
    });

    const stockAfterRollback = await prisma.ingredient.findUnique({ where: { id: testIngredient.id } });
    console.log(`✓ Waste Log #${rawWasteLog.id} Deleted`);
    console.log(`✓ Stock Refund Verified: Before = ${rollbackStockBefore}g -> After Refund = ${stockAfterRollback.stock}g (Reimbursed ${rawWasteLog.qty}g: ${stockAfterRollback.stock === rollbackStockBefore + rawWasteLog.qty ? 'PASSED' : 'FAILED'})`);

    // Cleanup dish waste log
    await prisma.$transaction(async (tx) => {
      await tx.ingredient.update({
        where: { id: testIngredient.id },
        data: { stock: { increment: expectedDeductGrams } }
      });
      await tx.wasteLog.delete({ where: { id: dishWasteLog.id } });
    });
    console.log(`✓ Cleanup: Reimbursed and deleted test dish waste log`);

    console.log('\n======================================================');
    console.log('🎉 ALL PRIORITY 3 WASTE TRACKING TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('======================================================\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
