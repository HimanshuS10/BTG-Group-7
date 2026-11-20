import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit3,
  Info,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  APPENDIX_SECTIONS,
  CASE_CONSTANTS,
  HISTORICAL_QUARTERLY_SERIES,
  calculateChinaTariffSimulation,
  computeExpectedEntryCostsFromRules,
  formatCAD,
  formatSignedCAD,
  previewTariffRuleImpact,
  type TariffRuleImpactPreview,
} from '../data/skyjackCaseData';
import { parseCsvNumber, parseCsvWithHeaders } from '../utils/csvParser';
import type {
  CustomsEntry,
  FtaClaimStatus,
  TariffRateRule,
  TariffRuleChangeLog,
} from '../types/skyguard';

interface TradeTariffIntelligenceProps {
  customsEntries: CustomsEntry[];
  tariffRules: TariffRateRule[];
  tariffRuleChangelog: TariffRuleChangeLog[];
  chinaScenarioPct: number;
  onChangeChinaScenarioPct: (pct: number) => void;
  onAddShipment: (entry: CustomsEntry) => void;
  onBulkImportShipments: (entries: CustomsEntry[]) => void;
  onEditShipment: (id: string, entry: CustomsEntry) => void;
  onDeleteShipment: (id: string) => void;
  onSaveRuleWithImpact: (
    rule: TariffRateRule,
    preview: TariffRuleImpactPreview,
    changedBy: string,
    applyToWorking: boolean
  ) => void;
}

type TradeFilter =
  | 'all'
  | 'overcharge'
  | 'undercharge'
  | 'missed_fta'
  | 'china_tariff'
  | 'user_added';

const SAMPLE_SHIPMENT_CSV = [
  'id,date,originCountry,destination,goods,hsCode,declaredValue,normalDutyPct,chinaExtraPct,exportDutyPct,ftaClaimed,billedBrokerFee,contractBrokerPct,notes',
  'E-13,2026-09-29,UK,Guelph,hydraulic valves,8481,100000,2.0,0,0,false,400,0.2,Scenario UK shipment for broker audit',
].join('\n');

