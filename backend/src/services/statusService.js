import { amiClient } from '../ami/amiClient.js';
import { config } from '../config.js';
import { mockStatus } from './mockData.js';

export async function getStatus(alertsService) {
  if (config.forceMock || !amiClient.isConnected()) {
    return mockStatus();
  }

  const activeAlerts = alertsService ? await alertsService.getActiveAlertsCount() : 0;
  const overall = activeAlerts > 0 ? 'degraded' : 'operational';

  return {
    demoMode: false,
    overall,
    label: overall === 'operational' ? 'Operacional' : 'Degradado',
    connection: { connected: true, label: 'Conectado' },
    lastUpdate: new Date().toISOString(),
  };
}
