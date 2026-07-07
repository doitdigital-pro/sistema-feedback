const jwt = require('jsonwebtoken');

/**
 * Middleware: verifica que el request tiene un JWT válido
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado. Token requerido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.isTemp) {
      return res.status(403).json({ error: 'Debes completar la configuración de 2FA para acceder.' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
};

/**
 * Middleware: verifica JWT permitiendo tokens temporales (isTemp)
 */
const authenticateAllowTemp = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado. Token requerido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
};

/**
 * Middleware: verifica que el usuario tiene rol ADMIN
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol ADMIN.' });
  }
  next();
};

module.exports = { authenticate, authenticateAllowTemp, requireAdmin };
