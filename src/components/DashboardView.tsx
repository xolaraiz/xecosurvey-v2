import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  ClipboardCheck,
  FileText,
  FolderOpen,
  HardDrive,
  Plus,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { Franchise, SolarSurveyProject, UserRole } from '../types/survey';
import { getRolePermissions, WORKFLOW_STATUS_LABELS } from '../lib/rbac';
import { analyzeSurveyCompleteness, getCriticalRiskStatus } from '../lib/safety';
import { BrandEmblem } from './BrandEmblem';

interface DashboardViewProps {
  projects: SolarSurveyProject[];
  franchises: Franchise[];
  activeRole: UserRole;
  onOpenProject: (projectId: string, initialTab?: string) => void;
  onOpenCreateModal: () => void;
  onNavigateTab: (tab: 'dashboard' | 'projects' | 'standards' | 'governance') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  franchises,
  activeRole,
  onOpenProject,
  onOpenCreateModal,
  onNavigateTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Residential' | 'C&I'>('ALL');
  const perms = getRolePermissions(activeRole);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter((p) => {
      if (typeFilter !== 'ALL' && p.projectType !== typeFilter) return false;
      if (!q) return true;
      return (
        p.projectCode.toLowerCase().includes(q) ||
        p.site.customerName.toLowerCase().includes(q) ||
        p.site.province.toLowerCase().includes(q) ||
        p.assignedSurveyor.toLowerCase().includes(q)
      );
    });
  }, [projects, searchQuery, typeFilter]);

  const metrics = useMemo(() => {
    const assigned = projects.filter(
      (p) => p.status === 'Assigned' || p.status === 'Survey In Progress' || p.status === 'Draft'
    );
    const pendingReview = projects.filter(
      (p) => p.status === 'Submitted' || p.status === 'Engineering Review' || p.status === 'Revision Required'
    );
    const openRisks = projects.flatMap((p) =>
      p.hazards
        .filter((h) => h.status !== 'Verified Closed')
        .map((h) => ({ project: p, hazard: h }))
    );
    const offlineDrafts = projects.filter(
      (p) => p.syncState === 'Saved locally' || p.syncState === 'Pending sync' || p.syncState === 'Conflict'
    );
    return { assigned, pendingReview, openRisks, offlineDrafts };
  }, [projects]);

  const franchiseMap = useMemo(() => {
    const m = new Map<string, Franchise>();
    franchises.forEach((f) => m.set(f.id, f));
    return m;
  }, [franchises]);

  return (
    <div className="space-y-8">
      {/* Operational Hero / Brand & Quick Search */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center gap-3">
              <BrandEmblem variant="xolaraiz" className="w-11 h-11" />
              <BrandEmblem variant="xeco" className="w-11 h-11" />
              <BrandEmblem variant="crixiszafe" className="w-11 h-11" />
              <div className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  XOLARAIZ™ Master Franchise · XECO Solar · CriXisZafe™
                </div>
                <div>
                  Excellent &amp; Economical Smart Solar Solutions — คุ้มค่า ประหยัด ปลอดภัย ได้มาตรฐาน บริการดี คัดสรรเทคโนโลยีเพื่อคุณ
                </div>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              ศูนย์ปฏิบัติการสำรวจหน้างานและประเมินความปลอดภัยโซลาร์เซลล์
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              เครื่องมือช่วยสำรวจ เก็บหลักฐาน ประเมินความเสี่ยงภาคสนาม CriXisZafe™ และจัดเตรียมข้อมูลให้วิศวกรไฟฟ้าตรวจทานก่อนออกแบบ
              (ไม่ใช่ระบบรับรองแบบหรือรับรองความปลอดภัยโดยอัตโนมัติ)
            </p>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหารหัสโครงการ, ชื่อลูกค้า, จังหวัด หรือผู้สำรวจ..."
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[44px]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                {(['ALL', 'Residential', 'C&I'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      typeFilter === t
                        ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    {t === 'ALL' ? 'ทุกประเภท' : t}
                  </button>
                ))}
              </div>

              {perms.canCreateProject && (
                <button
                  type="button"
                  onClick={onOpenCreateModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
                >
                  <Plus className="w-4 h-4" />
                  สร้างโครงการสำรวจ
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4-Column Operational Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>งานสำรวจที่ได้รับมอบหมาย / กำลังทำ</span>
            <FolderOpen className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {metrics.assigned.length} โครงการ
          </div>
          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            นัดหมายถัดไป: {metrics.assigned[0]?.scheduledSurveyDate ?? 'ไม่มีนัดหมาย'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>งานรอวิศวกรตรวจทาน / แก้ไข</span>
            <ClipboardCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {metrics.pendingReview.length} โครงการ
          </div>
          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            ต้องตรวจสอบโดย Electrical Engineer
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>ความเสี่ยงหน้างานที่ยังไม่ปิด</span>
            <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {metrics.openRisks.length} รายการ
          </div>
          <div className="mt-1 text-xs text-red-700 dark:text-red-400">
            วิกฤต (Critical):{' '}
            {metrics.openRisks.filter((r) => r.hazard.riskLevel === 'Critical').length} รายการ
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Draft ในเครื่อง / รอ Sync</span>
            <HardDrive className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {metrics.offlineDrafts.length} รายการ
          </div>
          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            บันทึกอัตโนมัติใน IndexedDB ของอุปกรณ์นี้
          </div>
        </div>
      </section>

      {/* Main Two-Column Operational Workspace */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Project Pipeline Table */}
        <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                รายการโครงการสำรวจในขอบเขตสิทธิ์ของคุณ
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                แสดงผลตามสาขาและบทบาทปัจจุบัน · คลิกเพื่อเข้าสู่แบบฟอร์มสำรวจหรือรายงาน
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('projects')}
              className="text-xs font-medium text-slate-700 dark:text-amber-400 hover:underline whitespace-nowrap shrink-0"
            >
              ดูทั้งหมด →
            </button>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                ไม่พบโครงการที่ตรงกับเงื่อนไขการค้นหา หรือบทบาท/สาขาที่เลือก
              </p>
              {perms.canCreateProject && (
                <button
                  type="button"
                  onClick={onOpenCreateModal}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950"
                >
                  <Plus className="w-3.5 h-3.5" />
                  สร้างโครงการสำรวจแรก
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredProjects.map((project) => {
                const completeness = analyzeSurveyCompleteness(project);
                const riskState = getCriticalRiskStatus(project);
                const franchise = franchiseMap.get(project.franchiseId);

                return (
                  <div
                    key={project.id}
                    className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        <span className="font-mono font-semibold text-slate-900 dark:text-amber-400">
                          {project.projectCode}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{project.projectType}</span>
                        <span aria-hidden="true">·</span>
                        <span>{project.topology}</span>
                        <span aria-hidden="true">·</span>
                        <span>{franchise?.code ?? project.franchiseId}</span>
                        <span aria-hidden="true">·</span>
                        <span>{project.revisionNumber}</span>
                        {project.isDemoData && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium text-amber-700 dark:text-amber-300">
                              ข้อมูลสมมติสาธิต
                            </span>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenProject(project.id)}
                        className="text-left text-base font-semibold text-slate-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 transition-colors block truncate w-full"
                      >
                        {project.site.customerName}
                      </button>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                        <span>{project.site.province} ({project.site.utilityProvider})</span>
                        <span aria-hidden="true">·</span>
                        <span>สถานะ: {WORKFLOW_STATUS_LABELS[project.status]}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">ความครบถ้วน {completeness.completionPct}%</span>
                        <span aria-hidden="true">·</span>
                        <span>Sync: {project.syncState}</span>
                      </div>

                      {riskState.hasBlockingCriticalRisk && (
                        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400 pt-0.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            พบความเสี่ยงวิกฤต/จุดที่ไม่ปลอดภัยที่จะตรวจ ({riskState.blockingReasons.length} ประเด็น) — ต้องประเมินก่อนดำเนินการ
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenProject(project.id, 'report')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap min-h-[40px]"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        รายงาน
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenProject(project.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400 whitespace-nowrap min-h-[40px]"
                      >
                        เปิดสำรวจ
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Appointments + Open Critical Risks + Offline Drafts */}
        <div className="lg:col-span-4 space-y-6">
          {/* Open Risks Register Summary */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                รายการความเสี่ยงที่ยังไม่ปิด (Risk Register)
              </h2>
              <span className="text-xs tabular-nums text-slate-500">
                {metrics.openRisks.length} รายการ
              </span>
            </div>

            {metrics.openRisks.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ไม่มีรายการความเสี่ยงค้างปิดในขอบเขตสาขาปัจจุบัน
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {metrics.openRisks.slice(0, 5).map(({ project, hazard }) => (
                  <div key={hazard.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span
                        className={`font-semibold ${
                          hazard.riskLevel === 'Critical'
                            ? 'text-red-700 dark:text-red-400'
                            : hazard.riskLevel === 'High'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        [{hazard.riskLevel}] {hazard.status}
                      </span>
                      <span className="font-mono tabular-nums text-slate-500">
                        {project.projectCode}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenProject(project.id, 'risks')}
                      className="text-left text-xs font-medium text-slate-900 dark:text-slate-100 hover:underline block"
                    >
                      {hazard.title}
                    </button>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      ผู้รับผิดชอบ: {hazard.owner} · กำหนดแก้ไข: {hazard.dueDate}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Survey Appointments */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                นัดหมายสำรวจและงานรอตรวจทาน
              </h2>
              <Calendar className="w-4 h-4 text-slate-400" />
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {projects.slice(0, 4).map((p) => (
                <div key={p.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpenProject(p.id)}
                      className="text-xs font-medium text-slate-900 dark:text-slate-100 hover:underline truncate block max-w-full"
                    >
                      {p.site.customerName}
                    </button>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {p.assignedSurveyor} · {WORKFLOW_STATUS_LABELS[p.status]}
                    </div>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300 shrink-0">
                    {p.scheduledSurveyDate}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
