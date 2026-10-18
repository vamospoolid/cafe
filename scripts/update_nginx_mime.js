const { Client } = require('ssh2');
const c = new Client();
c.on('ready', () => {
  const cmd = `
    if ! grep -q "apk" /etc/nginx/mime.types; then
      sed -i 's|types {|types {\\n    application/vnd.android.package-archive apk;|g' /etc/nginx/mime.types
      nginx -s reload
      echo "MIME_UPDATED"
    else
      echo "MIME_ALREADY_EXISTS"
    fi
    grep -i "apk" /etc/nginx/mime.types
  `;
  c.exec(cmd, (err, stream) => {
    stream.pipe(process.stdout);
    stream.on('close', () => c.end());
  });
}).connect({
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
});
