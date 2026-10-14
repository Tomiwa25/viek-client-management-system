import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
describe('API health', () => { it('responds with status ok', async () => { const response = await request(createApp()).get('/api/v1/health'); expect(response.status).toBe(200); expect(response.body).toEqual({ status: 'ok', service: 'clientflow-api' }); }); it('returns structured 404', async () => { const response = await request(createApp()).get('/api/v1/missing'); expect(response.status).toBe(404); expect(response.body.error.code).toBe('NOT_FOUND'); }); });
