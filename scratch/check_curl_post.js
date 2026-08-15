const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const cmd = `
echo "=== POST TO LOCALHOST:5000 ==="
curl -i -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"wrongpassword"}' http://127.0.0.1:5000/api/auth/login
echo ""
echo "=== POST TO cafe.codenusa.id (nginx) ==="
curl -i -X POST -H "Content-Type: application/json" -d '{"username":"admin","password":"wrongpassword"}' http://cafe.codenusa.id/api/auth/login
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected. Running post test...');
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', () => conn.end());
    });
}).connect(config);
