import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, RotateCcw, X } from 'lucide-react';
import {
  DEFAULT_CLOSE_CHECKLIST,
  DEFAULT_PRESENTATION_ROI_ASSUMPTIONS,
  DEFAULT_ROI_ASSUMPTIONS,
  LEGACY_STORAGE_KEY_V1,
  OFFICIAL_CUSTOMS_ENTRIES,
  OFFICIAL_INTERPROVINCIAL_DELIVERIES,
  OFFICIAL_IRREGULAR_COSTS,
  OFFICIAL_QOQ_WALK,
  OFFICIAL_TARIFF_RULES,
  OFFICIAL_YOY_WALK,
  SCHEMA_VERSION,
  STORAGE_KEY_V2,
  computeExpectedEntryCostsFromRules,
  evaluateWalkReconciliation,
  getActiveScreeningFlags,
  recordPeriodCloseApproval,
  suspendStalePeriodApprovals,
  type TariffRuleImpactPreview,
} from './data/skyjackCaseData';
import type {
  ApprovalState,
  AuditEntry,
  CustomsEntry,
  DismissedRuleRecord,
  EarningsWalk,
  ImportedQuarterRecord,
  InterprovincialDelivery,
  InvestigationStatus,
  IrregularCostItem,
  NavSection,
  PeriodCloseApprovalRecord,
  SkyguardPersistedState,
  TariffRateRule,
  TariffRuleChangeLog,
  WalkExplanationStatus,
} from './types/skyguard';
import { buildExecutiveBriefPdf } from './utils/pdfExporter';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { CostAnomalyDetector } from './components/CostAnomalyDetector';
import { QuarterlyCloseIntelligence } from './components/QuarterlyCloseIntelligence';
import { TradeTariffIntelligence } from './components/TradeTariffIntelligence';
import { InterprovincialCosts } from './components/InterprovincialCosts';
import { AIFinancialAnalyst } from './components/AIFinancialAnalyst';
import { BusinessImpactROI } from './components/BusinessImpactROI';
import { DataManagement } from './components/DataManagement';
import { ReportPreviewModal } from './components/ReportPreviewModal';

function createInitialPersistedState(): SkyguardPersistedState {
  return {
    schemaVersion: SCHEMA_VERSION,
    anomalies: OFFICIAL_IRREGULAR_COSTS,
    customsEntries: OFFICIAL_CUSTOMS_ENTRIES,
    tariffRules: OFFICIAL_TARIFF_RULES,
    tariffRuleChangelog: [],
    interprovincialDeliveries: OFFICIAL_INTERPROVINCIAL_DELIVERIES,
    customWalks: [],
    importedQuarters: [],
    walkLineOverrides: {},
    closeChecklist: DEFAULT_CLOSE_CHECKLIST,
    closeApprovalLog: [],
    periodCloseApprovals: {},
    selectedRoiModel: 'presentation_y1',
    presentationRoiAssumptions: DEFAULT_PRESENTATION_ROI_ASSUMPTIONS,
    roiAssumptions: DEFAULT_ROI_ASSUMPTIONS,
  };
}

