import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Bot,
  Calculator,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  DEFAULT_PRESENTATION_ROI_ASSUMPTIONS,
  DEFAULT_ROI_ASSUMPTIONS,
  OFFICIAL_CUSTOMS_ENTRIES,
  OFFICIAL_INTERPROVINCIAL_DELIVERIES,
} from '../data/skyjackCaseData';
import type {
  AnalystMessage,
  CustomsEntry,
  InterprovincialDelivery,
  IrregularCostItem,
  NavSection,
  PeriodCloseApprovalRecord,
  PresentationROIYear1Assumptions,
  ROIAssumptions,
  ROIModelSelection,
  WalkLineOverride,
} from '../types/skyguard';
import {
  PRESET_ANALYST_QUESTIONS,
  buildDeterministicAnalystResponse,
} from '../utils/deterministicAnalyst';

interface AIFinancialAnalystProps {
  anomalies: IrregularCostItem[];
  customsEntries?: CustomsEntry[];
  interprovincialDeliveries?: InterprovincialDelivery[];
  walkLineOverrides?: Record<string, WalkLineOverride>;
  periodCloseApprovals?: Record<string, PeriodCloseApprovalRecord>;
  selectedRoiModel?: ROIModelSelection;
  presentationRoiAssumptions?: PresentationROIYear1Assumptions;
  roiAssumptions?: ROIAssumptions;
  onNavigate: (section: NavSection, selectedAnomalyId?: string) => void;
}

