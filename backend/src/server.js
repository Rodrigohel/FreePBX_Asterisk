import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { amiClient } from './ami/amiClient.js';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { publicRouter } from './routes/public.js';
import { settingsRouter } from './routes/settings.js';
import { usersRouter } from './routes/users.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';
import { runAlertChecks } from './services/alertsService.js';
import { scheduleDailyBackup } from './services/backupService.js';
import { scheduleDailyDigest } from './services/digestService.js';
import { scheduleHealthSampling } from './services/healthService.js';
import { getActiveCalls } from './services/callsService.js';
import { getExtensions } from './services/extensionsService.js';
import './db/sqlite.js';

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

// Logo enviado via upload — serve estático, sem autenticação (é só uma
// imagem de marca, exibida inclusive no painel público e na tela de login).
// Fica sob /api (e antes do requireAuth abaixo) para atravessar de graça o
// mesmo proxy reverso que já encaminha /api/ — um caminho fora de /api não
// é repassado pelas regras de Apache/Nginx do README, e a imagem quebra.
app.use('/api/uploads', express.static(path.resolve('data/uploads')));

app.use('/api/auth', authRouter);
// Rota pública (sem autenticação) precisa vir ANTES do requireAuth abaixo,
// que protege todo o restante de /api.
app.use('/api/public', publicRouter);
app.use('/api/settings', requireAuth, requireAdmin, settingsRouter);
app.use('/api/users', requireAuth, requireAdmin, usersRouter);
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

// Monitor de alertas/saúde em background. Reagenda a si mesmo em vez de usar
// setInterval: como runAlertChecks é assíncrono (AMI, banco, e a chamada de
// rede pro Telegram quando há alerta pra notificar), uma checagem que demora
// mais que o intervalo configurado poderia se sobrepor à próxima — duas
// rodadas concorrentes mexendo nas mesmas linhas da tabela `alerts` podiam
// intercalar leituras/escritas fora de ordem (ex.: uma rodada com dado
// desatualizado ainda achando o ramal offline, rodando depois de outra que já
// tinha marcado como resolvido) e mandar notificações fora de ordem no
// Telegram. Encadeando com setTimeout, a próxima checagem só começa depois
// que a anterior realmente terminou.
async function scheduleAlertChecks() {
  try {
    await runAlertChecks();
  } catch (err) {
    console.error('[alerts] erro ao verificar alertas:', err && err.message ? err.message : err);
  } finally {
    setTimeout(scheduleAlertChecks, config.monitorIntervalMs);
  }
}
scheduleAlertChecks();

// Backup diário do banco SQLite (dashboard.db). Aparece em Alertas: como
// alerta crítico (com Telegram) se falhar, como item "resolvido" discreto
// (sem Telegram) se der certo.
scheduleDailyBackup();

// Resumo diário automático no Telegram (resumo do dia anterior). Desativado
// por padrão — só manda alguma coisa se ligado em Configurações e com
// token/chat_id do Telegram preenchidos.
scheduleDailyDigest();

// Amostra CPU/memória/disco a cada 5min pro gráfico de tendência de saúde
// do servidor. Não grava nada em modo mock (getServerHealth() já cai em
// mock ali dentro).
scheduleHealthSampling();

server.listen(config.port, () => {
  console.log(`[dashboard-backend] ouvindo em http://localhost:${config.port} (mock=${config.forceMock})`);
});
