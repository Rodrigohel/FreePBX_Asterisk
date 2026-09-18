import si from 'systeminformation';
import os from 'node:os';
import { amiClient } from '../ami/amiClient.js';
import { getCdrPool } from './cdrClient.js';
import { config } from '../config.js';
import { mockServerHealth } from './mockData.js';

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
