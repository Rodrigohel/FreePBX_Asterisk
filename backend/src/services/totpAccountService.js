// Camada entre as rotas e o banco pra tudo relacionado a 2FA de uma conta.
// Fica num lugar só pra ser reaproveitado por /login/totp, /totp/disable, a
// rota admin de "desativar 2FA de outro usuário" e o script de último
// recurso (resetTotp.js) — sem duplicar a lógica de verificar/consumir
// código de recuperação em cada um desses lugares.
import bcrypt from 'bcryptjs';
import { db } from '../db/sqlite.js';
import { verifyToken } from './totp.js';

const getStmt = db.prepare('SELECT id, username, display_name, role, totp_secret, totp_enabled, totp_recovery_codes FROM users WHERE id = ?');
const persistRecoveryCodesStmt = db.prepare('UPDATE users SET totp_recovery_codes = ? WHERE id = ?');
const enableStmt = db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 1, totp_recovery_codes = ? WHERE id = ?');
const resetStmt = db.prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0, totp_recovery_codes = NULL WHERE id = ?');

export function getTotpUser(userId) {
  return getStmt.get(userId);
}

// Verifica um código contra a conta: primeiro tenta como TOTP de 6 dígitos,
// senão tenta contra os códigos de recuperação salvos (hasheados com
// bcrypt). Se um código de recuperação bater, já remove ele da lista salva
// — é de uso único, quem chama não precisa lembrar de fazer essa limpeza.
export function verifyUserCode(user, code) {
  if (!user?.totp_enabled || !user.totp_secret || !code) return false;
  if (verifyToken(user.totp_secret, code)) return true;

  let hashes;
  try {
    hashes = JSON.parse(user.totp_recovery_codes || '[]');
  } catch {
    hashes = [];
  }
  const idx = hashes.findIndex((hash) => bcrypt.compareSync(String(code).trim(), hash));
  if (idx === -1) return false;

  hashes.splice(idx, 1);
  persistRecoveryCodesStmt.run(JSON.stringify(hashes), user.id);
  return true;
}

export function enableTotp(userId, secret, recoveryCodesPlain) {
  const hashes = recoveryCodesPlain.map((c) => bcrypt.hashSync(c, 10));
  enableStmt.run(secret, JSON.stringify(hashes), userId);
}

export function resetTotp(userId) {
  resetStmt.run(userId);
}
