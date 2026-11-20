import type { jsPDF } from 'jspdf';
import { ClinicSettings, EvaluationRecord, Patient, PresenceMark } from '../types';
import { computeMovementLevel, formatAnswer } from './evaluation';
import { LEVEL_LABEL } from './pilatesCatalog';
import { formatDate } from './utils';

/**
 * Real PDF files (downloaded, not the print dialog), generated in the browser so they also work
 * offline. jsPDF is loaded only when a PDF is requested.
 */

const GREEN: [number, number, number] = [66, 107, 91];
const MARGIN = 14;

async function newDoc() {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  return { doc, autoTable };
}

const lastY = (doc: jsPDF) => ((doc as any).lastAutoTable?.finalY as number) || MARGIN;

/** Standard fonts only cover Latin-1: replace the few typographic characters they lack */
const safe = (t: string) =>
  (t || '')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/•/g, '-');

function header(doc: jsPDF, title: string, subtitle: string, settings: ClinicSettings) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, w, 4, 'F');
  doc.setTextColor(23, 35, 29);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(safe(title), w / 2, 15, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(safe(subtitle), w / 2, 21, { align: 'center' });
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(safe(settings.clinicName), w / 2, 26, { align: 'center' });
  return 31;
}

/** Clinic contact + page numbers on every page */
function footer(doc: jsPDF, settings: ClinicSettings) {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const contact = [settings.address, settings.phone && `Telefone: ${settings.phone}`, settings.email && `E-mail: ${settings.email}`]
    .filter(Boolean)
    .join('  -  ');
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    if (contact) doc.text(safe(contact), w / 2, h - 8, { align: 'center', maxWidth: w - 2 * MARGIN });
    doc.text(`${i}/${pages}`, w - MARGIN, h - 4, { align: 'right' });
  }
}

const fileName = (...parts: string[]) =>
  parts
    .join(' - ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '_') + '.pdf';

// ───────────────────────── Avaliação ─────────────────────────

export async function downloadEvaluationPdf(rec: EvaluationRecord, settings: ClinicSettings) {
  const { doc, autoTable } = await newDoc();
  let y = header(doc, rec.templateName, `${rec.patientName}  -  ${formatDate(rec.date)}  -  ${rec.professionalName}`, settings);

  for (const sec of rec.sections) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'grid',
      head: [[{ content: safe(sec.title.toUpperCase()), colSpan: 2 }]],
      body: sec.fields.map((fl) => [safe(fl.label), safe(formatAnswer(fl, rec))]),
      styles: { fontSize: 8.5, cellPadding: 1.8, textColor: [23, 35, 29], lineColor: [210, 218, 214], valign: 'top' },
      headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
    });
    y = lastY(doc) + 4;
  }

  const lv = computeMovementLevel(rec.sections, rec.values);
  if (lv) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'plain',
      body: [[`Nível sugerido: ${LEVEL_LABEL[lv.level]}  (média ${lv.average.toFixed(2).replace('.', ',')} de 3 - ${lv.answered}/${lv.total} movimentos)`]],
      styles: { fontSize: 10, fontStyle: 'bold', fillColor: [233, 241, 236], textColor: [52, 86, 72], cellPadding: 3 },
    });
    y = lastY(doc) + 4;
  }

  // signature line
  const h = doc.internal.pageSize.getHeight();
  if (y > h - 40) {
    doc.addPage();
    y = 30;
  }
  const w = doc.internal.pageSize.getWidth();
  doc.setDrawColor(150);
  doc.line(w / 2 - 45, y + 18, w / 2 + 45, y + 18);
  doc.setFontSize(8.5);
  doc.setTextColor(60);
  doc.text(safe(rec.professionalName), w / 2, y + 23, { align: 'center' });

  footer(doc, settings);
  doc.save(fileName('Avaliacao', rec.patientName, rec.date));
}

// ───────────────────────── Controle de Presença ─────────────────────────

export type PresenceRowLike = { date: string; mark: PresenceMark };