function loadInitialState(): SkyguardPersistedState {
  try {
    // Explicitly remove stale v1 cache so legacy pre-upgrade data never hijacks official figures
    if (localStorage.getItem(LEGACY_STORAGE_KEY_V1)) {
      localStorage.removeItem(LEGACY_STORAGE_KEY_V1);
    }
    const raw = localStorage.getItem(STORAGE_KEY_V2);
    if (!raw) return createInitialPersistedState();
    const parsed = JSON.parse(raw) as Partial<SkyguardPersistedState>;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      return createInitialPersistedState();
    }
    const defaults = createInitialPersistedState();
    const loaded: SkyguardPersistedState = {
      schemaVersion: SCHEMA_VERSION,
      anomalies:
        Array.isArray(parsed.anomalies) && parsed.anomalies.length >= 1
          ? parsed.anomalies
          : defaults.anomalies,
      customsEntries:
        Array.isArray(parsed.customsEntries) && parsed.customsEntries.length >= 1
          ? parsed.customsEntries
          : defaults.customsEntries,
      tariffRules:
        Array.isArray(parsed.tariffRules) && parsed.tariffRules.length >= 1
          ? parsed.tariffRules
          : defaults.tariffRules,
      tariffRuleChangelog: Array.isArray(parsed.tariffRuleChangelog)
        ? parsed.tariffRuleChangelog
        : [],
      interprovincialDeliveries:
        Array.isArray(parsed.interprovincialDeliveries) &&
        parsed.interprovincialDeliveries.length >= 1
          ? parsed.interprovincialDeliveries
          : defaults.interprovincialDeliveries,
      customWalks: Array.isArray(parsed.customWalks) ? parsed.customWalks : [],
      importedQuarters: Array.isArray(parsed.importedQuarters)
        ? parsed.importedQuarters
        : [],
      walkLineOverrides: parsed.walkLineOverrides ?? {},
      closeChecklist:
        Array.isArray(parsed.closeChecklist) && parsed.closeChecklist.length >= 1
          ? parsed.closeChecklist
          : defaults.closeChecklist,
      closeApprovalLog: Array.isArray(parsed.closeApprovalLog)
        ? parsed.closeApprovalLog
        : [],
      periodCloseApprovals:
        parsed.periodCloseApprovals &&
        typeof parsed.periodCloseApprovals === 'object' &&
        !Array.isArray(parsed.periodCloseApprovals)
          ? (parsed.periodCloseApprovals as Record<string, PeriodCloseApprovalRecord>)
          : {},
      selectedRoiModel:
        parsed.selectedRoiModel === 'original_3yr' ? 'original_3yr' : 'presentation_y1',
      presentationRoiAssumptions: {
        ...DEFAULT_PRESENTATION_ROI_ASSUMPTIONS,
        ...(parsed.presentationRoiAssumptions ?? {}),
      },
      roiAssumptions: {
        ...DEFAULT_ROI_ASSUMPTIONS,
        ...(parsed.roiAssumptions ?? {}),
      },
    };
    const checked = suspendStalePeriodApprovals(
      loaded,
      makeTimestamp(),
      'Saved state differed from previously approved close snapshot.'
    );
    return {
      ...loaded,
      periodCloseApprovals: checked.periodCloseApprovals,
      closeApprovalLog: checked.closeApprovalLog,
    };
  } catch {
    return createInitialPersistedState();
  }
}

function makeTimestamp(): string {
  return new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}

