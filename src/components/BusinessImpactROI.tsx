import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  RotateCcw,
  ShieldAlert,
  TrendingDown,
} from 'lucide-react';
import {
  CASE_CONSTANTS,
  DEFAULT_PRESENTATION_ROI_ASSUMPTIONS,
  DEFAULT_ROI_ASSUMPTIONS,
  PRESENTATION_ROI_DISCLAIMER,
  calculatePresentationYear1ROI,
  calculateTrustworthyROI,
  formatCAD,
  formatSignedCAD,
} from '../data/skyjackCaseData';
import type {
  CustomsEntry,
  PresentationROIYear1Assumptions,
  ROIAssumptions,
  ROIModelSelection,
} from '../types/skyguard';

interface BusinessImpactROIProps {
  selectedModel: ROIModelSelection;
  onSelectModel: (model: ROIModelSelection) => void;
  presentationAssumptions: PresentationROIYear1Assumptions;
  onChangePresentationAssumptions: (next: PresentationROIYear1Assumptions) => void;
  assumptions: ROIAssumptions;
  customsEntries: CustomsEntry[];
  onChangeAssumptions: (next: ROIAssumptions) => void;
}

type ScenarioPresetKey = 'low' | 'base' | 'high';

const SCENARIO_PRESETS: Record<
  ScenarioPresetKey,
  { label: string; description: string; patch: Partial<ROIAssumptions> }
> = {
  low: {
    label: 'Low',
    description: 'Slower adoption (55%), 50% broker recovery, zero duplicate AP recovery, 50% Year-1 ramp.',
    patch: {
      adoptionFactorPct: 55,
      year1RampUpPct: 50,
      brokerRecoveryLikelihoodPct: 50,
      duplicateRecoveryLikelihoodPct: 0,
      missedFtaRecoveryLikelihoodPct: 25,
      annualPreventedLeakageBase: 100_000,
    },
  },
  base: {
    label: 'Base',
    description: 'Balanced 75% adoption, 70% Year-1 ramp, 50% conditional IR-03 & E-08 realization.',
    patch: DEFAULT_ROI_ASSUMPTIONS,
  },
  high: {
    label: 'High',
    description: 'High multi-plant adoption (90%), 85% Year-1 ramp, stronger broker & FTA recovery.',
    patch: {
      adoptionFactorPct: 90,
      year1RampUpPct: 85,
      brokerRecoveryLikelihoodPct: 90,
      duplicateRecoveryLikelihoodPct: 85,
      missedFtaRecoveryLikelihoodPct: 75,
      annualPreventedLeakageBase: 220_000,
    },
  },
};

const ROADMAP_PHASES = [
  {
    phase: 'Phase 1 · Weeks 1–4',
    title: 'Pilot & Historical Audit',
    owner: 'Dana (Plant), Helen (Close), Marco (Trade)',
    scope:
      'Validate Q3 2026 irregular entries (IR-01..IR-07) and E-01..E-12 customs broker invoices; lock 0.2% rate audit and CUSMA origin check.',
    gate: 'Controller sign-off on recovery & QA evidence',
  },
  {
    phase: 'Phase 2 · Weeks 5–10',
    title: 'Read-Only ERP & Broker EDI Ingestion',
    owner: 'IT / ERP + Customs Operations',
    scope:
      'Connect read-only AP ledger feeds, CSV/EDI broker billing streams, and automated Account 2890 suspense mapping alerts.',
    gate: 'Zero automated writebacks; read-only control verified',
  },
  {
    phase: 'Phase 3 · Weeks 11–14',
    title: 'Human Governance & Approval Controls',
    owner: 'VP Finance & Plant Controllers',
    scope:
      'Enforce $250K transaction screening vs. $1M close-walk materiality gating, mandatory PO approver capture, and human correction decisions.',
    gate: '100% dual-approval control test pass',
  },
  {
    phase: 'Phase 4 · Weeks 15–20',
    title: 'Multi-Plant & International Rollout',
    owner: 'North America, Europe & Asia-Pacific',
    scope:
      'Roll out anomaly screening and tax-vs-duty separation across Guelph Plants, US distribution hubs, Hungary, and Tianjin.',
    gate: 'Quarterly close speed & accuracy review',
  },
];

