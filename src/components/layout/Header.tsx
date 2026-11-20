import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Cake,
  Sun,
  Moon,
  Menu,
  RotateCcw,
  UserCheck,
  ChevronRight,
  ShieldCheck,
  Cloud,
  CloudOff,
  LogOut,
} from 'lucide-react';
import { clinicStorage } from '../../lib/storage';
import { getBirthdayAlerts, ROLE_LABELS } from '../../lib/utils';
import { signOut, onSyncStatus, getSyncStatus } from '../../lib/cloud';
import { isCloudSession } from '../../lib/demo';
import { UserRole, Patient, Exercise } from '../../types';
import { Modal } from '../common/Modal';
import { InstallAppButton } from '../common/InstallApp';
import { useToast } from '../common/Toast';

interface HeaderProps {
  currentSection: string;
  onNavigate: (section: string, payload?: any) => void;
  onToggleMobileMenu: () => void;
  onOpenBirthdayPopup: () => void;
}

const SECTION_LABELS: Record<string, string> = {
  overview: 'Visão Geral',
  schedule: 'Agenda',
  patients: 'Pacientes',
  attendance: 'Atendimentos',
  exercises: 'Exercícios',
  planning: 'Fichas de treino',
  records: 'Prontuários',
  evaluations: 'Avaliações',
  presence: 'Presença',
  financial: 'Financeiro',
  plans: 'Planos e Áreas',
  birthdays: 'Aniversariantes',
  reports: 'Relatórios',
  professionals: 'Equipe',
  settings: 'Configurações',
  tutorial: 'Ajuda',
};

