const { Client } = require('ssh2');

const VPS_CONFIG = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07',
  readyTimeout: 30000
};

const sql = `
SELECT id, "tenantId", "ingredientTrackingEnabled" FROM "Settings";
SELECT id, "orderNumber", total, status, "createdAt" FROM "Order" ORDER BY id DESC LIMIT 5;
SELECT oi.id, oi."orderId", oi."productId", p.name, oi.qty, oi.subtotal 
FROM "OrderItem" oi 
JOIN "Product" p ON oi."productId" = p.id 
ORDER BY oi.id DESC LIMIT 5;
SELECT r.id, r."productId", p.name as product_name, r."ingredientId", i.name as ingredient_name, r."qtyPerServing"
FROM "RecipeItem" r
JOIN "Product" p ON r."productId" = p.id
JOIN "Ingredient" i ON r."ingredientId" = i.id
LIMIT 10;
SELECT count(*) as total_recipe_items FROM "RecipeItem";
SELECT count(*) as total_ingredient_logs FROM "IngredientLog";
SELECT * FROM "IngredientLog" ORDER BY id DESC LIMIT 5;
`.trim();

const conn = new Client();
conn.on('ready', () => {
  console.log('✅ Connected to VPS.');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const stream = sftp.createWriteStream('/tmp/check_orders.sql');
    stream.on('close', () => {
      conn.exec('sudo -u postgres psql -d poscafe_db -f /tmp/check_orders.sql && rm -f /tmp/check_orders.sql', (err, execStream) => {
        if (err) throw err;
        execStream.on('data', d => process.stdout.write(d));
        execStream.stderr.on('data', d => process.stderr.write(d));
        execStream.on('close', code => {
          conn.end();
        });
      });
    });
    stream.end(sql);
  });
}).on('error', err => console.error(err)).connect(VPS_CONFIG);
