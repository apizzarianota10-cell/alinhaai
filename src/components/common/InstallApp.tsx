import React, { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';

/** Chrome/Edge/Android fire this before showing their own install UI */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
// iPhone/iPad Safari has no install prompt: the user adds it from the Share menu
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** "Instalar app" button: native prompt where supported, step-by-step help on iOS. Hidden once installed. */
export const InstallAppButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || (!deferred && !isIOS())) return null;

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferred(null);
    } else {
      setShowIOSHelp(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        title="Instalar o PilatesFlow neste aparelho (funciona offline)"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] ${className}`}
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Instalar app</span>
      </button>

      {showIOSHelp && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={() => setShowIOSHelp(false)}>
          <div
            role="dialog"
            aria-label="Como instalar no iPhone"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730] p-5 space-y-3 text-sm"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Instalar no iPhone / iPad</h2>
              <button onClick={() => setShowIOSHelp(false)} aria-label="Fechar" className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-[#1F332A]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="space-y-2 text-[#475569] dark:text-[#9AA8B6]">
              <li className="flex gap-2">
                <span className="font-bold">1.</span>
                <span>
                  No Safari, toque em <Share className="inline w-4 h-4 -mt-0.5" /> <b>Compartilhar</b>.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">2.</span>
                <span>
                  Escolha <PlusSquare className="inline w-4 h-4 -mt-0.5" /> <b>Adicionar à Tela de Início</b>.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold">3.</span>
                <span>Toque em <b>Adicionar</b>. O PilatesFlow abre como app e funciona sem internet.</span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
};
