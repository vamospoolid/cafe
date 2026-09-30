const fs = require('fs');
const path = require('path');

const ROLES_FOUND = {};

function search(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      if (!p.includes('node_modules') && !p.includes('.git')) search(p);
    } else if (f.endsWith('.ts') || f.endsWith('.tsx')) {
      const c = fs.readFileSync(p, 'utf8');
      const matches = c.match(/'(Admin|Kasir|Dapur|Owner|Staff|Manager|SuperAdmin|Supervisor)'/g);
      if (matches) {
        const unique = [...new Set(matches)];
        ROLES_FOUND[f] = unique;
      }
    }
  }
}

search('c:/ADATA/pooos/backend/src');
search('c:/ADATA/pooos/frontend/src');

console.log('=== ROLES FOUND PER FILE ===');
for (const [file, roles] of Object.entries(ROLES_FOUND)) {
  console.log(file + ': ' + roles.join(', '));
}

// Also find all unique roles across codebase
const allRoles = new Set();
Object.values(ROLES_FOUND).flat().forEach(r => allRoles.add(r.replace(/'/g, '')));
console.log('\n=== UNIQUE ROLES ===');
console.log([...allRoles].join(', '));
