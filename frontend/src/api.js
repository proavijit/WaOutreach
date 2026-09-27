import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const AccountsAPI = {
  getAll: () => api.get('/accounts').then((r) => r.data.data),
  create: (data) => api.post('/accounts', data).then((r) => r.data.data),
  update: (sessionId, data) => api.put(`/accounts/${sessionId}`, data).then((r) => r.data.data),
  reconnect: (sessionId) => api.post(`/accounts/${sessionId}/reconnect`).then((r) => r.data),
  disconnect: (sessionId) => api.post(`/accounts/${sessionId}/disconnect`).then((r) => r.data),
  delete: (sessionId) => api.delete(`/accounts/${sessionId}`).then((r) => r.data),
};

export const WarmupAPI = {
  getStatus: () => api.get('/warmup/status').then((r) => r.data.data),
  toggle: (enabled) => api.post('/warmup/toggle', { enabled }).then((r) => r.data),
  trigger: (params) => api.post('/warmup/trigger', params || {}).then((r) => r.data),
};

export const InboxAPI = {
  getThreads: (params) => api.get('/inbox/threads', { params }).then((r) => r.data.data),
  getMessages: (threadId) => api.get(`/inbox/threads/${threadId}/messages`).then((r) => r.data.data),
  sendReply: (threadId, text) => api.post(`/inbox/threads/${threadId}/reply`, { text }).then((r) => r.data),
  markAsRead: (threadId) => api.put(`/inbox/threads/${threadId}/read`).then((r) => r.data.data),
  toggleBlacklist: (threadId) => api.put(`/inbox/threads/${threadId}/blacklist`).then((r) => r.data.data),
};

export const WhatsAppAPI = {
  getStatus: () => api.get('/whatsapp/status').then((r) => r.data.data),
  reconnect: () => api.post('/whatsapp/reconnect').then((r) => r.data),
  logout: () => api.post('/whatsapp/logout').then((r) => r.data),
  testSend: (phone, message) => api.post('/whatsapp/test-send', { phone, message }).then((r) => r.data),
};

export const CampaignsAPI = {
  getAll: () => api.get('/campaigns').then((r) => r.data.data),
  create: (data) => api.post('/campaigns', data).then((r) => r.data.data),
  getById: (id) => api.get(`/campaigns/${id}`).then((r) => r.data.data),
  update: (id, data) => api.put(`/campaigns/${id}`, data).then((r) => r.data.data),
  delete: (id) => api.delete(`/campaigns/${id}`).then((r) => r.data),
  previewSpintax: (template, sampleLead, count) =>
    api.post('/campaigns/preview-spintax', { template, sampleLead, count }).then((r) => r.data.data),
};

export const LeadsAPI = {
  getAll: (params) => api.get('/leads', { params }).then((r) => r.data.data),
  create: (data) => api.post('/leads', data).then((r) => r.data.data),
  importCsv: (formData) =>
    api.post('/leads/import-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
  toggleBlacklist: (id, reason) => api.put(`/leads/${id}/blacklist`, { reason }).then((r) => r.data.data),
  delete: (id) => api.delete(`/leads/${id}`).then((r) => r.data),
  bulkDelete: (params) => api.delete('/leads', { params }).then((r) => r.data),
};

export const QueueAPI = {
  getStatus: () => api.get('/queue/status').then((r) => r.data.data),
  start: (campaignId, testMode) => api.post('/queue/start', { campaignId, testMode }).then((r) => r.data),
  pause: () => api.post('/queue/pause').then((r) => r.data),
  stop: () => api.post('/queue/stop').then((r) => r.data),
  resetPending: (campaignId, resetFailedOnly) =>
    api.post('/queue/reset-pending', { campaignId, resetFailedOnly }).then((r) => r.data),
};

export const StatsAPI = {
  getOverview: () => api.get('/stats/overview').then((r) => r.data.data),
  getLogs: (limit = 40) => api.get('/stats/logs', { params: { limit } }).then((r) => r.data.data),
  clearLogs: () => api.delete('/stats/logs').then((r) => r.data),
};
