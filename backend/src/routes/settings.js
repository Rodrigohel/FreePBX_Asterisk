import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { getSettings, setSettings } from '../services/settingsService.js';
import { sendTelegramMessageWith } from '../services/telegramService.js';
import { logAction, getAuditLog } from '../services/auditService.js';

export const settingsRouter = Router();

const uploadsDir = path.resolve('data/uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `logo${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Envie um arquivo de imagem (PNG, JPG ou SVG).'));
      return;
    }
    cb(null, true);
  },
});

settingsRouter.get('/', (req, res) => {
  res.json(getSettings());
});

settingsRouter.put('/', (req, res) => {
  const {
    companyName, pbxName, alertExtensionOfflineMinutes, alertDiskUsagePercent, alertReminderIntervalMinutes,
    slaThresholdMinutesPerMonth, porteiroExtensions, telegramBotToken, telegramChatId,
    dailyDigestEnabled, dailyDigestHour,
  } = req.body || {};
  const updates = {};

  if (typeof companyName === 'string' && companyName.trim()) updates.companyName = companyName.trim();
  if (typeof pbxName === 'string' && pbxName.trim()) updates.pbxName = pbxName.trim();

  if (alertExtensionOfflineMinutes !== undefined) {
    const n = Number(alertExtensionOfflineMinutes);
    if (!Number.isFinite(n) || n <= 0) {
      return res.status(400).json({ error: 'Tempo offline deve ser um número positivo de minutos.' });
    }
    updates.alertExtensionOfflineMinutes = n;
  }

  if (alertDiskUsagePercent !== undefined) {
    const n = Number(alertDiskUsagePercent);
    if (!Number.isFinite(n) || n <= 0 || n > 100) {
      return res.status(400).json({ error: 'Uso de disco deve ser uma porcentagem entre 1 e 100.' });
    }
    updates.alertDiskUsagePercent = n;
  }

  if (alertReminderIntervalMinutes !== undefined) {
    const n = Number(alertReminderIntervalMinutes);
    if (!Number.isFinite(n) || n < 0) {
      return res.status(400).json({ error: 'Intervalo de lembrete deve ser um número de minutos (0 desativa).' });
    }
    updates.alertReminderIntervalMinutes = n;
  }

  if (slaThresholdMinutesPerMonth !== undefined) {
    const n = Number(slaThresholdMinutesPerMonth);
    if (!Number.isFinite(n) || n < 0) {
      return res.status(400).json({ error: 'Limite de SLA deve ser um número de minutos (0 desativa).' });
    }
    updates.slaThresholdMinutesPerMonth = n;
  }

  if (typeof porteiroExtensions === 'string') {
    const numbers = porteiroExtensions.split(',').map((n) => n.trim()).filter(Boolean);
    if (numbers.some((n) => !/^\d+$/.test(n))) {
      return res.status(400).json({ error: 'Ramais da portaria devem ser números separados por vírgula (ex.: 993,994,995).' });
    }
    updates.porteiroExtensions = numbers.join(',');
  }

  if (typeof telegramBotToken === 'string') updates.telegramBotToken = telegramBotToken.trim();
  if (typeof telegramChatId === 'string') updates.telegramChatId = telegramChatId.trim();

  if (dailyDigestEnabled !== undefined) updates.dailyDigestEnabled = dailyDigestEnabled ? 'true' : 'false';

  if (dailyDigestHour !== undefined) {
    const n = Number(dailyDigestHour);
    if (!Number.isFinite(n) || n < 0 || n > 23) {
      return res.status(400).json({ error: 'Hora do resumo diário deve ser um número entre 0 e 23.' });
    }
    updates.dailyDigestHour = n;
  }

  const updated = setSettings(updates);
  // Loga só os nomes dos campos alterados, nunca os valores — evita gravar
  // segredo (token do Telegram) em texto puro na trilha de auditoria.
  if (Object.keys(updates).length > 0) {
    logAction(req.user.username, 'settings.update', Object.keys(updates).join(', '));
  }
  res.json(updated);
});

settingsRouter.post('/telegram/test', async (req, res) => {
  const current = getSettings();
  const botToken = String(req.body?.telegramBotToken ?? current.telegramBotToken ?? '').trim();
  const chatId = String(req.body?.telegramChatId ?? current.telegramChatId ?? '').trim();

  if (!botToken || !chatId) {
    return res.status(400).json({ error: 'Preencha o Bot Token e o Chat ID antes de testar.' });
  }

  const result = await sendTelegramMessageWith(
    botToken, chatId,
    '🔔 Teste do painel PBX — se você recebeu esta mensagem, a notificação está configurada corretamente!',
  );
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ ok: true });
});

settingsRouter.post('/logo', (req, res) => {
  upload.single('logo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    const logoUrl = `/api/uploads/${req.file.filename}`;
    const updated = setSettings({ logoUrl });
    logAction(req.user.username, 'settings.logo_upload', req.file.filename);
    res.json(updated);
  });
});

settingsRouter.get('/audit-log', (req, res) => {
  const { limit, q, action, from, to } = req.query;
  res.json({ data: getAuditLog({ limit, q, action, from, to }) });
});
