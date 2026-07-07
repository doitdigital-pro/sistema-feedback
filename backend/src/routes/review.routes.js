const express = require('express');
const prisma = require('../prisma');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const notificationService = require('../services/notification.service');
const aiService = require('../services/ai.service');
const { uploadToSupabase } = require('../utils/storage');

const router = express.Router();

// Configuración de multer para archivos adjuntos de comentarios (ahora en memoria)
const storage = multer.memoryStorage();

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.rar', '.txt', '.csv'];
const DISALLOWED_MIMETYPES = ['text/html', 'image/svg+xml', 'application/javascript', 'text/javascript', 'application/xml', 'text/xml'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext) || DISALLOWED_MIMETYPES.includes(file.mimetype.toLowerCase())) {
    return cb(new Error('Tipo de archivo no permitido. Solo se aceptan imágenes y documentos comunes.'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, fieldSize: 50 * 1024 * 1024 },
  fileFilter
});

/**
 * Middleware: Valida el sdkToken y carga el sitio en req.site
 */
async function validateReviewToken(req, res, next) {
  try {
    const { token } = req.params;
    const site = await prisma.site.findUnique({
      where: { sdkToken: token },
      include: { project: { select: { id: true, name: true, color: true } } }
    });

    if (!site || !site.isActive) {
      return res.status(404).json({ error: 'Enlace de revisión inválido o sitio desactivado.' });
    }

    req.site = site;
    next();
  } catch (err) {
    next(err);
  }
}

// ==========================================
// GET /api/review/:token — Info del sitio
// ==========================================
router.get('/:token', validateReviewToken, async (req, res) => {
  const { site } = req;
  res.json({
    site: {
      id: site.id,
      name: site.name,
      url: site.url,
      mobileBreakpoint: site.mobileBreakpoint || 768,
    },
    project: {
      id: site.project.id,
      name: site.project.name,
      color: site.project.color,
    }
  });
});

// ==========================================
// GET /api/review/:token/comments — Todos los comentarios del sitio
// ==========================================
router.get('/:token/comments', validateReviewToken, async (req, res, next) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { siteId: req.site.id },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        attachments: true,
        ticket: {
          select: {
            id: true,
            status: true,
            priority: true,
            messages: {
              include: {
                author: { select: { id: true, name: true, avatar: true } }
              },
              orderBy: { createdAt: 'asc' }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(comments);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// POST /api/review/:token/comments — Cliente deja un nuevo comentario
// ==========================================
router.post('/:token/comments', validateReviewToken, upload.array('files', 5), async (req, res, next) => {
  try {
    const {
      content,
      guestName,
      pageUrl,
      xPercent,
      yPercent,
      screenshotBase64,
      browserInfo,
      scrollX,
      scrollY,
    } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'El comentario es requerido.' });
    }

    // Guardar screenshot en Supabase si viene en base64
    let screenshotUrl = null;
    if (screenshotBase64) {
      const matches = screenshotBase64.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
      if (matches) {
        const ext = matches[1];
        const data = matches[2];
        const filename = `screenshots/screenshot-${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`;
        const buffer = Buffer.from(data, 'base64');
        try {
          screenshotUrl = await uploadToSupabase(buffer, filename, `image/${ext}`);
        } catch (e) {
          console.error("Error subiendo screenshot a Supabase en review:", e);
        }
      } else {
        // Si no tiene formato data URI, guardar como URL directa
        screenshotUrl = screenshotBase64;
      }
    }

    // Parse browser info si viene como JSON string
    let browser = {};
    if (browserInfo) {
      try { browser = JSON.parse(browserInfo); } catch (e) { /* ignore */ }
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        guestName: guestName || 'Anónimo',
        pageUrl: pageUrl || req.site.url,
        xPercent: parseFloat(xPercent) || 0,
        yPercent: parseFloat(yPercent) || 0,
        screenshotUrl,
        browserName: browser.browserName || null,
        browserVersion: browser.browserVersion || null,
        osName: browser.osName || null,
        osVersion: browser.osVersion || null,
        screenWidth: browser.screenWidth ? parseInt(browser.screenWidth) : null,
        screenHeight: browser.screenHeight ? parseInt(browser.screenHeight) : null,
        viewportWidth: browser.viewportWidth ? parseInt(browser.viewportWidth) : null,
        viewportHeight: browser.viewportHeight ? parseInt(browser.viewportHeight) : null,
        scrollX: scrollX ? parseInt(scrollX) : 0,
        scrollY: scrollY ? parseInt(scrollY) : 0,
        siteId: req.site.id,
      },
    });

    // Procesar archivos adjuntos
    if (req.files && req.files.length > 0) {
      const attachmentsData = [];
      for (const file of req.files) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = `attachments/${uniqueSuffix}-${file.originalname}`;
        try {
          const publicUrl = await uploadToSupabase(file.buffer, filename, file.mimetype);
          attachmentsData.push({
            filename: file.originalname,
            path: publicUrl,
            mimetype: file.mimetype,
            size: file.size,
            commentId: comment.id,
          });
        } catch (e) {
          console.error(`Error subiendo archivo ${file.originalname} a Supabase:`, e);
        }
      }

      if (attachmentsData.length > 0) {
        await prisma.attachment.createMany({
          data: attachmentsData,
        });
      }
    }

    // Clasificar feedback visual con IA
    const aiClassification = await aiService.classifyTicket(content);

    // Crear ticket automáticamente
    const ticket = await prisma.ticket.create({
      data: {
        title: content.substring(0, 80) + (content.length > 80 ? '...' : ''),
        commentId: comment.id,
        category: aiClassification.category,
        priority: aiClassification.priority,
      },
    });

    // Devolver el comentario completo con ticket y adjuntos
    const fullComment = await prisma.comment.findUnique({
      where: { id: comment.id },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        attachments: true,
        ticket: {
          select: {
            id: true,
            status: true,
            priority: true,
            messages: true
          }
        }
      }
    });

    // Notificar en tiempo real al Dashboard
    const io = req.app.get('io');
    if (io) {
      io.to(`project:${req.site.project.id}`).emit('feedback:new', {
        comment: fullComment,
        site: { id: req.site.id, name: req.site.name },
        project: req.site.project,
      });
    }

    // Disparar Webhooks (Slack/Discord) de forma asíncrona
    notificationService.sendFeedbackWebhooks({
      project: req.site.project,
      site: req.site,
      comment: fullComment,
      ticket
    });

    res.status(201).json(fullComment);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// POST /api/review/:token/comments/:commentId/reply
