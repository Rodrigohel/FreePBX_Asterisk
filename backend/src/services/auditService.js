import { db } from '../db/sqlite.js';

const insertStmt = db.prepare('INSERT INTO audit_log (actor_username, action, details) VALUES (?, ?, ?)');
const listStmt = db.prepare('SELECT id, actor_username, action, details, at FROM audit_log ORDER BY at DESC, id DESC LIMIT ?');

export function logAction(actorUsername, action, details) {
  insertStmt.run(actorUsername || 'desconhecido', action, details ? String(details) : null);
}

export function getAuditLog({ limit = 100 } = {}) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 500) : 100;
  return listStmt.all(safeLimit).map((row) => ({
    id: row.id,
    actorUsername: row.actor_username,
    action: row.action,
    details: row.details,
    at: row.at,
  }));
}
