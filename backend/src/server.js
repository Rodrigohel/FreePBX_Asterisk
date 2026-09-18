import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { amiClient } from './ami/amiClient.js';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { publicRouter } from './routes/public.js';
import { requireAuth } from './middleware/auth.js';
import { runAlertChecks } from './services/alertsService.js';
import { getActiveCalls } from './services/callsService.js';
import { getExtensions } from './services/extensionsService.js';
import './db/sqlite.js';

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
// Rota pública (sem autenticação) precisa vir ANTES do requireAuth abaixo,
// que protege todo o restante de /api.
app.use('/api/public', publicRouter);
app.use('/api', requireAuth, dashboardRouter);

const server = http.createServer(app);

// --- WebSocket: push de atualizações em tempo real (chamadas ativas / ramais) ---
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(type, payload) {
  const message = JSON.stringify({ type, payload });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(message);
  }
}

async function pushLiveUpdate() {
  if (wss.clients.size === 0) return;
  const [calls, extensions] = await Promise.all([getActiveCalls(), getExtensions()]);
  broadcast('calls:active', calls.data);
  broadcast('extensions', extensions.data);
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected', payload: true }));
});

if (!config.forceMock) {
  // Sem um listener de 'error', o EventEmitter do Node derruba o processo
  // inteiro na primeira falha de conexão do AMI (usuário/senha errados,
  // Asterisk fora do ar, etc.) — o systemd reinicia sozinho, mascarando a
  // causa raiz. Logamos aqui para aparecer no `journalctl`.
  amiClient.on('error', (err) => {
    console.error('[AMI] erro de conexão:', err && err.message ? err.message : err);
  });
  amiClient.on('connected', () => console.log('[AMI] conectado com sucesso'));
  amiClient.on('disconnected', () => console.warn('[AMI] desconectado'));

  amiClient.connect();
  amiClient.on('managerevent', () => {
    // qualquer evento relevante do AMI dispara um push (debounced de forma simples)
  });
}

// Loop de atualização em tempo real via WS (independe do polling REST do frontend)
setInterval(pushLiveUpdate, 5000);

// Monitor de alertas/saúde em background
setInterval(runAlertChecks, config.monitorIntervalMs);
runAlertChecks();

server.listen(config.port, () => {
  console.log(`[dashboard-backend] ouvindo em http://localhost:${config.port} (mock=${config.forceMock})`);
});
