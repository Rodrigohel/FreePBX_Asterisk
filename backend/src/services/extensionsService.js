import { amiClient } from '../ami/amiClient.js';
import { getPbxDbPool } from './pbxDbClient.js';
import { config } from '../config.js';
import { recordExtensionState, getLastSeenOnline, getDowntimeEvents, getOfflineCountSince } from './extensionState.js';
import { isFavorite } from './favoritesService.js';
import { mockExtensions, mockExtensionsSummary } from './mockData.js';

// DeviceState do PJSIP -> estado usado pelo dashboard
// "not in use" precisa ser checado ANTES de "in use": a string "not in use"
// contém "in use" como substring, então a ordem antiga classificava todo
// ramal livre como "em ligação".
function mapDeviceState(deviceState) {
  const s = (deviceState || '').toLowerCase();
  if (s.includes('not in use')) return 'free';
  if (s.includes('unavailable') || s.includes('invalid')) return 'offline';
  if (s.includes('ringing')) return 'ringing';
  if (s.includes('busy') || s.includes('in use') || s.includes('on hold')) return 'in_call';
  return 'offline';
}

async function fetchExtensionNames(numbers) {
  const names = {};
  try {
    const pool = await getPbxDbPool();
    if (!pool || numbers.length === 0) return names;
    // Ajuste esta query ao schema real do seu FreePBX caso a tabela/colunas
    // sejam diferentes (varia entre versões: `users`, `sip`, `pjsip` etc).
    const placeholders = numbers.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT extension, name FROM users WHERE extension IN (${placeholders})`,
      numbers
    );
    for (const row of rows) {
      names[String(row.extension)] = row.name;
    }
  } catch {
    // fallback silencioso: nomes ficam "Ramal <número>"
  }
  return names;
}

export async function getExtensions() {
  if (config.forceMock || !amiClient.isConnected()) {
    const list = mockExtensions();
    list.forEach((e) => recordExtensionState(e.number, e.state, e.name));
    return { data: list.map((e) => ({ ...e, favorite: isFavorite(e.number) })), source: 'mock' };
  }

  try {
    const { events } = await amiClient.action({ Action: 'PJSIPShowEndpoints' }, 'EndpointList');
    const numbers = events.map((e) => e.objectname).filter(Boolean);
    const names = await fetchExtensionNames(numbers);

    const extensions = events.map((evt) => {
      const number = evt.objectname;
      const state = mapDeviceState(evt.devicestate);
      const name = names[number] || `Ramal ${number}`;
      recordExtensionState(number, state, name);
      // Para ramais offline, mostra desde quando (persistido); para os
      // demais, a última atividade é "agora" pois acabamos de confirmá-los.
      const lastSeenOnline = getLastSeenOnline(number);
      const lastActivity = state === 'offline' && lastSeenOnline
        ? new Date(lastSeenOnline).toISOString()
        : new Date().toISOString();
      return { number, name, state, lastActivity, favorite: isFavorite(number) };
    });

    return { data: extensions, source: 'ami' };
  } catch (err) {
    const list = mockExtensions();
    return { data: list.map((e) => ({ ...e, favorite: isFavorite(e.number) })), source: 'mock', error: err.message };
  }
}

export async function getExtensionDetail(number) {
  const { data } = await getExtensions();
  const ext = data.find((e) => e.number === number) || null;
  const lastSeenOnline = getLastSeenOnline(number);
  const since7days = new Date(Date.now() - 7 * 86400000).toISOString();

  return {
    extension: ext,
    offlineSince: ext && ext.state === 'offline' && lastSeenOnline ? new Date(lastSeenOnline).toISOString() : null,
    downtimeEvents: getDowntimeEvents(number, 20),
    offlineCount7d: getOfflineCountSince(number, since7days),
  };
}

export async function getExtensionsSummary() {
  const { data, source } = await getExtensions();
  if (source === 'mock') {
    return { ...mockExtensionsSummary(data), source };
  }
  const configured = data.length;
  const online = data.filter((e) => e.state !== 'offline').length;
  const offline = configured - online;
  return { configured, online, offline, source };
}
