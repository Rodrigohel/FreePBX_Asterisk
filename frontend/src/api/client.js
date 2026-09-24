const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_URL = import.meta.env.VITE_WS_URL || API_URL.replace(/^http/, 'ws') + '/ws';

export const TOKEN_KEY = 'pbx_dashboard_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = import.meta.env.VITE_EMBEDDED === 'true' ? localStorage.getItem('portal_token') : getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Um 401 na própria rota de login significa "senha/código errado" (o
    // usuário nem tem token ainda) — bem diferente de um 401 numa rota
    // protegida, que significa "sua sessão expirou", e aí sim precisa
    // limpar o token guardado.
    if (res.status === 401 && path !== '/api/auth/login') {
      setToken(null);
    }
    const err = new Error(body.error || `Erro ${res.status}`);
    err.status = res.status;
    if (body.requiresTotp) err.requiresTotp = true;
    throw err;
  }

  return res.json();
}

export function resolveAssetUrl(path) {
  if (!path) return '';
  return `${API_URL}${path}`;
}

export const api = {
  login: (username, password, totpCode) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password, totpCode }) }),
  me: () => request('/api/auth/me'),
  setup2FA: () => request('/api/auth/2fa/setup', { method: 'POST' }),
  confirm2FA: (code) => request('/api/auth/2fa/confirm', { method: 'POST', body: JSON.stringify({ code }) }),
  disable2FA: (password) => request('/api/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ password }) }),
  status: () => request('/api/status'),
  extensions: () => request('/api/extensions'),
  extensionsSummary: () => request('/api/extensions/summary'),
  extensionDetail: (number) => request(`/api/extensions/${encodeURIComponent(number)}`),
  favorites: () => request('/api/extensions/favorites'),
  addFavorite: (number) => request(`/api/extensions/${encodeURIComponent(number)}/favorite`, { method: 'POST' }),
  removeFavorite: (number) => request(`/api/extensions/${encodeURIComponent(number)}/favorite`, { method: 'DELETE' }),
  activeCalls: () => request('/api/calls/active'),
  callsSummary: (range) => request(`/api/calls/summary?range=${range}`),
  todaySummary: (date) => request(`/api/calls/today-summary${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  periodSummary: ({ from, to }) => request(`/api/calls/period-summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  missedCallsToday: () => request('/api/calls/missed-today'),
  topUnitsReport: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return request(`/api/calls/top-units?${qs.toString()}`);
  },
  callHeatmap: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return request(`/api/calls/heatmap?${qs.toString()}`);
  },
  extensionFailures: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return request(`/api/extensions/failures/report?${qs.toString()}`);
  },
  callsHistory: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return request(`/api/calls/history?${qs.toString()}`);
  },
  exportCallHistory: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return request(`/api/calls/history/export?${qs.toString()}`);
  },
  alerts: () => request('/api/alerts'),
  serverHealth: () => request('/api/server/health'),
  serverHealthHistory: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return request(`/api/server/health/history?${qs.toString()}`);
  },
  publicDashboard: (range) => request(`/api/public/dashboard${range ? `?range=${range}` : ''}`),
  publicSettings: () => request('/api/public/settings'),
  settings: () => request('/api/settings'),
  updateSettings: (partial) => request('/api/settings', { method: 'PUT', body: JSON.stringify(partial) }),
  testTelegram: (partial) => request('/api/settings/telegram/test', { method: 'POST', body: JSON.stringify(partial) }),
  uploadLogo: async (file) => {
    const token = getToken();
    const form = new FormData();
    form.append('logo', file);
    const res = await fetch(`${API_URL}/api/settings/logo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Erro ${res.status}`);
    }
    return res.json();
  },
  auditLog: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return request(`/api/settings/audit-log?${qs.toString()}`);
  },
  users: () => request('/api/users'),
  createUser: (data) => request('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export function connectLiveSocket(onMessage) {
  let ws;
  let closedByUser = false;

  function connect() {
    ws = new WebSocket(WS_URL);
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        onMessage(msg);
      } catch {
        // ignora mensagens malformadas
      }
    };
    ws.onclose = () => {
      if (!closedByUser) setTimeout(connect, 3000);
    };
    ws.onerror = () => ws.close();
  }

  connect();

  return () => {
    closedByUser = true;
    ws && ws.close();
  };
}
