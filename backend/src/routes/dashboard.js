import { Router } from 'express';
import { getStatus } from '../services/statusService.js';
import { getExtensions, getExtensionsSummary } from '../services/extensionsService.js';
import { getActiveCalls, getCallsSummary, getTodaySummary } from '../services/callsService.js';
import { getAlerts, getActiveAlertsCount } from '../services/alertsService.js';
import { getServerHealth } from '../services/healthService.js';

export const dashboardRouter = Router();

const alertsService = { getActiveAlertsCount };

dashboardRouter.get('/status', async (req, res) => {
  res.json(await getStatus(alertsService));
});

dashboardRouter.get('/extensions', async (req, res) => {
  const { data, source, error } = await getExtensions();
  res.json({ data, source, error });
});

dashboardRouter.get('/extensions/summary', async (req, res) => {
  res.json(await getExtensionsSummary());
});

dashboardRouter.get('/calls/active', async (req, res) => {
  const { data, source, error } = await getActiveCalls();
  res.json({ data, source, error });
});

dashboardRouter.get('/calls/summary', async (req, res) => {
  const range = ['today', '7d', '30d'].includes(req.query.range) ? req.query.range : 'today';
  res.json(await getCallsSummary(range));
});

dashboardRouter.get('/calls/today-summary', async (req, res) => {
  res.json(await getTodaySummary());
});

dashboardRouter.get('/alerts', async (req, res) => {
  const { data, source } = await getAlerts();
  res.json({ data, source });
});

dashboardRouter.get('/server/health', async (req, res) => {
  res.json(await getServerHealth());
});
