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
  ON CONFLICT(id) DO UPDATE SET status = @status, message = @message
`);
const resolveBySourceStmt = db.prepare(`UPDATE alerts SET status = 'resolved' WHERE source_key = ? AND status = 'active'`);
const getByIdStmt = db.prepare(`SELECT status FROM alerts WHERE id = ?`);
const getActiveBySourceStmt = db.prepare(`SELECT message FROM alerts WHERE source_key = ? AND status = 'active'`);
const listStmt = db.prepare(`SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50`);
const countActiveStmt = db.prepare(`SELECT COUNT(*) AS n FROM alerts WHERE status = 'active'`);

const SEVERITY_EMOJI = { critical: '🔴', warning: '🟠', info: 'ℹ️' };

// Só notifica quando o alerta vira ativo pela primeira vez (ou é
// reativado depois de resolvido) — sem isso o Telegram tocaria a cada
// verificação (MONITOR_INTERVAL_MS) enquanto o problema persistir.
function upsertAlert({ id, severity, message, status, source_key }) {
  const existing = getByIdStmt.get(id);
  upsertStmt.run({ id, severity, message, created_at: new Date().toISOString(), status, source_key });
  if (status === 'active' && (!existing || existing.status === 'resolved')) {
    sendTelegramMessage(`${SEVERITY_EMOJI[severity] || '⚠️'} ${message}`);
  }
}

function resolveAlert(sourceKey) {
  const activeAlert = getActiveBySourceStmt.get(sourceKey);
  const info = resolveBySourceStmt.run(sourceKey);
  if (info.changes > 0 && activeAlert) {
    sendTelegramMessage(`✅ Resolvido: ${activeAlert.message}`);
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
            upsertAlert({ id: sourceKey, severity: 'critical', message, status: 'active', source_key: sourceKey });
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
        });
      } else {
        resolveAlert(sourceKey);
      }
    }
  } catch {
    // ignora
  }
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
