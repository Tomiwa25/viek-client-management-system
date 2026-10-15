import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

export const leadsRouter = Router();

leadsRouter.use(requireAuth);

const leadStageEnum = z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST']);

const createLeadSchema = z.object({
  name: z.string().trim().min(2, 'Lead name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address').toLowerCase().optional().or(z.literal('')),
  company: z.string().trim().optional().or(z.literal('')),
  stage: leadStageEnum.optional().default('NEW'),
  ownerId: z.string().uuid('Invalid owner ID').optional(),
});

const updateLeadSchema = z.object({
  name: z.string().trim().min(2, 'Lead name must be at least 2 characters').optional(),
  email: z.string().trim().email('Invalid email address').toLowerCase().optional().or(z.literal('')),
  company: z.string().trim().optional().or(z.literal('')),
  stage: leadStageEnum.optional(),
  ownerId: z.string().uuid('Invalid owner ID').nullable().optional(),
});

const convertLeadSchema = z.object({
  company: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

/**
 * GET /api/v1/leads
 * List leads scoped to the authenticated organization
 */
leadsRouter.get('/', async (req, res, next) => {
  try {
    const { stage, search, ownerId, page = '1', limit = '50' } = req.query;

    const where = {
      organizationId: req.user.organizationId,
    };

    if (stage && typeof stage === 'string') {
      where.stage = stage;
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

    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: {
            select: { id: true, fullName: true, email: true },
          },
          convertedClient: {
            select: { id: true, name: true, company: true },
          },
        },
      }),
    ]);

    res.json({
      leads,
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
 * POST /api/v1/leads
 * Create new lead in the current organization
 */
leadsRouter.post('/', async (req, res, next) => {
  try {
    const data = createLeadSchema.parse(req.body);

    const lead = await prisma.lead.create({
      data: {
        organizationId: req.user.organizationId,
        name: data.name,
        email: data.email || null,
        company: data.company || null,
        stage: data.stage,
        ownerId: data.ownerId || req.user.id,
      },
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
      },
    });

    res.status(201).json({
      message: 'Lead created successfully',
      lead,
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
 * GET /api/v1/leads/:id
 * Retrieve lead details with tasks and converted client info
 */
leadsRouter.get('/:id', async (req, res, next) => {
  try {
    const lead = await prisma.lead.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
      },
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
        convertedClient: { select: { id: true, name: true, email: true, company: true } },
        tasks: {
          orderBy: { createdAt: 'desc' },
          include: {
            assignee: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });

    if (!lead) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Lead not found in this organization' },
      });
    }

    res.json({ lead });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/leads/:id
 * Update lead information
 */
leadsRouter.patch('/:id', async (req, res, next) => {
  try {
    const data = updateLeadSchema.parse(req.body);

    const existingLead = await prisma.lead.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
      },
    });

    if (!existingLead) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Lead not found in this organization' },
      });
    }

    const updatedLead = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email || null } : {}),
        ...(data.company !== undefined ? { company: data.company || null } : {}),
        ...(data.stage !== undefined ? { stage: data.stage } : {}),
        ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
      },
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
        convertedClient: { select: { id: true, name: true } },
      },
    });

    res.json({
      message: 'Lead updated successfully',
      lead: updatedLead,
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
 * POST /api/v1/leads/:id/convert
 * Atomic transaction to convert a Lead into an active Client
 */
leadsRouter.post('/:id/convert', async (req, res, next) => {
  try {
    const body = convertLeadSchema.parse(req.body || {});

    const lead = await prisma.lead.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
      },
    });

    if (!lead) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Lead not found in this organization' },
      });
    }

    if (lead.convertedClientId) {
      return res.status(409).json({
        error: {
          code: 'ALREADY_CONVERTED',
          message: 'This lead has already been converted to an active client',
          convertedClientId: lead.convertedClientId,
        },
      });
    }

    const { client, updatedLead } = await prisma.$transaction(async (tx) => {
      // 1. Create the Client record
      const newClient = await tx.client.create({
        data: {
          organizationId: req.user.organizationId,
          ownerId: lead.ownerId || req.user.id,
          name: lead.name,
          email: lead.email || null,
          company: body.company || lead.company || null,
          phone: body.phone || null,
          status: 'active',
        },
      });

      // 2. Mark the Lead as WON and attach convertedClientId
      const modifiedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          stage: 'WON',
          convertedClientId: newClient.id,
        },
      });

      // 3. Migrate or associate open tasks to the new Client
      await tx.task.updateMany({
        where: {
          leadId: lead.id,
          organizationId: req.user.organizationId,
          clientId: null,
        },
        data: {
          clientId: newClient.id,
        },
      });

      // 4. Log an initial conversion interaction if notes are provided
      if (body.notes) {
        await tx.interaction.create({
          data: {
            organizationId: req.user.organizationId,
            clientId: newClient.id,
            authorId: req.user.id,
            type: 'NOTE',
            notes: `[Converted from Lead]: ${body.notes}`,
          },
        });
      }

      return { client: newClient, updatedLead: modifiedLead };
    });

    res.status(201).json({
      message: 'Lead converted to client successfully',
      client,
      lead: updatedLead,
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
 * DELETE /api/v1/leads/:id
 * Delete lead from current organization
 */
leadsRouter.delete('/:id', async (req, res, next) => {
  try {
    const lead = await prisma.lead.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.user.organizationId,
      },
    });

    if (!lead) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Lead not found in this organization' },
      });
    }

    await prisma.lead.delete({
      where: { id: req.params.id },
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
