export type UserRole =
  | 'master_admin'
  | 'franchise_admin'
  | 'surveyor'
  | 'electrical_engineer'
  | 'qa_manager'
  | 'sales_consultant'
  | 'customer_viewer';

export type ProjectType = 'Residential' | 'C&I';
export type SystemTopology = 'On-grid' | 'Hybrid' | 'On-grid + BESS Ready';

export type WorkflowStatus =
  | 'Draft'
  | 'Assigned'
  | 'Survey In Progress'
  | 'Submitted'
  | 'Engineering Review'
  | 'Revision Required'
  | 'Reviewed'
  | 'Report Issued'
  | 'Archived';

export type SyncState = 'Synced' | 'Saved locally' | 'Pending sync' | 'Conflict';

/**
 * Epistemic field status: strictly separates Known vs Unknown vs Not Inspected vs Not Applicable vs Unsafe.
 * A numeric 0 value is only valid when epistemicStatus === 'known'.
 */
export type EpistemicStatus =
  | 'known'
  | 'unknown'
  | 'not_inspected'
  | 'not_applicable'
  | 'unsafe_to_inspect'
  | 'requires_qualified_person';

export interface EpistemicValue<T> {
  status: EpistemicStatus;
  value: T | null;
  note?: string;
}

export interface Organization {
  id: string;
  name: string;
  brandName: string;
}

export interface Franchise {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  region: string;
  serviceAreas: string[];
  active: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  title: string;
  licenseNumber?: string;
}

export interface Membership {
  userId: string;
  franchiseId: string; // '*' for master admin cross-franchise overview
  role: UserRole;
}

export type ReferenceCategory =
  | 'standard_requirement'
  | 'manufacturer_manual'
  | 'brand_practice'
  | 'field_observation';

export interface StandardReference {
  id: string;
  category: ReferenceCategory;
  documentName: string;
  editionOrYear: string; // e.g., "ต้องตรวจสอบกับมาตรฐานฉบับที่ใช้บังคับ" if unverified
  clause: string;
  source: string;
  summary: string;
  lastVerifiedDate: string;
  reviewerName: string;
  verified: boolean;
  applicableTo: ('Residential' | 'C&I' | 'BESS' | 'CriXisZafe')[];
}

export type SafetyCheckState =
  | 'safe_to_proceed'
  | 'not_checked'
  | 'unsafe_to_inspect'
  | 'requires_qualified_person'
  | 'not_applicable';

export interface SafetyGateItem {
  id: string;
  category: 'Height' | 'Electrical' | 'Weather' | 'HazardousArea' | 'CriXisZafe';
  title: string;
  description: string;
  state: SafetyCheckState;
  isCriticalHazard: boolean;
  mitigationNote: string;
}

export type RiskSeverity = 1 | 2 | 3 | 4 | 5; // 5 = Catastrophic
export type RiskLikelihood = 1 | 2 | 3 | 4 | 5; // 5 = Almost Certain
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type HazardVerificationStatus =
  | 'Open'
  | 'Stop Work Active'
  | 'Mitigation Planned'
  | 'Pending Verification'
  | 'Verified Closed';

export interface HazardItem {
  id: string;
  projectId: string;
  title: string;
  category: 'Roof/Height' | 'Electrical/Arc-Flash' | 'Fire/BESS' | 'Flood/Weather' | 'Hazardous Material' | 'CriXisZafe';
  severity: RiskSeverity;
  likelihood: RiskLikelihood;
  riskLevel: RiskLevel;
  evidenceNote: string;
  evidenceIds: string[];
  correctiveAction: string;
  owner: string;
  dueDate: string;
  status: HazardVerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  referenceId?: string;
}

export interface SiteInfo {
  customerName: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  province: string;
  gpsLat?: number;
  gpsLng?: number;
  gpsConsentGranted: boolean;
  buildingType: string;
  usagePattern: string;
  buildingOwnerOrAuthorizer: string;
  utilityProvider: 'MEA' | 'PEA' | 'Other';
  utilityOtherName?: string;
  accessConstraints: string;
  siteSafetyRules: string;
  customerGoals: ('ลดค่าไฟ' | 'สำรองไฟ' | 'ESG / Net Zero' | 'ลดความร้อนหลังคา')[];
  budgetRangeThb: string;
  expansionPlan: string;
  pdpaConsentRecorded: boolean;
  pdpaConsentDate?: string;
}

