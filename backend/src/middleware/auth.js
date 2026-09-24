import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  try {
    const payload = jwt.verify(token, config.auth.jwtSecret);
    // O JWT de "totp-pending" (emitido só pra completar a segunda etapa do
    // login) tem um `purpose` diferente do token de sessão normal — mesmo
    // que vaze, não pode ser usado aqui como se fosse uma sessão de
    // verdade, senão alguém que só sabe a senha (sem o código do app
    // autenticador) conseguiria chamar rotas protegidas, inclusive
    // /totp/disable, sem nunca provar que tem o segundo fator.
    if (payload.purpose) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// Usa depois de requireAuth: bloqueia configurações e gestão de usuários
// para contas que não são administradoras.
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Apenas administradores podem fazer isso.' });
  }
  next();
}
