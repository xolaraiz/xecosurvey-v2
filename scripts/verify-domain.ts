import assert from 'node:assert/strict';
import { computeSolarCalculation, parseLoadProfileCsv } from '../src/lib/calculations';
import { computeRiskLevel, getCriticalRiskStatus } from '../src/lib/safety';
import { filterProjectsForContext } from '../src/lib/rbac';
import { DEMO_PROJECTS } from '../src/lib/demoData';

// 1. Calculation unit & formula verification
const calc = computeSolarCalculation(
  {
    panelCount: 20,
    panelWp: 550,
    inverterAcKw: 10,
    specificYieldKwhPerKwpYear: 1400,
    yieldSourceNote: 'Test',
    soilingAndTempLossPct: 10,
    inverterAndCableLossPct: 5,
    shadingLossPct: 0,
    selfConsumptionPct: 80,
    exportTariffThbPerKwh: 0,
    exportAllowed: false,
    curtailmentPct: 0,
    blendedElectricityRateThbPerKwh: 4.5,
    capexThb: 350000,
    annualOpexThb: 5000,
    dataCompleteForPayback: true,
  },
  'Residential'
);

assert.equal(calc.installedDcKwp, 11);
assert.ok(Math.abs(calc.combinedLossFactor - 0.855) < 0.0001);
assert.ok(calc.scenarios[1].simplePaybackYears !== null);

// Suppress misleading payback when net savings <= 0
const negativeCalc = computeSolarCalculation(
  {
    panelCount: 10,
    panelWp: 500,
    inverterAcKw: 5,
    specificYieldKwhPerKwpYear: 1200,
    yieldSourceNote: 'Test',
    soilingAndTempLossPct: 5,
    inverterAndCableLossPct: 5,
    shadingLossPct: 0,
    selfConsumptionPct: 50,
    exportTariffThbPerKwh: 0,
    exportAllowed: false,
    curtailmentPct: 0,
    blendedElectricityRateThbPerKwh: 4,
    capexThb: 200000,
    annualOpexThb: 50000, // OPEX exceeds gross savings
    dataCompleteForPayback: true,
  },
  'Residential'
);
assert.equal(negativeCalc.scenarios[1].simplePaybackYears, null);

// 2. CSV Load Profile parser verification
const csvRes = parseLoadProfileCsv(
  'timestamp,kw\n2026-10-01T10:00,120\n2026-10-01T22:00,40\nbadrow\n',
  'test.csv',
  'Asia/Bangkok',
  'kW'
);
assert.equal(csvRes.rowCount, 2);
assert.equal(csvRes.missingIntervalsCount, 1);
assert.equal(csvRes.daytimeSharePct.value, 75);
assert.equal(csvRes.peakDemandKw.value, 120);

// 3. Critical Risk blocking verification
assert.equal(computeRiskLevel(5, 4), 'Critical');
const ciRiskStatus = getCriticalRiskStatus(DEMO_PROJECTS[1]);
assert.equal(ciRiskStatus.hasBlockingCriticalRisk, true);

// 4. Tenant isolation verification
const bkkOnly = filterProjectsForContext(DEMO_PROJECTS, 'BKK-01', 'franchise_admin');
assert.equal(bkkOnly.length, 1);
assert.equal(bkkOnly[0].franchiseId, 'BKK-01');

const customerOnly = filterProjectsForContext(DEMO_PROJECTS, 'BKK-01', 'customer_viewer');
assert.equal(customerOnly.length, 0); // Neither demo project is Report Issued yet

console.log('ALL_DOMAIN_ASSERTIONS_PASSED');
