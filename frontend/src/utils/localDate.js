// Mesmo motivo do backend (ver backend/src/utils/localDate.js):
// `toISOString()` sempre devolve a data em UTC, mesmo no fuso horário local
// do navegador — usar isso pra "hoje"/"ontem" ou pros filtros de data
// padrão dos painéis faz esses valores virarem de dia horas antes da meia-
// noite local (ex.: 21h em vez de meia-noite em UTC-3), destoando do que o
// backend considera "hoje". Por isso, sempre usar estas funções em vez de
// toISOString().slice(0, 10).
export function localDateStr(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function daysAgoLocalStr(days) {
  return localDateStr(new Date(Date.now() - days * 86400000));
}