export const Header: React.FC<HeaderProps> = ({
  currentSection,
  onNavigate,
  onToggleMobileMenu,
  onOpenBirthdayPopup,
}) => {
  const { showToast } = useToast();
  const [currentUser, setCurrentUser] = useState(clinicStorage.getCurrentUser());
  const [settings, setSettings] = useState(clinicStorage.getSettings());
  const [birthdayCount, setBirthdayCount] = useState(0);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState(getSyncStatus());
  useEffect(() => {
    const off = onSyncStatus(setSyncStatus);
    return () => {
      off();
    };
  }, []);

  // Global search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchPatients, setSearchPatients] = useState<Patient[]>([]);
  const [searchExercises, setSearchExercises] = useState<Exercise[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      setCurrentUser(clinicStorage.getCurrentUser());
      const currentSettings = clinicStorage.getSettings();
      setSettings(currentSettings);
      const bdays = getBirthdayAlerts(clinicStorage.getPatients(), new Date(), currentSettings.leapYearFeb29Rule);
      const soon = bdays.filter((b) => b.daysUntil <= 3);
      setBirthdayCount(soon.length);
    };

    update();
    return clinicStorage.subscribe(update);
  }, []);

  // Global search trigger
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchPatients([]);
      setSearchExercises([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const patients = clinicStorage.getPatients().filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.cpf && p.cpf.includes(q)) ||
        p.phone.includes(q)
    );
    const exercises = clinicStorage.getExercises().filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.equipment.toLowerCase().includes(q)
    );
    setSearchPatients(patients.slice(0, 4));
    setSearchExercises(exercises.slice(0, 4));
  }, [searchQuery]);

  // Click outside to close search
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRoleChange = (role: UserRole) => {
    clinicStorage.setCurrentUserRole(role);
    showToast(`Perfil alterado para: ${ROLE_LABELS[role]}`, 'info');
  };

  const handleToggleTheme = () => {
    // Always read fresh settings so the toggle never overwrites edits saved elsewhere
    const current = clinicStorage.getSettings();
    const newTheme: 'light' | 'dark' = current.theme === 'dark' ? 'light' : 'dark';
    clinicStorage.saveSettings({ ...current, theme: newTheme });
  };

  const handleResetDemo = () => {
    setIsResetModalOpen(true);
  };

  const handleConfirmResetDemo = () => {
    clinicStorage.resetToDemoData();
    showToast('Dados de demonstração restaurados com sucesso!', 'success');
    setIsResetModalOpen(false);
  };

  return (
    <header className="h-16 px-3 sm:px-4 md:px-6 bg-white/85 dark:bg-[#141F19]/85 backdrop-blur-md border-b border-[#E5EAE7] dark:border-[#263730] flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* Left: Mobile hamburger & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-lg text-[#64748B] hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A]"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs md:text-sm text-[#64748B] dark:text-[#94A3B8]">
          <span className="font-medium text-[#17231D] dark:text-[#F1F5F3]">
            {settings.clinicName}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-[#426B5B] dark:text-[#5A8E7A]">
            {SECTION_LABELS[currentSection] || currentSection}
          </span>
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div className="relative flex-1 min-w-0 max-w-md mx-2 sm:mx-3" ref={searchRef}>
        <div className="relative">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar paciente, exercício..."
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            className="w-full pl-9 pr-4 py-1.5 text-xs sm:text-sm bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830] rounded-lg focus:outline-hidden focus:border-[#426B5B] dark:focus:border-[#5A8E7A] text-[#17231D] dark:text-[#F1F5F3] transition-colors"
          />
        </div>

        {/* Search Results Dropdown */}
        {searchOpen && searchQuery.trim() && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#17231D] border border-[#E5EAE7] dark:border-[#273830] rounded-xl shadow-xl overflow-hidden z-50 text-xs sm:text-sm">
            {searchPatients.length === 0 && searchExercises.length === 0 ? (
              <div className="p-4 text-center text-[#64748B]">Nenhum resultado encontrado</div>
            ) : (
              <div className="divide-y divide-[#E5EAE7] dark:divide-[#273830] max-h-80 overflow-y-auto">
                {searchPatients.length > 0 && (
                  <div className="p-2">
                    <span className="px-2 py-1 text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                      Pacientes
                    </span>
                    {searchPatients.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSearchOpen(false);
                          setSearchQuery('');
                          onNavigate('patients', { selectedPatientId: p.id });
                        }}
                        className="w-full text-left p-2 rounded-lg hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] flex items-center justify-between transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-[#17231D] dark:text-[#F1F5F3]">{p.name}</p>
                          <p className="text-[11px] text-[#64748B]">{p.phone} • {p.modality}</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#E9F1EC] dark:bg-[#1F332A] text-[#426B5B] font-medium">
                          {p.status}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {searchExercises.length > 0 && (
                  <div className="p-2">
                    <span className="px-2 py-1 text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                      Exercícios
                    </span>
                    {searchExercises.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => {
                          setSearchOpen(false);
                          setSearchQuery('');
                          onNavigate('exercises', { selectedExerciseId: e.id });
                        }}
                        className="w-full text-left p-2 rounded-lg hover:bg-[#F8FAF9] dark:hover:bg-[#1F332A] flex items-center justify-between transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-[#17231D] dark:text-[#F1F5F3]">{e.name}</p>
                          <p className="text-[11px] text-[#64748B]">{e.category} • {e.equipment}</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 font-medium">
                          Ver ficha
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Actions, Birthday Alert, Demo Reset, Role Selector & Theme */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <InstallAppButton />
        {/* Birthday Alert Button */}
        <button
          onClick={onOpenBirthdayPopup}
          className="relative p-2 rounded-lg text-[#64748B] hover:text-[#426B5B] hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A] transition-colors"
          title="Aniversariantes Próximos"
        >
          <Cake className="w-5 h-5 text-amber-500" />
          {birthdayCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
              {birthdayCount}
            </span>
          )}
        </button>

        {isCloudSession() && (
          <span
            className={`hidden md:flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg ${
              syncStatus === 'offline'
                ? 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/50'
                : syncStatus === 'saving'
                ? 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/50'
                : 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50'
            }`}
            title="Sincronização com a nuvem"
          >
            {syncStatus === 'offline' ? <CloudOff className="w-3.5 h-3.5" /> : <Cloud className="w-3.5 h-3.5" />}
            {syncStatus === 'offline' ? 'Sem conexão — tentando de novo' : syncStatus === 'saving' ? 'Salvando…' : 'Salvo'}
          </span>
        )}

        {/* Demo Mode Button with Reset (local demo only) */}
        {!isCloudSession() && <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 text-xs">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          <span className="font-semibold">Modo Demo</span>
          <button
            onClick={handleResetDemo}
            className="ml-1 p-1 hover:bg-amber-200/50 dark:hover:bg-amber-900 rounded transition-colors"
            title="Resetar dados demonstrativos"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>}

        {/* Role Switcher for Testing RBAC (local demo only; in the cloud the role comes from the account) */}
        <div className="hidden md:flex items-center gap-1.5 border-l border-r border-[#E5EAE7] dark:border-[#273830] px-2">
          <ShieldCheck className="w-4 h-4 text-[#426B5B] dark:text-[#5A8E7A]" />
          {isCloudSession() ? (
            <span className="text-xs font-medium">{ROLE_LABELS[currentUser.role]}</span>
          ) : (
          <select
            value={currentUser.role}
            onChange={(e) => handleRoleChange(e.target.value as UserRole)}
            className="text-xs font-medium bg-transparent border-0 text-[#17231D] dark:text-[#F1F5F3] focus:ring-0 cursor-pointer"
            title="Alterar perfil de acesso (RBAC)"
          >
            <option value="admin" className="dark:bg-[#17231D]">Admin (Acesso Total)</option>
            <option value="receptionist" className="dark:bg-[#17231D]">Recepção (Agenda & Fin)</option>
            <option value="professional" className="dark:bg-[#17231D]">Profissional (Atend. & Fichas)</option>
          </select>
          )}
        </div>

        {/* Theme Toggle (segmented light / dark switch) */}
        <button
          onClick={handleToggleTheme}
          role="switch"
          aria-checked={settings.theme === 'dark'}
          aria-label="Alternar modo claro / escuro"
          title={settings.theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          className="relative flex items-center w-[60px] h-8 p-1 rounded-full bg-[#E9F1EC] dark:bg-[#1F332A] border border-[#E5EAE7] dark:border-[#263730] transition-colors"
        >
          <span
            className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white dark:bg-[#0C130F] shadow-sm transition-transform duration-300 ${
              settings.theme === 'dark' ? 'translate-x-[26px]' : 'translate-x-0'
            }`}
          />
          <Sun className={`relative z-10 w-6 h-3.5 transition-colors ${settings.theme === 'dark' ? 'text-[#9AA8B6]' : 'text-amber-500'}`} />
          <Moon className={`relative z-10 w-6 h-3.5 ml-0.5 transition-colors ${settings.theme === 'dark' ? 'text-sky-300' : 'text-[#94A3B8]'}`} />
        </button>

        {/* User Avatar & Name */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-[#E5EAE7] dark:border-[#273830]">
          <div
            className="w-8 h-8 rounded-full bg-[#426B5B] text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm"
            title={currentUser.name}
          >
            {/* initials without titles: "Dra. Camila Sampaio" -> "CS" */}
            {currentUser.name
              .replace(/\(.*\)/, '')
              .split(' ')
              .filter((w) => w && !/^(dr|dra|sr|sra)\.?$/i.test(w))
              .slice(0, 2)
              .map((w) => w[0])
              .join('')}
          </div>
          <div className="hidden 2xl:block text-left">
            <p className="text-xs font-semibold leading-tight text-[#17231D] dark:text-[#F1F5F3]">
              {currentUser.name}
            </p>
            <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
              {ROLE_LABELS[currentUser.role]}
            </p>
          </div>
          {isCloudSession() && (
            <button
              onClick={async () => {
                await signOut();
                window.location.hash = '';
                window.location.reload();
              }}
              className="p-2 rounded-lg text-[#64748B] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* RESET DEMO CONFIRMATION MODAL */}
      {isResetModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsResetModalOpen(false)}
          title="Restaurar Dados de Demonstração"
          description="Ambiente de demonstração da clínica."
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200">
              <p className="font-bold">Aviso de Restauração:</p>
              <p className="mt-1">
                Esta ação restaurará todos os pacientes, agendamentos individuais, exercícios, fichas e lançamentos financeiros para o estado original demonstrativo.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5EAE7] dark:border-[#273830]">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmResetDemo}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg shadow-sm"
              >
                Restaurar Dados Demo
              </button>
            </div>
          </div>
        </Modal>
      )}
    </header>
  );
};
