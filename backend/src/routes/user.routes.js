const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

const router = express.Router();

// Todas las rutas de usuarios requieren estar autenticadas y ser ADMIN
router.use(authenticate);
router.use(requireRole(['ADMIN']));

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  avatar: true,
};

const userWithPermissions = {
  ...userSelect,
  projectPermissions: {
    select: {
      projectId: true,
      project: {
        select: { id: true, name: true }
      }
    }
  }
};

// GET /api/users - Listar usuarios
router.get('/', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: userWithPermissions,
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// POST /api/users - Crear usuario
router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, role, projectIds } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'El email ya está registrado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'MEMBER',
        isActive: true,
        projectPermissions: projectIds && projectIds.length > 0 ? {
          create: projectIds.map(projectId => ({
            projectId,
            canView: true,
            canEdit: role === 'ADMIN' || role === 'MEMBER',
          }))
        } : undefined,
      },
      select: userWithPermissions,
    });

    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:id - Actualizar usuario
router.put('/:id', async (req, res, next) => {
  try {
    const { name, email, role, isActive, password, projectIds } = req.body;

    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (email !== undefined) dataToUpdate.email = email;
    if (role !== undefined) dataToUpdate.role = role;
    if (isActive !== undefined) dataToUpdate.isActive = isActive;
    if (password) {
      dataToUpdate.password = await bcrypt.hash(password, 10);
    }

    // If projectIds provided, sync permissions
    if (projectIds !== undefined) {
      // Delete all existing permissions for this user
      await prisma.userProjectPermission.deleteMany({
        where: { userId: req.params.id }
      });

      // Create new permissions
      if (projectIds.length > 0) {
        await prisma.userProjectPermission.createMany({
          data: projectIds.map(projectId => ({
            userId: req.params.id,
            projectId,
            canView: true,
            canEdit: role === 'ADMIN' || role === 'MEMBER',
          }))
        });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: dataToUpdate,
      select: userWithPermissions,
    });

    res.json(updatedUser);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado.' });
    if (err.code === 'P2002') return res.status(400).json({ error: 'El email ya está registrado por otro usuario.' });
    next(err);
  }
});

// DELETE /api/users/:id - Desactivar usuario
router.delete('/:id', async (req, res, next) => {
  try {
    const deletedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
      select: { id: true, email: true, isActive: true }
    });
    res.json({ message: 'Usuario desactivado.', user: deletedUser });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado.' });
    next(err);
  }
});

module.exports = router;
