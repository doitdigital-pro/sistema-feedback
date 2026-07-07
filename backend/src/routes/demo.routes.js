const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');
const { sendEmail } = require('../services/notification.service');

const router = express.Router();

// Helper para generar contraseña aleatoria
function generateRandomPassword(length = 10) {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

// GET /api/demos/status - Comprobar si los demos están habilitados (Público)
router.get('/status', async (req, res, next) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'DEMOS_ENABLED' }
    });
    res.json({ enabled: setting && setting.value === 'true' });
  } catch (err) {
    next(err);
  }
});

// POST /api/demos/request - Solicitar un demo (Público)
router.post('/request', async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    // Verificar si los demos están habilitados
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'DEMOS_ENABLED' }
    });
    if (!setting || setting.value !== 'true') {
      return res.status(403).json({ error: 'La solicitud de demos está deshabilitada temporalmente.' });
    }

    if (!name || !email) {
      return res.status(400).json({ error: 'Nombre y correo son requeridos.' });
    }

    // Verificar límite de 1 vez por semana por IP
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const recentRequest = await prisma.demoRequest.findFirst({
      where: {
        ipAddress,
        createdAt: { gte: oneWeekAgo }
      }
    });

    if (recentRequest) {
      return res.status(429).json({ error: 'Solo se permite solicitar un demo por semana desde esta IP.' });
    }

    const demoRequest = await prisma.demoRequest.create({
      data: {
        name,
        email,
        ipAddress,
        status: 'PENDING'
      }
    });

    res.status(201).json({ message: 'Solicitud de demo enviada correctamente.', demoRequest });
  } catch (err) {
    next(err);
  }
});

// GET /api/demos - Listar solicitudes (Solo Admin)
router.get('/', authenticate, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const requests = await prisma.demoRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        demoUser: { select: { email: true, isActive: true } }
      }
    });
    res.json(requests);
  } catch (err) {
    next(err);
  }
});

// POST /api/demos/:id/approve - Aprobar solicitud (Solo Admin)
router.post('/:id/approve', authenticate, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const demoRequest = await prisma.demoRequest.findUnique({ where: { id: req.params.id } });
    if (!demoRequest) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    if (demoRequest.status === 'APPROVED') return res.status(400).json({ error: 'La solicitud ya fue aprobada.' });

    // Generar credenciales temporales
    const tempPassword = generateRandomPassword();
    const tempEmail = `demo_${demoRequest.id.split('-')[0]}@demo.imgc.com`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hora de duración

    // Usar transacción para crear todo
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear Usuario
      const user = await tx.user.create({
        data: {
          name: `Demo User (${demoRequest.name})`,
          email: tempEmail,
          password: passwordHash,
          role: 'DEMO',
        }
      });

      // 2. Crear Proyecto
      const project = await tx.project.create({
        data: {
          name: `Proyecto de Prueba de ${demoRequest.name}`,
          clientName: demoRequest.name,
          clientEmail: demoRequest.email,
        }
      });

      // 3. Crear Sitio
      const site = await tx.site.create({
        data: {
          name: 'Sitio Cliente Demo',
          url: 'http://localhost:5173', // URL del demo SDK
          projectId: project.id,
        }
      });

      // 4. Asignar permiso de usuario al proyecto
      await tx.userProjectPermission.create({
        data: {
          userId: user.id,
          projectId: project.id,
          canView: true,
          canEdit: true
        }
      });

      // 5. Actualizar solicitud
      const updatedRequest = await tx.demoRequest.update({
        where: { id: demoRequest.id },
        data: {
          status: 'APPROVED',
          demoUserId: user.id,
          expiresAt
        }
      });

      return { user, project, site, updatedRequest };
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    const sdkDemoUrl = `http://localhost:5173/?token=${result.site.sdkToken}`;

    // Enviar correo de notificación
    await sendEmail({
      to: demoRequest.email,
      subject: '¡Tu Demo de IMGC Feedback ha sido aprobado!',
      text: `Hola ${demoRequest.name}, tu demo ha sido aprobado. Acceso por 1 hora.\n\nPanel: ${frontendUrl}\nEmail: ${tempEmail}\nContraseña: ${tempPassword}\n\nPrueba el SDK aquí: ${sdkDemoUrl}`,
      html: `
        <h2>¡Hola ${demoRequest.name}!</h2>
        <p>Tu solicitud de demo ha sido aprobada. Tienes acceso al sistema por <strong>1 hora</strong>.</p>
        <h3>1. Panel de Control (Dashboard)</h3>
        <ul>
          <li><strong>URL:</strong> <a href="${frontendUrl}">${frontendUrl}</a></li>
          <li><strong>Email:</strong> ${tempEmail}</li>
          <li><strong>Contraseña:</strong> ${tempPassword}</li>
        </ul>
        <h3>2. Sitio de Prueba (SDK)</h3>
        <p>Puedes ver el widget de feedback en acción haciendo clic aquí:</p>
        <p><a href="${sdkDemoUrl}">${sdkDemoUrl}</a></p>
      `
    });

    res.json({ message: 'Solicitud aprobada.', data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/demos/:id/reject - Rechazar solicitud (Solo Admin)
router.post('/:id/reject', authenticate, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const updatedRequest = await prisma.demoRequest.update({
      where: { id: req.params.id },
      data: { status: 'REJECTED' }
    });

    // Opcional: enviar correo de rechazo
    await sendEmail({
      to: updatedRequest.email,
      subject: 'Actualización sobre tu solicitud de Demo - IMGC Feedback',
      text: 'Lo sentimos, tu solicitud de demo no ha podido ser aprobada en este momento.',
      html: '<p>Lo sentimos, tu solicitud de demo no ha podido ser aprobada en este momento.</p>'
    });

    res.json({ message: 'Solicitud rechazada.', demoRequest: updatedRequest });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
