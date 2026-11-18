import {
  HazardItem,
  RiskLevel,
  RiskLikelihood,
  RiskSeverity,
  SolarSurveyProject,
} from '../types/survey';

export function computeRiskLevel(severity: RiskSeverity, likelihood: RiskLikelihood): RiskLevel {
  const score = severity * likelihood;
  if (severity >= 5 || score >= 15) return 'Critical';
  if (score >= 9 || severity >= 4) return 'High';
  if (score >= 4) return 'Medium';
  return 'Low';
}

export function getCriticalRiskStatus(project: SolarSurveyProject): {
  hasBlockingCriticalRisk: boolean;
  blockingReasons: string[];
  openHazardsCount: number;
} {
  const blockingReasons: string[] = [];

  for (const gate of project.safetyGate) {
    if (gate.isCriticalHazard && gate.state === 'unsafe_to_inspect') {
      blockingReasons.push(`Safety Gate: ${gate.title} — สถานะ "ไม่ปลอดภัยที่จะตรวจ"`);
    }
    if (gate.isCriticalHazard && gate.state === 'not_checked') {
      blockingReasons.push(`Safety Gate: ${gate.title} — ยังไม่ได้ประเมินก่อนเข้าพื้นที่`);
    }
  }

  for (const h of project.hazards) {
    if (h.riskLevel === 'Critical' && h.status !== 'Verified Closed') {
      blockingReasons.push(`Risk Register: ${h.title} (${h.status})`);
    }
  }

  const openHazardsCount = project.hazards.filter((h) => h.status !== 'Verified Closed').length;

  return {
    hasBlockingCriticalRisk: blockingReasons.length > 0,
    blockingReasons,
    openHazardsCount,
  };
}

