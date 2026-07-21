/**
 * Servicio de Activity Log para IMGC Feedback.
 * Registra acciones de usuarios en el sistema para auditoría y seguimiento.
 */
const prisma = require('../prisma');
const logger = require('../utils/logger');

// Acciones predefinidas
const ACTIONS = {
  // Auth
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOGIN_FAILED: 'LOGIN_FAILED',
  PASSWORD_RESET: 'PASSWORD_RESET',
  
  // Tickets
  TICKET_CREATED: 'TICKET_CREATED',
  TICKET_STATUS_CHANGED: 'TICKET_STATUS_CHANGED',
  TICKET_ASSIGNED: 'TICKET_ASSIGNED',
  TICKET_PRIORITY_CHANGED: 'TICKET_PRIORITY_CHANGED',
  TICKET_DELETED: 'TICKET_DELETED',
  TICKET_MESSAGE_ADDED: 'TICKET_MESSAGE_ADDED',
  
  // Projects
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  PROJECT_DELETED: 'PROJECT_DELETED',
  
  // Sites
  SITE_CREATED: 'SITE_CREATED',
  SITE_DELETED: 'SITE_DELETED',
  
  // Users
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  
  // Feedback
  FEEDBACK_RECEIVED: 'FEEDBACK_RECEIVED',
  
  // Settings
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
};

/**
 * Registra una actividad en el log.
 * @param {Object} params
 * @param {string} params.action - Tipo de acción (usa ACTIONS constants)
 * @param {string} [params.entity] - Tipo de entidad (ticket, project, user, etc.)
 * @param {string} [params.entityId] - ID de la entidad afectada
 * @param {Object} [params.details] - Detalles adicionales (se guarda como JSON)
 * @param {string} [params.userId] - ID del usuario que realizó la acción
 * @param {string} [params.ipAddress] - IP del usuario
 */
async function logActivity({ action, entity, entityId, details, userId, ipAddress }) {
  try {
    await prisma.activityLog.create({
      data: {
        action,
        entity: entity || null,
        entityId: entityId || null,
        details: details ? JSON.stringify(details) : null,
        userId: userId || null,
        ipAddress: ipAddress || null,
      },
    });
    logger.debug(`Activity logged: ${action}`, { entity, entityId });
  } catch (error) {
    // No dejamos que un fallo del log frene la operación principal
    logger.error('Error al registrar actividad', { action, error: error.message });
  }
}

/**
 * Obtener historial de actividad con paginación y filtros.
 */
async function getActivityLog({ page = 1, limit = 50, action, userId, entity, from, to }) {
  const where = {};
  
  if (action) where.action = action;
  if (userId) where.userId = userId;
  if (entity) where.entity = entity;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.activityLog.count({ where }),
  ]);

  return {
    logs: logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Obtener resumen de actividad para el dashboard.
 */
async function getActivitySummary(days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [todayCount, weekCount, topActions] = await Promise.all([
    prisma.activityLog.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    prisma.activityLog.count({
      where: { createdAt: { gte: since } },
    }),
    prisma.$queryRaw`
      SELECT action, COUNT(*)::int as count 
      FROM activity_logs 
      WHERE "createdAt" >= ${since}
      GROUP BY action 
      ORDER BY count DESC 
      LIMIT 10
    `,
  ]);

  return {
    today: todayCount,
    thisWeek: weekCount,
    topActions,
  };
}

module.exports = {
  ACTIONS,
  logActivity,
  getActivityLog,
  getActivitySummary,
};
