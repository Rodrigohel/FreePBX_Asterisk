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
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    setToken(null);
    const err = new Error('Não autenticado');
    err.status = 401;
    throw err;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status}`);
  }

  return res.json();
}

export const api = {
  login: (username, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request('/api/auth/me'),
  status: () => request('/api/status'),
  extensions: () => request('/api/extensions'),
  extensionsSummary: () => request('/api/extensions/summary'),
  activeCalls: () => request('/api/calls/active'),
  callsSummary: (range) => request(`/api/calls/summary?range=${range}`),
  todaySummary: () => request('/api/calls/today-summary'),
  alerts: () => request('/api/alerts'),
  serverHealth: () => request('/api/server/health'),
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
