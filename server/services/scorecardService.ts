import { PrismaClient } from '@prisma/client';
import YahooFinance from 'yahoo-finance2';
import { generateJsonCompletion } from './llmFallbackRouter';
import { resolveYahooFinanceSymbol } from './tickerResolutionService';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export type ConvictionGrade = 'STRONG_BUY' | 'BUY_ACCUMULATE' | 'HOLD_MONITOR' | 'TRIM_DEFENSIVE' | 'AVOID_HIGH_RISK';
export type HealthStatus = 'PRISTINE' | 'STABLE' | 'MODERATE_DEBT' | 'HIGH_LEVERAGE' | 'DISTRESSED';
export type ValuationPosture = 'DEEP_VALUE' | 'FAIR_VALUE' | 'RICHLY_VALUED' | 'SPECULATIVE_BUBBLE';

export interface ScorecardSubMetrics {
  // Buying conviction factors
  priceTo52WeekHighPct: number;
  distanceFrom52WeekLowPct: number;
  technicalSetupScore: number; // 1.0 - 10.0
  momentumScore: number; // 1.0 - 10.0
  upsideToFairValuePct: number;
  
  // Fundamental factors
  operatingMarginPct: number | null;
  netMarginPct: number | null;
  roePct: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  fcfYieldPct: number | null;
  revenueGrowthPct: number | null;
  piotroskiFScoreEstimate: number; // 1 - 9
  altmanZScoreEstimate: number;
  
  // Valuation factors
  trailingPE: number | null;
  forwardPE: number | null;
  priceToSales: number | null;
  pegRatio: number | null;
  evToEbitda: number | null;
  fairValueEstimate: number;
}

export interface StockScorecard {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  sector: string;
  industry: string;
  marketCap: number;
  beta: number;

  // Composite 1 to 10 Scores
  overallScore: number; // 1.0 - 10.0
  rank?: number; // 1 to N relative rank
  grade: ConvictionGrade;
  gradeLabel: string;
  
  buyingConvictionScore: number; // 1.0 - 10.0
  fundamentalsScore: number; // 1.0 - 10.0
  valuationScore: number; // 1.0 - 10.0
  momentumScore: number; // 1.0 - 10.0
  healthStatus: HealthStatus;
  valuationPosture: ValuationPosture;

  // Key Sub-Metrics
  metrics: ScorecardSubMetrics;

  // Strategic & Tactical Guidance
  tacticalAction: string;
  suggestedBuyZone: { min: number; max: number };
  targetPrice: number;
  stopLossAnchor: number;
  recommendedMaxAllocationPct: number; // 1% - 15%

  // Qualitative Analysis & Narratives
  scoreJustification: string;
  fundamentalSituation: string;
  keyStrengths: string[];
  keyRisks: string[];
  bullCase: string;
  bearCase: string;

  // Portfolio vs Watchlist Context
  isHolding: boolean;
  holdingDetails?: {
    quantity: number;
    averageCost: number;
    marketValue: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    broker: string;
    brokers?: string[];
  };
  brokers?: string[]; // e.g. ["Interactive Brokers", "Trading 212"]
  isWatchlist: boolean;
  watchlistNames?: string[]; // e.g. ["Space", "Nuclear Energy, SMRs & Clean Grid"]

  analyzedAt: string;
}

export interface ScorecardsHubResponse {
  scorecards: StockScorecard[];
  summary: {
    totalEvaluated: number;
    holdingsCount: number;
    watchlistCount: number;
    avgOverallScore: number;
    avgHoldingsScore: number;
    avgWatchlistScore: number;
    topConvictionPick: StockScorecard | null;
    topValuePick: StockScorecard | null;
    topQualityPick: StockScorecard | null;
  };
  sectors: string[];
  brokers?: { name: string; count: number }[];
  watchlists?: { name: string; count: number }[];
  timestamp: number;
}

export interface EarningsQuarterComparison {
  quarter: string;
  epsActual: number | null;
  epsEstimate: number | null;
  epsSurprisePct: number | null;
  revenue: number | null;
  earnings: number | null;
}

export interface LatestEarningsAnalysisResult {
  symbol: string;
  companyName: string;
  currentPrice: number;
  reportDate: string | null;
  timing: 'BMO' | 'AMC' | 'UNSPECIFIED';
  isBeat: boolean;
  verdict: 'STRONG_BEAT' | 'MODEST_BEAT' | 'IN_LINE' | 'MODEST_MISS' | 'BIG_MISS';
  verdictLabel: string;
  quarters: EarningsQuarterComparison[];
  executiveDiagnosis: string;
  guidanceCommentary: string;
  scorecardImpact: {
    recommendedScoreAdjustment: number;
    fairValueAdjustmentPct: number;
    analystSummary: string;
  };
  keyFocusPoints: string[];
  analyzedAt: string;
}

// In-memory short-lived cache for single requests
const memoryCache = new Map<string, { card: StockScorecard; timestamp: number }>();
const CACHE_TTL_MS = 30 * 1000;

/**
 * Maps a numerical 1-10 overall score to grade and label
 */
export function getConvictionGrade(score10: number): { grade: ConvictionGrade; gradeLabel: string } {
  if (score10 >= 9.0) {
    return { grade: 'STRONG_BUY', gradeLabel: 'Prime Strong Buy (9-10)' };
  } else if (score10 >= 7.5) {
    return { grade: 'BUY_ACCUMULATE', gradeLabel: 'High Conviction Buy (7.5-8.9)' };
  } else if (score10 >= 5.5) {
    return { grade: 'HOLD_MONITOR', gradeLabel: 'Hold & Monitor (5.5-7.4)' };
  } else if (score10 >= 3.5) {
    return { grade: 'TRIM_DEFENSIVE', gradeLabel: 'Trim / Defensive (3.5-5.4)' };
  } else {
    return { grade: 'AVOID_HIGH_RISK', gradeLabel: 'Avoid / High Risk (1.0-3.4)' };
  }
}

/**
 * Evaluate single stock scorecard with Yahoo Finance telemetry + AI Agent narrative
 */
