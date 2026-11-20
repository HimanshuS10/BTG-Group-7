import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Link2,
  Plus,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import {
  APPENDIX_SECTIONS,
  HISTORICAL_QUARTERLY_SERIES,
  OFFICIAL_QOQ_WALK,
  OFFICIAL_YOY_WALK,
  evaluateWalkReconciliation,
  extractQuarterKey,
  formatCAD,
  formatSignedCAD,
  getActiveScreeningFlags,
} from '../data/skyjackCaseData';
import {
  parseCsvNumber,
  parseCsvRecordsDetailed,
  parseCsvWithHeaders,
} from '../utils/csvParser';
import type {
  AuditEntry,
  CloseChecklistItem,
  EarningsWalk,
  ImportedQuarterRecord,
  IrregularCostItem,
  NavSection,
  PeriodCloseApprovalRecord,
  WalkExplanationStatus,
  WalkLineItem,
  WalkLineOverride,
} from '../types/skyguard';

interface QuarterlyCloseIntelligenceProps {
  anomalies: IrregularCostItem[];
  customWalks: EarningsWalk[];
  importedQuarters: ImportedQuarterRecord[];
  walkLineOverrides: Record<string, WalkLineOverride>;
  closeChecklist: CloseChecklistItem[];
  closeApprovalLog: AuditEntry[];
  periodCloseApprovals: Record<string, PeriodCloseApprovalRecord>;
  onVerifyWalkLine: (
    lineId: string,
    status: WalkExplanationStatus,
    explanationText: string,
    owner: string,
    evidenceReference: string,
    approvalDecision: 'Pending' | 'Approved' | 'Needs Investigation',
    verifier: string,
    verificationDate: string
  ) => void;
  onToggleCloseChecklist: (id: string) => void;
  onAddCustomWalk: (walk: EarningsWalk) => void;
  onDeleteCustomWalk: (id: string) => void;
  onImportQuarters: (records: ImportedQuarterRecord[]) => void;
  onDeleteImportedQuarter: (id: string) => void;
  onRecordCloseSignOff: (
    walkId: string,
    reviewerName: string,
    approvalDate: string
  ) => void;
  onNavigate: (section: NavSection, anomalyId?: string) => void;
  onExportPdf?: () => void;
}

const SAMPLE_INCOME_STMT_CSV = [
  'quarter,salesCAD,variableCostsCAD,fixedPlantCostsCAD,sgaCAD,amortizationCAD,sourceName',
  'Q4 2026,342000000,248000000,45500000,20600000,5900000,Q4 2026 Preliminary Management P&L',
].join('\n');

const SAMPLE_WALK_DRIVERS_CSV = [
  'walkId,walkTitle,fromPeriod,toPeriod,startEarningsThousands,endEarningsThousands,lineLabel,signedAmountThousands,category,sourceReference',
  'Q4-2026-QOQ,Q3 2026 -> Q4 2026 Provisional Walk,Q3 2026,Q4 2026,20700,22000,Sales: volume,2900,Sales,Q4 Sales Volume Schedule',
  'Q4-2026-QOQ,Q3 2026 -> Q4 2026 Provisional Walk,Q3 2026,Q4 2026,20700,22000,Variable costs: volume,-1400,Variable costs,Q4 COGS Volume Schedule',
  'Q4-2026-QOQ,Q3 2026 -> Q4 2026 Provisional Walk,Q3 2026,Q4 2026,20700,22000,Fixed plant & SG&A net,-200,Fixed plant,Q4 Plant Overhead Sheet',
].join('\n');

