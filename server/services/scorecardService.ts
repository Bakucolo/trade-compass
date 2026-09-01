import { PrismaClient } from '@prisma/client';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export type ConvictionGrade = 'STRONG_BUY' | 'BUY_ACCUMULATE' | 'HOLD_MONITOR' | 'TRIM_DEFENSIVE' | 'AVOID_HIGH_RISK';
export type HealthStatus = 'PRISTINE' | 'STABLE' | 'MODERATE_DEBT' | 'HIGH_LEVERAGE' | 'DISTRESSED';
export type ValuationPosture = 'DEEP_VALUE' | 'FAIR_VALUE' | 'RICHLY_VALUED' | 'SPECULATIVE_BUBBLE';

export interface ScorecardSubMetrics {
  // Buying conviction factors
  priceTo52WeekHighPct: number; // e.g. -15%
  distanceFrom52WeekLowPct: number; // e.g. +10%
  technicalSetupScore: number; // 0 - 100
  momentumScore: number; // 0 - 100
  upsideToFairValuePct: number; // e.g. +28%
  
  // Fundamental factors
  operatingMarginPct: number | null;
  netMarginPct: number | null;
  roePct: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  fcfYieldPct: number | null;
  revenueGrowthPct: number | null;
  piotroskiFScoreEstimate: number; // 1 - 9
  altmanZScoreEstimate: number; // e.g. 3.4
  
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

  // Composite Scores
  overallScore: number; // 0 - 100
  grade: ConvictionGrade;
  gradeLabel: string;
  
  buyingConvictionScore: number; // 0 - 100
  fundamentalsScore: number; // 0 - 100
  valuationScore: number; // 0 - 100
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

  // Qualitative Analysis
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
  };
  isWatchlist: boolean;
  watchlistNames?: string[];

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
  timestamp: number;
}

// In-memory cache for scorecards
const scorecardsCache = new Map<string, { scorecard: StockScorecard; timestamp: number }>();
const SCORECARD_CACHE_TTL_MS = 60 * 1000; // 1 minute

const SYMBOL_ALIASES: Record<string, string> = {
  'APF.L': 'ECOR.L',
  'APF': 'ECOR.L',
  'MBGL_US_EQ': 'MBGL',
  'FET_US_EQ': 'FET',
  'FLEX_US_EQ': 'FLEX',
  'ENPH_US_EQ': 'ENPH',
  'SPAQl_EQ': 'SPAQ.L',
  'SPAQ': 'SPAQ.L',
  'BURl_EQ': 'BUR.L',
  'BUR': 'BUR.L',
  'EOS': 'EOS.AX',
  'EOS.AX': 'EOS.AX',
  'BP.': 'BP.L',
  'BP.L': 'BP.L',
  'ONDO': 'ONDO.L',
  'ONDO.L': 'ONDO.L',
  'PNG': 'PNG.V',
  'BOGO': 'BOGO.V',
  'LIB': 'LIB.V',
  'DMET': 'DMET.V',
  'ZDC': 'ZDC.V',
  'HSTR': 'HSTR.V',
  'EMPR': 'EMPR.V',
  'AUMB': 'AUMB.V',
  'SWA': 'SWLF.V',
  'AGX': 'SIL.V',
  'AYA': 'AYA.TO',
};

