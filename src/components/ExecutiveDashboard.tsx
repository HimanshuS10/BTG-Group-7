import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import {
  APPENDIX_SECTIONS,
  CASE_CONSTANTS,
  HISTORICAL_QUARTERLY_SERIES,
  OFFICIAL_QOQ_WALK,
  OFFICIAL_YOY_WALK,
  evaluateWalkReconciliation,
  formatCAD,
  formatCompactCAD,
  getActiveScreeningFlags,
} from '../data/skyjackCaseData';
import type {
  CustomsEntry,
  ImportedQuarterRecord,
  InterprovincialDelivery,
  IrregularCostItem,
  NavSection,
  PeriodCloseApprovalRecord,
  WalkLineOverride,
} from '../types/skyguard';

interface ExecutiveDashboardProps {
  anomalies: IrregularCostItem[];
  customsEntries: CustomsEntry[];
  interprovincialDeliveries: InterprovincialDelivery[];
  importedQuarters?: ImportedQuarterRecord[];
  walkLineOverrides: Record<string, WalkLineOverride>;
  periodCloseApprovals?: Record<string, PeriodCloseApprovalRecord>;
  onNavigate: (section: NavSection, selectedAnomalyId?: string) => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  anomalies,
  customsEntries,
  interprovincialDeliveries,
  importedQuarters = [],
  walkLineOverrides,
  periodCloseApprovals = {},
  onNavigate,
}) => {
  const [hoveredQuarter, setHoveredQuarter] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const baselineAnomalies = anomalies.filter(
      (a) => a.provenance === 'Official case baseline'
    );
    const userAnomalies = anomalies.filter(
      (a) => a.provenance === 'User-added scenario'
    );
    const baselineIrTotal = baselineAnomalies.reduce((s, a) => s + a.amount, 0);
    const workingIrTotal = anomalies.reduce((s, a) => s + a.amount, 0);
    const userIrDelta = workingIrTotal - baselineIrTotal;

    const flaggedEntries = anomalies.filter(
      (a) => getActiveScreeningFlags(a, anomalies, customsEntries).length > 0
    );
    const unresolvedFlagged = flaggedEntries.filter(
      (a) => a.status !== 'Resolved'
    );

    const baselineShipments = customsEntries.filter(
      (c) => c.provenance === 'Official case baseline'
    );
    const userShipments = customsEntries.filter(
      (c) => c.provenance === 'User-added scenario'
    );

    const baselineTradeAllIn = baselineShipments.reduce(
      (s, e) => s + e.assessedDutyAndTariffs + e.billedBrokerFee,
      0
    );
    const workingTradeAllIn = customsEntries.reduce(
      (s, e) => s + e.assessedDutyAndTariffs + e.billedBrokerFee,
      0
    );
    const workingNetBrokerExcess = customsEntries.reduce(
      (s, e) => s + e.brokerVariance,
      0
    );
    const workingGrossOvercharge = customsEntries
      .filter((e) => e.brokerVariance > 0)
      .reduce((s, e) => s + e.brokerVariance, 0);

    const deptMap = new Map<string, number>();
    for (const item of anomalies) {
      deptMap.set(item.department, (deptMap.get(item.department) ?? 0) + item.amount);
    }
    const byDepartment = Array.from(deptMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    const regionMap = new Map<string, number>();
    for (const item of anomalies) {
      regionMap.set(item.regionGroup, (regionMap.get(item.regionGroup) ?? 0) + item.amount);
    }
    const byRegion = Array.from(regionMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Evaluate YoY close readiness with overrides
    const yoyWithOverrides = {
      ...OFFICIAL_YOY_WALK,
      lines: OFFICIAL_YOY_WALK.lines.map((l) =>
        walkLineOverrides[l.id] ? { ...l, ...walkLineOverrides[l.id] } : l
      ),
    };
    const yoyEval = evaluateWalkReconciliation(
      yoyWithOverrides,
      anomalies,
      anomalies,
      periodCloseApprovals,
      importedQuarters
    );
    const qoqWithOverrides = {
      ...OFFICIAL_QOQ_WALK,
      lines: OFFICIAL_QOQ_WALK.lines.map((l) =>
        walkLineOverrides[l.id] ? { ...l, ...walkLineOverrides[l.id] } : l
      ),
    };
    const qoqEval = evaluateWalkReconciliation(
      qoqWithOverrides,
      anomalies,
      anomalies,
      periodCloseApprovals,
      importedQuarters
    );

    const interprovTaxTotal = interprovincialDeliveries.reduce(
      (s, d) => s + d.customerSalesTax,
      0
    );
    const interprovFreightTotal = interprovincialDeliveries.reduce(
      (s, d) => s + d.freightExpense,
      0
    );

    return {
      baselineIrTotal,
      workingIrTotal,
      userIrDelta,
      userAnomaliesCount: userAnomalies.length,
      userShipmentsCount: userShipments.length,
      unresolvedFlagged,
      baselineTradeAllIn,
      workingTradeAllIn,
      workingNetBrokerExcess,
      workingGrossOvercharge,
      byDepartment,
      byRegion,
      yoyEval,
      qoqEval,
      interprovTaxTotal,
      interprovFreightTotal,
    };
  }, [anomalies, customsEntries, interprovincialDeliveries, walkLineOverrides, periodCloseApprovals, importedQuarters]);

  const maxDeptAmount = metrics.byDepartment[0]?.amount ?? 1;
  const maxRegionAmount = metrics.byRegion[0]?.amount ?? 1;

  // Chart scaling for 8-quarter Sales (0..360M) & Operating Earnings (0..25M)
  const chartW = 640;
  const chartH = 235;
  const maxSales = 360;
  const maxEbit = 24;

  const hoveredDatum = HISTORICAL_QUARTERLY_SERIES.find(
    (q) => q.quarter === hoveredQuarter
  );

  return (
    <div className="space-y-7">
      {/* Problem Framing Strip (Why the current process is slow + unified solution) */}
      <section className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-8 space-y-1">
            <div className="text-xs font-semibold text-[#F04F25]">
              Unified Plant Cost & International Trade Control Platform
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              SKYJACK faces two connected visibility gaps: (1) CAD $2.818M in Q3 2026 irregular costs ({APPENDIX_SECTIONS.IRREGULAR_SUMMARY}–{APPENDIX_SECTIONS.IRREGULAR_DETAILS}) without consistent screening or Five-Ws evidence, and (2) CAD $736,770 in customs duties, 25% additional China practice tariffs, and broker overcharges ({APPENDIX_SECTIONS.TRADE_SUMMARY}–{APPENDIX_SECTIONS.INTERPROVINCIAL}) mixed with domestic interprovincial taxes. SKYGUARD AI unifies entry screening, YoY/QoQ close walks ({APPENDIX_SECTIONS.YOY_WALK}–{APPENDIX_SECTIONS.QOQ_WALK}), and customs auditing while separating source-confirmed figures from human-verified explanations.
            </p>
          </div>
          <div className="lg:col-span-4 flex flex-wrap lg:justify-end gap-2">
            <button
              type="button"
              onClick={() => onNavigate('anomalies')}
              className="rounded-lg border border-stone-200 bg-[#FAFAFA] px-3.5 py-2 text-xs font-medium text-[#333333] hover:bg-[#F6F5F3]"
            >
              Dana: Cost Intelligence
            </button>
            <button
              type="button"
              onClick={() => onNavigate('close')}
              className="rounded-lg border border-stone-200 bg-[#FAFAFA] px-3.5 py-2 text-xs font-medium text-[#333333] hover:bg-[#F6F5F3]"
            >
              Helen: Quarterly Close
            </button>
            <button
              type="button"
              onClick={() => onNavigate('trade')}
              className="rounded-lg border border-stone-200 bg-[#FAFAFA] px-3.5 py-2 text-xs font-medium text-[#333333] hover:bg-[#F6F5F3]"
            >
              Marco: Trade & Tariffs
            </button>
          </div>
        </div>
      </section>

      {/* Working Scenario Indicator Banner (only shown when user added entries/shipments) */}
      {(metrics.userAnomaliesCount > 0 || metrics.userShipmentsCount > 0) && (
        <section className="rounded-xl bg-[#FFF3ED] border border-[#F04F25]/30 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-[#333333]">
            <span className="font-semibold text-[#D9421B]">Working Scenario Active:</span>{' '}
            Official Q3 2026 baseline remains locked ({formatCAD(metrics.baselineIrTotal)} irregular; {formatCAD(metrics.baselineTradeAllIn)} trade), plus{' '}
            <span className="font-mono font-semibold">
              +{metrics.userAnomaliesCount} cost(s) ({formatCAD(metrics.userIrDelta)})
            </span>{' '}
            and{' '}
            <span className="font-mono font-semibold">
              +{metrics.userShipmentsCount} shipment(s)
            </span>
            .
          </div>
          <button
            type="button"
            onClick={() => onNavigate('data')}
            className="font-medium text-[#D9421B] hover:underline whitespace-nowrap"
          >
            Manage Scenario Data
          </button>
        </section>
      )}

      {/* Top 4 KPI Cards */}
      <section aria-label="Official Q3 2026 Financial KPIs">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {/* KPI 1: Q3 2026 Operating Earnings */}
          <button
            type="button"
            onClick={() => onNavigate('close')}
            className="text-left rounded-xl bg-white border border-stone-200 p-5 shadow-2xs hover:border-[#F04F25]/50 transition-colors focus-visible:outline-2 focus-visible:outline-[#F04F25]"
          >
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-stone-500">
              <span>Q3 2026 Operating Earnings</span>
              <ArrowRight className="h-3.5 w-3.5 text-stone-400" />
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-[#222222] font-mono tabular-nums">
              CAD $20.7M
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs tabular-nums">
              <span className="font-medium text-emerald-700">+CAD $5.5M YoY</span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span className="font-medium text-emerald-700">+CAD $4.2M QoQ</span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span className="text-stone-500">Sales $329.7M</span>
            </div>
          </button>

          {/* KPI 2: Irregular / Unidentified Costs */}
          <button
            type="button"
            onClick={() => onNavigate('anomalies')}
            className="text-left rounded-xl bg-white border border-stone-200 p-5 shadow-2xs hover:border-[#F04F25]/50 transition-colors focus-visible:outline-2 focus-visible:outline-[#F04F25]"
          >
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-stone-500">
              <span>Irregular / Unidentified Costs</span>
              <ArrowRight className="h-3.5 w-3.5 text-stone-400" />
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-[#222222] font-mono tabular-nums">
              {formatCompactCAD(metrics.workingIrTotal)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs tabular-nums">
              <span className="text-stone-600">
                Baseline: {formatCAD(metrics.baselineIrTotal)} (7)
              </span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span className="text-red-700 font-medium">
                {metrics.unresolvedFlagged.length} open alerts
              </span>
            </div>
          </button>

          {/* KPI 3: Q3 Duty, Tariff & Broker Costs */}
          <button
            type="button"
            onClick={() => onNavigate('trade')}
            className="text-left rounded-xl bg-white border border-stone-200 p-5 shadow-2xs hover:border-[#F04F25]/50 transition-colors focus-visible:outline-2 focus-visible:outline-[#F04F25]"
          >
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-stone-500">
              <span>Q3 Duty, Tariff & Broker Costs</span>
              <ArrowRight className="h-3.5 w-3.5 text-stone-400" />
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-[#222222] font-mono tabular-nums">
              {formatCAD(metrics.workingTradeAllIn)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs tabular-nums">
              <span className="text-stone-600">
                Base: {formatCAD(metrics.baselineTradeAllIn)} ({customsEntries.length})
              </span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span className="text-[#D9421B] font-medium">+$425K vs Q3 25</span>
            </div>
          </button>

          {/* KPI 4: Net Broker Excess + Close Status */}
          <button
            type="button"
            onClick={() => onNavigate('trade')}
            className="text-left rounded-xl bg-white border border-stone-200 p-5 shadow-2xs hover:border-[#F04F25]/50 transition-colors focus-visible:outline-2 focus-visible:outline-[#F04F25]"
          >
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-stone-500">
              <span>Net Broker Excess (0.2% Contract)</span>
              <ArrowRight className="h-3.5 w-3.5 text-stone-400" />
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-[#F04F25] font-mono tabular-nums">
              {formatCAD(metrics.workingNetBrokerExcess)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs tabular-nums">
              <span className="text-stone-600">
                Gross over: {formatCAD(metrics.workingGrossOvercharge)}
              </span>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <span className="text-stone-500">E-11 under: -$2,700</span>
            </div>
          </button>
        </div>
      </section>

      {/* 8-Quarter Charts Row: Sales & Earnings + Trade Escalation */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* 8-Quarter Historical Sales & Operating Earnings */}
        <div className="xl:col-span-7 rounded-xl bg-white border border-stone-200 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-[#222222]">
                  8-Quarter Historical Sales & Operating Earnings (CAD Millions)
                </h2>
                <p className="mt-1 text-xs text-stone-500">
                  Official Q4 2024 – Q3 2026 series. Earnings grew +$5.5M YoY (Q3 25 $15.2M &rarr; Q3 26 $20.7M) and +$4.2M QoQ.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-stone-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-stone-300" />
                  <span>Sales ($M)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#F04F25]" />
                  <span>Operating Earnings ($M)</span>
                </span>
              </div>
            </div>

            <div className="mt-5">
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className="w-full h-56 overflow-visible"
                role="img"
                aria-label="8-Quarter Historical Sales and Operating Earnings Chart"
              >
                {/* Gridlines */}
                {[0, 6, 12, 18, 24].map((ebitTick) => {
                  const y = 188 - (ebitTick / maxEbit) * 155;
                  return (
                    <g key={ebitTick}>
                      <line
                        x1={46}
                        y1={y}
                        x2={600}
                        y2={y}
                        stroke="#E5E7EB"
                        strokeDasharray={ebitTick === 0 ? undefined : '3 3'}
                      />
                      <text
                        x={40}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-stone-400 text-[10px] font-mono tabular-nums"
                      >
                        ${ebitTick}M
                      </text>
                    </g>
                  );
                })}

                {/* Sales Bars */}
                {HISTORICAL_QUARTERLY_SERIES.map((q, idx) => {
                  const slotW = 540 / HISTORICAL_QUARTERLY_SERIES.length;
                  const barW = 28;
                  const cx = 62 + idx * slotW + slotW / 2;
                  const barH = (q.salesM / maxSales) * 155;
                  const barY = 188 - barH;
                  const isHovered = hoveredQuarter === q.quarter;
                  return (
                    <g
                      key={q.quarter}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredQuarter(q.quarter)}
                      onMouseLeave={() => setHoveredQuarter(null)}
                    >
                      <rect
                        x={cx - barW / 2}
                        y={barY}
                        width={barW}
                        height={barH}
                        rx={3}
                        fill={isHovered ? '#A8A29E' : '#E7E5E4'}
                      />
                      <text
                        x={cx}
                        y={206}
                        textAnchor="middle"
                        className="fill-stone-600 text-[10px] font-medium"
                      >
                        {q.quarter}
                      </text>
                    </g>
                  );
                })}

                {/* Operating Earnings Line */}
                <polyline
                  fill="none"
                  stroke="#F04F25"
                  strokeWidth={2.5}
                  points={HISTORICAL_QUARTERLY_SERIES.map((q, idx) => {
                    const slotW = 540 / HISTORICAL_QUARTERLY_SERIES.length;
                    const cx = 62 + idx * slotW + slotW / 2;
                    const cy = 188 - (q.operatingEarningsM / maxEbit) * 155;
                    return `${cx},${cy}`;
                  }).join(' ')}
                />

                {/* Operating Earnings Points + Value Labels */}
                {HISTORICAL_QUARTERLY_SERIES.map((q, idx) => {
                  const slotW = 540 / HISTORICAL_QUARTERLY_SERIES.length;
                  const cx = 62 + idx * slotW + slotW / 2;
                  const cy = 188 - (q.operatingEarningsM / maxEbit) * 155;
                  return (
                    <g
                      key={`pt-${q.quarter}`}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredQuarter(q.quarter)}
                      onMouseLeave={() => setHoveredQuarter(null)}
                    >
                      <circle
                        cx={cx}
                        cy={cy}
                        r={4.5}
                        fill="#FFFFFF"
                        stroke="#F04F25"
                        strokeWidth={2.5}
                      />
                      <text
                        x={cx}
                        y={cy - 9}
                        textAnchor="middle"
                        className="fill-[#333333] text-[10px] font-mono font-semibold tabular-nums"
                      >
                        ${q.operatingEarningsM.toFixed(1)}M
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600">
            <span>
              {hoveredDatum
                ? `${hoveredDatum.quarter}: Sales CAD $${hoveredDatum.salesM.toFixed(1)}M · Operating Earnings CAD $${hoveredDatum.operatingEarningsM.toFixed(1)}M · Trade Costs CAD $${hoveredDatum.tradeCostsK}K`
                : 'Hover any quarter to inspect exact sales, earnings, and trade cost figures.'}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('close')}
              className="font-medium text-[#F04F25] hover:underline"
            >
              Open YoY / QoQ Waterfalls &rarr;
            </button>
          </div>
        </div>

        {/* 8-Quarter Duty / Tariff / Broker Trend */}
        <div className="xl:col-span-5 rounded-xl bg-white border border-stone-200 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#222222]">
              8-Quarter Duty, Tariff & Broker Trend (CAD Thousands)
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Additional 25% China practice tariffs start Q1 2026, driving a +CAD $425K YoY surge (Q3 25 $312K &rarr; Q3 26 $737K).
            </p>

            <div className="mt-5 space-y-2.5">
              {HISTORICAL_QUARTERLY_SERIES.map((q) => {
                const isTariffPeriod = q.quarter.includes('2026');
                const pct = Math.min(100, (q.tradeCostsK / 800) * 100);
                return (
                  <div key={q.quarter} className="grid grid-cols-12 items-center gap-2 text-xs">
                    <div className="col-span-3 font-medium text-stone-700">
                      {q.quarter}
                    </div>
                    <div className="col-span-6 h-2.5 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isTariffPeriod ? 'bg-[#F04F25]' : 'bg-stone-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="col-span-3 text-right font-mono tabular-nums font-medium text-[#333333]">
                      ${q.tradeCostsK}K
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
            <span>Interprovincial customer tax ({formatCAD(metrics.interprovTaxTotal)}) excluded</span>
            <span className="font-mono font-semibold text-[#D9421B]">
              +136% YoY (Q3)
            </span>
          </div>
        </div>
      </section>

      {/* Regional & Department Breakdowns + Close Readiness & Action Queue */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-6">
          <div>
            <h2 className="text-base font-semibold text-[#222222]">
              Irregular Costs by Department & Region
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Baseline: North America {formatCAD(CASE_CONSTANTS.IRREGULAR_NORTH_AMERICA_CAD)} · Finance {formatCAD(CASE_CONSTANTS.IRREGULAR_FINANCE_CAD)}. None reaches $1M individually.
            </p>
            <div className="mt-4 space-y-2.5">
              {metrics.byDepartment.map((dept) => (
                <div key={dept.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#333333] font-medium">{dept.name}</span>
                    <span className="font-mono tabular-nums font-semibold text-[#222222]">
                      {formatCAD(dept.amount)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#333333]"
                      style={{ width: `${(dept.amount / maxDeptAmount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-stone-100 space-y-2.5">
            <h3 className="text-sm font-semibold text-[#222222]">
              Exposure by Region
            </h3>
            {metrics.byRegion.map((reg) => (
              <div key={reg.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#333333] font-medium">{reg.name}</span>
                  <span className="font-mono tabular-nums font-medium text-[#222222]">
                    {formatCAD(reg.amount)} (
                    {((reg.amount / metrics.workingIrTotal) * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#F04F25]"
                    style={{ width: `${(reg.amount / maxRegionAmount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Investigation & Close Readiness Pipeline */}
        <div className="lg:col-span-7 rounded-xl bg-white border border-stone-200 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-stone-100">
              <div>
                <h2 className="text-base font-semibold text-[#222222]">
                  Investigation Pipeline & Quarterly Close Readiness
                </h2>
                <p className="mt-0.5 text-xs text-stone-500">
                  Unreviewed IR entries block controller close readiness even below $1M when evidence or approvals are open.
                </p>
              </div>
              <div className="text-xs font-medium text-right space-y-0.5">
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>
                    Stage 1 · {metrics.yoyEval.isReconciled && metrics.qoqEval.isReconciled ? 'Financially Reconciled' : 'Reconciliation Check Required'}
                  </span>
                </span>
                {metrics.yoyEval.closeStatus === 'Approved for Close' &&
                metrics.qoqEval.closeStatus === 'Approved for Close' ? (
                  <div className="space-y-0.5">
                    <div className="inline-flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Stage 2 · Approved for Close</span>
                    </div>
                    <div className="text-[10px] text-emerald-700">
                      Simulated Demo Approval — Identity Not Verified
                    </div>
                  </div>
                ) : metrics.yoyEval.closeStatus !== 'Blocked' &&
                  metrics.qoqEval.closeStatus !== 'Blocked' ? (
                  <div className="inline-flex items-center gap-1.5 text-[#D9421B]">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      Stage 2 · Ready for Sign-Off
                      {metrics.yoyEval.closeStatus === 'Approved for Close'
                        ? ' (YoY Approved; QoQ Pending Sign-Off)'
                        : metrics.qoqEval.closeStatus === 'Approved for Close'
                        ? ' (QoQ Approved; YoY Pending Sign-Off)'
                        : ' (Awaiting Controller Sign-Off)'}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <div className="inline-flex items-center gap-1.5 text-amber-700">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>
                        Stage 2 ·{' '}
                        {metrics.yoyEval.closeStatus === 'Approved for Close'
                          ? `YoY Approved for Close · QoQ ${metrics.qoqEval.closeStatus}`
                          : metrics.qoqEval.closeStatus === 'Approved for Close'
                          ? `QoQ Approved for Close · YoY ${metrics.yoyEval.closeStatus}`
                          : metrics.yoyEval.closeStatus === 'Ready for Sign-Off'
                          ? `YoY Ready for Sign-Off · QoQ ${metrics.qoqEval.closeStatus}`
                          : 'Blocked (Pending Verification & Evidence)'}
                      </span>
                    </div>
                    {(metrics.yoyEval.approvalSuspended || metrics.qoqEval.approvalSuspended) && (
                      <div className="text-[10px] text-red-700">
                        Prior Approval Suspended — Re-Review Required
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="divide-y divide-stone-100 mt-1">
              {metrics.unresolvedFlagged.slice(0, 6).map((item) => {
                const flags = getActiveScreeningFlags(item, anomalies, customsEntries);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate('anomalies', item.id)}
                    className="w-full py-3 px-2 -mx-2 rounded-lg text-left hover:bg-[#F6F5F3] transition-colors flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-semibold text-[#222222]">
                          {item.id}
                        </span>
                        <span className="text-stone-300">·</span>
                        <span className="text-stone-600">{item.department}</span>
                        <span className="text-stone-300">·</span>
                        <span className="text-stone-500">{item.provenance}</span>
                      </div>
                      <div className="text-sm font-medium text-[#222222] truncate">
                        {item.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          <span>{flags[0]?.ruleName ?? 'Flagged'}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-stone-500">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{item.status}</span>
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold font-mono tabular-nums text-[#222222]">
                        {formatCAD(item.amount)}
                      </div>
                      <div className="mt-0.5 text-xs font-medium text-[#F04F25]">
                        Review
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-stone-500">
              Verified Material Lines: YoY {metrics.yoyEval.verifiedMaterialCount}/{metrics.yoyEval.materialLinesCount} · QoQ {metrics.qoqEval.verifiedMaterialCount}/{metrics.qoqEval.materialLinesCount}
              {importedQuarters.length > 0 ? ` · +${importedQuarters.length} imported quarter(s)` : ''}
              {' · '}
              {APPENDIX_SECTIONS.INCOME_STATEMENTS}–{APPENDIX_SECTIONS.QOQ_WALK}, {APPENDIX_SECTIONS.IRREGULAR_SUMMARY}–{APPENDIX_SECTIONS.IRREGULAR_TOTALS}, {APPENDIX_SECTIONS.TRADE_SUMMARY} & {APPENDIX_SECTIONS.INTERPROVINCIAL}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('close')}
              className="font-semibold text-[#F04F25] hover:underline"
            >
              Open Close Intelligence &rarr;
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
