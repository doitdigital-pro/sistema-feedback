const express = require('express');
const prisma = require('../prisma');
const { authenticate } = require('../middlewares/auth.middleware');
const { injectAllowedProjects } = require('../middlewares/projectPermission.middleware');
const { requireRole } = require('../middlewares/role.middleware');

const router = express.Router();

// Todas las rutas de proyectos requieren autenticación
router.use(authenticate);
router.use(injectAllowedProjects);

// GET /api/projects — Lista todos los proyectos
router.get('/', async (req, res, next) => {
  try {
    const whereClause = {};
    if (req.allowedProjectIds) {
      whereClause.id = { in: req.allowedProjectIds };
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        sites: {
          select: { id: true, name: true, url: true, isActive: true },
        },
        _count: { select: { sites: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/list — Lista simple de proyectos (solo id, name) para selectores
router.get('/list', async (req, res, next) => {
  try {
    const whereClause = { isActive: true };
    if (req.allowedProjectIds) {
      whereClause.id = { in: req.allowedProjectIds };
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      select: { id: true, name: true, isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects — Crear proyecto
router.post('/', requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { name, description, clientName, clientEmail, color } = req.body;

    if (!name) return res.status(400).json({ error: 'El nombre del proyecto es requerido.' });

    const project = await prisma.project.create({
      data: { name, description, clientName, clientEmail, color },
    });
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:id — Detalle del proyecto
router.get('/:id', async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN' && (!req.allowedProjectIds || !req.allowedProjectIds.includes(req.params.id))) {
      return res.status(403).json({ error: 'No tienes acceso a este proyecto.' });
    }

    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        sites: {
          include: {
            _count: { select: { comments: true } },
          },
        },
      },
    });

    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado.' });
    res.json(project);
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:id — Actualizar proyecto
router.put('/:id', requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { name, description, clientName, clientEmail, color, isActive } = req.body;

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { name, description, clientName, clientEmail, color, isActive },
    });
    res.json(project);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Proyecto no encontrado.' });
    next(err);
  }
});

// GET /api/projects/:id/report — Obtener toda la data consolidada del proyecto para reportes
router.get('/:id/report', async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN' && (!req.allowedProjectIds || !req.allowedProjectIds.includes(req.params.id))) {
      return res.status(403).json({ error: 'No tienes acceso a este proyecto.' });
    }

    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        sites: {
          include: {
            comments: {
              include: {
                attachments: true,
                author: { select: { id: true, name: true, avatar: true } },
                ticket: {
                  include: {
                    assignee: { select: { id: true, name: true } },
                    messages: {
                      include: {
                        author: { select: { id: true, name: true, avatar: true } }
                      },
                      orderBy: { createdAt: 'asc' }
                    }
                  }
                }
              },
              orderBy: { createdAt: 'asc' }
            }
          }
        }
      }
    });

    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado.' });
    res.json(project);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:id — Eliminar proyecto
router.delete('/:id', requireRole(['ADMIN']), async (req, res, next) => {
  try {
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ message: 'Proyecto eliminado correctamente.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Proyecto no encontrado.' });
    next(err);
  }
});

module.exports = router;