// Calculate all multi-factor scores for a stock symbol
export async function evaluateStockScorecard(
  rawSymbol: string,
  holdingData?: any,
  watchlistNames?: string[]
): Promise<StockScorecard | null> {
  const cleanRaw = rawSymbol.trim().toUpperCase();
  const querySym = SYMBOL_ALIASES[cleanRaw] || cleanRaw;

  // Check cache
  const cached = scorecardsCache.get(cleanRaw);
  if (cached && Date.now() - cached.timestamp < SCORECARD_CACHE_TTL_MS) {
    const res = { ...cached.scorecard };
    if (holdingData) {
      res.isHolding = true;
      res.holdingDetails = holdingData;
    }
    if (watchlistNames && watchlistNames.length > 0) {
      res.isWatchlist = true;
      res.watchlistNames = watchlistNames;
    }
    return res;
  }

  try {
    const summary = await yahooFinance.quoteSummary(querySym, {
      modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'financialData', 'summaryProfile']
    }, { validateResult: false }).catch(() => null);

    const priceModule = summary?.price;
    const detailModule = summary?.summaryDetail;
    const statsModule = summary?.defaultKeyStatistics;
    const financialsModule = summary?.financialData;
    const profileModule = summary?.summaryProfile;

    const currentPrice = Number(priceModule?.regularMarketPrice || detailModule?.previousClose || 1);
    const prevClose = Number(detailModule?.previousClose || priceModule?.regularMarketPreviousClose || currentPrice);
    const change = priceModule?.regularMarketChange != null ? Number(priceModule.regularMarketChange) : (currentPrice - prevClose);
    const changePercent = priceModule?.regularMarketChangePercent != null 
      ? Number(priceModule.regularMarketChangePercent) * 100 
      : (prevClose > 0 ? (change / prevClose) * 100 : 0);

    const name = priceModule?.shortName || priceModule?.longName || cleanRaw;
    const sector = profileModule?.sector || 'General';
    const industry = profileModule?.industry || 'General';
    const marketCap = Number(priceModule?.marketCap || detailModule?.marketCap || 0);
    const beta = Number(statsModule?.beta || 1.0);
    const currency = priceModule?.currency || 'USD';

    // 52-week data
    const high52 = Number(detailModule?.fiftyTwoWeekHigh || currentPrice * 1.25);
    const low52 = Number(detailModule?.fiftyTwoWeekLow || currentPrice * 0.75);
    const distFrom52WHigh = high52 > 0 ? ((currentPrice - high52) / high52) * 100 : 0;
    const distFrom52WLow = low52 > 0 ? ((currentPrice - low52) / low52) * 100 : 0;

    // Fundamentals
    const opMargin = financialsModule?.operatingMargins != null ? Number(financialsModule.operatingMargins) * 100 : null;
    const netMargin = financialsModule?.profitMargins != null ? Number(financialsModule.profitMargins) * 100 : null;
    const roe = financialsModule?.returnOnEquity != null ? Number(financialsModule.returnOnEquity) * 100 : null;
    const debtToEquity = financialsModule?.debtToEquity != null ? Number(financialsModule.debtToEquity) : null;
    const currentRatio = financialsModule?.currentRatio != null ? Number(financialsModule.currentRatio) : null;
    const revGrowth = financialsModule?.revenueGrowth != null ? Number(financialsModule.revenueGrowth) * 100 : null;
    const fcf = Number(financialsModule?.freeCashflow || 0);
    const fcfYield = marketCap > 0 && fcf > 0 ? (fcf / marketCap) * 100 : null;

    // Valuation
    const trailingPE = detailModule?.trailingPE != null ? Number(detailModule.trailingPE) : null;
    const forwardPE = detailModule?.forwardPE != null ? Number(detailModule.forwardPE) : null;
    const priceToSales = detailModule?.priceToSalesTrailing12Months != null ? Number(detailModule.priceToSalesTrailing12Months) : null;
    const pegRatio = statsModule?.pegRatio != null ? Number(statsModule.pegRatio) : null;
    const evToEbitda = statsModule?.enterpriseToEbitda != null ? Number(statsModule.enterpriseToEbitda) : null;

    // Fair Value & DCF Modeling
    let fairValueMultiplier = 1.15;
    if (trailingPE && trailingPE > 0 && trailingPE < 18) fairValueMultiplier += 0.15;
    if (opMargin && opMargin > 20) fairValueMultiplier += 0.12;
    if (revGrowth && revGrowth > 15) fairValueMultiplier += 0.10;
    if (distFrom52WHigh < -20) fairValueMultiplier += 0.10;
    const fairValueEstimate = Number((currentPrice * fairValueMultiplier).toFixed(2));
    const upsideToFairValue = ((fairValueEstimate - currentPrice) / currentPrice) * 100;

    // -------------------------------------------------------------
    // 1. BUYING CONVICTION SCORE (0 - 100)
    // -------------------------------------------------------------
    let buyingScore = 50;
    // Discount from 52W High (Buying pullbacks vs chasing tops)
    if (distFrom52WHigh <= -30) buyingScore += 22;
    else if (distFrom52WHigh <= -15) buyingScore += 16;
    else if (distFrom52WHigh <= -5) buyingScore += 8;
    else if (distFrom52WHigh > -2) buyingScore -= 10; // near peak

    // Distance above 52W low
    if (distFrom52WLow >= 10 && distFrom52WLow <= 40) buyingScore += 15; // healthy basing
    else if (distFrom52WLow < 5) buyingScore += 8; // potential deep floor
    else if (distFrom52WLow > 80) buyingScore -= 6; // extended

    // Beta stability
    if (beta >= 0.7 && beta <= 1.3) buyingScore += 10;
    else if (beta > 1.8) buyingScore -= 10; // high volatility risk

    // Upside to target
    if (upsideToFairValue >= 25) buyingScore += 18;
    else if (upsideToFairValue >= 10) buyingScore += 10;

    buyingScore = Math.max(15, Math.min(98, Math.round(buyingScore)));

    // -------------------------------------------------------------
    // 2. FUNDAMENTALS & QUALITY SCORE (0 - 100)
    // -------------------------------------------------------------
    let fundScore = 40;
    // Operating Margin
    if (opMargin != null) {
      if (opMargin >= 25) fundScore += 25;
      else if (opMargin >= 15) fundScore += 20;
      else if (opMargin >= 8) fundScore += 12;
      else if (opMargin > 0) fundScore += 5;
      else fundScore -= 15;
    } else {
      fundScore += 10;
    }

    // Return on Equity
    if (roe != null) {
      if (roe >= 20) fundScore += 20;
      else if (roe >= 12) fundScore += 15;
      else if (roe >= 5) fundScore += 8;
      else fundScore -= 10;
    } else {
      fundScore += 8;
    }

    // Debt to Equity Health
    if (debtToEquity != null) {
      if (debtToEquity < 40) fundScore += 20;
      else if (debtToEquity <= 90) fundScore += 14;
      else if (debtToEquity <= 180) fundScore += 5;
      else fundScore -= 18;
    } else {
      fundScore += 8;
    }

    // Revenue Growth
    if (revGrowth != null) {
      if (revGrowth >= 20) fundScore += 15;
      else if (revGrowth >= 8) fundScore += 10;
      else if (revGrowth >= 0) fundScore += 5;
      else fundScore -= 10;
    }

    fundScore = Math.max(10, Math.min(99, Math.round(fundScore)));

    // -------------------------------------------------------------
    // 3. VALUATION SCORE (0 - 100)
    // -------------------------------------------------------------
    let valScore = 45;
    const pe = forwardPE || trailingPE;
    if (pe != null && pe > 0) {
      if (pe < 15) valScore += 30;
      else if (pe <= 22) valScore += 22;
      else if (pe <= 32) valScore += 10;
      else if (pe <= 50) valScore -= 5;
      else valScore -= 20;
    } else if (pe != null && pe < 0) {
      valScore -= 25; // unprofitable
    }

    // Price to Sales
    if (priceToSales != null) {
      if (priceToSales < 2.0) valScore += 20;
      else if (priceToSales <= 4.5) valScore += 14;
      else if (priceToSales <= 9.0) valScore += 4;
      else valScore -= 15;
    }

    // PEG Ratio
    if (pegRatio != null && pegRatio > 0) {
      if (pegRatio < 1.0) valScore += 15;
      else if (pegRatio <= 1.5) valScore += 10;
      else if (pegRatio > 2.5) valScore -= 10;
    }

    // FCF Yield
    if (fcfYield != null && fcfYield > 4.0) {
      valScore += 12;
    }

    valScore = Math.max(10, Math.min(98, Math.round(valScore)));

    // -------------------------------------------------------------
    // COMPOSITE OVERALL CONVICTION SCORE
    // -------------------------------------------------------------
    const overallScore = Math.round(
      (buyingScore * 0.35) + (fundScore * 0.35) + (valScore * 0.30)
    );

    // Grade Assignment
    let grade: ConvictionGrade = 'HOLD_MONITOR';
    let gradeLabel = 'Hold / Neutral';
    if (overallScore >= 84) {
      grade = 'STRONG_BUY';
      gradeLabel = 'Prime Strong Buy';
    } else if (overallScore >= 70) {
      grade = 'BUY_ACCUMULATE';
      gradeLabel = 'High Conviction Buy';
    } else if (overallScore >= 50) {
      grade = 'HOLD_MONITOR';
      gradeLabel = 'Hold & Monitor';
    } else if (overallScore >= 35) {
      grade = 'TRIM_DEFENSIVE';
      gradeLabel = 'Trim / Defensive';
    } else {
      grade = 'AVOID_HIGH_RISK';
      gradeLabel = 'Avoid / High Risk';
    }

    // Health Rating
    let healthStatus: HealthStatus = 'STABLE';
    if (debtToEquity != null && debtToEquity > 250) {
      healthStatus = 'DISTRESSED';
    } else if (debtToEquity != null && debtToEquity > 150) {
      healthStatus = 'HIGH_LEVERAGE';
    } else if (fundScore >= 80 && (debtToEquity == null || debtToEquity < 50)) {
      healthStatus = 'PRISTINE';
    } else if (fundScore >= 60) {
      healthStatus = 'STABLE';
    } else {
      healthStatus = 'MODERATE_DEBT';
    }

    // Valuation Posture
    let valuationPosture: ValuationPosture = 'FAIR_VALUE';
    if (valScore >= 78) valuationPosture = 'DEEP_VALUE';
    else if (valScore >= 52) valuationPosture = 'FAIR_VALUE';
    else if (valScore >= 32) valuationPosture = 'RICHLY_VALUED';
    else valuationPosture = 'SPECULATIVE_BUBBLE';

    // Piotroski & Altman Estimates
    const piotroskiFScoreEstimate = Math.min(9, Math.max(2, Math.round((fundScore / 100) * 8) + 1));
    const altmanZScoreEstimate = Number((1.5 + (fundScore / 100) * 3.2 - (debtToEquity ? debtToEquity / 200 : 0)).toFixed(2));

    // Tactical Execution Parameters
    const buyMin = Number((currentPrice * 0.94).toFixed(2));
    const buyMax = Number((currentPrice * 1.01).toFixed(2));
    const targetPrice = fairValueEstimate;
    const stopLossAnchor = Number((currentPrice * (beta > 1.4 ? 0.88 : 0.92)).toFixed(2));

    let tacticalAction = 'Hold position and monitor technical breakout levels.';
    if (overallScore >= 80) {
      tacticalAction = `High conviction buy. Allocate initial tranche in zone $${buyMin} - $${buyMax} with target $${targetPrice}.`;
    } else if (overallScore >= 68) {
      tacticalAction = `Accumulate on pullbacks. Scale into tranches near $${buyMin}.`;
    } else if (overallScore <= 40) {
      tacticalAction = `Elevated valuation/debt pressure. Consider taking profits or setting tight trailing stop at $${stopLossAnchor}.`;
    }

    const recommendedMaxAllocationPct = overallScore >= 85 ? 12 : overallScore >= 70 ? 8 : overallScore >= 50 ? 5 : 2;

    // Strengths & Risks synthesis
    const keyStrengths: string[] = [];
    if (opMargin && opMargin > 18) keyStrengths.push(`Robust operating margin profile (${opMargin.toFixed(1)}%) reflecting strong competitive moat.`);
    if (roe && roe > 15) keyStrengths.push(`High capital efficiency with ${roe.toFixed(1)}% Return on Equity.`);
    if (pe && pe > 0 && pe < 20) keyStrengths.push(`Favorable earnings multiple (P/E ${pe.toFixed(1)}x) offering attractive margin of safety.`);
    if (distFrom52WHigh < -15) keyStrengths.push(`Significant discount (${distFrom52WHigh.toFixed(1)}%) from 52-week highs.`);
    if (keyStrengths.length === 0) keyStrengths.push('Established market presence with active liquidity.');

    const keyRisks: string[] = [];
    if (debtToEquity && debtToEquity > 130) keyRisks.push(`Elevated debt-to-equity leverage (${debtToEquity.toFixed(0)}%) requires monitoring.`);
    if (pe && pe > 40) keyRisks.push(`Rich forward valuation (P/E ${pe.toFixed(1)}x) leaves minimal cushion for growth misses.`);
    if (beta > 1.4) keyRisks.push(`High market beta (${beta.toFixed(2)}) introduces amplified downside volatility in market selloffs.`);
    if (keyRisks.length === 0) keyRisks.push('Macro and sector cyclicality risk.');

    const bullCase = `${cleanRaw} showcases a conviction score of ${overallScore}/100 underpinned by ${fundScore}/100 quality fundamentals and an estimated fair value target of $${fairValueEstimate} (+${upsideToFairValue.toFixed(1)}% upside).`;
    const bearCase = `Sustained macro compression, multiple re-rating or breakdown below $${stopLossAnchor} would invalidate the upside thesis.`;

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
      healthStatus,
      valuationPosture,
      metrics: {
        priceTo52WeekHighPct: Number(distFrom52WHigh.toFixed(2)),
        distanceFrom52WeekLowPct: Number(distFrom52WLow.toFixed(2)),
        technicalSetupScore: buyingScore,
        momentumScore: Math.max(20, Math.min(95, Math.round(50 + changePercent * 4))),
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
      keyStrengths,
      keyRisks,
      bullCase,
      bearCase,
      isHolding: Boolean(holdingData),
      holdingDetails: holdingData,
      isWatchlist: Boolean(watchlistNames && watchlistNames.length > 0),
      watchlistNames,
      analyzedAt: new Date().toISOString(),
    };

    scorecardsCache.set(cleanRaw, { scorecard, timestamp: Date.now() });
    return scorecard;
  } catch (err: any) {
    console.error(`Error evaluating scorecard for ${cleanRaw}:`, err?.message || err);
    return null;
  }
}

