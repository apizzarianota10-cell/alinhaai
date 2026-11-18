import React, { useState, useEffect } from 'react';
import { Cake, Gift, MessageCircle, X, Check, Calendar, ArrowRight } from 'lucide-react';
import { clinicStorage } from '../../lib/storage';
import { getBirthdayAlerts, buildWhatsAppLink, openExternalLink, buildBirthdayMessage } from '../../lib/utils';
import { BirthdayAlert } from '../../types';

interface BirthdayPopupProps {
  forceOpen?: boolean;
  onCloseManual?: () => void;
  onNavigateToBirthdays?: () => void;
}

export const BirthdayPopup: React.FC<BirthdayPopupProps> = ({
  forceOpen = false,
  onCloseManual,
  onNavigateToBirthdays,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<BirthdayAlert[]>([]);
  const [settings, setSettings] = useState(clinicStorage.getSettings());

  const computeAlerts = () => {
    const currentSettings = clinicStorage.getSettings();
    return getBirthdayAlerts(clinicStorage.getPatients(), new Date(), currentSettings.leapYearFeb29Rule).filter(
      (a) => a.daysUntil <= 3
    );
  };

  // Keep the list fresh; opening is decided separately so a storage write never re-opens the popup
  useEffect(() => {
    const update = () => {
      setSettings(clinicStorage.getSettings());
      setAlerts(computeAlerts());
    };
    update();
    return clinicStorage.subscribe(update);
  }, []);

  // Automatic opening: once per app load, if there is something to show and it was not dismissed today
  useEffect(() => {
    if (computeAlerts().length > 0 && !clinicStorage.isBirthdayPopupDismissedToday()) {
      setIsOpen(true);
    }
  }, []);

  // Manual opening from the header / overview button
  useEffect(() => {
    if (forceOpen) setIsOpen(true);
  }, [forceOpen]);

  const handleDismiss = () => {
    setIsOpen(false);
    clinicStorage.dismissBirthdayPopupForToday();
    if (onCloseManual) onCloseManual();
  };

  const handleSendGreeting = (alert: BirthdayAlert) => {
    openExternalLink(buildWhatsAppLink(alert.whatsapp, buildBirthdayMessage(settings, alert.patientName)));
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && handleDismiss();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const todayBirthdays = alerts.filter((a) => a.daysUntil === 0);
  const soonBirthdays = alerts.filter((a) => a.daysUntil > 0 && a.daysUntil <= 3);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && handleDismiss()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Aniversariantes próximos"
        className="bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-pop-in"
      >
        {/* Header with celebration banner */}
        <div className="bg-gradient-to-r from-[#426B5B] to-[#2E4F42] text-white p-6 relative">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-md">
                <Cake className="w-7 h-7 text-amber-300 animate-bounce" />
              </div>
              <div>
                <span className="text-xs uppercase font-semibold tracking-wider text-amber-200">
                  Radar de Aniversariantes
                </span>
                <h2 className="text-xl font-bold">
                  {todayBirthdays.length > 0
                    ? `🎉 Aniversário Hoje na Clínica!`
                    : '🎈 Aniversários nos Próximos 3 Dias'}
                </h2>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              title="Fechar e marcar como visualizado por hoje"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-emerald-100/90 mt-2">
            Mantenha o relacionamento humanizado com seus pacientes. Envie uma mensagem carinhosa pelo WhatsApp em um clique!
          </p>
        </div>

        {/* Content list */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
          {alerts.length === 0 && (
            <div className="py-6 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">
              <Cake className="w-8 h-8 mx-auto mb-2 text-amber-400" />
              Nenhum aniversário hoje nem nos próximos 3 dias.
            </div>
          )}
          {todayBirthdays.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                <Gift className="w-3.5 h-3.5" />
                <span>Hoje</span>
              </div>
              {todayBirthdays.map((bday) => (
                <div
                  key={bday.patientId}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 transition-all hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#17231D] dark:text-[#F1F5F3]">
                        {bday.patientName}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white animate-pulse">
                        {bday.age} anos hoje!
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                      Tel: {bday.whatsapp} • {bday.nextBirthday}
                    </p>
                  </div>

                  <button
                    onClick={() => handleSendGreeting(bday)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-semibold rounded-lg shadow-sm transition-transform active:scale-95"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Enviar Parabéns</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {soonBirthdays.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide">
                <Calendar className="w-3.5 h-3.5" />
                <span>Nos Próximos Dias</span>
              </div>
              {soonBirthdays.map((bday) => (
                <div
                  key={bday.patientId}
                  className="flex items-center justify-between p-3 rounded-xl border border-[#E5EAE7] dark:border-[#273830] bg-[#F8FAF9] dark:bg-[#111A15] transition-all hover:bg-white dark:hover:bg-[#1a2721]"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[#17231D] dark:text-[#F1F5F3]">
                        {bday.patientName}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#E9F1EC] dark:bg-[#1F332A] text-[#426B5B] dark:text-[#5A8E7A]">
                        {bday.daysUntil === 1
                          ? 'Amanhã'
                          : `Em ${bday.daysUntil} dias`} ({bday.age} anos)
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                      {bday.nextBirthday} • {bday.whatsapp}
                    </p>
                  </div>

                  <button
                    onClick={() => handleSendGreeting(bday)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 dark:border-emerald-800"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-[#F8FAF9] dark:bg-[#111A15] border-t border-[#E5EAE7] dark:border-[#273830] flex items-center justify-between">
          {onNavigateToBirthdays ? (
            <button
              onClick={() => {
                handleDismiss();
                onNavigateToBirthdays();
              }}
              className="text-xs font-medium text-[#426B5B] dark:text-[#5A8E7A] hover:underline flex items-center gap-1"
            >
              <span>Ver calendário completo</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Entendido (Não mostrar hoje)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
