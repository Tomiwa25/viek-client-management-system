import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../lib/prisma.js';
import { signAccessToken } from '../lib/jwt.js';

describe('Projects API & Client Filtering', () => {
  let app;
  let org;
  let user;
  let clientA;
  let clientB;
  let project1;
  let project2;
  let token;

  beforeAll(async () => {
    app = createApp();
    const timestamp = Date.now();

    org = await prisma.organization.create({
      data: {
        name: `Test Org ${timestamp}`,
        slug: `test-org-${timestamp}`,
      },
    });

    user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `tester-${timestamp}@example.com`,
        passwordHash: 'dummy-hash',
        fullName: 'Test User',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    token = signAccessToken({
      userId: user.id,
      organizationId: org.id,
      role: user.role,
      email: user.email,
    });

    clientA = await prisma.client.create({
      data: {
        organizationId: org.id,
        name: 'Client Alpha',
        company: 'Alpha Inc',
        email: 'alpha@test.com',
      },
    });

    clientB = await prisma.client.create({
      data: {
        organizationId: org.id,
        name: 'Client Beta',
        company: 'Beta Inc',
        email: 'beta@test.com',
      },
    });

    project1 = await prisma.project.create({
      data: {
        organizationId: org.id,
        clientId: clientA.id,
        name: 'Alpha Web Platform',
        description: 'Web development project',
      },
    });

    project2 = await prisma.project.create({
      data: {
        organizationId: org.id,
        clientId: clientB.id,
        name: 'Beta Mobile App',
        description: 'Mobile project',
      },
    });
  });

  afterAll(async () => {
    if (org?.id) {
      await prisma.organization.delete({ where: { id: org.id } }).catch(() => {});
    }
  });

  it('rejects unauthenticated requests to /api/v1/projects', async () => {
    const res = await request(app).get('/api/v1/projects');
    expect(res.status).toBe(401);
  });

  it('lists all projects for the organization', async () => {
    const res = await request(app)
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.projects).toBeDefined();
    expect(res.body.data).toBeDefined();
    expect(res.body.projects.length).toBeGreaterThanOrEqual(2);
  });

  it('filters projects by clientId properly', async () => {
    const res = await request(app)
      .get(`/api/v1/projects?clientId=${clientA.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.projects.length).toBe(1);
    expect(res.body.projects[0].name).toBe('Alpha Web Platform');
    expect(res.body.projects[0].clientId).toBe(clientA.id);
  });

  it('creates a new project linked to a client', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Alpha Cloud Migration',
        clientId: clientA.id,
        description: 'Migrating infrastructure to AWS',
      });

    expect(res.status).toBe(201);
    expect(res.body.project.name).toBe('Alpha Cloud Migration');
    expect(res.body.project.clientId).toBe(clientA.id);
  });

  it('deletes a project successfully', async () => {
    const createRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Temporary Project',
        clientId: clientB.id,
      });

    const projectId = createRes.body.project.id;

    const deleteRes = await request(app)
      .delete(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe('Project deleted successfully');

    // Confirm it is deleted
    const verifyRes = await request(app)
      .get(`/api/v1/projects?clientId=${clientB.id}`)
      .set('Authorization', `Bearer ${token}`);

    const found = verifyRes.body.projects.find((p) => p.id === projectId);
    expect(found).toBeUndefined();
  });

  it('supports legacy /api/projects route', async () => {
    const res = await request(app)
      .get(`/api/projects?clientId=${clientA.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.projects).toBeDefined();
    expect(res.body.projects.length).toBeGreaterThanOrEqual(1);
  });
});
