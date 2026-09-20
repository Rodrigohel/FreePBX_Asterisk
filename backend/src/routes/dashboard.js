import { Router } from 'express';
import { getStatus } from '../services/statusService.js';
import { getExtensions, getExtensionsSummary, getExtensionDetail } from '../services/extensionsService.js';
import { getDowntimeReport } from '../services/extensionState.js';
import { getActiveCalls, getCallsSummary, getTodaySummary, getDaySummary, getExtensionCallsToday, searchCallHistory, exportCallHistory, getMissedCallsToday } from '../services/callsService.js';
import { getAlerts, getActiveAlertsCount } from '../services/alertsService.js';
import { getServerHealth } from '../services/healthService.js';
import { getFavoriteNumbers, addFavorite, removeFavorite } from '../services/favoritesService.js';

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

dashboardRouter.get('/extensions/favorites', (req, res) => {
  res.json({ data: getFavoriteNumbers() });
});

dashboardRouter.post('/extensions/:number/favorite', (req, res) => {
  addFavorite(req.params.number);
  res.json({ ok: true });
});

dashboardRouter.delete('/extensions/:number/favorite', (req, res) => {
  removeFavorite(req.params.number);
  res.json({ ok: true });
});

dashboardRouter.get('/extensions/:number', async (req, res) => {
  const [detail, callsToday] = await Promise.all([
    getExtensionDetail(req.params.number),
    getExtensionCallsToday(req.params.number),
  ]);
  res.json({ ...detail, callsToday: callsToday.data });
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
  const { date } = req.query;
  res.json(date ? await getDaySummary(date) : await getTodaySummary());
});

dashboardRouter.get('/calls/history', async (req, res) => {
  const { q, from, to, page, pageSize } = req.query;
  res.json(await searchCallHistory({ q, from, to, page, pageSize }));
});

dashboardRouter.get('/calls/history/export', async (req, res) => {
  const { q, from, to } = req.query;
  res.json(await exportCallHistory({ q, from, to }));
});

dashboardRouter.get('/calls/missed-today', async (req, res) => {
  res.json(await getMissedCallsToday());
});

dashboardRouter.get('/extensions/failures/report', (req, res) => {
  const { from, to } = req.query;
  res.json({ data: getDowntimeReport({ from, to }) });
});

dashboardRouter.get('/alerts', async (req, res) => {
  const { data, source } = await getAlerts();
  res.json({ data, source });
});

dashboardRouter.get('/server/health', async (req, res) => {
  res.json(await getServerHealth());
});
