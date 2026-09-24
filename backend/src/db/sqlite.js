import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

const dir = path.dirname(config.auth.sqlitePath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

export const db = new Database(config.auth.sqlitePath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    source_key TEXT,
    last_notified_at TEXT,
    notified_active INTEGER NOT NULL DEFAULT 0
  );

  -- Último estado conhecido de cada ramal, persistido para sobreviver a
  -- reinícios do backend (sem isso, "offline há quanto tempo" reseta toda
  -- vez que o processo reinicia).
  CREATE TABLE IF NOT EXISTS extension_last_seen (
    number TEXT PRIMARY KEY,
    name TEXT,
    state TEXT NOT NULL,
    last_seen_online TEXT,
    updated_at TEXT NOT NULL
  );

  -- Histórico de transições online/offline por ramal, para o "caiu Nx esta
  -- semana" e o detalhe de cada unidade.
  CREATE TABLE IF NOT EXISTS extension_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'went_offline' | 'went_online'
    at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_extension_events_number ON extension_events(number, at DESC);

  CREATE TABLE IF NOT EXISTS favorite_extensions (
    number TEXT PRIMARY KEY,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  -- Trilha de auditoria: quem fez login e quem mexeu em configurações/usuários,
  -- pra dar rastreabilidade num painel administrado por mais de uma pessoa.
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_username TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_audit_log_at ON audit_log(at DESC);

  -- Amostras periódicas de CPU/memória/disco, pra mostrar tendência ao
  -- longo do tempo em vez de só o valor atual.
  CREATE TABLE IF NOT EXISTS server_health_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    cpu_percent INTEGER NOT NULL,
    memory_percent INTEGER NOT NULL,
    disk_percent INTEGER NOT NULL,
    load_average REAL NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_server_health_history_at ON server_health_history(at DESC);
`);

// Migração leve: `CREATE TABLE IF NOT EXISTS` acima não adiciona colunas
// novas a um banco já existente — precisa de ALTER TABLE explícito.
const alertsColumns = db.prepare('PRAGMA table_info(alerts)').all().map((c) => c.name);
if (!alertsColumns.includes('last_notified_at')) {
  db.exec('ALTER TABLE alerts ADD COLUMN last_notified_at TEXT');
}
if (!alertsColumns.includes('notified_active')) {
  db.exec('ALTER TABLE alerts ADD COLUMN notified_active INTEGER NOT NULL DEFAULT 0');
}

// Idem para `role`: usuários criados antes desta versão viram 'admin' por
// padrão (DEFAULT da coluna), preservando o acesso que já tinham — só
// contas novas, criadas depois, é que nascem como usuário comum por padrão.
const usersColumns = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!usersColumns.includes('role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'");
}
// 2FA (TOTP, ver totpService.js) — totp_recovery_codes guarda hashes bcrypt
// de códigos de recuperação de uso único, como um array JSON.
if (!usersColumns.includes('totp_secret')) {
  db.exec("ALTER TABLE users ADD COLUMN totp_secret TEXT NOT NULL DEFAULT ''");
}
if (!usersColumns.includes('totp_enabled')) {
  db.exec('ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0');
}
if (!usersColumns.includes('totp_recovery_codes')) {
  db.exec("ALTER TABLE users ADD COLUMN totp_recovery_codes TEXT NOT NULL DEFAULT '[]'");
}
