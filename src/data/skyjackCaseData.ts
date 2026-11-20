import type {
  AuditEntry,
  CloseApprovalState,
  CloseChecklistItem,
  CustomsEntry,
  EarningsWalk,
  ImportedQuarterRecord,
  InterprovincialDelivery,
  IrregularCostItem,
  PeriodCloseApprovalRecord,
  PresentationROIYear1Assumptions,
  ROIAssumptions,
  ScreeningFlag,
  SkyguardPersistedState,
  TariffRateRule,
  WalkLineOverride,
} from '../types/skyguard';

export const APPENDIX_SECTIONS = {
  INCOME_STATEMENTS: 'Section 1.1',
  YOY_WALK: 'Section 1.2',
  QOQ_WALK: 'Section 1.3',
  REGIONAL_SALES: 'Section 1.4',
  IRREGULAR_SUMMARY: 'Section 2.1',
  IRREGULAR_TOTALS: 'Section 2.2',
  IRREGULAR_DETAILS: 'Section 2.3',
  TRADE_SUMMARY: 'Section 3.1',
  CUSTOMS_ENTRIES: 'Section 3.2',
  BROKER_BENCHMARK: 'Section 3.3',
  CHINA_TARIFF_SCENARIOS: 'Section 3.4',
  INTERPROVINCIAL: 'Section 3.5',
  TRADE_TRENDS: 'Section 3.6',
  COMPANY_RULES: 'Section 4.1',
} as const;

export const SCHEMA_VERSION = 2;
export const STORAGE_KEY_V2 = 'skyguard_state_v2';
export const LEGACY_STORAGE_KEY_V1 = 'skyguard_anomalies_v1';

export const CASE_CONSTANTS = {
  COMPANY_NAME: 'SKYJACK Inc.',
  PLATFORM_NAME: 'SKYGUARD AI',
  PROTOTYPE_NOTICE: 'Student competition prototype — not an official SKYJACK deployment.',
  DATASET_NOTICE: 'Fictional competition case figures — CAD',
  REPORTING_PERIOD: 'Q3 2026',
  Q3_2026_SALES_M: 329.7,
  Q3_2026_EARNINGS_M: 20.7,
  Q3_2026_EARNINGS_CAD: 20_700_000,
  Q3_2025_EARNINGS_CAD: 15_200_000,
  Q2_2026_EARNINGS_CAD: 16_500_000,
  YOY_EARNINGS_CHANGE_CAD: 5_500_000,
  QOQ_EARNINGS_CHANGE_CAD: 4_200_000,
  IRREGULAR_TOTAL_CAD: 2_818_000,
  IRREGULAR_NORTH_AMERICA_CAD: 2_028_000,
  IRREGULAR_FINANCE_CAD: 750_000,
  TRANSACTION_ALERT_THRESHOLD_CAD: 250_000,
  WALK_MATERIALITY_THRESHOLD_THOUSANDS: 1_000,
  WALK_MATERIALITY_THRESHOLD_CAD: 1_000_000,
  CONTRACTUAL_BROKER_RATE: 0.002,
  CUSTOMS_DECLARED_TOTAL_CAD: 9_980_000,
  CUSTOMS_NORMAL_DUTY_CAD: 126_250,
  CUSTOMS_CHINA_EXTRA_TARIFF_CAD: 525_000,
  CUSTOMS_EXPORT_DUTY_CAD: 60_000,
  CUSTOMS_DUTY_TARIFF_TOTAL_CAD: 711_250,
  BROKER_BILLED_TOTAL_CAD: 25_520,
  BROKER_EXPECTED_TOTAL_CAD: 19_960,
  BROKER_GROSS_OVERCHARGE_CAD: 8_260,
  BROKER_UNDERCHARGE_CAD: 2_700,
  BROKER_NET_EXCESS_CAD: 5_560,
  TRADE_ALL_IN_TOTAL_CAD: 736_770,
  BASELINE_CHINA_EXTRA_TARIFF_RATE: 0.25,
  CHINA_DECLARED_VALUE_Q3_CAD: 2_100_000,
  POTENTIAL_MISSED_CUSMA_E08_CAD: 11_020,
  INTERPROVINCIAL_SALES_TOTAL_CAD: 7_300_000,
  INTERPROVINCIAL_TAX_TOTAL_CAD: 799_525,
  INTERPROVINCIAL_FREIGHT_TOTAL_CAD: 95_400,
} as const;

export function formatCAD(amount: number, showDecimals = false): string {
  const absVal = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(absVal);

  const prefix = amount < 0 ? '-' : '';
  return `${prefix}CAD ${formatted.replace(/^CA\$/, '$')}`;
}

export function formatSignedCAD(amount: number): string {
  const prefix = amount > 0 ? '+' : '';
  return `${prefix}${formatCAD(amount)}`;
}

export function formatCompactCAD(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const str = millions.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    return `${sign}CAD $${str}M`;
  }
  return formatCAD(amount);
}

// Section 1.1 & Section 3.6: Historical Income Statement + 8-Quarter Trade Cost Series (Q4 2024 – Q3 2026)
export const HISTORICAL_QUARTERLY_SERIES = [
  { quarter: 'Q4 2024', salesM: 290.4, operatingEarningsM: 9.7, tradeCostsK: 298 },
  { quarter: 'Q1 2025', salesM: 268.9, operatingEarningsM: 2.3, tradeCostsK: 281 },
  { quarter: 'Q2 2025', salesM: 301.2, operatingEarningsM: 12.4, tradeCostsK: 305 },
  { quarter: 'Q3 2025', salesM: 312.6, operatingEarningsM: 15.2, tradeCostsK: 312 },
  { quarter: 'Q4 2025', salesM: 287.3, operatingEarningsM: 2.6, tradeCostsK: 327 },
  { quarter: 'Q1 2026', salesM: 275.8, operatingEarningsM: 0.8, tradeCostsK: 402 },
  { quarter: 'Q2 2026', salesM: 318.4, operatingEarningsM: 16.5, tradeCostsK: 588 },
  { quarter: 'Q3 2026', salesM: 329.7, operatingEarningsM: 20.7, tradeCostsK: 737 },
] as const;

