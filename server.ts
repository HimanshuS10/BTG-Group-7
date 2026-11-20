import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import {
  CASE_CONSTANTS,
  DEFAULT_PRESENTATION_ROI_ASSUMPTIONS,
  DEFAULT_ROI_ASSUMPTIONS,
  HISTORICAL_QUARTERLY_SERIES,
  OFFICIAL_CUSTOMS_ENTRIES,
  OFFICIAL_INTERPROVINCIAL_DELIVERIES,
  OFFICIAL_IRREGULAR_COSTS,
  OFFICIAL_QOQ_WALK,
  OFFICIAL_YOY_WALK,
  PRESENTATION_ROI_DISCLAIMER,
  calculatePresentationYear1ROI,
  calculateTrustworthyROI,
} from './src/data/skyjackCaseData.ts';

dotenv.config({ path: ['.env.local', '.env'] });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '1mb' }));

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildCaseContextPrompt(
  liveAnomalies?: unknown,
  liveCustoms?: unknown,
  liveInterprovincial?: unknown,
  periodCloseApprovals?: unknown,
  selectedRoiModel?: unknown,
  presentationRoiAssumptions?: unknown,
  roiAssumptions?: unknown
): string {
  const activeRoiModel =
    selectedRoiModel === 'original_3yr' ? 'original_3yr' : 'presentation_y1';
  const mergedPres = {
    ...DEFAULT_PRESENTATION_ROI_ASSUMPTIONS,
    ...(presentationRoiAssumptions && typeof presentationRoiAssumptions === 'object'
      ? (presentationRoiAssumptions as Record<string, number>)
      : {}),
  };
  const mergedOrig = {
    ...DEFAULT_ROI_ASSUMPTIONS,
    ...(roiAssumptions && typeof roiAssumptions === 'object'
      ? (roiAssumptions as Record<string, unknown>)
      : {}),
  };
  const activeRoiSummary =
    activeRoiModel === 'presentation_y1'
      ? {
          selectedModelName: 'Group 7 Presentation Model — Year 1',
          timeHorizon: 'Year 1 (12 months)',
          disclaimer: PRESENTATION_ROI_DISCLAIMER,
          assumptions: mergedPres,
          results: calculatePresentationYear1ROI(mergedPres),
        }
      : {
          selectedModelName: 'Original Three-Year Model',
          timeHorizon: '3 Years (36 months)',
          assumptions: mergedOrig,
          results: calculateTrustworthyROI(
            mergedOrig as typeof DEFAULT_ROI_ASSUMPTIONS,
            Array.isArray(liveCustoms)
              ? (liveCustoms as typeof OFFICIAL_CUSTOMS_ENTRIES)
              : OFFICIAL_CUSTOMS_ENTRIES
          ),
        };

  return JSON.stringify(
    {
      datasetLabel: CASE_CONSTANTS.DATASET_NOTICE,
      prototypeDisclosure: CASE_CONSTANTS.PROTOTYPE_NOTICE,
      reportingPeriod: CASE_CONSTANTS.REPORTING_PERIOD,
      thresholds: {
        entryScreeningThresholdCAD: CASE_CONSTANTS.TRANSACTION_ALERT_THRESHOLD_CAD,
        earningsWalkMaterialityThresholdCAD: CASE_CONSTANTS.WALK_MATERIALITY_THRESHOLD_CAD,
        contractualBrokerRate: CASE_CONSTANTS.CONTRACTUAL_BROKER_RATE,
        chinaAdditionalPracticeTariffRate: CASE_CONSTANTS.BASELINE_CHINA_EXTRA_TARIFF_RATE,
      },
      activeRoiModelSummary: activeRoiSummary,
      historicalQuarterlyEarningsMillionsCAD: HISTORICAL_QUARTERLY_SERIES,
      officialYoYWalkThousandsCAD: OFFICIAL_YOY_WALK,
      officialQoQWalkThousandsCAD: OFFICIAL_QOQ_WALK,
      periodCloseApprovals: periodCloseApprovals ?? {},
      irregularCosts: Array.isArray(liveAnomalies)
        ? liveAnomalies
        : OFFICIAL_IRREGULAR_COSTS,
      customsEntries: Array.isArray(liveCustoms)
        ? liveCustoms
        : OFFICIAL_CUSTOMS_ENTRIES,
      interprovincialDeliveries_CustomerTaxSeparate: Array.isArray(liveInterprovincial)
        ? liveInterprovincial
        : OFFICIAL_INTERPROVINCIAL_DELIVERIES,
    },
    null,
    2
  );
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'SKYGUARD AI Server',
    geminiConfigured: Boolean(getGeminiClient()),
  });
});

