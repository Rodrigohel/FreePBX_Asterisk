import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/sqlite.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { logAction } from '../services/auditService.js';
import { lockoutMinutesLeft, recordLoginFailure, recordLoginSuccess } from '../services/loginLockoutService.js';
import { generateSecret, verifyToken, buildOtpauthUri, generateRecoveryCodes } from '../services/totp.js';
import { getTotpUser, verifyUserCode, enableTotp, resetTotp } from '../services/totpAccountService.js';

const ISSUER = 'PBX Dashboard';
const TOTP_TOKEN_EXPIRES_IN = '5m';

export const authRouter = Router();

function issueAccessToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, displayName: user.display_name, role: user.role },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn }
  );
}

// Primeira etapa: usuário + senha. Se a conta não tem 2FA, já emite o token
// de acesso normal, como sempre. Se tem, ainda NÃO emite token de sessão —
// só um JWT de curta duração (5 min) com purpose:'totp-pending', que só
// serve pra completar o login em POST /login/totp. Essa etapa não conta
// pro bloqueio de força bruta (nem sucesso nem falha) — é neutra, quem
// decide sucesso/falha de verdade é a senha (aqui embaixo) e o código
// (em /login/totp).
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

  if (user.totp_enabled) {
    const totpToken = jwt.sign({ sub: user.id, purpose: 'totp-pending' }, config.auth.jwtSecret, { expiresIn: TOTP_TOKEN_EXPIRES_IN });
    return res.json({ requiresTotp: true, totpToken });
  }

  recordLoginSuccess(user.username);
  const token = issueAccessToken(user);
  logAction(user.username, 'auth.login', null);
  res.json({ token, user: { username: user.username, displayName: user.display_name, role: user.role } });
});

// Segunda etapa (só quando a conta tem 2FA): valida o totpToken de curta
// duração da primeira etapa, depois o código (TOTP de 6 dígitos ou um
// código de recuperação). Usa o mesmo contador de bloqueio por força bruta
// do login normal (mesma chave: o username) — sem isso, um código de 6
// dígitos (1 milhão de combinações) ficaria exposto a tentativa e erro sem
// limite.
authRouter.post('/login/totp', (req, res) => {
  const { totpToken, code } = req.body || {};
  if (!totpToken || !code) {
    return res.status(400).json({ error: 'Informe o código.' });
  }

  let payload;
  try {
    payload = jwt.verify(totpToken, config.auth.jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Sessão expirada, comece de novo.' });
  }
  if (payload.purpose !== 'totp-pending') {
    return res.status(401).json({ error: 'Sessão expirada, comece de novo.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
  if (!user || !user.totp_enabled) {
    return res.status(401).json({ error: 'Sessão expirada, comece de novo.' });
  }

  const minutesLeft = lockoutMinutesLeft(user.username);
  if (minutesLeft > 0) {
    return res.status(429).json({ error: `Muitas tentativas erradas. Tente de novo em ${minutesLeft} minuto${minutesLeft > 1 ? 's' : ''}.` });
  }

  if (!verifyUserCode(user, code)) {
    const justLocked = recordLoginFailure(user.username);
    if (justLocked) logAction(user.username, 'auth.lockout', null);
    return res.status(401).json({ error: 'Código inválido.' });
  }

  recordLoginSuccess(user.username);
  const token = issueAccessToken(user);
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
// usuário liga/desliga o seu. Um admin pode desativar o 2FA de OUTRO
// usuário (ver /api/users/:id/totp-disable), mas nunca ativar em nome dele
// — só o próprio dono ativa o dele.
authRouter.post('/totp/setup', requireAuth, (req, res) => {
  const secret = generateSecret();
  const otpauthUri = buildOtpauthUri({ secret, username: req.user.username, issuer: ISSUER });
  res.json({ secret, otpauthUri });
});

authRouter.post('/totp/enable', requireAuth, (req, res) => {
  const { secret, code } = req.body || {};
  if (!secret || !code) return res.status(400).json({ error: 'Informe o código gerado pelo app.' });
  if (!verifyToken(secret, code)) {
    return res.status(400).json({ error: 'Código inválido. Confira o horário do celular e tente de novo.' });
  }
  const recoveryCodes = generateRecoveryCodes();
  enableTotp(req.user.sub, secret, recoveryCodes);
  logAction(req.user.username, '2fa.enabled', null);
  res.json({ recoveryCodes });
});

authRouter.post('/totp/disable', requireAuth, (req, res) => {
  const { code } = req.body || {};
  const user = getTotpUser(req.user.sub);
  if (!user?.totp_enabled) return res.status(400).json({ error: 'A verificação em duas etapas não está ativada.' });
  if (!verifyUserCode(user, code)) {
    // 403, não 401: o usuário ESTÁ autenticado (tem uma sessão válida), só
    // errou o código de confirmação. Um 401 aqui seria indistinguível de
    // "sessão expirada" pro frontend, que reage a qualquer 401 fora das
    // rotas de login limpando o token guardado — errar o código deslogaria
    // a pessoa no meio do fluxo de desativação.
    return res.status(403).json({ error: 'Código inválido.' });
  }
  resetTotp(req.user.sub);
  logAction(req.user.username, '2fa.disabled', null);
  res.json({ ok: true });
});
