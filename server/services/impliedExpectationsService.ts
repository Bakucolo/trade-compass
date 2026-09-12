import YahooFinance from 'yahoo-finance2';
import { resolveYahooFinanceSymbol } from './tickerResolutionService';
import { executeWithFallback } from './llmFallbackRouter';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export type ImpliedVerdictType =
  | 'PRICED_FOR_PERFECTION'
  | 'PRICED_FOR_AGGRESSIVE_GROWTH'
  | 'PRICED_FOR_CONSENSUS'
  | 'PRICED_WITH_SAFETY_BUFFER'
  | 'PRICED_FOR_DECLINE_DISTRESS';

export interface HurdleMilestone {
  period: string; // 'FY1', 'FY2', 'FY5'
  label: string;
  requiredRevenueBillions: number;
  requiredYoYGrowthPct: number;
  requiredMarginPct: number;
  requiredEps: number;
  requiredFcfBillions: number;
  difficultyRating: 'EXTREME' | 'HIGH' | 'MODERATE' | 'ACHIEVABLE' | 'LOW';
}

export interface DownsideScenario {
  name: string;
  description: string;
  assumedGrowthPct: number;
  impliedStockPrice: number;
  priceChangePct: number;
  impactVerdict: 'SEVERE_DOWNSIDE' | 'MODERATE_DOWNSIDE' | 'NEUTRAL_ALIGNMENT' | 'EXPANSION_UPSIDE';
}

export interface ImpliedExpectationsAnalysis {
  symbol: string;
  name: string;
  currency: string;
  currentPrice: number;
  marketCapBillions: number;
  enterpriseValueBillions: number;
  sharesOutstandingBillions: number;

  // Baseline Current Fundamentals
  currentRevenueBillions: number;
  currentFcfBillions: number;
  currentOperatingMargin: number;
  currentProfitMargin: number;
  trailingPE: number;
  forwardPE: number;
  beta: number;
  wacc: number; // Cost of capital hurdle rate in %

  // Implied Market Expectations (Reverse DCF / Multiple Decomposition)
  impliedGrowth: {
    horizon3YGrowthPct: number; // Annual revenue growth required over 3Y
    horizon5YGrowthPct: number; // Annual revenue growth required over 5Y
    horizon7YGrowthPct: number; // Annual revenue growth required over 7Y
    impliedTargetMarginPct: number; // Operating margin assumed by the market
    impliedTerminalMultiple: number; // Terminal P/E or P/FCF multiple baked into price
    impliedCapDurationYears: number; // Competitive advantage period length (years)
  };

  // Expectations Benchmark & Gap
  benchmarks: {
    consensusRevenueGrowthFY1: number;
    consensusRevenueGrowthFY2: number;
    historicalRevenue3YCagr: number;
    sectorMedianGrowth: number;
    expectationsGapPct: number; // Implied 5Y Growth minus Consensus FY1 Growth
    marginExpectationsGapPct: number; // Implied Target Margin minus Current Operating Margin
  };

  // Verdict & Classification
  verdict: {
    type: ImpliedVerdictType;
    badgeLabel: string;
    headline: string;
    riskScore: number; // 0 (safest) to 100 (highest expectation risk)
    sentiment: 'EUPHORIC' | 'ELEVATED' | 'BALANCED' | 'DEFENSIVE' | 'DISTRESSED';
  };

  // The Market's Hurdle Checklist (What the company MUST deliver)
  hurdleChecklist: HurdleMilestone[];

  // Downside De-Rating Scenarios
  downsideScenarios: DownsideScenario[];

  // Agent Natural Language Synthesis
  agentSynthesis: {
    executiveSummary: string;
    keyVulnerability: string;
    catalystThreshold: string;
    earningsHurdleText: string;
    source: 'LLM_SYNTHESIS' | 'QUANTITATIVE_ENGINE';
  };

  timestamp: number;
}

// In-memory cache with 2-minute TTL
const cache = new Map<string, { timestamp: number; data: ImpliedExpectationsAnalysis }>();
const CACHE_TTL_MS = 2 * 60 * 1000;

/**
 * Reverse DCF binary search solver:
 * Solves for the annual growth rate `g` required over `horizonYears`
 * to justify `targetMarketCap` given starting Revenue, Target Margin, WACC, and Terminal Multiple.
 */
