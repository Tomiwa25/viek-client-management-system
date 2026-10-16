import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword, generateOtp, hashToken } from '../lib/crypto.js';
import { signAccessToken } from '../lib/jwt.js';
import { emailService } from '../services/email.service.js';
import { requireAuth } from '../middleware/auth.js';
import { loadEnv } from '../config/env.js';

const env = loadEnv();
export const authRouter = Router();

const registerSchema = z.object({
  organizationName: z.string().trim().min(2, 'Organization name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').optional(),
});

const verifyEmailSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  otp: z.string().trim().length(6, 'OTP must be exactly 6 digits'),
});

const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

const resendOtpSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
});

const verifyResetCodeSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  otp: z.string().trim().min(6, 'Reset code must be at least 6 characters'),
});

const resetPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  otp: z.string().trim().min(6, 'Reset code must be at least 6 characters'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * Generate URL-friendly unique slug from organization name
 */
function slugify(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const randomSuffix = crypto.randomBytes(3).toString('hex');
  return `${base || 'org'}-${randomSuffix}`;
}

/**
 * Helper to set secure refresh cookie
 */
function setRefreshCookie(res, token, rememberMe) {
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 30 days vs 24h
  res.cookie('clientflow_refresh', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/api/v1/auth',
  });
}

/**
 * POST /api/v1/auth/register
 * Register organization and initial admin user, send 6-digit OTP verification email
 */
authRouter.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return res.status(409).json({
        error: { code: 'EMAIL_EXISTS', message: 'An account with this email address already exists.' },
      });
    }

    const passwordHash = await hashPassword(data.password);
    const slug = slugify(data.organizationName);
    const otp = generateOtp();
    const tokenHash = hashToken(otp);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    const { user, organization } = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: data.organizationName,
          slug,
        },
      });

      const newUser = await tx.user.create({
        data: {
          organizationId: org.id,
          email: data.email,
          fullName: data.fullName,
          passwordHash,
          role: 'ADMIN',
          status: 'PENDING_VERIFICATION',
        },
      });

      await tx.verificationToken.create({
        data: {
          userId: newUser.id,
          tokenHash,
          type: 'EMAIL_VERIFICATION',
          expiresAt,
        },
      });

      return { user: newUser, organization: org };
    });

    const verifyUrl = `${env.FRONTEND_ORIGIN}/verify-email?email=${encodeURIComponent(user.email)}&otp=${otp}`;

    await emailService.sendVerificationEmail({
      email: user.email,
      fullName: user.fullName,
      otp,
      verifyUrl,
    });

    return res.status(201).json({
      message: 'Organization created successfully. Please check your email for the verification code.',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      expiresIn: 900,
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
 * POST /api/v1/auth/verify-email
 * Validate 6-digit OTP code and activate user account
 */
authRouter.post('/verify-email', async (req, res, next) => {
  try {
    const { email, otp } = verifyEmailSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        verificationTokens: {
          where: { type: 'EMAIL_VERIFICATION' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'User account not found.' },
      });
    }

    if (user.status === 'ACTIVE') {
      return res.status(200).json({
        message: 'Account is already verified. You can proceed to log in.',
      });
    }

    const tokenRecord = user.verificationTokens[0];
    if (!tokenRecord) {
      return res.status(400).json({
        error: { code: 'TOKEN_NOT_FOUND', message: 'No pending verification token found. Please request a new code.' },
      });
    }

    if (tokenRecord.attempts >= 5) {
      return res.status(429).json({
        error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many incorrect attempts. Please request a new verification code.' },
      });
    }

    if (new Date() > tokenRecord.expiresAt) {
      return res.status(410).json({
        error: { code: 'TOKEN_EXPIRED', message: 'Verification code has expired. Please request a new code.' },
      });
    }

    const candidateHash = hashToken(otp);
    if (candidateHash !== tokenRecord.tokenHash) {
      await prisma.verificationToken.update({
        where: { id: tokenRecord.id },
        data: { attempts: { increment: 1 } },
      });
      return res.status(400).json({
        error: { code: 'INVALID_CODE', message: 'Invalid verification code. Please check and try again.' },
      });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE' },
      }),
      prisma.verificationToken.delete({
        where: { id: tokenRecord.id },
      }),
    ]);

    return res.status(200).json({
      message: 'Email verified successfully! You can now log in.',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: err.errors[0].message },
      });
    }
    next(err);
  }
});

