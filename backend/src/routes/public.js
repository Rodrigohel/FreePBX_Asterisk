import { Router } from 'express';
import { config } from '../config.js';
import { getStatus } from '../services/statusService.js';
import { getExtensions, getExtensionsSummary } from '../services/extensionsService.js';
import { getActiveCalls, getCallsSummary, getTodaySummary } from '../services/callsService.js';
import { getAlerts, getActiveAlertsCount } from '../services/alertsService.js';
import { getServerHealth } from '../services/healthService.js';
import { getSettings } from '../services/settingsService.js';

export const publicRouter = Router();

const alertsService = { getActiveAlertsCount };

// Nome da empresa/PBX e logo — usados no cabeçalho antes mesmo do login.
// Só o subconjunto de marca é público; limites de alerta e credenciais do
// Telegram (também guardados em `settings`) exigem login — ver GET /api/settings.
publicRouter.get('/settings', (req, res) => {
  const { companyName, pbxName, logoUrl } = getSettings();
  res.json({ companyName, pbxName, logoUrl });
});

/**
 * Um único payload agregando somente os cards ligados em config.public.cards
 * (ver .env: PUBLIC_SHOW_*). Nenhuma autenticação é exigida nesta rota —
 * qualquer card habilitado aqui fica visível para quem tiver o link.
 */
publicRouter.get('/dashboard', async (req, res) => {
  if (!config.public.enabled) {
    return res.status(404).json({ error: 'Painel público desativado' });
  }

  const cards = config.public.cards;
  const payload = { enabledCards: cards };

  if (cards.status) {
    payload.status = await getStatus(alertsService);
  }

  let extSummary = null;
  if (cards.extensionsSummary || cards.heroBanner || cards.extensionsList) {
    extSummary = await getExtensionsSummary();
    if (cards.extensionsSummary) payload.extensionsSummary = extSummary;
  }

  if (cards.extensionsList) {
    const { data } = await getExtensions();
    payload.extensions = data;
  }

  let activeCalls = null;
  if (cards.activeCallsCount || cards.heroBanner || cards.activeCallsList) {
    const { data } = await getActiveCalls();
    activeCalls = data;
    if (cards.activeCallsCount) payload.activeCallsCount = data.length;
    if (cards.activeCallsList) payload.activeCalls = data;
  }

  if (cards.activityChart) {
    const range = ['today', '7d', '30d'].includes(req.query.range) ? req.query.range : 'today';
    payload.trend = await getCallsSummary(range);
  }

  if (cards.todaySummary) {
    payload.todaySummary = await getTodaySummary();
  }

  let activeAlertsCount = 0;
  if (cards.alerts || cards.heroBanner) {
    const { data } = await getAlerts();
    activeAlertsCount = data.filter((a) => a.status === 'active').length;
    if (cards.alerts) payload.alerts = data;
  }

  if (cards.serverHealth) {
    payload.serverHealth = await getServerHealth();
  }

  if (cards.heroBanner) {
    payload.heroBanner = {
      extSummary: extSummary || { configured: 0, online: 0, offline: 0 },
      activeCallsCount: activeCalls ? activeCalls.length : 0,
      activeAlertsCount,
      overall: payload.status ? payload.status.overall : 'operational',
    };
  }

  res.json(payload);
});
