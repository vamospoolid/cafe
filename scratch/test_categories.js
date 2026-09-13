const http = require('http');

async function main() {
  // Test public categories endpoint
  const res = await fetch('http://localhost:5000/api/categories/public');
  const data = await res.json();
  console.log('Public Categories Count:', data.length);
  console.log('Sample category:', JSON.stringify(data[0], null, 2));
}

main().catch(console.error);
