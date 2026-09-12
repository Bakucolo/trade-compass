import { PrismaClient } from '@prisma/client';
import YahooFinance from 'yahoo-finance2';
import { agentActivityTracker } from './agentActivityService';
import { generateJsonCompletion } from './llmFallbackRouter';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
  validation: { logErrors: false }
});

export type DipDriverClassification =
  | 'VOLATILITY_DRIVEN'
  | 'FUNDAMENTAL_IMPAIRMENT'
  | 'MACRO_SECTOR_ROTATION'
  | 'OVERREACTION_OPPORTUNITY';

export type DipOpportunityVerdict =
  | 'STRONG_BUY_DIP'
  | 'ACCUMULATE_PULLBACK'
  | 'HOLD_WAIT_FOR_BASE'
  | 'AVOID_FALLING_KNIFE'
  | 'TRIM_DEFENSIVE';

export interface SavedReportMeta {
  id: string;
  verdict: DipOpportunityVerdict;
  opportunityScore: number;
  fundamentalHealthScore?: number;
  classification: DipDriverClassification;
  analyzedAt: string;
}

export interface BuyScoreBreakdown {
  totalScore: number;
  valuationScore: number; // 0 - 25
  fundamentalScore: number; // 0 - 25
  technicalScore: number; // 0 - 20
  driverScore: number; // 0 - 15
  portfolioFitScore: number; // 0 - 15
  targetUpsidePercent: number | null;
  targetPrice: number | null;
  forwardPE: number | null;
  trailingPE: number | null;
  pegRatio: number | null;
  freeCashflow: number | null;
  debtToEquity: number | null;
  operatingMargins: number | null;
  valuationGrade: 'UNDERVALUED' | 'FAIR_VALUE' | 'PREMIUM';
  fundamentalGrade: 'PRISTINE' | 'SOLID' | 'SPECULATIVE';
  technicalSetup: '50D_UPTREND_DIP' | 'OVERSOLD_REBOUND' | 'DEEP_VALUE_SUPPORT' | 'MOMENTUM_BREAK';
  analystRating: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'N/A';
  highlightBadges: string[];
}

export interface DipCandidateItem {
  symbol: string;
  name: string;
  currentPrice: number;
  dayChange: number;
  dayChangePercent: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  distanceFrom52WHigh: number; // percentage (usually negative)
  volume: number;
  avgVolume: number;
  volumeMultiplier: number; // current volume / avg volume
  sector?: string;
  industry?: string;
  source: 'HOLDING' | 'WATCHLIST' | 'IDEA';
  sourceDetails?: string; // e.g. "Interactive Brokers", "Tech Watchlist", "Active Idea"
  holdingPosition?: {
    quantity: number;
    averageCost: number;
    marketValue: number;
    unrealizedPL: number;
    unrealizedPLPercent: number;
    currency: string;
  };
  heuristicSignal: {
    relativeDropVsMarket: number; // e.g. stock drop % minus QQQ drop %
    potentialDriver: 'LIKELY_VOLATILITY' | 'LIKELY_FUNDAMENTAL' | 'MARKET_WIDE_CORRECTION';
    preliminaryOpportunityScore: number; // 0-100 heuristic
  };
  scoreBreakdown?: BuyScoreBreakdown;
  savedReportInfo?: SavedReportMeta;
}

export interface BenchmarkContext {
  spy: { price: number; changePercent: number };
  qqq: { price: number; changePercent: number };
  vix: { price: number; changePercent: number };
  marketSentiment: 'RISK_ON' | 'NEUTRAL' | 'RISK_OFF' | 'PANIC_VOLATILITY';
}

export interface DipRadarScanResult {
  scanTimestamp: string;
  totalScanned: number;
  dipsCount: number;
  benchmarks: BenchmarkContext;
  dips: DipCandidateItem[];
}

export interface NewsArticleItem {
  title: string;
  publisher: string;
  link: string;
  publishTime?: string;
}

export interface ValuationMetricsSnapshot {
  trailingPE: number | null;
  forwardPE: number | null;
  priceToSales: number | null;
  pegRatio: number | null;
  enterpriseToEbitda: number | null;
  operatingMarginPercent: number | null;
  freeCashflow: number | null;
  debtToEquity: number | null;
  returnOnEquityPercent: number | null;
  beta: number | null;
  shortPercentOfFloat: number | null;
}

export interface DipDiagnosticResult {
  symbol: string;
  companyName: string;
  currentPrice: number;
  dayChangePercent: number;
  distanceFrom52WHigh: number;
  analyzedAt: string;
  classification: DipDriverClassification;
  verdict: DipOpportunityVerdict;
  opportunityScore: number; // 0 - 100
  fundamentalHealthScore: number; // 0 - 100
  volatilityFactorPercent: number; // 0 - 100
  fundamentalFactorPercent: number; // 0 - 100
  primaryDriverSummary: string; // 1-2 sentence core conclusion
  executiveDiagnosis: string; // comprehensive institutional diagnosis
  fundamentalAnalysis: {
    isBusinessThesisIntact: boolean;
    balanceSheetStrength: 'ROBUST' | 'MODERATE' | 'VULNERABLE';
    earningsQuality: 'STRONG' | 'MIXED' | 'WEAK_DOWNGRADED';
    details: string;
  };
  volatilityAnalysis: {
    marketBetaImpact: string;
    sectorRotationContext: string;
    gammaOrLiquidityPressure: string;
    details: string;
  };
  valuationAssessment: {
    currentDiscountVs52WHigh: string;
    historicalValuationContext: string;
    isUndervalued: boolean;
    summary: string;
  };
  tacticalActionPlan: {
    recommendedEntryZone: string; // e.g. "$115 - $122"
    dcaStrategy: string; // tranche accumulation schedule
    optionsStrategy: string; // e.g. "Sell $115 Cash-Secured Put 30-45 DTE for 2.5% yield"
    stopLossOrInvalidation: string; // e.g. "Close if weekly close below $108"
    timeHorizon: 'IMMEDIATE_1_2W' | 'SWING_1_3M' | 'LONG_TERM_6M_PLUS';
  };
  keyRiskFactors: string[];
  upsideCatalysts: string[];
  recentNewsHeadlines: NewsArticleItem[];
  valuationMetrics: ValuationMetricsSnapshot;
  benchmarks: BenchmarkContext;
  portfolioContext?: {
    isCurrentlyHeld: boolean;
    quantity?: number;
    averageCost?: number;
    unrealizedPLPercent?: number;
    marketValue?: number;
    suggestedPortfolioAction?: string;
  };
  isSavedReport?: boolean;
  savedReportId?: string;
  savedAt?: string;
}

