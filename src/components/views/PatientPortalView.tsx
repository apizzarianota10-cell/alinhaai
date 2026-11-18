import React, { useEffect, useState } from 'react';
import { Calendar, Dumbbell, MessageCircle, Sparkles, Clock, AlertTriangle, Sun, Moon } from 'lucide-react';
import { decodePortal, PortalSnapshot } from '../../lib/portal';
import { formatDate, buildWhatsAppLink, openExternalLink, toLocalDateKey } from '../../lib/utils';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** Read-only page opened by the patient from the link the clinic sends (no login, no clinic data access) */
export const PatientPortalView: React.FC<{ data: string }> = ({ data }) => {
  const [snapshot, setSnapshot] = useState<PortalSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    decodePortal(data)
      .then((s) => {
        if (new Date(s.expiresAt) < new Date()) {
          setError('Este link expirou. Peça um novo link à clínica.');
          return;
        }
        setSnapshot(s);
        const today = WEEKDAYS[new Date().getDay()];
        const days = s.plan?.days.map((d) => d.day) || [];
        setOpenDay(days.includes(today) ? today : days[0] || null);
        document.title = `${s.clinic.name} — Área do paciente`;
      })
      .catch(() => setError('Link inválido ou incompleto. Confira se ele foi copiado inteiro.'));
  }, [data]);

  const toggleTheme = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    setDark(next);
  };

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 bg-[#F6F8F7] dark:bg-[#0C130F]">
        <div className="max-w-sm text-center p-8 rounded-2xl bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730]">
          <AlertTriangle className="w-8 h-8 mx-auto text-amber-500" />
          <p className="mt-3 text-sm">{error}</p>
        </div>
      </div>
    );
  }
  if (!snapshot) {
    return <div className="min-h-dvh flex items-center justify-center text-sm text-[#64748B]">Carregando…</div>;
  }

  const { clinic, patient, appointments, plan } = snapshot;
  const today = toLocalDateKey();
  const pct = patient.sessionsTotal > 0 ? Math.round((patient.sessionsCompleted / patient.sessionsTotal) * 100) : 0;
  const card = 'rounded-2xl bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730] shadow-xs';

  return (
    <div className="min-h-dvh bg-[#F6F8F7] dark:bg-[#0C130F] text-[#17231D] dark:text-[#EEF3F0]">
      <header className="bg-gradient-to-br from-[#426B5B] to-[#2E4F42] text-white px-5 pt-6 pb-16">
        <div className="max-w-2xl mx-auto flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <p className="text-xs text-emerald-100/90">{clinic.name}</p>
              <h1 className="text-xl font-bold">Olá, {patient.firstName}!</h1>
            </div>
          </div>
          <button onClick={toggleTheme} className="p-2 rounded-lg bg-white/10 hover:bg-white/20" aria-label="Alternar tema">
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 -mt-10 pb-10 space-y-4">
        {/* Sessions balance */}
        <section className={`${card} p-5`}>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold text-[#64748B] dark:text-[#9AA8B6]">Sessões restantes no plano</p>
              <p className="text-3xl font-extrabold text-[#426B5B] dark:text-[#7FB39F]">
                {patient.sessionsRemaining}
                <span className="text-base font-semibold text-[#64748B]"> de {patient.sessionsTotal}</span>
              </p>
            </div>
            <span className="text-xs text-[#64748B]">{patient.sessionsCompleted} realizadas</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-[#E9F1EC] dark:bg-[#1F332A] overflow-hidden">
            <div className="h-full bg-[#426B5B] dark:bg-[#7FB39F] rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          {patient.sessionsRemaining <= 1 && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Seu plano está acabando — fale com a clínica para renovar.</p>
          )}
        </section>

        {/* Upcoming sessions */}
        <section className={`${card} p-5 space-y-3`}>
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#426B5B] dark:text-[#7FB39F]" /> Próximas sessões
          </h2>
          {appointments.length === 0 ? (
            <p className="text-xs text-[#64748B]">Nenhuma sessão agendada no momento.</p>
          ) : (
            <ul className="divide-y divide-[#E5EAE7] dark:divide-[#263730]">
              {appointments.map((a, i) => (
                <li key={i} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold capitalize">
                      {a.date === today ? 'Hoje' : formatDate(a.date, "EEEE, dd/MM")}
                    </p>
                    <p className="text-xs text-[#64748B] dark:text-[#9AA8B6]">
                      {a.modality} com {a.professional}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-sm font-mono font-bold">
                    <Clock className="w-3.5 h-3.5 text-[#64748B]" />
                    {a.start}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Workout plan with animated demonstrations */}
        {plan && (
          <section className={`${card} p-5 space-y-3`}>
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-[#426B5B] dark:text-[#7FB39F]" /> Minha ficha de exercícios
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#9AA8B6] mt-0.5">{plan.goal}</p>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {plan.days.map((d) => (
                <button
                  key={d.day}
                  onClick={() => setOpenDay(d.day)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border ${
                    openDay === d.day
                      ? 'bg-[#426B5B] border-[#426B5B] text-white'
                      : 'border-[#E5EAE7] dark:border-[#263730] text-[#64748B]'
                  }`}
                >
                  {d.day}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {plan.days
                .find((d) => d.day === openDay)
                ?.items.map((it, i) => (
                  <article key={i} className="rounded-xl border border-[#E5EAE7] dark:border-[#263730] overflow-hidden">
                    {(it.gif || it.image) && (
                      <img src={it.gif || it.image} alt={`Demonstração de ${it.name}`} loading="lazy" className="w-full aspect-[3/2] object-cover bg-[#E9EFEC]" />
                    )}
                    <div className="p-3">
                      <p className="text-sm font-bold">
                        {i + 1}. {it.name}
                      </p>
                      <p className="text-xs text-[#64748B] dark:text-[#9AA8B6]">
                        {it.equipment} • {it.sets}x {it.reps}
                        {it.springs ? ` • ${it.springs}` : ''}
                      </p>
                      {it.obs && <p className="text-xs mt-1">{it.obs}</p>}
                    </div>
                  </article>
                ))}
            </div>
            <p className="text-[11px] text-[#64748B]">Execute os exercícios apenas conforme orientação do seu profissional.</p>
          </section>
        )}

        <button
          onClick={() =>
            openExternalLink(buildWhatsAppLink(clinic.whatsapp, `Olá! Sou ${patient.firstName}, paciente da clínica.`))
          }
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-sm"
        >
          <MessageCircle className="w-4 h-4" /> Falar com a clínica no WhatsApp
        </button>

        <p className="text-center text-[11px] text-[#64748B]">
          {clinic.address}
          <br />
          Informações atualizadas em {formatDate(snapshot.generatedAt, "dd/MM/yyyy 'às' HH:mm")}
        </p>
      </main>
    </div>
  );
};
