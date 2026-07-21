/**
 * Rutas para gestión de Tags / Etiquetas de Tickets
 */
const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);

// GET /api/tags — Listar todas las etiquetas del sistema
router.get('/', async (req, res, next) => {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(tags);
  } catch (err) {
    next(err);
  }
});

// POST /api/tags — Crear una nueva etiqueta
router.post('/', async (req, res, next) => {
  try {
    const { name, color } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'El nombre de la etiqueta es requerido.' });
    }

    const tag = await prisma.tag.upsert({
      where: { name: name.trim() },
      update: { color: color || '#6366f1' },
      create: {
        name: name.trim(),
        color: color || '#6366f1',
      },
    });

    res.status(201).json(tag);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tags/:id — Eliminar una etiqueta
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.tag.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Etiqueta eliminada correctamente.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/tickets/:id/tags — Asignar etiqueta a un ticket
router.post('/tickets/:ticketId', async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { tagId, name, color } = req.body;

    let targetTagId = tagId;

    // Si viene un nombre nuevo en lugar de tagId existente, creamos/buscamos la etiqueta
    if (!targetTagId && name) {
      const tag = await prisma.tag.upsert({
        where: { name: name.trim() },
        update: {},
        create: {
          name: name.trim(),
          color: color || '#6366f1',
        },
      });
      targetTagId = tag.id;
    }

    if (!targetTagId) {
      return res.status(400).json({ error: 'Debes proporcionar tagId o un nombre de etiqueta.' });
    }

    // Asociar al ticket (upsert para evitar duplicados)
    const ticketTag = await prisma.ticketTag.upsert({
      where: {
        ticketId_tagId: {
          ticketId,
          tagId: targetTagId,
        },
      },
      update: {},
      create: {
        ticketId,
        tagId: targetTagId,
      },
      include: {
        tag: true,
      },
    });

    res.status(201).json(ticketTag);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tickets/:ticketId/tags/:tagId — Quitar etiqueta de un ticket
router.delete('/tickets/:ticketId/tags/:tagId', async (req, res, next) => {
  try {
    const { ticketId, tagId } = req.params;

    await prisma.ticketTag.delete({
      where: {
        ticketId_tagId: {
          ticketId,
          tagId,
        },
      },
    });

    res.json({ message: 'Etiqueta removida del ticket.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
