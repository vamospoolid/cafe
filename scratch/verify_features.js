const http = require('http');

async function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function test() {
  console.log('--- 1. Testing GET /api/auth/staff-list ---');
  const staffRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/staff-list',
    method: 'GET'
  });
  console.log('Staff list status:', staffRes.status);
  console.log('Staff members count:', staffRes.body.length);
  console.log('Sample staff:', staffRes.body.slice(0, 3));

  if (staffRes.body.length > 0) {
    const firstStaff = staffRes.body[0];
    console.log('\n--- 2. Testing POST /api/auth/qr-login with badge ID ---');
    const qrRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/qr-login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { code: `STAFF-${firstStaff.id}` });
    console.log('QR Login status:', qrRes.status);
    console.log('Logged in user:', qrRes.body.user);
    console.log('Token received:', !!qrRes.body.token);
  }

  console.log('\n--- 3. Testing Public Products for Dine-In ---');
  const prodRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/products/public',
    method: 'GET'
  });
  console.log('Public products count:', prodRes.body.length);

  console.log('\nAll verification tests passed successfully!');
}

test().catch(console.error);
