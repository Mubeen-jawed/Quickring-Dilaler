const API_BASE = '/api';

function getToken() {
  return sessionStorage.getItem('accessToken');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('agent');
    window.location.reload();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Request failed');
  }

  return res.json();
}

export const api = {
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  verifyTotp: (totpToken, code) =>
    request('/auth/verify-totp', {
      method: 'POST',
      body: JSON.stringify({ totpToken, code }),
    }),

  getTwilioToken: () => request('/token/twilio-token'),

  logCall: (data) =>
    request('/calls', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCall: (callSid, data) =>
    request(`/calls/${callSid}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteCall: (callSid) =>
    request(`/calls/${callSid}`, {
      method: 'DELETE',
    }),

  getCallHistory: (page = 1, limit = 10, search = '') =>
    request(`/calls/history?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`),

  getInboundHistory: (page = 1, limit = 10, search = '') =>
    request(`/calls/inbound-history?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`),

  getBilling: () => request('/calls/billing'),

  getRecordingUrl: (callSid) => `${API_BASE}/calls/${callSid}/recording?token=${getToken()}`,

  getBillingSummary: () => request('/calls/billing/monthly-summary'),

  getBillingMonth: (month, page = 1, limit = 10, search = '') =>
    request(`/calls/billing/month/${month}?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`),

  getBillingExportUrl: (month) =>
    `${API_BASE}/calls/billing/export/${month}?token=${getToken()}`,
};
