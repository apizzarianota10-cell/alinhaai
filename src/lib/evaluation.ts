import {
  EvaluationField,
  EvaluationFieldType,
  EvaluationRecord,
  EvaluationSection,
  EvaluationTemplate,
  ExerciseLevel,
} from '../types';

let seq = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

const f = (label: string, type: EvaluationFieldType = 'text', extra: Partial<EvaluationField> = {}): EvaluationField => ({
  id: newId('fld'),
  label,
  type,
  ...extra,
});
const s = (title: string, fields: EvaluationField[]): EvaluationSection => ({ id: newId('sec'), title, fields });

const SHORTENING = ['Normal', 'Encurtado à direita', 'Encurtado à esquerda', 'Encurtado bilateral'];
const POS_NEG = ['Negativo', 'Positivo'];

/** Movement screening items of the Pilates evaluation (scored 0–3) */
export const MOVEMENT_ITEMS = [
  'Meio agachamento',
  'Agachamento completo',
  'Levantamento de calcanhar',
  'Aranha na parede',
  'Sentado com pernas estendidas',
  'Abdução de quadril',
  'Sentado em Z (sereia)',
  'Roll Up',
  'Hundred',
  'Levantamento lateral',
  'Apoio (push up)',
  'Super-homem',
  'Flexão de ombro em prono',
  'Pressão para cima em prono (Swan)',
  'Flexão de joelho em prono',
];

export const SCALE_OPTIONS = [
  { value: '0', label: '0 — não realiza' },
  { value: '1', label: '1 — com compensações' },
  { value: '2', label: '2 — bom controle' },
  { value: '3', label: '3 — excelente' },
];

/** Standard Pilates evaluation, organised like a paper "ficha de avaliação" */
export function buildDefaultTemplate(): EvaluationTemplate {
  const now = new Date().toISOString();
  return {
    id: 'tpl-padrao-pilates',
    name: 'Ficha de Avaliação — Pilates',
    createdAt: now,
    updatedAt: now,
    sections: [
      s('Avaliação', [f('Data da avaliação', 'date'), f('Fisioterapeuta')]),
      s('Identificação do paciente', [
        f('Nome'),
        f('E-mail'),
        f('Instagram'),
        f('Endereço'),
        f('Telefone'),
        f('RG'),
        f('CPF'),
        f('Contato de emergência'),
        f('Data de nascimento', 'date'),
        f('Idade', 'number', { unit: 'anos' }),
        f('Peso', 'number', { unit: 'kg' }),
        f('Altura', 'number', { unit: 'cm' }),
        f('Naturalidade'),
        f('Estado civil', 'select', { options: ['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)'] }),
        f('Atividade profissional'),
        f('Perfil ocupacional', 'select', { options: ['Sentado', 'Em pé', 'Misto', 'Esforço físico', 'Não trabalha'] }),
      ]),
      s('História clínica', [
        f('Atividade física atual?', 'yesno', { detailLabel: 'Qual' }),
        f('Atividade física prévia?', 'yesno', { detailLabel: 'Qual' }),
        f('Gostou? Como foi?', 'textarea'),
        f('Hábitos de vida (alimentação, ingestão de água, sono, estresse)', 'textarea'),
        f('Diagnóstico clínico'),
        f('Indicação médica?', 'yesno', { detailLabel: 'Médico responsável' }),
      ]),
      s('Diagnósticos e exames', [
        f('Diagnósticos existentes', 'textarea'),
        f('Outros'),
        f('Exames complementares', 'textarea'),
        f('Antecedentes familiares', 'textarea'),
      ]),
      s('Objetivos com o Pilates', [
        f('Por que você procurou o Pilates?', 'textarea'),
        f('O que você espera alcançar com o Pilates?', 'textarea'),
        f('O que gostaria de fazer que não consegue mais?', 'textarea'),
      ]),
      s('Queixa e histórico', [
        f('Queixa principal', 'textarea'),
        f('HFA / HFP', 'textarea'),
        f('Medicamentos'),
        f('Tratamentos realizados'),
        f('Qualidade de vida / participação social', 'textarea'),
      ]),
      s('Exame clínico / físico', [
        f('Ocorrência de dor?', 'yesno', { detailLabel: 'Local' }),
        f('Intensidade da dor', 'pain'),
        f('Característica da dor'),
        f('Tempo de dor'),
        f('A dor melhora com', 'select', { options: ['Movimento', 'Repouso', 'Ambos', 'Nenhum'] }),
        f('Cãimbras?', 'yesno', { detailLabel: 'Locais' }),
        f('Fraturas?', 'yesno', { detailLabel: 'Locais' }),
        f('Padrão respiratório', 'select', { options: ['Diafragmático', 'Costal / torácico', 'Misto', 'Paradoxal'] }),
        f('Patelas'),
      ]),
      s('Testes especiais', [
        f('Distância dedo-chão', 'number', { unit: 'cm' }),
        f('Índice de Schober', 'number', { unit: 'cm' }),
        f('Sinal de Lasègue', 'select', { options: POS_NEG }),
        f('Teste da gibosidade (Adams)', 'select', { options: POS_NEG }),
        f('Outros testes', 'textarea'),
      ]),
      s('Testes de encurtamento muscular', [
        f('Piriforme', 'select', { options: SHORTENING }),
        f('Iliopsoas', 'select', { options: SHORTENING }),
        f('Quadríceps', 'select', { options: SHORTENING }),
        f('Isquiotibiais', 'select', { options: SHORTENING }),
      ]),
      s('Diástase abdominal', [
        f('Supraumbilical (SU)', 'number', { unit: 'cm' }),
        f('Umbilical (U)', 'number', { unit: 'cm' }),
        f('Infraumbilical (IU)', 'number', { unit: 'cm' }),
        f('Observações', 'textarea'),
      ]),
      s('Avaliação do movimento', [...MOVEMENT_ITEMS.map((m) => f(m, 'scale')), f('Observações do movimento', 'textarea')]),
    ],
  };
}

