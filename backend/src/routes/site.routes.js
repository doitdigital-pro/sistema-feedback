const express = require('express');
const prisma = require('../prisma');
const { authenticate } = require('../middlewares/auth.middleware');
const { injectAllowedProjects } = require('../middlewares/projectPermission.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const notificationService = require('../services/notification.service');

const router = express.Router();
router.use(authenticate);
router.use(injectAllowedProjects);

// GET /api/sites — Todos los sitios
router.get('/', async (req, res, next) => {
  try {
    const where = {};
    if (req.user.role !== 'ADMIN') {
      where.projectId = { in: req.allowedProjectIds };
    }

    const sites = await prisma.site.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, color: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(sites);
  } catch (err) {
    next(err);
  }
});

// POST /api/sites — Crear sitio dentro de un proyecto
router.post('/', requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { name, url, projectId, mobileBreakpoint } = req.body;

    if (!name || !url || !projectId) {
      return res.status(400).json({ error: 'name, url y projectId son requeridos.' });
    }

    const site = await prisma.site.create({
      data: { name, url, projectId, mobileBreakpoint: mobileBreakpoint ? parseInt(mobileBreakpoint) : 768 },
      include: { project: { select: { id: true, name: true } } },
    });
    res.status(201).json(site);
  } catch (err) {
    next(err);
  }
});

// GET /api/sites/:id — Detalle del sitio
router.get('/:id', async (req, res, next) => {
  try {
    const site = await prisma.site.findUnique({
      where: { id: req.params.id },
      include: {
        project: true,
        _count: { select: { comments: true } },
      },
    });
    if (!site) return res.status(404).json({ error: 'Sitio no encontrado.' });

    if (req.user.role !== 'ADMIN' && (!req.allowedProjectIds || !req.allowedProjectIds.includes(site.projectId))) {
      return res.status(403).json({ error: 'No tienes acceso a este sitio.' });
    }

    res.json(site);
  } catch (err) {
    next(err);
  }
});

// GET /api/sites/:id/snippet — Obtener URL de revisión para el cliente
router.get('/:id/snippet', async (req, res, next) => {
  try {
    const site = await prisma.site.findUnique({ where: { id: req.params.id } });
    if (!site) return res.status(404).json({ error: 'Sitio no encontrado.' });

    if (req.user.role !== 'ADMIN' && (!req.allowedProjectIds || !req.allowedProjectIds.includes(site.projectId))) {
      return res.status(403).json({ error: 'No tienes acceso a este sitio.' });
    }

    const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
    const frontendUrl = origin || process.env.FRONTEND_URL || 'http://localhost:5173';
    const reviewUrl = `${frontendUrl}/review/${site.sdkToken}`;

    // También devolvemos el snippet SDK por compatibilidad
    const sdkUrl = `${process.env.SDK_BASE_URL}/sdk/imgc-feedback.min.js`;
    const snippet = `<!-- IMGC Feedback SDK -->
<script>window.IMGC_FEEDBACK_TOKEN = '${site.sdkToken}';</script>
<script src="${sdkUrl}" async></script>`;

    res.json({ reviewUrl, snippet, sdkToken: site.sdkToken, sdkUrl });
  } catch (err) {
    next(err);
  }
});

// GET /api/sites/:id/comments — Comentarios de un sitio
router.get('/:id/comments', async (req, res, next) => {
  try {
    const site = await prisma.site.findUnique({ where: { id: req.params.id } });
    if (!site) return res.status(404).json({ error: 'Sitio no encontrado.' });

    if (req.user.role !== 'ADMIN' && (!req.allowedProjectIds || !req.allowedProjectIds.includes(site.projectId))) {
      return res.status(403).json({ error: 'No tienes acceso a este sitio.' });
    }

    const { status } = req.query;

    const comments = await prisma.comment.findMany({
      where: {
        siteId: req.params.id,
        ...(status && { status }),
      },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        ticket: { select: { id: true, status: true, priority: true, assigneeId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(comments);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/sites/:id — Eliminar sitio
router.delete('/:id', requireRole(['ADMIN']), async (req, res, next) => {
  try {
    await prisma.site.delete({ where: { id: req.params.id } });
    res.json({ message: 'Sitio eliminado correctamente.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Sitio no encontrado.' });
    next(err);
  }
});

// POST /api/sites/:id/share-email — Enviar URL de revisión al cliente por correo
router.post('/:id/share-email', async (req, res, next) => {
  try {
    const site = await prisma.site.findUnique({ 
      where: { id: req.params.id },
      include: { project: true }
    });
    if (!site) return res.status(404).json({ error: 'Sitio no encontrado.' });

    if (req.user.role !== 'ADMIN' && (!req.allowedProjectIds || !req.allowedProjectIds.includes(site.projectId))) {
      return res.status(403).json({ error: 'No tienes acceso a este sitio.' });
    }

    const { email, subject, body } = req.body;
    
    if (!email || !subject || !body) {
      return res.status(400).json({ error: 'email, subject y body son requeridos.' });
    }
    
    // Enviar el correo usando el servicio de notificaciones
    await notificationService.sendEmail({
      to: email,
      subject: subject,
      html: `<div style="font-family: sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        ${body.replace(/\n/g, '<br/>')}
      </div>`,
      text: body
    });
    
    res.json({ success: true, message: 'Correo de revisión enviado con éxito.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
