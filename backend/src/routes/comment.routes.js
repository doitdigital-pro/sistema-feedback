const express = require('express');
const prisma = require('../prisma');
const { authenticate } = require('../middlewares/auth.middleware');
const { injectAllowedProjects } = require('../middlewares/projectPermission.middleware');
const { requireRole } = require('../middlewares/role.middleware');

const router = express.Router();
router.use(authenticate);
router.use(injectAllowedProjects);

// GET /api/comments — Todos los comentarios (con filtros)
router.get('/', async (req, res, next) => {
  try {
    const { status, siteId, projectId } = req.query;

    // Verificar permisos si el usuario no es ADMIN
    if (req.user.role !== 'ADMIN') {
      if (projectId && !req.allowedProjectIds.includes(projectId)) {
        return res.status(403).json({ error: 'No tienes acceso a este proyecto.' });
      }
      if (siteId) {
        const site = await prisma.site.findUnique({ where: { id: siteId } });
        if (site && !req.allowedProjectIds.includes(site.projectId)) {
          return res.status(403).json({ error: 'No tienes acceso a este sitio.' });
        }
      }
    }

    const where = {
      ...(status && { status }),
      ...(siteId && { siteId }),
      ...(projectId && { site: { projectId } }),
      ...(req.user.role !== 'ADMIN' && {
        site: {
          projectId: { in: req.allowedProjectIds }
        }
      })
    };

    const comments = await prisma.comment.findMany({
      where,
      include: {
        site: { select: { id: true, name: true, url: true, project: { select: { id: true, name: true } } } },
        author: { select: { id: true, name: true, avatar: true } },
        ticket: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(comments);
  } catch (err) {
    next(err);
  }
});

// GET /api/comments/:id — Detalle de un comentario
router.get('/:id', async (req, res, next) => {
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: req.params.id },
      include: {
        site: { include: { project: true } },
        author: { select: { id: true, name: true, avatar: true } },
        ticket: { include: { assignee: { select: { id: true, name: true, avatar: true } } } },
      },
    });
    if (!comment) return res.status(404).json({ error: 'Comentario no encontrado.' });

    if (req.user.role !== 'ADMIN' && (!req.allowedProjectIds || !req.allowedProjectIds.includes(comment.site.projectId))) {
      return res.status(403).json({ error: 'No tienes acceso a este comentario.' });
    }

    res.json(comment);
  } catch (err) {
    next(err);
  }
});

// PUT /api/comments/:id/status — Cambiar estado
router.put('/:id/status', requireRole(['ADMIN', 'MEMBER']), async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Estado inválido. Usa: ${validStatuses.join(', ')}` });
    }

    const existingComment = await prisma.comment.findUnique({
      where: { id: req.params.id },
      include: { site: { select: { projectId: true } } }
    });

    if (!existingComment) return res.status(404).json({ error: 'Comentario no encontrado.' });

    if (req.user.role !== 'ADMIN' && (!req.allowedProjectIds || !req.allowedProjectIds.includes(existingComment.site.projectId))) {
      return res.status(403).json({ error: 'No tienes acceso a este comentario.' });
    }

    const comment = await prisma.comment.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(comment);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Comentario no encontrado.' });
    next(err);
  }
});

// DELETE /api/comments/:id
router.delete('/:id', requireRole(['ADMIN', 'MEMBER']), async (req, res, next) => {
  try {
    const existingComment = await prisma.comment.findUnique({
      where: { id: req.params.id },
      include: { site: { select: { projectId: true } } }
    });

    if (!existingComment) return res.status(404).json({ error: 'Comentario no encontrado.' });

    if (req.user.role !== 'ADMIN' && (!req.allowedProjectIds || !req.allowedProjectIds.includes(existingComment.site.projectId))) {
      return res.status(403).json({ error: 'No tienes acceso a este comentario.' });
    }

    await prisma.comment.delete({ where: { id: req.params.id } });
    res.json({ message: 'Comentario eliminado.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Comentario no encontrado.' });
    next(err);
  }
});

module.exports = router;
