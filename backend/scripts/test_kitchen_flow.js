async function testKitchenLogin() {
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'dapur', password: 'password123' })
    });
    const loginData = await loginRes.json();
    console.log('Login status:', loginRes.status);
    console.log('User Role:', loginData.user?.role);
    console.log('Token received:', !!loginData.token);

    const token = loginData.token;
    const ingRes = await fetch('http://localhost:5000/api/ingredients', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const ingData = await ingRes.json();

    console.log('Ingredients fetched:', ingData.length, 'items');
    if (ingData.length > 0) {
      const sample = ingData[0];
      console.log('Sample item:', {
        id: sample.id,
        name: sample.name,
        stock: sample.stock,
        minStock: sample.minStock,
        buyPrice: sample.buyPrice, // SHOULD BE UNDEFINED!
        supplier: sample.supplier?.name
      });
      if (sample.buyPrice === undefined) {
        console.log('PASSED: buyPrice is successfully HIDDEN from Dapur role!');
      } else {
        console.error('FAILED: buyPrice is still visible!', sample.buyPrice);
      }
    }

    // Try to adjust stock (should be 403 Forbidden)
    const adjustRes = await fetch(`http://localhost:5000/api/ingredients/${ingData[0].id}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ change: 10, type: 'Restock', description: 'Test adjust' })
    });
    if (adjustRes.status === 403) {
      console.log('PASSED: Direct stock adjustment was rejected with status: 403 Forbidden');
    } else {
      console.error('FAILED: Direct stock adjustment returned status:', adjustRes.status);
    }

    // Try to record loss (should SUCCEED)
    const lossRes = await fetch('http://localhost:5000/api/ingredients/loss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        targetType: 'INGREDIENT',
        ingredientId: ingData[0].id,
        qtyLoss: 0.1,
        reason: 'Uji Coba Kerusakan Dapur',
        notes: 'Test loss by dapur staff'
      })
    });
    const lossData = await lossRes.json();
    if (lossRes.status === 200 || lossRes.status === 201) {
      console.log('PASSED: Dapur successfully recorded stock loss! Log:', lossData.message || lossData);
    } else {
      console.error('FAILED: Dapur could not record loss:', lossRes.status, lossData);
    }

  } catch (err) {
    console.error('Test error:', err.message);
  }
}

testKitchenLogin();

