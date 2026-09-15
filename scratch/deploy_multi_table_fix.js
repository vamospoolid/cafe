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
        local: path.join(__dirname, '../backend/prisma/schema.prisma'),
        remote: '/var/www/poscafe/backend/prisma/schema.prisma'
    },
    {
        local: path.join(__dirname, '../backend/src/routes/orders.ts'),
        remote: '/var/www/poscafe/backend/src/routes/orders.ts'
    },
    {
        local: path.join(__dirname, '../backend/src/routes/tables.ts'),
        remote: '/var/www/poscafe/backend/src/routes/tables.ts'
    },
    {
        local: path.join(__dirname, '../backend/src/services/PrinterService.ts'),
        remote: '/var/www/poscafe/backend/src/services/PrinterService.ts'
    },
    {
        local: path.join(__dirname, '../frontend/src/components/POSView.tsx'),
        remote: '/var/www/poscafe/frontend/src/components/POSView.tsx'
    },
    {
        local: path.join(__dirname, '../frontend/src/components/CheckoutModal.tsx'),
        remote: '/var/www/poscafe/frontend/src/components/CheckoutModal.tsx'
    },
    {
        local: path.join(__dirname, '../frontend/src/components/TableView.tsx'),
        remote: '/var/www/poscafe/frontend/src/components/TableView.tsx'
    }
];

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected to VPS. Uploading files...');
    
    conn.sftp((err, sftp) => {
        if (err) throw err;
        
        let uploaded = 0;
        filesToUpload.forEach(f => {
            const content = fs.readFileSync(f.local, 'utf8');
            sftp.writeFile(f.remote, content, 'utf8', (err) => {
                if (err) {
                    console.error('Error uploading', f.remote, err);
                    throw err;
                }
                uploaded++;
                console.log(`[${uploaded}/${filesToUpload.length}] Uploaded: ${f.remote}`);
                
                if (uploaded === filesToUpload.length) {
                    console.log('All files uploaded. Running prisma db push, builds, and reloading PM2...');
                    
                    const cmd = `
                    echo "=== 1. SYNC PRISMA DB ==="
                    cd /var/www/poscafe/backend
                    npx prisma generate
                    npx prisma db push
                    npm run build
                    pm2 reload poscafe-backend

                    echo "=== 2. BUILD FRONTEND ==="
                    cd /var/www/poscafe/frontend
                    npm run build
                    `;
                    
                    conn.exec(cmd, (err, stream) => {
                        if (err) throw err;
                        stream.on('data', d => process.stdout.write(d));
                        stream.stderr.on('data', d => process.stderr.write(d));
                        stream.on('close', (code) => {
                            console.log('\nVPS build & deployment finished with code:', code);
                            conn.end();
                        });
                    });
                }
            });
        });
    });
}).connect(config);
