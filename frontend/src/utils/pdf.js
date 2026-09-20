import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

export function generateReportPdf({ title, subtitle, headers, rows, filename }) {
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(14);
  doc.text(title, 14, 16);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(subtitle, 14, 22);
  }

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: subtitle ? 28 : 22,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
  });

  doc.save(filename);
}

// As fontes padrão do jsPDF (Helvetica etc.) só cobrem Latin-1 — um emoji
// (ex.: 🎉 usado nos textos de "lista vazia" em outros painéis) vira
// caractere corrompido no PDF em vez de ficar em branco. Latin-1 já cobre
// os acentos do português (á, ç, õ...), então só precisamos cortar fora o
// que estiver acima disso.
function stripUnsupportedChars(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/[—–]/g, '-')
    .replace(/[''‚]/g, "'")
    .replace(/[""„]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x00-\xFF]/g, '')
    .trim();
}

function sanitizeRows(rows) {
  return rows.map((row) => row.map(stripUnsupportedChars));
}

// Relatório consolidado com várias seções (resumo geral, rankings, quedas de
// ramal) — usado pelo relatório mensal. Cada seção é uma tabela própria,
// empilhada a partir de onde a anterior terminou.
export function generateMonthlyReportPdf({ title, subtitle, sections, filename }) {
  const doc = new jsPDF({ orientation: 'portrait' });
  const marginX = 14;
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFontSize(16);
  doc.text(stripUnsupportedChars(title), marginX, 18);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(stripUnsupportedChars(subtitle), marginX, 25);
  }

  let cursorY = subtitle ? 32 : 26;

  for (const section of sections) {
    if (cursorY > pageHeight - 30) {
      doc.addPage();
      cursorY = 18;
    }
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text(stripUnsupportedChars(section.heading), marginX, cursorY);
    cursorY += 4;

    if (section.rows.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(stripUnsupportedChars(section.emptyLabel || 'Nada a mostrar.'), marginX, cursorY + 4);
      cursorY += 12;
      continue;
    }

    autoTable(doc, {
      head: [section.headers.map(stripUnsupportedChars)],
      body: sanitizeRows(section.rows),
      startY: cursorY,
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    cursorY = doc.lastAutoTable.finalY + 12;
  }

  doc.save(filename);
}