export async function evaluateStockScorecard(
  rawSymbol: string,
  holdingData?: any,
  watchlistNames?: string[],
  prisma?: PrismaClient
): Promise<StockScorecard | null> {
  const cleanRaw = rawSymbol.trim().toUpperCase();
  const querySym = resolveYahooFinanceSymbol(cleanRaw);

  const cached = memoryCache.get(cleanRaw);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    const res = { ...cached.card };
    if (holdingData) {
      res.isHolding = true;
      res.holdingDetails = holdingData;
      res.brokers = holdingData.broker ? [holdingData.broker] : res.brokers || [];
    }
    if (watchlistNames && watchlistNames.length > 0) {
      res.isWatchlist = true;
      res.watchlistNames = watchlistNames;
    }
    return res;
  }

  try {
    const summary = await yahooFinance.quoteSummary(
      querySym,
      {
        modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'financialData', 'summaryProfile'],
      },
      { validateResult: false }
    ).catch(() => null);

    const priceModule = summary?.price;
    const detailModule = summary?.summaryDetail;
    const statsModule = summary?.defaultKeyStatistics;
    const financialsModule = summary?.financialData;
    const profileModule = summary?.summaryProfile;

    const currentPrice = Number(priceModule?.regularMarketPrice || detailModule?.previousClose || 1);
    const prevClose = Number(detailModule?.previousClose || priceModule?.regularMarketPreviousClose || currentPrice);
    const change = priceModule?.regularMarketChange != null ? Number(priceModule.regularMarketChange) : currentPrice - prevClose;
    const changePercent =
      priceModule?.regularMarketChangePercent != null
        ? Number(priceModule.regularMarketChangePercent) * 100
        : prevClose > 0
        ? (change / prevClose) * 100
        : 0;

    const name = priceModule?.shortName || priceModule?.longName || cleanRaw;
    const sector = profileModule?.sector || 'General';
    const industry = profileModule?.industry || 'General';
    const marketCap = Number(priceModule?.marketCap || detailModule?.marketCap || 0);
    const beta = Number(statsModule?.beta || 1.0);
    const currency = priceModule?.currency || 'USD';

    // 52-week metrics
    const high52 = Number(detailModule?.fiftyTwoWeekHigh || currentPrice * 1.25);
    const low52 = Number(detailModule?.fiftyTwoWeekLow || currentPrice * 0.75);
    const distFrom52WHigh = high52 > 0 ? ((currentPrice - high52) / high52) * 100 : 0;
    const distFrom52WLow = low52 > 0 ? ((currentPrice - low52) / low52) * 100 : 0;

    // Fundamentals metrics
    const opMargin = financialsModule?.operatingMargins != null ? Number(financialsModule.operatingMargins) * 100 : null;
    const netMargin = financialsModule?.profitMargins != null ? Number(financialsModule.profitMargins) * 100 : null;
    const roe = financialsModule?.returnOnEquity != null ? Number(financialsModule.returnOnEquity) * 100 : null;
    const debtToEquity = financialsModule?.debtToEquity != null ? Number(financialsModule.debtToEquity) : null;
    const currentRatio = financialsModule?.currentRatio != null ? Number(financialsModule.currentRatio) : null;
    const revGrowth = financialsModule?.revenueGrowth != null ? Number(financialsModule.revenueGrowth) * 100 : null;
    const fcf = Number(financialsModule?.freeCashflow || 0);
    const fcfYield = marketCap > 0 && fcf > 0 ? (fcf / marketCap) * 100 : null;

    // Valuation metrics
    const trailingPE = detailModule?.trailingPE != null ? Number(detailModule.trailingPE) : null;
    const forwardPE = detailModule?.forwardPE != null ? Number(detailModule.forwardPE) : null;
    const priceToSales = detailModule?.priceToSalesTrailing12Months != null ? Number(detailModule.priceToSalesTrailing12Months) : null;
    const pegRatio = statsModule?.pegRatio != null ? Number(statsModule.pegRatio) : null;
    const evToEbitda = statsModule?.enterpriseToEbitda != null ? Number(statsModule.enterpriseToEbitda) : null;

    // Fair Value Estimate Model
    let fairValueMultiplier = 1.15;
    if (trailingPE && trailingPE > 0 && trailingPE < 18) fairValueMultiplier += 0.15;
    if (opMargin && opMargin > 20) fairValueMultiplier += 0.12;
    if (revGrowth && revGrowth > 15) fairValueMultiplier += 0.10;
    if (distFrom52WHigh < -20) fairValueMultiplier += 0.10;
    const fairValueEstimate = Number((currentPrice * fairValueMultiplier).toFixed(2));
    const upsideToFairValue = ((fairValueEstimate - currentPrice) / currentPrice) * 100;

    // ==========================================
    // 1 TO 10 SCORING CALIBRATION
    // ==========================================

    // 1. BUYING CONVICTION (1.0 to 10.0)
    let buyingBase = 5.0;
    if (distFrom52WHigh <= -30) buyingBase += 2.2;
    else if (distFrom52WHigh <= -15) buyingBase += 1.6;
    else if (distFrom52WHigh <= -5) buyingBase += 0.8;
    else if (distFrom52WHigh > -2) buyingBase -= 1.0;

    if (distFrom52WLow >= 10 && distFrom52WLow <= 40) buyingBase += 1.5;
    else if (distFrom52WLow < 5) buyingBase += 0.8;
    else if (distFrom52WLow > 80) buyingBase -= 0.6;

    if (beta >= 0.7 && beta <= 1.3) buyingBase += 1.0;
    else if (beta > 1.8) buyingBase -= 1.0;

    if (upsideToFairValue >= 25) buyingBase += 1.8;
    else if (upsideToFairValue >= 10) buyingBase += 1.0;

    const buyingScore = Math.max(1.5, Math.min(9.8, Number(buyingBase.toFixed(1))));

    // 2. FUNDAMENTALS QUALITY (1.0 to 10.0)
    let fundBase = 4.0;
    if (opMargin != null) {
      if (opMargin >= 25) fundBase += 2.5;
      else if (opMargin >= 15) fundBase += 2.0;
      else if (opMargin >= 8) fundBase += 1.2;
      else if (opMargin > 0) fundBase += 0.5;
      else fundBase -= 1.5;
    } else {
      fundBase += 1.0;
    }

    if (roe != null) {
      if (roe >= 20) fundBase += 2.0;
      else if (roe >= 12) fundBase += 1.5;
      else if (roe >= 5) fundBase += 0.8;
      else fundBase -= 1.0;
    } else {
      fundBase += 0.8;
    }

    if (debtToEquity != null) {
      if (debtToEquity < 40) fundBase += 2.0;
      else if (debtToEquity <= 90) fundBase += 1.4;
      else if (debtToEquity <= 180) fundBase += 0.5;
      else fundBase -= 1.8;
    } else {
      fundBase += 0.8;
    }

    if (revGrowth != null) {
      if (revGrowth >= 20) fundBase += 1.5;
      else if (revGrowth >= 8) fundBase += 1.0;
      else if (revGrowth >= 0) fundBase += 0.5;
      else fundBase -= 1.0;
    }

    const fundScore = Math.max(1.2, Math.min(9.9, Number(fundBase.toFixed(1))));

    // 3. VALUATION POSTURE (1.0 to 10.0)
    let valBase = 4.5;
    const pe = forwardPE || trailingPE;
    if (pe != null && pe > 0) {
      if (pe < 15) valBase += 3.0;
      else if (pe <= 22) valBase += 2.2;
      else if (pe <= 32) valBase += 1.0;
      else if (pe <= 50) valBase -= 0.5;
      else valBase -= 2.0;
    } else if (pe != null && pe < 0) {
      valBase -= 2.5;
    }

    if (priceToSales != null) {
      if (priceToSales < 2.0) valBase += 2.0;
      else if (priceToSales <= 4.5) valBase += 1.4;
      else if (priceToSales <= 9.0) valBase += 0.4;
      else valBase -= 1.5;
    }

    if (pegRatio != null && pegRatio > 0) {
      if (pegRatio < 1.0) valBase += 1.5;
      else if (pegRatio <= 1.5) valBase += 1.0;
      else if (pegRatio > 2.5) valBase -= 1.0;
    }

    if (fcfYield != null && fcfYield > 4.0) {
      valBase += 1.2;
    }

    const valScore = Math.max(1.0, Math.min(9.8, Number(valBase.toFixed(1))));

    // 4. MOMENTUM (1.0 to 10.0)
    const momentumScore = Math.max(1.0, Math.min(9.8, Number((5.0 + (changePercent * 0.4)).toFixed(1))));

    // COMPOSITE OVERALL SCORE (1.0 - 10.0)
    const overallScore = Number(((buyingScore * 0.35) + (fundScore * 0.35) + (valScore * 0.30)).toFixed(1));

    const { grade, gradeLabel } = getConvictionGrade(overallScore);

    // Health Rating
    let healthStatus: HealthStatus = 'STABLE';
    if (debtToEquity != null && debtToEquity > 250) healthStatus = 'DISTRESSED';
    else if (debtToEquity != null && debtToEquity > 150) healthStatus = 'HIGH_LEVERAGE';
    else if (fundScore >= 8.0 && (debtToEquity == null || debtToEquity < 50)) healthStatus = 'PRISTINE';
    else if (fundScore >= 6.0) healthStatus = 'STABLE';
    else healthStatus = 'MODERATE_DEBT';

    // Valuation Posture
    let valuationPosture: ValuationPosture = 'FAIR_VALUE';
    if (valScore >= 7.8) valuationPosture = 'DEEP_VALUE';
    else if (valScore >= 5.2) valuationPosture = 'FAIR_VALUE';
    else if (valScore >= 3.2) valuationPosture = 'RICHLY_VALUED';
    else valuationPosture = 'SPECULATIVE_BUBBLE';

    // Piotroski & Altman Estimates
    const piotroskiFScoreEstimate = Math.min(9, Math.max(2, Math.round((fundScore / 10) * 8) + 1));
    const altmanZScoreEstimate = Number((1.5 + (fundScore / 10) * 3.2 - (debtToEquity ? debtToEquity / 200 : 0)).toFixed(2));

    // Tactical Execution Parameters
    const buyMin = Number((currentPrice * 0.94).toFixed(2));
    const buyMax = Number((currentPrice * 1.01).toFixed(2));
    const targetPrice = fairValueEstimate;
    const stopLossAnchor = Number((currentPrice * (beta > 1.4 ? 0.88 : 0.92)).toFixed(2));

    let tacticalAction = 'Hold position and monitor technical breakout levels.';
    if (overallScore >= 8.0) {
      tacticalAction = `High conviction buy. Allocate initial tranche in zone $${buyMin} - $${buyMax} with target $${targetPrice}.`;
    } else if (overallScore >= 6.8) {
      tacticalAction = `Accumulate on pullbacks. Scale into tranches near $${buyMin}.`;
    } else if (overallScore <= 4.0) {
      tacticalAction = `Elevated valuation/debt pressure. Consider taking profits or setting tight trailing stop at $${stopLossAnchor}.`;
    }

    const recommendedMaxAllocationPct = overallScore >= 8.5 ? 12 : overallScore >= 7.0 ? 8 : overallScore >= 5.0 ? 5 : 2;

    // Key Strengths & Risks
    const keyStrengths: string[] = [];
    if (opMargin && opMargin > 18) keyStrengths.push(`Robust operating margin (${opMargin.toFixed(1)}%) reflecting competitive moat.`);
    if (roe && roe > 15) keyStrengths.push(`Capital efficiency with ${roe.toFixed(1)}% Return on Equity.`);
    if (pe && pe > 0 && pe < 20) keyStrengths.push(`Attractive valuation multiple (P/E ${pe.toFixed(1)}x) offering margin of safety.`);
    if (distFrom52WHigh < -15) keyStrengths.push(`Significant discount (${distFrom52WHigh.toFixed(1)}%) from 52-week highs.`);
    if (keyStrengths.length === 0) keyStrengths.push('Established market liquidity and sector footprint.');

    const keyRisks: string[] = [];
    if (debtToEquity && debtToEquity > 130) keyRisks.push(`Leverage profile (Debt/Equity ${debtToEquity.toFixed(0)}%) warrants monitoring.`);
    if (pe && pe > 40) keyRisks.push(`Elevated earnings multiple (P/E ${pe.toFixed(1)}x) leaves minimal cushion for execution misses.`);
    if (beta > 1.4) keyRisks.push(`High market beta (${beta.toFixed(2)}) brings amplified macro drawdown exposure.`);
    if (keyRisks.length === 0) keyRisks.push('Macro cyclicality and sector multiple compression.');

    // Fallback narrative
    let scoreJustification = `Overall Score of ${overallScore}/10 (${gradeLabel}) combines Fundamentals (${fundScore}/10), Valuation Posture (${valScore}/10), and Buying Conviction (${buyingScore}/10). Driven by ${opMargin != null ? `${opMargin.toFixed(1)}% operating margins` : 'solid fundamentals'} and an estimated +${upsideToFairValue.toFixed(1)}% upside to fair value ($${fairValueEstimate}).`;
    let fundamentalSituation = `${name} (${cleanRaw}) trades at $${currentPrice.toFixed(2)} in the ${sector} (${industry}) sector. Financial health is rated ${healthStatus} with ${debtToEquity != null ? `debt-to-equity of ${debtToEquity.toFixed(1)}%` : 'balanced leverage'} and ${revGrowth != null ? `revenue growth of ${revGrowth.toFixed(1)}%` : 'steady performance'}. Free cash flow yield stands at ${fcfYield != null ? `${fcfYield.toFixed(1)}%` : 'adequate levels'}.`;
    let bullCase = `${cleanRaw} showcases a conviction score of ${overallScore}/10 underpinned by ${fundScore}/10 quality fundamentals and an estimated fair value target of $${fairValueEstimate} (+${upsideToFairValue.toFixed(1)}% upside).`;
    let bearCase = `Sustained macro compression, multiple re-rating or breakdown below $${stopLossAnchor} would invalidate the upside thesis.`;

    // ==========================================
    // AI AGENT EVALUATION (ENRICHMENT)
    // ==========================================
    try {
      const aiPrompt = `You are a top-tier institutional equity research analyst.
Evaluate ${cleanRaw} (${name}):
• Price: $${currentPrice.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)
• Sector: ${sector} | Industry: ${industry}
• Trailing P/E: ${trailingPE || 'N/A'} | Forward P/E: ${forwardPE || 'N/A'}
• Operating Margin: ${opMargin != null ? `${opMargin.toFixed(1)}%` : 'N/A'} | ROE: ${roe != null ? `${roe.toFixed(1)}%` : 'N/A'}
• Debt to Equity: ${debtToEquity != null ? `${debtToEquity.toFixed(1)}%` : 'N/A'} | Rev Growth: ${revGrowth != null ? `${revGrowth.toFixed(1)}%` : 'N/A'}
• Computed Scores: Overall ${overallScore}/10, Fundamentals ${fundScore}/10, Valuation ${valScore}/10, Buying ${buyingScore}/10

Provide a concise, highly professional institutional assessment.
Return ONLY valid JSON matching this schema:
{
  "scoreJustification": "Clear 2-3 sentence explanation justifying why the stock scored ${overallScore}/10 across valuation, fundamentals, and conviction.",
  "fundamentalSituation": "Clear 2-3 sentence grounded diagnosis of the company's real-world fundamental situation: economic moat, margin stability, balance sheet health, and growth runway.",
  "bullCase": "1-2 sentence core bull catalyst.",
  "bearCase": "1-2 sentence core risk/downside invalidation."
}`;

      const aiRes = await generateJsonCompletion<{
        scoreJustification: string;
        fundamentalSituation: string;
        bullCase: string;
        bearCase: string;
      }>({
        userPrompt: aiPrompt,
        temperature: 0.2,
        maxTokens: 500,
        timeoutMs: 15000,
        tag: `[ScorecardAI-${cleanRaw}]`,
      }).catch(() => null);

      if (aiRes?.data) {
        if (aiRes.data.scoreJustification?.trim()) scoreJustification = aiRes.data.scoreJustification.trim();
        if (aiRes.data.fundamentalSituation?.trim()) fundamentalSituation = aiRes.data.fundamentalSituation.trim();
        if (aiRes.data.bullCase?.trim()) bullCase = aiRes.data.bullCase.trim();
        if (aiRes.data.bearCase?.trim()) bearCase = aiRes.data.bearCase.trim();
      }
    } catch (e: any) {
      console.warn(`[ScorecardAI] AI enrichment fallback for ${cleanRaw}:`, e.message);
    }

    const scorecard: StockScorecard = {
      symbol: cleanRaw,
      name,
      price: currentPrice,
      change,
      changePercent,
      currency,
      sector,
      industry,
      marketCap,
      beta,
      overallScore,
      grade,
      gradeLabel,
      buyingConvictionScore: buyingScore,
      fundamentalsScore: fundScore,
      valuationScore: valScore,
      momentumScore,
      healthStatus,
      valuationPosture,
      metrics: {
        priceTo52WeekHighPct: Number(distFrom52WHigh.toFixed(2)),
        distanceFrom52WeekLowPct: Number(distFrom52WLow.toFixed(2)),
        technicalSetupScore: buyingScore,
        momentumScore,
        upsideToFairValuePct: Number(upsideToFairValue.toFixed(1)),
        operatingMarginPct: opMargin != null ? Number(opMargin.toFixed(1)) : null,
        netMarginPct: netMargin != null ? Number(netMargin.toFixed(1)) : null,
        roePct: roe != null ? Number(roe.toFixed(1)) : null,
        debtToEquity: debtToEquity != null ? Number(debtToEquity.toFixed(1)) : null,
        currentRatio: currentRatio != null ? Number(currentRatio.toFixed(2)) : null,
        fcfYieldPct: fcfYield != null ? Number(fcfYield.toFixed(2)) : null,
        revenueGrowthPct: revGrowth != null ? Number(revGrowth.toFixed(1)) : null,
        piotroskiFScoreEstimate,
        altmanZScoreEstimate,
        trailingPE: trailingPE != null ? Number(trailingPE.toFixed(1)) : null,
        forwardPE: forwardPE != null ? Number(forwardPE.toFixed(1)) : null,
        priceToSales: priceToSales != null ? Number(priceToSales.toFixed(2)) : null,
        pegRatio: pegRatio != null ? Number(pegRatio.toFixed(2)) : null,
        evToEbitda: evToEbitda != null ? Number(evToEbitda.toFixed(1)) : null,
        fairValueEstimate,
      },
      tacticalAction,
      suggestedBuyZone: { min: buyMin, max: buyMax },
      targetPrice,
      stopLossAnchor,
      recommendedMaxAllocationPct,
      scoreJustification,
      fundamentalSituation,
      keyStrengths,
      keyRisks,
      bullCase,
      bearCase,
      isHolding: Boolean(holdingData),
      holdingDetails: holdingData,
      brokers: holdingData?.broker ? [holdingData.broker] : [],
      isWatchlist: Boolean(watchlistNames && watchlistNames.length > 0),
      watchlistNames,
      analyzedAt: new Date().toISOString(),
    };

    // Cache in memory
    memoryCache.set(cleanRaw, { card: scorecard, timestamp: Date.now() });

    // Persist permanently in database if Prisma is provided
    if (prisma) {
      try {
        await prisma.stockScorecardRecord.upsert({
          where: { symbol: cleanRaw },
          create: {
            symbol: cleanRaw,
            name: scorecard.name,
            price: scorecard.price,
            change: scorecard.change,
            changePercent: scorecard.changePercent,
            currency: scorecard.currency,
            sector: scorecard.sector,
            industry: scorecard.industry,
            marketCap: scorecard.marketCap,
            beta: scorecard.beta,
            overallScore: scorecard.overallScore,
            buyingConvictionScore: scorecard.buyingConvictionScore,
            fundamentalsScore: scorecard.fundamentalsScore,
            valuationScore: scorecard.valuationScore,
            momentumScore: scorecard.momentumScore,
            grade: scorecard.grade,
            gradeLabel: scorecard.gradeLabel,
            healthStatus: scorecard.healthStatus,
            valuationPosture: scorecard.valuationPosture,
            scoreJustification: scorecard.scoreJustification,
            fundamentalSituation: scorecard.fundamentalSituation,
            bullCase: scorecard.bullCase,
            bearCase: scorecard.bearCase,
            tacticalAction: scorecard.tacticalAction,
            fairValueEstimate: scorecard.metrics.fairValueEstimate,
            upsideToFairValuePct: scorecard.metrics.upsideToFairValuePct,
            suggestedBuyZoneMin: scorecard.suggestedBuyZone.min,
            suggestedBuyZoneMax: scorecard.suggestedBuyZone.max,
            targetPrice: scorecard.targetPrice,
            stopLossAnchor: scorecard.stopLossAnchor,
            recommendedMaxAllocationPct: scorecard.recommendedMaxAllocationPct,
            metricsJson: JSON.stringify(scorecard.metrics),
            rawCardJson: JSON.stringify(scorecard),
            analyzedAt: new Date(scorecard.analyzedAt),
          },
          update: {
            name: scorecard.name,
            price: scorecard.price,
            change: scorecard.change,
            changePercent: scorecard.changePercent,
            currency: scorecard.currency,
            sector: scorecard.sector,
            industry: scorecard.industry,
            marketCap: scorecard.marketCap,
            beta: scorecard.beta,
            overallScore: scorecard.overallScore,
            buyingConvictionScore: scorecard.buyingConvictionScore,
            fundamentalsScore: scorecard.fundamentalsScore,
            valuationScore: scorecard.valuationScore,
            momentumScore: scorecard.momentumScore,
            grade: scorecard.grade,
            gradeLabel: scorecard.gradeLabel,
            healthStatus: scorecard.healthStatus,
            valuationPosture: scorecard.valuationPosture,
            scoreJustification: scorecard.scoreJustification,
            fundamentalSituation: scorecard.fundamentalSituation,
            bullCase: scorecard.bullCase,
            bearCase: scorecard.bearCase,
            tacticalAction: scorecard.tacticalAction,
            fairValueEstimate: scorecard.metrics.fairValueEstimate,
            upsideToFairValuePct: scorecard.metrics.upsideToFairValuePct,
            suggestedBuyZoneMin: scorecard.suggestedBuyZone.min,
            suggestedBuyZoneMax: scorecard.suggestedBuyZone.max,
            targetPrice: scorecard.targetPrice,
            stopLossAnchor: scorecard.stopLossAnchor,
            recommendedMaxAllocationPct: scorecard.recommendedMaxAllocationPct,
            metricsJson: JSON.stringify(scorecard.metrics),
            rawCardJson: JSON.stringify(scorecard),
            analyzedAt: new Date(scorecard.analyzedAt),
          },
        });
      } catch (dbErr: any) {
        console.warn(`[Scorecard DB Save Error] for ${cleanRaw}:`, dbErr.message);
      }
    }

    return scorecard;
  } catch (err: any) {
    console.error(`Error evaluating scorecard for ${cleanRaw}:`, err?.message || err);
    throw err;
  }
}

