import { CalculationScenarioInput, LoadProfileSummary } from '../types/survey';

export interface ScenarioResult {
  name: 'Low Case (อนุรักษ์นิยม)' | 'Base Case (กรณีฐาน)' | 'High Case (สภาวะเหมาะสม)';
  effectiveSpecificYieldKwhPerKwp: number;
  grossAnnualKwh: number;
  netAnnualKwh: number;
  selfConsumedKwh: number;
  exportedKwh: number;
  curtailedKwh: number;
  grossAnnualSavingsThb: number;
  netAnnualSavingsThb: number;
  simplePaybackYears: number | null;
  paybackSuppressedReason?: string;
}

export interface CalculationOutput {
  installedDcKwp: number;
  inverterAcKw: number;
  dcAcRatio: number | null;
  combinedLossFactor: number;
  totalDeratePct: number;
  scenarios: ScenarioResult[];
  warnings: string[];
}

export function computeSolarCalculation(
  input: CalculationScenarioInput,
  projectType: 'Residential' | 'C&I'
): CalculationOutput {
  const installedDcKwp = (Math.max(0, input.panelCount) * Math.max(0, input.panelWp)) / 1000;
  const inverterAcKw = Math.max(0, input.inverterAcKw);
  const dcAcRatio = inverterAcKw > 0 ? installedDcKwp / inverterAcKw : null;

  // Multiplicative cascade avoids double-counting losses across independent stages
  const fSoilingTemp = 1 - clampPct(input.soilingAndTempLossPct) / 100;
  const fInvCable = 1 - clampPct(input.inverterAndCableLossPct) / 100;
  const fShading = 1 - clampPct(input.shadingLossPct) / 100;
  const combinedLossFactor = fSoilingTemp * fInvCable * fShading;
  const totalDeratePct = (1 - combinedLossFactor) * 100;

  const warnings: string[] = [];
  if (installedDcKwp <= 0) {
    warnings.push('ยังไม่ได้ระบุจำนวนแผงหรือกำลังวัตต์ต่อแผง (Wp)');
  }
  if (input.specificYieldKwhPerKwpYear <= 0) {
    warnings.push('ยังไม่ได้ระบุค่า Specific Yield อ้างอิง');
  }
  if (!input.dataCompleteForPayback) {
    warnings.push('ข้อมูลบิลค่าไฟหรือสภาพหน้างานยังไม่ครบถ้วน — ระบบงดแสดงตัวเลขคืนทุนที่อาจทำให้เข้าใจผิด');
  }
  if (projectType === 'C&I') {
    warnings.push(
      'หมายเหตุ C&I: การประเมินจากพลังงานรายปี (kWh) ไม่สามารถนำมาสรุปการลดค่า Demand Charge (kW) ได้โดยลำพัง ต้องวิเคราะห์ Load Profile ราย 15 นาที'
    );
  }
  if (input.exportAllowed && input.exportTariffThbPerKwh > 0) {
    warnings.push(
      'มีการคำนวณรายได้จากการส่งออกไฟ (Export) — ต้องตรวจสอบสัญญา/โครงการรับซื้อไฟฟ้าที่ใช้บังคับจริงก่อนสรุป'
    );
  }

  const multipliers: Array<{
    name: ScenarioResult['name'];
    yieldFactor: number;
    rateFactor: number;
  }> = [
    { name: 'Low Case (อนุรักษ์นิยม)', yieldFactor: 0.9, rateFactor: 0.95 },
    { name: 'Base Case (กรณีฐาน)', yieldFactor: 1.0, rateFactor: 1.0 },
    { name: 'High Case (สภาวะเหมาะสม)', yieldFactor: 1.06, rateFactor: 1.05 },
  ];

  const scenarios: ScenarioResult[] = multipliers.map((m) => {
    const effectiveSpecificYield = Math.max(0, input.specificYieldKwhPerKwpYear) * m.yieldFactor;
    const grossAnnualKwh = installedDcKwp * effectiveSpecificYield;
    const postLossKwh = grossAnnualKwh * combinedLossFactor;

    const curtailFactor = clampPct(input.curtailmentPct) / 100;
    const curtailedKwh = postLossKwh * curtailFactor;
    const deliverableKwh = Math.max(0, postLossKwh - curtailedKwh);

    const selfShare = clampPct(input.selfConsumptionPct) / 100;
    const selfConsumedKwh = deliverableKwh * selfShare;
    const rawExcessKwh = deliverableKwh - selfConsumedKwh;
    const exportedKwh = input.exportAllowed ? rawExcessKwh : 0;
    const uncompensatedExcessKwh = input.exportAllowed ? 0 : rawExcessKwh;

    const selfRate = Math.max(0, input.blendedElectricityRateThbPerKwh) * m.rateFactor;
    const exportRate = input.exportAllowed ? Math.max(0, input.exportTariffThbPerKwh) : 0;

    const grossAnnualSavingsThb =
      selfConsumedKwh * selfRate + exportedKwh * exportRate;
    const netAnnualSavingsThb = grossAnnualSavingsThb - Math.max(0, input.annualOpexThb);

    let simplePaybackYears: number | null = null;
    let paybackSuppressedReason: string | undefined;

    if (!input.dataCompleteForPayback || installedDcKwp <= 0 || input.capexThb <= 0) {
      paybackSuppressedReason = 'รอข้อมูลให้ครบถ้วน';
    } else if (netAnnualSavingsThb <= 0) {
      paybackSuppressedReason = 'ผลประหยัดสุทธิไม่เป็นบวกหลังหัก OPEX';
    } else {
      simplePaybackYears = input.capexThb / netAnnualSavingsThb;
    }

    return {
      name: m.name,
      effectiveSpecificYieldKwhPerKwp: effectiveSpecificYield,
      grossAnnualKwh,
      netAnnualKwh: selfConsumedKwh + exportedKwh,
      selfConsumedKwh,
      exportedKwh,
      curtailedKwh: curtailedKwh + uncompensatedExcessKwh,
      grossAnnualSavingsThb,
      netAnnualSavingsThb,
      simplePaybackYears,
      paybackSuppressedReason,
    };
  });

  return {
    installedDcKwp,
    inverterAcKw,
    dcAcRatio,
    combinedLossFactor,
    totalDeratePct,
    scenarios,
    warnings,
  };
}

