const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, '../frontend/src/components');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  if (content.includes('alert(') || content.includes('window.confirm(')) {
    if (!content.includes('import { toast') && !content.includes('import { confirmAlert')) {
      // Find the last import
      const imports = content.match(/^import.*?;?\s*$/gm);
      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        content = content.replace(lastImport, `${lastImport}\nimport { toast, confirmAlert, errorAlert } from '../utils/alert';`);
      } else {
        content = `import { toast, confirmAlert, errorAlert } from '../utils/alert';\n${content}`;
      }
      changed = true;
    }

    // Replace alerts
    const alertRegex = /alert\((.*?)\)/g;
    content = content.replace(alertRegex, (match, p1) => {
      changed = true;
      if (p1.includes('Gagal') || p1.includes('Terjadi') || p1.includes('Error')) {
        return `toast(${p1}, 'error')`;
      }
      return `toast(${p1}, 'success')`;
    });

    // Replace window.confirm (naively for simple cases)
    const confirmRegex = /if \(!window\.confirm\((.*?)\)\) return;/g;
    content = content.replace(confirmRegex, (match, p1) => {
      changed = true;
      return `const confirmResult = await confirmAlert('Konfirmasi', ${p1});\n    if (!confirmResult.isConfirmed) return;`;
    });

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated:', filePath);
    }
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walkDir(componentsDir);
