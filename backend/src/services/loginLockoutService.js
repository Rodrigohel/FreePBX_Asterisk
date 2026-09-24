// Proteção simples contra força bruta no login: depois de MAX_ATTEMPTS
// tentativas erradas seguidas pro mesmo usuário, bloqueia novas tentativas
// por LOCKOUT_MS. Em memória (não precisa sobreviver a reinício do backend
// — um restart "perdoar" um bloqueio em andamento não é uma regressão de
// segurança, é só um rate-limit). Só rastreia usuários que existem de
// verdade (o caller só chama isto depois de achar o usuário no banco) —
// isso limita o tamanho do Map ao número de contas cadastradas, em vez de
// crescer sem limite com nomes de usuário inventados por um atacante.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const attempts = new Map(); // username -> { count, lockedUntil }

// Minutos restantes de bloqueio (0 = não está bloqueado).
export function lockoutMinutesLeft(username) {
  const entry = attempts.get(username);
  if (!entry?.lockedUntil || Date.now() >= entry.lockedUntil) return 0;
  return Math.ceil((entry.lockedUntil - Date.now()) / 60000);
}

// Retorna true se essa falha acabou de disparar um bloqueio novo (pra quem
// chama decidir se registra isso no log de auditoria).
export function recordLoginFailure(username) {
  const entry = attempts.get(username) || { count: 0, lockedUntil: null };
  entry.count += 1;
  let justLocked = false;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
    entry.count = 0;
    justLocked = true;
  }
  attempts.set(username, entry);
  return justLocked;
}

export function recordLoginSuccess(username) {
  attempts.delete(username);
}
