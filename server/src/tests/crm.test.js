import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../lib/prisma.js';
import { signAccessToken } from '../lib/jwt.js';

describe('Multi-Tenant CRM Modules & Atomic Conversion', () => {
  const app = createApp();

  let orgAlpha = null;
  let userAlpha = null;
  let tokenAlpha = null;

  let orgBeta = null;
  let userBeta = null;
  let tokenBeta = null;

  beforeAll(async () => {
    // Set up Organization Alpha
    const timestamp = Date.now();
    orgAlpha = await prisma.organization.create({
      data: {
        name: `Org Alpha ${timestamp}`,
        slug: `alpha-${timestamp}`,
      },
    });
    userAlpha = await prisma.user.create({
      data: {
        organizationId: orgAlpha.id,
        email: `alpha-${timestamp}@example.com`,
        passwordHash: 'dummyhash',
        fullName: 'Alpha User',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    tokenAlpha = signAccessToken({
      id: userAlpha.id,
      organizationId: orgAlpha.id,
      role: userAlpha.role,
      email: userAlpha.email,
    });

    // Set up Organization Beta
    orgBeta = await prisma.organization.create({
      data: {
        name: `Org Beta ${timestamp}`,
        slug: `beta-${timestamp}`,
      },
    });
    userBeta = await prisma.user.create({
      data: {
        organizationId: orgBeta.id,
        email: `beta-${timestamp}@example.com`,
        passwordHash: 'dummyhash',
        fullName: 'Beta User',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    tokenBeta = signAccessToken({
      id: userBeta.id,
      organizationId: orgBeta.id,
      role: userBeta.role,
      email: userBeta.email,
    });
  });

  describe('Multi-Tenant Isolation for Leads', () => {
    let alphaLeadId = null;

    it('allows Org Alpha to create a lead', async () => {
      const res = await request(app)
        .post('/api/v1/leads')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          name: 'Big Enterprise Prospect',
          email: 'prospect@enterprise.com',
          company: 'Enterprise Inc',
          stage: 'QUALIFIED',
        });

      expect(res.status).toBe(201);
      expect(res.body.lead.name).toBe('Big Enterprise Prospect');
      expect(res.body.lead.organizationId).toBe(orgAlpha.id);
      alphaLeadId = res.body.lead.id;
    });

    it('prevents Org Beta from listing Alpha leads', async () => {
      const res = await request(app)
        .get('/api/v1/leads')
        .set('Authorization', `Bearer ${tokenBeta}`);

      expect(res.status).toBe(200);
      const betaLeads = res.body.leads;
      const found = betaLeads.some((l) => l.id === alphaLeadId);
      expect(found).toBe(false);
    });

    it('returns 404 when Org Beta attempts to access Alpha lead directly', async () => {
      const res = await request(app)
        .get(`/api/v1/leads/${alphaLeadId}`)
        .set('Authorization', `Bearer ${tokenBeta}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 when Org Beta attempts to update Alpha lead', async () => {
      const res = await request(app)
        .patch(`/api/v1/leads/${alphaLeadId}`)
        .set('Authorization', `Bearer ${tokenBeta}`)
        .send({ name: 'Hacked Lead Name' });

      expect(res.status).toBe(404);

      // Verify DB was unmodified
      const lead = await prisma.lead.findUnique({ where: { id: alphaLeadId } });
      expect(lead.name).toBe('Big Enterprise Prospect');
    });

    it('returns 404 when Org Beta attempts to convert Alpha lead', async () => {
      const res = await request(app)
        .post(`/api/v1/leads/${alphaLeadId}/convert`)
        .set('Authorization', `Bearer ${tokenBeta}`)
        .send({ notes: 'Stolen conversion' });

      expect(res.status).toBe(404);
    });

    it('returns 404 when Org Beta attempts to delete Alpha lead', async () => {
      const res = await request(app)
        .delete(`/api/v1/leads/${alphaLeadId}`)
        .set('Authorization', `Bearer ${tokenBeta}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Atomic Lead-to-Client Conversion Workflow', () => {
    let leadToConvert = null;
    let leadTaskId = null;
    let convertedClientId = null;

    it('creates a lead with attached tasks for conversion testing', async () => {
      const leadRes = await request(app)
        .post('/api/v1/leads')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          name: 'Stark Industries',
          email: 'tony@stark.com',
          company: 'Stark Industries LLC',
          stage: 'PROPOSAL_SENT',
        });
      expect(leadRes.status).toBe(201);
      leadToConvert = leadRes.body.lead;

      // Attach task to this lead
      const taskRes = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          title: 'Review proposal contract with Tony',
          leadId: leadToConvert.id,
          priority: 'HIGH',
        });
      expect(taskRes.status).toBe(201);
      leadTaskId = taskRes.body.task.id;
    });

    it('atomically converts the lead into an active client', async () => {
      const res = await request(app)
        .post(`/api/v1/leads/${leadToConvert.id}/convert`)
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          phone: '+1 800 555 1234',
          notes: 'Signed deal for 100 enterprise seats',
        });

      expect(res.status).toBe(201);
      expect(res.body.client).toBeDefined();
      expect(res.body.client.name).toBe('Stark Industries');
      expect(res.body.client.email).toBe('tony@stark.com');
      expect(res.body.client.phone).toBe('+1 800 555 1234');
      expect(res.body.client.status).toBe('active');
      expect(res.body.lead.stage).toBe('WON');
      expect(res.body.lead.convertedClientId).toBe(res.body.client.id);

      convertedClientId = res.body.client.id;

      // Verify in DB that the open task was migrated to the new client
      const taskInDb = await prisma.task.findUnique({ where: { id: leadTaskId } });
      expect(taskInDb.clientId).toBe(convertedClientId);
      expect(taskInDb.leadId).toBe(leadToConvert.id);

      // Verify that conversion note interaction was created
      const interactions = await prisma.interaction.findMany({
        where: { clientId: convertedClientId },
      });
      expect(interactions.length).toBe(1);
      expect(interactions[0].notes).toContain('Signed deal for 100 enterprise seats');
    });

    it('prevents double conversion of the same lead (409 Conflict)', async () => {
      const res = await request(app)
        .post(`/api/v1/leads/${leadToConvert.id}/convert`)
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({ notes: 'Trying again' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_CONVERTED');
    });
  });

  describe('Clients, Tasks & Interactions Workflow', () => {
    let clientId = null;
    let taskId = null;

    it('creates and retrieves a client', async () => {
      const res = await request(app)
        .post('/api/v1/clients')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          name: 'Wayne Enterprises',
          email: 'bruce@wayne.com',
          company: 'Wayne Enterprises',
          phone: '555-0199',
        });

      expect(res.status).toBe(201);
      clientId = res.body.client.id;
    });

    it('creates and completes a task for the client', async () => {
      const createRes = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          title: 'Schedule Q4 review meeting',
          clientId,
          priority: 'URGENT',
        });

      expect(createRes.status).toBe(201);
      taskId = createRes.body.task.id;
      expect(createRes.body.task.status).toBe('TODO');
      expect(createRes.body.task.completedAt).toBeNull();

      // Complete the task
      const patchRes = await request(app)
        .patch(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({ status: 'COMPLETED' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.task.status).toBe('COMPLETED');
      expect(patchRes.body.task.completedAt).not.toBeNull();
    });

    it('logs an interaction under the client', async () => {
      const res = await request(app)
        .post('/api/v1/interactions')
        .set('Authorization', `Bearer ${tokenAlpha}`)
        .send({
          clientId,
          type: 'MEETING',
          notes: 'Discussed renewal terms over lunch',
        });

      expect(res.status).toBe(201);
      expect(res.body.interaction.type).toBe('MEETING');
      expect(res.body.interaction.notes).toBe('Discussed renewal terms over lunch');
    });

    it('retrieves the client profile with combined task and interaction history', async () => {
      const res = await request(app)
        .get(`/api/v1/clients/${clientId}`)
        .set('Authorization', `Bearer ${tokenAlpha}`);

      expect(res.status).toBe(200);
      expect(res.body.client.tasks.length).toBeGreaterThanOrEqual(1);
      expect(res.body.client.interactions.length).toBeGreaterThanOrEqual(1);
    });

    it('soft-archives the client and filters it out by default', async () => {
      const delRes = await request(app)
        .delete(`/api/v1/clients/${clientId}`)
        .set('Authorization', `Bearer ${tokenAlpha}`);

      expect(delRes.status).toBe(204);

      // Default GET /clients should not include archived
      const listRes = await request(app)
        .get('/api/v1/clients')
        .set('Authorization', `Bearer ${tokenAlpha}`);

      expect(listRes.status).toBe(200);
      const found = listRes.body.clients.some((c) => c.id === clientId);
      expect(found).toBe(false);

      // Including archived should return it
      const archivedRes = await request(app)
        .get('/api/v1/clients?includeArchived=true')
        .set('Authorization', `Bearer ${tokenAlpha}`);

      const foundArchived = archivedRes.body.clients.some((c) => c.id === clientId);
      expect(foundArchived).toBe(true);
    });
  });
});
