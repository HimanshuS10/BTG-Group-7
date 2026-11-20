export type InvestigationStatus =
  | 'New'
  | 'Investigating'
  | 'Ready for Controller Review'
  | 'Resolved';

export type ApprovalState =
  | 'Present'
  | 'Confirmed Missing'
  | 'Not Provided in Case';

export type ProvenanceType = 'Official case baseline' | 'User-added scenario';

export type CostFrequencyType = 'One-time' | 'Trend';

export type WalkBucketType =
  | 'Variable costs'
  | 'Fixed plant'
  | 'SG&A'
  | 'Amortization'
  | 'Other / Unassigned';

export type NavSection =
  | 'executive'
  | 'anomalies'
  | 'close'
  | 'trade'
  | 'interprovincial'
  | 'analyst'
  | 'roi'
  | 'data';

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  note: string;
  isDemoState?: boolean;
}

export interface EvidenceCheckItem {
  id: string;
  label: string;
  verified: boolean;
}

export interface ScreeningFlag {
  ruleId: string;
  ruleName: string;
  severity: 'High' | 'Medium' | 'Review';
  rationale: string;
}

export interface DismissedRuleRecord {
  ruleId: string;
  ruleName: string;
  dismissedBy: string;
  dismissedAt: string;
  reason: string;
}

export interface IrregularCostItem {
  id: string;
  provenance: ProvenanceType;
  date: string;
  accountingPeriod: string;
  department: string;
  plantAndRegion: string;
  regionGroup: 'North America' | 'Europe' | 'Corporate' | 'Asia' | 'Other';
  title: string;
  amount: number;
  costType: CostFrequencyType;
  walkCategory: string;
  glAccount: string;
  vendorOrCounterparty: string;
  invoiceNumber?: string;
  preparer: string;
  approvalState: ApprovalState;
  approvalRef: string | null;
  cause: string;
  supportingEvidence: string;
  verificationGaps: string;
  operatingEarningsEffect: string;
  linkedWalkLineId: string | null;
  recommendedSteps: string[];
  owner: string;
  status: InvestigationStatus;
  humanCorrectionDecision: 'Pending' | 'Accepted' | 'Rejected';
  notes: string;
  evidenceChecklist: EvidenceCheckItem[];
  dismissedRules?: DismissedRuleRecord[];
  carryForwardBlockReason?: string;
  carryForwardTargetPeriod?: string;
  fiveWs: {
    who: string;
    what: string;
    when: string;
    where: string;
    why: string;
    how: string;
  };
  auditTrail: AuditEntry[];
}

export type BrokerFeeStatus = 'Overcharge' | 'Undercharge' | 'Compliant';

export type FtaClaimStatus =
  | 'Agreement Claimed'
  | 'Potential Eligible / Unclaimed'
  | 'Unverified / Non-FTA';

export interface CustomsEntry {
  id: string;
  provenance: ProvenanceType;
  date: string;
  route: string;
  originCountry: string;
  destination: string;
  incoterm?: string;
  isChinaAdditionalTariff: boolean;
  goods: string;
  hsCode: string;
  declaredValue: number;
  normalDutyRate: number;
  chinaAdditionalTariffRate: number;
  exportDutyRate: number;
  dutyPolicyLabel: string;
  normalDutyAmount: number;
  chinaAdditionalTariffAmount: number;
  exportDutyAmount: number;
  assessedDutyAndTariffs: number;
  contractBrokerRate: number;
  expectedBrokerFee: number;
  billedBrokerFee: number;
  brokerVariance: number;
  brokerStatus: BrokerFeeStatus;
  ftaStatus: FtaClaimStatus;
  ftaDocumented: boolean;
  potentialMissedClaimDuty: number;
  evidence: string;
  notes: string;
}

export interface TariffRateRule {
  id: string;
  provenance: ProvenanceType;
  countryOrScope: string;
  goodsOrHsFilter: string;
  rateKind: 'Normal MFN' | 'Additional China Practice Tariff' | 'Export Duty' | 'Broker Contract';
  rateDecimal: number;
  effectiveDate: string;
  endDate: string | null;
  sourceNote: string;
  version: number;
  updatedAt: string;
}

export interface TariffRuleChangeLog {
  id: string;
  ruleId: string;
  rateKind: TariffRateRule['rateKind'];
  countryOrScope: string;
  oldRateDecimal: number | null;
  newRateDecimal: number;
  effectiveDate: string;
  changedBy: string;
  timestamp: string;
  affectedShipmentIds: string[];
  expectedCostDeltaCAD: number;
  appliedToWorkingEntries: boolean;
  note: string;
}

export interface InterprovincialDelivery {
  id: string;
  provenance: ProvenanceType;
  date: string;
  destination: string;
  provinceCode: string;
  salesAmount: number;
  taxLabel: string;
  taxRateDecimal: number;
  customerSalesTax: number;
  freightExpense: number;
  notes: string;
}

export type WalkExplanationStatus =
  | 'Awaiting Verification'
  | 'Needs investigation'
  | 'Verified';

