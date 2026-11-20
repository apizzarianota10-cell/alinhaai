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
  CreditCard,
  ClipboardCheck,
  CalendarCheck2,
  ChevronDown,
} from 'lucide-react';
import { clinicStorage } from '../../lib/storage';
import { getBirthdayAlerts, canAccessSection } from '../../lib/utils';

interface SidebarProps {
  currentSection: string;
  onNavigate: (section: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
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

  // Sections grouped so the menu stays short; only the open group lists its pages
  const groups: NavGroup[] = (
    [
      { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard, items: [{ id: 'overview', label: 'Visão Geral', icon: LayoutDashboard }] },
      {
        id: 'agenda',
        label: 'Agenda',
        icon: Calendar,
        items: [
          { id: 'schedule', label: 'Agenda', icon: Calendar },
          { id: 'attendance', label: 'Atendimentos', icon: Activity },
          { id: 'presence', label: 'Presença', icon: CalendarCheck2 },
        ],
      },
      {
        id: 'alunos',
        label: 'Alunos',
        icon: Users,
        items: [
          { id: 'patients', label: 'Pacientes', icon: Users },
          { id: 'evaluations', label: 'Avaliações', icon: ClipboardCheck },
          { id: 'records', label: 'Prontuários', icon: FileText },
          { id: 'birthdays', label: 'Aniversariantes', icon: Cake, badge: birthdayCount > 0 ? birthdayCount : undefined },
        ],
      },
      {
        id: 'treinos',
        label: 'Treinos',
        icon: Dumbbell,
        items: [
          { id: 'exercises', label: 'Exercícios', icon: Dumbbell },
          { id: 'planning', label: 'Fichas de treino', icon: ClipboardList },
        ],
      },
      {
        id: 'gestao',
        label: 'Gestão',
        icon: DollarSign,
        items: [
          { id: 'financial', label: 'Financeiro', icon: DollarSign },
          { id: 'plans', label: 'Planos e Áreas', icon: CreditCard },
          { id: 'reports', label: 'Relatórios', icon: BarChart3 },
        ],
      },
      {
        id: 'clinica',
        label: 'Clínica',
        icon: Settings,
        items: [
          { id: 'professionals', label: 'Equipe', icon: UserCheck },
          { id: 'settings', label: 'Configurações', icon: Settings },
          { id: 'tutorial', label: 'Ajuda', icon: BookOpen },
        ],
      },
    ] as NavGroup[]
  )
    .map((g) => ({ ...g, items: g.items.filter((item) => canAccessSection(item.id, currentUser.role)) }))
    .filter((g) => g.items.length > 0);

  const activeGroupId = groups.find((g) => g.items.some((i) => i.id === currentSection))?.id;
  const [openGroup, setOpenGroup] = useState<string | undefined>(activeGroupId);
  // navigating elsewhere (links, header search) opens the group of the new page
  useEffect(() => setOpenGroup(activeGroupId), [activeGroupId]);

  const handleSelect = (id: string) => {
    onNavigate(id);
    onCloseMobile();
  };

  const itemClass = (active: boolean) =>
    `w-full flex items-center gap-3 rounded-xl text-xs sm:text-sm font-medium transition-all group ${
      active
        ? 'bg-gradient-to-r from-[#426B5B] to-[#4F7D6B] text-white shadow-md shadow-[#426B5B]/25'
        : 'text-[#17231D] dark:text-[#EEF3F0] hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A]'
    }`;
  const iconClass = (active: boolean) =>
    `w-5 h-5 shrink-0 ${active ? 'text-white' : 'text-[#64748B] dark:text-[#94A3B8] group-hover:text-[#426B5B] dark:group-hover:text-[#5A8E7A]'}`;
  const badge = (value: number | string, active: boolean) => (
    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-amber-400 text-slate-900' : 'bg-amber-500 text-white'}`}>{value}</span>
  );

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

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Menu principal">
          {groups.map((g) => {
            const GroupIcon = g.icon;
            const groupActive = g.id === activeGroupId;
            const groupBadge = g.items.reduce((n, i) => n + (typeof i.badge === 'number' ? i.badge : 0), 0);

            // single page, or icon-only menu: one button that goes straight to the page
            if (g.items.length === 1 || collapsed) {
              const target = groupActive ? currentSection : g.items[0].id;
              return (
                <button
                  key={g.id}
                  onClick={() => handleSelect(target)}
                  aria-current={groupActive ? 'page' : undefined}
                  className={`${itemClass(groupActive)} px-3 py-2.5 ${collapsed ? 'lg:justify-center' : ''}`}
                  title={collapsed ? `${g.label}: ${g.items.map((i) => i.label).join(', ')}` : undefined}
                >
                  <GroupIcon className={iconClass(groupActive)} />
                  <span className={`flex-1 flex items-center justify-between text-left truncate ${collapsed ? 'lg:hidden' : ''}`}>
                    <span className="truncate">{g.label}</span>
                    {groupBadge > 0 && badge(groupBadge, groupActive)}
                  </span>
                </button>
              );
            }

            const isOpen = openGroup === g.id;
            return (
              <div key={g.id}>
                <button
                  onClick={() => setOpenGroup(isOpen ? undefined : g.id)}
                  aria-expanded={isOpen}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors group ${
                    groupActive
                      ? 'text-[#426B5B] dark:text-[#7FB39F] bg-[#E9F1EC]/70 dark:bg-[#1F332A]/70'
                      : 'text-[#17231D] dark:text-[#EEF3F0] hover:bg-[#E9F1EC] dark:hover:bg-[#1F332A]'
                  }`}
                >
                  <GroupIcon className={`w-5 h-5 shrink-0 ${groupActive ? '' : 'text-[#64748B] dark:text-[#94A3B8]'}`} />
                  <span className="flex-1 text-left truncate">{g.label}</span>
                  {!isOpen && groupBadge > 0 && badge(groupBadge, false)}
                  <ChevronDown className={`w-4 h-4 shrink-0 text-[#94A3B8] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <div className="mt-1 ml-5 pl-3 border-l border-[#E5EAE7] dark:border-[#273830] space-y-0.5">
                    {g.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = currentSection === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item.id)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`${itemClass(isActive)} px-2.5 py-2`}
                        >
                          <Icon className={`${iconClass(isActive)} !w-4 !h-4`} />
                          <span className="flex-1 flex items-center justify-between text-left truncate">
                            <span className="truncate">{item.label}</span>
                            {item.badge !== undefined && badge(item.badge, isActive)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
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
                  {(settings.serviceAreas || []).some((x) => x.active && x.allowsGroups) ? "Individual e turmas" : "Individual"}
                </span>
              </div>
              <p className="text-xs font-medium text-[#17231D] dark:text-[#F1F5F3] truncate">
                {settings.clinicName}
              </p>
              <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                {(settings.serviceAreas || []).filter((x) => x.active).map((x) => x.name).join(" • ")}
              </p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
