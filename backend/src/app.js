require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const jwt = require('jsonwebtoken');
const logger = require('./utils/logger');

// Rutas
const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/project.routes');
const siteRoutes = require('./routes/site.routes');
const commentRoutes = require('./routes/comment.routes');
const ticketRoutes = require('./routes/ticket.routes');
const feedbackRoutes = require('./routes/feedback.routes'); // Endpoint público del SDK
const userRoutes = require('./routes/user.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const reviewRoutes = require('./routes/review.routes');
const installRoutes = require('./routes/install.routes');
const settingRoutes = require('./routes/setting.routes');
const demoRoutes = require('./routes/demo.routes');
const activityRoutes = require('./routes/activity.routes');
const tagRoutes = require('./routes/tag.routes');

const app = express();
const server = http.createServer(app);

// Trust proxy para nginx/reverse proxy en VPS
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ==========================================
// SOCKET.IO
// ==========================================
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000'
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    methods: ['GET', 'POST'],
  },
});

// Middleware de autenticación para Socket.io
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const sdkToken = socket.handshake.auth?.sdkToken;

  // Si es una Review Page (cliente público), verificamos el sdkToken
  if (sdkToken) {
    const prisma = require('./prisma');
    prisma.site.findUnique({
      where: { sdkToken },
      select: { id: true, projectId: true, isActive: true }
    })
    .then(site => {
      if (!site || !site.isActive) {
        return next(new Error('No autorizado: sdkToken inválido o inactivo'));
      }
      socket.site = site;
      next();
    })
    .catch(err => {
      next(new Error('Error de base de datos en autenticación de socket'));
    });
    return;
  }

  // Si es del panel de administración, verificamos el token JWT
  if (!token) {
    return next(new Error('No autorizado: Token de autenticación ausente'));
  }
  
  try {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET no configurado');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    return next(new Error('No autorizado: Token inválido'));
  }
});

io.on('connection', (socket) => {
  if (socket.site) {
    console.log(`🔌 Cliente de Review Page conectado: ${socket.id} (Proyecto: ${socket.site.projectId})`);
    socket.join(`project:${socket.site.projectId}`);
  } else {
    console.log(`🔌 Admin conectado: ${socket.id} (Usuario: ${socket.user?.name || 'Anon'})`);
  }

  socket.on('join-project', (projectId) => {
    console.log(`🔑 Admin se unió a sala de proyecto: ${projectId}`);
    socket.join(`project:${projectId}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Cliente desconectado: ${socket.id}`);
  });
});

// Exportar io para usarlo en los controllers
app.set('io', io);

// ==========================================
// MIDDLEWARES GLOBALES
// ==========================================
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Cabeceras de seguridad HTTP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "https:", "wss:", "ws:"],
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" } // Permite cargar recursos de uploads desde el frontend
}));

// Límite de peticiones global (200 peticiones por 15 minutos por IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Demasiadas peticiones desde esta IP. Por favor, inténtalo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', globalLimiter);

// Límite más estricto para inicio de sesión y recuperación de contraseña (15 peticiones por 15 minutos)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 100 : 15,
  message: { error: 'Demasiados intentos de autenticación. Por favor, inténtalo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// Límite de peticiones para feedback público del SDK (30 comentarios/uploads por 15 minutos)
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Has enviado demasiado feedback. Por favor, espera un momento antes de enviar más.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/feedback', feedbackLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==========================================
// DETECCIÓN E INSTALACIÓN DE SISTEMA
// ==========================================
let isSystemInstalled = false;

async function checkInstallation() {
  if (isSystemInstalled) return true;
  const fs = require('fs');
  const envPath = path.join(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return false;
  if (!process.env.DATABASE_URL) return false;

  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    await prisma.$disconnect();
    isSystemInstalled = adminCount > 0;
    return isSystemInstalled;
  } catch (e) {
    return false;
  }
}

// Middleware de verificación de instalación
app.use(async (req, res, next) => {
  // Rutas permitidas durante la instalación
  if (req.path.startsWith('/install') || req.path.startsWith('/api/install') || req.path === '/favicon.ico') {
    return next();
  }

  const installed = await checkInstallation();
  if (!installed) {
    if (req.path.startsWith('/api')) {
      return res.status(403).json({ error: 'El sistema requiere instalación.', requiresInstall: true });
    }
    return res.redirect('/install');
  }

  next();
});

// Rutas del Instalador
app.use('/', installRoutes);

// Servir archivos subidos (screenshots)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Servir archivo SDK compilado
app.use('/sdk', express.static(path.join(__dirname, '../../sdk/dist')));

// Servir sitio web de prueba interactivo (SPA)
app.use('/test-site', express.static(path.join(__dirname, '../public_test')));

// ==========================================
// RUTAS
// ==========================================
const adminCors = cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
});

const publicCors = cors({ origin: '*' });

app.use('/api/auth', adminCors, authRoutes);
app.use('/api/projects', adminCors, projectRoutes);
app.use('/api/sites', adminCors, siteRoutes);
app.use('/api/comments', adminCors, commentRoutes);
app.use('/api/tickets', adminCors, ticketRoutes);
app.use('/api/users', adminCors, userRoutes);
app.use('/api/dashboard', adminCors, dashboardRoutes);
app.use('/api/settings', adminCors, settingRoutes);
app.use('/api/tags', adminCors, tagRoutes);
app.use('/api/feedback', publicCors, feedbackRoutes); // SDK público
app.use('/api/review', publicCors, reviewRoutes);  // Review Page (público, auth por token)
app.use('/api/demos', publicCors, demoRoutes); // Demo requests

// Activity Log
app.use('/api/activity', adminCors, activityRoutes);

// Health check mejorado con estado de BD
app.get('/api/health', async (req, res) => {
  const prisma = require('./prisma');
  let dbStatus = 'unknown';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (e) {
    dbStatus = 'disconnected';
  }
  
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  
  res.json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    version: '0.2.0',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heap: `${Math.round(memUsage.heapUsed / 1024 / 1024)}/${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    },
  });
});

// ==========================================
// MANEJO DE ERRORES GLOBAL
// ==========================================
app.use((err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, path: req.path, method: req.method });
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404
app.use((req, res) => {
  logger.warn(`Ruta no encontrada: ${req.method} ${req.path}`);
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

// ==========================================
// INICIO DEL SERVIDOR
// ==========================================
if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    logger.info('🚀 IMGC Feedback Backend iniciado', {
      api: `http://localhost:${PORT}/api`,
      health: `http://localhost:${PORT}/api/health`,
      env: process.env.NODE_ENV,
      version: 'v0.2.0',
    });
  });

  // Iniciar expirador de demos
  const { startDemoExpirator } = require('./cron/demoExpirator');
  startDemoExpirator();
}

module.exports = app;
