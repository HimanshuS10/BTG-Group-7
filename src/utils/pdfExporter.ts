import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  APPENDIX_SECTIONS,
  CASE_CONSTANTS,
  DEFAULT_PRESENTATION_ROI_ASSUMPTIONS,
  DEFAULT_ROI_ASSUMPTIONS,
  HISTORICAL_QUARTERLY_SERIES,
  PRESENTATION_ROI_DISCLAIMER,
  calculateChinaTariffSimulation,
  calculatePresentationYear1ROI,
  calculateTrustworthyROI,
  evaluateWalkReconciliation,
  formatCAD,
  formatSignedCAD,
  getActiveScreeningFlags,
} from '../data/skyjackCaseData';
import type {
  AuditEntry,
  CustomsEntry,
  EarningsWalk,
  ImportedQuarterRecord,
  InterprovincialDelivery,
  IrregularCostItem,
  PeriodCloseApprovalRecord,
  PresentationROIYear1Assumptions,
  ROIAssumptions,
  ROIModelSelection,
  TariffRateRule,
  TariffRuleChangeLog,
} from '../types/skyguard';

export interface ExecutiveBriefPayload {
  anomalies: IrregularCostItem[];
  customsEntries: CustomsEntry[];
  interprovincialDeliveries: InterprovincialDelivery[];
  importedQuarters?: ImportedQuarterRecord[];
  tariffRules?: TariffRateRule[];
  tariffRuleChangelog?: TariffRuleChangeLog[];
  yoyWalk: EarningsWalk;
  qoqWalk: EarningsWalk;
  customWalks: EarningsWalk[];
  periodCloseApprovals?: Record<string, PeriodCloseApprovalRecord>;
  closeApprovalLog?: AuditEntry[];
  chinaScenarioPct: number;
  selectedRoiModel?: ROIModelSelection;
  presentationRoiAssumptions?: PresentationROIYear1Assumptions;
  roiAssumptions: ROIAssumptions;
}

const ROI_PRESET_PATCHES: Record<'low' | 'base' | 'high', Partial<ROIAssumptions>> = {
  low: {
    adoptionFactorPct: 55,
    year1RampUpPct: 50,
    brokerRecoveryLikelihoodPct: 50,
    duplicateRecoveryLikelihoodPct: 0,
    missedFtaRecoveryLikelihoodPct: 25,
    annualPreventedLeakageBase: 100_000,
  },
  base: DEFAULT_ROI_ASSUMPTIONS,
  high: {
    adoptionFactorPct: 90,
    year1RampUpPct: 85,
    brokerRecoveryLikelihoodPct: 90,
    duplicateRecoveryLikelihoodPct: 85,
    missedFtaRecoveryLikelihoodPct: 75,
    annualPreventedLeakageBase: 220_000,
  },
};

async function loadLogoAsDataUrl(): Promise<{
  dataUrl: string;
  width: number;
  height: number;
} | null> {
  try {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      return null;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load SKYJACK logo PNG'));
      img.src = '/assets/aistudio/image_6dc12cf5.png';
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 600;
    canvas.height = img.naturalHeight || 200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
    };
  } catch {
    return null;
  }
}

