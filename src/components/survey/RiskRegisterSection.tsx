import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import {
  HazardItem,
  HazardVerificationStatus,
  RiskLikelihood,
  RiskSeverity,
  SolarSurveyProject,
  UserRole,
} from '../../types/survey';
import {
  computeRiskLevel,
  createBlankHazard,
  getCriticalRiskStatus,
  getHazardBadgeStyle,
} from '../../lib/safety';
import { getRolePermissions } from '../../lib/rbac';

interface RiskRegisterSectionProps {
  project: SolarSurveyProject;
  activeRole: UserRole;
  onUpdate: (nextHazards: HazardItem[], auditDetail: string) => void;
}

export const RiskRegisterSection: React.FC<RiskRegisterSectionProps> = ({
  project,
  activeRole,
  onUpdate,
}) => {
  const perms = getRolePermissions(activeRole);
  const canEdit = perms.canEditHazards;
  const riskStatus = getCriticalRiskStatus(project);

  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<HazardItem>(() => createBlankHazard(project.id));
  const [formError, setFormError] = useState('');

  const handleAddHazard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) {
      setFormError('กรุณาระบุหัวข้อความเสี่ยงหรืออันตรายที่พบ');
      return;
    }
    const level = computeRiskLevel(draft.severity, draft.likelihood);
    const created: HazardItem = {
      ...draft,
      id: `haz-${Date.now()}`,
      riskLevel: level,
      status: level === 'Critical' && draft.status === 'Open' ? 'Stop Work Active' : draft.status,
    };
    onUpdate([created, ...project.hazards], `เพิ่มความเสี่ยง "${created.title}" [${created.riskLevel}]`);
    setDraft(createBlankHazard(project.id));
    setFormError('');
    setShowAdd(false);
  };

  const handleStatusChange = (id: string, nextStatus: HazardVerificationStatus) => {
    if (!canEdit) return;
    const target = project.hazards.find((h) => h.id === id);
    if (!target) return;

    if (nextStatus === 'Verified Closed') {
      if (!target.correctiveAction.trim() || !target.owner.trim()) {
        setFormError(
          `ไม่สามารถปิดรายการ "${target.title}" ได้จนกว่าจะระบุมาตรการแก้ไข (Corrective Action) และผู้รับผิดชอบ (Owner)`
        );
        return;
      }
    }

    setFormError('');
    const updated = project.hazards.map((h) =>
      h.id === id
        ? {
            ...h,
            status: nextStatus,
            verifiedBy:
              nextStatus === 'Verified Closed' ? `${activeRole} (${project.assignedEngineer})` : h.verifiedBy,
            verifiedAt:
              nextStatus === 'Verified Closed' ? new Date().toISOString().slice(0, 10) : h.verifiedAt,
          }
        : h
    );
    onUpdate(updated, `เปลี่ยนสถานะความเสี่ยง "${target.title}" เป็น ${nextStatus}`);
  };

  const handleDelete = (id: string) => {
    if (!canEdit) return;
    const target = project.hazards.find((h) => h.id === id);
    onUpdate(
      project.hazards.filter((h) => h.id !== id),
      `ลบรายการความเสี่ยง "${target?.title ?? id}"`
    );
  };

  return (
    <div className="space-y-6">
      {riskStatus.hasBlockingCriticalRisk && (
        <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-5 space-y-2">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-semibold text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>หยุดกิจกรรมที่เกี่ยวข้อง / ต้องประเมินก่อนดำเนินการ (Critical Risk Gate Active)</span>
          </div>
          <p className="text-xs text-red-700 dark:text-red-200">
            คะแนนความครบถ้วนในหมวดอื่นไม่สามารถหักล้างความเสี่ยงวิกฤตได้ และไม่สามารถกดข้ามเป็น “พร้อมดำเนินการ”
            ต้องมีผู้รับผิดชอบ หลักฐาน และตรวจยืนยันปิดรายการก่อน:
          </p>
          <ul className="text-xs text-red-800 dark:text-red-300 list-disc pl-5 space-y-0.5">
            {riskStatus.blockingReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              I. ทะเบียนความเสี่ยงและมาตรการแก้ไข (Risk Register &amp; Corrective Actions)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              ประเมิน Severity (1-5) × Likelihood (1-5) พร้อมกำหนด Owner, Due Date และตรวจยืนยันก่อนปิด
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 min-h-[40px]"
            >
              <Plus className="w-4 h-4" />
              เพิ่มรายการความเสี่ยง
            </button>
          )}
        </div>

        {formError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {showAdd && canEdit && (
          <form
            onSubmit={handleAddHazard}
            className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">ความเสี่ยง / อันตรายที่พบ *</label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="เช่น ขอบหลังคาไม่มีราวกั้น / น้ำท่วมถึงจุดวางตู้"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[40px]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">หมวดหมู่ความเสี่ยง</label>
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value as HazardItem['category'] })
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[40px]"
                >
                  <option value="Roof/Height">งานบนที่สูง / หลังคา</option>
                  <option value="Electrical/Arc-Flash">ไฟฟ้า / Arc-Flash / LOTO</option>
                  <option value="Fire/BESS">อัคคีภัย / BESS / ทางหนีไฟ</option>
                  <option value="Flood/Weather">น้ำท่วม / พายุ / สภาพอากาศ</option>
                  <option value="Hazardous Material">วัสดุอันตราย / แร่ใยหิน / สารเคมี</option>
                  <option value="CriXisZafe">CriXisZafe™ Resilience</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  ความรุนแรง Severity (1=เล็กน้อย, 5=เสียชีวิต/รุนแรงมาก)
                </label>
                <select
                  value={draft.severity}
                  onChange={(e) => {
                    const s = Number(e.target.value) as RiskSeverity;
                    setDraft({
                      ...draft,
                      severity: s,
                      riskLevel: computeRiskLevel(s, draft.likelihood),
                    });
                  }}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[40px]"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      ระดับ {n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  โอกาสเกิด Likelihood (1=น้อยมาก, 5=สูงมาก)
                </label>
                <select
                  value={draft.likelihood}
                  onChange={(e) => {
                    const l = Number(e.target.value) as RiskLikelihood;
                    setDraft({
                      ...draft,
                      likelihood: l,
                      riskLevel: computeRiskLevel(draft.severity, l),
                    });
                  }}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[40px]"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      ระดับ {n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">มาตรการแก้ไข (Corrective Action)</label>
                <input
                  type="text"
                  value={draft.correctiveAction}
                  onChange={(e) => setDraft({ ...draft, correctiveAction: e.target.value })}
                  placeholder="ระบุสิ่งที่ต้องทำก่อนดำเนินการ..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[40px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1">ผู้รับผิดชอบ (Owner)</label>
                  <input
                    type="text"
                    value={draft.owner}
                    onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[40px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">กำหนดเสร็จ (Due Date)</label>
                  <input
                    type="date"
                    value={draft.dueDate}
                    onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[40px]"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">หลักฐาน/ข้อสังเกตหน้างาน</label>
              <input
                type="text"
                value={draft.evidenceNote}
                onChange={(e) => setDraft({ ...draft, evidenceNote: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[40px]"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-medium">
                ระดับความเสี่ยงคำนวณอัตโนมัติ:{' '}
                <strong>{computeRiskLevel(draft.severity, draft.likelihood)}</strong>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950"
                >
                  บันทึกความเสี่ยง
                </button>
              </div>
            </div>
          </form>
        )}

        {project.hazards.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            ยังไม่มีรายการความเสี่ยงที่บันทึกไว้ในโครงการนี้
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {project.hazards.map((h) => {
              const style = getHazardBadgeStyle(h.riskLevel);
              return (
                <div key={h.id} className="py-4 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-semibold ${style.bg} ${style.text} ${style.border}`}
                        >
                          {style.labelTh}
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          S={h.severity} × L={h.likelihood} · หมวด: {h.category}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {h.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        disabled={!canEdit}
                        value={h.status}
                        onChange={(e) =>
                          handleStatusChange(h.id, e.target.value as HazardVerificationStatus)
                        }
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[36px]"
                      >
                        <option value="Open">Open (ยังไม่แก้ไข)</option>
                        <option value="Stop Work Active">Stop Work Active (หยุดงาน)</option>
                        <option value="Mitigation Planned">Mitigation Planned (วางแผนแก้ไข)</option>
                        <option value="Pending Verification">Pending Verification (รอตรวจยืนยัน)</option>
                        <option value="Verified Closed">Verified Closed (ปิดรายการแล้ว)</option>
                      </select>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleDelete(h.id)}
                          aria-label="ลบรายการความเสี่ยง"
                          className="p-2 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <div>
                      <strong>มาตรการแก้ไข:</strong> {h.correctiveAction || 'ยังไม่ระบุ'}
                    </div>
                    <div>
                      <strong>หลักฐานหน้างาน:</strong> {h.evidenceNote || '-'}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 tabular-nums">
                    <span>ผู้รับผิดชอบ: {h.owner || 'ยังไม่ระบุ'}</span>
                    <span>กำหนดเสร็จ: {h.dueDate}</span>
                    {h.verifiedBy && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        ตรวจยืนยันปิดโดย {h.verifiedBy} ({h.verifiedAt})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
