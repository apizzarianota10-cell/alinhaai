import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Heart,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ImagePlus,
  Download,
  Camera,
  Trash2,
  Dumbbell,
  X,
} from 'lucide-react';
import { clinicStorage } from '../../lib/storage';
import { Exercise, ExerciseCategory, VisualStep } from '../../types';
import { Modal } from '../common/Modal';
import { useToast } from '../common/Toast';

interface ExercisesViewProps {
  onNavigate: (section: string, payload?: any) => void;
  selectedExerciseId?: string;
}

const CATEGORIES: ExerciseCategory[] = [
  'Pilates Reformer',
  'Pilates Step Chair',
  'Pilates Solo',
  'Mobilidade',
  'Alongamento',
  'Fortalecimento',
  'Exercícios terapêuticos',
];
const EQUIPMENTS: Exercise['equipment'][] = ['Reformer', 'Step Chair', 'Cadillac', 'Solo / Mat', 'Barrel', 'Acessórios', 'Nenhum'];
const BODY_REGIONS: Exercise['bodyRegion'][] = ['Tronco & Core', 'Membros Superiores', 'Membros Inferiores', 'Coluna', 'Corpo Inteiro'];
const PHASES: { title: string; positionType: VisualStep['positionType']; description: string }[] = [
  { title: 'Posição Inicial', positionType: 'inicial', description: 'Posicionamento correto do paciente e calibração das molas/acessórios.' },
  { title: 'Posição Intermediária', positionType: 'intermediaria', description: 'Condução do movimento com crescimento axial e ativação do powerhouse.' },
  { title: 'Posição Final', positionType: 'final', description: 'Retorno com controle excêntrico e desaceleração guiada.' },
];

/** User-created exercises (catalogue ids are like "ex-ref-1") */
const isCustomExercise = (ex: Exercise) => /^ex-\d+$/.test(ex.id);

