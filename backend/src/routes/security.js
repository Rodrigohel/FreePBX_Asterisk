import { Router } from 'express';
import { logAction } from '../services/auditService.js';
import { getBlockedIpsSnapshot, unbanFail2banIp } from '../services/blockedIpsService.js';

export const securityRouter = Router();

securityRouter.get('/blocked-ips', async (req, res) => {
  const snapshot = await getBlockedIpsSnapshot();
  res.json(snapshot);
});

securityRouter.post('/blocked-ips/unban', async (req, res) => {
  const { jail, ip } = req.body || {};
  if (!jail || !ip) return res.status(400).json({ error: 'Jail e IP são obrigatórios.' });

  try {
    await unbanFail2banIp(jail, ip);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  logAction(req.user.username, 'firewall.unban', `desbaniu ${ip} do jail "${jail}"`);
  res.json({ ok: true });
});
