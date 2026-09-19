import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { getSettings, setSettings } from '../services/settingsService.js';

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
    telegramBotToken, telegramChatId,
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

  if (typeof telegramBotToken === 'string') updates.telegramBotToken = telegramBotToken.trim();
  if (typeof telegramChatId === 'string') updates.telegramChatId = telegramChatId.trim();

  res.json(setSettings(updates));
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
    res.json(setSettings({ logoUrl }));
  });
});
