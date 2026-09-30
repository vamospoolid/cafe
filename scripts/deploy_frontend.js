const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const VPS = { host: '173.212.243.240', port: 22, username: 'root', password: 'Ahmad_dcc07' };
const LOCAL_DIST = path.join(__dirname, '../frontend/dist');
const REMOTE_DIR = '/var/www/poscafe/frontend/dist';

function getAllFiles(dir, base = dir) {
  let results = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      results = results.concat(getAllFiles(full, base));
    } else {
      results.push({ local: full, remote: REMOTE_DIR + '/' + path.relative(base, full).replace(/\\/g, '/') });
    }
  }
  return results;
}

async function mkdirpRemote(sftp, remotePath) {
  const parts = remotePath.replace(REMOTE_DIR, '').split('/').filter(Boolean);
  let cur = REMOTE_DIR;
  for (const p of parts) {
    cur += '/' + p;
    await new Promise(resolve => sftp.mkdir(cur, () => resolve()));
  }
}

const conn = new Client();
conn.on('ready', () => {
  console.log('🔗 Connected to VPS');
  conn.exec(`rm -rf ${REMOTE_DIR} && mkdir -p ${REMOTE_DIR}`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      conn.sftp(async (err, sftp) => {
        if (err) throw err;
        const files = getAllFiles(LOCAL_DIST);
        console.log(`📦 Uploading ${files.length} files...`);

        // Create all unique remote dirs first
        const dirs = [...new Set(files.map(f => path.dirname(f.remote)))];
        for (const d of dirs) {
          if (d !== REMOTE_DIR) {
            await mkdirpRemote(sftp, d);
          }
        }

        let done = 0;
        for (const { local, remote } of files) {
          await new Promise((resolve, reject) => {
            sftp.fastPut(local, remote, err => {
              if (err) return reject(err);
              done++;
              if (done % 10 === 0 || done === files.length) {
                process.stdout.write(`\r  ${done}/${files.length} files uploaded`);
              }
              resolve();
            });
          });
        }

        console.log('\n✅ Upload complete!');

        // Reload nginx to serve new files
        conn.exec('nginx -s reload', (err2, stream2) => {
          if (err2) { console.log('nginx reload skipped:', err2.message); conn.end(); return; }
          let out = '';
          stream2.on('data', d => out += d);
          stream2.stderr.on('data', d => out += d);
          stream2.on('close', () => {
            console.log('🔄 Nginx reloaded:', out.trim() || 'OK');
            conn.end();
          });
        });
      });
    });
    stream.stderr.on('data', d => process.stderr.write(d));
  });
}).on('error', err => console.error('❌ SSH error:', err)).connect(VPS);
