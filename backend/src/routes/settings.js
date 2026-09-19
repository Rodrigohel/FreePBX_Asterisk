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
  const { companyName, pbxName } = req.body || {};
  const updates = {};
  if (typeof companyName === 'string' && companyName.trim()) updates.companyName = companyName.trim();
  if (typeof pbxName === 'string' && pbxName.trim()) updates.pbxName = pbxName.trim();
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
    const logoUrl = `/uploads/${req.file.filename}`;
    res.json(setSettings({ logoUrl }));
  });
});
