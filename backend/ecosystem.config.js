module.exports = {
  apps: [{
    name: 'imgc-feedback-api',
    script: 'src/app.js',
    instances: 'max',       // Cluster mode: usa todos los CPU cores
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    
    // Variables de entorno para producción
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
    
    // Variables de entorno para desarrollo
    env_development: {
      NODE_ENV: 'development',
      PORT: 3001,
    },

    // Logs
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    merge_logs: true,
    
    // Reinicio elegante
    kill_timeout: 5000,
    listen_timeout: 10000,
    
    // Reinicio automático si la app crashea
    max_restarts: 10,
    min_uptime: '10s',
  }]
};