// Section 2.1 – 2.3: Seven Official Q3 2026 Irregular / Unidentified Costs (Total = $2,818,000)
export const OFFICIAL_IRREGULAR_COSTS: IrregularCostItem[] = [
  {
    id: 'IR-01',
    provenance: 'Official case baseline',
    date: '2026-09-29',
    accountingPeriod: 'Q3 2026 (Period 9)',
    department: 'Operations',
    plantAndRegion: 'Plant 2 · North America',
    regionGroup: 'North America',
    title: 'Plant 2 scrap write-off',
    amount: 900_000,
    costType: 'One-time',
    walkCategory: 'Fixed plant',
    glAccount: 'GL 6410 (Scrap / Inventory Write-off)',
    vendorOrCounterparty: 'Internal Plant 2 Production',
    preparer: 'Plant 2 cost accountant (PA-2214)',
    approvalState: 'Not Provided in Case',
    approvalRef: null,
    cause:
      'Hydraulic cylinder batch failed weld inspection; posted September 29, 2026 (Period 9 close) via manual journal entry JE-260931 (debit GL 6410 / credit inventory) with no reversal reference.',
    supportingEvidence:
      'Manual journal entry JE-260931; debit GL 6410 / credit inventory; preparer PA-2214. Weld inspection failure report & approval sign-off not provided in Appendix.',
    verificationGaps:
      'No reversal reference; weld failure root-cause report and controller/VP approval sign-off not provided in case. Do not assert fraud or assume loss is recoverable.',
    operatingEarningsEffect:
      'Reduces Q3 2026 operating earnings by CAD $900,000 in Fixed plant: one-time scrap (below $1M standalone walk materiality, but flagged by $250K transaction screen).',
    linkedWalkLineId: 'yoy-fixed-scrap',
    recommendedSteps: [
      'Inspect weld inspection non-conformance report for the affected hydraulic cylinder batch.',
      'Verify manual journal entry JE-260931 support and confirm whether any scrap salvage value applies.',
      'Obtain Plant Operations and Controller sign-off without assuming cash recovery.',
    ],
    owner: 'Dana (Plant Finance Lead)',
    status: 'New',
    humanCorrectionDecision: 'Pending',
    notes:
      'Linked to YoY earnings-walk line Fixed plant: one-time scrap (-$900K). Note: IR-01 is $900K (below $1M walk materiality) and is flagged under the $250K entry screen + period-9 close timing.',
    evidenceChecklist: [
      { id: 'chk-ir01-1', label: 'Journal entry JE-260931 GL 6410 / Inventory support reviewed', verified: true },
      { id: 'chk-ir01-2', label: 'Weld inspection failure QA report attached', verified: false },
      { id: 'chk-ir01-3', label: 'Controller / Operations sign-off recorded', verified: false },
    ],
    fiveWs: {
      who: 'Posted by Plant 2 cost accountant (PA-2214); approval reference not provided in case.',
      what: 'CAD $900,000 one-time Plant 2 scrap write-off (debit GL 6410 / credit inventory).',
      when: 'September 29, 2026 (Period 9 quarter-end close).',
      where: 'Plant 2 · North America (Fixed plant).',
      why: 'Hydraulic cylinder batch failed weld inspection.',
      how: 'Manual journal entry JE-260931 posted at period-end close with no reversal reference.',
    },
    auditTrail: [
      {
        id: 'AUD-IR01-1',
        timestamp: '2026-09-29 17:45 EST',
        actor: 'PA-2214 (Plant 2 Cost Accountant)',
        action: 'Manual Journal Posted',
        note: 'JE-260931 posted (CAD $900,000) to GL 6410 / Inventory.',
      },
      {
        id: 'AUD-IR01-2',
        timestamp: '2026-09-30 08:00 EST',
        actor: 'SKYGUARD Screening Engine',
        action: 'Auto-Flagged',
        note: 'Triggered >= CAD $250,000 screen, Period 9 close timing, and missing reversal/support review.',
      },
    ],
  },
  {
    id: 'IR-02',
    provenance: 'Official case baseline',
    date: '2026-08-28',
    accountingPeriod: 'Q3 2026 (Weeks 30–35)',
    department: 'Logistics',
    plantAndRegion: 'North America',
    regionGroup: 'North America',
    title: 'Rush freight premium',
    amount: 600_000,
    costType: 'Trend',
    walkCategory: 'SG&A in recorded walk',
    glAccount: 'SG&A (Misclassified vs. Freight Out)',
    vendorOrCounterparty: 'Three expedited freight carriers',
    preparer: 'Not provided in case',
    approvalState: 'Not Provided in Case',
    approvalRef: null,
    cause:
      'Late truck bookings across Weeks 30–35, 2026 with three carriers; invoices coded to SG&A rather than freight out.',
    supportingEvidence:
      'Carrier expedited freight invoices across Weeks 30–35, 2026 coded to SG&A.',
    verificationGaps:
      'Possible GL coding correction (SG&A vs. Freight Out) requires review; a reclassification between expense lines is NOT automatically a cash saving.',
    operatingEarningsEffect:
      'Reduces Q3 2026 operating earnings by CAD $600,000 (recorded in SG&A: rush freight on the YoY earnings walk).',
    linkedWalkLineId: 'yoy-sga-rush',
    recommendedSteps: [
      'Audit carrier invoices across Weeks 30–35 to confirm late-booking root causes.',
      'Assess whether GL reclassification from SG&A to Freight Out is warranted (zero net EBIT change).',
      'Review production scheduling handoffs to reduce emergency truck dispatches.',
    ],
    owner: 'Dana (Plant Finance Lead)',
    status: 'Investigating',
    humanCorrectionDecision: 'Pending',
    notes:
      'Recurring trend exposure across 6 weeks; linked to YoY walk line SG&A: rush freight (-$600K).',
    evidenceChecklist: [
      { id: 'chk-ir02-1', label: 'Three carrier expedited invoices reconciled', verified: true },
      { id: 'chk-ir02-2', label: 'GL coding review (SG&A vs. Freight Out) approved', verified: false },
    ],
    fiveWs: {
      who: 'Three freight carriers; internal invoice preparer/approver not provided in case.',
      what: 'CAD $600,000 trend rush freight premium coded to SG&A instead of freight out.',
      when: 'Weeks 30–35, 2026 (Q3 2026).',
      where: 'Logistics · North America.',
      why: 'Late truck bookings required expedited carrier capacity.',
      how: 'Three-carrier invoices posted to SG&A expense rather than Freight Out.',
    },
    auditTrail: [
      {
        id: 'AUD-IR02-1',
        timestamp: '2026-09-02 09:15 EST',
        actor: 'SKYGUARD Screening Engine',
        action: 'Auto-Flagged',
        note: 'Triggered >= CAD $250,000 screen and potential GL account/category mismatch (SG&A vs. Freight Out).',
      },
    ],
  },
  {
    id: 'IR-03',
    provenance: 'Official case baseline',
    date: '2026-08-19',
    accountingPeriod: 'Q3 2026 (August)',
    department: 'Procurement',
    plantAndRegion: 'Europe',
    regionGroup: 'Europe',
    title: 'Duplicate vendor invoice',
    amount: 265_000,
    costType: 'One-time',
    walkCategory: 'Variable costs',
    glAccount: 'Variable Costs (Steel Raw Material AP)',
    vendorOrCounterparty: 'Steel supplier V-4471',
    invoiceNumber: 'INV-V4471-882-A',
    preparer: 'Accounts payable clerk',
    approvalState: 'Not Provided in Case',
    approvalRef: null,
    cause:
      'Invoice for steel supplier V-4471 re-entered with “-A” suffix in August 2026; second payment posted because AP matching rule missed suffix variation.',
    supportingEvidence:
      'AP payment log for supplier V-4471 showing original invoice and “-A” suffix duplicate entry.',
    verificationGaps:
      'Confirm whether supplier V-4471 holds an unapplied credit or duplicate cash receipt; potential recovery is strictly subject to verification and successful collection.',
    operatingEarningsEffect:
      'Overstates Q3 2026 variable costs and reduces operating earnings by CAD $265,000 unless confirmed duplicate and recovered.',
    linkedWalkLineId: null,
    recommendedSteps: [
      'Run normalized invoice matching (strip “-A” suffix) against V-4471 payment history.',
      'Obtain supplier V-4471 statement confirming duplicate payment receipt.',
      'Human controller must approve debit memo or refund collection request before adjusting GL.',
    ],
    owner: 'Accounts Payable Lead',
    status: 'Investigating',
    humanCorrectionDecision: 'Pending',
    notes:
      'Matched by SKYGUARD duplicate-invoice suffix heuristic (-A). Recovery is conditional on vendor verification and collection.',
    evidenceChecklist: [
      { id: 'chk-ir03-1', label: 'Original invoice vs. “-A” suffix voucher matched', verified: true },
      { id: 'chk-ir03-2', label: 'Vendor V-4471 statement / bank remittance verified', verified: false },
      { id: 'chk-ir03-3', label: 'Controller sign-off on recovery claim', verified: false },
    ],
    fiveWs: {
      who: 'Accounts payable clerk; counterparty steel supplier V-4471.',
      what: 'CAD $265,000 potential duplicate vendor invoice re-entered with “-A” suffix.',
      when: 'August 2026.',
      where: 'Procurement · Europe (Variable costs).',
      why: 'AP duplicate-matching rule did not normalize the “-A” invoice suffix.',
      how: 'Second payment posted to supplier V-4471 after manual invoice re-entry.',
    },
    auditTrail: [
      {
        id: 'AUD-IR03-1',
        timestamp: '2026-08-21 11:10 EST',
        actor: 'SKYGUARD Screening Engine',
        action: 'Auto-Flagged',
        note: 'Triggered >= CAD $250,000 screen and duplicate-invoice suffix heuristic (“-A” on V-4471).',
      },
    ],
  },
  {
    id: 'IR-04',
    provenance: 'Official case baseline',
    date: '2026-09-30',
    accountingPeriod: 'Q3 2026 (July–Sept)',
    department: 'Finance',
    plantAndRegion: 'Corporate',
    regionGroup: 'Corporate',
    title: 'Suspense account balance',
    amount: 340_000,
    costType: 'Trend',
    walkCategory: 'SG&A',
    glAccount: 'Account 2890 (Suspense) -> SG&A',
    vendorOrCounterparty: 'New plant report ERP batch import',
    preparer: 'Unknown (Not provided in case)',
    approvalState: 'Not Provided in Case',
    approvalRef: null,
    cause:
      'July–September 2026 ERP batch import contained unmapped cost centre codes from a new plant report; balance parked in Account 2890 and not cleared at close.',
    supportingEvidence:
      'Account 2890 suspense trial balance and ERP batch import rejection log.',
    verificationGaps:
      'Preparer unknown; underlying cost centre mapping and true expense nature must be verified before close sign-off.',
    operatingEarningsEffect:
      'Impacts Q3 2026 SG&A / operating earnings by CAD $340,000 pending cost-centre clearance.',
    linkedWalkLineId: null,
    recommendedSteps: [
      'Extract Account 2890 batch lines and trace unmapped cost centre codes to originating plant report.',
      'Re-map cost centres and clear suspense balance under controller supervision.',
    ],
    owner: 'Corporate Controller Team',
    status: 'New',
    humanCorrectionDecision: 'Pending',
    notes:
      'Uncleared suspense account at close; preparer unknown in source case.',
    evidenceChecklist: [
      { id: 'chk-ir04-1', label: 'ERP batch import rejection log extracted', verified: false },
      { id: 'chk-ir04-2', label: 'Unmapped cost centre codes assigned and cleared', verified: false },
    ],
    fiveWs: {
      who: 'Preparer unknown (not provided in case); affects Corporate Finance.',
      what: 'CAD $340,000 uncleared suspense balance parked in Account 2890.',
      when: 'Accumulated July–September 2026; left uncleared at Q3 close.',
      where: 'Corporate Finance (SG&A).',
      why: 'Unmapped cost centre codes from new plant report failed ERP mapping.',
      how: 'ERP batch import defaulted entries into suspense Account 2890.',
    },
    auditTrail: [
      {
        id: 'AUD-IR04-1',
        timestamp: '2026-09-30 18:15 EST',
        actor: 'SKYGUARD Screening Engine',
        action: 'Auto-Flagged',
        note: 'Triggered >= CAD $250,000 screen and uncleared suspense account (2890) at quarter-end.',
      },
    ],
  },
  {
    id: 'IR-05',
    provenance: 'Official case baseline',
    date: '2026-09-14',
    accountingPeriod: 'Q3 2026',
    department: 'Sales',
    plantAndRegion: 'Asia',
    regionGroup: 'Asia',
    title: 'Consultant payment with no purchase order',
    amount: 185_000,
    costType: 'One-time',
    walkCategory: 'SG&A',
    glAccount: 'SG&A (Consulting / Market Study)',
    vendorOrCounterparty: 'External Market Study Consultant',
    preparer: 'AP Manual Approval Entry',
    approvalState: 'Confirmed Missing',
    approvalRef: null,
    cause:
      'Unbudgeted market study paid in Q3 2026 via AP manual approval without a purchase order; approver was confirmed NOT recorded.',
    supportingEvidence:
      'AP manual payment voucher showing absent PO and confirmed missing approver field.',
    verificationGaps:
      'Approver is confirmed NOT recorded (distinct from merely unspecified); deliverable receipt and executive authorization must be obtained.',
    operatingEarningsEffect:
      'Reduces Q3 2026 operating earnings by CAD $185,000 in SG&A.',
    linkedWalkLineId: null,
    recommendedSteps: [
      'Obtain completed market study deliverable and contract scope.',
      'Secure retroactive VP Sales / CFO approval or escalate control exception.',
    ],
    owner: 'Sales Operations & AP',
    status: 'New',
    humanCorrectionDecision: 'Pending',
    notes:
      'Below CAD $250K amount threshold, but flagged strictly due to CONFIRMED missing approval reference and absent PO.',
    evidenceChecklist: [
      { id: 'chk-ir05-1', label: 'Market study deliverable verified', verified: false },
      { id: 'chk-ir05-2', label: 'Retroactive executive approver recorded', verified: false },
    ],
    fiveWs: {
      who: 'External consultant; approver is confirmed NOT recorded in AP ledger.',
      what: 'CAD $185,000 unbudgeted market study payment with no purchase order.',
      when: 'Q3 2026.',
      where: 'Sales · Asia (SG&A).',
      why: 'Unbudgeted market study processed outside standard PO workflow.',
      how: 'Paid via AP manual approval without a purchase order or recorded approver.',
    },
    auditTrail: [
      {
        id: 'AUD-IR05-1',
        timestamp: '2026-09-15 10:05 EST',
        actor: 'SKYGUARD Screening Engine',
        action: 'Control Exception Flag',
        note: 'Below $250K, flagged for CONFIRMED missing approval reference (no PO).',
      },
    ],
  },
  {
    id: 'IR-06',
    provenance: 'Official case baseline',
    date: '2026-07-06',
    accountingPeriod: 'Q3 2026 (Carried from Q2)',
    department: 'Finance',
    plantAndRegion: 'North America',
    regionGroup: 'North America',
    title: 'Warranty accrual not reversed',
    amount: 410_000,
    costType: 'One-time',
    walkCategory: 'Variable costs',
    glAccount: 'Variable Costs (Warranty Accrual)',
    vendorOrCounterparty: 'Corporate Controller Team',
    preparer: 'Corporate Controller’s Team',
    approvalState: 'Not Provided in Case',
    approvalRef: null,
    cause:
      'Q2 warranty accrual of CAD $410,000 was carried into Q3 because the automatic reversal flag was missing.',
    supportingEvidence:
      'Q2/Q3 warranty accrual rollforward showing missing auto-reversal flag.',
    verificationGaps:
      'Treat as potential earnings/accounting correction upon controller verification — NOT automatically cash recovered.',
    operatingEarningsEffect:
      'Affects Q3 2026 variable costs by CAD $410,000; potential non-cash accounting correction if Q2 liability was already settled or duplicated.',
    linkedWalkLineId: null,
    recommendedSteps: [
      'Reconcile Q2 warranty claims settled against the carried-forward CAD $410,000 accrual.',
      'Require human controller authorization before posting any reversal adjustment.',
    ],
    owner: 'Corporate Controller Team',
    status: 'Investigating',
    humanCorrectionDecision: 'Pending',
    notes:
      'Accounting correction candidate only — not automatic cash flow.',
    evidenceChecklist: [
      { id: 'chk-ir06-1', label: 'Q2 accrual entry and missing reversal flag confirmed', verified: true },
      { id: 'chk-ir06-2', label: 'Controller sign-off on Q3 true-up adjustment', verified: false },
    ],
    fiveWs: {
      who: 'Corporate controller’s team; specific individual approval not provided in case.',
      what: 'CAD $410,000 Q2 warranty accrual carried into Q3 without reversal.',
      when: 'Carried from Q2 into Q3 2026.',
      where: 'Finance · North America (Variable costs).',
      why: 'Reversal flag missing on Q2 period-end accrual.',
      how: 'Unreversed accrual remained on books into Q3 close.',
    },
    auditTrail: [
      {
        id: 'AUD-IR06-1',
        timestamp: '2026-07-10 08:40 EST',
        actor: 'SKYGUARD Screening Engine',
        action: 'Auto-Flagged',
        note: 'Triggered >= CAD $250,000 screen and stale accrual / missing reversal heuristic.',
      },
    ],
  },
  {
    id: 'IR-07',
    provenance: 'Official case baseline',
    date: '2026-09-22',
    accountingPeriod: 'Q3 2026 (September)',
    department: 'Customs and Trade',
    plantAndRegion: 'North America',
    regionGroup: 'North America',
    title: 'Broker fee for shipment not on file',
    amount: 118_000,
    costType: 'One-time',
    walkCategory: 'SG&A',
    glAccount: 'SG&A (Customs Broker Expense)',
    vendorOrCounterparty: 'Customs Broker',
    preparer: 'Not provided in case',
    approvalState: 'Not Provided in Case',
    approvalRef: null,
    cause:
      'September 2026 customs broker billing references a shipment number that does not match any ERP shipment record.',
    supportingEvidence:
      'Broker invoice referencing unmatched shipment ID.',
    verificationGaps:
      'Underlying customs entry, bill of lading, and ERP shipment match are missing; investigate supporting evidence without inventing an outcome.',
    operatingEarningsEffect:
      'Reduces Q3 2026 operating earnings by CAD $118,000 in SG&A pending shipment verification.',
    linkedWalkLineId: null,
    recommendedSteps: [
      'Request bill of lading and CBSA B3/CARM entry from customs broker.',
      'Cross-check against ERP receiving and E-01..E-12 shipment log.',
    ],
    owner: 'Marco (Trade & Customs Lead)',
    status: 'New',
    humanCorrectionDecision: 'Pending',
    notes:
      'Below $250K threshold, flagged by unmatched broker shipment heuristic.',
    evidenceChecklist: [
      { id: 'chk-ir07-1', label: 'ERP shipment log searched for billed reference', verified: true },
      { id: 'chk-ir07-2', label: 'Broker B3 customs entry & BOL received', verified: false },
    ],
    fiveWs: {
      who: 'Customs broker; internal preparer/approver not provided in case.',
      what: 'CAD $118,000 broker fee billed for a shipment number not on file in ERP.',
      when: 'September 2026.',
      where: 'Customs and Trade · North America (SG&A).',
      why: 'Billed shipment number fails to match any ERP shipment record.',
      how: 'Broker charge entered into SG&A without linked ERP shipment match.',
    },
    auditTrail: [
      {
        id: 'AUD-IR07-1',
        timestamp: '2026-09-23 13:20 EST',
        actor: 'SKYGUARD Screening Engine',
        action: 'Heuristic Flag',
        note: 'Flagged by unmatched broker shipment heuristic (no matching ERP shipment on file).',
      },
    ],
  },
];

