const express = require('express');
const prisma = require('../prisma');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();
router.use(authenticate); // Require authentication for all settings routes

const DEFAULT_SETTINGS = {
  share_email_subject: 'Revisión de Sitio Web - {{projectName}}',
  share_email_body: 'Hola,\nTe compartimos el enlace para revisar y dejar comentarios visuales en el sitio web de tu proyecto:\n\nSitio: {{siteName}}\nProyecto: {{projectName}}\n\nEnlace de revisión: {{reviewUrl}}\n\nAtentamente,\nEl equipo de desarrollo de IMGC',
  share_whatsapp_template: '¡Hola! Te compartimos el enlace para revisar y dejar comentarios en *{{siteName}}* (Proyecto: {{projectName}}): {{reviewUrl}}',
  smtp_host: '',
  smtp_port: '587',
  smtp_user: '',
  smtp_pass: '',
  smtp_secure: 'false',
  smtp_from: 'IMGC Feedback <no-reply@imgc.com>',
  DEMOS_ENABLED: 'false',
  FORCE_2FA: 'false'
};

// GET /api/settings — Obtener todas las configuraciones con inyección de defaults
router.get('/', async (req, res, next) => {
  try {
    const settings = await prisma.systemSetting.findMany();
    const settingsMap = {};
    
    settings.forEach(s => {
      settingsMap[s.key] = s.value;
    });
    
    // Si falta alguna configuración por defecto, inyectarla
    let hasNewSettings = false;
    for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
      if (settingsMap[key] === undefined) {
        await prisma.systemSetting.upsert({
          where: { key },
          update: {},
          create: { key, value: val }
        });
        settingsMap[key] = val;
        hasNewSettings = true;
      }
    }
    
    res.json(settingsMap);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings — Actualizar configuraciones (Solo Administradores)
router.put('/', async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'No tienes permisos para modificar los ajustes del sistema.' });
    }
    
    const updates = req.body;
    
    for (const [key, value] of Object.entries(updates)) {
      // Validar que sea una configuración permitida
      if (DEFAULT_SETTINGS[key] !== undefined) {
        await prisma.systemSetting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) }
        });
      }
    }
    
    // Retornar configuraciones actualizadas completas
    const allSettings = await prisma.systemSetting.findMany();
    const settingsMap = {};
    allSettings.forEach(s => {
      settingsMap[s.key] = s.value;
    });
    
    res.json(settingsMap);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