/** Average of the 0–3 movement scores mapped to the exercise library blocks */
export function computeMovementLevel(
  sections: EvaluationSection[],
  values: Record<string, string>
): { average: number; answered: number; total: number; level: ExerciseLevel } | null {
  const scaleFields = sections.flatMap((sec) => sec.fields.filter((fl) => fl.type === 'scale'));
  const scores = scaleFields.map((fl) => values[fl.id]).filter((v) => v !== undefined && v !== '').map(Number);
  if (scores.length === 0) return null;
  const average = scores.reduce((a, b) => a + b, 0) / scores.length;
  const level: ExerciseLevel = average < 1.5 ? 'basico' : average < 2.25 ? 'intermediario' : 'avancado';
  return { average, answered: scores.length, total: scaleFields.length, level };
}

/** Deep copy with fresh ids (duplicate a template / keep records independent) */
export function cloneSections(sections: EvaluationSection[], freshIds = false): EvaluationSection[] {
  return sections.map((sec) => ({
    ...sec,
    id: freshIds ? newId('sec') : sec.id,
    fields: sec.fields.map((fl) => ({ ...fl, id: freshIds ? newId('fld') : fl.id, options: fl.options ? [...fl.options] : undefined })),
  }));
}

export const FIELD_TYPE_LABELS: Record<EvaluationFieldType, string> = {
  text: 'Texto curto',
  textarea: 'Texto longo',
  number: 'Número',
  date: 'Data',
  yesno: 'Sim / Não',
  select: 'Lista de opções',
  scale: 'Nota do movimento (0–3)',
  pain: 'Escala de dor (0–10)',
};

export const formatAnswer = (fl: EvaluationField, rec: Pick<EvaluationRecord, 'values' | 'details'>) => {
  const v = rec.values[fl.id];
  if (v === undefined || v === '') return '';
  const detail = rec.details?.[fl.id];
  if (fl.type === 'yesno') return detail ? `${v} — ${fl.detailLabel || 'Detalhe'}: ${detail}` : v;
  if (fl.type === 'scale') return SCALE_OPTIONS.find((o) => o.value === v)?.label || v;
  if (fl.type === 'pain') return `${v}/10`;
  if (fl.type === 'date') return v.split('-').reverse().join('/');
  return fl.unit ? `${v} ${fl.unit}` : v;
};

