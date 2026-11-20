import React from 'react';
import {
  AlertTriangle,
  Database,
  Download,
  FileSpreadsheet,
  HardDrive,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import {
  APPENDIX_SECTIONS,
  SCHEMA_VERSION,
  STORAGE_KEY_V2,
  formatCAD,
} from '../data/skyjackCaseData';
import type {
  CustomsEntry,
  EarningsWalk,
  ImportedQuarterRecord,
  InterprovincialDelivery,
  IrregularCostItem,
  NavSection,
  SkyguardPersistedState,
  TariffRateRule,
  TariffRuleChangeLog,
} from '../types/skyguard';

interface DataManagementProps {
  state: SkyguardPersistedState;
  anomalies: IrregularCostItem[];
  customsEntries: CustomsEntry[];
  tariffRules: TariffRateRule[];
  tariffRuleChangelog?: TariffRuleChangeLog[];
  interprovincialDeliveries: InterprovincialDelivery[];
  customWalks: EarningsWalk[];
  importedQuarters?: ImportedQuarterRecord[];
  onExportJsonBackup: () => void;
  onRequestResetToOfficialCase: () => void;
  onNavigate: (section: NavSection) => void;
}

function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const COST_TEMPLATE_CSV = [
  'id,date,department,plantAndRegion,regionGroup,title,amount,costType,walkCategory,glAccount,vendorOrCounterparty,invoiceNumber,preparer,approvalState,approvalRef,cause',
  'IR-08,2026-09-29,Operations,Plant 2 · North America,North America,Unscheduled pump rework,300000,One-time,Fixed plant,GL 6415,Internal Plant 2,INV-8812,PA-2214,Confirmed Missing,,Scenario test entry missing approval reference',
].join('\n');

const SHIPMENT_TEMPLATE_CSV = [
  'id,date,originCountry,destination,goods,hsCode,declaredValue,normalDutyPct,chinaExtraPct,exportDutyPct,ftaClaimed,billedBrokerFee,contractBrokerPct,notes',
  'E-13,2026-09-29,UK,Guelph,hydraulic valves,8481,100000,2.0,0,0,false,400,0.2,Scenario test entry (expected 2% duty $2000; expected 0.2% broker $200 vs $400 billed)',
].join('\n');

const FUTURE_QUARTER_IS_TEMPLATE_CSV = [
  'quarter,salesCAD,variableCostsCAD,fixedPlantCostsCAD,sgaCAD,amortizationCAD,sourceName',
  'Q4 2026,342000000,248000000,45500000,20600000,5900000,Q4 2026 Preliminary Management P&L',
].join('\n');

const WALK_DRIVERS_TEMPLATE_CSV = [
  'walkId,walkTitle,fromPeriod,toPeriod,startEarningsThousands,endEarningsThousands,lineLabel,signedAmountThousands,category,sourceReference',
  'Q4-2026-QOQ,Q3 2026 -> Q4 2026 Provisional Walk,Q3 2026,Q4 2026,20700,22000,Sales: volume,2900,Sales,Q4 Sales Volume Schedule',
  'Q4-2026-QOQ,Q3 2026 -> Q4 2026 Provisional Walk,Q3 2026,Q4 2026,20700,22000,Variable costs: volume,-1400,Variable costs,Q4 COGS Volume Schedule',
  'Q4-2026-QOQ,Q3 2026 -> Q4 2026 Provisional Walk,Q3 2026,Q4 2026,20700,22000,Fixed plant & SG&A net,-200,Fixed plant,Q4 Plant Overhead Sheet',
].join('\n');

export const DataManagement: React.FC<DataManagementProps> = ({
  anomalies,
  customsEntries,
  tariffRules,
  tariffRuleChangelog = [],
  interprovincialDeliveries,
  customWalks,
  importedQuarters = [],
  onExportJsonBackup,
  onRequestResetToOfficialCase,
  onNavigate,
}) => {
  const baselineCosts = anomalies.filter((a) => a.provenance === 'Official case baseline');
  const scenarioCosts = anomalies.filter((a) => a.provenance === 'User-added scenario');
  const baselineShipments = customsEntries.filter((c) => c.provenance === 'Official case baseline');
  const scenarioShipments = customsEntries.filter((c) => c.provenance === 'User-added scenario');

  return (
    <div className="space-y-6">
      {/* Storage & Prototype Scope Notice */}
      <section className="rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#222222]">
              <HardDrive className="h-4 w-4 text-[#F04F25]" />
              <span>Local Browser Workspace Storage (Schema v{SCHEMA_VERSION})</span>
            </div>
            <p className="text-xs text-stone-600 max-w-3xl">
              Demo edits, added records, verification ticks, and ROI assumptions are stored locally in this browser (<span className="font-mono">{STORAGE_KEY_V2}</span>). There is no live ERP connection, external cloud sync, or multi-user authentication.
            </p>
          </div>
          <button
            type="button"
            onClick={onRequestResetToOfficialCase}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset to Official Case</span>
          </button>
        </div>
      </section>

      {/* Dataset Inventory Summary */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs space-y-2">
          <div className="text-xs font-medium text-stone-500">Irregular Cost Entries</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-[#222222]">
            {anomalies.length} <span className="text-xs font-sans font-normal text-stone-500">total records</span>
          </div>
          <div className="text-xs text-stone-600 font-mono tabular-nums">
            Baseline: {baselineCosts.length} ({formatCAD(baselineCosts.reduce((s, a) => s + a.amount, 0))})
            <br />
            User scenarios: {scenarioCosts.length} ({formatCAD(scenarioCosts.reduce((s, a) => s + a.amount, 0))})
          </div>
        </div>

        <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs space-y-2">
          <div className="text-xs font-medium text-stone-500">Customs & Broker Entries</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-[#222222]">
            {customsEntries.length} <span className="text-xs font-sans font-normal text-stone-500">shipments</span>
          </div>
          <div className="text-xs text-stone-600 font-mono tabular-nums">
            Baseline: {baselineShipments.length} · User scenarios: {scenarioShipments.length}
            <br />
            Tariff rules tracked: {tariffRules.length} ({tariffRuleChangelog.length} logged changes)
          </div>
        </div>

        <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs space-y-2">
          <div className="text-xs font-medium text-stone-500">Earnings Walks & Close</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-[#222222]">
            {2 + customWalks.length} <span className="text-xs font-sans font-normal text-stone-500">walks</span>
          </div>
          <div className="text-xs text-stone-600">
            Locked Official: YoY (+$5.5M) & QoQ (+$4.2M)
            <br />
            Custom walks: {customWalks.length} · Imported quarters: {importedQuarters.length}
          </div>
        </div>

        <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs space-y-2">
          <div className="text-xs font-medium text-stone-500">Interprovincial Deliveries</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-[#222222]">
            {interprovincialDeliveries.length} <span className="text-xs font-sans font-normal text-stone-500">Canadian routes</span>
          </div>
          <div className="text-xs text-stone-600 font-mono tabular-nums">
            Sales tax: {formatCAD(interprovincialDeliveries.reduce((s, d) => s + d.customerSalesTax, 0))}
            <br />
            Domestic freight: {formatCAD(interprovincialDeliveries.reduce((s, d) => s + d.freightExpense, 0))}
          </div>
        </div>
      </section>

      {/* CSV Ingestion Schemas & JSON Backup */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#222222]">
            <FileSpreadsheet className="h-4 w-4 text-[#F04F25]" />
            <span>CSV Import Templates & Guided Ingestion</span>
          </div>
          <p className="text-xs text-stone-600">
            Download validated CSV starter templates or jump directly to Cost Intelligence / Trade Intelligence to upload your own CSV rows with column preview and duplicate-ID checks.
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => downloadTextFile('skyguard_cost_entries_template.csv', COST_TEMPLATE_CSV)}
              className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3.5 py-2 text-xs font-medium text-[#333333] hover:bg-[#F6F5F3]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Cost Entries CSV Template</span>
            </button>
            <button
              type="button"
              onClick={() => downloadTextFile('skyguard_customs_entries_template.csv', SHIPMENT_TEMPLATE_CSV)}
              className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3.5 py-2 text-xs font-medium text-[#333333] hover:bg-[#F6F5F3]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Shipments CSV Template</span>
            </button>
            <button
              type="button"
              onClick={() =>
                downloadTextFile('skyguard_future_quarter_income_statement.csv', FUTURE_QUARTER_IS_TEMPLATE_CSV)
              }
              className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3.5 py-2 text-xs font-medium text-[#333333] hover:bg-[#F6F5F3]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Future-Quarter P&amp;L CSV Template</span>
            </button>
            <button
              type="button"
              onClick={() => downloadTextFile('skyguard_walk_drivers_template.csv', WALK_DRIVERS_TEMPLATE_CSV)}
              className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3.5 py-2 text-xs font-medium text-[#333333] hover:bg-[#F6F5F3]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Walk Drivers CSV Template</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('anomalies')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#333333] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#222222]"
            >
              <span>Open Cost CSV Importer</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('trade')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#F04F25] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#D9421B]"
            >
              <span>Open Shipment CSV Importer</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('close')}
              className="inline-flex items-center gap-2 rounded-lg border border-[#F04F25] bg-[#FFF8F5] px-3.5 py-2 text-xs font-medium text-[#D9421B] hover:bg-[#FFF0E9]"
            >
              <span>Open Future-Quarter CSV Importer</span>
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#222222]">
            <Database className="h-4 w-4 text-[#F04F25]" />
            <span>Working Data Backup (JSON) vs. Official Executive Brief (PDF)</span>
          </div>
          <p className="text-xs text-stone-600">
            Use the <span className="font-semibold text-[#222222]">Export Executive Brief (PDF)</span> button in the top header to generate the board-ready multi-page PDF report with embedded SKYJACK branding. Use the separate button below only if you need raw JSON working-data backup.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onExportJsonBackup}
              className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold text-[#333333] hover:bg-[#F6F5F3]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Backup Working Data (JSON)</span>
            </button>
          </div>
          <div className="rounded-lg bg-[#FAF9F7] border border-stone-200 p-3 flex items-start gap-2.5 text-xs text-stone-600">
            <ShieldCheck className="h-4 w-4 text-[#F04F25] shrink-0 mt-0.5" />
            <span>
              Official Appendix records (IR-01..IR-07, E-01..E-12, YoY/QoQ walks, IP-01..IP-05) stay explicitly tagged as “Official case baseline” and cannot be overwritten silently.
            </span>
          </div>
        </div>
      </section>

      {/* Prototype Security Boundaries & Real-World Deployment Architecture */}
      <section className="rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#222222]">
          <ShieldCheck className="h-4 w-4 text-[#F04F25]" />
          <span>Prototype Security Boundaries &amp; Real-World Deployment Architecture</span>
        </div>
        <p className="text-xs text-stone-600">
          This competition prototype isolates demo workflow data inside browser storage without pretending to enforce production enterprise security. A real SKYJACK deployment would add the following controls:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="rounded-lg border border-stone-200 bg-[#FAF9F7] p-3.5 space-y-1">
            <div className="font-semibold text-[#222222]">1. Simulated Identity vs. Enterprise SSO</div>
            <p className="text-stone-600">
              Prototype approvals are labeled <span className="font-medium">Simulated Demo Approval — Identity Not Verified</span>. Production connects corporate SAML 2.0 / OIDC SSO so every close verification and dismissal is cryptographically tied to an authenticated employee.
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-[#FAF9F7] p-3.5 space-y-1">
            <div className="font-semibold text-[#222222]">2. RBAC Segregation of Duties</div>
            <p className="text-stone-600">
              Separates Preparers (CSV/ERP viewers), Investigators (Dana / Marco), and Controllers/Approvers (Helen) so an entry preparer cannot self-approve a missing-authorization close exception.
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-[#FAF9F7] p-3.5 space-y-1">
            <div className="font-semibold text-[#222222]">3. Append-Only Server Audit Storage</div>
            <p className="text-stone-600">
              Replaces client-side <span className="font-mono">localStorage</span> with an immutable server-side relational audit log capturing timestamps, evidence hashes, before/after state, and sign-off signatures.
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-[#FAF9F7] p-3.5 space-y-1">
            <div className="font-semibold text-[#222222]">4. Read-Only ERP &amp; Broker Connectors</div>
            <p className="text-stone-600">
              Replaces manual CSV uploads with scheduled read-only extracts from ERP General Ledger, Accounts Payable, and CBSA/broker EDI feeds — strictly enforcing <span className="font-medium">zero automated GL writebacks</span>.
            </p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-[#FAF9F7] p-3.5 space-y-1">
            <div className="font-semibold text-[#222222]">5. Server-Side AI &amp; API Controls</div>
            <p className="text-stone-600">
              Optional Gemini advisory calls already proxy through server-side Express routes (<span className="font-mono">/api/*</span>) so API keys never enter client bundles; production adds rate-limiting, TLS 1.3, and tenant network isolation.
            </p>
          </div>
        </div>
      </section>

      {/* Source Provenance & Competition Notes */}
      <section className="rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#222222]">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span>Case Source & Scope Boundaries</span>
        </div>
        <ul className="text-xs text-stone-600 space-y-1.5 list-disc pl-4">
          <li>Source: Prompt to Pitch 2026 — SKYJACK Case &amp; Official Appendix ({APPENDIX_SECTIONS.INCOME_STATEMENTS}–{APPENDIX_SECTIONS.COMPANY_RULES}; fictional competition figures — CAD).</li>
          <li>Historical operating earnings ({APPENDIX_SECTIONS.INCOME_STATEMENTS}–{APPENDIX_SECTIONS.QOQ_WALK}): Q3 2026 CAD $20.7M on sales of CAD $329.7M (+CAD $5.5M YoY vs. $15.2M; +CAD $4.2M QoQ vs. $16.5M).</li>
          <li>Quarterly trade-cost progression ({APPENDIX_SECTIONS.TRADE_SUMMARY}, {APPENDIX_SECTIONS.CUSTOMS_ENTRIES}, {APPENDIX_SECTIONS.TRADE_TRENDS}): Q4 2024 ($298K) through Q3 2026 ($737K rounded / $736,770 exact ledger sum).</li>
          <li>Tariff rules ({APPENDIX_SECTIONS.CHINA_TARIFF_SCENARIOS} &amp; {APPENDIX_SECTIONS.COMPANY_RULES}: 25% China additional tariff, 4% DDP export duty, 0.2% broker contract) are fictional practice assumptions and never real-world legal or customs rulings.</li>
        </ul>
      </section>
    </div>
  );
};
