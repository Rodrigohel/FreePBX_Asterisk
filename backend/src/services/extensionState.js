import { db } from '../db/sqlite.js';

/**
 * Estado e histórico de cada ramal, persistidos no SQLite (sobrevive a
 * reinícios do backend — sem isso, "offline há quanto tempo" resetaria
 * toda vez que o processo reiniciasse). Um cache em memória evita gravar
 * no banco a cada polling (só grava quando o estado realmente muda).
 */

const upsertLastSeenStmt = db.prepare(`
  INSERT INTO extension_last_seen (number, name, state, last_seen_online, updated_at)
  VALUES (@number, @name, @state, @last_seen_online, @updated_at)
  ON CONFLICT(number) DO UPDATE SET
    name = @name,
    state = @state,
    last_seen_online = COALESCE(@last_seen_online, extension_last_seen.last_seen_online),
    updated_at = @updated_at
`);
const insertEventStmt = db.prepare(`INSERT INTO extension_events (number, event_type, at) VALUES (?, ?, ?)`);
const selectAllStmt = db.prepare(`SELECT * FROM extension_last_seen`);
const selectOneStmt = db.prepare(`SELECT * FROM extension_last_seen WHERE number = ?`);
const selectEventsStmt = db.prepare(`SELECT event_type, at FROM extension_events WHERE number = ? ORDER BY at DESC LIMIT ?`);
const countOfflineSinceStmt = db.prepare(`SELECT COUNT(*) AS n FROM extension_events WHERE number = ? AND event_type = 'went_offline' AND at >= ?`);

const cache = new Map(); // number -> { state, name }
for (const row of selectAllStmt.all()) {
  cache.set(row.number, { state: row.state, name: row.name });
}

function isOnlineState(state) {
  return state !== 'offline';
}

export function recordExtensionState(number, state, name) {
  const now = new Date().toISOString();
  const previous = cache.get(number);
  cache.set(number, { state, name });

  if (!previous) {
    upsertLastSeenStmt.run({
      number, name, state,
      last_seen_online: isOnlineState(state) ? now : null,
      updated_at: now,
    });
    return;
  }

  if (previous.state === state) {
    return; // nada mudou — evita gravar no banco a cada polling
  }

  const wasOnline = isOnlineState(previous.state);
  const isOnline = isOnlineState(state);
  if (wasOnline && !isOnline) {
    insertEventStmt.run(number, 'went_offline', now);
  } else if (!wasOnline && isOnline) {
    insertEventStmt.run(number, 'went_online', now);
  }

  upsertLastSeenStmt.run({
    number, name, state,
    last_seen_online: isOnline ? now : null,
    updated_at: now,
  });
}

export function getLastSeenOnline(number) {
  const row = selectOneStmt.get(number);
  if (!row || !row.last_seen_online) return null;
  return new Date(row.last_seen_online).getTime();
}

export function getDowntimeEvents(number, limit = 20) {
  return selectEventsStmt.all(number, limit);
}

export function getOfflineCountSince(number, sinceIso) {
  return countOfflineSinceStmt.get(number, sinceIso).n;
}

export function getAllKnownStates() {
  return selectAllStmt.all().map((row) => ({
    number: row.number,
    state: row.state,
    name: row.name,
    lastSeenOnline: row.last_seen_online,
    updatedAt: row.updated_at,
  }));
}
