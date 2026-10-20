const { Client } = require('ssh2');

const scriptOnRemote = `
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const p = new PrismaClient();

const CURATED = {
  coffee_hot: [
    'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=500&auto=format&fit=crop'
  ],
  coffee_cold: [
    'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500&auto=format&fit=crop'
  ],
  tea_matcha: [
    'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop'
  ],
  drink_mocktail: [
    'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1558857563-b37cf5a840e6?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=500&auto=format&fit=crop'
  ],
  ramen_noodle: [
    'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1591814468924-caf88d1232e1?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1552611052-33e04de081de?w=500&auto=format&fit=crop'
  ],
  rice_bowl: [
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&auto=format&fit=crop'
  ],
  chicken_meat: [
    'https://images.unsplash.com/photo-1562967914-608f82629710?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1558030006-450675393462?w=500&auto=format&fit=crop'
  ],
  snack_bites: [
    'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1615361200141-f45040f367be?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=500&auto=format&fit=crop'
  ],
  pastry_dessert: [
    'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=500&auto=format&fit=crop'
  ]
};

function getPhoto(name, cat) {
  const catLower = ((cat || '') + ' ' + (name || '')).toLowerCase();
  let pool = CURATED.rice_bowl;
  if (/ramen|udon|mie|soba|noodle|noodles|kuah|pasta|spaghetti|curry/i.test(catLower)) pool = CURATED.ramen_noodle;
  else if (/kopi|coffee|espresso|cappuccino|latte|americano|black|aren|butterscotch|caramel|hazelnut|pandan/i.test(catLower)) {
    pool = /dingin|ice|iced|frappe|cold/i.test(catLower) ? CURATED.coffee_cold : CURATED.coffee_hot;
  } else if (/teh|tea|matcha|lemon tea|lychee tea|chocolate|cokelat/i.test(catLower)) pool = CURATED.tea_matcha;
  else if (/drink|drinks|mocktail|beverage|beverages|juice|jus|soda|boba|smoothie|yakult/i.test(catLower)) pool = CURATED.drink_mocktail;
  else if (/ayam|chicken|katsu|karage|karaage|daging|beef|steak|gyu|teriyaki|slice/i.test(catLower)) pool = CURATED.chicken_meat;
  else if (/snack|snacks|cireng|kentang|fries|dimsum|gyoza|tempura|tofu|nori|odeng|bites|topping/i.test(catLower)) pool = CURATED.snack_bites;
  else if (/roti|toast|croissant|pastry|bakery|cake|tart|churros|waffle|pancake|dessert|sweet|donut|donat|ice cream|gelato/i.test(catLower)) pool = CURATED.pastry_dessert;
  else if (/nasi|rice|bowl|goreng|salmon/i.test(catLower)) pool = CURATED.rice_bowl;

  const hash = Math.abs((name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
  return pool[hash % pool.length];
}

async function run() {
  const uploadsDir = path.resolve('/var/www/poscafe/backend/uploads/products');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const prods = await p.product.findMany({
    where: {
      tenantId: 'tenant-vamos-pool',
      deletedAt: null
    },
    include: { category: true }
  });

  console.log('Found', prods.length, 'products in tenant-vamos-pool');

  let updated = 0;
  for (const prod of prods) {
    const isPollinations = !prod.imageUrl || prod.imageUrl.includes('pollinations.ai');
    if (isPollinations) {
      const newUrl = getPhoto(prod.name, prod.category?.name);
      await p.product.update({
        where: { id: prod.id },
        data: { imageUrl: newUrl }
      });
      console.log('Updated:', prod.name, '->', newUrl.substring(0, 60));
      updated++;
    }
  }

  console.log('Finished updating', updated, 'products with reliable Unsplash URLs.');
  await p.$disconnect();
}
run();
`;

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected to VPS. Running image URL migration on database...');
  conn.exec(`cat << 'EOF' > /var/www/poscafe/backend/migrate_images.js
${scriptOnRemote}
EOF
cd /var/www/poscafe/backend && node migrate_images.js
rm -f /var/www/poscafe/backend/migrate_images.js
`, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', code => {
      console.log('\nMigration script finished with code:', code);
      conn.end();
    });
  });
}).connect({ host: '173.212.243.240', port: 22, username: 'root', password: 'Ahmad_dcc07' });
