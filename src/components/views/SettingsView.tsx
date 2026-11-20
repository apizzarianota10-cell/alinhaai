import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building2,
  Clock,
  Cake,
  Shield,
  RotateCcw,
  Check,
  CreditCard,
  Plus,
  Trash2,
  Download,
  Upload,
} from 'lucide-react';
import { format } from 'date-fns';
import { isCloudSession } from '../../lib/demo';
import { clinicStorage } from '../../lib/storage';
import { ClinicSettings } from '../../types';
import { Modal } from '../common/Modal';
import { useToast } from '../common/Toast';

export const SettingsView: React.FC<{ onNavigate?: (section: string) => void }> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<ClinicSettings>(clinicStorage.getSettings());
  const [isResetConfirmModalOpen, setIsResetConfirmModalOpen] = useState(false);

  useEffect(() => {
    const load = () => {
      // Keep unsaved form edits; only follow the theme (header toggle)
      setSettings((prev) => ({ ...prev, theme: clinicStorage.getSettings().theme }));
    };
    load();
    return clinicStorage.subscribe(load);
  }, []);

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    if (settings.closingHour <= settings.openingHour) {
      showToast('O horário de fechamento deve ser depois da abertura.', 'error');
      return;
    }
    if (settings.defaultSessionDurationMinutes < 10) {
      showToast('A duração padrão da sessão deve ter pelo menos 10 minutos.', 'error');
      return;
    }
    // theme and service areas are edited elsewhere: keep their latest stored values
    const current = clinicStorage.getSettings();
    clinicStorage.saveSettings({ ...settings, theme: current.theme, serviceAreas: current.serviceAreas });
    showToast('Configurações da clínica atualizadas com sucesso!', 'success');
  };

  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem('pilatesflow_last_backup_at');
    } catch {
      return null;
    }
  });
  const [pendingRestore, setPendingRestore] = useState<{ name: string; content: string } | null>(null);

  const handleDownloadBackup = () => {
    const blob = new Blob([clinicStorage.exportBackup()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-pilatesflow-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const stamp = format(new Date(), 'dd/MM/yyyy HH:mm');
    try {
      localStorage.setItem('pilatesflow_last_backup_at', stamp);
    } catch {}
    setLastBackupAt(stamp);
    showToast('Backup baixado!', 'success');
  };

  const handlePickBackup = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingRestore({ name: file.name, content: String(reader.result) });
    reader.onerror = () => showToast('Não foi possível ler o arquivo.', 'error');
    reader.readAsText(file);
  };

  const handleConfirmRestore = () => {
    if (!pendingRestore) return;
    try {
      const summary = clinicStorage.importBackup(pendingRestore.content);
      setSettings(clinicStorage.getSettings());
      showToast(
        `Backup restaurado: ${summary.patients} pacientes e ${summary.appointments} agendamentos.`,
        'success'
      );
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
    setPendingRestore(null);
  };

  const handleResetDemoData = () => {
    setIsResetConfirmModalOpen(true);
  };

  const handleConfirmResetDemo = () => {
    clinicStorage.resetToDemoData();
    setSettings(clinicStorage.getSettings());
    showToast('Dados demonstrativos restaurados com sucesso!', 'success');
    setIsResetConfirmModalOpen(false);
  };


  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#17231D] dark:text-[#F1F5F3]">
          Configurações da Clínica
        </h1>
        <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
          Informações da unidade, regras de reposição, planos personalizáveis e modelo de mensagem de aniversário.
        </p>
      </div>

      {/* General Settings Form */}
      <form onSubmit={handleSaveGeneral} className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#E5EAE7] dark:border-[#273830]">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#426B5B] dark:text-[#5A8E7A]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#17231D] dark:text-[#F1F5F3]">
              Dados Institucionais
            </h2>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs font-bold rounded-lg shadow-sm"
          >
            Salvar Alterações
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold mb-1">Nome da Clínica</label>
            <input
              type="text"
              value={settings.clinicName}
              onChange={(e) => setSettings({ ...settings, clinicName: e.target.value })}
              className="w-full px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg font-bold"
              required
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Slogan / Descrição</label>
            <input
              type="text"
              value={settings.slogan}
              onChange={(e) => setSettings({ ...settings, slogan: e.target.value })}
              className="w-full px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Telefone Fixo</label>
            <input
              type="text"
              value={settings.phone}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="w-full px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">WhatsApp Oficial</label>
            <input
              type="text"
              value={settings.whatsapp}
              onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })}
              className="w-full px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold mb-1">Endereço Completo</label>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
            />
          </div>
        </div>

        {/* Operating Rules Section */}
        <div className="pt-4 border-t border-[#E5EAE7] dark:border-[#273830] space-y-4 text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#426B5B] dark:text-[#5A8E7A]" />
            <h3 className="font-bold uppercase tracking-wider text-[#17231D] dark:text-[#F1F5F3]">
              Regras Operacionais & Agendamento
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold mb-1">Abertura da Clínica</label>
              <input
                type="time"
                value={settings.openingHour}
                onChange={(e) => setSettings({ ...settings, openingHour: e.target.value })}
                className="w-full px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Fechamento da Clínica</label>
              <input
                type="time"
                value={settings.closingHour}
                onChange={(e) => setSettings({ ...settings, closingHour: e.target.value })}
                className="w-full px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Aparência</label>
              <select
                value={settings.theme}
                onChange={(e) => {
                  const theme = e.target.value as 'light' | 'dark';
                  setSettings({ ...settings, theme });
                  clinicStorage.saveSettings({ ...clinicStorage.getSettings(), theme });
                }}
                className="w-full px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
              >
                <option value="light">Modo claro</option>
                <option value="dark">Modo escuro</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Duração Padrão da Sessão (min)</label>
              <input
                type="number"
                value={settings.defaultSessionDurationMinutes}
                onChange={(e) =>
                  setSettings({ ...settings, defaultSessionDurationMinutes: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Aviso Prévio Cancelamento (horas)</label>
              <input
                type="number"
                value={settings.cancellationNoticeHours}
                onChange={(e) =>
                  setSettings({ ...settings, cancellationNoticeHours: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Máximo de Reposições / Mês</label>
              <input
                type="number"
                value={settings.maxReplacementsPerMonth}
                onChange={(e) =>
                  setSettings({ ...settings, maxReplacementsPerMonth: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
              />
            </div>
          </div>

          <label className="flex items-start gap-2 p-3 rounded-lg border border-[#E5EAE7] dark:border-[#273830] cursor-pointer">
            <input
              type="checkbox"
              checked={settings.absenceConsumesSession !== false}
              onChange={(e) => setSettings({ ...settings, absenceConsumesSession: e.target.checked })}
              className="mt-0.5 accent-[#426B5B]"
            />
            <span>
              <span className="font-semibold block">Falta ou cancelamento fora do prazo desconta sessão do plano</span>
              <span className="text-[11px] text-[#64748B]">
                Cancelamentos com pelo menos {settings.cancellationNoticeHours}h de aviso (ou feitos pela clínica) não
                descontam e liberam reposição, respeitando o máximo de {settings.maxReplacementsPerMonth} por mês.
              </span>
            </span>
          </label>

          {/* Modalities Offered */}
          <div className="pt-3 border-t border-[#E5EAE7] dark:border-[#273830] space-y-2">
            <span className="font-bold text-[#17231D] dark:text-[#F1F5F3] block">
              Modalidades Terapêuticas Habilitadas na Clínica:
            </span>
            <div className="flex flex-wrap gap-2">
              {['Pilates Clínico Individual', 'Fisioterapia Traumato-Ortopédica', 'Quiropraxia & Ajuste Postural', 'Reabilitação de Coluna'].map((mod, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{mod}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Birthday Message Template */}
        <div className="pt-4 border-t border-[#E5EAE7] dark:border-[#273830] space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cake className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold uppercase tracking-wider text-[#17231D] dark:text-[#F1F5F3]">
                Mensagem Padrão de Aniversário (WhatsApp)
              </h3>
            </div>

            {/* Leap year rule */}
            <div className="flex items-center gap-2">
              <span className="text-[#64748B]">29/Fev em anos normais:</span>
              <select
                value={settings.leapYearFeb29Rule}
                onChange={(e) => setSettings({ ...settings, leapYearFeb29Rule: e.target.value as any })}
                className="bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded px-2 py-1"
              >
                <option value="feb28">Comemorar em 28/Fev</option>
                <option value="mar01">Comemorar em 01/Mar</option>
              </select>
            </div>
          </div>

          <textarea
            rows={3}
            value={settings.birthdayMessageTemplate}
            onChange={(e) => setSettings({ ...settings, birthdayMessageTemplate: e.target.value })}
            className="w-full px-3 py-2 bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg"
          />
          <p className="text-[11px] text-[#64748B]">
            Variáveis disponíveis: <code>{'{nome}'}</code> (Primeiro nome do paciente) e <code>{'{clinica}'}</code> (Nome da clínica).
          </p>
        </div>
      </form>

      {/* Plans moved to their own section */}
      <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <CreditCard className="w-4 h-4 mt-0.5 text-[#426B5B] dark:text-[#5A8E7A]" />
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#17231D] dark:text-[#F1F5F3]">Planos e Áreas</h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Planos, mensalidades e áreas de atendimento agora têm uma seção própria.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate?.('plans')}
          className="px-3 py-1.5 bg-[#426B5B] hover:bg-[#345648] text-white text-xs font-semibold rounded-lg shadow-xs self-start sm:self-auto"
        >
          Abrir Planos e Áreas
        </button>
      </div>

      {/* Backup & Restore */}
      <div className="bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#426B5B] dark:text-[#5A8E7A]" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#17231D] dark:text-[#F1F5F3]">
            Backup e Restauração
          </h2>
        </div>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] max-w-2xl">
          Baixe uma cópia completa (pacientes, agenda, financeiro, prontuários, fichas e configurações) em um arquivo
          .json. Guarde em local seguro: o arquivo contém dados de saúde protegidos pela LGPD.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDownloadBackup}
            className="px-4 py-2 bg-[#426B5B] hover:bg-[#345648] text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Baixar backup
          </button>
          <label className="px-4 py-2 border border-[#E5EAE7] dark:border-[#273830] text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A]">
            <Upload className="w-4 h-4" /> Restaurar de um arquivo
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                handlePickBackup(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {lastBackupAt && (
          <p className="text-[11px] text-[#64748B]">Último backup baixado neste navegador: {lastBackupAt}</p>
        )}
      </div>

      {/* Demo Reset Card (local demo only — in the cloud it would overwrite the real clinic) */}
      {!isCloudSession() && <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm text-amber-900 dark:text-amber-200">
            Ambiente de Demonstração Isolado
          </h3>
          <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 max-w-xl">
            Restaure todos os pacientes fictícios (Maria Oliveira, João Ferreira, Ana Beatriz), agendamentos e faturas ao estado original limpo a qualquer momento para novas demonstrações.
          </p>
        </div>
        <button
          onClick={handleResetDemoData}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm whitespace-nowrap"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Restaurar Dados Demo</span>
        </button>
      </div>}

      {pendingRestore && (
        <Modal
          isOpen={true}
          onClose={() => setPendingRestore(null)}
          title="Restaurar backup"
          description={pendingRestore.name}
          maxWidth="md"
        >
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200">
            Todos os dados atuais da clínica serão <strong>substituídos</strong> pelo conteúdo do arquivo. Se quiser
            guardar o estado atual, baixe um backup antes.
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={() => setPendingRestore(null)}
              className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmRestore}
              className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg"
            >
              Substituir dados
            </button>
          </div>
        </Modal>
      )}

      {/* RESET DEMO CONFIRMATION MODAL */}
      {isResetConfirmModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsResetConfirmModalOpen(false)}
          title="Restaurar Dados de Demonstração"
          description="Ambiente demonstrativo da clínica."
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200">
              <p className="font-bold">Atenção:</p>
              <p className="mt-1">
                Esta ação restaurará todos os pacientes, agendamentos, exercícios e faturas originais de teste. Todas as alterações feitas na sessão de demonstração retornarão ao estado inicial de fábrica.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => setIsResetConfirmModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmResetDemo}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg shadow-sm"
              >
                Confirmar Restauração
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