export async function buildExecutiveBriefPdf(
  payload: ExecutiveBriefPayload
): Promise<{ blob: Blob; filename: string }> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 38;
  const contentWidth = pageWidth - margin * 2;
  const orange: [number, number, number] = [240, 79, 37];
  const charcoal: [number, number, number] = [51, 51, 51];
  const muted: [number, number, number] = [107, 114, 128];

  const today = new Date().toISOString().slice(0, 10);
  const filename = `SKYGUARD_Executive_Brief_${today}.pdf`;

  const logo = await loadLogoAsDataUrl();

  let cursorY = 30;

  // Header with genuine SKYJACK PNG logo + restrained orange rule (dimensions & framing preserved)
  if (logo) {
    const ratio = logo.height / logo.width;
    let drawW = 134;
    let drawH = drawW * ratio;
    if (drawH > 42) {
      drawH = 42;
      drawW = drawH / ratio;
    }
    doc.addImage(logo.dataUrl, 'PNG', margin, cursorY + 2, drawW, drawH);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...charcoal);
    doc.text('SKYJACK', margin, cursorY + 22);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...charcoal);
  doc.text('SKYGUARD AI — Executive Brief', pageWidth - margin, cursorY + 13, {
    align: 'right',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.0);
  doc.setTextColor(...muted);
  doc.text(
    `Prompt to Pitch 2026 Student Competition Prototype · Generated ${today}`,
    pageWidth - margin,
    cursorY + 25,
    { align: 'right' }
  );
  doc.text(
    'Fictional competition case figures (CAD) · Source-confirmed values separated from human-verified narratives',
    pageWidth - margin,
    cursorY + 35,
    { align: 'right' }
  );

  cursorY += 46;
  doc.setDrawColor(...orange);
  doc.setLineWidth(2);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 14;

  const ensureSpace = (needed: number) => {
    if (cursorY + needed > pageHeight - 44) {
      doc.addPage();
      cursorY = 38;
    }
  };

  const getLastY = (): number =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  const addSectionHeading = (title: string, subtitle?: string) => {
    const wrapped = subtitle ? doc.splitTextToSize(subtitle, contentWidth) : [];
    const neededHeight = 36 + wrapped.length * 9.5;
    ensureSpace(neededHeight);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.2);
    doc.setTextColor(...charcoal);
    doc.text(title, margin, cursorY);
    cursorY += 11;
    if (subtitle && wrapped.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.0);
      doc.setTextColor(...muted);
      doc.text(wrapped, margin, cursorY);
      cursorY += wrapped.length * 9.5 + 4;
    } else {
      cursorY += 3;
    }
  };

  // Compute live workspace totals separated between official baseline and working scenario
  const baselineIr = payload.anomalies.filter(
    (a) => a.provenance === 'Official case baseline'
  );
  const userAddedIr = payload.anomalies.filter(
    (a) => a.provenance === 'User-added scenario'
  );
  const baselineIrTotal = baselineIr.reduce((s, a) => s + a.amount, 0);
  const workingIrTotal = payload.anomalies.reduce((s, a) => s + a.amount, 0);

  const baselineShipments = payload.customsEntries.filter(
    (c) => c.provenance === 'Official case baseline'
  );
  const userShipments = payload.customsEntries.filter(
    (c) => c.provenance === 'User-added scenario'
  );

  const sumDutyTariff = (arr: CustomsEntry[]) =>
    arr.reduce((s, c) => s + c.assessedDutyAndTariffs, 0);
  const sumBrokerBilled = (arr: CustomsEntry[]) =>
    arr.reduce((s, c) => s + c.billedBrokerFee, 0);
  const sumBrokerExpected = (arr: CustomsEntry[]) =>
    arr.reduce((s, c) => s + c.expectedBrokerFee, 0);

  const workingDutyTariff = sumDutyTariff(payload.customsEntries);
  const workingBrokerBilled = sumBrokerBilled(payload.customsEntries);
  const workingBrokerExpected = sumBrokerExpected(payload.customsEntries);
  const workingBrokerNetVar = workingBrokerBilled - workingBrokerExpected;
  const workingGrossOver = payload.customsEntries
    .filter((c) => c.brokerVariance > 0)
    .reduce((s, c) => s + c.brokerVariance, 0);
  const workingGrossUnder = payload.customsEntries
    .filter((c) => c.brokerVariance < 0)
    .reduce((s, c) => s + Math.abs(c.brokerVariance), 0);
  const workingAllInTrade = workingDutyTariff + workingBrokerBilled;

  const chinaSim = calculateChinaTariffSimulation(
    payload.customsEntries,
    payload.chinaScenarioPct / 100
  );

  const importedQuarters = payload.importedQuarters ?? [];
  const periodCloseApprovals = payload.periodCloseApprovals ?? {};

  const yoyEval = evaluateWalkReconciliation(
    payload.yoyWalk,
    payload.anomalies,
    payload.anomalies,
    periodCloseApprovals,
    importedQuarters
  );
  const qoqEval = evaluateWalkReconciliation(
    payload.qoqWalk,
    payload.anomalies,
    payload.anomalies,
    periodCloseApprovals,
    importedQuarters
  );

  const tariffRules = payload.tariffRules ?? [];
  const tariffChangelog = payload.tariffRuleChangelog ?? [];

  const selectedRoiModel: ROIModelSelection =
    payload.selectedRoiModel === 'original_3yr' ? 'original_3yr' : 'presentation_y1';
  const presAssumptions: PresentationROIYear1Assumptions = {
    ...DEFAULT_PRESENTATION_ROI_ASSUMPTIONS,
    ...(payload.presentationRoiAssumptions ?? {}),
  };
  const presRoi = calculatePresentationYear1ROI(presAssumptions);

  const lowRoi = calculateTrustworthyROI(
    { ...payload.roiAssumptions, ...ROI_PRESET_PATCHES.low },
    payload.customsEntries
  );
  const baseRoi = calculateTrustworthyROI(
    { ...payload.roiAssumptions, ...ROI_PRESET_PATCHES.base },
    payload.customsEntries
  );
  const highRoi = calculateTrustworthyROI(
    { ...payload.roiAssumptions, ...ROI_PRESET_PATCHES.high },
    payload.customsEntries
  );

  const interprovTaxTotal = payload.interprovincialDeliveries.reduce(
    (s, d) => s + d.customerSalesTax,
    0
  );
  const interprovFreightTotal = payload.interprovincialDeliveries.reduce(
    (s, d) => s + d.freightExpense,
    0
  );

  // =========================================================================
  // SECTION 1: Executive Summary and Management Recommendations
  // =========================================================================
  addSectionHeading(
    `1. Executive Summary and Management Recommendations (${APPENDIX_SECTIONS.INCOME_STATEMENTS}, ${APPENDIX_SECTIONS.IRREGULAR_SUMMARY}, ${APPENDIX_SECTIONS.TRADE_SUMMARY})`,
    'Synthesizes SKYJACK\'s current Q3 2026 position, unresolved close/control risks, recovery & tariff sensitivity opportunities, and prioritized leadership actions while separating confirmed historical actuals from conditional or pilot-estimated items.'
  );

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: { fontSize: 7.4, cellPadding: 3.4, textColor: charcoal, overflow: 'linebreak' },
    headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 185 }, 1: { halign: 'right' }, 2: { halign: 'right' } },
    head: [['Executive Indicator (Source)', 'Official Q3 2026 Baseline', 'Current Working State']],
    body: [
      [`Q3 2026 Sales & Operating Earnings (${APPENDIX_SECTIONS.INCOME_STATEMENTS})`, 'CAD $329.7M / $20.7M', 'CAD $329.7M / $20.7M (Locked)'],
      [`YoY / QoQ Earnings Change (${APPENDIX_SECTIONS.YOY_WALK}, ${APPENDIX_SECTIONS.QOQ_WALK})`, '+$5.5M YoY / +$4.2M QoQ', '+$5.5M YoY / +$4.2M QoQ'],
      [
        `Irregular / Unidentified Costs (${APPENDIX_SECTIONS.IRREGULAR_SUMMARY})`,
        `${formatCAD(baselineIrTotal)} (7 entries)`,
        `${formatCAD(workingIrTotal)} (${payload.anomalies.length} entries${userAddedIr.length > 0 ? `, +${userAddedIr.length} user` : ''})`,
      ],
      [
        `All-In Duty + Tariff + Broker (${APPENDIX_SECTIONS.TRADE_SUMMARY})`,
        formatCAD(sumDutyTariff(baselineShipments) + sumBrokerBilled(baselineShipments)),
        formatCAD(workingAllInTrade),
      ],
      [
        `Broker Audit Variance vs 0.2% (${APPENDIX_SECTIONS.BROKER_BENCHMARK})`,
        'Net +$5,560 ($8,260 gross / -$2,700 E-11)',
        `Net ${formatSignedCAD(workingBrokerNetVar)} (+${formatCAD(workingGrossOver)} / -${formatCAD(workingGrossUnder)})`,
      ],
      [
        'Close Readiness (Stage 1 vs Stage 2)',
        'Stage 1: Reconciled ($0 gap)',
        `YoY: ${yoyEval.closeStatus}${yoyEval.closeStatus === 'Approved for Close' ? ' (Simulated Demo Approval — Identity Not Verified)' : yoyEval.closeStatus === 'Blocked' ? ` (${yoyEval.pendingMaterialCount} >=$1M, ${yoyEval.openAnomaliesCount} IR)` : ' (Awaiting Sign-Off)'} · QoQ: ${qoqEval.closeStatus}${qoqEval.closeStatus === 'Blocked' ? ` (${qoqEval.pendingMaterialCount} >=$1M)` : ''}`,
      ],
    ],
  });
  cursorY = getLastY();

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: { fontSize: 7.3, cellPadding: 3.4, textColor: charcoal, overflow: 'linebreak' },
    headStyles: { fillColor: orange, textColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 95 }, 1: { cellWidth: 165 } },
    head: [['Priority & Owner', 'Management Recommendation', 'Expected Impact & Certainty Classification']],
    body: [
      [
        '1. Immediate Close Control (Helen & Dana)',
        'Complete 5-field human verification on >=$1M walk lines (Sales vol/price/FX, Var vol, Fixed wages) and clear high-risk Q3 anomalies (IR-01 $900K JE-260931 scrap QA, IR-02 $600K rush freight, IR-04 $295K Account 2890 suspense, IR-05 $238K unapproved marketing, plus any user-added exceptions).',
        'Actual Documented: Prevents unverified Stage 2 close sign-off. Conditional: IR-03 ($265K) duplicate recovery & IR-06 ($410K non-cash accrual correction) depend on vendor statement & controller sign-off.',
      ],
      [
        '2. Trade & Broker Audit (Marco)',
        'Dispute CAD $8,260 gross broker overcharges ($5,560 net of E-11 undercharge) vs 0.2% contract; audit E-08 Mexico wire harnesses ($11,020 duty) for valid CUSMA Certificate of Origin; monitor China tariff exposure ($2.1M/qtr base; active UI slider ' + payload.chinaScenarioPct + '%).',
        'Documented Variance: +$5,560 net broker excess in Q3. Conditional: E-08 $11,020/qtr recovery requires origin docs. Hypothetical Policy Scenario: 25%->15% China rate = ' + formatSignedCAD(Math.round(chinaSim.chinaDeclaredValueQ3 * 0.15) - chinaSim.baselineChinaAdditionalTariffQ3) + '/qtr (not software ROI).',
      ],
      [
        '3. Pilot Governance & Rollout (Finance & IT)',
        selectedRoiModel === 'presentation_y1'
          ? `Run a controlled Phase 1 read-only pilot (GL/AP + CBSA broker feeds, SSO/RBAC) to validate IR-03 duplicate recovery, freed analyst hours, rush freight recurrence, and broker recovery before full ${formatCAD(presRoi.totalInvestment)} rollout.`
          : 'Run a 4-week read-only pilot integrating GL/AP and CBSA broker feeds with SSO & RBAC segregation of duties before full rollout; measure real leakage vs the $160K/yr Base placeholder.',
        selectedRoiModel === 'presentation_y1'
          ? `Active ROI Model (Group 7 Presentation Model — Year 1): ${formatCAD(presRoi.totalInvestment)} investment vs ${formatCAD(presRoi.totalPotentialBenefits)} modeled benefits = ${formatSignedCAD(presRoi.netEconomicBenefit)} net (${presRoi.year1RoiPct.toFixed(1)}% Projected Year-One Economic-Value ROI). 0% duplicate recovery sensitivity: ${formatSignedCAD(presRoi.zeroDuplicateNetBenefit)} (${presRoi.zeroDuplicateRoiPct.toFixed(1)}% ROI).`
          : `Active ROI Model (Original Three-Year Model — Pilot Validate): Base 3-Yr ROI ${baseRoi.threeYearRoiPct.toFixed(0)}% (${formatSignedCAD(baseRoi.threeYearNetBenefit)} net; ${baseRoi.simplePaybackMonths ? `${baseRoi.simplePaybackMonths.toFixed(1)} mo payback` : 'N/A'}), Low ${lowRoi.threeYearRoiPct.toFixed(0)}% to High ${highRoi.threeYearRoiPct.toFixed(0)}%.`,
      ],
    ],
  });
  cursorY = getLastY();

  // =========================================================================
  // SECTION 2: Key Financial Performance
  // =========================================================================
  addSectionHeading(
    `2. Key Financial Performance — Q4 2024 to Q3 2026 (${APPENDIX_SECTIONS.INCOME_STATEMENTS}, ${APPENDIX_SECTIONS.REGIONAL_SALES}, ${APPENDIX_SECTIONS.TRADE_TRENDS})`,
    'Historical 8-quarter operating earnings & trade-cost trajectory, imported provisional quarters (if any), and irregular exposure breakdown by department and region.'
  );

  const quarterRows: string[][] = HISTORICAL_QUARTERLY_SERIES.map((q) => [
    q.quarter,
    `CAD $${q.salesM.toFixed(1)}M`,
    `CAD $${q.operatingEarningsM.toFixed(1)}M`,
    `CAD $${q.tradeCostsK}K`,
    `Appendix (${APPENDIX_SECTIONS.INCOME_STATEMENTS})`,
    'Official 8-Quarter Baseline Series',
  ]);
  for (const iq of importedQuarters) {
    quarterRows.push([
      iq.quarter,
      formatCAD(iq.salesCAD),
      formatCAD(iq.calculatedOperatingEarningsCAD),
      'N/A (P&L CSV)',
      `Imported (${iq.sourceName})`,
      iq.hasDriverBreakdown
        ? `QoQ ${iq.qoqChangeCAD !== null ? formatSignedCAD(iq.qoqChangeCAD) : 'N/A'} · Driver Walk Linked`
        : 'Unexplained / Pending Driver Decomposition',
    ]);
  }

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'striped',
    rowPageBreak: 'avoid',
    styles: { fontSize: 7.3, cellPadding: 3.2, textColor: charcoal, overflow: 'linebreak' },
    headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    head: [['Quarter', 'Sales', 'Operating Earnings', 'Trade Costs', 'Source', 'Driver Status / Notes']],
    body: quarterRows,
  });
  cursorY = getLastY();

  // Department & Region concentration summary of Irregular Costs
  const deptMap = new Map<string, { count: number; total: number }>();
  const regMap = new Map<string, { count: number; total: number }>();
  for (const item of payload.anomalies) {
    const dPrev = deptMap.get(item.department) ?? { count: 0, total: 0 };
    deptMap.set(item.department, { count: dPrev.count + 1, total: dPrev.total + item.amount });
    const rPrev = regMap.get(item.regionGroup) ?? { count: 0, total: 0 };
    regMap.set(item.regionGroup, { count: rPrev.count + 1, total: rPrev.total + item.amount });
  }

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: { fontSize: 7.3, cellPadding: 3.2, textColor: charcoal, overflow: 'linebreak' },
    headStyles: { fillColor: [82, 82, 91], textColor: [255, 255, 255] },
    columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } },
    head: [['Irregular Cost Breakdown by Department', 'Count / Working Total', 'Breakdown by Region Group', 'Count / Working Total']],
    body: Array.from({ length: Math.max(deptMap.size, regMap.size) }).map((_, i) => {
      const deptEntries = Array.from(deptMap.entries());
      const regEntries = Array.from(regMap.entries());
      const d = deptEntries[i];
      const r = regEntries[i];
      return [
        d ? d[0] : '',
        d ? `${d[1].count} · ${formatCAD(d[1].total)}` : '',
        r ? r[0] : '',
        r ? `${r[1].count} · ${formatCAD(r[1].total)}` : '',
      ];
    }),
  });
  cursorY = getLastY();

  // =========================================================================
  // SECTION 3: Earnings-Walk Analysis and Close Readiness
  // =========================================================================
  addSectionHeading(
    `3. Earnings-Walk Analysis and Period-Specific Close Readiness (${APPENDIX_SECTIONS.YOY_WALK}, ${APPENDIX_SECTIONS.QOQ_WALK}, ${APPENDIX_SECTIONS.COMPANY_RULES})`,
    'Stage 1 (Financially Reconciled arithmetic check) remains strictly separate from Stage 2 (Approved for Close). Unresolved prior-quarter anomalies appear in Prior-Period Outstanding Items and do not block unrelated future closes unless explicitly carried forward.'
  );

  const walkSummaries = [
    { label: 'YoY Walk (Q3 2025 -> Q3 2026)', walk: payload.yoyWalk, ev: yoyEval },
    { label: 'QoQ Walk (Q2 2026 -> Q3 2026)', walk: payload.qoqWalk, ev: qoqEval },
    ...payload.customWalks.map((w) => ({
      label: w.title,
      walk: w,
      ev: evaluateWalkReconciliation(
        w,
        payload.anomalies,
        payload.anomalies,
        periodCloseApprovals,
        importedQuarters
      ),
    })),
  ];

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: { fontSize: 7.3, cellPadding: 3.3, textColor: charcoal, overflow: 'linebreak' },
    headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255] },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    head: [['Walk / Target Close Period', 'Stage 1 Reconciliation', 'Start -> End', 'Sum Changes', 'Gap', 'Stage 2 Controller Gate']],
    body: walkSummaries.map(({ label, walk, ev }) => [
      `${label} (${ev.targetPeriodKey})`,
      ev.isReconciled ? 'Financially Reconciled ($0)' : 'Unreconciled',
      `${formatCAD(walk.startEarningsThousands * 1000)} -> ${formatCAD(walk.endEarningsThousands * 1000)}`,
      formatSignedCAD(ev.sumChangesThousands * 1000),
      formatCAD(ev.discrepancyThousands * 1000),
      ev.closeStatus === 'Approved for Close' && ev.periodApproval
        ? `Approved for Close · ${ev.periodApproval.reviewerName} (${ev.periodApproval.approvalDate}) · Simulated Demo Approval — Identity Not Verified`
        : ev.closeStatus === 'Ready for Sign-Off'
        ? `Ready for Sign-Off (Prereqs met; awaiting controller sign-off)${ev.approvalSuspended ? ' · Prior Approval Suspended' : ''}`
        : `Blocked: ${ev.pendingMaterialCount} >=$1M unverified; ${ev.openAnomaliesCount} in-period IR${ev.approvalSuspended ? ' · Prior Approval Suspended' : ''}`,
    ]),
  });
  cursorY = getLastY();

  const recordedApprovalsList = Object.values(periodCloseApprovals);
  if (recordedApprovalsList.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: { fontSize: 7.1, cellPadding: 3.0, textColor: charcoal, overflow: 'linebreak' },
      headStyles: { fillColor: [82, 82, 91], textColor: [255, 255, 255] },
      head: [['Accounting Period', 'Decision', 'Reviewer & Date', 'Identity & Audit Status']],
      body: recordedApprovalsList.map((rec) => [
        rec.periodKey,
        rec.decision,
        `${rec.reviewerName} · ${rec.approvalDate}`,
        rec.status === 'Suspended'
          ? `${rec.identityLabel} · Suspended (${rec.suspendedAt ?? 'now'}): ${rec.suspendedReason ?? 'Post-approval edit triggered re-review.'}`
          : `${rec.identityLabel} · Active for ${rec.walkTitle}`,
      ]),
    });
    cursorY = getLastY();
  }

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: { fontSize: 7.3, cellPadding: 3.2, textColor: charcoal, overflow: 'linebreak' },
    headStyles: { fillColor: orange, textColor: [255, 255, 255] },
    head: [['8-Metric Close Readiness Scorecard', 'YoY Q3 2026 Walk', 'QoQ Q3 2026 Walk']],
    body: [
      ['1. Material Lines Count (>= CAD $1M)', String(yoyEval.materialLinesCount), String(qoqEval.materialLinesCount)],
      ['2. Human-Verified Material Count', String(yoyEval.verifiedMaterialCount), String(qoqEval.verifiedMaterialCount)],
      ['3. Unresolved Material Count (Blocking)', String(yoyEval.pendingMaterialCount), String(qoqEval.pendingMaterialCount)],
      ['4. Unreconciled Discrepancy (CAD)', formatCAD(yoyEval.discrepancyThousands * 1000), formatCAD(qoqEval.discrepancyThousands * 1000)],
      ['5. Period-Specific Open Anomalies (Non-Blocking Prior)', `${yoyEval.openAnomaliesCount} open (${yoyEval.priorPeriodOutstandingItems.length} prior)`, `${qoqEval.openAnomaliesCount} open (${qoqEval.priorPeriodOutstandingItems.length} prior)`],
      ['6. Entries Missing Support Docs (In-Period)', String(yoyEval.missingDocsCount), String(qoqEval.missingDocsCount)],
      ['7. Outstanding Approval Gaps (In-Period)', String(yoyEval.outstandingApprovalsCount), String(qoqEval.outstandingApprovalsCount)],
      ['8. Responsible Owners', yoyEval.responsibleOwners.join('; '), qoqEval.responsibleOwners.join('; ')],
    ],
  });
  cursorY = getLastY();

  // =========================================================================
  // SECTION 4: Irregular Costs and Investigation Priorities
  // =========================================================================
  addSectionHeading(
    `4. Irregular Costs and Investigation Priorities (${APPENDIX_SECTIONS.IRREGULAR_SUMMARY}–${APPENDIX_SECTIONS.IRREGULAR_DETAILS})`,
    `Entry screening flags >= CAD $250,000, missing approvals, duplicate invoices, late close timing, scrap write-offs, GL mismatches, unreversed accruals, uncleared suspense (2890), and unmatched broker shipments (distinct from $1M walk materiality). Official baseline: ${formatCAD(baselineIrTotal)} (7 items); working scenario total: ${formatCAD(workingIrTotal)} (${payload.anomalies.length} items).`
  );

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'striped',
    rowPageBreak: 'avoid',
    styles: { fontSize: 7.2, cellPadding: 3.1, textColor: charcoal, overflow: 'linebreak' },
    headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255] },
    columnStyles: { 3: { halign: 'right' } },
    head: [['ID (Period)', 'Description & Source', 'Owner & Preliminary Note / Status', 'Amount (CAD)', 'Active / Dismissed Rules']],
    body: payload.anomalies.map((item) => {
      const activeFlags = getActiveScreeningFlags(item, payload.anomalies, payload.customsEntries);
      const dismissedNote =
        item.dismissedRules && item.dismissedRules.length > 0
          ? ` | Dismissed: ${item.dismissedRules.map((d) => `${d.ruleId} (${d.dismissedBy})`).join('; ')}`
          : '';
      return [
        `${item.id}\n${item.accountingPeriod}`,
        `${item.title} (${item.provenance === 'Official case baseline' ? 'Baseline' : 'User Scenario'})`,
        `${item.owner} · ${item.status}${item.notes ? ` · ${item.notes}` : ''}`,
        formatCAD(item.amount),
        `Active: ${activeFlags.map((f) => f.ruleId).join(', ') || 'Clear'}${dismissedNote}`,
      ];
    }),
  });
  cursorY = getLastY();

  // =========================================================================
  // SECTION 5: Customs, Broker Fees and Tariff Exposure
  // =========================================================================
  addSectionHeading(
    `5. Customs, Broker Fees and Tariff Exposure (${APPENDIX_SECTIONS.TRADE_SUMMARY}–${APPENDIX_SECTIONS.INTERPROVINCIAL})`,
    `Official Q3 2026 baseline trade costs = CAD $736,770 ($711,250 duties/tariffs + $25,520 billed broker vs $19,960 expected at 0.2% = $8,260 gross / $5,560 net excess; E-11 -$2,700 offset). Interprovincial customer taxes (${formatCAD(interprovTaxTotal)}) are excluded from expense totals; domestic freight = ${formatCAD(interprovFreightTotal)}.`
  );

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: { fontSize: 7.4, cellPadding: 3.3, textColor: charcoal, overflow: 'linebreak' },
    headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    head: [['China Additional Tariff Rate (Fictional Practice Rate)', 'Q3 Extra Tariff', 'Qtr Delta vs 25% Base', 'Annualized Delta (4Q)']],
    body: [
      ['0% (Hypothetical Exemption — Excl. Switching)', formatCAD(0), formatSignedCAD(-chinaSim.baselineChinaAdditionalTariffQ3), formatSignedCAD(-chinaSim.baselineChinaAdditionalTariffQ3 * 4)],
      ['15% Practice Scenario', formatCAD(Math.round(chinaSim.chinaDeclaredValueQ3 * 0.15)), formatSignedCAD(Math.round(chinaSim.chinaDeclaredValueQ3 * 0.15) - chinaSim.baselineChinaAdditionalTariffQ3), formatSignedCAD((Math.round(chinaSim.chinaDeclaredValueQ3 * 0.15) - chinaSim.baselineChinaAdditionalTariffQ3) * 4)],
      ['25% Official Case Baseline (E-04, E-05, E-06)', formatCAD(chinaSim.baselineChinaAdditionalTariffQ3), 'CAD $0', 'CAD $0'],
      ['35% Practice Scenario', formatCAD(Math.round(chinaSim.chinaDeclaredValueQ3 * 0.35)), formatSignedCAD(Math.round(chinaSim.chinaDeclaredValueQ3 * 0.35) - chinaSim.baselineChinaAdditionalTariffQ3), formatSignedCAD((Math.round(chinaSim.chinaDeclaredValueQ3 * 0.35) - chinaSim.baselineChinaAdditionalTariffQ3) * 4)],
      [`Active UI Slider (${payload.chinaScenarioPct}%)`, formatCAD(chinaSim.simulatedChinaAdditionalTariffQ3), formatSignedCAD(chinaSim.quarterlyDelta), formatSignedCAD(chinaSim.annualizedDelta)],
    ],
  });
  cursorY = getLastY();

  // Concise Trade Policy & Rule Changelog Highlights
  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: { fontSize: 7.3, cellPadding: 3.2, textColor: charcoal, overflow: 'linebreak' },
    headStyles: { fillColor: [82, 82, 91], textColor: [255, 255, 255] },
    head: [['Trade Audit Finding / Rule Status', 'Working Figures & Governance Note']],
    body: [
      [
        '0.2% Broker Fee Audit & E-08 CUSMA Candidate',
        `Working ledger (${payload.customsEntries.length} shipments, ${userShipments.length} user scenario): Billed ${formatCAD(workingBrokerBilled)} vs Expected ${formatCAD(workingBrokerExpected)} = Net ${formatSignedCAD(workingBrokerNetVar)}. E-08 Mexico (${formatCAD(11_020)}) is an unverified conditional CUSMA candidate, not guaranteed recovery.`,
      ],
      [
        'Practice-Rate Rules & Change Log',
        `${tariffRules.length} active rule(s); ${tariffChangelog.length} logged change(s). Historical Q3 2026 recorded amounts stay locked even when practice tariff rules are updated for future/working shipments.`,
      ],
      [
        'Interprovincial Tax vs Freight Separation',
        `${payload.interprovincialDeliveries.length} routes: Customer sales tax collected/remitted (${formatCAD(interprovTaxTotal)}) is excluded from duty/cost KPIs; domestic freight expense = ${formatCAD(interprovFreightTotal)}.`,
      ],
    ],
  });
  cursorY = getLastY();

  // =========================================================================
  // SECTION 6: Business Impact, ROI and Implementation
  // =========================================================================
  if (selectedRoiModel === 'presentation_y1') {
    addSectionHeading(
      '6. Business Impact, ROI and Implementation — Group 7 Presentation Model (Year 1)',
      `${PRESENTATION_ROI_DISCLAIMER} External tariff rate shifts, IR-06 non-cash accrual review ($410K), and interprovincial customer sales taxes are excluded from ROI.`
    );

    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: { fontSize: 7.2, cellPadding: 3.1, textColor: charcoal, overflow: 'linebreak' },
      headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255] },
      columnStyles: { 2: { halign: 'right' } },
      head: [['Year-One Implementation Investment (Hypothetical Planning Estimates)', 'Classification', 'Amount (CAD)']],
      body: [
        ['Application development and configuration', 'Hypothetical planning estimate (not vendor quote)', formatCAD(presAssumptions.appDevAndConfigCost)],
        ['ERP integration and security', 'Hypothetical planning estimate (not vendor quote)', formatCAD(presAssumptions.erpIntegrationSecurityCost)],
        ['Staff training', 'Hypothetical planning estimate (not vendor quote)', formatCAD(presAssumptions.staffTrainingCost)],
        ['Cloud operations and support', 'Hypothetical planning estimate (not vendor quote)', formatCAD(presAssumptions.cloudOpsSupportCost)],
        ['Total Year-One Investment', 'Not a SKYJACK-provided budget', formatCAD(presRoi.totalInvestment)],
      ],
    });
    cursorY = getLastY();

    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: { fontSize: 7.1, cellPadding: 3.1, textColor: charcoal, overflow: 'linebreak' },
      headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255] },
      columnStyles: { 3: { halign: 'right' } },
      head: [['Year-One Potential Benefit Category', 'Transparent Formula', 'Evidence & Certainty Classification', 'Amount (CAD)']],
      body: [
        [
          'A. Duplicate Invoice Recovery (IR-03)',
          `${formatCAD(presAssumptions.duplicateInvoiceBaseCAD)} x ${presAssumptions.duplicateRecoveryPct}%`,
          'Case-confirmed base; one-time conditional recovery (not recurring annual savings)',
          formatCAD(presRoi.duplicateInvoiceRecovery),
        ],
        [
          'B. Investigation Time Savings',
          `${presAssumptions.hoursFreedAnnually} hrs/yr x ${formatCAD(presAssumptions.fullyLoadedHourlyRate)}/hr`,
          'Non-cash employee productivity / capacity value (NOT guaranteed cash savings)',
          formatCAD(presRoi.investigationTimeSavings),
        ],
        [
          'C. Avoidable Rush Freight (IR-02)',
          `${formatCAD(presAssumptions.rushFreightQuarterlyBaseCAD)} x ${presAssumptions.rushFreightQuartersPerYear} qtrs x ${presAssumptions.rushFreightAvoidablePct}%`,
          'Case-confirmed Q3 base; hypothetical annualization & avoidable spend (validate in pilot)',
          formatCAD(presRoi.avoidableRushFreight),
        ],
        [
          'D. Broker Fee Recovery (0.2% Audit)',
          `${formatCAD(presAssumptions.brokerNetExcessQuarterlyCAD)} x ${presAssumptions.brokerQuartersPerYear} qtrs x ${presAssumptions.brokerRecoveryPct}%`,
          'Case-confirmed Q3 net excess; hypothetical annualization conditional on invoice recovery',
          formatCAD(presRoi.brokerFeeRecovery),
        ],
        [
          'Total Modeled Year-One Benefits',
          'A + B + C + D',
          'Sum of one-time, non-cash productivity, and conditional/hypothetical items',
          formatCAD(presRoi.totalPotentialBenefits),
        ],
        [
          'Net Estimated Economic Benefit & Year-One ROI',
          `${formatCAD(presRoi.totalPotentialBenefits)} - ${formatCAD(presRoi.totalInvestment)}`,
          `${presRoi.year1RoiPct.toFixed(1)}% Projected Year-One Economic-Value ROI`,
          formatSignedCAD(presRoi.netEconomicBenefit),
        ],
        [
          'Sensitivity Test: Zero Duplicate Recovery (0% IR-03)',
          `Benefits ${formatCAD(presRoi.zeroDuplicatePotentialBenefits)} - ${formatCAD(presRoi.totalInvestment)}`,
          `Downside ROI: ${presRoi.zeroDuplicateRoiPct.toFixed(1)}% (demonstrates why controlled pilot is required)`,
          formatSignedCAD(presRoi.zeroDuplicateNetBenefit),
        ],
      ],
    });
    cursorY = getLastY();

    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: { fontSize: 7.2, cellPadding: 3.2, textColor: charcoal, overflow: 'linebreak' },
      headStyles: { fillColor: orange, textColor: [255, 255, 255] },
      head: [['Rollout Phase / Security Control', 'Prototype vs Production Scope & Pilot Validation Criteria']],
      body: [
        ['Phase 1 · Controlled Pilot Validation', 'Validate IR-03 vendor credit recovery, actual analyst hours freed, multi-quarter rush freight recurrence, and broker invoice recovery before authorizing full Year-1 investment.'],
        ['Phase 2 · Read-Only ERP & Broker EDI', 'Replace CSV ingestion with read-only GL, AP, and CBSA broker B3 feeds; zero automated GL writebacks allowed.'],
        ['Security & Access Architecture', 'Prototype uses Simulated Demo Approval (local browser storage, no identity check). Production adds SAML/OIDC SSO, RBAC segregation of duties, immutable server audit storage, and API/TLS controls.'],
      ],
    });
    cursorY = getLastY();
  } else {
    addSectionHeading(
      '6. Business Impact, ROI and Implementation — Original Three-Year Model',
      'Active Model: Original Three-Year Model (separate from Group 7 Presentation Model — Year 1). All ROI assumptions are user-editable benchmarks — NOT SKYJACK-reported outcomes. The CAD $160,000 Base prevented leakage benchmark is Hypothetical & Must Be Validated in Pilot. External tariff rate shifts are never counted as SKYGUARD ROI savings.'
    );

    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: { fontSize: 7.2, cellPadding: 3.2, textColor: charcoal, overflow: 'linebreak' },
      headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      head: [['11-Metric ROI Comparison — Original Three-Year Model (CAD)', 'Low Scenario', 'Base Scenario', 'High Scenario']],
      body: [
        ['1. Annualized Broker Fee Recovery', formatCAD(lowRoi.annualizedBrokerRecovery), formatCAD(baseRoi.annualizedBrokerRecovery), formatCAD(highRoi.annualizedBrokerRecovery)],
        ['2. Conditional Duplicate Recovery (IR-03, Yr 1)', formatCAD(lowRoi.conditionalDuplicateRecoveryIR03), formatCAD(baseRoi.conditionalDuplicateRecoveryIR03), formatCAD(highRoi.conditionalDuplicateRecoveryIR03)],
        ['3. Conditional Missed CUSMA (E-08, Annual)', formatCAD(lowRoi.conditionalMissedFtaE08Annual), formatCAD(baseRoi.conditionalMissedFtaE08Annual), formatCAD(highRoi.conditionalMissedFtaE08Annual)],
        ['4. Prevented Future Leakage (Hypothetical — Pilot Validate)', formatCAD(lowRoi.preventedFutureLeakageAnnual), formatCAD(baseRoi.preventedFutureLeakageAnnual), formatCAD(highRoi.preventedFutureLeakageAnnual)],
        ['5. Investigation Labor Efficiency Value', formatCAD(lowRoi.annualLaborEfficiencyValue), formatCAD(baseRoi.annualLaborEfficiencyValue), formatCAD(highRoi.annualLaborEfficiencyValue)],
        ['6. Year-1 Gross Benefit (Ramp-Adjusted)', formatCAD(lowRoi.year1GrossBenefit), formatCAD(baseRoi.year1GrossBenefit), formatCAD(highRoi.year1GrossBenefit)],
        ['7. Year-1 Total Cost (Impl. + Training + Ops)', formatCAD(lowRoi.year1TotalCost), formatCAD(baseRoi.year1TotalCost), formatCAD(highRoi.year1TotalCost)],
        ['8. Year-1 Net Benefit', formatSignedCAD(lowRoi.year1NetBenefit), formatSignedCAD(baseRoi.year1NetBenefit), formatSignedCAD(highRoi.year1NetBenefit)],
        ['9. 3-Year Net Benefit', formatSignedCAD(lowRoi.threeYearNetBenefit), formatSignedCAD(baseRoi.threeYearNetBenefit), formatSignedCAD(highRoi.threeYearNetBenefit)],
        ['10. 3-Year Net ROI (%)', `${lowRoi.threeYearRoiPct.toFixed(1)}%`, `${baseRoi.threeYearRoiPct.toFixed(1)}%`, `${highRoi.threeYearRoiPct.toFixed(1)}%`],
        ['11. Simple Payback (Months)', lowRoi.simplePaybackMonths ? `${lowRoi.simplePaybackMonths.toFixed(1)} mos` : 'N/A', baseRoi.simplePaybackMonths ? `${baseRoi.simplePaybackMonths.toFixed(1)} mos` : 'N/A', highRoi.simplePaybackMonths ? `${highRoi.simplePaybackMonths.toFixed(1)} mos` : 'N/A'],
      ],
    });
    cursorY = getLastY();

    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: { fontSize: 7.2, cellPadding: 3.2, textColor: charcoal, overflow: 'linebreak' },
      headStyles: { fillColor: orange, textColor: [255, 255, 255] },
      head: [['Rollout Phase / Security Control', 'Prototype vs Production Scope & Pilot Validation Criteria']],
      body: [
        ['Phase 1 · 4-Week Pilot Validation', 'Validate broker recovery rate (vs 75% Base), IR-03 duplicate recovery, E-08 origin docs, and actual prevented leakage (replace CAD $160,000 placeholder before full CAPEX sign-off).'],
        ['Phase 2 · Read-Only ERP & Broker EDI', 'Replace CSV ingestion with read-only GL, AP, and CBSA broker B3 feeds; zero automated GL writebacks allowed.'],
        ['Security & Access Architecture', 'Prototype uses Simulated Demo Approval (local browser storage, no identity check). Production adds SAML/OIDC SSO, RBAC segregation of duties, immutable server audit storage, and API/TLS controls.'],
      ],
    });
    cursorY = getLastY();
  }

  // =========================================================================
  // SECTION 7: Detailed Supporting Tables and Appendix References
  // =========================================================================
  addSectionHeading(
    `7. Detailed Supporting Tables and Appendix References (${APPENDIX_SECTIONS.YOY_WALK}, ${APPENDIX_SECTIONS.QOQ_WALK}, ${APPENDIX_SECTIONS.CUSTOMS_ENTRIES}, ${APPENDIX_SECTIONS.INTERPROVINCIAL}, ${APPENDIX_SECTIONS.COMPANY_RULES})`,
    'Complete line-by-line YoY/QoQ earnings-walk schedules, all material >= $1M human verification statuses, customs ledger (E-01..E-12 + scenarios), interprovincial routes (IP-01..IP-05), and full Appendix citations.'
  );

  const walkRows: string[][] = [
    ...payload.yoyWalk.lines.map((l) => [
      `YoY (${APPENDIX_SECTIONS.YOY_WALK})`,
      l.label,
      formatSignedCAD(l.amountThousands * 1000),
      Math.abs(l.amountThousands) >= 1000 ? 'Material (>= $1M)' : 'Below $1M',
      `${l.explanationStatus}${l.verifiedBy ? ` · ${l.verifiedBy} (${l.verifiedAt})` : ''}`,
    ]),
    ...payload.qoqWalk.lines.map((l) => [
      `QoQ (${APPENDIX_SECTIONS.QOQ_WALK})`,
      l.label,
      formatSignedCAD(l.amountThousands * 1000),
      Math.abs(l.amountThousands) >= 1000 ? 'Material (>= $1M)' : 'Below $1M',
      `${l.explanationStatus}${l.verifiedBy ? ` · ${l.verifiedBy} (${l.verifiedAt})` : ''}`,
    ]),
  ];

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'striped',
    rowPageBreak: 'avoid',
    styles: { fontSize: 7.0, cellPadding: 2.9, textColor: charcoal, overflow: 'linebreak' },
    headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255] },
    columnStyles: { 2: { halign: 'right' } },
    head: [['Walk', 'Earnings Line', 'Signed Change', 'Materiality', 'Verification Status']],
    body: walkRows,
  });
  cursorY = getLastY();

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'striped',
    rowPageBreak: 'avoid',
    styles: { fontSize: 6.9, cellPadding: 2.9, textColor: charcoal, overflow: 'linebreak' },
    headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255] },
    columnStyles: { 3: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
    head: [['ID', 'Route & Goods', 'Source', 'Declared', 'Duty Policy', 'Duty/Tariff', 'Billed Fee', 'Var vs 0.2%']],
    body: payload.customsEntries.map((c) => [
      c.id,
      `${c.route} (${c.goods})`,
      c.provenance === 'Official case baseline' ? 'Baseline' : 'Scenario',
      formatCAD(c.declaredValue),
      c.dutyPolicyLabel,
      formatCAD(c.assessedDutyAndTariffs),
      formatCAD(c.billedBrokerFee),
      formatSignedCAD(c.brokerVariance),
    ]),
  });
  cursorY = getLastY();

  autoTable(doc, {
    startY: cursorY,
    margin: { left: margin, right: margin },
    theme: 'striped',
    rowPageBreak: 'avoid',
    styles: { fontSize: 7.1, cellPadding: 3.0, textColor: charcoal, overflow: 'linebreak' },
    headStyles: { fillColor: [82, 82, 91], textColor: [255, 255, 255] },
    columnStyles: { 2: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    head: [['Route ID', 'Destination', 'Sales Amount', 'Tax Regime', 'Customer Tax (Remitted)', 'Freight Expense']],
    body: [
      ...payload.interprovincialDeliveries.map((d) => [
        d.id,
        d.destination,
        formatCAD(d.salesAmount),
        d.taxLabel,
        formatCAD(d.customerSalesTax),
        formatCAD(d.freightExpense),
      ]),
      [
        'TOTAL',
        `${payload.interprovincialDeliveries.length} routes`,
        formatCAD(payload.interprovincialDeliveries.reduce((s, d) => s + d.salesAmount, 0)),
        '0% Customs Duty',
        formatCAD(interprovTaxTotal),
        formatCAD(interprovFreightTotal),
      ],
    ],
  });
  cursorY = getLastY();

  ensureSpace(54);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...muted);
  const disclaimerLines = doc.splitTextToSize(
    `Appendix Citations: ${APPENDIX_SECTIONS.INCOME_STATEMENTS} (Income Statements), ${APPENDIX_SECTIONS.YOY_WALK} (YoY Walk), ${APPENDIX_SECTIONS.QOQ_WALK} (QoQ Walk), ${APPENDIX_SECTIONS.REGIONAL_SALES} (Regional Sales), ${APPENDIX_SECTIONS.IRREGULAR_SUMMARY}–${APPENDIX_SECTIONS.IRREGULAR_DETAILS} (Irregular Costs), ${APPENDIX_SECTIONS.TRADE_SUMMARY}–${APPENDIX_SECTIONS.TRADE_TRENDS} (Customs, Broker 0.2%, China Tariffs & Interprovincial), ${APPENDIX_SECTIONS.COMPANY_RULES} (Governance Rules). ` +
      'Notice: SKYGUARD AI is a Prompt to Pitch 2026 student competition prototype and is not officially endorsed or deployed by SKYJACK Inc. Browser persistence (localStorage schema v2) stores working edits locally only; approvals shown are Simulated Demo Approvals without live ERP writebacks or enterprise authentication.',
    contentWidth
  );
  doc.text(disclaimerLines, margin, cursorY);

  // Page numbers on every page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(...muted);
    doc.text(
      'SKYGUARD AI — Prompt to Pitch 2026 Student Competition Prototype · Fictional Case Figures (CAD)',
      margin,
      pageHeight - 20
    );
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 20, {
      align: 'right',
    });
  }

  const blob = doc.output('blob');
  return { blob, filename };
}
