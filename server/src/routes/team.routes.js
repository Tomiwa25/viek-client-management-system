import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { generateInvitationToken, hashToken } from '../lib/crypto.js';
import { emailService } from '../services/email.service.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { loadEnv } from '../config/env.js';

const env = loadEnv();
export const teamRouter = Router();

// Require authenticated user for all team management endpoints
teamRouter.use(requireAuth);

const inviteMemberSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF']).default('STAFF'),
});

const changeRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF']),
});

const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  reason: z.string().trim().max(500).optional(),
});

/**
 * GET /api/v1/team/members
 * List all members in the current user's organization.
 * Access: ADMIN, MANAGER
 */
teamRouter.get('/members', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const members = await prisma.user.findMany({
      where: { organizationId: req.user.organizationId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { role: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({ members });
  } catch (err) {
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch team members' },
    });
  }
});

/**
 * GET /api/v1/team/invitations
 * List all active/pending invitations for the organization.
 * Access: ADMIN, MANAGER
 */
teamRouter.get('/invitations', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const invitations = await prisma.invitation.findMany({
      where: {
        organizationId: req.user.organizationId,
        status: 'PENDING',
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        reminderSentAt: true,
        createdAt: true,
        invitedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ invitations });
  } catch (err) {
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch team invitations' },
    });
  }
});

/**
 * POST /api/v1/team/invitations
 * Issue a new team invitation with 7-day expiration.
 * Access: ADMIN only
 */
teamRouter.post('/invitations', requireRole('ADMIN'), async (req, res) => {
  try {
    const parseResult = inviteMemberSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues[0].message },
      });
    }

    const { email, role } = parseResult.data;

    // Check if user is already an active member in this organization
    const existingMember = await prisma.user.findFirst({
      where: {
        organizationId: req.user.organizationId,
        email,
      },
    });

    if (existingMember) {
      return res.status(409).json({
        error: { code: 'ALREADY_MEMBER', message: 'User is already a member of this organization.' },
      });
    }

    // Check for an existing pending invitation
    const existingInvite = await prisma.invitation.findFirst({
      where: {
        organizationId: req.user.organizationId,
        email,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      return res.status(409).json({
        error: {
          code: 'INVITATION_ALREADY_EXISTS',
          message: 'An active invitation has already been sent to this email address.',
        },
      });
    }

    // Generate token and 7-day expiration
    const rawToken = generateInvitationToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [organization, inviter, invitation] = await prisma.$transaction([
      prisma.organization.findUnique({
        where: { id: req.user.organizationId },
        select: { name: true },
      }),
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { fullName: true, email: true },
      }),
      prisma.invitation.create({
        data: {
          organizationId: req.user.organizationId,
          email,
          role,
          tokenHash,
          invitedById: req.user.id,
          expiresAt,
        },
      }),
    ]);

    const inviteUrl = `${env.CLIENT_URL || 'http://localhost:5173'}/accept-invite?token=${rawToken}`;

    // Send HTML email
    await emailService.sendTeamInvitationEmail({
      email,
      organizationName: organization.name,
      role,
      inviterName: inviter.fullName || inviter.email,
      inviteUrl,
      expiresAt,
    });

    res.status(201).json({
      message: `Invitation successfully sent to ${email}.`,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Failed to send team invitation' },
    });
  }
});

/**
 * POST /api/v1/team/invitations/:id/resend
 * Resend invitation email and refresh 7-day expiration.
 * Access: ADMIN only
 */
teamRouter.post('/invitations/:id/resend', requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const invitation = await prisma.invitation.findFirst({
      where: {
        id,
        organizationId: req.user.organizationId,
        status: 'PENDING',
      },
      include: {
        organization: { select: { name: true } },
        invitedBy: { select: { fullName: true, email: true } },
      },
    });

    if (!invitation) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Active invitation not found.' },
      });
    }

    const rawToken = generateInvitationToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updated = await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        tokenHash,
        expiresAt,
        reminderSentAt: null,
      },
    });

    const inviteUrl = `${env.CLIENT_URL || 'http://localhost:5173'}/accept-invite?token=${rawToken}`;

    await emailService.sendTeamInvitationEmail({
      email: invitation.email,
      organizationName: invitation.organization.name,
      role: invitation.role,
      inviterName: invitation.invitedBy?.fullName || invitation.invitedBy?.email,
      inviteUrl,
      expiresAt,
    });

    res.json({
      message: 'Invitation resent successfully.',
      invitation: updated,
    });
  } catch (err) {
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Failed to resend invitation' },
    });
  }
});

/**
 * POST /api/v1/team/invitations/:id/reminder
 * Send 6th-day / expiring soon reminder email.
 * Access: ADMIN only
 */
teamRouter.post('/invitations/:id/reminder', requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const invitation = await prisma.invitation.findFirst({
      where: {
        id,
        organizationId: req.user.organizationId,
        status: 'PENDING',
      },
      include: {
        organization: { select: { name: true } },
      },
    });

    if (!invitation) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Active invitation not found.' },
      });
    }

    if (new Date(invitation.expiresAt) <= new Date()) {
      return res.status(400).json({
        error: { code: 'INVITATION_EXPIRED', message: 'This invitation has already expired.' },
      });
    }

    // Refresh token so user has valid acceptance link in reminder
    const rawToken = generateInvitationToken();
    const tokenHash = hashToken(rawToken);

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        tokenHash,
        reminderSentAt: new Date(),
      },
    });

    const inviteUrl = `${env.CLIENT_URL || 'http://localhost:5173'}/accept-invite?token=${rawToken}`;
    const hoursLeft = Math.max(1, Math.round((new Date(invitation.expiresAt) - new Date()) / (1000 * 60 * 60)));

    await emailService.sendInvitationReminderEmail({
      email: invitation.email,
      organizationName: invitation.organization.name,
      role: invitation.role,
      inviteUrl,
      hoursLeft,
    });

    res.json({
      message: 'Reminder email sent successfully.',
    });
  } catch (err) {
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Failed to send invitation reminder' },
    });
  }
});