export const TradeTariffIntelligence: React.FC<TradeTariffIntelligenceProps> = ({
  customsEntries,
  tariffRules,
  tariffRuleChangelog,
  chinaScenarioPct,
  onChangeChinaScenarioPct,
  onAddShipment,
  onBulkImportShipments,
  onEditShipment,
  onDeleteShipment,
  onSaveRuleWithImpact,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [tradeFilter, setTradeFilter] = useState<TradeFilter>('all');
  const [selectedId, setSelectedId] = useState<string>('E-04');
  const [activeSubTab, setActiveSubTab] = useState<'ledger' | 'rates'>('ledger');

  // Add/Edit Shipment Modal State
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [editingShipment, setEditingShipment] = useState<CustomsEntry | null>(null);
  const [sId, setSId] = useState('');
  const [sDate, setSDate] = useState('2026-09-25');
  const [sOrigin, setSOrigin] = useState('UK');
  const [sDest, setSDest] = useState('Guelph');
  const [sIncoterm, setSIncoterm] = useState('');
  const [sGoods, setSGoods] = useState('');
  const [sHs, setSHs] = useState('8481');
  const [sDeclared, setSDeclared] = useState('100000');
  const [sNormalPct, setSNormalPct] = useState('2');
  const [sChinaPct, setSChinaPct] = useState('0');
  const [sExportPct, setSExportPct] = useState('0');
  const [sAutoApplyDateRules, setSAutoApplyDateRules] = useState(true);
  const [sFtaStatus, setSFtaStatus] = useState<FtaClaimStatus>('Unverified / Non-FTA');
  const [sFtaDoc, setSFtaDoc] = useState(false);
  const [sBilledBroker, setSBilledBroker] = useState('400');
  const [sContractPct, setSContractPct] = useState('0.2');
  const [sEvidence, setSEvidence] = useState('');
  const [sNotes, setSNotes] = useState('');
  const [shipmentError, setShipmentError] = useState<string | null>(null);

  // CSV Modal
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState(SAMPLE_SHIPMENT_CSV);

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Rate Rule Form + Impact Preview State
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<TariffRateRule | null>(null);
  const [rScope, setRScope] = useState('China');
  const [rHs, setRHs] = useState('8501 / 8537');
  const [rKind, setRKind] =
    useState<TariffRateRule['rateKind']>('Additional China Practice Tariff');
  const [rRatePct, setRRatePct] = useState('25');
  const [rEffDate, setREffDate] = useState('2026-01-01');
  const [rEndDate, setREndDate] = useState('');
  const [rNote, setRNote] = useState('');
  const [rChangedBy, setRChangedBy] = useState('Marco (Trade & Customs Lead)');
  const [rApplyToWorking, setRApplyToWorking] = useState(true);
  const [rConfirmPreview, setRConfirmPreview] = useState(false);

  const proposedRuleDraft = useMemo<TariffRateRule>(() => {
    const rateDec = Number(rRatePct) / 100;
    const validRate = Number.isFinite(rateDec) && rateDec >= 0 ? rateDec : 0;
    const existingSame = tariffRules.filter(
      (r) => r.rateKind === rKind && r.countryOrScope === rScope
    );
    const nextVersion = editingRule
      ? editingRule.version + 1
      : Math.max(0, ...existingSame.map((r) => r.version)) + 1;
    return {
      id: editingRule ? editingRule.id : `RULE-${Date.now()}`,
      provenance: editingRule?.provenance ?? 'User-added scenario',
      countryOrScope: rScope.trim(),
      goodsOrHsFilter: rHs.trim(),
      rateKind: rKind,
      rateDecimal: validRate,
      effectiveDate: rEffDate,
      endDate: rEndDate.trim() || null,
      sourceNote: rNote.trim() || 'User-defined fictional practice rule.',
      version: nextVersion,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
  }, [editingRule, rScope, rHs, rKind, rRatePct, rEffDate, rEndDate, rNote, tariffRules]);

  const ruleImpactPreview = useMemo(
    () => previewTariffRuleImpact(proposedRuleDraft, tariffRules, customsEntries),
    [proposedRuleDraft, tariffRules, customsEntries]
  );

  const activeRulesExpectedTotal = useMemo(
    () =>
      customsEntries.reduce(
        (s, e) => s + computeExpectedEntryCostsFromRules(e, tariffRules).expectedAllInCost,
        0
      ),
    [customsEntries, tariffRules]
  );

  const simulation = useMemo(
    () => calculateChinaTariffSimulation(customsEntries, chinaScenarioPct / 100),
    [customsEntries, chinaScenarioPct]
  );

  const summary = useMemo(() => {
    const baseline = customsEntries.filter(
      (c) => c.provenance === 'Official case baseline'
    );
    const calcGroup = (arr: CustomsEntry[]) => {
      const declared = arr.reduce((s, e) => s + e.declaredValue, 0);
      const normalDuty = arr.reduce((s, e) => s + e.normalDutyAmount, 0);
      const chinaExtra = arr.reduce((s, e) => s + e.chinaAdditionalTariffAmount, 0);
      const exportDuty = arr.reduce((s, e) => s + e.exportDutyAmount, 0);
      const totalDuty = arr.reduce((s, e) => s + e.assessedDutyAndTariffs, 0);
      const expectedBroker = arr.reduce((s, e) => s + e.expectedBrokerFee, 0);
      const billedBroker = arr.reduce((s, e) => s + e.billedBrokerFee, 0);
      const grossOver = arr
        .filter((e) => e.brokerVariance > 0)
        .reduce((s, e) => s + e.brokerVariance, 0);
      const grossUnder = arr
        .filter((e) => e.brokerVariance < 0)
        .reduce((s, e) => s + Math.abs(e.brokerVariance), 0);
      const netExcess = billedBroker - expectedBroker;
      return {
        declared,
        normalDuty,
        chinaExtra,
        exportDuty,
        totalDuty,
        expectedBroker,
        billedBroker,
        grossOver,
        grossUnder,
        netExcess,
        allIn: totalDuty + billedBroker,
      };
    };

    return {
      baseline: calcGroup(baseline),
      working: calcGroup(customsEntries),
      hasScenarioAdditions: customsEntries.length > baseline.length,
    };
  }, [customsEntries]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customsEntries.filter((entry) => {
      if (tradeFilter === 'overcharge' && entry.brokerStatus !== 'Overcharge') {
        return false;
      }
      if (tradeFilter === 'undercharge' && entry.brokerStatus !== 'Undercharge') {
        return false;
      }
      if (
        tradeFilter === 'missed_fta' &&
        entry.ftaStatus !== 'Potential Eligible / Unclaimed'
      ) {
        return false;
      }
      if (tradeFilter === 'china_tariff' && !entry.isChinaAdditionalTariff) {
        return false;
      }
      if (
        tradeFilter === 'user_added' &&
        entry.provenance !== 'User-added scenario'
      ) {
        return false;
      }
      if (!q) return true;
      return (
        entry.id.toLowerCase().includes(q) ||
        entry.route.toLowerCase().includes(q) ||
        entry.goods.toLowerCase().includes(q) ||
        entry.hsCode.toLowerCase().includes(q) ||
        entry.originCountry.toLowerCase().includes(q)
      );
    });
  }, [customsEntries, tradeFilter, searchQuery]);

  const selectedEntry = useMemo(
    () =>
      customsEntries.find((e) => e.id === selectedId) ??
      filteredEntries[0] ??
      null,
    [customsEntries, selectedId, filteredEntries]
  );

  // Helper to resolve active date-based practice rate rule
  const applyDateRulesIfEnabled = (origin: string, date: string) => {
    if (!sAutoApplyDateRules) return;
    const isChina = origin.trim().toLowerCase() === 'china';
    const matchingChinaRule = tariffRules
      .filter(
        (r) =>
          r.rateKind === 'Additional China Practice Tariff' &&
          r.effectiveDate <= date &&
          (!r.endDate || r.endDate >= date)
      )
      .sort((a, b) => b.version - a.version)[0];
    if (isChina && matchingChinaRule) {
      setSChinaPct(String((matchingChinaRule.rateDecimal * 100).toFixed(1).replace(/\.0$/, '')));
    } else if (!isChina) {
      setSChinaPct('0');
    }
  };

  const openAddShipment = () => {
    setEditingShipment(null);
    setSId(`E-${customsEntries.length + 1}`);
    setSDate('2026-09-25');
    setSOrigin('Germany');
    setSDest('Guelph');
    setSIncoterm('');
    setSGoods('Precision hydraulic valves');
    setSHs('8481');
    setSDeclared('100000');
    setSNormalPct('2');
    setSChinaPct('0');
    setSExportPct('0');
    setSAutoApplyDateRules(true);
    setSFtaStatus('Unverified / Non-FTA');
    setSFtaDoc(false);
    setSBilledBroker('400');
    setSContractPct('0.2');
    setSEvidence('Scenario shipment added for customs & broker testing.');
    setSNotes('');
    setShipmentError(null);
    setShowShipmentModal(true);
  };

  const openEditShipment = (entry: CustomsEntry) => {
    setEditingShipment(entry);
    setSId(entry.id);
    setSDate(entry.date);
    setSOrigin(entry.originCountry);
    setSDest(entry.destination);
    setSIncoterm(entry.incoterm ?? '');
    setSGoods(entry.goods);
    setSHs(entry.hsCode);
    setSDeclared(String(entry.declaredValue));
    setSNormalPct(String((entry.normalDutyRate * 100).toFixed(2).replace(/\.00$/, '')));
    setSChinaPct(String((entry.chinaAdditionalTariffRate * 100).toFixed(2).replace(/\.00$/, '')));
    setSExportPct(String((entry.exportDutyRate * 100).toFixed(2).replace(/\.00$/, '')));
    setSAutoApplyDateRules(false);
    setSFtaStatus(entry.ftaStatus);
    setSFtaDoc(entry.ftaDocumented);
    setSBilledBroker(String(entry.billedBrokerFee));
    setSContractPct(String((entry.contractBrokerRate * 100).toFixed(2).replace(/\.00$/, '')));
    setSEvidence(entry.evidence);
    setSNotes(entry.notes);
    setShipmentError(null);
    setShowShipmentModal(true);
  };

  const buildValidatedShipment = (
    id: string,
    provenance: CustomsEntry['provenance']
  ): CustomsEntry | string => {
    const cleanId = id.trim().toUpperCase();
    const declaredValue = Number(sDeclared);
    const normalRate = Number(sNormalPct) / 100;
    const chinaRate = Number(sChinaPct) / 100;
    const exportRate = Number(sExportPct) / 100;
    const billedBrokerFee = Number(sBilledBroker);
    const contractRate = Number(sContractPct) / 100;

    if (!cleanId) return 'Unique Shipment ID is required.';
    if (!editingShipment && customsEntries.some((c) => c.id.toUpperCase() === cleanId)) {
      return `Shipment ID "${cleanId}" already exists.`;
    }
    if (!sOrigin.trim() || !sDest.trim() || !sGoods.trim()) {
      return 'Origin, destination, and goods description are required.';
    }
    if (!Number.isFinite(declaredValue) || declaredValue <= 0) {
      return 'Declared value must be greater than zero.';
    }
    if (
      !Number.isFinite(normalRate) ||
      normalRate < 0 ||
      !Number.isFinite(chinaRate) ||
      chinaRate < 0 ||
      !Number.isFinite(exportRate) ||
      exportRate < 0 ||
      !Number.isFinite(billedBrokerFee) ||
      billedBrokerFee < 0 ||
      !Number.isFinite(contractRate) ||
      contractRate < 0
    ) {
      return 'All rates and broker fees must be valid non-negative numbers.';
    }

    const isChinaAdditionalTariff =
      sOrigin.trim().toLowerCase() === 'china' && chinaRate > 0;
    const normalDutyAmount = Math.round(declaredValue * normalRate);
    const chinaAdditionalTariffAmount = isChinaAdditionalTariff
      ? Math.round(declaredValue * chinaRate)
      : 0;
    const exportDutyAmount = Math.round(declaredValue * exportRate);
    const assessedDutyAndTariffs =
      normalDutyAmount + chinaAdditionalTariffAmount + exportDutyAmount;

    const expectedBrokerFee = Math.round(declaredValue * contractRate);
    const brokerVariance = Math.round(billedBrokerFee - expectedBrokerFee);
    const brokerStatus: CustomsEntry['brokerStatus'] =
      brokerVariance > 0
        ? 'Overcharge'
        : brokerVariance < 0
        ? 'Undercharge'
        : 'Compliant';

    const potentialMissedClaimDuty =
      sFtaStatus === 'Potential Eligible / Unclaimed' ? normalDutyAmount : 0;

    const policyParts: string[] = [];
    if (sFtaStatus === 'Agreement Claimed' && normalRate === 0) {
      policyParts.push('0% Agreement Claimed');
    } else {
      policyParts.push(`${(normalRate * 100).toFixed(1).replace(/\.0$/, '')}% normal`);
    }
    if (isChinaAdditionalTariff) {
      policyParts.push(`${(chinaRate * 100).toFixed(1).replace(/\.0$/, '')}% ADDITIONAL`);
    }
    if (exportRate > 0) {
      policyParts.push(`${(exportRate * 100).toFixed(1).replace(/\.0$/, '')}% EXPORT duty`);
    }

    return {
      id: cleanId,
      provenance,
      date: sDate,
      route: `${sOrigin.trim()} -> ${sDest.trim()}${sIncoterm ? `, ${sIncoterm}` : ''}`,
      originCountry: sOrigin.trim(),
      destination: sDest.trim(),
      incoterm: sIncoterm.trim() || undefined,
      isChinaAdditionalTariff,
      goods: sGoods.trim(),
      hsCode: sHs.trim() || 'Not provided',
      declaredValue,
      normalDutyRate: normalRate,
      chinaAdditionalTariffRate: isChinaAdditionalTariff ? chinaRate : 0,
      exportDutyRate: exportRate,
      dutyPolicyLabel: policyParts.join(' + '),
      normalDutyAmount,
      chinaAdditionalTariffAmount,
      exportDutyAmount,
      assessedDutyAndTariffs,
      contractBrokerRate: contractRate,
      expectedBrokerFee,
      billedBrokerFee,
      brokerVariance,
      brokerStatus,
      ftaStatus: sFtaStatus,
      ftaDocumented: sFtaDoc,
      potentialMissedClaimDuty,
      evidence: sEvidence.trim() || 'User-entered working scenario shipment.',
      notes: sNotes.trim() || 'Do not infer FTA qualification from country alone without documentation.',
    };
  };

  const handleSaveShipment = (e: React.FormEvent) => {
    e.preventDefault();
    const built = buildValidatedShipment(
      sId,
      editingShipment?.provenance ?? 'User-added scenario'
    );
    if (typeof built === 'string') {
      setShipmentError(built);
      return;
    }
    if (editingShipment) {
      onEditShipment(editingShipment.id, built);
    } else {
      onAddShipment(built);
      setSelectedId(built.id);
    }
    setShowShipmentModal(false);
  };

  // RFC-4180 CSV Shipment Preview with row/column errors, malformed quote detection & duplicate checks
  const csvPreview = useMemo(() => {
    const { headers, rows, headerQuoteErrors } = parseCsvWithHeaders(csvText);
    if (headers.length === 0 || rows.length === 0) return [];
    const existingIds = new Set(customsEntries.map((c) => c.id.toUpperCase()));
    const existingFingerprints = new Set(
      customsEntries.map(
        (c) =>
          `${c.date}|${c.originCountry.toLowerCase()}|${c.destination.toLowerCase()}|${c.goods.toLowerCase()}|${c.declaredValue}`
      )
    );
    const seen = new Set<string>();
    const seenFingerprints = new Set<string>();

    return rows.map((row) => {
      const [
        id = '',
        date = '',
        originCountry = '',
        destination = '',
        goods = '',
        hsCode = '',
        declaredStr = '',
        normalPctStr = '0',
        chinaPctStr = '0',
        exportPctStr = '0',
        ftaClaimedStr = 'false',
        billedBrokerStr = '0',
        contractPctStr = '0.2',
        notes = '',
      ] = row.fields;

      const errors: string[] = [
        ...(headerQuoteErrors ?? []),
        ...(row.quoteErrors ?? []),
      ];
      const cleanId = id.trim().toUpperCase();
      if (!cleanId) {
        errors.push(`Row ${row.rowNum}, Column "id": Missing ID.`);
      } else {
        if (existingIds.has(cleanId)) {
          errors.push(`Row ${row.rowNum}, Column "id": Duplicate ID "${cleanId}" already exists.`);
        }
        if (seen.has(cleanId)) {
          errors.push(`Row ${row.rowNum}, Column "id": Duplicate ID "${cleanId}" within CSV.`);
        }
        seen.add(cleanId);
      }

      if (!originCountry.trim()) {
        errors.push(`Row ${row.rowNum}, Column "originCountry": Origin country is required.`);
      }
      if (!destination.trim()) {
        errors.push(`Row ${row.rowNum}, Column "destination": Destination is required.`);
      }
      if (!goods.trim()) {
        errors.push(`Row ${row.rowNum}, Column "goods": Goods description is required.`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
        errors.push(`Row ${row.rowNum}, Column "date": Invalid date "${date}" (expected YYYY-MM-DD).`);
      }

      const declaredRes = parseCsvNumber(declaredStr);
      const normalRes = parseCsvNumber(normalPctStr || '0');
      const chinaRes = parseCsvNumber(chinaPctStr || '0');
      const exportRes = parseCsvNumber(exportPctStr || '0');
      const billedRes = parseCsvNumber(billedBrokerStr || '0');
      const contractRes = parseCsvNumber(contractPctStr || '0.2');

      if (!declaredRes.valid || declaredRes.value <= 0) {
        errors.push(`Row ${row.rowNum}, Column "declaredValue": ${declaredRes.valid ? 'Must be > 0' : declaredRes.error}.`);
      }
      if (!normalRes.valid || normalRes.value < 0) {
        errors.push(`Row ${row.rowNum}, Column "normalDutyPct": ${normalRes.valid ? 'Cannot be negative' : normalRes.error}.`);
      }
      if (!chinaRes.valid || chinaRes.value < 0) {
        errors.push(`Row ${row.rowNum}, Column "chinaExtraPct": ${chinaRes.valid ? 'Cannot be negative' : chinaRes.error}.`);
      }
      if (!exportRes.valid || exportRes.value < 0) {
        errors.push(`Row ${row.rowNum}, Column "exportDutyPct": ${exportRes.valid ? 'Cannot be negative' : exportRes.error}.`);
      }
      if (!billedRes.valid || billedRes.value < 0) {
        errors.push(`Row ${row.rowNum}, Column "billedBrokerFee": ${billedRes.valid ? 'Cannot be negative' : billedRes.error}.`);
      }
      if (!contractRes.valid || contractRes.value < 0) {
        errors.push(`Row ${row.rowNum}, Column "contractBrokerPct": ${contractRes.valid ? 'Cannot be negative' : contractRes.error}.`);
      }

      const declaredValue = declaredRes.value;
      if (
        originCountry.trim() &&
        destination.trim() &&
        goods.trim() &&
        /^\d{4}-\d{2}-\d{2}$/.test(date.trim()) &&
        declaredRes.valid &&
        declaredValue > 0
      ) {
        const fp = `${date.trim()}|${originCountry.trim().toLowerCase()}|${destination.trim().toLowerCase()}|${goods.trim().toLowerCase()}|${declaredValue}`;
        if (existingFingerprints.has(fp)) {
          errors.push(`Row ${row.rowNum}, Column "date/route/declaredValue": Duplicate shipment fingerprint detected against existing ledger.`);
        } else if (seenFingerprints.has(fp)) {
          errors.push(`Row ${row.rowNum}, Column "date/route/declaredValue": Duplicate shipment repeated inside CSV.`);
        }
        seenFingerprints.add(fp);
      }

      const normalRate = normalRes.value / 100;
      const chinaRate = chinaRes.value / 100;
      const exportRate = exportRes.value / 100;
      const billedBrokerFee = billedRes.value;
      const contractRate = contractRes.value / 100;

      let parsed: CustomsEntry | undefined;
      if (errors.length === 0) {
        const isChina = originCountry.trim().toLowerCase() === 'china' && chinaRate > 0;
        const normalAmt = Math.round(declaredValue * normalRate);
        const chinaAmt = isChina ? Math.round(declaredValue * chinaRate) : 0;
        const exportAmt = Math.round(declaredValue * exportRate);
        const expected = Math.round(declaredValue * contractRate);
        const variance = Math.round(billedBrokerFee - expected);
        const ftaClaimed = ftaClaimedStr.trim().toLowerCase() === 'true';

        parsed = {
          id: cleanId,
          provenance: 'User-added scenario',
          date: date.trim(),
          route: `${originCountry.trim()} -> ${destination.trim()}`,
          originCountry: originCountry.trim(),
          destination: destination.trim(),
          isChinaAdditionalTariff: isChina,
          goods: goods.trim(),
          hsCode: hsCode.trim() || 'Not provided',
          declaredValue,
          normalDutyRate: normalRate,
          chinaAdditionalTariffRate: isChina ? chinaRate : 0,
          exportDutyRate: exportRate,
          dutyPolicyLabel: `${(normalRate * 100).toFixed(1)}% normal${isChina ? ` + ${(chinaRate * 100).toFixed(1)}% ADDITIONAL` : ''}`,
          normalDutyAmount: normalAmt,
          chinaAdditionalTariffAmount: chinaAmt,
          exportDutyAmount: exportAmt,
          assessedDutyAndTariffs: normalAmt + chinaAmt + exportAmt,
          contractBrokerRate: contractRate,
          expectedBrokerFee: expected,
          billedBrokerFee,
          brokerVariance: variance,
          brokerStatus:
            variance > 0 ? 'Overcharge' : variance < 0 ? 'Undercharge' : 'Compliant',
          ftaStatus: ftaClaimed ? 'Agreement Claimed' : 'Unverified / Non-FTA',
          ftaDocumented: ftaClaimed,
          potentialMissedClaimDuty: 0,
          evidence: 'CSV shipment ingestion record.',
          notes: notes || 'Imported via demo CSV.',
        };
      }

      return { rowNum: row.rowNum, rawId: cleanId || '(no ID)', valid: errors.length === 0, errors, parsed };
    });
  }, [csvText, customsEntries]);

  const validCsvShipments = csvPreview
    .filter((r) => r.valid && r.parsed)
    .map((r) => r.parsed!);

  const openNewRuleModal = () => {
    setEditingRule(null);
    setRScope('China');
    setRHs('8501 / 8537');
    setRKind('Additional China Practice Tariff');
    setRRatePct('25');
    setREffDate('2026-01-01');
    setREndDate('');
    setRNote('');
    setRConfirmPreview(false);
    setShowRuleModal(true);
  };

  const openEditRuleModal = (rule: TariffRateRule) => {
    setEditingRule(rule);
    setRScope(rule.countryOrScope);
    setRHs(rule.goodsOrHsFilter);
    setRKind(rule.rateKind);
    setRRatePct(String((rule.rateDecimal * 100).toFixed(2).replace(/\.00$/, '')));
    setREffDate(rule.effectiveDate);
    setREndDate(rule.endDate ?? '');
    setRNote(rule.sourceNote);
    setRConfirmPreview(false);
    setShowRuleModal(true);
  };

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    const rateDec = Number(rRatePct) / 100;
    if (!Number.isFinite(rateDec) || rateDec < 0 || !rConfirmPreview) return;
    onSaveRuleWithImpact(
      proposedRuleDraft,
      ruleImpactPreview,
      rChangedBy.trim() || 'Marco (Trade & Customs Lead)',
      rApplyToWorking
    );
    setShowRuleModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Fictional Case Disclaimer + Action Toolbar */}
      <div className="rounded-xl bg-white border border-stone-200 px-5 py-4 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3 max-w-3xl">
          <Info className="h-4 w-4 text-[#F04F25] shrink-0 mt-0.5" />
          <p className="text-xs text-stone-600 leading-relaxed">
            <span className="font-semibold text-[#222222]">Fictional Practice Assumptions ({APPENDIX_SECTIONS.TRADE_SUMMARY}–{APPENDIX_SECTIONS.TRADE_TRENDS}):</span>{' '}
            Strictly separates (1) immutable Historical Q3 Recorded Charges (CAD $736,770), (2) Current Active Rule Expectations ({formatCAD(activeRulesExpectedTotal)}), and (3) Hypothetical China Scenarios. External tariff movements are NOT software ROI savings.
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
            onClick={openAddShipment}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#F04F25] px-4 py-2 text-xs font-semibold text-white hover:bg-[#D9421B]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Shipment</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation: Shipments Audit vs. Practice-Rate Administration */}
      <div className="flex items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 rounded-lg bg-white border border-stone-200 p-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('ledger')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md ${
              activeSubTab === 'ledger'
                ? 'bg-[#FFF3ED] text-[#D9421B] font-semibold'
                : 'text-stone-600 hover:text-[#222222]'
            }`}
          >
            Customs & Broker Audit ({customsEntries.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('rates')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md ${
              activeSubTab === 'rates'
                ? 'bg-[#FFF3ED] text-[#D9421B] font-semibold'
                : 'text-stone-600 hover:text-[#222222]'
            }`}
          >
            Practice-Rate & Contract Admin ({tariffRules.length})
          </button>
        </div>
        <span className="text-xs text-stone-500 font-mono">
          Broker Formula: expected = declared_value &times; 0.002
        </span>
      </div>

      {/* Trade KPI Summary (Baseline vs Working State) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs">
          <div className="text-xs font-medium text-stone-500">
            Declared Value & Duty / Tariffs
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-[#222222]">
            {formatCAD(summary.working.totalDuty)}
          </div>
          <div className="mt-1.5 text-xs text-stone-500 font-mono tabular-nums">
            Declared {formatCAD(summary.working.declared)} · Normal {formatCAD(summary.working.normalDuty)} · China Extra {formatCAD(summary.working.chinaExtra)} · Export {formatCAD(summary.working.exportDuty)}
          </div>
        </div>

        <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs">
          <div className="text-xs font-medium text-stone-500">
            All-In Duty + Tariff + Broker
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-[#222222]">
            {formatCAD(summary.working.allIn)}
          </div>
          <div className="mt-1.5 text-xs text-stone-500 font-mono tabular-nums">
            Official Baseline: {formatCAD(summary.baseline.allIn)} (Q3 25: $312K)
          </div>
        </div>

        <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs">
          <div className="text-xs font-medium text-stone-500">
            Net Broker Excess vs. 0.2%
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-[#F04F25]">
            {formatCAD(summary.working.netExcess)}
          </div>
          <div className="mt-1.5 text-xs text-stone-500 font-mono tabular-nums">
            Billed {formatCAD(summary.working.billedBroker)} vs Exp {formatCAD(summary.working.expectedBroker)} (Gross +{formatCAD(summary.working.grossOver)} / Under -{formatCAD(summary.working.grossUnder)})
          </div>
        </div>

        <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs">
          <div className="text-xs font-medium text-stone-500">
            Possible Missed Agreement Claim
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-amber-700">
            {formatCAD(CASE_CONSTANTS.POTENTIAL_MISSED_CUSMA_E08_CAD)}
          </div>
          <div className="mt-1.5 text-xs text-stone-500">
            E-08 (Mexico) · Conditional on origin docs, NOT guaranteed refund
          </div>
        </div>
      </section>

      {activeSubTab === 'rates' ? (
        /* Practice-Rate & Contract Administration View */
        <div className="space-y-6">
          <section className="rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 pb-4">
              <div>
                <h2 className="text-base font-semibold text-[#222222]">
                  Date-Stamped Practice Tariff &amp; Broker Contract Rules ({APPENDIX_SECTIONS.CUSTOMS_ENTRIES}–{APPENDIX_SECTIONS.COMPANY_RULES})
                </h2>
                <p className="mt-1 text-xs text-stone-500">
                  Preview affected shipments and CAD delta before confirming any rule update. Locked Q3 2026 historical recorded charges remain preserved separately.
                </p>
              </div>
              <button
                type="button"
                onClick={openNewRuleModal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#333333] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#222222]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Rate Rule Version</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-[#FAFAFA] text-stone-500 font-medium">
                    <th className="py-3 px-4">Rule ID &amp; Ver</th>
                    <th className="py-3 px-4">Rate Kind</th>
                    <th className="py-3 px-4">Scope / HS Filter</th>
                    <th className="py-3 px-4 text-right">Rate</th>
                    <th className="py-3 px-4">Effective Window</th>
                    <th className="py-3 px-4">Provenance &amp; Note</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {tariffRules.map((r) => (
                    <tr key={r.id}>
                      <td className="py-3 px-4 font-mono">
                        <div className="font-semibold text-[#222222]">{r.id}</div>
                        <div className="text-[11px] text-stone-500">v{r.version}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-[#222222]">{r.rateKind}</td>
                      <td className="py-3 px-4 text-stone-600">
                        {r.countryOrScope} · {r.goodsOrHsFilter}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-[#F04F25]">
                        {(r.rateDecimal * 100).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-600">
                        {r.effectiveDate} &rarr; {r.endDate ?? 'Open'}
                      </td>
                      <td className="py-3 px-4 text-stone-600">
                        <div className="font-medium text-[#333333]">{r.provenance}</div>
                        <div>{r.sourceNote}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEditRuleModal(r)}
                          className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2.5 py-1 text-[11px] font-medium text-[#333333] hover:bg-[#F6F5F3]"
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>Edit / Update</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Persistent Practice-Rate Rule Change Log */}
          <section className="rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-3">
            <h3 className="text-sm font-semibold text-[#222222]">
              Practice-Rate Rule Change Log ({tariffRuleChangelog.length})
            </h3>
            {tariffRuleChangelog.length === 0 ? (
              <p className="text-xs text-stone-500">
                No rule updates confirmed yet in this session. Updating or adding a rate rule logs old vs. new rate, affected shipments, and expected CAD cost delta here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 bg-[#FAFAFA] text-stone-500">
                      <th className="py-2.5 px-3">Timestamp / User</th>
                      <th className="py-2.5 px-3">Rule &amp; Scope</th>
                      <th className="py-2.5 px-3 text-right">Old &rarr; New</th>
                      <th className="py-2.5 px-3">Affected Shipments</th>
                      <th className="py-2.5 px-3 text-right">Expected Δ (CAD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {tariffRuleChangelog.map((log) => (
                      <tr key={log.id}>
                        <td className="py-2.5 px-3">
                          <div className="font-mono text-[#222222]">{log.timestamp}</div>
                          <div className="text-[11px] text-stone-500">{log.changedBy}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-[#222222]">
                            {log.ruleId} · {log.rateKind}
                          </div>
                          <div className="text-[11px] text-stone-500">
                            {log.countryOrScope} · Eff {log.effectiveDate}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {log.oldRateDecimal !== null
                            ? `${(log.oldRateDecimal * 100).toFixed(2)}%`
                            : 'New'}{' '}
                          &rarr; {(log.newRateDecimal * 100).toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3 font-mono text-stone-600">
                          {log.affectedShipmentIds.join(', ') || 'None in window'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#F04F25]">
                          {formatSignedCAD(log.expectedCostDeltaCAD)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : (
        <>
          {/* China Additional Tariff Scenario Simulator */}
          <section className="rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-stone-100">
              <div>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-[#F04F25]" />
                  <h2 className="text-base font-semibold text-[#222222]">
                    Additional China Practice Tariff Scenario Simulator (E-04, E-05, E-06)
                  </h2>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  Applies exclusively to China additional-tariff entries ({simulation.chinaCount} shipments, {formatCAD(simulation.chinaDeclaredValueQ3)}/quarter). Ordinary motor MFN duty ({formatCAD(simulation.ordinaryChinaMotorDutyQ3)}/qtr) stays separate and unchanged. Does NOT mutate historical actuals.
                </p>
              </div>

              <div
                role="group"
                aria-label="China additional tariff presets"
                className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-[#F6F5F3] p-1 shrink-0"
              >
                {[
                  { pct: 0, label: '0% (CUSMA Shift)' },
                  { pct: 15, label: '15% Scenario' },
                  { pct: 25, label: '25% Baseline' },
                  { pct: 35, label: '35% Scenario' },
                ].map((preset) => (
                  <button
                    key={preset.pct}
                    type="button"
                    onClick={() => onChangeChinaScenarioPct(preset.pct)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      chinaScenarioPct === preset.pct
                        ? 'bg-[#F04F25] text-white font-semibold'
                        : 'text-[#333333] hover:bg-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-stone-700">
                    Simulated Additional China Tariff Rate
                  </span>
                  <span className="font-mono font-semibold text-[#F04F25] text-sm tabular-nums">
                    {chinaScenarioPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={1}
                  value={chinaScenarioPct}
                  onChange={(e) => onChangeChinaScenarioPct(Number(e.target.value))}
                  aria-label="Adjust China additional tariff percentage"
                  className="w-full accent-[#F04F25] cursor-pointer"
                />
                <div className="flex justify-between text-[11px] font-mono text-stone-400">
                  <span>0%</span>
                  <span>15%</span>
                  <span>25% Base</span>
                  <span>35%</span>
                  <span>50%</span>
                </div>
              </div>

              <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-lg bg-[#FAFAFA] border border-stone-200 p-3.5">
                  <div className="text-[11px] text-stone-500">Q3 China Extra Tariff</div>
                  <div className="mt-1 text-base font-semibold font-mono tabular-nums text-[#222222]">
                    {formatCAD(simulation.simulatedChinaAdditionalTariffQ3)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-stone-500">
                    Base 25%: {formatCAD(simulation.baselineChinaAdditionalTariffQ3)}
                  </div>
                </div>

                <div className="rounded-lg bg-[#FAFAFA] border border-stone-200 p-3.5">
                  <div className="text-[11px] text-stone-500">Quarterly Delta</div>
                  <div
                    className={`mt-1 text-base font-semibold font-mono tabular-nums ${
                      simulation.quarterlyDelta > 0
                        ? 'text-red-700'
                        : simulation.quarterlyDelta < 0
                        ? 'text-emerald-700'
                        : 'text-[#222222]'
                    }`}
                  >
                    {formatSignedCAD(simulation.quarterlyDelta)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-stone-500">vs. 25% baseline</div>
                </div>

                <div className="rounded-lg bg-[#FAFAFA] border border-stone-200 p-3.5">
                  <div className="text-[11px] text-stone-500">Annualized Impact (4Q)</div>
                  <div
                    className={`mt-1 text-base font-semibold font-mono tabular-nums ${
                      simulation.annualizedDelta > 0
                        ? 'text-red-700'
                        : simulation.annualizedDelta < 0
                        ? 'text-emerald-700'
                        : 'text-[#222222]'
                    }`}
                  >
                    {formatSignedCAD(simulation.annualizedDelta)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-stone-500">Constant quarterly vol</div>
                </div>

                <div className="rounded-lg bg-[#FAFAFA] border border-stone-200 p-3.5">
                  <div className="text-[11px] text-stone-500">All-In Q3 Trade Total</div>
                  <div className="mt-1 text-base font-semibold font-mono tabular-nums text-[#222222]">
                    {formatCAD(simulation.simulatedTotalTradeCostQ3)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-stone-500">
                    Base: {formatCAD(simulation.baselineTotalTradeCostQ3)}
                  </div>
                </div>
              </div>
            </div>

            {chinaScenarioPct === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
                0% Scenario Assumption: Reflects -$525,000/quarter (-$2,100,000/year) extra tariff reduction IF a supplier actually qualifies for CUSMA — BEFORE supplier-switching or qualification costs. Do not treat as guaranteed savings.
              </div>
            )}
          </section>

          {/* Shipments Table */}
          <section className="rounded-xl bg-white border border-stone-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-stone-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="h-4 w-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ID, route, HS code, goods, or origin..."
                  aria-label="Search customs shipments"
                  className="w-full rounded-lg border border-stone-200 bg-[#FAFAFA] pl-9 pr-3 py-2 text-sm text-[#222222] focus:bg-white focus:border-[#F04F25] focus:outline-none"
                />
              </div>

              <div
                role="group"
                aria-label="Shipment filter"
                className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-[#F6F5F3] p-1"
              >
                {(
                  [
                    { id: 'all', label: `All (${customsEntries.length})` },
                    { id: 'overcharge', label: 'Overcharges' },
                    { id: 'undercharge', label: 'Undercharges' },
                    { id: 'missed_fta', label: 'Possible Missed FTA (E-08)' },
                    { id: 'china_tariff', label: 'China 25% Extra' },
                    { id: 'user_added', label: 'User Added' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTradeFilter(tab.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      tradeFilter === tab.id
                        ? 'bg-white text-[#222222] shadow-2xs font-semibold'
                        : 'text-stone-600 hover:text-[#222222]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-[#FAFAFA] text-xs font-medium text-stone-500">
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Route & Goods (HS)</th>
                    <th className="py-3 px-4 text-right">Declared Value</th>
                    <th className="py-3 px-4">Duty Policy</th>
                    <th className="py-3 px-4 text-right">Assessed Duty</th>
                    <th className="py-3 px-4 text-right">Exp (0.2%)</th>
                    <th className="py-3 px-4 text-right">Billed Fee</th>
                    <th className="py-3 px-4 text-right">Broker Var</th>
                    <th className="py-3 px-4">Agreement Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs">
                  {filteredEntries.map((entry) => {
                    const isSelected = selectedEntry?.id === entry.id;
                    return (
                      <tr
                        key={entry.id}
                        onClick={() => setSelectedId(entry.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#FFF3ED]' : 'hover:bg-[#FAFAFA]'
                        }`}
                      >
                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          <div className="font-mono font-semibold text-[#222222]">
                            {entry.id}
                          </div>
                          <div className="text-[11px] text-stone-500">
                            {entry.provenance === 'Official case baseline'
                              ? 'Baseline'
                              : 'Scenario'}
                          </div>
                        </td>
                        <td className="py-3 px-4 align-top min-w-[200px]">
                          <div className="font-medium text-[#222222]">{entry.route}</div>
                          <div className="text-stone-500">
                            {entry.goods} · HS <span className="font-mono">{entry.hsCode}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 align-top text-right whitespace-nowrap font-mono tabular-nums text-[#222222]">
                          {formatCAD(entry.declaredValue)}
                        </td>
                        <td className="py-3 px-4 align-top text-stone-700 whitespace-nowrap">
                          {entry.dutyPolicyLabel}
                        </td>
                        <td className="py-3 px-4 align-top text-right whitespace-nowrap font-mono tabular-nums font-medium text-[#222222]">
                          {formatCAD(entry.assessedDutyAndTariffs)}
                        </td>
                        <td className="py-3 px-4 align-top text-right whitespace-nowrap font-mono tabular-nums text-stone-600">
                          {formatCAD(entry.expectedBrokerFee)}
                        </td>
                        <td className="py-3 px-4 align-top text-right whitespace-nowrap font-mono tabular-nums text-[#222222]">
                          {formatCAD(entry.billedBrokerFee)}
                        </td>
                        <td className="py-3 px-4 align-top text-right whitespace-nowrap font-mono tabular-nums">
                          {entry.brokerVariance > 0 ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span>+{formatCAD(entry.brokerVariance)}</span>
                            </span>
                          ) : entry.brokerVariance < 0 ? (
                            <span className="font-semibold text-stone-700">
                              -{formatCAD(Math.abs(entry.brokerVariance))} Under
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>$0</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 align-top whitespace-nowrap">
                          <span
                            className={`font-medium ${
                              entry.ftaStatus === 'Agreement Claimed'
                                ? 'text-emerald-700'
                                : entry.ftaStatus === 'Potential Eligible / Unclaimed'
                                ? 'text-amber-700'
                                : 'text-stone-500'
                            }`}
                          >
                            {entry.ftaStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {selectedEntry && (
              <div className="border-t border-stone-200 bg-[#FAFAFA] px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="font-semibold text-[#222222]">
                    {selectedEntry.id} · {selectedEntry.route} · {selectedEntry.goods} (HS {selectedEntry.hsCode})
                  </div>
                  <p className="text-stone-600">{selectedEntry.evidence}</p>
                  <p className="text-stone-500">{selectedEntry.notes}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedEntry.provenance === 'User-added scenario' && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditShipment(selectedEntry)}
                        className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 font-medium text-[#333333] hover:bg-stone-50"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                      {confirmDeleteId === selectedEntry.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteShipment(selectedEntry.id);
                            setConfirmDeleteId(null);
                            setSelectedId('E-04');
                          }}
                          className="rounded-lg bg-red-700 px-3 py-1.5 font-semibold text-white"
                        >
                          Confirm Delete
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(selectedEntry.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 font-medium text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* 8-Quarter Trade Escalation & Incoterms DDP vs DAP Explainer */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-3">
              <h3 className="text-sm font-semibold text-[#222222]">
                8-Quarter Duty, Tariff & Broker Cost Trajectory (CAD Thousands)
              </h3>
              <p className="text-xs text-stone-500">
                Spike alert: Q1 2026 additional China tariffs drove trade costs from $312K (Q3 2025) to $737K (Q3 2026) — approximately +CAD $425,000 YoY.
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-2">
                {HISTORICAL_QUARTERLY_SERIES.map((q) => {
                  const pct = (q.tradeCostsK / 750) * 100;
                  return (
                    <div key={q.quarter} className="flex flex-col items-center text-xs">
                      <div className="font-mono font-semibold text-[#222222] mb-1">
                        ${q.tradeCostsK}K
                      </div>
                      <div className="w-full h-24 bg-stone-100 rounded-md flex items-end overflow-hidden p-1">
                        <div
                          className={`w-full rounded-xs ${
                            q.quarter.includes('2026') ? 'bg-[#F04F25]' : 'bg-stone-500'
                          }`}
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-1.5 text-[10px] text-stone-600">{q.quarter}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-5 rounded-xl bg-white border border-stone-200 p-6 shadow-2xs space-y-3 text-xs">
              <h3 className="text-sm font-semibold text-[#222222]">
                Incoterms & Duty Responsibility (E-10 DDP vs. E-11 DAP)
              </h3>
              <div className="space-y-2.5 text-stone-600 leading-relaxed">
                <div className="rounded-lg bg-[#FAFAFA] border border-stone-200 p-3">
                  <div className="font-semibold text-[#222222]">
                    E-10 · Guelph &rarr; Brisbane, DDP (CAD $1,500,000 boom lifts)
                  </div>
                  <p className="mt-1">
                    Under <span className="font-semibold">DDP (Delivered Duty Paid)</span>, SKYJACK as seller assumes export/import duty obligations (4.0% = CAD $60,000) and clearance charges.
                  </p>
                </div>
                <div className="rounded-lg bg-[#FAFAFA] border border-stone-200 p-3">
                  <div className="font-semibold text-[#222222]">
                    E-11 · Guelph &rarr; Chicago, DAP (CAD $2,400,000 scissor lifts)
                  </div>
                  <p className="mt-1">
                    Under <span className="font-semibold">DAP (Delivered at Place)</span>, the buyer handles import duties/customs clearance; E-11 also reflects a -CAD $2,700 broker undercharge offsetting gross overcharges ($8,260 &rarr; $5,560 net).
                  </p>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Add / Edit Shipment Modal */}
      {showShipmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-white border border-stone-200 shadow-xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-base font-semibold text-[#222222]">
                {editingShipment ? `Edit Shipment (${editingShipment.id})` : 'Add Customs Shipment'}
              </h3>
              <button
                type="button"
                onClick={() => setShowShipmentModal(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveShipment} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Shipment ID *</span>
                  <input
                    type="text"
                    value={sId}
                    disabled={Boolean(editingShipment)}
                    onChange={(e) => setSId(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono disabled:bg-stone-100"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Date *</span>
                  <input
                    type="date"
                    value={sDate}
                    onChange={(e) => {
                      setSDate(e.target.value);
                      applyDateRulesIfEnabled(sOrigin, e.target.value);
                    }}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Declared Value (CAD) *</span>
                  <input
                    type="number"
                    min={1}
                    value={sDeclared}
                    onChange={(e) => setSDeclared(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Origin Country *</span>
                  <input
                    type="text"
                    value={sOrigin}
                    onChange={(e) => {
                      setSOrigin(e.target.value);
                      applyDateRulesIfEnabled(e.target.value, sDate);
                    }}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Destination *</span>
                  <input
                    type="text"
                    value={sDest}
                    onChange={(e) => setSDest(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Goods *</span>
                  <input
                    type="text"
                    value={sGoods}
                    onChange={(e) => setSGoods(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">HS Code</span>
                  <input
                    type="text"
                    value={sHs}
                    onChange={(e) => setSHs(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Normal Duty %</span>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={sNormalPct}
                    onChange={(e) => setSNormalPct(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">China Extra Tariff %</span>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={sChinaPct}
                    onChange={(e) => setSChinaPct(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Export Duty %</span>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={sExportPct}
                    onChange={(e) => setSExportPct(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Incoterm (opt)</span>
                  <input
                    type="text"
                    value={sIncoterm}
                    onChange={(e) => setSIncoterm(e.target.value)}
                    placeholder="DDP / DAP"
                    className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Billed Broker Fee (CAD) *</span>
                  <input
                    type="number"
                    min={0}
                    value={sBilledBroker}
                    onChange={(e) => setSBilledBroker(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Contract Broker % (Default 0.2)</span>
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    value={sContractPct}
                    onChange={(e) => setSContractPct(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">FTA Claim Status</span>
                  <select
                    value={sFtaStatus}
                    onChange={(e) => setSFtaStatus(e.target.value as FtaClaimStatus)}
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
                  >
                    <option value="Unverified / Non-FTA">Unverified / Non-FTA</option>
                    <option value="Agreement Claimed">Agreement Claimed</option>
                    <option value="Potential Eligible / Unclaimed">
                      Potential Eligible / Unclaimed
                    </option>
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-2 text-xs text-stone-700">
                <input
                  type="checkbox"
                  checked={sFtaDoc}
                  onChange={(e) => setSFtaDoc(e.target.checked)}
                  className="accent-[#F04F25]"
                />
                <span>Valid Certificate of Origin / FTA Documentation Verified on File</span>
              </label>

              {shipmentError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-red-700 font-medium">
                  {shipmentError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowShipmentModal(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2 font-medium text-[#333333]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#F04F25] px-4 py-2 font-semibold text-white hover:bg-[#D9421B]"
                >
                  {editingShipment ? 'Save Shipment' : 'Add & Calculate Variance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Shipment Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-xl bg-white border border-stone-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-base font-semibold text-[#222222]">
                  Demo CSV Shipment Ingestion & Validation
                </h3>
                <p className="text-xs text-stone-500">
                  Validate declared values, duty percentages, and 0.2% broker contract math before committing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([SAMPLE_SHIPMENT_CSV], {
                    type: 'text/csv;charset=utf-8;',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'skyguard_shipment_template.csv';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 font-medium text-[#333333]"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download CSV Template</span>
              </button>
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 font-medium text-[#333333] cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload .csv</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) file.text().then(setCsvText);
                  }}
                />
              </label>
            </div>

            <textarea
              rows={4}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full rounded-lg border border-stone-200 p-3 font-mono text-[11px]"
            />

            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#222222]">
                Validation Preview ({validCsvShipments.length} valid / {csvPreview.length} total rows — invalid rows are blocked and never silently discarded)
              </div>
              <div className="max-h-44 overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100 text-xs">
                {csvPreview.map((r) => (
                  <div
                    key={r.rowNum}
                    className={`p-2.5 flex justify-between gap-3 ${
                      r.valid ? 'bg-white' : 'bg-red-50'
                    }`}
                  >
                    <div>
                      <span className="font-mono font-semibold">
                        Row {r.rowNum}: {r.rawId}
                      </span>
                      {!r.valid && (
                        <div className="text-red-700 mt-0.5">{r.errors.join(' · ')}</div>
                      )}
                    </div>
                    <span className="font-mono shrink-0">
                      {r.valid && r.parsed ? formatCAD(r.parsed.declaredValue) : 'Invalid'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={validCsvShipments.length === 0}
                onClick={() => {
                  onBulkImportShipments(validCsvShipments);
                  setShowCsvModal(false);
                }}
                className="rounded-lg bg-[#F04F25] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Commit {validCsvShipments.length} Valid Shipment(s)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Tariff Rate Rule Modal with Affected Shipments Impact Preview */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-white border border-stone-200 shadow-xl p-6 space-y-4 my-8 text-xs">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-base font-semibold text-[#222222]">
                  {editingRule
                    ? `Update Practice-Rate Rule (${editingRule.id} -> v${editingRule.version + 1})`
                    : 'Add Fictional Practice-Rate Rule Version'}
                </h3>
                <p className="text-stone-500">
                  Review affected shipments and expected CAD delta below before confirming. Historical Q3 2026 baseline amounts remain immutable.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRuleModal(false)}
                className="p-1 text-stone-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Rate Kind</span>
                  <select
                    value={rKind}
                    onChange={(e) => setRKind(e.target.value as TariffRateRule['rateKind'])}
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
                  >
                    <option value="Additional China Practice Tariff">
                      Additional China Practice Tariff
                    </option>
                    <option value="Normal MFN">Normal MFN</option>
                    <option value="Export Duty">Export Duty</option>
                    <option value="Broker Contract">Broker Contract</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Changed By *</span>
                  <input
                    type="text"
                    value={rChangedBy}
                    onChange={(e) => setRChangedBy(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Country / Scope</span>
                  <input
                    type="text"
                    value={rScope}
                    onChange={(e) => setRScope(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Rate (%)</span>
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    value={rRatePct}
                    onChange={(e) => setRRatePct(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Effective Date</span>
                  <input
                    type="date"
                    value={rEffDate}
                    onChange={(e) => setREffDate(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">End Date (opt)</span>
                  <input
                    type="date"
                    value={rEndDate}
                    onChange={(e) => setREndDate(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">HS / Goods Filter</span>
                  <input
                    type="text"
                    value={rHs}
                    onChange={(e) => setRHs(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-medium text-stone-700">Source / Policy Note</span>
                  <input
                    type="text"
                    value={rNote}
                    onChange={(e) => setRNote(e.target.value)}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  />
                </label>
              </div>

              {/* Live Affected Shipments Impact Preview Table */}
              <div className="rounded-lg border border-stone-200 bg-[#FAF9F7] p-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[#222222]">
                    Impact Preview: {ruleImpactPreview.affectedCount} Affected Shipment(s)
                  </span>
                  <span className="font-mono font-semibold text-[#F04F25]">
                    Net Expected Delta: {formatSignedCAD(ruleImpactPreview.netDeltaCAD)}
                  </span>
                </div>
                {ruleImpactPreview.affectedEntries.length === 0 ? (
                  <div className="text-stone-500">
                    No existing shipments match this country/HS/effective-date window.
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto border border-stone-200 rounded bg-white">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-[#FAFAFA] border-b border-stone-200 text-stone-500">
                        <tr>
                          <th className="py-1.5 px-2.5">Entry</th>
                          <th className="py-1.5 px-2.5 text-right">Hist. Recorded</th>
                          <th className="py-1.5 px-2.5 text-right">Current Exp.</th>
                          <th className="py-1.5 px-2.5 text-right">Proposed Exp.</th>
                          <th className="py-1.5 px-2.5 text-right">Delta (CAD)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 font-mono">
                        {ruleImpactPreview.affectedEntries.map((row) => (
                          <tr key={row.entryId}>
                            <td className="py-1.5 px-2.5 font-semibold text-[#222222]">
                              {row.entryId} ({row.originCountry})
                            </td>
                            <td className="py-1.5 px-2.5 text-right text-stone-600">
                              {formatCAD(row.historicalRecordedCostCAD)}
                            </td>
                            <td className="py-1.5 px-2.5 text-right text-stone-600">
                              {formatCAD(row.currentRuleExpectedCostCAD)}
                            </td>
                            <td className="py-1.5 px-2.5 text-right text-[#222222]">
                              {formatCAD(row.proposedRuleExpectedCostCAD)}
                            </td>
                            <td
                              className={`py-1.5 px-2.5 text-right font-semibold ${
                                row.deltaCAD > 0
                                  ? 'text-red-700'
                                  : row.deltaCAD < 0
                                  ? 'text-emerald-700'
                                  : 'text-stone-500'
                              }`}
                            >
                              {formatSignedCAD(row.deltaCAD)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-stone-700">
                <input
                  type="checkbox"
                  checked={rApplyToWorking}
                  onChange={(e) => setRApplyToWorking(e.target.checked)}
                  className="accent-[#F04F25]"
                />
                <span>
                  Recalculate user-added working shipments matching this rule (Official Q3 baseline E-01..E-12 stay locked)
                </span>
              </label>

              <label className="flex items-center gap-2 font-medium text-[#222222]">
                <input
                  type="checkbox"
                  checked={rConfirmPreview}
                  onChange={(e) => setRConfirmPreview(e.target.checked)}
                  className="accent-[#F04F25]"
                />
                <span>
                  I reviewed the affected shipments above and confirm saving this rule version to the changelog.
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="rounded-lg border border-stone-200 px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!rConfirmPreview}
                  className="rounded-lg bg-[#F04F25] px-4 py-2 font-semibold text-white disabled:opacity-50"
                >
                  Confirm &amp; Save Rule Version
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
