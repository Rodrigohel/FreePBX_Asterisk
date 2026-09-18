import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  try {
    req.user = jwt.verify(token, config.auth.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}
