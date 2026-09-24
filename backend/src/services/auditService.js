import { db } from '../db/sqlite.js';

const insertStmt = db.prepare('INSERT INTO audit_log (actor_username, action, details) VALUES (?, ?, ?)');

const searchStmt = db.prepare(`
  SELECT id, actor_username, action, details, at FROM audit_log
  WHERE (@q IS NULL OR actor_username LIKE @qLike OR action LIKE @qLike OR details LIKE @qLike)
    AND (@action IS NULL OR action = @action)
    AND (@from IS NULL OR at >= @from)
    AND (@to IS NULL OR at < @to)
  ORDER BY at DESC, id DESC
  LIMIT @limit
`);

export function logAction(actorUsername, action, details) {
  insertStmt.run(actorUsername || 'desconhecido', action, details ? String(details) : null);
}

// `to` (data, tipo "2026-09-24") é exclusivo por baixo dos panos — vira o
// início do dia seguinte, pra incluir o dia inteiro selecionado.
function nextDayStr(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function getAuditLog({ limit = 100, q, action, from, to } = {}) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 1000) : 100;
  const cleanQ = q && String(q).trim() ? String(q).trim() : null;
  const cleanAction = action && String(action).trim() ? String(action).trim() : null;

  const rows = searchStmt.all({
    q: cleanQ, qLike: cleanQ ? `%${cleanQ}%` : null,
    action: cleanAction,
    from: from ? `${from} 00:00:00` : null,
    to: to ? `${nextDayStr(to)} 00:00:00` : null,
    limit: safeLimit,
  });

  return rows.map((row) => ({
    id: row.id,
    actorUsername: row.actor_username,
    action: row.action,
    details: row.details,
    at: row.at,
  }));
}
