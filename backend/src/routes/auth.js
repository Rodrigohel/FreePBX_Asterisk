import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/sqlite.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { logAction } from '../services/auditService.js';
import { lockoutMinutesLeft, recordLoginFailure, recordLoginSuccess } from '../services/loginLockoutService.js';
import { startSetup, generateQrCodeDataUrl, confirmSetup, disable, verifyLoginToken } from '../services/twoFactorService.js';

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const { username, password, totpCode } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  // Checa o bloqueio ANTES do bcrypt.compareSync (que é proposital e lento)
  // — sem isso, um bloqueio não evitaria o custo de CPU de continuar
  // testando senhas, só a resposta de sucesso.
  if (user) {
    const minutesLeft = lockoutMinutesLeft(user.username);
    if (minutesLeft > 0) {
      return res.status(429).json({ error: `Muitas tentativas erradas. Tente de novo em ${minutesLeft} minuto${minutesLeft > 1 ? 's' : ''}.` });
    }
  }

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    if (user) {
      const justLocked = recordLoginFailure(user.username);
      if (justLocked) logAction(user.username, 'auth.lockout', null);
    }
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  // Segunda etapa (se o usuário tiver 2FA ativado): usuário e senha já
  // validados aqui em cima, só falta o código do app autenticador. Um
  // código errado conta pro mesmo contador de bloqueio de força bruta da
  // senha — sem isso, um código de 6 dígitos (1 milhão de combinações)
  // ficaria exposto a tentativa e erro sem limite.
  if (user.totp_enabled) {
    if (!totpCode) {
      return res.status(401).json({ error: 'Informe o código do app autenticador.', requiresTotp: true });
    }
    if (!verifyLoginToken(user.totp_secret, totpCode)) {
      const justLocked = recordLoginFailure(user.username);
      if (justLocked) logAction(user.username, 'auth.lockout', null);
      return res.status(401).json({ error: 'Código inválido.', requiresTotp: true });
    }
  }

  recordLoginSuccess(user.username);

  const token = jwt.sign(
    { sub: user.id, username: user.username, displayName: user.display_name, role: user.role },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn }
  );

  logAction(user.username, 'auth.login', null);
  res.json({ token, user: { username: user.username, displayName: user.display_name, role: user.role } });
});

authRouter.get('/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT totp_enabled FROM users WHERE id = ?').get(req.user.sub);
  res.json({
    username: req.user.username, displayName: req.user.displayName, role: req.user.role,
    totpEnabled: !!row?.totp_enabled,
  });
});

// Gestão de 2FA é sempre sobre a PRÓPRIA conta (req.user.sub) — cada
// usuário liga/desliga o seu, não existe endpoint pra admin mexer no 2FA
// de outra pessoa.
authRouter.post('/2fa/setup', requireAuth, async (req, res) => {
  const { secret, otpauthUrl } = startSetup(req.user.sub, req.user.username);
  const qrCodeDataUrl = await generateQrCodeDataUrl(otpauthUrl);
  res.json({ qrCodeDataUrl, secret });
});

authRouter.post('/2fa/confirm', requireAuth, (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Informe o código gerado pelo app.' });
  const ok = confirmSetup(req.user.sub, code);
  if (!ok) return res.status(400).json({ error: 'Código inválido. Confira o horário do celular e tente de novo.' });
  logAction(req.user.username, '2fa.enabled', null);
  res.json({ ok: true });
});

authRouter.post('/2fa/disable', requireAuth, (req, res) => {
  const { password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.sub);
  if (!user || !password || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(403).json({ error: 'Senha incorreta.' });
  }
  disable(req.user.sub);
  logAction(req.user.username, '2fa.disabled', null);
  res.json({ ok: true });
});
