import { config } from '../config.js';
import { getSettings } from './settingsService.js';
import { getPeriodSummary } from './callsService.js';
import { sendTelegramMessage } from './telegramService.js';
import { daysAgoLocalStr } from '../utils/localDate.js';

function yesterdayIso() {
  return daysAgoLocalStr(1);
}

function formatDuration(seconds) {
  if (!seconds) return '0min';
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h${minutes > 0 ? ` ${minutes}min` : ''}` : `${minutes}min`;
}

function answeredRatePct(summary) {
  const total = (summary.received || 0) + (summary.made || 0);
  if (total === 0) return null;
  const answered = total - (summary.missed || 0) - (summary.failed || 0);
  return Math.round((answered / total) * 100);
}

function buildDigestMessage(summary, dateLabel) {
  const rate = answeredRatePct(summary);
  const lines = [
    `📋 Resumo de ${dateLabel}`,
    `Recebidas: ${summary.received} · Realizadas: ${summary.made}`,
    `Perdidas: ${summary.missed} · Com falha: ${summary.failed}`,
  ];
  if (rate !== null) lines.push(`Taxa de atendimento: ${rate}%`);
  lines.push(`Tempo total em chamada: ${formatDuration(summary.totalDurationSeconds)}`);
  return lines.join('\n');
}

export async function runDailyDigest() {
  if (config.forceMock) return;

  const settings = getSettings();
  if (settings.dailyDigestEnabled !== 'true') return;
  if (!settings.telegramBotToken || !settings.telegramChatId) return;

  const date = yesterdayIso();
  const summary = await getPeriodSummary({ from: date, to: date });
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  await sendTelegramMessage(buildDigestMessage(summary, dateLabel));
}

function msUntilNextRun(hour) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function currentDigestHour() {
  return Number(getSettings().dailyDigestHour) || 8;
}

// Mesmo padrão de scheduleAlertChecks/scheduleDailyBackup: reagenda a si
// mesmo com setTimeout. A hora é lida de novo a cada rodada (não fixada no
// início) porque, ao contrário do backup, é configurável em runtime pela
// tela de Configurações — mudar o horário lá tem efeito já na próxima
// rodada, sem precisar reiniciar o backend.
export function scheduleDailyDigest() {
  async function run() {
    try {
      await runDailyDigest();
    } catch (err) {
      console.error('[digest] erro ao enviar resumo diário:', err && err.message ? err.message : err);
    } finally {
      setTimeout(run, msUntilNextRun(currentDigestHour()));
    }
  }
  setTimeout(run, msUntilNextRun(currentDigestHour()));
}
