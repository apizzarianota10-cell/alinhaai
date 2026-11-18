import React, { useMemo, useState } from 'react';
import { BookOpen, Search, ArrowRight, Lightbulb, ChevronDown, ArrowLeft, Sparkles, PlayCircle, Users } from 'lucide-react';
import { TUTORIAL, FAQ } from '../../lib/tutorialContent';
import { canAccessSection } from '../../lib/utils';
import { clinicStorage } from '../../lib/storage';

interface TutorialViewProps {
  /** Inside the app: "Abrir esta tela" navigates there */
  onNavigate?: (section: string) => void;
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export const TutorialView: React.FC<TutorialViewProps> = ({ onNavigate }) => {
  const [query, setQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const role = onNavigate ? clinicStorage.getCurrentUser().role : null;

  const topics = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return TUTORIAL;
    return TUTORIAL.filter((t) =>
      normalize([t.title, t.summary, ...t.steps.flatMap((s) => [s.title, s.text]), ...(t.tips || [])].join(' ')).includes(q)
    );
  }, [query]);

  const scrollTo = (id: string) => document.getElementById(`tut-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="space-y-6">
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#426B5B] to-[#2E4F42] text-white shadow-sm">
        <div className="flex items-center gap-2 text-emerald-100 text-xs font-bold uppercase tracking-wider">
          <BookOpen className="w-4 h-4" /> Central de ajuda
        </div>
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">Tutorial completo do PilatesFlow</h1>
        <p className="mt-1 text-sm text-emerald-50/90 max-w-2xl">
          Passo a passo de cada módulo, do primeiro acesso ao fechamento de caixa. Use a busca ou o índice para ir
          direto ao assunto.
        </p>
        <div className="relative mt-5 max-w-lg">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar: reposição, PDF, estorno, senha…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-white text-[#17231D] border-0 shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 items-start">
        {/* Índice */}
        <nav className="hidden lg:block sticky top-4 p-3 rounded-2xl bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730] text-sm">
          <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Índice</p>
          {TUTORIAL.map((t, i) => (
            <button
              key={t.id}
              onClick={() => {
                setQuery('');
                setTimeout(() => scrollTo(t.id), 0);
              }}
              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A] text-[#17231D] dark:text-[#EEF3F0]"
            >
              <span className="text-[#94A3B8] mr-1.5 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              {t.title}
            </button>
          ))}
          <button
            onClick={() => document.getElementById('tut-faq')?.scrollIntoView({ behavior: 'smooth' })}
            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A]"
          >
            <span className="text-[#94A3B8] mr-1.5">?</span> Perguntas frequentes
          </button>
        </nav>

        <div className="space-y-4 min-w-0">
          {topics.length === 0 && (
            <div className="p-8 text-center text-sm text-[#64748B] rounded-2xl border border-dashed border-[#E5EAE7] dark:border-[#263730]">
              Nada encontrado para "{query}". Tente outra palavra.
            </div>
          )}

          {topics.map((t) => {
            const number = TUTORIAL.indexOf(t) + 1;
            const canOpen = onNavigate && t.section && role && canAccessSection(t.section, role);
            return (
              <section
                key={t.id}
                id={`tut-${t.id}`}
                className="scroll-mt-4 p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730] shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="w-9 h-9 shrink-0 rounded-xl bg-[#E9F1EC] dark:bg-[#1F332A] text-[#426B5B] dark:text-[#7FB39F] font-bold text-sm flex items-center justify-center tabular-nums">
                      {String(number).padStart(2, '0')}
                    </span>
                    <div>
                      <h2 className="text-lg font-bold">{t.title}</h2>
                      <p className="text-sm text-[#64748B] dark:text-[#9AA8B6]">{t.summary}</p>
                      {t.roles && (
                        <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#426B5B] dark:text-[#7FB39F]">
                          <Users className="w-3 h-3" /> {t.roles}
                        </span>
                      )}
                    </div>
                  </div>
                  {canOpen && (
                    <button
                      onClick={() => onNavigate!(t.section!)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#426B5B] text-[#426B5B] dark:text-[#7FB39F] hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A]"
                    >
                      Abrir esta tela <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <ol className="mt-4 space-y-3">
                  {t.steps.map((s, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-6 h-6 shrink-0 mt-0.5 rounded-full bg-[#426B5B] text-white text-[11px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <div className="text-sm">
                        <p className="font-semibold">{s.title}</p>
                        <p className="text-[#475569] dark:text-[#B4C0CC] leading-relaxed">{s.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>

                {t.tips && t.tips.length > 0 && (
                  <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    {t.tips.map((tip, i) => (
                      <p key={i} className="flex gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {tip}
                      </p>
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {!query && (
            <section
              id="tut-faq"
              className="scroll-mt-4 p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730] shadow-xs"
            >
              <h2 className="text-lg font-bold">Perguntas frequentes</h2>
              <div className="mt-3 divide-y divide-[#E5EAE7] dark:divide-[#263730]">
                {FAQ.map((f, i) => (
                  <div key={i}>
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      aria-expanded={openFaq === i}
                      className="w-full flex items-center justify-between gap-3 py-3 text-left text-sm font-semibold"
                    >
                      {f.q}
                      <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                    </button>
                    {openFaq === i && <p className="pb-3 text-sm text-[#475569] dark:text-[#B4C0CC]">{f.a}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

/** Public tutorial page (opened from the login screen, no login needed) */
export const StandaloneTutorial: React.FC<{ onStartDemo?: () => void }> = ({ onStartDemo }) => (
  <div className="min-h-dvh bg-[#F6F8F7] dark:bg-[#0C130F] text-[#17231D] dark:text-[#EEF3F0]">
    <header className="sticky top-0 z-10 bg-white/85 dark:bg-[#141F19]/85 backdrop-blur-md border-b border-[#E5EAE7] dark:border-[#263730]">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#426B5B] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-emerald-200" />
          </div>
          <span className="font-bold text-sm">PilatesFlow</span>
        </div>
        <div className="flex items-center gap-2">
          {onStartDemo && (
            <button
              onClick={onStartDemo}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#426B5B] dark:text-[#7FB39F] border border-[#426B5B]/40 rounded-lg hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A]"
            >
              <PlayCircle className="w-3.5 h-3.5" /> Experimentar (5 min)
            </button>
          )}
          <a
            href="#/"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao login
          </a>
        </div>
      </div>
    </header>
    <main className="max-w-6xl mx-auto p-4 sm:p-6">
      <TutorialView />
    </main>
  </div>
);
