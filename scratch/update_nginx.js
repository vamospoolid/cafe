const { Client } = require('c:/ADATA/pooos/node_modules/ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

const nginxConf = `server {
    server_name cafe.codenusa.id www.cafe.codenusa.id;

    client_max_body_size 10M;

    # Frontend
    root /var/www/poscafe/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Disable cache for index.html & service worker to prevent stale PWA builds
    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
        expires -1;
    }

    location = /sw.js {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
        expires -1;
    }

    # Cache immutable Vite bundles
    location ~* ^/assets/.*\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
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

const cmd = `cat << 'EOF' > /etc/nginx/sites-available/cafe.codenusa.id
${nginxConf}
EOF
nginx -t && systemctl reload nginx
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
