const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

const nginxConfig = `server {
    listen 80;
    server_name cafe.codenusa.id www.cafe.codenusa.id;

    client_max_body_size 10M;

    # Frontend
    root /var/www/poscafe/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Uploaded Images
    location /uploads/ {
        alias /var/www/poscafe/backend/dist/uploads/;
        access_log off;
    }

    # Backend API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO Proxy
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}`;

const cmd = `
cat << 'EOF' > /etc/nginx/sites-available/cafe.codenusa.id
${nginxConfig}
EOF
nginx -t && systemctl restart nginx && echo "=== Nginx updated and restarted successfully ==="
`;

const conn = new Client();
conn.on('ready', () => {
    console.log('Connected to VPS. Updating Nginx config...');
    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', (code) => {
            console.log('Finished with code:', code);
            conn.end();
        });
    });
}).connect(config);
