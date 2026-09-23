import path from 'node:path';
import fs from 'node:fs';
import { db } from '../db/sqlite.js';
import { config } from '../config.js';
import { recordBackupSuccess, recordBackupFailure } from './alertsService.js';
import { localDateStr } from '../utils/localDate.js';

const BACKUPS_DIR = path.resolve('data/backups');
// ~2 semanas de histórico: dá margem pra perceber um problema que só foi
// notado alguns dias depois, sem acumular backups pra sempre.
const KEEP_BACKUPS = 14;

function backupFilename(date = new Date()) {
  return `dashboard-${localDateStr(date)}.db`;
}

function rotateOldBackups() {
  const files = fs.readdirSync(BACKUPS_DIR)
    .filter((f) => /^dashboard-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .sort(); // nomes YYYY-MM-DD ordenam cronologicamente como string
  const toDelete = files.slice(0, Math.max(0, files.length - KEEP_BACKUPS));
  for (const f of toDelete) fs.unlinkSync(path.join(BACKUPS_DIR, f));
}

export async function runDailyBackup() {
  if (config.forceMock) return;
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

  const filename = backupFilename();
  try {
    // db.backup() usa a API nativa de backup do SQLite: gera um snapshot
    // consistente mesmo com o banco em uso e em journal_mode = WAL — bem
    // diferente de copiar o arquivo .db "na unha" (cp), que pode deixar de
    // fora escritas ainda pendentes no .db-wal e gerar um backup corrompido
    // ou incompleto.
    await db.backup(path.join(BACKUPS_DIR, filename));
    rotateOldBackups();
    recordBackupSuccess(`Backup diário salvo em data/backups/${filename}`);
  } catch (err) {
    recordBackupFailure(`Falha ao gerar o backup diário do banco: ${err.message}`);
  }
}

function msUntilNextRun(hour) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

// Mesmo padrão de scheduleAlertChecks (server.js): reagenda a si mesmo com
// setTimeout em vez de setInterval, pra próxima rodada só começar depois que
// a anterior (que mexe em arquivo e no banco) realmente terminou.
export function scheduleDailyBackup(hour = config.backupHour) {
  async function run() {
    try {
      await runDailyBackup();
    } catch (err) {
      console.error('[backup] erro ao rodar backup diário:', err && err.message ? err.message : err);
    } finally {
      setTimeout(run, msUntilNextRun(hour));
    }
  }
  setTimeout(run, msUntilNextRun(hour));
}
