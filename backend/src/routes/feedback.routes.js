const express = require('express');
const prisma = require('../prisma');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const aiService = require('../services/ai.service');
const { uploadToSupabase } = require('../utils/storage');
const xss = require('xss');

const router = express.Router();

// Configuración de multer (ahora en memoria)
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
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // Límite de 10MB por archivo
    fieldSize: 50 * 1024 * 1024 // Límite de 50MB para campos de texto (screenshot en base64)
  },
  fileFilter: fileFilter
});

/**
 * POST /api/feedback
 * Endpoint PÚBLICO — lo usa el SDK desde cualquier sitio web.
 * Autenticación: sdkToken en el body
 * Maneja multipart/form-data
 */
router.post('/', upload.array('files', 5), async (req, res, next) => {
  try {
    const {
      sdkToken,
      content,
      pageUrl,
      pageTitle,
      xPercent,
      yPercent,
      browserName,
      browserVersion,
      osName,
      osVersion,
      screenWidth,
      screenHeight,
      viewportWidth,
      viewportHeight,
      screenshotBase64,
      scrollX,
      scrollY,
    } = req.body;

    // Validaciones
    if (!sdkToken) return res.status(400).json({ error: 'sdkToken es requerido.' });
    if (!content) return res.status(400).json({ error: 'El contenido del comentario es requerido.' });
    if (!pageUrl) return res.status(400).json({ error: 'pageUrl es requerido.' });

    // Buscar el sitio por su token
    const site = await prisma.site.findUnique({
      where: { sdkToken },
      include: { project: { select: { id: true, name: true } } },
    });

    if (!site || !site.isActive) {
      return res.status(401).json({ error: 'Token de SDK inválido o sitio desactivado.' });
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
          console.error("Error subiendo screenshot a Supabase:", e);
        }
      } else {
        screenshotUrl = screenshotBase64;
      }
    }

    // Sanitizar inputs
    const safeContent = xss(content);
    const safePageTitle = pageTitle ? xss(pageTitle) : null;
    const safeBrowserName = browserName ? xss(browserName) : null;
    const safeOsName = osName ? xss(osName) : null;

    // Crear el comentario
    const comment = await prisma.comment.create({
      data: {
        content: safeContent,
        pageUrl,
        pageTitle: safePageTitle,
        xPercent: parseFloat(xPercent) || 0,
        yPercent: parseFloat(yPercent) || 0,
        browserName: safeBrowserName,
        browserVersion,
        osName: safeOsName,
        osVersion,
        screenWidth: screenWidth ? parseInt(screenWidth) : null,
        screenHeight: screenHeight ? parseInt(screenHeight) : null,
        viewportWidth: viewportWidth ? parseInt(viewportWidth) : null,
        viewportHeight: viewportHeight ? parseInt(viewportHeight) : null,
        scrollX: scrollX ? parseInt(scrollX) : 0,
        scrollY: scrollY ? parseInt(scrollY) : 0,
        screenshotUrl,
        siteId: site.id,
      },
    });

    // Procesar archivos subidos (attachments)
    if (req.files && req.files.length > 0) {
      const attachmentsData = [];
      
      for (const file of req.files) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = `attachments/${uniqueSuffix}-${file.originalname}`;
        try {
          const publicUrl = await uploadToSupabase(file.buffer, filename, file.mimetype);
          attachmentsData.push({
            filename: file.originalname,
            path: publicUrl, // Ahora guardamos la URL pública
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
    const aiClassification = await aiService.classifyTicket(safeContent);

    // Crear ticket automáticamente
    const ticket = await prisma.ticket.create({
      data: {
        title: safeContent.substring(0, 80) + (safeContent.length > 80 ? '...' : ''),
        commentId: comment.id,
        category: aiClassification.category,
        priority: aiClassification.priority,
      },
      include: {
        comment: {
          include: {
            attachments: true
          }
        }
      }
    });

    // Notificar en tiempo real al panel
    const io = req.app.get('io');
    if (io) {
      io.to(`project:${site.project.id}`).emit('feedback:new', {
        comment: ticket.comment,
        ticket,
        site: { id: site.id, name: site.name },
        project: site.project,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Feedback recibido correctamente.',
      commentId: comment.id,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