// In-memory cache for fast repeated reads
const diagnosticCache = new Map<string, { result: DipDiagnosticResult; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

/**
 * Institutional Multi-Pillar Quantitative & Fundamental Buy Score Engine
 * Evaluates assets on a 0-100 scale across 5 distinct pillars:
 * 1. Valuation & Margin of Safety (0 - 25 pts)
 * 2. Fundamental Quality & Solvency (0 - 25 pts)
 * 3. Technical Confluence & Moving Averages (0 - 20 pts)
 * 4. Volume & Liquidity Driver Attribution (0 - 15 pts)
 * 5. Portfolio Context & DCA Asymmetry (0 - 15 pts)
 */
export function calculateInstitutionalBuyScore(params: {
  price: number;
  dayChangePct: number;
  distFromHigh: number;
  fiftyTwoWHigh: number;
  fiftyTwoWLow: number;
  fiftyDaySMA?: number | null;
  twoHundredDaySMA?: number | null;
  dayLow?: number | null;
  dayHigh?: number | null;
  volume: number;
  avgVolume: number;
  volumeMult: number;
  summaryDetail?: any;
  financialData?: any;
  defaultKeyStatistics?: any;
  benchmarks: BenchmarkContext;
  holdingPosition?: {
    quantity: number;
    averageCost: number;
    marketValue: number;
    unrealizedPL: number;
    unrealizedPLPercent: number;
  };
  savedReportMeta?: SavedReportMeta;
}): { score: number; potentialDriver: 'LIKELY_VOLATILITY' | 'LIKELY_FUNDAMENTAL' | 'MARKET_WIDE_CORRECTION'; breakdown: BuyScoreBreakdown } {
  const {
    price,
    dayChangePct,
    distFromHigh,
    fiftyTwoWHigh,
    fiftyTwoWLow,
    fiftyDaySMA,
    twoHundredDaySMA,
    dayLow,
    dayHigh,
    volume,
    avgVolume,
    volumeMult,
    summaryDetail,
    financialData,
    defaultKeyStatistics,
    benchmarks,
    holdingPosition,
    savedReportMeta,
  } = params;

  // ================= 1. VALUATION & MARGIN OF SAFETY (Max 25 pts) =================
  let valScore = 12; // Baseline neutral

  // 1a. Analyst Target Upside
  const targetPrice = financialData?.targetMeanPrice ?? financialData?.targetMedianPrice ?? null;
  let targetUpside: number | null = null;
  if (targetPrice && price > 0) {
    targetUpside = ((targetPrice - price) / price) * 100;
    if (targetUpside >= 35) valScore += 7;
    else if (targetUpside >= 20) valScore += 5;
    else if (targetUpside >= 10) valScore += 3;
    else if (targetUpside >= 0) valScore += 1;
    else if (targetUpside < -10) valScore -= 4;
  }

  // 1b. Wall Street Recommendation Rating
  const recMean = financialData?.recommendationMean ?? null;
  let analystRating: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'N/A' = 'N/A';
  if (recMean !== null && recMean > 0) {
    if (recMean <= 1.8) {
      valScore += 4;
      analystRating = 'STRONG_BUY';
    } else if (recMean <= 2.4) {
      valScore += 2;
      analystRating = 'BUY';
    } else if (recMean <= 3.2) {
      analystRating = 'HOLD';
    } else {
      valScore -= 3;
      analystRating = 'SELL';
    }
  }

  // 1c. Forward P/E & PEG Multiple
  const fwdPE = summaryDetail?.forwardPE ?? defaultKeyStatistics?.forwardPE ?? null;
  const trailPE = summaryDetail?.trailingPE ?? null;
  const peg = defaultKeyStatistics?.pegRatio ?? null;

  if (fwdPE !== null && fwdPE > 0) {
    if (fwdPE < 16) valScore += 4;
    else if (fwdPE <= 26) valScore += 2;
    else if (fwdPE > 55) valScore -= 2;
  }
  if (peg !== null && peg > 0) {
    if (peg < 1.2) valScore += 2;
    else if (peg > 2.8) valScore -= 2;
  }

  // 1d. Discount Depth vs High
  if (distFromHigh <= -15 && distFromHigh >= -35) valScore += 3;
  else if (distFromHigh < -35 && distFromHigh >= -55) valScore += 1;

  valScore = Math.max(2, Math.min(25, Math.round(valScore)));

  // ================= 2. FUNDAMENTAL QUALITY & SOLVENCY (Max 25 pts) =================
  let fundScore = 12; // Baseline neutral
  const fcf = financialData?.freeCashflow ?? null;
  const opCash = financialData?.operatingCashflow ?? null;
  if (fcf !== null) {
    if (fcf > 0) {
      fundScore += 6;
      if (fcf > 500_000_000) fundScore += 2; // Mega-cap institutional cash machine
    } else if (fcf < 0) {
      fundScore -= 4; // Cash burning drag
    }
  } else if (opCash !== null && opCash > 0) {
    fundScore += 3;
  }

  const opMargin = financialData?.operatingMargins ?? null;
  if (opMargin !== null) {
    if (opMargin >= 0.25) fundScore += 4;
    else if (opMargin >= 0.12) fundScore += 2;
    else if (opMargin < 0) fundScore -= 3;
  }

  const de = financialData?.debtToEquity ?? null;
  if (de !== null) {
    if (de < 60) fundScore += 4;
    else if (de <= 130) fundScore += 2;
    else if (de > 250) fundScore -= 3;
  }

  const roe = financialData?.returnOnEquity ?? null;
  if (roe !== null) {
    if (roe >= 0.18) fundScore += 3;
    else if (roe < 0) fundScore -= 2;
  }

  fundScore = Math.max(2, Math.min(25, Math.round(fundScore)));

  // ================= 3. TECHNICAL CONFLUENCE & MOVING AVERAGES (Max 20 pts) =================
  let techScore = 10;
  let techSetup: '50D_UPTREND_DIP' | 'OVERSOLD_REBOUND' | 'DEEP_VALUE_SUPPORT' | 'MOMENTUM_BREAK' = 'OVERSOLD_REBOUND';

  if (fiftyDaySMA && twoHundredDaySMA && fiftyDaySMA > 0 && twoHundredDaySMA > 0) {
    const isGolden = fiftyDaySMA >= twoHundredDaySMA;
    const isAbove200 = price >= twoHundredDaySMA * 0.96;
    const isBelow50 = price < fiftyDaySMA;

    if (isGolden && isAbove200 && isBelow50) {
      techScore += 6;
      techSetup = '50D_UPTREND_DIP';
    } else if (price < fiftyDaySMA * 0.90 && isAbove200) {
      techScore += 4;
      techSetup = 'OVERSOLD_REBOUND';
    } else if (!isAbove200 && distFromHigh < -40) {
      techScore += 1;
      techSetup = 'DEEP_VALUE_SUPPORT';
    } else {
      techSetup = 'MOMENTUM_BREAK';
    }
  }

  // Intraday buyer defense
  if (dayLow !== undefined && dayLow !== null && dayHigh !== undefined && dayHigh !== null && dayHigh > dayLow) {
    const reboundRatio = (price - dayLow) / (dayHigh - dayLow);
    if (reboundRatio >= 0.60) techScore += 3;
    else if (reboundRatio <= 0.15 && dayChangePct < -3) techScore -= 2;
  }

  const beta = defaultKeyStatistics?.beta ?? summaryDetail?.beta ?? 1.1;
  if (beta >= 0.7 && beta <= 1.5) techScore += 2;
  else if (beta > 2.3) techScore -= 2;

  techScore = Math.max(2, Math.min(20, Math.round(techScore)));

  // ================= 4. VOLUME & LIQUIDITY DRIVER ATTRIBUTION (Max 15 pts) =================
  let driverScore = 8;
  const relativeDropVsQQQ = dayChangePct - benchmarks.qqq.changePercent;
  let potentialDriver: 'LIKELY_VOLATILITY' | 'LIKELY_FUNDAMENTAL' | 'MARKET_WIDE_CORRECTION' = 'LIKELY_VOLATILITY';

  if (benchmarks.marketSentiment === 'RISK_OFF' || benchmarks.marketSentiment === 'PANIC_VOLATILITY') {
    potentialDriver = 'MARKET_WIDE_CORRECTION';
    driverScore += 5;
  } else if (relativeDropVsQQQ < -3.5 && volumeMult > 2.0) {
    potentialDriver = 'LIKELY_FUNDAMENTAL';
    driverScore -= 3;
  } else {
    potentialDriver = 'LIKELY_VOLATILITY';
    if (volumeMult <= 1.2) driverScore += 4;
    else if (volumeMult > 3.0) driverScore += 3;
  }

  driverScore = Math.max(1, Math.min(15, Math.round(driverScore)));

  // ================= 5. PORTFOLIO CONTEXT & DCA ASYMMETRY (Max 15 pts) =================
  let portScore = 8;
  if (holdingPosition) {
    const unPL = holdingPosition.unrealizedPLPercent;
    if (unPL <= -10 && unPL >= -35) {
      portScore += 5; // Attractive DCA entry
    } else if (unPL > 25) {
      portScore += 4; // Adding to winner on discount
    } else if (unPL < -50) {
      portScore -= 2; // Deep drawdown caution
    }
  } else {
    portScore += 4; // Fresh watchlist entry
  }
  portScore = Math.max(1, Math.min(15, Math.round(portScore)));

  // Total Score Calculation
  let totalScore = valScore + fundScore + techScore + driverScore + portScore;

  if (savedReportMeta?.opportunityScore) {
    totalScore = Math.round(savedReportMeta.opportunityScore * 0.6 + totalScore * 0.4);
  }

  totalScore = Math.max(15, Math.min(98, Math.round(totalScore)));

  // Telemetry Grades
  const valuationGrade: 'UNDERVALUED' | 'FAIR_VALUE' | 'PREMIUM' =
    valScore >= 18 ? 'UNDERVALUED' : valScore >= 12 ? 'FAIR_VALUE' : 'PREMIUM';

  const fundamentalGrade: 'PRISTINE' | 'SOLID' | 'SPECULATIVE' =
    fundScore >= 19 ? 'PRISTINE' : fundScore >= 13 ? 'SOLID' : 'SPECULATIVE';

  // Key Highlight Badges
  const highlightBadges: string[] = [];
  if (targetUpside && targetUpside >= 12) {
    highlightBadges.push(`Target +${targetUpside.toFixed(0)}%`);
  }
  if (fcf && fcf > 0) {
    highlightBadges.push(fcf > 1e9 ? `FCF $${(fcf / 1e9).toFixed(1)}B` : `FCF $${(fcf / 1e6).toFixed(0)}M`);
  }
  if (fwdPE && fwdPE > 0 && fwdPE <= 26) {
    highlightBadges.push(`P/E ${fwdPE.toFixed(1)}x`);
  }
  if (techSetup === '50D_UPTREND_DIP') {
    highlightBadges.push('50-Day Dip');
  } else if (techSetup === 'OVERSOLD_REBOUND') {
    highlightBadges.push('Oversold');
  } else if (distFromHigh <= -20) {
    highlightBadges.push(`${distFromHigh.toFixed(0)}% Off High`);
  }

  const breakdown: BuyScoreBreakdown = {
    totalScore,
    valuationScore: valScore,
    fundamentalScore: fundScore,
    technicalScore: techScore,
    driverScore,
    portfolioFitScore: portScore,
    targetUpsidePercent: targetUpside ? parseFloat(targetUpside.toFixed(1)) : null,
    targetPrice: targetPrice ? parseFloat(targetPrice.toFixed(2)) : null,
    forwardPE: fwdPE ? parseFloat(fwdPE.toFixed(1)) : null,
    trailingPE: trailPE ? parseFloat(trailPE.toFixed(1)) : null,
    pegRatio: peg ? parseFloat(peg.toFixed(2)) : null,
    freeCashflow: fcf,
    debtToEquity: de,
    operatingMargins: opMargin ? parseFloat((opMargin * 100).toFixed(1)) : null,
    valuationGrade,
    fundamentalGrade,
    technicalSetup: techSetup,
    analystRating,
    highlightBadges: highlightBadges.slice(0, 3)
  };

  return {
    score: totalScore,
    potentialDriver,
    breakdown
  };
}

// In-memory cache for dip radar scan
let cachedDipScan: { timestamp: number; data: DipRadarScanResult; key: string } | null = null;
const DIP_SCAN_CACHE_TTL_MS = 45 * 1000; // 45s cache

/**
 * Scan all user Holdings, Watchlists, and Trade Ideas to identify stocks experiencing notable drops
 */
export async function scanHoldingsAndWatchlistsForDips(
  prisma: PrismaClient,
  options: {
    minDayDropPercent?: number;
    minDrawdownFromHighPercent?: number;
  } = {},
  logToFile: (msg: string) => void = console.log
): Promise<DipRadarScanResult> {
  const minDayDrop = options.minDayDropPercent ?? -1.8;
  const minDrawdownFromHigh = options.minDrawdownFromHighPercent ?? -12.0;
  const cacheKey = `${minDayDrop}_${minDrawdownFromHigh}`;
  const now = Date.now();

  if (cachedDipScan && cachedDipScan.key === cacheKey && now - cachedDipScan.timestamp < DIP_SCAN_CACHE_TTL_MS) {
    return cachedDipScan.data;
  }

  logToFile(`[Dip Radar] Initiating scan across Holdings & Watchlists (Day Drop <= ${minDayDrop}%, Drawdown <= ${minDrawdownFromHigh}%)...`);

  // 1. Fetch Market Benchmarks (SPY, QQQ, ^VIX)
  let benchmarks: BenchmarkContext = {
    spy: { price: 580, changePercent: -0.2 },
    qqq: { price: 495, changePercent: -0.4 },
    vix: { price: 16.5, changePercent: 3.5 },
    marketSentiment: 'NEUTRAL'
  };

  try {
    const [spyQuote, qqqQuote, vixQuote] = await Promise.allSettled([
      yahooFinance.quoteSummary('SPY', { modules: ['price'] }, { validateResult: false }),
      yahooFinance.quoteSummary('QQQ', { modules: ['price'] }, { validateResult: false }),
      yahooFinance.quoteSummary('^VIX', { modules: ['price'] }, { validateResult: false }),
    ]);

    if (spyQuote.status === 'fulfilled' && spyQuote.value?.price) {
      benchmarks.spy = {
        price: spyQuote.value.price.regularMarketPrice ?? 580,
        changePercent: (spyQuote.value.price.regularMarketChangePercent ?? 0) * 100
      };
    }
    if (qqqQuote.status === 'fulfilled' && qqqQuote.value?.price) {
      benchmarks.qqq = {
        price: qqqQuote.value.price.regularMarketPrice ?? 495,
        changePercent: (qqqQuote.value.price.regularMarketChangePercent ?? 0) * 100
      };
    }
    if (vixQuote.status === 'fulfilled' && vixQuote.value?.price) {
      benchmarks.vix = {
        price: vixQuote.value.price.regularMarketPrice ?? 16.5,
        changePercent: (vixQuote.value.price.regularMarketChangePercent ?? 0) * 100
      };
    }

    if (benchmarks.vix.price > 25 || benchmarks.qqq.changePercent < -2.0) {
      benchmarks.marketSentiment = 'PANIC_VOLATILITY';
    } else if (benchmarks.qqq.changePercent < -0.8 || benchmarks.vix.changePercent > 8) {
      benchmarks.marketSentiment = 'RISK_OFF';
    } else if (benchmarks.spy.changePercent > 0.5 && benchmarks.vix.price < 15) {
      benchmarks.marketSentiment = 'RISK_ON';
    } else {
      benchmarks.marketSentiment = 'NEUTRAL';
    }
  } catch (err: any) {
    logToFile(`[Dip Radar] Warning: benchmark fetch error: ${err?.message}`);
  }

  // 2. Collect Symbols from Holdings, Watchlists, Trade Ideas & Saved Reports
  const [holdings, watchlists, tradeIdeas, savedReports] = await Promise.all([
    prisma.holding.findMany({ include: { broker: true } }),
    prisma.watchlist.findMany({ include: { items: true } }),
    prisma.tradeIdea.findMany({ where: { status: 'ACTIVE' } }),
    prisma.dipDiagnosticReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    }).catch(() => [])
  ]);

  // Index saved reports by symbol (latest report per symbol)
  const savedReportMap = new Map<string, SavedReportMeta>();
  for (const r of savedReports) {
    if (!savedReportMap.has(r.symbol)) {
      savedReportMap.set(r.symbol, {
        id: r.id,
        verdict: r.verdict as DipOpportunityVerdict,
        opportunityScore: r.opportunityScore,
        fundamentalHealthScore: r.fundamentalHealthScore,
        classification: r.classification as DipDriverClassification,
        analyzedAt: r.createdAt.toISOString(),
      });
    }
  }

  interface SymbolMeta {
    symbol: string;
    sources: Set<'HOLDING' | 'WATCHLIST' | 'IDEA'>;
    sourceDetails: string[];
    holdingData?: {
      quantity: number;
      averageCost: number;
      marketValue: number;
      unrealizedPL: number;
      unrealizedPLPercent: number;
      currency: string;
    };
  }

  const symbolMap = new Map<string, SymbolMeta>();

  // Helper with timeout
  const fetchWithTimeout = <T>(promise: Promise<T>, ms = 3000): Promise<T | null> => {
    return Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
    ]);
  };

  // A. Add Holdings
  for (const h of holdings) {
    let rawSym = (h.underlyingSymbol || h.symbol || '').trim().toUpperCase();
    if (rawSym.includes(' ')) rawSym = rawSym.split(' ')[0];
    rawSym = rawSym.replace(/[^A-Z0-9\.\^\-]/g, '');
    if (!rawSym || rawSym.length > 7 || rawSym === 'UNKNOWN' || /^\d+$/.test(rawSym)) continue;

    const existing = symbolMap.get(rawSym);
    const brokerName = h.broker?.name || 'Holdings';
    const mv = Math.abs(h.marketValue || 0);

    if (existing) {
      existing.sources.add('HOLDING');
      if (!existing.sourceDetails.includes(brokerName)) existing.sourceDetails.push(brokerName);
      if (existing.holdingData) {
        existing.holdingData.marketValue += mv;
        existing.holdingData.unrealizedPL += (h.unrealizedPnL || 0);
      }
    } else {
      symbolMap.set(rawSym, {
        symbol: rawSym,
        sources: new Set(['HOLDING']),
        sourceDetails: [brokerName],
        holdingData: {
          quantity: h.quantity || 0,
          averageCost: h.averageCost || 0,
          marketValue: mv,
          unrealizedPL: h.unrealizedPnL || 0,
          unrealizedPLPercent: h.unrealizedPnLPercent || 0,
          currency: h.currency || 'USD',
        }
      });
    }
  }

  // B. Add Watchlists
  for (const wl of watchlists) {
    for (const item of wl.items) {
      let sym = item.symbol.trim().toUpperCase();
      if (sym.includes(' ')) sym = sym.split(' ')[0];
      sym = sym.replace(/[^A-Z0-9\.\^\-]/g, '');
      if (!sym || sym.length > 7 || /^\d+$/.test(sym)) continue;

      const existing = symbolMap.get(sym);
      const wlName = wl.name || 'Watchlist';
      if (existing) {
        existing.sources.add('WATCHLIST');
        if (!existing.sourceDetails.includes(wlName)) existing.sourceDetails.push(wlName);
      } else {
        symbolMap.set(sym, {
          symbol: sym,
          sources: new Set(['WATCHLIST']),
          sourceDetails: [wlName],
        });
      }
    }
  }

  // C. Add Active Trade Ideas
  for (const idea of tradeIdeas) {
    let sym = idea.symbol.trim().toUpperCase();
    if (sym.includes(' ')) sym = sym.split(' ')[0];
    sym = sym.replace(/[^A-Z0-9\.\^\-]/g, '');
    if (!sym || sym.length > 7 || sym === 'MACRO' || /^\d+$/.test(sym)) continue;

    const existing = symbolMap.get(sym);
    if (existing) {
      existing.sources.add('IDEA');
      if (!existing.sourceDetails.includes('Trade Idea')) existing.sourceDetails.push('Trade Idea');
    } else {
      symbolMap.set(sym, {
        symbol: sym,
        sources: new Set(['IDEA']),
        sourceDetails: ['Trade Idea'],
      });
    }
  }

  const allSymbols = Array.from(symbolMap.keys());
  logToFile(`[Dip Radar] Identified ${allSymbols.length} unique symbols across portfolio and watchlists: ${allSymbols.slice(0, 10).join(', ')}...`);

  // 3. Batched Fetch Quotes via Yahoo Finance (concurrency controlled to avoid Edge 429)
  const candidateDips: DipCandidateItem[] = [];
  const BATCH_SIZE = 15;
  const quoteDataMap = new Map<string, any>();

  for (let i = 0; i < allSymbols.length; i += BATCH_SIZE) {
    const chunk = allSymbols.slice(i, i + BATCH_SIZE);
    const chunkResults = await Promise.allSettled(
      chunk.map(sym =>
        fetchWithTimeout(
          yahooFinance.quoteSummary(
            sym,
            {
              modules: [
                'price',
                'summaryDetail',
                'financialData',
                'defaultKeyStatistics',
                'summaryProfile'
              ]
            },
            { validateResult: false }
          ),
          3500
        )
      )
    );

    chunkResults.forEach((res, idx) => {
      const sym = chunk[idx];
      if (res.status === 'fulfilled' && res.value) {
        quoteDataMap.set(sym, res.value);
      }
    });

    if (i + BATCH_SIZE < allSymbols.length) {
      await new Promise(resolve => setTimeout(resolve, 80));
    }
  }

  allSymbols.forEach((sym) => {
    const data = quoteDataMap.get(sym);
    if (!data) return;
    const meta = symbolMap.get(sym);
    if (!meta) return;

    const price = data.price?.regularMarketPrice ?? 0;
    if (price <= 0) return;

    const dayChange = data.price?.regularMarketChange ?? 0;
    const dayChangePct = (data.price?.regularMarketChangePercent ?? 0) * 100;
    const fiftyTwoWHigh = data.summaryDetail?.fiftyTwoWeekHigh ?? (price * 1.15);
    const fiftyTwoWLow = data.summaryDetail?.fiftyTwoWeekLow ?? (price * 0.85);
    const distFromHigh = fiftyTwoWHigh > 0 ? ((price - fiftyTwoWHigh) / fiftyTwoWHigh) * 100 : 0;
    const volume = data.price?.regularMarketVolume ?? data.summaryDetail?.volume ?? 0;
    const avgVolume = data.summaryDetail?.averageDailyVolume3Month ?? data.price?.averageDailyVolume3Month ?? (volume || 1);
    const volumeMult = avgVolume > 0 ? parseFloat((volume / avgVolume).toFixed(2)) : 1.0;

    const isDownDay = dayChangePct <= minDayDrop;
    const isDeepDrawdown = distFromHigh <= minDrawdownFromHigh;

    // Also check if holding is in loss or has saved report
    const isHoldingInLoss = meta.holdingData && meta.holdingData.unrealizedPLPercent <= -10;
    const savedMeta = savedReportMap.get(sym);

    if (isDownDay || isDeepDrawdown || isHoldingInLoss || savedMeta) {
      // Calculate Heuristic Signal and Institutional Buy Score
      const relativeDropVsQQQ = dayChangePct - benchmarks.qqq.changePercent;

      const { score, potentialDriver, breakdown } = calculateInstitutionalBuyScore({
        price,
        dayChangePct,
        distFromHigh,
        fiftyTwoWHigh,
        fiftyTwoWLow,
        fiftyDaySMA: data.summaryDetail?.fiftyDayAverage,
        twoHundredDaySMA: data.summaryDetail?.twoHundredDayAverage,
        dayLow: data.price?.regularMarketDayLow ?? data.summaryDetail?.dayLow,
        dayHigh: data.price?.regularMarketDayHigh ?? data.summaryDetail?.dayHigh,
        volume,
        avgVolume,
        volumeMult,
        summaryDetail: data.summaryDetail,
        financialData: data.financialData,
        defaultKeyStatistics: data.defaultKeyStatistics,
        benchmarks,
        holdingPosition: meta.holdingData,
        savedReportMeta: savedMeta
      });

      const primarySource = meta.sources.has('HOLDING')
        ? 'HOLDING'
        : meta.sources.has('WATCHLIST')
        ? 'WATCHLIST'
        : 'IDEA';

      candidateDips.push({
        symbol: sym,
        name: data.price?.shortName || data.price?.longName || sym,
        currentPrice: price,
        dayChange,
        dayChangePercent: dayChangePct,
        fiftyTwoWeekHigh: fiftyTwoWHigh,
        fiftyTwoWeekLow: fiftyTwoWLow,
        distanceFrom52WHigh: distFromHigh,
        volume,
        avgVolume,
        volumeMultiplier: volumeMult,
        sector: data.summaryProfile?.sector || 'Equities',
        industry: data.summaryProfile?.industry || 'Diversified',
        source: primarySource,
        sourceDetails: meta.sourceDetails.join(' • '),
        holdingPosition: meta.holdingData,
        heuristicSignal: {
          relativeDropVsMarket: relativeDropVsQQQ,
          potentialDriver,
          preliminaryOpportunityScore: score
        },
        scoreBreakdown: breakdown,
        savedReportInfo: savedMeta,
      });
    }
  });

  // Sort dips by magnitude of day drop or drawdown
  candidateDips.sort((a, b) => {
    if (a.dayChangePercent !== b.dayChangePercent) {
      return a.dayChangePercent - b.dayChangePercent;
    }
    return a.distanceFrom52WHigh - b.distanceFrom52WHigh;
  });

  logToFile(`[Dip Radar] Completed scan. Found ${candidateDips.length} dipping opportunities.`);

  const scanResult: DipRadarScanResult = {
    scanTimestamp: new Date().toISOString(),
    totalScanned: allSymbols.length,
    dipsCount: candidateDips.length,
    benchmarks,
    dips: candidateDips
  };

  cachedDipScan = { timestamp: now, data: scanResult, key: cacheKey };
  return scanResult;
}

