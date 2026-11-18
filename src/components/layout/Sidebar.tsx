import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Activity,
  Dumbbell,
  ClipboardList,
  FileText,
  DollarSign,
  Cake,
  BarChart3,
  UserCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { clinicStorage } from '../../lib/storage';
import { getBirthdayAlerts, canAccessSection } from '../../lib/utils';

interface SidebarProps {
  currentSection: string;
  onNavigate: (section: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number | string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  onNavigate,
  mobileOpen,
  onCloseMobile,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState(clinicStorage.getCurrentUser());
  const [birthdayCount, setBirthdayCount] = useState(0);
  const [settings, setSettings] = useState(clinicStorage.getSettings());

  useEffect(() => {
    const update = () => {
      setCurrentUser(clinicStorage.getCurrentUser());
      const currentSettings = clinicStorage.getSettings();
      setSettings(currentSettings);
      const bdays = getBirthdayAlerts(clinicStorage.getPatients(), new Date(), currentSettings.leapYearFeb29Rule);
      setBirthdayCount(bdays.filter((b) => b.daysUntil <= 3).length);
    };

    update();
    return clinicStorage.subscribe(update);
  }, []);

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'schedule', label: 'Agenda', icon: Calendar },
    { id: 'patients', label: 'Pacientes', icon: Users },
    { id: 'attendance', label: 'Atendimentos', icon: Activity },
    { id: 'exercises', label: 'Exercícios', icon: Dumbbell },
    { id: 'planning', label: 'Planejamento', icon: ClipboardList },
    { id: 'records', label: 'Prontuários', icon: FileText },
    { id: 'financial', label: 'Financeiro', icon: DollarSign },
    { id: 'birthdays', label: 'Aniversariantes', icon: Cake, badge: birthdayCount > 0 ? birthdayCount : undefined },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
    { id: 'professionals', label: 'Profissionais', icon: UserCheck },
    { id: 'settings', label: 'Configurações', icon: Settings },
    { id: 'tutorial', label: 'Tutorial & Ajuda', icon: BookOpen },
  ].filter((item) => canAccessSection(item.id, currentUser.role));

  const handleSelect = (id: string) => {
    onNavigate(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-xs animate-fade-in"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 lg:z-40 bg-white dark:bg-[#141F19] border-r border-[#E5EAE7] dark:border-[#263730] flex flex-col transition-all duration-200 ${
          collapsed ? 'w-64 lg:w-20' : 'w-64'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#E5EAE7] dark:border-[#273830]">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-[#426B5B] flex items-center justify-center text-white shrink-0 shadow-sm">
                <Sparkles className="w-5 h-5 text-emerald-200" />
              </div>
              <div className="truncate">
                <h1 className="font-bold text-sm tracking-tight text-[#17231D] dark:text-[#F1F5F3]">
                  PilatesFlow
                </h1>
                <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] truncate">
                  Gestão Clínica & Pilates
                </p>
              </div>
            </div>
          ) : (
            <div className="w-9 h-9 mx-auto rounded-xl bg-[#426B5B] flex items-center justify-center text-white shrink-0 shadow-sm">
              <Sparkles className="w-5 h-5 text-emerald-200" />
            </div>
          )}

          {/* Collapse button (Desktop / Tablet) */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-[#64748B] hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A] transition-colors"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-gradient-to-r from-[#426B5B] to-[#4F7D6B] text-white shadow-md shadow-[#426B5B]/25'
                    : 'text-[#17231D] dark:text-[#EEF3F0] hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A]'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 ${
                    isActive
                      ? 'text-white'
                      : 'text-[#64748B] dark:text-[#94A3B8] group-hover:text-[#426B5B] dark:group-hover:text-[#5A8E7A]'
                  }`}
                />

                {!collapsed && (
                  <div className="flex-1 flex items-center justify-between text-left truncate">
                    <span className="truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-amber-400 text-slate-900'
                            : 'bg-amber-500 text-white'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Clinic Status Card */}
        {!collapsed && (
          <div className="p-3 border-t border-[#E5EAE7] dark:border-[#273830]">
            <div className="p-3 rounded-xl bg-[#F8FAF9] dark:bg-[#111A15] border border-[#E5EAE7] dark:border-[#273830]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                  Atendimento
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Individual
                </span>
              </div>
              <p className="text-xs font-medium text-[#17231D] dark:text-[#F1F5F3] truncate">
                {settings.clinicName}
              </p>
              <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                Pilates • Fisioterapia • Coluna
              </p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