/**
 * Fetch all scorecards from Database (Instant Read, zero API Hammering on startup)
 */
export async function getScorecardsHubData(prisma: PrismaClient): Promise<ScorecardsHubResponse> {
  // 1. Fetch persistent scorecards from database
  const savedRecords = await prisma.stockScorecardRecord.findMany({
    orderBy: { overallScore: 'desc' },
  });

  // 2. Fetch DB Holdings for badge, broker, and position context
  const holdings = await prisma.holding.findMany({
    where: {
      quantity: { not: 0 },
      assetType: { in: ['EQUITY', 'Stock', 'ETF'] },
    },
    include: { broker: true },
  });

  const holdingSymbolsMap = new Map<string, any>();
  const holdingBrokersMap = new Map<string, Set<string>>();

  holdings.forEach((h) => {
    const clean = resolveYahooFinanceSymbol(h.symbol, h.currency || undefined).toUpperCase();
    const raw = h.symbol.trim().toUpperCase();
    const brokerName = h.broker?.name || 'Interactive Brokers';

    [clean, raw].forEach((s) => {
      if (!holdingBrokersMap.has(s)) {
        holdingBrokersMap.set(s, new Set<string>());
      }
      holdingBrokersMap.get(s)!.add(brokerName);
    });

    const detail = {
      quantity: h.quantity,
      averageCost: h.averageCost,
      marketValue: h.marketValue,
      unrealizedPnL: h.unrealizedPnL,
      unrealizedPnLPercent: h.unrealizedPnLPercent,
      broker: brokerName,
    };

    if (!holdingSymbolsMap.has(clean)) holdingSymbolsMap.set(clean, detail);
    if (!holdingSymbolsMap.has(raw)) holdingSymbolsMap.set(raw, detail);
  });

  // 3. Fetch Watchlists for badge and categorization context
  const watchlists = await prisma.watchlist.findMany({
    include: { items: true },
  });

  const watchlistSymbolsMap = new Map<string, string[]>();
  watchlists.forEach((w) => {
    w.items.forEach((item) => {
      const sym = resolveYahooFinanceSymbol(item.symbol).toUpperCase();
      const raw = item.symbol.trim().toUpperCase();
      [sym, raw].forEach((s) => {
        const existing = watchlistSymbolsMap.get(s) || [];
        if (!existing.includes(w.name)) {
          existing.push(w.name);
        }
        watchlistSymbolsMap.set(s, existing);
      });
    });
  });

  // Map persistent records into StockScorecard objects with 1 to N ranking
  const scorecards: StockScorecard[] = savedRecords.map((rec, index) => {
    let metrics: ScorecardSubMetrics;
    try {
      metrics = JSON.parse(rec.metricsJson);
    } catch {
      metrics = {
        priceTo52WeekHighPct: 0,
        distanceFrom52WeekLowPct: 0,
        technicalSetupScore: rec.buyingConvictionScore,
        momentumScore: rec.momentumScore,
        upsideToFairValuePct: rec.upsideToFairValuePct,
        operatingMarginPct: null,
        netMarginPct: null,
        roePct: null,
        debtToEquity: null,
        currentRatio: null,
        fcfYieldPct: null,
        revenueGrowthPct: null,
        piotroskiFScoreEstimate: 5,
        altmanZScoreEstimate: 2.5,
        trailingPE: null,
        forwardPE: null,
        priceToSales: null,
        pegRatio: null,
        evToEbitda: null,
        fairValueEstimate: rec.fairValueEstimate,
      };
    }

    const symUpper = rec.symbol.trim().toUpperCase();
    const cleanSymUpper = resolveYahooFinanceSymbol(rec.symbol).toUpperCase();

    const holdingData = holdingSymbolsMap.get(symUpper) || holdingSymbolsMap.get(cleanSymUpper);
    const brokersSet = new Set<string>();
    (holdingBrokersMap.get(symUpper) || []).forEach((b) => brokersSet.add(b));
    (holdingBrokersMap.get(cleanSymUpper) || []).forEach((b) => brokersSet.add(b));
    if (holdingData?.broker) brokersSet.add(holdingData.broker);
    const brokersList = Array.from(brokersSet);

    const watchlistNamesSet = new Set<string>();
    (watchlistSymbolsMap.get(symUpper) || []).forEach((w) => watchlistNamesSet.add(w));
    (watchlistSymbolsMap.get(cleanSymUpper) || []).forEach((w) => watchlistNamesSet.add(w));
    const watchlistList = Array.from(watchlistNamesSet);

    return {
      symbol: rec.symbol,
      name: rec.name,
      price: rec.price,
      change: rec.change,
      changePercent: rec.changePercent,
      currency: rec.currency,
      sector: rec.sector,
      industry: rec.industry,
      marketCap: rec.marketCap,
      beta: rec.beta,
      overallScore: rec.overallScore,
      rank: index + 1, // 1 to N ranking
      grade: rec.grade as ConvictionGrade,
      gradeLabel: rec.gradeLabel,
      buyingConvictionScore: rec.buyingConvictionScore,
      fundamentalsScore: rec.fundamentalsScore,
      valuationScore: rec.valuationScore,
      momentumScore: rec.momentumScore,
      healthStatus: rec.healthStatus as HealthStatus,
      valuationPosture: rec.valuationPosture as ValuationPosture,
      metrics,
      tacticalAction: rec.tacticalAction,
      suggestedBuyZone: { min: rec.suggestedBuyZoneMin, max: rec.suggestedBuyZoneMax },
      targetPrice: rec.targetPrice,
      stopLossAnchor: rec.stopLossAnchor,
      recommendedMaxAllocationPct: rec.recommendedMaxAllocationPct,
      scoreJustification: rec.scoreJustification,
      fundamentalSituation: rec.fundamentalSituation,
      bullCase: rec.bullCase,
      bearCase: rec.bearCase,
      keyStrengths: [
        rec.fundamentalsScore >= 7.5 ? 'Strong balance sheet & margin efficiency.' : 'Established sector market presence.',
        rec.valuationScore >= 7.0 ? 'Favorable valuation with margin of safety.' : 'Liquid institutional volume.',
      ],
      keyRisks: [
        rec.beta > 1.3 ? 'Heightened systemic beta sensitivity.' : 'Sector macro cycle risk.',
      ],
      isHolding: brokersList.length > 0 || Boolean(holdingData),
      holdingDetails: holdingData ? { ...holdingData, broker: brokersList[0] || holdingData.broker, brokers: brokersList } : undefined,
      brokers: brokersList,
      isWatchlist: watchlistList.length > 0,
      watchlistNames: watchlistList,
      analyzedAt: rec.analyzedAt.toISOString(),
    };
  });

  const holdingsItems = scorecards.filter((s) => s.isHolding);
  const watchlistItems = scorecards.filter((s) => s.isWatchlist);

  const avgOverall = scorecards.length > 0
    ? Number((scorecards.reduce((sum, s) => sum + s.overallScore, 0) / scorecards.length).toFixed(1))
    : 0;
  const avgHoldings = holdingsItems.length > 0
    ? Number((holdingsItems.reduce((sum, s) => sum + s.overallScore, 0) / holdingsItems.length).toFixed(1))
    : 0;
  const avgWatchlist = watchlistItems.length > 0
    ? Number((watchlistItems.reduce((sum, s) => sum + s.overallScore, 0) / watchlistItems.length).toFixed(1))
    : 0;

  const topConvictionPick = scorecards[0] || null;
  const topValuePick = [...scorecards].sort((a, b) => b.valuationScore - a.valuationScore)[0] || null;
  const topQualityPick = [...scorecards].sort((a, b) => b.fundamentalsScore - a.fundamentalsScore)[0] || null;

  const sectorSet = new Set<string>();
  scorecards.forEach((s) => {
    if (s.sector && s.sector !== 'N/A' && s.sector !== 'General') {
      sectorSet.add(s.sector);
    }
  });

  // Collect all unique brokers and watchlists with their counts
  const brokerMap = new Map<string, number>();
  const watchlistMap = new Map<string, number>();

  scorecards.forEach((s) => {
    (s.brokers || []).forEach((b) => {
      brokerMap.set(b, (brokerMap.get(b) || 0) + 1);
    });
    (s.watchlistNames || []).forEach((w) => {
      watchlistMap.set(w, (watchlistMap.get(w) || 0) + 1);
    });
  });

  const availableBrokers = Array.from(brokerMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const availableWatchlists = Array.from(watchlistMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    scorecards,
    summary: {
      totalEvaluated: scorecards.length,
      holdingsCount: holdingsItems.length,
      watchlistCount: watchlistItems.length,
      avgOverallScore: avgOverall,
      avgHoldingsScore: avgHoldings,
      avgWatchlistScore: avgWatchlist,
      topConvictionPick,
      topValuePick,
      topQualityPick,
    },
    sectors: Array.from(sectorSet).sort(),
    brokers: availableBrokers,
    watchlists: availableWatchlists,
    timestamp: Date.now(),
  };
}

/**
 * Refresh a single stock immediately
 */
export async function refreshSingleStockScorecard(
  rawSymbol: string,
  prisma: PrismaClient
): Promise<StockScorecard | null> {
  const cleanRaw = resolveYahooFinanceSymbol(rawSymbol);
  
  // Fetch holding and watchlist context
  const holding = await prisma.holding.findFirst({
    where: {
      quantity: { not: 0 },
      symbol: { startsWith: cleanRaw },
    },
    include: { broker: true },
  });

  const holdingData = holding ? {
    quantity: holding.quantity,
    averageCost: holding.averageCost,
    marketValue: holding.marketValue,
    unrealizedPnL: holding.unrealizedPnL,
    unrealizedPnLPercent: holding.unrealizedPnLPercent,
    broker: holding.broker?.name || 'Broker',
  } : undefined;

  const watchlists = await prisma.watchlistItem.findMany({
    where: { symbol: { startsWith: cleanRaw } },
    include: { watchlist: true },
  });
  const watchlistNames = watchlists.map((w) => w.watchlist.name);

  // Clear memory cache to force re-computation
  memoryCache.delete(cleanRaw);

  const card = await evaluateStockScorecard(cleanRaw, holdingData, watchlistNames, prisma);
  return card;
}

/**
 * AI Latest Earnings Analysis Agent
 */
export async function analyzeLatestEarningsForStock(
  rawSymbol: string
): Promise<LatestEarningsAnalysisResult> {
  const cleanRaw = resolveYahooFinanceSymbol(rawSymbol);

  const summary = await yahooFinance.quoteSummary(
    cleanRaw,
    {
      modules: ['price', 'earnings', 'earningsHistory', 'earningsTrend', 'financialData', 'defaultKeyStatistics'],
    },
    { validateResult: false }
  ).catch((err) => {
    throw new Error(`Failed to fetch earnings modules for ${cleanRaw}: ${err.message}`);
  });

  const priceModule = summary?.price;
  const earningsModule = summary?.earnings;
  const historyModule = summary?.earningsHistory;
  const financials = summary?.financialData;

  const companyName = priceModule?.shortName || priceModule?.longName || cleanRaw;
  const currentPrice = Number(priceModule?.regularMarketPrice || 0);

  // Parse Quarterly EPS comparisons
  const rawHistory = historyModule?.history || [];
  const quarters: EarningsQuarterComparison[] = rawHistory.slice(0, 4).map((h: any) => {
    const qDate = h.quarter ? new Date(h.quarter).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Quarter';
    const epsActual = h.epsActual != null ? Number(h.epsActual) : null;
    const epsEstimate = h.epsEstimate != null ? Number(h.epsEstimate) : null;
    const surprise = h.surprisePercent != null ? Number(h.surprisePercent) * 100 : null;

    return {
      quarter: qDate,
      epsActual,
      epsEstimate,
      epsSurprisePct: surprise != null ? Number(surprise.toFixed(1)) : null,
      revenue: null,
      earnings: null,
    };
  });

  // Attach quarterly revenue if available
  const quarterlyFinancials = earningsModule?.financialsChart?.quarterly || [];
  quarterlyFinancials.slice(-4).forEach((q: any, idx: number) => {
    if (quarters[idx]) {
      quarters[idx].revenue = q.revenue != null ? Number(q.revenue) : null;
      quarters[idx].earnings = q.earnings != null ? Number(q.earnings) : null;
    }
  });

  const latestQ = quarters[0] || null;
  const isBeat = latestQ?.epsSurprisePct != null ? latestQ.epsSurprisePct > 0 : true;
  
  let verdict: LatestEarningsAnalysisResult['verdict'] = 'IN_LINE';
  let verdictLabel = 'Met Expectations (In-Line)';
  if (latestQ?.epsSurprisePct != null) {
    if (latestQ.epsSurprisePct >= 10) {
      verdict = 'STRONG_BEAT';
      verdictLabel = `Strong Double-Digit Beat (+${latestQ.epsSurprisePct}%)`;
    } else if (latestQ.epsSurprisePct > 1) {
      verdict = 'MODEST_BEAT';
      verdictLabel = `Modest Earnings Beat (+${latestQ.epsSurprisePct}%)`;
    } else if (latestQ.epsSurprisePct <= -10) {
      verdict = 'BIG_MISS';
      verdictLabel = `Substantial Earnings Miss (${latestQ.epsSurprisePct}%)`;
    } else if (latestQ.epsSurprisePct < -1) {
      verdict = 'MODEST_MISS';
      verdictLabel = `Modest Earnings Miss (${latestQ.epsSurprisePct}%)`;
    }
  }

  // AI Agent Briefing synthesis
  let executiveDiagnosis = `${companyName} (${cleanRaw}) reported latest EPS of $${latestQ?.epsActual ?? 'N/A'} vs consensus expectations of $${latestQ?.epsEstimate ?? 'N/A'}${latestQ?.epsSurprisePct != null ? ` (${latestQ.epsSurprisePct >= 0 ? '+' : ''}${latestQ.epsSurprisePct}% surprise)` : ''}. Financial momentum remains aligned with quarterly operating targets.`;
  let guidanceCommentary = 'Forward operating targets remain stable with management maintaining margin vigilance in current macro conditions.';
  let recommendedScoreAdjustment = isBeat ? 0.3 : -0.4;
  let fairValueAdjustmentPct = isBeat ? 5.0 : -4.0;
  let analystSummary = `${verdictLabel}. Operating trajectory supports current scorecard positioning.`;
  let keyFocusPoints = [
    'Revenue trajectory across core divisions.',
    'Operating margin durability and pricing power.',
    'Next quarter forward guidance commentary.',
  ];

  try {
    const aiPrompt = `You are a Wall Street senior technology & equity analyst.
Analyze the latest quarterly earnings results for ${cleanRaw} (${companyName}):
• Current Spot: $${currentPrice.toFixed(2)}
• Latest EPS: $${latestQ?.epsActual ?? 'N/A'} vs $${latestQ?.epsEstimate ?? 'N/A'} consensus (${latestQ?.epsSurprisePct != null ? `${latestQ.epsSurprisePct}% surprise` : 'N/A'})
• Historical Quarters: ${JSON.stringify(quarters.slice(0, 3))}
• Profit Margin: ${financials?.profitMargins ? (financials.profitMargins * 100).toFixed(1) + '%' : 'N/A'}
• Revenue Growth: ${financials?.revenueGrowth ? (financials.revenueGrowth * 100).toFixed(1) + '%' : 'N/A'}

Provide an executive earnings diagnosis.
Return ONLY valid JSON matching this schema:
{
  "executiveDiagnosis": "2-3 sentences diagnosing the quality of the earnings beat/miss, revenue quality, and underlying business momentum.",
  "guidanceCommentary": "1-2 sentences summarizing forward guidance, margin outlook, and capital allocation.",
  "recommendedScoreAdjustment": 0.4, // Numerical adjustment to the 1-10 overall scorecard (e.g. +0.5 for blowout beat, -0.6 for guidance cut)
  "fairValueAdjustmentPct": 6.0, // Numerical % adjustment to fair value target (+/- percentage)
  "analystSummary": "1 sentence concise bottom-line takeaway for investors.",
  "keyFocusPoints": ["Core driver 1", "Core driver 2", "Key risk to watch"]
}`;

    const aiRes = await generateJsonCompletion<{
      executiveDiagnosis: string;
      guidanceCommentary: string;
      recommendedScoreAdjustment: number;
      fairValueAdjustmentPct: number;
      analystSummary: string;
      keyFocusPoints: string[];
    }>({
      userPrompt: aiPrompt,
      temperature: 0.2,
      maxTokens: 550,
      timeoutMs: 18000,
      tag: `[EarningsAI-${cleanRaw}]`,
    }).catch(() => null);

    if (aiRes?.data) {
      if (aiRes.data.executiveDiagnosis) executiveDiagnosis = aiRes.data.executiveDiagnosis;
      if (aiRes.data.guidanceCommentary) guidanceCommentary = aiRes.data.guidanceCommentary;
      if (typeof aiRes.data.recommendedScoreAdjustment === 'number') recommendedScoreAdjustment = aiRes.data.recommendedScoreAdjustment;
      if (typeof aiRes.data.fairValueAdjustmentPct === 'number') fairValueAdjustmentPct = aiRes.data.fairValueAdjustmentPct;
      if (aiRes.data.analystSummary) analystSummary = aiRes.data.analystSummary;
      if (Array.isArray(aiRes.data.keyFocusPoints) && aiRes.data.keyFocusPoints.length > 0) {
        keyFocusPoints = aiRes.data.keyFocusPoints;
      }
    }
  } catch (e: any) {
    console.warn(`[EarningsAI] AI briefing fallback for ${cleanRaw}:`, e.message);
  }

  return {
    symbol: cleanRaw,
    companyName,
    currentPrice,
    reportDate: latestQ?.quarter || null,
    timing: 'UNSPECIFIED',
    isBeat,
    verdict,
    verdictLabel,
    quarters,
    executiveDiagnosis,
    guidanceCommentary,
    scorecardImpact: {
      recommendedScoreAdjustment,
      fairValueAdjustmentPct,
      analystSummary,
    },
    keyFocusPoints,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Compare multiple stocks head-to-head on 1-10 scale
 */
export async function compareStockScorecards(
  symbols: string[],
  prisma: PrismaClient
): Promise<{
  candidates: StockScorecard[];
  winners: {
    overall: string;
    buyingConviction: string;
    fundamentals: string;
    valuation: string;
    marginOfSafety: string;
  };
  keyTakeaways: string[];
}> {
  const cleanSymbols = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)));
  const scorecards: StockScorecard[] = [];

  for (const sym of cleanSymbols) {
    // Read from DB first
    const saved = await prisma.stockScorecardRecord.findUnique({ where: { symbol: sym } });
    if (saved) {
      const card = await evaluateStockScorecard(sym, undefined, undefined, prisma);
      if (card) scorecards.push(card);
    } else {
      const card = await evaluateStockScorecard(sym, undefined, undefined, prisma);
      if (card) scorecards.push(card);
    }
  }

  if (scorecards.length === 0) {
    return {
      candidates: [],
      winners: { overall: '', buyingConviction: '', fundamentals: '', valuation: '', marginOfSafety: '' },
      keyTakeaways: [],
    };
  }

  const bestOverall = [...scorecards].sort((a, b) => b.overallScore - a.overallScore)[0];
  const bestBuying = [...scorecards].sort((a, b) => b.buyingConvictionScore - a.buyingConvictionScore)[0];
  const bestFund = [...scorecards].sort((a, b) => b.fundamentalsScore - a.fundamentalsScore)[0];
  const bestVal = [...scorecards].sort((a, b) => b.valuationScore - a.valuationScore)[0];
  const bestSafety = [...scorecards].sort((a, b) => b.metrics.upsideToFairValuePct - a.metrics.upsideToFairValuePct)[0];

  const takeaways: string[] = [
    `${bestOverall.symbol} leads the cohort with an Overall Conviction Score of ${bestOverall.overallScore}/10 (${bestOverall.gradeLabel}).`,
    `${bestFund.symbol} exhibits the highest quality profile with a Fundamentals Score of ${bestFund.fundamentalsScore}/10 and ${bestFund.metrics.operatingMarginPct ?? 'N/A'}% operating margin.`,
    `${bestVal.symbol} represents the most compelling valuation posture with a Valuation Score of ${bestVal.valuationScore}/10.`,
  ];

  return {
    candidates: scorecards,
    winners: {
      overall: bestOverall.symbol,
      buyingConviction: bestBuying.symbol,
      fundamentals: bestFund.symbol,
      valuation: bestVal.symbol,
      marginOfSafety: bestSafety.symbol,
    },
    keyTakeaways: takeaways,
  };
}