/**
 * Execute or Retrieve Saved Deep AI Diagnostic on a specific stock dip
 */
export async function diagnoseStockDip(
  symbol: string,
  options: {
    forceRefresh?: boolean;
    prisma?: PrismaClient;
  } = {},
  logToFile: (msg: string) => void = console.log
): Promise<DipDiagnosticResult> {
  const cleanSymbol = symbol.trim().toUpperCase();

  // 1. Check in-memory cache first if not forcing refresh
  if (!options.forceRefresh) {
    const cached = diagnosticCache.get(cleanSymbol);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      logToFile(`[Dip Diagnostic] Serving in-memory cached diagnostic for ${cleanSymbol}`);
      return cached.result;
    }
  }

  // 2. Check Database for existing saved report if not forcing refresh
  if (!options.forceRefresh && options.prisma) {
    try {
      const savedReport = await options.prisma.dipDiagnosticReport.findFirst({
        where: { symbol: cleanSymbol },
        orderBy: { createdAt: 'desc' }
      });

      if (savedReport && savedReport.contentJson) {
        logToFile(`[Dip Diagnostic] Found saved database report for ${cleanSymbol} from ${savedReport.createdAt.toISOString()}`);
        const parsed: DipDiagnosticResult = JSON.parse(savedReport.contentJson);
        parsed.isSavedReport = true;
        parsed.savedReportId = savedReport.id;
        parsed.savedAt = savedReport.createdAt.toISOString();
        parsed.analyzedAt = savedReport.createdAt.toISOString();

        // Populate in-memory cache for subsequent instant loads
        diagnosticCache.set(cleanSymbol, {
          result: parsed,
          timestamp: Date.now()
        });

        return parsed;
      }
    } catch (dbErr: any) {
      logToFile(`[Dip Diagnostic] Warning reading saved report from DB: ${dbErr?.message}`);
    }
  }

  // 3. Trigger Autonomous AI Agent
  const task = agentActivityTracker.startTask({
    agentName: 'AI Dip & Opportunity Diagnostic Agent',
    agentType: 'RESEARCH_AGENT',
    taskDescription: `Fundamental vs Volatility Drawdown Diagnosis & Buy Opportunity Analysis for ${cleanSymbol}`,
    targetSymbol: cleanSymbol
  });

  logToFile(`[Dip Diagnostic] Starting fresh AI diagnostic analysis for ${cleanSymbol}...`);

  try {
    // 1. Fetch In-Depth Fundamentals, Key Stats, and Pricing
    const [quoteSummaryData, searchNews, spyData, qqqData, vixData] = await Promise.allSettled([
      yahooFinance.quoteSummary(
        cleanSymbol,
        {
          modules: [
            'price',
            'summaryDetail',
            'financialData',
            'defaultKeyStatistics',
            'summaryProfile',
            'earnings',
            'upgradeDowngradeHistory'
          ]
        },
        { validateResult: false }
      ),
      yahooFinance.search(cleanSymbol, { newsCount: 6 }),
      yahooFinance.quoteSummary('SPY', { modules: ['price'] }, { validateResult: false }),
      yahooFinance.quoteSummary('QQQ', { modules: ['price'] }, { validateResult: false }),
      yahooFinance.quoteSummary('^VIX', { modules: ['price'] }, { validateResult: false }),
    ]);

    const summary: any = quoteSummaryData.status === 'fulfilled' ? quoteSummaryData.value : null;
    const priceModule = summary?.price;
    const summaryDetail = summary?.summaryDetail;
    const finData = summary?.financialData;
    const keyStats = summary?.defaultKeyStatistics;
    const profile = summary?.summaryProfile;

    const currentPrice = priceModule?.regularMarketPrice ?? 0;
    const dayChangePct = (priceModule?.regularMarketChangePercent ?? 0) * 100;
    const companyName = priceModule?.shortName || priceModule?.longName || cleanSymbol;
    const fiftyTwoHigh = summaryDetail?.fiftyTwoWeekHigh ?? (currentPrice * 1.15);
    const fiftyTwoLow = summaryDetail?.fiftyTwoWeekLow ?? (currentPrice * 0.85);
    const distFrom52WHigh = fiftyTwoHigh > 0 ? ((currentPrice - fiftyTwoHigh) / fiftyTwoHigh) * 100 : 0;

    // 2. Extract News Headlines
    const newsArticles: NewsArticleItem[] = [];
    if (searchNews.status === 'fulfilled' && (searchNews.value as any)?.news) {
      const rawNews = (searchNews.value as any).news;
      for (const item of rawNews.slice(0, 6)) {
        newsArticles.push({
          title: item.title || 'Market Update',
          publisher: item.publisher || 'Financial Media',
          link: item.link || '',
          publishTime: item.providerPublishTime
            ? new Date(item.providerPublishTime * 1000).toISOString()
            : undefined
        });
      }
    }

    // 3. Extract Benchmarks
    const benchmarks: BenchmarkContext = {
      spy: {
        price: spyData.status === 'fulfilled' ? spyData.value?.price?.regularMarketPrice ?? 580 : 580,
        changePercent: spyData.status === 'fulfilled' ? ((spyData.value?.price?.regularMarketChangePercent ?? 0) * 100) : -0.2
      },
      qqq: {
        price: qqqData.status === 'fulfilled' ? qqqData.value?.price?.regularMarketPrice ?? 495 : 495,
        changePercent: qqqData.status === 'fulfilled' ? ((qqqData.value?.price?.regularMarketChangePercent ?? 0) * 100) : -0.4
      },
      vix: {
        price: vixData.status === 'fulfilled' ? vixData.value?.price?.regularMarketPrice ?? 16.5 : 16.5,
        changePercent: vixData.status === 'fulfilled' ? ((vixData.value?.price?.regularMarketChangePercent ?? 0) * 100) : 2.5
      },
      marketSentiment: 'NEUTRAL'
    };

    if (benchmarks.vix.price > 25 || benchmarks.qqq.changePercent < -2.0) {
      benchmarks.marketSentiment = 'PANIC_VOLATILITY';
    } else if (benchmarks.qqq.changePercent < -0.8) {
      benchmarks.marketSentiment = 'RISK_OFF';
    } else {
      benchmarks.marketSentiment = 'NEUTRAL';
    }

    // 4. Extract Valuation Metrics
    const valuationMetrics: ValuationMetricsSnapshot = {
      trailingPE: summaryDetail?.trailingPE ?? null,
      forwardPE: summaryDetail?.forwardPE ?? null,
      priceToSales: summaryDetail?.priceToSalesTrailing12Months ?? null,
      pegRatio: keyStats?.pegRatio ?? null,
      enterpriseToEbitda: keyStats?.enterpriseToEbitda ?? null,
      operatingMarginPercent: finData?.operatingMargins ? finData.operatingMargins * 100 : null,
      freeCashflow: finData?.freeCashflow ?? null,
      debtToEquity: finData?.debtToEquity ?? null,
      returnOnEquityPercent: finData?.returnOnEquity ? finData.returnOnEquity * 100 : null,
      beta: keyStats?.beta ?? 1.1,
      shortPercentOfFloat: keyStats?.shortPercentOfFloat ? keyStats.shortPercentOfFloat * 100 : null
    };

    // 5. Portfolio Context (Check if in DB)
    let portfolioContext: any = undefined;
    if (options.prisma) {
      try {
        const userHolding = await options.prisma.holding.findFirst({
          where: {
            OR: [
              { symbol: cleanSymbol },
              { underlyingSymbol: cleanSymbol }
            ]
          }
        });

        if (userHolding && userHolding.quantity !== 0) {
          portfolioContext = {
            isCurrentlyHeld: true,
            quantity: userHolding.quantity,
            averageCost: userHolding.averageCost,
            unrealizedPLPercent: userHolding.unrealizedPnLPercent,
            marketValue: userHolding.marketValue,
            suggestedPortfolioAction: userHolding.unrealizedPnLPercent < -15
              ? 'Evaluate averaging down / selling cash-secured puts or defensive collar.'
              : 'Position is active. Review sizing before adding.'
          };
        }
      } catch (err) {
        // ignore
      }
    }

    // 6. Assemble AI Prompt & Invoke LLM
    const systemPrompt = `You are a Senior Hedge Fund Portfolio Manager and Equity Risk Specialist.
Your job is to conduct an uncompromising, mathematically grounded, and institutional diagnostic on a stock experiencing a price drop or drawdown.

YOU MUST DETERMINE:
1. CLASSIFICATION: Is this drop driven by FUNDAMENTAL IMPAIRMENT (earnings miss, guidance slash, structural secular decline, fraud, regulatory block) OR VOLATILITY/MARKET-DRIVEN (index beta, macro interest rate headlines, sector rotation, short gamma squeeze, temporary liquidity dip, sensationalist headline overreaction)?
2. ATTRIBUTION PERCENTAGES: Fundamental Factor % vs Volatility Factor % (must sum to 100).
3. BUYING OPPORTUNITY VERDICT:
   - "STRONG_BUY_DIP": High conviction, valuation disconnected from pristine fundamentals.
   - "ACCUMULATE_PULLBACK": Quality company in normal technical pullback; initiate partial tranche.
   - "HOLD_WAIT_FOR_BASE": Neutral/mixed; wait for volatility to settle and support to form.
   - "AVOID_FALLING_KNIFE": Severe fundamental deterioration or broken thesis.
   - "TRIM_DEFENSIVE": Excessive risk or further downside likely.
4. OPPORTUNITY SCORE (0 - 100): 90+ = exceptional generational dip; 70-89 = solid risk-reward; 40-69 = lukewarm; <40 = poor.
5. FUNDAMENTAL HEALTH SCORE (0 - 100): Strength of balance sheet, FCF generation, moat, and business durability.
6. TACTICAL ACTION PLAN: Clear numeric entry zones, DCA tranche pacing, specific option strategies (e.g. Cash-Secured Puts, Bull Call Spreads, or Covered Calls), and exact invalidation/stop-loss price.

Return strict JSON adhering to the specified schema.`;

    const userPrompt = `DIAGNOSTIC TARGET:
Symbol: ${cleanSymbol} (${companyName})
Current Price: $${currentPrice.toFixed(2)}
Day Change: ${dayChangePct >= 0 ? '+' : ''}${dayChangePct.toFixed(2)}%
52-Week High: $${fiftyTwoHigh.toFixed(2)} | Drawdown from 52W High: ${distFrom52WHigh.toFixed(2)}%
52-Week Low: $${fiftyTwoLow.toFixed(2)}
Sector: ${profile?.sector || 'Unknown'} | Industry: ${profile?.industry || 'Unknown'}

MARKET REGIME CONTEXT:
- SPY Day Change: ${benchmarks.spy.changePercent.toFixed(2)}%
- QQQ Day Change: ${benchmarks.qqq.changePercent.toFixed(2)}%
- VIX Index: ${benchmarks.vix.price.toFixed(1)} (${benchmarks.vix.changePercent.toFixed(1)}%)
- Market Sentiment: ${benchmarks.marketSentiment}

VALUATION & FINANCIALS:
- Trailing P/E: ${valuationMetrics.trailingPE ?? 'N/A'} | Forward P/E: ${valuationMetrics.forwardPE ?? 'N/A'}
- Price / Sales: ${valuationMetrics.priceToSales ?? 'N/A'} | PEG Ratio: ${valuationMetrics.pegRatio ?? 'N/A'}
- Operating Margin: ${valuationMetrics.operatingMarginPercent ? valuationMetrics.operatingMarginPercent.toFixed(1) + '%' : 'N/A'}
- Free Cash Flow: ${valuationMetrics.freeCashflow ? '$' + (valuationMetrics.freeCashflow / 1e6).toFixed(1) + 'M' : 'N/A'}
- Debt to Equity: ${valuationMetrics.debtToEquity ?? 'N/A'} | ROE: ${valuationMetrics.returnOnEquityPercent ? valuationMetrics.returnOnEquityPercent.toFixed(1) + '%' : 'N/A'}
- Beta: ${valuationMetrics.beta ?? 'N/A'} | Short Interest: ${valuationMetrics.shortPercentOfFloat ? valuationMetrics.shortPercentOfFloat.toFixed(1) + '%' : 'N/A'}

RECENT NEWS HEADLINES:
${newsArticles.map((n, i) => `${i + 1}. [${n.publisher}] ${n.title}`).join('\n') || 'No major breaking news headlines.'}

USER PORTFOLIO CONTEXT:
${portfolioContext ? JSON.stringify(portfolioContext, null, 2) : 'Stock is on Watchlist / not currently held.'}

REQUIRED JSON STRUCTURE:
{
  "classification": "VOLATILITY_DRIVEN" | "FUNDAMENTAL_IMPAIRMENT" | "MACRO_SECTOR_ROTATION" | "OVERREACTION_OPPORTUNITY",
  "verdict": "STRONG_BUY_DIP" | "ACCUMULATE_PULLBACK" | "HOLD_WAIT_FOR_BASE" | "AVOID_FALLING_KNIFE" | "TRIM_DEFENSIVE",
  "opportunityScore": 85,
  "fundamentalHealthScore": 88,
  "volatilityFactorPercent": 80,
  "fundamentalFactorPercent": 20,
  "primaryDriverSummary": "One or two concise sentences stating exact reason for the decline.",
  "executiveDiagnosis": "Institutional breakdown of the move, examining if business quality is intact.",
  "fundamentalAnalysis": {
    "isBusinessThesisIntact": true,
    "balanceSheetStrength": "ROBUST" | "MODERATE" | "VULNERABLE",
    "earningsQuality": "STRONG" | "MIXED" | "WEAK_DOWNGRADED",
    "details": "Specific commentary on cash flow, revenue growth, guidance, margins, and debt."
  },
  "volatilityAnalysis": {
    "marketBetaImpact": "Description of beta and index correlation",
    "sectorRotationContext": "Description of sector headwinds or rotation flows",
    "gammaOrLiquidityPressure": "Analysis of options expiration, gamma squeeze, or short pressure",
    "details": "Detailed commentary on technical and liquidity drivers."
  },
  "valuationAssessment": {
    "currentDiscountVs52WHigh": "e.g. 18.5% discount to peak",
    "historicalValuationContext": "e.g. Forward P/E of 22x is at 2-year low vs historical 30x",
    "isUndervalued": true,
    "summary": "Valuation summary"
  },
  "tacticalActionPlan": {
    "recommendedEntryZone": "$XXX - $XXX",
    "dcaStrategy": "Detailed accumulation tranches (e.g. 33% at $X, 33% at $Y, 34% at $Z)",
    "optionsStrategy": "Actionable options playbook (e.g. Cash-secured puts, long call spreads, covered calls)",
    "stopLossOrInvalidation": "$XXX hard level or thesis breach criteria",
    "timeHorizon": "SWING_1_3M" | "IMMEDIATE_1_2W" | "LONG_TERM_6M_PLUS"
  },
  "keyRiskFactors": [
    "Risk 1",
    "Risk 2",
    "Risk 3"
  ],
  "upsideCatalysts": [
    "Catalyst 1",
    "Catalyst 2",
    "Catalyst 3"
  ]
}`;

    let parsedResponse: any = null;

    try {
      logToFile(`[Dip Diagnostic] Querying LLM fallback router (OpenRouter -> Gemini -> Groq) for ${cleanSymbol}...`);
      const llmResult = await generateJsonCompletion<any>({
        systemPrompt,
        userPrompt,
        tag: `DipDiagnostic-${cleanSymbol}`,
      });
      parsedResponse = llmResult.data;
    } catch (llmErr: any) {
      logToFile(`[Dip Diagnostic] LLM fallback cascade warning (${llmErr?.message || llmErr})`);
    }

    // Fallback heuristic generator if LLM response unavailable
    if (!parsedResponse) {
      logToFile(`[Dip Diagnostic] Using quantitative institutional heuristic fallback for ${cleanSymbol}`);
      
      const { score: oppScore, potentialDriver, breakdown: buyBreakdown } = calculateInstitutionalBuyScore({
        price: currentPrice,
        dayChangePct,
        distFromHigh: distFrom52WHigh,
        fiftyTwoWHigh: fiftyTwoHigh,
        fiftyTwoWLow: fiftyTwoLow,
        fiftyDaySMA: summaryDetail?.fiftyDayAverage,
        twoHundredDaySMA: summaryDetail?.twoHundredDayAverage,
        dayLow: priceModule?.regularMarketDayLow ?? summaryDetail?.dayLow,
        dayHigh: priceModule?.regularMarketDayHigh ?? summaryDetail?.dayHigh,
        volume: priceModule?.regularMarketVolume ?? summaryDetail?.volume ?? 0,
        avgVolume: summaryDetail?.averageDailyVolume3Month ?? priceModule?.averageDailyVolume3Month ?? 1,
        volumeMult: 1.0,
        summaryDetail,
        financialData: finData,
        defaultKeyStatistics: keyStats,
        benchmarks,
        holdingPosition: portfolioContext
      });

      const isVolatile = potentialDriver === 'LIKELY_VOLATILITY' || potentialDriver === 'MARKET_WIDE_CORRECTION';
      const volFactor = isVolatile ? 75 : 40;
      const fundFactor = 100 - volFactor;
      const fundHealthScore = Math.round((buyBreakdown.fundamentalScore / 25) * 100);

      parsedResponse = {
        classification: isVolatile ? 'VOLATILITY_DRIVEN' : 'MACRO_SECTOR_ROTATION',
        verdict: oppScore >= 85 ? 'STRONG_BUY_DIP' : oppScore >= 70 ? 'ACCUMULATE_PULLBACK' : oppScore >= 50 ? 'HOLD_WAIT_FOR_BASE' : 'AVOID_FALLING_KNIFE',
        opportunityScore: oppScore,
        fundamentalHealthScore: fundHealthScore,
        volatilityFactorPercent: volFactor,
        fundamentalFactorPercent: fundFactor,
        primaryDriverSummary: `${cleanSymbol} is experiencing a ${Math.abs(dayChangePct).toFixed(1)}% drop with a Buy Score of ${oppScore}/100, characterized by ${buyBreakdown.valuationGrade.toLowerCase().replace('_', ' ')} valuation and ${buyBreakdown.fundamentalGrade.toLowerCase()} financial health.`,
        executiveDiagnosis: `Quantitative multi-factor analysis indicates ${buyBreakdown.valuationGrade.toLowerCase()} valuation with ${buyBreakdown.technicalSetup.toLowerCase().replace(/_/g, ' ')}. The fundamental health score is ${fundHealthScore}/100.`,
        fundamentalAnalysis: {
          isBusinessThesisIntact: fundHealthScore >= 50,
          balanceSheetStrength: (valuationMetrics.debtToEquity && valuationMetrics.debtToEquity < 100) ? 'ROBUST' : 'MODERATE',
          earningsQuality: 'STRONG',
          details: `Free cash flow of ${valuationMetrics.freeCashflow ? '$' + (valuationMetrics.freeCashflow / 1e6).toFixed(1) + 'M' : 'positive'} supports liquidity with ${valuationMetrics.operatingMarginPercent ? valuationMetrics.operatingMarginPercent.toFixed(1) + '%' : 'healthy'} operating margins.`
        },
        volatilityAnalysis: {
          marketBetaImpact: `Beta of ${valuationMetrics.beta ?? 1.2} amplifies benchmark index swings.`,
          sectorRotationContext: `Sector sentiment is currently under pressure amid macro rate fluctuations.`,
          gammaOrLiquidityPressure: `Standard institutional rebalancing volume observed.`,
          details: `Drawdown reflects broader equity market risk-off sentiment rather than idiosyncratic deterioration.`
        },
        valuationAssessment: {
          currentDiscountVs52WHigh: `${Math.abs(distFrom52WHigh).toFixed(1)}% discount to 52-week high`,
          historicalValuationContext: `Forward P/E of ${valuationMetrics.forwardPE ?? 'attractive levels'} presents favorable risk/reward.`,
          isUndervalued: true,
          summary: `Attractive valuation discount relative to long-term growth outlook.`
        },
        tacticalActionPlan: {
          recommendedEntryZone: `$${(currentPrice * 0.96).toFixed(2)} - $${currentPrice.toFixed(2)}`,
          dcaStrategy: `Scale in 3 tranches: 35% at current price, 35% on retest of $${(currentPrice * 0.95).toFixed(2)}, 30% reserve.`,
          optionsStrategy: `Consider selling 30-45 DTE Cash-Secured Puts at $${(currentPrice * 0.92).toFixed(2)} strike to harvest high implied volatility.`,
          stopLossOrInvalidation: `$${(fiftyTwoLow * 0.98).toFixed(2)} or sustained close below major moving averages.`,
          timeHorizon: 'SWING_1_3M'
        },
        keyRiskFactors: [
          'Prolonged macroeconomic risk-off sentiment across equity markets',
          'Sector-wide multiple contraction in rising rate environment',
          'Potential delays in near-term revenue recognition'
        ],
        upsideCatalysts: [
          'Next quarterly earnings release and guidance beat',
          'Macro relief rally and stabilization of benchmark indices',
          'Valuation multiple mean-reversion toward historical averages'
        ]
      };
    }

    const finalResult: DipDiagnosticResult = {
      symbol: cleanSymbol,
      companyName,
      currentPrice,
      dayChangePercent: dayChangePct,
      distanceFrom52WHigh: distFrom52WHigh,
      analyzedAt: new Date().toISOString(),
      classification: parsedResponse.classification || 'VOLATILITY_DRIVEN',
      verdict: parsedResponse.verdict || 'ACCUMULATE_PULLBACK',
      opportunityScore: typeof parsedResponse.opportunityScore === 'number'
        ? Math.max(0, Math.min(100, parsedResponse.opportunityScore))
        : 75,
      fundamentalHealthScore: typeof parsedResponse.fundamentalHealthScore === 'number'
        ? Math.max(0, Math.min(100, parsedResponse.fundamentalHealthScore))
        : 80,
      volatilityFactorPercent: typeof parsedResponse.volatilityFactorPercent === 'number'
        ? Math.max(0, Math.min(100, parsedResponse.volatilityFactorPercent))
        : 70,
      fundamentalFactorPercent: typeof parsedResponse.fundamentalFactorPercent === 'number'
        ? Math.max(0, Math.min(100, parsedResponse.fundamentalFactorPercent))
        : 30,
      primaryDriverSummary: parsedResponse.primaryDriverSummary || `${cleanSymbol} is down ${Math.abs(dayChangePct).toFixed(1)}% due to market dynamics.`,
      executiveDiagnosis: parsedResponse.executiveDiagnosis || 'Comprehensive diagnostic completed.',
      fundamentalAnalysis: parsedResponse.fundamentalAnalysis || {
        isBusinessThesisIntact: true,
        balanceSheetStrength: 'ROBUST',
        earningsQuality: 'STRONG',
        details: 'Core fundamentals and balance sheet are solid.'
      },
      volatilityAnalysis: parsedResponse.volatilityAnalysis || {
        marketBetaImpact: 'Normal market beta volatility',
        sectorRotationContext: 'Sector rotation pressure',
        gammaOrLiquidityPressure: 'Liquidity flows balanced',
        details: 'Move is predominantly volatility-driven.'
      },
      valuationAssessment: parsedResponse.valuationAssessment || {
        currentDiscountVs52WHigh: `${Math.abs(distFrom52WHigh).toFixed(1)}% discount`,
        historicalValuationContext: 'Trading at discount to peak valuation',
        isUndervalued: true,
        summary: 'Favorable entry multiple'
      },
      tacticalActionPlan: parsedResponse.tacticalActionPlan || {
        recommendedEntryZone: `$${(currentPrice * 0.97).toFixed(2)} - $${currentPrice.toFixed(2)}`,
        dcaStrategy: 'Scale into position across 2-3 tranches',
        optionsStrategy: 'Sell Out-Of-The-Money Cash-Secured Puts',
        stopLossOrInvalidation: `$${(currentPrice * 0.90).toFixed(2)}`,
        timeHorizon: 'SWING_1_3M'
      },
      keyRiskFactors: parsedResponse.keyRiskFactors || ['Broader market volatility', 'Sector rotation'],
      upsideCatalysts: parsedResponse.upsideCatalysts || ['Upcoming earnings report', 'Valuation re-rating'],
      recentNewsHeadlines: newsArticles,
      valuationMetrics,
      benchmarks,
      portfolioContext
    };

    // Save to Database for permanent lookup
    if (options.prisma) {
      try {
        const savedRecord = await options.prisma.dipDiagnosticReport.create({
          data: {
            symbol: cleanSymbol,
            companyName: finalResult.companyName,
            currentPrice: finalResult.currentPrice,
            dayChangePercent: finalResult.dayChangePercent,
            distanceFrom52WHigh: finalResult.distanceFrom52WHigh,
            classification: finalResult.classification,
            verdict: finalResult.verdict,
            opportunityScore: finalResult.opportunityScore,
            fundamentalHealthScore: finalResult.fundamentalHealthScore,
            volatilityFactorPercent: finalResult.volatilityFactorPercent,
            fundamentalFactorPercent: finalResult.fundamentalFactorPercent,
            primaryDriverSummary: finalResult.primaryDriverSummary,
            executiveDiagnosis: finalResult.executiveDiagnosis,
            targetEntryZone: finalResult.tacticalActionPlan?.recommendedEntryZone || null,
            dcaStrategy: finalResult.tacticalActionPlan?.dcaStrategy || null,
            optionsStrategy: finalResult.tacticalActionPlan?.optionsStrategy || null,
            stopLossOrInvalidation: finalResult.tacticalActionPlan?.stopLossOrInvalidation || null,
            timeHorizon: finalResult.tacticalActionPlan?.timeHorizon || null,
            contentJson: JSON.stringify(finalResult),
          }
        });

        finalResult.savedReportId = savedRecord.id;
        finalResult.savedAt = savedRecord.createdAt.toISOString();
        finalResult.isSavedReport = true;
        logToFile(`[Dip Diagnostic] Saved diagnostic report to database (ID: ${savedRecord.id}) for ${cleanSymbol}`);
      } catch (dbErr: any) {
        logToFile(`[Dip Diagnostic] Warning saving diagnostic report to DB: ${dbErr?.message}`);
      }
    }

    // Save to in-memory cache
    diagnosticCache.set(cleanSymbol, {
      result: finalResult,
      timestamp: Date.now()
    });

    agentActivityTracker.completeTask(task.id, {
      status: 'SUCCESS',
      outcomeSummary: `Diagnosed & Saved ${cleanSymbol}: ${finalResult.classification} | Verdict: ${finalResult.verdict} | Opportunity Score: ${finalResult.opportunityScore}/100`,
      metadata: {
        symbol: cleanSymbol,
        verdict: finalResult.verdict,
        opportunityScore: finalResult.opportunityScore,
        classification: finalResult.classification,
        reportId: finalResult.savedReportId
      }
    });

    return finalResult;
  } catch (error: any) {
    logToFile(`[Dip Diagnostic] Error diagnosing ${cleanSymbol}: ${error.message}`);
    agentActivityTracker.completeTask(task.id, {
      status: 'FAILED',
      outcomeSummary: `Failed to diagnose ${cleanSymbol}: ${error.message}`,
      error: error.message
    });
    throw error;
  }
}

/**
 * List all saved dip reports from DB
 */
export async function listSavedDipReports(prisma: PrismaClient, limit = 50) {
  return prisma.dipDiagnosticReport.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get historical diagnostic reports for a specific symbol
 */
export async function getDipReportHistory(prisma: PrismaClient, symbol: string, limit = 10) {
  const clean = symbol.trim().toUpperCase();
  return prisma.dipDiagnosticReport.findMany({
    where: { symbol: clean },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Delete a saved dip report by ID
 */
export async function deleteSavedDipReport(prisma: PrismaClient, id: string) {
  return prisma.dipDiagnosticReport.delete({
    where: { id },
  });
}
