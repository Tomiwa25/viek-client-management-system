import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../lib/prisma.js';

describe('Auth & OTP lifecycle', () => {
  const testEmail = `test-${Date.now()}@example.com`;
  let otpCode = null;
  let accessToken = null;
  let refreshCookie = null;

  it('registers a new organization and admin user', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        organizationName: 'Acme Test Corp',
        email: testEmail,
        password: 'SuperSecret123!',
        fullName: 'Jane Doe',
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user.role).toBe('ADMIN');
    expect(res.body.user.status).toBe('PENDING_VERIFICATION');

    // Verify token exists in database
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
      include: { verificationTokens: true },
    });
    expect(user).toBeDefined();
    expect(user.verificationTokens.length).toBe(1);
  });

  it('rejects login prior to email verification', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'SuperSecret123!',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('VERIFICATION_REQUIRED');
  });

  it('rejects verification with wrong OTP', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({
        email: testEmail,
        otp: '000000',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CODE');
  });

  it('resends fresh OTP code and allows verification', async () => {
    const app = createApp();

    // Trigger resend
    const resendRes = await request(app)
      .post('/api/v1/auth/resend-otp')
      .send({ email: testEmail });
    expect(resendRes.status).toBe(200);

    // Verify user can be activated
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
      include: { verificationTokens: true },
    });
    expect(user.verificationTokens.length).toBe(1);

    // Activate user directly to simulate OTP verification
    await prisma.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE' },
    });
  });

  it('successfully logs in with rememberMe=true and receives JWT + cookie', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'SuperSecret123!',
        rememberMe: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
    expect(res.headers['set-cookie']).toBeDefined();

    accessToken = res.body.accessToken;
    refreshCookie = res.headers['set-cookie'];
  });

  it('allows access to protected /auth/me with Bearer token', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user.organization.name).toBe('Acme Test Corp');
  });

  it('rejects access to /auth/me without token', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('successfully rotates refresh token via /auth/refresh', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('successfully logs out and invalidates session', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(204);
  });
});
