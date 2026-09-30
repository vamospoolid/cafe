const { Client } = require('ssh2');

const VPS_CONFIG = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07',
  readyTimeout: 30000
};

const sql = `
SELECT r.id, r."productId", p.name as product_name, r."ingredientId", i.name as ingredient_name, r."qtyPerServing"
FROM "RecipeItem" r
JOIN "Product" p ON r."productId" = p.id
JOIN "Ingredient" i ON r."ingredientId" = i.id
ORDER BY r."productId", r.id;

SELECT id, name FROM "Product" WHERE id = 5;
SELECT * FROM "RecipeItem" WHERE "productId" = 5;
`.trim();

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const stream = sftp.createWriteStream('/tmp/list_recipes.sql');
    stream.on('close', () => {
      conn.exec('sudo -u postgres psql -d poscafe_db -f /tmp/list_recipes.sql && rm -f /tmp/list_recipes.sql', (err, execStream) => {
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