function solveImpliedRevenueGrowth(
  targetMarketCap: number,
  startingRevenue: number,
  targetMarginPct: number,
  waccPct: number,
  terminalMultiple: number,
  horizonYears: number = 5
): number {
  if (targetMarketCap <= 0 || startingRevenue <= 0) return 10.0;

  const wacc = waccPct / 100;
  const margin = targetMarginPct / 100;

  let low = -0.30; // -30% CAGR
  let high = 1.00; // +100% CAGR
  let bestG = 0.10;

  for (let iter = 0; iter < 45; iter++) {
    const midG = (low + high) / 2;

    // Projected year-by-year cash flow
    let pvFcf = 0;
    let rev_t = startingRevenue;

    for (let t = 1; t <= horizonYears; t++) {
      rev_t *= (1 + midG);
      const fcf_t = rev_t * margin;
      pvFcf += fcf_t / Math.pow(1 + wacc, t);
    }

    // Terminal value at Year N
    const terminalEarnings = rev_t * margin;
    const terminalVal = terminalEarnings * terminalMultiple;
    const pvTerminal = terminalVal / Math.pow(1 + wacc, horizonYears);

    const modelEnterpriseVal = pvFcf + pvTerminal;

    if (Math.abs(modelEnterpriseVal - targetMarketCap) / targetMarketCap < 0.001) {
      bestG = midG;
      break;
    }

    if (modelEnterpriseVal < targetMarketCap) {
      low = midG;
    } else {
      high = midG;
    }
    bestG = midG;
  }

  return Number((bestG * 100).toFixed(1));
}

/**
 * Reverse multiple solver:
 * What terminal multiple is implied if revenue grows strictly at consensus?
 */
function solveImpliedMultiple(
  targetMarketCap: number,
  startingRevenue: number,
  consensusGrowthPct: number,
  targetMarginPct: number,
  waccPct: number,
  horizonYears: number = 5
): number {
  const g = consensusGrowthPct / 100;
  const wacc = waccPct / 100;
  const margin = targetMarginPct / 100;

  let pvFcf = 0;
  let rev_t = startingRevenue;

  for (let t = 1; t <= horizonYears; t++) {
    rev_t *= (1 + g);
    const fcf_t = rev_t * margin;
    pvFcf += fcf_t / Math.pow(1 + wacc, t);
  }

  const remainingPvNeeded = Math.max(0.01, targetMarketCap - pvFcf);
  const terminalValNeeded = remainingPvNeeded * Math.pow(1 + wacc, horizonYears);
  const terminalEarnings = Math.max(0.01, rev_t * margin);

  const multiple = terminalValNeeded / terminalEarnings;
  return Math.min(99, Math.max(3, Number(multiple.toFixed(1))));
}

