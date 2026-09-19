import 'dotenv/config';

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

export const config = {
  port: Number(process.env.PORT || 3001),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  ami: {
    host: process.env.AMI_HOST || '127.0.0.1',
    port: Number(process.env.AMI_PORT || 5038),
    user: process.env.AMI_USER || 'dashboard',
    password: process.env.AMI_PASSWORD || '',
  },

  cdr: {
    host: process.env.CDR_HOST || '127.0.0.1',
    port: Number(process.env.CDR_PORT || 3306),
    database: process.env.CDR_DATABASE || 'asteriskcdrdb',
    user: process.env.CDR_USER || 'freepbxuser',
    password: process.env.CDR_PASSWORD || '',
  },

  // Opcional: banco `asterisk` (não o de CDR) só para resolver nome amigável do ramal.
  pbxDb: {
    host: process.env.PBX_DB_HOST || '',
    port: Number(process.env.PBX_DB_PORT || 3306),
    database: process.env.PBX_DB_DATABASE || 'asterisk',
    user: process.env.PBX_DB_USER || 'freepbxuser',
    password: process.env.PBX_DB_PASSWORD || '',
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    sqlitePath: process.env.SQLITE_PATH || './data/dashboard.db',
  },

  forceMock: bool(process.env.FORCE_MOCK, false),

  alerts: {
    extensionOfflineMinutes: Number(process.env.ALERT_EXTENSION_OFFLINE_MINUTES || 120),
    diskUsagePercent: Number(process.env.ALERT_DISK_USAGE_PERCENT || 80),
  },

  // Opcional: notificação de alertas via Telegram. Deixe em branco pra
  // desativar (o painel continua funcionando normalmente sem isso).
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },

  monitorIntervalMs: Number(process.env.MONITOR_INTERVAL_MS || 15000),

  // Painel público (sem login): cada card pode ser ligado/desligado
  // independentemente. Pense com cuidado antes de ligar os marcados como
  // "dados sensíveis" — eles ficam visíveis para qualquer pessoa com o link,
  // sem autenticação.
  public: {
    enabled: bool(process.env.PUBLIC_DASHBOARD_ENABLED, true),
    cards: {
      status: bool(process.env.PUBLIC_SHOW_STATUS, true),
      heroBanner: bool(process.env.PUBLIC_SHOW_HERO_BANNER, true),
      extensionsSummary: bool(process.env.PUBLIC_SHOW_EXTENSIONS_SUMMARY, true),
      // dados sensíveis: mostra nome de cada ramal
      extensionsList: bool(process.env.PUBLIC_SHOW_EXTENSIONS_LIST, false),
      activeCallsCount: bool(process.env.PUBLIC_SHOW_ACTIVE_CALLS_COUNT, true),
      // dados sensíveis: mostra números/nomes de quem está ligando
      activeCallsList: bool(process.env.PUBLIC_SHOW_ACTIVE_CALLS_LIST, false),
      activityChart: bool(process.env.PUBLIC_SHOW_ACTIVITY_CHART, true),
      todaySummary: bool(process.env.PUBLIC_SHOW_TODAY_SUMMARY, false),
      // dados sensíveis: mensagens de alerta podem revelar detalhes internos
      alerts: bool(process.env.PUBLIC_SHOW_ALERTS, false),
      // dados sensíveis: detalhes de infraestrutura do servidor
      serverHealth: bool(process.env.PUBLIC_SHOW_SERVER_HEALTH, false),
    },
  },
};
