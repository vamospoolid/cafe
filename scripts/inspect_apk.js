const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const apkPath = path.resolve('release/usahabersama-pos-cashier.apk');
console.log('APK Path:', apkPath);
console.log('Size:', (fs.statSync(apkPath).size / 1024 / 1024).toFixed(2), 'MB');

const psScript = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('${apkPath.replace(/\\\\/g, '/')}')
$totalCompressed = ($zip.Entries | Measure-Object -Property CompressedLength -Sum).Sum
$totalUncompressed = ($zip.Entries | Measure-Object -Property Length -Sum).Sum
Write-Host "Total Entries: $($zip.Entries.Count)"
Write-Host "Total Compressed: $([math]::Round($totalCompressed / 1MB, 2)) MB"
Write-Host "Total Uncompressed: $([math]::Round($totalUncompressed / 1MB, 2)) MB"
$zip.Dispose()
`;

fs.writeFileSync('scratch_zip.ps1', psScript);
try {
  const out = cp.execSync('powershell -ExecutionPolicy Bypass -File scratch_zip.ps1').toString();
  console.log(out);
} finally {
  if (fs.existsSync('scratch_zip.ps1')) fs.unlinkSync('scratch_zip.ps1');
}
