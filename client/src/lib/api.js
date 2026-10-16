export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function request(path, options = {}) {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null;
  }

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorMsg = data?.error?.message || data?.message || `Request failed with status ${response.status}`;
    const code = data?.error?.code || 'API_ERROR';
    const details = data?.error?.details || null;
    throw new ApiError(errorMsg, response.status, code, details);
  }

  return data;
}

export const authApi = {
  register: (payload) =>
    request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifyEmail: ({ email, otp }) =>
    request('/api/v1/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    }),

  resendOtp: ({ email }) =>
    request('/api/v1/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  login: ({ email, password, rememberMe }) =>
    request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe }),
    }),

  logout: () =>
    request('/api/v1/auth/logout', {
      method: 'POST',
    }),

  getMe: () =>
    request('/api/v1/auth/me', {
      method: 'GET',
    }),

  forgotPassword: ({ email }) =>
    request('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verifyResetCode: ({ email, otp }) =>
    request('/api/v1/auth/verify-reset-code', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    }),

  resetPassword: ({ email, otp, newPassword }) =>
    request('/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword }),
    }),

  getInvitation: (token) =>
    request(`/api/v1/auth/invitation?token=${encodeURIComponent(token)}`, {
      method: 'GET',
    }),

  acceptInvite: ({ token, fullName, password }) =>
    request('/api/v1/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token, fullName, password }),
    }),
};

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }
  const str = query.toString();
  return str ? `?${str}` : '';
}

export const crmApi = {
  leads: {
    list: (params) => request(`/api/v1/leads${buildQuery(params)}`),
    create: (data) => request('/api/v1/leads', { method: 'POST', body: JSON.stringify(data) }),
    get: (id) => request(`/api/v1/leads/${id}`),
    update: (id, data) => request(`/api/v1/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    convert: (id, data = {}) => request(`/api/v1/leads/${id}/convert`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/v1/leads/${id}`, { method: 'DELETE' }),
  },
  clients: {
    list: (params) => request(`/api/v1/clients${buildQuery(params)}`),
    create: (data) => request('/api/v1/clients', { method: 'POST', body: JSON.stringify(data) }),
    get: (id) => request(`/api/v1/clients/${id}`),
    update: (id, data) => request(`/api/v1/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    archive: (id) => request(`/api/v1/clients/${id}`, { method: 'DELETE' }),
  },
  tasks: {
    list: (params) => request(`/api/v1/tasks${buildQuery(params)}`),
    create: (data) => request('/api/v1/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/v1/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/v1/tasks/${id}`, { method: 'DELETE' }),
  },
  interactions: {
    list: (params) => request(`/api/v1/interactions${buildQuery(params)}`),
    create: (data) => request('/api/v1/interactions', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/v1/interactions/${id}`, { method: 'DELETE' }),
  },
};

export const teamApi = {
  members: {
    list: () => request('/api/v1/team/members'),
    updateRole: (id, role) =>
      request(`/api/v1/team/members/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    updateStatus: (id, status, reason) =>
      request(`/api/v1/team/members/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason }),
      }),
  },
  invitations: {
    list: () => request('/api/v1/team/invitations'),
    create: ({ email, role }) =>
      request('/api/v1/team/invitations', {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      }),
    resend: (id) =>
      request(`/api/v1/team/invitations/${id}/resend`, {
        method: 'POST',
      }),
    reminder: (id) =>
      request(`/api/v1/team/invitations/${id}/reminder`, {
        method: 'POST',
      }),
    revoke: (id) =>
      request(`/api/v1/team/invitations/${id}`, {
        method: 'DELETE',
      }),
    processReminders: () =>
      request('/api/v1/team/invitations/process-reminders', {
        method: 'POST',
      }),
  },
};

