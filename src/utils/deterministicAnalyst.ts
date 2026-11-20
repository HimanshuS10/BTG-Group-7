import {
  CASE_CONSTANTS,
  DEFAULT_PRESENTATION_ROI_ASSUMPTIONS,
  DEFAULT_ROI_ASSUMPTIONS,
  HISTORICAL_QUARTERLY_SERIES,
  OFFICIAL_CUSTOMS_ENTRIES,
  OFFICIAL_QOQ_WALK,
  OFFICIAL_YOY_WALK,
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
  AnalystCitation,
  CustomsEntry,
  InterprovincialDelivery,
  IrregularCostItem,
  PeriodCloseApprovalRecord,
  PresentationROIYear1Assumptions,
  ROIAssumptions,
  ROIModelSelection,
  WalkLineOverride,
} from '../types/skyguard';

export interface DeterministicAnalystResponse {
  answer: string;
  citations: AnalystCitation[];
  calculations: { label: string; value: string }[];
}

export const PRESET_ANALYST_QUESTIONS = [
  'Why did operating earnings change?',
  'Which costs deserve immediate investigation?',
  'Which shipments have unusual broker fees?',
  'What happens if tariffs rise to 35%?',
  'What if China additional tariffs drop to 15%?',
  'How are interprovincial taxes handled?',
  'What is the SKYGUARD AI business case and ROI?',
] as const;

