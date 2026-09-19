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
