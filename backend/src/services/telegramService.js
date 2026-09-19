import { config } from '../config.js';

// Notificação de alertas via Telegram — opcional, só ativa se
// TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID estiverem definidos no .env.
export async function sendTelegramMessage(text) {
  const { botToken, chatId } = config.telegram;
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
