const { Client } = require('ssh2');

const config = {
  host: '173.212.243.240',
  port: 22,
  username: 'root',
  password: 'Ahmad_dcc07'
};

const conn = new Client();
conn.on('ready', () => {
  const setupScript = `
set -e
echo "1. Creating backup of poscafe_standalone_db..."
sudo -u postgres pg_dump poscafe_standalone_db > /root/backup_poscafe_standalone_$(date +%Y%m%d_%H%M%S).sql

echo "2. Creating database mukiramen_db..."
sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname = 'mukiramen_db'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE mukiramen_db OWNER poscafe_user;"

echo "3. Populating mukiramen_db from poscafe_standalone_db..."
sudo -u postgres pg_dump poscafe_standalone_db | sudo -u postgres psql -d mukiramen_db

echo "4. Granting privileges to poscafe_user on mukiramen_db..."
sudo -u postgres psql -d mukiramen_db -c "GRANT ALL ON SCHEMA public TO poscafe_user;"
sudo -u postgres psql -d mukiramen_db -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO poscafe_user;"
sudo -u postgres psql -d mukiramen_db -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO poscafe_user;"
sudo -u postgres psql -d mukiramen_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO poscafe_user;"
sudo -u postgres psql -d mukiramen_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO poscafe_user;"

echo "5. Verifying mukiramen_db tables and data..."
sudo -u postgres psql -d mukiramen_db -c "SELECT count(*) as total_tables FROM information_schema.tables WHERE table_schema = 'public';"
sudo -u postgres psql -d mukiramen_db -c "SELECT id, name, slug, \\"customDomain\\" FROM \\"Tenant\\";"
sudo -u postgres psql -d mukiramen_db -c "SELECT count(*) as total_orders FROM \\"Order\\";"
`;

  conn.exec(setupScript, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => {
      conn.end();
    });
  });
}).connect(config);