export async function downloadPresencePdf(
  patient: Patient,
  rows: PresenceRowLike[],
  notes: Record<string, string>,
  settings: ClinicSettings
) {
  const { doc, autoTable } = await newDoc();
  let y = header(doc, 'Controle de Presença', patient.name, settings);
  const attended = rows.filter((r) => r.mark !== 'F');
  const absences = rows.filter((r) => r.mark === 'F');
  const cycles = Math.max(1, Math.ceil(attended.length / 30));

  doc.setFontSize(9);
  doc.setTextColor(23, 35, 29);
  doc.text(
    safe(
      `Presenças: ${rows.filter((r) => r.mark === 'P').length}   Compensações: ${rows.filter((r) => r.mark === 'C').length}   Faltas: ${absences.length}   Sessões restantes no plano: ${patient.sessionsRemaining}`
    ),
    MARGIN,
    y
  );
  y += 4;

  for (let c = 0; c < cycles; c++) {
    const cycle = attended.slice(c * 30, (c + 1) * 30);
    const body: any[] = [];
    for (let b = 0; b < 3; b++) {
      const block = cycle.slice(b * 10, b * 10 + 10);
      if (block.length === 0 && b * 10 > cycle.length) break;
      for (let i = 0; i < 10; i++) {
        const r = block[i];
        body.push([
          `${b * 10 + i + 1}.`,
          r ? formatDate(r.date) : '____/____/______',
          r?.mark === 'P' ? '(X) P' : '(  ) P',
          r?.mark === 'C' ? '(X) C' : '(  ) C',
        ]);
      }
      body.push([
        {
          content: safe(`Percepção do paciente em relação à sua evolução: ${notes[`c${c + 1}-b${b + 1}`] || ''}`),
          colSpan: 4,
          styles: { fontStyle: 'italic', minCellHeight: 14, fillColor: [248, 250, 249] },
        },
      ]);
    }
    if (cycle.length >= 20) {
      body.push([
        { content: safe(`REAVALIAÇÃO: ${notes[`c${c + 1}-reav`] || ''}`), colSpan: 4, styles: { fontStyle: 'bold', minCellHeight: 18 } },
      ]);
    }
    autoTable(doc, {
      startY: y + 2,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'grid',
      head: [[{ content: `Presenças / Compensações - ciclo ${c + 1}`, colSpan: 4 }]],
      body,
      styles: { fontSize: 8.5, cellPadding: 1.4, textColor: [23, 35, 29], lineColor: [210, 218, 214] },
      headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 40 }, 2: { cellWidth: 20 }, 3: { cellWidth: 20 } },
    });
    y = lastY(doc) + 4;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    head: [['Faltas']],
    body: absences.length ? absences.map((r) => [formatDate(r.date)]) : [['Nenhuma falta registrada']],
    styles: { fontSize: 8.5, cellPadding: 1.4, lineColor: [210, 218, 214] },
    headStyles: { fillColor: [190, 18, 60], textColor: 255, fontStyle: 'bold' },
    tableWidth: 60,
  });

  footer(doc, settings);
  doc.save(fileName('Controle_de_Presenca', patient.name));
}

export type PresenceSummary = {
  patient: Patient;
  P: number;
  C: number;
  F: number;
  last?: string;
  cyclePos: number;
};

export async function downloadPresenceOverviewPdf(list: PresenceSummary[], settings: ClinicSettings, periodLabel: string) {
  const { doc, autoTable } = await newDoc();
  const y = header(doc, 'Controle de Presença - Visão geral', periodLabel, settings);
  autoTable(doc, {
    startY: y + 2,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'striped',
    head: [['Aluno', 'P', 'C', 'Faltas', 'Sessão no ciclo', 'Última presença', 'Restantes']],
    body: list.map((s) => [
      safe(s.patient.name),
      s.P,
      s.C,
      s.F,
      `${s.cyclePos}/30`,
      s.last ? formatDate(s.last) : '-',
      s.patient.sessionsRemaining,
    ]),
    styles: { fontSize: 8.5, cellPadding: 1.8 },
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 6: { halign: 'center' } },
  });
  footer(doc, settings);
  doc.save(fileName('Controle_de_Presenca_Geral', new Date().toISOString().slice(0, 10)));
}
