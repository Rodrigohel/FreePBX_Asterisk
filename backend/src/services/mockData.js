/**
 * Dados simulados usados como fallback quando o AMI/CDR não está disponível
 * (ex.: ambiente de desenvolvimento do frontend sem um PBX real). Mantêm
 * exatamente a mesma forma (mesmos campos) que os dados reais, para que o
 * frontend não precise saber a diferença.
 */

export function mockStatus() {
  return {
    demoMode: true,
    overall: 'operational', // operational | degraded | offline
    label: 'Operacional',
    connection: { connected: true, label: 'Conectado' },
    lastUpdate: new Date().toISOString(),
  };
}

export function mockExtensions() {
  return [
    { number: '1001', name: 'Recepção', state: 'free', lastActivity: new Date().toISOString() },
    { number: '1002', name: 'Financeiro', state: 'in_call', lastActivity: new Date().toISOString() },
    { number: '1003', name: 'Suporte', state: 'ringing', lastActivity: new Date().toISOString() },
    { number: '1004', name: 'Diretoria', state: 'offline', lastActivity: new Date(Date.now() - 2 * 3600e3).toISOString() },
    { number: '1005', name: 'Vendas', state: 'free', lastActivity: new Date(Date.now() - 11 * 60e3).toISOString() },
  ];
}

export function mockExtensionsSummary(extensions) {
  const list = extensions ?? mockExtensions();
  return {
    configured: 17,
    online: list.filter((e) => e.state !== 'offline').length + 8,
    offline: list.filter((e) => e.state === 'offline').length + 3,
  };
}

export function mockActiveCalls() {
  return [
    { ext: '1002', name: 'Financeiro', destination: '(11) 98221-4400', direction: 'outbound', state: 'in_progress', durationSeconds: 252 },
    { ext: '1003', name: 'Suporte', destination: 'Ramal 1008', direction: 'inbound', state: 'ringing', durationSeconds: 4 },
    { ext: '1006', name: 'Cobrança', destination: '(21) 3355-1290', direction: 'outbound', state: 'in_progress', durationSeconds: 107 },
  ];
}

const TREND_MOCK = {
  today: { categories: ['08h', '10h', '12h', '14h', '16h', '18h', '20h'], recebidas: [4, 9, 14, 18, 12, 8, 3], realizadas: [3, 7, 10, 13, 9, 6, 2], perdidas: [0, 1, 2, 1, 1, 0, 0], falhas: [0, 0, 1, 0, 1, 0, 0] },
  '7d': { categories: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'], recebidas: [62, 71, 68, 75, 80, 22, 10], realizadas: [48, 53, 50, 58, 61, 15, 8], perdidas: [4, 3, 5, 2, 4, 1, 0], falhas: [1, 0, 2, 1, 1, 0, 0] },
  '30d': { categories: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'], recebidas: [410, 455, 398, 470], realizadas: [312, 340, 301, 355], perdidas: [18, 22, 15, 20], falhas: [4, 6, 3, 5] },
};

export function mockCallsSummary(range) {
  return TREND_MOCK[range] ?? TREND_MOCK.today;
}

export function mockTodaySummary() {
  return {
    received: 128,
    made: 96,
    missed: 7,
    failed: 2,
    avgDurationSeconds: 192,
    totalDurationSeconds: 20520,
    mostUsedExtension: '1002',
  };
}

export function mockAlerts() {
  const now = Date.now();
  return [
    { id: 'a1', severity: 'critical', message: 'Ramal 1004 offline há mais de 2 horas', createdAt: new Date(now - 3 * 3600e3).toISOString(), status: 'active' },
    { id: 'a2', severity: 'warning', message: 'Uso de disco acima de 80%', createdAt: new Date(now - 5 * 3600e3).toISOString(), status: 'active' },
    { id: 'a3', severity: 'info', message: 'Backup diário concluído com sucesso', createdAt: new Date(now - 12 * 3600e3).toISOString(), status: 'resolved' },
    { id: 'a4', severity: 'resolved', message: 'Reconexão com o servidor Asterisk restabelecida', createdAt: new Date(now - 24 * 3600e3).toISOString(), status: 'resolved' },
  ];
}

export function mockServerHealth() {
  return {
    cpuPercent: 34,
    memoryPercent: 61,
    diskPercent: 48,
    loadAverage: 0.82,
    uptimeSeconds: 14 * 86400 + 6 * 3600,
    services: [
      { name: 'Asterisk', ok: true },
      { name: 'Banco de dados', ok: true },
      { name: 'Servidor web', ok: true },
      { name: 'Painel (backend)', ok: true },
    ],
  };
}
