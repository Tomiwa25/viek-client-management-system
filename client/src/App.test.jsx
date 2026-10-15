import { describe, expect, it, beforeEach, vi } from 'vitest';
import { authApi, crmApi, ApiError, request } from './lib/api';

const createLocalStorageMock = () => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
};

globalThis.localStorage = createLocalStorageMock();

describe('Auth Client & Form Logic Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('API Client Request Helper', () => {
    it('injects Bearer token from localStorage when present', async () => {
      localStorage.setItem('token', 'mock-jwt-token-12345');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ user: { id: 'user-1' } }),
      });
      global.fetch = mockFetch;

      const result = await authApi.getMe();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/auth/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-jwt-token-12345',
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual({ user: { id: 'user-1' } });
    });

    it('omits Authorization header when localStorage has no token', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'ok' }),
      });
      global.fetch = mockFetch;

      await request('/api/v1/health');

      const calledHeaders = mockFetch.mock.calls[0][1].headers;
      expect(calledHeaders.Authorization).toBeUndefined();
    });

    it('throws ApiError with status and code when response is not ok', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        }),
      });
      global.fetch = mockFetch;

      await expect(
        authApi.login({ email: 'test@example.com', password: 'wrong' })
      ).rejects.toThrow('Invalid email or password');
    });

    it('correctly dispatches verifyEmail payload with 6-digit OTP', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Verified' }),
      });
      global.fetch = mockFetch;

      await authApi.verifyEmail({ email: 'test@org.com', otp: '492018' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/auth/verify-email',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@org.com', otp: '492018' }),
        })
      );
    });
  });

  describe('CRM API Client Methods', () => {
    it('dispatches lead conversion request with optional phone and notes', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ client: { id: 'client-1', name: 'Converted Corp' } }),
      });
      global.fetch = mockFetch;

      const result = await crmApi.leads.convert('lead-123', {
        phone: '123-456-7890',
        notes: 'Signed deal',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/leads/lead-123/convert',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ phone: '123-456-7890', notes: 'Signed deal' }),
        })
      );
      expect(result.client.name).toBe('Converted Corp');
    });

    it('dispatches task status update to COMPLETED', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ task: { id: 'task-1', status: 'COMPLETED' } }),
      });
      global.fetch = mockFetch;

      await crmApi.tasks.update('task-1', { status: 'COMPLETED' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/tasks/task-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'COMPLETED' }),
        })
      );
    });

    it('dispatches interaction log for client', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ interaction: { id: 'int-1', type: 'MEETING' } }),
      });
      global.fetch = mockFetch;

      await crmApi.interactions.create({
        clientId: 'client-1',
        type: 'MEETING',
        notes: 'Quarterly review',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/interactions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            clientId: 'client-1',
            type: 'MEETING',
            notes: 'Quarterly review',
          }),
        })
      );
    });
  });
});
