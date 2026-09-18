import { amiClient } from '../ami/amiClient.js';
import { getPbxDbPool } from './pbxDbClient.js';
import { config } from '../config.js';
import { recordExtensionState } from './extensionState.js';
import { mockExtensions, mockExtensionsSummary } from './mockData.js';

// DeviceState do PJSIP -> estado usado pelo dashboard
function mapDeviceState(deviceState) {
  const s = (deviceState || '').toLowerCase();
  if (s.includes('unavailable') || s.includes('invalid')) return 'offline';
  if (s.includes('ringing')) return 'ringing';
  if (s.includes('busy') || s.includes('in use') || s.includes('on hold')) return 'in_call';
  if (s.includes('not in use')) return 'free';
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
    return { data: list, source: 'mock' };
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
      const lastActivity = state === 'offline'
        ? new Date().toISOString()
        : new Date().toISOString();
      return { number, name, state, lastActivity };
    });

    return { data: extensions, source: 'ami' };
  } catch (err) {
    const list = mockExtensions();
    return { data: list, source: 'mock', error: err.message };
  }
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
