const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/role.middleware');

const SUPER_ADMIN_ONLY = ['SUPER_ADMIN'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ORG_OWNER', 'ORG_ADMIN'];

// GET /api/organizations/plans - Listar todos los planes SaaS (público para registro)
router.get('/plans', async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { priceMonthly: 'asc' }
    });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener planes.' });
  }
});

// PUT /api/organizations/plans/:id - Editar un plan (solo SUPER_ADMIN)
router.put('/plans/:id', authenticate, requireRole(SUPER_ADMIN_ONLY), async (req, res) => {
  try {
    const { description, priceMonthly, maxProjects, maxSites, maxUsers } = req.body;
    const plan = await prisma.plan.update({
      where: { id: req.params.id },
      data: {
        ...(description !== undefined && { description }),
        ...(priceMonthly !== undefined && { priceMonthly: parseFloat(priceMonthly) }),
        ...(maxProjects !== undefined && { maxProjects: maxProjects !== null ? parseInt(maxProjects) : null }),
        ...(maxSites !== undefined && { maxSites: maxSites !== null ? parseInt(maxSites) : null }),
        ...(maxUsers !== undefined && { maxUsers: maxUsers !== null ? parseInt(maxUsers) : null }),
      }
    });
    res.json(plan);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Plan no encontrado.' });
    res.status(500).json({ error: 'Error al actualizar el plan.' });
  }
});

// GET /api/organizations/all - Listar TODAS las organizaciones (solo SUPER_ADMIN)
router.get('/all', authenticate, requireRole(SUPER_ADMIN_ONLY), async (req, res) => {
  try {
    const orgs = await prisma.organization.findMany({
      include: {
        plan: true,
        _count: {
          select: { users: true, projects: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orgs);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener organizaciones.' });
  }
});

// POST /api/organizations/admin - Crear nueva organización desde el panel Super Admin
router.post('/admin', authenticate, requireRole(SUPER_ADMIN_ONLY), async (req, res) => {
  try {
    const { name, slug, planId, maxProjects, maxSites, maxUsers } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Nombre y slug son requeridos.' });
    }

    const existingSlug = await prisma.organization.findUnique({ where: { slug } });
    if (existingSlug) {
      return res.status(400).json({ error: 'El slug de la organización ya existe.' });
    }

    // Si no se provee planId, usar FREE por defecto
    let resolvedPlanId = planId;
    if (!resolvedPlanId) {
      const freePlan = await prisma.plan.findUnique({ where: { name: 'FREE' } });
      resolvedPlanId = freePlan?.id || null;
    }

    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        planId: resolvedPlanId,
        ...(maxProjects != null && maxProjects !== '' && { maxProjects: parseInt(maxProjects) }),
        ...(maxSites != null && maxSites !== '' && { maxSites: parseInt(maxSites) }),
        ...(maxUsers != null && maxUsers !== '' && { maxUsers: parseInt(maxUsers) }),
      },
      include: { plan: true }
    });

    res.status(201).json(organization);
  } catch (error) {
    console.error('Error al crear organización:', error);
    res.status(500).json({ error: 'Error al crear la organización.' });
  }
});

// PUT /api/organizations/:id - Editar organización (solo SUPER_ADMIN)
router.put('/:id', authenticate, requireRole(SUPER_ADMIN_ONLY), async (req, res) => {
  try {
    const { name, planId, maxProjects, maxSites, maxUsers } = req.body;

    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (planId !== undefined) dataToUpdate.planId = planId || null;
    if (maxProjects !== undefined) dataToUpdate.maxProjects = (maxProjects !== '' && maxProjects !== null) ? parseInt(maxProjects) : null;
    if (maxSites !== undefined) dataToUpdate.maxSites = (maxSites !== '' && maxSites !== null) ? parseInt(maxSites) : null;
    if (maxUsers !== undefined) dataToUpdate.maxUsers = (maxUsers !== '' && maxUsers !== null) ? parseInt(maxUsers) : null;

    const updated = await prisma.organization.update({
      where: { id: req.params.id },
      data: dataToUpdate,
      include: { plan: true, _count: { select: { users: true, projects: true } } }
    });
    res.json(updated);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Organización no encontrada.' });
    res.status(500).json({ error: 'Error al actualizar la organización.' });
  }
});

// GET /api/organizations/my - Obtener detalles de la organización actual del usuario
router.get('/my', authenticate, async (req, res) => {
  try {
    if (!req.user.organizationId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(404).json({ error: 'Usuario no tiene organización asignada.' });
    }

    const orgId = req.user.organizationId;
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        plan: true,
        _count: {
          select: { users: true, projects: true }
        }
      }
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organización no encontrada.' });
    }

    res.json(organization);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la organización.' });
  }
});

// POST /api/organizations - Registrar nueva Organización / Empresa (Tenant) por el usuario mismo
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, slug } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Nombre y slug son requeridos.' });
    }

    const existingSlug = await prisma.organization.findUnique({ where: { slug } });
    if (existingSlug) {
      return res.status(400).json({ error: 'El slug de la organización ya existe.' });
    }

    // Buscar plan FREE por defecto
    const freePlan = await prisma.plan.findUnique({ where: { name: 'FREE' } });

    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        planId: freePlan ? freePlan.id : null
      },
      include: { plan: true }
    });

    // Asignar al usuario como ORG_OWNER
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        organizationId: organization.id,
        role: 'ORG_OWNER'
      }
    });

    res.status(201).json(organization);
  } catch (error) {
    console.error('Error al crear organización:', error);
    res.status(500).json({ error: 'Error al crear la organización.' });
  }
});

// PUT /api/organizations/my/plan - Cambiar plan de suscripción
router.put('/my/plan', authenticate, async (req, res) => {
  try {
    const { planId } = req.body;
    const allowedRoles = ['SUPER_ADMIN', 'ORG_OWNER'];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Solo el dueño de la organización puede cambiar el plan.' });
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return res.status(404).json({ error: 'Plan no encontrado.' });
    }

    const updatedOrg = await prisma.organization.update({
      where: { id: req.user.organizationId },
      data: { planId: plan.id },
      include: { plan: true }
    });

    res.json(updatedOrg);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el plan.' });
  }
});

module.exports = router;
