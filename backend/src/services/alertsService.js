import { db } from '../db/sqlite.js';
import { config } from '../config.js';
import { getExtensions } from './extensionsService.js';
import { getServerHealth } from './healthService.js';
import { getLastSeenOnline } from './extensionState.js';
import { mockAlerts } from './mockData.js';
import { sendTelegramMessage } from './telegramService.js';
import { getSettings } from './settingsService.js';

const upsertStmt = db.prepare(`
  INSERT INTO alerts (id, severity, message, created_at, status, source_key)
  VALUES (@id, @severity, @message, @created_at, @status, @source_key)
  ON CONFLICT(id) DO UPDATE SET status = @status, message = @message, severity = @severity
`);
const resolveBySourceStmt = db.prepare(`UPDATE alerts SET status = 'resolved' WHERE source_key = ? AND status = 'active'`);
const getByIdStmt = db.prepare(`SELECT status, last_notified_at, notified_active FROM alerts WHERE id = ?`);
const getActiveBySourceStmt = db.prepare(`SELECT id, message, notified_active FROM alerts WHERE source_key = ? AND status = 'active'`);
const touchNotifiedStmt = db.prepare(`UPDATE alerts SET last_notified_at = ?, notified_active = 1 WHERE id = ?`);
const clearNotifiedStmt = db.prepare(`UPDATE alerts SET notified_active = 0 WHERE id = ?`);
const listStmt = db.prepare(`SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50`);
const countActiveStmt = db.prepare(`SELECT COUNT(*) AS n FROM alerts WHERE status = 'active'`);
const insertResolvedStmt = db.prepare(`
  INSERT INTO alerts (id, severity, message, created_at, status, source_key)
  VALUES (@id, @severity, @message, @created_at, 'resolved', @source_key)
  ON CONFLICT(id) DO UPDATE SET severity = @severity, message = @message, created_at = @created_at, status = 'resolved'
`);

const SEVERITY_EMOJI = { critical: '🔴', warning: '🟠', info: 'ℹ️' };

// Ramais com conexão instável (ex.: intercomunicador em link celular)
// podem oscilar offline/online várias vezes seguidas — o cooldown evita
// reenviar "ativo" a cada oscilação. Mas resolver rápido (o caso mais
// comum: cai, volta em poucos minutos) NÃO pode ficar sujeito a esse
// mesmo cooldown, senão o "resolvido" nunca chega — a pessoa só vê o
// aviso de offline e, ao checar o painel depois, o ramal já está online
// de novo, parecendo um alarme falso. Por isso o resolvido é sempre
// enviado quando o "ativo" correspondente foi de fato notificado
// (notified_active), independente do cooldown.
const NOTIFY_COOLDOWN_MS = 10 * 60 * 1000;

function canNotify(lastNotifiedAt, intervalMs) {
  if (!lastNotifiedAt) return true;
  return Date.now() - new Date(lastNotifiedAt).getTime() >= intervalMs;
}

function notify(id, text) {
  sendTelegramMessage(text);
  touchNotifiedStmt.run(new Date().toISOString(), id);
}

// Notifica quando o alerta vira ativo pela primeira vez (ou é reativado
// depois de resolvido), sujeito a um cooldown curto fixo só pra absorver
// flapping (reativações rapidíssimas). Enquanto o alerta continuar ativo,
// manda um lembrete a cada `reminderIntervalMs` (configurável em
// Configurações; 0 desativa os lembretes) — sem isso o problema ficaria
// mudo até ser resolvido, mesmo que dure horas.
function upsertAlert({ id, severity, message, status, source_key }, reminderIntervalMs = 0) {
  const existing = getByIdStmt.get(id);
  upsertStmt.run({ id, severity, message, created_at: new Date().toISOString(), status, source_key });
  const justActivated = status === 'active' && (!existing || existing.status === 'resolved');
  if (justActivated) {
    if (canNotify(existing?.last_notified_at, NOTIFY_COOLDOWN_MS)) {
      notify(id, `${SEVERITY_EMOJI[severity] || '⚠️'} ${message}`);
    } else {
      // Reativou dentro do cooldown (flapping): fica quieto, e marca que
      // este período ativo não foi notificado, pra não mandar um
      // "resolvido" órfão sem o "ativo" correspondente.
      clearNotifiedStmt.run(id);
    }
  } else if (
    status === 'active' && existing && existing.status === 'active' && existing.notified_active &&
    reminderIntervalMs > 0 && canNotify(existing.last_notified_at, reminderIntervalMs)
  ) {
    notify(id, `🔁 Ainda ativo: ${message}`);
  }
}

