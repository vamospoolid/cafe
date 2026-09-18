module.exports = {
  apps: [
    {
      name: 'codepos-backend',
      cwd: '/var/www/codepos/backend',
      script: 'dist/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '600M',
      restart_delay: 3000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
        TZ: 'Asia/Jakarta'
      },
      error_file: '/var/log/pm2/codepos-error.log',
      out_file: '/var/log/pm2/codepos-out.log',
      merge_logs: true,
      time: true
    }
  ]
};
