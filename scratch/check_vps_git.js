const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const cmd = `
sudo -u postgres psql -d poscafe_db -c 'SELECT id, "waktuBuka", "waktuTutup", "saldoAwal", "saldoSistem", "saldoFisikLaci", status FROM "Shift" ORDER BY id DESC LIMIT 3;'
sudo -u postgres psql -d poscafe_db -c 'SELECT id, "orderNumber", "total", "paymentMethod", status, "createdAt", "paidAt" FROM "Order" ORDER BY id DESC LIMIT 3;'
`;





const conn = new Client();

conn.on('ready', () => {
    console.log('Connected to VPS...');
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', (code) => {
            console.log('\nCommand finished with code:', code);
            conn.end();
        });
    });
}).connect(config);