// Section 1.2 & Section 1.3: Official Locked YoY and QoQ Operating Earnings Walks (CAD Thousands)
// Source amounts are confirmed from the Appendix; explanations are unverified until explicitly approved by a human reviewer.
export const OFFICIAL_YOY_WALK: EarningsWalk = {
  id: 'walk-yoy-q3-2026',
  provenance: 'Official case baseline',
  type: 'YoY',
  title: 'Q3 2025 -> Q3 2026 Year-over-Year Operating Earnings Walk',
  fromPeriod: 'Q3 2025',
  toPeriod: 'Q3 2026',
  startEarningsThousands: 15_200,
  endEarningsThousands: 20_700,
  lines: [
    {
      id: 'yoy-sales-vol',
      label: 'Sales: volume',
      amountThousands: 13_800,
      category: 'Sales',
      sourceReference: 'Section 1.2 · YoY Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Needs investigation',
      explanationText:
        'Source-confirmed bridge line (+CAD $13.8M >= $1M materiality threshold). Underlying driver mix by product or region is not provided in the Appendix and awaits human controller verification.',
      owner: 'Helen (Corporate Controller)',
      approvalDecision: 'Pending',
    },
    {
      id: 'yoy-sales-price',
      label: 'Sales: price',
      amountThousands: 2_400,
      category: 'Sales',
      sourceReference: 'Section 1.2 · YoY Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Needs investigation',
      explanationText:
        'Source-confirmed bridge line (+CAD $2.4M >= $1M materiality threshold). Supporting pricing realization schedule is not provided in the Appendix and awaits human verification.',
      owner: 'Helen (Corporate Controller)',
      approvalDecision: 'Pending',
    },
    {
      id: 'yoy-sales-fx',
      label: 'Sales: FX',
      amountThousands: 900,
      category: 'Sales',
      sourceReference: 'Section 1.2 · YoY Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Awaiting Verification',
      explanationText:
        'Source-confirmed FX sales variance (+CAD $900K; below $1M walk threshold). Currency pair breakdown is not provided in the Appendix.',
      owner: 'Treasury',
      approvalDecision: 'Pending',
    },
    {
      id: 'yoy-var-vol',
      label: 'Variable costs: volume',
      amountThousands: -6_300,
      category: 'Variable costs',
      sourceReference: 'Section 1.2 · YoY Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Needs investigation',
      explanationText:
        'Source-confirmed variable cost volume change (-CAD $6.3M >= $1M materiality threshold). Requires controller confirmation against Q3 unit production volume.',
      owner: 'Helen (Corporate Controller)',
      approvalDecision: 'Pending',
    },
    {
      id: 'yoy-var-mat',
      label: 'Variable costs: material prices',
      amountThousands: -900,
      category: 'Variable costs',
      sourceReference: 'Section 1.2 · YoY Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Awaiting Verification',
      explanationText:
        'Source-confirmed variable cost material price variance (-CAD $900K; below $1M walk threshold). Underlying commodity mix awaits procurement review.',
      owner: 'Procurement',
      approvalDecision: 'Pending',
    },
    {
      id: 'yoy-var-fx',
      label: 'Variable costs: FX',
      amountThousands: -400,
      category: 'Variable costs',
      sourceReference: 'Section 1.2 · YoY Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Awaiting Verification',
      explanationText:
        'Source-confirmed variable cost FX impact (-CAD $400K; below $1M walk threshold). Pending Treasury rate schedule confirmation.',
      owner: 'Treasury',
      approvalDecision: 'Pending',
    },
    {
      id: 'yoy-var-eff',
      label: 'Variable costs: efficiency gains',
      amountThousands: 500,
      category: 'Variable costs',
      sourceReference: 'Section 1.2 · YoY Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Awaiting Verification',
      explanationText:
        'Source-confirmed variable cost efficiency variance (+CAD $500K; below $1M walk threshold). Operational driver detail not provided in Appendix.',
      owner: 'Operations',
      approvalDecision: 'Pending',
    },
    {
      id: 'yoy-fixed-wage',
      label: 'Fixed plant: wage increases',
      amountThousands: -1_400,
      category: 'Fixed plant',
      sourceReference: 'Section 1.2 · YoY Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Needs investigation',
      explanationText:
        'Source-confirmed fixed plant wage increase (-CAD $1.4M >= $1M materiality threshold). Awaiting HR and Plant payroll schedule sign-off.',
      owner: 'Plant HR & Operations',
      approvalDecision: 'Pending',
    },
    {
      id: 'yoy-fixed-scrap',
      label: 'Fixed plant: one-time scrap (IR-01)',
      amountThousands: -900,
      category: 'Fixed plant',
      linkedIrIds: ['IR-01'],
      sourceReference: 'Section 1.2 & Section 2.3 · JE-260931 (IR-01)',
      sourceAmountConfirmed: true,
      explanationStatus: 'Needs investigation',
      explanationText:
        'Linked to IR-01 Plant 2 hydraulic cylinder weld scrap write-off (-CAD $900K). Below $1M walk materiality threshold (Section 4.1), but flagged under $250K transaction screen, Period 9 close timing, and missing QA/approval support.',
      owner: 'Dana (Plant Finance Lead)',
      approvalDecision: 'Pending',
    },
    {
      id: 'yoy-fixed-other',
      label: 'Fixed plant: other',
      amountThousands: -300,
      category: 'Fixed plant',
      sourceReference: 'Section 1.2 · YoY Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Awaiting Verification',
      explanationText:
        'Source-confirmed fixed plant other variance (-CAD $300K; below $1M walk threshold). Line breakdown not provided in Appendix.',
      owner: 'Plant Finance',
      approvalDecision: 'Pending',
    },
    {
      id: 'yoy-sga-rush',
      label: 'SG&A: rush freight (IR-02)',
      amountThousands: -600,
      category: 'SG&A',
      linkedIrIds: ['IR-02'],
      sourceReference: 'Section 1.2 & Section 2.3 · Weeks 30–35 (IR-02)',
      sourceAmountConfirmed: true,
      explanationStatus: 'Needs investigation',
      explanationText:
        'Linked to IR-02 late truck bookings across Weeks 30–35 coded to SG&A (-CAD $600K). Pending GL classification review (SG&A vs. Freight Out).',
      owner: 'Dana (Plant Finance Lead)',
      approvalDecision: 'Pending',
    },
    {
      id: 'yoy-sga-other',
      label: 'SG&A: other',
      amountThousands: -500,
      category: 'SG&A',
      sourceReference: 'Section 1.2 · YoY Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Awaiting Verification',
      explanationText:
        'Source-confirmed SG&A other variance (-CAD $500K; below $1M walk threshold). Requires close review against Section 2.3 SG&A irregular items.',
      owner: 'Corporate Finance',
      approvalDecision: 'Pending',
    },
    {
      id: 'yoy-amort',
      label: 'Amortization',
      amountThousands: -800,
      category: 'Amortization',
      sourceReference: 'Section 1.2 · YoY Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Awaiting Verification',
      explanationText:
        'Source-confirmed amortization variance (-CAD $800K; below $1M walk threshold). Fixed asset rollforward sign-off pending.',
      owner: 'Corporate Controller',
      approvalDecision: 'Pending',
    },
  ],
};

export const OFFICIAL_QOQ_WALK: EarningsWalk = {
  id: 'walk-qoq-q3-2026',
  provenance: 'Official case baseline',
  type: 'QoQ',
  title: 'Q2 2026 -> Q3 2026 Quarter-over-Quarter Operating Earnings Walk',
  fromPeriod: 'Q2 2026',
  toPeriod: 'Q3 2026',
  startEarningsThousands: 16_500,
  endEarningsThousands: 20_700,
  lines: [
    {
      id: 'qoq-sales-vol',
      label: 'Sales: volume',
      amountThousands: 8_400,
      category: 'Sales',
      sourceReference: 'Section 1.3 · QoQ Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Needs investigation',
      explanationText:
        'Source-confirmed sequential sales volume contribution (+CAD $8.4M >= $1M materiality threshold). Underlying product/region mix awaits controller verification.',
      owner: 'Helen (Corporate Controller)',
      approvalDecision: 'Pending',
    },
    {
      id: 'qoq-sales-price',
      label: 'Sales: price',
      amountThousands: 1_700,
      category: 'Sales',
      sourceReference: 'Section 1.3 · QoQ Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Needs investigation',
      explanationText:
        'Source-confirmed sequential sales price variance (+CAD $1.7M >= $1M materiality threshold). Commercial pricing support awaits verification.',
      owner: 'Helen (Corporate Controller)',
      approvalDecision: 'Pending',
    },
    {
      id: 'qoq-sales-fx',
      label: 'Sales: FX',
      amountThousands: 1_200,
      category: 'Sales',
      sourceReference: 'Section 1.3 · QoQ Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Needs investigation',
      explanationText:
        'Source-confirmed sequential FX revenue impact (+CAD $1.2M >= $1M materiality threshold). Awaiting Treasury FX schedule confirmation.',
      owner: 'Treasury & Controller',
      approvalDecision: 'Pending',
    },
    {
      id: 'qoq-var-vol',
      label: 'Variable costs: volume',
      amountThousands: -4_600,
      category: 'Variable costs',
      sourceReference: 'Section 1.3 · QoQ Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Needs investigation',
      explanationText:
        'Source-confirmed sequential variable cost volume scaling (-CAD $4.6M >= $1M materiality threshold). Pending standard-cost absorption sign-off.',
      owner: 'Helen (Corporate Controller)',
      approvalDecision: 'Pending',
    },
    {
      id: 'qoq-var-mat',
      label: 'Variable costs: material prices',
      amountThousands: -300,
      category: 'Variable costs',
      sourceReference: 'Section 1.3 · QoQ Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Awaiting Verification',
      explanationText:
        'Source-confirmed sequential material price variance (-CAD $300K; below $1M walk threshold). Pending procurement confirmation.',
      owner: 'Procurement',
      approvalDecision: 'Pending',
    },
    {
      id: 'qoq-var-fx',
      label: 'Variable costs: FX',
      amountThousands: -200,
      category: 'Variable costs',
      sourceReference: 'Section 1.3 · QoQ Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Awaiting Verification',
      explanationText:
        'Source-confirmed sequential COGS FX impact (-CAD $200K; below $1M walk threshold). Pending Treasury schedule.',
      owner: 'Treasury',
      approvalDecision: 'Pending',
    },
    {
      id: 'qoq-var-eff',
      label: 'Variable costs: efficiency gains',
      amountThousands: -100,
      category: 'Variable costs',
      sourceReference: 'Section 1.3 · QoQ Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Awaiting Verification',
      explanationText:
        'Source-confirmed sequential efficiency variance (-CAD $100K; below $1M walk threshold). Driver detail not provided in Appendix.',
      owner: 'Operations',
      approvalDecision: 'Pending',
    },
    {
      id: 'qoq-fixed-ot',
      label: 'Fixed plant: seasonal overtime',
      amountThousands: -700,
      category: 'Fixed plant',
      sourceReference: 'Section 1.3 · QoQ Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Awaiting Verification',
      explanationText:
        'Source-confirmed seasonal overtime (-CAD $700K; below $1M walk threshold). Pending plant payroll review.',
      owner: 'Plant Operations',
      approvalDecision: 'Pending',
    },
    {
      id: 'qoq-fixed-scrap',
      label: 'Fixed plant: one-time scrap',
      amountThousands: -600,
      category: 'Fixed plant',
      linkedIrIds: ['IR-01'],
      sourceReference: 'Section 1.3 & Section 2.3 · QoQ Incremental Scrap Allocation',
      sourceAmountConfirmed: true,
      explanationStatus: 'Needs investigation',
      explanationText:
        'QoQ walk allocates -CAD $600K incremental scrap vs. Q2 baseline (Appendix Section 1.3 preserves distinct QoQ vs. YoY allocation). Linked to IR-01.',
      owner: 'Dana (Plant Finance Lead)',
      approvalDecision: 'Pending',
    },
    {
      id: 'qoq-fixed-under',
      label: 'Fixed plant: underspend',
      amountThousands: 300,
      category: 'Fixed plant',
      sourceReference: 'Section 1.3 · QoQ Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Awaiting Verification',
      explanationText:
        'Source-confirmed fixed plant underspend (+CAD $300K; below $1M walk threshold). Pending overhead review.',
      owner: 'Plant Finance',
      approvalDecision: 'Pending',
    },
    {
      id: 'qoq-sga-rush',
      label: 'SG&A: rush freight',
      amountThousands: -400,
      category: 'SG&A',
      linkedIrIds: ['IR-02'],
      sourceReference: 'Section 1.3 & Section 2.3 · QoQ Incremental Rush Freight Allocation',
      sourceAmountConfirmed: true,
      explanationStatus: 'Needs investigation',
      explanationText:
        'QoQ walk allocates -CAD $400K incremental rush freight vs. Q2 baseline (distinct from YoY -CAD $600K in Section 1.2). Linked to IR-02.',
      owner: 'Dana (Plant Finance Lead)',
      approvalDecision: 'Pending',
    },
    {
      id: 'qoq-sga-other',
      label: 'SG&A: other',
      amountThousands: -200,
      category: 'SG&A',
      sourceReference: 'Section 1.3 · QoQ Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Awaiting Verification',
      explanationText:
        'Source-confirmed sequential SG&A other variance (-CAD $200K; below $1M walk threshold). Pending close review.',
      owner: 'Corporate Finance',
      approvalDecision: 'Pending',
    },
    {
      id: 'qoq-amort',
      label: 'Amortization',
      amountThousands: -300,
      category: 'Amortization',
      sourceReference: 'Section 1.3 · QoQ Operating Earnings Bridge',
      sourceAmountConfirmed: true,
      explanationStatus: 'Awaiting Verification',
      explanationText:
        'Source-confirmed sequential amortization variance (-CAD $300K; below $1M walk threshold). Pending asset schedule sign-off.',
      owner: 'Corporate Controller',
      approvalDecision: 'Pending',
    },
  ],
};

