import { db } from '../db/sqlite.js';

const upsertStmt = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);
const selectStmt = db.prepare(`SELECT value FROM settings WHERE key = ?`);

const DEFAULTS = {
  companyName: process.env.DEFAULT_COMPANY_NAME || 'Minha Empresa',
  pbxName: process.env.DEFAULT_PBX_NAME || 'PBX',
  logoUrl: '',
};

const ALLOWED_KEYS = new Set(Object.keys(DEFAULTS));

export function getSettings() {
  const result = { ...DEFAULTS };
  for (const key of ALLOWED_KEYS) {
    const row = selectStmt.get(key);
    if (row && row.value) result[key] = row.value;
  }
  return result;
}

export function setSettings(partial) {
  for (const [key, value] of Object.entries(partial)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    upsertStmt.run(key, String(value ?? ''));
  }
  return getSettings();
}