// ───────────────────────── PDF import (runs in the browser, offline) ─────────────────────────

const SMALL_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com', 'para', 'a', 'o', 'no', 'na', 'ao', 'por']);
/** "ATIV. FÍSICA ATUAL?" → "Ativ. Física Atual?" — keeps acronyms (CPF, RG, HFA/HFP) and mixed-case words */
const titleCase = (t: string) => {
  const out = t
    .split(/(\s+)/)
    .map((tok) =>
      tok
        .split('/')
        .map((seg) => {
          const letters = seg.replace(/[^A-Za-zÀ-ú]/g, '');
          if (!letters || letters !== letters.toUpperCase()) return seg; // already mixed case
          const lower = seg.toLowerCase();
          if (SMALL_WORDS.has(letters.toLowerCase())) return lower;
          if (letters.length <= 3) return seg; // acronym
          return lower.replace(/[a-zà-ú]/, (c) => c.toUpperCase());
        })
        .join('/')
    )
    .join('');
  return out.replace(/^[a-zà-ú]/, (c) => c.toUpperCase());
};

function guessType(label: string): Pick<EvaluationField, 'type' | 'unit' | 'options'> {
  const l = label.toLowerCase();
  if (/^data\b|data d[aeo] /.test(l) || /nasc/.test(l)) return { type: 'date' };
  if (/intensidade/.test(l)) return { type: 'pain' };
  if (/\bpeso\b/.test(l)) return { type: 'number', unit: 'kg' };
  if (/\baltura\b/.test(l)) return { type: 'number', unit: 'cm' };
  if (/\bidade\b/.test(l)) return { type: 'number', unit: 'anos' };
  if (/\?$/.test(label) && /^(ativ|tem |possui|faz |pratica|fuma|indic)/.test(l)) return { type: 'yesno' };
  if (/\?$/.test(label) || /(hist[oó]ria|h[aá]bitos|queixa|hfa|exames|observa|obs\b|outros testes|qualidade)/.test(l)) return { type: 'textarea' };
  return { type: 'text' };
}

/** pdf.js is large: load it only when a PDF is opened */
async function openPdf(file: File) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

/**
 * Renders each PDF page to an image, so the original can be compared with the template on any
 * device (phone browsers can't show PDFs inside the page).
 */
export async function renderPdfPages(file: File, width = 900): Promise<string[]> {
  const doc = await openPdf(file);
  const pages: string[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, 10); p++) {
    const page = await doc.getPage(p);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: width / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
    pages.push(canvas.toDataURL('image/jpeg', 0.85));
  }
  return pages;
}

type Cell = { text: string; x: number; bold: boolean; font: string };
type Row = { cells: Cell[]; page: number };

/** Reads the PDF as rows of table cells (text pieces separated by a visible gap), with real bold detection */
async function readPdfRows(file: File): Promise<{ rows: Row[]; hasBold: boolean }> {
  const doc = await openPdf(file);
  const rows: Row[] = [];
  let hasBold = false;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // loading the operator list resolves the fonts, which tells us which ones are bold
    await page.getOperatorList();
    const boldFont = new Map<string, boolean>();
    const isBold = (fontName: string) => {
      if (!boldFont.has(fontName)) {
        let b = false;
        try {
          const objs = (page as any).commonObjs;
          const font: any = objs.has(fontName) ? objs.get(fontName) : null;
          b = !!font && (font.bold || font.black || /bold|black|heavy|semibold/i.test(font.name || ''));
        } catch {
          /* font not available: treat as regular */
        }
        boldFont.set(fontName, b);
      }
      return boldFont.get(fontName)!;
    };

    const byY = new Map<number, { x: number; w: number; str: string; bold: boolean; font: string }[]>();
    for (const item of content.items as any[]) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5] / 3) * 3; // same visual row within ~3pt
      const list = byY.get(y) || [];
      const bold = isBold(item.fontName);
      hasBold ||= bold;
      list.push({ x: item.transform[4], w: item.width || 0, str: item.str, bold, font: item.fontName });
      byY.set(y, list);
    }
    [...byY.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([, items]) => {
        items.sort((a, b) => a.x - b.x);
        const cells: Cell[] = [];
        let end = -Infinity;
        for (const it of items) {
          const last = cells[cells.length - 1];
          if (last && it.x - end < 8) {
            last.text += (it.x - end > 1.5 ? ' ' : '') + it.str;
            last.bold = last.bold && it.bold;
          } else cells.push({ text: it.str, x: it.x, bold: it.bold, font: it.font });
          end = it.x + it.w;
        }
        cells.forEach((c) => (c.text = c.text.replace(/\s+/g, ' ').trim()));
        rows.push({ cells: cells.filter((c) => c.text), page: p });
      });
  }
  return { rows, hasBold };
}

