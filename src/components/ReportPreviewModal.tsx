import React from 'react';
import { FileDown, Loader2, X } from 'lucide-react';
import {
  CASE_CONSTANTS,
  DEFAULT_PRESENTATION_ROI_ASSUMPTIONS,
  calculateChinaTariffSimulation,
  calculatePresentationYear1ROI,
  calculateTrustworthyROI,
  evaluateWalkReconciliation,
  formatCAD,
  formatSignedCAD,
} from '../data/skyjackCaseData';
import type {
  CustomsEntry,
  EarningsWalk,
  ImportedQuarterRecord,
  InterprovincialDelivery,
  IrregularCostItem,
  PeriodCloseApprovalRecord,
  PresentationROIYear1Assumptions,
  ROIAssumptions,
  ROIModelSelection,
  TariffRuleChangeLog,
} from '../types/skyguard';

interface ReportPreviewModalProps {
  open: boolean;
  onClose: () => void;
  onDownloadPdf: () => void;
  pdfGenerating: boolean;
  anomalies: IrregularCostItem[];
  customsEntries: CustomsEntry[];
  interprovincialDeliveries: InterprovincialDelivery[];
  importedQuarters?: ImportedQuarterRecord[];
  tariffRuleChangelog?: TariffRuleChangeLog[];
  yoyWalk: EarningsWalk;
  qoqWalk: EarningsWalk;
  customWalks?: EarningsWalk[];
  periodCloseApprovals?: Record<string, PeriodCloseApprovalRecord>;
  chinaScenarioPct: number;
  selectedRoiModel?: ROIModelSelection;
  presentationRoiAssumptions?: PresentationROIYear1Assumptions;
  roiAssumptions: ROIAssumptions;
}

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
  open,
  onClose,
  onDownloadPdf,
  pdfGenerating,
  anomalies,
  customsEntries,
  interprovincialDeliveries,
  importedQuarters = [],
  tariffRuleChangelog = [],
  yoyWalk,
  qoqWalk,
  customWalks = [],
  periodCloseApprovals = {},
  chinaScenarioPct,
  selectedRoiModel = 'presentation_y1',
  presentationRoiAssumptions = DEFAULT_PRESENTATION_ROI_ASSUMPTIONS,
  roiAssumptions,
}) => {
  if (!open) return null;

  const baselineIr = anomalies.filter((a) => a.provenance === 'Official case baseline');
  const workingIrTotal = anomalies.reduce((s, a) => s + a.amount, 0);
  const workingDutyTariff = customsEntries.reduce((s, c) => s + c.assessedDutyAndTariffs, 0);
  const workingBrokerBilled = customsEntries.reduce((s, c) => s + c.billedBrokerFee, 0);
  const workingBrokerExpected = customsEntries.reduce((s, c) => s + c.expectedBrokerFee, 0);
  const chinaSim = calculateChinaTariffSimulation(customsEntries, chinaScenarioPct / 100);
  const presRoi = calculatePresentationYear1ROI(presentationRoiAssumptions);
  const roi = calculateTrustworthyROI(roiAssumptions, customsEntries);
  const yoyEval = evaluateWalkReconciliation(yoyWalk, anomalies, anomalies, periodCloseApprovals, importedQuarters);
  const qoqEval = evaluateWalkReconciliation(qoqWalk, anomalies, anomalies, periodCloseApprovals, importedQuarters);
  const customEvalsCount = customWalks.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Executive Brief Report Preview"
    >
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xl max-w-3xl w-full max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/aistudio/image_6dc12cf5.png"
              alt="SKYJACK — simply reliable"
              className="h-8 w-auto object-contain shrink-0"
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#222222] truncate">
                SKYGUARD AI — Executive Brief Preview
              </div>
              <div className="text-xs text-stone-500 truncate">
                Prompt to Pitch 2026 Student Competition Prototype · Live Workspace State
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report preview"
            className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          <div className="border-b-2 border-[#F04F25] pb-3 flex flex-wrap items-center justify-between gap-2 text-stone-600">
            <span>Fictional competition case figures — CAD</span>
            <span>Generated {new Date().toISOString().slice(0, 10)}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-stone-200 p-3">
              <div className="text-stone-500">Q3 2026 Earnings</div>
              <div className="mt-1 font-mono font-semibold text-sm text-[#222222]">
                {formatCAD(CASE_CONSTANTS.Q3_2026_EARNINGS_CAD)}
              </div>
            </div>
            <div className="rounded-lg border border-stone-200 p-3">
              <div className="text-stone-500">Irregular Costs</div>
              <div className="mt-1 font-mono font-semibold text-sm text-[#222222]">
                {formatCAD(workingIrTotal)}
              </div>
              <div className="text-[11px] text-stone-500">
                Base: {formatCAD(baselineIr.reduce((s, a) => s + a.amount, 0))} (7 items)
              </div>
            </div>
            <div className="rounded-lg border border-stone-200 p-3">
              <div className="text-stone-500">All-In Trade Costs</div>
              <div className="mt-1 font-mono font-semibold text-sm text-[#222222]">
                {formatCAD(workingDutyTariff + workingBrokerBilled)}
              </div>
              <div className="text-[11px] text-stone-500">
                Net broker excess: {formatCAD(workingBrokerBilled - workingBrokerExpected)}
              </div>
            </div>
            <div className="rounded-lg border border-stone-200 p-3">
              <div className="text-stone-500">Interprovincial Tax</div>
              <div className="mt-1 font-mono font-semibold text-sm text-[#222222]">
                {formatCAD(interprovincialDeliveries.reduce((s, d) => s + d.customerSalesTax, 0))}
              </div>
              <div className="text-[11px] text-stone-500">Separate from expenses</div>
            </div>
          </div>

          <div className="rounded-lg border border-stone-200 p-4 space-y-2 bg-[#FAF9F7]">
            <div className="font-semibold text-[#222222]">
              7 Structured Sections Included in Executive Brief PDF Download
            </div>
            <ol className="list-decimal pl-4 space-y-1 text-stone-600">
              <li>Executive Summary and Management Recommendations (Position, Risks, Close Readiness &amp; 3 Prioritized Actions)</li>
              <li>Key Financial Performance (8 Historical Quarters{importedQuarters.length > 0 ? ` + ${importedQuarters.length} Imported Quarter(s)` : ''} · Department &amp; Region Breakdown)</li>
              <li>Earnings-Walk Analysis and Period-Specific Close Readiness (Stage 1 vs Stage 2 · YoY: {yoyEval.closeStatus} [{yoyEval.verifiedMaterialCount}/{yoyEval.materialLinesCount}] · QoQ: {qoqEval.closeStatus} [{qoqEval.verifiedMaterialCount}/{qoqEval.materialLinesCount}]{customEvalsCount > 0 ? ` · +${customEvalsCount} custom walk(s)` : ''})</li>
              <li>Irregular Costs and Investigation Priorities ({anomalies.length} entries · Active vs Dismissed Rules &amp; Owners)</li>
              <li>Customs, Broker Fees and Tariff Exposure ({customsEntries.length} rows · China Slider {chinaScenarioPct}% = {formatSignedCAD(chinaSim.quarterlyDelta)}/qtr · Changelog {tariffRuleChangelog.length})</li>
              <li>
                Business Impact, ROI and Implementation (
                {selectedRoiModel === 'presentation_y1'
                  ? `Active Model: Group 7 Presentation Model — Year 1 · ${presRoi.year1RoiPct.toFixed(1)}% Yr-1 ROI · ${formatCAD(presRoi.totalInvestment)} Investment vs ${formatCAD(presRoi.totalPotentialBenefits)} Benefits · 0% Dup Sensitivity ${presRoi.zeroDuplicateRoiPct.toFixed(1)}%`
                  : `Active Model: Original Three-Year Model · ${roi.threeYearRoiPct.toFixed(0)}% 3-Yr ROI · Low/Base/High 11-Metric Table & Pilot Validation`}
                )
              </li>
              <li>Detailed Supporting Tables and Appendix References (Full YoY/QoQ Walks, E-01..E-12, IP-01..IP-05 &amp; Section 1.1–4.1 Citations)</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-200 flex items-center justify-end gap-3 bg-[#FAF9F7] rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-medium text-[#333333] hover:bg-[#F6F5F3]"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={pdfGenerating}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F04F25] px-4 py-2 text-xs font-semibold text-white hover:bg-[#D9421B] disabled:opacity-60"
          >
            {pdfGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            <span>Download Real PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
