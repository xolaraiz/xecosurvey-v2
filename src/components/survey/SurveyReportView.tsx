import React, { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import {
  Franchise,
  SolarSurveyProject,
  StandardReference,
  UserRole,
} from '../../types/survey';
import { computeSolarCalculation } from '../../lib/calculations';
import { analyzeSurveyCompleteness, getCriticalRiskStatus } from '../../lib/safety';
import { getRolePermissions } from '../../lib/rbac';
import { formatEpistemicValue } from '../EpistemicField';
import { BrandEmblem } from '../BrandEmblem';

interface SurveyReportViewProps {
  project: SolarSurveyProject;
  franchise?: Franchise;
  standards: StandardReference[];
  activeRole: UserRole;
}

export const SurveyReportView: React.FC<SurveyReportViewProps> = ({
  project,
  franchise,
  standards,
  activeRole,
}) => {
  const perms = getRolePermissions(activeRole);
  const [reportMode, setReportMode] = useState<'technical' | 'customer'>(
    perms.canViewTechnicalReport ? 'technical' : 'customer'
  );

  const calc = useMemo(
    () => computeSolarCalculation(project.calculation, project.projectType),
    [project.calculation, project.projectType]
  );
  const completeness = useMemo(() => analyzeSurveyCompleteness(project), [project]);
  const riskStatus = useMemo(() => getCriticalRiskStatus(project), [project]);
  const latestReview = project.reviews[0];

  // Determine honest readiness badge (NEVER uses "ผ่านมาตรฐาน" just because fields are filled)
  const readinessStatus = latestReview?.readinessStatus ?? (riskStatus.hasBlockingCriticalRisk ? 'ยังไม่พร้อม' : 'มีเงื่อนไข');

  const baseScenario = calc.scenarios[1];

  return (
    <div className="space-y-6">
      {/* Control Toolbar (hidden when printing) */}
      <div className="no-print rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
          {perms.canViewTechnicalReport && (
            <button
              type="button"
              onClick={() => setReportMode('technical')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                reportMode === 'technical'
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              1. Technical Survey Report (วิศวกรรม)
            </button>
          )}
          <button
            type="button"
            onClick={() => setReportMode('customer')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              reportMode === 'customer'
                ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            2. Customer Summary (นำเสนอลูกค้า)
          </button>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 min-h-[40px]"
        >
          <Printer className="w-4 h-4" />
          พิมพ์ / ส่งออกเป็น PDF (รองรับฟอนต์ไทย)
        </button>
      </div>

      {/* Printable Report Surface */}
      <article className="print-full-width rounded-xl border border-slate-200 dark:border-slate-800 bg-white text-slate-900 p-8 sm:p-10 space-y-8 shadow-sm">
        {/* Brand Cover Header */}
        <header className="border-b-2 border-slate-900 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <BrandEmblem variant="xolaraiz" className="w-12 h-12" />
              <BrandEmblem variant="xeco" className="w-12 h-12" />
              <BrandEmblem variant="crixiszafe" className="w-12 h-12" />
            </div>
            <div className="text-xs font-semibold text-amber-700 tracking-wide">
              XOLARAIZ™ SOLAR SITE SURVEY PRO · XECO SOLAR · CRIXISZAFE™
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              {reportMode === 'technical'
                ? 'รายงานผลการสำรวจหน้างานทางเทคนิค (Technical Site Survey Report)'
                : 'สรุปผลการสำรวจและข้อเสนอเบื้องต้นสำหรับลูกค้า (Customer Survey Summary)'}
            </h1>
            <p className="text-xs text-slate-600">
              “Excellent &amp; Economical Smart Solar Solutions — คุ้มค่า ประหยัด ปลอดภัย ได้มาตรฐาน บริการดี คัดสรรเทคโนโลยีเพื่อคุณ”
            </p>
          </div>

          <div className="text-xs space-y-1 tabular-nums sm:text-right shrink-0">
            <div className="font-mono font-bold text-sm text-slate-900">{project.projectCode}</div>
            <div>สาขา: {franchise?.name ?? project.franchiseId}</div>
            <div>ประเภท: {project.projectType} · {project.topology}</div>
            <div>Revision: {project.revisionNumber} · วันที่อัปเดต: {project.updatedAt.slice(0, 10)}</div>
            <div className="pt-1">
              <span className="inline-block px-2.5 py-1 rounded border border-slate-900 font-bold text-slate-900">
                สถานะรายงาน: {readinessStatus}
              </span>
            </div>
            {project.isDemoData && (
              <div className="text-amber-700 font-semibold">
                [เอกสารข้อมูลสมมติสำหรับสาธิตระบบ]
              </div>
            )}
          </div>
        </header>

        {/* Disclaimer Banner */}
        <section className="p-4 rounded-lg border border-slate-300 bg-slate-50 text-xs text-slate-700 space-y-1">
          <div>
            <strong>ขอบเขตเอกสาร:</strong> เอกสารนี้จัดทำจากผลการสำรวจหน้างานเบื้องต้นเพื่อให้วิศวกรตรวจสอบก่อนการออกแบบจริง
            ไม่ใช่หนังสือรับรองการออกแบบวิศวกรรม ไม่ใช่ใบรับรองความปลอดภัย และไม่ใช่ลายมือชื่อดิจิทัลที่มีผลผูกพันทางกฎหมายโดยอัตโนมัติ
          </div>
          <div>
            <strong>ข้อกำหนดมาตรฐาน:</strong> การตอบรายการสำรวจครบถ้วนไม่ได้หมายความว่าโครงการ “ผ่านมาตรฐาน” โดยอัตโนมัติ
            ต้องรอการออกแบบและคำนวณโดยวิศวกรผู้มีใบอนุญาตประกอบวิชาชีพตามกฎหมายไทย
          </div>
        </section>

        {/* 1. Executive Summary & Project Info */}
        <section className="space-y-3 print-avoid-break">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
            1. ข้อมูลโครงการและสรุปผู้บริหาร (Executive Summary)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div><strong>ลูกค้า / โครงการ:</strong> {project.site.customerName}</div>
            <div><strong>ผู้ติดต่อ:</strong> {project.site.contactPerson}</div>
            <div><strong>ที่ตั้งโครงการ:</strong> {project.site.address} จ.{project.site.province}</div>
            <div><strong>เขตการไฟฟ้า:</strong> {project.site.utilityProvider}</div>
            <div><strong>ลักษณะอาคาร:</strong> {project.site.buildingType}</div>
            <div><strong>เป้าหมายลูกค้า:</strong> {project.site.customerGoals.join(', ')}</div>
            <div><strong>ผู้สำรวจ:</strong> {project.assignedSurveyor}</div>
            <div><strong>วิศวกรตรวจทาน:</strong> {project.assignedEngineer}</div>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs leading-relaxed">
            <strong>สรุปบันทึกหน้างาน:</strong> {project.surveyorSummaryNote || 'ยังไม่มีบันทึกสรุปจากผู้สำรวจ'}
          </div>
        </section>

        {/* 2. Roof, Electrical & CriXisZafe Readiness */}
        <section className="space-y-3 print-avoid-break">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
            2. ความพร้อมด้านหลังคา ระบบไฟฟ้า และความปลอดภัย CriXisZafe™
          </h2>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-800">2.1 พื้นที่หลังคาที่สำรวจ ({project.roofZones.length} โซน)</h3>
            {project.roofZones.length === 0 ? (
              <p className="text-xs text-slate-500">ยังไม่ได้บันทึกข้อมูลโซนหลังคา</p>
            ) : (
              <table className="w-full text-xs border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="p-2 border border-slate-200">โซนหลังคา</th>
                    <th className="p-2 border border-slate-200">วัสดุ / ทิศ</th>
                    <th className="p-2 border border-slate-200">พื้นที่ใช้งานได้</th>
                    <th className="p-2 border border-slate-200">สถานะวิศวกรโครงสร้าง</th>
                    <th className="p-2 border border-slate-200">ข้อสังเกต</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {project.roofZones.map((rz) => (
                    <tr key={rz.id}>
                      <td className="p-2 border border-slate-200 font-medium">{rz.name}</td>
                      <td className="p-2 border border-slate-200">{rz.material} · {rz.azimuthDirection}</td>
                      <td className="p-2 border border-slate-200">{formatEpistemicValue(rz.usableAreaSqm, 'ตร.ม.')}</td>
                      <td className="p-2 border border-slate-200">{rz.structuralEngineerStatus}</td>
                      <td className="p-2 border border-slate-200">{rz.conditionFindings || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
            <div className="p-3.5 rounded-lg border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900">2.2 ระบบไฟฟ้าและจุดเชื่อมต่อ</div>
              <div><strong>ระบบเฟส:</strong> {project.electricalConnection.phaseSystem}</div>
              <div><strong>แรงดันที่ยืนยัน:</strong> {formatEpistemicValue(project.electricalConnection.confirmedVoltage)}</div>
              <div><strong>Main Breaker:</strong> {formatEpistemicValue(project.electricalConnection.mainBreakerRatingA, 'A')}</div>
              <div><strong>จุดเชื่อมต่อที่เสนอ:</strong> {project.electricalConnection.proposedPoc || 'รอประเมิน'}</div>
              <div><strong>สายดิน &amp; Bonding:</strong> {formatEpistemicValue(project.electricalConnection.groundingAndBondingStatus)}</div>
              <div><strong>Anti-islanding / Export:</strong> {project.electricalConnection.antiIslandingAndExportLimitationNotes || '-'}</div>
            </div>

            <div className="p-3.5 rounded-lg border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900">2.3 CriXisZafe™ ความทนทานและเหตุฉุกเฉิน</div>
              <div><strong>ความเสี่ยงน้ำท่วม:</strong> {project.electricalConnection.environmentHazards.floodRiskLevel || 'รอประเมิน'}</div>
              <div><strong>ตำแหน่ง Inverter/Isolator:</strong> {project.electricalConnection.inverterAndIsolatorPlacement || '-'}</div>
              <div><strong>ระบบสำรองไฟ / Battery:</strong> {project.batteryModule.applicable ? project.batteryModule.backupObjective : 'ระบบ On-grid ทั่วไป (ไม่สำรองไฟขณะการไฟฟ้าดับ)'}</div>
              <div><strong>หมายเหตุอัคคีภัย &amp; กู้ภัย:</strong> {project.batteryModule.applicable ? project.batteryModule.fireSafetyAndEgressNotes : 'กำหนดป้ายเตือน PV และจุดตัดตอนที่เข้าถึงได้'}</div>
            </div>
          </div>
        </section>

        {/* 3. Risks & Unknowns */}
        <section className="space-y-3 print-avoid-break">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
            3. ความเสี่ยง รายการต้องแก้ไข ข้อมูลที่ยังไม่ทราบ และข้อจำกัดการสำรวจ
          </h2>

          {project.hazards.length > 0 && (
            <table className="w-full text-xs border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-2 border border-slate-200">ความเสี่ยง</th>
                  <th className="p-2 border border-slate-200">ระดับ</th>
                  <th className="p-2 border border-slate-200">มาตรการแก้ไข</th>
                  <th className="p-2 border border-slate-200">ผู้รับผิดชอบ / สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {project.hazards.map((h) => (
                  <tr key={h.id}>
                    <td className="p-2 border border-slate-200 font-medium">{h.title}</td>
                    <td className="p-2 border border-slate-200 font-bold">{h.riskLevel}</td>
                    <td className="p-2 border border-slate-200">{h.correctiveAction || '-'}</td>
                    <td className="p-2 border border-slate-200">{h.owner} · {h.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="p-3.5 rounded-lg border border-amber-300 bg-amber-50 text-xs space-y-1">
            <div><strong>ข้อจำกัดและข้อมูลที่ยังไม่ทราบหน้างาน:</strong> {project.limitationsAndUnknowns || '-'}</div>
            {completeness.unknownItems.length > 0 && (
              <div><strong>รายการรอข้อมูลเพิ่ม:</strong> {completeness.unknownItems.join(' · ')}</div>
            )}
            {completeness.unsafeSkippedItems.length > 0 && (
              <div><strong>กิจกรรมที่งดตรวจเพื่อความปลอดภัย:</strong> {completeness.unsafeSkippedItems.join(' · ')}</div>
            )}
          </div>
        </section>

        {/* 4. Preliminary Sizing & Financial Assumptions */}
        <section className="space-y-3 print-avoid-break">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
            4. ข้อเสนอระบบเบื้องต้นและสมมติฐานการประเมินความคุ้มค่า
          </h2>
          <p className="text-xs font-semibold text-amber-800">
            ประมาณการเบื้องต้น ไม่ใช่การรับประกันผลผลิต ผลประหยัด หรือแบบวิศวกรรมที่รับรองแล้ว
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs tabular-nums">
            <div className="p-3 rounded border border-slate-200">
              <div className="text-slate-500">กำลังติดตั้ง DC</div>
              <div className="text-sm font-bold">{calc.installedDcKwp.toFixed(2)} kWp</div>
              <div className="text-[11px] text-slate-500">{project.calculation.panelCount} แผง × {project.calculation.panelWp} Wp</div>
            </div>
            <div className="p-3 rounded border border-slate-200">
              <div className="text-slate-500">พิกัด Inverter AC</div>
              <div className="text-sm font-bold">{calc.inverterAcKw.toFixed(1)} kW</div>
            </div>
            <div className="p-3 rounded border border-slate-200">
              <div className="text-slate-500">พลังงานใช้เอง (Base Case)</div>
              <div className="text-sm font-bold">{Math.round(baseScenario.selfConsumedKwh).toLocaleString()} kWh/ปี</div>
            </div>
            <div className="p-3 rounded border border-slate-200">
              <div className="text-slate-500">Simple Payback (Base)</div>
              <div className="text-sm font-bold">
                {baseScenario.simplePaybackYears !== null
                  ? `${baseScenario.simplePaybackYears.toFixed(1)} ปี`
                  : `งดแสดง (${baseScenario.paybackSuppressedReason})`}
              </div>
            </div>
          </div>
          <div className="text-[11px] text-slate-600 space-y-0.5">
            <div>สมมติฐาน Yield: {project.calculation.specificYieldKwhPerKwpYear} kWh/kWp/yr ({project.calculation.yieldSourceNote})</div>
            <div>
              Loss Cascade (ไม่หักซ้ำ): {calc.totalDeratePct.toFixed(1)}% · Self-consumption {project.calculation.selfConsumptionPct}% ·
              ส่งออก {project.calculation.exportAllowed ? `${project.calculation.exportTariffThbPerKwh} บาท/kWh` : 'ไม่คิดรายได้ขายไฟ (0 บาท/kWh)'}
            </div>
          </div>
        </section>

        {/* 5. Installation Excellence & Evidence (Technical or Summary) */}
        <section className="space-y-3 print-break-before">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
            5. แนวทางติดตั้ง XOLARAIZ Installation Excellence และภาพหลักฐาน ({project.evidenceFiles.length} รายการ)
          </h2>
          <p className="text-xs text-slate-600">
            หมายเหตุ: รายการตรวจหลังติดตั้งถูกตั้งเป็น “Not Assessed” ในช่วงก่อนติดตั้ง — ความสวยงามต้องไม่ลดทอนระยะปลอดภัย การระบายอากาศ หรือทางซ่อมบำรุง
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {project.evidenceFiles.map((ev) => (
              <div key={ev.id} className="p-3 rounded-lg border border-slate-200 space-y-2 print-avoid-break">
                <div className="text-xs font-bold text-slate-900">{ev.title}</div>
                <div className="text-[11px] text-slate-500">
                  {ev.category} {ev.isNotToScaleSketch ? '· ไม่ใช่แบบตามมาตราส่วน' : ''}
                </div>
                {ev.unableToCaptureSafely ? (
                  <div className="p-2 bg-red-50 border border-red-200 text-xs text-red-700 rounded">
                    งดถ่ายภาพเพื่อความปลอดภัย: {ev.unsafeReason}
                  </div>
                ) : (
                  ev.originalDataUrl &&
                  ev.fileType !== 'pdf' && (
                    <img
                      src={ev.originalDataUrl}
                      alt={ev.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-40 object-cover rounded border border-slate-200"
                    />
                  )
                )}
                <div className="text-[11px] text-slate-600">{ev.caption}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 6. Standards & Reviewer Sign-off Record */}
        {reportMode === 'technical' && (
          <section className="space-y-3 print-avoid-break">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
              6. มาตรฐานอ้างอิงและบันทึกการตรวจทาน
            </h2>
            <ul className="text-xs text-slate-700 space-y-1 list-disc pl-5">
              {standards.map((s) => (
                <li key={s.id}>
                  <strong>[{s.category}]</strong> {s.documentName} ({s.editionOrYear}) — ตรวจโดย {s.reviewerName}
                </li>
              ))}
            </ul>
            <div className="p-3.5 rounded-lg border border-slate-200 text-xs space-y-1">
              <div><strong>สถานะการตรวจทานล่าสุด:</strong> {latestReview ? `${latestReview.readinessStatus} โดย ${latestReview.reviewerName} (${latestReview.reviewedAt.slice(0, 10)})` : 'ยังรอวิศวกรไฟฟ้าตรวจทาน'}</div>
              <div><strong>ขอบเขตการตรวจทาน:</strong> {latestReview?.scopeOfReview ?? 'สำรวจเบื้องต้นก่อนออกแบบ'}</div>
              <div><strong>ความเห็นวิศวกร:</strong> {latestReview?.comments ?? '-'}</div>
            </div>
          </section>
        )}
      </article>
    </div>
  );
};
