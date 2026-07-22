const prisma = require('../prisma');

/**
 * Middleware para controlar acceso por Organización / Tenant en SaaS
 */
const checkTenantAccess = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado.' });
  }

  // SUPER_ADMIN tiene acceso global
  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  const organizationId = req.user.organizationId || req.headers['x-organization-id'];
  req.organizationId = organizationId || null;
  next();
};

module.exports = { checkTenantAccess };
