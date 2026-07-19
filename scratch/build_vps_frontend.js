const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const localPath = path.join(__dirname, '../frontend/src/components/ProductModal.tsx');
const localContent = fs.readFileSync(localPath, 'utf8');

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected to VPS. Uploading ProductModal.tsx...');
    
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        const remotePath = '/var/www/poscafe/frontend/src/components/ProductModal.tsx';
        sftp.writeFile(remotePath, localContent, 'utf8', (err) => {
            if (err) throw err;
            console.log('File successfully uploaded to VPS.');
            
            console.log('Building frontend on VPS (npm run build)...');
            const cmd = `
            cd /var/www/poscafe/frontend
            npm run build
            `;
            
            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('data', d => process.stdout.write(d));
                stream.stderr.on('data', d => process.stderr.write(d));
                stream.on('close', (code) => {
                    console.log('Frontend build finished with code:', code);
                    conn.end();
                });
            });
        });
    });
}).connect(config);
