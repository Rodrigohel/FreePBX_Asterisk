import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/sqlite.js';
import { logAction } from '../services/auditService.js';

export const usersRouter = Router();

const VALID_ROLES = new Set(['admin', 'user']);

const listStmt = db.prepare('SELECT id, username, display_name, role, created_at, totp_enabled FROM users ORDER BY created_at ASC');
const findByUsernameStmt = db.prepare('SELECT id FROM users WHERE username = ?');
const findByIdStmt = db.prepare('SELECT id, username, totp_enabled FROM users WHERE id = ?');
const insertStmt = db.prepare('INSERT INTO users (username, display_name, password_hash, role) VALUES (?, ?, ?, ?)');
const deleteStmt = db.prepare('DELETE FROM users WHERE id = ?');
const countStmt = db.prepare('SELECT COUNT(*) AS n FROM users');

function rowToUser(row) {
  return { id: row.id, username: row.username, displayName: row.display_name, role: row.role, createdAt: row.created_at, totpEnabled: !!row.totp_enabled };
}

usersRouter.get('/', (req, res) => {
  res.json({ data: listStmt.all().map(rowToUser) });
});

usersRouter.post('/', (req, res) => {
  const { username, displayName, password, role } = req.body || {};
  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string') {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
  }
  const cleanUsername = username.trim();
  if (findByUsernameStmt.get(cleanUsername)) {
    return res.status(409).json({ error: 'Já existe um usuário com esse nome.' });
  }
  const cleanRole = VALID_ROLES.has(role) ? role : 'user';

  const passwordHash = bcrypt.hashSync(password, 10);
  const cleanDisplayName = (displayName || '').trim() || cleanUsername;
  const info = insertStmt.run(cleanUsername, cleanDisplayName, passwordHash, cleanRole);
  logAction(req.user.username, 'user.create', `criou @${cleanUsername} (${cleanRole})`);

  res.status(201).json(rowToUser({
    id: info.lastInsertRowid,
    username: cleanUsername,
    display_name: cleanDisplayName,
    role: cleanRole,
    created_at: new Date().toISOString(),
  }));
});

// Só administradores chegam até aqui (ver requireAdmin no server.js), então
// se sobrar 1 só admin, ele necessariamente é quem está tentando se
// autoexcluir — já barrado abaixo. Isso já garante que nunca fica sem
// nenhum admin, sem precisar de uma checagem extra de "último admin".
usersRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.sub) {
    return res.status(400).json({ error: 'Você não pode remover o usuário com o qual está logado agora.' });
  }
  if (countStmt.get().n <= 1) {
    return res.status(400).json({ error: 'Não é possível remover o último usuário do painel.' });
  }
  const target = db.prepare('SELECT username FROM users WHERE id = ?').get(id);
  deleteStmt.run(id);
  logAction(req.user.username, 'user.delete', target ? `removeu @${target.username}` : `removeu id=${id}`);
  res.json({ ok: true });
});

// Escape hatch pro admin: desativa o 2FA de outro usuário que ficou sem
// acesso ao app autenticador e aos códigos de recuperação. Nunca pede o
// código dele — é exatamente pra quando ele não tem mais como gerar um.
// Nunca existe o inverso (admin ativar 2FA em nome de alguém): isso só o
// próprio dono faz, em POST /api/auth/totp/enable.
usersRouter.post('/:id/totp-disable', (req, res) => {
  const target = findByIdStmt.get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });
  if (!target.totp_enabled) return res.status(400).json({ error: 'A verificação em duas etapas não está ativada para esse usuário.' });

  db.prepare("UPDATE users SET totp_secret = '', totp_enabled = 0, totp_recovery_codes = '[]' WHERE id = ?").run(req.params.id);
  logAction(req.user.username, '2fa.disabled', `desativou a verificação em duas etapas de @${target.username} (admin)`);
  res.json({ ok: true });
});
