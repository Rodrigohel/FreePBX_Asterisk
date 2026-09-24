import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { db } from '../db/sqlite.js';

const ISSUER = 'PBX Dashboard';

const setPendingSecretStmt = db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?');
const enableStmt = db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?');
const disableStmt = db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?');
const getUserStmt = db.prepare('SELECT id, username, totp_secret, totp_enabled FROM users WHERE id = ?');

// Gera um segredo novo e salva como "pendente" (totp_enabled continua 0 até
// confirmToken validar um código de verdade — sem isso, um QR code escaneado
// errado deixaria a conta bloqueada no próximo login sem ninguém perceber).
export function startSetup(userId, username) {
  const secret = authenticator.generateSecret();
  setPendingSecretStmt.run(secret, userId);
  const otpauthUrl = authenticator.keyuri(username, ISSUER, secret);
  return { secret, otpauthUrl };
}

export async function generateQrCodeDataUrl(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl);
}

export function confirmSetup(userId, token) {
  const user = getUserStmt.get(userId);
  if (!user?.totp_secret) return false;
  const valid = authenticator.check(token, user.totp_secret);
  if (valid) enableStmt.run(userId);
  return valid;
}

export function disable(userId) {
  disableStmt.run(userId);
}

export function verifyLoginToken(secret, token) {
  return authenticator.check(token, secret);
}
