/**
 * Logger profesional para IMGC Feedback.
 * Reemplaza console.log con formato estructurado, timestamps y niveles.
 * En producción: solo JSON. En desarrollo: coloreado para terminal.
 */

const isDev = process.env.NODE_ENV !== 'production';

const LEVELS = {
  ERROR: { label: 'ERROR', color: '\x1b[31m', emoji: '❌' },
  WARN:  { label: 'WARN',  color: '\x1b[33m', emoji: '⚠️' },
  INFO:  { label: 'INFO',  color: '\x1b[36m', emoji: '📌' },
  DEBUG: { label: 'DEBUG', color: '\x1b[90m', emoji: '🔍' },
};

const RESET = '\x1b[0m';

function formatTimestamp() {
  return new Date().toISOString();
}

function log(level, message, meta = {}) {
  const levelConfig = LEVELS[level] || LEVELS.INFO;

  if (isDev) {
    // Desarrollo: formato legible con colores
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    console.log(
      `${levelConfig.color}[${formatTimestamp()}] ${levelConfig.emoji} ${levelConfig.label}${RESET}: ${message}${metaStr}`
    );
  } else {
    // Producción: JSON estructurado para herramientas de monitoreo
    const entry = {
      timestamp: formatTimestamp(),
      level: levelConfig.label,
      message,
      ...meta,
    };
    
    if (level === 'ERROR') {
      console.error(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  }
}

const logger = {
  info:  (message, meta) => log('INFO', message, meta),
  warn:  (message, meta) => log('WARN', message, meta),
  error: (message, meta) => log('ERROR', message, meta),
  debug: (message, meta) => log('DEBUG', message, meta),
  
  // Helpers de dominio
  request: (method, path, statusCode, duration) => {
    log('INFO', `${method} ${path} → ${statusCode}`, { duration: `${duration}ms` });
  },
  
  auth: (action, email) => {
    log('INFO', `Auth: ${action}`, { email });
  },
  
  feedback: (action, details) => {
    log('INFO', `Feedback: ${action}`, details);
  },
};

module.exports = logger;
