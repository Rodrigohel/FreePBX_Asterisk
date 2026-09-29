// Lê (e permite desbanir) os IPs bloqueados no servidor: fail2ban (bloqueio
// automático por jail) e regras manuais de firewall via iptables. Roda
// comandos do sistema com `execFile` (nunca `exec`/shell) — os argumentos
// vão como array, então uma jail/IP maliciosa não vira injeção de comando.
//
// Precisa de uma regra de sudo bem restrita pro usuário que roda o backend
// (ver README, seção "Bloqueios de segurança") — sem ela, o painel mostra
// `available:false` com o erro exato, em vez de quebrar.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { mockBlockedIps } from './mockData.js';

const execFileAsync = promisify(execFile);

const JAIL_NAME_RE = /^[\w.-]+$/;
const IP_RE = /^[0-9a-fA-F:.]+$/; // IPv4 e IPv6, checagem básica (validação de verdade é o próprio fail2ban/iptables recusando)

async function runSudo(bin, args) {
  const { stdout } = await execFileAsync('sudo', [bin, ...args], { timeout: 8000 });
  return stdout;
}

function parseJailList(statusOutput) {
  // Formato típico:
  //   Status
  //   |- Number of jail:      2
  //   `- Jail list:   sshd, asterisk-auth
  const line = statusOutput.split('\n').find((l) => l.includes('Jail list:'));
  if (!line) return [];
  const afterColon = line.split('Jail list:')[1] || '';
  return afterColon.split(',').map((j) => j.trim()).filter(Boolean);
}

function parseJailBans(statusOutput) {
  // `- Currently banned: 2
  //    `- IP list:   1.2.3.4 5.6.7.8
  const countLine = statusOutput.split('\n').find((l) => l.includes('Currently banned:'));
  const ipsLine = statusOutput.split('\n').find((l) => l.includes('IP list:'));
  const bannedCount = countLine ? Number((countLine.split('Currently banned:')[1] || '').trim()) || 0 : 0;
  const ips = ipsLine ? (ipsLine.split('IP list:')[1] || '').trim().split(/\s+/).filter(Boolean) : [];
  return { bannedCount, ips };
}

export async function getFail2banBans() {
  if (config.forceMock) return mockBlockedIps().fail2ban;

  try {
    const statusOut = await runSudo('fail2ban-client', ['status']);
    const jailNames = parseJailList(statusOut);
    const jails = await Promise.all(jailNames.map(async (jail) => {
      const jailOut = await runSudo('fail2ban-client', ['status', jail]);
      return { jail, ...parseJailBans(jailOut) };
    }));
    return { available: true, jails };
  } catch (err) {
    return { available: false, error: err.stderr?.trim() || err.message, jails: [] };
  }
}

export async function unbanFail2banIp(jail, ip) {
  if (!JAIL_NAME_RE.test(jail || '')) throw new Error('Nome de jail inválido.');
  if (!IP_RE.test(ip || '')) throw new Error('IP inválido.');

  if (config.forceMock) return mockBlockedIps().unbanFail2ban(jail, ip);

  try {
    await runSudo('fail2ban-client', ['set', jail, 'unbanip', ip]);
  } catch (err) {
    throw new Error(err.stderr?.trim() || err.message);
  }
}

// Regras de DROP/REJECT com IP de origem específico, direto na chain
// INPUT — fail2ban gerencia os IPs dele em chains próprias (f2b-<jail>),
// então isso aqui já são só bloqueios manuais (feitos via iptables/ufw
// direto), sem misturar com os do fail2ban.
function parseManualBlocks(iptablesOutput) {
  const rules = [];
  for (const raw of iptablesOutput.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('-A INPUT')) continue;
    const targetMatch = line.match(/-j (DROP|REJECT)\b/);
    const sourceMatch = line.match(/-s ([0-9a-fA-F:.\/]+)/);
    if (!targetMatch || !sourceMatch) continue;
    rules.push({ ip: sourceMatch[1].replace(/\/32$|\/128$/, ''), target: targetMatch[1], raw: line });
  }
  return rules;
}

export async function getManualFirewallBlocks() {
  if (config.forceMock) return mockBlockedIps().firewall;

  try {
    const out = await runSudo('iptables', ['-S', 'INPUT']);
    return { available: true, rules: parseManualBlocks(out) };
  } catch (err) {
    return { available: false, error: err.stderr?.trim() || err.message, rules: [] };
  }
}

export async function getBlockedIpsSnapshot() {
  const [fail2ban, firewall] = await Promise.all([getFail2banBans(), getManualFirewallBlocks()]);
  return { fail2ban, firewall };
}
