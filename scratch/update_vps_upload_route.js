const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const localPath = path.join(__dirname, '../backend/src/routes/upload.ts');
const localContent = fs.readFileSync(localPath, 'utf8');

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected to VPS. Uploading file...');
    
    // We can write using sftp or simple cat << 'EOF'
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        const remotePath = '/var/www/poscafe/backend/src/routes/upload.ts';
        sftp.writeFile(remotePath, localContent, 'utf8', (err) => {
            if (err) throw err;
            console.log('File successfully uploaded to VPS.');
            
            console.log('Compiling backend and restarting PM2...');
            const cmd = `
            cd /var/www/poscafe/backend
            npx tsc
            pm2 restart poscafe-backend
            `;
            
            conn.exec(cmd, (err, stream) => {
                if (err) throw err;
                stream.on('data', d => process.stdout.write(d));
                stream.stderr.on('data', d => process.stderr.write(d));
                stream.on('close', (code) => {
                    console.log('Finished compile and restart with code:', code);
                    conn.end();
                });
            });
        });
    });
}).connect(config);
