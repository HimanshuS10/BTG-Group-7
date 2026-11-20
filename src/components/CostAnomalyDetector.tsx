import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Edit3,
  FileWarning,
  Link2,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  APPENDIX_SECTIONS,
  CASE_CONSTANTS,
  extractQuarterKey,
  formatCAD,
  getActiveScreeningFlags,
} from '../data/skyjackCaseData';
import { parseCsvNumber, parseCsvWithHeaders } from '../utils/csvParser';
import type {
  ApprovalState,
  CostFrequencyType,
  CustomsEntry,
  DismissedRuleRecord,
  InvestigationStatus,
  IrregularCostItem,
  NavSection,
} from '../types/skyguard';

interface CostAnomalyDetectorProps {
  anomalies: IrregularCostItem[];
  customsEntries: CustomsEntry[];
  initialSelectedId?: string | null;
  onAddEntry: (entry: IrregularCostItem) => void;
  onBulkImportEntries: (entries: IrregularCostItem[]) => void;
  onEditEntry: (id: string, patch: Partial<IrregularCostItem>, auditNote: string) => void;
  onDeleteEntry: (id: string) => void;
  onUpdateStatus: (id: string, status: InvestigationStatus, note?: string) => void;
  onToggleChecklist: (id: string, checkId: string) => void;
  onRecordApprovalAndAudit: (
    id: string,
    approvalState: ApprovalState,
    approvalRef: string | null,
    actor: string,
    note: string
  ) => void;
  onSetHumanDecision: (
    id: string,
    decision: 'Pending' | 'Accepted' | 'Rejected',
    actor: string
  ) => void;
  onDismissRule: (anomalyId: string, record: DismissedRuleRecord) => void;
  onRestoreDismissedRule: (anomalyId: string, ruleId: string) => void;
  onNavigate: (section: NavSection) => void;
}

type RuleFilterMode =
  | 'all'
  | 'flagged'
  | 'over_250k'
  | 'missing_approval'
  | 'heuristics'
  | 'user_added';

interface CsvPreviewRow {
  rowNum: number;
  raw: string[];
  valid: boolean;
  errors: string[];
  parsed?: IrregularCostItem;
}

const SAMPLE_COST_CSV = [
  'id,title,date,amount,department,plantAndRegion,regionGroup,glAccount,vendorOrCounterparty,invoiceNumber,preparer,approvalState,approvalRef,costType,walkCategory,cause,owner',
  'IR-08,Unscheduled tooling calibration,2026-09-25,300000,Operations,Plant 2 · North America,North America,GL 6420 (Plant Tooling),Apex Tooling Ltd,INV-APX-402,Plant 2 Cost Clerk,Confirmed Missing,,One-time,Fixed plant,Emergency fixture re-machining on scissor lift weld line,Dana (Plant Finance Lead)',
  'IR-09,Duplicate steel plate invoice,2026-09-18,95000,Procurement,Europe,Europe,Variable Costs (Steel AP),Steel supplier V-4471,INV-V4471-882-B,AP Clerk,Not Provided in Case,,One-time,Variable costs,Secondary invoice suffix entered manually,Accounts Payable Lead',
].join('\n');

