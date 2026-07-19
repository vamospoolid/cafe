const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const localModalPath = path.join(__dirname, '../frontend/src/components/ProductModal.tsx');
const localUploadPath = path.join(__dirname, '../backend/src/routes/upload.ts');

const modalContent = fs.readFileSync(localModalPath, 'utf8');
const uploadContent = fs.readFileSync(localUploadPath, 'utf8');

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected to VPS. Uploading files...');
    
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        const remoteModalPath = '/var/www/poscafe/frontend/src/components/ProductModal.tsx';
        const remoteUploadPath = '/var/www/poscafe/backend/src/routes/upload.ts';
        
        sftp.writeFile(remoteModalPath, modalContent, 'utf8', (err) => {
            if (err) throw err;
            console.log('ProductModal.tsx successfully uploaded to VPS.');
            
            sftp.writeFile(remoteUploadPath, uploadContent, 'utf8', (err) => {
                if (err) throw err;
                console.log('upload.ts successfully uploaded to VPS.');
                
                console.log('Building frontend and recompiling backend...');
                const cmd = `
                echo "=== Compiling Backend ==="
                cd /var/www/poscafe/backend && npx tsc && pm2 restart poscafe-backend
                
                echo "=== Building Frontend ==="
                cd /var/www/poscafe/frontend && npm run build
                `;
                
                conn.exec(cmd, (err, stream) => {
                    if (err) throw err;
                    stream.on('data', d => process.stdout.write(d));
                    stream.stderr.on('data', d => process.stderr.write(d));
                    stream.on('close', (code) => {
                        console.log('Build and restart completed with code:', code);
                        conn.end();
                    });
                });
            });
        });
    });
}).connect(config);