export const BusinessImpactROI: React.FC<BusinessImpactROIProps> = ({
  selectedModel,
  onSelectModel,
  presentationAssumptions,
  onChangePresentationAssumptions,
  assumptions,
  customsEntries,
  onChangeAssumptions,
}) => {
  const [activePreset, setActivePreset] = useState<ScenarioPresetKey>('base');

  const presResults = useMemo(
    () => calculatePresentationYear1ROI(presentationAssumptions),
    [presentationAssumptions]
  );

  const results = useMemo(
    () => calculateTrustworthyROI(assumptions, customsEntries),
    [assumptions, customsEntries]
  );

  // Sensitivity comparison across Low / Base / High adoption for Original Three-Year Model
  const sensitivityCols = useMemo(() => {
    return (['low', 'base', 'high'] as ScenarioPresetKey[]).map((key) => {
      const merged: ROIAssumptions = {
        ...assumptions,
        ...SCENARIO_PRESETS[key].patch,
      };
      return {
        key,
        label: SCENARIO_PRESETS[key].label,
        assumptions: merged,
        res: calculateTrustworthyROI(merged, customsEntries),
      };
    });
  }, [assumptions, customsEntries]);

  const updatePresentationNumber = (
    key: keyof PresentationROIYear1Assumptions,
    raw: string,
    max?: number
  ) => {
    const val = Number(raw);
    if (Number.isNaN(val)) return;
    const clamped =
      max !== undefined ? Math.min(max, Math.max(0, val)) : Math.max(0, val);
    onChangePresentationAssumptions({
      ...presentationAssumptions,
      [key]: clamped,
    });
  };

  const resetPresentationDefaults = () => {
    onChangePresentationAssumptions({ ...DEFAULT_PRESENTATION_ROI_ASSUMPTIONS });
  };

  const updateNumber = (key: keyof ROIAssumptions, raw: string, max?: number) => {
    const val = Number(raw);
    if (Number.isNaN(val)) return;
    const clamped = max !== undefined ? Math.min(max, Math.max(0, val)) : Math.max(0, val);
    onChangeAssumptions({
      ...assumptions,
      [key]: clamped,
    });
  };

  const applyPreset = (key: ScenarioPresetKey) => {
    setActivePreset(key);
    onChangeAssumptions({
      ...assumptions,
      ...SCENARIO_PRESETS[key].patch,
    });
  };

  const maxBenefitBar = Math.max(
    1,
    results.conditionalDuplicateRecoveryIR03,
    results.annualizedBrokerRecovery,
    results.conditionalMissedFtaE08Annual,
    results.preventedFutureLeakageAnnual,
    results.annualLaborEfficiencyValue
  );

  const presComparisonScale = Math.max(
    1,
    presResults.totalInvestment,
    presResults.totalPotentialBenefits,
    presResults.zeroDuplicatePotentialBenefits
  );

  return (
    <div className="space-y-6">
      {/* Model Selector Header — Explicitly Separates the Two Independent Models */}
      <section className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-[#F04F25]" />
              <h2 className="text-sm font-semibold text-[#222222]">
                Financial Impact &amp; ROI Scenario Selector
              </h2>
            </div>
            <p className="text-xs text-stone-600 max-w-4xl">
              SKYGUARD AI maintains{' '}
              <span className="font-semibold text-[#222222]">
                two separate financial models with different assumptions and time horizons
              </span>
              . Figures from the Year-1 Presentation Model and the Original Three-Year Model are never mixed; the selected model below also governs the AI Financial Analyst and Executive Brief PDF export.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="ROI Financial Model"
            className="inline-flex flex-wrap items-center gap-1.5 rounded-lg bg-[#F6F5F3] p-1 border border-stone-200 shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedModel === 'presentation_y1'}
              onClick={() => onSelectModel('presentation_y1')}
              className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors ${
                selectedModel === 'presentation_y1'
                  ? 'bg-[#333333] text-white shadow-2xs'
                  : 'text-stone-600 hover:text-[#222222]'
              }`}
            >
              Group 7 Presentation Model — Year 1
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedModel === 'original_3yr'}
              onClick={() => onSelectModel('original_3yr')}
              className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors ${
                selectedModel === 'original_3yr'
                  ? 'bg-[#333333] text-white shadow-2xs'
                  : 'text-stone-600 hover:text-[#222222]'
              }`}
            >
              Original Three-Year Model
            </button>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* MODEL 1 (DEFAULT): GROUP 7 PRESENTATION MODEL — YEAR 1               */}
      {/* ===================================================================== */}
      {selectedModel === 'presentation_y1' ? (
        <>
          {/* Mandatory Presentation Disclaimer Banner */}
          <section className="rounded-xl bg-[#FAF9F7] border border-stone-200 border-l-4 border-l-[#F04F25] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs text-stone-700 leading-relaxed">
              <Info className="h-4 w-4 text-[#F04F25] shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-[#222222]">
                  Group 7 Presentation Model — Year 1 (12-Month Economic-Value Horizon)
                </div>
                <p className="mt-0.5">{PRESENTATION_ROI_DISCLAIMER}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={resetPresentationDefaults}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-[#333333] hover:bg-[#F6F5F3] shrink-0 self-start sm:self-center"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Defaults</span>
            </button>
          </section>

          {/* Primary Year-One KPI Strip */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs">
              <div className="text-xs font-medium text-stone-500">
                Total Year-One Investment
              </div>
              <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-[#222222]">
                {formatCAD(presResults.totalInvestment)}
              </div>
              <div className="mt-1.5 text-xs text-stone-500">
                Hypothetical planning estimate (4 categories)
              </div>
            </div>

            <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs">
              <div className="text-xs font-medium text-stone-500">
                Total Potential Economic Benefits
              </div>
              <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-emerald-700">
                {formatCAD(presResults.totalPotentialBenefits)}
              </div>
              <div className="mt-1.5 text-xs text-stone-500 font-mono tabular-nums">
                Recovery {formatCAD(presResults.duplicateInvoiceRecovery + presResults.brokerFeeRecovery)} · Prod./Avoid {formatCAD(presResults.investigationTimeSavings + presResults.avoidableRushFreight)}
              </div>
            </div>

            <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs">
              <div className="text-xs font-medium text-stone-500">
                Net Estimated Economic Benefit
              </div>
              <div
                className={`mt-2 text-2xl font-semibold font-mono tabular-nums ${
                  presResults.netEconomicBenefit >= 0 ? 'text-[#222222]' : 'text-red-700'
                }`}
              >
                {formatSignedCAD(presResults.netEconomicBenefit)}
              </div>
              <div className="mt-1.5 text-xs text-stone-500 font-mono tabular-nums">
                {formatCAD(presResults.totalPotentialBenefits)} &minus; {formatCAD(presResults.totalInvestment)}
              </div>
            </div>

            <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs">
              <div className="text-xs font-medium text-stone-500">
                Projected Year-One Economic-Value ROI
              </div>
              <div
                className={`mt-2 text-2xl font-semibold font-mono tabular-nums ${
                  presResults.year1RoiPct >= 0 ? 'text-[#F04F25]' : 'text-red-700'
                }`}
              >
                {presResults.year1RoiPct.toFixed(1)}%
              </div>
              <div className="mt-1.5 text-xs text-stone-500">
                Projected Year-One Economic-Value ROI
              </div>
            </div>
          </section>

          {/* Visual Comparison: Investment vs. Potential Benefits vs. Zero-Duplicate Sensitivity */}
          <section className="rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-[#222222]">
                  Visual Comparison: Year-One Investment vs. Modeled Economic Benefits
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  Compares total hypothetical implementation budget against modeled Year-1 benefits and the zero-duplicate-recovery sensitivity test.
                </p>
              </div>
              <div className="text-xs font-mono tabular-nums text-stone-600">
                Net: <span className="font-semibold text-[#222222]">{formatSignedCAD(presResults.netEconomicBenefit)}</span> ({presResults.year1RoiPct.toFixed(1)}% ROI)
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* Bar 1: Investment */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#222222]">
                    Proposed Year-One Investment (Hypothetical Planning Estimate)
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-[#222222]">
                    {formatCAD(presResults.totalInvestment)}
                  </span>
                </div>
                <div className="h-7 w-full rounded-lg bg-stone-100 overflow-hidden flex">
                  <div
                    className="h-full bg-[#333333] transition-all duration-200"
                    style={{
                      width: `${(presentationAssumptions.appDevAndConfigCost / presComparisonScale) * 100}%`,
                    }}
                    title={`App Development & Config: ${formatCAD(presentationAssumptions.appDevAndConfigCost)}`}
                  />
                  <div
                    className="h-full bg-stone-600 transition-all duration-200"
                    style={{
                      width: `${(presentationAssumptions.erpIntegrationSecurityCost / presComparisonScale) * 100}%`,
                    }}
                    title={`ERP Integration & Security: ${formatCAD(presentationAssumptions.erpIntegrationSecurityCost)}`}
                  />
                  <div
                    className="h-full bg-stone-500 transition-all duration-200"
                    style={{
                      width: `${(presentationAssumptions.staffTrainingCost / presComparisonScale) * 100}%`,
                    }}
                    title={`Staff Training: ${formatCAD(presentationAssumptions.staffTrainingCost)}`}
                  />
                  <div
                    className="h-full bg-stone-400 transition-all duration-200"
                    style={{
                      width: `${(presentationAssumptions.cloudOpsSupportCost / presComparisonScale) * 100}%`,
                    }}
                    title={`Cloud Ops & Support: ${formatCAD(presentationAssumptions.cloudOpsSupportCost)}`}
                  />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-500 font-mono tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#333333]" />
                    Dev &amp; Config {formatCAD(presentationAssumptions.appDevAndConfigCost)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-stone-600" />
                    ERP &amp; Security {formatCAD(presentationAssumptions.erpIntegrationSecurityCost)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-stone-500" />
                    Training {formatCAD(presentationAssumptions.staffTrainingCost)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-stone-400" />
                    Cloud Ops {formatCAD(presentationAssumptions.cloudOpsSupportCost)}
                  </span>
                </div>
              </div>

              {/* Bar 2: Modeled Potential Benefits */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#222222]">
                    Modeled Year-One Potential Economic Benefits (A + B + C + D)
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-emerald-700">
                    {formatCAD(presResults.totalPotentialBenefits)}
                  </span>
                </div>
                <div className="h-7 w-full rounded-lg bg-stone-100 overflow-hidden flex">
                  <div
                    className="h-full bg-[#F04F25] transition-all duration-200"
                    style={{
                      width: `${(presResults.duplicateInvoiceRecovery / presComparisonScale) * 100}%`,
                    }}
                    title={`A. Duplicate Invoice Recovery (One-time): ${formatCAD(presResults.duplicateInvoiceRecovery)}`}
                  />
                  <div
                    className="h-full bg-emerald-600 transition-all duration-200"
                    style={{
                      width: `${(presResults.investigationTimeSavings / presComparisonScale) * 100}%`,
                    }}
                    title={`B. Investigation Time Savings (Non-cash): ${formatCAD(presResults.investigationTimeSavings)}`}
                  />
                  <div
                    className="h-full bg-amber-500 transition-all duration-200"
                    style={{
                      width: `${(presResults.avoidableRushFreight / presComparisonScale) * 100}%`,
                    }}
                    title={`C. Avoidable Rush Freight (Hypothetical): ${formatCAD(presResults.avoidableRushFreight)}`}
                  />
                  <div
                    className="h-full bg-sky-600 transition-all duration-200"
                    style={{
                      width: `${(presResults.brokerFeeRecovery / presComparisonScale) * 100}%`,
                    }}
                    title={`D. Broker Fee Recovery (Conditional): ${formatCAD(presResults.brokerFeeRecovery)}`}
                  />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-500 font-mono tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#F04F25]" />
                    A. Duplicate Recovery {formatCAD(presResults.duplicateInvoiceRecovery)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
                    B. Time Savings {formatCAD(presResults.investigationTimeSavings)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-amber-500" />
                    C. Avoidable Freight {formatCAD(presResults.avoidableRushFreight)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-sky-600" />
                    D. Broker Recovery {formatCAD(presResults.brokerFeeRecovery)}
                  </span>
                </div>
              </div>

              {/* Bar 3: Sensitivity Test — Zero Duplicate Recovery */}
              <div className="space-y-1.5 pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-red-800">
                    Sensitivity Test: Zero Duplicate Invoice Recovery (0% IR-03 Recovery)
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-red-700">
                    {formatCAD(presResults.zeroDuplicatePotentialBenefits)} ({presResults.zeroDuplicateRoiPct.toFixed(1)}% ROI)
                  </span>
                </div>
                <div className="h-5 w-full rounded-lg bg-stone-100 overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-600/80 transition-all duration-200"
                    style={{
                      width: `${(presResults.investigationTimeSavings / presComparisonScale) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-amber-500/80 transition-all duration-200"
                    style={{
                      width: `${(presResults.avoidableRushFreight / presComparisonScale) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-sky-600/80 transition-all duration-200"
                    style={{
                      width: `${(presResults.brokerFeeRecovery / presComparisonScale) * 100}%`,
                    }}
                  />
                </div>
                <div className="text-[11px] text-stone-500 font-mono tabular-nums">
                  Net Benefit without IR-03 Recovery:{' '}
                  <span className="font-semibold text-red-700">
                    {formatSignedCAD(presResults.zeroDuplicateNetBenefit)}
                  </span>{' '}
                  (Benefits {formatCAD(presResults.zeroDuplicatePotentialBenefits)} vs. Investment {formatCAD(presResults.totalInvestment)})
                </div>
              </div>
            </div>
          </section>

          {/* Main Grid: Editable Assumptions (Left 5) + Transparent Calculations & Evidence Classification (Right 7) */}
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left Column: Editable Investment & Benefit Assumptions */}
            <div className="xl:col-span-5 space-y-5">
              {/* Editable Year-One Investment */}
              <div className="rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-[#222222]">
                    Year-One Implementation Investment (Editable)
                  </h3>
                  <p className="mt-1 text-xs text-stone-500">
                    Hypothetical planning estimates —{' '}
                    <span className="font-semibold text-[#222222]">
                      NOT SKYJACK-provided budgets or vendor quotations
                    </span>
                    . Edit each category independently to test budget sensitivity.
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  <label className="block space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-stone-700">
                        Application development and configuration (CAD)
                      </span>
                      <span className="font-mono text-stone-400">Default $45,000</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={presentationAssumptions.appDevAndConfigCost}
                      onChange={(e) =>
                        updatePresentationNumber('appDevAndConfigCost', e.target.value)
                      }
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                    />
                  </label>

                  <label className="block space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-stone-700">
                        ERP integration and security (CAD)
                      </span>
                      <span className="font-mono text-stone-400">Default $30,000</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={presentationAssumptions.erpIntegrationSecurityCost}
                      onChange={(e) =>
                        updatePresentationNumber('erpIntegrationSecurityCost', e.target.value)
                      }
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                    />
                  </label>

                  <label className="block space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-stone-700">
                        Staff training (CAD)
                      </span>
                      <span className="font-mono text-stone-400">Default $10,000</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={presentationAssumptions.staffTrainingCost}
                      onChange={(e) =>
                        updatePresentationNumber('staffTrainingCost', e.target.value)
                      }
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                    />
                  </label>

                  <label className="block space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-stone-700">
                        Cloud operations and support (CAD)
                      </span>
                      <span className="font-mono text-stone-400">Default $25,000</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={presentationAssumptions.cloudOpsSupportCost}
                      onChange={(e) =>
                        updatePresentationNumber('cloudOpsSupportCost', e.target.value)
                      }
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                    />
                  </label>

                  <div className="pt-3 border-t border-stone-200 flex items-center justify-between font-semibold text-[#222222]">
                    <span>Total Year-One Investment</span>
                    <span className="font-mono tabular-nums text-sm">
                      {formatCAD(presResults.totalInvestment)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Editable Benefit Assumptions */}
              <div className="rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-[#222222]">
                    Year-One Benefit Assumptions (Editable)
                  </h3>
                  <p className="mt-1 text-xs text-stone-500">
                    All calculations update immediately. Official Appendix base amounts (IR-03, IR-02, Q3 net broker excess) are pre-filled and preserved on reset.
                  </p>
                </div>

                <div className="space-y-4 text-xs">
                  {/* A. Duplicate Invoice Recovery */}
                  <div className="rounded-lg border border-stone-200 bg-[#FAF9F7] p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#222222]">
                        A. Duplicate Invoice Recovery (IR-03)
                      </span>
                      <span className="font-mono font-semibold text-[#F04F25] tabular-nums">
                        {formatCAD(presResults.duplicateInvoiceRecovery)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <label className="block space-y-1">
                        <span className="text-stone-600">IR-03 Base (CAD)</span>
                        <input
                          type="number"
                          min={0}
                          step={5000}
                          value={presentationAssumptions.duplicateInvoiceBaseCAD}
                          onChange={(e) =>
                            updatePresentationNumber('duplicateInvoiceBaseCAD', e.target.value)
                          }
                          className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-stone-600">Recovery Rate (%)</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={presentationAssumptions.duplicateRecoveryPct}
                          onChange={(e) =>
                            updatePresentationNumber('duplicateRecoveryPct', e.target.value, 100)
                          }
                          className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                        />
                      </label>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={presentationAssumptions.duplicateRecoveryPct}
                      onChange={(e) =>
                        updatePresentationNumber('duplicateRecoveryPct', e.target.value, 100)
                      }
                      aria-label="Duplicate invoice recovery percentage"
                      className="w-full accent-[#F04F25] cursor-pointer"
                    />
                  </div>

                  {/* B. Investigation Time Savings */}
                  <div className="rounded-lg border border-stone-200 bg-[#FAF9F7] p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#222222]">
                        B. Investigation Time Savings (Non-Cash)
                      </span>
                      <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                        {formatCAD(presResults.investigationTimeSavings)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <label className="block space-y-1">
                        <span className="text-stone-600">Hours Freed / Yr</span>
                        <input
                          type="number"
                          min={0}
                          max={5000}
                          step={25}
                          value={presentationAssumptions.hoursFreedAnnually}
                          onChange={(e) =>
                            updatePresentationNumber('hoursFreedAnnually', e.target.value, 5000)
                          }
                          className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-stone-600">Loaded Rate (CAD/hr)</span>
                        <input
                          type="number"
                          min={0}
                          max={300}
                          step={5}
                          value={presentationAssumptions.fullyLoadedHourlyRate}
                          onChange={(e) =>
                            updatePresentationNumber('fullyLoadedHourlyRate', e.target.value, 300)
                          }
                          className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                        />
                      </label>
                    </div>
                  </div>

                  {/* C. Avoidable Rush Freight */}
                  <div className="rounded-lg border border-stone-200 bg-[#FAF9F7] p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#222222]">
                        C. Avoidable Rush Freight (IR-02)
                      </span>
                      <span className="font-mono font-semibold text-amber-700 tabular-nums">
                        {formatCAD(presResults.avoidableRushFreight)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="block space-y-1">
                        <span className="text-stone-600">Q3 Base (CAD)</span>
                        <input
                          type="number"
                          min={0}
                          step={10000}
                          value={presentationAssumptions.rushFreightQuarterlyBaseCAD}
                          onChange={(e) =>
                            updatePresentationNumber('rushFreightQuarterlyBaseCAD', e.target.value)
                          }
                          className="w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-stone-600">Quarters / Yr</span>
                        <input
                          type="number"
                          min={1}
                          max={4}
                          step={1}
                          value={presentationAssumptions.rushFreightQuartersPerYear}
                          onChange={(e) =>
                            updatePresentationNumber('rushFreightQuartersPerYear', e.target.value, 4)
                          }
                          className="w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-stone-600">Avoided (%)</span>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          step={0.5}
                          value={presentationAssumptions.rushFreightAvoidablePct}
                          onChange={(e) =>
                            updatePresentationNumber('rushFreightAvoidablePct', e.target.value, 50)
                          }
                          className="w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                        />
                      </label>
                    </div>
                  </div>

                  {/* D. Broker Fee Recovery */}
                  <div className="rounded-lg border border-stone-200 bg-[#FAF9F7] p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#222222]">
                        D. Broker Fee Recovery (0.2% Audit)
                      </span>
                      <span className="font-mono font-semibold text-sky-700 tabular-nums">
                        {formatCAD(presResults.brokerFeeRecovery)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <label className="block space-y-1">
                        <span className="text-stone-600">Q3 Net (CAD)</span>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={presentationAssumptions.brokerNetExcessQuarterlyCAD}
                          onChange={(e) =>
                            updatePresentationNumber('brokerNetExcessQuarterlyCAD', e.target.value)
                          }
                          className="w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-stone-600">Quarters / Yr</span>
                        <input
                          type="number"
                          min={1}
                          max={4}
                          step={1}
                          value={presentationAssumptions.brokerQuartersPerYear}
                          onChange={(e) =>
                            updatePresentationNumber('brokerQuartersPerYear', e.target.value, 4)
                          }
                          className="w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-stone-600">Recovered (%)</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={5}
                          value={presentationAssumptions.brokerRecoveryPct}
                          onChange={(e) =>
                            updatePresentationNumber('brokerRecoveryPct', e.target.value, 100)
                          }
                          className="w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Transparent Benefit Breakdown & Classification */}
            <div className="xl:col-span-7 space-y-5">
              <div className="rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-5">
                <div>
                  <h3 className="text-base font-semibold text-[#222222]">
                    Transparent Year-One Benefit Calculations &amp; Evidence Classification
                  </h3>
                  <p className="mt-1 text-xs text-stone-500">
                    Explicitly separates case-confirmed financial amounts, hypothetical annualization assumptions, one-time recoveries, potential recurring savings, and non-cash employee productivity value.
                  </p>
                </div>

                {/* Evidence Legend */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-lg border border-stone-200 bg-[#FAF9F7] px-2.5 py-2">
                    <span className="font-semibold text-[#222222]">Case-Confirmed Base:</span>{' '}
                    <span className="text-stone-600">IR-03 $265K, IR-02 $600K, Q3 Broker Net $5,560</span>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-2.5 py-2">
                    <span className="font-semibold text-amber-900">Hypothetical Annualization:</span>{' '}
                    <span className="text-amber-800">&times; 4 quarters is illustrative, not proven recurring</span>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-2">
                    <span className="font-semibold text-emerald-900">Non-Cash Productivity:</span>{' '}
                    <span className="text-emerald-800">Freed analyst capacity, not cash payroll cut</span>
                  </div>
                </div>

                {/* Individual Benefit Rows */}
                <div className="divide-y divide-stone-200 text-xs">
                  {/* A */}
                  <div className="py-4 first:pt-0 space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[#222222]">
                            A. Duplicate Invoice Recovery (IR-03)
                          </span>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                            Case-Confirmed Base
                          </span>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#FFF3EE] text-[#C83D18] border border-[#F5C6B8]">
                            One-Time Conditional Recovery
                          </span>
                        </div>
                        <div className="font-mono text-[#333333] tabular-nums">
                          {formatCAD(presentationAssumptions.duplicateInvoiceBaseCAD)} &times;{' '}
                          {presentationAssumptions.duplicateRecoveryPct}% ={' '}
                          <span className="font-semibold text-[#222222]">
                            {formatCAD(presResults.duplicateInvoiceRecovery)}
                          </span>
                        </div>
                        <p className="text-stone-500 leading-relaxed">
                          Based on official Appendix IR-03 duplicate vendor invoice (CAD $265,000). Strictly a{' '}
                          <span className="font-medium text-[#222222]">
                            one-time conditional recovery, not recurring annual savings
                          </span>
                          ; requires supplier V-4471 statement reconciliation and credit recovery.
                        </p>
                      </div>
                      <div className="font-mono text-sm font-semibold tabular-nums text-[#F04F25] shrink-0">
                        {formatCAD(presResults.duplicateInvoiceRecovery)}
                      </div>
                    </div>
                  </div>

                  {/* B */}
                  <div className="py-4 space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[#222222]">
                            B. Investigation Time Savings
                          </span>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Non-Cash Employee Productivity Value
                          </span>
                        </div>
                        <div className="font-mono text-[#333333] tabular-nums">
                          {presentationAssumptions.hoursFreedAnnually.toLocaleString()} hours/yr &times;{' '}
                          {formatCAD(presentationAssumptions.fullyLoadedHourlyRate)}/hr ={' '}
                          <span className="font-semibold text-[#222222]">
                            {formatCAD(presResults.investigationTimeSavings)}
                          </span>
                        </div>
                        <p className="text-stone-500 leading-relaxed">
                          Reflects estimated finance and plant analyst hours freed annually by automated screening and walk preparation. Labeled{' '}
                          <span className="font-medium text-[#222222]">
                            productivity / capacity value, NOT guaranteed cash savings
                          </span>
                          .
                        </p>
                      </div>
                      <div className="font-mono text-sm font-semibold tabular-nums text-emerald-700 shrink-0">
                        {formatCAD(presResults.investigationTimeSavings)}
                      </div>
                    </div>
                  </div>

                  {/* C */}
                  <div className="py-4 space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[#222222]">
                            C. Avoidable Rush Freight (IR-02)
                          </span>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                            Case-Confirmed Q3 Base
                          </span>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                            Hypothetical Annualization · Potential Recurring Savings
                          </span>
                        </div>
                        <div className="font-mono text-[#333333] tabular-nums">
                          {formatCAD(presentationAssumptions.rushFreightQuarterlyBaseCAD)} &times;{' '}
                          {presentationAssumptions.rushFreightQuartersPerYear} qtrs ={' '}
                          {formatCAD(presResults.annualizedRushFreightBase)} &times;{' '}
                          {presentationAssumptions.rushFreightAvoidablePct}% ={' '}
                          <span className="font-semibold text-[#222222]">
                            {formatCAD(presResults.avoidableRushFreight)}
                          </span>
                        </div>
                        <p className="text-stone-500 leading-relaxed">
                          Uses official Q3 rush freight (IR-02, CAD $600,000) with an illustrative 4-quarter annualization.{' '}
                          <span className="font-medium text-[#222222]">
                            Hypothetical avoidable spending requiring pilot validation
                          </span>{' '}
                          — one quarter&apos;s rush freight is NOT proof that the same amount repeats every quarter.
                        </p>
                      </div>
                      <div className="font-mono text-sm font-semibold tabular-nums text-amber-700 shrink-0">
                        {formatCAD(presResults.avoidableRushFreight)}
                      </div>
                    </div>
                  </div>

                  {/* D */}
                  <div className="py-4 space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[#222222]">
                            D. Broker Fee Recovery (0.2% Contract Audit)
                          </span>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                            Case-Confirmed Q3 Net Excess
                          </span>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200">
                            Hypothetical Annualization · Potential Recurring Recovery
                          </span>
                        </div>
                        <div className="font-mono text-[#333333] tabular-nums">
                          {formatCAD(presentationAssumptions.brokerNetExcessQuarterlyCAD)} &times;{' '}
                          {presentationAssumptions.brokerQuartersPerYear} qtrs ={' '}
                          {formatCAD(presResults.annualizedBrokerExcessBase)} &times;{' '}
                          {presentationAssumptions.brokerRecoveryPct}% ={' '}
                          <span className="font-semibold text-[#222222]">
                            {formatCAD(presResults.brokerFeeRecovery)}
                          </span>
                        </div>
                        <p className="text-stone-500 leading-relaxed">
                          Uses official Q3 net broker excess (CAD $5,560 net of E-11 undercharge) annualized over {presentationAssumptions.brokerQuartersPerYear} quarters.{' '}
                          <span className="font-medium text-[#222222]">
                            Conditional on broker invoice verification and contractual recovery
                          </span>
                          .
                        </p>
                      </div>
                      <div className="font-mono text-sm font-semibold tabular-nums text-sky-700 shrink-0">
                        {formatCAD(presResults.brokerFeeRecovery)}
                      </div>
                    </div>
                  </div>

                  {/* Excluded Items Guardrail */}
                  <div className="pt-4">
                    <div className="rounded-lg border border-stone-200 bg-[#FAF9F7] p-3.5 text-stone-600">
                      <span className="font-semibold text-[#222222]">
                        Explicitly Excluded from Year-One ROI:
                      </span>{' '}
                      Recorded Q3 sunk irregular losses ({formatCAD(CASE_CONSTANTS.IRREGULAR_TOTAL_CAD)}), non-cash IR-06 warranty accrual review ($410,000), interprovincial customer sales taxes ({formatCAD(CASE_CONSTANTS.INTERPROVINCIAL_TAX_TOTAL_CAD)}), and external government China tariff rate swings (15%/25%/35%).
                    </div>
                  </div>
                </div>

                {/* Transparent Summary Equations */}
                <div className="rounded-lg border border-stone-200 bg-[#FAF9F7] p-4 text-xs space-y-1.5">
                  <div className="font-semibold text-[#222222]">
                    Group 7 Year-One Summary Equations
                  </div>
                  <div className="text-stone-600 font-mono tabular-nums">
                    Total Modeled Benefits = {formatCAD(presResults.duplicateInvoiceRecovery)} + {formatCAD(presResults.investigationTimeSavings)} + {formatCAD(presResults.avoidableRushFreight)} + {formatCAD(presResults.brokerFeeRecovery)} ={' '}
                    <span className="font-semibold text-[#222222]">{formatCAD(presResults.totalPotentialBenefits)}</span>
                  </div>
                  <div className="text-stone-600 font-mono tabular-nums">
                    Net Economic Benefit = {formatCAD(presResults.totalPotentialBenefits)} &minus; {formatCAD(presResults.totalInvestment)} ={' '}
                    <span className="font-semibold text-[#222222]">{formatSignedCAD(presResults.netEconomicBenefit)}</span>
                  </div>
                  <div className="text-stone-600 font-mono tabular-nums">
                    Year-One ROI = ({formatSignedCAD(presResults.netEconomicBenefit)} &divide; {formatCAD(presResults.totalInvestment)}) &times; 100 ={' '}
                    <span className="font-semibold text-[#F04F25]">
                      {presResults.year1RoiPct.toFixed(1)}% Projected Year-One Economic-Value ROI
                    </span>
                  </div>
                </div>
              </div>

              {/* Dedicated Sensitivity Test: Zero Duplicate Invoice Recovery */}
              <div className="rounded-xl bg-white border border-red-200 p-6 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-600 shrink-0" />
                    <h3 className="text-base font-semibold text-[#222222]">
                      Sensitivity Test: Zero Duplicate Invoice Recovery (0%)
                    </h3>
                  </div>
                  <span className="text-xs font-mono font-semibold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded">
                    Downside ROI: {presResults.zeroDuplicateRoiPct.toFixed(1)}%
                  </span>
                </div>

                <p className="text-xs text-stone-600 leading-relaxed">
                  Tests the exact impact if{' '}
                  <span className="font-semibold text-[#222222]">
                    duplicate invoice recovery (IR-03) equals 0%
                  </span>{' '}
                  while all other Year-1 cost and benefit assumptions remain unchanged.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-stone-200 bg-[#FAFAFA] text-stone-600">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Metric (Year 1 · CAD)</th>
                        <th className="py-2.5 px-4 font-semibold text-right">
                          Active Presentation Case ({presentationAssumptions.duplicateRecoveryPct}% IR-03)
                        </th>
                        <th className="py-2.5 px-4 font-semibold text-right text-red-800">
                          Zero Duplicate Recovery (0% IR-03)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 font-mono tabular-nums">
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-[#222222]">
                          Total Year-One Investment
                        </td>
                        <td className="py-2.5 px-4 text-right text-[#333333]">
                          {formatCAD(presResults.totalInvestment)}
                        </td>
                        <td className="py-2.5 px-4 text-right text-[#333333]">
                          {formatCAD(presResults.totalInvestment)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-[#222222]">
                          A. Duplicate Invoice Recovery (One-Time)
                        </td>
                        <td className="py-2.5 px-4 text-right text-[#333333]">
                          {formatCAD(presResults.duplicateInvoiceRecovery)}
                        </td>
                        <td className="py-2.5 px-4 text-right text-red-700 font-semibold">
                          CAD $0
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-[#222222]">
                          B + C + D (Time Savings + Rush Freight + Broker Recovery)
                        </td>
                        <td className="py-2.5 px-4 text-right text-[#333333]">
                          {formatCAD(presResults.zeroDuplicatePotentialBenefits)}
                        </td>
                        <td className="py-2.5 px-4 text-right text-[#333333]">
                          {formatCAD(presResults.zeroDuplicatePotentialBenefits)}
                        </td>
                      </tr>
                      <tr className="bg-[#FAF9F7]">
                        <td className="py-2.5 px-3 font-sans font-semibold text-[#222222]">
                          Total Potential Benefits
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-emerald-700">
                          {formatCAD(presResults.totalPotentialBenefits)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-[#222222]">
                          {formatCAD(presResults.zeroDuplicatePotentialBenefits)}
                        </td>
                      </tr>
                      <tr className="bg-[#FAF9F7]">
                        <td className="py-2.5 px-3 font-sans font-semibold text-[#222222]">
                          Net Economic Benefit
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-[#222222]">
                          {formatSignedCAD(presResults.netEconomicBenefit)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-red-700">
                          {formatSignedCAD(presResults.zeroDuplicateNetBenefit)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-semibold text-[#222222]">
                          Year-One Economic-Value ROI
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-[#F04F25]">
                          {presResults.year1RoiPct.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-red-700">
                          {presResults.zeroDuplicateRoiPct.toFixed(1)}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="rounded-lg border border-red-200/80 bg-red-50/50 p-3.5 text-xs text-red-900 leading-relaxed">
                  <span className="font-semibold">Why a Controlled Pilot Is Required:</span>{' '}
                  Without recovering part of IR-03 in Year 1, modeled economic benefits fall to{' '}
                  <span className="font-mono font-semibold">{formatCAD(presResults.zeroDuplicatePotentialBenefits)}</span>{' '}
                  against{' '}
                  <span className="font-mono font-semibold">{formatCAD(presResults.totalInvestment)}</span>{' '}
                  investment (net{' '}
                  <span className="font-mono font-semibold">{formatSignedCAD(presResults.zeroDuplicateNetBenefit)}</span>,{' '}
                  <span className="font-mono font-semibold">{presResults.zeroDuplicateRoiPct.toFixed(1)}%</span>{' '}
                  ROI). SKYJACK should validate actual duplicate recovery, analyst time freed, rush freight recurrence, and broker recovery in a low-cost Phase 1 pilot before authorizing full deployment.
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        /* =================================================================== */
        /* MODEL 2: ORIGINAL THREE-YEAR MODEL (PRESERVED INTACT)               */
        /* =================================================================== */
        <>
          {/* Transparency & Category Separation Disclosure */}
          <section className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-[#F04F25]" />
                  <h2 className="text-sm font-semibold text-[#222222]">
                    Original Three-Year Model — Editable Financial Assumptions (Low / Base / High)
                  </h2>
                </div>
                <p className="text-xs text-stone-600 max-w-4xl">
                  Separate 36-month model retained for comparison. Every assumption below is a <span className="font-semibold text-[#222222]">user-editable illustrative assumption</span>, not a SKYJACK-reported figure.
                  Recorded Q3 expenses, non-cash accounting adjustments (IR-06), customer sales taxes, and external government tariff policy changes (e.g., 15%/25%/35% China tariff rates) are <span className="font-semibold text-[#222222]">excluded from SKYGUARD software ROI</span>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {(['low', 'base', 'high'] as ScenarioPresetKey[]).map(
                  (key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyPreset(key)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                        activePreset === key
                          ? 'bg-[#333333] text-white border-[#333333]'
                          : 'bg-white text-[#333333] border-stone-200 hover:bg-[#F6F5F3]'
                      }`}
                    >
                      {SCENARIO_PRESETS[key].label}
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => applyPreset('base')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-[#333333] hover:bg-[#F6F5F3]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </section>

          {/* Primary ROI Output Strip */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs">
              <div className="text-xs font-medium text-stone-500">
                Year-1 Gross / Net Benefit
              </div>
              <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-[#222222]">
                {formatSignedCAD(results.year1NetBenefit)}
              </div>
              <div className="mt-1.5 text-xs text-stone-500 font-mono tabular-nums">
                Gross {formatCAD(results.year1GrossBenefit)} vs Cost {formatCAD(results.year1TotalCost)}
              </div>
            </div>

            <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs">
              <div className="text-xs font-medium text-stone-500">
                Year-1 / 3-Year ROI
              </div>
              <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-[#F04F25]">
                {results.threeYearRoiPct.toFixed(0)}% <span className="text-sm font-normal text-stone-500">(3-Yr)</span>
              </div>
              <div className="mt-1.5 text-xs text-stone-500 font-mono tabular-nums">
                Year-1 ROI: {results.year1RoiPct.toFixed(0)}% · 3-Yr Net: {formatSignedCAD(results.threeYearNetBenefit)}
              </div>
            </div>

            <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs">
              <div className="text-xs font-medium text-stone-500">
                Simple Payback Period
              </div>
              <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-[#222222]">
                {results.simplePaybackMonths !== null
                  ? `${results.simplePaybackMonths.toFixed(1)} months`
                  : 'N/A (>36m)'}
              </div>
              <div className="mt-1.5 text-xs text-stone-500 font-mono tabular-nums">
                Upfront + Training: {formatCAD(assumptions.implementationCost + assumptions.employeeTrainingCost)}
              </div>
            </div>

            <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs">
              <div className="text-xs font-medium text-stone-500">
                Steady-State Annual Benefit
              </div>
              <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-emerald-700">
                {formatCAD(results.steadyStateAnnualBenefit)}
              </div>
              <div className="mt-1.5 text-xs text-stone-500 font-mono tabular-nums">
                {results.annualInvestigationHoursSaved} investigation hrs saved/yr
              </div>
            </div>
          </section>

          {/* Main Grid: Editable Assumptions (Left) + 7-Category Separation & Formulas (Right) */}
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            <div className="xl:col-span-5 rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-5">
              <div>
                <h3 className="text-base font-semibold text-[#222222]">
                  Illustrative Input Assumptions (3-Year Model)
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  All values recalculate live using transparent deterministic formulas.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block space-y-1">
                    <span className="font-medium text-stone-700">Implementation (CAD)</span>
                    <input
                      type="number"
                      min={0}
                      step={5000}
                      value={assumptions.implementationCost}
                      onChange={(e) => updateNumber('implementationCost', e.target.value)}
                      className="w-full rounded-lg border border-stone-200 px-2.5 py-2 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="font-medium text-stone-700">Monthly Maint. (CAD)</span>
                    <input
                      type="number"
                      min={0}
                      step={250}
                      value={assumptions.monthlyMaintenance}
                      onChange={(e) => updateNumber('monthlyMaintenance', e.target.value)}
                      className="w-full rounded-lg border border-stone-200 px-2.5 py-2 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="font-medium text-stone-700">Training (CAD)</span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={assumptions.employeeTrainingCost}
                      onChange={(e) => updateNumber('employeeTrainingCost', e.target.value)}
                      className="w-full rounded-lg border border-stone-200 px-2.5 py-2 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block space-y-1">
                    <span className="font-medium text-stone-700">Incidents / Yr</span>
                    <input
                      type="number"
                      min={0}
                      max={500}
                      value={assumptions.annualIncidentCount}
                      onChange={(e) => updateNumber('annualIncidentCount', e.target.value, 500)}
                      className="w-full rounded-lg border border-stone-200 px-2.5 py-2 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="font-medium text-stone-700">Hrs Saved / Incident</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={assumptions.hoursSavedPerIncident}
                      onChange={(e) => updateNumber('hoursSavedPerIncident', e.target.value, 100)}
                      className="w-full rounded-lg border border-stone-200 px-2.5 py-2 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="font-medium text-stone-700">Analyst Rate ($/hr)</span>
                    <input
                      type="number"
                      min={0}
                      max={400}
                      value={assumptions.analystHourlyRate}
                      onChange={(e) => updateNumber('analystHourlyRate', e.target.value, 400)}
                      className="w-full rounded-lg border border-stone-200 px-2.5 py-2 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-stone-100">
                  <div className="space-y-1">
                    <span className="font-medium text-stone-700 block">
                      Broker Recovery Basis
                    </span>
                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#F6F5F3] p-1 border border-stone-200">
                      <button
                        type="button"
                        onClick={() =>
                          onChangeAssumptions({ ...assumptions, brokerRecoveryBasis: 'net' })
                        }
                        className={`py-1.5 rounded text-xs font-medium ${
                          assumptions.brokerRecoveryBasis === 'net'
                            ? 'bg-white text-[#222222] shadow-2xs'
                            : 'text-stone-600'
                        }`}
                      >
                        Net ($5,560)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onChangeAssumptions({ ...assumptions, brokerRecoveryBasis: 'gross' })
                        }
                        className={`py-1.5 rounded text-xs font-medium ${
                          assumptions.brokerRecoveryBasis === 'gross'
                            ? 'bg-white text-[#222222] shadow-2xs'
                            : 'text-stone-600'
                        }`}
                      >
                        Gross ($8,260)
                      </button>
                    </div>
                  </div>

                  <label className="block space-y-1">
                    <span className="font-medium text-stone-700">
                      Prevented Leakage Base (CAD/yr — Hypothetical, Validate in Pilot)
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={10000}
                      value={assumptions.annualPreventedLeakageBase}
                      onChange={(e) => updateNumber('annualPreventedLeakageBase', e.target.value)}
                      className="w-full rounded-lg border border-stone-200 px-2.5 py-2 font-mono tabular-nums text-[#222222] focus:border-[#F04F25] focus:outline-none"
                    />
                  </label>
                </div>

                <div className="pt-2 border-t border-stone-100 space-y-3">
                  {(
                    [
                      ['brokerRecoveryLikelihoodPct', 'Broker Recovery Likelihood'],
                      ['duplicateRecoveryLikelihoodPct', 'IR-03 Duplicate Recovery Likelihood'],
                      ['missedFtaRecoveryLikelihoodPct', 'E-08 Missed CUSMA Recovery Likelihood'],
                      ['adoptionFactorPct', 'Organizational Adoption Factor'],
                      ['year1RampUpPct', 'Year-1 Realization Ramp-Up'],
                    ] as [keyof ROIAssumptions, string][]
                  ).map(([field, label]) => (
                    <div key={field}>
                      <div className="flex justify-between mb-1">
                        <span className="font-medium text-stone-700">{label}</span>
                        <span className="font-mono font-semibold text-[#F04F25] tabular-nums">
                          {assumptions[field]}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Number(assumptions[field])}
                        onChange={(e) => updateNumber(field, e.target.value, 100)}
                        className="w-full accent-[#F04F25] cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: 7 Separated Categories & Explicit Calculation Formulas */}
            <div className="xl:col-span-7 rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-5">
              <div>
                <h3 className="text-base font-semibold text-[#222222]">
                  Seven Strictly Separated Financial Categories
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  Separates documented sunk losses and non-cash accrual items from conditional recoveries, prevention estimates, and capacity gains.
                </p>
              </div>

              <div className="divide-y divide-stone-200 text-xs">
                <div className="py-3.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-[#222222]">
                      1. Documented Q3 Expense Exposure (Historical Baseline — NOT Savings)
                    </div>
                    <div className="mt-0.5 text-stone-500">
                      Irregular costs ({formatCAD(CASE_CONSTANTS.IRREGULAR_TOTAL_CAD)}) + Trade &amp; broker ({formatCAD(CASE_CONSTANTS.TRADE_ALL_IN_TOTAL_CAD)}). Separate customer sales tax: {formatCAD(CASE_CONSTANTS.INTERPROVINCIAL_TAX_TOTAL_CAD)}.
                    </div>
                  </div>
                  <div className="font-mono tabular-nums font-semibold text-stone-700 shrink-0">
                    {formatCAD(results.recordedQ3IrregularExposure + results.recordedQ3TradeCost)} / qtr
                  </div>
                </div>

                <div className="py-3.5 space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[#222222]">
                        2. Conditional Recoveries &amp; Non-Cash Accounting Adjustments
                      </div>
                      <div className="mt-0.5 text-stone-500">
                        IR-03 duplicate AP claim ($265K &times; {assumptions.duplicateRecoveryLikelihoodPct}% = <span className="font-mono text-[#222222]">{formatCAD(results.conditionalDuplicateRecoveryIR03)}</span> Year-1). IR-06 warranty reversal (<span className="font-mono">{formatCAD(410_000)}</span>) is non-cash accounting review — excluded from cash ROI.
                      </div>
                    </div>
                    <div className="font-mono tabular-nums font-semibold text-emerald-700 shrink-0">
                      {formatCAD(results.conditionalDuplicateRecoveryIR03)} Yr-1
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-600"
                      style={{ width: `${(results.conditionalDuplicateRecoveryIR03 / maxBenefitBar) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="py-3.5 space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[#222222]">
                        3. Possible Broker Fee Recovery ({assumptions.brokerRecoveryBasis.toUpperCase()} basis)
                      </div>
                      <div className="mt-0.5 text-stone-500">
                        {formatCAD(results.brokerBaseObserved)}/qtr observed &times; 4 quarters &times; {assumptions.brokerRecoveryLikelihoodPct}% likelihood &times; {assumptions.adoptionFactorPct}% adoption.
                      </div>
                    </div>
                    <div className="font-mono tabular-nums font-semibold text-[#F04F25] shrink-0">
                      {formatCAD(results.annualizedBrokerRecovery)} / yr
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#F04F25]"
                      style={{ width: `${(results.annualizedBrokerRecovery / maxBenefitBar) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="py-3.5 space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[#222222]">
                        4. Conditional Missed Trade-Agreement Claim (E-08 CUSMA)
                      </div>
                      <div className="mt-0.5 text-stone-500">
                        $11,020/qtr candidate &times; 4 &times; {assumptions.missedFtaRecoveryLikelihoodPct}% &times; {assumptions.adoptionFactorPct}% adoption (contingent on valid supplier origin certificates).
                      </div>
                    </div>
                    <div className="font-mono tabular-nums font-semibold text-[#F04F25] shrink-0">
                      {formatCAD(results.conditionalMissedFtaE08Annual)} / yr
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-600"
                      style={{ width: `${(results.conditionalMissedFtaE08Annual / maxBenefitBar) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="py-3.5 space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[#222222]">
                        5. Estimated Future Irregular Cost &amp; Leakage Prevention (Hypothetical &amp; User-Adjustable — Validate in Pilot)
                      </div>
                      <div className="mt-0.5 text-stone-500">
                        Hypothetical base ({formatCAD(assumptions.annualPreventedLeakageBase)}/yr) &times; {assumptions.adoptionFactorPct}% adoption. Must be validated during 90-day pilot; NOT a documented Appendix figure.
                      </div>
                    </div>
                    <div className="font-mono tabular-nums font-semibold text-[#333333] shrink-0">
                      {formatCAD(results.preventedFutureLeakageAnnual)} / yr
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#333333]"
                      style={{ width: `${(results.preventedFutureLeakageAnnual / maxBenefitBar) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="py-3.5 space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[#222222]">
                        6. Investigation Hours &amp; Close Capacity Saved (Non-Cash Redeployment)
                      </div>
                      <div className="mt-0.5 text-stone-500">
                        {assumptions.annualIncidentCount} incidents &times; {assumptions.hoursSavedPerIncident} hrs &times; {assumptions.adoptionFactorPct}% adoption = {results.annualInvestigationHoursSaved} hrs/yr @ {formatCAD(assumptions.analystHourlyRate)}/hr.
                      </div>
                    </div>
                    <div className="font-mono tabular-nums font-semibold text-stone-700 shrink-0">
                      {formatCAD(results.annualLaborEfficiencyValue)} / yr
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-stone-500"
                      style={{ width: `${(results.annualLaborEfficiencyValue / maxBenefitBar) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#FAF9F7] px-3 py-3 rounded-lg border border-stone-200">
                  <div>
                    <div className="font-semibold text-[#222222]">
                      7. External Government Tariff Rate Movements (15% / 25% / 35%)
                    </div>
                    <div className="mt-0.5 text-stone-600">
                      Scenario risk only (-/+$840,000 annualized at 15%/35%). Strictly excluded from SKYGUARD software ROI.
                    </div>
                  </div>
                  <div className="font-mono tabular-nums font-semibold text-stone-600 shrink-0">
                    CAD $0 in ROI
                  </div>
                </div>
              </div>

              {/* Transparent Formulas */}
              <div className="rounded-lg border border-stone-200 bg-[#FAF9F7] p-4 text-xs space-y-1.5">
                <div className="font-semibold text-[#222222]">Explicit Calculation Equations</div>
                <div className="text-stone-600 font-mono">
                  Year-1 Benefit = IR-03 ({formatCAD(results.conditionalDuplicateRecoveryIR03)}) + Steady Annual ({formatCAD(results.steadyStateAnnualBenefit)}) &times; {assumptions.year1RampUpPct}% = {formatCAD(results.year1GrossBenefit)}
                </div>
                <div className="text-stone-600 font-mono">
                  Year-1 Cost = Impl ({formatCAD(assumptions.implementationCost)}) + Training ({formatCAD(assumptions.employeeTrainingCost)}) + 12m Maint ({formatCAD(results.annualOperatingCost)}) = {formatCAD(results.year1TotalCost)}
                </div>
                <div className="text-stone-600 font-mono">
                  3-Year Net = {formatCAD(results.threeYearGrossBenefit)} Benefit - {formatCAD(results.threeYearTotalCost)} Cost = {formatSignedCAD(results.threeYearNetBenefit)} ({results.threeYearRoiPct.toFixed(0)}% ROI)
                </div>
              </div>
            </div>
          </section>

          {/* 11-Metric Side-by-Side Comparison Across Low / Base / High */}
          <section className="rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-4">
            <div>
              <h3 className="text-base font-semibold text-[#222222]">
                11-Metric Sensitivity Comparison (Low / Base / High)
              </h3>
              <p className="mt-1 text-xs text-stone-500">
                Compares all costs, conditional recoveries, hypothetical prevented leakage, labor capacity, net benefits, ROI %, and payback side-by-side. Excludes external tariff rate swings and avoids double counting IR-03 one-time recovery.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-stone-200 bg-[#FAFAFA] text-stone-600">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Financial / Operational Metric</th>
                    {sensitivityCols.map((col) => (
                      <th key={col.key} className="py-2.5 px-4 font-semibold text-right">
                        {col.label} ({col.assumptions.adoptionFactorPct}% Adopt)
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 font-mono tabular-nums">
                  {[
                    {
                      metric: '1. Implementation Cost (One-time)',
                      vals: sensitivityCols.map((c) => formatCAD(c.assumptions.implementationCost)),
                    },
                    {
                      metric: '2. Annual O&M Cost (12 × Monthly Maint.)',
                      vals: sensitivityCols.map((c) => formatCAD(c.res.annualOperatingCost)),
                    },
                    {
                      metric: '3. Employee Training Cost (One-time)',
                      vals: sensitivityCols.map((c) => formatCAD(c.assumptions.employeeTrainingCost)),
                    },
                    {
                      metric: '4. Annual Labor Efficiency Savings (Non-Cash Redeployment)',
                      vals: sensitivityCols.map((c) => formatCAD(c.res.annualLaborEfficiencyValue)),
                    },
                    {
                      metric: '5. Potential Recoveries (IR-03 Yr-1 + Broker + E-08 Annualized)',
                      vals: sensitivityCols.map((c) =>
                        formatCAD(
                          c.res.conditionalDuplicateRecoveryIR03 +
                            c.res.annualizedBrokerRecovery +
                            c.res.conditionalMissedFtaE08Annual
                        )
                      ),
                    },
                    {
                      metric: '6. Hypothetical Prevented Leakage (Validate in Pilot)',
                      vals: sensitivityCols.map((c) => formatCAD(c.res.preventedFutureLeakageAnnual)),
                    },
                    {
                      metric: '7. Year-1 Net Benefit',
                      vals: sensitivityCols.map((c) => formatSignedCAD(c.res.year1NetBenefit)),
                      highlight: true,
                    },
                    {
                      metric: '8. 3-Year Cumulative Net Benefit',
                      vals: sensitivityCols.map((c) => formatSignedCAD(c.res.threeYearNetBenefit)),
                      highlight: true,
                    },
                    {
                      metric: '9. Year-1 ROI %',
                      vals: sensitivityCols.map((c) => `${c.res.year1RoiPct.toFixed(0)}%`),
                    },
                    {
                      metric: '10. 3-Year ROI %',
                      vals: sensitivityCols.map((c) => `${c.res.threeYearRoiPct.toFixed(0)}%`),
                      accent: true,
                    },
                    {
                      metric: '11. Simple Payback Period',
                      vals: sensitivityCols.map((c) =>
                        c.res.simplePaybackMonths !== null
                          ? `${c.res.simplePaybackMonths.toFixed(1)} mos`
                          : 'N/A'
                      ),
                    },
                  ].map((row) => (
                    <tr key={row.metric} className="hover:bg-[#FAF9F7]">
                      <td className="py-2.5 px-3 font-sans font-medium text-[#222222]">
                        {row.metric}
                      </td>
                      {row.vals.map((val, idx) => (
                        <td
                          key={`${row.metric}-${idx}`}
                          className={`py-2.5 px-4 text-right ${
                            row.accent
                              ? 'font-semibold text-[#F04F25]'
                              : row.highlight
                              ? 'font-semibold text-[#222222]'
                              : 'text-[#333333]'
                          }`}
                        >
                          {val}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pilot Validation Requirements */}
            <div className="rounded-lg border border-stone-200 bg-[#FAF9F7] p-4 space-y-2 text-xs">
              <div className="font-semibold text-[#222222]">
                Pilot Validation Requirements Before Realizing Projected ROI
              </div>
              <ul className="list-disc pl-5 space-y-1 text-stone-600">
                <li>
                  <span className="font-medium text-[#222222]">Hypothetical Prevented Leakage (CAD $160K Base):</span>{' '}
                  Benchmark actual recurring AP exceptions, Account 2890 clearing speed, and Plant 2 expedited freight frequency during a 90-day pilot before locking run-rate savings.
                </li>
                <li>
                  <span className="font-medium text-[#222222]">One-Time vs. Recurring Separation:</span>{' '}
                  IR-03 duplicate invoice recovery (up to CAD $265K) is counted at most once in Year-1 only after supplier V-4471 statement reconciliation; IR-06 (CAD $410K) is non-cash accrual review and excluded from cash ROI.
                </li>
                <li>
                  <span className="font-medium text-[#222222]">Broker &amp; Trade Verification:</span>{' '}
                  Confirm 0.2% contract schedule across customs brokers (Net $5,560 / Gross $8,260 in Q3) and obtain supplier CUSMA Certificate of Origin for E-08 ($11,020/qtr candidate). External government tariff rate swings (15%/25%/35%) are excluded from ROI.
                </li>
              </ul>
            </div>
          </section>
        </>
      )}

      {/* Implementation Roadmap & Governance Risks (Shared across both models) */}
      <section className="rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[#222222]">
              Phased Implementation Plan &amp; Human Control Gates
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              20-week rollout preserving human controller authority and read-only ERP integration.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Key risk: AP/EDI mapping quality &amp; supplier CUSMA documentation completeness</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {ROADMAP_PHASES.map((step) => (
            <div
              key={step.phase}
              className="rounded-xl border border-stone-200 p-4 flex flex-col justify-between space-y-3 bg-[#FAF9F7]"
            >
              <div className="space-y-1.5">
                <div className="text-xs font-mono font-semibold text-[#F04F25]">
                  {step.phase}
                </div>
                <h4 className="text-sm font-semibold text-[#222222]">
                  {step.title}
                </h4>
                <div className="text-[11px] text-stone-500">{step.owner}</div>
                <p className="pt-1 text-xs text-stone-600 leading-relaxed">
                  {step.scope}
                </p>
              </div>
              <div className="pt-3 border-t border-stone-200 flex items-center gap-1.5 text-[11px] font-medium text-[#333333]">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                <span>{step.gate}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
