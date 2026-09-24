import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/sqlite.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { logAction } from '../services/auditService.js';
import { lockoutMinutesLeft, recordLoginFailure, recordLoginSuccess } from '../services/loginLockoutService.js';

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const { username, password } = req.body || {};
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
  res.json({ username: req.user.username, displayName: req.user.displayName, role: req.user.role });
});
