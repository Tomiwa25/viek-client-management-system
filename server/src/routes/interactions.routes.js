import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

export const interactionsRouter = Router();

interactionsRouter.use(requireAuth);

const interactionTypeEnum = z.enum(['CALL', 'EMAIL', 'MEETING', 'NOTE']);

const createInteractionSchema = z.object({
  clientId: z.string().uuid('Invalid client ID'),
  type: interactionTypeEnum,
  notes: z.string().trim().min(1, 'Interaction notes cannot be empty'),
  occurredAt: z.string().datetime().optional(),
});

/**
 * GET /api/v1/interactions
 * List interaction logs scoped to the organization and optionally filtered by client
 */
interactionsRouter.get('/', async (req, res, next) => {
  try {
    const { clientId, type, authorId, page = '1', limit = '50' } = req.query;

    const where = {
      organizationId: req.user.organizationId,
    };

    if (clientId && typeof clientId === 'string') {
      where.clientId = clientId;
    }

    if (type && typeof type === 'string') {
      where.type = type;
    }

    if (authorId && typeof authorId === 'string') {
      where.authorId = authorId;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [total, interactions] = await Promise.all([
      prisma.interaction.count({ where }),
      prisma.interaction.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { occurredAt: 'desc' },
        include: {
          author: { select: { id: true, fullName: true, email: true } },
          client: { select: { id: true, name: true, company: true } },
        },
      }),
    ]);

    res.json({
      interactions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/interactions
 * Log an activity under a client in this organization
 */
interactionsRouter.post('/', async (req, res, next) => {
  try {
    const data = createInteractionSchema.parse(req.body);

    const client = await prisma.client.findFirst({
      where: { id: data.clientId, organizationId: req.user.organizationId },
    });

    if (!client) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Client not found in this organization' } });
    }

    const interaction = await prisma.interaction.create({
      data: {
        organizationId: req.user.organizationId,
        clientId: data.clientId,
        authorId: req.user.id,
        type: data.type,
        notes: data.notes,
        occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
      },
      include: {
        author: { select: { id: true, fullName: true, email: true } },
        client: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({
      message: 'Interaction logged successfully',
      interaction,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: err.errors[0].message, details: err.errors },
      });
    }
    next(err);
  }
});

/**
 * DELETE /api/v1/interactions/:id
 * Delete interaction log
 */
interactionsRouter.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.interaction.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });

    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Interaction not found in this organization' } });
    }

    await prisma.interaction.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