export interface UtilityBillRecord {
  id: string;
  meterNumber: string;
  billingMonth: string; // YYYY-MM
  kwhTotal: number;
  kwhOnPeak?: number;
  kwhOffPeak?: number;
  demandKw?: number;
  billAmountThb: number;
  tariffType: string;
  source: 'Manual Entry' | 'OCR Pending Verification' | 'OCR Verified';
}

export interface LoadProfileSummary {
  importedFileName?: string;
  timezone: string;
  intervalMinutes?: number;
  rowCount: number;
  missingIntervalsCount: number;
  unitVerified: 'kW' | 'kWh' | 'Unknown';
  daytimeSharePct: EpistemicValue<number>;
  daytimeShareBasis: 'Measured' | 'Estimated' | 'Unknown';
  peakDemandKw: EpistemicValue<number>;
  avgDaytimeKw: EpistemicValue<number>;
  warnings: string[];
}

export interface ElectricalMeterGroup {
  id: string;
  label: string;
  buildingName: string;
  meterNumber: string;
  utilityTariff: string;
  transformerKva: EpistemicValue<number>;
  hasGenerator: EpistemicValue<boolean>;
  hasAts: EpistemicValue<boolean>;
  criticalLoadsDesc: string;
}

export interface ElectricalLoadData {
  operatingHours: string;
  holidaysPattern: string;
  seasonalVariation: string;
  meters: ElectricalMeterGroup[];
  bills: UtilityBillRecord[];
  loadProfile: LoadProfileSummary;
}

export interface RoofZone {
  id: string;
  name: string;
  roofType: string;
  material: string;
  ageYears: EpistemicValue<number>;
  structureType: string;
  purlinSpanMeters: EpistemicValue<number>;
  asBuiltDrawingAvailable: EpistemicValue<boolean>;
  pitchDegrees: EpistemicValue<number>;
  azimuthDirection: string;
  grossAreaSqm: EpistemicValue<number>;
  usableAreaSqm: EpistemicValue<number>;
  skylightsAndOpenings: string;
  parapetAndDrainageNotes: string;
  conditionFindings: string; // leaks, rust, degradation
  shadingObservations: string;
  shadingTimeWindow: string;
  accessAndMaintenancePath: string;
  suspectedHazardousMaterial: EpistemicValue<boolean>;
  hazardousMaterialNote: string;
  structuralEngineerStatus:
    | 'ยังไม่ประเมิน'
    | 'ส่งประเมินแล้ว'
    | 'มีเอกสารรับรองจากวิศวกรโครงสร้าง';
  structuralNote: string;
}

export interface ElectricalConnectionData {
  phaseSystem: '1-Phase 230V' | '3-Phase 230/400V' | '3-Phase MV/Transformer' | 'Unknown';
  confirmedVoltage: EpistemicValue<string>;
  mainBreakerRatingA: EpistemicValue<number>;
  mdbLocationAndSpareSpace: EpistemicValue<string>;
  proposedPoc: string;
  pocRationale: string;
  busbarAndConductorInfo: EpistemicValue<string>;
  protectionDevicesInfo: EpistemicValue<string>;
  existingSldAvailable: EpistemicValue<boolean>;
  groundingAndBondingStatus: EpistemicValue<string>;
  groundTestDocAvailable: EpistemicValue<boolean>;
  lightningAndSpdNotes: string;
  acDcCableRouteAndDistanceM: EpistemicValue<number>;
  inverterAndIsolatorPlacement: string;
  environmentHazards: {
    ventilation: string;
    floodRiskLevel: string;
    heatDustChemical: string;
    serviceClearance: string;
  };
  antiIslandingAndExportLimitationNotes: string;
  engineerDesignPendingNote: string;
}

export interface BatteryHybridModule {
  applicable: boolean;
  backupObjective: string;
  criticalLoadList: string;
  estimatedBackupLoadKw: EpistemicValue<number>;
  requiredBackupHours: EpistemicValue<number>;
  proposedLocation: string;
  clearancePerManufacturerNote: string;
  fireSafetyAndEgressNotes: string;
  bmsAndMonitoringNotes: string;
  warrantyAndEolPlan: string;
}

