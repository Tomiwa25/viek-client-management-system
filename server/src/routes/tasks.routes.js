import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

export const tasksRouter = Router();

tasksRouter.use(requireAuth);

const taskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
const taskStatusEnum = z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

const createTaskSchema = z.object({
  title: z.string().trim().min(2, 'Task title must be at least 2 characters'),
  priority: taskPriorityEnum.optional().default('MEDIUM'),
  status: taskStatusEnum.optional().default('TODO'),
  dueAt: z.string().datetime().optional().nullable(),
  clientId: z.string().uuid('Invalid client ID').optional().nullable(),
  leadId: z.string().uuid('Invalid lead ID').optional().nullable(),
  assigneeId: z.string().uuid('Invalid assignee ID').optional().nullable(),
});

const updateTaskSchema = z.object({
  title: z.string().trim().min(2, 'Task title must be at least 2 characters').optional(),
  priority: taskPriorityEnum.optional(),
  status: taskStatusEnum.optional(),
  dueAt: z.string().datetime().optional().nullable(),
  clientId: z.string().uuid('Invalid client ID').optional().nullable(),
  leadId: z.string().uuid('Invalid lead ID').optional().nullable(),
  assigneeId: z.string().uuid('Invalid assignee ID').optional().nullable(),
});

/**
 * GET /api/v1/tasks
 * List tasks filtered by tenant, status, priority, or entity
 */
tasksRouter.get('/', async (req, res, next) => {
  try {
    const { status, priority, clientId, leadId, assigneeId, page = '1', limit = '50' } = req.query;

    const where = {
      organizationId: req.user.organizationId,
    };

    if (status && typeof status === 'string') {
      where.status = status;
    }

    if (priority && typeof priority === 'string') {
      where.priority = priority;
    }

    if (clientId && typeof clientId === 'string') {
      where.clientId = clientId;
    }

    if (leadId && typeof leadId === 'string') {
      where.leadId = leadId;
    }

    if (assigneeId && typeof assigneeId === 'string') {
      where.assigneeId = assigneeId;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
        include: {
          assignee: { select: { id: true, fullName: true, email: true } },
          client: { select: { id: true, name: true, company: true } },
          lead: { select: { id: true, name: true, stage: true } },
        },
      }),
    ]);

    res.json({
      tasks,
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
 * POST /api/v1/tasks
 * Create a task scoped to the organization
 */
tasksRouter.post('/', async (req, res, next) => {
  try {
    const data = createTaskSchema.parse(req.body);

    if (data.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: data.clientId, organizationId: req.user.organizationId },
      });
      if (!client) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Client not found in this organization' } });
      }
    }

    if (data.leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: data.leadId, organizationId: req.user.organizationId },
      });
      if (!lead) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lead not found in this organization' } });
      }
    }

    const task = await prisma.task.create({
      data: {
        organizationId: req.user.organizationId,
        title: data.title,
        priority: data.priority,
        status: data.status,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        clientId: data.clientId || null,
        leadId: data.leadId || null,
        assigneeId: data.assigneeId || req.user.id,
      },
      include: {
        assignee: { select: { id: true, fullName: true, email: true } },
        client: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({
      message: 'Task created successfully',
      task,
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
 * PATCH /api/v1/tasks/:id
 * Update task status, priority, or details
 */
tasksRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = updateTaskSchema.parse(req.body);

    const existingTask = await prisma.task.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });

    if (!existingTask) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found in this organization' } });
    }

    let completedAtUpdate = undefined;
    if (data.status) {
      if (data.status === 'COMPLETED' && existingTask.status !== 'COMPLETED') {
        completedAtUpdate = new Date();
      } else if (data.status !== 'COMPLETED' && existingTask.status === 'COMPLETED') {
        completedAtUpdate = null;
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(completedAtUpdate !== undefined ? { completedAt: completedAtUpdate } : {}),
        ...(data.dueAt !== undefined ? { dueAt: data.dueAt ? new Date(data.dueAt) : null } : {}),
        ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
        ...(data.clientId !== undefined ? { clientId: data.clientId } : {}),
        ...(data.leadId !== undefined ? { leadId: data.leadId } : {}),
      },
      include: {
        assignee: { select: { id: true, fullName: true, email: true } },
        client: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true } },
      },
    });

    res.json({
      message: 'Task updated successfully',
      task: updatedTask,
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
 * DELETE /api/v1/tasks/:id
 * Delete task from current organization
 */
tasksRouter.delete('/:id', async (req, res, next) => {
  try {
    const existingTask = await prisma.task.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });

    if (!existingTask) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found in this organization' } });
    }

    await prisma.task.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