export const QuarterlyCloseIntelligence: React.FC<QuarterlyCloseIntelligenceProps> = ({
  anomalies,
  customWalks,
  importedQuarters,
  walkLineOverrides,
  closeChecklist,
  closeApprovalLog,
  periodCloseApprovals,
  onVerifyWalkLine,
  onToggleCloseChecklist,
  onAddCustomWalk,
  onDeleteCustomWalk,
  onImportQuarters,
  onDeleteImportedQuarter,
  onRecordCloseSignOff,
  onNavigate,
  onExportPdf,
}) => {
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<string>('ALL');
  const [selectedWalkId, setSelectedWalkId] = useState<string>(OFFICIAL_YOY_WALK.id);
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);
  const [materialOnlyFilter, setMaterialOnlyFilter] = useState(false);
  const [showSummaryPanel, setShowSummaryPanel] = useState(false);
  const [verifierName, setVerifierName] = useState('Helen (Corporate Controller)');
  const [verificationDate, setVerificationDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [signOffReviewer, setSignOffReviewer] = useState('Helen (Corporate Controller)');
  const [signOffDate, setSignOffDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [signOffError, setSignOffError] = useState<string | null>(null);
  const [editLineText, setEditLineText] = useState('');
  const [editLineOwner, setEditLineOwner] = useState('');
  const [editEvidenceRef, setEditEvidenceRef] = useState('');
  const [editApprovalDecision, setEditApprovalDecision] = useState<
    'Pending' | 'Approved' | 'Needs Investigation'
  >('Pending');
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Create future-quarter walk modal
  const [showNewWalkModal, setShowNewWalkModal] = useState(false);
  const [newTitle, setNewTitle] = useState('Q4 2026 Provisional Operating Earnings Walk');
  const [newFrom, setNewFrom] = useState('Q3 2026');
  const [newTo, setNewTo] = useState('Q4 2026 (Provisional)');
  const [newStartK, setNewStartK] = useState('20700');
  const [newEndK, setNewEndK] = useState('22100');
  const [newLinesText, setNewLinesText] = useState(
    'Sales: volume, 3200, Sales\nVariable costs: volume, -1500, Variable costs\nFixed plant: seasonal adjustment, -300, Fixed plant'
  );
  const [walkFormError, setWalkFormError] = useState<string | null>(null);

  // Future-Quarter CSV Importer Modal (Income Statements vs Walk Drivers)
  const [showQuarterCsvModal, setShowQuarterCsvModal] = useState(false);
  const [quarterCsvKind, setQuarterCsvKind] = useState<'income_stmt' | 'walk_drivers'>(
    'income_stmt'
  );
  const [quarterCsvText, setQuarterCsvText] = useState(SAMPLE_INCOME_STMT_CSV);

  const allWalks: EarningsWalk[] = useMemo(() => {
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
  }, [walkLineOverrides, customWalks]);

  const availablePeriods = useMemo(() => {
    const keys = new Set<string>();
    for (const w of allWalks) {
      const k = extractQuarterKey(w.toPeriod);
      if (k) keys.add(k);
    }
    for (const iq of importedQuarters) {
      const k = extractQuarterKey(iq.quarter);
      if (k) keys.add(k);
    }
    return Array.from(keys);
  }, [allWalks, importedQuarters]);

  const filteredWalks = useMemo(() => {
    if (selectedPeriodFilter === 'ALL') return allWalks;
    const matches = allWalks.filter(
      (w) => extractQuarterKey(w.toPeriod) === selectedPeriodFilter
    );
    return matches.length > 0 ? matches : allWalks;
  }, [allWalks, selectedPeriodFilter]);

  const activeWalk = useMemo(
    () =>
      filteredWalks.find((w) => w.id === selectedWalkId) ??
      allWalks.find((w) => w.id === selectedWalkId) ??
      filteredWalks[0] ??
      allWalks[0],
    [filteredWalks, allWalks, selectedWalkId]
  );

  const evaluation = useMemo(
    () =>
      evaluateWalkReconciliation(
        activeWalk,
        anomalies,
        anomalies,
        periodCloseApprovals,
        importedQuarters
      ),
    [activeWalk, anomalies, periodCloseApprovals, importedQuarters]
  );

  // Build signed waterfall bar geometry
  const waterfallData = useMemo(() => {
    let running = activeWalk.startEarningsThousands;
    const steps: {
      id: string;
      label: string;
      amountK: number;
      startK: number;
      endK: number;
      kind: 'start' | 'pos' | 'neg' | 'end';
      isMaterial: boolean;
      status?: string;
    }[] = [
      {
        id: 'start',
        label: activeWalk.fromPeriod,
        amountK: activeWalk.startEarningsThousands,
        startK: 0,
        endK: activeWalk.startEarningsThousands,
        kind: 'start',
        isMaterial: false,
      },
    ];

    for (const line of activeWalk.lines) {
      const next = running + line.amountThousands;
      steps.push({
        id: line.id,
        label: line.label,
        amountK: line.amountThousands,
        startK: Math.min(running, next),
        endK: Math.max(running, next),
        kind: line.amountThousands >= 0 ? 'pos' : 'neg',
        isMaterial: Math.abs(line.amountThousands) >= 1000,
        status: line.explanationStatus,
      });
      running = next;
    }

    steps.push({
      id: 'end',
      label: activeWalk.toPeriod,
      amountK: activeWalk.endEarningsThousands,
      startK: 0,
      endK: activeWalk.endEarningsThousands,
      kind: 'end',
      isMaterial: false,
    });

    const maxVal = Math.max(
      ...steps.map((s) => s.endK),
      activeWalk.startEarningsThousands,
      activeWalk.endEarningsThousands,
      1000
    );
    return { steps, maxVal: Math.ceil(maxVal / 5000) * 5000 };
  }, [activeWalk]);

  const visibleLines = useMemo(() => {
    if (!materialOnlyFilter) return activeWalk.lines;
    return activeWalk.lines.filter((l) => Math.abs(l.amountThousands) >= 1000);
  }, [activeWalk, materialOnlyFilter]);

  const inPeriodIrFeed = useMemo(
    () =>
      [...evaluation.inPeriodAnomalies, ...evaluation.explicitCarryForwardBlockers].filter(
        (a) => {
          const flags = getActiveScreeningFlags(a, anomalies);
          return (flags.length > 0 || a.provenance === 'Official case baseline') && a.status !== 'Resolved';
        }
      ),
    [evaluation.inPeriodAnomalies, evaluation.explicitCarryForwardBlockers, anomalies]
  );

  const priorPeriodIrFeed = useMemo(
    () => evaluation.priorPeriodOutstandingItems,
    [evaluation.priorPeriodOutstandingItems]
  );

  // Parse Future-Quarter CSV preview (RFC-4180 compliant: quoted commas, escaped quotes, malformed quotes, BOM, CRLF/LF/CR, negatives, duplicate checks)
  const incomeCsvPreview = useMemo(() => {
    if (quarterCsvKind !== 'income_stmt') return [];
    const { headers, rows, headerQuoteErrors } = parseCsvWithHeaders(quarterCsvText);
    if (headers.length === 0 || rows.length === 0) return [];

    // Build lookup map of prior earnings (in CAD) from Section 1.1 series + already-imported quarters
    const seriesList: { quarter: string; ebitCAD: number }[] = [
      ...HISTORICAL_QUARTERLY_SERIES.map((q) => ({
        quarter: q.quarter,
        ebitCAD: Math.round(q.operatingEarningsM * 1_000_000),
      })),
      ...importedQuarters.map((iq) => ({
        quarter: iq.quarter,
        ebitCAD: iq.calculatedOperatingEarningsCAD,
      })),
    ];

    const existingQuarterKeys = new Set(
      seriesList.map((s) => (extractQuarterKey(s.quarter) ?? s.quarter).toUpperCase())
    );
    const seenCsvQuarters = new Set<string>();

    const parseYearQuarter = (label: string) => {
      const m = label.match(/Q([1-4])\s*(\d{4})/i);
      if (!m) return null;
      return { q: Number(m[1]), y: Number(m[2]) };
    };

    const parsedBatch: {
      rowNum: number;
      valid: boolean;
      errors: string[];
      record?: ImportedQuarterRecord;
    }[] = [];

    for (const row of rows) {
      const [
        quarter = '',
        salesStr = '',
        varStr = '',
        fixedStr = '',
        sgaStr = '',
        amortStr = '',
        sourceName = 'Imported Quarterly Statement CSV',
      ] = row.fields;
      const errors: string[] = [
        ...(headerQuoteErrors ?? []),
        ...(row.quoteErrors ?? []),
      ];

      if (!quarter.trim()) {
        errors.push(`Row ${row.rowNum}, Column "quarter": Missing quarter label (e.g. Q4 2026).`);
      } else {
        const qKey = (extractQuarterKey(quarter) ?? quarter.trim()).toUpperCase();
        if (existingQuarterKeys.has(qKey)) {
          errors.push(`Row ${row.rowNum}, Column "quarter": Duplicate quarter "${quarter}" already exists in series/imports.`);
        } else if (seenCsvQuarters.has(qKey)) {
          errors.push(`Row ${row.rowNum}, Column "quarter": Duplicate quarter "${quarter}" within CSV.`);
        }
        seenCsvQuarters.add(qKey);
      }

      const numChecks: [string, string, ReturnType<typeof parseCsvNumber>][] = [
        ['salesCAD', salesStr, parseCsvNumber(salesStr)],
        ['variableCostsCAD', varStr, parseCsvNumber(varStr)],
        ['fixedPlantCostsCAD', fixedStr, parseCsvNumber(fixedStr)],
        ['sgaCAD', sgaStr, parseCsvNumber(sgaStr)],
        ['amortizationCAD', amortStr, parseCsvNumber(amortStr)],
      ];

      for (const [colName, , res] of numChecks) {
        if (!res.valid) {
          errors.push(`Row ${row.rowNum}, Column "${colName}": ${res.error}.`);
        } else if (res.value < 0) {
          errors.push(`Row ${row.rowNum}, Column "${colName}": Negative cost/sales (${res.value}) not allowed on income statement P&L import.`);
        }
      }

      const salesCAD = numChecks[0][2].value;
      const variableCostsCAD = numChecks[1][2].value;
      const fixedPlantCostsCAD = numChecks[2][2].value;
      const sgaCAD = numChecks[3][2].value;
      const amortizationCAD = numChecks[4][2].value;

      let record: ImportedQuarterRecord | undefined;
      if (errors.length === 0) {
        const calculatedOperatingEarningsCAD =
          salesCAD - variableCostsCAD - fixedPlantCostsCAD - sgaCAD - amortizationCAD;

        let priorQuarterLabel: string | null = null;
        let qoqChangeCAD: number | null = null;
        let yoyQuarterLabel: string | null = null;
        let yoyChangeCAD: number | null = null;

        const yq = parseYearQuarter(quarter);
        if (yq) {
          const prevQ = yq.q === 1 ? 4 : yq.q - 1;
          const prevY = yq.q === 1 ? yq.y - 1 : yq.y;
          const targetQoq = `Q${prevQ} ${prevY}`;
          const targetYoy = `Q${yq.q} ${yq.y - 1}`;
          const qoqMatch = seriesList.find(
            (s) => s.quarter.toUpperCase() === targetQoq.toUpperCase()
          );
          const yoyMatch = seriesList.find(
            (s) => s.quarter.toUpperCase() === targetYoy.toUpperCase()
          );
          if (qoqMatch) {
            priorQuarterLabel = qoqMatch.quarter;
            qoqChangeCAD = calculatedOperatingEarningsCAD - qoqMatch.ebitCAD;
          }
          if (yoyMatch) {
            yoyQuarterLabel = yoyMatch.quarter;
            yoyChangeCAD = calculatedOperatingEarningsCAD - yoyMatch.ebitCAD;
          }
        } else if (seriesList.length > 0) {
          const last = seriesList[seriesList.length - 1];
          priorQuarterLabel = last.quarter;
          qoqChangeCAD = calculatedOperatingEarningsCAD - last.ebitCAD;
        }

        seriesList.push({ quarter, ebitCAD: calculatedOperatingEarningsCAD });

        record = {
          id: `IQ-${Date.now()}-${row.rowNum}`,
          provenance: 'User-added scenario',
          quarter: quarter.trim(),
          salesCAD,
          variableCostsCAD,
          fixedPlantCostsCAD,
          sgaCAD,
          amortizationCAD,
          calculatedOperatingEarningsCAD,
          priorQuarterLabel,
          qoqChangeCAD,
          yoyQuarterLabel,
          yoyChangeCAD,
          hasDriverBreakdown: false,
          missingDriverWarning:
            'Unexplained / Pending Driver Decomposition — volume, price, and FX driver breakdown is absent from this quarterly income statement CSV; do not invent variance drivers.',
          sourceName: sourceName || 'Imported Quarterly Statement CSV',
          importedAt: new Date().toISOString().slice(0, 10),
        };
      }

      parsedBatch.push({
        rowNum: row.rowNum,
        valid: errors.length === 0,
        errors,
        record,
      });
    }
    return parsedBatch;
  }, [quarterCsvKind, quarterCsvText, importedQuarters]);

  const walkCsvPreview = useMemo(() => {
    if (quarterCsvKind !== 'walk_drivers') {
      return { walks: [] as EarningsWalk[], errors: [] as string[], validRowCount: 0, totalRowCount: 0 };
    }
    const { headers, rows, headerQuoteErrors } = parseCsvWithHeaders(quarterCsvText);
    if (headers.length === 0 || rows.length === 0) {
      return { walks: [] as EarningsWalk[], errors: [] as string[], validRowCount: 0, totalRowCount: 0 };
    }

    const errors: string[] = [...(headerQuoteErrors ?? [])];
    const seenLineKeys = new Set<string>();
    const existingWalkTitles = new Set(allWalks.map((w) => w.title.trim().toLowerCase()));
    const grouped = new Map<
      string,
      {
        title: string;
        fromPeriod: string;
        toPeriod: string;
        startK: number;
        endK: number;
        lines: WalkLineItem[];
      }
    >();

    let validRowCount = 0;

    for (const row of rows) {
      const [
        walkId = '',
        walkTitle = '',
        fromPeriod = '',
        toPeriod = '',
        startStr = '',
        endStr = '',
        lineLabel = '',
        amtStr = '',
        catRaw = 'SG&A',
        sourceRef = 'Imported Walk Drivers CSV',
      ] = row.fields;

      const rowErrs: string[] = [...(row.quoteErrors ?? [])];
      if (!walkId.trim()) rowErrs.push(`Row ${row.rowNum}, Column "walkId": Missing walkId.`);
      if (!walkTitle.trim()) {
        rowErrs.push(`Row ${row.rowNum}, Column "walkTitle": Missing walkTitle.`);
      } else if (existingWalkTitles.has(walkTitle.trim().toLowerCase())) {
        rowErrs.push(`Row ${row.rowNum}, Column "walkTitle": Walk "${walkTitle}" already exists (duplicate import blocked).`);
      }
      if (!lineLabel.trim()) rowErrs.push(`Row ${row.rowNum}, Column "lineLabel": Missing lineLabel.`);

      const startRes = parseCsvNumber(startStr);
      if (!startRes.valid) rowErrs.push(`Row ${row.rowNum}, Column "startEarningsThousands": ${startRes.error}.`);
      const endRes = parseCsvNumber(endStr);
      if (!endRes.valid) rowErrs.push(`Row ${row.rowNum}, Column "endEarningsThousands": ${endRes.error}.`);
      const amtRes = parseCsvNumber(amtStr);
      if (!amtRes.valid) rowErrs.push(`Row ${row.rowNum}, Column "signedAmountThousands": ${amtRes.error}.`);

      const dupLineKey = `${walkId.trim().toUpperCase()}|${lineLabel.trim().toLowerCase()}|${amtRes.value}`;
      if (lineLabel.trim() && seenLineKeys.has(dupLineKey)) {
        rowErrs.push(`Row ${row.rowNum}, Column "lineLabel": Duplicate walk driver "${lineLabel}" inside ${walkId}.`);
      }

      if ((headerQuoteErrors && headerQuoteErrors.length > 0) || rowErrs.length > 0) {
        errors.push(...rowErrs);
        continue;
      }

      seenLineKeys.add(dupLineKey);
      validRowCount++;

      const cat: WalkLineItem['category'] =
        catRaw === 'Sales' ||
        catRaw === 'Variable costs' ||
        catRaw === 'Fixed plant' ||
        catRaw === 'SG&A' ||
        catRaw === 'Amortization'
          ? catRaw
          : 'SG&A';

      if (!grouped.has(walkId)) {
        grouped.set(walkId, {
          title: walkTitle.trim(),
          fromPeriod: fromPeriod.trim() || 'Prior',
          toPeriod: toPeriod.trim() || 'Future',
          startK: startRes.value,
          endK: endRes.value,
          lines: [],
        });
      }
      const grp = grouped.get(walkId)!;
      grp.lines.push({
        id: `csvw-${walkId}-${row.rowNum}`,
        label: lineLabel.trim(),
        amountThousands: amtRes.value,
        category: cat,
        sourceReference: sourceRef || 'Imported Walk Drivers CSV',
        sourceAmountConfirmed: false,
        explanationStatus:
          Math.abs(amtRes.value) >= 1000 ? 'Needs investigation' : 'Awaiting Verification',
        explanationText:
          'Imported driver amount from CSV; explanation awaits human controller verification.',
        owner: 'Helen (Corporate Controller)',
        approvalDecision: 'Pending',
      });
    }

    const walks: EarningsWalk[] = Array.from(grouped.entries()).map(([wid, grp]) => ({
      id: `walk-csv-${wid}-${Date.now()}`,
      provenance: 'User-added scenario',
      type: 'Custom',
      title: grp.title,
      fromPeriod: grp.fromPeriod,
      toPeriod: grp.toPeriod,
      startEarningsThousands: grp.startK,
      endEarningsThousands: grp.endK,
      lines: grp.lines,
      sourceName: 'Walk Drivers CSV Import',
    }));

    return { walks, errors, validRowCount, totalRowCount: rows.length };
  }, [quarterCsvKind, quarterCsvText, allWalks]);

  const handleExpandLine = (line: WalkLineItem) => {
    if (expandedLineId === line.id) {
      setExpandedLineId(null);
      return;
    }
    setExpandedLineId(line.id);
    setEditLineText(line.explanationText);
    setEditLineOwner(line.owner);
    setEditEvidenceRef(line.evidenceReference ?? '');
    setEditApprovalDecision(line.approvalDecision ?? 'Pending');
    setVerifierName(line.verifiedBy ?? 'Helen (Corporate Controller)');
    setVerificationDate(line.verifiedAt ?? new Date().toISOString().slice(0, 10));
    setVerificationError(null);
  };

  const handleCreateCustomWalk = (e: React.FormEvent) => {
    e.preventDefault();
    const startK = Number(newStartK);
    const endK = Number(newEndK);
    if (!newTitle.trim() || !Number.isFinite(startK) || !Number.isFinite(endK)) {
      setWalkFormError('Title, numeric Start (CAD K), and numeric End (CAD K) are required.');
      return;
    }
    const parsedLines: WalkLineItem[] = [];
    const { records: parsedRows, issuesByRecordIndex } = parseCsvRecordsDetailed(newLinesText);
    for (let i = 0; i < parsedRows.length; i++) {
      const quoteIssues = issuesByRecordIndex.get(i);
      if (quoteIssues && quoteIssues.length > 0) {
        setWalkFormError(
          `Row ${i + 1}, Column ${quoteIssues[0].colIdx + 1}: ${quoteIssues[0].message}`
        );
        return;
      }
      const [label = '', valStr = '', catRaw = 'SG&A'] = parsedRows[i];
      const valRes = parseCsvNumber(valStr);
      if (!label || !valRes.valid) {
        setWalkFormError(`Invalid walk line on row ${i + 1}. Format: "Label, SignedThousands, Category"`);
        return;
      }
      const val = valRes.value;
      const cat: WalkLineItem['category'] =
        catRaw === 'Sales' ||
        catRaw === 'Variable costs' ||
        catRaw === 'Fixed plant' ||
        catRaw === 'SG&A' ||
        catRaw === 'Amortization'
          ? catRaw
          : 'SG&A';
      parsedLines.push({
        id: `cw-${Date.now()}-${i}`,
        label,
        amountThousands: val,
        category: cat,
        sourceReference: 'User-entered working period schedule',
        sourceAmountConfirmed: false,
        explanationStatus: Math.abs(val) >= 1000 ? 'Needs investigation' : 'Awaiting Verification',
        explanationText: 'Pending human controller verification.',
        owner: verifierName,
        approvalDecision: 'Pending',
      });
    }
    if (parsedLines.length === 0) {
      setWalkFormError('Add at least one signed walk line.');
      return;
    }

    const walk: EarningsWalk = {
      id: `walk-custom-${Date.now()}`,
      provenance: 'User-added scenario',
      type: 'Custom',
      title: newTitle.trim(),
      fromPeriod: newFrom.trim() || 'Prior',
      toPeriod: newTo.trim() || 'Future',
      startEarningsThousands: startK,
      endEarningsThousands: endK,
      lines: parsedLines,
    };
    onAddCustomWalk(walk);
    setSelectedWalkId(walk.id);
    setWalkFormError(null);
    setShowNewWalkModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Accounting Period Selector, Walk Switcher & Action Bar */}
      <section className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-100 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <label htmlFor="close-period-select" className="font-semibold text-[#222222]">
              Accounting Period:
            </label>
            <select
              id="close-period-select"
              value={selectedPeriodFilter}
              onChange={(e) => {
                const nextP = e.target.value;
                setSelectedPeriodFilter(nextP);
                if (nextP !== 'ALL') {
                  const firstMatch = allWalks.find(
                    (w) => extractQuarterKey(w.toPeriod) === nextP
                  );
                  if (firstMatch) setSelectedWalkId(firstMatch.id);
                }
              }}
              className="rounded-lg border border-stone-200 bg-[#FAFAFA] px-3 py-1.5 font-semibold text-[#222222] focus:border-[#F04F25] focus:outline-none"
            >
              <option value="ALL">All Accounting Periods ({allWalks.length} walks)</option>
              {availablePeriods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <span className="text-stone-500">
              Active Close Scope: <span className="font-mono font-semibold text-[#222222]">{evaluation.targetPeriodKey}</span> · Prior-quarter unresolved items stay separated unless explicitly carried forward.
            </span>
          </div>
          {onExportPdf && (
            <button
              type="button"
              onClick={onExportPdf}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#F04F25]/40 bg-[#FFF8F5] px-3 py-1.5 font-semibold text-[#D9421B] hover:bg-[#FFF0E9]"
            >
              <span>Export Close Findings (PDF)</span>
            </button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-[#F6F5F3] p-1">
            {filteredWalks.map((walk) => (
              <button
                key={walk.id}
                type="button"
                onClick={() => {
                  setSelectedWalkId(walk.id);
                  setExpandedLineId(null);
                }}
                className={`px-3.5 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeWalk.id === walk.id
                    ? 'bg-white text-[#222222] shadow-2xs font-semibold'
                    : 'text-stone-600 hover:text-[#222222]'
                }`}
              >
                {walk.type === 'YoY'
                  ? 'YoY Walk (Q3 25 -> Q3 26)'
                  : walk.type === 'QoQ'
                  ? 'QoQ Walk (Q2 26 -> Q3 26)'
                  : walk.title}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowSummaryPanel((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-xs font-medium text-[#333333] hover:bg-[#F6F5F3]"
            >
              <FileCheck2 className="h-3.5 w-3.5 text-[#F04F25]" />
              <span>Preliminary Close Narrative</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setQuarterCsvKind('income_stmt');
                setQuarterCsvText(SAMPLE_INCOME_STMT_CSV);
                setShowQuarterCsvModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-xs font-medium text-[#333333] hover:bg-[#F6F5F3]"
            >
              <Plus className="h-3.5 w-3.5 text-[#333333]" />
              <span>Import Future-Quarter CSV</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setWalkFormError(null);
                setShowNewWalkModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#F04F25] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#D9421B]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Future Period Walk</span>
            </button>
          </div>
        </div>

        {/* 8-Metric Close Readiness & Two-Stage Status Scorecard (Financially Reconciled vs Approved for Close) */}
        <div className="pt-3 border-t border-stone-100 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-semibold text-[#222222]">
              Quarter-End Close Readiness Scorecard ({APPENDIX_SECTIONS.YOY_WALK} / {APPENDIX_SECTIONS.QOQ_WALK} / {APPENDIX_SECTIONS.COMPANY_RULES})
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-stone-500 mr-1.5">Stage 1 · Financially Reconciled:</span>
                <span
                  className={`font-semibold font-mono ${
                    evaluation.isReconciled ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {evaluation.isReconciled
                    ? 'Yes ($0 gap)'
                    : `No (${formatSignedCAD(evaluation.discrepancyThousands * 1000)})`}
                </span>
              </div>
              <div>
                <span className="text-stone-500 mr-1.5">Stage 2 · Controller Close Gate ({evaluation.targetPeriodKey}):</span>
                <span
                  className={`font-semibold ${
                    evaluation.closeStatus === 'Approved for Close'
                      ? 'text-emerald-700'
                      : evaluation.closeStatus === 'Ready for Sign-Off'
                      ? 'text-[#D9421B]'
                      : 'text-amber-700'
                  }`}
                >
                  {evaluation.closeStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="rounded-lg bg-[#FAFAFA] border border-stone-200 p-3">
              <div className="text-stone-500">1. Total Material (&ge; $1M)</div>
              <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-[#222222]">
                {evaluation.materialLinesCount} lines
              </div>
            </div>
            <div className="rounded-lg bg-[#FAFAFA] border border-stone-200 p-3">
              <div className="text-stone-500">2. Verified Material</div>
              <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-emerald-700">
                {evaluation.verifiedMaterialCount} verified
              </div>
            </div>
            <div className="rounded-lg bg-[#FAFAFA] border border-stone-200 p-3">
              <div className="text-stone-500">3. Unresolved Material</div>
              <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-amber-700">
                {evaluation.pendingMaterialCount} unresolved
              </div>
            </div>
            <div className="rounded-lg bg-[#FAFAFA] border border-stone-200 p-3">
              <div className="text-stone-500">4. Unreconciled Difference</div>
              <div
                className={`mt-0.5 text-sm font-semibold font-mono tabular-nums ${
                  evaluation.isReconciled ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {formatCAD(evaluation.discrepancyThousands * 1000)}
              </div>
            </div>
            <div className="rounded-lg bg-[#FAFAFA] border border-stone-200 p-3">
              <div className="text-stone-500">5. {evaluation.targetPeriodKey} Open Anomalies</div>
              <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-[#F04F25]">
                {evaluation.openAnomaliesCount} open
              </div>
              <div className="text-[10px] text-stone-500 mt-0.5">
                Prior-period non-blocking: {priorPeriodIrFeed.length}
              </div>
            </div>
            <div className="rounded-lg bg-[#FAFAFA] border border-stone-200 p-3">
              <div className="text-stone-500">6. Missing Supporting Docs</div>
              <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-red-700">
                {evaluation.missingDocsCount} entries
              </div>
            </div>
            <div className="rounded-lg bg-[#FAFAFA] border border-stone-200 p-3">
              <div className="text-stone-500">7. Outstanding Approvals</div>
              <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-red-700">
                {evaluation.outstandingApprovalsCount} pending
              </div>
            </div>
            <div className="rounded-lg bg-[#FAFAFA] border border-stone-200 p-3">
              <div className="text-stone-500">8. Responsible Owners ({evaluation.responsibleOwners.length})</div>
              <div className="mt-0.5 text-[11px] font-medium text-[#222222] truncate" title={evaluation.responsibleOwners.join(', ')}>
                {evaluation.responsibleOwners.slice(0, 2).join(', ')}{evaluation.responsibleOwners.length > 2 ? ` +${evaluation.responsibleOwners.length - 2}` : ''}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-stone-500 font-mono">
            Walk Totals: Start ({activeWalk.fromPeriod}) {formatCAD(evaluation.startThousands * 1000)} + Sum {formatSignedCAD(evaluation.sumChangesThousands * 1000)} = Calc {formatCAD(evaluation.calculatedEndThousands * 1000)} vs Reported ({activeWalk.toPeriod}) {formatCAD(evaluation.reportedEndThousands * 1000)}
          </div>
        </div>

        {/* Suspended Prior Approval Notice (when post-approval edit invalidated a previous sign-off) */}
        {evaluation.approvalSuspended &&
          evaluation.periodApproval &&
          evaluation.closeStatus !== 'Approved for Close' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-900 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-red-700 shrink-0" />
                <span>
                  Prior Close Approval Suspended — Re-Review Required ({evaluation.periodApproval.periodKey})
                </span>
              </div>
              <p className="pl-5 text-red-800">
                {evaluation.suspensionReason} Previously recorded {evaluation.periodApproval.identityLabel} by{' '}
                <span className="font-semibold">{evaluation.periodApproval.reviewerName}</span> on{' '}
                <span className="font-mono">{evaluation.periodApproval.approvalDate}</span> remains preserved in the audit log below.
              </p>
            </div>
          )}

        {/* State A — Blocked */}
        {evaluation.closeStatus === 'Blocked' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" />
              <span>
                Stage 2 · Blocked ({evaluation.targetPeriodKey}): Prerequisites Incomplete
              </span>
            </div>
            <ul className="list-disc pl-5 space-y-0.5">
              {evaluation.blockingReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* State B — Ready for Sign-Off (Financially Reconciled + Verified, awaiting explicit controller approval) */}
        {evaluation.closeStatus === 'Ready for Sign-Off' && (
          <div className="rounded-lg border border-[#F04F25]/35 bg-[#FFF8F5] p-4 space-y-3 text-xs text-[#222222]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-semibold text-[#D9421B]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    Stage 2 · Ready for Sign-Off ({evaluation.targetPeriodKey}) — Final Controller Sign-Off Not Yet Recorded
                  </span>
                </div>
                <p className="text-[11px] text-stone-700 pl-6">
                  Financial reconciliation is complete, all material (&ge; $1M) walk explanations are human-verified, and {evaluation.targetPeriodKey} blocking items are cleared. Status remains <span className="font-semibold">Ready for Sign-Off</span> (NOT Approved for Close) until a demo controller explicitly records sign-off below.
                </p>
                <p className="text-[11px] text-stone-500 pl-6">
                  Simulated Demo Approval — Identity Not Verified. Production requires SSO + RBAC segregation of duties.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-0 sm:pl-6 items-end">
              <label className="block space-y-1">
                <span className="font-medium text-stone-700">Demo Controller / Reviewer Name *</span>
                <input
                  type="text"
                  value={signOffReviewer}
                  onChange={(e) => {
                    setSignOffReviewer(e.target.value);
                    setSignOffError(null);
                  }}
                  placeholder="Helen (Corporate Controller)"
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-medium text-stone-700">Approval Date *</span>
                <input
                  type="date"
                  value={signOffDate}
                  onChange={(e) => {
                    setSignOffDate(e.target.value);
                    setSignOffError(null);
                  }}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 font-mono text-xs"
                />
              </label>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    if (!signOffReviewer.trim() || !signOffDate.trim()) {
                      setSignOffError('Reviewer name and approval date are required before recording sign-off.');
                      return;
                    }
                    setSignOffError(null);
                    onRecordCloseSignOff(activeWalk.id, signOffReviewer.trim(), signOffDate.trim());
                  }}
                  className="w-full rounded-lg bg-[#F04F25] px-3.5 py-2 font-semibold text-white hover:bg-[#D9421B]"
                >
                  Record Simulated Demo Approval
                </button>
              </div>
            </div>

            {signOffError && (
              <div className="pl-6 text-red-700 font-medium">{signOffError}</div>
            )}
          </div>
        )}

        {/* State C — Approved for Close (Prerequisites satisfied AND explicit controller sign-off recorded for this period) */}
        {evaluation.closeStatus === 'Approved for Close' && evaluation.periodApproval && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-1.5 text-xs text-emerald-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                <span>
                  Stage 2 · Approved for Close ({evaluation.periodApproval.periodKey})
                </span>
              </div>
              <span className="font-mono text-[11px] font-semibold text-emerald-800 border border-emerald-300 bg-white px-2.5 py-0.5 rounded">
                {evaluation.periodApproval.identityLabel}
              </span>
            </div>
            <div className="pl-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1 text-[11px] text-emerald-900">
              <div>
                <span className="text-emerald-700">Reviewer:</span>{' '}
                <span className="font-semibold">{evaluation.periodApproval.reviewerName}</span>
              </div>
              <div>
                <span className="text-emerald-700">Approval Date:</span>{' '}
                <span className="font-mono font-semibold">{evaluation.periodApproval.approvalDate}</span>
              </div>
              <div>
                <span className="text-emerald-700">Accounting Period:</span>{' '}
                <span className="font-mono font-semibold">{evaluation.periodApproval.periodKey}</span>
              </div>
              <div>
                <span className="text-emerald-700">Decision:</span>{' '}
                <span className="font-semibold">{evaluation.periodApproval.decision}</span>
              </div>
            </div>
            <p className="pl-6 text-[11px] text-emerald-800">
              Walk approved: {evaluation.periodApproval.walkTitle}. Any subsequent edit to material explanations, walk drivers, or {evaluation.periodApproval.periodKey} blocking anomalies will automatically suspend this approval for re-review.
            </p>
          </div>
        )}
      </section>

      {/* Preliminary Close Narrative Panel */}
      {showSummaryPanel && (
        <section className="rounded-xl bg-white border border-[#F04F25]/40 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-[#222222]">
                Preliminary Close Narrative — Requires Human Verification ({activeWalk.title})
              </h3>
              <p className="text-xs text-stone-500">
                Distinguishes source-confirmed Appendix amounts ({APPENDIX_SECTIONS.YOY_WALK} / {APPENDIX_SECTIONS.QOQ_WALK}) from unverified explanations. Only human-approved explanations with supporting evidence are listed as Verified.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSummaryPanel(false)}
              className="text-xs font-medium text-stone-500 hover:text-[#222222]"
            >
              Hide
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <div className="font-semibold text-[#222222]">
                Human Verified Material Drivers ({evaluation.verifiedMaterialCount} of {evaluation.materialLinesCount} &ge; CAD $1M)
              </div>
              {evaluation.verifiedMaterialCount === 0 ? (
                <div className="rounded-lg bg-[#FAFAFA] border border-stone-200 p-3 text-stone-600">
                  No material walk drivers have completed 5-field human verification yet. Expand any walk line below to submit Reviewer, Date, Evidence Reference, Findings, and Approval Decision.
                </div>
              ) : (
                activeWalk.lines
                  .filter(
                    (l) =>
                      Math.abs(l.amountThousands) >= 1000 &&
                      l.explanationStatus === 'Verified'
                  )
                  .map((l) => (
                    <div key={l.id} className="rounded-lg bg-[#FAFAFA] border border-stone-200 p-2.5">
                      <div className="flex justify-between font-semibold text-[#222222]">
                        <span>{l.label}</span>
                        <span className="font-mono">{formatSignedCAD(l.amountThousands * 1000)}</span>
                      </div>
                      <div className="text-stone-600 mt-0.5">{l.explanationText}</div>
                      <div className="text-[11px] text-emerald-700 mt-1">
                        Verified by {l.verifiedBy} on {l.verifiedAt} · Evidence: {l.evidenceReference}
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-red-700">
                Unverified / Pending Explanations ({evaluation.pendingTotalCount} walk lines)
              </div>
              {activeWalk.lines
                .filter((l) => l.explanationStatus !== 'Verified')
                .map((l) => (
                  <div key={l.id} className="rounded-lg bg-amber-50/50 border border-amber-200 p-2.5">
                    <div className="flex justify-between font-semibold text-[#222222]">
                      <span>{l.label}</span>
                      <span className="font-mono">{formatSignedCAD(l.amountThousands * 1000)}</span>
                    </div>
                    <div className="text-stone-700 mt-0.5">{l.explanationText}</div>
                    <div className="text-[11px] text-amber-800 mt-1">
                      Owner: {l.owner} · Status: {l.explanationStatus} · Amount Confirmed: {l.sourceAmountConfirmed === false ? 'User CSV' : 'Yes (Appendix)'}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* Imported Future-Quarter Income Statements Summary (if any) */}
      {importedQuarters.length > 0 && (
        <section className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-[#222222]">
                Imported Future-Quarter Income Statements ({importedQuarters.length})
              </h3>
              <p className="text-xs text-stone-500">
                Calculated Operating Earnings, QoQ/YoY deltas, and &ge; CAD $1M materiality checks. Missing driver breakdowns remain explicitly labeled without fabricated explanations.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-[#FAFAFA] text-stone-500">
                  <th className="py-2.5 px-3">Quarter</th>
                  <th className="py-2.5 px-3 text-right">Sales</th>
                  <th className="py-2.5 px-3 text-right">Calc. Op. Earnings</th>
                  <th className="py-2.5 px-3 text-right">QoQ Δ</th>
                  <th className="py-2.5 px-3 text-right">YoY Δ</th>
                  <th className="py-2.5 px-3">Driver Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {importedQuarters.map((iq) => {
                  const qoqMat = iq.qoqChangeCAD !== null && Math.abs(iq.qoqChangeCAD) >= 1_000_000;
                  const yoyMat = iq.yoyChangeCAD !== null && Math.abs(iq.yoyChangeCAD) >= 1_000_000;
                  return (
                    <tr key={iq.id}>
                      <td className="py-2.5 px-3 font-semibold text-[#222222]">
                        <div>{iq.quarter}</div>
                        <div className="text-[11px] font-normal text-stone-500">{iq.sourceName}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatCAD(iq.salesCAD)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#222222]">
                        {formatCAD(iq.calculatedOperatingEarningsCAD)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {iq.qoqChangeCAD !== null ? (
                          <span className={qoqMat ? 'text-[#F04F25] font-semibold' : 'text-stone-700'}>
                            {formatSignedCAD(iq.qoqChangeCAD)} {qoqMat ? '(Material)' : ''}
                          </span>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {iq.yoyChangeCAD !== null ? (
                          <span className={yoyMat ? 'text-[#F04F25] font-semibold' : 'text-stone-700'}>
                            {formatSignedCAD(iq.yoyChangeCAD)} {yoyMat ? '(Material)' : ''}
                          </span>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-amber-800 max-w-xs">
                        <div className="font-semibold">Unexplained / Pending Driver Decomposition</div>
                        <div className="text-[11px] text-stone-600">{iq.missingDriverWarning}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteImportedQuarter(iq.id)}
                          className="text-red-700 hover:underline font-medium"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Genuine SVG Waterfall Chart */}
      <section className="rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#222222]">
              {activeWalk.title}
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              {activeWalk.provenance} · Every signed movement shown in CAD thousands. Material lines (&ge; CAD $1.0M) outlined in bold orange.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#333333]" />
              <span>Start / End</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
              <span>Favorable (+)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-red-600" />
              <span>Unfavorable (-)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs border-2 border-[#F04F25]" />
              <span>&ge; $1M Material</span>
            </span>
            {activeWalk.type === 'Custom' && (
              <button
                type="button"
                onClick={() => {
                  onDeleteCustomWalk(activeWalk.id);
                  setSelectedWalkId(OFFICIAL_YOY_WALK.id);
                }}
                className="inline-flex items-center gap-1 text-red-700 hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Custom Walk</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${Math.max(760, waterfallData.steps.length * 64 + 80)} 275`}
            className="w-full min-w-[740px] h-64 overflow-visible"
            role="img"
            aria-label={`${activeWalk.title} Waterfall Chart`}
          >
            {/* Horizontal gridlines */}
            {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
              const valK = Math.round(waterfallData.maxVal * frac);
              const y = 210 - frac * 175;
              return (
                <g key={frac}>
                  <line
                    x1={56}
                    y1={y}
                    x2={Math.max(740, waterfallData.steps.length * 64 + 60)}
                    y2={y}
                    stroke="#E5E7EB"
                    strokeDasharray={frac === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={48}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-stone-400 text-[10px] font-mono tabular-nums"
                  >
                    ${(valK / 1000).toFixed(0)}M
                  </text>
                </g>
              );
            })}

            {waterfallData.steps.map((step, idx) => {
              const x = 66 + idx * 62;
              const barW = 40;
              const yTop = 210 - (step.endK / waterfallData.maxVal) * 175;
              const yBot = 210 - (step.startK / waterfallData.maxVal) * 175;
              const height = Math.max(5, yBot - yTop);
              const fill =
                step.kind === 'start' || step.kind === 'end'
                  ? '#333333'
                  : step.kind === 'pos'
                  ? '#16A34A'
                  : '#DC2626';

              const shortLabel =
                step.label.length > 14 ? step.label.slice(0, 12) + '…' : step.label;

              return (
                <g
                  key={step.id}
                  className="cursor-pointer"
                  onClick={() => {
                    const matched = activeWalk.lines.find((l) => l.id === step.id);
                    if (matched) handleExpandLine(matched);
                  }}
                >
                  <rect
                    x={x}
                    y={yTop}
                    width={barW}
                    height={height}
                    rx={3}
                    fill={fill}
                    stroke={step.isMaterial ? '#F04F25' : 'none'}
                    strokeWidth={step.isMaterial ? 2.5 : 0}
                  />
                  <text
                    x={x + barW / 2}
                    y={yTop - 7}
                    textAnchor="middle"
                    className="fill-[#222222] text-[10px] font-mono font-semibold tabular-nums"
                  >
                    {step.kind === 'pos' ? '+' : ''}
                    {(step.amountK / 1000).toFixed(1)}M
                  </text>
                  <text
                    x={x + barW / 2}
                    y={226}
                    textAnchor="end"
                    transform={`rotate(-28, ${x + barW / 2}, 226)`}
                    className="fill-stone-600 text-[9.5px]"
                  >
                    {shortLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      {/* Walk Lines Table + Close Readiness Sidebar */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Detailed Reconciled Walk Lines */}
        <div className="xl:col-span-8 rounded-xl bg-white border border-stone-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[#222222]">
              Signed Earnings Walk Lines ({activeWalk.lines.length})
            </h3>
            <label className="inline-flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={materialOnlyFilter}
                onChange={(e) => setMaterialOnlyFilter(e.target.checked)}
                className="accent-[#F04F25] rounded"
              />
              <span>Material Only (&ge; CAD $1.0M)</span>
            </label>
          </div>

          <div className="divide-y divide-stone-100 text-xs">
            {visibleLines.map((line) => {
              const isMaterial = Math.abs(line.amountThousands) >= 1000;
              const isExpanded = expandedLineId === line.id;
              return (
                <div key={line.id} className="bg-white">
                  <button
                    type="button"
                    onClick={() => handleExpandLine(line)}
                    className="w-full px-5 py-3 text-left hover:bg-[#FAFAFA] flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#222222]">
                          {line.label}
                        </span>
                        {isMaterial && (
                          <span className="font-semibold text-[#F04F25]">
                            · Material (&ge; $1M)
                          </span>
                        )}
                        {line.linkedIrIds && line.linkedIrIds.length > 0 && (
                          <span className="font-mono text-stone-500">
                            · Linked: {line.linkedIrIds.join(', ')}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {line.sourceReference} · {line.sourceAmountConfirmed !== false ? 'Source-Confirmed Amount' : 'Working CSV Amount'} · Owner: {line.owner}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <span
                        className={`font-medium ${
                          line.explanationStatus === 'Verified'
                            ? 'text-emerald-700'
                            : line.explanationStatus === 'Needs investigation'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {line.explanationStatus}
                      </span>
                      <span
                        className={`font-mono tabular-nums font-semibold w-28 text-right ${
                          line.amountThousands >= 0
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }`}
                      >
                        {formatSignedCAD(line.amountThousands * 1000)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-stone-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-stone-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-4 pt-3 bg-[#FAFAFA] border-t border-stone-100 space-y-3">
                      <div className="rounded-lg border border-stone-200 bg-white p-3 text-xs space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[#222222]">
                            Source-Confirmed Amount: {formatSignedCAD(line.amountThousands * 1000)}
                          </span>
                          <span className="font-mono text-stone-500">
                            Verification Status: {line.explanationStatus}
                          </span>
                        </div>
                        <p className="text-stone-600">
                          <span className="font-medium text-[#333333]">Current Note / Proposed Context:</span>{' '}
                          {line.explanationText}
                        </p>
                      </div>

                      {line.linkedIrIds && line.linkedIrIds.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-stone-600">Connected Investigations (no double counting):</span>
                          {line.linkedIrIds.map((irId) => (
                            <button
                              key={irId}
                              type="button"
                              onClick={() => onNavigate('anomalies', irId)}
                              className="inline-flex items-center gap-1 font-mono font-semibold text-[#F04F25] hover:underline"
                            >
                              <Link2 className="h-3 w-3" />
                              <span>Inspect {irId}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="block space-y-1">
                          <span className="font-medium text-stone-700">
                            1. Reviewer Name *
                          </span>
                          <input
                            type="text"
                            value={verifierName}
                            onChange={(e) => setVerifierName(e.target.value)}
                            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="font-medium text-stone-700">
                            2. Verification Date *
                          </span>
                          <input
                            type="date"
                            value={verificationDate}
                            onChange={(e) => setVerificationDate(e.target.value)}
                            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 font-mono text-xs"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="font-medium text-stone-700">
                            Assigned Owner
                          </span>
                          <input
                            type="text"
                            value={editLineOwner}
                            onChange={(e) => setEditLineOwner(e.target.value)}
                            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs"
                          />
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block space-y-1">
                          <span className="font-medium text-stone-700">
                            3. Supporting Evidence / Reference *
                          </span>
                          <input
                            type="text"
                            value={editEvidenceRef}
                            onChange={(e) => setEditEvidenceRef(e.target.value)}
                            placeholder="e.g. Q3 Unit Shipment Log #SHP-2026-09 & GL Subledger"
                            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="font-medium text-stone-700">
                            5. Approval Decision *
                          </span>
                          <select
                            value={editApprovalDecision}
                            onChange={(e) =>
                              setEditApprovalDecision(
                                e.target.value as 'Pending' | 'Approved' | 'Needs Investigation'
                              )
                            }
                            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs"
                          >
                            <option value="Pending">Pending Review</option>
                            <option value="Approved">Approved (Verified Explanation)</option>
                            <option value="Needs Investigation">Needs Further Investigation</option>
                          </select>
                        </label>
                      </div>

                      <label className="block space-y-1">
                        <span className="font-medium text-stone-700">
                          4. Human Explanation of Findings *
                        </span>
                        <textarea
                          rows={2}
                          value={editLineText}
                          onChange={(e) => setEditLineText(e.target.value)}
                          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs"
                        />
                      </label>

                      {verificationError && (
                        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                          {verificationError}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              !verifierName.trim() ||
                              !verificationDate.trim() ||
                              !editEvidenceRef.trim() ||
                              !editLineText.trim() ||
                              editApprovalDecision !== 'Approved'
                            ) {
                              setVerificationError(
                                'To mark Verified, complete all 5 fields (Reviewer, Date, Supporting Evidence Reference, Explanation of Findings, and select Approval Decision = "Approved").'
                              );
                              return;
                            }
                            setVerificationError(null);
                            onVerifyWalkLine(
                              line.id,
                              'Verified',
                              editLineText.trim(),
                              editLineOwner.trim() || line.owner,
                              editEvidenceRef.trim(),
                              'Approved',
                              verifierName.trim(),
                              verificationDate.trim()
                            );
                          }}
                          className="rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                        >
                          Mark Human Verified
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setVerificationError(null);
                            onVerifyWalkLine(
                              line.id,
                              'Needs investigation',
                              editLineText.trim() || line.explanationText,
                              editLineOwner.trim() || line.owner,
                              editEvidenceRef.trim(),
                              'Needs Investigation',
                              verifierName.trim(),
                              verificationDate.trim()
                            );
                          }}
                          className="rounded-lg border border-stone-300 bg-white px-3.5 py-1.5 text-xs font-medium text-[#333333] hover:bg-stone-50"
                        >
                          Flag Needs Investigation
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setVerificationError(null);
                            onVerifyWalkLine(
                              line.id,
                              'Awaiting Verification',
                              editLineText.trim() || line.explanationText,
                              editLineOwner.trim() || line.owner,
                              editEvidenceRef.trim(),
                              'Pending',
                              verifierName.trim(),
                              verificationDate.trim()
                            );
                          }}
                          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
                        >
                          Set Awaiting Verification
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Preparation Checklist, Connected IR Alert Feed & Approval History */}
        <div className="xl:col-span-4 space-y-5">
          <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs space-y-3">
            <h3 className="text-sm font-semibold text-[#222222]">
              Quarter-End Close Preparation Checklist
            </h3>
            <div className="space-y-2.5 text-xs">
              {closeChecklist.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-2.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => onToggleCloseChecklist(item.id)}
                    className="mt-0.5 accent-[#F04F25] rounded"
                  />
                  <div>
                    <div
                      className={
                        item.completed
                          ? 'line-through text-stone-400'
                          : 'text-[#333333] font-medium'
                      }
                    >
                      {item.label}
                    </div>
                    <div className="text-[11px] text-stone-500">Owner: {item.owner}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs space-y-3">
            <h3 className="text-sm font-semibold text-[#222222]">
              {evaluation.targetPeriodKey} Cost Intelligence Feed ({inPeriodIrFeed.length} In-Scope)
            </h3>
            <p className="text-[11px] text-stone-500">
              Only anomalies in <span className="font-semibold text-[#222222]">{evaluation.targetPeriodKey}</span> (plus items with a documented carry-forward reason) affect this close. IR-01 (-$900K) and IR-02 (-$600K) are inside the Q3 2026 YoY walk (no double counting).
            </p>
            <div className="space-y-2 text-xs max-h-44 overflow-y-auto">
              {inPeriodIrFeed.length === 0 ? (
                <div className="text-emerald-700 font-medium">
                  No unresolved in-period or carry-forward blocking anomalies for {evaluation.targetPeriodKey}.
                </div>
              ) : (
                inPeriodIrFeed.map((ir) => (
                  <button
                    key={ir.id}
                    type="button"
                    onClick={() => onNavigate('anomalies', ir.id)}
                    className="w-full text-left rounded-lg border border-stone-200 p-2.5 hover:bg-[#FFF3ED] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-mono font-semibold text-[#222222]">
                        {ir.id} · {ir.status}
                        {ir.carryForwardBlockReason ? ' · Carry-Fwd' : ''}
                      </div>
                      <div className="truncate text-stone-600">{ir.title}</div>
                      {ir.carryForwardBlockReason && (
                        <div className="text-[10px] text-amber-800 truncate">
                          Carry-forward: {ir.carryForwardBlockReason}
                        </div>
                      )}
                    </div>
                    <span className="font-mono font-semibold text-[#F04F25] shrink-0">
                      {formatCAD(ir.amount)}
                    </span>
                  </button>
                ))
              )}
            </div>

            {priorPeriodIrFeed.length > 0 && (
              <div className="pt-3 border-t border-stone-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-stone-700">
                    Prior-Period Outstanding Items ({priorPeriodIrFeed.length} Non-Blocking)
                  </h4>
                  <span className="text-[10px] font-medium text-stone-500">Informational Only</span>
                </div>
                <p className="text-[11px] text-stone-500">
                  Unresolved items from prior quarters stay visible for audit tracking without blocking {evaluation.targetPeriodKey} unless a carry-forward reason is documented in Cost Anomaly Detector.
                </p>
                <div className="space-y-1.5 text-xs max-h-36 overflow-y-auto">
                  {priorPeriodIrFeed.map((ir) => (
                    <button
                      key={ir.id}
                      type="button"
                      onClick={() => onNavigate('anomalies', ir.id)}
                      className="w-full text-left rounded-lg border border-stone-200 bg-[#FAF9F7] p-2 hover:bg-stone-100 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-mono font-semibold text-stone-700">
                          {ir.id} · {ir.accountingPeriod} · {ir.status}
                        </div>
                        <div className="truncate text-stone-500">{ir.title}</div>
                      </div>
                      <span className="font-mono font-semibold text-stone-700 shrink-0">
                        {formatCAD(ir.amount)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs space-y-2.5 text-xs">
            <h3 className="text-sm font-semibold text-[#222222]">
              Close Verification Log (Simulated Local Identity)
            </h3>
            <p className="text-[11px] text-stone-500">
              Simulated Demo Approval (Local Browser Identity — Not Identity-Verified). Production requires SSO + RBAC segregation of duties.
            </p>
            {closeApprovalLog.length === 0 ? (
              <div className="text-stone-500">
                No manual close sign-offs recorded yet in this session.
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {closeApprovalLog.map((log) => (
                  <div key={log.id} className="border-b border-stone-100 pb-1.5">
                    <div className="font-medium text-[#222222]">
                      {log.action} · {log.actor}
                    </div>
                    <div className="text-[11px] text-stone-500 font-mono">
                      {log.timestamp}
                    </div>
                    <div className="text-stone-600">{log.note}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* New Future Period Walk Modal */}
      {showNewWalkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-xl bg-white border border-stone-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-base font-semibold text-[#222222]">
                  Create Future / Provisional Operating Earnings Walk
                </h3>
                <p className="text-xs text-stone-500">
                  Locked Q3 2025 and Q2/Q3 2026 walks are preserved. Discrepancies are flagged as Unreconciled.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewWalkModal(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomWalk} className="space-y-3 text-xs">
              <label className="block space-y-1">
                <span className="font-medium text-stone-700">Walk Title *</span>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">From Period</span>
                  <input
                    type="text"
                    value={newFrom}
                    onChange={(e) => setNewFrom(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">To Period</span>
                  <input
                    type="text"
                    value={newTo}
                    onChange={(e) => setNewTo(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">
                    Start Operating Earnings (CAD Thousands)
                  </span>
                  <input
                    type="number"
                    value={newStartK}
                    onChange={(e) => setNewStartK(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">
                    Reported End Earnings (CAD Thousands)
                  </span>
                  <input
                    type="number"
                    value={newEndK}
                    onChange={(e) => setNewEndK(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="font-medium text-stone-700">
                  Signed Walk Lines (Label, Signed CAD Thousands, Category)
                </span>
                <textarea
                  rows={4}
                  value={newLinesText}
                  onChange={(e) => setNewLinesText(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 p-2.5 font-mono text-[11px]"
                />
              </label>

              {walkFormError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-red-700 font-medium">
                  {walkFormError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowNewWalkModal(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2 font-medium text-[#333333]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#F04F25] px-4 py-2 font-semibold text-white hover:bg-[#D9421B]"
                >
                  Create & Reconcile Walk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Future-Quarter CSV Importer Modal (Income Statements & Walk Drivers) */}
      {showQuarterCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-xl bg-white border border-stone-200 shadow-xl p-6 space-y-4 my-8 text-xs">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-base font-semibold text-[#222222]">
                  Future-Quarter Close CSV Ingestion
                </h3>
                <p className="text-stone-500">
                  Import either (A) Quarterly Income Statements CSV (auto-calculates EBIT, QoQ &amp; YoY deltas, flags &ge;$1M changes, preserves Unexplained/Pending Driver Decomposition) or (B) Earnings-Walk Drivers CSV.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuarterCsvModal(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="inline-flex items-center gap-1 rounded-lg bg-[#F6F5F3] p-1">
              <button
                type="button"
                onClick={() => {
                  setQuarterCsvKind('income_stmt');
                  setQuarterCsvText(SAMPLE_INCOME_STMT_CSV);
                }}
                className={`px-3 py-1.5 rounded-md font-medium ${
                  quarterCsvKind === 'income_stmt'
                    ? 'bg-white text-[#222222] shadow-2xs font-semibold'
                    : 'text-stone-600'
                }`}
              >
                Quarterly Income Statements CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuarterCsvKind('walk_drivers');
                  setQuarterCsvText(SAMPLE_WALK_DRIVERS_CSV);
                }}
                className={`px-3 py-1.5 rounded-md font-medium ${
                  quarterCsvKind === 'walk_drivers'
                    ? 'bg-white text-[#222222] shadow-2xs font-semibold'
                    : 'text-stone-600'
                }`}
              >
                Earnings-Walk Drivers CSV
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 font-medium text-[#333333] hover:bg-[#F6F5F3] cursor-pointer">
                <span>Upload .csv File</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) file.text().then(setQuarterCsvText);
                  }}
                />
              </label>
              <span className="text-stone-500">
                Locked Section 1.1–1.3 historical Q3 2026 baseline remains untouched.
              </span>
            </div>

            <textarea
              rows={5}
              value={quarterCsvText}
              onChange={(e) => setQuarterCsvText(e.target.value)}
              className="w-full rounded-lg border border-stone-200 p-3 font-mono text-[11px] text-[#222222]"
            />

            {quarterCsvKind === 'income_stmt' ? (
              <div className="space-y-2">
                <div className="font-semibold text-[#222222]">
                  Preview ({incomeCsvPreview.filter((r) => r.valid).length} valid / {incomeCsvPreview.length} rows)
                </div>
                <div className="max-h-44 overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100">
                  {incomeCsvPreview.map((r) => (
                    <div
                      key={r.rowNum}
                      className={`p-2.5 flex justify-between gap-3 ${
                        r.valid ? 'bg-white' : 'bg-red-50'
                      }`}
                    >
                      <div>
                        <span className="font-mono font-semibold text-[#222222]">
                          Row {r.rowNum}: {r.record?.quarter ?? 'Invalid'}
                        </span>
                        {r.valid && r.record ? (
                          <div className="text-stone-600 mt-0.5">
                            Op. Earnings: {formatCAD(r.record.calculatedOperatingEarningsCAD)} · QoQ:{' '}
                            {r.record.qoqChangeCAD !== null ? formatSignedCAD(r.record.qoqChangeCAD) : 'N/A'} · Status: Unexplained / Pending Driver Decomposition
                          </div>
                        ) : (
                          <div className="text-red-700 mt-0.5">{r.errors.join(' · ')}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="font-semibold text-[#222222]">
                  Parsed Walks ({walkCsvPreview.walks.length} walk(s) · {walkCsvPreview.validRowCount} valid / {walkCsvPreview.totalRowCount} rows)
                </div>
                {walkCsvPreview.errors.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-red-700 space-y-1 max-h-28 overflow-y-auto">
                    <div className="font-semibold">Validation Errors (invalid rows will NOT be silently imported):</div>
                    {walkCsvPreview.errors.map((err, idx) => (
                      <div key={idx}>{err}</div>
                    ))}
                  </div>
                )}
                {walkCsvPreview.walks.map((w) => {
                  const ev = evaluateWalkReconciliation(w, anomalies, anomalies);
                  return (
                    <div key={w.id} className="rounded-lg border border-stone-200 p-2.5">
                      <div className="font-semibold text-[#222222]">
                        {w.title} ({w.fromPeriod} &rarr; {w.toPeriod})
                      </div>
                      <div className="text-stone-600 font-mono">
                        {w.lines.length} lines · Start {formatCAD(ev.startThousands * 1000)} + Sum {formatSignedCAD(ev.sumChangesThousands * 1000)} vs End {formatCAD(ev.reportedEndThousands * 1000)} ({ev.isReconciled ? 'Exact' : `Unreconciled ${formatSignedCAD(ev.discrepancyThousands * 1000)}`})
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowQuarterCsvModal(false)}
                className="rounded-lg border border-stone-200 px-4 py-2 font-medium text-[#333333]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  quarterCsvKind === 'income_stmt'
                    ? incomeCsvPreview.filter((r) => r.valid && r.record).length === 0
                    : walkCsvPreview.walks.length === 0
                }
                onClick={() => {
                  if (quarterCsvKind === 'income_stmt') {
                    const recs = incomeCsvPreview
                      .filter((r) => r.valid && r.record)
                      .map((r) => r.record!);
                    onImportQuarters(recs);
                  } else {
                    for (const w of walkCsvPreview.walks) {
                      onAddCustomWalk(w);
                    }
                    if (walkCsvPreview.walks[0]) {
                      setSelectedWalkId(walkCsvPreview.walks[0].id);
                    }
                  }
                  setShowQuarterCsvModal(false);
                }}
                className="rounded-lg bg-[#F04F25] px-4 py-2 font-semibold text-white hover:bg-[#D9421B] disabled:opacity-50"
              >
                Commit Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