app.post('/api/analyst', async (req, res) => {
  const {
    question,
    anomalies,
    customsEntries,
    interprovincialDeliveries,
    periodCloseApprovals,
    selectedRoiModel,
    presentationRoiAssumptions,
    roiAssumptions,
  } = req.body ?? {};
  if (!question || typeof question !== 'string' || !question.trim()) {
    res.status(400).json({ error: 'Please enter a financial analysis question.' });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      error:
        'Live Gemini synthesis requires a configured GEMINI_API_KEY in Settings > Secrets. Use Deterministic Case Engine (default) for instant Appendix calculations.',
    });
    return;
  }

  try {
    const systemInstruction =
      'You are SKYGUARD AI, a financial analysis assistant for a student competition prototype analyzing fictional SKYJACK Q3 2026 case figures in CAD. ' +
      'STRICT RULES: ' +
      '(1) Cite exact record IDs (IR-01..IR-07, E-01..E-12, IP-01..IP-05, YoY/QoQ walk lines) and exact Appendix Sections (Section 1.1 Income Statements, 1.2 YoY Walk, 1.3 QoQ Walk, 2.1–2.3 Irregular Costs, 3.1–3.6 Trade/Tariffs/Interprovincial, 4.1 Thresholds). ' +
      '(2) Never fabricate figures, approvals, dates, exchange rates, ERP connections, product mixes, or guaranteed savings. If information is absent, explicitly state "Not provided in case" or "I do not know from the case dataset." ' +
      '(3) Clearly separate AI recommendations/hypotheses from verified source facts. Keep Stage 1 ("Financially Reconciled") strictly separate from Stage 2 ("Blocked", "Ready for Sign-Off", or "Approved for Close"). Never say a period is Approved for Close unless periodCloseApprovals[period] has status="Approved" with a recorded reviewer/date, and always label any recorded approval as "Simulated Demo Approval — Identity Not Verified". ' +
      '(4) Distinguish the CAD $1,000,000 per-line earnings walk materiality threshold from the CAD $250,000 entry screening threshold (Section 4.1). ' +
      '(5) Note that IR-01 (-$900K) triggers >= $250K, Period 9 close timing, unusual scrap write-off, and approval/QA support gap — NOT a missing accrual reversal. IR-01 (-$900K) and IR-02 (-$600K) are already in the YoY walk and must not be double counted. ' +
      '(6) Keep interprovincial customer sales tax ($799,525, Section 3.5) completely separate from customs duties and SKYJACK losses. ' +
      '(7) Label all tariff rates (Section 3.4) as fictional case assumptions, not real-world customs regulations. ' +
      '(8) When discussing ROI or business case, explicitly identify activeRoiModelSummary.selectedModelName and use ONLY its exact figures without mixing Group 7 Presentation Model — Year 1 with Original Three-Year Model.';

    const prompt =
      `SKYJACK Q3 2026 CASE DATASET:\n${buildCaseContextPrompt(
        anomalies,
        customsEntries,
        interprovincialDeliveries,
        periodCloseApprovals,
        selectedRoiModel,
        presentationRoiAssumptions,
        roiAssumptions
      )}\n\nUSER QUESTION:\n${question.trim()}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: { systemInstruction },
    });

    const text = response.text?.trim();
    if (!text) {
      res.status(502).json({ error: 'Gemini returned an empty response.' });
      return;
    }

    res.json({ answer: text, model: 'gemini-4-hydrogen' });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Upstream Gemini API request failed.';
    const status = message.includes('403') || message.includes('401') ? 403 : 502;
    res.status(status).json({
      error: `Gemini API error: ${message}. Switch to Deterministic Case Engine or verify GEMINI_API_KEY.`,
    });
  }
});

app.post('/api/anomaly-explain', async (req, res) => {
  const { anomaly } = req.body ?? {};
  if (!anomaly || typeof anomaly !== 'object') {
    res.status(400).json({ error: 'Anomaly payload is required.' });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      error:
        'Live Gemini synthesis requires a configured GEMINI_API_KEY in Settings > Secrets. The deterministic Five Ws & How panel below displays verified case facts.',
    });
    return;
  }

  try {
    const systemInstruction =
      'You are a financial audit assistant summarizing a fictional SKYJACK Q3 2026 case entry. ' +
      'Provide a concise Five Ws and How summary and suggested investigation checks. ' +
      'Strictly separate "Documented Case Facts" from "Suggested Investigation Checks (Unverified Hypothesis)". ' +
      'Never invent names, approval references, fraud accusations, or confirmed cash recoveries.';

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Summarize this cost entry using Five Ws & How without inventing missing facts:\n${JSON.stringify(anomaly, null, 2)}`,
      config: { systemInstruction },
    });

    const text = response.text?.trim();
    if (!text) {
      res.status(502).json({ error: 'Gemini returned an empty explanation.' });
      return;
    }

    res.json({ explanation: text, model: 'gemini-4-hydrogen' });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Upstream Gemini API request failed.';
    res.status(502).json({
      error: `Gemini API error: ${message}.`,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // Unique HMR websocket port so several apps can run side by side.
        hmr: process.env.DISABLE_HMR === 'true' ? false : { port: PORT + 21000 },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SKYGUARD AI listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