// Section 3.1 – 3.3: Official 12 Customs Entries (E-01 to E-12)
// Declared: $9,980,000 | Normal MFN: $126,250 | China Additional: $525,000 | Export: $60,000 | Total Duty: $711,250
// Expected Broker (0.2%): $19,960 | Billed Broker: $25,520 | Gross Over: $8,260 | Under (E-11): -$2,700 | Net Excess: $5,560
// Overall Duty + Tariff + Broker = $736,770
export const OFFICIAL_CUSTOMS_ENTRIES: CustomsEntry[] = [
  {
    id: 'E-01',
    provenance: 'Official case baseline',
    date: '2026-07-08',
    route: 'USA -> Guelph',
    originCountry: 'USA',
    destination: 'Guelph',
    isChinaAdditionalTariff: false,
    goods: 'steel plate',
    hsCode: '7208',
    declaredValue: 1_200_000,
    normalDutyRate: 0,
    chinaAdditionalTariffRate: 0,
    exportDutyRate: 0,
    dutyPolicyLabel: '0% CUSMA claimed',
    normalDutyAmount: 0,
    chinaAdditionalTariffAmount: 0,
    exportDutyAmount: 0,
    assessedDutyAndTariffs: 0,
    contractBrokerRate: 0.002,
    expectedBrokerFee: 2_400,
    billedBrokerFee: 2_400,
    brokerVariance: 0,
    brokerStatus: 'Compliant',
    ftaStatus: 'Agreement Claimed',
    ftaDocumented: true,
    potentialMissedClaimDuty: 0,
    evidence: 'CUSMA Certificate of Origin on file; broker invoice matches 0.2% contract.',
    notes: 'Compliant CUSMA zero-duty import and exact 0.2% contractual broker fee.',
  },
  {
    id: 'E-02',
    provenance: 'Official case baseline',
    date: '2026-07-15',
    route: 'Germany -> Guelph',
    originCountry: 'Germany',
    destination: 'Guelph',
    isChinaAdditionalTariff: false,
    goods: 'hydraulic cylinders',
    hsCode: '8412',
    declaredValue: 800_000,
    normalDutyRate: 0.025,
    chinaAdditionalTariffRate: 0,
    exportDutyRate: 0,
    dutyPolicyLabel: '2.5% normal',
    normalDutyAmount: 20_000,
    chinaAdditionalTariffAmount: 0,
    exportDutyAmount: 0,
    assessedDutyAndTariffs: 20_000,
    contractBrokerRate: 0.002,
    expectedBrokerFee: 1_600,
    billedBrokerFee: 1_600,
    brokerVariance: 0,
    brokerStatus: 'Compliant',
    ftaStatus: 'Unverified / Non-FTA',
    ftaDocumented: false,
    potentialMissedClaimDuty: 0,
    evidence: 'Standard 2.5% normal duty entry; 0.2% broker fee compliant.',
    notes: 'No missed FTA claim documented in official Appendix for E-02.',
  },
  {
    id: 'E-03',
    provenance: 'Official case baseline',
    date: '2026-07-22',
    route: 'Germany -> Guelph',
    originCountry: 'Germany',
    destination: 'Guelph',
    isChinaAdditionalTariff: false,
    goods: 'hydraulic cylinders',
    hsCode: '8412',
    declaredValue: 650_000,
    normalDutyRate: 0.025,
    chinaAdditionalTariffRate: 0,
    exportDutyRate: 0,
    dutyPolicyLabel: '2.5% normal',
    normalDutyAmount: 16_250,
    chinaAdditionalTariffAmount: 0,
    exportDutyAmount: 0,
    assessedDutyAndTariffs: 16_250,
    contractBrokerRate: 0.002,
    expectedBrokerFee: 1_300,
    billedBrokerFee: 1_300,
    brokerVariance: 0,
    brokerStatus: 'Compliant',
    ftaStatus: 'Unverified / Non-FTA',
    ftaDocumented: false,
    potentialMissedClaimDuty: 0,
    evidence: 'Standard 2.5% normal duty entry; 0.2% broker fee compliant.',
    notes: 'Compliant broker fee at CAD $1,300.',
  },
  {
    id: 'E-04',
    provenance: 'Official case baseline',
    date: '2026-08-03',
    route: 'China -> Guelph',
    originCountry: 'China',
    destination: 'Guelph',
    isChinaAdditionalTariff: true,
    goods: 'electric motors',
    hsCode: '8501',
    declaredValue: 900_000,
    normalDutyRate: 0.035,
    chinaAdditionalTariffRate: 0.25,
    exportDutyRate: 0,
    dutyPolicyLabel: '3.5% normal + 25% ADDITIONAL',
    normalDutyAmount: 31_500,
    chinaAdditionalTariffAmount: 225_000,
    exportDutyAmount: 0,
    assessedDutyAndTariffs: 256_500,
    contractBrokerRate: 0.002,
    expectedBrokerFee: 1_800,
    billedBrokerFee: 4_500,
    brokerVariance: 2_700,
    brokerStatus: 'Overcharge',
    ftaStatus: 'Unverified / Non-FTA',
    ftaDocumented: false,
    potentialMissedClaimDuty: 0,
    evidence: 'Broker billed CAD $4,500 (0.50%) vs. 0.20% contract benchmark (CAD $1,800) = +CAD $2,700 excess.',
    notes: 'Key China tariff + broker overcharge case study entry (Marco scenario).',
  },
  {
    id: 'E-05',
    provenance: 'Official case baseline',
    date: '2026-08-12',
    route: 'China -> Guelph',
    originCountry: 'China',
    destination: 'Guelph',
    isChinaAdditionalTariff: true,
    goods: 'control modules',
    hsCode: '8537',
    declaredValue: 500_000,
    normalDutyRate: 0,
    chinaAdditionalTariffRate: 0.25,
    exportDutyRate: 0,
    dutyPolicyLabel: '0% normal + 25% ADDITIONAL',
    normalDutyAmount: 0,
    chinaAdditionalTariffAmount: 125_000,
    exportDutyAmount: 0,
    assessedDutyAndTariffs: 125_000,
    contractBrokerRate: 0.002,
    expectedBrokerFee: 1_000,
    billedBrokerFee: 2_500,
    brokerVariance: 1_500,
    brokerStatus: 'Overcharge',
    ftaStatus: 'Unverified / Non-FTA',
    ftaDocumented: false,
    potentialMissedClaimDuty: 0,
    evidence: 'Broker billed CAD $2,500 vs. expected CAD $1,000 (+CAD $1,500 overcharge).',
    notes: '0% normal MFN + 25% additional China practice tariff.',
  },
  {
    id: 'E-06',
    provenance: 'Official case baseline',
    date: '2026-08-21',
    route: 'China -> Guelph',
    originCountry: 'China',
    destination: 'Guelph',
    isChinaAdditionalTariff: true,
    goods: 'electric motors',
    hsCode: '8501',
    declaredValue: 700_000,
    normalDutyRate: 0.035,
    chinaAdditionalTariffRate: 0.25,
    exportDutyRate: 0,
    dutyPolicyLabel: '3.5% normal + 25% ADDITIONAL',
    normalDutyAmount: 24_500,
    chinaAdditionalTariffAmount: 175_000,
    exportDutyAmount: 0,
    assessedDutyAndTariffs: 199_500,
    contractBrokerRate: 0.002,
    expectedBrokerFee: 1_400,
    billedBrokerFee: 3_500,
    brokerVariance: 2_100,
    brokerStatus: 'Overcharge',
    ftaStatus: 'Unverified / Non-FTA',
    ftaDocumented: false,
    potentialMissedClaimDuty: 0,
    evidence: 'Broker billed CAD $3,500 vs. expected CAD $1,400 (+CAD $2,100 overcharge).',
    notes: '3.5% normal MFN duty + 25% additional China practice tariff.',
  },
  {
    id: 'E-07',
    provenance: 'Official case baseline',
    date: '2026-08-27',
    route: 'Italy -> Guelph',
    originCountry: 'Italy',
    destination: 'Guelph',
    isChinaAdditionalTariff: false,
    goods: 'scissor-arm parts',
    hsCode: '7326',
    declaredValue: 420_000,
    normalDutyRate: 0.029,
    chinaAdditionalTariffRate: 0,
    exportDutyRate: 0,
    dutyPolicyLabel: '2.9% normal',
    normalDutyAmount: 12_180,
    chinaAdditionalTariffAmount: 0,
    exportDutyAmount: 0,
    assessedDutyAndTariffs: 12_180,
    contractBrokerRate: 0.002,
    expectedBrokerFee: 840,
    billedBrokerFee: 1_100,
    brokerVariance: 260,
    brokerStatus: 'Overcharge',
    ftaStatus: 'Unverified / Non-FTA',
    ftaDocumented: false,
    potentialMissedClaimDuty: 0,
    evidence: 'Broker billed CAD $1,100 vs. expected CAD $840 (+CAD $260 overcharge).',
    notes: '2.9% normal MFN rate.',
  },
  {
    id: 'E-08',
    provenance: 'Official case baseline',
    date: '2026-09-04',
    route: 'Mexico -> Guelph',
    originCountry: 'Mexico',
    destination: 'Guelph',
    isChinaAdditionalTariff: false,
    goods: 'wire harnesses',
    hsCode: '8544',
    declaredValue: 380_000,
    normalDutyRate: 0.029,
    chinaAdditionalTariffRate: 0,
    exportDutyRate: 0,
    dutyPolicyLabel: '2.9% normal; CUSMA NOT claimed',
    normalDutyAmount: 11_020,
    chinaAdditionalTariffAmount: 0,
    exportDutyAmount: 0,
    assessedDutyAndTariffs: 11_020,
    contractBrokerRate: 0.002,
    expectedBrokerFee: 760,
    billedBrokerFee: 950,
    brokerVariance: 190,
    brokerStatus: 'Overcharge',
    ftaStatus: 'Potential Eligible / Unclaimed',
    ftaDocumented: false,
    potentialMissedClaimDuty: 11_020,
    evidence: '2.9% MFN duty (CAD $11,020) assessed because CUSMA origin certificate was not claimed at entry; +CAD $190 broker overcharge.',
    notes: 'Documented POSSIBLE missed CUSMA trade agreement claim (CAD $11,020), conditional on valid supplier origin documentation and remediation — NOT a guaranteed refund.',
  },
  {
    id: 'E-09',
    provenance: 'Official case baseline',
    date: '2026-09-10',
    route: 'Japan -> Guelph',
    originCountry: 'Japan',
    destination: 'Guelph',
    isChinaAdditionalTariff: false,
    goods: 'engine parts',
    hsCode: '8408',
    declaredValue: 290_000,
    normalDutyRate: 0,
    chinaAdditionalTariffRate: 0,
    exportDutyRate: 0,
    dutyPolicyLabel: '0% CPTPP',
    normalDutyAmount: 0,
    chinaAdditionalTariffAmount: 0,
    exportDutyAmount: 0,
    assessedDutyAndTariffs: 0,
    contractBrokerRate: 0.002,
    expectedBrokerFee: 580,
    billedBrokerFee: 870,
    brokerVariance: 290,
    brokerStatus: 'Overcharge',
    ftaStatus: 'Agreement Claimed',
    ftaDocumented: true,
    potentialMissedClaimDuty: 0,
    evidence: 'CPTPP 0% duty properly claimed; broker billed CAD $870 vs. expected CAD $580 (+CAD $290 excess).',
    notes: 'Preferential CPTPP 0% rate verified.',
  },
  {
    id: 'E-10',
    provenance: 'Official case baseline',
    date: '2026-09-17',
    route: 'Guelph -> Brisbane, DDP',
    originCountry: 'Canada',
    destination: 'Brisbane (DDP)',
    incoterm: 'DDP',
    isChinaAdditionalTariff: false,
    goods: 'boom lifts',
    hsCode: '8427',
    declaredValue: 1_500_000,
    normalDutyRate: 0,
    chinaAdditionalTariffRate: 0,
    exportDutyRate: 0.04,
    dutyPolicyLabel: '4.0% EXPORT duty',
    normalDutyAmount: 0,
    chinaAdditionalTariffAmount: 0,
    exportDutyAmount: 60_000,
    assessedDutyAndTariffs: 60_000,
    contractBrokerRate: 0.002,
    expectedBrokerFee: 3_000,
    billedBrokerFee: 3_800,
    brokerVariance: 800,
    brokerStatus: 'Overcharge',
    ftaStatus: 'Unverified / Non-FTA',
    ftaDocumented: false,
    potentialMissedClaimDuty: 0,
    evidence: 'DDP export shipment: SKYJACK as seller bears 4.0% destination/export duty (CAD $60,000); +CAD $800 broker overcharge.',
    notes: 'Under DDP (Delivered Duty Paid), the seller bears export/import clearance duties unlike DAP.',
  },
  {
    id: 'E-11',
    provenance: 'Official case baseline',
    date: '2026-09-22',
    route: 'Guelph -> Chicago, DAP',
    originCountry: 'Canada',
    destination: 'Chicago (DAP)',
    incoterm: 'DAP',
    isChinaAdditionalTariff: false,
    goods: 'scissor lifts',
    hsCode: '8427',
    declaredValue: 2_400_000,
    normalDutyRate: 0,
    chinaAdditionalTariffRate: 0,
    exportDutyRate: 0,
    dutyPolicyLabel: '0% CUSMA',
    normalDutyAmount: 0,
    chinaAdditionalTariffAmount: 0,
    exportDutyAmount: 0,
    assessedDutyAndTariffs: 0,
    contractBrokerRate: 0.002,
    expectedBrokerFee: 4_800,
    billedBrokerFee: 2_100,
    brokerVariance: -2_700,
    brokerStatus: 'Undercharge',
    ftaStatus: 'Agreement Claimed',
    ftaDocumented: true,
    potentialMissedClaimDuty: 0,
    evidence: 'DAP shipment with CUSMA 0%; broker billed CAD $2,100 vs. expected CAD $4,800 (-CAD $2,700 undercharge).',
    notes: 'Under DAP (Delivered at Place), buyer handles import customs duty; broker billed CAD $2,700 below 0.2% formula, offsetting gross overcharges from $8,260 to $5,560 net.',
  },
  {
    id: 'E-12',
    provenance: 'Official case baseline',
    date: '2026-09-28',
    route: 'South Korea -> Guelph',
    originCountry: 'South Korea',
    destination: 'Guelph',
    isChinaAdditionalTariff: false,
    goods: 'bearings',
    hsCode: '8482',
    declaredValue: 240_000,
    normalDutyRate: 0.045,
    chinaAdditionalTariffRate: 0,
    exportDutyRate: 0,
    dutyPolicyLabel: '4.5% normal',
    normalDutyAmount: 10_800,
    chinaAdditionalTariffAmount: 0,
    exportDutyAmount: 0,
    assessedDutyAndTariffs: 10_800,
    contractBrokerRate: 0.002,
    expectedBrokerFee: 480,
    billedBrokerFee: 900,
    brokerVariance: 420,
    brokerStatus: 'Overcharge',
    ftaStatus: 'Unverified / Non-FTA',
    ftaDocumented: false,
    potentialMissedClaimDuty: 0,
    evidence: '4.5% normal duty (CAD $10,800); broker billed CAD $900 vs. expected CAD $480 (+CAD $420 excess).',
    notes: 'No missed FTA claim documented in Appendix.',
  },
];

