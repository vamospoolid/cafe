const { Client } = require('ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Connected. Updating Nginx config...');
  const remoteScript = `
python3 - << 'EOF'
with open('/etc/nginx/sites-enabled/codenusa', 'r') as f:
    content = f.read()

snippet = """    # ── APK Downloads Directory ──
    location ^~ /downloads/ {
        alias /var/www/codenusa/release/;
        autoindex on;
        default_type application/vnd.android.package-archive;
        add_header Content-Disposition "attachment";
    }

"""

if 'location ^~ /downloads/' not in content:
    target = '    # ── Frontend SPA Fallback Routing ──'
    if target in content:
        new_content = content.replace(target, snippet + target)
        with open('/etc/nginx/sites-enabled/codenusa', 'w') as f:
            f.write(new_content)
        print('Updated /etc/nginx/sites-enabled/codenusa')
    else:
        print('Target not found in nginx config')
else:
    print('Downloads location already present')
EOF
nginx -t && systemctl reload nginx
`;

  conn.exec(remoteScript, (err, stream) => {
    if (err) throw err;
    stream.pipe(process.stdout);
    stream.on('close', () => {
      console.log('Done!');
      conn.end();
    });
  });
});

conn.on('error', err => {
  console.error('SSH Error:', err.message);
});

conn.connect(config);
