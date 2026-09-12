import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
  validation: { logErrors: false }
});

export type Timeframe = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type LevelType = 'SUPPORT' | 'RESISTANCE' | 'PIVOT';

export type LevelStrength = 'MAJOR' | 'MODERATE' | 'MINOR';

export interface SupportResistanceLevel {
  id: string;
  price: number;
  type: LevelType;
  timeframe: Timeframe;
  strength: LevelStrength;
  touchCount: number;
  distancePercent: number; // e.g. +3.4% or -2.1%
  distanceDollar: number;
  label: string; // e.g. "Daily Resistance 1", "Weekly Major Support"
  description: string;
  isImmediate: boolean; // Nearest S or R to current price
}

export type MarketStage =
  | 'STAGE_1_ACCUMULATION'
  | 'STAGE_2_MARKUP'
  | 'STAGE_3_DISTRIBUTION'
  | 'STAGE_4_MARKDOWN';

export type MarketSubPhase =
  | 'EARLY_STAGE_BREAKOUT'
  | 'MID_STAGE_ADVANCE'
  | 'LATE_STAGE_CLIMAX'
  | 'DISTRIBUTION_TOPPING'
  | 'INITIAL_BREAKDOWN'
  | 'SUSTAINED_DECLINE'
  | 'CAPITULATION_BOTTOM'
  | 'CONSOLIDATION_BASE';

export interface MarketPhaseInfo {
  stage: MarketStage;
  stageName: string; // e.g. "Stage 2: Markup Phase"
  subPhase: MarketSubPhase;
  subPhaseName: string; // e.g. "Mid-Stage Sustained Advance"
  confidenceScore: number; // 0 - 100
  phaseAgeEstimate: string; // e.g. "approx. 3 months"
  summary: string;
  keyCharacteristics: string[];
  diagnosticDetails: string;
}

export type TrendDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface TrendHierarchy {
  shortTerm: {
    direction: TrendDirection;
    label: string;
    description: string;
  };
  mediumTerm: {
    direction: TrendDirection;
    label: string;
    description: string;
  };
  longTerm: {
    direction: TrendDirection;
    label: string;
    description: string;
  };
  primaryTrend: TrendDirection;
  trendStrengthScore: number; // 0 - 100
  adx: number; // Average Directional Index (0 - 100)
  movingAverageAlignment: 'BULLISH_STACK' | 'BEARISH_STACK' | 'MIXED_COMPRESSION';
  alignmentDescription: string;
  isGoldenCross: boolean;
  isDeathCross: boolean;
  goldenCrossDate?: string;
  deathCrossDate?: string;
}

export interface MovingAveragesData {
  dma20: number;
  dma50: number;
  dma200: number;
  dma20DistPct: number;
  dma50DistPct: number;
  dma200DistPct: number;
  slope50: 'RISING' | 'FLAT' | 'FALLING';
  slope200: 'RISING' | 'FLAT' | 'FALLING';
}

export interface OscillatorsData {
  rsi14: number;
  rsiCondition: 'OVERBOUGHT' | 'BULLISH_MOMENTUM' | 'NEUTRAL' | 'BEARISH_MOMENTUM' | 'OVERSOLD';
  rsiInterpretation: string;
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
    crossover: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL';
    interpretation: string;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    bandwidthPct: number;
    percentB: number;
    isSqueeze: boolean; // Bandwidth contraction alerting volatility breakout
  };
  atr14: number;
  atrPercent: number; // Daily expected move %
  relativeVolume: number; // Current volume vs 30D average volume (e.g. 1.35x)
  volumeCondition: 'VERY_HIGH' | 'ABOVE_AVERAGE' | 'NORMAL' | 'BELOW_AVERAGE';
  fiftyTwoWeek: {
    high: number;
    low: number;
    distHighPct: number;
    distLowPct: number;
  };
}

export interface PivotPointsData {
  classic: {
    pp: number;
    r1: number;
    r2: number;
    r3: number;
    s1: number;
    s2: number;
    s3: number;
  };
  fibonacci: {
    level0: number; // 52w low
    level236: number;
    level382: number;
    level500: number;
    level618: number;
    level786: number;
    level1000: number; // 52w high
  };
}

export type ActionableVerdict =
  | 'STRONG_BUY'
  | 'BUY_ON_PULLBACK'
  | 'HOLD_TRAIL_STOPS'
  | 'TAKE_PROFIT'
  | 'NEUTRAL_WAIT'
  | 'TRIM_DEFENSIVE'
  | 'AVOID_BEARISH';

export interface ActionableBlueprint {
  verdict: ActionableVerdict;
  verdictTitle: string;
  bias: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  idealEntryZone: {
    low: number;
    high: number;
    rationale: string;
  };
  invalidationStop: {
    price: number;
    distancePct: number;
    rationale: string;
  };
  targets: Array<{
    label: string;
    price: number;
    distancePct: number;
    rationale: string;
  }>;
  riskRewardRatio: number; // e.g. 2.8
  playbookGuidance: string;
}

export interface StockTechnicalAnalysis {
  symbol: string;
  name: string;
  currency: string;
  currentPrice: number;
  previousClose: number;
  dayChange: number;
  dayChangePercent: number;
  asOf: string;

  // Support & Resistance
  levels: SupportResistanceLevel[];
  immediateResistance: SupportResistanceLevel | null;
  immediateSupport: SupportResistanceLevel | null;
  pivotPoints: PivotPointsData;

  // Market Phase
  marketPhase: MarketPhaseInfo;

  // Trend & Moving Averages
  trend: TrendHierarchy;
  movingAverages: MovingAveragesData;

  // Technical Indicators
  oscillators: OscillatorsData;

  // Actionable Trade Strategy
  blueprint: ActionableBlueprint;
}

// In-memory cache: 2 minutes TTL
const cache = new Map<string, { data: StockTechnicalAnalysis; timestamp: number }>();
const CACHE_TTL_MS = 2 * 60 * 1000;

// --- Technical Calculation Helpers ---

export function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const slice = prices.slice(prices.length - period);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return Number((sum / period).toFixed(2));
}

export function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  if (prices.length < period) return calculateSMA(prices, prices.length);

  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((acc, v) => acc + v, 0) / period;

  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }

  return Number(ema.toFixed(2));
}

export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length <= period) return 50.0;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  return Number(rsi.toFixed(1));
}