// Section 3.5: Interprovincial Sales and Freight (Total sales $7,300,000 | Customer Tax $799,525 | Freight $95,400)
export const OFFICIAL_INTERPROVINCIAL_DELIVERIES: InterprovincialDelivery[] = [
  {
    id: 'IP-01',
    provenance: 'Official case baseline',
    date: '2026-07-24',
    destination: 'Calgary, AB',
    provinceCode: 'AB',
    salesAmount: 2_200_000,
    taxLabel: 'GST 5%',
    taxRateDecimal: 0.05,
    customerSalesTax: 110_000,
    freightExpense: 18_400,
    notes: 'Domestic Canadian delivery (no customs duty). GST 5% collected from customer.',
  },
  {
    id: 'IP-02',
    provenance: 'Official case baseline',
    date: '2026-08-11',
    destination: 'Vancouver, BC',
    provinceCode: 'BC',
    salesAmount: 1_600_000,
    taxLabel: 'GST 5% + PST 7%',
    taxRateDecimal: 0.12,
    customerSalesTax: 192_000,
    freightExpense: 27_900,
    notes: 'Domestic Canadian delivery (no customs duty). Customer sales tax remitted to tax authorities.',
  },
  {
    id: 'IP-03',
    provenance: 'Official case baseline',
    date: '2026-08-29',
    destination: 'Montreal, QC',
    provinceCode: 'QC',
    salesAmount: 1_900_000,
    taxLabel: 'GST 5% + QST 9.975%',
    taxRateDecimal: 0.14975,
    customerSalesTax: 284_525,
    freightExpense: 19_600,
    notes: 'Domestic Canadian delivery (no customs duty). QST 9.975% + GST 5% collected from customer.',
  },
  {
    id: 'IP-04',
    provenance: 'Official case baseline',
    date: '2026-09-09',
    destination: 'Halifax, NS',
    provinceCode: 'NS',
    salesAmount: 700_000,
    taxLabel: 'HST 15%',
    taxRateDecimal: 0.15,
    customerSalesTax: 105_000,
    freightExpense: 14_300,
    notes: 'Domestic Canadian delivery (no customs duty). HST 15% collected from customer.',
  },
  {
    id: 'IP-05',
    provenance: 'Official case baseline',
    date: '2026-09-21',
    destination: 'Winnipeg, MB',
    provinceCode: 'MB',
    salesAmount: 900_000,
    taxLabel: 'GST 5% + RST 7%',
    taxRateDecimal: 0.12,
    customerSalesTax: 108_000,
    freightExpense: 15_200,
    notes: 'Domestic Canadian delivery (no customs duty). GST 5% + RST 7% collected from customer.',
  },
];

export const OFFICIAL_TARIFF_RULES: TariffRateRule[] = [
  {
    id: 'RULE-CHINA-2026',
    provenance: 'Official case baseline',
    countryOrScope: 'China',
    goodsOrHsFilter: '8501 / 8537 (Motors & Control Modules)',
    rateKind: 'Additional China Practice Tariff',
    rateDecimal: 0.25,
    effectiveDate: '2026-01-01',
    endDate: null,
    sourceNote: 'Section 3.4 / 4.1 fictional case assumption starting Q1 2026; does NOT apply to non-China entries.',
    version: 1,
    updatedAt: '2026-01-01',
  },
  {
    id: 'RULE-BROKER-CONTRACT',
    provenance: 'Official case baseline',
    countryOrScope: 'All Customs Entries',
    goodsOrHsFilter: 'All HS Codes',
    rateKind: 'Broker Contract',
    rateDecimal: 0.002,
    effectiveDate: '2025-01-01',
    endDate: null,
    sourceNote: 'Section 3.3 / 4.1 contractual customs broker schedule: 0.20% of declared value.',
    version: 1,
    updatedAt: '2025-01-01',
  },
  {
    id: 'RULE-MOTOR-MFN',
    provenance: 'Official case baseline',
    countryOrScope: 'China',
    goodsOrHsFilter: '8501 (Electric Motors)',
    rateKind: 'Normal MFN',
    rateDecimal: 0.035,
    effectiveDate: '2025-01-01',
    endDate: null,
    sourceNote: 'Section 3.2 ordinary MFN motor rate (separate from 25% additional tariff).',
    version: 1,
    updatedAt: '2025-01-01',
  },
  {
    id: 'RULE-EXPORT-DDP',
    provenance: 'Official case baseline',
    countryOrScope: 'Canada -> Brisbane (DDP)',
    goodsOrHsFilter: '8427 (Boom Lifts)',
    rateKind: 'Export Duty',
    rateDecimal: 0.04,
    effectiveDate: '2026-01-01',
    endDate: null,
    sourceNote: 'Section 3.2 fictional 4.0% DDP export duty assumption for E-10.',
    version: 1,
    updatedAt: '2026-01-01',
  },
];

export const DEFAULT_CLOSE_CHECKLIST: CloseChecklistItem[] = [
  {
    id: 'cl-1',
    label: 'Reconcile Q3 2025 -> Q3 2026 YoY Walk (+CAD $5.5M) exactly to $0.00 variance',
    completed: true,
    owner: 'Helen (Corporate Controller)',
  },
  {
    id: 'cl-2',
    label: 'Reconcile Q2 2026 -> Q3 2026 QoQ Walk (+CAD $4.2M) exactly to $0.00 variance',
    completed: true,
    owner: 'Helen (Corporate Controller)',
  },
  {
    id: 'cl-3',
    label: 'Verify all material walk lines >= CAD $1,000,000 have signed owner explanations',
    completed: false,
    owner: 'Helen (Corporate Controller)',
  },
  {
    id: 'cl-4',
    label: 'Resolve or clear all unreviewed IR-01..IR-07 control & missing-approval exceptions',
    completed: false,
    owner: 'Dana (Plant Finance Lead)',
  },
  {
    id: 'cl-5',
    label: 'Confirm E-01..E-12 customs accruals exclude domestic interprovincial customer sales tax',
    completed: true,
    owner: 'Marco (Trade & Customs Lead)',
  },
];

export const PRESENTATION_ROI_DISCLAIMER =
  "Illustrative year-one economic-value model for Group 7's competition presentation. These are not guaranteed SKYJACK savings. Assumptions must be validated through a controlled pilot.";

export const DEFAULT_PRESENTATION_ROI_ASSUMPTIONS: PresentationROIYear1Assumptions = {
  appDevAndConfigCost: 45_000,
  erpIntegrationSecurityCost: 30_000,
  staffTrainingCost: 10_000,
  cloudOpsSupportCost: 25_000,
  duplicateInvoiceBaseCAD: 265_000, // Official Appendix IR-03 duplicate invoice
  duplicateRecoveryPct: 25,
  hoursFreedAnnually: 600,
  fullyLoadedHourlyRate: 60,
  rushFreightQuarterlyBaseCAD: 600_000, // Official Appendix IR-02 Q3 rush freight
  rushFreightQuartersPerYear: 4,
  rushFreightAvoidablePct: 1,
  brokerNetExcessQuarterlyCAD: 5_560, // Official Appendix Q3 net broker excess
  brokerQuartersPerYear: 4,
  brokerRecoveryPct: 50,
};

export const DEFAULT_ROI_ASSUMPTIONS: ROIAssumptions = {
  implementationCost: 110_000,
  monthlyMaintenance: 2_500,
  employeeTrainingCost: 18_000,
  annualIncidentCount: 28,
  hoursSavedPerIncident: 6,
  analystHourlyRate: 78,
  brokerRecoveryBasis: 'net',
  brokerRecoveryLikelihoodPct: 75,
  duplicateRecoveryLikelihoodPct: 50,
  missedFtaRecoveryLikelihoodPct: 50,
  annualPreventedLeakageBase: 160_000,
  adoptionFactorPct: 75,
  year1RampUpPct: 70,
};

// Transparent Deterministic Anomaly Screening Engine (runs immediately on add/import/render)
export function normalizeInvoiceRef(raw?: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .toUpperCase()
    .replace(/[-_/](A|B|C|REV\d*|DUP)$/i, '')
    .replace(/[^A-Z0-9]/g, '');
}

export function screenIrregularCost(
  item: IrregularCostItem,
  allItems: IrregularCostItem[],
  customsEntries: CustomsEntry[] = OFFICIAL_CUSTOMS_ENTRIES
): ScreeningFlag[] {
  const flags: ScreeningFlag[] = [];

  if (item.amount >= CASE_CONSTANTS.TRANSACTION_ALERT_THRESHOLD_CAD) {
    flags.push({
      ruleId: 'R-250K',
      ruleName: 'Entry >= CAD $250,000',
      severity: 'High',
      rationale: `Transaction amount (${formatCAD(item.amount)}) meets or exceeds the CAD $250,000 entry screening threshold (distinct from the CAD $1M walk materiality rule).`,
    });
  }

  if (item.approvalState === 'Confirmed Missing') {
    flags.push({
      ruleId: 'R-NO-APPROVAL',
      ruleName: 'Approval Confirmed Missing',
      severity: 'High',
      rationale: 'Approval reference is confirmed missing/not recorded in AP/ERP ledger.',
    });
  } else if (item.approvalState === 'Not Provided in Case' && !item.approvalRef) {
    flags.push({
      ruleId: 'R-SUPPORT-GAP',
      ruleName: 'Approval / Support Requires Review',
      severity: 'Review',
      rationale: 'Approval reference not provided in source record; requires evidence verification before close.',
    });
  }

  // Duplicate invoice suffix / vendor match check
  const textBlob = `${item.title} ${item.cause} ${item.invoiceNumber ?? ''}`.toLowerCase();
  const hasSuffixDuplicate =
    textBlob.includes('duplicate') ||
    textBlob.includes('“-a”') ||
    textBlob.includes('"-a"') ||
    /-a\b/i.test(item.invoiceNumber ?? '');

  const normCurrent = normalizeInvoiceRef(item.invoiceNumber);
  const matchingNormalizedPeer =
    normCurrent.length >= 4 &&
    allItems.some(
      (other) =>
        other.id !== item.id &&
        other.vendorOrCounterparty.toLowerCase() === item.vendorOrCounterparty.toLowerCase() &&
        normalizeInvoiceRef(other.invoiceNumber) === normCurrent
    );

  if (hasSuffixDuplicate || matchingNormalizedPeer) {
    flags.push({
      ruleId: 'R-DUP-INV',
      ruleName: 'Possible Duplicate Invoice',
      severity: 'High',
      rationale: 'Normalized invoice pattern or “-A” suffix matches potential duplicate vendor billing; human verification required.',
    });
  }

  // Unusual posting period / late close timing
  const dayNum = Number(item.date.split('-')[2] || '0');
  const isQuarterEndDay =
    (item.date.endsWith('-09-29') || item.date.endsWith('-09-30') || item.date.endsWith('-12-30') || item.date.endsWith('-12-31') || dayNum >= 29) &&
    (item.cause.toLowerCase().includes('manual journal') || item.accountingPeriod.toLowerCase().includes('period 9') || item.cause.toLowerCase().includes('close'));
  if (isQuarterEndDay) {
    flags.push({
      ruleId: 'R-TIMING',
      ruleName: 'Late Period-End Posting Timing',
      severity: 'Medium',
      rationale: 'Manual journal or period-end entry posted at quarter close (day 29–30); verify cutoff & approval support.',
    });
  }

  // Unusual large scrap or inventory write-off (distinct from prior-period accrual reversal)
  if (
    item.title.toLowerCase().includes('scrap') ||
    item.cause.toLowerCase().includes('scrap') ||
    item.glAccount.includes('6410')
  ) {
    flags.push({
      ruleId: 'R-SCRAP',
      ruleName: 'Unusual Scrap / Inventory Write-Off',
      severity: 'Medium',
      rationale: 'Large manual inventory scrap write-off (GL 6410); requires QA inspection report and operational sign-off.',
    });
  }

  // GL account / category mismatch
  if (
    item.glAccount.toLowerCase().includes('sg&a') &&
    (item.department.toLowerCase().includes('logistics') || item.title.toLowerCase().includes('freight'))
  ) {
    flags.push({
      ruleId: 'R-GL-MISMATCH',
      ruleName: 'GL Account / Category Mismatch',
      severity: 'Medium',
      rationale: 'Freight-related cost coded to SG&A rather than Freight Out / COGS; requires classification review.',
    });
  }

  // Missing accrual reversal — strictly scoped to accrued expenses / prior-period accrual carried forward
  // Prevents false-positive match on IR-01 ("no reversal reference" on a scrap write-off, not an accrual).
  const isAccrualContext =
    item.title.toLowerCase().includes('accrual') ||
    item.cause.toLowerCase().includes('accrual') ||
    item.glAccount.toLowerCase().includes('accrual');
  const hasMissingReversalIndicator =
    item.title.toLowerCase().includes('not reversed') ||
    item.cause.toLowerCase().includes('reversal flag') ||
    item.cause.toLowerCase().includes('without reversal') ||
    item.cause.toLowerCase().includes('unreversed') ||
    (item.cause.toLowerCase().includes('carried into') && item.cause.toLowerCase().includes('reversal'));
  if (isAccrualContext && hasMissingReversalIndicator) {
    flags.push({
      ruleId: 'R-NO-REV',
      ruleName: 'Missing Accrual Reversal',
      severity: 'Medium',
      rationale: 'Prior-period accrual carried forward with missing reversal flag; evaluate accounting correction.',
    });
  }

  // Uncleared suspense
  if (
    item.title.toLowerCase().includes('suspense') ||
    item.glAccount.includes('2890')
  ) {
    flags.push({
      ruleId: 'R-SUSPENSE',
      ruleName: 'Uncleared Suspense Balance',
      severity: 'High',
      rationale: 'Unmapped cost-centre import parked in suspense account at close without preparer attribution.',
    });
  }

  // Broker shipment without matching ERP source
  if (
    item.cause.toLowerCase().includes('does not match') ||
    item.title.toLowerCase().includes('not on file') ||
    (item.department.toLowerCase().includes('customs') &&
      !customsEntries.some((c) => item.cause.includes(c.id)))
  ) {
    flags.push({
      ruleId: 'R-UNMATCHED-SHIP',
      ruleName: 'Unmatched Broker Shipment',
      severity: 'Medium',
      rationale: 'Customs broker billing lacks a matching shipment record in the E-01..E-12 / ERP ledger.',
    });
  }

  // Cost spike vs baseline (> $500K for user-added or trend items)
  if (item.provenance === 'User-added scenario' && item.amount >= 500_000) {
    flags.push({
      ruleId: 'R-SPIKE',
      ruleName: 'Material Cost Spike vs. Baseline',
      severity: 'High',
      rationale: `Provisional entry (${formatCAD(item.amount)}) exceeds CAD $500,000 single-incident spike benchmark.`,
    });
  }

  return flags;
}

