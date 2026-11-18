import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2, LogOut, Building2, PlayCircle, BookOpen } from 'lucide-react';
import { isDemoActive, startDemo } from '../../lib/demo';
import { StandaloneTutorial } from '../views/TutorialView';
import {
  supabase,
  getSession,
  getMemberships,
  startSync,
  signIn,
  signUp,
  signOut,
  sendPasswordReset,
  updatePassword,
  createClinic,
  Membership,
} from '../../lib/cloud';

type GateState =
  | { step: 'loading' }
  | { step: 'signed-out' }
  | { step: 'recovery' }
  | { step: 'no-clinic'; email: string }
  | { step: 'pick-clinic'; memberships: Membership[] }
  | { step: 'ready'; membership: Membership }
  | { step: 'error'; message: string };

const LAST_CLINIC_KEY = 'pilatesflow_last_clinic';

const inputClass =
  'w-full px-3 py-2.5 text-sm bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#263730] rounded-lg';
const primaryBtn =
  'w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg disabled:opacity-60';

const Shell: React.FC<{ children: React.ReactNode; subtitle?: string }> = ({ children, subtitle }) => (
  <div className="min-h-dvh flex items-center justify-center p-4 bg-[#F6F8F7] dark:bg-[#0C130F] text-[#17231D] dark:text-[#EEF3F0]">
    <div className="w-full max-w-sm animate-pop-in">
      <div className="flex items-center gap-2.5 justify-center mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#426B5B] flex items-center justify-center text-white shadow-sm">
          <Sparkles className="w-5 h-5 text-emerald-200" />
        </div>
        <div>
          <h1 className="font-bold leading-tight">PilatesFlow</h1>
          <p className="text-[11px] text-[#64748B] dark:text-[#9AA8B6]">{subtitle || 'Gestão Clínica & Pilates'}</p>
        </div>
      </div>
      <div className="p-6 rounded-2xl bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730] shadow-sm">
        {children}
      </div>
    </div>
  </div>
);

const ErrorBox: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div className="p-2.5 rounded-lg text-xs bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200">
      {message}
    </div>
  ) : null;

const LoginForm: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === 'login') await signIn(email.trim(), password);
      else if (mode === 'signup') {
        const { needsConfirmation } = await signUp(email.trim(), password, name.trim());
        if (needsConfirmation) {
          setInfo('Conta criada! Enviamos um link de confirmação para o seu e-mail. Confirme e depois entre.');
          setMode('login');
        }
      } else {
        await sendPasswordReset(email.trim());
        setInfo('Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.');
        setMode('login');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="text-lg font-bold">
        {mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Recuperar senha'}
      </h2>
      <ErrorBox message={error} />
      {info && (
        <div className="p-2.5 rounded-lg text-xs bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200">
          {info}
        </div>
      )}
      {mode === 'signup' && (
        <input className={inputClass} placeholder="Seu nome (ex.: Dra. Camila Sampaio)" value={name} onChange={(e) => setName(e.target.value)} required />
      )}
      <input className={inputClass} type="email" placeholder="E-mail" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      {mode !== 'reset' && (
        <input
          className={inputClass}
          type="password"
          placeholder="Senha (mínimo 6 caracteres)"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      )}
      <button type="submit" disabled={busy} className={primaryBtn}>
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        {mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link'}
      </button>
      {mode === 'login' && (
        <div className="pt-2 space-y-2">
          <div className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
            <span className="h-px flex-1 bg-[#E5EAE7] dark:bg-[#263730]" /> ainda não é cliente?
            <span className="h-px flex-1 bg-[#E5EAE7] dark:bg-[#263730]" />
          </div>
          <button
            type="button"
            onClick={startDemo}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-[#426B5B] dark:text-[#7FB39F] border-2 border-[#426B5B]/40 hover:border-[#426B5B] hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A] rounded-lg"
          >
            <PlayCircle className="w-4 h-4" /> Experimentar demonstração (5 min)
          </button>
          <a
            href="#/tutorial"
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-[#64748B] hover:text-[#426B5B] dark:hover:text-[#7FB39F]"
          >
            <BookOpen className="w-3.5 h-3.5" /> Ver tutorial completo
          </a>
        </div>
      )}
      <div className="flex justify-between text-xs pt-1">
        {mode === 'login' ? (
          <>
            <button type="button" onClick={() => setMode('signup')} className="text-[#426B5B] dark:text-[#7FB39F] font-semibold hover:underline">
              Criar conta
            </button>
            <button type="button" onClick={() => setMode('reset')} className="text-[#64748B] hover:underline">
              Esqueci a senha
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setMode('login')} className="text-[#426B5B] dark:text-[#7FB39F] font-semibold hover:underline">
            Voltar para entrar
          </button>
        )}
      </div>
    </form>
  );
};

const RecoveryForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await updatePassword(password);
          onDone();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-lg font-bold">Nova senha</h2>
      <ErrorBox message={error} />
      <input className={inputClass} type="password" minLength={6} placeholder="Nova senha" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button type="submit" disabled={busy} className={primaryBtn}>
        Salvar senha
      </button>
    </form>
  );
};

