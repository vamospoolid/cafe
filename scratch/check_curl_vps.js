const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const cmd = `
echo "=== Check HTTP cafe.codenusa.id response ==="
curl -I http://127.0.0.1:5000/api/settings
curl -I http://cafe.codenusa.id/staff
`;

const conn = new Client();
conn.on('ready', () => {
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', () => conn.end());
    });
}).connect(config);
