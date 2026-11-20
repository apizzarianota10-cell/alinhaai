import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ClipboardCheck,
  FileUp,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  Pencil,
  Printer,
  X,
  Eye,
  FileText,
  Loader2,
  Search,
  CheckCircle2,
  Download,
  Save,
  RotateCcw,
  Users,
  AlertTriangle,
  CalendarClock,
} from 'lucide-react';
import { downloadEvaluationPdf } from '../../lib/pdf';
import { StatCard, Avatar, ProgressBar, Pill, Card, daysBetween } from '../common/Insights';
import { clinicStorage } from '../../lib/storage';
import { formatDate, printElement } from '../../lib/utils';
import {
  buildDefaultTemplate,
  cloneSections,
  computeMovementLevel,
  FIELD_TYPE_LABELS,
  formatAnswer,
  newId,
  renderPdfPages,
  SCALE_OPTIONS,
  templateFromPdf,
} from '../../lib/evaluation';
import { LEVEL_LABEL } from '../../lib/pilatesCatalog';
import {
  EvaluationField,
  EvaluationFieldType,
  EvaluationRecord,
  EvaluationSection,
  EvaluationTemplate,
  Patient,
} from '../../types';
import { Modal } from '../common/Modal';
import { useToast } from '../common/Toast';

const input =
  'w-full text-sm px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg';
const btn =
  'flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg border border-[#E5EAE7] dark:border-[#273830] bg-white dark:bg-[#17231D] hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]';
const btnPrimary = 'flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg text-white bg-[#426B5B] hover:bg-[#345648]';
const iconBtn = 'p-2 rounded-lg text-[#64748B] hover:bg-[#F1F5F3] dark:hover:bg-[#1F332A] disabled:opacity-30';

const move = <T,>(list: T[], i: number, dir: -1 | 1): T[] => {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

/** Full-screen layer (more room than a modal for long forms; safe-area aware on phones) */
const Sheet: React.FC<{ title: string; onClose: () => void; actions?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  onClose,
  actions,
  children,
}) => (
  <div className="fixed inset-0 z-50 bg-[#F6F8F7] dark:bg-[#0C130F] flex flex-col" role="dialog" aria-label={title}>
    <div
      className="flex items-center gap-2 px-3 sm:px-5 py-3 border-b border-[#E5EAE7] dark:border-[#263730] bg-white dark:bg-[#141F19]"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <button onClick={onClose} className={iconBtn} aria-label="Fechar">
        <X className="w-5 h-5" />
      </button>
      <h2 className="flex-1 min-w-0 truncate font-bold text-sm sm:text-base">{title}</h2>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
    <div className="flex-1 overflow-hidden">{children}</div>
  </div>
);

// ───────────────────────── Template editor (add / remove / reorder items) ─────────────────────────