const CreateClinicForm: React.FC<{ email: string; onCreated: () => void }> = ({ email, onCreated }) => {
  const [clinicName, setClinicName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [importLocal, setImportLocal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await createClinic(clinicName.trim(), adminName.trim(), importLocal);
          onCreated();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-lg font-bold flex items-center gap-2">
        <Building2 className="w-5 h-5 text-[#426B5B]" /> Cadastre sua clínica
      </h2>
      <p className="text-xs text-[#64748B] dark:text-[#9AA8B6]">
        A conta <strong>{email}</strong> ainda não faz parte de nenhuma clínica. Crie uma (você será o administrador) ou
        peça ao administrador da sua clínica para liberar seu acesso em Profissionais.
      </p>
      <ErrorBox message={error} />
      <input className={inputClass} placeholder="Nome da clínica" value={clinicName} onChange={(e) => setClinicName(e.target.value)} required />
      <input className={inputClass} placeholder="Seu nome (como aparece nas evoluções)" value={adminName} onChange={(e) => setAdminName(e.target.value)} required />
      <label className="flex items-start gap-2 text-xs cursor-pointer">
        <input type="checkbox" checked={importLocal} onChange={(e) => setImportLocal(e.target.checked)} className="mt-0.5 accent-[#426B5B]" />
        <span>Importar os dados que já estão neste navegador (se não marcar, a clínica começa vazia, só com o catálogo de exercícios e planos).</span>
      </label>
      <button type="submit" disabled={busy} className={primaryBtn}>
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Criar clínica
      </button>
      <button type="button" onClick={() => signOut().then(() => window.location.reload())} className="w-full text-xs text-[#64748B] hover:underline">
        Sair desta conta
      </button>
    </form>
  );
};

/** Requires login and a clinic before rendering the app (cloud mode only) */
export const CloudGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // The local demo bypasses login entirely and never starts cloud sync
  if (isDemoActive()) return <>{children}</>;
  return <AuthenticatedGate>{children}</AuthenticatedGate>;
};

const AuthenticatedGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setStateRaw] = useState<GateState>({ step: 'loading' });
  // the public tutorial is reachable from the login screen (#/tutorial)
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHash = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const stepRef = React.useRef<GateState['step']>('loading');
  const setState = (s: GateState) => {
    stepRef.current = s.step;
    setStateRaw(s);
  };

  const resolve = async () => {
    setState({ step: 'loading' });
    try {
      const session = await getSession();
      if (!session) return setState({ step: 'signed-out' });
      const memberships = await getMemberships();
      if (memberships.length === 0) return setState({ step: 'no-clinic', email: session.user.email || '' });
      const last = localStorage.getItem(LAST_CLINIC_KEY);
      const chosen = memberships.length === 1 ? memberships[0] : memberships.find((m) => m.clinicId === last);
      if (!chosen) return setState({ step: 'pick-clinic', memberships });
      await enter(chosen);
    } catch (err) {
      setState({ step: 'error', message: (err as Error).message });
    }
  };

  const enter = async (m: Membership) => {
    setState({ step: 'loading' });
    await startSync(m);
    localStorage.setItem(LAST_CLINIC_KEY, m.clinicId);
    setState({ step: 'ready', membership: m });
  };

  useEffect(() => {
    resolve();
    const { data } = supabase!.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setState({ step: 'recovery' });
      // defer: supabase-js warns against awaiting its own calls inside this callback
      else if (event === 'SIGNED_IN' && stepRef.current === 'signed-out') setTimeout(resolve, 0);
      else if (event === 'SIGNED_OUT') setState({ step: 'signed-out' });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (state.step === 'ready') return <>{children}</>;
  if (state.step === 'loading')
    return (
      <div className="min-h-dvh flex items-center justify-center gap-2 text-sm text-[#64748B] bg-[#F6F8F7] dark:bg-[#0C130F]">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando dados da clínica…
      </div>
    );
  if (state.step === 'signed-out' && hash.startsWith('#/tutorial'))
    return <StandaloneTutorial onStartDemo={startDemo} />;
  if (state.step === 'signed-out')
    return (
      <Shell>
        <LoginForm />
      </Shell>
    );
  if (state.step === 'recovery')
    return (
      <Shell>
        <RecoveryForm onDone={resolve} />
      </Shell>
    );
  if (state.step === 'no-clinic')
    return (
      <Shell>
        <CreateClinicForm email={state.email} onCreated={resolve} />
      </Shell>
    );
  if (state.step === 'pick-clinic')
    return (
      <Shell subtitle="Escolha a clínica">
        <div className="space-y-2">
          {state.memberships.map((m) => (
            <button
              key={m.clinicId}
              onClick={() => enter(m)}
              className="w-full text-left p-3 rounded-xl border border-[#E5EAE7] dark:border-[#263730] hover:border-[#426B5B]"
            >
              <p className="font-semibold text-sm">{m.clinicName}</p>
              <p className="text-[11px] text-[#64748B]">{m.role}</p>
            </button>
          ))}
        </div>
      </Shell>
    );
  return (
    <Shell>
      <ErrorBox message={`Não foi possível carregar: ${state.message}`} />
      <div className="flex gap-2 mt-3">
        <button onClick={resolve} className={primaryBtn}>Tentar de novo</button>
        <button onClick={() => signOut().then(resolve)} className="px-3 text-xs text-[#64748B] flex items-center gap-1">
          <LogOut className="w-3.5 h-3.5" /> Sair
        </button>
      </div>
    </Shell>
  );
};
