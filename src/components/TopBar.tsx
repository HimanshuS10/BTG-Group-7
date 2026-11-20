import React from 'react';
import { FileDown, Eye, Loader2, Menu } from 'lucide-react';
import type { NavSection } from '../types/skyguard';

interface TopBarProps {
  activeSection: NavSection;
  onOpenMobileMenu: () => void;
  onExportPdf: () => void;
  onOpenReportPreview: () => void;
  pdfGenerating: boolean;
}

const SECTION_META: Record<NavSection, { title: string; context: string }> = {
  executive: {
    title: 'Executive Overview',
    context: 'Q3 2026 Historical Performance, Regional Irregularities & Trade Exposure',
  },
  anomalies: {
    title: 'Cost Intelligence',
    context: 'IR-01..IR-07 Screening, Five Ws & How, Duplicate Matching & Controller Handoff',
  },
  close: {
    title: 'Quarterly Close Intelligence',
    context: 'Automated YoY (+$5.5M) & QoQ (+$4.2M) Operating Earnings Waterfalls',
  },
  trade: {
    title: 'Trade Intelligence',
    context: 'E-01..E-12 Customs Tracker, 0.2% Broker Audit & China Tariff Simulator',
  },
  interprovincial: {
    title: 'Interprovincial Costs',
    context: 'Canadian Deliveries · Customer Sales Tax Collected vs. Outbound Freight',
  },
  analyst: {
    title: 'AI Financial Analyst',
    context: 'Deterministic Case Engine + Optional Gemini 4 Evidence Synthesis',
  },
  roi: {
    title: 'Business Impact & ROI',
    context: 'Editable Financial Assumptions, Separated Value Buckets & Rollout Roadmap',
  },
  data: {
    title: 'Data Management',
    context: 'CSV Ingestion, Provenance Verification, JSON Backup & Official Case Reset',
  },
};

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  onOpenMobileMenu,
  onExportPdf,
  onOpenReportPreview,
  pdfGenerating,
}) => {
  const meta = SECTION_META[activeSection];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-stone-200 px-4 sm:px-8 py-3.5">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="lg:hidden rounded-lg border border-stone-200 p-2 text-[#333333] hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-[#F04F25]"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
              <span>SKYGUARD AI</span>
              <span aria-hidden="true">·</span>
              <span>Fictional competition case figures — CAD</span>
              <span aria-hidden="true">·</span>
              <span className="hidden sm:inline">{meta.context}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[#222222] truncate">
              {meta.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenReportPreview}
            className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-xs font-medium text-[#333333] hover:bg-[#F6F5F3] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#F04F25]"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Report Preview</span>
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            disabled={pdfGenerating}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F04F25] px-4 py-2 text-xs font-semibold text-white hover:bg-[#D9421B] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#F04F25]"
          >
            {pdfGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            <span>Export Executive Brief (PDF)</span>
          </button>
        </div>
      </div>
    </header>
  );
};