const DETAIL_LABEL = /^(qual|quais|local|locais|onde|quando)\??$/i;

/**
 * Builds an editable template from a paper form: bold headings become sections (also side-by-side
 * columns), table cells "Rótulo:" become items, "…? | Qual:" becomes a Sim/Não question with detail,
 * and labels broken over two lines are joined. The result is reviewed next to the PDF before saving.
 */
export async function templateFromPdf(file: File): Promise<EvaluationTemplate> {
  const { rows, hasBold } = await readPdfRows(file);
  const now = new Date().toISOString();
  const sections: EvaluationSection[] = [];
  // headings in the same row split the page into columns; cells go to the column on their left
  let columns: { x: number; section: EvaluationSection }[] = [];
  let name = '';
  let titleFont = '';
  let lastField: EvaluationField | null = null;

  const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
  const isUpper = (t: string) => t.replace(/[^A-Za-zÀ-ú]/g, '').length >= 3 && t === t.toUpperCase();
  const isHeading = (c: Cell, row: Cell[]) => {
    const t = c.text.replace(/:\s*$/, '');
    if (t.includes(':') || t.includes('?') || words(t) > 7) return false;
    // abbreviated labels ("DATA DE NASC.", "INDIC. MÉDICA") are items, not titles
    if (/[A-Za-zÀ-ú]\.(\s|$)/.test(t)) return false;
    // a cell followed by several item labels on the same row is an item of a table row
    if (row.filter((o) => o !== c && o.text.endsWith(':') && o.x > c.x).length >= 2) return false;
    const titleLike = words(t) >= 2 || !c.text.endsWith(':');
    // side-by-side column titles: a row made only of uppercase multi-word phrases ("TESTES ESPECIAIS: | TESTES DE …")
    const upperTitle = (o: Cell) => {
      const ot = o.text.replace(/:\s*$/, '');
      return isUpper(ot) && words(ot) >= 2 && !/[.:?]/.test(ot);
    };
    if (row.length >= 2 && row.every(upperTitle)) return true;
    if (hasBold) return c.bold && titleLike;
    // many forms don't flag bold, but print headings with the same font as the document title
    if (titleFont) return c.font === titleFont && titleLike;
    return isUpper(t) && words(t) >= 2;
  };
  const sectionFor = (x: number) => {
    if (columns.length === 0) {
      const sec = s('Geral', []);
      sections.push(sec);
      columns = [{ x: -Infinity, section: sec }];
    }
    return [...columns].reverse().find((c) => c.x <= x + 5)?.section || columns[0].section;
  };
  const typeFor = (sec: EvaluationSection, label: string): Pick<EvaluationField, 'type' | 'unit' | 'options'> => {
    const t = sec.title.toLowerCase();
    if (/movimento/.test(t) && !/obs|observ/i.test(label)) return { type: 'scale' };
    if (/encurtamento/.test(t)) return { type: 'select', options: [...SHORTENING] };
    return guessType(label);
  };
  const addField = (raw: string, x: number) => {
    const label = titleCase(raw.replace(/[_.]{3,}/g, '').replace(/\s*:\s*$/, '').replace(/\(\s*\)/g, '').trim());
    // values, spreadsheet errors (#DIV/0!) and computed cells are not items
    if (!label || /^[\d\s.,#/!%-]+$/.test(label) || /#|!$/.test(label) || /^n[ií]vel$/i.test(label)) return;
    const sec = sectionFor(x);
    if (sec.fields.some((fl) => fl.label.toLowerCase() === label.toLowerCase())) return;
    const fl: EvaluationField = { id: newId('fld'), label, ...typeFor(sec, label) };
    sec.fields.push(fl);
    lastField = fl;
  };

  for (const row of rows) {
    const cells = row.cells.filter((c) => !/^p[aá]gina \d+/i.test(c.text) && !/^[_\s]+$/.test(c.text));
    if (cells.length === 0) continue;
    const first = cells[0];

    // the document title names the template
    if (!name && cells.length === 1 && (first.bold || isUpper(first.text)) && !first.text.includes(':') && words(first.text) >= 2) {
      name = titleCase(first.text);
      // only meaningful when headings use a font different from the items
      if (rows.some((r) => r.cells.some((c) => c.font !== first.font))) titleFont = first.font;
      continue;
    }

    // a label broken over two lines: "…que não consegue" + "mais?" / "(Alimentação, …," + "stresse):"
    const prev = lastField as EvaluationField | null;
    if (
      cells.length === 1 &&
      prev &&
      (/^[a-zà-ú]/.test(first.text) || prev.label.split('(').length > prev.label.split(')').length) &&
      !/[:?]$/.test(prev.label) &&
      words(first.text) <= 6
    ) {
      prev.label = `${prev.label} ${first.text.replace(/\s*:\s*$/, '')}`.replace(/\s+/g, ' ');
      if (/\?$/.test(prev.label) && prev.type === 'text') prev.type = 'textarea';
      continue;
    }

    // a single full-width row ends a side-by-side (two-column) block
    if (columns.length > 1 && cells.length === 1 && first.x < columns[1].x - 5) columns = [columns[0]];

    const headings = cells.filter((c) => isHeading(c, cells));
    if (headings.length > 0) {
      const created = headings.map((h) => {
        const sec = s(titleCase(h.text.replace(/:\s*$/, '')), []);
        sections.push(sec);
        return { x: h.x, section: sec };
      });
      // a heading that starts mid-page only replaces the column(s) to its right
      columns = created.length === 1 && created[0].x > 150 ? [...columns.filter((c) => c.x < created[0].x - 5), ...created] : created;
      lastField = null;
    }

    let prevInRow = null as EvaluationField | null;
    for (const cell of cells) {
      if (headings.includes(cell)) continue;
      const text = cell.text.replace(/_{3,}/g, ' ').trim();
      const bare = text.replace(/:\s*$/, '');
      // "Qual:" / "Locais:" right after an item → Sim/Não with a detail question
      if (prevInRow && DETAIL_LABEL.test(bare)) {
        prevInRow.type = 'yesno';
        prevInRow.detailLabel = titleCase(bare);
        continue;
      }
      const before = lastField as EvaluationField | null;
      if (text.includes(':')) {
        // "TELEFONE: RG: CPF:" → three items; text after the last ":" is a filled-in value
        const parts = text.split(':');
        parts.slice(0, -1).forEach((part) => addField(part, cell.x));
        const tail = parts[parts.length - 1].trim();
        if (/\?$/.test(tail)) addField(tail, cell.x);
      } else if (/[A-Za-zÀ-ú]{2}/.test(text) && words(text) <= 12) {
        addField(text, cell.x);
      }
      if ((lastField as EvaluationField | null) !== before) prevInRow = lastField as EvaluationField | null;
    }
  }

  return {
    id: newId('tpl'),
    name: name || file.name.replace(/\.pdf$/i, ''),
    sections: sections.filter((sec) => sec.fields.length > 0),
    sourceFileName: file.name,
    createdAt: now,
    updatedAt: now,
  };
}
