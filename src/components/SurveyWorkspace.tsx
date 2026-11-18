import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BatteryCharging,
  Calculator,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  Home,
  Info,
  MapPin,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';
import {
  ElectricalMeterGroup,
  EngineeringReviewRecord,
  Franchise,
  RoofZone,
  SafetyCheckState,
  SolarSurveyProject,
  StandardReference,
  UserRole,
  UtilityBillRecord,
  WorkflowStatus,
} from '../types/survey';
import { getRolePermissions, WORKFLOW_STATUS_LABELS } from '../lib/rbac';
import { analyzeSurveyCompleteness, getCriticalRiskStatus } from '../lib/safety';
import { parseLoadProfileCsv } from '../lib/calculations';
import { EpistemicNumberField, EpistemicTextField } from './EpistemicField';
import { EvidenceMarkupSection } from './survey/EvidenceMarkupSection';
import { CalculatorSection } from './survey/CalculatorSection';
import { RiskRegisterSection } from './survey/RiskRegisterSection';
import { ReviewAndAiSection } from './survey/ReviewAndAiSection';
import { SurveyReportView } from './survey/SurveyReportView';

interface SurveyWorkspaceProps {
  project: SolarSurveyProject;
  franchise?: Franchise;
  standards: StandardReference[];
  activeRole: UserRole;
  initialTab?: string;
  onSaveProject: (next: SolarSurveyProject, expectedPrevUpdatedAt?: string) => Promise<void>;
  onBack: () => void;
}

type StepId =
  | 'safety'
  | 'site'
  | 'load'
  | 'roof'
  | 'electrical'
  | 'battery'
  | 'excellence'
  | 'evidence'
  | 'calculator'
  | 'risks'
  | 'review'
  | 'report';

const STEPS: Array<{ id: StepId; short: string; label: string }> = [
  { id: 'safety', short: '0. Safety Gate', label: '0. Safety Gate & CriXisZafe™' },
  { id: 'site', short: 'A. ข้อมูลโครงการ', label: 'A. ข้อมูลโครงการและลูกค้า' },
  { id: 'load', short: 'B. การใช้ไฟฟ้า', label: 'B. บิลค่าไฟ & Load Profile' },
  { id: 'roof', short: 'C. หลังคา/โครงสร้าง', label: 'C. หลังคาและพื้นที่ติดตั้ง' },
  { id: 'electrical', short: 'D. ระบบไฟฟ้า', label: 'D. ระบบไฟฟ้าและจุดเชื่อมต่อ' },
  { id: 'battery', short: 'E. Battery/Hybrid', label: 'E. โมดูล Battery / Hybrid' },
  { id: 'excellence', short: 'F. คุณภาพติดตั้ง', label: 'F. XOLARAIZ Excellence' },
  { id: 'evidence', short: 'G. ภาพถ่าย/Markup', label: 'G. ภาพถ่าย แผนผัง และหลักฐาน' },
  { id: 'calculator', short: 'H. คำนวณคุ้มค่า', label: 'H. ประเมินเบื้องต้นและความคุ้มค่า' },
  { id: 'risks', short: 'I. Risk Register', label: 'I. ทะเบียนความเสี่ยง (Risks)' },
  { id: 'review', short: 'J. ตรวจทาน/AI', label: 'J. ตรวจทานวิศวกรรม & Revision' },
  { id: 'report', short: 'K. รายงาน PDF', label: 'K. รายงานและส่งออก PDF' },
];

function bumpMinorRevision(rev: string): string {
  const m = rev.match(/Rev\s*(\d+)\.(\d+)/i);
  if (!m) return 'Rev 1.1';
  return `Rev ${m[1]}.${Number(m[2]) + 1}`;
}

