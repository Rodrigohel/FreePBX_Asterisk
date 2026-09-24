// Último recurso pra destravar login com 2FA: roda direto no servidor
// (acesso ao arquivo/terminal, não ao app), pro caso de só existir 1 admin
// cadastrado e ele mesmo perder o celular e os códigos de recuperação — aí
// não sobra ninguém pra usar o escape hatch de POST /users/:id/totp-disable
// (que também exige estar logado como admin).
//
// Uso: node src/db/resetTotp.js <usuario>
import { db } from './sqlite.js';
import { resetTotp } from '../services/totpAccountService.js';

function main() {
  const username = process.argv[2];
  if (!username) {
    console.error('Uso: node src/db/resetTotp.js <usuario>');
    process.exit(1);
  }

  const user = db.prepare('SELECT id, totp_enabled FROM users WHERE username = ?').get(username);
  if (!user) {
    console.error(`Usuário "${username}" não encontrado.`);
    process.exit(1);
  }
  if (!user.totp_enabled) {
    console.log(`Usuário "${username}" já está com a verificação em duas etapas desativada.`);
    process.exit(0);
  }

  resetTotp(user.id);
  console.log(`Verificação em duas etapas desativada para o usuário "${username}".`);
  process.exit(0);
}

main();
