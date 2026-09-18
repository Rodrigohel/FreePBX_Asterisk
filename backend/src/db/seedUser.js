import bcrypt from 'bcryptjs';
import readline from 'node:readline';
import { db } from './sqlite.js';

/**
 * Cria (ou atualiza a senha de) um usuário do painel.
 * Uso: node src/db/seedUser.js
 * (funciona tanto em terminal interativo quanto com stdin via pipe)
 */
function promptLines(questions) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answers = [];
    let i = 0;
    rl.setPrompt('');
    rl.question(`${questions[i]}: `, function onAnswer(answer) {
      answers.push(answer.trim());
      i += 1;
      if (i < questions.length) {
        rl.question(`${questions[i]}: `, onAnswer);
      } else {
        rl.close();
        resolve(answers);
      }
    });
  });
}

async function main() {
  const [username, displayName, password] = await promptLines([
    'Usuário (login)',
    'Nome de exibição (ex.: Renata M.)',
    'Senha',
  ]);

  if (!username || !password) {
    console.error('Usuário e senha são obrigatórios.');
    process.exit(1);
  }

  const hash = bcrypt.hashSync(password, 10);
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

  if (existing) {
    db.prepare('UPDATE users SET password_hash = ?, display_name = ? WHERE username = ?').run(hash, displayName || username, username);
    console.log(`Senha atualizada para o usuário "${username}".`);
  } else {
    db.prepare('INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)').run(username, displayName || username, hash);
    console.log(`Usuário "${username}" criado.`);
  }
  process.exit(0);
}

main();
