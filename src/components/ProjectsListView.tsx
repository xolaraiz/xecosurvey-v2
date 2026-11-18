import React, { useMemo, useState } from 'react';
import { FileText, Plus, Search, Trash2 } from 'lucide-react';
import { Franchise, SolarSurveyProject, UserRole, WorkflowStatus } from '../types/survey';
import { getRolePermissions, WORKFLOW_STATUS_LABELS } from '../lib/rbac';
import { analyzeSurveyCompleteness, getCriticalRiskStatus } from '../lib/safety';

interface ProjectsListViewProps {
  projects: SolarSurveyProject[];
  franchises: Franchise[];
  activeRole: UserRole;
  onOpenProject: (id: string, tab?: string) => void;
  onDeleteProject: (id: string) => void;
  onOpenCreateModal: () => void;
}

export const ProjectsListView: React.FC<ProjectsListViewProps> = ({
  projects,
  franchises,
  activeRole,
  onOpenProject,
  onDeleteProject,
  onOpenCreateModal,
}) => {
  const perms = getRolePermissions(activeRole);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | WorkflowStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Residential' | 'C&I'>('ALL');

  const franchiseMap = useMemo(() => {
    const m = new Map<string, Franchise>();
    franchises.forEach((f) => m.set(f.id, f));
    return m;
  }, [franchises]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && p.projectType !== typeFilter) return false;
      if (!q) return true;
      return (
        p.projectCode.toLowerCase().includes(q) ||
        p.site.customerName.toLowerCase().includes(q) ||
        p.site.province.toLowerCase().includes(q)
      );
    });
  }, [projects, query, statusFilter, typeFilter]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              โครงการสำรวจทั้งหมด ({filtered.length})
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              กรองข้อมูลตามสาขา บทบาท และสถานะ Workflow
            </p>
          </div>
          {perms.canCreateProject && (
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 min-h-[42px] shrink-0"
            >
              <Plus className="w-4 h-4" />
              สร้างโครงการสำรวจ
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหารหัสหรือชื่อโครงการ..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 min-h-[40px]"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'ALL' | 'Residential' | 'C&I')}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[40px]"
          >
            <option value="ALL">ทุกประเภท (Residential &amp; C&amp;I)</option>
            <option value="Residential">Residential (บ้านพักอาศัย)</option>
            <option value="C&I">C&amp;I (พาณิชย์และอุตสาหกรรม)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | WorkflowStatus)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[40px]"
          >
            <option value="ALL">ทุกสถานะ Workflow</option>
            {Object.entries(WORKFLOW_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            ไม่พบโครงการที่ตรงกับตัวกรองปัจจุบัน
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-semibold">รหัส / สาขา</th>
                  <th className="py-3 px-4 font-semibold">ชื่อโครงการ / จังหวัด</th>
                  <th className="py-3 px-4 font-semibold">ประเภท</th>
                  <th className="py-3 px-4 font-semibold">สถานะ &amp; Revision</th>
                  <th className="py-3 px-4 font-semibold text-right">ความครบถ้วน</th>
                  <th className="py-3 px-4 font-semibold text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                {filtered.map((p) => {
                  const comp = analyzeSurveyCompleteness(p);
                  const risk = getCriticalRiskStatus(p);
                  const fr = franchiseMap.get(p.franchiseId);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-semibold text-slate-900 dark:text-amber-400">
                          {p.projectCode}
                        </div>
                        <div className="text-[11px] text-slate-500">{fr?.code ?? p.franchiseId}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => onOpenProject(p.id)}
                          className="font-semibold text-slate-900 dark:text-white hover:underline text-left"
                        >
                          {p.site.customerName}
                        </button>
                        <div className="text-[11px] text-slate-500">
                          {p.site.province} ({p.site.utilityProvider}) · {p.scheduledSurveyDate}
                          {p.isDemoData ? ' · ข้อมูลสมมติ' : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div>{p.projectType}</div>
                        <div className="text-[11px] text-slate-500">{p.topology}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium">{WORKFLOW_STATUS_LABELS[p.status]}</div>
                        <div className="text-[11px] text-slate-500">
                          {p.revisionNumber} · {p.syncState}
                          {risk.hasBlockingCriticalRisk ? ' · มี Critical Risk' : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold">{comp.completionPct}%</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenProject(p.id, 'report')}
                            className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="เปิดรายงาน"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenProject(p.id)}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 font-semibold"
                          >
                            เปิด
                          </button>
                          {perms.canExportOrDeleteData && (
                            <button
                              type="button"
                              onClick={() => onDeleteProject(p.id)}
                              aria-label="ลบโครงการ"
                              className="p-2 text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
