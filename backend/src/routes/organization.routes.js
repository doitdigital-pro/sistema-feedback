const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware');
const { checkTenantAccess } = require('../middlewares/tenant.middleware');

// GET /api/organizations/plans - Listar todos los planes SaaS
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

// GET /api/organizations/my - Obtener detalles de la organización actual del usuario
router.get('/my', authenticate, checkTenantAccess, async (req, res) => {
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
          select: {
            users: true,
            projects: true
          }
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

// POST /api/organizations - Registrar nueva Organización / Empresa (Tenant)
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
        planId: freePlan ? freePlan.id : 'plan-free'
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
router.put('/my/plan', authenticate, checkTenantAccess, async (req, res) => {
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
