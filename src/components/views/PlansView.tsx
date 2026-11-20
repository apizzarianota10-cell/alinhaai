import React, { useEffect, useState } from 'react';
import { CreditCard, Layers, Plus, Users, User, Pencil, Trash2, Check, X, Power } from 'lucide-react';
import { clinicStorage } from '../../lib/storage';
import { formatCurrency, parseBRLToCents } from '../../lib/utils';
import { Plan, ServiceArea } from '../../types';
import { Modal } from '../common/Modal';
import { useToast } from '../common/Toast';

const card = 'bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-2xl p-4 sm:p-6 shadow-xs space-y-4';
const input = 'w-full text-xs sm:text-sm px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg';
const btnGhost = 'px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-[#E5EAE7] dark:border-[#273830] bg-white dark:bg-[#17231D] hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] flex items-center gap-1';

/** Plans created before areas existed cover Pilates only */
const planAreaIds = (pl: Plan, areas: ServiceArea[]) =>
  pl.areaIds?.length ? pl.areaIds : areas.filter((a) => a.name === 'Pilates').map((a) => a.id);

type PlanDraft = {
  name: string;
  price: string;
  sessions: number;
  frequency: number;
  validity: number;
  duration: number;
  replacement: string;
  description: string;
  areaIds: string[];
  format: 'individual' | 'turma';
  maxStudents: number;
};