// El cliente responde a un comentario existente
// ==========================================
router.post('/:token/comments/:commentId/reply', validateReviewToken, async (req, res, next) => {
  try {
    const { content, guestName } = req.body;
    const { commentId } = req.params;

    if (!content) {
      return res.status(400).json({ error: 'El mensaje es requerido.' });
    }

    // Buscar el ticket asociado al comentario cargando el desarrollador asignado
    const ticket = await prisma.ticket.findUnique({
      where: { commentId },
      include: {
        assignee: true
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'No se encontró el ticket asociado a este comentario.' });
    }

    const message = await prisma.ticketMessage.create({
      data: {
        content,
        guestName: guestName || 'Cliente',
        ticketId: ticket.id,
        authorId: null, // No es un usuario del panel
      },
    });

    // Notificar via Socket.io
    const io = req.app.get('io');
    if (io && req.site?.projectId) {
      io.to(`project:${req.site.projectId}`).emit('message:new', {
        message,
        ticketId: ticket.id,
        commentId,
      });
    }

    // Si el ticket tiene un desarrollador asignado, notificarle por correo
    if (ticket.assignee && ticket.assignee.email) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const ticketUrl = `${frontendUrl}/tickets/${ticket.id}`;
      
      notificationService.sendEmail({
        to: ticket.assignee.email,
        subject: `💬 Nueva respuesta de Cliente en ticket de ${req.site.project.name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #4f46e5; margin-top: 0; font-size: 20px;">Nueva respuesta en ticket de Feedback</h2>
            <p>Hola <strong>${ticket.assignee.name}</strong>,</p>
            <p>El cliente ha dejado una respuesta en el ticket que tienes asignado en el proyecto <strong>${req.site.project.name}</strong>.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; border-left: 4px solid #4f46e5;">
              <p style="margin: 0; font-size: 14px; color: #475569;"><strong>Respuesta del cliente:</strong></p>
              <p style="margin: 5px 0 0 0; font-style: italic; color: #1e293b; font-size: 15px;">"${content}"</p>
            </div>
            <p style="margin-top: 25px; font-size: 14px; color: #475569;">Puedes ver el ticket completo y responder en el panel administrativo:</p>
            <a href="${ticketUrl}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 5px; font-size: 14px;">Ver en el Dashboard</a>
          </div>
        `,
        text: `Hola ${ticket.assignee.name},\nEl cliente ha dejado una respuesta en el ticket del proyecto ${req.site.project.name}: "${content}". Ver en el Dashboard: ${ticketUrl}`
      }).catch(err => console.error("❌ Error al enviar correo de notificación a asignado:", err.message));
    }

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