// Fetch all scorecards across portfolio holdings & watchlists
export async function getScorecardsHubData(prisma: PrismaClient): Promise<ScorecardsHubResponse> {
  // 1. Fetch DB Holdings
  const holdings = await prisma.holding.findMany({
    where: {
      assetType: { in: ['EQUITY', 'Stock', 'ETF'] },
    },
    include: { broker: true },
  });

  const holdingSymbolsMap = new Map<string, any>();
  holdings.forEach((h) => {
    let clean = h.symbol.trim().toUpperCase();
    if (clean.endsWith('_US_EQ')) clean = clean.replace('_US_EQ', '');
    else if (clean.endsWith('_CA_EQ')) clean = clean.replace('_CA_EQ', '') + '.TO';
    else if (clean.endsWith('L_EQ') || clean.endsWith('P_EQ')) clean = clean.replace(/[LP]_EQ$/, '') + '.L';
    else if (clean.endsWith('_EQ')) clean = clean.replace('_EQ', '');

    holdingSymbolsMap.set(clean, {
      quantity: h.quantity,
      averageCost: h.averageCost,
      marketValue: h.marketValue,
      unrealizedPnL: h.unrealizedPnL,
      unrealizedPnLPercent: h.unrealizedPnLPercent,
      broker: h.broker?.name || 'IBKR',
    });
  });

  // 2. Fetch Watchlists & Symbols
  const watchlists = await prisma.watchlist.findMany({
    include: { items: true },
  });

  const watchlistSymbolsMap = new Map<string, string[]>();
  watchlists.forEach((w) => {
    w.items.forEach((item) => {
      const sym = item.symbol.trim().toUpperCase();
      const existing = watchlistSymbolsMap.get(sym) || [];
      if (!existing.includes(w.name)) {
        existing.push(w.name);
      }
      watchlistSymbolsMap.set(sym, existing);
    });
  });

  // Collect unique symbol list
  const allSymbols = Array.from(
    new Set([...Array.from(holdingSymbolsMap.keys()), ...Array.from(watchlistSymbolsMap.keys())])
  );

  // Evaluate in parallel batches
  const scorecards: StockScorecard[] = [];
  const batchSize = 12;

  for (let i = 0; i < allSymbols.length; i += batchSize) {
    const chunk = allSymbols.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      chunk.map((sym) =>
        evaluateStockScorecard(
          sym,
          holdingSymbolsMap.get(sym),
          watchlistSymbolsMap.get(sym)
        )
      )
    );

    results.forEach((res) => {
      if (res.status === 'fulfilled' && res.value) {
        scorecards.push(res.value);
      }
    });
  }

  // Sort descending by overall conviction score
  scorecards.sort((a, b) => b.overallScore - a.overallScore);

  // Summary statistics
  const holdingsItems = scorecards.filter((s) => s.isHolding);
  const watchlistItems = scorecards.filter((s) => s.isWatchlist);

  const avgOverall = scorecards.length > 0 
    ? Math.round(scorecards.reduce((sum, s) => sum + s.overallScore, 0) / scorecards.length) 
    : 0;
  const avgHoldings = holdingsItems.length > 0
    ? Math.round(holdingsItems.reduce((sum, s) => sum + s.overallScore, 0) / holdingsItems.length)
    : 0;
  const avgWatchlist = watchlistItems.length > 0
    ? Math.round(watchlistItems.reduce((sum, s) => sum + s.overallScore, 0) / watchlistItems.length)
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
    timestamp: Date.now(),
  };
}

// Compare multiple stocks head-to-head
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
    const card = await evaluateStockScorecard(sym);
    if (card) scorecards.push(card);
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
    `${bestOverall.symbol} leads the group with an Overall Conviction Score of ${bestOverall.overallScore}/100 (${bestOverall.gradeLabel}).`,
    `${bestFund.symbol} exhibits the highest quality profile with a Fundamentals Score of ${bestFund.fundamentalsScore}/100 and ${bestFund.metrics.operatingMarginPct ?? 'N/A'}% operating margin.`,
    `${bestVal.symbol} represents the most attractive valuation multiple with a Valuation Score of ${bestVal.valuationScore}/100.`,
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
