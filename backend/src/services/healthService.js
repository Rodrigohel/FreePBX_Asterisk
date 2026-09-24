import si from 'systeminformation';
import os from 'node:os';
import { amiClient } from '../ami/amiClient.js';
import { getCdrPool } from './cdrClient.js';
import { config } from '../config.js';
import { db } from '../db/sqlite.js';
import { mockServerHealth, mockHealthHistory } from './mockData.js';

export async function getServerHealth() {
  if (config.forceMock) {
    return { ...mockServerHealth(), source: 'mock' };
  }

  try {
    const [cpuLoad, mem, disks, time] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.time(),
    ]);
    const [loadAvg1min] = os.loadavg();

    const mainDisk = disks.reduce((a, b) => (b.size > (a?.size || 0) ? b : a), disks[0]);
    const diskPercent = mainDisk ? Math.round(mainDisk.use) : 0;
    const memoryPercent = Math.round((mem.active / mem.total) * 100);

    let cdrOk = false;
    try {
      await getCdrPool();
      cdrOk = true;
    } catch {
      cdrOk = false;
    }

    const services = [
      { name: 'Asterisk', ok: amiClient.isConnected() },
      { name: 'Banco de dados', ok: cdrOk },
      { name: 'Servidor web', ok: true },
      { name: 'Painel (backend)', ok: true },
    ];

    return {
      cpuPercent: Math.round(cpuLoad.currentLoad),
      memoryPercent,
      diskPercent,
      loadAverage: Number(loadAvg1min.toFixed(2)),
      uptimeSeconds: Math.round(time.uptime),
      services,
      source: 'system',
    };
  } catch (err) {
    return { ...mockServerHealth(), source: 'mock', error: err.message };
  }
}

const insertHealthSampleStmt = db.prepare(`
  INSERT INTO server_health_history (at, cpu_percent, memory_percent, disk_percent, load_average)
  VALUES (?, ?, ?, ?, ?)
`);
const pruneHealthHistoryStmt = db.prepare(`DELETE FROM server_health_history WHERE at < ?`);
const selectHealthHistoryStmt = db.prepare(`
  SELECT at, cpu_percent, memory_percent, disk_percent, load_average
  FROM server_health_history
  WHERE at >= ?
  ORDER BY at ASC
`);

// Só grava amostra quando os dados são reais (source 'system') — em modo
// mock ou quando a coleta falha, gravar geraria histórico com dados
// simulados/zerados misturado com dados de verdade.
async function recordHealthSample() {
  const health = await getServerHealth();
  if (health.source !== 'system') return;
  insertHealthSampleStmt.run(
    new Date().toISOString(), health.cpuPercent, health.memoryPercent, health.diskPercent, health.loadAverage
  );
  // Retenção de 30 dias — amostrando a cada 5min isso é só ~8600 linhas,
  // mas não precisa guardar pra sempre.
  pruneHealthHistoryStmt.run(new Date(Date.now() - 30 * 86400000).toISOString());
}

const HEALTH_SAMPLE_INTERVAL_MS = 5 * 60 * 1000;

// Mesmo padrão de scheduleAlertChecks: roda já na subida (não espera o
// primeiro intervalo) e reagenda a si mesmo com setTimeout só depois que a
// rodada anterior termina.
export function scheduleHealthSampling() {
  async function run() {
    try {
      await recordHealthSample();
    } catch (err) {
      console.error('[health] erro ao registrar amostra:', err && err.message ? err.message : err);
    } finally {
      setTimeout(run, HEALTH_SAMPLE_INTERVAL_MS);
    }
  }
  run();
}

export async function getHealthHistory({ hours = 24 } = {}) {
  const windowHours = Number(hours) > 0 ? Number(hours) : 24;

  if (config.forceMock) {
    return { data: mockHealthHistory(windowHours), source: 'mock' };
  }

  const sinceIso = new Date(Date.now() - windowHours * 3600000).toISOString();
  const rows = selectHealthHistoryStmt.all(sinceIso);
  return {
    data: rows.map((r) => ({
      at: r.at, cpuPercent: r.cpu_percent, memoryPercent: r.memory_percent, diskPercent: r.disk_percent, loadAverage: r.load_average,
    })),
    source: 'db',
  };
}
