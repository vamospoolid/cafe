const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '..', 'backend', 'prisma', 'schema.prisma');
const dstPath = path.join(__dirname, '..', 'backend', 'prisma', 'schema.sqlite.prisma');

let content = fs.readFileSync(srcPath, 'utf8');

// 1. Switch datasource provider to sqlite
content = content.replace('provider = "postgresql"', 'provider = "sqlite"');

// 2. Remove @db.Text which is not supported in SQLite connector
content = content.replace(/@db\.Text/g, '');

// 3. Convert Json types to String (serialized JSON text) for SQLite compatibility
content = content.replace(/\bJson\b/g, 'String');

fs.writeFileSync(dstPath, content, 'utf8');
console.log('✅ schema.sqlite.prisma berhasil dibuat & disesuaikan untuk SQLite. Ukuran:', content.length, 'bytes');
