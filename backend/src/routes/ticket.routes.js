const express = require('express');
const prisma = require('../prisma');
const { authenticate } = require('../middlewares/auth.middleware');
const { injectAllowedProjects } = require('../middlewares/projectPermission.middleware');
const notificationService = require('../services/notification.service');

const router = express.Router();
router.use(authenticate);
router.use(injectAllowedProjects);

// GET /api/tickets — Todos los tickets
router.get('/', async (req, res, next) => {
  try {
    const { status, priority, category, assigneeId, search, projectId } = req.query;

    const whereClause = {
      ...(status && { status }),
      ...(priority && { priority }),
      ...(category && { category }),
      ...(assigneeId && { assigneeId }),
      ...(projectId && { comment: { site: { projectId } } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { comment: { content: { contains: search, mode: 'insensitive' } } },
          { comment: { site: { name: { contains: search, mode: 'insensitive' } } } }
        ]
      }),
    };

    // If user is not ADMIN, filter by allowed projects
    if (req.allowedProjectIds) {
      whereClause.comment = {
        ...(whereClause.comment || {}),
        site: {
          ...(whereClause.comment?.site || {}),
          projectId: {
            in: req.allowedProjectIds,
            ...(projectId && { equals: projectId }), // projectId query param refines it further
          },
        },
      };
      // If only filtering by projectId within allowed, adjust
      if (projectId && req.allowedProjectIds.includes(projectId)) {
        whereClause.comment.site.projectId = { equals: projectId };
      }
    }

    const tickets = await prisma.ticket.findMany({
      where: whereClause,
      include: {
        comment: {
          include: {
            site: { select: { id: true, name: true, url: true, project: { select: { id: true, name: true, color: true } } } },
            attachments: true,
          },
        },
        assignee: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(tickets);
  } catch (err) {
    next(err);
  }
});

// GET /api/tickets/users — Lista de usuarios activos para asignar tickets
router.get('/users', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// GET /api/tickets/:id — Detalle del ticket
router.get('/:id', async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: {
        comment: {
          include: {
            site: { include: { project: true } },
            author: { select: { id: true, name: true, avatar: true } },
            attachments: true,
          },
        },
        assignee: { select: { id: true, name: true, avatar: true } },
        messages: {
          include: { author: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: 'asc' },
        }
      },
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado.' });

    // Check permission for non-admin
    if (req.allowedProjectIds) {
      const projectId = ticket.comment?.site?.project?.id;
      if (projectId && !req.allowedProjectIds.includes(projectId)) {
        return res.status(403).json({ error: 'No tienes acceso a este ticket.' });
      }
    }

    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

// PUT /api/tickets/:id — Actualizar ticket (status, priority, category, assignee, notes)
router.put('/:id', async (req, res, next) => {
  try {
    const { title, status, priority, category, assigneeId, notes } = req.body;
    
    // Check permission for non-admin
    if (req.allowedProjectIds) {
      const existing = await prisma.ticket.findUnique({
        where: { id: req.params.id },
        include: { comment: { include: { site: { select: { projectId: true } } } } },
      });
      if (existing) {
        const projectId = existing.comment?.site?.projectId;
        if (projectId && !req.allowedProjectIds.includes(projectId)) {
          return res.status(403).json({ error: 'No tienes permiso para modificar este ticket.' });
        }
      }
    }

    const data = {};
    if (title !== undefined) data.title = title;
    if (status !== undefined) data.status = status;
    if (priority !== undefined) data.priority = priority;
    if (category !== undefined) data.category = category;
    if (assigneeId !== undefined) data.assigneeId = assigneeId;
    if (notes !== undefined) data.notes = notes;

    if (status === 'RESOLVED' || status === 'CLOSED') {
      data.resolvedAt = new Date();
    }

    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data,
      include: {
        assignee: { select: { id: true, name: true, avatar: true } },
        comment: {
          select: {
            id: true,
            content: true,
            site: {
              select: {
                name: true,
                projectId: true,
                project: {
                  select: {
                    name: true,
                    clientEmail: true,
                    clientName: true
                  }
                }
              }
            }
          }
        }
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`project:${ticket.comment.site.projectId}`).emit('ticket:updated', {
        id: ticket.id,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        commentId: ticket.commentId,
        assignee: ticket.assignee,
        resolvedAt: ticket.resolvedAt,
        notes: ticket.notes,
      });
    }

    const projectInfo = ticket.comment?.site?.project;
    if ((status === 'RESOLVED' || status === 'CLOSED') && projectInfo && projectInfo.clientEmail) {
      const siteInfo = ticket.comment.site;
      const statusText = status === 'RESOLVED' ? 'Resuelto' : 'Cerrado';

      notificationService.sendEmail({
        to: projectInfo.clientEmail,
        subject: `✅ Ticket de Feedback ${statusText} - ${projectInfo.name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #10b981; margin-top: 0; font-size: 20px;">¡Feedback ${statusText}!</h2>
            <p>Hola <strong>${projectInfo.clientName || 'Cliente'}</strong>,</p>
            <p>Queremos informarte que hemos marcado como <strong>${statusText.toLowerCase()}</strong> tu reporte de feedback en el sitio web <strong>${siteInfo.name}</strong> (Proyecto: ${projectInfo.name}).</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; border-left: 4px solid #10b981;">
              <p style="margin: 0; font-size: 14px; color: #475569;"><strong>Tu comentario original:</strong></p>
              <p style="margin: 5px 0 0 0; font-style: italic; color: #1e293b; font-size: 15px;">"${ticket.comment.content}"</p>
            </div>
            ${ticket.notes ? `
            <div style="margin-top: 15px; padding: 15px; background-color: #eff6ff; border-radius: 6px; border-left: 4px solid #2563eb;">
              <p style="margin: 0; font-size: 14px; color: #1e40af;"><strong>Notas de resolución:</strong></p>
              <p style="margin: 5px 0 0 0; color: #1e293b; font-size: 15px;">${ticket.notes}</p>
            </div>
            ` : ''}
            <p style="margin-top: 25px; font-size: 14px; color: #475569;">Si consideras que el problema aún persiste o deseas agregar algo más, puedes responder directamente a este correo o escribir en el hilo de comentarios del sitio.</p>
            <p style="margin-top: 15px; font-size: 14px; font-weight: bold; color: #4f46e5;">Atentamente,<br/>El equipo de desarrollo de IMGC</p>
          </div>
        `,
        text: `Hola ${projectInfo.clientName || 'Cliente'},\nHemos marcado como ${statusText.toLowerCase()} tu reporte de feedback en el sitio ${siteInfo.name}: "${ticket.comment.content}".\n${ticket.notes ? `Notas: ${ticket.notes}\n` : ''}Atentamente,\nEl equipo de desarrollo de IMGC`
      }).catch(err => console.error("❌ Error al enviar correo de resolución al cliente:", err.message));
    }

    res.json(ticket);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Ticket no encontrado.' });
    next(err);
  }
});

// POST /api/tickets/:id/messages — Crear mensaje interno
router.post('/:id/messages', async (req, res, next) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'El contenido del mensaje es requerido.' });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: {
        comment: {
          select: {
            site: {
              select: { projectId: true }
            }
          }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }

    // Check permission for non-admin
    if (req.allowedProjectIds) {
      const projectId = ticket.comment?.site?.projectId;
      if (projectId && !req.allowedProjectIds.includes(projectId)) {
        return res.status(403).json({ error: 'No tienes permiso para enviar mensajes en este ticket.' });
      }
    }

    const message = await prisma.ticketMessage.create({
      data: {
        content,
        ticketId: req.params.id,
        authorId: req.user.id
      },
      include: {
        author: { select: { id: true, name: true, avatar: true } }
      }
    });

    const io = req.app.get('io');
    if (io && ticket.comment?.site?.projectId) {
      io.to(`project:${ticket.comment.site.projectId}`).emit('message:new', {
        message,
        ticketId: req.params.id,
        commentId: ticket.commentId,
      });
    }

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tickets/:id — Eliminar ticket
router.delete('/:id', async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      select: {
        commentId: true,
        comment: {
          select: {
            site: { select: { projectId: true } }
          }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }

    // Check permission for non-admin
    if (req.allowedProjectIds) {
      const projectId = ticket.comment?.site?.projectId;
      if (projectId && !req.allowedProjectIds.includes(projectId)) {
        return res.status(403).json({ error: 'No tienes permiso para eliminar este ticket.' });
      }
    }

    await prisma.comment.delete({
      where: { id: ticket.commentId }
    });

    res.json({ message: 'Ticket y feedback asociados eliminados correctamente.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