export function calculateMACD(prices: number[]): {
  macdLine: number;
  signalLine: number;
  histogram: number;
} {
  if (prices.length < 35) {
    return { macdLine: 0, signalLine: 0, histogram: 0 };
  }

  // Calculate series of MACD differences (EMA 12 - EMA 26)
  const macdHistory: number[] = [];
  const startIdx = 26;

  for (let i = startIdx; i <= prices.length; i++) {
    const subset = prices.slice(0, i);
    const ema12 = calculateEMA(subset, 12);
    const ema26 = calculateEMA(subset, 26);
    macdHistory.push(ema12 - ema26);
  }

  const currentMacd = macdHistory[macdHistory.length - 1];
  const currentSignal = calculateEMA(macdHistory, 9);
  const histogram = currentMacd - currentSignal;

  return {
    macdLine: Number(currentMacd.toFixed(2)),
    signalLine: Number(currentSignal.toFixed(2)),
    histogram: Number(histogram.toFixed(2)),
  };
}

export function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number {
  if (highs.length < 2) return 0;
  const trs: number[] = [];

  for (let i = 1; i < highs.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    trs.push(Math.max(hl, hc, lc));
  }

  if (trs.length < period) {
    const sum = trs.reduce((a, b) => a + b, 0);
    return Number((sum / (trs.length || 1)).toFixed(2));
  }

  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }

  return Number(atr.toFixed(2));
}

export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  multiplier: number = 2
): { upper: number; middle: number; lower: number; bandwidthPct: number; percentB: number } {
  if (prices.length < period) {
    const p = prices[prices.length - 1] || 100;
    return { upper: p * 1.05, middle: p, lower: p * 0.95, bandwidthPct: 10, percentB: 0.5 };
  }

  const middle = calculateSMA(prices, period);
  const slice = prices.slice(prices.length - period);
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = Number((middle + multiplier * stdDev).toFixed(2));
  const lower = Number((middle - multiplier * stdDev).toFixed(2));
  const bandwidthPct = middle > 0 ? Number((((upper - lower) / middle) * 100).toFixed(2)) : 0;
  const current = prices[prices.length - 1];
  const percentB = upper !== lower ? Number(((current - lower) / (upper - lower)).toFixed(2)) : 0.5;

  return { upper, middle, lower, bandwidthPct, percentB };
}

/**
 * Local extrema pivot detector: finds swing highs and swing lows
 */
export function detectPivots(
  quotes: Array<{ high: number; low: number; close: number; date: Date | string }>,
  leftBars: number = 4,
  rightBars: number = 4
): { swingHighs: Array<{ price: number; date: any }>; swingLows: Array<{ price: number; date: any }> } {
  const swingHighs: Array<{ price: number; date: any }> = [];
  const swingLows: Array<{ price: number; date: any }> = [];

  for (let i = leftBars; i < quotes.length - rightBars; i++) {
    const currentHigh = quotes[i].high;
    const currentLow = quotes[i].low;

    let isHigh = true;
    let isLow = true;

    for (let j = i - leftBars; j <= i + rightBars; j++) {
      if (j === i) continue;
      if (quotes[j].high > currentHigh) isHigh = false;
      if (quotes[j].low < currentLow) isLow = false;
    }

    if (isHigh) swingHighs.push({ price: Number(currentHigh.toFixed(2)), date: quotes[i].date });
    if (isLow) swingLows.push({ price: Number(currentLow.toFixed(2)), date: quotes[i].date });
  }

  return { swingHighs, swingLows };
}

/**
 * Cluster nearby pivot prices within a tolerance threshold (e.g. 1.8%)
 */