export type DesignChecklistStatus = 'Target Defined' | 'Needs Adjustment' | 'Not Applicable';
export type PostInstallStatus = 'Not Assessed' | 'Compliant' | 'Action Required' | 'Not Applicable';

export interface ExcellenceChecklistItem {
  id: string;
  title: string;
  category: 'Layout & Aesthetics' | 'Cable & Conduit' | 'Labeling & Weatherproofing' | 'Service & Handover';
  designTargetStatus: DesignChecklistStatus;
  designNote: string;
  postInstallStatus: PostInstallStatus; // Always defaults to 'Not Assessed' during pre-install survey
  safetyPriorityRule: string;
}

export interface EvidenceMarkupAnnotation {
  id: string;
  type: 'arrow' | 'circle' | 'text' | 'panel_zone';
  x1: number; // normalized 0..1
  y1: number;
  x2?: number;
  y2?: number;
  label?: string;
  color: string;
}

export interface EvidenceFile {
  id: string;
  projectId: string;
  category:
    | 'Building Overview'
    | 'Site Access'
    | 'Roof & Obstacles'
    | 'Meter & MDB (Safe View)'
    | 'Inverter & Route'
    | 'Hazard / Restriction'
    | 'SLD / Drawing / Sketch'
    | 'Before/After Reference Angle';
  title: string;
  caption: string;
  unableToCaptureSafely: boolean;
  unsafeReason?: string;
  originalDataUrl?: string; // Stored separately from annotated image
  annotatedDataUrl?: string;
  annotations: EvidenceMarkupAnnotation[];
  isNotToScaleSketch: boolean;
  recordedAt: string;
  recordedBy: string;
  gpsLat?: number;
  gpsLng?: number;
  fileType: 'image' | 'pdf' | 'sketch';
}

export interface CalculationScenarioInput {
  panelCount: number;
  panelWp: number;
  inverterAcKw: number;
  specificYieldKwhPerKwpYear: number;
  yieldSourceNote: string;
  soilingAndTempLossPct: number;
  inverterAndCableLossPct: number;
  shadingLossPct: number;
  selfConsumptionPct: number;
  exportTariffThbPerKwh: number; // Default 0 unless verified buyback condition
  exportAllowed: boolean;
  curtailmentPct: number;
  blendedElectricityRateThbPerKwh: number;
  capexThb: number;
  annualOpexThb: number;
  dataCompleteForPayback: boolean;
}

export interface EngineeringReviewRecord {
  id: string;
  revisionNumber: string;
  reviewerName: string;
  reviewerRole: UserRole;
  decision: 'Pending' | 'Approved for Proposal' | 'Revision Required' | 'Conditional';
  scopeOfReview: string;
  comments: string;
  reviewedAt: string;
  readinessStatus: 'ข้อมูลครบ' | 'ตรวจทานแล้ว' | 'มีเงื่อนไข' | 'ยังไม่พร้อม';
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  detail: string;
  revisionNumber: string;
}

export interface SurveyRevision {
  revisionNumber: string;
  createdAt: string;
  createdBy: string;
  reason: string;
  invalidatedReview: boolean;
}

export interface SolarSurveyProject {
  id: string;
  projectCode: string; // e.g., XOL-BKK-2026-001
  franchiseId: string;
  isDemoData: boolean;
  projectType: ProjectType;
  topology: SystemTopology;
  status: WorkflowStatus;
  syncState: SyncState;
  revisionNumber: string;
  formVersion: string;
  standardSetVersion: string;
  assignedSurveyor: string;
  assignedEngineer: string;
  scheduledSurveyDate: string;
  updatedAt: string;
  createdAt: string;
  site: SiteInfo;
  safetyGate: SafetyGateItem[];
  electricalLoad: ElectricalLoadData;
  roofZones: RoofZone[];
  electricalConnection: ElectricalConnectionData;
  batteryModule: BatteryHybridModule;
  excellenceChecklist: ExcellenceChecklistItem[];
  hazards: HazardItem[];
  evidenceFiles: EvidenceFile[];
  calculation: CalculationScenarioInput;
  reviews: EngineeringReviewRecord[];
  revisions: SurveyRevision[];
  auditLog: AuditEvent[];
  surveyorSummaryNote: string;
  limitationsAndUnknowns: string;
}
