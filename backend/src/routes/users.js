import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/sqlite.js';

export const usersRouter = Router();

const listStmt = db.prepare('SELECT id, username, display_name, created_at FROM users ORDER BY created_at ASC');
const findByUsernameStmt = db.prepare('SELECT id FROM users WHERE username = ?');
const insertStmt = db.prepare('INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)');
const deleteStmt = db.prepare('DELETE FROM users WHERE id = ?');
const countStmt = db.prepare('SELECT COUNT(*) AS n FROM users');

function rowToUser(row) {
  return { id: row.id, username: row.username, displayName: row.display_name, createdAt: row.created_at };
}

usersRouter.get('/', (req, res) => {
  res.json({ data: listStmt.all().map(rowToUser) });
});

usersRouter.post('/', (req, res) => {
  const { username, displayName, password } = req.body || {};
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

  const passwordHash = bcrypt.hashSync(password, 10);
  const cleanDisplayName = (displayName || '').trim() || cleanUsername;
  const info = insertStmt.run(cleanUsername, cleanDisplayName, passwordHash);

  res.status(201).json(rowToUser({
    id: info.lastInsertRowid,
    username: cleanUsername,
    display_name: cleanDisplayName,
    created_at: new Date().toISOString(),
  }));
});

usersRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.sub) {
    return res.status(400).json({ error: 'Você não pode remover o usuário com o qual está logado agora.' });
  }
  if (countStmt.get().n <= 1) {
    return res.status(400).json({ error: 'Não é possível remover o último usuário do painel.' });
  }
  deleteStmt.run(id);
  res.json({ ok: true });
});
