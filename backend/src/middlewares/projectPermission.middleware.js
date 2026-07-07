const prisma = require('../prisma');

/**
 * Middleware: inyecta en req los IDs de proyectos a los que el usuario tiene acceso.
 * Para ADMIN, devuelve todos. Para MEMBER/VIEWER, consulta UserProjectPermission.
 */
async function injectAllowedProjects(req, res, next) {
  try {
    if (req.user.role === 'ADMIN') {
      req.allowedProjectIds = null; // null = sin restricción
      return next();
    }

    const permissions = await prisma.userProjectPermission.findMany({
      where: { userId: req.user.id, canView: true },
      select: { projectId: true },
    });

    req.allowedProjectIds = permissions.map(p => p.projectId);

    if (req.allowedProjectIds.length === 0) {
      // Si no tiene ningún proyecto asignado, no verá nada
      req.allowedProjectIds = ['__none__'];
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware: verifica que el usuario tiene permiso canEdit en el proyecto del recurso.
 * Debe usarse después de obtener el ticket/comment/site que tenga projectId.
 */
async function requireProjectAccess(req, res, next) {
  try {
    if (req.user.role === 'ADMIN') return next();

    const projectId = req.projectId; // Debe ser inyectado por la ruta específica
    if (!projectId) return next();

    const permission = await prisma.userProjectPermission.findUnique({
      where: {
        userId_projectId: {
          userId: req.user.id,
          projectId,
        },
      },
    });

    if (!permission || !permission.canView) {
      return res.status(403).json({ error: 'No tienes acceso a este proyecto.' });
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { injectAllowedProjects, requireProjectAccess };