export function analyzeSurveyCompleteness(project: SolarSurveyProject): {
  completionPct: number;
  missingItems: string[];
  unknownItems: string[];
  unsafeSkippedItems: string[];
} {
  const missingItems: string[] = [];
  const unknownItems: string[] = [];
  const unsafeSkippedItems: string[] = [];

  let totalChecks = 10;
  let completedChecks = 0;

  if (project.site.customerName && project.site.address && project.site.pdpaConsentRecorded) {
    completedChecks++;
  } else {
    if (!project.site.customerName || !project.site.address) missingItems.push('ข้อมูลลูกค้าและที่อยู่โครงการ');
    if (!project.site.pdpaConsentRecorded) missingItems.push('บันทึกความยินยอม PDPA ก่อนเก็บข้อมูลหน้างาน');
  }

  if (project.safetyGate.every((g) => g.state !== 'not_checked')) {
    completedChecks++;
  } else {
    missingItems.push('รายการ Safety Gate ก่อนเริ่มสำรวจยังมีข้อที่ยังไม่ประเมิน');
  }

  if (project.electricalLoad.bills.length > 0 || project.electricalLoad.loadProfile.rowCount > 0) {
    completedChecks++;
  } else {
    missingItems.push('ข้อมูลบิลค่าไฟหรือ Load Profile');
  }

  if (project.roofZones.length > 0) {
    completedChecks++;
  } else {
    missingItems.push('ข้อมูลโซนหลังคาอย่างน้อย 1 โซน');
  }

  const structuralPending = project.roofZones.some(
    (z) => z.structuralEngineerStatus === 'ยังไม่ประเมิน'
  );
  if (!structuralPending && project.roofZones.length > 0) {
    completedChecks++;
  } else if (project.roofZones.length > 0) {
    unknownItems.push('สถานะการประเมินกำลังรับน้ำหนักโดยวิศวกรโครงสร้าง (ยังไม่ประเมิน)');
  }

  if (project.electricalConnection.phaseSystem !== 'Unknown') {
    completedChecks++;
  } else {
    unknownItems.push('ระบบไฟฟ้า (1 เฟส / 3 เฟส) และแรงดันที่ยืนยัน');
  }

  if (project.electricalConnection.confirmedVoltage.status === 'known') {
    completedChecks++;
  } else if (
    project.electricalConnection.confirmedVoltage.status === 'unsafe_to_inspect' ||
    project.electricalConnection.confirmedVoltage.status === 'requires_qualified_person'
  ) {
    unsafeSkippedItems.push('การตรวจวัดแรงดัน/เปิดตู้ MDB (รอผู้มีคุณสมบัติหรือยังไม่ปลอดภัย)');
  } else {
    unknownItems.push('แรงดันไฟฟ้าจริงและพิกัด Main Breaker / Busbar');
  }

  if (project.evidenceFiles.length >= 2) {
    completedChecks++;
  } else {
    missingItems.push('ภาพถ่ายหรือหลักฐานประกอบหน้างาน (อย่างน้อย 2 รายการ)');
  }

  if (project.calculation.panelCount > 0 && project.calculation.panelWp > 0) {
    completedChecks++;
  } else {
    missingItems.push('ค่าประมาณการขนาดระบบเบื้องต้น (จำนวนแผงและ Wp)');
  }

  if (project.topology === 'Hybrid' || project.topology === 'On-grid + BESS Ready') {
    totalChecks++;
    if (project.batteryModule.applicable && project.batteryModule.backupObjective) {
      completedChecks++;
    } else {
      missingItems.push('โมดูลสำรวจ Battery / Hybrid (วัตถุประสงค์และโหลดสำรอง)');
    }
  }

  if (project.reviews.length > 0 && project.reviews[0].decision !== 'Pending') {
    completedChecks++;
  } else {
    unknownItems.push('รอการตรวจทานจากวิศวกรไฟฟ้า (Electrical Engineer)');
  }

  // Check unsafe items in safety gate
  for (const gate of project.safetyGate) {
    if (
      gate.state === 'unsafe_to_inspect' ||
      gate.state === 'requires_qualified_person'
    ) {
      unsafeSkippedItems.push(`${gate.title} (${gate.state === 'unsafe_to_inspect' ? 'ไม่ปลอดภัยที่จะตรวจ' : 'ต้องใช้ผู้มีคุณสมบัติ'})`);
    }
  }

  const completionPct = Math.round((completedChecks / totalChecks) * 100);
  return {
    completionPct,
    missingItems,
    unknownItems,
    unsafeSkippedItems,
  };
}

export function getHazardBadgeStyle(level: RiskLevel): {
  bg: string;
  text: string;
  border: string;
  labelTh: string;
} {
  switch (level) {
    case 'Critical':
      return {
        bg: 'bg-red-50 dark:bg-red-950/50',
        text: 'text-red-700 dark:text-red-300',
        border: 'border-red-200 dark:border-red-800',
        labelTh: 'วิกฤต (Critical — หยุดงาน)',
      };
    case 'High':
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/50',
        text: 'text-amber-800 dark:text-amber-300',
        border: 'border-amber-200 dark:border-amber-800',
        labelTh: 'สูง (High)',
      };
    case 'Medium':
      return {
        bg: 'bg-sky-50 dark:bg-sky-950/50',
        text: 'text-sky-800 dark:text-sky-300',
        border: 'border-sky-200 dark:border-sky-800',
        labelTh: 'ปานกลาง (Medium)',
      };
    case 'Low':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/50',
        text: 'text-emerald-800 dark:text-emerald-300',
        border: 'border-emerald-200 dark:border-emerald-800',
        labelTh: 'ต่ำ (Low)',
      };
  }
}

export function createBlankHazard(projectId: string): HazardItem {
  return {
    id: `haz-${Date.now()}`,
    projectId,
    title: '',
    category: 'Roof/Height',
    severity: 3,
    likelihood: 3,
    riskLevel: 'Medium',
    evidenceNote: '',
    evidenceIds: [],
    correctiveAction: '',
    owner: '',
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    status: 'Open',
  };
}
