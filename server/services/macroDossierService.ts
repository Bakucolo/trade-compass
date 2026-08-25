import { PrismaClient } from '@prisma/client';
import YahooFinance from 'yahoo-finance2';
import { fetchFredMacroData, MacroIndicator } from './fredService';
import { agentActivityTracker } from './agentActivityService';

const prisma = new PrismaClient();
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export interface MacroPillarMetric {
  label: string;
  value: string;
  interpretation: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface MacroPillar {
  id: string;
  name: string;
  icon?: string;
  status: 'BENIGN' | 'CAUTION' | 'SEVERE' | 'STIMULATIVE';
  summary: string;
  keyMetrics: MacroPillarMetric[];
  strategicImplications: string;
}

export interface MacroScenario {
  id: 'base_case' | 'bull_reflation' | 'bear_shock';
  title: string;
  probabilityPercent: number;
  description: string;
  keyTriggers: string[];
  winners: string[];
  losers: string[];
  strategicAction: string;
}

export interface TacticalAllocationItem {
  category: 'Equities' | 'Fixed Income / Duration' | 'Commodities & Real Assets' | 'Currencies & Cash' | 'Derivatives & Hedging';
  subAsset: string;
  stance: 'OVERWEIGHT' | 'NEUTRAL' | 'UNDERWEIGHT' | 'TACTICAL_HEDGE';
  rationale: string;
  recommendedVehicles: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface CatalystRadarItem {
  id: string;
  title: string;
  category: 'MONETARY_POLICY' | 'INFLATION_DATA' | 'LABOR_MARKET' | 'GEOPOLITICS' | 'EARNINGS_LIQUIDITY';
  timeframe: string;
  potentialImpact: 'HIGH' | 'CRITICAL' | 'MODERATE';
  whatToWatch: string;
  criticalPivotLevel?: string;
}

export interface MacroDossierResult {
  id?: string;
  title: string;
  regimeTitle: string;
  regimeTone: 'bullish' | 'bearish' | 'neutral' | 'warning';
  macroScore: number; // 0 - 100 overall stability & health score
  growthOutlook: 'EXPANSIONARY' | 'MODERATING' | 'STAGNANT' | 'CONTRACTION';
  inflationRegime: 'DEFLATIONARY' | 'DISINFLATION' | 'STICKY_TARGET' | 'ACCELERATING';
  monetaryPolicyPosture: 'HAWKISH' | 'NEUTRAL_PAUSE' | 'DOVISH_EASING';
  liquidityCondition: 'EXPANDING' | 'NEUTRAL' | 'TIGHTENING';
  
  // Telemetry Snapshots
  vixLevel: number;
  yield10y: number;
  spread2y10y: number;
  dxyLevel: number;
  oilPrice: number;
  fedFundsRate: number;
  highYieldSpread: number;
  
  // Core Narrative
  executiveSummary: string;
  narrativeOverview: string;
  keyTakeaways: string[];
  
  // 7 Deep-Dive Macro Pillars
  pillars: MacroPillar[];
  
  // Probabilistic Scenarios
  scenarios: MacroScenario[];
  
  // Cross-Asset Tactical Allocations & Hedging
  tacticalAllocations: TacticalAllocationItem[];
  
  // Upcoming Watchpoints & Catalysts
  catalystsRadar: CatalystRadarItem[];
  
  createdAt?: string;
}

// Timeout helper for resilient live market quotes
async function fetchQuoteSafe(symbol: string, fallbackPrice: number): Promise<{ price: number; changePercent: number }> {
  try {
    const quote: any = await Promise.race([
      yahooFinance.quote(symbol),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
    ]);
    return {
      price: quote?.regularMarketPrice || fallbackPrice,
      changePercent: quote?.regularMarketChangePercent || 0
    };
  } catch {
    return { price: fallbackPrice, changePercent: 0 };
  }
}

/**
 * Run the Autonomous AI Global Macro Dossier Agent
 */
export async function runMacroDossierAgent(
  options: {
    portfolioContext?: {
      totalPositions?: number;
      netLiquidValue?: number;
      optionsCount?: number;
    };
  } = {},
  logToFile: (msg: string) => void = console.log
): Promise<MacroDossierResult> {
  const startTime = Date.now();
  logToFile('[MacroDossierAgent] Initializing live macro intelligence telemetry ingestion...');

  // 1. Log Agent Activity Tracker
  const activityEvent = agentActivityTracker.startTask({
    agentName: 'Global Macro Dossier Agent',
    agentType: 'MACRO_DOSSIER',
    taskDescription: 'Synthesizing global macro environment, FRED indicators, sovereign yield curve, and cross-asset tactical allocation dossier',
    metadata: { ...options.portfolioContext }
  });

  // 2. Fetch live FRED indicators & Market Proxies in parallel
  const [fredData, spxQuote, qqqQuote, vixQuote, vvixQuote, tltQuote, dxyQuote, goldQuote, oilQuote, copperQuote] = await Promise.all([
    fetchFredMacroData().catch(e => {
      console.error('[MacroDossierAgent] FRED fetch fallback:', e);
      return [] as MacroIndicator[];
    }),
    fetchQuoteSafe('^GSPC', 5850),
    fetchQuoteSafe('^IXIC', 18720),
    fetchQuoteSafe('^VIX', 15.42),
    fetchQuoteSafe('^VVIX', 98.40),
    fetchQuoteSafe('TLT', 91.50),
    fetchQuoteSafe('DX-Y.NYB', 103.80),
    fetchQuoteSafe('GC=F', 2735.40),
    fetchQuoteSafe('CL=F', 71.40),
    fetchQuoteSafe('HG=F', 4.35)
  ]);

  // Extract key FRED series
  const findFred = (id: string, fallback: number) => {
    const item = fredData.find(f => f.symbol === id);
    return item ? item.price : fallback;
  };

  const fedFunds = findFred('FEDFUNDS', 4.83);
  const yield3m = findFred('DGS3MO', 4.81);
  const yield2y = findFred('DGS2', 4.02);
  const yield5y = findFred('DGS5', 4.14);
  const yield10y = findFred('DGS10', 4.38);
  const yield30y = findFred('DGS30', 4.58);
  const spread2s10s = findFred('T10Y2Y', yield10y - yield2y);
  const spread3m10s = findFred('T10Y3M', yield10y - yield3m);
  const hySpread = findFred('BAMLH0A0HYM2', 3.12);
  const bbbSpread = findFred('BAMLC0A4CBBB', 1.18);
  const cpi = findFred('CPIAUCSL', 314.8);
  const coreCpi = findFred('CPILFESL', 319.4);
  const unrate = findFred('UNRATE', 4.3);
  const fedAssets = findFred('WALCL', 7120000);
  const m2Supply = findFred('M2SL', 21100);
  const gdp = findFred('GDPC1', 23150);

  const liveVix = vixQuote.price || findFred('VIXCLS', 15.42);
  const liveDxy = dxyQuote.price || findFred('DTWEXBGS', 103.80);
  const liveOil = oilQuote.price || findFred('DCOILWTICO', 71.40);
  const liveGold = goldQuote.price || findFred('GOLDAMGBD228NLBM', 2735.40);

  logToFile(`[MacroDossierAgent] Telemetry Ingested: 10Y=${yield10y.toFixed(2)}%, 2s10s=${spread2s10s.toFixed(2)}%, VIX=${liveVix.toFixed(2)}, DXY=${liveDxy.toFixed(2)}, Oil=$${liveOil.toFixed(2)}, HY Spread=${hySpread.toFixed(2)}%`);

  // 3. Build Prompt for Institutional AI Macro Strategist
  const systemPrompt = `You are the Chief Global Macro Strategist and Head of Multi-Asset Tactical Allocation at a world-class global macro hedge fund (managing $50B+ in sovereign debt, equities, commodities, and derivatives).
Your mission is to generate an exhaustive, deeply insightful, institutional-grade Macro Environment Dossier.
The dossier MUST be structured, lucid, highly readable, and actionable for sophisticated traders and portfolio managers.

CURRENT LIVE TELEMETRY SNAPSHOT:
- US Sovereign Yields: 3M: ${yield3m.toFixed(2)}% | 2Y: ${yield2y.toFixed(2)}% | 5Y: ${yield5y.toFixed(2)}% | 10Y: ${yield10y.toFixed(2)}% | 30Y: ${yield30y.toFixed(2)}%
- Yield Curve Slopes: 2s10s Spread: ${spread2s10s.toFixed(2)}% (${spread2s10s < 0 ? 'INVERTED' : 'NORMAL/STEEPENING'}) | 3m10s: ${spread3m10s.toFixed(2)}%
- Monetary & Central Bank: Fed Funds Rate: ${fedFunds.toFixed(2)}% | Fed Balance Sheet: $${(fedAssets / 1000).toFixed(0)}B (QT Trajectory) | M2 Money Supply: $${m2Supply.toFixed(0)}B
- Labor & Inflation: US Unemployment Rate: ${unrate.toFixed(1)}% | CPI Index: ${cpi.toFixed(1)} | Core CPI Index: ${coreCpi.toFixed(1)} | Real GDP: $${gdp.toFixed(0)}B
- Credit Spreads: High Yield Option-Adjusted Spread: ${hySpread.toFixed(2)}% (HY OAS) | BBB Spread: ${bbbSpread.toFixed(2)}%
- Market Volatility & Sentiment: VIX: ${liveVix.toFixed(2)} | VVIX: ${vvixQuote.price.toFixed(2)} | S&P 500: ${spxQuote.price.toFixed(0)} | Nasdaq 100: ${qqqQuote.price.toFixed(0)}
- Currencies & Real Assets: DXY Dollar Index: ${liveDxy.toFixed(2)} | Gold PM: $${liveGold.toFixed(2)} | WTI Crude: $${liveOil.toFixed(2)} | Copper: $${copperQuote.price.toFixed(2)} | TLT 20Y Bond ETF: $${tltQuote.price.toFixed(2)}
${options.portfolioContext?.totalPositions ? `- User Portfolio: ${options.portfolioContext.totalPositions} active positions, $${options.portfolioContext.netLiquidValue?.toLocaleString() || 0} Net Liq` : ''}

CRITICAL RULES:
1. Provide a definitive Macro Health & Stability Score (0 to 100). Higher = robust non-recessionary growth + orderly market functioning; Lower = severe recessionary / liquidity shock risk.
2. Formulate a gripping, multi-paragraph Macro Narrative Overview written in institutional finance prose that explains the big picture clearly (why yields are where they are, what the Fed is balancing between inflation and employment, dollar mechanics, commodity geopolitical risk, and market breadth).
3. Analyze 7 distinct Macro Pillars:
   - monetary_policy (Monetary Policy & Fed Stance)
   - yield_curve (Yield Curve & Sovereign Debt Health)
   - inflation_labor (Inflation & Labor Dynamics)
   - liquidity_fx (Global Liquidity & Dollar Dominance)
   - commodities_geopolitics (Energy, Commodities & Geopolitics)
   - credit_corporate (Credit Spreads & Default Risk)
   - volatility_sentiment (Volatility Regime & Risk Appetite)
4. Provide 3 Probabilistic Scenarios (Base Case ~55-65%, Bull Reflation ~20-30%, Bear Shock ~15-25%) with exact catalysts, winners, and losers.
5. Provide a comprehensive Tactical Asset Allocation Matrix across Equities, Fixed Income/Duration, Commodities/Real Assets, Currencies/Cash, and Derivatives Hedging tactics.
6. Provide upcoming Catalyst Watchpoints with dates/timeframes and critical pivot levels.

YOU MUST RETURN STRICT PURE JSON MATCHING THIS EXACT SCHEMA (no markdown outside JSON):
{
  "title": "Global Macro Intelligence Dossier: <Regime Specific Title>",
  "regimeTitle": "<Concise Regime Label, e.g. 'Late-Cycle Disinflation & Policy Normalization'>",
  "regimeTone": "bullish" | "bearish" | "neutral" | "warning",
  "macroScore": <NUMBER 0-100>,
  "growthOutlook": "EXPANSIONARY" | "MODERATING" | "STAGNANT" | "CONTRACTION",
  "inflationRegime": "DEFLATIONARY" | "DISINFLATION" | "STICKY_TARGET" | "ACCELERATING",
  "monetaryPolicyPosture": "HAWKISH" | "NEUTRAL_PAUSE" | "DOVISH_EASING",
  "liquidityCondition": "EXPANDING" | "NEUTRAL" | "TIGHTENING",
  "executiveSummary": "<2-3 paragraph institutional executive summary of the macroeconomic backdrop>",
  "narrativeOverview": "<4-5 paragraph comprehensive, highly readable macroeconomic narrative explaining the economic cycle, market drivers, risks, and cross-asset behavior>",
  "keyTakeaways": [
    "<Key takeaway 1>",
    "<Key takeaway 2>",
    "<Key takeaway 3>",
    "<Key takeaway 4>"
  ],
  "pillars": [
    {
      "id": "monetary_policy",
      "name": "Monetary Policy & Fed Trajectory",
      "status": "BENIGN" | "CAUTION" | "SEVERE" | "STIMULATIVE",
      "summary": "<In-depth diagnostic>",
      "keyMetrics": [
        { "label": "Fed Funds Rate", "value": "${fedFunds.toFixed(2)}%", "interpretation": "<Context>", "trend": "neutral" | "down" | "up" },
        { "label": "QT Pace", "value": "$${(fedAssets / 1000).toFixed(0)}B Balance Sheet", "interpretation": "<Context>", "trend": "down" }
      ],
      "strategicImplications": "<Actionable implication for traders>"
    },
    {
      "id": "yield_curve",
      "name": "Yield Curve & Sovereign Debt Health",
      "status": "BENIGN" | "CAUTION" | "SEVERE" | "STIMULATIVE",
      "summary": "<In-depth diagnostic>",
      "keyMetrics": [
        { "label": "2s10s Spread", "value": "${spread2s10s.toFixed(2)}%", "interpretation": "<Context>", "trend": "up" },
        { "label": "10Y Benchmark", "value": "${yield10y.toFixed(2)}%", "interpretation": "<Context>", "trend": "neutral" }
      ],
      "strategicImplications": "<Actionable implication for duration and equity valuation>"
    },
    {
      "id": "inflation_labor",
      "name": "Inflation Dynamics & Labor Market Resilience",
      "status": "BENIGN" | "CAUTION" | "SEVERE" | "STIMULATIVE",
      "summary": "<In-depth diagnostic>",
      "keyMetrics": [
        { "label": "Unemployment Rate", "value": "${unrate.toFixed(1)}%", "interpretation": "<Context>", "trend": "up" },
        { "label": "CPI Trend", "value": "${cpi.toFixed(1)}", "interpretation": "<Context>", "trend": "down" }
      ],
      "strategicImplications": "<Actionable implication>"
    },
    {
      "id": "liquidity_fx",
      "name": "Global Liquidity & US Dollar Dominance",
      "status": "BENIGN" | "CAUTION" | "SEVERE" | "STIMULATIVE",
      "summary": "<In-depth diagnostic>",
      "keyMetrics": [
        { "label": "DXY Index", "value": "${liveDxy.toFixed(2)}", "interpretation": "<Context>", "trend": "neutral" },
        { "label": "M2 Growth", "value": "$${m2Supply.toFixed(0)}B", "interpretation": "<Context>", "trend": "up" }
      ],
      "strategicImplications": "<Actionable implication for multi-currency and risk assets>"
    },
    {
      "id": "commodities_geopolitics",
      "name": "Energy, Commodities & Geopolitics",
      "status": "BENIGN" | "CAUTION" | "SEVERE" | "STIMULATIVE",
      "summary": "<In-depth diagnostic>",
      "keyMetrics": [
        { "label": "WTI Crude", "value": "$${liveOil.toFixed(2)}", "interpretation": "<Context>", "trend": "neutral" },
        { "label": "Gold PM Fix", "value": "$${liveGold.toFixed(2)}", "interpretation": "<Context>", "trend": "up" }
      ],
      "strategicImplications": "<Actionable implication>"
    },
    {
      "id": "credit_corporate",
      "name": "Credit Spreads & Default Risk",
      "status": "BENIGN" | "CAUTION" | "SEVERE" | "STIMULATIVE",
      "summary": "<In-depth diagnostic>",
      "keyMetrics": [
        { "label": "HY OAS Spread", "value": "${hySpread.toFixed(2)}%", "interpretation": "<Context>", "trend": "neutral" },
        { "label": "BBB Spread", "value": "${bbbSpread.toFixed(2)}%", "interpretation": "<Context>", "trend": "neutral" }
      ],
      "strategicImplications": "<Actionable implication>"
    },
    {
      "id": "volatility_sentiment",
      "name": "Volatility Regime & Risk Appetite",
      "status": "BENIGN" | "CAUTION" | "SEVERE" | "STIMULATIVE",
      "summary": "<In-depth diagnostic>",
      "keyMetrics": [
        { "label": "VIX Index", "value": "${liveVix.toFixed(2)}", "interpretation": "<Context>", "trend": "neutral" },
        { "label": "VVIX", "value": "${vvixQuote.price.toFixed(2)}", "interpretation": "<Context>", "trend": "neutral" }
      ],
      "strategicImplications": "<Actionable implication for option sellers and hedgers>"
    }
  ],
  "scenarios": [
    {
      "id": "base_case",
      "title": "<Base Case Scenario Title>",
      "probabilityPercent": 60,
      "description": "<Detailed pathway>",
      "keyTriggers": ["<Trigger 1>", "<Trigger 2>"],
      "winners": ["<Asset 1>", "<Asset 2>", "<Sector 1>"],
      "losers": ["<Asset 3>", "<Sector 2>"],
      "strategicAction": "<Recommended tactical execution>"
    },
    {
      "id": "bull_reflation",
      "title": "<Bull Reflation Scenario Title>",
      "probabilityPercent": 25,
      "description": "<Detailed pathway>",
      "keyTriggers": ["<Trigger 1>", "<Trigger 2>"],
      "winners": ["<Asset 1>", "<Asset 2>"],
      "losers": ["<Asset 3>"],
      "strategicAction": "<Recommended tactical execution>"
    },
    {
      "id": "bear_shock",
      "title": "<Bear Shock / Hard Landing Scenario Title>",
      "probabilityPercent": 15,
      "description": "<Detailed pathway>",
      "keyTriggers": ["<Trigger 1>", "<Trigger 2>"],
      "winners": ["<Defensive 1>", "<Cash/Bonds>"],
      "losers": ["<High Beta>", "<Cyclicals>"],
      "strategicAction": "<Recommended defensive hedge>"
    }
  ],
  "tacticalAllocations": [
    {
      "category": "Equities",
      "subAsset": "Quality Growth & Tech Mega-Caps",
      "stance": "OVERWEIGHT" | "NEUTRAL" | "UNDERWEIGHT" | "TACTICAL_HEDGE",
      "rationale": "<Reasoning>",
      "recommendedVehicles": ["QQQ", "SPY", "MSFT", "NVDA"],
      "riskLevel": "MEDIUM"
    },
    {
      "category": "Equities",
      "subAsset": "Small-Cap & Cyclicals (Russell 2000)",
      "stance": "OVERWEIGHT" | "NEUTRAL" | "UNDERWEIGHT" | "TACTICAL_HEDGE",
      "rationale": "<Reasoning>",
      "recommendedVehicles": ["IWM", "XLI"],
      "riskLevel": "HIGH"
    },
    {
      "category": "Fixed Income / Duration",
      "subAsset": "Long-Duration Treasuries (10Y-30Y)",
      "stance": "OVERWEIGHT" | "NEUTRAL" | "UNDERWEIGHT" | "TACTICAL_HEDGE",
      "rationale": "<Reasoning>",
      "recommendedVehicles": ["TLT", "IEF"],
      "riskLevel": "MEDIUM"
    },
    {
      "category": "Fixed Income / Duration",
      "subAsset": "Short-Duration T-Bills & Floating Cash",
      "stance": "OVERWEIGHT" | "NEUTRAL" | "UNDERWEIGHT" | "TACTICAL_HEDGE",
      "rationale": "<Reasoning>",
      "recommendedVehicles": ["BIL", "SGOV", "SHV"],
      "riskLevel": "LOW"
    },
    {
      "category": "Commodities & Real Assets",
      "subAsset": "Monetary Gold & Precious Metals",
      "stance": "OVERWEIGHT" | "NEUTRAL" | "UNDERWEIGHT" | "TACTICAL_HEDGE",
      "rationale": "<Reasoning>",
      "recommendedVehicles": ["GLD", "IAU", "GDX"],
      "riskLevel": "LOW"
    },
    {
      "category": "Commodities & Real Assets",
      "subAsset": "Crude Oil & Energy Infrastructure",
      "stance": "OVERWEIGHT" | "NEUTRAL" | "UNDERWEIGHT" | "TACTICAL_HEDGE",
      "rationale": "<Reasoning>",
      "recommendedVehicles": ["XLE", "USO"],
      "riskLevel": "MEDIUM"
    },
    {
      "category": "Currencies & Cash",
      "subAsset": "US Dollar Cash Reserve Buffer",
      "stance": "OVERWEIGHT" | "NEUTRAL" | "UNDERWEIGHT" | "TACTICAL_HEDGE",
      "rationale": "<Reasoning>",
      "recommendedVehicles": ["USD Cash (15-20% allocation)"],
      "riskLevel": "LOW"
    },
    {
      "category": "Derivatives & Hedging",
      "subAsset": "Volatility Tail-Risk & Put Protection",
      "stance": "TACTICAL_HEDGE",
      "rationale": "<Tactical hedging recommendations for derivative traders>",
      "recommendedVehicles": ["VIX Call Spreads", "SPY 60D 5% OTM Put Spreads", "Covered Collar Structures"],
      "riskLevel": "LOW"
    }
  ],
  "catalystsRadar": [
    {
      "id": "fomc_next",
      "title": "Upcoming FOMC Rate Decision & Dot Plot",
      "category": "MONETARY_POLICY",
      "timeframe": "Next 4-6 Weeks",
      "potentialImpact": "CRITICAL",
      "whatToWatch": "Rate cut magnitude, terminal rate projection, and quantitative tightening taper schedule.",
      "criticalPivotLevel": "Fed Funds target rate corridor & 10Y Yield 4.50% ceiling"
    },
    {
      "id": "cpi_print",
      "title": "US CPI / Core PCE Inflation Release",
      "category": "INFLATION_DATA",
      "timeframe": "Monthly Release",
      "potentialImpact": "HIGH",
      "whatToWatch": "Services ex-housing sticky inflation and shelter disinflation persistence.",
      "criticalPivotLevel": "Core CPI YoY > 3.4% triggers hawkish re-pricing"
    },
    {
      "id": "labor_sahm",
      "title": "Non-Farm Payrolls & Unemployment Rate (Sahm Rule)",
      "category": "LABOR_MARKET",
      "timeframe": "First Friday of Month",
      "potentialImpact": "HIGH",
      "whatToWatch": "Unemployment rate trajectory vs 0.50% Sahm Rule threshold.",
      "criticalPivotLevel": "Unemployment rate > 4.4% triggers recession alarms"
    },
    {
      "id": "treasury_refunding",
      "title": "US Treasury Quarterly Refunding Announcement (QRA)",
      "category": "MONETARY_POLICY",
      "timeframe": "Quarterly",
      "potentialImpact": "HIGH",
      "whatToWatch": "Coupon auction sizes vs T-Bill issuance and primary dealer absorption.",
      "criticalPivotLevel": "Long duration yield surge if coupon supply exceeds demand"
    }
  ]
}`;

  let rawDossierText = '';

  // 4. Try LLM Call via OpenRouter / Gemini
  try {
    if (process.env.OPENROUTER_API_KEY) {
      logToFile('[MacroDossierAgent] Querying OpenRouter API (openai/gpt-4o-mini)...');
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Generate the definitive institutional Global Macro Intelligence Dossier based on all active telemetry." }
          ],
          temperature: 0.3
        })
      });

      if (response.ok) {
        const data = await response.json();
        rawDossierText = data.choices?.[0]?.message?.content || "";
      } else {
        const errTxt = await response.text();
        logToFile(`[MacroDossierAgent] OpenRouter error: ${response.status} ${errTxt}`);
      }
    }

    if (!rawDossierText && process.env.GEMINI_API_KEY) {
      logToFile('[MacroDossierAgent] Querying Gemini API (gemini-1.5-flash)...');
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: `${systemPrompt}\n\nGenerate the complete structured JSON Macro Intelligence Dossier.` }] }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.3
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        rawDossierText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
    }
  } catch (err: any) {
    logToFile(`[MacroDossierAgent] LLM invocation warning: ${err?.message || err}`);
  }

  // 5. Parse or Construct Fallback Dossier Result
  let parsed: any = null;
  if (rawDossierText) {
    try {
      const cleanJson = rawDossierText.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch (e) {
      logToFile(`[MacroDossierAgent] JSON parse error, building calibrated fallback.`);
    }
  }

  // Determine heuristic regime tone & score
  const isCurveInverted = spread2s10s < 0;
  const isVolHigh = liveVix > 20;
  const isHyTight = hySpread < 3.5;
  const computedMacroScore = Math.min(95, Math.max(35, Math.round(
    70 + (isCurveInverted ? -12 : 5) + (isVolHigh ? -15 : 8) + (isHyTight ? 6 : -8) + (unrate > 4.4 ? -10 : 4)
  )));

  const result: MacroDossierResult = {
    title: parsed?.title || `Global Macro Intelligence Dossier: Policy Pivot & Late-Cycle Resilience`,
    regimeTitle: parsed?.regimeTitle || (computedMacroScore >= 70 ? 'Goldilocks Disinflation & Orderly Growth' : computedMacroScore >= 50 ? 'Late-Cycle Moderation with Sticky Rates' : 'Stagflationary Volatility Pressure'),
    regimeTone: parsed?.regimeTone || (computedMacroScore >= 70 ? 'bullish' : computedMacroScore >= 50 ? 'neutral' : 'warning'),
    macroScore: parsed?.macroScore || computedMacroScore,
    growthOutlook: parsed?.growthOutlook || 'MODERATING',
    inflationRegime: parsed?.inflationRegime || 'DISINFLATION',
    monetaryPolicyPosture: parsed?.monetaryPolicyPosture || 'DOVISH_EASING',
    liquidityCondition: parsed?.liquidityCondition || 'NEUTRAL',
    vixLevel: liveVix,
    yield10y: yield10y,
    spread2y10y: spread2s10s,
    dxyLevel: liveDxy,
    oilPrice: liveOil,
    fedFundsRate: fedFunds,
    highYieldSpread: hySpread,
    executiveSummary: parsed?.executiveSummary || `The global macroeconomic landscape is operating in a late-cycle disinflationary regime marked by a normalizing sovereign yield curve (2s10s at ${spread2s10s.toFixed(2)}%) and benign credit conditions (High Yield OAS at ${hySpread.toFixed(2)}%). While headline inflation continues its gradual descent toward central bank targets, services and shelter components remain sticky, supporting a calibrated rate-cutting cycle rather than an emergency easing sequence. Corporate balance sheets remain insulated, but labor market cooling warrants close vigilance against growth deceleration risks.`,
    narrativeOverview: parsed?.narrativeOverview || `The macroeconomic landscape in 2026 is defined by a delicate transition from restrictive monetary tightening toward policy recalibration. Benchmark 10-Year Treasury yields at ${yield10y.toFixed(2)}% reflect a balance between resilient nominal economic growth and sustained sovereign debt issuance. The Federal Reserve maintains an effective Fed Funds rate of ${fedFunds.toFixed(2)}% while executing quantitative tightening (QT), keeping system liquidity disciplined.

Equity valuations remain elevated, underpinned by corporate earnings durability in mega-cap technology and secular AI capital expenditures. However, market breadth exhibits cyclical sensitivity, with small-caps and debt-heavy enterprises sensitive to the cost of refinancing. Corporate credit spreads (HY OAS at ${hySpread.toFixed(2)}%) indicate that bond investors perceive minimal systemic distress, preventing liquidity contagion.

In commodities and FX, the US Dollar Index (DXY at ${liveDxy.toFixed(2)}) reflects steady global demand for dollar-denominated assets amidst international divergence in central bank policies. Gold at $${liveGold.toFixed(2)}/oz continues to function as a premier structural hedge against sovereign fiscal deficits and geopolitical friction, while crude oil at $${liveOil.toFixed(2)}/bbl trades in a balanced band without triggering secondary inflation shocks.

For portfolio managers and derivatives traders, this macro backdrop favors high-quality cash-flow generative equities, short-duration carry structures, and tactical volatility selling, complemented by defined-risk tail hedges to protect against unexpected growth shocks.`,
    keyTakeaways: parsed?.keyTakeaways || [
      `Sovereign yield curve (2s10s at ${spread2s10s >= 0 ? '+' : ''}${spread2s10s.toFixed(2)}%) indicates an un-inversion cycle typical of early policy easing phases.`,
      `Credit spreads remain compressed (+${hySpread.toFixed(2)}%), signaling absence of systemic corporate refinancing panic.`,
      `VIX at ${liveVix.toFixed(2)} provides an attractive environment for premium sellers, but requires strict stop-loss and tail-risk hedging.`,
      `Gold ($${liveGold.toFixed(2)}) and High-Quality Cash Reserves remain essential stabilizers against fiscal and geopolitical uncertainties.`
    ],
    pillars: parsed?.pillars || [
      {
        id: "monetary_policy",
        name: "Monetary Policy & Fed Trajectory",
        status: "BENIGN",
        summary: `The Federal Reserve is orchestrating a measured rate cutting cycle from ${fedFunds.toFixed(2)}% toward neutral, balancing disinflation against labor stabilization.`,
        keyMetrics: [
          { label: "Fed Funds Rate", value: `${fedFunds.toFixed(2)}%`, interpretation: "Policy rate in restrictive-to-neutral transition", trend: "down" },
          { label: "Fed Assets", value: `$${(fedAssets / 1000).toFixed(0)}B`, interpretation: "Gradual balance sheet runoff (QT)", trend: "down" }
        ],
        strategicImplications: "Favor rate-sensitive high-quality balance sheets and prepare for steepening yield curves."
      },
      {
        id: "yield_curve",
        name: "Yield Curve & Sovereign Debt Health",
        status: isCurveInverted ? "CAUTION" : "BENIGN",
        summary: `10-Year yields at ${yield10y.toFixed(2)}% reflect term premium stability, while 2s10s curve is at ${spread2s10s.toFixed(2)}%.`,
        keyMetrics: [
          { label: "10Y Treasury", value: `${yield10y.toFixed(2)}%`, interpretation: "Global risk-free hurdle rate", trend: "neutral" },
          { label: "2s10s Spread", value: `${spread2s10s.toFixed(2)}%`, interpretation: isCurveInverted ? "Recession warning" : "Normalizing slope", trend: "up" }
        ],
        strategicImplications: "Maintain balanced duration; avoid over-allocating to 30Y debt due to fiscal supply headwinds."
      },
      {
        id: "inflation_labor",
        name: "Inflation Dynamics & Labor Market Resilience",
        status: "BENIGN",
        summary: `US Unemployment at ${unrate.toFixed(1)}% shows orderly labor softening without rapid job destruction, aligning with soft-landing dynamics.`,
        keyMetrics: [
          { label: "Unemployment", value: `${unrate.toFixed(1)}%`, interpretation: "Labor market cooling gradually", trend: "up" },
          { label: "CPI Index", value: `${cpi.toFixed(1)}`, interpretation: "Headline disinflation ongoing", trend: "down" }
        ],
        strategicImplications: "Consumer discretionary spending remains selective; focus on essential and enterprise tech secular leaders."
      },
      {
        id: "liquidity_fx",
        name: "Global Liquidity & US Dollar Dominance",
        status: "BENIGN",
        summary: `DXY at ${liveDxy.toFixed(2)} and M2 Money Supply at $${m2Supply.toFixed(0)}B maintain stable cross-border financial conditions.`,
        keyMetrics: [
          { label: "DXY Dollar Index", value: `${liveDxy.toFixed(2)}`, interpretation: "Resilient greenback strength", trend: "neutral" },
          { label: "M2 Supply", value: `$${m2Supply.toFixed(0)}B`, interpretation: "Broad money supply expanding modestly", trend: "up" }
        ],
        strategicImplications: "US multinational earnings face moderate FX translation friction; emerging markets selective."
      },
      {
        id: "commodities_geopolitics",
        name: "Energy, Commodities & Geopolitics",
        status: "CAUTION",
        summary: `Crude oil at $${liveOil.toFixed(2)}/bbl keeps headline inflation contained, while Gold ($${liveGold.toFixed(2)}) prices in sovereign fiscal risks.`,
        keyMetrics: [
          { label: "WTI Crude", value: `$${liveOil.toFixed(2)}`, interpretation: "Energy inputs neutral to core CPI", trend: "neutral" },
          { label: "Gold PM Fix", value: `$${liveGold.toFixed(2)}`, interpretation: "Safe haven demand and central bank accumulation", trend: "up" }
        ],
        strategicImplications: "Maintain 5-10% physical/ETF gold allocation as structural geopolitical ballast."
      },
      {
        id: "credit_corporate",
        name: "Credit Spreads & Default Risk",
        status: "BENIGN",
        summary: `High Yield OAS at ${hySpread.toFixed(2)}% is near historic tight ranges, demonstrating corporate credit resilience.`,
        keyMetrics: [
          { label: "HY OAS Spread", value: `${hySpread.toFixed(2)}%`, interpretation: "Low corporate distress premium", trend: "neutral" },
          { label: "BBB Spread", value: `${bbbSpread.toFixed(2)}%`, interpretation: "Investment grade spreads benign", trend: "neutral" }
        ],
        strategicImplications: "Credit market conditions do not suggest an impending recession or liquidity crisis."
      },
      {
        id: "volatility_sentiment",
        name: "Volatility Regime & Risk Appetite",
        status: isVolHigh ? "CAUTION" : "BENIGN",
        summary: `VIX at ${liveVix.toFixed(2)} confirms a controlled volatility regime with normal risk-seeking equity behavior.`,
        keyMetrics: [
          { label: "VIX Fear Index", value: `${liveVix.toFixed(2)}`, interpretation: "Low to moderate option implied volatility", trend: "neutral" },
          { label: "VVIX Vol-of-Vol", value: `${vvixQuote.price.toFixed(2)}`, interpretation: "Tail risk pricing disciplined", trend: "neutral" }
        ],
        strategicImplications: "Optimal backdrop for covered call selling, cash-secured puts, and iron condors."
      }
    ],
    scenarios: parsed?.scenarios || [
      {
        id: "base_case",
        title: "Goldilocks Policy Recalibration & Soft Landing",
        probabilityPercent: 60,
        description: "The Federal Reserve lowers rates gradually toward 3.50%-3.75%, economic growth stays positive at 1.8%-2.2%, and corporate earnings expand moderately.",
        keyTriggers: ["Core PCE holds under 2.8%", "Unemployment stays between 4.1% and 4.4%", "Corporate default rates remain low"],
        winners: ["Quality Mega-Cap Tech (QQQ)", "Dividend Aristocrats (SCHD)", "Short-to-Medium Duration Bonds (IEF)"],
        losers: ["Ultra-Speculative Unprofitable Growth", "Cash T-Bills as yield decays"],
        strategicAction: "Maintain overweight in quality growth equities; harvest options premium with covered calls."
      },
      {
        id: "bull_reflation",
        title: "Productivity Boom & Global Reflation Acceleration",
        probabilityPercent: 25,
        description: "AI-driven corporate productivity unlocks margin expansion, global trade rebounds, and small caps surge on lower refinancing costs.",
        keyTriggers: ["Broad market earnings beat estimates by >5%", "Global manufacturing PMIs cross 52.0", "Credit demand expands"],
        winners: ["Small Caps (IWM)", "Semiconductors (SMH)", "Industrial Metals (COPX, FCX)", "Emerging Markets (EEM)"],
        losers: ["Long-Duration Sovereign Bonds (TLT)", "Defensive Utilities (XLU)"],
        strategicAction: "Rotate tactically into small caps and cyclical semiconductors; sell out-of-the-money puts."
      },
      {
        id: "bear_shock",
        title: "Labor Deterioration & Geopolitical Supply Shock",
        probabilityPercent: 15,
        description: "Labor market weakening accelerates (Sahm Rule breach), consumer spending contracts, and geopolitical friction drives an energy price spike.",
        keyTriggers: ["Unemployment breaches 4.6%", "WTI Crude surges above $95/bbl", "HY credit spreads widen above 4.5%"],
        winners: ["Cash / T-Bills (BIL)", "Physical Gold (GLD)", "VIX Long Volatility", "Defensive Healthcare (XLV)"],
        losers: ["High Beta Equities", "Consumer Discretionary", "High Yield Junk Debt"],
        strategicAction: "Deploy 5% OTM S&P 500 put debit spreads, raise cash reserves to 25%, and collar vulnerable long stock positions."
      }
    ],
    tacticalAllocations: parsed?.tacticalAllocations || [
      {
        category: "Equities",
        subAsset: "Mega-Cap Tech & High Free-Cash-Flow Leaders",
        stance: "OVERWEIGHT",
        rationale: "Pristine balance sheets, secular AI monetisation, and pricing power insulate them from macro shocks.",
        recommendedVehicles: ["QQQ", "MSFT", "AAPL", "NVDA", "GOOGL"],
        riskLevel: "MEDIUM"
      },
      {
        category: "Equities",
        subAsset: "Small-Cap Equities (Russell 2000)",
        stance: "NEUTRAL",
        rationale: "Attractive valuation discount balanced by higher floating rate debt exposure.",
        recommendedVehicles: ["IWM", "AVUV"],
        riskLevel: "HIGH"
      },
      {
        category: "Fixed Income / Duration",
        subAsset: "7-10 Year Intermediate Sovereign Treasuries",
        stance: "OVERWEIGHT",
        rationale: "Optimal risk/reward for locking in attractive yields without excessive 30Y fiscal supply duration risk.",
        recommendedVehicles: ["IEF", "BND", "GOVT"],
        riskLevel: "LOW"
      },
      {
        category: "Fixed Income / Duration",
        subAsset: "Short-Duration T-Bills & Treasury Cash",
        stance: "NEUTRAL",
        rationale: "Provides liquid yield cushion, but reinvestment yields will decline with Fed rate cuts.",
        recommendedVehicles: ["BIL", "SGOV", "USFR"],
        riskLevel: "LOW"
      },
      {
        category: "Commodities & Real Assets",
        subAsset: "Monetary Gold & Precious Metals",
        stance: "OVERWEIGHT",
        rationale: "Structural central bank de-dollarization accumulation and sovereign debt hedging.",
        recommendedVehicles: ["GLD", "IAU", "SGOL"],
        riskLevel: "LOW"
      },
      {
        category: "Commodities & Real Assets",
        subAsset: "Energy Infrastructure & Oil",
        stance: "NEUTRAL",
        rationale: "OPEC+ spare capacity caps upside, but dividend yields provide cash flow.",
        recommendedVehicles: ["XLE", "AMLP", "VDE"],
        riskLevel: "MEDIUM"
      },
      {
        category: "Currencies & Cash",
        subAsset: "Dry Powder Cash Reserves (10-15%)",
        stance: "OVERWEIGHT",
        rationale: "Essential flexibility to capitalize on opportunistic market dips and volatility spikes.",
        recommendedVehicles: ["USD Cash Yield Ledgers"],
        riskLevel: "LOW"
      },
      {
        category: "Derivatives & Hedging",
        subAsset: "Option Premium Selling & Tactical Tail Hedges",
        stance: "TACTICAL_HEDGE",
        rationale: "Low VIX creates cheap asymmetric put spread insurance while covered calls monetize high-IV individual stocks.",
        recommendedVehicles: ["SPY 60D 5% OTM Put Spreads", "VIX 20-30 Call Spreads", "Covered Call Writing"],
        riskLevel: "LOW"
      }
    ],
    catalystsRadar: parsed?.catalystsRadar || [
      {
        id: "fomc_decision",
        title: "FOMC Monetary Policy Meeting & Rate Decision",
        category: "MONETARY_POLICY",
        timeframe: "Next Scheduled FOMC",
        potentialImpact: "CRITICAL",
        whatToWatch: "Dot plot trajectory, Chair speech tone, and pace of quantitative tightening.",
        criticalPivotLevel: "10Y Treasury Yield 4.50% resistance level"
      },
      {
        id: "cpi_release",
        title: "US CPI / Core PCE Inflation Print",
        category: "INFLATION_DATA",
        timeframe: "Monthly Release Cycle",
        potentialImpact: "HIGH",
        whatToWatch: "Sticky core services ex-housing and transportation inflation.",
        criticalPivotLevel: "Core inflation YoY > 3.3% triggers rate cut delays"
      },
      {
        id: "nfp_jobs",
        title: "US Non-Farm Payrolls & Unemployment Rate",
        category: "LABOR_MARKET",
        timeframe: "First Friday Monthly",
        potentialImpact: "HIGH",
        whatToWatch: "Labor force participation, wage growth, and Sahm Rule indicator.",
        criticalPivotLevel: "Unemployment rate > 4.4% triggers recession re-pricing"
      },
      {
        id: "geopolitical_energy",
        title: "Geopolitical Energy & Trade Flashpoints",
        category: "GEOPOLITICS",
        timeframe: "Continuous Monitoring",
        potentialImpact: "HIGH",
        whatToWatch: "Shipping corridor security, Middle East stability, and tariff policy announcements.",
        criticalPivotLevel: "WTI Crude break above $85/bbl"
      }
    ]
  };

  // 6. Persist to Database via Prisma
  try {
    const savedRecord = await (prisma as any).macroDossierReport.create({
      data: {
        title: result.title,
        regimeTitle: result.regimeTitle,
        regimeTone: result.regimeTone,
        macroScore: result.macroScore,
        growthOutlook: result.growthOutlook,
        inflationRegime: result.inflationRegime,
        monetaryPolicyPosture: result.monetaryPolicyPosture,
        liquidityCondition: result.liquidityCondition,
        vixLevel: result.vixLevel,
        yield10y: result.yield10y,
        spread2y10y: result.spread2y10y,
        dxyLevel: result.dxyLevel,
        oilPrice: result.oilPrice,
        executiveSummary: result.executiveSummary,
        narrativeOverview: result.narrativeOverview,
        pillarsJson: JSON.stringify(result.pillars),
        scenariosJson: JSON.stringify(result.scenarios),
        tacticalAllocationsJson: JSON.stringify(result.tacticalAllocations),
        catalystsRadarJson: JSON.stringify(result.catalystsRadar),
        rawDossierJson: JSON.stringify(result)
      }
    });

    result.id = savedRecord.id;
    result.createdAt = savedRecord.createdAt.toISOString();
    logToFile(`[MacroDossierAgent] Successfully persisted Macro Dossier #${savedRecord.id} to database.`);

    if (activityEvent?.id) {
      agentActivityTracker.completeTask(activityEvent.id, {
        status: 'SUCCESS',
        outcomeSummary: `Generated Global Macro Dossier. Regime: "${result.regimeTitle}" (Macro Score: ${result.macroScore}/100).`,
        metadata: {
          dossierId: savedRecord.id,
          regimeTitle: result.regimeTitle,
          macroScore: result.macroScore,
          vix: result.vixLevel,
          yield10y: result.yield10y
        }
      });
    }
  } catch (dbErr: any) {
    logToFile(`[MacroDossierAgent] DB persistence note: ${dbErr?.message || dbErr}`);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  logToFile(`[MacroDossierAgent] Macro Dossier generation finished in ${durationSec}s.`);

  return result;
}

/**
 * Fetch all saved macro dossiers from SQLite DB
 */
export async function getMacroDossiers(limit = 20): Promise<MacroDossierResult[]> {
  try {
    const records = await (prisma as any).macroDossierReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return records.map((r: any) => {
      try {
        const parsed = JSON.parse(r.rawDossierJson);
        return {
          ...parsed,
          id: r.id,
          createdAt: r.createdAt.toISOString()
        };
      } catch {
        return {
          id: r.id,
          title: r.title,
          regimeTitle: r.regimeTitle,
          regimeTone: r.regimeTone as any,
          macroScore: r.macroScore,
          growthOutlook: r.growthOutlook as any,
          inflationRegime: r.inflationRegime as any,
          monetaryPolicyPosture: r.monetaryPolicyPosture as any,
          liquidityCondition: r.liquidityCondition as any,
          vixLevel: r.vixLevel,
          yield10y: r.yield10y,
          spread2y10y: r.spread2y10y,
          dxyLevel: r.dxyLevel,
          oilPrice: r.oilPrice,
          fedFundsRate: 4.83,
          highYieldSpread: 3.12,
          executiveSummary: r.executiveSummary,
          narrativeOverview: r.narrativeOverview,
          keyTakeaways: [],
          pillars: JSON.parse(r.pillarsJson || '[]'),
          scenarios: JSON.parse(r.scenariosJson || '[]'),
          tacticalAllocations: JSON.parse(r.tacticalAllocationsJson || '[]'),
          catalystsRadar: JSON.parse(r.catalystsRadarJson || '[]'),
          createdAt: r.createdAt.toISOString()
        };
      }
    });
  } catch (err) {
    console.error('Failed to get macro dossiers:', err);
    return [];
  }
}

/**
 * Fetch single macro dossier by ID
 */
export async function getMacroDossierById(id: string): Promise<MacroDossierResult | null> {
  try {
    const record = await (prisma as any).macroDossierReport.findUnique({
      where: { id }
    });
    if (!record) return null;

    try {
      const parsed = JSON.parse(record.rawDossierJson);
      return { ...parsed, id: record.id, createdAt: record.createdAt.toISOString() };
    } catch {
      return {
        id: record.id,
        title: record.title,
        regimeTitle: record.regimeTitle,
        regimeTone: record.regimeTone as any,
        macroScore: record.macroScore,
        growthOutlook: record.growthOutlook as any,
        inflationRegime: record.inflationRegime as any,
        monetaryPolicyPosture: record.monetaryPolicyPosture as any,
        liquidityCondition: record.liquidityCondition as any,
        vixLevel: record.vixLevel,
        yield10y: record.yield10y,
        spread2y10y: record.spread2y10y,
        dxyLevel: record.dxyLevel,
        oilPrice: record.oilPrice,
        fedFundsRate: 4.83,
        highYieldSpread: 3.12,
        executiveSummary: record.executiveSummary,
        narrativeOverview: record.narrativeOverview,
        keyTakeaways: [],
        pillars: JSON.parse(record.pillarsJson || '[]'),
        scenarios: JSON.parse(record.scenariosJson || '[]'),
        tacticalAllocations: JSON.parse(record.tacticalAllocationsJson || '[]'),
        catalystsRadar: JSON.parse(record.catalystsRadarJson || '[]'),
        createdAt: record.createdAt.toISOString()
      };
    }
  } catch (err) {
    console.error(`Failed to get macro dossier ${id}:`, err);
    return null;
  }
}

/**
 * Delete a saved macro dossier by ID
 */
export async function deleteMacroDossier(id: string): Promise<boolean> {
  try {
    await (prisma as any).macroDossierReport.delete({ where: { id } });
    return true;
  } catch (err) {
    console.error(`Failed to delete macro dossier ${id}:`, err);
    return false;
  }
}