/**
 * POST /api/v1/auth/resend-otp
 */
authRouter.post('/resend-otp', async (req, res, next) => {
  try {
    const { email } = resendOtpSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'User account not found.' },
      });
    }

    if (user.status === 'ACTIVE') {
      return res.status(400).json({
        error: { code: 'ALREADY_ACTIVE', message: 'Account is already verified and active.' },
      });
    }

    const otp = generateOtp();
    const tokenHash = hashToken(otp);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.$transaction([
      prisma.verificationToken.deleteMany({
        where: { userId: user.id, type: 'EMAIL_VERIFICATION' },
      }),
      prisma.verificationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          type: 'EMAIL_VERIFICATION',
          expiresAt,
        },
      }),
    ]);

    const verifyUrl = `${env.FRONTEND_ORIGIN}/verify-email?email=${encodeURIComponent(user.email)}&otp=${otp}`;

    await emailService.sendVerificationEmail({
      email: user.email,
      fullName: user.fullName,
      otp,
      verifyUrl,
    });

    return res.status(200).json({
      message: 'A fresh verification code has been dispatched.',
      expiresIn: 900,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: err.errors[0].message },
      });
    }
    next(err);
  }
});

/**
 * POST /api/v1/auth/login
 * Authenticates user, checks ACTIVE status, issues access token + refresh cookie
 */
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password, rememberMe } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (!user) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
    }

    if (user.status === 'PENDING_VERIFICATION') {
      return res.status(403).json({
        error: {
          code: 'VERIFICATION_REQUIRED',
          message: 'Please verify your email address with the 6-digit code before logging in.',
        },
      });
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({
        error: { code: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended. Please contact support.' },
      });
    }

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = hashToken(rawRefreshToken);
    const sessionDays = rememberMe ? 30 : 1;
    const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        rememberMe,
        expiresAt,
      },
    });

    const accessToken = signAccessToken(user);
    setRefreshCookie(res, rawRefreshToken, rememberMe);

    return res.status(200).json({
      message: 'Login successful',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug,
        },
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: err.errors[0].message },
      });
    }
    next(err);
  }
});

/**
 * POST /api/v1/auth/refresh
 * Rotate refresh token and return new access token
 */
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.clientflow_refresh;
    if (!rawRefreshToken) {
      return res.status(401).json({
        error: { code: 'REFRESH_TOKEN_REQUIRED', message: 'No active session found.' },
      });
    }

    const refreshTokenHash = hashToken(rawRefreshToken);

    const session = await prisma.session.findFirst({
      where: {
        refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { include: { organization: true } },
      },
    });

    if (!session || session.user.status !== 'ACTIVE') {
      res.clearCookie('clientflow_refresh', { path: '/api/v1/auth' });
      return res.status(401).json({
        error: { code: 'INVALID_SESSION', message: 'Session is invalid or expired. Please log in again.' },
      });
    }

    // Refresh token rotation: revoke old, create new
    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newRefreshTokenHash = hashToken(newRawRefreshToken);

    await prisma.$transaction([
      prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      }),
      prisma.session.create({
        data: {
          userId: session.user.id,
          refreshTokenHash: newRefreshTokenHash,
          rememberMe: session.rememberMe,
          expiresAt: session.expiresAt,
        },
      }),
    ]);

    const newAccessToken = signAccessToken(session.user);
    setRefreshCookie(res, newRawRefreshToken, session.rememberMe);

    return res.status(200).json({
      accessToken: newAccessToken,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/logout
 * Revoke session and clear refresh cookie
 */
authRouter.post('/logout', async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.clientflow_refresh;
    if (rawRefreshToken) {
      const refreshTokenHash = hashToken(rawRefreshToken);
      await prisma.session.updateMany({
        where: { refreshTokenHash },
        data: { revokedAt: new Date() },
      });
    }

    res.clearCookie('clientflow_refresh', { path: '/api/v1/auth' });
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/auth/me
 * Protected endpoint returning profile of current user
 */
authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { organization: true },
    });

    if (!user) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'User profile not found.' },
      });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/forgot-password
 * Send password reset 6-digit OTP and direct link
 */
authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const data = forgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    // If user does not exist, return 200 generic message to prevent email enumeration
    if (!user) {
      return res.status(200).json({
        message: 'If an account exists with this email, password reset instructions have been sent.',
      });
    }

    // Invalidate any existing PASSWORD_RESET tokens for this user
    await prisma.verificationToken.deleteMany({
      where: {
        userId: user.id,
        type: 'PASSWORD_RESET',
      },
    });

    const otp = generateOtp();
    const tokenHash = hashToken(otp);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        type: 'PASSWORD_RESET',
        expiresAt,
      },
    });

    const resetUrl = `${env.FRONTEND_ORIGIN}/reset-password?email=${encodeURIComponent(user.email)}&otp=${otp}`;

    await emailService.sendPasswordResetEmail({
      email: user.email,
      fullName: user.fullName,
      otp,
      resetUrl,
    });

    return res.status(200).json({
      message: 'Password reset code sent. Please check your email.',
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
 * POST /api/v1/auth/verify-reset-code
 * Validate 6-digit OTP before presenting new password entry screen
 */
authRouter.post('/verify-reset-code', async (req, res, next) => {
  try {
    const data = verifyResetCodeSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      return res.status(400).json({
        error: { code: 'INVALID_RESET_CODE', message: 'Invalid or expired password reset code.' },
      });
    }

    const tokenRecord = await prisma.verificationToken.findFirst({
      where: {
        userId: user.id,
        type: 'PASSWORD_RESET',
      },
    });

    if (!tokenRecord) {
      return res.status(400).json({
        error: { code: 'INVALID_RESET_CODE', message: 'No active password reset request found.' },
      });
    }

    if (new Date() > tokenRecord.expiresAt) {
      await prisma.verificationToken.delete({ where: { id: tokenRecord.id } });
      return res.status(400).json({
        error: { code: 'EXPIRED_RESET_CODE', message: 'Password reset code has expired. Please request a new one.' },
      });
    }

    if (tokenRecord.attempts >= 5) {
      await prisma.verificationToken.delete({ where: { id: tokenRecord.id } });
      return res.status(429).json({
        error: { code: 'MAX_ATTEMPTS_EXCEEDED', message: 'Too many failed attempts. Please request a new reset code.' },
      });
    }

    const providedHash = hashToken(data.otp);
    if (providedHash !== tokenRecord.tokenHash) {
      await prisma.verificationToken.update({
        where: { id: tokenRecord.id },
        data: { attempts: { increment: 1 } },
      });

      return res.status(400).json({
        error: { code: 'INVALID_OTP', message: 'Invalid password reset code.' },
      });
    }

    return res.status(200).json({
      valid: true,
      message: 'Password reset code is valid.',
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
 * POST /api/v1/auth/reset-password
 * Validate 6-digit OTP and update user password atomically, invalidating active sessions
 */
authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const data = resetPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      return res.status(400).json({
        error: { code: 'INVALID_RESET_CODE', message: 'Invalid or expired password reset code.' },
      });
    }

    const tokenRecord = await prisma.verificationToken.findFirst({
      where: {
        userId: user.id,
        type: 'PASSWORD_RESET',
      },
    });

    if (!tokenRecord) {
      return res.status(400).json({
        error: { code: 'INVALID_RESET_CODE', message: 'No active password reset request found.' },
      });
    }

    if (new Date() > tokenRecord.expiresAt) {
      await prisma.verificationToken.delete({ where: { id: tokenRecord.id } });
      return res.status(400).json({
        error: { code: 'EXPIRED_RESET_CODE', message: 'Password reset code has expired. Please request a new one.' },
      });
    }

    if (tokenRecord.attempts >= 5) {
      await prisma.verificationToken.delete({ where: { id: tokenRecord.id } });
      return res.status(429).json({
        error: { code: 'MAX_ATTEMPTS_EXCEEDED', message: 'Too many failed attempts. Please request a new reset code.' },
      });
    }

    const providedHash = hashToken(data.otp);
    if (providedHash !== tokenRecord.tokenHash) {
      await prisma.verificationToken.update({
        where: { id: tokenRecord.id },
        data: { attempts: { increment: 1 } },
      });

      return res.status(400).json({
        error: { code: 'INVALID_OTP', message: 'Invalid password reset code.' },
      });
    }

    const newPasswordHash = await hashPassword(data.newPassword);

    await prisma.$transaction(async (tx) => {
      // 1. Update user password
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      });

      // 2. Revoke all active sessions (force fresh login)
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // 3. Delete used reset token
      await tx.verificationToken.delete({
        where: { id: tokenRecord.id },
      });
    });

    res.clearCookie('clientflow_refresh', { path: '/api/v1/auth' });

    return res.status(200).json({
      message: 'Password reset successfully. You can now log in with your new password.',
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

const acceptInviteSchema = z.object({
  token: z.string().trim().min(1, 'Invitation token is required'),
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * GET /api/v1/auth/invitation
 * Check validity of an invitation token and return organization details
 */
authRouter.get('/invitation', async (req, res, next) => {
  try {
    const rawToken = req.query.token;
    if (!rawToken || typeof rawToken !== 'string') {
      return res.status(400).json({
        error: { code: 'INVALID_TOKEN', message: 'Invitation token is required.' },
      });
    }

    const tokenHash = hashToken(rawToken.trim());
    const invitation = await prisma.invitation.findFirst({
      where: {
        tokenHash,
        status: 'PENDING',
      },
      include: {
        organization: { select: { name: true, slug: true } },
        invitedBy: { select: { fullName: true, email: true } },
      },
    });

    if (!invitation) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INVITATION',
          message: 'This invitation link is invalid, has been revoked, or has already been accepted.',
        },
      });
    }

    if (new Date(invitation.expiresAt) <= new Date()) {
      return res.status(400).json({
        error: {
          code: 'INVITATION_EXPIRED',
          message: 'This invitation has expired. Please ask your administrator to send a new invite.',
        },
      });
    }

    return res.status(200).json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        organizationName: invitation.organization.name,
        inviterName: invitation.invitedBy?.fullName || invitation.invitedBy?.email,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/accept-invite
 * Accepts invitation, activates user account, sets password, and logs user in
 */
authRouter.post('/accept-invite', async (req, res, next) => {
  try {
    const { token, fullName, password } = acceptInviteSchema.parse(req.body);
    const tokenHash = hashToken(token.trim());

    const invitation = await prisma.invitation.findFirst({
      where: {
        tokenHash,
        status: 'PENDING',
      },
      include: {
        organization: true,
      },
    });

    if (!invitation) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INVITATION',
          message: 'This invitation link is invalid, has been revoked, or has already been accepted.',
        },
      });
    }

    if (new Date(invitation.expiresAt) <= new Date()) {
      return res.status(400).json({
        error: {
          code: 'INVITATION_EXPIRED',
          message: 'This invitation has expired. Please ask your administrator to send a new invite.',
        },
      });
    }

    const passwordHash = await hashPassword(password);

    const [user] = await prisma.$transaction(async (tx) => {
      // 1. Create or update user as ACTIVE
      const activeUser = await tx.user.upsert({
        where: { email: invitation.email },
        update: {
          fullName,
          passwordHash,
          role: invitation.role,
          status: 'ACTIVE',
          organizationId: invitation.organizationId,
        },
        create: {
          organizationId: invitation.organizationId,
          email: invitation.email,
          fullName,
          passwordHash,
          role: invitation.role,
          status: 'ACTIVE',
        },
      });

      // 2. Mark invitation as ACCEPTED
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      });

      return [activeUser];
    });

    // 3. Issue session tokens and log user in automatically
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = hashToken(rawRefreshToken);
    const sessionDays = 7;
    const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        rememberMe: false,
        expiresAt,
      },
    });

    const accessToken = signAccessToken({
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role,
    });

    setRefreshCookie(res, rawRefreshToken, false);

    return res.status(200).json({
      message: 'Invitation accepted and account activated successfully.',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        organization: {
          id: invitation.organization.id,
          name: invitation.organization.name,
          slug: invitation.organization.slug,
        },
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: err.errors[0].message },
      });
    }
    next(err);
  }
});