function resolveAlert(sourceKey) {
  const activeAlert = getActiveBySourceStmt.get(sourceKey);
  const info = resolveBySourceStmt.run(sourceKey);
  if (info.changes > 0 && activeAlert && activeAlert.notified_active) {
    // Além de repetir o motivo original (que já traz "offline desde... —
    // Xh sem conexão"), deixa explícito quando voltou — sem isso dava pra
    // saber que resolveu, mas não a que horas, tendo que abrir o painel ou
    // fazer conta de cabeça a partir da duração.
    notify(activeAlert.id, `✅ Resolvido em ${formatDateTime(Date.now())}: ${activeAlert.message}`);
    clearNotifiedStmt.run(activeAlert.id);
  }
}

function rowToAlert(row) {
  return {
    id: row.id,
    severity: row.severity,
    message: row.message,
    createdAt: row.created_at,
    status: row.status,
  };
}

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}`;
  return `${minutes}min`;
}

function formatDateTime(ms) {
  return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Roda periodicamente (ver server.js) verificando condições de alerta a
 * partir dos dados reais (ramais offline há muito tempo, disco cheio) e
 * mantém a tabela `alerts` do SQLite como histórico ativo/resolvido.
 */
export async function runAlertChecks() {
  if (config.forceMock) return;

  const settings = getSettings();
  const offlineMinutes = Number(settings.alertExtensionOfflineMinutes) || 120;
  const diskPercent = Number(settings.alertDiskUsagePercent) || 80;
  const reminderMinutes = Number(settings.alertReminderIntervalMinutes) || 0;
  const reminderIntervalMs = reminderMinutes > 0 ? reminderMinutes * 60 * 1000 : 0;

  try {
    const { data: extensions, source } = await getExtensions();
    if (source === 'ami') {
      const thresholdMs = offlineMinutes * 60 * 1000;
      for (const ext of extensions) {
        const sourceKey = `ext-offline-${ext.number}`;
        if (ext.state === 'offline') {
          const lastSeen = getLastSeenOnline(ext.number);
          const offlineFor = lastSeen ? Date.now() - lastSeen : Infinity;
          if (offlineFor >= thresholdMs) {
            const message = lastSeen
              ? `Ramal ${ext.number} (${ext.name}) offline desde ${formatDateTime(lastSeen)} — ${formatDuration(offlineFor)} sem conexão`
              : `Ramal ${ext.number} (${ext.name}) offline há mais de ${offlineMinutes} minutos (sem registro de última conexão)`;
            upsertAlert({ id: sourceKey, severity: 'critical', message, status: 'active', source_key: sourceKey }, reminderIntervalMs);
          }
        } else {
          resolveAlert(sourceKey);
        }
      }
    }
  } catch {
    // sem dados reais de ramais agora — não gera/atualiza alertas deste tipo
  }

  try {
    const health = await getServerHealth();
    if (health.source === 'system') {
      const sourceKey = 'disk-usage-high';
      if (health.diskPercent >= diskPercent) {
        upsertAlert({
          id: sourceKey,
          severity: 'warning',
          message: `Uso de disco acima de ${diskPercent}% (atual: ${health.diskPercent}%)`,
          status: 'active',
          source_key: sourceKey,
        }, reminderIntervalMs);
      } else {
        resolveAlert(sourceKey);
      }
    }
  } catch {
    // ignora
  }
}

// Usados pelo backupService: o backup diário aparece na mesma lista de
// alertas/eventos resolvidos (severidade "info" quando dá certo), e como
// alerta crítico de verdade — com notificação no Telegram — se falhar.
// Reaproveita o mesmo `source_key` fixo pros dois casos: se falhar hoje e
// der certo amanhã, o "resolvido" cai em cima do alerta crítico de ontem
// (e dispara o aviso de recuperação), em vez de acumular uma linha nova
// por dia.
const BACKUP_SOURCE_KEY = 'daily-backup';

export function recordBackupSuccess(message) {
  resolveAlert(BACKUP_SOURCE_KEY);
  insertResolvedStmt.run({
    id: BACKUP_SOURCE_KEY, severity: 'info', message, created_at: new Date().toISOString(), source_key: BACKUP_SOURCE_KEY,
  });
}

export function recordBackupFailure(message) {
  upsertAlert({ id: BACKUP_SOURCE_KEY, severity: 'critical', message, status: 'active', source_key: BACKUP_SOURCE_KEY });
}

export async function getAlerts() {
  if (config.forceMock) {
    return { data: mockAlerts(), source: 'mock' };
  }
  const rows = listStmt.all();
  if (rows.length === 0) {
    return { data: mockAlerts(), source: 'mock' };
  }
  return { data: rows.map(rowToAlert), source: 'db' };
}

export async function getActiveAlertsCount() {
  if (config.forceMock) return 0;
  return countActiveStmt.get().n;
}
