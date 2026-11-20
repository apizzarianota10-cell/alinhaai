import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { ToastProvider } from './components/common/Toast';
import { BirthdayPopup } from './components/common/BirthdayPopup';
import { OverviewView } from './components/views/OverviewView';
import { ScheduleView } from './components/views/ScheduleView';
import { PatientsView } from './components/views/PatientsView';
import { AttendanceView } from './components/views/AttendanceView';
import { ExercisesView } from './components/views/ExercisesView';
import { PlanningView } from './components/views/PlanningView';
import { ClinicalRecordsView } from './components/views/ClinicalRecordsView';
import { FinancialView } from './components/views/FinancialView';
import { BirthdaysView } from './components/views/BirthdaysView';
import { ReportsView } from './components/views/ReportsView';
import { ProfessionalsView } from './components/views/ProfessionalsView';
import { SettingsView } from './components/views/SettingsView';
import { PlansView } from './components/views/PlansView';
import { PatientPortalView } from './components/views/PatientPortalView';
import { CloudGate } from './components/auth/CloudGate';
import { isCloudEnabled } from './lib/cloud';
import { isDemoActive } from './lib/demo';
import { DemoBar } from './components/auth/DemoBar';
import { TutorialView } from './components/views/TutorialView';
import { ShieldAlert } from 'lucide-react';
import { clinicStorage } from './lib/storage';
import { canAccessSection, ROLE_LABELS } from './lib/utils';
import { UserRole } from './types';

const SECTIONS = [
  'overview', 'schedule', 'patients', 'attendance', 'exercises', 'planning',
  'records', 'financial', 'plans', 'birthdays', 'reports', 'professionals', 'settings', 'tutorial',
];

