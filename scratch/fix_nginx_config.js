const { Client } = require('ssh2');
const config = { host: '173.212.243.240', port: 22, username: 'root', password: 'Ahmad_dcc07' };

const cleanConfig = `server {
    listen 80;
    server_name demobilliard.codenusa.id;

    # Frontend
    location / {
        root /var/www/vamosdemo/vamos-pos-frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend
    location /api/ {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;

const cmd = `
cat << 'EOF' > /etc/nginx/sites-available/demobilliard
${cleanConfig}
EOF
nginx -t
if [ $? -eq 0 ]; then
    echo "✅ Nginx syntax check passed. Restarting Nginx..."
    systemctl restart nginx
    systemctl status nginx --no-pager
else
    echo "❌ Nginx syntax check failed!"
fi
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
