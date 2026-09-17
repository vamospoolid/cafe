const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected to VPS. Pulling latest code and building frontend...');
    const cmd = `
    cd /var/www/poscafe
    git pull origin main
    cd frontend
    npm run build
    `;
    
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', (code) => {
            console.log('\nDeploy finished with exit code:', code);
            conn.end();
        });
    });
}).connect(config);