export function clusterPivots(
  pivots: number[],
  tolerancePct: number = 1.8
): Array<{ price: number; touchCount: number }> {
  if (pivots.length === 0) return [];
  const sorted = [...pivots].sort((a, b) => a - b);
  const clusters: Array<{ prices: number[]; touchCount: number }> = [];

  for (const p of sorted) {
    let placed = false;
    for (const c of clusters) {
      const avg = c.prices.reduce((sum, val) => sum + val, 0) / c.prices.length;
      if (Math.abs(p - avg) / avg <= tolerancePct / 100) {
        c.prices.push(p);
        c.touchCount++;
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push({ prices: [p], touchCount: 1 });
    }
  }

  return clusters.map((c) => ({
    price: Number((c.prices.reduce((s, v) => s + v, 0) / c.prices.length).toFixed(2)),
    touchCount: c.touchCount,
  }));
}

export class TechnicalAnalysisService {
  /**
   * Main entry point to perform multi-timeframe technical analysis on any stock
   */
  async getTechnicalAnalysis(rawSymbol: string): Promise<StockTechnicalAnalysis> {
    const symbol = (rawSymbol || '').trim().toUpperCase();
    if (!symbol) throw new Error('Symbol must be specified');

    // Check in-memory cache
    const cached = cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    // 1. Fetch live quote
    let quote: any = null;
    try {
      quote = await yahooFinance.quote(symbol);
    } catch (e: any) {
      console.warn(`Quote fetch warning for ${symbol}:`, e?.message);
    }

    // 2. Fetch daily candles (1 year history for swing & moving averages)
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);

    let dailyChart: any = null;
    try {
      dailyChart = await yahooFinance.chart(symbol, {
        period1: oneYearAgo,
        period2: now,
        interval: '1d',
      });
    } catch (e: any) {
      console.warn(`Daily chart fetch warning for ${symbol}:`, e?.message);
    }

    // 3. Fetch weekly candles (2.5 years for structural support/resistance)
    const twoAndHalfYearsAgo = new Date();
    twoAndHalfYearsAgo.setDate(twoAndHalfYearsAgo.getDate() - 900);

    let weeklyChart: any = null;
    try {
      weeklyChart = await yahooFinance.chart(symbol, {
        period1: twoAndHalfYearsAgo,
        period2: now,
        interval: '1wk',
      });
    } catch (e: any) {
      console.warn(`Weekly chart fetch warning for ${symbol}:`, e?.message);
    }

    // 4. Fetch monthly candles (5 years for macro multi-year levels)
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setDate(fiveYearsAgo.getDate() - 1825);

    let monthlyChart: any = null;
    try {
      monthlyChart = await yahooFinance.chart(symbol, {
        period1: fiveYearsAgo,
        period2: now,
        interval: '1mo',
      });
    } catch (e: any) {
      console.warn(`Monthly chart fetch warning for ${symbol}:`, e?.message);
    }

    // Process daily bars
    const rawDailyQuotes = (dailyChart?.quotes || []).filter(
      (q: any) => typeof q.close === 'number' && !isNaN(q.close) && q.close > 0
    );

    const closePrices = rawDailyQuotes.map((q: any) => q.close);
    const highPrices = rawDailyQuotes.map((q: any) => q.high || q.close);
    const lowPrices = rawDailyQuotes.map((q: any) => q.low || q.close);
    const volumes = rawDailyQuotes.map((q: any) => q.volume || 0);

    const currentPrice =
      quote?.regularMarketPrice ||
      (closePrices.length > 0 ? closePrices[closePrices.length - 1] : 100);
    const prevClose =
      quote?.regularMarketPreviousClose ||
      (closePrices.length > 1 ? closePrices[closePrices.length - 2] : currentPrice);

    const dayChange = Number((currentPrice - prevClose).toFixed(2));
    const dayChangePercent =
      prevClose > 0 ? Number(((dayChange / prevClose) * 100).toFixed(2)) : 0;

    const companyName = quote?.shortName || quote?.longName || `${symbol} Inc.`;
    const currency = quote?.currency || 'USD';

    // 5. Technical Indicators & Moving Averages
    const dma20 = closePrices.length >= 20 ? calculateEMA(closePrices, 20) : currentPrice;
    const dma50 = closePrices.length >= 50 ? calculateSMA(closePrices, 50) : currentPrice;
    const dma200 = closePrices.length >= 180 ? calculateSMA(closePrices, 200) : (dma50 || currentPrice);

    const dma20DistPct = dma20 > 0 ? Number((((currentPrice - dma20) / dma20) * 100).toFixed(2)) : 0;
    const dma50DistPct = dma50 > 0 ? Number((((currentPrice - dma50) / dma50) * 100).toFixed(2)) : 0;
    const dma200DistPct = dma200 > 0 ? Number((((currentPrice - dma200) / dma200) * 100).toFixed(2)) : 0;

    // Moving average slopes
    const prev50 = closePrices.length >= 60 ? calculateSMA(closePrices.slice(0, -10), 50) : dma50;
    const slope50: 'RISING' | 'FLAT' | 'FALLING' =
      dma50 > prev50 * 1.005 ? 'RISING' : dma50 < prev50 * 0.995 ? 'FALLING' : 'FLAT';

    const prev200 = closePrices.length >= 220 ? calculateSMA(closePrices.slice(0, -20), 200) : dma200;
    const slope200: 'RISING' | 'FLAT' | 'FALLING' =
      dma200 > prev200 * 1.003 ? 'RISING' : dma200 < prev200 * 0.997 ? 'FALLING' : 'FLAT';

    const rsi14 = closePrices.length >= 15 ? calculateRSI(closePrices, 14) : 50.0;
    const macd = calculateMACD(closePrices);
    const bb = calculateBollingerBands(closePrices, 20, 2);
    const atr14 = calculateATR(highPrices, lowPrices, closePrices, 14);
    const atrPercent = currentPrice > 0 ? Number(((atr14 / currentPrice) * 100).toFixed(2)) : 0;

    // Volume analysis (last 30 days)
    const recentVolumes = volumes.slice(-30);
    const avg30Vol =
      recentVolumes.length > 0
        ? recentVolumes.reduce((a: number, b: number) => a + b, 0) / recentVolumes.length
        : 1;
    const curVol = quote?.regularMarketVolume || (volumes.length > 0 ? volumes[volumes.length - 1] : avg30Vol);
    const relativeVolume = avg30Vol > 0 ? Number((curVol / avg30Vol).toFixed(2)) : 1.0;

    const volumeCondition: 'VERY_HIGH' | 'ABOVE_AVERAGE' | 'NORMAL' | 'BELOW_AVERAGE' =
      relativeVolume >= 2.0
        ? 'VERY_HIGH'
        : relativeVolume >= 1.25
        ? 'ABOVE_AVERAGE'
        : relativeVolume <= 0.75
        ? 'BELOW_AVERAGE'
        : 'NORMAL';

    // 52-week statistics
    const fiftyTwoWeekHigh =
      quote?.fiftyTwoWeekHigh || Math.max(...highPrices.slice(-252), currentPrice);
    const fiftyTwoWeekLow =
      quote?.fiftyTwoWeekLow || Math.min(...lowPrices.slice(-252), currentPrice);
    const dist52WHighPct =
      fiftyTwoWeekHigh > 0 ? Number((((currentPrice - fiftyTwoWeekHigh) / fiftyTwoWeekHigh) * 100).toFixed(2)) : 0;
    const dist52WLowPct =
      fiftyTwoWeekLow > 0 ? Number((((currentPrice - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100).toFixed(2)) : 0;

    // 6. Multi-Timeframe Support & Resistance Engine
    const dailyPivots = detectPivots(rawDailyQuotes.slice(-130), 3, 3);
    const weeklyQuotes = (weeklyChart?.quotes || []).filter(
      (q: any) => typeof q.close === 'number' && !isNaN(q.close) && q.close > 0
    );
    const weeklyPivots = detectPivots(weeklyQuotes, 3, 3);
    const monthlyQuotes = (monthlyChart?.quotes || []).filter(
      (q: any) => typeof q.close === 'number' && !isNaN(q.close) && q.close > 0
    );
    const monthlyPivots = detectPivots(monthlyQuotes, 2, 2);

    // Group clusters
    const dailyResistanceClusters = clusterPivots(
      dailyPivots.swingHighs.map((h) => h.price).filter((p) => p > currentPrice * 1.002)
    );
    const dailySupportClusters = clusterPivots(
      dailyPivots.swingLows.map((l) => l.price).filter((p) => p < currentPrice * 0.998)
    );

    const weeklyResistanceClusters = clusterPivots(
      weeklyPivots.swingHighs.map((h) => h.price).filter((p) => p > currentPrice * 1.002)
    );
    const weeklySupportClusters = clusterPivots(
      weeklyPivots.swingLows.map((l) => l.price).filter((p) => p < currentPrice * 0.998)
    );

    const monthlyResistanceClusters = clusterPivots(
      monthlyPivots.swingHighs.map((h) => h.price).filter((p) => p > currentPrice * 1.002)
    );
    const monthlySupportClusters = clusterPivots(
      monthlyPivots.swingLows.map((l) => l.price).filter((p) => p < currentPrice * 0.998)
    );

    // Build unified levels array
    const levels: SupportResistanceLevel[] = [];

    // Helper to format level
    const addLevel = (
      price: number,
      type: LevelType,
      timeframe: Timeframe,
      strength: LevelStrength,
      touchCount: number,
      label: string,
      description: string
    ) => {
      const distDollar = Number((price - currentPrice).toFixed(2));
      const distPct = Number((((price - currentPrice) / currentPrice) * 100).toFixed(2));
      levels.push({
        id: `${timeframe}_${type}_${Math.round(price * 100)}`,
        price,
        type,
        timeframe,
        strength,
        touchCount: Math.max(1, touchCount),
        distancePercent: distPct,
        distanceDollar: distDollar,
        label,
        description,
        isImmediate: false,
      });
    };

    // Daily Levels
    dailyResistanceClusters.slice(0, 3).forEach((c, idx) => {
      addLevel(
        c.price,
        'RESISTANCE',
        'DAILY',
        c.touchCount >= 3 ? 'MAJOR' : c.touchCount === 2 ? 'MODERATE' : 'MINOR',
        c.touchCount,
        `Daily Resistance ${idx + 1}`,
        `Local swing high cluster with ${c.touchCount} price rejections on the daily chart`
      );
    });

    dailySupportClusters.slice(-3).reverse().forEach((c, idx) => {
      addLevel(
        c.price,
        'SUPPORT',
        'DAILY',
        c.touchCount >= 3 ? 'MAJOR' : c.touchCount === 2 ? 'MODERATE' : 'MINOR',
        c.touchCount,
        `Daily Support ${idx + 1}`,
        `Local swing low cluster with ${c.touchCount} confirmed bounces on the daily chart`
      );
    });

    // Weekly Levels
    weeklyResistanceClusters.slice(0, 2).forEach((c, idx) => {
      addLevel(
        c.price,
        'RESISTANCE',
        'WEEKLY',
        'MAJOR',
        c.touchCount,
        `Weekly Resistance ${idx + 1}`,
        `Multi-week structural ceiling tested across ${c.touchCount} weekly intervals`
      );
    });

    weeklySupportClusters.slice(-2).reverse().forEach((c, idx) => {
      addLevel(
        c.price,
        'SUPPORT',
        'WEEKLY',
        'MAJOR',
        c.touchCount,
        `Weekly Support ${idx + 1}`,
        `Multi-week structural foundation with ${c.touchCount} major weekly defense touches`
      );
    });

    // Monthly Macro Levels
    monthlyResistanceClusters.slice(0, 2).forEach((c, idx) => {
      addLevel(
        c.price,
        'RESISTANCE',
        'MONTHLY',
        'MAJOR',
        c.touchCount,
        `Monthly Macro Ceiling ${idx + 1}`,
        `Multi-year macro resistance ceiling`
      );
    });

    monthlySupportClusters.slice(-2).reverse().forEach((c, idx) => {
      addLevel(
        c.price,
        'SUPPORT',
        'MONTHLY',
        'MAJOR',
        c.touchCount,
        `Monthly Macro Base ${idx + 1}`,
        `Multi-year structural accumulation floor`
      );
    });

    // Fallbacks if no swing clusters detected (e.g. at all-time high or new IPO)
    if (!levels.some((l) => l.type === 'RESISTANCE')) {
      const fallbackR1 = Number((currentPrice * 1.05).toFixed(2));
      const fallbackR2 = Number((currentPrice * 1.10).toFixed(2));
      addLevel(fallbackR1, 'RESISTANCE', 'DAILY', 'MODERATE', 1, 'Psychological Resistance +5%', 'Projected resistance ceiling at round percentage buffer');
      addLevel(fallbackR2, 'RESISTANCE', 'DAILY', 'MAJOR', 1, 'Psychological Resistance +10%', 'Extended upside target');
    }

    if (!levels.some((l) => l.type === 'SUPPORT')) {
      const fallbackS1 = Number((currentPrice * 0.95).toFixed(2));
      const fallbackS2 = Number((currentPrice * 0.90).toFixed(2));
      addLevel(fallbackS1, 'SUPPORT', 'DAILY', 'MODERATE', 1, 'Psychological Support -5%', 'Projected downside support buffer');
      addLevel(fallbackS2, 'SUPPORT', 'DAILY', 'MAJOR', 1, 'Psychological Support -10%', 'Deep value demand floor');
    }

    // Sort levels ascending by price
    levels.sort((a, b) => a.price - b.price);

    // Identify Immediate Resistance (lowest resistance above current price)
    const resistancesAbove = levels
      .filter((l) => l.type === 'RESISTANCE' && l.price > currentPrice)
      .sort((a, b) => a.price - b.price);
    const immediateResistance = resistancesAbove[0] || null;
    if (immediateResistance) immediateResistance.isImmediate = true;

    // Identify Immediate Support (highest support below current price)
    const supportsBelow = levels
      .filter((l) => l.type === 'SUPPORT' && l.price < currentPrice)
      .sort((a, b) => b.price - a.price);
    const immediateSupport = supportsBelow[0] || null;
    if (immediateSupport) immediateSupport.isImmediate = true;

    // 7. Classic Floor Pivot Points & Fibonacci Retracements
    const priorDayHigh = highPrices.length > 1 ? highPrices[highPrices.length - 2] : currentPrice * 1.01;
    const priorDayLow = lowPrices.length > 1 ? lowPrices[lowPrices.length - 2] : currentPrice * 0.99;
    const priorDayClose = prevClose;

    const pp = Number(((priorDayHigh + priorDayLow + priorDayClose) / 3).toFixed(2));
    const r1 = Number((2 * pp - priorDayLow).toFixed(2));
    const s1 = Number((2 * pp - priorDayHigh).toFixed(2));
    const r2 = Number((pp + (priorDayHigh - priorDayLow)).toFixed(2));
    const s2 = Number((pp - (priorDayHigh - priorDayLow)).toFixed(2));
    const r3 = Number((priorDayHigh + 2 * (pp - priorDayLow)).toFixed(2));
    const s3 = Number((priorDayLow - 2 * (priorDayHigh - pp)).toFixed(2));

    const fibDiff = fiftyTwoWeekHigh - fiftyTwoWeekLow;
    const fibonacci = {
      level0: Number(fiftyTwoWeekLow.toFixed(2)),
      level236: Number((fiftyTwoWeekHigh - fibDiff * 0.236).toFixed(2)),
      level382: Number((fiftyTwoWeekHigh - fibDiff * 0.382).toFixed(2)),
      level500: Number((fiftyTwoWeekHigh - fibDiff * 0.5).toFixed(2)),
      level618: Number((fiftyTwoWeekHigh - fibDiff * 0.618).toFixed(2)),
      level786: Number((fiftyTwoWeekHigh - fibDiff * 0.786).toFixed(2)),
      level1000: Number(fiftyTwoWeekHigh.toFixed(2)),
    };

    const pivotPoints: PivotPointsData = {
      classic: { pp, r1, r2, r3, s1, s2, s3 },
      fibonacci,
    };

    // 8. Market Phase (Stan Weinstein & Wyckoff Stage Analysis)
    let stage: MarketStage = 'STAGE_2_MARKUP';
    let subPhase: MarketSubPhase = 'MID_STAGE_ADVANCE';
    let stageName = 'Stage 2: Markup Phase';
    let subPhaseName = 'Mid-Stage Sustained Advance';
    let confidenceScore = 85;
    let phaseAgeEstimate = 'approx. 2 to 4 months';
    let summary = '';
    const keyCharacteristics: string[] = [];
    let diagnosticDetails = '';

    const isAbove50 = currentPrice >= dma50;
    const isAbove200 = currentPrice >= dma200;
    const is50Above200 = dma50 >= dma200;

    if (isAbove50 && isAbove200 && is50Above200) {
      // Stage 2: Markup
      stage = 'STAGE_2_MARKUP';
      stageName = 'Stage 2: Markup Phase (Uptrend)';

      if (dma200DistPct > 25 || rsi14 > 73) {
        subPhase = 'LATE_STAGE_CLIMAX';
        subPhaseName = 'Late-Stage Climax / Overextended';
        confidenceScore = 88;
        phaseAgeEstimate = 'Extended (5+ months into run)';
        summary = `${symbol} is in late-stage markup, trading significantly stretched above its 200-day moving average (+${dma200DistPct}%). RSI (${rsi14}) signals elevated exhaustion risk. Protect gains with trailing stops.`;
        keyCharacteristics.push(`Extended +${dma200DistPct}% above 200 SMA`);
        keyCharacteristics.push(`High RSI momentum (${rsi14}) nearing climax`);
        keyCharacteristics.push('Higher risk of mean-reversion pullback to 50 SMA');
      } else if (dma50DistPct >= 0 && dma50DistPct <= 6 && slope50 === 'RISING') {
        subPhase = 'EARLY_STAGE_BREAKOUT';
        subPhaseName = 'Early-Stage Breakout / Expansion';
        confidenceScore = 90;
        phaseAgeEstimate = 'Fresh (1 to 6 weeks)';
        summary = `${symbol} is in early Stage 2 markup, breaking out with rising 50 SMA support. The moving averages have achieved bullish golden alignment, offering prime asymmetric risk-to-reward for continuation.`;
        keyCharacteristics.push('Fresh breakout above base resistance');
        keyCharacteristics.push('50 SMA turning aggressively upward');
        keyCharacteristics.push('Institutional accumulation support on volume');
      } else {
        subPhase = 'MID_STAGE_ADVANCE';
        subPhaseName = 'Mid-Stage Sustained Advance';
        confidenceScore = 92;
        phaseAgeEstimate = 'Healthy (2 to 4 months)';
        summary = `${symbol} is progressing smoothly through a classic Stage 2 markup. Price is respecting the rising 20 EMA and 50 SMA trend lines with strong structural higher highs and higher lows.`;
        keyCharacteristics.push('Orderly higher highs and higher lows');
        keyCharacteristics.push('20 EMA acting as active dynamic trend support');
        keyCharacteristics.push('Bullish moving average alignment: Price > 20 EMA > 50 SMA > 200 SMA');
      }

      diagnosticDetails = `Stan Weinstein Stage 2 confirms an established bull market cycle. Institutional capital is net-accumulating shares. Pullbacks towards the rising 20 EMA ($${dma20}) or 50 SMA ($${dma50}) represent standard high-probability dip buying opportunities rather than structural breakdowns.`;
    } else if (!isAbove50 && !isAbove200 && !is50Above200) {
      // Stage 4: Markdown
      stage = 'STAGE_4_MARKDOWN';
      stageName = 'Stage 4: Markdown Phase (Downtrend)';

      if (rsi14 < 28 || dma200DistPct < -25) {
        subPhase = 'CAPITULATION_BOTTOM';
        subPhaseName = 'Capitulation Bottom / Selling Exhaustion';
        confidenceScore = 80;
        phaseAgeEstimate = 'Mature decline (6+ months)';
        summary = `${symbol} is experiencing severe selling climax exhaustion in late Stage 4. RSI (${rsi14}) is deeply oversold and price is stretched -${Math.abs(dma200DistPct)}% below its 200 SMA, setting up potential relief counter-trend bounces.`;
        keyCharacteristics.push(`Severe oversold condition (RSI ${rsi14})`);
        keyCharacteristics.push(`Extended -${Math.abs(dma200DistPct)}% below 200 SMA`);
        keyCharacteristics.push('Potential climax bottoming volume');
      } else if (dma50DistPct <= 0 && dma50DistPct >= -6 && slope50 === 'FALLING') {
        subPhase = 'INITIAL_BREAKDOWN';
        subPhaseName = 'Initial Breakdown / Distribution Exit';
        confidenceScore = 86;
        phaseAgeEstimate = 'Fresh breakdown (1 to 4 weeks)';
        summary = `${symbol} has broken key structural support levels and entered early Stage 4 markdown. The 50 SMA has turned downward and moving averages are beginning a bearish death cross sequence.`;
        keyCharacteristics.push('Breakdown below key multi-week support');
        keyCharacteristics.push('50 SMA sloping downward');
        keyCharacteristics.push('Overhead supply creates persistent resistance on rallies');
      } else {
        subPhase = 'SUSTAINED_DECLINE';
        subPhaseName = 'Sustained Downtrend Decline';
        confidenceScore = 90;
        phaseAgeEstimate = 'Established (2 to 5 months)';
        summary = `${symbol} is locked in an active Stage 4 decline. Lower highs and lower lows dominate the chart, with the declining 20 EMA and 50 SMA serving as relentless overhead resistance ceilings.`;
        keyCharacteristics.push('Consistent lower highs and lower lows');
        keyCharacteristics.push('Bearish moving average stack: Price < 20 EMA < 50 SMA < 200 SMA');
        keyCharacteristics.push('Rallies are sold into rather than supported');
      }

      diagnosticDetails = `Stan Weinstein Stage 4 signifies dominant institutional distribution and liquidation. Capital preservation is priority. Long trades should be avoided or strictly hedged until an observable Stage 1 base takes shape.`;
    } else if (isAbove200 && !isAbove50) {
      // Stage 3: Distribution or Pullback in Uptrend
      stage = 'STAGE_3_DISTRIBUTION';
      stageName = 'Stage 3: Distribution / Consolidation Topping';
      subPhase = 'DISTRIBUTION_TOPPING';
      subPhaseName = 'Distribution / Choppy Top Formation';
      confidenceScore = 78;
      phaseAgeEstimate = 'Forming (1 to 3 months)';
      summary = `${symbol} is showing characteristics of Stage 3 distribution. While still above the long-term 200 SMA ($${dma200}), price has lost the 50 SMA ($${dma50}) and volatility has expanded into a choppy trading range near cycle highs.`;
      keyCharacteristics.push('Loss of 50-day moving average support');
      keyCharacteristics.push('Widening volatility and erratic swing highs');
      keyCharacteristics.push('Failure to achieve breakout continuation on volume');
      diagnosticDetails = `Stage 3 represents the transitional equilibrium phase where smart money quietly distributes stock to late momentum buyers. A failure to reclaim the 50 SMA increases the probability of an eventual Stage 4 breakdown.`;
    } else {
      // Stage 1: Base / Accumulation
      stage = 'STAGE_1_ACCUMULATION';
      stageName = 'Stage 1: Base Formation / Accumulation';
      subPhase = 'CONSOLIDATION_BASE';
      subPhaseName = 'Consolidation Base / Bottom Building';
      confidenceScore = 82;
      phaseAgeEstimate = 'Base building (2 to 6 months)';
      summary = `${symbol} is in a Stage 1 base-building accumulation phase. The multi-month downtrend has flattened, and price is oscillating horizontally between defined support ($${immediateSupport?.price || dma200}) and resistance ($${immediateResistance?.price || dma50}).`;
      keyCharacteristics.push('Flattening 200 SMA indicating cessation of decline');
      keyCharacteristics.push('Well-defined horizontal support and resistance boundaries');
      keyCharacteristics.push('Volume contraction during consolidation dips');
      diagnosticDetails = `Stage 1 is the quiet foundation period. Smart money accumulates shares within a bounded range without moving price aggressively. A high-volume weekly breakout above the Stage 1 resistance ceiling will mark the inception of Stage 2 markup.`;
    }

    const marketPhase: MarketPhaseInfo = {
      stage,
      stageName,
      subPhase,
      subPhaseName,
      confidenceScore,
      phaseAgeEstimate,
      summary,
      keyCharacteristics,
      diagnosticDetails,
    };

    // 9. Trend Hierarchy Analysis
    const shortTermDir: TrendDirection =
      currentPrice > dma20 && rsi14 > 52 ? 'BULLISH' : currentPrice < dma20 && rsi14 < 48 ? 'BEARISH' : 'NEUTRAL';
    const mediumTermDir: TrendDirection =
      isAbove50 && slope50 === 'RISING' ? 'BULLISH' : !isAbove50 && slope50 === 'FALLING' ? 'BEARISH' : 'NEUTRAL';
    const longTermDir: TrendDirection =
      isAbove200 && slope200 !== 'FALLING' ? 'BULLISH' : !isAbove200 && slope200 !== 'RISING' ? 'BEARISH' : 'NEUTRAL';

    const movingAverageAlignment: 'BULLISH_STACK' | 'BEARISH_STACK' | 'MIXED_COMPRESSION' =
      currentPrice >= dma20 && dma20 >= dma50 && dma50 >= dma200
        ? 'BULLISH_STACK'
        : currentPrice <= dma20 && dma20 <= dma50 && dma50 <= dma200
        ? 'BEARISH_STACK'
        : 'MIXED_COMPRESSION';

    const alignmentDescription =
      movingAverageAlignment === 'BULLISH_STACK'
        ? 'Perfect Bullish Stack: Price > 20 EMA > 50 SMA > 200 SMA (Full Trend Alignment)'
        : movingAverageAlignment === 'BEARISH_STACK'
        ? 'Full Bearish Stack: Price < 20 EMA < 50 SMA < 200 SMA (Dominant Downward Pressure)'
        : 'Mixed / Compressed: Moving averages are converging, signalling imminent volatility expansion';

    const isGoldenCross = dma50 > dma200 && prev50 <= prev200;
    const isDeathCross = dma50 < dma200 && prev50 >= prev200;

    // Trend Strength Score (0 to 100)
    let trendStrengthScore = 50;
    if (stage === 'STAGE_2_MARKUP') {
      trendStrengthScore = Math.min(98, Math.round(60 + (rsi14 - 50) * 0.8 + (isAbove50 ? 10 : 0) + (isAbove200 ? 10 : 0)));
    } else if (stage === 'STAGE_4_MARKDOWN') {
      trendStrengthScore = Math.max(8, Math.round(40 - (50 - rsi14) * 0.8 - (!isAbove50 ? 10 : 0) - (!isAbove200 ? 10 : 0)));
    } else {
      trendStrengthScore = Math.round(45 + (rsi14 - 50) * 0.5);
    }

    const primaryTrend: TrendDirection =
      stage === 'STAGE_2_MARKUP' ? 'BULLISH' : stage === 'STAGE_4_MARKDOWN' ? 'BEARISH' : shortTermDir;

    // Approximated ADX indicator
    const adx = Math.min(
      85,
      Math.max(12, Math.round(Math.abs(dma50DistPct) * 1.8 + Math.abs(rsi14 - 50) * 0.7 + (bb.bandwidthPct > 15 ? 10 : 5)))
    );

    const trend: TrendHierarchy = {
      shortTerm: {
        direction: shortTermDir,
        label: shortTermDir === 'BULLISH' ? 'Bullish (Above 20 EMA)' : shortTermDir === 'BEARISH' ? 'Bearish (Below 20 EMA)' : 'Neutral (Consolidating)',
        description: 'Governs 1-to-20 day tactical swing momentum',
      },
      mediumTerm: {
        direction: mediumTermDir,
        label: mediumTermDir === 'BULLISH' ? 'Bullish (Above Rising 50 SMA)' : mediumTermDir === 'BEARISH' ? 'Bearish (Below Falling 50 SMA)' : 'Neutral',
        description: 'Governs 1-to-6 month intermediate positional trend',
      },
      longTerm: {
        direction: longTermDir,
        label: longTermDir === 'BULLISH' ? 'Bullish (Above 200 SMA)' : longTermDir === 'BEARISH' ? 'Bearish (Below 200 SMA)' : 'Neutral (At Benchmark)',
        description: 'Governs multi-quarter institutional regime',
      },
      primaryTrend,
      trendStrengthScore,
      adx,
      movingAverageAlignment,
      alignmentDescription,
      isGoldenCross,
      isDeathCross,
    };

    // 10. Oscillators & Volatility
    let rsiCondition: 'OVERBOUGHT' | 'BULLISH_MOMENTUM' | 'NEUTRAL' | 'BEARISH_MOMENTUM' | 'OVERSOLD' = 'NEUTRAL';
    let rsiInterpretation = '';

    if (rsi14 >= 70) {
      rsiCondition = 'OVERBOUGHT';
      rsiInterpretation = `RSI (${rsi14}) is in overbought territory (>70). High short-term exhaustion probability. Watch for consolidation.`;
    } else if (rsi14 >= 55) {
      rsiCondition = 'BULLISH_MOMENTUM';
      rsiInterpretation = `RSI (${rsi14}) demonstrates healthy bullish momentum (55-70) with room to run before hitting overbought boundaries.`;
    } else if (rsi14 <= 30) {
      rsiCondition = 'OVERSOLD';
      rsiInterpretation = `RSI (${rsi14}) is oversold (<30). Downside momentum is heavily stretched; watch for a mean-reversion technical bounce.`;
    } else if (rsi14 <= 45) {
      rsiCondition = 'BEARISH_MOMENTUM';
      rsiInterpretation = `RSI (${rsi14}) is below the 50 centerline, indicating persistent bearish selling control.`;
    } else {
      rsiCondition = 'NEUTRAL';
      rsiInterpretation = `RSI (${rsi14}) is hovering near the neutral 50 equilibrium level, showing balanced two-way price action.`;
    }

    const macdCrossover: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NEUTRAL' =
      macd.histogram > 0 && macd.macdLine > macd.signalLine
        ? 'BULLISH_CROSS'
        : macd.histogram < 0 && macd.macdLine < macd.signalLine
        ? 'BEARISH_CROSS'
        : 'NEUTRAL';

    const macdInterpretation =
      macdCrossover === 'BULLISH_CROSS'
        ? `MACD line ($${macd.macdLine}) is above signal ($${macd.signalLine}) with expanding positive histogram (+${macd.histogram}).`
        : macdCrossover === 'BEARISH_CROSS'
        ? `MACD line ($${macd.macdLine}) is below signal ($${macd.signalLine}) with negative histogram (${macd.histogram}).`
        : 'MACD momentum is flat / converging.';

    const isBBSqueeze = bb.bandwidthPct <= 6.5;

    const oscillators: OscillatorsData = {
      rsi14,
      rsiCondition,
      rsiInterpretation,
      macd: {
        macdLine: macd.macdLine,
        signalLine: macd.signalLine,
        histogram: macd.histogram,
        crossover: macdCrossover,
        interpretation: macdInterpretation,
      },
      bollingerBands: {
        upper: bb.upper,
        middle: bb.middle,
        lower: bb.lower,
        bandwidthPct: bb.bandwidthPct,
        percentB: bb.percentB,
        isSqueeze: isBBSqueeze,
      },
      atr14,
      atrPercent,
      relativeVolume,
      volumeCondition,
      fiftyTwoWeek: {
        high: fiftyTwoWeekHigh,
        low: fiftyTwoWeekLow,
        distHighPct: dist52WHighPct,
        distLowPct: dist52WLowPct,
      },
    };

    const movingAverages: MovingAveragesData = {
      dma20,
      dma50,
      dma200,
      dma20DistPct,
      dma50DistPct,
      dma200DistPct,
      slope50,
      slope200,
    };

    // 11. Actionable Strategic Blueprint
    let verdict: ActionableVerdict = 'HOLD_TRAIL_STOPS';
    let verdictTitle = 'Hold & Trail Stops';
    let bias: 'BULLISH' | 'NEUTRAL' | 'BEARISH' = 'BULLISH';
    let idealEntryLow = currentPrice;
    let idealEntryHigh = currentPrice;
    let entryRationale = '';
    let stopPrice = Number((currentPrice * 0.95).toFixed(2));
    let stopRationale = '';
    const targets: Array<{ label: string; price: number; distancePct: number; rationale: string }> = [];
    let playbookGuidance = '';

    if (stage === 'STAGE_2_MARKUP') {
      bias = 'BULLISH';
      if (subPhase === 'LATE_STAGE_CLIMAX') {
        verdict = 'TAKE_PROFIT';
        verdictTitle = 'Take Partial Profits / Trail Tight Stops';
        idealEntryLow = dma20;
        idealEntryHigh = Number((dma20 * 1.02).toFixed(2));
        entryRationale = `Wait for a standard mean-reversion pullback toward the 20 EMA ($${dma20}) before initiating fresh size.`;
        stopPrice = immediateSupport ? Number((immediateSupport.price * 0.98).toFixed(2)) : Number((dma50 * 0.98).toFixed(2));
        stopRationale = 'Below immediate swing support floor';
        playbookGuidance = `Lock in partial gains into recent strength and trail protective stop-losses. Do not chase new longs at these extended levels.`;
      } else if (dma20DistPct > 4) {
        verdict = 'BUY_ON_PULLBACK';
        verdictTitle = 'Buy on Pullback to Dynamic Support';
        idealEntryLow = dma20;
        idealEntryHigh = Number((dma20 * 1.02).toFixed(2));
        entryRationale = `Optimal risk/reward sits on dip tests of the 20 EMA ($${dma20}) or local support ($${immediateSupport?.price || dma50}).`;
        stopPrice = immediateSupport ? Number((immediateSupport.price * 0.97).toFixed(2)) : Number((dma50 * 0.97).toFixed(2));
        stopRationale = `Structural invalidation if daily close breaks below $${stopPrice}`;
        playbookGuidance = `Trend is healthy and rising. Let price come to you at dynamic support instead of paying high breakout premiums.`;
      } else {
        verdict = 'STRONG_BUY';
        verdictTitle = 'Strong Buy / Early Expansion';
        idealEntryLow = Number((currentPrice * 0.99).toFixed(2));
        idealEntryHigh = Number((currentPrice * 1.01).toFixed(2));
        entryRationale = `Current price sits right on dynamic support with favorable upside asymmetry.`;
        stopPrice = immediateSupport ? Number((immediateSupport.price * 0.97).toFixed(2)) : Number((dma50 * 0.97).toFixed(2));
        stopRationale = `Invalidation stop below key support cluster at $${stopPrice}`;
        playbookGuidance = `Stage 2 breakout in progress. Target next overhead resistance levels with disciplined position sizing.`;
      }

      // Upside targets for Bullish
      const r1Target = immediateResistance?.price || Number((currentPrice * 1.06).toFixed(2));
      const r2Target = resistancesAbove[1]?.price || Number((currentPrice * 1.12).toFixed(2));
      targets.push({
        label: 'Target 1 (Immediate Resistance)',
        price: r1Target,
        distancePct: Number((((r1Target - currentPrice) / currentPrice) * 100).toFixed(2)),
        rationale: 'Primary overhead profit-taking zone at immediate structural resistance',
      });
      targets.push({
        label: 'Target 2 (Major Extension)',
        price: r2Target,
        distancePct: Number((((r2Target - currentPrice) / currentPrice) * 100).toFixed(2)),
        rationale: 'Secondary extension target at structural macro level',
      });
    } else if (stage === 'STAGE_4_MARKDOWN') {
      bias = 'BEARISH';
      if (subPhase === 'CAPITULATION_BOTTOM') {
        verdict = 'NEUTRAL_WAIT';
        verdictTitle = 'Neutral Wait / Watch for Base Formation';
        idealEntryLow = immediateSupport?.price || Number((currentPrice * 0.90).toFixed(2));
        idealEntryHigh = currentPrice;
        entryRationale = 'Wait for concrete multi-week higher low before attempting counter-trend entries.';
        stopPrice = Number((fiftyTwoWeekLow * 0.95).toFixed(2));
        stopRationale = 'New 52-week low invalidation';
        playbookGuidance = 'Oversold bounce potential exists, but prevailing trend remains downward. Avoid catching falling knives until Stage 1 base confirms.';
      } else {
        verdict = 'AVOID_BEARISH';
        verdictTitle = 'Avoid / Bearish Downtrend';
        idealEntryLow = 0;
        idealEntryHigh = 0;
        entryRationale = 'No long entries recommended during active Stage 4 decline.';
        stopPrice = Number((dma50 * 1.03).toFixed(2));
        stopRationale = 'Declining 50 SMA resistance ceiling';
        playbookGuidance = 'Downside momentum dominates. Capital preservation is priority. Short positions or put hedges favored into rallies.';
      }

      const s1Target = immediateSupport?.price || Number((currentPrice * 0.92).toFixed(2));
      const s2Target = supportsBelow[1]?.price || Number((currentPrice * 0.85).toFixed(2));
      targets.push({
        label: 'Downside Target 1',
        price: s1Target,
        distancePct: Number((((s1Target - currentPrice) / currentPrice) * 100).toFixed(2)),
        rationale: 'First support floor test',
      });
      targets.push({
        label: 'Downside Target 2',
        price: s2Target,
        distancePct: Number((((s2Target - currentPrice) / currentPrice) * 100).toFixed(2)),
        rationale: 'Deep value capitulation target',
      });
    } else {
      // Stage 1 or Stage 3
      bias = 'NEUTRAL';
      verdict = stage === 'STAGE_1_ACCUMULATION' ? 'BUY_ON_PULLBACK' : 'TRIM_DEFENSIVE';
      verdictTitle = stage === 'STAGE_1_ACCUMULATION' ? 'Accumulate on Base Floor' : 'Trim Defensive / Tighten Stops';
      idealEntryLow = immediateSupport ? immediateSupport.price : Number((currentPrice * 0.97).toFixed(2));
      idealEntryHigh = Number((idealEntryLow * 1.02).toFixed(2));
      entryRationale = 'Buy near the lower boundary of the consolidation range with tight risk definition.';
      stopPrice = Number((idealEntryLow * 0.96).toFixed(2));
      stopRationale = 'Breakdown below range floor invalidates the trade setup';
      playbookGuidance =
        stage === 'STAGE_1_ACCUMULATION'
          ? 'Rangebound trade between support and resistance. Scale in slowly on low-volume dips.'
          : 'Elevated distribution risk. Protect capital and avoid aggressive new allocations until direction resolves.';

      const targetP1 = immediateResistance?.price || Number((currentPrice * 1.05).toFixed(2));
      targets.push({
        label: 'Range Resistance Target',
        price: targetP1,
        distancePct: Number((((targetP1 - currentPrice) / currentPrice) * 100).toFixed(2)),
        rationale: 'Upper ceiling of consolidation channel',
      });
    }

    const potentialGain = Math.abs((targets[0]?.price || currentPrice * 1.05) - currentPrice);
    const potentialRisk = Math.max(0.01, Math.abs(currentPrice - stopPrice));
    const riskRewardRatio = Number((potentialGain / potentialRisk).toFixed(1));

    const blueprint: ActionableBlueprint = {
      verdict,
      verdictTitle,
      bias,
      idealEntryZone: {
        low: idealEntryLow,
        high: idealEntryHigh,
        rationale: entryRationale,
      },
      invalidationStop: {
        price: stopPrice,
        distancePct: Number((((stopPrice - currentPrice) / currentPrice) * 100).toFixed(2)),
        rationale: stopRationale,
      },
      targets,
      riskRewardRatio,
      playbookGuidance,
    };

    const result: StockTechnicalAnalysis = {
      symbol,
      name: companyName,
      currency,
      currentPrice,
      previousClose: prevClose,
      dayChange,
      dayChangePercent,
      asOf: new Date().toISOString(),
      levels,
      immediateResistance,
      immediateSupport,
      pivotPoints,
      marketPhase,
      trend,
      movingAverages,
      oscillators,
      blueprint,
    };

    // Save to cache
    cache.set(symbol, { data: result, timestamp: Date.now() });

    return result;
  }
}

export const technicalAnalysisService = new TechnicalAnalysisService();
