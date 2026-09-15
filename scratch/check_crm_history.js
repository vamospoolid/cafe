const { execSync } = require('child_process');
const commits = execSync('git log --oneline -- frontend/src/components/CRMView.tsx').toString().trim().split('\n');
for (const c of commits) {
  const hash = c.split(' ')[0];
  try {
    const file = execSync(`git show ${hash}:frontend/src/components/CRMView.tsx`).toString();
    const hasInput = file.includes('placeholder="Cari');
    const hasTable = file.includes('<table');
    const hasTier = file.includes('Semua Level Tier');
    console.log(hash, c.substring(8, 40), 'hasInput:', hasInput, 'hasTable:', hasTable, 'hasTier:', hasTier);
  } catch (e) {
    console.log(hash, 'error');
  }
}
