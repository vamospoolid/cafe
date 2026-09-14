const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const localFile = path.join(__dirname, '..', 'frontend', 'src', 'components', 'StaffPWAView.tsx');
const remoteFile = '/var/www/poscafe/frontend/src/components/StaffPWAView.tsx';

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected to VPS. Uploading StaffPWAView.tsx via SFTP...');
    conn.sftp((err, sftp) => {
        if (err) {
            console.error('SFTP error:', err);
            conn.end();
            return;
        }

        const readStream = fs.createReadStream(localFile);
        const writeStream = sftp.createWriteStream(remoteFile);

        writeStream.on('close', () => {
            console.log('✅ File uploaded successfully. Building frontend on VPS...');
            const buildCmd = `
                cd /var/www/poscafe/frontend
                npm run build
                echo "=== Build Finished on VPS ==="
            `;
            conn.exec(buildCmd, (execErr, stream) => {
                if (execErr) {
                    console.error('Exec error:', execErr);
                    conn.end();
                    return;
                }
                stream.on('data', d => process.stdout.write(d));
                stream.stderr.on('data', d => process.stderr.write(d));
                stream.on('close', () => {
                    console.log('✅ VPS Updated & Live!');
                    conn.end();
                });
            });
        });

        readStream.pipe(writeStream);
    });
}).connect(config);