export const CostAnomalyDetector: React.FC<CostAnomalyDetectorProps> = ({
  anomalies,
  customsEntries,
  initialSelectedId,
  onAddEntry,
  onBulkImportEntries,
  onEditEntry,
  onDeleteEntry,
  onUpdateStatus,
  onToggleChecklist,
  onRecordApprovalAndAudit,
  onSetHumanDecision,
  onDismissRule,
  onRestoreDismissedRule,
  onNavigate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [ruleFilter, setRuleFilter] = useState<RuleFilterMode>('all');
  const [statusFilter, setStatusFilter] = useState<'All' | InvestigationStatus>('All');
  const [selectedId, setSelectedId] = useState<string>(
    initialSelectedId || anomalies[0]?.id || 'IR-01'
  );

  // Add / Edit Modal State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<IrregularCostItem | null>(null);
  const [formId, setFormId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('2026-09-25');
  const [formAmount, setFormAmount] = useState('');
  const [formDept, setFormDept] = useState('Operations');
  const [formPlantRegion, setFormPlantRegion] = useState('Plant 2 · North America');
  const [formRegionGroup, setFormRegionGroup] = useState<
    IrregularCostItem['regionGroup']
  >('North America');
  const [formGlAccount, setFormGlAccount] = useState('GL 6410 (Plant Operations)');
  const [formVendor, setFormVendor] = useState('');
  const [formInvoice, setFormInvoice] = useState('');
  const [formPreparer, setFormPreparer] = useState('');
  const [formApprovalState, setFormApprovalState] =
    useState<ApprovalState>('Confirmed Missing');
  const [formApprovalRef, setFormApprovalRef] = useState('');
  const [formCostType, setFormCostType] = useState<CostFrequencyType>('One-time');
  const [formWalkCategory, setFormWalkCategory] = useState('Fixed plant');
  const [formCause, setFormCause] = useState('');
  const [formEvidence, setFormEvidence] = useState('');
  const [formPeriod, setFormPeriod] = useState('Q3 2026 (Provisional Scenario)');
  const [formOwner, setFormOwner] = useState('Dana (Plant Finance Lead)');
  const [formNotes, setFormNotes] = useState('');
  const [formCarryForwardReason, setFormCarryForwardReason] = useState('');
  const [formCarryForwardTarget, setFormCarryForwardTarget] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  // CSV Import Modal State
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState(SAMPLE_COST_CSV);

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Inline Owner & Preliminary Explanation assignment
  const [quickOwner, setQuickOwner] = useState('Dana (Plant Finance Lead)');
  const [quickExplanation, setQuickExplanation] = useState('');
  const [quickSavedMsg, setQuickSavedMsg] = useState<string | null>(null);

  // Inline Audit / Approval update
  const [auditActor, setAuditActor] = useState('Dana (Plant Finance Lead)');
  const [auditApprovalState, setAuditApprovalState] =
    useState<ApprovalState>('Present');
  const [auditApprovalRef, setAuditApprovalRef] = useState('');
  const [auditNote, setAuditNote] = useState('');
  const [auditError, setAuditError] = useState<string | null>(null);

  // Status gate error
  const [statusGateError, setStatusGateError] = useState<string | null>(null);

  // False-positive rule dismissal UI state
  const [dismissingRuleId, setDismissingRuleId] = useState<string | null>(null);
  const [dismissReviewer, setDismissReviewer] = useState('Dana (Plant Finance Lead)');
  const [dismissReason, setDismissReason] = useState('');
  const [dismissError, setDismissError] = useState<string | null>(null);
  const [showDismissedList, setShowDismissedList] = useState(false);

  // Optional Gemini 5Ws synthesis
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [geminiById, setGeminiById] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialSelectedId) {
      setSelectedId(initialSelectedId);
    }
  }, [initialSelectedId]);

  useEffect(() => {
    setAuditError(null);
    setStatusGateError(null);
    setGeminiError(null);
    setAuditApprovalRef('');
    setAuditNote('');
    setDismissingRuleId(null);
    setDismissReason('');
    setDismissError(null);
    setQuickSavedMsg(null);
    const current = anomalies.find((a) => a.id === selectedId);
    if (current) {
      setQuickOwner(current.owner);
      setQuickExplanation(current.notes || '');
    }
  }, [selectedId, anomalies]);

  const screenedMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getActiveScreeningFlags>>();
    for (const item of anomalies) {
      map.set(item.id, getActiveScreeningFlags(item, anomalies, customsEntries));
    }
    return map;
  }, [anomalies, customsEntries]);

  const filteredAnomalies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return anomalies.filter((item) => {
      const flags = screenedMap.get(item.id) ?? [];
      if (ruleFilter === 'flagged' && flags.length === 0) return false;
      if (
        ruleFilter === 'over_250k' &&
        item.amount < CASE_CONSTANTS.TRANSACTION_ALERT_THRESHOLD_CAD
      ) {
        return false;
      }
      if (
        ruleFilter === 'missing_approval' &&
        item.approvalState !== 'Confirmed Missing' &&
        !(item.approvalState === 'Not Provided in Case' && !item.approvalRef)
      ) {
        return false;
      }
      if (
        ruleFilter === 'heuristics' &&
        !flags.some((f) => f.ruleId !== 'R-250K' && f.ruleId !== 'R-NO-APPROVAL')
      ) {
        return false;
      }
      if (
        ruleFilter === 'user_added' &&
        item.provenance !== 'User-added scenario'
      ) {
        return false;
      }
      if (statusFilter !== 'All' && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.id.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.department.toLowerCase().includes(q) ||
        item.plantAndRegion.toLowerCase().includes(q) ||
        item.owner.toLowerCase().includes(q) ||
        item.cause.toLowerCase().includes(q)
      );
    });
  }, [anomalies, screenedMap, ruleFilter, statusFilter, searchQuery]);

  const selectedItem = useMemo(
    () =>
      anomalies.find((a) => a.id === selectedId) ??
      filteredAnomalies[0] ??
      null,
    [anomalies, selectedId, filteredAnomalies]
  );

  const selectedFlags = selectedItem ? screenedMap.get(selectedItem.id) ?? [] : [];

  const totals = useMemo(() => {
    const baseline = anomalies.filter(
      (a) => a.provenance === 'Official case baseline'
    );
    const workingTotal = anomalies.reduce((s, a) => s + a.amount, 0);
    const baselineTotal = baseline.reduce((s, a) => s + a.amount, 0);
    return {
      baselineTotal,
      workingTotal,
      userDelta: workingTotal - baselineTotal,
    };
  }, [anomalies]);

  const openAddModal = () => {
    const nextNum = anomalies.length + 1;
    setEditingEntry(null);
    setFormId(`IR-${String(nextNum).padStart(2, '0')}`);
    setFormTitle('');
    setFormDate('2026-09-25');
    setFormAmount('');
    setFormDept('Operations');
    setFormPlantRegion('Plant 2 · North America');
    setFormRegionGroup('North America');
    setFormGlAccount('GL 6410 (Plant Operations)');
    setFormVendor('');
    setFormInvoice('');
    setFormPreparer('Plant Finance Analyst');
    setFormApprovalState('Confirmed Missing');
    setFormApprovalRef('');
    setFormCostType('One-time');
    setFormWalkCategory('Fixed plant');
    setFormCause('');
    setFormEvidence('');
    setFormPeriod('Q3 2026 (User Scenario)');
    setFormOwner('Dana (Plant Finance Lead)');
    setFormNotes('');
    setFormCarryForwardReason('');
    setFormCarryForwardTarget('');
    setModalError(null);
    setShowFormModal(true);
  };

  const openEditModal = (item: IrregularCostItem) => {
    setEditingEntry(item);
    setFormId(item.id);
    setFormTitle(item.title);
    setFormDate(item.date);
    setFormAmount(String(item.amount));
    setFormDept(item.department);
    setFormPlantRegion(item.plantAndRegion);
    setFormRegionGroup(item.regionGroup);
    setFormGlAccount(item.glAccount);
    setFormVendor(item.vendorOrCounterparty);
    setFormInvoice(item.invoiceNumber ?? '');
    setFormPreparer(item.preparer);
    setFormApprovalState(item.approvalState);
    setFormApprovalRef(item.approvalRef ?? '');
    setFormCostType(item.costType);
    setFormWalkCategory(item.walkCategory);
    setFormCause(item.cause);
    setFormEvidence(item.supportingEvidence);
    setFormPeriod(item.accountingPeriod);
    setFormOwner(item.owner);
    setFormNotes(item.notes);
    setFormCarryForwardReason(item.carryForwardBlockReason ?? '');
    setFormCarryForwardTarget(item.carryForwardTargetPeriod ?? '');
    setModalError(null);
    setShowFormModal(true);
  };

  const handleSaveEntryForm = (e: React.FormEvent) => {
    e.preventDefault();
    const idTrim = formId.trim().toUpperCase();
    const titleTrim = formTitle.trim();
    const amountNum = Number(formAmount);

    if (!idTrim) {
      setModalError('Unique Entry ID is required.');
      return;
    }
    if (!editingEntry && anomalies.some((a) => a.id.toUpperCase() === idTrim)) {
      setModalError(`Entry ID "${idTrim}" already exists. Choose a unique ID.`);
      return;
    }
    if (!titleTrim) {
      setModalError('Title / description is required.');
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      setModalError('Amount CAD must be a valid non-negative number.');
      return;
    }
    if (formApprovalState === 'Present' && !formApprovalRef.trim()) {
      setModalError('Provide an Approval Reference when Approval State is "Present".');
      return;
    }

    const nowStamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    const cleanRef =
      formApprovalState === 'Present' ? formApprovalRef.trim() : null;

    if (editingEntry) {
      const isBaseline = editingEntry.provenance === 'Official case baseline';
      if (isBaseline) {
        // Protect official baseline source figures; only allow editing investigation metadata
        onEditEntry(
          editingEntry.id,
          {
            owner: formOwner.trim() || editingEntry.owner,
            approvalState: formApprovalState,
            approvalRef: cleanRef,
            notes: formNotes.trim(),
            supportingEvidence: formEvidence.trim() || editingEntry.supportingEvidence,
            carryForwardBlockReason: formCarryForwardReason.trim() || undefined,
            carryForwardTargetPeriod: formCarryForwardTarget.trim() || undefined,
          },
          'Updated investigation metadata (official baseline amount/facts preserved).'
        );
      } else {
        onEditEntry(
          editingEntry.id,
          {
            title: titleTrim,
            date: formDate,
            amount: amountNum,
            department: formDept.trim(),
            plantAndRegion: formPlantRegion.trim(),
            regionGroup: formRegionGroup,
            glAccount: formGlAccount.trim(),
            vendorOrCounterparty: formVendor.trim() || 'Not specified',
            invoiceNumber: formInvoice.trim() || undefined,
            preparer: formPreparer.trim() || 'Not specified',
            approvalState: formApprovalState,
            approvalRef: cleanRef,
            costType: formCostType,
            walkCategory: formWalkCategory,
            cause: formCause.trim() || 'User-entered scenario item.',
            supportingEvidence: formEvidence.trim() || 'Pending supporting upload.',
            accountingPeriod: formPeriod.trim() || 'Working Scenario',
            owner: formOwner.trim() || 'Dana (Plant Finance Lead)',
            notes: formNotes.trim(),
            carryForwardBlockReason: formCarryForwardReason.trim() || undefined,
            carryForwardTargetPeriod: formCarryForwardTarget.trim() || undefined,
            operatingEarningsEffect: `User-added working scenario item of ${formatCAD(amountNum)} in ${formWalkCategory} (does not mutate locked official Q3 earnings).`,
            fiveWs: {
              who: `${formPreparer.trim() || 'User entry'}; Approval: ${
                cleanRef
                  ? `${cleanRef}`
                  : formApprovalState === 'Confirmed Missing'
                  ? 'Confirmed missing'
                  : 'Not provided'
              }.`,
              what: `${formatCAD(amountNum)} — ${titleTrim}`,
              when: `${formDate} (${formPeriod})`,
              where: `${formDepartmentLabel(formDept, formPlantRegion)}`,
              why: formCause.trim() || 'User-entered provisional scenario.',
              how: `Entered into ${formGlAccount} (${formCostType}).`,
            },
          },
          'Edited user-added scenario entry; automatic screening re-evaluated.'
        );
      }
      setShowFormModal(false);
      return;
    }

    const newItem: IrregularCostItem = {
      id: idTrim,
      provenance: 'User-added scenario',
      date: formDate,
      accountingPeriod: formPeriod.trim() || 'Working Scenario',
      department: formDept.trim() || 'Operations',
      plantAndRegion: formPlantRegion.trim() || 'North America',
      regionGroup: formRegionGroup,
      title: titleTrim,
      amount: amountNum,
      costType: formCostType,
      walkCategory: formWalkCategory,
      glAccount: formGlAccount.trim() || 'GL Unassigned',
      vendorOrCounterparty: formVendor.trim() || 'Not specified',
      invoiceNumber: formInvoice.trim() || undefined,
      preparer: formPreparer.trim() || 'Manual Demo Entry',
      approvalState: formApprovalState,
      approvalRef: cleanRef,
      cause: formCause.trim() || 'User-entered working scenario anomaly.',
      supportingEvidence: formEvidence.trim() || 'Pending supporting verification.',
      verificationGaps:
        formApprovalState === 'Confirmed Missing'
          ? 'Approval confirmed missing; requires controller review.'
          : 'User-added provisional record; verify supporting invoice/journal.',
      operatingEarningsEffect: `Provisional working-scenario expense of ${formatCAD(amountNum)} (official reported Q3 earnings CAD $20.7M remain unchanged).`,
      linkedWalkLineId: null,
      recommendedSteps: [
        'Review triggered screening rules and attach supporting invoice or journal voucher.',
        'Obtain controller sign-off before incorporating into future close walk.',
      ],
      owner: formOwner.trim() || 'Dana (Plant Finance Lead)',
      status: 'New',
      humanCorrectionDecision: 'Pending',
      notes: formNotes.trim(),
      carryForwardBlockReason: formCarryForwardReason.trim() || undefined,
      carryForwardTargetPeriod: formCarryForwardTarget.trim() || undefined,
      evidenceChecklist: [
        { id: `chk-${idTrim}-1`, label: 'Source voucher / invoice attached', verified: Boolean(formEvidence.trim()) },
        { id: `chk-${idTrim}-2`, label: 'Approval authorization verified', verified: formApprovalState === 'Present' },
      ],
      fiveWs: {
        who: `${formPreparer.trim() || 'User entry'}; Approval: ${
          cleanRef
            ? cleanRef
            : formApprovalState === 'Confirmed Missing'
            ? 'Confirmed missing'
            : 'Not provided'
        }.`,
        what: `${formatCAD(amountNum)} — ${titleTrim}`,
        when: `${formDate} (${formPeriod})`,
        where: `${formDept} · ${formPlantRegion}`,
        why: formCause.trim() || 'User-entered provisional scenario.',
        how: `Submitted via SKYGUARD Cost Intelligence into ${formGlAccount}.`,
      },
      auditTrail: [
        {
          id: `AUD-${Date.now()}`,
          timestamp: nowStamp,
          actor: 'Demo Browser State',
          action: 'User Scenario Created & Screened',
          note: `Added ${idTrim} (${formatCAD(amountNum)}) with automatic screening applied.`,
          isDemoState: true,
        },
      ],
    };

    onAddEntry(newItem);
    setSelectedId(newItem.id);
    setShowFormModal(false);
  };

  // RFC-4180 CSV Parser & Row/Column-Level Validator (BOM, CRLF/LF/CR, quoted commas, escaped "", malformed quotes, negative/duplicate checks)
  const csvPreviewRows: CsvPreviewRow[] = useMemo(() => {
    const { headers, rows, headerQuoteErrors } = parseCsvWithHeaders(csvText);
    if (headers.length === 0 || rows.length === 0) return [];

    const existingIds = new Set(anomalies.map((a) => a.id.toUpperCase()));
    const existingFingerprints = new Set(
      anomalies.map((a) => `${a.title.trim().toLowerCase()}|${a.date}|${a.amount}`)
    );
    const seenInCsv = new Set<string>();
    const seenFingerprintsInCsv = new Set<string>();
    const results: CsvPreviewRow[] = [];

    for (const row of rows) {
      const cols = row.fields;
      const errors: string[] = [
        ...(headerQuoteErrors ?? []),
        ...(row.quoteErrors ?? []),
      ];
      const [
        id = '',
        title = '',
        date = '',
        amountStr = '',
        department = '',
        plantAndRegion = '',
        regionGroup = 'North America',
        glAccount = '',
        vendor = '',
        invoiceNumber = '',
        preparer = '',
        approvalStateRaw = 'Not Provided in Case',
        approvalRef = '',
        costTypeRaw = 'One-time',
        walkCategory = 'SG&A',
        cause = '',
        owner = 'Dana (Plant Finance Lead)',
      ] = cols;

      const cleanId = id.trim().toUpperCase();
      if (!cleanId) {
        errors.push(`Row ${row.rowNum}, Column "id": Missing ID.`);
      } else {
        if (existingIds.has(cleanId)) {
          errors.push(`Row ${row.rowNum}, Column "id": Duplicate ID "${cleanId}" already exists.`);
        }
        if (seenInCsv.has(cleanId)) {
          errors.push(`Row ${row.rowNum}, Column "id": Duplicate ID "${cleanId}" within CSV.`);
        }
        seenInCsv.add(cleanId);
      }

      if (!title.trim()) {
        errors.push(`Row ${row.rowNum}, Column "title": Missing description/title.`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
        errors.push(`Row ${row.rowNum}, Column "date": Invalid date "${date}" (expected YYYY-MM-DD).`);
      }

      const amtRes = parseCsvNumber(amountStr);
      if (!amtRes.valid) {
        errors.push(`Row ${row.rowNum}, Column "amount": ${amtRes.error}.`);
      } else if (amtRes.value < 0) {
        errors.push(`Row ${row.rowNum}, Column "amount": Negative expense (${amtRes.value}) is invalid for irregular cost entries.`);
      }

      const amount = amtRes.valid ? amtRes.value : NaN;
      if (title.trim() && /^\d{4}-\d{2}-\d{2}$/.test(date.trim()) && Number.isFinite(amount)) {
        const fp = `${title.trim().toLowerCase()}|${date.trim()}|${amount}`;
        if (existingFingerprints.has(fp)) {
          errors.push(`Row ${row.rowNum}, Column "title/date/amount": Possible duplicate transaction (matches existing ${title.trim()} on ${date.trim()} for ${formatCAD(amount)}).`);
        } else if (seenFingerprintsInCsv.has(fp)) {
          errors.push(`Row ${row.rowNum}, Column "title/date/amount": Duplicate transaction repeated in CSV.`);
        }
        seenFingerprintsInCsv.add(fp);
      }

      const approvalState: ApprovalState =
        approvalStateRaw === 'Present' ||
        approvalStateRaw === 'Confirmed Missing' ||
        approvalStateRaw === 'Not Provided in Case'
          ? approvalStateRaw
          : 'Not Provided in Case';

      const validRegion: IrregularCostItem['regionGroup'] =
        regionGroup === 'North America' ||
        regionGroup === 'Europe' ||
        regionGroup === 'Corporate' ||
        regionGroup === 'Asia'
          ? regionGroup
          : 'Other';

      const costType: CostFrequencyType = costTypeRaw === 'Trend' ? 'Trend' : 'One-time';

      let parsed: IrregularCostItem | undefined;
      if (errors.length === 0) {
        const cleanRef = approvalState === 'Present' && approvalRef ? approvalRef : null;
        const derivedPeriod = extractQuarterKey(date.trim()) ?? 'Q3 2026';
        parsed = {
          id: cleanId,
          provenance: 'User-added scenario',
          date: date.trim(),
          accountingPeriod: `${derivedPeriod} (CSV Ingestion)`,
          department: department || 'Operations',
          plantAndRegion: plantAndRegion || validRegion,
          regionGroup: validRegion,
          title: title.trim(),
          amount,
          costType,
          walkCategory: walkCategory || 'SG&A',
          glAccount: glAccount || 'GL Unassigned',
          vendorOrCounterparty: vendor || 'Not specified',
          invoiceNumber: invoiceNumber || undefined,
          preparer: preparer || 'CSV Import',
          approvalState,
          approvalRef: cleanRef,
          cause: cause || 'Ingested via demo CSV import.',
          supportingEvidence: 'CSV import batch record; attach primary voucher.',
          verificationGaps:
            approvalState === 'Confirmed Missing'
              ? 'Approval confirmed missing in CSV record.'
              : 'Requires human verification of supporting documentation.',
          operatingEarningsEffect: `Provisional CSV-ingested cost of ${formatCAD(amount)} (official reported earnings unchanged).`,
          linkedWalkLineId: null,
          recommendedSteps: [
            'Verify source invoice/journal support and controller approval.',
          ],
          owner: owner || 'Dana (Plant Finance Lead)',
          status: 'New',
          humanCorrectionDecision: 'Pending',
          notes: 'Imported via SKYGUARD demo CSV ingestion.',
          evidenceChecklist: [
            { id: `chk-${cleanId}-1`, label: 'CSV source voucher verified', verified: false },
            { id: `chk-${cleanId}-2`, label: 'Approval authorization confirmed', verified: approvalState === 'Present' },
          ],
          fiveWs: {
            who: `${preparer || 'CSV Import'}; Approval: ${cleanRef ?? approvalState}`,
            what: `${formatCAD(amount)} — ${title.trim()}`,
            when: date.trim(),
            where: `${department} · ${plantAndRegion}`,
            why: cause || 'Ingested via CSV.',
            how: `Batch CSV ingestion into ${glAccount || 'GL'}.`,
          },
          auditTrail: [
            {
              id: `AUD-${Date.now()}-${row.rowNum}`,
              timestamp: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
              actor: 'Demo CSV Ingestion',
              action: 'Imported & Screened',
              note: `Row ${row.rowNum} validated and screened immediately upon commit.`,
              isDemoState: true,
            },
          ],
        };
      }

      results.push({
        rowNum: row.rowNum,
        raw: cols,
        valid: errors.length === 0,
        errors,
        parsed,
      });
    }
    return results;
  }, [csvText, anomalies]);

  const validCsvEntries = csvPreviewRows
    .filter((r) => r.valid && r.parsed)
    .map((r) => r.parsed!);

  const handleCommitCsv = () => {
    if (validCsvEntries.length === 0) return;
    onBulkImportEntries(validCsvEntries);
    setSelectedId(validCsvEntries[0].id);
    setShowCsvModal(false);
  };

  const handleDownloadCsvTemplate = () => {
    const blob = new Blob([SAMPLE_COST_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skyguard_cost_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStatusChange = (nextStatus: InvestigationStatus) => {
    if (!selectedItem) return;
    if (nextStatus === 'Ready for Controller Review' || nextStatus === 'Resolved') {
      const incompleteChecks = selectedItem.evidenceChecklist.filter((c) => !c.verified);
      if (incompleteChecks.length > 0) {
        setStatusGateError(
          `Cannot advance to "${nextStatus}" until all evidence checklist items are verified (${incompleteChecks.length} remaining).`
        );
        return;
      }
      if (selectedItem.approvalState === 'Confirmed Missing' && !selectedItem.approvalRef) {
        setStatusGateError(
          `Cannot advance to "${nextStatus}" while approval is Confirmed Missing. Record retroactive authorization below first.`
        );
        return;
      }
    }
    setStatusGateError(null);
    onUpdateStatus(selectedItem.id, nextStatus);
  };

  const handleAuditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (!auditActor.trim()) {
      setAuditError('Reviewer name is required.');
      return;
    }
    if (auditApprovalState === 'Present' && !auditApprovalRef.trim()) {
      setAuditError('Enter an approval reference when setting state to Present.');
      return;
    }
    setAuditError(null);
    onRecordApprovalAndAudit(
      selectedItem.id,
      auditApprovalState,
      auditApprovalState === 'Present' ? auditApprovalRef.trim() : null,
      auditActor.trim(),
      auditNote.trim() || `Updated approval state to ${auditApprovalState}.`
    );
    setAuditApprovalRef('');
    setAuditNote('');
  };

  const handleGeminiExplain = async () => {
    if (!selectedItem) return;
    setGeminiLoading(true);
    setGeminiError(null);
    try {
      const res = await fetch('/api/anomaly-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anomaly: selectedItem }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGeminiError(data.error || 'Gemini explanation failed.');
        return;
      }
      setGeminiById((prev) => ({ ...prev, [selectedItem.id]: data.explanation }));
    } catch {
      setGeminiError('Network error reaching /api/anomaly-explain.');
    } finally {
      setGeminiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Screening Rules & Action Header */}
      <section className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1 max-w-3xl">
            <h2 className="text-sm font-semibold text-[#222222]">
              Cost Screening Rules vs. Earnings Walk Materiality ({APPENDIX_SECTIONS.IRREGULAR_SUMMARY}, {APPENDIX_SECTIONS.IRREGULAR_DETAILS} &amp; {APPENDIX_SECTIONS.COMPANY_RULES})
            </h2>
            <p className="text-xs text-stone-600 leading-relaxed">
              Entry screening flags any single cost <span className="font-mono font-semibold text-[#222222]">&ge; CAD $250,000</span>,{' '}
              <span className="font-semibold text-[#222222]">confirmed missing approval</span>, duplicate suffix variations (<span className="font-mono">-A</span>), Period 9 close timing, GL/category mismatches, missing accrual reversals, uncleared suspense (<span className="font-mono">2890</span>), or unmatched broker shipments. This is separate from the <span className="font-mono font-semibold text-[#222222]">CAD $1,000,000</span> walk materiality threshold ({APPENDIX_SECTIONS.COMPANY_RULES}).{' '}
              <span className="font-semibold text-[#222222]">Flagged for Review — Not Proof of Fraud.</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowCsvModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-xs font-medium text-[#333333] hover:bg-[#F6F5F3]"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Import CSV</span>
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#F04F25] px-4 py-2 text-xs font-semibold text-white hover:bg-[#D9421B]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Cost Entry</span>
            </button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-stone-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <div className="text-stone-500">Official Baseline (7 IR)</div>
            <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-[#222222]">
              {formatCAD(totals.baselineTotal)}
            </div>
          </div>
          <div>
            <div className="text-stone-500">Working Scenario Total ({anomalies.length})</div>
            <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-[#F04F25]">
              {formatCAD(totals.workingTotal)}
            </div>
          </div>
          <div>
            <div className="text-stone-500">User Scenario Delta</div>
            <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-[#222222]">
              +{formatCAD(totals.userDelta)}
            </div>
          </div>
          <div>
            <div className="text-stone-500">Max Official Single Entry</div>
            <div className="mt-0.5 text-sm font-semibold font-mono tabular-nums text-stone-700">
              CAD $900,000 (&lt; $1M Walk)
            </div>
          </div>
        </div>
      </section>

      {/* Search & Rule Filters */}
      <section className="rounded-xl bg-white border border-stone-200 p-4 shadow-2xs">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, title, department, owner, or cause..."
              aria-label="Search irregular cost records"
              className="w-full rounded-lg border border-stone-200 bg-[#FAFAFA] pl-9 pr-3 py-2 text-sm text-[#222222] placeholder:text-stone-400 focus:bg-white focus:border-[#F04F25] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="Screening rule filter"
              className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-[#F6F5F3] p-1"
            >
              {(
                [
                  { id: 'all', label: `All (${anomalies.length})` },
                  { id: 'over_250k', label: '>= $250K' },
                  { id: 'missing_approval', label: 'Approval Gap' },
                  { id: 'heuristics', label: 'Pattern Heuristics' },
                  { id: 'user_added', label: 'User Added' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRuleFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    ruleFilter === tab.id
                      ? 'bg-white text-[#222222] shadow-2xs'
                      : 'text-stone-600 hover:text-[#222222]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              aria-label="Filter by investigation status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'All' | InvestigationStatus)
              }
              className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-[#333333] focus:border-[#F04F25] focus:outline-none"
            >
              <option value="All">Status: All</option>
              <option value="New">Status: New</option>
              <option value="Investigating">Status: Investigating</option>
              <option value="Ready for Controller Review">
                Status: Ready for Controller Review
              </option>
              <option value="Resolved">Status: Resolved</option>
            </select>
          </div>
        </div>
      </section>

      {/* Master-Detail Workspace */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Table */}
        <div className="xl:col-span-7 rounded-xl bg-white border border-stone-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-200 flex items-center justify-between text-xs">
            <h3 className="text-sm font-semibold text-[#222222]">
              Cost Ledger & Automatic Screening Feed
            </h3>
            <span className="font-mono text-stone-500 tabular-nums">
              {filteredAnomalies.length} of {anomalies.length} shown
            </span>
          </div>

          {filteredAnomalies.length === 0 ? (
            <div className="p-12 text-center">
              <FileWarning className="h-8 w-8 text-stone-400 mx-auto mb-3" />
              <div className="text-sm font-semibold text-[#222222]">
                No entries match your active filters
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setRuleFilter('all');
                  setStatusFilter('All');
                }}
                className="mt-4 rounded-lg bg-[#F04F25] px-4 py-2 text-xs font-semibold text-white hover:bg-[#D9421B]"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-[#FAFAFA] text-xs font-medium text-stone-500">
                    <th className="py-3 px-4">ID & Provenance</th>
                    <th className="py-3 px-4">Description & Dept</th>
                    <th className="py-3 px-4">Triggered Rules</th>
                    <th className="py-3 px-4 text-right">Amount (CAD)</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs">
                  {filteredAnomalies.map((item) => {
                    const isSelected = selectedItem?.id === item.id;
                    const flags = screenedMap.get(item.id) ?? [];
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#FFF3ED]' : 'hover:bg-[#FAFAFA]'
                        }`}
                      >
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          <div className="font-mono font-semibold text-[#222222]">
                            {item.id}
                          </div>
                          <div className="mt-0.5 text-[11px] text-stone-500">
                            {item.provenance === 'Official case baseline'
                              ? 'Official Baseline'
                              : 'User Scenario'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 align-top max-w-[230px]">
                          <div className="font-medium text-[#222222]">
                            {item.title}
                          </div>
                          <div className="mt-0.5 text-stone-500">
                            {item.department} · {item.regionGroup} · {item.costType}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 align-top">
                          {flags.length > 0 ? (
                            <div className="space-y-0.5">
                              <div className="inline-flex items-center gap-1 font-medium text-red-700">
                                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                <span>{flags.length} Rule(s)</span>
                              </div>
                              <div className="text-[11px] text-stone-600">
                                {flags.map((f) => f.ruleName).slice(0, 2).join(' · ')}
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Clear</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 align-top text-right whitespace-nowrap font-mono tabular-nums font-semibold text-[#222222]">
                          {formatCAD(item.amount)}
                        </td>
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          <span
                            className={`font-medium ${
                              item.status === 'New'
                                ? 'text-red-700'
                                : item.status === 'Investigating'
                                ? 'text-amber-700'
                                : item.status === 'Ready for Controller Review'
                                ? 'text-[#F04F25]'
                                : 'text-emerald-700'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Detailed Investigation Drawer */}
        <div className="xl:col-span-5 rounded-xl bg-white border border-stone-200 shadow-2xs p-6 space-y-5">
          {!selectedItem ? (
            <div className="py-12 text-center text-xs text-stone-500">
              Select a cost entry to inspect evidence, screening rationale, Five Ws, and workflow.
            </div>
          ) : (
            <>
              {/* Header + Edit/Delete */}
              <div className="pb-4 border-b border-stone-200 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-[#F04F25]">
                      {selectedItem.id}
                    </span>
                    <span className="text-stone-300">·</span>
                    <span className="text-stone-600 font-medium">
                      {selectedItem.provenance}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(selectedItem)}
                      className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2.5 py-1 text-[11px] font-medium text-[#333333] hover:bg-[#F6F5F3]"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>
                        {selectedItem.provenance === 'Official case baseline'
                          ? 'Edit Metadata'
                          : 'Edit Entry'}
                      </span>
                    </button>
                    {selectedItem.provenance === 'User-added scenario' && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(selectedItem.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="text-base font-semibold text-[#222222]">
                  {selectedItem.title}
                </h3>

                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                  <span>{selectedItem.department}</span>
                  <span className="text-stone-300">·</span>
                  <span>{selectedItem.plantAndRegion}</span>
                  <span className="text-stone-300">·</span>
                  <span className="font-mono font-semibold text-[#222222]">
                    {formatCAD(selectedItem.amount)}
                  </span>
                </div>

                <div className="text-xs text-stone-600 space-y-0.5 pt-1">
                  <div>
                    Owner: <span className="font-medium text-[#222222]">{selectedItem.owner}</span> · GL:{' '}
                    <span className="font-mono text-[#222222]">{selectedItem.glAccount}</span>
                  </div>
                  <div>
                    Approval State:{' '}
                    <span
                      className={`font-medium ${
                        selectedItem.approvalState === 'Confirmed Missing'
                          ? 'text-red-700'
                          : selectedItem.approvalState === 'Not Provided in Case'
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {selectedItem.approvalState}
                      {selectedItem.approvalRef ? ` (${selectedItem.approvalRef})` : ''}
                    </span>
                  </div>
                  {selectedItem.linkedWalkLineId && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onNavigate('close')}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F04F25] hover:underline"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        <span>
                          Linked to Official YoY Earnings Walk ({selectedItem.walkCategory}: {formatCAD(-selectedItem.amount)}) — view in Close Intelligence
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Delete Confirmation Prompt */}
              {confirmDeleteId === selectedItem.id && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 space-y-2 text-xs">
                  <div className="font-semibold text-red-800">
                    Delete user-added scenario entry {selectedItem.id}?
                  </div>
                  <p className="text-red-700">
                    Working scenario totals will revert immediately. Official baseline records remain intact.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteEntry(selectedItem.id);
                        setConfirmDeleteId(null);
                        setSelectedId('IR-01');
                      }}
                      className="rounded-md bg-red-700 px-3 py-1.5 font-medium text-white hover:bg-red-800"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-md border border-stone-300 bg-white px-3 py-1.5 font-medium text-[#333333]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Triggered Screening Rules (Transparent Rationale + Dismiss False Positive) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-[#222222]">
                    Triggered Screening Rules ({selectedFlags.length})
                  </div>
                  <span className="text-[11px] font-medium text-stone-500">
                    Flagged for Review — Not Proof of Fraud
                  </span>
                </div>
                {selectedFlags.length === 0 ? (
                  <div className="text-xs text-emerald-700">
                    No active screening rules triggered for this entry.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedFlags.map((flag) => (
                      <div
                        key={flag.ruleId}
                        className="rounded-lg bg-[#FAFAFA] border border-stone-200 px-3 py-2 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[#222222]">
                            {flag.ruleId} · {flag.ruleName}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-medium ${
                                flag.severity === 'High'
                                  ? 'text-red-700'
                                  : flag.severity === 'Medium'
                                  ? 'text-amber-700'
                                  : 'text-stone-600'
                              }`}
                            >
                              {flag.severity}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setDismissingRuleId(
                                  dismissingRuleId === flag.ruleId ? null : flag.ruleId
                                );
                                setDismissError(null);
                              }}
                              className="text-[11px] font-medium text-[#F04F25] hover:underline"
                            >
                              {dismissingRuleId === flag.ruleId ? 'Cancel' : 'Dismiss False Positive'}
                            </button>
                          </div>
                        </div>
                        <p className="text-stone-600">{flag.rationale}</p>

                        {dismissingRuleId === flag.ruleId && (
                          <div className="mt-2 pt-2 border-t border-stone-200 space-y-2">
                            <input
                              type="text"
                              value={dismissReviewer}
                              onChange={(e) => setDismissReviewer(e.target.value)}
                              placeholder="Reviewer name *"
                              aria-label="False positive reviewer name"
                              className="w-full rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs"
                            />
                            <input
                              type="text"
                              value={dismissReason}
                              onChange={(e) => setDismissReason(e.target.value)}
                              placeholder="Rationale for dismissing false positive *"
                              aria-label="False positive dismissal reason"
                              className="w-full rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs"
                            />
                            {dismissError && (
                              <div className="text-[11px] font-medium text-red-700">{dismissError}</div>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (!dismissReviewer.trim() || !dismissReason.trim()) {
                                  setDismissError('Reviewer name and rationale are required.');
                                  return;
                                }
                                onDismissRule(selectedItem.id, {
                                  ruleId: flag.ruleId,
                                  ruleName: flag.ruleName,
                                  dismissedBy: dismissReviewer.trim(),
                                  dismissedAt: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
                                  reason: dismissReason.trim(),
                                });
                                setDismissingRuleId(null);
                                setDismissReason('');
                                setDismissError(null);
                              }}
                              className="rounded-md bg-[#333333] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#222222]"
                            >
                              Confirm False Positive Dismissal
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {(selectedItem.dismissedRules?.length ?? 0) > 0 && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowDismissedList((prev) => !prev)}
                      className="text-[11px] font-medium text-stone-600 hover:text-[#222222] underline"
                    >
                      {showDismissedList
                        ? `Hide Dismissed Rules (${selectedItem.dismissedRules!.length})`
                        : `View Dismissed Rules (${selectedItem.dismissedRules!.length})`}
                    </button>
                    {showDismissedList && (
                      <div className="mt-2 space-y-1.5">
                        {selectedItem.dismissedRules!.map((d) => (
                          <div
                            key={d.ruleId}
                            className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] flex items-start justify-between gap-2"
                          >
                            <div className="space-y-0.5">
                              <div className="font-semibold text-stone-700">
                                {d.ruleId} · {d.ruleName} (Dismissed)
                              </div>
                              <div className="text-stone-600">{d.reason}</div>
                              <div className="text-stone-500 font-mono">
                                {d.dismissedBy} · {d.dismissedAt}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onRestoreDismissedRule(selectedItem.id, d.ruleId)}
                              className="shrink-0 font-medium text-[#F04F25] hover:underline"
                            >
                              Restore Rule
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Status Workflow & Evidence Checklist */}
              <div className="space-y-3 pt-2 border-t border-stone-100">
                <div className="text-xs font-semibold text-[#222222]">
                  Investigation Status & Evidence Checklist
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      'New',
                      'Investigating',
                      'Ready for Controller Review',
                      'Resolved',
                    ] as const
                  ).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleStatusChange(st)}
                      className={`py-2 px-2.5 rounded-lg text-xs font-medium border transition-colors ${
                        selectedItem.status === st
                          ? 'bg-[#333333] text-white border-[#333333]'
                          : 'bg-white text-[#333333] border-stone-200 hover:bg-[#F6F5F3]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                {statusGateError && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{statusGateError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  {selectedItem.evidenceChecklist.map((chk) => (
                    <label
                      key={chk.id}
                      className="flex items-start gap-2 text-xs text-stone-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={chk.verified}
                        onChange={() => onToggleChecklist(selectedItem.id, chk.id)}
                        className="mt-0.5 accent-[#F04F25] rounded"
                      />
                      <span className={chk.verified ? 'line-through text-stone-400' : ''}>
                        {chk.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Quick Investigation Assignment: Owner & Preliminary Explanation */}
              <div className="pt-2 border-t border-stone-100 space-y-2.5 text-xs">
                <div className="font-semibold text-[#222222]">
                  Investigation Assignment &amp; Preliminary Explanation
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={quickOwner}
                    onChange={(e) => setQuickOwner(e.target.value)}
                    placeholder="Assigned Owner"
                    aria-label="Investigation owner"
                    className="sm:col-span-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-[#222222] focus:border-[#F04F25] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={quickExplanation}
                    onChange={(e) => setQuickExplanation(e.target.value)}
                    placeholder="Document preliminary explanation..."
                    aria-label="Preliminary explanation"
                    className="sm:col-span-2 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-[#222222] focus:border-[#F04F25] focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onEditEntry(
                        selectedItem.id,
                        {
                          owner: quickOwner.trim() || selectedItem.owner,
                          notes: quickExplanation.trim(),
                        },
                        `Assigned owner (${quickOwner.trim() || selectedItem.owner}) and updated preliminary explanation.`
                      );
                      setQuickSavedMsg('Owner & preliminary explanation logged to audit trail.');
                    }}
                    className="rounded-lg bg-[#F04F25] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#D9421B]"
                  >
                    Save Owner &amp; Explanation
                  </button>
                  {quickSavedMsg && (
                    <span className="text-[11px] font-medium text-emerald-700">
                      {quickSavedMsg}
                    </span>
                  )}
                </div>
              </div>

              {/* Human Correction / Recovery Decision */}
              <div className="pt-2 border-t border-stone-100 space-y-2 text-xs">
                <div className="font-semibold text-[#222222]">
                  Human Verification Decision (AI never auto-posts adjustments)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['Pending', 'Accepted', 'Rejected'] as const).map((dec) => (
                    <button
                      key={dec}
                      type="button"
                      onClick={() =>
                        onSetHumanDecision(selectedItem.id, dec, auditActor)
                      }
                      className={`py-1.5 px-2.5 rounded-lg border font-medium ${
                        selectedItem.humanCorrectionDecision === dec
                          ? 'bg-[#FFF3ED] border-[#F04F25] text-[#D9421B]'
                          : 'bg-white border-stone-200 text-stone-600 hover:bg-[#FAFAFA]'
                      }`}
                    >
                      {dec}
                    </button>
                  ))}
                </div>
              </div>

              {/* Documented Case Facts vs. AI Explanation */}
              <div className="pt-3 border-t border-stone-200 space-y-3 text-xs">
                <div>
                  <div className="font-semibold text-[#222222]">
                    Documented Case Evidence & Verification Gaps
                  </div>
                  <p className="mt-1 text-stone-600 leading-relaxed">
                    <span className="font-medium text-[#333333]">Evidence:</span>{' '}
                    {selectedItem.supportingEvidence}
                  </p>
                  <p className="mt-1 text-amber-800 leading-relaxed">
                    <span className="font-medium">Verification Gap:</span>{' '}
                    {selectedItem.verificationGaps}
                  </p>
                  <p className="mt-1 text-stone-600 leading-relaxed">
                    <span className="font-medium text-[#333333]">Earnings Effect:</span>{' '}
                    {selectedItem.operatingEarningsEffect}
                  </p>
                </div>

                {/* Five Ws and How */}
                <div className="pt-2 border-t border-stone-100 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-[#222222]">
                      Five Ws & How (Verified Facts Only)
                    </div>
                    <button
                      type="button"
                      onClick={handleGeminiExplain}
                      disabled={geminiLoading}
                      className="inline-flex items-center gap-1 rounded-md border border-[#F04F25]/30 bg-[#FFF3ED] px-2.5 py-1 text-[11px] font-medium text-[#D9421B] hover:bg-[#FFE5D9] disabled:opacity-60"
                    >
                      {geminiLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      <span>AI Suggested Checks</span>
                    </button>
                  </div>

                  {geminiError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                      {geminiError}
                    </div>
                  )}
                  {geminiById[selectedItem.id] && (
                    <div className="rounded-lg border border-[#F04F25]/30 bg-[#FFF3ED]/60 p-3 text-xs text-[#333333] whitespace-pre-line">
                      <div className="font-semibold text-[#D9421B] mb-1">
                        AI Suggestion (Unverified Hypothesis — Requires Human Check)
                      </div>
                      {geminiById[selectedItem.id]}
                    </div>
                  )}

                  <dl className="space-y-1.5">
                    {(
                      [
                        ['Who', selectedItem.fiveWs.who],
                        ['What', selectedItem.fiveWs.what],
                        ['When', selectedItem.fiveWs.when],
                        ['Where', selectedItem.fiveWs.where],
                        ['Why', selectedItem.fiveWs.why],
                        ['How', selectedItem.fiveWs.how],
                      ] as const
                    ).map(([label, val]) => (
                      <div key={label} className="grid grid-cols-12 gap-2">
                        <dt className="col-span-2 font-semibold text-stone-700">
                          {label}
                        </dt>
                        <dd className="col-span-10 text-stone-600">{val}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>

              {/* Approval & Chronological Demo Audit Log */}
              <div className="pt-3 border-t border-stone-200 space-y-3 text-xs">
                <div>
                  <div className="font-semibold text-[#222222]">
                    Simulated Demo Approval (Local Browser Identity — Not Identity-Verified)
                  </div>
                  <div className="text-[11px] text-stone-500">
                    Edits persist locally in browser storage without modifying official source truth. Enterprise deployment requires SSO &amp; RBAC authorization.
                  </div>
                </div>

                <form onSubmit={handleAuditSubmit} className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={auditActor}
                      onChange={(e) => setAuditActor(e.target.value)}
                      placeholder="Reviewer name"
                      aria-label="Reviewer name"
                      className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-[#222222] focus:border-[#F04F25] focus:outline-none"
                    />
                    <select
                      value={auditApprovalState}
                      onChange={(e) =>
                        setAuditApprovalState(e.target.value as ApprovalState)
                      }
                      aria-label="Approval state"
                      className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-[#222222] focus:border-[#F04F25] focus:outline-none"
                    >
                      <option value="Present">Approval: Present</option>
                      <option value="Confirmed Missing">
                        Approval: Confirmed Missing
                      </option>
                      <option value="Not Provided in Case">
                        Approval: Not Provided in Case
                      </option>
                    </select>
                  </div>
                  {auditApprovalState === 'Present' && (
                    <input
                      type="text"
                      value={auditApprovalRef}
                      onChange={(e) => setAuditApprovalRef(e.target.value)}
                      placeholder="Approval reference (e.g. APR-2026-991)"
                      aria-label="Approval reference"
                      className="w-full rounded-lg border border-stone-200 px-3 py-1.5 font-mono text-xs text-[#222222] focus:border-[#F04F25] focus:outline-none"
                    />
                  )}
                  <input
                    type="text"
                    value={auditNote}
                    onChange={(e) => setAuditNote(e.target.value)}
                    placeholder="Evidence or investigation note..."
                    aria-label="Audit note"
                    className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-[#222222] focus:border-[#F04F25] focus:outline-none"
                  />
                  {auditError && (
                    <div className="text-red-700 font-medium">{auditError}</div>
                  )}
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#333333] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#222222]"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    <span>Save Approval & Log Event</span>
                  </button>
                </form>

                <div className="space-y-2 max-h-40 overflow-y-auto pt-1">
                  {selectedItem.auditTrail.map((aud) => (
                    <div
                      key={aud.id}
                      className="border-b border-stone-100 pb-1.5 last:border-b-0"
                    >
                      <div className="flex items-center justify-between gap-2 text-stone-500">
                        <span className="font-medium text-[#333333]">
                          {aud.action} · {aud.actor}
                        </span>
                        <span className="font-mono text-[11px] tabular-nums">
                          {aud.timestamp}
                        </span>
                      </div>
                      <div className="text-stone-600">{aud.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Add / Edit Cost Entry Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-white border border-stone-200 shadow-xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-base font-semibold text-[#222222]">
                  {editingEntry
                    ? editingEntry.provenance === 'Official case baseline'
                      ? `Edit Investigation Metadata (${editingEntry.id})`
                      : `Edit Scenario Cost Entry (${editingEntry.id})`
                    : 'Add Cost Entry (Immediate Anomaly Screening)'}
                </h3>
                <p className="text-xs text-stone-500">
                  {editingEntry?.provenance === 'Official case baseline'
                    ? 'Official baseline figures (amount, date, description) are locked; update investigation owner, approval state, and notes.'
                    : 'New entries enter the working scenario and are screened immediately without rewriting historical earnings.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-[#222222]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEntryForm} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Entry ID *</span>
                  <input
                    type="text"
                    value={formId}
                    disabled={Boolean(editingEntry)}
                    onChange={(e) => setFormId(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono disabled:bg-stone-100"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Date *</span>
                  <input
                    type="date"
                    value={formDate}
                    disabled={editingEntry?.provenance === 'Official case baseline'}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono disabled:bg-stone-100"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Amount (CAD) *</span>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={formAmount}
                    disabled={editingEntry?.provenance === 'Official case baseline'}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="300000"
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono disabled:bg-stone-100"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="font-medium text-stone-700">Title / Description *</span>
                <input
                  type="text"
                  value={formTitle}
                  disabled={editingEntry?.provenance === 'Official case baseline'}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Unplanned Plant 2 weld fixture replacement"
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 disabled:bg-stone-100"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Department</span>
                  <input
                    type="text"
                    value={formDept}
                    disabled={editingEntry?.provenance === 'Official case baseline'}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 disabled:bg-stone-100"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Region Group</span>
                  <select
                    value={formRegionGroup}
                    disabled={editingEntry?.provenance === 'Official case baseline'}
                    onChange={(e) =>
                      setFormRegionGroup(
                        e.target.value as IrregularCostItem['regionGroup']
                      )
                    }
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 disabled:bg-stone-100"
                  >
                    <option value="North America">North America</option>
                    <option value="Europe">Europe</option>
                    <option value="Corporate">Corporate</option>
                    <option value="Asia">Asia</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Plant / Location</span>
                  <input
                    type="text"
                    value={formPlantRegion}
                    disabled={editingEntry?.provenance === 'Official case baseline'}
                    onChange={(e) => setFormPlantRegion(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 disabled:bg-stone-100"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">GL / Account</span>
                  <input
                    type="text"
                    value={formGlAccount}
                    disabled={editingEntry?.provenance === 'Official case baseline'}
                    onChange={(e) => setFormGlAccount(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 disabled:bg-stone-100"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Vendor / Counterparty</span>
                  <input
                    type="text"
                    value={formVendor}
                    disabled={editingEntry?.provenance === 'Official case baseline'}
                    onChange={(e) => setFormVendor(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 disabled:bg-stone-100"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Invoice # (Dup Check)</span>
                  <input
                    type="text"
                    value={formInvoice}
                    disabled={editingEntry?.provenance === 'Official case baseline'}
                    onChange={(e) => setFormInvoice(e.target.value)}
                    placeholder="e.g. INV-V4471-882-A"
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono disabled:bg-stone-100"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Approval State</span>
                  <select
                    value={formApprovalState}
                    onChange={(e) =>
                      setFormApprovalState(e.target.value as ApprovalState)
                    }
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
                  >
                    <option value="Confirmed Missing">Confirmed Missing</option>
                    <option value="Not Provided in Case">Not Provided in Case</option>
                    <option value="Present">Present</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Approval Ref</span>
                  <input
                    type="text"
                    value={formApprovalRef}
                    disabled={formApprovalState !== 'Present'}
                    onChange={(e) => setFormApprovalRef(e.target.value)}
                    placeholder="APR-2026-XXXX"
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono disabled:bg-stone-100"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Investigation Owner</span>
                  <input
                    type="text"
                    value={formOwner}
                    onChange={(e) => setFormOwner(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">One-Time vs Trend</span>
                  <select
                    value={formCostType}
                    disabled={editingEntry?.provenance === 'Official case baseline'}
                    onChange={(e) =>
                      setFormCostType(e.target.value as CostFrequencyType)
                    }
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 disabled:bg-stone-100"
                  >
                    <option value="One-time">One-time</option>
                    <option value="Trend">Trend</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Walk Category</span>
                  <select
                    value={formWalkCategory}
                    disabled={editingEntry?.provenance === 'Official case baseline'}
                    onChange={(e) => setFormWalkCategory(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 disabled:bg-stone-100"
                  >
                    <option value="Fixed plant">Fixed plant</option>
                    <option value="Variable costs">Variable costs</option>
                    <option value="SG&A">SG&A</option>
                    <option value="Amortization">Amortization</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Accounting Period</span>
                  <input
                    type="text"
                    value={formPeriod}
                    disabled={editingEntry?.provenance === 'Official case baseline'}
                    onChange={(e) => setFormPeriod(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 disabled:bg-stone-100"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="font-medium text-stone-700">Cause & Supporting Evidence</span>
                <textarea
                  rows={2}
                  value={formCause}
                  disabled={editingEntry?.provenance === 'Official case baseline'}
                  onChange={(e) => setFormCause(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 disabled:bg-stone-100"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-medium text-stone-700">Investigation Notes / Preliminary Explanation</span>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-stone-100">
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">
                    Carry-Forward Close Blocker Reason (Optional)
                  </span>
                  <input
                    type="text"
                    value={formCarryForwardReason}
                    onChange={(e) => setFormCarryForwardReason(e.target.value)}
                    placeholder="Leave blank unless it blocks a future close"
                    className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">
                    Carry-Forward Target Quarter (Optional)
                  </span>
                  <input
                    type="text"
                    value={formCarryForwardTarget}
                    onChange={(e) => setFormCarryForwardTarget(e.target.value)}
                    placeholder="e.g. Q4 2026"
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono"
                  />
                </label>
              </div>

              {modalError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-red-700 font-medium">
                  {modalError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2 font-medium text-[#333333] hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#F04F25] px-4 py-2 font-semibold text-white hover:bg-[#D9421B]"
                >
                  {editingEntry ? 'Save Changes' : 'Add & Screen Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Ingestion Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-xl bg-white border border-stone-200 shadow-xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-base font-semibold text-[#222222]">
                  Demo CSV Cost Ingestion & Pre-Commit Screening
                </h3>
                <p className="text-xs text-stone-500">
                  Demo CSV/manual ingestion only (ERP integration is planned in the implementation roadmap). Invalid or duplicate-ID rows are blocked before commit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                aria-label="Close CSV import"
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 font-medium text-[#333333] hover:bg-[#F6F5F3]"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Sample CSV Schema</span>
              </button>
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 font-medium text-[#333333] hover:bg-[#F6F5F3] cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload .csv File</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    file.text().then((txt) => setCsvText(txt));
                  }}
                />
              </label>
            </div>

            <textarea
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              aria-label="CSV cost import text"
              className="w-full rounded-lg border border-stone-200 p-3 font-mono text-[11px] text-[#222222] focus:border-[#F04F25] focus:outline-none"
            />

            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#222222]">
                Validation Preview ({validCsvEntries.length} valid / {csvPreviewRows.length} total rows)
              </div>
              <div className="max-h-48 overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100 text-xs">
                {csvPreviewRows.length === 0 ? (
                  <div className="p-4 text-stone-500 text-center">
                    Paste CSV rows with header line above to preview validation.
                  </div>
                ) : (
                  csvPreviewRows.map((row) => (
                    <div
                      key={row.rowNum}
                      className={`p-2.5 flex items-start justify-between gap-3 ${
                        row.valid ? 'bg-white' : 'bg-red-50/70'
                      }`}
                    >
                      <div>
                        <span className="font-mono font-semibold text-[#222222]">
                          Row {row.rowNum}: {row.raw[0] || '(no ID)'}
                        </span>{' '}
                        <span className="text-stone-600">{row.raw[1]}</span>
                        {!row.valid && (
                          <div className="text-red-700 font-medium mt-0.5">
                            Rejected: {row.errors.join(' · ')}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 font-mono font-medium">
                        {row.valid && row.parsed ? (
                          <span className="text-emerald-700">
                            Valid · {formatCAD(row.parsed.amount)}
                          </span>
                        ) : (
                          <span className="text-red-700">Blocked</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-medium text-[#333333]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={validCsvEntries.length === 0}
                onClick={handleCommitCsv}
                className="rounded-lg bg-[#F04F25] px-4 py-2 text-xs font-semibold text-white hover:bg-[#D9421B] disabled:opacity-50"
              >
                Commit {validCsvEntries.length} Valid Row(s) & Run Screening
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function formDepartmentLabel(dept: string, plant: string): string {
  return `${dept.trim() || 'Operations'} · ${plant.trim() || 'North America'}`;
}
