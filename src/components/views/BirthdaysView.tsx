import React, { useState, useEffect } from 'react';
import {
  Cake,
  Gift,
  MessageCircle,
  Calendar as CalendarIcon,
  Search,
  Sparkles,
  Phone,
  Clock,
  ChevronLeft,
  ChevronRight,
  Send,
  PartyPopper,
  Copy,
} from 'lucide-react';
import { clinicStorage } from '../../lib/storage';
import {
  getBirthdayAlerts,
  buildWhatsAppLink,
  openExternalLink,
  copyToClipboard,
  buildBirthdayMessage,
} from '../../lib/utils';
import { BirthdayAlert, Patient } from '../../types';
import { useToast } from '../common/Toast';

interface BirthdaysViewProps {
  onNavigate: (section: string, payload?: any) => void;
}

export const BirthdaysView: React.FC<BirthdaysViewProps> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [settings, setSettings] = useState(clinicStorage.getSettings());
  const [alerts, setAlerts] = useState<BirthdayAlert[]>([]);
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());

  useEffect(() => {
    const load = () => {
      const pts = clinicStorage.getPatients();
      setPatients(pts);
      const stg = clinicStorage.getSettings();
      setSettings(stg);
      const bdays = getBirthdayAlerts(pts, new Date(), stg.leapYearFeb29Rule);
      setAlerts(bdays);
    };
    load();
    return clinicStorage.subscribe(load);
  }, []);

  const handleSendWhatsApp = (alert: BirthdayAlert) => {
    openExternalLink(buildWhatsAppLink(alert.whatsapp, buildBirthdayMessage(settings, alert.patientName)));
    showToast(`WhatsApp aberto para parabenizar ${alert.patientName}!`, 'success');
  };

  const handleCopyMessage = async (alert: BirthdayAlert | Patient) => {
    const rawName = 'name' in alert ? alert.name : alert.patientName;
    const ok = await copyToClipboard(buildBirthdayMessage(settings, rawName));
    showToast(
      ok ? 'Mensagem de parabéns copiada! Pode colar no WhatsApp.' : 'Não foi possível copiar a mensagem.',
      ok ? 'success' : 'error'
    );
  };

  const q = search.trim().toLowerCase();
  const matches = (name: string) => !q || name.toLowerCase().includes(q);
  const visibleAlerts = alerts.filter((a) => matches(a.patientName));
  const todayList = visibleAlerts.filter((a) => a.daysUntil === 0);
  const tomorrowList = visibleAlerts.filter((a) => a.daysUntil === 1);
  const next3DaysList = visibleAlerts.filter((a) => a.daysUntil >= 2 && a.daysUntil <= 3);
  // "Mais adiante" = rest of the next 30 days (previously listed the whole year under a "month" label)
  const restOfMonthList = visibleAlerts.filter((a) => a.daysUntil > 3 && a.daysUntil <= 30);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Filter patients by selected calendar month
  const patientsInSelectedMonth = patients
    .filter((p) => {
      if (!p.birthDate || p.status === 'arquivado' || !matches(p.name)) return false;
      const parts = p.birthDate.split('-');
      if (parts.length !== 3) return false;
      const month = parseInt(parts[1], 10) - 1;
      return month === selectedMonth;
    })
    .sort((a, b) => a.birthDate.slice(8).localeCompare(b.birthDate.slice(8)));

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17231D] dark:text-[#F1F5F3] flex items-center gap-2">
            <Cake className="w-6 h-6 text-amber-500" />
            <span>Central de Aniversariantes</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
            Alertas antecipados (3 dias, 2 dias, 1 dia e hoje) e disparo rápido de felicitações por WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar paciente..."
              className="pl-8 pr-3 py-1.5 text-xs w-44 bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730] rounded-lg"
            />
          </div>
          <span className="text-xs font-semibold px-3 py-1.5 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-lg">
            Regra 29/Fev: {settings.leapYearFeb29Rule === 'feb28' ? '28 de Fevereiro' : '01 de Março'}
          </span>
        </div>
      </div>

      {/* TODAY'S BIRTHDAY HERO CARD */}
      {todayList.length > 0 && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                <PartyPopper className="w-7 h-7 text-amber-200 animate-bounce" />
              </div>
              <div>
                <span className="text-xs uppercase font-extrabold tracking-wider text-amber-100">
                  Festa na Clínica Hoje!
                </span>
                <h2 className="text-xl font-black">
                  {todayList.length === 1
                    ? `Hoje é o aniversário de ${todayList[0].patientName}!`
                    : `${todayList.length} Pacientes Aniversariando Hoje!`}
                </h2>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {todayList.map((bday) => (
              <div
                key={bday.patientId}
                className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base">{bday.patientName}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white text-amber-700">
                      {bday.age} anos hoje!
                    </span>
                  </div>
                  <p className="text-xs text-amber-100 mt-1">Tel/WhatsApp: {bday.whatsapp}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyMessage(bday)}
                    className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    title="Copiar mensagem para colar"
                  >
                    <Copy className="w-4 h-4" />
                    <span className="hidden sm:inline">Copiar</span>
                  </button>
                  <button
                    onClick={() => handleSendWhatsApp(bday)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold rounded-lg shadow-md transition-transform active:scale-95"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Enviar Parabéns</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STAGED ALERTS (1 day before, 2 days before, 3 days before) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card: 1 Dia Antes (Amanhã) */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#17231D] border-2 border-amber-300 dark:border-amber-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E5EAE7] dark:border-[#273830]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <h3 className="text-xs font-bold uppercase text-[#17231D] dark:text-[#F1F5F3]">
                Amanhã (1 dia antes)
              </h3>
            </div>
            <span className="text-xs font-bold text-amber-600">{tomorrowList.length}</span>
          </div>

          {tomorrowList.length === 0 ? (
            <p className="text-xs text-[#64748B] py-3 text-center">Nenhum aniversário amanhã.</p>
          ) : (
            tomorrowList.map((b) => (
              <div key={b.patientId} className="p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 text-xs flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#17231D] dark:text-[#F1F5F3]">{b.patientName}</p>
                  <p className="text-[11px] text-[#64748B]">Completará {b.age} anos</p>
                </div>
                <button
                  onClick={() => handleSendWhatsApp(b)}
                  className="p-1.5 bg-[#25D366] text-white rounded-md hover:bg-[#20ba5a]"
                  title="WhatsApp antecipado"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Card: 2 a 3 Dias Antes */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E5EAE7] dark:border-[#273830]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h3 className="text-xs font-bold uppercase text-[#17231D] dark:text-[#F1F5F3]">
                Próximos 2 a 3 Dias
              </h3>
            </div>
            <span className="text-xs font-bold text-emerald-600">{next3DaysList.length}</span>
          </div>

          {next3DaysList.length === 0 ? (
            <p className="text-xs text-[#64748B] py-3 text-center">Nenhum nos próximos 2-3 dias.</p>
          ) : (
            next3DaysList.map((b) => (
              <div key={b.patientId} className="p-2.5 rounded-lg bg-[#F8FAF9] dark:bg-[#111A15] text-xs flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#17231D] dark:text-[#F1F5F3]">{b.patientName}</p>
                  <p className="text-[11px] text-[#64748B]">Em {b.daysUntil} dias ({b.nextBirthday})</p>
                </div>
                <button
                  onClick={() => handleSendWhatsApp(b)}
                  className="p-1.5 bg-slate-100 text-slate-700 rounded-md hover:bg-[#25D366] hover:text-white"
                  title="WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Card: Mais Adiante */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E5EAE7] dark:border-[#273830]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <h3 className="text-xs font-bold uppercase text-[#17231D] dark:text-[#F1F5F3]">
                Próximos 30 Dias
              </h3>
            </div>
            <span className="text-xs font-bold text-blue-600">{restOfMonthList.length}</span>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2">
            {restOfMonthList.length === 0 ? (
              <p className="text-xs text-[#64748B] py-3 text-center">Nenhum outro no período.</p>
            ) : (
              restOfMonthList.map((b) => (
                <div key={b.patientId} className="p-2 rounded bg-slate-50 dark:bg-slate-900 text-xs flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{b.patientName}</p>
                    <p className="text-[10px] text-[#64748B]">{b.nextBirthday}</p>
                  </div>
                  <span className="text-[10px] font-mono text-[#64748B]">Em {b.daysUntil} dias</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MONTHLY CALENDAR EXPLORER */}
      <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E5EAE7] dark:border-[#273830]">
          <div>
            <h3 className="text-sm font-bold text-[#17231D] dark:text-[#F1F5F3]">
              Calendário de Aniversariantes por Mês
            </h3>
            <p className="text-xs text-[#64748B]">Navegue pelos 12 meses do ano para planejar ações e mimos.</p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSelectedMonth((prev) => (prev - 1 + 12) % 12)}
              className="p-1.5 rounded-lg border text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-xs px-3 py-1 bg-[#E9F1EC] dark:bg-[#1F332A] text-[#426B5B] dark:text-[#5A8E7A] rounded-lg">
              {monthNames[selectedMonth]}
            </span>
            <button
              onClick={() => setSelectedMonth((prev) => (prev + 1) % 12)}
              className="p-1.5 rounded-lg border text-slate-600 hover:bg-slate-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Patients in selected month */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {patientsInSelectedMonth.length === 0 ? (
            <div className="col-span-full py-8 text-center text-xs text-[#64748B]">
              Nenhum paciente cadastrado faz aniversário em {monthNames[selectedMonth]}.
            </div>
          ) : (
            patientsInSelectedMonth.map((p) => {
              const bdayDay = p.birthDate.split('-')[2];
              return (
                <div
                  key={p.id}
                  className="p-3 rounded-xl border border-[#E5EAE7] dark:border-[#273830] bg-[#F8FAF9] dark:bg-[#111A15] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-900 font-bold flex items-center justify-center shrink-0">
                      {bdayDay}
                    </div>
                    <div>
                      <p className="font-bold text-[#17231D] dark:text-[#F1F5F3]">{p.name}</p>
                      <p className="text-[11px] text-[#64748B]">Tel: {p.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopyMessage(p)}
                      className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1F332A] rounded-lg transition-colors"
                      title="Copiar mensagem para colar no WhatsApp"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openExternalLink(buildWhatsAppLink(p.whatsapp || p.phone, buildBirthdayMessage(settings, p.name)))}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                      title="Abrir WhatsApp direto"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