export function buildDeterministicAnalystResponse(
  question: string,
  anomalies: IrregularCostItem[],
  customsEntries: CustomsEntry[] = OFFICIAL_CUSTOMS_ENTRIES,
  interprovincial: InterprovincialDelivery[] = [],
  walkLineOverrides: Record<string, WalkLineOverride> = {},
  periodCloseApprovals: Record<string, PeriodCloseApprovalRecord> = {},
  selectedRoiModel: ROIModelSelection = 'presentation_y1',
  presentationRoiAssumptions: PresentationROIYear1Assumptions = DEFAULT_PRESENTATION_ROI_ASSUMPTIONS,
  roiAssumptions: ROIAssumptions = DEFAULT_ROI_ASSUMPTIONS
): DeterministicAnalystResponse {
  const q = question.toLowerCase();

  // 1. Operating earnings change (YoY & QoQ official walks)
  if (
    q.includes('operating earnings') ||
    q.includes('earnings change') ||
    q.includes('walk') ||
    q.includes('materiality') ||
    q.includes('close')
  ) {
    const yoyWalk = {
      ...OFFICIAL_YOY_WALK,
      lines: OFFICIAL_YOY_WALK.lines.map((l) =>
        walkLineOverrides[l.id] ? { ...l, ...walkLineOverrides[l.id] } : l
      ),
    };
    const qoqWalk = {
      ...OFFICIAL_QOQ_WALK,
      lines: OFFICIAL_QOQ_WALK.lines.map((l) =>
        walkLineOverrides[l.id] ? { ...l, ...walkLineOverrides[l.id] } : l
      ),
    };
    const yoySummary = evaluateWalkReconciliation(yoyWalk, anomalies, anomalies, periodCloseApprovals);
    const qoqSummary = evaluateWalkReconciliation(qoqWalk, anomalies, anomalies, periodCloseApprovals);
    const q3 = HISTORICAL_QUARTERLY_SERIES[7];
    const q3Prior = HISTORICAL_QUARTERLY_SERIES[3];
    const q2 = HISTORICAL_QUARTERLY_SERIES[6];
    const q3Approval = periodCloseApprovals['Q3 2026'];

    return {
      answer:
        `Official Q3 2026 operating earnings INCREASED to ${formatCAD(CASE_CONSTANTS.Q3_2026_EARNINGS_CAD)} (CAD $20.7M) on sales of CAD $${q3.salesM.toFixed(1)}M (Appendix Section 1.1):\n\n` +
        `• Year-over-Year (Q3 2025 -> Q3 2026, Section 1.2): Operating earnings INCREASED by +CAD $5,500,000 (from CAD $${q3Prior.operatingEarningsM.toFixed(1)}M to CAD $${q3.operatingEarningsM.toFixed(1)}M), while sales rose +CAD $17,100,000 (+5.5%). Four walk lines exceed the CAD $1,000,000 materiality threshold (Section 4.1): Sales volume (+CAD $13.8M), Sales price (+CAD $2.4M), Variable costs volume (-CAD $6.3M), and Fixed plant wage increases (-CAD $1.4M). Source amounts are confirmed; Stage 1 Financially Reconciled (${yoySummary.isReconciled ? '$0 gap' : 'gap'}) is strictly separate from Stage 2 Controller Gate (${yoySummary.closeStatus}).\n\n` +
        `• Quarter-over-Quarter (Q2 2026 -> Q3 2026, Section 1.3): Operating earnings INCREASED by +CAD $4,200,000 (from CAD $${q2.operatingEarningsM.toFixed(1)}M to CAD $${q3.operatingEarningsM.toFixed(1)}M). Material >= $1M walk lines are Sales volume (+CAD $8.4M), Sales price (+CAD $1.7M), Sales FX (+CAD $1.2M), and Variable costs volume (-CAD $4.6M). Stage 2 Gate: ${qoqSummary.closeStatus}.\n\n` +
        `• Close Approval Governance: A period only reaches "Approved for Close" when all prerequisites are satisfied AND a controller explicitly records "Simulated Demo Approval — Identity Not Verified" for that period${q3Approval?.status === 'Suspended' ? ' (Note: prior Q3 2026 approval is currently Suspended — Re-Review Required)' : ''}.\n\n` +
        `• Linked Irregular Items (Section 2.3): Note that IR-01 (-CAD $900K Plant 2 scrap) and IR-02 (-CAD $600K rush freight) are already included in the official YoY walk (under Fixed plant: one-time scrap and SG&A: rush freight) and must NOT be double-counted. Neither reaches $1M individually, though both trigger the $250K operational cost screen.`,
      citations: [
        { id: 'Section 1.2 · YoY Walk', label: 'Q3 2025 -> Q3 2026 Official Bridge (+$5.5M)', amountText: '+CAD $5,500,000', section: 'close' },
        { id: 'Section 1.3 · QoQ Walk', label: 'Q2 2026 -> Q3 2026 Official Bridge (+$4.2M)', amountText: '+CAD $4,200,000', section: 'close' },
        { id: 'IR-01 (Sec 2.3)', label: 'Plant 2 scrap write-off (Linked to YoY -900K)', amountText: formatCAD(-900_000), section: 'anomalies' },
        { id: 'IR-02 (Sec 2.3)', label: 'Rush freight premium (Linked to YoY -600K)', amountText: formatCAD(-600_000), section: 'anomalies' },
      ],
      calculations: [
        { label: 'YoY / QoQ Change', value: '+$5.5M / +$4.2M' },
        { label: 'Stage 1 Reconciled', value: yoySummary.isReconciled && qoqSummary.isReconciled ? 'Exact ($0 gap)' : 'Unreconciled' },
        { label: 'Stage 2 YoY Close Gate', value: yoySummary.closeStatus },
        { label: 'Stage 2 QoQ Close Gate', value: qoqSummary.closeStatus },
      ],
    };
  }

  // 2. Immediate investigation priorities
  if (
    q.includes('immediate') ||
    q.includes('investigat') ||
    q.includes('anomal') ||
    q.includes('approval') ||
    q.includes('ir-') ||
    q.includes('irregular')
  ) {
    const baseline = anomalies.filter((a) => a.provenance === 'Official case baseline');
    const userAdded = anomalies.filter((a) => a.provenance === 'User-added scenario');
    const flagged = anomalies.filter((a) => getActiveScreeningFlags(a, anomalies, customsEntries).length > 0);
    const over250k = anomalies.filter((a) => a.amount >= CASE_CONSTANTS.TRANSACTION_ALERT_THRESHOLD_CAD);
    const missingConfirmed = anomalies.filter((a) => a.approvalState === 'Confirmed Missing');

    return {
      answer:
        `The seven official Q3 2026 irregular entries (IR-01 through IR-07, Appendix Section 2.1–2.3) total exactly ${formatCAD(baseline.reduce((s, a) => s + a.amount, 0))} (North America: ${formatCAD(baseline.filter((a) => a.regionGroup === 'North America').reduce((s, a) => s + a.amount, 0))}; Finance: ${formatCAD(baseline.filter((a) => a.department === 'Finance').reduce((s, a) => s + a.amount, 0))}). None reaches CAD $1,000,000 individually (Section 4.1).\n\n` +
        `Active SKYGUARD screening triggers (${flagged.length} items including ${userAdded.length} user-added scenario item(s)): ` +
        `${over250k.length} entries exceed the CAD $250,000 entry screen (IR-01 $900K, IR-02 $600K, IR-06 $410K, IR-04 $340K, IR-03 $265K), ` +
        `while IR-05 ($185K consultant payment) triggers for CONFIRMED missing approval/no PO and IR-07 ($118K) triggers for an unmatched customs broker shipment.\n\n` +
        `Note on evidence discipline: A flagged entry is NOT proof of fraud. IR-01 ($900K scrap) triggers >=$250K, close timing, scrap write-off, and support gap (not accrual reversal); IR-02 ($600K) is a potential SG&A vs Freight Out coding check (not automatic cash saving); IR-03 ($265K) and IR-06 ($410K) require human verification before any recovery or accrual adjustment.`,
      citations: flagged.slice(0, 6).map((item) => ({
        id: item.id,
        label: `${item.title} (${item.status})`,
        amountText: formatCAD(item.amount),
        section: 'anomalies',
      })),
      calculations: [
        { label: 'Official Baseline (7 IR)', value: formatCAD(2_818_000) },
        { label: 'Working Scenario Total', value: formatCAD(anomalies.reduce((s, a) => s + a.amount, 0)) },
        { label: 'Entries >= CAD $250K', value: `${over250k.length} entries` },
        { label: 'Confirmed Missing Approval', value: `${missingConfirmed.length} (IR-05 baseline)` },
      ],
    };
  }

  // 3. Unusual broker fees / shipments
  if (
    q.includes('broker') ||
    q.includes('shipment') ||
    q.includes('overcharge') ||
    q.includes('undercharge') ||
    q.includes('0.2%') ||
    q.includes('cusma') ||
    q.includes('e-0') ||
    q.includes('e-1')
  ) {
    const expectedTotal = customsEntries.reduce((s, e) => s + e.expectedBrokerFee, 0);
    const billedTotal = customsEntries.reduce((s, e) => s + e.billedBrokerFee, 0);
    const grossOver = customsEntries.filter((e) => e.brokerVariance > 0).reduce((s, e) => s + e.brokerVariance, 0);
    const grossUnder = customsEntries.filter((e) => e.brokerVariance < 0).reduce((s, e) => s + Math.abs(e.brokerVariance), 0);
    const netExcess = billedTotal - expectedTotal;
    const e08 = customsEntries.find((e) => e.id === 'E-08');

    return {
      answer:
        `Across the ${customsEntries.length} tracked shipments (Section 3.1–3.3; Declared Value: ${formatCAD(customsEntries.reduce((s, e) => s + e.declaredValue, 0))}), contractual broker fees at 0.2% equal ${formatCAD(expectedTotal)}, whereas billed broker fees totaled ${formatCAD(billedTotal)} — a NET broker excess of ${formatCAD(netExcess)}.\n\n` +
        `• Largest Overcharges: E-04 (China electric motors, +${formatCAD(2_700)}: billed $4,500 vs $1,800 expected), E-06 (+${formatCAD(2_100)}), E-05 (+${formatCAD(1_500)}), E-10 (+${formatCAD(800)}), E-12 (+${formatCAD(420)}), E-09 (+${formatCAD(290)}), E-07 (+${formatCAD(260)}), and E-08 (+${formatCAD(190)}). Gross overcharges total ${formatCAD(grossOver)}.\n` +
        `• Undercharge Offset: E-11 (Guelph -> Chicago, DAP scissor lifts) was undercharged by -${formatCAD(grossUnder)} (billed $2,100 vs $4,800 expected), bringing net broker excess to ${formatCAD(netExcess)}.\n` +
        `• Potential Missed Agreement Claim: ${e08 ? `E-08 (Mexico -> Guelph wire harnesses) incurred ${formatCAD(e08.assessedDutyAndTariffs)} in 2.9% MFN duty because CUSMA was not claimed. This is a conditional recovery candidate pending valid origin documentation — not a guaranteed refund.` : 'Check E-08 for missed CUSMA documentation.'}`,
      citations: [
        { id: 'E-04 (Sec 3.2/3.3)', label: 'China -> Guelph · Billed $4,500 vs $1,800 (0.2%)', amountText: '+CAD $2,700', section: 'trade' },
        { id: 'E-06 (Sec 3.2/3.3)', label: 'China -> Guelph · Billed $3,500 vs $1,400 (0.2%)', amountText: '+CAD $2,100', section: 'trade' },
        { id: 'E-11 (Sec 3.3)', label: 'Guelph -> Chicago DAP · Broker Undercharge', amountText: '-CAD $2,700', section: 'trade' },
        { id: 'E-08 (Sec 3.2)', label: 'Mexico -> Guelph · Possible Missed CUSMA Claim', amountText: 'CAD $11,020 duty', section: 'trade' },
      ],
      calculations: [
        { label: 'Expected Broker (0.2%)', value: formatCAD(expectedTotal) },
        { label: 'Billed Broker Fees', value: formatCAD(billedTotal) },
        { label: 'Gross Overcharges / Under', value: `+${formatCAD(grossOver)} / -${formatCAD(grossUnder)}` },
        { label: 'Net Broker Excess', value: formatCAD(netExcess) },
      ],
    };
  }

  // 4. China tariff 15% / 35% / 0% simulation
  if (
    q.includes('35%') ||
    q.includes('15%') ||
    q.includes('tariff') ||
    q.includes('china') ||
    q.includes('scenario')
  ) {
    const rate = q.includes('15%') ? 0.15 : q.includes('0%') ? 0 : 0.35;
    const sim = calculateChinaTariffSimulation(customsEntries, rate);
    const pctLabel = `${Math.round(rate * 100)}%`;

    return {
      answer:
        `Using the official Appendix Section 3.4 China-additional-tariff entries (E-04 $900K, E-05 $500K, E-06 $700K = ${formatCAD(sim.chinaDeclaredValueQ3)} per quarter), the baseline 25% additional tariff equals ${formatCAD(sim.baselineChinaAdditionalTariffQ3)}/quarter. Ordinary motor MFN duty (${formatCAD(sim.ordinaryChinaMotorDutyQ3)}/quarter on E-04 and E-06) remains separate and unchanged.\n\n` +
        `• At ${pctLabel} Additional China Tariff: China additional tariff becomes ${formatCAD(sim.simulatedChinaAdditionalTariffQ3)}/quarter — a ${sim.quarterlyDelta >= 0 ? 'cost increase' : 'cost reduction'} of ${formatSignedCAD(sim.quarterlyDelta)}/quarter and ${formatSignedCAD(sim.annualizedDelta)}/year assuming constant quarterly shipment volume.\n` +
        `• Total Q3 Trade Cost Impact: Holding all other Q3 customs entries constant, total duty + tariff + broker cost moves from ${formatCAD(sim.baselineTotalTradeCostQ3)} to ${formatCAD(sim.simulatedTotalTradeCostQ3)}.\n\n` +
        `${rate === 0 ? 'Note: 0% assumes qualifying CUSMA/alternative-origin sourcing, excluding supplier switching or qualification costs — do not treat as guaranteed.\n' : ''}` +
        `Reminder: All tariff rates are fictional competition case assumptions (Section 3.4), and external government tariff movements are NOT savings generated by SKYGUARD AI.`,
      citations: [
        { id: 'E-04', label: 'China -> Guelph electric motors ($900K declared)', amountText: formatCAD(Math.round(900_000 * rate)), section: 'trade' },
        { id: 'E-05', label: 'China -> Guelph control modules ($500K declared)', amountText: formatCAD(Math.round(500_000 * rate)), section: 'trade' },
        { id: 'E-06', label: 'China -> Guelph electric motors ($700K declared)', amountText: formatCAD(Math.round(700_000 * rate)), section: 'trade' },
      ],
      calculations: [
        { label: 'China Value (E-04..E-06)', value: formatCAD(sim.chinaDeclaredValueQ3) },
        { label: 'Baseline 25% Extra Tariff', value: formatCAD(sim.baselineChinaAdditionalTariffQ3) },
        { label: `${pctLabel} Quarterly Delta`, value: formatSignedCAD(sim.quarterlyDelta) },
        { label: `${pctLabel} Annualized (4Q)`, value: formatSignedCAD(sim.annualizedDelta) },
      ],
    };
  }

  // 5. Interprovincial sales tax vs freight
  if (
    q.includes('interprovincial') ||
    q.includes('sales tax') ||
    q.includes('gst') ||
    q.includes('qst') ||
    q.includes('hst') ||
    q.includes('freight')
  ) {
    const totalSales = interprovincial.reduce((s, d) => s + d.salesAmount, 0) || CASE_CONSTANTS.INTERPROVINCIAL_SALES_TOTAL_CAD;
    const totalTax = interprovincial.reduce((s, d) => s + d.customerSalesTax, 0) || CASE_CONSTANTS.INTERPROVINCIAL_TAX_TOTAL_CAD;
    const totalFreight = interprovincial.reduce((s, d) => s + d.freightExpense, 0) || CASE_CONSTANTS.INTERPROVINCIAL_FREIGHT_TOTAL_CAD;

    return {
      answer:
        `Inside Canada there is NO customs duty (Appendix Section 3.5). Across the five official Canadian interprovincial deliveries (Calgary AB, Vancouver BC, Montreal QC, Halifax NS, Winnipeg MB):\n` +
        `• Total Interprovincial Sales: ${formatCAD(totalSales)}\n` +
        `• Collected Customer Sales Taxes (GST/PST/QST/HST/RST): ${formatCAD(totalTax)} — these are customer tax collections remitted to tax authorities and must NEVER be added into SKYJACK financial losses, customs duties, or cost-recovery opportunities.\n` +
        `• Domestic Outbound Freight Expense: ${formatCAD(totalFreight)} — this is the actual logistics cost tracked separately from international customs duty/tariffs (${formatCAD(CASE_CONSTANTS.TRADE_ALL_IN_TOTAL_CAD)}, Section 3.1).`,
      citations: [
        { id: 'IP-01..IP-05 (Sec 3.5)', label: 'Five Canadian Interprovincial Deliveries', amountText: formatCAD(totalFreight) + ' freight', section: 'interprovincial' },
        { id: 'E-01..E-12 (Sec 3.1/3.2)', label: 'International Customs & Broker Ledger', amountText: formatCAD(736_770), section: 'trade' },
      ],
      calculations: [
        { label: 'Interprovincial Sales', value: formatCAD(totalSales) },
        { label: 'Customer Sales Tax (Separate)', value: formatCAD(totalTax) },
        { label: 'Interprovincial Freight', value: formatCAD(totalFreight) },
        { label: 'Domestic Customs Duty', value: 'CAD $0' },
      ],
    };
  }

  // 6. Business Impact & ROI (strictly aligned with currently selected ROI model)
  if (
    q.includes('roi') ||
    q.includes('business case') ||
    q.includes('business impact') ||
    q.includes('payback') ||
    q.includes('investment') ||
    q.includes('presentation model') ||
    q.includes('economic value') ||
    q.includes('economic-value') ||
    q.includes('sensitivity')
  ) {
    if (selectedRoiModel === 'presentation_y1') {
      const pres = calculatePresentationYear1ROI(presentationRoiAssumptions);
      return {
        answer:
          `Active ROI Model: Group 7 Presentation Model — Year 1 (12-Month Economic-Value Horizon; separate from the Original Three-Year Model).\n\n` +
          `• Proposed Year-One Investment (Hypothetical Planning Estimate — NOT SKYJACK budget/vendor quote): ${formatCAD(pres.totalInvestment)} ` +
          `(App Dev & Config ${formatCAD(presentationRoiAssumptions.appDevAndConfigCost)} + ERP Integration & Security ${formatCAD(presentationRoiAssumptions.erpIntegrationSecurityCost)} + Staff Training ${formatCAD(presentationRoiAssumptions.staffTrainingCost)} + Cloud Ops & Support ${formatCAD(presentationRoiAssumptions.cloudOpsSupportCost)}).\n\n` +
          `• Modeled Year-One Potential Benefits (${formatCAD(pres.totalPotentialBenefits)} total):\n` +
          `  A. Duplicate Invoice Recovery (One-time conditional recovery, not recurring): ${formatCAD(presentationRoiAssumptions.duplicateInvoiceBaseCAD)} × ${presentationRoiAssumptions.duplicateRecoveryPct}% = ${formatCAD(pres.duplicateInvoiceRecovery)}\n` +
          `  B. Investigation Time Savings (Non-cash productivity/capacity value): ${presentationRoiAssumptions.hoursFreedAnnually} hrs × ${formatCAD(presentationRoiAssumptions.fullyLoadedHourlyRate)}/hr = ${formatCAD(pres.investigationTimeSavings)}\n` +
          `  C. Avoidable Rush Freight (Hypothetical annualization — validate in pilot): ${formatCAD(presentationRoiAssumptions.rushFreightQuarterlyBaseCAD)} × ${presentationRoiAssumptions.rushFreightQuartersPerYear} qtrs × ${presentationRoiAssumptions.rushFreightAvoidablePct}% = ${formatCAD(pres.avoidableRushFreight)}\n` +
          `  D. Broker Fee Recovery (Conditional on invoice verification): ${formatCAD(presentationRoiAssumptions.brokerNetExcessQuarterlyCAD)} × ${presentationRoiAssumptions.brokerQuartersPerYear} qtrs × ${presentationRoiAssumptions.brokerRecoveryPct}% = ${formatCAD(pres.brokerFeeRecovery)}\n\n` +
          `• Net Estimated Economic Benefit: ${formatSignedCAD(pres.netEconomicBenefit)} -> ${pres.year1RoiPct.toFixed(1)}% Projected Year-One Economic-Value ROI.\n` +
          `• Zero Duplicate Recovery Sensitivity Test (0% IR-03 Recovery): Potential benefits drop to ${formatCAD(pres.zeroDuplicatePotentialBenefits)}, net benefit ${formatSignedCAD(pres.zeroDuplicateNetBenefit)}, ROI ${pres.zeroDuplicateRoiPct.toFixed(1)}% — underscoring why a controlled pilot is required.\n\n` +
          `Disclaimer: ${PRESENTATION_ROI_DISCLAIMER}`,
        citations: [
          {
            id: 'Group 7 Model · Yr 1',
            label: `Active ROI Scenario (${pres.year1RoiPct.toFixed(1)}% Yr-1 ROI)`,
            amountText: formatSignedCAD(pres.netEconomicBenefit),
            section: 'roi',
          },
          {
            id: 'IR-03 (Sec 2.3)',
            label: 'Duplicate Invoice Base (One-Time Conditional)',
            amountText: formatCAD(presentationRoiAssumptions.duplicateInvoiceBaseCAD),
            section: 'anomalies',
          },
          {
            id: 'IR-02 (Sec 2.3)',
            label: 'Q3 Rush Freight Base (Hypothetical 4Q Annualization)',
            amountText: formatCAD(presentationRoiAssumptions.rushFreightQuarterlyBaseCAD),
            section: 'anomalies',
          },
          {
            id: 'Sec 3.3 · Broker Audit',
            label: 'Q3 Net Broker Excess Base (0.2% Contract)',
            amountText: formatCAD(presentationRoiAssumptions.brokerNetExcessQuarterlyCAD),
            section: 'trade',
          },
        ],
        calculations: [
          { label: 'Year-1 Investment', value: formatCAD(pres.totalInvestment) },
          { label: 'Potential Benefits', value: formatCAD(pres.totalPotentialBenefits) },
          { label: 'Net Benefit / Yr-1 ROI', value: `${formatSignedCAD(pres.netEconomicBenefit)} (${pres.year1RoiPct.toFixed(1)}%)` },
          { label: '0% Dup Sensitivity ROI', value: `${pres.zeroDuplicateRoiPct.toFixed(1)}% (${formatSignedCAD(pres.zeroDuplicateNetBenefit)})` },
        ],
      };
    }

    const orig = calculateTrustworthyROI(roiAssumptions, customsEntries);
    return {
      answer:
        `Active ROI Model: Original Three-Year Model (36-Month Horizon; separate from Group 7 Presentation Model — Year 1).\n\n` +
        `• Year-1 Total Cost: ${formatCAD(orig.year1TotalCost)} (Implementation ${formatCAD(roiAssumptions.implementationCost)} + Training ${formatCAD(roiAssumptions.employeeTrainingCost)} + 12m Maintenance ${formatCAD(orig.annualOperatingCost)}); 3-Year Total Cost: ${formatCAD(orig.threeYearTotalCost)}.\n` +
        `• Year-1 Gross / Net Benefit: ${formatCAD(orig.year1GrossBenefit)} gross / ${formatSignedCAD(orig.year1NetBenefit)} net (${orig.year1RoiPct.toFixed(1)}% Year-1 ROI).\n` +
        `• 3-Year Cumulative Net Benefit: ${formatSignedCAD(orig.threeYearNetBenefit)} (${orig.threeYearRoiPct.toFixed(1)}% 3-Year ROI; Simple Payback: ${orig.simplePaybackMonths !== null ? `${orig.simplePaybackMonths.toFixed(1)} months` : 'N/A'}).\n` +
        `• Note: Includes hypothetical prevented leakage (${formatCAD(orig.preventedFutureLeakageAnnual)}/yr after ${roiAssumptions.adoptionFactorPct}% adoption) which must be validated in a pilot. External China tariff shifts and IR-06 non-cash accrual review are excluded.`,
      citations: [
        {
          id: 'Original 3-Yr Model',
          label: `Active ROI Scenario (${orig.threeYearRoiPct.toFixed(1)}% 3-Yr ROI)`,
          amountText: formatSignedCAD(orig.threeYearNetBenefit),
          section: 'roi',
        },
        {
          id: 'IR-03 (Sec 2.3)',
          label: 'Conditional Duplicate Recovery (Yr-1 Only)',
          amountText: formatCAD(orig.conditionalDuplicateRecoveryIR03),
          section: 'anomalies',
        },
      ],
      calculations: [
        { label: 'Year-1 Net Benefit', value: formatSignedCAD(orig.year1NetBenefit) },
        { label: '3-Year Net Benefit', value: formatSignedCAD(orig.threeYearNetBenefit) },
        { label: '3-Year ROI', value: `${orig.threeYearRoiPct.toFixed(1)}%` },
        { label: 'Simple Payback', value: orig.simplePaybackMonths !== null ? `${orig.simplePaybackMonths.toFixed(1)} mos` : 'N/A' },
      ],
    };
  }

  // Honest "I don't know / Not provided in case" fallback for out-of-scope questions
  return {
    answer:
      `I cannot answer that beyond what is documented in the SKYJACK Q3 2026 Appendix dataset (Fictional competition case figures — CAD). Details such as unrecorded approvers (IR-05), unknown suspense preparer (IR-04), vendor collection outcomes (IR-03), underlying earnings-walk driver mixes (Section 1.2–1.3), exchange-rate spot tables, or real-world CBSA tariff rulings are "Not provided in case" and require human verification.\n\n` +
      `Verified Q3 2026 Baseline Totals:\n` +
      `• Q3 Sales: CAD $329.7M | Q3 Operating Earnings: CAD $20.7M (+CAD $5.5M YoY Sec 1.2, +CAD $4.2M QoQ Sec 1.3)\n` +
      `• Official Irregular Costs (Section 2.1–2.3): ${formatCAD(2_818_000)} (North America: ${formatCAD(2_028_000)})\n` +
      `• Official Customs & Broker Costs (Section 3.1–3.3): ${formatCAD(736_770)} (Net broker excess: ${formatCAD(5_560)})`,
    citations: [
      { id: 'Section 2.1–2.3', label: 'Q3 Irregular Cost Ledger', amountText: formatCAD(2_818_000), section: 'anomalies' },
      { id: 'Section 3.1–3.3', label: 'Q3 Customs & Broker Ledger', amountText: formatCAD(736_770), section: 'trade' },
    ],
    calculations: [
      { label: 'Q3 Operating Earnings', value: formatCAD(20_700_000) },
      { label: 'Official Irregular Items', value: formatCAD(2_818_000) },
      { label: 'Official Trade All-In', value: formatCAD(736_770) },
      { label: 'Interprovincial Customer Tax', value: formatCAD(799_525) },
    ],
  };
}
