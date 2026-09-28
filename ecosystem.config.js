module.exports = {
  apps: [
    {
      name: 'codenusa-backend',
      cwd: '/var/www/codenusa/backend',
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
      error_file: '/var/log/pm2/codenusa-error.log',
      out_file: '/var/log/pm2/codenusa-out.log',
      merge_logs: true,
      time: true
    }
  ]
};