export const SurveyWorkspace: React.FC<SurveyWorkspaceProps> = ({
  project,
  franchise,
  standards,
  activeRole,
  initialTab,
  onSaveProject,
  onBack,
}) => {
  const perms = getRolePermissions(activeRole);
  const readOnly = !perms.canEditSurveyFields;

  const [activeStep, setActiveStep] = useState<StepId>(
    (initialTab as StepId) || (activeRole === 'customer_viewer' ? 'report' : 'safety')
  );
  const [draft, setDraft] = useState<SolarSurveyProject>(project);
  const [saveMessage, setSaveMessage] = useState<string>('บันทึกในเครื่องแล้ว');
  const [gpsFeedback, setGpsFeedback] = useState<string>('');
  const [csvTimezone, setCsvTimezone] = useState('Asia/Bangkok');
  const [csvUnit, setCsvUnit] = useState<'kW' | 'kWh' | 'Unknown'>('kW');
  const [newBillMonth, setNewBillMonth] = useState('2026-10');
  const [newBillKwh, setNewBillKwh] = useState('');
  const [newBillThb, setNewBillThb] = useState('');
  const [newBillDemand, setNewBillDemand] = useState('');
  const [newBillOcrPending, setNewBillOcrPending] = useState(false);

  const lastSavedUpdatedAtRef = useRef<string>(project.updatedAt);

  // Keep local draft synced if parent project ID changes
  useEffect(() => {
    setDraft(project);
    lastSavedUpdatedAtRef.current = project.updatedAt;
  }, [project.id]);

  // Autosave debounced
  const autosaveTimerRef = useRef<number | null>(null);
  const scheduleAutosave = (nextProject: SolarSurveyProject) => {
    setDraft(nextProject);
    setSaveMessage('กำลังบันทึก...');
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = window.setTimeout(async () => {
      await onSaveProject(nextProject, lastSavedUpdatedAtRef.current);
      lastSavedUpdatedAtRef.current = new Date().toISOString();
      setSaveMessage(`บันทึกอัตโนมัติแล้ว (${nextProject.syncState})`);
    }, 450);
  };

  // Helper that bumps revision if critical technical fields change after review
  const mutateTechnical = (
    updater: (prev: SolarSurveyProject) => SolarSurveyProject,
    auditAction?: string,
    auditDetail?: string
  ) => {
    if (readOnly) return;
    let next = updater(draft);
    const wasReviewed = next.status === 'Reviewed' || next.status === 'Report Issued';
    if (wasReviewed) {
      const newRev = bumpMinorRevision(next.revisionNumber);
      next = {
        ...next,
        revisionNumber: newRev,
        status: 'Engineering Review',
        revisions: [
          {
            revisionNumber: newRev,
            createdAt: new Date().toISOString(),
            createdBy: activeRole,
            reason: auditDetail || 'แก้ไขข้อมูลทางเทคนิคหลังตรวจทาน — รอวิศวกรตรวจซ้ำ',
            invalidatedReview: true,
          },
          ...next.revisions,
        ],
        auditLog: [
          {
            id: `aud-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actorName: activeRole,
            actorRole: activeRole,
            action: auditAction || 'แก้ไขข้อมูลเทคนิคหลังตรวจทาน',
            detail: `${auditDetail || 'อัปเดตข้อมูล'} · สร้าง ${newRev} และรีเซ็ตสถานะเป็นรอตรวจทาน`,
            revisionNumber: newRev,
          },
          ...next.auditLog,
        ],
      };
    } else if (auditAction) {
      next = {
        ...next,
        auditLog: [
          {
            id: `aud-${Date.now()}`,
            timestamp: new Date().toISOString(),
            actorName: activeRole,
            actorRole: activeRole,
            action: auditAction,
            detail: auditDetail || '',
            revisionNumber: next.revisionNumber,
          },
          ...next.auditLog,
        ],
      };
    }
    scheduleAutosave(next);
  };

  const completeness = useMemo(() => analyzeSurveyCompleteness(draft), [draft]);
  const riskStatus = useMemo(() => getCriticalRiskStatus(draft), [draft]);

  const handleRequestGps = () => {
    if (readOnly) return;
    if (!navigator.geolocation) {
      setGpsFeedback('เบราว์เซอร์นี้ไม่รองรับการดึงพิกัด GPS');
      return;
    }
    setGpsFeedback('กำลังขออนุญาตเข้าถึงตำแหน่งจากอุปกรณ์...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mutateTechnical((prev) => ({
          ...prev,
          site: {
            ...prev.site,
            gpsConsentGranted: true,
            gpsLat: Math.round(pos.coords.latitude * 100000) / 100000,
            gpsLng: Math.round(pos.coords.longitude * 100000) / 100000,
          },
        }));
        setGpsFeedback('บันทึกพิกัด GPS หน้างานเรียบร้อย');
      },
      (err) => {
        setGpsFeedback(`ไม่สามารถดึงตำแหน่งได้ (${err.message}) — สามารถกรอกที่อยู่ด้วยตนเองได้`);
      }
    );
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || readOnly) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const summary = parseLoadProfileCsv(text, file.name, csvTimezone, csvUnit);
      mutateTechnical(
        (prev) => ({
          ...prev,
          electricalLoad: {
            ...prev.electricalLoad,
            loadProfile: summary,
          },
        }),
        'นำเข้า CSV Load Profile',
        `ไฟล์ ${file.name} (${summary.rowCount} แถว, หน่วย: ${csvUnit})`
      );
    };
    reader.readAsText(file);
  };

  const handleAddBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || !newBillKwh || !newBillThb) return;
    const bill: UtilityBillRecord = {
      id: `bill-${Date.now()}`,
      meterNumber: draft.electricalLoad.meters[0]?.meterNumber || 'MAIN-METER',
      billingMonth: newBillMonth,
      kwhTotal: Number(newBillKwh),
      demandKw: newBillDemand ? Number(newBillDemand) : undefined,
      billAmountThb: Number(newBillThb),
      tariffType: draft.electricalLoad.meters[0]?.utilityTariff || '-',
      source: newBillOcrPending ? 'OCR Pending Verification' : 'Manual Entry',
    };
    mutateTechnical((prev) => ({
      ...prev,
      electricalLoad: {
        ...prev.electricalLoad,
        bills: [bill, ...prev.electricalLoad.bills],
      },
    }));
    setNewBillKwh('');
    setNewBillThb('');
    setNewBillDemand('');
    setNewBillOcrPending(false);
  };

  const handleAddRoofZone = () => {
    if (readOnly) return;
    const zone: RoofZone = {
      id: `rz-${Date.now()}`,
      name: `โซนหลังคาใหม่ #${draft.roofZones.length + 1}`,
      roofType: 'หลังคาเมทัลชีท / จั่ว',
      material: '',
      ageYears: { status: 'unknown', value: null },
      structureType: '',
      purlinSpanMeters: { status: 'unknown', value: null },
      asBuiltDrawingAvailable: { status: 'unknown', value: null },
      pitchDegrees: { status: 'unknown', value: null },
      azimuthDirection: '',
      grossAreaSqm: { status: 'unknown', value: null },
      usableAreaSqm: { status: 'unknown', value: null },
      skylightsAndOpenings: '',
      parapetAndDrainageNotes: '',
      conditionFindings: '',
      shadingObservations: '',
      shadingTimeWindow: '',
      accessAndMaintenancePath: '',
      suspectedHazardousMaterial: { status: 'unknown', value: null },
      hazardousMaterialNote: '',
      structuralEngineerStatus: 'ยังไม่ประเมิน',
      structuralNote: 'ภาพถ่ายใช้บันทึกข้อสังเกตเท่านั้น ไม่ใช่ใบรับรองกำลังรับน้ำหนัก',
    };
    mutateTechnical((prev) => ({
      ...prev,
      roofZones: [...prev.roofZones, zone],
    }));
  };

  const visibleSteps =
    activeRole === 'customer_viewer'
      ? STEPS.filter((s) => s.id === 'report')
      : activeRole === 'sales_consultant'
      ? STEPS.filter((s) => ['site', 'calculator', 'report'].includes(s.id))
      : STEPS;

  return (
    <div className="space-y-6">
      {/* Top Project Context & Autosave Strip */}
      <div className="no-print rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 font-medium text-slate-800 dark:text-amber-400 hover:underline mr-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              กลับหน้าหลัก
            </button>
            <span className="font-mono font-semibold text-slate-900 dark:text-white">
              {draft.projectCode}
            </span>
            <span aria-hidden="true">·</span>
            <span>{franchise?.code ?? draft.franchiseId}</span>
            <span aria-hidden="true">·</span>
            <span>{draft.projectType} ({draft.topology})</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{draft.revisionNumber}</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            {draft.site.customerName}
          </h1>
          <div className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>สถานะ: {WORKFLOW_STATUS_LABELS[draft.status]}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">ความครบถ้วน {completeness.completionPct}%</span>
            <span aria-hidden="true">·</span>
            <span>{saveMessage}</span>
          </div>
        </div>

        {/* Conflict resolution notice if detected */}
        {draft.syncState === 'Conflict' && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-xs text-red-800 dark:text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>ตรวจพบ Conflict กับข้อมูลฉบับก่อนหน้า — ระบบจะไม่เขียนทับเงียบ ๆ</span>
            <button
              type="button"
              onClick={() => onSaveProject({ ...draft, syncState: 'Saved locally' })}
              className="underline font-semibold ml-1"
            >
              ยืนยันใช้ฉบับในเครื่อง
            </button>
          </div>
        )}
      </div>

      {/* Main Split: Desktop Stepper Sidebar + Active Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Stepper Navigation */}
        <aside className="no-print lg:col-span-3 space-y-4">
          <nav
            aria-label="ขั้นตอนการสำรวจ"
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 flex lg:flex-col gap-1 overflow-x-auto"
          >
            {visibleSteps.map((st) => {
              const active = activeStep === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setActiveStep(st.id)}
                  className={`text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap lg:whitespace-normal shrink-0 min-h-[42px] flex items-center justify-between gap-2 ${
                    active
                      ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{st.label}</span>
                  {st.id === 'risks' && riskStatus.hasBlockingCriticalRisk && (
                    <span className="text-[10px] font-bold text-red-500 dark:text-red-950">!</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Missing & Unknown Data Summary */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white">
              <span>สรุปข้อมูลที่ยังขาด / รอตรวจ</span>
              <span className="tabular-nums">{completeness.completionPct}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{ width: `${completeness.completionPct}%` }}
              />
            </div>

            {completeness.missingItems.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  ข้อมูลที่ยังขาด:
                </div>
                <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5 list-disc pl-4">
                  {completeness.missingItems.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {completeness.unknownItems.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  รายการที่ยังระบุเป็น “ไม่ทราบ/รอตรวจ”:
                </div>
                <ul className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5 list-disc pl-4">
                  {completeness.unknownItems.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>

        {/* Step Content Area */}
        <div className="lg:col-span-9 space-y-6">
          {/* STEP 0: SAFETY GATE & CRIXISZAFE */}
          {activeStep === 'safety' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
                  0. Safety Gate ก่อนเริ่มสำรวจ &amp; แนวทางความปลอดภัย CriXisZafe™
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  ห้ามบังคับผู้ไม่มีคุณสมบัติเปิดตู้ไฟที่มีไฟ วัดวงจรที่มีไฟ หรือขึ้นหลังคาเปราะ —
                  หากจุดใดไม่ปลอดภัย ให้เลือก “ไม่ปลอดภัยที่จะตรวจ” หรือ “ต้องใช้ผู้มีคุณสมบัติ” แล้วบันทึกข้อสังเกตจากพื้นที่ปลอดภัยแทน
                </p>
              </div>

              {riskStatus.hasBlockingCriticalRisk && (
                <div className="p-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-xs text-red-800 dark:text-red-200 space-y-1">
                  <div className="font-bold">
                    หยุดกิจกรรมที่เกี่ยวข้อง / ต้องประเมินก่อนดำเนินการ
                  </div>
                  <div>
                    คุณยังสามารถบันทึกข้อมูลสำรวจจากพื้นที่ปลอดภัยได้ตามปกติ แต่ระบบจะล็อกไม่ให้ปิดงานหรืออนุมัติพร้อมดำเนินการจนกว่าความเสี่ยงวิกฤตจะได้รับการแก้ไขและตรวจยืนยัน
                  </div>
                </div>
              )}

              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {draft.safetyGate.map((gate) => (
                  <div key={gate.id} className="py-4 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {gate.title}{' '}
                          {gate.isCriticalHazard && (
                            <span className="text-xs font-medium text-red-700 dark:text-red-400">
                              (Critical Gate)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {gate.description}
                        </p>
                      </div>

                      <select
                        disabled={readOnly}
                        value={gate.state}
                        onChange={(e) => {
                          const nextState = e.target.value as SafetyCheckState;
                          mutateTechnical(
                            (prev) => ({
                              ...prev,
                              safetyGate: prev.safetyGate.map((g) =>
                                g.id === gate.id ? { ...g, state: nextState } : g
                              ),
                            }),
                            'อัปเดต Safety Gate',
                            `${gate.title} → ${nextState}`
                          );
                        }}
                        className="text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[40px] shrink-0"
                      >
                        <option value="not_checked">ยังไม่ตรวจ</option>
                        <option value="safe_to_proceed">ปลอดภัย / ควบคุมความเสี่ยงแล้ว</option>
                        <option value="unsafe_to_inspect">ไม่ปลอดภัยที่จะตรวจ (หยุดกิจกรรมนี้)</option>
                        <option value="requires_qualified_person">ต้องใช้ผู้มีคุณสมบัติ / ใบอนุญาต</option>
                        <option value="not_applicable">ไม่เกี่ยวข้องกับสถานที่นี้</option>
                      </select>
                    </div>

                    <input
                      type="text"
                      disabled={readOnly}
                      value={gate.mitigationNote}
                      onChange={(e) =>
                        mutateTechnical((prev) => ({
                          ...prev,
                          safetyGate: prev.safetyGate.map((g) =>
                            g.id === gate.id ? { ...g, mitigationNote: e.target.value } : g
                          ),
                        }))
                      }
                      placeholder="บันทึกมาตรการป้องกันหน้างาน / PPE / จุดสังเกตจากพื้นที่ปลอดภัย..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP A: SITE & CUSTOMER */}
          {activeStep === 'site' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Home className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                A. ข้อมูลโครงการ ลูกค้า และข้อจำกัดการเข้าพื้นที่
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">ชื่อโครงการ / ลูกค้า</label>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={draft.site.customerName}
                    onChange={(e) =>
                      mutateTechnical((p) => ({
                        ...p,
                        site: { ...p.site, customerName: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">ผู้ติดต่อหน้างาน</label>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={draft.site.contactPerson}
                    onChange={(e) =>
                      mutateTechnical((p) => ({
                        ...p,
                        site: { ...p.site, contactPerson: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">เบอร์ติดต่อ (PDPA Sensitive)</label>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={draft.site.contactPhone}
                    onChange={(e) =>
                      mutateTechnical((p) => ({
                        ...p,
                        site: { ...p.site, contactPhone: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">เจ้าของอาคาร / ผู้มีอำนาจอนุญาต</label>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={draft.site.buildingOwnerOrAuthorizer}
                    onChange={(e) =>
                      mutateTechnical((p) => ({
                        ...p,
                        site: { ...p.site, buildingOwnerOrAuthorizer: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1">ที่อยู่โครงการ</label>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={draft.site.address}
                    onChange={(e) =>
                      mutateTechnical((p) => ({
                        ...p,
                        site: { ...p.site, address: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">เขตการไฟฟ้า</label>
                  <select
                    disabled={readOnly}
                    value={draft.site.utilityProvider}
                    onChange={(e) =>
                      mutateTechnical((p) => ({
                        ...p,
                        site: {
                          ...p.site,
                          utilityProvider: e.target.value as 'MEA' | 'PEA' | 'Other',
                        },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
                  >
                    <option value="MEA">กฟน. (MEA)</option>
                    <option value="PEA">กฟภ. (PEA)</option>
                    <option value="Other">อื่น ๆ (ระบุ)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">พิกัด GPS (ขออนุญาตก่อนใช้งาน)</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 min-h-[42px] flex items-center">
                      {draft.site.gpsLat && draft.site.gpsLng
                        ? `${draft.site.gpsLat}, ${draft.site.gpsLng}`
                        : 'ยังไม่ได้บันทึกพิกัด'}
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={handleRequestGps}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[42px] shrink-0"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        ดึง GPS
                      </button>
                    )}
                  </div>
                  {gpsFeedback && <p className="text-[11px] text-slate-500 mt-1">{gpsFeedback}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">ประเภทอาคารและลักษณะการใช้งาน</label>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={draft.site.buildingType}
                    onChange={(e) =>
                      mutateTechnical((p) => ({
                        ...p,
                        site: { ...p.site, buildingType: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">งบประมาณและแผนขยายในอนาคต</label>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={draft.site.expansionPlan}
                    onChange={(e) =>
                      mutateTechnical((p) => ({
                        ...p,
                        site: { ...p.site, expansionPlan: e.target.value },
                      }))
                    }
                    placeholder="เช่น แผนเพิ่ม EV Charger หรือขยายไลน์ผลิต"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1">ข้อจำกัดเวลาเข้าพื้นที่และกฎความปลอดภัยหน้างาน</label>
                  <input
                    type="text"
                    disabled={readOnly}
                    value={draft.site.accessConstraints}
                    onChange={(e) =>
                      mutateTechnical((p) => ({
                        ...p,
                        site: { ...p.site, accessConstraints: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={draft.site.pdpaConsentRecorded}
                    onChange={(e) =>
                      mutateTechnical((p) => ({
                        ...p,
                        site: {
                          ...p.site,
                          pdpaConsentRecorded: e.target.checked,
                          pdpaConsentDate: e.target.checked
                            ? new Date().toISOString().slice(0, 10)
                            : undefined,
                        },
                      }))
                    }
                    className="mt-0.5 w-4 h-4"
                  />
                  <span>
                    <strong>ยืนยันการแจ้ง PDPA Privacy Notice:</strong> เจ้าของข้อมูลได้รับทราบวัตถุประสงค์การเก็บภาพถ่าย บิลค่าไฟ และข้อมูลระบบไฟฟ้าเพื่อการสำรวจและออกแบบเบื้องต้นแล้ว
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* STEP B: ELECTRICAL LOAD & UTILITY */}
          {activeStep === 'load' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  B. ข้อมูลการใช้ไฟฟ้า บิลค่าไฟ และ Load Profile
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">ช่วงเวลาใช้งาน / ชั่วโมงทำงาน</label>
                    <input
                      type="text"
                      disabled={readOnly}
                      value={draft.electricalLoad.operatingHours}
                      onChange={(e) =>
                        mutateTechnical((p) => ({
                          ...p,
                          electricalLoad: { ...p.electricalLoad, operatingHours: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[40px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">วันหยุดและช่วงโหลดต่ำ</label>
                    <input
                      type="text"
                      disabled={readOnly}
                      value={draft.electricalLoad.holidaysPattern}
                      onChange={(e) =>
                        mutateTechnical((p) => ({
                          ...p,
                          electricalLoad: { ...p.electricalLoad, holidaysPattern: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[40px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">ฤดูกาลผลิต / การแปรผัน</label>
                    <input
                      type="text"
                      disabled={readOnly}
                      value={draft.electricalLoad.seasonalVariation}
                      onChange={(e) =>
                        mutateTechnical((p) => ({
                          ...p,
                          electricalLoad: {
                            ...p.electricalLoad,
                            seasonalVariation: e.target.value,
                          },
                        }))
                      }
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[40px]"
                    />
                  </div>
                </div>

                {/* C&I Multi-Meter Support */}
                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      มิเตอร์ หม้อแปลง Generator และ ATS ({draft.electricalLoad.meters.length} จุด)
                    </h3>
                    {!readOnly && draft.projectType === 'C&I' && (
                      <button
                        type="button"
                        onClick={() => {
                          const m: ElectricalMeterGroup = {
                            id: `m-${Date.now()}`,
                            label: `มิเตอร์ย่อย #${draft.electricalLoad.meters.length + 1}`,
                            buildingName: '',
                            meterNumber: '',
                            utilityTariff: draft.site.utilityProvider,
                            transformerKva: { status: 'unknown', value: null },
                            hasGenerator: { status: 'unknown', value: null },
                            hasAts: { status: 'unknown', value: null },
                            criticalLoadsDesc: '',
                          };
                          mutateTechnical((p) => ({
                            ...p,
                            electricalLoad: {
                              ...p.electricalLoad,
                              meters: [...p.electricalLoad.meters, m],
                            },
                          }));
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        เพิ่มมิเตอร์/อาคาร (C&amp;I)
                      </button>
                    )}
                  </div>

                  {draft.electricalLoad.meters.map((meter, idx) => (
                    <div
                      key={meter.id}
                      className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
                          type="text"
                          disabled={readOnly}
                          value={meter.label}
                          onChange={(e) =>
                            mutateTechnical((p) => ({
                              ...p,
                              electricalLoad: {
                                ...p.electricalLoad,
                                meters: p.electricalLoad.meters.map((x, i) =>
                                  i === idx ? { ...x, label: e.target.value } : x
                                ),
                              },
                            }))
                          }
                          placeholder="ชื่อเรียกจุดมิเตอร์"
                          className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                        />
                        <input
                          type="text"
                          disabled={readOnly}
                          value={meter.meterNumber}
                          onChange={(e) =>
                            mutateTechnical((p) => ({
                              ...p,
                              electricalLoad: {
                                ...p.electricalLoad,
                                meters: p.electricalLoad.meters.map((x, i) =>
                                  i === idx ? { ...x, meterNumber: e.target.value } : x
                                ),
                              },
                            }))
                          }
                          placeholder="หมายเลขมิเตอร์ / ประเภทอัตราค่าไฟ"
                          className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                        />
                        <input
                          type="text"
                          disabled={readOnly}
                          value={meter.criticalLoadsDesc}
                          onChange={(e) =>
                            mutateTechnical((p) => ({
                              ...p,
                              electricalLoad: {
                                ...p.electricalLoad,
                                meters: p.electricalLoad.meters.map((x, i) =>
                                  i === idx ? { ...x, criticalLoadsDesc: e.target.value } : x
                                ),
                              },
                            }))
                          }
                          placeholder="โหลดสำคัญ (Critical Loads)"
                          className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <EpistemicNumberField
                          label="ขนาดหม้อแปลงเฉพาะราย"
                          unit="kVA"
                          field={meter.transformerKva}
                          disabled={readOnly}
                          onChange={(next) =>
                            mutateTechnical((p) => ({
                              ...p,
                              electricalLoad: {
                                ...p.electricalLoad,
                                meters: p.electricalLoad.meters.map((x, i) =>
                                  i === idx ? { ...x, transformerKva: next } : x
                                ),
                              },
                            }))
                          }
                        />
                        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                          <div>
                            <strong>Generator:</strong>{' '}
                            {meter.hasGenerator.status === 'known'
                              ? meter.hasGenerator.value
                                ? `มี (${meter.hasGenerator.note || 'ต้องออกแบบ Interlock'})`
                                : 'ไม่มี'
                              : 'ไม่ทราบ'}
                          </div>
                          <div>
                            <strong>ATS:</strong>{' '}
                            {meter.hasAts.status === 'known'
                              ? meter.hasAts.value
                                ? `มี (${meter.hasAts.note || ''})`
                                : 'ไม่มี'
                              : 'ไม่ทราบ'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CSV Load Profile Importer */}
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                        นำเข้า Load Profile จากไฟล์ CSV (ตรวจหน่วย Timezone และข้อมูลที่ขาด)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        รูปแบบคอลัมน์: timestamp (เช่น 2026-10-01T09:00), value
                      </p>
                    </div>
                    {!readOnly && (
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={csvTimezone}
                          onChange={(e) => setCsvTimezone(e.target.value)}
                          className="px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                        >
                          <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
                          <option value="UTC">UTC</option>
                        </select>
                        <select
                          value={csvUnit}
                          onChange={(e) => setCsvUnit(e.target.value as 'kW' | 'kWh' | 'Unknown')}
                          className="px-2.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                        >
                          <option value="kW">หน่วย: kW (กำลังไฟฟ้าเฉลี่ยช่วงเวลา)</option>
                          <option value="kWh">หน่วย: kWh (พลังงานต่อช่วงเวลา)</option>
                          <option value="Unknown">ยังไม่ทราบหน่วย</option>
                        </select>
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          อัปโหลด CSV
                          <input
                            type="file"
                            accept=".csv,text/csv"
                            onChange={handleCsvUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs tabular-nums">
                    <div>
                      <span className="text-slate-500">ไฟล์:</span>{' '}
                      <strong>{draft.electricalLoad.loadProfile.importedFileName ?? 'ยังไม่มี'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">จำนวนแถว:</span>{' '}
                      <strong>{draft.electricalLoad.loadProfile.rowCount}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">สัดส่วนกลางวัน:</span>{' '}
                      <strong>
                        {draft.electricalLoad.loadProfile.daytimeSharePct.value !== null
                          ? `${draft.electricalLoad.loadProfile.daytimeSharePct.value}% (${draft.electricalLoad.loadProfile.daytimeShareBasis})`
                          : 'ไม่ทราบ'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">แถวข้อมูลขาดหาย:</span>{' '}
                      <strong>{draft.electricalLoad.loadProfile.missingIntervalsCount}</strong>
                    </div>
                  </div>

                  {draft.electricalLoad.loadProfile.warnings.map((w, i) => (
                    <div key={i} className="text-[11px] text-amber-700 dark:text-amber-400">
                      • {w}
                    </div>
                  ))}
                </div>

                {/* Utility Bills */}
                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-semibold">ประวัติบิลค่าไฟฟ้า</h3>
                  {!readOnly && (
                    <form onSubmit={handleAddBill} className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <input
                        type="month"
                        value={newBillMonth}
                        onChange={(e) => setNewBillMonth(e.target.value)}
                        className="px-2.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                      <input
                        type="number"
                        placeholder="หน่วยรวม (kWh)"
                        value={newBillKwh}
                        onChange={(e) => setNewBillKwh(e.target.value)}
                        className="px-2.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                      <input
                        type="number"
                        placeholder="ยอดเงิน (บาท)"
                        value={newBillThb}
                        onChange={(e) => setNewBillThb(e.target.value)}
                        className="px-2.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                      <input
                        type="number"
                        placeholder="Demand (kW ถ้ามี)"
                        value={newBillDemand}
                        onChange={(e) => setNewBillDemand(e.target.value)}
                        className="px-2.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                      <button
                        type="submit"
                        className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950"
                      >
                        + เพิ่มบิล
                      </button>
                      <label className="col-span-2 sm:col-span-5 inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                        <input
                          type="checkbox"
                          checked={newBillOcrPending}
                          onChange={(e) => setNewBillOcrPending(e.target.checked)}
                        />
                        บันทึกเป็นข้อมูลจาก OCR (ต้องให้ผู้ใช้กดยืนยันก่อนนำไปคำนวณ)
                      </label>
                    </form>
                  )}

                  {draft.electricalLoad.bills.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                            <th className="py-2 pr-3">เดือน</th>
                            <th className="py-2 px-3 text-right">kWh รวม</th>
                            <th className="py-2 px-3 text-right">Demand (kW)</th>
                            <th className="py-2 px-3 text-right">ค่าไฟ (บาท)</th>
                            <th className="py-2 pl-3">สถานะยืนยัน</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                          {draft.electricalLoad.bills.map((b) => (
                            <tr key={b.id}>
                              <td className="py-2 pr-3 font-mono">{b.billingMonth}</td>
                              <td className="py-2 px-3 text-right">{b.kwhTotal.toLocaleString()}</td>
                              <td className="py-2 px-3 text-right">{b.demandKw ?? '-'}</td>
                              <td className="py-2 px-3 text-right">{b.billAmountThb.toLocaleString()}</td>
                              <td className="py-2 pl-3">
                                {b.source === 'OCR Pending Verification' && !readOnly ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      mutateTechnical((p) => ({
                                        ...p,
                                        electricalLoad: {
                                          ...p.electricalLoad,
                                          bills: p.electricalLoad.bills.map((x) =>
                                            x.id === b.id ? { ...x, source: 'OCR Verified' } : x
                                          ),
                                        },
                                      }))
                                    }
                                    className="text-amber-700 dark:text-amber-400 underline font-medium"
                                  >
                                    รอยืนยัน OCR (คลิกเพื่อยืนยัน)
                                  </button>
                                ) : (
                                  b.source
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP C: ROOF & STRUCTURAL ZONES */}
          {activeStep === 'roof' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>หลักเกณฑ์โครงสร้างหลังคา:</strong> ห้ามสรุปกำลังรับน้ำหนักหลังคาจากภาพถ่ายหรืออายุหลังคาเพียงอย่างเดียว
                  ภาพถ่ายใช้บันทึกข้อสังเกตหน้างานเท่านั้น ไม่ใช่ใบรับรองโครงสร้าง
                </span>
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  C. หลังคาและพื้นที่ติดตั้ง ({draft.roofZones.length} โซน)
                </h2>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={handleAddRoofZone}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 min-h-[40px]"
                  >
                    <Plus className="w-4 h-4" />
                    เพิ่มโซนหลังคา
                  </button>
                )}
              </div>

              {draft.roofZones.length === 0 ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-500">
                  ยังไม่มีโซนหลังคา กด “เพิ่มโซนหลังคา” เพื่อบันทึกข้อมูล
                </div>
              ) : (
                draft.roofZones.map((zone, idx) => (
                  <div
                    key={zone.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        disabled={readOnly}
                        value={zone.name}
                        onChange={(e) =>
                          mutateTechnical((p) => ({
                            ...p,
                            roofZones: p.roofZones.map((z, i) =>
                              i === idx ? { ...z, name: e.target.value } : z
                            ),
                          }))
                        }
                        className="text-base font-semibold bg-transparent border-b border-transparent focus:border-amber-500 focus:outline-none text-slate-900 dark:text-white flex-1"
                      />
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            mutateTechnical((p) => ({
                              ...p,
                              roofZones: p.roofZones.filter((_, i) => i !== idx),
                            }))
                          }
                          aria-label="ลบโซนหลังคา"
                          className="p-2 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium mb-1">ประเภท / วัสดุหลังคา</label>
                        <input
                          type="text"
                          disabled={readOnly}
                          value={zone.material}
                          onChange={(e) =>
                            mutateTechnical((p) => ({
                              ...p,
                              roofZones: p.roofZones.map((z, i) =>
                                i === idx ? { ...z, material: e.target.value } : z
                              ),
                            }))
                          }
                          placeholder="เช่น CPAC Monier / Standing Seam"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[40px]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">ทิศทาง (Azimuth)</label>
                        <input
                          type="text"
                          disabled={readOnly}
                          value={zone.azimuthDirection}
                          onChange={(e) =>
                            mutateTechnical((p) => ({
                              ...p,
                              roofZones: p.roofZones.map((z, i) =>
                                i === idx ? { ...z, azimuthDirection: e.target.value } : z
                              ),
                            }))
                          }
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[40px]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">สถานะการประเมินโดยวิศวกรโครงสร้าง</label>
                        <select
                          disabled={readOnly}
                          value={zone.structuralEngineerStatus}
                          onChange={(e) =>
                            mutateTechnical((p) => ({
                              ...p,
                              roofZones: p.roofZones.map((z, i) =>
                                i === idx
                                  ? {
                                      ...z,
                                      structuralEngineerStatus: e.target
                                        .value as RoofZone['structuralEngineerStatus'],
                                    }
                                  : z
                              ),
                            }))
                          }
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[40px]"
                        >
                          <option value="ยังไม่ประเมิน">ยังไม่ประเมิน</option>
                          <option value="ส่งประเมินแล้ว">ส่งประเมินแล้ว</option>
                          <option value="มีเอกสารรับรองจากวิศวกรโครงสร้าง">
                            มีเอกสารรับรองจากวิศวกรโครงสร้าง
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <EpistemicNumberField
                        label="พื้นที่ใช้งานได้จริง"
                        unit="ตร.ม."
                        field={zone.usableAreaSqm}
                        disabled={readOnly}
                        onChange={(next) =>
                          mutateTechnical((p) => ({
                            ...p,
                            roofZones: p.roofZones.map((z, i) =>
                              i === idx ? { ...z, usableAreaSqm: next } : z
                            ),
                          }))
                        }
                      />
                      <EpistemicNumberField
                        label="ความลาดเอียง"
                        unit="องศา"
                        field={zone.pitchDegrees}
                        disabled={readOnly}
                        onChange={(next) =>
                          mutateTechnical((p) => ({
                            ...p,
                            roofZones: p.roofZones.map((z, i) =>
                              i === idx ? { ...z, pitchDegrees: next } : z
                            ),
                          }))
                        }
                      />
                      <EpistemicNumberField
                        label="ระยะแป / ช่วงพาด"
                        unit="เมตร"
                        field={zone.purlinSpanMeters}
                        disabled={readOnly}
                        onChange={(next) =>
                          mutateTechnical((p) => ({
                            ...p,
                            roofZones: p.roofZones.map((z, i) =>
                              i === idx ? { ...z, purlinSpanMeters: next } : z
                            ),
                          }))
                        }
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block font-medium mb-1">
                          Skylight ช่องเปิด ขอบหลังคา ทางระบายน้ำ และร่องรอยรั่ว/สนิม
                        </label>
                        <textarea
                          rows={2}
                          disabled={readOnly}
                          value={zone.conditionFindings}
                          onChange={(e) =>
                            mutateTechnical((p) => ({
                              ...p,
                              roofZones: p.roofZones.map((z, i) =>
                                i === idx ? { ...z, conditionFindings: e.target.value } : z
                              ),
                            }))
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                        />
                      </div>
                      <div>
                        <label className="block font-medium mb-1">
                          เงาบังและช่วงเวลาที่สังเกต / วัสดุอันตราย (เช่น แร่ใยหิน)
                        </label>
                        <textarea
                          rows={2}
                          disabled={readOnly}
                          value={zone.shadingObservations}
                          onChange={(e) =>
                            mutateTechnical((p) => ({
                              ...p,
                              roofZones: p.roofZones.map((z, i) =>
                                i === idx ? { ...z, shadingObservations: e.target.value } : z
                              ),
                            }))
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* STEP D: ELECTRICAL CONNECTION */}
          {activeStep === 'electrical' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  D. ระบบไฟฟ้าและจุดเชื่อมต่อ (Point of Connection)
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  ไม่กำหนดขนาดสายไฟ เบรกเกอร์ หรืออุปกรณ์ป้องกันโดยใช้เพียงขนาด kW — หากยังเปิดตู้ตรวจไม่ได้ ให้เลือก “ต้องใช้ผู้มีคุณสมบัติ” หรือ “ไม่ปลอดภัยที่จะตรวจ”
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">ระบบไฟฟ้า</label>
                  <select
                    disabled={readOnly}
                    value={draft.electricalConnection.phaseSystem}
                    onChange={(e) =>
                      mutateTechnical((p) => ({
                        ...p,
                        electricalConnection: {
                          ...p.electricalConnection,
                          phaseSystem: e.target.value as typeof p.electricalConnection.phaseSystem,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
                  >
                    <option value="Unknown">ยังไม่ทราบ</option>
                    <option value="1-Phase 230V">1 เฟส 230V</option>
                    <option value="3-Phase 230/400V">3 เฟส 230/400V</option>
                    <option value="3-Phase MV/Transformer">3 เฟส มีหม้อแปลงเฉพาะราย</option>
                  </select>
                </div>

                <EpistemicTextField
                  label="ข้อมูลแรงดันที่ตรวจวัดและยืนยันแล้ว"
                  field={draft.electricalConnection.confirmedVoltage}
                  disabled={readOnly}
                  safetySensitive
                  onChange={(next) =>
                    mutateTechnical((p) => ({
                      ...p,
                      electricalConnection: { ...p.electricalConnection, confirmedVoltage: next },
                    }))
                  }
                />

                <EpistemicNumberField
                  label="พิกัด Main Breaker"
                  unit="A"
                  field={draft.electricalConnection.mainBreakerRatingA}
                  disabled={readOnly}
                  safetySensitive
                  onChange={(next) =>
                    mutateTechnical((p) => ({
                      ...p,
                      electricalConnection: { ...p.electricalConnection, mainBreakerRatingA: next },
                    }))
                  }
                />

                <EpistemicTextField
                  label="ข้อมูล Busbar และสายเมนเดิม"
                  field={draft.electricalConnection.busbarAndConductorInfo}
                  disabled={readOnly}
                  safetySensitive
                  onChange={(next) =>
                    mutateTechnical((p) => ({
                      ...p,
                      electricalConnection: {
                        ...p.electricalConnection,
                        busbarAndConductorInfo: next,
                      },
                    }))
                  }
                />

                <EpistemicTextField
                  label="ระบบสายดิน (Grounding & Bonding)"
                  field={draft.electricalConnection.groundingAndBondingStatus}
                  disabled={readOnly}
                  safetySensitive
                  onChange={(next) =>
                    mutateTechnical((p) => ({
                      ...p,
                      electricalConnection: {
                        ...p.electricalConnection,
                        groundingAndBondingStatus: next,
                      },
                    }))
                  }
                />

                <EpistemicNumberField
                  label="ระยะเส้นทางสาย AC/DC โดยประมาณ"
                  unit="เมตร"
                  field={draft.electricalConnection.acDcCableRouteAndDistanceM}
                  disabled={readOnly}
                  onChange={(next) =>
                    mutateTechnical((p) => ({
                      ...p,
                      electricalConnection: {
                        ...p.electricalConnection,
                        acDcCableRouteAndDistanceM: next,
                      },
                    }))
                  }
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">จุดเชื่อมต่อที่เสนอและเหตุผล (Proposed POC)</label>
                  <textarea
                    rows={2}
                    disabled={readOnly}
                    value={draft.electricalConnection.proposedPoc}
                    onChange={(e) =>
                      mutateTechnical((p) => ({
                        ...p,
                        electricalConnection: {
                          ...p.electricalConnection,
                          proposedPoc: e.target.value,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    ตำแหน่งติดตั้ง Inverter / Isolator และสภาพแวดล้อม (การระบายอากาศ น้ำท่วม ฝุ่น ไอเคมี)
                  </label>
                  <textarea
                    rows={2}
                    disabled={readOnly}
                    value={draft.electricalConnection.inverterAndIsolatorPlacement}
                    onChange={(e) =>
                      mutateTechnical((p) => ({
                        ...p,
                        electricalConnection: {
                          ...p.electricalConnection,
                          inverterAndIsolatorPlacement: e.target.value,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    ข้อพิจารณา Anti-islanding, Export Limitation และการประสานอุปกรณ์ป้องกัน
                  </label>
                  <textarea
                    rows={2}
                    disabled={readOnly}
                    value={draft.electricalConnection.antiIslandingAndExportLimitationNotes}
                    onChange={(e) =>
                      mutateTechnical((p) => ({
                        ...p,
                        electricalConnection: {
                          ...p.electricalConnection,
                          antiIslandingAndExportLimitationNotes: e.target.value,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP E: BATTERY / HYBRID */}
          {activeStep === 'battery' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <BatteryCharging className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    E. โมดูลสำรวจ Battery / Hybrid Energy Storage
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    หมายเหตุสำคัญ: ระบบ On-grid ทั่วไปไม่สามารถสำรองไฟขณะไฟดับได้ (Anti-islanding จะตัดระบบอัตโนมัติ)
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={draft.batteryModule.applicable}
                    onChange={(e) =>
                      mutateTechnical((p) => ({
                        ...p,
                        batteryModule: { ...p.batteryModule, applicable: e.target.checked },
                      }))
                    }
                  />
                  เปิดใช้งานโมดูลสำรวจ Battery / Hybrid
                </label>
              </div>

              {!draft.batteryModule.applicable ? (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  โครงการนี้ตั้งเป็นระบบ On-grid ไม่ใช้แบตเตอรี่ — ระบบ On-grid ทั่วไปจะหยุดจ่ายไฟเมื่อไฟฟ้าของการไฟฟ้าดับเพื่อความปลอดภัยของเจ้าหน้าที่การไฟฟ้า
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">วัตถุประสงค์การติดตั้ง BESS</label>
                      <input
                        type="text"
                        disabled={readOnly}
                        value={draft.batteryModule.backupObjective}
                        onChange={(e) =>
                          mutateTechnical((p) => ({
                            ...p,
                            batteryModule: { ...p.batteryModule, backupObjective: e.target.value },
                          }))
                        }
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[40px]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">รายการโหลดสำรอง (Critical Loads)</label>
                      <input
                        type="text"
                        disabled={readOnly}
                        value={draft.batteryModule.criticalLoadList}
                        onChange={(e) =>
                          mutateTechnical((p) => ({
                            ...p,
                            batteryModule: { ...p.batteryModule, criticalLoadList: e.target.value },
                          }))
                        }
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[40px]"
                      />
                    </div>
                    <EpistemicNumberField
                      label="กำลังโหลดสำรองรวมโดยประมาณ"
                      unit="kW"
                      field={draft.batteryModule.estimatedBackupLoadKw}
                      disabled={readOnly}
                      onChange={(next) =>
                        mutateTechnical((p) => ({
                          ...p,
                          batteryModule: { ...p.batteryModule, estimatedBackupLoadKw: next },
                        }))
                      }
                    />
                    <EpistemicNumberField
                      label="ระยะเวลาสำรองไฟที่ต้องการ"
                      unit="ชั่วโมง"
                      field={draft.batteryModule.requiredBackupHours}
                      disabled={readOnly}
                      onChange={(next) =>
                        mutateTechnical((p) => ({
                          ...p,
                          batteryModule: { ...p.batteryModule, requiredBackupHours: next },
                        }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block font-medium mb-1">
                        ตำแหน่งติดตั้งและระยะห่างตามคู่มือผู้ผลิต (Clearances)
                      </label>
                      <textarea
                        rows={2}
                        disabled={readOnly}
                        value={draft.batteryModule.clearancePerManufacturerNote}
                        onChange={(e) =>
                          mutateTechnical((p) => ({
                            ...p,
                            batteryModule: {
                              ...p.batteryModule,
                              clearancePerManufacturerNote: e.target.value,
                            },
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">
                        อัคคีภัย ทางหนีไฟ การแยกพื้นที่ และเหตุฉุกเฉิน
                      </label>
                      <textarea
                        rows={2}
                        disabled={readOnly}
                        value={draft.batteryModule.fireSafetyAndEgressNotes}
                        onChange={(e) =>
                          mutateTechnical((p) => ({
                            ...p,
                            batteryModule: {
                              ...p.batteryModule,
                              fireSafetyAndEgressNotes: e.target.value,
                            },
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP F: XOLARAIZ INSTALLATION EXCELLENCE */}
          {activeStep === 'excellence' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  F. XOLARAIZ Installation Excellence Checklist
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  แยก “เป้าหมายงานออกแบบ (Design Target)” ออกจาก “ผลตรวจหลังติดตั้ง (Post-Install)” —
                  งานที่ยังไม่ได้ติดตั้งต้องคงสถานะ Not Assessed เสมอ และความสวยงามห้ามลดทอนระยะปลอดภัยหรือการระบายอากาศ
                </p>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {draft.excellenceChecklist.map((item, idx) => (
                  <div key={item.id} className="py-4 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-medium text-slate-500">{item.category}</div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {item.title}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          disabled={readOnly}
                          value={item.designTargetStatus}
                          onChange={(e) =>
                            mutateTechnical((p) => ({
                              ...p,
                              excellenceChecklist: p.excellenceChecklist.map((c, i) =>
                                i === idx
                                  ? {
                                      ...c,
                                      designTargetStatus: e.target
                                        .value as typeof c.designTargetStatus,
                                    }
                                  : c
                              ),
                            }))
                          }
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                        >
                          <option value="Target Defined">เป้าหมายออกแบบ: กำหนดแล้ว</option>
                          <option value="Needs Adjustment">ต้องปรับแนวหน้างาน</option>
                          <option value="Not Applicable">ไม่เกี่ยวข้อง</option>
                        </select>
                        <span className="text-[11px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          หลังติดตั้ง: {item.postInstallStatus}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-amber-800 dark:text-amber-300">
                      กฎความปลอดภัยบังคับ: {item.safetyPriorityRule}
                    </div>
                    <input
                      type="text"
                      disabled={readOnly}
                      value={item.designNote}
                      onChange={(e) =>
                        mutateTechnical((p) => ({
                          ...p,
                          excellenceChecklist: p.excellenceChecklist.map((c, i) =>
                            i === idx ? { ...c, designNote: e.target.value } : c
                          ),
                        }))
                      }
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP G: EVIDENCE & MARKUP */}
          {activeStep === 'evidence' && (
            <EvidenceMarkupSection
              project={draft}
              readOnly={readOnly}
              onUpdate={(nextFiles, detail) =>
                mutateTechnical(
                  (p) => ({ ...p, evidenceFiles: nextFiles }),
                  'อัปเดตหลักฐานและภาพถ่าย',
                  detail
                )
              }
            />
          )}

          {/* STEP H: CALCULATOR */}
          {activeStep === 'calculator' && (
            <CalculatorSection
              projectType={draft.projectType}
              value={draft.calculation}
              readOnly={readOnly}
              onChange={(nextCalc) =>
                mutateTechnical((p) => ({ ...p, calculation: nextCalc }))
              }
            />
          )}

          {/* STEP I: RISK REGISTER */}
          {activeStep === 'risks' && (
            <RiskRegisterSection
              project={draft}
              activeRole={activeRole}
              onUpdate={(nextHazards, detail) =>
                mutateTechnical(
                  (p) => ({ ...p, hazards: nextHazards }),
                  'อัปเดต Risk Register',
                  detail
                )
              }
            />
          )}

          {/* STEP J: REVIEW & AI */}
          {activeStep === 'review' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  สรุปบันทึกหน้างานและข้อจำกัดจากผู้สำรวจ (Surveyor Summary &amp; Unknowns)
                </h3>
                <textarea
                  rows={3}
                  disabled={readOnly}
                  value={draft.surveyorSummaryNote}
                  onChange={(e) =>
                    mutateTechnical((p) => ({ ...p, surveyorSummaryNote: e.target.value }))
                  }
                  placeholder="สรุปภาพรวมความพร้อมหน้างานสำหรับทีมวิศวกรรม..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
                <textarea
                  rows={2}
                  disabled={readOnly}
                  value={draft.limitationsAndUnknowns}
                  onChange={(e) =>
                    mutateTechnical((p) => ({ ...p, limitationsAndUnknowns: e.target.value }))
                  }
                  placeholder="ระบุข้อมูลที่ยังไม่ทราบและข้อจำกัดการสำรวจ..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <ReviewAndAiSection
                project={draft}
                standards={standards}
                activeRole={activeRole}
                onStatusTransition={(nextStatus: WorkflowStatus, note: string) => {
                  const updated: SolarSurveyProject = {
                    ...draft,
                    status: nextStatus,
                    auditLog: [
                      {
                        id: `aud-${Date.now()}`,
                        timestamp: new Date().toISOString(),
                        actorName: activeRole,
                        actorRole: activeRole,
                        action: 'เปลี่ยนสถานะ Workflow',
                        detail: note,
                        revisionNumber: draft.revisionNumber,
                      },
                      ...draft.auditLog,
                    ],
                  };
                  scheduleAutosave(updated);
                }}
                onSubmitReview={(review: EngineeringReviewRecord, nextStatus: WorkflowStatus) => {
                  const updated: SolarSurveyProject = {
                    ...draft,
                    status: nextStatus,
                    reviews: [review, ...draft.reviews],
                    auditLog: [
                      {
                        id: `aud-${Date.now()}`,
                        timestamp: new Date().toISOString(),
                        actorName: review.reviewerName,
                        actorRole: activeRole,
                        action: 'บันทึกผล Engineering Review',
                        detail: `${review.readinessStatus} (${review.decision}): ${review.comments}`,
                        revisionNumber: draft.revisionNumber,
                      },
                      ...draft.auditLog,
                    ],
                  };
                  scheduleAutosave(updated);
                }}
              />
            </div>
          )}

          {/* STEP K: REPORT */}
          {activeStep === 'report' && (
            <SurveyReportView
              project={draft}
              franchise={franchise}
              standards={standards}
              activeRole={activeRole}
            />
          )}
        </div>
      </div>
    </div>
  );
};
