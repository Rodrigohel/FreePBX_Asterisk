/**
 * Cache em memória do último estado conhecido de cada ramal.
 * Usado para:
 *  - calcular "última atividade" quando o ramal está offline;
 *  - alimentar o AlertsService (ramal offline há muito tempo).
 */
const lastSeenOnline = new Map(); // number -> timestamp (ms)
const lastKnownState = new Map(); // number -> { state, name, updatedAt }

export function recordExtensionState(number, state, name) {
  const now = Date.now();
  lastKnownState.set(number, { state, name, updatedAt: now });
  if (state !== 'offline') {
    lastSeenOnline.set(number, now);
  }
}

export function getLastSeenOnline(number) {
  return lastSeenOnline.get(number) ?? null;
}

export function getAllKnownStates() {
  return Array.from(lastKnownState.entries()).map(([number, v]) => ({ number, ...v }));
}
