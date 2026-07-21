const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const prisma = require('../prisma');
const { sendEmail } = require('../services/notification.service');
const { logActivity, ACTIONS } = require('../services/activity.service');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      logActivity({ action: ACTIONS.LOGIN_FAILED, entity: 'user', details: { email }, ipAddress: req.ip });
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // 2FA Check
    if (user.twoFactorEnabled) {
      return res.json({ requires2FA: true, email: user.email });
    }

    // Comprobar si FORCE_2FA está activado en todo el sistema
    const force2faSetting = await prisma.systemSetting.findUnique({ where: { key: 'FORCE_2FA' } });
    if (force2faSetting && force2faSetting.value === 'true' && !user.twoFactorEnabled) {
      const tempToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.name, isTemp: true },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      return res.json({ requires2FASetup: true, tempToken, email: user.email });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { password: _, twoFactorSecret, ...userSafe } = user;
    logActivity({ action: ACTIONS.LOGIN, entity: 'user', entityId: user.id, details: { email: user.email }, userId: user.id, ipAddress: req.ip });
    res.json({ token, user: userSafe });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — Datos del usuario autenticado
const { authenticate, authenticateAllowTemp } = require('../middlewares/auth.middleware');

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, role: true, avatar: true, createdAt: true, twoFactorEnabled: true },
    });

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password — Solicitar restablecimiento de contraseña
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'El email es requerido.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Siempre responder igual por seguridad (no revelar si el email existe)
    if (!user || !user.isActive) {
      return res.json({ message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña.' });
    }

    // Generar token único de restablecimiento
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hora

    // Guardar token en el usuario
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetExpires,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    await sendEmail({
      to: email,
      subject: 'Restablecer contraseña — IMGC Feedback',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">IMGC Feedback</h2>
          <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
          <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${resetLink}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
              Restablecer contraseña
            </a>
          </p>
          <p style="color: #64748b; font-size: 13px;">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este correo.</p>
        </div>
      `,
      text: `Para restablecer tu contraseña, visita: ${resetLink}`,
    });

    res.json({ message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password — Restablecer contraseña con token
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token y nueva contraseña son requeridos.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetExpires: { gt: new Date() },
        isActive: true,
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'El enlace de restablecimiento es inválido o ha expirado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetExpires: null,
      },
    });

    res.json({ message: 'Contraseña restablecida correctamente. Ya puedes iniciar sesión.' });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// REGISTRO DE DEMO Y VERIFICACIÓN
// ==========================================
const demoRequests = new Map();

// POST /api/auth/demo-request
router.post('/demo-request', async (req, res, next) => {
  try {
    const { name, phone, email, message } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Nombre y correo electrónico son requeridos.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    demoRequests.set(email.toLowerCase(), {
      name,
      phone,
      message,
      code,
      expires
    });

    console.log(`🔑 [DEMO] Código de verificación generado para ${email}: ${code}`);

    await sendEmail({
      to: email,
      subject: 'Código de verificación de Demo — IMGC Feedback',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
          <h2 style="color: #4f46e5; margin-top: 0;">IMGC Feedback</h2>
          <p>Hola <strong>${name}</strong>,</p>
          <p>Para verificar tu correo y acceder a la versión de prueba, utiliza el siguiente código de verificación:</p>
          <div style="background: #f1f5f9; padding: 16px; text-align: center; border-radius: 6px; font-size: 24px; font-weight: 700; letter-spacing: 4px; color: #1e1b4b; margin: 20px 0;">
            ${code}
          </div>
          <p style="color: #64748b; font-size: 13px;">Este código expira en 10 minutos. Si no solicitaste esto, puedes ignorar este correo.</p>
        </div>
      `,
      text: `Tu código de verificación de Demo es: ${code}`,
    });

    const responseData = { success: true, email };
    if (process.env.NODE_ENV === 'development') {
      responseData.codeDev = code;
    }

    res.json(responseData);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/demo-verify
router.post('/demo-verify', async (req, res, next) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email y código son requeridos.' });
    }

    const key = email.toLowerCase();
    const request = demoRequests.get(key);

    if (!request) {
      return res.status(400).json({ error: 'No se encontró una solicitud de demo activa para este correo.' });
    }

    if (request.code !== code) {
      return res.status(400).json({ error: 'El código de verificación es incorrecto.' });
    }

    if (new Date() > request.expires) {
      demoRequests.delete(key);
      return res.status(400).json({ error: 'El código ha expirado. Por favor, solicita uno nuevo.' });
    }

    let user = await prisma.user.findUnique({ where: { email: key } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: key,
          name: request.name,
          password: await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10),
          role: 'ADMIN',
          isActive: true
        }
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    demoRequests.delete(key);

    const { password: _, twoFactorSecret, ...userSafe } = user;
    res.json({ token, user: userSafe });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2FA - TWO FACTOR AUTHENTICATION
// ==========================================

// POST /api/auth/2fa/verify (Paso 2 del Login)
router.post('/2fa/verify', async (req, res, next) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email y código son requeridos.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ error: 'Autenticación 2FA no habilitada para este usuario.' });
    }

    const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret });

    if (!isValid) {
      return res.status(401).json({ error: 'Código 2FA incorrecto.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { password: _, twoFactorSecret, ...userSafe } = user;
    res.json({ token, user: userSafe });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/2fa/generate (Requiere Auth temporal o completa) - Generar secreto y QR
router.post('/2fa/generate', authenticateAllowTemp, async (req, res, next) => {
  try {
    const secret = authenticator.generateSecret();
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    
    // Guardar el secreto temporalmente o actualizarlo (aún no habilitado hasta verificar)
    await prisma.user.update({
      where: { id: req.user.id },
      data: { twoFactorSecret: secret }
    });

    const otpauthUrl = authenticator.keyuri(user.email, 'IMGC Feedback', secret);
    
    qrcode.toDataURL(otpauthUrl, (err, imageUrl) => {
      if (err) {
        return res.status(500).json({ error: 'Error al generar el código QR.' });
      }
      res.json({ secret, qrCodeUrl: imageUrl });
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/2fa/verify-setup (Requiere Auth temporal o completa) - Confirmar activación
router.post('/2fa/verify-setup', authenticateAllowTemp, async (req, res, next) => {
  try {
    const { code } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user.twoFactorSecret) {
      return res.status(400).json({ error: 'Debes generar el código QR primero.' });
    }

    const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret });

    if (!isValid) {
      return res.status(400).json({ error: 'El código ingresado es incorrecto.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true }
    });

    // Siempre devolver el token final por si estaban usando un tempToken
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const { password: _, twoFactorSecret, ...userSafe } = user;

    res.json({ message: 'Autenticación 2FA habilitada correctamente.', token, user: userSafe });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/2fa/disable (Requiere Auth)
router.post('/2fa/disable', authenticate, async (req, res, next) => {
  try {
    const { code } = req.body; // Por seguridad, pedir el código para deshabilitar
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: 'El 2FA ya está deshabilitado.' });
    }

    // Verificar código antes de deshabilitar (para evitar que alguien en la PC abierta lo quite)
    if (!code) {
      return res.status(400).json({ error: 'Se requiere el código actual para deshabilitar.' });
    }

    const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
    if (!isValid) {
      return res.status(400).json({ error: 'Código incorrecto.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null
      }
    });

    res.json({ message: 'Autenticación 2FA deshabilitada correctamente.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
