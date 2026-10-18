import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

export const clientsRouter = Router();

clientsRouter.use(requireAuth);

const createClientSchema = z.object({
  name: z.string().trim().min(2, 'Client name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address').toLowerCase().optional().or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
  company: z.string().trim().optional().or(z.literal('')),
  status: z.string().trim().default('active'),
  ownerId: z.string().uuid('Invalid owner ID').optional(),
});

const updateClientSchema = z.object({
  name: z.string().trim().min(2, 'Client name must be at least 2 characters').optional(),
  email: z.string().trim().email('Invalid email address').toLowerCase().optional().or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
  company: z.string().trim().optional().or(z.literal('')),
  status: z.string().trim().optional(),
  ownerId: z.string().uuid('Invalid owner ID').nullable().optional(),
});

/**
 * GET /api/v1/clients
 * List clients scoped to the authenticated organization
 */
clientsRouter.get('/', async (req, res, next) => {
  try {
    const { status, search, ownerId, includeArchived, page = '1', limit = '50' } = req.query;

    const where = {
      organizationId: req.user.organizationId,
    };

    if (includeArchived !== 'true') {
      where.archivedAt = null;
    }

    if (status && typeof status === 'string') {
      where.status = status;
    }

    if (ownerId && typeof ownerId === 'string') {
      where.ownerId = ownerId;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [total, clients] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: {
            select: { id: true, fullName: true, email: true },
          },
          _count: {
            select: { tasks: true, interactions: true },
          },
        },
      }),
    ]);

    res.json({
      data: clients,
      clients,
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
 * POST /api/v1/clients
 * Create a new client record
 */
clientsRouter.post('/', async (req, res, next) => {
  try {
    const data = createClientSchema.parse(req.body);

    const client = await prisma.client.create({
      data: {
        organizationId: req.user.organizationId,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        company: data.company || null,
        status: data.status,
        ownerId: data.ownerId || req.user.id,
      },
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
      },
    });

    res.status(201).json({
      message: 'Client created successfully',
      client,
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
 * GET /api/v1/clients/:id
 * Retrieve client profile, owner, tasks, and interaction history
 */
clientsRouter.get('/:id', async (req, res, next) => {
  try {
    const client = await prisma.client.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
      },
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
        convertedFrom: { select: { id: true, stage: true, createdAt: true } },
        tasks: {
          orderBy: { createdAt: 'desc' },
          include: {
            assignee: { select: { id: true, fullName: true, email: true } },
          },
        },
        interactions: {
          orderBy: { occurredAt: 'desc' },
          include: {
            author: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });

    if (!client) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Client not found in this organization' },
      });
    }

    res.json({ client });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/clients/:id
 * Update client details
 */
clientsRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = updateClientSchema.parse(req.body);

    const existingClient = await prisma.client.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
      },
    });

    if (!existingClient) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Client not found in this organization' },
      });
    }

    const updatedClient = await prisma.client.update({
      where: { id: req.params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
        ...(data.company !== undefined ? { company: data.company || null } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
      },
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
      },
    });

    res.json({
      message: 'Client updated successfully',
      client: updatedClient,
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
 * DELETE /api/v1/clients/:id
 * Archive (soft-delete) or permanently delete client record
 */
clientsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { permanent } = req.query;

    const existingClient = await prisma.client.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
      },
    });

    if (!existingClient) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Client not found in this organization' },
      });
    }

    if (permanent === 'true') {
      await prisma.client.delete({ where: { id: req.params.id } });
    } else {
      await prisma.client.update({
        where: { id: req.params.id },
        data: { archivedAt: new Date(), status: 'archived' },
      });
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
