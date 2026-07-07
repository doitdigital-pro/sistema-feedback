const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');
const bcrypt = require('bcryptjs');

// Helper to check if system is already installed
async function isInstalled() {
  const envPath = path.join(__dirname, '../../.env');
  if (!fs.existsSync(envPath)) return false;
  if (!process.env.DATABASE_URL) return false;
  
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    await prisma.$disconnect();
    return adminCount > 0;
  } catch (e) {
    return false;
  }
}

// GET /api/install/check-requirements — Validates server environment before install
router.get('/api/install/check-requirements', async (req, res) => {
  const checks = [];

  // 1. Node.js version >= 18
  const nodeVersion = process.version; // e.g. "v20.11.0"
  const major = parseInt(nodeVersion.replace('v', '').split('.')[0], 10);
  checks.push({
    id: 'node_version',
    label: `Node.js (v${major} detectado)`,
    ok: major >= 18,
    detail: major >= 18
      ? `Versión ${nodeVersion} cumple con el requisito mínimo (v18+).`
      : `Se requiere Node.js v18 o superior. Versión actual: ${nodeVersion}.`
  });

  // 2. Write permissions for .env file (backend root)
  const envDir = path.join(__dirname, '../..');
  let envWritable = false;
  try {
    fs.accessSync(envDir, fs.constants.W_OK);
    envWritable = true;
  } catch (_) { /* not writable */ }
  checks.push({
    id: 'env_write',
    label: 'Permisos de escritura (.env)',
    ok: envWritable,
    detail: envWritable
      ? 'El directorio raíz del backend tiene permisos de escritura.'
      : `Sin permisos de escritura en ${envDir}. Ejecuta: chmod 755 ${envDir}`
  });

  // 3. Write permissions for uploads directory
  const uploadsDir = path.join(__dirname, '../../uploads');
  let uploadsWritable = false;
  try {
    // Create uploads dir if it doesn't exist yet
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    fs.accessSync(uploadsDir, fs.constants.W_OK);
    uploadsWritable = true;
  } catch (_) { /* not writable */ }
  checks.push({
    id: 'uploads_write',
    label: 'Permisos de escritura (uploads/)',
    ok: uploadsWritable,
    detail: uploadsWritable
      ? 'La carpeta de subidas tiene permisos de escritura.'
      : `Sin permisos de escritura en ${uploadsDir}. Ejecuta: chmod 755 ${uploadsDir}`
  });

  // 4. npx availability
  const npxAvailable = await new Promise((resolve) => {
    exec('npx --version', { timeout: 10000 }, (err) => {
      resolve(!err);
    });
  });
  checks.push({
    id: 'npx',
    label: 'NPX disponible',
    ok: npxAvailable,
    detail: npxAvailable
      ? 'npx está disponible en el sistema.'
      : 'npx no fue encontrado. Asegúrate de que Node.js y npm estén instalados correctamente.'
  });

  const allPassed = checks.every((c) => c.ok);

  res.json({ allPassed, checks });
});

// GET /install — Serves the HTML installer page
router.get('/install', async (req, res, next) => {
  try {
    if (await isInstalled()) {
      return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, '../public/installer.html'));
  } catch (err) {
    next(err);
  }
});

// POST /api/install/test-db — Tests PostgreSQL credentials
router.post('/api/install/test-db', async (req, res) => {
  try {
    if (await isInstalled()) {
      return res.status(400).json({ error: 'El sistema ya está instalado.' });
    }
    
    const { host, port, user, pass, name } = req.body;
    const connectionString = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${name}?schema=public`;
    
    const { PrismaClient } = require('@prisma/client');
    const testPrisma = new PrismaClient({
      datasources: {
        db: { url: connectionString }
      }
    });
    
    await testPrisma.$connect();
    await testPrisma.$queryRaw`SELECT 1`;
    await testPrisma.$disconnect();
    
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/install — Runs the installation steps (streaming status logs)
router.post('/api/install', async (req, res) => {
  try {
    if (await isInstalled()) {
      return res.status(400).json({ error: 'El sistema ya está instalado.' });
    }
    
    const { db, admin } = req.body;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    function sendStatus(message, progress, error = false, info = false) {
      res.write(JSON.stringify({ type: 'status', message, progress, error, info }) + '\n');
    }
    
    // Paso 1: Escribir el archivo .env
    sendStatus('Generando archivo de configuración .env...', 20);
    const envPath = path.join(__dirname, '../../.env');
    const connectionString = `postgresql://${encodeURIComponent(db.user)}:${encodeURIComponent(db.pass)}@${db.host}:${db.port}/${db.name}?schema=public`;
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    
    const envContent = `# Base de datos
DATABASE_URL="${connectionString}"

# JWT
JWT_SECRET="${jwtSecret}"
JWT_EXPIRES_IN="7d"

# Servidor
PORT=3001
NODE_ENV=development

# CORS
FRONTEND_URL="http://localhost:5173"

# Archivos
UPLOAD_DIR="./uploads"

# SDK
SDK_BASE_URL="http://localhost:3001"

# Gemini API Key
GEMINI_API_KEY="${admin.geminiKey || ''}"
`;
    
    fs.writeFileSync(envPath, envContent);
    process.env.DATABASE_URL = connectionString;
    sendStatus('Archivo .env creado con éxito.', 40);
    
    // Paso 2: Ejecutar prisma db push
    sendStatus('Aplicando esquema de base de datos y creando tablas (Prisma db push)...', 60);
    
    exec('npx prisma db push', { cwd: path.join(__dirname, '../..') }, async (err, stdout, stderr) => {
      if (err) {
        console.error('Prisma push error:', stderr || err.message);
        sendStatus(`Error de migración: ${stderr || err.message}`, 60, true);
        return res.end();
      }
      
      sendStatus('Base de datos y tablas creadas correctamente.', 80);
      
      // Paso 3: Crear administrador
      sendStatus('Creando cuenta de administrador en la base de datos...', 90);
      try {
        const hashedPassword = await bcrypt.hash(admin.pass, 10);
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        await prisma.user.create({
          data: {
            name: admin.name,
            email: admin.email,
            password: hashedPassword,
            role: 'ADMIN',
            isActive: true
          }
        });
        
        sendStatus('Administrador creado con éxito.', 95);
        sendStatus('¡Instalación finalizada! Reiniciando el servidor para aplicar las variables de entorno...', 100, false, true);
        res.end();
        
        // Forzar reinicio del servidor
        setTimeout(() => {
          process.exit(0);
        }, 1500);
        
      } catch (dbErr) {
        console.error('Db admin user creation error:', dbErr.message);
        sendStatus(`Error al crear usuario administrador: ${dbErr.message}`, 90, true);
        res.end();
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
