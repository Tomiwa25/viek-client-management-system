import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

const createProjectSchema = z.object({
  name: z.string().trim().min(2, 'Project name must be at least 2 characters'),
  description: z.string().trim().optional().nullable(),
  clientId: z.string().uuid('Invalid client ID'),
  status: z.string().optional().default('active'),
});

const updateProjectSchema = z.object({
  name: z.string().trim().min(2, 'Project name must be at least 2 characters').optional(),
  description: z.string().trim().optional().nullable(),
  clientId: z.string().uuid('Invalid client ID').optional(),
  status: z.string().optional(),
});

/**
 * GET /api/v1/projects
 * Supports ?clientId=... to filter projects by client, with strict tenant isolation
 */
projectsRouter.get('/', async (req, res, next) => {
  try {
    const { clientId, search } = req.query;

    const where = {
      organizationId: req.user.organizationId,
    };

    if (clientId && typeof clientId === 'string' && clientId.trim() !== '') {
      where.clientId = clientId;
    }

    if (search && typeof search === 'string') {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true, company: true } },
      },
    });

    res.json({
      data: projects,
      projects, // provide both formats for seamless compatibility
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/projects
 * Create a new project linked to a client
 */
projectsRouter.post('/', async (req, res, next) => {
  try {
    const data = createProjectSchema.parse(req.body);

    const client = await prisma.client.findFirst({
      where: { id: data.clientId, organizationId: req.user.organizationId },
    });

    if (!client) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Client not found in this organization' } });
    }

    const project = await prisma.project.create({
      data: {
        organizationId: req.user.organizationId,
        clientId: data.clientId,
        name: data.name,
        description: data.description || null,
        status: data.status,
      },
      include: {
        client: { select: { id: true, name: true, company: true } },
      },
    });

    res.status(201).json({
      message: 'Project created successfully',
      data: project,
      project,
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
 * PATCH /api/v1/projects/:id
 * Update project details
 */
projectsRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = updateProjectSchema.parse(req.body);

    const existingProject = await prisma.project.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });

    if (!existingProject) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }

    if (data.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: data.clientId, organizationId: req.user.organizationId },
      });
      if (!client) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Target client not found' } });
      }
    }

    const updatedProject = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.clientId !== undefined ? { clientId: data.clientId } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: {
        client: { select: { id: true, name: true, company: true } },
      },
    });

    res.json({
      message: 'Project updated successfully',
      data: updatedProject,
      project: updatedProject,
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
 * DELETE /api/v1/projects/:id
 * Delete a project from current tenant organization
 */
projectsRouter.delete('/:id', async (req, res, next) => {
  try {
    const existingProject = await prisma.project.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });

    if (!existingProject) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }

    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    next(err);
  }
});
