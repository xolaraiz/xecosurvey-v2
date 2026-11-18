import React, { useEffect, useState } from 'react';
import { Bot, CheckCircle2, ClipboardCheck, History, Lock, ShieldAlert } from 'lucide-react';
import {
  EngineeringReviewRecord,
  SolarSurveyProject,
  StandardReference,
  UserRole,
  WorkflowStatus,
} from '../../types/survey';
import { getRolePermissions, WORKFLOW_STATUS_LABELS } from '../../lib/rbac';
import { getCriticalRiskStatus } from '../../lib/safety';

interface ReviewAndAiSectionProps {
  project: SolarSurveyProject;
  standards: StandardReference[];
  activeRole: UserRole;
  onStatusTransition: (nextStatus: WorkflowStatus, note: string) => void;
  onSubmitReview: (review: EngineeringReviewRecord, nextStatus: WorkflowStatus) => void;
}

export const ReviewAndAiSection: React.FC<ReviewAndAiSectionProps> = ({
  project,
  standards,
  activeRole,
  onStatusTransition,
  onSubmitReview,
}) => {
  const perms = getRolePermissions(activeRole);
  const riskStatus = getCriticalRiskStatus(project);

  const [decision, setDecision] = useState<EngineeringReviewRecord['decision']>('Conditional');
  const [readinessStatus, setReadinessStatus] =
    useState<EngineeringReviewRecord['readinessStatus']>('มีเงื่อนไข');
  const [scopeOfReview, setScopeOfReview] = useState(
    'ตรวจทานข้อมูลสำรวจภาคสนาม จุดเชื่อมต่อไฟฟ้า ความเสี่ยง CriXisZafe™ และสมมติฐานเบื้องต้น (ไม่ใช่แบบก่อสร้างสุดท้าย)'
  );
  const [comments, setComments] = useState('');
  const [reviewerName, setReviewerName] = useState(project.assignedEngineer);
  const [statusError, setStatusError] = useState('');

  // Optional AI Assistant state
  const [aiStatus, setAiStatus] = useState<{ available: boolean; notice: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState('');
  const [aiDisclaimer, setAiDisclaimer] = useState('');
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    fetch('/api/ai/status')
      .then(async (r) => {
        if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) {
          throw new Error('Static hosting');
        }
        return r.json();
      })
      .then(setAiStatus)
      .catch(() =>
        setAiStatus({
          available: false,
          notice:
            'AI Assistant ไม่พร้อมใช้งานบน Static Hosting (GitHub Pages) หรือโหมด Offline — ขั้นตอนสำรวจและตรวจทานหลักทำงานได้ครบถ้วน',
        })
      );
  }, []);

  const handleTransition = (target: WorkflowStatus) => {
    setStatusError('');
    if (
      (target === 'Reviewed' || target === 'Report Issued') &&
      riskStatus.hasBlockingCriticalRisk
    ) {
      setStatusError(
        'ไม่สามารถเปลี่ยนสถานะเป็น “ตรวจทานแล้ว” หรือ “ออกรายงานแล้ว” ได้ เนื่องจากยังมี Critical Risk หรือ Safety Gate ที่ไม่ปลอดภัยค้างอยู่'
      );
      return;
    }
    onStatusTransition(target, `เปลี่ยนสถานะโครงการเป็น ${WORKFLOW_STATUS_LABELS[target]}`);
  };

  const handleSaveReview = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusError('');
    if (
      (decision === 'Approved for Proposal') &&
      riskStatus.hasBlockingCriticalRisk
    ) {
      setStatusError(
        'พบ Critical Risk ที่ยังไม่ปิด — สามารถบันทึกได้เฉพาะสถานะ “Revision Required” หรือ “Conditional” เท่านั้น'
      );
      return;
    }

    const record: EngineeringReviewRecord = {
      id: `rev-${Date.now()}`,
      revisionNumber: project.revisionNumber,
      reviewerName: reviewerName.trim() || project.assignedEngineer,
      reviewerRole: activeRole,
      decision,
      scopeOfReview,
      comments: comments.trim() || 'บันทึกผลการตรวจทาน',
      reviewedAt: new Date().toISOString(),
      readinessStatus,
    };

    const nextStatus: WorkflowStatus =
      decision === 'Revision Required'
        ? 'Revision Required'
        : decision === 'Approved for Proposal'
        ? 'Reviewed'
        : 'Engineering Review';

    onSubmitReview(record, nextStatus);
    setComments('');
  };

  const handleInvokeAi = async (
    mode: 'summarize' | 'missing_info' | 'draft_report' | 'search_standards'
  ) => {
    if (!aiStatus?.available) return;
    setAiLoading(true);
    setAiError('');
    setAiOutput('');

    // Sanitize: strip customer PII (name, phone, email, exact address) before sending
    const sanitizedContext = {
      projectCode: project.projectCode,
      projectType: project.projectType,
      topology: project.topology,
      province: project.site.province,
      utilityProvider: project.site.utilityProvider,
      status: project.status,
      roofZones: project.roofZones.map((z) => ({
        name: z.name,
        material: z.material,
        usableAreaSqm: z.usableAreaSqm,
        structuralEngineerStatus: z.structuralEngineerStatus,
        conditionFindings: z.conditionFindings,
      })),
      electricalConnection: {
        phaseSystem: project.electricalConnection.phaseSystem,
        confirmedVoltage: project.electricalConnection.confirmedVoltage,
        mainBreakerRatingA: project.electricalConnection.mainBreakerRatingA,
        proposedPoc: project.electricalConnection.proposedPoc,
        groundingAndBondingStatus: project.electricalConnection.groundingAndBondingStatus,
      },
      openHazards: project.hazards.map((h) => ({
        title: h.title,
        riskLevel: h.riskLevel,
        status: h.status,
      })),
      surveyorSummaryNote: project.surveyorSummaryNote,
      limitationsAndUnknowns: project.limitationsAndUnknowns,
    };

    try {
      const resp = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          sanitizedContext,
          approvedStandards: standards.map((s) => ({
            documentName: s.documentName,
            editionOrYear: s.editionOrYear,
            clause: s.clause,
            verified: s.verified,
          })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        setAiError(data.error || 'ไม่สามารถเรียก AI Assistant ได้');
      } else {
        setAiOutput(data.output || '');
        setAiDisclaimer(data.disclaimer || '');
      }
    } catch {
      setAiError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ AI');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workflow Transition Bar */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              J. การตรวจทานทางวิศวกรรม สถานะ Workflow และประวัติ Revision
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              สถานะปัจจุบัน: <strong>{WORKFLOW_STATUS_LABELS[project.status]}</strong> · {project.revisionNumber} ·
              การแก้ไขข้อมูลเทคนิคหลังตรวจทานจะสร้าง Revision ใหม่และรีเซ็ตสถานะรอตรวจทานอีกครั้ง
            </p>
          </div>
        </div>

        {statusError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{statusError}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {perms.canSubmitForReview && (
            <button
              type="button"
              onClick={() => handleTransition('Engineering Review')}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[40px]"
            >
              ส่งเข้าคิววิศวกรตรวจทาน (Engineering Review)
            </button>
          )}
          {perms.canIssueReport && (
            <button
              type="button"
              onClick={() => handleTransition('Report Issued')}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 min-h-[40px]"
            >
              ออกรายงานโครงการ (Report Issued)
            </button>
          )}
          {perms.canIssueReport && (
            <button
              type="button"
              onClick={() => handleTransition('Archived')}
              className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 min-h-[40px]"
            >
              จัดเก็บถาวร (Archive)
            </button>
          )}
        </div>
      </section>

      {/* Engineering Review Form */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          บันทึกการตรวจทานโดยวิศวกรไฟฟ้า (ไม่ใช่ลายเซ็นดิจิทัลที่มีผลทางกฎหมายโดยอัตโนมัติ)
        </h3>

        {!perms.canPerformEngineeringReview ? (
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              บทบาทปัจจุบัน ({activeRole}) ไม่มีสิทธิ์ลงบันทึกผล Engineering Review — กรุณาสลับบทบาทเป็น Electrical Engineer หรือ Master Admin เพื่อตรวจทาน
            </span>
          </div>
        ) : (
          <form onSubmit={handleSaveReview} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">ผู้ตรวจทาน</label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[40px]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">ผลการพิจารณา (Decision)</label>
                <select
                  value={decision}
                  onChange={(e) =>
                    setDecision(e.target.value as EngineeringReviewRecord['decision'])
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[40px]"
                >
                  <option value="Conditional">มีเงื่อนไข / รอข้อมูลเพิ่ม (Conditional)</option>
                  <option value="Revision Required">ส่งกลับแก้ไข (Revision Required)</option>
                  <option value="Approved for Proposal">ตรวจทานข้อมูลสำรวจครบสำหรับออกแบบ</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">สถานะความพร้อมรายงาน</label>
                <select
                  value={readinessStatus}
                  onChange={(e) =>
                    setReadinessStatus(
                      e.target.value as EngineeringReviewRecord['readinessStatus']
                    )
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[40px]"
                >
                  <option value="ข้อมูลครบ">ข้อมูลครบ</option>
                  <option value="ตรวจทานแล้ว">ตรวจทานแล้ว</option>
                  <option value="มีเงื่อนไข">มีเงื่อนไข</option>
                  <option value="ยังไม่พร้อม">ยังไม่พร้อม</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">ขอบเขตการตรวจทานของวิศวกร</label>
              <input
                type="text"
                value={scopeOfReview}
                onChange={(e) => setScopeOfReview(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[40px]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">ความเห็นและข้อเสนอทางวิศวกรรม</label>
              <textarea
                rows={3}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="ระบุจุดที่ต้องตรวจวัดเพิ่ม ข้อจำกัดจุดเชื่อมต่อ หรือเงื่อนไขก่อนออกแบบ..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 min-h-[42px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              บันทึกผลการตรวจทานวิศวกรรม
            </button>
          </form>
        )}

        {/* Existing Reviews */}
        {project.reviews.length > 0 && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              ประวัติการตรวจทานที่ผ่านมา
            </h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {project.reviews.map((r) => (
                <div key={r.id} className="py-2.5 text-xs space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {r.revisionNumber} · สถานะ: {r.readinessStatus} ({r.decision})
                    </span>
                    <span className="text-slate-500 tabular-nums">{r.reviewedAt.slice(0, 16)}</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">
                    ผู้ตรวจทาน: {r.reviewerName} · ขอบเขต: {r.scopeOfReview}
                  </div>
                  <div className="text-slate-700 dark:text-slate-200">{r.comments}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Optional AI Assistant */}
      {perms.canUseAiAssistant && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Bot className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                ผู้ช่วยสรุปข้อมูลสำรวจด้วย AI (ฟังก์ชันเสริม — ไม่ส่งข้อมูลระบุตัวตนลูกค้า)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {aiStatus?.notice ?? 'กำลังตรวจสอบสถานะ AI Server...'} · AI ห้ามอนุมัติความปลอดภัยหรือเดาค่าที่ไม่ได้วัด
              </p>
            </div>
          </div>

          {!aiStatus?.available ? (
            <div className="p-3.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
              AI Assistant ไม่พร้อมใช้งานในขณะนี้ (ระบบไม่จำลองคำตอบปลอม — ขั้นตอนสำรวจและตรวจทานหลักทำงานได้ครบ 100% โดยไม่พึ่งพา AI)
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => handleInvokeAi('summarize')}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  สรุปบันทึกหน้างาน
                </button>
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => handleInvokeAi('missing_info')}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  ชี้ข้อมูลที่ยังตกหล่น &amp; คำถามขอเพิ่ม
                </button>
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => handleInvokeAi('draft_report')}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  ร่าง Executive Summary
                </button>
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => handleInvokeAi('search_standards')}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  จับคู่มาตรฐานที่ผู้ดูแลอนุมัติแล้ว
                </button>
              </div>

              {aiLoading && <div className="text-xs text-slate-500">กำลังประมวลผลร่างข้อความผ่านเซิร์ฟเวอร์...</div>}
              {aiError && <div className="text-xs text-red-600 dark:text-red-400">{aiError}</div>}
              {aiOutput && (
                <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
                  <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                    ฉบับร่างจาก AI (ไม่ใช่ข้อเท็จจริงหน้างานจนกว่าผู้ตรวจทานจะยืนยัน): {aiDisclaimer}
                  </div>
                  <div className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {aiOutput}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Revision & Audit Log */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          ประวัติ Revision และ Audit Log
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Survey Revisions ({project.revisions.length})
            </h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {project.revisions.map((rev, idx) => (
                <div key={idx} className="py-2 text-xs">
                  <div className="font-mono font-semibold text-slate-900 dark:text-white">
                    {rev.revisionNumber}{' '}
                    {rev.invalidatedReview ? '· รีเซ็ตผลตรวจทานเดิมให้รอตรวจซ้ำ' : ''}
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">{rev.reason}</div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    โดย {rev.createdBy} · {rev.createdAt.slice(0, 16)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Audit Events ({project.auditLog.length})
            </h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
              {project.auditLog.map((ev) => (
                <div key={ev.id} className="py-2 text-xs">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {ev.action} · <span className="font-mono">{ev.revisionNumber}</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">{ev.detail}</div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    {ev.actorName} ({ev.actorRole}) · {ev.timestamp.slice(0, 16)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