export interface WalkLineItem {
  id: string;
  label: string;
  amountThousands: number; // signed CAD thousands
  category: 'Sales' | 'Variable costs' | 'Fixed plant' | 'SG&A' | 'Amortization';
  linkedIrIds?: string[];
  sourceReference: string;
  sourceAmountConfirmed?: boolean;
  explanationStatus: WalkExplanationStatus;
  explanationText: string;
  owner: string;
  evidenceReference?: string;
  approvalDecision?: 'Pending' | 'Approved' | 'Needs Investigation';
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface EarningsWalk {
  id: string;
  provenance: ProvenanceType;
  type: 'YoY' | 'QoQ' | 'Custom';
  title: string;
  fromPeriod: string;
  toPeriod: string;
  startEarningsThousands: number;
  endEarningsThousands: number;
  lines: WalkLineItem[];
  sourceName?: string;
  missingDriverNote?: string;
  closeApprovedBy?: string;
  closeApprovedAt?: string;
}

export interface ImportedQuarterRecord {
  id: string;
  provenance: 'User-added scenario';
  quarter: string;
  salesCAD: number;
  variableCostsCAD: number;
  fixedPlantCostsCAD: number;
  sgaCAD: number;
  amortizationCAD: number;
  calculatedOperatingEarningsCAD: number;
  priorQuarterLabel: string | null;
  qoqChangeCAD: number | null;
  yoyQuarterLabel: string | null;
  yoyChangeCAD: number | null;
  hasDriverBreakdown: boolean;
  missingDriverWarning: string;
  sourceName: string;
  importedAt: string;
}

export interface CloseChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  owner: string;
}

export interface WalkLineOverride {
  explanationStatus: WalkExplanationStatus;
  explanationText: string;
  owner: string;
  evidenceReference?: string;
  approvalDecision?: 'Pending' | 'Approved' | 'Needs Investigation';
  verifiedBy?: string;
  verifiedAt?: string;
}

export type ROIModelSelection = 'presentation_y1' | 'original_3yr';

export interface PresentationROIYear1Assumptions {
  appDevAndConfigCost: number;
  erpIntegrationSecurityCost: number;
  staffTrainingCost: number;
  cloudOpsSupportCost: number;
  duplicateInvoiceBaseCAD: number;
  duplicateRecoveryPct: number;
  hoursFreedAnnually: number;
  fullyLoadedHourlyRate: number;
  rushFreightQuarterlyBaseCAD: number;
  rushFreightQuartersPerYear: number;
  rushFreightAvoidablePct: number;
  brokerNetExcessQuarterlyCAD: number;
  brokerQuartersPerYear: number;
  brokerRecoveryPct: number;
}

export interface ROIAssumptions {
  implementationCost: number;
  monthlyMaintenance: number;
  employeeTrainingCost: number;
  annualIncidentCount: number;
  hoursSavedPerIncident: number;
  analystHourlyRate: number;
  brokerRecoveryBasis: 'net' | 'gross';
  brokerRecoveryLikelihoodPct: number;
  duplicateRecoveryLikelihoodPct: number;
  missedFtaRecoveryLikelihoodPct: number;
  annualPreventedLeakageBase: number;
  adoptionFactorPct: number;
  year1RampUpPct: number;
}

export interface AnalystCitation {
  id: string;
  label: string;
  amountText: string;
  section: NavSection;
}

export interface AnalystMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mode?: 'deterministic' | 'gemini';
  citations?: AnalystCitation[];
  calculations?: { label: string; value: string }[];
  error?: string;
}

export type CloseApprovalState =
  | 'Blocked'
  | 'Ready for Sign-Off'
  | 'Approved for Close';

export interface PeriodCloseApprovalRecord {
  periodKey: string;
  status: 'Approved' | 'Suspended';
  decision: 'Approved for Close' | 'Suspended — Re-Review Required';
  identityLabel: 'Simulated Demo Approval — Identity Not Verified';
  reviewerName: string;
  approvalDate: string;
  recordedAt: string;
  walkId: string;
  walkTitle: string;
  approvedWalkIds: string[];
  snapshotHash: string;
  walkHashes?: Record<string, string>;
  suspendedAt?: string;
  suspendedReason?: string;
}

export interface SkyguardPersistedState {
  schemaVersion: number;
  anomalies: IrregularCostItem[];
  customsEntries: CustomsEntry[];
  tariffRules: TariffRateRule[];
  tariffRuleChangelog?: TariffRuleChangeLog[];
  interprovincialDeliveries: InterprovincialDelivery[];
  customWalks: EarningsWalk[];
  importedQuarters?: ImportedQuarterRecord[];
  walkLineOverrides: Record<string, WalkLineOverride>;
  closeChecklist: CloseChecklistItem[];
  closeApprovalLog: AuditEntry[];
  periodCloseApprovals?: Record<string, PeriodCloseApprovalRecord>;
  selectedRoiModel?: ROIModelSelection;
  presentationRoiAssumptions?: PresentationROIYear1Assumptions;
  roiAssumptions: ROIAssumptions;
}