function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, v));
}

export function parseLoadProfileCsv(
  csvText: string,
  fileName: string,
  timezone: string,
  unitVerified: 'kW' | 'kWh' | 'Unknown'
): LoadProfileSummary {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const warnings: string[] = [];
  if (lines.length < 2) {
    return {
      importedFileName: fileName,
      timezone,
      rowCount: 0,
      missingIntervalsCount: 0,
      unitVerified,
      daytimeSharePct: { status: 'unknown', value: null },
      daytimeShareBasis: 'Unknown',
      peakDemandKw: { status: 'unknown', value: null },
      avgDaytimeKw: { status: 'unknown', value: null },
      warnings: ['ไฟล์ CSV ไม่มีข้อมูลหรือมีเพียงหัวตาราง'],
    };
  }

  if (unitVerified === 'Unknown') {
    warnings.push('ยังไม่ได้ยืนยันหน่วย (kW vs kWh) ของไฟล์ Load Profile');
  }

  let validRows = 0;
  let missingIntervalsCount = 0;
  let totalEnergyOrPower = 0;
  let daytimeEnergyOrPower = 0;
  let daytimeCount = 0;
  let peakVal = 0;

  // Skip header if first row contains letters in value column
  const startIdx = /[a-zA-Zก-๙]/.test(lines[0].split(',')[1] ?? '') ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    if (cols.length < 2) {
      missingIntervalsCount++;
      continue;
    }
    const tsRaw = cols[0];
    const valRaw = Number(cols[1]);
    if (!tsRaw || !Number.isFinite(valRaw) || valRaw < 0) {
      missingIntervalsCount++;
      continue;
    }

    validRows++;
    totalEnergyOrPower += valRaw;
    if (valRaw > peakVal) peakVal = valRaw;

    // Extract hour from ISO or HH:mm timestamp
    const hourMatch = tsRaw.match(/(?:T|\s)(\d{1,2}):(\d{2})/) || tsRaw.match(/^(\d{1,2}):(\d{2})/);
    const hour = hourMatch ? Number(hourMatch[1]) : 12;
    if (hour >= 6 && hour < 18) {
      daytimeEnergyOrPower += valRaw;
      daytimeCount++;
    }
  }

  if (missingIntervalsCount > 0) {
    warnings.push(`พบช่วงข้อมูลที่ขาดหายหรืออ่านค่าไม่ได้จำนวน ${missingIntervalsCount} แถว`);
  }

  const daytimeShare =
    totalEnergyOrPower > 0 ? Math.round((daytimeEnergyOrPower / totalEnergyOrPower) * 1000) / 10 : null;
  const avgDaytime = daytimeCount > 0 ? Math.round((daytimeEnergyOrPower / daytimeCount) * 100) / 100 : null;

  return {
    importedFileName: fileName,
    timezone,
    intervalMinutes: 15,
    rowCount: validRows,
    missingIntervalsCount,
    unitVerified,
    daytimeSharePct:
      daytimeShare !== null
        ? { status: 'known', value: daytimeShare }
        : { status: 'unknown', value: null },
    daytimeShareBasis: validRows > 0 ? 'Measured' : 'Unknown',
    peakDemandKw:
      validRows > 0 && unitVerified === 'kW'
        ? { status: 'known', value: Math.round(peakVal * 100) / 100 }
        : { status: 'unknown', value: null, note: 'ต้องยืนยันหน่วย kW ก่อนสรุป Peak Demand' },
    avgDaytimeKw:
      avgDaytime !== null && unitVerified === 'kW'
        ? { status: 'known', value: avgDaytime }
        : { status: 'unknown', value: null },
    warnings,
  };
}
