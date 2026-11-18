import React, { useEffect, useState } from 'react';
import { Timer, LogOut, UserPlus } from 'lucide-react';
import { demoRemainingMs, endDemo, DEMO_DURATION_MS } from '../../lib/demo';

/** Countdown banner shown during the 5-minute demo; when time is up the app is locked behind a call to action */
export const DemoBar: React.FC = () => {
  const [remaining, setRemaining] = useState(demoRemainingMs());

  useEffect(() => {
    const id = window.setInterval(() => setRemaining(demoRemainingMs()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  const pct = (remaining / DEMO_DURATION_MS) * 100;
  const urgent = remaining < 60_000;

  if (remaining <= 0) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-md p-7 text-center rounded-2xl bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730] shadow-2xl animate-pop-in">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#E9F1EC] dark:bg-[#1F332A] text-[#426B5B] dark:text-[#7FB39F] flex items-center justify-center">
            <Timer className="w-7 h-7" />
          </div>
          <h2 className="mt-4 text-lg font-bold">Sua demonstração terminou</h2>
          <p className="mt-1 text-sm text-[#64748B] dark:text-[#9AA8B6]">
            Gostou? Crie sua conta gratuita para cadastrar sua clínica. Os dados da demonstração são apagados e
            nada do que você testou é salvo.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            <button
              onClick={endDemo}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg"
            >
              <UserPlus className="w-4 h-4" /> Criar minha conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs font-semibold text-white ${
        urgent ? 'bg-amber-600' : 'bg-[#2E4F42]'
      }`}
      role="status"
    >
      <span className="flex items-center gap-2">
        <Timer className="w-4 h-4" />
        Modo demonstração — dados fictícios, nada é salvo.
        <span className="font-mono text-sm tabular-nums bg-white/15 px-2 py-0.5 rounded">
          {mm}:{String(ss).padStart(2, '0')}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <a href="#/tutorial" className="underline underline-offset-2 hover:no-underline">
          Ver tutorial
        </a>
        <button
          onClick={endDemo}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/15 hover:bg-white/25"
        >
          <LogOut className="w-3.5 h-3.5" /> Sair e criar conta
        </button>
      </span>
      <span className="absolute left-0 bottom-0 h-0.5 bg-white/60 transition-[width] duration-1000" style={{ width: `${pct}%` }} />
    </div>
  );
};
