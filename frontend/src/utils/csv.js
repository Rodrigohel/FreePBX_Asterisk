function escapeCsvValue(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function toCsv(headers, rows) {
  const lines = [headers.map(escapeCsvValue).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvValue).join(','));
  }
  // BOM no início: sem isso o Excel abre acentos (ç, ã, é...) corrompidos.
  return '﻿' + lines.join('\r\n');
}

// Como toCsv, mas pra exportar várias tabelinhas relacionadas (ex.: dois
// rankings, ou as seções do relatório mensal) num único arquivo CSV, cada
// uma com seu próprio título e cabeçalho, separadas por uma linha em branco
// — assim o usuário abre um arquivo só no Excel em vez de vários soltos.
export function toMultiSectionCsv(sections) {
  const blocks = sections.map((section) => {
    const lines = [escapeCsvValue(section.heading), section.headers.map(escapeCsvValue).join(',')];
    if (section.rows.length === 0) {
      lines.push(escapeCsvValue(section.emptyLabel || 'Nada a mostrar.'));
    } else {
      for (const row of section.rows) lines.push(row.map(escapeCsvValue).join(','));
    }
    return lines.join('\r\n');
  });
  return '﻿' + blocks.join('\r\n\r\n');
}

export function downloadCsv(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
