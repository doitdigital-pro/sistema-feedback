/**
 * Rutas de Activity Log — Historial de actividad del sistema.
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const { getActivityLog, getActivitySummary, ACTIONS } = require('../services/activity.service');

// GET /api/activity — Lista de actividad con paginación y filtros
router.get('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { page, limit, action, userId, entity, from, to } = req.query;
    
    const result = await getActivityLog({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      action,
      userId,
      entity,
      from,
      to,
    });

    res.json(result);
  } catch (error) {
    console.error('Error al obtener historial de actividad:', error);
    res.status(500).json({ error: 'Error al obtener historial de actividad' });
  }
});

// GET /api/activity/summary — Resumen para dashboard
router.get('/summary', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const summary = await getActivitySummary(days);
    res.json(summary);
  } catch (error) {
    console.error('Error al obtener resumen de actividad:', error);
    res.status(500).json({ error: 'Error al obtener resumen de actividad' });
  }
});

// GET /api/activity/actions — Lista de acciones disponibles
router.get('/actions', authenticate, requireRole('ADMIN'), (req, res) => {
  res.json(Object.keys(ACTIONS));
});

module.exports = router;