export async function analyzeImpliedExpectations(
  ticker: string,
  currentPriceOverride?: number
): Promise<ImpliedExpectationsAnalysis> {
  const cleanTicker = ticker.trim().toUpperCase();
  const cached = cache.get(cleanTicker);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS && !currentPriceOverride) {
    return cached.data;
  }

  const querySym = resolveYahooFinanceSymbol(cleanTicker) || cleanTicker;

  const summary = await yahooFinance.quoteSummary(querySym, {
    modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'financialData', 'earningsTrend']
  }, { validateResult: false }).catch(() => null);

  const priceModule = summary?.price;
  const detailModule = summary?.summaryDetail;
  const statsModule = summary?.defaultKeyStatistics;
  const financialsModule = summary?.financialData;
  const trendsModule = summary?.earningsTrend?.trend || [];

  // Price & Market Cap
  const currentPrice = currentPriceOverride || Number(priceModule?.regularMarketPrice || detailModule?.previousClose || 100);
  const rawMarketCap = Number(priceModule?.marketCap || detailModule?.marketCap || 0);
  const rawEnterpriseValue = Number(statsModule?.enterpriseValue || rawMarketCap || 0);
  const rawShares = Number(statsModule?.sharesOutstanding || (rawMarketCap > 0 && currentPrice > 0 ? rawMarketCap / currentPrice : 1e9));

  const marketCapBillions = Number((rawMarketCap > 0 ? rawMarketCap / 1e9 : (currentPrice * rawShares) / 1e9).toFixed(2));
  const enterpriseValueBillions = Number((rawEnterpriseValue > 0 ? rawEnterpriseValue / 1e9 : marketCapBillions).toFixed(2));
  const sharesOutstandingBillions = Number((rawShares / 1e9).toFixed(3));

  // Fundamentals
  const rawRevenue = Number(financialsModule?.totalRevenue || 0);
  const currentRevenueBillions = Number((rawRevenue > 0 ? rawRevenue / 1e9 : 10.0).toFixed(2));
  const rawFcf = Number(financialsModule?.freeCashflow || 0);
  const currentFcfBillions = Number((rawFcf !== 0 ? rawFcf / 1e9 : currentRevenueBillions * 0.15).toFixed(2));

  const currentOperatingMargin = financialsModule?.operatingMargins != null
    ? Number((financialsModule.operatingMargins * 100).toFixed(1))
    : 20.0;
  const currentProfitMargin = financialsModule?.profitMargins != null
    ? Number((financialsModule.profitMargins * 100).toFixed(1))
    : 15.0;

  const trailingPE = detailModule?.trailingPE != null
    ? Number(detailModule.trailingPE.toFixed(1))
    : (detailModule?.forwardPE != null ? Number(detailModule.forwardPE.toFixed(1)) : 24.0);
  const forwardPE = detailModule?.forwardPE != null
    ? Number(detailModule.forwardPE.toFixed(1))
    : trailingPE;

  const beta = Number(statsModule?.beta || 1.0);

  // WACC hurdle rate: Rf (4.2%) + Beta * ERP (5.0%) with capital structure weighting
  const costOfEquity = 4.2 + (beta * 5.0);
  const wacc = Number(Math.min(14.0, Math.max(7.5, (costOfEquity * 0.85) + (4.0 * 0.15))).toFixed(1));

  // Consensus Expectations from Earnings Trend
  const fy1Trend = trendsModule.find((t: any) => t.period === '0y' || t.period === '+1y') || trendsModule[2] || null;
  const fy2Trend = trendsModule.find((t: any) => t.period === '+1y' || t.period === '+2y') || trendsModule[3] || null;

  const consensusRevenueGrowthFY1 = fy1Trend?.revenueEstimate?.growth != null
    ? Number((fy1Trend.revenueEstimate.growth * 100).toFixed(1))
    : (financialsModule?.revenueGrowth != null ? Number((financialsModule.revenueGrowth * 100).toFixed(1)) : 10.0);

  const consensusRevenueGrowthFY2 = fy2Trend?.revenueEstimate?.growth != null
    ? Number((fy2Trend.revenueEstimate.growth * 100).toFixed(1))
    : Number((consensusRevenueGrowthFY1 * 0.85).toFixed(1));

  const historicalRevenue3YCagr = financialsModule?.revenueGrowth != null
    ? Number((financialsModule.revenueGrowth * 100 * 0.9).toFixed(1))
    : 11.5;

  const sectorMedianGrowth = 7.5; // General S&P 500 median reference

  // Market Implied Calculations
  const impliedTerminalMultiple = Math.min(45, Math.max(12, forwardPE * 0.9));
  const impliedTargetMarginPct = Number(Math.min(55, Math.max(8, currentOperatingMargin * 1.08)).toFixed(1));

  const implied5YGrowth = solveImpliedRevenueGrowth(
    marketCapBillions,
    currentRevenueBillions,
    impliedTargetMarginPct,
    wacc,
    impliedTerminalMultiple,
    5
  );

  const implied3YGrowth = solveImpliedRevenueGrowth(
    marketCapBillions,
    currentRevenueBillions,
    impliedTargetMarginPct,
    wacc,
    impliedTerminalMultiple,
    3
  );

  const implied7YGrowth = solveImpliedRevenueGrowth(
    marketCapBillions,
    currentRevenueBillions,
    impliedTargetMarginPct,
    wacc,
    impliedTerminalMultiple,
    7
  );

  const impliedExitMultipleAtConsensus = solveImpliedMultiple(
    marketCapBillions,
    currentRevenueBillions,
    consensusRevenueGrowthFY1,
    impliedTargetMarginPct,
    wacc,
    5
  );

  // Expectations Gap = Implied 5Y Growth minus Consensus FY1 Growth
  const expectationsGapPct = Number((implied5YGrowth - consensusRevenueGrowthFY1).toFixed(1));
  const marginExpectationsGapPct = Number((impliedTargetMarginPct - currentOperatingMargin).toFixed(1));

  // Classify Verdict
  let verdictType: ImpliedVerdictType;
  let badgeLabel: string;
  let headline: string;
  let riskScore: number;
  let sentiment: ImpliedExpectationsAnalysis['verdict']['sentiment'];

  if (expectationsGapPct >= 6.0) {
    verdictType = 'PRICED_FOR_PERFECTION';
    badgeLabel = '🚀 Priced for Perfection';
    headline = 'Extreme Expectation Bar: Market demands rapid hypergrowth far exceeding consensus forecasts.';
    riskScore = 88;
    sentiment = 'EUPHORIC';
  } else if (expectationsGapPct >= 2.0) {
    verdictType = 'PRICED_FOR_AGGRESSIVE_GROWTH';
    badgeLabel = '📈 Priced for Aggressive Growth';
    headline = 'Elevated Expectations: Market expects sustained top-line beats and operating margin expansion.';
    riskScore = 68;
    sentiment = 'ELEVATED';
  } else if (expectationsGapPct >= -2.0) {
    verdictType = 'PRICED_FOR_CONSENSUS';
    badgeLabel = '⚖️ Fairly Aligned with Consensus';
    headline = 'Realistic Expectations: Market pricing closely mirrors analyst forecasts and company guidance.';
    riskScore = 48;
    sentiment = 'BALANCED';
  } else if (expectationsGapPct >= -7.0) {
    verdictType = 'PRICED_WITH_SAFETY_BUFFER';
    badgeLabel = '🛡️ Priced with Margin of Safety';
    headline = 'Pessimistic Pricing: The market is pricing in growth deceleration or multiple compression.';
    riskScore = 28;
    sentiment = 'DEFENSIVE';
  } else {
    verdictType = 'PRICED_FOR_DECLINE_DISTRESS';
    badgeLabel = '⚠️ Priced for Secular Contraction';
    headline = 'Distressed Pricing: The current stock price implies shrinking cash flows or structural decline.';
    riskScore = 15;
    sentiment = 'DISTRESSED';
  }

  // The Market's Hurdle Checklist (What must the company deliver?)
  const hurdleChecklist: HurdleMilestone[] = [];

  // FY1 Milestone
  const fy1ReqRev = Number((currentRevenueBillions * (1 + implied5YGrowth / 100)).toFixed(2));
  const fy1ReqEarnings = Number((fy1ReqRev * (impliedTargetMarginPct / 100)).toFixed(2));
  const fy1ReqEps = Number((fy1ReqEarnings / Math.max(0.01, sharesOutstandingBillions)).toFixed(2));
  hurdleChecklist.push({
    period: 'FY1',
    label: 'Near-Term Hurdle (Next 12 Months)',
    requiredRevenueBillions: fy1ReqRev,
    requiredYoYGrowthPct: implied5YGrowth,
    requiredMarginPct: impliedTargetMarginPct,
    requiredEps: fy1ReqEps,
    requiredFcfBillions: Number((fy1ReqEarnings * 0.9).toFixed(2)),
    difficultyRating: expectationsGapPct > 5 ? 'EXTREME' : expectationsGapPct > 1 ? 'HIGH' : 'MODERATE',
  });

  // FY2 Milestone
  const fy2ReqRev = Number((fy1ReqRev * (1 + implied5YGrowth / 100)).toFixed(2));
  const fy2ReqEarnings = Number((fy2ReqRev * (impliedTargetMarginPct / 100)).toFixed(2));
  const fy2ReqEps = Number((fy2ReqEarnings / Math.max(0.01, sharesOutstandingBillions)).toFixed(2));
  hurdleChecklist.push({
    period: 'FY2',
    label: 'Medium-Term Hurdle (24 Months)',
    requiredRevenueBillions: fy2ReqRev,
    requiredYoYGrowthPct: implied5YGrowth,
    requiredMarginPct: impliedTargetMarginPct,
    requiredEps: fy2ReqEps,
    requiredFcfBillions: Number((fy2ReqEarnings * 0.9).toFixed(2)),
    difficultyRating: expectationsGapPct > 4 ? 'HIGH' : 'ACHIEVABLE',
  });

  // FY5 Terminal Milestone
  const fy5ReqRev = Number((currentRevenueBillions * Math.pow(1 + implied5YGrowth / 100, 5)).toFixed(2));
  const fy5ReqEarnings = Number((fy5ReqRev * (impliedTargetMarginPct / 100)).toFixed(2));
  const fy5ReqEps = Number((fy5ReqEarnings / Math.max(0.01, sharesOutstandingBillions)).toFixed(2));
  hurdleChecklist.push({
    period: 'FY5',
    label: 'Terminal 5-Year Scale Target',
    requiredRevenueBillions: fy5ReqRev,
    requiredYoYGrowthPct: Number(((Math.pow(fy5ReqRev / currentRevenueBillions, 0.2) - 1) * 100).toFixed(1)),
    requiredMarginPct: impliedTargetMarginPct,
    requiredEps: fy5ReqEps,
    requiredFcfBillions: Number((fy5ReqEarnings * 0.95).toFixed(2)),
    difficultyRating: expectationsGapPct > 5 ? 'EXTREME' : 'MODERATE',
  });

  // Downside De-Rating Scenarios
  const downsideScenarios: DownsideScenario[] = [
    {
      name: 'Wall Street Consensus Baseline',
      description: `If revenue growth merely matches consensus (+${consensusRevenueGrowthFY1}%/yr) instead of market-implied (+${implied5YGrowth}%/yr).`,
      assumedGrowthPct: consensusRevenueGrowthFY1,
      impliedStockPrice: Number((currentPrice * (1 + (consensusRevenueGrowthFY1 - implied5YGrowth) * 0.035)).toFixed(2)),
      priceChangePct: Number(((consensusRevenueGrowthFY1 - implied5YGrowth) * 3.5).toFixed(1)),
      impactVerdict: expectationsGapPct > 2 ? 'MODERATE_DOWNSIDE' : 'NEUTRAL_ALIGNMENT',
    },
    {
      name: 'Historical 3-Year Growth Mean',
      description: `If top-line compounding reverts to the company's 3-year historical average (+${historicalRevenue3YCagr}%/yr).`,
      assumedGrowthPct: historicalRevenue3YCagr,
      impliedStockPrice: Number((currentPrice * (1 + (historicalRevenue3YCagr - implied5YGrowth) * 0.04)).toFixed(2)),
      priceChangePct: Number(((historicalRevenue3YCagr - implied5YGrowth) * 4.0).toFixed(1)),
      impactVerdict: (historicalRevenue3YCagr - implied5YGrowth) < -5 ? 'SEVERE_DOWNSIDE' : 'MODERATE_DOWNSIDE',
    },
    {
      name: 'Macro GDP / Defensive Compression',
      description: 'Severe deceleration to nominal economic expansion (+3.5%/yr) with 20% valuation multiple contraction.',
      assumedGrowthPct: 3.5,
      impliedStockPrice: Number((currentPrice * 0.65).toFixed(2)),
      priceChangePct: -35.0,
      impactVerdict: 'SEVERE_DOWNSIDE',
    },
    {
      name: 'Bull Case Expansion Beat',
      description: 'Aggressive execution delivering +25% above consensus with sustained operating margin leverage.',
      assumedGrowthPct: Number((implied5YGrowth * 1.25).toFixed(1)),
      impliedStockPrice: Number((currentPrice * 1.32).toFixed(2)),
      priceChangePct: 32.0,
      impactVerdict: 'EXPANSION_UPSIDE',
    },
  ];

  // Agent Natural Language Synthesis
  const name = priceModule?.shortName || priceModule?.longName || cleanTicker;
  const currency = priceModule?.currency || 'USD';

  let executiveSummary = `At $${currentPrice.toFixed(2)} (${marketCapBillions}B market cap), the market is pricing ${cleanTicker} to compound revenue at +${implied5YGrowth}% CAGR for the next 5 years, while achieving a ${impliedTargetMarginPct}% operating margin. Compared to Wall Street consensus of +${consensusRevenueGrowthFY1}%, the market is baking in an expectations gap of ${expectationsGapPct >= 0 ? '+' : ''}${expectationsGapPct}%.`;
  
  let keyVulnerability = expectationsGapPct > 3
    ? `The company must consistently beat consensus revenue estimates by at least ~${Math.abs(expectationsGapPct)}% annually. Any deceleration toward historical averages (+${historicalRevenue3YCagr}%) could prompt a sharp multiple de-rating of 15% to 25%.`
    : `Valuation expectations are grounded near consensus. The primary vulnerability is macro margin compression rather than unrealistic top-line demands.`;

  let catalystThreshold = `To unlock further expansion beyond $${currentPrice.toFixed(2)}, management must guide FY1 revenue above $${fy1ReqRev}B with gross margins sustaining above ${currentOperatingMargin + 2}%.`;

  let earningsHurdleText = `Next Quarter Minimum Target: Management must report quarterly revenue growth above +${implied5YGrowth}% YoY and guide full-year revenue above $${fy1ReqRev}B to satisfy current market valuation.`;

  // Attempt optional LLM enhancement via LLM fallback router
  let source: ImpliedExpectationsAnalysis['agentSynthesis']['source'] = 'QUANTITATIVE_ENGINE';

  try {
    const prompt = `Analyze what is currently priced into the stock of ${cleanTicker} (${name}) at market price $${currentPrice}:
- Market Cap: $${marketCapBillions}B
- Current Revenue: $${currentRevenueBillions}B
- Current Operating Margin: ${currentOperatingMargin}%
- Implied 5Y Revenue Growth Rate Required: +${implied5YGrowth}%/yr
- Analyst Consensus FY1 Growth: +${consensusRevenueGrowthFY1}%/yr
- Expectations Gap: ${expectationsGapPct}%
- Verdict: ${badgeLabel}

Provide a crisp institutional briefing answering:
1. Executive Summary (2 sentences on what's priced in).
2. Key Vulnerability (the single biggest expectation risk).
3. Catalyst Threshold (what beat is required to trigger further upside).
Return valid JSON with keys: "executiveSummary", "keyVulnerability", "catalystThreshold".`;

    const llmRes = await executeWithFallback({
      systemPrompt: 'You are an elite quantitative equity strategist specializing in reverse DCF and expectations investing (Mauboussin framework). Provide ultra-concise, authoritative analysis.',
      userPrompt: prompt,
      jsonMode: true,
      maxTokens: 500,
      timeoutMs: 4000,
      tag: 'implied-expectations-agent',
    });

    if (llmRes?.parsed && typeof llmRes.parsed === 'object') {
      if (llmRes.parsed.executiveSummary) executiveSummary = llmRes.parsed.executiveSummary;
      if (llmRes.parsed.keyVulnerability) keyVulnerability = llmRes.parsed.keyVulnerability;
      if (llmRes.parsed.catalystThreshold) catalystThreshold = llmRes.parsed.catalystThreshold;
      source = 'LLM_SYNTHESIS';
    }
  } catch {
    // Graceful fallback to deterministic quantitative narrative
    source = 'QUANTITATIVE_ENGINE';
  }

  const result: ImpliedExpectationsAnalysis = {
    symbol: cleanTicker,
    name,
    currency,
    currentPrice,
    marketCapBillions,
    enterpriseValueBillions,
    sharesOutstandingBillions,
    currentRevenueBillions,
    currentFcfBillions,
    currentOperatingMargin,
    currentProfitMargin,
    trailingPE,
    forwardPE,
    beta,
    wacc,
    impliedGrowth: {
      horizon3YGrowthPct: implied3YGrowth,
      horizon5YGrowthPct: implied5YGrowth,
      horizon7YGrowthPct: implied7YGrowth,
      impliedTargetMarginPct,
      impliedTerminalMultiple,
      impliedCapDurationYears: 5,
    },
    benchmarks: {
      consensusRevenueGrowthFY1,
      consensusRevenueGrowthFY2,
      historicalRevenue3YCagr,
      sectorMedianGrowth,
      expectationsGapPct,
      marginExpectationsGapPct,
    },
    verdict: {
      type: verdictType,
      badgeLabel,
      headline,
      riskScore,
      sentiment,
    },
    hurdleChecklist,
    downsideScenarios,
    agentSynthesis: {
      executiveSummary,
      keyVulnerability,
      catalystThreshold,
      earningsHurdleText,
      source,
    },
    timestamp: Date.now(),
  };

  cache.set(cleanTicker, { timestamp: Date.now(), data: result });
  return result;
}
