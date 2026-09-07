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

  monitorIntervalMs: Number(process.env.MONITOR_INTERVAL_MS || 15000),
};
