import React, { useMemo, useState } from 'react';
import { Calculator, Info } from 'lucide-react';
import { CalculationScenarioInput, ProjectType } from '../../types/survey';
import { computeSolarCalculation } from '../../lib/calculations';

interface CalculatorSectionProps {
  projectType: ProjectType;
  value: CalculationScenarioInput;
  readOnly: boolean;
  onChange: (next: CalculationScenarioInput) => void;
}

export const CalculatorSection: React.FC<CalculatorSectionProps> = ({
  projectType,
  value,
  readOnly,
  onChange,
}) => {
  const [showFormulas, setShowFormulas] = useState(true);
  const output = useMemo(
    () => computeSolarCalculation(value, projectType),
    [value, projectType]
  );

  const updateField = <K extends keyof CalculationScenarioInput>(
    key: K,
    val: CalculationScenarioInput[K]
  ) => {
    if (readOnly) return;
    onChange({ ...value, [key]: val });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-4 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2.5">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong>คำชี้แจงสำคัญ:</strong> ผลลัพธ์ทั้งหมดในหน้านี้เป็น{' '}
          <strong>“ประมาณการเบื้องต้น ไม่ใช่การรับประกันผลผลิต ผลประหยัด หรือแบบวิศวกรรมที่รับรองแล้ว”</strong>{' '}
          และจะไม่ใช้กำลัง kW เพียงอย่างเดียวมากำหนดขนาดสายไฟหรือเบรกเกอร์
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              H. การประเมินกำลังติดตั้งเบื้องต้นและความคุ้มค่า (Low / Base / High)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              แยกชัดเจนระหว่าง kWp (DC) · kW (AC Inverter / Demand) · kWh (พลังงานต่อปี)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowFormulas((v) => !v)}
            className="text-xs font-medium text-slate-700 dark:text-amber-400 underline"
          >
            {showFormulas ? 'ซ่อนสูตรคำนวณ' : 'ตรวจสอบสูตรคำนวณ'}
          </button>
        </div>

        {showFormulas && (
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono space-y-1 text-slate-700 dark:text-slate-300">
            <div>1. Installed DC (kWp) = (จำนวนแผง × Wp ต่อแผง) ÷ 1,000 = {output.installedDcKwp.toFixed(2)} kWp</div>
            <div>2. Gross Energy (kWh/yr) = Installed kWp × Specific Yield (kWh/kWp/yr)</div>
            <div>
              3. Combined Loss Cascade (ไม่หักซ้ำ) = (1 - Soiling/Temp%) × (1 - Inv/Cable%) × (1 - Shading%) ={' '}
              {(output.combinedLossFactor * 100).toFixed(1)}% (ลดทอนรวม {output.totalDeratePct.toFixed(1)}%)
            </div>
            <div>
              4. Net Savings = (Self-consumed kWh × อัตราค่าไฟ) + (Exported kWh × อัตรารับซื้อ) - OPEX รายปี
            </div>
          </div>
        )}

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              จำนวนแผง (แผ่น)
            </label>
            <input
              type="number"
              min={0}
              disabled={readOnly}
              value={value.panelCount}
              onChange={(e) => updateField('panelCount', Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              กำลังต่อแผง (Wp)
            </label>
            <input
              type="number"
              min={0}
              disabled={readOnly}
              value={value.panelWp}
              onChange={(e) => updateField('panelWp', Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              พิกัด Inverter AC รวม (kW)
            </label>
            <input
              type="number"
              min={0}
              step="0.1"
              disabled={readOnly}
              value={value.inverterAcKw}
              onChange={(e) => updateField('inverterAcKw', Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Specific Yield (kWh/kWp/yr)
            </label>
            <input
              type="number"
              min={0}
              disabled={readOnly}
              value={value.specificYieldKwhPerKwpYear}
              onChange={(e) =>
                updateField('specificYieldKwhPerKwpYear', Math.max(0, Number(e.target.value)))
              }
              className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Loss ฝุ่น/ความร้อน (%)
            </label>
            <input
              type="number"
              min={0}
              max={50}
              step="0.5"
              disabled={readOnly}
              value={value.soilingAndTempLossPct}
              onChange={(e) => updateField('soilingAndTempLossPct', Number(e.target.value))}
              className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Loss Inverter &amp; สาย (%)
            </label>
            <input
              type="number"
              min={0}
              max={50}
              step="0.5"
              disabled={readOnly}
              value={value.inverterAndCableLossPct}
              onChange={(e) => updateField('inverterAndCableLossPct', Number(e.target.value))}
              className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Loss เงาบัง (%)
            </label>
            <input
              type="number"
              min={0}
              max={80}
              step="0.5"
              disabled={readOnly}
              value={value.shadingLossPct}
              onChange={(e) => updateField('shadingLossPct', Number(e.target.value))}
              className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              สัดส่วนใช้เอง Self-Consumption (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              disabled={readOnly}
              value={value.selfConsumptionPct}
              onChange={(e) => updateField('selfConsumptionPct', Number(e.target.value))}
              className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              อัตราค่าไฟอ้างอิงเฉลี่ย (บาท/kWh)
            </label>
            <input
              type="number"
              min={0}
              step="0.05"
              disabled={readOnly}
              value={value.blendedElectricityRateThbPerKwh}
              onChange={(e) =>
                updateField('blendedElectricityRateThbPerKwh', Number(e.target.value))
              }
              className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              งบลงทุนเบื้องต้น CAPEX (บาท)
            </label>
            <input
              type="number"
              min={0}
              step="1000"
              disabled={readOnly}
              value={value.capexThb}
              onChange={(e) => updateField('capexThb', Number(e.target.value))}
              className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              ค่าบำรุงรักษา OPEX (บาท/ปี)
            </label>
            <input
              type="number"
              min={0}
              step="500"
              disabled={readOnly}
              value={value.annualOpexThb}
              onChange={(e) => updateField('annualOpexThb', Number(e.target.value))}
              className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Curtailment / Zero-Export Clipping (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              disabled={readOnly}
              value={value.curtailmentPct}
              onChange={(e) => updateField('curtailmentPct', Number(e.target.value))}
              className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 min-h-[42px]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              แหล่งที่มาของค่า Specific Yield
            </label>
            <input
              type="text"
              disabled={readOnly}
              value={value.yieldSourceNote}
              onChange={(e) => updateField('yieldSourceNote', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>

          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={value.exportAllowed}
                onChange={(e) => updateField('exportAllowed', e.target.checked)}
              />
              มีเงื่อนไข/โครงการรับซื้อไฟฟ้าส่วนเกินรองรับ (ห้ามติ๊กหากยังไม่มีเอกสารสิทธิ์ขายไฟ)
            </label>
            {value.exportAllowed && (
              <div className="flex items-center gap-2">
                <span>อัตราขายไฟส่วนเกิน (บาท/kWh):</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  disabled={readOnly}
                  value={value.exportTariffThbPerKwh}
                  onChange={(e) => updateField('exportTariffThbPerKwh', Number(e.target.value))}
                  className="w-28 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 tabular-nums"
                />
              </div>
            )}
            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={value.dataCompleteForPayback}
                onChange={(e) => updateField('dataCompleteForPayback', e.target.checked)}
              />
              ข้อมูลบิลค่าไฟและข้อจำกัดหน้างานเพียงพอสำหรับแสดง Simple Payback เบื้องต้น
            </label>
          </div>
        </div>

        {/* Warnings */}
        {output.warnings.length > 0 && (
          <div className="p-3.5 rounded-lg bg-slate-100 dark:bg-slate-800/70 text-xs text-slate-700 dark:text-slate-300 space-y-1">
            {output.warnings.map((w, idx) => (
              <div key={idx}>• {w}</div>
            ))}
          </div>
        )}

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500">กำลังติดตั้ง DC</div>
            <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {output.installedDcKwp.toFixed(2)} kWp
            </div>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500">พิกัด Inverter AC</div>
            <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {output.inverterAcKw.toFixed(1)} kW
            </div>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500">DC / AC Ratio</div>
            <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {output.dcAcRatio ? output.dcAcRatio.toFixed(2) : '-'}
            </div>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500">รวม Loss (ไม่หักซ้ำ)</div>
            <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {output.totalDeratePct.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Scenario Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 pr-4 font-semibold">กรณีประเมิน (Scenario)</th>
                <th className="py-2.5 px-3 text-right font-semibold">ใช้เอง (kWh/ปี)</th>
                <th className="py-2.5 px-3 text-right font-semibold">ส่งออก (kWh/ปี)</th>
                <th className="py-2.5 px-3 text-right font-semibold">Curtail/ส่วนเกินไม่ได้ขาย</th>
                <th className="py-2.5 px-3 text-right font-semibold">ผลประหยัดสุทธิ/ปี</th>
                <th className="py-2.5 pl-3 text-right font-semibold">Simple Payback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
              {output.scenarios.map((sc) => (
                <tr key={sc.name}>
                  <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">
                    {sc.name}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {Math.round(sc.selfConsumedKwh).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {Math.round(sc.exportedKwh).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-500">
                    {Math.round(sc.curtailedKwh).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                    {Math.round(sc.netAnnualSavingsThb).toLocaleString()} บาท
                  </td>
                  <td className="py-3 pl-3 text-right">
                    {sc.simplePaybackYears !== null ? (
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {sc.simplePaybackYears.toFixed(1)} ปี
                      </span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">
                        งดแสดง ({sc.paybackSuppressedReason})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
