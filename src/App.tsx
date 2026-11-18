import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  FolderOpen,
  LayoutDashboard,
  Moon,
  Plus,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { SolarSurveyProject, StandardReference, UserRole } from './types/survey';
import { DEMO_FRANCHISES } from './lib/demoData';
import { filterProjectsForContext, getRolePermissions, ROLE_LABELS } from './lib/rbac';
import { surveyRepository } from './lib/repository';
import { DashboardView } from './components/DashboardView';
import { ProjectsListView } from './components/ProjectsListView';
import { StandardsRegistryView } from './components/StandardsRegistryView';
import { SystemGovernanceView } from './components/SystemGovernanceView';
import { SurveyWorkspace } from './components/SurveyWorkspace';
import { CreateProjectModal } from './components/CreateProjectModal';
import { ConnectivityIndicator, PWAInstallButton } from './components/PWAControls';

type NavTab = 'dashboard' | 'projects' | 'standards' | 'governance';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<SolarSurveyProject[]>([]);
  const [standards, setStandards] = useState<StandardReference[]>([]);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectInitialStep, setProjectInitialStep] = useState<string | undefined>(undefined);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Demo Mode Tenant & Role Context
  const [activeRole, setActiveRole] = useState<UserRole>('master_admin');
  const [activeFranchiseId, setActiveFranchiseId] = useState<string>('ALL');
  const [darkMode, setDarkMode] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedProjects, loadedStandards] = await Promise.all([
        surveyRepository.getProjects(),
        surveyRepository.getStandards(),
      ]);
      setProjects(loadedProjects);
      setStandards(loadedStandards);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Enforce tenant boundary when switching away from Master Admin
  const handleRoleChange = (nextRole: UserRole) => {
    setActiveRole(nextRole);
    const nextPerms = getRolePermissions(nextRole);
    if (!nextPerms.canViewCrossFranchise && activeFranchiseId === 'ALL') {
      setActiveFranchiseId(DEMO_FRANCHISES[0].id);
    }
  };

  const perms = getRolePermissions(activeRole);
  const scopedProjects = useMemo(
    () => filterProjectsForContext(projects, activeFranchiseId, activeRole),
    [projects, activeFranchiseId, activeRole]
  );

  const activeProject = useMemo(
    () => scopedProjects.find((p) => p.id === activeProjectId) ?? null,
    [scopedProjects, activeProjectId]
  );

  const handleSaveProject = async (
    next: SolarSurveyProject,
    expectedPrevUpdatedAt?: string
  ) => {
    const res = await surveyRepository.saveProject(next, expectedPrevUpdatedAt);
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === res.saved.id);
      if (exists) {
        return prev.map((p) => (p.id === res.saved.id ? res.saved : p));
      }
      return [res.saved, ...prev];
    });
  };

  const handleCreateProject = async (created: SolarSurveyProject) => {
    await handleSaveProject(created);
    setShowCreateModal(false);
    setActiveProjectId(created.id);
    setProjectInitialStep('safety');
  };

  const handleDeleteProject = async (id: string) => {
    await surveyRepository.deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProjectId === id) {
      setActiveProjectId(null);
    }
  };

  const handleSaveStandards = async (next: StandardReference[]) => {
    await surveyRepository.saveStandards(next);
    setStandards(next);
  };

  const openProject = (id: string, step?: string) => {
    setProjectInitialStep(step);
    setActiveProjectId(id);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 md:pb-8">
      {/* Strict 3-Zone Single-Row Top Header */}
      <header className="no-print sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => {
              setActiveProjectId(null);
              setActiveTab('dashboard');
            }}
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 text-left"
          >
            XOLARAIZ™ Survey Pro
          </button>

          {/* Zone 2: Concise Single-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => {
                setActiveProjectId(null);
                setActiveTab('dashboard');
              }}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-slate-900 dark:hover:text-white ${
                !activeProject && activeTab === 'dashboard'
                  ? 'text-slate-900 dark:text-amber-400 underline underline-offset-8 decoration-2'
                  : ''
              }`}
            >
              ภาพรวม
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveProjectId(null);
                setActiveTab('projects');
              }}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-slate-900 dark:hover:text-white ${
                !activeProject && activeTab === 'projects'
                  ? 'text-slate-900 dark:text-amber-400 underline underline-offset-8 decoration-2'
                  : ''
              }`}
            >
              โครงการ
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveProjectId(null);
                setActiveTab('standards');
              }}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-slate-900 dark:hover:text-white ${
                !activeProject && activeTab === 'standards'
                  ? 'text-slate-900 dark:text-amber-400 underline underline-offset-8 decoration-2'
                  : ''
              }`}
            >
              มาตรฐานอ้างอิง
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveProjectId(null);
                setActiveTab('governance');
              }}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-slate-900 dark:hover:text-white ${
                !activeProject && activeTab === 'governance'
                  ? 'text-slate-900 dark:text-amber-400 underline underline-offset-8 decoration-2'
                  : ''
              }`}
            >
              PDPA และระบบ
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            {perms.canCreateProject ? (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400 whitespace-nowrap shrink-0 min-h-[40px]"
              >
                <Plus className="w-3.5 h-3.5" />
                สร้างโครงการ
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setActiveProjectId(null);
                  setActiveTab('projects');
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 whitespace-nowrap shrink-0 min-h-[40px]"
              >
                ดูโครงการ
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Workspace Toolbar (Demo Mode, Franchise/Role Isolation Switcher, Offline & Theme) */}
      <div className="no-print border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/60">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-amber-800 dark:text-amber-300 whitespace-nowrap">
              Demo Mode (IndexedDB Local)
            </span>
            <span aria-hidden="true" className="text-slate-400">
              ·
            </span>
            <label className="inline-flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">สาขา:</span>
              <select
                aria-label="เลือกสาขา Franchise"
                value={activeFranchiseId}
                onChange={(e) => {
                  setActiveFranchiseId(e.target.value);
                  setActiveProjectId(null);
                }}
                className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              >
                {perms.canViewCrossFranchise && (
                  <option value="ALL">ทุกสาขาในเครือข่าย (Master HQ)</option>
                )}
                {DEMO_FRANCHISES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code} ({f.region})
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">บทบาท:</span>
              <select
                aria-label="เลือกบทบาทผู้ใช้เพื่อทดสอบสิทธิ์"
                value={activeRole}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              >
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ConnectivityIndicator />
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label="สลับโหมดสีหน้าจอ"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{darkMode ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Viewport */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500">
            กำลังโหลดข้อมูลสำรวจจาก IndexedDB...
          </div>
        ) : activeProject ? (
          <SurveyWorkspace
            project={activeProject}
            franchise={DEMO_FRANCHISES.find((f) => f.id === activeProject.franchiseId)}
            standards={standards}
            activeRole={activeRole}
            initialTab={projectInitialStep}
            onSaveProject={handleSaveProject}
            onBack={() => setActiveProjectId(null)}
          />
        ) : activeTab === 'dashboard' ? (
          <DashboardView
            projects={scopedProjects}
            franchises={DEMO_FRANCHISES}
            activeRole={activeRole}
            onOpenProject={openProject}
            onOpenCreateModal={() => setShowCreateModal(true)}
            onNavigateTab={setActiveTab}
          />
        ) : activeTab === 'projects' ? (
          <ProjectsListView
            projects={scopedProjects}
            franchises={DEMO_FRANCHISES}
            activeRole={activeRole}
            onOpenProject={openProject}
            onDeleteProject={handleDeleteProject}
            onOpenCreateModal={() => setShowCreateModal(true)}
          />
        ) : activeTab === 'standards' ? (
          <StandardsRegistryView
            standards={standards}
            activeRole={activeRole}
            onSaveStandards={handleSaveStandards}
          />
        ) : (
          <SystemGovernanceView activeRole={activeRole} onDataReset={loadAll} />
        )}
      </main>

      {/* Mobile Bottom Tab Bar (<= 15% mobile height) */}
      <nav
        aria-label="เมนูหลักมือถือ"
        className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-4 h-16"
      >
        <button
          type="button"
          onClick={() => {
            setActiveProjectId(null);
            setActiveTab('dashboard');
          }}
          className={`flex flex-col items-center justify-center text-[11px] font-medium ${
            !activeProject && activeTab === 'dashboard'
              ? 'text-slate-900 dark:text-amber-400 font-semibold'
              : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="mt-0.5">ภาพรวม</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveProjectId(null);
            setActiveTab('projects');
          }}
          className={`flex flex-col items-center justify-center text-[11px] font-medium ${
            !activeProject && activeTab === 'projects'
              ? 'text-slate-900 dark:text-amber-400 font-semibold'
              : 'text-slate-500'
          }`}
        >
          <FolderOpen className="w-5 h-5" />
          <span className="mt-0.5">โครงการ</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveProjectId(null);
            setActiveTab('standards');
          }}
          className={`flex flex-col items-center justify-center text-[11px] font-medium ${
            !activeProject && activeTab === 'standards'
              ? 'text-slate-900 dark:text-amber-400 font-semibold'
              : 'text-slate-500'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="mt-0.5">มาตรฐาน</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveProjectId(null);
            setActiveTab('governance');
          }}
          className={`flex flex-col items-center justify-center text-[11px] font-medium ${
            !activeProject && activeTab === 'governance'
              ? 'text-slate-900 dark:text-amber-400 font-semibold'
              : 'text-slate-500'
          }`}
        >
          <ShieldCheck className="w-5 h-5" />
          <span className="mt-0.5">PDPA</span>
        </button>
      </nav>

      {showCreateModal && (
        <CreateProjectModal
          franchises={DEMO_FRANCHISES}
          defaultFranchiseId={activeFranchiseId}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateProject}
        />
      )}
    </div>
  );
}
