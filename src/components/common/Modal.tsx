import React, { useEffect, useRef, useId } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
}

// Several modals can be stacked (e.g. "add exercise" over the plan builder): only the top one reacts to Esc
let openModals = 0;

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'lg',
}) => {
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pressStartedOnBackdrop = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    openModals += 1;
    const level = openModals;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && level === openModals) onCloseRef.current();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      openModals -= 1;
      if (openModals === 0) document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  }[maxWidth];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
      // Close only when the click both starts and ends on the backdrop (text selection drags won't close it)
      onMouseDown={(e) => (pressStartedOnBackdrop.current = e.target === e.currentTarget)}
      onMouseUp={(e) => {
        if (pressStartedOnBackdrop.current && e.target === e.currentTarget) onClose();
        pressStartedOnBackdrop.current = false;
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full ${maxWidthClasses} max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden text-[#17231D] dark:text-[#EEF3F0] animate-pop-in`}
      >
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[#E5EAE7] dark:border-[#263730] bg-[#F8FAF9]/60 dark:bg-[#111A15]">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base sm:text-lg font-semibold truncate">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-[#64748B] dark:text-[#9AA8B6] mt-0.5">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#17231D] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};
