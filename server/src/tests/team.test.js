import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../lib/prisma.js';
import { hashPassword, generateInvitationToken, hashToken } from '../lib/crypto.js';
import { signAccessToken } from '../lib/jwt.js';

const app = createApp();

describe('Team Membership & User Invitations Lifecycle (FR-02)', () => {
  let adminOrg;
  let adminUser;
  let adminToken;
  let staffUser;
  let staffToken;

  beforeAll(async () => {
    // Create dedicated organization for team tests
    adminOrg = await prisma.organization.create({
      data: {
        name: 'Acme Team Test Corp',
        slug: `acme-team-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      },
    });

    // Create admin user
    const passwordHash = await hashPassword('AdminPassword123!');
    adminUser = await prisma.user.create({
      data: {
        organizationId: adminOrg.id,
        email: `admin-${Date.now()}@acmeteam.org`,
        passwordHash,
        fullName: 'Admin Alice',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    adminToken = signAccessToken({
      id: adminUser.id,
      organizationId: adminOrg.id,
      email: adminUser.email,
      role: 'ADMIN',
    });

    // Create staff user
    staffUser = await prisma.user.create({
      data: {
        organizationId: adminOrg.id,
        email: `staff-${Date.now()}@acmeteam.org`,
        passwordHash,
        fullName: 'Staff Sam',
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });

    staffToken = signAccessToken({
      id: staffUser.id,
      organizationId: adminOrg.id,
      email: staffUser.email,
      role: 'STAFF',
    });
  });

  afterAll(async () => {
    if (adminOrg) {
      await prisma.invitation.deleteMany({ where: { organizationId: adminOrg.id } });
      await prisma.session.deleteMany({ where: { user: { organizationId: adminOrg.id } } });
      await prisma.user.deleteMany({ where: { organizationId: adminOrg.id } });
      await prisma.organization.deleteMany({ where: { id: adminOrg.id } });
    }
  });

  it('lists members for Admin and Manager', async () => {
    const res = await request(app)
      .get('/api/v1/team/members')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(2);
    expect(res.body.members[0]).toHaveProperty('role');
    expect(res.body.members[0]).not.toHaveProperty('passwordHash');
  });

  it('blocks Staff from listing team members (403 Forbidden)', async () => {
    const res = await request(app)
      .get('/api/v1/team/members')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows Admin to issue a new team invitation with 7-day expiration', async () => {
    const res = await request(app)
      .post('/api/v1/team/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'newhire@acmetest.org',
        role: 'MANAGER',
      });

    expect(res.status).toBe(201);
    expect(res.body.invitation).toBeDefined();
    expect(res.body.invitation.email).toBe('newhire@acmetest.org');
    expect(res.body.invitation.role).toBe('MANAGER');
    expect(res.body.invitation.status).toBe('PENDING');

    const created = await prisma.invitation.findUnique({
      where: { id: res.body.invitation.id },
    });
    expect(created).toBeDefined();
    expect(created.tokenHash).toHaveLength(64); // SHA-256 hash length

    // Expiry check (~7 days from now)
    const expiryTime = new Date(created.expiresAt).getTime();
    const expectedApprox = Date.now() + 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(expiryTime - expectedApprox)).toBeLessThan(60000);
  });

  it('prevents inviting an already active member (409 Conflict)', async () => {
    const res = await request(app)
      .post('/api/v1/team/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: staffUser.email,
        role: 'STAFF',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_MEMBER');
  });

  it('prevents duplicate active invitations for the same email', async () => {
    await request(app)
      .post('/api/v1/team/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'duplicate@acmetest.org', role: 'STAFF' });

    const duplicateRes = await request(app)
      .post('/api/v1/team/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'duplicate@acmetest.org', role: 'MANAGER' });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.error.code).toBe('INVITATION_ALREADY_EXISTS');
  });

  it('validates invitation link and allows invited user to accept and activate account', async () => {
    // 1. Create invitation
    const rawToken = generateInvitationToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.invitation.create({
      data: {
        organizationId: adminOrg.id,
        email: 'invited@acmetest.org',
        role: 'MANAGER',
        tokenHash,
        invitedById: adminUser.id,
        expiresAt,
      },
    });

    // 2. Query public endpoint to verify invitation details
    const checkRes = await request(app)
      .get(`/api/v1/auth/invitation?token=${rawToken}`);

    expect(checkRes.status).toBe(200);
    expect(checkRes.body.invitation.email).toBe('invited@acmetest.org');
    expect(checkRes.body.invitation.organizationName).toBe(adminOrg.name);
    expect(checkRes.body.invitation.role).toBe('MANAGER');

    // 3. Accept invitation and set password
    const acceptRes = await request(app)
      .post('/api/v1/auth/accept-invite')
      .send({
        token: rawToken,
        fullName: 'Invited Irene',
        password: 'SecurePassword123!',
      });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.accessToken).toBeDefined();
    expect(acceptRes.body.user.email).toBe('invited@acmetest.org');
    expect(acceptRes.body.user.role).toBe('MANAGER');
    expect(acceptRes.body.user.status).toBe('ACTIVE');

    // 4. Verify in database that invitation is marked ACCEPTED
    const updatedInvite = await prisma.invitation.findFirst({
      where: { tokenHash },
    });
    expect(updatedInvite.status).toBe('ACCEPTED');

    // 5. Verify user can now log in
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'invited@acmetest.org',
        password: 'SecurePassword123!',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.fullName).toBe('Invited Irene');
  });

  it('rejects expired invitations', async () => {
    const rawToken = generateInvitationToken();
    const tokenHash = hashToken(rawToken);
    const expiredDate = new Date(Date.now() - 1000 * 60); // 1 minute in the past

    await prisma.invitation.create({
      data: {
        organizationId: adminOrg.id,
        email: 'expired@acmetest.org',
        role: 'STAFF',
        tokenHash,
        invitedById: adminUser.id,
        expiresAt: expiredDate,
      },
    });

    const checkRes = await request(app)
      .get(`/api/v1/auth/invitation?token=${rawToken}`);

    expect(checkRes.status).toBe(400);
    expect(checkRes.body.error.code).toBe('INVITATION_EXPIRED');

    const acceptRes = await request(app)
      .post('/api/v1/auth/accept-invite')
      .send({
        token: rawToken,
        fullName: 'Expired User',
        password: 'SecurePassword123!',
      });

    expect(acceptRes.status).toBe(400);
    expect(acceptRes.body.error.code).toBe('INVITATION_EXPIRED');
  });

  it('allows Admin to revoke a pending invitation', async () => {
    const rawToken = generateInvitationToken();
    const tokenHash = hashToken(rawToken);

    const invite = await prisma.invitation.create({
      data: {
        organizationId: adminOrg.id,
        email: 'revokeme@acmetest.org',
        role: 'STAFF',
        tokenHash,
        invitedById: adminUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const res = await request(app)
      .delete(`/api/v1/team/invitations/${invite.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const revoked = await prisma.invitation.findUnique({
      where: { id: invite.id },
    });
    expect(revoked.status).toBe('REVOKED');
  });

  it('allows Admin to change member role (e.g. STAFF -> MANAGER)', async () => {
    const res = await request(app)
      .patch(`/api/v1/team/members/${staffUser.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'MANAGER' });

    expect(res.status).toBe(200);
    expect(res.body.member.role).toBe('MANAGER');

    const updatedUser = await prisma.user.findUnique({
      where: { id: staffUser.id },
    });
    expect(updatedUser.role).toBe('MANAGER');
  });

  it('prevents demoting the only active Admin', async () => {
    const res = await request(app)
      .patch(`/api/v1/team/members/${adminUser.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'STAFF' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_REMOVE_LAST_ADMIN');
  });

  it('allows Admin to deactivate and reactivate a member', async () => {
    // 1. Deactivate staff
    const suspendRes = await request(app)
      .patch(`/api/v1/team/members/${staffUser.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SUSPENDED', reason: 'On leave' });

    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.member.status).toBe('SUSPENDED');

    // 2. Suspended user cannot log in
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: staffUser.email,
        password: 'AdminPassword123!',
      });

    expect(loginRes.status).toBe(403);
    expect(loginRes.body.error.code).toBe('ACCOUNT_SUSPENDED');

    // 3. Reactivate staff
    const reactivateRes = await request(app)
      .patch(`/api/v1/team/members/${staffUser.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACTIVE' });

    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.member.status).toBe('ACTIVE');
  });

  it('prevents an Admin from deactivating their own account', async () => {
    const res = await request(app)
      .patch(`/api/v1/team/members/${adminUser.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SUSPENDED' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_MODIFY_SELF');
  });
});