/** Downscale a photo to a JPEG data URL so 3 images fit comfortably in localStorage */
function resizeImage(file: File, maxSide = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagem inválida'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Three upload slots (inicial / intermediária / final) with previews */
const PhotoSlots: React.FC<{ images: (string | undefined)[]; onChange: (images: (string | undefined)[]) => void }> = ({
  images,
  onChange,
}) => {
  const { showToast } = useToast();
  const handleFile = async (index: number, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Selecione um arquivo de imagem (JPG, PNG ou WEBP).', 'error');
      return;
    }
    try {
      const dataUrl = await resizeImage(file);
      const next = [...images];
      next[index] = dataUrl;
      onChange(next);
    } catch {
      showToast('Não foi possível ler esta imagem.', 'error');
    }
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {PHASES.map((phase, i) => (
        <label
          key={phase.positionType}
          className="relative aspect-[3/2] rounded-xl border-2 border-dashed border-[#E5EAE7] dark:border-[#263730] bg-[#F8FAF9] dark:bg-[#111A15] hover:border-[#426B5B] transition-colors cursor-pointer overflow-hidden flex flex-col items-center justify-center text-center"
        >
          {images[i] ? (
            <>
              <img src={images[i]} alt={phase.title} className="absolute inset-0 w-full h-full object-cover" />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  const next = [...images];
                  next[i] = undefined;
                  onChange(next);
                }}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white"
                aria-label={`Remover foto ${i + 1}`}
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <>
              <Camera className="w-5 h-5 text-[#64748B]" />
              <span className="text-[10px] font-semibold text-[#64748B] mt-1 px-1">{i + 1}. {phase.title}</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              handleFile(i, e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      ))}
    </div>
  );
};

export const ExercisesView: React.FC<ExercisesViewProps> = ({
  onNavigate,
  selectedExerciseId: initialExerciseId,
}) => {
  const { showToast } = useToast();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [equipmentFilter, setEquipmentFilter] = useState<string>('all');
  const [bodyRegionFilter, setBodyRegionFilter] = useState<string>('all');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Detail / Visual Player modal
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playSpeed, setPlaySpeed] = useState<number>(1); // 1 = 1800ms per phase
  const [isEditingMedia, setIsEditingMedia] = useState(false);
  const [mediaDraft, setMediaDraft] = useState<(string | undefined)[]>([]);
  const [exerciseToDelete, setExerciseToDelete] = useState<Exercise | null>(null);

  // New Exercise Modal
  const [isNewExerciseModalOpen, setIsNewExerciseModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<ExerciseCategory>('Pilates Reformer');
  const [formEquipment, setFormEquipment] = useState<Exercise['equipment']>('Reformer');
  const [formBodyRegion, setFormBodyRegion] = useState<Exercise['bodyRegion']>('Tronco & Core');
  const [formObjective, setFormObjective] = useState('');
  const [formShortDesc, setFormShortDesc] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const [formVariations, setFormVariations] = useState('');
  const [formContraindications, setFormContraindications] = useState('');
  const [formImages, setFormImages] = useState<(string | undefined)[]>([]);

  useEffect(() => {
    const load = () => setExercises(clinicStorage.getExercises());
    load();
    return clinicStorage.subscribe(load);
  }, []);

  useEffect(() => {
    if (initialExerciseId) handleOpenDetail(initialExerciseId);
  }, [initialExerciseId]);

  // Always derived from the live list, so favourites / media edits show up immediately
  const selectedExercise = exercises.find((e) => e.id === selectedExerciseId) || null;
  const stepCount = selectedExercise?.steps.length || 0;

  // Autoplay: cycles the 3 phases like an animated GIF
  useEffect(() => {
    if (!isPlaying || stepCount < 2) return;
    const interval = window.setInterval(() => {
      setCurrentStepIndex((prev) => (prev + 1) % stepCount);
    }, 1800 / playSpeed);
    return () => window.clearInterval(interval);
  }, [isPlaying, stepCount, playSpeed]);

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const wasFavorite = exercises.find((x) => x.id === id)?.isFavorite;
    clinicStorage.toggleFavoriteExercise(id);
    showToast(wasFavorite ? 'Removido dos favoritos' : 'Adicionado aos favoritos', 'info');
  };

  function handleOpenDetail(id: string) {
    setSelectedExerciseId(id);
    setCurrentStepIndex(0);
    setIsPlaying(true);
    setIsEditingMedia(false);
  }

  const resetNewExerciseForm = () => {
    setFormName('');
    setFormCategory('Pilates Reformer');
    setFormEquipment('Reformer');
    setFormBodyRegion('Tronco & Core');
    setFormObjective('');
    setFormShortDesc('');
    setFormInstructions('');
    setFormVariations('');
    setFormContraindications('');
    setFormImages([]);
  };

  const buildSteps = (images: (string | undefined)[], base?: VisualStep[]): VisualStep[] =>
    PHASES.map((phase, i) => ({
      step: i + 1,
      title: base?.[i]?.title || phase.title,
      description: base?.[i]?.description || phase.description,
      positionType: phase.positionType,
      imageUrl: images[i],
    }));

  const handleSaveNewExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formObjective.trim()) {
      showToast('Nome e objetivo são obrigatórios', 'error');
      return;
    }
    const uploaded = formImages.filter(Boolean).length;
    if (uploaded > 0 && uploaded < 3) {
      showToast('Envie as 3 fotos (inicial, intermediária e final) ou nenhuma.', 'error');
      return;
    }

    const newEx: Exercise = {
      id: `ex-${Date.now()}`,
      name: formName.trim(),
      category: formCategory,
      equipment: formEquipment,
      bodyRegion: formBodyRegion,
      objective: formObjective.trim(),
      shortDescription: formShortDesc.trim() || formObjective.trim(),
      instructions: formInstructions
        ? formInstructions.split('\n').map((l) => l.replace(/^\s*\d+[.)-]\s*/, '').trim()).filter(Boolean)
        : ['Instrução clínica a definir pelo profissional.'],
      variations: formVariations ? formVariations.split(',').map((v) => v.trim()).filter(Boolean) : [],
      contraindications: formContraindications
        ? formContraindications.split(',').map((v) => v.trim()).filter(Boolean)
        : [],
      steps: buildSteps(formImages),
      mediaSource: uploaded === 3 ? 'upload' : undefined,
      mediaCredit: uploaded === 3 ? 'Fotos enviadas pela clínica' : undefined,
      reviewedByProfessional: true,
      isFavorite: false,
    };

    if (!clinicStorage.saveExercise(newEx)) {
      showToast('Espaço de armazenamento do navegador cheio. Use fotos menores.', 'error');
      return;
    }
    showToast('Exercício adicionado à biblioteca com sucesso!', 'success');
    setIsNewExerciseModalOpen(false);
    resetNewExerciseForm();
  };

  const handleSaveMedia = () => {
    if (!selectedExercise) return;
    if (mediaDraft.filter(Boolean).length < 3) {
      showToast('Envie as 3 fotos para montar a animação.', 'error');
      return;
    }
    const updated: Exercise = {
      ...selectedExercise,
      steps: buildSteps(mediaDraft, selectedExercise.steps),
      gifUrl: undefined,
      mediaSource: 'upload',
      mediaCredit: 'Fotos enviadas pela clínica',
    };
    if (!clinicStorage.saveExercise(updated)) {
      showToast('Espaço de armazenamento do navegador cheio. Use fotos menores.', 'error');
      return;
    }
    showToast('Fotos salvas! A animação já usa as novas imagens.', 'success');
    setIsEditingMedia(false);
    setCurrentStepIndex(0);
    setIsPlaying(true);
  };

  const handleConfirmDelete = () => {
    if (!exerciseToDelete) return;
    clinicStorage.deleteExercise(exerciseToDelete.id);
    showToast('Exercício removido da biblioteca.', 'info');
    if (selectedExerciseId === exerciseToDelete.id) setSelectedExerciseId(null);
    setExerciseToDelete(null);
  };

  const filteredExercises = exercises.filter((ex) => {
    if (onlyFavorites && !ex.isFavorite) return false;
    if (categoryFilter !== 'all' && ex.category !== categoryFilter) return false;
    if (equipmentFilter !== 'all' && ex.equipment !== equipmentFilter) return false;
    if (bodyRegionFilter !== 'all' && ex.bodyRegion !== bodyRegionFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        ex.name.toLowerCase().includes(q) ||
        ex.objective.toLowerCase().includes(q) ||
        ex.shortDescription.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectClass =
    'bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#263730] rounded-lg px-2.5 py-1.5 font-medium';
  const inputClass =
    'w-full px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#263730] rounded-lg';

  const currentStep = selectedExercise?.steps[currentStepIndex];
  const hasImages = !!selectedExercise?.steps.some((s) => s.imageUrl);

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17231D] dark:text-[#EEF3F0]">
            Biblioteca Inteligente de Exercícios
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#9AA8B6]">
            Catálogo técnico com demonstração animada em 3 fases: inicial, intermediária e final.
          </p>
        </div>

        <button
          onClick={() => {
            resetNewExerciseForm();
            setIsNewExerciseModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Exercício</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730] rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar exercício ou objetivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#263730] rounded-lg"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectClass} aria-label="Categoria">
            <option value="all">Todas Categorias</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select value={equipmentFilter} onChange={(e) => setEquipmentFilter(e.target.value)} className={selectClass} aria-label="Aparelho">
            <option value="all">Todos Aparelhos</option>
            {EQUIPMENTS.map((eq) => (
              <option key={eq} value={eq}>{eq}</option>
            ))}
          </select>

          <select value={bodyRegionFilter} onChange={(e) => setBodyRegionFilter(e.target.value)} className={selectClass} aria-label="Região corporal">
            <option value="all">Todas Regiões</option>
            {BODY_REGIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <button
            onClick={() => setOnlyFavorites(!onlyFavorites)}
            aria-pressed={onlyFavorites}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-colors ${
              onlyFavorites
                ? 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300'
                : 'border-[#E5EAE7] dark:border-[#263730] text-[#64748B] dark:text-[#9AA8B6]'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-rose-600 text-rose-600' : ''}`} />
            <span>Favoritos</span>
          </button>
        </div>
      </div>

      {/* Exercises Cards Grid */}
      {filteredExercises.length === 0 ? (
        <div className="p-10 text-center rounded-xl border border-dashed border-[#E5EAE7] dark:border-[#263730] text-sm text-[#64748B] dark:text-[#9AA8B6]">
          <Dumbbell className="w-8 h-8 mx-auto mb-2 opacity-60" />
          Nenhum exercício encontrado com esses filtros.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExercises.map((ex) => {
            const cover = ex.steps[0]?.imageUrl;
            // hovering a card plays its GIF (or the uploaded final frame) as a preview
            const preview = hoveredId === ex.id ? ex.gifUrl || ex.steps[2]?.imageUrl || cover : cover;
            return (
              <div
                key={ex.id}
                role="button"
                tabIndex={0}
                onClick={() => handleOpenDetail(ex.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleOpenDetail(ex.id))}
                onMouseEnter={() => setHoveredId(ex.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="rounded-2xl bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730] shadow-xs hover:shadow-lg hover:-translate-y-0.5 hover:border-[#426B5B] dark:hover:border-[#5A8E7A] transition-all cursor-pointer flex flex-col overflow-hidden group"
              >
                <div className="relative aspect-[3/2] bg-[#F1F5F3] dark:bg-[#111A15] overflow-hidden">
                  {preview ? (
                    <img
                      src={preview}
                      alt={`Demonstração de ${ex.name}`}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#94A3B8]">
                      <ImagePlus className="w-8 h-8" />
                      <span className="text-[11px] mt-1">Sem fotos — envie 3 imagens</span>
                    </div>
                  )}
                  <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider text-white bg-[#17231D]/70 backdrop-blur px-2 py-0.5 rounded">
                    {ex.equipment}
                  </span>
                  {ex.gifUrl || ex.mediaSource === 'upload' ? (
                    <span className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] font-semibold text-white bg-black/55 px-2 py-0.5 rounded-full">
                      <Play className="w-2.5 h-2.5 fill-current" /> 3 fases
                    </span>
                  ) : null}
                  <button
                    onClick={(e) => handleToggleFavorite(ex.id, e)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-white/85 dark:bg-black/50 text-slate-500 hover:text-rose-600 transition-colors"
                    title={ex.isFavorite ? 'Remover dos favoritos' : 'Favoritar exercício'}
                    aria-label={ex.isFavorite ? 'Remover dos favoritos' : 'Favoritar exercício'}
                  >
                    <Heart className={`w-4 h-4 ${ex.isFavorite ? 'fill-rose-600 text-rose-600' : ''}`} />
                  </button>
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-bold text-sm text-[#17231D] dark:text-[#EEF3F0] group-hover:text-[#426B5B] dark:group-hover:text-[#7FB39F] transition-colors">
                    {ex.name}
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#9AA8B6] mt-1 line-clamp-2">{ex.shortDescription}</p>

                  <div className="mt-auto pt-3 flex items-center justify-between text-xs">
                    <span className="text-[#64748B] dark:text-[#9AA8B6] text-[11px] font-medium">{ex.bodyRegion}</span>
                    <span className="text-xs font-semibold text-[#426B5B] dark:text-[#7FB39F] flex items-center gap-1">
                      <span>Ver demonstração</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL & VISUAL SEQUENCE PLAYER MODAL */}
      {selectedExercise && currentStep && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedExerciseId(null)}
          title={selectedExercise.name}
          description={`${selectedExercise.category} • ${selectedExercise.equipment} • ${selectedExercise.bodyRegion}`}
          maxWidth="3xl"
        >
          <div className="space-y-4">
            {/* Visual Sequence Player */}
            <div className="rounded-2xl overflow-hidden border border-[#E5EAE7] dark:border-[#263730] bg-[#F8FAF9] dark:bg-[#111A15]">
              <div className="relative aspect-[3/2] bg-[#E9EFEC] dark:bg-[#0C130F]">
                {hasImages ? (
                  selectedExercise.steps.map((s, i) => (
                    <img
                      key={i}
                      src={s.imageUrl}
                      alt={`${selectedExercise.name} — ${s.title}`}
                      className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${
                        i === currentStepIndex ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  ))
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                    <div className="w-14 h-14 rounded-full bg-[#E9F1EC] dark:bg-[#1F332A] text-[#426B5B] dark:text-[#7FB39F] flex items-center justify-center font-bold text-lg">
                      {currentStepIndex + 1}
                    </div>
                    <p className="text-xs text-[#64748B] dark:text-[#9AA8B6] mt-3 max-w-xs">
                      Este exercício ainda não tem fotos. Envie 3 imagens para montar a demonstração animada.
                    </p>
                  </div>
                )}

                {/* Caption overlay */}
                <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-black/80 via-black/50 to-transparent text-white">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[#426B5B] px-2 py-0.5 rounded">
                      Fase {currentStepIndex + 1} de {stepCount}
                    </span>
                    <h4 className="font-bold text-sm">{currentStep.title}</h4>
                  </div>
                  <p className="text-xs text-white/85 mt-1 max-w-xl">{currentStep.description}</p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-t border-[#E5EAE7] dark:border-[#263730]">
                <div className="flex items-center gap-1.5">
                  {selectedExercise.steps.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setCurrentStepIndex(i);
                        setIsPlaying(false);
                      }}
                      aria-label={`Ir para ${s.title}`}
                      className={`h-2 rounded-full transition-all ${
                        i === currentStepIndex ? 'w-8 bg-[#426B5B] dark:bg-[#7FB39F]' : 'w-2 bg-slate-300 dark:bg-slate-600'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPlaySpeed(playSpeed === 1 ? 2 : playSpeed === 2 ? 0.5 : 1)}
                    className="px-2 py-1 text-[10px] font-bold border border-[#E5EAE7] dark:border-[#263730] rounded-md bg-white dark:bg-[#141F19]"
                    title="Velocidade da animação"
                  >
                    {playSpeed}x
                  </button>
                  <button
                    onClick={() => setCurrentStepIndex((prev) => (prev - 1 + stepCount) % stepCount)}
                    className="p-1.5 rounded-md bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730]"
                    aria-label="Fase anterior"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-1.5 rounded-md bg-[#426B5B] hover:bg-[#345648] text-white"
                    aria-label={isPlaying ? 'Pausar animação' : 'Reproduzir animação'}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  </button>
                  <button
                    onClick={() => setCurrentStepIndex((prev) => (prev + 1) % stepCount)}
                    className="p-1.5 rounded-md bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730]"
                    aria-label="Próxima fase"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Media credit & actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="text-[#64748B] dark:text-[#9AA8B6]">{selectedExercise.mediaCredit || 'Sem mídia cadastrada'}</span>
              <div className="flex items-center gap-2">
                {selectedExercise.gifUrl && (
                  <a
                    href={selectedExercise.gifUrl}
                    download={`${selectedExercise.name}.gif`}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#E5EAE7] dark:border-[#263730] font-semibold hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]"
                  >
                    <Download className="w-3.5 h-3.5" /> Baixar GIF
                  </a>
                )}
                <button
                  onClick={() => {
                    setMediaDraft(
                      selectedExercise.mediaSource === 'upload' ? selectedExercise.steps.map((s) => s.imageUrl) : []
                    );
                    setIsEditingMedia(!isEditingMedia);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#E5EAE7] dark:border-[#263730] font-semibold hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]"
                >
                  <Camera className="w-3.5 h-3.5" /> {isEditingMedia ? 'Cancelar envio' : 'Usar fotos próprias'}
                </button>
              </div>
            </div>

            {isEditingMedia && (
              <div className="p-3 rounded-xl border border-[#E5EAE7] dark:border-[#263730] space-y-3">
                <p className="text-xs text-[#64748B] dark:text-[#9AA8B6]">
                  Envie 3 fotos do seu paciente/instrutor executando o exercício na ordem das fases. Elas substituem a
                  demonstração atual e passam a ser animadas automaticamente.
                </p>
                <PhotoSlots images={mediaDraft} onChange={setMediaDraft} />
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveMedia}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg"
                  >
                    Salvar fotos
                  </button>
                </div>
              </div>
            )}

            {/* Objective & Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730] rounded-xl">
                <span className="font-bold block">Objetivo Clínico</span>
                <p className="text-[#64748B] dark:text-[#9AA8B6] mt-1">{selectedExercise.objective}</p>
              </div>

              {selectedExercise.contraindications && selectedExercise.contraindications.length > 0 && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl">
                  <span className="font-bold flex items-center gap-1 text-rose-800 dark:text-rose-300">
                    <AlertTriangle className="w-3.5 h-3.5" /> Contraindicações
                  </span>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 text-rose-700 dark:text-rose-300">
                    {selectedExercise.contraindications.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="md:col-span-2 p-3 bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730] rounded-xl space-y-1.5">
                <span className="font-bold block">Orientações de Execução</span>
                <ol className="list-decimal pl-4 space-y-1 text-[#64748B] dark:text-[#9AA8B6]">
                  {selectedExercise.instructions.map((ins, i) => (
                    <li key={i}>{ins}</li>
                  ))}
                </ol>
              </div>

              {selectedExercise.variations && selectedExercise.variations.length > 0 && (
                <div className="md:col-span-2 p-3 bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730] rounded-xl">
                  <span className="font-bold block">Variações Clínicas</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {selectedExercise.variations.map((v, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-[#E9F1EC] dark:bg-[#1F332A] text-[#345648] dark:text-[#9CCBB8]">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#E5EAE7] dark:border-[#263730]">
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Revisado por Profissional Habilitado (CREFITO)
              </span>

              <div className="flex items-center gap-2">
                {isCustomExercise(selectedExercise) && (
                  <button
                    onClick={() => setExerciseToDelete(selectedExercise)}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-rose-600 border border-rose-200 dark:border-rose-900 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedExerciseId(null);
                    onNavigate('planning');
                  }}
                  className="px-3 py-2 text-xs font-semibold border border-[#E5EAE7] dark:border-[#263730] rounded-lg hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]"
                >
                  Usar em uma ficha
                </button>
                <button
                  onClick={() => setSelectedExerciseId(null)}
                  className="px-4 py-2 text-xs font-semibold bg-[#426B5B] text-white rounded-lg hover:bg-[#345648]"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* CREATE NEW EXERCISE MODAL */}
      {isNewExerciseModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsNewExerciseModalOpen(false)}
          title="Cadastrar Novo Exercício no Catálogo"
          description="Adicione orientações técnicas, parâmetros e as 3 fotos da demonstração."
          maxWidth="2xl"
        >
          <form onSubmit={handleSaveNewExercise} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Nome do Exercício *</label>
              <input
                type="text"
                placeholder="Ex: Teaser na Chair com Molas Altas"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Categoria</label>
                <select value={formCategory} onChange={(e) => setFormCategory(e.target.value as ExerciseCategory)} className={inputClass}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Aparelho</label>
                <select value={formEquipment} onChange={(e) => setFormEquipment(e.target.value as Exercise['equipment'])} className={inputClass}>
                  {EQUIPMENTS.map((eq) => (
                    <option key={eq} value={eq}>{eq}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Região Corporal</label>
                <select value={formBodyRegion} onChange={(e) => setFormBodyRegion(e.target.value as Exercise['bodyRegion'])} className={inputClass}>
                  {BODY_REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Objetivo Clínico *</label>
              <input
                type="text"
                placeholder="Ex: Ganho de força abdominal profunda e estabilização escapulotorácica."
                value={formObjective}
                onChange={(e) => setFormObjective(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Descrição curta</label>
              <input
                type="text"
                placeholder="Resumo exibido no cartão da biblioteca"
                value={formShortDesc}
                onChange={(e) => setFormShortDesc(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Orientações Passo a Passo (1 por linha)</label>
              <textarea
                rows={3}
                placeholder={'Posição inicial\nInspiração e ativação\nExecução excêntrica'}
                value={formInstructions}
                onChange={(e) => setFormInstructions(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Variações (separadas por vírgula)</label>
                <input
                  type="text"
                  placeholder="Ex: Com pernas fletidas, Com 1 mola azul"
                  value={formVariations}
                  onChange={(e) => setFormVariations(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Contraindicações (separadas por vírgula)</label>
                <input
                  type="text"
                  placeholder="Ex: Hérnia discal aguda, Osteoporose avançada"
                  value={formContraindications}
                  onChange={(e) => setFormContraindications(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold">Fotos da demonstração (opcional — envie as 3)</label>
              <PhotoSlots images={formImages} onChange={setFormImages} />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5EAE7] dark:border-[#263730]">
              <button
                type="button"
                onClick={() => setIsNewExerciseModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg shadow-sm"
              >
                Salvar Exercício
              </button>
            </div>
          </form>
        </Modal>
      )}

      {exerciseToDelete && (
        <Modal
          isOpen={true}
          onClose={() => setExerciseToDelete(null)}
          title="Excluir exercício"
          description={exerciseToDelete.name}
          maxWidth="md"
        >
          <p className="text-xs">
            O exercício será removido da biblioteca. Fichas que já o utilizam mantêm o nome registrado.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={() => setExerciseToDelete(null)}
              className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmDelete}
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
