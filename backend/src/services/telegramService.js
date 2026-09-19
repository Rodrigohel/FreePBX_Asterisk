import { getSettings } from './settingsService.js';

// Notificação de alertas via Telegram — opcional, só ativa se o token e o
// chat_id estiverem configurados (tela de Configurações, ou TELEGRAM_BOT_TOKEN
// / TELEGRAM_CHAT_ID no .env como valor inicial).
export async function sendTelegramMessage(text) {
  const { telegramBotToken: botToken, telegramChatId: chatId } = getSettings();
  if (!botToken || !chatId) return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[telegram] falha ao enviar alerta:', res.status, body);
    }
  } catch (err) {
    console.error('[telegram] erro de rede ao enviar alerta:', err.message);
  }
}