export function getActiveScreeningFlags(
  item: IrregularCostItem,
  allItems: IrregularCostItem[],
  customsEntries: CustomsEntry[] = OFFICIAL_CUSTOMS_ENTRIES
): ScreeningFlag[] {
  const allFlags = screenIrregularCost(item, allItems, customsEntries);
  const dismissedIds = new Set((item.dismissedRules ?? []).map((d) => d.ruleId));
  return allFlags.filter((f) => !dismissedIds.has(f.ruleId));
}

export function isEntryScreenedFlagged(
  item: IrregularCostItem,
  allItems: IrregularCostItem[],
  customsEntries: CustomsEntry[] = OFFICIAL_CUSTOMS_ENTRIES
): boolean {
  return getActiveScreeningFlags(item, allItems, customsEntries).length > 0;
}

// Practice Tariff & Broker Rule Engine (non-mutating working calculations & change impact preview)
export interface TariffRuleImpactRow {
  entryId: string;
  date: string;
  route: string;
  originCountry: string;
  hsCode: string;
  goods: string;
  declaredValue: number;
  historicalRecordedCostCAD: number;
  currentRuleExpectedCostCAD: number;
  proposedRuleExpectedCostCAD: number;
  deltaCAD: number;
}

export interface TariffRuleImpactPreview {
  affectedEntries: TariffRuleImpactRow[];
  affectedCount: number;
  currentTotalExpectedCAD: number;
  proposedTotalExpectedCAD: number;
  netDeltaCAD: number;
}

function matchesRuleForEntry(rule: TariffRateRule, entry: CustomsEntry): boolean {
  const scope = rule.countryOrScope.toLowerCase();
  const hsFilter = rule.goodsOrHsFilter.toLowerCase();
  const isDateInRange =
    entry.date >= rule.effectiveDate && (!rule.endDate || entry.date <= rule.endDate);
  if (!isDateInRange) return false;

  if (rule.rateKind === 'Broker Contract') {
    return scope.includes('all') || entry.originCountry.toLowerCase().includes(scope) || entry.route.toLowerCase().includes(scope);
  }
  if (rule.rateKind === 'Additional China Practice Tariff') {
    return entry.isChinaAdditionalTariff && (scope.includes('china') || scope.includes('all'));
  }
  if (rule.rateKind === 'Export Duty') {
    return (entry.incoterm === 'DDP' || entry.exportDutyRate > 0) && (hsFilter.includes(entry.hsCode) || scope.includes(entry.destination.toLowerCase().split(' ')[0]) || hsFilter.includes('all'));
  }
  // Normal MFN
  const countryMatch =
    scope.includes('all') ||
    entry.originCountry.toLowerCase() === scope ||
    entry.route.toLowerCase().includes(scope);
  const hsMatch =
    hsFilter.includes('all') ||
    hsFilter.includes(entry.hsCode.toLowerCase()) ||
    hsFilter.includes(entry.goods.toLowerCase());
  return countryMatch && hsMatch;
}

export function computeExpectedEntryCostsFromRules(
  entry: CustomsEntry,
  rules: TariffRateRule[]
): {
  normalDuty: number;
  chinaTariff: number;
  exportDuty: number;
  expectedBroker: number;
  expectedAllInCost: number;
} {
  let normalRate = entry.normalDutyRate;
  let chinaRate = entry.chinaAdditionalTariffRate;
  let exportRate = entry.exportDutyRate;
  let brokerRate = entry.contractBrokerRate;

  for (const rule of rules) {
    if (!matchesRuleForEntry(rule, entry)) continue;
    if (rule.rateKind === 'Normal MFN') {
      normalRate = entry.ftaDocumented && entry.ftaStatus === 'Agreement Claimed' ? 0 : rule.rateDecimal;
    } else if (rule.rateKind === 'Additional China Practice Tariff') {
      chinaRate = rule.rateDecimal;
    } else if (rule.rateKind === 'Export Duty') {
      exportRate = rule.rateDecimal;
    } else if (rule.rateKind === 'Broker Contract') {
      brokerRate = rule.rateDecimal;
    }
  }

  const normalDuty = Math.round(entry.declaredValue * normalRate);
  const chinaTariff = Math.round(entry.declaredValue * chinaRate);
  const exportDuty = Math.round(entry.declaredValue * exportRate);
  const expectedBroker = Math.round(entry.declaredValue * brokerRate);
  return {
    normalDuty,
    chinaTariff,
    exportDuty,
    expectedBroker,
    expectedAllInCost: normalDuty + chinaTariff + exportDuty + expectedBroker,
  };
}

export function previewTariffRuleImpact(
  proposedRule: TariffRateRule,
  currentRules: TariffRateRule[],
  entries: CustomsEntry[]
): TariffRuleImpactPreview {
  const withoutOldSame = currentRules.filter((r) => r.id !== proposedRule.id);
  const nextRules = [proposedRule, ...withoutOldSame];

  const affectedEntries: TariffRuleImpactRow[] = [];
  for (const entry of entries) {
    if (!matchesRuleForEntry(proposedRule, entry)) continue;
    const before = computeExpectedEntryCostsFromRules(entry, currentRules);
    const after = computeExpectedEntryCostsFromRules(entry, nextRules);
    affectedEntries.push({
      entryId: entry.id,
      date: entry.date,
      route: entry.route,
      originCountry: entry.originCountry,
      hsCode: entry.hsCode,
      goods: entry.goods,
      declaredValue: entry.declaredValue,
      historicalRecordedCostCAD: entry.assessedDutyAndTariffs + entry.billedBrokerFee,
      currentRuleExpectedCostCAD: before.expectedAllInCost,
      proposedRuleExpectedCostCAD: after.expectedAllInCost,
      deltaCAD: after.expectedAllInCost - before.expectedAllInCost,
    });
  }

  const currentTotalExpectedCAD = affectedEntries.reduce((s, r) => s + r.currentRuleExpectedCostCAD, 0);
  const proposedTotalExpectedCAD = affectedEntries.reduce((s, r) => s + r.proposedRuleExpectedCostCAD, 0);

  return {
    affectedEntries,
    affectedCount: affectedEntries.length,
    currentTotalExpectedCAD,
    proposedTotalExpectedCAD,
    netDeltaCAD: proposedTotalExpectedCAD - currentTotalExpectedCAD,
  };
}

// China Additional Tariff Simulation (strictly over actual isChinaAdditionalTariff entries)
export interface TariffSimulationResult {
  chinaAdditionalRateDecimal: number;
  chinaDeclaredValueQ3: number;
  chinaCount: number;
  baselineChinaAdditionalTariffQ3: number;
  simulatedChinaAdditionalTariffQ3: number;
  ordinaryChinaMotorDutyQ3: number;
  quarterlyDelta: number;
  annualizedDelta: number;
  baselineTotalTradeCostQ3: number;
  simulatedTotalTradeCostQ3: number;
}

export function calculateChinaTariffSimulation(
  entries: CustomsEntry[],
  simulatedAdditionalRateDecimal: number
): TariffSimulationResult {
  const chinaEntries = entries.filter((e) => e.isChinaAdditionalTariff);
  const chinaDeclaredValueQ3 = chinaEntries.reduce((s, e) => s + e.declaredValue, 0);
  const baselineChinaAdditionalTariffQ3 = chinaEntries.reduce(
    (s, e) => s + e.chinaAdditionalTariffAmount,
    0
  );
  const ordinaryChinaMotorDutyQ3 = chinaEntries.reduce(
    (s, e) => s + e.normalDutyAmount,
    0
  );
  const simulatedChinaAdditionalTariffQ3 = Math.round(
    chinaDeclaredValueQ3 * simulatedAdditionalRateDecimal
  );
  const quarterlyDelta =
    simulatedChinaAdditionalTariffQ3 - baselineChinaAdditionalTariffQ3;

  const nonChinaDuties = entries
    .filter((e) => !e.isChinaAdditionalTariff)
    .reduce((s, e) => s + e.assessedDutyAndTariffs, 0);
  const totalBilledBroker = entries.reduce((s, e) => s + e.billedBrokerFee, 0);
  const baselineTotalTradeCostQ3 =
    baselineChinaAdditionalTariffQ3 +
    ordinaryChinaMotorDutyQ3 +
    nonChinaDuties +
    totalBilledBroker;

  return {
    chinaAdditionalRateDecimal: simulatedAdditionalRateDecimal,
    chinaDeclaredValueQ3,
    chinaCount: chinaEntries.length,
    baselineChinaAdditionalTariffQ3,
    simulatedChinaAdditionalTariffQ3,
    ordinaryChinaMotorDutyQ3,
    quarterlyDelta,
    annualizedDelta: quarterlyDelta * 4,
    baselineTotalTradeCostQ3,
    simulatedTotalTradeCostQ3: baselineTotalTradeCostQ3 + quarterlyDelta,
  };
}

export function extractQuarterKey(periodOrDate?: string | null): string | null {
  if (!periodOrDate) return null;
  const qMatch = periodOrDate.match(/Q([1-4])\s*[-/]?\s*(\d{4})/i);
  if (qMatch) {
    return `Q${qMatch[1]} ${qMatch[2]}`;
  }
  const isoMatch = periodOrDate.match(/^(\d{4})-(\d{2})-\d{2}/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = Number(isoMatch[2]);
    const quarter = Math.ceil(month / 3);
    return `Q${quarter} ${year}`;
  }
  return null;
}

// Walk Reconciliation & 8-Metric Period-Specific Close Readiness Evaluator
export interface WalkReconciliationSummary {
  targetPeriodKey: string;
  startThousands: number;
  sumChangesThousands: number;
  calculatedEndThousands: number;
  reportedEndThousands: number;
  discrepancyThousands: number;
  isReconciled: boolean;
  materialLinesCount: number;
  verifiedMaterialCount: number;
  pendingMaterialCount: number;
  pendingTotalCount: number;
  inPeriodAnomalies: IrregularCostItem[];
  priorPeriodOutstandingItems: IrregularCostItem[];
  explicitCarryForwardBlockers: IrregularCostItem[];
  openAnomaliesCount: number;
  missingDocsCount: number;
  outstandingApprovalsCount: number;
  responsibleOwners: string[];
  prerequisitesMet: boolean;
  closeStatus: import('../types/skyguard').CloseApprovalState;
  periodApproval?: import('../types/skyguard').PeriodCloseApprovalRecord;
  approvalSuspended: boolean;
  suspensionReason?: string;
  snapshotHash: string;
  blockingReasons: string[];
}

