const { Client } = require('ssh2');
const config = { host: '173.212.243.240', port: 22, username: 'root', password: 'Ahmad_dcc07', readyTimeout: 15000 };
const conn = new Client();

const newNginxConfig = `server {
    server_name cafe.codenusa.id www.cafe.codenusa.id;

    client_max_body_size 25M;

    # Frontend
    root /var/www/poscafe/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Uploaded Images (Direct static serving from backend/uploads)
    location /uploads/ {
        alias /var/www/poscafe/backend/uploads/;
        access_log off;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Backend API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 25M;
    }

    # Socket.IO Proxy
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/cafe.codenusa.id/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/cafe.codenusa.id/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = cafe.codenusa.id) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    server_name cafe.codenusa.id www.cafe.codenusa.id;
    return 404; # managed by Certbot
}
`;

conn.on('ready', () => {
  // Backup old config first
  const cmd = `
    cp /etc/nginx/sites-available/cafe.codenusa.id /etc/nginx/sites-available/cafe.codenusa.id.bak
    cat << 'EOF' > /etc/nginx/sites-available/cafe.codenusa.id
${newNginxConfig}
EOF
    cp -rn /var/www/poscafe/backend/dist/uploads/* /var/www/poscafe/backend/uploads/ 2>/dev/null || true
    chmod -R 777 /var/www/poscafe/backend/uploads
    nginx -t && systemctl reload nginx
    echo "=== NGINX RELOAD SUCCESS ==="
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', code => {
      console.log('Finished with code:', code);
      conn.end();
    });
  });
}).connect(config);