/**
 * DELETE /api/v1/team/invitations/:id
 * Revoke a pending invitation.
 * Access: ADMIN only
 */
teamRouter.delete('/invitations/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const invitation = await prisma.invitation.findFirst({
      where: {
        id,
        organizationId: req.user.organizationId,
        status: 'PENDING',
      },
    });

    if (!invitation) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Active invitation not found.' },
      });
    }

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'REVOKED' },
    });

    res.json({ message: 'Invitation revoked successfully.' });
  } catch (err) {
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Failed to revoke invitation' },
    });
  }
});

/**
 * PATCH /api/v1/team/members/:id/role
 * Change a team member's role (ADMIN, MANAGER, STAFF).
 * Access: ADMIN only
 */
teamRouter.patch('/members/:id/role', requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const parseResult = changeRoleSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues[0].message },
      });
    }

    const { role: newRole } = parseResult.data;

    const targetUser = await prisma.user.findFirst({
      where: {
        id,
        organizationId: req.user.organizationId,
      },
      include: {
        organization: { select: { name: true } },
      },
    });

    if (!targetUser) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Team member not found.' },
      });
    }

    // Protection: Prevent demoting the only admin
    if (targetUser.role === 'ADMIN' && newRole !== 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: {
          organizationId: req.user.organizationId,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });

      if (adminCount <= 1) {
        return res.status(400).json({
          error: {
            code: 'CANNOT_REMOVE_LAST_ADMIN',
            message: 'Cannot demote the only active Administrator in the organization.',
          },
        });
      }
    }

    const oldRole = targetUser.role;
    const updated = await prisma.user.update({
      where: { id: targetUser.id },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    // Notify user of role update via HTML email
    await emailService.sendRoleChangeEmail({
      email: targetUser.email,
      fullName: targetUser.fullName,
      organizationName: targetUser.organization.name,
      oldRole,
      newRole,
    });

    res.json({
      message: `Role updated to ${newRole}.`,
      member: updated,
    });
  } catch (err) {
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Failed to update member role' },
    });
  }
});

/**
 * PATCH /api/v1/team/members/:id/status
 * Deactivate or Reactivate a member (SUSPENDED vs ACTIVE).
 * Access: ADMIN only
 */
teamRouter.patch('/members/:id/status', requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const parseResult = updateStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues[0].message },
      });
    }

    const { status: newStatus, reason } = parseResult.data;

    // Protection: Cannot deactivate self
    if (id === req.user.id) {
      return res.status(400).json({
        error: { code: 'CANNOT_MODIFY_SELF', message: 'You cannot deactivate your own account.' },
      });
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        id,
        organizationId: req.user.organizationId,
      },
      include: {
        organization: { select: { name: true } },
      },
    });

    if (!targetUser) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Team member not found.' },
      });
    }

    // Protection: Cannot deactivate last active admin
    if (targetUser.role === 'ADMIN' && newStatus === 'SUSPENDED') {
      const activeAdminCount = await prisma.user.count({
        where: {
          organizationId: req.user.organizationId,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });

      if (activeAdminCount <= 1) {
        return res.status(400).json({
          error: {
            code: 'CANNOT_SUSPEND_LAST_ADMIN',
            message: 'Cannot deactivate the only active Administrator in the organization.',
          },
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id: targetUser.id },
      data: { status: newStatus },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    // Send notification email
    await emailService.sendStatusChangeEmail({
      email: targetUser.email,
      fullName: targetUser.fullName,
      organizationName: targetUser.organization.name,
      status: newStatus,
      reason,
    });

    res.json({
      message: `Account status set to ${newStatus}.`,
      member: updated,
    });
  } catch (err) {
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Failed to update member status' },
    });
  }
});

/**
 * POST /api/v1/team/invitations/process-reminders
 * Automated check: find pending invites expiring within 24 hours without reminder sent.
 */
teamRouter.post('/invitations/process-reminders', requireRole('ADMIN'), async (req, res) => {
  try {
    const oneDayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const now = new Date();

    const pendingExpiring = await prisma.invitation.findMany({
      where: {
        organizationId: req.user.organizationId,
        status: 'PENDING',
        expiresAt: {
          gt: now,
          lte: oneDayFromNow,
        },
        reminderSentAt: null,
      },
      include: {
        organization: { select: { name: true } },
      },
    });

    let processedCount = 0;
    for (const invite of pendingExpiring) {
      const rawToken = generateInvitationToken();
      const tokenHash = hashToken(rawToken);

      await prisma.invitation.update({
        where: { id: invite.id },
        data: {
          tokenHash,
          reminderSentAt: now,
        },
      });

      const inviteUrl = `${env.CLIENT_URL || 'http://localhost:5173'}/accept-invite?token=${rawToken}`;
      const hoursLeft = Math.max(1, Math.round((new Date(invite.expiresAt) - now) / (1000 * 60 * 60)));

      await emailService.sendInvitationReminderEmail({
        email: invite.email,
        organizationName: invite.organization.name,
        role: invite.role,
        inviteUrl,
        hoursLeft,
      });

      processedCount++;
    }

    res.json({
      message: `Processed ${processedCount} invitation reminder(s).`,
      processedCount,
    });
  } catch (err) {
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Failed to process reminders' },
    });
  }
});