function stableHashString(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}-${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export function computePeriodApprovalSnapshotHash(
  walk: EarningsWalk,
  scopedAnomalies: IrregularCostItem[],
  importedQuartersForPeriod: import('../types/skyguard').ImportedQuarterRecord[] = []
): string {
  const targetPeriodKey = extractQuarterKey(walk.toPeriod) ?? walk.toPeriod.trim();
  const payload = {
    targetPeriodKey,
    walkId: walk.id,
    startEarningsThousands: walk.startEarningsThousands,
    endEarningsThousands: walk.endEarningsThousands,
    lines: walk.lines.map((l) => ({
      id: l.id,
      label: l.label,
      amountThousands: l.amountThousands,
      category: l.category,
      explanationStatus: l.explanationStatus,
      explanationText: l.explanationText,
      owner: l.owner,
      evidenceReference: l.evidenceReference ?? '',
      approvalDecision: l.approvalDecision ?? 'Pending',
      verifiedBy: l.verifiedBy ?? '',
      verifiedAt: l.verifiedAt ?? '',
    })),
    anomalies: [...scopedAnomalies]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((a) => ({
        id: a.id,
        accountingPeriod: a.accountingPeriod,
        amount: a.amount,
        status: a.status,
        approvalState: a.approvalState,
        approvalRef: a.approvalRef ?? '',
        humanCorrectionDecision: a.humanCorrectionDecision,
        notes: a.notes,
        cause: a.cause,
        carryForwardBlockReason: a.carryForwardBlockReason ?? '',
        carryForwardTargetPeriod: a.carryForwardTargetPeriod ?? '',
        dismissedRules: (a.dismissedRules ?? []).map((d) => d.ruleId).sort(),
        checklist: a.evidenceChecklist.map((c) => `${c.id}:${c.verified ? 1 : 0}`),
      })),
    importedQuarters: [...importedQuartersForPeriod]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((iq) => `${iq.id}:${iq.quarter}:${iq.calculatedOperatingEarningsCAD}`),
  };
  return stableHashString(JSON.stringify(payload));
}

export function evaluateWalkReconciliation(
  walk: EarningsWalk,
  anomalies: IrregularCostItem[],
  allItemsForScreening: IrregularCostItem[],
  periodCloseApprovals?: Record<string, import('../types/skyguard').PeriodCloseApprovalRecord>,
  importedQuarters: import('../types/skyguard').ImportedQuarterRecord[] = []
): WalkReconciliationSummary {
  const sumChangesThousands = walk.lines.reduce(
    (s, l) => s + l.amountThousands,
    0
  );
  const calculatedEndThousands = walk.startEarningsThousands + sumChangesThousands;
  const discrepancyThousands = walk.endEarningsThousands - calculatedEndThousands;
  const isReconciled = discrepancyThousands === 0;

  const materialLines = walk.lines.filter(
    (l) => Math.abs(l.amountThousands) >= CASE_CONSTANTS.WALK_MATERIALITY_THRESHOLD_THOUSANDS
  );
  const verifiedMaterialCount = materialLines.filter(
    (l) => l.explanationStatus === 'Verified'
  ).length;
  const pendingMaterialCount = materialLines.length - verifiedMaterialCount;
  const pendingTotalCount = walk.lines.filter(
    (l) => l.explanationStatus !== 'Verified'
  ).length;

  const targetPeriodKey =
    extractQuarterKey(walk.toPeriod) ?? walk.toPeriod.trim();

  const inPeriodAnomalies: IrregularCostItem[] = [];
  const priorPeriodOutstandingItems: IrregularCostItem[] = [];
  const explicitCarryForwardBlockers: IrregularCostItem[] = [];

  for (const item of anomalies) {
    const itemPeriodKey =
      extractQuarterKey(item.accountingPeriod) ??
      extractQuarterKey(item.date) ??
      'Q3 2026';

    if (itemPeriodKey === targetPeriodKey) {
      inPeriodAnomalies.push(item);
      continue;
    }

    if (item.status !== 'Resolved') {
      const hasExplicitCarryForward =
        Boolean(item.carryForwardBlockReason?.trim()) &&
        (!item.carryForwardTargetPeriod ||
          extractQuarterKey(item.carryForwardTargetPeriod) === targetPeriodKey);

      if (hasExplicitCarryForward) {
        explicitCarryForwardBlockers.push(item);
      } else {
        priorPeriodOutstandingItems.push(item);
      }
    }
  }

  const scopedForClose = [...inPeriodAnomalies, ...explicitCarryForwardBlockers];

  const openAnomalies = scopedForClose.filter(
    (item) => item.status === 'New' || item.status === 'Investigating'
  );
  const missingDocsCount = scopedForClose.filter(
    (item) => item.evidenceChecklist.some((c) => !c.verified)
  ).length;
  const outstandingApprovalsCount = scopedForClose.filter(
    (item) =>
      (item.approvalState === 'Confirmed Missing' ||
        (item.approvalState === 'Not Provided in Case' && !item.approvalRef)) &&
      item.status !== 'Resolved'
  ).length;

  const unreviewedBlockingIr = scopedForClose.filter((item) => {
    const flags = getActiveScreeningFlags(item, allItemsForScreening);
    const hasMissingApproval =
      item.approvalState === 'Confirmed Missing' ||
      (item.approvalState === 'Not Provided in Case' && !item.approvalRef);
    const isUnreviewed =
      item.status === 'New' || item.status === 'Investigating';
    return flags.length > 0 && isUnreviewed && (hasMissingApproval || item.amount >= 250_000);
  });

  const missingChecklistEvidenceOnReadyIr = scopedForClose.filter((item) => {
    const flags = getActiveScreeningFlags(item, allItemsForScreening);
    return (
      flags.length > 0 &&
      item.status !== 'Resolved' &&
      item.evidenceChecklist.some((c) => !c.verified)
    );
  });

  const ownerSet = new Set<string>();
  walk.lines.forEach((l) => ownerSet.add(l.owner));
  openAnomalies.forEach((a) => ownerSet.add(a.owner));

  const blockingReasons: string[] = [];
  if (!isReconciled) {
    blockingReasons.push(
      `Walk is unreconciled by ${formatCAD(discrepancyThousands * 1000)}.`
    );
  }
  if (pendingMaterialCount > 0) {
    blockingReasons.push(
      `${pendingMaterialCount} material walk line(s) (>= CAD $1M) for ${targetPeriodKey} lack verified human explanation.`
    );
  }
  if (unreviewedBlockingIr.length > 0) {
    blockingReasons.push(
      `${unreviewedBlockingIr.length} ${targetPeriodKey}/carry-forward anomaly item(s) (${unreviewedBlockingIr.map((i) => i.id).join(', ')}) remain New/Investigating with open evidence or approval gaps.`
    );
  }
  if (missingChecklistEvidenceOnReadyIr.length > 0) {
    const extraMissing = missingChecklistEvidenceOnReadyIr.filter(
      (i) => !unreviewedBlockingIr.some((u) => u.id === i.id)
    );
    if (extraMissing.length > 0) {
      blockingReasons.push(
        `${extraMissing.length} ${targetPeriodKey} flagged item(s) (${extraMissing.map((i) => i.id).join(', ')}) still require investigation evidence checklist verification before close.`
      );
    }
  }

  const prerequisitesMet = blockingReasons.length === 0;
  const importedForPeriod = importedQuarters.filter(
    (iq) => (extractQuarterKey(iq.quarter) ?? iq.quarter.trim()) === targetPeriodKey
  );
  const snapshotHash = computePeriodApprovalSnapshotHash(
    walk,
    scopedForClose,
    importedForPeriod
  );

  const periodApproval = periodCloseApprovals?.[targetPeriodKey];
  let closeStatus: import('../types/skyguard').CloseApprovalState = 'Blocked';
  let approvalSuspended = false;
  let suspensionReason: string | undefined;

  const expectedApprovedHash =
    periodApproval?.walkHashes?.[walk.id] ??
    (periodApproval?.walkId === walk.id ? periodApproval.snapshotHash : undefined);
  const coversThisWalk = Boolean(
    periodApproval &&
      (periodApproval.walkId === walk.id ||
        periodApproval.approvedWalkIds.includes(walk.id) ||
        periodApproval.walkHashes?.[walk.id])
  );

  if (periodApproval) {
    if (periodApproval.status === 'Suspended') {
      approvalSuspended = true;
      suspensionReason =
        periodApproval.suspendedReason ??
        'Underlying explanation, financial driver, or period transaction changed after previous approval.';
    } else if (periodApproval.status === 'Approved' && coversThisWalk) {
      if (expectedApprovedHash && expectedApprovedHash !== snapshotHash) {
        approvalSuspended = true;
        suspensionReason =
          'Material explanation, financial driver, or period transaction modified after approval — re-review required.';
      } else if (!prerequisitesMet) {
        approvalSuspended = true;
        suspensionReason =
          'Close prerequisites became incomplete after previous approval — re-review required.';
      }
    }
  }

  if (!prerequisitesMet) {
    closeStatus = 'Blocked';
  } else if (
    periodApproval &&
    periodApproval.status === 'Approved' &&
    !approvalSuspended &&
    coversThisWalk &&
    expectedApprovedHash === snapshotHash
  ) {
    closeStatus = 'Approved for Close';
  } else {
    closeStatus = 'Ready for Sign-Off';
  }

  return {
    targetPeriodKey,
    startThousands: walk.startEarningsThousands,
    sumChangesThousands,
    calculatedEndThousands,
    reportedEndThousands: walk.endEarningsThousands,
    discrepancyThousands,
    isReconciled,
    materialLinesCount: materialLines.length,
    verifiedMaterialCount,
    pendingMaterialCount,
    pendingTotalCount,
    inPeriodAnomalies,
    priorPeriodOutstandingItems,
    explicitCarryForwardBlockers,
    openAnomaliesCount: openAnomalies.length,
    missingDocsCount,
    outstandingApprovalsCount,
    responsibleOwners: Array.from(ownerSet),
    prerequisitesMet,
    closeStatus,
    periodApproval,
    approvalSuspended,
    suspensionReason,
    snapshotHash,
    blockingReasons,
  };
}

export function getAllMergedWalks(
  customWalks: EarningsWalk[],
  walkLineOverrides: Record<string, WalkLineOverride>
): EarningsWalk[] {
  const mergeOverrides = (walk: EarningsWalk): EarningsWalk => ({
    ...walk,
    lines: walk.lines.map((l) =>
      walkLineOverrides[l.id] ? { ...l, ...walkLineOverrides[l.id] } : l
    ),
  });
  return [
    mergeOverrides(OFFICIAL_YOY_WALK),
    mergeOverrides(OFFICIAL_QOQ_WALK),
    ...customWalks.map(mergeOverrides),
  ];
}

export function recordPeriodCloseApproval(
  state: Pick<
    SkyguardPersistedState,
    'anomalies' | 'customWalks' | 'importedQuarters' | 'walkLineOverrides' | 'periodCloseApprovals' | 'closeApprovalLog'
  >,
  params: {
    walkId: string;
    reviewerName: string;
    approvalDate: string;
    timestamp: string;
  }
): {
  recorded: boolean;
  error?: string;
  periodKey?: string;
  periodCloseApprovals: Record<string, PeriodCloseApprovalRecord>;
  closeApprovalLog: AuditEntry[];
} {
  const existingApprovals = { ...(state.periodCloseApprovals ?? {}) };
  const allWalks = getAllMergedWalks(state.customWalks, state.walkLineOverrides);
  const targetWalk = allWalks.find((w) => w.id === params.walkId);
  if (!targetWalk) {
    return {
      recorded: false,
      error: 'Selected earnings walk no longer exists.',
      periodCloseApprovals: existingApprovals,
      closeApprovalLog: state.closeApprovalLog,
    };
  }

  const evalTarget = evaluateWalkReconciliation(
    targetWalk,
    state.anomalies,
    state.anomalies,
    existingApprovals,
    state.importedQuarters ?? []
  );

  if (!evalTarget.prerequisitesMet) {
    return {
      recorded: false,
      error: `Cannot record close approval while ${evalTarget.targetPeriodKey} has open blockers: ${evalTarget.blockingReasons.join(' ')}`,
      periodCloseApprovals: existingApprovals,
      closeApprovalLog: state.closeApprovalLog,
    };
  }

  const cleanReviewer = params.reviewerName.trim();
  const cleanDate = params.approvalDate.trim();
  if (!cleanReviewer || !cleanDate) {
    return {
      recorded: false,
      error: 'Reviewer name and approval date are required to record Simulated Demo Approval.',
      periodCloseApprovals: existingApprovals,
      closeApprovalLog: state.closeApprovalLog,
    };
  }

  const periodKey = evalTarget.targetPeriodKey;
  const samePeriodWalks = allWalks.filter(
    (w) => (extractQuarterKey(w.toPeriod) ?? w.toPeriod.trim()) === periodKey
  );
  const walkHashes: Record<string, string> = {};
  const approvedWalkIds: string[] = [];

  for (const w of samePeriodWalks) {
    const ev =
      w.id === targetWalk.id
        ? evalTarget
        : evaluateWalkReconciliation(
            w,
            state.anomalies,
            state.anomalies,
            existingApprovals,
            state.importedQuarters ?? []
          );
    if (w.id === targetWalk.id || ev.prerequisitesMet) {
      approvedWalkIds.push(w.id);
      walkHashes[w.id] = ev.snapshotHash;
    }
  }

  const record: PeriodCloseApprovalRecord = {
    periodKey,
    status: 'Approved',
    decision: 'Approved for Close',
    identityLabel: 'Simulated Demo Approval — Identity Not Verified',
    reviewerName: cleanReviewer,
    approvalDate: cleanDate,
    recordedAt: params.timestamp,
    walkId: targetWalk.id,
    walkTitle: targetWalk.title,
    approvedWalkIds,
    snapshotHash: evalTarget.snapshotHash,
    walkHashes,
  };

  const auditEntry: AuditEntry = {
    id: `CLOSE-${Date.now()}`,
    timestamp: params.timestamp,
    actor: cleanReviewer,
    action: 'Simulated Demo Approval — Identity Not Verified (Approved for Close)',
    note: `Period: ${periodKey} · Walk: ${targetWalk.title} · Approval Date: ${cleanDate} · Decision: Approved for Close.`,
    isDemoState: true,
  };

  return {
    recorded: true,
    periodKey,
    periodCloseApprovals: {
      ...existingApprovals,
      [periodKey]: record,
    },
    closeApprovalLog: [auditEntry, ...state.closeApprovalLog],
  };
}

export function suspendStalePeriodApprovals(
  state: Pick<
    SkyguardPersistedState,
    'anomalies' | 'customWalks' | 'importedQuarters' | 'walkLineOverrides' | 'periodCloseApprovals' | 'closeApprovalLog'
  >,
  timestamp: string,
  changeSummary?: string
): {
  periodCloseApprovals: Record<string, PeriodCloseApprovalRecord>;
  closeApprovalLog: AuditEntry[];
  suspendedPeriods: string[];
} {
  const existingApprovals = state.periodCloseApprovals ?? {};
  if (Object.keys(existingApprovals).length === 0) {
    return {
      periodCloseApprovals: existingApprovals,
      closeApprovalLog: state.closeApprovalLog,
      suspendedPeriods: [],
    };
  }

  const allWalks = getAllMergedWalks(state.customWalks, state.walkLineOverrides);
  const nextApprovals: Record<string, PeriodCloseApprovalRecord> = {
    ...existingApprovals,
  };
  let nextLog = state.closeApprovalLog;
  const suspendedPeriods: string[] = [];

  for (const [periodKey, record] of Object.entries(existingApprovals)) {
    if (record.status !== 'Approved') continue;

    const checkedIds =
      record.approvedWalkIds.length > 0 ? record.approvedWalkIds : [record.walkId];

    let invalidReason: string | null = null;
    for (const wid of checkedIds) {
      const matchedWalk = allWalks.find((w) => w.id === wid);
      if (!matchedWalk) {
        invalidReason = `Approved earnings walk (${record.walkTitle}) was removed or modified.`;
        break;
      }
      const ev = evaluateWalkReconciliation(
        matchedWalk,
        state.anomalies,
        state.anomalies,
        existingApprovals,
        state.importedQuarters ?? []
      );
      if (!ev.prerequisitesMet) {
        invalidReason =
          changeSummary ||
          `Close prerequisites in ${periodKey} became incomplete (${ev.blockingReasons[0] ?? 're-review required'}).`;
        break;
      }
      const expectedHash =
        record.walkHashes?.[wid] ??
        (record.walkId === wid ? record.snapshotHash : undefined);
      if (expectedHash && expectedHash !== ev.snapshotHash) {
        invalidReason =
          changeSummary ||
          `Material explanation, financial driver, or transaction data in ${periodKey} changed after approval.`;
        break;
      }
    }

    if (invalidReason) {
      suspendedPeriods.push(periodKey);
      nextApprovals[periodKey] = {
        ...record,
        status: 'Suspended',
        decision: 'Suspended — Re-Review Required',
        suspendedAt: timestamp,
        suspendedReason: invalidReason,
      };
      const suspensionAudit: AuditEntry = {
        id: `SUSPEND-${Date.now()}-${periodKey.replace(/\s+/g, '')}`,
        timestamp,
        actor: 'SKYGUARD Close Control',
        action: 'Approval Suspended — Re-Review Required',
        note: `Period: ${periodKey} · ${invalidReason} · Prior Simulated Demo Approval by ${record.reviewerName} (${record.approvalDate}) remains preserved in audit history.`,
        isDemoState: true,
      };
      nextLog = [suspensionAudit, ...nextLog];
    }
  }

  return {
    periodCloseApprovals: nextApprovals,
    closeApprovalLog: nextLog,
    suspendedPeriods,
  };
}

// Trustworthy Part 8 Business Case / ROI Calculator
export interface ROICalculationResult {
  // 1. Documented Q3 Exposure (NOT savings)
  recordedQ3IrregularExposure: number;
  recordedQ3TradeCost: number;
  // 2. Conditional corrections / recoveries
  conditionalDuplicateRecoveryIR03: number;
  conditionalWarrantyCorrectionIR06NonCash: number;
  // 3. Possible broker fee recovery (consistent net vs gross)
  brokerBaseObserved: number;
  annualizedBrokerRecovery: number;
  // 4. Conditional missed FTA claim (E-08)
  conditionalMissedFtaE08Annual: number;
  // 5. Future prevention
  preventedFutureLeakageAnnual: number;
  // 6. Investigation hours saved
  annualInvestigationHoursSaved: number;
  annualLaborEfficiencyValue: number;
  // Totals & ROI
  year1GrossBenefit: number;
  steadyStateAnnualBenefit: number;
  year1TotalCost: number;
  annualOperatingCost: number;
  year1NetBenefit: number;
  threeYearGrossBenefit: number;
  threeYearTotalCost: number;
  threeYearNetBenefit: number;
  year1RoiPct: number;
  threeYearRoiPct: number;
  simplePaybackMonths: number | null;
}

export function calculateTrustworthyROI(
  assumptions: ROIAssumptions,
  customsEntries: CustomsEntry[] = OFFICIAL_CUSTOMS_ENTRIES
): ROICalculationResult {
  const netBrokerObserved = customsEntries.reduce(
    (s, e) => s + e.brokerVariance,
    0
  );
  const grossBrokerObserved = customsEntries
    .filter((e) => e.brokerVariance > 0)
    .reduce((s, e) => s + e.brokerVariance, 0);

  const brokerBaseObserved =
    assumptions.brokerRecoveryBasis === 'gross'
      ? Math.max(0, grossBrokerObserved)
      : Math.max(0, netBrokerObserved);

  const adoption = assumptions.adoptionFactorPct / 100;
  const ramp1 = assumptions.year1RampUpPct / 100;

  // Conditional IR-03 duplicate invoice recovery (one-time)
  const conditionalDuplicateRecoveryIR03 = Math.round(
    265_000 * (assumptions.duplicateRecoveryLikelihoodPct / 100)
  );
  // IR-06 is an accounting correction (not assumed as cash recovery in ROI benefit)
  const conditionalWarrantyCorrectionIR06NonCash = 410_000;

  // Broker fee recovery annualized (4 quarters * observed * recovery likelihood * adoption)
  const annualizedBrokerRecovery = Math.round(
    brokerBaseObserved * 4 * (assumptions.brokerRecoveryLikelihoodPct / 100) * adoption
  );

  // Conditional E-08 missed CUSMA claim (4 quarters * $11,020 * likelihood * adoption)
  const e08Base = customsEntries.reduce(
    (s, e) => s + e.potentialMissedClaimDuty,
    0
  );
  const conditionalMissedFtaE08Annual = Math.round(
    e08Base * 4 * (assumptions.missedFtaRecoveryLikelihoodPct / 100) * adoption
  );

  // Future prevention (user-editable base * adoption)
  const preventedFutureLeakageAnnual = Math.round(
    assumptions.annualPreventedLeakageBase * adoption
  );

  // Investigation hours saved
  const annualInvestigationHoursSaved = Math.round(
    assumptions.annualIncidentCount * assumptions.hoursSavedPerIncident * adoption
  );
  const annualLaborEfficiencyValue = Math.round(
    annualInvestigationHoursSaved * assumptions.analystHourlyRate
  );

  const steadyStateAnnualBenefit =
    annualizedBrokerRecovery +
    conditionalMissedFtaE08Annual +
    preventedFutureLeakageAnnual +
    annualLaborEfficiencyValue;

  const year1GrossBenefit = Math.round(
    conditionalDuplicateRecoveryIR03 + steadyStateAnnualBenefit * ramp1
  );

  const annualOperatingCost = assumptions.monthlyMaintenance * 12;
  const year1TotalCost =
    assumptions.implementationCost +
    assumptions.employeeTrainingCost +
    annualOperatingCost;

  const year1NetBenefit = year1GrossBenefit - year1TotalCost;

  const threeYearGrossBenefit =
    year1GrossBenefit + steadyStateAnnualBenefit * 2;
  const threeYearTotalCost =
    assumptions.implementationCost +
    assumptions.employeeTrainingCost +
    annualOperatingCost * 3;
  const threeYearNetBenefit = threeYearGrossBenefit - threeYearTotalCost;

  const year1RoiPct =
    year1TotalCost > 0 ? (year1NetBenefit / year1TotalCost) * 100 : 0;
  const threeYearRoiPct =
    threeYearTotalCost > 0 ? (threeYearNetBenefit / threeYearTotalCost) * 100 : 0;

  const monthlySteadyNet = (steadyStateAnnualBenefit - annualOperatingCost) / 12;
  const upfrontPlusTraining =
    assumptions.implementationCost + assumptions.employeeTrainingCost;
  const simplePaybackMonths =
    monthlySteadyNet > 0 ? upfrontPlusTraining / monthlySteadyNet : null;

  return {
    recordedQ3IrregularExposure: CASE_CONSTANTS.IRREGULAR_TOTAL_CAD,
    recordedQ3TradeCost: CASE_CONSTANTS.TRADE_ALL_IN_TOTAL_CAD,
    conditionalDuplicateRecoveryIR03,
    conditionalWarrantyCorrectionIR06NonCash,
    brokerBaseObserved,
    annualizedBrokerRecovery,
    conditionalMissedFtaE08Annual,
    preventedFutureLeakageAnnual,
    annualInvestigationHoursSaved,
    annualLaborEfficiencyValue,
    year1GrossBenefit,
    steadyStateAnnualBenefit,
    year1TotalCost,
    annualOperatingCost,
    year1NetBenefit,
    threeYearGrossBenefit,
    threeYearTotalCost,
    threeYearNetBenefit,
    year1RoiPct,
    threeYearRoiPct,
    simplePaybackMonths,
  };
}

// Group 7 Final Prompt to Pitch 2026 Presentation Model — Year 1 Economic-Value ROI
export interface PresentationYear1ROIResult {
  totalInvestment: number;
  duplicateInvoiceRecovery: number;
  investigationTimeSavings: number;
  annualizedRushFreightBase: number;
  avoidableRushFreight: number;
  annualizedBrokerExcessBase: number;
  brokerFeeRecovery: number;
  totalPotentialBenefits: number;
  netEconomicBenefit: number;
  year1RoiPct: number;
  // Sensitivity Test: Zero Duplicate Invoice Recovery (0% duplicate recovery, other assumptions unchanged)
  zeroDuplicatePotentialBenefits: number;
  zeroDuplicateNetBenefit: number;
  zeroDuplicateRoiPct: number;
}

export function calculatePresentationYear1ROI(
  assumptions: PresentationROIYear1Assumptions = DEFAULT_PRESENTATION_ROI_ASSUMPTIONS
): PresentationYear1ROIResult {
  const totalInvestment =
    assumptions.appDevAndConfigCost +
    assumptions.erpIntegrationSecurityCost +
    assumptions.staffTrainingCost +
    assumptions.cloudOpsSupportCost;

  // A. Duplicate Invoice Recovery (One-time conditional recovery, not recurring annual savings)
  const duplicateInvoiceRecovery = Math.round(
    assumptions.duplicateInvoiceBaseCAD * (assumptions.duplicateRecoveryPct / 100)
  );

  // B. Investigation Time Savings (Non-cash employee productivity / capacity value)
  const investigationTimeSavings = Math.round(
    assumptions.hoursFreedAnnually * assumptions.fullyLoadedHourlyRate
  );

  // C. Avoidable Rush Freight (Hypothetical annualization requiring pilot validation)
  const annualizedRushFreightBase = Math.round(
    assumptions.rushFreightQuarterlyBaseCAD * assumptions.rushFreightQuartersPerYear
  );
  const avoidableRushFreight = Math.round(
    annualizedRushFreightBase * (assumptions.rushFreightAvoidablePct / 100)
  );

  // D. Broker Fee Recovery (Conditional on invoice verification and recovery)
  const annualizedBrokerExcessBase = Math.round(
    assumptions.brokerNetExcessQuarterlyCAD * assumptions.brokerQuartersPerYear
  );
  const brokerFeeRecovery = Math.round(
    annualizedBrokerExcessBase * (assumptions.brokerRecoveryPct / 100)
  );

  const totalPotentialBenefits =
    duplicateInvoiceRecovery +
    investigationTimeSavings +
    avoidableRushFreight +
    brokerFeeRecovery;

  const netEconomicBenefit = totalPotentialBenefits - totalInvestment;
  const year1RoiPct =
    totalInvestment > 0 ? (netEconomicBenefit / totalInvestment) * 100 : 0;

  // Sensitivity Test: Zero Duplicate Invoice Recovery (0%)
  const zeroDuplicatePotentialBenefits =
    investigationTimeSavings + avoidableRushFreight + brokerFeeRecovery;
  const zeroDuplicateNetBenefit = zeroDuplicatePotentialBenefits - totalInvestment;
  const zeroDuplicateRoiPct =
    totalInvestment > 0 ? (zeroDuplicateNetBenefit / totalInvestment) * 100 : 0;

  return {
    totalInvestment,
    duplicateInvoiceRecovery,
    investigationTimeSavings,
    annualizedRushFreightBase,
    avoidableRushFreight,
    annualizedBrokerExcessBase,
    brokerFeeRecovery,
    totalPotentialBenefits,
    netEconomicBenefit,
    year1RoiPct,
    zeroDuplicatePotentialBenefits,
    zeroDuplicateNetBenefit,
    zeroDuplicateRoiPct,
  };
}