export const AIFinancialAnalyst: React.FC<AIFinancialAnalystProps> = ({
  anomalies,
  customsEntries = OFFICIAL_CUSTOMS_ENTRIES,
  interprovincialDeliveries = OFFICIAL_INTERPROVINCIAL_DELIVERIES,
  walkLineOverrides = {},
  periodCloseApprovals = {},
  selectedRoiModel = 'presentation_y1',
  presentationRoiAssumptions = DEFAULT_PRESENTATION_ROI_ASSUMPTIONS,
  roiAssumptions = DEFAULT_ROI_ASSUMPTIONS,
  onNavigate,
}) => {
  const [engineMode, setEngineMode] = useState<'deterministic' | 'gemini'>(
    'deterministic'
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState<AnalystMessage[]>(() => {
    const initial = buildDeterministicAnalystResponse(
      'Why did operating earnings change?',
      anomalies,
      customsEntries,
      interprovincialDeliveries,
      walkLineOverrides,
      periodCloseApprovals,
      selectedRoiModel,
      presentationRoiAssumptions,
      roiAssumptions
    );
    return [
      {
        id: 'msg-init-user',
        role: 'user',
        content: 'Why did operating earnings change?',
        timestamp: 'Official Case Query',
      },
      {
        id: 'msg-init-assistant',
        role: 'assistant',
        content: initial.answer,
        timestamp: 'Deterministic Case Engine',
        mode: 'deterministic',
        citations: initial.citations,
        calculations: initial.calculations,
      },
    ];
  });

  const handleAsk = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    const userMsg: AnalystMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Always compute deterministic verified facts & citations from live workspace state
    const det = buildDeterministicAnalystResponse(
      trimmed,
      anomalies,
      customsEntries,
      interprovincialDeliveries,
      walkLineOverrides,
      periodCloseApprovals,
      selectedRoiModel,
      presentationRoiAssumptions,
      roiAssumptions
    );

    if (engineMode === 'deterministic') {
      const assistantMsg: AnalystMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: det.answer,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        mode: 'deterministic',
        citations: det.citations,
        calculations: det.calculations,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      return;
    }

    // Live Gemini 4 Hydrogen synthesis grounded in live workspace state
    setLoading(true);
    try {
      const response = await fetch('/api/analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          anomalies,
          customsEntries,
          interprovincialDeliveries,
          periodCloseApprovals,
          selectedRoiModel,
          presentationRoiAssumptions,
          roiAssumptions,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: '',
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            mode: 'gemini',
            error: data.error || 'Live Gemini API request failed.',
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `gem-${Date.now()}`,
          role: 'assistant',
          content: data.answer,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          mode: 'gemini',
          citations: det.citations,
          calculations: det.calculations,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: '',
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          mode: 'gemini',
          error: 'Network error reaching /api/analyst.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAsk(input);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left Rail: Engine Mode, Preset Case Queries, Anti-Fabrication Guardrails */}
      <div className="xl:col-span-4 space-y-5">
        <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-[#222222]">
              Analysis Engine Mode
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Deterministic calculations run identically offline; optional Gemini 4 mode synthesizes prose strictly bounded to your live ledger.
            </p>
          </div>

          <div
            role="group"
            aria-label="Analysis engine mode"
            className="grid grid-cols-2 gap-1.5 rounded-lg bg-[#F6F5F3] p-1 border border-stone-200"
          >
            <button
              type="button"
              onClick={() => setEngineMode('deterministic')}
              className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-colors ${
                engineMode === 'deterministic'
                  ? 'bg-white text-[#222222] shadow-2xs border border-stone-200'
                  : 'text-stone-600 hover:text-[#222222]'
              }`}
            >
              <Calculator className="h-3.5 w-3.5" />
              <span>Deterministic</span>
            </button>
            <button
              type="button"
              onClick={() => setEngineMode('gemini')}
              className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-colors ${
                engineMode === 'gemini'
                  ? 'bg-[#F04F25] text-white shadow-2xs'
                  : 'text-stone-600 hover:text-[#222222]'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Live Gemini 4</span>
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs space-y-3">
          <h3 className="text-sm font-semibold text-[#222222]">
            Executive Case Questions
          </h3>
          <p className="text-xs text-stone-500">
            Click any benchmark query to inspect grounded Appendix citations and exact CAD calculations.
          </p>
          <div className="space-y-2 pt-1">
            {PRESET_ANALYST_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={loading}
                onClick={() => handleAsk(q)}
                className="w-full text-left rounded-lg border border-stone-200 px-3.5 py-2.5 text-xs font-medium text-[#333333] hover:border-[#F04F25] hover:bg-[#FFF8F5] transition-colors disabled:opacity-60 flex items-center justify-between gap-2"
              >
                <span>{q}</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-stone-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-white border border-stone-200 p-5 shadow-2xs space-y-2.5 text-xs text-stone-600">
          <div className="flex items-center gap-2 font-semibold text-[#222222]">
            <ShieldCheck className="h-4 w-4 text-[#F04F25]" />
            <span>Evidence & Anti-Fabrication Guardrails</span>
          </div>
          <ul className="space-y-1.5 list-disc pl-4">
            <li>Outputs cite exact Appendix sections (Section 1.1–4.1) and IDs (IR-01..IR-07, E-01..E-12, IP-01..IP-05).</li>
            <li>Source-confirmed CAD figures are strictly separated from unverified explanations (“Awaiting Verification” / “Needs investigation”) until human controller sign-off.</li>
            <li>Missing approvers/preparers are reported as “Not provided in case”.</li>
            <li>IR-01 (-$900K) and IR-02 (-$600K) are already in the YoY walk — never double-counted.</li>
            <li>Customer sales taxes ($799,525) stay separate from customs duty and expenses.</li>
            <li>If information is outside case evidence, the engine states “I don’t know from case data”.</li>
          </ul>
        </div>
      </div>

      {/* Right Column: Analyst Transcript & Query Console */}
      <div className="xl:col-span-8 rounded-xl bg-white border border-stone-200 shadow-2xs flex flex-col min-h-[620px] max-h-[80vh]">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#333333] text-white">
              <Bot className="h-4 w-4 text-[#F04F25]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#222222]">
                SKYGUARD Financial Intelligence Console
              </div>
              <div className="text-xs text-stone-500">
                Mode: {engineMode === 'deterministic' ? 'Deterministic Case Ledger Engine' : 'Live Gemini 4 Hydrogen (/api/analyst)'}
                {' · '}Human sign-off required before GL actions
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-3">
              {msg.role === 'user' ? (
                <div className="flex justify-end">
                  <div className="max-w-xl rounded-xl bg-[#333333] px-4 py-3 text-sm text-white">
                    <div className="text-[11px] text-stone-300 mb-1">
                      Finance Review Query · {msg.timestamp}
                    </div>
                    <div>{msg.content}</div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-stone-200 bg-[#FAF9F7] p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 border-b border-stone-200/70 pb-2.5">
                    <span className="font-semibold text-[#222222]">
                      {msg.mode === 'gemini'
                        ? 'AI Recommendation / Synthesis (Requires Verification Against Ledger)'
                        : 'Verified Source Facts & Deterministic Calculations'}
                    </span>
                    <span className="font-mono">{msg.timestamp}</span>
                  </div>

                  {msg.error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 flex items-start gap-2.5 text-xs text-red-800">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-semibold">Live AI Request Failed</div>
                        <div>{msg.error}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-[#333333] whitespace-pre-line leading-relaxed">
                      {msg.content}
                    </div>
                  )}

                  {msg.calculations && msg.calculations.length > 0 && (
                    <div className="pt-3 border-t border-stone-200/80">
                      <div className="text-[11px] font-semibold text-stone-500 mb-2">
                        Verified Deterministic Calculations (Independent of AI Text)
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {msg.calculations.map((calc) => (
                          <div
                            key={calc.label}
                            className="rounded-lg bg-white border border-stone-200 p-2.5"
                          >
                            <div className="text-[11px] text-stone-500 truncate">
                              {calc.label}
                            </div>
                            <div className="mt-0.5 text-xs font-semibold font-mono tabular-nums text-[#222222]">
                              {calc.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-2">
                      <div className="text-[11px] font-semibold text-stone-500 mb-2">
                        Cited Appendix / Scenario Records (Click to Open Module)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {msg.citations.map((cit) => (
                          <button
                            key={`${msg.id}-${cit.id}`}
                            type="button"
                            onClick={() =>
                              onNavigate(
                                cit.section,
                                cit.id.startsWith('IR-') && cit.id.length <= 6
                                  ? cit.id
                                  : undefined
                              )
                            }
                            className="text-left rounded-lg bg-white border border-stone-200 px-3 py-2 hover:border-[#F04F25] transition-colors flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0 truncate">
                              <span className="font-mono font-semibold text-[#F04F25]">
                                {cit.id}
                              </span>
                              <span className="text-stone-400 mx-1.5">·</span>
                              <span className="text-[#333333]">{cit.label}</span>
                            </div>
                            <span className="font-mono tabular-nums font-medium text-[#222222] shrink-0">
                              {cit.amountText}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-stone-600">
              <Loader2 className="h-4 w-4 animate-spin text-[#F04F25]" />
              <span>Querying server-side Gemini 4 Hydrogen with SKYJACK Q3 2026 case evidence...</span>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-stone-200 p-4 flex items-center gap-3 bg-[#FAF9F7] rounded-b-xl"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about operating earnings walks, IR-01..IR-07, broker variances, interprovincial taxes, or 15%/35% tariff scenarios..."
            aria-label="Ask AI Financial Analyst"
            className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm text-[#222222] placeholder:text-stone-400 focus:border-[#F04F25] focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F04F25] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#D9421B] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Analyze</span>
          </button>
        </form>
      </div>
    </div>
  );
};