/** Section from the URL hash (#/exercises) so the browser back button and direct links work */
const sectionFromHash = () => {
  const s = window.location.hash.replace(/^#\/?/, '');
  return SECTIONS.includes(s) ? s : 'overview';
};

const portalDataFromHash = () => {
  const m = window.location.hash.match(/^#\/portal\/(.+)$/);
  return m ? m[1] : null;
};

export function App() {
  // Patient portal links render a standalone read-only page (no clinic UI, no login)
  const [portalData] = useState(portalDataFromHash);
  if (portalData) return <PatientPortalView data={portalData} />;
  // Cloud mode: login + clinic required; otherwise local demo
  return isCloudEnabled ? (
    <CloudGate>
      <ClinicApp />
    </CloudGate>
  ) : (
    <ClinicApp />
  );
}

function ClinicApp() {
  const [currentSection, setCurrentSection] = useState<string>(sectionFromHash);

  useEffect(() => {
    const onHash = () => {
      setCurrentSection(sectionFromHash());
      setNavPayload(null);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const [navPayload, setNavPayload] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [forceBirthdayPopup, setForceBirthdayPopup] = useState(false);
  const [role, setRole] = useState<UserRole>(clinicStorage.getCurrentUser().role);

  useEffect(() => {
    // Keep <html class="dark"> and the active role in sync with storage (toggle, settings, demo reset)
    const sync = () => {
      const theme = clinicStorage.getSettings().theme;
      document.documentElement.classList.toggle('dark', theme === 'dark');
      setRole(clinicStorage.getCurrentUser().role);
    };
    sync();
    return clinicStorage.subscribe(sync);
  }, []);

  // The main element is the scroll container (window never scrolls)
  const mainRef = React.useRef<HTMLElement>(null);

  const handleNavigate = (section: string, payload?: any) => {
    setCurrentSection(section);
    setNavPayload(payload || null);
    // pushState doesn't fire hashchange, so the payload set above is kept
    if (sectionFromHash() !== section) window.history.pushState(null, '', `#/${section}`);
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderActiveView = () => {
    if (!canAccessSection(currentSection, role)) {
      return (
        <div className="max-w-md mx-auto mt-16 p-8 text-center rounded-2xl bg-white dark:bg-[#141F19] border border-[#E5EAE7] dark:border-[#263730] shadow-sm animate-pop-in">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="mt-4 text-lg font-bold">Acesso restrito</h2>
          <p className="mt-1 text-sm text-[#64748B] dark:text-[#9AA8B6]">
            O perfil <strong>{ROLE_LABELS[role]}</strong> não tem permissão para abrir este módulo.
          </p>
          <button
            onClick={() => handleNavigate('overview')}
            className="mt-5 px-4 py-2 text-sm font-semibold text-white bg-[#426B5B] hover:bg-[#345648] rounded-lg"
          >
            Voltar à Visão Geral
          </button>
        </div>
      );
    }

    switch (currentSection) {
      case 'overview':
        return (
          <OverviewView
            onNavigate={handleNavigate}
            onOpenBirthdayPopup={() => setForceBirthdayPopup(true)}
          />
        );
      case 'schedule':
        return (
          <ScheduleView
            onNavigate={handleNavigate}
            initialAction={navPayload?.action}
          />
        );
      case 'patients':
        return (
          <PatientsView
            onNavigate={handleNavigate}
            selectedPatientId={navPayload?.selectedPatientId}
            action={navPayload?.action}
          />
        );
      case 'attendance':
        return (
          <AttendanceView
            onNavigate={handleNavigate}
            appointmentId={navPayload?.appointmentId}
            patientId={navPayload?.patientId}
          />
        );
      case 'exercises':
        return (
          <ExercisesView
            onNavigate={handleNavigate}
            selectedExerciseId={navPayload?.selectedExerciseId}
          />
        );
      case 'planning':
        return (
          <PlanningView
            onNavigate={handleNavigate}
            patientId={navPayload?.patientId}
          />
        );
      case 'records':
        return (
          <ClinicalRecordsView
            onNavigate={handleNavigate}
            patientId={navPayload?.patientId}
          />
        );
      case 'financial':
        return (
          <FinancialView
            onNavigate={handleNavigate}
            action={navPayload?.action}
            patientId={navPayload?.patientId}
          />
        );
      case 'birthdays':
        return <BirthdaysView onNavigate={handleNavigate} />;
      case 'reports':
        return <ReportsView />;
      case 'professionals':
        return <ProfessionalsView />;
      case 'settings':
        return <SettingsView onNavigate={(s) => handleNavigate(s)} />;
      case 'plans':
        return <PlansView />;
      case 'tutorial':
        return <TutorialView onNavigate={(s) => handleNavigate(s)} />;
      default:
        return (
          <OverviewView
            onNavigate={handleNavigate}
            onOpenBirthdayPopup={() => setForceBirthdayPopup(true)}
          />
        );
    }
  };

  return (
    <ToastProvider>
      <div className="flex h-dvh w-full overflow-hidden bg-[#F6F8F7] dark:bg-[#0C130F] text-[#17231D] dark:text-[#EEF3F0] transition-colors">
        {/* Responsive Sidebar */}
        <Sidebar
          currentSection={currentSection}
          onNavigate={(sec) => handleNavigate(sec)}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {isDemoActive() && <DemoBar />}
          <Header
            currentSection={currentSection}
            onNavigate={handleNavigate}
            onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
            onOpenBirthdayPopup={() => setForceBirthdayPopup(true)}
          />

          <main ref={mainRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {/* key re-mounts the view so each section opens with its entry animation */}
            <div key={currentSection} className="max-w-7xl mx-auto animate-pop-in">
              {renderActiveView()}
            </div>
          </main>
        </div>

        {/* Birthday Celebratory Modal */}
        <BirthdayPopup
          forceOpen={forceBirthdayPopup}
          onCloseManual={() => setForceBirthdayPopup(false)}
          onNavigateToBirthdays={() => handleNavigate('birthdays')}
        />
      </div>
    </ToastProvider>
  );
}

export default App;