export default function App() {
  const [state, setState] = useState<SkyguardPersistedState>(loadInitialState);
  const [activeSection, setActiveSection] = useState<NavSection>('executive');
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);
  const [chinaScenarioPct, setChinaScenarioPct] = useState<number>(25);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [showReportPreview, setShowReportPreview] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3400);
  };

  const handleNavigate = (section: NavSection, anomalyId?: string) => {
    setActiveSection(section);
    if (anomalyId) {
      setSelectedAnomalyId(anomalyId);
    }
  };

  const applyCloseInvariant = (
    nextState: SkyguardPersistedState,
    timestamp: string,
    changeReason: string
  ): SkyguardPersistedState => {
    const checked = suspendStalePeriodApprovals(nextState, timestamp, changeReason);
    if (checked.suspendedPeriods.length === 0) return nextState;
    return {
      ...nextState,
      periodCloseApprovals: checked.periodCloseApprovals,
      closeApprovalLog: checked.closeApprovalLog,
    };
  };

  // --- Irregular Cost Actions ---
  const handleAddCostEntry = (entry: IrregularCostItem) => {
    const timestamp = makeTimestamp();
    setState((prev) =>
      applyCloseInvariant(
        {
          ...prev,
          anomalies: [entry, ...prev.anomalies],
        },
        timestamp,
        `Added anomaly entry ${entry.id} (${entry.accountingPeriod}).`
      )
    );
    setSelectedAnomalyId(entry.id);
    showToast(`Added scenario entry ${entry.id} and ran immediate screening`);
  };

  const handleBulkImportCostEntries = (entries: IrregularCostItem[]) => {
    const timestamp = makeTimestamp();
    setState((prev) =>
      applyCloseInvariant(
        {
          ...prev,
          anomalies: [...entries, ...prev.anomalies],
        },
        timestamp,
        `Imported ${entries.length} scenario cost entry/entries.`
      )
    );
    if (entries[0]) setSelectedAnomalyId(entries[0].id);
    showToast(`Imported ${entries.length} scenario cost entries`);
  };

  const handleEditCostEntry = (
    id: string,
    patch: Partial<IrregularCostItem>,
    auditNote: string
  ) => {
    const timestamp = makeTimestamp();
    setState((prev) =>
      applyCloseInvariant(
        {
          ...prev,
          anomalies: prev.anomalies.map((item) => {
            if (item.id !== id) return item;
            return {
              ...item,
              ...patch,
              auditTrail: [
                {
                  id: `AUD-${Date.now()}`,
                  timestamp,
                  actor: 'Working Scenario Editor',
                  action: 'Edited Entry',
                  note: auditNote,
                },
                ...item.auditTrail,
              ],
            };
          }),
        },
        timestamp,
        `Edited transaction ${id}: ${auditNote}`
      )
    );
    showToast(`Updated ${id} and appended audit history`);
  };

  const handleDeleteCostEntry = (id: string) => {
    const timestamp = makeTimestamp();
    setState((prev) =>
      applyCloseInvariant(
        {
          ...prev,
          anomalies: prev.anomalies.filter(
            (item) => !(item.id === id && item.provenance === 'User-added scenario')
          ),
        },
        timestamp,
        `Deleted user scenario entry ${id}.`
      )
    );
    showToast(`Deleted user scenario entry ${id}`);
  };

  const handleUpdateStatus = (
    id: string,
    status: InvestigationStatus,
    note?: string
  ) => {
    const timestamp = makeTimestamp();
    setState((prev) =>
      applyCloseInvariant(
        {
          ...prev,
          anomalies: prev.anomalies.map((item) => {
            if (item.id !== id) return item;
            return {
              ...item,
              status,
              auditTrail: [
                {
                  id: `AUD-${Date.now()}`,
                  timestamp,
                  actor: item.owner || 'Controller Review',
                  action: `Status -> ${status}`,
                  note: note || `Investigation status updated to ${status}.`,
                },
                ...item.auditTrail,
              ],
            };
          }),
        },
        timestamp,
        `Investigation status changed for ${id} -> ${status}.`
      )
    );
    showToast(`${id} status -> ${status}`);
  };

  const handleToggleChecklist = (id: string, checkId: string) => {
    const timestamp = makeTimestamp();
    setState((prev) =>
      applyCloseInvariant(
        {
          ...prev,
          anomalies: prev.anomalies.map((item) => {
            if (item.id !== id) return item;
            return {
              ...item,
              evidenceChecklist: item.evidenceChecklist.map((c) =>
                c.id === checkId ? { ...c, verified: !c.verified } : c
              ),
            };
          }),
        },
        timestamp,
        `Evidence checklist modified on ${id}.`
      )
    );
  };

  const handleRecordApprovalAndAudit = (
    id: string,
    approvalState: ApprovalState,
    approvalRef: string | null,
    actor: string,
    note: string
  ) => {
    const timestamp = makeTimestamp();
    setState((prev) =>
      applyCloseInvariant(
        {
          ...prev,
          anomalies: prev.anomalies.map((item) => {
            if (item.id !== id) return item;
            return {
              ...item,
              approvalState,
              approvalRef,
              fiveWs: {
                ...item.fiveWs,
                who:
                  approvalState === 'Present' && approvalRef
                    ? `${item.preparer}; demo approval ${approvalRef} recorded by ${actor}.`
                    : item.fiveWs.who,
              },
              auditTrail: [
                {
                  id: `AUD-${Date.now()}`,
                  timestamp,
                  actor,
                  action:
                    approvalState === 'Present' && approvalRef
                      ? `Demo Approval Recorded (${approvalRef})`
                      : 'Audit Note Recorded',
                  note,
                  isDemoState: true,
                },
                ...item.auditTrail,
              ],
            };
          }),
        },
        timestamp,
        `Approval metadata updated on ${id} (${approvalState}).`
      )
    );
    showToast(`Saved demo audit entry for ${id}`);
  };

  const handleSetHumanDecision = (
    id: string,
    decision: 'Pending' | 'Accepted' | 'Rejected',
    actor: string
  ) => {
    const timestamp = makeTimestamp();
    setState((prev) =>
      applyCloseInvariant(
        {
          ...prev,
          anomalies: prev.anomalies.map((item) => {
            if (item.id !== id) return item;
            return {
              ...item,
              humanCorrectionDecision: decision,
              auditTrail: [
                {
                  id: `AUD-${Date.now()}`,
                  timestamp,
                  actor,
                  action: `Correction Decision: ${decision}`,
                  note: `Human reviewer marked suggested GL/recovery correction as ${decision}.`,
                  isDemoState: true,
                },
                ...item.auditTrail,
              ],
            };
          }),
        },
        timestamp,
        `Human correction decision updated on ${id} -> ${decision}.`
      )
    );
    showToast(`${id} correction marked ${decision}`);
  };

  const handleDismissRule = (anomalyId: string, record: DismissedRuleRecord) => {
    const timestamp = makeTimestamp();
    setState((prev) =>
      applyCloseInvariant(
        {
          ...prev,
          anomalies: prev.anomalies.map((item) => {
            if (item.id !== anomalyId) return item;
            const existing = item.dismissedRules ?? [];
            const deduped = existing.filter((d) => d.ruleId !== record.ruleId);
            return {
              ...item,
              dismissedRules: [record, ...deduped],
              auditTrail: [
                {
                  id: `AUD-${Date.now()}`,
                  timestamp,
                  actor: record.dismissedBy,
                  action: `Dismissed Screening Rule (${record.ruleId})`,
                  note: record.reason,
                  isDemoState: true,
                },
                ...item.auditTrail,
              ],
            };
          }),
        },
        timestamp,
        `Dismissed screening rule ${record.ruleId} on ${anomalyId}.`
      )
    );
    showToast(`Dismissed rule ${record.ruleId} on ${anomalyId}`);
  };

  const handleRestoreDismissedRule = (anomalyId: string, ruleId: string) => {
    const timestamp = makeTimestamp();
    setState((prev) =>
      applyCloseInvariant(
        {
          ...prev,
          anomalies: prev.anomalies.map((item) => {
            if (item.id !== anomalyId) return item;
            return {
              ...item,
              dismissedRules: (item.dismissedRules ?? []).filter(
                (d) => d.ruleId !== ruleId
              ),
              auditTrail: [
                {
                  id: `AUD-${Date.now()}`,
                  timestamp,
                  actor: 'Reviewer',
                  action: `Restored Screening Rule (${ruleId})`,
                  note: `Re-enabled ${ruleId} active screening check.`,
                  isDemoState: true,
                },
                ...item.auditTrail,
              ],
            };
          }),
        },
        timestamp,
        `Restored screening rule ${ruleId} on ${anomalyId}.`
      )
    );
    showToast(`Restored rule ${ruleId} on ${anomalyId}`);
  };

  // --- Quarterly Close Actions ---
  const handleVerifyWalkLine = (
    lineId: string,
    status: WalkExplanationStatus,
    explanationText: string,
    owner: string,
    evidenceReference: string,
    approvalDecision: 'Pending' | 'Approved' | 'Needs Investigation',
    verifier: string,
    verificationDate: string
  ) => {
    const timestamp = makeTimestamp();
    setState((prev) =>
      applyCloseInvariant(
        {
          ...prev,
          walkLineOverrides: {
            ...prev.walkLineOverrides,
            [lineId]: {
              explanationStatus: status,
              explanationText,
              owner,
              evidenceReference,
              approvalDecision,
              verifiedBy: status === 'Verified' ? verifier : undefined,
              verifiedAt: status === 'Verified' ? verificationDate : undefined,
            },
          },
          closeApprovalLog: [
            {
              id: `CLOSE-LINE-${Date.now()}`,
              timestamp,
              actor: verifier || owner,
              action: `Walk Line ${lineId} -> ${status} (${approvalDecision})`,
              note: `Evidence: ${evidenceReference || 'None'} · Owner: ${owner}`,
              isDemoState: true,
            },
            ...prev.closeApprovalLog,
          ],
        },
        timestamp,
        `Earnings-walk line ${lineId} explanation/status updated (${status}).`
      )
    );
    showToast(`Walk line ${lineId} saved (${status})`);
  };

  const handleToggleCloseChecklist = (id: string) => {
    setState((prev) => ({
      ...prev,
      closeChecklist: prev.closeChecklist.map((c) =>
        c.id === id ? { ...c, completed: !c.completed } : c
      ),
    }));
  };

  const handleAddCustomWalk = (walk: EarningsWalk) => {
    const timestamp = makeTimestamp();
    setState((prev) =>
      applyCloseInvariant(
        {
          ...prev,
          customWalks: [walk, ...prev.customWalks],
        },
        timestamp,
        `Added working earnings walk ${walk.title} (${walk.toPeriod}).`
      )
    );
    showToast(`Added future/working earnings walk ${walk.title}`);
  };

  const handleDeleteCustomWalk = (id: string) => {
    const timestamp = makeTimestamp();
    setState((prev) =>
      applyCloseInvariant(
        {
          ...prev,
          customWalks: prev.customWalks.filter((w) => w.id !== id),
        },
        timestamp,
        `Deleted working earnings walk ${id}.`
      )
    );
    showToast('Deleted working-period walk');
  };

  const handleImportQuarters = (records: ImportedQuarterRecord[]) => {
    const timestamp = makeTimestamp();
    setState((prev) =>
      applyCloseInvariant(
        {
          ...prev,
          importedQuarters: [...records, ...(prev.importedQuarters ?? [])],
        },
        timestamp,
        `Imported ${records.length} future-quarter statement(s).`
      )
    );
    showToast(`Imported ${records.length} future-quarter P&L record(s)`);
  };

  const handleDeleteImportedQuarter = (id: string) => {
    const timestamp = makeTimestamp();
    setState((prev) =>
      applyCloseInvariant(
        {
          ...prev,
          importedQuarters: (prev.importedQuarters ?? []).filter((q) => q.id !== id),
        },
        timestamp,
        `Deleted imported quarter record ${id}.`
      )
    );
    showToast('Removed imported quarter record');
  };

  const handleRecordCloseSignOff = (
    walkId: string,
    reviewerName: string,
    approvalDate: string
  ) => {
    const timestamp = makeTimestamp();
    let toastText = `Simulated Demo Approval recorded for close sign-off by ${reviewerName}`;
    setState((prev) => {
      const res = recordPeriodCloseApproval(prev, {
        walkId,
        reviewerName,
        approvalDate,
        timestamp,
      });
      if (!res.recorded) {
        toastText = res.error ?? 'Unable to record close approval.';
        return prev;
      }
      toastText = `Simulated Demo Approval recorded for ${res.periodKey} by ${reviewerName} (Identity Not Verified)`;
      return {
        ...prev,
        periodCloseApprovals: res.periodCloseApprovals,
        closeApprovalLog: res.closeApprovalLog,
      };
    });
    showToast(toastText);
  };

  // --- Trade & Tariff Actions ---
  const handleAddShipment = (entry: CustomsEntry) => {
    setState((prev) => ({
      ...prev,
      customsEntries: [...prev.customsEntries, entry],
    }));
    showToast(`Added shipment ${entry.id}`);
  };

  const handleBulkImportShipments = (entries: CustomsEntry[]) => {
    setState((prev) => ({
      ...prev,
      customsEntries: [...prev.customsEntries, ...entries],
    }));
    showToast(`Imported ${entries.length} customs shipments`);
  };

  const handleEditShipment = (id: string, entry: CustomsEntry) => {
    setState((prev) => ({
      ...prev,
      customsEntries: prev.customsEntries.map((c) => (c.id === id ? entry : c)),
    }));
    showToast(`Updated shipment ${id}`);
  };

  const handleDeleteShipment = (id: string) => {
    setState((prev) => ({
      ...prev,
      customsEntries: prev.customsEntries.filter(
        (c) => !(c.id === id && c.provenance === 'User-added scenario')
      ),
    }));
    showToast(`Deleted user scenario shipment ${id}`);
  };

  const handleSaveRuleWithImpact = (
    rule: TariffRateRule,
    preview: TariffRuleImpactPreview,
    changedBy: string,
    applyToWorking: boolean
  ) => {
    const timestamp = makeTimestamp();
    setState((prev) => {
      const existing = prev.tariffRules.find((r) => r.id === rule.id);
      const nextRules = existing
        ? prev.tariffRules.map((r) => (r.id === rule.id ? rule : r))
        : [rule, ...prev.tariffRules];

      const logEntry: TariffRuleChangeLog = {
        id: `RLOG-${Date.now()}`,
        ruleId: rule.id,
        rateKind: rule.rateKind,
        countryOrScope: rule.countryOrScope,
        oldRateDecimal: existing ? existing.rateDecimal : null,
        newRateDecimal: rule.rateDecimal,
        effectiveDate: rule.effectiveDate,
        changedBy,
        timestamp,
        affectedShipmentIds: preview.affectedEntries.map((e) => e.entryId),
        expectedCostDeltaCAD: preview.netDeltaCAD,
        appliedToWorkingEntries: applyToWorking,
        note: `${existing ? `Updated v${existing.version} -> v${rule.version}` : 'Added new rule'}; affected ${preview.affectedCount} entry(ies).`,
      };

      const affectedIdSet = new Set(preview.affectedEntries.map((e) => e.entryId));
      const nextEntries = applyToWorking
        ? prev.customsEntries.map((entry) => {
            // Historical Official case baseline entries stay strictly immutable
            if (entry.provenance === 'Official case baseline') return entry;
            if (!affectedIdSet.has(entry.id)) return entry;
            const recalc = computeExpectedEntryCostsFromRules(entry, nextRules);
            const assessedDutyAndTariffs =
              recalc.normalDuty + recalc.chinaTariff + recalc.exportDuty;
            const brokerVariance = entry.billedBrokerFee - recalc.expectedBroker;
            return {
              ...entry,
              normalDutyAmount: recalc.normalDuty,
              chinaAdditionalTariffAmount: recalc.chinaTariff,
              exportDutyAmount: recalc.exportDuty,
              assessedDutyAndTariffs,
              expectedBrokerFee: recalc.expectedBroker,
              brokerVariance,
              brokerStatus: (brokerVariance > 0
                ? 'Overcharge'
                : brokerVariance < 0
                  ? 'Undercharge'
                  : 'Compliant') as CustomsEntry['brokerStatus'],
            };
          })
        : prev.customsEntries;

      return {
        ...prev,
        tariffRules: nextRules,
        tariffRuleChangelog: [logEntry, ...(prev.tariffRuleChangelog ?? [])],
        customsEntries: nextEntries,
      };
    });
    showToast(
      `Saved ${rule.id} (v${rule.version}) · ${preview.affectedCount} shipment(s) evaluated`
    );
  };

  // --- Interprovincial Actions ---
  const handleAddDelivery = (delivery: InterprovincialDelivery) => {
    setState((prev) => ({
      ...prev,
      interprovincialDeliveries: [...prev.interprovincialDeliveries, delivery],
    }));
    showToast(`Added interprovincial delivery ${delivery.id}`);
  };

  const handleEditDelivery = (id: string, delivery: InterprovincialDelivery) => {
    setState((prev) => ({
      ...prev,
      interprovincialDeliveries: prev.interprovincialDeliveries.map((d) =>
        d.id === id ? delivery : d
      ),
    }));
    showToast(`Updated ${id}`);
  };

  const handleDeleteDelivery = (id: string) => {
    setState((prev) => ({
      ...prev,
      interprovincialDeliveries: prev.interprovincialDeliveries.filter(
        (d) => !(d.id === id && d.provenance === 'User-added scenario')
      ),
    }));
    showToast(`Deleted scenario delivery ${id}`);
  };

  // Merged Official Walks with Overrides (for Close Intelligence & PDF Export)
  const effectiveYoyWalk = useMemo<EarningsWalk>(
    () => ({
      ...OFFICIAL_YOY_WALK,
      lines: OFFICIAL_YOY_WALK.lines.map((line) => ({
        ...line,
        ...(state.walkLineOverrides[line.id] ?? {}),
      })),
    }),
    [state.walkLineOverrides]
  );

  const effectiveQoqWalk = useMemo<EarningsWalk>(
    () => ({
      ...OFFICIAL_QOQ_WALK,
      lines: OFFICIAL_QOQ_WALK.lines.map((line) => ({
        ...line,
        ...(state.walkLineOverrides[line.id] ?? {}),
      })),
    }),
    [state.walkLineOverrides]
  );

  // Real Multi-Page PDF Export (never silent fallback)
  const handleExportPdf = async () => {
    if (pdfGenerating) return;
    setPdfError(null);
    setPdfGenerating(true);
    try {
      const { blob, filename } = await buildExecutiveBriefPdf({
        anomalies: state.anomalies,
        customsEntries: state.customsEntries,
        interprovincialDeliveries: state.interprovincialDeliveries,
        importedQuarters: state.importedQuarters ?? [],
        tariffRules: state.tariffRules,
        tariffRuleChangelog: state.tariffRuleChangelog ?? [],
        yoyWalk: effectiveYoyWalk,
        qoqWalk: effectiveQoqWalk,
        customWalks: state.customWalks,
        periodCloseApprovals: state.periodCloseApprovals ?? {},
        closeApprovalLog: state.closeApprovalLog,
        chinaScenarioPct,
        selectedRoiModel: state.selectedRoiModel ?? 'presentation_y1',
        presentationRoiAssumptions:
          state.presentationRoiAssumptions ?? DEFAULT_PRESENTATION_ROI_ASSUMPTIONS,
        roiAssumptions: state.roiAssumptions,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      showToast(`Generated ${filename}`);
    } catch (err) {
      setPdfError(
        err instanceof Error
          ? `PDF export failed: ${err.message}`
          : 'PDF export failed due to an unexpected browser rendering error.'
      );
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleExportJsonBackup = () => {
    const payload = {
      backupType: 'SKYGUARD AI Working State Backup (NOT Executive Brief PDF)',
      exportedAt: new Date().toISOString(),
      ...state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `skyguard_working_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded JSON working-data backup');
  };

  const handleConfirmReset = () => {
    const fresh = createInitialPersistedState();
    setState(fresh);
    setChinaScenarioPct(25);
    setSelectedAnomalyId(null);
    localStorage.removeItem(STORAGE_KEY_V2);
    localStorage.removeItem(LEGACY_STORAGE_KEY_V1);
    setShowResetConfirm(false);
    showToast('Reset workspace to official Q3 2026 SKYJACK Case baseline');
  };

  // Sidebar live counters (uses active non-dismissed screening rules)
  const openAnomalyCount = useMemo(
    () =>
      state.anomalies.filter(
        (item) =>
          getActiveScreeningFlags(item, state.anomalies, state.customsEntries).length > 0 &&
          item.status !== 'Resolved'
      ).length,
    [state.anomalies, state.customsEntries]
  );

  const pendingCloseLineCount = useMemo(() => {
    const yoyEval = evaluateWalkReconciliation(
      effectiveYoyWalk,
      state.anomalies,
      state.anomalies
    );
    const qoqEval = evaluateWalkReconciliation(
      effectiveQoqWalk,
      state.anomalies,
      state.anomalies
    );
    return yoyEval.pendingMaterialCount + qoqEval.pendingMaterialCount;
  }, [effectiveYoyWalk, effectiveQoqWalk, state.anomalies]);

  const brokerVarianceCount = useMemo(
    () => state.customsEntries.filter((e) => e.brokerVariance !== 0).length,
    [state.customsEntries]
  );

  return (
    <div className="min-h-screen flex bg-[#F6F5F3] text-[#333333]">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={(section) => handleNavigate(section)}
        openAnomalyCount={openAnomalyCount}
        pendingCloseLineCount={pendingCloseLineCount}
        brokerVarianceCount={brokerVarianceCount}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeSection={activeSection}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onExportPdf={handleExportPdf}
          onOpenReportPreview={() => setShowReportPreview(true)}
          pdfGenerating={pdfGenerating}
        />

        {pdfError && (
          <div className="mx-4 sm:mx-8 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between gap-4 text-xs text-red-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{pdfError}</span>
            </div>
            <button
              type="button"
              onClick={() => setPdfError(null)}
              className="rounded p-1 hover:bg-red-100"
              aria-label="Dismiss PDF error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <main className="flex-1 px-4 sm:px-8 py-6 max-w-[1440px] w-full mx-auto">
          {activeSection === 'executive' && (
            <ExecutiveDashboard
              anomalies={state.anomalies}
              customsEntries={state.customsEntries}
              interprovincialDeliveries={state.interprovincialDeliveries}
              importedQuarters={state.importedQuarters ?? []}
              walkLineOverrides={state.walkLineOverrides}
              periodCloseApprovals={state.periodCloseApprovals ?? {}}
              onNavigate={handleNavigate}
            />
          )}

          {activeSection === 'anomalies' && (
            <CostAnomalyDetector
              anomalies={state.anomalies}
              customsEntries={state.customsEntries}
              initialSelectedId={selectedAnomalyId}
              onAddEntry={handleAddCostEntry}
              onBulkImportEntries={handleBulkImportCostEntries}
              onEditEntry={handleEditCostEntry}
              onDeleteEntry={handleDeleteCostEntry}
              onUpdateStatus={handleUpdateStatus}
              onToggleChecklist={handleToggleChecklist}
              onRecordApprovalAndAudit={handleRecordApprovalAndAudit}
              onSetHumanDecision={handleSetHumanDecision}
              onDismissRule={handleDismissRule}
              onRestoreDismissedRule={handleRestoreDismissedRule}
              onNavigate={handleNavigate}
            />
          )}

          {activeSection === 'close' && (
            <QuarterlyCloseIntelligence
              anomalies={state.anomalies}
              customWalks={state.customWalks}
              importedQuarters={state.importedQuarters ?? []}
              walkLineOverrides={state.walkLineOverrides}
              closeChecklist={state.closeChecklist}
              closeApprovalLog={state.closeApprovalLog}
              periodCloseApprovals={state.periodCloseApprovals ?? {}}
              onVerifyWalkLine={handleVerifyWalkLine}
              onToggleCloseChecklist={handleToggleCloseChecklist}
              onAddCustomWalk={handleAddCustomWalk}
              onDeleteCustomWalk={handleDeleteCustomWalk}
              onImportQuarters={handleImportQuarters}
              onDeleteImportedQuarter={handleDeleteImportedQuarter}
              onRecordCloseSignOff={handleRecordCloseSignOff}
              onNavigate={handleNavigate}
              onExportPdf={handleExportPdf}
            />
          )}

          {activeSection === 'trade' && (
            <TradeTariffIntelligence
              customsEntries={state.customsEntries}
              tariffRules={state.tariffRules}
              tariffRuleChangelog={state.tariffRuleChangelog ?? []}
              chinaScenarioPct={chinaScenarioPct}
              onChangeChinaScenarioPct={setChinaScenarioPct}
              onAddShipment={handleAddShipment}
              onBulkImportShipments={handleBulkImportShipments}
              onEditShipment={handleEditShipment}
              onDeleteShipment={handleDeleteShipment}
              onSaveRuleWithImpact={handleSaveRuleWithImpact}
            />
          )}

          {activeSection === 'interprovincial' && (
            <InterprovincialCosts
              deliveries={state.interprovincialDeliveries}
              onAddDelivery={handleAddDelivery}
              onEditDelivery={handleEditDelivery}
              onDeleteDelivery={handleDeleteDelivery}
            />
          )}

          {activeSection === 'analyst' && (
            <AIFinancialAnalyst
              anomalies={state.anomalies}
              customsEntries={state.customsEntries}
              interprovincialDeliveries={state.interprovincialDeliveries}
              walkLineOverrides={state.walkLineOverrides}
              periodCloseApprovals={state.periodCloseApprovals ?? {}}
              selectedRoiModel={state.selectedRoiModel ?? 'presentation_y1'}
              presentationRoiAssumptions={
                state.presentationRoiAssumptions ?? DEFAULT_PRESENTATION_ROI_ASSUMPTIONS
              }
              roiAssumptions={state.roiAssumptions}
              onNavigate={handleNavigate}
            />
          )}

          {activeSection === 'roi' && (
            <BusinessImpactROI
              selectedModel={state.selectedRoiModel ?? 'presentation_y1'}
              onSelectModel={(model) =>
                setState((prev) => ({ ...prev, selectedRoiModel: model }))
              }
              presentationAssumptions={
                state.presentationRoiAssumptions ?? DEFAULT_PRESENTATION_ROI_ASSUMPTIONS
              }
              onChangePresentationAssumptions={(next) =>
                setState((prev) => ({ ...prev, presentationRoiAssumptions: next }))
              }
              assumptions={state.roiAssumptions}
              customsEntries={state.customsEntries}
              onChangeAssumptions={(next) =>
                setState((prev) => ({ ...prev, roiAssumptions: next }))
              }
            />
          )}

          {activeSection === 'data' && (
            <DataManagement
              state={state}
              anomalies={state.anomalies}
              customsEntries={state.customsEntries}
              tariffRules={state.tariffRules}
              tariffRuleChangelog={state.tariffRuleChangelog ?? []}
              interprovincialDeliveries={state.interprovincialDeliveries}
              customWalks={state.customWalks}
              importedQuarters={state.importedQuarters ?? []}
              onExportJsonBackup={handleExportJsonBackup}
              onRequestResetToOfficialCase={() => setShowResetConfirm(true)}
              onNavigate={handleNavigate}
            />
          )}
        </main>
      </div>

      {/* Report Preview Modal */}
      <ReportPreviewModal
        open={showReportPreview}
        onClose={() => setShowReportPreview(false)}
        onDownloadPdf={handleExportPdf}
        pdfGenerating={pdfGenerating}
        anomalies={state.anomalies}
        customsEntries={state.customsEntries}
        interprovincialDeliveries={state.interprovincialDeliveries}
        importedQuarters={state.importedQuarters ?? []}
        tariffRuleChangelog={state.tariffRuleChangelog ?? []}
        yoyWalk={effectiveYoyWalk}
        qoqWalk={effectiveQoqWalk}
        customWalks={state.customWalks}
        periodCloseApprovals={state.periodCloseApprovals ?? {}}
        chinaScenarioPct={chinaScenarioPct}
        selectedRoiModel={state.selectedRoiModel ?? 'presentation_y1'}
        presentationRoiAssumptions={
          state.presentationRoiAssumptions ?? DEFAULT_PRESENTATION_ROI_ASSUMPTIONS
        }
        roiAssumptions={state.roiAssumptions}
      />

      {/* Explicit Reset to Official Case Confirmation Modal */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm reset to official case baseline"
        >
          <div className="bg-white rounded-xl border border-stone-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-[#222222]">
              <RotateCcw className="h-4 w-4 text-red-600" />
              <span>Reset Workspace to Official Case Baseline?</span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              This will restore the immutable Q3 2026 SKYJACK Official Case dataset (IR-01..IR-07, E-01..E-12, YoY & QoQ walks, IP-01..IP-05, and Base ROI assumptions) and{' '}
              <span className="font-semibold text-red-700">
                permanently clear any user-added scenario entries, edits, CSV imports, and audit notes saved in this browser
              </span>.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="rounded-lg border border-stone-200 px-3.5 py-2 text-xs font-medium text-[#333333] hover:bg-[#F6F5F3]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
              >
                Confirm Reset to Official Case
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 rounded-lg bg-[#333333] text-white px-4 py-2.5 text-xs font-medium shadow-lg border border-stone-700"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