const TemplateEditor: React.FC<{
  initial: EvaluationTemplate;
  pdfPages?: string[];
  onClose: () => void;
}> = ({ initial, pdfPages, onClose }) => {
  const { showToast } = useToast();
  const [tpl, setTpl] = useState<EvaluationTemplate>(initial);
  const [mobilePane, setMobilePane] = useState<'edit' | 'pdf'>('edit');
  const [checked, setChecked] = useState(!pdfPages);
  const fieldCount = tpl.sections.reduce((n, s) => n + s.fields.length, 0);

  const setSections = (sections: EvaluationSection[]) => setTpl({ ...tpl, sections });
  const updateSection = (id: string, patch: Partial<EvaluationSection>) =>
    setSections(tpl.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const updateField = (secId: string, fieldId: string, patch: Partial<EvaluationField>) =>
    setSections(
      tpl.sections.map((s) =>
        s.id === secId ? { ...s, fields: s.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)) } : s
      )
    );

  const handleSave = () => {
    if (!tpl.name.trim()) return showToast('Dê um nome à ficha.', 'error');
    if (fieldCount === 0) return showToast('Adicione pelo menos um item.', 'error');
    if (pdfPages && !checked) return showToast('Confira o modelo com o PDF e marque a confirmação.', 'error');
    const cleaned: EvaluationTemplate = {
      ...tpl,
      name: tpl.name.trim(),
      sections: tpl.sections
        .map((s) => ({ ...s, title: s.title.trim() || 'Sem título', fields: s.fields.filter((f) => f.label.trim()) }))
        .filter((s) => s.fields.length > 0),
    };
    if (!clinicStorage.saveEvaluationTemplate(cleaned)) return showToast('Não foi possível salvar (armazenamento cheio).', 'error');
    showToast('Modelo de ficha salvo!', 'success');
    onClose();
  };

  const editor = (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <label className="block text-xs font-semibold mb-1">Nome da ficha</label>
        <input value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} className={`${input} font-semibold`} />
        <p className="text-[11px] text-[#64748B] mt-1">
          {tpl.sections.length} seções • {fieldCount} itens{tpl.sourceFileName ? ` • importado de “${tpl.sourceFileName}”` : ''}
        </p>
      </div>

      {tpl.sections.map((sec, si) => (
        <section key={sec.id} className="rounded-xl border border-[#E5EAE7] dark:border-[#273830] bg-white dark:bg-[#17231D]">
          <div className="flex items-center gap-1 p-2 border-b border-[#E5EAE7] dark:border-[#273830]">
            <input
              value={sec.title}
              onChange={(e) => updateSection(sec.id, { title: e.target.value })}
              aria-label="Título da seção"
              className="flex-1 min-w-0 px-2 py-1.5 text-sm font-bold bg-transparent rounded-md focus:bg-[#F8FAF9] dark:focus:bg-[#111A15]"
            />
            <button className={iconBtn} disabled={si === 0} onClick={() => setSections(move(tpl.sections, si, -1))} aria-label="Subir seção">
              <ChevronUp className="w-4 h-4" />
            </button>
            <button className={iconBtn} disabled={si === tpl.sections.length - 1} onClick={() => setSections(move(tpl.sections, si, 1))} aria-label="Descer seção">
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              className={`${iconBtn} hover:text-rose-600`}
              onClick={() => setSections(tpl.sections.filter((s) => s.id !== sec.id))}
              aria-label={`Apagar seção ${sec.title}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <ul className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
            {sec.fields.map((fl, fi) => (
              <li key={fl.id} className="p-2 space-y-2">
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5">
                  <input
                    value={fl.label}
                    onChange={(e) => updateField(sec.id, fl.id, { label: e.target.value })}
                    placeholder="Nome do item"
                    aria-label="Nome do item"
                    className="flex-1 min-w-[10rem] px-2 py-1.5 text-sm bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-md"
                  />
                  <div className="flex items-center gap-1 w-full sm:w-auto">
                  <select
                    value={fl.type}
                    onChange={(e) => {
                      const type = e.target.value as EvaluationFieldType;
                      updateField(sec.id, fl.id, {
                        type,
                        options: type === 'select' ? fl.options || ['Opção 1', 'Opção 2'] : fl.options,
                      });
                    }}
                    aria-label="Tipo de resposta"
                    className="flex-1 min-w-0 sm:flex-none sm:w-44 px-2 py-1.5 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-md"
                  >
                    {(Object.keys(FIELD_TYPE_LABELS) as EvaluationFieldType[]).map((t) => (
                      <option key={t} value={t}>
                        {FIELD_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                  <div className="flex shrink-0">
                    <button className={iconBtn} disabled={fi === 0} onClick={() => updateSection(sec.id, { fields: move(sec.fields, fi, -1) })} aria-label="Subir item">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      className={iconBtn}
                      disabled={fi === sec.fields.length - 1}
                      onClick={() => updateSection(sec.id, { fields: move(sec.fields, fi, 1) })}
                      aria-label="Descer item"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      className={`${iconBtn} hover:text-rose-600`}
                      onClick={() => updateSection(sec.id, { fields: sec.fields.filter((f) => f.id !== fl.id) })}
                      aria-label={`Apagar item ${fl.label}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  </div>
                </div>
                {fl.type === 'select' && (
                  <input
                    value={(fl.options || []).join(', ')}
                    onChange={(e) => updateField(sec.id, fl.id, { options: e.target.value.split(',').map((o) => o.trim()) })}
                    onBlur={(e) => updateField(sec.id, fl.id, { options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })}
                    placeholder="Opções separadas por vírgula"
                    aria-label="Opções"
                    className="w-full px-2 py-1.5 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-dashed border-[#E5EAE7] dark:border-[#273830] rounded-md"
                  />
                )}
                {fl.type === 'number' && (
                  <input
                    value={fl.unit || ''}
                    onChange={(e) => updateField(sec.id, fl.id, { unit: e.target.value || undefined })}
                    placeholder="Unidade (ex.: cm, kg)"
                    aria-label="Unidade"
                    className="w-40 px-2 py-1.5 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-dashed border-[#E5EAE7] dark:border-[#273830] rounded-md"
                  />
                )}
                {fl.type === 'yesno' && (
                  <input
                    value={fl.detailLabel || ''}
                    onChange={(e) => updateField(sec.id, fl.id, { detailLabel: e.target.value || undefined })}
                    placeholder="Pergunta complementar se Sim (ex.: Qual?)"
                    aria-label="Pergunta complementar"
                    className="w-full sm:w-72 px-2 py-1.5 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-dashed border-[#E5EAE7] dark:border-[#273830] rounded-md"
                  />
                )}
              </li>
            ))}
          </ul>
          <div className="p-2">
            <button
              onClick={() => updateSection(sec.id, { fields: [...sec.fields, { id: newId('fld'), label: '', type: 'text' }] })}
              className="w-full flex items-center justify-center gap-1 py-2 text-xs font-semibold text-[#426B5B] dark:text-[#7FB39F] border border-dashed border-[#426B5B]/40 rounded-lg hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A]"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar item
            </button>
          </div>
        </section>
      ))}

      <button
        onClick={() => setSections([...tpl.sections, { id: newId('sec'), title: 'Nova seção', fields: [{ id: newId('fld'), label: '', type: 'text' }] }])}
        className={`${btn} w-full py-3`}
      >
        <Plus className="w-4 h-4" /> Adicionar seção
      </button>

      {pdfPages && (
        <label className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs cursor-pointer">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 w-4 h-4" />
          <span>
            Conferi o modelo com o PDF original: as seções e os itens batem (ajustei o que faltou ou sobrou).
          </span>
        </label>
      )}
      <div className="h-6" />
    </div>
  );

  return (
    <Sheet
      title={pdfPages ? 'Conferir ficha importada' : 'Editar modelo de ficha'}
      onClose={onClose}
      actions={
        <button onClick={handleSave} className={btnPrimary}>
          <CheckCircle2 className="w-4 h-4" /> Salvar
        </button>
      }
    >
      {pdfPages ? (
        <div className="h-full flex flex-col">
          {/* phones: switch between the template and the PDF */}
          <div className="lg:hidden grid grid-cols-2 gap-1 p-2 bg-white dark:bg-[#141F19] border-b border-[#E5EAE7] dark:border-[#263730]">
            {(['edit', 'pdf'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setMobilePane(p)}
                className={`py-2 rounded-lg text-xs font-semibold ${mobilePane === p ? 'bg-[#426B5B] text-white' : 'text-[#64748B]'}`}
              >
                {p === 'edit' ? `Modelo (${fieldCount} itens)` : `PDF original (${pdfPages.length} pág.)`}
              </button>
            ))}
          </div>
          <div className="flex-1 grid lg:grid-cols-2 overflow-hidden">
            <div className={`overflow-y-auto p-3 sm:p-5 ${mobilePane === 'edit' ? '' : 'hidden lg:block'}`}>{editor}</div>
            <div className={`overflow-y-auto p-3 sm:p-5 bg-[#E9EFEC] dark:bg-[#111A15] space-y-3 ${mobilePane === 'pdf' ? '' : 'hidden lg:block'}`}>
              {pdfPages.map((src, i) => (
                <img key={i} src={src} alt={`Página ${i + 1} do PDF`} className="w-full rounded-lg shadow bg-white" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="h-full overflow-y-auto p-3 sm:p-5">{editor}</div>
      )}
    </Sheet>
  );
};

// ───────────────────────── Filling an evaluation ─────────────────────────

const FieldInput: React.FC<{
  field: EvaluationField;
  value: string;
  detail: string;
  onChange: (v: string) => void;
  onDetail: (v: string) => void;
}> = ({ field, value, detail, onChange, onDetail }) => {
  const id = `ev-${field.id}`;
  const chip = (active: boolean) =>
    `px-3 py-2 rounded-lg border text-xs font-semibold ${
      active ? 'bg-[#426B5B] border-[#426B5B] text-white' : 'border-[#E5EAE7] dark:border-[#273830] text-[#64748B] dark:text-[#9AA8B6]'
    }`;
  return (
    <div className={field.type === 'textarea' || field.type === 'scale' ? 'sm:col-span-2' : ''}>
      <label htmlFor={id} className="block text-xs font-semibold mb-1">
        {field.label}
      </label>
      {field.type === 'textarea' && <textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={input} />}
      {field.type === 'text' && <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className={input} />}
      {field.type === 'date' && <input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} className={input} />}
      {field.type === 'number' && (
        <div className="flex items-center gap-2">
          <input id={id} type="number" inputMode="decimal" step="any" value={value} onChange={(e) => onChange(e.target.value)} className={input} />
          {field.unit && <span className="text-xs text-[#64748B]">{field.unit}</span>}
        </div>
      )}
      {field.type === 'select' && (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={input}>
          <option value="">—</option>
          {(field.options || []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}
      {field.type === 'yesno' && (
        <div className="space-y-2">
          <div className="flex gap-2" role="radiogroup" aria-labelledby={id}>
            {['Sim', 'Não'].map((o) => (
              <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(value === o ? '' : o)} className={chip(value === o)}>
                {o}
              </button>
            ))}
          </div>
          {value === 'Sim' && field.detailLabel && (
            <input value={detail} onChange={(e) => onDetail(e.target.value)} placeholder={field.detailLabel} aria-label={field.detailLabel} className={input} />
          )}
        </div>
      )}
      {field.type === 'scale' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5" role="radiogroup" aria-label={field.label}>
          {SCALE_OPTIONS.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(value === o.value ? '' : o.value)} className={chip(value === o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      )}
      {field.type === 'pain' && (
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={field.label}>
          {Array.from({ length: 11 }, (_, n) => String(n)).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              onClick={() => onChange(value === n ? '' : n)}
              className={`w-9 h-9 rounded-lg border text-xs font-bold ${
                value === n
                  ? Number(n) >= 7
                    ? 'bg-rose-600 border-rose-600 text-white'
                    : Number(n) >= 4
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'bg-[#426B5B] border-[#426B5B] text-white'
                  : 'border-[#E5EAE7] dark:border-[#273830]'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** Suggested exercise block from the movement scores */
const LevelBadge: React.FC<{ sections: EvaluationSection[]; values: Record<string, string> }> = ({ sections, values }) => {
  const lv = computeMovementLevel(sections, values);
  if (!lv) return null;
  return (
    <div className="p-3 rounded-xl bg-[#E9F1EC] dark:bg-[#1F332A] text-xs flex flex-wrap items-center gap-2">
      <span className="font-bold text-[#345648] dark:text-[#9CCBB8]">Nível sugerido: {LEVEL_LABEL[lv.level]}</span>
      <span className="text-[#64748B]">
        média {lv.average.toFixed(2).replace('.', ',')} de 3 • {lv.answered}/{lv.total} movimentos avaliados
      </span>
    </div>
  );
};

/** Prefills identification items from the patient registry */
function prefill(sections: EvaluationSection[], patient: Patient): Record<string, string> {
  const user = clinicStorage.getCurrentUser();
  const today = new Date().toISOString().slice(0, 10);
  const age = patient.birthDate ? Math.floor((Date.now() - new Date(patient.birthDate + 'T00:00:00').getTime()) / 31557600000) : undefined;
  const a = patient.address;
  const rules: [RegExp, string | undefined][] = [
    [/^nome( completo)?$/i, patient.name],
    [/e-?mail/i, patient.email],
    [/^telefone|celular|whats/i, patient.phone],
    [/^cpf$/i, patient.cpf],
    [/endere/i, a && [a.street, a.number, a.neighborhood, a.city].filter(Boolean).join(', ')],
    [/emerg/i, patient.emergencyContact?.name && `${patient.emergencyContact.name} ${patient.emergencyContact.phone || ''}`.trim()],
    [/nasc/i, patient.birthDate],
    [/^idade$/i, age !== undefined ? String(age) : undefined],
    [/data da avalia/i, today],
    // only the evaluator's own field — not "Atividade profissional"
    [/^(fisioterapeuta|avaliador(a)?|profissional( respons[aá]vel)?|instrutor(a)?)$/i, user.name],
  ];
  const values: Record<string, string> = {};
  sections.forEach((s) =>
    s.fields.forEach((fl) => {
      const hit = rules.find(([re]) => re.test(fl.label.trim()));
      if (hit?.[1]) values[fl.id] = hit[1];
    })
  );
  return values;
}

/** The fillable ficha itself (used inline in the section and in the patient profile) */
const EvaluationFormBody: React.FC<{ rec: EvaluationRecord; setRec: React.Dispatch<React.SetStateAction<EvaluationRecord>> }> = ({
  rec,
  setRec,
}) => (
  <>
    {rec.sections.map((sec) => (
      <section
        key={sec.id}
        id={`ev-sec-${sec.id}`}
        className="scroll-mt-32 rounded-xl border border-[#E5EAE7] dark:border-[#273830] bg-white dark:bg-[#17231D] p-3 sm:p-4"
      >
        <h3 className="text-sm font-bold mb-3">{sec.title}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sec.fields.map((fl) => (
            <FieldInput
              key={fl.id}
              field={fl}
              value={rec.values[fl.id] || ''}
              detail={rec.details?.[fl.id] || ''}
              onChange={(v) => setRec((r) => ({ ...r, values: { ...r.values, [fl.id]: v } }))}
              onDetail={(v) => setRec((r) => ({ ...r, details: { ...r.details, [fl.id]: v } }))}
            />
          ))}
        </div>
      </section>
    ))}
    <LevelBadge sections={rec.sections} values={rec.values} />
  </>
);

/** Downloads the PDF of a record, with a toast on failure */
async function savePdf(rec: EvaluationRecord, showToast: (m: string, t?: any) => void) {
  try {
    await downloadEvaluationPdf(rec, clinicStorage.getSettings());
  } catch (e) {
    console.error(e);
    showToast('Não foi possível gerar o PDF.', 'error');
  }
}

/** A new, prefilled evaluation of `patient` using `tpl` */
function newRecord(tpl: EvaluationTemplate, patient: Patient): EvaluationRecord {
  const user = clinicStorage.getCurrentUser();
  const sections = cloneSections(tpl.sections);
  const now = new Date().toISOString();
  return {
    id: newId('aval'),
    patientId: patient.id,
    patientName: patient.name,
    templateId: tpl.id,
    templateName: tpl.name,
    sections,
    values: prefill(sections, patient),
    details: {},
    date: now.slice(0, 10),
    professionalId: user.id,
    professionalName: user.name,
    createdAt: now,
    updatedAt: now,
  };
}

const REEVALUATION_DAYS = 90;
const LEVEL_TONE: Record<string, 'green' | 'amber' | 'rose'> = { basico: 'green', intermediario: 'amber', avancado: 'rose' };
const ageOf = (birth?: string) =>
  birth ? Math.floor((Date.now() - new Date(birth + 'T00:00:00').getTime()) / 31557600000) : undefined;

/** What the section shows before a student is picked: indicators, recent evaluations and pending students */
const EvaluationDashboard: React.FC<{
  patients: Patient[];
  onEvaluate: (patientId: string) => void;
  onOpen: (r: EvaluationRecord) => void;
}> = ({ patients, onEvaluate, onOpen }) => {
  const { showToast } = useToast();
  const [all, setAll] = useState<EvaluationRecord[]>([]);
  useEffect(() => {
    const load = () => setAll(clinicStorage.getEvaluations());
    load();
    return clinicStorage.subscribe(load);
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';
  const latestByPatient = new Map<string, EvaluationRecord>();
  all.forEach((r) => {
    const cur = latestByPatient.get(r.patientId);
    if (!cur || r.date > cur.date) latestByPatient.set(r.patientId, r);
  });
  const active = patients.filter((p) => p.status === 'ativo');
  const never = active.filter((p) => !latestByPatient.has(p.id));
  const overdue = active.filter((p) => {
    const last = latestByPatient.get(p.id);
    return last && daysBetween(last.date, today) > REEVALUATION_DAYS;
  });
  const levelCounts = { basico: 0, intermediario: 0, avancado: 0 } as Record<string, number>;
  latestByPatient.forEach((r) => {
    const lv = computeMovementLevel(r.sections, r.values);
    if (lv) levelCounts[lv.level]++;
  });
  const leveled = levelCounts.basico + levelCounts.intermediario + levelCounts.avancado;
  const pending = [
    ...never.map((p) => ({ p, reason: 'Nunca avaliado', tone: 'rose' as const })),
    ...overdue.map((p) => ({
      p,
      reason: `Última há ${daysBetween(latestByPatient.get(p.id)!.date, today)} dias`,
      tone: 'amber' as const,
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Avaliações no mês" value={all.filter((r) => r.date >= monthStart).length} hint={`${all.length} no total`} icon={ClipboardCheck} />
        <StatCard
          label="Alunos avaliados"
          value={`${active.length ? Math.round(((active.length - never.length) / active.length) * 100) : 0}%`}
          hint={`${active.length - never.length} de ${active.length} alunos ativos`}
          icon={Users}
          tone="blue"
        />
        <StatCard label="Sem avaliação" value={never.length} hint="alunos ativos nunca avaliados" icon={AlertTriangle} tone="rose" />
        <StatCard label="Reavaliação vencida" value={overdue.length} hint={`última avaliação há mais de ${REEVALUATION_DAYS} dias`} icon={CalendarClock} tone="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Avaliações recentes" className="lg:col-span-2">
          {all.length === 0 ? (
            <p className="text-xs text-[#64748B] py-6 text-center">Nenhuma avaliação registrada ainda. Selecione um aluno acima para começar.</p>
          ) : (
            <ul className="divide-y divide-[#E5EAE7] dark:divide-[#273830]">
              {all.slice(0, 8).map((r) => {
                const lv = computeMovementLevel(r.sections, r.values);
                return (
                  <li key={r.id} className="py-2.5 flex items-center gap-3">
                    <Avatar name={r.patientName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{r.patientName}</p>
                      <p className="text-[11px] text-[#64748B] truncate">
                        {formatDate(r.date)} • {r.templateName} • {r.professionalName}
                      </p>
                    </div>
                    {lv && <Pill tone={LEVEL_TONE[lv.level]}>{LEVEL_LABEL[lv.level]}</Pill>}
                    <div className="flex">
                      <button onClick={() => onOpen(r)} className={iconBtn} aria-label={`Abrir avaliação de ${r.patientName}`}>
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => savePdf(r, showToast)} className={iconBtn} aria-label={`Baixar PDF de ${r.patientName}`}>
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Nível dos alunos">
          {leveled === 0 ? (
            <p className="text-xs text-[#64748B] py-6 text-center">O nível aparece quando a Avaliação do Movimento é preenchida.</p>
          ) : (
            <div className="space-y-3">
              {(['basico', 'intermediario', 'avancado'] as const).map((lv) => (
                <div key={lv}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold">{LEVEL_LABEL[lv]}</span>
                    <span className="text-[#64748B]">
                      {levelCounts[lv]} aluno(s) • {Math.round((levelCounts[lv] / leveled) * 100)}%
                    </span>
                  </div>
                  <ProgressBar value={levelCounts[lv]} max={leveled} tone={LEVEL_TONE[lv]} label={LEVEL_LABEL[lv]} />
                </div>
              ))}
              <p className="text-[11px] text-[#64748B]">Pela avaliação mais recente de cada aluno.</p>
            </div>
          )}
        </Card>
      </div>

      <Card title="Pendências" action={<span className="text-[11px] text-[#64748B]">{pending.length} aluno(s)</span>}>
        {pending.length === 0 ? (
          <p className="text-xs text-[#64748B] py-4 text-center">Todos os alunos ativos estão com a avaliação em dia.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {pending.map(({ p, reason, tone }) => (
              <li key={p.id} className="p-2.5 rounded-lg border border-[#E5EAE7] dark:border-[#273830] flex items-center gap-2.5">
                <Avatar name={p.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <Pill tone={tone}>{reason}</Pill>
                </div>
                <button onClick={() => onEvaluate(p.id)} className={btnPrimary}>
                  Avaliar
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

/** Student header above the ficha: who they are, plan, clinical alerts and level history */
const PatientEvalSummary: React.FC<{ patient: Patient; history: EvaluationRecord[] }> = ({ patient, history }) => {
  const plan = clinicStorage.getPlans().find((pl) => pl.id === patient.activePlanId);
  const age = ageOf(patient.birthDate);
  const chronological = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const levels = chronological
    .map((r) => ({ r, lv: computeMovementLevel(r.sections, r.values) }))
    .filter((x) => x.lv);
  const last = history[0];
  const today = new Date().toISOString().slice(0, 10);
  const overdue = last && daysBetween(last.date, today) > REEVALUATION_DAYS;

  return (
    <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <Avatar name={patient.name} size="lg" />
        <div className="min-w-0 space-y-1">
          <p className="font-bold text-base truncate">{patient.name}</p>
          <p className="text-[11px] text-[#64748B]">
            {[age !== undefined && `${age} anos`, patient.phone, patient.modality].filter(Boolean).join(' • ')}
          </p>
          <p className="text-[11px] text-[#64748B]">
            {plan ? `${plan.name} • ` : ''}
            {patient.sessionsRemaining} sessões restantes
          </p>
          {patient.clinicalAlerts && patient.clinicalAlerts.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {patient.clinicalAlerts.map((a) => (
                <Pill key={a} tone="rose" title="Alerta clínico do cadastro">
                  <AlertTriangle className="w-3 h-3" /> {a}
                </Pill>
              ))}
            </div>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <dt className="text-[#64748B]">Avaliações</dt>
          <dd className="text-lg font-bold">{history.length}</dd>
        </div>
        <div>
          <dt className="text-[#64748B]">Última avaliação</dt>
          <dd className="text-sm font-bold mt-1">{last ? formatDate(last.date) : '—'}</dd>
          {last && (
            <span className={`text-[10px] ${overdue ? 'text-amber-600 font-semibold' : 'text-[#64748B]'}`}>
              há {daysBetween(last.date, today)} dias{overdue ? ' • reavaliar' : ''}
            </span>
          )}
        </div>
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-[#64748B]">Evolução do nível</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-1">
            {levels.length === 0 ? (
              <span className="text-sm font-bold">—</span>
            ) : (
              levels.slice(-4).map(({ r, lv }, i) => (
                <React.Fragment key={r.id}>
                  {i > 0 && <span className="text-[#94A3B8]">→</span>}
                  <Pill tone={LEVEL_TONE[lv!.level]} title={formatDate(r.date)}>
                    {LEVEL_LABEL[lv!.level]}
                  </Pill>
                </React.Fragment>
              ))
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
};

/**
 * The Avaliação section: pick the student and the ficha, fill it in on the page, save it and
 * download the PDF. Earlier evaluations of the student are listed below to reopen.
 */
const EvaluationWorkspace: React.FC<{ patients: Patient[]; templates: EvaluationTemplate[]; initialPatientId?: string }> = ({
  patients,
  templates,
  initialPatientId,
}) => {
  const { showToast } = useToast();
  const [patientId, setPatientId] = useState(initialPatientId || '');
  const [templateId, setTemplateId] = useState(templates[0]?.id || '');
  const [rec, setRec] = useState<EvaluationRecord | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [history, setHistory] = useState<EvaluationRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<EvaluationRecord | null>(null);
  const patient = patients.find((p) => p.id === patientId) || null;
  const dirty = !!rec && JSON.stringify([rec.values, rec.details, rec.date]) !== savedSnapshot;

  useEffect(() => {
    if (initialPatientId) setPatientId(initialPatientId);
  }, [initialPatientId]);
  useEffect(() => {
    if (!templates.some((t) => t.id === templateId)) setTemplateId(templates[0]?.id || '');
  }, [templates, templateId]);
  useEffect(() => {
    const load = () => setHistory(patientId ? clinicStorage.getEvaluations(patientId) : []);
    load();
    return clinicStorage.subscribe(load);
  }, [patientId]);

  const open = (r: EvaluationRecord | null) => {
    setRec(r);
    setSavedSnapshot(r && clinicStorage.getEvaluations(r.patientId).some((e) => e.id === r.id) ? JSON.stringify([r.values, r.details, r.date]) : '');
  };
  // a record chosen on the dashboard opens instead of a blank ficha
  const pendingOpen = useRef<EvaluationRecord | null>(null);
  // a new blank (prefilled) ficha whenever the student or the ficha changes
  useEffect(() => {
    const pending = pendingOpen.current;
    pendingOpen.current = null;
    if (pending && pending.patientId === patientId) {
      open({ ...pending, sections: cloneSections(pending.sections) });
      return;
    }
    const tpl = templates.find((t) => t.id === templateId);
    open(patient && tpl ? newRecord(tpl, patient) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, templateId]);

  const openExisting = (r: EvaluationRecord) => {
    if (!confirmDiscard()) return;
    if (r.patientId === patientId) open({ ...r, sections: cloneSections(r.sections) });
    else {
      pendingOpen.current = r;
      setPatientId(r.patientId);
    }
  };

  const allFields = rec ? rec.sections.flatMap((s) => s.fields) : [];
  const filledCount = rec ? allFields.filter((fl) => (rec.values[fl.id] || '').trim() !== '').length : 0;
  const filledPct = allFields.length ? Math.round((filledCount / allFields.length) * 100) : 0;

  const confirmDiscard = () => !dirty || window.confirm('Há alterações não salvas nesta avaliação. Descartar?');

  const handleSave = () => {
    if (!rec) return null;
    const toSave = { ...rec, updatedAt: new Date().toISOString() };
    if (!clinicStorage.saveEvaluation(toSave)) {
      showToast('Não foi possível salvar (armazenamento cheio).', 'error');
      return null;
    }
    setSavedSnapshot(JSON.stringify([toSave.values, toSave.details, toSave.date]));
    showToast('Avaliação salva no perfil do aluno!', 'success');
    return toSave;
  };

  const handlePdf = async () => {
    if (!rec) return;
    setBusy(true);
    // the downloaded ficha always matches what is stored
    const saved = dirty ? handleSave() : rec;
    if (saved) await savePdf(saved, showToast);
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      {/* selection bar */}
      <div className="p-3 rounded-xl border border-[#E5EAE7] dark:border-[#263730] bg-white dark:bg-[#141F19] grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 sm:items-end">
        <div>
          <label htmlFor="ev-aluno" className="block text-xs font-semibold mb-1">Aluno</label>
          <select
            id="ev-aluno"
            value={patientId}
            onChange={(e) => confirmDiscard() && setPatientId(e.target.value)}
            className={input}
          >
            <option value="">Selecione o aluno…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ev-ficha" className="block text-xs font-semibold mb-1">Ficha</label>
          <select
            id="ev-ficha"
            value={templateId}
            onChange={(e) => confirmDiscard() && setTemplateId(e.target.value)}
            className={input}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        {rec && (
          <div>
            <label htmlFor="ev-data" className="block text-xs font-semibold mb-1">Data</label>
            <input id="ev-data" type="date" value={rec.date} onChange={(e) => setRec({ ...rec, date: e.target.value })} className={input} />
          </div>
        )}
      </div>

      {!rec || !patient ? (
        <EvaluationDashboard patients={patients} onEvaluate={(id) => setPatientId(id)} onOpen={openExisting} />
      ) : (
        <>
          <PatientEvalSummary patient={patient} history={history} />

          {/* actions stay visible while scrolling the ficha */}
          <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-[#F6F8F7]/95 dark:bg-[#0C130F]/95 backdrop-blur space-y-2">
            <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[10rem]">
              <span className="block text-xs text-[#64748B]">
                {savedSnapshot ? (dirty ? 'Alterações não salvas' : 'Salva') : 'Nova avaliação (ainda não salva)'} • {filledCount}/{allFields.length} itens ({filledPct}%)
              </span>
              <div className="mt-1 max-w-xs">
                <ProgressBar value={filledPct} tone="blue" label="Ficha preenchida" />
              </div>
            </div>
            <button
              onClick={() => {
                if (!confirmDiscard()) return;
                const tpl = templates.find((t) => t.id === templateId);
                if (tpl && patient) open(newRecord(tpl, patient));
              }}
              className={btn}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Nova
            </button>
            <button onClick={handleSave} className={btn}>
              <Save className="w-3.5 h-3.5" /> Salvar
            </button>
            <button onClick={handlePdf} disabled={busy} className={`${btnPrimary} disabled:opacity-60`}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Baixar PDF
            </button>
            </div>
            {/* jump to a part of the ficha, with how much of it is filled */}
            <nav aria-label="Seções da ficha" className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {rec.sections.map((sec) => {
                const done = sec.fields.filter((fl) => (rec.values[fl.id] || '').trim() !== '').length;
                const complete = done === sec.fields.length;
                return (
                  <button
                    key={sec.id}
                    onClick={() => document.getElementById(`ev-sec-${sec.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                      complete
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-900 dark:text-emerald-300'
                        : 'bg-white dark:bg-[#141F19] border-[#E5EAE7] dark:border-[#263730] text-[#64748B] dark:text-[#9AA8B6]'
                    }`}
                  >
                    {sec.title} <span className="opacity-70">{done}/{sec.fields.length}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="space-y-4">
            <EvaluationFormBody rec={rec} setRec={setRec as React.Dispatch<React.SetStateAction<EvaluationRecord>>} />
          </div>
        </>
      )}

      {patient && history.length > 0 && (
        <section className="space-y-2" aria-labelledby="ev-hist">
          <h3 id="ev-hist" className="text-xs font-bold uppercase text-[#64748B] tracking-wider">
            Avaliações anteriores de {patient.name.split(' ')[0]}
          </h3>
          <ul className="space-y-2">
            {history.map((r) => {
              const lv = computeMovementLevel(r.sections, r.values);
              const isOpen = rec?.id === r.id;
              return (
                <li
                  key={r.id}
                  className={`p-3 rounded-xl border bg-white dark:bg-[#17231D] flex flex-wrap items-center gap-2 ${
                    isOpen ? 'border-[#426B5B]' : 'border-[#E5EAE7] dark:border-[#273830]'
                  }`}
                >
                  <FileText className="w-4 h-4 text-[#426B5B] dark:text-[#7FB39F]" />
                  <div className="flex-1 min-w-[10rem]">
                    <p className="text-sm font-semibold">
                      {r.templateName} {isOpen && <span className="text-[10px] font-bold text-[#426B5B]">(aberta)</span>}
                    </p>
                    <p className="text-[11px] text-[#64748B]">
                      {formatDate(r.date)} • {r.professionalName}
                      {lv && ` • Nível ${LEVEL_LABEL[lv.level]}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        if (!confirmDiscard()) return;
                        open({ ...r, sections: cloneSections(r.sections) });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={iconBtn}
                      aria-label="Abrir para editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => savePdf(r, showToast)} className={iconBtn} aria-label="Baixar PDF">
                      <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => setToDelete(r)} className={`${iconBtn} hover:text-rose-600`} aria-label="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {toDelete && (
        <Modal isOpen={true} onClose={() => setToDelete(null)} title="Excluir avaliação" description={`${toDelete.templateName} — ${formatDate(toDelete.date)}`} maxWidth="md">
          <p className="text-xs">A avaliação será removida do perfil do aluno.</p>
          <div className="flex justify-end gap-2 pt-4">
            <button onClick={() => setToDelete(null)} className="px-4 py-2 text-xs font-semibold text-[#64748B]">
              Cancelar
            </button>
            <button
              onClick={() => {
                clinicStorage.deleteEvaluation(toDelete.id);
                if (rec?.id === toDelete.id) {
                  const tpl = templates.find((t) => t.id === templateId);
                  open(tpl && patient ? newRecord(tpl, patient) : null);
                }
                showToast('Avaliação excluída.', 'info');
                setToDelete(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
            >
              Excluir
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

const EvaluationForm: React.FC<{ record: EvaluationRecord; onClose: () => void }> = ({ record, onClose }) => {
  const { showToast } = useToast();
  const [rec, setRec] = useState(record);
  const [date, setDate] = useState(record.date);

  const handleSave = () => {
    if (!clinicStorage.saveEvaluation({ ...rec, date })) return showToast('Não foi possível salvar (armazenamento cheio).', 'error');
    showToast('Avaliação salva no perfil do aluno!', 'success');
    onClose();
  };

  return (
    <Sheet
      title={`${rec.templateName} — ${rec.patientName}`}
      onClose={onClose}
      actions={
        <>
          <button
            onClick={() => {
              const toSave = { ...rec, date };
              if (clinicStorage.saveEvaluation(toSave)) savePdf(toSave, showToast);
            }}
            className={btn}
            title="Salva e baixa o PDF"
          >
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Baixar PDF</span>
          </button>
          <button onClick={handleSave} className={btnPrimary}>
            <CheckCircle2 className="w-4 h-4" /> Salvar
          </button>
        </>
      }
    >
      <div className="h-full overflow-y-auto p-3 sm:p-5">
        <div className="max-w-3xl mx-auto space-y-4 pb-10">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Data do registro</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
            </div>
            <p className="text-[11px] text-[#64748B]">Profissional: {rec.professionalName}</p>
          </div>
          <EvaluationFormBody rec={rec} setRec={setRec} />
        </div>
      </div>
    </Sheet>
  );
};

const EvaluationPrint: React.FC<{ rec: EvaluationRecord; onClose: () => void }> = ({ rec, onClose }) => {
  const { showToast } = useToast();
  const printId = `ev-print-${rec.id}`;
  const settings = clinicStorage.getSettings();
  return (
    <Sheet
      title={`${rec.templateName} — ${rec.patientName}`}
      onClose={onClose}
      actions={
        <>
          <button onClick={() => printElement(document.getElementById(printId), `${rec.templateName} — ${rec.patientName}`)} className={btn}>
            <Printer className="w-4 h-4" /> <span className="hidden sm:inline">Imprimir</span>
          </button>
          <button onClick={() => savePdf(rec, showToast)} className={btnPrimary}>
            <Download className="w-4 h-4" /> Baixar PDF
          </button>
        </>
      }
    >
      <div className="h-full overflow-y-auto p-3 sm:p-5">
        <article id={printId} className="max-w-3xl mx-auto bg-white dark:bg-[#17231D] rounded-xl border border-[#E5EAE7] dark:border-[#273830] p-4 sm:p-6 space-y-4 text-xs">
          <header className="text-center space-y-0.5">
            <h2 className="text-base font-bold">{rec.templateName}</h2>
            <p>
              {rec.patientName} • {formatDate(rec.date)} • {rec.professionalName}
            </p>
            <p className="text-[#64748B]">{settings.clinicName}</p>
          </header>
          {rec.sections.map((sec) => (
            <section key={sec.id}>
              <h3 className="font-bold uppercase tracking-wide text-[11px] border-b border-[#E5EAE7] dark:border-[#273830] pb-1 mb-1.5">{sec.title}</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                {sec.fields.map((fl) => (
                  <div key={fl.id} className="flex gap-1.5">
                    <dt className="font-semibold shrink-0">{fl.label}:</dt>
                    <dd className="text-[#475569] dark:text-[#9AA8B6] whitespace-pre-wrap">{formatAnswer(fl, rec) || '—'}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <LevelBadge sections={rec.sections} values={rec.values} />
        </article>
      </div>
    </Sheet>
  );
};

// ───────────────────────── Patient panel (section + patient profile) ─────────────────────────

export const EvaluationsPanel: React.FC<{ patient: Patient }> = ({ patient }) => {
  const { showToast } = useToast();
  const [records, setRecords] = useState<EvaluationRecord[]>([]);
  const [templates, setTemplates] = useState<EvaluationTemplate[]>([]);
  const [pickTemplate, setPickTemplate] = useState(false);
  const [editing, setEditing] = useState<EvaluationRecord | null>(null);
  const [viewing, setViewing] = useState<EvaluationRecord | null>(null);
  const [toDelete, setToDelete] = useState<EvaluationRecord | null>(null);

  useEffect(() => {
    const load = () => {
      setRecords(clinicStorage.getEvaluations(patient.id));
      setTemplates(clinicStorage.getEvaluationTemplates());
    };
    load();
    return clinicStorage.subscribe(load);
  }, [patient.id]);

  const startFrom = (tpl: EvaluationTemplate) => {
    const user = clinicStorage.getCurrentUser();
    const sections = cloneSections(tpl.sections);
    const now = new Date().toISOString();
    setPickTemplate(false);
    setEditing({
      id: newId('aval'),
      patientId: patient.id,
      patientName: patient.name,
      templateId: tpl.id,
      templateName: tpl.name,
      sections,
      values: prefill(sections, patient),
      details: {},
      date: now.slice(0, 10),
      professionalId: user.id,
      professionalName: user.name,
      createdAt: now,
      updatedAt: now,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase text-[#64748B] tracking-wider">Fichas de avaliação</h3>
        <button onClick={() => (templates.length === 1 ? startFrom(templates[0]) : setPickTemplate(true))} className={btnPrimary}>
          <Plus className="w-3.5 h-3.5" /> Nova avaliação
        </button>
      </div>

      {records.length === 0 ? (
        <p className="p-6 text-center text-xs text-[#64748B] rounded-xl border border-dashed border-[#E5EAE7] dark:border-[#273830]">
          Nenhuma avaliação registrada para {patient.name.split(' ')[0]}.
        </p>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => {
            const lv = computeMovementLevel(r.sections, r.values);
            return (
              <li key={r.id} className="p-3 rounded-xl border border-[#E5EAE7] dark:border-[#273830] bg-white dark:bg-[#17231D] flex flex-wrap items-center gap-2">
                <FileText className="w-4 h-4 text-[#426B5B] dark:text-[#7FB39F]" />
                <div className="flex-1 min-w-[10rem]">
                  <p className="text-sm font-semibold">{r.templateName}</p>
                  <p className="text-[11px] text-[#64748B]">
                    {formatDate(r.date)} • {r.professionalName}
                    {lv && ` • Nível ${LEVEL_LABEL[lv.level]}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setViewing(r)} className={iconBtn} aria-label="Ver e imprimir">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditing(r)} className={iconBtn} aria-label="Editar">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setToDelete(r)} className={`${iconBtn} hover:text-rose-600`} aria-label="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pickTemplate && (
        <Modal isOpen={true} onClose={() => setPickTemplate(false)} title="Escolha a ficha" description={patient.name} maxWidth="md">
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.id}>
                <button onClick={() => startFrom(t)} className={`${btn} w-full justify-start py-3`}>
                  <ClipboardCheck className="w-4 h-4" /> {t.name}
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
      {editing && <EvaluationForm record={editing} onClose={() => setEditing(null)} />}
      {viewing && <EvaluationPrint rec={viewing} onClose={() => setViewing(null)} />}
      {toDelete && (
        <Modal isOpen={true} onClose={() => setToDelete(null)} title="Excluir avaliação" description={`${toDelete.templateName} — ${formatDate(toDelete.date)}`} maxWidth="md">
          <p className="text-xs">A avaliação será removida do perfil do aluno.</p>
          <div className="flex justify-end gap-2 pt-4">
            <button onClick={() => setToDelete(null)} className="px-4 py-2 text-xs font-semibold text-[#64748B]">
              Cancelar
            </button>
            <button
              onClick={() => {
                clinicStorage.deleteEvaluation(toDelete.id);
                showToast('Avaliação excluída.', 'info');
                setToDelete(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
            >
              Excluir
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ───────────────────────── Section ─────────────────────────

export const EvaluationsView: React.FC<{ patientId?: string }> = ({ patientId }) => {
  const { showToast } = useToast();
  const [tab, setTab] = useState<'alunos' | 'modelos'>('alunos');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [templates, setTemplates] = useState<EvaluationTemplate[]>([]);
  const [selectedId, setSelectedId] = useState(patientId || '');
  const [search, setSearch] = useState('');
  const [editingTpl, setEditingTpl] = useState<{ tpl: EvaluationTemplate; pdfPages?: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [tplToDelete, setTplToDelete] = useState<EvaluationTemplate | null>(null);

  useEffect(() => {
    const load = () => {
      setPatients(clinicStorage.getPatients().filter((p) => p.status !== 'arquivado'));
      setTemplates(clinicStorage.getEvaluationTemplates());
    };
    load();
    return clinicStorage.subscribe(load);
  }, []);
  useEffect(() => {
    if (patientId) {
      setSelectedId(patientId);
      setTab('alunos');
    }
  }, [patientId]);

  const filtered = useMemo(() => patients.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase())), [patients, search]);
  const selected = patients.find((p) => p.id === selectedId) || null;

  const handleImport = async (file?: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) return showToast('Escolha um arquivo PDF.', 'error');
    setImporting(true);
    try {
      const [tpl, pages] = await Promise.all([templateFromPdf(file), renderPdfPages(file)]);
      if (tpl.sections.length === 0) {
        showToast('Não encontrei texto no PDF (pode ser uma foto/scan). Monte a ficha manualmente ao lado do PDF.', 'info');
        tpl.sections = [{ id: newId('sec'), title: 'Nova seção', fields: [{ id: newId('fld'), label: '', type: 'text' }] }];
      }
      setEditingTpl({ tpl, pdfPages: pages });
    } catch (err) {
      console.error(err);
      showToast('Não foi possível ler este PDF.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const tabBtn = (id: typeof tab, label: string) => (
    <button
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-semibold ${tab === id ? 'bg-[#426B5B] text-white' : 'text-[#64748B] hover:bg-[#F1F5F3] dark:hover:bg-[#1F332A]'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-[#426B5B] dark:text-[#7FB39F]" /> Avaliações
        </h1>
        <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
          Preencha a ficha do aluno direto aqui e baixe o PDF. Na aba “Editar ficha” você adiciona ou apaga itens e importa o PDF da clínica.
        </p>
      </div>

      <div role="tablist" className="flex gap-1 p-1 rounded-xl bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730] w-full sm:w-fit">
        {tabBtn('alunos', 'Preencher avaliação')}
        {tabBtn('modelos', 'Editar ficha')}
      </div>

      {tab === 'alunos' ? (
        <EvaluationWorkspace patients={patients} templates={templates} initialPatientId={selectedId || undefined} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-[#426B5B]/50 bg-white dark:bg-[#141F19] cursor-pointer hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A] ${
                importing ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              {importing ? <Loader2 className="w-6 h-6 animate-spin text-[#426B5B]" /> : <FileUp className="w-6 h-6 text-[#426B5B] dark:text-[#7FB39F]" />}
              <span>
                <span className="block text-sm font-bold">{importing ? 'Lendo o PDF…' : 'Importar ficha de um PDF'}</span>
                <span className="block text-[11px] text-[#64748B]">
                  O sistema lê o PDF e monta a ficha. Você confere lado a lado e ajusta antes de salvar.
                </span>
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => {
                  handleImport(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            <button
              onClick={() => {
                const now = new Date().toISOString();
                setEditingTpl({
                  tpl: {
                    id: newId('tpl'),
                    name: 'Nova ficha',
                    sections: [{ id: newId('sec'), title: 'Identificação', fields: [{ id: newId('fld'), label: 'Nome', type: 'text' }] }],
                    createdAt: now,
                    updatedAt: now,
                  },
                });
              }}
              className="flex items-center gap-3 p-4 rounded-2xl border border-[#E5EAE7] dark:border-[#263730] bg-white dark:bg-[#141F19] text-left hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]"
            >
              <Plus className="w-6 h-6 text-[#426B5B] dark:text-[#7FB39F]" />
              <span>
                <span className="block text-sm font-bold">Criar ficha do zero</span>
                <span className="block text-[11px] text-[#64748B]">Adicione seções e itens do jeito que preferir.</span>
              </span>
            </button>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map((t) => (
              <li key={t.id} className="p-4 rounded-2xl border border-[#E5EAE7] dark:border-[#263730] bg-white dark:bg-[#141F19] space-y-2">
                <div className="flex items-start gap-2">
                  <ClipboardCheck className="w-5 h-5 mt-0.5 text-[#426B5B] dark:text-[#7FB39F]" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{t.name}</p>
                    <p className="text-[11px] text-[#64748B]">
                      {t.sections.length} seções • {t.sections.reduce((n, s) => n + s.fields.length, 0)} itens
                      {t.sourceFileName && ` • de ${t.sourceFileName}`}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-[#64748B] line-clamp-2">{t.sections.map((s) => s.title).join(' • ')}</p>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setEditingTpl({ tpl: { ...t, sections: cloneSections(t.sections) } })} className={btn}>
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date().toISOString();
                      clinicStorage.saveEvaluationTemplate({ ...t, id: newId('tpl'), name: `${t.name} (cópia)`, sections: cloneSections(t.sections, true), createdAt: now, updatedAt: now });
                      showToast('Cópia criada.', 'success');
                    }}
                    className={btn}
                  >
                    <Copy className="w-3.5 h-3.5" /> Duplicar
                  </button>
                  <button onClick={() => setTplToDelete(t)} className={`${btn} text-rose-600`} aria-label={`Excluir ${t.name}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-[#64748B]">
            Na “Avaliação do movimento”, cada item vale de 0 a 3. A média sugere o bloco de exercícios: abaixo de 1,5 Básico; até 2,25
            Médio; acima, Avançado. Avaliações já registradas guardam a ficha usada e não mudam se o modelo for editado.
          </p>
        </div>
      )}

      {editingTpl && <TemplateEditor initial={editingTpl.tpl} pdfPages={editingTpl.pdfPages} onClose={() => setEditingTpl(null)} />}
      {tplToDelete && (
        <Modal isOpen={true} onClose={() => setTplToDelete(null)} title="Excluir modelo" description={tplToDelete.name} maxWidth="md">
          <p className="text-xs">O modelo some da lista. Avaliações já registradas com ele continuam salvas.</p>
          <div className="flex justify-end gap-2 pt-4">
            <button onClick={() => setTplToDelete(null)} className="px-4 py-2 text-xs font-semibold text-[#64748B]">
              Cancelar
            </button>
            <button
              onClick={() => {
                if (templates.length === 1) {
                  // keep at least one template: replace the last one by the standard ficha
                  clinicStorage.saveEvaluationTemplate(buildDefaultTemplate());
                }
                clinicStorage.deleteEvaluationTemplate(tplToDelete.id);
                showToast('Modelo excluído.', 'info');
                setTplToDelete(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
            >
              Excluir
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
