module.exports = {
  apps: [
    {
      name: 'poscal-notification-worker',
      cwd: __dirname,
      script: './dist/notification-worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '250M',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'poscal-price-ingestor',
      cwd: __dirname,
      script: './dist/price-ingestor.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '250M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