export const PlansView: React.FC = () => {
  const { showToast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [areas, setAreas] = useState<ServiceArea[]>([]);

  // area editor
  const [newAreaName, setNewAreaName] = useState('');
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [editingAreaName, setEditingAreaName] = useState('');

  // plan editor
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);

  useEffect(() => {
    const load = () => {
      setPlans(clinicStorage.getPlans());
      setAreas(clinicStorage.getServiceAreas());
    };
    load();
    return clinicStorage.subscribe(load);
  }, []);

  // ───────── Areas ─────────
  const saveAreas = (next: ServiceArea[]) => clinicStorage.saveServiceAreas(next);
  const updateArea = (id: string, patch: Partial<ServiceArea>) => saveAreas(areas.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const handleAddArea = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newAreaName.trim();
    if (!name) return;
    if (areas.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
      showToast('Já existe uma área com esse nome.', 'error');
      return;
    }
    saveAreas([...areas, { id: `area-${Date.now()}`, name, allowsGroups: false, active: true }]);
    setNewAreaName('');
    showToast(`Área "${name}" criada.`, 'success');
  };

  const handleRenameArea = (area: ServiceArea) => {
    const name = editingAreaName.trim();
    if (!name) return;
    if (areas.some((a) => a.id !== area.id && a.name.toLowerCase() === name.toLowerCase())) {
      showToast('Já existe uma área com esse nome.', 'error');
      return;
    }
    updateArea(area.id, { name });
    setEditingAreaId(null);
    showToast('Área renomeada. Agendamentos antigos mantêm o nome anterior.', 'info');
  };

  const handleDeleteArea = (area: ServiceArea) => {
    const used = plans.filter((p) => planAreaIds(p, areas).includes(area.id));
    if (used.length) {
      showToast(`Usada em ${used.length} plano(s). Desative a área ou remova-a dos planos antes.`, 'error');
      return;
    }
    if (areas.length === 1) {
      showToast('A clínica precisa de pelo menos uma área.', 'error');
      return;
    }
    saveAreas(areas.filter((a) => a.id !== area.id));
    showToast(`Área "${area.name}" removida.`, 'info');
  };

  // ───────── Plans ─────────
  const activeAreas = areas.filter((a) => a.active);

  const openNewPlan = () => {
    const pilates = activeAreas.find((a) => a.name === 'Pilates') || activeAreas[0];
    setEditingPlan(null);
    setDraft({
      name: '',
      price: '350,00',
      sessions: 8,
      frequency: 2,
      validity: 30,
      duration: clinicStorage.getSettings().defaultSessionDurationMinutes || 50,
      replacement: 'Até 2 reposições no mês com aviso prévio.',
      description: '',
      areaIds: pilates ? [pilates.id] : [],
      format: 'individual',
      maxStudents: pilates?.defaultCapacity || 3,
    });
    setIsPlanModalOpen(true);
  };

  const openEditPlan = (pl: Plan) => {
    setEditingPlan(pl);
    setDraft({
      name: pl.name,
      price: (pl.priceCents / 100).toFixed(2).replace('.', ','),
      sessions: pl.sessionsCount,
      frequency: pl.frequencyPerWeek,
      validity: pl.validityDays,
      duration: pl.durationMinutes,
      replacement: pl.replacementConditions,
      description: pl.description,
      areaIds: planAreaIds(pl, areas),
      format: pl.format || 'individual',
      maxStudents: pl.maxStudents || 3,
    });
    setIsPlanModalOpen(true);
  };

  const handleSavePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const priceCents = parseBRLToCents(draft.price);
    if (!draft.name.trim()) return showToast('Dê um nome ao plano.', 'error');
    if (!priceCents || priceCents < 0) return showToast('Valor do plano inválido. Use o formato 350,00.', 'error');
    if (draft.sessions < 1 || draft.frequency < 1 || draft.validity < 1 || draft.duration < 10)
      return showToast('Sessões, frequência, validade e duração precisam ser maiores que zero.', 'error');
    if (draft.areaIds.length === 0) return showToast('Escolha pelo menos uma área para o plano.', 'error');

    const planData: Plan = {
      ...editingPlan,
      id: editingPlan ? editingPlan.id : `plan-${Date.now()}`,
      name: draft.name.trim(),
      priceCents,
      sessionsCount: draft.sessions,
      frequencyPerWeek: draft.frequency,
      validityDays: draft.validity,
      durationMinutes: draft.duration,
      replacementConditions: draft.replacement.trim(),
      description: draft.description.trim(),
      active: editingPlan ? editingPlan.active : true,
      areaIds: draft.areaIds,
      format: draft.format,
      maxStudents: draft.format === 'turma' ? Math.max(2, draft.maxStudents) : undefined,
    };
    clinicStorage.savePlan(planData);
    showToast('Plano salvo!', 'success');
    setIsPlanModalOpen(false);
  };

  const handleDeletePlan = () => {
    if (!planToDelete) return;
    const inUse = clinicStorage.getPatients().filter((p) => p.activePlanId === planToDelete.id).length;
    if (inUse) {
      showToast(`${inUse} paciente(s) usam este plano. Desative-o em vez de excluir.`, 'error');
      setPlanToDelete(null);
      return;
    }
    clinicStorage.deletePlan(planToDelete.id);
    showToast('Plano excluído.', 'info');
    setPlanToDelete(null);
  };

  const groupableSelected = draft ? areas.some((a) => draft.areaIds.includes(a.id) && a.allowsGroups) : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17231D] dark:text-[#F1F5F3]">Planos e Áreas</h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
            Defina as áreas de atendimento da clínica e personalize cada plano: valores, sessões, formato e áreas cobertas.
          </p>
        </div>
        <button
          onClick={openNewPlan}
          className="self-start sm:self-auto px-3.5 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Novo Plano
        </button>
      </div>

      {/* AREAS */}
      <section className={card} aria-labelledby="areas-title">
        <div className="flex items-center gap-2 pb-3 border-b border-[#E5EAE7] dark:border-[#273830]">
          <Layers className="w-4 h-4 text-[#426B5B] dark:text-[#5A8E7A]" />
          <h2 id="areas-title" className="text-sm font-bold uppercase tracking-wider">Áreas de atendimento</h2>
        </div>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
          As áreas aparecem como modalidade na agenda e definem o que cada plano cobre. Áreas que <b>aceitam turma</b> permitem
          vários alunos no mesmo horário.
        </p>

        <ul className="divide-y divide-[#E5EAE7] dark:divide-[#273830] border border-[#E5EAE7] dark:border-[#273830] rounded-xl">
          {areas.map((area) => (
            <li key={area.id} className={`p-3 flex flex-wrap items-center gap-3 ${area.active ? '' : 'opacity-60'}`}>
              <div className="flex-1 min-w-[10rem]">
                {editingAreaId === area.id ? (
                  <div className="flex gap-1.5">
                    <input
                      autoFocus
                      value={editingAreaName}
                      onChange={(e) => setEditingAreaName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleRenameArea(area))}
                      className={input}
                      aria-label="Nome da área"
                    />
                    <button onClick={() => handleRenameArea(area)} className={btnGhost} aria-label="Salvar nome">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingAreaId(null)} className={btnGhost} aria-label="Cancelar">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="font-semibold text-sm">{area.name}</span>
                )}
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={area.allowsGroups}
                  onChange={(e) => updateArea(area.id, { allowsGroups: e.target.checked, defaultCapacity: area.defaultCapacity || 3 })}
                  className="w-4 h-4 rounded text-[#426B5B] focus:ring-[#426B5B]"
                />
                Aceita turma
              </label>

              {area.allowsGroups && (
                <label className="flex items-center gap-1.5 text-xs">
                  <Users className="w-3.5 h-3.5 text-[#64748B]" />
                  <input
                    type="number"
                    min={1}
                    max={20}
                    inputMode="numeric"
                    value={area.defaultCapacity || 1}
                    onChange={(e) => updateArea(area.id, { defaultCapacity: Math.min(20, Math.max(1, Number(e.target.value) || 1)) })}
                    className="w-14 px-2 py-1.5 text-center bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                    aria-label={`Alunos por horário sugeridos em ${area.name}`}
                  />
                  alunos/horário
                </label>
              )}

              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  onClick={() => {
                    setEditingAreaId(area.id);
                    setEditingAreaName(area.name);
                  }}
                  className={btnGhost}
                  aria-label={`Renomear ${area.name}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => updateArea(area.id, { active: !area.active })} className={btnGhost} title={area.active ? 'Desativar' : 'Ativar'}>
                  <Power className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{area.active ? 'Desativar' : 'Ativar'}</span>
                </button>
                <button onClick={() => handleDeleteArea(area)} className={`${btnGhost} text-rose-600`} aria-label={`Excluir ${area.name}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <form onSubmit={handleAddArea} className="flex gap-2">
          <input
            value={newAreaName}
            onChange={(e) => setNewAreaName(e.target.value)}
            placeholder="Nova área (ex.: RPG, Pilates Solo, Drenagem)"
            className={input}
            aria-label="Nome da nova área"
          />
          <button type="submit" className="shrink-0 px-3 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs font-semibold rounded-lg flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        </form>
      </section>

      {/* PLANS */}
      <section className={card} aria-labelledby="plans-title">
        <div className="flex items-center gap-2 pb-3 border-b border-[#E5EAE7] dark:border-[#273830]">
          <CreditCard className="w-4 h-4 text-[#426B5B] dark:text-[#5A8E7A]" />
          <h2 id="plans-title" className="text-sm font-bold uppercase tracking-wider">Planos e mensalidades</h2>
        </div>

        {plans.length === 0 ? (
          <p className="text-xs text-[#64748B] py-6 text-center">Nenhum plano cadastrado. Clique em “Novo Plano”.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {plans.map((pl) => {
              const ids = planAreaIds(pl, areas);
              return (
                <div
                  key={pl.id}
                  className={`p-4 rounded-xl border border-[#E5EAE7] dark:border-[#273830] bg-[#F8FAF9] dark:bg-[#111A15] flex flex-col gap-2 text-xs ${pl.active ? '' : 'opacity-60'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm">{pl.name}</h3>
                      <p className="text-base font-extrabold text-[#426B5B] dark:text-[#7FB39F]">{formatCurrency(pl.priceCents)}</p>
                    </div>
                    <span
                      className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        pl.format === 'turma'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                          : 'bg-[#E9F1EC] text-[#345648] dark:bg-[#1F332A] dark:text-[#9CCBB8]'
                      }`}
                    >
                      {pl.format === 'turma' ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {pl.format === 'turma' ? `Turma até ${pl.maxStudents}` : 'Individual'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {ids.map((id) => {
                      const a = areas.find((x) => x.id === id);
                      return (
                        <span key={id} className="px-2 py-0.5 rounded-md bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] text-[10px] font-semibold">
                          {a?.name || 'Área removida'}
                        </span>
                      );
                    })}
                  </div>

                  {pl.description && <p className="text-[#64748B] text-[11px]">{pl.description}</p>}

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 pt-2 border-t border-[#E5EAE7] dark:border-[#273830] text-[11px] text-[#64748B]">
                    <dt>Sessões</dt>
                    <dd className="text-right font-semibold text-[#17231D] dark:text-[#F1F5F3]">{pl.sessionsCount}</dd>
                    <dt>Frequência</dt>
                    <dd className="text-right font-semibold text-[#17231D] dark:text-[#F1F5F3]">{pl.frequencyPerWeek}x/semana</dd>
                    <dt>Validade</dt>
                    <dd className="text-right font-semibold text-[#17231D] dark:text-[#F1F5F3]">{pl.validityDays} dias</dd>
                    <dt>Duração</dt>
                    <dd className="text-right font-semibold text-[#17231D] dark:text-[#F1F5F3]">{pl.durationMinutes} min</dd>
                  </dl>
                  {pl.replacementConditions && <p className="text-[11px] text-[#64748B] italic">{pl.replacementConditions}</p>}

                  <div className="mt-auto pt-2 flex flex-wrap gap-1.5">
                    <button onClick={() => openEditPlan(pl)} className={btnGhost}>
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => {
                        clinicStorage.savePlan({ ...pl, active: !pl.active });
                        showToast(pl.active ? `"${pl.name}" desativado para novas vendas.` : `"${pl.name}" reativado.`, 'info');
                      }}
                      className={btnGhost}
                    >
                      <Power className="w-3.5 h-3.5" /> {pl.active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button onClick={() => setPlanToDelete(pl)} className={`${btnGhost} text-rose-600`} aria-label={`Excluir ${pl.name}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* PLAN EDITOR */}
      {isPlanModalOpen && draft && (
        <Modal
          isOpen={true}
          onClose={() => setIsPlanModalOpen(false)}
          title={editingPlan ? 'Editar plano' : 'Novo plano'}
          description="Personalize valores, sessões, formato e as áreas que o plano cobre."
          maxWidth="2xl"
        >
          <form onSubmit={handleSavePlan} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Nome do plano *</label>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ex.: Pilates em turma 2x por semana"
                className={input}
                required
              />
            </div>

            <fieldset>
              <legend className="block text-xs font-semibold mb-1.5">Áreas cobertas *</legend>
              <div className="flex flex-wrap gap-2">
                {areas
                  .filter((a) => a.active || draft.areaIds.includes(a.id))
                  .map((a) => {
                    const on = draft.areaIds.includes(a.id);
                    return (
                      <label
                        key={a.id}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                          on
                            ? 'bg-[#426B5B] border-[#426B5B] text-white'
                            : 'border-[#E5EAE7] dark:border-[#273830] text-[#64748B] dark:text-[#9AA8B6]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          onChange={() =>
                            setDraft({
                              ...draft,
                              areaIds: on ? draft.areaIds.filter((x) => x !== a.id) : [...draft.areaIds, a.id],
                            })
                          }
                        />
                        {on && <Check className="w-3.5 h-3.5" />}
                        {a.name}
                      </label>
                    );
                  })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="block text-xs font-semibold mb-1.5">Formato</legend>
              <div className="grid grid-cols-2 gap-2">
                {(['individual', 'turma'] as const).map((f) => (
                  <label
                    key={f}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-semibold ${
                      f === 'turma' && !groupableSelected ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      draft.format === f
                        ? 'bg-[#426B5B] border-[#426B5B] text-white'
                        : 'border-[#E5EAE7] dark:border-[#273830] text-[#64748B] dark:text-[#9AA8B6]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="format"
                      className="sr-only"
                      disabled={f === 'turma' && !groupableSelected}
                      checked={draft.format === f}
                      onChange={() => setDraft({ ...draft, format: f })}
                    />
                    {f === 'turma' ? <Users className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                    {f === 'turma' ? 'Turma' : 'Individual'}
                  </label>
                ))}
              </div>
              {!groupableSelected && <p className="text-[11px] text-[#64748B] mt-1">Turma exige uma área que aceite turma.</p>}
              {draft.format === 'turma' && groupableSelected && (
                <label className="mt-2 flex items-center gap-2 text-xs">
                  Máximo de alunos por horário
                  <input
                    type="number"
                    min={2}
                    max={20}
                    inputMode="numeric"
                    value={draft.maxStudents}
                    onChange={(e) => setDraft({ ...draft, maxStudents: Number(e.target.value) })}
                    className="w-16 px-2 py-1.5 text-center bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
                  />
                </label>
              )}
            </fieldset>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Valor (R$) *</label>
                <input value={draft.price} inputMode="decimal" onChange={(e) => setDraft({ ...draft, price: e.target.value })} className={`${input} font-bold`} required />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Sessões *</label>
                <input type="number" min={1} max={200} value={draft.sessions} onChange={(e) => setDraft({ ...draft, sessions: Number(e.target.value) })} className={input} required />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Vezes por semana</label>
                <input type="number" min={1} max={7} value={draft.frequency} onChange={(e) => setDraft({ ...draft, frequency: Number(e.target.value) })} className={input} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Validade (dias)</label>
                <input type="number" min={1} max={365} value={draft.validity} onChange={(e) => setDraft({ ...draft, validity: Number(e.target.value) })} className={input} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Duração da sessão (min)</label>
                <input type="number" min={10} max={180} step={5} value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: Number(e.target.value) })} className={input} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Regras de reposição</label>
              <input value={draft.replacement} onChange={(e) => setDraft({ ...draft, replacement: e.target.value })} className={input} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Descrição</label>
              <textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={input} />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button type="button" onClick={() => setIsPlanModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 dark:hover:bg-[#1F332A] rounded-lg">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg shadow-sm">
                Salvar plano
              </button>
            </div>
          </form>
        </Modal>
      )}

      {planToDelete && (
        <Modal isOpen={true} onClose={() => setPlanToDelete(null)} title="Excluir plano" description={planToDelete.name} maxWidth="md">
          <p className="text-xs">O plano será removido. Cobranças já geradas não são alteradas.</p>
          <div className="flex justify-end gap-2 pt-4">
            <button onClick={() => setPlanToDelete(null)} className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg">
              Cancelar
            </button>
            <button onClick={handleDeletePlan} className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg">
              Excluir
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
