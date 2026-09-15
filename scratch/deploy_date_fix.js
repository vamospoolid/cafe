const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const filesToUpload = [
    {
        local: path.join(__dirname, '../backend/src/routes/orders.ts'),
        remote: '/var/www/poscafe/backend/src/routes/orders.ts'
    },
    {
        local: path.join(__dirname, '../backend/src/services/PrinterService.ts'),
        remote: '/var/www/poscafe/backend/src/services/PrinterService.ts'
    },
    {
        local: path.join(__dirname, '../backend/prisma/schema.prisma'),
        remote: '/var/www/poscafe/backend/prisma/schema.prisma'
    },
    {
        local: path.join(__dirname, '../frontend/src/components/POSView.tsx'),
        remote: '/var/www/poscafe/frontend/src/components/POSView.tsx'
    },
    {
        local: path.join(__dirname, '../frontend/src/components/TableView.tsx'),
        remote: '/var/www/poscafe/frontend/src/components/TableView.tsx'
    },
    {
        local: path.join(__dirname, '../frontend/src/components/CheckoutModal.tsx'),
        remote: '/var/www/poscafe/frontend/src/components/CheckoutModal.tsx'
    }
];

const conn = new Client();

conn.on('ready', () => {
    console.log('Connected to VPS. Uploading multi-table files...');
    
    conn.sftp((err, sftp) => {
        if (err) {
            console.error('SFTP Error:', err);
            conn.end();
            return;
        }

        let completed = 0;
        filesToUpload.forEach((file, index) => {
            const data = fs.readFileSync(file.local);
            sftp.writeFile(file.remote, data, (err) => {
                if (err) {
                    console.error(`Failed to upload ${file.local}:`, err);
                } else {
                    console.log(`[${index + 1}/${filesToUpload.length}] Uploaded: ${file.remote}`);
                }
                completed++;
                if (completed === filesToUpload.length) {
                    console.log('Building backend, pushing db schema, restarting PM2, and building frontend...');
                    const cmd = 'cd /var/www/poscafe/backend && npx prisma db push --accept-data-loss && npm run build && pm2 restart all && cd /var/www/poscafe/frontend && npm run build';
                    conn.exec(cmd, (err, stream) => {
                        if (err) {
                            console.error('Exec error:', err);
                            conn.end();
                            return;
                        }
                        stream.on('close', (code, signal) => {
                            console.log(`\nVPS Deployment finished with code: ${code}`);
                            conn.end();
                        }).on('data', (data) => {
                            process.stdout.write(data.toString());
                        }).stderr.on('data', (data) => {
                            process.stderr.write(data.toString());
                        });
                    });
                }
            });
        });
    });
}).connect(config);
