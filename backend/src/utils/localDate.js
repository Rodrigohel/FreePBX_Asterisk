// `Date.prototype.toISOString()` sempre devolve a data em UTC, mesmo com o
// servidor rodando noutro fuso horário. Usar isso pra decidir "qual é o dia
// de hoje" faz o dia virar na hora errada pra quem está atrás de UTC (ex.:
// 21h em vez de meia-noite em UTC-3) — o contador de "hoje" zera cedo
// demais e destoa do CURDATE() do MySQL, que segue o fuso do sistema
// operacional do servidor (o mesmo fuso em que o Asterisk grava calldate).
// Por isso, em todo lugar que precisa do "dia de hoje" do calendário local,
// usar estas funções — nunca toISOString().slice(0, 10).
export function localDateStr(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function daysAgoLocalStr(days) {
  return localDateStr(new Date(Date.now() - days * 86400000));
}
